import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InstanceNameForm } from "@/components/dashboard/instance-name-form";
import { CustomDomainsForm } from "@/components/dashboard/custom-domains-form";
import { ConsoleButton } from "@/components/dashboard/console-button";

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  starter: "Healer Alpha",
  standard: "Healer Alpha",
  pro: "Claude Sonnet 4.5",
};

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const [instance, subscription] = await Promise.all([
    prisma.instance.findUnique({ where: { userId: session.user.id } }),
    prisma.subscription.findUnique({ where: { userId: session.user.id } }),
  ]);

  const customDomains = instance
    ? await prisma.customDomain.findMany({
        where: { instanceId: instance.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <>
      <DashboardHeader title="Settings" description="Manage your instance" />
      <div className="mx-auto max-w-2xl space-y-6 p-8">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium">{session.user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Name</span>
              <span className="text-sm font-medium">{session.user.name || "--"}</span>
            </div>
          </CardContent>
        </Card>

        {instance && instance.status === "active" && (
          <Card>
            <CardHeader>
              <CardTitle>Public Site Name</CardTitle>
              <CardDescription>
                Choose a name for your bot&apos;s public websites. Your bot can create
                sites that are accessible at <code className="text-xs">&lt;site&gt;-&lt;name&gt;.instaclaw.bot</code>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InstanceNameForm currentName={instance.instanceName} />
            </CardContent>
          </Card>
        )}

        {instance && instance.status === "active" && instance.instanceName && (
          <Card>
            <CardHeader>
              <CardTitle>Custom Domains</CardTitle>
              <CardDescription>
                Point your own domain to any of your published sites.
                SSL certificates are provisioned automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CustomDomainsForm
                instanceId={instance.id}
                initialDomains={customDomains.map((d) => ({
                  id: d.id,
                  domain: d.domain,
                  siteSlug: d.siteSlug,
                  status: d.status,
                  createdAt: d.createdAt.toISOString(),
                }))}
              />
            </CardContent>
          </Card>
        )}

        {instance && (
          <Card>
            <CardHeader>
              <CardTitle>Instance</CardTitle>
              <CardDescription>Your AI assistant server details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={instance.status === "active" ? "default" : "secondary"}>
                  {instance.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">AI Model</span>
                <span className="text-sm font-medium">{(subscription && MODEL_DISPLAY_NAMES[subscription.plan]) || instance.llmProvider}</span>
              </div>
              {instance.telegramBotUsername && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Telegram Bot</span>
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
                  <span className="text-sm text-muted-foreground">Server IP</span>
                  <span className="text-sm font-mono">{instance.ipAddress}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Health</span>
                <Badge variant={instance.healthStatus === "healthy" ? "default" : "secondary"}>
                  {instance.healthStatus}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {instance && instance.status === "active" && (
          <Card>
            <CardHeader>
              <CardTitle>Control Panel</CardTitle>
              <CardDescription>
                Manage skills, view logs, and configure your bot directly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConsoleButton />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
