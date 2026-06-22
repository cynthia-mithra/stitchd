import React from "react";
import { auth } from "../lib/auth";
import { S } from "../styles";
import { F } from "../components/Shared";

export default function Auth({
  view, setView,
  authMode, setAuthMode,
  aForm, setAForm, aError, setAError, aLoading,
  handleAuth, handleOTPVerify,
  otpStep, setOtpStep, otpCode, setOtpCode, otpEmail,
  flash,
}) {
  if(view!=="auth") return null;
  return (
    <main style={{...S.main,maxWidth:480}}>
      <button style={S.back} onClick={()=>{ setView("shop"); setOtpStep("form"); setOtpCode(""); setAError(""); }}>← BACK</button>
      <div style={S.formCard} className="form-card">
        {otpStep==="otp"?(
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
              <button type="submit" className="hbtn" style={{...S.hBtn,width:"100%",padding:"16px",fontSize:15,borderRadius:0,letterSpacing:3,opacity:(aLoading||otpCode.length!==6)?0.5:1}} disabled={aLoading||otpCode.length!==6}>{aLoading?"VERIFYING...":<>VERIFY CODE <span className="btn-arrow">→</span></>}</button>
            </form>
            <p style={{textAlign:"center",marginTop:16,fontSize:13,color:"#888"}}>Didn't get it? <span style={{color:"#FF1493",cursor:"pointer",fontWeight:700}} onClick={()=>{ auth.sendOTP(otpEmail); flash("📧 Code resent!"); }}>Resend code</span></p>
          </>
        ):(
          <>
            <div style={S.formHero}><h2 style={S.formTitle}>{authMode==="login"?"WELCOME\nBACK.":"JOIN\nSTITCH'D."}</h2><p style={S.formSub}>{authMode==="login"?"Sign in to your account.":"Create an account to start selling."}</p></div>
            <a href={auth.googleUrl()} style={S.googleBtn}><svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/><path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/></svg>CONTINUE WITH GOOGLE</a>
            <div style={S.divider}><span style={S.dividerText}>OR</span></div>
            <form onSubmit={handleAuth} style={{display:"flex",flexDirection:"column",gap:14}}>
              <F l="EMAIL"><input style={S.inp} type="email" placeholder="you@email.com" value={aForm.email} onChange={e=>setAForm(f=>({...f,email:e.target.value}))} required/></F>
              {authMode==="login"&&<F l="PASSWORD"><input style={S.inp} type="password" placeholder="••••••••" value={aForm.password} onChange={e=>setAForm(f=>({...f,password:e.target.value}))} required/></F>}
              {aError&&<div style={S.aError}>{aError}</div>}
              <button type="submit" className="hbtn" style={{...S.hBtn,width:"100%",padding:"16px",fontSize:15,borderRadius:0,letterSpacing:3,opacity:aLoading?0.5:1}}>{aLoading?"...":authMode==="login"?<>SIGN IN <span className="btn-arrow">→</span></>:<>GET VERIFICATION CODE <span className="btn-arrow">→</span></>}</button>
            </form>
            <p style={S.authSwitch}>{authMode==="login"?"No account? ":"Already have one? "}<span style={S.authSwitchLink} onClick={()=>{setAuthMode(authMode==="login"?"signup":"login");setAError("");setAForm({email:"",password:""});}}>{authMode==="login"?"Sign up":"Log in"}</span></p>
          </>
        )}
      </div>
    </main>
  );
}
