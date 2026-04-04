import { stripe, getPlanFromPriceId } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { enqueueAllocate, enqueueSuspend, enqueueUnsuspend, enqueueUpdatePlan } from "@/lib/worker-client";
import { sendEmail, instanceSuspendedEmail } from "@/lib/email";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { NextResponse } from "next/server";

const META_PIXEL_ID = "1155286039988555";
const META_ACCESS_TOKEN = process.env.META_CONVERSIONS_API_TOKEN;

async function fireMetaPurchase(email: string, amountUsd: number) {
  if (!META_ACCESS_TOKEN) return;
  try {
    const crypto = await import("crypto");
    const hashedEmail = crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
    await fetch(`https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [{
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          action_source: "website",
          user_data: { em: [hashedEmail] },
          custom_data: { currency: "USD", value: amountUsd },
        }],
        access_token: META_ACCESS_TOKEN,
      }),
    });
  } catch (err) {
    console.error("Meta CAPI Purchase failed:", err);
  }
}

export const dynamic = 'force-dynamic';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

function getSubscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  return {
    currentPeriodStart: new Date(item.current_period_start * 1000),
    currentPeriodEnd: new Date(item.current_period_end * 1000),
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature")!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Webhook signature verification failed:", message);
      return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Handle top-up payments
        if (session.metadata?.type === "topup" && session.payment_status === "paid") {
          const { openrouterKeyId, creditPerUnit, userId } = session.metadata;
          const creditPer = parseFloat(creditPerUnit || "3");

          // Get the actual quantity from the line items
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
          const qty = lineItems.data[0]?.quantity || 1;
          const totalCredit = creditPer * qty;

          if (openrouterKeyId) {
            try {
              // Fetch current key limit from OpenRouter and add credit
              const orRes = await fetch(`https://openrouter.ai/api/v1/keys/${openrouterKeyId}`, {
                headers: { Authorization: `Bearer ${process.env.OPENROUTER_MANAGEMENT_KEY}` },
              });
              if (orRes.ok) {
                const keyData = await orRes.json();
                const currentLimit = keyData.data?.limit || 15;
                const newLimit = currentLimit + totalCredit;

                await fetch(`https://openrouter.ai/api/v1/keys/${openrouterKeyId}`, {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${process.env.OPENROUTER_MANAGEMENT_KEY}`,
                  },
                  body: JSON.stringify({ limit: newLimit }),
                });

                console.log(
                  `Top-up: ${userId} purchased ${qty}x ($${totalCredit} credit). Key limit: $${currentLimit} → $${newLimit}`
                );
              }
            } catch (err) {
              console.error("Failed to update OpenRouter key for top-up:", err);
            }
          }
          break;
        }

        if (session.subscription) {
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;

          const subscription = await stripe.subscriptions.retrieve(subscriptionId);

          const userId = subscription.metadata.userId;
          const plan = (subscription.metadata.plan as "starter" | "standard" | "pro") || "standard";
          const priceId = subscription.items.data[0].price.id;

          if (!userId) {
            console.error("No userId in subscription metadata");
            break;
          }

          // Check for existing subscription (idempotency)
          const existing = await prisma.subscription.findUnique({
            where: { stripeSubscriptionId: subscription.id },
          });

          if (existing) {
            console.log("Subscription already exists, skipping");
            break;
          }

          const period = getSubscriptionPeriod(subscription);

          // Create subscription
          await prisma.subscription.create({
            data: {
              userId,
              stripeCustomerId:
                typeof session.customer === "string"
                  ? session.customer
                  : session.customer?.id || "",
              stripeSubscriptionId: subscription.id,
              stripePriceId: priceId,
              plan: getPlanFromPriceId(priceId) || plan,
              status: "active",
              currentPeriodStart: period.currentPeriodStart,
              currentPeriodEnd: period.currentPeriodEnd,
            },
          });

          // Fire Meta Pixel Purchase via Conversions API
          const amount = session.amount_total
            ? session.amount_total / 100
            : 35;
          const customerEmail = session.customer_details?.email || session.customer_email || "";
          fireMetaPurchase(customerEmail, amount);

          // Create instance and trigger provisioning
          const instance = await prisma.instance.create({
            data: {
              userId,
              status: "pending",
              onboardingStep: "awaiting_provision",
              llmProvider: "kimi",
            },
          });

          // Enqueue allocation (uses pool if available, falls back to standard provision)
          try {
            await enqueueAllocate(instance.id, userId);
          } catch (err) {
            console.error("Failed to enqueue allocate job:", err);
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionDetails = invoice.parent?.subscription_details;
        const subscriptionField = subscriptionDetails?.subscription;

        if (subscriptionField) {
          const subscriptionId =
            typeof subscriptionField === "string"
              ? subscriptionField
              : subscriptionField.id;

          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const period = getSubscriptionPeriod(subscription);

          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: subscription.id },
            data: {
              status: "active",
              currentPeriodStart: period.currentPeriodStart,
              currentPeriodEnd: period.currentPeriodEnd,
            },
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const failedSubDetails = invoice.parent?.subscription_details;
        const failedSubField = failedSubDetails?.subscription;

        if (failedSubField) {
          const subscriptionId =
            typeof failedSubField === "string"
              ? failedSubField
              : failedSubField.id;

          const sub = await prisma.subscription.findUnique({
            where: { stripeSubscriptionId: subscriptionId },
            include: { user: true },
          });

          if (sub) {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: { status: "past_due" },
            });

            const emailContent = instanceSuspendedEmail(sub.user.name || "");
            await sendEmail({
              to: sub.user.email,
              ...emailContent,
            });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        const sub = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: subscription.id },
          include: { user: { include: { instance: true } } },
        });

        if (sub) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: "canceled" },
          });

          if (sub.user.instance) {
            await prisma.instance.update({
              where: { id: sub.user.instance.id },
              data: {
                status: "suspended",
                suspendedAt: new Date(),
              },
            });

            try {
              await enqueueSuspend(sub.user.instance.id);
            } catch (err) {
              console.error("Failed to enqueue suspend job:", err);
            }
          }

          const emailContent = instanceSuspendedEmail(sub.user.name || "");
          await sendEmail({
            to: sub.user.email,
            ...emailContent,
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        const sub = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: subscription.id },
          include: { user: { include: { instance: true } } },
        });

        if (sub) {
          const previousStatus = sub.status;
          const period = getSubscriptionPeriod(subscription);

          // Detect plan change (upgrade or downgrade)
          const newPriceId = subscription.items.data[0]?.price.id;
          const newPlan = newPriceId ? getPlanFromPriceId(newPriceId) : null;
          const planChanged = newPlan && newPlan !== sub.plan;

          await prisma.subscription.update({
            where: { id: sub.id },
            data: {
              status: subscription.status as never,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              currentPeriodStart: period.currentPeriodStart,
              currentPeriodEnd: period.currentPeriodEnd,
              ...(planChanged
                ? { plan: newPlan, stripePriceId: newPriceId }
                : {}),
            },
          });

          // Handle reactivation from canceled/past_due
          if (
            (previousStatus === "canceled" || previousStatus === "past_due") &&
            subscription.status === "active" &&
            sub.user.instance?.status === "suspended"
          ) {
            await prisma.instance.update({
              where: { id: sub.user.instance.id },
              data: {
                status: "active",
                suspendedAt: null,
              },
            });

            try {
              await enqueueUnsuspend(sub.user.instance.id);
            } catch (err) {
              console.error("Failed to enqueue unsuspend job:", err);
            }
          }

          // Handle plan change — update OpenRouter key limit + reconfigure
          if (
            planChanged &&
            sub.user.instance?.status === "active"
          ) {
            try {
              await enqueueUpdatePlan(sub.user.instance.id, newPlan);
              console.log(
                `Plan changed ${sub.plan} → ${newPlan} for instance ${sub.user.instance.id}`
              );
            } catch (err) {
              console.error("Failed to enqueue update-plan job:", err);
            }
          }
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
