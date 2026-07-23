/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;
declare const __WB_MANIFEST: Array<{ url: string; revision: string | null }>;

self.addEventListener('install', (event) => {
  const manifestEntries = self.__WB_MANIFEST;
  event.waitUntil(Promise.resolve(manifestEntries).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() as {
    title?: string;
    body?: string;
    icon?: string;
    data?: {
      type?: string;
      daysUntil?: number;
      phaseTransition?: {
        from?: string | null;
        to?: string;
      };
    };
  };

  const title = data?.title || 'Period Tracker';
  const body = data?.body || 'You have a new cycle reminder';
  const icon = data?.icon || '/favicon-192x192.png';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/favicon-48x48.png',
      data: {
        url: '/',
        type: data?.data?.type,
        daysUntil: data?.data?.daysUntil,
        phaseTransition: data?.data?.phaseTransition
      },
      tag: 'period-tracker-notification'
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('url' in client && client.url.includes(location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return null;
    })
  );
});
