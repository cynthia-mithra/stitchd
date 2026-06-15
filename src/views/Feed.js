import React from "react";
import { CARD_COLORS, catEmoji, currencySymbol } from "../lib/constants";
import { S } from "../styles";

// Phase 13 PART 4 — the FOLLOWING feed. Reached from the SHOP / FOLLOWING tab
// strip (mirrored on the main shop) and the nav. Shows the latest listings from
// sellers the user follows, newest first. When the user follows no one, a nudge
// with a DISCOVER SELLERS button (→ shop) takes its place.
export default function Feed({
  view, setView, user,
  feedLoading, following, feedItems, openDetail,
  goShop = () => setView("shop"),
}) {
  if(view!=="feed") return null;
  if(!user) return null;
  return (
    <main style={S.main}>
      {/* SHOP / FOLLOWING tabs — the same strip the shop shows, so the two read
          as tabs of one page. */}
      <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap"}}>
        <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111",borderRadius:0,fontSize:12,padding:"8px 20px"}} onClick={goShop}>SHOP</button>
        <button className="hbtn" style={{...S.hBtn,background:"#FF1493",color:"#fff",border:"2px solid #111",borderRadius:0,fontSize:12,padding:"8px 20px"}}>FOLLOWING ✦</button>
      </div>
      <div style={{marginBottom:36,paddingBottom:24,borderBottom:"3px solid #111"}}>
        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:4,color:"#FF1493",marginBottom:6}}>YOUR FEED</p>
        <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:48,fontWeight:900,letterSpacing:-1,lineHeight:1}}>FOLLOWING ✦</h2>
      </div>
      {feedLoading&&<div style={S.loadingWrap}><div style={S.spinner}/></div>}
      {!feedLoading&&following.length===0&&(
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <p style={{fontSize:48,marginBottom:12}}>✦</p>
          <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,marginBottom:16,letterSpacing:0.5}}>FOLLOW SELLERS TO SEE THEIR LATEST LISTINGS HERE</p>
          <button className="hbtn" style={{...S.hBtn,background:"#FF1493",color:"#fff",border:"2px solid #111",borderRadius:0,fontSize:13,padding:"12px 22px"}} onClick={goShop}>DISCOVER SELLERS</button>
        </div>
      )}
      {!feedLoading&&following.length>0&&feedItems.length===0&&(
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:900,color:"#bbb",letterSpacing:0.5}}>THE SELLERS YOU FOLLOW HAVEN'T LISTED ANYTHING YET.</p>
        </div>
      )}
      {!feedLoading&&feedItems.length>0&&(
        <div style={S.grid}>
          {feedItems.map((item,idx)=>{
            const accent=CARD_COLORS[idx%CARD_COLORS.length];
            return(
              <article key={item.id} className="scard" style={{...S.card,borderColor:accent}} onClick={()=>openDetail(item)}>
                <div style={{...S.cardTop,background:item.image_url?"#000":accent,overflow:"hidden"}}>
                  {item.image_url?<img src={item.image_url} alt={item.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={S.cardEmoji}>{item.emoji||catEmoji(item.category)}</span>}
                  {item.sold&&<div style={S.soldVeil}><span style={S.soldStamp}>SOLD</span></div>}
                </div>
                <div style={S.cardBody}>
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
  );
}
