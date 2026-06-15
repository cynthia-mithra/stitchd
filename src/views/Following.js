import React from "react";
import { Users, UserMinus } from "lucide-react";
import { S } from "../styles";
import { VerifiedBadge } from "../components/Shared";

// Phase 13 PART 5 — MY FOLLOWING. Lists every seller the signed-in user follows.
// Each row shows the seller avatar, name, a VERIFIED SELLER badge when applicable
// and their active-listing count; tapping the row opens the seller's storefront,
// and the UNFOLLOW button removes the follow in place. Empty state nudges the user
// to DISCOVER SELLERS (→ shop). Design system: Barlow Condensed, #FF1493, #111
// 2px borders, no radius.
export default function Following({
  view, setView, user,
  loading, profiles = [], counts = {},
  verifiedSellers = new Set(), openProfile, toggleFollow,
}) {
  if(view!=="following-list") return null;
  if(!user) return null;
  return (
    <main style={S.main}>
      <button style={S.back} onClick={()=>setView("shop")}>← BACK</button>
      <div style={{marginBottom:32,paddingBottom:24,borderBottom:"3px solid #111"}}>
        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:4,color:"#FF1493",marginBottom:6}}>YOUR SELLERS</p>
        <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:48,fontWeight:900,letterSpacing:-1,lineHeight:1,display:"flex",alignItems:"center",gap:12}}><Users width={40} height={40}/> MY FOLLOWING</h2>
      </div>

      {loading&&<div style={S.loadingWrap}><div style={S.spinner}/></div>}

      {!loading&&profiles.length===0&&(
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <p style={{display:"flex",justifyContent:"center",marginBottom:14,color:"#ccc"}}><Users width={48} height={48}/></p>
          <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,marginBottom:16,letterSpacing:0.5}}>YOU'RE NOT FOLLOWING ANY SELLERS YET</p>
          <button className="hbtn" style={{...S.hBtn,background:"#FF1493",color:"#fff",border:"2px solid #111",borderRadius:0,fontSize:13,padding:"12px 22px"}} onClick={()=>setView("shop")}>DISCOVER SELLERS</button>
        </div>
      )}

      {!loading&&profiles.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:10,maxWidth:680}}>
          {profiles.map(p=>{
            const name=p.full_name||p.username||"Seller";
            const count=counts[p.id]||0;
            return (
              <div key={p.id} role="button" tabIndex={0} onClick={()=>openProfile(p.id)} onKeyDown={e=>{ if(e.key==="Enter") openProfile(p.id); }}
                style={{border:"2px solid #111",borderRadius:0,padding:"12px 14px",display:"flex",alignItems:"center",gap:14,cursor:"pointer",background:"#fff"}}>
                <div style={{width:52,height:52,borderRadius:"50%",border:"2px solid #111",overflow:"hidden",flexShrink:0,background:"#FF1493",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {p.avatar_url
                    ? <img src={p.avatar_url} alt={name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    : <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:900,color:"#fff"}}>{name[0].toUpperCase()}</span>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:900,color:"#111",lineHeight:1.1,letterSpacing:0.3,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    {name}
                    {verifiedSellers.has(p.id)&&<VerifiedBadge size="sm"/>}
                  </p>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,letterSpacing:1.5,color:"#999",marginTop:2}}>{count} ACTIVE LISTING{count!==1?"S":""}</p>
                </div>
                <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#FF1493",border:"2px solid #FF1493",borderRadius:0,fontSize:11,padding:"8px 14px",flexShrink:0,display:"inline-flex",alignItems:"center",gap:6}}
                  onClick={e=>{ e.stopPropagation(); toggleFollow(p.id); }}>
                  <UserMinus width={14} height={14}/> UNFOLLOW
                </button>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
