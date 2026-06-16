import React from "react";
import { Scissors, MapPin, Instagram, Globe, Trash2, Plus, ArrowUp, ArrowDown, X, ExternalLink, Mail, Check, Wallet, Clock, Calendar, ChevronLeft, ChevronRight, Save, Plane } from "lucide-react";
import { S } from "../styles";
import { F, Stars, Thumb } from "../components/Shared";
import { RatingSummary, ReviewList } from "../components/Reviews";
import LoginPromptModal from "../components/LoginPromptModal";
import { TAILOR_SPECIALISMS, TAILOR_TURNAROUND, turnaroundLabel, catEmoji } from "../lib/constants";
import { StatusBadge, gbp } from "./Alterations";
import { toISODate, parseISODate, startOfDay, todayStart, addDays, monthGrid, monthLabel, rowsByDate, dayState, mondayIndex, WEEKDAYS, ADVANCE_BOOKING_OPTIONS } from "../lib/availability";

const TEAL = "#00E5CC";

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
  // availability (Phase 15 — Tailor availability calendar)
  availabilityRows = [], availabilityLoading = false, availabilityBusy = false,
  onToggleAvailabilityEnabled = () => {}, onSaveAvailabilitySettings = () => {},
  onSetDayAvailability = () => {}, onSetDaySlots = () => {},
  onMarkRangeUnavailable = () => {}, onMarkAllAvailable = () => {},
  // bookings (incoming alteration requests)
  alterationRequests = [], alterationBuyers = {}, bookingsLoading = false,
  onSendQuote = () => {}, onDeclineRequest = () => {}, onMessageBuyer = () => {},
  onMarkComplete = () => {}, payouts = [],
  // reviews (Phase 15): dashboard REVIEWS tab + public profile
  tailorReviews = [], tailorReviewBuyers = {},
  publicTailorReviews = [], publicReviewBuyers = {},
  // public
  publicTailor, publicTailorLoading,
  publicAvailability = [], onSendAlterationRequest = () => {},
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
            {[["profile","PROFILE"],["portfolio","PORTFOLIO"],["availability","AVAILABILITY"],["bookings","BOOKINGS"],["earnings","EARNINGS"],["reviews","REVIEWS"]].map(([v,l])=>(
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

          {/* AVAILABILITY TAB — publish the dates the tailor can take work (Phase 15). */}
          {tailorDashTab==="availability"&&(
            <AvailabilityTab
              tailor={myTailor} rows={availabilityRows} loading={availabilityLoading} busy={availabilityBusy}
              onToggleEnabled={onToggleAvailabilityEnabled} onSaveSettings={onSaveAvailabilitySettings}
              onSetDay={onSetDayAvailability} onSetSlots={onSetDaySlots}
              onMarkRangeUnavailable={onMarkRangeUnavailable} onMarkAllAvailable={onMarkAllAvailable}
            />
          )}

          {/* BOOKINGS TAB — incoming alteration requests (Phase 15). */}
          {tailorDashTab==="bookings"&&(
            <TailorBookings
              requests={alterationRequests} buyers={alterationBuyers} loading={bookingsLoading}
              onSendQuote={onSendQuote} onDeclineRequest={onDeclineRequest} onMessageBuyer={onMessageBuyer}
              onMarkComplete={onMarkComplete}
            />
          )}

          {/* EARNINGS TAB — payout totals + paid bookings (Phase 15). */}
          {tailorDashTab==="earnings"&&(
            <TailorEarnings payouts={payouts}/>
          )}

          {/* REVIEWS TAB — overall stats + every review, newest first (Part 5). */}
          {tailorDashTab==="reviews"&&(
            (tailorReviews||[]).length===0?(
              <Placeholder title="NO REVIEWS YET" text="Reviews from buyers will appear here once you've completed bookings."/>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:28}}>
                <div style={{border:"2px solid #111",padding:20}}>
                  <RatingSummary reviews={tailorReviews} average={myTailor.average_rating}/>
                </div>
                <ReviewList reviews={tailorReviews} buyers={tailorReviewBuyers}/>
              </div>
            )
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
            <PublicProfile tailor={publicTailor} setView={setView} flash={flash} onOpenImage={setLightbox} user={user} onGateAuth={onGateAuth} reviews={publicTailorReviews} reviewBuyers={publicReviewBuyers} availability={publicAvailability} onSendAlterationRequest={onSendAlterationRequest}/>
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

// ── AVAILABILITY tab — set the dates the tailor can take work (Phase 15) ──────
function AvailabilityTab({ tailor, rows = [], loading = false, busy = false, onToggleEnabled, onSaveSettings, onSetDay, onSetSlots, onMarkRangeUnavailable, onMarkAllAvailable }) {
  const enabled=!!(tailor&&tailor.availability_enabled);
  const onVacation=!!(tailor&&tailor.vacation_mode);
  const defaultSlots=Number(tailor&&tailor.default_slots_per_day)||3;
  // Settings form (advance window + daily slots), seeded from the tailor row.
  const [advance,setAdvance]=React.useState((tailor&&tailor.advance_booking_days)||30);
  const [slots,setSlots]=React.useState(defaultSlots);
  React.useEffect(()=>{ setAdvance((tailor&&tailor.advance_booking_days)||30); setSlots(Number(tailor&&tailor.default_slots_per_day)||3); },[tailor]);

  const today=todayStart();
  // The left-hand month shown; NEXT/PREV shifts it. The second month (desktop) is
  // always left+1.
  const [monthDate,setMonthDate]=React.useState(new Date(today.getFullYear(),today.getMonth(),1));
  const map=React.useMemo(()=>rowsByDate(rows),[rows]);
  const [slotEditISO,setSlotEditISO]=React.useState(null);

  const settingsDirty=advance!==((tailor&&tailor.advance_booking_days)||30)||slots!==(Number(tailor&&tailor.default_slots_per_day)||3);
  const saveSettings=()=>onSaveSettings({advance_booking_days:Number(advance),default_slots_per_day:Math.max(1,Math.min(10,Number(slots)||1))});

  const nextMonth=new Date(monthDate.getFullYear(),monthDate.getMonth()+1,1);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:24}}>
      {/* Visibility toggle */}
      <div style={{border:"2px solid #111",padding:18,display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
        <div>
          <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:900,display:"flex",alignItems:"center",gap:8}}><Calendar width={20} height={20}/> SHOW MY AVAILABILITY TO BUYERS</p>
          <p style={{fontSize:13,color:"#888",marginTop:4}}>{enabled?"Your calendar is visible on your public profile.":"Off — your calendar is hidden from buyers."}</p>
        </div>
        <Toggle on={enabled} disabled={busy} onClick={()=>onToggleEnabled(!enabled)}/>
      </div>

      {onVacation&&(
        <div style={{border:`2px solid ${PINK}`,background:"#fff0f7",padding:"12px 16px",display:"flex",alignItems:"center",gap:10}}>
          <Plane width={18} height={18} color={PINK}/>
          <p style={{fontSize:14,color:"#111",fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:0.5}}>VACATION MODE IS ON — buyers see every date as unavailable. Your saved availability is restored when you turn vacation off.</p>
        </div>
      )}

      {/* Settings */}
      <div style={{border:"2px solid #111",padding:18,display:"flex",flexDirection:"column",gap:16}}>
        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900,letterSpacing:1.5}}>SETTINGS</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16}}>
          <F l="ACCEPT BOOKINGS UP TO">
            <select style={S.inp} value={advance} onChange={e=>setAdvance(Number(e.target.value))}>
              {ADVANCE_BOOKING_OPTIONS.map(o=><option key={o.days} value={o.days}>{o.label} ahead</option>)}
            </select>
          </F>
          <F l="MAXIMUM JOBS PER DAY">
            <input style={S.inp} type="number" min="1" max="10" value={slots} onChange={e=>setSlots(e.target.value)}/>
          </F>
        </div>
        <button className="hbtn" disabled={busy||!settingsDirty} onClick={saveSettings}
          style={{alignSelf:"flex-start",background:settingsDirty?PINK:"#ccc",color:"#fff",border:"2px solid #111",borderRadius:0,padding:"13px 26px",fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,cursor:(busy||!settingsDirty)?"not-allowed":"pointer",display:"inline-flex",alignItems:"center",gap:8}}>
          <Save width={15} height={15}/> {busy?"SAVING…":"SAVE SETTINGS"}
        </button>
      </div>

      {/* Legend */}
      <div style={{display:"flex",flexWrap:"wrap",gap:14}}>
        <LegendDot bg="#fff" border="#111" label="Available"/>
        <LegendDot bg={TEAL} border="#111" label="Partially booked"/>
        <LegendDot bg="#111" border="#111" label="Unavailable"/>
        <LegendDot bg="#eee" border="#e0e0e0" label="Past"/>
      </div>

      {/* Calendar navigation */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
        <button className="hbtn" onClick={()=>setMonthDate(new Date(monthDate.getFullYear(),monthDate.getMonth()-1,1))}
          disabled={monthDate.getFullYear()===today.getFullYear()&&monthDate.getMonth()===today.getMonth()}
          style={{background:"#fff",color:"#111",border:"2px solid #111",borderRadius:0,padding:"10px 16px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1.5,fontSize:13,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,opacity:(monthDate.getFullYear()===today.getFullYear()&&monthDate.getMonth()===today.getMonth())?0.4:1}}>
          <ChevronLeft width={16} height={16}/> PREV
        </button>
        <button className="hbtn" onClick={()=>setMonthDate(new Date(monthDate.getFullYear(),monthDate.getMonth()+1,1))}
          style={{background:"#fff",color:"#111",border:"2px solid #111",borderRadius:0,padding:"10px 16px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1.5,fontSize:13,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}}>
          NEXT <ChevronRight width={16} height={16}/>
        </button>
      </div>

      {loading?(
        <div style={S.loadingWrap}><div style={S.spinner}/><p style={S.loadingText}>LOADING CALENDAR…</p></div>
      ):(
        <div className="avail-months" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          <MonthCalendar monthDate={monthDate} map={map} tailor={tailor} today={today} interactive={!onVacation}
            onToggle={iso=>onSetDay(iso)} onEdit={iso=>setSlotEditISO(iso)} onToggleWeek={dates=>onMarkRangeUnavailable(dates)}/>
          <div className="avail-month-second">
            <MonthCalendar monthDate={nextMonth} map={map} tailor={tailor} today={today} interactive={!onVacation}
              onToggle={iso=>onSetDay(iso)} onEdit={iso=>setSlotEditISO(iso)} onToggleWeek={dates=>onMarkRangeUnavailable(dates)}/>
          </div>
        </div>
      )}

      {/* Inline slot editor */}
      {slotEditISO&&(
        <SlotEditor iso={slotEditISO} defaultSlots={defaultSlots} map={map} busy={busy}
          onSave={(n)=>{ onSetSlots(slotEditISO,n); setSlotEditISO(null); }} onClose={()=>setSlotEditISO(null)}/>
      )}

      {/* Bulk actions */}
      <div style={{display:"flex",gap:10,flexWrap:"wrap",borderTop:"2px solid #f0f0f0",paddingTop:18}}>
        <button className="hbtn" disabled={busy} onClick={onMarkAllAvailable}
          style={{background:"#fff",color:"#111",border:"2px solid #111",borderRadius:0,padding:"12px 20px",fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1.5,cursor:busy?"wait":"pointer",display:"inline-flex",alignItems:"center",gap:8}}><Check width={15} height={15}/> MARK ALL AS AVAILABLE</button>
        <button className="hbtn" disabled={busy} onClick={()=>onMarkRangeUnavailable(rangeDates(today,14))}
          style={{background:"#111",color:"#fff",border:"2px solid #111",borderRadius:0,padding:"12px 20px",fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1.5,cursor:busy?"wait":"pointer",display:"inline-flex",alignItems:"center",gap:8}}><Plane width={15} height={15}/> MARK NEXT 2 WEEKS UNAVAILABLE</button>
      </div>
      <p style={{fontSize:12,color:"#999"}}>Tap a day to switch it between available and unavailable. Double-tap (or long-press) a day to set how many jobs you can take that day. Tap a week's <strong>W</strong> button to mark the whole week unavailable.</p>
    </div>
  );
}

// Array of "YYYY-MM-DD" for `count` days starting today (used by bulk actions).
function rangeDates(today,count){ const out=[]; for(let i=0;i<count;i++) out.push(toISODate(addDays(today,i))); return out; }

function Toggle({ on, disabled, onClick }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-pressed={on}
      style={{width:60,height:32,border:"2px solid #111",borderRadius:0,background:on?PINK:"#fff",position:"relative",cursor:disabled?"wait":"pointer",flexShrink:0,padding:0}}>
      <span style={{position:"absolute",top:2,left:on?30:2,width:24,height:24,background:on?"#fff":"#111",transition:"left .15s"}}/>
    </button>
  );
}

function LegendDot({ bg, border, label }) {
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:12,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:0.5,color:"#555"}}>
      <span style={{width:16,height:16,background:bg,border:`2px solid ${border}`,display:"inline-block"}}/> {label}
    </span>
  );
}

