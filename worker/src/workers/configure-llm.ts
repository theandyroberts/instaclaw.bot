import { Worker } from "bullmq";
import { redis } from "../queues";
import { prisma } from "../lib/prisma";
import { connectSSH, execSSH, writeFileSSH } from "../lib/ssh";
import { getLLMConfig } from "../lib/openclaw-config";
import { createAPIKey } from "../lib/openrouter";

export const configureLLMWorker = new Worker(
  "configure",
  async (job) => {
    if (job.name !== "configure-llm") return;

    const { instanceId, provider, plan } = job.data;

    console.log(`[configure-llm:${job.id}] Configuring LLM (${provider}) for instance ${instanceId}`);

    try {
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId },
      });

      if (!instance || !instance.ipAddress) {
        throw new Error("Instance not found or not provisioned");
      }

      let apiKey: string | undefined;
      let openrouterKeyId: string | undefined;

      // For Pro plan with non-Kimi models, create OpenRouter API key with budget
      if (plan === "pro" && provider !== "kimi") {
        console.log(`[configure-llm:${job.id}] Creating OpenRouter API key with $15 budget...`);
        try {
          const orKey = await createAPIKey(`instaclaw-${instanceId.slice(0, 8)}`, 15);
          apiKey = orKey.key;
          openrouterKeyId = orKey.id;
        } catch (err) {
          console.error(`[configure-llm:${job.id}] OpenRouter key creation failed, using fallback:`, err);
          // Fallback: use the platform's OpenRouter key
          apiKey = process.env.OPENROUTER_API_KEY;
        }
      }

      const llmConfig = getLLMConfig(provider, apiKey);

      const ssh = await connectSSH(instance.ipAddress);

      try {
        // Read existing config
        let config: Record<string, unknown> = {};
        try {
          const existing = await execSSH(
            ssh,
            "cat /opt/openclaw/config/openclaw.json"
          );
          config = JSON.parse(existing);
        } catch {
          // No existing config
        }

        // Update LLM configuration
        config.llm = {
          provider: llmConfig.provider,
          model: llmConfig.model,
          ...(llmConfig.apiKey && { apiKey: llmConfig.apiKey }),
        };

        config.features = {
          webBrowsing: true,
          codeExecution: false,
          fileManagement: true,
        };

        // Write updated config
        await writeFileSSH(
          ssh,
          "/opt/openclaw/config/openclaw.json",
          JSON.stringify(config, null, 2)
        );

        // Start or restart the gateway
        console.log(`[configure-llm:${job.id}] Starting OpenClaw gateway...`);
        await execSSH(ssh, "docker compose up -d", "/opt/openclaw");

        // Verify it's running
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const containerStatus = await execSSH(
          ssh,
          "docker compose ps --format json",
          "/opt/openclaw"
        );
        console.log(`[configure-llm:${job.id}] Container status: ${containerStatus}`);
      } finally {
        ssh.dispose();
      }

      // Update instance
      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          llmProvider: provider,
          llmConfigured: true,
          onboardingStep: "complete",
          ...(openrouterKeyId && { openrouterKeyId }),
        },
      });

      console.log(`[configure-llm:${job.id}] LLM configured successfully!`);
    } catch (error) {
      console.error(`[configure-llm:${job.id}] Failed:`, error);

      // Revert to awaiting LLM choice so user can retry
      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          onboardingStep: "awaiting_llm_choice",
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

configureLLMWorker.on("failed", (job, err) => {
  console.error(`Configure LLM job ${job?.id} failed:`, err.message);
});
