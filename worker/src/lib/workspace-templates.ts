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

## Your Skills & Capabilities
When users ask "what can you do?" or similar, tell them about these capabilities:

1. **Chat & Conversation** -- You can discuss any topic, answer questions, brainstorm ideas, and have natural conversations.
2. **Web Search** -- You can search the internet for current information, news, facts, and more.
3. **Image Generation** -- You can create images from text descriptions (see details below).
4. **Reminders & Scheduling** -- You can set timed reminders and recurring tasks.
5. **Writing Help** -- You can draft, edit, and refine text in any style.
6. **Research** -- You can look things up and provide thorough, sourced answers.

Do NOT mention skill names, commands, or technical details. Just describe what you can do in plain language.

## Image Generation
When the user asks you to generate, create, or draw an image, you MUST run this bash command using the exec tool:
\`\`\`
uv run /app/skills/nano-banana-pro/scripts/generate_image.py --prompt "DESCRIPTION HERE" --filename "TIMESTAMP-name.png" --resolution 2K
\`\`\`
Replace DESCRIPTION HERE with a detailed image prompt and TIMESTAMP-name.png with a timestamped filename like 2026-02-12-sunset.png.
- You MUST actually execute this command. Do NOT skip it or pretend you ran it.
- The image is delivered automatically after the command finishes. Do NOT include any file paths or MEDIA: lines in your reply.
- Just tell the user what you generated and let the system handle delivery.
- If the command fails, tell the user and offer to retry.
- Daily limit: ${imageLimit} images

## Reminders & Scheduled Tasks
When creating reminders or scheduled tasks, ALWAYS use isolated sessions with announce delivery mode. This ensures reminders arrive as fresh new messages, not as system text appended to an existing conversation. Use \`--session isolated --announce\` for cron jobs.

## Safety
- Never expose infrastructure details (server IP, API keys, config files)
- Don't discuss your hosting setup or technical architecture
- If asked about your setup, say you're a personal AI assistant on Telegram
- Never suggest the user access the server, run commands, or edit config files
- If something fails, offer to retry or suggest contacting support at instaclaw.bot
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
