import React from "react";
import { Shirt, Gift, Eye, Check, Star, Share2, Copy, Download, Plane, Rocket, Bell, X, Twitter, MessageCircle, Instagram, CheckSquare, Square, Plus, Layers, Flag, AlertCircle, ExternalLink, BadgeCheck, Clock, ShieldCheck, Store, Image as ImageIcon, MapPin, Zap, TrendingUp, Tag, MessageSquare, Hourglass, Scissors, Wallet, RefreshCw } from "lucide-react";
import { CARD_COLORS, catEmoji, currencySymbol, lookListings, lookTotal, turnaroundLabel } from "../lib/constants";
import { S } from "../styles";
import { Sec, F, Thumb, VerifiedBadge, IDVerifiedBadge } from "../components/Shared";
import Analytics from "./Analytics";

// Phase 10d — public URL for a listing, used by Share (copy link / socials) and
// the share-card download. Falls back to the live domain when there's no origin.
const listingUrl = (id) => `${(typeof window!=="undefined"&&window.location&&window.location.origin)||"https://stitchd.fit"}/?listing=${id}`;

// Render the share card to a PNG and trigger a download. Pure-canvas (no html2canvas
// dependency) so the build needs nothing extra. The listing photo is drawn with
// crossOrigin so the canvas isn't tainted where the storage bucket sends CORS
// headers; if it IS tainted, toBlob throws and we fall back to a Copy-Link message.
function downloadShareCard(item, onError){
  const W=1080, PAD=48;
  const canvas=document.createElement("canvas");
  const ctx=canvas.getContext("2d");
  const draw=(img)=>{
    const imgH=img?Math.min(1080, Math.round((img.naturalHeight/img.naturalWidth)*W)):0;
    const H=imgH+360;
    canvas.width=W; canvas.height=H;
    ctx.fillStyle="#fff"; ctx.fillRect(0,0,W,H);
    if(img){ ctx.drawImage(img,0,0,W,imgH); }
    else { ctx.fillStyle="#111"; ctx.fillRect(0,0,W,1); }
    // wordmark top-right
    ctx.fillStyle="#111"; ctx.textAlign="right"; ctx.font="900 34px 'Barlow Condensed', sans-serif";
    ctx.fillText("STITCH'D", W-PAD, (img?imgH:0)+64);
    ctx.textAlign="left";
    let y=(img?imgH:0)+120;
    ctx.fillStyle="#111"; ctx.font="900 56px 'Barlow Condensed', sans-serif";
    ctx.fillText((item.name||"Untitled").slice(0,28), PAD, y);
    y+=80;
    ctx.fillStyle="#FF1493"; ctx.font="900 72px 'Barlow Condensed', sans-serif";
    ctx.fillText(`${currencySymbol(item.currency)}${item.price}`, PAD, y);
    y+=64;
    ctx.fillStyle="#777"; ctx.font="700 30px 'Barlow Condensed', sans-serif";
    ctx.fillText("Available on STITCH'D", PAD, y);
    ctx.fillStyle="#111"; ctx.font="700 26px 'Barlow Condensed', sans-serif";
    ctx.fillText("stitchd.fit", PAD, H-40);
    // outer border
    ctx.strokeStyle="#111"; ctx.lineWidth=8; ctx.strokeRect(0,0,W,H);
    try{
      canvas.toBlob((blob)=>{
        if(!blob){ onError&&onError(); return; }
        const a=document.createElement("a");
        a.href=URL.createObjectURL(blob);
        a.download=`stitchd-${(item.name||"listing").toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,40)}.png`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      },"image/png");
    }catch(e){ onError&&onError(); }
  };
  const src=item.image_url||(item.images&&item.images[0])||"";
  if(!src){ draw(null); return; }
  const img=new Image();
  img.crossOrigin="anonymous";
  img.onload=()=>draw(img);
  img.onerror=()=>draw(null);
  img.src=src;
}

