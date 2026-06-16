# Deploying the Stripe Edge Functions

These steps must be run locally by a project owner with the Supabase CLI — they
require your Supabase access token and the real secret values, which are not
available in CI.

## 1. Link the project (once)

```bash
supabase login                       # opens browser, stores an access token
supabase link --project-ref zhstooqgkyuzxseylsbk
```

## 2. Set secrets on the Edge Functions

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_...      # LIVE key (payments are live)
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...    # signing secret of the LIVE endpoint
supabase secrets set SITE_URL=https://stitchd.fit       # used by stripe-checkout
```

> **Do NOT set `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`.** Supabase injects
> these automatically into every Edge Function, and `supabase secrets set`
> **rejects** any name starting with `SUPABASE_`. The webhook reads the
> auto-injected service-role key — no action needed.

> `SITE_URL` is only consumed by `stripe-checkout` (success/cancel URLs). The
> `stripe-webhook` function does not read it, but setting it project-wide is fine.

## 3. Deploy

```bash
supabase functions deploy stripe-webhook
# Phase 13 — promoted listings (paid boost):
supabase functions deploy create-promotion-session
supabase functions deploy expire-promotions
# Phase 14 — seller responds to offers (offer expiry sweep):
supabase functions deploy expire-offers
# (the offer accept/decline emails reuse the existing send-email function)
# Phase 14 — offer checkout (pay an accepted offer at the offer price):
supabase functions deploy create-offer-checkout
# Re-deploy stripe-webhook + expire-offers — they gained the offer-payment +
# payment-expiry/12h-reminder handling in this phase:
supabase functions deploy stripe-webhook
supabase functions deploy expire-offers
# Phase 15 — alteration booking checkout (pay a tailor's quote, 15% commission):
supabase functions deploy create-alteration-checkout
# Re-deploy stripe-webhook + send-email — the webhook gained the alteration
# booking-payment handler (metadata.type='alteration') and send-email gained the
# "please confirm completion" buyer email:
supabase functions deploy stripe-webhook
supabase functions deploy send-email
# Phase 15 — Stripe Connect for tailor payouts (Express accounts). Three new
# functions; send-email gained the "Payment sent" payout email template:
supabase functions deploy create-connect-account
supabase functions deploy verify-connect-account
supabase functions deploy process-tailor-payout
supabase functions deploy send-email
```

> **Stripe Connect note (Phase 15):** these three functions implement tailor
> payouts via Connect **Express** accounts. They reuse the existing
> `STRIPE_SECRET_KEY` / `SITE_URL` / auto-injected service-role secrets — no new
> secrets. **Run the `20260616040000_phase15_stripe_connect.sql` migration first**
> so the `tailors.stripe_account_id` / `stripe_onboarding_complete` /
> `stripe_onboarding_url` columns and the `tailor_payouts.stripe_transfer_id` /
> `paid_at` / `failure_reason` columns exist. **Stripe Connect must be ENABLED on
> the Stitch'd account before this can be tested end to end** — see the PR
> description. The browser calls these functions directly (they return permissive
> CORS headers, like the identity/promotion flows), so no Vercel proxy is needed.
> Test with Connect test mode + test Express accounts and card
> `4242 4242 4242 4242` before going live.

> **Offer checkout note:** the browser calls the same-origin Vercel proxy
> `/api/create-offer-checkout` (mirroring the sale flow's `/api/stripe-checkout`),
> which uses the existing `STRIPE_SECRET_KEY` Vercel env var. The Supabase
> `create-offer-checkout` function above is the deployed sibling/fallback.

> **Alteration checkout note (Phase 15):** same pattern — the browser calls the
> same-origin Vercel proxy `/api/create-alteration-checkout`; the Supabase
> `create-alteration-checkout` function is the deployed sibling/fallback. The
> payment result arrives on `stripe-webhook` (`metadata.type === 'alteration'`),
> which flips the request to `accepted`, records a `tailor_payouts` row and emails
> both parties. **Run the `20260616010000_phase15_tailor_payments.sql` migration
> first** so the payment columns + `tailor_payouts` table exist. Test with card
> `4242 4242 4242 4242` before going live. **Actual tailor payouts require Stripe
> Connect — not in this phase; see the PR description.**

`verify_jwt = false` is pinned for these functions in `supabase/config.toml`, so
the CLI applies it automatically. If you deploy without the config file present,
pass the flag explicitly instead:

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```

Without `verify_jwt = false`, Supabase requires a valid JWT and Stripe's
unauthenticated POST is rejected with **401** (the function would exist but
never process events).

## 4. Verify

- `supabase functions list` should show `stripe-webhook` (also visible in
  Supabase Dashboard → Edge Functions).
- The endpoint should answer `POST`s at
  `https://zhstooqgkyuzxseylsbk.supabase.co/functions/v1/stripe-webhook`
  (a `GET` correctly returns 405 — only `POST` is handled).

## 5. Confirm the Stripe endpoint matches

In Stripe Dashboard → Developers → Webhooks, the **live-mode** endpoint must:

- point to the function URL above,
- listen for `checkout.session.completed`,
- and its signing secret must equal the `STRIPE_WEBHOOK_SECRET` you set in
  step 2. A mismatch causes the function to reject deliveries with **400**
  ("Webhook signature verification failed"), not 404.

> **Phase 13 — promoted listings.** The same webhook endpoint and
> `checkout.session.completed` event also drive promotion payments — the function
> branches on `session.metadata.type === 'promotion'`, so no extra Stripe event is
> needed. The hourly expiry sweep (`expire-promotions`) is scheduled by the
> `20260615130000_phase13_promoted_listings.sql` migration via pg_cron/pg_net; it
> reuses the `service_role_key` you already set in Vault for the Phase 12
> saved-search cron. Test the boost with card `4242 4242 4242 4242` before going
> live.

## 6. Replay the failed event

Stripe Dashboard → Webhooks → the endpoint → **Event deliveries** → open the
failed `checkout.session.completed` event → **Resend**. Then confirm in Supabase
that the affected `listings.status` flips to `sold`.
