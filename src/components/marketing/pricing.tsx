"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight } from "lucide-react";
import { useState, useCallback } from "react";
import { OnboardingFunnel } from "@/components/onboarding/funnel";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

const SELECTED_PLAN_KEY = "instaclaw-selected-plan";

type BillingInterval = "monthly" | "yearly";

interface Plan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  highlight: boolean;
  selectable: boolean;
  badge?: string;
}

const plans: Plan[] = [
  {
    id: "standard",
    name: "Standard",
    description: "Perfect for getting started with AI on Telegram",
    monthlyPrice: 35,
    yearlyPrice: 348,
    features: [
      "Personal AI assistant on Telegram",
      "Kimi K2.5 AI (unlimited, free)",
      "Web browsing & research",
      "Writing & coding help",
      "20 AI images per day",
      "Dedicated private server",
      "24/7 uptime",
      "Email support",
    ],
    highlight: false,
    selectable: true,
  },
  {
    id: "pro",
    name: "Pro",
    description: "For power users who want the best AI models",
    monthlyPrice: 59,
    yearlyPrice: 588,
    features: [
      "Everything in Standard",
      "Access to foundation models",
      "100 AI images per day",
      "Personal web server*",
      "Advanced AI configuration",
      "Priority support",
    ],
    highlight: true,
    selectable: true,
    badge: "Most Popular",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Custom solutions for teams and businesses",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      "Everything in Pro",
      "Custom model integrations",
      "Dedicated account manager",
      "SLA guarantees",
      "Volume discounts",
    ],
    highlight: false,
    selectable: true,
    badge: "Coming Soon",
  },
];

export function Pricing() {
  const [selectedId, setSelectedId] = useState<string>("pro");
  const [interval, setInterval] = useState<BillingInterval>("yearly");
  const [modalOpen, setModalOpen] = useState(false);

  const handleCardClick = (plan: Plan) => {
    setSelectedId(plan.id);
  };

  const isEnterprisePlan = selectedId === "enterprise";
  const selectedPlan = plans.find((p) => p.id === selectedId);

  const handleCTA = () => {
    if (!selectedPlan || isEnterprisePlan) return;

    const monthlyEq = interval === "yearly"
      ? Math.round(selectedPlan.yearlyPrice / 12)
      : selectedPlan.monthlyPrice;
    const displayPrice = `$${monthlyEq}`;

    // Store selected plan in localStorage
    localStorage.setItem(
      SELECTED_PLAN_KEY,
      JSON.stringify({
        id: selectedPlan.id,
        name: selectedPlan.name,
        price: displayPrice,
        interval,
      })
    );

    setModalOpen(true);
  };

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
  }, []);

  return (
    <>
      <section id="pricing" className="bg-background px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
              Simple, Transparent Pricing
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              No hidden fees. No usage limits on Standard. Cancel anytime.
            </p>

            {/* Billing interval toggle */}
            <div className="mt-6 inline-flex items-center rounded-full bg-muted p-1">
              <button
                onClick={() => setInterval("monthly")}
                className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                  interval === "monthly"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setInterval("yearly")}
                className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                  interval === "yearly"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Yearly
                <span className="ml-1.5 text-xs text-green-500 font-semibold">Save 17%</span>
              </button>
            </div>
          </div>

          <div className="mx-auto grid max-w-5xl gap-6 grid-cols-1 md:grid-cols-3">
            {plans.map((plan) => {
              const isSelected = selectedId === plan.id;
              const isEnterprise = plan.id === "enterprise";
              const monthlyEquivalent = interval === "yearly"
                ? Math.round(plan.yearlyPrice / 12)
                : plan.monthlyPrice;
              const displayPrice = isEnterprise
                ? "Custom"
                : `$${monthlyEquivalent}`;
              const period = isEnterprise ? "" : "/month";
              const billedLabel = interval === "yearly" && !isEnterprise
                ? `Billed $${plan.yearlyPrice}/year`
                : null;

              return (
                <Card
                  key={plan.id}
                  onClick={() => handleCardClick(plan)}
                  className={`relative cursor-pointer transition-all ${
                    isSelected
                      ? isEnterprise
                        ? "border-2 border-muted-foreground/40 ring-2 ring-muted-foreground/20 shadow-lg"
                        : "border-2 border-primary ring-2 ring-primary/30 shadow-lg shadow-primary/10"
                      : "border-2 border-border hover:border-muted-foreground/30"
                  } ${isEnterprise ? "opacity-75" : ""}`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge
                        className={
                          plan.badge === "Most Popular"
                            ? "bg-primary text-white"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {plan.badge}
                      </Badge>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="mt-4">
                      <span className="text-4xl font-bold text-foreground">
                        {displayPrice}
                      </span>
                      {period && (
                        <span className="text-muted-foreground">{period}</span>
                      )}
                      {billedLabel && (
                        <div className="mt-1 text-sm text-muted-foreground">
                          {billedLabel}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <Check
                            className={`mt-0.5 h-4 w-4 shrink-0 ${
                              isEnterprise ? "text-muted-foreground/50" : "text-green-500"
                            }`}
                          />
                          <span
                            className={`text-sm ${
                              isSelected && !isEnterprise
                                ? "text-foreground"
                                : isEnterprise
                                  ? "text-muted-foreground/50"
                                  : "text-muted-foreground"
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
                        className="mt-6 block text-center text-sm text-primary hover:text-primary/80 hover:underline"
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

          <p className="mt-3 text-center text-xs text-muted-foreground/60">
            *Personal web server coming soon
          </p>

          <div className="mx-auto mt-8 max-w-md">
            <Button
              className="w-full h-14 text-lg"
              size="lg"
              onClick={handleCTA}
              disabled={!selectedId || isEnterprisePlan}
            >
              {isEnterprisePlan ? (
                "Coming Soon"
              ) : (
                <>
                  Get your AI assistant now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* Onboarding wizard modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-background border-border"
          showCloseButton={true}
        >
          <VisuallyHidden.Root>
            <DialogTitle>Set up your AI assistant</DialogTitle>
          </VisuallyHidden.Root>
          <div className="px-8 py-10">
            <OnboardingFunnel
              initialStep="welcome"
              isAuthenticated={false}
              justSignedIn={false}
              onClose={handleModalClose}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
