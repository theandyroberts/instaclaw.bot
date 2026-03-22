"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";

interface TopupButtonProps {
  plan: string;
}

const PLAN_LABELS: Record<string, string> = {
  starter: "$5",
  standard: "$5",
  pro: "$10",
};

export function TopupButton({ plan }: TopupButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleTopup() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: 1 }),
      });
      if (!res.ok) throw new Error("Failed");
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setLoading(false);
    }
  }

  const price = PLAN_LABELS[plan] || "$5";

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleTopup}
      disabled={loading}
      className="mt-2"
    >
      {loading ? (
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
      ) : (
        <Plus className="mr-1 h-3 w-3" />
      )}
      Add Capacity ({price})
    </Button>
  );
}
