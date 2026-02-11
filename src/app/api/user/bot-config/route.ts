import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const botConfigSchema = z.object({
  botName: z.string().min(1).max(100),
  personality: z.enum(["friendly", "professional", "witty", "custom"]),
  customPersonality: z.string().max(500).optional(),
  userName: z.string().min(1).max(100),
  userDescription: z.string().max(1000).optional(),
  useCases: z.array(z.string()).min(1),
  extraContext: z.string().max(2000).optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const botConfig = botConfigSchema.parse(body);

    await prisma.user.update({
      where: { id: session.user.id },
      data: { botConfig: JSON.parse(JSON.stringify(botConfig)) },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid bot configuration", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Bot config error:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
