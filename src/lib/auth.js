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
  googleUrl(){ return `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(window.location.href)}`; },
  async refreshSession(refreshToken){ const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:refreshToken})}); const d=await r.json(); if(d.error)throw new Error(d.error.message); return d; },
  getSession(){ try{return JSON.parse(localStorage.getItem("stitchd_session"));}catch{return null;} },
  saveSession(s){ localStorage.setItem("stitchd_session",JSON.stringify(s)); },
  clearSession(){ localStorage.removeItem("stitchd_session"); },
};

export async function uploadImage(file,t){
  const ext=file.name.split(".").pop();
  const path=`${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const r=await fetch(`${SUPABASE_URL}/storage/v1/object/listings/${path}`,{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${t||SUPABASE_KEY}`,"Content-Type":file.type,"x-upsert":"true"},body:file});
  if(!r.ok)throw new Error(await r.text());
  return `${SUPABASE_URL}/storage/v1/object/public/listings/${path}`;
}
