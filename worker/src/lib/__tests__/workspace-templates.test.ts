import { describe, it, expect } from "vitest";
import {
  generateSOUL,
  generateUSER,
  generateAGENTS,
  generateCronJobs,
  generateSiteCreatorSkill,
  generateDeploySiteScript,
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

  it("includes website section with setup prompt when instanceName is null", () => {
    const result = generateAGENTS(baseBotConfig, "starter", null);
    expect(result).toContain("Creating Websites");
    expect(result).toContain("instaclaw.bot/dashboard/settings");
    expect(result).not.toContain(".instaclaw.bot/");
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

  it("uses provided timezone with correct field names", () => {
    const result = generateCronJobs("better-writer", "America/New_York");
    const parsed = JSON.parse(result!);
    expect(parsed.jobs[0].schedule.kind).toBe("cron");
    expect(parsed.jobs[0].schedule.expr).toBe("0 9 * * *");
    expect(parsed.jobs[0].schedule.tz).toBe("America/New_York");
    expect(parsed.jobs[0].payload.kind).toBe("agentTurn");
    expect(parsed.jobs[0].payload.message).toBeTruthy();
    expect(parsed.jobs[0].prompt).toBeUndefined();
    expect(parsed.jobs[0].enabled).toBe(true);
    expect(parsed.jobs[0].state).toEqual({});
  });

  it("uses UTC fallback when no timezone", () => {
    const result = generateCronJobs("better-writer");
    const parsed = JSON.parse(result!);
    expect(parsed.jobs[0].schedule.kind).toBe("cron");
    expect(parsed.jobs[0].schedule.expr).toBe("0 14 * * *");
    expect(parsed.jobs[0].schedule.tz).toBe("UTC");
  });
});

describe("generateSiteCreatorSkill", () => {
  it("includes instance name in URLs", () => {
    const result = generateSiteCreatorSkill("mybot");
    expect(result).toContain("mybot.instaclaw.bot");
    expect(result).not.toContain("<subdomain>");
    expect(result).not.toContain("Prerequisite");
  });

  it("includes step-by-step instructions", () => {
    const result = generateSiteCreatorSkill("test");
    expect(result).toContain("mkdir -p");
    expect(result).toContain("index.html");
  });

  it("uses placeholder and prerequisite when instanceName is null", () => {
    const result = generateSiteCreatorSkill(null);
    expect(result).toContain("<subdomain>");
    expect(result).toContain("Prerequisite");
    expect(result).toContain("instaclaw.bot/dashboard/settings");
  });

  it("uses placeholder when instanceName is undefined", () => {
    const result = generateSiteCreatorSkill();
    expect(result).toContain("<subdomain>");
  });
});

describe("generateDeploySiteScript", () => {
  it("sets INSTANCE_NAME when instanceName is provided", () => {
    const result = generateDeploySiteScript("mybot");
    expect(result).toContain('INSTANCE_NAME = "mybot"');
    expect(result).not.toContain("INSTANCE_NAME = None");
  });

  it("sets INSTANCE_NAME to None when null", () => {
    const result = generateDeploySiteScript(null);
    expect(result).toContain("INSTANCE_NAME = None");
    expect(result).toContain("Subdomain not configured yet");
  });

  it("sets INSTANCE_NAME to None when undefined", () => {
    const result = generateDeploySiteScript();
    expect(result).toContain("INSTANCE_NAME = None");
  });
});
