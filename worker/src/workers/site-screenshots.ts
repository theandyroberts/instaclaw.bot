import { Worker, Queue } from "bullmq";
import { redis } from "../queues";
import { prisma } from "../lib/prisma";
import { connectSSH, execSSH } from "../lib/ssh";

// Capture screenshots of canvas sites using Chromium inside the OpenClaw container.
// Runs every 6 hours. Screenshots are stored as .screenshot.jpg inside each site's
// canvas directory, served by the gateway at /__openclaw__/canvas/<site>/.screenshot.jpg

const SCREENSHOT_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

const screenshotQueue = new Queue("site-screenshots", { connection: redis });

export async function scheduleScreenshots() {
  const repeatableJobs = await screenshotQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await screenshotQueue.removeRepeatableByKey(job.key);
  }

  await screenshotQueue.add("site-screenshots", {}, {
    repeat: { every: SCREENSHOT_INTERVAL },
  });
  console.log("Site screenshot job scheduled (every 6 hours)");
}

export const siteScreenshotWorker = new Worker(
  "site-screenshots",
  async (job) => {

    console.log(`[site-screenshots:${job.id}] Starting screenshot capture...`);

    const instances = await prisma.instance.findMany({
      where: { status: "active", instanceName: { not: null } },
      select: { id: true, instanceName: true, tailscaleIp: true, gatewayToken: true },
    });

    for (const instance of instances) {
      if (!instance.tailscaleIp || !instance.gatewayToken || !instance.instanceName) continue;

      let ssh;
      try {
        ssh = await connectSSH(instance.tailscaleIp);
      } catch {
        continue;
      }

      try {
        // List sites
        const output = await execSSH(
          ssh,
          "ls /opt/openclaw/home/.openclaw/canvas/ 2>/dev/null || true"
        );
        const sites = output.split("\n").map(s => s.trim()).filter(s => s && s !== ".trash");

        for (const site of sites) {
          try {
            // Use Chromium inside the container to capture a screenshot
            // The gateway serves canvas at localhost:18789/__openclaw__/canvas/<site>/
            await execSSH(
              ssh,
              `docker exec openclaw-openclaw-gateway-1 sh -c '` +
              `chromium --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage ` +
              `--window-size=1280,720 --screenshot=/tmp/screenshot.jpg ` +
              `--hide-scrollbars ` +
              `"http://127.0.0.1:18789/__openclaw__/canvas/${site}/" 2>/dev/null && ` +
              `cp /tmp/screenshot.jpg /home/node/.openclaw/canvas/${site}/.screenshot.jpg && ` +
              `rm /tmp/screenshot.jpg' 2>/dev/null`,
              "/opt/openclaw"
            );
          } catch {
            // Non-blocking — skip this site
          }
        }

        console.log(`[site-screenshots:${job.id}] Captured ${sites.length} screenshots for ${instance.instanceName}`);
      } catch (err) {
        console.error(`[site-screenshots:${job.id}] Failed for ${instance.instanceName}:`, err);
      } finally {
        ssh.dispose();
      }
    }

    console.log(`[site-screenshots:${job.id}] Screenshot capture complete`);
  },
  {
    connection: redis,
    concurrency: 1,
  }
);

siteScreenshotWorker.on("failed", (job, err) => {
  console.error(`Site screenshot job ${job?.id} failed:`, err.message);
});
