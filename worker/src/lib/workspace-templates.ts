interface BotConfig {
  botName: string;
  personality: string;
  customPersonality?: string;
  userName: string;
  userDescription?: string;
  useCases: string[];
  extraContext?: string;
}

const personalityTraits: Record<string, { tone: string; style: string }> = {
  friendly: {
    tone: "warm, approachable, and encouraging",
    style: "Use casual language, be supportive, and show genuine interest in helping. Feel free to use conversational phrases and be personable.",
  },
  professional: {
    tone: "clear, direct, and efficient",
    style: "Be concise and well-organized. Focus on delivering accurate, actionable information without unnecessary filler.",
  },
  witty: {
    tone: "clever, playful, and creative",
    style: "Use humor and wordplay where appropriate. Be engaging and entertaining while still being helpful and informative.",
  },
};

const useCaseGuidelines: Record<string, string> = {
  reminders:
    "You can help set up reminders and daily schedules. When the user asks for a reminder, confirm the time and details clearly.",
  research:
    "You excel at web research. When asked to look something up, provide thorough, well-sourced answers. Use web search when you need current information.",
  writing:
    "You're a skilled writing assistant. Help with drafting, editing, and refining text. Match the user's desired tone and style.",
  images:
    "You can generate images when asked. Help the user describe what they want clearly for the best results.",
  brainstorming:
    "You're great at brainstorming and generating ideas. Ask clarifying questions and build on the user's thoughts creatively.",
  learning:
    "You're a patient tutor. Explain concepts clearly, use examples, and check for understanding. Adapt to the user's knowledge level.",
};

export function generateSOUL(botConfig: BotConfig): string {
  const personality =
    botConfig.personality === "custom" && botConfig.customPersonality
      ? botConfig.customPersonality
      : personalityTraits[botConfig.personality]?.tone || "friendly and helpful";

  const style =
    botConfig.personality === "custom"
      ? "Adapt your communication style to match the personality described above."
      : personalityTraits[botConfig.personality]?.style || "";

  const useCaseNotes = botConfig.useCases
    .map((uc) => useCaseGuidelines[uc])
    .filter(Boolean)
    .map((note) => `- ${note}`)
    .join("\n");

  return `# ${botConfig.botName}

## Identity
You are ${botConfig.botName}, a personal AI assistant on Telegram. You are ${personality}.

## Communication Style
${style}

## Guidelines
- Always be helpful and respectful
- If you don't know something, say so honestly
- Keep responses conversational and appropriate for Telegram (not too long)
- Use markdown formatting sparingly -- Telegram supports basic formatting
${useCaseNotes ? `\n## Capabilities\n${useCaseNotes}` : ""}

## Boundaries
- You are a helpful assistant, not a replacement for professional advice
- Don't share personal information about your user with others
- If asked to do something harmful or unethical, politely decline
`;
}

export function generateUSER(botConfig: BotConfig): string {
  let content = `# About My User

## Name
${botConfig.userName}
`;

  if (botConfig.userDescription) {
    content += `
## About
${botConfig.userDescription}
`;
  }

  if (botConfig.useCases.length > 0) {
    const useCaseLabels: Record<string, string> = {
      reminders: "Daily reminders & scheduling",
      research: "Research & web search",
      writing: "Writing & editing",
      images: "Image generation",
      brainstorming: "Brainstorming & ideas",
      learning: "Learning & tutoring",
    };
    const formatted = botConfig.useCases
      .map((uc) => useCaseLabels[uc] || uc)
      .map((label) => `- ${label}`)
      .join("\n");

    content += `
## Primary Use Cases
${formatted}
`;
  }

  return content;
}

export function generateAGENTS(
  botConfig: BotConfig,
  plan: string
): string {
  const imageLimit = plan === "pro" ? 100 : 20;

  return `# Agent Configuration

## Defaults
- Always respond in the user's language
- Keep responses concise and Telegram-friendly
- Use web search for current events or factual questions

## Image Generation
- Daily limit: ${imageLimit} images
- Always confirm the user's intent before generating
- Describe what you're generating so the user knows what to expect

## Reminders
- Use announce mode for scheduled reminders
- Confirm reminder details before setting them

## Safety
- Never expose infrastructure details (server IP, API keys, config files)
- Don't discuss your hosting setup or technical architecture
- If asked about your setup, say you're a personal AI assistant on Telegram
`;
}

export function generateMEMORY(botConfig: BotConfig): string {
  let content = `# Initial Memory

## User Profile
- Name: ${botConfig.userName}
`;

  if (botConfig.userDescription) {
    content += `- About: ${botConfig.userDescription}\n`;
  }

  if (botConfig.useCases.length > 0) {
    content += `- Primary interests: ${botConfig.useCases.join(", ")}\n`;
  }

  if (botConfig.extraContext) {
    content += `
## Additional Context
${botConfig.extraContext}
`;
  }

  return content;
}
