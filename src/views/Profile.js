import React from "react";
import { Camera, Ruler, Scissors, ShieldCheck, Check, MapPin, BadgeCheck, ShoppingBag, Plane } from "lucide-react";
import { SIZES, CARD_COLORS, catEmoji, currencySymbol } from "../lib/constants";
import { S } from "../styles";
import { Sec, F, Tog, Stars } from "../components/Shared";

export default function Profile({
  view, setView, prevView, user,
  // editprofile
  profForm, setProfForm, saveProfile, profSaving, profError,
  twoFAStep, setTwoFAStep, twoFAData, setTwoFAData, twoFACode, setTwoFACode,
  twoFAFactors, twoFALoading, confirm2FA, disable2FA, load2FAFactors, setup2FA,
  // profile
  viewedProfile, profileListings, reviews, isFollowing, toggleFollow, openDetail,
}) {
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
            {profError&&(
              <div style={{background:"#FFF0F3",border:"2px solid #FF1493",borderRadius:0,padding:"14px 16px",marginBottom:14,color:"#B00046",fontFamily:"'Barlow',sans-serif",fontSize:14,lineHeight:1.5,overflowWrap:"anywhere"}}>
                <strong style={{fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1,display:"block",marginBottom:4}}>⚠️ PROFILE NOT SAVED</strong>
                {profError.text||profError}
                {profError.detail&&(
                  <div style={{marginTop:12}}>
                    <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:1,marginBottom:6,color:"#B00046"}}>EXACT ERROR — TAP COPY, THEN PASTE IT ON THE PR FOR CLAUDE:</p>
                    <div style={{display:"flex",alignItems:"stretch",gap:8,flexWrap:"wrap"}}>
                      <code style={{flex:1,minWidth:0,background:"#fff",border:"1px solid #FFB3CC",padding:"8px 10px",fontFamily:"monospace",fontSize:12,color:"#111",overflowWrap:"anywhere",whiteSpace:"pre-wrap"}}>{profError.detail}</code>
                      <button type="button" className="hbtn" style={{...S.hBtn,background:"#FF1493",border:"none",padding:"8px 16px",fontSize:11,letterSpacing:1}} onClick={()=>{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(profError.detail).then(()=>{},()=>{}); } }}>COPY</button>
                    </div>
                  </div>
                )}
              </div>
            )}
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
                        {["Alterations","Taking In","Letting Out","Hemming","Blouse Stitching","Full Stitching","Embroidery","Repairs","Custom Orders"].map(s=>{
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

      {/* SELLER PROFILE */}
      {view==="profile"&&viewedProfile&&(
        <main style={S.main}>
          <button style={S.back} onClick={()=>setView(prevView||"shop")}>← BACK</button>
          {/* Phase 10d — vacation banner. Shown when the seller has vacation_mode on. */}
          {viewedProfile.vacation_mode&&(
            <div style={{display:"flex",alignItems:"center",gap:10,background:"#111",color:"#fff",border:"2px solid #111",borderRadius:0,padding:"14px 16px",marginBottom:24,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:0.5,fontSize:15}}>
              <Plane width={20} height={20} color="#FF1493"/> This seller is currently on vacation and not accepting orders.
            </div>
          )}
          <div style={S.profileHeader} className="profile-header">
            <div style={S.profileAvatarWrap}>
              {viewedProfile.avatar_url?<img src={viewedProfile.avatar_url} alt={viewedProfile.full_name||viewedProfile.username} style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/>:<div style={S.profileAvatar}>{(viewedProfile.full_name||viewedProfile.username||"S")[0].toUpperCase()}</div>}
            </div>
            <div style={{flex:1}}>
              <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:4,color:"#FF1493",marginBottom:4}}>SELLER PROFILE</p>
              <h2 style={S.profileName}>{viewedProfile.full_name||viewedProfile.username||"Seller"}{viewedProfile.verified&&<span style={{...S.verifiedBadge,display:"inline-flex",alignItems:"center",gap:4}}><Check width={12} height={12}/> VERIFIED</span>}</h2>
              {viewedProfile.location&&<p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,color:"#888",marginBottom:10,display:"flex",alignItems:"center",gap:5}}><MapPin width={14} height={14}/> {viewedProfile.location}</p>}
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
                {viewedProfile.id_verified&&<span style={{background:"#007AFF",color:"#fff",padding:"4px 10px",fontSize:10,fontWeight:800,letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif",display:"inline-flex",alignItems:"center",gap:5}}><BadgeCheck width={12} height={12}/> ID VERIFIED</span>}
                {viewedProfile.total_sales>0&&<span style={{background:"#FF950022",color:"#FF9500",padding:"4px 10px",fontSize:10,fontWeight:800,letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif",border:"1px solid #FF950044",display:"inline-flex",alignItems:"center",gap:5}}><ShoppingBag width={12} height={12}/> {viewedProfile.total_sales} SALES</span>}
              </div>
              <p style={{...S.profileMeta,display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>{profileListings.length} listings · {profileListings.filter(i=>i.sold).length} sold{reviews.length>0&&<span style={{display:"inline-flex",alignItems:"center",gap:6}}> · <Stars value={reviews.reduce((a,r)=>a+r.rating,0)/reviews.length} size={14} color="#FF1493"/> <span style={{color:"#111",fontWeight:800}}>{(reviews.reduce((a,r)=>a+r.rating,0)/reviews.length).toFixed(1)}</span> ({reviews.length} review{reviews.length!==1?"s":""})</span>}</p>
              {user&&viewedProfile.id!==user.id&&(
                <button className="hbtn" style={{...S.hBtn,background:isFollowing(viewedProfile.id)?"#fff":"#FF1493",color:isFollowing(viewedProfile.id)?"#FF1493":"#fff",border:"2px solid #FF1493",marginTop:14}} onClick={()=>toggleFollow(viewedProfile.id)}>
                  {isFollowing(viewedProfile.id)?<span style={{display:"inline-flex",alignItems:"center",gap:6}}><Check width={15} height={15}/> FOLLOWING</span>:"+ FOLLOW"}
                </button>
              )}
            </div>
          </div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #FF1493",paddingLeft:12,marginBottom:20}}>ALL LISTINGS</div>
          <div style={S.grid}>
            {profileListings.map((item,idx)=>{
              const accent=CARD_COLORS[idx%CARD_COLORS.length];
              return(
                <article key={item.id} className="scard" style={{...S.card,borderColor:accent,opacity:item.sold?0.55:1}} onClick={()=>openDetail(item)}>
                  <div style={{...S.cardTop,background:item.image_url?"#000":accent,overflow:"hidden"}}>
                    {item.image_url?<img src={item.image_url} alt={item.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={S.cardEmoji}>{item.emoji||catEmoji(item.category)}</span>}
                    {item.sold&&<div style={S.soldVeil}><span style={S.soldStamp}>SOLD</span></div>}
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
            {profileListings.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"40px",fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,color:"#bbb"}}>NO LISTINGS YET.</div>}
          </div>
          {reviews.length>0&&(
            <div style={{marginTop:48}}>
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
      )}
    </>
  );
}
