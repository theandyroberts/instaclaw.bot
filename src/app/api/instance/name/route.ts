import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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

    await prisma.instance.update({
      where: { userId: session.user.id },
      data: { instanceName: name },
    });

    return NextResponse.json({ instanceName: name });
  } catch (error) {
    console.error("Update instance name error:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
