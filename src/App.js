import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  SUPABASE_URL, SUPABASE_KEY, STRIPE_PK, PLATFORM_FEE, hdrs,
  CATEGORIES, JEWELLERY_CATS, SHOE_CATS, SHOE_SIZES, ALL_CATEGORIES,
  LISTING_TYPES, JEWELLERY_MATERIALS, ORIGINS, FABRICS, CONDITIONS,
  OCCASIONS, SIZES, OCC_COLOR, CARD_COLORS, EMPTY_FORM, POSTAGE_OPTIONS,
  catEmoji, currencySymbol, buildPaymentSummary,
  garmentTypesFor, garmentFieldsFor, defaultGarmentFor, parseMeasurements, buildMeasPayload,
} from "./lib/constants";
import { db } from "./lib/db";
import { startCheckout, verifySession } from "./lib/checkout";
import { auth, uploadImage, isTokenExpired, decodeJWT } from "./lib/auth";
import { S, CSS } from "./styles";
import { Heart, Bell, MessageCircle, Camera, Shirt, Gem, Footprints, Ruler, Package, User, Menu, X, ShoppingBag, Lock, CreditCard, PartyPopper, Mail, Handshake, Wallet, Lightbulb, Flag, Star, Tag, Check, CornerUpLeft } from "lucide-react";
import { Sec, F, Tog, Thumb } from "./components/Shared";
import Tailors from "./views/Tailors";
import Detail from "./views/Detail";
import Shop from "./views/Shop";
import Auth from "./views/Auth";
import Profile from "./views/Profile";
import Dashboard from "./views/Dashboard";
import Feed from "./views/Feed";
import Orders from "./views/Orders";

// Pull the human-readable reason out of a thrown Supabase/PostgREST error.
// db.* throws `new Error(await r.text())` where the text is usually JSON like
// {"code":"42501","message":"new row violates row-level security policy", ...}.
function errMsg(e){
  const raw=(e&&e.message)?e.message:String(e);
  try{ const j=JSON.parse(raw); return j.message||j.error||j.hint||j.msg||raw; }
  catch{ return raw; }
}

// True when an error is specifically an expired/invalid-JWT failure from Supabase
// (e.g. "JWT expired", `"exp" claim timestamp check failed`). We retry these once
// with a force-refreshed token. Note: this deliberately does NOT match generic 403
// RLS errors — retrying those would just fail again the same way.
function isExpiredTokenErr(e){
  const m=(errMsg(e)||"").toLowerCase();
  return m.includes("jwt expired")||m.includes("exp claim")||m.includes("token is expired")||m.includes("invalid jwt")||(m.includes("jwt")&&m.includes("expir"));
}

