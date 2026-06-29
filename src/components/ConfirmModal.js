import React, { useState, useEffect, useRef } from "react";
import { S } from "../styles";

// Branded confirm dialog (replaces the grey browser window.confirm box).
// ---------------------------------------------------------------------
// Promise-based imperative API so any module can ask for confirmation without
// prop-drilling a modal through every view:
//
//   if (!(await confirmDialog({ message: "Delete this?", danger: true })) return;
//
// A single <ConfirmHost/> is rendered once in App; confirmDialog() pushes the
// request into a tiny external store the host subscribes to, then resolves the
// promise true/false when the user picks. Design system: Barlow Condensed,
// #FF1493 pink, #111 2px borders, no radius - matching LoginPromptModal.

const PINK = "#FF1493";
const DANGER = "#FF3B30";

const DEFAULTS = {
  title: "Are you sure?",
  message: "",
  confirmLabel: "CONFIRM",
  cancelLabel: "CANCEL",
  danger: false, // destructive action -> red confirm button
};

let current = null;      // the active request (or null)
let resolver = null;     // resolve fn for the in-flight promise
let listeners = [];      // ConfirmHost re-render subscribers

const emit = () => listeners.forEach((l) => l());

export function confirmDialog(opts = {}) {
  // If one is somehow already open, resolve it false before opening the next.
  if (resolver) { const r = resolver; resolver = null; r(false); }
  return new Promise((resolve) => {
    current = { ...DEFAULTS, ...opts };
    resolver = resolve;
    emit();
  });
}

function settle(result) {
  const r = resolver;
  resolver = null;
  current = null;
  emit();
  if (r) r(result);
}

export function ConfirmHost() {
  const [, force] = useState(0);
  const confirmRef = useRef(null);

  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.push(l);
    return () => { listeners = listeners.filter((x) => x !== l); };
  }, []);

  // Focus the confirm button + wire Escape to cancel while a dialog is open.
  useEffect(() => {
    if (!current) return;
    confirmRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") settle(false);
      if (e.key === "Enter") settle(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!current) return null;
  const { title, message, confirmLabel, cancelLabel, danger } = current;
  const accent = danger ? DANGER : PINK;

  return (
    <div style={{ ...S.modalOverlay, zIndex: 4000 }} onClick={() => settle(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          border: "3px solid #111",
          borderTop: `6px solid ${accent}`,
          borderRadius: 0,
          maxWidth: 400,
          width: "100%",
          padding: 30,
          textAlign: "center",
        }}
      >
        <h2 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 26, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.06, marginBottom: 12, textTransform: "uppercase" }}>
          {title}
        </h2>
        {message ? (
          <p style={{ fontSize: 15, color: "#444", lineHeight: 1.6, marginBottom: 24 }}>{message}</p>
        ) : null}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => settle(false)}
            style={{ flex: 1, background: "#fff", color: "#111", border: "2px solid #111", borderRadius: 0, padding: "13px 16px", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 800, letterSpacing: 1.5, cursor: "pointer" }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={() => settle(true)}
            style={{ flex: 1, background: danger ? DANGER : "#111", color: "#fff", border: `2px solid ${danger ? DANGER : "#111"}`, borderRadius: 0, padding: "13px 16px", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 800, letterSpacing: 1.5, cursor: "pointer" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
