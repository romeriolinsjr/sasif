const CACHE_NAME = "sasif-cache-v3"; // Versão incrementada para forçar a atualização
const URLS_TO_CACHE = [
  // --- Arquivos da Raiz ---
  "./", // CORRIGIDO: Representa a raiz do seu projeto (a página inicial)
  "index.html",
  "style.css",
  "manifest.json", // ADICIONADO: Essencial para o PWA
  "favicon.ico", // ADICIONADO: Ícone da aplicação

  // --- Imagens ---
  "images/logo.png",
  "images/logo-192x192.png",
  "images/logo-512x512.png",

  // --- Módulos JavaScript (com o caminho correto) ---
  "modules/auth.js",
  "modules/configuracoes.js",
  "modules/dashboard.js",
  "modules/demandasEstruturais.js", // ADICIONADO: Estava faltando na lista anterior
  "modules/devedores.js",
  "modules/firebase.js",
  "modules/importacao.js",
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
            "Service Worker: Falha ao cachear um ou mais arquivos.",
            error
          );
          // Lança o erro para que a instalação do SW falhe, indicando que algo está errado.
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
      // Se encontrou no cache, retorna do cache.
      if (response) {
        return response;
      }
      // Se não, vai para a rede.
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
