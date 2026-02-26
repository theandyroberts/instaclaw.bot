import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";

export const metadata = {
  title: "Acceptable Use Policy | InstaClaw",
};

export default function AcceptableUsePage() {
  return (
    <>
      <Navbar />
      <main className="px-4 py-16">
        <div className="mx-auto max-w-3xl space-y-8 text-foreground">
          <div>
            <h1 className="text-3xl font-bold md:text-4xl">Acceptable Use Policy</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Last updated: February 26, 2026
            </p>
          </div>

          <section className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              This Acceptable Use Policy (&quot;AUP&quot;) governs your use of InstaClaw and the AI assistants we host on your behalf. It supplements our{" "}
              <a href="/terms" className="text-primary hover:underline">Terms of Service</a>.
              Violations may result in suspension or termination of your account without refund.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">1. You Are Responsible for Your Bot</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your AI assistant acts on your behalf. You are responsible for its configuration, instructions, and the actions it takes — including content it generates, messages it sends, websites it publishes, and external services it interacts with. &quot;The AI did it&quot; is not a defense.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">2. Prohibited Content</h2>
            <p className="text-muted-foreground leading-relaxed">
              You may not use the Service to create, store, or distribute:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>Content that exploits or harms minors in any way</li>
              <li>Non-consensual intimate imagery</li>
              <li>Content that promotes violence, terrorism, or self-harm</li>
              <li>Hate speech targeting individuals or groups based on protected characteristics</li>
              <li>Content that infringes on intellectual property rights</li>
              <li>Malware, viruses, or other harmful code</li>
              <li>Deceptive content designed to impersonate real people or organizations</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">3. Prohibited Activities</h2>
            <p className="text-muted-foreground leading-relaxed">
              You may not use the Service to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>Send spam, unsolicited messages, or bulk automated communications</li>
              <li>Scrape, harvest, or collect personal information about others without consent</li>
              <li>Conduct phishing, social engineering, or fraud</li>
              <li>Attack, probe, or scan other systems or networks</li>
              <li>Mine cryptocurrency or run computationally abusive workloads</li>
              <li>Circumvent security controls, access restrictions, or rate limits</li>
              <li>Resell or redistribute the Service without authorization</li>
              <li>Operate the AI in a way that violates the terms of underlying AI model providers (OpenRouter, Moonshot/Kimi)</li>
              <li>Attempt to access other customers&apos; instances or data</li>
              <li>Use the Service for any activity that violates applicable laws or regulations</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">4. Public Websites</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>
                Websites published through InstaClaw&apos;s canvas feature are publicly accessible on the internet. You are responsible for all content on your public sites.
              </p>
              <p>Public sites may not:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Impersonate other businesses or individuals</li>
                <li>Host phishing pages or deceptive login forms</li>
                <li>Distribute malware or exploits</li>
                <li>Serve as redirects for spam or advertising schemes</li>
                <li>Violate any of the prohibited content rules above</li>
              </ul>
              <p>
                We reserve the right to take down public sites that violate this policy without prior notice.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">5. Resource Limits</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>
                Each plan includes specific resource allocations. We may enforce fair-use limits on AI model usage, storage, bandwidth, and compute to ensure quality for all customers.
              </p>
              <p>
                Excessive use that degrades the experience for other users may result in throttling or a request to upgrade your plan.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">6. Monitoring and Enforcement</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>
                We do not proactively monitor conversations or content. However, we may investigate when we receive reports of abuse, observe unusual system behavior, or are required to by law.
              </p>
              <p>
                If we determine that a violation has occurred, we may:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Issue a warning and request remediation</li>
                <li>Remove specific content or take down public sites</li>
                <li>Suspend your AI instance temporarily</li>
                <li>Terminate your account without refund</li>
                <li>Report illegal activity to law enforcement</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">7. Reporting Violations</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you become aware of content or activity that violates this policy, please report it to{" "}
              <a href="mailto:support@instaclaw.bot" className="text-primary hover:underline">
                support@instaclaw.bot
              </a>
              . Include as much detail as possible, including URLs and screenshots where applicable.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">8. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this AUP to address new risks or clarify expectations. Material changes will be communicated via email. Continued use constitutes acceptance.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
