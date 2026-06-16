import React from "react";
import { Scissors, MapPin, Instagram, Globe, Trash2, Plus, ArrowUp, ArrowDown, X, ExternalLink } from "lucide-react";
import { S } from "../styles";
import { F, Stars } from "../components/Shared";
import LoginPromptModal from "../components/LoginPromptModal";
import { TAILOR_SPECIALISMS, TAILOR_TURNAROUND, turnaroundLabel } from "../lib/constants";

const PINK = "#FF1493";
const poundsFromPence = (p) => (p==null||p==="") ? "" : (p/100).toString();

// Specialism pills — same multi-select style as the occasion filter.
function SpecialismPicker({ selected = [], onToggle }) {
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
      {TAILOR_SPECIALISMS.map(s=>{
        const on=selected.includes(s);
        return (
          <button key={s} type="button" onClick={()=>onToggle(s)} className="fpill"
            style={{...S.pill,...(on?{...S.pillOn,background:PINK,borderColor:PINK}:{})}}>
            {s}
          </button>
        );
      })}
    </div>
  );
}

// A square upload tile (for portfolio + profile image).
function UploadTile({ preview, onPick, onClear, label="ADD PHOTO", height="100%" }) {
  const ref=React.useRef(null);
  return (
    <div style={{position:"relative",height}}>
      <input ref={ref} type="file" accept="image/*" style={{display:"none"}}
        onChange={e=>{ const f=e.target.files&&e.target.files[0]; if(f) onPick(f); e.target.value=""; }}/>
      {preview?(
        <div style={{position:"relative",width:"100%",height:"100%",border:"2px solid #111",overflow:"hidden"}}>
          <img src={preview} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          {onClear&&<button type="button" onClick={onClear} style={S.removeImg}>✕</button>}
        </div>
      ):(
        <button type="button" onClick={()=>ref.current&&ref.current.click()}
          style={{...S.uploadZone,width:"100%",height:"100%",minHeight:120}}>
          <div style={S.uploadPlaceholder}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:6}}><Plus width={22} height={22} color="#bbb"/></div>
            <span style={S.uploadText}>{label}</span>
          </div>
        </button>
      )}
    </div>
  );
}

