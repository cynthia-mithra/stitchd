import React from "react";
import { auth } from "../lib/auth";
import { S } from "../styles";
import { F } from "../components/Shared";
import { IS_NATIVE } from "../lib/constants";
import { openExternal } from "../lib/native";

const BC = "'Barlow Condensed',sans-serif";

// In the native app, social sign-in must open in the in-app browser (so the
// stitchd:// return can reopen the app); on the web it's a normal link.
function oauthClick(e, url) {
  if (IS_NATIVE) { e.preventDefault(); openExternal(url); }
}

// Full-pink login screen. The form sits directly on the pink (no white card);
// text, labels and links are recoloured for contrast. The .auth-pink class turns
// the shared field labels white (they're inline-styled grey by default).
export default function Auth({
  view, setView,
  authMode, setAuthMode,
  aForm, setAForm, aError, setAError, aLoading,
  handleAuth, handleOTPVerify, handleForgot, handleResetPassword,
  otpStep, setOtpStep, otpCode, setOtpCode, otpEmail,
  flash,
}) {
  if (view !== "auth") return null;

  // Pink-screen overrides of the shared styles.
  const TITLE = { ...S.formTitle, color: "#fff", borderBottom: "3px solid rgba(255,255,255,0.4)" };
  const ACCENT = { color: "#111" };                                   // accent word on pink
  const SUB = { ...S.formSub, color: "rgba(255,255,255,0.92)" };
  const GOOGLE = { ...S.googleBtn, background: "#fff", border: "2px solid #111" };
  const SWITCH = { ...S.authSwitch, color: "rgba(255,255,255,0.92)" };
  const SWITCHLINK = { ...S.authSwitchLink, color: "#fff" };
  const DIVTEXT = { ...S.dividerText, color: "rgba(255,255,255,0.85)" };
  const linkFaint = { fontFamily: BC, fontSize: 13, fontWeight: 700, letterSpacing: 1, color: "rgba(255,255,255,0.85)", cursor: "pointer" };

  return (
    <main style={S.authMain}>
      <div style={{ maxWidth: 460, width: "100%", margin: "0 auto" }} className="auth-pink">
        <button style={{ ...S.back, color: "rgba(255,255,255,0.9)", marginBottom: 18 }} onClick={() => { setView("shop"); setOtpStep("form"); setOtpCode(""); setAError(""); }}>← BACK</button>

        {/* Brand hero */}
        <div style={{ marginBottom: 30 }}>
          <div style={{ fontFamily: BC, fontWeight: 900, fontSize: "clamp(54px,15vw,86px)", color: "#fff", letterSpacing: 1, lineHeight: 0.9 }}>STITCH'D</div>
          <p style={{ fontFamily: "'Barlow',sans-serif", fontSize: 15, color: "rgba(255,255,255,0.9)", lineHeight: 1.55, marginTop: 12, maxWidth: 400 }}>The UK marketplace for pre-loved South Asian fashion. Real measurements, measured fits only.</p>
        </div>

        {otpStep === "forgot" ? (
          <>
            <div style={S.formHero}><h2 style={TITLE}>RESET YOUR<br /><span style={ACCENT}>PASSWORD.</span></h2><p style={SUB}>Enter your email and we'll send you a reset link.</p></div>
            <form onSubmit={handleForgot} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <F l="EMAIL"><input style={S.inp} type="email" placeholder="you@email.com" value={aForm.email} onChange={e => setAForm(f => ({ ...f, email: e.target.value }))} required autoFocus /></F>
              {aError && <div style={S.aError}>{aError}</div>}
              <button type="submit" className="hbtn" style={{ ...S.hBtn, width: "100%", padding: "16px", fontSize: 15, borderRadius: 0, letterSpacing: 2, opacity: aLoading ? 0.5 : 1 }} disabled={aLoading}>{aLoading ? "SENDING..." : <>SEND RESET LINK <span className="btn-arrow">→</span></>}</button>
            </form>
            <p style={SWITCH}>Remembered it? <span style={SWITCHLINK} onClick={() => { setOtpStep("form"); setAError(""); }}>Back to log in</span></p>
          </>
        ) : otpStep === "reset" ? (
          <>
            <div style={S.formHero}><h2 style={TITLE}>NEW<br /><span style={ACCENT}>PASSWORD.</span></h2><p style={SUB}>Choose a new password for your account.</p></div>
            <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <F l="NEW PASSWORD"><input style={S.inp} type="password" placeholder="••••••••" value={aForm.password} onChange={e => setAForm(f => ({ ...f, password: e.target.value }))} required minLength={6} autoFocus /></F>
              {aError && <div style={S.aError}>{aError}</div>}
              <button type="submit" className="hbtn" style={{ ...S.hBtn, width: "100%", padding: "16px", fontSize: 15, borderRadius: 0, letterSpacing: 2, opacity: (aLoading || aForm.password.length < 6) ? 0.5 : 1 }} disabled={aLoading || aForm.password.length < 6}>{aLoading ? "UPDATING..." : <>UPDATE PASSWORD <span className="btn-arrow">→</span></>}</button>
            </form>
          </>
        ) : otpStep === "otp" ? (
          <>
            <div style={S.formHero}><h2 style={TITLE}>CHECK YOUR<br /><span style={ACCENT}>EMAIL.</span></h2><p style={SUB}>We sent a 6-digit code to <strong style={{ color: "#fff" }}>{otpEmail}</strong></p></div>
            <form onSubmit={handleOTPVerify} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <F l="6-DIGIT CODE"><input style={{ ...S.inp, fontSize: 28, letterSpacing: 12, textAlign: "center", fontFamily: BC, fontWeight: 900 }} placeholder="000000" maxLength={6} value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus /></F>
              {aError && <div style={S.aError}>{aError}</div>}
              <button type="submit" className="hbtn" style={{ ...S.hBtn, width: "100%", padding: "16px", fontSize: 15, borderRadius: 0, letterSpacing: 2, opacity: (aLoading || otpCode.length !== 6) ? 0.5 : 1 }} disabled={aLoading || otpCode.length !== 6}>{aLoading ? "VERIFYING..." : <>VERIFY CODE <span className="btn-arrow">→</span></>}</button>
            </form>
            <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "rgba(255,255,255,0.9)" }}>Didn't get it? <span style={{ color: "#fff", cursor: "pointer", fontWeight: 800, textDecoration: "underline" }} onClick={() => { auth.sendOTP(otpEmail); flash("Code resent!"); }}>Resend code</span></p>
          </>
        ) : (
          <>
            <div style={S.formHero}><h2 style={TITLE}>{authMode === "login" ? "WELCOME\nBACK." : "JOIN\nSTITCH'D."}</h2><p style={SUB}>{authMode === "login" ? "Sign in to your account." : "Create an account to start selling."}</p></div>
            <a href={auth.googleUrl()} onClick={e => oauthClick(e, auth.googleUrl())} style={GOOGLE}><svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" /><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" /><path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" /><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" /></svg>CONTINUE WITH GOOGLE</a>
            <a href={auth.appleUrl()} onClick={e => oauthClick(e, auth.appleUrl())} style={S.appleBtn}><svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M17.05 12.54c-.02-2.06 1.68-3.05 1.76-3.1-.96-1.4-2.45-1.6-2.98-1.62-1.27-.13-2.48.75-3.12.75-.64 0-1.64-.73-2.7-.71-1.39.02-2.67.81-3.38 2.05-1.44 2.5-.37 6.2 1.03 8.23.69 1 1.5 2.11 2.57 2.07 1.03-.04 1.42-.67 2.66-.67 1.24 0 1.59.67 2.68.65 1.11-.02 1.81-1.01 2.49-2.02.78-1.16 1.1-2.28 1.12-2.34-.02-.01-2.15-.83-2.17-3.28zM15.0 6.13c.56-.69.94-1.63.84-2.59-.81.03-1.8.54-2.39 1.21-.52.59-.98 1.55-.86 2.46.91.07 1.84-.46 2.41-1.08z" /></svg>CONTINUE WITH APPLE</a>
            <div style={{ ...S.divider, justifyContent: "center" }}><span style={DIVTEXT}>OR</span></div>
            <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <F l="EMAIL"><input style={S.inp} type="email" placeholder="you@email.com" value={aForm.email} onChange={e => setAForm(f => ({ ...f, email: e.target.value }))} required /></F>
              {authMode === "login" && <F l="PASSWORD"><input style={S.inp} type="password" placeholder="••••••••" value={aForm.password} onChange={e => setAForm(f => ({ ...f, password: e.target.value }))} required /></F>}
              {authMode === "login" && <div style={{ textAlign: "right", marginTop: -6 }}><span style={{ ...linkFaint, textDecoration: "underline" }} onClick={() => { setOtpStep("forgot"); setAError(""); }}>Forgot password?</span></div>}
              {aError && <div style={S.aError}>{aError}</div>}
              <button type="submit" className="hbtn" style={{ ...S.hBtn, width: "100%", padding: "16px", fontSize: 15, borderRadius: 0, letterSpacing: 2, opacity: aLoading ? 0.5 : 1 }}>{aLoading ? "..." : authMode === "login" ? <>SIGN IN <span className="btn-arrow">→</span></> : <>GET VERIFICATION CODE <span className="btn-arrow">→</span></>}</button>
            </form>
            <p style={SWITCH}>{authMode === "login" ? "No account? " : "Already have one? "}<span style={SWITCHLINK} onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAError(""); setAForm({ email: "", password: "" }); }}>{authMode === "login" ? "Sign up" : "Log in"}</span></p>
            {IS_NATIVE && <p style={{ textAlign: "center", marginTop: 8 }}><span style={linkFaint} onClick={() => setView("shop")}>Browse without an account →</span></p>}
          </>
        )}
      </div>
    </main>
  );
}
