# Phase 12 — Email infrastructure (Resend)

Transactional emails are sent via [Resend](https://resend.com) through a single
Edge Function, `send-email`. Every email shares one brand template
(`_shared/email-templates.ts`); delivery, recipient resolution and the signed
unsubscribe links live in `_shared/email.ts`.

## Architecture

```
 Stripe payment ──► stripe-webhook ─┐
                                    ├─► _shared/email.ts ─► Resend ─► inbox
 Browser action ──► db.js fireEmail ─► send-email ───────┘
 (status / message / verify / signup)
```

- **Emails 1 & 2** (order confirmation, sale) are sent **server-side** from
  `stripe-webhook` on `checkout.session.completed` — they reuse the shared
  template/Resend helpers directly (no extra hop).
- **Emails 3–7** (dispatched, delivered, new message, verification approved,
  welcome) are triggered from the **data layer** (`src/lib/db.js → fireEmail`),
  which POSTs the event + ids to `send-email`. The browser never sees a
  recipient's email — `send-email` resolves it from `auth.users` with the
  service role, renders the template, and honours the unsubscribe flag. No
  frontend pages, `App.js` modals, or Stripe/checkout code were touched.

## One-time setup

### 1. Verify the sending domain in Resend

1. Add `stitchd.fit` in Resend → **Domains**.
2. Add the DKIM/SPF/return-path DNS records Resend shows to the `stitchd.fit`
   DNS zone and wait for **Verified**.
3. Confirm the sender `hello@stitchd.fit` is allowed (it's the `EMAIL_FROM`).

### 2. Set the secrets

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx   # ← REQUIRED, from Resend
supabase secrets set SITE_URL=https://stitchd.fit              # link targets (already used by stripe-checkout)
# Optional — signs unsubscribe links. Defaults to the service-role key if unset:
supabase secrets set EMAIL_UNSUB_SECRET=$(openssl rand -hex 32)
# Optional — override the From header (defaults to "Stitch'd <hello@stitchd.fit>"):
# supabase secrets set EMAIL_FROM="Stitch'd <hello@stitchd.fit>"
```

> Do **not** set `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — Supabase injects
> these automatically and rejects any `SUPABASE_`-prefixed secret.

### 3. Run the migration

`supabase/migrations/20260612093000_phase12_email_notifications.sql` adds
`email_notifications`, `welcome_email_sent` and `last_active_at` to `profiles`.
Apply it via `supabase db push` (or paste into the SQL editor).

### 4. Deploy the functions

```bash
supabase functions deploy send-email      # verify_jwt=false (pinned in config.toml)
supabase functions deploy stripe-webhook  # redeploy — now also sends order/sale emails
```

## Testing each email in development

Templated sends can be exercised directly (the function resolves real users):

```bash
FN=https://zhstooqgkyuzxseylsbk.supabase.co/functions/v1/send-email

# Welcome (idempotent — clears after first send via welcome_email_sent)
curl -X POST $FN -H 'Content-Type: application/json' \
  -d '{"type":"welcome","userId":"<a real profile id>"}'

# New message (skipped if the recipient was active in the last 10 min)
curl -X POST $FN -H 'Content-Type: application/json' \
  -d '{"type":"new_message","conversationId":"<conv id>","senderId":"<sender id>","content":"Hi there!"}'

# Order dispatched / delivered
curl -X POST $FN -H 'Content-Type: application/json' \
  -d '{"type":"order_dispatched","orderId":"<order id>"}'

# Verification approved
curl -X POST $FN -H 'Content-Type: application/json' \
  -d '{"type":"verification_approved","applicationId":"<application id>"}'
```

Raw send (service-role only — how the webhook path is shaped). Useful to preview
the shell against any address:

```bash
curl -X POST $FN \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"type":"raw","to":"you@example.com","subject":"Test","html":"<b>hi</b>"}'
```

Order confirmation + sale (emails 1 & 2) are best tested with a real Stripe
**test-mode** checkout, or by replaying a `checkout.session.completed` event from
the Stripe dashboard against the redeployed `stripe-webhook`.

A successful templated call returns `{"ok":true,"sent":"<type>"}`; a deliberately
suppressed one returns `{"skipped":"unsubscribed"|"recipient active"|…}`.

## Unsubscribe

Every footer carries a signed link to
`…/functions/v1/send-email?unsubscribe=1&u=<userId>&sig=<hmac>`. Opening it
verifies the HMAC, sets `profiles.email_notifications = false`, and shows a small
branded confirmation page. All sends check this flag first.
