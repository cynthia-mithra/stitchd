import React from "react";
import { Search, Scissors, Zap, Heart, Ruler, Eye, ArrowDown, ArrowRight, Sparkles, TrendingDown, Flame, Shirt, BadgeCheck, Bookmark } from "lucide-react";
import {
  CATEGORIES, JEWELLERY_CATS, SHOE_CATS, ALL_CATEGORIES,
  CONDITIONS, SIZES, OCCASIONS, COLOURS, OCC_COLOR, CARD_COLORS,
  catEmoji, currencySymbol, colourSwatchBg, filterSummary,
} from "../lib/constants";
import { S } from "../styles";
import { Thumb, Stars, VerifiedBadge, ColourSwatches } from "../components/Shared";
import { LookCard } from "./Looks";
import { StyleInspiration } from "./StyleFeed";

export default function Shop({
  view,
  user, profile, setView, setAuthMode,
  search, setSearch, handleSearchInput,
  searchSuggestions, showSuggestions, setShowSuggestions,
  savedSearches, showSavedSearches, setShowSavedSearches,
  applySearch, applySavedSearch = () => {}, openSaveSearch = () => {}, deleteSavedSearch,
  showFilters, setShowFilters, hasFilters, clearFilters,
  typeFilter, setTypeFilter, condFilter, setCondFilter,
  catFilter, setCatFilter, sizeFilter, setSizeFilter,
  minPrice, setMinPrice, maxPrice, setMaxPrice,
  showSizeMatch, setShowSizeMatch,
  showVerifiedOnly = false, setShowVerifiedOnly = () => {},
  occFilter = [], togOccFilter = () => {},
  colourFilter = [], togColourFilter = () => {},
  loadTailorMarket,
  visible, loading, error, fetchItems,
  newArrivals = false, homeArrivals = [], goNewArrivals = () => {},
  openDetail, fitsMe,
  newListings, priceDrops, trendingItems,
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
  if(view!=="shop"&&view!=="newarrivals") return null;
  const followingActive = !!user && view==="shop" && shopTab==="following";
  // Tab bar shown at the top of the shop for logged-in users (not on /new-arrivals).
  const ShopTabs = () => (!user||newArrivals) ? null : (
    <div style={{maxWidth:1300,margin:"0 auto",padding:"18px 24px 0",display:"flex",gap:0}}>
      {[["all","ALL LISTINGS"],["following","FOLLOWING"]].map(([k,l])=>(
        <button key={k} className="hbtn" onClick={()=>{ setShopTab(k); if(k==="following") loadFeed(); }}
          style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:2,padding:"10px 22px",border:"2px solid #111",borderLeft:k==="all"?"2px solid #111":"none",background:shopTab===k?"#FF1493":"#fff",color:shopTab===k?"#fff":"#111",cursor:"pointer",borderRadius:0}}>{l}</button>
      ))}
    </div>
  );
  // FOLLOWING feed — replaces the hero/grid/rails. Same card grid as the shop.
  if(followingActive){
    return (
      <>
        <ShopTabs/>
        <main style={S.main}>
          <div style={{marginBottom:28,paddingBottom:20,borderBottom:"3px solid #111"}}>
            <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:4,color:"#FF1493",marginBottom:6}}>FROM SELLERS YOU FOLLOW</p>
            <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:44,fontWeight:900,letterSpacing:-1,lineHeight:1}}>FOLLOWING ✦</h2>
          </div>
          {feedLoading&&<div style={S.loadingWrap}><div style={S.spinner}/></div>}
          {!feedLoading&&following.length===0&&(
            <div style={{textAlign:"center",padding:"56px 20px"}}>
              <p style={{display:"flex",justifyContent:"center",marginBottom:12,color:"#ccc"}}><Heart width={48} height={48}/></p>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,marginBottom:18}}>Follow sellers to see their latest listings here</p>
              <button className="hbtn" style={{...S.hBtn,fontSize:13,padding:"12px 22px",border:"2px solid #111"}} onClick={()=>setShopTab("all")}>DISCOVER SELLERS →</button>
            </div>
          )}
          {!feedLoading&&following.length>0&&feedItems.length===0&&(
            <div style={{textAlign:"center",padding:"56px 20px",fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:800,color:"#bbb"}}>No new listings from sellers you follow yet.</div>
          )}
          {!feedLoading&&feedItems.length>0&&(
            <div style={S.grid} className="shop-grid">
              {feedItems.map((item,idx)=>{
                const accent=CARD_COLORS[idx%CARD_COLORS.length];
                return(
                  <article key={item.id} className="scard" style={{...S.card,borderColor:accent,opacity:item.sold?0.55:1}} onClick={()=>openDetail(item)}>
                    <Thumb src={item.image_url||(item.images&&item.images[0])||""} emoji={item.emoji||catEmoji(item.category)} accent={accent} gradient style={S.cardTop} className="card-top" emojiStyle={S.cardEmoji}>
                      {item.sold&&<div style={S.soldVeil}><span style={S.soldStamp}>SOLD</span></div>}
                    </Thumb>
                    <div style={S.cardBody} className="card-body">
                      <p style={{...S.cardCatLabel,color:accent}} className="card-cat">{item.category?.toUpperCase()}</p>
                      <p style={S.cardName} className="card-name">{item.name}</p>
                      <div style={S.cardFoot}><span style={{...S.cardPrice,color:accent}} className="card-price">{currencySymbol(item.currency)}{item.price}</span></div>
                    </div>
                    <div style={{...S.accentBar,background:accent}}/>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </>
    );
  }
  // Small "⚡ FAST SELLER" badge for sellers flagged fast_seller=true on their profile.
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
        onClick={e=>{e.stopPropagation();toggleFavourite(item);}}
        aria-label={mine?"Remove from wishlist":"Add to wishlist"}
        style={{display:"inline-flex",alignItems:"center",gap:4,background:"none",border:"none",padding:0,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:700,color:"#FF1493",letterSpacing:0.5,whiteSpace:"nowrap"}}
      >
        <Heart width={12} height={12} fill={mine?"#FF1493":"none"} color="#FF1493"/> {count}
      </button>
    );
  };
  return (
    <>
      <ShopTabs/>
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
        <div style={S.heroLeft} className="hero-left">
          <p style={S.heroTag}>THE MARKETPLACE FOR</p>
          <h1 style={S.heroH}><span style={S.heroLine1}>DESI</span><span style={S.heroLine2}>FITS</span><span style={S.heroLine3}>REHOMED.</span></h1>
          <p style={S.heroSub}>Buy or Resell South Asian fashion</p>
          <div style={S.heroCtas}>
            <button className="hbtn" style={S.heroBtnPrimary} onClick={()=>user?setView("add"):(setAuthMode("signup"),setView("auth"))}>LIST YOUR PIECE →</button>
            <button className="hbtn" style={S.heroBtnSecondary} onClick={()=>document.getElementById("grid-anchor")?.scrollIntoView({behavior:"smooth"})}><span style={{display:"inline-flex",alignItems:"center",gap:8}}>BROWSE DROPS <ArrowDown width={16} height={16}/></span></button>
          </div>
        </div>
        <div style={S.heroRight} className="hero-right">
          {[
            // Instead of forcing every picture into a fixed-size circle (which cropped heads or
            // left white rings whenever the disc wasn't a perfect square), we size each BUBBLE to
            // match its PICTURE. `size` is the on-screen width; the box height is derived from the
            // PNG's real pixel aspect ratio (`ar` = naturalHeight / naturalWidth) so the box is the
            // exact shape of the image. With objectFit:cover at that matching aspect there is no
            // crop at all — the full figure shows, head-to-hem — and borderRadius:50% rounds the
            // box into a clean disc-shaped bubble that hugs the colored circle with no white gap.
            {img:"/Images/sharara.png",     top:"2%",  left:"5%",  size:170, delay:"0s",   ar:1254/1254},
            {img:"/Images/indo_western.png",top:"30%", left:"55%", size:150, delay:"0.7s", ar:1254/1254},
            {img:"/Images/saree.png",       top:"55%", left:"8%",  size:175, delay:"1.4s", ar:1254/1254},
            {img:"/Images/menswear.png",    top:"8%",  left:"65%", size:130, delay:"2.1s", ar:1254/1254},
            {img:"/Images/lehenga.png",     top:"62%", left:"58%", size:148, delay:"2.8s", ar:1254/1254},
            {img:"/Images/anarkali.png",    top:"28%", left:"2%",  size:135, delay:"3.5s", ar:1254/1254},
          ].map((b,i)=>(
            <div key={i} className="hero-bubble" style={{position:"absolute",top:b.top,left:b.left,width:b.size,height:Math.round(b.size*b.ar),borderRadius:"50%",overflow:"hidden",animation:`floatbob 4s ease-in-out ${b.delay} infinite`,boxShadow:"0 12px 40px rgba(0,0,0,0.18)",border:"4px solid #111"}}>
              <img src={b.img} alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center"}}/>
            </div>
          ))}
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
          {user&&profile?.bust&&<button className="hbtn search-action-btn" style={{...S.filterBtn,background:showSizeMatch?"#34C759":"#fff",color:showSizeMatch?"#fff":"#111"}} onClick={()=>setShowSizeMatch(f=>!f)}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Ruler width={16} height={16}/> FIT</span></button>}
          {/* Phase 12 — SAVE THIS SEARCH. Appears once any filter or query is
              active. Logged-out buyers are prompted to log in on tap (handled in
              openSaveSearch). Outlined, 2px #111, no radius, Barlow Condensed. */}
          {hasFilters&&<button className="hbtn search-action-btn" style={{...S.filterBtn,background:"#fff",color:"#111",border:"2px solid #111"}} onClick={openSaveSearch}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Bookmark width={15} height={15}/> SAVE THIS SEARCH</span></button>}
          <button className="hbtn search-action-btn" style={{...S.filterBtn,background:"#fff",color:"#111"}} onClick={()=>{loadTailorMarket();setView("tailors");}}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Scissors width={16} height={16}/> TAILORS</span></button>
        </div>
        {(showSuggestions&&searchSuggestions.length>0)||(showSavedSearches&&savedSearches.length>0)?(
          <div style={{position:"absolute",top:"100%",left:10,width:"calc(100% - 20px)",maxWidth:560,background:"#fff",border:"2px solid #111",borderTop:"none",zIndex:200,maxHeight:280,overflowY:"auto"}}>
            {showSavedSearches&&savedSearches.length>0&&!search&&(
              <>
                <div style={{padding:"8px 14px",fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,fontWeight:900,letterSpacing:2,color:"#bbb",borderBottom:"1px solid #f0f0f0"}}>SAVED SEARCHES</div>
                {savedSearches.map(s=>(
                  <div key={s.id} style={{display:"flex",alignItems:"center",padding:"10px 14px",borderBottom:"1px solid #f5f5f5",cursor:"pointer",gap:10}}>
                    <span style={{display:"flex",alignItems:"center",color:"#FF1493"}}><Bookmark width={15} height={15} fill={s.email_alerts!==false?"#FF1493":"none"}/></span>
                    <span style={{flex:1,minWidth:0,fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,color:"#111",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} onMouseDown={()=>applySavedSearch(s)}>{(s.name&&s.name.trim())||filterSummary(s.filters)||s.query}</span>
                    <button style={{background:"none",border:"none",color:"#bbb",cursor:"pointer",fontSize:12,fontWeight:900,padding:"2px 6px"}} onClick={()=>deleteSavedSearch(s.id)}>✕</button>
                  </div>
                ))}
              </>
            )}
            {showSuggestions&&searchSuggestions.map((s,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",padding:"10px 14px",borderBottom:"1px solid #f5f5f5",cursor:"pointer",gap:10}} onMouseDown={()=>applySearch(s)}>
                <span style={{display:"flex",alignItems:"center",color:"#bbb"}}><Search width={15} height={15}/></span>
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
        {loading&&<div style={S.grid} className="shop-grid">{Array(8).fill(0).map((_,i)=><div key={i} style={{...S.card,borderColor:"#f0f0f0"}}><div style={{height:200,background:"linear-gradient(90deg,#f5f5f5 25%,#ececec 50%,#f5f5f5 75%)",backgroundSize:"200% 100%",animation:"shimmer 1.4s infinite"}}/><div style={{padding:"16px 18px",background:"#fff"}}><div style={{height:16,background:"#f0f0f0",borderRadius:2,marginBottom:8,width:"80%"}}/><div style={{height:20,background:"#f0f0f0",borderRadius:2,width:"30%"}}/></div></div>)}</div>}
        {error&&<div style={S.errorBanner}>{error}<button style={S.retryBtn} onClick={fetchItems}>RETRY</button></div>}
        {!loading&&!error&&(
          <div style={S.grid} className="shop-grid">
            {visible.map((item,idx)=>{
              const accent=CARD_COLORS[idx%CARD_COLORS.length];
              return(
                <article key={item.id} className="scard" style={{...S.card,opacity:item.sold?0.55:1}} onClick={()=>openDetail(item)}>
                  <Thumb src={item.image_url||(item.images&&item.images[0])||""} emoji={item.emoji||catEmoji(item.category)} accent={accent} gradient style={S.cardTop} className="card-top" emojiStyle={S.cardEmoji}>
                    {item.sold&&<div style={S.soldVeil}><span style={S.soldStamp}>SOLD</span></div>}
                    <PromotedLabel item={item}/>
                    {item.reserved&&!item.sold&&<div style={S.reservedBadge}>RESERVED</div>}
                    {item.prev_price>item.price&&<div style={S.priceDropBadge}>PRICE DROP</div>}
                    {fitsMe(item)===true&&<div style={{...S.fitsBadge,display:"inline-flex",alignItems:"center",gap:5}}><Ruler width={11} height={11}/> FITS YOU</div>}
                    <FastBadge sellerId={item.user_id} raised={fitsMe(item)===true}/>
                    <button aria-label={myWishlist.has(item.id)?"Remove from wishlist":"Add to wishlist"} style={{...S.heartBtn,background:myWishlist.has(item.id)?"#FF1493":"rgba(255,255,255,0.85)"}} onClick={e=>{e.stopPropagation();toggleFavourite(item);}}><Heart width={16} height={16} fill={myWishlist.has(item.id)?"#fff":"none"} color={myWishlist.has(item.id)?"#fff":"#111"}/></button>
                    <div style={S.cardOrigin}>{item.origin?.toUpperCase()}</div>
                    {!item.sold&&<BundleSaveBanner sellerId={item.user_id}/>}
                  </Thumb>
                  <div style={S.cardBody} className="card-body">
                    <p style={{...S.cardCatLabel,color:accent}} className="card-cat">{item.category?.toUpperCase()} · {(item.material||item.fabric)?.toUpperCase()}</p>
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
                        {item.views>0&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#bbb",letterSpacing:1,display:"inline-flex",alignItems:"center",gap:4}}><Eye width={12} height={12}/> {item.views}</span>}
                      </span>
                    </div>
                  </div>
                  <div style={{...S.accentBar,background:accent}}/>
                </article>
              );
            })}
            {visible.length===0&&(
              <div style={S.empty}>
                <p style={{display:"flex",justifyContent:"center"}}>{hasFilters?<Search width={60} height={60}/>:<Shirt width={60} height={60}/>}</p>
                <p style={{fontSize:28,fontWeight:900,margin:"12px 0 6px",fontFamily:"'Barlow Condensed',sans-serif"}}>{hasFilters?"NO RESULTS.":"NOTHING HERE YET."}</p>
                {hasFilters?<button className="hbtn" style={S.hBtn} onClick={clearFilters}>CLEAR FILTERS</button>:<button className="hbtn" style={S.hBtn} onClick={()=>user?setView("add"):(setAuthMode("signup"),setView("auth"))}>LIST IT →</button>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* NEW ARRIVALS — the 4 most recent listings (last 14 days). Horizontal
          scroll rail on mobile, grid on desktop. Hidden on the new-arrivals page
          itself, while filtering, and when there are no recent listings. */}
      {!newArrivals&&!hasFilters&&homeArrivals.length>0&&(
        <div style={{maxWidth:1300,margin:"48px auto 0",borderTop:"3px solid #111",padding:"32px 10px 0"}}>
          <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:16,marginBottom:20,flexWrap:"wrap"}}>
            <div>
              <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(28px,5vw,40px)",fontWeight:900,letterSpacing:-0.5,lineHeight:1,color:"#111",display:"flex",alignItems:"center",gap:10}}><Sparkles width={28} height={28}/> NEW ARRIVALS</h2>
              <p style={{fontFamily:"'Barlow',sans-serif",fontSize:14,color:"#888",marginTop:4}}>Fresh drops. Updated daily.</p>
            </div>
            <button className="hbtn" style={{background:"none",border:"none",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:2,color:"#FF1493",textTransform:"uppercase",display:"inline-flex",alignItems:"center",gap:6,padding:0}} onClick={goNewArrivals}>VIEW ALL <ArrowRight width={15} height={15}/></button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:3}} className="shop-grid">
            {homeArrivals.map((item,idx)=>{
              const accent=CARD_COLORS[idx%CARD_COLORS.length];
              return(
                <article key={item.id} className="scard" style={S.card} onClick={()=>openDetail(item)}>
                  <Thumb src={item.image_url||(item.images&&item.images[0])||""} emoji={item.emoji||catEmoji(item.category)} accent={accent} style={S.cardTop} className="card-top" emojiStyle={S.cardEmoji}>
                    <div style={{position:"absolute",top:12,left:12,background:"#34C759",color:"#fff",padding:"2px 8px",fontSize:9,fontWeight:800,letterSpacing:1.5,fontFamily:"'Barlow Condensed',sans-serif",zIndex:3}}>NEW</div>
                    <FastBadge sellerId={item.user_id}/>
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
        </div>
      )}

      {/* SHOP THE LOOK — curated outfit collections. Hidden entirely when no
          looks exist or while the buyer is filtering/searching the grid. The rail
          scrolls horizontally on mobile and is a 3-up grid on desktop. */}
      {!newArrivals&&!hasFilters&&looks.length>0&&(
        <div style={{maxWidth:1300,margin:"48px auto 0",borderTop:"3px solid #111",padding:"32px 10px 0"}}>
          <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:16,marginBottom:20,flexWrap:"wrap"}}>
            <div>
              <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(28px,5vw,40px)",fontWeight:900,letterSpacing:-0.5,lineHeight:1,color:"#111"}}>SHOP THE LOOK</h2>
              <p style={{fontFamily:"'Barlow',sans-serif",fontSize:14,color:"#888",marginTop:4}}>Complete outfits, all pre-loved</p>
            </div>
            <button className="hbtn" style={{background:"none",border:"none",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:2,color:"#FF1493",textTransform:"uppercase",display:"inline-flex",alignItems:"center",gap:6,padding:0}} onClick={()=>setView("looks")}>VIEW ALL <ArrowRight width={15} height={15}/></button>
          </div>
          <div className="looks-grid looks-rail">
            {looks.slice(0,6).map(look=><LookCard key={look.id} look={look} onOpen={openLook}/>)}
          </div>
        </div>
      )}

      {/* STYLE INSPIRATION — homepage style-feed preview. Hidden when no posts
          exist or while the buyer is filtering/searching the grid. */}
      {!newArrivals&&!hasFilters&&homeStylePosts.length>0&&(
        <StyleInspiration posts={homeStylePosts} profilesMap={homeStyleProfiles} onOpen={openStyleFeed} />
      )}

      {/* NEW IN */}
      {!newArrivals&&!hasFilters&&newListings.length>0&&(
        <div style={{maxWidth:1300,margin:"48px auto 0",borderTop:"3px solid #111",padding:"32px 10px 0"}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #34C759",paddingLeft:12,marginBottom:20,display:"flex",alignItems:"center",gap:8}}><Sparkles width={16} height={16}/> NEW IN — LAST 48 HOURS</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:3}} className="shop-grid">
            {newListings.slice(0,8).map((item,idx)=>{
              const accent=CARD_COLORS[idx%CARD_COLORS.length];
              return(
                <article key={item.id} className="scard" style={S.card} onClick={()=>openDetail(item)}>
                  <Thumb src={item.image_url||(item.images&&item.images[0])||""} emoji={item.emoji||catEmoji(item.category)} accent={accent} style={S.cardTop} className="card-top" emojiStyle={S.cardEmoji}>
                    <div style={{position:"absolute",top:12,left:12,background:"#34C759",color:"#fff",padding:"2px 8px",fontSize:9,fontWeight:800,letterSpacing:1.5,fontFamily:"'Barlow Condensed',sans-serif",zIndex:3}}>NEW</div>
                    <FastBadge sellerId={item.user_id}/>
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
        </div>
      )}

      {/* PRICE DROPS */}
      {!newArrivals&&!hasFilters&&priceDrops.length>0&&(
        <div style={{maxWidth:1300,margin:"48px auto 0",borderTop:"3px solid #111",padding:"32px 10px 0"}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #FF9500",paddingLeft:12,marginBottom:20,display:"flex",alignItems:"center",gap:8}}><TrendingDown width={16} height={16}/> PRICE DROPS</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:3}} className="shop-grid">
            {priceDrops.slice(0,8).map((item,idx)=>{
              const accent=CARD_COLORS[idx%CARD_COLORS.length];
              const drop=item.prev_price?Math.round(((item.prev_price-item.price)/item.prev_price)*100):0;
              return(
                <article key={item.id} className="scard" style={S.card} onClick={()=>openDetail(item)}>
                  <Thumb src={item.image_url||(item.images&&item.images[0])||""} emoji={item.emoji||catEmoji(item.category)} accent={accent} style={S.cardTop} className="card-top" emojiStyle={S.cardEmoji}>
                    {drop>0&&<div style={{position:"absolute",top:12,left:12,background:"#FF9500",color:"#fff",padding:"2px 8px",fontSize:9,fontWeight:800,letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif",zIndex:3}}>-{drop}%</div>}
                    <FastBadge sellerId={item.user_id}/>
                  </Thumb>
                  <div style={S.cardBody} className="card-body">
                    <p style={{...S.cardCatLabel,color:accent}} className="card-cat">{item.category?.toUpperCase()}</p>
                    <p style={S.cardName} className="card-name">{item.name}</p>
                    <div style={S.cardFoot}>
                      <span style={{display:"flex",alignItems:"baseline"}}>
                        <span style={{...S.cardPrice,color:accent}} className="card-price">{currencySymbol(item.currency)}{item.price}</span>
                        {item.prev_price&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,color:"#bbb",textDecoration:"line-through",marginLeft:6}}>{currencySymbol(item.currency)}{item.prev_price}</span>}
                      </span>
                      <span style={{display:"flex",alignItems:"center",gap:8}}><WishCount item={item}/><SellerRating sellerId={item.user_id}/></span>
                    </div>
                  </div>
                  <div style={{...S.accentBar,background:accent}}/>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* TRENDING */}
      {!newArrivals&&!hasFilters&&trendingItems.length>0&&(
        <div style={{maxWidth:1300,margin:"48px auto 48px",borderTop:"3px solid #111",padding:"32px 10px 0"}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #BF5AF2",paddingLeft:12,marginBottom:20,display:"flex",alignItems:"center",gap:8}}><Flame width={16} height={16}/> TRENDING — MOST VIEWED</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:3}} className="shop-grid">
            {trendingItems.slice(0,8).map((item,idx)=>{
              const accent=CARD_COLORS[idx%CARD_COLORS.length];
              return(
                <article key={item.id} className="scard" style={S.card} onClick={()=>openDetail(item)}>
                  <Thumb src={item.image_url||(item.images&&item.images[0])||""} emoji={item.emoji||catEmoji(item.category)} accent={accent} style={S.cardTop} className="card-top" emojiStyle={S.cardEmoji}>
                    <div style={{position:"absolute",top:12,left:12,background:"#BF5AF2",color:"#fff",padding:"2px 8px",fontSize:9,fontWeight:800,letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif",zIndex:3,display:"inline-flex",alignItems:"center",gap:4}}><Eye width={11} height={11}/> {item.views}</div>
                    <FastBadge sellerId={item.user_id}/>
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
        </div>
      )}
    </>
  );
}
