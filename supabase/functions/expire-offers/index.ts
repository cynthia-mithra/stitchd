// Supabase Edge Function: expire-offers
// --------------------------------------
// Sweeps expired offers (issue PART 5). Called hourly by the pg_cron job in the
// phase14 offers-response migration (and safe to POST manually for a test).
// An offer expires 48 hours after it's made if the seller hasn't responded
// (offers.expires_at defaults to now() + 48h). For every pending offer whose
// deadline has passed it:
//   1. marks the offer 'expired'        (offers.status='expired')
//   2. notifies the BUYER in-app        ("Your offer on … has expired.")
//   3. notifies the SELLER in-app       ("An offer on … has expired without a
//                                         response.")
//
// Doing this in an Edge Function rather than pure SQL is what lets the cron send
// the in-app notifications a plain UPDATE can't — mirroring expire-promotions.
//
// Required environment variables (auto-injected by Supabase):
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
//
// Deploy: supabase functions deploy expire-offers --no-verify-jwt

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const sbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// PostgREST rejects the whole insert if a column doesn't exist (PGRST204). Drop
// any missing column and retry — same approach as expire-promotions.
const missingColumn = (msg: string) => {
  const m = /Could not find the '([^']+)' column/.exec(msg || "");
  return m ? m[1] : null;
};
async function insertHealing(table: string, body: Record<string, unknown>) {
  let payload = { ...body };
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: sbHeaders,
      body: JSON.stringify(payload),
    });
    if (res.ok) return;
    const text = await res.text();
    const col = missingColumn(text);
    if (col && Object.prototype.hasOwnProperty.call(payload, col)) {
      delete payload[col];
      continue;
    }
    console.error(`Insert into ${table} failed:`, text);
    return;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const nowIso = new Date().toISOString();
  let expiredCount = 0;

  try {
    // The pending offers whose 48 hours are up. Embed the listing name so the
    // notifications can reference the title without a per-offer round-trip.
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/offers?status=eq.pending&expires_at=lt.${nowIso}&select=id,listing_id,buyer_id,seller_id,listings(name)`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    );
    let due: Array<{
      id: string;
      listing_id: string;
      buyer_id: string;
      seller_id: string;
      listings?: { name?: string } | null;
    }> = r.ok ? await r.json() : [];

    // Fall back to a plain select if the embed isn't available on this deployment.
    if (!r.ok) {
      const r2 = await fetch(
        `${SUPABASE_URL}/rest/v1/offers?status=eq.pending&expires_at=lt.${nowIso}&select=id,listing_id,buyer_id,seller_id`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
      );
      due = r2.ok ? await r2.json() : [];
    }

    for (const offer of due) {
      // 1. Mark the offer expired.
      const patch = await fetch(`${SUPABASE_URL}/rest/v1/offers?id=eq.${offer.id}`, {
        method: "PATCH",
        headers: sbHeaders,
        body: JSON.stringify({ status: "expired" }),
      }).catch(() => null);
      if (!patch || !patch.ok) continue;
      expiredCount++;

      // Resolve the listing title if the embed didn't ride along.
      let title = offer.listings?.name;
      if (!title && offer.listing_id) {
        const lr = await fetch(
          `${SUPABASE_URL}/rest/v1/listings?id=eq.${offer.listing_id}&select=name&limit=1`,
          { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
        ).catch(() => null);
        const rows = lr && lr.ok ? await lr.json().catch(() => []) : [];
        title = rows[0]?.name;
      }
      title = title || "a listing";

      // 2. Notify the buyer.
      if (offer.buyer_id) {
        await insertHealing("notifications", {
          user_id: offer.buyer_id,
          type: "offer",
          title: "Offer expired",
          body: `Your offer on ${title} has expired.`,
          link_id: offer.listing_id,
          read: false,
        });
      }

      // 3. Notify the seller.
      if (offer.seller_id) {
        await insertHealing("notifications", {
          user_id: offer.seller_id,
          type: "offer",
          title: "Offer expired",
          body: `An offer on ${title} has expired without a response.`,
          link_id: offer.listing_id,
          read: false,
        });
      }
    }

    return json({ ok: true, expired: expiredCount });
  } catch (e) {
    console.error("expire-offers error:", (e as Error).message);
    return json({ ok: false, error: (e as Error).message }, 200);
  }
});
