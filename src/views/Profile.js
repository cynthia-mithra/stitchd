import React from "react";
import { Camera, Ruler, Scissors, ShieldCheck, Check, MapPin, BadgeCheck, ShoppingBag, Plane, Instagram, UserPlus, UserCheck, User, Tag, Calendar, Clock, Users, ArrowRight } from "lucide-react";
import { SIZES, CARD_COLORS, catEmoji, currencySymbol, listingGender, activityLabel } from "../lib/constants";
import { S } from "../styles";
import { F, Stars, VerifiedBadge, IDVerifiedBadge } from "../components/Shared";
import LoginPromptModal from "../components/LoginPromptModal";

export default function Profile({
  view, setView, prevView, user, profile, onGateAuth = () => {},
  // editprofile
  profForm, setProfForm, saveProfile, profSaving,
  twoFAStep, setTwoFAStep, twoFAData, setTwoFAData, twoFACode, setTwoFACode,
  twoFAFactors, twoFALoading, confirm2FA, disable2FA, load2FAFactors, setup2FA,
  // tailoring - single entry point into the Phase 15 application/dashboard flow
  onBecomeTailor = () => {}, tailorCtaLabel = "BECOME A TAILOR",
  // profile / storefront
  viewedProfile, profileListings, reviews, isFollowing, toggleFollow, openDetail,
  followerCount = 0,
}) {
  // Phase 13 - storefront listings filter (ALL / WOMEN / MEN). Local to the view;
  // resets whenever a different seller's storefront is opened.
  const [storeFilter,setStoreFilter]=React.useState("ALL");
  const [storeSort,setStoreSort]=React.useState("newest");
  React.useEffect(()=>{ setStoreFilter("ALL"); },[viewedProfile?.id]);
  // Login gate - following a seller needs an account; logged-out visitors get
  // the shared sign-up prompt (context: follow) rather than a bounce to /auth.
  const [gate,setGate]=React.useState(null);
  const requireAuth=(context,action)=>{ if(user) action(); else setGate(context); };
  // Edit-profile styling helpers (Option A revamp): sleeker filled inputs, an
  // accent "card" per section, and a colour-chip section header with an icon.
  const inp={...S.inp,background:"#fafafa",borderColor:"#ececec"};
  const cardBox={border:"2px solid #ececec",padding:"clamp(16px,4vw,22px)",marginBottom:18};
  const secHead=(c,Icon,label)=>(
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
      <span style={{width:30,height:30,background:c,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",flexShrink:0}}><Icon width={16} height={16}/></span>
      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:900,letterSpacing:2,color:"#111"}}>{label}</span>
    </div>
  );
  if(view!=="editprofile"&&view!=="profile") return null;
  return (
    <>
      {/* EDIT PROFILE */}
      {view==="editprofile"&&user&&(
        <main style={{...S.main,maxWidth:600}}>
          <button style={S.back} onClick={()=>setView("shop")}>← BACK</button>
          <div style={{...S.formCard,padding:0,overflow:"hidden"}} className="form-card">
            {/* Pink hero - avatar + identity + change photo */}
            <div style={{background:"#FF1493",padding:"28px clamp(20px,5vw,40px)",display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
              <div style={{width:92,height:92,borderRadius:"50%",border:"4px solid #fff",overflow:"hidden",cursor:"pointer",position:"relative",flexShrink:0,background:"#ffd6ec",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>document.getElementById("avatar-input").click()}>
                {profForm.avatarPreview?<img src={profForm.avatarPreview} alt="avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:40,fontWeight:900,color:"#FF1493"}}>{(profForm.full_name||profForm.username||user.email||"?")[0].toUpperCase()}</span>}
                <div style={S.avatarEditOverlay}><Camera width={24} height={24} color="#fff"/></div>
              </div>
              <div style={{color:"#fff",minWidth:0,flex:"1 1 200px"}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:30,fontWeight:900,letterSpacing:.5,lineHeight:1,textTransform:"uppercase",overflowWrap:"anywhere"}}>{profForm.full_name||profForm.username||"Your Profile"}</div>
                {(profForm.username||profForm.location)&&<div style={{fontSize:14,opacity:.95,marginTop:5,overflowWrap:"anywhere"}}>{[profForm.username&&(profForm.username.startsWith("@")?profForm.username:"@"+profForm.username),profForm.location].filter(Boolean).join("  ·  ")}</div>}
                {(profile?.verified||profile?.identity_verified)&&(
                  <div style={{marginTop:12,display:"flex",gap:8,flexWrap:"wrap"}}>
                    {profile?.verified&&<VerifiedBadge/>}
                    {profile?.identity_verified&&<IDVerifiedBadge/>}
                  </div>
                )}
                <div style={{marginTop:12,display:"flex",gap:8,flexWrap:"wrap"}}>
                  <button className="hbtn" style={{...S.hBtn,background:"#111",border:"none",fontSize:11,padding:"7px 12px"}} onClick={()=>document.getElementById("avatar-input").click()}>{profForm.avatarPreview?"CHANGE PHOTO":"UPLOAD PHOTO"}</button>
                  {profForm.avatarPreview&&<button className="hbtn" style={{...S.hBtn,background:"transparent",color:"#fff",border:"2px solid #fff",fontSize:11,padding:"6px 12px"}} onClick={()=>setProfForm(f=>({...f,avatarFile:null,avatarPreview:"",avatar_url:""}))}>REMOVE</button>}
                </div>
              </div>
              <input id="avatar-input" type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f)setProfForm(p=>({...p,avatarFile:f,avatarPreview:URL.createObjectURL(f)}));}}/>
            </div>

            <div style={{padding:"clamp(20px,5vw,36px)"}}>
              {/* YOUR DETAILS */}
              <div style={cardBox}>
                {secHead("#FF1493",User,"YOUR DETAILS")}
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <F l="FULL NAME"><input style={inp} placeholder="e.g. Nasreen Ahmed" value={profForm.full_name} onChange={e=>setProfForm(f=>({...f,full_name:e.target.value}))}/></F>
                  <F l="USERNAME"><input style={inp} placeholder="e.g. @nasreen.closet" value={profForm.username} onChange={e=>setProfForm(f=>({...f,username:e.target.value}))}/></F>
                  <F l="BIO"><textarea style={{...inp,height:80,resize:"vertical"}} value={profForm.bio} onChange={e=>setProfForm(f=>({...f,bio:e.target.value}))}/></F>
                  <F l="LOCATION"><input style={inp} placeholder="e.g. London, UK" value={profForm.location} onChange={e=>setProfForm(f=>({...f,location:e.target.value}))}/></F>
                  <F l="I AM">
                    <div style={{display:"flex",gap:8}}>
                      {["Female","Male"].map(g=>{
                        // Normalise any legacy "Woman"/"Man" values to the new labels.
                        const cur=profForm.gender==="Woman"?"Female":profForm.gender==="Man"?"Male":profForm.gender;
                        const on=cur===g;
                        return <button key={g} type="button" className="hbtn" style={{...S.hBtn,flex:1,background:on?"#FF1493":"#fff",color:on?"#fff":"#111",border:`2px solid ${on?"#FF1493":"#111"}`,padding:"10px 16px",fontSize:12,letterSpacing:1.5}} onClick={()=>setProfForm(f=>({...f,gender:g}))}>{g.toUpperCase()}</button>;
                      })}
                    </div>
                  </F>
                </div>
              </div>

              {/* I SPECIALISE IN */}
              <div style={cardBox}>
                {secHead("#111",Tag,"I SPECIALISE IN")}
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {["Bridal","Eid","Casual","Party","Vintage","Luxury","Budget-friendly","Handmade","Designer","All Occasions"].map(s=>{
                    const on=(profForm.specialises_in||[]).includes(s);
                    return <button key={s} type="button" className="hbtn" style={{...S.hBtn,background:on?"#FF1493":"#fff",color:on?"#fff":"#111",border:`2px solid ${on?"#FF1493":"#111"}`,padding:"8px 16px",fontSize:11,letterSpacing:1.5}} onClick={()=>setProfForm(f=>({...f,specialises_in:on?f.specialises_in.filter(x=>x!==s):[...f.specialises_in,s]}))}>{s.toUpperCase()}</button>;
                  })}
                </div>
              </div>

              {/* RETURN ADDRESS */}
              <div style={cardBox}>
                {secHead("#111",Plane,"RETURN ADDRESS")}
                <p style={{fontSize:13,color:"#666",lineHeight:1.5,marginBottom:14}}>Where you post your sold items from. Used for postage labels and returns - only shared with couriers, never shown publicly.</p>
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <F l="FULL NAME"><input style={inp} placeholder="e.g. Nasreen Ahmed" value={profForm.ship_from_name} onChange={e=>setProfForm(f=>({...f,ship_from_name:e.target.value}))}/></F>
                  <F l="ADDRESS LINE 1"><input style={inp} placeholder="123 Main Street" value={profForm.ship_from_line1} onChange={e=>setProfForm(f=>({...f,ship_from_line1:e.target.value}))}/></F>
                  <F l="ADDRESS LINE 2 (OPTIONAL)"><input style={inp} placeholder="Flat 2" value={profForm.ship_from_line2} onChange={e=>setProfForm(f=>({...f,ship_from_line2:e.target.value}))}/></F>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    <F l="CITY"><input style={inp} placeholder="London" value={profForm.ship_from_city} onChange={e=>setProfForm(f=>({...f,ship_from_city:e.target.value}))}/></F>
                    <F l="POSTCODE"><input style={inp} placeholder="E1 6RF" value={profForm.ship_from_postcode} onChange={e=>setProfForm(f=>({...f,ship_from_postcode:e.target.value}))}/></F>
                  </div>
                  <F l="COUNTRY"><input style={inp} placeholder="UK" value={profForm.ship_from_country} onChange={e=>setProfForm(f=>({...f,ship_from_country:e.target.value}))}/></F>
                </div>
              </div>

              {/* MY MEASUREMENTS */}
              <div style={cardBox}>
                {secHead("#00E5CC",Ruler,"MY MEASUREMENTS")}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                  {((profForm.gender==="Male"||profForm.gender==="Man")
                    ? [["bust","CHEST (inches)"],["waist","WAIST (inches)"],["height","HEIGHT (cm)"]]
                    : [["bust","BUST (inches)"],["waist","WAIST (inches)"],["hips","HIPS (inches)"],["height","HEIGHT (cm)"]]
                  ).map(([k,l])=>(
                    <F key={k} l={l}><input style={inp} type="number" placeholder="e.g. 34" value={profForm[k]} onChange={e=>setProfForm(f=>({...f,[k]:e.target.value}))}/></F>
                  ))}
                </div>
                <F l="PREFERRED SIZE">
                  <select style={inp} value={profForm.preferred_size} onChange={e=>setProfForm(f=>({...f,preferred_size:e.target.value}))}>
                    <option value="">Select...</option>
                    {SIZES.map(s=><option key={s}>{s}</option>)}
                  </select>
                </F>
              </div>

              {/* SAVE - now directly under measurements */}
              <button className="hbtn" style={{...S.hBtn,width:"100%",background:"#FF1493",color:"#fff",border:"none",padding:"16px",fontSize:16,letterSpacing:2,opacity:profSaving?0.5:1}} onClick={saveProfile}>{profSaving?"SAVING...":"SAVE PROFILE →"}</button>

              {/* OFFER ALTERATIONS */}
              <div style={{...cardBox,borderLeft:"4px solid #FF9500",marginTop:18}}>
                {secHead("#FF9500",Scissors,"OFFER ALTERATIONS")}
                <p style={{fontSize:13,color:"#666",lineHeight:1.5,marginBottom:14}}>Want to take in alteration work from buyers? Tailors on Stitch'd have a vetted profile, portfolio, availability calendar and get paid securely through the platform.</p>
                <button type="button" className="hbtn" style={{...S.hBtn,background:"#FF9500",border:"none",padding:"12px 24px",fontSize:13,letterSpacing:2,display:"inline-flex",alignItems:"center",gap:8}} onClick={()=>onBecomeTailor()}><Scissors width={15} height={15}/> {tailorCtaLabel}</button>
              </div>

              {/* TWO-FACTOR AUTHENTICATION */}
              <div style={{...cardBox,borderLeft:"4px solid #34C759",marginBottom:0}}>
                {secHead("#34C759",ShieldCheck,"TWO-FACTOR AUTHENTICATION")}
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
        const gridItems=activeListings
          .filter(i=>storeFilter==="ALL"||listingGender(i)===storeFilter.toLowerCase())
          .slice()
          .sort((a,b)=>{
            if(storeSort==="price_low")  return (parseFloat(a.price)||0)-(parseFloat(b.price)||0);
            if(storeSort==="price_high") return (parseFloat(b.price)||0)-(parseFloat(a.price)||0);
            return new Date(b.created_at||0)-new Date(a.created_at||0); // newest first
          });
        const ig=(sf.storefront_instagram||"").replace(/^@/,"").trim();
        // Stat tile - small box with a 2px #111 border (design system).
        const StatTile=({icon,value,label})=>(
          <div style={{flex:"1 1 120px",minWidth:110,border:"none",boxShadow:"0 6px 22px rgba(17,17,17,0.09)",borderRadius:0,padding:"16px 12px",textAlign:"center"}}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:6,color:"#FF1493"}}>{icon}</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:900,lineHeight:1,color:"#111"}}>{value}</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:800,letterSpacing:1.5,color:"#6b6b6b",marginTop:4}}>{label}</div>
          </div>
        );
        return (
        <main style={{...S.main,padding:"0 0 40px"}}>
          <div style={{padding:"20px 12px 0"}}><button style={S.back} onClick={()=>setView(prevView||"shop")}>← BACK</button></div>

          {/* BANNER - full width, responsive height, seller-uploaded image or solid
              #FF1493 fallback. Avatar overlaps the bottom-left. */}
          <div style={{position:"relative",margin:"0 12px"}}>
            <div style={{width:"100%",height:"clamp(140px,28vw,200px)",background:sf.storefront_banner_url?`#FF1493 url(${sf.storefront_banner_url}) center/cover no-repeat`:"#FF1493",border:"2px solid #111"}}/>
            <div style={{position:"absolute",left:18,bottom:-44,width:90,height:90,borderRadius:"50%",border:"3px solid #111",overflow:"hidden",background:"#FF1493",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 8px 24px rgba(0,0,0,0.18)"}}>
              {sf.avatar_url?<img src={sf.avatar_url} alt={sf.full_name||sf.username} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:38,fontWeight:900,color:"#fff"}}>{(sf.full_name||sf.username||"S")[0].toUpperCase()}</span>}
            </div>
          </div>

          {/* SELLER INFO */}
          <div style={{padding:"58px 18px 0"}}>
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
              {reviews.length>0&&<span style={{display:"inline-flex",alignItems:"center",gap:6,fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,color:"#111"}}><Stars value={avgRating} size={14} color="#FF1493"/> <span style={{fontWeight:800}}>{avgRating.toFixed(1)}</span> <span style={{color:"#6b6b6b"}}>({reviews.length} review{reviews.length!==1?"s":""})</span></span>}
              {memberSince&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,color:"#888",display:"inline-flex",alignItems:"center",gap:5}}><Calendar width={14} height={14}/> Member since {memberSince}</span>}
              {activityLabel(sf.last_active_at)&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:1,color:"#111",display:"inline-flex",alignItems:"center",gap:6}}><span style={{width:8,height:8,borderRadius:"50%",background:activityLabel(sf.last_active_at)==="Active now"?"#34C759":"#FF9500",display:"inline-block"}}/> {activityLabel(sf.last_active_at)}</span>}
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
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:2,color:"#111",borderLeft:"4px solid #FF1493",paddingLeft:12,marginBottom:14}}>ABOUT THIS SELLER</div>
                <p style={{fontFamily:"'Barlow',sans-serif",fontSize:15,color:"#444",lineHeight:1.6,margin:0,whiteSpace:"pre-wrap"}}>{sf.storefront_bio}</p>
              </div>
            )}

            {/* BUNDLE & SAVE banner (Phase 14) - shown prominently below the seller
                info when this seller has bundle discounts enabled. Teal #00E5CC,
                2px #111 border, no radius, Tag icon to the left. */}
            {sf.bundle_discount_enabled&&(
              <div style={{display:"flex",alignItems:"center",gap:11,background:"#00E5CC",color:"#111",border:"2px solid #111",borderRadius:0,padding:"14px 16px",marginTop:28,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,letterSpacing:0.5,fontSize:16,lineHeight:1.2}}>
                <Tag width={20} height={20} style={{flexShrink:0}}/> BUNDLE &amp; SAVE {sf.bundle_discount_percentage||10}% ON 2+ ITEMS
              </div>
            )}

            {/* LISTINGS */}
            <div style={{marginTop:36,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:18}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:2,color:"#111",borderLeft:"4px solid #FF1493",paddingLeft:12}}>LISTINGS</div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                <div style={{display:"flex",gap:0}}>
                  {["ALL","WOMEN","MEN"].map(g=>(
                    <button key={g} className="hbtn" onClick={()=>setStoreFilter(g)} style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:800,letterSpacing:1.5,padding:"7px 16px",border:"2px solid #111",borderLeft:g==="ALL"?"2px solid #111":"none",background:storeFilter===g?"#FF1493":"#fff",color:storeFilter===g?"#fff":"#111",cursor:"pointer",borderRadius:0}}>{g}</button>
                  ))}
                </div>
                <select value={storeSort} onChange={e=>setStoreSort(e.target.value)} aria-label="Sort listings" style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:800,letterSpacing:1,padding:"8px 12px",border:"2px solid #111",borderRadius:0,background:"#fff",color:"#111",cursor:"pointer"}}>
                  <option value="newest">NEWEST</option>
                  <option value="price_low">PRICE: LOW → HIGH</option>
                  <option value="price_high">PRICE: HIGH → LOW</option>
                </select>
              </div>
            </div>
            <div style={S.grid}>
              {gridItems.map((item,idx)=>{
                const accent=CARD_COLORS[idx%CARD_COLORS.length];
                return(
                  <article key={item.id} className="scard" style={S.card} onClick={()=>openDetail(item)}>
                    <div className="card-top" style={{...S.cardTop,background:item.image_url?"#000":accent,overflow:"hidden"}}>
                      {item.image_url?<img src={item.image_url} alt={item.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={S.cardEmoji}>{item.emoji||catEmoji(item.category)}</span>}
                      {!item.sold&&<div className="card-hover-price"><span className="chp-price">{currencySymbol(item.currency)}{item.price}</span><span className="chp-view">VIEW <ArrowRight width={13} height={13}/></span></div>}
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
              {gridItems.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"40px",fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,color:"#6f6f6f"}}>No active listings right now</div>}
            </div>
          </div>
          {reviews.length>0&&(
            <div style={{marginTop:48,padding:"0 18px"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:2,color:"#111",borderLeft:"4px solid #FF1493",paddingLeft:12,marginBottom:20}}>REVIEWS ({reviews.length})</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
                {reviews.map(r=>(
                  <div key={r.id} style={{border:"none",boxShadow:"0 6px 22px rgba(17,17,17,0.09)",borderRadius:0,padding:"16px 18px"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{display:"inline-flex",alignItems:"center",gap:8}}>
                        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:800,color:"#111",letterSpacing:0.5}}>{r.reviewer_name||"Anonymous"}</span>
                        <Stars value={r.rating} size={13} color="#FF1493"/>
                      </span>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#6f6f6f",letterSpacing:1}}>{new Date(r.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}).toUpperCase()}</span>
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
