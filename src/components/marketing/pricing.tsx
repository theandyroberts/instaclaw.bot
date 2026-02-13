"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight } from "lucide-react";
import { useState } from "react";

const SELECTED_PLAN_KEY = "instaclaw-selected-plan";

interface Plan {
  id: string;
  name: string;
  description: string;
  price: string;
  period: string;
  features: string[];
  highlight: boolean;
  selectable: boolean;
  badge?: string;
}

const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Perfect for getting started with AI on Telegram",
    price: "$29",
    period: "/month",
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
      "Volume discounts",
    ],
    highlight: false,
    selectable: false,
    badge: "Coming Soon",
  },
];

export function Pricing() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>("pro");

  const handleCardClick = (plan: Plan) => {
    if (!plan.selectable) return;
    setSelectedId(plan.id);
  };

  const handleCTA = () => {
    const plan = plans.find((p) => p.id === selectedId);
    if (!plan || !plan.selectable) return;

    // Store selected plan in localStorage
    localStorage.setItem(
      SELECTED_PLAN_KEY,
      JSON.stringify({ id: plan.id, name: plan.name, price: plan.price })
    );

    router.push(`/onboarding?plan=${plan.id}`);
  };

  return (
    <section id="pricing" className="bg-[#0a0a0a] px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-gray-100 md:text-4xl">
            Simple, Transparent Pricing
          </h2>
          <p className="mx-auto max-w-2xl text-gray-400">
            No hidden fees. No usage limits on Starter. Cancel anytime.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-6 grid-cols-1 md:grid-cols-3">
          {plans.map((plan) => {
            const isSelected = selectedId === plan.id;
            const isEnterprise = !plan.selectable;

            return (
              <Card
                key={plan.id}
                onClick={() => handleCardClick(plan)}
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
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-gray-100">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-gray-500">{plan.period}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
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
                      className="mt-6 block text-center text-sm text-red-400 hover:text-red-300 hover:underline"
                    >
                      Contact us for pricing
                    </a>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="mt-3 text-center text-xs text-gray-600">
          *Personal web server coming soon
        </p>

        <div className="mx-auto mt-8 max-w-md">
          <Button
            className="w-full h-14 text-lg"
            size="lg"
            onClick={handleCTA}
            disabled={!selectedId || !plans.find((p) => p.id === selectedId)?.selectable}
          >
            Get your AI assistant now
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </section>
  );
}
