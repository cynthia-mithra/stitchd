import React from "react";
import { Scissors, MapPin, ExternalLink, Mail, ArrowLeft } from "lucide-react";
import { S } from "../styles";
import { Stars, Thumb } from "../components/Shared";
import { ALTERATION_TYPES, tailorsForAlterations, catEmoji } from "../lib/constants";

const PINK = "#FF1493";
const TEAL = "#00E5CC";
const INK  = "#111";

const poundsFromPence = (p) => (p==null||p==="") ? "" : (Number(p)/100).toString();
export const gbp = (pence) => pence==null ? "" : `£${(Number(pence)/100).toFixed(2).replace(/\.00$/,"")}`;

// A listing's display thumbnail source (mirrors the email/thumb fallback).
const listingThumb = (l) => {
  if(!l) return "";
  if(l.image_url) return l.image_url;
  const imgs=l.images;
  if(Array.isArray(imgs)&&imgs.length) return typeof imgs[0]==="string"?imgs[0]:(imgs[0]&&imgs[0].url)||"";
  return "";
};

// ── Status badge ──────────────────────────────────────────────────────────────
// Colours per the design system: PENDING/COMPLETED ink, QUOTED teal, ACCEPTED
// pink, DECLINED/CANCELLED grey.
const STATUS_STYLE = {
  pending:   {background:INK,  color:"#fff"},
  quoted:    {background:TEAL, color:INK},
  accepted:  {background:PINK, color:"#fff"},
  declined:  {background:"#e6e6e6", color:"#999"},
  completed: {background:INK,  color:"#fff"},
  cancelled: {background:"#e6e6e6", color:"#999"},
};
export function StatusBadge({ status }) {
  const st=(status||"pending").toLowerCase();
  const sty=STATUS_STYLE[st]||STATUS_STYLE.pending;
  return (
    <span style={{...sty,border:`2px solid ${st==="declined"||st==="cancelled"?"#ccc":INK}`,borderRadius:0,padding:"3px 10px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1.5,fontSize:11,textTransform:"uppercase",whiteSpace:"nowrap"}}>
      {st}
    </span>
  );
}

// Pill list of alteration types (read-only display on cards/summaries).
function AlterationPills({ items }) {
  if(!(items||[]).length) return null;
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
      {items.map(a=>(
        <span key={a} style={{border:"1.5px solid #111",borderRadius:0,background:"#fff",padding:"3px 10px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,letterSpacing:0.5}}>{a}</span>
      ))}
    </div>
  );
}

const fmtDate = (d) => { try{ return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); }catch{ return ""; } };

// ════════════════════════════ REQUEST MODAL ════════════════════════════
// The multi-step "request alterations" flow launched from the listing detail
// page (FIND A TAILOR). Step 1 — what you need; Step 2 — choose a tailor;
// Step 3 — review & send.
export function RequestAlterationModal({
  open, onClose, listing, tailors = [], busy = false,
  onSend = () => {}, openTailorProfile = () => {}, browseAllTailors = () => {},
}) {
  const [step,setStep]=React.useState(1);
  const [alterations,setAlterations]=React.useState([]);
  const [notes,setNotes]=React.useState("");
  const [budget,setBudget]=React.useState("");
  const [tailor,setTailor]=React.useState(null);

  // Reset the whole flow each time the modal is (re)opened.
  React.useEffect(()=>{ if(open){ setStep(1); setAlterations([]); setNotes(""); setBudget(""); setTailor(null); } },[open]);

  if(!open) return null;

  const toggle=(a)=>setAlterations(p=>p.includes(a)?p.filter(x=>x!==a):[...p,a]);
  const { matched:shownTailors, narrowed }=tailorsForAlterations(tailors,alterations);
  const step1Valid=alterations.length>0&&notes.trim().length>0;
  const lThumb=listingThumb(listing);
  const lEmoji=catEmoji(listing&&listing.category);

  const pickTailor=(t)=>{ setTailor(t); setStep(3); };

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={{...S.modalBox,maxWidth:560}} onClick={e=>e.stopPropagation()}>
        {/* Step progress */}
        <div style={{display:"flex",gap:6,marginBottom:22}}>
          {[1,2,3].map(n=>(<div key={n} style={{flex:1,height:6,background:step>=n?PINK:"#eee"}}/>))}
        </div>

        {/* ── STEP 1 — WHAT DO YOU NEED? ── */}
        {step===1&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900,display:"flex",alignItems:"center",gap:10}}><Scissors width={26} height={26}/> WHAT DO YOU NEED?</h2>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {ALTERATION_TYPES.map(a=>{
                const on=alterations.includes(a);
                return (
                  <button key={a} type="button" onClick={()=>toggle(a)} className="fpill"
                    style={{...S.pill,fontSize:13,padding:"8px 14px",...(on?{...S.pillOn,background:PINK,borderColor:PINK}:{})}}>{a}</button>
                );
              })}
            </div>
            <div>
              <label style={{fontSize:10,fontWeight:800,color:"#999",letterSpacing:1.5,textTransform:"uppercase",display:"block",marginBottom:5}}>ADDITIONAL NOTES * ({notes.length}/500)</label>
              <textarea style={{...S.inp,height:110,resize:"vertical"}} maxLength={500} placeholder="Describe what you need in detail..." value={notes} onChange={e=>setNotes(e.target.value.slice(0,500))}/>
            </div>
            <div>
              <label style={{fontSize:10,fontWeight:800,color:"#999",letterSpacing:1.5,textTransform:"uppercase",display:"block",marginBottom:5}}>YOUR BUDGET (OPTIONAL)</label>
              <div style={{display:"flex",alignItems:"center",border:"2px solid #e0e0e0"}}>
                <span style={{padding:"0 12px",fontSize:16,fontWeight:800,color:"#111"}}>£</span>
                <input style={{...S.inp,border:"none",borderLeft:"2px solid #e0e0e0"}} type="number" min="0" placeholder="50" value={budget} onChange={e=>setBudget(e.target.value)}/>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
              <button onClick={onClose} style={{background:"none",border:"none",padding:0,color:"#999",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:2,cursor:"pointer"}}>CANCEL</button>
              <button className="hbtn" disabled={!step1Valid}
                style={{background:PINK,color:"#fff",border:"2px solid #111",borderRadius:0,padding:"14px 32px",fontSize:14,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,cursor:step1Valid?"pointer":"not-allowed",opacity:step1Valid?1:0.4}}
                onClick={()=>setStep(2)}>NEXT →</button>
            </div>
          </div>
        )}

        {/* ── STEP 2 — CHOOSE A TAILOR ── */}
        {step===2&&(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div>
              <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900}}>CHOOSE A TAILOR</h2>
              <p style={{fontSize:13,color:"#888",marginTop:2}}>All tailors are vetted by Stitch'd{narrowed?" · matched to your alterations":""}</p>
            </div>
            {shownTailors.length===0?(
              <div style={{textAlign:"center",padding:"40px 20px",border:"3px dashed #e0e0e0"}}>
                <div style={{display:"flex",justifyContent:"center",marginBottom:10}}><Scissors width={40} height={40} color="#ccc"/></div>
                <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:900,color:"#bbb"}}>NO TAILORS AVAILABLE YET</p>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:10,maxHeight:"42vh",overflowY:"auto"}}>
                {shownTailors.map(t=>{
                  const selected=tailor&&tailor.id===t.id;
                  return (
                    <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,border:"2px solid #111",padding:10}}>
                      <div style={{width:40,height:40,borderRadius:"50%",border:"2px solid #111",overflow:"hidden",flexShrink:0,background:PINK,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {t.profile_image_url?<img src={t.profile_image_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<Scissors width={18} height={18} color="#fff"/>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:17,fontWeight:900,lineHeight:1.1}}>{t.display_name}</p>
                        <p style={{fontSize:12,color:"#888",display:"flex",alignItems:"center",gap:4}}><MapPin width={12} height={12}/> {t.location}</p>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:3,flexWrap:"wrap"}}>
                          <Stars value={0} size={12}/>
                          {t.price_from_pence!=null&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,color:PINK}}>From £{poundsFromPence(t.price_from_pence)}</span>}
                          {t.turnaround_days&&<span style={{fontSize:11,color:"#999",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>{t.turnaround_days} days</span>}
                        </div>
                        <button onClick={()=>openTailorProfile(t.id)} style={{background:"none",border:"none",padding:0,marginTop:4,color:"#111",fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:1,textDecoration:"underline",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}}><ExternalLink width={11} height={11}/> VIEW PROFILE</button>
                      </div>
                      <button className="hbtn" onClick={()=>pickTailor(t)}
                        style={{background:selected?PINK:"#fff",color:selected?"#fff":"#111",border:"2px solid #111",borderRadius:0,padding:"10px 18px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1.5,fontSize:13,cursor:"pointer",flexShrink:0}}>SELECT</button>
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={browseAllTailors} style={{background:"none",border:"none",padding:0,color:"#111",fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:800,letterSpacing:1.5,textDecoration:"underline",cursor:"pointer",alignSelf:"center"}}>BROWSE ALL TAILORS →</button>
            <div style={{display:"flex",justifyContent:"flex-start",marginTop:2}}>
              <button className="hbtn" onClick={()=>setStep(1)} style={{background:"#fff",color:"#111",border:"2px solid #111",borderRadius:0,padding:"12px 24px",fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}}><ArrowLeft width={14} height={14}/> BACK</button>
            </div>
          </div>
        )}

        {/* ── STEP 3 — REVIEW & SEND ── */}
        {step===3&&tailor&&(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900}}>REVIEW & SEND</h2>
            <div style={{border:"2px solid #111",padding:16,display:"flex",flexDirection:"column",gap:14}}>
              {/* Listing */}
              <div style={{display:"flex",gap:12,alignItems:"center"}}>
                <Thumb src={lThumb} emoji={lEmoji} accent="#f5f5f5" style={{width:56,height:56,border:"2px solid #111",flexShrink:0}} emojiStyle={{fontSize:26}}/>
                <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:900,lineHeight:1.1}}>{listing&&listing.name}</p>
              </div>
              <Summary label="ALTERATIONS"><AlterationPills items={alterations}/></Summary>
              <Summary label="NOTES"><p style={{fontSize:14,color:"#444",lineHeight:1.5,whiteSpace:"pre-wrap"}}>{notes}</p></Summary>
              {budget&&<Summary label="BUDGET"><p style={{fontSize:15,fontWeight:800,color:"#111"}}>£{budget}</p></Summary>}
              <Summary label="TAILOR">
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:36,height:36,borderRadius:"50%",border:"2px solid #111",overflow:"hidden",flexShrink:0,background:PINK,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {tailor.profile_image_url?<img src={tailor.profile_image_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<Scissors width={16} height={16} color="#fff"/>}
                  </div>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:17,fontWeight:900}}>{tailor.display_name}</span>
                </div>
              </Summary>
            </div>
            <button className="hbtn" disabled={busy}
              style={{width:"100%",background:PINK,color:"#fff",border:"2px solid #111",borderRadius:0,padding:"16px",fontSize:16,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:3,cursor:busy?"wait":"pointer",opacity:busy?0.6:1}}
              onClick={()=>onSend({alterations,notes:notes.trim(),budget,tailor})}>
              {busy?"SENDING…":"SEND REQUEST"}
            </button>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <button className="hbtn" onClick={()=>setStep(2)} style={{background:"#fff",color:"#111",border:"2px solid #111",borderRadius:0,padding:"12px 24px",fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}}><ArrowLeft width={14} height={14}/> BACK</button>
              <button onClick={onClose} style={{background:"none",border:"none",padding:0,color:"#999",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:2,cursor:"pointer"}}>CANCEL</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Summary({ label, children }) {
  return (
    <div>
      <p style={{fontSize:10,fontWeight:800,color:"#999",letterSpacing:1.5,textTransform:"uppercase",marginBottom:5}}>{label}</p>
      {children}
    </div>
  );
}

