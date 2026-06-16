-- Phase 15 — Tailor availability calendar.
--
-- Lets an approved tailor publish the dates they can take on work, so buyers can
-- see availability before sending an alteration request and (optionally) pick a
-- preferred start date. Builds on the phase15 `tailors` profiles + the
-- `alteration_requests` flow — it does NOT touch Stripe/payment code or the
-- pre-existing tailor_services / tailor_bookings marketplace.
--
-- Like the other phase tables this is a plain CREATE / ALTER with NO RLS
-- policies, inheriting the project's existing access model. Every column is
-- additive + defaulted so a deployment that hasn't run earlier migrations still
-- ends up consistent, and the app's self-healing db.js drops any column a given
-- schema is still missing rather than failing the whole write.

-- 1. tailor_availability — one row per (tailor, date) the tailor has touched.
--    A date with NO row is "available with the tailor's default slots"; a row
--    overrides that with an explicit available flag / slot count / note.
--    ON DELETE CASCADE so removing a tailor drops their calendar.
CREATE TABLE IF NOT EXISTS tailor_availability (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tailor_id        uuid REFERENCES tailors(id) ON DELETE CASCADE,
  date             date NOT NULL,
  available        boolean DEFAULT true,
  slots_remaining  integer DEFAULT 3,
  note             text,
  created_at       timestamp with time zone DEFAULT now(),
  UNIQUE(tailor_id, date)
);

CREATE INDEX IF NOT EXISTS tailor_availability_tailor_idx ON tailor_availability(tailor_id);
CREATE INDEX IF NOT EXISTS tailor_availability_date_idx   ON tailor_availability(tailor_id, date);

-- 2. Availability settings on the tailor row.
--    availability_enabled  — OFF by default; when ON the calendar shows on the
--                            public /tailors/<id> profile.
--    advance_booking_days  — how far ahead the tailor accepts bookings (the
--                            calendar/booking window). Default 30 (1 month).
--    default_slots_per_day — jobs the tailor can take in a day (1–10). Default 3.
--    vacation_mode         — when ON (kept in sync with the seller's profile
--                            vacation_mode) the public calendar shows every date
--                            as unavailable WITHOUT touching the per-day rows, so
--                            turning vacation off restores availability exactly.
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS availability_enabled  boolean DEFAULT false;
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS advance_booking_days  integer DEFAULT 30;
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS default_slots_per_day integer DEFAULT 3;
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS vacation_mode         boolean DEFAULT false;

-- 3. Preferred start date on an alteration request (optional). Shown to the
--    tailor on their booking cards so they know when the buyer wants to start.
ALTER TABLE alteration_requests ADD COLUMN IF NOT EXISTS preferred_date date;
