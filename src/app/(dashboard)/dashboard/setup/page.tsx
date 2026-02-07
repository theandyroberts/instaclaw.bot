import { DashboardHeader } from "@/components/dashboard/header";
import { OnboardingWizard } from "@/components/onboarding/wizard";

export const dynamic = 'force-dynamic';

export default function SetupPage() {
  return (
    <>
      <DashboardHeader
        title="Setup"
        description="Set up your personal AI assistant"
      />
      <div className="mx-auto max-w-2xl p-8">
        <OnboardingWizard />
      </div>
    </>
  );
}
