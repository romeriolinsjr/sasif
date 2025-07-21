// ==================================================================
// Módulo: demandasEstruturais.js
// Responsabilidade: Lógica da página "Demandas Estruturais".
// ==================================================================

import { db } from "./firebase.js";
import { contentArea, pageTitle, showToast } from "./ui.js";
import { devedoresCache } from "./state.js";
import { navigateTo } from "./navigation.js";

let demandasCache = [];

/**
 * Renderiza a página principal de Demandas Estruturais.
 */
export function renderDemandasEstruturaisPage() {
  pageTitle.textContent = "Demandas Estruturais";
  document.title = "SASIF | Demandas Estruturais";

  contentArea.innerHTML = `
    <div class="dashboard-actions">
        <button id="add-demanda-btn" class="btn-primary">Cadastrar Nova Demanda Estrutural</button>
    </div>
    <div id="demandas-list-container">
        <p class="empty-list-message">Carregando demandas...</p>
    </div>
  `;

  document
    .getElementById("add-demanda-btn")
    .addEventListener("click", renderCadastroModal);

  // Listener de eventos para a lista
  contentArea.removeEventListener("click", handleDemandasActions); // Evita duplicatas
  contentArea.addEventListener("click", handleDemandasActions);

  setupDemandasListener();
}

/**
 * Configura o listener do Firestore para a coleção de demandas.
 */
function setupDemandasListener() {
  db.collection("demandasEstruturais")
    .orderBy("criadoEm", "desc")
    .onSnapshot(
      (snapshot) => {
        demandasCache = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        renderDemandasList();
      },
      (error) => {
        console.error("Erro ao buscar demandas estruturais:", error);
        const container = document.getElementById("demandas-list-container");
        if (container)
          container.innerHTML = `<p class="empty-list-message">Ocorreu um erro ao carregar a lista.</p>`;
      }
    );
}

/**
 * Renderiza a lista de demandas estruturais na tabela.
 */
