import { Worker } from "bullmq";
import { redis } from "../queues";
import { prisma } from "../lib/prisma";
import {
  createDroplet,
  waitForDropletActive,
  getDropletPublicIP,
} from "../lib/digitalocean";
import { connectSSH, execSSH, writeFileSSH } from "../lib/ssh";
import { generateDockerCompose, generateDockerfile } from "../lib/openclaw-config";
import { ensureFirewall } from "../lib/firewall";
import { waitForTailscaleDevice, getTailscaleDeviceByHostname } from "../lib/tailscale";
import { generateCloudInit } from "../lib/cloud-init";
import { setupConsoleBridge } from "../lib/console-bridge";
import * as crypto from "crypto";

export const poolCreateWorker = new Worker(
  "pool",
  async (job) => {
    if (job.name !== "pool-create") return;

    const { poolDropletId } = job.data as { poolDropletId: string };
    const log = (msg: string) => console.log(`[pool-create:${job.id}] ${msg}`);

    log(`Creating pool droplet ${poolDropletId}`);

    try {
      // 1. Update status to creating
      const poolDroplet = await prisma.poolDroplet.findUnique({
        where: { id: poolDropletId },
      });

      if (!poolDroplet) {
        log(`PoolDroplet ${poolDropletId} not found, skipping`);
        return;
      }

      // Idempotency: if already has a dropletId, it was partially created on a previous attempt
      if (poolDroplet.dropletId && poolDroplet.status !== "creating") {
        log(`PoolDroplet ${poolDropletId} already in status ${poolDroplet.status}, skipping`);
        return;
      }

      await prisma.poolDroplet.update({
        where: { id: poolDropletId },
        data: { status: "creating" },
      });

      // 2. Ensure firewall
      const fwId = await ensureFirewall();
      log(`Firewall ready: ${fwId}`);

      const hostname = `pool-${poolDropletId.slice(0, 8)}`;

      // 3. Create droplet (if not already created on previous attempt)
      let dropletId: number;
      let ipAddress: string;

      if (poolDroplet.dropletId) {
        // Reuse from previous attempt
        dropletId = parseInt(poolDroplet.dropletId);
        log(`Reusing existing droplet ${dropletId} from previous attempt`);
      } else {
        const sshPublicKey = process.env.SSH_PUBLIC_KEY || "ssh-rsa YOUR_KEY_HERE";
        const tailscaleAuthKey = process.env.TAILSCALE_AUTH_KEY!;

        const cloudInit = generateCloudInit({
          sshPublicKey,
          tailscaleAuthKey,
          dropletName: hostname,
        });

        log("Creating droplet...");
        const droplet = await createDroplet(hostname, cloudInit, ["pool"]);
        dropletId = droplet.id;
        log(`Droplet created: ${dropletId}`);

        // Save dropletId immediately for idempotency on retry
        await prisma.poolDroplet.update({
          where: { id: poolDropletId },
          data: {
            dropletId: dropletId.toString(),
            tailscaleHostname: hostname,
          },
        });
      }

      // 4. Wait for droplet to become active
      log("Waiting for droplet to become active...");
      const activeDroplet = await waitForDropletActive(dropletId);
      ipAddress = getDropletPublicIP(activeDroplet);
      log(`Droplet active at ${ipAddress}`);

      await prisma.poolDroplet.update({
        where: { id: poolDropletId },
        data: { ipAddress },
      });

      // 5. Wait for Tailscale
      log("Waiting for Tailscale device to join...");
      const tailscaleIp = await waitForTailscaleDevice(hostname);
      const device = await getTailscaleDeviceByHostname(hostname);
      const tailscaleDeviceId = device?.id || null;
      log(`Tailscale IP: ${tailscaleIp}`);

      await prisma.poolDroplet.update({
        where: { id: poolDropletId },
        data: { tailscaleIp, tailscaleDeviceId },
      });

      // 6. SSH via Tailscale, wait for cloud-init sentinel
      log(`Connecting via Tailscale at ${tailscaleIp}...`);
      const ssh = await connectSSH(tailscaleIp);

      try {
        log("Waiting for cloud-init to complete...");
        for (let i = 0; i < 60; i++) {
          try {
            await execSSH(ssh, "test -f /opt/instaclaw-ready", "/");
            log("Cloud-init complete (sentinel found)");
            break;
          } catch {
            if (i > 0 && i % 10 === 0) log(`Still waiting for cloud-init... (${i * 10}s)`);
            if (i === 59) throw new Error("Cloud-init did not complete within timeout");
          }
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }

        // 7. Verify Docker
        log("Verifying Docker...");
        await execSSH(ssh, "docker --version", "/");

        // 8. Write Dockerfile + docker-compose.yml and build image
        log("Writing Dockerfile and docker-compose.yml...");
        await writeFileSSH(ssh, "/opt/openclaw/Dockerfile", generateDockerfile());

        const gatewayToken = crypto.randomBytes(32).toString("hex");
        const compose = generateDockerCompose(gatewayToken, {
          openrouterApiKey: process.env.OPENROUTER_API_KEY,
          moonshotApiKey: process.env.KIMI_API_KEY,
          braveApiKey: process.env.BRAVE_API_KEY,
          geminiApiKey: process.env.GEMINI_API_KEY,
        });
        await writeFileSSH(ssh, "/opt/openclaw/docker-compose.yml", compose);

        log("Building Docker image...");
        await execSSH(ssh, "docker compose build --pull", "/opt/openclaw");

        // 9. Install uv (needed by nano-banana-pro image generation skill)
        log("Installing uv...");
        await execSSH(
          ssh,
          "docker compose run --rm -u node openclaw-gateway sh -c 'curl -LsSf https://astral.sh/uv/install.sh | sh'",
          "/opt/openclaw"
        );

        // 10. Create workspace directory, canvas directory + media symlink
        log("Creating workspace and media symlink...");
        await execSSH(ssh, "mkdir -p /opt/openclaw/home/.openclaw/workspace", "/");
        await execSSH(ssh, "mkdir -p /opt/openclaw/home/.openclaw/canvas", "/");
        await execSSH(
          ssh,
          "ln -sfn /opt/openclaw/home/.openclaw/workspace /opt/openclaw/home/.openclaw/media",
          "/"
        );

        // 11. Set up console bridge (socat + iptables) for web UI access
        log("Setting up console bridge...");
        await setupConsoleBridge(ssh);

        // 12. Mark as ready (save gateway token for later copy to Instance)
        await prisma.poolDroplet.update({
          where: { id: poolDropletId },
          data: { status: "ready", gatewayToken },
        });

        log(`Pool droplet ${poolDropletId} is READY`);
      } finally {
        ssh.dispose();
      }
    } catch (error) {
      console.error(`[pool-create:${job.id}] Failed:`, error);

      await prisma.poolDroplet.update({
        where: { id: poolDropletId },
        data: {
          status: "failed",
          provisionLog: { error: error instanceof Error ? error.message : String(error) },
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

poolCreateWorker.on("failed", (job, err) => {
  console.error(`Pool-create job ${job?.id} failed:`, err.message);
});

poolCreateWorker.on("completed", (job) => {
  console.log(`Pool-create job ${job.id} completed`);
});
