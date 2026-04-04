import { Shield, RefreshCw, Sparkles } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "OpenClaw, Hosted and Ready",
    description:
      "Each AI teammate is a full OpenClaw instance running on a secure, dedicated server. No server setup, no Docker, no technical configuration required.",
  },
  {
    icon: RefreshCw,
    title: "Continuous Work Loops",
    description:
      "Your OpenClaw teammate keeps working toward the goal you gave it. It continues researching, monitoring, and updating results over time.",
  },
  {
    icon: Sparkles,
    title: "Automatic AI Brain Upgrades",
    description:
      "Every two hours InstaClaw evaluates the best free AI models available and upgrades your OpenClaw instance automatically. Your bot keeps getting smarter without you managing anything.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <h2
            className="mb-4 text-3xl font-bold text-foreground md:text-5xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            OpenClaw in the Cloud, Built for You
          </h2>
        </div>

        <div className="grid gap-10 md:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-teal/10">
                <feature.icon className="h-10 w-10 text-teal" />
              </div>
              <h3
                className="mb-4 text-xl font-bold text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {feature.title}
              </h3>
              <p className="text-base text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
