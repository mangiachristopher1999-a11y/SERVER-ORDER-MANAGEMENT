cconst CACHE_NAME = 'cameriere-pro-v2';

// I file essenziali che vogliamo salvare per l'utilizzo offline
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 1. Fase di Installazione: il Service Worker si scarica i file
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Cache aperta. Salvataggio assets...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. Fase di Attivazione: pulisce le cache vecchie se aggiorni CACHE_NAME (es. v2)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Eliminazione vecchia cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// 3. Fase di Fetch: Strategia "Cache First, fallback to Network"
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Se il file è nella cache, restituiscilo immediatamente
      if (cachedResponse) {
        return cachedResponse;
      }
      // Altrimenti fai la normale richiesta di rete
      return fetch(event.request);
    }).catch(() => {
      // Opzionale: qui potresti restituire una pagina di "Sei completamente offline"
      // Ma essendo una Single Page Application con la cache dei file base, non serve.
    })
  );
});
