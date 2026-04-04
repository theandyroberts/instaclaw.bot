"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LOOP_OPTIONS } from "@/lib/onboarding-defaults";
import { Check } from "lucide-react";

interface BotConfig {
  botName: string;
  personality: string;
  customPersonality?: string;
  userName: string;
  userDescription?: string;
  useCases: string[];
  extraContext?: string;
  loop?: string;
}

interface StepLoopProps {
  config: BotConfig;
  onUpdate: (updates: Partial<BotConfig>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepLoop({ config, onUpdate, onNext, onBack }: StepLoopProps) {
  const [selected, setSelected] = useState<string>(config.loop || "");

  const handleNext = () => {
    onUpdate({ loop: selected });
    onNext();
  };

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground">
          Choose Your Loop
        </h2>
        <p className="mt-3 text-lg text-muted-foreground">
          Your bot will check in daily to keep you moving forward.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          You can change or remove your Loop later via your bot
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {LOOP_OPTIONS.map((loop) => {
          const Icon = loop.icon;
          const isSelected = selected === loop.id;
          return (
            <button
              key={loop.id}
              type="button"
              onClick={() => setSelected(loop.id)}
              className={`relative flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                isSelected
                  ? "border-primary bg-primary/15 ring-1 ring-primary/30"
                  : "border-border bg-muted/50 hover:border-muted-foreground/30 hover:bg-muted"
              }`}
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${
                  isSelected ? "text-primary" : "text-muted-foreground"
                }`}
              />
              <div className="min-w-0 flex-1">
                <span className={`text-sm font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>
                  {loop.label}
                </span>
                <p className={`text-xs ${isSelected ? "text-primary/70" : "text-muted-foreground"}`}>{loop.description}</p>
              </div>
              {isSelected && (
                <Check className="h-5 w-5 shrink-0 text-primary" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack}>
          Back
        </Button>
        <Button
          className="flex-1"
          onClick={handleNext}
          disabled={!selected}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
