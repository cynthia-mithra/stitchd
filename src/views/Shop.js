import React from "react";
import { Search, Scissors, Zap, Heart, Ruler, Eye, ArrowDown, ArrowRight, Sparkles, TrendingDown, Flame, Shirt, BadgeCheck, Bookmark, Recycle, ShieldCheck } from "lucide-react";
import {
  CATEGORIES, JEWELLERY_CATS, SHOE_CATS, ALL_CATEGORIES,
  CONDITIONS, SIZES, OCCASIONS, COLOURS, OCC_COLOR, CARD_COLORS,
  catEmoji, currencySymbol, colourSwatchBg, filterSummary,
} from "../lib/constants";
import { S } from "../styles";
import { Thumb, Stars, VerifiedBadge, ColourSwatches, Reveal } from "../components/Shared";
import { LookCard } from "./Looks";
import { StyleInspiration } from "./StyleFeed";
import LoginPromptModal from "../components/LoginPromptModal";

// Shared header for every homepage rail (New Arrivals, Shop the Look, Price
// Drops, Trending) so they read consistently: an accent-coloured icon + bold
// title + subtitle, with an optional "VIEW ALL" on the right.
function RailHeader({ icon, title, subtitle, accent = "#111", onViewAll }) {
  return (
    <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:16,marginBottom:20,flexWrap:"wrap"}}>
      <div>
        <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(24px,4vw,34px)",fontWeight:900,letterSpacing:-0.5,lineHeight:1,color:"#111",display:"flex",alignItems:"center",gap:10,margin:0}}>
          {icon&&<span style={{color:accent,display:"inline-flex"}}>{icon}</span>} {title}
        </h2>
        {subtitle&&<p style={{fontFamily:"'Barlow',sans-serif",fontSize:14,color:"#888",margin:"5px 0 0"}}>{subtitle}</p>}
      </div>
      {onViewAll&&(
        <button className="hbtn" style={{background:"none",border:"none",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:2,color:"#FF1493",textTransform:"uppercase",display:"inline-flex",alignItems:"center",gap:6,padding:0}} onClick={onViewAll}>VIEW ALL <ArrowRight width={15} height={15}/></button>
      )}
    </div>
  );
}

