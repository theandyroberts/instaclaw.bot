import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const { id } = await params;
    const days = parseInt(req.nextUrl.searchParams.get("days") || "30");
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);

    const snapshots = await prisma.llmUsageSnapshot.findMany({
      where: {
        instanceId: id,
        collectedAt: { gte: since },
      },
      orderBy: { collectedAt: "asc" },
      select: {
        usageMonthly: true,
        usageTotal: true,
        limit: true,
        limitRemaining: true,
        collectedAt: true,
      },
    });

    return NextResponse.json(snapshots);
  } catch (error) {
    console.error("Admin usage instance detail error:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
