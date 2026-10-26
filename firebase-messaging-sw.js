/* Firebase Cloud Messaging background handler.
   Copy the same public firebaseConfig values from firebase-config.js below before deploying push. */
importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js');
const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
};
if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage(payload => {
    const notification = payload.notification || {};
    self.registration.showNotification(notification.title || 'InventarisKu · IMM–UMKT', {
      body: notification.body || 'Ada pengingat atau pembaruan inventaris.',
      icon: './assets/logo-umkt.png',
      badge: './assets/logo-imm.png',
      data: { url: self.location.origin + '/index.html' }
    });
  });
}
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type:'window', includeUncontrolled:true }).then(windowClients => {
    for (const client of windowClients) if ('focus' in client) return client.focus();
    if (clients.openWindow) return clients.openWindow(self.location.origin + '/index.html');
  }));
});
