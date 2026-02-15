import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const instance = await prisma.instance.findUnique({
    where: { userId: session.user.id },
  });

  return (
    <>
      <DashboardHeader title="Settings" description="View your instance details" />
      <div className="mx-auto max-w-2xl space-y-6 p-8">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Email</span>
              <span className="text-sm font-medium">{session.user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Name</span>
              <span className="text-sm font-medium">{session.user.name || "--"}</span>
            </div>
          </CardContent>
        </Card>

        {instance && (
          <Card>
            <CardHeader>
              <CardTitle>Instance</CardTitle>
              <CardDescription>Your AI assistant server details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <Badge variant={instance.status === "active" ? "default" : "secondary"}>
                  {instance.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">AI Model</span>
                <span className="text-sm font-medium capitalize">{instance.llmProvider}</span>
              </div>
              {instance.telegramBotUsername && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Telegram Bot</span>
                  <a
                    href={`https://t.me/${instance.telegramBotUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    @{instance.telegramBotUsername}
                  </a>
                </div>
              )}
              {instance.ipAddress && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Server IP</span>
                  <span className="text-sm font-mono">{instance.ipAddress}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Health</span>
                <Badge variant={instance.healthStatus === "healthy" ? "default" : "secondary"}>
                  {instance.healthStatus}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
