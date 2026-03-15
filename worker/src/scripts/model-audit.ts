/**
 * Manual model audit — run ad-hoc to check OpenRouter model landscape.
 * Writes HTML report and prints URL.
 *
 * Usage: cd /opt/instaclaw/worker && npx tsx -r dotenv/config src/scripts/model-audit.ts
 */
import { runModelAudit, formatPlainText, writeReportPage } from "../workers/model-audit";

async function main() {
  const result = await runModelAudit();
  console.log(formatPlainText(result));

  const slug = writeReportPage(result);
  console.log(`\nReport: https://worker.instaclaw.bot/reports/${slug}`);
}

main().catch((err) => {
  console.error("Model audit failed:", err);
  process.exit(1);
});
