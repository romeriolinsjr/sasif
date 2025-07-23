// ==================================================================
// Módulo: ui.js
// Responsabilidade: Funções que manipulam a interface do usuário de forma genérica.
// ==================================================================

import { navigateTo } from "./navigation.js";

// --- Referências aos Elementos DOM Principais ---
// Exporta referências diretas para os elementos mais usados do index.html.
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
 * @param {'success' | 'error'} type O tipo de notificação (para estilização).
 */
export function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("show");
  }, 10);
  setTimeout(() => {
    toast.remove();
  }, 3000);
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
 * Exibe uma sobreposição de carregamento na tela inteira.
 * @param {string} message - A mensagem a ser exibida (ex: "Excluindo...").
 */
export function showLoadingOverlay(message = "Processando...") {
  const overlay = document.createElement("div");
  overlay.id = "loading-overlay";
  overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        color: white;
        font-size: 24px;
        z-index: 2000;
        flex-direction: column;
        gap: 20px;
    `;

  overlay.innerHTML = `
        <div class="spinner" style="
            border: 8px solid #f3f3f3;
            border-top: 8px solid var(--cor-secundaria);
            border-radius: 50%;
            width: 60px;
            height: 60px;
            animation: spin 1s linear infinite;
        "></div>
        <span>${message}</span>
        <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
    `;

  document.body.appendChild(overlay);
}

/**
 * Remove a sobreposição de carregamento da tela.
 */
export function hideLoadingOverlay() {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) {
    overlay.remove();
  }
}
