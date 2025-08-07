const CACHE_NAME = "sasif-cache-v8"; // Versão final incrementada
const URLS_TO_CACHE = [
  // --- Arquivos da Raiz ---
  "./",
  "index.html",
  "style.css",
  "manifest.json",
  "favicon.ico",

  // --- Imagens ---
  "images/logo.png",
  "images/logo-192x192.png",
  "images/logo-512x512.png",

  // --- Fontes Locais ---
  "fonts/KFOlCnqEu92Fr1MmSU5fBBc4.woff2", // Light 300
  "fonts/KFOmCnqEu92Fr1Mu4mxK.woff2", // Regular 400
  "fonts/KFOlCnqEu92Fr1MmEU9fBBc4.woff2", // Medium 500
  "fonts/KFOlCnqEu92Fr1MmWUlfBBc4.woff2", // Bold 700

  // --- Módulos JavaScript (com sua adição incluída) ---
  "modules/auth.js",
  "modules/configuracoes.js",
  "modules/dashboard.js",
  "modules/demandasEstruturais.js",
  "modules/devedores.js",
  "modules/firebase.js",
  "modules/importacao.js",
  "modules/investigacaoFiscal.js", // SUA ADIÇÃO CORRETA
  "modules/main.js",
  "modules/navigation.js",
  "modules/processos.js",
  "modules/relatorios.js",
  "modules/state.js",
  "modules/tarefas.js",
  "modules/ui.js",
  "modules/utils.js",
];

// Evento de Instalação: Salva os arquivos estáticos no cache.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log(
        "Service Worker: Cache aberto, tentando adicionar arquivos estáticos."
      );
      return cache
        .addAll(URLS_TO_CACHE)
        .then(() => {
          console.log(
            "Service Worker: Todos os arquivos foram cacheados com sucesso!"
          );
        })
        .catch((error) => {
          console.error(
            "Service Worker: Falha ao cachear um ou mais arquivos. Verifique se todos os caminhos em URLS_TO_CACHE estão corretos.",
            error
          );
          throw error;
        });
    })
  );
});

// Evento de Fetch: Intercepta as requisições.
// Tenta servir do cache primeiro, se não encontrar, vai para a rede.
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request);
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
            console.log("Service Worker: Limpando cache antigo:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
