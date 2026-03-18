import type { $Enums } from "../../../src/generated/prisma";

export interface OpenClawConfig {
  telegram?: {
    botToken: string;
  };
  model?: string;
}

/** Per-plan model config type — llmProvider is validated against Prisma enum */
type PlanModelConfig = { primary: string; fallbacks: string[]; llmProvider: $Enums.LLMProvider };

/** Centralized model config per plan tier — single source of truth.
 *  `satisfies` ensures every Plan key exists and llmProvider values are valid Prisma enums.
 *  The Record<string, ...> annotation lets consumers index with string/any from DB queries. */
const STARTER_CONFIG: PlanModelConfig = {
  primary: "openrouter/healer-alpha",
  fallbacks: [
    "openrouter/hunter-alpha",
    "openrouter/google/gemini-2.5-flash",
  ],
  llmProvider: "gemini",
};

export const PLAN_MODELS: Record<string, PlanModelConfig> = {
  starter: STARTER_CONFIG,
  standard: STARTER_CONFIG,
  pro: {
    primary: "openrouter/anthropic/claude-sonnet-4.5",
    fallbacks: [
      "openrouter/healer-alpha",
      "openrouter/nvidia/nemotron-3-nano-30b-a3b",
    ],
    llmProvider: "claude",
  },
} satisfies Record<$Enums.Plan, PlanModelConfig>;

/**
 * Generate a Dockerfile that extends the base OpenClaw image with Chromium
 * and its dependencies for browser-based skills.
 */
export function generateDockerfile(): string {
  return `FROM alpine/openclaw:2026.3.8
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \\
    chromium \\
    chromium-driver \\
    fonts-freefont-ttf \\
    && rm -rf /var/lib/apt/lists/*
USER node
`;
}

/**
 * Generate docker-compose.yml for an OpenClaw customer droplet.
 * Builds from a local Dockerfile that adds Chromium to the base image.
 * Volume mounts config to /home/node/.openclaw (where OpenClaw reads it).
 * Passes OPENROUTER_API_KEY for OpenRouter-based models.
 */
export function generateDockerCompose(
  gatewayToken: string,
  opts?: {
    openrouterApiKey?: string;
    braveApiKey?: string;
    geminiApiKey?: string;
  }
): string {
  const envLines = [
    `      - OPENCLAW_GATEWAY_TOKEN=${gatewayToken}`,
  ];
  if (opts?.openrouterApiKey) {
    envLines.push(`      - OPENROUTER_API_KEY=${opts.openrouterApiKey}`);
  }
  if (opts?.braveApiKey) {
    envLines.push(`      - BRAVE_API_KEY=${opts.braveApiKey}`);
  }
  if (opts?.geminiApiKey) {
    envLines.push(`      - GEMINI_API_KEY=${opts.geminiApiKey}`);
  }

  // PATH includes .local/bin so skills like nano-banana-pro can find uv
  envLines.push(`      - PATH=/home/node/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`);
  // Chromium env vars so tools/skills can locate the browser
  envLines.push(`      - CHROME_BIN=/usr/bin/chromium`);
  envLines.push(`      - CHROMIUM_FLAGS=--no-sandbox --headless=new --disable-gpu --disable-dev-shm-usage`);
  envLines.push(`      - PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`);
  envLines.push(`      - SELENIUM_BROWSER_PATH=/usr/bin/chromium`);

  return `services:
  openclaw-gateway:
    build: .
    restart: unless-stopped
    network_mode: host
    shm_size: "256m"
    volumes:
      - ./home/.openclaw:/home/node/.openclaw
      - ./home/.local:/home/node/.local
      - ./data:/app/data
    environment:
      - HOST=0.0.0.0
${envLines.join("\n")}
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
`;
}

/**
 * Generate OpenClaw config JSON (written to /home/node/.openclaw/openclaw.json).
 * Uses the actual OpenClaw schema: channels.telegram.botToken, agents.defaults.model.primary.
 */
export function generateOpenClawConfig(config: OpenClawConfig): string {
  const obj: Record<string, unknown> = {};

  if (config.telegram) {
    obj.channels = {
      telegram: {
        enabled: true,
        botToken: config.telegram.botToken,
        dmPolicy: "open",
        allowFrom: ["*"],
      },
    };
  }

  if (config.model) {
    obj.agents = {
      defaults: {
        model: {
          primary: config.model,
        },
        workspace: "~/.openclaw/workspace",
      },
    };
  }

  return JSON.stringify(obj, null, 2);
}

/**
 * Map user-facing provider choice to OpenClaw model string.
 * OpenClaw uses "provider/model" format. For OpenRouter models: "openrouter/vendor/model".
 * Returns the model string and any extra env vars needed in docker-compose.
 */
export function getLLMConfig(provider: string): {
  model: string;
  envVars?: Record<string, string>;
} {
  switch (provider) {
    case "kimi":
      return {
        model: "openrouter/moonshotai/kimi-k2.5",
      };
    case "claude":
      return {
        model: "openrouter/anthropic/claude-sonnet-4.5",
      };
    case "openai":
      return {
        model: "openrouter/openai/gpt-4o",
      };
    case "gemini":
      return {
        model: "openrouter/google/gemini-2.5-pro-preview",
      };
    case "minimax":
      return {
        model: "openrouter/minimax/minimax-m1",
      };
    default:
      return {
        model: "openrouter/anthropic/claude-sonnet-4.5",
      };
  }
}
