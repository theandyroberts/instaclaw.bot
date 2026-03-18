import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const instances = await prisma.instance.findMany({
      where: { status: "active", openrouterKeyId: { not: null } },
      select: {
        id: true,
        llmSpendMonthly: true,
        user: {
          select: {
            email: true,
            subscription: { select: { plan: true } },
          },
        },
      },
    });

    const PLAN_BUDGETS: Record<string, number> = { starter: 5, standard: 5, pro: 30 };

    const totalMonthlySpend = instances.reduce((sum, i) => sum + i.llmSpendMonthly, 0);
    const instanceCount = instances.length;
    const avgSpendPerInstance = instanceCount > 0 ? totalMonthlySpend / instanceCount : 0;

    const budgetAlerts = instances
      .map((i) => {
        const plan = i.user.subscription?.plan || "standard";
        const budget = PLAN_BUDGETS[plan] || 5;
        const pctUsed = (i.llmSpendMonthly / budget) * 100;
        return { instanceId: i.id, email: i.user.email, pctUsed, spend: i.llmSpendMonthly, budget };
      })
      .filter((a) => a.pctUsed > 80)
      .sort((a, b) => b.pctUsed - a.pctUsed);

    return NextResponse.json({
      totalMonthlySpend,
      instanceCount,
      avgSpendPerInstance,
      budgetAlerts,
    });
  } catch (error) {
    console.error("Admin usage summary error:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
