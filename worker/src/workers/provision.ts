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
import { generateDockerCompose } from "../lib/openclaw-config";
import {
  generateSOUL,
  generateUSER,
  generateAGENTS,
  generateMEMORY,
} from "../lib/workspace-templates";
import * as fs from "fs";
import * as path from "path";
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

    console.log(`[provision:${job.id}] Starting provisioning for instance ${instanceId}`);

    try {
      // Update status to provisioning
      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          status: "provisioning",
          onboardingStep: "provisioning",
          provisionLog: [],
        },
      });

      await appendLog(instanceId, "started", "Provisioning started -- creating your server");

      // Fetch full context: bot config, subscription, existing droplet info
      const instanceRecord = await prisma.instance.findUnique({
        where: { id: instanceId },
        include: { user: { select: { id: true, botConfig: true } } },
      });
      const botConfig = instanceRecord?.user?.botConfig as BotConfig | null;
      const botName = botConfig?.botName;

      const subscription = await prisma.subscription.findUnique({
        where: { userId },
      });
      const plan = subscription?.plan || "starter";

      // --- IDEMPOTENCY: Reuse existing droplet if it still exists ---
      let dropletId: number | null = null;
      let ipAddress: string | null = null;

      if (instanceRecord?.dropletId) {
        try {
          const existing = await getDroplet(parseInt(instanceRecord.dropletId));
          if (existing.status === "active") {
            dropletId = existing.id;
            ipAddress = getDropletPublicIP(existing);
            console.log(`[provision:${job.id}] Reusing existing droplet ${dropletId} at ${ipAddress}`);
            await appendLog(instanceId, "droplet_created", "Found existing server");
            await appendLog(instanceId, "droplet_active", botName ? `Server ${botName} online` : "Server online");
          }
        } catch {
          console.log(`[provision:${job.id}] Existing droplet ${instanceRecord.dropletId} not found, creating new one`);
        }
      }

      // --- CREATE DROPLET (if not reusing) ---
      if (!dropletId) {
        const cloudInitPath = path.join(__dirname, "../templates/cloud-init.yml");
        let cloudInit: string;
        try {
          cloudInit = fs.readFileSync(cloudInitPath, "utf-8");
        } catch {
          cloudInit = generateCloudInit();
        }

        console.log(`[provision:${job.id}] Creating droplet...`);
        const droplet = await createDroplet(
          `instaclaw-${instanceId.slice(0, 8)}`,
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

      // --- SSH + CLOUD-INIT ---
      console.log(`[provision:${job.id}] Waiting for SSH and cloud-init...`);
      await appendLog(instanceId, "cloud_init", "Installing system software");
      await new Promise((resolve) => setTimeout(resolve, 30000));

      const ssh = await connectSSH(ipAddress!);

      try {
        // Wait for cloud-init to finish
        console.log(`[provision:${job.id}] Waiting for cloud-init to complete...`);
        for (let i = 0; i < 60; i++) {
          try {
            const status = await execSSH(ssh, "cloud-init status --wait 2>/dev/null || cloud-init status 2>/dev/null || echo 'unknown'", "/");
            if (status.includes("done") || status.includes("error")) break;
            if (i > 0 && i % 10 === 0) console.log(`[provision:${job.id}] Still waiting for cloud-init... (${i * 10}s)`);
          } catch {
            // cloud-init command might not exist yet
          }
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }

        // Verify Docker
        console.log(`[provision:${job.id}] Verifying Docker...`);
        await execSSH(ssh, "docker --version", "/");
        await appendLog(instanceId, "docker_ready", "Docker installed and ready");

        // --- OPENCLAW SETUP ---
        console.log(`[provision:${job.id}] Setting up OpenClaw...`);
        await appendLog(instanceId, "openclaw_setup", "Configuring your AI assistant");

        // Create directories
        await execSSH(ssh, "mkdir -p /opt/openclaw/home/.openclaw /opt/openclaw/data", "/");
        await execSSH(ssh, "chown -R 1000:1000 /opt/openclaw/home", "/");

        // Write docker-compose.yml
        const gatewayToken = crypto.randomBytes(32).toString("hex");
        const compose = generateDockerCompose(gatewayToken, {
          openrouterApiKey: process.env.OPENROUTER_API_KEY,
          moonshotApiKey: process.env.KIMI_API_KEY,
          braveApiKey: process.env.BRAVE_API_KEY,
        });
        await writeFileSSH(ssh, "/opt/openclaw/docker-compose.yml", compose);

        // Pull Docker images
        console.log(`[provision:${job.id}] Pulling Docker images...`);
        await appendLog(instanceId, "pulling_images", "Gathering the latest components");
        await execSSH(ssh, "docker compose pull", "/opt/openclaw");

        // --- FULL WORKSPACE CONFIGURATION (previously done in configure-workspace) ---
        console.log(`[provision:${job.id}] Configuring workspace...`);
        await appendLog(instanceId, "workspace_setup", "Personalizing your bot");

        // Determine model based on plan
        const model = plan === "pro" ? "openrouter/anthropic/claude-sonnet-4.5" : "moonshot/kimi-k2.5";
        const llmProvider = plan === "pro" ? "claude" : "kimi";
        const fallbackModel = "openrouter/meta-llama/llama-3.3-70b-instruct:free";

        // Write OpenClaw config (everything except Telegram -- that comes after user provides token)
        const openclawConfig = {
          commands: { native: "auto", nativeSkills: "auto" },
          agents: {
            defaults: {
              model: { primary: model, fallbacks: [fallbackModel] },
              workspace: "~/.openclaw/workspace",
              maxConcurrent: 4,
              subagents: { maxConcurrent: 8 },
            },
          },
          messages: { ackReactionScope: "group-mentions" },
          plugins: { entries: { telegram: { enabled: true } } },
          cron: { enabled: true },
          skills: { entries: { "nano-banana-pro": { enabled: true } } },
        };

        await writeFileSSH(ssh, CONFIG_PATH, JSON.stringify(openclawConfig, null, 2));
        await execSSH(ssh, `chown 1000:1000 ${CONFIG_PATH}`);

        // Generate workspace files from bot config
        if (botConfig) {
          await execSSH(ssh, `mkdir -p ${WORKSPACE_DIR}`, "/");
          await writeFileSSH(ssh, `${WORKSPACE_DIR}/SOUL.md`, generateSOUL(botConfig));
          await writeFileSSH(ssh, `${WORKSPACE_DIR}/USER.md`, generateUSER(botConfig));
          await writeFileSSH(ssh, `${WORKSPACE_DIR}/AGENTS.md`, generateAGENTS(botConfig, plan));
          await writeFileSSH(ssh, `${WORKSPACE_DIR}/MEMORY.md`, generateMEMORY(botConfig));
        }

        // Fix ownership on all workspace files
        await execSSH(ssh, "chown -R 1000:1000 /opt/openclaw/home", "/");

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
          status: "active",
          onboardingStep: "awaiting_telegram_token",
          llmProvider: plan === "pro" ? "claude" : "kimi",
          llmConfigured: true,
          provisionedAt: new Date(),
        },
      });

      console.log(`[provision:${job.id}] Provisioning complete!`);
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

function generateCloudInit(): string {
  const sshPubKey = process.env.SSH_PUBLIC_KEY || "ssh-rsa YOUR_KEY_HERE";

  return `#cloud-config
package_update: true
package_upgrade: true

packages:
  - curl
  - wget
  - git
  - jq
  - ufw
  - fail2ban
  - htop

runcmd:
  - ufw default deny incoming
  - ufw default allow outgoing
  - ufw allow ssh
  - ufw --force enable
  - systemctl enable fail2ban
  - systemctl start fail2ban
  - curl -fsSL https://get.docker.com | sh
  - systemctl enable docker
  - systemctl start docker
  - mkdir -p /opt/openclaw/config /opt/openclaw/data
  - mkdir -p /etc/docker
  - |
    cat > /etc/docker/daemon.json << 'EOF'
    {
      "log-driver": "json-file",
      "log-opts": {
        "max-size": "10m",
        "max-file": "3"
      }
    }
    EOF
  - systemctl restart docker

write_files:
  - path: /etc/fail2ban/jail.local
    content: |
      [DEFAULT]
      bantime = 3600
      findtime = 600
      maxretry = 3
      [sshd]
      enabled = true
    permissions: '0644'

final_message: "InstaClaw server setup complete!"
`;
}
