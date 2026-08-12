// Minimal, hand-written Service Worker — no build-time SW generation
// plugin, so this file's behavior is fully transparent and easy to verify.
// Two responsibilities only: show a notification when a push arrives, and
// focus/open the app when the user taps it. No caching/offline strategy is
// implemented in this phase (not required by the spec: "receive push
// notifications", not "work offline").

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Fires even when no tab is open, as long as the browser/OS keeps the
// subscription alive — this is what makes "closed app" delivery possible.
self.addEventListener('push', (event) => {
  let payload = { title: 'Krishna IPTV', body: 'You have a new notification.' };
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Krishna IPTV', {
      body: payload.body || '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: payload.data || {},
    })
  );
});

// Tapping the notification focuses an already-open tab if one exists,
// otherwise opens a new one at the app root.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
