/**
 * Add Composio MCP integration to all active instances via mcporter.
 * - Rewrites Dockerfile to include mcporter
 * - Rebuilds Docker image
 * - Writes mcporter.json with Composio server config (per-user)
 * - Updates openclaw.json with mcporter skill + qmd config
 * - Updates AGENTS.md with integration instructions
 * - Restarts container
 *
 * Run on worker: npx tsx -r dotenv/config src/scripts/add-composio.ts
 */

import { prisma } from "../lib/prisma";
import { connectSSH, execSSH, writeFileSSH } from "../lib/ssh";
import {
  buildOpenClawConfigObject,
  PLAN_MODELS,
  generateDockerfile,
  generateMcporterConfig,
  generateDockerCompose,
} from "../lib/openclaw-config";
import { generateAGENTS } from "../lib/workspace-templates";

const CONFIG_PATH = "/opt/openclaw/home/.openclaw/openclaw.json";
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

async function main() {
  if (!process.env.COMPOSIO_API_KEY) {
    console.error("COMPOSIO_API_KEY is not set in environment");
    process.exit(1);
  }

  const instances = await prisma.instance.findMany({
    where: { status: "active", tailscaleIp: { not: null } },
    include: {
      user: {
        select: {
          id: true,
          botConfig: true,
          subscription: { select: { plan: true } },
        },
      },
    },
  });

  console.log(`Found ${instances.length} active instance(s) to update\n`);

  for (const inst of instances) {
    const tag = `[${inst.id.slice(0, 8)}]`;
    const userId = inst.user.id;
    const plan = inst.user.subscription?.plan || "standard";
    const botConfig = inst.user.botConfig as BotConfig | null;
    const planConfig = PLAN_MODELS[plan] || PLAN_MODELS.standard;

    console.log(`${tag} Connecting to ${inst.tailscaleIp} (user=${userId.slice(0, 8)}, plan=${plan})...`);

    let ssh;
    try {
      ssh = await connectSSH(inst.tailscaleIp!);
    } catch (err) {
      console.error(`${tag} SSH connect failed, skipping:`, err);
      continue;
    }

    try {
      // 1. Update Dockerfile to include mcporter
      console.log(`${tag} Writing updated Dockerfile...`);
      await writeFileSSH(ssh, "/opt/openclaw/Dockerfile", generateDockerfile());

      // 2. Rebuild Docker image
      console.log(`${tag} Pulling base image + rebuilding (this takes a minute)...`);
      await execSSH(ssh, "docker compose build --pull", "/opt/openclaw");
      console.log(`${tag} Docker image rebuilt`);

      // 3. Read existing config to preserve channels
      let existingConfig: Record<string, unknown> = {};
      try {
        const raw = await execSSH(ssh, `cat ${CONFIG_PATH}`);
        existingConfig = JSON.parse(raw);
      } catch {
        console.warn(`${tag} Could not read existing config`);
      }

      // 4. Build new config with mcporter enabled
      const newConfig = buildOpenClawConfigObject({
        model: planConfig.primary,
        fallbacks: planConfig.fallbacks,
        userId,
      });

      // Preserve existing channels (telegram bot token)
      if (existingConfig.channels) {
        newConfig.channels = existingConfig.channels;
      }

      await writeFileSSH(ssh, CONFIG_PATH, JSON.stringify(newConfig, null, 2));
      console.log(`${tag} Updated openclaw.json (mcporter skill + qmd enabled)`);

      // 5. Write mcporter.json with Composio server
      const mcporterJson = generateMcporterConfig(userId);
      if (mcporterJson) {
        const mcporterDir = "/opt/openclaw/home/.openclaw/config";
        await execSSH(ssh, `mkdir -p ${mcporterDir}`, "/");
        await writeFileSSH(ssh, `${mcporterDir}/mcporter.json`, mcporterJson);
        console.log(`${tag} Wrote mcporter.json for Composio`);
      }

      // 6. Update docker-compose with COMPOSIO_API_KEY
      const currentCompose = await execSSH(ssh, "cat /opt/openclaw/docker-compose.yml");
      const tokenMatch = currentCompose.match(/OPENCLAW_GATEWAY_TOKEN=(\S+)/);
      const orKeyMatch = currentCompose.match(/OPENROUTER_API_KEY=(\S+)/);
      const braveMatch = currentCompose.match(/BRAVE_API_KEY=(\S+)/);
      const geminiMatch = currentCompose.match(/GEMINI_API_KEY=(\S+)/);

      const compose = generateDockerCompose(tokenMatch?.[1] || "", {
        openrouterApiKey: orKeyMatch?.[1],
        braveApiKey: braveMatch?.[1] || process.env.BRAVE_API_KEY,
        geminiApiKey: geminiMatch?.[1] || process.env.GEMINI_API_KEY,
        composioApiKey: process.env.COMPOSIO_API_KEY,
      });
      await writeFileSSH(ssh, "/opt/openclaw/docker-compose.yml", compose);
      console.log(`${tag} Updated docker-compose.yml`);

      // 7. Update AGENTS.md
      if (botConfig) {
        await writeFileSSH(
          ssh,
          `${WORKSPACE_DIR}/AGENTS.md`,
          generateAGENTS(botConfig, plan, inst.instanceName)
        );
        console.log(`${tag} Updated AGENTS.md`);
      }

      // 8. Restart container with new image
      console.log(`${tag} Restarting container...`);
      await execSSH(ssh, "docker compose up -d --force-recreate", "/opt/openclaw");

      console.log(`${tag} DONE\n`);
    } catch (err) {
      console.error(`${tag} Failed:`, err);
    } finally {
      ssh.dispose();
    }
  }

  console.log("All instances processed.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
