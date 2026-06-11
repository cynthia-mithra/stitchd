import React from "react";

/* ------------------------------------------------------------------ *
 * Global site footer — appears at the bottom of every page (rendered
 * once in App.js, in normal document flow below the page content).
 *
 * Required by UK law / Stripe before live payments: links out to the
 * three legal pages (/terms, /privacy, /returns) plus a Contact mailto.
 *
 * Navigation uses the app's `view` state (no full reload) via the
 * onNav(view, path) callback passed from App.js, which also pushes the
 * matching path onto the browser history so the URL reflects the page.
 * Contact is a plain mailto: link.
 * ------------------------------------------------------------------ */

const BC = "'Barlow Condensed',sans-serif";
const PINK = "#FF1493";

const LINKS = [
  { label: "T&Cs",           view: "terms",   path: "/terms" },
  { label: "Privacy Policy", view: "privacy", path: "/privacy" },
  { label: "Returns Policy", view: "returns", path: "/returns" },
];

export default function Footer({ onNav }) {
  return (
    <footer style={S.footer}>
      <div style={S.row}>
        {/* LEFT — wordmark */}
        <span style={S.wordmark}>STITCH'D</span>

        {/* CENTRE — legal links + contact */}
        <nav style={S.links}>
          {LINKS.map((l, i) => (
            <React.Fragment key={l.view}>
              {i > 0 && <span style={S.sep}>·</span>}
              <button
                type="button"
                className="footer-link"
                style={S.link}
                onClick={() => onNav(l.view, l.path)}
              >
                {l.label}
              </button>
            </React.Fragment>
          ))}
          <span style={S.sep}>·</span>
          <a href="mailto:hello@stitchd.fit" className="footer-link" style={S.link}>
            Contact
          </a>
        </nav>

        {/* RIGHT — copyright */}
        <span style={S.copy}>© 2026 Stitch'd. All rights reserved.</span>
      </div>

      <p style={S.note}>
        Stitch'd is a marketplace for pre-loved South Asian fashion. Registered in the UK.
      </p>
    </footer>
  );
}

const S = {
  footer: {
    background: "#111",
    borderTop: `2px solid ${PINK}`,
    borderRadius: 0,
    padding: "28px 20px 24px",
    marginTop: 60,
  },
  row: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
  },
  wordmark: {
    fontFamily: BC,
    fontSize: 24,
    fontWeight: 900,
    letterSpacing: 2,
    color: "#fff",
  },
  links: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  link: {
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    fontFamily: BC,
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 1,
    color: "#fff",
    textDecoration: "none",
  },
  sep: { color: "#fff", fontFamily: BC, fontSize: 15 },
  copy: {
    fontFamily: BC,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: "#fff",
  },
  note: {
    maxWidth: 1200,
    margin: "16px auto 0",
    fontFamily: BC,
    fontSize: 12,
    fontWeight: 400,
    letterSpacing: 0.5,
    color: "#888",
    lineHeight: 1.5,
  },
};
