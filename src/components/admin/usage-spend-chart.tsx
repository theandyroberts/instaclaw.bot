"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DailyData {
  date: string;
  cost: number;
}

export function UsageSpendChart({ data }: { data: DailyData[] | null }) {
  const [range, setRange] = useState<7 | 30>(7);

  const filtered = data
    ? data.slice(-range).map((d) => ({
        ...d,
        date: d.date.slice(5), // MM-DD
        cost: parseFloat(d.cost.toFixed(4)),
      }))
    : [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Daily Spend</CardTitle>
        <div className="flex gap-1">
          <Button
            variant={range === 7 ? "default" : "outline"}
            size="sm"
            onClick={() => setRange(7)}
          >
            7d
          </Button>
          <Button
            variant={range === 30 ? "default" : "outline"}
            size="sm"
            onClick={() => setRange(30)}
          >
            30d
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-muted-foreground">
            No activity data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={filtered}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                stroke="var(--muted-foreground)"
                fontSize={12}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--foreground)",
                }}
                formatter={(value) => [`$${Number(value).toFixed(4)}`, "Cost"]}
              />
              <Area
                type="monotone"
                dataKey="cost"
                stroke="var(--chart-1)"
                fill="var(--chart-1)"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
