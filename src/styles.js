export const CSS=`
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,700;0,800;0,900;1,800&family=Barlow:wght@400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{background:#fff;}
  .scard{transition:transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s !important;cursor:pointer;}
  .scard:hover{transform:translateY(-8px) rotate(-0.5deg) !important;box-shadow:0 24px 60px rgba(0,0,0,0.13) !important;}
  .hbtn{transition:all .14s ease !important;}
  .hbtn:hover{transform:scale(0.96) !important;filter:brightness(0.9) !important;}
  /* Desktop nav dropdown items turn pink on hover; the LOG OUT item keeps its red. */
  .nav-drop-item:hover{color:#FF1493 !important;}
  .nav-drop-item-danger:hover{color:#FF0000 !important;}
  /* Mobile menu rows go pink on tap. */
  .nav-mob-item:active{color:#FF1493 !important;background:#fff5fa !important;}
  /* Footer links (T&Cs, Privacy, Returns, Contact) turn pink on hover. */
  .footer-link:hover{color:#FF1493 !important;}
  /* The hamburger is mobile-only; the profile-icon dropdown is desktop/iPad-only. */
  .nav-hamburger{display:none !important;}
  .fpill{transition:all .14s !important;}
  .fpill:hover{background:#111 !important;color:#fff !important;}
  @keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
  @keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
  @keyframes floatbob{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-14px) rotate(5deg)}}
  @keyframes spin{to{transform:rotate(360deg)}}
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
    .hero-section{flex-direction:row !important;min-height:0 !important;}
    /* Split the hero text 58% / bubbles 42% on mobile so the writing column has
       more room while the overlapping cluster can still stagger without clipping. */
    .hero-left{flex:0 0 58% !important;padding:24px 14px !important;}
    /* The bubble column is the POSITIONING CONTEXT for the absolutely-placed bubbles
       (position:relative + overflow:hidden are inherited from the inline heroRight
       style). A min-height guarantees a tall-enough canvas for the cluster even when
       the heading text is short, and overflow:hidden clips any float-animation
       overshoot so there is never horizontal page scroll. */
    .hero-right{flex:0 0 42% !important;padding:0 !important;min-height:360px !important;}
    /* OVERLAPPING FLOATING CLUSTER (mobile): bubbles stay position:absolute (from the
       inline style) and we override only top/left/size per bubble with !important.
       Sizes are VARIED (74–96px). Crucially, sizes are
       fixed px while left is a PERCENTAGE of the column width: the column is narrowest
       on the smallest phone (~40% of 320px ≈ 128px), so designing the fit there
       guarantees every wider phone has MORE room — no bubble can be clipped or cut off
       by the right edge, and there is no horizontal overflow. The right-edge fit holds
       even at the larger sizes: left bubbles sit at ~2–3% (≈4px) so a 96px bubble ends
       near 100px (well inside 128px), and right bubbles sit at ~36–37% (≈47px) so a
       76px bubble ends near 123px (still inside 128px). Bubbles alternate
       left/right and step down ~14% each, so they overlap vertically for the staggered
       floating look while every right edge stays well inside the column. The inline
       'floatbob' animation (which animates transform) is left untouched, so they keep
       bobbing exactly like the desktop hero. */
    .hero-bubble{border-width:3px !important;box-shadow:0 6px 22px rgba(0,0,0,0.16) !important;}
    .hero-bubble:nth-child(1){top:1%  !important;left:3%  !important;width:96px !important;height:96px !important;}
    .hero-bubble:nth-child(2){top:15% !important;left:36% !important;width:76px !important;height:76px !important;}
    .hero-bubble:nth-child(3){top:30% !important;left:3%  !important;width:94px !important;height:94px !important;}
    .hero-bubble:nth-child(4){top:45% !important;left:36% !important;width:76px !important;height:76px !important;}
    .hero-bubble:nth-child(5){top:59% !important;left:2%  !important;width:94px !important;height:94px !important;}
    .hero-bubble:nth-child(6){top:73% !important;left:37% !important;width:74px !important;height:74px !important;}
    /* PROBLEM 2 — search field full-width on its own line, FILTERS/FIT/TAILORS
       sharing the second line equally and compactly. */
    .search-box{flex:1 1 100% !important;}
    .search-action-btn{flex:1 1 0 !important;min-width:0 !important;}
    /* BROWSE tabs — full width on mobile so ALL LISTINGS / FOLLOWING split the
       row evenly; auto width on desktop (default). */
    .shop-tabs{width:100% !important;}
    .shop-tab{flex:1 1 0 !important;text-align:center !important;padding-left:0 !important;padding-right:0 !important;}
    /* PROBLEM 3 — two-column listing grid with proportionally scaled cards. */
    .shop-grid{grid-template-columns:1fr 1fr !important;gap:8px !important;}
    .card-top{height:150px !important;}
    .card-body{padding:11px !important;}
    .card-cat{font-size:9px !important;}
    .card-name{font-size:16px !important;margin-bottom:6px !important;}
    .card-price{font-size:20px !important;}
    .detail-wrap{flex-direction:column !important;}
    .detail-img{border-right:none !important;border-bottom:3px solid #111 !important;}
    .detail-info{padding:16px !important;}
    .msg-layout{flex-direction:column !important;height:auto !important;min-height:80vh;}
    .msg-sidebar{width:100% !important;border-right:none !important;border-bottom:3px solid #111 !important;max-height:200px;}
    .dash-grid{grid-template-columns:1fr !important;}
    .meas-grid{grid-template-columns:1fr 1fr !important;}
    .form-card{padding:24px 16px !important;}
    .fg4{grid-template-columns:1fr 1fr !important;}
    .fg2{grid-template-columns:1fr !important;}
    .profile-header{flex-direction:column !important;align-items:center !important;text-align:center;}
  }
  /* MOBILE — hide the scrolling category ticker strip in the navbar (SAREES ✦
     LEHENGAS ✦ …). The pink marquee banner (S.ticker) below the header and the
     navbar's logo / heart / LOG IN / SIGN UP buttons are intentionally untouched.
     Desktop and iPad (≥769px) keep showing the strip. */
  @media(max-width:768px){
    .nav-category-strip{display:none !important;}
    /* With the category strip (flex:1 spacer) hidden, nothing pushes the
       right-side nav buttons (3 LIVE, ❤, LOG IN, SIGN UP) over, so they
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
  header:{background:"#fff",borderBottom:"3px solid #111",position:"sticky",top:0,zIndex:200},
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
  ticker:{background:"#FF1493",overflow:"hidden",borderBottom:"2px solid #111",height:36,display:"flex",alignItems:"center"},
  tickerInner:{display:"inline-block",whiteSpace:"nowrap",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:2.5,color:"#fff",animation:"ticker 22s linear infinite",paddingLeft:"100%"},
  toast:{position:"fixed",bottom:32,left:"50%",transform:"translateX(-50%)",background:"#111",color:"#fff",padding:"12px 28px",fontSize:14,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:3,zIndex:999,borderRadius:0,whiteSpace:"nowrap",boxShadow:"0 4px 24px rgba(0,0,0,0.2)"},
  hero:{borderBottom:"3px solid #111",display:"flex",minHeight:"80vh",overflow:"hidden"},
  heroLeft:{flex:"0 0 55%",padding:"40px 32px",borderRight:"3px solid #111",display:"flex",flexDirection:"column",justifyContent:"center"},
  heroTag:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:4,color:"#FF1493",marginBottom:20},
  heroH:{display:"flex",flexDirection:"column",marginBottom:28},
  heroLine1:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(52px,10vw,140px)",fontWeight:900,lineHeight:.9,letterSpacing:-2,color:"#111"},
  heroLine2:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(52px,10vw,140px)",fontWeight:900,lineHeight:.9,letterSpacing:-2,color:"#FF1493"},
  heroLine3:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(52px,10vw,140px)",fontWeight:900,lineHeight:.9,letterSpacing:-2,color:"#fff",WebkitTextStroke:"2px #111"},
  heroSub:{fontSize:16,color:"#555",lineHeight:1.7,maxWidth:440,marginBottom:36},
  heroCtas:{display:"flex",gap:14,flexWrap:"wrap"},
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
  gridWrap:{padding:"20px 10px",maxWidth:1300,margin:"0 auto",background:"#fff"},
  loadingWrap:{display:"flex",flexDirection:"column",alignItems:"center",padding:"80px 0",gap:16},
  spinner:{width:36,height:36,border:"4px solid #f0f0f0",borderTop:"4px solid #FF1493",borderRadius:"50%",animation:"spin 0.8s linear infinite"},
  loadingText:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:3,color:"#bbb"},
  errorBanner:{background:"#fff0f0",border:"2px solid #FF1493",padding:"16px 24px",marginBottom:24,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:1,display:"flex",alignItems:"center",gap:16},
  retryBtn:{background:"#FF1493",color:"#fff",border:"none",padding:"6px 16px",fontSize:12,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2},
  grid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:3},
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
  empty:{gridColumn:"1/-1",textAlign:"center",padding:"80px 20px"},
  main:{maxWidth:1200,margin:"0 auto",padding:"20px 12px"},
  back:{background:"none",border:"none",color:"#999",fontSize:12,cursor:"pointer",marginBottom:32,padding:0,fontWeight:800,letterSpacing:2,fontFamily:"'Barlow Condensed',sans-serif",textTransform:"uppercase"},
  detailWrap:{display:"flex",flexWrap:"wrap",gap:0,border:"3px solid #111"},
  detailImgWrap:{flex:"0 0 300px",minWidth:"min(300px,100%)",display:"flex",flexDirection:"column",borderRight:"3px solid #111"},
  detailPanel:{flex:1,minHeight:320,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"},
  thumbRow:{display:"flex",gap:0,borderTop:"2px solid #111",overflowX:"auto"},
  thumb:{width:70,height:70,flexShrink:0,cursor:"pointer",border:"2px solid transparent",overflow:"hidden",transition:"border-color .15s"},
  imgNav:{position:"absolute",top:"50%",transform:"translateY(-50%)",background:"rgba(0,0,0,0.5)",color:"#fff",border:"none",width:36,height:36,fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:5,fontWeight:900},
  detailInfo:{flex:1,minWidth:"min(280px,100%)",padding:"20px 16px"},
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
  dashStats:{display:"flex",gap:3,flexWrap:"wrap"},
  dashStat:{background:"#fafafa",border:"2px solid #111",padding:"16px 20px",textAlign:"center",minWidth:72},
  dashStatNum:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:32,fontWeight:900,lineHeight:1},
  dashStatLabel:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,fontWeight:800,letterSpacing:2,color:"#bbb",marginTop:4},
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
  msgLayout:{display:"flex",border:"3px solid #111",height:"70vh",overflow:"hidden"},
  msgSidebar:{width:300,flexShrink:0,borderRight:"3px solid #111",display:"flex",flexDirection:"column",overflow:"hidden"},
  msgSidebarHead:{padding:"16px 20px",borderBottom:"2px solid #111",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#fafafa"},
  convItem:{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:"1px solid #f5f5f5",cursor:"pointer",transition:"background .15s"},
  convAvatar:{width:40,height:40,borderRadius:"50%",background:"#FF1493",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden",border:"2px solid #111"},
  msgMain:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"},
  chatHeader:{padding:"14px 20px",borderBottom:"2px solid #111",display:"flex",alignItems:"center",gap:12,background:"#fafafa"},
  chatMessages:{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column"},
  chatListingPreview:{display:"inline-flex",alignItems:"center",gap:12,border:"2px solid #f0f0f0",padding:"10px 14px",cursor:"pointer",marginTop:12,background:"#fafafa"},
  msgBubble:{padding:"10px 14px",maxWidth:"70%"},
  chatInput:{display:"flex",borderTop:"2px solid #111"},
  offerBar:{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",borderTop:"1px solid #f5f5f5",flexWrap:"wrap",background:"#fafafa"},
  offerCard:{background:"#fff",padding:"14px 16px",borderRadius:0},
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
