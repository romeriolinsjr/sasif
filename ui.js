// = a================================================================
// Módulo: ui.js
// Responsabilidade: Funções que manipulam a interface do usuário de forma genérica.
// ==================================================================

import { navigateTo } from "./navigation.js";

// --- Referências aos Elementos DOM Principais ---
export const appContainer = document.getElementById("app-container");
export const loginContainer = document.getElementById("login-container");
export const userEmailSpan = document.getElementById("user-email");
export const logoutButton = document.getElementById("logout-button");
export const contentArea = document.getElementById("content-area");
export const pageTitle = document.getElementById("page-title");
export const mainNav = document.getElementById("main-nav");

/**
 * Exibe uma notificação "toast" na tela.
 * @param {string} message A mensagem a ser exibida.
 * @param {'success' | 'error' | 'info' | 'warning'} type O tipo de notificação.
 * @param {number|null} duration Duração em ms. Se for null, o toast fica fixo.
 */
export function showToast(message, type = "success", duration = 4000) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  // Adiciona um botão de fechar para toasts persistentes
  if (duration === null) {
    const closeButton = document.createElement("button");
    closeButton.innerHTML = "×";
    closeButton.className = "toast-close-btn";
    closeButton.onclick = () => toast.remove();
    toast.appendChild(closeButton);
  }

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("show");
  }, 10);

  if (duration !== null) {
    setTimeout(() => {
      toast.classList.remove("show");
      toast.addEventListener("transitionend", () => toast.remove());
    }, duration);
  }
}

/**
 * Renderiza a barra de navegação lateral (sidebar) e marca a página ativa.
 * @param {string} activePage O ID da página atualmente ativa.
 */
export function renderSidebar(activePage) {
  const pages = [
    { id: "dashboard", name: "Dashboard" },
    { id: "grandesDevedores", name: "Grandes Devedores" },
    { id: "demandasEstruturais", name: "Demandas Estruturais" },
    { id: "diligencias", name: "Tarefas do Mês" },
    { id: "relatorios", name: "Relatórios" },
    { id: "configuracoes", name: "Configurações" },
  ];
  mainNav.innerHTML = `<ul>${pages
    .map(
      (page) =>
        `<li><a href="#" class="nav-link ${
          page.id === activePage ? "active" : ""
        }" data-page="${page.id}">${page.name}</a></li>`
    )
    .join("")}</ul>`;
  mainNav.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      navigateTo(e.target.dataset.page);
    });
  });
}
/**
 * Renderiza um modal genérico para exibir um texto somente leitura.
 * @param {string} title O título do modal.
 * @param {string} content O conteúdo de texto a ser exibido.
 */
export function renderReadOnlyTextModal(title, content) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";

  modalOverlay.innerHTML = `
        <div class="modal-content">
            <h3>${title}</h3>
            <div class="readonly-textarea">${
              content
                ? content.replace(/\n/g, "<br>")
                : "Nenhuma informação cadastrada."
            }</div>
            <div class="form-buttons" style="justify-content: flex-end; margin-top: 20px;">
                <button id="close-readonly-modal" class="btn-secondary">Fechar</button>
            </div>
        </div>
    `;

  document.body.appendChild(modalOverlay);

  const closeModal = () => document.body.removeChild(modalOverlay);

  document
    .getElementById("close-readonly-modal")
    .addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
}

/**
 * Exibe a sobreposição de carregamento com uma mensagem inicial e uma barra de progresso.
 * @param {string} initialMessage - A mensagem a ser exibida inicialmente.
 */
export function showLoadingOverlay(initialMessage = "Carregando...") {
  // Se já existir, apenas atualiza a mensagem
  let overlay = document.getElementById("loading-overlay");
  if (overlay) {
    const messageSpan = overlay.querySelector(".loading-message");
    if (messageSpan) messageSpan.textContent = initialMessage;
    return;
  }

  overlay = document.createElement("div");
  overlay.id = "loading-overlay";
  overlay.innerHTML = `
        <div class="loading-box">
            <div class="spinner"></div>
            <span class="loading-message">${initialMessage}</span>
            <div class="progress-bar-container">
                <div class="progress-bar-fill"></div>
            </div>
        </div>
    `;
  document.body.appendChild(overlay);
}

/**
 * Atualiza a mensagem e a barra de progresso na sobreposição de carregamento.
 * @param {number} progress - O progresso atual (0 a 100).
 * @param {string} message - A mensagem a ser exibida.
 */
export function updateLoadingOverlay(progress, message) {
  const overlay = document.getElementById("loading-overlay");
  if (!overlay) return;

  const messageSpan = overlay.querySelector(".loading-message");
  const progressBarFill = overlay.querySelector(".progress-bar-fill");
  const progressBarContainer = overlay.querySelector(".progress-bar-container");

  if (message) {
    messageSpan.textContent = message;
  }

  // Mostra a barra de progresso apenas se um progresso válido for fornecido
  if (progress >= 0 && progress <= 100) {
    progressBarContainer.style.display = "block";
    progressBarFill.style.width = `${progress}%`;
  } else {
    progressBarContainer.style.display = "none";
  }
}

/**
 * Oculta a sobreposição de carregamento.
 */
export function hideLoadingOverlay() {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) {
    overlay.remove();
  }
}
