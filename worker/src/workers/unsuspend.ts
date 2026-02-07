import { Worker } from "bullmq";
import { redis } from "../queues";
import { prisma } from "../lib/prisma";
import { connectSSH, execSSH } from "../lib/ssh";

export const unsuspendWorker = new Worker(
  "lifecycle",
  async (job) => {
    if (job.name !== "unsuspend") return;

    const { instanceId } = job.data;

    console.log(`[unsuspend:${job.id}] Unsuspending instance ${instanceId}`);

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId },
      });

      if (!instance || !instance.ipAddress) {
        console.log(`[unsuspend:${job.id}] Instance not found or not provisioned, skipping`);
        return;
      }

      const ssh = await connectSSH(instance.ipAddress);

      try {
        // Start the OpenClaw gateway container
        await execSSH(ssh, "docker compose start openclaw-gateway", "/opt/openclaw");
        console.log(`[unsuspend:${job.id}] Gateway started`);
      } finally {
        ssh.dispose();
      }

      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          status: "active",
          suspendedAt: null,
        },
      });

      console.log(`[unsuspend:${job.id}] Instance unsuspended successfully`);
    } catch (error) {
      console.error(`[unsuspend:${job.id}] Failed:`, error);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 2,
  }
);

unsuspendWorker.on("failed", (job, err) => {
  console.error(`Unsuspend job ${job?.id} failed:`, err.message);
});
