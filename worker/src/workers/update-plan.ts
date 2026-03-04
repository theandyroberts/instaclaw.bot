import { Worker } from "bullmq";
import { redis } from "../queues";
import { prisma } from "../lib/prisma";
import { connectSSH, execSSH, writeFileSSH } from "../lib/ssh";
import { updateAPIKeyLimit, PLAN_BUDGETS } from "../lib/openrouter";
import { PLAN_MODELS } from "../lib/openclaw-config";
import { generateAGENTS } from "../lib/workspace-templates";

const CONFIG_PATH = "/opt/openclaw/home/.openclaw/openclaw.json";
const WORKSPACE_DIR = "/opt/openclaw/home/.openclaw/workspace";

export const updatePlanWorker = new Worker(
  "update-plan",
  async (job) => {

    const { instanceId, newPlan } = job.data as {
      instanceId: string;
      newPlan: string;
    };

    const log = (msg: string) =>
      console.log(`[update-plan:${job.id}] ${msg}`);

    log(`Updating plan to "${newPlan}" for instance ${instanceId}`);

    const instance = await prisma.instance.findUnique({
      where: { id: instanceId },
      include: { user: true },
    });

    if (!instance || !instance.ipAddress) {
      throw new Error("Instance not found or not provisioned");
    }

    // 1. PATCH OpenRouter key limit
    const budget = PLAN_BUDGETS[newPlan];
    if (!budget) {
      throw new Error(`Unknown plan: ${newPlan}`);
    }

    if (instance.openrouterKeyId) {
      log(`Updating OpenRouter key limit to $${budget}`);
      await updateAPIKeyLimit(instance.openrouterKeyId, budget);
    } else {
      log("No OpenRouter key found, skipping PATCH");
    }

    // 2. SSH in to update config + AGENTS.md
    const sshHost = instance.tailscaleIp || instance.ipAddress;
    const ssh = await connectSSH(sshHost);

    try {
      // Update model in openclaw.json
      const planConfig = PLAN_MODELS[newPlan] || PLAN_MODELS.starter;
      const model = planConfig.primary;
      const fallbackModels = planConfig.fallbacks;

      let config: Record<string, unknown> = {};
      try {
        const existing = await execSSH(ssh, `cat ${CONFIG_PATH}`);
        config = JSON.parse(existing);
      } catch {
        // No existing config
      }

      config.agents = {
        defaults: {
          model: {
            primary: model,
            fallbacks: fallbackModels,
          },
          workspace: "~/.openclaw/workspace",
        },
      };

      await writeFileSSH(ssh, CONFIG_PATH, JSON.stringify(config, null, 2));
      log(`Updated model to ${model}`);

      // Regenerate AGENTS.md with new plan context
      const botConfig = instance.user.botConfig as {
        botName: string;
        personality: string;
        customPersonality?: string;
        userName: string;
        userDescription?: string;
        useCases: string[];
        extraContext?: string;
      } | null;

      if (botConfig) {
        const agentsMd = generateAGENTS(
          botConfig,
          newPlan,
          instance.instanceName
        );
        await writeFileSSH(ssh, `${WORKSPACE_DIR}/AGENTS.md`, agentsMd);
        log("Regenerated AGENTS.md");
      }

      // Restart container to pick up new config
      log("Restarting container...");
      await execSSH(
        ssh,
        "docker compose up -d --force-recreate",
        "/opt/openclaw"
      );
    } finally {
      ssh.dispose();
    }

    // 3. Update DB
    const llmProvider = planConfig.llmProvider;
    await prisma.instance.update({
      where: { id: instanceId },
      data: { llmProvider },
    });

    log(`Plan update complete — provider: ${llmProvider}`);
  },
  {
    connection: redis,
    concurrency: 2,
  }
);

updatePlanWorker.on("failed", (job, err) => {
  console.error(`Update plan job ${job?.id} failed:`, err.message);
});
