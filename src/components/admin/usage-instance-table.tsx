"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface InstanceUsage {
  instanceId: string;
  email: string;
  plan: string;
  spendMonthly: number;
  limit: number;
  pctUsed: number;
}

function budgetColor(pct: number): string {
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-orange-400";
  if (pct >= 50) return "bg-yellow-400";
  return "bg-emerald-500";
}

export function UsageInstanceTable({ data }: { data: InstanceUsage[] | null }) {
  const instances = data || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Instance Usage</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-gray-500">
                <th className="pb-3 pr-4">Customer</th>
                <th className="pb-3 pr-4">Plan</th>
                <th className="pb-3 pr-4">Monthly Spend</th>
                <th className="pb-3 pr-4">Budget</th>
                <th className="pb-3 min-w-[200px]">Usage</th>
              </tr>
            </thead>
            <tbody>
              {instances.map((inst) => (
                <tr
                  key={inst.instanceId}
                  className="border-b border-neutral-800 last:border-0"
                >
                  <td className="py-3 pr-4 text-xs">{inst.email}</td>
                  <td className="py-3 pr-4">
                    <Badge variant="outline" className="capitalize">
                      {inst.plan}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4 font-mono">
                    ${inst.spendMonthly.toFixed(2)}
                  </td>
                  <td className="py-3 pr-4 font-mono text-muted-foreground">
                    ${inst.limit.toFixed(0)}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-neutral-800">
                        <div
                          className={`h-full rounded-full transition-all ${budgetColor(inst.pctUsed)}`}
                          style={{ width: `${Math.min(inst.pctUsed, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {inst.pctUsed.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {instances.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    No instances with LLM usage yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