// One month grid. `interactive` enables tap/edit/week actions (dashboard) vs the
// read-only public render.
function MonthCalendar({ monthDate, map, tailor, today, interactive = false, onToggle = () => {}, onEdit = () => {}, onToggleWeek = () => {}, publicMode = false }) {
  const weeks=monthGrid(monthDate.getFullYear(),monthDate.getMonth());
  return (
    <div style={{border:"2px solid #111"}}>
      <div style={{background:"#111",color:"#fff",padding:"10px 12px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,letterSpacing:2,fontSize:15}}>{monthLabel(monthDate)}</div>
      {/* Weekday header */}
      <div style={{display:"grid",gridTemplateColumns:`${interactive?"28px ":""}repeat(7,1fr)`,borderBottom:"2px solid #111"}}>
        {interactive&&<div style={{borderRight:"1px solid #eee"}}/>}
        {WEEKDAYS.map(w=><div key={w} style={{textAlign:"center",padding:"6px 0",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:11,letterSpacing:1,color:"#999"}}>{w}</div>)}
      </div>
      {weeks.map((week,wi)=>{
        // Days in this week that are inside this month + today-or-future (week toggle targets).
        const toggleable=week.filter(c=>c.inMonth&&startOfDay(c.date)>=today).map(c=>toISODate(c.date));
        return (
          <div key={wi} style={{display:"grid",gridTemplateColumns:`${interactive?"28px ":""}repeat(7,1fr)`,borderBottom:wi===weeks.length-1?"none":"1px solid #eee"}}>
            {interactive&&(
              <button type="button" title="Mark this week unavailable" disabled={!toggleable.length} onClick={()=>onToggleWeek(toggleable)}
                style={{border:"none",borderRight:"1px solid #eee",background:"#fafafa",cursor:toggleable.length?"pointer":"default",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:11,color:toggleable.length?"#111":"#ddd",padding:0}}>W</button>
            )}
            {week.map((cell,ci)=>(
              <DayCell key={ci} cell={cell} map={map} tailor={tailor} today={today}
                interactive={interactive} publicMode={publicMode}
                onToggle={onToggle} onEdit={onEdit}/>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// A single day. Handles single-tap (toggle), double-tap / long-press (edit slots)
// on the dashboard; renders a read-only chip in public mode.
function DayCell({ cell, map, tailor, today, interactive, publicMode, onToggle, onEdit }) {
  const clickTimer=React.useRef(null);
  const longPress=React.useRef(false);
  const lpTimer=React.useRef(null);
  if(!cell.inMonth) return <div style={{minHeight:48,background:"#fafafa",borderRight:"1px solid #f5f5f5"}}/>;
  const iso=toISODate(cell.date);
  const st=dayState(cell.date,map,tailor,{today});
  const isToday=startOfDay(cell.date).getTime()===today.getTime();
  const dayNum=cell.date.getDate();

  // Colours per the design system.
  let bg="#fff",color="#111",border="#111",label="";
  if(st.state==="past"){ bg="#f0f0f0"; color="#bbb"; border="#e8e8e8"; }
  else if(st.state==="unavailable"){ bg="#111"; color="#fff"; label="Unavailable"; }
  else if(st.state==="partial"){ bg=TEAL; color="#111"; label=st.slots===1?"1 slot left":`${st.slots} left`; }
  else { bg="#fff"; color="#111"; label=st.slots===1?"1 slot":`${st.slots} slots`; } // available

  const tappable=interactive&&st.state!=="past";

  // PUBLIC read-only: available = white + green dot, unavailable = grey, today = pink border.
  if(publicMode){
    const avail=st.state==="available"||st.state==="partial";
    return (
      <div style={{minHeight:44,borderRight:"1px solid #f0f0f0",background:st.state==="past"?"#f7f7f7":(avail?"#fff":"#f0f0f0"),
        ...(isToday?{boxShadow:`inset 0 0 0 2px ${PINK}`}:{}),display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"4px 2px",gap:2}}>
        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:14,color:st.state==="past"?"#ccc":"#111"}}>{dayNum}</span>
        {st.state!=="past"&&(avail
          ?<span style={{width:7,height:7,borderRadius:"50%",background:"#16a34a"}}/>
          :<span style={{fontSize:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:0.5,color:"#999"}}>OFF</span>)}
      </div>
    );
  }

  const handleClick=()=>{
    if(!tappable) return;
    if(longPress.current){ longPress.current=false; return; }
    if(clickTimer.current){ clearTimeout(clickTimer.current); clickTimer.current=null; onEdit(iso); return; }
    clickTimer.current=setTimeout(()=>{ clickTimer.current=null; onToggle(iso); },230);
  };
  const onTouchStart=()=>{ if(!tappable) return; longPress.current=false; lpTimer.current=setTimeout(()=>{ longPress.current=true; onEdit(iso); },480); };
  const clearLP=()=>{ if(lpTimer.current){ clearTimeout(lpTimer.current); lpTimer.current=null; } };

  return (
    <button type="button" onClick={handleClick} onTouchStart={onTouchStart} onTouchEnd={clearLP} onTouchMove={clearLP}
      disabled={!tappable}
      style={{minHeight:48,border:"none",borderRight:"1px solid #eee",background:bg,color,cursor:tappable?"pointer":"default",
        ...(isToday?{boxShadow:`inset 0 0 0 2px ${PINK}`}:{}),display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"4px 2px",gap:1}}>
      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:14,lineHeight:1}}>{dayNum}</span>
      {label&&<span style={{fontSize:9,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:0.3,lineHeight:1.1,textAlign:"center"}}>{label}</span>}
    </button>
  );
}

// Inline editor for a single day's slot count.
function SlotEditor({ iso, defaultSlots, map, busy, onSave, onClose }) {
  const row=map.get(iso);
  const current=row&&row.available!==false&&row.slots_remaining!=null?Number(row.slots_remaining):defaultSlots;
  const [n,setN]=React.useState(current);
  const d=parseISODate(iso);
  const dateLabel=d?d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"}):iso;
  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={{...S.modalBox,maxWidth:380}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
          <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:900,lineHeight:1.1}}>SLOTS FOR {dateLabel.toUpperCase()}</h2>
          <button onClick={onClose} style={{background:"none",border:"none",padding:0,cursor:"pointer",color:"#111"}}><X width={22} height={22}/></button>
        </div>
        <p style={{fontSize:13,color:"#888",margin:"10px 0 16px"}}>How many jobs can you take this day? Set to 0 to mark the day unavailable.</p>
        <input style={S.inp} type="number" min="0" max="10" value={n} onChange={e=>setN(e.target.value)}/>
        <div style={{display:"flex",gap:12,marginTop:20,flexWrap:"wrap"}}>
          <button className="hbtn" disabled={busy} onClick={()=>onSave(Math.max(0,Math.min(10,Number(n)||0)))}
            style={{flex:1,background:PINK,color:"#fff",border:"2px solid #111",borderRadius:0,padding:"13px",fontSize:14,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,cursor:busy?"wait":"pointer",opacity:busy?0.6:1}}>{busy?"…":"SAVE"}</button>
          <button className="hbtn" onClick={onClose}
            style={{background:"#fff",color:"#111",border:"2px solid #111",borderRadius:0,padding:"13px 20px",fontSize:14,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,cursor:"pointer"}}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

// ── BOOKINGS tab — incoming alteration requests (Phase 15) ────────────────────
const bkListingThumb = (l) => {
  if(!l) return "";
  if(l.image_url) return l.image_url;
  const imgs=l.images;
  if(Array.isArray(imgs)&&imgs.length) return typeof imgs[0]==="string"?imgs[0]:(imgs[0]&&imgs[0].url)||"";
  return "";
};
const firstName = (prof) => {
  if(!prof) return "A buyer";
  const fn=(prof.full_name||"").trim();
  if(fn) return fn.split(/\s+/)[0];
  return prof.username||"A buyer";
};
const bkDate = (d) => { try{ return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); }catch{ return ""; } };
const BOOKING_TABS=[["pending","PENDING"],["quoted","QUOTED"],["accepted","ACCEPTED"],["completed","COMPLETED"],["declined","DECLINED"]];

// Booking financials from a request row, tolerant of rows quoted before the
// payment columns were populated (fall back to computing from quote_pence).
const COMMISSION_RATE=0.15;
function bookingFinancials(req){
  const total=req.quote_amount_pence!=null?req.quote_amount_pence:req.quote_pence;
  if(total==null) return null;
  const commission=req.commission_amount_pence!=null?req.commission_amount_pence:Math.round(total*COMMISSION_RATE);
  const payout=req.tailor_payout_pence!=null?req.tailor_payout_pence:(total-commission);
  return { total, commission, payout };
}

// The commission breakdown shown on a booking card (Part 5) — booking value,
// the 15% Stitch'd fee, and the tailor's earnings in pink bold.
function FinancialBreakdown({ fin }) {
  if(!fin) return null;
  return (
    <div style={{border:"2px solid #111",padding:14,display:"flex",flexDirection:"column",gap:6,background:"#fafafa"}}>
      <Row l="Booking value" v={gbp(fin.total)}/>
      <Row l="Stitch'd commission (15%)" v={`-${gbp(fin.commission)}`} muted/>
      <div style={{height:1,background:"#e0e0e0",margin:"2px 0"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,color:"#111"}}>Your earnings</span>
        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:PINK}}>{gbp(fin.payout)}</span>
      </div>
    </div>
  );
}
function Row({ l, v, muted=false }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <span style={{fontSize:13,color:muted?"#888":"#444"}}>{l}</span>
      <span style={{fontSize:14,fontWeight:700,color:muted?"#888":"#111"}}>{v}</span>
    </div>
  );
}

function TailorBookings({ requests = [], buyers = {}, loading = false, onSendQuote, onDeclineRequest, onMessageBuyer, onMarkComplete = () => {} }) {
  const [tab,setTab]=React.useState("pending");
  const [quoteFor,setQuoteFor]=React.useState(null);  // request id with the quote form open
  const [amount,setAmount]=React.useState("");
  const [message,setMessage]=React.useState("");
  const [busyId,setBusyId]=React.useState(null);
  const [completeFor,setCompleteFor]=React.useState(null); // request pending the MARK COMPLETE confirm

  const counts=requests.reduce((m,r)=>{ const s=(r.status||"pending").toLowerCase(); m[s]=(m[s]||0)+1; return m; },{});
  const shown=requests.filter(r=>(r.status||"pending").toLowerCase()===tab);

  const openQuote=(req)=>{ setQuoteFor(req.id); setAmount(""); setMessage(""); };
  const submitQuote=async(req)=>{
    const pence=Math.round(parseFloat(amount)*100);
    if(isNaN(pence)||pence<=0) return;
    setBusyId(req.id);
    try{ await onSendQuote(req,pence,message.trim()); setQuoteFor(null); }
    finally{ setBusyId(null); }
  };
  const decline=async(req)=>{
    if(!window.confirm("Decline this alteration request? The buyer will be notified.")) return;
    setBusyId(req.id);
    try{ await onDeclineRequest(req); }
    finally{ setBusyId(null); }
  };
  const confirmComplete=async(req)=>{
    setBusyId(req.id);
    try{ await onMarkComplete(req); setCompleteFor(null); }
    finally{ setBusyId(null); }
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      {/* Filter tabs */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {BOOKING_TABS.map(([v,l])=>(
          <button key={v} className="hbtn" onClick={()=>setTab(v)}
            style={{background:tab===v?"#111":"#fff",color:tab===v?"#fff":"#111",border:"2px solid #111",borderRadius:0,padding:"8px 16px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1.5,fontSize:12,cursor:"pointer"}}>
            {l}{counts[v]?` (${counts[v]})`:""}
          </button>
        ))}
      </div>

      {loading?(
        <div style={S.loadingWrap}><div style={S.spinner}/><p style={S.loadingText}>LOADING REQUESTS…</p></div>
      ):shown.length===0?(
        <Placeholder title={tab.toUpperCase()} text={`No ${tab} alteration requests.`}/>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {shown.map(req=>{
            const listing=req.listings; const buyer=buyers[req.buyer_id];
            const busy=busyId===req.id;
            return (
              <div key={req.id} style={{border:"2px solid #111",padding:16,display:"flex",flexDirection:"column",gap:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                  <div style={{display:"flex",gap:12,alignItems:"center",minWidth:0}}>
                    <Thumb src={bkListingThumb(listing)} emoji={catEmoji(listing&&listing.category)} accent="#f5f5f5" style={{width:60,height:60,border:"2px solid #111",flexShrink:0}} emojiStyle={{fontSize:28}}/>
                    <div style={{minWidth:0}}>
                      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:900,lineHeight:1.1}}>{listing?listing.name:"Listing"}</p>
                      <p style={{fontSize:13,color:"#666",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,marginTop:2}}>From {firstName(buyer)}</p>
                      <p style={{fontSize:11,color:"#999",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:0.5,marginTop:1}}>RECEIVED {bkDate(req.created_at).toUpperCase()}</p>
                    </div>
                  </div>
                  <StatusBadge status={req.status}/>
                </div>

                {(req.alterations_needed||[]).length>0&&(
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {req.alterations_needed.map(a=><span key={a} style={{border:"1.5px solid #111",borderRadius:0,background:"#fff",padding:"3px 10px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,letterSpacing:0.5}}>{a}</span>)}
                  </div>
                )}
                {(req.additional_notes||req.description)&&(
                  <div>
                    <p style={{fontSize:10,fontWeight:800,color:"#999",letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>NOTES</p>
                    <p style={{fontSize:14,color:"#444",lineHeight:1.5,whiteSpace:"pre-wrap"}}>{req.additional_notes||req.description}</p>
                  </div>
                )}
                {req.preferred_date&&(
                  <p style={{fontSize:14,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,color:"#111",display:"inline-flex",alignItems:"center",gap:6}}><Calendar width={15} height={15}/> Preferred start: <span style={{fontWeight:900,color:PINK}}>{bkDate(req.preferred_date)}</span></p>
                )}
                {req.budget_pence!=null&&(
                  <p style={{fontSize:14,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,color:"#111"}}>Buyer budget: <span style={{fontWeight:900,color:PINK}}>{gbp(req.budget_pence)}</span></p>
                )}
                {req.status==="quoted"&&req.quote_pence!=null&&(
                  <p style={{fontSize:14,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,color:"#111"}}>Your quote: <span style={{fontWeight:900,color:PINK}}>{gbp(req.quote_pence)}</span></p>
                )}

                {/* Commission breakdown — paid (accepted) + completed bookings (Part 5). */}
                {(req.status==="accepted"||req.status==="completed")&&(
                  <FinancialBreakdown fin={bookingFinancials(req)}/>
                )}

                {/* Inline quote form */}
                {quoteFor===req.id?(
                  <div style={{border:"2px solid #00E5CC",background:"#effdfa",padding:14,display:"flex",flexDirection:"column",gap:12}}>
                    <div>
                      <label style={{fontSize:10,fontWeight:800,color:"#999",letterSpacing:1.5,textTransform:"uppercase",display:"block",marginBottom:5}}>QUOTE AMOUNT *</label>
                      <div style={{display:"flex",alignItems:"center",border:"2px solid #e0e0e0",background:"#fff"}}>
                        <span style={{padding:"0 12px",fontSize:16,fontWeight:800,color:"#111"}}>£</span>
                        <input style={{...S.inp,border:"none",borderLeft:"2px solid #e0e0e0"}} type="number" min="0" placeholder="40" value={amount} onChange={e=>setAmount(e.target.value)}/>
                      </div>
                    </div>
                    <div>
                      <label style={{fontSize:10,fontWeight:800,color:"#999",letterSpacing:1.5,textTransform:"uppercase",display:"block",marginBottom:5}}>MESSAGE TO BUYER (OPTIONAL)</label>
                      <textarea style={{...S.inp,height:80,resize:"vertical"}} placeholder="Add a note about your quote…" value={message} onChange={e=>setMessage(e.target.value)}/>
                    </div>
                    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                      <button className="hbtn" disabled={busy||!(parseFloat(amount)>0)}
                        style={{background:PINK,color:"#fff",border:"2px solid #111",borderRadius:0,padding:"12px 22px",fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,cursor:busy?"wait":"pointer",opacity:(busy||!(parseFloat(amount)>0))?0.5:1}}
                        onClick={()=>submitQuote(req)}>{busy?"SENDING…":"SEND QUOTE"}</button>
                      <button className="hbtn" onClick={()=>setQuoteFor(null)}
                        style={{background:"#fff",color:"#111",border:"2px solid #111",borderRadius:0,padding:"12px 22px",fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,cursor:"pointer"}}>CANCEL</button>
                    </div>
                  </div>
                ):(
                  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                    {req.status==="pending"&&(
                      <>
                        <button className="hbtn" onClick={()=>openQuote(req)}
                          style={{background:PINK,color:"#fff",border:"2px solid #111",borderRadius:0,padding:"11px 20px",fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1.5,cursor:"pointer"}}>SEND QUOTE</button>
                        <button className="hbtn" disabled={busy} onClick={()=>decline(req)}
                          style={{background:"#fff",color:"#111",border:"2px solid #111",borderRadius:0,padding:"11px 20px",fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1.5,cursor:busy?"wait":"pointer",display:"inline-flex",alignItems:"center",gap:6}}><X width={15} height={15}/> DECLINE</button>
                      </>
                    )}
                    {req.status==="accepted"&&(
                      <button className="hbtn" disabled={busy} onClick={()=>setCompleteFor(req)}
                        style={{background:"#111",color:"#fff",border:"2px solid #111",borderRadius:0,padding:"11px 20px",fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1.5,cursor:busy?"wait":"pointer",display:"inline-flex",alignItems:"center",gap:6}}><Check width={15} height={15}/> MARK AS COMPLETE</button>
                    )}
                    <button className="hbtn" onClick={()=>onMessageBuyer(req)}
                      style={{background:"#fff",color:"#111",border:"2px solid #111",borderRadius:0,padding:"11px 20px",fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1.5,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}}><Mail width={15} height={15}/> MESSAGE BUYER</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MARK AS COMPLETE confirm modal */}
      {completeFor&&(
        <div style={S.modalOverlay} onClick={()=>setCompleteFor(null)}>
          <div style={{...S.modalBox,maxWidth:420}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
              <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:900,lineHeight:1.1}}>Mark this alteration as complete?</h2>
              <button onClick={()=>setCompleteFor(null)} style={{background:"none",border:"none",padding:0,cursor:"pointer",color:"#111"}}><X width={22} height={22}/></button>
            </div>
            <p style={{fontSize:14,color:"#555",lineHeight:1.5,marginTop:10}}>The buyer will be notified to confirm.</p>
            <div style={{display:"flex",gap:12,marginTop:22,flexWrap:"wrap"}}>
              <button className="hbtn" disabled={busyId===completeFor.id} onClick={()=>confirmComplete(completeFor)}
                style={{flex:1,background:PINK,color:"#fff",border:"2px solid #111",borderRadius:0,padding:"14px",fontSize:14,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,cursor:busyId===completeFor.id?"wait":"pointer",opacity:busyId===completeFor.id?0.6:1}}>{busyId===completeFor.id?"…":"CONFIRM"}</button>
              <button className="hbtn" onClick={()=>setCompleteFor(null)}
                style={{background:"#fff",color:"#111",border:"2px solid #111",borderRadius:0,padding:"14px 22px",fontSize:14,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,cursor:"pointer"}}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── EARNINGS tab — payout totals + a list of paid bookings (Phase 15) ─────────
function TailorEarnings({ payouts = [] }) {
  // Tailor's earnings = booking value − commission. Totals split paid vs pending.
  let totalEarned=0, totalCommission=0, pendingPayout=0;
  const paidRows=[];
  for(const po of payouts){
    const amount=Number(po.amount_pence)||0;
    const commission=Number(po.commission_pence)||0;
    const payout=amount-commission;
    if(po.status==="paid"){ totalEarned+=payout; totalCommission+=commission; paidRows.push(po); }
    else if(po.status!=="failed"){ pendingPayout+=payout; }
  }
  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Summary tiles */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14}}>
        <StatTile icon={<Wallet width={18} height={18}/>} label="TOTAL EARNED" value={gbp(totalEarned)} accent={PINK}/>
        <StatTile icon={<Clock width={18} height={18}/>} label="PENDING PAYOUTS" value={gbp(pendingPayout)}/>
        <StatTile icon={<Scissors width={18} height={18}/>} label="COMMISSION PAID" value={gbp(totalCommission)} muted/>
      </div>
      <p style={{fontSize:12,color:"#999"}}>Earnings are shown after Stitch'd's 15% commission. Pending payouts are released once the buyer confirms completion.</p>

      {/* Paid bookings list */}
      <div>
        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900,letterSpacing:1.5,marginBottom:12}}>PAID BOOKINGS</p>
        {paidRows.length===0?(
          <Placeholder title="NO PAID BOOKINGS YET" text="Your completed, paid-out bookings will appear here."/>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {paidRows.map(po=>{
              const ar=po.alteration_requests; const listing=ar&&ar.listings;
              const payout=(Number(po.amount_pence)||0)-(Number(po.commission_pence)||0);
              const name=(listing&&listing.name)||(ar&&ar.garment_type)||"Alteration";
              return (
                <div key={po.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,border:"2px solid #111",padding:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
                    <Thumb src={bkListingThumb(listing)} emoji={catEmoji(listing&&listing.category)} accent="#f5f5f5" style={{width:46,height:46,border:"2px solid #111",flexShrink:0}} emojiStyle={{fontSize:22}}/>
                    <div style={{minWidth:0}}>
                      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900,lineHeight:1.1}}>{name}</p>
                      <p style={{fontSize:11,color:"#999",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:0.5}}>{bkDate(po.created_at).toUpperCase()}</p>
                    </div>
                  </div>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:900,color:PINK,whiteSpace:"nowrap"}}>{gbp(payout)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
function StatTile({ icon, label, value, accent="#111", muted=false }) {
  return (
    <div style={{border:"2px solid #111",padding:16,display:"flex",flexDirection:"column",gap:8}}>
      <span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:10,fontWeight:800,color:"#999",letterSpacing:1.5,textTransform:"uppercase"}}>{icon} {label}</span>
      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:30,fontWeight:900,color:muted?"#888":accent,lineHeight:1}}>{value}</span>
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

// Read-only next-4-weeks availability grid for the public profile (Part 3).
// Available days carry a green dot and can be tapped to pre-select a preferred
// start date; today gets a pink border; unavailable days are greyed out.
function PublicAvailability({ tailor, rows = [], selected, onSelect = () => {} }) {
  const today=todayStart();
  const map=React.useMemo(()=>rowsByDate(rows),[rows]);
  // Start from Monday of the current week, render 4 weeks (28 days).
  const start=addDays(today,-mondayIndex(today));
  const days=[]; for(let i=0;i<28;i++) days.push(addDays(start,i));
  const vacation=!!tailor.vacation_mode;
  return (
    <div style={{border:"2px solid #111"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:"2px solid #111"}}>
        {WEEKDAYS.map(w=><div key={w} style={{textAlign:"center",padding:"6px 0",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:11,letterSpacing:1,color:"#999"}}>{w}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
        {days.map((d,i)=>{
          const st=dayState(d,map,tailor,{today,vacation});
          const iso=toISODate(d);
          const isToday=startOfDay(d).getTime()===today.getTime();
          const avail=st.state==="available"||st.state==="partial";
          const isSel=selected===iso;
          const past=st.state==="past";
          return (
            <button key={i} type="button" disabled={!avail} onClick={()=>onSelect(isSel?null:iso)}
              style={{minHeight:48,border:"none",borderRight:"1px solid #f0f0f0",borderBottom:i<21?"1px solid #f0f0f0":"none",
                background:isSel?"#fff0f7":(past?"#f7f7f7":(avail?"#fff":"#f0f0f0")),
                ...(isSel?{boxShadow:`inset 0 0 0 2px ${PINK}`}:(isToday?{boxShadow:`inset 0 0 0 2px ${PINK}`}:{})),
                cursor:avail?"pointer":"default",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"4px 2px",gap:2}}>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:14,color:past?"#ccc":"#111"}}>{d.getDate()}</span>
              {!past&&(avail
                ?<span style={{width:7,height:7,borderRadius:"50%",background:isSel?PINK:"#16a34a"}}/>
                :<span style={{fontSize:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:0.3,color:"#999"}}>OFF</span>)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// The public /tailors/<id> profile.
function PublicProfile({ tailor, setView, flash, onOpenImage, user, onGateAuth = () => {}, reviews = [], reviewBuyers = {}, availability = [], onSendAlterationRequest = () => {} }) {
  // Logged-out buyers can browse the whole profile, but booking a tailor is
  // gated — tapping BOOK opens the shared sign-up prompt (context: book).
  const [gateOpen,setGateOpen]=React.useState(false);
  const onBook=()=>{ if(user){ flash("Booking coming soon!"); } else { setGateOpen(true); } };
  // Availability section (Part 3) — only when the tailor has switched it on.
  const showAvailability=!!tailor.availability_enabled;
  const [selectedDate,setSelectedDate]=React.useState(null);
  const sendRequest=()=>{ if(!user){ setGateOpen(true); return; } onSendAlterationRequest(tailor,selectedDate); };
  const reviewCount=tailor.review_count||reviews.length;
  const avgRating=tailor.average_rating!=null&&Number(tailor.average_rating)>0
    ? Number(tailor.average_rating)
    : (reviews.length?reviews.reduce((s,r)=>s+(Number(r.rating)||0),0)/reviews.length:0);
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
        {/* Overall rating (Part 3) — stars + average + count, or a no-reviews note. */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          {reviewCount>0?(
            <>
              <Stars value={avgRating} size={16}/>
              <span style={{fontSize:14,color:"#111",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,letterSpacing:0.5}}>{avgRating.toFixed(1)}</span>
              <span style={{fontSize:13,color:"#999",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:0.5}}>({reviewCount} review{reviewCount===1?"":"s"})</span>
            </>
          ):(
            <>
              <Stars value={0} size={16}/>
              <span style={{fontSize:13,color:"#999",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:1}}>No reviews yet</span>
            </>
          )}
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

        {/* AVAILABILITY (Part 3) — read-only next-4-weeks calendar, shown only when
            the tailor has enabled it. Otherwise just the SEND ALTERATION REQUEST CTA. */}
        {showAvailability?(
          <Section heading="AVAILABILITY">
            <PublicAvailability tailor={tailor} rows={availability} selected={selectedDate} onSelect={setSelectedDate}/>
            <p style={{fontSize:14,color:"#555",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:0.5,display:"flex",alignItems:"center",gap:7,marginTop:16}}>
              <Clock width={16} height={16}/> Typically responds within 24 hours
            </p>
            {selectedDate&&(
              <p style={{fontSize:13,color:"#111",marginTop:8}}>Selected start date: <strong style={{color:PINK}}>{(parseISODate(selectedDate)||new Date()).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</strong></p>
            )}
            <button className="hbtn" onClick={sendRequest}
              style={{marginTop:18,background:PINK,color:"#fff",border:"2px solid #111",borderRadius:0,padding:"15px 32px",fontSize:15,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:8}}>
              <Scissors width={16} height={16}/> SEND ALTERATION REQUEST
            </button>
          </Section>
        ):(
          <div style={{marginBottom:40}}>
            <button className="hbtn" onClick={sendRequest}
              style={{background:PINK,color:"#fff",border:"2px solid #111",borderRadius:0,padding:"15px 32px",fontSize:15,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:8}}>
              <Scissors width={16} height={16}/> SEND ALTERATION REQUEST
            </button>
          </div>
        )}

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

        {/* REVIEWS (Part 3) — overall rating + breakdown + individual reviews, or
            a no-reviews state inviting the first booking. */}
        <Section heading="REVIEWS">
          {reviews.length>0?(
            <div style={{display:"flex",flexDirection:"column",gap:28}}>
              <RatingSummary reviews={reviews} average={tailor.average_rating}/>
              <ReviewList reviews={reviews} buyers={reviewBuyers}/>
            </div>
          ):(
            <div style={{textAlign:"center",padding:"40px 20px",border:"3px dashed #e0e0e0"}}>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,color:"#bbb",marginBottom:8}}>NO REVIEWS YET</p>
              <p style={{fontSize:14,color:"#999",marginBottom:18}}>Be the first to book and review this tailor</p>
              <button className="hbtn"
                style={{background:PINK,color:"#fff",border:"2px solid #111",borderRadius:0,padding:"14px 28px",fontSize:14,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,cursor:"pointer"}}
                onClick={onBook}>BOOK THIS TAILOR</button>
            </div>
          )}
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
