import { Worker } from "bullmq";
import { redis, healthQueue } from "../queues";
import { prisma } from "../lib/prisma";
import { connectSSH, execSSH, writeFileSSH } from "../lib/ssh";
import { getDroplet, getDropletPublicIP } from "../lib/digitalocean";

const CONFIG_PATH = "/opt/openclaw/home/.openclaw/openclaw.json";

// --- Telegram DM lockdown ---
// After first message, lock dmPolicy to allowlist with user's chat ID

async function lockdownTelegramDM(
  ssh: Awaited<ReturnType<typeof connectSSH>>,
  instance: { id: string; telegramChatId: string | null; telegramBotToken: string | null },
  jobId: string
): Promise<void> {
  if (instance.telegramChatId || !instance.telegramBotToken) return; // Already locked or no bot

  // Find the user's chat ID from gateway logs
  let chatId: string | null = null;
  try {
    const sendLogs = await execSSH(
      ssh,
      `docker compose logs --tail=500 2>&1 | grep "sendMessage ok chat=" | tail -1`,
      "/opt/openclaw"
    );
    const match = sendLogs.match(/chat=(\d+)/);
    if (match) chatId = match[1];
  } catch {
    return;
  }

  if (!chatId) return; // User hasn't messaged yet

  // Store chat ID in database
  await prisma.instance.update({
    where: { id: instance.id },
    data: { telegramChatId: chatId },
  });

  // Rewrite openclaw.json to lock dmPolicy to allowlist
  try {
    const configRaw = await execSSH(ssh, `cat ${CONFIG_PATH}`, "/opt/openclaw");
    const config = JSON.parse(configRaw);

    if (config.channels?.telegram) {
      config.channels.telegram.dmPolicy = "allowlist";
      config.channels.telegram.allowFrom = [chatId];
      delete config.channels.telegram.groupPolicy; // clean up any stray fields
      await writeFileSSH(ssh, CONFIG_PATH, JSON.stringify(config, null, 2));

      // Restart gateway to pick up the new config
      await execSSH(ssh, "docker compose restart", "/opt/openclaw");
      console.log(
        `[health-check:${jobId}] Locked Telegram DM to chat=${chatId} on ${instance.id.slice(0, 8)}`
      );
    }
  } catch (err) {
    console.error(`[health-check:${jobId}] Failed to lock DM on ${instance.id.slice(0, 8)}:`, err);
  }
}

// --- Telegram liveness check ---

