"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Pause, Play, Trash2, RefreshCw } from "lucide-react";

interface Instance {
  id: string;
  status: string;
  onboardingStep: string;
  ipAddress: string | null;
  instanceName: string | null;
  dropletId: string | null;
  llmProvider: string;
  healthStatus: string;
  telegramBotUsername: string | null;
  createdAt: string;
  user: {
    email: string;
    name: string | null;
    subscription: {
      plan: string;
      status: string;
    } | null;
  };
}

export function InstanceTable() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchInstances = async () => {
    try {
      const res = await fetch("/api/admin/instances");
      if (res.ok) {
        const data = await res.json();
        setInstances(data);
      }
    } catch (error) {
      console.error("Failed to fetch instances:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
    const interval = setInterval(fetchInstances, 30000);
    return () => clearInterval(interval);
  }, []);

  const performAction = async (
    id: string,
    action: "suspend" | "unsuspend" | "terminate"
  ) => {
    if (action === "terminate" && !confirm("Are you sure you want to terminate this instance? This cannot be undone.")) {
      return;
    }

    setActionLoading(`${id}-${action}`);
    try {
      await fetch(`/api/admin/instances/${id}/${action}`, { method: "POST" });
      await fetchInstances();
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  const statusStyle = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
      case "suspended":
        return "bg-yellow-500/15 text-yellow-400 border-yellow-500/20";
      case "terminated":
        return "bg-neutral-500/15 text-neutral-400 border-neutral-500/20";
      case "failed":
        return "bg-red-500/15 text-red-400 border-red-500/20";
      default:
        return "bg-neutral-500/15 text-neutral-400 border-neutral-500/20";
    }
  };

  const healthStyle = (health: string) => {
    switch (health) {
      case "healthy":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
      case "unhealthy":
        return "bg-red-500/15 text-red-400 border-red-500/20";
      case "unreachable":
        return "bg-red-500/15 text-red-400 border-red-500/20";
      default:
        return "bg-neutral-500/15 text-neutral-400 border-neutral-500/20";
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>
          All Instances ({instances.length})
        </CardTitle>
        <Button variant="outline" size="sm" onClick={fetchInstances}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-gray-500">
                <th className="pb-3 pr-4">Customer</th>
                <th className="pb-3 pr-4">Plan</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Health</th>
                <th className="pb-3 pr-4">Bot</th>
                <th className="pb-3 pr-4">AI</th>
                <th className="pb-3 pr-4">Instance</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {instances.map((instance) => (
                <tr key={instance.id} className="border-b border-neutral-800 last:border-0">
                  <td className="py-3 pr-4">
                    <div>
                      <div className="font-medium">{instance.user.name || "--"}</div>
                      <div className="text-xs text-gray-400">
                        {instance.user.email}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant="outline" className="capitalize">
                      {instance.user.subscription?.plan || "--"}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge className={statusStyle(instance.status)}>
                      {instance.status}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge className={healthStyle(instance.healthStatus)}>
                      {instance.healthStatus}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4 text-xs">
                    {instance.telegramBotUsername ? (
                      <a
                        href={`https://t.me/${instance.telegramBotUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        @{instance.telegramBotUsername}
                      </a>
                    ) : (
                      "--"
                    )}
                  </td>
                  <td className="py-3 pr-4 capitalize text-xs">
                    {instance.llmProvider}
                  </td>
                  <td className="py-3 pr-4 text-xs font-mono">
                    {instance.instanceName || (instance.id ? `instaclaw-${instance.id.slice(0, 8)}` : "--")}
                  </td>
                  <td className="py-3">
                    <div className="flex gap-1">
                      {instance.status === "active" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            performAction(instance.id, "suspend")
                          }
                          disabled={actionLoading === `${instance.id}-suspend`}
                        >
                          {actionLoading === `${instance.id}-suspend` ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Pause className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                      {instance.status === "suspended" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            performAction(instance.id, "unsuspend")
                          }
                          disabled={
                            actionLoading === `${instance.id}-unsuspend`
                          }
                        >
                          {actionLoading === `${instance.id}-unsuspend` ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                      {instance.status !== "terminated" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive/80"
                          onClick={() =>
                            performAction(instance.id, "terminate")
                          }
                          disabled={
                            actionLoading === `${instance.id}-terminate`
                          }
                        >
                          {actionLoading === `${instance.id}-terminate` ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {instances.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    No instances yet.
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
