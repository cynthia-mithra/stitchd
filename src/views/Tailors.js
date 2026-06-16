import React from "react";
import { Search, Scissors, MapPin } from "lucide-react";
import { CARD_COLORS, currencySymbol } from "../lib/constants";
import { S } from "../styles";
import { F } from "../components/Shared";
import MeasuringGuide, { GeneralTips } from "./MeasuringGuide";

export default function Tailors({
  view, setView, user, profile,
  tailorServices, tailorProfiles,
  tailorSearch, setTailorSearch,
  tailorTypeFilter, setTailorTypeFilter,
  tailorServiceForm, setTailorServiceForm,
  showTailorForm, setShowTailorForm,
  editingService, setEditingService,
  selectedService, setSelectedService,
  showBookingForm, setShowBookingForm,
  bookingNotes, setBookingNotes,
  bookTailor, saveTailorService,
  prevView,
}) {
  return (
    <>
      {/* TAILOR MARKETPLACE */}
      {view==="tailors"&&(
        <div style={{minHeight:"100vh",background:"#fff"}}>
          <div style={{background:"#E0FAF7",borderBottom:"3px solid #111",padding:"48px 24px 40px"}}>
            <div style={{maxWidth:1200,margin:"0 auto"}}>
              <button style={{...S.back,color:"#00E5CC",marginBottom:16}} onClick={()=>setView("shop")}>← BACK TO SHOP</button>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:4,color:"#00E5CC",marginBottom:8}}>FIND A TAILOR</p>
              <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(48px,8vw,100px)",fontWeight:900,color:"#111",lineHeight:.9,letterSpacing:-2,marginBottom:16}}>TAILOR<br/><span style={{color:"#00E5CC"}}>MARKETPLACE</span></h1>
              {user&&<button className="hbtn" style={{...S.hBtn,background:"#00E5CC",border:"none",padding:"14px 28px",fontSize:13,letterSpacing:2,marginTop:16}} onClick={()=>{setEditingService(null);setTailorServiceForm({title:"",description:"",service_type:"All",price_from:"",price_to:"",turnaround_days:"",location:"",images:[],imagePreviews:[]});setShowTailorForm(true);}}>+ LIST MY SERVICE</button>}
            </div>
          </div>
          <div style={{maxWidth:1200,margin:"0 auto",padding:"32px 16px"}}>
            <div style={{display:"flex",gap:10,marginBottom:24,flexWrap:"wrap",alignItems:"stretch"}}>
              <div style={{flex:1,minWidth:200,display:"flex",alignItems:"center",border:"2px solid #111",background:"#fff"}}>
                <span style={{padding:"0 12px",color:"#bbb",display:"flex",alignItems:"center"}}><Search width={16} height={16}/></span>
                <input style={{flex:1,border:"none",outline:"none",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,padding:"12px 0",background:"transparent"}} placeholder="SEARCH TAILORS..." value={tailorSearch} onChange={e=>setTailorSearch(e.target.value)}/>
              </div>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:28}}>
              {["All","Alterations","Taking In","Letting Out","Hemming","Blouse Stitching","Full Stitching","Custom Stitching","Embroidery","Repairs","Custom Orders"].map(t=>(
                <button key={t} className="fpill" style={{...S.pill,...(tailorTypeFilter===t?{...S.pillOn,background:"#00E5CC",borderColor:"#00E5CC"}:{})}} onClick={()=>setTailorTypeFilter(t)}>{t}</button>
              ))}
            </div>
            {tailorServices.length===0?(
              <div style={{textAlign:"center",padding:"80px 20px",border:"3px dashed #e0e0e0"}}>
                <p style={{display:"flex",justifyContent:"center",marginBottom:16}}><Scissors width={64} height={64}/></p>
                <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:32,fontWeight:900,marginBottom:8}}>NO TAILORS YET.</p>
                {user&&<button className="hbtn" style={{...S.hBtn,background:"#00E5CC",border:"none",padding:"14px 32px",fontSize:14}} onClick={()=>setShowTailorForm(true)}>LIST MY SERVICE →</button>}
              </div>
            ):(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:3}}>
                {tailorServices.filter(s=>{
                  const q=tailorSearch.toLowerCase();
                  const matchSearch=!q||s.title?.toLowerCase().includes(q)||s.location?.toLowerCase().includes(q);
                  const matchType=tailorTypeFilter==="All"||s.service_type===tailorTypeFilter||s.service_type==="All";
                  return matchSearch&&matchType;
                }).map((s,idx)=>{
                  const accent=CARD_COLORS[idx%CARD_COLORS.length];
                  const tailorProf=tailorProfiles.find(p=>p.id===s.tailor_id);
                  return(
                    <div key={s.id} style={{background:"#fff",border:"3px solid #111",overflow:"hidden",display:"flex",flexDirection:"column"}}>
                      <div style={{height:200,background:s.images?.[0]?"#000":accent,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",position:"relative"}}>
                        {s.images?.[0]?<img src={s.images[0]} alt={s.title} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<Scissors width={72} height={72} color="#fff"/>}
                        <div style={{position:"absolute",top:12,left:12,background:accent,color:"#fff",padding:"4px 12px",fontSize:10,fontWeight:800,letterSpacing:2,fontFamily:"'Barlow Condensed',sans-serif"}}>{s.service_type?.toUpperCase()}</div>
                        {s.location&&<div style={{position:"absolute",bottom:12,left:12,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:5}}><MapPin width={13} height={13}/> {s.location}</div>}
                      </div>
                      {tailorProf&&(
                        <div style={{padding:"12px 16px",borderBottom:"2px solid #f0f0f0",display:"flex",alignItems:"center",gap:12,background:"#fafafa"}}>
                          <div style={{width:36,height:36,borderRadius:"50%",border:"2px solid #111",overflow:"hidden",flexShrink:0,background:accent,display:"flex",alignItems:"center",justifyContent:"center"}}>
                            {tailorProf.avatar_url?<img src={tailorProf.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900,color:"#fff"}}>{(tailorProf.full_name||tailorProf.username||"T")[0].toUpperCase()}</span>}
                          </div>
                          <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:900,color:"#111"}}>{tailorProf.full_name||tailorProf.username||"Tailor"}</p>
                        </div>
                      )}
                      <div style={{padding:"16px 18px",flex:1,display:"flex",flexDirection:"column"}}>
                        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,marginBottom:6,color:"#111"}}>{s.title}</p>
                        {s.description&&<p style={{fontSize:13,color:"#666",marginBottom:12,flex:1}}>{s.description.slice(0,120)}{s.description.length>120?"...":""}</p>}
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",borderTop:"2px solid #f5f5f5",paddingTop:12,marginTop:"auto"}}>
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900,color:accent}}>From {currencySymbol(profile?.currency||"GBP")}{s.price_from}</span>
                          <button className="hbtn" style={{...S.hBtn,background:accent,border:"none",padding:"10px 20px",fontSize:12}} onClick={()=>{setSelectedService(s);setShowBookingForm(true);}}>BOOK →</button>
                        </div>
                      </div>
                      <div style={{height:4,background:accent,width:"100%"}}/>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {showBookingForm&&selectedService&&(
            <div style={S.modalOverlay} onClick={()=>setShowBookingForm(false)}>
              <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,paddingBottom:16,borderBottom:"3px solid #111"}}>
                  <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900,display:"flex",alignItems:"center",gap:10}}><Scissors width={24} height={24}/> BOOK SERVICE</h3>
                  <button style={{background:"none",border:"none",fontSize:20,cursor:"pointer",fontWeight:900}} onClick={()=>setShowBookingForm(false)}>✕</button>
                </div>
                <F l="NOTES FOR TAILOR">
                  <textarea style={{...S.inp,height:110,resize:"vertical",width:"100%"}} placeholder="Your measurements, requirements..." value={bookingNotes} onChange={e=>setBookingNotes(e.target.value)}/>
                </F>
                <button className="hbtn" style={{...S.hBtn,background:"#00E5CC",border:"none",width:"100%",padding:"16px",fontSize:15,letterSpacing:3,marginTop:16}} onClick={()=>bookTailor(selectedService)}>SEND BOOKING REQUEST →</button>
              </div>
            </div>
          )}
          {showTailorForm&&(
            <div style={S.modalOverlay} onClick={()=>setShowTailorForm(false)}>
              <div style={{...S.modalBox,maxWidth:580}} onClick={e=>e.stopPropagation()}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,paddingBottom:16,borderBottom:"3px solid #111"}}>
                  <h3 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900,display:"flex",alignItems:"center",gap:10}}>{editingService?"EDIT SERVICE":<>LIST YOUR SERVICE <Scissors width={24} height={24}/></>}</h3>
                  <button style={{background:"none",border:"none",fontSize:20,cursor:"pointer",fontWeight:900}} onClick={()=>setShowTailorForm(false)}>✕</button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <F l="SERVICE TITLE *"><input style={S.inp} placeholder="e.g. Bridal Lehenga Alterations" value={tailorServiceForm.title} onChange={e=>setTailorServiceForm(f=>({...f,title:e.target.value}))}/></F>
                  <F l="SERVICE TYPE">
                    <select style={S.inp} value={tailorServiceForm.service_type} onChange={e=>setTailorServiceForm(f=>({...f,service_type:e.target.value}))}>
                      {["All","Alterations","Taking In","Letting Out","Hemming","Blouse Stitching","Full Stitching","Custom Stitching","Embroidery","Repairs","Custom Orders"].map(t=><option key={t}>{t}</option>)}
                    </select>
                  </F>
                  <F l="DESCRIPTION"><textarea style={{...S.inp,height:90,resize:"vertical",width:"100%"}} value={tailorServiceForm.description} onChange={e=>setTailorServiceForm(f=>({...f,description:e.target.value}))}/></F>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    <F l="PRICE FROM *"><input style={S.inp} type="number" placeholder="e.g. 15" value={tailorServiceForm.price_from} onChange={e=>setTailorServiceForm(f=>({...f,price_from:e.target.value}))}/></F>
                    <F l="PRICE TO (optional)"><input style={S.inp} type="number" placeholder="e.g. 80" value={tailorServiceForm.price_to} onChange={e=>setTailorServiceForm(f=>({...f,price_to:e.target.value}))}/></F>
                  </div>
                  <F l="TURNAROUND (DAYS)"><input style={S.inp} type="number" placeholder="e.g. 7" value={tailorServiceForm.turnaround_days} onChange={e=>setTailorServiceForm(f=>({...f,turnaround_days:e.target.value}))}/></F>
                  <F l="YOUR LOCATION"><input style={S.inp} placeholder="e.g. East London, UK" value={tailorServiceForm.location} onChange={e=>setTailorServiceForm(f=>({...f,location:e.target.value}))}/></F>
                </div>
                <button className="hbtn" style={{...S.hBtn,background:"#00E5CC",border:"none",width:"100%",padding:"16px",fontSize:15,letterSpacing:3,marginTop:20,opacity:(!tailorServiceForm.title||!tailorServiceForm.price_from)?0.4:1}} onClick={saveTailorService} disabled={!tailorServiceForm.title||!tailorServiceForm.price_from}>{editingService?"SAVE CHANGES →":"LIST SERVICE →"}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MEASURING GUIDE */}
      {view==="measuring"&&(
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
      )}
    </>
  );
}
