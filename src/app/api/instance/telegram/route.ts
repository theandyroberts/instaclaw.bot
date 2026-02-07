import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { enqueueTelegramConfig } from "@/lib/worker-client";
import { z } from "zod";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const telegramTokenSchema = z.object({
  token: z.string().regex(/^\d{8,10}:[A-Za-z0-9_-]{35}$/, "Invalid Telegram bot token format"),
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

    if (instance.onboardingStep !== "awaiting_telegram_token") {
      return new NextResponse("Not ready for Telegram configuration", { status: 400 });
    }

    const body = await req.json();
    const { token } = telegramTokenSchema.parse(body);

    // Extract bot username from token by calling Telegram API
    let botUsername = "";
    try {
      const tgResponse = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const tgData = await tgResponse.json();
      if (tgData.ok) {
        botUsername = tgData.result.username;
      } else {
        return NextResponse.json(
          { error: "Invalid Telegram bot token. Please check and try again." },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Could not verify Telegram bot token." },
        { status: 400 }
      );
    }

    // Save token and update step
    await prisma.instance.update({
      where: { id: instance.id },
      data: {
        telegramBotToken: token,
        telegramBotUsername: botUsername,
        onboardingStep: "configuring_telegram",
      },
    });

    // Enqueue configuration job
    await enqueueTelegramConfig(instance.id, token);

    return NextResponse.json({ botUsername });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid token format. Expected format: 1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ1234567890a" },
        { status: 400 }
      );
    }
    console.error("Telegram config error:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
