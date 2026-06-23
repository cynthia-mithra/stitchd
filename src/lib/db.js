import { SUPABASE_URL, SUPABASE_KEY, hdrs } from "./constants";

// ── Phase 12 — transactional email triggers ───────────────────────────────────
// Fire-and-forget POST to the send-email Edge Function. The browser never has
// the recipient's email (it lives on auth.users), so we send only the event +
// ids and the function resolves the address, renders the brand template, and
// honours the unsubscribe flag server-side. Failures are swallowed — a missing
// email must never break the user action that triggered it.
export function fireEmail(payload){
  try{
    fetch(`${SUPABASE_URL}/functions/v1/send-email`,{
      method:"POST",
      headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,"Content-Type":"application/json"},
      body:JSON.stringify(payload),
      keepalive:true,
    }).catch(()=>{});
  }catch{ /* never throw from a notification side-effect */ }
}

// Stamp profiles.last_active_at so new-message emails can skip users who are
// currently online (the "active in the last 10 minutes" rule). Best-effort: if
// the column is missing (migration not yet run) PostgREST 400s and we ignore it.
function touchActive(uid,t){
  if(!uid) return;
  try{
    fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`,{
      method:"PATCH",
      headers:{...hdrs(t),Prefer:"return=minimal"},
      body:JSON.stringify({last_active_at:new Date().toISOString()}),
    }).catch(()=>{});
  }catch{ /* ignore */ }
}

// PostgREST rejects an ENTIRE insert/update if the payload names a column the
// table doesn't have, e.g. PGRST204 "Could not find the 'image_url' column of
// 'listings' in the schema cache". When a user's schema is missing one of the
// ~30 columns the app sends, that one absent column blocks every save. Rather
// than fail the whole listing, drop the offending column and retry — so a
// listing still saves with whatever columns the schema actually has. The
// dropped column simply isn't persisted (e.g. a missing `image_url` means the
// grid thumbnail falls back to `images`), which is a far better outcome than a
// total save failure for a non-technical user who can't run migrations.
const missingColumn=msg=>{ const m=/Could not find the '([^']+)' column/.exec(msg||""); return m?m[1]:null; };
async function sendHealing(url,method,body,t){
  let payload={...body}; const dropped=[];
  // Cap iterations well above the column count so a pathological response can't loop forever.
  for(let i=0;i<60;i++){
    const r=await fetch(url,{method,headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(payload)});
    if(r.ok){ if(dropped.length)console.warn(`Listing saved after dropping column(s) missing from your 'listings' table: ${dropped.join(", ")}. Add them in Supabase to persist these fields.`); return r.json(); }
    const text=await r.text(); const col=missingColumn(text);
    if(col&&Object.prototype.hasOwnProperty.call(payload,col)){ delete payload[col]; dropped.push(col); continue; }
    throw new Error(text);
  }
  throw new Error("Couldn't save: too many columns are missing from the 'listings' table.");
}

export const db = {
  async getAll(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/listings?order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async insert(item,t){ return sendHealing(`${SUPABASE_URL}/rest/v1/listings`,"POST",item,t); },
  async update(id,patch,t){ return sendHealing(`${SUPABASE_URL}/rest/v1/listings?id=eq.${id}`,"PATCH",patch,t); },
  async remove(id,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${id}`,{method:"DELETE",headers:hdrs(t)}); if(!r.ok)throw new Error(await r.text()); },
  async getProfile(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}&limit=1`,{headers:hdrs(t)}); if(!r.ok)return null; const d=await r.json(); return d[0]||null; },
  async getProfilesByIds(ids,t){ if(!ids.length)return []; const r=await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=in.(${ids.join(",")})&select=id,full_name,username`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async upsertProfile(profile,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/profiles`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation,resolution=merge-duplicates"},body:JSON.stringify(profile)}); if(!r.ok)throw new Error(await r.text()); const d=await r.json();
    // Email 7 — welcome. Fired on every upsert; send-email dedupes via the
    // welcome_email_sent flag so a returning user is only ever welcomed once.
    if(profile&&profile.id) fireEmail({type:"welcome",userId:profile.id});
    return d; },
  async getListingsByUser(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/listings?user_id=eq.${uid}&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  // A single listing by id (used by /offers "make new offer" when the listing
  // isn't in the cached shop items). Returns the row or null.
  async getListing(id,t){ if(!id)return null; const r=await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${id}&limit=1`,{headers:hdrs(t)}); if(!r.ok)return null; const d=await r.json(); return d[0]||null; },
  async incrementViews(id,views,t){ await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${id}`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify({views:(views||0)+1})}); },
  async getReviews(sellerId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/reviews?seller_id=eq.${sellerId}&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async getAllReviewStats(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/reviews?select=seller_id,rating`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async getFastSellers(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/profiles?fast_seller=eq.true&select=id`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  // Phase 10d — seller tools.
  // Sellers flagged vacation_mode=true on their profile; their active listings are
  // filtered out of the shop/search grid (see `visible` in App.js). One request
  // feeds the whole grid, mirroring getFastSellers.
  async getVacationSellers(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/profiles?vacation_mode=eq.true&select=id`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async setVacationMode(uid,on,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify({vacation_mode:on})}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  // Bulk-patch many listings at once (bulk edit: price / mark sold / deactivate).
  // Self-heals like sendHealing: if the schema is missing one of the patched
  // columns (e.g. `status`), drop it and retry so the rest of the patch still lands.
  async bulkUpdate(ids,patch,t){
    const url=`${SUPABASE_URL}/rest/v1/listings?id=in.(${ids.join(",")})`; let payload={...patch};
    for(let i=0;i<10;i++){
      const r=await fetch(url,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(payload)});
      if(r.ok) return r.json();
      const text=await r.text(); const m=/Could not find the '([^']+)' column/.exec(text); const col=m&&m[1];
      if(col&&Object.prototype.hasOwnProperty.call(payload,col)){ delete payload[col]; continue; }
      throw new Error(text);
    }
    throw new Error("Couldn't update the selected listings.");
  },
  // "Notify me" interest for the coming-soon Promote feature.
  async insertFeatureInterest(rec,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/feature_interest`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(rec)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  // ── Phase 13 — Promoted listings ──────────────────────────────────────────
  // The signed-in seller's promotions (pending / active / expired), newest first,
  // with the listing name embedded for the dashboard ANALYTICS history. Falls back
  // to a plain select if the embed isn't available on this deployment, then to []
  // if the table doesn't exist yet (migration not run) so the section degrades to
  // its empty state rather than throwing.
  async getMyPromotions(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/promotions?seller_id=eq.${uid}&select=*,listings(id,name,image_url,images)&order=created_at.desc`,{headers:hdrs(t)}); if(r.ok)return r.json(); const r2=await fetch(`${SUPABASE_URL}/rest/v1/promotions?seller_id=eq.${uid}&order=created_at.desc`,{headers:hdrs(t)}); if(!r2.ok)return []; return r2.json(); },
  // Wishlists / favourites. getAllWishlists returns one row per save (listing_id
  // only) for the whole grid — counted client-side into a listing_id->count map,
  // mirroring getAllReviewStats. getMyWishlist returns just the current user's
  // saved listing_ids so cards can show a filled heart. add/remove toggle a row;
  // the table's UNIQUE(user_id,listing_id) makes a double-add a harmless 409.
  async getAllWishlists(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/wishlists?select=listing_id`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async getMyWishlist(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/wishlists?user_id=eq.${uid}&select=listing_id`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  // Phase 14 — the signed-in user's saves with created_at, newest first, so the
  // /wishlist page can order cards "most recently wishlisted first". Same table,
  // just selecting the timestamp and ordering on it.
  async getMyWishlistDetailed(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/wishlists?user_id=eq.${uid}&select=listing_id,created_at&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async addWishlist(uid,listingId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/wishlists?on_conflict=user_id,listing_id`,{method:"POST",headers:{...hdrs(t),Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({user_id:uid,listing_id:listingId})}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async removeWishlist(uid,listingId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/wishlists?user_id=eq.${uid}&listing_id=eq.${listingId}`,{method:"DELETE",headers:hdrs(t)}); if(!r.ok)throw new Error(await r.text()); },
  // ── Phase 14 — Shareable wishlists ────────────────────────────────────────
  // A named, public list of saved pieces reachable at /wishlist/<slug>. The
  // public page (no login) reads one list by slug WITH its items and each item's
  // listing embedded in a single PostgREST request via the shared_wishlist_items
  // / listings FKs — so the grid has every listing with no per-item round-trip.
  // Items are ordered by `position` client-side. Returns null if the list
  // doesn't exist (deleted/never created) so the page shows its "no longer
  // available" state rather than throwing.
  async getSharedWishlist(slug,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/shared_wishlists?slug=eq.${encodeURIComponent(slug)}&select=*,shared_wishlist_items(*,listings(*))&limit=1`,{headers:hdrs(t)}); if(!r.ok)return null; const d=await r.json(); return d[0]||null; },
  // The signed-in user's own shared lists (newest first) for the "MY SHARED
  // LISTS" section, each with its items embedded so the card can show an item
  // count. Falls back to a plain select if the embed isn't available, then to []
  // if the table doesn't exist yet (migration not run) so the section hides.
  async getMySharedWishlists(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/shared_wishlists?user_id=eq.${uid}&select=*,shared_wishlist_items(id)&order=created_at.desc`,{headers:hdrs(t)}); if(r.ok)return r.json(); const r2=await fetch(`${SUPABASE_URL}/rest/v1/shared_wishlists?user_id=eq.${uid}&order=created_at.desc`,{headers:hdrs(t)}); if(!r2.ok)return []; return r2.json(); },
  async createSharedWishlist(row,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/shared_wishlists`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(row)}); if(!r.ok)throw new Error(await r.text()); const d=await r.json(); return d[0]; },
  async updateSharedWishlist(id,patch,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/shared_wishlists?id=eq.${id}`,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(patch)}); if(!r.ok)throw new Error(await r.text()); const d=await r.json(); return d[0]; },
  async deleteSharedWishlist(id,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/shared_wishlists?id=eq.${id}`,{method:"DELETE",headers:hdrs(t)}); if(!r.ok)throw new Error(await r.text()); },
  // Add the selected pieces to a list in one request. `rows` is [{shared_wishlist_id,listing_id,position}].
  async addSharedWishlistItems(rows,t){ if(!rows.length)return []; const r=await fetch(`${SUPABASE_URL}/rest/v1/shared_wishlist_items`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(rows)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  // Replace a list's items wholesale (used on edit): delete then re-insert.
  async clearSharedWishlistItems(listId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/shared_wishlist_items?shared_wishlist_id=eq.${listId}`,{method:"DELETE",headers:hdrs(t)}); if(!r.ok)throw new Error(await r.text()); },
  async insertReview(review,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/reviews`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(review)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async insertReport(report,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/reports`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(report)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  // ── Phase 14 — Comments on listings (basic, no replies) ───────────────────
  // Only non-deleted comments are returned; usernames/avatars are resolved
  // separately via getProfilesByIds (mirrors how reviews resolve reviewer_name).
  async getComments(listingId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/comments?listing_id=eq.${listingId}&deleted=eq.false&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async insertComment(comment,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/comments`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(comment)}); if(!r.ok)throw new Error(await r.text()); const d=await r.json(); return d[0]; },
  async deleteComment(id,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/comments?id=eq.${id}`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify({deleted:true})}); if(!r.ok)throw new Error(await r.text()); },
  // ── Phase 14 — Make an offer (buyer side) ─────────────────────────────────
  // A buyer's current PENDING offer on a listing — drives the MAKE AN OFFER /
  // OFFER PENDING toggle on the Detail page. Newest pending row or null. Returns
  // null on any error (e.g. the offers table doesn't exist yet because the
  // migration hasn't run) so the button degrades to plain MAKE AN OFFER.
  async getMyOffer(listingId,buyerId,t){ if(!listingId||!buyerId)return null; const r=await fetch(`${SUPABASE_URL}/rest/v1/offers?listing_id=eq.${listingId}&buyer_id=eq.${buyerId}&status=eq.pending&order=created_at.desc&limit=1`,{headers:hdrs(t)}); if(!r.ok)return null; const d=await r.json(); return d[0]||null; },
  async insertOffer(offer,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/offers`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(offer)}); if(!r.ok)throw new Error(await r.text()); const d=await r.json(); const created=d[0];
    // Email to the seller — send-email resolves the seller + listing + buyer name
    // from the offer id (the browser never has the seller's email address).
    if(created&&created.id) fireEmail({type:"new_offer",offerId:created.id});
    return created; },
  async withdrawOffer(id,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/offers?id=eq.${id}`,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify({status:"withdrawn"})}); if(!r.ok)throw new Error(await r.text()); const d=await r.json(); return d[0]; },
  // Phase 14 — every offer THIS buyer has made, newest first, with the listing
  // (title/thumbnail/price/currency) embedded so the /offers page renders grouped
  // by status without a per-offer round-trip. Falls back to a plain select where
  // the embed isn't available, then [] if the offers table doesn't exist yet.
  async getBuyerOffers(buyerId,t){ if(!buyerId)return []; const r=await fetch(`${SUPABASE_URL}/rest/v1/offers?buyer_id=eq.${buyerId}&select=*,listings(id,name,image_url,images,price,currency,sold,status,offers_enabled)&order=created_at.desc`,{headers:hdrs(t)}); if(r.ok)return r.json(); const r2=await fetch(`${SUPABASE_URL}/rest/v1/offers?buyer_id=eq.${buyerId}&order=created_at.desc`,{headers:hdrs(t)}); if(!r2.ok)return []; return r2.json(); },
  // ── Phase 14 — Seller responds to offers (accept / decline) ───────────────
  // Every offer on the seller's listings, newest first, with the listing
  // (title/thumbnail/price) embedded so the dashboard OFFERS tab renders without
  // a per-offer round-trip. Falls back to a plain select where the embed isn't
  // available, then [] if the table doesn't exist yet (migration not run).
  async getSellerOffers(sellerId,t){ if(!sellerId)return []; const r=await fetch(`${SUPABASE_URL}/rest/v1/offers?seller_id=eq.${sellerId}&select=*,listings(id,name,image_url,images,price,currency,offers_enabled)&order=created_at.desc`,{headers:hdrs(t)}); if(r.ok)return r.json(); const r2=await fetch(`${SUPABASE_URL}/rest/v1/offers?seller_id=eq.${sellerId}&order=created_at.desc`,{headers:hdrs(t)}); if(!r2.ok)return []; return r2.json(); },
  // Accept an offer (issue PART 3). Sets it 'accepted', turns OFF offers on the
  // listing so no new offers arrive while payment is pending (the listing is NOT
  // marked sold — that's the next issue, after payment), then declines every
  // OTHER pending offer on the same listing. Returns the declined rows so the
  // caller can fire their in-app decline notifications. The accept + auto-decline
  // emails fire from here.
  async acceptOffer(offer,t){
    // Stamp accepted_at so the 24h payment window (issue PART 4) is timed from the
    // acceptance. Self-heals to a plain status flip on a deployment where the
    // column doesn't exist yet (phase14 offer-checkout migration not run).
    let r=await fetch(`${SUPABASE_URL}/rest/v1/offers?id=eq.${offer.id}`,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify({status:"accepted",accepted_at:new Date().toISOString()})});
    if(!r.ok){
      const text=await r.text();
      if(/accepted_at/.test(text)){
        r=await fetch(`${SUPABASE_URL}/rest/v1/offers?id=eq.${offer.id}`,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify({status:"accepted"})});
      }
      if(!r.ok)throw new Error(text);
    }
    // Pause offers on the listing while we await payment.
    await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${offer.listing_id}`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify({offers_enabled:false})}).catch(()=>{});
    // Find, then decline, the other pending offers on this listing.
    let declined=[];
    const o=await fetch(`${SUPABASE_URL}/rest/v1/offers?listing_id=eq.${offer.listing_id}&status=eq.pending&id=neq.${offer.id}&select=id,buyer_id,amount_pence,listing_id`,{headers:hdrs(t)});
    if(o.ok) declined=await o.json();
    if(declined.length){
      await fetch(`${SUPABASE_URL}/rest/v1/offers?listing_id=eq.${offer.listing_id}&status=eq.pending&id=neq.${offer.id}`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify({status:"declined"})}).catch(()=>{});
    }
    // Emails: the accepted buyer, plus each auto-declined buyer (no counter).
    fireEmail({type:"offer_accepted",offerId:offer.id});
    declined.forEach(d=>fireEmail({type:"offer_declined",offerId:d.id}));
    return declined;
  },
  // Decline an offer (issue PART 4). Sets it 'declined' and, when the seller
  // suggested a different price, persists counter_offer_pence so the decline
  // email/notification can reference it. counterPence is also passed to the email
  // so it works even on a deployment where the column doesn't exist yet. Self-
  // heals by dropping counter_offer_pence and retrying if the column is missing.
  async declineOffer(offer,counterPence,t){
    const base={status:"declined"};
    const payload=counterPence!=null?{...base,counter_offer_pence:counterPence}:base;
    let r=await fetch(`${SUPABASE_URL}/rest/v1/offers?id=eq.${offer.id}`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify(payload)});
    if(!r.ok){
      const text=await r.text();
      if(/counter_offer_pence/.test(text)){
        r=await fetch(`${SUPABASE_URL}/rest/v1/offers?id=eq.${offer.id}`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify(base)});
      }
      if(!r.ok) throw new Error(text);
    }
    fireEmail(counterPence!=null?{type:"offer_declined",offerId:offer.id,counterPence}:{type:"offer_declined",offerId:offer.id});
  },
  // ── Phase 11 — Report a listing + dispute resolution ──────────────────────
  // The Stitch'd admin account(s) — profiles flagged is_admin=true. Dispute
  // notifications are routed to every admin id this returns.
  async getAdmins(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/profiles?is_admin=eq.true&select=id`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  // Buyer raising a problem with an order. Self-heals like the listing insert: if
  // the schema is missing an optional column (e.g. photo_url, seller_id) drop it
  // and retry so the dispute still records rather than failing wholesale.
  async insertDispute(dispute,t){
    const url=`${SUPABASE_URL}/rest/v1/disputes`; let payload={...dispute};
    for(let i=0;i<10;i++){
      const r=await fetch(url,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(payload)});
      if(r.ok){ const d=await r.json(); return d[0]; }
      const text=await r.text(); const m=/Could not find the '([^']+)' column/.exec(text); const col=m&&m[1];
      if(col&&col!=="problem_type"&&col!=="details"&&Object.prototype.hasOwnProperty.call(payload,col)){ delete payload[col]; continue; }
      throw new Error(text);
    }
    throw new Error("Couldn't submit the dispute.");
  },
  // Admin panel reads. Reports embed their listing (title) via the listing_id FK;
  // reporter/buyer names are resolved separately with getProfilesByIds.
  async getAllReports(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/reports?select=*,listings(id,name)&order=created_at.desc`,{headers:hdrs(t)}); if(r.ok)return r.json(); const r2=await fetch(`${SUPABASE_URL}/rest/v1/reports?order=created_at.desc`,{headers:hdrs(t)}); if(!r2.ok)return []; return r2.json(); },
  async updateReport(id,patch,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/reports?id=eq.${id}`,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(patch)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  // Embed the order (for its listing_id) where the FK is known to PostgREST; fall
  // back to a plain select if the embed isn't available on this deployment.
  async getAllDisputes(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/disputes?select=*,orders(id,listing_id,status),alteration_requests(id,garment_type,listing_id,listings(name))&order=created_at.desc`,{headers:hdrs(t)}); if(r.ok)return r.json(); const r1=await fetch(`${SUPABASE_URL}/rest/v1/disputes?select=*,orders(id,listing_id,status)&order=created_at.desc`,{headers:hdrs(t)}); if(r1.ok)return r1.json(); const r2=await fetch(`${SUPABASE_URL}/rest/v1/disputes?order=created_at.desc`,{headers:hdrs(t)}); if(!r2.ok)return []; return r2.json(); },
  async updateDispute(id,patch,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/disputes?id=eq.${id}`,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(patch)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  // ── Phase 11 — Verified seller badges ─────────────────────────────────────
  // The set of sellers flagged verified=true on their profile, so cards/Detail
  // can show the VERIFIED SELLER badge (and the search filter can hide everyone
  // else) without a per-card profile fetch. Mirrors getFastSellers/getVacationSellers.
  async getVerifiedSellers(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/profiles?verified=eq.true&select=id`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  // Phase 11 — the set of sellers who passed Stripe Identity (identity_verified=true),
  // so cards/Detail can show the ID VERIFIED badge without a per-card profile fetch.
  // Mirrors getVerifiedSellers. Returns [] if the column doesn't exist yet.
  async getIdentityVerifiedSellers(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/profiles?identity_verified=eq.true&select=id`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  // A seller submitting a verification application. Self-heals like insertDispute:
  // if the schema is missing an optional column (e.g. selling_experience,
  // instagram_handle, admin_notes) drop it and retry so the application still records.
  async insertVerificationApplication(app,t){
    const url=`${SUPABASE_URL}/rest/v1/verification_applications`; let payload={...app};
    for(let i=0;i<10;i++){
      const r=await fetch(url,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(payload)});
      if(r.ok){ const d=await r.json(); return d[0]; }
      const text=await r.text(); const m=/Could not find the '([^']+)' column/.exec(text); const col=m&&m[1];
      if(col&&col!=="full_name"&&col!=="reason"&&Object.prototype.hasOwnProperty.call(payload,col)){ delete payload[col]; continue; }
      throw new Error(text);
    }
    throw new Error("Couldn't submit the verification application.");
  },
  // The signed-in seller's latest application — its reviewed_at backs the
  // "reapply after 30 days" rule shown when an application was rejected.
  async getMyVerificationApplication(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/verification_applications?user_id=eq.${uid}&order=created_at.desc&limit=1`,{headers:hdrs(t)}); if(!r.ok)return null; const d=await r.json(); return d[0]||null; },
  // Patch the verification columns on a profile (apply → pending, approve →
  // verified, reject → rejected). Self-heals: drop any column the schema is
  // missing (e.g. verified_at) and retry so the rest of the patch still lands.
  async updateProfileVerification(uid,patch,t){
    const url=`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`; let payload={...patch};
    for(let i=0;i<10;i++){
      const r=await fetch(url,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(payload)});
      if(r.ok) return r.json();
      const text=await r.text(); const m=/Could not find the '([^']+)' column/.exec(text); const col=m&&m[1];
      if(col&&Object.prototype.hasOwnProperty.call(payload,col)){ delete payload[col]; continue; }
      throw new Error(text);
    }
    throw new Error("Couldn't update verification status.");
  },
  // Admin panel — every verification application (all statuses), newest first.
  async getVerificationApplications(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/verification_applications?order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async updateVerificationApplication(id,patch,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/verification_applications?id=eq.${id}`,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(patch)}); if(!r.ok)throw new Error(await r.text()); const d=await r.json();
    // Email 6 — verification approved. send-email resolves the seller from the
    // application id and respects their unsubscribe preference.
    if((patch.status||"")==="approved") fireEmail({type:"verification_approved",applicationId:id});
    return d; },
  // Resolve applicant profiles (all columns) so the admin panel can show the
  // applicant's @username and email where the profiles row carries one.
  async getProfilesFullByIds(ids,t){ if(!ids.length)return []; const r=await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=in.(${ids.join(",")})&select=*`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async getConversations(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/conversations?or=(buyer_id.eq.${uid},seller_id.eq.${uid})&order=last_message_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async findConversation(buyerId,sellerId,listingId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/conversations?buyer_id=eq.${buyerId}&seller_id=eq.${sellerId}&listing_id=eq.${listingId}&limit=1`,{headers:hdrs(t)}); if(!r.ok)return null; const d=await r.json(); return d[0]||null; },
  async createConversation(conv,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/conversations`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(conv)}); if(!r.ok)throw new Error(await r.text()); const d=await r.json(); return d[0]; },
  async getMessages(convId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${convId}&order=created_at.asc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async sendMessage(msg,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/messages`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(msg)}); if(!r.ok)throw new Error(await r.text()); const d=await r.json();
    // Sender is by definition active right now; stamp it so a reply back to them
    // is suppressed while they're online.
    touchActive(msg.sender_id,t);
    // Email 5 — new message. send-email finds the recipient from the conversation,
    // skips them if active in the last 10 minutes, and trims the preview to 100 chars.
    fireEmail({type:"new_message",conversationId:msg.conversation_id,senderId:msg.sender_id,content:msg.content});
    return d; },
  async updateMessage(id,patch,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/messages?id=eq.${id}`,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(patch)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async getBundles(sellerId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/bundles?seller_id=eq.${sellerId}&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async getAllBundles(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/bundles?order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async createBundle(bundle,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/bundles`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(bundle)}); if(!r.ok)throw new Error(await r.text()); const d=await r.json(); return d[0]; },
  async deleteBundle(id,t){ await fetch(`${SUPABASE_URL}/rest/v1/bundles?id=eq.${id}`,{method:"DELETE",headers:hdrs(t)}); },
  async getBundleItems(bundleId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/bundle_items?bundle_id=eq.${bundleId}`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async addBundleItem(item,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/bundle_items`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(item)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async removeBundleItem(id,t){ await fetch(`${SUPABASE_URL}/rest/v1/bundle_items?id=eq.${id}`,{method:"DELETE",headers:hdrs(t)}); },
  // ── Phase 13 — seller storefronts ─────────────────────────────────────────
  // Patch the storefront columns on a profile (banner, bio, tagline, location,
  // instagram). Self-heals like updateProfileVerification: if the schema is
  // missing a column (migration not yet run) drop it and retry so the rest of
  // the storefront still saves.
  async updateProfileStorefront(uid,patch,t){
    const url=`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`; let payload={...patch};
    for(let i=0;i<10;i++){
      const r=await fetch(url,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(payload)});
      if(r.ok) return r.json();
      const text=await r.text(); const m=/Could not find the '([^']+)' column/.exec(text); const col=m&&m[1];
      if(col&&Object.prototype.hasOwnProperty.call(payload,col)){ delete payload[col]; continue; }
      throw new Error(text);
    }
    throw new Error("Couldn't save your storefront.");
  },
  // ── Phase 14 — Bundle discounts ───────────────────────────────────────────
  // The set of sellers offering a bundle discount (bundle_discount_enabled=true),
  // with the % each offers, so the shop grid / storefront / bag can apply it
  // without a per-card profile fetch. Mirrors getVacationSellers/getVerifiedSellers.
  // Returns [] if the column doesn't exist yet (migration not run) so the feature
  // simply stays dormant rather than throwing.
  async getBundleDiscountSellers(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/profiles?bundle_discount_enabled=eq.true&select=id,bundle_discount_percentage`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  // Save the seller's bundle-discount settings. Self-heals like the other profile
  // patches: if the schema is missing a column (migration not yet run) drop it and
  // retry so the save still lands wherever it can.
  async setBundleDiscount(uid,patch,t){
    const url=`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`; let payload={...patch};
    for(let i=0;i<10;i++){
      const r=await fetch(url,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(payload)});
      if(r.ok) return r.json();
      const text=await r.text(); const m=/Could not find the '([^']+)' column/.exec(text); const col=m&&m[1];
      if(col&&Object.prototype.hasOwnProperty.call(payload,col)){ delete payload[col]; continue; }
      throw new Error(text);
    }
    throw new Error("Couldn't save your bundle discount.");
  },
  async getFollowing(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/follows?follower_id=eq.${uid}`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async getFollowers(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/follows?following_id=eq.${uid}`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async follow(followerId,followingId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/follows`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify({follower_id:followerId,following_id:followingId})}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async unfollow(followerId,followingId,t){ await fetch(`${SUPABASE_URL}/rest/v1/follows?follower_id=eq.${followerId}&following_id=eq.${followingId}`,{method:"DELETE",headers:hdrs(t)}); },
  async getFeedListings(followingIds,t){ if(!followingIds.length)return []; const ids=followingIds.map(id=>`user_id.eq.${id}`).join(","); const r=await fetch(`${SUPABASE_URL}/rest/v1/listings?or=(${ids})&order=created_at.desc&limit=40`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async getNotifications(uid,t){ touchActive(uid,t); const r=await fetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${uid}&order=created_at.desc&limit=30`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async insertNotification(n,t){ await fetch(`${SUPABASE_URL}/rest/v1/notifications`,{method:"POST",headers:hdrs(t),body:JSON.stringify(n)}); },
  async markNotifRead(id,t){ await fetch(`${SUPABASE_URL}/rest/v1/notifications?id=eq.${id}`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify({read:true})}); },
  async markAllNotifsRead(uid,t){ await fetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${uid}&read=eq.false`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify({read:true})}); },
  async updateConversation(id,patch,t){ await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${id}`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify(patch)}); },
  async markMessagesRead(convId,uid,t){ await fetch(`${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${convId}&sender_id=neq.${uid}&read=eq.false`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify({read:true})}); },
  async countUnread(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/messages?read=eq.false&select=id,conversation_id,conversations!inner(buyer_id,seller_id)`,{headers:{...hdrs(t),"Accept":"application/json"}}); if(!r.ok)return 0; const d=await r.json(); return d.filter(m=>m.sender_id!==uid).length; },
  async createOrder(order,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/orders`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(order)}); if(!r.ok)throw new Error(await r.text()); const d=await r.json(); return d[0]; },
  async getSavedSearches(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/saved_searches?user_id=eq.${uid}&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async saveSearch(s,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/saved_searches`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(s)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async deleteSavedSearch(id,t){ await fetch(`${SUPABASE_URL}/rest/v1/saved_searches?id=eq.${id}`,{method:"DELETE",headers:hdrs(t)}); },
  // Patch a saved search (toggling email_alerts on/off from the saved-searches
  // page). Self-heals like the other patches: if the schema predates a column
  // (e.g. email_alerts on a legacy query-only table) drop it and retry so the
  // rest of the patch still lands.
  async updateSavedSearch(id,patch,t){
    const url=`${SUPABASE_URL}/rest/v1/saved_searches?id=eq.${id}`; let payload={...patch};
    for(let i=0;i<10;i++){
      const r=await fetch(url,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(payload)});
      if(r.ok) return r.json();
      const text=await r.text(); const m=/Could not find the '([^']+)' column/.exec(text); const col=m&&m[1];
      if(col&&Object.prototype.hasOwnProperty.call(payload,col)){ delete payload[col]; continue; }
      throw new Error(text);
    }
    throw new Error("Couldn't update the saved search.");
  },
  // Fire-and-forget kick of the saved-search-alerts Edge Function right after a
  // listing is published, so matching buyers are emailed within minutes rather
  // than waiting up to 6 hours for the cron sweep (issue PART 5). Best-effort:
  // the function dedupes on last_alerted_at and failures must never break the
  // listing flow.
  triggerSavedSearchAlerts(listingId){
    try{
      fetch(`${SUPABASE_URL}/functions/v1/saved-search-alerts`,{
        method:"POST",
        headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,"Content-Type":"application/json"},
        body:JSON.stringify({listingId,trigger:"new_listing"}),
        keepalive:true,
      }).catch(()=>{});
    }catch{ /* never throw from a notification side-effect */ }
  },
  async getMyOrders(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/orders?or=(buyer_id.eq.${uid},seller_id.eq.${uid})&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async updateOrder(id,patch,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${id}`,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(patch)}); if(!r.ok)throw new Error(await r.text()); const d=await r.json();
    // Emails 3 & 4 — seller moving the order through DISPATCHED / DELIVERED. The
    // function looks up the buyer + listing from the order id.
    const st=(patch.status||"").toLowerCase();
    if(st==="dispatched") fireEmail({type:"order_dispatched",orderId:id});
    else if(st==="delivered") fireEmail({type:"order_delivered",orderId:id});
    return d; },
  async getNewListings(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/listings?sold=eq.false&order=created_at.desc&limit=12`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async getPriceDrops(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/listings?sold=eq.false&prev_price=not.is.null&order=updated_at.desc&limit=12`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async getTrending(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/listings?sold=eq.false&order=views.desc&limit=12`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  // ── Phase 10e — Shop the Look ─────────────────────────────────────────────
  // Each look is fetched WITH its items embedded, and each item WITH its listing
  // embedded, in a single PostgREST request via the look_items / listings FKs.
  // That gives the card everything it needs (piece count, total price, cover) and
  // the detail view every listing — no per-item round-trips. Items are ordered by
  // `position` client-side after the fetch.
  async getActiveLooks(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/looks?active=eq.true&select=*,look_items(*,listings(*))&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async getLook(id,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/looks?id=eq.${id}&select=*,look_items(*,listings(*))&limit=1`,{headers:hdrs(t)}); if(!r.ok)return null; const d=await r.json(); return d[0]||null; },
  // A seller/admin's own looks (drafts included) for the TOOLS tab.
  async getLooksByUser(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/looks?created_by=eq.${uid}&select=*,look_items(*,listings(*))&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async createLook(look,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/looks`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(look)}); if(!r.ok)throw new Error(await r.text()); const d=await r.json(); return d[0]; },
  async updateLook(id,patch,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/looks?id=eq.${id}`,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(patch)}); if(!r.ok)throw new Error(await r.text()); const d=await r.json(); return d[0]; },
  async deleteLook(id,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/looks?id=eq.${id}`,{method:"DELETE",headers:hdrs(t)}); if(!r.ok)throw new Error(await r.text()); },
  async addLookItem(item,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/look_items`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(item)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  // Replace a look's items wholesale (used on edit): delete then re-insert.
  async clearLookItems(lookId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/look_items?look_id=eq.${lookId}`,{method:"DELETE",headers:hdrs(t)}); if(!r.ok)throw new Error(await r.text()); },
  // Search listings by title across ALL sellers (case-insensitive, available
  // only) for the create-a-look listing picker.
  async searchListings(q,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/listings?name=ilike.*${encodeURIComponent(q)}*&sold=eq.false&order=created_at.desc&limit=20`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },

  // ── Phase 13 — Pricing suggestions ────────────────────────────────────────
  // Fetch SOLD comparable listings for the pricing-guide panel on the create/edit
  // form. Returns up to 50 rows ({price}) so the frontend can compute min/max/avg/
  // count itself — no aggregate Edge Function needed (issue PART 3).
  //
  // "Sold" is matched by EITHER signal: status='sold' (set by the stripe-webhook
  // on a real purchase) OR the legacy sold=true flag (set when a seller manually
  // marks a piece sold), so both kinds of sale feed the suggestion. `keywords` are
  // OR'd as case-insensitive title (name) matches; pass an empty array to fall
  // back to category-only matching. All filters are combined in a single nested
  // and(...) logic tree so PostgREST applies them together. Returns [] on error so
  // a missing column / RLS issue degrades to the "not enough data" message rather
  // than throwing into the form.
  async getSoldComps(category,keywords,t){
    if(!category) return [];
    const sold="or(status.eq.sold,sold.eq.true)";
    const clauses=[`category.eq.${encodeURIComponent(category)}`,sold];
    const kws=(keywords||[]).filter(Boolean);
    if(kws.length) clauses.push(`or(${kws.map(k=>`name.ilike.*${encodeURIComponent(k)}*`).join(",")})`);
    const url=`${SUPABASE_URL}/rest/v1/listings?and=(${clauses.join(",")})&select=price&limit=50`;
    try{ const r=await fetch(url,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); }
    catch{ return []; }
  },

  // ── Phase 14 — Style feed ─────────────────────────────────────────────────
  // A page of non-deleted posts, newest first. `limit`/`offset` drive the LOAD
  // MORE pagination (12 at a time). Profiles (avatar/username) and the tagged
  // listings are resolved separately — style_posts has no PostgREST FK to either
  // (user_id → auth.users, listing_ids is a uuid[]), so we batch-fetch them with
  // getProfilesFullByIds / getListingsByIds rather than embedding.
  async getStylePosts(limit,offset,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/style_posts?deleted=eq.false&order=created_at.desc&limit=${limit}&offset=${offset}`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  // The FOLLOWING tab — posts authored by the users this person follows, newest
  // first, paginated. Returns [] when they follow no-one (caller short-circuits).
  async getStylePostsByUsers(userIds,limit,offset,t){ if(!userIds.length)return []; const ids=userIds.map(id=>`user_id.eq.${id}`).join(","); const r=await fetch(`${SUPABASE_URL}/rest/v1/style_posts?and=(deleted.eq.false,or(${ids}))&order=created_at.desc&limit=${limit}&offset=${offset}`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  // The N most recent posts for the homepage STYLE INSPIRATION rail.
  async getRecentStylePosts(limit,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/style_posts?deleted=eq.false&order=created_at.desc&limit=${limit}`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  // A single post by id (the /post/<id> share deep link). Null if missing/deleted.
  async getStylePost(id,t){ if(!id)return null; const r=await fetch(`${SUPABASE_URL}/rest/v1/style_posts?id=eq.${id}&deleted=eq.false&limit=1`,{headers:hdrs(t)}); if(!r.ok)return null; const d=await r.json(); return d[0]||null; },
  // Batch-fetch listings by id (for a post's tagged pieces). Preserves nothing
  // about order — the caller maps them by id. Returns [] on error/empty.
  async getListingsByIds(ids,t){ if(!ids||!ids.length)return []; const r=await fetch(`${SUPABASE_URL}/rest/v1/listings?id=in.(${ids.join(",")})`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  // Which of these posts the signed-in user has liked, so hearts render filled.
  // Returns the liked post_ids (a subset of `postIds`).
  async getMyStyleLikes(userId,postIds,t){ if(!userId||!postIds||!postIds.length)return []; const r=await fetch(`${SUPABASE_URL}/rest/v1/style_post_likes?user_id=eq.${userId}&post_id=in.(${postIds.join(",")})&select=post_id`,{headers:hdrs(t)}); if(!r.ok)return []; const d=await r.json(); return d.map(x=>x.post_id); },
  async insertStylePost(post,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/style_posts`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(post)}); if(!r.ok)throw new Error(await r.text()); const d=await r.json(); return d[0]; },
  // Soft delete — own post only. Sets deleted=true; the row is never removed.
  async deleteStylePost(id,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/style_posts?id=eq.${id}`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify({deleted:true})}); if(!r.ok)throw new Error(await r.text()); },
  // Like / unlike. The UNIQUE(post_id,user_id) constraint makes a re-like a
  // harmless 409; the optimistic UI has already flipped the heart either way.
  async likeStylePost(postId,userId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/style_post_likes`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify({post_id:postId,user_id:userId})}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async unlikeStylePost(postId,userId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/style_post_likes?post_id=eq.${postId}&user_id=eq.${userId}`,{method:"DELETE",headers:hdrs(t)}); if(!r.ok)throw new Error(await r.text()); },
  // Sync the denormalised counter after a like/unlike (best-effort background write).
  async setStylePostLikes(id,count,t){ await fetch(`${SUPABASE_URL}/rest/v1/style_posts?id=eq.${id}`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify({likes_count:Math.max(0,count)})}); },

  // ── Phase 15 — Tailor profiles ────────────────────────────────────────────
  // The single tailor system: any user can apply to become a tailor, an admin
  // approves them, and approved tailors get a public profile at /tailors/<id>
  // with a portfolio (browsable via the tailor directory).
  //
  // The signed-in user's own tailor row (their application/profile), or null if
  // they've never applied. UNIQUE(user_id) means at most one row. Returns null on
  // any error (e.g. the table doesn't exist yet because the migration hasn't run)
  // so the BECOME A TAILOR nav entry simply shows rather than throwing.
  async getMyTailor(uid,t){ if(!uid)return null; const r=await fetch(`${SUPABASE_URL}/rest/v1/tailors?user_id=eq.${uid}&limit=1`,{headers:hdrs(t)}); if(!r.ok)return null; const d=await r.json(); return d[0]||null; },
  // A single tailor by id WITH its portfolio embedded (one request, ordered by
  // position client-side) for the public /tailors/<id> page. Null if missing.
  async getTailor(id,t){ if(!id)return null; const r=await fetch(`${SUPABASE_URL}/rest/v1/tailors?id=eq.${id}&select=*,tailor_portfolio(*)&limit=1`,{headers:hdrs(t)}); if(r.ok){ const d=await r.json(); if(d[0])return d[0]; } const r2=await fetch(`${SUPABASE_URL}/rest/v1/tailors?id=eq.${id}&limit=1`,{headers:hdrs(t)}); if(!r2.ok)return null; const d2=await r2.json(); return d2[0]||null; },
  // Every approved tailor, newest first, for a future directory. Returns [] if
  // the table doesn't exist yet.
  async getApprovedTailors(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/tailors?status=eq.approved&order=approved_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  // Submit an application. Self-heals like insertDispute: if the schema is missing
  // an optional column (migration not fully run) drop it and retry so the
  // application still records. display_name/location are required and never dropped.
  async insertTailor(row,t){
    const url=`${SUPABASE_URL}/rest/v1/tailors`; let payload={...row};
    for(let i=0;i<20;i++){
      const r=await fetch(url,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(payload)});
      if(r.ok){ const d=await r.json(); return d[0]; }
      const text=await r.text(); const m=/Could not find the '([^']+)' column/.exec(text); const col=m&&m[1];
      if(col&&col!=="display_name"&&col!=="location"&&Object.prototype.hasOwnProperty.call(payload,col)){ delete payload[col]; continue; }
      throw new Error(text);
    }
    throw new Error("Couldn't submit your tailor application.");
  },
  // Patch a tailor row (edit profile, approve/reject, reapply). Self-heals by
  // dropping any column the schema is missing and retrying.
  async updateTailor(id,patch,t){
    const url=`${SUPABASE_URL}/rest/v1/tailors?id=eq.${id}`; let payload={...patch};
    for(let i=0;i<20;i++){
      const r=await fetch(url,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(payload)});
      if(r.ok){ const d=await r.json(); return d[0]; }
      const text=await r.text(); const m=/Could not find the '([^']+)' column/.exec(text); const col=m&&m[1];
      if(col&&Object.prototype.hasOwnProperty.call(payload,col)){ delete payload[col]; continue; }
      throw new Error(text);
    }
    throw new Error("Couldn't update the tailor profile.");
  },
  // Admin panel — every application that isn't approved yet (pending/rejected/
  // suspended), newest first. Returns [] if the table doesn't exist yet.
  async getPendingTailors(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/tailors?select=*,tailor_portfolio(*)&order=created_at.desc`,{headers:hdrs(t)}); if(r.ok)return r.json(); const r2=await fetch(`${SUPABASE_URL}/rest/v1/tailors?order=created_at.desc`,{headers:hdrs(t)}); if(!r2.ok)return []; return r2.json(); },
  // Portfolio — a tailor's images, ordered by position then created_at.
  async getTailorPortfolio(tailorId,t){ if(!tailorId)return []; const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_portfolio?tailor_id=eq.${tailorId}&order=position.asc,created_at.asc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async insertPortfolioItems(rows,t){ if(!rows.length)return []; const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_portfolio`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(rows)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async updatePortfolioItem(id,patch,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_portfolio?id=eq.${id}`,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(patch)}); if(!r.ok)throw new Error(await r.text()); const d=await r.json(); return d[0]; },
  async deletePortfolioItem(id,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_portfolio?id=eq.${id}`,{method:"DELETE",headers:hdrs(t)}); if(!r.ok)throw new Error(await r.text()); },
  // ── Wallet — a seller's earnings ledger (sale credits + withdrawals) ──────────
  // Newest first. Balance is derived client-side as the sum of every non-'failed'
  // row's amount_pence (credits positive, withdrawals negative).
  async getWalletTransactions(uid,t){ if(!uid)return []; const r=await fetch(`${SUPABASE_URL}/rest/v1/wallet_transactions?user_id=eq.${uid}&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  // Release a held sale credit to the seller's withdrawable balance once the buyer
  // confirms receipt (Vinted-style escrow). Keyed on the listing (sells once), so
  // it flips that listing's pending 'sale' credit → 'available'.
  async releaseSaleEarnings(listingId,t){ if(!listingId)return; await fetch(`${SUPABASE_URL}/rest/v1/wallet_transactions?listing_id=eq.${listingId}&type=eq.sale&status=eq.pending`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify({status:"available"})}); },
  // Dispute hold: a buyer reported a problem → keep the credit held (pending →
  // disputed) so it can't auto-release until an admin resolves it.
  async holdDisputedEarnings(listingId,t){ if(!listingId)return; await fetch(`${SUPABASE_URL}/rest/v1/wallet_transactions?listing_id=eq.${listingId}&type=eq.sale&status=eq.pending`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify({status:"disputed"})}); },
  // Dispute resolution: release to the seller (resolved) or reverse so they're not
  // paid (refunded). Acts on whichever held state the credit is in.
  async settleDisputedEarnings(listingId,release,t){ if(!listingId)return; await fetch(`${SUPABASE_URL}/rest/v1/wallet_transactions?listing_id=eq.${listingId}&type=eq.sale&status=in.(pending,disputed)`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify({status:release?"available":"failed"})}); },
  // Bulk-release held credits by id (used by the auto-release safety net).
  async releaseWalletCreditsByIds(ids,t){ if(!ids||!ids.length)return; await fetch(`${SUPABASE_URL}/rest/v1/wallet_transactions?id=in.(${ids.join(",")})`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify({status:"available"})}); },

  // Fire the tailor-approved email (resolved server-side from the tailor id).
  fireTailorApprovedEmail(tailorId){ if(tailorId) fireEmail({type:"tailor_approved",tailorId}); },
  // On submission: confirm to the applicant, and alert each admin to review it.
  fireTailorApplicationReceivedEmail(tailorId){ if(tailorId) fireEmail({type:"tailor_application_received",tailorId}); },
  fireTailorApplicationAdminEmail(tailorId,adminUserId){ if(tailorId&&adminUserId) fireEmail({type:"tailor_application_admin",tailorId,userId:adminUserId}); },

  // ── Phase 15 — Request alterations on a listing ───────────────────────────
  // A buyer picks an approved tailor and describes the alterations they need.
  // The request lives in alteration_requests; the tailor responds (quote/decline)
  // from their dashboard. Payment for an accepted quote comes in a later issue.
  //
  // Insert a new request. Self-heals like insertTailor/insertOffer: if the schema
  // is missing an optional column (e.g. quote_pence on a deployment whose
  // migration hasn't run) drop it and retry so the request still records.
  // `description` is required and never dropped. On success the new-request email
  // to the tailor is fired (resolved server-side from the request id).
  async insertAlterationRequest(row,t){
    const url=`${SUPABASE_URL}/rest/v1/alteration_requests`; let payload={...row};
    for(let i=0;i<20;i++){
      const r=await fetch(url,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(payload)});
      if(r.ok){ const d=await r.json(); const created=d[0];
        if(created&&created.id) fireEmail({type:"alteration_request",requestId:created.id});
        return created; }
      const text=await r.text(); const m=/Could not find the '([^']+)' column/.exec(text); const col=m&&m[1];
      if(col&&col!=="description"&&Object.prototype.hasOwnProperty.call(payload,col)){ delete payload[col]; continue; }
      throw new Error(text);
    }
    throw new Error("Couldn't send your alteration request.");
  },
  // The buyer's own requests, newest first, WITH the listing (thumbnail/title)
  // and tailor (name/image/user) embedded for the /alterations page — no per-row
  // round-trip. Falls back to a plain select where the embed isn't available,
  // then [] if the table doesn't exist yet (migration not run).
  async getBuyerAlterationRequests(buyerId,t){ if(!buyerId)return [];
    const r=await fetch(`${SUPABASE_URL}/rest/v1/alteration_requests?buyer_id=eq.${buyerId}&select=*,listings(id,name,image_url,images),tailors(id,display_name,profile_image_url,user_id),tailor_payouts(status)&order=created_at.desc`,{headers:hdrs(t)});
    if(r.ok)return r.json();
    const rEmbed=await fetch(`${SUPABASE_URL}/rest/v1/alteration_requests?buyer_id=eq.${buyerId}&select=*,listings(id,name,image_url,images),tailors(id,display_name,profile_image_url,user_id)&order=created_at.desc`,{headers:hdrs(t)});
    if(rEmbed.ok)return rEmbed.json();
    const r2=await fetch(`${SUPABASE_URL}/rest/v1/alteration_requests?buyer_id=eq.${buyerId}&order=created_at.desc`,{headers:hdrs(t)}); if(!r2.ok)return []; return r2.json(); },
  // A tailor's incoming requests, newest first, WITH the listing embedded for the
  // dashboard BOOKINGS tab. Buyer names are resolved separately via
  // getProfilesByIds (mirrors how the seller OFFERS tab resolves offer buyers).
  async getTailorAlterationRequests(tailorId,t){ if(!tailorId)return [];
    const r=await fetch(`${SUPABASE_URL}/rest/v1/alteration_requests?tailor_id=eq.${tailorId}&select=*,listings(id,name,image_url,images)&order=created_at.desc`,{headers:hdrs(t)});
    if(r.ok)return r.json();
    const r2=await fetch(`${SUPABASE_URL}/rest/v1/alteration_requests?tailor_id=eq.${tailorId}&order=created_at.desc`,{headers:hdrs(t)}); if(!r2.ok)return []; return r2.json(); },
  // Tailor sends a quote: status -> quoted, persist quote_pence + optional message.
  // Self-heals by dropping any column the schema is missing. Fires the quote email
  // to the buyer (resolved server-side from the request id).
  async sendAlterationQuote(id,quotePence,message,t){
    const url=`${SUPABASE_URL}/rest/v1/alteration_requests?id=eq.${id}`; let payload={status:"quoted",quote_pence:quotePence,quote_message:message||null};
    for(let i=0;i<10;i++){
      const r=await fetch(url,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(payload)});
      if(r.ok){ const d=await r.json(); fireEmail({type:"alteration_quote",requestId:id}); return d[0]; }
      const text=await r.text(); const m=/Could not find the '([^']+)' column/.exec(text); const col=m&&m[1];
      if(col&&col!=="status"&&Object.prototype.hasOwnProperty.call(payload,col)){ delete payload[col]; continue; }
      throw new Error(text);
    }
    throw new Error("Couldn't send the quote.");
  },
  // Tailor declines a request: status -> declined. Fires the decline email.
  async declineAlterationRequest(id,t){
    const r=await fetch(`${SUPABASE_URL}/rest/v1/alteration_requests?id=eq.${id}`,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify({status:"declined"})});
    if(!r.ok)throw new Error(await r.text()); const d=await r.json(); fireEmail({type:"alteration_declined",requestId:id}); return d[0];
  },
  // Generic status patch (e.g. buyer cancels, or accepts a quote in a later issue).
  async updateAlterationRequest(id,patch,t){
    const r=await fetch(`${SUPABASE_URL}/rest/v1/alteration_requests?id=eq.${id}`,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(patch)});
    if(!r.ok)throw new Error(await r.text()); const d=await r.json(); return d[0];
  },

  // ── Phase 15 — Tailor booking payments + completion ───────────────────────
  // Buyer declines a quote: status -> declined. Fires the decline email to the
  // tailor (reuses the existing alteration_declined template).
  async declineAlterationQuote(id,t){
    const r=await fetch(`${SUPABASE_URL}/rest/v1/alteration_requests?id=eq.${id}`,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify({status:"declined"})});
    if(!r.ok)throw new Error(await r.text()); const d=await r.json(); return d[0];
  },
  // Tailor marks an accepted booking complete: status -> completed. Fires the
  // "please confirm completion" email to the buyer (resolved server-side).
  async markAlterationComplete(id,t){
    const r=await fetch(`${SUPABASE_URL}/rest/v1/alteration_requests?id=eq.${id}`,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify({status:"completed"})});
    if(!r.ok)throw new Error(await r.text()); const d=await r.json();
    fireEmail({type:"alteration_completed_buyer",requestId:id});
    return d[0];
  },
  // Buyer confirms completion: release the tailor's payout (status -> paid). Marks
  // every payout row for this request paid (there's normally exactly one).
  async confirmAlterationPayout(requestId,t){
    const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_payouts?alteration_request_id=eq.${requestId}`,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify({status:"paid"})});
    if(!r.ok)throw new Error(await r.text()); return r.json();
  },
  // A tailor's payout rows (for the dashboard EARNINGS section), with the request
  // + listing embedded for the "paid bookings" list. Falls back to a plain select
  // where the embed isn't available, then [] if the table doesn't exist yet.
  async getTailorPayouts(tailorId,t){ if(!tailorId)return [];
    const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_payouts?tailor_id=eq.${tailorId}&select=*,alteration_requests(id,garment_type,listing_id,paid_at,listings(name,image_url,images))&order=created_at.desc`,{headers:hdrs(t)});
    if(r.ok)return r.json();
    const r2=await fetch(`${SUPABASE_URL}/rest/v1/tailor_payouts?tailor_id=eq.${tailorId}&order=created_at.desc`,{headers:hdrs(t)}); if(!r2.ok)return []; return r2.json(); },
  // Admin PAYOUTS oversight — EVERY payout, newest first, with the booking (+
  // listing) and tailor embedded for the table. Falls back to a plain select where
  // the embed isn't available, then [] if the table doesn't exist yet.
  async getAllPayouts(t){
    const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_payouts?select=*,alteration_requests(id,garment_type,listing_id,listings(name,image_url,images)),tailors(id,display_name)&order=created_at.desc`,{headers:hdrs(t)});
    if(r.ok)return r.json();
    const r2=await fetch(`${SUPABASE_URL}/rest/v1/tailor_payouts?order=created_at.desc`,{headers:hdrs(t)}); if(!r2.ok)return []; return r2.json(); },

  // ── Phase 15 — Tailor reviews & ratings ───────────────────────────────────
  // A buyer reviews a tailor after a completed booking. Reviews live in their own
  // tailor_reviews table (separate from the Phase 10b listing `reviews`); the
  // tailor row carries a denormalised average_rating / review_count roll-up.
  //
  // Insert a review, then recalculate the tailor's average. The UNIQUE constraint
  // on alteration_request_id makes a duplicate review a harmless 409 (we surface
  // it as an error to the caller so the UI can say "already reviewed"). On success
  // the review email to the tailor fires (resolved server-side from the review id).
  async insertTailorReview(review,t){
    const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_reviews`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(review)});
    if(!r.ok)throw new Error(await r.text());
    const d=await r.json(); const created=d[0];
    if(review&&review.tailor_id) await db.recalcTailorRating(review.tailor_id,t);
    if(created&&created.id) fireEmail({type:"tailor_review",reviewId:created.id});
    return created;
  },
  // Recompute a tailor's average_rating + review_count from their reviews and
  // patch the tailor row. Best-effort: counts client-side from a lightweight
  // select (PostgREST has no portable AVG without an RPC), then PATCHes via the
  // self-healing updateTailor so a deployment missing the columns degrades quietly.
  async recalcTailorRating(tailorId,t){
    if(!tailorId)return;
    try{
      const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_reviews?tailor_id=eq.${tailorId}&select=rating`,{headers:hdrs(t)});
      if(!r.ok)return;
      const rows=await r.json();
      const count=rows.length;
      const avg=count?Math.round((rows.reduce((s,x)=>s+(Number(x.rating)||0),0)/count)*100)/100:0;
      await db.updateTailor(tailorId,{average_rating:avg,review_count:count},t);
    }catch(e){ /* a stale roll-up is better than a failed review submission */ }
  },
  // Every review for one tailor, newest first, WITH the alteration request
  // (garment_type) embedded for the "Lehenga alteration" line. Buyer first names
  // + avatars are resolved separately via getProfilesFullByIds (tailor_reviews has
  // no PostgREST FK to profiles). Falls back to a plain select then [] so the
  // section degrades to its empty state rather than throwing.
  async getTailorReviews(tailorId,t){ if(!tailorId)return [];
    const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_reviews?tailor_id=eq.${tailorId}&select=*,alteration_requests(garment_type)&order=created_at.desc`,{headers:hdrs(t)});
    if(r.ok)return r.json();
    const r2=await fetch(`${SUPABASE_URL}/rest/v1/tailor_reviews?tailor_id=eq.${tailorId}&order=created_at.desc`,{headers:hdrs(t)}); if(!r2.ok)return []; return r2.json(); },
  // The reviews this buyer has already left, so the /alterations page can show
  // "Review submitted" + their stars instead of the LEAVE A REVIEW button (and
  // never prompt twice for the same booking). Keyed by caller into a
  // request_id -> review map. Returns [] if the table doesn't exist yet.
  async getMyTailorReviews(buyerId,t){ if(!buyerId)return [];
    const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_reviews?buyer_id=eq.${buyerId}&select=id,alteration_request_id,rating,comment`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },

  // ── Phase 15 — Tailor availability calendar ───────────────────────────────
  // Every availability row for one tailor (the dates they've explicitly marked).
  // A date with NO row falls back to "available with the tailor's default slots".
  // Used both by the tailor's own dashboard AVAILABILITY tab and the read-only
  // calendar on the public /tailors/<id> profile. Returns [] if the table doesn't
  // exist yet (migration not run) so the calendar degrades to all-default rather
  // than throwing.
  async getTailorAvailability(tailorId,t){ if(!tailorId)return [];
    const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_availability?tailor_id=eq.${tailorId}&order=date.asc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  // Upsert a single day's row. The UNIQUE(tailor_id,date) constraint +
  // resolution=merge-duplicates means a repeat write for the same date updates in
  // place rather than 409-ing. Returns the saved row.
  async upsertTailorAvailability(row,t){
    const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_availability`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation,resolution=merge-duplicates"},body:JSON.stringify(row)});
    if(!r.ok)throw new Error(await r.text()); const d=await r.json(); return Array.isArray(d)?d[0]:d; },
  // Upsert many days at once (week toggle / bulk actions). Same merge-duplicates
  // semantics so re-marking already-stored dates updates them in place.
  async bulkUpsertTailorAvailability(rows,t){ if(!rows||!rows.length)return [];
    const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_availability`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation,resolution=merge-duplicates"},body:JSON.stringify(rows)});
    if(!r.ok)throw new Error(await r.text()); return r.json(); },
  // MARK ALL AS AVAILABLE — wipe every override so all dates fall back to the
  // tailor's default (available with default slots).
  async clearTailorAvailability(tailorId,t){ if(!tailorId)return;
    const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_availability?tailor_id=eq.${tailorId}`,{method:"DELETE",headers:hdrs(t)}); if(!r.ok)throw new Error(await r.text()); },
};
