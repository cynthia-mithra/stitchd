import React from "react";
import { CARD_COLORS, catEmoji, currencySymbol } from "../lib/constants";
import { S } from "../styles";
import { Sec, F, Thumb } from "../components/Shared";

export default function Dashboard({
  view, setView, user, myItems,
  // dashboard
  setSel, openEdit, markSold, relist, del,
  bundles, bundleItems, loadBundles, deleteBundle,
  // createbundle
  bundleForm, setBundleForm, toggleBundleListing, createBundle,
}) {
  if(view!=="dashboard"&&view!=="createbundle") return null;
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
              <div style={S.dashStat}><div style={{...S.dashStatNum,color:"#007AFF"}}>${myItems.filter(i=>i.sold).reduce((a,i)=>a+i.price,0)}</div><div style={S.dashStatLabel}>EARNED</div></div>
              <div style={S.dashStat}><div style={{...S.dashStatNum,color:"#BF5AF2"}}>{myItems.reduce((a,i)=>a+(i.views||0),0)}</div><div style={S.dashStatLabel}>VIEWS</div></div>
            </div>
          </div>
          {myItems.length===0?(
            <div style={{textAlign:"center",padding:"60px 20px"}}><p style={{fontSize:48,marginBottom:12}}>🥻</p><p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:900,marginBottom:8}}>NO LISTINGS YET.</p><button className="hbtn" style={S.hBtn} onClick={()=>setView("add")}>LIST YOUR FIRST PIECE →</button></div>
          ):(
            <div style={S.dashGrid} className="dash-grid">
              {myItems.map((item,idx)=>(
                <div key={item.id} style={{...S.dashCard,borderColor:item.sold?"#ccc":CARD_COLORS[idx%CARD_COLORS.length]}}>
                  <Thumb src={item.image_url} emoji={item.emoji||catEmoji(item.category)} accent={CARD_COLORS[idx%CARD_COLORS.length]} imgOpacity={item.sold?0.5:1} style={S.dashCardImg} emojiStyle={{fontSize:44}}>
                    {item.sold&&<div style={S.soldVeil}><span style={S.soldStamp}>SOLD</span></div>}
                  </Thumb>
                  <div style={S.dashCardBody}>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:800,color:item.sold?"#aaa":"#111",marginBottom:4}}>{item.name}</p>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:900,color:item.sold?"#aaa":CARD_COLORS[idx%CARD_COLORS.length],marginBottom:4}}>${item.price}</p>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#bbb",letterSpacing:1,marginBottom:10}}>👁 {item.views||0} VIEWS</p>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <button className="hbtn" style={{...S.dashBtn,background:CARD_COLORS[idx%CARD_COLORS.length],color:"#fff"}} onClick={()=>{setSel(item);openEdit(item);}}>EDIT</button>
                      {!item.sold&&<button className="hbtn" style={{...S.dashBtn,background:"#111",color:"#fff"}} onClick={()=>markSold(item.id,item.sold)}>MARK SOLD</button>}
                      {item.sold&&<button className="hbtn" style={{...S.dashBtn,background:"#34C759",color:"#fff"}} onClick={()=>relist(item.id)}>RELIST</button>}
                      <button className="hbtn" style={{...S.dashBtn,background:"#fff",color:"#FF1493",border:"1.5px solid #FF1493"}} onClick={()=>del(item.id)}>DELETE</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{marginTop:48}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,paddingBottom:16,borderBottom:"2px solid #111"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #FF9500",paddingLeft:12}}>🎁 MY BUNDLES</div>
              <button className="hbtn" style={{...S.hBtn,background:"#FF9500",border:"none",fontSize:11}} onClick={()=>{loadBundles();setView("createbundle");}}>+ CREATE BUNDLE</button>
            </div>
            {bundles.length===0?(
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,color:"#bbb",letterSpacing:1}}>No bundles yet. Bundle separate listings to offer a deal! 🎁</p>
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
                        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:800,color:"#FF9500"}}>Bundle: ${discounted}</p>
                      </div>
                      <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#FF1493",border:"2px solid #FF1493",fontSize:11}} onClick={()=>deleteBundle(b.id)}>DELETE</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
                      <Thumb src={item.image_url} emoji={item.emoji||catEmoji(item.category)} accent={accent} style={{height:80}} emojiStyle={{fontSize:32}}>
                        {isSel&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.35)",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:24,fontWeight:900}}>✓</span></div>}
                      </Thumb>
                      <div style={{padding:"8px 10px"}}><p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:800,color:"#111",marginBottom:2}}>{item.name}</p><p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:900,color:accent}}>{currencySymbol(item.currency)}{item.price}</p></div>
                    </div>
                  );
                })}
              </div>
            </Sec>
            <button className="hbtn" style={{...S.hBtn,background:"#FF9500",border:"none",width:"100%",padding:"16px",fontSize:15,borderRadius:0,letterSpacing:3,opacity:(bundleForm.selectedListings.length<2||!bundleForm.name)?0.4:1}} onClick={createBundle} disabled={bundleForm.selectedListings.length<2||!bundleForm.name}>🎁 CREATE BUNDLE →</button>
          </div>
        </main>
      )}
    </>
  );
}
