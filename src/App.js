import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  SUPABASE_URL, SUPABASE_KEY, STRIPE_PK, PLATFORM_FEE, hdrs,
  CATEGORIES, JEWELLERY_CATS, SHOE_CATS, SHOE_SIZES, ALL_CATEGORIES,
  LISTING_TYPES, JEWELLERY_MATERIALS, ORIGINS, FABRICS, CONDITIONS,
  OCCASIONS, SIZES, OCC_COLOR, CARD_COLORS, EMPTY_FORM, POSTAGE_OPTIONS,
  catEmoji, currencySymbol, buildPaymentSummary,
  garmentTypesFor, garmentFieldsFor, defaultGarmentFor, parseMeasurements, buildMeasPayload,
  ADMIN_EMAIL, lookListings, buildSearchFilters, filterSummary,
} from "./lib/constants";
import { db } from "./lib/db";
import { startCheckout, startOfferCheckout, startAlterationCheckout, verifySession } from "./lib/checkout";
import { startIdentityVerification } from "./lib/identity";
import { startPromotion } from "./lib/promotion";
import { startConnectOnboarding, verifyConnectAccount, processTailorPayout } from "./lib/connect";
import { auth, uploadImage, uploadLookImage, uploadDisputeImage, uploadStorefrontBanner, uploadStylePostImage, uploadTailorProfileImage, uploadTailorPortfolioImage, isTokenExpired, decodeJWT } from "./lib/auth";
import { S, CSS } from "./styles";
import { Heart, Bell, MessageCircle, Camera, Shirt, Gem, Footprints, Ruler, Package, User, Menu, X, ShoppingBag, Lock, CreditCard, PartyPopper, Mail, Handshake, Wallet, Lightbulb, Flag, Star, Tag, Check, CornerUpLeft, AlertCircle, ShieldCheck, Bookmark, Share2, Copy, Pencil, Trash2, Sparkles, Scissors, Clock } from "lucide-react";
import { Sec, F, Tog, Thumb, ColourSwatches } from "./components/Shared";
import { ReviewModal } from "./components/Reviews";
import PricingGuide from "./components/PricingGuide";
import Tailors from "./views/Tailors";
import TailorProfiles from "./views/TailorProfiles";
import Alterations, { RequestAlterationModal, gbp } from "./views/Alterations";
import Detail from "./views/Detail";
import Shop from "./views/Shop";
import Auth from "./views/Auth";
import Profile from "./views/Profile";
import Dashboard from "./views/Dashboard";
import Feed from "./views/Feed";
import Following from "./views/Following";
import Orders from "./views/Orders";
import Offers from "./views/Offers";
import Looks from "./views/Looks";
import CreateLook from "./views/CreateLook";
import StyleFeed from "./views/StyleFeed";
import SavedSearches from "./views/SavedSearches";
import PublicWishlist from "./views/PublicWishlist";
import ShareWishlistModal from "./components/ShareWishlistModal";
import Legal, { LEGAL_VIEWS } from "./views/Legal";
import Footer from "./components/Footer";

// URL path → view for the static legal pages, derived from the views Legal.js
// owns so the two never drift (e.g. "/terms" → "terms").
const LEGAL_PATHS = Object.fromEntries(LEGAL_VIEWS.map(v => [`/${v}`, v]));

// Issue #115 — a listing may have at most this many photos (and at least 1).
const MAX_LISTING_IMAGES = 8;

// Phase 14 — style feed pagination: LOAD MORE pulls this many posts at a time.
const STYLE_PAGE = 12;

