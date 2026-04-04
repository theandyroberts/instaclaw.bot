"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Bell,
  Search,
  PenLine,
  ImageIcon,
  Lightbulb,
  GraduationCap,
  MoreHorizontal,
  Check,
} from "lucide-react";

interface BotConfig {
  botName: string;
  personality: string;
  customPersonality?: string;
  userName: string;
  userDescription?: string;
  useCases: string[];
  extraContext?: string;
}

interface StepUseCasesProps {
  config: BotConfig;
  onUpdate: (updates: Partial<BotConfig>) => void;
  onNext: () => void;
  onBack: () => void;
}

const useCaseOptions = [
  { id: "reminders", label: "Reminders & Scheduling", icon: Bell },
  { id: "research", label: "Research & Web Search", icon: Search },
  { id: "writing", label: "Writing & Editing", icon: PenLine },
  { id: "images", label: "Image Generation", icon: ImageIcon },
  { id: "brainstorming", label: "Brainstorming & Ideas", icon: Lightbulb },
  { id: "learning", label: "Learning & Tutoring", icon: GraduationCap },
  { id: "other", label: "Other", icon: MoreHorizontal },
];

export function StepUseCases({
  config,
  onUpdate,
  onNext,
  onBack,
}: StepUseCasesProps) {
  const [selected, setSelected] = useState<string[]>(config.useCases || []);
  const [otherText, setOtherText] = useState(
    config.useCases.find(
      (uc) => !useCaseOptions.some((o) => o.id === uc)
    ) || ""
  );

  const toggleUseCase = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const effectiveUseCases = selected.includes("other") && otherText.trim()
    ? [...selected.filter((s) => s !== "other"), otherText.trim()]
    : selected.filter((s) => s !== "other" || otherText.trim());

  const canProceed =
    selected.length > 0 &&
    (!selected.includes("other") || otherText.trim().length > 0);

  const handleNext = () => {
    onUpdate({ useCases: effectiveUseCases });
    onNext();
  };

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground">
          What will you use your bot for?
        </h2>
        <p className="mt-3 text-lg text-muted-foreground">
          Pick as many as you like
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          This helps customize your bot&apos;s tools and capabilities
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {useCaseOptions.map((uc) => {
          const Icon = uc.icon;
          const isSelected = selected.includes(uc.id);
          return (
            <button
              key={uc.id}
              type="button"
              onClick={() => toggleUseCase(uc.id)}
              className={`relative flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-muted-foreground/30 hover:bg-muted"
              }`}
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${
                  isSelected ? "text-primary" : "text-muted-foreground"
                }`}
              />
              <span className="text-sm font-medium text-foreground">
                {uc.label}
              </span>
              {isSelected && (
                <Check className="absolute right-2 top-2 h-4 w-4 text-primary" />
              )}
            </button>
          );
        })}
      </div>

      {selected.includes("other") && (
        <div className="space-y-2">
          <Label htmlFor="otherUseCase">What else?</Label>
          <Input
            id="otherUseCase"
            placeholder="Describe your use case..."
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            maxLength={200}
          />
        </div>
      )}

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
