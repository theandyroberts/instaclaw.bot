import { Worker } from "bullmq";
import { redis } from "../queues";
import { prisma } from "../lib/prisma";
import { connectSSH, execSSH } from "../lib/ssh";

export const suspendWorker = new Worker(
  "lifecycle",
  async (job) => {
    if (job.name !== "suspend") return;

    const { instanceId } = job.data;

    console.log(`[suspend:${job.id}] Suspending instance ${instanceId}`);

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId },
      });

      if (!instance || !instance.ipAddress) {
        console.log(`[suspend:${job.id}] Instance not found or not provisioned, skipping`);
        return;
      }

      const ssh = await connectSSH(instance.tailscaleIp || instance.ipAddress);

      try {
        // Stop the OpenClaw gateway container
        await execSSH(ssh, "docker compose stop openclaw-gateway", "/opt/openclaw");
        console.log(`[suspend:${job.id}] Gateway stopped`);
      } finally {
        ssh.dispose();
      }

      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          status: "suspended",
          suspendedAt: new Date(),
        },
      });

      console.log(`[suspend:${job.id}] Instance suspended successfully`);
    } catch (error) {
      console.error(`[suspend:${job.id}] Failed:`, error);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 2,
  }
);

suspendWorker.on("failed", (job, err) => {
  console.error(`Suspend job ${job?.id} failed:`, err.message);
});
