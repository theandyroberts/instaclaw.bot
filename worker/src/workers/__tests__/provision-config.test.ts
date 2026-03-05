import { describe, it, expect } from "vitest";
import { PLAN_MODELS } from "../../lib/openclaw-config";
import { $Enums } from "../../../../src/generated/prisma";

const VALID_LLM_PROVIDERS = Object.values($Enums.LLMProvider);
const VALID_PLANS = Object.values($Enums.Plan);

describe("provision llmProvider assignment", () => {
  it("both branches of the provision ternary produce valid LLMProviders", () => {
    // provision.ts line 369: plan === "pro" ? "claude" : "gemini"
    expect(VALID_LLM_PROVIDERS).toContain("claude");
    expect(VALID_LLM_PROVIDERS).toContain("gemini");
  });

  it("PLAN_MODELS llmProvider matches the provision.ts ternary logic", () => {
    // provision.ts line 369: plan === "pro" ? "claude" : "gemini"
    // This should match PLAN_MODELS[plan].llmProvider for all plans
    for (const plan of VALID_PLANS) {
      const expected = plan === "pro" ? "claude" : "gemini";
      expect(
        PLAN_MODELS[plan].llmProvider,
        `PLAN_MODELS.${plan}.llmProvider should match provision ternary`
      ).toBe(expected);
    }
  });
});

describe("provision config object structure", () => {
  it("PLAN_MODELS provides required fields for config generation", () => {
    for (const plan of VALID_PLANS) {
      const config = PLAN_MODELS[plan];

      // agents.defaults.model.primary needs this
      expect(config.primary).toBeTruthy();
      expect(config.primary).toMatch(/^openrouter\//);

      // agents.defaults.model.fallbacks needs this
      expect(Array.isArray(config.fallbacks)).toBe(true);
      for (const fb of config.fallbacks) {
        expect(fb).toMatch(/^openrouter\//);
      }

      // llmProvider for DB write
      expect(VALID_LLM_PROVIDERS).toContain(config.llmProvider);
    }
  });
});
