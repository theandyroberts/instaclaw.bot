import { PenLine, TrendingUp, Briefcase, Heart } from "lucide-react";

const loopExamples = [
  {
    icon: PenLine,
    title: "Better Writer",
    description:
      "Daily writing exercises tailored to your goals. Your AI reviews your drafts and suggests what to work on next.",
  },
  {
    icon: TrendingUp,
    title: "Grow My Business",
    description:
      "A daily actionable task based on your business goals. Specific, achievable, and always moving you forward.",
  },
  {
    icon: Briefcase,
    title: "Work Assistant",
    description:
      "Morning priorities based on your ongoing projects. Your AI tracks deadlines and keeps you focused.",
  },
  {
    icon: Heart,
    title: "Better Habits",
    description:
      "Daily check-ins on your health and habit goals. Gentle accountability with encouragement built in.",
  },
];

export function Loops() {
  return (
    <section className="px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">
            Loops
          </p>
          <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
            Your Daily AI Routine
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Not just reactive -- your AI starts the conversation. Pick a Loop
            and get a personalized check-in every morning that keeps you on
            track.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {loopExamples.map((loop) => (
            <div
              key={loop.title}
              className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <loop.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold text-foreground">
                {loop.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {loop.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
