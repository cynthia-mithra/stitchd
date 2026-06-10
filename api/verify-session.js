// Vercel serverless function: POST /api/verify-session
// -----------------------------------------------------
// Used by the /order-success page. The browser sends the session_id from the
// redirect URL; this asks Stripe whether that session was actually paid and
// returns a small, safe summary for the confirmation screen. Same-origin with
// the app (no CORS), and the Stripe secret key stays server-side.
//
// Required env var: STRIPE_SECRET_KEY (same one used by /api/stripe-checkout).

const Stripe = require("stripe");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return res.status(500).json({ paid: false, error: "STRIPE_SECRET_KEY is not set." });
  const stripe = new Stripe(secret, { apiVersion: "2024-12-18.acacia" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { session_id } = body;
    if (!session_id) return res.status(400).json({ paid: false, error: "Missing session_id." });

    const session = await stripe.checkout.sessions.retrieve(session_id, { expand: ["line_items"] });
    if (session.payment_status !== "paid") return res.status(200).json({ paid: false });

    const items = (session.line_items?.data ?? []).map((li) => ({
      name: li.description ?? "Item",
      amount: li.amount_total ?? 0, // pence
    }));

    return res.status(200).json({
      paid: true,
      currency: session.currency ?? "gbp",
      amount_total: session.amount_total ?? 0, // pence
      listing_ids: (session.metadata?.listing_ids ?? "").split(",").filter(Boolean),
      items,
    });
  } catch (e) {
    return res.status(404).json({ paid: false, error: e.message || "Verification failed." });
  }
};