async function checkTelegramHealth(
  ssh: Awaited<ReturnType<typeof connectSSH>>,
  instance: { id: string; telegramBotToken: string | null },
  jobId: string
): Promise<void> {
  if (!instance.telegramBotToken) return;

  // Check the gateway log for Telegram errors in the last hour
  const today = new Date().toISOString().slice(0, 10);
  const logFile = `/tmp/openclaw/openclaw-${today}.log`;

  let recentErrors: string;
  try {
    // Look for Telegram-breaking errors: config errors, channel failures
    recentErrors = await execSSH(
      ssh,
      `docker exec openclaw-openclaw-gateway-1 sh -c 'tail -500 ${logFile} 2>/dev/null | grep -c "invalid.*config\\|channel.*error\\|telegram.*fatal\\|telegram.*crash" || echo 0'`,
      "/opt/openclaw"
    );
  } catch {
    return;
  }

  // Also check: is the bot responding to the Telegram API at all?
  // Call getWebhookInfo — if the bot token is valid, this always works
  // Then check docker logs: are there "Something went wrong" patterns?
  let dockerLogs: string;
  try {
    dockerLogs = await execSSH(
      ssh,
      `docker compose logs --since 10m 2>&1 | tail -50`,
      "/opt/openclaw"
    );
  } catch {
    return;
  }

  // Detect pattern: gateway is receiving messages but every response fails
  // Look for multiple "Something went wrong" or repeated error patterns with no successful sends
  const hasIncoming = dockerLogs.includes("[telegram]") || dockerLogs.includes("[ws]");
  const hasSendOk = dockerLogs.includes("sendMessage ok");
  const errorLines = (dockerLogs.match(/closed before connect|handshake timeout|pairing required/g) || []).length;

  // If the gateway has recent activity but lots of connection errors and no successful sends,
  // Telegram is likely broken
  if (hasIncoming && !hasSendOk && errorLines >= 3) {
    const redisKey = `instaclaw:telegram-restart:${instance.id}`;
    const recentlyRestarted = await redis.get(redisKey);
    if (recentlyRestarted) return; // Don't restart more than once per 30 min

    console.log(
      `[health-check:${jobId}] Telegram appears broken on ${instance.id.slice(0, 8)} ` +
      `(${errorLines} errors, no successful sends in 10m). Restarting gateway...`
    );

    try {
      await execSSH(ssh, "docker compose restart", "/opt/openclaw");
      await redis.set(redisKey, "1", "EX", 30 * 60); // 30 min cooldown

      await prisma.instance.update({
        where: { id: instance.id },
        data: { healthStatus: "unhealthy", lastHealthCheck: new Date() },
      });

      // Notify user their bot was auto-recovered
      let chatId: string | null = null;
      try {
        const sendLogs = await execSSH(
          ssh,
          `docker compose logs --tail=500 2>&1 | grep "sendMessage ok chat=" | tail -1`,
          "/opt/openclaw"
        );
        const match = sendLogs.match(/chat=(\d+)/);
        if (match) chatId = match[1];
      } catch { /* */ }

      if (chatId) {
        // Wait for gateway to come back up before sending
        await new Promise(r => setTimeout(r, 90_000));
        try {
          await fetch(`https://api.telegram.org/bot${instance.telegramBotToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: "I had a brief hiccup but I'm back online now. Sorry about that!",
            }),
          });
          console.log(`[health-check:${jobId}] Sent recovery notice to ${instance.id.slice(0, 8)}`);
        } catch { /* best effort */ }
      }
    } catch (err) {
      console.error(`[health-check:${jobId}] Failed to restart gateway on ${instance.id.slice(0, 8)}:`, err);
    }
    return;
  }
}

// --- Cron failure detection helpers ---

async function checkCronFailures(
  ssh: Awaited<ReturnType<typeof connectSSH>>,
  instance: { id: string; telegramBotToken: string | null },
  jobId: string
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const logFile = `/tmp/openclaw/openclaw-${today}.log`;

  // Check for cron tick failures in today's log
  let logOutput: string;
  try {
    logOutput = await execSSH(
      ssh,
      `docker exec openclaw-openclaw-gateway-1 grep "timer tick failed" ${logFile} 2>/dev/null || true`,
      "/opt/openclaw"
    );
  } catch {
    return; // Can't read log, skip
  }

  if (!logOutput.trim()) return; // No failures

  // Deduplicate: only alert once per instance per day
  const redisKey = `instaclaw:cron-fail-alert:${instance.id}:${today}`;
  const alreadyAlerted = await redis.get(redisKey);
  if (alreadyAlerted) return;

  console.log(`[health-check:${jobId}] Cron failure detected on instance ${instance.id.slice(0, 8)}`);

  if (!instance.telegramBotToken) {
    console.log(`[health-check:${jobId}] No bot token for ${instance.id.slice(0, 8)}, cannot notify user`);
    await redis.set(redisKey, "1", "EX", 24 * 60 * 60);
    return;
  }

  // Get the user's chat ID from recent Telegram send logs
  let chatId: string | null = null;
  try {
    const sendLogs = await execSSH(
      ssh,
      `docker compose logs --tail=200 2>&1 | grep "sendMessage ok chat=" | tail -1`,
      "/opt/openclaw"
    );
    const match = sendLogs.match(/chat=(\d+)/);
    if (match) chatId = match[1];
  } catch {
    // Fall through
  }

  if (!chatId) {
    console.log(`[health-check:${jobId}] No chat ID found for ${instance.id.slice(0, 8)}, cannot notify user`);
    await redis.set(redisKey, "1", "EX", 24 * 60 * 60);
    return;
  }

  // Send notification directly via Telegram Bot API
  try {
    const message = "⚠️ One or more of your scheduled tasks failed to run today. We've been notified and are looking into it. Sorry about that!";
    await fetch(`https://api.telegram.org/bot${instance.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
    console.log(`[health-check:${jobId}] Sent cron failure alert to ${instance.id.slice(0, 8)} chat=${chatId}`);
  } catch (err) {
    console.error(`[health-check:${jobId}] Failed to send cron alert:`, err);
  }

  await redis.set(redisKey, "1", "EX", 24 * 60 * 60);
}

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
      select: {
        id: true,
        ipAddress: true,
        tailscaleIp: true,
        dropletId: true,
        telegramBotToken: true,
        telegramChatId: true,
        healthStatus: true,
      },
    });

    console.log(`[health-check:${job.id}] Checking ${instances.length} active instances`);

    for (const instance of instances) {
      if (!instance.ipAddress) continue;

      try {
        const ssh = await connectSSH(instance.tailscaleIp || instance.ipAddress);

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

            // Check for cron failures while we have the SSH connection
            await checkCronFailures(ssh, instance, job.id!);

            // Check if Telegram channel is broken (gateway up but Telegram not working)
            await checkTelegramHealth(ssh, instance, job.id!);

            // Lock down Telegram DM to user's chat ID once we know it
            await lockdownTelegramDM(ssh, instance, job.id!);
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

        const ip = stuck.tailscaleIp || stuck.ipAddress || getDropletPublicIP(droplet);

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
