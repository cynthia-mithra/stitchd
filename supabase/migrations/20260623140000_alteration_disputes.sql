-- Tailoring disputes.
--
-- Let the disputes table cover alteration bookings as well as listing orders so a
-- buyer can report a problem with a tailor's work. order_id is already nullable;
-- this adds an optional link to the alteration_requests row a dispute is about.

ALTER TABLE disputes ADD COLUMN IF NOT EXISTS alteration_request_id uuid REFERENCES alteration_requests(id);
