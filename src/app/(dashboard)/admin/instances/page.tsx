import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { InstanceTable } from "@/components/admin/instance-table";

export const dynamic = 'force-dynamic';

export default async function AdminInstancesPage() {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    redirect("/dashboard");
  }

  return (
    <>
      <DashboardHeader
        title="Admin - Instances"
        description="Manage all customer instances"
      />
      <div className="p-8">
        <InstanceTable />
      </div>
    </>
  );
}
