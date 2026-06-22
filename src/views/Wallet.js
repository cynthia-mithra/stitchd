import React from "react";
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Landmark, Check, Clock, AlertTriangle } from "lucide-react";
import { S } from "../styles";
import { F } from "../components/Shared";

const PINK = "#FF1493";
const gbp = (pence) => `£${(Math.abs(Number(pence) || 0) / 100).toFixed(2)}`;

// Available (withdrawable) balance = every non-failed row EXCEPT sale credits
// still held pending the buyer's confirmation (Vinted-style escrow).
export function walletBalancePence(txns = []) {
  return txns
    .filter((t) => t.status !== "failed" && !(t.type === "sale" && t.status === "pending"))
    .reduce((s, t) => s + (Number(t.amount_pence) || 0), 0);
}

// Earnings held until buyers confirm receipt (not yet withdrawable).
export function walletPendingInPence(txns = []) {
  return txns
    .filter((t) => t.type === "sale" && t.status === "pending")
    .reduce((s, t) => s + (Number(t.amount_pence) || 0), 0);
}

export default function Wallet({
  view, setView, user,
  transactions = [], loading = false,
  onboarded = false, onSetupPayouts = () => {}, payoutBusy = false,
  onWithdraw = () => {}, withdrawBusy = false,
}) {
  const [amount, setAmount] = React.useState("");
  if (view !== "wallet") return null;

  const balance = walletBalancePence(transactions);
  const pendingIn = walletPendingInPence(transactions);
  const pendingOut = transactions
    .filter((t) => t.type === "withdrawal" && t.status === "pending")
    .reduce((s, t) => s + Math.abs(Number(t.amount_pence) || 0), 0);

  const amtPence = Math.round(parseFloat(amount) * 100);
  let amtError = "";
  if (amount !== "") {
    if (!Number.isFinite(amtPence) || amtPence <= 0) amtError = "Enter an amount greater than 0";
    else if (amtPence > balance) amtError = `That's more than your balance (${gbp(balance)})`;
  }
  const canWithdraw = amount !== "" && !amtError && !withdrawBusy && balance > 0;

  const doWithdraw = () => { if (canWithdraw) onWithdraw(amtPence, () => setAmount("")); };

  if (!user) {
    return (
      <main style={{ ...S.main, maxWidth: 720 }}>
        <button style={S.back} onClick={() => setView("shop")}>← BACK</button>
        <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 800, color: "#bbb", padding: "40px 0" }}>Sign in to view your wallet.</p>
      </main>
    );
  }

  return (
    <main style={{ ...S.main, maxWidth: 720 }}>
      <button style={S.back} onClick={() => setView("shop")}>← BACK</button>

      <div style={{ marginBottom: 28, paddingBottom: 22, borderBottom: "3px solid #111" }}>
        <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 4, color: PINK, marginBottom: 6 }}>YOUR EARNINGS</p>
        <h1 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "clamp(40px,7vw,64px)", fontWeight: 900, letterSpacing: -1, lineHeight: 1, display: "flex", alignItems: "center", gap: 14 }}>
          <WalletIcon width={44} height={44} /> WALLET.
        </h1>
      </div>

      {/* BALANCE CARD */}
      <div style={{ border: "3px solid #111", padding: "26px 24px", marginBottom: 22, background: "#111", color: "#fff" }}>
        <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 800, letterSpacing: 2, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>AVAILABLE BALANCE</p>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 56, fontWeight: 900, letterSpacing: -2, lineHeight: 1, color: "#fff" }}>{gbp(balance)}</div>
        {pendingIn > 0 && (
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 0.5, color: "#FFD166", marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Clock width={14} height={14} /> {gbp(pendingIn)} pending — released when buyers confirm receipt
          </p>
        )}
        {pendingOut > 0 && (
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 0.5, color: "#00E5CC", marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Clock width={14} height={14} /> {gbp(pendingOut)} withdrawal in progress
          </p>
        )}
      </div>

      {/* WITHDRAW / SETUP */}
      {!onboarded ? (
        <div style={{ border: "2px solid #111", padding: "20px 22px", marginBottom: 28 }}>
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 900, letterSpacing: 0.5, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}><Landmark width={20} height={20} /> SET UP PAYOUTS</p>
          <p style={{ fontSize: 14, color: "#666", lineHeight: 1.5, marginBottom: 16 }}>Connect a bank account with Stripe to withdraw your earnings. It only takes a minute and is fully secure.</p>
          <button className="hbtn" disabled={payoutBusy} onClick={onSetupPayouts}
            style={{ background: PINK, color: "#fff", border: "2px solid #111", borderRadius: 0, padding: "14px 28px", fontSize: 14, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, letterSpacing: 2, cursor: payoutBusy ? "wait" : "pointer", opacity: payoutBusy ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Landmark width={16} height={16} /> {payoutBusy ? "OPENING…" : "CONNECT BANK ACCOUNT"}
          </button>
        </div>
      ) : (
        <div style={{ border: "2px solid #111", padding: "20px 22px", marginBottom: 28 }}>
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 900, letterSpacing: 0.5, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><ArrowUpRight width={20} height={20} /> WITHDRAW TO BANK</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 200px" }}>
              <F l="AMOUNT (£)">
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, fontWeight: 700, color: "#111", pointerEvents: "none" }}>£</span>
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                    style={{ ...S.inp, paddingLeft: 28, fontSize: 18, fontWeight: 700, borderColor: amtError ? PINK : "#111" }} />
                </div>
              </F>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", paddingTop: 22 }}>
              <button type="button" className="hbtn" onClick={() => setAmount((balance / 100).toFixed(2))} disabled={balance <= 0}
                style={{ background: "#fff", color: "#111", border: "2px solid #111", borderRadius: 0, padding: "13px 16px", fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, letterSpacing: 1, cursor: balance > 0 ? "pointer" : "not-allowed", opacity: balance > 0 ? 1 : 0.5 }}>ALL</button>
              <button type="button" className="hbtn" onClick={doWithdraw} disabled={!canWithdraw}
                style={{ background: PINK, color: "#fff", border: "2px solid #111", borderRadius: 0, padding: "13px 24px", fontSize: 14, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, letterSpacing: 2, cursor: canWithdraw ? "pointer" : "not-allowed", opacity: canWithdraw ? 1 : 0.45 }}>
                {withdrawBusy ? "SENDING…" : "WITHDRAW"}
              </button>
            </div>
          </div>
          {amtError && <p style={{ fontSize: 13, color: PINK, fontWeight: 700, marginTop: 8 }}>{amtError}</p>}
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, color: "#bbb", letterSpacing: 0.5, marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Check width={13} height={13} /> Bank connected · funds arrive in 2–7 business days
          </p>
        </div>
      )}

      {/* TRANSACTION HISTORY */}
      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 900, letterSpacing: 3, color: "#111", borderLeft: `4px solid ${PINK}`, paddingLeft: 12, marginBottom: 18 }}>TRANSACTIONS</div>
      {loading ? (
        <div style={S.loadingWrap}><div style={S.spinner} /><p style={S.loadingText}>LOADING…</p></div>
      ) : transactions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 20px", border: "3px dashed #e0e0e0" }}>
          <p style={{ display: "flex", justifyContent: "center", marginBottom: 12, color: "#ccc" }}><WalletIcon width={44} height={44} /></p>
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 900, color: "#bbb", marginBottom: 6 }}>NO EARNINGS YET</p>
          <p style={{ fontSize: 14, color: "#999" }}>When you make a sale, your earnings show up here to withdraw.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {transactions.map((t) => {
            const credit = (Number(t.amount_pence) || 0) >= 0;
            const failed = t.status === "failed";
            const pending = t.status === "pending";
            return (
              <div key={t.id} style={{ border: "2px solid #111", padding: "13px 16px", display: "flex", alignItems: "center", gap: 14, opacity: failed ? 0.55 : 1 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid #111", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: credit ? "#34C75922" : "#f2f2f2", color: credit ? "#1a8c3e" : "#111" }}>
                  {credit ? <ArrowDownLeft width={18} height={18} /> : <ArrowUpRight width={18} height={18} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 800, color: "#111", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.description || (credit ? "Sale earnings" : "Withdrawal")}</p>
                  <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, color: "#999", letterSpacing: 0.5, margin: "2px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
                    {new Date(t.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    {pending && <span style={{ color: "#FF9500", display: "inline-flex", alignItems: "center", gap: 3 }}><Clock width={11} height={11} /> PENDING</span>}
                    {failed && <span style={{ color: PINK, display: "inline-flex", alignItems: "center", gap: 3 }}><AlertTriangle width={11} height={11} /> FAILED</span>}
                  </p>
                </div>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 19, fontWeight: 900, letterSpacing: -0.5, color: credit ? "#1a8c3e" : "#111", flexShrink: 0 }}>
                  {credit ? "+" : "−"}{gbp(t.amount_pence)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
