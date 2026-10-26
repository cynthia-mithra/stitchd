// Floating AI shopping assistant — a chat bubble that sits bottom-right on the
// website (web only; it is not mounted inside the native app). It talks to the
// server-side /api/assistant route, which does all the Supabase + Anthropic work
// so no keys are ever exposed here. Styling lives in styles.js (the `asst-*`
// classes) so it matches the rest of the site and can be themed in one place.
import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send } from "lucide-react";
// Shared API helper: same-origin fetch on the web, native HTTP (CapacitorHttp)
// in the app — so the assistant works in both. Routes to the live site in-app.
import { apiPost } from "../lib/checkout";

const GREETING = {
  role: "assistant",
  content:
    "Hi! 👋 I'm the Stitch'd assistant. Ask me about our pre-loved South Asian pieces — sarees, lehengas, sizes, prices or how things work.",
};

export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  // Keep the transcript scrolled to the latest line.
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs, busy, open]);

  // Focus the input when the panel opens.
  useEffect(() => {
    if (open && inputRef.current) {
      const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const history = next
        .filter((m) => m !== GREETING)
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));
      let reply = "Sorry — I'm having trouble right now. Please try again in a moment.";
      const { data } = await apiPost("/api/assistant", { message: text, history });
      if (data && data.reply) reply = data.reply;
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
    } catch (_) {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Sorry — I couldn't reach the assistant. Please check your connection and try again.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {open && (
        <div className="asst-panel" role="dialog" aria-label="Stitch'd shopping assistant">
          <div className="asst-head">
            <div>
              <h3>Stitch'd Assistant</h3>
              <p>Here to help you shop pre-loved</p>
            </div>
            <button
              className="asst-close"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
            >
              <X width={22} height={22} />
            </button>
          </div>
          <div className="asst-body" ref={bodyRef}>
            {msgs.map((m, i) => (
              <div key={i} className={"asst-msg " + (m.role === "user" ? "user" : "bot")}>
                {m.content}
              </div>
            ))}
            {busy && <div className="asst-typing">Stitch'd is typing…</div>}
          </div>
          <div className="asst-foot">
            <input
              ref={inputRef}
              className="asst-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Ask about sizes, prices, styles…"
              aria-label="Message the assistant"
              maxLength={1000}
            />
            <button
              className="asst-send"
              onClick={send}
              disabled={busy || !input.trim()}
              aria-label="Send message"
            >
              <Send width={18} height={18} />
            </button>
          </div>
        </div>
      )}
      <button
        className="asst-launcher"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close shopping assistant" : "Open shopping assistant"}
        aria-expanded={open}
      >
        {open ? <X width={26} height={26} /> : <MessageCircle width={26} height={26} />}
      </button>
    </>
  );
}
