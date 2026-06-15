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
  async getAllDisputes(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/disputes?select=*,orders(id,listing_id,status)&order=created_at.desc`,{headers:hdrs(t)}); if(r.ok)return r.json(); const r2=await fetch(`${SUPABASE_URL}/rest/v1/disputes?order=created_at.desc`,{headers:hdrs(t)}); if(!r2.ok)return []; return r2.json(); },
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
};
