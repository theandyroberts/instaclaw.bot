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
        },
      });

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

      // Wait for active
      console.log(`[provision:${job.id}] Waiting for droplet to be active...`);
      const activeDroplet = await waitForDropletActive(droplet.id);
      const ipAddress = getDropletPublicIP(activeDroplet);
      console.log(`[provision:${job.id}] Droplet active at ${ipAddress}`);

      // Wait for SSH
      console.log(`[provision:${job.id}] Waiting for SSH...`);
      await new Promise((resolve) => setTimeout(resolve, 30000)); // Give cloud-init time

      // SSH in and set up OpenClaw
      const ssh = await connectSSH(ipAddress);

      try {
        console.log(`[provision:${job.id}] Setting up OpenClaw...`);

        // Create directories
        await execSSH(ssh, "mkdir -p /opt/openclaw/config /opt/openclaw/data", "/");

        // Write docker-compose.yml
        const compose = generateDockerCompose();
        await writeFileSSH(ssh, "/opt/openclaw/docker-compose.yml", compose);

        // Pull Docker images
        console.log(`[provision:${job.id}] Pulling Docker images...`);
        await execSSH(ssh, "docker compose pull", "/opt/openclaw");

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
  - mkdir -p /opt/openclaw/config /opt/openclaw/data
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
