import React from "react";
import { Zap, Heart, Share2, Ruler, Eye, Pin, Check, X, Mail, CreditCard, Lock, Star, Flag, ShoppingBag, Shield, MessageCircle, Clock, Trash2, CornerDownRight } from "lucide-react";
import { catEmoji, currencySymbol, OCC_COLOR, CARD_COLORS, parseMeasurements, convertMeasure, colourSwatchBg } from "../lib/constants";
import { S } from "../styles";
import { Thumb, Stars, VerifiedBadge, IDVerifiedBadge } from "../components/Shared";

// Phase 14 — compact relative time for comments, e.g. "2 hours ago".
function timeAgo(ts){
  if(!ts) return "";
  const secs=Math.max(0,Math.floor((Date.now()-new Date(ts).getTime())/1000));
  const units=[["year",31536000],["month",2592000],["week",604800],["day",86400],["hour",3600],["minute",60]];
  for(const [name,size] of units){
    const n=Math.floor(secs/size);
    if(n>=1) return `${n} ${name}${n!==1?"s":""} ago`;
  }
  return "just now";
}

export default function Detail({
  view, setView, sel,
  selImages, selImgIdx, setSelImgIdx, selColor,
  wishlist, toggleWishlist, shareItem, setShowSizeGuide,
  inBag = () => false, toggleBag = () => {},
  isOwner, startConversation,
  user, setAuthMode, buyNow = () => {},
  setShowPayment, setPaymentListing, setPaymentStep, setSelectedPostage,
  setShowReview, setShowReport,
  reviews,
  comments = [], commentText = "", setCommentText = () => {},
  submitComment = () => {}, deleteComment = () => {}, submitReply = () => {}, profile,
  openEdit, markSold, relist, del,
  similarItems, recentItems = [], openDetail,
  fastSellers = new Set(),
  verifiedSellers = new Set(),
  identityVerifiedSellers = new Set(),
}) {
  // Buyer-side unit toggle — converts on the fly, never writes back (PART 2a).
  const [dispUnit, setDispUnit] = React.useState("cm");
  // Phase 14 — split top-level questions from their replies. Replies point at
  // their parent via parent_comment_id and are grouped under it (oldest first,
  // so a thread reads top-to-bottom). Top-level questions stay newest-first.
  const topComments = comments.filter(c => !c.parent_comment_id);
  const repliesByParent = {};
  comments.forEach(c => {
    if (c.parent_comment_id) (repliesByParent[c.parent_comment_id] ||= []).push(c);
  });
  Object.values(repliesByParent).forEach(arr =>
    arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
  // Phase 14 — show only the 3 newest questions until "SHOW ALL COMMENTS".
  const [showAllComments, setShowAllComments] = React.useState(false);
  const visibleComments = showAllComments ? topComments : topComments.slice(0, 3);
  // Only one inline reply form open at a time, keyed by the question's id.
  const [replyingTo, setReplyingTo] = React.useState(null);
  const [replyText, setReplyText] = React.useState("");
  const isSellerViewer = sel && isOwner(sel);
  const closeReply = () => { setReplyingTo(null); setReplyText(""); };
  const postReply = (parent) => {
    if (!replyText.trim()) return;
    submitReply(parent, replyText.trim());
    closeReply();
  };
  // Shared comment display (avatar, username, SELLER badge, text, time ago) —
  // used for both top-level questions and the seller's replies.
  const renderCommentCard = (c) => {
    const isSeller = sel.user_id && c.user_id === sel.user_id;
    const mine = user && c.user_id === user.id;
    return (
      <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
        <div style={{width:32,height:32,borderRadius:"50%",border:"2px solid #111",background:"#FF1493",overflow:"hidden",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
          {c.avatar_url?<img src={c.avatar_url} alt={c.username} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:900,color:"#fff"}}>{(c.username||"S")[0].toUpperCase()}</span>}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:800,color:"#111",letterSpacing:0.5}}>{c.username}</span>
            {isSeller&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:800,letterSpacing:1.5,color:"#fff",background:"#FF1493",padding:"2px 7px"}}>SELLER</span>}
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:"#bbb",letterSpacing:1}}>{timeAgo(c.created_at)}</span>
            {mine&&<button type="button" onClick={()=>deleteComment(c.id)} title="Delete" style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:"#999",display:"inline-flex",padding:2}}><Trash2 width={15} height={15}/></button>}
          </div>
          <p style={{fontSize:13,color:"#444",lineHeight:1.5,margin:0,wordBreak:"break-word"}}>{c.content}</p>
        </div>
      </div>
    );
  };
  // Source of truth for measurements: prefer the new `measurements` JSON, fall
  // back to legacy bust/waist/… columns (which were always entered in inches).
  const meas = sel ? parseMeasurements(sel) : null;
  const storedUnit = meas?.unit || sel?.measurements_unit || "inches";
  const measRows = meas?.values && Object.keys(meas.values).length
    ? Object.entries(meas.values)
    : [["BUST",sel?.bust],["WAIST",sel?.waist],["HIPS",sel?.hips],["LENGTH",sel?.length],["UNDERBUST",sel?.underbust],["SHOULDER",sel?.shoulder],["HIGH HIP",sel?.high_hip],["SLEEVE",sel?.sleeve_length],["INSEAM",sel?.inseam]].filter(([,v])=>v);
  const hasMeas = sel && sel.listing_type!=="Jewellery" && measRows.length>0;
  const sellerNotes = sel ? (sel.additional_measurements||sel.measurement_notes) : "";
  // Seller's average across all their reviews — drives the prominent stars/score
  // shown under the price (e.g. "4.8 · 12 reviews").
  const avgRating = reviews.length ? reviews.reduce((a,r)=>a+r.rating,0)/reviews.length : 0;
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
              {sel.prev_price>sel.price&&<div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:700,color:"#999",textDecoration:"line-through",letterSpacing:-0.5,marginBottom:2}}>{currencySymbol(sel.currency)}{sel.prev_price}</div>}
              <div style={{...S.detailPrice,color:selColor,marginBottom:sel.prev_price>sel.price?6:16}}>{currencySymbol(sel.currency)}{sel.price}</div>
              {sel.prev_price>sel.price&&<div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:900,color:"#00E5CC",letterSpacing:0.5,marginBottom:16}}>YOU SAVE {currencySymbol(sel.currency)}{sel.prev_price-sel.price}</div>}
              {reviews.length>0&&(
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,fontFamily:"'Barlow Condensed',sans-serif"}}>
                  <Stars value={avgRating} size={20} color="#FF1493"/>
                  <span style={{fontSize:20,fontWeight:900,color:"#111",letterSpacing:0.5}}>{avgRating.toFixed(1)}</span>
                  <span style={{fontSize:15,fontWeight:700,color:"#888",letterSpacing:0.5}}>· {reviews.length} review{reviews.length!==1?"s":""}</span>
                </div>
              )}
              {user&&!isOwner(sel)&&(()=>{
                const bagged=inBag(sel.id);
                const soldStyle={background:"#e5e5e5",color:"#999",border:"2px solid #ccc",cursor:"not-allowed"};
                const baggedStyle={background:"#111",color:"#fff"};
                return (
                  <>
                    <button
                      className={sel.sold?"":"hbtn"}
                      disabled={sel.sold}
                      style={{...S.bagAddBtn,...(sel.sold?soldStyle:bagged?baggedStyle:{})}}
                      onClick={()=>{ if(!sel.sold) toggleBag(sel); }}>
                      <ShoppingBag width={18} height={18}/> {sel.sold?"SOLD":bagged?"ADDED TO BAG":"ADD TO BAG"}
                    </button>
                    {sel.sold&&<p style={{fontStyle:"italic",fontSize:13,color:"#999",marginTop:8,marginBottom:4}}>This piece has found a new home</p>}
                  </>
                );
              })()}
              <div style={S.guaranteeBanner}>
                <p style={S.guaranteeHeading}>STITCH'D BUYER GUARANTEE</p>
                <div style={S.guaranteeList}>
                  <span style={S.guaranteePoint}><Shield width={16} height={16} color="#00E5CC" style={{flexShrink:0}}/> Secure checkout powered by Stripe</span>
                  <span style={S.guaranteePoint}><MessageCircle width={16} height={16} color="#00E5CC" style={{flexShrink:0}}/> Message the seller directly before you buy</span>
                  <span style={S.guaranteePoint}><Clock width={16} height={16} color="#00E5CC" style={{flexShrink:0}}/> Report an issue within 48 hours of delivery</span>
                </div>
              </div>
              {(verifiedSellers.has(sel.user_id)||identityVerifiedSellers.has(sel.user_id)||fastSellers.has(sel.user_id))&&(
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:16}}>
                  {verifiedSellers.has(sel.user_id)&&<VerifiedBadge/>}
                  {identityVerifiedSellers.has(sel.user_id)&&<IDVerifiedBadge size="sm"/>}
                  {fastSellers.has(sel.user_id)&&<div style={{display:"inline-flex",alignItems:"center",gap:6,background:"#007AFF",color:"#fff",padding:"4px 12px",fontSize:11,fontWeight:800,letterSpacing:1.5,fontFamily:"'Barlow Condensed',sans-serif"}}><Zap width={14} height={14} fill="currentColor"/> FAST SELLER</div>}
                </div>
              )}
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
                <button className="hbtn" style={{...S.hBtn,display:"inline-flex",alignItems:"center",gap:6,background:wishlist.includes(sel.id)?"#FF1493":"#fff",color:wishlist.includes(sel.id)?"#fff":"#111",border:"2px solid #111",fontSize:13,padding:"8px 16px"}} onClick={()=>toggleWishlist(sel.id)}><Heart width={15} height={15} fill={wishlist.includes(sel.id)?"currentColor":"none"}/> {wishlist.includes(sel.id)?"SAVED":"SAVE"}</button>
                <button className="hbtn" style={{...S.hBtn,display:"inline-flex",alignItems:"center",gap:6,background:"#fff",color:"#111",border:"2px solid #111",fontSize:13,padding:"8px 16px"}} onClick={()=>shareItem(sel)}><Share2 width={15} height={15}/> SHARE</button>
                <button className="hbtn" style={{...S.hBtn,display:"inline-flex",alignItems:"center",gap:6,background:"#fff",color:"#111",border:"2px solid #111",fontSize:13,padding:"8px 16px"}} onClick={()=>setShowSizeGuide(true)}><Ruler width={15} height={15}/> SIZE GUIDE</button>
              </div>
              {sel.views>0&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:"#bbb",letterSpacing:1,display:"flex",alignItems:"center",gap:5,marginBottom:16}}><Eye width={13} height={13}/> {sel.views} VIEWS</span>}
              {(sel.occasions||[]).length>0&&(
                <div style={S.dBlock}><p style={{...S.dBlockTitle,borderColor:selColor,color:selColor}}>OCCASIONS</p><div style={S.occRow}>{sel.occasions.map(o=><span key={o} style={{...S.occChip,background:OCC_COLOR[o]||"#999",color:"#fff"}}>{o.toUpperCase()}</span>)}</div></div>
              )}
              {(sel.colours||[]).length>0&&(
                <div style={S.dBlock}><p style={{...S.dBlockTitle,borderColor:selColor,color:selColor}}>COLOUR</p>
                  <div style={{display:"flex",flexWrap:"wrap",gap:14}}>
                    {sel.colours.map(c=>(
                      <span key={c} style={{display:"inline-flex",alignItems:"center",gap:7,fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,letterSpacing:1,color:"#111"}}>
                        <span style={{width:20,height:20,borderRadius:"50%",background:colourSwatchBg(c),border:"1px solid rgba(0,0,0,0.18)",flexShrink:0}}/> {c.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
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
                  <button className="hbtn" style={{...S.hBtn,background:"#111",border:"none",padding:"16px 32px",fontSize:16,letterSpacing:2,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:12}} onClick={()=>buyNow(sel)}>
                    <CreditCard width={18} height={18}/> BUY NOW · {currencySymbol(sel.currency)}{sel.price}
                  </button>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#bbb",letterSpacing:1.5,textAlign:"center",marginTop:8,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}><Lock width={12} height={12}/> SECURE CHECKOUT · 5% PLATFORM FEE APPLIES</p>
                </div>
              )}
              {!isOwner(sel)&&user&&(
                <div style={{display:"flex",gap:10,marginBottom:24,flexWrap:"wrap"}}>
                  <button className="hbtn" style={{...S.hBtn,display:"inline-flex",alignItems:"center",gap:6,background:"#fff",color:"#FF9500",border:"2px solid #FF9500",fontSize:11,padding:"8px 14px"}} onClick={()=>setShowReview(true)}><Star width={14} height={14} fill="currentColor"/> LEAVE A REVIEW</button>
                </div>
              )}
              {reviews.length>0&&(
                <div style={S.dBlock}>
                  <p style={{...S.dBlockTitle,borderColor:"#FF1493",color:"#FF1493"}}>REVIEWS ({reviews.length})</p>
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    {reviews.map(r=>(
                      <div key={r.id} style={{border:"2px solid #111",borderRadius:0,padding:"14px 16px"}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                          <span style={{display:"inline-flex",alignItems:"center",gap:8}}>
                            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:800,color:"#111",letterSpacing:0.5}}>{r.reviewer_name||"Anonymous"}</span>
                            <Stars value={r.rating} size={13} color="#FF1493"/>
                          </span>
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#bbb",letterSpacing:1}}>{new Date(r.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}).toUpperCase()}</span>
                        </div>
                        {r.comment&&<p style={{fontSize:13,color:"#444",lineHeight:1.5,margin:0}}>{r.comment}</p>}
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
          {/* RECENTLY VIEWED — Phase 12. Listings the user has opened before (from
              localStorage, newest first, excluding the current one). Same card
              style as YOU MIGHT ALSO LIKE. Hidden when there's nothing to show. */}
          {recentItems.length>0&&(
            <div style={{marginTop:48}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #00E5CC",paddingLeft:12,marginBottom:20}}>RECENTLY VIEWED</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:3}}>
                {recentItems.map((item,idx)=>{
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
          {/* QUESTIONS & COMMENTS — Phase 14. Thread below reviews / above the
              footer: buyers ask questions, the seller can reply inline. Replies
              are shown indented under their question. */}
          <div style={{marginTop:48}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #FF1493",paddingLeft:12,marginBottom:20}}>QUESTIONS &amp; COMMENTS</div>
            {topComments.length>0&&(
              <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:24}}>
                {visibleComments.map(c=>{
                  const replies=repliesByParent[c.id]||[];
                  return(
                    <div key={c.id}>
                      <div style={{border:"2px solid #111",borderRadius:0,padding:"14px 16px"}}>
                        {renderCommentCard(c)}
                        {/* REPLY — seller only. Opens an inline reply form below. */}
                        {isSellerViewer&&replyingTo!==c.id&&(
                          <button type="button" onClick={()=>{setReplyingTo(c.id);setReplyText("");}} style={{marginTop:10,marginLeft:44,background:"none",border:"none",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,letterSpacing:1,color:"#999",display:"inline-flex",alignItems:"center",gap:5,padding:0}}><CornerDownRight width={14} height={14}/> REPLY</button>
                        )}
                      </div>
                      {/* INLINE REPLY FORM — directly below the question. */}
                      {isSellerViewer&&replyingTo===c.id&&(
                        <div style={{marginLeft:24,marginTop:10,paddingLeft:14,borderLeft:"2px solid #111"}}>
                          <textarea value={replyText} maxLength={300} onChange={e=>setReplyText(e.target.value)} placeholder="Reply to this question..." style={{...S.inp,height:72,resize:"vertical",fontFamily:"'Barlow Condensed',sans-serif",marginBottom:6}}/>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
                            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,color:"#bbb",letterSpacing:1}}>{replyText.length} / 300</span>
                            <div style={{display:"flex",alignItems:"center",gap:14}}>
                              <button type="button" onClick={closeReply} style={{background:"none",border:"none",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,color:"#999",padding:0}}>CANCEL</button>
                              <button type="button" onClick={()=>postReply(c)} disabled={!replyText.trim()} style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:1.5,color:"#fff",background:"#111",border:"2px solid #111",borderRadius:0,padding:"8px 18px",cursor:replyText.trim()?"pointer":"not-allowed",opacity:replyText.trim()?1:0.5}}>POST REPLY</button>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* REPLIES — indented under their question, always fully visible. */}
                      {replies.length>0&&(
                        <div style={{marginLeft:24,marginTop:10,paddingLeft:14,borderLeft:"2px solid #111",display:"flex",flexDirection:"column",gap:10}}>
                          {replies.map(r=>(
                            <div key={r.id} style={{border:"2px solid #111",borderRadius:0,padding:"14px 16px"}}>
                              {renderCommentCard(r)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {topComments.length>3&&!showAllComments&&(
                  <button type="button" onClick={()=>setShowAllComments(true)} style={{alignSelf:"flex-start",background:"none",border:"none",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:800,letterSpacing:1.5,color:"#FF1493",padding:2}}>SHOW ALL COMMENTS ({topComments.length})</button>
                )}
              </div>
            )}
            {user?(
              <div>
                <textarea value={commentText} maxLength={300} onChange={e=>setCommentText(e.target.value)} placeholder="Ask a question about this listing..." style={{...S.inp,height:84,resize:"vertical",fontFamily:"'Barlow Condensed',sans-serif",marginBottom:6}}/>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,color:"#bbb",letterSpacing:1}}>{commentText.length} / 300</span>
                  <button type="button" onClick={submitComment} disabled={!commentText.trim()} style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:1.5,color:"#fff",background:"#FF1493",border:"2px solid #111",borderRadius:0,padding:"9px 22px",cursor:commentText.trim()?"pointer":"not-allowed",opacity:commentText.trim()?1:0.5}}>POST</button>
                </div>
              </div>
            ):(
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,color:"#888",letterSpacing:0.5}}>
                <button type="button" onClick={()=>{setAuthMode("login");setView("auth");}} style={{background:"none",border:"none",cursor:"pointer",color:"#FF1493",fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:800,letterSpacing:0.5,padding:0,textDecoration:"underline"}}>Log in</button> to ask a question
              </p>
            )}
          </div>
          {/* REPORT THIS LISTING — small, unobtrusive link at the very bottom of the
              page. Logged-in users only (issue PART 1). */}
          {user&&(
            <div style={{display:"flex",justifyContent:"center",marginTop:40}}>
              <button type="button" onClick={()=>setShowReport(true)} style={{display:"inline-flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:0.5,color:"#999",padding:6}}>
                <Flag width={14} height={14}/> Report this listing
              </button>
            </div>
          )}
        </main>
      )}
    </>
  );
}
