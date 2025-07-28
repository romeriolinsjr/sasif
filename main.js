// ==================================================================
// Módulo: main.js
// Responsabilidade: Ponto de entrada da aplicação. Orquestra a inicialização.
// ==================================================================

import { auth, db } from "./firebase.js";
import { renderLoginForm } from "./auth.js";
import { navigateTo } from "./navigation.js";
import {
  appContainer,
  loginContainer,
  userEmailSpan,
  logoutButton,
  updateLastBackupTime,
  setupSidebarListener,
} from "./ui.js";
import * as state from "./state.js";
import { formatCNPJForDisplay, formatProcessoForDisplay } from "./utils.js";
import { showDevedorPage } from "./devedores.js";

/**
 * Inicializa a aplicação principal após o login do usuário.
 * @param {object} user - O objeto do usuário do Firebase.
 */
export function initApp(user) {
  userEmailSpan.textContent = user.email;
  logoutButton.addEventListener("click", () => auth.signOut());

  setupGlobalSearch();
  setupListeners();
  setupSidebarListener();

  // A chamada 'updateLastBackupTime()' foi REMOVIDA daqui.

  // Este listener continua aqui, pois ele é para atualizações em tempo real.
  window.addEventListener("backupCompleted", updateLastBackupTime);

  navigateTo("dashboard");
}
/**
 * Configura os listeners globais que alimentam os caches da aplicação.
 */
function setupListeners() {
  // Listener para Grandes Devedores
  db.collection("grandes_devedores")
    .orderBy("nivelPrioridade")
    .orderBy("razaoSocial")
    .onSnapshot((snapshot) => {
      const devedores = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      state.setDevedoresCache(devedores);
      // Re-renderiza a página se o usuário estiver nela
      if (document.title.includes("Grandes Devedores")) {
        navigateTo("grandesDevedores");
      }
      if (document.title.includes("Dashboard")) {
        navigateTo("dashboard");
      }
    });

  // Listener para Exequentes
  db.collection("exequentes")
    .orderBy("nome")
    .onSnapshot((snapshot) => {
      const exequentes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      state.setExequentesCache(exequentes);
      if (document.title.includes("Exequentes")) {
        navigateTo("exequentes");
      }
    });

  // Listener para Motivos de Suspensão
  db.collection("motivos_suspensao")
    .orderBy("descricao")
    .onSnapshot((snapshot) => {
      const motivos = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      state.setMotivosSuspensaoCache(motivos);
      if (document.title.includes("Motivos de Suspensão")) {
        navigateTo("motivos");
      }
    });
}

/**
 * Configura a funcionalidade de busca global.
 */
function setupGlobalSearch() {
  const searchInput = document.getElementById("global-search-input");
  const resultsContainer = document.getElementById("search-results-container");
  let searchTimeout;

  if (!searchInput || !resultsContainer) return;

  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    const searchTerm = e.target.value.trim();
    if (searchTerm.length < 3) {
      resultsContainer.style.display = "none";
      return;
    }

    searchTimeout = setTimeout(async () => {
      const searchTermLower = searchTerm.toLowerCase();
      const searchTermNumerico = searchTerm.replace(/\D/g, "");
      const promises = [];

      const devedoresFound = state.devedoresCache.filter(
        (devedor) =>
          devedor.razaoSocial.toLowerCase().includes(searchTermLower) ||
          (devedor.nomeFantasia &&
            devedor.nomeFantasia.toLowerCase().includes(searchTermLower))
      );

      if (searchTermNumerico.length > 0) {
        promises.push(
          db
            .collection("processos")
            .where("numeroProcesso", ">=", searchTermNumerico)
            .where("numeroProcesso", "<=", searchTermNumerico + "\uf8ff")
            .get()
        );
        promises.push(
          db
            .collection("processos")
            .where("cdasNormalizadas", "array-contains", searchTermNumerico)
            .get()
        );
        promises.push(
          db
            .collection("incidentesProcessuais")
            .where("numeroIncidente", ">=", searchTermNumerico)
            .where("numeroIncidente", "<=", searchTermNumerico + "\uf8ff")
            .get()
        );
      }

      const [processosResult, cdasResult, incidentesResult] = await Promise.all(
        promises
      );
      let processosFound = processosResult
        ? processosResult.docs.map((doc) => ({ ...doc.data(), id: doc.id }))
        : [];
      let cdasFound = cdasResult
        ? cdasResult.docs.map((doc) => ({ ...doc.data(), id: doc.id }))
        : [];
      let incidentesFound = incidentesResult
        ? incidentesResult.docs.map((doc) => ({ ...doc.data(), id: doc.id }))
        : [];

      renderSearchResults(
        devedoresFound,
        processosFound,
        cdasFound,
        incidentesFound
      );
    }, 300);
  });

  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target)) {
      resultsContainer.style.display = "none";
    }
  });
}

