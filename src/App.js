import React, { useState, useEffect, useMemo, useCallback } from "react";

const SUPABASE_URL = "https://zhstooqgkyuzxseylsbk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpoc3Rvb3Fna3l1enhzZXlsc2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzM3MzQsImV4cCI6MjA5NjE0OTczNH0.mW5GB1VzSfRBMWZRlU7OfQ0RqoT1wEBVBoai6dJ6eQs";
const STRIPE_PK   = "pk_test_51TelKZPVRS43N0XeftXWJNSr9wLp2Q5REYAkq1ABO0ztePMTP4zw6QHR4gN0o6nqWkZH66zYKRicGrgJvuQLywwo00oKnn5ydj";
const PLATFORM_FEE = 0.05; // 5%
const hdrs = (t) => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${t||SUPABASE_KEY}`, "Content-Type": "application/json" });

// ── STRIPE ─────────────────────────────────────────────────────────────────────
async function createStripeCheckout(listing, buyerEmail) {
  // Load Stripe.js dynamically
  if (!window.Stripe) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://js.stripe.com/v3/";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const stripe = window.Stripe(STRIPE_PK);
  const amount = parseFloat(listing.price);
  const fee    = parseFloat((amount * PLATFORM_FEE).toFixed(2));
  const sellerAmount = parseFloat((amount - fee).toFixed(2));

  // Use Stripe Payment Links approach via redirect
  // Build a Stripe Checkout session via Payment Links
  const params = new URLSearchParams({
    "line_items[0][price_data][currency]": (listing.currency||"USD").toLowerCase(),
    "line_items[0][price_data][product_data][name]": listing.name,
    "line_items[0][price_data][product_data][description]": `${listing.category} · ${listing.condition} · Sold by Stitch'd seller`,
    "line_items[0][price_data][unit_amount]": Math.round(amount * 100),
    "line_items[0][quantity]": 1,
    "mode": "payment",
    "success_url": `${window.location.href}?payment=success&listing=${listing.id}`,
    "cancel_url": `${window.location.href}?payment=cancelled`,
    "customer_email": buyerEmail||"",
  });
  return { stripe, amount, fee, sellerAmount };
}

// Simple Stripe checkout redirect using Stripe Payment Links
function buildPaymentSummary(listing) {
  const amount = parseFloat(listing.price);
  const fee    = parseFloat((amount * PLATFORM_FEE).toFixed(2));
  const sellerGets = parseFloat((amount - fee).toFixed(2));
  return { amount, fee, sellerGets };
}

const auth = {
  async signUp(email,pw){ const r=await fetch(`${SUPABASE_URL}/auth/v1/signup`,{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email,password:pw})}); const d=await r.json(); if(d.error)throw new Error(d.error.message||d.msg); return d; },
  async signIn(email,pw){ const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email,password:pw})}); const d=await r.json(); if(d.error)throw new Error(d.error.message||d.msg); return d; },
  async signOut(t){ await fetch(`${SUPABASE_URL}/auth/v1/logout`,{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${t}`}}); },
  // OTP
  async sendOTP(email){ const r=await fetch(`${SUPABASE_URL}/auth/v1/otp`,{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email,create_user:true})}); const d=await r.json(); if(d.error)throw new Error(d.error.message||d.msg); return d; },
  async verifyOTP(email,token){ const r=await fetch(`${SUPABASE_URL}/auth/v1/verify`,{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email,token,type:"email"})}); const d=await r.json(); if(d.error)throw new Error(d.error.message||d.msg); return d; },
  // 2FA / TOTP
  async enroll2FA(t){ const r=await fetch(`${SUPABASE_URL}/auth/v1/factors`,{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${t}`,"Content-Type":"application/json"},body:JSON.stringify({friendly_name:"Stitch'd Authenticator",factor_type:"totp"})}); const d=await r.json(); if(d.error)throw new Error(d.error.message||d.msg); return d; },
  async verify2FA(factorId,challengeId,code,t){ const r=await fetch(`${SUPABASE_URL}/auth/v1/factors/${factorId}/verify`,{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${t}`,"Content-Type":"application/json"},body:JSON.stringify({challenge_id:challengeId,code})}); const d=await r.json(); if(d.error)throw new Error(d.error.message||d.msg); return d; },
  async challenge2FA(factorId,t){ const r=await fetch(`${SUPABASE_URL}/auth/v1/factors/${factorId}/challenge`,{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${t}`,"Content-Type":"application/json"}}); const d=await r.json(); if(d.error)throw new Error(d.error.message||d.msg); return d; },
  async listFactors(t){ const r=await fetch(`${SUPABASE_URL}/auth/v1/factors`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${t}`}}); const d=await r.json(); if(d.error)return []; return d.totp||[]; },
  async unenroll2FA(factorId,t){ const r=await fetch(`${SUPABASE_URL}/auth/v1/factors/${factorId}`,{method:"DELETE",headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${t}`}}); return r.ok; },
  googleUrl(){ return `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(window.location.href)}`; },
  async refreshSession(refreshToken){ const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:refreshToken})}); const d=await r.json(); if(d.error)throw new Error(d.error.message); return d; },
  getSession(){ try{return JSON.parse(localStorage.getItem("stitchd_session"));}catch{return null;} },
  saveSession(s){ localStorage.setItem("stitchd_session",JSON.stringify(s)); },
  clearSession(){ localStorage.removeItem("stitchd_session"); },
};

async function uploadImage(file,t){
  const ext=file.name.split(".").pop();
  const path=`${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const r=await fetch(`${SUPABASE_URL}/storage/v1/object/listings/${path}`,{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${t||SUPABASE_KEY}`,"Content-Type":file.type,"x-upsert":"true"},body:file});
  if(!r.ok)throw new Error(await r.text());
  return `${SUPABASE_URL}/storage/v1/object/public/listings/${path}`;
}

