import { Search, Eye, FileBarChart } from "lucide-react";

const capabilities = [
  {
    icon: Search,
    title: "Research",
    headline: "Find information across the web automatically.",
    description:
      "Your teammate gathers sources, analyzes information, and produces useful summaries.",
  },
  {
    icon: Eye,
    title: "Monitor",
    headline: "Watch websites and data sources for updates.",
    description:
      "Your teammate keeps track of the things that matter to you and alerts you when something changes.",
  },
  {
    icon: FileBarChart,
    title: "Report",
    headline: "Turn information into clear updates and reports.",
    description:
      "Your teammate can publish results as web pages, summaries, or updates you can share.",
  },
];

export function Capabilities() {
  return (
    <section id="capabilities" className="px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <h2
            className="mb-4 text-3xl font-bold text-foreground md:text-5xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            What Your AI Teammate Can Do
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {capabilities.map((cap) => (
            <div
              key={cap.title}
              className="rounded-2xl bg-card p-10 transition-all hover:shadow-lg hover:-translate-y-1"
            >
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-lime/10">
                <cap.icon className="h-7 w-7 text-lime" />
              </div>
              <h3
                className="mb-3 text-2xl font-bold text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {cap.title}
              </h3>
              <p className="mb-3 text-base font-medium text-foreground">
                {cap.headline}
              </p>
              <p className="text-base text-muted-foreground leading-relaxed">
                {cap.description}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-12 text-center text-xl text-muted-foreground italic">
          Even when you&apos;re not working, your teammate is.
        </p>
      </div>
    </section>
  );
}
