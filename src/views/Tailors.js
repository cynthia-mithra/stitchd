import React from "react";
import { S } from "../styles";
import MeasuringGuide, { GeneralTips } from "./MeasuringGuide";

// HOW TO MEASURE — standalone guide page. (The old tailor_services marketplace
// that used to live here was retired in favour of the Phase 15 tailor directory;
// see TailorProfiles.js.)
export default function Tailors({ view, setView, user, prevView }) {
  if(view!=="measuring") return null;
  return (
    <main style={{...S.main,maxWidth:900}}>
      <button style={S.back} onClick={()=>setView(prevView||"shop")}>← BACK</button>
      <div style={{marginBottom:36,paddingBottom:24,borderBottom:"3px solid #111"}}>
        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:4,color:"#FF1493",marginBottom:6}}>YOUR COMPLETE GUIDE</p>
        <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:56,fontWeight:900,letterSpacing:-1,lineHeight:1,marginBottom:12}}>HOW TO<br/><span style={{color:"#FF1493"}}>MEASURE.</span></h1>
      </div>
      <MeasuringGuide/>
      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:3,color:"#888",marginBottom:12,textTransform:"uppercase"}}>Quick Size Reference</p>
      <div style={{overflowX:"auto",marginBottom:40}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13}}>
          <thead><tr style={{background:"#111",color:"#fff"}}>{["SIZE","BUST","WAIST","HIPS","UK","US/CA","EU"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:800,letterSpacing:1.5,fontSize:11}}>{h}</th>)}</tr></thead>
          <tbody>
            {[["XXS","30–31","24–25","32–33","4–6","0–2","32–34"],["XS","32–33","26–27","34–35","6–8","2–4","34–36"],["S","34–35","28–29","36–37","8–10","4–6","36–38"],["M","36–37","30–31","38–39","10–12","6–8","38–40"],["L","38–39","32–33","40–41","12–14","8–10","40–42"],["XL","40–41","34–35","42–43","14–16","10–12","42–44"],["XXL","42–43","36–37","44–45","16–18","12–14","44–46"]].map(([sz,...vals],i)=>(
              <tr key={sz} style={{background:i%2===0?"#fafafa":"#fff",borderBottom:"1px solid #f0f0f0"}}>
                <td style={{padding:"10px 14px",fontWeight:900,color:"#FF1493",fontSize:15}}>{sz}</td>
                {vals.map((v,j)=><td key={j} style={{padding:"10px 14px",color:"#555"}}>{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <GeneralTips/>
      <button className="hbtn" style={{...S.hBtn,background:"#FF1493",border:"none",padding:"16px 32px",fontSize:15,letterSpacing:3,width:"100%"}} onClick={()=>setView(user?"add":"auth")}>LIST A PIECE NOW →</button>
    </main>
  );
}
