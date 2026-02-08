import {
  Globe,
  Code,
  FileText,
  Search,
  Calendar,
  Brain,
  Shield,
  Server,
} from "lucide-react";

const features = [
  {
    icon: Search,
    title: "Research & Questions",
    description:
      "Ask anything and get detailed, thoughtful answers. Your AI reads the web, synthesizes information, and cites sources.",
  },
  {
    icon: Globe,
    title: "Web Browsing",
    description:
      "Your assistant can browse the web in real-time to find current information, read articles, and summarize content.",
  },
  {
    icon: Code,
    title: "Coding Help",
    description:
      "Get help writing, debugging, and explaining code. Supports every programming language and framework.",
  },
  {
    icon: FileText,
    title: "Writing & Editing",
    description:
      "Draft emails, articles, reports, and more. Edit and refine your writing with AI-powered suggestions.",
  },
  {
    icon: Calendar,
    title: "Task Management",
    description:
      "Set reminders, create to-do lists, and organize your schedule -- all through natural conversation.",
  },
  {
    icon: Brain,
    title: "Choose Your AI Brain",
    description:
      "Pick from top AI models: Kimi, Claude, GPT-4, Gemini, or MiniMax. Switch anytime on the Pro plan.",
  },
  {
    icon: Shield,
    title: "Private & Secure",
    description:
      "Your own dedicated server. Your data stays private. No shared infrastructure, no data mining.",
  },
  {
    icon: Server,
    title: "Always On",
    description:
      "Your AI assistant runs 24/7 on a dedicated server. No downtime, no rate limits, always ready.",
  },
];

export function Features() {
  return (
    <section id="features" className="bg-[#111111] px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-gray-100 md:text-4xl">
            Everything You Need in a Chat
          </h2>
          <p className="mx-auto max-w-2xl text-gray-400">
            Your personal AI assistant can handle research, writing, coding, and more --
            all from Telegram.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-neutral-800 bg-background p-6 transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-red-950/50">
                <feature.icon className="h-5 w-5 text-red-500" />
              </div>
              <h3 className="mb-2 font-semibold text-gray-100">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
