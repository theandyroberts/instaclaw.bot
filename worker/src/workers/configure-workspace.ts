import { Worker } from "bullmq";
import { redis } from "../queues";
import { prisma } from "../lib/prisma";
import { connectSSH, execSSH, writeFileSSH } from "../lib/ssh";
import { generateDockerCompose } from "../lib/openclaw-config";
import {
  generateSOUL,
  generateUSER,
  generateAGENTS,
  generateMEMORY,
} from "../lib/workspace-templates";

const CONFIG_PATH = "/opt/openclaw/home/.openclaw/openclaw.json";
const WORKSPACE_DIR = "/opt/openclaw/home/.openclaw/workspace";

export const configureWorkspaceWorker = new Worker(
  "configure",
  async (job) => {
    if (job.name !== "configure-workspace") return;

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
      const model =
        plan === "pro"
          ? "openrouter/anthropic/claude-sonnet-4.5"
          : "moonshot/kimi-k2.5";
      const llmProvider = plan === "pro" ? "claude" : "kimi";
      const fallbackModel =
        "openrouter/meta-llama/llama-3.3-70b-instruct:free";

      console.log(
        `[configure-workspace:${job.id}] Plan: ${plan}, Model: ${model}`
      );

      const ssh = await connectSSH(sshHost);

      try {
        // Read existing config
        let config: Record<string, unknown> = {};
        try {
          const existing = await execSSH(ssh, `cat ${CONFIG_PATH}`);
          config = JSON.parse(existing);
        } catch {
          // No existing config
        }

        // Update model in OpenClaw format
        config.agents = {
          defaults: {
            model: {
              primary: model,
              fallback: fallbackModel,
            },
            workspace: "~/.openclaw/workspace",
          },
        };

        // Write updated config
        await writeFileSSH(
          ssh,
          CONFIG_PATH,
          JSON.stringify(config, null, 2)
        );

        // Create workspace directory
        await execSSH(
          ssh,
          `mkdir -p ${WORKSPACE_DIR}`
        );

        // Generate and write workspace files
        const soulMd = generateSOUL(botConfig);
        const userMd = generateUSER(botConfig);
        const agentsMd = generateAGENTS(botConfig, plan);
        const memoryMd = generateMEMORY(botConfig);

        await writeFileSSH(ssh, `${WORKSPACE_DIR}/SOUL.md`, soulMd);
        await writeFileSSH(ssh, `${WORKSPACE_DIR}/USER.md`, userMd);
        await writeFileSSH(ssh, `${WORKSPACE_DIR}/AGENTS.md`, agentsMd);
        await writeFileSSH(ssh, `${WORKSPACE_DIR}/MEMORY.md`, memoryMd);

        // Regenerate docker-compose with API keys
        const currentCompose = await execSSH(
          ssh,
          "cat /opt/openclaw/docker-compose.yml"
        );
        const tokenMatch = currentCompose.match(
          /OPENCLAW_GATEWAY_TOKEN=(\S+)/
        );
        const gatewayToken = tokenMatch ? tokenMatch[1] : "";

        const compose = generateDockerCompose(gatewayToken, {
          openrouterApiKey: process.env.OPENROUTER_API_KEY,
          moonshotApiKey: process.env.KIMI_API_KEY,
          braveApiKey: process.env.BRAVE_API_KEY,
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
