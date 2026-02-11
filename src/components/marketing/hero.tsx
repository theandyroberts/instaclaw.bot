"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageCircle, Zap, Shield } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-red-950/30 to-[#0a0a0a] px-4 py-24 md:py-36">
      <div className="mx-auto max-w-6xl text-center">
        <div className="mb-6 inline-flex items-center rounded-full border border-neutral-800 bg-[#0a0a0a] px-4 py-1.5 text-sm text-red-500 shadow-sm">
          <Zap className="mr-2 h-4 w-4" />
          Powered by OpenClaw -- the #1 open-source AI assistant
        </div>

        <h1 className="mb-6 text-4xl font-bold tracking-tight text-gray-100 md:text-6xl lg:text-7xl">
          Get your OpenClaw Bot
          <br />
          <span className="text-red-500">Right Now!</span>
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-400 md:text-xl">
          Avoid all technical complexity and one-click deploy your own 24/7
          active OpenClaw instance. Live in minutes, no technical skills needed.
        </p>

        <Button size="lg" className="text-lg px-10 py-6 text-base" asChild>
          <Link href="/onboarding">
            Get Started -- $29/mo
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>

        <div className="mt-12 flex items-center justify-center gap-8 text-sm text-gray-500">
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
