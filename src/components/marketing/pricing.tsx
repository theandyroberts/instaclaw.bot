"use client";

import { useSession } from "next-auth/react";
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
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";

const plans = [
  {
    name: "Starter",
    description: "Perfect for getting started with AI on Telegram",
    price: "$29",
    period: "/month",
    features: [
      "Personal AI assistant on Telegram",
      "Kimi K2.5 AI (unlimited, free)",
      "Web browsing & research",
      "Writing & coding help",
      "Dedicated private server",
      "24/7 uptime",
      "Email support",
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || "price_starter",
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Pro",
    description: "For power users who want the best AI models",
    price: "$49",
    period: "/month",
    features: [
      "Everything in Starter",
      "$15/mo LLM credit included",
      "Choose: Claude, GPT-4, Gemini, Kimi, or MiniMax",
      "Switch models anytime",
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

export function Pricing() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string) => {
    if (!session) {
      router.push("/sign-in");
      return;
    }

    setLoading(priceId);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <section id="pricing" className="bg-white px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">
            Simple, Transparent Pricing
          </h2>
          <p className="mx-auto max-w-2xl text-gray-600">
            No hidden fees. No usage limits on Starter. Cancel anytime.
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={
                plan.highlight
                  ? "relative border-2 border-violet-600 shadow-lg"
                  : ""
              }
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-violet-600 text-white">
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-gray-900">
                    {plan.price}
                  </span>
                  <span className="text-gray-500">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="mb-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.highlight ? "default" : "outline"}
                  size="lg"
                  onClick={() => handleSubscribe(plan.priceId)}
                  disabled={loading === plan.priceId}
                >
                  {loading === plan.priceId ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    plan.cta
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
