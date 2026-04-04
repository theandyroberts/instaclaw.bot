"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Loader2, LogIn, Bot, Smile, Briefcase, Sparkles, PenLine, User, Zap, Clock, BadgeCheck } from "lucide-react";
import type { WizardState } from "@/lib/onboarding-storage";
import { saveWizardState } from "@/lib/onboarding-storage";

type BillingInterval = "monthly" | "yearly";

interface PlanPricing {
  price: string;
  period: string;
  priceId: string;
}

interface PlanInfo {
  id: string;
  name: string;
  monthly: PlanPricing;
  yearly: PlanPricing;
  features: string[];
}

const planData: Record<string, PlanInfo> = {
  standard: {
    id: "standard",
    name: "Standard",
    monthly: {
      price: "$35",
      period: "/month",
      priceId: process.env.NEXT_PUBLIC_STRIPE_STANDARD_MONTHLY_PRICE_ID || "price_standard_monthly",
    },
    yearly: {
      price: "$348",
      period: "/year",
      priceId: process.env.NEXT_PUBLIC_STRIPE_STANDARD_YEARLY_PRICE_ID || "price_standard_yearly",
    },
    features: [
      "Unlimited messaging",
      "Web browsing & research",
      "Daily reminders & scheduling",
      "Writing & coding help",
      "20 AI images per day",
      "Dedicated private server",
      "24/7 uptime",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    monthly: {
      price: "$59",
      period: "/month",
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID || "price_pro_monthly",
    },
    yearly: {
      price: "$588",
      period: "/year",
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID || "price_pro_yearly",
    },
    features: [
      "Everything in Standard",
      "Access to foundation models",
      "100 AI images per day",
      "Personal web server*",
      "Advanced AI configuration",
      "Priority support",
    ],
  },
};

const personalityLabels: Record<string, string> = {
  friendly: "Friendly & Casual",
  professional: "Professional & Concise",
  witty: "Witty & Creative",
  custom: "Custom",
};

const personalityIcons: Record<string, typeof Smile> = {
  friendly: Smile,
  professional: Briefcase,
  witty: Sparkles,
  custom: PenLine,
};

// Timezone value -> readable label
const timezoneLabels: Record<string, string> = {
  "America/New_York": "Eastern Time",
  "America/Chicago": "Central Time",
  "America/Denver": "Mountain Time",
  "America/Los_Angeles": "Pacific Time",
  "America/Anchorage": "Alaska Time",
  "Pacific/Honolulu": "Hawaii Time",
  "America/Toronto": "Toronto (ET)",
  "America/Sao_Paulo": "S\u00e3o Paulo",
  "Europe/London": "London",
  "Europe/Paris": "Paris / Berlin",
  "Europe/Moscow": "Moscow",
  "Africa/Lagos": "Lagos",
  "Africa/Johannesburg": "Johannesburg",
  "Asia/Dubai": "Dubai",
  "Asia/Kolkata": "India",
  "Asia/Singapore": "Singapore",
  "Asia/Shanghai": "China",
  "Asia/Tokyo": "Tokyo",
  "Australia/Sydney": "Sydney",
  "Pacific/Auckland": "Auckland",
};

interface PlanPickerProps {
  onCheckoutStarted: () => void;
  onBack?: () => void;
  wizardState?: WizardState | null;
  preselectedPlanId?: string;
  preselectedInterval?: BillingInterval;
}

export function PlanPicker({
  onCheckoutStarted,
  onBack,
  wizardState,
  preselectedPlanId,
  preselectedInterval,
}: PlanPickerProps) {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = planData[preselectedPlanId || "pro"] || planData.pro;
  const interval: BillingInterval = preselectedInterval || "monthly";
  const pricing = plan[interval];

  const handleGo = async () => {
    setLoading(true);
    setError(null);

    if (!isAuthenticated) {
      // Save wizard state + selected plan to localStorage, then sign in
      if (wizardState) {
        saveWizardState({ ...wizardState, selectedPriceId: pricing.priceId });
      }
      signIn("google", { callbackUrl: "/onboarding?from=auth" });
      return;
    }

    // Authenticated -- persist bot config to DB, then go to Stripe checkout
    if (wizardState) {
      try {
        await fetch("/api/user/bot-config", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            botName: wizardState.botName,
            personality: wizardState.personality,
            customPersonality: wizardState.customPersonality,
            userName: wizardState.userName,
            userDescription: wizardState.userDescription,
            timezone: wizardState.timezone,
            jobTitle: wizardState.jobTitle,
            useCases: wizardState.useCases,
            extraContext: wizardState.extraContext,
          }),
        });
      } catch {
        // Non-blocking -- continue to checkout
      }
    }

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: pricing.priceId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || `Checkout failed (${response.status})`);
        setLoading(false);
        return;
      }

      if (data.url) {
        onCheckoutStarted();
        window.location.href = data.url;
      } else {
        setError("No checkout URL returned");
        setLoading(false);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setError("Failed to start checkout. Please try again.");
      setLoading(false);
    }
  };

  // Build summary items from wizard state
  const PersonalityIcon = wizardState?.personality
    ? personalityIcons[wizardState.personality] || Sparkles
    : null;

  const monthlyEquivalent = interval === "yearly"
    ? `$${Math.round(parseInt(pricing.price.replace("$", "")) / 12)}/mo`
    : null;

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground">
          Review and Purchase
        </h2>
        <p className="mt-3 text-lg text-muted-foreground">
          Review your selection, then let&apos;s get started.
        </p>
      </div>

      {/* Plan card -- receipt style */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-bold text-foreground">{plan.name}</h3>
            <div className="text-right">
              <span className="text-3xl font-bold text-foreground">{pricing.price}</span>
              <span className="text-muted-foreground">{pricing.period}</span>
              {monthlyEquivalent && (
                <div className="text-sm text-muted-foreground">{monthlyEquivalent}</div>
              )}
            </div>
          </div>

          <ul className="space-y-2">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                <span className="text-sm text-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Bot config summary */}
      {wizardState && (wizardState.botName || wizardState.personality) && (
        <Card>
          <CardContent className="py-6">
            <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Your bot configuration
            </h3>
            <div className="space-y-3">
              {wizardState.botName && (
                <div className="flex items-center gap-3">
                  <Bot className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm text-muted-foreground">Name</span>
                  <span className="ml-auto text-sm font-medium text-foreground">
                    {wizardState.botName}
                  </span>
                </div>
              )}
              {wizardState.personality && (
                <div className="flex items-center gap-3">
                  {PersonalityIcon && <PersonalityIcon className="h-4 w-4 shrink-0 text-primary" />}
                  <span className="text-sm text-muted-foreground">Personality</span>
                  <span className="ml-auto text-sm font-medium text-foreground">
                    {wizardState.personality === "custom"
                      ? wizardState.customPersonality || "Custom"
                      : personalityLabels[wizardState.personality] || wizardState.personality}
                  </span>
                </div>
              )}
              {wizardState.userName && (
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm text-muted-foreground">Owner</span>
                  <span className="ml-auto text-sm font-medium text-foreground">
                    {wizardState.userName}
                  </span>
                </div>
              )}
              {wizardState.timezone && (
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm text-muted-foreground">Timezone</span>
                  <span className="ml-auto text-sm font-medium text-foreground">
                    {timezoneLabels[wizardState.timezone] || wizardState.timezone}
                  </span>
                </div>
              )}
              {wizardState.jobTitle && (
                <div className="flex items-center gap-3">
                  <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm text-muted-foreground">Role</span>
                  <span className="ml-auto text-sm font-medium text-foreground">
                    {wizardState.jobTitle}
                  </span>
                </div>
              )}
              {wizardState.useCases && wizardState.useCases.length > 0 && (
                <div className="flex items-start gap-3">
                  <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm text-muted-foreground">Use cases</span>
                  <span className="ml-auto text-right text-sm font-medium text-foreground">
                    {wizardState.useCases.join(", ")}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <p className="text-center text-sm text-primary">{error}</p>
      )}

      <div className="flex gap-3">
        {onBack && (
          <Button variant="outline" className="flex-1" onClick={onBack}>
            Back
          </Button>
        )}
        <Button
          className="flex-1 h-14 text-lg"
          size="lg"
          onClick={handleGo}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {isAuthenticated ? "Preparing checkout..." : "Signing in..."}
            </>
          ) : !isAuthenticated ? (
            <>
              <LogIn className="mr-2 h-5 w-5" />
              Let&apos;s Go! -- Continue with Google
            </>
          ) : (
            "Let\u2019s Go!"
          )}
        </Button>
      </div>
    </div>
  );
}
