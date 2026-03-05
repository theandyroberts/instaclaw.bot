import { prisma } from "../lib/prisma";
import { getActivity } from "../lib/openrouter";

async function backfill() {
  const DAYS = 30;
  console.log(`Backfilling ${DAYS} days of activity data...`);

  for (let i = DAYS; i >= 1; i--) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    try {
      const items = await getActivity(dateStr);
      let upserted = 0;

      for (const item of items) {
        await prisma.llmActivityLog.upsert({
          where: {
            date_model_providerName: {
              date: item.date || dateStr,
              model: item.model,
              providerName: item.provider_name,
            },
          },
          create: {
            date: item.date || dateStr,
            model: item.model,
            providerName: item.provider_name,
            costUsd: item.cost,
            requests: item.num_requests,
            promptTokens: item.tokens_prompt,
            completionTokens: item.tokens_completion,
            reasoningTokens: item.tokens_reasoning || 0,
          },
          update: {
            costUsd: item.cost,
            requests: item.num_requests,
            promptTokens: item.tokens_prompt,
            completionTokens: item.tokens_completion,
            reasoningTokens: item.tokens_reasoning || 0,
          },
        });
        upserted++;
      }

      console.log(`  ${dateStr}: ${upserted} records`);
    } catch (error) {
      console.error(`  ${dateStr}: FAILED`, error);
    }

    // Rate limit: brief pause between API calls
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("Backfill complete.");
  await prisma.$disconnect();
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