/**
 * Renderiza os resultados da busca global.
 */
function renderSearchResults(devedores, processos, cdas, incidentes) {
  const resultsContainer = document.getElementById("search-results-container");
  const searchInput = document.getElementById("global-search-input");
  resultsContainer.innerHTML = "";

  if (
    devedores.length === 0 &&
    processos.length === 0 &&
    cdas.length === 0 &&
    incidentes.length === 0
  ) {
    resultsContainer.innerHTML = `<div class="search-result-item"><span class="search-result-subtitle">Nenhum resultado encontrado.</span></div>`;
    resultsContainer.style.display = "block";
    return;
  }

  if (devedores.length > 0) {
    resultsContainer.innerHTML += `<div class="search-results-header">Grandes Devedores</div>`;
    devedores.forEach((devedor) => {
      const item = document.createElement("div");
      item.className = "search-result-item";
      item.innerHTML = `<span class="search-result-title">${
        devedor.razaoSocial
      }</span><span class="search-result-subtitle">${formatCNPJForDisplay(
        devedor.cnpj
      )}</span>`;
      item.addEventListener("click", () => {
        showDevedorPage(devedor.id);
        searchInput.value = "";
        resultsContainer.style.display = "none";
      });
      resultsContainer.appendChild(item);
    });
  }

  const allProcessos = [
    ...processos,
    ...cdas,
    ...incidentes.map((inc) => ({
      ...inc,
      numeroProcesso: inc.numeroIncidente,
      isIncidente: true,
    })),
  ];
  const uniqueProcessos = allProcessos.filter(
    (p, index, self) => index === self.findIndex((t) => t.id === p.id)
  );

  if (uniqueProcessos.length > 0) {
    resultsContainer.innerHTML += `<div class="search-results-header">Processos e Incidentes</div>`;
    uniqueProcessos.forEach((processo) => {
      const devedor = state.devedoresCache.find(
        (d) => d.id === processo.devedorId
      );
      const item = document.createElement("div");
      item.className = "search-result-item";
      item.innerHTML = `<span class="search-result-title">${formatProcessoForDisplay(
        processo.numeroProcesso || processo.numeroIncidente
      )} ${
        processo.isIncidente
          ? '<span class="status-badge" style="background-color:#6a1b9a; font-size:10px;">Incidente</span>'
          : ""
      }</span><span class="search-result-subtitle">Devedor: ${
        devedor ? devedor.razaoSocial : "N/A"
      }</span>`;
      item.addEventListener("click", async () => {
        searchInput.value = "";
        resultsContainer.style.display = "none";
        if (processo.isIncidente) {
          const snapshot = await db
            .collection("processos")
            .where("numeroProcesso", "==", processo.numeroProcessoPrincipal)
            .limit(1)
            .get();
          if (!snapshot.empty) {
            navigateTo("processoDetail", { id: snapshot.docs[0].id });
          } else {
            showToast(
              "Processo principal do incidente não encontrado.",
              "error"
            );
          }
        } else {
          navigateTo("processoDetail", { id: processo.id });
        }
      });
      resultsContainer.appendChild(item);
    });
  }

  resultsContainer.style.display = "block";
}

// --- Ponto de Partida da Aplicação ---
// Este listener é acionado quando o HTML está totalmente carregado.
document.addEventListener("DOMContentLoaded", () => {
  // O Firebase verifica se o usuário já está logado (sessão persistente).
  auth.onAuthStateChanged((user) => {
    if (user) {
      // Se estiver logado, mostra o app.
      appContainer.classList.remove("hidden");
      loginContainer.classList.add("hidden");
      initApp(user);
    } else {
      // Se não estiver logado, mostra a tela de login.
      appContainer.classList.add("hidden");
      loginContainer.classList.remove("hidden");
      renderLoginForm();
    }
  });
});
