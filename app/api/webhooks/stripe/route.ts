import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceRoleClient, hasSupabaseServiceConfig } from "@/lib/supabase/service";

/**
 * Stripe webhooks — verify signature, optional sync of billing_customers from Checkout metadata.
 * Requires STRIPE_WEBHOOK_SECRET; optional STRIPE_SECRET_KEY is not used for verification.
 */
export async function POST(req: Request) {
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!whSecret || !apiKey) {
    return NextResponse.json(
      { received: false, reason: "not configured" },
      { status: 501 },
    );
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(apiKey, {
      apiVersion: "2025-02-24.acacia",
    });
    event = stripe.webhooks.constructEvent(raw, sig, whSecret);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" &&
    hasSupabaseServiceConfig()
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const orgId =
      session.metadata?.org_id && typeof session.metadata.org_id === "string"
        ? session.metadata.org_id
        : null;
    const cust = session.customer;
    const stripeCustomerId =
      typeof cust === "string" ? cust : cust && "id" in cust ? cust.id : null;
    if (orgId && stripeCustomerId) {
      const supabase = createServiceRoleClient();
      await supabase.from("billing_customers").upsert(
        {
          org_id: orgId,
          stripe_customer_id: stripeCustomerId,
        },
        { onConflict: "org_id" },
      );
    }
  }

  return NextResponse.json({ received: true, type: event.type });
}
