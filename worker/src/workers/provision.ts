import { Worker } from "bullmq";
import { redis } from "../queues";
import { prisma } from "../lib/prisma";
import {
  createDroplet,
  getDroplet,
  waitForDropletActive,
  getDropletPublicIP,
} from "../lib/digitalocean";
import { connectSSH, execSSH, writeFileSSH } from "../lib/ssh";
import { generateDockerCompose, generateDockerfile, PLAN_MODELS, buildOpenClawConfigObject, generateMcporterConfig } from "../lib/openclaw-config";
import {
  generateSOUL,
  generateUSER,
  generateAGENTS,
  generateMEMORY,
  generateCronJobs,
  generateSiteCreatorSkill,
  generateDeploySiteScript,
} from "../lib/workspace-templates";
import { ensureFirewall } from "../lib/firewall";
import { setupConsoleBridge } from "../lib/console-bridge";
import { waitForTailscaleDevice, getTailscaleDeviceByHostname } from "../lib/tailscale";
import { generateCloudInit } from "../lib/cloud-init";
import { createAPIKey, deleteAPIKey, PLAN_BUDGETS } from "../lib/openrouter";
import * as crypto from "crypto";

interface LogEntry {
  step: string;
  message: string;
  ts: string;
}

interface BotConfig {
  botName: string;
  personality: string;
  customPersonality?: string;
  userName: string;
  userDescription?: string;
  useCases: string[];
  extraContext?: string;
  loop?: string;
  timezone?: string;
}

const CONFIG_PATH = "/opt/openclaw/home/.openclaw/openclaw.json";
const WORKSPACE_DIR = "/opt/openclaw/home/.openclaw/workspace";

async function appendLog(instanceId: string, step: string, message: string) {
  const entry: LogEntry = { step, message, ts: new Date().toISOString() };
  const instance = await prisma.instance.findUnique({
    where: { id: instanceId },
    select: { provisionLog: true },
  });
  const log = (instance?.provisionLog as LogEntry[] | null) || [];
  log.push(entry);
  await prisma.instance.update({
    where: { id: instanceId },
    data: { provisionLog: log },
  });
}

