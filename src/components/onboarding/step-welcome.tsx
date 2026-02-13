"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

interface StepWelcomeProps {
  planName?: string;
  planPrice?: string;
  onNext: () => void;
}

export function StepWelcome({ planName, planPrice, onNext }: StepWelcomeProps) {
  return (
    <div className="mx-auto max-w-lg space-y-8 text-center">
      <div>
        <h2 className="text-3xl font-bold text-gray-100">
          Let&apos;s get you set up with your AI assistant!
        </h2>
        <p className="mt-3 text-lg text-gray-400">
          We&apos;ll walk you through a few quick steps to personalize your bot.
        </p>
      </div>

      {planName && (
        <div className="flex items-center justify-center gap-2">
          <Badge className="bg-red-600/20 text-red-400 border border-red-600/30 px-3 py-1 text-sm">
            {planName} {planPrice ? `${planPrice}/mo` : ""}
          </Badge>
          <a
            href="/#pricing"
            className="text-sm text-gray-500 hover:text-gray-300 underline"
          >
            Change plan
          </a>
        </div>
      )}

      <Button
        className="w-full h-14 text-lg"
        size="lg"
        onClick={onNext}
      >
        Continue
        <ArrowRight className="ml-2 h-5 w-5" />
      </Button>
    </div>
  );
}
