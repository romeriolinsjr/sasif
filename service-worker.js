const CACHE_NAME = "sasif-cache-v8"; // Mantemos a versão para limpar caches antigos, mas a estratégia muda.
const URLS_TO_CACHE = [
  // A lista de arquivos permanece a mesma
  "./",
  "index.html",
  "style.css",
  "manifest.json",
  "favicon.ico",
  "fonts/KFOlCnqEu92Fr1MmSU5fBBc4.woff2",
  "fonts/KFOmCnqEu92Fr1Mu4mxK.woff2",
  "fonts/KFOlCnqEu92Fr1MmEU9fBBc4.woff2",
  "fonts/KFOlCnqEu92Fr1MmWUlfBBc4.woff2",
  "images/logo.png",
  "images/logo-192x192.png",
  "images/logo-512x512.png",
  "modules/auth.js",
  "modules/configuracoes.js",
  "modules/dashboard.js",
  "modules/demandasEstruturais.js",
  "modules/devedores.js",
  "modules/firebase.js",
  "modules/importacao.js",
  "modules/investigacaoFiscal.js",
  "modules/main.js",
  "modules/navigation.js",
  "modules/processos.js",
  "modules/relatorios.js",
  "modules/state.js",
  "modules/tarefas.js",
  "modules/ui.js",
  "modules/utils.js",
];

// Evento de Instalação (permanece o mesmo)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log(
        "Service Worker: Cache aberto, tentando adicionar arquivos estáticos."
      );
      return cache.addAll(URLS_TO_CACHE).catch((error) => {
        console.error(
          "Service Worker: Falha ao cachear um ou mais arquivos durante a instalação.",
          error
        );
      });
    })
  );
});

// Evento de Fetch (REVERTIDO PARA A ESTRATÉGIA "NETWORK FIRST")
self.addEventListener("fetch", (event) => {
  event.respondWith(
    // 1. Tenta buscar o recurso na rede primeiro.
    fetch(event.request)
      .then((networkResponse) => {
        // Se a busca na rede for bem-sucedida,
        // clona a resposta para poder guardá-la no cache e retorná-la ao navegador.
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // 2. Se a busca na rede falhar (offline),
        // tenta servir o recurso a partir do cache.
        return caches.match(event.request);
      })
  );
});

// Evento de Ativação (permanece o mesmo)
self.addEventListener("activate", (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log("Service Worker: Limpando cache antigo:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
