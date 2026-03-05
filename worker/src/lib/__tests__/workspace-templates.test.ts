import { describe, it, expect } from "vitest";
import {
  generateSOUL,
  generateUSER,
  generateAGENTS,
  generateCronJobs,
  generateSiteCreatorSkill,
} from "../workspace-templates";

const baseBotConfig = {
  botName: "TestBot",
  personality: "friendly",
  userName: "TestUser",
  useCases: ["research", "writing"],
};

describe("generateSOUL", () => {
  it("handles all built-in personality types without error", () => {
    for (const personality of ["friendly", "professional", "witty"]) {
      const result = generateSOUL({ ...baseBotConfig, personality });
      expect(result).toContain(baseBotConfig.botName);
    }
  });

  it("handles custom personality", () => {
    const result = generateSOUL({
      ...baseBotConfig,
      personality: "custom",
      customPersonality: "sarcastic and deadpan",
    });
    expect(result).toContain("sarcastic and deadpan");
  });

  it("falls back gracefully for unknown personality", () => {
    const result = generateSOUL({ ...baseBotConfig, personality: "unknown" });
    expect(result).toContain("friendly and helpful");
  });
});

describe("generateUSER", () => {
  it("includes user name", () => {
    const result = generateUSER(baseBotConfig);
    expect(result).toContain("TestUser");
  });

  it("handles missing optional fields", () => {
    const result = generateUSER({
      ...baseBotConfig,
      userDescription: undefined,
      useCases: [],
    });
    expect(result).toContain("TestUser");
    expect(result).not.toContain("## About");
    expect(result).not.toContain("Primary Use Cases");
  });

  it("includes description when provided", () => {
    const result = generateUSER({
      ...baseBotConfig,
      userDescription: "A software developer",
    });
    expect(result).toContain("A software developer");
  });
});

describe("generateAGENTS", () => {
  it("includes model policy for starter plan", () => {
    const result = generateAGENTS(baseBotConfig, "starter");
    expect(result).toContain("Gemini 2.5 Flash");
    expect(result).toContain("upgrading to the Pro plan");
  });

  it("includes model policy for pro plan", () => {
    const result = generateAGENTS(baseBotConfig, "pro");
    expect(result).toContain("premium AI models");
  });

  it("includes website section when instanceName is set", () => {
    const result = generateAGENTS(baseBotConfig, "starter", "mybot");
    expect(result).toContain("Creating Websites");
    expect(result).toContain("mybot.instaclaw.bot");
  });

  it("omits website section when instanceName is null", () => {
    const result = generateAGENTS(baseBotConfig, "starter", null);
    expect(result).not.toContain("Creating Websites");
  });

  it("includes loop section when loop is set", () => {
    const result = generateAGENTS(
      { ...baseBotConfig, loop: "better-writer" },
      "starter"
    );
    expect(result).toContain("Better Writer");
    expect(result).toContain("Your Loop");
  });
});

describe("generateCronJobs", () => {
  it("produces valid JSON for all known loop types", () => {
    const loops = [
      "better-writer",
      "grow-business",
      "work-assistant",
      "health-habits",
      "learn-explore",
    ];
    for (const loop of loops) {
      const result = generateCronJobs(loop);
      expect(result, `loop="${loop}"`).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed.version).toBe(1);
      expect(parsed.jobs).toHaveLength(1);
      expect(parsed.jobs[0].id).toBe(`loop-${loop}`);
    }
  });

  it("returns null for unknown loop type", () => {
    expect(generateCronJobs("nonexistent")).toBeNull();
  });

  it("uses provided timezone", () => {
    const result = generateCronJobs("better-writer", "America/New_York");
    const parsed = JSON.parse(result!);
    expect(parsed.jobs[0].schedule.timezone).toBe("America/New_York");
  });

  it("uses UTC fallback when no timezone", () => {
    const result = generateCronJobs("better-writer");
    const parsed = JSON.parse(result!);
    expect(parsed.jobs[0].schedule.cron).toBe("0 14 * * *");
    expect(parsed.jobs[0].schedule.timezone).toBeUndefined();
  });
});

describe("generateSiteCreatorSkill", () => {
  it("includes instance name in URLs", () => {
    const result = generateSiteCreatorSkill("mybot");
    expect(result).toContain("mybot.instaclaw.bot");
  });

  it("includes step-by-step instructions", () => {
    const result = generateSiteCreatorSkill("test");
    expect(result).toContain("mkdir -p");
    expect(result).toContain("index.html");
  });
});
