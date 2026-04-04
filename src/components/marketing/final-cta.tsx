"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { smoothScrollTo } from "@/lib/smooth-scroll";

export function FinalCTA() {
  return (
    <section
      className="relative px-4 py-28 overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(191,245,73,0.04) 0%, rgba(235,66,3,0.06) 50%, rgba(191,245,73,0.03) 100%)",
      }}
    >
      <div className="relative mx-auto max-w-3xl text-center">
        <h2
          className="mb-8 text-4xl font-bold text-foreground md:text-5xl"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Work With an AI Teammate
        </h2>

        <p className="mb-10 text-xl text-muted-foreground leading-relaxed">
          Instead of trying to keep up with everything yourself, run a teammate that helps move your work forward.
        </p>

        <div className="mb-12 flex flex-col items-center gap-3 text-xl font-medium text-foreground">
          <span>Research faster.</span>
          <span>Monitor what matters.</span>
          <span>Publish results automatically.</span>
        </div>

        <Button
          size="lg"
          className="bg-ember hover:bg-ember/90 text-white text-lg px-12 py-7 font-semibold rounded-xl shadow-lg shadow-ember/20"
          onClick={() => smoothScrollTo("#pricing")}
        >
          Get Your AI Teammate
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </section>
  );
}
