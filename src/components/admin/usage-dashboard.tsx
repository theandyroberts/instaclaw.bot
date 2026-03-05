"use client";

import { useEffect, useState, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { UsageSummaryCards } from "./usage-summary-cards";
import { UsageSpendChart } from "./usage-spend-chart";
import { UsageModelCharts } from "./usage-model-chart";
import { UsageInstanceTable } from "./usage-instance-table";

interface SummaryData {
  totalMonthlySpend: number;
  instanceCount: number;
  avgSpendPerInstance: number;
  budgetAlerts: { instanceId: string; email: string; pctUsed: number }[];
}

interface ActivityData {
  daily: { date: string; cost: number }[];
  byModel: { model: string; cost: number }[];
  byProvider: { provider: string; cost: number }[];
}

interface InstanceUsage {
  instanceId: string;
  email: string;
  plan: string;
  spendMonthly: number;
  limit: number;
  pctUsed: number;
}

export function UsageDashboard() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [instances, setInstances] = useState<InstanceUsage[] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [summaryRes, activityRes, instancesRes] = await Promise.all([
        fetch("/api/admin/usage/summary"),
        fetch("/api/admin/usage/activity?days=30"),
        fetch("/api/admin/usage/instances"),
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (activityRes.ok) setActivity(await activityRes.json());
      if (instancesRes.ok) setInstances(await instancesRes.json());
    } catch (error) {
      console.error("Failed to fetch usage data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-[320px]" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-[320px]" />
          <Skeleton className="h-[320px]" />
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <UsageSummaryCards data={summary} />
      <UsageSpendChart data={activity?.daily || null} />
      <UsageModelCharts
        byModel={activity?.byModel || null}
        byProvider={activity?.byProvider || null}
      />
      <UsageInstanceTable data={instances} />
    </div>
  );
}
