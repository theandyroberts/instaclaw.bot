import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getConsoleUrl } from "@/lib/worker-client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const instance = await prisma.instance.findUnique({
      where: { userId: session.user.id },
      select: { id: true, status: true },
    });

    if (!instance) {
      return NextResponse.json({ error: "No instance found" }, { status: 404 });
    }

    if (instance.status !== "active") {
      return NextResponse.json(
        { error: "Instance is not active" },
        { status: 400 }
      );
    }

    const { consoleUrl } = await getConsoleUrl(instance.id, session.user.id);

    return NextResponse.json({ consoleUrl });
  } catch (error) {
    console.error("Console URL error:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
