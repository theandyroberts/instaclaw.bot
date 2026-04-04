import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { listSites } from "@/lib/worker-client";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Server,
  CreditCard,
  ArrowRight,
  MessageCircle,
  Globe,
  BarChart3,
  LifeBuoy,
} from "lucide-react";
import { TelegramIcon } from "@/components/icons/telegram";
import { SupportForm } from "@/components/dashboard/support-form";
import { SitesList } from "@/components/dashboard/sites-list";
import { TopupButton } from "@/components/dashboard/topup-button";

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  starter: "Healer Alpha",
  pro: "Claude Sonnet 4.5",
};

const PLAN_BUDGETS: Record<string, number> = {
  starter: 15,
  standard: 15,
  pro: 30,
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const admin = isAdmin(session.user.email);

  const [subscription, instance] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId: session.user.id } }),
    prisma.instance.findUnique({ where: { userId: session.user.id } }),
  ]);

  // Non-admin users without active subscription/instance go to onboarding
  if (!admin) {
    if (!subscription || subscription.status !== "active") {
      redirect("/onboarding");
    }
    if (!instance || instance.onboardingStep !== "complete") {
      redirect("/onboarding");
    }
  }

  // Admin without instance — show admin-only dashboard
  if (admin && (!instance || !subscription)) {
    return (
      <>
        <DashboardHeader
          title="Admin Dashboard"
          description="System administration"
        />
        <div className="p-8">
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              <p>No personal instance configured. Use the admin panels to manage the system.</p>
            </CardContent>
          </Card>
          <p className="mt-8 text-center text-xs text-muted-foreground/50">v0.6.0</p>
        </div>
      </>
    );
  }

  // At this point, both instance and subscription exist (non-admin was redirected, admin without instance returned early)
  if (!instance || !subscription) redirect("/onboarding");

  // Fetch sites list if instance has a name
  let sites: import("@/lib/worker-client").SiteInfo[] = [];
  if (instance.status === "active" && instance.instanceName) {
    try {
      sites = await listSites(instance.id);
    } catch {
      sites = [];
    }
  }

  return (
    <>
      <DashboardHeader
        title="Dashboard"
        description={`Welcome back, ${session.user.name || "there"}!`}
      />
      <div className="p-8">
        {/* 1. Status / Telegram Bot / Plan / AI Capacity grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Status
              </CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    instance.status === "active" ? "default" : "secondary"
                  }
                >
                  {instance.status}
                </Badge>
                {instance.healthStatus === "healthy" && (
                  <span className="text-xs text-green-600">Healthy</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Telegram Bot
              </CardTitle>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {instance.telegramBotUsername ? (
                <a
                  href={`https://t.me/${instance.telegramBotUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  @{instance.telegramBotUsername}
                </a>
              ) : (
                <span className="text-muted-foreground">Not configured</span>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Plan
              </CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-medium capitalize">
                {subscription.plan}
              </div>
              <p className="text-xs text-muted-foreground">
                AI: {MODEL_DISPLAY_NAMES[subscription.plan] || instance.llmProvider || "Kimi"}
              </p>
            </CardContent>
          </Card>

          {(() => {
            const budget = PLAN_BUDGETS[subscription.plan] || 15;
            const pct = Math.min(Math.round((instance.llmSpendMonthly / budget) * 100), 100);
            const barColor = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-green-500";
            return (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    AI Capacity
                  </CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="font-medium">{pct}% used</div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Monthly capacity resets each billing cycle
                  </p>
                  {pct >= 80 && <TopupButton plan={subscription.plan} />}
                </CardContent>
              </Card>
            );
          })()}
        </div>

        {/* 2. Telegram CTA */}
        {instance.telegramBotUsername && (
          <Card className="mt-6">
            <CardContent className="flex items-center justify-between py-6">
              <div>
                <h3 className="font-semibold">Chat with your AI assistant</h3>
                <p className="text-sm text-muted-foreground">
                  Open Telegram and start a conversation with @
                  {instance.telegramBotUsername}
                </p>
              </div>
              <Button asChild>
                <a
                  href={`https://t.me/${instance.telegramBotUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <TelegramIcon className="mr-2 h-4 w-4" />
                  Open Telegram
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 3. Public Sites */}
        {instance.status === "active" && instance.instanceName && (
          <Card className="mt-6">
            <CardContent className="py-6">
              <div className="flex items-start gap-3">
                <Globe className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="w-full space-y-3">
                  <h3 className="font-semibold">Your Public Sites</h3>
                  <SitesList initialSites={sites} instanceName={instance.instanceName} />
                  <p className="text-xs text-muted-foreground">
                    Sites are accessible at{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                      &lt;site&gt;-{instance.instanceName}.instaclaw.bot
                    </code>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {instance.status === "active" && !instance.instanceName && (
          <Card className="mt-6 border-dashed">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Globe className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div>
                    <h3 className="font-semibold">Enable Public Sites</h3>
                    <p className="text-sm text-muted-foreground">
                      Set an instance name in Settings to let your bot create shareable websites
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href="/dashboard/settings">
                    Settings
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 4. Support */}
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <LifeBuoy className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Support
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SupportForm
              userEmail={session.user.email}
              userName={session.user.name}
              instanceId={instance.id}
              instanceName={instance.instanceName}
              instanceStatus={instance.status}
              plan={subscription.plan}
              subscriptionStatus={subscription.status}
            />
          </CardContent>
        </Card>

        {/* 5. Footer */}
        {instance.gatewayToken ? (
          <p className="mt-8 text-center text-xs text-muted-foreground">
            GW: <code className="font-mono select-all">{instance.gatewayToken}</code>
          </p>
        ) : (
          <p className="mt-8 text-center text-xs text-red-400">
            GW token missing from database
          </p>
        )}
        <p className="mt-2 text-center text-xs text-muted-foreground/50">v0.6.0</p>
      </div>
    </>
  );
}
