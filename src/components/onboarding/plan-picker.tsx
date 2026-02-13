"use client";

import { useState, useEffect } from "react";
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

interface Plan {
  id: string;
  name: string;
  description: string;
  price: string;
  period: string;
  features: string[];
  priceId: string;
  highlight: boolean;
  selectable: boolean;
  badge?: string;
}

const plans: Plan[] = [
  {
    id: "starter",
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
    highlight: false,
    selectable: true,
  },
  {
    id: "pro",
    name: "Pro",
    description: "Premium AI tools for power users",
    price: "$49",
    period: "/month",
    features: [
      "Everything in Starter",
      "Access to foundation models",
      "100 AI images per day",
      "Personal web server*",
      "Advanced AI configuration",
      "Priority support",
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || "price_pro",
    highlight: true,
    selectable: true,
    badge: "Most Popular",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Custom solutions for teams and businesses",
    price: "Custom",
    period: "",
    features: [
      "Everything in Pro",
      "Custom model integrations",
      "Dedicated account manager",
      "SLA guarantees",
    ],
    priceId: "",
    highlight: false,
    selectable: false,
    badge: "Coming Soon",
  },
];

interface PlanPickerProps {
  onCheckoutStarted: () => void;
  wizardState?: WizardState | null;
  preselectedPlanId?: string;
}

export function PlanPicker({ onCheckoutStarted, wizardState, preselectedPlanId }: PlanPickerProps) {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  // Pre-select from landing page choice or default to pro
  const [selectedPlanId, setSelectedPlanId] = useState<string>(preselectedPlanId || "pro");
  const [loading, setLoading] = useState(false);

  // Update selection if preselectedPlanId changes
  useEffect(() => {
    if (preselectedPlanId) {
      setSelectedPlanId(preselectedPlanId);
    }
  }, [preselectedPlanId]);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId && p.selectable);

  const handleSelectPlan = (plan: Plan) => {
    if (!plan.selectable) return;
    setSelectedPlanId(plan.id);
  };

  const handleGo = async () => {
    if (!selectedPlan) return;
    setLoading(true);

    if (!isAuthenticated) {
      // Save wizard state + selected plan to localStorage, then sign in
      if (wizardState) {
        saveWizardState({ ...wizardState, selectedPriceId: selectedPlan.priceId });
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
        body: JSON.stringify({ priceId: selectedPlan.priceId }),
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

      <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
        {plans.map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          const isEnterprise = !plan.selectable;

          return (
            <Card
              key={plan.id}
              onClick={() => handleSelectPlan(plan)}
              className={`relative transition-all ${
                isEnterprise
                  ? "opacity-60 cursor-default"
                  : "cursor-pointer"
              } ${
                isSelected && !isEnterprise
                  ? "border-2 border-red-600 ring-2 ring-red-600/30 shadow-lg shadow-red-900/20"
                  : isEnterprise
                    ? "border border-neutral-800"
                    : "border-2 border-neutral-700 hover:border-neutral-600"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge
                    className={
                      plan.badge === "Most Popular"
                        ? "bg-red-600 text-white"
                        : "bg-neutral-700 text-gray-300"
                    }
                  >
                    {plan.badge}
                  </Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-3">
                  <span className="text-3xl font-bold text-gray-100">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-gray-500">{plan.period}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          isEnterprise ? "text-gray-600" : "text-green-500"
                        }`}
                      />
                      <span
                        className={`text-sm ${
                          isSelected && !isEnterprise
                            ? "text-gray-100"
                            : isEnterprise
                              ? "text-gray-600"
                              : "text-gray-500"
                        }`}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {isEnterprise && (
                  <a
                    href="mailto:andy@sparkpoint.studio?subject=InstaClaw Enterprise"
                    className="mt-4 block text-center text-sm text-red-400 hover:text-red-300 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Contact us for pricing
                  </a>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-gray-600">
        *Personal web server coming soon
      </p>

      <Button
        className="w-full h-14 text-lg"
        size="lg"
        onClick={handleGo}
        disabled={!selectedPlan || loading}
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
