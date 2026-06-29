import React from "react";
import { Users, UserMinus } from "lucide-react";
import { S } from "../styles";
import { VerifiedBadge } from "../components/Shared";

// Phase 13 - MY FOLLOWING. Lists every seller the signed-in user follows, with
// their avatar, name, verified badge, active-listing count and an UNFOLLOW
// button. Tapping a row opens that seller's storefront. Reached from the nav
// dropdown ("MY FOLLOWING"); logged-in only.
export default function Following({
  view, setView, user,
  followingProfiles = [], followingLoading = false,
  toggleFollow = () => {}, openProfile = () => {},
}) {
  if(view!=="following-list") return null;
  if(!user) return null;
  return (
    <main style={{...S.main,maxWidth:760}}>
      <button style={S.back} onClick={()=>setView("shop")}>← BACK</button>
      <div style={{marginBottom:28,paddingBottom:20,borderBottom:"3px solid #111"}}>
        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:2.5,color:"#FF1493",marginBottom:6,display:"flex",alignItems:"center",gap:8}}><Users width={16} height={16}/> YOUR SELLERS</p>
        <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:44,fontWeight:900,letterSpacing:-1,lineHeight:1}}>MY FOLLOWING</h2>
      </div>

      {followingLoading&&<div style={S.loadingWrap}><div style={S.spinner}/></div>}

      {!followingLoading&&followingProfiles.length===0&&(
        <div style={{textAlign:"center",padding:"56px 20px"}}>
          <p style={{display:"flex",justifyContent:"center",marginBottom:12,color:"#808080"}}><Users width={48} height={48}/></p>
          <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,marginBottom:18}}>You're not following any sellers yet</p>
          <button className="hbtn" style={{...S.hBtn,fontSize:13,padding:"12px 22px",border:"2px solid #111"}} onClick={()=>setView("shop")}>DISCOVER SELLERS →</button>
        </div>
      )}

      {!followingLoading&&followingProfiles.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {followingProfiles.map(p=>(
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:14,border:"2px solid #111",borderRadius:0,padding:"12px 14px"}}>
              <div onClick={()=>openProfile(p.id)} style={{width:54,height:54,flexShrink:0,borderRadius:"50%",border:"2px solid #111",overflow:"hidden",background:"#FF1493",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                {p.avatar_url?<img src={p.avatar_url} alt={p.full_name||p.username} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,color:"#fff"}}>{(p.full_name||p.username||"S")[0].toUpperCase()}</span>}
              </div>
              <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>openProfile(p.id)}>
                <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,color:"#111",lineHeight:1.1,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",overflow:"hidden"}}>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.full_name||p.username||"Seller"}</span>
                  {p.verified&&<VerifiedBadge size="sm"/>}
                </p>
                <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,color:"#6b6b6b",letterSpacing:1,marginTop:2}}>{p.activeCount||0} active listing{(p.activeCount||0)!==1?"s":""}</p>
              </div>
              <button className="hbtn" style={{...S.hBtn,fontSize:11,padding:"9px 14px",border:"2px solid #111",background:"#fff",color:"#111",borderRadius:0,flexShrink:0}} onClick={()=>toggleFollow(p.id)}>
                <span style={{display:"inline-flex",alignItems:"center",gap:6}}><UserMinus width={14} height={14}/> UNFOLLOW</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
