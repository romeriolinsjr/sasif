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
    { id: "diligencias", name: "Tarefas do Mês" },
    { id: "relatorios", name: "Relatórios" },
    { id: "importacao", name: "Importação em Lote" },
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
