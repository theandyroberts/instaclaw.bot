import { Worker } from "bullmq";
import { redis } from "../queues";
import { prisma } from "../lib/prisma";
import { deleteDroplet, createSnapshot } from "../lib/digitalocean";
import { deleteAPIKey } from "../lib/openrouter";

export const terminateWorker = new Worker(
  "lifecycle",
  async (job) => {
    if (job.name !== "terminate") return;

    const { instanceId } = job.data;

    console.log(`[terminate:${job.id}] Terminating instance ${instanceId}`);

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId },
      });

      if (!instance) {
        console.log(`[terminate:${job.id}] Instance not found, skipping`);
        return;
      }

      // Take snapshot before deleting (for potential recovery)
      if (instance.dropletId) {
        try {
          const snapshotName = `instaclaw-backup-${instanceId.slice(0, 8)}-${Date.now()}`;
          console.log(`[terminate:${job.id}] Creating snapshot: ${snapshotName}`);
          await createSnapshot(parseInt(instance.dropletId), snapshotName);
          // Wait for snapshot to start
          await new Promise((resolve) => setTimeout(resolve, 10000));
        } catch (err) {
          console.error(`[terminate:${job.id}] Snapshot failed (continuing with deletion):`, err);
        }

        // Delete droplet
        console.log(`[terminate:${job.id}] Deleting droplet ${instance.dropletId}`);
        try {
          await deleteDroplet(parseInt(instance.dropletId));
        } catch (err) {
          console.error(`[terminate:${job.id}] Droplet deletion failed:`, err);
        }
      }

      // Delete OpenRouter API key if exists
      if (instance.openrouterKeyId) {
        try {
          await deleteAPIKey(instance.openrouterKeyId);
          console.log(`[terminate:${job.id}] OpenRouter key deleted`);
        } catch (err) {
          console.error(`[terminate:${job.id}] OpenRouter key deletion failed:`, err);
        }
      }

      // Update instance
      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          status: "terminated",
          dropletId: null,
          ipAddress: null,
        },
      });

      console.log(`[terminate:${job.id}] Instance terminated successfully`);
    } catch (error) {
      console.error(`[terminate:${job.id}] Failed:`, error);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 1,
  }
);

terminateWorker.on("failed", (job, err) => {
  console.error(`Terminate job ${job?.id} failed:`, err.message);
});
