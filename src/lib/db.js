import { SUPABASE_URL, hdrs } from "./constants";

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
// A column PostgREST/Postgres names in a *non*-missing error we can recover from
// by dropping it: a NOT NULL violation on a column we sent as null, or a type
// mismatch (e.g. the table has `specialises_in text` but we send a text[]).
// Postgres phrases these as `null value in column "X" …` / `column "X" is of
// type … but expression is of type …`. RLS / permission errors never name a
// column this way, so this never masks an auth failure.
const recoverableColumn=msg=>{ const m=/column "([^"]+)"/.exec(msg||""); return m?m[1]:null; };
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
  // Saves a profile by UPDATING the existing row first, and only INSERTing when no
  // row exists yet — mirroring the (working) listing save, which uses a plain POST
  // for new rows and a PATCH for existing ones.
  //
  // It previously did a single POST upsert (`Prefer: resolution=merge-duplicates`,
  // i.e. INSERT … ON CONFLICT DO UPDATE). That was the real "fails on every change"
  // bug: a Supabase `profiles` table almost always has RLS enabled with a SELECT
  // and an UPDATE policy, but NO INSERT policy — rows are created by the
  // `handle_new_user` signup trigger, not by the client. An upsert ALWAYS runs the
  // INSERT path (even when the row already exists, which it does after signup), and
  // RLS validates that path against the missing INSERT policy → 42501
  // "new row violates row-level security policy" on EVERY edit. A plain PATCH only
  // needs the UPDATE policy, which is present, so it just works. (Listings were
  // unaffected: that table has an INSERT policy, and its save PATCHes existing rows.)
  //
  // Both paths self-heal like sendHealing: PostgREST rejects the WHOLE write with
  // PGRST204 "Could not find the 'X' column of 'profiles'" / a NOT NULL / a type
  // error if the payload names a column the table can't store — drop that column
  // and retry so the profile still saves with whatever columns the schema has.
  async upsertProfile(profile,t){
    // The columns a basic profile edit always sets. If a write fails for a reason
    // we can't pin to a single droppable column (e.g. an optional column has the
    // wrong type and we can't parse its name), we retry ONCE with just these so a
    // problem with a tailor / measurement / array column can never block saving a
    // name, avatar or bio.
    const CORE=["id","username","full_name","avatar_url","bio","location","region","currency"];
    // Self-healing send for one method+url. Returns the parsed representation array.
    const heal=async(method,url,initial)=>{
      let payload={...initial}; const dropped=[]; let triedCore=false;
      const has=k=>Object.prototype.hasOwnProperty.call(payload,k);
      for(let i=0;i<60;i++){
        const r=await fetch(url,{method,headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(payload)});
        if(r.ok){ if(dropped.length)console.warn(`Profile saved after dropping field(s) your 'profiles' table can't store: ${dropped.join(", ")}. Apply the migration in Supabase to persist these.`); return r.json(); }
        const text=await r.text();
        // 1) A missing column (PGRST204) — drop it and retry.
        const miss=missingColumn(text);
        if(miss&&miss!=="id"&&has(miss)){ delete payload[miss]; dropped.push(miss); continue; }
        // 2) A NOT NULL / type error that names a non-core column — drop it so the
        //    rest still saves (a NOT NULL column then falls back to its DB default).
        const bad=recoverableColumn(text);
        if(bad&&!CORE.includes(bad)&&has(bad)){ delete payload[bad]; dropped.push(bad); continue; }
        // 3) Last resort: anything else that isn't clearly auth/RLS — retry once
        //    with only the core columns, in case an optional column is the culprit.
        if(!triedCore&&!/(row-level security|permission|not authorized|JWT|policy)/i.test(text)){
          triedCore=true; const core={}; CORE.forEach(k=>{ if(Object.prototype.hasOwnProperty.call(initial,k)) core[k]=initial[k]; });
          if(Object.keys(core).length<Object.keys(payload).length){ payload=core; dropped.push("optional profile fields"); continue; }
        }
        throw new Error(text);
      }
      throw new Error("Couldn't save: too many columns are missing from the 'profiles' table.");
    };
    // UPDATE the existing row first (needs only the UPDATE policy). A PATCH that
    // matches no row returns [] with 200, so an empty result means there's no row
    // yet → fall through to INSERT (needed only for a brand-new profile).
    const updated=await heal("PATCH",`${SUPABASE_URL}/rest/v1/profiles?id=eq.${profile.id}`,profile);
    if(Array.isArray(updated)&&updated.length) return updated;
    return heal("POST",`${SUPABASE_URL}/rest/v1/profiles`,profile);
  },
  async getListingsByUser(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/listings?user_id=eq.${uid}&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
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
  // Wishlists / favourites. getAllWishlists returns one row per save (listing_id
  // only) for the whole grid — counted client-side into a listing_id->count map,
  // mirroring getAllReviewStats. getMyWishlist returns just the current user's
  // saved listing_ids so cards can show a filled heart. add/remove toggle a row;
  // the table's UNIQUE(user_id,listing_id) makes a double-add a harmless 409.
  async getAllWishlists(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/wishlists?select=listing_id`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async getMyWishlist(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/wishlists?user_id=eq.${uid}&select=listing_id`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async addWishlist(uid,listingId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/wishlists`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify({user_id:uid,listing_id:listingId})}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async removeWishlist(uid,listingId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/wishlists?user_id=eq.${uid}&listing_id=eq.${listingId}`,{method:"DELETE",headers:hdrs(t)}); if(!r.ok)throw new Error(await r.text()); },
  async insertReview(review,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/reviews`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(review)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async insertReport(report,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/reports`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(report)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async getConversations(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/conversations?or=(buyer_id.eq.${uid},seller_id.eq.${uid})&order=last_message_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async findConversation(buyerId,sellerId,listingId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/conversations?buyer_id=eq.${buyerId}&seller_id=eq.${sellerId}&listing_id=eq.${listingId}&limit=1`,{headers:hdrs(t)}); if(!r.ok)return null; const d=await r.json(); return d[0]||null; },
  async createConversation(conv,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/conversations`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(conv)}); if(!r.ok)throw new Error(await r.text()); const d=await r.json(); return d[0]; },
  async getMessages(convId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${convId}&order=created_at.asc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async sendMessage(msg,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/messages`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(msg)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async updateMessage(id,patch,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/messages?id=eq.${id}`,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(patch)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async getBundles(sellerId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/bundles?seller_id=eq.${sellerId}&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async getAllBundles(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/bundles?order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async createBundle(bundle,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/bundles`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(bundle)}); if(!r.ok)throw new Error(await r.text()); const d=await r.json(); return d[0]; },
  async deleteBundle(id,t){ await fetch(`${SUPABASE_URL}/rest/v1/bundles?id=eq.${id}`,{method:"DELETE",headers:hdrs(t)}); },
  async getBundleItems(bundleId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/bundle_items?bundle_id=eq.${bundleId}`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async addBundleItem(item,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/bundle_items`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(item)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async removeBundleItem(id,t){ await fetch(`${SUPABASE_URL}/rest/v1/bundle_items?id=eq.${id}`,{method:"DELETE",headers:hdrs(t)}); },
  async getFollowing(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/follows?follower_id=eq.${uid}`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async getFollowers(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/follows?following_id=eq.${uid}`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async follow(followerId,followingId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/follows`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify({follower_id:followerId,following_id:followingId})}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async unfollow(followerId,followingId,t){ await fetch(`${SUPABASE_URL}/rest/v1/follows?follower_id=eq.${followerId}&following_id=eq.${followingId}`,{method:"DELETE",headers:hdrs(t)}); },
  async getFeedListings(followingIds,t){ if(!followingIds.length)return []; const ids=followingIds.map(id=>`user_id.eq.${id}`).join(","); const r=await fetch(`${SUPABASE_URL}/rest/v1/listings?or=(${ids})&order=created_at.desc&limit=40`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async getNotifications(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${uid}&order=created_at.desc&limit=30`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
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
  async getMyOrders(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/orders?or=(buyer_id.eq.${uid},seller_id.eq.${uid})&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async updateOrder(id,patch,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${id}`,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(patch)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async getNewListings(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/listings?sold=eq.false&order=created_at.desc&limit=12`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async getPriceDrops(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/listings?sold=eq.false&prev_price=not.is.null&order=updated_at.desc&limit=12`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async getTrending(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/listings?sold=eq.false&order=views.desc&limit=12`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async getTailorServices(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_services?active=eq.true&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async getMyTailorServices(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_services?tailor_id=eq.${uid}&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async insertTailorService(s,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_services`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(s)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async updateTailorService(id,patch,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_services?id=eq.${id}`,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(patch)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async deleteTailorService(id,t){ await fetch(`${SUPABASE_URL}/rest/v1/tailor_services?id=eq.${id}`,{method:"DELETE",headers:hdrs(t)}); },
  async createTailorBooking(b,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_bookings`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(b)}); if(!r.ok)throw new Error(await r.text()); const d=await r.json(); return d[0]; },
  async getMyTailorBookings(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_bookings?or=(tailor_id.eq.${uid},buyer_id.eq.${uid})&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async updateTailorBooking(id,patch,t){ await fetch(`${SUPABASE_URL}/rest/v1/tailor_bookings?id=eq.${id}`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify(patch)}); },

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
};
