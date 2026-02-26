import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";

export const metadata = {
  title: "Terms of Service | InstaClaw",
};

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="px-4 py-16">
        <div className="mx-auto max-w-3xl space-y-8 text-foreground">
          <div>
            <h1 className="text-3xl font-bold md:text-4xl">Terms of Service</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Last updated: February 26, 2026
            </p>
          </div>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">1. Agreement to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using InstaClaw (&quot;Service&quot;), operated by InstaClaw (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              InstaClaw is a managed hosting platform that provides personal AI assistants powered by OpenClaw. Each subscriber receives a dedicated virtual machine running an AI agent accessible via Telegram. The Service includes AI-powered task execution, web research, image generation, and the ability to create and host public websites.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">3. Accounts</h2>
            <p className="text-muted-foreground leading-relaxed">
              You must sign in using a valid Google account. You are responsible for all activity under your account. Each account is limited to one active AI instance per subscription. You must be at least 18 years old to use the Service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">4. Subscriptions and Billing</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>
                The Service is offered on a monthly subscription basis. Payments are processed through Stripe. By subscribing, you authorize recurring monthly charges to your payment method.
              </p>
              <p>
                Prices are listed on our website and may change with 30 days&apos; notice. Subscriptions renew automatically unless canceled before the next billing cycle. There are no refunds for partial months.
              </p>
              <p>
                If payment fails, your AI instance may be suspended. Instances suspended for non-payment for more than 30 days may be terminated and data deleted.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">5. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your use of the Service is subject to our{" "}
              <a href="/acceptable-use" className="text-primary hover:underline">
                Acceptable Use Policy
              </a>
              , which is incorporated into these Terms. Violations may result in immediate suspension or termination without refund.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">6. User Content</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>
                You retain ownership of content you create through the Service, including bot configurations, workspace files, and public websites hosted via canvas. You grant us a limited license to host and serve this content as necessary to operate the Service.
              </p>
              <p>
                You are solely responsible for content your AI assistant generates, publishes, or shares — including public websites. We do not review or moderate AI-generated content proactively, but we reserve the right to remove content that violates these Terms or our Acceptable Use Policy.
              </p>
              <p>
                Public websites created through the Service are accessible to anyone on the internet. You are responsible for ensuring published content complies with applicable laws.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">7. AI-Generated Output</h2>
            <p className="text-muted-foreground leading-relaxed">
              AI assistants may produce inaccurate, incomplete, or inappropriate output. You acknowledge that AI output should not be relied upon as professional, legal, medical, or financial advice. You are responsible for reviewing and verifying any AI-generated content before acting on it or publishing it.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">8. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service integrates with third-party providers including AI model providers (OpenRouter, Moonshot/Kimi), infrastructure providers (DigitalOcean, Tailscale), and payment processing (Stripe). Your use of the Service is also subject to the terms and policies of these providers. We are not responsible for the availability, accuracy, or conduct of third-party services.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">9. Service Availability</h2>
            <p className="text-muted-foreground leading-relaxed">
              We strive to maintain high availability but do not guarantee uninterrupted service. We may perform maintenance, updates, or modifications that temporarily affect availability. We are not liable for downtime, data loss, or service interruptions.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">10. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, INSTACLAW SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES, ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">11. Indemnification</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to indemnify and hold harmless InstaClaw, its officers, employees, and agents from any claims, damages, losses, or expenses (including legal fees) arising from your use of the Service, your content, websites you publish, or your violation of these Terms.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">12. Termination</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>
                You may cancel your subscription at any time through the dashboard. Your instance will remain active until the end of the current billing period.
              </p>
              <p>
                We may suspend or terminate your account immediately if you violate these Terms or the Acceptable Use Policy. Upon termination, your AI instance will be shut down and your data deleted within 30 days.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">13. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update these Terms from time to time. Material changes will be communicated via the email associated with your account. Continued use of the Service after changes take effect constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">14. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms are governed by the laws of the State of California, without regard to conflict of law principles. Any disputes shall be resolved in the courts of San Francisco County, California.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">15. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              Questions about these Terms? Contact us at{" "}
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
