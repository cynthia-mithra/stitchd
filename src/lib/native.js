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

export async function initNative() {
  if (!isNative()) return;

  // Status bar: dark icons/text, since the app header is light. Wrapped so a
  // missing plugin or an unsupported call never blocks app start.
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
  } catch (e) { /* status bar is cosmetic — ignore */ }

  // Hide the launch splash once React has taken over the screen.
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch (e) { /* splash auto-hides after launchShowDuration anyway */ }
}
