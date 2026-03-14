"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ModelData {
  model: string;
  cost: number;
}

interface ProviderData {
  provider: string;
  cost: number;
}

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function shortenModel(id: string): string {
  // "google/gemini-2.5-flash" → "gemini-2.5-flash"
  const parts = id.split("/");
  return parts[parts.length - 1];
}

export function UsageModelCharts({
  byModel,
  byProvider,
}: {
  byModel: ModelData[] | null;
  byProvider: ProviderData[] | null;
}) {
  const modelData = (byModel || []).slice(0, 8).map((d) => ({
    name: shortenModel(d.model),
    cost: parseFloat(d.cost.toFixed(4)),
  }));

  const providerData = (byProvider || []).map((d) => ({
    name: d.provider,
    value: parseFloat(d.cost.toFixed(4)),
  }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Spend by Model</CardTitle>
        </CardHeader>
        <CardContent>
          {modelData.length === 0 ? (
            <div className="flex h-[250px] items-center justify-center text-muted-foreground">
              No data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={modelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  type="number"
                  stroke="var(--muted-foreground)"
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                  tickFormatter={(v) => `$${v}`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="var(--muted-foreground)"
                  tick={{ fill: "#9ca3af", fontSize: 11 }}
                  width={140}
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
                <Bar dataKey="cost" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spend by Provider</CardTitle>
        </CardHeader>
        <CardContent>
          {providerData.length === 0 ? (
            <div className="flex h-[250px] items-center justify-center text-muted-foreground">
              No data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={providerData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value, cx, cy, midAngle, outerRadius }) => {
                    const RADIAN = Math.PI / 180;
                    const radius = (outerRadius as number) + 16;
                    const angle = (midAngle as number) ?? 0;
                    const x = (cx as number) + radius * Math.cos(-angle * RADIAN);
                    const y = (cy as number) + radius * Math.sin(-angle * RADIAN);
                    return (
                      <text x={x} y={y} fill="#9ca3af" fontSize={11} textAnchor={x > (cx as number) ? "start" : "end"} dominantBaseline="central">
                        {`${name}: $${value}`}
                      </text>
                    );
                  }}
                  labelLine={false}
                >
                  {providerData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    color: "var(--foreground)",
                  }}
                  formatter={(value) => [`$${Number(value).toFixed(4)}`, "Cost"]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
