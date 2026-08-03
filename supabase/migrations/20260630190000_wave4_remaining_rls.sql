-- ============================================================================
-- WAVE 4 — Row-Level Security for every remaining public table.
--
-- Waves 1–3 locked down the money/data-critical tables (wallet, orders, offers,
-- disputes, alterations, listings, messages, profiles). Supabase's Security
-- Advisor still flags the rest of the schema with `rls_disabled_in_public`:
-- with RLS off, PostgREST exposes those tables to anyone holding the public
-- anon key — read, insert, update and delete. This migration turns RLS ON for
-- all of them and adds policies that exactly mirror what the app already does,
-- so nothing breaks while the tables stop being world-writable.
--
-- Two denormalised counters (tailor rating roll-up, style-post like count) were
-- previously maintained by a cross-user client PATCH — the reviewer/liker
-- patched a row they don't own. Owner-only UPDATE policies would silently break
-- those, so this migration moves both counters into SECURITY DEFINER triggers.
-- The now-redundant client PATCH is harmless: it either no-ops (blocked by RLS)
-- or writes the same value the trigger already computed.
--
-- Access model recap:
--   * public content (browsable without an account): SELECT to everyone,
--     writes scoped to the owner (and admin where the admin panel needs it).
--   * personal data (only you + admin): SELECT scoped to the owner/admin,
--     writes scoped to the owner (plus admin moderation where required).
-- "admin" = profiles.is_admin, checked with a helper so the policies stay short.
-- ============================================================================

-- Helper: is the caller a Stitch'd admin? SECURITY DEFINER so a policy can read
-- profiles.is_admin without the caller needing SELECT on that row. STABLE so the
-- planner can cache it within a statement.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()), false);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PUBLIC CONTENT TABLES  (SELECT open; writes owner-scoped)
-- ─────────────────────────────────────────────────────────────────────────────

-- reviews — seller reviews shown on every storefront/listing. Public read; a
-- buyer may only file a review under their own reviewer_id.
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reviews_select ON reviews;
CREATE POLICY reviews_select ON reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS reviews_insert ON reviews;
CREATE POLICY reviews_insert ON reviews
  FOR INSERT TO authenticated WITH CHECK (reviewer_id = auth.uid());

-- comments — public Q&A on listings. Anyone reads (the app filters deleted
-- client-side); the author writes their own and soft-deletes their own.
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS comments_select ON comments;
CREATE POLICY comments_select ON comments FOR SELECT USING (true);
DROP POLICY IF EXISTS comments_insert ON comments;
CREATE POLICY comments_insert ON comments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS comments_update ON comments;
CREATE POLICY comments_update ON comments
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- follows — storefront follow graph; follower counts render publicly. You may
-- only create/remove a follow edge that starts at you.
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS follows_select ON follows;
CREATE POLICY follows_select ON follows FOR SELECT USING (true);
DROP POLICY IF EXISTS follows_insert ON follows;
CREATE POLICY follows_insert ON follows
  FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());
DROP POLICY IF EXISTS follows_delete ON follows;
CREATE POLICY follows_delete ON follows
  FOR DELETE TO authenticated USING (follower_id = auth.uid());

-- looks — curated "Shop the Look" outfits, built by a seller or the admin.
-- Public read; the creator (or admin) manages their own looks.
ALTER TABLE looks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS looks_select ON looks;
CREATE POLICY looks_select ON looks FOR SELECT USING (true);
DROP POLICY IF EXISTS looks_insert ON looks;
CREATE POLICY looks_insert ON looks
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR is_admin());
DROP POLICY IF EXISTS looks_update ON looks;
CREATE POLICY looks_update ON looks
  FOR UPDATE TO authenticated USING (created_by = auth.uid() OR is_admin());
DROP POLICY IF EXISTS looks_delete ON looks;
CREATE POLICY looks_delete ON looks
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR is_admin());

-- look_items — the listings inside a look. Public read; writes gated on owning
-- the parent look (or being admin).
ALTER TABLE look_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS look_items_select ON look_items;
CREATE POLICY look_items_select ON look_items FOR SELECT USING (true);
DROP POLICY IF EXISTS look_items_insert ON look_items;
CREATE POLICY look_items_insert ON look_items
  FOR INSERT TO authenticated WITH CHECK (
    is_admin() OR EXISTS (SELECT 1 FROM looks l WHERE l.id = look_id AND l.created_by = auth.uid())
  );
DROP POLICY IF EXISTS look_items_delete ON look_items;
CREATE POLICY look_items_delete ON look_items
  FOR DELETE TO authenticated USING (
    is_admin() OR EXISTS (SELECT 1 FROM looks l WHERE l.id = look_id AND l.created_by = auth.uid())
  );

