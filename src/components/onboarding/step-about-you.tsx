"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_USER_DESCRIPTION } from "@/lib/onboarding-defaults";

interface BotConfig {
  botName: string;
  personality: string;
  customPersonality?: string;
  userName: string;
  userDescription?: string;
  useCases: string[];
  extraContext?: string;
}

interface StepAboutYouProps {
  config: BotConfig;
  onUpdate: (updates: Partial<BotConfig>) => void;
  onNext: () => void;
  onBack: () => void;
  sessionName?: string;
}

export function StepAboutYou({
  config,
  onUpdate,
  onNext,
  onBack,
  sessionName,
}: StepAboutYouProps) {
  const [userName, setUserName] = useState(
    config.userName || sessionName || "Friend"
  );
  const [userDescription, setUserDescription] = useState(
    config.userDescription || DEFAULT_USER_DESCRIPTION
  );

  const canProceed = userName.trim().length > 0;

  const handleNext = () => {
    onUpdate({
      userName: userName.trim(),
      userDescription: userDescription.trim() || undefined,
    });
    onNext();
  };

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-100">
          Tell your bot about yourself
        </h2>
        <p className="mt-3 text-lg text-gray-400">
          We wrote a starting point -- edit it to get better results.
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Help your bot personalize responses to you
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="userName">Your Name</Label>
          <Input
            id="userName"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            maxLength={100}
            className="h-12"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="userDescription">
            About You
          </Label>
          <textarea
            id="userDescription"
            className="flex min-h-[260px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={userDescription}
            onChange={(e) => setUserDescription(e.target.value)}
            maxLength={1000}
          />
          <p className="text-sm text-gray-500">
            Replace the [brackets] with your info, or edit freely.
          </p>
        </div>
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
