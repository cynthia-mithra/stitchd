import React from "react";
import { Shirt, Gift, Eye, Check, Star, Share2, Copy, Download, Plane, Rocket, Bell, X, Twitter, MessageCircle, Instagram, CheckSquare, Square } from "lucide-react";
import { CARD_COLORS, catEmoji, currencySymbol } from "../lib/constants";
import { S } from "../styles";
import { Sec, F, Thumb } from "../components/Shared";
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
  bundles, bundleItems, loadBundles, deleteBundle,
  // createbundle
  bundleForm, setBundleForm, toggleBundleListing, createBundle,
}) {
  // Split listings into ACTIVE vs SOLD (issue PART 4 — sold listings move to a
  // separate SOLD tab in the seller dashboard).
  const [dashTab,setDashTab]=React.useState("active");
  // The seller's own overall rating, shown as a stat tile when they have reviews.
  const myRating = user ? sellerRatings[user.id] : null;

  // ── Phase 10d state ──────────────────────────────────────────────────────────
  const [bulkMode,setBulkMode]=React.useState(false);     // bulk-edit selection mode
  const [selectedIds,setSelectedIds]=React.useState([]);  // checked listing ids
  const [priceModal,setPriceModal]=React.useState(false); // bulk EDIT PRICE modal
  const [bulkPrice,setBulkPrice]=React.useState("");
  const [bulkBusy,setBulkBusy]=React.useState(false);
  const [shareItem,setShareItem]=React.useState(null);    // listing shown in share modal
  const [relistItem,setRelistItem]=React.useState(null);  // listing shown in relist confirm
  const [relistBusy,setRelistBusy]=React.useState(false);
  const [copied,setCopied]=React.useState(false);

  const activeItems=myItems.filter(i=>!i.sold);
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
            <div><p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:4,color:"#FF1493",marginBottom:8}}>YOUR CLOSET</p><h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:48,fontWeight:900,letterSpacing:-1,lineHeight:1}}>MY DROPS</h2></div>
            <div style={S.dashStats}>
              <div style={S.dashStat}><div style={{...S.dashStatNum,color:"#FF1493"}}>{myItems.length}</div><div style={S.dashStatLabel}>TOTAL</div></div>
              <div style={S.dashStat}><div style={{...S.dashStatNum,color:"#34C759"}}>{myItems.filter(i=>!i.sold).length}</div><div style={S.dashStatLabel}>LIVE</div></div>
              <div style={S.dashStat}><div style={{...S.dashStatNum,color:"#FF9500"}}>{myItems.filter(i=>i.sold).length}</div><div style={S.dashStatLabel}>SOLD</div></div>
              <div style={S.dashStat}><div style={{...S.dashStatNum,color:"#007AFF"}}>£{myItems.filter(i=>i.sold).reduce((a,i)=>a+i.price,0)}</div><div style={S.dashStatLabel}>EARNED</div></div>
              <div style={S.dashStat}><div style={{...S.dashStatNum,color:"#BF5AF2"}}>{myItems.reduce((a,i)=>a+(i.views||0),0)}</div><div style={S.dashStatLabel}>VIEWS</div></div>
              {myRating&&myRating.count>0&&(
                <div style={S.dashStat}>
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
            <div style={{textAlign:"center",padding:"60px 20px"}}><p style={{display:"flex",justifyContent:"center",marginBottom:12}}><Shirt width={48} height={48}/></p><p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:900,marginBottom:8}}>NO LISTINGS YET.</p><button className="hbtn" style={S.hBtn} onClick={()=>setView("add")}>LIST YOUR FIRST PIECE →</button></div>
          ):(()=>{
            const tabItems=dashTab==="sold"?myItems.filter(i=>i.sold):dashTab==="active"?activeItems:[];
            return (
            <>
            <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
              <TabBtn l="ACTIVE" v="active" n={activeItems.length}/>
              <TabBtn l="SOLD" v="sold" n={myItems.filter(i=>i.sold).length}/>
              {/* Phase 10c — ANALYTICS sits alongside ACTIVE / SOLD; active state uses the pink accent. */}
              <TabBtn l="ANALYTICS" v="analytics" n={null} activeBg="#FF1493"/>
              {/* Phase 10d — TOOLS tab. */}
              <TabBtn l="TOOLS" v="tools" n={null} activeBg="#00E5CC"/>
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
              />
            ):dashTab==="tools"?(
              /* ── TOOLS TAB (Vacation mode + Promote) ──────────────────────────── */
              <div style={{display:"flex",flexDirection:"column",gap:3,maxWidth:680}}>
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

                {/* Tool 5 — Promote (coming soon) */}
                <div style={{border:"2px solid #111",padding:"24px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <Rocket width={20} height={20} color="#00E5CC"/>
                    <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:0.5}}>PROMOTE YOUR LISTINGS</h3>
                    <span style={{background:"#00E5CC",color:"#111",fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:900,letterSpacing:1,padding:"3px 8px"}}>COMING SOON</span>
                  </div>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,color:"#666",marginBottom:18,lineHeight:1.4}}>Boost your listings to the top of search results and get more eyes on your pieces. Coming soon.</p>
                  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                    <button disabled style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1,fontSize:13,padding:"12px 22px",background:"#e8e8e8",color:"#aaa",border:"2px solid #ddd",borderRadius:0,cursor:"not-allowed"}}>PROMOTE</button>
                    <button className="hbtn" disabled={promoteNotified} style={{...S.hBtn,background:promoteNotified?"#fff":"#111",color:promoteNotified?"#34C759":"#fff",border:`2px solid ${promoteNotified?"#34C759":"#111"}`,fontSize:13,padding:"12px 22px",display:"inline-flex",alignItems:"center",gap:7,opacity:promoteNotified?1:1}} onClick={notifyPromote}>{promoteNotified?<><Check width={15} height={15}/> WE'LL NOTIFY YOU</>:<><Bell width={15} height={15}/> NOTIFY ME</>}</button>
                  </div>
                </div>
              </div>
            ):tabItems.length===0?(
              <div style={{textAlign:"center",padding:"48px 20px"}}><p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:900,color:"#bbb",letterSpacing:1}}>{dashTab==="sold"?"NO SALES YET.":"NO ACTIVE LISTINGS."}</p></div>
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
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#bbb",letterSpacing:1,marginBottom:10,display:"flex",alignItems:"center",gap:5}}><Eye width={12} height={12}/> {item.views||0} VIEWS</p>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <button className="hbtn" style={{...S.dashBtn,background:accent,color:"#fff"}} onClick={()=>{setSel(item);openEdit(item);}}>EDIT</button>
                      {!item.sold&&<button className="hbtn" style={{...S.dashBtn,background:"#111",color:"#fff"}} onClick={()=>markSold(item.id,item.sold)}>MARK SOLD</button>}
                      {item.sold&&<button className="hbtn" style={{...S.dashBtn,background:"#34C759",color:"#fff"}} onClick={()=>setRelistItem(item)}>RELIST</button>}
                      <button className="hbtn" style={{...S.dashBtn,background:"#fff",color:"#111",border:"1.5px solid #111",display:"inline-flex",alignItems:"center",gap:4}} onClick={()=>{setShareItem(item);setCopied(false);}}><Share2 width={12} height={12}/> SHARE</button>
                      <button className="hbtn" style={{...S.dashBtn,background:"#fff",color:"#FF1493",border:"1.5px solid #FF1493"}} onClick={()=>del(item.id)}>DELETE</button>
                    </div>
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
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,color:"#bbb",letterSpacing:1}}>No bundles yet. Bundle separate listings to offer a deal! <Gift width={14} height={14} style={{display:"inline",verticalAlign:"middle"}}/></p>
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
                  <p style={{fontSize:11,color:"#aaa",marginTop:10,textAlign:"center"}}>Instagram has no direct share API — the link is copied to your clipboard to paste in your story or bio.</p>
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
