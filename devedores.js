// ==================================================================
// Módulo: devedores.js
// Responsabilidade: Gerenciamento completo da entidade "Grandes Devedores".
// ==================================================================

import { db, auth } from "./firebase.js"; // <--- ADICIONE , auth
import {
  contentArea,
  pageTitle,
  showToast,
  renderSidebar,
  showLoadingOverlay,
  hideLoadingOverlay,
} from "./ui.js";
import { navigateTo } from "./navigation.js";
import {
  formatCNPJForDisplay,
  getAnaliseStatus,
  formatProcessoForDisplay,
  maskCNPJ, // <--- ADICIONE ESTA LINHA
} from "./utils.js";
import * as state from "./state.js";
import { renderProcessoForm, setupProcessosListener } from "./processos.js";

/**
 * Renderiza a página principal de "Grandes Devedores".
 */

export function renderGrandesDevedoresPage() {
  pageTitle.textContent = "Grandes Devedores";
  document.title = "SASIF | Grandes Devedores";

  // Adicionado o botão de exportação ao lado do botão de cadastro
  contentArea.innerHTML = `
        <div class="dashboard-actions">
            <button id="add-devedor-btn" class="btn-primary">Cadastrar Novo Devedor</button>
            <button id="export-devedores-btn" class="action-icon" title="Exportar Lista de Devedores">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            </button>
        </div>
        <h2>Lista de Grandes Devedores</h2>
        <div id="devedores-list-container"></div>
    `;

  document.getElementById("add-devedor-btn").addEventListener("click", () => renderDevedorForm());
  // Novo listener para o botão de exportação
  document.getElementById("export-devedores-btn").addEventListener("click", renderExportOptionsModal);

  renderDevedoresList(state.devedoresCache);
}```

**Ação 2:** Adicione as três novas funções abaixo ao final do seu arquivo `devedores.js`.

**Objetivo:**
- `renderExportOptionsModal`: Cria e exibe o modal para o usuário escolher entre CSV e PDF.
- `exportDevedoresToCSV`: Gera e baixa o arquivo CSV.
- `exportDevedoresToPDF`: Gera e baixa o arquivo PDF, reaproveitando a lógica de `relatorios.js`.

```javascript
/**
 * Renderiza um modal para o usuário escolher o formato de exportação.
 */
function renderExportOptionsModal() {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `
    <div class="modal-content export-options-modal">
        <h3>Exportar Lista de Devedores</h3>
        <p>Selecione o formato desejado para o arquivo.</p>
        <div class="form-buttons">
            <button data-action="export-csv" class="btn-primary">Exportar para CSV</button>
            <button data-action="export-pdf" class="btn-primary">Exportar para PDF</button>
            <button data-action="close-modal" class="btn-secondary">Cancelar</button>
        </div>
    </div>
  `;
  document.body.appendChild(modalOverlay);

  modalOverlay.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action === 'export-csv') {
          exportDevedoresToCSV();
          modalOverlay.remove();
      } else if (action === 'export-pdf') {
          exportDevedoresToPDF();
          modalOverlay.remove();
      } else if (action === 'close-modal' || e.target === modalOverlay) {
          modalOverlay.remove();
      }
  });
}

/**
 * Exporta a lista de devedores (razão social e CNPJ) para um arquivo CSV.
 */
