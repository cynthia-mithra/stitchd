import React from "react";
import {
  CATEGORIES, JEWELLERY_CATS, SHOE_CATS, ALL_CATEGORIES,
  CONDITIONS, SIZES, OCC_COLOR, CARD_COLORS,
  catEmoji, currencySymbol,
} from "../lib/constants";
import { S } from "../styles";

export default function Shop({
  view,
  user, profile, setView, setAuthMode,
  search, setSearch, handleSearchInput,
  searchSuggestions, showSuggestions, setShowSuggestions,
  savedSearches, showSavedSearches, setShowSavedSearches,
  applySearch, saveCurrentSearch, deleteSavedSearch,
  showFilters, setShowFilters, hasFilters, clearFilters,
  typeFilter, setTypeFilter, condFilter, setCondFilter,
  catFilter, setCatFilter, sizeFilter, setSizeFilter,
  minPrice, setMinPrice, maxPrice, setMaxPrice,
  showSizeMatch, setShowSizeMatch,
  loadTailorMarket,
  visible, loading, error, fetchItems,
  openDetail, fitsMe, wishlist, toggleWishlist,
  newListings, priceDrops, trendingItems,
}) {
  if(view!=="shop") return null;
  return (
    <>
      <section style={S.hero} className="hero-section">
        <div style={S.heroLeft} className="hero-left">
          <p style={S.heroTag}>THE MARKETPLACE FOR</p>
          <h1 style={S.heroH}><span style={S.heroLine1}>DESI</span><span style={S.heroLine2}>FITS</span><span style={S.heroLine3}>REHOMED.</span></h1>
          <p style={S.heroSub}>South Asian fashion — sarees, lehengas, sherwanis — with <em>real measurements</em> so you know if it fits before you buy.</p>
          <div style={S.heroCtas}>
            <button className="hbtn" style={S.heroBtnPrimary} onClick={()=>user?setView("add"):(setAuthMode("signup"),setView("auth"))}>LIST YOUR PIECE →</button>
            <button className="hbtn" style={S.heroBtnSecondary} onClick={()=>document.getElementById("grid-anchor")?.scrollIntoView({behavior:"smooth"})}>BROWSE DROPS ↓</button>
          </div>
        </div>
        <div style={S.heroRight} className="hero-right">
          {[
            // Instead of forcing every picture into a fixed-size circle (which cropped heads or
            // left white rings whenever the disc wasn't a perfect square), we size each BUBBLE to
            // match its PICTURE. `size` is the on-screen width; the box height is derived from the
            // PNG's real pixel aspect ratio (`ar` = naturalHeight / naturalWidth) so the box is the
            // exact shape of the image. With objectFit:cover at that matching aspect there is no
            // crop at all — the full figure shows, head-to-hem — and borderRadius:50% rounds the
            // box into a clean disc-shaped bubble that hugs the colored circle with no white gap.
            {img:"/Images/sharara.png",     top:"2%",  left:"5%",  size:170, delay:"0s",   ar:1254/1254},
            {img:"/Images/indo_western.png",top:"30%", left:"55%", size:150, delay:"0.7s", ar:1254/1254},
            {img:"/Images/saree.png",       top:"55%", left:"8%",  size:175, delay:"1.4s", ar:1254/1254},
            {img:"/Images/menswear.png",    top:"8%",  left:"65%", size:130, delay:"2.1s", ar:1254/1254},
            {img:"/Images/lehenga.png",     top:"62%", left:"58%", size:148, delay:"2.8s", ar:1254/1254},
            {img:"/Images/anarkali.png",    top:"28%", left:"2%",  size:135, delay:"3.5s", ar:1254/1254},
          ].map((b,i)=>(
            <div key={i} style={{position:"absolute",top:b.top,left:b.left,width:b.size,height:Math.round(b.size*b.ar),borderRadius:"50%",overflow:"hidden",animation:`floatbob 4s ease-in-out ${b.delay} infinite`,boxShadow:"0 12px 40px rgba(0,0,0,0.18)",border:"4px solid #111"}}>
              <img src={b.img} alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center"}}/>
            </div>
          ))}
        </div>
      </section>

      {/* SEARCH BAR */}
      <div style={{...S.searchBar,position:"relative"}} id="grid-anchor">
        <div style={S.searchInner}>
          <div style={S.searchBox}>
            <span style={S.searchIcon}>🔍</span>
            <input style={S.searchInput} placeholder="SEARCH SAREES, SILK, WEDDING..."
              value={search}
              onChange={e=>handleSearchInput(e.target.value)}
              onFocus={()=>{ if(search.length>=2) setShowSuggestions(true); if(user&&savedSearches.length>0&&!search) setShowSavedSearches(true); }}
              onBlur={()=>setTimeout(()=>{ setShowSuggestions(false); setShowSavedSearches(false); },200)}
            />
            {search&&<button style={S.searchClear} onClick={()=>{setSearch("");setShowSuggestions(false);}}>✕</button>}
            {search&&user&&<button style={{...S.searchClear,color:"#FF1493",fontSize:10,fontWeight:800,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1,whiteSpace:"nowrap",paddingRight:12}} onClick={saveCurrentSearch}>🔔 SAVE</button>}
          </div>
          <button className="hbtn" style={{...S.filterBtn,background:showFilters?"#FF1493":"#fff",color:showFilters?"#fff":"#111"}} onClick={()=>setShowFilters(f=>!f)}>FILTERS {hasFilters?"●":""}</button>
          {user&&profile?.bust&&<button className="hbtn" style={{...S.filterBtn,background:showSizeMatch?"#34C759":"#fff",color:showSizeMatch?"#fff":"#111"}} onClick={()=>setShowSizeMatch(f=>!f)}>📐 FIT</button>}
          <button className="hbtn" style={{...S.filterBtn,background:"#fff",color:"#111"}} onClick={()=>{loadTailorMarket();setView("tailors");}}>✂️ TAILORS</button>
        </div>
        {(showSuggestions&&searchSuggestions.length>0)||(showSavedSearches&&savedSearches.length>0)?(
          <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"2px solid #111",borderTop:"none",zIndex:200,maxHeight:280,overflowY:"auto"}}>
            {showSavedSearches&&savedSearches.length>0&&!search&&(
              <>
                <div style={{padding:"8px 14px",fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,fontWeight:900,letterSpacing:2,color:"#bbb",borderBottom:"1px solid #f0f0f0"}}>SAVED SEARCHES</div>
                {savedSearches.map(s=>(
                  <div key={s.id} style={{display:"flex",alignItems:"center",padding:"10px 14px",borderBottom:"1px solid #f5f5f5",cursor:"pointer",gap:10}}>
                    <span style={{fontSize:14}}>🔔</span>
                    <span style={{flex:1,fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,color:"#111"}} onClick={()=>applySearch(s.query)}>{s.query}</span>
                    <button style={{background:"none",border:"none",color:"#bbb",cursor:"pointer",fontSize:12,fontWeight:900,padding:"2px 6px"}} onClick={()=>deleteSavedSearch(s.id)}>✕</button>
                  </div>
                ))}
              </>
            )}
            {showSuggestions&&searchSuggestions.map((s,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",padding:"10px 14px",borderBottom:"1px solid #f5f5f5",cursor:"pointer",gap:10}} onMouseDown={()=>applySearch(s)}>
                <span style={{fontSize:14,color:"#bbb"}}>🔍</span>
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,color:"#111"}}>{s}</span>
              </div>
            ))}
          </div>
        ):null}
        {showFilters&&(
          <div style={S.filterPanel}>
            <div style={S.filterGroup}><div style={S.filterLabel}>TYPE</div><div style={S.filterPills}>{["All","Clothing","Jewellery","Shoes"].map(t=><button key={t} className="fpill" onClick={()=>setTypeFilter(t)} style={{...S.pill,...(typeFilter===t?S.pillOn:{})}}>{t}</button>)}</div></div>
            <div style={S.filterGroup}><div style={S.filterLabel}>CONDITION</div><div style={S.filterPills}>{["All",...CONDITIONS].map(c=><button key={c} className="fpill" onClick={()=>setCondFilter(c)} style={{...S.pill,...(condFilter===c?S.pillOn:{})}}>{c}</button>)}</div></div>
            <div style={S.filterGroup}><div style={S.filterLabel}>CATEGORY</div><div style={S.filterPills}>{["All",...(typeFilter==="Jewellery"?JEWELLERY_CATS:typeFilter==="Shoes"?SHOE_CATS:typeFilter==="Clothing"?CATEGORIES:ALL_CATEGORIES)].map(c=><button key={c} className="fpill" onClick={()=>setCatFilter(c)} style={{...S.pill,...(catFilter===c?S.pillOn:{})}}>{c}</button>)}</div></div>
            <div style={S.filterGroup}><div style={S.filterLabel}>SIZE</div><div style={S.filterPills}>{["All",...SIZES].map(sz=><button key={sz} className="fpill" onClick={()=>setSizeFilter(sz)} style={{...S.pill,...(sizeFilter===sz?S.pillOn:{})}}>{sz}</button>)}</div></div>
            <div style={S.filterGroup}>
              <div style={S.filterLabel}>PRICE RANGE</div>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <input style={{...S.inp,width:100}} type="number" placeholder="MIN" value={minPrice} onChange={e=>setMinPrice(e.target.value)}/>
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,color:"#bbb"}}>—</span>
                <input style={{...S.inp,width:100}} type="number" placeholder="MAX" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)}/>
                {hasFilters&&<button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#FF1493",border:"2px solid #FF1493",fontSize:11,padding:"8px 14px"}} onClick={clearFilters}>CLEAR ALL</button>}
              </div>
            </div>
          </div>
        )}
      </div>

      {hasFilters&&<div style={{padding:"12px 24px",fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,letterSpacing:2,color:"#bbb",borderBottom:"1px solid #f0f0f0"}}>{visible.length} RESULT{visible.length!==1?"S":""}{search?` FOR "${search.toUpperCase()}"`:""}  <span style={{color:"#FF1493",cursor:"pointer",marginLeft:12}} onClick={clearFilters}>CLEAR</span></div>}

      <div style={S.gridWrap}>
        {loading&&<div style={S.grid}>{Array(8).fill(0).map((_,i)=><div key={i} style={{...S.card,borderColor:"#f0f0f0"}}><div style={{height:200,background:"linear-gradient(90deg,#f5f5f5 25%,#ececec 50%,#f5f5f5 75%)",backgroundSize:"200% 100%",animation:"shimmer 1.4s infinite"}}/><div style={{padding:"16px 18px",background:"#fff"}}><div style={{height:16,background:"#f0f0f0",borderRadius:2,marginBottom:8,width:"80%"}}/><div style={{height:20,background:"#f0f0f0",borderRadius:2,width:"30%"}}/></div></div>)}</div>}
        {error&&<div style={S.errorBanner}>{error}<button style={S.retryBtn} onClick={fetchItems}>RETRY</button></div>}
        {!loading&&!error&&(
          <div style={S.grid}>
            {visible.map((item,idx)=>{
              const accent=CARD_COLORS[idx%CARD_COLORS.length];
              return(
                <article key={item.id} className="scard" style={{...S.card,borderColor:accent,opacity:item.sold?0.55:1}} onClick={()=>openDetail(item)}>
                  <div style={{...S.cardTop,background:item.image_url?"#000":accent,overflow:"hidden"}}>
                    {item.image_url?<img src={item.image_url} alt={item.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={S.cardEmoji}>{item.emoji||catEmoji(item.category)}</span>}
                    {item.image_url&&<div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 50%,rgba(0,0,0,0.45))"}}/>}
                    {item.sold&&<div style={S.soldVeil}><span style={S.soldStamp}>SOLD</span></div>}
                    {item.reserved&&!item.sold&&<div style={S.reservedBadge}>RESERVED</div>}
                    {fitsMe(item)===true&&<div style={S.fitsBadge}>📐 FITS YOU</div>}
                    <button style={{...S.heartBtn,background:wishlist.includes(item.id)?"#FF1493":"rgba(255,255,255,0.85)"}} onClick={e=>{e.stopPropagation();toggleWishlist(item.id);}}>{wishlist.includes(item.id)?"❤️":"🤍"}</button>
                    <div style={S.cardOrigin}>{item.origin?.toUpperCase()}</div>
                  </div>
                  <div style={S.cardBody}>
                    <p style={{...S.cardCatLabel,color:accent}}>{item.category?.toUpperCase()} · {(item.material||item.fabric)?.toUpperCase()}</p>
                    <p style={S.cardName}>{item.name}</p>
                    {(item.occasions||[]).length>0&&<div style={S.occRow}>{item.occasions.slice(0,3).map(o=><span key={o} style={{...S.occChip,background:OCC_COLOR[o]||"#999",color:"#fff"}}>{o.toUpperCase()}</span>)}</div>}
                    <div style={S.measRow}>
                      {item.size&&item.size!=="Free Size"&&<span style={S.mTag}>{item.size}</span>}
                      {item.bust&&<span style={S.mTag}>B {item.bust}in</span>}
                      {item.waist&&<span style={S.mTag}>W {item.waist}in</span>}
                      {item.can_take_in&&<span style={{...S.mTag,...S.mTagG}}>↔ TAKE IN</span>}
                      {item.spare_fabric&&<span style={{...S.mTag,...S.mTagA}}>+ FABRIC</span>}
                    </div>
                    <div style={S.cardFoot}>
                      <span style={{...S.cardPrice,color:accent}}>{currencySymbol(item.currency)}{item.price}</span>
                      {item.views>0&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#bbb",letterSpacing:1}}>👁 {item.views}</span>}
                    </div>
                  </div>
                  <div style={{...S.accentBar,background:accent}}/>
                </article>
              );
            })}
            {visible.length===0&&(
              <div style={S.empty}>
                <p style={{fontSize:60}}>{hasFilters?"🔍":"🥻"}</p>
                <p style={{fontSize:28,fontWeight:900,margin:"12px 0 6px",fontFamily:"'Barlow Condensed',sans-serif"}}>{hasFilters?"NO RESULTS.":"NOTHING HERE YET."}</p>
                {hasFilters?<button className="hbtn" style={S.hBtn} onClick={clearFilters}>CLEAR FILTERS</button>:<button className="hbtn" style={S.hBtn} onClick={()=>user?setView("add"):(setAuthMode("signup"),setView("auth"))}>LIST IT →</button>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* NEW IN */}
      {!hasFilters&&newListings.length>0&&(
        <div style={{marginTop:48,borderTop:"3px solid #111",paddingTop:32}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #34C759",paddingLeft:12,marginBottom:20}}>✨ NEW IN — LAST 48 HOURS</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:3}}>
            {newListings.slice(0,8).map((item,idx)=>{
              const accent=CARD_COLORS[idx%CARD_COLORS.length];
              return(
                <article key={item.id} className="scard" style={{...S.card,borderColor:accent}} onClick={()=>openDetail(item)}>
                  <div style={{...S.cardTop,background:item.image_url?"#000":accent,overflow:"hidden"}}>
                    {item.image_url?<img src={item.image_url} alt={item.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={S.cardEmoji}>{item.emoji||catEmoji(item.category)}</span>}
                    <div style={{position:"absolute",top:8,left:8,background:"#34C759",color:"#fff",padding:"2px 8px",fontSize:9,fontWeight:800,letterSpacing:1.5,fontFamily:"'Barlow Condensed',sans-serif",zIndex:3}}>NEW</div>
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
          </div>
        </div>
      )}

      {/* PRICE DROPS */}
      {!hasFilters&&priceDrops.length>0&&(
        <div style={{marginTop:48,borderTop:"3px solid #111",paddingTop:32}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #FF9500",paddingLeft:12,marginBottom:20}}>📉 PRICE DROPS</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:3}}>
            {priceDrops.slice(0,8).map((item,idx)=>{
              const accent=CARD_COLORS[idx%CARD_COLORS.length];
              const drop=item.prev_price?Math.round(((item.prev_price-item.price)/item.prev_price)*100):0;
              return(
                <article key={item.id} className="scard" style={{...S.card,borderColor:accent}} onClick={()=>openDetail(item)}>
                  <div style={{...S.cardTop,background:item.image_url?"#000":accent,overflow:"hidden"}}>
                    {item.image_url?<img src={item.image_url} alt={item.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={S.cardEmoji}>{item.emoji||catEmoji(item.category)}</span>}
                    {drop>0&&<div style={{position:"absolute",top:8,left:8,background:"#FF9500",color:"#fff",padding:"2px 8px",fontSize:9,fontWeight:800,letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif",zIndex:3}}>-{drop}%</div>}
                  </div>
                  <div style={S.cardBody}>
                    <p style={{...S.cardCatLabel,color:accent}}>{item.category?.toUpperCase()}</p>
                    <p style={S.cardName}>{item.name}</p>
                    <div style={S.cardFoot}>
                      <span style={{...S.cardPrice,color:accent}}>{currencySymbol(item.currency)}{item.price}</span>
                      {item.prev_price&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,color:"#bbb",textDecoration:"line-through",marginLeft:6}}>{currencySymbol(item.currency)}{item.prev_price}</span>}
                    </div>
                  </div>
                  <div style={{...S.accentBar,background:accent}}/>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* TRENDING */}
      {!hasFilters&&trendingItems.length>0&&(
        <div style={{marginTop:48,borderTop:"3px solid #111",paddingTop:32,marginBottom:48}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:3,color:"#111",borderLeft:"4px solid #BF5AF2",paddingLeft:12,marginBottom:20}}>🔥 TRENDING — MOST VIEWED</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:3}}>
            {trendingItems.slice(0,8).map((item,idx)=>{
              const accent=CARD_COLORS[idx%CARD_COLORS.length];
              return(
                <article key={item.id} className="scard" style={{...S.card,borderColor:accent}} onClick={()=>openDetail(item)}>
                  <div style={{...S.cardTop,background:item.image_url?"#000":accent,overflow:"hidden"}}>
                    {item.image_url?<img src={item.image_url} alt={item.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={S.cardEmoji}>{item.emoji||catEmoji(item.category)}</span>}
                    <div style={{position:"absolute",top:8,left:8,background:"#BF5AF2",color:"#fff",padding:"2px 8px",fontSize:9,fontWeight:800,letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif",zIndex:3}}>👁 {item.views}</div>
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
          </div>
        </div>
      )}
    </>
  );
}
