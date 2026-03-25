const CACHE_NAME = 'nyt-explorer-v2';

// Assets to cache immediately on install (App Shell)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/icons/logo.png'
];

// --- INSTALL: Cache the App Shell ---
self.addEventListener('install', (event) => {
  console.log('[SW] Installing v2...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching App Shell');
      // allSettled: no falla el install si un asset no carga (ej. fuentes externas)
      return Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url)));
    })
  );
  self.skipWaiting(); // Activar inmediatamente sin esperar al cierre de otras pestañas
});

// --- ACTIVATE: Limpiar caches viejos ---
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Eliminando cache antiguo:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim(); // Tomar control inmediato de todos los clientes abiertos
});

// --- FETCH: Estrategia híbrida ---
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar peticiones que no son GET (POST, etc.) o de otras extensiones del navegador
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Estrategia para NYT API: Network First → fallback a cache
  // Siempre intentamos obtener datos frescos de la API
  if (url.hostname === 'api.nytimes.com') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Guardar copia fresca en cache para uso offline
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return networkResponse;
        })
        .catch(() => {
          console.log('[SW] API sin conexión, sirviendo desde cache:', request.url);
          return caches.match(request).then(cached => {
            if (cached) return cached;
            // Si tampoco está en cache, devolver una respuesta de error amigable
            return new Response(
              JSON.stringify({ error: 'Sin conexión a internet. Datos no disponibles.' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // Estrategia para fuentes de Google Fonts: Stale-While-Revalidate
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          // Clonamos la respuesta antes de ponerla en caché para no consumirla
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
          return networkResponse;
        });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Estrategia para assets estáticos (CSS, JS, HTML, imágenes): Cache First
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then((networkResponse) => {
        // Solo cachear respuestas válidas
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return networkResponse;
      });
    })
  );
});
