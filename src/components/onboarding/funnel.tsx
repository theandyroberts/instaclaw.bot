"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { PlanPicker } from "./plan-picker";
import { StepProvision } from "./step-provision";
import { StepTelegram } from "./step-telegram";
import { StepCelebration } from "./step-celebration";
import { StepPersonality } from "./step-personality";
import { StepAboutYou } from "./step-about-you";
import { StepUseCases } from "./step-use-cases";
import { StepExtraContext } from "./step-extra-context";
import { StepBotName } from "./step-bot-name";
import { StepWelcome } from "./step-welcome";
import { StepTransition } from "./step-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard } from "lucide-react";
import {
  loadWizardState,
  saveWizardState,
  clearWizardState,
  loadSelectedPlan,
  type WizardState,
  type SelectedPlan,
} from "@/lib/onboarding-storage";

type FunnelStep =
  | "welcome"
  | "personality"
  | "use-cases"
  | "bot-name"
  | "extra-context"
  | "about-you"
  | "plan"
  | "provisioning"
  | "telegram"
  | "complete";

// Wizard steps (pre-auth) in order
const wizardSteps: FunnelStep[] = [
  "welcome",
  "personality",
  "use-cases",
  "bot-name",
  "extra-context",
  "about-you",
  "plan",
];

// Step metadata for numbered progress (excludes welcome and plan)
const stepMeta: { key: FunnelStep; label: string; description: string }[] = [
  { key: "personality", label: "Personality", description: "Choose your bot's vibe" },
  { key: "use-cases", label: "Use Cases", description: "What will your bot help with?" },
  { key: "bot-name", label: "Name", description: "Give your bot an identity" },
  { key: "extra-context", label: "Instructions", description: "Customize how it behaves" },
  { key: "about-you", label: "About You", description: "Help your bot know you" },
  { key: "plan", label: "Plan", description: "Choose your plan" },
];

// Post-auth progress segments
const progressSegments = [
  { label: "Server Setup", steps: ["provisioning"] as FunnelStep[] },
  { label: "Telegram Bot", steps: ["telegram"] as FunnelStep[] },
  { label: "Ready!", steps: ["complete"] as FunnelStep[] },
];

interface BotConfig {
  botName: string;
  personality: string;
  customPersonality?: string;
  userName: string;
  userDescription?: string;
  useCases: string[];
  extraContext?: string;
}

const defaultBotConfig: BotConfig = {
  botName: "",
  personality: "",
  userName: "",
  useCases: [],
};

interface OnboardingFunnelProps {
  initialStep: FunnelStep;
  botUsername?: string;
  checkoutPending?: boolean;
  initialBotConfig?: BotConfig | null;
  sessionName?: string;
  isAuthenticated: boolean;
  justSignedIn: boolean;
  onClose?: () => void;
}