async function createStripeCheckout(listing, buyerEmail) {
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
  const [otpStep,   setOtpStep]   = useState("form");
  const [otpCode,   setOtpCode]   = useState("");
  const [otpEmail,  setOtpEmail]  = useState("");
  const [twoFAStep,   setTwoFAStep]   = useState(null);
  const [twoFAData,   setTwoFAData]   = useState(null);
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
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions,   setShowSuggestions]   = useState(false);
  const [savedSearches,     setSavedSearches]     = useState([]);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [catFilter, setCatFilter] = useState("All");
  const [sizeFilter,setSizeFilter]= useState("All");
  const [minPrice,  setMinPrice]  = useState("");
  const [maxPrice,  setMaxPrice]  = useState("");
  const [showFilters,setShowFilters]=useState(false);
  const [wishlist,   setWishlist]   = useState(()=>{ try{return JSON.parse(localStorage.getItem("stitchd_wishlist"))||[];}catch{return[];} });
  // Shopping bag holds lightweight snapshots of bagged listings ({id,name,price,
  // currency,image,seller,sold}) so the panel renders without re-fetching. Stored
  // in localStorage (per-device) so it survives refresh AND logging in — exactly
  // like the wishlist above. No Supabase sync in this issue.
  const [bag,        setBag]        = useState(()=>{ try{return JSON.parse(localStorage.getItem("stitchd_bag"))||[];}catch{return[];} });
  const [showBag,    setShowBag]    = useState(false);
  const [checkingOut,setCheckingOut]= useState(false);
  // Order-success page state: {status:'loading'|'ok'|'error', items, amount}.
  const [orderResult,setOrderResult]= useState(null);
  const [recentlyViewed,setRecentlyViewed]=useState(()=>{ try{return JSON.parse(localStorage.getItem("stitchd_recent"))||[];}catch{return[];} });
  const [showSizeGuide,setShowSizeGuide]=useState(false);
  const [reviews,      setReviews]      = useState([]);
  const [sellerRatings,setSellerRatings]= useState({});
  const [fastSellers,  setFastSellers]  = useState(()=>new Set());
  // DB-backed wishlist/favourite counts (Phase 10b). `wishlistCounts` maps
  // listing_id -> how many users saved it; `myWishlist` is the set of listing_ids
  // the signed-in user has saved (drives the filled heart). This is separate from
  // the localStorage `wishlist` above, which is a per-device personal list with
  // its own "MY WISHLIST" view.
  const [wishlistCounts,setWishlistCounts]= useState({});
  const [myWishlist,    setMyWishlist]    = useState(()=>new Set());
  const [showReview,   setShowReview]   = useState(false);
  const [reviewForm,   setReviewForm]   = useState({rating:5,comment:""});
  const [showReport,   setShowReport]   = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [conversations,  setConversations]  = useState([]);
  const [activeConv,     setActiveConv]     = useState(null);
  const [messages,       setMessages]       = useState([]);
  const [msgInput,       setMsgInput]       = useState("");
  const [msgSending,     setMsgSending]     = useState(false);
  const [unreadCount,    setUnreadCount]    = useState(0);
  const [convProfiles,   setConvProfiles]   = useState({});
  const [showCounterOffer,setShowCounterOffer]=useState(null);
  const [counterInput,   setCounterInput]  = useState("");
  const [bundles,        setBundles]        = useState([]);
  const [bundleItems,    setBundleItems]    = useState({});
  const [bundleForm,     setBundleForm]     = useState({name:"",description:"",discount_percent:0,selectedListings:[]});
  const [typeFilter,     setTypeFilter]     = useState("All");
  const [condFilter,     setCondFilter]     = useState("All");
  const [showSizeMatch,  setShowSizeMatch]  = useState(false);
  const [showTailorDir,  setShowTailorDir]  = useState(false);
  const [tailorProfiles, setTailorProfiles] = useState([]);
  const [myOrders,       setMyOrders]       = useState([]);
  const [orderProfiles,  setOrderProfiles]  = useState({});
  const [ordersLoading,  setOrdersLoading]  = useState(false);
  const [deliveryAddress,setDeliveryAddress]= useState({name:"",line1:"",line2:"",city:"",postcode:"",country:"UK"});
  const [showAddressForm,setShowAddressForm]= useState(false);
  const [newListings,    setNewListings]    = useState([]);
  const [priceDrops,     setPriceDrops]     = useState([]);
  const [trendingItems,  setTrendingItems]  = useState([]);
  const [ordersTab,      setOrdersTab]      = useState("all");
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
  const [following,      setFollowing]      = useState([]);
  const [feedItems,      setFeedItems]      = useState([]);
  const [feedLoading,    setFeedLoading]    = useState(false);
  const [feedProfiles,   setFeedProfiles]   = useState({});
  const [notifications,  setNotifications]  = useState([]);
  const [showNotifs,     setShowNotifs]     = useState(false);
  const [navMenuOpen,    setNavMenuOpen]    = useState(false);
  const [mobileNavOpen,  setMobileNavOpen]  = useState(false);
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
      const access_token=p.get("access_token");
      // The OAuth redirect hash has no user_id param, so read the real user id
      // and email from the JWT itself. Without this, user.id is null and the
      // `auth.uid() = user_id` RLS check fails on every insert.
      const claims=decodeJWT(access_token)||{};
      const s={
        access_token,
        // Persisting refresh_token is what lets a Google session refresh after
        // the ~1h access token expires; without it the token dies and every
        // save fails with "JWT expired" until a manual re-login.
        refresh_token:p.get("refresh_token")||null,
        expires_at:claims.exp||null,
        user:{email:claims.email||p.get("email")||"user",id:claims.sub||p.get("user_id")||null},
      };
      auth.saveSession(s); setSession(s); window.location.hash="";
      flash("🩷 Signed in!"); setView("shop");
    }
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

  // Stripe redirects back to /order-success?session_id=… after a paid checkout.
  // Detect that path on load, verify the session server-side (via Edge Function),
  // and show the confirmation page. The post-purchase actions (mark sold, create
  // order, notify seller) are handled by the stripe-webhook function; here we
  // only confirm to the buyer and clear the purchased pieces from their bag.
  useEffect(()=>{
    // Stripe's cancel_url is /bag — drop the buyer back on the shop with the bag
    // panel open (the bag is a slide-in panel, not its own route).
    if(window.location.pathname.includes("/bag")){
      window.history.replaceState({},document.title,"/");
      setShowBag(true);
    }
    if(!window.location.pathname.includes("order-success")) return;
    setView("order-success");
    setOrderResult({status:"loading"});
    const sid=new URLSearchParams(window.location.search).get("session_id");
    if(!sid){ setOrderResult({status:"error"}); return; }
    verifySession(sid).then(r=>{
      if(r&&r.paid){
        setOrderResult({status:"ok",items:r.items||[],amount:r.amount_total||0,sessionId:sid,listingIds:r.listing_ids||[]});
        // Clear the purchased listings from the (localStorage) bag.
        const purchased=new Set(r.listing_ids||[]);
        setBag(prev=>{ const next=purchased.size?prev.filter(b=>!purchased.has(b.id)):[]; localStorage.setItem("stitchd_bag",JSON.stringify(next)); return next; });
      } else {
        setOrderResult({status:"error"});
      }
    }).catch(()=>setOrderResult({status:"error"}));
  },[]);

  useEffect(()=>{
    if(user&&token){
      db.getProfile(user.id,token).then(p=>{ if(p){setProfile(p);setProfForm({username:p.username||"",full_name:p.full_name||"",location:p.location||"",region:p.region||"",currency:p.currency||"USD",bio:p.bio||"",specialises_in:p.specialises_in||[],avatar_url:p.avatar_url||"",avatarFile:null,avatarPreview:p.avatar_url||"",bust:p.bust||"",waist:p.waist||"",hips:p.hips||"",height:p.height||"",preferred_size:p.preferred_size||"",is_tailor:p.is_tailor||false,tailor_services:p.tailor_services||[],tailor_price_from:p.tailor_price_from||"",accepting_clients:p.accepting_clients!==false});} });
      loadConversations();
      db.getFollowing(user.id,token).then(setFollowing);
      db.getNotifications(user.id,token).then(setNotifications);
      loadSavedSearches();
      loadMyWishlist();
    } else {
      setMyWishlist(new Set());
    }
  },[user,token]);

  async function fetchItems(){
    setLoading(true); setError("");
    try{ const data = await db.getAll(token); setItems(data); }
    catch(e){ try{ setItems(await db.getAll(null)); }catch(e2){ setError(`Error: ${e2.message}`); } }
    finally{ setLoading(false); }
  }

  const visible = useMemo(()=>items.filter(i=>{
    const matchCat  = catFilter==="All"||i.category===catFilter;
    const matchSize = sizeFilter==="All"||i.size===sizeFilter;
    const matchMin  = minPrice===""||i.price>=parseFloat(minPrice);
    const matchMax  = maxPrice===""||i.price<=parseFloat(maxPrice);
    const matchType = typeFilter==="All"||(typeFilter==="Jewellery"?JEWELLERY_CATS.includes(i.category):typeFilter==="Shoes"?SHOE_CATS.includes(i.category):(typeFilter==="Clothing"?CATEGORIES.includes(i.category):true));
    const matchCond = condFilter==="All"||i.condition===condFilter;
    const matchFit  = !showSizeMatch||fitsMe(i)===true;
    const q=search.toLowerCase();
    const matchSearch=!q||i.name?.toLowerCase().includes(q)||i.description?.toLowerCase().includes(q)||i.fabric?.toLowerCase().includes(q)||i.category?.toLowerCase().includes(q)||i.origin?.toLowerCase().includes(q)||i.material?.toLowerCase().includes(q);
    return matchCat&&matchSize&&matchMin&&matchMax&&matchSearch&&matchType&&matchFit&&matchCond;
  }),[items,catFilter,sizeFilter,minPrice,maxPrice,search,typeFilter]);

  function flash(m,dur=3500){ setToast(m); setTimeout(()=>setToast(""),dur); }

  useEffect(()=>{
    const el=document.getElementById("chat-messages");
    if(el) el.scrollTop=el.scrollHeight;
  },[messages]);

  useEffect(()=>{ window.scrollTo({top:0,behavior:"smooth"}); },[view]);

  // Returns a guaranteed-fresh access token, refreshing first if the current one
  // is expired or about to expire. Throws a clear, user-facing error if the
  // session can't be refreshed (e.g. an old Google login saved with no
  // refresh_token) so the caller can tell the user to sign in again.
  const getValidToken = useCallback(async(force=false)=>{
    if(!session?.access_token) return null;
    if(!force && !isTokenExpired(session.access_token)) return session.access_token;
    if(!session.refresh_token){
      auth.clearSession(); setSession(null);
      throw new Error("Your session has expired. Please sign out and sign in again.");
    }
    try{
      const fresh=await auth.refreshSession(session.refresh_token);
      const next={...session,...fresh,user:fresh.user||session.user};
      auth.saveSession(next); setSession(next);
      return fresh.access_token;
    }catch(e){
      auth.clearSession(); setSession(null);
      throw new Error("Your session has expired. Please sign in again.");
    }
  },[session]);

  // Runs a token-using operation and, if it fails specifically because the token
  // expired mid-flight (a window the pre-check can miss — clock skew, a slow
  // multi-image upload, or the tab being backgrounded), force-refreshes and
  // retries ONCE. This is what makes the listing flow self-heal instead of
  // surfacing "JWT expired" / `"exp" claim timestamp check failed`.
  const withFreshToken = useCallback(async(fn)=>{
    const tok=await getValidToken();
    try{ return await fn(tok); }
    catch(e){
      if(isExpiredTokenErr(e) && session?.refresh_token){
        const fresh=await getValidToken(true);
        return await fn(fresh);
      }
      throw e;
    }
  },[getValidToken,session?.refresh_token]);

  // Refresh the token the moment the app loads (and whenever the refresh token
  // changes), then keep it fresh on a timer. Refreshing on mount means an
  // already-expired session heals itself instead of erroring on the next action.
  useEffect(()=>{
    if(!session?.refresh_token) return;
    let cancelled=false;
    const doRefresh=async()=>{
      try{
        const fresh=await auth.refreshSession(session.refresh_token);
        if(cancelled) return;
        const next={...session,...fresh,user:fresh.user||session.user};
        auth.saveSession(next); setSession(s=>({...s,...fresh}));
      }catch(e){ if(!cancelled){ auth.clearSession(); setSession(null); } }
    };
    if(isTokenExpired(session.access_token)) doRefresh();
    const interval=setInterval(doRefresh, 10*60*1000);
    return ()=>{ cancelled=true; clearInterval(interval); };
  },[session?.refresh_token]);

  useEffect(()=>{
    if(!user||!token) return;
    const interval=setInterval(()=>{ db.getNotifications(user.id,token).then(setNotifications); },30000);
    return ()=>clearInterval(interval);
  },[user,token]);

  function togOcc(o){ setForm(f=>({...f,occasions:f.occasions.includes(o)?f.occasions.filter(x=>x!==o):[...f.occasions,o]})); }
  function clearFilters(){ setSearch(""); setCatFilter("All"); setSizeFilter("All"); setMinPrice(""); setMaxPrice(""); setTypeFilter("All"); setCondFilter("All"); }
  const hasFilters = search||catFilter!=="All"||sizeFilter!=="All"||minPrice||maxPrice||typeFilter!=="All"||condFilter!=="All";

  function toggleWishlist(id){
    setWishlist(prev=>{
      const next=prev.includes(id)?prev.filter(x=>x!==id):[...prev,id];
      localStorage.setItem("stitchd_wishlist",JSON.stringify(next));
      return next;
    });
  }

  const inBag = (id) => bag.some(b=>b.id===id);

  // Add/remove a listing from the bag (toggle). Each piece is one-of-a-kind so the
  // bag never holds more than one of the same listing — adding an item already in
  // the bag removes it. Stores a small snapshot so the panel needs no extra fetch.
  function toggleBag(item){
    setBag(prev=>{
      let next;
      if(prev.some(b=>b.id===item.id)){
        next=prev.filter(b=>b.id!==item.id);
        flash("Removed from bag.");
      } else {
        const snapshot={
          id:item.id,
          name:item.name,
          price:item.price,
          currency:item.currency,
          image:item.image_url||(item.images&&item.images[0])||"",
          emoji:item.emoji||catEmoji(item.category),
          seller:item.seller_username||item.seller_name||item.username||"",
          sold:!!item.sold,
        };
        next=[...prev,snapshot];
        flash("🛍️ Added to bag!");
      }
      localStorage.setItem("stitchd_bag",JSON.stringify(next));
      return next;
    });
  }

  function removeFromBag(id){
    setBag(prev=>{
      const next=prev.filter(b=>b.id!==id);
      localStorage.setItem("stitchd_bag",JSON.stringify(next));
      return next;
    });
  }

  const bagTotal = bag.reduce((sum,b)=>sum+(parseFloat(b.price)||0),0);

  // PROCEED TO CHECKOUT → create a Stripe Checkout Session server-side and
  // redirect to the hosted checkout page. No Stripe secret key ever touches
  // the frontend (see src/lib/checkout.js + the stripe-checkout Edge Function).
  async function doCheckout(){
    if(checkingOut||!bag.length) return;
    setCheckingOut(true);
    flash("Taking you to secure checkout…");
    try{
      await startCheckout(bag,{buyerId:user?.id,buyerEmail:user?.email});
    }catch(e){
      flash(`Checkout failed: ${errMsg(e)}`);
      setCheckingOut(false);
    }
  }

  // BUY NOW (single listing) → same hosted-checkout redirect as the bag. Stripe
  // blocks card entry when its checkout is embedded in a modal/iframe, so we hand
  // the buyer straight to Stripe's hosted page via window.location.href (inside
  // startCheckout) instead of opening the in-page payment modal.
  //
  // Deliberately NO sign-in gate here: this mirrors the bag's doCheckout, which
  // lets guests check out and passes a null buyer id / empty email so Stripe's
  // hosted page collects the email itself. The old `if(!user) → setView("auth")`
  // guard bounced signed-out buyers (and anyone whose session had silently
  // expired) straight back to the login screen instead of to Stripe — the
  // "click buy now and it just sends me to sign in again" bug.
  async function buyNow(listing){
    if(!listing||checkingOut) return;
    setCheckingOut(true);
    flash("Taking you to secure checkout…");
    try{
      await startCheckout([listing],{buyerId:user?.id,buyerEmail:user?.email});
    }catch(e){
      flash(`Checkout failed: ${errMsg(e)}`);
      setCheckingOut(false);
    }
  }

  function shareItem(item){
    const text=`Check out "${item.name}" for £${item.price} on Stitch'd 🩷`;
    if(navigator.share){ navigator.share({title:item.name,text,url:window.location.href}).catch(()=>{}); }
    else{ navigator.clipboard.writeText(`${text}\n${window.location.href}`).then(()=>flash("🔗 Link copied!")); }
  }

  // Reviews only store reviewer_id, so resolve those ids to profiles in one batch
  // and attach a display `reviewer_name` (first name) for the review cards. Falls
  // back to the raw rows if the profile lookup fails so reviews still render.
  async function loadReviews(sellerId){
    const revs=await db.getReviews(sellerId,token);
    const ids=[...new Set(revs.map(r=>r.reviewer_id).filter(Boolean))];
    if(!ids.length) return revs;
    try{
      const profs=await db.getProfilesByIds(ids,token);
      const byId={}; profs.forEach(p=>{ byId[p.id]=p; });
      return revs.map(r=>{
        const name=(byId[r.reviewer_id]?.full_name||byId[r.reviewer_id]?.username||"").trim();
        return {...r,reviewer_name:name?name.split(/\s+/)[0]:"Anonymous"};
      });
    }catch(e){ return revs; }
  }

  async function submitReview(){
    if(!user||!sel)return;
    try{
      await db.insertReview({listing_id:sel.id,reviewer_id:user.id,seller_id:sel.user_id,rating:reviewForm.rating,comment:reviewForm.comment},token);
      setReviews(await loadReviews(sel.user_id)); setShowReview(false); setReviewForm({rating:5,comment:""});
      // Refresh the grid-wide rating lookup so the new review updates card stars too.
      loadSellerRatings();
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

  async function loadBundles(){
    if(!user||!token) return;
    const myBundles=await db.getBundles(user.id,token);
    setBundles(myBundles);
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

  const getSellerTier = (p) => {
    if(!p) return null;
    if(p.verified) return {label:"✓ VERIFIED",color:"#34C759"};
    if(p.seller_tier==="top") return {label:"⭐ TOP SELLER",color:"#FF9500"};
    if(p.seller_tier==="trusted") return {label:"👍 TRUSTED",color:"#007AFF"};
    return null;
  };

  const unreadNotifs = notifications.filter(n=>!n.read).length;

  function getSuggestions(q){
    if(!q||q.length<2) return [];
    const lower=q.toLowerCase();
    const matches=new Set();
    items.forEach(i=>{
      if(i.name?.toLowerCase().includes(lower)) matches.add(i.name);
      if(i.category?.toLowerCase().includes(lower)) matches.add(i.category);
      if(i.fabric?.toLowerCase().includes(lower)) matches.add(i.fabric);
      if(i.origin?.toLowerCase().includes(lower)) matches.add(i.origin);
      if(i.material?.toLowerCase().includes(lower)) matches.add(i.material);
    });
    [...ALL_CATEGORIES,...OCCASIONS,...ORIGINS,...FABRICS].forEach(s=>{
      if(s.toLowerCase().includes(lower)) matches.add(s);
    });
    return [...matches].slice(0,6);
  }

  function handleSearchInput(val){
    setSearch(val);
    if(val.length>=2){ setSearchSuggestions(getSuggestions(val)); setShowSuggestions(true); }
    else { setShowSuggestions(false); setSearchSuggestions([]); }
  }

  async function loadSavedSearches(){
    if(!user||!token) return;
    const searches=await db.getSavedSearches(user.id,token);
    setSavedSearches(searches);
  }

  async function saveCurrentSearch(){
    if(!search.trim()||!user){ flash("Sign in to save searches!"); return; }
    try{
      await db.saveSearch({user_id:user.id,query:search,filters:{catFilter,sizeFilter,minPrice,maxPrice,typeFilter}},token);
      await loadSavedSearches();
      flash("🔔 Search saved! We'll notify you of new matches.");
    }catch(e){ flash("Failed to save search."); }
  }

  async function deleteSavedSearch(id){
    try{ await db.deleteSavedSearch(id,token); setSavedSearches(p=>p.filter(s=>s.id!==id)); }
    catch(e){ flash("Failed to delete."); }
  }

  function applySearch(q){ setSearch(q); setShowSuggestions(false); setSearchSuggestions([]); }

  async function loadOrders(){
    if(!user||!token) return;
    setOrdersLoading(true);
    const orders=await db.getMyOrders(user.id,token);
    setMyOrders(orders);
    // Fetch the counterpart profiles (the OTHER party on each order) so the seller
    // can see the buyer's first name and the buyer can see the seller's name
    // without a per-card request (issue PART 2 / PART 3).
    const ids=[...new Set(orders.flatMap(o=>[o.buyer_id,o.seller_id]).filter(Boolean).filter(id=>id!==user.id))];
    const profs={};
    await Promise.all(ids.map(async id=>{ const p=await db.getProfile(id,token); if(p)profs[id]=p; }));
    setOrderProfiles(profs);
    setOrdersLoading(false);
  }

  // Seller moves an order through PENDING → DISPATCHED → DELIVERED (issue PART 5).
  // Each transition updates the orders table and notifies the buyer with the exact
  // wording the issue specifies. Guest orders (no buyer_id) simply skip the notify.
  async function updateOrderStatus(orderId,newStatus){
    const order=myOrders.find(o=>o.id===orderId);
    try{
      // Only patch `status` — it's the one column the orders table is guaranteed to
      // have. db.updateOrder isn't self-healing, so sending an optional column the
      // deployment lacks (e.g. shipped_at) would fail the whole update.
      await db.updateOrder(orderId,{status:newStatus},token);
      setMyOrders(p=>p.map(o=>o.id===orderId?{...o,status:newStatus}:o));
      if(order){
        const title=items.find(i=>i.id===order.listing_id)?.name||"your order";
        if(newStatus==="dispatched") await notify(order.buyer_id,"order","📦 Order dispatched",`Your order ${title} has been dispatched by the seller`,order.listing_id);
        if(newStatus==="delivered")  await notify(order.buyer_id,"order","✅ Order delivered",`Your order ${title} has been marked as delivered`,order.listing_id);
      }
      flash(`Order marked ${newStatus.toUpperCase()}.`);
    }catch(e){ flash("Failed to update order status."); }
  }

  // Open (or reuse) the conversation tied to an order, working for BOTH parties:
  // the buyer "MESSAGE SELLER" and the seller "MESSAGE BUYER" land in the same
  // thread because the conversation is keyed by the order's fixed buyer/seller ids
  // rather than by who is currently signed in (unlike startConversation).
  async function startOrderConversation(order){
    if(!user){ setAuthMode("login"); setView("auth"); return; }
    if(!order.buyer_id){ flash("This was a guest checkout — there's no buyer account to message."); return; }
    const { buyer_id:buyerId, seller_id:sellerId, listing_id:listingId }=order;
    try{
      let conv=await db.findConversation(buyerId,sellerId,listingId,token);
      if(!conv){ conv=await db.createConversation({listing_id:listingId,buyer_id:buyerId,seller_id:sellerId,last_message:"",last_message_at:new Date().toISOString()},token); }
      await loadConversations();
      setActiveConv(conv);
      setMessages(await db.getMessages(conv.id,token));
      setView("messages");
    }catch(e){ flash("Could not start conversation."); }
  }

  async function loadHomeSections(){
    const [newL,drops,trending]=await Promise.all([db.getNewListings(token),db.getPriceDrops(token),db.getTrending(token)]);
    setNewListings(newL); setPriceDrops(drops); setTrendingItems(trending);
  }

  useEffect(()=>{ loadHomeSections(); },[]);

  // Fetch every review once (only seller_id + rating columns) and aggregate into a
  // seller_id -> {average, count} lookup. One request for the whole grid beats a
  // per-card fetch, and the same average formula as the Detail view is reused.
  async function loadSellerRatings(){
    const rows=await db.getAllReviewStats(token);
    const bySeller={};
    rows.forEach(r=>{ (bySeller[r.seller_id]=bySeller[r.seller_id]||[]).push(r.rating); });
    const lookup={};
    Object.entries(bySeller).forEach(([sid,ratings])=>{
      lookup[sid]={average:ratings.reduce((a,r)=>a+r,0)/ratings.length,count:ratings.length};
    });
    setSellerRatings(lookup);
  }

  useEffect(()=>{ loadSellerRatings(); },[]);

  // Fetch every wishlist row once (listing_id only) and aggregate into a
  // listing_id -> count map for the whole grid — one request beats a per-card
  // count, same shape as loadSellerRatings.
  async function loadWishlistCounts(){
    const rows=await db.getAllWishlists(token);
    const counts={};
    rows.forEach(r=>{ counts[r.listing_id]=(counts[r.listing_id]||0)+1; });
    setWishlistCounts(counts);
  }
  useEffect(()=>{ loadWishlistCounts(); },[]);

  // The signed-in user's own saved listing_ids, so cards render a filled heart.
  // Cleared on sign-out. Loaded alongside the other per-user data below.
  async function loadMyWishlist(){
    if(!user||!token){ setMyWishlist(new Set()); return; }
    const rows=await db.getMyWishlist(user.id,token);
    setMyWishlist(new Set(rows.map(r=>r.listing_id)));
  }

  // Toggle a DB favourite. Logged-out clicks are sent to sign-in. Updates the
  // count + my-set optimistically and rolls back if the request fails.
  async function toggleFavourite(item){
    if(!user||!token){ flash("Sign in to wishlist this piece!"); setAuthMode("login"); setView("auth"); return; }
    const id=item.id, has=myWishlist.has(id);
    setMyWishlist(prev=>{ const n=new Set(prev); has?n.delete(id):n.add(id); return n; });
    setWishlistCounts(prev=>({...prev,[id]:Math.max(0,(prev[id]||0)+(has?-1:1))}));
    try{
      if(has) await db.removeWishlist(user.id,id,token);
      else    await db.addWishlist(user.id,id,token);
    }catch(e){
      setMyWishlist(prev=>{ const n=new Set(prev); has?n.add(id):n.delete(id); return n; });
      setWishlistCounts(prev=>({...prev,[id]:Math.max(0,(prev[id]||0)+(has?1:-1))}));
      flash("Couldn't update wishlist. Try again.");
    }
  }

  // Fetch once the set of seller ids flagged fast_seller=true on their profile, so
  // cards/Detail can show a "⚡ FAST SELLER" badge without a per-card profile fetch.
  // Mirrors the seller-ratings lookup: one request feeds the whole grid.
  async function loadFastSellers(){
    const rows=await db.getFastSellers(token);
    setFastSellers(new Set(rows.map(r=>r.id)));
  }

  useEffect(()=>{ loadFastSellers(); },[]);

  async function loadTailors(){
    const r=await fetch(`${SUPABASE_URL}/rest/v1/profiles?is_tailor=eq.true`,{headers:hdrs(token)});
    if(r.ok) setTailorProfiles(await r.json());
  }

  async function loadTailorMarket(){
    const services=await db.getTailorServices(token);
    setTailorServices(services);
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
      if(editingService){ await db.updateTailorService(editingService.id,payload,token); flash("✓ Service updated!"); }
      else { await db.insertTailorService(payload,token); flash("🩷 Service listed!"); }
      setShowTailorForm(false); setEditingService(null);
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
      let conv=await db.findConversation(user.id,service.tailor_id,null,token);
      if(!conv) conv=await db.createConversation({listing_id:null,buyer_id:user.id,seller_id:service.tailor_id,last_message:`Booking request: ${service.title}`,last_message_at:new Date().toISOString()},token);
      await db.sendMessage({conversation_id:conv.id,sender_id:user.id,content:`✂️ BOOKING REQUEST\n\nService: ${service.title}\nStarting from: ${currencySymbol(profile?.currency)}${service.price_from}\nTurnaround: ${service.turnaround_days?`${service.turnaround_days} days`:"TBC"}\n\nNotes: ${bookingNotes||"No notes added"}`,message_type:"text"},token);
      await notify(service.tailor_id,"booking",`✂️ New booking request!`,`${profile?.username||"Someone"} wants to book "${service.title}"`,conv.id);
      setShowBookingForm(false); setBookingNotes(""); setSelectedService(null);
      flash("🎉 Booking request sent! Check your messages.");
      await loadConversations(); setView("messages");
    }catch(e){flash("Failed to send booking.");}
  }

  function fitsMe(item){
    if(!profile?.bust&&!profile?.waist&&!profile?.hips) return null;
    if(!item.bust&&!item.waist&&!item.hips) return null;
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
    try{ const data=await auth.enroll2FA(token); setTwoFAData(data); setTwoFAStep("enroll"); }
    catch(e){ flash("Failed to set up 2FA: "+e.message); }
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
    try{ await auth.unenroll2FA(factorId,token); setTwoFAFactors(p=>p.filter(f=>f.id!==factorId)); flash("2FA disabled."); }
    catch(e){ flash("Failed to disable 2FA."); }
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
    const otherIds=[...new Set(convs.map(c=>c.buyer_id===user.id?c.seller_id:c.buyer_id))];
    const profiles={};
    await Promise.all(otherIds.map(async id=>{ const p=await db.getProfile(id,token); if(p)profiles[id]=p; }));
    setConvProfiles(profiles);
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
    setConversations(p=>p.map(c=>c.id===conv.id?{...c,unread_count:0}:c));
  }

  async function startConversation(listing){
    if(!user){ setAuthMode("login"); setView("auth"); return; }
    if(listing.user_id===user.id){ flash("You can't message yourself!"); return; }
    try{
      let conv=await db.findConversation(user.id,listing.user_id,listing.id,token);
      if(!conv){ conv=await db.createConversation({listing_id:listing.id,buyer_id:user.id,seller_id:listing.user_id,last_message:"",last_message_at:new Date().toISOString()},token); }
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
        : status==="declined" ? `❌ Offer declined.`
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
        await auth.sendOTP(aForm.email);
        setOtpEmail(aForm.email); setOtpStep("otp");
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
    auth.clearSession(); setSession(null); setProfile(null);
    setFollowing([]); setConversations([]); setMessages([]);
    setBundles([]); setUnreadCount(0); setView("shop");
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
    const revs=await loadReviews(userId);
    setViewedProfile(p||{id:userId,username:"Seller",bio:""});
    setProfileListings(listings); setReviews(revs); setView("profile");
  }

  async function add(){
    if(!form.name||!form.price)return;
    if(!user){setView("auth");return;}
    setSaving(true);
    let urls=[];
    try{
      urls=await withFreshToken(tok=>Promise.all(form.imageFiles.map(f=>uploadImage(f,tok))));
    }catch(e){
      console.error("Listing image upload failed:",e);
      flash(errMsg(e),9000);
      setSaving(false);
      if(/sign (in|out)/i.test(errMsg(e))) setView("auth");
      return;
    }
    try{
      const image_url=urls[0]||"";
      const meas=buildMeasPayload(form);
      const cat=meas.category||form.category;
      const payload={name:form.name,price:parseFloat(form.price),condition:form.condition,listing_type:form.listing_type,category:cat,origin:form.origin,fabric:form.listing_type==="Clothing"?form.fabric:"",material:form.listing_type==="Jewellery"?form.material:"",size:form.listing_type==="Clothing"?form.size:"",occasions:form.occasions,...meas,can_take_in:form.listing_type==="Clothing"?form.can_take_in:false,spare_fabric:form.listing_type==="Clothing"?form.spare_fabric:false,description:form.description,emoji:catEmoji(cat),sold:false,reserved:false,views:0,image_url,images:urls,user_id:user.id,currency:profile?.currency||"USD",postage_options:form.postage_options||[],accepts_collection:form.accepts_collection||false};
      const [created]=await withFreshToken(tok=>db.insert(payload,tok));
      setItems(p=>[created,...p]); setForm(EMPTY_FORM);
      // The photo uploaded fine but didn't come back on the saved row — the
      // self-healing insert (see lib/db.js) silently drops columns the table is
      // missing, so an absent image_url column means the photo is lost. Surface
      // it instead of a misleading plain "Listed!".
      if(urls.length&&!created.image_url){ flash("⚠️ Listed — but the photo couldn't be saved: your 'listings' table has no image_url column. Add image_url (text) and images (text[]) columns in Supabase so photos persist.",11000); }
      else{ flash("🩷 Listed!"); }
      setView("shop");
      // The listing is already saved at this point. Notifying followers is a
      // best-effort extra — if it throws (e.g. a follows/notifications RLS issue)
      // it must NOT fall into the catch below and show a false "Couldn't save
      // listing" toast for a listing that actually saved fine.
      try{
        const ntok=await getValidToken();
        const myFollowers=await db.getFollowers(user.id,ntok);
        await Promise.all(myFollowers.map(f=>notify(f.follower_id,"new_listing",`✨ New drop from ${profile?.username||"a seller you follow"}`,`"${payload.name}" listed for ${currencySymbol(payload.currency||"USD")}${payload.price}`,created.id)));
      }catch(e){ console.warn("Post-listing follower notifications failed (listing was saved):",e); }
    }catch(e){ console.error("Listing insert failed:",e); flash(`Couldn't save listing: ${errMsg(e)}`,9000); }
    finally{ setSaving(false); }
  }

  async function saveEdit(){
    if(!form.name||!form.price)return; setSaving(true);
    let newUrls=[];
    try{
      newUrls=await withFreshToken(tok=>Promise.all(form.imageFiles.map(f=>uploadImage(f,tok))));
    }catch(e){
      console.error("Listing image upload failed:",e);
      flash(errMsg(e),9000);
      setSaving(false);
      if(/sign (in|out)/i.test(errMsg(e))) setView("auth");
      return;
    }
    try{
      const existingUrls=(sel.images||[]).filter((_,i)=>form.imagePreviews[i]&&!form.imageFiles[i]);
      const allUrls=[...existingUrls,...newUrls];
      const image_url=allUrls[0]||sel.image_url||"";
      const meas=buildMeasPayload(form);
      const cat=meas.category||form.category;
      const patch={name:form.name,price:parseFloat(form.price),condition:form.condition,listing_type:form.listing_type,category:cat,origin:form.origin,fabric:form.listing_type==="Clothing"?form.fabric:"",material:form.listing_type==="Jewellery"?form.material:"",size:form.listing_type==="Clothing"?form.size:"",occasions:form.occasions,...meas,can_take_in:form.listing_type==="Clothing"?form.can_take_in:false,spare_fabric:form.listing_type==="Clothing"?form.spare_fabric:false,description:form.description,emoji:catEmoji(cat),image_url,images:allUrls,postage_options:form.postage_options||[],accepts_collection:form.accepts_collection||false};
      const [updated]=await withFreshToken(tok=>db.update(sel.id,patch,tok));
      setItems(p=>p.map(i=>i.id===sel.id?updated:i)); setSel(updated);
      if(allUrls.length&&!updated.image_url){ flash("⚠️ Saved — but the photo couldn't be stored: your 'listings' table has no image_url column. Add image_url (text) and images (text[]) columns in Supabase.",11000); }
      else{ flash("✓ Updated!"); }
      setView("detail");
      // The update is already saved. Price-drop notifications are best-effort and
      // must not fall into the catch below and show a false "Couldn't update
      // listing" toast for an update that actually succeeded.
      try{
        if(parseFloat(form.price)<sel.price){
          const ntok=await getValidToken();
          const myFollowers=await db.getFollowers(user.id,ntok);
          await Promise.all(myFollowers.map(f=>notify(f.follower_id,"price_drop",`📉 Price drop on "${sel.name}"`,`Now ${currencySymbol(updated.currency)}${form.price} (was ${currencySymbol(sel.currency)}${sel.price})`,sel.id)));
        }
      }catch(e){ console.warn("Price-drop notifications failed (listing was updated):",e); }
    }catch(e){ console.error("Listing update failed:",e); flash(`Couldn't update listing: ${errMsg(e)}`,9000); }
    finally{ setSaving(false); }
  }

  function openEdit(item){
    // Hydrate the new gender/unit/garment measurement model. Newer listings carry
    // a `measurements` JSON; older ones only have legacy bust/waist/… columns (in
    // inches), which we map back onto the default garment's field labels.
    const pm=parseMeasurements(item);
    const gender=pm?.gender||"women";
    const garment_type=pm?.garment||defaultGarmentFor(gender,item.category||"Other");
    const meas_unit=pm?.unit||item.measurements_unit||"inches";
    let meas=pm?.values?{...pm.values}:{};
    if(!pm){ garmentFieldsFor(gender,garment_type).forEach(l=>{ const col=({"Bust":"bust","Chest":"bust","Blouse bust":"bust","Waist":"waist","Hip":"hips","Hips":"hips","Length":"length","Length (floor to shoulder)":"length","Saree length":"length","Lehenga length":"length","Sherwani length":"length","Kurta length":"length","Sleeve length":"sleeve_length","Blouse sleeve length":"sleeve_length","Shoulder width":"shoulder","Inseam":"inseam"})[l]; if(col&&item[col]) meas[l]=item[col]; }); }
    setForm({name:item.name||"",price:item.price||"",condition:item.condition||"Like New",listing_type:item.listing_type||"Clothing",category:item.category||"Saree",origin:item.origin||"Indian",fabric:item.fabric||"Silk",material:item.material||"",size:item.size||"Free Size",occasions:item.occasions||[],gender,meas_unit,garment_type,meas,additional_measurements:item.additional_measurements||item.measurement_notes||"",bust:item.bust||"",waist:item.waist||"",hips:item.hips||"",length:item.length||"",underbust:item.underbust||"",shoulder:item.shoulder||"",high_hip:item.high_hip||"",sleeve_length:item.sleeve_length||"",inseam:item.inseam||"",measurement_notes:item.measurement_notes||"",can_take_in:item.can_take_in||false,spare_fabric:item.spare_fabric||false,description:item.description||"",imageFiles:[],imagePreviews:item.images||[item.image_url].filter(Boolean),postage_options:item.postage_options||[],accepts_collection:item.accepts_collection||false});
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
    if(item.user_id) loadReviews(item.user_id).then(setReviews);
  }

  const selIdx   = sel?items.findIndex(i=>i.id===sel.id):0;
  const selColor = CARD_COLORS[Math.max(0,selIdx)%CARD_COLORS.length];
  const isOwner  = (item)=>user&&item.user_id===user.id;
  const myItems  = items.filter(i=>i.user_id===user?.id);
  const selImages= sel?(sel.images&&sel.images.length>0?sel.images:[sel.image_url].filter(Boolean)):[];
  const similarItems = sel ? items.filter(i=>i.id!==sel.id&&(i.category===sel.category||i.fabric===sel.fabric||i.origin===sel.origin)).slice(0,4) : [];
  const recentItems  = items.filter(i=>recentlyViewed.includes(i.id)&&(!sel||i.id!==sel.id)).slice(0,4);
  const wishlistItems= items.filter(i=>wishlist.includes(i.id));

  // Items collapsed behind the desktop hover-dropdown / mobile hamburger menu.
  // Favourites, Notifications and LIST IT deliberately stay out of this list —
  // they remain always-visible in the navbar. Each onClick also closes whichever
  // menu was open so navigating dismisses the overlay.
  const navMenuItems = [
    {label:"MY DROPS",       run:()=>{loadBundles();loadOrders();setView("dashboard");}},
    {label:"MY ORDERS",      run:()=>{loadOrders();setView("orders");}},
    {label:"✦ FEED",         run:()=>{loadFeed();setView("feed");}},
    {label:"MESSAGES",       run:openMessages},
    {label:"MY PROFILE",     run:()=>{load2FAFactors();setView("editprofile");}},
    {label:"HOW TO MEASURE", run:()=>{setPrevView(view);setView("measuring");}},
    {label:"LOG OUT",        run:handleSignOut, danger:true},
  ];
  const runNavItem = (item)=>{ setNavMenuOpen(false); setMobileNavOpen(false); item.run(); };

  return (
    <div style={S.root}>
      <style>{CSS}</style>

      {/* HEADER */}
      <header style={S.header}>
        <div className="nav-hwrap" style={S.hWrap}>
          <div className="nav-logo" style={S.logoWrap} onClick={()=>setView("shop")}><span style={S.logoText}>STITCH'D</span><span style={S.logoTM}>™</span></div>
          <div className="nav-category-strip" style={S.hMid}><div style={S.marqueeTrack}><span style={S.marqueeInner}>{Array(4).fill("SOUTH ASIAN PRE-LOVED FASHION \u00a0✦\u00a0 SAREES \u00a0✦\u00a0 LEHENGAS \u00a0✦\u00a0 SHERWANIS \u00a0✦\u00a0 REAL MEASUREMENTS \u00a0✦\u00a0 ").join("")}</span></div></div>
          <div className="nav-right" style={S.hRight}>
            <span style={S.hLive}>{items.filter(i=>!i.sold).length} LIVE</span>
            <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111",position:"relative"}} onClick={()=>setView("wishlist")}>
              <Heart width={18} height={18} style={{verticalAlign:"middle"}}/> {wishlist.length>0&&<span style={S.wishBadge}>{wishlist.length}</span>}
            </button>
            {user?(
              <>
                {/* SHOPPING BAG — signed-in only, sits alongside Notifications. */}
                <button className="hbtn" style={{...S.hBtn,background:showBag?"#FF1493":"#fff",color:showBag?"#fff":"#111",border:"2px solid #111",position:"relative"}} onClick={()=>setShowBag(true)} aria-label="Shopping bag">
                  <ShoppingBag width={18} height={18} style={{verticalAlign:"middle"}}/> {bag.length>0&&<span style={S.bagBadge}>{bag.length}</span>}
                </button>
                {/* ALWAYS VISIBLE (when signed in): Notifications, then LIST IT.
                    Favourites (heart) sits just before this block. */}
                <button className="hbtn" style={{...S.hBtn,background:showNotifs?"#FF1493":"#fff",color:showNotifs?"#fff":"#111",border:"2px solid #111",position:"relative"}} onClick={()=>setShowNotifs(p=>!p)}>
                  <Bell width={18} height={18} style={{verticalAlign:"middle"}}/> {unreadNotifs>0&&<span style={S.wishBadge}>{unreadNotifs}</span>}
                </button>
                <button className="hbtn" style={S.hBtn} onClick={()=>setView("add")}>LIST IT →</button>

                {/* DESKTOP / IPAD: profile icon with hover dropdown holding the rest */}
                <div className="nav-dropdown-wrap" style={S.navDropWrap} onMouseEnter={()=>setNavMenuOpen(true)} onMouseLeave={()=>setNavMenuOpen(false)}>
                  <button className="hbtn" style={S.navIconBtn} aria-label="Account menu"><User width={18} height={18} style={{verticalAlign:"middle"}}/></button>
                  {navMenuOpen&&(
                    <div style={S.navDropdown}>
                      {navMenuItems.map((it,i)=>(
                        <button key={it.label} className={`nav-drop-item${it.danger?" nav-drop-item-danger":""}`} style={{...S.navDropItem,borderBottom:i===navMenuItems.length-1?"none":"1px solid #111",...(it.danger?S.navDropItemDanger:{})}} onClick={()=>runNavItem(it)}>{it.label}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* MOBILE: hamburger opens the full-width slide-in menu */}
                <button className="nav-hamburger hbtn" style={S.navIconBtn} aria-label="Open menu" onClick={()=>setMobileNavOpen(true)}><Menu width={20} height={20} style={{verticalAlign:"middle"}}/></button>
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

      {/* MOBILE NAV MENU — full-width slide-in, only reachable via the hamburger */}
      {user&&mobileNavOpen&&(
        <div style={S.mobileNav}>
          <div style={S.mobileNavHead}>
            <span style={S.mobileNavTitle}>MENU</span>
            <button style={S.mobileNavClose} aria-label="Close menu" onClick={()=>setMobileNavOpen(false)}><X width={26} height={26}/></button>
          </div>
          {navMenuItems.map(it=>(
            <button key={it.label} className="nav-mob-item" style={{...S.mobileNavItem,...(it.danger?S.navDropItemDanger:{})}} onClick={()=>runNavItem(it)}>{it.label}</button>
          ))}
        </div>
      )}

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
              <p style={{display:"flex",justifyContent:"center",marginBottom:8}}><Bell width={28} height={28} color="#ccc"/></p>
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

      {/* SHOPPING BAG PANEL — slide-in from the right. UI/state only; the checkout
          button is a placeholder until Stripe is wired up in a separate issue. */}
      {user&&showBag&&(
        <div style={S.bagOverlay} onClick={()=>setShowBag(false)}>
          <div style={S.bagPanel} onClick={e=>e.stopPropagation()}>
            <div style={S.bagHead}>
              <span style={S.bagTitle}><ShoppingBag width={22} height={22}/> YOUR BAG{bag.length>0?` (${bag.length})`:""}</span>
              <button style={S.bagClose} aria-label="Close bag" onClick={()=>setShowBag(false)}><X width={26} height={26}/></button>
            </div>
            {bag.length===0?(
              <div style={S.bagEmpty}>
                <ShoppingBag width={48} height={48} color="#ddd"/>
                <p style={S.bagEmptyText}>YOUR BAG IS EMPTY</p>
                <button className="hbtn" style={S.bagBrowseBtn} onClick={()=>{setShowBag(false);setView("shop");}}>BROWSE LISTINGS</button>
              </div>
            ):(
              <div style={S.bagBody}>
                {bag.map(b=>(
                  <div key={b.id} style={S.bagRow}>
                    <div style={S.bagThumb} onClick={()=>{ const item=items.find(i=>i.id===b.id); if(item){setShowBag(false);openDetail(item);} }}>
                      {b.image?<img src={b.image} alt={b.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:30}}>{b.emoji}</span>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={S.bagItemName}>{b.name}</p>
                      {b.seller&&<p style={S.bagItemSeller}>{b.seller}</p>}
                      <p style={S.bagItemPrice}>{currencySymbol(b.currency)}{b.price}</p>
                    </div>
                    <button style={S.bagRemove} aria-label="Remove from bag" onClick={()=>removeFromBag(b.id)}><X width={20} height={20}/></button>
                  </div>
                ))}
                <div style={S.bagDivider}/>
                <div style={S.bagTotalRow}>
                  <span style={S.bagTotalLabel}>TOTAL</span>
                  <span style={S.bagTotalVal}>{currencySymbol(bag[0]?.currency)}{bagTotal.toFixed(2)}</span>
                </div>
                <button className="hbtn" style={{...S.bagCheckoutBtn,opacity:checkingOut?0.6:1,cursor:checkingOut?"wait":"pointer"}} onClick={doCheckout} disabled={checkingOut}>{checkingOut?"REDIRECTING…":"PROCEED TO CHECKOUT"}</button>
                <p style={S.bagGuarantee}><Lock width={13} height={13}/> Secure checkout · Stitch'd Buyer Guarantee</p>
                <button style={S.bagContinue} onClick={()=>setShowBag(false)}>CONTINUE SHOPPING</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {showPayment&&paymentListing&&(()=>{
        const {amount,fee,sellerGets}=buildPaymentSummary(paymentListing);
        const sym=currencySymbol(paymentListing.currency);
        const postageAmount=selectedPostage?selectedPostage.selectedPrice?.price||0:0;
        const totalAmount=parseFloat((amount+postageAmount).toFixed(2));
        return(
          <div style={S.modalOverlay} onClick={()=>setShowPayment(false)}>
            <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,paddingBottom:16,borderBottom:"3px solid #111"}}>
                <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900,letterSpacing:-0.5,display:"inline-flex",alignItems:"center",gap:10}}>
                  {paymentStep==="success"?<><PartyPopper width={24} height={24}/> PAYMENT DONE!</>:<><CreditCard width={24} height={24}/> BUY THIS PIECE</>}
                </h3>
                <button style={{background:"none",border:"none",fontSize:20,cursor:"pointer",fontWeight:900}} onClick={()=>setShowPayment(false)}>✕</button>
              </div>
              {paymentStep==="success"?(
                <div style={{textAlign:"center",padding:"32px 0"}}>
                  <p style={{display:"flex",justifyContent:"center",marginBottom:16}}><PartyPopper width={60} height={60} color="#FF1493"/></p>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:900,marginBottom:8}}>PAYMENT SUCCESSFUL!</p>
                  <p style={{fontSize:14,color:"#888",marginBottom:24}}>The seller has been notified and will be in touch about shipping.</p>
                  <button className="hbtn" style={{...S.hBtn,padding:"12px 28px",fontSize:14}} onClick={()=>{setShowPayment(false);setPaymentStep("summary");}}>DONE →</button>
                </div>
              ):(
                <>
                  <div style={{display:"flex",gap:16,marginBottom:24,padding:"16px",background:"#fafafa",border:"2px solid #f0f0f0"}}>
                    {paymentListing.image_url&&<img src={paymentListing.image_url} alt="" style={{width:80,height:80,objectFit:"cover",border:"2px solid #111",flexShrink:0}}/>}
                    <div>
                      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:800,marginBottom:4}}>{paymentListing.name}</p>
                      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,color:"#888",letterSpacing:1,marginBottom:4}}>{paymentListing.category?.toUpperCase()} · {paymentListing.condition?.toUpperCase()}</p>
                      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,color:"#FF1493"}}>{sym}{amount}</p>
                    </div>
                  </div>
                  <div style={{marginBottom:24}}>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:2,color:"#999",marginBottom:12,display:"inline-flex",alignItems:"center",gap:6}}><Mail width={16} height={16}/> DELIVERY ADDRESS</p>
                    {!showAddressForm&&deliveryAddress.line1?(
                      <div style={{border:"2px solid #34C759",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div>
                          <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800}}>{deliveryAddress.name}</p>
                          <p style={{fontSize:12,color:"#666"}}>{deliveryAddress.line1}{deliveryAddress.line2?`, ${deliveryAddress.line2}`:""}, {deliveryAddress.city}, {deliveryAddress.postcode}</p>
                        </div>
                        <button style={{background:"none",border:"none",color:"#FF1493",fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,cursor:"pointer"}} onClick={()=>setShowAddressForm(true)}>CHANGE</button>
                      </div>
                    ):(
                      <div style={{border:"2px solid #e0e0e0",padding:"16px",display:"flex",flexDirection:"column",gap:10}}>
                        <F l="FULL NAME"><input style={S.inp} placeholder="Aisha Khan" value={deliveryAddress.name} onChange={e=>setDeliveryAddress(a=>({...a,name:e.target.value}))}/></F>
                        <F l="ADDRESS LINE 1"><input style={S.inp} placeholder="123 Main Street" value={deliveryAddress.line1} onChange={e=>setDeliveryAddress(a=>({...a,line1:e.target.value}))}/></F>
                        <F l="ADDRESS LINE 2 (OPTIONAL)"><input style={S.inp} placeholder="Flat 2" value={deliveryAddress.line2} onChange={e=>setDeliveryAddress(a=>({...a,line2:e.target.value}))}/></F>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                          <F l="CITY"><input style={S.inp} placeholder="London" value={deliveryAddress.city} onChange={e=>setDeliveryAddress(a=>({...a,city:e.target.value}))}/></F>
                          <F l="POSTCODE"><input style={S.inp} placeholder="E1 6RF" value={deliveryAddress.postcode} onChange={e=>setDeliveryAddress(a=>({...a,postcode:e.target.value}))}/></F>
                        </div>
                        {deliveryAddress.line1&&<button className="hbtn" style={{...S.hBtn,background:"#34C759",border:"none",fontSize:11,padding:"10px",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6}} onClick={()=>setShowAddressForm(false)}><Check width={16} height={16}/> SAVE ADDRESS</button>}
                      </div>
                    )}
                  </div>
                  <div style={{marginBottom:24}}>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:2,color:"#999",marginBottom:12,display:"inline-flex",alignItems:"center",gap:6}}><Package width={16} height={16}/> CHOOSE YOUR DELIVERY</p>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {POSTAGE_OPTIONS.map(carrier=>(
                        <div key={carrier.id}>
                          {carrier.prices.map(price=>{
                            const optId=`${carrier.id}_${price.label}`;
                            const isSelected=selectedPostage?.optId===optId;
                            return(
                              <div key={optId} style={{border:`2px solid ${isSelected?"#FF1493":"#e0e0e0"}`,padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,marginBottom:4,background:isSelected?"#fff8fc":"#fff"}} onClick={()=>setSelectedPostage({...carrier,selectedPrice:price,optId})}>
                                <span style={{display:"inline-flex",alignItems:"center"}}><carrier.Icon width={20} height={20}/></span>
                                <div style={{flex:1}}>
                                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:800,color:"#111"}}>{carrier.name}</p>
                                  <p style={{fontSize:12,color:"#888"}}>{price.label}</p>
                                </div>
                                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900,color:"#FF1493"}}>+£{price.price}</span>
                                <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${isSelected?"#FF1493":"#ccc"}`,background:isSelected?"#FF1493":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                  {isSelected&&<Check width={12} height={12} color="#fff"/>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                      {paymentListing.accepts_collection&&(
                        <div style={{border:`2px solid ${selectedPostage?.id==="collection"?"#34C759":"#e0e0e0"}`,padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,background:selectedPostage?.id==="collection"?"#f0fff4":"#fff"}} onClick={()=>setSelectedPostage({id:"collection",name:"Collection in Person",Icon:Handshake,selectedPrice:{price:0,label:"Arrange with seller"},optId:"collection"})}>
                          <span style={{display:"inline-flex",alignItems:"center"}}><Handshake width={20} height={20}/></span>
                          <div style={{flex:1}}>
                            <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:800}}>Collection in Person</p>
                            <p style={{fontSize:12,color:"#888"}}>Arrange with seller directly</p>
                          </div>
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900,color:"#34C759"}}>FREE</span>
                          <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${selectedPostage?.id==="collection"?"#34C759":"#ccc"}`,background:selectedPostage?.id==="collection"?"#34C759":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            {selectedPostage?.id==="collection"&&<Check width={12} height={12} color="#fff"/>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{marginBottom:24,padding:"14px 16px",background:"#fff8f0",border:"1.5px solid #FF950055"}}>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:2,color:"#FF9500",marginBottom:10}}>PRICE BREAKDOWN</p>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontSize:13,color:"#555"}}>Item price</span>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700}}>{sym}{amount}</span>
                    </div>
                    {selectedPostage&&postageAmount>0&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontSize:13,color:"#555",display:"inline-flex",alignItems:"center",gap:6}}>{selectedPostage.Icon&&<selectedPostage.Icon width={14} height={14}/>} {selectedPostage.name}</span>
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
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:2,color:"#999",marginBottom:12}}>PAY WITH</p>
                  <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
                    <button className="hbtn" style={{...S.hBtn,background:"#111",border:"none",width:"100%",padding:"14px",fontSize:14,letterSpacing:1,display:"flex",alignItems:"center",justifyContent:"center",gap:10}} onClick={()=>setPaymentStep("card")}>
                      <Wallet width={18} height={18}/> APPLE PAY / GOOGLE PAY
                    </button>
                    <button className="hbtn" style={{...S.hBtn,background:"#FF1493",border:"none",width:"100%",padding:"14px",fontSize:14,letterSpacing:1,display:"flex",alignItems:"center",justifyContent:"center",gap:10}} onClick={()=>setPaymentStep("card")}>
                      <CreditCard width={18} height={18}/> PAY BY CARD
                    </button>
                  </div>
                  <p style={{fontSize:11,color:"#bbb",textAlign:"center",lineHeight:1.6}}><Lock width={12} height={12} style={{verticalAlign:"middle"}}/> Payments are processed securely via Stripe.<br/>Seller will be notified immediately after payment.</p>
                </>
              )}
              {paymentStep==="card"&&(
                <div style={{marginTop:16}}>
                  <button style={{...S.back,marginBottom:16}} onClick={()=>setPaymentStep("summary")}>← back</button>
                  <div style={{padding:24,border:"2px solid #f0f0f0",marginBottom:16}}>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:2,color:"#999",marginBottom:16}}>CARD DETAILS</p>
                    <div id="stripe-card-element" style={{padding:"14px",border:"2px solid #e0e0e0",marginBottom:16,minHeight:44}}/>
                    <p style={{fontSize:12,color:"#bbb",marginBottom:16}}><Lightbulb width={14} height={14} style={{verticalAlign:"middle"}}/> In test mode, use card number <strong>4242 4242 4242 4242</strong>, any future date, any CVC.</p>
                    <button className="hbtn" style={{...S.hBtn,background:"#FF1493",border:"none",width:"100%",padding:"14px",fontSize:14,letterSpacing:2}}
                      onClick={async()=>{
                        if(!window.Stripe){ const s=document.createElement("script"); s.src="https://js.stripe.com/v3/"; await new Promise(r=>{s.onload=r;document.head.appendChild(s);}); }
                        flash("💳 Setting up payment...");
                        try{
                          const res=await fetch(`${SUPABASE_URL}/functions/v1/clever-action`,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":`Bearer ${SUPABASE_KEY}`},body:JSON.stringify({amount:paymentListing.price,currency:paymentListing.currency||"USD",listing_id:paymentListing.id,buyer_email:user?.email||""})});
                          const {client_secret,error}=await res.json();
                          if(error) throw new Error(error);
                          const stripe=window.Stripe(STRIPE_PK);
                          const {error:stripeErr}=await stripe.confirmCardPayment(client_secret,{payment_method:{card:{token:"tok_visa"}}});
                          if(stripeErr) throw new Error(stripeErr.message);
                          flash("🎉 Payment successful!");
                          setPaymentStep("success");
                          setItems(p=>p.map(i=>i.id===paymentListing.id?{...i,payment_status:"paid",sold:true}:i));
                          db.update(paymentListing.id,{payment_status:"paid",sold:true},token).catch(()=>{});
                          try{ await db.createOrder({listing_id:paymentListing.id,buyer_id:user.id,seller_id:paymentListing.user_id,amount:paymentListing.price,postage_amount:selectedPostage?.selectedPrice?.price||0,postage_carrier:selectedPostage?.name||null,status:"paid",delivery_address:deliveryAddress.line1?deliveryAddress:null},token); }catch(e){}
                          await notify(paymentListing.user_id,"sale","💰 You made a sale!",`${profile?.username||"Someone"} bought "${paymentListing.name}" for ${currencySymbol(paymentListing.currency)}${paymentListing.price}`,paymentListing.id);
                        }catch(e){ flash(`Payment failed: ${e.message}`); }
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

      {/* REVIEW MODAL */}
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
                  <button key={n} type="button" style={{background:"none",border:"none",cursor:"pointer",padding:0,lineHeight:0,color:"#FF9500",opacity:n<=reviewForm.rating?1:0.25}} onClick={()=>setReviewForm(f=>({...f,rating:n}))}><Star width={28} height={28} fill="currentColor"/></button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:20}}>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:2,color:"#999",marginBottom:10}}>COMMENT (OPTIONAL)</p>
              <textarea style={{...S.inp,height:90,resize:"vertical",width:"100%"}} placeholder="Tell others about this seller..." value={reviewForm.comment} onChange={e=>setReviewForm(f=>({...f,comment:e.target.value}))}/>
            </div>
            <button className="hbtn" style={{...S.hBtn,width:"100%",padding:"14px",fontSize:14,borderRadius:0,letterSpacing:3}} onClick={submitReview}>SUBMIT REVIEW →</button>
          </div>
        </div>
      )}

      {/* REPORT MODAL */}
      {showReport&&(
        <div style={S.modalOverlay} onClick={()=>setShowReport(false)}>
          <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,paddingBottom:16,borderBottom:"3px solid #111"}}>
              <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900,display:"inline-flex",alignItems:"center",gap:10}}><Flag width={24} height={24}/> REPORT LISTING</h3>
              <button style={{background:"none",border:"none",fontSize:20,cursor:"pointer",fontWeight:900}} onClick={()=>setShowReport(false)}>✕</button>
            </div>
            <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:2,color:"#999",marginBottom:14}}>WHY ARE YOU REPORTING THIS?</p>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
              {["Fake or misleading photos","Wrong measurements","Item already sold","Suspicious seller","Inappropriate content","Other"].map(r=>(
                <button key={r} type="button" className="hbtn" style={{...S.hBtn,background:reportReason===r?"#FF1493":"#fff",color:reportReason===r?"#fff":"#111",border:`2px solid ${reportReason===r?"#FF1493":"#e0e0e0"}`,padding:"10px 16px",fontSize:12,letterSpacing:1,textAlign:"left"}} onClick={()=>setReportReason(r)}>{r.toUpperCase()}</button>
              ))}
            </div>
            <button className="hbtn" style={{...S.hBtn,width:"100%",padding:"14px",fontSize:14,borderRadius:0,letterSpacing:3,opacity:reportReason?1:0.4}} onClick={submitReport} disabled={!reportReason}>SUBMIT REPORT →</button>
          </div>
        </div>
      )}

      {/* SIZE GUIDE MODAL */}
      {showSizeGuide&&(
        <div style={S.modalOverlay} onClick={()=>setShowSizeGuide(false)}>
          <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,paddingBottom:16,borderBottom:"3px solid #111"}}>
              <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900,letterSpacing:-0.5,display:"inline-flex",alignItems:"center",gap:10}}><Ruler width={24} height={24}/> SIZE GUIDE</h3>
              <button style={{background:"none",border:"none",fontSize:20,cursor:"pointer",fontWeight:900}} onClick={()=>setShowSizeGuide(false)}>✕</button>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"'Barlow Condensed',sans-serif",fontSize:14}}>
                <thead><tr style={{background:"#111",color:"#fff"}}>{["SIZE","BUST","WAIST","HIPS","FITS"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:800,letterSpacing:1.5,fontSize:11}}>{h}</th>)}</tr></thead>
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
          </div>
        </div>
      )}

      {/* ORDER SUCCESS PAGE — shown after Stripe redirects back from a paid
          checkout. Session is verified server-side via the verify-session Edge
          Function before anything is confirmed. */}
      {view==="order-success"&&(
        <main style={{...S.main,maxWidth:640}}>
          {(!orderResult||orderResult.status==="loading")&&(
            <div style={{textAlign:"center",padding:"60px 0"}}>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:700,letterSpacing:1,color:"#111"}}>CONFIRMING YOUR ORDER…</p>
            </div>
          )}
          {orderResult&&orderResult.status==="ok"&&(()=>{
            // Order reference = last 8 chars of the Stripe session id (issue PART 1).
            const refNo=(orderResult.sessionId||"").slice(-8).toUpperCase();
            const purchaseDate=new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
            // Resolve purchased listings from the loaded `items` so we can show the
            // thumbnail + seller link; fall back to the verify-session line items
            // (name + pence) if a listing isn't in the local cache.
            const purchased=(orderResult.listingIds||[]).map(id=>items.find(i=>i.id===id)).filter(Boolean);
            const lines=purchased.length
              ? purchased.map(l=>({name:l.name,image:l.image_url||(l.images&&l.images[0])||"",emoji:l.emoji||catEmoji(l.category),seller:l.seller,userId:l.user_id,price:Number(l.price)||0}))
              : (orderResult.items||[]).map(it=>({name:it.name,image:"",emoji:"💎",seller:"",userId:null,price:(it.amount||0)/100}));
            return (
            <div style={{background:"#fff",border:"2px solid #111",padding:"40px 32px"}}>
              <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:64,fontWeight:900,letterSpacing:-1.5,lineHeight:0.95,marginBottom:6,color:"#111"}}>IT'S YOURS.</h1>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,letterSpacing:3,color:"#FF1493",textTransform:"uppercase",marginBottom:28}}>Order confirmed</p>

              {/* ORDER SUMMARY CARD(S) */}
              <div style={{border:"2px solid #111",marginBottom:20}}>
                {lines.map((l,i)=>(
                  <div key={i} style={{display:"flex",gap:14,alignItems:"center",padding:"16px",borderBottom:i<lines.length-1?"2px solid #111":"none"}}>
                    <div style={{width:64,height:64,flexShrink:0,border:"2px solid #111",background:"#f6f6f6",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
                      {l.image?<img src={l.image} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:30}}>{l.emoji}</span>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:17,fontWeight:900,color:"#111",lineHeight:1.1,marginBottom:3}}>{l.name}</p>
                      {l.seller&&(
                        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,color:"#888",letterSpacing:0.5}}>by{" "}
                          {l.userId?(
                            <button onClick={()=>{window.history.replaceState({},document.title,"/");setOrderResult(null);openProfile(l.userId);}} style={{background:"none",border:"none",padding:0,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,color:"#FF1493",letterSpacing:0.5,textDecoration:"underline"}}>@{l.seller}</button>
                          ):<span style={{fontWeight:800,color:"#111"}}>@{l.seller}</span>}
                        </p>
                      )}
                    </div>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,color:"#111"}}>£{l.price.toFixed(2)}</span>
                  </div>
                ))}
                <div style={{padding:"14px 16px",background:"#fafafa",borderTop:"2px solid #111",display:"flex",flexDirection:"column",gap:6}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,letterSpacing:1}}>AMOUNT PAID</span>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:"#FF1493"}}>£{(orderResult.amount/100).toFixed(2)}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,color:"#888",letterSpacing:0.5}}>
                    <span>ORDER REF</span><span style={{fontWeight:800,color:"#111"}}>#{refNo||"—"}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,color:"#888",letterSpacing:0.5}}>
                    <span>DATE</span><span style={{fontWeight:800,color:"#111"}}>{purchaseDate}</span>
                  </div>
                </div>
              </div>

              {/* SELLER-NOTIFIED MESSAGE BOX */}
              <div style={{border:"2px solid #111",padding:"16px 18px",marginBottom:24}}>
                <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,color:"#111",lineHeight:1.5}}>The seller has been notified and will be in touch about delivery. You can message them directly from your orders page.</p>
              </div>

              {/* ACTIONS */}
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                <button className="hbtn" style={{flex:1,minWidth:180,background:"#FF1493",color:"#fff",border:"2px solid #111",borderRadius:0,padding:"16px",fontSize:15,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,textTransform:"uppercase"}}
                  onClick={()=>{ window.history.replaceState({},document.title,"/"); setOrderResult(null); if(user){loadOrders();setView("orders");}else{setAuthMode("login");setView("auth");} }}>View my orders</button>
                <button className="hbtn" style={{flex:1,minWidth:180,background:"#fff",color:"#111",border:"2px solid #111",borderRadius:0,padding:"16px",fontSize:15,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,textTransform:"uppercase"}}
                  onClick={()=>{ window.history.replaceState({},document.title,"/"); setOrderResult(null); setView("shop"); }}>Continue shopping</button>
              </div>
            </div>
            );
          })()}
          {orderResult&&orderResult.status==="error"&&(
            <div style={{background:"#fff",border:"2px solid #111",padding:"40px 32px"}}>
              <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:48,fontWeight:900,letterSpacing:-1,lineHeight:1,marginBottom:8,color:"#111"}}>HMM, SOMETHING'S OFF</h1>
              <div style={{height:4,width:80,background:"#FF1493",marginBottom:24}}/>
              <p style={{fontSize:15,color:"#111",marginBottom:28,lineHeight:1.6}}>We couldn't confirm this payment. If you were charged, don't worry — your order is recorded and the seller notified once Stripe confirms. Otherwise, head back to your bag and try again.</p>
              <button className="hbtn" style={{width:"100%",background:"#fff",color:"#111",border:"2px solid #111",borderRadius:0,padding:"16px",fontSize:16,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:3,textTransform:"uppercase"}}
                onClick={()=>{ window.history.replaceState({},document.title,"/"); setOrderResult(null); setView("shop"); setShowBag(true); }}>BACK TO BAG</button>
            </div>
          )}
        </main>
      )}

      {/* WISHLIST VIEW */}
      {view==="wishlist"&&(
        <main style={S.main}>
          <button style={S.back} onClick={()=>setView("shop")}>← BACK</button>
          <div style={{marginBottom:36,paddingBottom:24,borderBottom:"3px solid #111",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:4,color:"#FF1493",marginBottom:6}}>SAVED PIECES</p>
              <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:48,fontWeight:900,letterSpacing:-1,display:"flex",alignItems:"center",gap:12}}>MY WISHLIST <Heart width={40} height={40} fill="#FF1493" color="#FF1493"/></h2>
            </div>
            {wishlistItems.length>0&&<button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#FF1493",border:"2px solid #FF1493"}} onClick={()=>{setWishlist([]);localStorage.removeItem("stitchd_wishlist");}}>CLEAR ALL</button>}
          </div>
          {wishlistItems.length===0?(
            <div style={{textAlign:"center",padding:"60px 20px"}}>
              <p style={{display:"flex",justifyContent:"center",marginBottom:12}}><Heart width={48} height={48} color="#ddd"/></p>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:900,marginBottom:8}}>NOTHING SAVED YET.</p>
              <button className="hbtn" style={S.hBtn} onClick={()=>setView("shop")}>BROWSE DROPS →</button>
            </div>
          ):(
            <div style={S.grid}>
              {wishlistItems.map((item,idx)=>{
                const accent=CARD_COLORS[idx%CARD_COLORS.length];
                return(
                  <article key={item.id} className="scard" style={{...S.card,borderColor:accent,opacity:item.sold?0.55:1}}>
                    <Thumb src={item.image_url||(item.images&&item.images[0])||""} emoji={item.emoji||catEmoji(item.category)} accent={accent} style={S.cardTop} emojiStyle={S.cardEmoji}>
                      <div style={{position:"absolute",inset:0,zIndex:1}} onClick={()=>openDetail(item)}/>
                      {item.sold&&<div style={S.soldVeil}><span style={S.soldStamp}>SOLD</span></div>}
                      <button style={S.heartBtn} onClick={e=>{e.stopPropagation();toggleWishlist(item.id);}}><Heart width={16} height={16} fill="#FF1493" color="#FF1493"/></button>
                    </Thumb>
                    <div style={S.cardBody} onClick={()=>openDetail(item)}>
                      <p style={{...S.cardCatLabel,color:accent}}>{item.category?.toUpperCase()}</p>
                      <p style={S.cardName}>{item.name}</p>
                      <div style={S.cardFoot}><span style={{...S.cardPrice,color:accent}}>{currencySymbol(item.currency)}{item.price}</span></div>
                    </div>
                    <div style={{...S.accentBar,background:accent}}/>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* MESSAGES */}
      {view==="messages"&&user&&(
        <main style={{...S.main,maxWidth:1000}}>
          <button style={S.back} onClick={()=>setView("shop")}>← BACK</button>
          <div style={S.msgLayout} className="msg-layout">
            <div style={S.msgSidebar} className="msg-sidebar">
              <div style={S.msgSidebarHead}>
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:900,letterSpacing:1}}>MESSAGES</span>
                {unreadCount>0&&<span style={{...S.wishBadge,position:"static",width:"auto",borderRadius:4,padding:"2px 8px"}}>{unreadCount} NEW</span>}
              </div>
              {conversations.length===0?(
                <div style={{padding:32,textAlign:"center"}}>
                  <p style={{display:"flex",justifyContent:"center",marginBottom:8}}><MessageCircle width={32} height={32} color="#ccc"/></p>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,color:"#bbb",letterSpacing:1}}>NO MESSAGES YET</p>
                </div>
              ):(
                conversations.map(conv=>{
                  const otherId=conv.buyer_id===user.id?conv.seller_id:conv.buyer_id;
                  const otherProfile=convProfiles[otherId];
                  const isActive=activeConv?.id===conv.id;
                  const listing=items.find(i=>i.id===conv.listing_id);
                  return(
                    <div key={conv.id} style={{...S.convItem,background:isActive?"#fff0f8":"#fff",borderLeft:isActive?"4px solid #FF1493":"4px solid transparent"}} onClick={()=>openConversation(conv)}>
                      <div style={S.convAvatar}>
                        {otherProfile?.avatar_url?<img src={otherProfile.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/>:<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:900,color:"#fff"}}>{(otherProfile?.full_name||otherProfile?.username||"?")[0].toUpperCase()}</span>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:800,color:"#111"}}>{otherProfile?.full_name||otherProfile?.username||"Seller"}</span>
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#bbb"}}>{conv.last_message_at?new Date(conv.last_message_at).toLocaleDateString("en-GB",{day:"numeric",month:"short"}).toUpperCase():""}</span>
                        </div>
                        {listing&&<p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#FF1493",fontWeight:700,letterSpacing:1,marginBottom:2}}>{listing.name?.toUpperCase()}</p>}
                        <p style={{fontSize:12,color:"#888",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{conv.last_message||"Start a conversation"}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div style={S.msgMain}>
              {!activeConv?(
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:12}}>
                  <Mail width={48} height={48} color="#ccc"/>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,letterSpacing:1,color:"#bbb"}}>SELECT A CONVERSATION</p>
                </div>
              ):(()=>{
                const otherId=activeConv.buyer_id===user.id?activeConv.seller_id:activeConv.buyer_id;
                const otherProfile=convProfiles[otherId];
                const listing=items.find(i=>i.id===activeConv.listing_id);
                return(
                  <>
                    <div style={S.chatHeader}>
                      <div style={{...S.convAvatar,flexShrink:0}}>
                        {otherProfile?.avatar_url?<img src={otherProfile.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/>:<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:900,color:"#fff"}}>{(otherProfile?.full_name||otherProfile?.username||"?")[0].toUpperCase()}</span>}
                      </div>
                      <div>
                        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900}}>{otherProfile?.full_name||otherProfile?.username||"Seller"}</p>
                        {listing&&<p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#FF1493",fontWeight:700,letterSpacing:1,cursor:"pointer"}} onClick={()=>openDetail(listing)}>RE: {listing.name?.toUpperCase()} · {currencySymbol(listing.currency)}{listing.price}</p>}
                      </div>
                    </div>
                    <div id="chat-messages" style={S.chatMessages}>
                      {messages.map(msg=>{
                        const isMine=msg.sender_id===user.id;
                        const isSeller=activeConv&&user.id===activeConv.seller_id;
                        const isOffer=msg.message_type==="offer";
                        const offerPending=isOffer&&msg.offer_status==="pending";
                        const canRespond=isOffer&&offerPending&&isSeller;
                        return(
                          <div key={msg.id} style={{display:"flex",justifyContent:isMine?"flex-end":"flex-start",marginBottom:12}}>
                            {isOffer?(
                              <div style={{...S.offerCard,border:`2px solid ${msg.offer_status==="accepted"?"#34C759":msg.offer_status==="declined"?"#FF3B30":"#FF1493"}`,maxWidth:"80%"}}>
                                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                                  <span style={{display:"inline-flex",alignItems:"center"}}><Tag width={20} height={20}/></span>
                                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:900,letterSpacing:1}}>{msg.offer_percent}% OFF OFFER</span>
                                  <span style={{...S.offerStatusBadge,background:msg.offer_status==="accepted"?"#34C759":msg.offer_status==="declined"?"#FF3B30":"#FF1493"}}>{msg.offer_status?.toUpperCase()}</span>
                                </div>
                                <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,color:"#FF1493",marginBottom:4}}>{currencySymbol(listing?.currency)}{msg.offer_amount}</p>
                                <p style={{fontSize:11,color:"#888",marginBottom:canRespond?12:0}}>Original: {currencySymbol(listing?.currency)}{listing?.price}</p>
                                {canRespond&&showCounterOffer!==msg.id&&(
                                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                                    <button className="hbtn" style={{...S.hBtn,background:"#34C759",border:"none",padding:"8px 16px",fontSize:11,display:"inline-flex",alignItems:"center",gap:5}} onClick={()=>respondToOffer(msg.id,"accepted")}><Check width={14} height={14}/> ACCEPT</button>
                                    <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#FF1493",border:"2px solid #FF1493",padding:"8px 16px",fontSize:11,display:"inline-flex",alignItems:"center",gap:5}} onClick={()=>respondToOffer(msg.id,"declined")}><X width={14} height={14}/> DECLINE</button>
                                    <button className="hbtn" style={{...S.hBtn,background:"#FF9500",border:"none",padding:"8px 16px",fontSize:11,display:"inline-flex",alignItems:"center",gap:5}} onClick={()=>setShowCounterOffer(msg.id)}><CornerUpLeft width={14} height={14}/> COUNTER</button>
                                  </div>
                                )}
                                {canRespond&&showCounterOffer===msg.id&&(
                                  <div style={{display:"flex",gap:8,alignItems:"center",marginTop:4}}>
                                    <input style={{...S.inp,flex:1,padding:"8px 12px",fontSize:13}} type="number" placeholder="£ Counter price" value={counterInput} onChange={e=>setCounterInput(e.target.value)}/>
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
                    {activeConv&&user.id===activeConv.buyer_id&&listing&&!listing.sold&&(
                      <div style={S.offerBar}>
                        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:800,letterSpacing:2,color:"#999"}}>SEND OFFER:</span>
                        {[10,20,30].map(pct=>{
                          const amt=parseFloat((listing.price*(1-pct/100)).toFixed(2));
                          return(<button key={pct} className="hbtn" style={{...S.hBtn,background:"#fff0f8",color:"#FF1493",border:"1.5px solid #FF149366",padding:"6px 14px",fontSize:11}} onClick={()=>sendOffer(pct)}>{pct}% OFF · {currencySymbol(listing.currency)}{amt}</button>);
                        })}
                      </div>
                    )}
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

      {/* AUTH */}
      <Auth
        view={view} setView={setView}
        authMode={authMode} setAuthMode={setAuthMode}
        aForm={aForm} setAForm={setAForm} aError={aError} setAError={setAError} aLoading={aLoading}
        handleAuth={handleAuth} handleOTPVerify={handleOTPVerify}
        otpStep={otpStep} setOtpStep={setOtpStep} otpCode={otpCode} setOtpCode={setOtpCode} otpEmail={otpEmail}
        flash={flash}
      />

      {/* PROFILE (edit + seller) */}
      <Profile
        view={view} setView={setView} prevView={prevView} user={user}
        profForm={profForm} setProfForm={setProfForm} saveProfile={saveProfile} profSaving={profSaving}
        twoFAStep={twoFAStep} setTwoFAStep={setTwoFAStep} twoFAData={twoFAData} setTwoFAData={setTwoFAData}
        twoFACode={twoFACode} setTwoFACode={setTwoFACode} twoFAFactors={twoFAFactors} twoFALoading={twoFALoading}
        confirm2FA={confirm2FA} disable2FA={disable2FA} load2FAFactors={load2FAFactors} setup2FA={setup2FA}
        viewedProfile={viewedProfile} profileListings={profileListings} reviews={reviews}
        isFollowing={isFollowing} toggleFollow={toggleFollow} openDetail={openDetail}
      />

      {/* DASHBOARD + CREATE BUNDLE */}
      <Dashboard
        view={view} setView={setView} user={user} myItems={myItems}
        sellerRatings={sellerRatings}
        myOrders={myOrders} wishlistCounts={wishlistCounts} openDetail={openDetail} startOrderConversation={startOrderConversation}
        setSel={setSel} openEdit={openEdit} markSold={markSold} relist={relist} del={del}
        bundles={bundles} bundleItems={bundleItems} loadBundles={loadBundles} deleteBundle={deleteBundle}
        bundleForm={bundleForm} setBundleForm={setBundleForm} toggleBundleListing={toggleBundleListing} createBundle={createBundle}
      />

      {/* FEED */}
      <Feed
        view={view} setView={setView} user={user}
        feedLoading={feedLoading} following={following} feedItems={feedItems} openDetail={openDetail}
      />

      {/* TAILOR MARKETPLACE */}
      <Tailors
        view={view} setView={setView} user={user} profile={profile}
        tailorServices={tailorServices} tailorProfiles={tailorProfiles}
        tailorSearch={tailorSearch} setTailorSearch={setTailorSearch}
        tailorTypeFilter={tailorTypeFilter} setTailorTypeFilter={setTailorTypeFilter}
        tailorServiceForm={tailorServiceForm} setTailorServiceForm={setTailorServiceForm}
        showTailorForm={showTailorForm} setShowTailorForm={setShowTailorForm}
        editingService={editingService} setEditingService={setEditingService}
        selectedService={selectedService} setSelectedService={setSelectedService}
        showBookingForm={showBookingForm} setShowBookingForm={setShowBookingForm}
        bookingNotes={bookingNotes} setBookingNotes={setBookingNotes}
        bookTailor={bookTailor} saveTailorService={saveTailorService}
        prevView={prevView}
      />

      {/* ORDERS */}
      <Orders
        view={view} setView={setView} user={user} items={items}
        ordersTab={ordersTab} setOrdersTab={setOrdersTab} ordersLoading={ordersLoading} myOrders={myOrders}
        orderProfiles={orderProfiles}
        updateOrderStatus={updateOrderStatus}
        startOrderConversation={startOrderConversation}
      />

      {/* SHOP VIEW */}
      <Shop
        view={view}
        user={user} profile={profile} setView={setView} setAuthMode={setAuthMode}
        search={search} setSearch={setSearch} handleSearchInput={handleSearchInput}
        searchSuggestions={searchSuggestions} showSuggestions={showSuggestions} setShowSuggestions={setShowSuggestions}
        savedSearches={savedSearches} showSavedSearches={showSavedSearches} setShowSavedSearches={setShowSavedSearches}
        applySearch={applySearch} saveCurrentSearch={saveCurrentSearch} deleteSavedSearch={deleteSavedSearch}
        showFilters={showFilters} setShowFilters={setShowFilters} hasFilters={hasFilters} clearFilters={clearFilters}
        typeFilter={typeFilter} setTypeFilter={setTypeFilter} condFilter={condFilter} setCondFilter={setCondFilter}
        catFilter={catFilter} setCatFilter={setCatFilter} sizeFilter={sizeFilter} setSizeFilter={setSizeFilter}
        minPrice={minPrice} setMinPrice={setMinPrice} maxPrice={maxPrice} setMaxPrice={setMaxPrice}
        showSizeMatch={showSizeMatch} setShowSizeMatch={setShowSizeMatch}
        loadTailorMarket={loadTailorMarket}
        visible={visible} loading={loading} error={error} fetchItems={fetchItems}
        openDetail={openDetail} fitsMe={fitsMe} wishlist={wishlist} toggleWishlist={toggleWishlist}
        newListings={newListings} priceDrops={priceDrops} trendingItems={trendingItems}
        sellerRatings={sellerRatings} fastSellers={fastSellers}
        wishlistCounts={wishlistCounts} myWishlist={myWishlist} toggleFavourite={toggleFavourite}
      />

      {/* DETAIL */}
      <Detail
        view={view} setView={setView} sel={sel}
        selImages={selImages} selImgIdx={selImgIdx} setSelImgIdx={setSelImgIdx} selColor={selColor}
        wishlist={wishlist} toggleWishlist={toggleWishlist} shareItem={shareItem} setShowSizeGuide={setShowSizeGuide}
        inBag={inBag} toggleBag={toggleBag}
        isOwner={isOwner} startConversation={startConversation}
        user={user} setAuthMode={setAuthMode} buyNow={buyNow}
        setShowPayment={setShowPayment} setPaymentListing={setPaymentListing} setPaymentStep={setPaymentStep} setSelectedPostage={setSelectedPostage}
        setShowReview={setShowReview} setShowReport={setShowReport}
        reviews={reviews}
        openEdit={openEdit} markSold={markSold} relist={relist} del={del}
        similarItems={similarItems} openDetail={openDetail}
        fastSellers={fastSellers}
      />

      {/* ADD / EDIT */}
      {(view==="add"||view==="edit")&&(
        <main style={{...S.main,maxWidth:760}}>
          <button style={S.back} onClick={()=>setView(view==="edit"?"detail":"shop")}>← BACK</button>
          <div style={S.formCard} className="form-card">
            <div style={S.formHero}><h2 style={S.formTitle}>{view==="edit"?"EDIT YOUR\nPIECE.":"LIST YOUR\nPIECE."}</h2><p style={S.formSub}>Real measurements. Real fit info. Real buyers.</p></div>
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
                    <div style={S.uploadPlaceholder}><div style={{...S.uploadIcon,display:"flex",justifyContent:"center"}}><Camera width={24} height={24}/></div><p style={S.uploadText}>ADD PHOTO</p></div>
                  </div>
                )}
              </div>
              <input id="img-input" type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>addImageFiles(e.target.files)}/>
            </Sec>
            <Sec label="THE BASICS">
              <div style={S.fg2} className="fg2">
                <F l="Item Name *"><input style={S.inp} placeholder="e.g. Kanjivaram Silk Saree" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></F>
                <F l="Price (£) *"><div style={{position:"relative"}}><span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"#111",fontFamily:"'Barlow',sans-serif",pointerEvents:"none"}}>£</span><input style={{...S.inp,paddingLeft:26}} type="number" placeholder="0.00" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))}/></div></F>
                <F l="TYPE" style={{gridColumn:"1/-1"}}>
                  <div style={{display:"flex",gap:0}}>
                    {LISTING_TYPES.map(t=>(
                      <button key={t} type="button" className="hbtn" style={{...S.hBtn,flex:1,background:form.listing_type===t?"#FF1493":"#fff",color:form.listing_type===t?"#fff":"#111",border:"2px solid #111",borderRadius:0,padding:"10px"}} onClick={()=>setForm(f=>({...f,listing_type:t,category:t==="Jewellery"?"Necklace":t==="Shoes"?"Heels":"Saree"}))}>
                        {t==="Clothing"?<span style={{display:"inline-flex",alignItems:"center",gap:8}}><Shirt width={16} height={16}/> CLOTHING</span>:t==="Jewellery"?<span style={{display:"inline-flex",alignItems:"center",gap:8}}><Gem width={16} height={16}/> JEWELLERY</span>:<span style={{display:"inline-flex",alignItems:"center",gap:8}}><Footprints width={16} height={16}/> SHOES</span>}
                      </button>
                    ))}
                  </div>
                </F>
                {form.listing_type!=="Clothing"&&<F l="Category"><select style={S.inp} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{(form.listing_type==="Jewellery"?JEWELLERY_CATS:SHOE_CATS).map(c=><option key={c}>{c}</option>)}</select></F>}
                <F l="Origin"><select style={S.inp} value={form.origin} onChange={e=>setForm(f=>({...f,origin:e.target.value}))}>{ORIGINS.map(o=><option key={o}>{o}</option>)}</select></F>
                {form.listing_type==="Jewellery"?<F l="Material"><select style={S.inp} value={form.material} onChange={e=>setForm(f=>({...f,material:e.target.value}))}>{JEWELLERY_MATERIALS.map(m=><option key={m}>{m}</option>)}</select></F>:<F l="Fabric"><select style={S.inp} value={form.fabric} onChange={e=>setForm(f=>({...f,fabric:e.target.value}))}>{FABRICS.map(x=><option key={x}>{x}</option>)}</select></F>}
                <F l="Condition"><select style={S.inp} value={form.condition} onChange={e=>setForm(f=>({...f,condition:e.target.value}))}>{CONDITIONS.map(c=><option key={c}>{c}</option>)}</select></F>
                {(form.listing_type==="Clothing"||form.listing_type==="Shoes")&&<F l="Size"><select style={S.inp} value={form.size} onChange={e=>setForm(f=>({...f,size:e.target.value}))}>{(form.listing_type==="Shoes"?SHOE_SIZES:SIZES).map(s=><option key={s}>{s}</option>)}</select></F>}
              </div>
            </Sec>
            <Sec label="OCCASIONS">
              <div style={S.occGrid}>{OCCASIONS.map(o=>{const on=form.occasions.includes(o),col=OCC_COLOR[o];return<button key={o} type="button" onClick={()=>togOcc(o)} style={{...S.occToggle,background:on?col:"#fff",color:on?"#fff":"#111",border:`2px solid ${on?col:"#111"}`,fontWeight:on?800:600}}>{o.toUpperCase()}</button>;})}</div>
            </Sec>
            {form.listing_type==="Clothing"&&(()=>{
              const gt=form.garment_type||defaultGarmentFor(form.gender,form.category);
              const fields=garmentFieldsFor(form.gender,gt);
              const pillBtn=(active)=>({...S.hBtn,background:active?"#FF1493":"#fff",color:active?"#fff":"#111",border:"2px solid #111",borderRadius:0,padding:"10px 18px"});
              return (
              <Sec label="MEASUREMENTS">
                <div style={{display:"flex",gap:20,marginBottom:18,flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontSize:10,fontWeight:800,color:"#999",letterSpacing:1.5,marginBottom:6}}>FOR</div>
                    <div style={{display:"flex",gap:0}}>
                      {[["women","WOMEN"],["men","MEN"]].map(([g,l])=>(
                        <button key={g} type="button" className="hbtn" style={pillBtn(form.gender===g)} onClick={()=>setForm(f=>({...f,gender:g,garment_type:defaultGarmentFor(g,f.category),meas:{}}))}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:10,fontWeight:800,color:"#999",letterSpacing:1.5,marginBottom:6}}>UNITS</div>
                    <div style={{display:"flex",gap:0}}>
                      {[["cm","CM"],["inches","INCHES"]].map(([u,l])=>(
                        <button key={u} type="button" className="hbtn" style={pillBtn(form.meas_unit===u)} onClick={()=>setForm(f=>({...f,meas_unit:u}))}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{marginBottom:16}}><F l="Garment type"><select style={S.inp} value={gt} onChange={e=>setForm(f=>({...f,garment_type:e.target.value,meas:{}}))}>{garmentTypesFor(form.gender).map(t=><option key={t}>{t}</option>)}</select></F></div>
                {fields.length===0?(
                  <p style={{fontSize:13,color:"#888"}}>No measurements needed for this category.</p>
                ):(<>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
                    <p style={{fontSize:12,color:"#888"}}>Enter values in {form.meas_unit.toUpperCase()}. Use a soft measuring tape.</p>
                    <button type="button" style={{background:"none",border:"none",fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:1,color:"#FF1493",cursor:"pointer",padding:0}} onClick={()=>{setPrevView(view);setView("measuring");}}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Ruler width={14} height={14}/> HOW TO MEASURE →</span></button>
                  </div>
                  <div style={S.fg4} className="fg4 meas-grid">
                    {fields.map(label=>(
                      <F key={label} l={`${label} (${form.meas_unit})`}>
                        <input style={S.inp} placeholder="e.g. 34" value={form.meas[label]||""} onChange={e=>setForm(f=>({...f,meas:{...f.meas,[label]:e.target.value}}))}/>
                      </F>
                    ))}
                  </div>
                  <div style={{marginTop:16}}>
                    <F l="Additional measurements or notes">
                      <textarea style={{...S.inp,height:90,resize:"vertical"}} placeholder="e.g. padding included, altered hem, custom stitching notes..." value={form.additional_measurements} onChange={e=>setForm(f=>({...f,additional_measurements:e.target.value}))}/>
                    </F>
                  </div>
                  <div style={S.toggleStack}>
                    <Tog on={form.can_take_in} onToggle={()=>setForm(f=>({...f,can_take_in:!f.can_take_in}))} color="#34C759" label="CAN BE TAKEN IN (MADE SMALLER)" sub="Seam allowance exists to reduce sizing"/>
                    <Tog on={form.spare_fabric} onToggle={()=>setForm(f=>({...f,spare_fabric:!f.spare_fabric}))} color="#FF9500" label="SPARE FABRIC INCLUDED (CAN LET OUT)" sub="Extra fabric allows making it bigger"/>
                  </div>
                </>)}
              </Sec>
              );
            })()}
            <Sec label={<span style={{display:"inline-flex",alignItems:"center",gap:8}}><Package width={16} height={16}/> POSTAGE</span>}>
              <Tog on={form.accepts_collection} onToggle={()=>setForm(f=>({...f,accepts_collection:!f.accepts_collection}))} color="#34C759" label="ACCEPT COLLECTION IN PERSON" sub="Buyer can collect for free"/>
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
