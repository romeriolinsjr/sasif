const CACHE_NAME = "sasif-cache-v8"; // Mantemos a versão, pois a lista de arquivos não muda.
const URLS_TO_CACHE = [
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

// Evento de Instalação (sem alterações)
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

// Evento de Fetch (COM A CORREÇÃO)
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          // --- INÍCIO DA CORREÇÃO ---
          // SÓ ARMAZENA EM CACHE SE A REQUISIÇÃO FOR DO TIPO GET
          if (event.request.method === "GET") {
            cache.put(event.request, networkResponse.clone());
          }
          // --- FIM DA CORREÇÃO ---

          return networkResponse;
        });
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Evento de Ativação (sem alterações)
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
