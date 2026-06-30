import { VAPID_PUBLIC_KEY } from "./constants";
import { db } from "./db";

// Web Push helpers. Push works in installed PWAs on iOS 16.4+ and on
// Android/desktop Chrome/Edge/Firefox. We never prompt automatically (browsers
// penalise that) - enablePush() runs from a user tap.

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushPermission() {
  return pushSupported() ? Notification.permission : "unsupported";
}

function urlB64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Ask permission, subscribe via the service worker, and store the subscription
// so the server can push to this device. Returns true on success; throws with a
// short reason ("unsupported" / "denied") the caller can message.
export async function enablePush(userId, token) {
  if (!pushSupported()) throw new Error("unsupported");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("denied");
  if (!navigator.serviceWorker || !navigator.serviceWorker.ready) throw new Error("no service worker");
  const reg = await navigator.serviceWorker.ready;
  let sub;
  try {
    sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
  } catch (e) {
    throw new Error(`subscribe failed: ${e.message || e.name}`);
  }
  const j = sub.toJSON();
  try {
    await db.savePushSubscription(
      {
        user_id: userId,
        endpoint: j.endpoint,
        p256dh: j.keys && j.keys.p256dh,
        auth: j.keys && j.keys.auth,
        user_agent: (navigator.userAgent || "").slice(0, 200),
      },
      token,
    );
  } catch (e) {
    throw new Error(`save failed: ${e.message}`);
  }
  return true;
}
