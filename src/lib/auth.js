import { SUPABASE_URL, SUPABASE_KEY } from "./constants";

export const auth = {
  async signUp(email,pw){ const r=await fetch(`${SUPABASE_URL}/auth/v1/signup`,{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email,password:pw})}); const d=await r.json(); if(d.error)throw new Error(d.error.message||d.msg); return d; },
  async signIn(email,pw){ const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email,password:pw})}); const d=await r.json(); if(d.error)throw new Error(d.error.message||d.msg); return d; },
  async signOut(t){ await fetch(`${SUPABASE_URL}/auth/v1/logout`,{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${t}`}}); },
  async sendOTP(email){ const r=await fetch(`${SUPABASE_URL}/auth/v1/otp`,{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email,create_user:true})}); const d=await r.json(); if(d.error)throw new Error(d.error.message||d.msg); return d; },
  async verifyOTP(email,token){ const r=await fetch(`${SUPABASE_URL}/auth/v1/verify`,{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email,token,type:"email"})}); const d=await r.json(); if(d.error)throw new Error(d.error.message||d.msg); return d; },
  async enroll2FA(t){ const r=await fetch(`${SUPABASE_URL}/auth/v1/factors`,{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${t}`,"Content-Type":"application/json"},body:JSON.stringify({friendly_name:"Stitch'd Authenticator",factor_type:"totp"})}); const d=await r.json(); if(d.error)throw new Error(d.error.message||d.msg); return d; },
  async verify2FA(factorId,challengeId,code,t){ const r=await fetch(`${SUPABASE_URL}/auth/v1/factors/${factorId}/verify`,{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${t}`,"Content-Type":"application/json"},body:JSON.stringify({challenge_id:challengeId,code})}); const d=await r.json(); if(d.error)throw new Error(d.error.message||d.msg); return d; },
  async challenge2FA(factorId,t){ const r=await fetch(`${SUPABASE_URL}/auth/v1/factors/${factorId}/challenge`,{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${t}`,"Content-Type":"application/json"}}); const d=await r.json(); if(d.error)throw new Error(d.error.message||d.msg); return d; },
  async listFactors(t){ const r=await fetch(`${SUPABASE_URL}/auth/v1/factors`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${t}`}}); const d=await r.json(); if(d.error)return []; return d.totp||[]; },
  async unenroll2FA(factorId,t){ const r=await fetch(`${SUPABASE_URL}/auth/v1/factors/${factorId}`,{method:"DELETE",headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${t}`}}); return r.ok; },
  // Use a CLEAN return target (origin + path only). window.location.href can
  // carry a leftover "?error=...&error_code=bad_oauth_state..." from a previous
  // failed login; feeding that back as redirect_to pollutes the next attempt.
  // NOTE: this stays on whatever domain the page was actually loaded from — if
  // the OAuth state error persists, the real fix is in the Supabase dashboard
  // (Authentication → URL Configuration: Site URL + allowed Redirect URLs must
  // match the exact domain) and Google Cloud (authorized redirect URI must be
  // <project>.supabase.co/auth/v1/callback), not in this URL.
  googleUrl(){ const target=`${window.location.origin}${window.location.pathname}`; return `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(target)}`; },
  async refreshSession(refreshToken){ const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:refreshToken})}); const d=await r.json().catch(()=>({})); /* GoTrue returns refresh errors in several shapes ({error:{message}}, {error_description}, {msg}); a non-OK response or a body with no access_token must throw, otherwise getValidToken would hand back an undefined token and the next request fails with "JWT expired". */ if(!r.ok||!d.access_token) throw new Error(d.error_description||d.msg||(d.error&&d.error.message)||(typeof d.error==="string"?d.error:"")||`Token refresh failed (HTTP ${r.status})`); return d; },
  getSession(){ try{return JSON.parse(localStorage.getItem("stitchd_session"));}catch{return null;} },
  saveSession(s){ localStorage.setItem("stitchd_session",JSON.stringify(s)); },
  clearSession(){ localStorage.removeItem("stitchd_session"); },
};

// Decode a Supabase JWT (access_token) without verifying it, so we can read the
// real user id (`sub`), `email`, and expiry (`exp`) from the token itself. The
// OAuth redirect hash does NOT include a user_id param, so this is the only
// reliable way to learn who is logged in after a Google sign-in.
export function decodeJWT(token){
  try{
    const payload=token.split(".")[1];
    const json=decodeURIComponent(atob(payload.replace(/-/g,"+").replace(/_/g,"/")).split("").map(c=>"%"+("00"+c.charCodeAt(0).toString(16)).slice(-2)).join(""));
    return JSON.parse(json);
  }catch{ return null; }
}

// True when the token is missing, unreadable, or expires within `skewMs`.
export function isTokenExpired(token,skewMs=60000){
  const claims=decodeJWT(token);
  if(!claims||!claims.exp) return true;
  return claims.exp*1000 < Date.now()+skewMs;
}

// Upload a file to a public Storage bucket and return its public URL. The
// bucket defaults to "listings" (every listing photo goes there); Shop the Look
// cover images pass bucket="looks" instead (see uploadLookImage). Both buckets
// must exist and be public in Supabase Storage.
export async function uploadImage(file,t,bucket="listings"){
  const ext=file.name.split(".").pop();
  const path=`${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const r=await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${t||SUPABASE_KEY}`,"Content-Type":file.type||"application/octet-stream","x-upsert":"true"},body:file});
  if(!r.ok){
    let detail="";
    try{ const j=await r.clone().json(); detail=j.message||j.error||j.msg||JSON.stringify(j); }
    catch{ try{ detail=await r.text(); }catch{ detail=""; } }
    throw new Error(`Image upload failed (HTTP ${r.status}): ${detail||r.statusText}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

// Shop the Look cover images live in a separate "looks" storage bucket.
export const uploadLookImage=(file,t)=>uploadImage(file,t,"looks");
