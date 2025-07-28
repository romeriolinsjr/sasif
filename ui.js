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
    {
      id: "dashboard",
      name: "Dashboard",
      icon: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
    },
    {
      id: "grandesDevedores",
      name: "Grandes Devedores",
      icon: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
    },
    {
      id: "demandasEstruturais",
      name: "Demandas Estruturais",
      icon: "M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z",
    },
    {
      id: "diligencias",
      name: "Tarefas do Mês",
      icon: "M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7v-5z",
    },
    {
      id: "relatorios",
      name: "Relatórios",
      icon: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z",
    },
    {
      id: "importacao",
      name: "Importação em Lote",
      icon: "M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z",
    },
    {
      id: "configuracoes",
      name: "Configurações",
      icon: "M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69-.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59-1.69-.98l2.49 1c.23.09.49 0 .61.22l2 3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z",
    },
  ];

  const menuHTML = pages
    .map(
      (page) =>
        `<li>
          <a href="#" class="nav-link ${
            page.id === activePage ? "active" : ""
          }" data-page="${page.id}">
            <svg class="sidebar-icon" viewBox="0 0 24 24"><path d="${
              page.icon
            }"/></svg>
            <span class="sidebar-text">${page.name}</span>
          </a>
        </li>`
    )
    .join("");

  const backupInfoHTML = `
    <div class="sidebar-info-container">
        <div class="sidebar-info-item">
            <span class="sidebar-info-label">Último Backup:</span>
            <span id="last-backup-status"></span>
        </div>
    </div>
  `;

  mainNav.innerHTML = `<ul>${menuHTML}</ul>${backupInfoHTML}`;

  // CORREÇÃO: Chama a função para preencher a data LOGO APÓS o HTML ser criado.
  updateLastBackupTime();
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

/**
 * Lê o timestamp do último backup do localStorage e atualiza a UI na barra lateral.
 */
/**
 * Lê o timestamp do último backup do localStorage e atualiza a UI na barra lateral.
 */
export function updateLastBackupTime() {
  const statusElement = document.getElementById("last-backup-status");
  if (!statusElement) return;

  const timestamp = localStorage.getItem("sasif_last_backup_timestamp");

  if (timestamp) {
    const backupDate = new Date(timestamp);
    const formattedDate = backupDate.toLocaleDateString("pt-BR");
    const formattedTime = backupDate.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    statusElement.textContent = `${formattedDate}, ${formattedTime}`;
    // CORREÇÃO: Usando uma cor verde clara e brilhante para bom contraste
    statusElement.style.color = "#81C784";
  } else {
    statusElement.textContent = "Nunca realizado";
    // CORREÇÃO: Usando uma cor amarela brilhante para bom contraste
    statusElement.style.color = "#FFD54F";
  }
}

/**
 * Configura o listener de navegação da sidebar usando delegação de eventos.
 * Deve ser chamada APENAS UMA VEZ na inicialização do app.
 */
export function setupSidebarListener() {
  mainNav.addEventListener("click", (e) => {
    const link = e.target.closest(".nav-link");
    if (link && link.dataset.page) {
      e.preventDefault();
      navigateTo(link.dataset.page);
    }
  });
}
