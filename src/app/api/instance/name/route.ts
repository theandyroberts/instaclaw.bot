import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { enqueueNameUpdate } from "@/lib/worker-client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NAME_RE = /^[a-z0-9]{3,20}$/;

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { name } = await req.json();

    if (!name || !NAME_RE.test(name)) {
      return NextResponse.json(
        { error: "Name must be 3-20 lowercase alphanumeric characters" },
        { status: 400 }
      );
    }

    // Once set, subdomain is locked — users must contact support to change
    const current = await prisma.instance.findUnique({
      where: { userId: session.user.id },
      select: { instanceName: true },
    });

    if (current?.instanceName) {
      return NextResponse.json(
        { error: "Subdomain is locked after first choice. Contact support to change it." },
        { status: 403 }
      );
    }

    // Check uniqueness
    const existing = await prisma.instance.findFirst({
      where: { instanceName: name },
      select: { userId: true },
    });

    if (existing && existing.userId !== session.user.id) {
      return NextResponse.json(
        { error: "This name is already taken" },
        { status: 409 }
      );
    }

    const instance = await prisma.instance.update({
      where: { userId: session.user.id },
      data: { instanceName: name },
    });

    // Re-deploy skill files with the real subdomain (fire-and-forget)
    if (instance.status === "active") {
      enqueueNameUpdate(instance.id).catch((err) => {
        console.error("Failed to enqueue name update:", err);
      });
    }

    return NextResponse.json({ instanceName: name });
  } catch (error) {
    console.error("Update instance name error:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
