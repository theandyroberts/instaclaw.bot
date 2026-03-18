import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export type BillingInterval = "monthly" | "yearly";
export type PlanId = "standard" | "pro";

interface PlanPricing {
  price: number;
  priceId: string;
}

interface PlanConfig {
  name: string;
  llmProvider: string | null;
  monthly: PlanPricing;
  yearly: PlanPricing;
  features: string[];
}

export const PLANS: Record<PlanId, PlanConfig> = {
  standard: {
    name: "Standard",
    llmProvider: "kimi",
    monthly: {
      price: 35,
      priceId: process.env.STRIPE_STANDARD_MONTHLY_PRICE_ID!,
    },
    yearly: {
      price: 348,
      priceId: process.env.STRIPE_STANDARD_YEARLY_PRICE_ID!,
    },
    features: [
      "Personal AI assistant on Telegram",
      "Kimi K2.5 AI (unlimited)",
      "Web browsing & research",
      "File management",
      "Coding assistance",
      "Dedicated server",
      "24/7 uptime",
    ],
  },
  pro: {
    name: "Pro",
    llmProvider: null,
    monthly: {
      price: 59,
      priceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
    },
    yearly: {
      price: 588,
      priceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID!,
    },
    features: [
      "Everything in Standard",
      "$15/mo LLM credit",
      "Claude, GPT-4, Gemini, Kimi, MiniMax",
      "Choose your AI model",
      "Priority support",
      "Advanced configuration",
      "Dedicated server",
      "24/7 uptime",
    ],
  },
};

export function getPlanFromPriceId(priceId: string): PlanId | null {
  for (const [planId, plan] of Object.entries(PLANS)) {
    if (plan.monthly.priceId === priceId || plan.yearly.priceId === priceId) {
      return planId as PlanId;
    }
  }
  return null;
}

export function getIntervalFromPriceId(priceId: string): BillingInterval | null {
  for (const plan of Object.values(PLANS)) {
    if (plan.monthly.priceId === priceId) return "monthly";
    if (plan.yearly.priceId === priceId) return "yearly";
  }
  return null;
}
