"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, ExternalLink } from "lucide-react";
import { smoothScrollTo } from "@/lib/smooth-scroll";

const caseStudies = [
  {
    name: "Jade",
    title: "Jade — Tennessee Education Legislation Tracker",
    description:
      "Jade monitors Tennessee education legislation and automatically publishes summaries of relevant bills. It continually researches the Tennessee legislative website and produces clear updates about legislation affecting early childhood education.",
    customer: "Jessica R., Knoxville Tennessee",
    quote:
      "InstaClaw is fulfilling my wildest dreams with an endlessly powerful AI bot.",
    secondQuote:
      "It feels like I'm doing things that my little $29 bot isn't meant to do.",
    siteUrl: "https://ece-tracker-jade.instaclaw.bot/",
    screenshot: "/images/ece-tracker-jade.png",
    cta: "Get a Teammate Like Jade",
  },
  {
    name: "Flora",
    title: "Flora — Research & Article Builder",
    description:
      "Flora researches complex questions and builds clear web pages explaining the answers. Instead of digging through search results, Flora gathers sources, analyzes them, and produces a well-structured article automatically.",
    siteUrl: "https://instaclaw-article-flora.instaclaw.bot",
    screenshot: "/images/instaclaw-10-reasons.png",
    cta: "Get a Teammate Like Flora",
  },
];

export function CaseStudies() {
  return (
    <section
      id="examples"
      className="relative px-4 py-24 overflow-hidden"
      style={{
        background: "linear-gradient(160deg, rgba(252,239,195,0.4) 0%, rgba(0,206,200,0.06) 60%, rgba(255,156,95,0.08) 100%)",
      }}
    >
      <div className="relative mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <h2
            className="mb-4 text-3xl font-bold text-foreground md:text-5xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Real AI Teammates Running Today
          </h2>
        </div>

        <div className="grid gap-10 md:grid-cols-2">
          {caseStudies.map((study) => (
            <div
              key={study.name}
              className="rounded-2xl bg-white border border-border overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1"
            >
              {/* Screenshot */}
              <div className="border-b border-border bg-secondary">
                <div className="flex items-center gap-1.5 px-4 py-2.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-ember/40" />
                  <div className="h-2.5 w-2.5 rounded-full bg-peach/50" />
                  <div className="h-2.5 w-2.5 rounded-full bg-teal/40" />
                  <span className="ml-3 text-xs text-muted-foreground truncate">{study.siteUrl}</span>
                </div>
                <div className="relative h-56 overflow-hidden">
                  <Image
                    src={study.screenshot}
                    alt={`${study.name} screenshot`}
                    fill
                    className="object-cover object-top"
                  />
                </div>
              </div>

              {/* Content */}
              <div className="p-8">
                <h3
                  className="mb-4 text-xl font-bold text-foreground"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {study.title}
                </h3>

                <p className="mb-6 text-base text-muted-foreground leading-relaxed">
                  {study.description}
                </p>

                {study.quote && (
                  <blockquote className="mb-4 border-l-4 border-teal pl-4">
                    <p className="text-foreground italic leading-relaxed">
                      &ldquo;{study.quote}&rdquo;
                    </p>
                    <cite className="mt-2 block text-sm text-muted-foreground not-italic">
                      — {study.customer}
                    </cite>
                  </blockquote>
                )}

                {study.secondQuote && (
                  <p className="mb-6 text-sm text-muted-foreground italic">
                    &ldquo;{study.secondQuote}&rdquo;
                  </p>
                )}

                <div className="flex items-center gap-4">
                  <Button
                    className="bg-ember hover:bg-ember/90 text-white font-semibold rounded-xl"
                    onClick={() => smoothScrollTo("#pricing")}
                  >
                    {study.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <a
                    href={study.siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-teal hover:text-teal/80 font-medium transition-colors"
                  >
                    View live site
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
