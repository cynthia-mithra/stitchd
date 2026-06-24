import React from "react";
import { CARD_COLORS, catEmoji, currencySymbol } from "../lib/constants";
import { S } from "../styles";

export default function Feed({
  view, setView, user,
  feedLoading, following, feedItems, openDetail,
}) {
  if(view!=="feed") return null;
  if(!user) return null;
  return (
    <main style={S.main}>
      <button style={S.back} onClick={()=>setView("shop")}>← BACK</button>
      <div style={{marginBottom:36,paddingBottom:24,borderBottom:"3px solid #111"}}>
        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:2.5,color:"#FF1493",marginBottom:6}}>YOUR FEED</p>
        <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:48,fontWeight:900,letterSpacing:-1,lineHeight:1}}>FOLLOWING ✦</h2>
      </div>
      {feedLoading&&<div style={S.loadingWrap}><div style={S.spinner}/></div>}
      {!feedLoading&&following.length===0&&(
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <p style={{fontSize:48,marginBottom:12}}>✦</p>
          <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:900,marginBottom:8}}>YOU'RE NOT FOLLOWING ANYONE YET.</p>
          <button className="hbtn" style={S.hBtn} onClick={()=>setView("shop")}>BROWSE DROPS →</button>
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
