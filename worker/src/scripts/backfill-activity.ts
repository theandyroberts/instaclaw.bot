import { prisma } from "../lib/prisma";
import { getActivity } from "../lib/openrouter";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(dateStr: string, retries = 3): Promise<Awaited<ReturnType<typeof getActivity>>> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await getActivity(dateStr);
    } catch (err: any) {
      if (err.message?.includes("429") && attempt < retries) {
        const backoff = attempt * 5000;
        console.log(`  Rate limited, waiting ${backoff / 1000}s...`);
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }
  return [];
}

async function backfill() {
  const DAYS = 30;
  console.log(`Backfilling ${DAYS} days of activity data...`);

  for (let i = DAYS; i >= 1; i--) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    try {
      const items = await fetchWithRetry(dateStr);
      let upserted = 0;

      for (const item of items) {
        // Normalize date: API may return "2026-02-09 00:00:00", we want "2026-02-09"
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

      console.log(`  ${dateStr}: ${upserted} records`);
    } catch (error) {
      console.error(`  ${dateStr}: FAILED`, error);
    }

    // Rate limit: 2s between API calls
    await sleep(2000);
  }

  console.log("Backfill complete.");
  await prisma.$disconnect();
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
