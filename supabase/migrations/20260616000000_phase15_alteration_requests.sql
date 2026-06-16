-- Phase 15 — Request alterations on a listing.
--
-- A buyer can request alterations on a listing (before or after buying) by
-- picking a Stitch'd tailor and describing what they need. This builds on the
-- phase15 `tailors` profiles table and the listing detail page.
--
-- One row per request. The tailor responds from their dashboard BOOKINGS tab:
-- SEND QUOTE (status -> quoted, fills quote_pence/quote_message) or DECLINE
-- (status -> declined). Payment for an accepted quote comes in a LATER issue —
-- this migration deliberately adds NO Stripe/payment columns.
--
-- Like the other phase tables this is a plain CREATE with NO RLS policies,
-- inheriting the project's existing access model.

CREATE TABLE IF NOT EXISTS alteration_requests (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id         uuid REFERENCES listings(id),
  buyer_id           uuid REFERENCES auth.users(id),
  tailor_id          uuid REFERENCES tailors(id),
  description        text NOT NULL,            -- the buyer's "what I need" notes (required)
  garment_type       text,                     -- derived from the listing (e.g. "Lehenga")
  alterations_needed text[] DEFAULT '{}',      -- the selected pill values
  additional_notes   text,                     -- mirror of description for display
  budget_pence       integer,                  -- optional buyer budget, in pence
  quote_pence        integer,                  -- tailor's quote, in pence (set on SEND QUOTE)
  quote_message      text,                     -- tailor's optional message with the quote
  status             text DEFAULT 'pending',   -- pending | quoted | accepted | declined | completed | cancelled
  created_at         timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alteration_requests_buyer_idx   ON alteration_requests(buyer_id);
CREATE INDEX IF NOT EXISTS alteration_requests_tailor_idx  ON alteration_requests(tailor_id);
CREATE INDEX IF NOT EXISTS alteration_requests_listing_idx ON alteration_requests(listing_id);
