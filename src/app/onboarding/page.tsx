import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { OnboardingFunnel } from "@/components/onboarding/funnel";

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ checkout?: string }>;
}

export default async function OnboardingPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const params = await searchParams;

  const [subscription, instance] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId: session.user.id } }),
    prisma.instance.findUnique({ where: { userId: session.user.id } }),
  ]);

  // Fully onboarded -- go to dashboard
  if (
    subscription?.status === "active" &&
    instance?.onboardingStep === "complete"
  ) {
    redirect("/dashboard");
  }

  // Determine initial step
  let initialStep: "plan" | "provisioning" | "telegram" | "llm" | "complete" = "plan";
  const checkoutPending = params.checkout === "success" && (!subscription || subscription.status !== "active");

  if (!subscription || subscription.status !== "active") {
    initialStep = checkoutPending ? "plan" : "plan";
  } else if (!instance || ["awaiting_provision", "provisioning"].includes(instance.onboardingStep)) {
    initialStep = "provisioning";
  } else if (["awaiting_telegram_token", "configuring_telegram"].includes(instance.onboardingStep)) {
    initialStep = "telegram";
  } else if (["awaiting_llm_choice", "configuring_llm"].includes(instance.onboardingStep)) {
    initialStep = "llm";
  } else if (instance.onboardingStep === "complete") {
    initialStep = "complete";
  }

  return (
    <OnboardingFunnel
      initialStep={initialStep}
      botUsername={instance?.telegramBotUsername || undefined}
      checkoutPending={checkoutPending}
    />
  );
}
