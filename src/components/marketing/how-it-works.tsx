import { UserPlus, Bot, MessageSquare } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    title: "1. Sign Up & Choose Your Plan",
    description:
      "Create your account, pick Starter ($29/mo) or Pro ($49/mo). We instantly start setting up your dedicated AI server.",
  },
  {
    icon: Bot,
    title: "2. Create Your Telegram Bot",
    description:
      "Open @BotFather on Telegram, create a new bot, and paste the token into your dashboard. Takes about 60 seconds.",
  },
  {
    icon: MessageSquare,
    title: "3. Start Chatting",
    description:
      "That's it! Open your new bot on Telegram and start chatting. Ask questions, get research help, write code -- anything.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-[#0a0a0a] px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-gray-100 md:text-4xl">
            Live in 5 Minutes. Seriously.
          </h2>
          <p className="mx-auto max-w-2xl text-gray-400">
            No servers to configure. No code to write. No Docker, no terminal, no headaches.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.title} className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-950/50">
                <step.icon className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-100">
                {step.title}
              </h3>
              <p className="text-gray-400">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
