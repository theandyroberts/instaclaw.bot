"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, LogIn } from "lucide-react";
import type { WizardState } from "@/lib/onboarding-storage";
import { saveWizardState } from "@/lib/onboarding-storage";

const plans = [
  {
    name: "Starter",
    description: "Your personal AI assistant on Telegram",
    price: "$29",
    period: "/month",
    features: [
      "Unlimited messaging",
      "Web browsing & research",
      "Daily reminders & scheduling",
      "Writing & coding help",
      "20 AI images per day",
      "Dedicated private server",
      "24/7 uptime",
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || "price_starter",
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Pro",
    description: "Premium AI tools for power users",
    price: "$49",
    period: "/month",
    features: [
      "Everything in Starter",
      "Premium AI model",
      "100 AI images per day",
      "Advanced AI configuration",
      "Priority support",
      "Dedicated private server",
      "24/7 uptime",
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || "price_pro",
    cta: "Go Pro",
    highlight: true,
  },
];

interface PlanPickerProps {
  onCheckoutStarted: () => void;
  wizardState?: WizardState | null;
}

export function PlanPicker({ onCheckoutStarted, wizardState }: PlanPickerProps) {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSelectPlan = (priceId: string) => {
    setSelectedPriceId(priceId);
  };

  const handleGo = async () => {
    if (!selectedPriceId) return;
    setLoading(true);

    if (!isAuthenticated) {
      // Save wizard state + selected plan to localStorage, then sign in
      if (wizardState) {
        saveWizardState({ ...wizardState, selectedPriceId });
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
        body: JSON.stringify({ priceId: selectedPriceId }),
      });

      const data = await response.json();

      if (data.url) {
        onCheckoutStarted();
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-100">Choose Your Plan</h2>
        <p className="mt-3 text-lg text-gray-400">
          Pick a plan to bring your AI assistant to life.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {plans.map((plan) => {
          const isSelected = selectedPriceId === plan.priceId;
          return (
            <Card
              key={plan.name}
              className={`relative cursor-pointer transition-all ${
                isSelected
                  ? "border-2 border-red-600 ring-2 ring-red-600/30 shadow-lg"
                  : plan.highlight
                    ? "border-2 border-red-600/50 shadow-lg"
                    : "border-2 border-neutral-600 hover:border-neutral-500"
              }`}
              onClick={() => handleSelectPlan(plan.priceId)}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-red-600 text-white">Most Popular</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-3">
                  <span className="text-3xl font-bold text-gray-100">
                    {plan.price}
                  </span>
                  <span className="text-gray-500">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="mb-6 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      <span className="text-sm text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button
        className="w-full h-14 text-lg"
        size="lg"
        onClick={handleGo}
        disabled={!selectedPriceId || loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {isAuthenticated ? "Loading..." : "Signing in..."}
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
  );
}
