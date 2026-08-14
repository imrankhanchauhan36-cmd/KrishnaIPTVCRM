import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Registered unconditionally (not gated behind login/push opt-in) so Chrome
// sees a controlling service worker on first visit — a hard requirement for
// the native install/"Add to Home Screen" prompt to ever appear. push.ts's
// registerForPushNotifications() also registers '/sw.js' when a user opts
// into notifications; both calls target the same script URL, which the
// Service Worker API treats as idempotent (reuses the existing registration).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