function exportDevedoresToCSV() {
    if (state.devedoresCache.length === 0) {
        showToast("Não há devedores para exportar.", "warning");
        return;
    }

    // Cabeçalho do CSV
    let csvContent = "Razão Social,CNPJ\n";

    // Adiciona cada devedor como uma nova linha
    state.devedoresCache.forEach(devedor => {
        const razaoSocial = `"${devedor.razaoSocial.replace(/"/g, '""')}"`; // Trata aspas dentro do nome
        const cnpj = formatCNPJForDisplay(devedor.cnpj);
        csvContent += `${razaoSocial},${cnpj}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SASIF-Grandes_Devedores-${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Arquivo CSV gerado com sucesso!", "success");
}

/**
 * Exporta a lista de devedores (razão social e CNPJ) para um arquivo PDF.
 */
function exportDevedoresToPDF() {
    if (state.devedoresCache.length === 0) {
        showToast("Não há devedores para exportar.", "warning");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");

    doc.setFontSize(18);
    doc.text("Relatório de Grandes Devedores - SASIF", 14, 22);

    const tableRows = state.devedoresCache.map((devedor, index) => {
        return [
            index + 1,
            devedor.razaoSocial,
            formatCNPJForDisplay(devedor.cnpj)
        ];
    });

    doc.autoTable({
        head: [['#', 'Razão Social', 'CNPJ']],
        body: tableRows,
        startY: 30,
        theme: 'grid',
        headStyles: { fillColor: [13, 71, 161] } // Azul escuro do SASIF
    });

    doc.save(`SASIF-Grandes_Devedores-${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.pdf`);
    showToast("Arquivo PDF gerado com sucesso!", "success");
}

/**
 * Exibe a página de detalhes de um devedor específico.
 * É um passo intermediário para chamar a função de renderização principal.
 * @param {string} devedorId O ID do devedor.
 */
export function showDevedorPage(devedorId) {
  // A lógica de unsubscribe já é tratada em navigateTo, então aqui só chamamos a renderização.
  renderDevedorDetailPage(devedorId);
}

/**
 * Renderiza a lista de devedores em uma tabela.
 * @param {Array} devedores - A lista de devedores do cache.
 */
function renderDevedoresList(devedores) {
  const container = document.getElementById("devedores-list-container");
  if (!container) return;

  if (devedores.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhum grande devedor cadastrado ainda.</p>`;
    return;
  }

  let tableHTML = `
        <div class="table-responsive-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th class="number-cell">#</th>
                        <th>Razão Social</th>
                        <th>CNPJ</th>
                        <th>
                            <div class="info-tooltip-container">
                                <span>Prioridade</span>
                                <span class="info-icon">i</span>
                                <div class="info-tooltip-text">Executados com prioridade 1 devem ser analisados, no máximo, a cada 30 dias. Executados com prioridade 2, a cada 45 dias. E executados com prioridade 3, a cada 60 dias.</div>
                            </div>
                        </th>
                        <th>Análise</th>
                        <th class="actions-cell">Ações</th>
                    </tr>
                </thead>
                <tbody>`;

  devedores.forEach((devedor, index) => {
    const analise = getAnaliseStatus(devedor);
    let statusCellHTML = `<td class="clickable-status" data-action="registrar-analise" data-id="${devedor.id}" title="Clique para registrar a análise hoje"><span class="status-dot ${analise.status}"></span>${analise.text}</td>`;

    if (analise.status === "status-ok") {
      statusCellHTML = `<td><span class="status-dot ${analise.status}"></span>${analise.text}</td>`;
    }

    tableHTML += `<tr data-id="${devedor.id}" class="clickable-row">
            <td class="number-cell">${index + 1}</td>
            <td>${devedor.razaoSocial}</td>
            <td>${formatCNPJForDisplay(devedor.cnpj)}</td>
            <td class="level-${devedor.nivelPrioridade}">Nível ${
      devedor.nivelPrioridade
    }</td>
            ${statusCellHTML}
            <td class="actions-cell">
                <button class="action-icon icon-analise" title="Registrar Análise de Hoje" data-id="${
                  devedor.id
                }" data-action="registrar-analise">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                </button>
                <button class="action-icon icon-edit" title="Editar Devedor" data-id="${
                  devedor.id
                }" data-action="edit"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                <button class="action-icon icon-delete" title="Excluir Devedor" data-id="${
                  devedor.id
                }" data-action="delete"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
            </td>
        </tr>`;
  });

  tableHTML += `</tbody></table></div>`;
  container.innerHTML = tableHTML;
  container
    .querySelector("tbody")
    .addEventListener("click", handleDevedorAction);
}

/**
 * Lida com todas as ações clicáveis na lista de devedores (clique na linha ou nos botões).
 * @param {Event} event O evento de clique.
 */
function handleDevedorAction(event) {
  const target = event.target;
  const actionTarget = target.closest("[data-action]");

  if (actionTarget) {
    event.stopPropagation(); // Impede que o clique no botão também acione o clique na linha
    const action = actionTarget.dataset.action;
    const devedorId = actionTarget.dataset.id;

    if (action === "registrar-analise") {
      handleRegistrarAnalise(devedorId);
    } else if (action === "edit") {
      handleEditDevedor(devedorId);
    } else if (action === "delete") {
      handleDeleteDevedor(devedorId);
    }
    return;
  }

  const row = target.closest("tr.clickable-row");
  if (row) {
    const devedorId = row.dataset.id;
    showDevedorPage(devedorId);
  }
}

/**
 * Busca os dados de um devedor e renderiza o formulário de edição.
 * @param {string} devedorId O ID do devedor a ser editado.
 */
function handleEditDevedor(devedorId) {
  db.collection("grandes_devedores")
    .doc(devedorId)
    .get()
    .then((doc) => {
      if (doc.exists) {
        renderDevedorForm({ id: doc.id, ...doc.data() });
      }
    });
}

/**
 * Deleta um devedor do banco de dados após confirmação.
 * @param {string} devedorId O ID do devedor a ser deletado.
 */

/**
 * Deleta um devedor e todos os seus dados associados (processos, incidentes, etc.)
 * de forma atômica usando um batch write.
 * @param {string} devedorId O ID do devedor a ser deletado.
 */
async function handleDeleteDevedor(devedorId) {
  const devedorRef = db.collection("grandes_devedores").doc(devedorId);

  // 1. Confirmação do usuário (MUITO IMPORTANTE)
  if (
    !confirm(
      "ATENÇÃO!\n\nVocê tem certeza que deseja excluir este Grande Devedor? Todos os processos, anexos e dados vinculados a ele serão excluídos PERMANENTEMENTE. Esta ação não pode ser desfeita."
    )
  ) {
    return;
  }

  showLoadingOverlay("Excluindo devedor e todos os dados...");

  try {
    const batch = db.batch();

    // 2. Encontrar e marcar para exclusão os processos e seus sub-itens
    const processosSnapshot = await db
      .collection("processos")
      .where("devedorId", "==", devedorId)
      .get();
    if (!processosSnapshot.empty) {
      const subCollectionsPromises = [];

      processosSnapshot.forEach((processoDoc) => {
        const processoId = processoDoc.id;
        // Adiciona o próprio processo ao lote de exclusão
        batch.delete(processoDoc.ref);

        // Cria promessas para buscar todas as sub-coleções e itens relacionados
        const collectionsToDelete = [
          "corresponsaveis",
          "penhoras",
          "audiencias",
          "anexos",
        ];
        collectionsToDelete.forEach((collName) => {
          subCollectionsPromises.push(
            db.collection(collName).where("processoId", "==", processoId).get()
          );
        });

        // Busca a sub-coleção 'historicoValores' que está aninhada
        subCollectionsPromises.push(
          processoDoc.ref.collection("historicoValores").get()
        );
      });

      // Executa todas as buscas em paralelo
      const allSubCollections = await Promise.all(subCollectionsPromises);
      allSubCollections.forEach((snapshot) => {
        snapshot.forEach((doc) => batch.delete(doc.ref));
      });
    }

    // 3. Encontrar e marcar para exclusão os incidentes processuais
    const incidentesSnapshot = await db
      .collection("incidentesProcessuais")
      .where("devedorId", "==", devedorId)
      .get();
    incidentesSnapshot.forEach((doc) => batch.delete(doc.ref));

    // 4. Marcar o próprio devedor para exclusão
    batch.delete(devedorRef);

    // 5. Executar a operação em lote
    await batch.commit();

    showToast(
      "Devedor e todos os dados associados foram excluídos com sucesso!"
    );
  } catch (error) {
    console.error("Erro na exclusão em cascata: ", error);
    showToast(
      "Ocorreu um erro crítico durante a exclusão. Os dados não foram alterados.",
      "error"
    );
  } finally {
    // 6. Garantir que o overlay de carregamento seja sempre removido
    hideLoadingOverlay();
  }
}

/**
 * Atualiza a data da última análise de um devedor para a data/hora atual.
 * @param {string} devedorId O ID do devedor.
 */
function handleRegistrarAnalise(devedorId) {
  db.collection("grandes_devedores")
    .doc(devedorId)
    .update({
      dataUltimaAnalise: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .then(() => {
      showToast("Data de análise registrada!");
    })
    .catch((err) => {
      console.error("Erro ao registrar análise: ", err);
      showToast("Erro ao registrar análise.", "error");
    });
}

/**
 * Renderiza o formulário para cadastrar ou editar um Grande Devedor.
 * @param {object | null} devedor O objeto do devedor para edição, ou null para cadastro.
 */
function renderDevedorForm(devedor = null) {
  const isEditing = devedor !== null;
  const formTitle = isEditing
    ? "Editar Grande Devedor"
    : "Cadastrar Novo Grande Devedor";
  navigateTo(null); // Limpa a página, mas mantém a navegação lógica
  pageTitle.textContent = formTitle;
  document.title = `SASIF | ${formTitle}`;

  const razaoSocial = isEditing ? devedor.razaoSocial : "";
  const cnpj = isEditing ? formatCNPJForDisplay(devedor.cnpj) : "";
  const nomeFantasia = isEditing ? devedor.nomeFantasia : "";
  const nivelPrioridade = isEditing ? devedor.nivelPrioridade : "1";
  const observacoes = isEditing ? devedor.observacoes : "";

  contentArea.innerHTML = `
        <div class="form-container" data-id="${isEditing ? devedor.id : ""}">
            <div class="form-group"><label for="razao-social">Razão Social (Obrigatório)</label><input type="text" id="razao-social" value="${razaoSocial}" required></div>
            <div class="form-group"><label for="cnpj">CNPJ (Obrigatório)</label><input type="text" id="cnpj" value="${cnpj}" required></div>
            <div class="form-group"><label for="nome-fantasia">Nome Fantasia</label><input type="text" id="nome-fantasia" value="${nomeFantasia}"></div>
            <div class="form-group"><label for="nivel-prioridade">Nível de Prioridade</label><select id="nivel-prioridade"><option value="1">Nível 1 (30 dias)</option><option value="2">Nível 2 (45 dias)</option><option value="3">Nível 3 (60 dias)</option></select></div>
            <div class="form-group"><label for="observacoes">Observações</label><textarea id="observacoes">${observacoes}</textarea></div>
            <div id="error-message"></div>
            <div class="form-buttons"><button id="save-devedor-btn" class="btn-primary">Salvar</button><button id="cancel-btn">Cancelar</button></div>
        </div>`;

  document.getElementById("nivel-prioridade").value = nivelPrioridade;

  // Adiciona o listener para a máscara de CNPJ diretamente
  document
    .getElementById("cnpj")
    .addEventListener("input", (e) => maskCNPJ(e.target));

  document.getElementById("save-devedor-btn").addEventListener("click", () => {
    isEditing ? handleUpdateDevedor(devedor.id) : handleSaveDevedor();
  });
  document
    .getElementById("cancel-btn")
    .addEventListener("click", () => navigateTo("grandesDevedores"));
}

/**
 * Coleta e valida os dados do formulário de devedor.
 * @returns {object | null} O objeto com os dados do devedor ou null se houver erro.
 */
function getDevedorDataFromForm() {
  const razaoSocial = document.getElementById("razao-social").value.trim();
  const cnpj = document.getElementById("cnpj").value;
  const errorMessage = document.getElementById("error-message");
  errorMessage.textContent = "";

  if (!razaoSocial || !cnpj) {
    errorMessage.textContent = "Razão Social e CNPJ são obrigatórios.";
    return null;
  }
  if (cnpj.replace(/\D/g, "").length !== 14) {
    errorMessage.textContent =
      "Por favor, preencha um CNPJ válido com 14 dígitos.";
    return null;
  }
  return {
    razaoSocial,
    cnpj: cnpj.replace(/\D/g, ""),
    nomeFantasia: document.getElementById("nome-fantasia").value.trim(),
    nivelPrioridade: parseInt(
      document.getElementById("nivel-prioridade").value
    ),
    observacoes: document.getElementById("observacoes").value.trim(),
  };
}

/**
 * Salva um novo devedor no banco de dados.
 */
function handleSaveDevedor() {
  const devedorData = getDevedorDataFromForm();
  if (!devedorData) return;
  devedorData.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
  devedorData.uidUsuario = auth.currentUser.uid;

  db.collection("grandes_devedores")
    .add(devedorData)
    .then(() => {
      navigateTo("grandesDevedores");
      setTimeout(() => showToast("Grande Devedor salvo com sucesso!"), 100);
    });
}

/**
 * Atualiza um devedor existente no banco de dados.
 * @param {string} devedorId O ID do devedor a ser atualizado.
 */
function handleUpdateDevedor(devedorId) {
  const devedorData = getDevedorDataFromForm();
  if (!devedorData) return;
  devedorData.atualizadoEm = firebase.firestore.FieldValue.serverTimestamp();

  db.collection("grandes_devedores")
    .doc(devedorId)
    .update(devedorData)
    .then(() => {
      navigateTo("grandesDevedores");
      setTimeout(() => showToast("Devedor atualizado com sucesso!"), 100);
    });
}

/**
 * Renderiza a página de detalhes completa de um devedor, incluindo seus processos.
 * @param {string} devedorId O ID do devedor.
 */
export async function renderDevedorDetailPage(devedorId) {
  pageTitle.textContent = "Carregando...";
  document.title = "SASIF | Carregando...";
  renderSidebar(null); // Reseta a sidebar para indicar uma página interna

  try {
    const devedorDoc = await db
      .collection("grandes_devedores")
      .doc(devedorId)
      .get();
    if (!devedorDoc.exists) {
      showToast("Devedor não encontrado.", "error");
      navigateTo("dashboard");
      return;
    }
    const devedor = { id: devedorDoc.id, ...devedorDoc.data() };

    const incidentesSnapshot = await db
      .collection("incidentesProcessuais")
      .where("devedorId", "==", devedorId)
      .limit(1)
      .get();
    const temIncidentes = !incidentesSnapshot.empty;
    const alertaIncidenteHTML = temIncidentes
      ? `
            <p style="margin-top: 8px; font-weight: 500; cursor: pointer; color: var(--cor-primaria);" id="ver-incidentes-devedor">
                Este executado possui incidentes vinculados. Clique para ver a lista.
            </p>`
      : "";

    pageTitle.textContent = devedor.razaoSocial;
    document.title = `SASIF | ${devedor.razaoSocial}`;
    contentArea.innerHTML = `
            <div class="detail-header-card">
                <p><strong>CNPJ:</strong> ${formatCNPJForDisplay(
                  devedor.cnpj
                )}</p>
                ${
                  devedor.nomeFantasia
                    ? `<p><strong>Nome Fantasia:</strong> ${devedor.nomeFantasia}</p>`
                    : ""
                }
                ${alertaIncidenteHTML}
            </div>
            <div id="resumo-financeiro-container"></div>
            ${
              devedor.observacoes
                ? `<div class="detail-card"><h3>Observações sobre o Devedor</h3><div class="detail-full-width"><p>${devedor.observacoes.replace(
                    /\n/g,
                    "<br>"
                  )}</p></div></div>`
                : ""
            }
            
            <div class="dashboard-actions">
                 <button id="add-processo-btn" class="btn-primary">Cadastrar Novo Processo</button>
            </div>
            <h2>Lista de Processos</h2>
            <div id="processos-list-container">
                <p class="empty-list-message">Carregando processos...</p>
            </div>
        `;

    if (temIncidentes) {
      document
        .getElementById("ver-incidentes-devedor")
        .addEventListener("click", () =>
          renderDevedorIncidentesModal(devedorId)
        );
    }

    document
      .getElementById("add-processo-btn")
      .addEventListener("click", () => renderProcessoForm(devedorId, null));

    // Inicia o listener para buscar e exibir os processos deste devedor
    setupProcessosListener(devedorId);
  } catch (error) {
    console.error("Erro ao carregar página do devedor:", error);
    showToast("Ocorreu um erro ao carregar os dados.", "error");
  }
}

/**
 * Renderiza um modal com a lista de incidentes de um devedor.
 * @param {string} devedorId O ID do devedor.
 */
async function renderDevedorIncidentesModal(devedorId) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `
        <div class="modal-content modal-large">
            <h3>Incidentes Vinculados ao Devedor</h3>
            <div id="devedor-incidentes-content"><p>Carregando incidentes...</p></div>
            <div class="form-buttons" style="justify-content: flex-end; margin-top: 20px;">
                <button id="close-devedor-incidentes-modal" class="btn-secondary">Fechar</button>
            </div>
        </div>
    `;
  document.body.appendChild(modalOverlay);
  const closeModal = () => document.body.removeChild(modalOverlay);
  document
    .getElementById("close-devedor-incidentes-modal")
    .addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  try {
    const snapshot = await db
      .collection("incidentesProcessuais")
      .where("devedorId", "==", devedorId)
      .get();
    const incidentes = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    const contentContainer = document.getElementById(
      "devedor-incidentes-content"
    );

    if (incidentes.length === 0) {
      contentContainer.innerHTML =
        '<p class="empty-list-message">Nenhum incidente encontrado para este devedor.</p>';
      return;
    }

    const incidentesAgrupados = incidentes.reduce((acc, incidente) => {
      const chave = incidente.numeroProcessoPrincipal;
      if (!acc[chave]) acc[chave] = [];
      acc[chave].push(incidente);
      return acc;
    }, {});

    let contentHTML = "";
    for (const processoPrincipal in incidentesAgrupados) {
      contentHTML += `<h4 style="margin-top: 20px; padding-bottom: 5px; border-bottom: 1px solid #eee;">Processo Principal: ${formatProcessoForDisplay(
        processoPrincipal
      )}</h4>`;
      incidentesAgrupados[processoPrincipal].forEach((item) => {
        contentHTML += `
                    <div style="padding: 10px 0; border-bottom: 1px solid #f5f5f5;">
                        <p style="margin:0; font-weight: 500;"><strong>Incidente:</strong> ${formatProcessoForDisplay(
                          item.numeroIncidente
                        )}</p>
                        <p style="margin:5px 0 0 0; white-space: pre-wrap;">${
                          item.descricao
                        }</p>
                    </div>`;
      });
    }
    contentContainer.innerHTML = contentHTML;
  } catch (error) {
    console.error("Erro ao buscar incidentes do devedor:", error);
    document.getElementById(
      "devedor-incidentes-content"
    ).innerHTML = `<p class="empty-list-message">Ocorreu um erro ao carregar os incidentes.</p>`;
  }
}