// ════════════════════════ BUYER — MY ALTERATION REQUESTS ════════════════════════
// The /alterations page: every request the buyer has sent, newest first.
export default function Alterations({
  view, setView, loading = false, requests = [],
  onMessageTailor = () => {}, onFindTailor = () => {}, onAcceptQuote = () => {},
}) {
  if(view!=="alterations") return null;
  return (
    <main style={{...S.main,maxWidth:820}}>
      <button style={S.back} onClick={()=>setView("shop")}>← BACK</button>
      <div style={{marginBottom:28,paddingBottom:20,borderBottom:"3px solid #111"}}>
        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:4,color:PINK,marginBottom:6}}>STITCH'D TAILORS</p>
        <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(36px,6vw,56px)",fontWeight:900,letterSpacing:-1,lineHeight:1,display:"flex",alignItems:"center",gap:12}}>
          <Scissors width={40} height={40}/> ALTERATION REQUESTS
        </h1>
      </div>

      {loading?(
        <div style={S.loadingWrap}><div style={S.spinner}/><p style={S.loadingText}>LOADING REQUESTS…</p></div>
      ):requests.length===0?(
        <div style={{textAlign:"center",padding:"70px 20px",border:"3px dashed #e0e0e0"}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:14}}><Scissors width={48} height={48} color="#ccc"/></div>
          <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:900,color:"#bbb",marginBottom:18}}>NO ALTERATION REQUESTS YET</p>
          <button className="hbtn" onClick={onFindTailor}
            style={{background:PINK,color:"#fff",border:"2px solid #111",borderRadius:0,padding:"14px 28px",fontSize:14,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:8}}><Scissors width={16} height={16}/> FIND A TAILOR</button>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {requests.map(req=>{
            const listing=req.listings; const tailor=req.tailors;
            const st=(req.status||"pending").toLowerCase();
            return (
              <div key={req.id} style={{border:"2px solid #111",padding:16,display:"flex",flexDirection:"column",gap:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                  <div style={{display:"flex",gap:12,alignItems:"center",minWidth:0}}>
                    <Thumb src={listingThumb(listing)} emoji={catEmoji(listing&&listing.category)} accent="#f5f5f5" style={{width:60,height:60,border:"2px solid #111",flexShrink:0}} emojiStyle={{fontSize:28}}/>
                    <div style={{minWidth:0}}>
                      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:900,lineHeight:1.1}}>{listing?listing.name:"Listing"}</p>
                      <p style={{fontSize:12,color:"#999",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:0.5,marginTop:2}}>SENT {fmtDate(req.created_at).toUpperCase()}</p>
                    </div>
                  </div>
                  <StatusBadge status={req.status}/>
                </div>

                {/* Tailor row */}
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:32,height:32,borderRadius:"50%",border:"2px solid #111",overflow:"hidden",flexShrink:0,background:PINK,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {tailor&&tailor.profile_image_url?<img src={tailor.profile_image_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<Scissors width={14} height={14} color="#fff"/>}
                  </div>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:800}}>{tailor?tailor.display_name:"Tailor"}</span>
                </div>

                <AlterationPills items={req.alterations_needed}/>

                {/* QUOTED — show amount + accept */}
                {st==="quoted"&&req.quote_pence!=null&&(
                  <div style={{border:"2px solid #00E5CC",background:"#effdfa",padding:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                    <div>
                      <p style={{fontSize:10,fontWeight:800,color:"#999",letterSpacing:1.5,textTransform:"uppercase"}}>QUOTE</p>
                      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:30,fontWeight:900,color:PINK}}>{gbp(req.quote_pence)}</p>
                      {req.quote_message&&<p style={{fontSize:13,color:"#555",marginTop:2}}>{req.quote_message}</p>}
                    </div>
                    <button className="hbtn" onClick={()=>onAcceptQuote(req)}
                      style={{background:PINK,color:"#fff",border:"2px solid #111",borderRadius:0,padding:"12px 22px",fontSize:14,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,cursor:"pointer"}}>ACCEPT QUOTE</button>
                  </div>
                )}

                {/* Actions */}
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  <button className="hbtn" onClick={()=>onMessageTailor(req)}
                    style={{background:"#fff",color:"#111",border:"2px solid #111",borderRadius:0,padding:"11px 20px",fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1.5,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:8}}><Mail width={15} height={15}/> MESSAGE TAILOR</button>
                  {st==="declined"&&(
                    <button className="hbtn" onClick={onFindTailor}
                      style={{background:PINK,color:"#fff",border:"2px solid #111",borderRadius:0,padding:"11px 20px",fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1.5,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:8}}><Scissors width={15} height={15}/> FIND ANOTHER TAILOR</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