-- style_posts — the public style feed. Public read (app filters deleted); the
-- author writes/soft-deletes their own. likes_count is maintained by trigger
-- (see below), not the owner-only UPDATE policy.
ALTER TABLE style_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS style_posts_select ON style_posts;
CREATE POLICY style_posts_select ON style_posts FOR SELECT USING (true);
DROP POLICY IF EXISTS style_posts_insert ON style_posts;
CREATE POLICY style_posts_insert ON style_posts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS style_posts_update ON style_posts;
CREATE POLICY style_posts_update ON style_posts
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- style_post_likes — one row per (post, user). Public read for counts; you may
-- only like/unlike as yourself.
ALTER TABLE style_post_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS style_post_likes_select ON style_post_likes;
CREATE POLICY style_post_likes_select ON style_post_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS style_post_likes_insert ON style_post_likes;
CREATE POLICY style_post_likes_insert ON style_post_likes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS style_post_likes_delete ON style_post_likes;
CREATE POLICY style_post_likes_delete ON style_post_likes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- tailors — public tailor profiles. Public read; a member owns exactly one
-- tailor row (user_id) and the admin approves/suspends. The rating roll-up is
-- kept current by a trigger on tailor_reviews (below).
ALTER TABLE tailors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tailors_select ON tailors;
CREATE POLICY tailors_select ON tailors FOR SELECT USING (true);
DROP POLICY IF EXISTS tailors_insert ON tailors;
CREATE POLICY tailors_insert ON tailors
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS tailors_update ON tailors;
CREATE POLICY tailors_update ON tailors
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR is_admin());

-- tailor_portfolio — a tailor's gallery. Public read; the owning tailor manages
-- their images.
ALTER TABLE tailor_portfolio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tailor_portfolio_select ON tailor_portfolio;
CREATE POLICY tailor_portfolio_select ON tailor_portfolio FOR SELECT USING (true);
DROP POLICY IF EXISTS tailor_portfolio_write ON tailor_portfolio;
CREATE POLICY tailor_portfolio_write ON tailor_portfolio
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM tailors t WHERE t.id = tailor_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM tailors t WHERE t.id = tailor_id AND t.user_id = auth.uid()));

-- tailor_reviews — reviews left by a buyer after an alteration. Public read; the
-- buyer files their own.
ALTER TABLE tailor_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tailor_reviews_select ON tailor_reviews;
CREATE POLICY tailor_reviews_select ON tailor_reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS tailor_reviews_insert ON tailor_reviews;
CREATE POLICY tailor_reviews_insert ON tailor_reviews
  FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid());

-- tailor_availability — a tailor's booking calendar. Public read; the owning
-- tailor sets/clears their own days.
ALTER TABLE tailor_availability ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tailor_availability_select ON tailor_availability;
CREATE POLICY tailor_availability_select ON tailor_availability FOR SELECT USING (true);
DROP POLICY IF EXISTS tailor_availability_write ON tailor_availability;
CREATE POLICY tailor_availability_write ON tailor_availability
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM tailors t WHERE t.id = tailor_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM tailors t WHERE t.id = tailor_id AND t.user_id = auth.uid()));

-- shared_wishlists — shareable lists (the /list/<slug> page reads by slug for
-- anyone). A list marked public is world-readable; a private list is visible
-- only to its owner. The owner always manages their own lists.
ALTER TABLE shared_wishlists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shared_wishlists_select ON shared_wishlists;
CREATE POLICY shared_wishlists_select ON shared_wishlists
  FOR SELECT USING (public = true OR user_id = auth.uid());
DROP POLICY IF EXISTS shared_wishlists_insert ON shared_wishlists;
CREATE POLICY shared_wishlists_insert ON shared_wishlists
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS shared_wishlists_update ON shared_wishlists;
CREATE POLICY shared_wishlists_update ON shared_wishlists
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS shared_wishlists_delete ON shared_wishlists;
CREATE POLICY shared_wishlists_delete ON shared_wishlists
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- shared_wishlist_items — items inside a shared list. Public read; writes gated
-- on owning the parent list.
ALTER TABLE shared_wishlist_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shared_wishlist_items_select ON shared_wishlist_items;
CREATE POLICY shared_wishlist_items_select ON shared_wishlist_items FOR SELECT USING (true);
DROP POLICY IF EXISTS shared_wishlist_items_write ON shared_wishlist_items;
CREATE POLICY shared_wishlist_items_write ON shared_wishlist_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM shared_wishlists w WHERE w.id = shared_wishlist_id AND w.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM shared_wishlists w WHERE w.id = shared_wishlist_id AND w.user_id = auth.uid()));

