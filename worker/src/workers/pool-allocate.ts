import { Worker } from "bullmq";
import { redis, provisionQueue, poolQueue } from "../queues";
import { prisma } from "../lib/prisma";
import { connectSSH, execSSH, writeFileSSH } from "../lib/ssh";
import {
  generateSOUL,
  generateUSER,
  generateAGENTS,
  generateMEMORY,
} from "../lib/workspace-templates";

interface LogEntry {
  step: string;
  message: string;
  ts: string;
}

interface BotConfig {
  botName: string;
  personality: string;
  customPersonality?: string;
  userName: string;
  userDescription?: string;
  useCases: string[];
  extraContext?: string;
}

const CONFIG_PATH = "/opt/openclaw/home/.openclaw/openclaw.json";
const WORKSPACE_DIR = "/opt/openclaw/home/.openclaw/workspace";

async function appendLog(instanceId: string, step: string, message: string) {
  const entry: LogEntry = { step, message, ts: new Date().toISOString() };
  const instance = await prisma.instance.findUnique({
    where: { id: instanceId },
    select: { provisionLog: true },
  });
  const log = (instance?.provisionLog as LogEntry[] | null) || [];
  log.push(entry);
  await prisma.instance.update({
    where: { id: instanceId },
    data: { provisionLog: log },
  });
}

async function appendLogs(instanceId: string, entries: Array<{ step: string; message: string }>) {
  const instance = await prisma.instance.findUnique({
    where: { id: instanceId },
    select: { provisionLog: true },
  });
  const log = (instance?.provisionLog as LogEntry[] | null) || [];
  const now = new Date().toISOString();
  for (const e of entries) {
    log.push({ step: e.step, message: e.message, ts: now });
  }
  await prisma.instance.update({
    where: { id: instanceId },
    data: { provisionLog: log },
  });
}