export default function Shop({
  view,
  user, profile, setView, setAuthMode, onGateAuth = () => {},
  search, setSearch, handleSearchInput,
  searchSuggestions, showSuggestions, setShowSuggestions,
  savedSearches, showSavedSearches, setShowSavedSearches,
  applySearch, applySavedSearch = () => {}, openSaveSearch = () => {}, deleteSavedSearch,
  showFilters, setShowFilters, hasFilters, clearFilters,
  typeFilter, setTypeFilter, condFilter, setCondFilter,
  catFilter, setCatFilter, sizeFilter, setSizeFilter,
  shopSort = "newest", setShopSort = () => {},
  minPrice, setMinPrice, maxPrice, setMaxPrice,
  showSizeMatch, setShowSizeMatch,
  showVerifiedOnly = false, setShowVerifiedOnly = () => {},
  occFilter = [], togOccFilter = () => {},
  colourFilter = [], togColourFilter = () => {},
  openTailorDirectory = () => {},
  visible, loading, error, fetchItems,
  newArrivals = false, homeArrivals = [], goNewArrivals = () => {},
  openDetail, fitsMe,
  priceDrops, trendingItems,
  sellerRatings = {},
  fastSellers = new Set(),
  verifiedSellers = new Set(),
  // Phase 14 — sellers (id → %) whose "BUNDLE & SAVE X%" card banner should show
  // (discount enabled + 2+ active listings).
  bundleCardSellers = {},
  wishlistCounts = {},
  myWishlist = new Set(),
  toggleFavourite = () => {},
  looks = [],
  openLook = () => {},
  // Phase 13 — FOLLOWING tab. `shopTab` toggles ALL ↔ FOLLOWING; the feed shows
  // listings only from sellers the logged-in user follows.
  shopTab = "all", setShopTab = () => {}, loadFeed = () => {},
  following = [], feedItems = [], feedLoading = false,
  // Phase 14 — homepage STYLE INSPIRATION preview (4 most recent style posts).
  homeStylePosts = [], homeStyleProfiles = {}, openStyleFeed = () => {},
}) {
  // Login gate — browsing/filtering is fully open; saving a search or
  // wishlisting a card opens the shared sign-up prompt instead of bouncing to
  // /auth. `gate` holds the active context while the modal is open.
  const [gate, setGate] = React.useState(null);
  const requireAuth = (context, action) => { if (user) action(); else setGate(context); };
  // Tapping a listing card while logged out doesn't open the detail page — it
  // shows the sign-up gate instead. We stash the tapped item so App can route the
  // buyer straight to that listing once they've signed up / logged in.
  const [pendingItem, setPendingItem] = React.useState(null);
  const viewListing = (item) => { if (user) openDetail(item); else { setPendingItem(item); setGate("listing"); } };
  // First name for the personalised logged-in hero greeting (falls back through
  // full_name → username → email handle). Logged-out visitors see the generic
  // marketing hero instead.
  const firstName = ((profile?.full_name&&profile.full_name.trim())||profile?.username||user?.email?.split("@")[0]||"").split(" ")[0];
  if(view!=="shop"&&view!=="newarrivals") return null;
  const followingActive = !!user && view==="shop" && shopTab==="following";
  // BROWSE tab row — shown below the hero + search bar for logged-in users (not on
  // /new-arrivals). A small grey "BROWSE" section label introduces the tabs, which
  // sit on a full-width divider that separates them from the listings grid. Tabs are
  // full width on mobile (.shop-tab via media query) and auto width on desktop.
  const ShopTabs = () => (!user||newArrivals) ? null : (
    <div style={{maxWidth:1300,margin:"0 auto",padding:"28px 24px 0"}}>
      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:2,color:"#6b6b6b",textTransform:"uppercase",margin:"0 0 10px"}}>BROWSE</p>
      {/* Self-contained segmented toggle — a bordered box split into two segments,
          active one filled pink. No full-width underline (which left a dangling
          line across the page). */}
      <div className="shop-tabs" style={{display:"inline-flex",border:"2px solid #111",borderRadius:0,overflow:"hidden"}}>
        {[["all","ALL LISTINGS"],["following","FOLLOWING"]].map(([k,l],i)=>(
          <button key={k} className="hbtn shop-tab" onClick={()=>{ setShopTab(k); if(k==="following") loadFeed(); }}
            style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:2,padding:"12px 30px",border:"none",borderLeft:i>0?"2px solid #111":"none",background:shopTab===k?"#FF1493":"#fff",color:shopTab===k?"#fff":"#111",cursor:"pointer",borderRadius:0}}>{l}</button>
        ))}
      </div>
    </div>
  );
  // SHOP BY CATEGORY — quick-entry tiles into the main browse categories. Each
  // tile borrows a representative photo from the current listings (falls back to
  // a brand monogram), and tapping applies the matching filter + scrolls to the
  // grid. Only shown on the main, unfiltered shop view.
  const CATEGORY_TILES = [
    {label:"Sarees",        apply:()=>{clearFilters();setTypeFilter("Clothing");setCatFilter("Saree");},        match:i=>i.category==="Saree"},
    {label:"Lehengas",      apply:()=>{clearFilters();setTypeFilter("Clothing");setCatFilter("Lehenga");},      match:i=>i.category==="Lehenga"},
    {label:"Salwar Kameez", apply:()=>{clearFilters();setTypeFilter("Clothing");setCatFilter("Salwar Kameez");},match:i=>i.category==="Salwar Kameez"},
    {label:"Sherwani",      apply:()=>{clearFilters();setTypeFilter("Clothing");setCatFilter("Sherwani");},     match:i=>i.category==="Sherwani"},
    {label:"Jewellery",     apply:()=>{clearFilters();setTypeFilter("Jewellery");},                            match:i=>i.listing_type==="Jewellery"},
    {label:"Shoes",         apply:()=>{clearFilters();setTypeFilter("Shoes");},                                match:i=>i.listing_type==="Shoes"},
  ];
  const CategoryRail = () => (
    <div style={{maxWidth:1300,margin:"0 auto",padding:"28px 24px 0"}}>
      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:2,color:"#6b6b6b",textTransform:"uppercase",margin:"0 0 12px"}}>SHOP BY CATEGORY</p>
      <div className="cat-rail">
        {CATEGORY_TILES.map((t,idx)=>{
          const hit=(visible||[]).find(i=>t.match(i)&&(i.image_url||(i.images&&i.images[0])));
          const img=hit?(hit.image_url||hit.images[0]):"";
          const accent=["#FF1493","#00E5CC","#111"][idx%3];
          const mono=t.label.split(/[\s-]+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();
          return (
            <button key={t.label} className="cat-tile" onClick={()=>{t.apply();setTimeout(()=>document.getElementById("grid-anchor")?.scrollIntoView({behavior:"smooth"}),60);}} aria-label={`Shop ${t.label}`}>
              <div className="cat-tile-img" style={{background:img?"#000":accent}}>
                {img?<img src={img} alt="" loading="lazy" decoding="async"/>:<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:30,fontWeight:900,color:"#fff"}}>{mono}</span>}
                <span className="cat-tile-label">{t.label.toUpperCase()}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
  // FOLLOWING feed — rendered in the grid position below the hero + tabs (same
  // page flow as the ALL LISTINGS grid), so the hero always stays first. Shows a
  // friendly empty state with a DISCOVER SELLERS button when the user follows no
  // one yet.
  const FollowingFeed = () => (
    <div style={S.gridWrap}>
      {feedLoading&&<SkeletonGrid count={6}/>}
      {!feedLoading&&following.length===0&&(
        <div style={S.empty}>
          <div style={S.emptyIcon}><Heart width={40} height={40}/></div>
          <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:30,fontWeight:900,margin:"20px 0 6px",letterSpacing:-0.5}}>YOUR FEED'S EMPTY.</p>
          <p style={S.emptySub}>Follow sellers you love and their newest drops land right here.</p>
          <button className="hbtn" style={S.hBtn} onClick={()=>setShopTab("all")}>DISCOVER SELLERS →</button>
        </div>
      )}
      {!feedLoading&&following.length>0&&feedItems.length===0&&(
        <div style={S.empty}>
          <div style={S.emptyIcon}><Sparkles width={40} height={40}/></div>
          <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:30,fontWeight:900,margin:"20px 0 6px",letterSpacing:-0.5}}>ALL CAUGHT UP.</p>
          <p style={S.emptySub}>No new listings from sellers you follow — check back soon.</p>
        </div>
      )}
      {!feedLoading&&feedItems.length>0&&(
        <div style={S.grid} className="shop-grid">
          {feedItems.map((item,idx)=><ListingCard key={item.id} item={item} idx={idx}/>)}
        </div>
      )}
    </div>
  );
  // Small "FAST SELLER" badge for sellers flagged fast_seller=true on their profile.
  // Reuses the same overlay badge style as RESERVED / NEW / FITS YOU. On the main grid
  // it stacks above the FITS YOU badge (which also sits bottom-left) so the two never
  // overlap; in the home rails there's no fits badge so it sits at the standard offset.
  const FastBadge = ({ sellerId, raised = false }) =>
    fastSellers.has(sellerId)
      ? <div style={{...S.fastBadge,...(raised?{bottom:40}:{}),display:"inline-flex",alignItems:"center",gap:5}}><Zap width={12} height={12} fill="currentColor"/> FAST SELLER</div>
      : null;
  // Phase 11 — small VERIFIED SELLER badge shown on a card when its seller is
  // verified. Renders nothing for everyone else.
  const VerifiedSellerBadge = ({ sellerId }) =>
    verifiedSellers.has(sellerId) ? <VerifiedBadge size="sm" style={{marginBottom:10}}/> : null;
  // Phase 14 — "BUNDLE & SAVE X%" banner across the bottom of a card's image, for
  // sellers offering a bundle discount who have 2+ active listings. Teal #00E5CC
  // background, #111 text, Barlow Condensed bold, very small, full width.
  const BundleSaveBanner = ({ sellerId }) => {
    const pct = bundleCardSellers[sellerId];
    if(!pct) return null;
    return (
      <div style={{position:"absolute",bottom:0,left:0,right:0,background:"#00E5CC",color:"#111",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:10,letterSpacing:1.5,textAlign:"center",padding:"3px 0",zIndex:4}}>
        BUNDLE &amp; SAVE {pct}%
      </div>
    );
  };
  // Seller rating chip — sits in the price/views row. Shows up to five #FF1493
  // stars filled proportionally to the seller's average, with the review count in
  // brackets (e.g. ★★★★★ (3)). Renders nothing when the seller has no reviews so
  // new sellers never show empty stars.
  const SellerRating = ({ sellerId }) => {
    const r = sellerRatings[sellerId];
    if(!r||!r.count) return null;
    return (
      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:700,color:"#FF1493",letterSpacing:0.5,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:4}}>
        <Stars value={r.average} size={11} color="#FF1493" gap={1}/> ({r.count})
      </span>
    );
  };
  // DB-backed favourite count (Phase 10b). Shows a heart + how many users have
  // wishlisted the listing, in the price/views row. Filled when the signed-in
  // user has saved it, outline otherwise; clicking toggles the save (or prompts
  // sign-in when logged out). Renders nothing when the count is 0, per spec.
  // Phase 13 — a listing is "promoted" (shows the PROMOTED label + sorts first)
  // only while its boost is live: promoted flag set AND promoted_until in the
  // future. The promoted-first ordering itself is applied in App.js (`visible`).
  const isPromoted = (item) =>
    !!item.promoted && !!item.promoted_until && new Date(item.promoted_until).getTime() > Date.now();
  // Small PROMOTED label for the top-left corner of a promoted card's image.
  const PromotedLabel = ({ item }) =>
    isPromoted(item) ? (
      <div style={{ position: "absolute", top: 12, left: 12, background: "#FF1493", color: "#fff", padding: "3px 8px", fontSize: 9, fontWeight: 800, letterSpacing: 1, fontFamily: "'Barlow Condensed',sans-serif", zIndex: 5, display: "inline-flex", alignItems: "center", gap: 4 }}>
        <Zap width={11} height={11} fill="currentColor" /> PROMOTED
      </div>
    ) : null;
  const WishCount = ({ item }) => {
    const count = wishlistCounts[item.id] || 0;
    if(count <= 0) return null;
    const mine = myWishlist.has(item.id);
    return (
      <button
        onClick={e=>{e.stopPropagation();requireAuth("wishlist",()=>toggleFavourite(item));}}
        aria-label={mine?"Remove from wishlist":"Add to wishlist"}
        style={{display:"inline-flex",alignItems:"center",gap:4,background:"none",border:"none",padding:0,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:700,color:"#FF1493",letterSpacing:0.5,whiteSpace:"nowrap"}}
      >
        <Heart width={12} height={12} fill={mine?"#FF1493":"none"} color="#FF1493"/> {count}
      </button>
    );
  };
  // Single source of truth for a listing card, so the FOLLOWING feed and the
  // main ALL LISTINGS grid render identically (badges, measurements, wishlist,
  // ratings — the full polished card) rather than two different layouts.
  const ListingCard = ({ item, idx }) => {
    const accent=CARD_COLORS[idx%CARD_COLORS.length];
    const saved=myWishlist.has(item.id);
    // Shared chip used by the zoned image-overlay stacks (top-left status,
    // bottom-left fit/seller) so every badge is sharp, uppercase and consistent.
    const ovChip={display:"inline-flex",alignItems:"center",gap:4,padding:"3px 9px",fontSize:10,fontWeight:800,letterSpacing:1.5,fontFamily:"'Barlow Condensed',sans-serif",borderRadius:0,whiteSpace:"nowrap",lineHeight:1.4};
    return(
      <article className="scard" style={{...S.card,opacity:item.sold?0.55:1}} onClick={()=>viewListing(item)}>
        <Thumb src={item.image_url||(item.images&&item.images[0])||""} emoji={item.emoji||catEmoji(item.category)} accent={accent} gradient style={S.cardTop} className="card-top" emojiStyle={S.cardEmoji}>
          {item.sold&&<div style={S.soldVeil}><span style={S.soldStamp}>SOLD</span></div>}
          {/* TOP-LEFT — status chips, stacked so they never collide */}
          <div className="card-ov card-ov-tl">
            {isPromoted(item)&&<span style={{...ovChip,background:"#FF1493",color:"#fff"}}><Zap width={11} height={11} fill="currentColor"/> PROMOTED</span>}
            {item.prev_price>item.price&&<span style={{...ovChip,background:"#00E5CC",color:"#111"}}>PRICE DROP</span>}
            {item.reserved&&!item.sold&&<span style={{...ovChip,background:"#FF9500",color:"#fff"}}>RESERVED</span>}
            {item.origin&&<span style={{...ovChip,background:"rgba(0,0,0,0.55)",color:"#fff",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)"}}>{item.origin.toUpperCase()}</span>}
          </div>
          {/* TOP-RIGHT — wishlist heart (sharp, frosted, on-theme) */}
          <button className="card-heart" aria-label={saved?"Remove from wishlist":"Add to wishlist"} style={saved?{background:"#FF1493",borderColor:"#FF1493"}:null} onClick={e=>{e.stopPropagation();requireAuth("wishlist",()=>toggleFavourite(item));}}><Heart width={15} height={15} fill={saved?"#fff":"none"} color={saved?"#fff":"#111"}/></button>
          {/* BOTTOM-LEFT — fit + seller chips */}
          <div className="card-ov card-ov-bl">
            {fitsMe(item)===true&&<span style={{...ovChip,background:"#34C759",color:"#fff"}}><Ruler width={11} height={11}/> FITS YOU</span>}
            {fastSellers.has(item.user_id)&&<span style={{...ovChip,background:"#00E5CC",color:"#111"}}><Zap width={11} height={11} fill="currentColor"/> FAST SELLER</span>}
          </div>
          {!item.sold&&<BundleSaveBanner sellerId={item.user_id}/>}
          {/* HOVER PRICE — frosted bar slides up on hover (desktop pointer only) */}
          {!item.sold&&(
            <div className="card-hover-price">
              <span className="chp-price">{currencySymbol(item.currency)}{item.price}</span>
              <span className="chp-view">VIEW <ArrowRight width={13} height={13}/></span>
            </div>
          )}
        </Thumb>
        <div style={S.cardBody} className="card-body">
          <p style={{...S.cardCatLabel,color:accent}} className="card-cat">{item.category?.toUpperCase()}{(item.material||item.fabric)?` · ${(item.material||item.fabric).toUpperCase()}`:""}</p>
          <p style={S.cardName} className="card-name">{item.name}</p>
          <VerifiedSellerBadge sellerId={item.user_id}/>
          {(item.occasions||[]).length>0&&<div style={S.occRow}>{item.occasions.slice(0,3).map(o=><span key={o} style={{...S.occChip,background:OCC_COLOR[o]||"#999",color:"#fff"}}>{o.toUpperCase()}</span>)}</div>}
          <div style={S.measRow}>
            {item.size&&item.size!=="Free Size"&&<span style={S.mTag}>{item.size}</span>}
            {item.bust&&<span style={S.mTag}>B {item.bust}in</span>}
            {item.waist&&<span style={S.mTag}>W {item.waist}in</span>}
            {item.can_take_in&&<span style={{...S.mTag,...S.mTagG}}>↔ TAKE IN</span>}
            {item.spare_fabric&&<span style={{...S.mTag,...S.mTagA}}>+ FABRIC</span>}
          </div>
          <div style={S.cardFoot}>
            <span style={{display:"flex",alignItems:"baseline",gap:8}}>
              <span style={{...S.cardPrice,color:accent}} className="card-price">{currencySymbol(item.currency)}{item.price}</span>
              {item.prev_price>item.price&&<span style={S.cardPrevPrice}>{currencySymbol(item.currency)}{item.prev_price}</span>}
            </span>
            <span style={{display:"flex",alignItems:"center",gap:8}}>
              <WishCount item={item}/>
              <SellerRating sellerId={item.user_id}/>
              {item.views>0&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#6f6f6f",letterSpacing:1,display:"inline-flex",alignItems:"center",gap:4}}><Eye width={12} height={12}/> {item.views}</span>}
            </span>
          </div>
        </div>
        <div style={{...S.accentBar,background:accent}}/>
      </article>
    );
  };
  // Polished loading placeholder that mirrors the real card layout (image,
  // category line, name, meta tags, price) so the grid keeps its shape while
  // listings load — a shimmer sweeps across each grey block. Used by both the
  // main grid and the FOLLOWING feed so loading looks identical everywhere.
  const SkBlock = ({ w="100%", h=12, mb=0, r=2 }) => (
    <div style={{width:w,height:h,marginBottom:mb,borderRadius:r,background:"linear-gradient(90deg,#f3f3f3 25%,#e9e9e9 50%,#f3f3f3 75%)",backgroundSize:"200% 100%",animation:"shimmer 1.4s ease-in-out infinite"}}/>
  );
  const SkeletonCard = () => (
    <div style={{...S.card,borderColor:"#eee",cursor:"default"}} aria-hidden="true">
      <SkBlock h={200} r={0}/>
      <div style={{padding:"16px 18px",background:"#fff",flex:1}}>
        <SkBlock w="42%" h={9} mb={12}/>
        <SkBlock w="82%" h={16} mb={8}/>
        <SkBlock w="55%" h={16} mb={16}/>
        <div style={{display:"flex",gap:6,marginBottom:16}}>
          <SkBlock w={44} h={18}/><SkBlock w={56} h={18}/>
        </div>
        <SkBlock w="34%" h={22}/>
      </div>
      <div style={{height:4,width:"100%",background:"#eee"}}/>
    </div>
  );
  const SkeletonGrid = ({ count=8 }) => (
    <div style={S.grid} className="shop-grid">
      {Array(count).fill(0).map((_,i)=><SkeletonCard key={i}/>)}
    </div>
  );
  return (
    <>
      {/* NEW ARRIVALS page header — replaces the hero when this view is the
          /new-arrivals page. The search bar + filters + grid below are shared
          with the main shop, so every filter works here too. */}
      {newArrivals&&(
        <section style={{maxWidth:1300,margin:"0 auto",padding:"36px 24px 8px"}}>
          <button style={{...S.back,marginBottom:18}} onClick={()=>setView("shop")}>← BACK TO SHOP</button>
          <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(40px,8vw,72px)",fontWeight:900,letterSpacing:-1,lineHeight:0.95,color:"#111",margin:0,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}><Sparkles width={44} height={44}/> NEW ARRIVALS</h1>
          <p style={{fontFamily:"'Barlow',sans-serif",fontSize:16,color:"#888",marginTop:10}}>Fresh drops. Updated daily.</p>
        </section>
      )}
      {!newArrivals&&(
      <section style={S.hero} className="hero-section">
        {/* Logged-in users get a personalised "welcome back" hero (greeting +
            shopping-first CTAs) so the homepage no longer looks identical to the
            logged-out marketing pitch. Logged-out visitors keep the original
            DESI FITS REHOMED marketing hero. */}
        <div style={S.heroLeft} className="hero-left">
          {user ? (
            <>
              <p style={S.heroTag}>WELCOME BACK{firstName?",":""}</p>
              <h1 style={S.heroH}><span style={S.heroLine1}>HEY</span><span style={S.heroLine2}>{(firstName||"THERE").toUpperCase()}</span><span style={S.heroLine3}>WHAT'S NEW.</span></h1>
              <p style={S.heroSub}>Fresh drops from across the community — pick up where you left off.</p>
              <div style={S.heroCtas}>
                <button className="hbtn" style={S.heroBtnPrimary} onClick={()=>document.getElementById("grid-anchor")?.scrollIntoView({behavior:"smooth"})}><span style={{display:"inline-flex",alignItems:"center",gap:8}}>BROWSE DROPS <ArrowDown width={16} height={16}/></span></button>
                <button className="hbtn" style={S.heroBtnSecondary} onClick={()=>setView("add")}>LIST YOUR PIECE <span className="btn-arrow">→</span></button>
              </div>
            </>
          ) : (
            <>
              <p style={S.heroTag}>THE MARKETPLACE FOR</p>
              <h1 style={S.heroH}><span style={S.heroLine1}>DESI</span><span style={S.heroLine2}>FITS</span><span style={S.heroLine3}>REHOMED.</span></h1>
              <p style={S.heroSub}>Buy or Resell South Asian fashion</p>
              <div style={S.heroCtas}>
                <button className="hbtn" style={S.heroBtnPrimary} onClick={()=>(setAuthMode("signup"),setView("auth"))}>LIST YOUR PIECE <span className="btn-arrow">→</span></button>
                <button className="hbtn" style={S.heroBtnSecondary} onClick={()=>document.getElementById("grid-anchor")?.scrollIntoView({behavior:"smooth"})}><span style={{display:"inline-flex",alignItems:"center",gap:8}}>BROWSE DROPS <ArrowDown width={16} height={16}/></span></button>
              </div>
            </>
          )}
          {/* Editorial value-prop strip — replaces the old hero imagery with a
              confident statement of what makes Stitch'd different. */}
          <div className="hero-props">
            {[
              {Icon:Ruler,      label:"Real measurements", accent:"#FF1493"},
              {Icon:Recycle,    label:"South Asian pre-loved", accent:"#00E5CC"},
              {Icon:ShieldCheck,label:"Secure UK checkout", accent:"#111"},
            ].map(({Icon,label,accent})=>(
              <span key={label} className="hero-prop"><Icon width={17} height={17} color={accent} strokeWidth={2.4}/> {label}</span>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* SEARCH BAR */}
      <div style={{...S.searchBar,position:"relative"}} id="grid-anchor">
        <div style={S.searchInner}>
          <div style={S.searchBox} className="search-box">
            <span style={S.searchIcon}><Search width={16} height={16}/></span>
            <input style={S.searchInput} placeholder="SEARCH SAREES, SILK, WEDDING..."
              value={search}
              onChange={e=>handleSearchInput(e.target.value)}
              onFocus={()=>{ if(search.length>=2) setShowSuggestions(true); if(user&&savedSearches.length>0&&!search) setShowSavedSearches(true); }}
              onBlur={()=>setTimeout(()=>{ setShowSuggestions(false); setShowSavedSearches(false); },200)}
            />
            {search&&<button style={S.searchClear} onClick={()=>{setSearch("");setShowSuggestions(false);}}>✕</button>}
          </div>
          <button className="hbtn search-action-btn" style={{...S.filterBtn,background:showFilters?"#FF1493":"#fff",color:showFilters?"#fff":"#111"}} onClick={()=>setShowFilters(f=>!f)}>FILTERS {hasFilters?"●":""}</button>
          <select value={shopSort} onChange={e=>setShopSort(e.target.value)} aria-label="Sort listings" className="search-action-btn" style={{...S.filterBtn,display:"inline-block",height:30,textAlignLast:"center",cursor:"pointer"}}>
            <option value="newest">SORT: NEWEST</option>
            <option value="price_low">PRICE: LOW → HIGH</option>
            <option value="price_high">PRICE: HIGH → LOW</option>
          </select>
          {user&&profile?.bust&&<button className="hbtn search-action-btn" style={{...S.filterBtn,background:showSizeMatch?"#34C759":"#fff",color:showSizeMatch?"#fff":"#111"}} onClick={()=>setShowSizeMatch(f=>!f)}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Ruler width={16} height={16}/> FIT</span></button>}
          {/* Phase 12 — SAVE THIS SEARCH. Appears once any filter or query is
              active. Logged-out buyers are prompted to log in on tap (handled in
              openSaveSearch). Outlined, 2px #111, no radius, Barlow Condensed. */}
          {hasFilters&&<button className="hbtn search-action-btn" style={{...S.filterBtn,background:"#fff",color:"#111",border:"2px solid #111"}} onClick={()=>requireAuth("default",openSaveSearch)}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Bookmark width={15} height={15}/> SAVE THIS SEARCH</span></button>}
          <button className="hbtn search-action-btn" style={{...S.filterBtn,background:"#fff",color:"#111"}} onClick={openTailorDirectory}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Scissors width={16} height={16}/> TAILORS</span></button>
        </div>
        {(showSuggestions&&searchSuggestions.length>0)||(showSavedSearches&&savedSearches.length>0)?(
          <div style={{position:"absolute",top:"100%",left:10,width:"calc(100% - 20px)",maxWidth:560,background:"#fff",border:"2px solid #111",borderTop:"none",zIndex:200,maxHeight:280,overflowY:"auto"}}>
            {showSavedSearches&&savedSearches.length>0&&!search&&(
              <>
                <div style={{padding:"8px 14px",fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,fontWeight:900,letterSpacing:2,color:"#6f6f6f",borderBottom:"1px solid #f0f0f0"}}>SAVED SEARCHES</div>
                {savedSearches.map(s=>(
                  <div key={s.id} style={{display:"flex",alignItems:"center",padding:"10px 14px",borderBottom:"1px solid #f5f5f5",cursor:"pointer",gap:10}}>
                    <span style={{display:"flex",alignItems:"center",color:"#FF1493"}}><Bookmark width={15} height={15} fill={s.email_alerts!==false?"#FF1493":"none"}/></span>
                    <span style={{flex:1,minWidth:0,fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,color:"#111",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} onMouseDown={()=>applySavedSearch(s)}>{(s.name&&s.name.trim())||filterSummary(s.filters)||s.query}</span>
                    <button style={{background:"none",border:"none",color:"#6f6f6f",cursor:"pointer",fontSize:12,fontWeight:900,padding:"2px 6px"}} onClick={()=>deleteSavedSearch(s.id)}>✕</button>
                  </div>
                ))}
              </>
            )}
            {showSuggestions&&searchSuggestions.map((s,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",padding:"10px 14px",borderBottom:"1px solid #f5f5f5",cursor:"pointer",gap:10}} onMouseDown={()=>applySearch(s)}>
                <span style={{display:"flex",alignItems:"center",color:"#6f6f6f"}}><Search width={15} height={15}/></span>
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,color:"#111"}}>{s}</span>
              </div>
            ))}
          </div>
        ):null}
        {showFilters&&(
          <div style={S.filterPanel}>
            <div style={S.filterGroup}><div style={S.filterLabel}>SELLER</div><div style={S.filterPills}><button className="fpill" onClick={()=>setShowVerifiedOnly(v=>!v)} style={{...S.pill,...(showVerifiedOnly?{background:"#00E5CC",border:"1.5px solid #111",color:"#111"}:{}),display:"inline-flex",alignItems:"center",gap:6}}><BadgeCheck width={13} height={13}/> VERIFIED SELLERS ONLY</button></div></div>
            <div style={S.filterGroup}><div style={S.filterLabel}>TYPE</div><div style={S.filterPills}>{["All","Clothing","Jewellery","Shoes"].map(t=><button key={t} className="fpill" onClick={()=>setTypeFilter(t)} style={{...S.pill,...(typeFilter===t?S.pillOn:{})}}>{t}</button>)}</div></div>
            <div style={S.filterGroup}><div style={S.filterLabel}>CONDITION</div><div style={S.filterPills}>{["All",...CONDITIONS].map(c=><button key={c} className="fpill" onClick={()=>setCondFilter(c)} style={{...S.pill,...(condFilter===c?S.pillOn:{})}}>{c}</button>)}</div></div>
            <div style={S.filterGroup}><div style={S.filterLabel}>CATEGORY</div><div style={S.filterPills}>{["All",...(typeFilter==="Jewellery"?JEWELLERY_CATS:typeFilter==="Shoes"?SHOE_CATS:typeFilter==="Clothing"?CATEGORIES:ALL_CATEGORIES)].map(c=><button key={c} className="fpill" onClick={()=>setCatFilter(c)} style={{...S.pill,...(catFilter===c?S.pillOn:{})}}>{c}</button>)}</div></div>
            <div style={S.filterGroup}><div style={S.filterLabel}>SIZE</div><div style={S.filterPills}>{["All",...SIZES].map(sz=><button key={sz} className="fpill" onClick={()=>setSizeFilter(sz)} style={{...S.pill,...(sizeFilter===sz?S.pillOn:{})}}>{sz}</button>)}</div></div>
            {/* Phase 12 — OCCASION. Multi-select pink pills (2px #111 border, no
                radius, Barlow Condensed). Wrapped grid; selected = #FF1493. */}
            <div style={S.filterGroup}>
              <div style={S.filterLabel}>OCCASION</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {OCCASIONS.map(o=>{const on=occFilter.includes(o);return(
                  <button key={o} type="button" onClick={()=>togOccFilter(o)} style={{background:on?"#FF1493":"#fff",color:on?"#fff":"#111",border:"2px solid #111",borderRadius:0,padding:"7px 14px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:on?800:700,fontSize:12,letterSpacing:1,cursor:"pointer",whiteSpace:"nowrap"}}>{o.toUpperCase()}</button>
                );})}
              </div>
            </div>
            {/* Phase 12 — COLOUR. Circular 24px swatches; selected gets a 2px #111
                ring. Shares the ColourSwatches component with the listing form. */}
            <div style={S.filterGroup}>
              <div style={S.filterLabel}>COLOUR</div>
              <ColourSwatches selected={colourFilter} onToggle={togColourFilter}/>
            </div>
            <div style={S.filterGroup}>
              <div style={S.filterLabel}>PRICE RANGE</div>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <input style={{...S.inp,width:100}} type="number" placeholder="MIN" value={minPrice} onChange={e=>setMinPrice(e.target.value)}/>
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,color:"#6f6f6f"}}>—</span>
                <input style={{...S.inp,width:100}} type="number" placeholder="MAX" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)}/>
                {hasFilters&&<button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#FF1493",border:"2px solid #FF1493",fontSize:11,padding:"8px 14px"}} onClick={clearFilters}>CLEAR ALL</button>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BROWSE tab row — sits below the hero + search bar (logged-in only). */}
      <ShopTabs/>

      {/* FOLLOWING tab shows the followed-sellers feed in the grid position; the
          ALL LISTINGS tab (and logged-out / new-arrivals) shows the main grid. */}
      {followingActive ? <FollowingFeed/> : (
      <>
      {!newArrivals&&!hasFilters&&<CategoryRail/>}
      {hasFilters&&<div style={{padding:"12px 24px",fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,letterSpacing:2,color:"#6f6f6f",borderBottom:"1px solid #f0f0f0"}}>{visible.length} RESULT{visible.length!==1?"S":""}{search?` FOR "${search.toUpperCase()}"`:""}  <span style={{color:"#FF1493",cursor:"pointer",marginLeft:12}} onClick={clearFilters}>CLEAR</span></div>}

      <div style={S.gridWrap}>
        {loading&&<SkeletonGrid/>}
        {error&&<div style={S.errorBanner}>{error}<button style={S.retryBtn} onClick={fetchItems}>RETRY</button></div>}
        {!loading&&!error&&(
          <div style={S.grid} className="shop-grid">
            {visible.map((item,idx)=><ListingCard key={item.id} item={item} idx={idx}/>)}
            {visible.length===0&&(
              <div style={S.empty}>
                <div style={S.emptyIcon}>{hasFilters?<Search width={40} height={40}/>:<Shirt width={40} height={40}/>}</div>
                <p style={{fontSize:30,fontWeight:900,margin:"20px 0 6px",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:-0.5}}>{hasFilters?"NO MATCHES.":"NOTHING HERE YET."}</p>
                <p style={S.emptySub}>{hasFilters?"Try loosening a filter or two — your perfect piece might be one tweak away.":"Be the first to list a piece and start the rail."}</p>
                {hasFilters?<button className="hbtn" style={S.hBtn} onClick={clearFilters}>CLEAR FILTERS</button>:<button className="hbtn" style={S.hBtn} onClick={()=>user?setView("add"):(setAuthMode("signup"),setView("auth"))}>LIST YOUR PIECE →</button>}
              </div>
            )}
          </div>
        )}
      </div>
      </>
      )}

      {/* NEW ARRIVALS — the 4 most recent listings (last 14 days). Horizontal
          scroll rail on mobile, grid on desktop. Hidden on the new-arrivals page
          itself, while filtering, and when there are no recent listings. */}
      {!newArrivals&&!hasFilters&&!followingActive&&homeArrivals.length>0&&(
        <Reveal style={{maxWidth:1300,margin:"48px auto 0",borderTop:"3px solid #111",padding:"32px 10px 0"}}>
          <RailHeader icon={<Sparkles width={26} height={26}/>} title="NEW ARRIVALS" subtitle="Fresh drops, updated daily" accent="#34C759" onViewAll={goNewArrivals}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:16}} className="shop-grid">
            {homeArrivals.map((item,idx)=>{
              const accent=CARD_COLORS[idx%CARD_COLORS.length];
              return(
                <article key={item.id} className="scard" style={S.card} onClick={()=>viewListing(item)}>
                  <Thumb src={item.image_url||(item.images&&item.images[0])||""} emoji={item.emoji||catEmoji(item.category)} accent={accent} style={S.cardTop} className="card-top" emojiStyle={S.cardEmoji}>
                    <div style={{position:"absolute",top:12,left:12,background:"#34C759",color:"#fff",padding:"2px 8px",fontSize:9,fontWeight:800,letterSpacing:1.5,fontFamily:"'Barlow Condensed',sans-serif",zIndex:3}}>NEW</div>
                    <FastBadge sellerId={item.user_id}/>
                    {!item.sold&&<div className="card-hover-price"><span className="chp-price">{currencySymbol(item.currency)}{item.price}</span><span className="chp-view">VIEW <ArrowRight width={13} height={13}/></span></div>}
                  </Thumb>
                  <div style={S.cardBody} className="card-body">
                    <p style={{...S.cardCatLabel,color:accent}} className="card-cat">{item.category?.toUpperCase()}</p>
                    <p style={S.cardName} className="card-name">{item.name}</p>
                    <div style={S.cardFoot}><span style={{...S.cardPrice,color:accent}} className="card-price">{currencySymbol(item.currency)}{item.price}</span><span style={{display:"flex",alignItems:"center",gap:8}}><WishCount item={item}/><SellerRating sellerId={item.user_id}/></span></div>
                  </div>
                  <div style={{...S.accentBar,background:accent}}/>
                </article>
              );
            })}
          </div>
        </Reveal>
      )}

      {/* SHOP THE LOOK — curated outfit collections. Hidden entirely when no
          looks exist or while the buyer is filtering/searching the grid. The rail
          scrolls horizontally on mobile and is a 3-up grid on desktop. */}
      {!newArrivals&&!hasFilters&&!followingActive&&looks.length>0&&(
        <Reveal style={{maxWidth:1300,margin:"48px auto 0",borderTop:"3px solid #111",padding:"32px 10px 0"}}>
          <RailHeader icon={<Sparkles width={26} height={26}/>} title="SHOP THE LOOK" subtitle="Complete outfits, all pre-loved" accent="#FF1493" onViewAll={()=>setView("looks")}/>
          <div className="looks-grid looks-rail">
            {looks.slice(0,6).map(look=><LookCard key={look.id} look={look} onOpen={openLook}/>)}
          </div>
        </Reveal>
      )}

      {/* STYLE INSPIRATION — homepage style-feed preview. Hidden when no posts
          exist or while the buyer is filtering/searching the grid. */}
      {!newArrivals&&!hasFilters&&!followingActive&&homeStylePosts.length>0&&(
        <Reveal><StyleInspiration posts={homeStylePosts} profilesMap={homeStyleProfiles} onOpen={openStyleFeed} /></Reveal>
      )}

      {/* PRICE DROPS */}
      {!newArrivals&&!hasFilters&&!followingActive&&priceDrops.length>0&&(
        <Reveal style={{maxWidth:1300,margin:"48px auto 0",borderTop:"3px solid #111",padding:"32px 10px 0"}}>
          <RailHeader icon={<TrendingDown width={26} height={26}/>} title="PRICE DROPS" subtitle="Recently reduced by their sellers" accent="#FF9500"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:16}} className="shop-grid">
            {priceDrops.slice(0,8).map((item,idx)=>{
              const accent=CARD_COLORS[idx%CARD_COLORS.length];
              const drop=item.prev_price?Math.round(((item.prev_price-item.price)/item.prev_price)*100):0;
              return(
                <article key={item.id} className="scard" style={S.card} onClick={()=>viewListing(item)}>
                  <Thumb src={item.image_url||(item.images&&item.images[0])||""} emoji={item.emoji||catEmoji(item.category)} accent={accent} style={S.cardTop} className="card-top" emojiStyle={S.cardEmoji}>
                    {drop>0&&<div style={{position:"absolute",top:12,left:12,background:"#FF9500",color:"#fff",padding:"2px 8px",fontSize:9,fontWeight:800,letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif",zIndex:3}}>-{drop}%</div>}
                    <FastBadge sellerId={item.user_id}/>
                    {!item.sold&&<div className="card-hover-price"><span className="chp-price">{currencySymbol(item.currency)}{item.price}</span><span className="chp-view">VIEW <ArrowRight width={13} height={13}/></span></div>}
                  </Thumb>
                  <div style={S.cardBody} className="card-body">
                    <p style={{...S.cardCatLabel,color:accent}} className="card-cat">{item.category?.toUpperCase()}</p>
                    <p style={S.cardName} className="card-name">{item.name}</p>
                    <div style={S.cardFoot}>
                      <span style={{display:"flex",alignItems:"baseline"}}>
                        <span style={{...S.cardPrice,color:accent}} className="card-price">{currencySymbol(item.currency)}{item.price}</span>
                        {item.prev_price&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,color:"#6f6f6f",textDecoration:"line-through",marginLeft:6}}>{currencySymbol(item.currency)}{item.prev_price}</span>}
                      </span>
                      <span style={{display:"flex",alignItems:"center",gap:8}}><WishCount item={item}/><SellerRating sellerId={item.user_id}/></span>
                    </div>
                  </div>
                  <div style={{...S.accentBar,background:accent}}/>
                </article>
              );
            })}
          </div>
        </Reveal>
      )}

      {/* TRENDING */}
      {!newArrivals&&!hasFilters&&!followingActive&&trendingItems.length>0&&(
        <Reveal style={{maxWidth:1300,margin:"48px auto 48px",borderTop:"3px solid #111",padding:"32px 10px 0"}}>
          <RailHeader icon={<Flame width={26} height={26}/>} title="TRENDING" subtitle="The most-viewed pieces right now" accent="#BF5AF2"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:16}} className="shop-grid">
            {trendingItems.slice(0,8).map((item,idx)=>{
              const accent=CARD_COLORS[idx%CARD_COLORS.length];
              return(
                <article key={item.id} className="scard" style={S.card} onClick={()=>viewListing(item)}>
                  <Thumb src={item.image_url||(item.images&&item.images[0])||""} emoji={item.emoji||catEmoji(item.category)} accent={accent} style={S.cardTop} className="card-top" emojiStyle={S.cardEmoji}>
                    <div style={{position:"absolute",top:12,left:12,background:"#BF5AF2",color:"#fff",padding:"2px 8px",fontSize:9,fontWeight:800,letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif",zIndex:3,display:"inline-flex",alignItems:"center",gap:4}}><Eye width={11} height={11}/> {item.views}</div>
                    <FastBadge sellerId={item.user_id}/>
                    {!item.sold&&<div className="card-hover-price"><span className="chp-price">{currencySymbol(item.currency)}{item.price}</span><span className="chp-view">VIEW <ArrowRight width={13} height={13}/></span></div>}
                  </Thumb>
                  <div style={S.cardBody} className="card-body">
                    <p style={{...S.cardCatLabel,color:accent}} className="card-cat">{item.category?.toUpperCase()}</p>
                    <p style={S.cardName} className="card-name">{item.name}</p>
                    <div style={S.cardFoot}><span style={{...S.cardPrice,color:accent}} className="card-price">{currencySymbol(item.currency)}{item.price}</span><span style={{display:"flex",alignItems:"center",gap:8}}><WishCount item={item}/><SellerRating sellerId={item.user_id}/></span></div>
                  </div>
                  <div style={{...S.accentBar,background:accent}}/>
                </article>
              );
            })}
          </div>
        </Reveal>
      )}
      <LoginPromptModal open={!!gate} context={gate||"default"} onClose={()=>{ setGate(null); setPendingItem(null); }} onAuth={m=>{ const it=pendingItem; setGate(null); setPendingItem(null); onGateAuth(m, it); }}/>
    </>
  );
}
