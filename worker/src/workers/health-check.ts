import { Worker } from "bullmq";
import { redis, healthQueue } from "../queues";
import { prisma } from "../lib/prisma";
import { connectSSH, execSSH } from "../lib/ssh";

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
