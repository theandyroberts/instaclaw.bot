import { Worker } from "bullmq";
import { redis, healthQueue } from "../queues";
import { prisma } from "../lib/prisma";
import { connectSSH, execSSH } from "../lib/ssh";
import { getDroplet, getDropletPublicIP } from "../lib/digitalocean";

// Schedule repeating health checks
async function scheduleHealthChecks() {
  // Remove existing repeatable job
  const repeatableJobs = await healthQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await healthQueue.removeRepeatableByKey(job.key);
  }

  // Add new repeating job (every 5 minutes)
  await healthQueue.add(
    "health-check",
    {},
    {
      repeat: { every: 5 * 60 * 1000 },
    }
  );

  console.log("Health check scheduled (every 5 minutes)");
}

export const healthCheckWorker = new Worker(
  "health",
  async (job) => {
    console.log(`[health-check:${job.id}] Running health checks...`);

    const instances = await prisma.instance.findMany({
      where: {
        status: "active",
        ipAddress: { not: null },
      },
    });

    console.log(`[health-check:${job.id}] Checking ${instances.length} active instances`);

    for (const instance of instances) {
      if (!instance.ipAddress) continue;

      try {
        const ssh = await connectSSH(instance.ipAddress);

        try {
          // Check if gateway container is running
          const result = await execSSH(
            ssh,
            'docker compose ps openclaw-gateway --format "{{.State}}"',
            "/opt/openclaw"
          );

          const isRunning = result.trim().includes("running");

          if (isRunning) {
            await prisma.instance.update({
              where: { id: instance.id },
              data: {
                healthStatus: "healthy",
                lastHealthCheck: new Date(),
              },
            });
          } else {
            console.log(
              `[health-check:${job.id}] Instance ${instance.id} unhealthy, attempting restart...`
            );

            // Auto-restart
            await execSSH(
              ssh,
              "docker compose up -d openclaw-gateway",
              "/opt/openclaw"
            );

            await prisma.instance.update({
              where: { id: instance.id },
              data: {
                healthStatus: "unhealthy",
                lastHealthCheck: new Date(),
              },
            });
          }
        } finally {
          ssh.dispose();
        }
      } catch (error) {
        console.error(
          `[health-check:${job.id}] Instance ${instance.id} unreachable:`,
          error
        );

        await prisma.instance.update({
          where: { id: instance.id },
          data: {
            healthStatus: "unreachable",
            lastHealthCheck: new Date(),
          },
        });
      }
    }

    // --- STUCK INSTANCE WATCHDOG ---
    // Find instances stuck in provisioning/failed for > 15 minutes
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const stuckInstances = await prisma.instance.findMany({
      where: {
        status: { in: ["provisioning", "failed"] },
        updatedAt: { lt: fifteenMinAgo },
        dropletId: { not: null },
      },
    });

    if (stuckInstances.length > 0) {
      console.log(`[health-check:${job.id}] Found ${stuckInstances.length} stuck instance(s)`);
    }

    for (const stuck of stuckInstances) {
      try {
        // Verify droplet exists in DO
        const droplet = await getDroplet(parseInt(stuck.dropletId!));
        if (droplet.status !== "active") {
          console.log(`[health-check:${job.id}] Stuck instance ${stuck.id}: droplet ${stuck.dropletId} is ${droplet.status}, skipping`);
          continue;
        }

        const ip = stuck.ipAddress || getDropletPublicIP(droplet);

        // SSH in and check if Docker + container are running
        const ssh = await connectSSH(ip);
        try {
          const containerState = await execSSH(
            ssh,
            'docker compose ps openclaw-gateway --format "{{.State}}" 2>/dev/null || echo "none"',
            "/opt/openclaw"
          );
          const isRunning = containerState.trim().includes("running");

          if (isRunning) {
            // Droplet and container are fine -- heal the DB state
            const healedStep = stuck.telegramBotToken ? "complete" : "awaiting_telegram_token";
            console.log(`[health-check:${job.id}] Healing stuck instance ${stuck.id}: container running, setting step to ${healedStep}`);
            await prisma.instance.update({
              where: { id: stuck.id },
              data: {
                status: "active",
                ipAddress: ip,
                onboardingStep: healedStep,
                llmConfigured: true,
                healthStatus: "healthy",
                lastHealthCheck: new Date(),
              },
            });
          } else {
            // Container not running -- try starting it
            console.log(`[health-check:${job.id}] Stuck instance ${stuck.id}: container not running, attempting start`);
            await execSSH(ssh, "docker compose up -d", "/opt/openclaw");
            await prisma.instance.update({
              where: { id: stuck.id },
              data: {
                status: "active",
                ipAddress: ip,
                onboardingStep: stuck.telegramBotToken ? "complete" : "awaiting_telegram_token",
                healthStatus: "unhealthy",
                lastHealthCheck: new Date(),
              },
            });
          }
        } finally {
          ssh.dispose();
        }
      } catch (error) {
        console.error(`[health-check:${job.id}] Could not heal stuck instance ${stuck.id}:`, error);
      }
    }

    console.log(`[health-check:${job.id}] Health checks complete`);
  },
  {
    connection: redis,
    concurrency: 1,
  }
);

healthCheckWorker.on("failed", (job, err) => {
  console.error(`Health check job ${job?.id} failed:`, err.message);
});

export { scheduleHealthChecks };
