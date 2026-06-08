import React from "react";
import { currencySymbol } from "../lib/constants";
import { S } from "../styles";

export default function Orders({
  view, setView, user, items,
  ordersTab, setOrdersTab, ordersLoading, myOrders,
  showTrackingInput, setShowTrackingInput, trackingInput, setTrackingInput,
  markShipped, confirmReceived,
  showDisputeForm, setShowDisputeForm, disputeReason, setDisputeReason, raiseDispute,
}) {
  if(view!=="orders") return null;
  if(!user) return null;
  return (
    <main style={S.main}>
      <button style={S.back} onClick={()=>setView("shop")}>← BACK</button>
      <div style={{marginBottom:32,paddingBottom:24,borderBottom:"3px solid #111",display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
        <div>
          <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:4,color:"#FF1493",marginBottom:6}}>YOUR TRANSACTIONS</p>
          <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:48,fontWeight:900,letterSpacing:-1,lineHeight:1}}>ORDER HISTORY</h2>
        </div>
        <div style={{display:"flex",gap:6}}>
          {[["All","all"],["Buying","buying"],["Selling","selling"]].map(([l,v])=>(
            <button key={v} className="fpill" style={{...S.pill,...(ordersTab===v?S.pillOn:{})}} onClick={()=>setOrdersTab(v)}>{l}</button>
          ))}
        </div>
      </div>
      {ordersLoading?<div style={S.loadingWrap}><div style={S.spinner}/></div>:myOrders.length===0?(
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <p style={{fontSize:48,marginBottom:12}}>📦</p>
          <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:900,marginBottom:8}}>NO ORDERS YET.</p>
          <button className="hbtn" style={S.hBtn} onClick={()=>setView("shop")}>BROWSE DROPS →</button>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {myOrders.filter(o=>ordersTab==="all"||(ordersTab==="buying"&&o.buyer_id===user.id)||(ordersTab==="selling"&&o.seller_id===user.id)).map(order=>{
            const listing=items.find(i=>i.id===order.listing_id);
            const isBuyer=order.buyer_id===user.id;
            const statusColors={paid:"#FF9500",shipped:"#007AFF",delivered:"#34C759",disputed:"#FF1493"};
            return(
              <div key={order.id} style={{border:"2px solid #f0f0f0",padding:"20px",display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start"}}>
                {listing?.image_url&&<img src={listing.image_url} alt="" style={{width:72,height:72,objectFit:"cover",border:"2px solid #111",flexShrink:0}}/>}
                <div style={{flex:1,minWidth:200}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                    <span style={{background:statusColors[order.status]||"#888",color:"#fff",padding:"3px 10px",fontSize:10,fontWeight:800,letterSpacing:1.5,fontFamily:"'Barlow Condensed',sans-serif"}}>{order.status?.toUpperCase()}</span>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,color:"#bbb",letterSpacing:1}}>{isBuyer?"BUYING":"SELLING"} · {new Date(order.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}).toUpperCase()}</span>
                  </div>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900,marginBottom:4}}>{listing?.name||"Item"}</p>
                  <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:900,color:"#FF1493",marginBottom:6}}>{currencySymbol(listing?.currency)}{order.amount}</p>
                  {order.tracking_number&&<p style={{fontSize:12,color:"#007AFF",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:1,marginBottom:4}}>📦 TRACKING: {order.tracking_number}</p>}
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
                    {!isBuyer&&order.status==="paid"&&(
                      showTrackingInput===order.id?(
                        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                          <input style={{...S.inp,width:160,fontSize:12,padding:"8px 10px"}} placeholder="Tracking number" value={trackingInput} onChange={e=>setTrackingInput(e.target.value)}/>
                          <button className="hbtn" style={{...S.hBtn,background:"#007AFF",border:"none",fontSize:11,padding:"8px 14px"}} onClick={()=>markShipped(order.id)}>CONFIRM SHIPPED</button>
                          <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#888",border:"1px solid #e0e0e0",fontSize:11,padding:"8px 10px"}} onClick={()=>setShowTrackingInput(null)}>✕</button>
                        </div>
                      ):(
                        <button className="hbtn" style={{...S.hBtn,background:"#007AFF",border:"none",fontSize:11,padding:"8px 16px"}} onClick={()=>setShowTrackingInput(order.id)}>📦 MARK AS SHIPPED</button>
                      )
                    )}
                    {isBuyer&&order.status==="shipped"&&(
                      <>
                        <button className="hbtn" style={{...S.hBtn,background:"#34C759",border:"none",fontSize:11,padding:"8px 16px"}} onClick={()=>confirmReceived(order.id)}>✓ CONFIRM RECEIVED</button>
                        <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#FF1493",border:"2px solid #FF1493",fontSize:11,padding:"8px 14px"}} onClick={()=>setShowDisputeForm(order.id)}>🚩 RAISE DISPUTE</button>
                      </>
                    )}
                  </div>
                  {showDisputeForm===order.id&&(
                    <div style={{marginTop:12,border:"2px solid #FF1493",padding:"14px",display:"flex",flexDirection:"column",gap:10}}>
                      <textarea style={{...S.inp,height:80,resize:"vertical",width:"100%",fontSize:13}} placeholder="Describe the issue..." value={disputeReason} onChange={e=>setDisputeReason(e.target.value)}/>
                      <div style={{display:"flex",gap:8}}>
                        <button className="hbtn" style={{...S.hBtn,background:"#FF1493",border:"none",flex:1,padding:"10px",fontSize:12}} onClick={()=>raiseDispute(order.id)}>SUBMIT DISPUTE</button>
                        <button className="hbtn" style={{...S.hBtn,background:"#fff",color:"#888",border:"1px solid #e0e0e0",padding:"10px 14px",fontSize:12}} onClick={()=>setShowDisputeForm(null)}>CANCEL</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
