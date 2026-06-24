export const CSS=`
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,700;0,800;0,900;1,800&family=Barlow:wght@400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  /* Global type rhythm: crisper rendering everywhere + sensible defaults that
     only apply where an element hasn't set its own (inline styles still win). */
  body{background:#fff;color:#111;font-family:'Barlow',sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;font-feature-settings:"kern" 1;-webkit-text-size-adjust:100%;}
  p{line-height:1.6;}
  h1,h2,h3,h4{line-height:1.04;}
  button,input,select,textarea{font-family:inherit;}
  .scard{transition:transform .28s cubic-bezier(.22,1,.36,1),box-shadow .28s ease !important;cursor:pointer;}
  .scard:hover{transform:translateY(-6px) !important;box-shadow:0 22px 50px rgba(0,0,0,0.14) !important;}
  /* Trendy product-card interaction: the cover image gently zooms inside its
     fixed (overflow:hidden) frame while the card lifts. Emoji-only cards get
     the same subtle scale so the grid feels alive without being busy. */
  .card-top img,.card-top span{transition:transform .5s cubic-bezier(.22,1,.36,1) !important;}
  .scard:hover .card-top img,.scard:hover .card-top span{transform:scale(1.07) !important;}
  /* Order / row cards lift gently on hover. */
  .order-card{transition:transform .18s cubic-bezier(.22,1,.36,1),box-shadow .18s ease;}
  .order-card:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(0,0,0,0.08);}
  /* Zoned image overlays — status chips stack vertically so they never collide. */
  .card-ov{position:absolute;display:flex;flex-direction:column;align-items:flex-start;gap:5px;z-index:5;pointer-events:none;}
  .card-ov-tl{top:10px;left:10px;}
  .card-ov-bl{bottom:10px;left:10px;}
  /* Wishlist heart — sharp, frosted, on-theme (square to match the design). */
  .card-heart{position:absolute;top:10px;right:10px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.8);backdrop-filter:saturate(160%) blur(6px);-webkit-backdrop-filter:saturate(160%) blur(6px);border:2px solid #111;border-radius:0;cursor:pointer;z-index:6;transition:transform .15s ease,background .15s ease;}
  .card-heart:hover{transform:scale(1.1);}
  /* Frosted hover price — a glass bar that slides up over the image on hover. */
  .card-hover-price{position:absolute;left:0;right:0;bottom:0;z-index:7;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 13px;background:rgba(255,255,255,0.7);backdrop-filter:saturate(180%) blur(10px);-webkit-backdrop-filter:saturate(180%) blur(10px);border-top:2px solid #111;transform:translateY(102%);transition:transform .3s cubic-bezier(.22,1,.36,1);pointer-events:none;}
  .scard:hover .card-hover-price{transform:translateY(0);}
  .card-hover-price .chp-price{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:22px;letter-spacing:-0.5px;color:#111;line-height:1;}
  .card-hover-price .chp-view{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:11px;letter-spacing:2px;color:#FF1493;display:inline-flex;align-items:center;gap:5px;}
  /* Touch / no-hover devices never reveal the hover bar. */
  @media(hover:none){.card-hover-price{display:none;}}
  @media(max-width:600px){
    .card-ov{gap:4px;}
    .card-ov-tl{top:7px;left:7px;}
    .card-ov-bl{bottom:7px;left:7px;}
    .card-ov span{font-size:8px !important;padding:2px 6px !important;letter-spacing:1px !important;}
    .card-heart{width:27px;height:27px;top:7px;right:7px;}
    .card-hover-price .chp-price{font-size:18px;}
  }
  /* Unified button feel: a confident lift + soft shadow on hover (replaces the
     old dated scale-down), and a quick press-down on click. Applies to every
     CTA site-wide since .hbtn is the shared button class. */
  /* Sticky product buy bar slides up from the bottom when toggled .show. */
  .detail-buybar{transform:translateY(115%);opacity:0;transition:transform .32s cubic-bezier(.22,1,.36,1),opacity .25s ease;pointer-events:none;}
  .detail-buybar.show{transform:translateY(0);opacity:1;pointer-events:auto;}
  /* Sticky header lifts off the page with a hairline shadow only once scrolled. */
  .nav-header{transition:box-shadow .25s ease,background .25s ease;}
  .nav-header.scrolled{box-shadow:0 6px 26px rgba(0,0,0,0.09);}
  .hbtn{transition:transform .18s cubic-bezier(.22,1,.36,1),box-shadow .18s ease,filter .18s ease !important;}
  .hbtn:hover{transform:translateY(-2px) !important;box-shadow:0 9px 22px rgba(0,0,0,0.18) !important;filter:brightness(1.05) !important;}
  .hbtn:active{transform:translateY(0) !important;box-shadow:0 3px 9px rgba(0,0,0,0.16) !important;}
  /* Signature micro-interaction: a trailing arrow wrapped in .btn-arrow slides
     right as the button lifts. Opt-in per CTA so only intentional arrows move. */
  .btn-arrow{display:inline-block;transition:transform .2s cubic-bezier(.22,1,.36,1);}
  .hbtn:hover .btn-arrow{transform:translateX(5px);}
  /* Conversation rows in Messages: gentle tint + pink edge on hover. */
  .conv-item:hover{background:#fff7fc !important;border-left-color:#FF149355 !important;}
  /* Desktop nav dropdown items turn pink on hover; the LOG OUT item keeps its red. */
  .nav-drop-item:hover{color:#FF1493 !important;}
  .nav-drop-item-danger:hover{color:#FF0000 !important;}
  /* Mobile menu rows go pink on tap. */
  .nav-mob-item:active{color:#FF1493 !important;background:#fff5fa !important;}
  /* Footer links (T&Cs, Privacy, Returns, Contact) turn pink on hover. */
  .footer-link{transition:color .15s ease;}
  .footer-link:hover{color:#FF1493 !important;}
  .footer-social{transition:border-color .15s ease,color .15s ease;}
  .footer-social:hover{border-color:#FF1493 !important;color:#FF1493 !important;}
  /* The hamburger is mobile-only; the profile-icon dropdown is desktop/iPad-only. */
  .nav-hamburger{display:none !important;}
  .fpill{transition:all .14s !important;}
  .fpill:hover{background:#111 !important;color:#fff !important;}
  @keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
  @keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  /* Toast slides up + fades in (keeps the -50% horizontal centering). */
  @keyframes toastIn{from{opacity:0;transform:translate(-50%,16px)}to{opacity:1;transform:translate(-50%,0)}}
  .toast-pop{animation:toastIn .28s cubic-bezier(.22,1,.36,1);}
  /* Scroll-reveal: sections fade + lift into view the first time they appear. */
  .reveal{opacity:0;transform:translateY(20px);transition:opacity .55s ease,transform .55s cubic-bezier(.22,1,.36,1);will-change:opacity,transform;}
  .reveal.in{opacity:1;transform:none;}
  /* Hero value-prop "trust bar" — 3 equal cells in a sharp bordered row with
     vertical dividers; stacks with horizontal dividers on mobile. */
  .hero-props{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;margin-top:34px;max-width:780px;width:100%;}
  .hero-prop{display:flex;align-items:center;justify-content:center;gap:9px;padding:8px 24px;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;letter-spacing:2px;color:#111;text-transform:uppercase;white-space:nowrap;}
  .hero-prop + .hero-prop{border-left:1px solid #e2e2e2;}
  @media(max-width:600px){
    .hero-prop{flex:1 1 100%;padding:9px 18px;}
    .hero-prop + .hero-prop{border-left:none;}
  }
  @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
  input:focus,select:focus,textarea:focus{border-color:#FF1493 !important;box-shadow:0 0 0 3px rgba(255,20,147,0.1) !important;outline:none;}
  ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:#eee;border-radius:2px}
  ::selection{background:#FF149333}
  /* SHOP THE LOOK — desktop is a 3-up grid; the homepage rail turns into a
     horizontal swipe-scroll on phones (cards ~78% wide so the next one peeks). */
  .looks-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
  .looks-page-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;}
  @media(max-width:600px){
    .looks-rail{display:flex !important;overflow-x:auto;gap:12px;scroll-snap-type:x mandatory;padding-bottom:6px;}
    .looks-rail > *{flex:0 0 78% !important;scroll-snap-align:start;}
    .looks-page-grid{grid-template-columns:1fr 1fr !important;gap:10px !important;}
  }
  /* STYLE FEED — two-column post grid on desktop, single column on mobile. The
     CREATE POST button sits in the header on desktop and becomes a fixed bottom-
     right FAB on mobile. The homepage STYLE INSPIRATION rail is a 2x2 grid on
     desktop and a horizontal swipe-scroll on phones (like the looks rail). */
  .style-feed-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;}
  .style-create-fab{display:none;}
  .style-home-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  /* AVAILABILITY CALENDAR (Phase 15) — current + next month side by side on
     desktop, a single month on mobile (the second month is hidden; PREV/NEXT
     still navigates one month at a time). */
  .avail-months{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
  @media(max-width:600px){
    .avail-months{grid-template-columns:1fr !important;}
    .avail-month-second{display:none !important;}
  }
  @media(max-width:600px){
    .style-feed-grid{grid-template-columns:1fr !important;}
    .style-create-desktop{display:none !important;}
    .style-create-fab{display:flex !important;}
    .style-home-rail{display:flex !important;overflow-x:auto;gap:12px;scroll-snap-type:x mandatory;padding-bottom:6px;}
    .style-home-rail > *{flex:0 0 70% !important;scroll-snap-align:start;}
  }
  @media(max-width:600px){
    /* PROBLEM 1 — keep the hero SIDE-BY-SIDE on mobile (like desktop): the writing
       takes the LEFT and the bubbles sit to the RIGHT, but instead of a neat wrapping
       grid the bubbles now form a SLIGHTLY-OVERLAPPING, STAGGERED FLOATING cluster —
       the same playful arrangement as the desktop hero (keeps the divider border). */
    /* Type-led hero (no imagery) — just tighten the spacing on small screens. */
    .hero-section{min-height:0 !important;padding:36px 18px !important;}
    .hero-left{padding:0 !important;}
    /* PROBLEM 2 — search field full-width on its own line, FILTERS/FIT/TAILORS
       sharing the second line equally and compactly. */
    .search-box{flex:1 1 100% !important;}
    .search-action-btn{flex:1 1 0 !important;min-width:0 !important;}
    /* BROWSE tabs — full width on mobile so ALL LISTINGS / FOLLOWING split the
       row evenly; auto width on desktop (default). */
    .shop-tabs{width:100% !important;}
    .shop-tab{flex:1 1 0 !important;text-align:center !important;padding-left:0 !important;padding-right:0 !important;}
    /* PROBLEM 3 — two-column listing grid with proportionally scaled cards. */
    .shop-grid{grid-template-columns:1fr 1fr !important;gap:12px !important;}
    .card-top{height:150px !important;}
    .card-body{padding:11px !important;}
    .card-cat{font-size:9px !important;}
    .card-name{font-size:16px !important;margin-bottom:6px !important;}
    .card-price{font-size:20px !important;}
    .detail-wrap{flex-direction:column !important;gap:16px !important;}
    .detail-img{position:static !important;max-width:none !important;}
    .detail-info{padding:4px 2px 0 !important;}
    .msg-layout{flex-direction:column !important;height:auto !important;min-height:80vh;}
    .msg-sidebar{width:100% !important;border-right:none !important;border-bottom:3px solid #111 !important;max-height:200px;}
    .dash-grid{grid-template-columns:1fr !important;}
    .meas-grid{grid-template-columns:1fr 1fr !important;}
    .form-card{padding:24px 16px !important;}
    .fg4{grid-template-columns:1fr 1fr !important;}
    .fg2{grid-template-columns:1fr !important;}
    .profile-header{flex-direction:column !important;align-items:center !important;text-align:center;}
    /* Auth split stacks: brand banner on top, form below. */
    .auth-split{flex-direction:column !important;}
    .auth-brand{padding:24px !important;gap:18px !important;flex-direction:row !important;flex-wrap:wrap !important;align-items:center !important;justify-content:space-between !important;}
    .auth-brand-props{display:none !important;}
  }
  /* MOBILE — hide the scrolling category ticker strip in the navbar (SAREES ✦
     LEHENGAS ✦ …). The pink marquee banner (S.ticker) below the header and the
     navbar's logo / heart / LOG IN / SIGN UP buttons are intentionally untouched.
     Desktop and iPad (≥769px) keep showing the strip. */
  @media(max-width:768px){
    .nav-category-strip{display:none !important;}
    /* With the category strip (flex:1 spacer) hidden, nothing pushes the
       right-side nav buttons (3 LIVE, WISHLIST, LOG IN, SIGN UP) over, so they
       collapse next to the logo. margin-left:auto sends them back to the
       right edge. Logo stays on the left; marquee/hero/strip untouched.
       LEFTOVER DIVIDER LINES — with the category strip gone, the two vertical
       borders that used to FRAME it sit right next to each other and read as
       stray black divider lines: the logo's right border (S.logoWrap
       borderRight) and the nav buttons' left border (S.hRight borderLeft).
       Hide just those two borders on mobile. Desktop/iPad (≥769px) keep them
       since the strip is still visible there. Borders are only hidden, not
       removed — the inline styles are untouched. */
    .nav-logo{border-right:none !important;}
    .nav-right{margin-left:auto !important;border-left:none !important;}
    /* Restore horizontal scroll on mobile only. The dropdown isn't used here (the
       hamburger opens a full-screen fixed overlay instead), so the overflow-y
       clipping this re-introduces is harmless. */
    .nav-hwrap{overflow-x:auto !important;}
    /* Swap the desktop hover dropdown for the tap hamburger on mobile. */
    .nav-dropdown-wrap{display:none !important;}
    .nav-hamburger{display:flex !important;}
  }
`;

