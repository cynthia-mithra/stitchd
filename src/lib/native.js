// Native-shell initialisation. Everything here is a no-op on the web — it only
// runs inside the Capacitor app (window.Capacitor.isNativePlatform()). The
// Capacitor plugins are imported dynamically so they never load in the browser
// bundle's critical path.
export function isNative() {
  return (
    typeof window !== "undefined" &&
    !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform())
  );
}

// Open an external flow (Stripe checkout, or a Supabase OAuth authorize URL).
// On the web this is a normal full-page navigation. In the native app we open it
// in the in-app browser (SFSafariViewController) so that, when the flow finishes
// and redirects to our native-return.html bridge, the stitchd:// deep link brings
// the user back into the app (handled by the appUrlOpen listener in App.js).
export async function openExternal(url) {
  if (!isNative()) {
    window.location.href = url;
    return;
  }
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
  } catch (e) {
    // If the in-app browser plugin is unavailable, fall back to a normal open.
    window.location.href = url;
  }
}

// Open an arbitrary URL the right way for the platform: a new tab on the web,
// the in-app browser in the native app (a bare window.open often no-ops inside a
// WKWebView). Use for tracking links, shipping-label PDFs, external pages, etc.
export async function openUrl(url) {
  if (!url) return;
  if (!isNative()) {
    window.open(url, "_blank", "noopener");
    return;
  }
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
  } catch (e) {
    try { window.open(url, "_blank"); } catch (_) { /* nothing else to try */ }
  }
}

// Fire a short haptic tap in the native app (a no-op on the web, where iOS
// WKWebView has no vibration API anyway). `style` maps to Capacitor's
// ImpactStyle: "light" | "medium" | "heavy". Fully guarded so a missing plugin
// or an unsupported device never throws - haptics are a nicety, not a dependency.
export async function haptic(style = "light") {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
    await Haptics.impact({ style: map[style] || ImpactStyle.Light });
  } catch (e) { /* no haptics available - ignore */ }
}

// Dismiss the in-app browser (called once the deep link has brought us back).
export async function closeExternal() {
  if (!isNative()) return;
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.close();
  } catch (e) { /* already closed */ }
}

export async function initNative() {
  if (!isNative()) return;

  // Mark the body so the native-only CSS (no tap flash / callouts / text
  // selection) applies, making the app read less like a website.
  try { document.body.classList.add("native-app"); } catch (e) { /* pre-DOM */ }

  // Status bar: dark icons/text, since the app header is light. Wrapped so a
  // missing plugin or an unsupported call never blocks app start.
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
  } catch (e) { /* status bar is cosmetic — ignore */ }

  // The splash auto-hides after launchShowDuration (see capacitor.config), so we
  // deliberately DON'T hide it immediately here — that let the pink "S" flash by
  // in a blink. It fades out on its own once the app is on screen.
}
