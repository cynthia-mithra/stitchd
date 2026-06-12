-- Phase 12 — Email infrastructure & transactional notifications.
--
-- Adds the three profile columns the send-email Edge Function relies on. Like the
-- other Phase 10/11 migrations these are plain ALTERs with IF NOT EXISTS, so they
-- inherit the project's existing access model and are safe to re-run.

-- Unsubscribe switch. Checked before EVERY email; the footer "Unsubscribe" link
-- flips it to false via the send-email function's GET endpoint. Default true so
-- existing users keep receiving transactional mail.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_notifications boolean DEFAULT true;
UPDATE profiles SET email_notifications = true WHERE email_notifications IS NULL;

-- Welcome-email idempotency. The welcome email is fired from the data layer on
-- every profile upsert (the only reliable new-user signal available client-side),
-- so the function dedupes on this flag: send once, set true, never send again.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS welcome_email_sent boolean DEFAULT false;

-- Presence proxy for the "don't email an active user" rule on new-message emails.
-- Touched by the data layer when a user sends/reads messages and on notification
-- polls; the new-message email is suppressed if this is within the last 10 min.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at timestamp with time zone;
