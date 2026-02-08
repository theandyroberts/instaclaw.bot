import { auth } from "@/auth";
import { stripe, getPlanFromPriceId } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { priceId } = await req.json();

    const plan = getPlanFromPriceId(priceId);
    if (!plan) {
      return new NextResponse("Invalid price", { status: 400 });
    }

    // Check if user already has a subscription
    const existing = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    if (existing && existing.status === "active") {
      return new NextResponse("Already subscribed", { status: 400 });
    }

    // Get or create Stripe customer
    let customerId = existing?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email!,
        name: session.user.name || undefined,
        metadata: { userId: session.user.id },
      });
      customerId = customer.id;
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/?canceled=true`,
      subscription_data: {
        metadata: { userId: session.user.id, plan },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