// Phase 14 — shareable wishlist links. Public lists live at stitchd.fit/wishlist/<slug>.
// `shareSlugUrl` is the full link we copy to the clipboard; `shareSlugDisplay` is
// the protocol-less form shown in the UI / WhatsApp text (per the issue spec).
const SHARE_HOST = "stitchd.fit";
const shareSlugUrl     = (slug) => `https://${SHARE_HOST}/wishlist/${slug}`;
const shareSlugDisplay = (slug) => `${SHARE_HOST}/wishlist/${slug}`;
// Build a URL-safe slug from the list name, then App.js appends a random 4-char
// suffix for uniqueness (e.g. "my-wedding-wishlist-a3f2").
const slugifyName = (name) => {
  const base = (name || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return base || "wishlist";
};
const randSuffix = () => Math.random().toString(36).replace(/[^a-z0-9]/g, "").slice(0, 4).padEnd(4, "0");

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
  // When a login gate (LoginPromptModal) sends a logged-out buyer to /auth, we
  // stash the page they were on so we can return them there after they sign in
  // or sign up — instead of the default bounce to the shop. Normal LOG IN / SIGN
  // UP from the nav leaves this null, preserving the existing behaviour.
  const [postAuthView, setPostAuthView] = useState(null);
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
  // Phase 12 — the "SAVE THIS SEARCH" modal (name + email-alert toggle).
  const [showSaveSearch,    setShowSaveSearch]    = useState(false);
  const [saveSearchName,    setSaveSearchName]    = useState("");
  const [saveSearchAlerts,  setSaveSearchAlerts]  = useState(true);
  const [savingSearch,      setSavingSearch]      = useState(false);
  const [catFilter, setCatFilter] = useState("All");
  const [sizeFilter,setSizeFilter]= useState("All");
  // Phase 12 — multi-select occasion + colour filters. Each is an array of the
  // selected tag names; a listing matches when it carries ANY of them (OR within
  // a group). Untagged listings (null/empty array) are never hidden by either
  // filter so nothing already listed gets buried.
  const [occFilter,    setOccFilter]    = useState([]);
  const [colourFilter, setColourFilter] = useState([]);
  const [minPrice,  setMinPrice]  = useState("");
  const [maxPrice,  setMaxPrice]  = useState("");
  const [showFilters,setShowFilters]=useState(false);
  // Phase 14 — the signed-in user's wishlisted listing_ids in most-recently-saved
  // order (created_at desc), backing the /wishlist page. Derived from the DB
  // `wishlists` table alongside `myWishlist` (the Set that drives the filled
  // heart); see loadMyWishlist / toggleFavourite below.
  const [wishlistOrder, setWishlistOrder] = useState([]);
  // Phase 14 — Shareable wishlists. `myShared` backs the MY SHARED LISTS section
  // on /wishlist; the share* state drives the create/edit modal; the public*
  // state backs the no-login /wishlist/<slug> page.
  const [myShared,        setMyShared]        = useState([]);
  const [showShareModal,  setShowShareModal]  = useState(false);
  const [shareMode,       setShareMode]       = useState("create");   // "create" | "edit"
  const [shareStep,       setShareStep]       = useState("form");     // "form" | "success"
  const [shareName,       setShareName]       = useState("");
  const [shareSelected,   setShareSelected]   = useState(new Set());
  const [sharePublic,     setSharePublic]     = useState(true);
  const [shareSaving,     setShareSaving]     = useState(false);
  const [shareResult,     setShareResult]     = useState(null);       // the created/edited list row
  const [shareCopied,     setShareCopied]     = useState(false);
  const [editingShared,   setEditingShared]   = useState(null);       // list being edited (edit mode)
  const [publicSlug,      setPublicSlug]      = useState(null);
  const [publicList,      setPublicList]      = useState(null);
  const [publicOwnerName, setPublicOwnerName] = useState("");
  const [publicLoading,   setPublicLoading]   = useState(false);
  const [publicCopied,    setPublicCopied]    = useState(false);
  const [myCopiedId,      setMyCopiedId]      = useState(null);       // which MY SHARED LISTS card just copied
  // Shopping bag holds lightweight snapshots of bagged listings ({id,name,price,
  // currency,image,seller,sold}) so the panel renders without re-fetching. Stored
  // in localStorage (per-device) so it survives refresh AND logging in, like the
  // recently-viewed list below. No Supabase sync in this issue.
  const [bag,        setBag]        = useState(()=>{ try{return JSON.parse(localStorage.getItem("stitchd_bag"))||[];}catch{return[];} });
  const [showBag,    setShowBag]    = useState(false);
  const [checkingOut,setCheckingOut]= useState(false);
  // Order-success page state: {status:'loading'|'ok'|'error', items, amount}.
  const [orderResult,setOrderResult]= useState(null);
  const [recentlyViewed,setRecentlyViewed]=useState(()=>{ try{return JSON.parse(localStorage.getItem("stitchd_recent"))||[];}catch{return[];} });
  const [showSizeGuide,setShowSizeGuide]=useState(false);
  const [reviews,      setReviews]      = useState([]);
  // Phase 14 — comments on the open listing, plus the add-comment textarea.
  const [comments,     setComments]     = useState([]);
  const [commentText,  setCommentText]  = useState("");
  // Phase 14 — the signed-in buyer's pending offer on the open listing (or null).
  const [myOffer,      setMyOffer]      = useState(null);
  const [sellerRatings,setSellerRatings]= useState({});
  const [fastSellers,  setFastSellers]  = useState(()=>new Set());
  // Phase 10d — seller ids with vacation_mode=true; their listings are hidden
  // from the shop/search grid. `vacationSaving` guards the dashboard toggle and
  // `promoteNotified` flips once the seller has registered Promote interest.
  const [vacationSellers,setVacationSellers]=useState(()=>new Set());
  const [vacationSaving,setVacationSaving]=useState(false);
  const [promoteNotified,setPromoteNotified]=useState(false);
  // Phase 14 — bundle discounts. `bundleSellers` maps seller id → discount % for
  // every seller with bundle_discount_enabled=true, so the shop cards, storefront
  // and bag can apply the deal without a per-card profile fetch. Mirrors the other
  // seller-set lookups above.
  const [bundleSellers,setBundleSellers]=useState(()=>new Map());
  // Phase 11 — verified sellers. `verifiedSellers` is the set of seller ids
  // flagged verified=true (drives the badge on cards/Detail + the "Verified
  // sellers only" filter). `myVerificationApp` is the signed-in seller's latest
  // application (its reviewed_at backs the reapply-after-30-days rule).
  const [verifiedSellers,setVerifiedSellers]=useState(()=>new Set());
  const [showVerifiedOnly,setShowVerifiedOnly]=useState(false);
  const [myVerificationApp,setMyVerificationApp]=useState(null);
  const [verificationBusy,setVerificationBusy]=useState(false);
  // Phase 11 — ID verification (Stripe Identity). `identityVerifiedSellers` drives
  // the ID VERIFIED badge on cards/Detail; `identityBusy` disables the dashboard
  // button while the verification session is being created; `dashTabRequest` lets
  // other views (e.g. the listing form's over-£200 prompt, or the return from
  // Stripe) deep-link straight to the dashboard TOOLS tab.
  const [identityVerifiedSellers,setIdentityVerifiedSellers]=useState(()=>new Set());
  const [identityBusy,setIdentityBusy]=useState(false);
  const [dashTabRequest,setDashTabRequest]=useState(null);
  // Admin panel — every verification application + applicant profiles (id->profile
  // for name/email/username), loaded alongside reports + disputes for an admin.
  const [adminApplications,setAdminApplications]=useState([]);
  const [adminApplicants,setAdminApplicants]=useState({});
  // DB-backed wishlist/favourite counts (Phase 10b). `wishlistCounts` maps
  // listing_id -> how many users saved it; `myWishlist` is the set of listing_ids
  // the signed-in user has saved (drives the filled heart and the /wishlist page,
  // ordered by `wishlistOrder` above).
  const [wishlistCounts,setWishlistCounts]= useState({});
  const [myWishlist,    setMyWishlist]    = useState(()=>new Set());
  const [showReview,   setShowReview]   = useState(false);
  const [reviewForm,   setReviewForm]   = useState({rating:5,comment:""});
  const [showReport,   setShowReport]   = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails,setReportDetails]= useState("");
  const [reportDone,   setReportDone]   = useState(false);
  // Phase 11 — dispute resolution. `disputeOrder` is the order a buyer is raising a
  // problem with (null = modal closed); `disputeForm` holds the form state.
  const [disputeOrder, setDisputeOrder] = useState(null);
  const [disputeForm,  setDisputeForm]  = useState({problem_type:"",details:"",photoFile:null,photoPreview:""});
  const [disputeBusy,  setDisputeBusy]  = useState(false);
  const [disputeDone,  setDisputeDone]  = useState(false);
  // Phase 11 — admin panel data (reports + disputes), loaded when an admin opens
  // the dashboard. `adminNames` maps user_id -> display name for reporters/buyers.
  const [adminReports, setAdminReports] = useState([]);
  const [adminDisputes,setAdminDisputes]= useState([]);
  const [adminNames,   setAdminNames]   = useState({});
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
  // Phase 13 — promoted listings. `myPromotions` backs the dashboard ANALYTICS
  // PROMOTIONS history; `promoteBusyId` is the listing id whose checkout session
  // is being created (disables that card's PROMOTE button until the redirect).
  const [myPromotions,   setMyPromotions]   = useState([]);
  const [promoteBusyId,  setPromoteBusyId]  = useState(null);
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
  const [tailorServiceForm, setTailorServiceForm] = useState({title:"",description:"",service_type:"All",price_from:"",price_to:"",turnaround_days:"",location:"",images:[],imagePreviews:[]});
  const [showTailorForm,    setShowTailorForm]    = useState(false);
  const [editingService,    setEditingService]    = useState(null);
  const [tailorSearch,      setTailorSearch]      = useState("");
  const [tailorTypeFilter,  setTailorTypeFilter]  = useState("All");
  const [bookingNotes,      setBookingNotes]      = useState("");
  const [showBookingForm,   setShowBookingForm]   = useState(false);
  // ── Phase 15 — Tailor profiles (separate from the tailor_services marketplace
  // above). `myTailor` is the signed-in user's tailor row (application/profile)
  // or null. The apply flow, dashboard edit form, portfolio and public profile
  // each get their own state.
  const [myTailor,          setMyTailor]          = useState(null);
  const [applyForm,         setApplyForm]         = useState(null);
  const [applyBusy,         setApplyBusy]         = useState(false);
  const [tailorDashTab,     setTailorDashTab]     = useState("profile");
  const [tailorEdit,        setTailorEdit]        = useState(null);
  const [tailorEditBusy,    setTailorEditBusy]    = useState(false);
  const [tailorPortfolio,   setTailorPortfolio]   = useState([]);
  const [portfolioBusy,     setPortfolioBusy]     = useState(false);
  const [publicTailor,      setPublicTailor]      = useState(null);
  const [publicTailorLoading,setPublicTailorLoading]=useState(false);
  const [adminTailors,      setAdminTailors]      = useState([]);
  // ── Phase 15 — Request alterations on a listing. The request modal (launched
  // from the listing detail FIND A TAILOR button), the buyer's /alterations page
  // and the tailor's dashboard BOOKINGS tab share these.
  const [approvedTailors,   setApprovedTailors]   = useState([]);
  const [alterReqOpen,      setAlterReqOpen]      = useState(false);
  const [alterReqListing,   setAlterReqListing]   = useState(null);
  const [alterReqBusy,      setAlterReqBusy]      = useState(false);
  const [buyerAlterations,  setBuyerAlterations]  = useState([]);
  const [buyerAlterationsLoading,setBuyerAlterationsLoading]=useState(false);
  const [tailorAlterations, setTailorAlterations] = useState([]);
  const [alterationBuyers,  setAlterationBuyers]  = useState({});
  const [tailorAlterationsLoading,setTailorAlterationsLoading]=useState(false);
  // Phase 15 — booking payments: which quote is mid-checkout, the tailor's
  // payout rows (EARNINGS section) and the buyer's decline-quote confirm modal.
  const [alterCheckoutId,   setAlterCheckoutId]   = useState(null);
  const [tailorPayouts,     setTailorPayouts]     = useState([]);
  // Phase 15 — Stripe Connect: PAYMENTS section busy flag, and the admin PAYOUTS
  // oversight rows (every payout with status, for the admin dashboard).
  const [paymentsBusy,      setPaymentsBusy]      = useState(false);
  const [adminPayouts,      setAdminPayouts]      = useState([]);
  // Phase 15 — Stripe's return from Connect onboarding (?connect=success|refresh).
  // Captured on cold load, then resolved once myTailor is ready (see the effect).
  const [connectReturn,     setConnectReturn]     = useState(null);
  // Phase 15 — Tailor reviews & ratings. The review modal (request being reviewed
  // + submit busy flag), the buyer's own reviews (so /alterations shows reviewed
  // state), the public-profile reviews (+ reviewer profiles) and the dashboard
  // REVIEWS tab reviews (+ reviewer profiles).
  const [reviewReq,         setReviewReq]         = useState(null);
  const [reviewBusy,        setReviewBusy]        = useState(false);
  const [buyerReviews,      setBuyerReviews]      = useState([]);
  const [publicTailorReviews,setPublicTailorReviews]=useState([]);
  const [publicReviewBuyers, setPublicReviewBuyers] =useState({});
  const [tailorReviews,     setTailorReviews]     = useState([]);
  const [tailorReviewBuyers,setTailorReviewBuyers]=useState({});
  // Phase 15 — Tailor availability calendar. The signed-in tailor's own
  // availability rows (dashboard AVAILABILITY tab), the public profile's rows,
  // a busy/loading flag, and a preferred-date hint carried from the public
  // profile's SEND ALTERATION REQUEST button into the request modal.
  const [availabilityRows,  setAvailabilityRows]  = useState([]);
  const [availabilityLoading,setAvailabilityLoading]=useState(false);
  const [availabilityBusy,  setAvailabilityBusy]  = useState(false);
  const [publicAvailability,setPublicAvailability]= useState([]);
  const [preferredDateHint, setPreferredDateHint] = useState(null);
  const [following,      setFollowing]      = useState([]);
  const [feedItems,      setFeedItems]      = useState([]);
  const [feedLoading,    setFeedLoading]    = useState(false);
  const [feedProfiles,   setFeedProfiles]   = useState({});
  // Phase 14 — STYLE FEED. Two tabs each keep their own paginated post array
  // (FOR YOU = everyone, FOLLOWING = followed users). `styleProfiles` /
  // `styleListings` are shared id→object maps accumulated across both tabs so a
  // card can render its author + tagged pieces. `styleLiked` is the set of post
  // ids this user has liked; `styleLikeCounts` overrides each post's counter for
  // optimistic like/unlike. Home* back the homepage STYLE INSPIRATION preview.
  const [styleFeedTab,     setStyleFeedTab]     = useState("foryou");
  const [forYouPosts,      setForYouPosts]      = useState([]);
  const [followingPosts,   setFollowingPosts]   = useState([]);
  const [styleProfiles,    setStyleProfiles]    = useState({});
  const [styleListings,    setStyleListings]    = useState({});
  const [styleLiked,       setStyleLiked]       = useState(new Set());
  const [styleLikeCounts,  setStyleLikeCounts]  = useState({});
  const [styleFeedLoading, setStyleFeedLoading] = useState(false);
  const [hasMoreForYou,    setHasMoreForYou]    = useState(false);
  const [hasMoreFollowing, setHasMoreFollowing] = useState(false);
  const [styleLoadedForYou,    setStyleLoadedForYou]    = useState(false);
  const [styleLoadedFollowing, setStyleLoadedFollowing] = useState(false);
  const [styleCreateOpen,  setStyleCreateOpen]  = useState(false);
  const [styleCreating,    setStyleCreating]    = useState(false);
  const [homeStylePosts,   setHomeStylePosts]   = useState([]);
  const [homeStyleProfiles,setHomeStyleProfiles]= useState({});
  // Phase 13 — seller storefronts + follow. `followerCount` is the count for the
  // currently-open storefront (kept in sync as you follow/unfollow). `storeForm`
  // backs the EDIT STOREFRONT section in the dashboard TOOLS tab. The MY FOLLOWING
  // list resolves the followed sellers' profiles + active-listing counts. `shopTab`
  // toggles the main shop between ALL listings and the FOLLOWING feed.
  const [followerCount,    setFollowerCount]    = useState(0);
  const [storeForm,        setStoreForm]        = useState({storefront_tagline:"",storefront_bio:"",storefront_location:"",storefront_instagram:"",storefront_banner_url:"",bannerFile:null,bannerPreview:""});
  const [storeSaving,      setStoreSaving]      = useState(false);
  const [followingProfiles,setFollowingProfiles]= useState([]);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [shopTab,          setShopTab]          = useState("all");
  const [notifications,  setNotifications]  = useState([]);
  // Phase 14 — seller's incoming offers (OFFERS tab) + a buyer-id→profile map so
  // each card can show the buyer's first name ("From Sarah").
  const [sellerOffers,   setSellerOffers]   = useState([]);
  const [offerBuyers,    setOfferBuyers]    = useState({});
  // Phase 14 — the signed-in buyer's own offers (the /offers page), and the offer
  // id currently being handed to Stripe checkout (disables that card's button).
  const [buyerOffers,    setBuyerOffers]    = useState([]);
  const [offersLoading,  setOffersLoading]  = useState(false);
  const [checkoutOfferId,setCheckoutOfferId]= useState(null);
  const [showNotifs,     setShowNotifs]     = useState(false);
  const [navMenuOpen,    setNavMenuOpen]    = useState(false);
  const [mobileNavOpen,  setMobileNavOpen]  = useState(false);
  const [showPayment,    setShowPayment]    = useState(false);
  const [paymentListing, setPaymentListing] = useState(null);
  const [paymentStep,    setPaymentStep]    = useState("summary");
  const [selectedPostage,setSelectedPostage]= useState(null);
  // Phase 10e — Shop the Look. `looks` are active, published looks (homepage rail
  // + /looks page); `myLooks` are the signed-in seller/admin's own looks (drafts
  // included) for the TOOLS tab. `selLook`/`selLookCreator` back the detail view.
  // The create flow uses `lookForm`/`lookStep` + the search picker state.
  const [looks,          setLooks]          = useState([]);
  const [myLooks,        setMyLooks]        = useState([]);
  const [lookFilter,     setLookFilter]     = useState("ALL");
  const [selLook,        setSelLook]        = useState(null);
  const [selLookCreator, setSelLookCreator] = useState(null);
  const [lookForm,       setLookForm]       = useState({title:"",description:"",coverFile:null,coverPreview:"",cover_image_url:"",items:[]});
  const [lookStep,       setLookStep]       = useState(1);
  const [lookSaving,     setLookSaving]     = useState(false);
  const [editingLook,    setEditingLook]    = useState(null);
  const [lookSearch,     setLookSearch]     = useState("");
  const [lookSearchResults,setLookSearchResults]=useState([]);

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

  // Phase 13 — deep link to a seller storefront (?seller=<id>), used by the
  // dashboard "PREVIEW STOREFRONT" button which opens the public storefront in a
  // new tab. Clears the param afterwards so a refresh lands on the shop.
  useEffect(()=>{
    const sellerId=new URLSearchParams(window.location.search).get("seller");
    if(sellerId){
      window.history.replaceState({},document.title,window.location.pathname);
      openProfile(sellerId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

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
    // Phase 11 — return from the Stripe Identity hosted flow (return_url is
    // /dashboard?verified=true). Land on the dashboard TOOLS tab; the profile
    // reload (user/token effect) picks up the webhook-driven status change.
    // Phase 13 — return from a successful £2.99 promotion checkout
    // (/dashboard?promoted=true&listing_id=…). Land on the dashboard (ACTIVE tab),
    // optimistically mark the listing promoted (the webhook does the real update),
    // and confirm to the seller. Checked before the generic /dashboard→TOOLS rule
    // so the promotion success doesn't get swallowed by it.
    const _sp=new URLSearchParams(window.location.search);
    if(_sp.get("promoted")==="true"){
      const lid=_sp.get("listing_id");
      window.history.replaceState({},document.title,"/");
      if(lid){ const until=new Date(Date.now()+7*86400000).toISOString(); setItems(p=>p.map(i=>i.id===lid?{...i,promoted:true,promoted_until:until,sold:i.sold}:i)); }
      flash("⚡ Your listing is now promoted for 7 days!");
      setView("dashboard");
    } else if(window.location.pathname.replace(/\/+$/,"").endsWith("/dashboard")||_sp.get("verified")==="true"){
      window.history.replaceState({},document.title,"/");
      setDashTabRequest("tools");
      setView("dashboard");
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

  // LEGAL PAGES (/terms, /privacy, /returns) — hardcoded static pages reachable
  // from the footer on every page. We map the URL path to a `view` on first load
  // (so a hard load / shared link of /terms lands on the right page) and keep the
  // browser Back/Forward buttons in sync via a popstate listener.
  useEffect(()=>{
    const path=window.location.pathname.replace(/\/+$/,"");
    const v=LEGAL_PATHS[path];
    if(v) setView(v);
    const onPop=()=>{
      const p=window.location.pathname.replace(/\/+$/,"");
      setView(LEGAL_PATHS[p]||"shop");
    };
    window.addEventListener("popstate",onPop);
    return ()=>window.removeEventListener("popstate",onPop);
  },[]);

  // Phase 12 — deep links from the saved-search alert email. "SEE ALL MATCHES"
  // carries the saved filters as a base64url `sf` param so the shop pre-applies
  // them on a cold load; "Manage your saved searches" lands on /saved-searches.
  // Both clear the param/path afterwards so a refresh doesn't re-trigger.
  useEffect(()=>{
    const path=window.location.pathname.replace(/\/+$/,"");
    const params=new URLSearchParams(window.location.search);
    const sf=params.get("sf");
    if(sf){
      try{
        const bin=atob(sf.replace(/-/g,"+").replace(/_/g,"/"));
        const json=decodeURIComponent(Array.prototype.map.call(bin,c=>"%"+("00"+c.charCodeAt(0).toString(16)).slice(-2)).join(""));
        const filters=JSON.parse(json);
        if(filters&&typeof filters==="object") applySavedSearch({filters});
      }catch{ /* malformed link — ignore, land on the shop */ }
      window.history.replaceState({},"","/");
    } else if(path==="/saved-searches"){
      setView("saved-searches");
      window.history.replaceState({},"","/saved-searches");
    } else if(path==="/offers"){
      // Phase 14 — deep link / Stripe cancel_url lands here; data loads via the
      // view-watching effect once the session is ready.
      setView("offers");
      window.history.replaceState({},"","/offers");
    } else if(path==="/alterations"){
      // Phase 15 — buyer's alteration requests deep link (email CTA / direct).
      // Data loads via the view-watching effect once the session is ready.
      // ?paid=true is Stripe's return from a completed alteration checkout — show
      // a confirmation (the webhook does the real work async).
      try{ if(new URLSearchParams(window.location.search).get("paid")==="true"){ setTimeout(()=>flash("Payment received — your booking is confirmed!",6000),400); } }catch(e){}
      setView("alterations");
      window.history.replaceState({},"","/alterations");
    } else if(path==="/tailor-dashboard"){
      // Phase 15 — Stripe Connect onboarding return. ?connect=success means the
      // tailor finished the hosted flow; ?connect=refresh means the link expired.
      // Capture it for the myTailor-ready effect, which opens the dashboard and
      // verifies onboarding (the actual completion is confirmed against Stripe).
      try{ const c=new URLSearchParams(window.location.search).get("connect"); if(c) setConnectReturn(c); }catch(e){}
      window.history.replaceState({},"","/tailor-dashboard");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Phase 14 — (re)load the buyer's offers whenever they're on /offers, so the
  // page is current after navigating to it or returning from a cancelled checkout.
  useEffect(()=>{ if(view==="offers"&&user&&token) loadBuyerOffers(); // eslint-disable-next-line react-hooks/exhaustive-deps
  },[view,user,token]);

  // Phase 15 — (re)load the buyer's alteration requests whenever they're on
  // /alterations, so the page is current after navigating to it or deep-linking.
  useEffect(()=>{ if(view==="alterations"&&user&&token) loadBuyerAlterations(); // eslint-disable-next-line react-hooks/exhaustive-deps
  },[view,user,token]);

  // Phase 14 — public shared wishlist deep link (/wishlist/<slug>). A shared link
  // lands here on a cold load with no login required; we detect the slug, switch
  // to the public-wishlist view and fetch the list. The URL is left intact so a
  // refresh / re-share still works (it's cleared only when the viewer navigates
  // away via exitPublicWishlist).
  useEffect(()=>{
    const m=window.location.pathname.replace(/\/+$/,"").match(/^\/wishlist\/([^/]+)$/);
    if(m&&m[1]){
      const slug=decodeURIComponent(m[1]);
      setPublicSlug(slug);
      setView("public-wishlist");
      loadPublicWishlist(slug);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Refresh the owner's shared lists whenever they open /wishlist, so the MY
  // SHARED LISTS section is always current after a create/edit/delete.
  useEffect(()=>{ if(view==="wishlist"&&user) loadMySharedWishlists(); // eslint-disable-next-line react-hooks/exhaustive-deps
  },[view,user]);

  // Phase 15 — public tailor profile deep link (/tailors/<id>). A shared link or
  // PREVIEW PROFILE (new tab) lands here on a cold load with no login required.
  // /tailors/apply opens the application flow instead.
  useEffect(()=>{
    const path=window.location.pathname.replace(/\/+$/,"");
    if(path==="/tailors/apply"){ openTailorApply(); return; }
    const m=path.match(/^\/tailors\/([0-9a-fA-F-]{8,})$/);
    if(m&&m[1]) openTailorPublic(m[1]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Footer navigation: switch to a legal `view` without a full reload and push the
  // matching path so the URL + Back button reflect it. Scrolls to top on navigate.
  const goLegal=useCallback((v,path)=>{
    window.history.pushState({},"",path);
    setView(v);
    window.scrollTo(0,0);
  },[]);
  // Leaving a legal page back to the shop — restore the "/" URL so it doesn't
  // stay stuck on /terms etc. (replaceState: no extra history entry).
  const exitLegal=useCallback(()=>{
    if(LEGAL_PATHS[window.location.pathname.replace(/\/+$/,"")]) window.history.replaceState({},"","/");
    setView("shop");
  },[]);

  useEffect(()=>{
    if(user&&token){
      db.getProfile(user.id,token).then(p=>{ if(p){setProfile(p);setProfForm({username:p.username||"",full_name:p.full_name||"",location:p.location||"",region:p.region||"",currency:p.currency||"USD",bio:p.bio||"",specialises_in:p.specialises_in||[],avatar_url:p.avatar_url||"",avatarFile:null,avatarPreview:p.avatar_url||"",bust:p.bust||"",waist:p.waist||"",hips:p.hips||"",height:p.height||"",preferred_size:p.preferred_size||"",is_tailor:p.is_tailor||false,tailor_services:p.tailor_services||[],tailor_price_from:p.tailor_price_from||"",accepting_clients:p.accepting_clients!==false});setStoreForm({storefront_tagline:p.storefront_tagline||"",storefront_bio:p.storefront_bio||"",storefront_location:p.storefront_location||"",storefront_instagram:p.storefront_instagram||"",storefront_banner_url:p.storefront_banner_url||"",bannerFile:null,bannerPreview:p.storefront_banner_url||""});} });
      loadConversations();
      db.getFollowing(user.id,token).then(setFollowing);
      db.getNotifications(user.id,token).then(setNotifications);
      loadSavedSearches();
      loadMyWishlist();
      // Phase 11 — the seller's latest verification application (for the rejected
      // → reapply-after-30-days rule in the dashboard GET VERIFIED section).
      db.getMyVerificationApplication(user.id,token).then(setMyVerificationApp).catch(()=>{});
      // Phase 13 — the seller's promotions for the dashboard ANALYTICS history.
      db.getMyPromotions(user.id,token).then(setMyPromotions).catch(()=>{});
      // Phase 14 — the seller's incoming offers for the dashboard OFFERS tab.
      loadSellerOffers();
      // Phase 15 — the user's tailor row (drives the BECOME A TAILOR / PENDING /
      // MY TAILOR PROFILE nav entries).
      db.getMyTailor(user.id,token).then(setMyTailor).catch(()=>{});
    } else {
      setMyWishlist(new Set());
      setWishlistOrder([]);
      setMyVerificationApp(null);
      setMyPromotions([]);
      setSellerOffers([]);
      setOfferBuyers({});
      setMyTailor(null);
    }
  },[user,token]);

  async function fetchItems(){
    setLoading(true); setError("");
    try{ const data = await db.getAll(token); setItems(data); }
    catch(e){ try{ setItems(await db.getAll(null)); }catch(e2){ setError(`Error: ${e2.message}`); } }
    finally{ setLoading(false); }
  }

  // Phase 13 — a listing counts as "promoted" for sorting only while its boost is
  // live (promoted flag set AND promoted_until still in the future), so an expired
  // promotion the cron hasn't swept yet never floats to the top.
  const visible = useMemo(()=>{
   const _now=Date.now();
   const _live=(i)=>!!i.promoted&&!!i.promoted_until&&new Date(i.promoted_until).getTime()>_now;
   return items.filter(i=>{
    const matchCat  = catFilter==="All"||i.category===catFilter;
    const matchSize = sizeFilter==="All"||i.size===sizeFilter;
    const matchMin  = minPrice===""||i.price>=parseFloat(minPrice);
    const matchMax  = maxPrice===""||i.price<=parseFloat(maxPrice);
    const matchType = typeFilter==="All"||(typeFilter==="Jewellery"?JEWELLERY_CATS.includes(i.category):typeFilter==="Shoes"?SHOE_CATS.includes(i.category):(typeFilter==="Clothing"?CATEGORIES.includes(i.category):true));
    const matchCond = condFilter==="All"||i.condition===condFilter;
    const matchFit  = !showSizeMatch||fitsMe(i)===true;
    const q=search.toLowerCase();
    const matchSearch=!q||i.name?.toLowerCase().includes(q)||i.description?.toLowerCase().includes(q)||i.fabric?.toLowerCase().includes(q)||i.category?.toLowerCase().includes(q)||i.origin?.toLowerCase().includes(q)||i.material?.toLowerCase().includes(q);
    // Phase 10d — hide listings whose seller is on vacation, and any the seller
    // has deactivated via bulk edit (status='inactive'). Applies to shop & search.
    const matchVacation=!vacationSellers.has(i.user_id);
    const matchActive=i.status!=="inactive";
    // Issue #167 — hide SOLD listings from every browse/discovery view (shop,
    // homepage grid, search, new arrivals). "Sold" is matched by EITHER signal:
    // the legacy sold=true flag (set when a seller marks a piece sold) OR
    // status='sold' (set by the stripe-webhook on a real purchase). Sold pieces
    // remain visible on the dashboard SOLD tab, order history, Shop the Look and
    // Recently Viewed (each with a SOLD overlay) — none of which use this filter.
    const matchNotSold=!i.sold&&i.status!=="sold";
    // Phase 11 — "Verified sellers only" filter: keep listings from verified sellers.
    const matchVerified=!showVerifiedOnly||verifiedSellers.has(i.user_id);
    // Phase 12 — occasion + colour filters. Multi-select, OR within a group. An
    // untagged listing (no occasions/colours) is never hidden by that filter so
    // existing listings show under every selection.
    const occ=i.occasions||[];
    const matchOcc=occFilter.length===0||occ.length===0||occFilter.some(o=>occ.includes(o));
    const col=i.colours||[];
    const matchColour=colourFilter.length===0||col.length===0||colourFilter.some(c=>col.includes(c));
    return matchCat&&matchSize&&matchMin&&matchMax&&matchSearch&&matchType&&matchFit&&matchCond&&matchVacation&&matchActive&&matchNotSold&&matchVerified&&matchOcc&&matchColour;
   })
   // Promoted (in-window) listings float to the top; the source array is already
   // created_at.desc so a stable sort keeps newest-first order within each group.
   .sort((a,b)=>(_live(a)?0:1)-(_live(b)?0:1));
  },[items,catFilter,sizeFilter,minPrice,maxPrice,search,typeFilter,condFilter,showSizeMatch,vacationSellers,showVerifiedOnly,verifiedSellers,occFilter,colourFilter]);

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
  function togColour(c){ setForm(f=>({...f,colours:(f.colours||[]).includes(c)?f.colours.filter(x=>x!==c):[...(f.colours||[]),c]})); }
  // Phase 12 — toggle one occasion/colour in the shop filter (multi-select).
  function togOccFilter(o){ setOccFilter(prev=>prev.includes(o)?prev.filter(x=>x!==o):[...prev,o]); }
  function togColourFilter(c){ setColourFilter(prev=>prev.includes(c)?prev.filter(x=>x!==c):[...prev,c]); }
  function clearFilters(){ setSearch(""); setCatFilter("All"); setSizeFilter("All"); setMinPrice(""); setMaxPrice(""); setTypeFilter("All"); setCondFilter("All"); setShowVerifiedOnly(false); setOccFilter([]); setColourFilter([]); }
  const hasFilters = search||catFilter!=="All"||sizeFilter!=="All"||minPrice||maxPrice||typeFilter!=="All"||condFilter!=="All"||showVerifiedOnly||occFilter.length>0||colourFilter.length>0;

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
          // Phase 14 — stable seller id so the bag can group items per seller and
          // apply that seller's bundle discount (the `seller` name above is display-only).
          sellerId:item.user_id||item.seller_id||null,
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

  // Phase 14 — bundle discounts in the bag. Group bagged items by seller; a seller
  // who has bundle_discount_enabled and 2+ of their items in the bag gives that %
  // off their own items only. With items from several discounting sellers, each
  // seller's discount applies to just their own items (separate lines). Legacy bag
  // snapshots predate `sellerId`, so fall back to resolving it from the loaded items.
  const bagBundles = (()=>{
    const groups=new Map();
    bag.forEach(b=>{
      const sid=b.sellerId||items.find(i=>i.id===b.id)?.user_id||null;
      if(!sid) return;
      if(!groups.has(sid)) groups.set(sid,{sellerId:sid,name:b.seller||"this seller",items:[]});
      groups.get(sid).items.push(b);
    });
    const out=[];
    groups.forEach(g=>{
      const pct=bundleSellers.get(g.sellerId);
      if(pct&&g.items.length>=2){
        const subtotal=g.items.reduce((s,b)=>s+(parseFloat(b.price)||0),0);
        out.push({...g,pct,subtotal,discount:subtotal*pct/100});
      }
    });
    return out;
  })();
  const bundleDiscountTotal = bagBundles.reduce((s,b)=>s+b.discount,0);

  // Phase 14 — sellers whose "BUNDLE & SAVE X%" card banner should show: the
  // discount is enabled AND they have 2+ active listings (so a bundle is actually
  // possible). Maps seller id → % for the shop grid. The storefront banner has no
  // 2+ requirement, so it reads bundle_discount_enabled off the profile directly.
  const bundleCardSellers = useMemo(()=>{
    if(!bundleSellers.size) return {};
    const counts={};
    items.forEach(i=>{ if(!i.sold&&i.status!=="inactive"&&i.user_id) counts[i.user_id]=(counts[i.user_id]||0)+1; });
    const out={};
    bundleSellers.forEach((pct,id)=>{ if((counts[id]||0)>=2) out[id]=pct; });
    return out;
  },[bundleSellers,items]);

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

  // Phase 14 — load a listing's comments and attach the commenter's username +
  // avatar (comments only store user_id). Mirrors loadReviews' batch lookup.
  async function loadComments(listingId){
    const rows=await db.getComments(listingId,token);
    const ids=[...new Set(rows.map(c=>c.user_id).filter(Boolean))];
    if(!ids.length) return rows;
    try{
      const profs=await db.getProfilesFullByIds(ids,token);
      const byId={}; profs.forEach(p=>{ byId[p.id]=p; });
      return rows.map(c=>{
        const p=byId[c.user_id];
        const name=(p?.username||p?.full_name||"").trim();
        return {...c,username:name||"Anonymous",avatar_url:p?.avatar_url||""};
      });
    }catch(e){ return rows; }
  }

  async function submitComment(){
    if(!user||!sel) return;
    const content=commentText.trim();
    if(!content) return;
    try{
      await db.insertComment({listing_id:sel.id,user_id:user.id,content},token);
      setComments(await loadComments(sel.id));
      setCommentText("");
      // In-app notification to the seller (never to yourself — notify() guards).
      const who=(profile?.username||profile?.full_name||"Someone").trim();
      notify(sel.user_id,"comment","New question",`${who} asked a question on your listing ${sel.name}`,sel.id);
      flash("💬 Question posted!");
    }catch(e){ flash("Failed to post your question."); }
  }

  async function deleteComment(id){
    try{
      await db.deleteComment(id,token);
      setComments(p=>p.filter(c=>c.id!==id));
    }catch(e){ flash("Failed to delete comment."); }
  }

  // Phase 14 — seller replies to a buyer's question. The reply is just another
  // comment row pointing back at the question via parent_comment_id; the
  // original commenter is notified that the seller answered.
  async function submitReply(parent,content){
    if(!user||!sel) return;
    const text=(content||"").trim();
    if(!text) return;
    try{
      await db.insertComment({listing_id:sel.id,user_id:user.id,content:text,parent_comment_id:parent.id},token);
      setComments(await loadComments(sel.id));
      notify(parent.user_id,"comment","Seller replied",`The seller replied to your question on ${sel.name}`,sel.id);
      flash("💬 Reply posted!");
    }catch(e){ flash("Failed to post your reply."); }
  }

  // ── Phase 14 — Make an offer (buyer side) ─────────────────────────────────
  // Insert the offer, notify the seller in-app (the email fires from the data
  // layer), then flip the Detail page to its OFFER PENDING state. `amountPence`
  // is already validated in the modal. Returns true so the modal can close only
  // on success. The seller accept/decline flow is a later issue.
  async function submitOffer(amountPence,message){
    if(!user||!sel) return false;
    try{
      const created=await db.insertOffer({listing_id:sel.id,buyer_id:user.id,seller_id:sel.user_id,amount_pence:amountPence,message:(message||"").trim()||null,status:"pending"},token);
      setMyOffer(created);
      const who=(profile?.username||profile?.full_name||"Someone").trim();
      const amt=`${currencySymbol(sel.currency)}${(amountPence/100).toFixed(2).replace(/\.00$/,"")}`;
      // type "new_offer" routes the notification to the listing (not messages).
      notify(sel.user_id,"new_offer",`💸 New offer on "${sel.name}"`,`${who} made an offer of ${amt} on ${sel.name}`,sel.id);
      flash("Offer sent! The seller has 48 hours to respond.",6000);
      return true;
    }catch(e){ console.error("Offer insert failed:",e); flash("Couldn't send your offer. Please try again."); return false; }
  }

  async function withdrawOffer(){
    if(!myOffer) return;
    try{ await db.withdrawOffer(myOffer.id,token); setMyOffer(null); flash("Offer withdrawn."); }
    catch(e){ flash("Couldn't withdraw your offer."); }
  }

  // ── Phase 14 — Buyer's own offers + offer checkout (the /offers page) ──────
  // Load every offer this buyer has made (grouped by status on the page). Safe to
  // call without a session — it just clears the list.
  async function loadBuyerOffers(){
    if(!user||!token){ setBuyerOffers([]); return; }
    setOffersLoading(true);
    try{ setBuyerOffers(await db.getBuyerOffers(user.id,token)||[]); }
    catch(e){ console.error("Load buyer offers failed:",e); setBuyerOffers([]); }
    finally{ setOffersLoading(false); }
  }
  // COMPLETE PURCHASE on an accepted offer → Stripe checkout for the offer amount
  // (create-offer-checkout re-verifies + redirects to the hosted page).
  async function completeOfferPurchase(offer){
    if(!user){ setAuthMode("login"); setView("auth"); return; }
    if(!offer) return;
    setCheckoutOfferId(offer.id);
    try{ await startOfferCheckout({offerId:offer.id,buyerId:user.id}); }
    catch(e){ console.error("Offer checkout failed:",e); flash(e.message||"Couldn't start checkout. Please try again."); setCheckoutOfferId(null); }
  }
  // Withdraw a still-pending offer from the /offers page, then refresh the list.
  async function withdrawBuyerOffer(offer){
    if(!offer) return;
    try{ await db.withdrawOffer(offer.id,token); if(myOffer&&myOffer.id===offer.id) setMyOffer(null); flash("Offer withdrawn."); await loadBuyerOffers(); }
    catch(e){ flash("Couldn't withdraw your offer."); }
  }
  // MAKE NEW OFFER on a declined offer → open the listing (where the offer modal
  // lives). Use the cached listing if we have it, else fetch it fresh.
  async function makeNewOffer(offer){
    const lid=offer&&offer.listing_id; if(!lid) return;
    const cached=items.find(i=>i.id===lid);
    if(cached){ openDetail(cached); return; }
    try{ const l=await db.getListing(lid,token); if(l) openDetail(l); else flash("That listing is no longer available."); }
    catch(e){ flash("That listing is no longer available."); }
  }

  // ── Phase 14 — Seller responds to offers (accept / decline) ───────────────
  // Load the seller's incoming offers for the dashboard OFFERS tab and resolve
  // the buyer names ("From Sarah") in one batched profiles fetch.
  const loadSellerOffers=useCallback(async()=>{
    if(!user||!token){ setSellerOffers([]); setOfferBuyers({}); return; }
    try{
      const rows=await db.getSellerOffers(user.id,token);
      setSellerOffers(rows||[]);
      const ids=[...new Set((rows||[]).map(o=>o.buyer_id).filter(Boolean))];
      if(ids.length){
        const profs=await db.getProfilesByIds(ids,token);
        const map={}; profs.forEach(p=>{ map[p.id]=p; });
        setOfferBuyers(map);
      } else setOfferBuyers({});
    }catch(e){ setSellerOffers([]); }
  },[user,token]);

  // Accept an offer (PART 3). Flip status, pause offers on the listing, decline
  // the other pending offers, then fire every in-app notification (the emails
  // fire from the data layer). The listing is NOT marked sold — payment is the
  // next issue. Returns true so the modal can close only on success.
  async function acceptOffer(offer){
    if(!user||!offer) return false;
    try{
      const declined=await db.acceptOffer(offer,token);
      const listing=offer.listings||{};
      const title=listing.name||"your listing";
      const amt=`${currencySymbol(listing.currency)}${(offer.amount_pence/100).toFixed(2).replace(/\.00$/,"")}`;
      // Notify the winning buyer.
      notify(offer.buyer_id,"offer","Offer accepted!",`Your offer of ${amt} on ${title} has been accepted! Complete your purchase within 24 hours.`,offer.listing_id);
      // Notify each auto-declined buyer.
      (declined||[]).forEach(d=>notify(d.buyer_id,"offer","Offer not accepted",`Your offer on ${title} was not accepted this time.`,offer.listing_id));
      await loadSellerOffers();
      await fetchItems(); // listing.offers_enabled changed
      flash("Offer accepted — the buyer has been notified.",6000);
      return true;
    }catch(e){ console.error("Accept offer failed:",e); flash("Couldn't accept the offer. Please try again."); return false; }
  }

  // Decline an offer (PART 4). Optional counter price (in pounds) → pence. Flip
  // status, notify the buyer in-app (counter vs plain wording), email from the
  // data layer. Returns true so the modal closes only on success.
  async function declineOffer(offer,counterPounds){
    if(!user||!offer) return false;
    try{
      const counterPence=(counterPounds!==""&&counterPounds!=null&&!isNaN(parseFloat(counterPounds)))?Math.round(parseFloat(counterPounds)*100):null;
      await db.declineOffer(offer,counterPence,token);
      const listing=offer.listings||{};
      const title=listing.name||"your listing";
      if(counterPence!=null){
        const c=`${currencySymbol(listing.currency)}${(counterPence/100).toFixed(2).replace(/\.00$/,"")}`;
        notify(offer.buyer_id,"offer","Offer not accepted",`Your offer on ${title} was not accepted. The seller suggests ${c}.`,offer.listing_id);
      } else {
        notify(offer.buyer_id,"offer","Offer not accepted",`Your offer on ${title} was not accepted this time.`,offer.listing_id);
      }
      await loadSellerOffers();
      flash("Offer declined — the buyer has been notified.");
      return true;
    }catch(e){ console.error("Decline offer failed:",e); flash("Couldn't decline the offer. Please try again."); return false; }
  }

  async function submitReport(){
    if(!user||!sel||!reportReason)return;
    try{
      // Free-text `details` only when the reporter picked "Other".
      const details=reportReason==="Other"?(reportDetails.trim()||null):null;
      await db.insertReport({listing_id:sel.id,reporter_id:user.id,reason:reportReason,details},token);
      // Show the success state in-modal, then auto-close after 2s (issue PART 1).
      setReportDone(true);
      setTimeout(()=>{ setShowReport(false); setReportDone(false); setReportReason(""); setReportDetails(""); },2000);
    }catch(e){ flash("Failed to submit report."); }
  }

  // Phase 11 — open the "Report a problem" modal for an order (buyer side).
  function openDispute(order){
    if(!user){ setAuthMode("login"); setView("auth"); return; }
    setDisputeForm({problem_type:"",details:"",photoFile:null,photoPreview:""});
    setDisputeDone(false);
    setDisputeOrder(order);
  }
  function closeDispute(){ setDisputeOrder(null); setDisputeDone(false); }
  function setDisputePhoto(file){
    if(!file){ setDisputeForm(f=>({...f,photoFile:null,photoPreview:""})); return; }
    setDisputeForm(f=>({...f,photoFile:file,photoPreview:URL.createObjectURL(file)}));
  }

  // Submit a dispute: optionally upload the evidence photo, insert the dispute row,
  // notify every Stitch'd admin, then show the success state and auto-close (PART 2).
  async function submitDispute(){
    if(!disputeOrder||!disputeForm.problem_type||!disputeForm.details.trim()||disputeBusy) return;
    setDisputeBusy(true);
    try{
      let photo_url=null;
      if(disputeForm.photoFile){
        try{ photo_url=await withFreshToken(tok=>uploadDisputeImage(disputeForm.photoFile,tok)); }
        catch(e){ /* a failed photo upload shouldn't block the dispute itself */ }
      }
      const o=disputeOrder;
      await db.insertDispute({order_id:o.id,buyer_id:user.id,seller_id:o.seller_id||null,problem_type:disputeForm.problem_type,details:disputeForm.details.trim(),photo_url,status:"open"},token);
      // Notify the Stitch'd admin(s) — type='dispute', routed to each is_admin user.
      const title=items.find(i=>i.id===o.listing_id)?.name||"an order";
      const admins=await db.getAdmins(token);
      await Promise.all((admins||[]).map(a=>notify(a.id,"dispute","⚠️ New dispute raised",`A buyer reported a problem with "${title}": ${disputeForm.problem_type}`,o.listing_id)));
      setDisputeDone(true);
      setTimeout(()=>{ closeDispute(); },2000);
    }catch(e){ flash("Failed to submit dispute."); }
    finally{ setDisputeBusy(false); }
  }

  // Phase 11 — admin panel: load all reports + disputes plus the display names of
  // the reporters/buyers referenced. Called when an admin opens the dashboard.
  async function loadAdminData(){
    if(!isAdmin||!token) return;
    const [reports,disputes,applications,tailors,payouts]=await Promise.all([db.getAllReports(token),db.getAllDisputes(token),db.getVerificationApplications(token),db.getPendingTailors(token),db.getAllPayouts(token)]);
    setAdminReports(reports); setAdminDisputes(disputes); setAdminApplications(applications); setAdminTailors(tailors); setAdminPayouts(payouts);
    const ids=[...new Set([...reports.map(r=>r.reporter_id),...disputes.map(d=>d.buyer_id)].filter(Boolean))];
    if(ids.length){
      const profs=await db.getProfilesByIds(ids,token);
      const map={}; profs.forEach(p=>{ map[p.id]=(p.full_name&&p.full_name.trim())||p.username||"A user"; });
      setAdminNames(map);
    }
    // Resolve applicant profiles (all columns) so the panel can show @username /
    // email alongside the name captured on the application itself.
    const appIds=[...new Set(applications.map(a=>a.user_id).filter(Boolean))];
    if(appIds.length){
      const profs=await db.getProfilesFullByIds(appIds,token);
      const map={}; profs.forEach(p=>{ map[p.id]=p; });
      setAdminApplicants(map);
    }
  }
  async function markReportResolved(id){
    try{ await db.updateReport(id,{status:"resolved"},token); setAdminReports(p=>p.map(r=>r.id===id?{...r,status:"resolved"}:r)); }
    catch(e){ flash("Failed to update report."); }
  }
  // Updating a dispute's status notifies the buyer of the new state (issue PART 4).
  async function updateDisputeStatus(id,newStatus){
    const d=adminDisputes.find(x=>x.id===id);
    try{
      await db.updateDispute(id,{status:newStatus},token);
      setAdminDisputes(p=>p.map(x=>x.id===id?{...x,status:newStatus}:x));
      if(d&&d.buyer_id){
        const label=newStatus.replace(/_/g," ").toUpperCase();
        await notify(d.buyer_id,"dispute","⚖️ Dispute update",`Your dispute has been updated to: ${label}`,d.order_id);
      }
      flash(`Dispute marked ${newStatus.replace(/_/g," ").toUpperCase()}.`);
    }catch(e){ flash("Failed to update dispute."); }
  }

  // Phase 11 — admin: approve a verification application. Flips the seller's
  // profile to verified, stamps the application approved, notifies the seller, and
  // keeps the verifiedSellers set in sync so the badge appears immediately.
  async function approveVerification(app){
    const now=new Date().toISOString();
    try{
      await db.updateProfileVerification(app.user_id,{verified:true,verification_status:"verified",verified_at:now},token);
      await db.updateVerificationApplication(app.id,{status:"approved",reviewed_at:now},token);
      setAdminApplications(p=>p.map(a=>a.id===app.id?{...a,status:"approved",reviewed_at:now}:a));
      setVerifiedSellers(prev=>{ const s=new Set(prev); s.add(app.user_id); return s; });
      if(app.user_id===user?.id){ setProfile(p=>p?{...p,verified:true,verification_status:"verified",verified_at:now}:p); }
      await notify(app.user_id,"verification","✅ You're verified!","Congratulations! Your verified seller application has been approved.");
      flash("Application approved.");
    }catch(e){ flash("Failed to approve application."); }
  }

  // Reject a verification application with optional admin notes. Sets the seller's
  // status to rejected (so the dashboard shows APPLICATION UNSUCCESSFUL) and notifies them.
  async function rejectVerification(app,notes){
    const now=new Date().toISOString();
    try{
      await db.updateProfileVerification(app.user_id,{verification_status:"rejected"},token);
      await db.updateVerificationApplication(app.id,{status:"rejected",admin_notes:notes||null,reviewed_at:now},token);
      setAdminApplications(p=>p.map(a=>a.id===app.id?{...a,status:"rejected",admin_notes:notes||null,reviewed_at:now}:a));
      if(app.user_id===user?.id){ setProfile(p=>p?{...p,verification_status:"rejected"}:p); }
      await notify(app.user_id,"verification","Verification update","Your verified seller application was unsuccessful this time. You can reapply after 30 days.");
      flash("Application rejected.");
    }catch(e){ flash("Failed to reject application."); }
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

  // The live shop filter state captured into the saved_searches `filters` shape.
  const currentFilters = ()=>buildSearchFilters({query:search,catFilter,sizeFilter,minPrice,maxPrice,typeFilter,condFilter,occFilter,colourFilter,verifiedOnly:showVerifiedOnly});

  // Open the SAVE THIS SEARCH modal (issue PART 2). Logged-out buyers are sent to
  // log in first; there must be at least one active filter/query to save.
  function openSaveSearch(){
    if(!user){ flash("Log in to save searches and get alerts!"); setAuthMode("login"); setView("auth"); return; }
    if(!hasFilters){ flash("Apply a filter or type a search first, then save it."); return; }
    setSaveSearchName(""); setSaveSearchAlerts(true); setShowSaveSearch(true);
    setShowSuggestions(false); setShowSavedSearches(false);
  }

  // Persist the current filters as a saved search with the chosen name + alert
  // preference. `query` is kept as a top-level column for the legacy quick-pick
  // dropdown; the full criteria live in `filters` (what the alert function reads).
  async function confirmSaveSearch(){
    if(!user||!token){ flash("Log in to save searches!"); return; }
    setSavingSearch(true);
    try{
      await db.saveSearch({user_id:user.id,name:saveSearchName.trim()||null,query:search||"",filters:currentFilters(),email_alerts:saveSearchAlerts},token);
      await loadSavedSearches();
      setShowSaveSearch(false);
      flash(saveSearchAlerts?"🔖 Search saved! We'll email you when new listings match.":"🔖 Search saved!");
    }catch(e){ flash("Failed to save search."); }
    finally{ setSavingSearch(false); }
  }

  async function deleteSavedSearch(id){
    try{ await db.deleteSavedSearch(id,token); setSavedSearches(p=>p.filter(s=>s.id!==id)); flash("Saved search removed."); }
    catch(e){ flash("Failed to delete."); }
  }

  // Toggle a saved search's email alerts on/off from the saved-searches page.
  // Optimistic: flip locally, then PATCH; revert + toast on failure.
  async function toggleSavedSearchAlerts(id,on){
    setSavedSearches(p=>p.map(s=>s.id===id?{...s,email_alerts:on}:s));
    try{ await db.updateSavedSearch(id,{email_alerts:on},token); }
    catch(e){ setSavedSearches(p=>p.map(s=>s.id===id?{...s,email_alerts:!on}:s)); flash("Couldn't update alerts."); }
  }

  // Restore a saved search's filters back onto the shop and navigate there
  // (SEARCH NOW / quick-pick dropdown). Accepts the full row; falls back to the
  // legacy `query`-only string for the oldest saved rows.
  function applySavedSearch(s){
    const f=(s&&typeof s==="object"&&s.filters&&typeof s.filters==="object")?s.filters:(typeof s==="string"?{query:s}:{});
    setSearch(f.query||"");
    setCatFilter(f.category||"All");
    setTypeFilter(f.type||"All");
    setSizeFilter(f.size||"All");
    setCondFilter(f.condition||"All");
    setMinPrice(f.min_price!=null?String(f.min_price):"");
    setMaxPrice(f.max_price!=null?String(f.max_price):"");
    setOccFilter(Array.isArray(f.occasion)?[...f.occasion]:[]);
    setColourFilter(Array.isArray(f.colour)?[...f.colour]:[]);
    setShowVerifiedOnly(!!f.verified_only);
    setShowSuggestions(false); setSearchSuggestions([]); setShowSavedSearches(false);
    setView("shop"); window.scrollTo(0,0);
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

  // Phase 10e — load active, published looks (with their items + listings
  // embedded) for the homepage rail and the /looks page.
  async function loadLooks(){
    try{ setLooks(await db.getActiveLooks(token)); }catch(e){ /* non-fatal: section just hides */ }
  }
  useEffect(()=>{ loadLooks(); },[]);

  // The signed-in user's own looks (drafts included) for the TOOLS tab.
  async function loadMyLooks(){
    if(!user||!token){ setMyLooks([]); return; }
    try{ setMyLooks(await db.getLooksByUser(user.id,token)); }catch(e){ setMyLooks([]); }
  }

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
    if(!user||!token){ setMyWishlist(new Set()); setWishlistOrder([]); return; }
    const rows=await db.getMyWishlistDetailed(user.id,token);
    setMyWishlist(new Set(rows.map(r=>r.listing_id)));
    setWishlistOrder(rows.map(r=>r.listing_id));
  }

  // Toggle a DB favourite. Logged-out clicks are sent to sign-in. Updates the
  // count + my-set + recency order optimistically and rolls back if the request
  // fails. A fresh save jumps to the front of the order (most-recent-first).
  async function toggleFavourite(item){
    if(!user||!token){ flash("Sign in to wishlist this piece!"); setAuthMode("login"); setView("auth"); return; }
    const id=item.id, has=myWishlist.has(id);
    setMyWishlist(prev=>{ const n=new Set(prev); has?n.delete(id):n.add(id); return n; });
    setWishlistCounts(prev=>({...prev,[id]:Math.max(0,(prev[id]||0)+(has?-1:1))}));
    setWishlistOrder(prev=> has?prev.filter(x=>x!==id):[id,...prev.filter(x=>x!==id)]);
    try{
      if(has) await db.removeWishlist(user.id,id,token);
      else    await db.addWishlist(user.id,id,token);
    }catch(e){
      setMyWishlist(prev=>{ const n=new Set(prev); has?n.add(id):n.delete(id); return n; });
      setWishlistCounts(prev=>({...prev,[id]:Math.max(0,(prev[id]||0)+(has?1:-1))}));
      setWishlistOrder(prev=> has?[id,...prev.filter(x=>x!==id)]:prev.filter(x=>x!==id));
      flash("Couldn't update wishlist. Try again.");
    }
  }

  // Phase 14 — clear every SOLD item from the wishlist in one tap (the sold
  // section's "CLEAR ALL SOLD ITEMS" action). Optimistic across the batch; on any
  // failure we resync from the table rather than guess which deletes landed.
  async function clearSoldWishlist(){
    if(!user||!token) return;
    const ids=items.filter(i=>i.sold&&myWishlist.has(i.id)).map(i=>i.id);
    if(!ids.length) return;
    const idSet=new Set(ids);
    setMyWishlist(prev=>{ const n=new Set(prev); ids.forEach(id=>n.delete(id)); return n; });
    setWishlistOrder(prev=>prev.filter(x=>!idSet.has(x)));
    setWishlistCounts(prev=>{ const n={...prev}; ids.forEach(id=>{ n[id]=Math.max(0,(n[id]||0)-1); }); return n; });
    try{ await Promise.all(ids.map(id=>db.removeWishlist(user.id,id,token))); }
    catch(e){ flash("Couldn't clear sold items. Try again."); loadMyWishlist(); }
  }

  // Phase 14 — "FIND SIMILAR" on a sold wishlist card: clear active filters, pin
  // the category and drop the buyer on the shop grid showing comparable pieces.
  function findSimilar(item){
    clearFilters();
    if(item.category) setCatFilter(item.category);
    setView("shop");
  }

  // ── Phase 14 — Shareable wishlists ──────────────────────────────────────────
  // Load the signed-in user's shared lists for the MY SHARED LISTS section.
  async function loadMySharedWishlists(){
    if(!user||!token){ setMyShared([]); return; }
    const rows=await db.getMySharedWishlists(user.id,token);
    setMyShared(rows);
  }

  // Open the create modal from /wishlist. Pre-selects every saved piece (the
  // issue's "default: all items selected").
  function openShareModal(){
    if(!user||!token){ flash("Sign in to share your wishlist!"); setAuthMode("login"); setView("auth"); return; }
    setShareMode("create"); setShareStep("form"); setEditingShared(null);
    setShareName(""); setSharePublic(true); setShareResult(null); setShareCopied(false);
    setShareSelected(new Set(wishlistItems.map(i=>i.id)));
    setShowShareModal(true);
  }

  // Open the modal in edit mode for an existing list. Loads the owner's current
  // wishlist so the selector has every piece, then pre-selects those already in
  // the list (plus any list pieces no longer wishlisted, so editing never
  // silently drops them).
  async function openEditSharedList(list){
    if(!user||!token||!list) return;
    await loadMyWishlist();
    const itemIds=(list.shared_wishlist_items||[]).map(r=>r.listing_id).filter(Boolean);
    setShareMode("edit"); setShareStep("form"); setEditingShared(list);
    setShareName(list.name||""); setSharePublic(list.public!==false);
    setShareResult(list); setShareCopied(false);
    setShareSelected(new Set(itemIds));
    setShowShareModal(true);
  }

  function closeShareModal(){
    setShowShareModal(false); setShareStep("form"); setShareResult(null);
    setEditingShared(null); setShareCopied(false);
  }

  function toggleShareItem(id){
    setShareSelected(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  }
  function toggleShareAll(){
    const all=shareSelectItems.length>0&&shareSelectItems.every(i=>shareSelected.has(i.id));
    setShareSelected(all?new Set():new Set(shareSelectItems.map(i=>i.id)));
  }

  // Create OR save (edit) a shareable list. On create we generate a unique slug
  // (name + random 4-char suffix, retried on the rare UNIQUE collision), insert
  // the list and its selected items, then flip the modal to the success state.
  // On edit we rename / re-toggle public and replace the items wholesale.
  async function submitSharedList(){
    if(!user||!token) return;
    const name=shareName.trim();
    const ids=shareSelectItems.filter(i=>shareSelected.has(i.id)).map(i=>i.id);
    if(!name){ flash("Give your list a name."); return; }
    if(!ids.length){ flash("Select at least one piece."); return; }
    setShareSaving(true);
    try{
      if(shareMode==="edit"&&editingShared){
        await withFreshToken(tok=>db.updateSharedWishlist(editingShared.id,{name,public:sharePublic},tok));
        await withFreshToken(tok=>db.clearSharedWishlistItems(editingShared.id,tok));
        await withFreshToken(tok=>db.addSharedWishlistItems(ids.map((lid,i)=>({shared_wishlist_id:editingShared.id,listing_id:lid,position:i})),tok));
        flash("✓ List updated!");
        closeShareModal();
        await loadMySharedWishlists();
        if(view==="public-wishlist"&&publicList&&publicList.id===editingShared.id) loadPublicWishlist(publicList.slug);
      }else{
        let created=null,lastErr=null;
        for(let i=0;i<4&&!created;i++){
          const slug=`${slugifyName(name)}-${randSuffix()}`;
          try{ created=await withFreshToken(tok=>db.createSharedWishlist({user_id:user.id,name,slug,public:sharePublic},tok)); }
          catch(e){ lastErr=e; if(!/duplicate|unique|409|23505/i.test(errMsg(e))) throw e; }
        }
        if(!created) throw lastErr||new Error("Couldn't create the list.");
        await withFreshToken(tok=>db.addSharedWishlistItems(ids.map((lid,i)=>({shared_wishlist_id:created.id,listing_id:lid,position:i})),tok));
        setShareResult(created); setShareStep("success");
        await loadMySharedWishlists();
      }
    }catch(e){ flash(`Couldn't save the list: ${errMsg(e)}`,9000); }
    finally{ setShareSaving(false); }
  }

  async function deleteSharedList(list){
    if(!user||!token||!list) return;
    if(!window.confirm(`Delete "${list.name}"? This can't be undone.`)) return;
    try{
      await withFreshToken(tok=>db.deleteSharedWishlist(list.id,tok));
      setMyShared(prev=>prev.filter(l=>l.id!==list.id));
      flash("List deleted.");
      if(view==="public-wishlist"&&publicList&&publicList.id===list.id){ setPublicList(null); }
    }catch(e){ flash("Couldn't delete the list. Try again."); }
  }

  // Copy a list's public link to the clipboard, flashing a "Copied!"
  // confirmation via the passed setter (modal / public page / MY SHARED LISTS
  // each track their own flag).
  function copyShareLink(slug,setFlag){
    const url=shareSlugUrl(slug);
    const done=()=>{ if(setFlag){ setFlag(true); setTimeout(()=>setFlag(false),2000); } flash("🔗 Link copied!"); };
    try{ navigator.clipboard.writeText(url).then(done).catch(()=>done()); }
    catch{ done(); }
  }

  function whatsappShare(slug){
    const text=`Check out my wishlist on Stitch'd: ${shareSlugDisplay(slug)}`;
    window.open(`whatsapp://send?text=${encodeURIComponent(text)}`,"_blank");
  }

  // Load a public shared list by slug for the no-login /wishlist/<slug> page,
  // resolving the owner's display name for the heading. Anon key reads are fine
  // (no RLS); a missing list leaves publicList null → "no longer available".
  async function loadPublicWishlist(slug){
    if(!slug) return;
    setPublicLoading(true); setPublicCopied(false);
    try{
      const list=await db.getSharedWishlist(slug,token);
      setPublicList(list);
      if(list&&list.user_id){
        const prof=await db.getProfile(list.user_id,token);
        setPublicOwnerName(prof?.full_name||prof?.username||"Someone");
      }else{ setPublicOwnerName("Someone"); }
    }catch(e){ setPublicList(null); }
    finally{ setPublicLoading(false); }
  }

  // Leave the public page back into the SPA, restoring "/" so the URL doesn't
  // stay stuck on /wishlist/<slug>.
  function exitPublicWishlist(item){
    if(window.location.pathname.startsWith("/wishlist/")) window.history.replaceState({},"","/");
    if(item) openDetail(item); else setView("shop");
    window.scrollTo(0,0);
  }

  // Fetch once the set of seller ids flagged fast_seller=true on their profile, so
  // cards/Detail can show a "⚡ FAST SELLER" badge without a per-card profile fetch.
  // Mirrors the seller-ratings lookup: one request feeds the whole grid.
  async function loadFastSellers(){
    const rows=await db.getFastSellers(token);
    setFastSellers(new Set(rows.map(r=>r.id)));
  }

  useEffect(()=>{ loadFastSellers(); },[]);

  // Phase 10d — load the set of sellers currently on vacation so their listings
  // can be filtered out of the shop/search grid.
  async function loadVacationSellers(){
    const rows=await db.getVacationSellers(token);
    setVacationSellers(new Set(rows.map(r=>r.id)));
  }
  useEffect(()=>{ loadVacationSellers(); },[]);

  // Phase 14 — load the sellers offering a bundle discount (id → %) so cards,
  // storefronts and the bag can apply it. Mirrors loadVacationSellers.
  async function loadBundleSellers(){
    const rows=await db.getBundleDiscountSellers(token);
    setBundleSellers(new Map(rows.map(r=>[r.id,r.bundle_discount_percentage||10])));
  }
  useEffect(()=>{ loadBundleSellers(); },[]);

  // Phase 11 — load the set of verified sellers so cards/Detail can show the
  // VERIFIED SELLER badge and the search filter can hide everyone else.
  async function loadVerifiedSellers(){
    const rows=await db.getVerifiedSellers(token);
    setVerifiedSellers(new Set(rows.map(r=>r.id)));
  }
  useEffect(()=>{ loadVerifiedSellers(); },[]);

  // Phase 11 — load the set of identity-verified sellers (Stripe Identity) so
  // cards/Detail can show the ID VERIFIED badge. Mirrors loadVerifiedSellers.
  async function loadIdentityVerifiedSellers(){
    const rows=await db.getIdentityVerifiedSellers(token);
    setIdentityVerifiedSellers(new Set(rows.map(r=>r.id)));
  }
  useEffect(()=>{ loadIdentityVerifiedSellers(); },[]);

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
    if(!tailorServiceForm.service_type){flash("Please select a service type");return;}
    try{
      const imageUrls=await Promise.all((tailorServiceForm.images||[]).map(f=>uploadImage(f,token)));
      const payload={tailor_id:user.id,title:tailorServiceForm.title,description:tailorServiceForm.description,service_type:tailorServiceForm.service_type,price_from:parseFloat(tailorServiceForm.price_from),price_to:tailorServiceForm.price_to?parseFloat(tailorServiceForm.price_to):null,turnaround_days:tailorServiceForm.turnaround_days?parseInt(tailorServiceForm.turnaround_days):null,location:tailorServiceForm.location,images:imageUrls,active:true};
      if(editingService){ await db.updateTailorService(editingService.id,payload,token); flash("✓ Service updated!"); }
      else { await db.insertTailorService(payload,token); flash("🩷 Service listed!"); }
      setShowTailorForm(false); setEditingService(null);
      setTailorServiceForm({title:"",description:"",service_type:"All",price_from:"",price_to:"",turnaround_days:"",location:"",images:[],imagePreviews:[]});
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

  // ── Phase 15 — Tailor profiles ──────────────────────────────────────────────
  const poundsToPence=(v)=>{ const n=parseFloat(v); return isNaN(n)?null:Math.round(n*100); };

  // Open the multi-step BECOME A TAILOR application flow with a blank form.
  function openTailorApply(){
    if(!user){ setAuthMode("login"); setView("auth"); return; }
    // Reapply (rejected): prefill from the existing row so they only tweak what's
    // needed. A fresh application starts blank (name seeded from their profile).
    const t=myTailor;
    setApplyForm({step:1,
      display_name:(t&&t.display_name)||profile?.full_name||"",
      location:(t&&t.location)||"",
      bio:(t&&t.bio)||"",
      profileFile:null,profilePreview:(t&&t.profile_image_url)||"",
      specialisms:(t&&t.specialisms)||[],
      price_from:(t&&t.price_from_pence!=null)?(t.price_from_pence/100).toString():"",
      price_to:(t&&t.price_to_pence!=null)?(t.price_to_pence/100).toString():"",
      turnaround_days:(t&&t.turnaround_days)||null,
      instagram_handle:(t&&t.instagram_handle)||"",
      website_url:(t&&t.website_url)||"",
      portfolio:[]});
    setView("tailor-apply"); window.scrollTo(0,0);
  }

  // Submit the application: upload the profile image + any portfolio images,
  // insert the tailor row (status='pending') and its portfolio, notify every
  // admin, then show the success message.
  async function submitTailorApplication(){
    if(!user||!token){ setAuthMode("login"); setView("auth"); return; }
    if(!applyForm) return;
    if(!applyForm.display_name||!applyForm.location||!applyForm.bio||!(applyForm.profileFile||applyForm.profilePreview)){
      flash("Please complete name, location, bio and a profile image."); setApplyForm(f=>({...f,step:1})); return;
    }
    setApplyBusy(true);
    try{
      const profileUrl=applyForm.profileFile?await uploadTailorProfileImage(applyForm.profileFile,token):applyForm.profilePreview;
      const payload={
        display_name:applyForm.display_name.trim(),
        location:applyForm.location.trim(),
        bio:applyForm.bio.trim()||null,
        specialisms:applyForm.specialisms||[],
        price_from_pence:poundsToPence(applyForm.price_from),
        price_to_pence:poundsToPence(applyForm.price_to),
        turnaround_days:applyForm.turnaround_days||null,
        instagram_handle:applyForm.instagram_handle.trim()||null,
        website_url:applyForm.website_url.trim()||null,
        profile_image_url:profileUrl||null,
        status:"pending",
      };
      // Reapply reuses the existing row (UNIQUE(user_id) would 409 on re-insert).
      const row=(myTailor&&myTailor.id)
        ? await db.updateTailor(myTailor.id,{...payload,approved_at:null},token)
        : await db.insertTailor({user_id:user.id,...payload},token);
      // Upload + insert portfolio (only the tiles that actually have an image).
      const withImages=(applyForm.portfolio||[]).filter(p=>p.file||p.preview);
      if(row&&row.id&&withImages.length){
        const urls=await Promise.all(withImages.map(p=>p.file?uploadTailorPortfolioImage(p.file,token):Promise.resolve(p.preview)));
        const prows=withImages.map((p,i)=>({tailor_id:row.id,image_url:urls[i],caption:p.caption||null,garment_type:p.garment_type||null,position:i}));
        await db.insertPortfolioItems(prows,token).catch(()=>{});
      }
      setMyTailor(row);
      // Notify every admin of the new application.
      try{ const admins=await db.getAdmins(token); await Promise.all((admins||[]).map(a=>notify(a.id,"tailor_application","New tailor application",`New tailor application from ${row.display_name}`,row.id))); }catch(e){}
      flash("Application submitted! We'll review it within 3 working days.",6000);
      setApplyForm(null);
      setView("shop"); window.scrollTo(0,0);
    }catch(e){ flash("Couldn't submit application: "+errMsg(e)); }
    finally{ setApplyBusy(false); }
  }

  // Open the tailor dashboard: seed the edit form from myTailor, load portfolio.
  async function openTailorDashboard(){
    if(!myTailor) return;
    setTailorEdit({
      display_name:myTailor.display_name||"",
      location:myTailor.location||"",
      bio:myTailor.bio||"",
      specialisms:myTailor.specialisms||[],
      price_from:myTailor.price_from_pence!=null?(myTailor.price_from_pence/100).toString():"",
      price_to:myTailor.price_to_pence!=null?(myTailor.price_to_pence/100).toString():"",
      turnaround_days:myTailor.turnaround_days||null,
      instagram_handle:myTailor.instagram_handle||"",
      website_url:myTailor.website_url||"",
      profileFile:null,profilePreview:myTailor.profile_image_url||"",
      bannerFile:null,bannerPreview:myTailor.banner_image_url||"",banner_image_url:myTailor.banner_image_url||"",
    });
    setTailorDashTab("profile");
    setView("tailor-dashboard"); window.scrollTo(0,0);
    loadTailorAlterations();
    loadTailorPayouts();
    loadTailorReviews();
    loadTailorAvailability();
    try{ const p=await db.getTailorPortfolio(myTailor.id,token); setTailorPortfolio(p); }catch(e){ setTailorPortfolio([]); }
  }

  // Load the tailor's reviews (+ reviewer profiles) for the dashboard REVIEWS tab.
  async function loadTailorReviews(){
    if(!myTailor||!token) return;
    try{
      const reviews=await db.getTailorReviews(myTailor.id,token);
      setTailorReviews(reviews);
      setTailorReviewBuyers(await resolveReviewBuyers(reviews));
    }catch(e){ setTailorReviews([]); setTailorReviewBuyers({}); }
  }

  // ── Phase 15 — Tailor availability calendar ────────────────────────────────
  // Load the signed-in tailor's availability rows for the dashboard tab.
  async function loadTailorAvailability(){
    if(!myTailor||!token) return;
    setAvailabilityLoading(true);
    try{ setAvailabilityRows(await db.getTailorAvailability(myTailor.id,token)); }
    catch(e){ setAvailabilityRows([]); }
    finally{ setAvailabilityLoading(false); }
  }
  // Merge an upserted row into the local availability array (by date).
  const mergeAvailabilityRow=(row)=>{ if(!row) return; setAvailabilityRows(prev=>{ const iso=String(row.date).slice(0,10); const rest=prev.filter(r=>String(r.date).slice(0,10)!==iso); return [...rest,row].sort((a,b)=>String(a.date).localeCompare(String(b.date))); }); };
  const availDefaultSlots=()=>Number(myTailor&&myTailor.default_slots_per_day)||3;
  const isDateAvailable=(iso)=>{ const row=availabilityRows.find(r=>String(r.date).slice(0,10)===iso); if(!row) return true; if(row.available===false) return false; return row.slots_remaining==null||Number(row.slots_remaining)>0; };

  // Show/hide the calendar on the public profile.
  async function toggleAvailabilityEnabled(on){
    if(!myTailor||!token) return;
    setAvailabilityBusy(true);
    try{ await db.updateTailor(myTailor.id,{availability_enabled:!!on},token); setMyTailor(m=>({...m,availability_enabled:!!on})); flash(on?"Your availability is now visible to buyers.":"Your availability is hidden."); }
    catch(e){ flash("Couldn't update: "+errMsg(e)); }
    finally{ setAvailabilityBusy(false); }
  }
  // Save the advance-booking window + daily-slots settings.
  async function saveAvailabilitySettings({ advance_booking_days, default_slots_per_day }){
    if(!myTailor||!token) return;
    setAvailabilityBusy(true);
    try{ const patch={advance_booking_days:Number(advance_booking_days)||30,default_slots_per_day:Math.max(1,Math.min(10,Number(default_slots_per_day)||3))}; await db.updateTailor(myTailor.id,patch,token); setMyTailor(m=>({...m,...patch})); flash("Availability settings saved."); }
    catch(e){ flash("Couldn't save settings: "+errMsg(e)); }
    finally{ setAvailabilityBusy(false); }
  }
  // Toggle a single day available ⇄ unavailable.
  async function setDayAvailability(iso){
    if(!myTailor||!token) return;
    const makeUnavailable=isDateAvailable(iso);
    const row=makeUnavailable?{tailor_id:myTailor.id,date:iso,available:false,slots_remaining:0}:{tailor_id:myTailor.id,date:iso,available:true,slots_remaining:availDefaultSlots()};
    setAvailabilityBusy(true);
    try{ const saved=await db.upsertTailorAvailability(row,token); mergeAvailabilityRow(saved||row); }
    catch(e){ flash("Couldn't update that day."); }
    finally{ setAvailabilityBusy(false); }
  }
  // Set a specific day's slot count (0 ⇒ unavailable).
  async function setDaySlots(iso,n){
    if(!myTailor||!token) return;
    const slots=Math.max(0,Math.min(10,Number(n)||0));
    const row={tailor_id:myTailor.id,date:iso,available:slots>0,slots_remaining:slots};
    setAvailabilityBusy(true);
    try{ const saved=await db.upsertTailorAvailability(row,token); mergeAvailabilityRow(saved||row); }
    catch(e){ flash("Couldn't update that day."); }
    finally{ setAvailabilityBusy(false); }
  }
  // Toggle a set of dates (week label / "next 2 weeks" bulk action): if every date
  // is already unavailable, restore them; otherwise mark them all unavailable.
  async function markRangeUnavailable(isoList){
    if(!myTailor||!token||!isoList||!isoList.length) return;
    const allUnavailable=isoList.every(iso=>!isDateAvailable(iso));
    const rows=isoList.map(iso=>allUnavailable?{tailor_id:myTailor.id,date:iso,available:true,slots_remaining:availDefaultSlots()}:{tailor_id:myTailor.id,date:iso,available:false,slots_remaining:0});
    setAvailabilityBusy(true);
    try{ const saved=await db.bulkUpsertTailorAvailability(rows,token); (saved&&saved.length?saved:rows).forEach(mergeAvailabilityRow); }
    catch(e){ flash("Couldn't update those days."); }
    finally{ setAvailabilityBusy(false); }
  }
  // MARK ALL AS AVAILABLE — clear every override.
  async function markAllAvailable(){
    if(!myTailor||!token) return;
    setAvailabilityBusy(true);
    try{ await db.clearTailorAvailability(myTailor.id,token); setAvailabilityRows([]); flash("All dates marked available."); }
    catch(e){ flash("Couldn't reset availability."); }
    finally{ setAvailabilityBusy(false); }
  }

  // Save the PROFILE tab edits (uploading any new profile/banner image first).
  async function saveTailorProfile(){
    if(!myTailor||!tailorEdit||!token) return;
    setTailorEditBusy(true);
    try{
      let profileUrl=tailorEdit.profilePreview||null;
      if(tailorEdit.profileFile) profileUrl=await uploadTailorProfileImage(tailorEdit.profileFile,token);
      let bannerUrl=tailorEdit.banner_image_url||null;
      if(tailorEdit.bannerFile) bannerUrl=await uploadTailorProfileImage(tailorEdit.bannerFile,token);
      else if(!tailorEdit.bannerPreview) bannerUrl=null;
      const patch={
        display_name:tailorEdit.display_name.trim(),
        location:tailorEdit.location.trim(),
        bio:tailorEdit.bio.trim()||null,
        specialisms:tailorEdit.specialisms||[],
        price_from_pence:poundsToPence(tailorEdit.price_from),
        price_to_pence:poundsToPence(tailorEdit.price_to),
        turnaround_days:tailorEdit.turnaround_days||null,
        instagram_handle:tailorEdit.instagram_handle.trim()||null,
        website_url:tailorEdit.website_url.trim()||null,
        profile_image_url:profileUrl,
        banner_image_url:bannerUrl,
      };
      const updated=await db.updateTailor(myTailor.id,patch,token);
      setMyTailor(m=>({...m,...patch,...(updated||{})}));
      flash("Profile saved.");
    }catch(e){ flash("Couldn't save: "+errMsg(e)); }
    finally{ setTailorEditBusy(false); }
  }

  // PORTFOLIO tab — add images (respecting the max of 8).
  async function addPortfolioImages(files){
    if(!myTailor||!token) return;
    const remaining=8-(tailorPortfolio?.length||0);
    if(remaining<=0){ flash("You can upload up to 8 portfolio images."); return; }
    const toAdd=files.slice(0,remaining);
    setPortfolioBusy(true);
    try{
      const urls=await Promise.all(toAdd.map(f=>uploadTailorPortfolioImage(f,token)));
      const base=tailorPortfolio?.length||0;
      const rows=urls.map((u,i)=>({tailor_id:myTailor.id,image_url:u,caption:null,garment_type:null,position:base+i}));
      const inserted=await db.insertPortfolioItems(rows,token);
      setTailorPortfolio(p=>[...p,...inserted]);
      if(files.length>remaining) flash(`Added ${remaining} — portfolio is now full (max 8).`);
    }catch(e){ flash("Couldn't add photos: "+errMsg(e)); }
    finally{ setPortfolioBusy(false); }
  }

  async function deletePortfolioImage(id){
    if(!token) return;
    try{ await db.deletePortfolioItem(id,token); setTailorPortfolio(p=>p.filter(i=>i.id!==id)); }
    catch(e){ flash("Couldn't delete image."); }
  }

  // Reorder a portfolio image up (-1) or down (+1) and persist the new positions.
  async function movePortfolioImage(id,dir){
    if(!token) return;
    const list=[...tailorPortfolio];
    const idx=list.findIndex(i=>i.id===id);
    const swap=idx+dir;
    if(idx<0||swap<0||swap>=list.length) return;
    [list[idx],list[swap]]=[list[swap],list[idx]];
    setTailorPortfolio(list);
    try{ await Promise.all(list.map((img,i)=>img.position===i?null:db.updatePortfolioItem(img.id,{position:i},token))); }
    catch(e){ /* optimistic reorder already applied */ }
  }

  // Open a public tailor profile (/tailors/<id>). `pushUrl` updates the address
  // bar so PREVIEW PROFILE / a shared link work as a real page.
  async function openTailorPublic(id,pushUrl=false){
    if(!id) return;
    setPublicTailor(null); setPublicTailorLoading(true);
    setPublicTailorReviews([]); setPublicReviewBuyers({}); setPublicAvailability([]);
    setView("tailor-public"); window.scrollTo(0,0);
    if(pushUrl){ try{ window.history.pushState({},"",`/tailors/${id}`); }catch(e){} }
    try{ const t=await db.getTailor(id,token); setPublicTailor(t);
      // Load the calendar only if the tailor has switched it on.
      if(t&&t.availability_enabled){ try{ setPublicAvailability(await db.getTailorAvailability(id,token)); }catch(e){ setPublicAvailability([]); } }
    }
    catch(e){ setPublicTailor(null); }
    finally{ setPublicTailorLoading(false); }
    // Reviews for the profile's REVIEWS section, plus the reviewers' profiles
    // (first name + avatar). Best-effort — the section degrades to its empty state.
    try{
      const reviews=await db.getTailorReviews(id,token);
      setPublicTailorReviews(reviews);
      setPublicReviewBuyers(await resolveReviewBuyers(reviews));
    }catch(e){ /* leave empty */ }
  }

  // Resolve the reviewer profiles (id → {full_name, username, avatar_url}) for a
  // set of reviews, so the list can show each buyer's first name + avatar.
  async function resolveReviewBuyers(reviews){
    const ids=[...new Set((reviews||[]).map(r=>r.buyer_id).filter(Boolean))];
    if(!ids.length) return {};
    try{ const profs=await db.getProfilesFullByIds(ids,token); const map={}; profs.forEach(p=>{ map[p.id]=p; }); return map; }
    catch(e){ return {}; }
  }

  // ── Phase 15 — Request alterations on a listing ────────────────────────────
  // The buyer's display name, used in the in-app notification to the tailor.
  const buyerDisplayName=()=>(profile?.full_name&&profile.full_name.trim())||profile?.username||user?.email?.split("@")[0]||"A buyer";
  // The garment type a request is about, derived from the listing's measurements
  // (the detailed garment) falling back to its category.
  const garmentTypeOf=(l)=>(l&&(parseMeasurements(l)?.garment||l.category))||null;

  async function loadApprovedTailors(){
    try{ setApprovedTailors(await db.getApprovedTailors(token)); }catch(e){ /* leave whatever's cached */ }
  }
  // FIND A TAILOR on the listing detail page → open the request modal (auth is
  // gated in Detail via requireAuth("book", …) before this fires).
  function openAlterationModal(listing){
    if(!listing) return;
    setAlterReqListing(listing); setAlterReqOpen(true);
    loadApprovedTailors();
  }
  // Send the request: insert the row (which fires the tailor email), notify the
  // tailor in-app, then close + confirm.
  async function sendAlterationRequest({ alterations, notes, budget, tailor, preferredDate }){
    if(!user||!token||!alterReqListing||!tailor) return;
    setAlterReqBusy(true);
    try{
      const garment=garmentTypeOf(alterReqListing);
      const row={
        listing_id:alterReqListing.id,
        buyer_id:user.id,
        tailor_id:tailor.id,
        description:notes,
        additional_notes:notes,
        garment_type:garment,
        alterations_needed:alterations,
        budget_pence:poundsToPence(budget),
        preferred_date:preferredDate||null,
        status:"pending",
      };
      await db.insertAlterationRequest(row,token);
      await notify(tailor.user_id,"alteration_request","New alteration request",`${buyerDisplayName()} has sent you an alteration request for a ${garment||"garment"}`,alterReqListing.id);
      setAlterReqOpen(false); setAlterReqListing(null); setPreferredDateHint(null);
      flash(`Request sent! ${tailor.display_name} will get back to you with a quote.`,6000);
      if(view==="alterations") loadBuyerAlterations();
    }catch(e){ flash("Couldn't send your request: "+errMsg(e)); }
    finally{ setAlterReqBusy(false); }
  }

  async function loadBuyerAlterations(){
    if(!user||!token) return;
    setBuyerAlterationsLoading(true);
    try{ setBuyerAlterations(await db.getBuyerAlterationRequests(user.id,token)); }
    catch(e){ setBuyerAlterations([]); }
    finally{ setBuyerAlterationsLoading(false); }
    // The buyer's existing reviews, so completed bookings can show "Review
    // submitted" + the stars they gave (and never prompt twice).
    try{ setBuyerReviews(await db.getMyTailorReviews(user.id,token)); }
    catch(e){ /* leave whatever's cached */ }
  }
  function openAlterations(){ loadBuyerAlterations(); setView("alterations"); window.scrollTo(0,0); }

  // SEND ALTERATION REQUEST from a public tailor profile (Part 3). A request is
  // always tied to a listing, so we carry the optional preferred date as a hint
  // and send the buyer to pick the piece they want altered; the hint pre-fills
  // the preferred-date field in the request modal.
  function sendAlterationRequestFromProfile(tailor,dateISO){
    if(!user){ setAuthMode("login"); setView("auth"); return; }
    setPreferredDateHint(dateISO||null);
    flash(`Choose the piece you'd like altered to start your request${tailor&&tailor.display_name?` with ${tailor.display_name}`:""}.${dateISO?" Your preferred date is saved.":""}`,6000);
    setView("shop"); window.scrollTo(0,0);
  }

  async function loadTailorAlterations(){
    if(!myTailor||!token) return;
    setTailorAlterationsLoading(true);
    try{
      const reqs=await db.getTailorAlterationRequests(myTailor.id,token);
      setTailorAlterations(reqs);
      const ids=[...new Set(reqs.map(r=>r.buyer_id).filter(Boolean))];
      if(ids.length){ const profs=await db.getProfilesByIds(ids,token); const map={}; profs.forEach(p=>{ map[p.id]=p; }); setAlterationBuyers(map); }
    }catch(e){ setTailorAlterations([]); }
    finally{ setTailorAlterationsLoading(false); }
  }

  // Open (or create) the buyer↔tailor conversation behind an alteration request.
  // `buyerId`/`tailorUserId` fix who's who; the current user is one of them.
  async function openAlterationConversation(buyerId,tailorUserId,listingId){
    if(!user){ setAuthMode("login"); setView("auth"); return; }
    if(!buyerId||!tailorUserId){ flash("Couldn't open the conversation."); return; }
    if(buyerId===tailorUserId){ flash("You can't message yourself!"); return; }
    try{
      let conv=await db.findConversation(buyerId,tailorUserId,listingId,token);
      if(!conv) conv=await db.createConversation({listing_id:listingId,buyer_id:buyerId,seller_id:tailorUserId,last_message:"",last_message_at:new Date().toISOString()},token);
      await loadConversations();
      setActiveConv(conv);
      setMessages(await db.getMessages(conv.id,token));
      setView("messages"); window.scrollTo(0,0);
    }catch(e){ flash("Could not start conversation."); }
  }
  // Buyer (/alterations) → message the tailor on a request.
  function messageTailorFromRequest(req){ openAlterationConversation(user?.id,req.tailors?.user_id,req.listing_id); }
  // Tailor (dashboard BOOKINGS) → message the buyer on a request.
  function messageBuyerFromRequest(req){ openAlterationConversation(req.buyer_id,user?.id,req.listing_id); }

  // Tailor sends a quote on a request (status → quoted) + notifies the buyer.
  async function sendAlterationQuote(req,quotePence,message){
    if(!token) return;
    try{
      await db.sendAlterationQuote(req.id,quotePence,message,token);
      const name=(myTailor&&myTailor.display_name)||"Your tailor";
      await notify(req.buyer_id,"alteration_quote","You have a quote",`${name} has sent you a quote of ${gbp(quotePence)} for your alteration request`,req.listing_id);
      setTailorAlterations(p=>p.map(r=>r.id===req.id?{...r,status:"quoted",quote_pence:quotePence,quote_message:message||null}:r));
      flash("Quote sent.");
    }catch(e){ flash("Couldn't send the quote: "+errMsg(e)); throw e; }
  }
  // Tailor declines a request (status → declined) + notifies the buyer.
  async function declineAlterationRequest(req){
    if(!token) return;
    try{
      await db.declineAlterationRequest(req.id,token);
      const name=(myTailor&&myTailor.display_name)||"The tailor";
      await notify(req.buyer_id,"alteration_declined","Alteration request update",`${name} is unable to take on your alteration request at this time.`,req.listing_id);
      setTailorAlterations(p=>p.map(r=>r.id===req.id?{...r,status:"declined"}:r));
      flash("Request declined.");
    }catch(e){ flash("Couldn't decline: "+errMsg(e)); throw e; }
  }
  // Buyer accepts a quote → Stripe checkout for the full quote (create-alteration-
  // checkout re-verifies + redirects to the hosted page). On success Stripe
  // returns to /alterations?paid=true and the webhook flips the request to accepted.
  async function acceptAlterationQuote(req){
    if(!user){ setAuthMode("login"); setView("auth"); return; }
    if(!req) return;
    setAlterCheckoutId(req.id);
    try{ await startAlterationCheckout({alterationRequestId:req.id,buyerId:user.id}); }
    catch(e){ console.error("Alteration checkout failed:",e); flash(e.message||"Couldn't start checkout. Please try again."); setAlterCheckoutId(null); }
  }
  // Buyer declines a quote (status → declined) + notifies the tailor with the
  // listing title. Confirmed via the DECLINE QUOTE modal.
  async function declineAlterationQuote(req){
    if(!token||!req) return;
    try{
      await db.declineAlterationQuote(req.id,token);
      const listingTitle=(req.listings&&req.listings.name)||"your listing";
      const tailorUserId=req.tailors&&req.tailors.user_id;
      if(tailorUserId) await notify(tailorUserId,"alteration_declined","Quote declined",`The buyer has declined your quote for ${listingTitle}`,req.listing_id);
      setBuyerAlterations(p=>p.map(r=>r.id===req.id?{...r,status:"declined"}:r));
      flash("Quote declined.");
    }catch(e){ flash("Couldn't decline the quote: "+errMsg(e)); }
  }

  // Tailor marks an accepted booking complete (status → completed) + notifies the
  // buyer to confirm receipt. The "please confirm" email fires from the data layer.
  async function markAlterationComplete(req){
    if(!token||!req) return;
    try{
      await db.markAlterationComplete(req.id,token);
      const name=(myTailor&&myTailor.display_name)||"Your tailor";
      await notify(req.buyer_id,"alteration_complete","Alteration complete",`${name} has marked your alteration as complete. Please confirm when you receive your item.`,req.listing_id);
      setTailorAlterations(p=>p.map(r=>r.id===req.id?{...r,status:"completed"}:r));
      flash("Marked as complete. The buyer will be asked to confirm.");
    }catch(e){ flash("Couldn't mark complete: "+errMsg(e)); throw e; }
  }
  // Buyer confirms completion → release the tailor's payout as a real Stripe
  // Connect transfer (process-tailor-payout). That function decides the outcome:
  //   • paid  — the tailor's onboarded; the transfer went out (it notifies/emails)
  //   • held  — the tailor hasn't finished payment setup; payout stays pending
  //             (it nudges the tailor to finish)
  // If the function is unreachable (e.g. Connect not yet live on the account), we
  // fall back to the DB-only release so completion still works — the transfer can
  // be retried later from the admin PAYOUTS panel.
  // Returns true so the card can switch to the review prompt.
  async function confirmAlterationCompletion(req){
    if(!token||!req) return false;
    try{
      const payoutPence=req.tailor_payout_pence;
      const tailorUserId=req.tailors&&req.tailors.user_id;
      let outcome="paid"; // paid | held | fallback
      try{
        const res=await processTailorPayout(req.id);
        if(res&&res.held) outcome="held";
        else outcome="paid"; // paid or already_paid
      }catch(e){
        // Connect may not be active yet — degrade to the DB-only release so the
        // buyer isn't blocked, and notify the tailor ourselves (the edge function
        // didn't run, so no notification/email fired).
        console.error("Payout transfer failed, falling back to DB release:",e);
        await db.confirmAlterationPayout(req.id,token);
        if(tailorUserId) await notify(tailorUserId,"alteration_payout","Payout confirmed!",`Great news! Your payout of ${gbp(payoutPence)} has been confirmed.`,req.listing_id);
        outcome="fallback";
      }
      // The buyer has done their part — advance their own card to the review
      // prompt regardless of the payout outcome (held is the tailor's concern,
      // surfaced on the tailor EARNINGS + admin PAYOUTS views from the real
      // tailor_payouts.status). This is a local-only optimistic flag.
      setBuyerAlterations(p=>p.map(r=>r.id===req.id?{...r,payout_status:"paid"}:r));
      flash(outcome==="held"
        ? "Thanks for confirming! Your tailor's payout is pending until they finish their payment setup."
        : "Thanks for confirming! We've released the payout to your tailor.");
      // Prompt for a review straight away (Part 2 trigger). Skip if somehow
      // already reviewed; the /alterations card keeps the LEAVE A REVIEW button
      // for later either way.
      if(!buyerReviews.some(rv=>rv.alteration_request_id===req.id)) setReviewReq(req);
      return true;
    }catch(e){ flash("Couldn't confirm completion: "+errMsg(e)); return false; }
  }

  // ── Phase 15 — Leave a review for a tailor ─────────────────────────────────
  // Open the review modal for a completed booking. Guard against reviewing twice
  // (the UNIQUE(alteration_request_id) constraint also enforces this server-side).
  function openTailorReview(req){
    if(!req) return;
    if(buyerReviews.some(rv=>rv.alteration_request_id===req.id)){ flash("You've already reviewed this booking."); return; }
    setReviewReq(req);
  }
  // Submit the review: insert it (which recalculates the tailor's average + fires
  // the review email), notify the tailor in-app, then record it locally so the
  // card flips to "Review submitted" and confirm to the buyer.
  async function submitTailorReview({ rating, comment }){
    const req=reviewReq;
    if(!user||!token||!req||!rating) return;
    setReviewBusy(true);
    try{
      const tailorId=req.tailor_id||(req.tailors&&req.tailors.id);
      const created=await db.insertTailorReview({
        tailor_id:tailorId,
        buyer_id:user.id,
        alteration_request_id:req.id,
        rating,
        comment:comment||null,
      },token);
      const tailorUserId=req.tailors&&req.tailors.user_id;
      if(tailorUserId) await notify(tailorUserId,"tailor_review","New review",`${buyerDisplayName()} left you a ${rating} star review`,req.listing_id);
      setBuyerReviews(p=>[...p,created||{id:`local-${req.id}`,alteration_request_id:req.id,buyer_id:user.id,rating,comment:comment||null}]);
      setReviewReq(null);
      flash("Review submitted! Thank you for your feedback.",6000);
    }catch(e){
      // The UNIQUE constraint surfaces a 409 here if they somehow double-submit.
      if(/duplicate|unique|409/i.test(errMsg(e))){ flash("You've already reviewed this booking."); setReviewReq(null); }
      else flash("Couldn't submit your review: "+errMsg(e));
    }
    finally{ setReviewBusy(false); }
  }

  // Tailor's payout rows for the dashboard EARNINGS section.
  async function loadTailorPayouts(){
    if(!myTailor||!token) return;
    try{ setTailorPayouts(await db.getTailorPayouts(myTailor.id,token)); }
    catch(e){ setTailorPayouts([]); }
  }

  // ── Phase 15 — Stripe Connect onboarding (tailor PAYMENTS section) ─────────
  // Tap CONNECT BANK ACCOUNT → create-connect-account creates/reuses the tailor's
  // Express account and redirects to the Stripe-hosted onboarding flow, which
  // returns to /tailor-dashboard?connect=success.
  async function startTailorPayments(){
    if(!myTailor||!user){ flash("You need to be signed in as a tailor to set up payments."); return; }
    setPaymentsBusy(true);
    try{ await startConnectOnboarding(myTailor.id,user.id); }
    catch(e){ flash(e.message||"Couldn't start payment setup. Please try again."); setPaymentsBusy(false); }
    // No finally — on success the browser navigates away to Stripe.
  }
  // Re-check onboarding against Stripe (details_submitted) and sync myTailor.
  // Called on the ?connect=success return; returns the function's JSON.
  async function verifyTailorPayments({ silent=false }={}){
    if(!myTailor) return null;
    try{
      const res=await verifyConnectAccount(myTailor.id);
      const complete=!!(res&&res.onboarding_complete);
      setMyTailor(m=>m?{...m,stripe_onboarding_complete:complete}:m);
      return res;
    }catch(e){ if(!silent) flash(e.message||"Couldn't verify payment setup."); return null; }
  }
  // MANAGE PAYMENTS → open the tailor's Stripe Express dashboard in a new tab
  // (verify-connect-account returns a login link once onboarding is complete).
  async function manageTailorPayments(){
    if(!myTailor) return;
    setPaymentsBusy(true);
    try{
      const res=await verifyConnectAccount(myTailor.id);
      const url=(res&&(res.dashboard_url||res.url))||null;
      if(url){ try{ window.open(url,"_blank","noopener"); }catch(e){ window.location.href=url; } }
      else flash("Couldn't open your Stripe dashboard. Please try again.");
    }catch(e){ flash(e.message||"Couldn't open your Stripe dashboard."); }
    finally{ setPaymentsBusy(false); }
  }
  // Resolve the Connect return once myTailor + token are ready (cold load after
  // Stripe redirects back). Opens the dashboard, then verifies + confirms.
  useEffect(()=>{
    if(!connectReturn||!myTailor||!token) return;
    const mode=connectReturn;
    setConnectReturn(null);
    (async()=>{
      await openTailorDashboard();
      if(mode==="success"){
        const res=await verifyTailorPayments({silent:true});
        if(res&&res.onboarding_complete) flash("Payment account connected successfully!",6000);
        else flash("Almost there — finish your payment setup to start receiving payouts.",6000);
      }else{
        flash("Payment setup wasn't completed. You can resume it anytime from your profile.",6000);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[connectReturn,myTailor,token]);

  // Admin — approve a tailor application: flip status to approved, stamp the
  // approval, notify + email the tailor, keep myTailor in sync if it's me.
  async function approveTailor(t){
    const now=new Date().toISOString();
    try{
      const updated=await db.updateTailor(t.id,{status:"approved",approved_at:now},token);
      setAdminTailors(p=>p.map(x=>x.id===t.id?{...x,status:"approved",approved_at:now}:x));
      if(t.user_id===user?.id) setMyTailor(m=>m?{...m,status:"approved",approved_at:now}:m);
      await notify(t.user_id,"tailor","🎉 You're approved as a tailor!","Your tailor application has been approved! Your profile is now live on Stitch'd.",t.id);
      db.fireTailorApprovedEmail(t.id);
      flash("Tailor approved.");
      return updated;
    }catch(e){ flash("Failed to approve tailor."); }
  }

  // Admin — reject a tailor application.
  async function rejectTailor(t){
    try{
      await db.updateTailor(t.id,{status:"rejected"},token);
      setAdminTailors(p=>p.map(x=>x.id===t.id?{...x,status:"rejected"}:x));
      if(t.user_id===user?.id) setMyTailor(m=>m?{...m,status:"rejected"}:m);
      await notify(t.user_id,"tailor","Tailor application update","Your tailor application was not approved at this time.",t.id);
      flash("Tailor application rejected.");
    }catch(e){ flash("Failed to reject tailor."); }
  }

  // Admin — retry a failed (or stuck-pending) payout. Re-runs process-tailor-payout
  // for the booking; the function re-verifies everything and either transfers,
  // holds (tailor not onboarded) or reports a fresh failure. Reloads the panel.
  async function retryPayout(po){
    const reqId=po&&(po.alteration_request_id||(po.alteration_requests&&po.alteration_requests.id));
    if(!reqId){ flash("Couldn't find the booking for this payout."); return; }
    try{
      const res=await processTailorPayout(reqId);
      if(res&&res.held) flash("Payout still pending — the tailor hasn't finished their payment setup yet.",6000);
      else if(res&&(res.paid||res.already_paid)) flash("Payout transferred successfully.");
      else flash("Payout retried.");
    }catch(e){ flash("Retry failed: "+errMsg(e)); }
    try{ setAdminPayouts(await db.getAllPayouts(token)); }catch(e){}
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
    const viewing=viewedProfile?.id===targetId;
    try{
      if(isFollowing(targetId)){
        await db.unfollow(user.id,targetId,token);
        setFollowing(p=>p.filter(f=>f.following_id!==targetId));
        // Drop the unfollowed seller from the MY FOLLOWING list immediately.
        setFollowingProfiles(p=>p.filter(s=>s.id!==targetId));
        if(viewing) setFollowerCount(c=>Math.max(0,c-1));
        flash("Unfollowed.");
      } else {
        await db.follow(user.id,targetId,token);
        setFollowing(p=>[...p,{follower_id:user.id,following_id:targetId}]);
        if(viewing) setFollowerCount(c=>c+1);
        flash("✦ Following!");
        // Phase 13 PART 7 — tell the seller they have a new follower. Link to the
        // follower's profile (this user). Best-effort: never block the follow.
        const me=(profile?.full_name&&profile.full_name.trim())||profile?.username||user.email?.split("@")[0]||"Someone";
        notify(targetId,"new_follower","✦ New follower",`${me} started following you`,user.id);
      }
    }catch(e){ flash("Could not update follow."); }
  }

  // Phase 13 — MY FOLLOWING list. Resolve each followed seller's profile and
  // count their active (unsold, not deactivated) listings for the row subtitle.
  async function loadFollowingList(){
    if(!user||!token) return;
    setFollowingLoading(true);
    try{
      const ids=following.map(f=>f.following_id);
      if(!ids.length){ setFollowingProfiles([]); setFollowingLoading(false); return; }
      const rows=await Promise.all(ids.map(async id=>{
        const [p,listings]=await Promise.all([db.getProfile(id,token),db.getListingsByUser(id,token)]);
        const activeCount=(listings||[]).filter(i=>!i.sold&&i.status!=="inactive").length;
        return p?{...p,activeCount}:null;
      }));
      setFollowingProfiles(rows.filter(Boolean));
    }catch(e){ flash("Failed to load your following list."); }
    finally{ setFollowingLoading(false); }
  }

  // Phase 13 — save the seller's storefront (banner upload + text fields) from the
  // dashboard TOOLS tab. Self-healing patch tolerates a not-yet-migrated schema.
  async function saveStorefront(){
    if(!user||storeSaving) return;
    setStoreSaving(true);
    try{
      let banner_url=storeForm.storefront_banner_url||"";
      if(storeForm.bannerFile){
        try{ banner_url=await withFreshToken(tok=>uploadStorefrontBanner(storeForm.bannerFile,tok)); }
        catch(e){ flash("Banner upload failed — saved the rest of your storefront."); }
      }
      const patch={
        storefront_banner_url:banner_url||null,
        storefront_tagline:(storeForm.storefront_tagline||"").slice(0,80)||null,
        storefront_bio:(storeForm.storefront_bio||"").slice(0,300)||null,
        storefront_location:(storeForm.storefront_location||"").trim()||null,
        storefront_instagram:(storeForm.storefront_instagram||"").trim()||null,
      };
      await withFreshToken(tok=>db.updateProfileStorefront(user.id,patch,tok));
      setProfile(p=>p?{...p,...patch}:p);
      setStoreForm(f=>({...f,storefront_banner_url:banner_url,bannerFile:null,bannerPreview:banner_url}));
      flash("✓ Storefront saved!");
    }catch(e){ flash(`Couldn't save storefront: ${errMsg(e)}`); }
    finally{ setStoreSaving(false); }
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

  // ── Phase 14 — STYLE FEED ───────────────────────────────────────────────────
  // Resolve the author profiles, tagged listings, seed like counts and the
  // viewer's likes for a freshly-fetched page of posts. Only fetches the bits not
  // already cached in the shared maps (so LOAD MORE / tab switches stay cheap).
  async function resolveStyleMeta(posts){
    if(!posts.length) return;
    const needProfiles=[...new Set(posts.map(p=>p.user_id).filter(Boolean))].filter(id=>!styleProfiles[id]);
    if(needProfiles.length){
      const profs=await db.getProfilesFullByIds(needProfiles,token);
      setStyleProfiles(prev=>{ const n={...prev}; profs.forEach(p=>{ n[p.id]=p; }); return n; });
    }
    const needListings=[...new Set(posts.flatMap(p=>p.listing_ids||[]))].filter(id=>id&&!styleListings[id]);
    if(needListings.length){
      const ls=await db.getListingsByIds(needListings,token);
      setStyleListings(prev=>{ const n={...prev}; ls.forEach(l=>{ n[l.id]=l; }); return n; });
    }
    setStyleLikeCounts(prev=>{ const n={...prev}; posts.forEach(p=>{ if(n[p.id]==null) n[p.id]=p.likes_count||0; }); return n; });
    if(user&&token){
      const liked=await db.getMyStyleLikes(user.id,posts.map(p=>p.id),token);
      if(liked.length) setStyleLiked(prev=>{ const n=new Set(prev); liked.forEach(id=>n.add(id)); return n; });
    }
  }

  // Fetch one page of a tab. `reset` replaces the array (first load / tab open);
  // otherwise it appends (LOAD MORE). Offset is derived from the current array.
  async function loadStyleFeed(tab,reset){
    setStyleFeedLoading(true);
    try{
      const cur = tab==="following" ? followingPosts : forYouPosts;
      const offset = reset ? 0 : cur.length;
      let page;
      if(tab==="following"){
        const ids=following.map(f=>f.following_id);
        page = ids.length ? await db.getStylePostsByUsers(ids,STYLE_PAGE,offset,token) : [];
      } else {
        page = await db.getStylePosts(STYLE_PAGE,offset,token);
      }
      if(tab==="following"){ setFollowingPosts(prev=>reset?page:[...prev,...page]); setHasMoreFollowing(page.length===STYLE_PAGE); setStyleLoadedFollowing(true); }
      else { setForYouPosts(prev=>reset?page:[...prev,...page]); setHasMoreForYou(page.length===STYLE_PAGE); setStyleLoadedForYou(true); }
      await resolveStyleMeta(page);
    }catch(e){ flash("Failed to load the style feed."); }
    finally{ setStyleFeedLoading(false); }
  }

  // Open the feed (from nav / homepage / deep link). Defaults to FOR YOU and
  // loads it once.
  function openStyleFeed(){
    setView("stylefeed"); setStyleFeedTab("foryou"); window.scrollTo(0,0);
    if(!styleLoadedForYou) loadStyleFeed("foryou",true);
  }
  function switchStyleTab(k){
    setStyleFeedTab(k);
    const loaded = k==="following" ? styleLoadedFollowing : styleLoadedForYou;
    if(!loaded) loadStyleFeed(k,true);
  }
  function loadMoreStyle(){ loadStyleFeed(styleFeedTab,false); }

  // Optimistic like toggle: flip the heart + counter immediately, sync in the
  // background, roll back on failure. Logged-out taps are routed to sign-in.
  async function toggleStyleLike(post){
    if(!user||!token){ flash("Log in to like posts!"); setAuthMode("login"); setView("auth"); return; }
    const id=post.id, has=styleLiked.has(id);
    const base = styleLikeCounts[id]!=null ? styleLikeCounts[id] : (post.likes_count||0);
    setStyleLiked(prev=>{ const n=new Set(prev); has?n.delete(id):n.add(id); return n; });
    setStyleLikeCounts(prev=>({...prev,[id]:Math.max(0,base+(has?-1:1))}));
    try{
      if(has) await db.unlikeStylePost(id,user.id,token);
      else    await db.likeStylePost(id,user.id,token);
      db.setStylePostLikes(id,Math.max(0,base+(has?-1:1)),token);
    }catch(e){
      setStyleLiked(prev=>{ const n=new Set(prev); has?n.add(id):n.delete(id); return n; });
      setStyleLikeCounts(prev=>({...prev,[id]:Math.max(0,base)}));
      flash("Couldn't update like. Try again.");
    }
  }

  // Soft-delete the viewer's own post (deleted=true; never hard-deleted). Removes
  // it from every list it might appear in.
  async function deleteStylePost(post){
    if(!user||post.user_id!==user.id) return;
    if(!window.confirm("Delete this post? This can't be undone.")) return;
    try{
      await db.deleteStylePost(post.id,token);
      setForYouPosts(prev=>prev.filter(p=>p.id!==post.id));
      setFollowingPosts(prev=>prev.filter(p=>p.id!==post.id));
      setHomeStylePosts(prev=>prev.filter(p=>p.id!==post.id));
      flash("Post deleted.");
    }catch(e){ flash("Couldn't delete the post."); }
  }

  // Search ACTIVE listings by title for the create-post tag picker (reuses the
  // Shop-the-Look picker query — case-insensitive, unsold only).
  async function searchActiveListings(q){
    if(!q||!q.trim()) return [];
    try{ return await db.searchListings(q.trim(),token); }catch{ return []; }
  }

  // Copy a post's shareable URL to the clipboard (Share2 action). Mirrors the
  // wishlist share host so the link is stable regardless of the current domain.
  function shareStylePost(post){
    const url=`https://${SHARE_HOST}/post/${post.id}`;
    const done=()=>flash("Link copied!");
    try{
      if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(url).then(done).catch(()=>{ legacyCopy(url); done(); }); }
      else { legacyCopy(url); done(); }
    }catch{ done(); }
  }
  function legacyCopy(text){
    try{ const ta=document.createElement("textarea"); ta.value=text; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }catch{ /* ignore */ }
  }

  // Create a post: upload the photo, insert the row, prepend it to FOR YOU + the
  // homepage rail, then notify each tagged listing's seller. Best-effort
  // notifications never block the post.
  async function createStylePost(file,caption,tags){
    if(!user||!token){ setAuthMode("login"); setView("auth"); return; }
    if(!file||styleCreating) return;
    setStyleCreating(true);
    try{
      const url=await withFreshToken(tok=>uploadStylePostImage(file,tok));
      const listingIds=(tags||[]).map(t=>t.id);
      const created=await db.insertStylePost({user_id:user.id,caption:caption||null,image_url:url,listing_ids:listingIds,likes_count:0,deleted:false},token);
      setForYouPosts(prev=>[created,...prev]);
      setHomeStylePosts(prev=>[created,...prev].slice(0,4));
      setStyleProfiles(prev=> prev[user.id]?prev:{...prev,[user.id]:profile||{id:user.id,username:user.email?.split("@")[0]}});
      setHomeStyleProfiles(prev=> prev[user.id]?prev:{...prev,[user.id]:profile||{id:user.id,username:user.email?.split("@")[0]}});
      if(tags&&tags.length) setStyleListings(prev=>{ const n={...prev}; tags.forEach(l=>{ n[l.id]=l; }); return n; });
      setStyleLikeCounts(prev=>({...prev,[created.id]:0}));
      const me=(profile?.full_name&&profile.full_name.trim())||profile?.username||user.email?.split("@")[0]||"Someone";
      (tags||[]).forEach(l=>{ if(l.user_id&&l.user_id!==user.id) notify(l.user_id,"style_feature","✦ Featured in a style post!",`${me} featured your listing "${l.name}" in their style post`,l.id); });
      setStyleCreateOpen(false);
      flash("Posted to your feed!");
    }catch(e){ console.error("Style post failed:",e); flash(errMsg(e),8000); }
    finally{ setStyleCreating(false); }
  }

  // Homepage STYLE INSPIRATION preview — 4 newest posts + their authors. Non-fatal.
  async function loadHomeStylePosts(){
    try{
      const posts=await db.getRecentStylePosts(4,token);
      setHomeStylePosts(posts);
      const ids=[...new Set(posts.map(p=>p.user_id).filter(Boolean))];
      if(ids.length){ const profs=await db.getProfilesFullByIds(ids,token); const map={}; profs.forEach(p=>{ map[p.id]=p; }); setHomeStyleProfiles(map); }
    }catch(e){ /* non-fatal: the section just hides */ }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{ loadHomeStylePosts(); },[]);

  // Style post share deep link (/post/<id>) — open the feed and make sure the
  // shared post is visible (prepended if it's not on the first FOR YOU page).
  useEffect(()=>{
    const m=window.location.pathname.replace(/\/+$/,"").match(/^\/post\/([^/]+)$/);
    if(!m||!m[1]) return;
    const pid=m[1];
    setView("stylefeed"); setStyleFeedTab("foryou"); setStyleFeedLoading(true);
    (async()=>{
      try{
        const [page,post]=await Promise.all([db.getStylePosts(STYLE_PAGE,0,token),db.getStylePost(pid,token)]);
        const posts=(post&&!page.some(p=>p.id===post.id))?[post,...page]:page;
        setForYouPosts(posts); setStyleLoadedForYou(true); setHasMoreForYou(page.length===STYLE_PAGE);
        await resolveStyleMeta(posts);
      }catch(e){ /* ignore — land on an empty feed */ }
      finally{ setStyleFeedLoading(false); }
    })();
    window.history.replaceState({},"","/");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

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
    const remaining=MAX_LISTING_IMAGES-form.imagePreviews.length;
    const incoming=Array.from(files);
    if(incoming.length>remaining){ flash(`Maximum ${MAX_LISTING_IMAGES} photos per listing`); }
    const arr=incoming.slice(0,Math.max(0,remaining));
    if(!arr.length) return;
    const previews=arr.map(f=>URL.createObjectURL(f));
    setForm(f=>({...f,imageFiles:[...f.imageFiles,...arr],imagePreviews:[...f.imagePreviews,...previews]}));
  }

  function removeImagePreview(idx){
    setForm(f=>({...f,imageFiles:f.imageFiles.filter((_,i)=>i!==idx),imagePreviews:f.imagePreviews.filter((_,i)=>i!==idx)}));
  }

  // Login gate → /auth. Remembers the current page so we can return here once
  // the buyer is signed in. Used by the reusable LoginPromptModal everywhere.
  function gateAuth(mode){ setPostAuthView(view); setAuthMode(mode==="signup"?"signup":"login"); setView("auth"); window.scrollTo(0,0); }
  // Where to land after a successful sign in/up: the gated page the buyer came
  // from (set by gateAuth), else the default shop. Cleared once consumed.
  function postAuthDest(){ const v=postAuthView; setPostAuthView(null); return v||"shop"; }

  async function handleAuth(e){
    e.preventDefault(); setALoading(true); setAError("");
    try{
      if(authMode==="signup"){
        await auth.sendOTP(aForm.email);
        setOtpEmail(aForm.email); setOtpStep("otp");
        flash("📧 Check your email for your 6-digit code!");
      } else {
        const s=await auth.signIn(aForm.email,aForm.password);
        auth.saveSession(s); setSession(s); flash("🩷 Welcome back!"); setView(postAuthDest());
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
      flash("🩷 Welcome to Stitch'd!"); setView(postAuthDest());
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
    // Phase 13 — live follower count for the storefront.
    db.getFollowers(userId,token).then(f=>setFollowerCount(f.length)).catch(()=>setFollowerCount(0));
  }

  // Phase 14 — the optional minimum-offer floor, in pence, from the form. Only
  // meaningful when offers are enabled; a blank/invalid value stores null.
  function offerFloorPence(f){
    if(f.offers_enabled===false) return null;
    const v=parseFloat(f.minimum_offer);
    return Number.isFinite(v)&&v>0?Math.round(v*100):null;
  }

  async function add(){
    if(!form.name||!form.price)return;
    if(!user){setView("auth");return;}
    if(!form.imagePreviews.length){ flash("Add at least one photo to publish your listing."); return; }
    // Phase 11 — items over £200 require ID verification (also gated in the UI).
    if(parseFloat(form.price)>200&&!(profile?.identity_verified)){
      flash("Items over £200 require identity verification. Verify your identity in the dashboard TOOLS tab first.",8000);
      return;
    }
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
      const payload={name:form.name,price:parseFloat(form.price),condition:form.condition,listing_type:form.listing_type,category:cat,origin:form.origin,fabric:form.listing_type==="Clothing"?form.fabric:"",material:form.listing_type==="Jewellery"?form.material:"",size:form.listing_type==="Clothing"?form.size:"",occasions:form.occasions,colours:form.colours||[],...meas,can_take_in:form.listing_type==="Clothing"?form.can_take_in:false,spare_fabric:form.listing_type==="Clothing"?form.spare_fabric:false,description:form.description,emoji:catEmoji(cat),sold:false,reserved:false,views:0,image_url,images:urls,user_id:user.id,currency:profile?.currency||"USD",postage_options:form.postage_options||[],accepts_collection:form.accepts_collection||false,offers_enabled:form.offers_enabled!==false,minimum_offer_pence:offerFloorPence(form)};
      const [created]=await withFreshToken(tok=>db.insert(payload,tok));
      setItems(p=>[created,...p]); setForm(EMPTY_FORM);
      // The photo uploaded fine but didn't come back on the saved row — the
      // self-healing insert (see lib/db.js) silently drops columns the table is
      // missing, so an absent image_url column means the photo is lost. Surface
      // it instead of a misleading plain "Listed!".
      if(urls.length&&!created.image_url){ flash("⚠️ Listed — but the photo couldn't be saved: your 'listings' table has no image_url column. Add image_url (text) and images (text[]) columns in Supabase so photos persist.",11000); }
      else{ flash("🩷 Listed!"); }
      setView("shop");
      // Phase 12 PART 5 — kick the saved-search alert sweep so buyers whose saved
      // filters match this fresh listing are emailed within minutes rather than
      // waiting up to 6 hours for the cron run. Fire-and-forget; never blocks.
      if(created?.id) db.triggerSavedSearchAlerts(created.id);
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
    if(!form.name||!form.price)return;
    if(!form.imagePreviews.length){ flash("Add at least one photo to publish your listing."); return; }
    // Phase 11 — items over £200 require ID verification (also gated in the UI).
    if(parseFloat(form.price)>200&&!(profile?.identity_verified)){
      flash("Items over £200 require identity verification. Verify your identity in the dashboard TOOLS tab first.",8000);
      return;
    }
    setSaving(true);
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
      const patch={name:form.name,price:parseFloat(form.price),condition:form.condition,listing_type:form.listing_type,category:cat,origin:form.origin,fabric:form.listing_type==="Clothing"?form.fabric:"",material:form.listing_type==="Jewellery"?form.material:"",size:form.listing_type==="Clothing"?form.size:"",occasions:form.occasions,colours:form.colours||[],...meas,can_take_in:form.listing_type==="Clothing"?form.can_take_in:false,spare_fabric:form.listing_type==="Clothing"?form.spare_fabric:false,description:form.description,emoji:catEmoji(cat),image_url,images:allUrls,postage_options:form.postage_options||[],accepts_collection:form.accepts_collection||false,offers_enabled:form.offers_enabled!==false,minimum_offer_pence:offerFloorPence(form)};
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
    setForm({name:item.name||"",price:item.price||"",condition:item.condition||"Like New",listing_type:item.listing_type||"Clothing",category:item.category||"Saree",origin:item.origin||"Indian",fabric:item.fabric||"Silk",material:item.material||"",size:item.size||"Free Size",occasions:item.occasions||[],colours:item.colours||[],gender,meas_unit,garment_type,meas,additional_measurements:item.additional_measurements||item.measurement_notes||"",bust:item.bust||"",waist:item.waist||"",hips:item.hips||"",length:item.length||"",underbust:item.underbust||"",shoulder:item.shoulder||"",high_hip:item.high_hip||"",sleeve_length:item.sleeve_length||"",inseam:item.inseam||"",measurement_notes:item.measurement_notes||"",can_take_in:item.can_take_in||false,spare_fabric:item.spare_fabric||false,description:item.description||"",imageFiles:[],imagePreviews:item.images||[item.image_url].filter(Boolean),postage_options:item.postage_options||[],accepts_collection:item.accepts_collection||false,offers_enabled:item.offers_enabled!==false,minimum_offer:item.minimum_offer_pence?String(item.minimum_offer_pence/100):""});
    setView("edit");
  }

  async function markSold(id,cur){ try{ await db.update(id,{sold:!cur},token); setItems(p=>p.map(i=>i.id===id?{...i,sold:!i.sold}:i)); if(sel?.id===id)setSel(s=>({...s,sold:!s.sold})); }catch(e){flash("Update failed.");} }
  async function markReserved(id,cur){ try{ await db.update(id,{reserved:!cur},token); setItems(p=>p.map(i=>i.id===id?{...i,reserved:!i.reserved}:i)); if(sel?.id===id)setSel(s=>({...s,reserved:!s.reserved})); flash(cur?"Reservation removed.":"🔖 Marked as reserved!"); }catch(e){flash("Update failed.");} }
  async function relist(id){ try{ await db.update(id,{sold:false,reserved:false},token); setItems(p=>p.map(i=>i.id===id?{...i,sold:false,reserved:false}:i)); if(sel?.id===id)setSel(s=>({...s,sold:false,reserved:false})); flash("🔄 Relisted!"); }catch(e){flash("Relist failed.");} }
  async function del(id){ try{ await db.remove(id,token); setItems(p=>p.filter(i=>i.id!==id)); setView("shop"); flash("Listing deleted."); }catch(e){flash("Delete failed.");} }

  // ── Phase 10d — seller tools ────────────────────────────────────────────────
  // Bulk edit: patch every selected listing at once, then mirror the change into
  // local state so the dashboard updates without a refetch. Returns true on success
  // so the dashboard can clear its selection / close the price modal.
  async function bulkUpdateListings(ids,patch){
    if(!ids.length) return false;
    try{
      await db.bulkUpdate(ids,patch,token);
      setItems(p=>p.map(i=>ids.includes(i.id)?{...i,...patch}:i));
      return true;
    }catch(e){ flash("Bulk update failed."); return false; }
  }

  // Relist: create a brand-new active listing copying the sold item's fields. The
  // original sold listing is left untouched. Strips identity/sale columns so the
  // copy is a fresh active piece (sold_at/stripe_session_id null, views reset).
  async function relistCopy(item){
    try{
      const {id,created_at,updated_at,sold_at,stripe_session_id,prev_price,views,reserved,payment_status,paid_at,...rest}=item;
      const copy={...rest,sold:false,reserved:false,status:"active",sold_at:null,stripe_session_id:null,views:0};
      const created=await db.insert(copy,token);
      const row=Array.isArray(created)?created[0]:created;
      if(row) setItems(p=>[row,...p]);
      flash("Listing relisted successfully");
      return true;
    }catch(e){ flash("Relist failed."); return false; }
  }

  // Vacation mode: flip the seller's profile flag, then keep the vacation-sellers
  // set in sync so the shop/search filter (in `visible`) reacts immediately.
  async function toggleVacation(on){
    if(!user) return;
    setVacationSaving(true);
    try{
      await db.setVacationMode(user.id,on,token);
      setProfile(p=>p?{...p,vacation_mode:on}:p);
      setVacationSellers(prev=>{ const s=new Set(prev); if(on)s.add(user.id); else s.delete(user.id); return s; });
      // Phase 15 — if this seller is also a tailor, mirror vacation onto their
      // tailor row so the public availability calendar shows every date as
      // unavailable while away. The per-day availability rows are left untouched,
      // so turning vacation off restores the tailor's saved availability exactly.
      if(myTailor&&myTailor.id){
        try{ await db.updateTailor(myTailor.id,{vacation_mode:on},token); setMyTailor(m=>m?{...m,vacation_mode:on}:m); }catch(e){ /* non-fatal */ }
      }
      flash(on?"You're on vacation — your listings are now hidden.":"Welcome back! Your listings are visible again.");
    }catch(e){ flash("Couldn't update vacation mode."); }
    finally{ setVacationSaving(false); }
  }

  // Phase 14 — save the seller's bundle-discount settings (TOOLS tab). Persists to
  // the profile, updates the in-memory profile + the bundleSellers map (so the
  // banners/bag reflect the change immediately) and shows the success message.
  async function saveBundleDiscount(enabled,percentage){
    if(!user) return;
    const pct=[5,10,15,20].includes(percentage)?percentage:10;
    await db.setBundleDiscount(user.id,{bundle_discount_enabled:!!enabled,bundle_discount_percentage:pct},token);
    setProfile(p=>p?{...p,bundle_discount_enabled:!!enabled,bundle_discount_percentage:pct}:p);
    setBundleSellers(prev=>{ const m=new Map(prev); if(enabled)m.set(user.id,pct); else m.delete(user.id); return m; });
    flash("Bundle discount saved");
  }

  // Promote (coming soon): record the seller's interest so we can notify them at launch.
  async function notifyPromote(){
    if(!user){ setAuthMode("login"); setView("auth"); return; }
    try{
      await db.insertFeatureInterest({user_id:user.id,feature:"promote"},token);
      setPromoteNotified(true);
      flash("🔔 We'll let you know when Promote launches!");
    }catch(e){ flash("Couldn't save your interest — try again."); }
  }

  // ── Phase 13 — promoted listings ──────────────────────────────────────────
  // Load the signed-in seller's promotions for the dashboard ANALYTICS history.
  async function loadMyPromotions(){
    if(!user||!token) return;
    try{ setMyPromotions(await db.getMyPromotions(user.id,token)); }catch(e){ /* table may not exist yet */ }
  }

  // Pay £2.99 to promote a listing for 7 days. Calls the create-promotion-session
  // Edge Function (lib/promotion) which redirects to Stripe's hosted checkout. The
  // listing's promoted flag + expiry are set later by the stripe-webhook; on
  // return the ?promoted=true success handler reflects it locally.
  async function startPromote(listing){
    if(!user){ setAuthMode("login"); setView("auth"); return; }
    if(!listing?.id||promoteBusyId) return;
    setPromoteBusyId(listing.id);
    try{
      await startPromotion(listing.id,user.id); // redirects on success
    }catch(e){
      flash(errMsg(e),9000);
      setPromoteBusyId(null);
    }
  }

  // Phase 11 — seller submits a verification application. Inserts the application,
  // flips the profile to 'pending', and mirrors both into local state so the
  // dashboard GET VERIFIED section switches to APPLICATION UNDER REVIEW. Returns
  // true on success so the dashboard can close its modal.
  async function submitVerification(formData){
    if(!user){ setAuthMode("login"); setView("auth"); return false; }
    if(!formData.full_name.trim()||!formData.reason.trim()){ flash("Please fill in your name and reason."); return false; }
    setVerificationBusy(true);
    try{
      const app=await db.insertVerificationApplication({
        user_id:user.id,
        full_name:formData.full_name.trim(),
        reason:formData.reason.trim(),
        selling_experience:formData.selling_experience||null,
        instagram_handle:formData.instagram_handle?.trim()||null,
        status:"pending",
      },token);
      await db.updateProfileVerification(user.id,{verification_status:"pending"},token);
      setMyVerificationApp(app||{...formData,status:"pending",created_at:new Date().toISOString()});
      setProfile(p=>p?{...p,verification_status:"pending"}:p);
      flash("Application submitted! We'll review it within 3 working days.");
      return true;
    }catch(e){ flash(`Couldn't submit application: ${errMsg(e)}`,9000); return false; }
    finally{ setVerificationBusy(false); }
  }

  // Phase 11 — start (or retry) Stripe Identity verification. Calls the
  // create-verification-session Edge Function and redirects the seller to the
  // Stripe-hosted flow. The function also flips the profile to 'pending'; we
  // mirror that locally so the dashboard reflects it if the redirect is slow.
  // The pass/fail result lands later on the stripe-webhook function.
  async function verifyIdentity(){
    if(!user){ setAuthMode("login"); setView("auth"); return; }
    setIdentityBusy(true);
    try{
      setProfile(p=>p?{...p,identity_verification_status:"pending"}:p);
      await startIdentityVerification(user.id); // redirects on success
    }catch(e){
      setProfile(p=>p?{...p,identity_verification_status:profile?.identity_verification_status||"unverified"}:p);
      flash(errMsg(e),9000);
      setIdentityBusy(false);
    }
  }
  // Deep-link helper used by the listing form's over-£200 prompt: jump to the
  // dashboard TOOLS tab where the IDENTITY VERIFICATION section lives.
  const goVerifyIdentity=()=>{ setDashTabRequest("tools"); setView("dashboard"); window.scrollTo(0,0); };

  // ── Phase 10e — Shop the Look ─────────────────────────────────────────────
  // Open a look's detail view. The look already carries its items + listings
  // embedded; we additionally resolve the curator's profile (unless it's an
  // admin look, which always reads "Curated by Stitch'd").
  async function openLook(look){
    setSelLook(look); setSelLookCreator(null); setView("lookdetail");
    if(look.created_by_type!=="admin"&&look.created_by){
      try{ const p=await db.getProfile(look.created_by,token); setSelLookCreator(p); }catch(e){}
    }
  }

  // ADD ALL TO BAG — add every non-sold piece of a look to the bag at once,
  // skipping any already there (each piece is one-of-a-kind). Mirrors toggleBag's
  // snapshot shape so the bag panel renders without a refetch.
  function addLookToBag(look){
    if(!user){ flash("Sign in to add to your bag!"); setAuthMode("login"); setView("auth"); return; }
    const available=lookListings(look).filter(l=>!l.sold);
    if(!available.length){ flash("Everything in this look is sold."); return; }
    let addedCount=0;
    setBag(prev=>{
      const have=new Set(prev.map(b=>b.id));
      const additions=available.filter(l=>!have.has(l.id)).map(l=>({
        id:l.id,name:l.name,price:l.price,currency:l.currency,
        image:l.image_url||(l.images&&l.images[0])||"",emoji:l.emoji||catEmoji(l.category),
        seller:l.seller_username||l.seller_name||l.username||"",sellerId:l.user_id||l.seller_id||null,sold:!!l.sold,
      }));
      addedCount=additions.length;
      const next=[...prev,...additions];
      localStorage.setItem("stitchd_bag",JSON.stringify(next));
      return next;
    });
    setShowBag(true);
    flash(addedCount?`🛍️ Added ${addedCount} piece${addedCount!==1?"s":""} to bag!`:"Those pieces are already in your bag.");
  }

  // Create-a-look listing picker — searches listings by title across ALL sellers.
  async function searchLookListings(q){
    if(!q||q.trim().length<2){ setLookSearchResults([]); return; }
    try{ setLookSearchResults(await db.searchListings(q.trim(),token)); }catch(e){ setLookSearchResults([]); }
  }
  function addListingToLook(item){ setLookForm(f=>(f.items.some(i=>i.id===item.id)||f.items.length>=8)?f:{...f,items:[...f.items,item]}); }
  function removeListingFromLook(id){ setLookForm(f=>({...f,items:f.items.filter(i=>i.id!==id)})); }

  function openCreateLook(){
    setEditingLook(null);
    setLookForm({title:"",description:"",coverFile:null,coverPreview:"",cover_image_url:"",items:[]});
    setLookStep(1); setLookSearch(""); setLookSearchResults([]);
    setView("createlook");
  }
  function editLook(look){
    setEditingLook(look);
    setLookForm({title:look.title||"",description:look.description||"",coverFile:null,coverPreview:"",cover_image_url:look.cover_image_url||"",items:lookListings(look)});
    setLookStep(1); setLookSearch(""); setLookSearchResults([]);
    setView("createlook");
  }
  async function deleteLook(id){
    try{ await db.deleteLook(id,token); setMyLooks(p=>p.filter(l=>l.id!==id)); setLooks(p=>p.filter(l=>l.id!==id)); flash("Look deleted."); }
    catch(e){ flash("Failed to delete look."); }
  }

  // Publish (active=true) or save-as-draft (active=false). Uploads the cover to
  // the looks/ bucket, upserts the look row, then replaces its items wholesale so
  // edits stay in sync. created_by_type is 'admin' for the Stitch'd admin account.
  async function publishLook(active){
    if(!user){ setAuthMode("login"); setView("auth"); return; }
    if(!lookForm.title.trim()){ flash("Add a title."); setLookStep(1); return; }
    if(!lookForm.coverPreview&&!lookForm.cover_image_url){ flash("Add a cover image."); setLookStep(1); return; }
    if(lookForm.items.length<2){ flash("Add at least 2 pieces."); setLookStep(2); return; }
    setLookSaving(true);
    try{
      let cover=lookForm.cover_image_url||"";
      if(lookForm.coverFile) cover=await withFreshToken(tok=>uploadLookImage(lookForm.coverFile,tok));
      const payload={title:lookForm.title.trim(),description:lookForm.description||null,cover_image_url:cover,active,created_by:user.id,created_by_type:isAdmin?"admin":"seller"};
      let lookId;
      if(editingLook){
        await withFreshToken(tok=>db.updateLook(editingLook.id,payload,tok));
        lookId=editingLook.id;
        await withFreshToken(tok=>db.clearLookItems(lookId,tok));
      }else{
        const created=await withFreshToken(tok=>db.createLook(payload,tok));
        lookId=created.id;
      }
      await Promise.all(lookForm.items.map((l,i)=>withFreshToken(tok=>db.addLookItem({look_id:lookId,listing_id:l.id,position:i},tok))));
      flash(active?"🩷 Look published!":"Saved as draft.");
      await loadLooks(); await loadMyLooks();
      setView("dashboard");
    }catch(e){ console.error("Look save failed:",e); flash(`Couldn't save look: ${errMsg(e)}`,9000); }
    finally{ setLookSaving(false); }
  }

  function openDetail(item){
    setSel(item); setSelImgIdx(0); setView("detail");
    db.incrementViews(item.id,item.views,token);
    setItems(p=>p.map(i=>i.id===item.id?{...i,views:(i.views||0)+1}:i));
    setRecentlyViewed(prev=>{
      const next=[item.id,...prev.filter(x=>x!==item.id)].slice(0,10);
      localStorage.setItem("stitchd_recent",JSON.stringify(next));
      return next;
    });
    if(item.user_id) loadReviews(item.user_id).then(setReviews);
    setComments([]); setCommentText("");
    loadComments(item.id).then(setComments);
    // Phase 14 — does the buyer already have a pending offer on this listing? If
    // so the Detail page shows OFFER PENDING instead of MAKE AN OFFER.
    setMyOffer(null);
    if(user&&item.user_id!==user.id) db.getMyOffer(item.id,user.id,token).then(setMyOffer);
  }

  const selIdx   = sel?items.findIndex(i=>i.id===sel.id):0;
  const selColor = CARD_COLORS[Math.max(0,selIdx)%CARD_COLORS.length];
  const isOwner  = (item)=>user&&item.user_id===user.id;
  const myItems  = items.filter(i=>i.user_id===user?.id);
  // Phase 10e — the Stitch'd admin: profiles.is_admin, or an email match to the
  // configured ADMIN_EMAIL. Admin-created looks show "Curated by Stitch'd".
  const isAdmin  = !!(profile?.is_admin) || (!!ADMIN_EMAIL && user?.email===ADMIN_EMAIL);
  // Phase 11 — load the admin panel's reports + disputes whenever an admin opens
  // the dashboard. Declared after `isAdmin` so it isn't read in the TDZ.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{ if(view==="dashboard"&&isAdmin) loadAdminData(); },[view,isAdmin]);
  const selImages= sel?(sel.images&&sel.images.length>0?sel.images:[sel.image_url].filter(Boolean)):[];
  // Issue #167 — "YOU MIGHT ALSO LIKE" is a discovery rail, so exclude SOLD
  // (and inactive) pieces the same way the shop grid does. Recently Viewed below
  // deliberately keeps sold items (with a SOLD overlay) and is not filtered here.
  const similarItems = sel ? items.filter(i=>i.id!==sel.id&&!i.sold&&i.status!=="sold"&&i.status!=="inactive"&&(i.category===sel.category||i.fabric===sel.fabric||i.origin===sel.origin)).slice(0,4) : [];
  // Phase 12 — recently viewed, in view order (newest first), excluding the
  // current listing, capped at 6 for the Detail "RECENTLY VIEWED" rail.
  const recentItems  = recentlyViewed
    .filter(id=>!sel||id!==sel.id)
    .map(id=>items.find(i=>i.id===id))
    .filter(Boolean)
    .slice(0,6);
  // Phase 12 — listings created in the last 14 days (newest first), for the
  // /new-arrivals page and the homepage NEW ARRIVALS rail. `visible` already
  // applies every active shop filter and is ordered created_at.desc, so the
  // /new-arrivals grid honours the filters for free.
  const NEW_ARRIVAL_MS = 14*24*60*60*1000;
  const isNewArrivals  = view==="newarrivals";
  const newArrivalItems = useMemo(()=>{
    const cutoff=Date.now()-NEW_ARRIVAL_MS;
    return visible.filter(i=>i.created_at&&new Date(i.created_at).getTime()>=cutoff);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[visible]);
  // The homepage rail wants the 4 most recent *available* arrivals, independent
  // of the shop filters (it only renders when no filter is active anyway).
  const homeArrivals = useMemo(()=>{
    const cutoff=Date.now()-NEW_ARRIVAL_MS;
    return items.filter(i=>!i.sold&&i.status!=="inactive"&&!vacationSellers.has(i.user_id)&&i.created_at&&new Date(i.created_at).getTime()>=cutoff).slice(0,4);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[items,vacationSellers]);
  // Phase 14 — resolve the wishlisted listing_ids (most-recent-first) to full
  // listing objects, then split into still-available vs SOLD for the two page
  // sections. Ids with no matching listing (deleted) are dropped.
  const wishlistById = useMemo(()=> new Map(items.map(i=>[i.id,i])), [items]);
  const wishlistItems = useMemo(()=> wishlistOrder.map(id=>wishlistById.get(id)).filter(Boolean), [wishlistOrder,wishlistById]);
  const liveWishlist = wishlistItems.filter(i=>!i.sold);
  const soldWishlist = wishlistItems.filter(i=>i.sold);
  // Phase 14 — the pieces shown in the create/edit shareable-list selector. In
  // create mode that's every wishlisted piece; in edit mode we also fold in any
  // pieces already in the list that the user has since un-wishlisted, so editing
  // never silently drops them.
  const shareSelectItems = useMemo(()=>{
    if(shareMode==="edit"&&editingShared){
      const map=new Map(wishlistItems.map(i=>[i.id,i]));
      (editingShared.shared_wishlist_items||[]).forEach(r=>{ if(r.listings&&!map.has(r.listings.id)) map.set(r.listings.id,r.listings); });
      return Array.from(map.values());
    }
    return wishlistItems;
  },[shareMode,editingShared,wishlistItems]);

  // Items collapsed behind the desktop hover-dropdown / mobile hamburger menu.
  // Favourites, Notifications and LIST IT deliberately stay out of this list —
  // they remain always-visible in the navbar. Each onClick also closes whichever
  // menu was open so navigating dismisses the overlay.
  // Phase 15 — the tailor nav entry depends on the user's application status.
  // 30-day reapply window for a rejected application is measured from created_at
  // (the schema carries no separate rejection timestamp).
  const tailorIcon=<Scissors width={15} height={15} style={{verticalAlign:"-2px",marginRight:8}}/>;
  const tailorReapplyOk=(()=>{ if(!myTailor||myTailor.status!=="rejected") return false; const t=new Date(myTailor.created_at).getTime(); return isNaN(t)?true:(Date.now()-t)>=30*24*60*60*1000; })();
  const tailorNavItems=(()=>{
    const st=myTailor&&myTailor.status;
    if(!myTailor) return [{label:"BECOME A TAILOR", icon:tailorIcon, run:openTailorApply}];
    if(st==="approved"||st==="suspended") return [{label:"MY TAILOR PROFILE", icon:tailorIcon, run:openTailorDashboard}];
    if(st==="pending") return [{label:"TAILOR APPLICATION PENDING", icon:<Clock width={15} height={15} style={{verticalAlign:"-2px",marginRight:8}}/>, run:()=>flash("Your tailor application is under review — we'll be in touch within 3 working days.",6000)}];
    if(st==="rejected") return [{label:"TAILOR APPLICATION UNSUCCESSFUL", icon:tailorIcon, run:()=>{ if(tailorReapplyOk) openTailorApply(); else flash("Your tailor application wasn't approved. You can reapply 30 days after applying.",6000); }}];
    return [{label:"BECOME A TAILOR", icon:tailorIcon, run:openTailorApply}];
  })();

  const navMenuItems = [
    {label:"✦ NEW ARRIVALS", run:()=>{clearFilters();setView("newarrivals");}},
    {label:"MY DROPS",       run:()=>{loadBundles();loadOrders();loadMyLooks();loadMyPromotions();setView("dashboard");}},
    {label:"MY ORDERS",      run:()=>{loadOrders();setView("orders");}},
    {label:"MY OFFERS",      icon:<Tag width={15} height={15} style={{verticalAlign:"-2px",marginRight:8}}/>, run:()=>{loadBuyerOffers();setView("offers");}},
    {label:"MY WISHLIST",    icon:<Heart width={15} height={15} style={{verticalAlign:"-2px",marginRight:8}}/>, run:()=>{loadMyWishlist();setView("wishlist");}},
    {label:"ALTERATION REQUESTS", icon:<Scissors width={15} height={15} style={{verticalAlign:"-2px",marginRight:8}}/>, run:openAlterations},
    {label:"SAVED SEARCHES",  run:()=>{loadSavedSearches();setView("saved-searches");}},
    {label:"✦ FEED",         run:()=>{loadFeed();setView("feed");}},
    {label:"STYLE FEED",     icon:<Sparkles width={15} height={15} style={{verticalAlign:"-2px",marginRight:8}}/>, run:openStyleFeed},
    {label:"MY FOLLOWING",   run:()=>{loadFollowingList();setView("following-list");}},
    {label:"MESSAGES",       run:openMessages},
    {label:"MY PROFILE",     run:()=>{load2FAFactors();setView("editprofile");}},
    // Phase 15 — tailor profile entry, varying by application status.
    ...tailorNavItems,
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
          <div className="nav-logo" style={S.logoWrap} onClick={()=>setView("shop")}><span style={S.logoText}>STITCH'D</span></div>
          <div className="nav-category-strip" style={S.hMid}><div style={S.marqueeTrack}><span style={S.marqueeInner}>{Array(4).fill("SOUTH ASIAN PRE-LOVED FASHION \u00a0✦\u00a0 SAREES \u00a0✦\u00a0 LEHENGAS \u00a0✦\u00a0 SHERWANIS \u00a0✦\u00a0 REAL MEASUREMENTS \u00a0✦\u00a0 ").join("")}</span></div></div>
          <div className="nav-right" style={S.hRight}>
            <span style={S.hLive}>{items.filter(i=>!i.sold).length} LIVE</span>
            <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111",position:"relative"}} onClick={()=>{ if(user) loadMyWishlist(); setView("wishlist"); }} aria-label="My wishlist">
              <Heart width={18} height={18} style={{verticalAlign:"middle"}}/> {myWishlist.size>0&&<span style={S.wishBadge}>{myWishlist.size}</span>}
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
                        <button key={it.label} className={`nav-drop-item${it.danger?" nav-drop-item-danger":""}`} style={{...S.navDropItem,borderBottom:i===navMenuItems.length-1?"none":"1px solid #111",...(it.danger?S.navDropItemDanger:{})}} onClick={()=>runNavItem(it)}>{it.icon}{it.label}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* MOBILE: hamburger opens the full-width slide-in menu */}
                <button className="nav-hamburger hbtn" style={S.navIconBtn} aria-label="Open menu" onClick={()=>setMobileNavOpen(true)}><Menu width={20} height={20} style={{verticalAlign:"middle"}}/></button>
              </>
            ):(
              <>
                <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111"}} onClick={()=>{setPostAuthView(null);setAuthMode("login");setView("auth");}}>LOG IN</button>
                <button className="hbtn" style={S.hBtn} onClick={()=>{setPostAuthView(null);setAuthMode("signup");setView("auth");}}>SIGN UP</button>
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
            <button key={it.label} className="nav-mob-item" style={{...S.mobileNavItem,...(it.danger?S.navDropItemDanger:{})}} onClick={()=>runNavItem(it)}>{it.icon}{it.label}</button>
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
                  onClick={()=>{ markNotifRead(n.id); if(n.type==="new_offer"){ setDashTabRequest("offers"); setView("dashboard"); window.scrollTo(0,0); } else if(n.type==="alteration_quote"||n.type==="alteration_declined"){ openAlterations(); } else if(n.type==="alteration_request"){ if(myTailor){ openTailorDashboard(); setTailorDashTab("bookings"); window.scrollTo(0,0); } } else if(n.link_id){ if(n.type==="message"){ openMessages(); } else if(n.type==="new_follower"){ openProfile(n.link_id); } else { const item=items.find(i=>i.id===n.link_id); if(item)openDetail(item); } } setShowNotifs(false); }}>
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
                {/* Phase 14 — bundle deal banner(s): one per seller offering a
                    discount on 2+ of their items in the bag. */}
                {bagBundles.map(bd=>(
                  <div key={bd.sellerId} style={{display:"flex",alignItems:"center",gap:9,background:"#00E5CC",color:"#111",border:"2px solid #111",borderRadius:0,padding:"10px 12px",marginTop:14,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:13,letterSpacing:0.3,lineHeight:1.2}}>
                    <Tag width={16} height={16} style={{flexShrink:0}}/> BUNDLE DEAL — {bd.pct}% off {bd.name}'s items!
                  </div>
                ))}
                <div style={S.bagDivider}/>
                {bagBundles.length>0?(
                  <>
                    {/* Original subtotal (struck through) → per-seller discount lines
                        (teal) → discounted total (bold). */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:700,letterSpacing:1,color:"#999"}}>
                      <span>SUBTOTAL</span>
                      <span style={{textDecoration:"line-through"}}>{currencySymbol()}{bagTotal.toFixed(2)}</span>
                    </div>
                    {bagBundles.map(bd=>(
                      <div key={bd.sellerId} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:800,letterSpacing:0.5,color:"#00B5A0"}}>
                        <span>Bundle discount ({bd.pct}%)</span>
                        <span>−{currencySymbol()}{bd.discount.toFixed(2)}</span>
                      </div>
                    ))}
                    <div style={S.bagTotalRow}>
                      <span style={S.bagTotalLabel}>TOTAL</span>
                      <span style={S.bagTotalVal}>{currencySymbol()}{(bagTotal-bundleDiscountTotal).toFixed(2)}</span>
                    </div>
                  </>
                ):(
                  <div style={S.bagTotalRow}>
                    <span style={S.bagTotalLabel}>TOTAL</span>
                    <span style={S.bagTotalVal}>{currencySymbol(bag[0]?.currency)}{bagTotal.toFixed(2)}</span>
                  </div>
                )}
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

      {/* REPORT MODAL (issue PART 1) — white box, 2px #111 border, no radius,
          Barlow Condensed, #FF1493 selected radios. */}
      {showReport&&(()=>{
        const closeReport=()=>{ setShowReport(false); setReportDone(false); setReportReason(""); setReportDetails(""); };
        const REASONS=["Item is not as described","Suspected counterfeit or fake","Inappropriate or offensive content","Seller is being abusive or harassing","Other"];
        return (
        <div style={S.modalOverlay} onClick={closeReport}>
          <div style={{background:"#fff",border:"2px solid #111",borderRadius:0,padding:28,maxWidth:480,width:"100%",maxHeight:"85vh",overflowY:"auto",fontFamily:"'Barlow Condensed',sans-serif"}} onClick={e=>e.stopPropagation()}>
            {reportDone?(
              <div style={{textAlign:"center",padding:"24px 8px"}}>
                <div style={{display:"flex",justifyContent:"center",marginBottom:14}}><Check width={44} height={44} color="#FF1493"/></div>
                <p style={{fontSize:18,fontWeight:800,color:"#111",lineHeight:1.4}}>Thank you for your report. Our team will review it within 24 hours.</p>
              </div>
            ):(
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <h3 style={{fontSize:26,fontWeight:900,letterSpacing:0.5,display:"inline-flex",alignItems:"center",gap:10}}><Flag width={22} height={22}/> REPORT THIS LISTING</h3>
                <button aria-label="Close" style={{background:"none",border:"none",cursor:"pointer",padding:2}} onClick={closeReport}><X width={20} height={20}/></button>
              </div>
              <p style={{fontSize:15,color:"#888",marginBottom:20}}>Help us keep Stitch'd safe and trustworthy</p>
              <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:16}}>
                {REASONS.map(r=>{
                  const on=reportReason===r;
                  return (
                    <button key={r} type="button" onClick={()=>setReportReason(r)} style={{display:"flex",alignItems:"center",gap:12,background:"#fff",border:"none",borderBottom:"1px solid #f0f0f0",padding:"12px 4px",cursor:"pointer",textAlign:"left",fontFamily:"'Barlow Condensed',sans-serif"}}>
                      <span style={{width:20,height:20,flexShrink:0,borderRadius:"50%",border:`2px solid ${on?"#FF1493":"#bbb"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {on&&<span style={{width:10,height:10,borderRadius:"50%",background:"#FF1493"}}/>}
                      </span>
                      <span style={{fontSize:16,fontWeight:on?800:600,color:"#111"}}>{r}</span>
                    </button>
                  );
                })}
              </div>
              {reportReason==="Other"&&(
                <textarea value={reportDetails} onChange={e=>setReportDetails(e.target.value)} placeholder="Please tell us more..." style={{...S.inp,height:90,resize:"vertical",marginBottom:16,fontFamily:"'Barlow Condensed',sans-serif"}}/>
              )}
              <button type="button" onClick={submitReport} disabled={!reportReason} style={{width:"100%",background:"#FF1493",color:"#fff",border:"2px solid #111",borderRadius:0,padding:"14px",fontSize:15,fontWeight:800,letterSpacing:2,fontFamily:"'Barlow Condensed',sans-serif",cursor:reportReason?"pointer":"not-allowed",opacity:reportReason?1:0.4,textTransform:"uppercase"}}>Submit report</button>
              <button type="button" onClick={closeReport} style={{display:"block",margin:"14px auto 0",background:"none",border:"none",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:2,color:"#888",textTransform:"uppercase",textDecoration:"underline"}}>Cancel</button>
            </>
            )}
          </div>
        </div>
        );
      })()}

      {/* REPORT A PROBLEM MODAL (issue PART 2) — buyer dispute on an order. */}
      {disputeOrder&&(()=>{
        const PROBLEMS=["Item not received","Item is significantly not as described","Item is damaged","Wrong item received","Other"];
        const canSubmit=!!disputeForm.problem_type&&!!disputeForm.details.trim()&&!disputeBusy;
        return (
        <div style={S.modalOverlay} onClick={()=>!disputeBusy&&closeDispute()}>
          <div style={{background:"#fff",border:"2px solid #111",borderRadius:0,padding:28,maxWidth:480,width:"100%",maxHeight:"88vh",overflowY:"auto",fontFamily:"'Barlow Condensed',sans-serif"}} onClick={e=>e.stopPropagation()}>
            {disputeDone?(
              <div style={{textAlign:"center",padding:"24px 8px"}}>
                <div style={{display:"flex",justifyContent:"center",marginBottom:14}}><Check width={44} height={44} color="#FF1493"/></div>
                <p style={{fontSize:18,fontWeight:800,color:"#111",lineHeight:1.4}}>Your dispute has been submitted. We'll review it and get back to you within 48 hours.</p>
              </div>
            ):(
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <h3 style={{fontSize:26,fontWeight:900,letterSpacing:0.5,display:"inline-flex",alignItems:"center",gap:10}}><AlertCircle width={22} height={22}/> REPORT A PROBLEM</h3>
                <button aria-label="Close" style={{background:"none",border:"none",cursor:"pointer",padding:2}} onClick={closeDispute}><X width={20} height={20}/></button>
              </div>
              <p style={{fontSize:15,color:"#888",marginBottom:20}}>We're sorry to hear something went wrong.</p>
              <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:16}}>
                {PROBLEMS.map(p=>{
                  const on=disputeForm.problem_type===p;
                  return (
                    <button key={p} type="button" onClick={()=>setDisputeForm(f=>({...f,problem_type:p}))} style={{display:"flex",alignItems:"center",gap:12,background:"#fff",border:"none",borderBottom:"1px solid #f0f0f0",padding:"12px 4px",cursor:"pointer",textAlign:"left",fontFamily:"'Barlow Condensed',sans-serif"}}>
                      <span style={{width:20,height:20,flexShrink:0,borderRadius:"50%",border:`2px solid ${on?"#FF1493":"#bbb"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {on&&<span style={{width:10,height:10,borderRadius:"50%",background:"#FF1493"}}/>}
                      </span>
                      <span style={{fontSize:16,fontWeight:on?800:600,color:"#111"}}>{p}</span>
                    </button>
                  );
                })}
              </div>
              <textarea value={disputeForm.details} onChange={e=>setDisputeForm(f=>({...f,details:e.target.value}))} placeholder="Please describe the issue in detail..." style={{...S.inp,height:100,resize:"vertical",marginBottom:16,fontFamily:"'Barlow Condensed',sans-serif"}}/>
              <div style={{marginBottom:20}}>
                <p style={{fontSize:13,fontWeight:800,letterSpacing:1,color:"#888",marginBottom:8,textTransform:"uppercase"}}>Add a photo (optional)</p>
                {disputeForm.photoPreview?(
                  <div style={{position:"relative",width:96,height:96,border:"2px solid #111"}}>
                    <img src={disputeForm.photoPreview} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    <button type="button" aria-label="Remove photo" onClick={()=>setDisputePhoto(null)} style={{position:"absolute",top:2,right:2,background:"#111",color:"#fff",border:"none",cursor:"pointer",padding:"2px 6px",fontSize:11,fontWeight:800,fontFamily:"'Barlow Condensed',sans-serif"}}>✕</button>
                  </div>
                ):(
                  <button type="button" onClick={()=>document.getElementById("dispute-photo-input").click()} style={{display:"inline-flex",alignItems:"center",gap:8,background:"#fff",color:"#111",border:"2px solid #111",borderRadius:0,padding:"10px 16px",fontSize:13,fontWeight:800,letterSpacing:1,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif"}}><Camera width={16} height={16}/> ADD PHOTO</button>
                )}
                <input id="dispute-photo-input" type="file" accept="image/*" style={{display:"none"}} onChange={e=>{ if(e.target.files&&e.target.files[0]) setDisputePhoto(e.target.files[0]); }}/>
              </div>
              <button type="button" onClick={submitDispute} disabled={!canSubmit} style={{width:"100%",background:"#FF1493",color:"#fff",border:"2px solid #111",borderRadius:0,padding:"14px",fontSize:15,fontWeight:800,letterSpacing:2,fontFamily:"'Barlow Condensed',sans-serif",cursor:canSubmit?"pointer":"not-allowed",opacity:canSubmit?1:0.4,textTransform:"uppercase"}}>{disputeBusy?"SUBMITTING…":"Submit"}</button>
              <button type="button" onClick={closeDispute} disabled={disputeBusy} style={{display:"block",margin:"14px auto 0",background:"none",border:"none",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:2,color:"#888",textTransform:"uppercase",textDecoration:"underline"}}>Cancel</button>
            </>
            )}
          </div>
        </div>
        );
      })()}

      {/* SAVE THIS SEARCH MODAL (issue PART 2) — name the search + choose whether
          to get email alerts, with a summary of the filters being saved. */}
      {showSaveSearch&&(()=>{
        const summary=filterSummary(currentFilters());
        return (
        <div style={S.modalOverlay} onClick={()=>!savingSearch&&setShowSaveSearch(false)}>
          <div style={{background:"#fff",border:"3px solid #111",borderRadius:0,padding:28,maxWidth:460,width:"100%",maxHeight:"88vh",overflowY:"auto",fontFamily:"'Barlow Condensed',sans-serif"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <h3 style={{fontSize:26,fontWeight:900,letterSpacing:0.5,display:"inline-flex",alignItems:"center",gap:10,margin:0}}><Bookmark width={22} height={22}/> SAVE THIS SEARCH</h3>
              <button aria-label="Close" style={{background:"none",border:"none",cursor:"pointer",padding:2}} onClick={()=>setShowSaveSearch(false)}><X width={20} height={20}/></button>
            </div>
            <p style={{fontSize:14,color:"#888",margin:"0 0 18px"}}>We'll keep an eye out and email you when new listings match.</p>

            <label style={{display:"block",fontSize:12,fontWeight:800,letterSpacing:1.5,color:"#111",marginBottom:6,textTransform:"uppercase"}}>Give this search a name (optional)</label>
            <input
              value={saveSearchName}
              onChange={e=>setSaveSearchName(e.target.value)}
              placeholder="e.g. Pink wedding lehengas under £200"
              maxLength={80}
              style={{...S.inp,fontFamily:"'Barlow Condensed',sans-serif",marginBottom:18}}
            />

            {/* Filter summary being saved */}
            <div style={{border:"2px solid #111",borderRadius:0,background:"#fafafa",padding:"12px 14px",marginBottom:18}}>
              <div style={{fontSize:10,fontWeight:900,letterSpacing:2,color:"#bbb",marginBottom:4}}>SAVING</div>
              <div style={{fontSize:16,fontWeight:800,color:"#111",letterSpacing:0.3,lineHeight:1.3}}>{summary}</div>
            </div>

            {/* Email-alert toggle — #FF1493 active state */}
            <button type="button" onClick={()=>setSaveSearchAlerts(v=>!v)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:0,marginBottom:22,fontFamily:"'Barlow Condensed',sans-serif"}}>
              <span style={{fontSize:15,fontWeight:800,color:"#111",letterSpacing:0.5,display:"inline-flex",alignItems:"center",gap:8}}><Bell width={16} height={16}/> Email me when new listings match</span>
              <span style={{width:48,height:26,borderRadius:0,border:"2px solid #111",background:saveSearchAlerts?"#FF1493":"#fff",position:"relative",flexShrink:0,transition:"background .15s"}}>
                <span style={{position:"absolute",top:2,left:saveSearchAlerts?24:2,width:18,height:18,background:saveSearchAlerts?"#fff":"#111",transition:"left .15s"}}/>
              </span>
            </button>

            <button type="button" onClick={confirmSaveSearch} disabled={savingSearch} style={{width:"100%",background:"#FF1493",color:"#fff",border:"2px solid #111",borderRadius:0,padding:"14px",fontSize:15,fontWeight:800,letterSpacing:2,fontFamily:"'Barlow Condensed',sans-serif",cursor:savingSearch?"not-allowed":"pointer",opacity:savingSearch?0.5:1,textTransform:"uppercase"}}>{savingSearch?"SAVING…":"SAVE"}</button>
            <button type="button" onClick={()=>setShowSaveSearch(false)} style={{display:"block",margin:"14px auto 0",background:"none",border:"none",color:"#999",fontSize:13,fontWeight:800,letterSpacing:1.5,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",textTransform:"uppercase"}}>Cancel</button>
          </div>
        </div>
        );
      })()}

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

      {/* WISHLIST VIEW — Phase 14. DB-backed (the `wishlists` table), logged-in
          only. Most-recently-saved first; available pieces in the main grid, SOLD
          ones split out into the ALREADY SOLD section at the bottom. */}
      {view==="wishlist"&&(
        <main style={S.main}>
          <button style={S.back} onClick={()=>setView("shop")}>← BACK</button>
          {!user?(
            /* NOT LOGGED IN */
            <div style={{textAlign:"center",padding:"72px 20px"}}>
              <p style={{display:"flex",justifyContent:"center",marginBottom:16}}><Heart width={64} height={64} color="#ddd"/></p>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:30,fontWeight:900,letterSpacing:-0.5,marginBottom:20}}>LOG IN TO VIEW YOUR WISHLIST</p>
              <button className="hbtn" style={{...S.hBtn,fontSize:14,padding:"14px 28px"}} onClick={()=>{setAuthMode("login");setView("auth");}}>LOG IN</button>
            </div>
          ):(
            <>
              {/* HEADER */}
              <div style={{marginBottom:36,paddingBottom:24,borderBottom:"3px solid #111"}}>
                <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:4,color:"#FF1493",marginBottom:6}}>SAVED PIECES</p>
                <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:48,fontWeight:900,letterSpacing:-1,display:"flex",alignItems:"center",gap:12,lineHeight:1}}>MY WISHLIST <Heart width={40} height={40} fill="#FF1493" color="#FF1493"/></h2>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap",marginTop:10}}>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:700,letterSpacing:1,color:"#111"}}>{wishlistItems.length} item{wishlistItems.length===1?"":"s"} saved</p>
                  {/* SHARE WISHLIST — only when there's at least one saved piece. */}
                  {wishlistItems.length>0&&(
                    <button className="hbtn" onClick={openShareModal} style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111",fontSize:13,padding:"10px 16px",display:"inline-flex",alignItems:"center",gap:8}}>
                      <Share2 width={16} height={16}/> SHARE WISHLIST
                    </button>
                  )}
                </div>
                <p style={{fontFamily:"'Barlow',sans-serif",fontSize:13,color:"#999",marginTop:4}}>Items are not reserved — buy before they're gone</p>
              </div>

              {wishlistItems.length===0?(
                /* EMPTY STATE */
                <div style={{textAlign:"center",padding:"60px 20px"}}>
                  <p style={{display:"flex",justifyContent:"center",marginBottom:16}}><Heart width={64} height={64} color="#ddd"/></p>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900,letterSpacing:-0.5,marginBottom:8}}>YOUR WISHLIST IS EMPTY</p>
                  <p style={{fontFamily:"'Barlow',sans-serif",fontSize:14,color:"#999",marginBottom:24}}>Save items you love and come back to them later</p>
                  <button className="hbtn" style={{...S.hBtn,fontSize:14,padding:"14px 28px"}} onClick={()=>setView("shop")}>BROWSE LISTINGS →</button>
                </div>
              ):(
                <>
                  {/* AVAILABLE PIECES */}
                  {liveWishlist.length>0&&(
                    <div style={S.grid} className="shop-grid">
                      {liveWishlist.map((item,idx)=>{
                        const accent=CARD_COLORS[idx%CARD_COLORS.length];
                        return(
                          <article key={item.id} className="scard" style={{...S.card,borderColor:accent}}>
                            <Thumb src={item.image_url||(item.images&&item.images[0])||""} emoji={item.emoji||catEmoji(item.category)} accent={accent} style={S.cardTop} emojiStyle={S.cardEmoji}>
                              <div style={{position:"absolute",inset:0,zIndex:1}} onClick={()=>openDetail(item)}/>
                              <button aria-label="Remove from wishlist" title="Remove from wishlist" style={{position:"absolute",top:12,right:12,background:"#fff",border:"2px solid #111",borderRadius:0,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",zIndex:6,padding:0}} onClick={e=>{e.stopPropagation();toggleFavourite(item);}}><X width={16} height={16} color="#111"/></button>
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
                  {liveWishlist.length===0&&soldWishlist.length>0&&(
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,color:"#bbb",letterSpacing:1,padding:"8px 0 4px"}}>Every saved piece has sold — see below.</p>
                  )}

                  {/* ALREADY SOLD */}
                  {soldWishlist.length>0&&(
                    <div style={{marginTop:56,paddingTop:28,borderTop:"3px solid #111"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap",marginBottom:24}}>
                        <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:30,fontWeight:900,letterSpacing:-0.5,color:"#999"}}>ALREADY SOLD</h3>
                        <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111"}} onClick={clearSoldWishlist}>CLEAR ALL SOLD ITEMS</button>
                      </div>
                      <div style={S.grid} className="shop-grid">
                        {soldWishlist.map((item,idx)=>{
                          const accent=CARD_COLORS[idx%CARD_COLORS.length];
                          return(
                            <article key={item.id} className="scard" style={{...S.card,borderColor:"#ccc",opacity:0.85}}>
                              <Thumb src={item.image_url||(item.images&&item.images[0])||""} emoji={item.emoji||catEmoji(item.category)} accent={accent} style={S.cardTop} emojiStyle={S.cardEmoji}>
                                <div style={{position:"absolute",inset:0,zIndex:1}} onClick={()=>openDetail(item)}/>
                                <div style={S.soldVeil}><span style={S.soldStamp}>SOLD</span></div>
                                <button aria-label="Remove from wishlist" title="Remove from wishlist" style={{position:"absolute",top:12,right:12,background:"#fff",border:"2px solid #111",borderRadius:0,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",zIndex:6,padding:0}} onClick={e=>{e.stopPropagation();toggleFavourite(item);}}><X width={16} height={16} color="#111"/></button>
                              </Thumb>
                              <div style={S.cardBody}>
                                <p style={{...S.cardCatLabel,color:"#999"}}>{item.category?.toUpperCase()}</p>
                                <p style={S.cardName}>{item.name}</p>
                                <p style={{fontFamily:"'Barlow',sans-serif",fontSize:12,color:"#999",margin:"4px 0 12px"}}>This item has been sold</p>
                                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:"auto"}}>
                                  <button className="hbtn" style={{...S.hBtn,flex:1,minWidth:120,background:"#fff",color:"#111",border:"2px solid #111",justifyContent:"center",textAlign:"center"}} onClick={()=>findSimilar(item)}>FIND SIMILAR</button>
                                  <button className="hbtn" style={{...S.hBtn,flex:1,minWidth:90,background:"#fff",color:"#FF1493",border:"2px solid #FF1493",justifyContent:"center",textAlign:"center"}} onClick={()=>toggleFavourite(item)}>REMOVE</button>
                                </div>
                              </div>
                              <div style={{...S.accentBar,background:"#ccc"}}/>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* MY SHARED LISTS — Phase 14 PART 4. Hidden entirely when the user
                  has no shared lists. */}
              {myShared.length>0&&(
                <div style={{marginTop:56,paddingTop:28,borderTop:"3px solid #111"}}>
                  <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:30,fontWeight:900,letterSpacing:-0.5,marginBottom:20}}>MY SHARED LISTS</h3>
                  <div style={{display:"flex",flexDirection:"column",gap:16}}>
                    {myShared.map(list=>{
                      const count=(list.shared_wishlist_items||[]).length;
                      const created=list.created_at?new Date(list.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"";
                      const copied=myCopiedId===list.id;
                      return(
                        <div key={list.id} style={{border:"2px solid #111",borderRadius:0,background:"#fff",padding:"18px 20px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                            <div style={{minWidth:0}}>
                              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:0.3,color:"#111",margin:0,lineHeight:1.1}}>{list.name}</p>
                              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,color:"#888",margin:"6px 0 0"}}>{count} item{count===1?"":"s"} · {created}{list.public===false?" · PRIVATE":""}</p>
                            </div>
                            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                              <button className="hbtn" onClick={()=>copyShareLink(list.slug,(v)=>setMyCopiedId(v?list.id:null))} style={{...S.hBtn,background:copied?"#FF1493":"#fff",color:copied?"#fff":"#111",border:"2px solid #111",display:"inline-flex",alignItems:"center",gap:6}}>
                                {copied?<Check width={15} height={15}/>:<Copy width={15} height={15}/>} {copied?"COPIED!":"COPY LINK"}
                              </button>
                              <button className="hbtn" onClick={()=>openEditSharedList(list)} style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111",display:"inline-flex",alignItems:"center",gap:6}}>
                                <Pencil width={15} height={15}/> EDIT
                              </button>
                              <button className="hbtn" onClick={()=>deleteSharedList(list)} style={{...S.hBtn,background:"#fff",color:"#FF0000",border:"2px solid #FF0000",display:"inline-flex",alignItems:"center",gap:6}}>
                                <Trash2 width={15} height={15}/> DELETE
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
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
        followerCount={followerCount} onGateAuth={gateAuth}
      />

      {/* MY FOLLOWING (Phase 13) */}
      <Following
        view={view} setView={setView} user={user}
        followingProfiles={followingProfiles} followingLoading={followingLoading}
        toggleFollow={toggleFollow} openProfile={openProfile}
      />

      {/* DASHBOARD + CREATE BUNDLE */}
      <Dashboard
        view={view} setView={setView} user={user} myItems={myItems}
        sellerRatings={sellerRatings}
        myOrders={myOrders} wishlistCounts={wishlistCounts} openDetail={openDetail} startOrderConversation={startOrderConversation}
        setSel={setSel} openEdit={openEdit} markSold={markSold} relist={relist} del={del}
        profile={profile} flash={flash}
        bulkUpdateListings={bulkUpdateListings} relistCopy={relistCopy}
        toggleVacation={toggleVacation} vacationSaving={vacationSaving}
        saveBundleDiscount={saveBundleDiscount}
        notifyPromote={notifyPromote} promoteNotified={promoteNotified}
        startPromote={startPromote} promoteBusyId={promoteBusyId} myPromotions={myPromotions}
        bundles={bundles} bundleItems={bundleItems} loadBundles={loadBundles} deleteBundle={deleteBundle}
        bundleForm={bundleForm} setBundleForm={setBundleForm} toggleBundleListing={toggleBundleListing} createBundle={createBundle}
        myLooks={myLooks} isAdmin={isAdmin} openCreateLook={openCreateLook} editLook={editLook} deleteLook={deleteLook}
        adminReports={adminReports} adminDisputes={adminDisputes} adminNames={adminNames}
        markReportResolved={markReportResolved} updateDisputeStatus={updateDisputeStatus}
        myVerificationApp={myVerificationApp} verificationBusy={verificationBusy} submitVerification={submitVerification}
        adminApplications={adminApplications} adminApplicants={adminApplicants}
        approveVerification={approveVerification} rejectVerification={rejectVerification}
        adminTailors={adminTailors} approveTailor={approveTailor} rejectTailor={rejectTailor} openTailorPublic={openTailorPublic}
        adminPayouts={adminPayouts} retryPayout={retryPayout}
        verifyIdentity={verifyIdentity} identityBusy={identityBusy}
        requestTab={dashTabRequest} clearRequestTab={()=>setDashTabRequest(null)}
        storeForm={storeForm} setStoreForm={setStoreForm} saveStorefront={saveStorefront} storeSaving={storeSaving}
        sellerOffers={sellerOffers} offerBuyers={offerBuyers} acceptOffer={acceptOffer} declineOffer={declineOffer}
      />

      {/* FEED */}
      <Feed
        view={view} setView={setView} user={user}
        feedLoading={feedLoading} following={following} feedItems={feedItems} openDetail={openDetail}
      />

      {/* STYLE FEED — Phase 14 */}
      <StyleFeed
        view={view} setView={setView} user={user} profile={profile}
        tab={styleFeedTab} setTab={switchStyleTab}
        posts={styleFeedTab==="following"?followingPosts:forYouPosts}
        profilesMap={styleProfiles} listingsMap={styleListings}
        likedSet={styleLiked} likeCounts={styleLikeCounts}
        loading={styleFeedLoading}
        hasMore={styleFeedTab==="following"?hasMoreFollowing:hasMoreForYou}
        loadMore={loadMoreStyle}
        openProfile={openProfile} openDetail={openDetail}
        toggleLike={toggleStyleLike} deletePost={deleteStylePost} sharePost={shareStylePost}
        onGateAuth={gateAuth}
        createOpen={styleCreateOpen} setCreateOpen={setStyleCreateOpen}
        onCreate={createStylePost} creating={styleCreating}
        searchActiveListings={searchActiveListings}
        flash={flash}
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

      {/* TAILOR PROFILES — Phase 15 (apply / dashboard / public profile) */}
      <TailorProfiles
        view={view} setView={setView} user={user} flash={flash}
        myTailor={myTailor}
        applyForm={applyForm} setApplyForm={setApplyForm} applyBusy={applyBusy} submitApplication={submitTailorApplication}
        tailorDashTab={tailorDashTab} setTailorDashTab={setTailorDashTab}
        tailorEdit={tailorEdit} setTailorEdit={setTailorEdit} saveTailorProfile={saveTailorProfile} tailorEditBusy={tailorEditBusy}
        tailorPortfolio={tailorPortfolio} addPortfolioImages={addPortfolioImages} deletePortfolioImage={deletePortfolioImage} movePortfolioImage={movePortfolioImage} portfolioBusy={portfolioBusy}
        openTailorPublic={openTailorPublic}
        alterationRequests={tailorAlterations} alterationBuyers={alterationBuyers} bookingsLoading={tailorAlterationsLoading}
        onSendQuote={sendAlterationQuote} onDeclineRequest={declineAlterationRequest} onMessageBuyer={messageBuyerFromRequest}
        onMarkComplete={markAlterationComplete} payouts={tailorPayouts}
        onSetupPayments={startTailorPayments} onManagePayments={manageTailorPayments} paymentsBusy={paymentsBusy}
        availabilityRows={availabilityRows} availabilityLoading={availabilityLoading} availabilityBusy={availabilityBusy}
        onToggleAvailabilityEnabled={toggleAvailabilityEnabled} onSaveAvailabilitySettings={saveAvailabilitySettings}
        onSetDayAvailability={setDayAvailability} onSetDaySlots={setDaySlots}
        onMarkRangeUnavailable={markRangeUnavailable} onMarkAllAvailable={markAllAvailable}
        publicTailor={publicTailor} publicTailorLoading={publicTailorLoading}
        publicTailorReviews={publicTailorReviews} publicReviewBuyers={publicReviewBuyers}
        publicAvailability={publicAvailability} onSendAlterationRequest={sendAlterationRequestFromProfile}
        tailorReviews={tailorReviews} tailorReviewBuyers={tailorReviewBuyers}
        setAuthMode={setAuthMode} onGateAuth={gateAuth}
      />

      {/* ALTERATIONS — Phase 15 buyer page (/alterations) */}
      <Alterations
        view={view} setView={setView} loading={buyerAlterationsLoading} requests={buyerAlterations}
        onMessageTailor={messageTailorFromRequest} onFindTailor={()=>{loadTailorMarket();setView("tailors");window.scrollTo(0,0);}}
        onAcceptQuote={acceptAlterationQuote} onDeclineQuote={declineAlterationQuote}
        onConfirmCompletion={confirmAlterationCompletion} checkoutId={alterCheckoutId}
        onLeaveReview={openTailorReview} reviews={buyerReviews}
      />

      {/* REQUEST ALTERATIONS modal — launched from the listing detail page */}
      <RequestAlterationModal
        open={alterReqOpen} onClose={()=>setAlterReqOpen(false)}
        listing={alterReqListing} tailors={approvedTailors} busy={alterReqBusy}
        onSend={sendAlterationRequest}
        initialPreferredDate={preferredDateHint}
        getTailorAvailability={(id)=>db.getTailorAvailability(id,token)}
        openTailorProfile={(id)=>{ try{ window.open(`/tailors/${id}`,"_blank","noopener"); }catch(e){} }}
        browseAllTailors={()=>{ setAlterReqOpen(false); loadTailorMarket(); setView("tailors"); window.scrollTo(0,0); }}
      />

      {/* LEAVE A REVIEW modal — Phase 15 (opened from /alterations) */}
      <ReviewModal
        open={!!reviewReq} onClose={()=>setReviewReq(null)}
        tailor={reviewReq&&reviewReq.tailors} busy={reviewBusy}
        onSubmit={submitTailorReview}
      />

      {/* ORDERS */}
      <Orders
        view={view} setView={setView} user={user} items={items}
        ordersTab={ordersTab} setOrdersTab={setOrdersTab} ordersLoading={ordersLoading} myOrders={myOrders}
        orderProfiles={orderProfiles}
        updateOrderStatus={updateOrderStatus}
        startOrderConversation={startOrderConversation}
        openDispute={openDispute}
      />

      {/* MY OFFERS (buyer) — Phase 14 offer checkout */}
      <Offers
        view={view} setView={setView} user={user}
        buyerOffers={buyerOffers} offersLoading={offersLoading}
        completeOfferPurchase={completeOfferPurchase}
        withdrawBuyerOffer={withdrawBuyerOffer}
        makeNewOffer={makeNewOffer}
        checkoutOfferId={checkoutOfferId}
        setAuthMode={setAuthMode}
      />

      {/* SHOP VIEW */}
      <Shop
        view={view}
        user={user} profile={profile} setView={setView} setAuthMode={setAuthMode} onGateAuth={gateAuth}
        search={search} setSearch={setSearch} handleSearchInput={handleSearchInput}
        searchSuggestions={searchSuggestions} showSuggestions={showSuggestions} setShowSuggestions={setShowSuggestions}
        savedSearches={savedSearches} showSavedSearches={showSavedSearches} setShowSavedSearches={setShowSavedSearches}
        applySearch={applySearch} applySavedSearch={applySavedSearch} openSaveSearch={openSaveSearch} deleteSavedSearch={deleteSavedSearch}
        showFilters={showFilters} setShowFilters={setShowFilters} hasFilters={hasFilters} clearFilters={clearFilters}
        typeFilter={typeFilter} setTypeFilter={setTypeFilter} condFilter={condFilter} setCondFilter={setCondFilter}
        catFilter={catFilter} setCatFilter={setCatFilter} sizeFilter={sizeFilter} setSizeFilter={setSizeFilter}
        minPrice={minPrice} setMinPrice={setMinPrice} maxPrice={maxPrice} setMaxPrice={setMaxPrice}
        showSizeMatch={showSizeMatch} setShowSizeMatch={setShowSizeMatch}
        showVerifiedOnly={showVerifiedOnly} setShowVerifiedOnly={setShowVerifiedOnly}
        occFilter={occFilter} togOccFilter={togOccFilter} colourFilter={colourFilter} togColourFilter={togColourFilter}
        loadTailorMarket={loadTailorMarket}
        visible={isNewArrivals?newArrivalItems:visible} loading={loading} error={error} fetchItems={fetchItems}
        newArrivals={isNewArrivals} homeArrivals={homeArrivals} goNewArrivals={()=>{clearFilters();setView("newarrivals");}}
        openDetail={openDetail} fitsMe={fitsMe}
        newListings={newListings} priceDrops={priceDrops} trendingItems={trendingItems}
        sellerRatings={sellerRatings} fastSellers={fastSellers} verifiedSellers={verifiedSellers}
        bundleCardSellers={bundleCardSellers}
        wishlistCounts={wishlistCounts} myWishlist={myWishlist} toggleFavourite={toggleFavourite}
        looks={looks} openLook={openLook}
        shopTab={shopTab} setShopTab={setShopTab} loadFeed={loadFeed}
        following={following} feedItems={feedItems} feedLoading={feedLoading}
        homeStylePosts={homeStylePosts} homeStyleProfiles={homeStyleProfiles} openStyleFeed={openStyleFeed}
      />

      {/* MY SAVED SEARCHES */}
      <SavedSearches
        view={view} setView={setView} user={user} setAuthMode={setAuthMode}
        savedSearches={savedSearches}
        applySavedSearch={applySavedSearch}
        toggleSavedSearchAlerts={toggleSavedSearchAlerts}
        deleteSavedSearch={deleteSavedSearch}
      />

      {/* PUBLIC SHARED WISHLIST — /wishlist/<slug>, no login required */}
      <PublicWishlist
        view={view}
        list={publicList}
        loading={publicLoading}
        ownerName={publicOwnerName}
        isOwner={!!(user&&publicList&&user.id===publicList.user_id)}
        copied={publicCopied}
        openDetail={(item)=>exitPublicWishlist(item)}
        setView={()=>exitPublicWishlist()}
        onCopyLink={()=>publicList&&copyShareLink(publicList.slug,setPublicCopied)}
        onEdit={()=>publicList&&openEditSharedList(publicList)}
        onDelete={()=>publicList&&deleteSharedList(publicList)}
      />

      {/* CREATE / EDIT SHAREABLE WISHLIST MODAL */}
      <ShareWishlistModal
        open={showShareModal}
        mode={shareMode}
        step={shareStep}
        items={shareSelectItems}
        name={shareName} setName={setShareName}
        selected={shareSelected}
        toggleSelect={toggleShareItem}
        toggleAll={toggleShareAll}
        isPublic={sharePublic} setIsPublic={setSharePublic}
        saving={shareSaving}
        shareUrl={shareResult?shareSlugDisplay(shareResult.slug):""}
        copied={shareCopied}
        onCreate={submitSharedList}
        onCopy={()=>shareResult&&copyShareLink(shareResult.slug,setShareCopied)}
        onWhatsApp={()=>shareResult&&whatsappShare(shareResult.slug)}
        onClose={closeShareModal}
        onDone={closeShareModal}
      />

      {/* SHOP THE LOOK — /looks page + look detail */}
      <Looks
        view={view} setView={setView}
        looks={looks} lookFilter={lookFilter} setLookFilter={setLookFilter}
        openLook={openLook}
        selLook={selLook} selLookCreator={selLookCreator}
        openDetail={openDetail} addLookToBag={addLookToBag}
      />

      {/* CREATE / EDIT A LOOK */}
      <CreateLook
        view={view} setView={setView} user={user} isAdmin={isAdmin}
        lookForm={lookForm} setLookForm={setLookForm}
        lookStep={lookStep} setLookStep={setLookStep}
        lookSearch={lookSearch} setLookSearch={setLookSearch}
        lookSearchResults={lookSearchResults} searchLookListings={searchLookListings}
        addListingToLook={addListingToLook} removeListingFromLook={removeListingFromLook}
        publishLook={publishLook} lookSaving={lookSaving}
        editingLook={editingLook} flash={flash}
      />

      {/* LEGAL PAGES — Terms / Privacy / Returns (hardcoded static content) */}
      <Legal view={view} setView={setView} onBack={exitLegal} />

      {/* DETAIL */}
      <Detail
        view={view} setView={setView} sel={sel}
        selImages={selImages} selImgIdx={selImgIdx} setSelImgIdx={setSelImgIdx} selColor={selColor}
        myWishlist={myWishlist} toggleFavourite={toggleFavourite} shareItem={shareItem} setShowSizeGuide={setShowSizeGuide}
        inBag={inBag} toggleBag={toggleBag}
        isOwner={isOwner} startConversation={startConversation}
        user={user} setAuthMode={setAuthMode} onGateAuth={gateAuth} buyNow={buyNow}
        setShowPayment={setShowPayment} setPaymentListing={setPaymentListing} setPaymentStep={setPaymentStep} setSelectedPostage={setSelectedPostage}
        setShowReview={setShowReview} setShowReport={setShowReport}
        reviews={reviews}
        comments={comments} commentText={commentText} setCommentText={setCommentText}
        submitComment={submitComment} deleteComment={deleteComment} submitReply={submitReply} profile={profile}
        myOffer={myOffer} submitOffer={submitOffer} withdrawOffer={withdrawOffer}
        openEdit={openEdit} markSold={markSold} relist={relist} del={del}
        similarItems={similarItems} recentItems={recentItems} openDetail={openDetail}
        fastSellers={fastSellers} verifiedSellers={verifiedSellers}
        identityVerifiedSellers={identityVerifiedSellers}
        onFindTailor={openAlterationModal}
      />

      {/* ADD / EDIT */}
      {(view==="add"||view==="edit")&&(
        <main style={{...S.main,maxWidth:760}}>
          <button style={S.back} onClick={()=>setView(view==="edit"?"detail":"shop")}>← BACK</button>
          <div style={S.formCard} className="form-card">
            <div style={S.formHero}><h2 style={S.formTitle}>{view==="edit"?"EDIT YOUR\nPIECE.":"LIST YOUR\nPIECE."}</h2><p style={S.formSub}>Real measurements. Real fit info. Real buyers.</p></div>
            <Sec label={`PHOTOS (UP TO ${MAX_LISTING_IMAGES})`}>
              <div style={S.multiUploadGrid}>
                {form.imagePreviews.map((src,i)=>(
                  <div key={i} style={S.uploadThumb}>
                    <img src={src} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    <button type="button" style={S.removeImg} onClick={()=>removeImagePreview(i)}>✕</button>
                    {i===0&&<div style={S.mainImgBadge}>MAIN</div>}
                  </div>
                ))}
                {form.imagePreviews.length<MAX_LISTING_IMAGES&&(
                  <div style={S.uploadZone} onClick={()=>document.getElementById("img-input").click()}>
                    <div style={S.uploadPlaceholder}><div style={{...S.uploadIcon,display:"flex",justifyContent:"center"}}><Camera width={24} height={24}/></div><p style={S.uploadText}>ADD PHOTO</p></div>
                  </div>
                )}
              </div>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,color:"#999",marginTop:8,letterSpacing:0.5}}>{form.imagePreviews.length} / {MAX_LISTING_IMAGES} photos added</p>
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
              {/* Phase 13 — pricing suggestion from similar sold listings. Sits below
                  the price input; collapsed by default on the edit form. The effective
                  category for Clothing comes from the chosen garment type (the Category
                  dropdown is hidden for Clothing), matching how `add`/`saveEdit` store it. */}
              <PricingGuide
                category={form.listing_type==="Clothing"?buildMeasPayload(form).category:form.category}
                title={form.name}
                token={token}
                collapsible={view==="edit"}
                onUsePrice={p=>setForm(f=>({...f,price:String(p)}))}
              />
            </Sec>
            <Sec label="OCCASIONS">
              <div style={S.occGrid}>{OCCASIONS.map(o=>{const on=form.occasions.includes(o),col=OCC_COLOR[o];return<button key={o} type="button" onClick={()=>togOcc(o)} style={{...S.occToggle,background:on?col:"#fff",color:on?"#fff":"#111",border:`2px solid ${on?col:"#111"}`,fontWeight:on?800:600}}>{o.toUpperCase()}</button>;})}</div>
            </Sec>
            <Sec label="COLOUR">
              <p style={{fontSize:12,color:"#888",marginBottom:12}}>Optional — tag the main colours so buyers can filter by them.</p>
              <ColourSwatches selected={form.colours||[]} onToggle={togColour}/>
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
            {/* Phase 14 — OFFERS. Sellers can let buyers make an offer below the
                asking price (default ON), with an optional minimum-offer floor. */}
            <Sec label={<span style={{display:"inline-flex",alignItems:"center",gap:8}}><Tag width={16} height={16}/> OFFERS</span>}>
              <Tog on={form.offers_enabled!==false} onToggle={()=>setForm(f=>({...f,offers_enabled:!(f.offers_enabled!==false)}))} color="#FF1493" label="ACCEPT OFFERS ON THIS LISTING" sub="Buyers can propose a price; you have 48 hours to respond"/>
              {form.offers_enabled!==false&&(
                <div style={{marginTop:16}}>
                  <F l="Minimum offer (optional)">
                    <div style={{position:"relative"}}>
                      <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"#111",fontFamily:"'Barlow',sans-serif",pointerEvents:"none"}}>£</span>
                      <input style={{...S.inp,paddingLeft:26}} type="number" min="0" placeholder="e.g. 30" value={form.minimum_offer} onChange={e=>setForm(f=>({...f,minimum_offer:e.target.value}))}/>
                    </div>
                  </F>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,color:"#999",marginTop:6,letterSpacing:0.5}}>Buyers cannot offer below this amount.</p>
                </div>
              )}
            </Sec>
            <Sec label="DESCRIBE IT">
              <textarea style={{...S.inp,height:110,resize:"vertical",width:"100%"}} placeholder="Fabric feel, embroidery, wear history, any flaws…" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
            </Sec>
            {/* Phase 11 — items over £200 require ID verification. Show a prompt and
                block publishing until the seller is identity-verified. */}
            {(()=>{
              const idGate=parseFloat(form.price)>200&&!(profile?.identity_verified);
              return (<>
                {idGate&&(
                  <div style={{border:"2px solid #111",background:"#fff8fc",padding:"18px 20px",marginBottom:16}}>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:17,fontWeight:900,letterSpacing:0.5,color:"#111",display:"flex",alignItems:"center",gap:8,marginBottom:6}}><ShieldCheck width={18} height={18}/> IDENTITY VERIFICATION REQUIRED</p>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,color:"#666",lineHeight:1.4,marginBottom:14}}>Items over £200 require identity verification.</p>
                    <button type="button" className="hbtn" style={{background:"#111",color:"#fff",border:"2px solid #111",borderRadius:0,fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:2,padding:"12px 22px",display:"inline-flex",alignItems:"center",gap:7,cursor:"pointer"}} onClick={goVerifyIdentity}><ShieldCheck width={16} height={16}/> VERIFY MY IDENTITY</button>
                  </div>
                )}
                <button className="hbtn" style={{...S.hBtn,width:"100%",padding:"18px",fontSize:17,borderRadius:0,letterSpacing:3,opacity:(!form.name||!form.price||saving||idGate)?0.45:1,cursor:(!form.name||!form.price||saving||idGate)?"not-allowed":"pointer"}} onClick={view==="edit"?saveEdit:add} disabled={!form.name||!form.price||saving||idGate}>
                  {saving?"SAVING...":view==="edit"?"SAVE CHANGES →":"PUBLISH LISTING →"}
                </button>
              </>);
            })()}
          </div>
        </main>
      )}

      {/* GLOBAL FOOTER — appears on every page (modals/overlays render on top and
          are unaffected; the Stripe checkout is an external hosted page). */}
      <Footer onNav={goLegal} />
    </div>
  );
}
