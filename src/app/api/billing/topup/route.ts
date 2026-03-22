import { auth } from "@/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Top-up credit amounts per plan (USD added to OpenRouter key) */
const TOPUP_CREDIT: Record<string, number> = {
  starter: 3,
  standard: 3,
  pro: 6,
};

/** Customer-facing price per top-up unit (cents) */
const TOPUP_PRICE: Record<string, number> = {
  starter: 500, // $5
  standard: 500,
  pro: 1000, // $10
};

const TOPUP_NAMES: Record<string, string> = {
  starter: "AI Capacity Top-Up",
  standard: "AI Capacity Top-Up",
  pro: "AI Capacity Top-Up (Pro)",
};

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { quantity = 1 } = await req.json().catch(() => ({}));
    const qty = Math.max(1, Math.min(10, Math.floor(quantity)));

    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    if (!subscription || subscription.status !== "active") {
      return NextResponse.json({ error: "No active subscription" }, { status: 400 });
    }

    const instance = await prisma.instance.findUnique({
      where: { userId: session.user.id },
      select: { id: true, openrouterKeyId: true },
    });

    if (!instance?.openrouterKeyId) {
      return NextResponse.json({ error: "No AI key configured" }, { status: 400 });
    }

    const plan = subscription.plan;
    const unitPrice = TOPUP_PRICE[plan] || 500;
    const unitCredit = TOPUP_CREDIT[plan] || 3;
    const productName = TOPUP_NAMES[plan] || "AI Capacity Top-Up";

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: subscription.stripeCustomerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: productName,
              description: `Adds $${unitCredit} of AI capacity per unit`,
            },
            unit_amount: unitPrice,
          },
          adjustable_quantity: {
            enabled: true,
            minimum: 1,
            maximum: 10,
          },
          quantity: qty,
        },
      ],
      mode: "payment",
      metadata: {
        type: "topup",
        userId: session.user.id,
        instanceId: instance.id,
        openrouterKeyId: instance.openrouterKeyId,
        creditPerUnit: String(unitCredit),
        plan,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?topup=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?topup=canceled`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Top-up checkout error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
