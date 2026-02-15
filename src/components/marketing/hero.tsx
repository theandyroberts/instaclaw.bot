"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageCircle, Zap, Shield } from "lucide-react";
import { smoothScrollTo } from "@/lib/smooth-scroll";

const headlines = [
  { line1: "Get your OpenClaw Bot", line2: "Right Now!" },
  { line1: "Need a personal assistant?", line2: "Get One Today!" },
  { line1: "Your own AI on Telegram.", line2: "Live in Minutes." },
  { line1: "Skip the tech headaches.", line2: "Just Chat." },
];

export function Hero() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % headlines.length);
        setVisible(true);
      }, 600);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const { line1, line2 } = headlines[index];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/10 to-background px-4 py-24 md:py-36">
      <div className="mx-auto max-w-6xl text-center">
        <div className="mb-6 inline-flex items-center rounded-full border border-border bg-background px-4 py-1.5 text-sm text-primary shadow-sm">
          <Zap className="mr-2 h-4 w-4" />
          Powered by OpenClaw -- the #1 open-source AI assistant
        </div>

        <h1 className="mb-6 h-[5.5rem] md:h-[8rem] lg:h-[10rem] text-4xl font-bold tracking-tight text-foreground md:text-6xl lg:text-7xl">
          <span
            className="inline-block transition-all duration-500 ease-in-out"
            style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(12px)" }}
          >
            {line1}
            <br />
            <span className="text-primary">{line2}</span>
          </span>
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl">
          Avoid all technical complexity and one-click deploy your own 24/7
          active OpenClaw instance. Live in minutes, no technical skills needed.
        </p>

        <Button
          size="lg"
          className="text-lg px-10 py-6 text-base"
          onClick={() => smoothScrollTo("#pricing")}
        >
          Get Started -- $29/mo
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>

        <div className="mt-12 flex items-center justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Works with Telegram
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Your own private server
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Setup in minutes
          </div>
        </div>
      </div>
    </section>
  );
}
