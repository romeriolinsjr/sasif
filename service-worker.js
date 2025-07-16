const CACHE_NAME = "sasif-cache-v2";
const URLS_TO_CACHE = [
  "/",
  "/sasif/",
  "index.html",
  "style.css",
  "images/logo.png",
  "images/logo-192x192.png",
  "images/logo-512x512.png",
  "auth.js",
  "configuracoes.js",
  "dashboard.js",
  "devedores.js",
  "firebase.js",
  "importacao.js",
  "main.js",
  "navigation.js",
  "processos.js",
  "relatorios.js",
  "state.js",
  "tarefas.js",
  "ui.js",
  "utils.js",
];

// Evento de Instalação: Salva os arquivos estáticos no cache.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Cache aberto");
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

// Evento de Fetch: Intercepta as requisições.
// Tenta servir do cache primeiro, se não encontrar, vai para a rede.
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response; // Se encontrou no cache, retorna do cache.
      }
      return fetch(event.request); // Se não, vai para a rede.
    })
  );
});

// Evento de Ativação: Limpa caches antigos.
self.addEventListener("activate", (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
