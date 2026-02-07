"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageCircle, Zap, Shield } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-violet-50 to-white px-4 py-20 md:py-32">
      <div className="mx-auto max-w-6xl text-center">
        <div className="mb-6 inline-flex items-center rounded-full border bg-white px-4 py-1.5 text-sm text-violet-600 shadow-sm">
          <Zap className="mr-2 h-4 w-4" />
          Powered by OpenClaw -- the #1 open-source AI assistant
        </div>

        <h1 className="mb-6 text-4xl font-bold tracking-tight text-gray-900 md:text-6xl lg:text-7xl">
          Your Personal AI Assistant
          <br />
          <span className="text-violet-600">on Telegram</span>
        </h1>

        <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-600 md:text-xl">
          Get your own AI-powered assistant that lives right in Telegram.
          Research, write, code, browse the web -- all from a chat message.
          Live in 5 minutes, no technical skills needed.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button size="lg" className="text-lg px-8" asChild>
            <Link href="/sign-in">
              Get Started -- $29/mo
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="text-lg px-8" asChild>
            <Link href="#how-it-works">See How It Works</Link>
          </Button>
        </div>

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
            Setup in 5 minutes
          </div>
        </div>
      </div>
    </section>
  );
}
