import React from "react";
import { Star, BadgeCheck, ShieldCheck } from "lucide-react";
import { COLOURS, colourSwatchBg } from "../lib/constants";

// Phase 12 — circular colour swatches, used identically by the shop/new-arrivals
// filter panel and the listing create/edit form. Each swatch is a 24px disc
// filled with the actual colour; the selected ones get a 2px #111 ring (drawn
// with box-shadow so toggling never shifts layout). `selected` is an array of
// chosen colour names; `onToggle(colour)` flips one. Multi-select — tapping a
// swatch adds/removes it. White/Cream get a faint base border so they read
// against the white panel.
export function ColourSwatches({ selected = [], onToggle }) {
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
      {COLOURS.map(c=>{
        const on=selected.includes(c);
        return (
          <button
            key={c}
            type="button"
            onClick={()=>onToggle(c)}
            title={c}
            aria-label={c}
            aria-pressed={on}
            style={{
              width:24,height:24,padding:0,borderRadius:"50%",cursor:"pointer",
              background:colourSwatchBg(c),
              border:"1px solid rgba(0,0,0,0.18)",
              boxShadow:on?"0 0 0 2px #fff, 0 0 0 4px #111":"none",
              flexShrink:0,transition:"box-shadow .12s",
            }}
          />
        );
      })}
    </div>
  );
}

// Phase 11 — reusable VERIFIED SELLER badge. Shown anywhere a verified seller's
// name appears (listing cards, listing detail, seller profile, order cards,
// dashboard header). Design system: #00E5CC teal fill, #111 ink + 2px #111
// border, square corners, Barlow Condensed bold. `size="sm"` is the compact
// variant used on cards; the default is the larger badge for headers/profiles.
export function VerifiedBadge({ size = "md", style }) {
  const sm = size === "sm";
  return (
    <span style={{
      display:"inline-flex",alignItems:"center",gap:sm?4:6,
      background:"#00E5CC",color:"#111",border:"2px solid #111",borderRadius:0,
      padding:sm?"2px 7px":"4px 11px",
      fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,
      letterSpacing:sm?0.5:1,fontSize:sm?10:13,lineHeight:1.2,whiteSpace:"nowrap",
      ...style,
    }}>
      <BadgeCheck width={sm?12:16} height={sm?12:16}/> VERIFIED SELLER
    </span>
  );
}

// Phase 11 — ID VERIFIED badge. Separate from the VERIFIED SELLER badge: this one
// means the seller passed Stripe Identity. Shown on the seller profile and the
// listing detail (and the dashboard IDENTITY VERIFICATION section). Design system:
// #111 black fill, white text, 2px #111 border, square corners, Barlow Condensed
// bold. `size="sm"` is the compact variant used inline next to a seller name.
export function IDVerifiedBadge({ size = "md", style }) {
  const sm = size === "sm";
  return (
    <span style={{
      display:"inline-flex",alignItems:"center",gap:sm?4:6,
      background:"#111",color:"#fff",border:"2px solid #111",borderRadius:0,
      padding:sm?"2px 7px":"4px 11px",
      fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,
      letterSpacing:sm?0.5:1,fontSize:sm?10:13,lineHeight:1.2,whiteSpace:"nowrap",
      ...style,
    }}>
      <ShieldCheck width={sm?12:16} height={sm?12:16}/> ID VERIFIED
    </span>
  );
}

