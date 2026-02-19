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
      id: instance.id,
      status: instance.status,
      onboardingStep: instance.onboardingStep,
      telegramBotUsername: instance.telegramBotUsername,
      llmProvider: instance.llmProvider,
      llmConfigured: instance.llmConfigured,
      healthStatus: instance.healthStatus,
      provisionedAt: instance.provisionedAt,
      ipAddress: instance.ipAddress,
      instanceName: instance.instanceName,
    });
  } catch (error) {
    console.error("Get instance error:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
