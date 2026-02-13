import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { OnboardingFunnel } from "@/components/onboarding/funnel";

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ checkout?: string; from?: string }>;
}

type FunnelStep =
  | "welcome"
  | "personality"
  | "use-cases"
  | "bot-name"
  | "extra-context"
  | "about-you"
  | "plan"
  | "provisioning"
  | "telegram"
  | "complete";

export default async function OnboardingPage({ searchParams }: PageProps) {
  const session = await auth();
  const params = await searchParams;
  const isAuthenticated = !!session?.user?.id;
  const justSignedIn = params.from === "auth" && isAuthenticated;

  // If not authenticated, render funnel at step 1 (no DB queries)
  if (!isAuthenticated) {
    return (
      <OnboardingFunnel
        initialStep="welcome"
        isAuthenticated={false}
        justSignedIn={false}
      />
    );
  }

  // Authenticated -- query DB for resumption
  const userId = session!.user!.id!;
  const [user, subscription, instance] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { botConfig: true } }),
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.instance.findUnique({ where: { userId } }),
  ]);

  // --- SELF-HEALING: fix contradictory DB state before rendering ---
  if (instance) {
    const step = instance.onboardingStep;
    const status = instance.status;

    // Droplet is active but step is stuck at awaiting_provision/provisioning
    if (status === "active" && instance.ipAddress && ["awaiting_provision", "provisioning"].includes(step)) {
      const healedStep = instance.telegramBotToken ? "complete" : "awaiting_telegram_token";
      await prisma.instance.update({
        where: { id: instance.id },
        data: {
          onboardingStep: healedStep,
          llmConfigured: true, // If droplet is active, workspace was configured during provisioning
        },
      });
      // Mutate for the rest of this render
      (instance as { onboardingStep: string }).onboardingStep = healedStep;
      (instance as { llmConfigured: boolean }).llmConfigured = true;
    }

    // Telegram token is set but step is still awaiting it
    if (instance.telegramBotToken && ["awaiting_telegram_token", "configuring_telegram", "configuring_workspace"].includes(step)) {
      await prisma.instance.update({
        where: { id: instance.id },
        data: { onboardingStep: "complete" },
      });
      (instance as { onboardingStep: string }).onboardingStep = "complete";
    }
  }

  // Fully onboarded -- go to dashboard
  if (
    subscription?.status === "active" &&
    instance?.onboardingStep === "complete"
  ) {
    redirect("/dashboard");
  }

  const botConfig = user?.botConfig as {
    botName: string;
    personality: string;
    customPersonality?: string;
    userName: string;
    userDescription?: string;
    useCases: string[];
    extraContext?: string;
  } | null;

  // Determine initial step
  let initialStep: FunnelStep = "welcome";
  const checkoutPending = params.checkout === "success" && (!subscription || subscription.status !== "active");

  if (justSignedIn) {
    // Coming back from auth -- funnel will read localStorage and handle the flow
    initialStep = "plan";
  } else if (checkoutPending) {
    // Returning from Stripe -- show payment spinner regardless of botConfig state
    initialStep = "plan";
  } else if (subscription?.status === "active" && (!instance || ["awaiting_provision", "provisioning"].includes(instance.onboardingStep))) {
    // Paid but not yet provisioned
    initialStep = "provisioning";
  } else if (!botConfig) {
    initialStep = "welcome";
  } else if (!subscription || subscription.status !== "active") {
    initialStep = "plan";
  } else if (!instance || ["awaiting_provision", "provisioning"].includes(instance.onboardingStep)) {
    initialStep = "provisioning";
  } else if (["awaiting_telegram_token", "configuring_telegram"].includes(instance.onboardingStep)) {
    initialStep = "telegram";
  } else if (instance.onboardingStep === "configuring_workspace") {
    initialStep = "telegram";
  } else if (instance.onboardingStep === "complete") {
    initialStep = "complete";
  }

  return (
    <OnboardingFunnel
      initialStep={initialStep}
      botUsername={instance?.telegramBotUsername || undefined}
      checkoutPending={checkoutPending}
      initialBotConfig={botConfig}
      sessionName={session?.user?.name || undefined}
      isAuthenticated={true}
      justSignedIn={justSignedIn}
    />
  );
}