// Proportional 5-star rating. Each position is a faint outline star with a
// horizontally-clipped filled copy laid over it, so a 4.3 average shows four
// solid stars plus 30% of the fifth. `color` drives the fill via currentColor
// (defaults to the #FF1493 brand pink). Callers decide whether to render at all
// — with no reviews we show nothing rather than five empty stars.
export function Stars({value=0,size=14,color="#FF1493",gap=2}){
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap,color,lineHeight:0}}>
      {Array.from({length:5}).map((_,i)=>{
        const pct=Math.max(0,Math.min(1,value-i))*100;
        return (
          <span key={i} style={{position:"relative",display:"inline-block",width:size,height:size,lineHeight:0}}>
            <Star width={size} height={size} fill="none" stroke="currentColor" style={{position:"absolute",top:0,left:0,opacity:0.3}}/>
            <span style={{position:"absolute",top:0,left:0,height:"100%",width:`${pct}%`,overflow:"hidden",display:"inline-block",lineHeight:0}}>
              <Star width={size} height={size} fill="currentColor" stroke="currentColor"/>
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function Sec({label,children}){return<div style={{marginBottom:36}}><div style={{fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #FF1493",paddingLeft:12,marginBottom:18,textTransform:"uppercase"}}>{label}</div>{children}</div>;}
export function F({l,children,style}){return<div style={{display:"flex",flexDirection:"column",gap:5,...style}}><label style={{fontSize:10,fontWeight:800,color:"#999",letterSpacing:1.5,textTransform:"uppercase"}}>{l}</label>{children}</div>;}
// Listing thumbnail with a graceful fallback. Renders the uploaded photo when
// `src` is present AND it actually loads; if the URL is empty OR the image fails
// to load (e.g. a broken link, or the Supabase `listings` storage bucket isn't
// public so the public URL 403s) it falls back to the category emoji on the
// accent background instead of an ugly broken-image icon. `gradient` adds the
// bottom darkening overlay used on the main grid cards; `children` are overlays
// (SOLD veil, badges, heart button…) layered on top.
export function Thumb({src,emoji,accent,gradient=false,imgOpacity=1,imgStyle,emojiStyle,style,className,children}){
  const [ok,setOk]=React.useState(true);
  const showImg=!!src&&ok;
  return (
    <div className={className} style={{position:"relative",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",...style,background:showImg?"#000":accent}}>
      {showImg
        ?<img src={src} alt="" onError={()=>setOk(false)} style={{width:"100%",height:"100%",objectFit:"cover",opacity:imgOpacity,...imgStyle}}/>
        :<span style={emojiStyle}>{emoji}</span>}
      {showImg&&gradient&&<div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 50%,rgba(0,0,0,0.45))"}}/>}
      {children}
    </div>
  );
}
// Scroll-reveal wrapper — fades + lifts its children into view the first time
// they enter the viewport (then disconnects). Renders straight away (no hidden
// state) when the user prefers reduced motion or IntersectionObserver is missing.
export function Reveal({children,style,className="",delay=0}){
  const ref=React.useRef(null);
  const reduce = typeof window!=="undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [shown,setShown]=React.useState(reduce || typeof IntersectionObserver==="undefined");
  React.useEffect(()=>{
    if(shown) return;
    const el=ref.current; if(!el) return;
    const io=new IntersectionObserver(([e])=>{ if(e.isIntersecting){ setShown(true); io.disconnect(); } },{threshold:0.06,rootMargin:"0px 0px -40px 0px"});
    io.observe(el);
    return ()=>io.disconnect();
  },[shown]);
  return <div ref={ref} className={"reveal"+(shown?" in":"")+(className?" "+className:"")} style={{...(delay?{transitionDelay:delay+"ms"}:null),...style}}>{children}</div>;
}
export function Tog({on,onToggle,color,label,sub}){return<div style={{display:"flex",alignItems:"flex-start",gap:14,padding:"14px 0",borderBottom:"1px solid #f0f0f0",cursor:"pointer"}} onClick={onToggle}><div style={{width:46,height:26,borderRadius:13,background:on?color:"#e0e0e0",position:"relative",flexShrink:0,transition:"background .2s",border:`2px solid ${on?color:"#ccc"}`}}><div style={{width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:on?24:2,transition:"left .18s",boxShadow:"0 2px 6px rgba(0,0,0,0.2)"}}/></div><div><div style={{fontSize:13,fontWeight:800,letterSpacing:0.5,color:"#111"}}>{label}</div><div style={{fontSize:12,color:"#aaa",marginTop:3}}>{sub}</div></div></div>;}
