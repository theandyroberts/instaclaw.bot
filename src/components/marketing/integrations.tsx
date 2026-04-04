const integrations = [
  { name: "Gmail", color: "#EA4335", icon: "M" },
  { name: "Calendar", color: "#4285F4", icon: "C" },
  { name: "GitHub", color: "#ffffff", icon: "G" },
  { name: "Notion", color: "#ffffff", icon: "N" },
  { name: "Linear", color: "#5E6AD2", icon: "L" },
  { name: "Jira", color: "#2684FF", icon: "J" },
  { name: "Figma", color: "#F24E1E", icon: "F" },
  { name: "Docs", color: "#4285F4", icon: "D" },
  { name: "Drive", color: "#34A853", icon: "D" },
  { name: "Trello", color: "#0079BF", icon: "T" },
  { name: "HubSpot", color: "#FF7A59", icon: "H" },
  { name: "Stripe", color: "#635BFF", icon: "S" },
  { name: "Slack", color: "#E01E5A", icon: "S" },
  { name: "Asana", color: "#F06A6A", icon: "A" },
  { name: "Sheets", color: "#34A853", icon: "S" },
];

function IntegrationPill({ name, color }: { name: string; color: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground">
      <span
        className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold"
        style={{ backgroundColor: color, color: color === "#ffffff" ? "#000" : "#fff" }}
      >
        {name[0]}
      </span>
      {name}
    </div>
  );
}

export function Integrations() {
  return (
    <section className="bg-background px-4 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <h2
            className="mb-4 text-3xl font-bold text-foreground md:text-4xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Connect Your Favorite Apps
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Your AI teammate works with 800+ apps. Connect your tools and let your bot take action — send emails, manage tasks, update CRMs, and more.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {integrations.map((app) => (
            <IntegrationPill key={app.name} name={app.name} color={app.color} />
          ))}
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-2.5 text-sm font-medium text-muted-foreground">
            +800 more
          </div>
        </div>
      </div>
    </section>
  );
}
