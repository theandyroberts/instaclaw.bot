import { Worker } from "bullmq";
import { redis } from "../queues";
import { prisma } from "../lib/prisma";
import { connectSSH, execSSH, writeFileSSH } from "../lib/ssh";
import { generateDockerCompose, PLAN_MODELS, buildOpenClawConfigObject } from "../lib/openclaw-config";
import {
  generateSOUL,
  generateUSER,
  generateAGENTS,
  generateMEMORY,
  generateCronJobs,
  generateSiteCreatorSkill,
  generateDeploySiteScript,
} from "../lib/workspace-templates";

const CONFIG_PATH = "/opt/openclaw/home/.openclaw/openclaw.json";
const WORKSPACE_DIR = "/opt/openclaw/home/.openclaw/workspace";

export const configureWorkspaceWorker = new Worker(
  "configure-workspace",
  async (job) => {

    const { instanceId } = job.data;

    console.log(
      `[configure-workspace:${job.id}] Configuring workspace for instance ${instanceId}`
    );

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId },
        include: { user: true },
      });

      if (!instance || !instance.ipAddress) {
        throw new Error("Instance not found or not provisioned");
      }

      const sshHost = instance.tailscaleIp || instance.ipAddress;
      const user = instance.user;
      const botConfig = user.botConfig as {
        botName: string;
        personality: string;
        customPersonality?: string;
        userName: string;
        userDescription?: string;
        useCases: string[];
        extraContext?: string;
        loop?: string;
        timezone?: string;
      } | null;

      if (!botConfig) {
        throw new Error("No bot config found on user");
      }

      // Determine plan from subscription
      const subscription = await prisma.subscription.findUnique({
        where: { userId: user.id },
      });
      const plan = subscription?.plan || "starter";

      // Auto-select LLM based on plan
      const planConfig = PLAN_MODELS[plan] || PLAN_MODELS.starter;
      const model = planConfig.primary;
      const llmProvider = planConfig.llmProvider;
      const fallbackModels = planConfig.fallbacks;

      console.log(
        `[configure-workspace:${job.id}] Plan: ${plan}, Model: ${model}`
      );

      const ssh = await connectSSH(sshHost);

      try {
        // Read existing config and merge with fresh base (preserves channels etc.)
        let existingConfig: Record<string, unknown> = {};
        try {
          const existing = await execSSH(ssh, `cat ${CONFIG_PATH}`);
          existingConfig = JSON.parse(existing);
        } catch {
          // No existing config
        }

        // Build fresh config with Composio MCP server
        const freshConfig = buildOpenClawConfigObject({
          model,
          fallbacks: fallbackModels,
          userId: user.id,
        });

        // Preserve existing channel config (e.g. telegram botToken)
        if (existingConfig.channels) {
          freshConfig.channels = existingConfig.channels;
        }

        // Write updated config
        await writeFileSSH(
          ssh,
          CONFIG_PATH,
          JSON.stringify(freshConfig, null, 2)
        );

        // Create workspace directory
        await execSSH(
          ssh,
          `mkdir -p ${WORKSPACE_DIR}`
        );

        // Generate and write workspace files
        const soulMd = generateSOUL(botConfig);
        const userMd = generateUSER(botConfig);
        const agentsMd = generateAGENTS(botConfig, plan, instance.instanceName);
        const memoryMd = generateMEMORY(botConfig);

        await writeFileSSH(ssh, `${WORKSPACE_DIR}/SOUL.md`, soulMd);
        await writeFileSSH(ssh, `${WORKSPACE_DIR}/USER.md`, userMd);
        await writeFileSSH(ssh, `${WORKSPACE_DIR}/AGENTS.md`, agentsMd);
        await writeFileSSH(ssh, `${WORKSPACE_DIR}/MEMORY.md`, memoryMd);

        // Write public-site-creator skill (always — handles missing instanceName gracefully)
        const skillDir = `${WORKSPACE_DIR}/skills/public-site-creator/scripts`;
        await execSSH(ssh, `mkdir -p ${skillDir}`);
        await writeFileSSH(ssh, `${WORKSPACE_DIR}/skills/public-site-creator/SKILL.md`, generateSiteCreatorSkill(instance.instanceName));
        await writeFileSSH(ssh, `${skillDir}/deploy_site.py`, generateDeploySiteScript(instance.instanceName));

        // Write cron jobs if loop is set
        if (botConfig.loop && botConfig.loop !== "just-exploring") {
          const cronJson = generateCronJobs(botConfig.loop, botConfig.timezone);
          if (cronJson) {
            const cronDir = "/opt/openclaw/home/.openclaw/cron";
            await execSSH(ssh, `mkdir -p ${cronDir}`);
            await writeFileSSH(ssh, `${cronDir}/jobs.json`, cronJson);
            console.log(`[configure-workspace:${job.id}] Wrote cron/jobs.json for loop: ${botConfig.loop}`);
          }
        }

        // Regenerate docker-compose preserving per-instance keys
        const currentCompose = await execSSH(
          ssh,
          "cat /opt/openclaw/docker-compose.yml"
        );
        const tokenMatch = currentCompose.match(
          /OPENCLAW_GATEWAY_TOKEN=(\S+)/
        );
        const gatewayToken = tokenMatch ? tokenMatch[1] : "";

        // Preserve the per-instance OpenRouter key (not the master key)
        const orKeyMatch = currentCompose.match(/OPENROUTER_API_KEY=(\S+)/);
        const instanceOrKey = orKeyMatch ? orKeyMatch[1] : process.env.OPENROUTER_API_KEY;

        const compose = generateDockerCompose(gatewayToken, {
          openrouterApiKey: instanceOrKey,
          braveApiKey: process.env.BRAVE_API_KEY,
          composioApiKey: process.env.COMPOSIO_API_KEY,
        });
        await writeFileSSH(ssh, "/opt/openclaw/docker-compose.yml", compose);

        // Start or restart the gateway
        console.log(
          `[configure-workspace:${job.id}] Starting OpenClaw gateway...`
        );
        await execSSH(
          ssh,
          "docker compose up -d --force-recreate",
          "/opt/openclaw"
        );

        // Verify it's running
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const containerStatus = await execSSH(
          ssh,
          "docker compose ps --format json",
          "/opt/openclaw"
        );
        console.log(
          `[configure-workspace:${job.id}] Container status: ${containerStatus}`
        );
      } finally {
        ssh.dispose();
      }

      // Update instance
      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          llmProvider: llmProvider,
          llmConfigured: true,
          onboardingStep: "complete",
        },
      });

      console.log(
        `[configure-workspace:${job.id}] Workspace configured successfully!`
      );
    } catch (error) {
      console.error(`[configure-workspace:${job.id}] Failed:`, error);

      // Revert to configuring_workspace so the polling picks it up for retry
      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          onboardingStep: "configuring_workspace",
        },
      });

      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 2,
  }
);

configureWorkspaceWorker.on("failed", (job, err) => {
  console.error(`Configure workspace job ${job?.id} failed:`, err.message);
});
