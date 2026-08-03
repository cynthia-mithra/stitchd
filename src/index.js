import React from 'react';import{createRoot}from 'react-dom/client';import App from './App';import ErrorBoundary from './components/ErrorBoundary';import{initNative,isNative}from './lib/native';const root=createRoot(document.getElementById('root'));root.render(<ErrorBoundary><App/></ErrorBoundary>);
// Native shell: set status bar + hide splash (no-op on the web).
initNative();
// Register the service worker (installable + offline). Production only, so the
// dev server isn't affected by caching. Registered after load so it never
// competes with the first paint.
// Skip the service worker inside the native app — Capacitor serves the bundled
// assets itself, and a SW intercepting capacitor://localhost only causes stale
// caching. The SW stays on for the web PWA.
if(process.env.NODE_ENV==='production'&&'serviceWorker'in navigator&&!isNative()){
  // Auto-update: when a new deploy's service worker takes control, reload once so
  // installed PWAs pick up the latest code instead of getting stuck on a cached
  // old version (the classic iOS "add to home screen" staleness). Only reloads on
  // an UPDATE (a controller already existed), never on the first-ever install.
  const hadController=!!navigator.serviceWorker.controller;
  let refreshing=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(refreshing||!hadController) return;
    refreshing=true;
    window.location.reload();
  });
  window.addEventListener('load',()=>{ navigator.serviceWorker.register('/sw.js').catch(()=>{}); });
}
