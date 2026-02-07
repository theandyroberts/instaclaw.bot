import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { enqueueLLMConfig } from "@/lib/worker-client";
import { z } from "zod";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const llmSchema = z.object({
  provider: z.enum(["kimi", "claude", "openai", "gemini", "minimax"]),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const instance = await prisma.instance.findUnique({
      where: { userId: session.user.id },
    });

    if (!instance) {
      return new NextResponse("No instance found", { status: 404 });
    }

    if (instance.onboardingStep !== "awaiting_llm_choice") {
      return new NextResponse("Not ready for LLM configuration", { status: 400 });
    }

    const body = await req.json();
    const { provider } = llmSchema.parse(body);

    // Check if plan allows the chosen provider
    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    if (subscription?.plan === "starter" && provider !== "kimi") {
      return NextResponse.json(
        { error: "Starter plan only supports Kimi. Upgrade to Pro for other AI models." },
        { status: 403 }
      );
    }

    // Update instance
    await prisma.instance.update({
      where: { id: instance.id },
      data: {
        llmProvider: provider,
        onboardingStep: "configuring_llm",
      },
    });

    // Enqueue LLM configuration job
    await enqueueLLMConfig(instance.id, provider, subscription?.plan || "starter");

    return NextResponse.json({ provider });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid LLM provider" }, { status: 400 });
    }
    console.error("LLM config error:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
