import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";

export const metadata = {
  title: "Privacy Policy | InstaClaw",
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="px-4 py-16">
        <div className="mx-auto max-w-3xl space-y-8 text-foreground">
          <div>
            <h1 className="text-3xl font-bold md:text-4xl">Privacy Policy</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Last updated: February 26, 2026
            </p>
          </div>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">1. Information We Collect</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p className="font-medium text-foreground">Account Information</p>
              <p>
                When you sign in with Google, we receive your name, email address, and profile picture. We use this to create and manage your account.
              </p>
              <p className="font-medium text-foreground">Bot Configuration</p>
              <p>
                Information you provide during setup: your bot&apos;s name, personality, use cases, and any custom instructions. This is stored in our database and used to configure your AI instance.
              </p>
              <p className="font-medium text-foreground">Payment Information</p>
              <p>
                Payment details are collected and processed directly by Stripe. We do not store your credit card number. We receive your Stripe customer ID, subscription status, and billing history.
              </p>
              <p className="font-medium text-foreground">Usage Data</p>
              <p>
                We collect basic analytics about how you interact with our website and dashboard, including pages visited and features used.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">2. Your AI Instance</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>
                Each subscriber gets a dedicated virtual machine. Your conversations with your AI assistant via Telegram are processed on your dedicated instance. We do not routinely access, monitor, or read your conversations.
              </p>
              <p>
                Conversation data, workspace files, and generated content are stored on your dedicated instance. We may access your instance for technical support, troubleshooting, or to enforce our Terms of Service and Acceptable Use Policy.
              </p>
              <p>
                Public websites you create through canvas are accessible to anyone on the internet and should not be considered private.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>Provide and maintain the Service</li>
              <li>Configure and manage your AI instance</li>
              <li>Process payments and manage subscriptions</li>
              <li>Send service-related communications (billing, maintenance, security)</li>
              <li>Improve the Service based on usage patterns</li>
              <li>Enforce our Terms of Service and Acceptable Use Policy</li>
              <li>Respond to support requests</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">4. Third-Party Services</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>We use the following third-party services that may process your data:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <span className="text-foreground">Stripe</span> — Payment processing. Subject to{" "}
                  <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Stripe&apos;s Privacy Policy</a>.
                </li>
                <li>
                  <span className="text-foreground">Google</span> — Authentication (OAuth). Subject to{" "}
                  <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google&apos;s Privacy Policy</a>.
                </li>
                <li>
                  <span className="text-foreground">DigitalOcean</span> — Infrastructure hosting for your AI instance.
                </li>
                <li>
                  <span className="text-foreground">Tailscale</span> — Encrypted networking between our systems and your instance.
                </li>
                <li>
                  <span className="text-foreground">AI Model Providers</span> (OpenRouter, Moonshot/Kimi) — Your AI assistant sends prompts to these providers to generate responses. These providers may have their own data retention policies.
                </li>
                <li>
                  <span className="text-foreground">Resend</span> — Transactional email delivery.
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">5. Data Security</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>We implement security measures to protect your data:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Each customer gets a dedicated, isolated virtual machine</li>
                <li>All inter-system communication is encrypted via Tailscale (WireGuard)</li>
                <li>AI instances run with non-root privileges</li>
                <li>Instances are protected by cloud firewalls restricting external access</li>
                <li>API keys and secrets are injected at the system level and not exposed to the AI agent directly</li>
              </ul>
              <p>
                No system is perfectly secure. While we take reasonable precautions, we cannot guarantee absolute security of your data.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">6. Data Retention</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>
                Your account data is retained as long as your account is active. If you cancel your subscription, your AI instance is terminated at the end of the billing period and instance data is deleted within 30 days.
              </p>
              <p>
                We may retain billing records and basic account information as required by law or for legitimate business purposes (e.g., fraud prevention) after account deletion.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">7. Your Rights</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>Depending on your jurisdiction, you may have the right to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data in a portable format</li>
                <li>Opt out of marketing communications</li>
              </ul>
              <p>
                To exercise any of these rights, contact us at{" "}
                <a href="mailto:support@instaclaw.bot" className="text-primary hover:underline">
                  support@instaclaw.bot
                </a>
                .
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">8. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use essential cookies for authentication and session management. We may use analytics cookies to understand how the Service is used. We do not sell your data or use tracking cookies for advertising purposes.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">9. Children</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service is not intended for anyone under 18. We do not knowingly collect personal information from minors. If we learn that we have collected data from someone under 18, we will delete it promptly.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">10. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. Material changes will be communicated via the email associated with your account. Continued use of the Service after changes constitutes acceptance.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">11. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              Questions about this Privacy Policy? Contact us at{" "}
              <a href="mailto:support@instaclaw.bot" className="text-primary hover:underline">
                support@instaclaw.bot
              </a>
              .
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
