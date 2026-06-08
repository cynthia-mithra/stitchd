import React from "react";
import { catEmoji, currencySymbol, OCC_COLOR, CARD_COLORS } from "../lib/constants";
import { S } from "../styles";

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
}) {
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
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
                <button className="hbtn" style={{...S.hBtn,background:wishlist.includes(sel.id)?"#FF1493":"#fff",color:wishlist.includes(sel.id)?"#fff":"#111",border:"2px solid #111",fontSize:13,padding:"8px 16px"}} onClick={()=>toggleWishlist(sel.id)}>{wishlist.includes(sel.id)?"❤️ SAVED":"🤍 SAVE"}</button>
                <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111",fontSize:13,padding:"8px 16px"}} onClick={()=>shareItem(sel)}>🔗 SHARE</button>
                <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111",fontSize:13,padding:"8px 16px"}} onClick={()=>setShowSizeGuide(true)}>📏 SIZE GUIDE</button>
              </div>
              {sel.views>0&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:"#bbb",letterSpacing:1,display:"block",marginBottom:16}}>👁 {sel.views} VIEWS</span>}
              {(sel.occasions||[]).length>0&&(
                <div style={S.dBlock}><p style={{...S.dBlockTitle,borderColor:selColor,color:selColor}}>OCCASIONS</p><div style={S.occRow}>{sel.occasions.map(o=><span key={o} style={{...S.occChip,background:OCC_COLOR[o]||"#999",color:"#fff"}}>{o.toUpperCase()}</span>)}</div></div>
              )}
              {sel.listing_type!=="Jewellery"&&(sel.bust||sel.waist||sel.hips||sel.length)&&(
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
              {!isOwner(sel)&&!sel.sold&&<button className="hbtn" style={{...S.waCta,background:"#FF1493",border:"none",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:10,marginBottom:16}} onClick={()=>startConversation(sel)}>✉️ MESSAGE SELLER</button>}
              {!isOwner(sel)&&!sel.sold&&(
                <div style={{marginBottom:24}}>
                  <button className="hbtn" style={{...S.hBtn,background:"#111",border:"none",padding:"16px 32px",fontSize:16,letterSpacing:2,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:12}} onClick={()=>{ if(!user){setAuthMode("login");setView("auth");return;} setPaymentListing(sel); setPaymentStep("summary"); setSelectedPostage(null); setShowPayment(true); }}>
                    💳 BUY NOW · {currencySymbol(sel.currency)}{sel.price}
                  </button>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#bbb",letterSpacing:1.5,textAlign:"center",marginTop:8}}>🔒 SECURE CHECKOUT · 5% PLATFORM FEE APPLIES</p>
                </div>
              )}
              {!isOwner(sel)&&user&&(
                <div style={{display:"flex",gap:10,marginBottom:24,flexWrap:"wrap"}}>
                  <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#FF9500",border:"2px solid #FF9500",fontSize:11,padding:"8px 14px"}} onClick={()=>setShowReview(true)}>⭐ LEAVE A REVIEW</button>
                  <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#888",border:"2px solid #e0e0e0",fontSize:11,padding:"8px 14px"}} onClick={()=>setShowReport(true)}>🚩 REPORT</button>
                </div>
              )}
              {reviews.length>0&&(
                <div style={S.dBlock}>
                  <p style={{...S.dBlockTitle,borderColor:"#FF9500",color:"#FF9500"}}>SELLER REVIEWS ({reviews.length})</p>
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    {reviews.slice(0,3).map(r=>(
                      <div key={r.id} style={S.reviewCard}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                          <span style={{fontSize:14}}>{Array(r.rating).fill("⭐").join("")}</span>
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
                      <div style={{...S.cardTop,background:item.image_url?"#000":accent,overflow:"hidden",height:160}}>
                        {item.image_url?<img src={item.image_url} alt={item.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:56}}>{item.emoji||catEmoji(item.category)}</span>}
                        {item.sold&&<div style={S.soldVeil}><span style={S.soldStamp}>SOLD</span></div>}
                      </div>
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
