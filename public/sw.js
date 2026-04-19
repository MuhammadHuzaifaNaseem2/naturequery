// Empty Service Worker to prevent 404s from previous registrations
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  // Unregister the service worker completely
  self.registration.unregister()
    .then(() => {
      return self.clients.matchAll();
    })
    .then((clients) => {
      clients.forEach((client) => {
        if (client.url && "navigate" in client) {
          // If we need to force reload, we can do it here, but usually just unregistering is enough
        }
      });
    });
});
