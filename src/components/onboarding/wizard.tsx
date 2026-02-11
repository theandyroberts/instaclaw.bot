"use client";

import { useEffect, useState, useCallback } from "react";
import { StepProvision } from "./step-provision";
import { StepTelegram } from "./step-telegram";
import { StepComplete } from "./step-complete";
import { Skeleton } from "@/components/ui/skeleton";

interface InstanceStatus {
  status: string;
  onboardingStep: string;
  telegramBotUsername: string | null;
  llmProvider: string;
  llmConfigured: boolean;
  healthStatus: string;
}

export function OnboardingWizard() {
  const [instance, setInstance] = useState<InstanceStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/instance/status");
      const data = await res.json();
      setInstance(data);
    } catch (error) {
      console.error("Failed to fetch instance status:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll during auto-steps
  useEffect(() => {
    if (!instance) return;

    const autoSteps = [
      "awaiting_provision",
      "provisioning",
      "configuring_telegram",
      "configuring_workspace",
    ];

    if (autoSteps.includes(instance.onboardingStep)) {
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [instance, fetchStatus]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="text-center text-gray-500">
        <p>No instance found. Please subscribe to a plan first.</p>
      </div>
    );
  }

  const steps = [
    "awaiting_provision",
    "provisioning",
    "awaiting_telegram_token",
    "configuring_telegram",
    "configuring_workspace",
    "complete",
  ];

  const currentStepIndex = steps.indexOf(instance.onboardingStep);

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((step) => {
          const stepMap = [0, 2, 4]; // map to actual steps
          const isActive = currentStepIndex >= stepMap[step];
          const isCurrent =
            currentStepIndex >= stepMap[step] &&
            (step === 2 || currentStepIndex < stepMap[step + 1]);
          return (
            <div key={step} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  isActive
                    ? "bg-red-600 text-white"
                    : "bg-neutral-800 text-gray-500"
                } ${isCurrent ? "ring-2 ring-red-400" : ""}`}
              >
                {step + 1}
              </div>
              {step < 2 && (
                <div
                  className={`h-0.5 w-12 ${
                    currentStepIndex > stepMap[step]
                      ? "bg-red-600"
                      : "bg-neutral-800"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      {(instance.onboardingStep === "awaiting_provision" ||
        instance.onboardingStep === "provisioning") && <StepProvision />}

      {instance.onboardingStep === "awaiting_telegram_token" && (
        <StepTelegram onComplete={fetchStatus} />
      )}

      {instance.onboardingStep === "configuring_telegram" && (
        <StepProvision
          message="Connecting your Telegram bot..."
          submessage="This usually takes about 30 seconds."
        />
      )}

      {instance.onboardingStep === "configuring_workspace" && (
        <StepProvision
          message="Setting up your AI workspace..."
          submessage="Almost there! Configuring your bot's personality and tools."
        />
      )}

      {instance.onboardingStep === "complete" && (
        <StepComplete botUsername={instance.telegramBotUsername || ""} />
      )}
    </div>
  );
}
