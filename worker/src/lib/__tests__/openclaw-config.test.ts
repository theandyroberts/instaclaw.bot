import { describe, it, expect } from "vitest";
import {
  PLAN_MODELS,
  generateDockerfile,
  generateDockerCompose,
  generateOpenClawConfig,
  getLLMConfig,
} from "../openclaw-config";
import { PLAN_BUDGETS } from "../openrouter";
import { $Enums } from "../../../../src/generated/prisma";

const VALID_PLANS = Object.values($Enums.Plan);
const VALID_LLM_PROVIDERS = Object.values($Enums.LLMProvider);

describe("PLAN_MODELS", () => {
  it("every key is a valid Plan enum value", () => {
    for (const key of Object.keys(PLAN_MODELS)) {
      expect(VALID_PLANS).toContain(key);
    }
  });

  it("covers all Plan enum values", () => {
    for (const plan of VALID_PLANS) {
      expect(PLAN_MODELS).toHaveProperty(plan);
    }
  });

  it("every llmProvider is a valid LLMProvider enum value", () => {
    for (const [plan, config] of Object.entries(PLAN_MODELS)) {
      expect(VALID_LLM_PROVIDERS, `${plan}.llmProvider="${config.llmProvider}"`).toContain(
        config.llmProvider
      );
    }
  });

  it("every plan has a non-empty primary model", () => {
    for (const [plan, config] of Object.entries(PLAN_MODELS)) {
      expect(config.primary, `${plan}.primary`).toBeTruthy();
      expect(typeof config.primary).toBe("string");
    }
  });

  it("every plan has a fallbacks array", () => {
    for (const [plan, config] of Object.entries(PLAN_MODELS)) {
      expect(Array.isArray(config.fallbacks), `${plan}.fallbacks`).toBe(true);
    }
  });
});

describe("PLAN_BUDGETS", () => {
  it("every key is a valid Plan enum value", () => {
    for (const key of Object.keys(PLAN_BUDGETS)) {
      expect(VALID_PLANS).toContain(key);
    }
  });

  it("covers all Plan enum values", () => {
    for (const plan of VALID_PLANS) {
      expect(PLAN_BUDGETS).toHaveProperty(plan);
    }
  });

  it("every budget is a positive number", () => {
    for (const [plan, budget] of Object.entries(PLAN_BUDGETS)) {
      expect(budget, `${plan} budget`).toBeGreaterThan(0);
    }
  });
});

describe("generateDockerfile", () => {
  it("starts with a valid FROM instruction", () => {
    const df = generateDockerfile();
    expect(df).toMatch(/^FROM \S+/);
  });

  it("pins an explicit version (not :latest)", () => {
    const df = generateDockerfile();
    expect(df).not.toContain(":latest");
    expect(df).toMatch(/FROM alpine\/openclaw:\d{4}\.\d+\.\d+/);
  });
});

describe("generateDockerCompose", () => {
  it("contains required top-level keys", () => {
    const dc = generateDockerCompose("test-token");
    expect(dc).toContain("services:");
    expect(dc).toContain("openclaw-gateway:");
    expect(dc).toContain("volumes:");
    expect(dc).toContain("environment:");
  });

  it("includes the gateway token", () => {
    const dc = generateDockerCompose("my-secret-token");
    expect(dc).toContain("OPENCLAW_GATEWAY_TOKEN=my-secret-token");
  });

  it("includes optional API keys when provided", () => {
    const dc = generateDockerCompose("tok", {
      openrouterApiKey: "or-key",
      braveApiKey: "brave-key",
      geminiApiKey: "gem-key",
    });
    expect(dc).toContain("OPENROUTER_API_KEY=or-key");
    expect(dc).toContain("BRAVE_API_KEY=brave-key");
    expect(dc).toContain("GEMINI_API_KEY=gem-key");
  });
});

describe("generateOpenClawConfig", () => {
  it("produces valid JSON", () => {
    const json = generateOpenClawConfig({ model: "openrouter/test/model" });
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("includes agents.defaults.model.primary when model is set", () => {
    const json = generateOpenClawConfig({ model: "openrouter/test/model" });
    const parsed = JSON.parse(json);
    expect(parsed.agents.defaults.model.primary).toBe("openrouter/test/model");
  });

  it("includes telegram config when provided", () => {
    const json = generateOpenClawConfig({
      telegram: { botToken: "123:ABC" },
    });
    const parsed = JSON.parse(json);
    expect(parsed.channels.telegram.botToken).toBe("123:ABC");
    expect(parsed.channels.telegram.enabled).toBe(true);
  });

  it("produces empty object when no config provided", () => {
    const json = generateOpenClawConfig({});
    expect(JSON.parse(json)).toEqual({});
  });
});

describe("getLLMConfig", () => {
  it("returns a model string for all known providers", () => {
    for (const provider of VALID_LLM_PROVIDERS) {
      const config = getLLMConfig(provider);
      expect(config.model, `provider="${provider}"`).toBeTruthy();
      expect(typeof config.model).toBe("string");
    }
  });

  it("returns a fallback model for unknown providers", () => {
    const config = getLLMConfig("nonexistent-provider");
    expect(config.model).toBeTruthy();
  });
});