export default function TailorProfiles({
  view, setView, user, flash,
  myTailor,
  // apply
  applyForm, setApplyForm, applyBusy, submitApplication,
  // dashboard
  tailorDashTab, setTailorDashTab,
  tailorEdit, setTailorEdit, saveTailorProfile, tailorEditBusy,
  tailorPortfolio, addPortfolioImages, deletePortfolioImage, movePortfolioImage, portfolioBusy,
  openTailorPublic,
  // public
  publicTailor, publicTailorLoading,
  onGateAuth = () => {},
}) {
  const [lightbox,setLightbox]=React.useState(null);

  // ── helpers shared across the apply + edit forms ──────────────────────────
  const toggleSpec=(setter)=>(s)=>setter(f=>({...f,specialisms:(f.specialisms||[]).includes(s)?f.specialisms.filter(x=>x!==s):[...(f.specialisms||[]),s]}));

  return (
    <>
      {/* ══════════════════════ APPLICATION FLOW ══════════════════════ */}
      {view==="tailor-apply"&&applyForm&&(
        <main style={{...S.main,maxWidth:720}}>
          <button style={S.back} onClick={()=>setView("shop")}>← BACK</button>
          <div style={{marginBottom:28,paddingBottom:22,borderBottom:"3px solid #111"}}>
            <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:4,color:PINK,marginBottom:6}}>BECOME A TAILOR</p>
            <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(40px,7vw,68px)",fontWeight:900,letterSpacing:-1,lineHeight:1,display:"flex",alignItems:"center",gap:14}}>
              <Scissors width={44} height={44}/> JOIN AS A<br/>TAILOR.
            </h1>
          </div>

          {/* Step progress */}
          <div style={{display:"flex",gap:6,marginBottom:28}}>
            {[1,2,3,4,5].map(n=>(
              <div key={n} style={{flex:1,height:6,background:applyForm.step>=n?PINK:"#eee"}}/>
            ))}
          </div>

          {/* STEP 1 — BASIC INFO */}
          {applyForm.step===1&&(
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900}}>1. BASIC INFO</h2>
              <F l="DISPLAY NAME *"><input style={S.inp} placeholder="Your name or business name" value={applyForm.display_name} onChange={e=>setApplyForm(f=>({...f,display_name:e.target.value}))}/></F>
              <F l="LOCATION *"><input style={S.inp} placeholder="e.g. London, UK" value={applyForm.location} onChange={e=>setApplyForm(f=>({...f,location:e.target.value}))}/></F>
              <F l={`BIO * (${(applyForm.bio||"").length}/500)`}>
                <textarea style={{...S.inp,height:120,resize:"vertical"}} maxLength={500} placeholder="Tell buyers about your experience and skills..." value={applyForm.bio} onChange={e=>setApplyForm(f=>({...f,bio:e.target.value.slice(0,500)}))}/>
              </F>
              <F l="PROFILE IMAGE *">
                <div style={{width:140,height:140}}>
                  <UploadTile preview={applyForm.profilePreview} label="UPLOAD PHOTO"
                    onPick={f=>setApplyForm(fm=>({...fm,profileFile:f,profilePreview:URL.createObjectURL(f)}))}
                    onClear={()=>setApplyForm(fm=>({...fm,profileFile:null,profilePreview:""}))}/>
                </div>
              </F>
              <div style={{display:"flex",justifyContent:"flex-end"}}>
                <button className="hbtn" style={{...S.hBtn,background:PINK,border:"2px solid #111",padding:"14px 32px",fontSize:14,letterSpacing:2,opacity:(applyForm.display_name&&applyForm.location&&applyForm.bio&&(applyForm.profileFile||applyForm.profilePreview))?1:0.4}}
                  disabled={!(applyForm.display_name&&applyForm.location&&applyForm.bio&&(applyForm.profileFile||applyForm.profilePreview))}
                  onClick={()=>setApplyForm(f=>({...f,step:2}))}>NEXT →</button>
              </div>
            </div>
          )}

          {/* STEP 2 — SPECIALISMS */}
          {applyForm.step===2&&(
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900}}>2. SPECIALISMS</h2>
              <p style={{fontSize:14,color:"#888"}}>Select all that apply.</p>
              <SpecialismPicker selected={applyForm.specialisms} onToggle={toggleSpec(setApplyForm)}/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
                <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111",padding:"14px 28px",fontSize:14}} onClick={()=>setApplyForm(f=>({...f,step:1}))}>← BACK</button>
                <button className="hbtn" style={{...S.hBtn,background:PINK,border:"2px solid #111",padding:"14px 32px",fontSize:14,letterSpacing:2}} onClick={()=>setApplyForm(f=>({...f,step:3}))}>NEXT →</button>
              </div>
            </div>
          )}

          {/* STEP 3 — PRICING + TURNAROUND */}
          {applyForm.step===3&&(
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900}}>3. PRICING & TURNAROUND</h2>
              <div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  <F l="FROM (£)"><input style={S.inp} type="number" min="0" placeholder="15" value={applyForm.price_from} onChange={e=>setApplyForm(f=>({...f,price_from:e.target.value}))}/></F>
                  <F l="TO (£)"><input style={S.inp} type="number" min="0" placeholder="80" value={applyForm.price_to} onChange={e=>setApplyForm(f=>({...f,price_to:e.target.value}))}/></F>
                </div>
                <p style={{fontSize:12,color:"#aaa",marginTop:6}}>Your typical price range for alterations</p>
              </div>
              <F l="TURNAROUND TIME">
                <select style={S.inp} value={applyForm.turnaround_days||""} onChange={e=>setApplyForm(f=>({...f,turnaround_days:e.target.value?Number(e.target.value):null}))}>
                  <option value="">Select turnaround…</option>
                  {TAILOR_TURNAROUND.map(o=><option key={o.days} value={o.days}>{o.label}</option>)}
                </select>
              </F>
              <F l="INSTAGRAM HANDLE (optional)"><input style={S.inp} placeholder="@yourhandle" value={applyForm.instagram_handle} onChange={e=>setApplyForm(f=>({...f,instagram_handle:e.target.value}))}/></F>
              <F l="WEBSITE URL (optional)"><input style={S.inp} placeholder="https://…" value={applyForm.website_url} onChange={e=>setApplyForm(f=>({...f,website_url:e.target.value}))}/></F>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
                <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111",padding:"14px 28px",fontSize:14}} onClick={()=>setApplyForm(f=>({...f,step:2}))}>← BACK</button>
                <button className="hbtn" style={{...S.hBtn,background:PINK,border:"2px solid #111",padding:"14px 32px",fontSize:14,letterSpacing:2}} onClick={()=>setApplyForm(f=>({...f,step:4}))}>NEXT →</button>
              </div>
            </div>
          )}

          {/* STEP 4 — PORTFOLIO */}
          {applyForm.step===4&&(
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900}}>4. PORTFOLIO</h2>
              <p style={{fontSize:14,color:"#888"}}>Show buyers your best work. Optional but recommended — you can add more later from your dashboard. (Up to 8.)</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                {(applyForm.portfolio||[]).map((item,idx)=>(
                  <div key={idx} style={{border:"2px solid #111",padding:10,display:"flex",flexDirection:"column",gap:8}}>
                    <div style={{height:150}}>
                      <UploadTile preview={item.preview} label="UPLOAD"
                        onPick={f=>setApplyForm(fm=>{const p=[...fm.portfolio];p[idx]={...p[idx],file:f,preview:URL.createObjectURL(f)};return{...fm,portfolio:p};})}
                        onClear={()=>setApplyForm(fm=>({...fm,portfolio:fm.portfolio.filter((_,i)=>i!==idx)}))}/>
                    </div>
                    <input style={{...S.inp,padding:"8px 10px",fontSize:13}} placeholder="Caption" value={item.caption||""} onChange={e=>setApplyForm(fm=>{const p=[...fm.portfolio];p[idx]={...p[idx],caption:e.target.value};return{...fm,portfolio:p};})}/>
                    <input style={{...S.inp,padding:"8px 10px",fontSize:13}} placeholder="Garment type (e.g. Lehenga)" value={item.garment_type||""} onChange={e=>setApplyForm(fm=>{const p=[...fm.portfolio];p[idx]={...p[idx],garment_type:e.target.value};return{...fm,portfolio:p};})}/>
                  </div>
                ))}
                {(applyForm.portfolio||[]).length<8&&(
                  <button type="button" onClick={()=>setApplyForm(fm=>({...fm,portfolio:[...(fm.portfolio||[]),{file:null,preview:"",caption:"",garment_type:""}]}))}
                    style={{...S.uploadZone,minHeight:150}}>
                    <div style={S.uploadPlaceholder}>
                      <div style={{display:"flex",justifyContent:"center",marginBottom:6}}><Plus width={24} height={24} color="#bbb"/></div>
                      <span style={S.uploadText}>ADD PORTFOLIO IMAGE</span>
                    </div>
                  </button>
                )}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
                <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111",padding:"14px 28px",fontSize:14}} onClick={()=>setApplyForm(f=>({...f,step:3}))}>← BACK</button>
                <button className="hbtn" style={{...S.hBtn,background:PINK,border:"2px solid #111",padding:"14px 32px",fontSize:14,letterSpacing:2}} onClick={()=>setApplyForm(f=>({...f,step:5}))}>REVIEW →</button>
              </div>
            </div>
          )}

          {/* STEP 5 — REVIEW + SUBMIT */}
          {applyForm.step===5&&(
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900}}>5. REVIEW & SUBMIT</h2>
              <div style={{border:"2px solid #111",padding:20,display:"flex",flexDirection:"column",gap:14}}>
                <div style={{display:"flex",gap:16,alignItems:"center"}}>
                  {applyForm.profilePreview&&<img src={applyForm.profilePreview} alt="" style={{width:72,height:72,borderRadius:"50%",border:"2px solid #111",objectFit:"cover"}}/>}
                  <div>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:900}}>{applyForm.display_name||"—"}</p>
                    <p style={{fontSize:13,color:"#888",display:"flex",alignItems:"center",gap:5}}><MapPin width={13} height={13}/> {applyForm.location||"—"}</p>
                  </div>
                </div>
                <ReviewRow label="BIO" value={applyForm.bio}/>
                <ReviewRow label="SPECIALISMS" value={(applyForm.specialisms||[]).join(", ")||"None selected"}/>
                <ReviewRow label="PRICE RANGE" value={applyForm.price_from||applyForm.price_to?`£${applyForm.price_from||"?"} – £${applyForm.price_to||"?"}`:"Not set"}/>
                <ReviewRow label="TURNAROUND" value={applyForm.turnaround_days?turnaroundLabel(applyForm.turnaround_days):"Not set"}/>
                {applyForm.instagram_handle&&<ReviewRow label="INSTAGRAM" value={applyForm.instagram_handle}/>}
                {applyForm.website_url&&<ReviewRow label="WEBSITE" value={applyForm.website_url}/>}
                <ReviewRow label="PORTFOLIO" value={`${(applyForm.portfolio||[]).filter(p=>p.file||p.preview).length} image(s)`}/>
              </div>
              <button className="hbtn"
                style={{background:PINK,color:"#fff",border:"2px solid #111",borderRadius:0,padding:"18px",fontSize:16,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:3,cursor:applyBusy?"wait":"pointer",opacity:applyBusy?0.6:1}}
                disabled={applyBusy} onClick={submitApplication}>
                {applyBusy?"SUBMITTING…":"SUBMIT APPLICATION"}
              </button>
              <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111",padding:"12px 28px",fontSize:13,alignSelf:"flex-start"}} onClick={()=>setApplyForm(f=>({...f,step:4}))}>← BACK</button>
            </div>
          )}
        </main>
      )}

      {/* ══════════════════════ TAILOR DASHBOARD ══════════════════════ */}
      {view==="tailor-dashboard"&&myTailor&&tailorEdit&&(
        <main style={{...S.main,maxWidth:1000}}>
          <button style={S.back} onClick={()=>setView("shop")}>← BACK</button>
          <div style={{...S.dashHeader}}>
            <div>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:4,color:PINK,marginBottom:6}}>TAILOR DASHBOARD</p>
              <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(36px,6vw,56px)",fontWeight:900,letterSpacing:-1,lineHeight:1,display:"flex",alignItems:"center",gap:12}}>
                <Scissors width={40} height={40}/> {myTailor.display_name}
              </h1>
            </div>
            <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111",padding:"12px 22px",fontSize:13,display:"flex",alignItems:"center",gap:8}} onClick={()=>openTailorPublic(myTailor.id,true)}>
              <ExternalLink width={15} height={15}/> PREVIEW PROFILE
            </button>
          </div>

          {/* tabs */}
          <div style={{display:"flex",gap:4,flexWrap:"wrap",borderBottom:"3px solid #111",marginBottom:28}}>
            {[["profile","PROFILE"],["portfolio","PORTFOLIO"],["bookings","BOOKINGS"],["reviews","REVIEWS"]].map(([v,l])=>(
              <button key={v} className="hbtn" onClick={()=>setTailorDashTab(v)}
                style={{background:tailorDashTab===v?"#111":"#fff",color:tailorDashTab===v?"#fff":"#111",border:"none",borderBottom:tailorDashTab===v?`4px solid ${PINK}`:"4px solid transparent",padding:"12px 22px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,letterSpacing:2,fontSize:14,cursor:"pointer"}}>
                {l}
              </button>
            ))}
          </div>

          {/* PROFILE TAB */}
          {tailorDashTab==="profile"&&(
            <div style={{display:"flex",flexDirection:"column",gap:18,maxWidth:680}}>
              <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                <F l="PROFILE IMAGE">
                  <div style={{width:130,height:130}}>
                    <UploadTile preview={tailorEdit.profilePreview} label="UPLOAD"
                      onPick={f=>setTailorEdit(fm=>({...fm,profileFile:f,profilePreview:URL.createObjectURL(f)}))}/>
                  </div>
                </F>
                <F l="BANNER IMAGE (optional, full-width header)" style={{flex:1,minWidth:240}}>
                  <div style={{width:"100%",height:130}}>
                    <UploadTile preview={tailorEdit.bannerPreview} label="UPLOAD BANNER"
                      onPick={f=>setTailorEdit(fm=>({...fm,bannerFile:f,bannerPreview:URL.createObjectURL(f)}))}
                      onClear={()=>setTailorEdit(fm=>({...fm,bannerFile:null,bannerPreview:"",banner_image_url:""}))}/>
                  </div>
                </F>
              </div>
              <F l="DISPLAY NAME"><input style={S.inp} value={tailorEdit.display_name} onChange={e=>setTailorEdit(f=>({...f,display_name:e.target.value}))}/></F>
              <F l="LOCATION"><input style={S.inp} value={tailorEdit.location} onChange={e=>setTailorEdit(f=>({...f,location:e.target.value}))}/></F>
              <F l={`BIO (${(tailorEdit.bio||"").length}/500)`}><textarea style={{...S.inp,height:110,resize:"vertical"}} maxLength={500} value={tailorEdit.bio} onChange={e=>setTailorEdit(f=>({...f,bio:e.target.value.slice(0,500)}))}/></F>
              <F l="SPECIALISMS"><SpecialismPicker selected={tailorEdit.specialisms} onToggle={toggleSpec(setTailorEdit)}/></F>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <F l="PRICE FROM (£)"><input style={S.inp} type="number" min="0" value={tailorEdit.price_from} onChange={e=>setTailorEdit(f=>({...f,price_from:e.target.value}))}/></F>
                <F l="PRICE TO (£)"><input style={S.inp} type="number" min="0" value={tailorEdit.price_to} onChange={e=>setTailorEdit(f=>({...f,price_to:e.target.value}))}/></F>
              </div>
              <F l="TURNAROUND">
                <select style={S.inp} value={tailorEdit.turnaround_days||""} onChange={e=>setTailorEdit(f=>({...f,turnaround_days:e.target.value?Number(e.target.value):null}))}>
                  <option value="">Select turnaround…</option>
                  {TAILOR_TURNAROUND.map(o=><option key={o.days} value={o.days}>{o.label}</option>)}
                </select>
              </F>
              <F l="INSTAGRAM HANDLE"><input style={S.inp} placeholder="@yourhandle" value={tailorEdit.instagram_handle} onChange={e=>setTailorEdit(f=>({...f,instagram_handle:e.target.value}))}/></F>
              <F l="WEBSITE URL"><input style={S.inp} placeholder="https://…" value={tailorEdit.website_url} onChange={e=>setTailorEdit(f=>({...f,website_url:e.target.value}))}/></F>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                <button className="hbtn" style={{background:PINK,color:"#fff",border:"2px solid #111",borderRadius:0,padding:"16px 36px",fontSize:15,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:3,cursor:tailorEditBusy?"wait":"pointer",opacity:tailorEditBusy?0.6:1}}
                  disabled={tailorEditBusy} onClick={saveTailorProfile}>{tailorEditBusy?"SAVING…":"SAVE CHANGES"}</button>
                <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111",padding:"16px 28px",fontSize:13,display:"flex",alignItems:"center",gap:8}} onClick={()=>openTailorPublic(myTailor.id,true)}>
                  <ExternalLink width={15} height={15}/> PREVIEW PROFILE
                </button>
              </div>
            </div>
          )}

          {/* PORTFOLIO TAB */}
          {tailorDashTab==="portfolio"&&(
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
                <p style={{fontSize:14,color:"#888"}}>{(tailorPortfolio||[]).length}/8 images. Reorder with the arrows.</p>
                <AddPhotosButton disabled={portfolioBusy||(tailorPortfolio||[]).length>=8} onPick={addPortfolioImages}/>
              </div>
              {(tailorPortfolio||[]).length===0?(
                <div style={{textAlign:"center",padding:"60px 20px",border:"3px dashed #e0e0e0"}}>
                  <div style={{display:"flex",justifyContent:"center",marginBottom:12}}><Scissors width={48} height={48} color="#ccc"/></div>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,color:"#bbb"}}>NO PORTFOLIO IMAGES YET</p>
                </div>
              ):(
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:14}}>
                  {tailorPortfolio.map((img,idx)=>(
                    <div key={img.id} style={{border:"2px solid #111",display:"flex",flexDirection:"column"}}>
                      <div style={{height:200,background:"#000",position:"relative"}}>
                        <img src={img.image_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                        <button onClick={()=>deletePortfolioImage(img.id)} title="Delete" style={{position:"absolute",top:8,right:8,background:"#111",color:"#fff",border:"none",borderRadius:0,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><Trash2 width={16} height={16}/></button>
                        <div style={{position:"absolute",bottom:8,left:8,display:"flex",gap:4}}>
                          <button disabled={idx===0} onClick={()=>movePortfolioImage(img.id,-1)} title="Move up" style={{background:idx===0?"#999":"#fff",color:idx===0?"#fff":"#111",border:"2px solid #111",borderRadius:0,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:idx===0?"not-allowed":"pointer"}}><ArrowUp width={14} height={14}/></button>
                          <button disabled={idx===tailorPortfolio.length-1} onClick={()=>movePortfolioImage(img.id,1)} title="Move down" style={{background:idx===tailorPortfolio.length-1?"#999":"#fff",color:idx===tailorPortfolio.length-1?"#fff":"#111",border:"2px solid #111",borderRadius:0,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:idx===tailorPortfolio.length-1?"not-allowed":"pointer"}}><ArrowDown width={14} height={14}/></button>
                        </div>
                      </div>
                      <div style={{padding:10}}>
                        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:800}}>{img.caption||"—"}</p>
                        {img.garment_type&&<p style={{fontSize:12,color:"#888",marginTop:2}}>{img.garment_type}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* BOOKINGS TAB — placeholder (feature comes later) */}
          {tailorDashTab==="bookings"&&(
            <Placeholder title="BOOKINGS" text="Alteration bookings will appear here. This feature is coming soon."/>
          )}

          {/* REVIEWS TAB — placeholder (feature comes later) */}
          {tailorDashTab==="reviews"&&(
            <Placeholder title="REVIEWS" text="Your reviews will appear here. This feature is coming soon."/>
          )}
        </main>
      )}

      {/* ══════════════════════ PUBLIC PROFILE ══════════════════════ */}
      {view==="tailor-public"&&(
        <main style={{maxWidth:1000,margin:"0 auto",padding:"0 0 60px"}}>
          {publicTailorLoading?(
            <div style={S.loadingWrap}><div style={S.spinner}/><p style={S.loadingText}>LOADING TAILOR…</p></div>
          ):!publicTailor?(
            <div style={{textAlign:"center",padding:"100px 20px"}}>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:32,fontWeight:900,marginBottom:16}}>TAILOR NOT FOUND.</p>
              <button className="hbtn" style={{...S.hBtn,background:PINK,border:"2px solid #111",padding:"14px 28px",fontSize:14}} onClick={()=>setView("shop")}>← BACK TO SHOP</button>
            </div>
          ):(
            <PublicProfile tailor={publicTailor} setView={setView} flash={flash} onOpenImage={setLightbox} user={user} onGateAuth={onGateAuth}/>
          )}
        </main>
      )}

      {/* PORTFOLIO LIGHTBOX */}
      {lightbox&&(
        <div style={S.modalOverlay} onClick={()=>setLightbox(null)}>
          <div style={{position:"relative",maxWidth:"90vw",maxHeight:"90vh"}} onClick={e=>e.stopPropagation()}>
            <button onClick={()=>setLightbox(null)} style={{position:"absolute",top:-44,right:0,background:"#fff",border:"2px solid #111",borderRadius:0,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><X width={20} height={20}/></button>
            <img src={lightbox.image_url} alt="" style={{maxWidth:"90vw",maxHeight:"80vh",objectFit:"contain",border:"3px solid #111",background:"#fff"}}/>
            {lightbox.caption&&<p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:800,color:"#fff",marginTop:12,textAlign:"center"}}>{lightbox.caption}</p>}
          </div>
        </div>
      )}
    </>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div>
      <p style={{fontSize:10,fontWeight:800,color:"#999",letterSpacing:1.5,textTransform:"uppercase",marginBottom:3}}>{label}</p>
      <p style={{fontSize:14,color:"#111",lineHeight:1.5,whiteSpace:"pre-wrap"}}>{value||"—"}</p>
    </div>
  );
}

