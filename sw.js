const CACHE_NAME = 'cameriere-pro-v9';

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

// 1. Fase di Installazione: il Service Worker si scarica i file (INTATTA)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Cache aperta. Salvataggio assets...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. Fase di Attivazione: pulisce le cache vecchie se aggiorni CACHE_NAME (INTATTA)
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

// 3. Fase di Fetch: Strategia "Stale-While-Revalidate" (NUOVA STRUTTURA CHIRURGICA)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        // Avvia la richiesta di rete in background per aggiornare la cache
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // Salva silenziosamente la versione più recente
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }).catch(() => {
        });
        
        // Restituisce il file in cache (istantaneo) OPPURE aspetta la rete se è il primo download
        return cachedResponse || fetchPromise;
      });
    })
  );
});