export const poolAllocateWorker = new Worker(
  "pool",
  async (job) => {
    if (job.name !== "pool-allocate") return;

    const { instanceId, userId } = job.data as { instanceId: string; userId: string };
    const log = (msg: string) => console.log(`[pool-allocate:${job.id}] ${msg}`);

    log(`Allocating pool droplet for instance ${instanceId}`);

    try {
      // 1. Update instance status
      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          status: "provisioning",
          onboardingStep: "provisioning",
          provisionLog: [],
        },
      });

      // 2. Atomic claim: grab a ready pool droplet
      const poolDroplet = await prisma.$transaction(async (tx: typeof prisma) => {
        const candidate = await tx.poolDroplet.findFirst({
          where: { status: "ready" },
          orderBy: { createdAt: "asc" },
        });
        if (!candidate) return null;
        return tx.poolDroplet.update({
          where: { id: candidate.id },
          data: {
            status: "allocating",
            allocatedTo: instanceId,
            allocatedAt: new Date(),
          },
        });
      });

      // 3. If pool empty, fallback to standard provision
      if (!poolDroplet) {
        log("Pool empty -- falling back to standard provision");
        await appendLog(instanceId, "started", "Provisioning started -- creating your server");
        await provisionQueue.add("provision", { instanceId, userId });
        return;
      }

      log(`Claimed pool droplet ${poolDroplet.id} (${poolDroplet.tailscaleIp})`);

      // 4. Rapidly emit log entries for pre-completed infrastructure steps
      await appendLogs(instanceId, [
        { step: "started", message: "Allocating your server" },
        { step: "droplet_created", message: "Server reserved" },
        { step: "droplet_active", message: "Server online" },
        { step: "cloud_init", message: "System ready" },
        { step: "docker_ready", message: "Docker ready" },
        { step: "pulling_images", message: "System image ready" },
      ]);

      // 5. Fetch bot config + subscription
      const instanceRecord = await prisma.instance.findUnique({
        where: { id: instanceId },
        include: { user: { select: { id: true, botConfig: true } } },
      });
      const botConfig = instanceRecord?.user?.botConfig as BotConfig | null;

      const subscription = await prisma.subscription.findUnique({
        where: { userId },
      });
      const plan = subscription?.plan || "starter";

      // 6. SSH to pool droplet via Tailscale IP
      log(`Connecting to pool droplet at ${poolDroplet.tailscaleIp}...`);
      const ssh = await connectSSH(poolDroplet.tailscaleIp!);

      try {
        // 7. Write customer-specific config
        await appendLog(instanceId, "workspace_setup", "Personalizing your bot");

        const model = plan === "pro" ? "openrouter/anthropic/claude-sonnet-4.5" : "moonshot/kimi-k2.5";
        const fallbackModel = "openrouter/meta-llama/llama-3.3-70b-instruct:free";

        const openclawConfig = {
          commands: { native: "auto", nativeSkills: "auto" },
          agents: {
            defaults: {
              model: { primary: model, fallbacks: [fallbackModel] },
              workspace: "~/.openclaw/workspace",
              maxConcurrent: 4,
              subagents: { maxConcurrent: 8 },
            },
          },
          gateway: {
            trustedProxies: ["127.0.0.1", "::1"],
            controlUi: { allowedOrigins: ["*"] },
          },
          messages: { ackReactionScope: "group-mentions" },
          plugins: { entries: { telegram: { enabled: true } } },
          cron: { enabled: true },
          skills: { entries: { "nano-banana-pro": { enabled: true } } },
        };

        await writeFileSSH(ssh, CONFIG_PATH, JSON.stringify(openclawConfig, null, 2));

        // Write workspace files
        if (botConfig) {
          await execSSH(ssh, `mkdir -p ${WORKSPACE_DIR}`, "/");
          await writeFileSSH(ssh, `${WORKSPACE_DIR}/SOUL.md`, generateSOUL(botConfig));
          await writeFileSSH(ssh, `${WORKSPACE_DIR}/USER.md`, generateUSER(botConfig));
          await writeFileSSH(ssh, `${WORKSPACE_DIR}/AGENTS.md`, generateAGENTS(botConfig, plan));
          await writeFileSSH(ssh, `${WORKSPACE_DIR}/MEMORY.md`, generateMEMORY(botConfig));
        }

        log("Workspace configured");

        // 8. Start container
        await appendLog(instanceId, "container_started", "Starting your bot");
        await execSSH(ssh, "docker compose up -d", "/opt/openclaw");

        // Verify container running
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const containerStatus = await execSSH(
          ssh,
          'docker compose ps openclaw-gateway --format "{{.State}}"',
          "/opt/openclaw"
        );
        log(`Container status: ${containerStatus.trim()}`);

        await appendLog(instanceId, "base_complete", "Setup complete -- ready for Telegram");
        log("Allocation complete");
      } finally {
        ssh.dispose();
      }

      // 9. Copy infra fields from PoolDroplet to Instance
      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          dropletId: poolDroplet.dropletId,
          ipAddress: poolDroplet.ipAddress,
          tailscaleIp: poolDroplet.tailscaleIp,
          tailscaleDeviceId: poolDroplet.tailscaleDeviceId,
          gatewayToken: poolDroplet.gatewayToken,
          status: "active",
          onboardingStep: "awaiting_telegram_token",
          llmProvider: plan === "pro" ? "claude" : "kimi",
          llmConfigured: true,
          provisionedAt: new Date(),
        },
      });

      // 10. Mark pool droplet as allocated
      await prisma.poolDroplet.update({
        where: { id: poolDroplet.id },
        data: { status: "allocated" },
      });

      // 11. Trigger pool replenishment
      await poolQueue.add("pool-maintain", {}, {
        jobId: `pool-maintain-after-allocate-${Date.now()}`,
      });

      log(`Instance ${instanceId} provisioned via pool in fast path`);
    } catch (error) {
      console.error(`[pool-allocate:${job.id}] Failed:`, error);

      // Try to mark pool droplet as failed if we claimed one
      try {
        const claimed = await prisma.poolDroplet.findFirst({
          where: { allocatedTo: instanceId, status: "allocating" },
        });
        if (claimed) {
          await prisma.poolDroplet.update({
            where: { id: claimed.id },
            data: { status: "failed" },
          });
        }
      } catch {
        // Best effort
      }

      // Reset instance and fallback to standard provision
      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          status: "pending",
          onboardingStep: "awaiting_provision",
          provisionLog: [],
        },
      });

      log("Falling back to standard provision after allocation failure");
      await provisionQueue.add("provision", { instanceId, userId });
    }
  },
  {
    connection: redis,
    concurrency: 1,
  }
);

poolAllocateWorker.on("failed", (job, err) => {
  console.error(`Pool-allocate job ${job?.id} failed:`, err.message);
});

poolAllocateWorker.on("completed", (job) => {
  console.log(`Pool-allocate job ${job.id} completed`);
});
