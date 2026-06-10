// Supabase Edge Function: verify-session
// ---------------------------------------
// Server-side check used by the /order-success page. The browser sends the
// session_id from the URL; this function asks Stripe whether that session was
// actually paid and returns a small, safe summary (line items + total) for the
// confirmation screen. The Stripe secret key never leaves the server.
//
// Required environment variables:
//   STRIPE_SECRET_KEY   sk_test_…  (TEST MODE)
//
// Deploy: supabase functions deploy verify-session --no-verify-jwt

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { session_id } = await req.json();
    if (!session_id) return json({ paid: false, error: "Missing session_id." }, 400);

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["line_items"],
    });

    const paid = session.payment_status === "paid";
    if (!paid) return json({ paid: false });

    const items = (session.line_items?.data ?? []).map((li) => ({
      name: li.description ?? "Item",
      amount: li.amount_total ?? 0, // pence
    }));

    return json({
      paid: true,
      currency: session.currency ?? "gbp",
      amount_total: session.amount_total ?? 0, // pence
      listing_ids: (session.metadata?.listing_ids ?? "").split(",").filter(Boolean),
      items,
    });
  } catch (e) {
    return json({ paid: false, error: (e as Error).message || "Verification failed." }, 404);
  }
});
