"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DEFAULT_EXTRA_CONTEXT } from "@/lib/onboarding-defaults";

interface BotConfig {
  botName: string;
  personality: string;
  customPersonality?: string;
  userName: string;
  userDescription?: string;
  useCases: string[];
  extraContext?: string;
}

interface StepExtraContextProps {
  config: BotConfig;
  onUpdate: (updates: Partial<BotConfig>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepExtraContext({
  config,
  onUpdate,
  onNext,
  onBack,
}: StepExtraContextProps) {
  const [extraContext, setExtraContext] = useState(
    config.extraContext || DEFAULT_EXTRA_CONTEXT
  );

  const handleNext = () => {
    onUpdate({ extraContext: extraContext.trim() || undefined });
    onNext();
  };

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-100">
          Any special instructions?
        </h2>
        <p className="mt-3 text-lg text-gray-400">
          We wrote a starting point -- tweak it or leave it as-is.
        </p>
        <p className="mt-1 text-sm text-gray-500">
          These shape your bot&apos;s default behavior and tone
        </p>
      </div>

      <div className="space-y-2">
        <textarea
          id="extraContext"
          className="flex min-h-[260px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          value={extraContext}
          onChange={(e) => setExtraContext(e.target.value)}
          maxLength={2000}
        />
        <p className="text-sm text-gray-500">
          Replace the [brackets] with your info, or edit freely.
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack}>
          Back
        </Button>
        <Button className="flex-1" onClick={handleNext}>
          Continue
        </Button>
      </div>
    </div>
  );
}
