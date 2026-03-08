import { Worker } from "bullmq";
import { redis, provisionQueue, poolQueue } from "../queues";
import { prisma } from "../lib/prisma";
import { connectSSH, execSSH, writeFileSSH } from "../lib/ssh";
import { generateDockerCompose, PLAN_MODELS } from "../lib/openclaw-config";
import { renameDroplet } from "../lib/digitalocean";
import { createAPIKey, deleteAPIKey, PLAN_BUDGETS } from "../lib/openrouter";
import {
  generateSOUL,
  generateUSER,
  generateAGENTS,
  generateMEMORY,
  generateCronJobs,
  generateSiteCreatorSkill,
  generateDeploySiteScript,
} from "../lib/workspace-templates";

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

async function appendLogs(instanceId: string, entries: Array<{ step: string; message: string }>) {
  const instance = await prisma.instance.findUnique({
    where: { id: instanceId },
    select: { provisionLog: true },
  });
  const log = (instance?.provisionLog as LogEntry[] | null) || [];
  const now = new Date().toISOString();
  for (const e of entries) {
    log.push({ step: e.step, message: e.message, ts: now });
  }
  await prisma.instance.update({
    where: { id: instanceId },
    data: { provisionLog: log },
  });
}

export const poolAllocateWorker = new Worker(
  "pool-allocate",
  async (job) => {

    const { instanceId, userId } = job.data as { instanceId: string; userId: string };
    const log = (msg: string) => console.log(`[pool-allocate:${job.id}] ${msg}`);

    const allocateStart = Date.now();
    log(`Allocating pool droplet for instance ${instanceId}`);
    let orKeyHash: string | null = null;

    try {
      // 1. Update instance status
      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          status: "provisioning",
          onboardingStep: "provisioning",
          provisionLog: [],
          provisionStartedAt: new Date(),
        },
      });

      // 2. Atomic claim: grab a ready pool droplet
      const poolDroplet = await prisma.$transaction(async (tx: typeof prisma) => {
        const candidate = await tx.poolDroplet.findFirst({
          where: { status: "ready" },
          orderBy: { createdAt: "asc" },
        });
        if (!candidate) return null;
        return tx.poolDroplet.update({
          where: { id: candidate.id },
          data: {
            status: "allocating",
            allocatedTo: instanceId,
            allocatedAt: new Date(),
          },
        });
      });

      // 3. If pool empty, fallback to standard provision
      if (!poolDroplet) {
        log("Pool empty -- falling back to standard provision");
        await appendLog(instanceId, "started", "Provisioning started -- creating your server");
        await provisionQueue.add("provision", { instanceId, userId });
        return;
      }

      log(`Claimed pool droplet ${poolDroplet.id} (${poolDroplet.tailscaleIp})`);

      // 4. Rapidly emit log entries for pre-completed infrastructure steps
      await appendLogs(instanceId, [
        { step: "started", message: "Allocating your server" },
        { step: "droplet_created", message: "Server reserved" },
        { step: "droplet_active", message: "Server online" },
        { step: "cloud_init", message: "Configuring server" },
        { step: "docker_ready", message: "Docker ready" },
        { step: "pulling_images", message: "System image ready" },
      ]);

      // 5. Fetch bot config + subscription
      const instanceRecord = await prisma.instance.findUnique({
        where: { id: instanceId },
        include: { user: { select: { id: true, botConfig: true } } },
      });
      const botConfig = instanceRecord?.user?.botConfig as BotConfig | null;
      const instanceName = instanceRecord?.instanceName || null;

      const subscription = await prisma.subscription.findUnique({
        where: { userId },
      });
      const plan = subscription?.plan || "starter";

      // 6. Create per-instance OpenRouter key (before SSH, so cleanup is simpler on failure)
      const budget = PLAN_BUDGETS[plan] || PLAN_BUDGETS.starter;
      log(`Creating OpenRouter key (plan=${plan}, budget=$${budget})`);
      const orKey = await createAPIKey(`instaclaw-${instanceId.slice(0, 8)}`, budget);
      orKeyHash = orKey.hash;
      log(`Created OpenRouter key ${orKey.hash}`);

      // Resolve plan config before SSH block so it's in scope for instance update
      const planConfig = PLAN_MODELS[plan] || PLAN_MODELS.starter;

      // 6b. SSH to pool droplet via Tailscale IP
      log(`Connecting to pool droplet at ${poolDroplet.tailscaleIp}...`);
      const ssh = await connectSSH(poolDroplet.tailscaleIp!);

      try {
        // 7. Write customer-specific config
        await appendLog(instanceId, "workspace_setup", "Personalizing your bot");

        const model = planConfig.primary;
        const fallbackModels = planConfig.fallbacks;

        const openclawConfig = {
          commands: { native: "auto", nativeSkills: "auto" },
          agents: {
            defaults: {
              model: { primary: model, fallbacks: fallbackModels },
              workspace: "~/.openclaw/workspace",
              maxConcurrent: 4,
              subagents: { maxConcurrent: 8 },
            },
          },
          gateway: {
            trustedProxies: ["127.0.0.1", "::1"],
            controlUi: {
              allowedOrigins: ["*"],
              allowInsecureAuth: true,
              dangerouslyDisableDeviceAuth: true,
            },
          },
          messages: { ackReactionScope: "group-mentions" },
          plugins: { entries: { telegram: { enabled: true } } },
          cron: { enabled: true },
          skills: { entries: { "nano-banana-pro": { enabled: true } } },
        };

        await writeFileSSH(ssh, CONFIG_PATH, JSON.stringify(openclawConfig, null, 2));

        // Write workspace files
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
            log(`Wrote cron/jobs.json for loop: ${botConfig.loop}`);
          }
        }

        // Write public-site-creator skill (always — handles missing instanceName gracefully)
        const skillDir = `${WORKSPACE_DIR}/skills/public-site-creator/scripts`;
        await execSSH(ssh, `mkdir -p ${skillDir}`, "/");
        await writeFileSSH(ssh, `${WORKSPACE_DIR}/skills/public-site-creator/SKILL.md`, generateSiteCreatorSkill(instanceName));
        await writeFileSSH(ssh, `${skillDir}/deploy_site.py`, generateDeploySiteScript(instanceName));

        // Ensure canvas directory exists for public sites
        await execSSH(ssh, "mkdir -p /opt/openclaw/home/.openclaw/canvas", "/");

        log("Workspace configured");

        // 7b. Regenerate docker-compose with per-instance key (pool-create wrote it with master key)
        const compose = generateDockerCompose(poolDroplet.gatewayToken!, {
          openrouterApiKey: orKey.key,
          braveApiKey: process.env.BRAVE_API_KEY,
          geminiApiKey: process.env.GEMINI_API_KEY,
        });
        await writeFileSSH(ssh, "/opt/openclaw/docker-compose.yml", compose);

        // 8. Start container
        await appendLog(instanceId, "container_started", "Starting your bot");
        await execSSH(ssh, "docker compose up -d", "/opt/openclaw");

        // Verify container running
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const containerStatus = await execSSH(
          ssh,
          'docker compose ps openclaw-gateway --format "{{.State}}"',
          "/opt/openclaw"
        );
        log(`Container status: ${containerStatus.trim()}`);

        await appendLog(instanceId, "base_complete", "Setup complete -- ready for Telegram");
        log("Allocation complete");
      } finally {
        ssh.dispose();
      }

      // 9. Copy infra fields from PoolDroplet to Instance
      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          dropletId: poolDroplet.dropletId,
          ipAddress: poolDroplet.ipAddress,
          tailscaleIp: poolDroplet.tailscaleIp,
          tailscaleDeviceId: poolDroplet.tailscaleDeviceId,
          gatewayToken: poolDroplet.gatewayToken,
          openrouterKeyId: orKey.hash,
          status: "active",
          onboardingStep: "awaiting_telegram_token",
          llmProvider: planConfig.llmProvider,
          llmConfigured: true,
          provisionedAt: new Date(),
        },
      });

      // 10. Rename droplet from pool-xxx to instaclaw-xxx for DO dashboard clarity
      try {
        const safeName = `instaclaw-${instanceId.slice(0, 8)}`;
        await renameDroplet(parseInt(poolDroplet.dropletId!), safeName);
        log(`Renamed droplet to ${safeName}`);
      } catch {
        // Non-critical -- don't fail allocation over a rename
      }

      // 11. Mark pool droplet as allocated
      await prisma.poolDroplet.update({
        where: { id: poolDroplet.id },
        data: { status: "allocated" },
      });

      // 12. Trigger pool replenishment
      await poolQueue.add("pool-maintain", {}, {
        jobId: `pool-maintain-after-allocate-${Date.now()}`,
      });

      const allocateDuration = ((Date.now() - allocateStart) / 1000).toFixed(1);
      log(`Instance ${instanceId} provisioned via pool in fast path (${allocateDuration}s)`);
      log(`[TIMING] provision: ${allocateDuration}s (pool fast path)`);
    } catch (error) {
      console.error(`[pool-allocate:${job.id}] Failed:`, error);

      // Clean up per-instance OpenRouter key if we created one
      try {
        if (orKeyHash) {
          await deleteAPIKey(orKeyHash);
          log(`Cleaned up OpenRouter key ${orKeyHash}`);
        }
      } catch {
        // Best effort
      }

      // Try to mark pool droplet as failed if we claimed one
      try {
        const claimed = await prisma.poolDroplet.findFirst({
          where: { allocatedTo: instanceId, status: "allocating" },
        });
        if (claimed) {
          await prisma.poolDroplet.update({
            where: { id: claimed.id },
            data: { status: "failed" },
          });
        }
      } catch {
        // Best effort
      }

      // Reset instance and fallback to standard provision
      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          status: "pending",
          onboardingStep: "awaiting_provision",
          provisionLog: [],
        },
      });

      log("Falling back to standard provision after allocation failure");
      await provisionQueue.add("provision", { instanceId, userId });
    }
  },
  {
    connection: redis,
    concurrency: 1,
  }
);

poolAllocateWorker.on("failed", (job, err) => {
  console.error(`Pool-allocate job ${job?.id} failed:`, err.message);
});

poolAllocateWorker.on("completed", (job) => {
  console.log(`Pool-allocate job ${job.id} completed`);
});
