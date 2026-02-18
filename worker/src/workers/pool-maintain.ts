import { Worker } from "bullmq";
import { redis, poolQueue } from "../queues";
import { prisma } from "../lib/prisma";
import { deleteDroplet } from "../lib/digitalocean";
import { removeTailscaleDevice, getTailscaleDeviceByHostname } from "../lib/tailscale";
import { computePoolTarget, checkAndRecordPoolEmpty } from "../lib/pool-target";

export const poolMaintainWorker = new Worker(
  "pool",
  async (job) => {
    if (job.name !== "pool-maintain") return;

    const log = (msg: string) => console.log(`[pool-maintain:${job.id}] ${msg}`);

    log("Running pool maintenance...");

    // 1. Count ready + creating droplets
    const [readyCount, creatingCount] = await Promise.all([
      prisma.poolDroplet.count({ where: { status: "ready" } }),
      prisma.poolDroplet.count({ where: { status: "creating" } }),
    ]);

    // Track pool-empty events for surge detection
    await checkAndRecordPoolEmpty(redis, readyCount);

    // Compute dynamic pool target
    const { target: POOL_TARGET_SIZE, debug } = await computePoolTarget(prisma, redis);

    const available = readyCount + creatingCount;
    log(`Pool status: ${readyCount} ready, ${creatingCount} creating, target ${POOL_TARGET_SIZE} (${debug.mode} mode, hour=${debug.hour}, lookahead=${debug.lookaheadHour}, ${debug.dayType}, demand=${debug.expectedDemand.toFixed(1)}, surge=${debug.surgeActive}${debug.decayCapped ? ", decay-capped" : ""})`);

    // 2. Create new pool droplets if below target
    if (available < POOL_TARGET_SIZE) {
      const deficit = POOL_TARGET_SIZE - available;
      log(`Creating ${deficit} new pool droplet(s)...`);

      for (let i = 0; i < deficit; i++) {
        const poolDroplet = await prisma.poolDroplet.create({
          data: { status: "creating" },
        });

        await poolQueue.add("pool-create", { poolDropletId: poolDroplet.id }, {
          jobId: `pool-create-${poolDroplet.id}`,
        });

        log(`Enqueued pool-create for ${poolDroplet.id}`);
      }
    }

    // 3. Clean up failed droplets older than 30 minutes
    const failedCutoff = new Date(Date.now() - 30 * 60 * 1000);
    const failedDroplets = await prisma.poolDroplet.findMany({
      where: { status: "failed", createdAt: { lt: failedCutoff } },
    });

    for (const pd of failedDroplets) {
      log(`Cleaning up failed pool droplet ${pd.id}...`);
      try {
        if (pd.dropletId) {
          await deleteDroplet(parseInt(pd.dropletId));
          log(`Deleted DO droplet ${pd.dropletId}`);
        }
      } catch (err) {
        log(`Failed to delete DO droplet ${pd.dropletId}: ${err instanceof Error ? err.message : err}`);
      }

      try {
        if (pd.tailscaleDeviceId) {
          await removeTailscaleDevice(pd.tailscaleDeviceId);
          log(`Removed Tailscale device ${pd.tailscaleDeviceId}`);
        }
      } catch (err) {
        log(`Failed to remove Tailscale device: ${err instanceof Error ? err.message : err}`);
      }

      await prisma.poolDroplet.delete({ where: { id: pd.id } });
      log(`Deleted pool droplet record ${pd.id}`);
    }

    // 4. Clean up allocated rows older than 1 hour (droplet now owned by Instance)
    const allocatedCutoff = new Date(Date.now() - 60 * 60 * 1000);
    const oldAllocated = await prisma.poolDroplet.deleteMany({
      where: { status: "allocated", allocatedAt: { lt: allocatedCutoff } },
    });
    if (oldAllocated.count > 0) {
      log(`Cleaned up ${oldAllocated.count} old allocated record(s)`);
    }

    // 5. Mark stuck creating droplets as failed (>20 min)
    const stuckCutoff = new Date(Date.now() - 20 * 60 * 1000);
    const stuckResult = await prisma.poolDroplet.updateMany({
      where: { status: "creating", createdAt: { lt: stuckCutoff } },
      data: { status: "failed" },
    });
    if (stuckResult.count > 0) {
      log(`Marked ${stuckResult.count} stuck creating droplet(s) as failed`);
    }

    // 6. Health-check ready droplets via Tailscale connectedToControl
    const readyDroplets = await prisma.poolDroplet.findMany({
      where: { status: "ready" },
    });

    for (const pd of readyDroplets) {
      if (!pd.tailscaleHostname) continue;

      try {
        const device = await getTailscaleDeviceByHostname(pd.tailscaleHostname);
        if (!device || !device.connectedToControl) {
          log(`Pool droplet ${pd.id} (${pd.tailscaleHostname}) disconnected from Tailscale, marking failed`);
          await prisma.poolDroplet.update({
            where: { id: pd.id },
            data: { status: "failed" },
          });
        }
      } catch (err) {
        log(`Error checking Tailscale status for ${pd.id}: ${err instanceof Error ? err.message : err}`);
      }
    }

    log("Pool maintenance complete");
  },
  {
    connection: redis,
    concurrency: 1,
  }
);

poolMaintainWorker.on("failed", (job, err) => {
  console.error(`Pool-maintain job ${job?.id} failed:`, err.message);
});

/**
 * Schedule pool maintenance to run every 10 minutes as a repeatable job.
 */
export async function schedulePoolMaintenance() {
  await poolQueue.add(
    "pool-maintain",
    {},
    {
      repeat: { every: 10 * 60 * 1000 },
      jobId: "pool-maintain-repeatable",
    }
  );
  console.log("Pool maintenance scheduled (every 10 minutes)");
}
