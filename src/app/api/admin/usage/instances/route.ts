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

    const PLAN_BUDGETS: Record<string, number> = { starter: 5, standard: 5, pro: 30 };

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
      orderBy: { llmSpendMonthly: "desc" },
    });

    const result = instances.map((i) => {
      const plan = i.user.subscription?.plan || "standard";
      const budget = PLAN_BUDGETS[plan] || 5;
      return {
        instanceId: i.id,
        email: i.user.email,
        plan,
        spendMonthly: i.llmSpendMonthly,
        limit: budget,
        pctUsed: (i.llmSpendMonthly / budget) * 100,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Admin usage instances error:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
