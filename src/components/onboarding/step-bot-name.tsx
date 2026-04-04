"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw } from "lucide-react";
import { generateBotName } from "@/lib/name-generator";

interface BotConfig {
  botName: string;
  personality: string;
  customPersonality?: string;
  userName: string;
  userDescription?: string;
  useCases: string[];
  extraContext?: string;
}

interface StepBotNameProps {
  config: BotConfig;
  onUpdate: (updates: Partial<BotConfig>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepBotName({
  config,
  onUpdate,
  onNext,
  onBack,
}: StepBotNameProps) {
  const [botName, setBotName] = useState(
    config.botName || generateBotName()
  );

  const handleRegenerate = () => {
    setBotName(generateBotName());
  };

  const canProceed = botName.trim().length > 0;

  const handleNext = () => {
    onUpdate({ botName: botName.trim() });
    onNext();
  };

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground">
          Meet your bot
        </h2>
        <p className="mt-3 text-lg text-muted-foreground">
          We picked a name. Keep it or make it your own.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your bot needs a name -- you can always change it later
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            value={botName}
            onChange={(e) => setBotName(e.target.value)}
            maxLength={100}
            className="font-mono text-lg text-center h-14 text-foreground"
          />
          <button
            type="button"
            onClick={handleRegenerate}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-muted-foreground/30 hover:bg-muted hover:text-foreground"
            title="Generate a new name"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          This is your bot&apos;s display name
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack}>
          Back
        </Button>
        <Button
          className="flex-1"
          onClick={handleNext}
          disabled={!canProceed}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
