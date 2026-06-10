import React from "react";
import { Zap, Heart, Share2, Ruler, Eye, Pin, Check, X, Mail, CreditCard, Lock, Star, Flag } from "lucide-react";
import { catEmoji, currencySymbol, OCC_COLOR, CARD_COLORS, parseMeasurements, convertMeasure } from "../lib/constants";
import { S } from "../styles";
import { Thumb } from "../components/Shared";

export default function Detail({
  view, setView, sel,
  selImages, selImgIdx, setSelImgIdx, selColor,
  wishlist, toggleWishlist, shareItem, setShowSizeGuide,
  isOwner, startConversation,
  user, setAuthMode,
  setShowPayment, setPaymentListing, setPaymentStep, setSelectedPostage,
  setShowReview, setShowReport,
  reviews,
  openEdit, markSold, relist, del,
  similarItems, openDetail,
  fastSellers = new Set(),
}) {
  // Buyer-side unit toggle — converts on the fly, never writes back (PART 2a).
  const [dispUnit, setDispUnit] = React.useState("cm");
  // Source of truth for measurements: prefer the new `measurements` JSON, fall
  // back to legacy bust/waist/… columns (which were always entered in inches).
  const meas = sel ? parseMeasurements(sel) : null;
  const storedUnit = meas?.unit || sel?.measurements_unit || "inches";
  const measRows = meas?.values && Object.keys(meas.values).length
    ? Object.entries(meas.values)
    : [["BUST",sel?.bust],["WAIST",sel?.waist],["HIPS",sel?.hips],["LENGTH",sel?.length],["UNDERBUST",sel?.underbust],["SHOULDER",sel?.shoulder],["HIGH HIP",sel?.high_hip],["SLEEVE",sel?.sleeve_length],["INSEAM",sel?.inseam]].filter(([,v])=>v);
  const hasMeas = sel && sel.listing_type!=="Jewellery" && measRows.length>0;
  const sellerNotes = sel ? (sel.additional_measurements||sel.measurement_notes) : "";
  return (
    <>
      {view==="detail"&&sel&&(
        <main style={S.main}>
          <button style={S.back} onClick={()=>setView("shop")}>← BACK</button>
          <div style={S.detailWrap} className="detail-wrap">
            <div style={S.detailImgWrap} className="detail-img">
              <div style={{...S.detailPanel,background:selImages.length>0?"#000":selColor,overflow:"hidden"}}>
                {selImages.length>0?<img src={selImages[selImgIdx]} alt={sel.name} style={{width:"100%",height:"100%",objectFit:"cover",opacity:0.92}}/>:<span style={{fontSize:120}}>{sel.emoji||catEmoji(sel.category)}</span>}
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
            <div style={S.detailInfo} className="detail-info">
              <p style={{...S.cardCatLabel,color:selColor,fontSize:12,marginBottom:8}}>{sel.category?.toUpperCase()} · {(sel.material||sel.fabric)?.toUpperCase()} · {sel.condition?.toUpperCase()}</p>
              <h2 style={S.detailName}>{sel.name}</h2>
              <div style={{...S.detailPrice,color:selColor}}>{currencySymbol(sel.currency)}{sel.price}</div>
              {fastSellers.has(sel.user_id)&&<div style={{display:"inline-flex",alignItems:"center",gap:6,background:"#007AFF",color:"#fff",padding:"4px 12px",fontSize:11,fontWeight:800,letterSpacing:1.5,fontFamily:"'Barlow Condensed',sans-serif",marginBottom:16}}><Zap width={14} height={14} fill="currentColor"/> FAST SELLER</div>}
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
                <button className="hbtn" style={{...S.hBtn,display:"inline-flex",alignItems:"center",gap:6,background:wishlist.includes(sel.id)?"#FF1493":"#fff",color:wishlist.includes(sel.id)?"#fff":"#111",border:"2px solid #111",fontSize:13,padding:"8px 16px"}} onClick={()=>toggleWishlist(sel.id)}><Heart width={15} height={15} fill={wishlist.includes(sel.id)?"currentColor":"none"}/> {wishlist.includes(sel.id)?"SAVED":"SAVE"}</button>
                <button className="hbtn" style={{...S.hBtn,display:"inline-flex",alignItems:"center",gap:6,background:"#fff",color:"#111",border:"2px solid #111",fontSize:13,padding:"8px 16px"}} onClick={()=>shareItem(sel)}><Share2 width={15} height={15}/> SHARE</button>
                <button className="hbtn" style={{...S.hBtn,display:"inline-flex",alignItems:"center",gap:6,background:"#fff",color:"#111",border:"2px solid #111",fontSize:13,padding:"8px 16px"}} onClick={()=>setShowSizeGuide(true)}><Ruler width={15} height={15}/> SIZE GUIDE</button>
              </div>
              {sel.views>0&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:"#bbb",letterSpacing:1,display:"flex",alignItems:"center",gap:5,marginBottom:16}}><Eye width={13} height={13}/> {sel.views} VIEWS</span>}
              {(sel.occasions||[]).length>0&&(
                <div style={S.dBlock}><p style={{...S.dBlockTitle,borderColor:selColor,color:selColor}}>OCCASIONS</p><div style={S.occRow}>{sel.occasions.map(o=><span key={o} style={{...S.occChip,background:OCC_COLOR[o]||"#999",color:"#fff"}}>{o.toUpperCase()}</span>)}</div></div>
              )}
              {hasMeas&&(
                <div style={S.dBlock}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
                    <p style={{...S.dBlockTitle,borderColor:selColor,color:selColor,marginBottom:0}}>MEASUREMENTS</p>
                    <div style={{display:"flex",gap:0}}>
                      {[["cm","CM"],["inches","INCHES"]].map(([u,l])=>(
                        <button key={u} type="button" onClick={()=>setDispUnit(u)} style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1,fontSize:11,padding:"6px 12px",cursor:"pointer",border:"2px solid #111",borderRadius:0,background:dispUnit===u?"#FF1493":"#fff",color:dispUnit===u?"#fff":"#111"}}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div style={S.measBoxRow}>
                    {measRows.map(([l,v])=>(
                      <div key={l} style={{...S.measBox,borderColor:selColor}}><div style={{...S.measVal,color:selColor}}>{convertMeasure(v,storedUnit,dispUnit)}{dispUnit==="inches"?"in":"cm"}</div><div style={S.measLbl}>{String(l).toUpperCase()}</div></div>
                    ))}
                  </div>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:"#bbb",letterSpacing:1,marginBottom:10,display:"flex",alignItems:"center",gap:5}}><Ruler width={13} height={13}/> LISTED IN {storedUnit==="inches"?"INCHES":"CM"} BY SELLER</p>
                  {sel.size&&<p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,letterSpacing:1,color:"#888",marginBottom:10}}>SIZE: {sel.size}</p>}
                  {sellerNotes&&(
                    <div style={{marginBottom:12}}>
                      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:900,letterSpacing:2,color:"#888",marginBottom:4}}>SELLER'S NOTES</p>
                      <p style={{...S.measNote,display:"flex",alignItems:"flex-start",gap:6}}><Pin width={14} height={14} style={{flexShrink:0,marginTop:2}}/> {sellerNotes}</p>
                    </div>
                  )}
                  <div style={S.alterRow}>
                    <div style={{...S.alterBadge,...(sel.can_take_in?S.aY:S.aN),display:"inline-flex",alignItems:"center",gap:5}}>{sel.can_take_in?<><Check width={13} height={13}/> CAN BE TAKEN IN</>:<><X width={13} height={13}/> CANNOT TAKE IN</>}</div>
                    <div style={{...S.alterBadge,...(sel.spare_fabric?S.aY2:S.aN),display:"inline-flex",alignItems:"center",gap:5}}>{sel.spare_fabric?<><Check width={13} height={13}/> SPARE FABRIC INCLUDED</>:<><X width={13} height={13}/> NO SPARE FABRIC</>}</div>
                  </div>
                </div>
              )}
              {sel.description&&<p style={S.detailDesc}>{sel.description}</p>}
              {!isOwner(sel)&&!sel.sold&&<button className="hbtn" style={{...S.waCta,background:"#FF1493",border:"none",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:10,marginBottom:16}} onClick={()=>startConversation(sel)}><Mail width={16} height={16}/> MESSAGE SELLER</button>}
              {!isOwner(sel)&&!sel.sold&&(
                <div style={{marginBottom:24}}>
                  <button className="hbtn" style={{...S.hBtn,background:"#111",border:"none",padding:"16px 32px",fontSize:16,letterSpacing:2,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:12}} onClick={()=>{ if(!user){setAuthMode("login");setView("auth");return;} setPaymentListing(sel); setPaymentStep("summary"); setSelectedPostage(null); setShowPayment(true); }}>
                    <CreditCard width={18} height={18}/> BUY NOW · {currencySymbol(sel.currency)}{sel.price}
                  </button>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#bbb",letterSpacing:1.5,textAlign:"center",marginTop:8,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}><Lock width={12} height={12}/> SECURE CHECKOUT · 5% PLATFORM FEE APPLIES</p>
                </div>
              )}
              {!isOwner(sel)&&user&&(
                <div style={{display:"flex",gap:10,marginBottom:24,flexWrap:"wrap"}}>
                  <button className="hbtn" style={{...S.hBtn,display:"inline-flex",alignItems:"center",gap:6,background:"#fff",color:"#FF9500",border:"2px solid #FF9500",fontSize:11,padding:"8px 14px"}} onClick={()=>setShowReview(true)}><Star width={14} height={14} fill="currentColor"/> LEAVE A REVIEW</button>
                  <button className="hbtn" style={{...S.hBtn,display:"inline-flex",alignItems:"center",gap:6,background:"#fff",color:"#888",border:"2px solid #e0e0e0",fontSize:11,padding:"8px 14px"}} onClick={()=>setShowReport(true)}><Flag width={14} height={14}/> REPORT</button>
                </div>
              )}
              {reviews.length>0&&(
                <div style={S.dBlock}>
                  <p style={{...S.dBlockTitle,borderColor:"#FF9500",color:"#FF9500"}}>SELLER REVIEWS ({reviews.length})</p>
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    {reviews.slice(0,3).map(r=>(
                      <div key={r.id} style={S.reviewCard}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                          <span style={{display:"inline-flex",alignItems:"center",color:"#FF9500"}}>{Array.from({length:r.rating}).map((_,i)=><Star key={i} width={14} height={14} fill="currentColor"/>)}</span>
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#bbb"}}>{new Date(r.created_at).toLocaleDateString("en-GB",{month:"short",year:"numeric"}).toUpperCase()}</span>
                        </div>
                        {r.comment&&<p style={{fontSize:13,color:"#666",lineHeight:1.5}}>{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {isOwner(sel)&&(
                <div style={S.actRow}>
                  <button className="hbtn" style={{...S.actBtn,background:selColor}} onClick={()=>openEdit(sel)}>EDIT</button>
                  {!sel.sold&&<button className="hbtn" style={{...S.actBtn,background:"#111"}} onClick={()=>markSold(sel.id,sel.sold)}>MARK SOLD</button>}
                  {sel.sold&&<button className="hbtn" style={{...S.actBtn,background:"#34C759"}} onClick={()=>relist(sel.id)}>RELIST</button>}
                  <button className="hbtn" style={{...S.actBtn,background:"#fff",color:"#111",border:"2px solid #111"}} onClick={()=>del(sel.id)}>DELETE</button>
                </div>
              )}
            </div>
          </div>
          {similarItems.length>0&&(
            <div style={{marginTop:48}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #FF1493",paddingLeft:12,marginBottom:20}}>YOU MIGHT ALSO LIKE</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:3}}>
                {similarItems.map((item,idx)=>{
                  const accent=CARD_COLORS[idx%CARD_COLORS.length];
                  return(
                    <article key={item.id} className="scard" style={{...S.card,borderColor:accent,opacity:item.sold?0.55:1}} onClick={()=>openDetail(item)}>
                      <Thumb src={item.image_url||(item.images&&item.images[0])||""} emoji={item.emoji||catEmoji(item.category)} accent={accent} style={{...S.cardTop,height:160}} emojiStyle={{fontSize:56}}>
                        {item.sold&&<div style={S.soldVeil}><span style={S.soldStamp}>SOLD</span></div>}
                      </Thumb>
                      <div style={{...S.cardBody,padding:"12px 14px 10px"}}>
                        <p style={{...S.cardCatLabel,color:accent,marginBottom:2}}>{item.category?.toUpperCase()}</p>
                        <p style={{...S.cardName,fontSize:16,marginBottom:8}}>{item.name}</p>
                        <div style={S.cardFoot}><span style={{...S.cardPrice,color:accent,fontSize:20}}>{currencySymbol(item.currency)}{item.price}</span></div>
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
    </>
  );
}
