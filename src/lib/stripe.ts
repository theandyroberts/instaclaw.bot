import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const PLANS = {
  starter: {
    name: "Starter",
    price: 29,
    priceId: process.env.STRIPE_STARTER_PRICE_ID!,
    llmProvider: "kimi" as const,
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
    price: 49,
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
    llmProvider: null,
    features: [
      "Everything in Starter",
      "$15/mo LLM credit",
      "Claude, GPT-4, Gemini, Kimi, MiniMax",
      "Choose your AI model",
      "Priority support",
      "Advanced configuration",
      "Dedicated server",
      "24/7 uptime",
    ],
  },
} as const;

export function getPlanFromPriceId(priceId: string): "starter" | "pro" | null {
  if (priceId === PLANS.starter.priceId) return "starter";
  if (priceId === PLANS.pro.priceId) return "pro";
  return null;
}
