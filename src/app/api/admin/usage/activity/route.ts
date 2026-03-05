import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const days = parseInt(req.nextUrl.searchParams.get("days") || "7");
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    const sinceStr = since.toISOString().split("T")[0];

    const logs = await prisma.llmActivityLog.findMany({
      where: { date: { gte: sinceStr } },
      orderBy: { date: "asc" },
    });

    // Daily cost timeseries
    const dailyMap = new Map<string, number>();
    const modelMap = new Map<string, number>();
    const providerMap = new Map<string, number>();

    for (const log of logs) {
      dailyMap.set(log.date, (dailyMap.get(log.date) || 0) + log.costUsd);
      modelMap.set(log.model, (modelMap.get(log.model) || 0) + log.costUsd);
      providerMap.set(log.providerName, (providerMap.get(log.providerName) || 0) + log.costUsd);
    }

    const daily = Array.from(dailyMap.entries())
      .map(([date, cost]) => ({ date, cost }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const byModel = Array.from(modelMap.entries())
      .map(([model, cost]) => ({ model, cost }))
      .sort((a, b) => b.cost - a.cost);

    const byProvider = Array.from(providerMap.entries())
      .map(([provider, cost]) => ({ provider, cost }))
      .sort((a, b) => b.cost - a.cost);

    return NextResponse.json({ daily, byModel, byProvider });
  } catch (error) {
    console.error("Admin usage activity error:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
