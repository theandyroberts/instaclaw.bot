import { Hero } from "@/components/marketing/hero";
import { Capabilities } from "@/components/marketing/capabilities";
import { CaseStudies } from "@/components/marketing/case-studies";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Integrations } from "@/components/marketing/integrations";
import { Pricing } from "@/components/marketing/pricing";
import { FinalCTA } from "@/components/marketing/final-cta";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Capabilities />
        <CaseStudies />
        <HowItWorks />
        <Integrations />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
