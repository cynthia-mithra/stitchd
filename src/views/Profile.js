import React from "react";
import { Camera, Ruler, Scissors, ShieldCheck, Check, MapPin, Plane, Instagram, UserPlus, UserCheck, Users } from "lucide-react";
import { SIZES, CARD_COLORS, catEmoji, currencySymbol, listingGender } from "../lib/constants";
import { S } from "../styles";
import { Sec, F, Tog, Stars, VerifiedBadge, IDVerifiedBadge } from "../components/Shared";

export default function Profile({
  view, setView, prevView, user,
  // editprofile
  profForm, setProfForm, saveProfile, profSaving,
  twoFAStep, setTwoFAStep, twoFAData, setTwoFAData, twoFACode, setTwoFACode,
  twoFAFactors, twoFALoading, confirm2FA, disable2FA, load2FAFactors, setup2FA,
  // profile / storefront
  viewedProfile, profileListings, reviews, isFollowing, toggleFollow, openDetail,
  followerCount = 0, verifiedSellers = new Set(), identityVerifiedSellers = new Set(),
  onBackFromStorefront = () => {},
}) {
  // Storefront ALL / WOMEN / MEN listings filter (Phase 13 PART 2).
  const [storeFilter,setStoreFilter]=React.useState("ALL");
  React.useEffect(()=>{ setStoreFilter("ALL"); },[viewedProfile&&viewedProfile.id]);
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

      {/* SELLER STOREFRONT (Phase 13 PART 2) */}
      {view==="profile"&&viewedProfile&&(()=>{
        const name=viewedProfile.full_name||viewedProfile.username||"Seller";
        const verified=viewedProfile.verified||verifiedSellers.has(viewedProfile.id);
        const idVerified=viewedProfile.identity_verified||identityVerifiedSellers.has(viewedProfile.id);
        const tagline=(viewedProfile.storefront_tagline||"").trim();
        const bio=(viewedProfile.storefront_bio||"").trim();
        const location=(viewedProfile.storefront_location||viewedProfile.location||"").trim();
        const igRaw=(viewedProfile.storefront_instagram||"").trim().replace(/^@/,"");
        const banner=viewedProfile.storefront_banner_url;
        const reviewAvg=reviews.length?reviews.reduce((a,r)=>a+r.rating,0)/reviews.length:0;
        const memberSince=viewedProfile.created_at?new Date(viewedProfile.created_at).toLocaleDateString("en-GB",{month:"long",year:"numeric"}):null;
        const activeListings=profileListings.filter(i=>!i.sold&&i.status!=="inactive");
        const totalSales=viewedProfile.total_sales||profileListings.filter(i=>i.sold).length;
        const responseTime=(viewedProfile.avg_response_time||"").toString().trim();
        const filtered=storeFilter==="ALL"?activeListings:activeListings.filter(i=>listingGender(i)===(storeFilter==="MEN"?"men":"women"));
        const followed=isFollowing(viewedProfile.id);
        const isOwn=user&&viewedProfile.id===user.id;
        const Heading=({children})=> <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #FF1493",paddingLeft:12,marginBottom:20}}>{children}</div>;
        return (
        <div>
          <main style={{...S.main,paddingTop:0}}>
            <button style={{...S.back,marginTop:20}} onClick={()=>{onBackFromStorefront();setView(prevView||"shop");}}>← BACK</button>
          </main>

          {/* BANNER + overlapping avatar. Solid #FF1493 when no banner uploaded. */}
          <div style={{maxWidth:1200,margin:"0 auto",padding:"0 12px"}}>
            <div className="sf-banner" style={{position:"relative",width:"100%",border:"2px solid #111",borderRadius:0,background:banner?`#FF1493 center/cover no-repeat url("${banner}")`:"#FF1493"}}>
              <div style={{position:"absolute",left:16,bottom:-40,width:80,height:80,borderRadius:"50%",border:"2px solid #111",overflow:"hidden",background:"#FF1493",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 16px rgba(0,0,0,0.2)"}}>
                {viewedProfile.avatar_url
                  ? <img src={viewedProfile.avatar_url} alt={name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  : <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:36,fontWeight:900,color:"#fff"}}>{name[0].toUpperCase()}</span>}
              </div>
            </div>
          </div>

          <main style={{...S.main,paddingTop:52}}>
            {/* Phase 10d — vacation banner. */}
            {viewedProfile.vacation_mode&&(
              <div style={{display:"flex",alignItems:"center",gap:10,background:"#111",color:"#fff",border:"2px solid #111",borderRadius:0,padding:"14px 16px",marginBottom:20,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:0.5,fontSize:15}}>
                <Plane width={20} height={20} color="#FF1493"/> This seller is currently on vacation and not accepting orders.
              </div>
            )}

            {/* SELLER INFO */}
            <div style={{borderBottom:"3px solid #111",paddingBottom:28,marginBottom:28}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:0}}>
                  <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(34px,6vw,48px)",fontWeight:900,letterSpacing:-1,lineHeight:1,marginBottom:8}}>{name}</h2>
                  {(verified||idVerified)&&(
                    <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
                      {verified&&<VerifiedBadge/>}
                      {idVerified&&<IDVerifiedBadge/>}
                    </div>
                  )}
                  {tagline&&<p style={{fontFamily:"'Barlow',sans-serif",fontSize:15,color:"#888",marginBottom:10,lineHeight:1.4,maxWidth:560}}>{tagline}</p>}
                  <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:14,marginBottom:6}}>
                    {location&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,color:"#888",display:"inline-flex",alignItems:"center",gap:5}}><MapPin width={14} height={14}/> {location}</span>}
                    {reviews.length>0&&<span style={{display:"inline-flex",alignItems:"center",gap:6,fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,color:"#111"}}><Stars value={reviewAvg} size={14} color="#FF1493"/> {reviewAvg.toFixed(1)} <span style={{color:"#888"}}>({reviews.length} review{reviews.length!==1?"s":""})</span></span>}
                    {igRaw&&<a href={`https://instagram.com/${igRaw}`} target="_blank" rel="noreferrer" style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:1,color:"#FF1493",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5}}><Instagram width={15} height={15}/> @{igRaw}</a>}
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:14}}>
                    {memberSince&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,letterSpacing:1,color:"#bbb"}}>MEMBER SINCE {memberSince.toUpperCase()}</span>}
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:800,letterSpacing:1,color:"#111",display:"inline-flex",alignItems:"center",gap:5}}><Users width={13} height={13}/> {followerCount} FOLLOWER{followerCount!==1?"S":""}</span>
                  </div>
                </div>
                {/* FOLLOW button (Phase 13 PART 3). Hidden on your own storefront. */}
                {!isOwn&&(
                  <button className="hbtn" onClick={()=>toggleFollow(viewedProfile.id)} style={{
                    background:followed?"#111":"#fff",color:followed?"#fff":"#111",border:"2px solid #111",borderRadius:0,
                    fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,fontSize:14,padding:"12px 24px",
                    cursor:"pointer",display:"inline-flex",alignItems:"center",gap:8,flexShrink:0,textTransform:"uppercase",
                  }}>
                    {followed?<><UserCheck width={16} height={16}/> FOLLOWING</>:<><UserPlus width={16} height={16}/> FOLLOW</>}
                  </button>
                )}
              </div>

              {/* STATS ROW */}
              <div style={{display:"flex",gap:3,flexWrap:"wrap",marginTop:20}}>
                <div style={{border:"2px solid #111",padding:"14px 20px",textAlign:"center",minWidth:90}}>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900,lineHeight:1,color:"#FF1493"}}>{activeListings.length}</div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,fontWeight:800,letterSpacing:2,color:"#bbb",marginTop:4}}>ACTIVE LISTINGS</div>
                </div>
                <div style={{border:"2px solid #111",padding:"14px 20px",textAlign:"center",minWidth:90}}>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900,lineHeight:1,color:"#34C759"}}>{totalSales}</div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,fontWeight:800,letterSpacing:2,color:"#bbb",marginTop:4}}>TOTAL SALES</div>
                </div>
                {responseTime&&(
                  <div style={{border:"2px solid #111",padding:"14px 20px",textAlign:"center",minWidth:90}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900,lineHeight:1,color:"#007AFF"}}>{responseTime}</div>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,fontWeight:800,letterSpacing:2,color:"#bbb",marginTop:4}}>AVG RESPONSE</div>
                  </div>
                )}
              </div>
            </div>

            {/* BIO — hidden when empty. */}
            {bio&&(
              <div style={{marginBottom:36}}>
                <Heading>ABOUT THIS SELLER</Heading>
                <p style={{fontFamily:"'Barlow',sans-serif",fontSize:15,color:"#444",lineHeight:1.7,whiteSpace:"pre-line",maxWidth:720}}>{bio}</p>
              </div>
            )}

            {/* LISTINGS + ALL / WOMEN / MEN filter. */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:20}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #FF1493",paddingLeft:12}}>LISTINGS</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {["ALL","WOMEN","MEN"].map(f=>(
                  <button key={f} className="fpill" onClick={()=>setStoreFilter(f)} style={{...S.pill,...(storeFilter===f?S.pillOn:{})}}>{f}</button>
                ))}
              </div>
            </div>
            <div style={S.grid}>
              {filtered.map((item,idx)=>{
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
              {filtered.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"40px",fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,color:"#bbb"}}>NO ACTIVE LISTINGS RIGHT NOW</div>}
            </div>

            {/* REVIEWS */}
            {reviews.length>0&&(
              <div style={{marginTop:48}}>
                <Heading>REVIEWS ({reviews.length})</Heading>
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
        </div>
        );
      })()}
    </>
  );
}
