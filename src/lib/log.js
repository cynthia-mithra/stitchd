// Lightweight logger.
// -------------------
// Stays silent in production so a buyer's browser console is clean and never
// shows internal failures, while giving full output in development for
// debugging. Errors still surface to the user through the app's flash() toasts;
// this is purely the developer-facing console channel. A real error-tracking
// service (Sentry etc.) can be wired in here later without touching call sites.
const DEV = process.env.NODE_ENV !== "production";

export const logError = (...args) => { if (DEV) console.error(...args); };
export const logWarn = (...args) => { if (DEV) console.warn(...args); };
