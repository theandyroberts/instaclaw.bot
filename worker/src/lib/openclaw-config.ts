export interface OpenClawConfig {
  telegram: {
    token: string;
  };
  llm: {
    provider: string;
    model: string;
    apiKey?: string;
  };
}

export function generateDockerCompose(): string {
  return `version: '3.8'

services:
  openclaw-gateway:
    image: openclaw/gateway:latest
    restart: unless-stopped
    volumes:
      - ./config:/app/config
      - ./data:/app/data
    environment:
      - CONFIG_PATH=/app/config/openclaw.json
    ports:
      - "8080:8080"
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
`;
}

export function generateOpenClawConfig(config: OpenClawConfig): string {
  return JSON.stringify(
    {
      version: "1.0",
      channels: {
        telegram: {
          enabled: true,
          token: config.telegram.token,
        },
      },
      llm: {
        provider: config.llm.provider,
        model: config.llm.model,
        ...(config.llm.apiKey && { apiKey: config.llm.apiKey }),
      },
      features: {
        webBrowsing: true,
        codeExecution: false,
        fileManagement: true,
      },
    },
    null,
    2
  );
}

export function getLLMConfig(
  provider: string,
  apiKey?: string
): { provider: string; model: string; apiKey?: string } {
  switch (provider) {
    case "kimi":
      return {
        provider: "moonshot",
        model: "kimi-k2.5",
        apiKey: process.env.KIMI_API_KEY,
      };
    case "claude":
      return {
        provider: "openrouter",
        model: "anthropic/claude-sonnet-4-5-20250929",
        apiKey,
      };
    case "openai":
      return {
        provider: "openrouter",
        model: "openai/gpt-4o",
        apiKey,
      };
    case "gemini":
      return {
        provider: "openrouter",
        model: "google/gemini-2.5-pro-preview",
        apiKey,
      };
    case "minimax":
      return {
        provider: "openrouter",
        model: "minimax/minimax-m1",
        apiKey,
      };
    default:
      return {
        provider: "moonshot",
        model: "kimi-k2.5",
        apiKey: process.env.KIMI_API_KEY,
      };
  }
}
