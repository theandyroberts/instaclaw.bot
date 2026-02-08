"use client";

import { useEffect, useState, useCallback } from "react";
import { PlanPicker } from "./plan-picker";
import { StepProvision } from "./step-provision";
import { StepTelegram } from "./step-telegram";
import { StepLLM } from "./step-llm";
import { StepCelebration } from "./step-celebration";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CreditCard } from "lucide-react";

type FunnelStep = "plan" | "provisioning" | "telegram" | "llm" | "complete";

const stepLabels: Record<FunnelStep, string> = {
  plan: "Choose Plan",
  provisioning: "Server Setup",
  telegram: "Telegram Bot",
  llm: "AI Model",
  complete: "Ready!",
};

const stepOrder: FunnelStep[] = ["plan", "provisioning", "telegram", "llm", "complete"];

interface OnboardingFunnelProps {
  initialStep: FunnelStep;
  botUsername?: string;
  checkoutPending?: boolean;
}

export function OnboardingFunnel({ initialStep, botUsername: initialBotUsername, checkoutPending }: OnboardingFunnelProps) {
  const [currentStep, setCurrentStep] = useState<FunnelStep>(initialStep);
  const [botUsername, setBotUsername] = useState(initialBotUsername || "");
  const [waitingForPayment, setWaitingForPayment] = useState(!!checkoutPending);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/instance/status");
      if (!res.ok) return;
      const data = await res.json();

      if (data.telegramBotUsername) {
        setBotUsername(data.telegramBotUsername);
      }

      // Map onboarding step to funnel step
      const step = data.onboardingStep;
      if (["awaiting_provision", "provisioning"].includes(step)) {
        setWaitingForPayment(false);
        setCurrentStep("provisioning");
      } else if (["awaiting_telegram_token", "configuring_telegram"].includes(step)) {
        setWaitingForPayment(false);
        setCurrentStep("telegram");
      } else if (["awaiting_llm_choice", "configuring_llm"].includes(step)) {
        setWaitingForPayment(false);
        setCurrentStep("llm");
      } else if (step === "complete") {
        setWaitingForPayment(false);
        setCurrentStep("complete");
      }
    } catch {
      // Ignore -- instance may not exist yet
    }
  }, []);

  // Poll for payment processing
  useEffect(() => {
    if (!waitingForPayment) return;

    const checkBilling = async () => {
      try {
        const res = await fetch("/api/billing/status");
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "active") {
          setWaitingForPayment(false);
          setCurrentStep("provisioning");
          // Also check instance status
          fetchStatus();
        }
      } catch {
        // Keep polling
      }
    };

    checkBilling();
    const interval = setInterval(checkBilling, 3000);
    return () => clearInterval(interval);
  }, [waitingForPayment, fetchStatus]);

  // Poll during auto-progress steps
  useEffect(() => {
    if (currentStep === "provisioning") {
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [currentStep, fetchStatus]);

  const currentIndex = waitingForPayment ? 0 : stepOrder.indexOf(currentStep);

  return (
    <div className="space-y-8">
      {/* Headline */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-100 md:text-3xl">
          Let&apos;s get your bot live
        </h1>
        <p className="mt-2 text-gray-400">You&apos;re just a few steps from your own OpenClaw instance.</p>
      </div>

      {/* Progress bar */}
      <div className="flex items-center justify-between">
        {stepOrder.map((step, i) => {
          const isActive = i <= currentIndex;
          const isCurrent = i === currentIndex;
          return (
            <div key={step} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    isActive
                      ? "bg-red-600 text-white"
                      : "bg-neutral-800 text-gray-500"
                  } ${isCurrent ? "ring-2 ring-red-400 ring-offset-2 ring-offset-background" : ""}`}
                >
                  {i + 1}
                </div>
                <span className={`text-xs ${isActive ? "text-gray-300" : "text-gray-600"}`}>
                  {stepLabels[step]}
                </span>
              </div>
              {i < stepOrder.length - 1 && (
                <div
                  className={`mb-5 h-0.5 w-8 sm:w-12 ${
                    i < currentIndex ? "bg-red-600" : "bg-neutral-800"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      {waitingForPayment && (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <div className="relative mb-6">
              <CreditCard className="h-16 w-16 text-red-400" />
              <Loader2 className="absolute -bottom-1 -right-1 h-6 w-6 animate-spin text-red-500" />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-gray-100">Processing your payment...</h2>
            <p className="max-w-md text-gray-500">Hang tight -- confirming with Stripe. This usually takes just a few seconds.</p>
            <div className="mt-6 flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Please keep this page open
            </div>
          </CardContent>
        </Card>
      )}

      {!waitingForPayment && currentStep === "plan" && (
        <PlanPicker
          onCheckoutStarted={() => {
            // User will be redirected to Stripe, then back to /onboarding
          }}
        />
      )}

      {!waitingForPayment && currentStep === "provisioning" && <StepProvision />}

      {!waitingForPayment && currentStep === "telegram" && (
        <StepTelegram onComplete={fetchStatus} />
      )}

      {!waitingForPayment && currentStep === "llm" && (
        <StepLLM onComplete={fetchStatus} />
      )}

      {!waitingForPayment && currentStep === "complete" && (
        <StepCelebration botUsername={botUsername} />
      )}
    </div>
  );
}
