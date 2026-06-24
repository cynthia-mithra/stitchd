import React from "react";
import { Scissors, MapPin, ExternalLink, Mail, ArrowLeft, CreditCard, Check, Star, X, Calendar, AlertCircle } from "lucide-react";
import { S } from "../styles";
import { Stars, Thumb } from "../components/Shared";
import { RatingChip } from "../components/Reviews";
import { ALTERATION_TYPES, tailorsForAlterations, catEmoji } from "../lib/constants";
import { toISODate, parseISODate, startOfDay, todayStart, addDays, mondayIndex, WEEKDAYS, rowsByDate, dayState } from "../lib/availability";

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
  declined:  {background:"#e6e6e6", color:"#6b6b6b"},
  completed: {background:INK,  color:"#fff"},
  cancelled: {background:"#e6e6e6", color:"#6b6b6b"},
  disputed:  {background:"#FF9500", color:"#fff"},
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
  initialPreferredDate = null, getTailorAvailability = null,
}) {
  const [step,setStep]=React.useState(1);
  const [alterations,setAlterations]=React.useState([]);
  const [notes,setNotes]=React.useState("");
  const [budget,setBudget]=React.useState("");
  const [tailor,setTailor]=React.useState(null);
  const [preferredDate,setPreferredDate]=React.useState(initialPreferredDate||"");
  const [tailorAvail,setTailorAvail]=React.useState([]); // selected tailor's availability rows

  // Reset the whole flow each time the modal is (re)opened.
  React.useEffect(()=>{ if(open){ setStep(1); setAlterations([]); setNotes(""); setBudget(""); setTailor(null); setPreferredDate(initialPreferredDate||""); setTailorAvail([]); } },[open,initialPreferredDate]);

  if(!open) return null;

  const toggle=(a)=>setAlterations(p=>p.includes(a)?p.filter(x=>x!==a):[...p,a]);
  const { matched:shownTailors, narrowed }=tailorsForAlterations(tailors,alterations);
  const step1Valid=alterations.length>0&&notes.trim().length>0;
  const lThumb=listingThumb(listing);
  const lEmoji=catEmoji(listing&&listing.category);
  const todayISO=toISODate(todayStart());

  // On choosing a tailor, load their availability (for the step-3 mini calendar)
  // if they have it enabled and a loader was provided.
  const pickTailor=async(t)=>{
    setTailor(t); setStep(3); setTailorAvail([]);
    if(t&&t.availability_enabled&&getTailorAvailability){
      try{ const rows=await getTailorAvailability(t.id); setTailorAvail(rows||[]); }catch(e){ setTailorAvail([]); }
    }
  };

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
              <label style={{fontSize:10,fontWeight:800,color:"#6b6b6b",letterSpacing:1.5,textTransform:"uppercase",display:"block",marginBottom:5}}>ADDITIONAL NOTES * ({notes.length}/500)</label>
              <textarea style={{...S.inp,height:110,resize:"vertical"}} maxLength={500} placeholder="Describe what you need in detail..." value={notes} onChange={e=>setNotes(e.target.value.slice(0,500))}/>
            </div>
            <div>
              <label style={{fontSize:10,fontWeight:800,color:"#6b6b6b",letterSpacing:1.5,textTransform:"uppercase",display:"block",marginBottom:5}}>YOUR BUDGET (OPTIONAL)</label>
              <div style={{display:"flex",alignItems:"center",border:"2px solid #e0e0e0"}}>
                <span style={{padding:"0 12px",fontSize:16,fontWeight:800,color:"#111"}}>£</span>
                <input style={{...S.inp,border:"none",borderLeft:"2px solid #e0e0e0"}} type="number" min="0" placeholder="50" value={budget} onChange={e=>setBudget(e.target.value)}/>
              </div>
            </div>
            <div>
              <label style={{fontSize:10,fontWeight:800,color:"#6b6b6b",letterSpacing:1.5,textTransform:"uppercase",display:"block",marginBottom:5}}>PREFERRED START DATE (OPTIONAL)</label>
              <input style={S.inp} type="date" min={todayISO} value={preferredDate} onChange={e=>setPreferredDate(e.target.value)}/>
              <p style={{fontSize:11,color:"#6e6e6e",marginTop:5}}>If your tailor publishes a calendar, you can fine-tune this to an available date next.</p>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
              <button onClick={onClose} style={{background:"none",border:"none",padding:0,color:"#6b6b6b",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:2,cursor:"pointer"}}>CANCEL</button>
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
                <div style={{display:"flex",justifyContent:"center",marginBottom:10}}><Scissors width={40} height={40} color="#808080"/></div>
                <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:900,color:"#6f6f6f"}}>NO TAILORS AVAILABLE YET</p>
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
                          <RatingChip average={t.average_rating} count={t.review_count} size={12}/>
                          {t.price_from_pence!=null&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,color:PINK}}>From £{poundsFromPence(t.price_from_pence)}</span>}
                          {t.turnaround_days&&<span style={{fontSize:11,color:"#6b6b6b",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>{t.turnaround_days} days</span>}
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
              {preferredDate&&<Summary label="PREFERRED START DATE"><p style={{fontSize:15,fontWeight:800,color:PINK}}>{(parseISODate(preferredDate)||new Date()).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</p></Summary>}
            </div>

            {/* Availability-aware date picker — only when this tailor publishes a
                calendar. Tapping an available day sets the preferred start date. */}
            {tailor.availability_enabled&&(
              <div>
                <label style={{fontSize:10,fontWeight:800,color:"#6b6b6b",letterSpacing:1.5,textTransform:"uppercase",display:"flex",alignItems:"center",gap:6,marginBottom:8}}><Calendar width={13} height={13}/> PICK AN AVAILABLE START DATE (OPTIONAL)</label>
                <MiniAvailabilityPicker tailor={tailor} rows={tailorAvail} selected={preferredDate} onSelect={setPreferredDate}/>
              </div>
            )}

            <button className="hbtn" disabled={busy}
              style={{width:"100%",background:PINK,color:"#fff",border:"2px solid #111",borderRadius:0,padding:"16px",fontSize:16,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:3,cursor:busy?"wait":"pointer",opacity:busy?0.6:1}}
              onClick={()=>onSend({alterations,notes:notes.trim(),budget,tailor,preferredDate:preferredDate||null})}>
              {busy?"SENDING…":"SEND REQUEST"}
            </button>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <button className="hbtn" onClick={()=>setStep(2)} style={{background:"#fff",color:"#111",border:"2px solid #111",borderRadius:0,padding:"12px 24px",fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}}><ArrowLeft width={14} height={14}/> BACK</button>
              <button onClick={onClose} style={{background:"none",border:"none",padding:0,color:"#6b6b6b",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:2,cursor:"pointer"}}>CANCEL</button>
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
      <p style={{fontSize:10,fontWeight:800,color:"#6b6b6b",letterSpacing:1.5,textTransform:"uppercase",marginBottom:5}}>{label}</p>
      {children}
    </div>
  );
}

// Compact next-4-weeks calendar for the request flow. Only the tailor's available
// dates are tappable; the selected one is highlighted in #FF1493. Mirrors the
// public-profile availability grid but bound to the preferred-date state.
function MiniAvailabilityPicker({ tailor, rows = [], selected, onSelect = () => {} }) {
  const today=todayStart();
  const map=React.useMemo(()=>rowsByDate(rows),[rows]);
  const start=addDays(today,-mondayIndex(today));
  const days=[]; for(let i=0;i<28;i++) days.push(addDays(start,i));
  const vacation=!!tailor.vacation_mode;
  return (
    <div style={{border:"2px solid #111"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:"2px solid #111"}}>
        {WEEKDAYS.map(w=><div key={w} style={{textAlign:"center",padding:"5px 0",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:10,letterSpacing:1,color:"#6b6b6b"}}>{w}</div>)}
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
            <button key={i} type="button" disabled={!avail} onClick={()=>onSelect(isSel?"":iso)}
              style={{minHeight:44,border:"none",borderRight:"1px solid #f0f0f0",borderBottom:i<21?"1px solid #f0f0f0":"none",
                background:isSel?PINK:(past?"#f7f7f7":(avail?"#fff":"#f0f0f0")),color:isSel?"#fff":"#111",
                ...(!isSel&&isToday?{boxShadow:`inset 0 0 0 2px ${PINK}`}:{}),
                cursor:avail?"pointer":"default",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"3px 2px",gap:2}}>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:13,color:isSel?"#fff":(past?"#ccc":"#111")}}>{d.getDate()}</span>
              {!past&&(avail
                ?<span style={{width:6,height:6,borderRadius:"50%",background:isSel?"#fff":"#16a34a"}}/>
                :<span style={{fontSize:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,color:"#6b6b6b"}}>OFF</span>)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════ BUYER — MY ALTERATION REQUESTS ════════════════════════
// The /alterations page: every request the buyer has sent, newest first.
export default function Alterations({
  view, setView, loading = false, requests = [], reviews = [],
  onMessageTailor = () => {}, onFindTailor = () => {}, onAcceptQuote = () => {},
  onDeclineQuote = () => {}, onConfirmCompletion = () => {}, onLeaveReview = () => {},
  onReportProblem = () => {},
  checkoutId = null,
}) {
  // Confirm modals: declining a quote, and confirming a completed booking.
  const [declineReq,setDeclineReq]=React.useState(null);
  const [confirmReq,setConfirmReq]=React.useState(null);
  const [busy,setBusy]=React.useState(false);

  if(view!=="alterations") return null;

  // Map alteration_request_id → the review the buyer left, so completed bookings
  // can show "Review submitted" + their stars instead of the LEAVE A REVIEW button.
  const reviewByReq={};
  (reviews||[]).forEach(rv=>{ if(rv&&rv.alteration_request_id) reviewByReq[rv.alteration_request_id]=rv; });

  const doDecline=async()=>{ const r=declineReq; setBusy(true); try{ await onDeclineQuote(r); }finally{ setBusy(false); setDeclineReq(null); } };
  const doConfirm=async()=>{ const r=confirmReq; setBusy(true); try{ await onConfirmCompletion(r); }finally{ setBusy(false); setConfirmReq(null); } };

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
          <div style={{display:"flex",justifyContent:"center",marginBottom:14}}><Scissors width={48} height={48} color="#808080"/></div>
          <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:900,color:"#6f6f6f",marginBottom:18}}>NO ALTERATION REQUESTS YET</p>
          <button className="hbtn" onClick={onFindTailor}
            style={{background:PINK,color:"#fff",border:"2px solid #111",borderRadius:0,padding:"14px 28px",fontSize:14,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:8}}><Scissors width={16} height={16}/> FIND A TAILOR</button>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {requests.map(req=>{
            const listing=req.listings; const tailor=req.tailors;
            const st=(req.status||"pending").toLowerCase();
            const tailorName=tailor?tailor.display_name:"Tailor";
            // Total the buyer pays / paid, and whether the payout's been released.
            const totalPence=req.quote_amount_pence!=null?req.quote_amount_pence:req.quote_pence;
            const payoutPaid=req.payout_status==="paid"||(Array.isArray(req.tailor_payouts)&&req.tailor_payouts.some(p=>p.status==="paid"));
            const checkingOut=checkoutId===req.id;
            return (
              <div key={req.id} style={{border:"2px solid #111",padding:16,display:"flex",flexDirection:"column",gap:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                  <div style={{display:"flex",gap:12,alignItems:"center",minWidth:0}}>
                    <Thumb src={listingThumb(listing)} emoji={catEmoji(listing&&listing.category)} accent="#f5f5f5" style={{width:60,height:60,border:"2px solid #111",flexShrink:0}} emojiStyle={{fontSize:28}}/>
                    <div style={{minWidth:0}}>
                      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:900,lineHeight:1.1}}>{listing?listing.name:"Listing"}</p>
                      <p style={{fontSize:12,color:"#6b6b6b",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:0.5,marginTop:2}}>SENT {fmtDate(req.created_at).toUpperCase()}</p>
                    </div>
                  </div>
                  <StatusBadge status={req.status}/>
                </div>

                {/* Tailor row */}
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:32,height:32,borderRadius:"50%",border:"2px solid #111",overflow:"hidden",flexShrink:0,background:PINK,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {tailor&&tailor.profile_image_url?<img src={tailor.profile_image_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<Scissors width={14} height={14} color="#fff"/>}
                  </div>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:800}}>{tailorName}</span>
                </div>

                <AlterationPills items={req.alterations_needed}/>

                {/* ── QUOTED — QUOTE RECEIVED + ACCEPT AND PAY / DECLINE ── */}
                {st==="quoted"&&req.quote_pence!=null&&(
                  <div style={{border:"2px solid #00E5CC",background:"#effdfa",padding:18,display:"flex",flexDirection:"column",gap:12}}>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:900,letterSpacing:2.5,color:"#111"}}>QUOTE RECEIVED</p>
                    {/* Tailor name + profile image */}
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:36,height:36,borderRadius:"50%",border:"2px solid #111",overflow:"hidden",flexShrink:0,background:PINK,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {tailor&&tailor.profile_image_url?<img src={tailor.profile_image_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<Scissors width={16} height={16} color="#fff"/>}
                      </div>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900}}>{tailorName}</span>
                    </div>
                    {/* Amount — large + bold + pink */}
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:46,fontWeight:900,color:PINK,lineHeight:1,letterSpacing:-1}}>{gbp(req.quote_pence)}</p>
                    {/* Tailor message in a light grey box */}
                    {req.quote_message&&(
                      <div style={{background:"#f4f4f4",border:"1.5px solid #e4e4e4",padding:"10px 14px"}}>
                        <p style={{fontSize:14,color:"#555",lineHeight:1.5,whiteSpace:"pre-wrap"}}>{req.quote_message}</p>
                      </div>
                    )}
                    {/* Commission note */}
                    <p style={{fontSize:11,color:"#6b6b6b"}}>Includes Stitch'd booking fee</p>
                    {/* ACCEPT AND PAY — black, full width */}
                    <button className="hbtn" disabled={checkingOut} onClick={()=>onAcceptQuote(req)}
                      style={{width:"100%",background:"#111",color:"#fff",border:"2px solid #111",borderRadius:0,padding:"16px",fontSize:15,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2.5,cursor:checkingOut?"wait":"pointer",opacity:checkingOut?0.6:1,display:"inline-flex",alignItems:"center",justifyContent:"center",gap:10}}>
                      <CreditCard width={18} height={18}/> {checkingOut?"STARTING CHECKOUT…":"ACCEPT AND PAY"}
                    </button>
                    {/* DECLINE QUOTE — outlined, smaller */}
                    <button className="hbtn" disabled={checkingOut} onClick={()=>setDeclineReq(req)}
                      style={{alignSelf:"center",background:"#fff",color:"#111",border:"2px solid #111",borderRadius:0,padding:"9px 18px",fontSize:12,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1.5,cursor:"pointer"}}>DECLINE QUOTE</button>
                  </div>
                )}

                {/* ── ACCEPTED — paid, awaiting the work ── */}
                {st==="accepted"&&(
                  <div style={{border:`2px solid ${PINK}`,background:"#fff0f7",padding:14}}>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:900,color:"#111"}}>BOOKING CONFIRMED</p>
                    {totalPence!=null&&<p style={{fontSize:13,color:"#555",marginTop:3}}>Paid <span style={{fontWeight:800,color:PINK}}>{gbp(totalPence)}</span> · {tailorName} will be in touch to arrange your fitting.</p>}
                  </div>
                )}

                {/* ── COMPLETED — confirm receipt to release payout, then review ── */}
                {st==="completed"&&(
                  payoutPaid?(
                    reviewByReq[req.id]?(
                      <div style={{border:"2px solid #00E5CC",background:"#effdfa",padding:14,display:"flex",flexDirection:"column",gap:8}}>
                        <Stars value={Number(reviewByReq[req.id].rating)||0} size={18}/>
                        <p style={{fontSize:13,color:"#444",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1,display:"inline-flex",alignItems:"center",gap:6}}><Check width={15} height={15} color="#00E5CC"/> REVIEW SUBMITTED</p>
                      </div>
                    ):(
                    <div style={{border:"2px solid #00E5CC",background:"#effdfa",padding:14,display:"flex",flexDirection:"column",gap:10}}>
                      <p style={{fontSize:14,color:"#444",lineHeight:1.5}}>How was your experience with <strong>{tailorName}</strong>?</p>
                      <button className="hbtn" onClick={()=>onLeaveReview(req)}
                        style={{alignSelf:"flex-start",background:PINK,color:"#fff",border:"2px solid #111",borderRadius:0,padding:"11px 20px",fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1.5,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:8}}><Star width={15} height={15}/> LEAVE A REVIEW</button>
                    </div>
                    )
                  ):(
                    <div style={{border:"2px solid #111",background:"#fafafa",padding:14,display:"flex",flexDirection:"column",gap:10}}>
                      <p style={{fontSize:14,color:"#444",lineHeight:1.5}}><strong>{tailorName}</strong> has marked your alteration as complete. Please confirm once you've received your item.</p>
                      <button className="hbtn" onClick={()=>setConfirmReq(req)}
                        style={{alignSelf:"flex-start",background:"#111",color:"#fff",border:"2px solid #111",borderRadius:0,padding:"12px 22px",fontSize:14,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:8}}><Check width={16} height={16}/> CONFIRM COMPLETION</button>
                    </div>
                  )
                )}

                {/* ── DISPUTED — buyer reported a problem; Stitch'd reviewing ── */}
                {st==="disputed"&&(
                  <div style={{border:"2px solid #FF9500",background:"#fff7ec",padding:14,display:"flex",flexDirection:"column",gap:6}}>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:900,color:"#111",display:"inline-flex",alignItems:"center",gap:8}}><AlertCircle width={16} height={16} color="#FF9500"/> PROBLEM REPORTED</p>
                    <p style={{fontSize:13,color:"#555",lineHeight:1.5}}>Stitch'd is reviewing your report and will be in touch. The tailor's payment is on hold until it's resolved.</p>
                  </div>
                )}

                {/* Actions */}
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  <button className="hbtn" onClick={()=>onMessageTailor(req)}
                    style={{background:"#fff",color:"#111",border:"2px solid #111",borderRadius:0,padding:"11px 20px",fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1.5,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:8}}><Mail width={15} height={15}/> MESSAGE TAILOR</button>
                  {/* Report a problem — available once paid (accepted/completed) and the
                      payout hasn't been released, so it can still be held for review. */}
                  {(st==="accepted"||st==="completed")&&!payoutPaid&&(
                    <button className="hbtn" onClick={()=>onReportProblem(req)}
                      style={{background:"#fff",color:"#FF9500",border:"2px solid #FF9500",borderRadius:0,padding:"11px 20px",fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1.5,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:8}}><AlertCircle width={15} height={15}/> REPORT A PROBLEM</button>
                  )}
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

      {/* DECLINE QUOTE confirm modal */}
      {declineReq&&(
        <ConfirmModal
          title="Decline this quote?"
          body="The tailor will be notified that you've declined."
          confirmLabel="CONFIRM" cancelLabel="CANCEL" busy={busy}
          onConfirm={doDecline} onCancel={()=>setDeclineReq(null)}/>
      )}
      {/* CONFIRM COMPLETION confirm modal */}
      {confirmReq&&(
        <ConfirmModal
          title="Confirm completion?"
          body="This confirms you've received your item and releases the tailor's payout."
          confirmLabel="CONFIRM" cancelLabel="CANCEL" busy={busy}
          onConfirm={doConfirm} onCancel={()=>setConfirmReq(null)}/>
      )}
    </main>
  );
}

