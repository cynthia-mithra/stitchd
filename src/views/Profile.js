import React from "react";
import { Camera, Ruler, Scissors, ShieldCheck, Check, MapPin, BadgeCheck, ShoppingBag, Plane, Instagram, UserPlus, UserCheck, Tag, Calendar, Clock, Users } from "lucide-react";
import { SIZES, CARD_COLORS, catEmoji, currencySymbol, listingGender } from "../lib/constants";
import { S } from "../styles";
import { Sec, F, Tog, Stars, VerifiedBadge, IDVerifiedBadge } from "../components/Shared";
import LoginPromptModal from "../components/LoginPromptModal";

export default function Profile({
  view, setView, prevView, user, onGateAuth = () => {},
  // editprofile
  profForm, setProfForm, saveProfile, profSaving,
  twoFAStep, setTwoFAStep, twoFAData, setTwoFAData, twoFACode, setTwoFACode,
  twoFAFactors, twoFALoading, confirm2FA, disable2FA, load2FAFactors, setup2FA,
  // profile / storefront
  viewedProfile, profileListings, reviews, isFollowing, toggleFollow, openDetail,
  followerCount = 0,
}) {
  // Phase 13 — storefront listings filter (ALL / WOMEN / MEN). Local to the view;
  // resets whenever a different seller's storefront is opened.
  const [storeFilter,setStoreFilter]=React.useState("ALL");
  React.useEffect(()=>{ setStoreFilter("ALL"); },[viewedProfile?.id]);
  // Login gate — following a seller needs an account; logged-out visitors get
  // the shared sign-up prompt (context: follow) rather than a bounce to /auth.
  const [gate,setGate]=React.useState(null);
  const requireAuth=(context,action)=>{ if(user) action(); else setGate(context); };
  if(view!=="editprofile"&&view!=="profile") return null;
  return (
    <>
      {/* EDIT PROFILE */}
      {view==="editprofile"&&user&&(
        <main style={{...S.main,maxWidth:600}}>
          <button style={S.back} onClick={()=>setView("shop")}>← BACK</button>
          <div style={S.formCard} className="form-card">
            <div style={S.formHero}>
              <h2 style={S.formTitle}>YOUR<br/><span style={{color:"#FF1493"}}>PROFILE.</span></h2>
            </div>
            <Sec label="PROFILE PICTURE">
              <div style={{display:"flex",alignItems:"center",gap:20}}>
                <div style={S.avatarUploadCircle} onClick={()=>document.getElementById("avatar-input").click()}>
                  {profForm.avatarPreview?<img src={profForm.avatarPreview} alt="avatar" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/>:<div style={S.avatarInitials}>{(profForm.full_name||profForm.username||user.email||"?")[0].toUpperCase()}</div>}
                  <div style={S.avatarEditOverlay}><Camera width={24} height={24} color="#fff"/></div>
                </div>
                <div>
                  <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111",marginBottom:8,display:"block"}} onClick={()=>document.getElementById("avatar-input").click()}>UPLOAD PHOTO</button>
                  {profForm.avatarPreview&&<button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#FF1493",border:"2px solid #FF1493",fontSize:11}} onClick={()=>setProfForm(f=>({...f,avatarFile:null,avatarPreview:"",avatar_url:""}))}>REMOVE</button>}
                </div>
              </div>
              <input id="avatar-input" type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f)setProfForm(p=>({...p,avatarFile:f,avatarPreview:URL.createObjectURL(f)}));}}/>
            </Sec>
            <Sec label="YOUR DETAILS">
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                <F l="FULL NAME"><input style={S.inp} placeholder="e.g. Nasreen Ahmed" value={profForm.full_name} onChange={e=>setProfForm(f=>({...f,full_name:e.target.value}))}/></F>
                <F l="USERNAME"><input style={S.inp} placeholder="e.g. @nasreen.closet" value={profForm.username} onChange={e=>setProfForm(f=>({...f,username:e.target.value}))}/></F>
                <F l="BIO"><textarea style={{...S.inp,height:80,resize:"vertical",width:"100%"}} value={profForm.bio} onChange={e=>setProfForm(f=>({...f,bio:e.target.value}))}/></F>
                <F l="LOCATION"><input style={S.inp} placeholder="e.g. London, UK" value={profForm.location} onChange={e=>setProfForm(f=>({...f,location:e.target.value}))}/></F>
                <F l="REGION">
                  <select style={S.inp} value={profForm.region} onChange={e=>setProfForm(f=>({...f,region:e.target.value}))}>
                    <option value="">Select region...</option>
                    {["UK","USA","Canada","Australia","UAE","Pakistan","India","Bangladesh","Sri Lanka","Europe","Other"].map(r=><option key={r} value={r}>{r}</option>)}
                  </select>
                </F>
              </div>
            </Sec>
            <Sec label="I SPECIALISE IN">
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {["Bridal","Eid","Casual","Party","Vintage","Luxury","Budget-friendly","Handmade","Designer","All Occasions"].map(s=>{
                  const on=(profForm.specialises_in||[]).includes(s);
                  return <button key={s} type="button" className="hbtn" style={{...S.hBtn,background:on?"#FF1493":"#fff",color:on?"#fff":"#111",border:`2px solid ${on?"#FF1493":"#111"}`,padding:"8px 16px",fontSize:11,letterSpacing:1.5}} onClick={()=>setProfForm(f=>({...f,specialises_in:on?f.specialises_in.filter(x=>x!==s):[...f.specialises_in,s]}))}>{s.toUpperCase()}</button>;
                })}
              </div>
            </Sec>
            <button className="hbtn" style={{...S.hBtn,width:"100%",padding:"16px",fontSize:15,borderRadius:0,letterSpacing:3,opacity:profSaving?0.5:1}} onClick={saveProfile}>{profSaving?"SAVING...":"SAVE PROFILE →"}</button>
            <div style={{marginTop:36,paddingTop:32,borderTop:"3px solid #111"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #007AFF",paddingLeft:12,marginBottom:8,display:"flex",alignItems:"center",gap:8}}><Ruler width={16} height={16}/> MY MEASUREMENTS</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                {[["bust","BUST (inches)"],["waist","WAIST (inches)"],["hips","HIPS (inches)"],["height","HEIGHT (cm)"]].map(([k,l])=>(
                  <F key={k} l={l}><input style={S.inp} type="number" placeholder="e.g. 34" value={profForm[k]} onChange={e=>setProfForm(f=>({...f,[k]:e.target.value}))}/></F>
                ))}
              </div>
              <F l="PREFERRED SIZE">
                <select style={S.inp} value={profForm.preferred_size} onChange={e=>setProfForm(f=>({...f,preferred_size:e.target.value}))}>
                  <option value="">Select...</option>
                  {SIZES.map(s=><option key={s}>{s}</option>)}
                </select>
              </F>
            </div>
            <div style={{marginTop:36,paddingTop:32,borderTop:"3px solid #111"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #FF9500",paddingLeft:12,marginBottom:8,display:"flex",alignItems:"center",gap:8}}><Scissors width={16} height={16}/> TAILOR LISTING</div>
              <Tog on={profForm.is_tailor} onToggle={()=>setProfForm(f=>({...f,is_tailor:!f.is_tailor}))} color="#FF9500" label="LIST ME AS A TAILOR" sub="Show my profile in the tailor directory"/>
              {profForm.is_tailor&&(
                <div style={{marginTop:12}}>
                  <Tog on={profForm.accepting_clients} onToggle={()=>setProfForm(f=>({...f,accepting_clients:!f.accepting_clients}))} color="#34C759" label="ACCEPTING NEW CLIENTS" sub="Turn off if you're fully booked"/>
                  <div style={{marginTop:16,display:"flex",flexDirection:"column",gap:12}}>
                    <div>
                      <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:800,letterSpacing:2,color:"#999",marginBottom:10}}>SERVICES OFFERED</p>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {["All","Alterations","Taking In","Letting Out","Hemming","Blouse Stitching","Full Stitching","Embroidery","Repairs","Custom Orders"].map(s=>{
                          const on=(profForm.tailor_services||[]).includes(s);
                          return<button key={s} type="button" className="hbtn" style={{...S.hBtn,background:on?"#FF9500":"#fff",color:on?"#fff":"#111",border:`2px solid ${on?"#FF9500":"#111"}`,padding:"6px 14px",fontSize:11}} onClick={()=>setProfForm(f=>({...f,tailor_services:on?f.tailor_services.filter(x=>x!==s):[...f.tailor_services,s]}))}>{s.toUpperCase()}</button>;
                        })}
                      </div>
                    </div>
                    <F l="STARTING PRICE (£)"><div style={{position:"relative"}}><span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"#111",fontFamily:"'Barlow',sans-serif",pointerEvents:"none"}}>£</span><input style={{...S.inp,paddingLeft:26}} type="number" placeholder="0.00" value={profForm.tailor_price_from} onChange={e=>setProfForm(f=>({...f,tailor_price_from:e.target.value}))}/></div></F>
                  </div>
                </div>
              )}
            </div>
            <div style={{marginTop:36,paddingTop:32,borderTop:"3px solid #111"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #34C759",paddingLeft:12,marginBottom:20,display:"flex",alignItems:"center",gap:8}}><ShieldCheck width={16} height={16}/> TWO-FACTOR AUTHENTICATION</div>
              {twoFAStep==="enroll"&&twoFAData?(
                <div>
                  <p style={{fontSize:13,color:"#666",marginBottom:16}}>Scan this QR code with Google Authenticator or Authy.</p>
                  {twoFAData.totp?.qr_code&&<img src={twoFAData.totp.qr_code} alt="2FA QR Code" style={{width:180,height:180,border:"3px solid #111",marginBottom:16,display:"block"}}/>}
                  <F l="ENTER 6-DIGIT CODE FROM APP">
                    <input style={{...S.inp,fontSize:24,letterSpacing:8,textAlign:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900}} placeholder="000000" maxLength={6} value={twoFACode} onChange={e=>setTwoFACode(e.target.value.replace(/\D/g,"").slice(0,6))}/>
                  </F>
                  <div style={{display:"flex",gap:10,marginTop:14}}>
                    <button className="hbtn" style={{...S.hBtn,background:"#34C759",border:"none",flex:1,padding:"12px",opacity:(twoFACode.length!==6||twoFALoading)?0.4:1}} onClick={confirm2FA} disabled={twoFACode.length!==6||twoFALoading}>{twoFALoading?"VERIFYING...":<span style={{display:"inline-flex",alignItems:"center",gap:6}}><Check width={16} height={16}/> CONFIRM 2FA</span>}</button>
                    <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#111",border:"2px solid #111",padding:"12px 16px"}} onClick={()=>{setTwoFAStep(null);setTwoFACode("");setTwoFAData(null);}}>CANCEL</button>
                  </div>
                </div>
              ):(
                <div>
                  {twoFAFactors.length>0?(
                    <div>
                      <div style={{...S.alterBadge,...S.aY,marginBottom:16,display:"inline-flex",alignItems:"center",gap:8}}><Check width={14} height={14}/> 2FA IS ENABLED</div>
                      {twoFAFactors.map(f=>(
                        <div key={f.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"#fafafa",border:"1.5px solid #e0e0e0",marginBottom:8}}>
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700}}>{f.friendly_name||"Authenticator App"}</span>
                          <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#FF1493",border:"1.5px solid #FF1493",fontSize:11,padding:"5px 12px"}} onClick={()=>disable2FA(f.id)}>REMOVE</button>
                        </div>
                      ))}
                    </div>
                  ):(
                    <div>
                      <p style={{fontSize:13,color:"#888",marginBottom:16}}>Add an extra layer of security with an authenticator app.</p>
                      <button className="hbtn" style={{...S.hBtn,background:"#34C759",border:"none",padding:"12px 24px",opacity:twoFALoading?0.5:1}} onClick={()=>{load2FAFactors();setup2FA();}}>{twoFALoading?"SETTING UP...":<span style={{display:"inline-flex",alignItems:"center",gap:6}}><ShieldCheck width={16} height={16}/> ENABLE 2FA</span>}</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* SELLER STOREFRONT (Phase 13) */}
      {view==="profile"&&viewedProfile&&(()=>{
        const sf=viewedProfile;
        const following=isFollowing(sf.id);
        const own=user&&sf.id===user.id;
        // Active = not sold and not deactivated. Sold count drives the stat tile.
        const activeListings=profileListings.filter(i=>!i.sold&&i.status!=="inactive");
        const soldCount=profileListings.filter(i=>i.sold).length;
        const totalSales=sf.total_sales>0?sf.total_sales:soldCount;
        const avgRating=reviews.length?reviews.reduce((a,r)=>a+r.rating,0)/reviews.length:0;
        const memberSince=sf.created_at?new Date(sf.created_at).toLocaleDateString("en-GB",{month:"short",year:"numeric"}):null;
        // Honour the WOMEN/MEN tab; ALL shows everything. Only active listings show.
        const gridItems=activeListings.filter(i=>storeFilter==="ALL"||listingGender(i)===storeFilter.toLowerCase());
        const ig=(sf.storefront_instagram||"").replace(/^@/,"").trim();
        // Stat tile — small box with a 2px #111 border (design system).
        const StatTile=({icon,value,label})=>(
          <div style={{flex:"1 1 120px",minWidth:110,border:"2px solid #111",borderRadius:0,padding:"14px 12px",textAlign:"center"}}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:6,color:"#FF1493"}}>{icon}</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:900,lineHeight:1,color:"#111"}}>{value}</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:800,letterSpacing:1.5,color:"#999",marginTop:4}}>{label}</div>
          </div>
        );
        return (
        <main style={{...S.main,padding:"0 0 40px"}}>
          <div style={{padding:"20px 12px 0"}}><button style={S.back} onClick={()=>setView(prevView||"shop")}>← BACK</button></div>

          {/* BANNER — full width, responsive height, seller-uploaded image or solid
              #FF1493 fallback. Avatar overlaps the bottom-left. */}
          <div style={{position:"relative",margin:"0 12px"}}>
            <div style={{width:"100%",height:"clamp(140px,28vw,200px)",background:sf.storefront_banner_url?`#FF1493 url(${sf.storefront_banner_url}) center/cover no-repeat`:"#FF1493",border:"2px solid #111"}}/>
            <div style={{position:"absolute",left:18,bottom:-40,width:80,height:80,borderRadius:"50%",border:"2px solid #111",overflow:"hidden",background:"#FF1493",display:"flex",alignItems:"center",justifyContent:"center"}}>
              {sf.avatar_url?<img src={sf.avatar_url} alt={sf.full_name||sf.username} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:34,fontWeight:900,color:"#fff"}}>{(sf.full_name||sf.username||"S")[0].toUpperCase()}</span>}
            </div>
          </div>

          {/* SELLER INFO */}
          <div style={{padding:"52px 18px 0"}}>
            {sf.vacation_mode&&(
              <div style={{display:"flex",alignItems:"center",gap:10,background:"#111",color:"#fff",border:"2px solid #111",borderRadius:0,padding:"12px 14px",marginBottom:18,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:0.5,fontSize:14}}>
                <Plane width={18} height={18} color="#FF1493"/> This seller is currently on vacation and not accepting orders.
              </div>
            )}
            <h2 style={S.profileName}>{sf.full_name||sf.username||"Seller"}</h2>
            {(sf.verified||sf.identity_verified)&&(
              <div style={{display:"flex",flexWrap:"wrap",gap:8,margin:"8px 0 4px"}}>
                {sf.verified&&<VerifiedBadge/>}
                {sf.identity_verified&&<IDVerifiedBadge/>}
              </div>
            )}
            {sf.storefront_tagline&&<p style={{fontFamily:"'Barlow',sans-serif",fontSize:14,color:"#888",margin:"6px 0 0",lineHeight:1.4}}>{sf.storefront_tagline}</p>}
            <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:"6px 16px",marginTop:12}}>
              {(sf.storefront_location||sf.location)&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,color:"#888",display:"inline-flex",alignItems:"center",gap:5}}><MapPin width={14} height={14}/> {sf.storefront_location||sf.location}</span>}
              {reviews.length>0&&<span style={{display:"inline-flex",alignItems:"center",gap:6,fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,color:"#111"}}><Stars value={avgRating} size={14} color="#FF1493"/> <span style={{fontWeight:800}}>{avgRating.toFixed(1)}</span> <span style={{color:"#999"}}>({reviews.length} review{reviews.length!==1?"s":""})</span></span>}
              {memberSince&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,color:"#888",display:"inline-flex",alignItems:"center",gap:5}}><Calendar width={14} height={14}/> Member since {memberSince}</span>}
              {ig&&<a href={`https://instagram.com/${ig}`} target="_blank" rel="noreferrer" style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,color:"#FF1493",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5}}><Instagram width={14} height={14}/> @{ig}</a>}
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:1,color:"#111",display:"inline-flex",alignItems:"center",gap:5}}><Users width={14} height={14}/> {followerCount} follower{followerCount!==1?"s":""}</span>
            </div>
            {!own&&(
              <button className="hbtn" style={{...S.hBtn,fontSize:13,letterSpacing:2,padding:"11px 22px",marginTop:16,border:"2px solid #111",borderRadius:0,background:following?"#111":"#fff",color:following?"#fff":"#111"}} onClick={()=>requireAuth("follow",()=>toggleFollow(sf.id))}>
                {following
                  ?<span style={{display:"inline-flex",alignItems:"center",gap:7}}><UserCheck width={16} height={16}/> FOLLOWING</span>
                  :<span style={{display:"inline-flex",alignItems:"center",gap:7}}><UserPlus width={16} height={16}/> FOLLOW</span>}
              </button>
            )}

            {/* STATS ROW */}
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:24}}>
              <StatTile icon={<ShoppingBag width={18} height={18}/>} value={activeListings.length} label="ACTIVE LISTINGS"/>
              <StatTile icon={<Tag width={18} height={18}/>} value={totalSales} label="TOTAL SALES"/>
              {sf.avg_response_time&&<StatTile icon={<Clock width={18} height={18}/>} value={sf.avg_response_time} label="AVG RESPONSE"/>}
            </div>

            {/* BIO */}
            {sf.storefront_bio&&(
              <div style={{marginTop:32}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #FF1493",paddingLeft:12,marginBottom:14}}>ABOUT THIS SELLER</div>
                <p style={{fontFamily:"'Barlow',sans-serif",fontSize:15,color:"#444",lineHeight:1.6,margin:0,whiteSpace:"pre-wrap"}}>{sf.storefront_bio}</p>
              </div>
            )}

            {/* BUNDLE & SAVE banner (Phase 14) — shown prominently below the seller
                info when this seller has bundle discounts enabled. Teal #00E5CC,
                2px #111 border, no radius, Tag icon to the left. */}
            {sf.bundle_discount_enabled&&(
              <div style={{display:"flex",alignItems:"center",gap:11,background:"#00E5CC",color:"#111",border:"2px solid #111",borderRadius:0,padding:"14px 16px",marginTop:28,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,letterSpacing:0.5,fontSize:16,lineHeight:1.2}}>
                <Tag width={20} height={20} style={{flexShrink:0}}/> BUNDLE &amp; SAVE {sf.bundle_discount_percentage||10}% ON 2+ ITEMS
              </div>
            )}

            {/* LISTINGS */}
            <div style={{marginTop:36,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:18}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #FF1493",paddingLeft:12}}>LISTINGS</div>
              <div style={{display:"flex",gap:0}}>
                {["ALL","WOMEN","MEN"].map(g=>(
                  <button key={g} className="hbtn" onClick={()=>setStoreFilter(g)} style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:800,letterSpacing:1.5,padding:"7px 16px",border:"2px solid #111",borderLeft:g==="ALL"?"2px solid #111":"none",background:storeFilter===g?"#FF1493":"#fff",color:storeFilter===g?"#fff":"#111",cursor:"pointer",borderRadius:0}}>{g}</button>
                ))}
              </div>
            </div>
            <div style={S.grid}>
              {gridItems.map((item,idx)=>{
                const accent=CARD_COLORS[idx%CARD_COLORS.length];
                return(
                  <article key={item.id} className="scard" style={{...S.card,borderColor:accent}} onClick={()=>openDetail(item)}>
                    <div style={{...S.cardTop,background:item.image_url?"#000":accent,overflow:"hidden"}}>
                      {item.image_url?<img src={item.image_url} alt={item.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={S.cardEmoji}>{item.emoji||catEmoji(item.category)}</span>}
                    </div>
                    <div style={S.cardBody}>
                      <p style={{...S.cardCatLabel,color:accent}}>{item.category?.toUpperCase()}</p>
                      <p style={S.cardName}>{item.name}</p>
                      <div style={S.cardFoot}><span style={{...S.cardPrice,color:accent}}>{currencySymbol(item.currency)}{item.price}</span></div>
                    </div>
                    <div style={{...S.accentBar,background:accent}}/>
                  </article>
                );
              })}
              {gridItems.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"40px",fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,color:"#bbb"}}>No active listings right now</div>}
            </div>
          </div>
          {reviews.length>0&&(
            <div style={{marginTop:48,padding:"0 18px"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #FF1493",paddingLeft:12,marginBottom:20}}>REVIEWS ({reviews.length})</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:3}}>
                {reviews.map(r=>(
                  <div key={r.id} style={{border:"2px solid #111",borderRadius:0,padding:"14px 16px"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{display:"inline-flex",alignItems:"center",gap:8}}>
                        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:800,color:"#111",letterSpacing:0.5}}>{r.reviewer_name||"Anonymous"}</span>
                        <Stars value={r.rating} size={13} color="#FF1493"/>
                      </span>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#bbb",letterSpacing:1}}>{new Date(r.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}).toUpperCase()}</span>
                    </div>
                    {r.comment&&<p style={{fontSize:13,color:"#444",lineHeight:1.5,margin:0}}>{r.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
        );
      })()}
      <LoginPromptModal open={!!gate} context={gate||"default"} onClose={()=>setGate(null)} onAuth={m=>{ setGate(null); onGateAuth(m); }}/>
    </>
  );
}