-- promotions — a seller's paid listing-boost receipts. NOT public: a seller
-- sees their own, admin sees all. Rows are created/updated by the Stripe webhook
-- and redeem-bump function under the service role, which bypasses RLS entirely,
-- so no client write policy is needed here.
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS promotions_select ON promotions;
CREATE POLICY promotions_select ON promotions
  FOR SELECT TO authenticated USING (seller_id = auth.uid() OR is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- PERSONAL TABLES  (SELECT owner/admin only; writes owner-scoped)
-- ─────────────────────────────────────────────────────────────────────────────

-- saved_searches — a member's saved filters + email alerts. Fully private.
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS saved_searches_select ON saved_searches;
CREATE POLICY saved_searches_select ON saved_searches
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS saved_searches_insert ON saved_searches;
CREATE POLICY saved_searches_insert ON saved_searches
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS saved_searches_update ON saved_searches;
CREATE POLICY saved_searches_update ON saved_searches
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS saved_searches_delete ON saved_searches;
CREATE POLICY saved_searches_delete ON saved_searches
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- verification_applications — a seller's "get verified" application. The
-- applicant reads/creates/reapplies on their own; admin reads all and sets the
-- status. Personal data (contains full name, Instagram), so SELECT is scoped.
ALTER TABLE verification_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS verification_applications_select ON verification_applications;
CREATE POLICY verification_applications_select ON verification_applications
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS verification_applications_insert ON verification_applications;
CREATE POLICY verification_applications_insert ON verification_applications
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS verification_applications_update ON verification_applications;
CREATE POLICY verification_applications_update ON verification_applications
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR is_admin());

-- reports — a member flagging a listing. The reporter sees their own, admin sees
-- all and moves the status through pending → reviewed. Personal (reporter id +
-- free-text details), so SELECT is scoped.
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reports_select ON reports;
CREATE POLICY reports_select ON reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS reports_insert ON reports;
CREATE POLICY reports_insert ON reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
DROP POLICY IF EXISTS reports_update ON reports;
CREATE POLICY reports_update ON reports
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- feature_interest — "notify me when X launches" taps. Private to the member
-- (admin can read to gauge demand).
ALTER TABLE feature_interest ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS feature_interest_select ON feature_interest;
CREATE POLICY feature_interest_select ON feature_interest
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS feature_interest_insert ON feature_interest;
CREATE POLICY feature_interest_insert ON feature_interest
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- notifications — in-app notification bell. You read and mark-read your OWN
-- notifications only. INSERT stays open to any signed-in member because notify()
-- (client-side) writes a notification row into the *recipient's* feed — the
-- sender is not the row owner. That's the one deliberately-wide policy here; the
-- alternative (moving every notify() call server-side) is a much larger change,
-- and the blast radius is limited to spamming someone's bell, not data theft.
-- Guarded with to_regclass because notifications predates the migration folder
-- and may not exist in a bare test database.
DO $$
BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE notifications ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS notifications_select ON notifications';
    EXECUTE 'CREATE POLICY notifications_select ON notifications
               FOR SELECT TO authenticated USING (user_id = auth.uid())';
    EXECUTE 'DROP POLICY IF EXISTS notifications_insert ON notifications';
    EXECUTE 'CREATE POLICY notifications_insert ON notifications
               FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL)';
    EXECUTE 'DROP POLICY IF EXISTS notifications_update ON notifications';
    EXECUTE 'CREATE POLICY notifications_update ON notifications
               FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- DENORMALISED COUNTERS — moved from cross-user client PATCH to triggers
-- ─────────────────────────────────────────────────────────────────────────────

-- style_posts.likes_count: previously the liker PATCHed the post's count (a row
-- they don't own). With owner-only UPDATE that PATCH no-ops, so maintain the
-- count from like inserts/deletes instead. SECURITY DEFINER so it can write the
-- post row regardless of who liked.
CREATE OR REPLACE FUNCTION sync_style_post_likes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE style_posts SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE style_posts SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS style_post_likes_count_trg ON style_post_likes;
CREATE TRIGGER style_post_likes_count_trg
  AFTER INSERT OR DELETE ON style_post_likes
  FOR EACH ROW EXECUTE FUNCTION sync_style_post_likes();

-- tailors.average_rating / review_count: previously recomputed by the reviewing
-- buyer via a PATCH on the tailor row. Owner-only UPDATE breaks that, so roll it
-- up from tailor_reviews changes instead.
CREATE OR REPLACE FUNCTION sync_tailor_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tailor uuid := COALESCE(NEW.tailor_id, OLD.tailor_id);
BEGIN
  UPDATE tailors t SET
    review_count   = sub.cnt,
    average_rating = sub.avg
  FROM (
    SELECT COUNT(*)::int AS cnt,
           COALESCE(ROUND(AVG(rating)::numeric, 2), 0) AS avg
    FROM tailor_reviews WHERE tailor_id = v_tailor
  ) sub
  WHERE t.id = v_tailor;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS tailor_reviews_rating_trg ON tailor_reviews;
CREATE TRIGGER tailor_reviews_rating_trg
  AFTER INSERT OR UPDATE OR DELETE ON tailor_reviews
  FOR EACH ROW EXECUTE FUNCTION sync_tailor_rating();

-- Tell PostgREST to reload the schema so the new policies take effect at once.
NOTIFY pgrst, 'reload schema';
