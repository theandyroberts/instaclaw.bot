import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { UsageDashboard } from "@/components/admin/usage-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminUsagePage() {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    redirect("/dashboard");
  }

  return (
    <>
      <DashboardHeader
        title="Admin - LLM Usage"
        description="Monitor LLM spend and usage across all instances"
      />
      <div className="p-8">
        <UsageDashboard />
      </div>
    </>
  );
}
