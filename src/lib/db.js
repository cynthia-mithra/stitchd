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
  async upsertProfile(profile,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/profiles`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation,resolution=merge-duplicates"},body:JSON.stringify(profile)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async getListingsByUser(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/listings?user_id=eq.${uid}&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async incrementViews(id,views,t){ await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${id}`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify({views:(views||0)+1})}); },
  async getReviews(sellerId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/reviews?seller_id=eq.${sellerId}&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async getAllReviewStats(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/reviews?select=seller_id,rating`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async getFastSellers(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/profiles?fast_seller=eq.true&select=id`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
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
};
