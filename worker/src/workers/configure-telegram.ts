import { Worker } from "bullmq";
import { redis } from "../queues";
import { prisma } from "../lib/prisma";
import { connectSSH, execSSH, writeFileSSH } from "../lib/ssh";

const CONFIG_PATH = "/opt/openclaw/home/.openclaw/openclaw.json";

export const configureTelegramWorker = new Worker(
  "configure",
  async (job) => {
    if (job.name !== "configure-telegram") return;

    const { instanceId, token } = job.data;

    console.log(`[configure-telegram:${job.id}] Configuring Telegram for instance ${instanceId}`);

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId },
      });

      if (!instance || !instance.ipAddress) {
        throw new Error("Instance not found or not provisioned");
      }

      const ssh = await connectSSH(instance.ipAddress);

      try {
        // Read existing config or create new one
        let config: Record<string, unknown> = {};
        try {
          const existing = await execSSH(ssh, `cat ${CONFIG_PATH}`);
          config = JSON.parse(existing);
        } catch {
          // No existing config, start fresh
        }

        // Update Telegram configuration (OpenClaw format)
        const channels = (config.channels as Record<string, unknown>) || {};
        channels.telegram = {
          enabled: true,
          botToken: token,
          dmPolicy: "open",
          allowFrom: ["*"],
        };
        config.channels = channels;

        // Ensure config directory exists with correct ownership
        await execSSH(ssh, "mkdir -p /opt/openclaw/home/.openclaw && chown -R 1000:1000 /opt/openclaw/home");

        // Write updated config
        await writeFileSSH(ssh, CONFIG_PATH, JSON.stringify(config, null, 2));
        await execSSH(ssh, `chown 1000:1000 ${CONFIG_PATH}`);

        // Restart gateway if running
        try {
          await execSSH(ssh, "docker compose restart openclaw-gateway", "/opt/openclaw");
        } catch {
          // Container might not be running yet, that's ok
          console.log(`[configure-telegram:${job.id}] Gateway not running yet, will start after LLM config`);
        }

        console.log(`[configure-telegram:${job.id}] Telegram configured successfully`);
      } finally {
        ssh.dispose();
      }

      // Workspace is already configured during provisioning, so go straight to complete
      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          onboardingStep: "complete",
        },
      });
    } catch (error) {
      console.error(`[configure-telegram:${job.id}] Failed:`, error);

      // Revert to awaiting token so user can retry
      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          onboardingStep: "awaiting_telegram_token",
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

configureTelegramWorker.on("failed", (job, err) => {
  console.error(`Configure Telegram job ${job?.id} failed:`, err.message);
});
