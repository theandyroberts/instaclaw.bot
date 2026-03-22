import { Worker } from "bullmq";
import { redis, usageQueue } from "../queues";
import { prisma } from "../lib/prisma";
import { getKeyUsage, getActivity, PLAN_BUDGETS } from "../lib/openrouter";
import { connectSSH, execSSH } from "../lib/ssh";

// --- Hourly: collect per-instance usage snapshots ---
export const usageCollectWorker = new Worker(
  "usage",
  async (job) => {
    const jobType = job.data?.type;

    if (jobType === "daily-activity") {
      await collectDailyActivity(job.id ?? "unknown");
    } else {
      await collectInstanceUsage(job.id ?? "unknown");
    }
  },
  {
    connection: redis,
    concurrency: 1,
  }
);

async function collectInstanceUsage(jobId: string) {
  console.log(`[usage-collect:${jobId}] Collecting instance usage snapshots...`);

  const instances = await prisma.instance.findMany({
    where: {
      status: "active",
      openrouterKeyId: { not: null },
    },
    include: {
      user: {
        select: {
          email: true,
          subscription: { select: { plan: true } },
        },
      },
    },
  });

  console.log(`[usage-collect:${jobId}] Found ${instances.length} active instances with keys`);

  let collected = 0;
  let alerts = 0;

  for (const instance of instances) {
    try {
      const usage = await getKeyUsage(instance.openrouterKeyId!);

      await prisma.llmUsageSnapshot.create({
        data: {
          instanceId: instance.id,
          usageTotal: usage.usage,
          usageMonthly: usage.usage_monthly,
          limit: usage.limit,
          limitRemaining: usage.limit_remaining,
        },
      });

      await prisma.instance.update({
        where: { id: instance.id },
        data: { llmSpendMonthly: usage.usage_monthly },
      });

      // Budget alert check
      const plan = instance.user.subscription?.plan || "starter";
      const budget = PLAN_BUDGETS[plan] || 15;
      const pctUsed = (usage.usage_monthly / budget) * 100;

      if (pctUsed > 90) {
        alerts++;
        console.log(
          `[usage-collect:${jobId}] BUDGET ALERT: ${instance.user.email} at ${pctUsed.toFixed(1)}% ($${usage.usage_monthly.toFixed(2)}/$${budget})`
        );
      }

      // Telegram budget warnings at 80% and 95% thresholds
      await sendBudgetWarning(instance, pctUsed, jobId);

      collected++;
    } catch (error) {
      console.error(
        `[usage-collect:${jobId}] Failed to collect usage for instance ${instance.id}:`,
        error
      );
    }
  }

  console.log(
    `[usage-collect:${jobId}] Collected usage for ${collected} instances (${alerts} budget alerts)`
  );
}

// --- Telegram budget warnings via cron-announce ---
const BUDGET_THRESHOLDS = [
  { pct: 100, key: "100", msg: "You've reached your monthly AI capacity. Your bot may not be able to respond until your capacity resets on your next billing date. Visit your dashboard or reply here to learn about adding more capacity." },
  { pct: 95, key: "95", msg: "You've used 95% of your monthly AI capacity. Your bot may stop responding soon. Visit your dashboard to learn more." },
  { pct: 80, key: "80", msg: "You've used 80% of your monthly AI capacity this month. Visit your dashboard to keep track of your usage." },
];

