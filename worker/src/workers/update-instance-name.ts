import { Worker } from "bullmq";
import { redis } from "../queues";
import { prisma } from "../lib/prisma";
import { connectSSH, writeFileSSH } from "../lib/ssh";
import {
  generateAGENTS,
  generateSiteCreatorSkill,
  generateDeploySiteScript,
} from "../lib/workspace-templates";

const WORKSPACE_DIR = "/opt/openclaw/home/.openclaw/workspace";

interface BotConfig {
  botName: string;
  personality: string;
  customPersonality?: string;
  userName: string;
  userDescription?: string;
  useCases: string[];
  extraContext?: string;
  loop?: string;
  timezone?: string;
}

export const updateInstanceNameWorker = new Worker(
  "update-instance-name",
  async (job) => {
    const { instanceId } = job.data as { instanceId: string };
    const log = (msg: string) =>
      console.log(`[update-instance-name:${job.id}] ${msg}`);

    log(`Updating instance name files for ${instanceId}`);

    const instance = await prisma.instance.findUnique({
      where: { id: instanceId },
      include: { user: { select: { id: true, botConfig: true } } },
    });

    if (!instance) {
      throw new Error("Instance not found");
    }

    if (!instance.tailscaleIp) {
      throw new Error("Instance has no Tailscale IP — not provisioned yet");
    }

    const instanceName = instance.instanceName;
    if (!instanceName) {
      log("Instance name is null — nothing to update");
      return;
    }

    const botConfig = instance.user?.botConfig as BotConfig | null;
    if (!botConfig) {
      throw new Error("No bot config found on user");
    }

    // Determine plan from subscription
    const subscription = await prisma.subscription.findUnique({
      where: { userId: instance.userId },
    });
    const plan = subscription?.plan || "starter";

    const ssh = await connectSSH(instance.tailscaleIp);

    try {
      // Rewrite AGENTS.md with website section containing the real subdomain
      await writeFileSSH(
        ssh,
        `${WORKSPACE_DIR}/AGENTS.md`,
        generateAGENTS(botConfig, plan, instanceName)
      );
      log("Updated AGENTS.md");

      // Rewrite SKILL.md and deploy_site.py with actual instanceName
      await writeFileSSH(
        ssh,
        `${WORKSPACE_DIR}/skills/public-site-creator/SKILL.md`,
        generateSiteCreatorSkill(instanceName)
      );
      await writeFileSSH(
        ssh,
        `${WORKSPACE_DIR}/skills/public-site-creator/scripts/deploy_site.py`,
        generateDeploySiteScript(instanceName)
      );
      log("Updated skill files");

      log("Done — OpenClaw reads workspace files dynamically, no restart needed");
    } finally {
      ssh.dispose();
    }
  },
  {
    connection: redis,
    concurrency: 2,
  }
);

updateInstanceNameWorker.on("failed", (job, err) => {
  console.error(`Update-instance-name job ${job?.id} failed:`, err.message);
});

updateInstanceNameWorker.on("completed", (job) => {
  console.log(`Update-instance-name job ${job.id} completed`);
});
