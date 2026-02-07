import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { enqueueUnsuspend } from "@/lib/worker-client";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const { id } = await params;

    const instance = await prisma.instance.findUnique({ where: { id } });
    if (!instance) {
      return new NextResponse("Instance not found", { status: 404 });
    }

    await prisma.instance.update({
      where: { id },
      data: {
        status: "active",
        suspendedAt: null,
      },
    });

    await enqueueUnsuspend(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unsuspend error:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