async function sendBudgetWarning(
  instance: { id: string; tailscaleIp: string | null },
  pctUsed: number,
  jobId: string
) {
  if (!instance.tailscaleIp) return;

  for (const threshold of BUDGET_THRESHOLDS) {
    if (pctUsed < threshold.pct) continue;

    // Check if we already sent this threshold warning this month
    const redisKey = `instaclaw:budget-warn:${instance.id}:${threshold.key}`;
    const alreadySent = await redis.get(redisKey);
    if (alreadySent) continue;

    // Send announcement via cron one-shot
    try {
      const ssh = await connectSSH(instance.tailscaleIp);
      try {
        const now = new Date();
        const announceMin = (now.getUTCMinutes() + 2) % 60;
        const announceHour = now.getUTCMinutes() >= 58
          ? (now.getUTCHours() + 1) % 24
          : now.getUTCHours();
        const cronJob = {
          version: 1,
          jobs: [{
            id: `budget-warn-${threshold.key}-${Date.now()}`,
            description: `Budget ${threshold.key}% warning`,
            schedule: { cron: `${announceMin} ${announceHour} * * *` },
            prompt: threshold.msg,
            sessionTarget: "isolated",
            delivery: { mode: "announce" },
            oneShot: true,
          }],
        };
        await execSSH(
          ssh,
          `cat > /opt/openclaw/home/.openclaw/cron/budget-warn-${threshold.key}.json << 'CRONEOF'\n${JSON.stringify(cronJob, null, 2)}\nCRONEOF`
        );
        // Mark as sent with TTL that covers the rest of the month (max 31 days)
        await redis.set(redisKey, "1", "EX", 31 * 24 * 60 * 60);
        console.log(
          `[usage-collect:${jobId}] Sent ${threshold.key}% budget warning to ${instance.id.slice(0, 8)}`
        );
      } finally {
        ssh.dispose();
      }
    } catch (err) {
      // Non-blocking — warning is best-effort
      console.error(
        `[usage-collect:${jobId}] Failed to send budget warning to ${instance.id.slice(0, 8)}:`,
        err
      );
    }
    break; // Only send the highest applicable threshold
  }
}

// --- Daily: collect platform-level activity ---
async function collectDailyActivity(jobId: string) {
  // Collect yesterday's activity
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dateStr = yesterday.toISOString().split("T")[0];

  console.log(`[usage-collect:${jobId}] Collecting daily activity for ${dateStr}...`);

  try {
    const items = await getActivity(dateStr);
    let upserted = 0;

    for (const item of items) {
      const normalizedDate = (item.date || dateStr).split(" ")[0];

      await prisma.llmActivityLog.upsert({
        where: {
          date_model_providerName: {
            date: normalizedDate,
            model: item.model,
            providerName: item.provider_name,
          },
        },
        create: {
          date: normalizedDate,
          model: item.model,
          providerName: item.provider_name,
          costUsd: item.cost ?? 0,
          requests: item.num_requests ?? 0,
          promptTokens: item.tokens_prompt ?? 0,
          completionTokens: item.tokens_completion ?? 0,
          reasoningTokens: item.tokens_reasoning ?? 0,
        },
        update: {
          costUsd: item.cost ?? 0,
          requests: item.num_requests ?? 0,
          promptTokens: item.tokens_prompt ?? 0,
          completionTokens: item.tokens_completion ?? 0,
          reasoningTokens: item.tokens_reasoning ?? 0,
        },
      });
      upserted++;
    }

    console.log(
      `[usage-collect:${jobId}] Upserted ${upserted} activity records for ${dateStr}`
    );
  } catch (error) {
    console.error(`[usage-collect:${jobId}] Failed to collect daily activity:`, error);
    throw error;
  }
}

usageCollectWorker.on("failed", (job, err) => {
  console.error(`Usage collect job ${job?.id} failed:`, err.message);
});

// Schedule both jobs
export async function scheduleUsageCollection() {
  const repeatableJobs = await usageQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await usageQueue.removeRepeatableByKey(job.key);
  }

  // Hourly instance usage snapshots
  await usageQueue.add(
    "instance-usage",
    { type: "instance-usage" },
    { repeat: { every: 60 * 60 * 1000 } }
  );

  // Daily activity collection at 00:30 UTC
  await usageQueue.add(
    "daily-activity",
    { type: "daily-activity" },
    { repeat: { pattern: "30 0 * * *" } }
  );

  console.log("Usage collection scheduled (hourly snapshots + daily activity at 00:30 UTC)");
}
