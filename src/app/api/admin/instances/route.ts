import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const instances = await prisma.instance.findMany({
      include: {
        user: {
          select: {
            email: true,
            name: true,
            subscription: {
              select: { plan: true, status: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(instances);
  } catch (error) {
    console.error("Admin instances error:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
