import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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
} from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const [subscription, instance] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId: session.user.id } }),
    prisma.instance.findUnique({ where: { userId: session.user.id } }),
  ]);

  // No subscription or onboarding incomplete -- redirect to onboarding funnel
  if (!subscription || subscription.status !== "active") {
    redirect("/onboarding");
  }

  if (!instance || instance.onboardingStep !== "complete") {
    redirect("/onboarding");
  }

  // Fully set up
  return (
    <>
      <DashboardHeader
        title="Dashboard"
        description={`Welcome back, ${session.user.name || "there"}!`}
      />
      <div className="p-8">
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Status
              </CardTitle>
              <Server className="h-4 w-4 text-gray-400" />
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
              <CardTitle className="text-sm font-medium text-gray-500">
                Telegram Bot
              </CardTitle>
              <MessageCircle className="h-4 w-4 text-gray-400" />
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
                <span className="text-gray-400">Not configured</span>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Plan
              </CardTitle>
              <CreditCard className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="font-medium capitalize">
                {subscription.plan}
              </div>
              <p className="text-xs text-gray-500">
                AI: {instance.llmProvider || "Kimi"}
              </p>
            </CardContent>
          </Card>
        </div>

        {instance.telegramBotUsername && (
          <Card className="mt-6">
            <CardContent className="flex items-center justify-between py-6">
              <div>
                <h3 className="font-semibold">Chat with your AI assistant</h3>
                <p className="text-sm text-gray-500">
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
                  Open Telegram
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
