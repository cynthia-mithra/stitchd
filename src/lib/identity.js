// Kicks off Stripe Identity verification for the signed-in seller. We never
// touch Stripe with a secret key from the browser - this posts the seller's
// user_id to the `create-verification-session` Supabase Edge Function, which
// creates the VerificationSession server-side, marks the profile 'pending', and
// returns the URL of the Stripe-hosted flow to redirect to. The pass/fail result
// arrives later on the stripe-webhook function.
import { SUPABASE_URL, SUPABASE_KEY } from "./constants";

export async function startIdentityVerification(userId) {
  if (!userId) throw new Error("You need to be signed in to verify your identity.");

  // Abort if the function never responds, so the button can't hang forever.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/create-verification-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ user_id: userId }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error("Identity verification took too long to start. Please try again.");
    }
    throw new Error("Couldn't reach the verification service. Please check your connection and try again.");
  } finally {
    clearTimeout(timeout);
  }

  const raw = await res.text().catch(() => "");
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON body */ }

  if (!res.ok || !data.url) {
    console.error("[identity] failed", { status: res.status, body: raw });
    const reason =
      data.error ||
      (raw && !raw.trim().startsWith("<") ? raw : "") ||
      `Could not start identity verification (HTTP ${res.status}).`;
    throw new Error(reason);
  }

  // Hand the seller over to Stripe's hosted identity flow.
  window.location.href = data.url;
}
