import { DashboardHeader } from "@/components/dashboard/header";
import { BillingStatus } from "@/components/dashboard/billing-status";

export const dynamic = 'force-dynamic';

export default function BillingPage() {
  return (
    <>
      <DashboardHeader
        title="Billing"
        description="Manage your subscription and payment method"
      />
      <div className="mx-auto max-w-2xl p-8">
        <BillingStatus />
      </div>
    </>
  );
}
