import { Worker } from "bullmq";
import { redis } from "../queues";
import { prisma } from "../lib/prisma";
import {
  createDroplet,
  waitForDropletActive,
  getDropletPublicIP,
} from "../lib/digitalocean";
import { connectSSH, execSSH, writeFileSSH } from "../lib/ssh";
import { generateDockerCompose } from "../lib/openclaw-config";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

interface LogEntry {
  step: string;
  message: string;
  ts: string;
}

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

      // Read cloud-init template
      const cloudInitPath = path.join(__dirname, "../templates/cloud-init.yml");
      let cloudInit: string;
      try {
        cloudInit = fs.readFileSync(cloudInitPath, "utf-8");
      } catch {
        // Fallback inline cloud-init if template not found
        cloudInit = generateCloudInit();
      }

      // Create droplet
      console.log(`[provision:${job.id}] Creating droplet...`);
      const droplet = await createDroplet(
        `instaclaw-${instanceId.slice(0, 8)}`,
        cloudInit
      );

      console.log(`[provision:${job.id}] Droplet created: ${droplet.id}`);
      await appendLog(instanceId, "droplet_created", "Server created -- waiting for boot");

      // Wait for active
      console.log(`[provision:${job.id}] Waiting for droplet to be active...`);
      const activeDroplet = await waitForDropletActive(droplet.id);
      const ipAddress = getDropletPublicIP(activeDroplet);
      console.log(`[provision:${job.id}] Droplet active at ${ipAddress}`);
      const instanceRecord = await prisma.instance.findUnique({
        where: { id: instanceId },
        include: { user: { select: { botConfig: true } } },
      });
      const botName = (instanceRecord?.user?.botConfig as { botName?: string } | null)?.botName;
      await appendLog(instanceId, "droplet_active", botName ? `Server ${botName} online` : "Server online");

      // Wait for SSH and cloud-init to finish
      console.log(`[provision:${job.id}] Waiting for SSH and cloud-init...`);
      await appendLog(instanceId, "cloud_init", "Installing system software");
      await new Promise((resolve) => setTimeout(resolve, 30000)); // Initial wait for SSH

      const ssh = await connectSSH(ipAddress);

      // Wait for cloud-init to finish (installs Docker, etc.)
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

      // Verify Docker is available
      console.log(`[provision:${job.id}] Verifying Docker...`);
      await execSSH(ssh, "docker --version", "/");
      await appendLog(instanceId, "docker_ready", "Docker installed and ready");

      try {
        console.log(`[provision:${job.id}] Setting up OpenClaw...`);
        await appendLog(instanceId, "openclaw_setup", "Configuring your AI assistant");

        // Create directories (config lives at home/.openclaw for container's node user)
        await execSSH(ssh, "mkdir -p /opt/openclaw/home/.openclaw /opt/openclaw/data", "/");
        await execSSH(ssh, "chown -R 1000:1000 /opt/openclaw/home", "/");

        // Write docker-compose.yml with gateway token and API keys
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

        await appendLog(instanceId, "base_complete", "Base setup complete -- ready for Telegram");
        console.log(`[provision:${job.id}] Base setup complete`);
      } finally {
        ssh.dispose();
      }

      // Update instance record
      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          dropletId: droplet.id.toString(),
          ipAddress,
          status: "active",
          onboardingStep: "awaiting_telegram_token",
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