export const provisionWorker = new Worker(
  "provision",
  async (job) => {
    const { instanceId, userId } = job.data;

    const provisionStart = Date.now();
    console.log(`[provision:${job.id}] Starting provisioning for instance ${instanceId}`);

    try {
      // Update status to provisioning
      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          status: "provisioning",
          onboardingStep: "provisioning",
          provisionLog: [],
          provisionStartedAt: new Date(),
        },
      });

      await appendLog(instanceId, "started", "Provisioning started -- creating your server");

      // Ensure DO cloud firewall exists (idempotent)
      const fwId = await ensureFirewall();
      console.log(`[provision:${job.id}] DO firewall ready: ${fwId}`);

      // Fetch full context: bot config, subscription, existing droplet info
      const instanceRecord = await prisma.instance.findUnique({
        where: { id: instanceId },
        include: { user: { select: { id: true, botConfig: true } } },
      });
      const botConfig = instanceRecord?.user?.botConfig as BotConfig | null;
      const botName = botConfig?.botName;
      const instanceName = instanceRecord?.instanceName || null;

      const subscription = await prisma.subscription.findUnique({
        where: { userId },
      });
      const plan = subscription?.plan || "starter";

      // --- IDEMPOTENCY: Reuse existing droplet if it still exists ---
      let dropletId: number | null = null;
      let ipAddress: string | null = null;
      let tailscaleIp: string | null = instanceRecord?.tailscaleIp || null;
      let tailscaleDeviceId: string | null = instanceRecord?.tailscaleDeviceId || null;
      const safeName = `instaclaw-${instanceId.slice(0, 8)}`.replace(/[^a-zA-Z0-9.-]/g, "-");

      if (instanceRecord?.dropletId) {
        try {
          const existing = await getDroplet(parseInt(instanceRecord.dropletId));
          if (existing.status === "active") {
            dropletId = existing.id;
            ipAddress = getDropletPublicIP(existing);
            console.log(`[provision:${job.id}] Reusing existing droplet ${dropletId} at ${ipAddress}`);
            await appendLog(instanceId, "droplet_created", "Found existing server");
            await appendLog(instanceId, "droplet_active", botName ? `Server ${botName} online` : "Server online");

            // If we have the droplet but no Tailscale IP yet, try to discover it
            if (!tailscaleIp) {
              try {
                const device = await getTailscaleDeviceByHostname(safeName);
                if (device) {
                  tailscaleIp = device.addresses.find((a) => a.startsWith("100.")) || null;
                  tailscaleDeviceId = device.id;
                }
              } catch {
                // Will fall through to waitForTailscaleDevice below
              }
            }
          }
        } catch {
          console.log(`[provision:${job.id}] Existing droplet ${instanceRecord.dropletId} not found, creating new one`);
        }
      }

      // --- CREATE DROPLET (if not reusing) ---
      if (!dropletId) {
        const sshPublicKey = process.env.SSH_PUBLIC_KEY || "ssh-rsa YOUR_KEY_HERE";
        const tailscaleAuthKey = process.env.TAILSCALE_AUTH_KEY!;

        const cloudInit = generateCloudInit({
          sshPublicKey,
          tailscaleAuthKey,
          dropletName: safeName,
        });

        console.log(`[provision:${job.id}] Creating droplet...`);
        const droplet = await createDroplet(
          safeName,
          cloudInit,
          botName ? [botName] : []
        );

        dropletId = droplet.id;
        console.log(`[provision:${job.id}] Droplet created: ${dropletId}`);
        await appendLog(instanceId, "droplet_created", "Server created -- waiting for boot");

        // Save dropletId early so retries can find it
        await prisma.instance.update({
          where: { id: instanceId },
          data: { dropletId: dropletId.toString() },
        });

        console.log(`[provision:${job.id}] Waiting for droplet to be active...`);
        const activeDroplet = await waitForDropletActive(dropletId);
        ipAddress = getDropletPublicIP(activeDroplet);
        console.log(`[provision:${job.id}] Droplet active at ${ipAddress}`);
        await appendLog(instanceId, "droplet_active", botName ? `Server ${botName} online` : "Server online");
      }

      // --- WAIT FOR TAILSCALE ---
      if (!tailscaleIp) {
        console.log(`[provision:${job.id}] Waiting for Tailscale device to join...`);
        await appendLog(instanceId, "tailscale", "Connecting to secure network");
        tailscaleIp = await waitForTailscaleDevice(safeName);
        const device = await getTailscaleDeviceByHostname(safeName);
        tailscaleDeviceId = device?.id || null;
        console.log(`[provision:${job.id}] Tailscale IP: ${tailscaleIp}`);
      }

      // Save Tailscale info early
      await prisma.instance.update({
        where: { id: instanceId },
        data: { tailscaleIp, tailscaleDeviceId },
      });

      // --- SSH VIA TAILSCALE + CLOUD-INIT ---
      console.log(`[provision:${job.id}] Connecting via Tailscale at ${tailscaleIp}...`);
      await appendLog(instanceId, "cloud_init", "Configuring server");

      const ssh = await connectSSH(tailscaleIp);
      const gatewayToken = crypto.randomBytes(32).toString("hex");

      try {
        // Wait for cloud-init sentinel file
        console.log(`[provision:${job.id}] Waiting for cloud-init to complete...`);
        for (let i = 0; i < 60; i++) {
          try {
            await execSSH(ssh, "test -f /opt/instaclaw-ready", "/");
            console.log(`[provision:${job.id}] Cloud-init complete (sentinel found)`);
            break;
          } catch {
            if (i > 0 && i % 10 === 0) console.log(`[provision:${job.id}] Still waiting for cloud-init... (${i * 10}s)`);
            if (i === 59) throw new Error("Cloud-init did not complete within timeout");
          }
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }

        // Verify Docker
        console.log(`[provision:${job.id}] Verifying Docker...`);
        await execSSH(ssh, "docker --version", "/");
        await appendLog(instanceId, "docker_ready", "Docker ready");

        // --- OPENCLAW SETUP ---
        console.log(`[provision:${job.id}] Setting up OpenClaw...`);
        await appendLog(instanceId, "openclaw_setup", "Writing configuration");

        // Directories already created by cloud-init and owned by instaclaw (uid 1000)

        // Create per-instance OpenRouter API key
        // On retry: delete stale key (secret is unrecoverable) and create fresh one
        const freshInstance = await prisma.instance.findUnique({
          where: { id: instanceId },
          select: { openrouterKeyId: true },
        });
        if (freshInstance?.openrouterKeyId) {
          console.log(`[provision:${job.id}] Deleting stale OpenRouter key from previous attempt`);
          try { await deleteAPIKey(freshInstance.openrouterKeyId); } catch { /* may already be gone */ }
        }
        const budget = PLAN_BUDGETS[plan] || PLAN_BUDGETS.starter;
        console.log(`[provision:${job.id}] Creating OpenRouter key (plan=${plan}, budget=$${budget})`);
        const orKey = await createAPIKey(`instaclaw-${instanceId.slice(0, 8)}`, budget);
        // Save hash immediately so terminate can clean up on failure
        await prisma.instance.update({
          where: { id: instanceId },
          data: { openrouterKeyId: orKey.hash },
        });
        console.log(`[provision:${job.id}] Created OpenRouter key ${orKey.hash}`);

        // Write Dockerfile (extends base image with Chromium for browser skills)
        await writeFileSSH(ssh, "/opt/openclaw/Dockerfile", generateDockerfile());

        // Write docker-compose.yml with per-instance OpenRouter key
        const compose = generateDockerCompose(gatewayToken, {
          openrouterApiKey: orKey.key,
          braveApiKey: process.env.BRAVE_API_KEY,
          geminiApiKey: process.env.GEMINI_API_KEY,
          composioApiKey: process.env.COMPOSIO_API_KEY,
        });
        await writeFileSSH(ssh, "/opt/openclaw/docker-compose.yml", compose);

        // Build Docker image (pulls base + installs Chromium)
        console.log(`[provision:${job.id}] Building Docker image...`);
        await appendLog(instanceId, "building_image", "Building system image -- this is a big one");
        await execSSH(ssh, "docker compose build --pull", "/opt/openclaw");

        // --- FULL WORKSPACE CONFIGURATION ---
        console.log(`[provision:${job.id}] Configuring workspace...`);
        await appendLog(instanceId, "workspace_setup", "Personalizing your bot");

        // Determine model based on plan
        const planConfig = PLAN_MODELS[plan] || PLAN_MODELS.starter;
        const model = planConfig.primary;
        const llmProvider = planConfig.llmProvider;
        const fallbackModels = planConfig.fallbacks;

        // Write OpenClaw config
        const openclawConfig = buildOpenClawConfigObject({
          model,
          fallbacks: fallbackModels,
          userId,
        });

        await writeFileSSH(ssh, CONFIG_PATH, JSON.stringify(openclawConfig, null, 2));

        // Generate workspace files from bot config
        if (botConfig) {
          await execSSH(ssh, `mkdir -p ${WORKSPACE_DIR}`, "/");
          await writeFileSSH(ssh, `${WORKSPACE_DIR}/SOUL.md`, generateSOUL(botConfig));
          await writeFileSSH(ssh, `${WORKSPACE_DIR}/USER.md`, generateUSER(botConfig));
          await writeFileSSH(ssh, `${WORKSPACE_DIR}/AGENTS.md`, generateAGENTS(botConfig, plan, instanceName));
          await writeFileSSH(ssh, `${WORKSPACE_DIR}/MEMORY.md`, generateMEMORY(botConfig));
        }

        // Write cron jobs if loop is set
        if (botConfig?.loop && botConfig.loop !== "just-exploring") {
          const cronJson = generateCronJobs(botConfig.loop, botConfig.timezone);
          if (cronJson) {
            const cronDir = "/opt/openclaw/home/.openclaw/cron";
            await execSSH(ssh, `mkdir -p ${cronDir}`, "/");
            await writeFileSSH(ssh, `${cronDir}/jobs.json`, cronJson);
            console.log(`[provision:${job.id}] Wrote cron/jobs.json for loop: ${botConfig.loop}`);
          }
        }

        // Write public-site-creator skill (always — handles missing instanceName gracefully)
        const skillDir = `${WORKSPACE_DIR}/skills/public-site-creator/scripts`;
        await execSSH(ssh, `mkdir -p ${skillDir}`, "/");
        await writeFileSSH(ssh, `${WORKSPACE_DIR}/skills/public-site-creator/SKILL.md`, generateSiteCreatorSkill(instanceName));
        await writeFileSSH(ssh, `${skillDir}/deploy_site.py`, generateDeploySiteScript(instanceName));

        // Ensure canvas directory exists for public sites
        await execSSH(ssh, "mkdir -p /opt/openclaw/home/.openclaw/canvas", "/");

        // Create media directory for OpenClaw to store downloaded/generated media
        // (Must be a real directory, not a symlink — symlinks break inside Docker container)
        await execSSH(ssh, "mkdir -p /opt/openclaw/home/.openclaw/media", "/");

        // Write mcporter config for Composio integration
        const mcporterJson = generateMcporterConfig(userId);
        if (mcporterJson) {
          const mcporterDir = "/opt/openclaw/home/.openclaw/config";
          await execSSH(ssh, `mkdir -p ${mcporterDir}`, "/");
          await writeFileSSH(ssh, `${mcporterDir}/mcporter.json`, mcporterJson);
          console.log(`[provision:${job.id}] Wrote mcporter.json for Composio`);
        }

        // --- INSTALL UV (needed by nano-banana-pro image generation skill) ---
        console.log(`[provision:${job.id}] Installing uv...`);
        await execSSH(ssh, "docker compose run --rm -u node openclaw-gateway sh -c 'curl -LsSf https://astral.sh/uv/install.sh | sh'", "/opt/openclaw");

        // --- START CONTAINER ---
        console.log(`[provision:${job.id}] Starting OpenClaw container...`);
        await appendLog(instanceId, "container_started", "Starting your bot");
        await execSSH(ssh, "docker compose up -d", "/opt/openclaw");

        // Verify it's running
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const containerStatus = await execSSH(
          ssh,
          'docker compose ps openclaw-gateway --format "{{.State}}"',
          "/opt/openclaw"
        );
        console.log(`[provision:${job.id}] Container status: ${containerStatus.trim()}`);

        // Set up console bridge (socat + iptables) for web UI access
        console.log(`[provision:${job.id}] Setting up console bridge...`);
        await setupConsoleBridge(ssh);

        await appendLog(instanceId, "base_complete", "Setup complete -- ready for Telegram");
        console.log(`[provision:${job.id}] Full provisioning complete`);
      } finally {
        ssh.dispose();
      }

      // Update instance record with everything
      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          dropletId: dropletId!.toString(),
          ipAddress,
          tailscaleIp,
          tailscaleDeviceId,
          gatewayToken,
          status: "active",
          onboardingStep: "awaiting_telegram_token",
          llmProvider: plan === "pro" ? "claude" : "gemini",
          llmConfigured: true,
          provisionedAt: new Date(),
        },
      });

      const provisionDuration = ((Date.now() - provisionStart) / 1000).toFixed(1);
      console.log(`[provision:${job.id}] Provisioning complete in ${provisionDuration}s`);
      console.log(`[provision:${job.id}] [TIMING] provision: ${provisionDuration}s (standard path)`);
    } catch (error) {
      console.error(`[provision:${job.id}] Failed:`, error);

      await appendLog(instanceId, "error", "Provisioning encountered an issue -- retrying");

      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          status: "failed",
          onboardingStep: "awaiting_provision",
        },
      });

      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 2,
  }
);

provisionWorker.on("failed", (job, err) => {
  console.error(`Provision job ${job?.id} failed:`, err.message);
});

provisionWorker.on("completed", (job) => {
  console.log(`Provision job ${job.id} completed`);
});
