import React from "react";

export function Sec({label,children}){return<div style={{marginBottom:36}}><div style={{fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #FF1493",paddingLeft:12,marginBottom:18,textTransform:"uppercase"}}>{label}</div>{children}</div>;}
export function F({l,children,style}){return<div style={{display:"flex",flexDirection:"column",gap:5,...style}}><label style={{fontSize:10,fontWeight:800,color:"#999",letterSpacing:1.5,textTransform:"uppercase"}}>{l}</label>{children}</div>;}
// Listing thumbnail with a graceful fallback. Renders the uploaded photo when
// `src` is present AND it actually loads; if the URL is empty OR the image fails
// to load (e.g. a broken link, or the Supabase `listings` storage bucket isn't
// public so the public URL 403s) it falls back to the category emoji on the
// accent background instead of an ugly broken-image icon. `gradient` adds the
// bottom darkening overlay used on the main grid cards; `children` are overlays
// (SOLD veil, badges, heart button…) layered on top.
export function Thumb({src,emoji,accent,gradient=false,imgOpacity=1,imgStyle,emojiStyle,style,children}){
  const [ok,setOk]=React.useState(true);
  const showImg=!!src&&ok;
  return (
    <div style={{position:"relative",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",...style,background:showImg?"#000":accent}}>
      {showImg
        ?<img src={src} alt="" onError={()=>setOk(false)} style={{width:"100%",height:"100%",objectFit:"cover",opacity:imgOpacity,...imgStyle}}/>
        :<span style={emojiStyle}>{emoji}</span>}
      {showImg&&gradient&&<div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 50%,rgba(0,0,0,0.45))"}}/>}
      {children}
    </div>
  );
}
export function Tog({on,onToggle,color,label,sub}){return<div style={{display:"flex",alignItems:"flex-start",gap:14,padding:"14px 0",borderBottom:"1px solid #f0f0f0",cursor:"pointer"}} onClick={onToggle}><div style={{width:46,height:26,borderRadius:13,background:on?color:"#e0e0e0",position:"relative",flexShrink:0,transition:"background .2s",border:`2px solid ${on?color:"#ccc"}`}}><div style={{width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:on?24:2,transition:"left .18s",boxShadow:"0 2px 6px rgba(0,0,0,0.2)"}}/></div><div><div style={{fontSize:13,fontWeight:800,letterSpacing:0.5,color:"#111"}}>{label}</div><div style={{fontSize:12,color:"#aaa",marginTop:3}}>{sub}</div></div></div>;}
