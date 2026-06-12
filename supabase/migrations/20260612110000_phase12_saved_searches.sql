-- Phase 12 — Saved searches with email alerts.
--
-- Buyers save their current shop filters and get emailed when new listings
-- match. The `filters` jsonb mirrors the live shop filter state, e.g.
--   {"query":"lehenga","category":"Lehenga","size":"S","min_price":50,
--    "max_price":200,"occasion":["Wedding"],"colour":["Pink","Red"],
--    "verified_only":false}
--
-- An earlier phase shipped a query-only version of this table (db.saveSearch
-- stored {user_id, query, filters}). The CREATE … IF NOT EXISTS below is a no-op
-- where that table already exists; the ADD COLUMN … IF NOT EXISTS lines back-fill
-- the new columns (name, email_alerts, last_alerted_at) so both fresh and
-- upgraded deployments converge on the same shape. Matches the project's other
-- Phase 10/11 migrations: plain idempotent DDL, no RLS (PostgREST access is
-- governed the same way as wishlists/reviews; the alerts function uses the
-- service role).

CREATE TABLE IF NOT EXISTS saved_searches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_alerts boolean DEFAULT true,
  last_alerted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS filters jsonb;
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS email_alerts boolean DEFAULT true;
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS last_alerted_at timestamp with time zone;
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

-- A row with no filters is meaningless for alerting; default the legacy NULLs to
-- an empty object so the alerts function can always read filters as jsonb.
UPDATE saved_searches SET filters = '{}'::jsonb WHERE filters IS NULL;
UPDATE saved_searches SET email_alerts = true WHERE email_alerts IS NULL;

-- One lookup per user for the saved-searches page; a partial index keeps the
-- every-6-hours alert sweep (email_alerts = true) fast as the table grows.
CREATE INDEX IF NOT EXISTS saved_searches_user_idx ON saved_searches (user_id);
CREATE INDEX IF NOT EXISTS saved_searches_alerts_idx ON saved_searches (email_alerts) WHERE email_alerts = true;
