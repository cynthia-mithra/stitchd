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

# Phase 14 — offer accepted / declined (recipient is the buyer, resolved from the offer)
curl -X POST $FN -H 'Content-Type: application/json' \
  -d '{"type":"offer_accepted","offerId":"<offer id>"}'
curl -X POST $FN -H 'Content-Type: application/json' \
  -d '{"type":"offer_declined","offerId":"<offer id>","counterPence":4000}'

# Phase 15 — alteration marked complete (recipient is the buyer, resolved from the request)
curl -X POST $FN -H 'Content-Type: application/json' \
  -d '{"type":"alteration_completed_buyer","requestId":"<alteration request id>"}'

# Phase 15 — new tailor review (recipient is the tailor, resolved from the review)
curl -X POST $FN -H 'Content-Type: application/json' \
  -d '{"type":"tailor_review","reviewId":"<tailor review id>"}'
```

> **Phase 15 — booking confirmation emails.** The two "booking confirmed" emails
> (`alteration_booking_tailor` + `alteration_booking_buyer`) are sent by the
> `stripe-webhook` on `checkout.session.completed` (`metadata.type='alteration'`),
> not via this endpoint — test them with a real Stripe **test-mode** alteration
> checkout (card `4242 4242 4242 4242`) or by replaying the event.

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

## Saved-search alerts (Phase 12 — saved searches)

Buyers save shop filters (`saved_searches` table) and get a **NEW MATCHES FOR
YOU** email when fresh listings match. The `saved-search-alerts` Edge Function
runs the sweep:

```
 pg_cron (every 6h) ─┐
                     ├─► saved-search-alerts ─► _shared/email.ts ─► Resend ─► inbox
 new listing ────────┘   (filters listings, renders saved_search_alert template)
 (db.triggerSavedSearchAlerts, fire-and-forget)
```

It reuses the shared brand template + Resend helper (no extra hop), honours the
same `email_notifications` unsubscribe flag, and stamps `last_alerted_at` so the
same listing is never emailed twice.

### Setup

```bash
# 1. Migrations (saved_searches table + every-6h cron)
supabase db push

# 2. Deploy (verify_jwt=false is pinned in config.toml)
supabase functions deploy saved-search-alerts

# 3. Schedule (cron migration). Needs pg_cron + pg_net enabled and the
#    service-role key reachable from SQL. Enable the extensions in
#    Dashboard → Database → Extensions, then provide the key once:
#      select vault.create_secret('<service_role_key>', 'service_role_key');
#    and re-run: supabase db push   (the cron migration is idempotent).
```

No new secrets — it reuses `RESEND_API_KEY` / `SITE_URL` and the auto-injected
service-role key. Test on demand:

```bash
curl -X POST https://zhstooqgkyuzxseylsbk.supabase.co/functions/v1/saved-search-alerts \
  -H 'Content-Type: application/json' -d '{}'
# → {"ok":true,"searches":<n>,"results":{"sent":x,"no-match":y,…}}
```

## Unsubscribe

Every footer carries a signed link to
`…/functions/v1/send-email?unsubscribe=1&u=<userId>&sig=<hmac>`. Opening it
verifies the HMAC, sets `profiles.email_notifications = false`, and shows a small
branded confirmation page. All sends check this flag first.
