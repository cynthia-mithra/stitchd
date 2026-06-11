import React from "react";
import { S } from "../styles";

/* ------------------------------------------------------------------ *
 * SITE FOOTER — sits at the bottom of every page. Required by UK law
 * and by Stripe before live payments can be accepted.
 *
 * Renders at the document bottom of the app root, so it never appears
 * inside fixed-position modals/overlays (bag, notifications, payment),
 * and the Stripe checkout page is hosted externally — neither gets it.
 *
 * `onNavigate(view)` drives the same view-state + URL routing the rest
 * of the app uses (see App.js goLegal). Contact is a plain mailto.
 * ------------------------------------------------------------------ */

const LINKS = [
  { label: "T&Cs", view: "terms" },
  { label: "Privacy Policy", view: "privacy" },
  { label: "Returns Policy", view: "returns" },
];

export default function Footer({ onNavigate }) {
  return (
    <footer style={S.footer}>
      <div style={S.footerRow}>
        <span style={S.footerWordmark}>STITCH'D</span>

        <nav style={S.footerLinks}>
          {LINKS.map((l, i) => (
            <React.Fragment key={l.view}>
              {i > 0 && <span style={S.footerSep} aria-hidden="true">·</span>}
              <button
                type="button"
                className="footer-link"
                style={S.footerLink}
                onClick={() => onNavigate(l.view)}
              >
                {l.label}
              </button>
            </React.Fragment>
          ))}
          <span style={S.footerSep} aria-hidden="true">·</span>
          <a href="mailto:hello@stitchd.fit" className="footer-link" style={S.footerLink}>Contact</a>
        </nav>

        <span style={S.footerCopy}>© 2026 Stitch'd. All rights reserved.</span>
      </div>

      <p style={S.footerFine}>
        Stitch'd is a marketplace for pre-loved South Asian fashion. Registered in the UK.
      </p>
    </footer>
  );
}
