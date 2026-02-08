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
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
