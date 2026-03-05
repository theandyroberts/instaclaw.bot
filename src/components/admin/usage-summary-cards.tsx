"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Server, TrendingUp, AlertTriangle } from "lucide-react";

interface SummaryData {
  totalMonthlySpend: number;
  instanceCount: number;
  avgSpendPerInstance: number;
  budgetAlerts: { instanceId: string; email: string; pctUsed: number }[];
}

export function UsageSummaryCards({ data }: { data: SummaryData | null }) {
  const cards = [
    {
      title: "Total Monthly Spend",
      value: data ? `$${data.totalMonthlySpend.toFixed(2)}` : "--",
      icon: DollarSign,
    },
    {
      title: "Active Instances",
      value: data ? String(data.instanceCount) : "--",
      icon: Server,
    },
    {
      title: "Avg $/Instance",
      value: data ? `$${data.avgSpendPerInstance.toFixed(2)}` : "--",
      icon: TrendingUp,
    },
    {
      title: "Budget Alerts",
      value: data ? String(data.budgetAlerts.length) : "--",
      icon: AlertTriangle,
      alert: data && data.budgetAlerts.length > 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon
              className={`h-4 w-4 ${card.alert ? "text-orange-400" : "text-muted-foreground"}`}
            />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${card.alert ? "text-orange-400" : ""}`}>
              {card.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