// Small shared confirm dialog (matches the design system: 2px ink border, no
// radius, Barlow Condensed). CONFIRM is pink, CANCEL is a plain link.
function ConfirmModal({ title, body, confirmLabel="CONFIRM", cancelLabel="CANCEL", busy=false, onConfirm, onCancel }) {
  return (
    <div style={S.modalOverlay} onClick={onCancel}>
      <div style={{...S.modalBox,maxWidth:420}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
          <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:900,lineHeight:1.1}}>{title}</h2>
          <button onClick={onCancel} style={{background:"none",border:"none",padding:0,cursor:"pointer",color:"#111"}}><X width={22} height={22}/></button>
        </div>
        {body&&<p style={{fontSize:14,color:"#555",lineHeight:1.5,marginTop:10}}>{body}</p>}
        <div style={{display:"flex",gap:12,marginTop:22,flexWrap:"wrap"}}>
          <button className="hbtn" disabled={busy} onClick={onConfirm}
            style={{flex:1,background:PINK,color:"#fff",border:"2px solid #111",borderRadius:0,padding:"14px",fontSize:14,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,cursor:busy?"wait":"pointer",opacity:busy?0.6:1}}>{busy?"…":confirmLabel}</button>
          <button className="hbtn" disabled={busy} onClick={onCancel}
            style={{background:"#fff",color:"#111",border:"2px solid #111",borderRadius:0,padding:"14px 22px",fontSize:14,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,cursor:"pointer"}}>{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
}
