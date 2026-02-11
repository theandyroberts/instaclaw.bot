import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const instance = await prisma.instance.findUnique({
      where: { userId: session.user.id },
    });

    if (!instance) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      status: instance.status,
      onboardingStep: instance.onboardingStep,
      telegramBotUsername: instance.telegramBotUsername,
      llmProvider: instance.llmProvider,
      llmConfigured: instance.llmConfigured,
      healthStatus: instance.healthStatus,
      provisionLog: instance.provisionLog,
    });
  } catch (error) {
    console.error("Instance status error:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
