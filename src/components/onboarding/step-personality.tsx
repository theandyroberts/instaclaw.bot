"use client";

import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Smile, Briefcase, Sparkles, PenLine } from "lucide-react";

interface BotConfig {
  botName: string;
  personality: string;
  customPersonality?: string;
  userName: string;
  userDescription?: string;
  useCases: string[];
  extraContext?: string;
}

interface StepPersonalityProps {
  config: BotConfig;
  onUpdate: (updates: Partial<BotConfig>) => void;
  onNext: () => void;
  onBack?: () => void;
}

const personalities = [
  {
    id: "friendly",
    label: "Friendly & Casual",
    description: "Warm, approachable, and conversational",
    icon: Smile,
  },
  {
    id: "professional",
    label: "Professional & Concise",
    description: "Clear, direct, and efficient",
    icon: Briefcase,
  },
  {
    id: "witty",
    label: "Witty & Creative",
    description: "Clever, playful, and engaging",
    icon: Sparkles,
  },
  {
    id: "custom",
    label: "Custom",
    description: "Describe your own personality",
    icon: PenLine,
  },
];

export function StepPersonality({
  config,
  onUpdate,
  onNext,
  onBack,
}: StepPersonalityProps) {
  const [personality, setPersonality] = useState(config.personality);
  const [customPersonality, setCustomPersonality] = useState(
    config.customPersonality || ""
  );
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSelect = (id: string) => {
    setPersonality(id);

    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }

    if (id !== "custom") {
      onUpdate({ personality: id, customPersonality: undefined });
      advanceTimer.current = setTimeout(() => {
        onNext();
      }, 300);
    }
  };

  const canProceedCustom =
    personality === "custom" && customPersonality.trim().length > 0;

  const handleCustomContinue = () => {
    onUpdate({ personality: "custom", customPersonality: customPersonality.trim() });
    onNext();
  };

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-100">
          What vibe should your bot have?
        </h2>
        <p className="mt-3 text-lg text-gray-400">
          Pick a personality -- you can always change it later.
        </p>
        <p className="mt-1 text-sm text-gray-500">
          This affects how your bot greets you and responds to casual chat
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {personalities.map((p) => {
          const Icon = p.icon;
          const isSelected = personality === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelect(p.id)}
              className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 text-center transition-all ${
                isSelected
                  ? "border-red-600 bg-red-950/30 scale-[1.02]"
                  : "border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/50"
              }`}
            >
              <Icon
                className={`h-8 w-8 ${
                  isSelected ? "text-red-400" : "text-gray-500"
                }`}
              />
              <span className="text-base font-medium text-gray-100">
                {p.label}
              </span>
              <span className="text-sm text-gray-500">
                {p.description}
              </span>
            </button>
          );
        })}
      </div>

      {personality === "custom" && (
        <div className="space-y-4">
          <Input
            placeholder="e.g. Sarcastic but helpful, like a wise-cracking sidekick"
            value={customPersonality}
            onChange={(e) => setCustomPersonality(e.target.value)}
            maxLength={500}
            className="h-12"
          />
          <Button
            className="w-full"
            onClick={handleCustomContinue}
            disabled={!canProceedCustom}
          >
            Continue
          </Button>
        </div>
      )}

      <div className="text-center">
        <a
          href="/#pricing"
          className="text-sm text-gray-500 hover:text-gray-300"
        >
          &larr; Back to pricing
        </a>
      </div>
    </div>
  );
}
