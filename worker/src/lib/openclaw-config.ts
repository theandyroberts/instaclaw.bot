export interface OpenClawConfig {
  telegram?: {
    botToken: string;
  };
  model?: string;
}

/**
 * Generate docker-compose.yml for an OpenClaw customer droplet.
 * Volume mounts config to /home/node/.openclaw (where OpenClaw reads it).
 * Passes OPENROUTER_API_KEY for OpenRouter-based models.
 */
export function generateDockerCompose(
  gatewayToken: string,
  opts?: {
    openrouterApiKey?: string;
    moonshotApiKey?: string;
    braveApiKey?: string;
  }
): string {
  const envLines = [
    `      - OPENCLAW_GATEWAY_TOKEN=${gatewayToken}`,
  ];
  if (opts?.openrouterApiKey) {
    envLines.push(`      - OPENROUTER_API_KEY=${opts.openrouterApiKey}`);
  }
  if (opts?.moonshotApiKey) {
    envLines.push(`      - MOONSHOT_API_KEY=${opts.moonshotApiKey}`);
  }
  if (opts?.braveApiKey) {
    envLines.push(`      - BRAVE_API_KEY=${opts.braveApiKey}`);
  }

  return `services:
  openclaw-gateway:
    image: alpine/openclaw:latest
    restart: unless-stopped
    volumes:
      - ./home/.openclaw:/home/node/.openclaw
      - ./data:/app/data
    environment:
${envLines.join("\n")}
    ports:
      - "8080:8080"
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
        model: "moonshot/kimi-k2.5",
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