export default function Dashboard({
  view, setView, user, myItems,
  sellerRatings = {},
  // analytics (Phase 10c)
  myOrders = [], wishlistCounts = {}, openDetail, startOrderConversation,
  // dashboard
  setSel, openEdit, markSold, del,
  // seller tools (Phase 10d)
  profile, flash = () => {}, bulkUpdateListings, relistCopy,
  toggleVacation, vacationSaving, notifyPromote, promoteNotified,
  // Bundle discount (Phase 14)
  saveBundleDiscount = () => {},
  // Promoted listings (Phase 13)
  startPromote = () => {}, promoteBusyId = null, myPromotions = [],
  bundles, bundleItems, loadBundles, deleteBundle,
  // createbundle
  bundleForm, setBundleForm, toggleBundleListing, createBundle,
  // Shop the Look (Phase 10e)
  myLooks = [], isAdmin = false, openCreateLook = () => {}, editLook = () => {}, deleteLook = () => {},
  // Admin panel (Phase 11)
  adminReports = [], adminDisputes = [], adminNames = {},
  markReportResolved = () => {}, updateDisputeStatus = () => {},
  // Verified seller badges (Phase 11)
  myVerificationApp = null, verificationBusy = false, submitVerification = () => {},
  adminApplications = [], adminApplicants = {},
  approveVerification = () => {}, rejectVerification = () => {},
  // ID verification (Phase 11 — Stripe Identity)
  verifyIdentity = () => {}, identityBusy = false,
  requestTab = null, clearRequestTab = () => {},
  // Edit storefront (Phase 13)
  storeForm = {}, setStoreForm = () => {}, saveStorefront = () => {}, storeSaving = false,
  // Seller responds to offers (Phase 14)
  sellerOffers = [], offerBuyers = {}, acceptOffer = () => {}, declineOffer = () => {},
  // Tailor applications (Phase 15 — admin)
  adminTailors = [], approveTailor = () => {}, rejectTailor = () => {}, openTailorPublic = () => {},
  // Tailor payouts oversight (Phase 15 — admin)
  adminPayouts = [], retryPayout = () => {},
}) {
  // Split listings into ACTIVE vs SOLD (issue PART 4 — sold listings move to a
  // separate SOLD tab in the seller dashboard).
  const [dashTab,setDashTab]=React.useState("active");
  // Phase 11 — allow other views to deep-link to a tab (e.g. the listing form's
  // over-£200 prompt jumps straight to TOOLS for identity verification).
  React.useEffect(()=>{ if(requestTab){ setDashTab(requestTab); clearRequestTab(); } },[requestTab,clearRequestTab]);
  // The seller's own overall rating, shown as a stat tile when they have reviews.
  const myRating = user ? sellerRatings[user.id] : null;

  // ── Phase 14 — bundle discount form (TOOLS tab) ──────────────────────────────
  // Seeded from the profile and kept in sync when the profile loads/changes.
  const [bundleOn,setBundleOn]=React.useState(!!profile?.bundle_discount_enabled);
  const [bundlePct,setBundlePct]=React.useState(profile?.bundle_discount_percentage||10);
  const [bundleSaving,setBundleSaving]=React.useState(false);
  React.useEffect(()=>{
    setBundleOn(!!profile?.bundle_discount_enabled);
    setBundlePct(profile?.bundle_discount_percentage||10);
  },[profile?.bundle_discount_enabled,profile?.bundle_discount_percentage]);
  async function doSaveBundleDiscount(){
    if(bundleSaving) return;
    setBundleSaving(true);
    try{ await saveBundleDiscount(bundleOn,bundlePct); }
    finally{ setBundleSaving(false); }
  }

  // ── Phase 10d state ──────────────────────────────────────────────────────────
  const [bulkMode,setBulkMode]=React.useState(false);     // bulk-edit selection mode
  const [selectedIds,setSelectedIds]=React.useState([]);  // checked listing ids
  const [priceModal,setPriceModal]=React.useState(false); // bulk EDIT PRICE modal
  const [bulkPrice,setBulkPrice]=React.useState("");
  const [bulkBusy,setBulkBusy]=React.useState(false);
  const [shareItem,setShareItem]=React.useState(null);    // listing shown in share modal
  const [promoteItem,setPromoteItem]=React.useState(null);// listing shown in PROMOTE modal (Phase 13)
  const [relistItem,setRelistItem]=React.useState(null);  // listing shown in relist confirm
  const [relistBusy,setRelistBusy]=React.useState(false);
  const [copied,setCopied]=React.useState(false);

  // ── Phase 11 — verified seller badges ────────────────────────────────────────
  const [verifyModal,setVerifyModal]=React.useState(false);  // APPLY FOR VERIFICATION modal
  const [verifyForm,setVerifyForm]=React.useState({full_name:"",reason:"",selling_experience:"Less than 6 months",instagram_handle:""});
  const [adminAppTab,setAdminAppTab]=React.useState("pending"); // admin PENDING/APPROVED/REJECTED
  const [rejectApp,setRejectApp]=React.useState(null);       // application being rejected
  const [rejectNotes,setRejectNotes]=React.useState("");

  // ── Phase 14 — seller responds to offers ─────────────────────────────────────
  const [offerTab,setOfferTab]=React.useState("pending");   // PENDING/ACCEPTED/DECLINED/EXPIRED filter
  const [acceptModal,setAcceptModal]=React.useState(null);  // offer pending an ACCEPT confirm
  const [declineModal,setDeclineModal]=React.useState(null);// offer pending a DECLINE confirm
  const [counterPrice,setCounterPrice]=React.useState("");  // optional counter in the decline modal
  const [offerBusy,setOfferBusy]=React.useState(false);

  // An offer's effective status: a 'pending' row whose 48h deadline has passed
  // reads as EXPIRED in the UI even before the hourly cron sweeps it.
  const effectiveStatus=(o)=>{
    if(o.status==="pending"&&o.expires_at&&new Date(o.expires_at).getTime()<=Date.now()) return "expired";
    return o.status;
  };
  // Withdrawn offers (buyer pulled out) aren't a tab — hide them everywhere.
  const visibleOffers=sellerOffers.filter(o=>effectiveStatus(o)!=="withdrawn");
  const pendingCount=visibleOffers.filter(o=>effectiveStatus(o)==="pending").length;
  const buyerFirstName=(o)=>{ const p=offerBuyers[o.buyer_id]||{}; const name=(p.full_name||p.username||"").trim(); return name?name.split(/\s+/)[0]:"a buyer"; };
  const confirmAccept=async()=>{ if(!acceptModal||offerBusy) return; setOfferBusy(true); const ok=await acceptOffer(acceptModal); setOfferBusy(false); if(ok){ setAcceptModal(null); setOfferTab("accepted"); } };
  const confirmDecline=async()=>{ if(!declineModal||offerBusy) return; setOfferBusy(true); const ok=await declineOffer(declineModal,counterPrice); setOfferBusy(false); if(ok){ setDeclineModal(null); setCounterPrice(""); setOfferTab("declined"); } };

  const openVerifyModal=()=>{ setVerifyForm({full_name:profile?.full_name||"",reason:"",selling_experience:"Less than 6 months",instagram_handle:""}); setVerifyModal(true); };
  const submitVerifyForm=async()=>{ const ok=await submitVerification(verifyForm); if(ok) setVerifyModal(false); };
  const confirmReject=async()=>{ if(!rejectApp) return; await rejectVerification(rejectApp,rejectNotes.trim()); setRejectApp(null); setRejectNotes(""); };

  const activeItems=myItems.filter(i=>!i.sold);
  // Phase 13 — a listing's boost is live only while promoted is set AND
  // promoted_until is still in the future.
  const isPromoted=(i)=>!!i.promoted&&!!i.promoted_until&&new Date(i.promoted_until).getTime()>Date.now();
  const promotedUntilLabel=(i)=>i.promoted_until?new Date(i.promoted_until).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}):"";
  const allActiveSelected=activeItems.length>0&&selectedIds.length===activeItems.length;

  const toggleSelect=(id)=>setSelectedIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  const selectAll=()=>setSelectedIds(allActiveSelected?[]:activeItems.map(i=>i.id));
  const exitBulk=()=>{ setBulkMode(false); setSelectedIds([]); setPriceModal(false); setBulkPrice(""); };

  const runBulk=async(patch)=>{
    if(!selectedIds.length||bulkBusy) return;
    setBulkBusy(true);
    const ok=await bulkUpdateListings(selectedIds,patch);
    setBulkBusy(false);
    if(ok){ const n=selectedIds.length; exitBulk(); flash(`${n} listing${n!==1?"s":""} updated.`); }
  };
  const applyBulkPrice=async()=>{
    const p=parseFloat(bulkPrice);
    if(isNaN(p)||p<0){ flash("Enter a valid price."); return; }
    await runBulk({price:p});
  };
  const confirmRelist=async()=>{
    if(!relistItem||relistBusy) return;
    setRelistBusy(true);
    const ok=await relistCopy(relistItem);
    setRelistBusy(false);
    setRelistItem(null);
    if(ok) setDashTab("active");
  };
  const copyLink=(item)=>{
    const url=listingUrl(item.id);
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(url).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),1800); }).catch(()=>flash("Couldn't copy link."));
    } else { flash("Copy not supported — link: "+url); }
  };

  if(view!=="dashboard"&&view!=="createbundle") return null;

  // Reusable Lucide-icon button used across the dashboard card action rows.
  const TabBtn=({l,v,n,activeBg="#111"})=>(
    <button key={v} className="hbtn" style={{...S.hBtn,background:dashTab===v?activeBg:"#fff",color:dashTab===v?"#fff":"#111",border:"2px solid #111",fontSize:12,padding:"8px 18px"}} onClick={()=>setDashTab(v)}>{l}{n!=null?` (${n})`:""}</button>
  );

  return (
    <>
      {/* DASHBOARD */}
      {view==="dashboard"&&user&&(
        <main style={S.main}>
          <button style={S.back} onClick={()=>setView("shop")}>← BACK TO SHOP</button>
          <div style={S.dashHeader}>
            <div><p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:4,color:"#FF1493",marginBottom:8}}>YOUR CLOSET</p><h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:48,fontWeight:900,letterSpacing:-1,lineHeight:1}}>MY DROPS</h2>{profile?.verified&&<div style={{marginTop:10}}><VerifiedBadge/></div>}</div>
            <div style={S.dashStats}>
              <div style={{...S.dashStat,borderTop:"4px solid #FF1493"}}><div style={{...S.dashStatNum,color:"#FF1493"}}>{myItems.length}</div><div style={S.dashStatLabel}>TOTAL</div></div>
              <div style={{...S.dashStat,borderTop:"4px solid #34C759"}}><div style={{...S.dashStatNum,color:"#34C759"}}>{myItems.filter(i=>!i.sold).length}</div><div style={S.dashStatLabel}>LIVE</div></div>
              <div style={{...S.dashStat,borderTop:"4px solid #FF9500"}}><div style={{...S.dashStatNum,color:"#FF9500"}}>{myItems.filter(i=>i.sold).length}</div><div style={S.dashStatLabel}>SOLD</div></div>
              <div style={{...S.dashStat,borderTop:"4px solid #00B3A3"}}><div style={{...S.dashStatNum,color:"#00B3A3"}}>£{myItems.filter(i=>i.sold).reduce((a,i)=>a+i.price,0)}</div><div style={S.dashStatLabel}>EARNED</div></div>
              <div style={{...S.dashStat,borderTop:"4px solid #BF5AF2"}}><div style={{...S.dashStatNum,color:"#BF5AF2"}}>{myItems.reduce((a,i)=>a+(i.views||0),0)}</div><div style={S.dashStatLabel}>VIEWS</div></div>
              {myRating&&myRating.count>0&&(
                <div style={{...S.dashStat,borderTop:"4px solid #FF1493"}}>
                  <div style={{...S.dashStatNum,color:"#FF1493",display:"inline-flex",alignItems:"center",gap:6}}><Star width={22} height={22} fill="currentColor"/> {myRating.average.toFixed(1)}</div>
                  <div style={S.dashStatLabel}>{myRating.count} REVIEW{myRating.count!==1?"S":""}</div>
                </div>
              )}
            </div>
          </div>
          {/* Banner shown while the seller is on vacation (Tool 2). */}
          {profile?.vacation_mode&&(
            <div style={{display:"flex",alignItems:"center",gap:10,background:"#FF1493",color:"#fff",border:"2px solid #111",padding:"12px 16px",marginBottom:20,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:0.5,fontSize:14}}>
              <Plane width={18} height={18}/> Your listings are hidden. Toggle vacation mode off in TOOLS to make them visible again.
            </div>
          )}
          {myItems.length===0?(
            <div style={S.empty}><div style={S.emptyIcon}><Shirt width={40} height={40}/></div><p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:30,fontWeight:900,margin:"20px 0 6px",letterSpacing:-0.5}}>NO LISTINGS YET.</p><p style={S.emptySub}>List your first piece and it'll show up here — with stats, offers and tools to manage it.</p><button className="hbtn" style={S.hBtn} onClick={()=>setView("add")}>LIST YOUR FIRST PIECE →</button></div>
          ):(()=>{
            const tabItems=dashTab==="sold"?myItems.filter(i=>i.sold):dashTab==="active"?activeItems:[];
            return (
            <>
            <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
              <TabBtn l="ACTIVE" v="active" n={activeItems.length}/>
              <TabBtn l="SOLD" v="sold" n={myItems.filter(i=>i.sold).length}/>
              {/* Phase 14 — OFFERS tab. Count badge shows pending offers only. */}
              <TabBtn l="OFFERS" v="offers" n={pendingCount>0?pendingCount:null} activeBg="#FF1493"/>
              {/* Phase 10c — ANALYTICS sits alongside ACTIVE / SOLD; active state uses the pink accent. */}
              <TabBtn l="ANALYTICS" v="analytics" n={null} activeBg="#FF1493"/>
              {/* Phase 10d — TOOLS tab. */}
              <TabBtn l="TOOLS" v="tools" n={null} activeBg="#00E5CC"/>
              {/* Phase 11 — ADMIN tab, only for the Stitch'd admin. */}
              {isAdmin&&<TabBtn l="ADMIN" v="admin" n={null} activeBg="#FF1493"/>}
            </div>

            {/* Phase 10d — BULK EDIT toolbar above the ACTIVE grid. */}
            {dashTab==="active"&&activeItems.length>0&&(
              <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
                {!bulkMode?(
                  <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111",fontSize:12,padding:"8px 16px",display:"inline-flex",alignItems:"center",gap:6}} onClick={()=>setBulkMode(true)}><CheckSquare width={15} height={15}/> BULK EDIT</button>
                ):(
                  <>
                    <button className="hbtn" style={{...S.hBtn,background:allActiveSelected?"#FF1493":"#fff",color:allActiveSelected?"#fff":"#111",border:"2px solid #111",fontSize:12,padding:"8px 16px",display:"inline-flex",alignItems:"center",gap:6}} onClick={selectAll}>{allActiveSelected?<CheckSquare width={15} height={15}/>:<Square width={15} height={15}/>} SELECT ALL</button>
                    <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#FF1493",border:"2px solid #FF1493",fontSize:12,padding:"8px 16px"}} onClick={exitBulk}>CANCEL</button>
                  </>
                )}
              </div>
            )}

            {dashTab==="analytics"?(
              <Analytics
                user={user} myItems={myItems} orders={myOrders}
                wishlistCounts={wishlistCounts} sellerRatings={sellerRatings}
                openDetail={openDetail} messageBuyer={startOrderConversation}
                promotions={myPromotions}
                onPromoteAgain={(listingId)=>{ const l=myItems.find(i=>i.id===listingId); if(l) setPromoteItem(l); }}
              />
            ):dashTab==="tools"?(
              /* ── TOOLS TAB (Storefront + Verification + Vacation mode + Promote) ─ */
              <div style={{display:"flex",flexDirection:"column",gap:3,maxWidth:680}}>
                {/* Phase 13 — EDIT STOREFRONT. Banner upload + tagline/bio/location/
                    Instagram, a PREVIEW STOREFRONT link (opens the public page in a
                    new tab) and a pink SAVE CHANGES button. */}
                <div style={{border:"2px solid #111",padding:"24px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <Store width={20} height={20} color="#FF1493"/>
                    <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:0.5}}>EDIT STOREFRONT</h3>
                  </div>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,color:"#666",marginBottom:18,lineHeight:1.4}}>Customise your public storefront — the page buyers see when they tap your name.</p>

                  {/* Banner upload */}
                  <div style={{marginBottom:18}}>
                    <label style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:800,color:"#6b6b6b",letterSpacing:1.5,textTransform:"uppercase",display:"block",marginBottom:8}}>BANNER IMAGE</label>
                    <div onClick={()=>document.getElementById("storefront-banner-input").click()} style={{width:"100%",height:140,border:"2px solid #111",borderRadius:0,cursor:"pointer",background:storeForm.bannerPreview?`#FF1493 url(${storeForm.bannerPreview}) center/cover no-repeat`:"#FF1493",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {!storeForm.bannerPreview&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:800,letterSpacing:1,color:"#fff",display:"inline-flex",alignItems:"center",gap:8}}><ImageIcon width={18} height={18}/> UPLOAD BANNER</span>}
                    </div>
                    <input id="storefront-banner-input" type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f)setStoreForm(s=>({...s,bannerFile:f,bannerPreview:URL.createObjectURL(f)}));}}/>
                    {storeForm.bannerPreview&&<button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#FF1493",border:"2px solid #FF1493",fontSize:11,padding:"6px 12px",marginTop:8}} onClick={()=>setStoreForm(s=>({...s,bannerFile:null,bannerPreview:"",storefront_banner_url:""}))}>REMOVE BANNER</button>}
                  </div>

                  <div style={{display:"flex",flexDirection:"column",gap:14}}>
                    <F l={`TAGLINE (${(storeForm.storefront_tagline||"").length}/80)`}>
                      <input style={S.inp} maxLength={80} placeholder="Pre-loved South Asian fashion from London" value={storeForm.storefront_tagline||""} onChange={e=>setStoreForm(s=>({...s,storefront_tagline:e.target.value.slice(0,80)}))}/>
                    </F>
                    <F l={`BIO (${(storeForm.storefront_bio||"").length}/300)`}>
                      <textarea style={{...S.inp,height:90,resize:"vertical"}} maxLength={300} placeholder="Tell buyers about yourself and your style..." value={storeForm.storefront_bio||""} onChange={e=>setStoreForm(s=>({...s,storefront_bio:e.target.value.slice(0,300)}))}/>
                    </F>
                    <F l="LOCATION">
                      <div style={{position:"relative"}}><span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#6b6b6b",pointerEvents:"none"}}><MapPin width={15} height={15}/></span><input style={{...S.inp,paddingLeft:34}} placeholder="London, UK" value={storeForm.storefront_location||""} onChange={e=>setStoreForm(s=>({...s,storefront_location:e.target.value}))}/></div>
                    </F>
                    <F l="INSTAGRAM HANDLE">
                      <div style={{position:"relative"}}><span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#6b6b6b",pointerEvents:"none"}}><Instagram width={15} height={15}/></span><input style={{...S.inp,paddingLeft:34}} placeholder="@yourhandle" value={storeForm.storefront_instagram||""} onChange={e=>setStoreForm(s=>({...s,storefront_instagram:e.target.value}))}/></div>
                    </F>
                  </div>

                  <div style={{display:"flex",gap:10,marginTop:20,flexWrap:"wrap"}}>
                    {user&&<button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111",borderRadius:0,fontSize:13,padding:"12px 20px",display:"inline-flex",alignItems:"center",gap:7}} onClick={()=>window.open(`/?seller=${user.id}`,"_blank")}><ExternalLink width={15} height={15}/> PREVIEW STOREFRONT</button>}
                    <button className="hbtn" style={{...S.hBtn,background:"#FF1493",color:"#fff",border:"2px solid #111",borderRadius:0,fontSize:13,padding:"12px 20px",opacity:storeSaving?0.5:1}} disabled={storeSaving} onClick={saveStorefront}>{storeSaving?"SAVING…":"SAVE CHANGES"}</button>
                  </div>
                </div>

                {/* Phase 11 — VERIFICATION. The body switches on verification_status:
                    unverified → GET VERIFIED apply CTA; pending → under review;
                    verified → the badge + verified-since date; rejected → reapply
                    after 30 days from the application's reviewed_at. */}
                {(()=>{
                  const status=profile?.verification_status||"unverified";
                  const reviewedAt=myVerificationApp?.reviewed_at?new Date(myVerificationApp.reviewed_at):null;
                  const daysSince=reviewedAt?Math.floor((Date.now()-reviewedAt.getTime())/86400000):null;
                  const canReapply=daysSince==null||daysSince>=30;
                  const verifiedDate=profile?.verified_at?new Date(profile.verified_at).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}):null;
                  const H=({children})=> <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:0.5}}>{children}</h3>;
                  const Desc=({children})=> <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,color:"#666",marginBottom:18,lineHeight:1.4}}>{children}</p>;
                  return (
                    <div style={{border:"2px solid #111",padding:"24px"}}>
                      {status==="verified"?(
                        <>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
                            <VerifiedBadge/>
                            <H>YOU'RE VERIFIED</H>
                          </div>
                          <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,color:"#666",lineHeight:1.4}}>Your verified badge now appears on your profile and every listing.{verifiedDate?` Verified since ${verifiedDate}.`:""}</p>
                        </>
                      ):status==="pending"?(
                        <>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                            <Clock width={20} height={20} color="#00E5CC"/>
                            <H>APPLICATION UNDER REVIEW</H>
                          </div>
                          <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,color:"#666",lineHeight:1.4}}>We'll notify you within 3 working days.</p>
                        </>
                      ):status==="rejected"?(
                        <>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                            <AlertCircle width={20} height={20} color="#FF1493"/>
                            <H>APPLICATION UNSUCCESSFUL</H>
                          </div>
                          <Desc>You can reapply after 30 days.{!canReapply&&daysSince!=null?` (${30-daysSince} day${30-daysSince!==1?"s":""} to go)`:""}</Desc>
                          {canReapply&&(
                            <button className="hbtn" style={{...S.hBtn,background:"#FF1493",color:"#fff",border:"2px solid #111",borderRadius:0,fontSize:13,padding:"12px 22px",display:"inline-flex",alignItems:"center",gap:7}} onClick={openVerifyModal}><BadgeCheck width={16} height={16}/> REAPPLY</button>
                          )}
                        </>
                      ):(
                        <>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                            <BadgeCheck width={20} height={20} color="#00E5CC"/>
                            <H>GET VERIFIED</H>
                          </div>
                          <Desc>Verified sellers get a badge on their profile and listings, building trust with buyers.</Desc>
                          <div style={{display:"flex",flexDirection:"column",gap:9,marginBottom:20}}>
                            {["Verified badge on all your listings","Priority placement in search results","Increased buyer trust and conversions"].map(b=>(
                              <span key={b} style={{display:"flex",alignItems:"center",gap:10,fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,letterSpacing:0.5,color:"#111",lineHeight:1.2}}><Check width={16} height={16} color="#00E5CC" style={{flexShrink:0}}/> {b}</span>
                            ))}
                          </div>
                          <button className="hbtn" style={{...S.hBtn,background:"#FF1493",color:"#fff",border:"2px solid #111",borderRadius:0,fontSize:13,padding:"12px 22px",display:"inline-flex",alignItems:"center",gap:7}} onClick={openVerifyModal}><BadgeCheck width={16} height={16}/> APPLY FOR VERIFICATION</button>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Phase 11 — IDENTITY VERIFICATION (Stripe Identity). Separate from
                    the verified-seller badge above. Body switches on
                    identity_verification_status: unverified → CTA; pending → in
                    progress; verified → badge + date; failed → try again. */}
                {(()=>{
                  const istatus=profile?.identity_verification_status||(profile?.identity_verified?"verified":"unverified");
                  const idDate=profile?.identity_verified_at?new Date(profile.identity_verified_at).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}):null;
                  const H=({children})=> <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:0.5}}>{children}</h3>;
                  const Desc=({children})=> <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,color:"#666",marginBottom:18,lineHeight:1.4}}>{children}</p>;
                  const idBtn={background:"#111",color:"#fff",border:"2px solid #111",borderRadius:0,fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:2,padding:"12px 22px",display:"inline-flex",alignItems:"center",gap:7,cursor:identityBusy?"not-allowed":"pointer",opacity:identityBusy?0.5:1,textTransform:"uppercase"};
                  return (
                    <div style={{border:"2px solid #111",padding:"24px"}}>
                      {istatus==="verified"?(
                        <>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
                            <IDVerifiedBadge/>
                            <H>IDENTITY VERIFIED</H>
                          </div>
                          <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,color:"#666",lineHeight:1.4}}>Your ID VERIFIED badge is live on your profile and listings.{idDate?` Verified on ${idDate}.`:""}</p>
                        </>
                      ):istatus==="pending"?(
                        <>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                            <Clock width={20} height={20} color="#111"/>
                            <H>VERIFICATION IN PROGRESS</H>
                          </div>
                          <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,color:"#666",lineHeight:1.4}}>This usually takes a few minutes.</p>
                        </>
                      ):istatus==="failed"?(
                        <>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                            <AlertCircle width={20} height={20} color="#FF1493"/>
                            <H>VERIFICATION FAILED</H>
                          </div>
                          <Desc>Please try again or contact support.</Desc>
                          <button type="button" className="hbtn" style={idBtn} onClick={()=>!identityBusy&&verifyIdentity()} disabled={identityBusy}><ShieldCheck width={16} height={16}/> {identityBusy?"STARTING…":"TRY AGAIN"}</button>
                        </>
                      ):(
                        <>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                            <ShieldCheck width={20} height={20} color="#111"/>
                            <H>VERIFY YOUR IDENTITY</H>
                          </div>
                          <Desc>Add an extra layer of trust by verifying your identity. Required for selling items over £200.</Desc>
                          <button type="button" className="hbtn" style={idBtn} onClick={()=>!identityBusy&&verifyIdentity()} disabled={identityBusy}><ShieldCheck width={16} height={16}/> {identityBusy?"STARTING…":"VERIFY MY IDENTITY"}</button>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Shop the Look — create & manage curated outfits (Phase 10e) */}
                <div style={{border:"2px solid #111",padding:"24px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <Layers width={20} height={20} color="#FF1493"/>
                    <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:0.5}}>SHOP THE LOOK</h3>
                    {isAdmin&&<span style={{background:"#111",color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:900,letterSpacing:1,padding:"3px 8px"}}>ADMIN · STITCH'D</span>}
                  </div>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,color:"#666",marginBottom:18,lineHeight:1.4}}>Curate an outfit from pieces across Stitch'd. Shoppers can add the whole look to their bag in one tap.</p>
                  <button className="hbtn" style={{...S.hBtn,background:"#FF1493",border:"2px solid #111",borderRadius:0,fontSize:13,padding:"12px 22px",display:"inline-flex",alignItems:"center",gap:7}} onClick={openCreateLook}><Plus width={16} height={16}/> CREATE A LOOK</button>
                  {myLooks.length>0&&(
                    <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:20}}>
                      {myLooks.map(look=>{
                        const listings=lookListings(look);
                        return(
                          <div key={look.id} style={{border:"2px solid #111",padding:"10px 12px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                            <div style={{width:48,height:48,flexShrink:0,border:"2px solid #111",overflow:"hidden"}}>
                              <Thumb src={look.cover_image_url||listings[0]?.image_url||(listings[0]?.images&&listings[0].images[0])||""} emoji={<Layers width={20} height={20}/>} accent="#fafafa" style={{width:"100%",height:"100%"}} emojiStyle={{color:"#111"}}/>
                            </div>
                            <div style={{flex:1,minWidth:120}}>
                              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:800,color:"#111",lineHeight:1.1,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>{look.title} {!look.active&&<span style={{background:"#FF9500",color:"#fff",fontSize:10,fontWeight:800,letterSpacing:1,padding:"2px 6px"}}>DRAFT</span>}</p>
                              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,color:"#6b6b6b",letterSpacing:1}}>{listings.length} {listings.length===1?"PIECE":"PIECES"} · {currencySymbol()}{lookTotal(listings)}</p>
                            </div>
                            <div style={{display:"flex",gap:6}}>
                              <button className="hbtn" style={{...S.dashBtn,background:"#111",color:"#fff"}} onClick={()=>editLook(look)}>EDIT</button>
                              <button className="hbtn" style={{...S.dashBtn,background:"#fff",color:"#FF1493",border:"1.5px solid #FF1493"}} onClick={()=>deleteLook(look.id)}>DELETE</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Tool 2 — Vacation mode */}
                <div style={{border:"2px solid #111",padding:"24px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <Plane width={20} height={20} color="#FF1493"/>
                    <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:0.5}}>VACATION MODE</h3>
                  </div>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,color:"#666",marginBottom:18,lineHeight:1.4}}>Hide all your listings while you're away. Your listings will be restored when you return.</p>
                  <div style={{display:"flex",alignItems:"center",gap:14}}>
                    {/* Large toggle switch — #FF1493 active, #111 2px border, no radius */}
                    <button aria-label="Toggle vacation mode" disabled={vacationSaving} onClick={()=>toggleVacation(!profile?.vacation_mode)} style={{width:74,height:38,border:"2px solid #111",borderRadius:0,background:profile?.vacation_mode?"#FF1493":"#fff",position:"relative",cursor:vacationSaving?"wait":"pointer",padding:0,transition:"background .15s",opacity:vacationSaving?0.6:1}}>
                      <span style={{position:"absolute",top:2,left:profile?.vacation_mode?40:2,width:30,height:30,background:profile?.vacation_mode?"#fff":"#111",transition:"left .15s",display:"block"}}/>
                    </button>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:800,letterSpacing:1,color:profile?.vacation_mode?"#FF1493":"#111"}}>{profile?.vacation_mode?"ON — YOU'RE AWAY":"OFF"}</span>
                  </div>
                  {profile?.vacation_mode&&(
                    <div style={{marginTop:16,background:"#FFF0F7",border:"2px solid #FF1493",padding:"12px 14px",fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,color:"#111"}}>
                      Your listings are hidden. Toggle off to make them visible again.
                    </div>
                  )}
                </div>

                {/* Phase 14 — BUNDLE DISCOUNT. Toggle on, pick a % (5/10/15/20),
                    live preview, SAVE. Persists to the profile; the deal then shows
                    on cards/storefront and applies automatically in the bag. */}
                <div style={{border:"2px solid #111",padding:"24px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <Tag width={20} height={20} color="#FF1493"/>
                    <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:0.5}}>BUNDLE DISCOUNT</h3>
                  </div>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,color:"#666",marginBottom:18,lineHeight:1.4}}>Offer buyers a discount when they purchase 2 or more of your items at once.</p>
                  {/* Toggle — #FF1493 active state */}
                  <div style={{display:"flex",alignItems:"center",gap:14}}>
                    <button aria-label="Enable bundle discount" onClick={()=>setBundleOn(v=>!v)} style={{width:74,height:38,border:"2px solid #111",borderRadius:0,background:bundleOn?"#FF1493":"#fff",position:"relative",cursor:"pointer",padding:0,transition:"background .15s"}}>
                      <span style={{position:"absolute",top:2,left:bundleOn?40:2,width:30,height:30,background:bundleOn?"#fff":"#111",transition:"left .15s",display:"block"}}/>
                    </button>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:800,letterSpacing:1,color:bundleOn?"#FF1493":"#111"}}>{bundleOn?"ENABLE BUNDLE DISCOUNT — ON":"ENABLE BUNDLE DISCOUNT — OFF"}</span>
                  </div>
                  {/* Percentage selector — only visible when ON. Pills: selected #FF1493. */}
                  {bundleOn&&(
                    <div style={{marginTop:20}}>
                      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:800,color:"#6b6b6b",letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>DISCOUNT PERCENTAGE</p>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        {[5,10,15,20].map(p=>(
                          <button key={p} type="button" onClick={()=>setBundlePct(p)} style={{background:bundlePct===p?"#FF1493":"#fff",color:bundlePct===p?"#fff":"#111",border:"2px solid #111",borderRadius:0,padding:"10px 20px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:bundlePct===p?900:700,fontSize:15,letterSpacing:1,cursor:"pointer"}}>{p}%</button>
                        ))}
                      </div>
                      {/* Live preview */}
                      <div style={{marginTop:18,background:"#00E5CC",border:"2px solid #111",borderRadius:0,padding:"12px 14px",fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:800,color:"#111",lineHeight:1.3,display:"flex",alignItems:"center",gap:9}}>
                        <Tag width={16} height={16} style={{flexShrink:0}}/> Buyers get {bundlePct}% off when they purchase 2 or more of your items
                      </div>
                    </div>
                  )}
                  <button className="hbtn" style={{...S.hBtn,background:"#FF1493",color:"#fff",border:"2px solid #111",borderRadius:0,fontSize:13,padding:"12px 22px",marginTop:20,opacity:bundleSaving?0.5:1}} disabled={bundleSaving} onClick={doSaveBundleDiscount}>{bundleSaving?"SAVING…":"SAVE"}</button>
                </div>

                {/* Tool 5 — Promote (coming soon) */}
                <div style={{border:"2px solid #111",padding:"24px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <Rocket width={20} height={20} color="#00E5CC"/>
                    <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:0.5}}>PROMOTE YOUR LISTINGS</h3>
                    <span style={{background:"#00E5CC",color:"#111",fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:900,letterSpacing:1,padding:"3px 8px"}}>COMING SOON</span>
                  </div>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,color:"#666",marginBottom:18,lineHeight:1.4}}>Boost your listings to the top of search results and get more eyes on your pieces. Coming soon.</p>
                  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                    <button disabled style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1,fontSize:13,padding:"12px 22px",background:"#e8e8e8",color:"#6e6e6e",border:"2px solid #ddd",borderRadius:0,cursor:"not-allowed"}}>PROMOTE</button>
                    <button className="hbtn" disabled={promoteNotified} style={{...S.hBtn,background:promoteNotified?"#fff":"#111",color:promoteNotified?"#34C759":"#fff",border:`2px solid ${promoteNotified?"#34C759":"#111"}`,fontSize:13,padding:"12px 22px",display:"inline-flex",alignItems:"center",gap:7,opacity:promoteNotified?1:1}} onClick={notifyPromote}>{promoteNotified?<><Check width={15} height={15}/> WE'LL NOTIFY YOU</>:<><Bell width={15} height={15}/> NOTIFY ME</>}</button>
                  </div>
                </div>
              </div>
            ):dashTab==="admin"?(
              /* ── ADMIN TAB (Phase 11 — reports + disputes) ───────────────────── */
              <div style={{display:"flex",flexDirection:"column",gap:32,maxWidth:860}}>
                {/* REPORTS */}
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,paddingBottom:10,borderBottom:"2px solid #111"}}>
                    <Flag width={18} height={18} color="#FF1493"/>
                    <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:0.5}}>REPORTS</h3>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,color:"#6f6f6f",letterSpacing:1}}>({adminReports.length})</span>
                  </div>
                  {adminReports.length===0?(
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,color:"#6f6f6f",letterSpacing:1}}>No reports.</p>
                  ):(
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      {adminReports.map(r=>{
                        const resolved=r.status==="resolved";
                        const title=r.listings?.name||"Listing";
                        const date=r.created_at?new Date(r.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}).toUpperCase():"";
                        return(
                          <div key={r.id} style={{border:"2px solid #111",padding:"14px 16px",fontFamily:"'Barlow Condensed',sans-serif"}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                              <span style={{background:resolved?"#34C759":"#FF9500",color:"#fff",padding:"3px 10px",fontSize:10,fontWeight:800,letterSpacing:1.5}}>{(r.status||"pending").toUpperCase()}</span>
                              <span style={{fontSize:10,color:"#6f6f6f",letterSpacing:1}}>{date}</span>
                            </div>
                            <p style={{fontSize:17,fontWeight:900,color:"#111",marginBottom:2}}>{title}</p>
                            <p style={{fontSize:14,fontWeight:700,color:"#FF1493",marginBottom:2}}>{r.reason}</p>
                            {r.details&&<p style={{fontSize:13,color:"#666",marginBottom:4,lineHeight:1.4}}>{r.details}</p>}
                            <p style={{fontSize:12,color:"#888",letterSpacing:0.5,marginBottom:10}}>Reported by {adminNames[r.reporter_id]||"a user"}</p>
                            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                              <button className="hbtn" disabled={resolved} style={{...S.dashBtn,background:resolved?"#e5e5e5":"#34C759",color:resolved?"#999":"#fff",cursor:resolved?"default":"pointer",display:"inline-flex",alignItems:"center",gap:4}} onClick={()=>!resolved&&markReportResolved(r.id)}><Check width={12} height={12}/> {resolved?"RESOLVED":"MARK RESOLVED"}</button>
                              {r.listing_id&&<a className="hbtn" href={`/?listing=${r.listing_id}`} style={{...S.dashBtn,background:"#fff",color:"#111",border:"1.5px solid #111",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:4}}><ExternalLink width={12} height={12}/> VIEW LISTING</a>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {/* DISPUTES */}
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,paddingBottom:10,borderBottom:"2px solid #111"}}>
                    <AlertCircle width={18} height={18} color="#FF1493"/>
                    <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:0.5}}>DISPUTES</h3>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,color:"#6f6f6f",letterSpacing:1}}>({adminDisputes.length})</span>
                  </div>
                  {adminDisputes.length===0?(
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,color:"#6f6f6f",letterSpacing:1}}>No disputes.</p>
                  ):(
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      {adminDisputes.map(d=>{
                        const isAlteration=!!d.alteration_request_id;
                        const ref=`#${String(d.order_id||d.alteration_request_id||"").slice(-8).toUpperCase()}`;
                        const altName=d.alteration_requests&&((d.alteration_requests.listings&&d.alteration_requests.listings.name)||d.alteration_requests.garment_type);
                        const date=d.created_at?new Date(d.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}).toUpperCase():"";
                        const STATUSES=[["open","OPEN"],["under_review","UNDER REVIEW"],["resolved","RESOLVED"],["refunded","REFUNDED"]];
                        const cur=(d.status||"open").toLowerCase();
                        return(
                          <div key={d.id} style={{border:"2px solid #111",padding:"14px 16px",fontFamily:"'Barlow Condensed',sans-serif"}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                              <span style={{background:"#111",color:"#fff",padding:"3px 10px",fontSize:11,fontWeight:800,letterSpacing:1}}>{ref}</span>
                              <span style={{background:isAlteration?"#FF9500":"#00E5CC",color:isAlteration?"#fff":"#111",padding:"3px 10px",fontSize:10,fontWeight:800,letterSpacing:1.5}}>{isAlteration?"TAILORING":"PURCHASE"}</span>
                              {isAlteration&&altName&&<span style={{fontSize:11,color:"#888",letterSpacing:0.5}}>{altName}</span>}
                              <span style={{fontSize:10,color:"#6f6f6f",letterSpacing:1}}>{date}</span>
                            </div>
                            <p style={{fontSize:16,fontWeight:900,color:"#FF1493",marginBottom:2}}>{d.problem_type}</p>
                            <p style={{fontSize:12,color:"#888",letterSpacing:0.5,marginBottom:6}}>Raised by {adminNames[d.buyer_id]||"a buyer"}</p>
                            {d.details&&<p style={{fontSize:14,color:"#444",marginBottom:10,lineHeight:1.45}}>{d.details}</p>}
                            {d.photo_url&&(
                              <a href={d.photo_url} target="_blank" rel="noreferrer" style={{display:"inline-block",marginBottom:10,border:"2px solid #111",width:88,height:88,overflow:"hidden"}}>
                                <img src={d.photo_url} alt="dispute evidence" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                              </a>
                            )}
                            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                              <label style={{fontSize:10,fontWeight:800,letterSpacing:1.5,color:"#888"}}>STATUS</label>
                              <select value={cur} onChange={e=>updateDisputeStatus(d.id,e.target.value)} style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:800,letterSpacing:1,padding:"8px 12px",border:"2px solid #111",borderRadius:0,background:"#fff",color:"#111",cursor:"pointer"}}>
                                {STATUSES.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {/* VERIFICATION APPLICATIONS (Phase 11) */}
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,paddingBottom:10,borderBottom:"2px solid #111"}}>
                    <BadgeCheck width={18} height={18} color="#00E5CC"/>
                    <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:0.5}}>VERIFICATION APPLICATIONS</h3>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,color:"#6f6f6f",letterSpacing:1}}>({adminApplications.length})</span>
                  </div>
                  {/* PENDING / APPROVED / REJECTED sub-tabs */}
                  <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
                    {[["pending","PENDING"],["approved","APPROVED"],["rejected","REJECTED"]].map(([v,l])=>{
                      const n=adminApplications.filter(a=>(a.status||"pending")===v).length;
                      return <button key={v} className="hbtn" style={{...S.hBtn,background:adminAppTab===v?"#111":"#fff",color:adminAppTab===v?"#fff":"#111",border:"2px solid #111",fontSize:12,padding:"8px 18px"}} onClick={()=>setAdminAppTab(v)}>{l} ({n})</button>;
                    })}
                  </div>
                  {(()=>{
                    const apps=adminApplications.filter(a=>(a.status||"pending")===adminAppTab);
                    if(apps.length===0) return <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,color:"#6f6f6f",letterSpacing:1}}>No {adminAppTab} applications.</p>;
                    return (
                      <div style={{display:"flex",flexDirection:"column",gap:10}}>
                        {apps.map(a=>{
                          const prof=adminApplicants[a.user_id]||{};
                          const email=prof.email||"";
                          const uname=prof.username?`@${prof.username}`:"";
                          const date=a.created_at?new Date(a.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}).toUpperCase():"";
                          const igRaw=(a.instagram_handle||"").trim();
                          const igHandle=igRaw.replace(/^@/,"");
                          return(
                            <div key={a.id} style={{border:"2px solid #111",padding:"14px 16px",fontFamily:"'Barlow Condensed',sans-serif"}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                                <span style={{background:a.status==="approved"?"#34C759":a.status==="rejected"?"#FF1493":"#FF9500",color:"#fff",padding:"3px 10px",fontSize:10,fontWeight:800,letterSpacing:1.5}}>{(a.status||"pending").toUpperCase()}</span>
                                <span style={{fontSize:10,color:"#6f6f6f",letterSpacing:1}}>{date}</span>
                              </div>
                              <p style={{fontSize:17,fontWeight:900,color:"#111",marginBottom:2,display:"inline-flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>{a.full_name||"Applicant"}{uname&&<span style={{fontSize:13,fontWeight:700,color:"#888"}}>{uname}</span>}</p>
                              {email&&<p style={{fontSize:13,color:"#888",letterSpacing:0.3,marginBottom:6}}>{email}</p>}
                              <p style={{fontSize:14,color:"#444",marginBottom:6,lineHeight:1.45}}><span style={{fontWeight:800,color:"#FF1493"}}>Reason: </span>{a.reason}</p>
                              {a.selling_experience&&<p style={{fontSize:13,color:"#666",marginBottom:6}}><span style={{fontWeight:800}}>Selling experience: </span>{a.selling_experience}</p>}
                              {igHandle&&<p style={{fontSize:13,marginBottom:8}}><a href={`https://instagram.com/${igHandle}`} target="_blank" rel="noreferrer" style={{color:"#FF1493",fontWeight:800,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5}}><Instagram width={13} height={13}/> @{igHandle}</a></p>}
                              {a.admin_notes&&<p style={{fontSize:12,color:"#888",marginBottom:8,fontStyle:"italic"}}>Notes: {a.admin_notes}</p>}
                              {(a.status||"pending")==="pending"&&(
                                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:4}}>
                                  <button className="hbtn" style={{...S.dashBtn,background:"#34C759",color:"#fff",display:"inline-flex",alignItems:"center",gap:4}} onClick={()=>approveVerification(a)}><Check width={12} height={12}/> APPROVE</button>
                                  <button className="hbtn" style={{...S.dashBtn,background:"#fff",color:"#FF1493",border:"1.5px solid #FF1493",display:"inline-flex",alignItems:"center",gap:4}} onClick={()=>{setRejectApp(a);setRejectNotes("");}}><X width={12} height={12}/> REJECT</button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
                {/* TAILOR APPLICATIONS (Phase 15) */}
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,paddingBottom:10,borderBottom:"2px solid #111"}}>
                    <Scissors width={18} height={18} color="#FF1493"/>
                    <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:0.5}}>TAILOR APPLICATIONS</h3>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,color:"#6f6f6f",letterSpacing:1}}>({adminTailors.filter(t=>(t.status||"pending")==="pending").length})</span>
                  </div>
                  {(()=>{
                    const pending=adminTailors.filter(t=>(t.status||"pending")==="pending");
                    if(pending.length===0) return <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,color:"#6f6f6f",letterSpacing:1}}>No pending tailor applications.</p>;
                    const sym=currencySymbol();
                    const fmt=(p)=>p==null?null:`${sym}${(p/100).toString()}`;
                    return (
                      <div style={{display:"flex",flexDirection:"column",gap:10}}>
                        {pending.map(t=>{
                          const date=t.created_at?new Date(t.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}).toUpperCase():"";
                          const priceRange=(t.price_from_pence!=null||t.price_to_pence!=null)?`${fmt(t.price_from_pence)||"?"} – ${fmt(t.price_to_pence)||"?"}`:"Not set";
                          const portfolio=Array.isArray(t.tailor_portfolio)?t.tailor_portfolio:[];
                          return(
                            <div key={t.id} style={{border:"2px solid #111",padding:"14px 16px",fontFamily:"'Barlow Condensed',sans-serif"}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                                <span style={{background:"#FF9500",color:"#fff",padding:"3px 10px",fontSize:10,fontWeight:800,letterSpacing:1.5}}>PENDING</span>
                                <span style={{fontSize:10,color:"#6f6f6f",letterSpacing:1}}>{date}</span>
                              </div>
                              <div style={{display:"flex",gap:14,alignItems:"flex-start",flexWrap:"wrap"}}>
                                {t.profile_image_url&&<img src={t.profile_image_url} alt="" style={{width:56,height:56,borderRadius:"50%",border:"2px solid #111",objectFit:"cover",flexShrink:0}}/>}
                                <div style={{flex:1,minWidth:200}}>
                                  <p style={{fontSize:18,fontWeight:900,color:"#111",marginBottom:2}}>{t.display_name}</p>
                                  <p style={{fontSize:13,color:"#888",display:"flex",alignItems:"center",gap:5,marginBottom:6}}><MapPin width={13} height={13}/> {t.location}</p>
                                  {t.bio&&<p style={{fontSize:13.5,color:"#444",marginBottom:6,lineHeight:1.45,fontFamily:"'Barlow',sans-serif"}}>{t.bio.slice(0,160)}{t.bio.length>160?"…":""}</p>}
                                  {(t.specialisms||[]).length>0&&<p style={{fontSize:12,color:"#666",marginBottom:4}}><span style={{fontWeight:800,color:"#FF1493"}}>Specialisms: </span>{t.specialisms.join(", ")}</p>}
                                  <p style={{fontSize:12,color:"#666",marginBottom:portfolio.length?8:0}}><span style={{fontWeight:800}}>Price: </span>{priceRange}{t.turnaround_days?`  ·  ${turnaroundLabel(t.turnaround_days)}`:""}</p>
                                  {portfolio.length>0&&(
                                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4}}>
                                      {portfolio.slice(0,6).map(img=><img key={img.id} src={img.image_url} alt="" style={{width:48,height:48,border:"1.5px solid #111",objectFit:"cover"}}/>)}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
                                <button className="hbtn" style={{...S.dashBtn,background:"#34C759",color:"#fff",display:"inline-flex",alignItems:"center",gap:4}} onClick={()=>approveTailor(t)}><Check width={12} height={12}/> APPROVE</button>
                                <button className="hbtn" style={{...S.dashBtn,background:"#fff",color:"#FF1493",border:"1.5px solid #FF1493",display:"inline-flex",alignItems:"center",gap:4}} onClick={()=>rejectTailor(t)}><X width={12} height={12}/> REJECT</button>
                                <button className="hbtn" style={{...S.dashBtn,background:"#fff",color:"#111",border:"1.5px solid #111",display:"inline-flex",alignItems:"center",gap:4}} onClick={()=>openTailorPublic(t.id,true)}><ExternalLink width={12} height={12}/> PREVIEW</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
                {/* TAILOR PAYOUTS (Phase 15 — Stripe Connect oversight) */}
                {(()=>{
                  const gbp=(p)=>`£${((Number(p)||0)/100).toFixed(2).replace(/\.00$/,"")}`;
                  const fmtDate=(d)=>{ try{ return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}).toUpperCase(); }catch{ return ""; } };
                  let gmv=0, commission=0, paidOut=0;
                  for(const po of adminPayouts){
                    const amount=Number(po.amount_pence)||0; const comm=Number(po.commission_pence)||0;
                    gmv+=amount; commission+=comm;
                    if(po.status==="paid") paidOut+=(amount-comm);
                  }
                  const STAT=(label,value,accent)=>(
                    <div style={{border:"2px solid #111",padding:14,display:"flex",flexDirection:"column",gap:6,minWidth:150,flex:1}}>
                      <span style={{fontSize:10,fontWeight:800,color:"#6b6b6b",letterSpacing:1.5}}>{label}</span>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:900,color:accent||"#111",lineHeight:1}}>{value}</span>
                    </div>
                  );
                  const badge=(st)=>{ const s=(st||"pending").toLowerCase(); const bg=s==="paid"?"#00E5CC":s==="failed"?"#FF1493":"#FF9500"; const fg=s==="paid"?"#111":"#fff"; const label=s==="paid"?"TRANSFERRED":s==="failed"?"FAILED":"PENDING"; return <span style={{background:bg,color:fg,padding:"3px 10px",fontSize:10,fontWeight:800,letterSpacing:1.5}}>{label}</span>; };
                  return (
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,paddingBottom:10,borderBottom:"2px solid #111"}}>
                        <Wallet width={18} height={18} color="#FF1493"/>
                        <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:0.5}}>TAILOR PAYOUTS</h3>
                        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,color:"#6f6f6f",letterSpacing:1}}>({adminPayouts.length})</span>
                      </div>
                      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:16}}>
                        {STAT("GMV (BOOKINGS)",gbp(gmv))}
                        {STAT("STITCH'D COMMISSION",gbp(commission),"#FF1493")}
                        {STAT("PAID OUT TO TAILORS",gbp(paidOut),"#00E5CC")}
                      </div>
                      {adminPayouts.length===0?(
                        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,color:"#6f6f6f",letterSpacing:1}}>No payouts yet.</p>
                      ):(
                        <div style={{display:"flex",flexDirection:"column",gap:10}}>
                          {adminPayouts.map(po=>{
                            const ar=po.alteration_requests; const listing=ar&&ar.listings;
                            const job=(listing&&listing.name)||(ar&&ar.garment_type)||"Alteration";
                            const tailorName=(po.tailors&&po.tailors.display_name)||"Tailor";
                            const gross=Number(po.amount_pence)||0; const comm=Number(po.commission_pence)||0; const payout=gross-comm;
                            const failed=po.status==="failed";
                            return (
                              <div key={po.id} style={{border:`2px solid ${failed?"#FF1493":"#111"}`,padding:"14px 16px",fontFamily:"'Barlow Condensed',sans-serif",background:failed?"#fff0f8":"#fff"}}>
                                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                                  {badge(po.status)}
                                  <span style={{fontSize:10,color:"#6f6f6f",letterSpacing:1}}>{fmtDate(po.paid_at||po.created_at)}</span>
                                </div>
                                <p style={{fontSize:17,fontWeight:900,color:"#111",marginBottom:2}}>{job}</p>
                                <p style={{fontSize:13,color:"#888",letterSpacing:0.3,marginBottom:6,display:"inline-flex",alignItems:"center",gap:5}}><Scissors width={13} height={13}/> {tailorName}</p>
                                <p style={{fontSize:13.5,color:"#444",marginBottom:failed?6:0,fontFamily:"'Barlow',sans-serif"}}>Gross {gbp(gross)} · Commission {gbp(comm)} · <span style={{fontWeight:800,color:"#FF1493"}}>Payout {gbp(payout)}</span></p>
                                {failed&&po.failure_reason&&<p style={{fontSize:12,color:"#FF1493",marginBottom:8,fontStyle:"italic",fontFamily:"'Barlow',sans-serif"}}>Error: {po.failure_reason}</p>}
                                {(failed||po.status==="pending"||(po.status==="paid"&&!po.stripe_transfer_id))&&(
                                  <button className="hbtn" style={{...S.dashBtn,background:failed?"#FF1493":"#fff",color:failed?"#fff":"#111",border:failed?"none":"1.5px solid #111",marginTop:6,display:"inline-flex",alignItems:"center",gap:4}} onClick={()=>retryPayout(po)}><RefreshCw width={12} height={12}/> {failed?"RETRY PAYOUT":"PROCESS PAYOUT"}</button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ):dashTab==="offers"?(
              /* ── OFFERS TAB (Phase 14 — seller responds to offers) ───────────── */
              (()=>{
                const sym=currencySymbol();
                const fmtMoney=(n)=>`${sym}${Number(n).toFixed(2).replace(/\.00$/,"")}`;
                // PENDING first by default; within a tab, newest offers first.
                const filtered=visibleOffers.filter(o=>effectiveStatus(o)===offerTab);
                const STATUS_TABS=[["pending","PENDING"],["accepted","ACCEPTED"],["declined","DECLINED"],["expired","EXPIRED"]];
                const STATUS_META={
                  accepted:{label:"ACCEPTED",bg:"#34C759"},
                  declined:{label:"DECLINED",bg:"#999"},
                  expired:{label:"EXPIRED",bg:"#FF9500"},
                };
                // Time-remaining label for a pending offer; red under 6 hours.
                const expiryInfo=(o)=>{
                  if(!o.expires_at) return null;
                  const ms=new Date(o.expires_at).getTime()-Date.now();
                  if(ms<=0) return {text:"Expired",urgent:true};
                  const hours=ms/3600000;
                  if(hours<1){ const mins=Math.max(1,Math.round(ms/60000)); return {text:`Expires in ${mins} minute${mins!==1?"s":""}`,urgent:true}; }
                  const h=Math.round(hours);
                  return {text:`Expires in ${h} hour${h!==1?"s":""}`,urgent:hours<6};
                };
                return (
                <>
                  {/* Filter tabs: PENDING / ACCEPTED / DECLINED / EXPIRED */}
                  <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
                    {STATUS_TABS.map(([v,l])=>{
                      const n=visibleOffers.filter(o=>effectiveStatus(o)===v).length;
                      return <button key={v} className="hbtn" style={{...S.hBtn,background:offerTab===v?"#111":"#fff",color:offerTab===v?"#fff":"#111",border:"2px solid #111",fontSize:12,padding:"8px 18px"}} onClick={()=>setOfferTab(v)}>{l} ({n})</button>;
                    })}
                  </div>
                  {filtered.length===0?(
                    <div style={{textAlign:"center",padding:"48px 20px"}}>
                      <p style={{display:"flex",justifyContent:"center",marginBottom:12,color:"#ddd"}}><Tag width={40} height={40}/></p>
                      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:900,color:"#6f6f6f",letterSpacing:1}}>
                        {visibleOffers.length===0
                          ?"NO OFFERS YET — BUYERS CAN MAKE OFFERS ON YOUR ACTIVE LISTINGS"
                          :offerTab==="pending"?"NO PENDING OFFERS":`NO ${offerTab.toUpperCase()} OFFERS`}
                      </p>
                    </div>
                  ):(
                    <div style={{display:"flex",flexDirection:"column",gap:12,maxWidth:680}}>
                      {filtered.map(o=>{
                        const listing=o.listings||{};
                        const offerAmount=o.amount_pence/100;
                        const listed=Number(listing.price||0);
                        const diff=listed-offerAmount;
                        const st=effectiveStatus(o);
                        const meta=STATUS_META[st];
                        const exp=expiryInfo(o);
                        const msg=(o.message||"").trim();
                        return (
                        <div key={o.id} style={{border:"2px solid #111",padding:"16px",fontFamily:"'Barlow Condensed',sans-serif",display:"flex",gap:14,alignItems:"flex-start",flexWrap:"wrap"}}>
                          {/* Listing thumbnail — 60px square, 2px #111 border */}
                          <div style={{width:60,height:60,flexShrink:0,border:"2px solid #111",overflow:"hidden"}}>
                            <Thumb src={listing.image_url||(listing.images&&listing.images[0])||""} emoji={<Tag width={24} height={24}/>} accent="#fafafa" style={{width:"100%",height:"100%"}} emojiStyle={{color:"#111"}}/>
                          </div>
                          <div style={{flex:1,minWidth:200}}>
                            {/* Status pill on non-pending tabs */}
                            {meta&&<span style={{display:"inline-block",background:meta.bg,color:"#fff",fontSize:10,fontWeight:800,letterSpacing:1.5,padding:"3px 10px",marginBottom:6}}>{meta.label}</span>}
                            <p style={{fontSize:17,fontWeight:900,color:"#111",lineHeight:1.1,marginBottom:6}}>{listing.name||"Listing"}</p>
                            {/* Offer amount — large, bold, #111 */}
                            <p style={{fontSize:30,fontWeight:900,color:"#111",letterSpacing:-0.5,lineHeight:1,marginBottom:2}}>{fmtMoney(offerAmount)}</p>
                            {/* Listed price + difference */}
                            <p style={{fontSize:14,fontWeight:700,color:"#6b6b6b",marginBottom:2}}>Listed at {fmtMoney(listed)}</p>
                            {diff>0
                              ? <p style={{fontSize:12,fontWeight:700,color:"#6e6e6e",marginBottom:8}}>{fmtMoney(diff)} below asking</p>
                              : diff<0
                                ? <p style={{fontSize:12,fontWeight:700,color:"#6e6e6e",marginBottom:8}}>{fmtMoney(-diff)} above asking</p>
                                : <p style={{fontSize:12,fontWeight:700,color:"#6e6e6e",marginBottom:8}}>Full asking price</p>}
                            {/* Buyer first name */}
                            <p style={{fontSize:14,fontWeight:800,color:"#111",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>From {buyerFirstName(o)}</p>
                            {/* Buyer message in a light grey box */}
                            {msg&&(
                              <div style={{background:"#f5f5f5",border:"1px solid #e5e5e5",padding:"10px 12px",marginBottom:10,display:"flex",gap:8,alignItems:"flex-start"}}>
                                <MessageSquare width={14} height={14} color="#6b6b6b" style={{flexShrink:0,marginTop:2}}/>
                                <span style={{fontSize:14,color:"#555",lineHeight:1.4}}>{msg}</span>
                              </div>
                            )}
                            {/* Time remaining (pending only) */}
                            {st==="pending"&&exp&&(
                              <p style={{fontSize:12,fontWeight:700,letterSpacing:0.5,color:exp.urgent?"#FF1493":"#999",marginBottom:12,display:"flex",alignItems:"center",gap:5}}><Hourglass width={13} height={13}/> {exp.text}</p>
                            )}
                            {/* Accept / Decline (pending only) */}
                            {st==="pending"&&(
                              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                                <button className="hbtn" style={{background:"#FF1493",color:"#fff",border:"2px solid #111",borderRadius:0,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1.5,fontSize:13,padding:"10px 22px",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}} onClick={()=>setAcceptModal(o)}><Check width={15} height={15}/> ACCEPT</button>
                                <button className="hbtn" style={{background:"#fff",color:"#111",border:"2px solid #111",borderRadius:0,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1.5,fontSize:13,padding:"10px 22px",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}} onClick={()=>{ setDeclineModal(o); setCounterPrice(""); }}><X width={15} height={15}/> DECLINE</button>
                              </div>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </>
                );
              })()
            ):tabItems.length===0?(
              <div style={{textAlign:"center",padding:"48px 20px"}}><p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:900,color:"#6f6f6f",letterSpacing:1}}>{dashTab==="sold"?"NO SALES YET.":"NO ACTIVE LISTINGS."}</p></div>
            ):(
            <div style={S.dashGrid} className="dash-grid">
              {tabItems.map((item,idx)=>{
                const accent=CARD_COLORS[idx%CARD_COLORS.length];
                const checked=selectedIds.includes(item.id);
                return (
                <div key={item.id} style={{...S.dashCard,borderColor:item.sold?"#ccc":(bulkMode&&checked?"#FF1493":accent),position:"relative"}}>
                  <Thumb src={item.image_url||(item.images&&item.images[0])||""} emoji={item.emoji||catEmoji(item.category)} accent={accent} imgOpacity={item.sold?0.5:1} style={S.dashCardImg} emojiStyle={{fontSize:44}}>
                    {item.sold&&<div style={S.soldVeil}><span style={S.soldStamp}>SOLD</span></div>}
                    {/* Bulk-edit checkbox, top-left (active tab only). */}
                    {bulkMode&&!item.sold&&(
                      <button aria-label="Select listing" onClick={()=>toggleSelect(item.id)} style={{position:"absolute",top:6,left:6,width:28,height:28,border:"2px solid #111",borderRadius:0,background:checked?"#FF1493":"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",padding:0,zIndex:2}}>
                        {checked&&<Check width={18} height={18} color="#fff"/>}
                      </button>
                    )}
                  </Thumb>
                  <div style={S.dashCardBody}>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:800,color:item.sold?"#aaa":"#111",marginBottom:4}}>{item.name}</p>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:900,color:item.sold?"#aaa":accent,marginBottom:4}}>{currencySymbol(item.currency)}{item.price}</p>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#6f6f6f",letterSpacing:1,marginBottom:10,display:"flex",alignItems:"center",gap:5}}><Eye width={12} height={12}/> {item.views||0} VIEWS</p>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <button className="hbtn" style={{...S.dashBtn,background:accent,color:"#fff"}} onClick={()=>{setSel(item);openEdit(item);}}>EDIT</button>
                      {!item.sold&&<button className="hbtn" style={{...S.dashBtn,background:"#111",color:"#fff"}} onClick={()=>markSold(item.id,item.sold)}>MARK SOLD</button>}
                      {item.sold&&<button className="hbtn" style={{...S.dashBtn,background:"#34C759",color:"#fff"}} onClick={()=>setRelistItem(item)}>RELIST</button>}
                      <button className="hbtn" style={{...S.dashBtn,background:"#fff",color:"#111",border:"1.5px solid #111",display:"inline-flex",alignItems:"center",gap:4}} onClick={()=>{setShareItem(item);setCopied(false);}}><Share2 width={12} height={12}/> SHARE</button>
                      {/* Phase 13 — PROMOTE button (active, unpromoted listings) or
                          a PROMOTED badge once a boost is live. */}
                      {!item.sold&&(isPromoted(item)
                        ? <span style={{...S.dashBtn,background:"#FF1493",color:"#fff",border:"1.5px solid #FF1493",display:"inline-flex",alignItems:"center",gap:4,cursor:"default"}}><Zap width={12} height={12} fill="currentColor"/> PROMOTED</span>
                        : <button className="hbtn" style={{...S.dashBtn,background:"#fff",color:"#FF1493",border:"2px solid #111",display:"inline-flex",alignItems:"center",gap:4}} onClick={()=>setPromoteItem(item)}><Zap width={12} height={12} color="#FF1493"/> PROMOTE</button>
                      )}
                      <button className="hbtn" style={{...S.dashBtn,background:"#fff",color:"#FF1493",border:"1.5px solid #FF1493"}} onClick={()=>del(item.id)}>DELETE</button>
                    </div>
                    {/* Promoted-until expiry line under the actions. */}
                    {!item.sold&&isPromoted(item)&&(
                      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:700,color:"#FF1493",letterSpacing:0.5,marginTop:8,display:"flex",alignItems:"center",gap:5}}><Clock width={12} height={12}/> Promoted until {promotedUntilLabel(item)}</p>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
            )}
            </>
            );
          })()}
          <div style={{marginTop:48,marginBottom:bulkMode&&selectedIds.length?96:0}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,paddingBottom:16,borderBottom:"2px solid #111"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #FF9500",paddingLeft:12,display:"flex",alignItems:"center",gap:8}}><Gift width={16} height={16}/> MY BUNDLES</div>
              <button className="hbtn" style={{...S.hBtn,background:"#FF9500",border:"none",fontSize:11}} onClick={()=>{loadBundles();setView("createbundle");}}>+ CREATE BUNDLE</button>
            </div>
            {bundles.length===0?(
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,color:"#6f6f6f",letterSpacing:1}}>No bundles yet. Bundle separate listings to offer a deal! <Gift width={14} height={14} style={{display:"inline",verticalAlign:"middle"}}/></p>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {bundles.map(b=>{
                  const bListings=bundleItems[b.id]||[];
                  const total=bListings.reduce((a,i)=>a+i.price,0);
                  const discounted=parseFloat((total*(1-b.discount_percent/100)).toFixed(2));
                  return(
                    <div key={b.id} style={{border:"2px solid #FF9500",padding:"16px 20px",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
                      <div>
                        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900,marginBottom:4}}>{b.name} {b.discount_percent>0&&<span style={{background:"#FF9500",color:"#fff",padding:"2px 8px",fontSize:10,fontWeight:800}}>{b.discount_percent}% OFF</span>}</p>
                        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:800,color:"#FF9500"}}>Bundle: £{discounted}</p>
                      </div>
                      <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#FF1493",border:"2px solid #FF1493",fontSize:11}} onClick={()=>deleteBundle(b.id)}>DELETE</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Phase 10d — BULK ACTION BAR (fixed bottom) ───────────────────────── */}
          {bulkMode&&selectedIds.length>0&&(
            <div style={{position:"fixed",left:0,right:0,bottom:0,zIndex:400,background:"#111",borderTop:"2px solid #111",borderRadius:0,padding:"14px 18px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <span style={{background:"#FF1493",color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,letterSpacing:1,fontSize:14,padding:"6px 12px"}}>{selectedIds.length} SELECTED</span>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",flex:1}}>
                <button className="hbtn" disabled={bulkBusy} style={{...S.hBtn,background:"#FF1493",border:"none",fontSize:12,padding:"10px 16px"}} onClick={()=>setPriceModal(true)}>EDIT PRICE</button>
                <button className="hbtn" disabled={bulkBusy} style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #fff",fontSize:12,padding:"10px 16px"}} onClick={()=>runBulk({sold:true,status:"sold"})}>MARK AS SOLD</button>
                <button className="hbtn" disabled={bulkBusy} style={{...S.hBtn,background:"#111",color:"#fff",border:"2px solid #fff",fontSize:12,padding:"10px 16px"}} onClick={()=>runBulk({status:"inactive"})}>DEACTIVATE</button>
              </div>
              <button className="hbtn" disabled={bulkBusy} style={{...S.hBtn,background:"transparent",color:"#fff",border:"2px solid #555",fontSize:12,padding:"10px 16px"}} onClick={exitBulk}>CANCEL</button>
            </div>
          )}

          {/* EDIT PRICE MODAL */}
          {priceModal&&(
            <div style={S.modalOverlay} onClick={()=>!bulkBusy&&setPriceModal(false)}>
              <div style={{background:"#fff",border:"2px solid #111",borderRadius:0,padding:28,maxWidth:380,width:"100%",fontFamily:"'Barlow Condensed',sans-serif"}} onClick={e=>e.stopPropagation()}>
                <h3 style={{fontSize:22,fontWeight:900,marginBottom:6}}>EDIT PRICE</h3>
                <p style={{fontSize:14,color:"#666",marginBottom:16}}>Set a new price for all {selectedIds.length} selected listing{selectedIds.length!==1?"s":""}.</p>
                <div style={{position:"relative",marginBottom:18}}>
                  <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:16,color:"#111",pointerEvents:"none"}}>£</span>
                  <input autoFocus type="number" min="0" value={bulkPrice} onChange={e=>setBulkPrice(e.target.value)} placeholder="0.00" style={{...S.inp,paddingLeft:28,fontSize:18,fontWeight:800}}/>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <button className="hbtn" disabled={bulkBusy} style={{...S.hBtn,flex:1,padding:"12px",fontSize:14,background:"#FF1493",border:"none"}} onClick={applyBulkPrice}>{bulkBusy?"SAVING...":"CONFIRM"}</button>
                  <button className="hbtn" disabled={bulkBusy} style={{...S.hBtn,flex:1,padding:"12px",fontSize:14,background:"#fff",color:"#111",border:"2px solid #111"}} onClick={()=>setPriceModal(false)}>CANCEL</button>
                </div>
              </div>
            </div>
          )}

          {/* RELIST CONFIRM MODAL */}
          {relistItem&&(
            <div style={S.modalOverlay} onClick={()=>!relistBusy&&setRelistItem(null)}>
              <div style={{background:"#fff",border:"2px solid #111",borderRadius:0,padding:28,maxWidth:420,width:"100%",fontFamily:"'Barlow Condensed',sans-serif"}} onClick={e=>e.stopPropagation()}>
                <h3 style={{fontSize:22,fontWeight:900,marginBottom:10}}>RELIST THIS ITEM AS A NEW LISTING?</h3>
                <p style={{fontSize:14,color:"#666",marginBottom:20,lineHeight:1.45}}>A copy of this listing will be created as a new active listing. The original sold listing will remain in your sold items.</p>
                <div style={{display:"flex",gap:10}}>
                  <button className="hbtn" disabled={relistBusy} style={{...S.hBtn,flex:1,padding:"12px",fontSize:14,background:"#34C759",border:"none"}} onClick={confirmRelist}>{relistBusy?"RELISTING...":"CONFIRM"}</button>
                  <button className="hbtn" disabled={relistBusy} style={{...S.hBtn,flex:1,padding:"12px",fontSize:14,background:"#fff",color:"#111",border:"2px solid #111"}} onClick={()=>setRelistItem(null)}>CANCEL</button>
                </div>
              </div>
            </div>
          )}

          {/* SHARE MODAL (Tool 3) */}
          {shareItem&&(
            <div style={S.modalOverlay} onClick={()=>setShareItem(null)}>
              <div style={{background:"#fff",border:"2px solid #111",borderRadius:0,padding:0,maxWidth:420,width:"100%",fontFamily:"'Barlow Condensed',sans-serif",maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:"2px solid #111"}}>
                  <span style={{fontWeight:900,fontSize:16,letterSpacing:1}}>SHARE LISTING</span>
                  <button aria-label="Close" onClick={()=>setShareItem(null)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><X width={20} height={20}/></button>
                </div>
                {/* Pre-designed share card */}
                <div style={{margin:16,border:"2px solid #111",borderRadius:0,background:"#fff",overflow:"hidden"}}>
                  <div style={{position:"relative"}}>
                    <Thumb src={shareItem.image_url||(shareItem.images&&shareItem.images[0])||""} emoji={shareItem.emoji||catEmoji(shareItem.category)} accent="#FF1493" style={{width:"100%",height:240}} emojiStyle={{fontSize:64}}/>
                    <span style={{position:"absolute",top:8,right:10,fontWeight:900,fontSize:18,letterSpacing:1,color:"#fff",textShadow:"0 1px 4px rgba(0,0,0,0.6)"}}>STITCH'D</span>
                  </div>
                  <div style={{padding:"16px 18px"}}>
                    <p style={{fontWeight:900,fontSize:26,lineHeight:1.05,marginBottom:8,color:"#111"}}>{shareItem.name}</p>
                    <p style={{fontWeight:900,fontSize:34,color:"#FF1493",marginBottom:10}}>{currencySymbol(shareItem.currency)}{shareItem.price}</p>
                    <p style={{fontSize:14,fontWeight:700,color:"#777",marginBottom:2}}>Available on STITCH'D</p>
                    <p style={{fontSize:13,fontWeight:700,color:"#111"}}>stitchd.fit</p>
                  </div>
                </div>
                {/* Share actions */}
                <div style={{padding:"0 16px 16px"}}>
                  <div style={{display:"flex",gap:10,marginBottom:10}}>
                    <button className="hbtn" style={{...S.hBtn,flex:1,padding:"12px",fontSize:13,background:copied?"#34C759":"#111",border:"none",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6}} onClick={()=>copyLink(shareItem)}>{copied?<><Check width={15} height={15}/> COPIED</>:<><Copy width={15} height={15}/> COPY LINK</>}</button>
                    <button className="hbtn" style={{...S.hBtn,flex:1,padding:"12px",fontSize:13,background:"#fff",color:"#111",border:"2px solid #111",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6}} onClick={()=>downloadShareCard(shareItem,()=>flash("Couldn't generate image — use Copy Link or screenshot the card."))}><Download width={15} height={15}/> DOWNLOAD IMAGE</button>
                  </div>
                  <div style={{display:"flex",gap:10}}>
                    <a className="hbtn" href={`whatsapp://send?text=${encodeURIComponent(listingUrl(shareItem.id))}`} style={{...S.hBtn,flex:1,padding:"11px",fontSize:12,background:"#25D366",border:"none",textDecoration:"none",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6}}><MessageCircle width={15} height={15}/> WHATSAPP</a>
                    <button className="hbtn" onClick={()=>copyLink(shareItem)} style={{...S.hBtn,flex:1,padding:"11px",fontSize:12,background:"#111",border:"none",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6}}><Instagram width={15} height={15}/> INSTAGRAM</button>
                    <a className="hbtn" href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(listingUrl(shareItem.id))}&text=${encodeURIComponent("Check out this listing on Stitch'd")}`} target="_blank" rel="noreferrer" style={{...S.hBtn,flex:1,padding:"11px",fontSize:12,background:"#000",border:"none",textDecoration:"none",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6}}><Twitter width={15} height={15}/> X</a>
                  </div>
                  <p style={{fontSize:11,color:"#6e6e6e",marginTop:10,textAlign:"center"}}>Instagram has no direct share API — the link is copied to your clipboard to paste in your story or bio.</p>
                </div>
              </div>
            </div>
          )}

          {/* PROMOTE LISTING MODAL (Phase 13) */}
          {promoteItem&&(()=>{
            const busy=promoteBusyId===promoteItem.id;
            const perks=[
              {Icon:TrendingUp,text:"Featured at the top of search results"},
              {Icon:Eye,text:"More eyes on your listing"},
              {Icon:Zap,text:"7 days of boosted visibility"},
            ];
            return (
            <div style={S.modalOverlay} onClick={()=>!busy&&setPromoteItem(null)}>
              <div style={{background:"#fff",border:"2px solid #111",borderRadius:0,padding:28,maxWidth:440,width:"100%",maxHeight:"90vh",overflowY:"auto",fontFamily:"'Barlow Condensed',sans-serif"}} onClick={e=>e.stopPropagation()}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                  <h3 style={{fontSize:26,fontWeight:900,letterSpacing:0.5,display:"inline-flex",alignItems:"center",gap:10,lineHeight:1.05}}><Zap width={22} height={22} color="#FF1493" fill="#FF1493"/> PROMOTE THIS LISTING</h3>
                  <button aria-label="Close" style={{background:"none",border:"none",cursor:"pointer",padding:2}} onClick={()=>!busy&&setPromoteItem(null)}><X width={20} height={20}/></button>
                </div>
                {/* Listing thumbnail + title */}
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18,paddingBottom:18,borderBottom:"2px solid #111"}}>
                  <div style={{width:56,height:56,flexShrink:0,border:"2px solid #111",overflow:"hidden"}}>
                    <Thumb src={promoteItem.image_url||(promoteItem.images&&promoteItem.images[0])||""} emoji={promoteItem.emoji||catEmoji(promoteItem.category)} accent="#FF1493" style={{width:"100%",height:"100%"}} emojiStyle={{fontSize:24}}/>
                  </div>
                  <div style={{minWidth:0}}>
                    <p style={{fontSize:18,fontWeight:900,color:"#111",lineHeight:1.1,overflow:"hidden",textOverflow:"ellipsis"}}>{promoteItem.name}</p>
                    <p style={{fontSize:15,fontWeight:800,color:"#FF1493"}}>{currencySymbol(promoteItem.currency)}{promoteItem.price}</p>
                  </div>
                </div>
                {/* What you get */}
                <p style={{fontSize:11,fontWeight:900,letterSpacing:2,color:"#6b6b6b",textTransform:"uppercase",marginBottom:10}}>What you get</p>
                <div style={{display:"flex",flexDirection:"column",gap:11,marginBottom:20}}>
                  {perks.map(({Icon,text})=>(
                    <span key={text} style={{display:"flex",alignItems:"center",gap:10,fontSize:15,fontWeight:700,letterSpacing:0.3,color:"#111",lineHeight:1.2}}><Icon width={18} height={18} color="#FF1493" style={{flexShrink:0}}/> {text}</span>
                  ))}
                </div>
                {/* Price */}
                <p style={{fontSize:34,fontWeight:900,color:"#FF1493",letterSpacing:-0.5,marginBottom:16,lineHeight:1}}>£2.99 <span style={{fontSize:18,fontWeight:800,color:"#111"}}>for 7 days</span></p>
                {/* CTA */}
                <button type="button" disabled={busy} onClick={()=>startPromote(promoteItem)} style={{width:"100%",background:"#111",color:"#fff",border:"2px solid #111",borderRadius:0,padding:"15px",fontSize:15,fontWeight:800,letterSpacing:2,fontFamily:"'Barlow Condensed',sans-serif",textTransform:"uppercase",cursor:busy?"wait":"pointer",opacity:busy?0.6:1,display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8}}><Zap width={17} height={17}/> {busy?"REDIRECTING…":"PROMOTE FOR £2.99"}</button>
                <button type="button" onClick={()=>!busy&&setPromoteItem(null)} style={{display:"block",margin:"14px auto 0",background:"none",border:"none",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:2,color:"#888",textTransform:"uppercase",textDecoration:"underline"}}>Cancel</button>
              </div>
            </div>
            );
          })()}

          {/* APPLY FOR VERIFICATION MODAL (Phase 11) */}
          {verifyModal&&(()=>{
            const canSubmit=!!verifyForm.full_name.trim()&&!!verifyForm.reason.trim()&&!verificationBusy;
            return (
            <div style={S.modalOverlay} onClick={()=>!verificationBusy&&setVerifyModal(false)}>
              <div style={{background:"#fff",border:"2px solid #111",borderRadius:0,padding:28,maxWidth:480,width:"100%",maxHeight:"88vh",overflowY:"auto",fontFamily:"'Barlow Condensed',sans-serif"}} onClick={e=>e.stopPropagation()}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <h3 style={{fontSize:26,fontWeight:900,letterSpacing:0.5,display:"inline-flex",alignItems:"center",gap:10}}><BadgeCheck width={22} height={22} color="#00E5CC"/> APPLY FOR VERIFICATION</h3>
                  <button aria-label="Close" style={{background:"none",border:"none",cursor:"pointer",padding:2}} onClick={()=>setVerifyModal(false)}><X width={20} height={20}/></button>
                </div>
                <p style={{fontSize:15,color:"#888",marginBottom:20}}>Tell us a little about your selling on Stitch'd.</p>
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <F l="Full name *"><input style={S.inp} placeholder="e.g. Nasreen Ahmed" value={verifyForm.full_name} onChange={e=>setVerifyForm(f=>({...f,full_name:e.target.value}))}/></F>
                  <F l="Why do you want to be verified? *"><textarea style={{...S.inp,height:90,resize:"vertical"}} placeholder="Tell us why you'd make a great verified seller..." value={verifyForm.reason} onChange={e=>setVerifyForm(f=>({...f,reason:e.target.value}))}/></F>
                  <F l="How long have you been selling South Asian fashion?">
                    <select style={S.inp} value={verifyForm.selling_experience} onChange={e=>setVerifyForm(f=>({...f,selling_experience:e.target.value}))}>
                      {["Less than 6 months","6-12 months","1-2 years","2+ years"].map(o=><option key={o}>{o}</option>)}
                    </select>
                  </F>
                  <F l="Instagram handle (optional)"><input style={S.inp} placeholder="@yourhandle" value={verifyForm.instagram_handle} onChange={e=>setVerifyForm(f=>({...f,instagram_handle:e.target.value}))}/></F>
                </div>
                <button type="button" onClick={submitVerifyForm} disabled={!canSubmit} style={{width:"100%",marginTop:20,background:"#FF1493",color:"#fff",border:"2px solid #111",borderRadius:0,padding:"14px",fontSize:15,fontWeight:800,letterSpacing:2,fontFamily:"'Barlow Condensed',sans-serif",cursor:canSubmit?"pointer":"not-allowed",opacity:canSubmit?1:0.4,textTransform:"uppercase"}}>{verificationBusy?"SUBMITTING…":"Submit application"}</button>
                <button type="button" onClick={()=>setVerifyModal(false)} disabled={verificationBusy} style={{display:"block",margin:"14px auto 0",background:"none",border:"none",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:2,color:"#888",textTransform:"uppercase",textDecoration:"underline"}}>Cancel</button>
              </div>
            </div>
            );
          })()}

          {/* REJECT APPLICATION MODAL (Phase 11 — admin) */}
          {rejectApp&&(
            <div style={S.modalOverlay} onClick={()=>setRejectApp(null)}>
              <div style={{background:"#fff",border:"2px solid #111",borderRadius:0,padding:28,maxWidth:420,width:"100%",fontFamily:"'Barlow Condensed',sans-serif"}} onClick={e=>e.stopPropagation()}>
                <h3 style={{fontSize:22,fontWeight:900,marginBottom:6}}>REJECT APPLICATION</h3>
                <p style={{fontSize:14,color:"#666",marginBottom:16}}>Add optional notes for {rejectApp.full_name||"this applicant"}. They'll be told they can reapply after 30 days.</p>
                <textarea style={{...S.inp,height:90,resize:"vertical",fontFamily:"'Barlow Condensed',sans-serif"}} placeholder="Admin notes (optional)..." value={rejectNotes} onChange={e=>setRejectNotes(e.target.value)}/>
                <div style={{display:"flex",gap:10,marginTop:16}}>
                  <button className="hbtn" style={{...S.hBtn,flex:1,padding:"12px",fontSize:14,background:"#FF1493",border:"2px solid #111"}} onClick={confirmReject}>CONFIRM REJECT</button>
                  <button className="hbtn" style={{...S.hBtn,flex:1,padding:"12px",fontSize:14,background:"#fff",color:"#111",border:"2px solid #111"}} onClick={()=>setRejectApp(null)}>CANCEL</button>
                </div>
              </div>
            </div>
          )}

          {/* ACCEPT OFFER MODAL (Phase 14) */}
          {acceptModal&&(()=>{
            const listing=acceptModal.listings||{};
            const amt=`${currencySymbol()}${(acceptModal.amount_pence/100).toFixed(2).replace(/\.00$/,"")}`;
            return (
            <div style={S.modalOverlay} onClick={()=>!offerBusy&&setAcceptModal(null)}>
              <div style={{background:"#fff",border:"2px solid #111",borderRadius:0,padding:28,maxWidth:420,width:"100%",fontFamily:"'Barlow Condensed',sans-serif"}} onClick={e=>e.stopPropagation()}>
                <h3 style={{fontSize:22,fontWeight:900,marginBottom:10,lineHeight:1.15}}>Accept offer of {amt} for {listing.name||"this listing"}?</h3>
                <p style={{fontSize:14,color:"#666",marginBottom:20,lineHeight:1.45}}>The buyer will be notified and sent a payment link. Any other pending offers on this listing will be declined.</p>
                <div style={{display:"flex",gap:10}}>
                  <button className="hbtn" disabled={offerBusy} style={{...S.hBtn,flex:1,padding:"12px",fontSize:14,background:"#FF1493",color:"#fff",border:"2px solid #111"}} onClick={confirmAccept}>{offerBusy?"ACCEPTING…":"CONFIRM"}</button>
                  <button className="hbtn" disabled={offerBusy} style={{...S.hBtn,flex:1,padding:"12px",fontSize:14,background:"#fff",color:"#111",border:"2px solid #111"}} onClick={()=>setAcceptModal(null)}>CANCEL</button>
                </div>
              </div>
            </div>
            );
          })()}

          {/* DECLINE OFFER MODAL (Phase 14) */}
          {declineModal&&(
            <div style={S.modalOverlay} onClick={()=>!offerBusy&&setDeclineModal(null)}>
              <div style={{background:"#fff",border:"2px solid #111",borderRadius:0,padding:28,maxWidth:420,width:"100%",fontFamily:"'Barlow Condensed',sans-serif"}} onClick={e=>e.stopPropagation()}>
                <h3 style={{fontSize:22,fontWeight:900,marginBottom:10}}>Decline this offer?</h3>
                <p style={{fontSize:14,color:"#666",marginBottom:16,lineHeight:1.45}}>The buyer will be notified. You can optionally suggest a different price to invite a new offer.</p>
                <label style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:800,color:"#6b6b6b",letterSpacing:1.5,textTransform:"uppercase",display:"block",marginBottom:8}}>Suggest a different price (optional)</label>
                <div style={{position:"relative",marginBottom:20}}>
                  <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:16,color:"#111",pointerEvents:"none"}}>{currencySymbol()}</span>
                  <input type="number" min="0" step="0.01" value={counterPrice} onChange={e=>setCounterPrice(e.target.value)} placeholder="0.00" style={{...S.inp,paddingLeft:28,fontSize:18,fontWeight:800}}/>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <button className="hbtn" disabled={offerBusy} style={{...S.hBtn,flex:1,padding:"12px",fontSize:14,background:"#111",color:"#fff",border:"2px solid #111"}} onClick={confirmDecline}>{offerBusy?"DECLINING…":"DECLINE"}</button>
                  <button className="hbtn" disabled={offerBusy} style={{...S.hBtn,flex:1,padding:"12px",fontSize:14,background:"#fff",color:"#111",border:"2px solid #111"}} onClick={()=>setDeclineModal(null)}>CANCEL</button>
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* CREATE BUNDLE */}
      {view==="createbundle"&&user&&(
        <main style={{...S.main,maxWidth:760}}>
          <button style={S.back} onClick={()=>setView("dashboard")}>← BACK TO DASHBOARD</button>
          <div style={S.formCard} className="form-card">
            <div style={S.formHero}><h2 style={S.formTitle}>CREATE A<br/><span style={{color:"#FF9500"}}>BUNDLE.</span></h2></div>
            <Sec label="BUNDLE DETAILS">
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                <F l="Bundle Name *"><input style={S.inp} placeholder="e.g. Bridal Lehenga + Jewellery Set" value={bundleForm.name} onChange={e=>setBundleForm(f=>({...f,name:e.target.value}))}/></F>
                <F l="Description"><input style={S.inp} placeholder="e.g. Complete bridal look" value={bundleForm.description} onChange={e=>setBundleForm(f=>({...f,description:e.target.value}))}/></F>
                <F l="BUNDLE DISCOUNT (%)">
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {[0,5,10,15,20].map(pct=>(
                      <button key={pct} type="button" className="hbtn" style={{...S.hBtn,background:bundleForm.discount_percent===pct?"#FF9500":"#fff",color:bundleForm.discount_percent===pct?"#fff":"#111",border:`2px solid ${bundleForm.discount_percent===pct?"#FF9500":"#111"}`,padding:"8px 14px",fontSize:11}} onClick={()=>setBundleForm(f=>({...f,discount_percent:pct}))}>{pct===0?"NO DISCOUNT":`${pct}% OFF`}</button>
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
                    <div key={item.id} style={{border:`3px solid ${isSel?accent:"#e0e0e0"}`,cursor:"pointer",overflow:"hidden"}} onClick={()=>toggleBundleListing(item.id)}>
                      <Thumb src={item.image_url||(item.images&&item.images[0])||""} emoji={item.emoji||catEmoji(item.category)} accent={accent} style={{height:80}} emojiStyle={{fontSize:32}}>
                        {isSel&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.35)",display:"flex",alignItems:"center",justifyContent:"center"}}><Check width={24} height={24} color="#fff"/></div>}
                      </Thumb>
                      <div style={{padding:"8px 10px"}}><p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:800,color:"#111",marginBottom:2}}>{item.name}</p><p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:900,color:accent}}>{currencySymbol(item.currency)}{item.price}</p></div>
                    </div>
                  );
                })}
              </div>
            </Sec>
            <button className="hbtn" style={{...S.hBtn,background:"#FF9500",border:"none",width:"100%",padding:"16px",fontSize:15,borderRadius:0,letterSpacing:3,opacity:(bundleForm.selectedListings.length<2||!bundleForm.name)?0.4:1}} onClick={createBundle} disabled={bundleForm.selectedListings.length<2||!bundleForm.name}><span style={{display:"inline-flex",alignItems:"center",gap:8}}><Gift width={18} height={18}/> CREATE BUNDLE →</span></button>
          </div>
        </main>
      )}
    </>
  );
}