const db = {
  async getAll(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/listings?order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async insert(item,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/listings`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(item)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async update(id,patch,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${id}`,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(patch)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async remove(id,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${id}`,{method:"DELETE",headers:hdrs(t)}); if(!r.ok)throw new Error(await r.text()); },
  async getProfile(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}&limit=1`,{headers:hdrs(t)}); if(!r.ok)return null; const d=await r.json(); return d[0]||null; },
  async upsertProfile(profile,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/profiles`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation,resolution=merge-duplicates"},body:JSON.stringify(profile)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async getListingsByUser(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/listings?user_id=eq.${uid}&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async incrementViews(id,views,t){ await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${id}`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify({views:(views||0)+1})}); },
  async getReviews(sellerId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/reviews?seller_id=eq.${sellerId}&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async insertReview(review,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/reviews`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(review)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async insertReport(report,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/reports`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(report)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  // messaging
  async getConversations(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/conversations?or=(buyer_id.eq.${uid},seller_id.eq.${uid})&order=last_message_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async findConversation(buyerId,sellerId,listingId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/conversations?buyer_id=eq.${buyerId}&seller_id=eq.${sellerId}&listing_id=eq.${listingId}&limit=1`,{headers:hdrs(t)}); if(!r.ok)return null; const d=await r.json(); return d[0]||null; },
  async createConversation(conv,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/conversations`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(conv)}); if(!r.ok)throw new Error(await r.text()); const d=await r.json(); return d[0]; },
  async getMessages(convId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${convId}&order=created_at.asc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async sendMessage(msg,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/messages`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(msg)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async updateMessage(id,patch,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/messages?id=eq.${id}`,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(patch)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  // bundles
  async getBundles(sellerId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/bundles?seller_id=eq.${sellerId}&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async getAllBundles(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/bundles?order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async createBundle(bundle,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/bundles`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(bundle)}); if(!r.ok)throw new Error(await r.text()); const d=await r.json(); return d[0]; },
  async deleteBundle(id,t){ await fetch(`${SUPABASE_URL}/rest/v1/bundles?id=eq.${id}`,{method:"DELETE",headers:hdrs(t)}); },
  async getBundleItems(bundleId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/bundle_items?bundle_id=eq.${bundleId}`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async addBundleItem(item,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/bundle_items`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(item)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async removeBundleItem(id,t){ await fetch(`${SUPABASE_URL}/rest/v1/bundle_items?id=eq.${id}`,{method:"DELETE",headers:hdrs(t)}); },
  // follows
  async getFollowing(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/follows?follower_id=eq.${uid}`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async getFollowers(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/follows?following_id=eq.${uid}`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async follow(followerId,followingId,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/follows`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify({follower_id:followerId,following_id:followingId})}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async unfollow(followerId,followingId,t){ await fetch(`${SUPABASE_URL}/rest/v1/follows?follower_id=eq.${followerId}&following_id=eq.${followingId}`,{method:"DELETE",headers:hdrs(t)}); },
  async getFeedListings(followingIds,t){ if(!followingIds.length)return []; const ids=followingIds.map(id=>`user_id.eq.${id}`).join(","); const r=await fetch(`${SUPABASE_URL}/rest/v1/listings?or=(${ids})&order=created_at.desc&limit=40`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  // notifications
  async getNotifications(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${uid}&order=created_at.desc&limit=30`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async insertNotification(n,t){ await fetch(`${SUPABASE_URL}/rest/v1/notifications`,{method:"POST",headers:hdrs(t),body:JSON.stringify(n)}); },
  async markNotifRead(id,t){ await fetch(`${SUPABASE_URL}/rest/v1/notifications?id=eq.${id}`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify({read:true})}); },
  async markAllNotifsRead(uid,t){ await fetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${uid}&read=eq.false`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify({read:true})}); },
  async updateConversation(id,patch,t){ await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${id}`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify(patch)}); },
  async markMessagesRead(convId,uid,t){ await fetch(`${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${convId}&sender_id=neq.${uid}&read=eq.false`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify({read:true})}); },
  async countUnread(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/messages?read=eq.false&select=id,conversation_id,conversations!inner(buyer_id,seller_id)`,{headers:{...hdrs(t),"Accept":"application/json"}}); if(!r.ok)return 0; const d=await r.json(); return d.filter(m=>m.sender_id!==uid).length; },
  // tailor marketplace
  async getTailorServices(t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_services?active=eq.true&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async getMyTailorServices(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_services?tailor_id=eq.${uid}&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async insertTailorService(s,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_services`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(s)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async updateTailorService(id,patch,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_services?id=eq.${id}`,{method:"PATCH",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(patch)}); if(!r.ok)throw new Error(await r.text()); return r.json(); },
  async deleteTailorService(id,t){ await fetch(`${SUPABASE_URL}/rest/v1/tailor_services?id=eq.${id}`,{method:"DELETE",headers:hdrs(t)}); },
  async createTailorBooking(b,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_bookings`,{method:"POST",headers:{...hdrs(t),Prefer:"return=representation"},body:JSON.stringify(b)}); if(!r.ok)throw new Error(await r.text()); const d=await r.json(); return d[0]; },
  async getMyTailorBookings(uid,t){ const r=await fetch(`${SUPABASE_URL}/rest/v1/tailor_bookings?or=(tailor_id.eq.${uid},buyer_id.eq.${uid})&order=created_at.desc`,{headers:hdrs(t)}); if(!r.ok)return []; return r.json(); },
  async updateTailorBooking(id,patch,t){ await fetch(`${SUPABASE_URL}/rest/v1/tailor_bookings?id=eq.${id}`,{method:"PATCH",headers:hdrs(t),body:JSON.stringify(patch)}); },
};

const CATEGORIES   = ["Saree","Salwar Kameez","Lehenga","Sherwani","Kurta","Co-ord Set","Dupatta","Accessories","Other"];
const JEWELLERY_CATS=["Necklace","Earrings","Maang Tikka","Jhumka","Bangles","Bracelet","Ring","Nose Ring","Anklet","Haar","Choker","Full Set","Other Jewellery"];
const SHOE_CATS = ["Heels","Flats","Sandals","Juttis","Khussa","Boots","Trainers","Wedges","Platforms","Other Shoes"];
const SHOE_SIZES = ["UK 2","UK 3","UK 4","UK 5","UK 6","UK 7","UK 8","UK 9","UK 10","EU 35","EU 36","EU 37","EU 38","EU 39","EU 40","EU 41","EU 42","US 5","US 6","US 7","US 8","US 9","US 10","US 11"];
const ALL_CATEGORIES=[...CATEGORIES,...JEWELLERY_CATS,...SHOE_CATS];
const LISTING_TYPES= ["Clothing","Jewellery","Shoes"];
const JEWELLERY_MATERIALS=["Gold Plated","Silver Plated","Kundan","Polki","Meenakari","Pearl","Oxidised","Jadau","Stone","Artificial","Other"];
const ORIGINS      = ["Indian","Pakistani","Bangladeshi","Sri Lankan","Nepali","Other"];
const FABRICS      = ["Silk","Cotton","Chiffon","Georgette","Velvet","Brocade","Lawn","Net","Organza","Linen","Other"];
const CONDITIONS = ["Brand New (with tags)","Brand New (without tags)","Like New","Excellent","Good","Fair","For Parts/Repair"];
const OCCASIONS  = ["Wedding","Eid","Diwali","Mehndi","Nikah","Sangeet","Navratri","Puja","Party","Casual","Graduation","Other"];
const SIZES      = ["XS","S","M","L","XL","XXL","Free Size","Custom Stitched"];
const OCC_COLOR  = {Wedding:"#FF1493",Eid:"#34C759",Diwali:"#FF9500",Mehndi:"#30D158",Nikah:"#007AFF",Sangeet:"#FF2D55",Navratri:"#FF6B00",Puja:"#FF1493",Party:"#BF5AF2",Casual:"#8E8E93",Graduation:"#0A84FF",Other:"#636366"};
const CARD_COLORS= ["#FF1493","#FF9500","#34C759","#007AFF","#BF5AF2","#FF2D55","#FF6B00","#0A84FF"];
const EMPTY_FORM = {name:"",price:"",condition:"Like New",listing_type:"Clothing",category:"Saree",origin:"Indian",fabric:"Silk",material:"",size:"Free Size",occasions:[],bust:"",waist:"",hips:"",length:"",underbust:"",shoulder:"",high_hip:"",sleeve_length:"",inseam:"",measurement_notes:"",can_take_in:false,spare_fabric:false,whatsapp:"",description:"",imageFiles:[],imagePreviews:[],postage_options:[],accepts_collection:false};

const POSTAGE_OPTIONS = [
  {id:"evri",name:"Evri",emoji:"📦",prices:[{label:"Small parcel (up to 2kg)",price:3.99},{label:"Medium parcel (up to 5kg)",price:5.49},{label:"Large parcel (up to 15kg)",price:7.49}]},
  {id:"royal_mail",name:"Royal Mail",emoji:"📮",prices:[{label:"Tracked 48 (up to 2kg)",price:3.35},{label:"Tracked 24 (up to 2kg)",price:4.35},{label:"Special Delivery",price:7.85}]},
  {id:"inpost",name:"InPost",emoji:"🟡",prices:[{label:"Locker to Locker (up to 25kg)",price:2.99},{label:"Locker to Door (up to 25kg)",price:3.99}]},
  {id:"hermes",name:"Hermes",emoji:"🚚",prices:[{label:"Small parcel (up to 2kg)",price:3.49},{label:"Medium parcel (up to 5kg)",price:5.49}]},
  {id:"dpd",name:"DPD",emoji:"📬",prices:[{label:"Next day delivery",price:4.99},{label:"Two day delivery",price:3.99}]},
];

const catEmoji = c=>({"Saree":"🥻","Salwar Kameez":"👘","Lehenga":"👗","Sherwani":"🧥","Kurta":"👕","Co-ord Set":"✨","Dupatta":"🧣","Accessories":"💍","Necklace":"📿","Earrings":"✨","Maang Tikka":"👑","Jhumka":"🔮","Bangles":"💛","Bracelet":"📿","Ring":"💍","Nose Ring":"✦","Anklet":"🦶","Haar":"📿","Choker":"📿","Full Set":"👑","Other Jewellery":"💎","Heels":"👠","Flats":"🥿","Sandals":"👡","Juttis":"✨","Khussa":"✨","Boots":"👢","Trainers":"👟","Wedges":"👠","Platforms":"👠","Other Shoes":"👠","Other":"🛍️"}[c]||"💎");
const waLink   = (n,name,price)=>`https://wa.me/${n.replace(/\D/g,"")}?text=${encodeURIComponent(`Hi! I saw "${name}" ($${price}) on Stitch'd — still available?`)}`;
const currencySymbol = c=>({USD:"$",GBP:"£",EUR:"€",CAD:"CA$",AUD:"A$",AED:"AED ",PKR:"₨",INR:"₹",BDT:"৳"}[c]||"$");

export default function App() {
  const [session,   setSession]   = useState(auth.getSession());
  const [items,     setItems]     = useState([]);
  const [view,      setView]      = useState("shop");
  const [prevView,  setPrevView]  = useState("shop");
  const [authMode,  setAuthMode]  = useState("login");
  const [sel,       setSel]       = useState(null);
  const [selImgIdx, setSelImgIdx] = useState(0);
  const [toast,     setToast]     = useState("");
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [aForm,     setAForm]     = useState({email:"",password:""});
  // OTP
  const [otpStep,   setOtpStep]   = useState("form"); // form | otp | done
  const [otpCode,   setOtpCode]   = useState("");
  const [otpEmail,  setOtpEmail]  = useState("");
  // 2FA
  const [twoFAStep,   setTwoFAStep]   = useState(null); // null | enroll | verify | manage
  const [twoFAData,   setTwoFAData]   = useState(null); // {id, totp: {qr_code, secret}}
  const [twoFACode,   setTwoFACode]   = useState("");
  const [twoFAFactors,setTwoFAFactors]= useState([]);
  const [twoFALoading,setTwoFALoading]= useState(false);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [aLoading,  setALoading]  = useState(false);
  const [error,     setError]     = useState("");
  const [aError,    setAError]    = useState("");
  const [profile,   setProfile]   = useState(null);
  const [profForm,  setProfForm]  = useState({username:"",full_name:"",location:"",region:"",currency:"USD",bio:"",specialises_in:[],avatar_url:"",avatarFile:null,avatarPreview:"",bust:"",waist:"",hips:"",height:"",preferred_size:"",is_tailor:false,tailor_services:[],tailor_price_from:"",accepting_clients:true});
  const [profSaving,setProfSaving]= useState(false);
  const [viewedProfile,setViewedProfile]=useState(null);
  const [profileListings,setProfileListings]=useState([]);
  const [search,    setSearch]    = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [sizeFilter,setSizeFilter]= useState("All");
  const [minPrice,  setMinPrice]  = useState("");
  const [maxPrice,  setMaxPrice]  = useState("");
  const [showFilters,setShowFilters]=useState(false);
  const [wishlist,   setWishlist]   = useState(()=>{ try{return JSON.parse(localStorage.getItem("stitchd_wishlist"))||[];}catch{return[];} });
  const [recentlyViewed,setRecentlyViewed]=useState(()=>{ try{return JSON.parse(localStorage.getItem("stitchd_recent"))||[];}catch{return[];} });
  const [showSizeGuide,setShowSizeGuide]=useState(false);
  const [reviews,      setReviews]      = useState([]);
  const [showReview,   setShowReview]   = useState(false);
  const [reviewForm,   setReviewForm]   = useState({rating:5,comment:""});
  const [showReport,   setShowReport]   = useState(false);
  const [reportReason, setReportReason] = useState("");
  // messaging
  const [conversations,  setConversations]  = useState([]);
  const [activeConv,     setActiveConv]     = useState(null);
  const [messages,       setMessages]       = useState([]);
  const [msgInput,       setMsgInput]       = useState("");
  const [msgSending,     setMsgSending]     = useState(false);
  const [unreadCount,    setUnreadCount]    = useState(0);
  const [convProfiles,   setConvProfiles]   = useState({});
  const [showCounterOffer,setShowCounterOffer]=useState(null); // message id
  const [counterInput,   setCounterInput]  = useState("");
  // bundles
  const [bundles,        setBundles]        = useState([]);
  const [bundleItems,    setBundleItems]    = useState({});
  const [bundleForm,     setBundleForm]     = useState({name:"",description:"",discount_percent:0,selectedListings:[]});
  // listing type filter
  const [typeFilter,     setTypeFilter]     = useState("All");
  const [showSizeMatch,  setShowSizeMatch]  = useState(false);
  const [showTailorDir,  setShowTailorDir]  = useState(false);
  const [tailorProfiles, setTailorProfiles] = useState([]);
  // tailor marketplace
  const [tailorServices,    setTailorServices]    = useState([]);
  const [myTailorServices,  setMyTailorServices]  = useState([]);
  const [tailorBookings,    setTailorBookings]    = useState([]);
  const [showTailorMarket,  setShowTailorMarket]  = useState(false);
  const [selectedService,   setSelectedService]   = useState(null);
  const [tailorServiceForm, setTailorServiceForm] = useState({title:"",description:"",service_type:"Alterations",price_from:"",price_to:"",turnaround_days:"",location:"",images:[],imagePreviews:[]});
  const [showTailorForm,    setShowTailorForm]    = useState(false);
  const [editingService,    setEditingService]    = useState(null);
  const [tailorSearch,      setTailorSearch]      = useState("");
  const [tailorTypeFilter,  setTailorTypeFilter]  = useState("All");
  const [bookingNotes,      setBookingNotes]      = useState("");
  const [showBookingForm,   setShowBookingForm]   = useState(false);
  // follows & feed
  const [following,      setFollowing]      = useState([]); // array of {follower_id, following_id}
  const [feedItems,      setFeedItems]      = useState([]);
  const [feedLoading,    setFeedLoading]    = useState(false);
  const [feedProfiles,   setFeedProfiles]   = useState({});
  // notifications
  const [notifications,  setNotifications]  = useState([]);
  const [showNotifs,     setShowNotifs]     = useState(false);
  // payments
  const [showPayment,    setShowPayment]    = useState(false);
  const [paymentListing, setPaymentListing] = useState(null);
  const [paymentStep,    setPaymentStep]    = useState("summary");
  const [selectedPostage,setSelectedPostage]= useState(null);

  const token = session?.access_token;
  const user  = session?.user;

  useEffect(()=>{
    const hash=window.location.hash;
    if(hash.includes("access_token")){
      const p=new URLSearchParams(hash.slice(1));
      const s={access_token:p.get("access_token"),user:{email:p.get("email")||"user",id:p.get("user_id")}};
      auth.saveSession(s); setSession(s); window.location.hash="";
      flash("🩷 Signed in!"); setView("shop");
    }
    // Handle Stripe payment return
    const urlParams=new URLSearchParams(window.location.search);
    if(urlParams.get("payment")==="success"){
      const listingId=urlParams.get("listing");
      flash("🎉 Payment successful! The seller has been notified.");
      if(listingId) db.update(listingId,{payment_status:"paid",sold:true},null).catch(()=>{});
      window.history.replaceState({},document.title,window.location.pathname);
      setPaymentStep("success");
    }
  },[]);

  useEffect(()=>{ fetchItems(); },[]);

  useEffect(()=>{
    if(user&&token){
      db.getProfile(user.id,token).then(p=>{ if(p){setProfile(p);setProfForm({username:p.username||"",full_name:p.full_name||"",location:p.location||"",region:p.region||"",currency:p.currency||"USD",bio:p.bio||"",specialises_in:p.specialises_in||[],avatar_url:p.avatar_url||"",avatarFile:null,avatarPreview:p.avatar_url||"",bust:p.bust||"",waist:p.waist||"",hips:p.hips||"",height:p.height||"",preferred_size:p.preferred_size||"",is_tailor:p.is_tailor||false,tailor_services:p.tailor_services||[],tailor_price_from:p.tailor_price_from||"",accepting_clients:p.accepting_clients!==false});} });
      loadConversations();
      db.getFollowing(user.id,token).then(setFollowing);
      db.getNotifications(user.id,token).then(setNotifications);
    }
  },[user,token]);

  async function fetchItems(){
    setLoading(true); setError("");
    try{
      const data = await db.getAll(token);
      setItems(data);
    }catch(e){
      // if JWT expired try without token (public listings)
      try{ setItems(await db.getAll(null)); }
      catch(e2){ setError(`Error: ${e2.message}`); }
    }finally{ setLoading(false); }
  }

  const visible = useMemo(()=>items.filter(i=>{
    const matchCat  = catFilter==="All"||i.category===catFilter;
    const matchSize = sizeFilter==="All"||i.size===sizeFilter;
    const matchMin  = minPrice===""||i.price>=parseFloat(minPrice);
    const matchMax  = maxPrice===""||i.price<=parseFloat(maxPrice);
    const matchType = typeFilter==="All"||(typeFilter==="Jewellery"?JEWELLERY_CATS.includes(i.category):typeFilter==="Shoes"?SHOE_CATS.includes(i.category):(typeFilter==="Clothing"?CATEGORIES.includes(i.category):true));
    const matchFit  = !showSizeMatch||fitsMe(i)===true;
    const q=search.toLowerCase();
    const matchSearch=!q||i.name?.toLowerCase().includes(q)||i.description?.toLowerCase().includes(q)||i.fabric?.toLowerCase().includes(q)||i.category?.toLowerCase().includes(q)||i.origin?.toLowerCase().includes(q)||i.material?.toLowerCase().includes(q);
    return matchCat&&matchSize&&matchMin&&matchMax&&matchSearch&&matchType&&matchFit;
  }),[items,catFilter,sizeFilter,minPrice,maxPrice,search,typeFilter]);

  function flash(m){ setToast(m); setTimeout(()=>setToast(""),3500); }

  // auto scroll chat to bottom when messages change
  useEffect(()=>{
    const el=document.getElementById("chat-messages");
    if(el) el.scrollTop=el.scrollHeight;
  },[messages]);

  // scroll to top on every view change
  useEffect(()=>{ window.scrollTo({top:0,behavior:"smooth"}); },[view]);

  // auto refresh token every 10 minutes
  useEffect(()=>{
    if(!session?.refresh_token) return;
    const interval=setInterval(async()=>{
      try{
        const fresh=await auth.refreshSession(session.refresh_token);
        auth.saveSession({...fresh, user:fresh.user||session.user});
        setSession(s=>({...s,...fresh}));
      }catch(e){
        // token refresh failed — sign out gracefully
        auth.clearSession(); setSession(null);
      }
    }, 10*60*1000); // every 10 mins
    return ()=>clearInterval(interval);
  },[session?.refresh_token]);

  // poll notifications every 30s
  useEffect(()=>{
    if(!user||!token) return;
    const interval=setInterval(()=>{
      db.getNotifications(user.id,token).then(setNotifications);
    },30000);
    return ()=>clearInterval(interval);
  },[user,token]);
  function togOcc(o){ setForm(f=>({...f,occasions:f.occasions.includes(o)?f.occasions.filter(x=>x!==o):[...f.occasions,o]})); }
  function clearFilters(){ setSearch(""); setCatFilter("All"); setSizeFilter("All"); setMinPrice(""); setMaxPrice(""); setTypeFilter("All"); }
  const hasFilters = search||catFilter!=="All"||sizeFilter!=="All"||minPrice||maxPrice||typeFilter!=="All";

  function toggleWishlist(id){
    setWishlist(prev=>{
      const next=prev.includes(id)?prev.filter(x=>x!==id):[...prev,id];
      localStorage.setItem("stitchd_wishlist",JSON.stringify(next));
      return next;
    });
  }

  function shareItem(item){
    const text=`Check out "${item.name}" for $${item.price} on Stitch'd 🩷`;
    if(navigator.share){ navigator.share({title:item.name,text,url:window.location.href}).catch(()=>{}); }
    else{ navigator.clipboard.writeText(`${text}\n${window.location.href}`).then(()=>flash("🔗 Link copied!")); }
  }

  async function submitReview(){
    if(!user||!sel)return;
    try{
      await db.insertReview({listing_id:sel.id,reviewer_id:user.id,seller_id:sel.user_id,rating:reviewForm.rating,comment:reviewForm.comment},token);
      const updated=await db.getReviews(sel.user_id,token);
      setReviews(updated); setShowReview(false); setReviewForm({rating:5,comment:""});
      flash("⭐ Review submitted!");
    }catch(e){ flash("Failed to submit review."); }
  }

  async function submitReport(){
    if(!user||!sel||!reportReason)return;
    try{
      await db.insertReport({listing_id:sel.id,reporter_id:user.id,reason:reportReason},token);
      setShowReport(false); setReportReason(""); flash("🚩 Reported. We'll review this listing.");
    }catch(e){ flash("Failed to submit report."); }
  }

  // ── BUNDLES ──
  async function loadBundles(){
    if(!user||!token) return;
    const myBundles=await db.getBundles(user.id,token);
    setBundles(myBundles);
    // load items for each bundle
    const itemMap={};
    await Promise.all(myBundles.map(async b=>{
      const bItems=await db.getBundleItems(b.id,token);
      itemMap[b.id]=bItems.map(bi=>items.find(i=>i.id===bi.listing_id)).filter(Boolean);
    }));
    setBundleItems(itemMap);
  }

  async function createBundle(){
    if(!bundleForm.name||bundleForm.selectedListings.length<2){ flash("Add a name and at least 2 items."); return; }
    try{
      const bundle=await db.createBundle({seller_id:user.id,name:bundleForm.name,description:bundleForm.description,discount_percent:parseInt(bundleForm.discount_percent)||0},token);
      await Promise.all(bundleForm.selectedListings.map(lid=>db.addBundleItem({bundle_id:bundle.id,listing_id:lid},token)));
      flash("🎁 Bundle created!"); setBundleForm({name:"",description:"",discount_percent:0,selectedListings:[]});
      await loadBundles();
    }catch(e){ flash("Failed to create bundle."); }
  }

  async function deleteBundle(id){
    try{ await db.deleteBundle(id,token); setBundles(p=>p.filter(b=>b.id!==id)); flash("Bundle deleted."); }
    catch(e){ flash("Failed to delete bundle."); }
  }

  function toggleBundleListing(id){
    setBundleForm(f=>({...f,selectedListings:f.selectedListings.includes(id)?f.selectedListings.filter(x=>x!==id):[...f.selectedListings,id]}));
  }

  // ── FOLLOWS & FEED ──
  const getSellerTier = (p) => {
    if(!p) return null;
    if(p.verified) return {label:"✓ VERIFIED",color:"#34C759"};
    if(p.seller_tier==="top") return {label:"⭐ TOP SELLER",color:"#FF9500"};
    if(p.seller_tier==="trusted") return {label:"👍 TRUSTED",color:"#007AFF"};
    return null;
  };

  const unreadNotifs = notifications.filter(n=>!n.read).length;

  async function loadTailors(){
    const r=await fetch(`${SUPABASE_URL}/rest/v1/profiles?is_tailor=eq.true`,{headers:hdrs(token)});
    if(r.ok) setTailorProfiles(await r.json());
  }

  async function loadTailorMarket(){
    const services=await db.getTailorServices(token);
    setTailorServices(services);
    // load tailor profiles for the service cards
    const tailorIds=[...new Set(services.map(s=>s.tailor_id).filter(Boolean))];
    const profs=[];
    await Promise.all(tailorIds.map(async id=>{ const p=await db.getProfile(id,token); if(p)profs.push(p); }));
    setTailorProfiles(profs);
    if(user) {
      const mine=await db.getMyTailorServices(user.id,token);
      setMyTailorServices(mine);
      const bookings=await db.getMyTailorBookings(user.id,token);
      setTailorBookings(bookings);
    }
  }

  async function saveTailorService(){
    if(!tailorServiceForm.title||!tailorServiceForm.price_from){flash("Add a title and starting price.");return;}
    try{
      const imageUrls=await Promise.all((tailorServiceForm.images||[]).map(f=>uploadImage(f,token)));
      const payload={tailor_id:user.id,title:tailorServiceForm.title,description:tailorServiceForm.description,service_type:tailorServiceForm.service_type,price_from:parseFloat(tailorServiceForm.price_from),price_to:tailorServiceForm.price_to?parseFloat(tailorServiceForm.price_to):null,turnaround_days:tailorServiceForm.turnaround_days?parseInt(tailorServiceForm.turnaround_days):null,location:tailorServiceForm.location,images:imageUrls,active:true};
      if(editingService){
        await db.updateTailorService(editingService.id,payload,token);
        flash("✓ Service updated!");
      } else {
        await db.insertTailorService(payload,token);
        flash("🩷 Service listed!");
      }
      setShowTailorForm(false);
      setEditingService(null);
      setTailorServiceForm({title:"",description:"",service_type:"Alterations",price_from:"",price_to:"",turnaround_days:"",location:"",images:[],imagePreviews:[]});
      await loadTailorMarket();
    }catch(e){flash("Failed to save service.");}
  }

  async function deleteTailorService(id){
    try{await db.deleteTailorService(id,token);setMyTailorServices(p=>p.filter(s=>s.id!==id));flash("Service deleted.");}
    catch(e){flash("Failed to delete.");}
  }

  async function bookTailor(service){
    if(!user){setAuthMode("login");setView("auth");return;}
    if(service.tailor_id===user.id){flash("You can't book yourself!");return;}
    try{
      const booking=await db.createTailorBooking({service_id:service.id,tailor_id:service.tailor_id,buyer_id:user.id,status:"pending",price:service.price_from,notes:bookingNotes,payment_status:"unpaid"},token);
      // start conversation with tailor
      let conv=await db.findConversation(user.id,service.tailor_id,null,token);
      if(!conv) conv=await db.createConversation({listing_id:null,buyer_id:user.id,seller_id:service.tailor_id,last_message:`Booking request: ${service.title}`,last_message_at:new Date().toISOString()},token);
      await db.sendMessage({conversation_id:conv.id,sender_id:user.id,content:`✂️ BOOKING REQUEST\n\nService: ${service.title}\nStarting from: ${currencySymbol(profile?.currency)}${service.price_from}\nTurnaround: ${service.turnaround_days?`${service.turnaround_days} days`:"TBC"}\n\nNotes: ${bookingNotes||"No notes added"}`,message_type:"text"},token);
      await notify(service.tailor_id,"booking",`✂️ New booking request!`,`${profile?.username||"Someone"} wants to book "${service.title}"`,conv.id);
      setShowBookingForm(false);
      setBookingNotes("");
      setSelectedService(null);
      flash("🎉 Booking request sent! Check your messages.");
      await loadConversations();
      setView("messages");
    }catch(e){flash("Failed to send booking.");}
  }

  // size match — does a listing fit the buyer's measurements?
  function fitsMe(item){
    if(!profile?.bust&&!profile?.waist&&!profile?.hips) return null; // no measurements saved
    if(!item.bust&&!item.waist&&!item.hips) return null; // listing has no measurements
    let fits=true;
    if(profile?.bust&&item.bust&&Math.abs(parseFloat(item.bust)-parseFloat(profile.bust))>2) fits=false;
    if(profile?.waist&&item.waist&&Math.abs(parseFloat(item.waist)-parseFloat(profile.waist))>2) fits=false;
    if(profile?.hips&&item.hips&&Math.abs(parseFloat(item.hips)-parseFloat(profile.hips))>2) fits=false;
    return fits;
  }

  async function notify(userId,type,title,body,linkId=null){
    if(!userId||userId===user?.id) return;
    try{ await db.insertNotification({user_id:userId,type,title,body,link_id:linkId,read:false},token); }
    catch(e){}
  }

  async function markNotifRead(id){
    await db.markNotifRead(id,token);
    setNotifications(p=>p.map(n=>n.id===id?{...n,read:true}:n));
  }

  async function setup2FA(){
    setTwoFALoading(true);
    try{
      const data=await auth.enroll2FA(token);
      setTwoFAData(data);
      setTwoFAStep("enroll");
    }catch(e){ flash("Failed to set up 2FA: "+e.message); }
    finally{ setTwoFALoading(false); }
  }

  async function confirm2FA(){
    if(!twoFACode||!twoFAData)return;
    setTwoFALoading(true);
    try{
      const challenge=await auth.challenge2FA(twoFAData.id,token);
      await auth.verify2FA(twoFAData.id,challenge.id,twoFACode,token);
      setTwoFAStep(null); setTwoFACode(""); setTwoFAData(null);
      const factors=await auth.listFactors(token);
      setTwoFAFactors(factors);
      flash("✅ 2FA enabled! Your account is now more secure.");
    }catch(e){ flash("Invalid code. Try again."); }
    finally{ setTwoFALoading(false); }
  }

  async function disable2FA(factorId){
    setTwoFALoading(true);
    try{
      await auth.unenroll2FA(factorId,token);
      setTwoFAFactors(p=>p.filter(f=>f.id!==factorId));
      flash("2FA disabled.");
    }catch(e){ flash("Failed to disable 2FA."); }
    finally{ setTwoFALoading(false); }
  }

  async function load2FAFactors(){
    const factors=await auth.listFactors(token);
    setTwoFAFactors(factors);
  }

  async function markAllRead(){
    await db.markAllNotifsRead(user.id,token);
    setNotifications(p=>p.map(n=>({...n,read:true})));
  }

  const isFollowing = (uid) => following.some(f=>f.following_id===uid);

  async function toggleFollow(targetId){
    if(!user){ setAuthMode("login"); setView("auth"); return; }
    if(targetId===user.id) return;
    try{
      if(isFollowing(targetId)){
        await db.unfollow(user.id,targetId,token);
        setFollowing(p=>p.filter(f=>f.following_id!==targetId));
        flash("Unfollowed.");
      } else {
        await db.follow(user.id,targetId,token);
        setFollowing(p=>[...p,{follower_id:user.id,following_id:targetId}]);
        flash("✦ Following!");
      }
    }catch(e){ flash("Could not update follow."); }
  }

  async function loadFeed(){
    setFeedLoading(true);
    try{
      const followingIds=following.map(f=>f.following_id);
      if(!followingIds.length){ setFeedItems([]); setFeedLoading(false); return; }
      const feed=await db.getFeedListings(followingIds,token);
      setFeedItems(feed);
      // load profiles for feed sellers
      const sellerIds=[...new Set(feed.map(i=>i.user_id).filter(Boolean))];
      const profs={};
      await Promise.all(sellerIds.map(async id=>{ const p=await db.getProfile(id,token); if(p)profs[id]=p; }));
      setFeedProfiles(profs);
    }catch(e){ flash("Failed to load feed."); }
    finally{ setFeedLoading(false); }
  }
  async function loadConversations(){
    if(!user||!token)return;
    const convs=await db.getConversations(user.id,token);
    setConversations(convs);
    // load profiles for other participants
    const otherIds=[...new Set(convs.map(c=>c.buyer_id===user.id?c.seller_id:c.buyer_id))];
    const profiles={};
    await Promise.all(otherIds.map(async id=>{ const p=await db.getProfile(id,token); if(p)profiles[id]=p; }));
    setConvProfiles(profiles);
    // count unread
    const unread=convs.reduce((a,c)=>a+(c.unread_count||0),0);
    setUnreadCount(unread);
  }

  async function openMessages(){
    await loadConversations();
    setActiveConv(null); setMessages([]);
    setView("messages");
  }

  async function openConversation(conv){
    setActiveConv(conv);
    const msgs=await db.getMessages(conv.id,token);
    setMessages(msgs);
    await db.markMessagesRead(conv.id,user.id,token);
    // update unread locally
    setConversations(p=>p.map(c=>c.id===conv.id?{...c,unread_count:0}:c));
  }

  async function startConversation(listing){
    if(!user){ setAuthMode("login"); setView("auth"); return; }
    if(listing.user_id===user.id){ flash("You can't message yourself!"); return; }
    try{
      // check if convo exists
      let conv=await db.findConversation(user.id,listing.user_id,listing.id,token);
      if(!conv){
        conv=await db.createConversation({listing_id:listing.id,buyer_id:user.id,seller_id:listing.user_id,last_message:"",last_message_at:new Date().toISOString()},token);
      }
      await loadConversations();
      setActiveConv(conv);
      const msgs=await db.getMessages(conv.id,token);
      setMessages(msgs);
      setView("messages");
    }catch(e){ flash("Could not start conversation."); }
  }

  async function sendMessage(){
    if(!msgInput.trim()||!activeConv||!user)return;
    setMsgSending(true);
    try{
      const [msg]=await db.sendMessage({conversation_id:activeConv.id,sender_id:user.id,content:msgInput.trim(),message_type:"text"},token);
      setMessages(p=>[...p,msg]);
      await db.updateConversation(activeConv.id,{last_message:msgInput.trim(),last_message_at:new Date().toISOString()},token);
      setConversations(p=>p.map(c=>c.id===activeConv.id?{...c,last_message:msgInput.trim(),last_message_at:new Date().toISOString()}:c));
      setMsgInput("");
      // notify the other person
      const otherId=activeConv.buyer_id===user.id?activeConv.seller_id:activeConv.buyer_id;
      const listing=items.find(i=>i.id===activeConv.listing_id);
      await notify(otherId,"message","💬 New message",`${profile?.username||user.email?.split("@")[0]||"Someone"} sent you a message${listing?` about "${listing.name}"`:""}`,activeConv.id);
    }catch(e){ flash("Failed to send."); }
    finally{ setMsgSending(false); }
  }

  async function sendOffer(percent){
    if(!activeConv||!user)return;
    const listing=items.find(i=>i.id===activeConv.listing_id);
    if(!listing)return;
    const offerAmount=parseFloat((listing.price*(1-percent/100)).toFixed(2));
    const content=`🏷️ OFFER: ${percent}% off — ${currencySymbol(listing.currency)}${offerAmount} (original: ${currencySymbol(listing.currency)}${listing.price})`;
    setMsgSending(true);
    try{
      const [msg]=await db.sendMessage({conversation_id:activeConv.id,sender_id:user.id,content,message_type:"offer",offer_percent:percent,offer_amount:offerAmount,offer_status:"pending"},token);
      setMessages(p=>[...p,msg]);
      await db.updateConversation(activeConv.id,{last_message:`Offer: ${currencySymbol(listing.currency)}${offerAmount}`,last_message_at:new Date().toISOString()},token);
      setConversations(p=>p.map(c=>c.id===activeConv.id?{...c,last_message:`Offer: ${currencySymbol(listing.currency)}${offerAmount}`,last_message_at:new Date().toISOString()}:c));
      // notify seller
      await notify(activeConv.seller_id,"offer",`🏷️ New offer on "${listing.name}"`,`${profile?.username||"Someone"} offered ${currencySymbol(listing.currency)}${offerAmount} (${percent}% off)`,activeConv.id);
    }catch(e){ flash("Failed to send offer."); }
    finally{ setMsgSending(false); }
  }

  async function respondToOffer(msgId, status, counterAmt=null){
    try{
      const patch={offer_status:status};
      if(counterAmt) patch.counter_amount=parseFloat(counterAmt);
      const [updated]=await db.updateMessage(msgId,patch,token);
      setMessages(p=>p.map(m=>m.id===msgId?{...m,...patch}:m));
      const listing=items.find(i=>i.id===activeConv?.listing_id);
      const responseText = status==="accepted"
        ? `✅ Offer accepted! ${listing?`Please arrange payment of ${currencySymbol(listing.currency)}${updated.offer_amount}`:""}` 
        : status==="declined" 
        ? `❌ Offer declined.`
        : `↩️ Counter offer: ${currencySymbol(listing?.currency||"$")}${counterAmt}`;
      const [responseMsg]=await db.sendMessage({conversation_id:activeConv.id,sender_id:user.id,content:responseText,message_type:"text"},token);
      setMessages(p=>[...p,responseMsg]);
      setShowCounterOffer(null); setCounterInput("");
      flash(status==="accepted"?"✅ Offer accepted!":status==="declined"?"❌ Offer declined.":"↩️ Counter offer sent!");
    }catch(e){ flash("Failed to respond to offer."); }
  }

  function addImageFiles(files){
    const arr=Array.from(files).slice(0,5-form.imagePreviews.length);
    const previews=arr.map(f=>URL.createObjectURL(f));
    setForm(f=>({...f,imageFiles:[...f.imageFiles,...arr],imagePreviews:[...f.imagePreviews,...previews]}));
  }
  function removeImagePreview(idx){
    setForm(f=>({...f,imageFiles:f.imageFiles.filter((_,i)=>i!==idx),imagePreviews:f.imagePreviews.filter((_,i)=>i!==idx)}));
  }

  async function handleAuth(e){
    e.preventDefault(); setALoading(true); setAError("");
    try{
      if(authMode==="signup"){
        // Send OTP email instead of traditional signup
        await auth.sendOTP(aForm.email);
        setOtpEmail(aForm.email);
        setOtpStep("otp");
        flash("📧 Check your email for your 6-digit code!");
      } else {
        const s=await auth.signIn(aForm.email,aForm.password);
        auth.saveSession(s); setSession(s); flash("🩷 Welcome back!"); setView("shop");
      }
    }catch(e){ setAError(e.message); }
    finally{ setALoading(false); }
  }

  async function handleOTPVerify(e){
    e.preventDefault(); setALoading(true); setAError("");
    try{
      const s=await auth.verifyOTP(otpEmail,otpCode);
      auth.saveSession(s); setSession(s);
      setOtpStep("form"); setOtpCode(""); setOtpEmail("");
      flash("🩷 Welcome to Stitch'd!"); setView("shop");
    }catch(e){ setAError("Invalid or expired code. Try again."); }
    finally{ setALoading(false); }
  }

  async function handleSignOut(){
    try{ if(token)await auth.signOut(token); }catch{}
    auth.clearSession();
    setSession(null);
    setProfile(null);
    setFollowing([]);
    setConversations([]);
    setMessages([]);
    setBundles([]);
    setUnreadCount(0);
    setView("shop");
    flash("Signed out.");
  }

  async function saveProfile(){
    if(!user)return; setProfSaving(true);
    try{
      let avatar_url=profForm.avatar_url||"";
      if(profForm.avatarFile) avatar_url=await uploadImage(profForm.avatarFile,token);
      const p={id:user.id,username:profForm.username,full_name:profForm.full_name,location:profForm.location,region:profForm.region,currency:profForm.currency,bio:profForm.bio||null,specialises_in:profForm.specialises_in,avatar_url,bust:profForm.bust||null,waist:profForm.waist||null,hips:profForm.hips||null,height:profForm.height||null,preferred_size:profForm.preferred_size||null,is_tailor:profForm.is_tailor,tailor_services:profForm.tailor_services,tailor_price_from:profForm.tailor_price_from||null,accepting_clients:profForm.accepting_clients};
      const [saved]=await db.upsertProfile(p,token);
      setProfile(saved); setProfForm(f=>({...f,avatar_url,avatarFile:null,avatarPreview:avatar_url}));
      flash("✓ Profile saved!");
    }catch(e){ flash("Failed to save profile."); }
    finally{ setProfSaving(false); }
  }

  async function openProfile(userId){
    setPrevView(view);
    const p=await db.getProfile(userId,token);
    const listings=await db.getListingsByUser(userId,token);
    const revs=await db.getReviews(userId,token);
    setViewedProfile(p||{id:userId,username:"Seller",bio:""});
    setProfileListings(listings);
    setReviews(revs);
    setView("profile");
  }

  async function add(){
    if(!form.name||!form.price)return;
    if(!user){setView("auth");return;}
    setSaving(true);
    try{
      const urls=await Promise.all(form.imageFiles.map(f=>uploadImage(f,token)));
      const image_url=urls[0]||"";
      const payload={name:form.name,price:parseFloat(form.price),condition:form.condition,listing_type:form.listing_type,category:form.category,origin:form.origin,fabric:form.listing_type==="Clothing"?form.fabric:"",material:form.listing_type==="Jewellery"?form.material:"",size:form.listing_type==="Clothing"?form.size:"",occasions:form.occasions,bust:form.listing_type==="Clothing"?form.bust:"",waist:form.listing_type==="Clothing"?form.waist:"",hips:form.listing_type==="Clothing"?form.hips:"",length:form.listing_type==="Clothing"?form.length:"",underbust:form.listing_type==="Clothing"?form.underbust:"",shoulder:form.listing_type==="Clothing"?form.shoulder:"",high_hip:form.listing_type==="Clothing"?form.high_hip:"",sleeve_length:form.listing_type==="Clothing"?form.sleeve_length:"",inseam:form.listing_type==="Clothing"?form.inseam:"",measurement_notes:form.listing_type==="Clothing"?form.measurement_notes:"",can_take_in:form.listing_type==="Clothing"?form.can_take_in:false,spare_fabric:form.listing_type==="Clothing"?form.spare_fabric:false,whatsapp:form.whatsapp,description:form.description,emoji:catEmoji(form.category),sold:false,reserved:false,views:0,image_url,images:urls,user_id:user.id,currency:profile?.currency||"USD",postage_options:form.postage_options||[],accepts_collection:form.accepts_collection||false};
      const [created]=await db.insert(payload,token);
      setItems(p=>[created,...p]); setForm(EMPTY_FORM); flash("🩷 Listed!"); setView("shop");
      // notify followers about new listing
      const myFollowers=await db.getFollowers(user.id,token);
      await Promise.all(myFollowers.map(f=>notify(f.follower_id,"new_listing",`✨ New drop from ${profile?.username||"a seller you follow"}`,`"${payload.name}" listed for ${currencySymbol(payload.currency||"USD")}${payload.price}`,created.id)));
    }catch(e){ flash("Failed to save. Try again."); }
    finally{ setSaving(false); }
  }

  async function saveEdit(){
    if(!form.name||!form.price)return; setSaving(true);
    try{
      const newUrls=await Promise.all(form.imageFiles.map(f=>uploadImage(f,token)));
      const existingUrls=(sel.images||[]).filter((_,i)=>form.imagePreviews[i]&&!form.imageFiles[i]);
      const allUrls=[...existingUrls,...newUrls];
      const image_url=allUrls[0]||sel.image_url||"";
      const patch={name:form.name,price:parseFloat(form.price),condition:form.condition,listing_type:form.listing_type,category:form.category,origin:form.origin,fabric:form.listing_type==="Clothing"?form.fabric:"",material:form.listing_type==="Jewellery"?form.material:"",size:form.listing_type==="Clothing"?form.size:"",occasions:form.occasions,bust:form.listing_type==="Clothing"?form.bust:"",waist:form.listing_type==="Clothing"?form.waist:"",hips:form.listing_type==="Clothing"?form.hips:"",length:form.listing_type==="Clothing"?form.length:"",underbust:form.listing_type==="Clothing"?form.underbust:"",shoulder:form.listing_type==="Clothing"?form.shoulder:"",high_hip:form.listing_type==="Clothing"?form.high_hip:"",sleeve_length:form.listing_type==="Clothing"?form.sleeve_length:"",inseam:form.listing_type==="Clothing"?form.inseam:"",measurement_notes:form.listing_type==="Clothing"?form.measurement_notes:"",can_take_in:form.listing_type==="Clothing"?form.can_take_in:false,spare_fabric:form.listing_type==="Clothing"?form.spare_fabric:false,whatsapp:form.whatsapp,description:form.description,emoji:catEmoji(form.category),image_url,images:allUrls,postage_options:form.postage_options||[],accepts_collection:form.accepts_collection||false};
      const [updated]=await db.update(sel.id,patch,token);
      setItems(p=>p.map(i=>i.id===sel.id?updated:i)); setSel(updated); flash("✓ Updated!"); setView("detail");
      // notify wishlisters if price dropped
      if(parseFloat(form.price)<sel.price){
        const wishlisters=await fetch(`${SUPABASE_URL}/rest/v1/notifications?type=eq.wishlist&link_id=eq.${sel.id}`,{headers:hdrs(token)}).then(r=>r.json()).catch(()=>[]);
        // notify via a simple price drop notif — we check wishlist localStorage can't do cross-user, so we insert for all users who wishlisted
        // For now just notify followers
        const myFollowers=await db.getFollowers(user.id,token);
        await Promise.all(myFollowers.map(f=>notify(f.follower_id,"price_drop",`📉 Price drop on "${sel.name}"`,`Now ${currencySymbol(updated.currency)}${form.price} (was ${currencySymbol(sel.currency)}${sel.price})`,sel.id)));
      }
    }catch(e){ flash("Failed to update."); }
    finally{ setSaving(false); }
  }

  function openEdit(item){
    setForm({name:item.name||"",price:item.price||"",condition:item.condition||"Like New",listing_type:item.listing_type||"Clothing",category:item.category||"Saree",origin:item.origin||"Indian",fabric:item.fabric||"Silk",material:item.material||"",size:item.size||"Free Size",occasions:item.occasions||[],bust:item.bust||"",waist:item.waist||"",hips:item.hips||"",length:item.length||"",underbust:item.underbust||"",shoulder:item.shoulder||"",high_hip:item.high_hip||"",sleeve_length:item.sleeve_length||"",inseam:item.inseam||"",measurement_notes:item.measurement_notes||"",can_take_in:item.can_take_in||false,spare_fabric:item.spare_fabric||false,whatsapp:item.whatsapp||"",description:item.description||"",imageFiles:[],imagePreviews:item.images||[item.image_url].filter(Boolean),postage_options:item.postage_options||[],accepts_collection:item.accepts_collection||false});
    setView("edit");
  }

  async function markSold(id,cur){ try{ await db.update(id,{sold:!cur},token); setItems(p=>p.map(i=>i.id===id?{...i,sold:!i.sold}:i)); if(sel?.id===id)setSel(s=>({...s,sold:!s.sold})); }catch(e){flash("Update failed.");} }
  async function markReserved(id,cur){ try{ await db.update(id,{reserved:!cur},token); setItems(p=>p.map(i=>i.id===id?{...i,reserved:!i.reserved}:i)); if(sel?.id===id)setSel(s=>({...s,reserved:!s.reserved})); flash(cur?"Reservation removed.":"🔖 Marked as reserved!"); }catch(e){flash("Update failed.");} }
  async function relist(id){ try{ await db.update(id,{sold:false,reserved:false},token); setItems(p=>p.map(i=>i.id===id?{...i,sold:false,reserved:false}:i)); if(sel?.id===id)setSel(s=>({...s,sold:false,reserved:false})); flash("🔄 Relisted!"); }catch(e){flash("Relist failed.");} }
  async function del(id){ try{ await db.remove(id,token); setItems(p=>p.filter(i=>i.id!==id)); setView("shop"); flash("Listing deleted."); }catch(e){flash("Delete failed.");} }

  function openDetail(item){
    setSel(item); setSelImgIdx(0); setView("detail");
    db.incrementViews(item.id,item.views,token);
    setItems(p=>p.map(i=>i.id===item.id?{...i,views:(i.views||0)+1}:i));
    setRecentlyViewed(prev=>{
      const next=[item.id,...prev.filter(x=>x!==item.id)].slice(0,8);
      localStorage.setItem("stitchd_recent",JSON.stringify(next));
      return next;
    });
    if(item.user_id) db.getReviews(item.user_id,token).then(setReviews);
  }

  const selIdx   = sel?items.findIndex(i=>i.id===sel.id):0;
  const selColor = CARD_COLORS[Math.max(0,selIdx)%CARD_COLORS.length];
  const isOwner  = (item)=>user&&item.user_id===user.id;
  const myItems  = items.filter(i=>i.user_id===user?.id);
  const selImages= sel?(sel.images&&sel.images.length>0?sel.images:[sel.image_url].filter(Boolean)):[];
  const similarItems = sel ? items.filter(i=>i.id!==sel.id&&(i.category===sel.category||i.fabric===sel.fabric||i.origin===sel.origin)).slice(0,4) : [];
  const recentItems  = items.filter(i=>recentlyViewed.includes(i.id)&&(!sel||i.id!==sel.id)).slice(0,4);
  const wishlistItems= items.filter(i=>wishlist.includes(i.id));

  return (
    <div style={S.root}>
      <style>{CSS}</style>

      {/* HEADER */}
      <header style={S.header}>
        <div style={S.hWrap}>
          <div style={S.logoWrap} onClick={()=>setView("shop")}><span style={S.logoText}>STITCH'D</span><span style={S.logoTM}>™</span></div>
          <div style={S.hMid}><div style={S.marqueeTrack}><span style={S.marqueeInner}>{Array(4).fill("SOUTH ASIAN PRE-LOVED FASHION \u00a0✦\u00a0 SAREES \u00a0✦\u00a0 LEHENGAS \u00a0✦\u00a0 SHERWANIS \u00a0✦\u00a0 REAL MEASUREMENTS \u00a0✦\u00a0 ").join("")}</span></div></div>
          <div style={S.hRight}>
            <span style={S.hLive}>{items.filter(i=>!i.sold).length} LIVE</span>
            <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111",position:"relative"}} onClick={()=>setView("wishlist")}>
              ❤️ {wishlist.length>0&&<span style={S.wishBadge}>{wishlist.length}</span>}
            </button>
            {user?(
              <>
                <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111"}} onClick={()=>{loadBundles();setView("dashboard");}}>MY DROPS</button>
                <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111"}} onClick={()=>{loadFeed();setView("feed");}}>✦ FEED</button>
                {/* Notification bell */}
                <button className="hbtn" style={{...S.hBtn,background:showNotifs?"#FF1493":"#fff",color:showNotifs?"#fff":"#111",border:"2px solid #111",position:"relative"}} onClick={()=>setShowNotifs(p=>!p)}>
                  🔔 {unreadNotifs>0&&<span style={S.wishBadge}>{unreadNotifs}</span>}
                </button>
                <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111",position:"relative"}} onClick={openMessages}>
                  💬 {unreadCount>0&&<span style={S.wishBadge}>{unreadCount}</span>}
                </button>
                <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111"}} onClick={()=>{ load2FAFactors(); setView("editprofile"); }}>PROFILE</button>
                <button className="hbtn" style={S.hBtn} onClick={()=>setView("add")}>LIST IT →</button>
                <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111"}} onClick={handleSignOut}>OUT</button>
              </>
            ):(
              <>
                <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111"}} onClick={()=>{setAuthMode("login");setView("auth");}}>LOG IN</button>
                <button className="hbtn" style={S.hBtn} onClick={()=>{setAuthMode("signup");setView("auth");}}>SIGN UP</button>
              </>
            )}
          </div>
        </div>
      </header>

      <div style={S.ticker}><div style={S.tickerInner}>{Array(4).fill("STITCH'D \u00a0·\u00a0 PRE-LOVED SOUTH ASIAN FASHION \u00a0·\u00a0 BUY. SELL. STYLE. \u00a0·\u00a0 MEASURED FITS ONLY \u00a0·\u00a0 ").join("")}</div></div>

      {/* NOTIFICATION PANEL */}
      {showNotifs&&(
        <div style={S.notifPanel}>
          <div style={S.notifHeader}>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900,letterSpacing:1}}>NOTIFICATIONS</span>
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
              {unreadNotifs>0&&<button style={{background:"none",border:"none",fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:700,letterSpacing:1,color:"#FF1493",cursor:"pointer"}} onClick={markAllRead}>MARK ALL READ</button>}
              <button style={{background:"none",border:"none",fontSize:16,cursor:"pointer",fontWeight:900,color:"#999"}} onClick={()=>setShowNotifs(false)}>✕</button>
            </div>
          </div>
          {notifications.length===0?(
            <div style={{padding:"32px",textAlign:"center"}}>
              <p style={{fontSize:28,marginBottom:8}}>🔔</p>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,color:"#bbb"}}>NO NOTIFICATIONS YET</p>
            </div>
          ):(
            <div style={{maxHeight:400,overflowY:"auto"}}>
              {notifications.map(n=>(
                <div key={n.id} style={{...S.notifItem,background:n.read?"#fff":"#fff8fc",borderLeft:`4px solid ${n.read?"#f0f0f0":"#FF1493"}`}}
                  onClick={()=>{ markNotifRead(n.id); if(n.link_id){ if(n.type==="message"||n.type==="offer"){ openMessages(); } else { const item=items.find(i=>i.id===n.link_id); if(item)openDetail(item); } } setShowNotifs(false); }}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                    <div>
                      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:n.read?600:900,color:"#111",marginBottom:2}}>{n.title}</p>
                      {n.body&&<p style={{fontSize:12,color:"#888",lineHeight:1.4}}>{n.body}</p>}
                    </div>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#bbb",letterSpacing:0.5,whiteSpace:"nowrap",flexShrink:0}}>{new Date(n.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short"}).toUpperCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {toast&&<div style={S.toast}>{toast}</div>}

      {/* ── PAYMENT MODAL ── */}
      {showPayment&&paymentListing&&(()=>{
        const {amount,fee,sellerGets}=buildPaymentSummary(paymentListing);
        const sym=currencySymbol(paymentListing.currency);
        const postageAmount=selectedPostage?selectedPostage.selectedPrice?.price||0:0;
        const totalAmount=parseFloat((amount+postageAmount).toFixed(2));
        return(
          <div style={S.modalOverlay} onClick={()=>setShowPayment(false)}>
            <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,paddingBottom:16,borderBottom:"3px solid #111"}}>
                <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900,letterSpacing:-0.5}}>
                  {paymentStep==="success"?"🎉 PAYMENT DONE!":"💳 BUY THIS PIECE"}
                </h3>
                <button style={{background:"none",border:"none",fontSize:20,cursor:"pointer",fontWeight:900}} onClick={()=>setShowPayment(false)}>✕</button>
              </div>

              {paymentStep==="success"?(
                <div style={{textAlign:"center",padding:"32px 0"}}>
                  <p style={{fontSize:60,marginBottom:16}}>🎉</p>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:900,marginBottom:8}}>PAYMENT SUCCESSFUL!</p>
                  <p style={{fontSize:14,color:"#888",marginBottom:24}}>The seller has been notified and will be in touch about shipping.</p>
                  <button className="hbtn" style={{...S.hBtn,padding:"12px 28px",fontSize:14}} onClick={()=>{setShowPayment(false);setPaymentStep("summary");}}>DONE →</button>
                </div>
              ):(
                <>
                  {/* Item summary */}
                  <div style={{display:"flex",gap:16,marginBottom:24,padding:"16px",background:"#fafafa",border:"2px solid #f0f0f0"}}>
                    {paymentListing.image_url&&<img src={paymentListing.image_url} alt="" style={{width:80,height:80,objectFit:"cover",border:"2px solid #111",flexShrink:0}}/>}
                    <div>
                      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:800,marginBottom:4}}>{paymentListing.name}</p>
                      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,color:"#888",letterSpacing:1,marginBottom:4}}>{paymentListing.category?.toUpperCase()} · {paymentListing.condition?.toUpperCase()}</p>
                      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,color:"#FF1493"}}>{sym}{amount}</p>
                    </div>
                  </div>

                  {/* Postage options — buyer chooses */}
                  <div style={{marginBottom:24}}>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:2,color:"#999",marginBottom:12}}>📦 CHOOSE YOUR DELIVERY</p>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {POSTAGE_OPTIONS.map(carrier=>(
                        <div key={carrier.id}>
                          {carrier.prices.map(price=>{
                            const optId=`${carrier.id}_${price.label}`;
                            const isSelected=selectedPostage?.optId===optId;
                            return(
                              <div key={optId} style={{border:`2px solid ${isSelected?"#FF1493":"#e0e0e0"}`,padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,marginBottom:4,background:isSelected?"#fff8fc":"#fff"}} onClick={()=>setSelectedPostage({...carrier,selectedPrice:price,optId})}>
                                <span style={{fontSize:20}}>{carrier.emoji}</span>
                                <div style={{flex:1}}>
                                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:800,color:"#111"}}>{carrier.name}</p>
                                  <p style={{fontSize:12,color:"#888"}}>{price.label}</p>
                                </div>
                                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900,color:"#FF1493"}}>+£{price.price}</span>
                                <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${isSelected?"#FF1493":"#ccc"}`,background:isSelected?"#FF1493":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                  {isSelected&&<span style={{color:"#fff",fontSize:10,fontWeight:900}}>✓</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                      {paymentListing.accepts_collection&&(
                        <div style={{border:`2px solid ${selectedPostage?.id==="collection"?"#34C759":"#e0e0e0"}`,padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,background:selectedPostage?.id==="collection"?"#f0fff4":"#fff"}} onClick={()=>setSelectedPostage({id:"collection",name:"Collection in Person",emoji:"🤝",selectedPrice:{price:0,label:"Arrange with seller"},optId:"collection"})}>
                          <span style={{fontSize:20}}>🤝</span>
                          <div style={{flex:1}}>
                            <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:800}}>Collection in Person</p>
                            <p style={{fontSize:12,color:"#888"}}>Arrange with seller directly</p>
                          </div>
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900,color:"#34C759"}}>FREE</span>
                          <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${selectedPostage?.id==="collection"?"#34C759":"#ccc"}`,background:selectedPostage?.id==="collection"?"#34C759":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            {selectedPostage?.id==="collection"&&<span style={{color:"#fff",fontSize:10,fontWeight:900}}>✓</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fee breakdown */}
                  <div style={{marginBottom:24,padding:"14px 16px",background:"#fff8f0",border:"1.5px solid #FF950055"}}>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:2,color:"#FF9500",marginBottom:10}}>PRICE BREAKDOWN</p>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontSize:13,color:"#555"}}>Item price</span>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700}}>{sym}{amount}</span>
                    </div>
                    {selectedPostage&&postageAmount>0&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontSize:13,color:"#555"}}>{selectedPostage.emoji} {selectedPostage.name}</span>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700}}>{sym}{postageAmount}</span>
                    </div>}
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontSize:13,color:"#555"}}>Stitch'd fee (5%)</span>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,color:"#FF9500"}}>{sym}{fee}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",paddingTop:8,borderTop:"1px solid #f0d0b0",marginBottom:6}}>
                      <span style={{fontSize:13,color:"#555"}}>Seller receives</span>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,color:"#34C759"}}>{sym}{sellerGets}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",paddingTop:8,borderTop:"2px solid #111"}}>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:900,color:"#111"}}>TOTAL</span>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:900,color:"#111"}}>{sym}{totalAmount}</span>
                    </div>
                  </div>

                  {/* Payment methods */}
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:2,color:"#999",marginBottom:12}}>PAY WITH</p>
                  <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
                    {/* Apple/Google Pay */}
                    <button className="hbtn" style={{...S.hBtn,background:"#111",border:"none",width:"100%",padding:"14px",fontSize:14,letterSpacing:1,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}
                      onClick={()=>{
                        const msg=`Hi! I'd like to pay for "${paymentListing.name}" (${sym}${amount}) on Stitch'd. Can you send me a payment link?`;
                        window.open(`https://wa.me/${paymentListing.whatsapp?.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`,"_blank");
                      }}>
                      <span style={{fontSize:18}}>🍎</span> APPLE PAY / GOOGLE PAY
                    </button>
                    {/* Card */}
                    <button className="hbtn" style={{...S.hBtn,background:"#FF1493",border:"none",width:"100%",padding:"14px",fontSize:14,letterSpacing:1}}
                      onClick={()=>setPaymentStep("card")}>
                      💳 PAY BY CARD
                    </button>
                  </div>

                  <p style={{fontSize:11,color:"#bbb",textAlign:"center",lineHeight:1.6}}>
                    🔒 Payments are processed securely via Stripe.<br/>
                    Seller will be notified immediately after payment.
                  </p>
                </>
              )}

              {paymentStep==="card"&&(
                <div style={{marginTop:16}}>
                  <button style={{...S.back,marginBottom:16}} onClick={()=>setPaymentStep("summary")}>← back</button>
                  <div style={{padding:24,border:"2px solid #f0f0f0",marginBottom:16}}>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:2,color:"#999",marginBottom:16}}>CARD DETAILS</p>
                    <div id="stripe-card-element" style={{padding:"14px",border:"2px solid #e0e0e0",marginBottom:16,minHeight:44}}/>
                    <p style={{fontSize:12,color:"#bbb",marginBottom:16}}>
                      💡 In test mode, use card number <strong>4242 4242 4242 4242</strong>, any future date, any CVC.
                    </p>
                    <button className="hbtn" style={{...S.hBtn,background:"#FF1493",border:"none",width:"100%",padding:"14px",fontSize:14,letterSpacing:2}}
                      onClick={async()=>{
                        if(!window.Stripe){
                          const s=document.createElement("script"); s.src="https://js.stripe.com/v3/";
                          await new Promise(r=>{s.onload=r;document.head.appendChild(s);});
                        }
                        flash("💳 Setting up payment...");
                        try{
                          // Call Edge Function to create payment intent
                          const res=await fetch(`${SUPABASE_URL}/functions/v1/clever-action`,{
                            method:"POST",
                            headers:{"Content-Type":"application/json", "apikey":SUPABASE_KEY, "Authorization":`Bearer ${SUPABASE_KEY}`},
                            body:JSON.stringify({amount:paymentListing.price, currency:paymentListing.currency||"USD", listing_id:paymentListing.id, buyer_email:user?.email||""})
                          });
                          const {client_secret,error}=await res.json();
                          if(error) throw new Error(error);
                          const stripe=window.Stripe(STRIPE_PK);
                          const {error:stripeErr}=await stripe.confirmCardPayment(client_secret,{
                            payment_method:{card:{token:"tok_visa"}} // test token
                          });
                          if(stripeErr) throw new Error(stripeErr.message);
                          flash("🎉 Payment successful!");
                          setPaymentStep("success");
                          setItems(p=>p.map(i=>i.id===paymentListing.id?{...i,payment_status:"paid",sold:true}:i));
                          db.update(paymentListing.id,{payment_status:"paid",sold:true},token).catch(()=>{});
                        }catch(e){
                          flash(`Payment failed: ${e.message}`);
                        }
                      }}>
                      PAY {currencySymbol(paymentListing.currency)}{paymentListing.price} →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── REVIEW MODAL ── */}
      {showReview&&(
        <div style={S.modalOverlay} onClick={()=>setShowReview(false)}>
          <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,paddingBottom:16,borderBottom:"3px solid #111"}}>
              <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900}}>LEAVE A REVIEW</h3>
              <button style={{background:"none",border:"none",fontSize:20,cursor:"pointer",fontWeight:900}} onClick={()=>setShowReview(false)}>✕</button>
            </div>
            <div style={{marginBottom:20}}>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:2,color:"#999",marginBottom:10}}>RATING</p>
              <div style={{display:"flex",gap:8}}>
                {[1,2,3,4,5].map(n=>(
                  <button key={n} type="button"
                    style={{fontSize:28,background:"none",border:"none",cursor:"pointer",opacity:n<=reviewForm.rating?1:0.25,transition:"opacity .1s"}}
                    onClick={()=>setReviewForm(f=>({...f,rating:n}))}>⭐</button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:20}}>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:2,color:"#999",marginBottom:10}}>COMMENT (OPTIONAL)</p>
              <textarea style={{...S.inp,height:90,resize:"vertical",width:"100%"}} placeholder="Tell others about this seller — communication, packaging, accuracy..." value={reviewForm.comment} onChange={e=>setReviewForm(f=>({...f,comment:e.target.value}))}/>
            </div>
            <button className="hbtn" style={{...S.hBtn,width:"100%",padding:"14px",fontSize:14,borderRadius:0,letterSpacing:3}} onClick={submitReview}>
              SUBMIT REVIEW →
            </button>
          </div>
        </div>
      )}

      {/* ── REPORT MODAL ── */}
      {showReport&&(
        <div style={S.modalOverlay} onClick={()=>setShowReport(false)}>
          <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,paddingBottom:16,borderBottom:"3px solid #111"}}>
              <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900}}>🚩 REPORT LISTING</h3>
              <button style={{background:"none",border:"none",fontSize:20,cursor:"pointer",fontWeight:900}} onClick={()=>setShowReport(false)}>✕</button>
            </div>
            <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:2,color:"#999",marginBottom:14}}>WHY ARE YOU REPORTING THIS?</p>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
              {["Fake or misleading photos","Wrong measurements","Item already sold","Suspicious seller","Inappropriate content","Other"].map(r=>(
                <button key={r} type="button" className="hbtn"
                  style={{...S.hBtn,background:reportReason===r?"#FF1493":"#fff",color:reportReason===r?"#fff":"#111",border:`2px solid ${reportReason===r?"#FF1493":"#e0e0e0"}`,padding:"10px 16px",fontSize:12,letterSpacing:1,textAlign:"left",justifyContent:"flex-start"}}
                  onClick={()=>setReportReason(r)}>
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
            <button className="hbtn"
              style={{...S.hBtn,width:"100%",padding:"14px",fontSize:14,borderRadius:0,letterSpacing:3,opacity:reportReason?1:0.4,cursor:reportReason?"pointer":"not-allowed"}}
              onClick={submitReport} disabled={!reportReason}>
              SUBMIT REPORT →
            </button>
          </div>
        </div>
      )}

      {/* ── TAILOR DIRECTORY MODAL ── */}
      {showTailorDir&&(
        <div style={S.modalOverlay} onClick={()=>setShowTailorDir(false)}>
          <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,paddingBottom:16,borderBottom:"3px solid #111"}}>
              <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900}}>✂️ TAILOR DIRECTORY</h3>
              <button style={{background:"none",border:"none",fontSize:20,cursor:"pointer",fontWeight:900}} onClick={()=>setShowTailorDir(false)}>✕</button>
            </div>
            <p style={{fontSize:13,color:"#888",marginBottom:20,lineHeight:1.6}}>Find trusted tailors and alteration specialists in the Stitch'd community who can help alter your piece to fit perfectly.</p>
            {tailorProfiles.length===0?(
              <div style={{textAlign:"center",padding:"32px 0"}}>
                <p style={{fontSize:32,marginBottom:8}}>✂️</p>
                <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:800,color:"#bbb",letterSpacing:1}}>NO TAILORS LISTED YET</p>
                <p style={{fontSize:12,color:"#bbb",marginTop:8}}>Sellers can list themselves as tailors in their profile settings.</p>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {tailorProfiles.map(t=>(
                  <div key={t.id} style={{border:"2px solid #f0f0f0",padding:"16px",display:"flex",gap:16,alignItems:"flex-start",cursor:"pointer"}} onClick={()=>{setShowTailorDir(false);openProfile(t.id);}}>
                    <div style={{...S.profileAvatarWrap,width:50,height:50,flexShrink:0}}>
                      {t.avatar_url?<img src={t.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/>:<div style={{...S.profileAvatar,fontSize:22}}>{(t.full_name||t.username||"T")[0].toUpperCase()}</div>}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900}}>{t.full_name||t.username||"Tailor"}</p>
                        {t.verified&&<span style={S.verifiedBadge}>✓ VERIFIED</span>}
                      </div>
                      {t.location&&<p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:"#888",letterSpacing:1,marginBottom:6}}>📍 {t.location}</p>}
                      {(t.tailor_services||[]).length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:6}}>{t.tailor_services.map(s=><span key={s} style={{background:"#f5f5f5",padding:"2px 8px",fontSize:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:1}}>{s.toUpperCase()}</span>)}</div>}
                      {t.tailor_price_from&&<p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,color:"#FF1493"}}>From {currencySymbol(t.currency)}{t.tailor_price_from}</p>}
                    </div>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:"#FF1493",fontWeight:700}}>VIEW →</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SIZE GUIDE MODAL ── */}
      {showSizeGuide&&(
        <div style={S.modalOverlay} onClick={()=>setShowSizeGuide(false)}>
          <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,paddingBottom:16,borderBottom:"3px solid #111"}}>
              <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900,letterSpacing:-0.5}}>📏 SIZE GUIDE</h3>
              <button style={{background:"none",border:"none",fontSize:20,cursor:"pointer",fontWeight:900}} onClick={()=>setShowSizeGuide(false)}>✕</button>
            </div>
            <p style={{fontSize:13,color:"#888",marginBottom:20,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>SOUTH ASIAN CLOTHING — MEASUREMENTS IN INCHES</p>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"'Barlow Condensed',sans-serif",fontSize:14}}>
                <thead>
                  <tr style={{background:"#111",color:"#fff"}}>
                    {["SIZE","BUST","WAIST","HIPS","FITS"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:800,letterSpacing:1.5,fontSize:11}}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[["XS","30-31","24-25","33-34","UK 6-8"],["S","32-33","26-27","35-36","UK 8-10"],["M","34-35","28-29","37-38","UK 10-12"],["L","36-37","30-31","39-40","UK 12-14"],["XL","38-39","32-33","41-42","UK 14-16"],["XXL","40-42","34-36","43-45","UK 16-18"],["Free Size","34-42","28-36","36-44","Adjustable"]].map(([sz,...vals],i)=>(
                    <tr key={sz} style={{background:i%2===0?"#fafafa":"#fff",borderBottom:"1px solid #f0f0f0"}}>
                      <td style={{padding:"10px 14px",fontWeight:800,color:"#FF1493"}}>{sz}</td>
                      {vals.map((v,j)=><td key={j} style={{padding:"10px 14px",color:"#555"}}>{v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{marginTop:20,padding:16,background:"#fff0f8",border:"1.5px solid #FF149333"}}>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:2,color:"#FF1493",marginBottom:6}}>💡 TIP</p>
              <p style={{fontSize:13,color:"#666",lineHeight:1.6}}>South Asian garments are often custom-stitched. Always check the exact measurements listed by the seller — especially bust, waist, and hips. If a listing has spare fabric, it can usually be let out by 1-2 inches.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── WISHLIST VIEW ── */}
      {view==="wishlist"&&(
        <main style={S.main}>
          <button style={S.back} onClick={()=>setView("shop")}>← BACK</button>
          <div style={{marginBottom:36,paddingBottom:24,borderBottom:"3px solid #111",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:4,color:"#FF1493",marginBottom:6}}>SAVED PIECES</p>
              <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:48,fontWeight:900,letterSpacing:-1}}>MY WISHLIST ❤️</h2>
            </div>
            {wishlistItems.length>0&&<button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#FF1493",border:"2px solid #FF1493"}} onClick={()=>{setWishlist([]);localStorage.removeItem("stitchd_wishlist");}}>CLEAR ALL</button>}
          </div>
          {wishlistItems.length===0?(
            <div style={{textAlign:"center",padding:"60px 20px"}}>
              <p style={{fontSize:48,marginBottom:12}}>🤍</p>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:900,marginBottom:8}}>NOTHING SAVED YET.</p>
              <p style={{color:"#888",marginBottom:20}}>Tap the ❤️ on any listing to save it.</p>
              <button className="hbtn" style={S.hBtn} onClick={()=>setView("shop")}>BROWSE DROPS →</button>
            </div>
          ):(
            <div style={S.grid}>
              {wishlistItems.map((item,idx)=>{
                const accent=CARD_COLORS[idx%CARD_COLORS.length];
                return(
                  <article key={item.id} className="scard" style={{...S.card,borderColor:accent,opacity:item.sold?0.55:1}}>
                    <div style={{...S.cardTop,background:item.image_url?"#000":accent,overflow:"hidden"}} onClick={()=>openDetail(item)}>
                      {item.image_url?<img src={item.image_url} alt={item.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={S.cardEmoji}>{item.emoji||catEmoji(item.category)}</span>}
                      {item.sold&&<div style={S.soldVeil}><span style={S.soldStamp}>SOLD</span></div>}
                      <button style={S.heartBtn} onClick={e=>{e.stopPropagation();toggleWishlist(item.id);}}>❤️</button>
                    </div>
                    <div style={S.cardBody} onClick={()=>openDetail(item)}>
                      <p style={{...S.cardCatLabel,color:accent}}>{item.category?.toUpperCase()}</p>
                      <p style={S.cardName}>{item.name}</p>
                      <div style={S.cardFoot}><span style={{...S.cardPrice,color:accent}}>${item.price}</span></div>
                    </div>
                    <div style={{...S.accentBar,background:accent}}/>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* ── MESSAGES ── */}
      {view==="messages"&&user&&(
        <main style={{...S.main,maxWidth:1000}}>
          <button style={S.back} onClick={()=>setView("shop")}>← BACK</button>
          <div style={S.msgLayout}>
            {/* Conversation list */}
            <div style={S.msgSidebar}>
              <div style={S.msgSidebarHead}>
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:900,letterSpacing:1}}>MESSAGES</span>
                {unreadCount>0&&<span style={{...S.wishBadge,position:"static",width:"auto",borderRadius:4,padding:"2px 8px"}}>{unreadCount} NEW</span>}
              </div>
              {conversations.length===0?(
                <div style={{padding:32,textAlign:"center"}}>
                  <p style={{fontSize:32,marginBottom:8}}>💬</p>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,color:"#bbb",letterSpacing:1}}>NO MESSAGES YET</p>
                  <p style={{fontSize:12,color:"#bbb",marginTop:6}}>Message a seller from any listing</p>
                </div>
              ):(
                conversations.map(conv=>{
                  const otherId=conv.buyer_id===user.id?conv.seller_id:conv.buyer_id;
                  const otherProfile=convProfiles[otherId];
                  const isActive=activeConv?.id===conv.id;
                  const listing=items.find(i=>i.id===conv.listing_id);
                  return(
                    <div key={conv.id} style={{...S.convItem,background:isActive?"#fff0f8":"#fff",borderLeft:isActive?`4px solid #FF1493`:"4px solid transparent"}} onClick={()=>openConversation(conv)}>
                      <div style={S.convAvatar}>
                        {otherProfile?.avatar_url?<img src={otherProfile.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/>:<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:900,color:"#fff"}}>{(otherProfile?.full_name||otherProfile?.username||"?")[0].toUpperCase()}</span>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:800,letterSpacing:0.5,color:"#111"}}>{otherProfile?.full_name||otherProfile?.username||"Seller"}</span>
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#bbb",letterSpacing:0.5}}>{conv.last_message_at?new Date(conv.last_message_at).toLocaleDateString("en-GB",{day:"numeric",month:"short"}).toUpperCase():""}</span>
                        </div>
                        {listing&&<p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#FF1493",fontWeight:700,letterSpacing:1,marginBottom:2}}>{listing.name?.toUpperCase()}</p>}
                        <p style={{fontSize:12,color:"#888",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{conv.last_message||"Start a conversation"}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Chat window */}
            <div style={S.msgMain}>
              {!activeConv?(
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:12}}>
                  <p style={{fontSize:48}}>✉️</p>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,letterSpacing:1,color:"#bbb"}}>SELECT A CONVERSATION</p>
                  <p style={{fontSize:13,color:"#bbb"}}>Or message a seller from any listing</p>
                </div>
              ):(()=>{
                const otherId=activeConv.buyer_id===user.id?activeConv.seller_id:activeConv.buyer_id;
                const otherProfile=convProfiles[otherId];
                const listing=items.find(i=>i.id===activeConv.listing_id);
                return(
                  <>
                    {/* Chat header */}
                    <div style={S.chatHeader}>
                      <div style={{...S.convAvatar,flexShrink:0}}>
                        {otherProfile?.avatar_url?<img src={otherProfile.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/>:<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:900,color:"#fff"}}>{(otherProfile?.full_name||otherProfile?.username||"?")[0].toUpperCase()}</span>}
                      </div>
                      <div>
                        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900,letterSpacing:0.5}}>{otherProfile?.full_name||otherProfile?.username||"Seller"}</p>
                        {listing&&<p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#FF1493",fontWeight:700,letterSpacing:1,cursor:"pointer"}} onClick={()=>openDetail(listing)}>RE: {listing.name?.toUpperCase()} · {currencySymbol(listing.currency)}{listing.price}</p>}
                      </div>
                    </div>

                    {/* Messages */}
                    <div id="chat-messages" style={S.chatMessages}>
                      {messages.length===0&&(
                        <div style={{textAlign:"center",padding:32}}>
                          <p style={{fontSize:13,color:"#bbb"}}>No messages yet. Say hello! 👋</p>
                          {listing&&<div style={S.chatListingPreview} onClick={()=>openDetail(listing)}>
                            {listing.image_url&&<img src={listing.image_url} alt="" style={{width:48,height:48,objectFit:"cover",border:"2px solid #f0f0f0"}}/>}
                            <div><p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:800,color:"#111"}}>{listing.name}</p><p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,color:"#FF1493",fontWeight:700}}>{currencySymbol(listing.currency)}{listing.price}</p></div>
                          </div>}
                        </div>
                      )}
                      {messages.map(msg=>{
                        const isMine=msg.sender_id===user.id;
                        const isSeller=activeConv&&user.id===activeConv.seller_id;
                        const isOffer=msg.message_type==="offer";
                        const offerPending=isOffer&&msg.offer_status==="pending";
                        const canRespond=isOffer&&offerPending&&isSeller;
                        return(
                          <div key={msg.id} style={{display:"flex",justifyContent:isMine?"flex-end":"flex-start",marginBottom:12}}>
                            {isOffer?(
                              <div style={{...S.offerCard,border:`2px solid ${msg.offer_status==="accepted"?"#34C759":msg.offer_status==="declined"?"#FF3B30":msg.offer_status==="countered"?"#FF9500":"#FF1493"}`,maxWidth:"80%",alignSelf:isMine?"flex-end":"flex-start"}}>
                                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                                  <span style={{fontSize:20}}>🏷️</span>
                                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:900,letterSpacing:1}}>
                                    {msg.offer_percent}% OFF OFFER
                                  </span>
                                  <span style={{...S.offerStatusBadge,background:msg.offer_status==="accepted"?"#34C759":msg.offer_status==="declined"?"#FF3B30":msg.offer_status==="countered"?"#FF9500":"#FF1493"}}>
                                    {msg.offer_status?.toUpperCase()}
                                  </span>
                                </div>
                                <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,color:"#FF1493",marginBottom:4}}>
                                  {currencySymbol(listing?.currency)}{msg.offer_amount}
                                </p>
                                <p style={{fontSize:11,color:"#888",marginBottom:canRespond?12:0}}>
                                  Original: {currencySymbol(listing?.currency)}{listing?.price} · {new Date(msg.created_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
                                </p>
                                {msg.counter_amount&&<p style={{fontSize:12,color:"#FF9500",fontWeight:700,marginBottom:canRespond?8:0}}>↩️ Counter: {currencySymbol(listing?.currency)}{msg.counter_amount}</p>}
                                {/* Seller response buttons */}
                                {canRespond&&showCounterOffer!==msg.id&&(
                                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                                    <button className="hbtn" style={{...S.hBtn,background:"#34C759",border:"none",padding:"8px 16px",fontSize:11,letterSpacing:1}} onClick={()=>respondToOffer(msg.id,"accepted")}>✓ ACCEPT</button>
                                    <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#FF1493",border:"2px solid #FF1493",padding:"8px 16px",fontSize:11,letterSpacing:1}} onClick={()=>respondToOffer(msg.id,"declined")}>✗ DECLINE</button>
                                    <button className="hbtn" style={{...S.hBtn,background:"#FF9500",border:"none",padding:"8px 16px",fontSize:11,letterSpacing:1}} onClick={()=>setShowCounterOffer(msg.id)}>↩️ COUNTER</button>
                                  </div>
                                )}
                                {/* Counter offer input */}
                                {canRespond&&showCounterOffer===msg.id&&(
                                  <div style={{display:"flex",gap:8,alignItems:"center",marginTop:4}}>
                                    <input style={{...S.inp,flex:1,padding:"8px 12px",fontSize:13}} type="number" placeholder={`Counter price (${currencySymbol(listing?.currency)})`} value={counterInput} onChange={e=>setCounterInput(e.target.value)}/>
                                    <button className="hbtn" style={{...S.hBtn,background:"#FF9500",border:"none",padding:"8px 14px",fontSize:12}} onClick={()=>respondToOffer(msg.id,"countered",counterInput)}>SEND</button>
                                    <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#888",border:"1px solid #e0e0e0",padding:"8px 12px",fontSize:12}} onClick={()=>setShowCounterOffer(null)}>✕</button>
                                  </div>
                                )}
                              </div>
                            ):(
                              <div style={{...S.msgBubble,background:isMine?"#FF1493":"#f5f5f5",color:isMine?"#fff":"#111",borderRadius:isMine?"16px 16px 4px 16px":"16px 16px 16px 4px"}}>
                                <p style={{fontSize:14,lineHeight:1.5}}>{msg.content}</p>
                                <p style={{fontSize:10,opacity:0.6,marginTop:4,textAlign:"right"}}>{new Date(msg.created_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Offer preset buttons — only show for buyer */}
                    {activeConv&&user.id===activeConv.buyer_id&&listing&&!listing.sold&&(
                      <div style={S.offerBar}>
                        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:800,letterSpacing:2,color:"#999"}}>SEND OFFER:</span>
                        {[10,20,30].map(pct=>{
                          const amt=parseFloat((listing.price*(1-pct/100)).toFixed(2));
                          return(
                            <button key={pct} className="hbtn"
                              style={{...S.hBtn,background:"#fff0f8",color:"#FF1493",border:"1.5px solid #FF149366",padding:"6px 14px",fontSize:11,letterSpacing:1}}
                              onClick={()=>sendOffer(pct)}>
                              {pct}% OFF · {currencySymbol(listing.currency)}{amt}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Input */}
                    <div style={S.chatInput}>
                      <input style={{...S.inp,flex:1,borderRight:"none",borderTop:"none",borderLeft:"none",borderBottom:"none"}} placeholder="Type a message..." value={msgInput} onChange={e=>setMsgInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMessage()}/>
                      <button className="hbtn" style={{...S.hBtn,background:"#FF1493",borderRadius:0,padding:"12px 20px",fontSize:16,flexShrink:0,opacity:msgSending?0.5:1}} onClick={sendMessage} disabled={msgSending||!msgInput.trim()}>→</button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </main>
      )}

      {/* ── AUTH ── */}
      {view==="auth"&&(
        <main style={{...S.main,maxWidth:480}}>
          <button style={S.back} onClick={()=>{ setView("shop"); setOtpStep("form"); setOtpCode(""); setAError(""); }}>← BACK</button>
          <div style={S.formCard}>
            {otpStep==="otp"?(
              // OTP verification screen
              <>
                <div style={S.formHero}>
                  <h2 style={S.formTitle}>CHECK YOUR<br/><span style={{color:"#FF1493"}}>EMAIL.</span></h2>
                  <p style={S.formSub}>We sent a 6-digit code to <strong>{otpEmail}</strong></p>
                </div>
                <form onSubmit={handleOTPVerify} style={{display:"flex",flexDirection:"column",gap:14}}>
                  <F l="6-DIGIT CODE">
                    <input style={{...S.inp,fontSize:28,letterSpacing:12,textAlign:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900}}
                      placeholder="000000" maxLength={6} value={otpCode}
                      onChange={e=>setOtpCode(e.target.value.replace(/\D/g,"").slice(0,6))}
                      autoFocus/>
                  </F>
                  {aError&&<div style={S.aError}>{aError}</div>}
                  <button type="submit" className="hbtn" style={{...S.hBtn,width:"100%",padding:"16px",fontSize:15,borderRadius:0,letterSpacing:3,opacity:(aLoading||otpCode.length!==6)?0.5:1}}
                    disabled={aLoading||otpCode.length!==6}>
                    {aLoading?"VERIFYING...":"VERIFY CODE →"}
                  </button>
                </form>
                <p style={{textAlign:"center",marginTop:16,fontSize:13,color:"#888"}}>
                  Didn't get it? <span style={{color:"#FF1493",cursor:"pointer",fontWeight:700}} onClick={()=>{ auth.sendOTP(otpEmail); flash("📧 Code resent!"); }}>Resend code</span>
                </p>
              </>
            ):(
              // Normal login / signup screen
              <>
                <div style={S.formHero}><h2 style={S.formTitle}>{authMode==="login"?"WELCOME\nBACK.":"JOIN\nSTITCH'D."}</h2><p style={S.formSub}>{authMode==="login"?"Sign in to your account.":"Create an account to start selling."}</p></div>
                <a href={auth.googleUrl()} style={S.googleBtn}><svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/><path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/></svg>CONTINUE WITH GOOGLE</a>
                <div style={S.divider}><span style={S.dividerText}>OR</span></div>
                <form onSubmit={handleAuth} style={{display:"flex",flexDirection:"column",gap:14}}>
                  <F l="EMAIL"><input style={S.inp} type="email" placeholder="you@email.com" value={aForm.email} onChange={e=>setAForm(f=>({...f,email:e.target.value}))} required/></F>
                  {authMode==="login"&&<F l="PASSWORD"><input style={S.inp} type="password" placeholder="••••••••" value={aForm.password} onChange={e=>setAForm(f=>({...f,password:e.target.value}))} required/></F>}
                  {authMode==="signup"&&<p style={{fontSize:12,color:"#888",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>📧 WE'LL SEND A VERIFICATION CODE TO YOUR EMAIL</p>}
                  {aError&&<div style={S.aError}>{aError}</div>}
                  <button type="submit" className="hbtn" style={{...S.hBtn,width:"100%",padding:"16px",fontSize:15,borderRadius:0,letterSpacing:3,opacity:aLoading?0.5:1}}>
                    {aLoading?"...":authMode==="login"?"SIGN IN →":"GET VERIFICATION CODE →"}
                  </button>
                </form>
                <p style={S.authSwitch}>{authMode==="login"?"No account? ":"Already have one? "}<span style={S.authSwitchLink} onClick={()=>{setAuthMode(authMode==="login"?"signup":"login");setAError("");setAForm({email:"",password:""});}}>{authMode==="login"?"Sign up":"Log in"}</span></p>
              </>
            )}
          </div>
        </main>
      )}

      {/* ── EDIT PROFILE ── */}
      {view==="editprofile"&&user&&(
        <main style={{...S.main,maxWidth:600}}>
          <button style={S.back} onClick={()=>setView("shop")}>← BACK</button>
          <div style={S.formCard}>
            <div style={S.formHero}>
              <h2 style={S.formTitle}>YOUR<br/><span style={{color:"#FF1493"}}>PROFILE.</span></h2>
              <p style={S.formSub}>This is what buyers see when they visit your page.</p>
            </div>

            {/* Avatar upload */}
            <Sec label="PROFILE PICTURE">
              <div style={{display:"flex",alignItems:"center",gap:20}}>
                <div style={S.avatarUploadCircle} onClick={()=>document.getElementById("avatar-input").click()}>
                  {profForm.avatarPreview
                    ? <img src={profForm.avatarPreview} alt="avatar" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/>
                    : <div style={S.avatarInitials}>{(profForm.full_name||profForm.username||user.email||"?")[0].toUpperCase()}</div>
                  }
                  <div style={S.avatarEditOverlay}>📸</div>
                </div>
                <div>
                  <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111",marginBottom:8,display:"block"}} onClick={()=>document.getElementById("avatar-input").click()}>UPLOAD PHOTO</button>
                  {profForm.avatarPreview&&<button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#FF1493",border:"2px solid #FF1493",fontSize:11}} onClick={()=>setProfForm(f=>({...f,avatarFile:null,avatarPreview:"",avatar_url:""}))}>REMOVE</button>}
                  <p style={{fontSize:11,color:"#bbb",marginTop:8,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>OR YOUR INITIALS WILL SHOW AS AVATAR</p>
                </div>
              </div>
              <input id="avatar-input" type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f)setProfForm(p=>({...p,avatarFile:f,avatarPreview:URL.createObjectURL(f)}));}}/>
            </Sec>

            {/* Details */}
            <Sec label="YOUR DETAILS">
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                <F l="FULL NAME"><input style={S.inp} placeholder="e.g. Nasreen Ahmed" value={profForm.full_name} onChange={e=>setProfForm(f=>({...f,full_name:e.target.value}))}/></F>
                <F l="USERNAME"><input style={S.inp} placeholder="e.g. @nasreen.closet" value={profForm.username} onChange={e=>setProfForm(f=>({...f,username:e.target.value}))}/></F>
                <F l="BIO"><textarea style={{...S.inp,height:80,resize:"vertical",width:"100%"}} placeholder="Tell buyers about yourself — your style, what you sell, your story..." value={profForm.bio} onChange={e=>setProfForm(f=>({...f,bio:e.target.value}))}/></F>
                <F l="LOCATION"><input style={S.inp} placeholder="e.g. London, UK" value={profForm.location} onChange={e=>setProfForm(f=>({...f,location:e.target.value}))}/></F>
                <F l="REGION">
                  <select style={S.inp} value={profForm.region} onChange={e=>setProfForm(f=>({...f,region:e.target.value}))}>
                    <option value="">Select region...</option>
                    {["UK","USA","Canada","Australia","UAE","Pakistan","India","Bangladesh","Sri Lanka","Europe","Other"].map(r=><option key={r} value={r}>{r}</option>)}
                  </select>
                </F>
                <F l="CURRENCY">
                  <select style={S.inp} value={profForm.currency} onChange={e=>setProfForm(f=>({...f,currency:e.target.value}))}>
                    {[["USD","$ USD — US Dollar"],["GBP","£ GBP — British Pound"],["EUR","€ EUR — Euro"],["CAD","$ CAD — Canadian Dollar"],["AUD","$ AUD — Australian Dollar"],["AED","AED — UAE Dirham"],["PKR","₨ PKR — Pakistani Rupee"],["INR","₹ INR — Indian Rupee"],["BDT","৳ BDT — Bangladeshi Taka"]].map(([code,label])=><option key={code} value={code}>{label}</option>)}
                  </select>
                </F>
                <F l="EMAIL"><input style={{...S.inp,background:"#f5f5f5",color:"#aaa"}} value={user.email} disabled/></F>
              </div>
            </Sec>

            {/* Specialises in */}
            <Sec label="I SPECIALISE IN">
              <p style={{fontSize:12,color:"#bbb",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1,marginBottom:12}}>SELECT ALL THAT APPLY</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {["Bridal","Eid","Casual","Party","Vintage","Luxury","Budget-friendly","Handmade","Designer","All Occasions"].map(s=>{
                  const on=(profForm.specialises_in||[]).includes(s);
                  return <button key={s} type="button" className="hbtn"
                    style={{...S.hBtn,background:on?"#FF1493":"#fff",color:on?"#fff":"#111",border:`2px solid ${on?"#FF1493":"#111"}`,padding:"8px 16px",fontSize:11,letterSpacing:1.5}}
                    onClick={()=>setProfForm(f=>({...f,specialises_in:on?f.specialises_in.filter(x=>x!==s):[...f.specialises_in,s]}))}>
                    {s.toUpperCase()}
                  </button>;
                })}
              </div>
            </Sec>

            <button className="hbtn" style={{...S.hBtn,width:"100%",padding:"16px",fontSize:15,borderRadius:0,letterSpacing:3,opacity:profSaving?0.5:1}} onClick={saveProfile}>
              {profSaving?"SAVING...":"SAVE PROFILE →"}
            </button>

            {/* My Measurements */}
            <div style={{marginTop:36,paddingTop:32,borderTop:"3px solid #111"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #007AFF",paddingLeft:12,marginBottom:8}}>📐 MY MEASUREMENTS</div>
              <p style={{fontSize:12,color:"#888",marginBottom:16,lineHeight:1.6}}>Save your measurements to see "FITS YOU" badges on listings that match your size.</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                {[["bust","BUST (inches)"],["waist","WAIST (inches)"],["hips","HIPS (inches)"],["height","HEIGHT (cm)"]].map(([k,l])=>(
                  <F key={k} l={l}><input style={S.inp} type="number" placeholder="e.g. 34" value={profForm[k]} onChange={e=>setProfForm(f=>({...f,[k]:e.target.value}))}/></F>
                ))}
              </div>
              <F l="PREFERRED SIZE">
                <select style={S.inp} value={profForm.preferred_size} onChange={e=>setProfForm(f=>({...f,preferred_size:e.target.value}))}>
                  <option value="">Select...</option>
                  {SIZES.map(s=><option key={s}>{s}</option>)}
                </select>
              </F>
            </div>

            {/* Tailor Directory */}
            <div style={{marginTop:36,paddingTop:32,borderTop:"3px solid #111"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #FF9500",paddingLeft:12,marginBottom:8}}>✂️ TAILOR LISTING</div>
              <p style={{fontSize:12,color:"#888",marginBottom:16,lineHeight:1.6}}>List yourself as a tailor or alteration specialist so buyers can find you.</p>
              <Tog on={profForm.is_tailor} onToggle={()=>setProfForm(f=>({...f,is_tailor:!f.is_tailor}))} color="#FF9500" label="LIST ME AS A TAILOR" sub="Show my profile in the tailor directory"/>
              {profForm.is_tailor&&(
                <div style={{marginTop:12}}>
                  <Tog on={profForm.accepting_clients} onToggle={()=>setProfForm(f=>({...f,accepting_clients:!f.accepting_clients}))} color="#34C759" label="ACCEPTING NEW CLIENTS" sub="Turn off if you're fully booked"/>
                </div>
              )}
              {profForm.is_tailor&&(
                <div style={{marginTop:16,display:"flex",flexDirection:"column",gap:12}}>
                  <div>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:800,letterSpacing:2,color:"#999",marginBottom:10}}>SERVICES OFFERED</p>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {["Alterations","Taking In","Letting Out","Hemming","Blouse Stitching","Full Stitching","Embroidery","Repairs","Custom Orders"].map(s=>{
                        const on=(profForm.tailor_services||[]).includes(s);
                        return<button key={s} type="button" className="hbtn" style={{...S.hBtn,background:on?"#FF9500":"#fff",color:on?"#fff":"#111",border:`2px solid ${on?"#FF9500":"#111"}`,padding:"6px 14px",fontSize:11,letterSpacing:1}} onClick={()=>setProfForm(f=>({...f,tailor_services:on?f.tailor_services.filter(x=>x!==s):[...f.tailor_services,s]}))}>{s.toUpperCase()}</button>;
                      })}
                    </div>
                  </div>
                  <F l="STARTING PRICE"><input style={S.inp} type="number" placeholder="e.g. 15" value={profForm.tailor_price_from} onChange={e=>setProfForm(f=>({...f,tailor_price_from:e.target.value}))}/></F>
                </div>
              )}
            </div>
            <div style={{marginTop:36,paddingTop:32,borderTop:"3px solid #111"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #34C759",paddingLeft:12,marginBottom:20}}>🔐 TWO-FACTOR AUTHENTICATION</div>
              {twoFAStep==="enroll"&&twoFAData?(
                <div>
                  <p style={{fontSize:13,color:"#666",marginBottom:16,lineHeight:1.6}}>Scan this QR code with <strong>Google Authenticator</strong> or <strong>Authy</strong>, then enter the 6-digit code below to confirm.</p>
                  {twoFAData.totp?.qr_code&&<img src={twoFAData.totp.qr_code} alt="2FA QR Code" style={{width:180,height:180,border:"3px solid #111",marginBottom:16,display:"block"}}/>}
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:800,letterSpacing:2,color:"#bbb",marginBottom:8}}>MANUAL KEY (if QR doesn't work):</p>
                  <p style={{fontFamily:"monospace",fontSize:12,background:"#f5f5f5",padding:"8px 12px",marginBottom:16,wordBreak:"break-all"}}>{twoFAData.totp?.secret}</p>
                  <F l="ENTER 6-DIGIT CODE FROM APP">
                    <input style={{...S.inp,fontSize:24,letterSpacing:8,textAlign:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900}}
                      placeholder="000000" maxLength={6} value={twoFACode}
                      onChange={e=>setTwoFACode(e.target.value.replace(/\D/g,"").slice(0,6))}/>
                  </F>
                  <div style={{display:"flex",gap:10,marginTop:14}}>
                    <button className="hbtn" style={{...S.hBtn,background:"#34C759",border:"none",flex:1,padding:"12px",opacity:(twoFACode.length!==6||twoFALoading)?0.4:1}} onClick={confirm2FA} disabled={twoFACode.length!==6||twoFALoading}>
                      {twoFALoading?"VERIFYING...":"✓ CONFIRM 2FA"}
                    </button>
                    <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111",padding:"12px 16px"}} onClick={()=>{setTwoFAStep(null);setTwoFACode("");setTwoFAData(null);}}>CANCEL</button>
                  </div>
                </div>
              ):(
                <div>
                  {twoFAFactors.length>0?(
                    <div>
                      <div style={{...S.alterBadge,...S.aY,marginBottom:16,display:"inline-flex",alignItems:"center",gap:8}}>✓ 2FA IS ENABLED</div>
                      <p style={{fontSize:13,color:"#666",marginBottom:16}}>Your account is protected with an authenticator app.</p>
                      {twoFAFactors.map(f=>(
                        <div key={f.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"#fafafa",border:"1.5px solid #e0e0e0",marginBottom:8}}>
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700}}>{f.friendly_name||"Authenticator App"}</span>
                          <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#FF1493",border:"1.5px solid #FF1493",fontSize:11,padding:"5px 12px"}} onClick={()=>disable2FA(f.id)}>REMOVE</button>
                        </div>
                      ))}
                    </div>
                  ):(
                    <div>
                      <p style={{fontSize:13,color:"#888",marginBottom:16,lineHeight:1.6}}>Add an extra layer of security. You'll need to enter a code from your authenticator app each time you log in.</p>
                      <button className="hbtn" style={{...S.hBtn,background:"#34C759",border:"none",padding:"12px 24px",opacity:twoFALoading?0.5:1}} onClick={()=>{load2FAFactors();setup2FA();}}>
                        {twoFALoading?"SETTING UP...":"🔐 ENABLE 2FA"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* ── SELLER PROFILE VIEW ── */}
      {view==="profile"&&viewedProfile&&(
        <main style={S.main}>
          <button style={S.back} onClick={()=>setView(prevView||"shop")}>← BACK</button>
          <div style={S.profileHeader}>
            {/* Avatar */}
            <div style={S.profileAvatarWrap}>
              {viewedProfile.avatar_url
                ? <img src={viewedProfile.avatar_url} alt={viewedProfile.full_name||viewedProfile.username} style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/>
                : <div style={S.profileAvatar}>{(viewedProfile.full_name||viewedProfile.username||"S")[0].toUpperCase()}</div>
              }
            </div>
            {/* Info */}
            <div style={{flex:1}}>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:4,color:"#FF1493",marginBottom:4}}>SELLER PROFILE</p>
              <h2 style={S.profileName}>
                {viewedProfile.full_name||viewedProfile.username||"Seller"}
                {viewedProfile.verified&&<span style={S.verifiedBadge}>✓ VERIFIED</span>}
                {!viewedProfile.verified&&getSellerTier(viewedProfile)&&<span style={{...S.verifiedBadge,background:getSellerTier(viewedProfile).color}}>{getSellerTier(viewedProfile).label}</span>}
              </h2>
              {viewedProfile.username&&viewedProfile.full_name&&<p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,color:"#bbb",marginBottom:8}}>{viewedProfile.username}</p>}
              {viewedProfile.location&&<p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,color:"#888",marginBottom:4}}>📍 {viewedProfile.location}</p>}
              {viewedProfile.region&&<p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,color:"#888",marginBottom:10}}>🌍 {viewedProfile.region} {viewedProfile.currency&&viewedProfile.currency!=="USD"?`· ${viewedProfile.currency}`:""}</p>}
              {/* Specialises in */}
              {(viewedProfile.specialises_in||[]).length>0&&(
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
                  {viewedProfile.specialises_in.map(s=>(
                    <span key={s} style={{background:"#FF149318",color:"#FF1493",border:"1.5px solid #FF149344",padding:"3px 12px",fontSize:11,fontWeight:800,letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif"}}>{s.toUpperCase()}</span>
                  ))}
                </div>
              )}
              <p style={S.profileMeta}>{profileListings.length} listings · {profileListings.filter(i=>i.sold).length} sold · {profileListings.reduce((a,i)=>a+(i.views||0),0)} total views {reviews.length>0&&`· ⭐ ${(reviews.reduce((a,r)=>a+r.rating,0)/reviews.length).toFixed(1)} avg rating`}</p>
              {/* Follow button */}
              {user&&viewedProfile.id!==user.id&&(
                <button className="hbtn" style={{...S.hBtn,background:isFollowing(viewedProfile.id)?"#fff":"#FF1493",color:isFollowing(viewedProfile.id)?"#FF1493":"#fff",border:"2px solid #FF1493",marginTop:14,letterSpacing:1.5}} onClick={()=>toggleFollow(viewedProfile.id)}>
                  {isFollowing(viewedProfile.id)?"✓ FOLLOWING":"+ FOLLOW"}
                </button>
              )}
            </div>
          </div>
          {/* Listings */}
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #FF1493",paddingLeft:12,marginBottom:20}}>
            ALL LISTINGS
          </div>
          <div style={S.grid}>
            {profileListings.map((item,idx)=>{
              const accent=CARD_COLORS[idx%CARD_COLORS.length];
              return(
                <article key={item.id} className="scard" style={{...S.card,borderColor:accent,opacity:item.sold?0.55:1}} onClick={()=>openDetail(item)}>
                  <div style={{...S.cardTop,background:item.image_url?"#000":accent,overflow:"hidden"}}>
                    {item.image_url?<img src={item.image_url} alt={item.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={S.cardEmoji}>{item.emoji||catEmoji(item.category)}</span>}
                    {item.sold&&<div style={S.soldVeil}><span style={S.soldStamp}>SOLD</span></div>}
                    {item.reserved&&!item.sold&&<div style={S.reservedBadge}>RESERVED</div>}
                  </div>
                  <div style={S.cardBody}>
                    <p style={{...S.cardCatLabel,color:accent}}>{item.category?.toUpperCase()}</p>
                    <p style={S.cardName}>{item.name}</p>
                    <div style={S.cardFoot}>
                      <span style={{...S.cardPrice,color:accent}}>${item.price}</span>
                      {item.views>0&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#bbb",letterSpacing:1}}>👁 {item.views}</span>}
                    </div>
                  </div>
                  <div style={{...S.accentBar,background:accent}}/>
                </article>
              );
            })}
            {profileListings.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"40px",fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,color:"#bbb"}}>NO LISTINGS YET.</div>}
          </div>

          {/* Reviews on profile */}
          {reviews.length>0&&(
            <div style={{marginTop:48}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #FF9500",paddingLeft:12,marginBottom:20}}>
                REVIEWS ({reviews.length}) · ⭐ {(reviews.reduce((a,r)=>a+r.rating,0)/reviews.length).toFixed(1)} AVG
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:3}}>
                {reviews.map(r=>(
                  <div key={r.id} style={S.reviewCard}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <span style={{fontSize:16}}>{Array(r.rating).fill("⭐").join("")}</span>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#bbb",letterSpacing:1}}>{new Date(r.created_at).toLocaleDateString("en-GB",{month:"short",year:"numeric"}).toUpperCase()}</span>
                    </div>
                    {r.comment&&<p style={{fontSize:13,color:"#666",lineHeight:1.5}}>{r.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      )}

      {/* ── DASHBOARD ── */}
      {view==="dashboard"&&user&&(
        <main style={S.main}>
          <button style={S.back} onClick={()=>setView("shop")}>← BACK TO SHOP</button>
          <div style={S.dashHeader}>
            <div><p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:4,color:"#FF1493",marginBottom:8}}>YOUR CLOSET</p><h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:48,fontWeight:900,letterSpacing:-1,lineHeight:1}}>MY DROPS</h2></div>
            <div style={S.dashStats}>
              <div style={S.dashStat}><div style={{...S.dashStatNum,color:"#FF1493"}}>{myItems.length}</div><div style={S.dashStatLabel}>TOTAL</div></div>
              <div style={S.dashStat}><div style={{...S.dashStatNum,color:"#34C759"}}>{myItems.filter(i=>!i.sold).length}</div><div style={S.dashStatLabel}>LIVE</div></div>
              <div style={S.dashStat}><div style={{...S.dashStatNum,color:"#FF9500"}}>{myItems.filter(i=>i.sold).length}</div><div style={S.dashStatLabel}>SOLD</div></div>
              <div style={S.dashStat}><div style={{...S.dashStatNum,color:"#007AFF"}}>${myItems.filter(i=>i.sold).reduce((a,i)=>a+i.price,0)}</div><div style={S.dashStatLabel}>EARNED</div></div>
              <div style={S.dashStat}><div style={{...S.dashStatNum,color:"#BF5AF2"}}>{myItems.reduce((a,i)=>a+(i.views||0),0)}</div><div style={S.dashStatLabel}>VIEWS</div></div>
            </div>
          </div>
          {myItems.length===0?(
            <div style={{textAlign:"center",padding:"60px 20px"}}><p style={{fontSize:48,marginBottom:12}}>🥻</p><p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:900,marginBottom:8}}>NO LISTINGS YET.</p><button className="hbtn" style={S.hBtn} onClick={()=>setView("add")}>LIST YOUR FIRST PIECE →</button></div>
          ):(
            <div style={S.dashGrid}>
              {myItems.map((item,idx)=>(
                <div key={item.id} style={{...S.dashCard,borderColor:item.sold?"#ccc":CARD_COLORS[idx%CARD_COLORS.length]}}>
                  <div style={{...S.dashCardImg,background:item.image_url?"#000":CARD_COLORS[idx%CARD_COLORS.length]}}>
                    {item.image_url?<img src={item.image_url} alt={item.name} style={{width:"100%",height:"100%",objectFit:"cover",opacity:item.sold?0.5:1}}/>:<span style={{fontSize:44}}>{item.emoji||catEmoji(item.category)}</span>}
                    {item.sold&&<div style={S.soldVeil}><span style={S.soldStamp}>SOLD</span></div>}
                    {item.reserved&&!item.sold&&<div style={S.reservedBadge}>RESERVED</div>}
                  </div>
                  <div style={S.dashCardBody}>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:800,letterSpacing:2,color:item.sold?"#ccc":CARD_COLORS[idx%CARD_COLORS.length],marginBottom:2}}>{item.category?.toUpperCase()}</p>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:800,color:item.sold?"#aaa":"#111",marginBottom:4,lineHeight:1.2}}>{item.name}</p>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:900,color:item.sold?"#aaa":CARD_COLORS[idx%CARD_COLORS.length],marginBottom:4}}>${item.price}</p>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#bbb",letterSpacing:1,marginBottom:10}}>👁 {item.views||0} VIEWS</p>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <button className="hbtn" style={{...S.dashBtn,background:CARD_COLORS[idx%CARD_COLORS.length],color:"#fff"}} onClick={()=>{setSel(item);openEdit(item);}}>EDIT</button>
                      {!item.sold&&<button className="hbtn" style={{...S.dashBtn,background:item.reserved?"#FF9500":"#fff",color:item.reserved?"#fff":"#111",border:"1.5px solid #111"}} onClick={()=>markReserved(item.id,item.reserved)}>{item.reserved?"UNRESERVE":"RESERVE"}</button>}
                      {!item.sold&&<button className="hbtn" style={{...S.dashBtn,background:"#111",color:"#fff"}} onClick={()=>markSold(item.id,item.sold)}>MARK SOLD</button>}
                      {item.sold&&<button className="hbtn" style={{...S.dashBtn,background:"#34C759",color:"#fff"}} onClick={()=>relist(item.id)}>RELIST</button>}
                      <button className="hbtn" style={{...S.dashBtn,background:"#fff",color:"#FF1493",border:"1.5px solid #FF1493"}} onClick={()=>del(item.id)}>DELETE</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Bundles section */}
          <div style={{marginTop:48}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,paddingBottom:16,borderBottom:"2px solid #111"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #FF9500",paddingLeft:12}}>🎁 MY BUNDLES</div>
              <button className="hbtn" style={{...S.hBtn,background:"#FF9500",border:"none",fontSize:11}} onClick={()=>{loadBundles();setView("createbundle");}}>+ CREATE BUNDLE</button>
            </div>
            {bundles.length===0?(
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,color:"#bbb",letterSpacing:1}}>No bundles yet. Bundle separate listings to offer a deal! 🎁</p>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {bundles.map(b=>{
                  const bListings=bundleItems[b.id]||[];
                  const total=bListings.reduce((a,i)=>a+i.price,0);
                  const discounted=parseFloat((total*(1-b.discount_percent/100)).toFixed(2));
                  return(
                    <div key={b.id} style={{border:"2px solid #FF9500",padding:"16px 20px",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
                      <div>
                        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900,letterSpacing:0.5,marginBottom:4}}>{b.name} {b.discount_percent>0&&<span style={{background:"#FF9500",color:"#fff",padding:"2px 8px",fontSize:10,fontWeight:800,letterSpacing:1}}>{b.discount_percent}% OFF</span>}</p>
                        {b.description&&<p style={{fontSize:12,color:"#888",marginBottom:6}}>{b.description}</p>}
                        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:6}}>
                          {bListings.map(i=><span key={i.id} style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,background:"#fff8f0",color:"#FF9500",border:"1px solid #FF950044",padding:"2px 8px"}}>{i.name}</span>)}
                        </div>
                        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:800,color:"#FF9500"}}>Bundle price: ${discounted} {b.discount_percent>0&&<span style={{color:"#bbb",textDecoration:"line-through",fontWeight:400}}>${total}</span>}</p>
                      </div>
                      <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#FF1493",border:"2px solid #FF1493",fontSize:11}} onClick={()=>deleteBundle(b.id)}>DELETE</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      )}
      {/* ── FEED ── */}
      {view==="feed"&&user&&(
        <main style={S.main}>
          <button style={S.back} onClick={()=>setView("shop")}>← BACK</button>
          <div style={{marginBottom:36,paddingBottom:24,borderBottom:"3px solid #111",display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
            <div>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:4,color:"#FF1493",marginBottom:6}}>YOUR FEED</p>
              <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:48,fontWeight:900,letterSpacing:-1,lineHeight:1}}>FOLLOWING ✦</h2>
              <p style={{fontSize:13,color:"#888",marginTop:8}}>Latest drops from sellers you follow</p>
            </div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,color:"#bbb"}}>
              {following.length} FOLLOWING
            </div>
          </div>

          {feedLoading&&<div style={S.loadingWrap}><div style={S.spinner}/><p style={S.loadingText}>LOADING FEED...</p></div>}

          {!feedLoading&&following.length===0&&(
            <div style={{textAlign:"center",padding:"60px 20px"}}>
              <p style={{fontSize:48,marginBottom:12}}>✦</p>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:900,marginBottom:8}}>YOU'RE NOT FOLLOWING ANYONE YET.</p>
              <p style={{color:"#888",marginBottom:20}}>Visit a seller's profile and tap + FOLLOW to see their drops here.</p>
              <button className="hbtn" style={S.hBtn} onClick={()=>setView("shop")}>BROWSE DROPS →</button>
            </div>
          )}

          {!feedLoading&&following.length>0&&feedItems.length===0&&(
            <div style={{textAlign:"center",padding:"60px 20px"}}>
              <p style={{fontSize:48,marginBottom:12}}>🥻</p>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:900,marginBottom:8}}>NO NEW DROPS.</p>
              <p style={{color:"#888",marginBottom:20}}>The sellers you follow haven't listed anything yet.</p>
            </div>
          )}

          {!feedLoading&&feedItems.length>0&&(
            <div style={S.grid}>
              {feedItems.map((item,idx)=>{
                const accent=CARD_COLORS[idx%CARD_COLORS.length];
                const sellerProfile=feedProfiles[item.user_id];
                return(
                  <article key={item.id} className="scard" style={{...S.card,borderColor:accent,opacity:item.sold?0.55:1}}>
                    {/* Seller mini header */}
                    <div style={{padding:"8px 12px",borderBottom:"1px solid #f0f0f0",display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>openProfile(item.user_id)}>
                      <div style={{width:24,height:24,borderRadius:"50%",background:accent,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0,border:"1.5px solid #111"}}>
                        {sellerProfile?.avatar_url?<img src={sellerProfile.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:900,color:"#fff"}}>{(sellerProfile?.full_name||sellerProfile?.username||"?")[0].toUpperCase()}</span>}
                      </div>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:0.5,color:"#111"}}>{sellerProfile?.username||sellerProfile?.full_name||"Seller"}</span>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#bbb",marginLeft:"auto"}}>{new Date(item.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short"}).toUpperCase()}</span>
                    </div>
                    {/* Card */}
                    <div style={{...S.cardTop,background:item.image_url?"#000":accent,overflow:"hidden",height:180}} onClick={()=>openDetail(item)}>
                      {item.image_url?<img src={item.image_url} alt={item.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={S.cardEmoji}>{item.emoji||catEmoji(item.category)}</span>}
                      {item.image_url&&<div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 50%,rgba(0,0,0,0.45))"}}/>}
                      {item.sold&&<div style={S.soldVeil}><span style={S.soldStamp}>SOLD</span></div>}
                      {item.reserved&&!item.sold&&<div style={S.reservedBadge}>RESERVED</div>}
                      <button style={{...S.heartBtn,background:wishlist.includes(item.id)?"#FF1493":"rgba(255,255,255,0.85)"}} onClick={e=>{e.stopPropagation();toggleWishlist(item.id);}}>{wishlist.includes(item.id)?"❤️":"🤍"}</button>
                    </div>
                    <div style={S.cardBody} onClick={()=>openDetail(item)}>
                      <p style={{...S.cardCatLabel,color:accent}}>{item.category?.toUpperCase()} · {(item.material||item.fabric)?.toUpperCase()}</p>
                      <p style={S.cardName}>{item.name}</p>
                      {(item.occasions||[]).length>0&&<div style={S.occRow}>{item.occasions.slice(0,2).map(o=><span key={o} style={{...S.occChip,background:OCC_COLOR[o]||"#999",color:"#fff"}}>{o.toUpperCase()}</span>)}</div>}
                      <div style={S.cardFoot}>
                        <span style={{...S.cardPrice,color:accent}}>{currencySymbol(item.currency)}{item.price}</span>
                        {item.whatsapp&&!item.sold&&<a href={waLink(item.whatsapp,item.name,item.price)} target="_blank" rel="noreferrer" style={{...S.waSmall,background:accent}} onClick={e=>e.stopPropagation()}>💬</a>}
                      </div>
                    </div>
                    <div style={{...S.accentBar,background:accent}}/>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* ── CREATE BUNDLE ── */}
      {view==="createbundle"&&user&&(
        <main style={{...S.main,maxWidth:760}}>
          <button style={S.back} onClick={()=>setView("dashboard")}>← BACK TO DASHBOARD</button>
          <div style={S.formCard}>
            <div style={S.formHero}>
              <h2 style={S.formTitle}>CREATE A<br/><span style={{color:"#FF9500"}}>BUNDLE.</span></h2>
              <p style={S.formSub}>Group separate listings together and offer buyers a deal.</p>
            </div>
            <Sec label="BUNDLE DETAILS">
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                <F l="Bundle Name *"><input style={S.inp} placeholder="e.g. Bridal Lehenga + Jewellery Set" value={bundleForm.name} onChange={e=>setBundleForm(f=>({...f,name:e.target.value}))}/></F>
                <F l="Description"><input style={S.inp} placeholder="e.g. Complete bridal look" value={bundleForm.description} onChange={e=>setBundleForm(f=>({...f,description:e.target.value}))}/></F>
                <F l="BUNDLE DISCOUNT (%)">
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {[0,5,10,15,20].map(pct=>(
                      <button key={pct} type="button" className="hbtn"
                        style={{...S.hBtn,background:bundleForm.discount_percent===pct?"#FF9500":"#fff",color:bundleForm.discount_percent===pct?"#fff":"#111",border:`2px solid ${bundleForm.discount_percent===pct?"#FF9500":"#111"}`,padding:"8px 14px",fontSize:11}}
                        onClick={()=>setBundleForm(f=>({...f,discount_percent:pct}))}>
                        {pct===0?"NO DISCOUNT":`${pct}% OFF`}
                      </button>
                    ))}
                  </div>
                </F>
              </div>
            </Sec>
            <Sec label={`SELECT LISTINGS (${bundleForm.selectedListings.length} selected — min 2)`}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8,marginBottom:14}}>
                {myItems.filter(i=>!i.sold).map((item,idx)=>{
                  const isSel=bundleForm.selectedListings.includes(item.id);
                  const accent=CARD_COLORS[idx%CARD_COLORS.length];
                  return(
                    <div key={item.id} style={{border:`3px solid ${isSel?accent:"#e0e0e0"}`,cursor:"pointer",position:"relative",overflow:"hidden",transition:"border-color .15s"}} onClick={()=>toggleBundleListing(item.id)}>
                      <div style={{height:80,background:item.image_url?"#000":accent,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
                        {item.image_url?<img src={item.image_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:32}}>{item.emoji||catEmoji(item.category)}</span>}
                        {isSel&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.35)",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:24,fontWeight:900}}>✓</span></div>}
                      </div>
                      <div style={{padding:"8px 10px"}}><p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:800,color:"#111",marginBottom:2,lineHeight:1.2}}>{item.name}</p><p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:900,color:accent}}>{currencySymbol(item.currency)}{item.price}</p></div>
                    </div>
                  );
                })}
              </div>
              {bundleForm.selectedListings.length>=2&&(()=>{
                const selListings=myItems.filter(i=>bundleForm.selectedListings.includes(i.id));
                const total=selListings.reduce((a,i)=>a+i.price,0);
                const discounted=parseFloat((total*(1-bundleForm.discount_percent/100)).toFixed(2));
                return(<div style={{padding:"14px 16px",background:"#fff8f0",border:"2px solid #FF9500"}}>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:2,color:"#FF9500",marginBottom:6}}>BUNDLE PRICE PREVIEW</p>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:"#888",marginBottom:2}}>Individual total: ${total.toFixed(2)}</p>
                  {bundleForm.discount_percent>0&&<p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:"#FF9500",marginBottom:2}}>Discount: -${(total-discounted).toFixed(2)}</p>}
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,color:"#FF9500"}}>Bundle: ${discounted}</p>
                </div>);
              })()}
            </Sec>
            <button className="hbtn"
              style={{...S.hBtn,background:"#FF9500",border:"none",width:"100%",padding:"16px",fontSize:15,borderRadius:0,letterSpacing:3,opacity:(bundleForm.selectedListings.length<2||!bundleForm.name)?0.4:1,cursor:(bundleForm.selectedListings.length<2||!bundleForm.name)?"not-allowed":"pointer"}}
              onClick={createBundle} disabled={bundleForm.selectedListings.length<2||!bundleForm.name}>
              🎁 CREATE BUNDLE →
            </button>
          </div>
        </main>
      )}

      {/* ── TAILOR MARKETPLACE ── */}
      {view==="tailors"&&(
        <div style={{minHeight:"100vh",background:"#fff"}}>
          {/* Hero */}
          <div style={{background:"#004D40",borderBottom:"3px solid #111",padding:"48px 24px 40px",position:"relative",overflow:"hidden"}}>
            <div style={{maxWidth:1200,margin:"0 auto",display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:20}}>
              <div>
                <button style={{...S.back,color:"#00BFA5",marginBottom:16}} onClick={()=>setView("shop")}>← BACK TO SHOP</button>
                <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:4,color:"#00BFA5",marginBottom:8}}>FIND A TAILOR</p>
                <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(48px,8vw,100px)",fontWeight:900,color:"#fff",lineHeight:.9,letterSpacing:-2,marginBottom:16}}>TAILOR<br/><span style={{color:"#00BFA5"}}>MARKETPLACE</span></h1>
                <p style={{fontSize:15,color:"#aaa",maxWidth:500,lineHeight:1.7}}>Book trusted South Asian tailors for alterations, custom stitching, embroidery and repairs. Every transaction secured through Stitch'd.</p>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10,alignItems:"flex-end"}}>
                <div style={{display:"flex",gap:20,marginBottom:8}}>
                  {[["✂️","Alterations"],["🧵","Custom Stitching"],["✨","Embroidery"],["🔧","Repairs"]].map(([e,l])=>(
                    <div key={l} style={{textAlign:"center"}}>
                      <div style={{fontSize:28,marginBottom:4}}>{e}</div>
                      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#888",letterSpacing:1}}>{l.toUpperCase()}</p>
                    </div>
                  ))}
                </div>
                {user&&<button className="hbtn" style={{...S.hBtn,background:"#00BFA5",border:"none",padding:"14px 28px",fontSize:13,letterSpacing:2}} onClick={()=>{setEditingService(null);setTailorServiceForm({title:"",description:"",service_type:"Alterations",price_from:"",price_to:"",turnaround_days:"",location:"",images:[],imagePreviews:[]});setShowTailorForm(true);}}>+ LIST MY SERVICE</button>}
              </div>
            </div>
          </div>

          <div style={{maxWidth:1200,margin:"0 auto",padding:"32px 16px"}}>
            {/* Stats bar */}
            <div style={{display:"flex",gap:3,marginBottom:32,flexWrap:"wrap"}}>
              {[["✂️",tailorServices.length,"SERVICES LISTED"],["📍",[...new Set(tailorServices.map(s=>s.location).filter(Boolean))].length,"LOCATIONS"],["⭐","10%","PLATFORM FEE"],["🔒","100%","SECURE PAYMENTS"]].map(([e,n,l])=>(
                <div key={l} style={{flex:"1 1 120px",background:"#fafafa",border:"2px solid #111",padding:"16px 20px",display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:24}}>{e}</span>
                  <div>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,color:"#00BFA5",lineHeight:1}}>{n}</p>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,fontWeight:800,letterSpacing:2,color:"#bbb"}}>{l}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* My services */}
            {user&&myTailorServices.length>0&&(
              <div style={{marginBottom:40}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#00BFA5",borderLeft:"4px solid #00BFA5",paddingLeft:12,marginBottom:16}}>MY LISTED SERVICES</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {myTailorServices.map(s=>(
                    <div key={s.id} style={{border:"2px solid #00BFA5",padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap",background:"#fffbf5"}}>
                      <div style={{display:"flex",alignItems:"center",gap:14}}>
                        <div style={{width:48,height:48,background:"#00BFA5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>✂️</div>
                        <div>
                          <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900,marginBottom:2}}>{s.title}</p>
                          <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:"#00BFA5",letterSpacing:1}}>{s.service_type?.toUpperCase()} · FROM {currencySymbol(profile?.currency)}{s.price_from}{s.turnaround_days?` · ${s.turnaround_days} DAYS`:""}</p>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button className="hbtn" style={{...S.hBtn,background:"#00BFA5",border:"none",fontSize:11,padding:"8px 14px"}} onClick={()=>{setEditingService(s);setTailorServiceForm({title:s.title,description:s.description||"",service_type:s.service_type||"Alterations",price_from:s.price_from||"",price_to:s.price_to||"",turnaround_days:s.turnaround_days||"",location:s.location||"",images:[],imagePreviews:s.images||[]});setShowTailorForm(true);}}>EDIT</button>
                        <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#FF1493",border:"2px solid #FF1493",fontSize:11,padding:"8px 14px"}} onClick={()=>deleteTailorService(s.id)}>DELETE</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search + filters */}
            <div style={{display:"flex",gap:10,marginBottom:24,flexWrap:"wrap",alignItems:"stretch"}}>
              <div style={{flex:1,minWidth:200,display:"flex",alignItems:"center",border:"2px solid #111",background:"#fff"}}>
                <span style={{padding:"0 12px",fontSize:14,color:"#bbb"}}>🔍</span>
                <input style={{flex:1,border:"none",outline:"none",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,padding:"12px 0",background:"transparent"}} placeholder="SEARCH TAILORS, LOCATION, SERVICE..." value={tailorSearch} onChange={e=>setTailorSearch(e.target.value)}/>
              </div>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:28}}>
              {["All","Alterations","Taking In","Letting Out","Hemming","Blouse Stitching","Full Stitching","Custom Stitching","Embroidery","Repairs","Custom Orders"].map(t=>(
                <button key={t} className="fpill" style={{...S.pill,...(tailorTypeFilter===t?{...S.pillOn,background:"#00BFA5",borderColor:"#00BFA5"}:{})}} onClick={()=>setTailorTypeFilter(t)}>{t}</button>
              ))}
            </div>

            {/* Services grid */}
            {tailorServices.length===0?(
              <div style={{textAlign:"center",padding:"80px 20px",border:"3px dashed #e0e0e0"}}>
                <p style={{fontSize:64,marginBottom:16}}>✂️</p>
                <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:32,fontWeight:900,marginBottom:8}}>NO TAILORS YET.</p>
                <p style={{color:"#888",marginBottom:24,fontSize:15}}>Be the first to list your tailoring services on Stitch'd!</p>
                {user&&<button className="hbtn" style={{...S.hBtn,background:"#00BFA5",border:"none",padding:"14px 32px",fontSize:14,letterSpacing:2}} onClick={()=>setShowTailorForm(true)}>LIST MY SERVICE →</button>}
              </div>
            ):(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:3}}>
                {tailorServices.filter(s=>{
                  const q=tailorSearch.toLowerCase();
                  const matchSearch=!q||s.title?.toLowerCase().includes(q)||s.description?.toLowerCase().includes(q)||s.location?.toLowerCase().includes(q);
                  const matchType=tailorTypeFilter==="All"||s.service_type===tailorTypeFilter;
                  return matchSearch&&matchType;
                }).map((s,idx)=>{
                  const accent=CARD_COLORS[idx%CARD_COLORS.length];
                  const tailorProf=tailorProfiles.find(p=>p.id===s.tailor_id);
                  return(
                    <div key={s.id} style={{background:"#fff",border:"3px solid #111",overflow:"hidden",display:"flex",flexDirection:"column"}}>
                      {/* Cover image */}
                      <div style={{height:200,background:s.images?.[0]?"#000":accent,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",position:"relative"}}>
                        {s.images?.[0]?<img src={s.images[0]} alt={s.title} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:72}}>✂️</span>}
                        <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.7))"}}/>
                        <div style={{position:"absolute",top:12,left:12,background:accent,color:"#fff",padding:"4px 12px",fontSize:10,fontWeight:800,letterSpacing:2,fontFamily:"'Barlow Condensed',sans-serif"}}>{s.service_type?.toUpperCase()}</div>
                        {s.location&&<div style={{position:"absolute",bottom:12,left:12,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,letterSpacing:1}}>📍 {s.location}</div>}
                        {s.turnaround_days&&<div style={{position:"absolute",bottom:12,right:12,background:"rgba(0,0,0,0.6)",color:"#fff",padding:"3px 10px",fontSize:10,fontWeight:800,letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif"}}>⏱ {s.turnaround_days} DAYS</div>}
                      </div>

                      {/* Tailor profile strip */}
                      {tailorProf&&(
                        <div style={{padding:"12px 16px",borderBottom:"2px solid #f0f0f0",display:"flex",alignItems:"center",gap:12,background:"#fafafa"}}>
                          <div style={{width:36,height:36,borderRadius:"50%",border:"2px solid #111",overflow:"hidden",flexShrink:0,background:accent,display:"flex",alignItems:"center",justifyContent:"center"}}>
                            {tailorProf.avatar_url?<img src={tailorProf.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900,color:"#fff"}}>{(tailorProf.full_name||tailorProf.username||"T")[0].toUpperCase()}</span>}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:900,color:"#111"}}>{tailorProf.full_name||tailorProf.username||"Tailor"}</p>
                            {tailorProf.bio&&<p style={{fontSize:11,color:"#888",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{tailorProf.bio}</p>}
                          </div>
                          {tailorProf.verified&&<span style={S.verifiedBadge}>✓</span>}
                        </div>
                      )}

                      {/* Service info */}
                      <div style={{padding:"16px 18px",flex:1,display:"flex",flexDirection:"column"}}>
                        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,marginBottom:6,color:"#111",lineHeight:1.1}}>{s.title}</p>
                        {s.description&&<p style={{fontSize:13,color:"#666",marginBottom:12,lineHeight:1.5,flex:1}}>{s.description.slice(0,120)}{s.description.length>120?"...":""}</p>}
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",borderTop:"2px solid #f5f5f5",paddingTop:12,marginTop:"auto"}}>
                          <div>
                            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900,color:accent}}>From {currencySymbol(profile?.currency||"GBP")}{s.price_from}</span>
                            {s.price_to&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,color:"#bbb",marginLeft:4}}>— {currencySymbol(profile?.currency||"GBP")}{s.price_to}</span>}
                          </div>
                          <button className="hbtn" style={{...S.hBtn,background:accent,border:"none",padding:"10px 20px",fontSize:12,letterSpacing:1}} onClick={()=>{setSelectedService(s);setShowBookingForm(true);}}>BOOK →</button>
                        </div>
                      </div>
                      <div style={{height:4,background:accent,width:"100%"}}/>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Booking modal */}
          {showBookingForm&&selectedService&&(
            <div style={S.modalOverlay} onClick={()=>setShowBookingForm(false)}>
              <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,paddingBottom:16,borderBottom:"3px solid #111"}}>
                  <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900}}>✂️ BOOK SERVICE</h3>
                  <button style={{background:"none",border:"none",fontSize:20,cursor:"pointer",fontWeight:900}} onClick={()=>setShowBookingForm(false)}>✕</button>
                </div>
                <div style={{background:"#fafafa",border:"2px solid #f0f0f0",padding:"16px",marginBottom:20,display:"flex",gap:14,alignItems:"flex-start"}}>
                  {selectedService.images?.[0]&&<img src={selectedService.images[0]} alt="" style={{width:64,height:64,objectFit:"cover",border:"2px solid #111",flexShrink:0}}/>}
                  <div>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:900,marginBottom:4}}>{selectedService.title}</p>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,color:"#00BFA5",letterSpacing:1}}>{selectedService.service_type?.toUpperCase()} · FROM {currencySymbol(profile?.currency||"GBP")}{selectedService.price_from}</p>
                    {selectedService.location&&<p style={{fontSize:12,color:"#888",marginTop:4}}>📍 {selectedService.location}</p>}
                    {selectedService.turnaround_days&&<p style={{fontSize:12,color:"#888"}}>⏱ {selectedService.turnaround_days} day turnaround</p>}
                  </div>
                </div>
                <div style={{marginBottom:20,padding:"14px 16px",background:"#fff8f0",border:"1.5px solid #00BFA555"}}>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:2,color:"#00BFA5",marginBottom:8}}>HOW IT WORKS</p>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {["Send booking request with your notes","Tailor responds via Stitch'd messages","Agree on final price and details","Pay securely through Stitch'd (10% fee)","Tailor completes your order 🩷"].map((s,i)=>(
                      <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:900,color:"#00BFA5",flexShrink:0}}>{i+1}.</span>
                        <span style={{fontSize:13,color:"#666"}}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <F l="NOTES FOR TAILOR (measurements, requirements, fabric, etc.)">
                  <textarea style={{...S.inp,height:110,resize:"vertical",width:"100%"}} placeholder="e.g. I need a lehenga blouse taken in by 2 inches at the waist. My measurements: bust 34, waist 28, hips 36. Fabric is heavy silk..." value={bookingNotes} onChange={e=>setBookingNotes(e.target.value)}/>
                </F>
                <button className="hbtn" style={{...S.hBtn,background:"#00BFA5",border:"none",width:"100%",padding:"16px",fontSize:15,letterSpacing:3,marginTop:16}} onClick={()=>bookTailor(selectedService)}>
                  SEND BOOKING REQUEST →
                </button>
                <p style={{fontSize:11,color:"#bbb",textAlign:"center",marginTop:10}}>🔒 Payment handled securely through Stitch'd · 10% platform fee</p>
              </div>
            </div>
          )}

          {/* Add/Edit service form modal */}
          {showTailorForm&&(
            <div style={S.modalOverlay} onClick={()=>setShowTailorForm(false)}>
              <div style={{...S.modalBox,maxWidth:580}} onClick={e=>e.stopPropagation()}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,paddingBottom:16,borderBottom:"3px solid #111"}}>
                  <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900}}>{editingService?"EDIT SERVICE":"LIST YOUR SERVICE ✂️"}</h3>
                  <button style={{background:"none",border:"none",fontSize:20,cursor:"pointer",fontWeight:900}} onClick={()=>setShowTailorForm(false)}>✕</button>
                </div>

                {/* Profile reminder */}
                {!profile?.avatar_url&&(
                  <div style={{background:"#fff8f0",border:"1.5px solid #00BFA555",padding:"12px 16px",marginBottom:20,display:"flex",gap:10,alignItems:"center"}}>
                    <span style={{fontSize:20}}>💡</span>
                    <div>
                      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:800,letterSpacing:1,color:"#00BFA5",marginBottom:2}}>ADD A PROFILE PHOTO</p>
                      <p style={{fontSize:12,color:"#888"}}>Buyers trust tailors with a photo. <span style={{color:"#FF1493",cursor:"pointer",fontWeight:700}} onClick={()=>{setShowTailorForm(false);setView("editprofile");}}>Update your profile →</span></p>
                    </div>
                  </div>
                )}

                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <F l="SERVICE TITLE *"><input style={S.inp} placeholder="e.g. Bridal Lehenga Alterations" value={tailorServiceForm.title} onChange={e=>setTailorServiceForm(f=>({...f,title:e.target.value}))}/></F>
                  <F l="SERVICE TYPE">
                    <select style={S.inp} value={tailorServiceForm.service_type} onChange={e=>setTailorServiceForm(f=>({...f,service_type:e.target.value}))}>
                      {["Alterations","Taking In","Letting Out","Hemming","Blouse Stitching","Full Stitching","Custom Stitching","Embroidery","Repairs","Custom Orders"].map(t=><option key={t}>{t}</option>)}
                    </select>
                  </F>
                  <F l="DESCRIPTION (your experience, specialties, what's included)">
                    <textarea style={{...S.inp,height:90,resize:"vertical",width:"100%"}} placeholder="e.g. 10+ years experience stitching bridal wear. Specialise in heavy fabrics — silk, banarsi, velvet. All work done by hand..." value={tailorServiceForm.description} onChange={e=>setTailorServiceForm(f=>({...f,description:e.target.value}))}/>
                  </F>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    <F l="PRICE FROM *"><input style={S.inp} type="number" placeholder="e.g. 15" value={tailorServiceForm.price_from} onChange={e=>setTailorServiceForm(f=>({...f,price_from:e.target.value}))}/></F>
                    <F l="PRICE TO (optional)"><input style={S.inp} type="number" placeholder="e.g. 80" value={tailorServiceForm.price_to} onChange={e=>setTailorServiceForm(f=>({...f,price_to:e.target.value}))}/></F>
                  </div>
                  <F l="TURNAROUND TIME (DAYS)"><input style={S.inp} type="number" placeholder="e.g. 7" value={tailorServiceForm.turnaround_days} onChange={e=>setTailorServiceForm(f=>({...f,turnaround_days:e.target.value}))}/></F>
                  <F l="YOUR LOCATION"><input style={S.inp} placeholder="e.g. East London, UK" value={tailorServiceForm.location} onChange={e=>setTailorServiceForm(f=>({...f,location:e.target.value}))}/></F>
                  <F l="PHOTOS OF YOUR WORK (UP TO 3)">
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {(tailorServiceForm.imagePreviews||[]).map((src,i)=>(
                        <div key={i} style={{width:90,height:90,border:"2px solid #e0e0e0",overflow:"hidden",position:"relative"}}>
                          <img src={src} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                          <button type="button" style={{...S.removeImg}} onClick={()=>setTailorServiceForm(f=>({...f,images:f.images.filter((_,j)=>j!==i),imagePreviews:f.imagePreviews.filter((_,j)=>j!==i)}))}>✕</button>
                        </div>
                      ))}
                      {(tailorServiceForm.imagePreviews||[]).length<3&&(
                        <div style={{width:90,height:90,border:"3px dashed #e0e0e0",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexDirection:"column",gap:4}} onClick={()=>document.getElementById("tailor-img-input").click()}>
                          <span style={{fontSize:24}}>📸</span>
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,color:"#bbb",letterSpacing:1}}>ADD PHOTO</span>
                        </div>
                      )}
                    </div>
                    <input id="tailor-img-input" type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>{const files=Array.from(e.target.files).slice(0,3-(tailorServiceForm.imagePreviews||[]).length);const previews=files.map(f=>URL.createObjectURL(f));setTailorServiceForm(f=>({...f,images:[...(f.images||[]),...files],imagePreviews:[...(f.imagePreviews||[]),...previews]}));}}/>
                    <p style={{fontSize:11,color:"#bbb",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1,marginTop:6}}>SHOW OFF YOUR BEST WORK — BEFORE/AFTER PHOTOS WORK GREAT</p>
                  </F>
                </div>
                <button className="hbtn" style={{...S.hBtn,background:"#00BFA5",border:"none",width:"100%",padding:"16px",fontSize:15,letterSpacing:3,marginTop:20,opacity:(!tailorServiceForm.title||!tailorServiceForm.price_from)?0.4:1}} onClick={saveTailorService} disabled={!tailorServiceForm.title||!tailorServiceForm.price_from}>
                  {editingService?"SAVE CHANGES →":"LIST SERVICE →"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

            {/* ── MEASURING GUIDE ── */}
      {view==="measuring"&&(
        <main style={{...S.main,maxWidth:900}}>
          <button style={S.back} onClick={()=>setView(prevView||"shop")}>← BACK</button>
          <div style={{marginBottom:36,paddingBottom:24,borderBottom:"3px solid #111"}}>
            <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:4,color:"#FF1493",marginBottom:6}}>YOUR COMPLETE GUIDE</p>
            <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:56,fontWeight:900,letterSpacing:-1,lineHeight:1,marginBottom:12}}>HOW TO<br/><span style={{color:"#FF1493"}}>MEASURE.</span></h1>
            <p style={{fontSize:15,color:"#666",lineHeight:1.7,maxWidth:560}}>Accurate measurements mean happier buyers and fewer returns. Use a soft measuring tape, stand straight and measure over fitted underwear or a thin layer.</p>
          </div>

          {/* Body diagram + measurements */}
          <div style={{display:"flex",gap:32,flexWrap:"wrap",marginBottom:48}}>
            {/* SVG body diagram */}
            <div style={{flex:"0 0 280px",position:"sticky",top:80,alignSelf:"flex-start"}}>
              <svg viewBox="0 0 280 520" style={{width:"100%",maxWidth:280}} xmlns="http://www.w3.org/2000/svg">
                <ellipse cx="140" cy="52" rx="32" ry="38" fill="#FFE4EF" stroke="#111" strokeWidth="2"/>
                <rect x="126" y="86" width="28" height="18" fill="#FFE4EF" stroke="#111" strokeWidth="2"/>
                <path d="M60,104 Q80,96 126,104 L130,130 L80,134 Q60,132 55,120 Z" fill="#FFE4EF" stroke="#111" strokeWidth="2"/>
                <path d="M220,104 Q200,96 154,104 L150,130 L200,134 Q220,132 225,120 Z" fill="#FFE4EF" stroke="#111" strokeWidth="2"/>
                <path d="M80,134 Q70,160 72,200 Q74,240 78,270 L202,270 Q206,240 208,200 Q210,160 200,134 Z" fill="#FFE4EF" stroke="#111" strokeWidth="2"/>
                <path d="M55,120 Q44,150 46,200 Q47,220 54,230 Q60,238 68,230 Q76,222 74,200 Q72,160 80,134 Z" fill="#FFE4EF" stroke="#111" strokeWidth="2"/>
                <path d="M225,120 Q236,150 234,200 Q233,220 226,230 Q220,238 212,230 Q204,222 206,200 Q208,160 200,134 Z" fill="#FFE4EF" stroke="#111" strokeWidth="2"/>
                <path d="M78,270 Q72,290 70,320 L88,320 L100,460 L180,460 L192,320 L210,320 Q208,290 202,270 Z" fill="#FFE4EF" stroke="#111" strokeWidth="2"/>
                <ellipse cx="110" cy="468" rx="18" ry="8" fill="#FFE4EF" stroke="#111" strokeWidth="2"/>
                <ellipse cx="170" cy="468" rx="18" ry="8" fill="#FFE4EF" stroke="#111" strokeWidth="2"/>
                <line x1="58" y1="152" x2="222" y2="152" stroke="#FF1493" strokeWidth="2" strokeDasharray="5,3"/>
                <circle cx="50" cy="152" r="10" fill="#FF1493"/>
                <text x="50" y="156" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold">B</text>
                <line x1="62" y1="168" x2="218" y2="168" stroke="#FF2D55" strokeWidth="1.5" strokeDasharray="4,3"/>
                <circle cx="54" cy="168" r="9" fill="#FF2D55"/>
                <text x="54" y="172" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold">UB</text>
                <line x1="62" y1="104" x2="218" y2="104" stroke="#007AFF" strokeWidth="2" strokeDasharray="5,3"/>
                <circle cx="54" cy="104" r="9" fill="#007AFF"/>
                <text x="54" y="108" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold">SH</text>
                <line x1="60" y1="210" x2="220" y2="210" stroke="#FF9500" strokeWidth="2" strokeDasharray="5,3"/>
                <circle cx="52" cy="210" r="10" fill="#FF9500"/>
                <text x="52" y="214" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold">W</text>
                <line x1="58" y1="238" x2="222" y2="238" stroke="#FF6B00" strokeWidth="1.5" strokeDasharray="4,3"/>
                <circle cx="50" cy="238" r="9" fill="#FF6B00"/>
                <text x="50" y="242" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold">HH</text>
                <line x1="55" y1="262" x2="225" y2="262" stroke="#BF5AF2" strokeWidth="2" strokeDasharray="5,3"/>
                <circle cx="47" cy="262" r="10" fill="#BF5AF2"/>
                <text x="47" y="266" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold">H</text>
                <line x1="240" y1="104" x2="240" y2="460" stroke="#34C759" strokeWidth="2"/>
                <path d="M236,108 L240,100 L244,108" fill="#34C759"/>
                <path d="M236,456 L240,464 L244,456" fill="#34C759"/>
                <text x="258" y="290" fill="#34C759" fontSize="9" fontWeight="bold" transform="rotate(90,258,290)">LENGTH</text>
                <line x1="46" y1="120" x2="46" y2="228" stroke="#8E8E93" strokeWidth="1.5"/>
                <path d="M42,124 L46,116 L50,124" fill="#8E8E93"/>
                <path d="M42,224 L46,232 L50,224" fill="#8E8E93"/>
              </svg>

              {/* Legend */}
              <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:12,padding:"12px",background:"#fafafa",border:"2px solid #f0f0f0"}}>
                {[["#FF1493","B","Bust"],["#FF2D55","UB","Underbust"],["#007AFF","SH","Shoulder"],["#FF9500","W","Waist"],["#FF6B00","HH","High Hip"],["#BF5AF2","H","Hips"],["#34C759","↕","Length"],["#8E8E93","↕","Sleeve"]].map(([c,code,label])=>(
                  <div key={label} style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:20,height:20,borderRadius:"50%",background:c,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{color:"#fff",fontSize:8,fontWeight:900}}>{code}</span>
                    </div>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,color:"#555"}}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Measurement cards */}
            <div style={{flex:1,minWidth:260,display:"flex",flexDirection:"column",gap:16}}>
              {[
                {label:"BUST",code:"B",color:"#FF1493",icon:"👙",
                  how:"Measure around the fullest part of your chest, keeping the tape parallel to the floor. Don't pull tight.",
                  tip:"Wear a well-fitted bra. Keep two fingers under the tape for ease."},
                {label:"UNDERBUST",code:"UB",color:"#FF2D55",icon:"📏",
                  how:"Measure directly under your bust, around your ribcage. Keep the tape snug.",
                  tip:"This is key for blouse fitting. The difference between bust and underbust determines your cup size."},
                {label:"SHOULDER WIDTH",code:"SH",color:"#007AFF",icon:"↔️",
                  how:"Measure from the edge of one shoulder to the edge of the other, across the back.",
                  tip:"Critical for kameez and blouse sleeves. Ask someone to help for accuracy."},
                {label:"WAIST",code:"W",color:"#FF9500",icon:"⌀",
                  how:"Find the narrowest part of your torso (about 1 inch above belly button). Exhale naturally, then measure.",
                  tip:"Don't suck in or hold your breath — measure at your natural relaxed waist."},
                {label:"HIGH HIP",code:"HH",color:"#FF6B00",icon:"📐",
                  how:"Measure about 3–4 inches below your natural waist, around the upper hip/lower abdomen.",
                  tip:"This measurement matters for lehengas and salwars that sit at the high hip."},
                {label:"HIPS",code:"H",color:"#BF5AF2",icon:"🔵",
                  how:"Stand with feet together. Measure around the fullest part of your hips and bottom — usually 7–9 inches below your waist.",
                  tip:"This is often the largest measurement. Make sure the tape is parallel to the floor."},
                {label:"GARMENT LENGTH",code:"↕",color:"#34C759",icon:"📏",
                  how:"For tops/kameez: from highest point of shoulder straight down to desired hem. For lehengas: from natural waist to hem. For sarees: full fabric length.",
                  tip:"Always specify what the length refers to — shoulder to hem, or waist to hem."},
                {label:"SLEEVE LENGTH",code:"SL",color:"#8E8E93",icon:"💪",
                  how:"From the top of the shoulder seam down to where you want the sleeve to end. Slightly bend your elbow while measuring.",
                  tip:"For South Asian wear, 3/4 sleeves (around 16-18 inches) are most common for blouses."},
                {label:"INSEAM",code:"IN",color:"#0A84FF",icon:"👖",
                  how:"For churidars/salwars: from the crotch down to the ankle bone. Measure against trousers you already own.",
                  tip:"Churidars are intentionally longer than the inseam to create the gathered effect at the ankle."},
              ].map(({label,code,color,icon,how,tip})=>(
                <div key={label} style={{border:`2px solid ${color}`,padding:"18px 20px",background:"#fff"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                    <div style={{width:36,height:36,borderRadius:"50%",background:color,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{color:"#fff",fontSize:12,fontWeight:900,fontFamily:"'Barlow Condensed',sans-serif"}}>{code}</span>
                    </div>
                    <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:900,color:"#111"}}>{label}</h3>
                  </div>
                  <p style={{fontSize:13,color:"#555",lineHeight:1.6,marginBottom:8}}>{how}</p>
                  <div style={{background:`${color}11`,border:`1px solid ${color}33`,padding:"8px 12px",display:"flex",gap:8,alignItems:"flex-start"}}>
                    <span style={{color,fontWeight:900,fontSize:12,flexShrink:0}}>💡</span>
                    <p style={{fontSize:12,color:"#666",lineHeight:1.5}}>{tip}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Size chart table — Lashkaraa style */}
          <div style={{marginBottom:40}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #FF1493",paddingLeft:12,marginBottom:16}}>SOUTH ASIAN SIZE CHART (INCHES)</div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13}}>
                <thead>
                  <tr style={{background:"#111",color:"#fff"}}>
                    {["SIZE","BUST","UNDERBUST","WAIST","HIGH HIP","HIPS","UK","US/CA","EU"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:800,letterSpacing:1.5,fontSize:11,whiteSpace:"nowrap"}}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["XXS","30–31","24–25","24–25","28–29","32–33","4–6","0–2","32–34"],
                    ["XS","32–33","26–27","26–27","30–31","34–35","6–8","2–4","34–36"],
                    ["S","34–35","28–29","28–29","32–33","36–37","8–10","4–6","36–38"],
                    ["M","36–37","30–31","30–31","34–35","38–39","10–12","6–8","38–40"],
                    ["L","38–39","32–33","32–33","36–37","40–41","12–14","8–10","40–42"],
                    ["XL","40–41","34–35","34–35","38–39","42–43","14–16","10–12","42–44"],
                    ["XXL","42–43","36–37","36–37","40–41","44–45","16–18","12–14","44–46"],
                    ["3XL","44–46","38–40","38–40","42–44","46–48","18–20","14–16","46–48"],
                    ["4XL","48–50","42–44","42–44","46–48","50–52","20–22","16–18","48–50"],
                  ].map(([sz,...vals],i)=>(
                    <tr key={sz} style={{background:i%2===0?"#fafafa":"#fff",borderBottom:"1px solid #f0f0f0"}}>
                      <td style={{padding:"10px 14px",fontWeight:900,color:"#FF1493",fontSize:15}}>{sz}</td>
                      {vals.map((v,j)=><td key={j} style={{padding:"10px 14px",color:"#555",whiteSpace:"nowrap"}}>{v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{fontSize:12,color:"#888",marginTop:10,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>* ALL MEASUREMENTS ARE BODY MEASUREMENTS IN INCHES. ADD 1-2in FOR GARMENT EASE.</p>
          </div>

          {/* Pro tips */}
          <div style={{background:"#111",color:"#fff",padding:"28px",border:"3px solid #111",marginBottom:32}}>
            <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#FF1493",marginBottom:16}}>💡 PRO TIPS FOR SOUTH ASIAN WEAR</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
              {[
                "Always measure over the clothes you'd normally wear underneath",
                "Add 1-2 inches ease to your measurements for comfort in fitted pieces",
                "For heavily embroidered pieces, go 1 size up — the embroidery reduces stretch",
                "Blouse measurements matter most: bust, underbust and shoulder width",
                "Churidar length should be 3-4 inches longer than your actual inseam",
                "If the listing has spare fabric, it can often be let out by 1-2 inches",
                "When in doubt between two sizes, always size up for South Asian wear",
                "Custom stitched items use your exact measurements — always measure fresh",
              ].map((t,i)=>(
                <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                  <span style={{color:"#FF1493",fontWeight:900,flexShrink:0,fontSize:14}}>✦</span>
                  <span style={{fontSize:13,color:"#ccc",lineHeight:1.6}}>{t}</span>
                </div>
              ))}
            </div>
          </div>

          <button className="hbtn" style={{...S.hBtn,background:"#FF1493",border:"none",padding:"16px 32px",fontSize:15,letterSpacing:3,width:"100%"}} onClick={()=>{setPrevView("measuring");setView(user?"add":"auth");}}>
            LIST A PIECE NOW →
          </button>
        </main>
      )}

            {view==="shop"&&(
        <>
          <section style={S.hero}>
            <div style={S.heroLeft}>
              <p style={S.heroTag}>THE MARKETPLACE FOR</p>
              <h1 style={S.heroH}><span style={S.heroLine1}>DESI</span><span style={S.heroLine2}>FITS</span><span style={S.heroLine3}>REHOMED.</span></h1>
              <p style={S.heroSub}>South Asian fashion — sarees, lehengas, sherwanis — with <em>real measurements</em> so you know if it fits before you buy.</p>
              <div style={S.heroCtas}>
                <button className="hbtn" style={S.heroBtnPrimary} onClick={()=>user?setView("add"):(setAuthMode("signup"),setView("auth"))}>LIST YOUR PIECE →</button>
                <button className="hbtn" style={S.heroBtnSecondary} onClick={()=>document.getElementById("grid-anchor")?.scrollIntoView({behavior:"smooth"})}>BROWSE DROPS ↓</button>
              </div>
            </div>
            <div style={S.heroRight}>
              {["🥻","👘","👗","🧥","💍"].map((e,i)=>(
                <div key={i} style={{...S.heroBubble,background:CARD_COLORS[i],top:`${[8,30,55,15,68][i]}%`,left:`${[10,60,20,75,50][i]}%`,width:[100,80,120,70,90][i],height:[100,80,120,70,90][i],animationDelay:`${i*0.6}s`}}>
                  <span style={{fontSize:[44,36,52,30,40][i]}}>{e}</span>
                </div>
              ))}
            </div>
          </section>

          {/* SEARCH BAR */}
          <div style={S.searchBar} id="grid-anchor">
            <div style={S.searchInner}>
              <div style={S.searchBox}>
                <span style={S.searchIcon}>🔍</span>
                <input style={S.searchInput} placeholder="SEARCH SAREES, SILK, WEDDING..." value={search} onChange={e=>setSearch(e.target.value)}/>
                {search&&<button style={S.searchClear} onClick={()=>setSearch("")}>✕</button>}
              </div>
              <button className="hbtn" style={{...S.filterBtn,background:showFilters?"#FF1493":"#fff",color:showFilters?"#fff":"#111"}} onClick={()=>setShowFilters(f=>!f)}>
                FILTERS {hasFilters?"●":""}
              </button>
              {user&&profile?.bust&&<button className="hbtn" style={{...S.filterBtn,background:showSizeMatch?"#34C759":"#fff",color:showSizeMatch?"#fff":"#111"}} onClick={()=>setShowSizeMatch(f=>!f)}>
                📐 FIT
              </button>}
              <button className="hbtn" style={{...S.filterBtn,background:"#fff",color:"#111"}} onClick={()=>{loadTailorMarket();setView("tailors");}}>
                ✂️ TAILORS
              </button>
            </div>
            {showFilters&&(
              <div style={S.filterPanel}>
                <div style={S.filterGroup}><div style={S.filterLabel}>TYPE</div><div style={S.filterPills}>{["All","Clothing","Jewellery","Shoes"].map(t=><button key={t} className="fpill" onClick={()=>setTypeFilter(t)} style={{...S.pill,...(typeFilter===t?S.pillOn:{})}}>{t==="All"?"All":t==="Clothing"?"👗 Clothing":t==="Jewellery"?"💎 Jewellery":"👟 Shoes"}</button>)}</div></div>
                <div style={S.filterGroup}><div style={S.filterLabel}>CATEGORY</div><div style={S.filterPills}>{["All",...(typeFilter==="Jewellery"?JEWELLERY_CATS:typeFilter==="Shoes"?SHOE_CATS:typeFilter==="Clothing"?CATEGORIES:ALL_CATEGORIES)].map(c=><button key={c} className="fpill" onClick={()=>setCatFilter(c)} style={{...S.pill,...(catFilter===c?S.pillOn:{})}}>{c}</button>)}</div></div>
                <div style={S.filterGroup}><div style={S.filterLabel}>SIZE</div><div style={S.filterPills}>{["All",...SIZES].map(sz=><button key={sz} className="fpill" onClick={()=>setSizeFilter(sz)} style={{...S.pill,...(sizeFilter===sz?S.pillOn:{})}}>{sz}</button>)}</div></div>
                <div style={S.filterGroup}>
                  <div style={S.filterLabel}>PRICE RANGE (USD)</div>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <input style={{...S.inp,width:100}} type="number" placeholder="MIN" value={minPrice} onChange={e=>setMinPrice(e.target.value)}/>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,color:"#bbb"}}>—</span>
                    <input style={{...S.inp,width:100}} type="number" placeholder="MAX" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)}/>
                    {hasFilters&&<button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#FF1493",border:"2px solid #FF1493",fontSize:11,padding:"8px 14px"}} onClick={clearFilters}>CLEAR ALL</button>}
                  </div>
                </div>
              </div>
            )}
          </div>
          {hasFilters&&<div style={{padding:"12px 24px",fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,letterSpacing:2,color:"#bbb",borderBottom:"1px solid #f0f0f0"}}>{visible.length} RESULT{visible.length!==1?"S":""}{search?` FOR "${search.toUpperCase()}"`:""}  <span style={{color:"#FF1493",cursor:"pointer",marginLeft:12}} onClick={clearFilters}>CLEAR</span></div>}

          <div style={S.gridWrap}>
            {loading&&(
            <div style={S.grid}>
              {Array(8).fill(0).map((_,i)=>(
                <div key={i} style={{...S.card,borderColor:"#f0f0f0"}}>
                  <div style={{height:200,background:"linear-gradient(90deg,#f5f5f5 25%,#ececec 50%,#f5f5f5 75%)",backgroundSize:"200% 100%",animation:"shimmer 1.4s infinite"}}/>
                  <div style={{padding:"16px 18px",background:"#fff"}}>
                    <div style={{height:10,background:"#f0f0f0",borderRadius:2,marginBottom:8,width:"40%"}}/>
                    <div style={{height:16,background:"#f0f0f0",borderRadius:2,marginBottom:8,width:"80%"}}/>
                    <div style={{height:12,background:"#f0f0f0",borderRadius:2,marginBottom:12,width:"60%"}}/>
                    <div style={{height:20,background:"#f0f0f0",borderRadius:2,width:"30%"}}/>
                  </div>
                </div>
              ))}
            </div>
          )}
            {error&&<div style={S.errorBanner}>{error}<button style={S.retryBtn} onClick={fetchItems}>RETRY</button></div>}
            {!loading&&!error&&(
              <div style={S.grid}>
                {visible.map((item,idx)=>{
                  const accent=CARD_COLORS[idx%CARD_COLORS.length];
                  return(
                    <article key={item.id} className="scard" style={{...S.card,borderColor:accent,opacity:item.sold?0.55:1}} onClick={()=>openDetail(item)}>
                      <div style={{...S.cardTop,background:item.image_url?"#000":accent,overflow:"hidden"}}>
                        {item.image_url?<img src={item.image_url} alt={item.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={S.cardEmoji}>{item.emoji||catEmoji(item.category)}</span>}
                        {item.image_url&&<div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 50%,rgba(0,0,0,0.45))"}}/>}
                        {item.sold&&<div style={S.soldVeil}><span style={S.soldStamp}>SOLD</span></div>}
                        {item.payment_status==="paid"&&!item.sold&&<div style={{...S.reservedBadge,background:"#34C759"}}>PAID</div>}
                        {item.reserved&&!item.sold&&<div style={S.reservedBadge}>RESERVED</div>}
                        {fitsMe(item)===true&&<div style={S.fitsBadge}>📐 FITS YOU</div>}
                        <button style={{...S.heartBtn,background:wishlist.includes(item.id)?"#FF1493":"rgba(255,255,255,0.85)"}} onClick={e=>{e.stopPropagation();toggleWishlist(item.id);}}>{wishlist.includes(item.id)?"❤️":"🤍"}</button>
                        <div style={S.cardOrigin}>{item.origin?.toUpperCase()}</div>
                        <div style={S.cardOccDots}>{(item.occasions||[]).slice(0,4).map(o=><div key={o} style={{...S.occDot,background:"rgba(255,255,255,0.9)"}} title={o}/>)}</div>
                        {(item.images||[]).length>1&&<div style={S.multiImgBadge}>+{item.images.length}</div>}
                      </div>
                      <div style={S.cardBody}>
                        <p style={{...S.cardCatLabel,color:accent}}>{item.category?.toUpperCase()} · {(item.material||item.fabric)?.toUpperCase()}</p>
                        <p style={S.cardName}>{item.name}</p>
                        {(item.occasions||[]).length>0&&<div style={S.occRow}>{item.occasions.slice(0,3).map(o=><span key={o} style={{...S.occChip,background:OCC_COLOR[o]||"#999",color:"#fff"}}>{o.toUpperCase()}</span>)}{item.occasions.length>3&&<span style={{...S.occChip,background:"#111",color:"#fff"}}>+{item.occasions.length-3}</span>}</div>}
                        <div style={S.measRow}>
                          {item.size&&item.size!=="Free Size"&&<span style={S.mTag}>{item.size}</span>}
                          {item.bust&&<span style={S.mTag}>B {item.bust}in</span>}
                          {item.waist&&<span style={S.mTag}>W {item.waist}in</span>}
                          {item.can_take_in&&<span style={{...S.mTag,...S.mTagG}}>↔ TAKE IN</span>}
                          {item.spare_fabric&&<span style={{...S.mTag,...S.mTagA}}>+ FABRIC</span>}
                        </div>
                        <div style={S.cardFoot}>
                          <span style={{...S.cardPrice,color:accent}}>{currencySymbol(item.currency)}{item.price}</span>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            {item.views>0&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#bbb",letterSpacing:1}}>👁 {item.views}</span>}
                            {item.whatsapp&&!item.sold&&<a href={waLink(item.whatsapp,item.name,item.price)} target="_blank" rel="noreferrer" style={{...S.waSmall,background:accent}} onClick={e=>e.stopPropagation()}>💬</a>}
                          </div>
                        </div>
                      </div>
                      <div style={{...S.accentBar,background:accent}}/>
                    </article>
                  );
                })}
                {visible.length===0&&(
                  <div style={S.empty}>
                    <p style={{fontSize:60}}>{hasFilters?"🔍":"🥻"}</p>
                    <p style={{fontSize:28,fontWeight:900,margin:"12px 0 6px",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>{hasFilters?"NO RESULTS.":"NOTHING HERE YET."}</p>
                    <p style={{color:"#888",marginBottom:20}}>{hasFilters?"Try different filters.":"Be the first to drop a piece."}</p>
                    {hasFilters?<button className="hbtn" style={S.hBtn} onClick={clearFilters}>CLEAR FILTERS</button>:<button className="hbtn" style={S.hBtn} onClick={()=>user?setView("add"):(setAuthMode("signup"),setView("auth"))}>LIST IT →</button>}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── DETAIL ── */}
      {view==="detail"&&sel&&(
        <main style={S.main}>
          <button style={S.back} onClick={()=>setView("shop")}>← BACK</button>
          <div style={S.detailWrap}>
            {/* Image gallery */}
            <div style={S.detailImgWrap}>
              <div style={{...S.detailPanel,background:selImages.length>0?"#000":selColor,overflow:"hidden"}}>
                {selImages.length>0?<img src={selImages[selImgIdx]} alt={sel.name} style={{width:"100%",height:"100%",objectFit:"cover",opacity:0.92}}/>:<span style={{fontSize:120,filter:"drop-shadow(0 8px 24px rgba(0,0,0,0.25))"}}>{sel.emoji||catEmoji(sel.category)}</span>}
                <div style={{...S.cardOrigin,top:20,left:20,bottom:"auto",right:"auto",background:"rgba(0,0,0,0.3)"}}>{sel.origin?.toUpperCase()}</div>
                {sel.sold&&<div style={S.soldVeil}><span style={S.soldStamp}>SOLD</span></div>}
                {sel.reserved&&!sel.sold&&<div style={S.reservedBadge}>RESERVED</div>}
                {selImages.length>1&&(
                  <>
                    <button style={{...S.imgNav,left:12}} onClick={()=>setSelImgIdx(i=>(i-1+selImages.length)%selImages.length)}>‹</button>
                    <button style={{...S.imgNav,right:12}} onClick={()=>setSelImgIdx(i=>(i+1)%selImages.length)}>›</button>
                  </>
                )}
              </div>
              {selImages.length>1&&(
                <div style={S.thumbRow}>
                  {selImages.map((img,i)=>(
                    <div key={i} style={{...S.thumb,borderColor:i===selImgIdx?selColor:"#eee"}} onClick={()=>setSelImgIdx(i)}>
                      <img src={img} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={S.detailInfo}>
              <p style={{...S.cardCatLabel,color:selColor,fontSize:12,marginBottom:8}}>{sel.category?.toUpperCase()} · {(sel.material||sel.fabric)?.toUpperCase()} · {sel.condition?.toUpperCase()}</p>
              <h2 style={S.detailName}>{sel.name}</h2>
              <div style={{...S.detailPrice,color:selColor}}>{currencySymbol(sel.currency)}{sel.price}</div>
              {/* Action row — heart, share, size guide */}
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
                <button className="hbtn" style={{...S.hBtn,background:wishlist.includes(sel.id)?"#FF1493":"#fff",color:wishlist.includes(sel.id)?"#fff":"#111",border:"2px solid #111",fontSize:13,padding:"8px 16px"}} onClick={()=>toggleWishlist(sel.id)}>
                  {wishlist.includes(sel.id)?"❤️ SAVED":"🤍 SAVE"}
                </button>
                <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111",fontSize:13,padding:"8px 16px"}} onClick={()=>shareItem(sel)}>
                  🔗 SHARE
                </button>
                <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111",fontSize:13,padding:"8px 16px"}} onClick={()=>setShowSizeGuide(true)}>
                  📏 SIZE GUIDE
                </button>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20,flexWrap:"wrap"}}>
                {sel.views>0&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:"#bbb",letterSpacing:1}}>👁 {sel.views} VIEWS</span>}
                {reviews.length>0&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:"#FF9500",letterSpacing:1}}>⭐ {(reviews.reduce((a,r)=>a+r.rating,0)/reviews.length).toFixed(1)} ({reviews.length} reviews)</span>}
                {sel.user_id&&(
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:selColor,letterSpacing:1,cursor:"pointer",textDecoration:"underline"}} onClick={()=>openProfile(sel.user_id)}>
                    VIEW SELLER {viewedProfile&&getSellerTier(viewedProfile)?getSellerTier(viewedProfile).label:""} →
                  </span>
                )}
              </div>

              {(sel.occasions||[]).length>0&&(
                <div style={S.dBlock}><p style={{...S.dBlockTitle,borderColor:selColor,color:selColor}}>OCCASIONS</p><div style={S.occRow}>{sel.occasions.map(o=><span key={o} style={{...S.occChip,background:OCC_COLOR[o]||"#999",color:"#fff"}}>{o.toUpperCase()}</span>)}</div></div>
              )}

              {sel.listing_type!=="Jewellery"&&(sel.bust||sel.waist||sel.hips||sel.length||sel.size||sel.measurement_notes)&&(
              <div style={S.dBlock}>
                <p style={{...S.dBlockTitle,borderColor:selColor,color:selColor}}>MEASUREMENTS</p>
                <div style={S.measBoxRow}>
                  {[["BUST",sel.bust],["WAIST",sel.waist],["HIPS",sel.hips],["LENGTH",sel.length],["UNDERBUST",sel.underbust],["SHOULDER",sel.shoulder],["HIGH HIP",sel.high_hip],["SLEEVE",sel.sleeve_length],["INSEAM",sel.inseam]].filter(([,v])=>v).map(([l,v])=>(
                    <div key={l} style={{...S.measBox,borderColor:selColor}}><div style={{...S.measVal,color:selColor}}>{v}in</div><div style={S.measLbl}>{l}</div></div>
                  ))}
                </div>
                {sel.size&&<p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,letterSpacing:1,color:"#888",marginBottom:10}}>SIZE: {sel.size}</p>}
                {sel.measurement_notes&&<p style={S.measNote}>📌 {sel.measurement_notes}</p>}
                <div style={S.alterRow}>
                  <div style={{...S.alterBadge,...(sel.can_take_in?S.aY:S.aN)}}>{sel.can_take_in?"✓ CAN BE TAKEN IN":"✗ CANNOT TAKE IN"}</div>
                  <div style={{...S.alterBadge,...(sel.spare_fabric?S.aY2:S.aN)}}>{sel.spare_fabric?"✓ SPARE FABRIC INCLUDED":"✗ NO SPARE FABRIC"}</div>
                </div>
              </div>
              )}

              {sel.description&&<p style={S.detailDesc}>{sel.description}</p>}

              {/* Postage options on detail page */}
              {((sel.postage_options||[]).length>0||sel.accepts_collection)&&(
                <div style={S.dBlock}>
                  <p style={{...S.dBlockTitle,borderColor:"#007AFF",color:"#007AFF"}}>📦 POSTAGE OPTIONS</p>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {(sel.postage_options||[]).map(p=>(
                      <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"#fafafa",border:"1.5px solid #f0f0f0"}}>
                        <span style={{fontSize:18}}>{p.emoji}</span>
                        <div style={{flex:1}}>
                          <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:800}}>{p.name}</p>
                          <p style={{fontSize:12,color:"#888"}}>{p.selectedPrice?.label}</p>
                        </div>
                        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900,color:"#007AFF"}}>£{p.selectedPrice?.price}</span>
                      </div>
                    ))}
                    {sel.accepts_collection&&(
                      <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"#f0fff4",border:"1.5px solid #34C75944"}}>
                        <span style={{fontSize:18}}>🤝</span>
                        <div style={{flex:1}}>
                          <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:800}}>Collection in Person</p>
                          <p style={{fontSize:12,color:"#888"}}>Arrange with seller directly</p>
                        </div>
                        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900,color:"#34C759"}}>FREE</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {sel.whatsapp&&!sel.sold&&<a className="hbtn" href={waLink(sel.whatsapp,sel.name,sel.price)} target="_blank" rel="noreferrer" style={{...S.waCta,background:"#25D366",display:"inline-flex",alignItems:"center",gap:10,textDecoration:"none"}}>💬 WHATSAPP SELLER</a>}
              {!isOwner(sel)&&!sel.sold&&<button className="hbtn" style={{...S.waCta,background:"#FF1493",border:"none",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:10,marginLeft:sel.whatsapp?10:0}} onClick={()=>startConversation(sel)}>✉️ MESSAGE SELLER</button>}
              {!isOwner(sel)&&!sel.sold&&(
                <div style={{marginTop:16,marginBottom:8}}>
                  <button className="hbtn"
                    style={{...S.hBtn,background:"#111",border:"none",padding:"16px 32px",fontSize:16,letterSpacing:2,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:12}}
                    onClick={()=>{ if(!user){setAuthMode("login");setView("auth");return;} setPaymentListing(sel); setPaymentStep("summary"); setSelectedPostage(null); setShowPayment(true); }}>
                    💳 BUY NOW · {currencySymbol(sel.currency)}{sel.price}
                  </button>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#bbb",letterSpacing:1.5,textAlign:"center",marginTop:8}}>🔒 SECURE CHECKOUT · 5% PLATFORM FEE APPLIES</p>
                </div>
              )}
              {sel.payment_status==="paid"&&<div style={{...S.alterBadge,...S.aY,marginBottom:16,display:"inline-block"}}>✓ PAYMENT RECEIVED</div>}

              {/* Report + Review buttons for non-owners */}
              {!isOwner(sel)&&(
                <div style={{display:"flex",gap:10,marginBottom:24,flexWrap:"wrap"}}>
                  {user&&sel.user_id!==user?.id&&(
                    <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#FF9500",border:"2px solid #FF9500",fontSize:11,padding:"8px 14px"}} onClick={()=>setShowReview(true)}>
                      ⭐ LEAVE A REVIEW
                    </button>
                  )}
                  <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#888",border:"2px solid #e0e0e0",fontSize:11,padding:"8px 14px"}} onClick={()=>user?setShowReport(true):(setAuthMode("login"),setView("auth"))}>
                    🚩 REPORT
                  </button>
                </div>
              )}

              {/* Reviews */}
              {reviews.length>0&&(
                <div style={S.dBlock}>
                  <p style={{...S.dBlockTitle,borderColor:"#FF9500",color:"#FF9500"}}>SELLER REVIEWS ({reviews.length})</p>
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    {reviews.slice(0,3).map(r=>(
                      <div key={r.id} style={S.reviewCard}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                          <span style={{fontSize:14}}>{Array(r.rating).fill("⭐").join("")}</span>
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#bbb",letterSpacing:1}}>{new Date(r.created_at).toLocaleDateString("en-GB",{month:"short",year:"numeric"}).toUpperCase()}</span>
                        </div>
                        {r.comment&&<p style={{fontSize:13,color:"#666",lineHeight:1.5}}>{r.comment}</p>}
                      </div>
                    ))}
                    {reviews.length>3&&<p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:"#bbb",letterSpacing:1}}>{reviews.length-3} MORE REVIEWS ON SELLER PROFILE</p>}
                  </div>
                </div>
              )}

              {isOwner(sel)&&(
                <div style={S.actRow}>
                  <button className="hbtn" style={{...S.actBtn,background:selColor}} onClick={()=>openEdit(sel)}>EDIT</button>
                  {!sel.sold&&<button className="hbtn" style={{...S.actBtn,background:sel.reserved?"#FF9500":"#111"}} onClick={()=>markReserved(sel.id,sel.reserved)}>{sel.reserved?"UNRESERVE":"RESERVE"}</button>}
                  {!sel.sold&&<button className="hbtn" style={{...S.actBtn,background:"#111"}} onClick={()=>markSold(sel.id,sel.sold)}>MARK SOLD</button>}
                  {sel.sold&&<button className="hbtn" style={{...S.actBtn,background:"#34C759"}} onClick={()=>relist(sel.id)}>RELIST</button>}
                  <button className="hbtn" style={{...S.actBtn,background:"#fff",color:"#111",border:"2px solid #111"}} onClick={()=>del(sel.id)}>DELETE</button>
                </div>
              )}
              {!user&&<p style={{fontSize:12,color:"#bbb",marginTop:16,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}><span style={{cursor:"pointer",color:"#FF1493"}} onClick={()=>{setAuthMode("login");setView("auth");}}>SIGN IN</span> to manage your listings.</p>}
            </div>
          </div>

          {/* SIMILAR LISTINGS */}
          {similarItems.length>0&&(
            <div style={{marginTop:48}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #FF1493",paddingLeft:12,marginBottom:20}}>YOU MIGHT ALSO LIKE</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:3}}>
                {similarItems.map((item,idx)=>{
                  const accent=CARD_COLORS[idx%CARD_COLORS.length];
                  return(
                    <article key={item.id} className="scard" style={{...S.card,borderColor:accent,opacity:item.sold?0.55:1}} onClick={()=>openDetail(item)}>
                      <div style={{...S.cardTop,background:item.image_url?"#000":accent,overflow:"hidden",height:160}}>
                        {item.image_url?<img src={item.image_url} alt={item.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:56,filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.2))"}}>{item.emoji||catEmoji(item.category)}</span>}
                        {item.sold&&<div style={S.soldVeil}><span style={S.soldStamp}>SOLD</span></div>}
                      </div>
                      <div style={{...S.cardBody,padding:"12px 14px 10px"}}>
                        <p style={{...S.cardCatLabel,color:accent,marginBottom:2}}>{item.category?.toUpperCase()}</p>
                        <p style={{...S.cardName,fontSize:16,marginBottom:8}}>{item.name}</p>
                        <div style={S.cardFoot}><span style={{...S.cardPrice,color:accent,fontSize:20}}>${item.price}</span></div>
                      </div>
                      <div style={{...S.accentBar,background:accent}}/>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {/* COMPLETE THE LOOK — show matching jewellery for clothing items */}
          {sel&&sel.listing_type!=="Jewellery"&&(()=>{
            const matchingJewellery=items.filter(i=>i.listing_type==="Jewellery"&&!i.sold&&i.id!==sel.id&&(i.user_id===sel.user_id||(i.occasions||[]).some(o=>(sel.occasions||[]).includes(o)))).slice(0,4);
            if(!matchingJewellery.length) return null;
            return(
              <div style={{marginTop:48}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #BF5AF2",paddingLeft:12,marginBottom:20}}>💎 COMPLETE THE LOOK</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:3}}>
                  {matchingJewellery.map((item,idx)=>{
                    const accent=CARD_COLORS[idx%CARD_COLORS.length];
                    return(
                      <article key={item.id} className="scard" style={{...S.card,borderColor:accent}} onClick={()=>openDetail(item)}>
                        <div style={{...S.cardTop,background:item.image_url?"#000":accent,overflow:"hidden",height:160}}>
                          {item.image_url?<img src={item.image_url} alt={item.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:56}}>{item.emoji||catEmoji(item.category)}</span>}
                        </div>
                        <div style={{...S.cardBody,padding:"12px 14px 10px"}}>
                          <p style={{...S.cardCatLabel,color:accent,marginBottom:2}}>{item.category?.toUpperCase()} · {item.material?.toUpperCase()}</p>
                          <p style={{...S.cardName,fontSize:16,marginBottom:8}}>{item.name}</p>
                          <div style={S.cardFoot}><span style={{...S.cardPrice,color:accent,fontSize:20}}>{currencySymbol(item.currency)}{item.price}</span></div>
                        </div>
                        <div style={{...S.accentBar,background:accent}}/>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          {recentItems.length>0&&(
            <div style={{marginTop:48}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #FF9500",paddingLeft:12,marginBottom:20}}>RECENTLY VIEWED</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:3}}>
                {recentItems.map((item,idx)=>{
                  const accent=CARD_COLORS[idx%CARD_COLORS.length];
                  return(
                    <article key={item.id} className="scard" style={{...S.card,borderColor:accent,opacity:item.sold?0.55:1}} onClick={()=>openDetail(item)}>
                      <div style={{...S.cardTop,background:item.image_url?"#000":accent,overflow:"hidden",height:160}}>
                        {item.image_url?<img src={item.image_url} alt={item.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:56,filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.2))"}}>{item.emoji||catEmoji(item.category)}</span>}
                        {item.sold&&<div style={S.soldVeil}><span style={S.soldStamp}>SOLD</span></div>}
                      </div>
                      <div style={{...S.cardBody,padding:"12px 14px 10px"}}>
                        <p style={{...S.cardCatLabel,color:accent,marginBottom:2}}>{item.category?.toUpperCase()}</p>
                        <p style={{...S.cardName,fontSize:16,marginBottom:8}}>{item.name}</p>
                        <div style={S.cardFoot}><span style={{...S.cardPrice,color:accent,fontSize:20}}>${item.price}</span></div>
                      </div>
                      <div style={{...S.accentBar,background:accent}}/>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      )}

      {/* ── ADD / EDIT ── */}
      {(view==="add"||view==="edit")&&(
        <main style={{...S.main,maxWidth:760}}>
          <button style={S.back} onClick={()=>setView(view==="edit"?"detail":"shop")}>← BACK</button>
          <div style={S.formCard}>
            <div style={S.formHero}><h2 style={S.formTitle}>{view==="edit"?"EDIT YOUR\nPIECE.":"LIST YOUR\nPIECE."}</h2><p style={S.formSub}>{view==="edit"?"Update your listing details.":"Real measurements. Real fit info. Real buyers."}</p></div>

            <Sec label="PHOTOS (UP TO 5)">
              <div style={S.multiUploadGrid}>
                {form.imagePreviews.map((src,i)=>(
                  <div key={i} style={S.uploadThumb}>
                    <img src={src} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    <button type="button" style={S.removeImg} onClick={()=>removeImagePreview(i)}>✕</button>
                    {i===0&&<div style={S.mainImgBadge}>MAIN</div>}
                  </div>
                ))}
                {form.imagePreviews.length<5&&(
                  <div style={S.uploadZone} onClick={()=>document.getElementById("img-input").click()}>
                    <div style={S.uploadPlaceholder}><div style={S.uploadIcon}>📸</div><p style={S.uploadText}>ADD PHOTO</p></div>
                  </div>
                )}
              </div>
              <input id="img-input" type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>addImageFiles(e.target.files)}/>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:"#bbb",letterSpacing:1,marginTop:8}}>FIRST PHOTO IS THE COVER IMAGE</p>
            </Sec>

            <Sec label="THE BASICS">
              <div style={S.fg2}>
                <F l="Item Name *"><input style={S.inp} placeholder="e.g. Kanjivaram Silk Saree" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></F>
                <F l="Price *"><input style={S.inp} type="number" placeholder="65" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))}/></F>
                <F l="TYPE" style={{gridColumn:"1/-1"}}>
                  <div style={{display:"flex",gap:0}}>
                    {LISTING_TYPES.map(t=>(
                      <button key={t} type="button" className="hbtn"
                        style={{...S.hBtn,flex:1,background:form.listing_type===t?"#FF1493":"#fff",color:form.listing_type===t?"#fff":"#111",border:"2px solid #111",borderRadius:0,padding:"10px"}}
                        onClick={()=>setForm(f=>({...f,listing_type:t,category:t==="Jewellery"?"Necklace":t==="Shoes"?"Heels":"Saree"}))}>
                        {t==="Clothing"?"👗 CLOTHING":t==="Jewellery"?"💎 JEWELLERY":"👠 SHOES"}
                      </button>
                    ))}
                  </div>
                </F>
                <F l="Category">
                  <select style={S.inp} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                    {(form.listing_type==="Jewellery"?JEWELLERY_CATS:form.listing_type==="Shoes"?SHOE_CATS:CATEGORIES).map(c=><option key={c}>{c}</option>)}
                  </select>
                </F>
                <F l="Origin"><select style={S.inp} value={form.origin} onChange={e=>setForm(f=>({...f,origin:e.target.value}))}>{ORIGINS.map(o=><option key={o}>{o}</option>)}</select></F>
                {form.listing_type==="Jewellery"
                  ?<F l="Material"><select style={S.inp} value={form.material} onChange={e=>setForm(f=>({...f,material:e.target.value}))}>{JEWELLERY_MATERIALS.map(m=><option key={m}>{m}</option>)}</select></F>
                  :<F l="Fabric"><select style={S.inp} value={form.fabric} onChange={e=>setForm(f=>({...f,fabric:e.target.value}))}>{FABRICS.map(x=><option key={x}>{x}</option>)}</select></F>
                }
                <F l="Condition"><select style={S.inp} value={form.condition} onChange={e=>setForm(f=>({...f,condition:e.target.value}))}>{CONDITIONS.map(c=><option key={c}>{c}</option>)}</select></F>
                {(form.listing_type==="Clothing"||form.listing_type==="Shoes")&&<F l="Size"><select style={S.inp} value={form.size} onChange={e=>setForm(f=>({...f,size:e.target.value}))}>{(form.listing_type==="Shoes"?SHOE_SIZES:SIZES).map(s=><option key={s}>{s}</option>)}</select></F>}
                <F l="WhatsApp (with country code)" style={{gridColumn:"1/-1"}}><input style={S.inp} placeholder="e.g. 447911123456" value={form.whatsapp} onChange={e=>setForm(f=>({...f,whatsapp:e.target.value}))}/></F>
              </div>
            </Sec>

            <Sec label="OCCASIONS">
              <div style={S.occGrid}>{OCCASIONS.map(o=>{const on=form.occasions.includes(o),col=OCC_COLOR[o];return<button key={o} type="button" onClick={()=>togOcc(o)} style={{...S.occToggle,background:on?col:"#fff",color:on?"#fff":"#111",border:`2px solid ${on?col:"#111"}`,fontWeight:on?800:600}}>{o.toUpperCase()}</button>;})}</div>
            </Sec>

            {form.listing_type==="Clothing"&&<Sec label="MEASUREMENTS (INCHES)">
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <p style={{fontSize:12,color:"#888"}}>Need help? Use a soft measuring tape.</p>
                <button type="button" style={{background:"none",border:"none",fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:1,color:"#FF1493",cursor:"pointer",padding:0}} onClick={()=>{setPrevView(view);setView("measuring");}}>📏 HOW TO MEASURE →</button>
              </div>
              {/* Required */}
              <div style={{background:"#fff8fc",border:"2px solid #FF149333",padding:"14px 16px",marginBottom:16}}>
                <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:900,letterSpacing:2,color:"#FF1493",marginBottom:12}}>✦ REQUIRED MEASUREMENTS</p>
                <div style={S.fg4}>{[["bust","BUST *"],["waist","WAIST *"],["hips","HIPS *"],["length","LENGTH *"]].map(([k,l])=><F key={k} l={l}><input style={{...S.inp,borderColor:!form[k]?"#FF149366":"#e0e0e0"}} placeholder="e.g. 34" value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}/></F>)}</div>
              </div>
              {/* Optional extras */}
              <div style={{border:"2px solid #f0f0f0",padding:"14px 16px",marginBottom:12}}>
                <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:900,letterSpacing:2,color:"#888",marginBottom:12}}>ADDITIONAL MEASUREMENTS (OPTIONAL)</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12}}>
                  {[["underbust","UNDERBUST"],["shoulder","SHOULDER WIDTH"],["high_hip","HIGH HIP"],["sleeve_length","SLEEVE LENGTH"],["inseam","INSEAM"]].map(([k,l])=>(
                    <F key={k} l={l}><input style={S.inp} placeholder="inches" value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}/></F>
                  ))}
                </div>
              </div>
              <div style={{marginTop:12}}><F l="NOTES"><input style={S.inp} placeholder="e.g. stitched for 5'4, blouse included" value={form.measurement_notes} onChange={e=>setForm(f=>({...f,measurement_notes:e.target.value}))}/></F></div>
              <div style={S.toggleStack}>
                <Tog on={form.can_take_in} onToggle={()=>setForm(f=>({...f,can_take_in:!f.can_take_in}))} color="#34C759" label="CAN BE TAKEN IN (MADE SMALLER)" sub="Seam allowance exists to reduce sizing"/>
                <Tog on={form.spare_fabric} onToggle={()=>setForm(f=>({...f,spare_fabric:!f.spare_fabric}))} color="#FF9500" label="SPARE FABRIC INCLUDED (CAN LET OUT)" sub="Extra fabric allows making it bigger"/>
              </div>
            </Sec>}

            <Sec label="📦 POSTAGE">
              <p style={{fontSize:12,color:"#888",marginBottom:12,lineHeight:1.6}}>Does this item include free postage, or will buyers pay separately at checkout?</p>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <Tog on={form.accepts_collection} onToggle={()=>setForm(f=>({...f,accepts_collection:!f.accepts_collection}))} color="#34C759" label="ACCEPT COLLECTION IN PERSON" sub="Buyer can collect for free — arrange separately"/>
              </div>
            </Sec>

            <Sec label="DESCRIBE IT">
              <textarea style={{...S.inp,height:110,resize:"vertical",width:"100%"}} placeholder="Fabric feel, embroidery, wear history, any flaws…" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
            </Sec>

            <button className="hbtn" style={{...S.hBtn,width:"100%",padding:"18px",fontSize:17,borderRadius:0,letterSpacing:3,opacity:(!form.name||!form.price||saving)?0.45:1,cursor:(!form.name||!form.price||saving)?"not-allowed":"pointer"}} onClick={view==="edit"?saveEdit:add} disabled={!form.name||!form.price||saving}>
              {saving?"SAVING...":view==="edit"?"SAVE CHANGES →":"PUBLISH LISTING →"}
            </button>
          </div>
        </main>
      )}
    </div>
  );
}

function Sec({label,children}){return<div style={{marginBottom:36}}><div style={{fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #FF1493",paddingLeft:12,marginBottom:18,textTransform:"uppercase"}}>{label}</div>{children}</div>;}
function F({l,children,style}){return<div style={{display:"flex",flexDirection:"column",gap:5,...style}}><label style={{fontSize:10,fontWeight:800,color:"#999",letterSpacing:1.5,textTransform:"uppercase"}}>{l}</label>{children}</div>;}
function Tog({on,onToggle,color,label,sub}){return<div style={{display:"flex",alignItems:"flex-start",gap:14,padding:"14px 0",borderBottom:"1px solid #f0f0f0",cursor:"pointer"}} onClick={onToggle}><div style={{width:46,height:26,borderRadius:13,background:on?color:"#e0e0e0",position:"relative",flexShrink:0,transition:"background .2s",border:`2px solid ${on?color:"#ccc"}`}}><div style={{width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:on?24:2,transition:"left .18s",boxShadow:"0 2px 6px rgba(0,0,0,0.2)"}}/></div><div><div style={{fontSize:13,fontWeight:800,letterSpacing:0.5,color:"#111"}}>{label}</div><div style={{fontSize:12,color:"#aaa",marginTop:3}}>{sub}</div></div></div>;}

const CSS=`
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,700;0,800;0,900;1,800&family=Barlow:wght@400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{background:#fff;}
  .scard{transition:transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s !important;cursor:pointer;}
  .scard:hover{transform:translateY(-8px) rotate(-0.5deg) !important;box-shadow:0 24px 60px rgba(0,0,0,0.13) !important;}
  .hbtn{transition:all .14s ease !important;}
  .hbtn:hover{transform:scale(0.96) !important;filter:brightness(0.9) !important;}
  .fpill{transition:all .14s !important;}
  .fpill:hover{background:#111 !important;color:#fff !important;}
  @keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
  @keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
  @keyframes floatbob{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-14px) rotate(5deg)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
  input:focus,select:focus,textarea:focus{border-color:#FF1493 !important;box-shadow:0 0 0 3px rgba(255,20,147,0.1) !important;outline:none;}
  .avatar-wrap:hover .avatar-overlay{opacity:1 !important;}
  ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:#eee;border-radius:2px}
  ::selection{background:#FF149333}
  @media(max-width:600px){
    .hero-left{padding:28px 20px !important;flex:1 1 100% !important;border-right:none !important;border-bottom:3px solid #111;}
    .hero-right{display:none !important;}
    .detail-wrap{flex-direction:column !important;}
    .detail-img{border-right:none !important;border-bottom:3px solid #111;}
    .msg-layout{flex-direction:column !important;height:auto !important;}
    .msg-sidebar{width:100% !important;border-right:none !important;border-bottom:3px solid #111;}
    .dash-grid{grid-template-columns:1fr !important;}
  }
`;

const S={
  root:{minHeight:"100vh",background:"#fff",color:"#111",fontFamily:"'Barlow',sans-serif"},
  header:{background:"#fff",borderBottom:"3px solid #111",position:"sticky",top:0,zIndex:200},
  hWrap:{maxWidth:"100%",padding:"0 10px",display:"flex",alignItems:"stretch",height:52,overflowX:"auto",WebkitOverflowScrolling:"touch"},
  logoWrap:{display:"flex",alignItems:"center",gap:2,cursor:"pointer",paddingRight:10,borderRight:"2px solid #111",flexShrink:0},
  logoText:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:2},
  logoTM:{fontSize:10,color:"#FF1493",alignSelf:"flex-start",marginTop:6},
  hMid:{flex:1,overflow:"hidden",display:"flex",alignItems:"center",paddingLeft:10,minWidth:0},
  marqueeTrack:{overflow:"hidden",width:"100%"},
  marqueeInner:{display:"inline-block",whiteSpace:"nowrap",fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:700,letterSpacing:2,color:"#bbb",animation:"marquee 30s linear infinite"},
  hRight:{display:"flex",alignItems:"center",gap:5,paddingLeft:10,borderLeft:"2px solid #111",flexShrink:0},
  hLive:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:700,letterSpacing:1,color:"#FF1493",whiteSpace:"nowrap"},
  hBtn:{background:"#111",color:"#fff",border:"2px solid #111",borderRadius:0,padding:"5px 8px",fontSize:9,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1,whiteSpace:"nowrap"},
  ticker:{background:"#FF1493",overflow:"hidden",borderBottom:"2px solid #111",height:36,display:"flex",alignItems:"center"},
  tickerInner:{display:"inline-block",whiteSpace:"nowrap",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:2.5,color:"#fff",animation:"ticker 22s linear infinite",paddingLeft:"100%"},
  toast:{position:"fixed",bottom:32,left:"50%",transform:"translateX(-50%)",background:"#111",color:"#fff",padding:"12px 28px",fontSize:14,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:3,zIndex:999,borderRadius:0,whiteSpace:"nowrap",boxShadow:"0 4px 24px rgba(0,0,0,0.2)"},
  hero:{borderBottom:"3px solid #111",display:"flex",minHeight:"80vh",overflow:"hidden",flexWrap:"wrap"},
  heroLeft:{flex:"0 0 55%",minWidth:280,padding:"40px 32px",borderRight:"3px solid #111",display:"flex",flexDirection:"column",justifyContent:"center"},
  heroTag:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:4,color:"#FF1493",marginBottom:20},
  heroH:{display:"flex",flexDirection:"column",marginBottom:28},
  heroLine1:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(52px,10vw,140px)",fontWeight:900,lineHeight:.9,letterSpacing:-2,color:"#111"},
  heroLine2:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(52px,10vw,140px)",fontWeight:900,lineHeight:.9,letterSpacing:-2,color:"#FF1493"},
  heroLine3:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(52px,10vw,140px)",fontWeight:900,lineHeight:.9,letterSpacing:-2,color:"#fff",WebkitTextStroke:"2px #111"},
  heroSub:{fontSize:16,color:"#555",lineHeight:1.7,maxWidth:440,marginBottom:36},
  heroCtas:{display:"flex",gap:14,flexWrap:"wrap"},
  heroBtnPrimary:{background:"#FF1493",color:"#fff",border:"2px solid #FF1493",padding:"14px 32px",fontSize:14,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:3,borderRadius:0},
  heroBtnSecondary:{background:"#fff",color:"#111",border:"2px solid #111",padding:"14px 32px",fontSize:14,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:3,borderRadius:0},
  heroRight:{flex:1,position:"relative",background:"#fafafa"},
  heroBubble:{position:"absolute",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",border:"3px solid #111",animation:"floatbob 4s ease-in-out infinite"},
  searchBar:{borderBottom:"2px solid #111",background:"#fff",position:"sticky",top:52,zIndex:100},
  searchInner:{display:"flex",alignItems:"stretch",height:48},
  searchBox:{flex:1,display:"flex",alignItems:"stretch",minWidth:0},
  searchIcon:{padding:"0 10px",fontSize:14,color:"#bbb",flexShrink:0,display:"flex",alignItems:"center"},
  searchInput:{flex:1,border:"none",outline:"none",fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,letterSpacing:1,color:"#111",padding:"0",background:"transparent",minWidth:0},
  searchClear:{background:"none",border:"none",padding:"0 10px",cursor:"pointer",fontSize:12,color:"#bbb",fontWeight:700,flexShrink:0,display:"flex",alignItems:"center"},
  filterPanel:{padding:"16px 16px",borderTop:"1px solid #f0f0f0",display:"flex",flexDirection:"column",gap:16},
  filterBtn:{background:"#fff",border:"none",borderLeft:"1px solid #e0e0e0",borderRadius:0,padding:"0 14px",height:48,minHeight:48,fontSize:11,flexShrink:0,letterSpacing:1.5,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,whiteSpace:"nowrap",display:"flex",alignItems:"center",justifyContent:"center"},
  filterGroup:{display:"flex",flexDirection:"column",gap:10},
  filterLabel:{fontSize:10,fontWeight:900,letterSpacing:3,color:"#999",fontFamily:"'Barlow Condensed',sans-serif"},
  filterPills:{display:"flex",flexWrap:"wrap",gap:6},
  pill:{background:"#fff",border:"1.5px solid #e0e0e0",padding:"6px 14px",fontSize:11,cursor:"pointer",color:"#888",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:1.5,whiteSpace:"nowrap",borderRadius:0,flexShrink:0},
  pillOn:{background:"#111",border:"1.5px solid #111",color:"#fff"},
  gridWrap:{padding:"20px 10px",maxWidth:1300,margin:"0 auto",background:"#fff"},
  loadingWrap:{display:"flex",flexDirection:"column",alignItems:"center",padding:"80px 0",gap:16},
  spinner:{width:36,height:36,border:"4px solid #f0f0f0",borderTop:"4px solid #FF1493",borderRadius:"50%",animation:"spin 0.8s linear infinite"},
  loadingText:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:3,color:"#bbb"},
  errorBanner:{background:"#fff0f0",border:"2px solid #FF1493",padding:"16px 24px",marginBottom:24,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:1,display:"flex",alignItems:"center",gap:16},
  retryBtn:{background:"#FF1493",color:"#fff",border:"none",padding:"6px 16px",fontSize:12,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2},
  grid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:3},
  card:{background:"#fff",border:"3px solid #111",overflow:"hidden",cursor:"pointer",borderRadius:0,position:"relative"},
  cardTop:{height:200,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"},
  cardEmoji:{fontSize:80,filter:"drop-shadow(0 6px 16px rgba(0,0,0,0.2))",position:"relative",zIndex:2},
  cardOrigin:{position:"absolute",top:12,left:12,background:"rgba(0,0,0,0.5)",color:"#fff",padding:"3px 10px",fontSize:10,fontWeight:800,letterSpacing:2,fontFamily:"'Barlow Condensed',sans-serif",backdropFilter:"blur(4px)",zIndex:3},
  cardOccDots:{position:"absolute",bottom:10,right:10,display:"flex",gap:5,zIndex:3},
  occDot:{width:9,height:9,borderRadius:"50%",border:"2px solid rgba(0,0,0,0.15)"},
  soldVeil:{position:"absolute",inset:0,background:"rgba(255,255,255,0.75)",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(2px)",zIndex:4},
  soldStamp:{fontSize:22,fontWeight:900,letterSpacing:6,color:"#111",border:"3px solid #111",padding:"6px 18px",fontFamily:"'Barlow Condensed',sans-serif"},
  reservedBadge:{position:"absolute",top:12,right:12,background:"#FF9500",color:"#fff",padding:"3px 10px",fontSize:10,fontWeight:800,letterSpacing:1.5,fontFamily:"'Barlow Condensed',sans-serif",zIndex:3},
  multiImgBadge:{position:"absolute",bottom:10,left:10,background:"rgba(0,0,0,0.6)",color:"#fff",padding:"2px 8px",fontSize:10,fontWeight:800,letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif",zIndex:3},
  cardBody:{padding:"16px 18px 12px"},
  cardCatLabel:{fontSize:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,marginBottom:4},
  cardName:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,color:"#111",marginBottom:10,lineHeight:1.15,letterSpacing:0.5},
  occRow:{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10},
  occChip:{borderRadius:0,padding:"2px 8px",fontSize:10,fontWeight:800,letterSpacing:1.5,fontFamily:"'Barlow Condensed',sans-serif"},
  measRow:{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12},
  mTag:{background:"#f5f5f5",color:"#555",border:"1px solid #e0e0e0",padding:"3px 8px",fontSize:10,fontWeight:700,letterSpacing:.5,fontFamily:"'Barlow Condensed',sans-serif"},
  mTagG:{background:"#34C75922",color:"#34C759",borderColor:"#34C75966"},
  mTagA:{background:"#FF950022",color:"#FF9500",borderColor:"#FF950066"},
  cardFoot:{display:"flex",alignItems:"center",justifyContent:"space-between",borderTop:"2px solid #f5f5f5",paddingTop:12,paddingBottom:4},
  cardPrice:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900,letterSpacing:-0.5},
  waSmall:{color:"#fff",padding:"6px 12px",fontSize:15,textDecoration:"none",display:"flex",alignItems:"center",fontWeight:700},
  accentBar:{height:4,width:"100%"},
  empty:{gridColumn:"1/-1",textAlign:"center",padding:"80px 20px"},
  main:{maxWidth:1200,margin:"0 auto",padding:"20px 12px"},
  back:{background:"none",border:"none",color:"#999",fontSize:12,cursor:"pointer",marginBottom:32,padding:0,fontWeight:800,letterSpacing:2,fontFamily:"'Barlow Condensed',sans-serif",textTransform:"uppercase"},
  detailWrap:{display:"flex",flexWrap:"wrap",gap:0,border:"3px solid #111"},
  detailImgWrap:{flex:"0 0 300px",minWidth:"min(300px,100%)",display:"flex",flexDirection:"column",borderRight:"3px solid #111"},
  detailPanel:{flex:1,minHeight:320,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"},
  thumbRow:{display:"flex",gap:0,borderTop:"2px solid #111",overflowX:"auto"},
  thumb:{width:70,height:70,flexShrink:0,cursor:"pointer",border:"2px solid transparent",overflow:"hidden",transition:"border-color .15s"},
  imgNav:{position:"absolute",top:"50%",transform:"translateY(-50%)",background:"rgba(0,0,0,0.5)",color:"#fff",border:"none",width:36,height:36,fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:5,fontWeight:900},
  detailInfo:{flex:1,minWidth:"min(280px,100%)",padding:"20px 16px"},
  detailName:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:44,fontWeight:900,color:"#111",lineHeight:1,marginBottom:10,letterSpacing:-1},
  detailPrice:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:56,fontWeight:900,marginBottom:16,letterSpacing:-2},
  dBlock:{marginBottom:24,paddingBottom:24,borderBottom:"1px solid #f0f0f0"},
  dBlockTitle:{fontSize:11,fontWeight:900,letterSpacing:3,borderLeft:"4px solid",paddingLeft:10,marginBottom:12,fontFamily:"'Barlow Condensed',sans-serif"},
  measBoxRow:{display:"flex",flexWrap:"wrap",gap:10,marginBottom:12},
  measBox:{border:"2px solid",padding:"12px 18px",textAlign:"center",minWidth:72},
  measVal:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900},
  measLbl:{fontSize:9,color:"#999",letterSpacing:2,fontWeight:800,fontFamily:"'Barlow Condensed',sans-serif",marginTop:2},
  measNote:{fontSize:13,color:"#888",marginBottom:12},
  alterRow:{display:"flex",flexWrap:"wrap",gap:8},
  alterBadge:{padding:"7px 14px",fontSize:11,fontWeight:800,letterSpacing:1,border:"1.5px solid",fontFamily:"'Barlow Condensed',sans-serif"},
  aY:{background:"#34C75922",color:"#34C759",borderColor:"#34C75966"},
  aY2:{background:"#FF950022",color:"#FF9500",borderColor:"#FF950066"},
  aN:{background:"#f5f5f5",color:"#ccc",borderColor:"#eee"},
  detailDesc:{fontSize:15,color:"#666",lineHeight:1.7,marginBottom:24},
  waCta:{color:"#fff",padding:"14px 26px",fontSize:14,fontWeight:800,letterSpacing:2,fontFamily:"'Barlow Condensed',sans-serif",marginBottom:24,border:"none",cursor:"pointer"},
  actRow:{display:"flex",gap:10,flexWrap:"wrap"},
  actBtn:{border:"none",padding:"12px 22px",fontSize:12,cursor:"pointer",fontWeight:800,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1.5,color:"#fff"},
  profileHeader:{display:"flex",alignItems:"flex-start",gap:28,marginBottom:36,paddingBottom:32,borderBottom:"3px solid #111",flexWrap:"wrap"},
  profileAvatarWrap:{width:110,height:110,borderRadius:"50%",border:"3px solid #111",overflow:"hidden",flexShrink:0,background:"#FF1493",display:"flex",alignItems:"center",justifyContent:"center"},
  profileAvatar:{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed',sans-serif",fontSize:48,fontWeight:900,color:"#fff"},
  profileName:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:40,fontWeight:900,letterSpacing:-1,marginBottom:4,lineHeight:1},
  profileBio:{fontSize:14,color:"#666",lineHeight:1.6,marginBottom:6,maxWidth:480},
  profileMeta:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,letterSpacing:2,color:"#bbb"},
  avatarUploadCircle:{width:100,height:100,borderRadius:"50%",border:"3px solid #111",overflow:"hidden",cursor:"pointer",position:"relative",flexShrink:0,background:"#FF1493",display:"flex",alignItems:"center",justifyContent:"center"},
  avatarInitials:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:40,fontWeight:900,color:"#fff"},
  avatarEditOverlay:{position:"absolute",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,opacity:0,transition:"opacity .15s"},
  dashHeader:{display:"flex",flexWrap:"wrap",alignItems:"flex-start",justifyContent:"space-between",gap:24,marginBottom:40,paddingBottom:32,borderBottom:"3px solid #111"},
  dashStats:{display:"flex",gap:3,flexWrap:"wrap"},
  dashStat:{background:"#fafafa",border:"2px solid #111",padding:"16px 20px",textAlign:"center",minWidth:72},
  dashStatNum:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:32,fontWeight:900,lineHeight:1},
  dashStatLabel:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,fontWeight:800,letterSpacing:2,color:"#bbb",marginTop:4},
  dashGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:3},
  dashCard:{background:"#fff",border:"3px solid",overflow:"hidden",display:"flex"},
  dashCardImg:{width:120,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"},
  dashCardBody:{flex:1,padding:"14px"},
  dashBtn:{border:"none",padding:"6px 10px",fontSize:10,cursor:"pointer",fontWeight:800,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1},
  formCard:{border:"3px solid #111",padding:"48px 44px",background:"#fff"},
  formHero:{borderBottom:"3px solid #111",paddingBottom:32,marginBottom:36},
  formTitle:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:64,fontWeight:900,lineHeight:.95,letterSpacing:-1,marginBottom:10,whiteSpace:"pre-line"},
  formSub:{fontSize:15,color:"#888"},
  fg2:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14},
  fg4:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12},
  inp:{background:"#fff",border:"2px solid #e0e0e0",borderRadius:0,padding:"12px 14px",fontSize:14,color:"#111",fontFamily:"'Barlow',sans-serif",width:"100%",transition:"all .15s"},
  occGrid:{display:"flex",flexWrap:"wrap",gap:6},
  occToggle:{padding:"7px 16px",fontSize:11,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1.5,cursor:"pointer",transition:"all .14s",borderRadius:0},
  multiUploadGrid:{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:8},
  uploadThumb:{position:"relative",aspectRatio:"1",border:"2px solid #e0e0e0",overflow:"hidden"},
  uploadZone:{aspectRatio:"1",border:"3px dashed #e0e0e0",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",position:"relative"},
  uploadPlaceholder:{textAlign:"center",pointerEvents:"none"},
  uploadIcon:{fontSize:24,marginBottom:4},
  uploadText:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:800,letterSpacing:1.5,color:"#bbb"},
  removeImg:{position:"absolute",top:4,right:4,background:"#111",color:"#fff",border:"none",padding:"2px 6px",fontSize:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,cursor:"pointer",zIndex:2},
  mainImgBadge:{position:"absolute",bottom:4,left:4,background:"#FF1493",color:"#fff",padding:"2px 6px",fontSize:9,fontWeight:800,letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif"},
  toggleStack:{display:"flex",flexDirection:"column",marginTop:16},
  googleBtn:{display:"flex",alignItems:"center",justifyContent:"center",gap:12,border:"2px solid #111",padding:"14px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:13,letterSpacing:2,color:"#111",textDecoration:"none",marginBottom:20,cursor:"pointer"},
  divider:{display:"flex",alignItems:"center",gap:12,marginBottom:20},
  dividerText:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:3,color:"#ccc"},
  aError:{background:"#fff0f0",border:"1.5px solid #FF1493",padding:"10px 14px",fontSize:13,color:"#FF1493",fontWeight:600},
  authSwitch:{textAlign:"center",marginTop:20,fontSize:13,color:"#888"},
  authSwitchLink:{color:"#FF1493",fontWeight:800,cursor:"pointer",textDecoration:"underline"},
  wishBadge:{position:"absolute",top:-6,right:-6,background:"#FF1493",color:"#fff",borderRadius:"50%",width:18,height:18,fontSize:10,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed',sans-serif"},
  notifPanel:{position:"fixed",top:96,right:16,width:360,background:"#fff",border:"3px solid #111",zIndex:300,boxShadow:"0 8px 40px rgba(0,0,0,0.15)",maxHeight:500,display:"flex",flexDirection:"column"},
  notifHeader:{padding:"14px 16px",borderBottom:"2px solid #111",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#fafafa"},
  notifItem:{padding:"14px 16px",borderBottom:"1px solid #f5f5f5",cursor:"pointer",transition:"background .15s"},
  heartBtn:{position:"absolute",top:10,right:10,background:"rgba(255,255,255,0.85)",border:"none",borderRadius:"50%",width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,zIndex:5,transition:"all .15s"},
  modalOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:24},
  modalBox:{background:"#fff",border:"3px solid #111",padding:32,maxWidth:640,width:"100%",maxHeight:"85vh",overflowY:"auto"},
  verifiedBadge:{background:"#34C759",color:"#fff",fontSize:11,fontWeight:800,letterSpacing:1,padding:"2px 8px",fontFamily:"'Barlow Condensed',sans-serif",verticalAlign:"middle",marginLeft:8},
  fitsBadge:{position:"absolute",bottom:10,left:10,background:"#34C759",color:"#fff",padding:"3px 10px",fontSize:10,fontWeight:800,letterSpacing:1.5,fontFamily:"'Barlow Condensed',sans-serif",zIndex:3},
  reviewCard:{background:"#fafafa",border:"1.5px solid #f0f0f0",padding:"14px 16px"},
  // messaging
  msgLayout:{display:"flex",border:"3px solid #111",height:"70vh",overflow:"hidden"},
  msgSidebar:{width:300,flexShrink:0,borderRight:"3px solid #111",display:"flex",flexDirection:"column",overflow:"hidden"},
  msgSidebarHead:{padding:"16px 20px",borderBottom:"2px solid #111",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#fafafa"},
  convItem:{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:"1px solid #f5f5f5",cursor:"pointer",transition:"background .15s"},
  convAvatar:{width:40,height:40,borderRadius:"50%",background:"#FF1493",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden",border:"2px solid #111"},
  msgMain:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"},
  chatHeader:{padding:"14px 20px",borderBottom:"2px solid #111",display:"flex",alignItems:"center",gap:12,background:"#fafafa"},
  chatMessages:{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column"},
  chatListingPreview:{display:"inline-flex",alignItems:"center",gap:12,border:"2px solid #f0f0f0",padding:"10px 14px",cursor:"pointer",marginTop:12,background:"#fafafa"},
  msgBubble:{padding:"10px 14px",maxWidth:"70%"},
  chatInput:{display:"flex",borderTop:"2px solid #111"},
  offerBar:{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",borderTop:"1px solid #f5f5f5",flexWrap:"wrap",background:"#fafafa"},
  offerCard:{background:"#fff",padding:"14px 16px",borderRadius:0},
  offerStatusBadge:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,fontWeight:800,letterSpacing:1.5,color:"#fff",padding:"2px 8px",borderRadius:0},
};
