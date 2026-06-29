import React from "react";

// App-wide crash safety net.
// ---------------------------
// React error boundaries have to be class components, and a boundary's whole
// job is to render when the rest of the app can't - so the fallback is fully
// self-contained with inline styles and web-safe fonts. It must not depend on
// the app's injected <style> block, on any context, or on any shared component,
// because the thing that just threw might be exactly one of those.
//
// Wrapped around <App/> in index.js so a single render error shows a calm,
// on-brand "something went wrong" card instead of a blank white screen - which
// matters most when a buyer hits it mid-checkout.

const COLORS = {
  ink: "#111",
  pink: "#FF1493",
  muted: "#6b6b6b",
  line: "#111",
  bg: "#fff",
};

const HEAD = "'Barlow Condensed','Arial Narrow',sans-serif";
const BODY = "'Barlow',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Single intentional error report (not debug noise) so a crash still leaves
    // a breadcrumb in the console / any error-tracking that's wired up later.
    // eslint-disable-next-line no-console
    console.error("Stitch'd caught a render error:", error, info?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    // Hard navigation to the root clears the corrupted in-memory state that the
    // boundary can't safely reset on its own.
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: COLORS.bg,
          fontFamily: BODY,
          color: COLORS.ink,
        }}
      >
        <div style={{ maxWidth: 440, width: "100%", textAlign: "center" }}>
          {/* Wordmark - keeps the brand present even on the failure screen. */}
          <div
            style={{
              fontFamily: HEAD,
              fontWeight: 900,
              fontSize: 30,
              letterSpacing: "1px",
              marginBottom: 28,
            }}
          >
            STITCH<span style={{ color: COLORS.pink }}>'D</span>
          </div>

          <div
            style={{
              border: `2px solid ${COLORS.line}`,
              borderTop: `6px solid ${COLORS.pink}`,
              padding: "34px 26px",
              background: "#fff",
            }}
          >
            <div
              style={{
                fontFamily: HEAD,
                fontWeight: 900,
                fontSize: 30,
                lineHeight: 1.05,
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              Something went <span style={{ color: COLORS.pink }}>wrong</span>
            </div>

            <p
              style={{
                fontSize: 15.5,
                lineHeight: 1.6,
                color: COLORS.muted,
                margin: "0 auto 26px",
                maxWidth: 340,
              }}
            >
              Sorry, that page hit a snag on our end. Your details are safe.
              Try reloading, or head back to the home page.
            </p>

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={this.handleReload}
                style={{
                  fontFamily: HEAD,
                  fontWeight: 800,
                  fontSize: 15,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  color: "#fff",
                  background: COLORS.ink,
                  border: `2px solid ${COLORS.ink}`,
                  padding: "12px 22px",
                  cursor: "pointer",
                }}
              >
                Reload page
              </button>
              <button
                onClick={this.handleHome}
                style={{
                  fontFamily: HEAD,
                  fontWeight: 800,
                  fontSize: 15,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  color: COLORS.ink,
                  background: "#fff",
                  border: `2px solid ${COLORS.ink}`,
                  padding: "12px 22px",
                  cursor: "pointer",
                }}
              >
                Back to home
              </button>
            </div>
          </div>

          <p style={{ fontSize: 13, color: COLORS.muted, marginTop: 20 }}>
            Still stuck? Email{" "}
            <a
              href="mailto:hello@stitchd.fit"
              style={{ color: COLORS.pink, fontWeight: 600, textDecoration: "none" }}
            >
              hello@stitchd.fit
            </a>
          </p>
        </div>
      </div>
    );
  }
}
