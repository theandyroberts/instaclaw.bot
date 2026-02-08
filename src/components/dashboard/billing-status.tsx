"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Calendar } from "lucide-react";

interface Subscription {
  plan: string;
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export function BillingStatus() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetch("/api/billing/status")
      .then((res) => res.json())
      .then((data) => setSubscription(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Portal error:", error);
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Active Subscription</CardTitle>
          <CardDescription>
            Subscribe to get your personal AI assistant on Telegram.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <a href="/#pricing">View Plans</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    active: "default",
    trialing: "secondary",
    past_due: "destructive",
    canceled: "secondary",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>
              {subscription.plan === "pro" ? "Pro" : "Starter"} Plan
            </CardTitle>
            <CardDescription>
              ${subscription.plan === "pro" ? "49" : "29"}/month
            </CardDescription>
          </div>
          <Badge variant={statusColors[subscription.status] || "secondary"}>
            {subscription.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center text-sm text-gray-400">
          <Calendar className="mr-2 h-4 w-4" />
          Renews on{" "}
          {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
        </div>

        {subscription.cancelAtPeriodEnd && (
          <p className="text-sm text-amber-600">
            Your subscription will cancel at the end of the billing period.
          </p>
        )}

        <div className="flex gap-3">
          <Button
            onClick={openPortal}
            disabled={portalLoading}
            variant="outline"
          >
            {portalLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Manage Billing
              </>
            )}
          </Button>

          {subscription.plan === "starter" && (
            <Button variant="default" asChild>
              <a href="/#pricing">Upgrade to Pro</a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