export const S={
  root:{minHeight:"100vh",background:"#fff",color:"#111",fontFamily:"'Barlow',sans-serif"},
  // Frosted-glass sticky header: a near-opaque white with a backdrop blur so
  // content scrolls subtly beneath it. The hairline lift-off shadow is added
  // only once scrolled (see .nav-header.scrolled in CSS).
  header:{background:"rgba(255,255,255,0.82)",backdropFilter:"saturate(180%) blur(12px)",WebkitBackdropFilter:"saturate(180%) blur(12px)",borderBottom:"3px solid #111",position:"sticky",top:0,zIndex:200},
  // overflow is left VISIBLE here so the desktop/iPad profile-icon dropdown (which
  // hangs below this 52px bar via position:absolute) isn't clipped. `overflow-x:auto`
  // would force `overflow-y` to auto too and crop the dropdown to nothing. Horizontal
  // scroll is restored ONLY on mobile (≤768px, via .nav-hwrap in CSS) where the menu is
  // the full-screen hamburger overlay, not the clipped dropdown.
  hWrap:{maxWidth:"100%",padding:"0 10px",display:"flex",alignItems:"stretch",height:52,overflowX:"visible",WebkitOverflowScrolling:"touch"},
  logoWrap:{display:"flex",alignItems:"center",gap:2,cursor:"pointer",paddingRight:10,borderRight:"2px solid #111",flexShrink:0},
  logoText:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:2},
  logoTM:{fontSize:10,color:"#FF1493",alignSelf:"flex-start",marginTop:6},
  hMid:{flex:1,overflow:"hidden",display:"flex",alignItems:"center",paddingLeft:10,minWidth:0},
  marqueeTrack:{overflow:"hidden",width:"100%"},
  marqueeInner:{display:"inline-block",whiteSpace:"nowrap",fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:700,letterSpacing:2,color:"#bbb",animation:"marquee 30s linear infinite"},
  hRight:{display:"flex",alignItems:"center",gap:5,paddingLeft:10,borderLeft:"2px solid #111",flexShrink:0},
  hLive:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:700,letterSpacing:1,color:"#FF1493",whiteSpace:"nowrap"},
  hBtn:{background:"#111",color:"#fff",border:"2px solid #111",borderRadius:0,padding:"5px 8px",fontSize:9,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1,whiteSpace:"nowrap"},
  // Square profile/hamburger icon button: white bg, #111 2px border, no radius.
  navIconBtn:{background:"#fff",color:"#111",border:"2px solid #111",borderRadius:0,padding:"4px 7px",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  // Wrapper for the desktop hover dropdown — relative anchor so the panel hangs
  // directly below the icon with no gap (keeps hover continuous on mouse move).
  navDropWrap:{position:"relative",display:"flex",alignItems:"center"},
  // Desktop account dropdown. Capped to the viewport height with its own scroll
  // so every section stays reachable on short screens (mobile uses mobileNav*).
  navDropdown:{position:"absolute",top:"100%",right:0,minWidth:210,background:"#fff",border:"2px solid #111",borderRadius:0,zIndex:250,display:"flex",flexDirection:"column",boxShadow:"0 8px 30px rgba(0,0,0,0.15)",paddingBottom:4,maxHeight:"calc(100vh - 80px)",overflowY:"auto"},
  // Condensed rows (32px) so the full menu fits without scrolling on most
  // screens; section labels above each group are purely decorative (#999 Barlow
  // Condensed) and groups are separated by a subtle 1px #eee divider rather than
  // the heavy 2px #111 chrome used elsewhere.
  navDropItem:{background:"#fff",border:"none",textAlign:"left",minHeight:32,padding:"0 16px",fontSize:13,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:1.5,color:"#111",whiteSpace:"nowrap",textTransform:"uppercase",display:"flex",alignItems:"center"},
  navDropItemDanger:{color:"#FF0000",fontWeight:900},
  navDropSectionLabel:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:800,letterSpacing:1.5,color:"#999",textTransform:"uppercase",padding:"7px 16px 2px",userSelect:"none"},
  navDropDivider:{height:1,background:"#eee",border:"none",margin:0},
  // Mobile full-width menu overlay.
  mobileNav:{position:"fixed",top:0,left:0,right:0,bottom:0,width:"100%",background:"#fff",zIndex:600,display:"flex",flexDirection:"column",overflowY:"auto"},
  mobileNavHead:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",borderBottom:"2px solid #111"},
  mobileNavTitle:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:2,textTransform:"uppercase"},
  mobileNavClose:{background:"none",border:"none",cursor:"pointer",color:"#111",display:"flex",alignItems:"center",padding:4},
  mobileNavItem:{background:"#fff",border:"none",textAlign:"left",minHeight:52,padding:"0 20px",fontSize:18,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,color:"#111",textTransform:"uppercase",display:"flex",alignItems:"center"},
  // Mobile equivalents — larger labels for readability and the same subtle 1px
  // #eee divider between groups.
  mobileNavSectionLabel:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:800,letterSpacing:2,color:"#999",textTransform:"uppercase",padding:"16px 20px 6px",userSelect:"none"},
  mobileNavDivider:{height:1,background:"#eee",border:"none",margin:0},
  // Refined brand ticker — a slimmer, calmer strip: shorter, lighter weight,
  // wider tracking, slightly translucent type and a slower scroll so it reads as
  // a tasteful detail rather than a loud banner.
  ticker:{background:"#FF1493",overflow:"hidden",borderBottom:"2px solid #111",height:28,display:"flex",alignItems:"center"},
  tickerInner:{display:"inline-block",whiteSpace:"nowrap",fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:700,letterSpacing:3.5,color:"rgba(255,255,255,0.92)",animation:"ticker 36s linear infinite",paddingLeft:"100%"},
  toast:{position:"fixed",bottom:32,left:"50%",transform:"translateX(-50%)",background:"#111",color:"#fff",padding:"13px 26px",borderLeft:"4px solid #FF1493",fontSize:14,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:3,zIndex:999,borderRadius:0,whiteSpace:"nowrap",boxShadow:"0 10px 34px rgba(0,0,0,0.28)"},
  // Type-led editorial hero: a single, centred column (no imagery). Bold stacked
  // headline + brand statement + CTAs + a value-prop strip.
  hero:{borderBottom:"3px solid #111",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",minHeight:"68vh",padding:"64px 24px",overflow:"hidden"},
  heroLeft:{maxWidth:780,display:"flex",flexDirection:"column",alignItems:"center"},
  heroTag:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:5,color:"#FF1493",marginBottom:20},
  heroH:{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:24},
  heroLine1:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(52px,10vw,140px)",fontWeight:900,lineHeight:.9,letterSpacing:-2,color:"#111"},
  heroLine2:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(52px,10vw,140px)",fontWeight:900,lineHeight:.9,letterSpacing:-2,color:"#FF1493"},
  heroLine3:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(52px,10vw,140px)",fontWeight:900,lineHeight:.9,letterSpacing:-2,color:"#fff",WebkitTextStroke:"2px #111"},
  heroSub:{fontSize:17,color:"#555",lineHeight:1.6,maxWidth:460,margin:"0 auto 32px",fontFamily:"'Barlow',sans-serif"},
  heroCtas:{display:"flex",gap:14,flexWrap:"wrap",justifyContent:"center"},
  // Editorial value-prop strip beneath the CTAs (replaces the old hero imagery).
  heroProps:{display:"flex",flexWrap:"wrap",justifyContent:"center",alignItems:"center",gap:"10px 22px",marginTop:40,paddingTop:26,borderTop:"2px solid #111",maxWidth:680},
  heroProp:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:2,color:"#111",textTransform:"uppercase",display:"inline-flex",alignItems:"center",gap:8},
  heroPropDot:{width:7,height:7,borderRadius:"50%",flexShrink:0},
  heroBtnPrimary:{background:"#FF1493",color:"#fff",border:"2px solid #FF1493",padding:"14px 32px",fontSize:14,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:3,borderRadius:0},
  heroBtnSecondary:{background:"#fff",color:"#111",border:"2px solid #111",padding:"14px 32px",fontSize:14,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:3,borderRadius:0},
  heroRight:{flex:1,position:"relative",background:"#fafafa",minHeight:300,overflow:"hidden"},
  // Rendered position:relative in Shop.js so the suggestions dropdown anchors to it
  // and the row sits in normal document flow above the grid. No top offset here — a
  // leftover `top:52` would shift a relative element 52px down and overlap the grid.
  searchBar:{borderBottom:"2px solid #111",background:"#fff",position:"relative",zIndex:100},
  // FULL-WIDTH control row: the search field grows to fill the LEFT
  // (`searchBox` flex:1) so it spans most of the row, and the FILTERS / FIT /
  // TAILORS buttons sit together on the FAR RIGHT (each `flexShrink:0`). The row
  // spans edge-to-edge (`width:100%`, no centered max-width cluster). `flexWrap`
  // lets the buttons drop to a clean second line on narrow/mobile widths instead
  // of overflowing. The buttons are sized snugly to their content (`padding:0 12px`)
  // and share the search field's height (34) so they read as tidy, proportionate
  // buttons rather than oversized boxes, all vertically centred (`alignItems:center`).
  searchInner:{display:"flex",flexWrap:"wrap",alignItems:"center",gap:8,width:"100%",padding:"4px 10px"},
  searchBox:{flex:"1 1 240px",minWidth:0,height:30,display:"flex",alignItems:"center",border:"1px solid #111",borderRadius:0,background:"#fff"},
  searchIcon:{padding:"0 10px",fontSize:13,color:"#bbb",flexShrink:0,display:"flex",alignItems:"center"},
  searchInput:{flex:1,border:"none",outline:"none",fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,letterSpacing:1,color:"#111",padding:"0",background:"transparent",minWidth:0},
  searchClear:{background:"none",border:"none",padding:"0 10px",cursor:"pointer",fontSize:12,color:"#bbb",fontWeight:700,flexShrink:0,display:"flex",alignItems:"center"},
  filterPanel:{padding:"16px 16px",borderTop:"1px solid #f0f0f0",display:"flex",flexDirection:"column",gap:16},
  filterBtn:{background:"#fff",border:"1px solid #111",borderRadius:0,padding:"0 12px",height:30,fontSize:10,flexShrink:0,letterSpacing:1.5,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,whiteSpace:"nowrap",display:"flex",alignItems:"center",justifyContent:"center"},
  filterGroup:{display:"flex",flexDirection:"column",gap:10},
  filterLabel:{fontSize:10,fontWeight:900,letterSpacing:3,color:"#999",fontFamily:"'Barlow Condensed',sans-serif"},
  filterPills:{display:"flex",flexWrap:"wrap",gap:6},
  pill:{background:"#fff",border:"1.5px solid #e0e0e0",padding:"6px 14px",fontSize:11,cursor:"pointer",color:"#888",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:1.5,whiteSpace:"nowrap",borderRadius:0,flexShrink:0},
  pillOn:{background:"#111",border:"1.5px solid #111",color:"#fff"},
  gridWrap:{padding:"24px 18px",maxWidth:1300,margin:"0 auto",background:"#fff"},
  loadingWrap:{display:"flex",flexDirection:"column",alignItems:"center",padding:"80px 0",gap:16},
  // Two-tone brand spinner: a pink + teal arc spinning on a light track.
  spinner:{width:38,height:38,border:"3px solid #f0f0f0",borderTopColor:"#FF1493",borderRightColor:"#00E5CC",borderRadius:"50%",animation:"spin 0.7s linear infinite"},
  loadingText:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:3,color:"#bbb"},
  errorBanner:{background:"#fff0f0",border:"2px solid #FF1493",padding:"16px 24px",marginBottom:24,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:1,display:"flex",alignItems:"center",gap:16},
  retryBtn:{background:"#FF1493",color:"#fff",border:"none",padding:"6px 16px",fontSize:12,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2},
  grid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:16},
  // Uniform card: flex column at full row height so every card in a row ends flush.
  // Border is a fixed 2px solid #111 for ALL cards (no per-category coloured border) —
  // the category accent now lives only on the label, price and bottom accentBar.
  card:{background:"#fff",border:"2px solid #111",overflow:"hidden",cursor:"pointer",borderRadius:0,position:"relative",display:"flex",flexDirection:"column",height:"100%"},
  // Fixed image zone height across every card so the picture areas line up; flexShrink:0
  // keeps it from compressing inside the flex column. Image uses objectFit:cover (see Thumb).
  cardTop:{height:240,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",flexShrink:0},
  cardEmoji:{fontSize:80,filter:"drop-shadow(0 6px 16px rgba(0,0,0,0.2))",position:"relative",zIndex:2},
  cardOrigin:{position:"absolute",top:12,left:12,background:"rgba(0,0,0,0.5)",color:"#fff",padding:"3px 10px",fontSize:10,fontWeight:800,letterSpacing:2,fontFamily:"'Barlow Condensed',sans-serif",backdropFilter:"blur(4px)",zIndex:3},
  soldVeil:{position:"absolute",inset:0,background:"rgba(255,255,255,0.75)",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(2px)",zIndex:4},
  soldStamp:{fontSize:22,fontWeight:900,letterSpacing:6,color:"#111",border:"3px solid #111",padding:"6px 18px",fontFamily:"'Barlow Condensed',sans-serif"},
  reservedBadge:{position:"absolute",top:12,right:12,background:"#FF9500",color:"#fff",padding:"3px 10px",fontSize:10,fontWeight:800,letterSpacing:1.5,fontFamily:"'Barlow Condensed',sans-serif",zIndex:3},
  // PRICE DROP badge — teal fill, dark ink + 2px dark border, square corners. Sits in the
  // top-right of the card image, offset left of the 32px heart button so the two never overlap.
  priceDropBadge:{position:"absolute",top:12,right:52,background:"#00E5CC",color:"#111",border:"2px solid #111",borderRadius:0,padding:"3px 8px",fontSize:10,fontWeight:800,letterSpacing:1.5,fontFamily:"'Barlow Condensed',sans-serif",zIndex:4},
  // Original (pre-drop) price shown struck through in grey beside the live price on cards.
  cardPrevPrice:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,color:"#999",textDecoration:"line-through",letterSpacing:-0.3},
  // Flex column so the price row (cardFoot) can pin to the bottom via marginTop:auto,
  // keeping prices aligned across cards with different title/tag lengths. Even 16px padding.
  cardBody:{padding:16,display:"flex",flexDirection:"column",flex:1},
  cardCatLabel:{fontSize:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,marginBottom:4},
  cardName:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,color:"#111",marginBottom:10,lineHeight:1.15,letterSpacing:0.5},
  occRow:{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10},
  occChip:{borderRadius:0,padding:"2px 8px",fontSize:10,fontWeight:800,letterSpacing:1.5,fontFamily:"'Barlow Condensed',sans-serif"},
  measRow:{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12},
  mTag:{background:"#f5f5f5",color:"#555",border:"1px solid #e0e0e0",padding:"3px 8px",fontSize:10,fontWeight:700,letterSpacing:.5,fontFamily:"'Barlow Condensed',sans-serif"},
  mTagG:{background:"#34C75922",color:"#34C759",borderColor:"#34C75966"},
  mTagA:{background:"#FF950022",color:"#FF9500",borderColor:"#FF950066"},
  cardFoot:{display:"flex",alignItems:"center",justifyContent:"space-between",borderTop:"2px solid #f5f5f5",paddingTop:12,marginTop:"auto"},
  cardPrice:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900,letterSpacing:-0.5},
  accentBar:{height:4,width:"100%"},
  empty:{gridColumn:"1/-1",textAlign:"center",padding:"80px 20px",display:"flex",flexDirection:"column",alignItems:"center"},
  emptyIcon:{width:88,height:88,border:"3px solid #111",borderRadius:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#111"},
  emptySub:{fontFamily:"'Barlow',sans-serif",fontSize:15,color:"#999",lineHeight:1.55,maxWidth:380,margin:"0 0 24px"},
  main:{maxWidth:1200,margin:"0 auto",padding:"20px 12px"},
  back:{background:"none",border:"none",color:"#999",fontSize:12,cursor:"pointer",marginBottom:32,padding:0,fontWeight:800,letterSpacing:2,fontFamily:"'Barlow Condensed',sans-serif",textTransform:"uppercase"},
  // Product-page layout: image card (left) sits next to the details (right) and
  // sticks while the long details column scrolls. align-items:flex-start stops
  // the image stretching to the details' height (which made it a thin strip).
  detailWrap:{display:"flex",flexWrap:"wrap",alignItems:"flex-start",gap:24},
  detailImgWrap:{flex:"1 1 420px",maxWidth:560,position:"sticky",top:68,alignSelf:"flex-start",display:"flex",flexDirection:"column",border:"3px solid #111",background:"#fff"},
  // Defined portrait ratio so the photo is a proper product image, not stretched.
  detailPanel:{width:"100%",aspectRatio:"4 / 5",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"},
  thumbRow:{display:"flex",gap:0,borderTop:"3px solid #111",overflowX:"auto"},
  thumb:{width:70,height:70,flexShrink:0,cursor:"pointer",border:"2px solid transparent",overflow:"hidden",transition:"border-color .15s"},
  imgNav:{position:"absolute",top:"50%",transform:"translateY(-50%)",background:"rgba(0,0,0,0.5)",color:"#fff",border:"none",width:36,height:36,fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:5,fontWeight:900},
  detailInfo:{flex:"1 1 380px",minWidth:"min(300px,100%)",padding:"2px 0 0"},
  detailName:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:44,fontWeight:900,color:"#111",lineHeight:1,marginBottom:10,letterSpacing:-1},
  detailPrice:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:56,fontWeight:900,marginBottom:16,letterSpacing:-2},
  dBlock:{marginBottom:24,paddingBottom:24,borderBottom:"1px solid #f0f0f0"},
  dBlockTitle:{fontSize:11,fontWeight:900,letterSpacing:3,borderLeft:"4px solid",paddingLeft:10,marginBottom:12,fontFamily:"'Barlow Condensed',sans-serif"},
  measBoxRow:{display:"flex",flexWrap:"wrap",gap:10,marginBottom:12},
  measBox:{border:"2px solid",padding:"12px 18px",textAlign:"center",minWidth:72},
  measVal:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900},
  measLbl:{fontSize:9,color:"#999",letterSpacing:2,fontWeight:800,fontFamily:"'Barlow Condensed',sans-serif",marginTop:2},
  measNote:{fontSize:13,color:"#888",marginBottom:12},
  alterRow:{display:"flex",flexWrap:"wrap",gap:8},
  alterBadge:{padding:"7px 14px",fontSize:11,fontWeight:800,letterSpacing:1,border:"1.5px solid",fontFamily:"'Barlow Condensed',sans-serif"},
  aY:{background:"#34C75922",color:"#34C759",borderColor:"#34C75966"},
  aY2:{background:"#FF950022",color:"#FF9500",borderColor:"#FF950066"},
  aN:{background:"#f5f5f5",color:"#ccc",borderColor:"#eee"},
  detailDesc:{fontSize:15,color:"#666",lineHeight:1.7,marginBottom:24},
  waCta:{color:"#fff",padding:"14px 26px",fontSize:14,fontWeight:800,letterSpacing:2,fontFamily:"'Barlow Condensed',sans-serif",marginBottom:24,border:"none",cursor:"pointer"},
  actRow:{display:"flex",gap:10,flexWrap:"wrap"},
  actBtn:{border:"none",padding:"12px 22px",fontSize:12,cursor:"pointer",fontWeight:800,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1.5,color:"#fff"},
  profileHeader:{display:"flex",alignItems:"flex-start",gap:28,marginBottom:36,paddingBottom:32,borderBottom:"3px solid #111",flexWrap:"wrap"},
  profileAvatarWrap:{width:110,height:110,borderRadius:"50%",border:"3px solid #111",overflow:"hidden",flexShrink:0,background:"#FF1493",display:"flex",alignItems:"center",justifyContent:"center"},
  profileAvatar:{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed',sans-serif",fontSize:48,fontWeight:900,color:"#fff"},
  profileName:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:40,fontWeight:900,letterSpacing:-1,marginBottom:4,lineHeight:1},
  profileMeta:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,letterSpacing:2,color:"#bbb"},
  avatarUploadCircle:{width:100,height:100,borderRadius:"50%",border:"3px solid #111",overflow:"hidden",cursor:"pointer",position:"relative",flexShrink:0,background:"#FF1493",display:"flex",alignItems:"center",justifyContent:"center"},
  avatarInitials:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:40,fontWeight:900,color:"#fff"},
  avatarEditOverlay:{position:"absolute",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,opacity:0,transition:"opacity .15s"},
  dashHeader:{display:"flex",flexWrap:"wrap",alignItems:"flex-start",justifyContent:"space-between",gap:24,marginBottom:40,paddingBottom:32,borderBottom:"3px solid #111"},
  dashStats:{display:"flex",gap:10,flexWrap:"wrap"},
  dashStat:{background:"#fff",border:"2px solid #111",padding:"16px 18px",textAlign:"center",minWidth:84},
  dashStatNum:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:32,fontWeight:900,lineHeight:1},
  dashStatLabel:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,fontWeight:800,letterSpacing:2,color:"#999",marginTop:5},
  dashGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:3},
  dashCard:{background:"#fff",border:"3px solid",overflow:"hidden",display:"flex"},
  dashCardImg:{width:120,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"},
  dashCardBody:{flex:1,padding:"14px"},
  dashBtn:{border:"none",padding:"6px 10px",fontSize:10,cursor:"pointer",fontWeight:800,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1},
  formCard:{border:"3px solid #111",padding:"clamp(20px,5vw,48px) clamp(16px,5vw,44px)",background:"#fff"},
  formHero:{borderBottom:"3px solid #111",paddingBottom:32,marginBottom:36},
  formTitle:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:64,fontWeight:900,lineHeight:.95,letterSpacing:-1,marginBottom:10,whiteSpace:"pre-line"},
  formSub:{fontSize:15,color:"#888"},
  fg2:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14},
  fg4:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12},
  inp:{background:"#fff",border:"2px solid #e0e0e0",borderRadius:0,padding:"12px 14px",fontSize:14,color:"#111",fontFamily:"'Barlow',sans-serif",width:"100%",transition:"all .15s"},
  occGrid:{display:"flex",flexWrap:"wrap",gap:6},
  occToggle:{padding:"7px 16px",fontSize:11,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1.5,cursor:"pointer",transition:"all .14s",borderRadius:0},
  multiUploadGrid:{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:8},
  uploadThumb:{position:"relative",aspectRatio:"1",border:"2px solid #e0e0e0",overflow:"hidden"},
  uploadZone:{aspectRatio:"1",border:"3px dashed #e0e0e0",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",position:"relative"},
  uploadPlaceholder:{textAlign:"center",pointerEvents:"none"},
  uploadIcon:{fontSize:24,marginBottom:4},
  uploadText:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:800,letterSpacing:1.5,color:"#bbb"},
  removeImg:{position:"absolute",top:4,right:4,background:"#111",color:"#fff",border:"none",padding:"2px 6px",fontSize:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,cursor:"pointer",zIndex:2},
  mainImgBadge:{position:"absolute",bottom:4,left:4,background:"#FF1493",color:"#fff",padding:"2px 6px",fontSize:9,fontWeight:800,letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif"},
  toggleStack:{display:"flex",flexDirection:"column",marginTop:16},
  googleBtn:{display:"flex",alignItems:"center",justifyContent:"center",gap:12,border:"2px solid #111",padding:"14px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:13,letterSpacing:2,color:"#111",textDecoration:"none",marginBottom:20,cursor:"pointer"},
  divider:{display:"flex",alignItems:"center",gap:12,marginBottom:20},
  dividerText:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:800,letterSpacing:3,color:"#ccc"},
  aError:{background:"#fff0f0",border:"1.5px solid #FF1493",padding:"10px 14px",fontSize:13,color:"#FF1493",fontWeight:600},
  authSwitch:{textAlign:"center",marginTop:20,fontSize:13,color:"#888"},
  authSwitchLink:{color:"#FF1493",fontWeight:800,cursor:"pointer",textDecoration:"underline"},
  // Split-screen auth: a black brand panel beside the form, framed as one block.
  authMain:{maxWidth:960,margin:"0 auto",padding:"20px 12px"},
  authSplit:{display:"flex",border:"3px solid #111",background:"#fff",overflow:"hidden"},
  authBrand:{flex:"1 1 44%",background:"#111",color:"#fff",padding:"clamp(28px,4vw,48px)",display:"flex",flexDirection:"column",justifyContent:"space-between",gap:32,minWidth:0},
  authBrandWord:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(40px,5vw,62px)",fontWeight:900,letterSpacing:1,lineHeight:.92},
  authBrandTag:{fontFamily:"'Barlow',sans-serif",fontSize:15,color:"rgba(255,255,255,0.72)",lineHeight:1.65,marginTop:14},
  authBrandProps:{display:"flex",flexDirection:"column",gap:14},
  authBrandProp:{display:"flex",alignItems:"center",gap:11,fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",color:"#fff"},
  authBrandDot:{width:8,height:8,borderRadius:"50%",flexShrink:0},
  authFormCol:{flex:"1 1 56%",padding:"clamp(24px,4vw,44px)",minWidth:0,display:"flex",flexDirection:"column",justifyContent:"center"},
  wishBadge:{position:"absolute",top:-6,right:-6,background:"#FF1493",color:"#fff",borderRadius:"50%",width:18,height:18,fontSize:10,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed',sans-serif"},
  notifPanel:{position:"fixed",top:96,right:16,width:360,background:"#fff",border:"3px solid #111",zIndex:300,boxShadow:"0 8px 40px rgba(0,0,0,0.15)",maxHeight:500,display:"flex",flexDirection:"column"},
  notifHeader:{padding:"14px 16px",borderBottom:"2px solid #111",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#fafafa"},
  notifItem:{padding:"14px 16px",borderBottom:"1px solid #f5f5f5",cursor:"pointer",transition:"background .15s"},
  heartBtn:{position:"absolute",top:12,right:12,background:"rgba(255,255,255,0.85)",border:"none",borderRadius:"50%",width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,zIndex:5,transition:"all .15s"},
  modalOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:24},
  modalBox:{background:"#fff",border:"3px solid #111",padding:32,maxWidth:640,width:"100%",maxHeight:"85vh",overflowY:"auto"},
  verifiedBadge:{background:"#34C759",color:"#fff",fontSize:11,fontWeight:800,letterSpacing:1,padding:"2px 8px",fontFamily:"'Barlow Condensed',sans-serif",verticalAlign:"middle",marginLeft:8},
  fitsBadge:{position:"absolute",bottom:12,left:12,background:"#34C759",color:"#fff",padding:"3px 10px",fontSize:10,fontWeight:800,letterSpacing:1.5,fontFamily:"'Barlow Condensed',sans-serif",zIndex:3},
  fastBadge:{position:"absolute",bottom:12,left:12,background:"#007AFF",color:"#fff",padding:"3px 10px",fontSize:10,fontWeight:800,letterSpacing:1.5,fontFamily:"'Barlow Condensed',sans-serif",zIndex:3},
  reviewCard:{background:"#fafafa",border:"1.5px solid #f0f0f0",padding:"14px 16px"},
  msgLayout:{display:"flex",border:"3px solid #111",height:"70vh",overflow:"hidden",background:"#fff",boxShadow:"0 14px 44px rgba(17,17,17,0.1)"},
  msgSidebar:{width:300,flexShrink:0,borderRight:"3px solid #111",display:"flex",flexDirection:"column",overflow:"hidden",background:"#fff"},
  msgSidebarHead:{padding:"16px 20px",borderBottom:"3px solid #111",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#111"},
  convItem:{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:"1px solid #f3f3f3",cursor:"pointer",transition:"background .15s,border-color .15s"},
  convAvatar:{width:42,height:42,borderRadius:"50%",background:"linear-gradient(135deg,#FF1493,#00E5CC)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden",border:"2px solid #111"},
  msgMain:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"},
  chatHeader:{padding:"14px 20px",borderBottom:"3px solid #111",display:"flex",alignItems:"center",gap:12,background:"#fafafa"},
  chatMessages:{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column",background:"#fcfcfc",backgroundImage:"radial-gradient(rgba(17,17,17,0.05) 1px, transparent 1px)",backgroundSize:"18px 18px"},
  chatListingPreview:{display:"inline-flex",alignItems:"center",gap:12,border:"2px solid #f0f0f0",padding:"10px 14px",cursor:"pointer",marginTop:12,background:"#fafafa"},
  msgBubble:{padding:"11px 15px",maxWidth:"72%",boxShadow:"0 2px 8px rgba(17,17,17,0.07)"},
  chatInput:{display:"flex",borderTop:"3px solid #111",background:"#fff"},
  offerBar:{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",borderTop:"1px solid #f5f5f5",flexWrap:"wrap",background:"#fafafa"},
  offerCard:{background:"#fff",padding:"14px 16px",borderRadius:0,boxShadow:"0 3px 12px rgba(17,17,17,0.08)"},
  offerStatusBadge:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,fontWeight:800,letterSpacing:1.5,color:"#fff",padding:"2px 8px",borderRadius:0},
  // SHOPPING BAG — small count badge on the navbar bag icon. Pink circle, white
  // number, 2px #111 border so it reads clearly against the white icon button.
  bagBadge:{position:"absolute",top:-6,right:-6,background:"#FF1493",color:"#fff",border:"2px solid #111",borderRadius:"50%",minWidth:20,height:20,padding:"0 4px",fontSize:11,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed',sans-serif",lineHeight:1},
  // ADD TO BAG button on the Detail page. Full width, pink, white uppercase
  // Barlow Condensed, 2px #111 border, no radius. Background/colour are overridden
  // inline for the ADDED (black) and SOLD (grey) states.
  bagAddBtn:{width:"100%",background:"#FF1493",color:"#fff",border:"2px solid #111",borderRadius:0,padding:"16px",fontSize:17,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:3,textTransform:"uppercase",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:16},
  // BUYER GUARANTEE BANNER (Detail page) — trust signal below ADD TO BAG.
  // Square 2px #111 frame, white fill, Barlow Condensed throughout.
  guaranteeBanner:{border:"2px solid #111",borderRadius:0,background:"#fff",padding:"16px 18px",marginBottom:16},
  // Sticky buy bar — slides up from the bottom once the inline ADD TO BAG button
  // scrolls out of view (see .detail-buybar CSS + the IntersectionObserver in Detail).
  buyBar:{position:"fixed",left:0,right:0,bottom:0,zIndex:300,background:"rgba(255,255,255,0.9)",backdropFilter:"saturate(180%) blur(12px)",WebkitBackdropFilter:"saturate(180%) blur(12px)",borderTop:"3px solid #111",padding:"10px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,boxShadow:"0 -8px 30px rgba(0,0,0,0.10)"},
  buyBarInfo:{display:"flex",alignItems:"center",gap:12,minWidth:0},
  buyBarThumb:{width:46,height:54,border:"2px solid #111",overflow:"hidden",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,background:"#fafafa"},
  buyBarName:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:800,color:"#111",letterSpacing:0.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"42vw",margin:0,lineHeight:1.15},
  buyBarPrice:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:21,fontWeight:900,letterSpacing:-0.5,margin:0,lineHeight:1.1},
  buyBarBtn:{background:"#FF1493",color:"#fff",border:"2px solid #111",borderRadius:0,padding:"13px 28px",fontSize:15,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2.5,textTransform:"uppercase",display:"inline-flex",alignItems:"center",gap:8,flexShrink:0,whiteSpace:"nowrap"},
  guaranteeHeading:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900,letterSpacing:2,color:"#FF1493",textTransform:"uppercase",marginBottom:12},
  guaranteeList:{display:"flex",flexDirection:"column",gap:9},
  guaranteePoint:{display:"flex",alignItems:"center",gap:10,fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,letterSpacing:0.5,color:"#111",lineHeight:1.2},
  // Compact guarantee line below PROCEED TO CHECKOUT in the bag panel.
  bagGuarantee:{display:"flex",alignItems:"center",justifyContent:"center",gap:7,marginTop:14,fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,letterSpacing:1,color:"#111"},
  // Slide-in bag panel — dim backdrop pinned to the right edge of the screen.
  bagOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:600,display:"flex",justifyContent:"flex-end"},
  bagPanel:{width:"min(420px,100%)",height:"100%",background:"#fff",borderLeft:"2px solid #111",display:"flex",flexDirection:"column",overflowY:"auto"},
  bagHead:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:"2px solid #111",position:"sticky",top:0,background:"#fff",zIndex:2},
  bagTitle:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:900,letterSpacing:2,textTransform:"uppercase",display:"flex",alignItems:"center",gap:10},
  bagClose:{background:"none",border:"none",cursor:"pointer",color:"#111",display:"flex",alignItems:"center",padding:4},
  bagBody:{flex:1,display:"flex",flexDirection:"column",padding:"16px 20px"},
  bagRow:{display:"flex",alignItems:"center",gap:12,padding:"14px 0",borderBottom:"1px solid #f0f0f0"},
  bagThumb:{width:64,height:64,flexShrink:0,border:"2px solid #111",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",background:"#fafafa"},
  bagItemName:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,color:"#111",lineHeight:1.1,letterSpacing:0.5},
  bagItemSeller:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:700,letterSpacing:1.5,color:"#bbb",marginTop:2,textTransform:"uppercase"},
  bagItemPrice:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:900,color:"#111",marginTop:4,letterSpacing:-0.5},
  bagRemove:{background:"none",border:"none",cursor:"pointer",color:"#111",display:"flex",alignItems:"center",alignSelf:"flex-start",padding:4,flexShrink:0},
  bagDivider:{borderBottom:"2px solid #111",margin:"16px 0"},
  bagTotalRow:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20},
  bagTotalLabel:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:800,letterSpacing:3,color:"#111",textTransform:"uppercase"},
  bagTotalVal:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:30,fontWeight:900,color:"#111",letterSpacing:-1},
  bagCheckoutBtn:{width:"100%",background:"#111",color:"#fff",border:"2px solid #111",borderRadius:0,padding:"16px",fontSize:16,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:3,textTransform:"uppercase"},
  bagContinue:{background:"none",border:"none",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:2,color:"#111",textTransform:"uppercase",textDecoration:"underline",marginTop:16,alignSelf:"center"},
  bagEmpty:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",gap:20,padding:"40px 0"},
  bagEmptyText:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:2,color:"#111",textTransform:"uppercase"},
  bagBrowseBtn:{background:"#FF1493",color:"#fff",border:"2px solid #111",borderRadius:0,padding:"14px 28px",fontSize:14,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2,textTransform:"uppercase"},
};
