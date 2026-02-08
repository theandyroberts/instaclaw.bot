"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Check, Lock } from "lucide-react";

interface StepLLMProps {
  onComplete: () => void;
}

interface Subscription {
  plan: string;
  status: string;
}

const models = [
  {
    id: "kimi",
    name: "Kimi K2.5",
    provider: "Moonshot AI",
    description: "Powerful free AI model with unlimited usage. Great for research, writing, and coding.",
    free: true,
    plans: ["starter", "pro"],
  },
  {
    id: "claude",
    name: "Claude",
    provider: "Anthropic",
    description: "Excellent reasoning and analysis. Great for complex tasks and nuanced writing.",
    free: false,
    plans: ["pro"],
  },
  {
    id: "openai",
    name: "GPT-4",
    provider: "OpenAI",
    description: "The original powerhouse. Versatile and reliable for any task.",
    free: false,
    plans: ["pro"],
  },
  {
    id: "gemini",
    name: "Gemini",
    provider: "Google",
    description: "Strong multimodal capabilities. Good with images and diverse content.",
    free: false,
    plans: ["pro"],
  },
  {
    id: "minimax",
    name: "MiniMax",
    provider: "MiniMax",
    description: "Fast and efficient model with good multilingual support.",
    free: false,
    plans: ["pro"],
  },
];

export function StepLLM({ onComplete }: StepLLMProps) {
  const [selected, setSelected] = useState<string>("kimi");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    fetch("/api/billing/status")
      .then((res) => res.json())
      .then(setSubscription)
      .catch(console.error);
  }, []);

  const plan = subscription?.plan || "starter";

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/instance/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selected }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to configure AI model");
      }

      onComplete();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose Your AI Brain</CardTitle>
        <CardDescription>
          {plan === "starter"
            ? "Your Starter plan includes unlimited Kimi K2.5."
            : "Your Pro plan includes $15/mo credit. Choose any model."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3">
          {models.map((model) => {
            const isAvailable = model.plans.includes(plan);
            const isSelected = selected === model.id;

            return (
              <button
                key={model.id}
                type="button"
                onClick={() => isAvailable && setSelected(model.id)}
                disabled={!isAvailable}
                className={`flex items-start gap-4 rounded-lg border p-4 text-left transition-colors ${
                  isSelected
                    ? "border-red-600 bg-red-950/30"
                    : isAvailable
                      ? "border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800"
                      : "border-neutral-800 bg-neutral-900 opacity-60"
                }`}
              >
                <div
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    isSelected
                      ? "border-red-600 bg-red-600"
                      : "border-neutral-600"
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-100">
                      {model.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {model.provider}
                    </span>
                    {model.free && (
                      <Badge variant="secondary" className="text-xs">
                        Free & Unlimited
                      </Badge>
                    )}
                    {!isAvailable && (
                      <Badge variant="outline" className="text-xs">
                        <Lock className="mr-1 h-3 w-3" />
                        Pro only
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {model.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={loading || !selected}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Configuring...
            </>
          ) : (
            `Use ${models.find((m) => m.id === selected)?.name || "Selected Model"}`
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
