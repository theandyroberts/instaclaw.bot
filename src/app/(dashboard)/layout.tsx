import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { Sidebar } from "@/components/dashboard/sidebar";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const instance = await prisma.instance.findUnique({
    where: { userId: session.user.id },
  });

  const onboardingIncomplete =
    !!instance && instance.onboardingStep !== "complete";
  const admin = isAdmin(session.user.email);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar onboardingIncomplete={onboardingIncomplete} isAdmin={admin} />
      <div className="flex-1 overflow-auto">
        {/* Mobile nav */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <span className="text-lg font-bold">
            <span className="text-foreground">Insta</span>
            <span className="text-ember">Claw</span>
            <span className="text-foreground">.bot</span>
          </span>
          <nav className="flex gap-4 text-sm">
            <a href="/dashboard" className="text-muted-foreground hover:text-foreground">Overview</a>
            <a href="/dashboard/billing" className="text-muted-foreground hover:text-foreground">Billing</a>
            <a href="/dashboard/settings" className="text-muted-foreground hover:text-foreground">Settings</a>
          </nav>
        </div>
        {children}
      </div>
    </div>
  );
}
