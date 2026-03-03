import { Hero } from "@/components/marketing/hero";
import { Features } from "@/components/marketing/features";
import { Loops } from "@/components/marketing/loops";
import { Pricing } from "@/components/marketing/pricing";
import { FAQ } from "@/components/marketing/faq";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Loops />
        <Pricing />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
