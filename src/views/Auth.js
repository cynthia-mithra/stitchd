import React from "react";
import { auth } from "../lib/auth";
import { S } from "../styles";
import { F } from "../components/Shared";

export default function Auth({
  view, setView,
  authMode, setAuthMode,
  aForm, setAForm, aError, setAError, aLoading,
  handleAuth, handleOTPVerify, handleForgot, handleResetPassword,
  otpStep, setOtpStep, otpCode, setOtpCode, otpEmail,
  flash,
}) {
  if(view!=="auth") return null;
  return (
    <main style={S.authMain}>
      <button style={S.back} onClick={()=>{ setView("shop"); setOtpStep("form"); setOtpCode(""); setAError(""); }}>← BACK</button>
      <div style={S.authSplit} className="auth-split">
        {/* LEFT - brand panel */}
        <div style={S.authBrand} className="auth-brand">
          <div>
            <div style={S.authBrandWord}>STITCH'D</div>
            <p style={S.authBrandTag} className="auth-brand-props">The UK marketplace for pre-loved South Asian fashion. Real measurements, measured fits only.</p>
          </div>
          <div style={S.authBrandProps} className="auth-brand-props">
            {[["REAL MEASUREMENTS","#FF1493"],["SOUTH ASIAN PRE-LOVED","#00E5CC"],["SECURE GBP CHECKOUT","#fff"]].map(([label,dot])=>(
              <span key={label} style={S.authBrandProp}><span style={{...S.authBrandDot,background:dot}}/>{label}</span>
            ))}
          </div>
        </div>
        {/* RIGHT - form */}
        <div style={S.authFormCol}>
        {otpStep==="forgot"?(
          <>
            <div style={S.formHero}>
              <h2 style={S.formTitle}>RESET YOUR<br/><span style={{color:"#FF1493"}}>PASSWORD.</span></h2>
              <p style={S.formSub}>Enter your email and we'll send you a reset link.</p>
            </div>
            <form onSubmit={handleForgot} style={{display:"flex",flexDirection:"column",gap:14}}>
              <F l="EMAIL"><input style={S.inp} type="email" placeholder="you@email.com" value={aForm.email} onChange={e=>setAForm(f=>({...f,email:e.target.value}))} required autoFocus/></F>
              {aError&&<div style={S.aError}>{aError}</div>}
              <button type="submit" className="hbtn" style={{...S.hBtn,width:"100%",padding:"16px",fontSize:15,borderRadius:0,letterSpacing:2,opacity:aLoading?0.5:1}} disabled={aLoading}>{aLoading?"SENDING...":<>SEND RESET LINK <span className="btn-arrow">→</span></>}</button>
            </form>
            <p style={S.authSwitch}>Remembered it? <span style={S.authSwitchLink} onClick={()=>{setOtpStep("form");setAError("");}}>Back to log in</span></p>
          </>
        ):otpStep==="reset"?(
          <>
            <div style={S.formHero}>
              <h2 style={S.formTitle}>NEW<br/><span style={{color:"#FF1493"}}>PASSWORD.</span></h2>
              <p style={S.formSub}>Choose a new password for your account.</p>
            </div>
            <form onSubmit={handleResetPassword} style={{display:"flex",flexDirection:"column",gap:14}}>
              <F l="NEW PASSWORD"><input style={S.inp} type="password" placeholder="••••••••" value={aForm.password} onChange={e=>setAForm(f=>({...f,password:e.target.value}))} required minLength={6} autoFocus/></F>
              {aError&&<div style={S.aError}>{aError}</div>}
              <button type="submit" className="hbtn" style={{...S.hBtn,width:"100%",padding:"16px",fontSize:15,borderRadius:0,letterSpacing:2,opacity:(aLoading||aForm.password.length<6)?0.5:1}} disabled={aLoading||aForm.password.length<6}>{aLoading?"UPDATING...":<>UPDATE PASSWORD <span className="btn-arrow">→</span></>}</button>
            </form>
          </>
        ):otpStep==="otp"?(
          <>
            <div style={S.formHero}>
              <h2 style={S.formTitle}>CHECK YOUR<br/><span style={{color:"#FF1493"}}>EMAIL.</span></h2>
              <p style={S.formSub}>We sent a 6-digit code to <strong>{otpEmail}</strong></p>
            </div>
            <form onSubmit={handleOTPVerify} style={{display:"flex",flexDirection:"column",gap:14}}>
              <F l="6-DIGIT CODE">
                <input style={{...S.inp,fontSize:28,letterSpacing:12,textAlign:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900}} placeholder="000000" maxLength={6} value={otpCode} onChange={e=>setOtpCode(e.target.value.replace(/\D/g,"").slice(0,6))} autoFocus/>
              </F>
              {aError&&<div style={S.aError}>{aError}</div>}
              <button type="submit" className="hbtn" style={{...S.hBtn,width:"100%",padding:"16px",fontSize:15,borderRadius:0,letterSpacing:2,opacity:(aLoading||otpCode.length!==6)?0.5:1}} disabled={aLoading||otpCode.length!==6}>{aLoading?"VERIFYING...":<>VERIFY CODE <span className="btn-arrow">→</span></>}</button>
            </form>
            <p style={{textAlign:"center",marginTop:16,fontSize:13,color:"#888"}}>Didn't get it? <span style={{color:"#FF1493",cursor:"pointer",fontWeight:700}} onClick={()=>{ auth.sendOTP(otpEmail); flash("Code resent!"); }}>Resend code</span></p>
          </>
        ):(
          <>
            <div style={S.formHero}><h2 style={S.formTitle}>{authMode==="login"?"WELCOME\nBACK.":"JOIN\nSTITCH'D."}</h2><p style={S.formSub}>{authMode==="login"?"Sign in to your account.":"Create an account to start selling."}</p></div>
            <a href={auth.googleUrl()} style={S.googleBtn}><svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/><path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/></svg>CONTINUE WITH GOOGLE</a>
            <a href={auth.appleUrl()} style={S.appleBtn}><svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M17.05 12.54c-.02-2.06 1.68-3.05 1.76-3.1-.96-1.4-2.45-1.6-2.98-1.62-1.27-.13-2.48.75-3.12.75-.64 0-1.64-.73-2.7-.71-1.39.02-2.67.81-3.38 2.05-1.44 2.5-.37 6.2 1.03 8.23.69 1 1.5 2.11 2.57 2.07 1.03-.04 1.42-.67 2.66-.67 1.24 0 1.59.67 2.68.65 1.11-.02 1.81-1.01 2.49-2.02.78-1.16 1.1-2.28 1.12-2.34-.02-.01-2.15-.83-2.17-3.28zM15.0 6.13c.56-.69.94-1.63.84-2.59-.81.03-1.8.54-2.39 1.21-.52.59-.98 1.55-.86 2.46.91.07 1.84-.46 2.41-1.08z"/></svg>CONTINUE WITH APPLE</a>
            <div style={S.divider}><span style={S.dividerText}>OR</span></div>
            <form onSubmit={handleAuth} style={{display:"flex",flexDirection:"column",gap:14}}>
              <F l="EMAIL"><input style={S.inp} type="email" placeholder="you@email.com" value={aForm.email} onChange={e=>setAForm(f=>({...f,email:e.target.value}))} required/></F>
              {authMode==="login"&&<F l="PASSWORD"><input style={S.inp} type="password" placeholder="••••••••" value={aForm.password} onChange={e=>setAForm(f=>({...f,password:e.target.value}))} required/></F>}
              {authMode==="login"&&<div style={{textAlign:"right",marginTop:-6}}><span style={{...S.authSwitchLink,fontSize:12}} onClick={()=>{setOtpStep("forgot");setAError("");}}>Forgot password?</span></div>}
              {aError&&<div style={S.aError}>{aError}</div>}
              <button type="submit" className="hbtn" style={{...S.hBtn,width:"100%",padding:"16px",fontSize:15,borderRadius:0,letterSpacing:2,opacity:aLoading?0.5:1}}>{aLoading?"...":authMode==="login"?<>SIGN IN <span className="btn-arrow">→</span></>:<>GET VERIFICATION CODE <span className="btn-arrow">→</span></>}</button>
            </form>
            <p style={S.authSwitch}>{authMode==="login"?"No account? ":"Already have one? "}<span style={S.authSwitchLink} onClick={()=>{setAuthMode(authMode==="login"?"signup":"login");setAError("");setAForm({email:"",password:""});}}>{authMode==="login"?"Sign up":"Log in"}</span></p>
          </>
        )}
        </div>
      </div>
    </main>
  );
}
