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
```

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
