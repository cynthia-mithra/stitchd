-- Profile gender.
--
-- Lets a member save themselves as a Woman or a Man so the profile's
-- measurements section shows the right fields (CHEST + no hips for men,
-- BUST + hips for women). Free-text rather than an enum so the value stays
-- flexible; the app only ever writes "Woman" or "Man".

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender text;