export function OnboardingFunnel({
  initialStep,
  botUsername: initialBotUsername,
  checkoutPending,
  initialBotConfig,
  sessionName,
  isAuthenticated,
  justSignedIn,
  onClose,
}: OnboardingFunnelProps) {
  const [currentStep, setCurrentStep] = useState<FunnelStep>(initialStep);
  const [botUsername, setBotUsername] = useState(initialBotUsername || "");
  const [waitingForPayment, setWaitingForPayment] = useState(!!checkoutPending);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan | null>(null);
  const [botConfig, setBotConfig] = useState<BotConfig>(() => {
    // Priority: DB config > localStorage > defaults
    if (initialBotConfig) return initialBotConfig;
    if (typeof window !== "undefined") {
      const saved = loadWizardState();
      if (saved) {
        return {
          botName: saved.botName || "",
          personality: saved.personality || "",
          customPersonality: saved.customPersonality,
          userName: saved.userName || "",
          userDescription: saved.userDescription,
          useCases: saved.useCases || [],
          extraContext: saved.extraContext,
        };
      }
    }
    return defaultBotConfig;
  });

  const justSignedInHandled = useRef(false);

  // Load selected plan from localStorage on mount
  useEffect(() => {
    const plan = loadSelectedPlan();
    if (plan) {
      setSelectedPlan(plan);
    }
  }, []);

  const updateBotConfig = (updates: Partial<BotConfig>) => {
    setBotConfig((prev) => ({ ...prev, ...updates }));
  };

  // Save wizard state to localStorage on every step change (pre-auth only)
  const persistToLocalStorage = useCallback(
    (config: BotConfig, step: FunnelStep) => {
      if (isAuthenticated && !justSignedIn) return;
      saveWizardState({
        personality: config.personality,
        customPersonality: config.customPersonality,
        useCases: config.useCases,
        botName: config.botName,
        extraContext: config.extraContext,
        userName: config.userName,
        userDescription: config.userDescription,
        currentStep: step,
        selectedPlanName: selectedPlan?.name,
        selectedPlanPrice: selectedPlan?.price,
      });
    },
    [isAuthenticated, justSignedIn, selectedPlan]
  );

  // Navigate forward
  const goNext = useCallback(
    (from: FunnelStep) => {
      const idx = wizardSteps.indexOf(from);
      if (idx >= 0 && idx < wizardSteps.length - 1) {
        const next = wizardSteps[idx + 1];
        setDirection("forward");
        setCurrentStep(next);
      }
    },
    []
  );

  // Navigate back
  const goBack = useCallback(
    (from: FunnelStep) => {
      const idx = wizardSteps.indexOf(from);
      if (idx > 0) {
        const prev = wizardSteps[idx - 1];
        setDirection("back");
        setCurrentStep(prev);
      }
    },
    []
  );

  // Persist on step transitions
  useEffect(() => {
    persistToLocalStorage(botConfig, currentStep);
  }, [currentStep, botConfig, persistToLocalStorage]);

  // justSignedIn effect: read localStorage -> save to DB -> redirect to Stripe
  useEffect(() => {
    if (!justSignedIn || !isAuthenticated || justSignedInHandled.current) return;
    justSignedInHandled.current = true;

    const saved = loadWizardState();
    if (!saved) return;

    const run = async () => {
      // Persist bot config to DB
      const configPayload = {
        botName: saved.botName,
        personality: saved.personality,
        customPersonality: saved.customPersonality,
        userName: saved.userName,
        userDescription: saved.userDescription,
        useCases: saved.useCases,
        extraContext: saved.extraContext,
      };

      try {
        await fetch("/api/user/bot-config", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(configPayload),
        });
      } catch {
        // Non-blocking -- continue to checkout anyway
      }

      // If they had a plan selected, go straight to Stripe
      if (saved.selectedPriceId) {
        try {
          const res = await fetch("/api/billing/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ priceId: saved.selectedPriceId }),
          });
          const data = await res.json();
          if (data.url) {
            clearWizardState();
            window.location.href = data.url;
            return;
          }
        } catch {
          // Fall through to plan picker
        }
      }

      clearWizardState();
      // Update local state from saved config
      setBotConfig({
        botName: saved.botName || "",
        personality: saved.personality || "",
        customPersonality: saved.customPersonality,
        userName: saved.userName || "",
        userDescription: saved.userDescription,
        useCases: saved.useCases || [],
        extraContext: saved.extraContext,
      });
      setCurrentStep("plan");
    };

    run();
  }, [justSignedIn, isAuthenticated]);

  // Initialize from localStorage for unauthenticated users
  useEffect(() => {
    if (isAuthenticated || initialBotConfig) return;
    const saved = loadWizardState();
    if (saved?.currentStep) {
      const step = saved.currentStep as FunnelStep;
      if (wizardSteps.includes(step)) {
        setCurrentStep(step);
      }
    }
  }, [isAuthenticated, initialBotConfig]);

  // beforeunload warning for unauthenticated users past welcome/personality
  useEffect(() => {
    if (isAuthenticated) return;
    if (currentStep === "welcome" || currentStep === "personality") return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isAuthenticated, currentStep]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/instance/status");
      if (!res.ok) return;
      const data = await res.json();

      if (data.telegramBotUsername) {
        setBotUsername(data.telegramBotUsername);
      }

      const step = data.onboardingStep;
      if (["awaiting_provision", "provisioning"].includes(step)) {
        setWaitingForPayment(false);
        setCurrentStep("provisioning");
      } else if (["awaiting_telegram_token", "configuring_telegram"].includes(step)) {
        setWaitingForPayment(false);
        setCurrentStep("telegram");
      } else if (step === "configuring_workspace") {
        setWaitingForPayment(false);
        setCurrentStep("telegram");
      } else if (step === "complete") {
        setWaitingForPayment(false);
        setCurrentStep("complete");
      }
    } catch {
      // Ignore
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
    if (currentStep === "provisioning" || currentStep === "telegram") {
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [currentStep, fetchStatus]);

  // UI state
  const wizardIndex = wizardSteps.indexOf(currentStep);
  const isInWizard = wizardIndex >= 0;
  const isPostAuth = ["provisioning", "telegram", "complete"].includes(currentStep);
  const showNumberedProgress = isInWizard && currentStep !== "welcome" && !waitingForPayment;

  // Find the current step in stepMeta for numbered progress
  const currentStepMetaIndex = stepMeta.findIndex((s) => s.key === currentStep);

  // Post-auth progress segment
  const activeSegmentIndex = progressSegments.findIndex((seg) =>
    seg.steps.includes(waitingForPayment ? "provisioning" : currentStep)
  );

  // Build current wizard state for plan-picker localStorage save
  const currentWizardState: WizardState = {
    personality: botConfig.personality,
    customPersonality: botConfig.customPersonality,
    useCases: botConfig.useCases,
    botName: botConfig.botName,
    extraContext: botConfig.extraContext,
    userName: botConfig.userName,
    userDescription: botConfig.userDescription,
    currentStep,
    selectedPlanName: selectedPlan?.name,
    selectedPlanPrice: selectedPlan?.price,
  };

  return (
    <div className="space-y-8">
      {/* Plan badge (shown during wizard steps, not welcome) */}
      {showNumberedProgress && selectedPlan && (
        <div className="flex justify-center">
          <Badge className="bg-red-600/20 text-red-400 border border-red-600/30 px-3 py-1 text-sm">
            {selectedPlan.name} {selectedPlan.price}/mo
          </Badge>
        </div>
      )}

      {/* Numbered wizard progress (steps 1-6, excludes welcome) */}
      {showNumberedProgress && (
        <div className="flex items-center justify-center gap-1 sm:gap-2">
          {stepMeta.map((meta, i) => {
            const isCompleted = i < currentStepMetaIndex;
            const isCurrent = i === currentStepMetaIndex;
            return (
              <div key={meta.key} className="flex items-center gap-1 sm:gap-2">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-xs sm:text-sm font-medium transition-colors ${
                      isCompleted
                        ? "bg-red-600 text-white"
                        : isCurrent
                          ? "bg-red-600 text-white ring-2 ring-red-400 ring-offset-2 ring-offset-background"
                          : "bg-neutral-800 text-gray-500"
                    }`}
                  >
                    {i + 1}
                  </div>
                  {/* Show label only for current step on mobile, all on desktop */}
                  <span
                    className={`text-[10px] sm:text-xs whitespace-nowrap ${
                      isCurrent
                        ? "text-gray-300"
                        : isCompleted
                          ? "text-gray-400 hidden sm:block"
                          : "text-gray-600 hidden sm:block"
                    }`}
                  >
                    {isCurrent ? meta.description : meta.label}
                  </span>
                </div>
                {i < stepMeta.length - 1 && (
                  <div
                    className={`mb-5 h-0.5 w-4 sm:w-6 ${
                      isCompleted ? "bg-red-600" : "bg-neutral-800"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Post-auth numbered progress bar */}
      {isPostAuth && !waitingForPayment && (
        <div className="flex items-center justify-center gap-2">
          {progressSegments.map((seg, i) => {
            const isActive = i <= activeSegmentIndex;
            const isCurrent = i === activeSegmentIndex;
            return (
              <div key={seg.label} className="flex items-center gap-2">
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
                  <span
                    className={`text-xs ${
                      isActive ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    {seg.label}
                  </span>
                </div>
                {i < progressSegments.length - 1 && (
                  <div
                    className={`mb-5 h-0.5 w-8 sm:w-12 ${
                      i < activeSegmentIndex ? "bg-red-600" : "bg-neutral-800"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Payment processing state */}
      {waitingForPayment && (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <div className="relative mb-6">
              <CreditCard className="h-16 w-16 text-red-400" />
              <Loader2 className="absolute -bottom-1 -right-1 h-6 w-6 animate-spin text-red-500" />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-gray-100">
              Processing your payment...
            </h2>
            <p className="max-w-md text-gray-500">
              Hang tight -- confirming with Stripe. This usually takes just a
              few seconds.
            </p>
            <div className="mt-6 flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Please keep this page open
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step content with slide transitions */}
      {!waitingForPayment && currentStep === "welcome" && (
        <StepTransition stepKey="welcome" direction={direction}>
          <StepWelcome
            planName={selectedPlan?.name}
            planPrice={selectedPlan?.price}
            onNext={() => goNext("welcome")}
            onClose={onClose}
          />
        </StepTransition>
      )}

      {!waitingForPayment && currentStep === "personality" && (
        <StepTransition stepKey="personality" direction={direction}>
          <StepPersonality
            config={botConfig}
            onUpdate={updateBotConfig}
            onNext={() => goNext("personality")}
            onBack={() => goBack("personality")}
          />
        </StepTransition>
      )}

      {!waitingForPayment && currentStep === "use-cases" && (
        <StepTransition stepKey="use-cases" direction={direction}>
          <StepUseCases
            config={botConfig}
            onUpdate={updateBotConfig}
            onNext={() => goNext("use-cases")}
            onBack={() => goBack("use-cases")}
          />
        </StepTransition>
      )}

      {!waitingForPayment && currentStep === "bot-name" && (
        <StepTransition stepKey="bot-name" direction={direction}>
          <StepBotName
            config={botConfig}
            onUpdate={updateBotConfig}
            onNext={() => goNext("bot-name")}
            onBack={() => goBack("bot-name")}
          />
        </StepTransition>
      )}

      {!waitingForPayment && currentStep === "extra-context" && (
        <StepTransition stepKey="extra-context" direction={direction}>
          <StepExtraContext
            config={botConfig}
            onUpdate={updateBotConfig}
            onNext={() => goNext("extra-context")}
            onBack={() => goBack("extra-context")}
          />
        </StepTransition>
      )}

      {!waitingForPayment && currentStep === "about-you" && (
        <StepTransition stepKey="about-you" direction={direction}>
          <StepAboutYou
            config={botConfig}
            onUpdate={updateBotConfig}
            onNext={() => goNext("about-you")}
            onBack={() => goBack("about-you")}
            sessionName={sessionName}
          />
        </StepTransition>
      )}

      {!waitingForPayment && currentStep === "plan" && (
        <StepTransition stepKey="plan" direction={direction}>
          <PlanPicker
            onCheckoutStarted={() => {
              // User will be redirected to Stripe, then back to /onboarding
            }}
            wizardState={currentWizardState}
            preselectedPlanId={selectedPlan?.id}
          />
        </StepTransition>
      )}

      {!waitingForPayment && currentStep === "provisioning" && (
        <StepProvision botConfig={botConfig} onComplete={fetchStatus} />
      )}

      {!waitingForPayment && currentStep === "telegram" && (
        <StepTelegram onComplete={fetchStatus} />
      )}

      {!waitingForPayment && currentStep === "complete" && (
        <StepCelebration botUsername={botUsername} />
      )}
    </div>
  );
}
