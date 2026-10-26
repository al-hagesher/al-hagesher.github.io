/* על הגשר — עבודה גם בלי אינטרנט (כשהאפליקציה מותקנת מכתובת אינטרנט) */
const CACHE = 'al-hagesher-202610261731';
const FILES = ['./', 'index.html', 'order.html', 'css/style.css', 'assets/logo.png', 'assets/icon.png', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/apple-touch-icon.png', 'manifest.webmanifest',
  'js/theme.js', 'js/order.js', 'js/core.js', 'js/seed.js', 'js/library.js', 'js/ui.js', 'js/sync.js', 'js/form.js', 'js/app.js', 'js/pages/dashboard.js', 'js/pages/recipes.js', 'js/pages/pantry.js', 'js/pages/orders.js',
  'js/pages/production.js', 'js/pages/customers.js', 'js/pages/expenses.js', 'js/pages/stats.js', 'js/pages/wheel.js', 'js/pages/tools.js', 'js/pages/settings.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// רשת קודם, מטמון כגיבוי — כך עדכונים נכנסים מיד
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const same = new URL(e.request.url).origin === location.origin;
  // תמיד בודקים מול השרת (ETag) כדי שעדכונים יגיעו מיד; המטמון רק לעבודה בלי אינטרנט
  e.respondWith(fetch(e.request, same ? { cache: 'no-cache' } : undefined).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); return r; }).catch(() => caches.match(e.request)));
});
