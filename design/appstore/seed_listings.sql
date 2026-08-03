-- Stitch'd — seed 6 starter listings under your account.
-- Safe to run once in the Supabase SQL Editor. It is a single atomic INSERT:
-- if anything fails, NOTHING is written (no half-finished data). It only ADDS
-- rows — it never edits or deletes anything you already have.
--
-- The listings are attached to your account via your email below. If you signed
-- up to Stitch'd with a DIFFERENT email, change it on the next line first.

insert into listings
  (id, user_id, name, price, currency, category, listing_type, condition, origin,
   fabric, material, size, occasions, colours, bust, waist, hips, length, shoulder,
   sleeve_length, can_take_in, spare_fabric, description, emoji, sold, reserved,
   views, status, offers_enabled, image_url, images)
values
  (gen_random_uuid(), (select id from auth.users where email='cynthiajohnson98@live.co.uk' limit 1),
   'Emerald Green Bridal Lehenga', 145, 'GBP', 'Lehenga', 'Clothing', 'Worn once', 'India',
   'Silk with zari embroidery', null, 'M', ARRAY['Wedding','Reception']::text[], ARRAY['Green','Gold']::text[],
   '36"', '28"', null, '40"', null, null, true, true,
   'Stunning emerald green bridal lehenga worn once for a reception. Heavy gold zari work across the skirt and blouse, with a matching net dupatta. Dry-cleaned and stored carefully. Waist can be let out and there''s spare fabric included.',
   'LE', false, false, 34, 'active', true, null, null),

  (gen_random_uuid(), (select id from auth.users where email='cynthiajohnson98@live.co.uk' limit 1),
   'Deep Red Banarasi Saree', 75, 'GBP', 'Saree', 'Clothing', 'Excellent - like new', 'India',
   'Banarasi silk', null, 'Free Size', ARRAY['Wedding','Festival','Eid']::text[], ARRAY['Red','Gold']::text[],
   null, null, null, '5.5m', null, null, false, false,
   'Classic deep red Banarasi silk saree with a gold woven border and pallu. Timeless bridal or festival piece. Comes with an unstitched blouse piece. Excellent condition, no snags or marks.',
   'SA', false, false, 51, 'active', true, null, null),

  (gen_random_uuid(), (select id from auth.users where email='cynthiajohnson98@live.co.uk' limit 1),
   'Powder Blue Anarkali Suit', 48, 'GBP', 'Salwar Kameez', 'Clothing', 'Very good', 'Pakistan',
   'Georgette', null, 'S', ARRAY['Party','Eid']::text[], ARRAY['Blue','Silver']::text[],
   '34"', '26"', null, '52"', null, null, true, false,
   'Floor-length powder blue Anarkali in flowing georgette with delicate silver threadwork on the bodice. Includes churidar and dupatta. Worn twice, freshly dry-cleaned. A really elegant Eid or party look.',
   'SK', false, false, 22, 'active', true, null, null),

  (gen_random_uuid(), (select id from auth.users where email='cynthiajohnson98@live.co.uk' limit 1),
   'Mustard Yellow Co-ord Set', 35, 'GBP', 'Co-ord Set', 'Clothing', 'Excellent - like new', 'UK',
   'Cotton blend', null, 'M', ARRAY['Mehndi','Casual','Festival']::text[], ARRAY['Yellow','Orange']::text[],
   '38"', '30"', null, '24"', null, null, false, false,
   'Bright mustard co-ord set, perfect for a mehndi or haldi. Printed cotton with tassel details on the top. Comfortable and easy to wear. Worn once.',
   'CS', false, false, 18, 'active', true, null, null),

  (gen_random_uuid(), (select id from auth.users where email='cynthiajohnson98@live.co.uk' limit 1),
   'Navy & Gold Sherwani', 90, 'GBP', 'Sherwani', 'Clothing', 'Worn once', 'India',
   'Silk blend', null, 'L', ARRAY['Wedding','Reception']::text[], ARRAY['Blue','Gold']::text[],
   '42"', null, null, '44"', '18"', '25"', true, false,
   'Sharp navy sherwani with gold embroidered buttons and collar. Includes matching churidar and a gold dupatta. Worn once to a wedding, immaculate condition. A standout groom or guest outfit.',
   'SH', false, false, 27, 'active', true, null, null),

  (gen_random_uuid(), (select id from auth.users where email='cynthiajohnson98@live.co.uk' limit 1),
   'Gold Kundan Jewellery Set', 28, 'GBP', 'Accessories', 'Jewellery', 'Excellent - like new', 'India',
   null, 'Gold-plated Kundan with pearls', 'Free Size', ARRAY['Wedding','Party','Eid']::text[], ARRAY['Gold','White']::text[],
   null, null, null, null, null, null, false, false,
   'Statement Kundan necklace and earring set with pearl drops. Gold-plated, never worn (bought for an event that didn''t happen). Comes in original box. Pairs beautifully with reds, greens and deep blues.',
   'AC', false, false, 40, 'active', true, null, null)

returning name, price, category;