function renderDemandasList() {
  const container = document.getElementById("demandas-list-container");
  if (!container) return;

  if (demandasCache.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhuma demanda estrutural cadastrada.</p>`;
    return;
  }

  // Cria uma cópia do cache para poder ordenar sem alterar o original
  const sortedDemandas = [...demandasCache];

  // Ordena a lista copiada com base na razão social do devedor vinculado
  sortedDemandas.sort((a, b) => {
    const devedorA = devedoresCache.find((d) => d.id === a.devedorId);
    const devedorB = devedoresCache.find((d) => d.id === b.devedorId);

    // Garante que a ordenação não quebre se um devedor não for encontrado
    const razaoSocialA = devedorA ? devedorA.razaoSocial : "";
    const razaoSocialB = devedorB ? devedorB.razaoSocial : "";

    return razaoSocialA.localeCompare(razaoSocialB);
  });

  const tableRows = sortedDemandas // <-- Usa a lista ordenada
    .map((demanda, index) => {
      const devedor = devedoresCache.find((d) => d.id === demanda.devedorId);
      const razaoSocial = devedor
        ? devedor.razaoSocial
        : "Devedor não encontrado";

      return `
        <tr class="clickable-row" data-action="view-details" data-id="${
          demanda.id
        }" data-devedor-id="${demanda.devedorId}">
            <td class="number-cell">${index + 1}</td>
            <td>${razaoSocial}</td>
            <td class="actions-cell">
                <button class="action-icon icon-edit" title="Editar" data-action="edit" data-id="${
                  demanda.id
                }">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                </button>
                <button class="action-icon icon-delete" title="Excluir" data-action="delete" data-id="${
                  demanda.id
                }">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
            </td>
        </tr>
      `;
    })
    .join("");

  container.innerHTML = `
    <table class="data-table">
        <thead>
            <tr>
                <th>#</th>
                <th>Razão Social</th>
                <th class="actions-cell">Ações</th>
            </tr>
        </thead>
        <tbody>
            ${tableRows}
        </tbody>
    </table>
  `;
}

/**
 * Renderiza o modal para cadastrar uma nova demanda.
 */
function renderCadastroModal() {
  const devedoresJaVinculados = new Set(demandasCache.map((d) => d.devedorId));
  const devedoresElegiveis = devedoresCache.filter(
    (d) => !devedoresJaVinculados.has(d.id)
  );

  // Adiciona a ordenação alfabética pela razão social
  devedoresElegiveis.sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial));

  if (devedoresElegiveis.length === 0) {
    showToast(
      "Todos os Grandes Devedores já foram cadastrados como Demanda Estrutural.",
      "error"
    );
    return;
  }

  const options = devedoresElegiveis
    .map(
      (devedor) =>
        `<option value="${devedor.id}">${devedor.razaoSocial}</option>`
    )
    .join("");

  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `
    <div class="modal-content">
        <h3>Cadastrar Nova Demanda Estrutural</h3>
        <div class="form-group">
            <label for="devedor-select">Selecione o Grande Devedor</label>
            <select id="devedor-select">
                <option value="">-- Escolha um devedor --</option>
                ${options}
            </select>
        </div>
        <div id="error-message"></div>
        <div class="form-buttons">
            <button id="save-demanda-btn" class="btn-primary">Salvar</button>
            <button id="cancel-demanda-btn" class="btn-secondary">Cancelar</button>
        </div>
    </div>
    `;

  document.body.appendChild(modalOverlay);

  const closeModal = () => document.body.removeChild(modalOverlay);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  document
    .getElementById("save-demanda-btn")
    .addEventListener("click", handleSaveDemanda);
  document
    .getElementById("cancel-demanda-btn")
    .addEventListener("click", closeModal);
}

/**
 * Salva a nova demanda no Firestore.
 */
async function handleSaveDemanda() {
  const devedorId = document.getElementById("devedor-select").value;
  const errorMessage = document.getElementById("error-message");
  errorMessage.textContent = "";

  if (!devedorId) {
    errorMessage.textContent = "Por favor, selecione um devedor.";
    return;
  }

  try {
    await db.collection("demandasEstruturais").add({
      devedorId: devedorId,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    });
    showToast("Demanda Estrutural cadastrada com sucesso!");
    document.body.removeChild(document.querySelector(".modal-overlay"));
  } catch (error) {
    console.error("Erro ao salvar demanda:", error);
    errorMessage.textContent = "Ocorreu um erro ao salvar.";
  }
}

/**
 * Exclui uma demanda do Firestore.
 * @param {string} demandaId O ID do documento da demanda a ser excluído.
 */
function handleDeleteDemanda(demandaId) {
  if (
    confirm(
      "Tem certeza que deseja remover este item da lista de Demandas Estruturais? Apenas o vínculo será removido; o Grande Devedor não será afetado."
    )
  ) {
    db.collection("demandasEstruturais")
      .doc(demandaId)
      .delete()
      .then(() => {
        showToast("Vínculo removido com sucesso.");
      })
      .catch((error) => {
        console.error("Erro ao excluir demanda:", error);
        showToast("Ocorreu um erro ao remover o vínculo.", "error");
      });
  }
}

/**
 * Lida com cliques em ações na página de demandas.
 * @param {Event} event O objeto do evento de clique.
 */
function handleDemandasActions(event) {
  const target = event.target.closest("[data-action]");
  if (!target || !target.closest("#demandas-list-container")) return;

  event.stopPropagation(); // Impede que o clique na ação dispare o clique na linha
  const action = target.dataset.action;
  const id = target.dataset.id;
  const devedorId = target.dataset.devedorId;

  if (action === "edit") {
    showToast(
      "A função de edição de detalhes será implementada no futuro.",
      "error"
    );
  } else if (action === "delete") {
    handleDeleteDemanda(id);
  } else if (action === "view-details") {
    navigateTo("demandaEstruturalDetail", { id: id, devedorId: devedorId });
  }
}

/**
 * Renderiza a página de detalhes de uma Demanda Estrutural (placeholder).
 * @param {string} demandaId O ID da demanda.
 * @param {string} devedorId O ID do devedor vinculado.
 */
export function renderDemandaEstruturalDetailPage(demandaId, devedorId) {
  const devedor = devedoresCache.find((d) => d.id === devedorId);
  const titulo = devedor ? devedor.razaoSocial : "Detalhes da Demanda";

  pageTitle.textContent = titulo;
  document.title = `SASIF | Detalhes - ${titulo}`;

  contentArea.innerHTML = `
        <div class="empty-list-message" style="text-align: center; padding-top: 40px; padding-bottom: 40px;">
            <h2 style="margin-bottom: 16px;">Página de Detalhes em Construção</h2>
            <p style="font-size: 16px; max-width: 600px; margin: 0 auto; line-height: 1.6;">
                Aqui serão exibidas todas as informações detalhadas, documentos, planos de ação, atas de reunião e múltiplos atores vinculados a esta Demanda Estrutural.
            </p>
            <p style="font-size: 14px; color: #666; margin-top: 20px;">ID da Demanda: ${demandaId}</p>
        </div>
    `;
}
