# Deploying the Supabase Edge Functions

This project ships three Edge Functions. All of them live in `supabase/functions/`
and are configured in `supabase/config.toml` (all three run with `verify_jwt = false`):

| Function          | Purpose                                                        |
| ----------------- | ------------------------------------------------------------- |
| `stripe-checkout` | Creates a Stripe Checkout Session from the buyer's bag.        |
| `stripe-webhook`  | Handles `checkout.session.completed`: marks listings sold, creates orders, notifies sellers. |
| `verify-session`  | Confirms a session was paid for the `/order-success` page.     |

> **Why a 404?** A function only answers at `https://<ref>.functions.supabase.co/<name>`
> once it has been **deployed**. Having the code in this repo is not enough — Supabase
> does not auto-deploy from GitHub. If `stripe-webhook` is missing from the dashboard,
> it simply has not been deployed yet.

## Prerequisites (run locally — needs secrets, cannot run in CI)

```bash
# 1. Install the Supabase CLI  (https://supabase.com/docs/guides/cli)
npm install -g supabase            # or: brew install supabase/tap/supabase

# 2. Authenticate (opens a browser / paste an access token)
supabase login

# 3. Link this repo to the project
supabase link --project-ref zhstooqgkyuzxseylsbk
```

## Deploy all three functions

```bash
supabase functions deploy stripe-webhook  --project-ref zhstooqgkyuzxseylsbk
supabase functions deploy stripe-checkout --project-ref zhstooqgkyuzxseylsbk
supabase functions deploy verify-session  --project-ref zhstooqgkyuzxseylsbk
```

`config.toml` already pins `verify_jwt = false` for each, so no `--no-verify-jwt`
flag is required when deploying through the linked project.

## Set the required secrets

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...        --project-ref zhstooqgkyuzxseylsbk
supabase secrets set STRIPE_SECRET_KEY=sk_...               --project-ref zhstooqgkyuzxseylsbk
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...          --project-ref zhstooqgkyuzxseylsbk
supabase secrets set SITE_URL=https://stitchd.fit          --project-ref zhstooqgkyuzxseylsbk
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected automatically by Supabase —
do not set them.

> ⚠️ **Test vs live keys:** every function file documents `STRIPE_SECRET_KEY` as a
> **test-mode** key (`sk_test_…`). The `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
> must come from the **same** Stripe mode (both test, or both live). A test webhook
> secret with a live key (or vice-versa) makes signature verification fail with a
> `400`. If you move to live mode, update the function header comments too.

## After deploying

1. Confirm all three functions show in **Supabase → Edge Functions**.
2. In the **Stripe Dashboard → Developers → Webhooks**, add (or repoint) an endpoint to:
   `https://zhstooqgkyuzxseylsbk.functions.supabase.co/stripe-webhook`
   listening for `checkout.session.completed`, and copy its signing secret into
   `STRIPE_WEBHOOK_SECRET` above.
3. Tail logs while testing a purchase:
   ```bash
   supabase functions logs stripe-webhook --project-ref zhstooqgkyuzxseylsbk
   ```