function Placeholder({ title, text }) {
  return (
    <div style={{textAlign:"center",padding:"70px 20px",border:"3px dashed #e0e0e0"}}>
      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:3,color:PINK,marginBottom:10}}>{title}</p>
      <p style={{fontSize:15,color:"#999",maxWidth:380,margin:"0 auto"}}>{text}</p>
    </div>
  );
}

function AddPhotosButton({ onPick, disabled }) {
  const ref=React.useRef(null);
  return (
    <>
      <input ref={ref} type="file" accept="image/*" multiple style={{display:"none"}}
        onChange={e=>{ const fs=Array.from(e.target.files||[]); if(fs.length) onPick(fs); e.target.value=""; }}/>
      <button className="hbtn" disabled={disabled}
        style={{background:disabled?"#ccc":PINK,color:"#fff",border:"2px solid #111",borderRadius:0,padding:"12px 24px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,fontSize:13,cursor:disabled?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:8}}
        onClick={()=>ref.current&&ref.current.click()}>
        <Plus width={16} height={16}/> ADD PHOTOS
      </button>
    </>
  );
}

// The public /tailors/<id> profile.
function PublicProfile({ tailor, setView, flash, onOpenImage, user, onGateAuth = () => {} }) {
  // Logged-out buyers can browse the whole profile, but booking a tailor is
  // gated — tapping BOOK opens the shared sign-up prompt (context: book).
  const [gateOpen,setGateOpen]=React.useState(false);
  const onBook=()=>{ if(user){ flash("Booking coming soon!"); } else { setGateOpen(true); } };
  const portfolio=[...(tailor.tailor_portfolio||[])].sort((a,b)=>(a.position??0)-(b.position??0)||String(a.created_at).localeCompare(String(b.created_at)));
  const igHandle=(tailor.instagram_handle||"").replace(/^@/,"");
  const igUrl=igHandle?`https://instagram.com/${igHandle}`:null;
  const website=tailor.website_url?(/^https?:\/\//.test(tailor.website_url)?tailor.website_url:`https://${tailor.website_url}`):null;
  return (
    <>
      {/* HEADER */}
      <div style={{position:"relative",marginBottom:64}}>
        <div style={{height:200,width:"100%",background:tailor.banner_image_url?`#111 url(${tailor.banner_image_url}) center/cover`:PINK,borderBottom:"3px solid #111"}}/>
        <div style={{position:"absolute",left:24,bottom:-44,width:88,height:88,borderRadius:"50%",border:"2px solid #111",overflow:"hidden",background:PINK,display:"flex",alignItems:"center",justifyContent:"center"}}>
          {tailor.profile_image_url?<img src={tailor.profile_image_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<Scissors width={36} height={36} color="#fff"/>}
        </div>
      </div>

      <div style={{padding:"0 24px"}}>
        <button style={S.back} onClick={()=>setView("shop")}>← BACK</button>
        <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(36px,6vw,56px)",fontWeight:900,letterSpacing:-1,lineHeight:1,marginBottom:8}}>{tailor.display_name}</h1>
        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:700,color:"#666",display:"flex",alignItems:"center",gap:6,marginBottom:10}}><MapPin width={16} height={16}/> {tailor.location}</p>
        {/* star placeholder */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <Stars value={0} size={16}/>
          <span style={{fontSize:13,color:"#999",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:1}}>No reviews yet</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap",marginBottom:18}}>
          {tailor.price_from_pence!=null&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:30,fontWeight:900,color:PINK}}>From £{poundsFromPence(tailor.price_from_pence)}</span>}
          {tailor.turnaround_days&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:700,color:"#666"}}>Typically {turnaroundLabel(tailor.turnaround_days)}</span>}
        </div>
        <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:18}}>
          {igUrl&&<a href={igUrl} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:6,color:"#111",textDecoration:"none",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1,fontSize:14}}><Instagram width={18} height={18}/> @{igHandle}</a>}
          {website&&<a href={website} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:6,color:"#111",textDecoration:"none",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1,fontSize:14}}><Globe width={18} height={18}/> Website</a>}
        </div>
        <button className="hbtn"
          style={{background:PINK,color:"#fff",border:"2px solid #111",borderRadius:0,padding:"16px 40px",fontSize:16,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:3,cursor:"pointer",marginBottom:40}}
          onClick={onBook}>
          BOOK THIS TAILOR
        </button>

        {/* SPECIALISMS */}
        {(tailor.specialisms||[]).length>0&&(
          <Section heading="SPECIALISMS">
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {tailor.specialisms.map(s=>(
                <span key={s} style={{border:"2px solid #111",borderRadius:0,background:"#fff",padding:"8px 16px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,letterSpacing:0.5}}>{s}</span>
              ))}
            </div>
          </Section>
        )}

        {/* ABOUT */}
        {tailor.bio&&(
          <Section heading="ABOUT">
            <p style={{fontSize:15,color:"#444",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{tailor.bio}</p>
          </Section>
        )}

        {/* PORTFOLIO */}
        {portfolio.length>0&&(
          <Section heading="PORTFOLIO">
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:14}}>
              {portfolio.map(img=>(
                <div key={img.id} style={{border:"2px solid #111",display:"flex",flexDirection:"column",cursor:"pointer"}} onClick={()=>onOpenImage(img)}>
                  <div style={{height:240,background:"#000"}}>
                    <img src={img.image_url} alt={img.caption||""} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  </div>
                  {(img.caption||img.garment_type)&&(
                    <div style={{padding:10}}>
                      {img.caption&&<p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:800}}>{img.caption}</p>}
                      {img.garment_type&&<p style={{fontSize:12,color:"#888",marginTop:2}}>{img.garment_type}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* REVIEWS */}
        <Section heading="REVIEWS">
          <p style={{fontSize:15,color:"#999"}}>No reviews yet</p>
        </Section>
      </div>

      {/* SIGN-UP GATE — shown when a logged-out buyer taps BOOK THIS TAILOR */}
      <LoginPromptModal open={gateOpen} context="book" onClose={()=>setGateOpen(false)} onAuth={m=>{ setGateOpen(false); onGateAuth(m); }}/>
    </>
  );
}

function Section({ heading, children }) {
  return (
    <div style={{marginBottom:40,paddingBottom:32,borderBottom:"1px solid #f0f0f0"}}>
      <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:900,letterSpacing:3,borderLeft:`4px solid ${PINK}`,paddingLeft:12,marginBottom:18}}>{heading}</h2>
      {children}
    </div>
  );
}
