import React from 'react';import{createRoot}from 'react-dom/client';import App from './App';import ErrorBoundary from './components/ErrorBoundary';const root=createRoot(document.getElementById('root'));root.render(<ErrorBoundary><App/></ErrorBoundary>);
// Register the service worker (installable + offline). Production only, so the
// dev server isn't affected by caching. Registered after load so it never
// competes with the first paint.
if(process.env.NODE_ENV==='production'&&'serviceWorker'in navigator){
  window.addEventListener('load',()=>{ navigator.serviceWorker.register('/sw.js').catch(()=>{}); });
}
