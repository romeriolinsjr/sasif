// ==================================================================
// SCRIPT.JS COMPLETO - VERSÃO SINCRONIZADA
// ==================================================================

const firebaseConfig = {
  apiKey: "AIzaSyBKDnfYqBV7lF_8o-LGuaLn_VIrb2keyh0",
  authDomain: "sasif-app.firebaseapp.com",
  projectId: "sasif-app",
  storageBucket: "sasif-app.firebasestorage.app",
  messagingSenderId: "695074109375",
  appId: "1:695074109375:web:0b564986ef12555091d30a",
};

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
const appContainer = document.getElementById("app-container");
const loginContainer = document.getElementById("login-container");
const userEmailSpan = document.getElementById("user-email");
const logoutButton = document.getElementById("logout-button");
const contentArea = document.getElementById("content-area");
const pageTitle = document.getElementById("page-title");
const mainNav = document.getElementById("main-nav");

let devedoresCache = [];
let exequentesCache = [];
let processosCache = [];
let diligenciasCache = [];
let motivosSuspensaoCache = [];
let currentTasksPageDate = new Date(); // <-- ADICIONE ESTA LINHA
let currentReportData = [];
let currentSortState = { key: null, direction: "asc" };
let processosListenerUnsubscribe = null;
let corresponsaveisListenerUnsubscribe = null;
let penhorasListenerUnsubscribe = null;
let audienciasListenerUnsubscribe = null;
let diligenciasListenerUnsubscribe = null;
let incidentesListenerUnsubscribe = null; // <-- ADICIONE ESTA
let anexosListenerUnsubscribe = null; // <-- E ESTA

function showToast(message, type = "success") {
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

function maskCNPJ(input) {
  let value = input.value.replace(/\D/g, "").substring(0, 14);
  value = value.replace(/^(\d{2})(\d)/, "$1.$2");
  value = value.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
  value = value.replace(/\.(\d{3})(\d)/, ".$1/$2");
  value = value.replace(/(\d{4})(\d)/, "$1-$2");
  input.value = value;
}

function formatCNPJForDisplay(cnpj) {
  if (!cnpj || cnpj.length !== 14) return cnpj;
  return cnpj.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

function maskProcesso(input) {
  let v = input.value.replace(/\D/g, "").substring(0, 20);
  if (v.length > 16) {
    v = `${v.slice(0, 7)}-${v.slice(7, 9)}.${v.slice(9, 13)}.${v.slice(
      13,
      14
    )}.${v.slice(14, 16)}.${v.slice(16, 20)}`;
  } else if (v.length > 14) {
    v = `${v.slice(0, 7)}-${v.slice(7, 9)}.${v.slice(9, 13)}.${v.slice(
      13,
      14
    )}.${v.slice(14, 16)}`;
  } else if (v.length > 13) {
    v = `${v.slice(0, 7)}-${v.slice(7, 9)}.${v.slice(9, 13)}.${v.slice(
      13,
      14
    )}`;
  } else if (v.length > 9) {
    v = `${v.slice(0, 7)}-${v.slice(7, 9)}.${v.slice(9, 13)}`;
  } else if (v.length > 7) {
    v = `${v.slice(0, 7)}-${v.slice(7, 9)}`;
  }
  input.value = v;
}

function formatProcessoForDisplay(numero) {
  if (!numero || numero.length !== 20) return numero;
  return numero.replace(
    /^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/,
    "$1-$2.$3.$4.$5.$6"
  );
}

function formatCurrency(value) {
  if (typeof value !== "number") return "R$ 0,00";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getAnaliseStatus(devedor) {
  // Helper para zerar a hora de uma data
  const zerarHora = (data) => {
    data.setHours(0, 0, 0, 0);
    return data;
  };

  const hoje = zerarHora(new Date());

  if (!devedor.dataUltimaAnalise) {
    if (devedor.criadoEm) {
      const dataCriacao = zerarHora(devedor.criadoEm.toDate());
      const diffTime = hoje - dataCriacao;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const plural = diffDays === 1 ? "dia" : "dias";

      if (diffDays <= 0) {
        return { status: "status-expired", text: "Pendente (hoje)" };
      }
      return {
        status: "status-expired",
        text: `Pendente há ${diffDays} ${plural}`,
      };
    }
    return { status: "status-expired", text: "Pendente" };
  }

  const prazos = { 1: 30, 2: 45, 3: 60 };
  const prazoDias = prazos[devedor.nivelPrioridade];

  const dataUltima = zerarHora(devedor.dataUltimaAnalise.toDate());
  const dataVencimento = new Date(dataUltima);
  dataVencimento.setDate(dataVencimento.getDate() + prazoDias);

  // O cálculo da diferença agora é entre dias "puros"
  const diffTime = dataVencimento - hoje;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const diasVencidos = Math.abs(diffDays);
    const pluralVencido = diasVencidos === 1 ? "dia" : "dias";
    return {
      status: "status-expired",
      text: `Vencido há ${diasVencidos} ${pluralVencido}`,
    };
  }

  // Se a diferença for 0, significa que vence hoje.
  if (diffDays === 0) {
    return { status: "status-warning", text: `Vence hoje` };
  }

  const pluralVence = diffDays === 1 ? "dia" : "dias";
  if (diffDays <= 7) {
    return {
      status: "status-warning",
      text: `Vence em ${diffDays} ${pluralVence}`,
    };
  }

  return { status: "status-ok", text: `Vence em ${diffDays} ${pluralVence}` };
}

function maskDocument(input, tipoPessoa) {
  let value = input.value.replace(/\D/g, "");
  if (tipoPessoa === "juridica") {
    value = value.substring(0, 14);
    value = value.replace(/^(\d{2})(\d)/, "$1.$2");
    value = value.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
    value = value.replace(/\.(\d{3})(\d)/, ".$1/$2");
    value = value.replace(/(\d{4})(\d)/, "$1-$2");
  } else {
    value = value.substring(0, 11);
    value = value.replace(/(\d{3})(\d)/, "$1.$2");
    value = value.replace(/(\d{3})(\d)/, "$1.$2");
    value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  input.value = value;
}

function formatDocumentForDisplay(doc) {
  if (!doc) return "Não informado";
  doc = doc.replace(/\D/g, "");
  if (doc.length === 11) {
    return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (doc.length === 14) {
    return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return doc;
}

function renderSidebar(activePage) {
  const pages = [
    { id: "dashboard", name: "Dashboard" },
    { id: "grandesDevedores", name: "Grandes Devedores" },
    { id: "diligencias", name: "Tarefas do Mês" },
    { id: "relatorios", name: "Relatórios" }, // <-- NOVO ITEM
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

function navigateTo(page, params = {}) {
  if (processosListenerUnsubscribe) {
    processosListenerUnsubscribe();
    processosListenerUnsubscribe = null;
  }
  if (corresponsaveisListenerUnsubscribe) {
    corresponsaveisListenerUnsubscribe();
    corresponsaveisListenerUnsubscribe = null;
  }
  if (penhorasListenerUnsubscribe) {
    penhorasListenerUnsubscribe();
    penhorasListenerUnsubscribe = null;
  }
  if (audienciasListenerUnsubscribe) {
    audienciasListenerUnsubscribe();
    audienciasListenerUnsubscribe = null;
  }
  if (diligenciasListenerUnsubscribe) {
    diligenciasListenerUnsubscribe();
    diligenciasListenerUnsubscribe = null;
  }
  if (incidentesListenerUnsubscribe) {
    incidentesListenerUnsubscribe();
    incidentesListenerUnsubscribe = null;
  }
  if (anexosListenerUnsubscribe) {
    anexosListenerUnsubscribe();
    anexosListenerUnsubscribe = null;
  }

  renderSidebar(page);
  switch (page) {
    case "dashboard":
      renderDashboard();
      break;
    case "grandesDevedores":
      renderGrandesDevedoresPage();
      break;
    case "importacao":
      renderImportacaoPage();
      break;
    case "relatorios":
      renderRelatoriosPage();
      break;
    case "diligencias":
      renderDiligenciasPage();
      break;
    case "configuracoes":
      renderConfiguracoesPage();
      break;
    case "incidentes":
      renderIncidentesPage();
      break;
    case "exequentes":
      renderExequentesPage();
      break;
    case "motivos":
      renderMotivosPage();
      break;
    case "processoDetail":
      renderProcessoDetailPage(params.id);
      break;
    default:
      renderDashboard();
  }
}

function renderDashboard() {
  pageTitle.textContent = "Dashboard";
  document.title = "SASIF | Dashboard";

  contentArea.innerHTML = `
        <div id="dashboard-widgets-container">
            <div id="diligencias-widget-container"></div>
            <div id="analises-widget-container"></div>
            <div id="audiencias-widget-container"></div>
        </div>
    `;

  setupDashboardWidgets();
}

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
    let statusCellHTML = "";
    if (analise.status !== "status-ok") {
      statusCellHTML = `<td class="clickable-status" data-action="registrar-analise" data-id="${devedor.id}" title="Clique para registrar a análise hoje"><span class="status-dot ${analise.status}"></span>${analise.text}</td>`;
    } else {
      statusCellHTML = `<td><span class="status-dot ${analise.status}"></span>${analise.text}</td>`;
    }
    tableHTML += `<tr data-id="${
      devedor.id
    }" class="clickable-row"><td class="number-cell">${index + 1}</td><td>${
      devedor.razaoSocial
    }</td><td>${formatCNPJForDisplay(devedor.cnpj)}</td><td class="level-${
      devedor.nivelPrioridade
    }">Nível ${
      devedor.nivelPrioridade
    }</td>${statusCellHTML}<td class="actions-cell">
            <!-- BOTÃO NOVO ADICIONADO AQUI -->
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
            </td></tr>`;
  });

  tableHTML += `</tbody>
            </table>
        </div>`;

  container.innerHTML = tableHTML;
  container
    .querySelector("tbody")
    .addEventListener("click", handleDevedorAction);
}

function renderGrandesDevedoresPage() {
  pageTitle.textContent = "Grandes Devedores";
  document.title = "SASIF | Grandes Devedores";

  contentArea.innerHTML = `
        <div class="dashboard-actions">
            <button id="add-devedor-btn" class="btn-primary">Cadastrar Novo Devedor</button>
        </div>
        <h2>Lista de Grandes Devedores</h2>
        <div id="devedores-list-container"></div>
    `;

  document
    .getElementById("add-devedor-btn")
    .addEventListener("click", () => renderDevedorForm());

  renderDevedoresList(devedoresCache);
}

function showDevedorPage(devedorId) {
  if (processosListenerUnsubscribe) processosListenerUnsubscribe();
  if (corresponsaveisListenerUnsubscribe) corresponsaveisListenerUnsubscribe();
  if (penhorasListenerUnsubscribe) penhorasListenerUnsubscribe();
  if (audienciasListenerUnsubscribe) audienciasListenerUnsubscribe();
  if (diligenciasListenerUnsubscribe) diligenciasListenerUnsubscribe();

  renderDevedorDetailPage(devedorId);
}

function renderDiligenciasPage(date = new Date()) {
  currentTasksPageDate = date; // ATUALIZA A VARIÁVEL GLOBAL COM A DATA ATUAL

  const mesAtual = date.toLocaleString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  pageTitle.textContent = "Controle de Tarefas";
  document.title = `SASIF | Tarefas do Mês - ${mesAtual}`;

  const mesAnterior = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const mesSeguinte = new Date(date.getFullYear(), date.getMonth() + 1, 1);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataLimite = new Date(hoje.getFullYear() + 2, hoje.getMonth(), 1);
  const desabilitarProximo = mesSeguinte >= dataLimite;

  contentArea.innerHTML = `
        <div class="dashboard-actions"> <button id="add-diligencia-btn" class="btn-primary">Adicionar Tarefa</button> </div>
        <div class="tasks-month-header">
            <button id="prev-month-btn" title="Mês Anterior">◀</button>
            <h2>${mesAtual.charAt(0).toUpperCase() + mesAtual.slice(1)}</h2>
            <button id="next-month-btn" title="Mês Seguinte" ${
              desabilitarProximo ? "disabled" : ""
            }>▶</button>
        </div>
        <div id="diligencias-list-container">
            <p class="empty-list-message">Carregando tarefas...</p>
        </div>
    `;

  document
    .getElementById("add-diligencia-btn")
    .addEventListener("click", () => {
      renderDiligenciaFormModal();
    });
  document
    .getElementById("prev-month-btn")
    .addEventListener("click", () => renderDiligenciasPage(mesAnterior));
  if (!desabilitarProximo) {
    document
      .getElementById("next-month-btn")
      .addEventListener("click", () => renderDiligenciasPage(mesSeguinte));
  }
  if (
    typeof handleDiligenciaAction.isAttached === "undefined" ||
    !handleDiligenciaAction.isAttached
  ) {
    contentArea.removeEventListener("click", handleDiligenciaAction);
    contentArea.addEventListener("click", handleDiligenciaAction);
    handleDiligenciaAction.isAttached = true;
  }
  setupDiligenciasListener(date);
}

function renderDiligenciaFormModal(diligencia = null) {
  const isEditing = diligencia !== null;
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";

  let dataAlvoFormatada = "";
  if (isEditing && diligencia.dataAlvo) {
    dataAlvoFormatada = new Date(diligencia.dataAlvo.seconds * 1000)
      .toISOString()
      .split("T")[0];
  }

  // AQUI ESTÁ A MUDANÇA: O modal agora guarda a data de referência
  modalOverlay.innerHTML = `
    <div class="modal-content modal-large" data-mes-referencia="${currentTasksPageDate.toISOString()}">
        <h3>${isEditing ? "Editar" : "Adicionar"} Tarefa</h3>
        <div class="form-group"> <label for="diligencia-titulo">Título da Tarefa (Obrigatório)</label> <input type="text" id="diligencia-titulo" value="${
          isEditing ? diligencia.titulo : ""
        }" required> </div>
        <div class="form-group" style="display: flex; align-items: center; gap: 10px; justify-content: flex-start;"> <input type="checkbox" id="diligencia-recorrente" ${
          isEditing && diligencia.isRecorrente ? "checked" : ""
        } style="width: auto;"> <label for="diligencia-recorrente" style="margin-bottom: 0; font-weight: normal;">Tarefa Recorrente (repete todo mês)</label> </div>
        <div class="form-group"> <label for="diligencia-data-alvo">Data Alvo (Obrigatório)</label> <input type="date" id="diligencia-data-alvo" value="${dataAlvoFormatada}" required> </div>
        <div class="form-group"> <label for="diligencia-processo">Processo Vinculado (Opcional)</label> <input type="text" id="diligencia-processo" placeholder="Formato: 0000000-00.0000.0.00.0000" value="${
          isEditing && diligencia.processoVinculado
            ? formatProcessoForDisplay(diligencia.processoVinculado)
            : ""
        }"> </div>
        <div class="form-group"> <label for="diligencia-descricao">Descrição Completa (Opcional)</label> <textarea id="diligencia-descricao" rows="4">${
          isEditing ? diligencia.descricao : ""
        }</textarea> </div>
        <div id="error-message"></div>
        <div class="form-buttons"> <button id="save-diligencia-btn" class="btn-primary">Salvar</button> <button id="cancel-diligencia-btn">Cancelar</button> </div>
    </div>`;

  document.body.appendChild(modalOverlay);
  document
    .getElementById("diligencia-processo")
    .addEventListener("input", (e) => maskProcesso(e.target));
  const closeModal = () => document.body.removeChild(modalOverlay);
  document
    .getElementById("save-diligencia-btn")
    .addEventListener("click", () => {
      handleSaveDiligencia(
        isEditing ? diligencia.id : null,
        isEditing ? diligencia : null
      );
    });
  document
    .getElementById("cancel-diligencia-btn")
    .addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
}

function renderIncidentesPage() {
  pageTitle.textContent = "Incidentes Processuais";
  document.title = "SASIF | Incidentes Processuais";

  contentArea.innerHTML = `
        <div class="dashboard-actions">
            <button id="add-incidente-btn" class="btn-primary">Cadastrar Novo Incidente</button>
            <button id="back-to-config-btn" class="btn-secondary" style="margin-left: 16px;">← Voltar para Configurações</button>
        </div>
        <h2>Lista de Todos os Incidentes</h2>
        <div id="todos-incidentes-list-container">
            <p class="empty-list-message">Nenhum incidente processual cadastrado.</p>
        </div>
    `;

  document.getElementById("add-incidente-btn").addEventListener("click", () => {
    renderIncidenteFormModal(); // Chamará a função que criaremos a seguir
  });

  document
    .getElementById("back-to-config-btn")
    .addEventListener("click", () => {
      navigateTo("configuracoes");
    });

  setupTodosIncidentesListener(); // <-- ADICIONE ESTA LINHA

  // Futuramente, chamará a função setupTodosIncidentesListener()
}

function renderConfiguracoesPage() {
  pageTitle.textContent = "Configurações";
  document.title = "SASIF | Configurações";

  contentArea.innerHTML = `
        <style>
            .settings-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 24px;
            }
            .setting-card {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                padding: 40px 20px;
                background-color: white;
                border-radius: 8px;
                box-shadow: var(--sombra);
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s, background-color 0.2s;
            }
            .setting-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 6px 12px rgba(0,0,0,0.15);
            }
            .setting-card h3 {
                margin: 0 0 10px 0;
                font-size: 20px;
                color: var(--cor-primaria);
            }
            .setting-card p {
                margin: 0;
                color: #555;
            }
        </style>

        <div class="settings-grid">
            <div class="setting-card" id="goto-exequentes">
                <h3>Gerenciar Exequentes</h3>
                <p>Adicione, edite ou remova os entes exequentes.</p>
            </div>
            <div class="setting-card" id="goto-motivos">
                <h3>Gerenciar Motivos de Suspensão</h3>
                <p>Customize os motivos utilizados para suspender processos.</p>
            </div>
            <div class="setting-card" id="goto-incidentes">
                <h3>Gerenciar Incidentes Processuais</h3>
                <p>Cadastre e acompanhe processos incidentais.</p>
            </div>
        </div>

    `;

  document
    .getElementById("goto-exequentes")
    .addEventListener("click", () => navigateTo("exequentes"));
  document
    .getElementById("goto-motivos")
    .addEventListener("click", () => navigateTo("motivos"));
  document
    .getElementById("goto-incidentes")
    .addEventListener("click", () => navigateTo("incidentes"));
}

function renderRelatoriosPage() {
  pageTitle.textContent = "Relatórios";
  document.title = "SASIF | Relatórios";

  contentArea.innerHTML = `
        <div class="detail-card" style="margin-bottom: 24px;">
            <h3>Gerador de Relatórios</h3>
            <p>Selecione o tipo de relatório que deseja gerar. Os filtros correspondentes aparecerão abaixo.</p>
            <div class="form-group" style="margin-top: 16px;">
                <label for="report-type-select">Tipo de Relatório</label>
                <select id="report-type-select" class="import-devedor-select">
                    <option value="">Selecione...</option>
                    <!-- NOME ATUALIZADO -->
                    <option value="processosPorTipoStatus">a) Processos</option> 
                    <option value="penhorasPorDevedor">b) Constrições Patrimoniais</option>
                    <option value="incidentesPorDevedor">c) Incidentes Processuais</option>
                    <!-- NOME ATUALIZADO -->
                    <option value="processosPorValor">d) Valor da Execução</option> 
                </select>
            </div>
        </div>
        <div id="report-filters-container"></div>
        <div id="report-results-container" style="margin-top: 24px;"></div>
    `;

  document
    .getElementById("report-type-select")
    .addEventListener("change", (e) => {
      const reportType = e.target.value;
      renderReportFilters(reportType);
    });
}

function renderReportFilters(reportType) {
  const filtersContainer = document.getElementById("report-filters-container");
  if (!filtersContainer) return;

  filtersContainer.innerHTML = "";
  document.getElementById("report-results-container").innerHTML = "";

  if (!reportType) return;

  let filtersHTML = '<div class="detail-card">';

  // Opções de devedor e exequente reutilizáveis
  const exequenteOptions = exequentesCache
    .map((ex) => `<option value="${ex.id}">${ex.nome}</option>`)
    .join("");
  const devedorOptions = [...devedoresCache]
    .sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial))
    .map((dev) => `<option value="${dev.id}">${dev.razaoSocial}</option>`)
    .join("");

  switch (reportType) {
    case "processosPorTipoStatus":
      filtersHTML += `
                <h4>Filtros para "Processos"</h4>
                <div class="detail-grid" style="grid-template-columns: repeat(4, 1fr); gap: 20px; align-items: end;">
                    <div class="form-group"> <label for="filtro-devedor">Executado</label> <select id="filtro-devedor" class="import-devedor-select"> <option value="">Todos</option> ${devedorOptions} </select> </div>
                    <div class="form-group"> <label for="filtro-exequente">Exequente</label> <select id="filtro-exequente" class="import-devedor-select"> <option value="">Todos</option> ${exequenteOptions} </select> </div>
                    <div class="form-group"> <label for="filtro-tipo-processo">Tipo de Processo</label> <select id="filtro-tipo-processo" class="import-devedor-select"> <option value="">Todos</option> <option value="piloto">Piloto</option> <option value="apenso">Apenso</option> <option value="autonomo">Autônomo</option> </select> </div>
                    <div class="form-group"> <label for="filtro-status-processo">Status do Processo</label> <select id="filtro-status-processo" class="import-devedor-select"> <option value="">Todos</option> <option value="Ativo">Ativo</option> <option value="Suspenso">Suspenso</option> <option value="Baixado">Baixado</option> <option value="Extinto">Extinto</option> </select> </div>
                </div>
                <div style="margin-top: 20px;"> <button id="gerar-relatorio-btn" class="btn-primary">Gerar Relatório</button> </div>
            `;
      break;

    case "penhorasPorDevedor":
      filtersHTML += `<h4>Filtros para "Constrições Patrimoniais"</h4><div class="detail-grid" style="grid-template-columns: repeat(3, 1fr); gap: 20px; align-items: end;"><div class="form-group"><label for="filtro-devedor-penhora">Executado (Obrigatório)</label><select id="filtro-devedor-penhora" class="import-devedor-select" required><option value="">Selecione um devedor...</option>${devedorOptions}</select></div><div class="form-group"><label for="filtro-exequente-penhora">Exequente (Opcional)</label><select id="filtro-exequente-penhora" class="import-devedor-select"><option value="">Todos</option>${exequenteOptions}</select></div><div class="form-group"><label for="filtro-processo-penhora">Processo (Opcional)</label><select id="filtro-processo-penhora" class="import-devedor-select" disabled><option value="">Todos</option></select></div></div><div style="margin-top: 20px;"><button id="gerar-relatorio-penhora-btn" class="btn-primary">Gerar Relatório</button></div>`;
      break;

    case "incidentesPorDevedor":
      filtersHTML += `<h4>Filtros para "Incidentes Processuais"</h4><div class="detail-grid" style="grid-template-columns: repeat(2, 1fr); gap: 20px; align-items: end;"><div class="form-group"><label for="filtro-devedor-incidente">Executado (Obrigatório)</label><select id="filtro-devedor-incidente" class="import-devedor-select" required><option value="">Selecione um devedor...</option>${devedorOptions}</select></div><div class="form-group"><label for="filtro-exequente-incidente">Exequente (Opcional)</label><select id="filtro-exequente-incidente" class="import-devedor-select"><option value="">Todos</option>${exequenteOptions}</select></div></div><div style="margin-top: 20px;"><button id="gerar-relatorio-incidente-btn" class="btn-primary">Gerar Relatório</button></div>`;
      break;

    case "processosPorValor": // <-- NOVO CASE
      filtersHTML += `
                <h4>Filtros para "Valor da Execução"</h4>
                <div class="detail-grid" style="grid-template-columns: repeat(3, 1fr); gap: 20px; align-items: end;">
                    <!-- Filtros de Valor -->
                    <div class="form-group">
                        <label for="filtro-condicao-valor">Condição</label>
                        <select id="filtro-condicao-valor" class="import-devedor-select">
                            <option value="maior">Maior que</option>
                            <option value="menor">Menor que</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="filtro-valor">Valor (R$)</label>
                        <input type="number" id="filtro-valor" placeholder="Ex: 50000" class="form-group input" style="width: 100%; padding: 12px; border: 1px solid var(--cor-borda); border-radius: 4px; font-size: 16px;">
                    </div>
                    <div class="form-group"></div> <!-- Espaçador -->

                    <!-- Filtros Adicionais -->
                    <div class="form-group"> <label for="filtro-devedor">Executado</label> <select id="filtro-devedor" class="import-devedor-select"> <option value="">Todos</option> ${devedorOptions} </select> </div>
                    <div class="form-group"> <label for="filtro-exequente">Exequente</label> <select id="filtro-exequente" class="import-devedor-select"> <option value="">Todos</option> ${exequenteOptions} </select> </div>
                    <div class="form-group"></div> <!-- Espaçador -->
                    <div class="form-group"> <label for="filtro-tipo-processo">Tipo de Processo</label> <select id="filtro-tipo-processo" class="import-devedor-select"> <option value="">Todos</option> <option value="piloto">Piloto</option> <option value="apenso">Apenso</option> <option value="autonomo">Autônomo</option> </select> </div>
                    <div class="form-group"> <label for="filtro-status-processo">Status do Processo</label> <select id="filtro-status-processo" class="import-devedor-select"> <option value="">Todos</option> <option value="Ativo">Ativo</option> <option value="Suspenso">Suspenso</option> <option value="Baixado">Baixado</option> <option value="Extinto">Extinto</option> </select> </div>
                </div>
                <div style="margin-top: 20px;"> <button id="gerar-relatorio-btn" class="btn-primary">Gerar Relatório</button> </div>
            `;
      break;
  }

  filtersHTML += "</div>";
  filtersContainer.innerHTML = filtersHTML;

  // Conecta os botões às suas funções
  if (
    reportType === "processosPorTipoStatus" ||
    reportType === "processosPorValor"
  ) {
    document
      .getElementById("gerar-relatorio-btn")
      .addEventListener("click", gerarRelatorioProcessosPorTipoStatus);
  } else if (reportType === "penhorasPorDevedor") {
    document
      .getElementById("gerar-relatorio-penhora-btn")
      .addEventListener("click", gerarRelatorioPenhoras);
    document
      .getElementById("filtro-devedor-penhora")
      .addEventListener("change", (e) => {
        populateProcessosFiltro(e.target.value);
      });
  } else if (reportType === "incidentesPorDevedor") {
    document
      .getElementById("gerar-relatorio-incidente-btn")
      .addEventListener("click", gerarRelatorioIncidentes);
  }
}

// ADICIONE ESTA NOVA FUNÇÃO AUXILIAR
async function populateProcessosFiltro(devedorId) {
  const processoSelect = document.getElementById("filtro-processo-penhora");
  processoSelect.innerHTML =
    '<option value="">Carregando processos...</option>';
  processoSelect.disabled = true;

  if (!devedorId) {
    processoSelect.innerHTML = '<option value="">Todos</option>';
    return;
  }

  try {
    const snapshot = await db
      .collection("processos")
      .where("devedorId", "==", devedorId)
      .get();
    const processos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (processos.length > 0) {
      const processosOrdenados = processos.sort((a, b) =>
        a.numeroProcesso.localeCompare(b.numeroProcesso)
      );
      let optionsHTML = '<option value="">Todos</option>';
      processosOrdenados.forEach((proc) => {
        optionsHTML += `<option value="${proc.id}">${formatProcessoForDisplay(
          proc.numeroProcesso
        )}</option>`;
      });
      processoSelect.innerHTML = optionsHTML;
      processoSelect.disabled = false;
    } else {
      processoSelect.innerHTML =
        '<option value="">Nenhum processo encontrado</option>';
    }
  } catch (error) {
    console.error("Erro ao buscar processos para o filtro:", error);
    processoSelect.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

async function gerarRelatorioProcessosPorTipoStatus() {
  // Busca de todos os filtros da tela
  const tipo = document.getElementById("filtro-tipo-processo")?.value;
  const status = document.getElementById("filtro-status-processo")?.value;
  const exequenteId = document.getElementById("filtro-exequente")?.value;
  const devedorId = document.getElementById("filtro-devedor")?.value;

  // Busca dos novos filtros de valor (se existirem)
  const condicaoValor = document.getElementById("filtro-condicao-valor")?.value;
  const valorFiltroInput = document.getElementById("filtro-valor")?.value;
  const valorFiltro = valorFiltroInput ? parseFloat(valorFiltroInput) : null;

  const resultsContainer = document.getElementById("report-results-container");
  resultsContainer.innerHTML = `<p class="empty-list-message">Gerando relatório, por favor aguarde...</p>`;

  try {
    let query = db.collection("processos");

    // Aplica filtros que serão enviados ao Firebase
    if (tipo) {
      query = query.where(
        "tipoProcesso",
        "==",
        tipo === "autonomo" ? "autônomo" : tipo
      );
    }
    if (status) {
      query = query.where("status", "==", status);
    }
    if (exequenteId) {
      query = query.where("exequenteId", "==", exequenteId);
    }
    if (devedorId) {
      query = query.where("devedorId", "==", devedorId);
    }

    const snapshot = await query.get();
    let processos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // LÓGICA DE FILTRAGEM EXTRA (CLIENT-SIDE) PARA O VALOR
    if (valorFiltro !== null && !isNaN(valorFiltro)) {
      processos = processos.filter((proc) => {
        const valorProcesso = proc.valorAtual?.valor || proc.valorDivida || 0;
        if (condicaoValor === "maior") {
          return valorProcesso > valorFiltro;
        } else {
          // 'menor'
          return valorProcesso < valorFiltro;
        }
      });
    }

    currentReportData = processos;
    currentSortState = { key: null, direction: "asc" };

    renderRelatorioResultados(processos);
  } catch (error) {
    console.error("Erro ao gerar relatório: ", error);
    if (error.code === "failed-precondition") {
      resultsContainer.innerHTML = `<p class="empty-list-message error"><b>Erro:</b> A combinação de filtros que você selecionou requer um índice no banco de dados que não existe. Para corrigir, abra o console do desenvolvedor (F12), localize a mensagem de erro do Firebase e clique no link fornecido para criar o índice automaticamente.</p>`;
    } else {
      resultsContainer.innerHTML = `<p class="empty-list-message error">Ocorreu um erro ao gerar o relatório.</p>`;
    }
  }
}

async function handleSaveDiligencia(
  diligenciaId = null,
  diligenciaOriginal = null
) {
  const titulo = document.getElementById("diligencia-titulo").value.trim();
  const dataAlvoInput = document.getElementById("diligencia-data-alvo").value;
  const isRecorrente = document.getElementById("diligencia-recorrente").checked;
  const processoVinculadoInput = document
    .getElementById("diligencia-processo")
    .value.trim();
  const descricao = document
    .getElementById("diligencia-descricao")
    .value.trim();
  const errorMessage = document.getElementById("error-message");
  errorMessage.textContent = "";

  if (!titulo || !dataAlvoInput) {
    errorMessage.textContent = "Título e Data Alvo são obrigatórios.";
    return;
  }
  const dataAlvo = new Date(dataAlvoInput + "T00:00:00");
  if (isNaN(dataAlvo.getTime())) {
    errorMessage.textContent = "Data Alvo inválida.";
    return;
  }
  const processoVinculado = processoVinculadoInput.replace(/\D/g, "");
  if (processoVinculado && processoVinculado.length !== 20) {
    errorMessage.textContent =
      "O Número do Processo, se preenchido, deve ser válido.";
    return;
  }

  const modal = document.querySelector(".modal-content");
  const mesDeReferencia = new Date(modal.dataset.mesReferencia);

  if (diligenciaId && diligenciaOriginal && diligenciaOriginal.isRecorrente) {
    const confirmMessage = `Você está editando uma tarefa recorrente.\n\nAo continuar, as alterações serão aplicadas a partir deste mês, e o histórico anterior será preservado.\n\nDeseja prosseguir com a alteração?`;
    if (confirm(confirmMessage)) {
      const batch = db.batch();

      const originalTaskRef = db
        .collection("diligenciasMensais")
        .doc(diligenciaId);
      const dataTermino = new Date(
        mesDeReferencia.getFullYear(),
        mesDeReferencia.getMonth(),
        0
      );
      batch.update(originalTaskRef, {
        recorrenciaTerminaEm:
          firebase.firestore.Timestamp.fromDate(dataTermino),
      });

      // AQUI ESTÁ A CORREÇÃO:
      // Desestruturamos a tarefa original para remover o ID antigo
      const { id, ...dadosDaTarefaOriginalSemId } = diligenciaOriginal;

      const newTaskRef = db.collection("diligenciasMensais").doc();
      const novaTarefaData = {
        ...dadosDaTarefaOriginalSemId, // Usamos os dados limpos
        titulo,
        dataAlvo: firebase.firestore.Timestamp.fromDate(dataAlvo),
        isRecorrente,
        descricao,
        processoVinculado: processoVinculado || null,
        userId: auth.currentUser.uid,
        historicoCumprimentos: {},
        criadoEm: firebase.firestore.Timestamp.fromDate(
          new Date(mesDeReferencia.getFullYear(), mesDeReferencia.getMonth(), 1)
        ),
      };
      batch.set(newTaskRef, novaTarefaData);

      try {
        await batch.commit();
        showToast("Tarefa recorrente atualizada com sucesso!");
        document.body.removeChild(document.querySelector(".modal-overlay"));
      } catch (error) {
        console.error("Erro ao bifurcar tarefa:", error);
        errorMessage.textContent = "Ocorreu um erro ao atualizar a tarefa.";
      }
    }
    return;
  }

  // Lógica existente para novas tarefas ou edição de tarefas únicas
  const data = {
    titulo,
    dataAlvo: firebase.firestore.Timestamp.fromDate(dataAlvo),
    isRecorrente,
    processoVinculado: processoVinculado || null,
    descricao,
    userId: auth.currentUser.uid,
  };
  if (diligenciaId) {
    data.atualizadoEm = firebase.firestore.FieldValue.serverTimestamp();
    db.collection("diligenciasMensais")
      .doc(diligenciaId)
      .update(data)
      .then(() => {
        showToast(`Tarefa atualizada com sucesso!`);
        document.body.removeChild(document.querySelector(".modal-overlay"));
      })
      .catch((error) => {
        console.error("Erro ao salvar tarefa:", error);
        errorMessage.textContent = "Ocorreu um erro ao salvar a tarefa.";
      });
  } else {
    data.historicoCumprimentos = {};
    const mesDeCriacao = currentTasksPageDate;
    data.criadoEm = firebase.firestore.Timestamp.fromDate(
      new Date(mesDeCriacao.getFullYear(), mesDeCriacao.getMonth(), 1)
    );
    db.collection("diligenciasMensais")
      .add(data)
      .then(() => {
        showToast(`Tarefa salva com sucesso!`);
        document.body.removeChild(document.querySelector(".modal-overlay"));
      })
      .catch((error) => {
        console.error("Erro ao salvar tarefa:", error);
        errorMessage.textContent = "Ocorreu um erro ao salvar a tarefa.";
      });
  }
}

function setupDiligenciasListener(date) {
  if (diligenciasListenerUnsubscribe) diligenciasListenerUnsubscribe();

  const userId = auth.currentUser.uid;
  diligenciasListenerUnsubscribe = db
    .collection("diligenciasMensais")
    .where("userId", "==", userId)
    .onSnapshot(
      (snapshot) => {
        diligenciasCache = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        // Passa a data para a função de renderização
        renderDiligenciasList(diligenciasCache, date);
      },
      (error) => {
        console.error("Erro ao buscar tarefas: ", error);
        const container = document.getElementById("diligencias-list-container");
        if (container)
          container.innerHTML = `<p class="empty-list-message">Ocorreu um erro ao carregar as tarefas.</p>`;
      }
    );
}

function renderDiligenciasList(diligencias, date) {
  const container = document.getElementById("diligencias-list-container");
  if (!container) return;

  const anoMesSelecionado = `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
  const inicioDoMesVisivel = new Date(date.getFullYear(), date.getMonth(), 1);

  const tarefasDoMes = diligencias.filter((item) => {
    if (!item.dataAlvo) return false;

    // REGRA DE INÍCIO: A tarefa não pode começar a existir depois do mês que estamos vendo.
    const inicioDaVigencia = item.criadoEm
      ? new Date(
          item.criadoEm.toDate().getFullYear(),
          item.criadoEm.toDate().getMonth(),
          1
        )
      : new Date(1970, 0, 1);
    if (inicioDoMesVisivel < inicioDaVigencia) {
      return false;
    }

    // REGRA DE TÉRMINO: A tarefa não pode ter terminado antes do mês que estamos vendo.
    if (item.recorrenciaTerminaEm) {
      const dataTermino = item.recorrenciaTerminaEm.toDate();
      if (inicioDoMesVisivel > dataTermino) {
        return false;
      }
    }

    if (item.isRecorrente) return true;

    const dataAlvoTarefa = new Date(item.dataAlvo.seconds * 1000);
    return (
      dataAlvoTarefa.getFullYear() === date.getFullYear() &&
      dataAlvoTarefa.getMonth() === date.getMonth()
    );
  });

  if (tarefasDoMes.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhuma tarefa para este mês.</p>`;
    return;
  }

  tarefasDoMes.sort((a, b) => {
    const dataA = a.dataAlvo ? a.dataAlvo.seconds : 0;
    const dataB = b.dataAlvo ? b.dataAlvo.seconds : 0;
    return dataA - dataB;
  });

  let tableHTML = `<table id="monthly-tasks-table" class="data-table"><thead><tr><th>Data Alvo</th><th>Título da Tarefa</th><th>Tipo</th><th>Status</th><th class="actions-cell">Ações</th></tr></thead><tbody>`;
  tarefasDoMes.forEach((item) => {
    const isCumpridaUnica =
      !item.isRecorrente &&
      item.historicoCumprimentos &&
      Object.keys(item.historicoCumprimentos).length > 0;
    const isCumpridaRecorrente =
      item.isRecorrente &&
      item.historicoCumprimentos &&
      item.historicoCumprimentos[anoMesSelecionado];
    const isCumprida = isCumpridaUnica || isCumpridaRecorrente;
    const dataAlvo = new Date(item.dataAlvo.seconds * 1000);
    let statusBadge = "";
    let acoesBtnDesfazer = "";
    let linhaStyle = "";
    let tipoTarefa = item.isRecorrente
      ? '<span class="status-badge status-suspenso" style="background-color: #6a1b9a;">Recorrente</span>'
      : '<span class="status-badge status-ativo" style="background-color: #1565c0;">Única</span>';
    const dataAlvoFormatada = item.isRecorrente
      ? `${String(dataAlvo.getUTCDate()).padStart(2, "0")}/${String(
          date.getMonth() + 1
        ).padStart(2, "0")}/${date.getFullYear()}`
      : dataAlvo.toLocaleDateString("pt-BR", { timeZone: "UTC" });
    if (isCumprida) {
      const dataCumprimentoTimestamp = isCumpridaUnica
        ? Object.values(item.historicoCumprimentos)[0]
        : item.historicoCumprimentos[anoMesSelecionado];
      const dataCumprimento = new Date(dataCumprimentoTimestamp.seconds * 1000);
      const dataFormatada = dataCumprimento.toLocaleDateString("pt-BR", {
        timeZone: "UTC",
      });
      statusBadge = `<span class="status-badge status-ativo">Cumprido em ${dataFormatada}</span>`;
      acoesBtnDesfazer = `<button class="action-icon" title="Desfazer cumprimento" data-action="desfazer" data-id="${item.id}" data-mes-chave="${anoMesSelecionado}"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#5a6268"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg></button>`;
      linhaStyle = 'style="background-color: #e8f5e9;"';
    } else {
      statusBadge = `<span class="status-badge status-suspenso clickable-status" data-action="cumprir" data-id="${item.id}" data-mes-chave="${anoMesSelecionado}" title="Clique para marcar como cumprido">Pendente</span>`;
      acoesBtnDesfazer = `<button class="action-icon" disabled style="opacity: 0.3; cursor: not-allowed;"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#5a6268"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg></button>`;
      linhaStyle = "";
    }
    tableHTML += `<tr ${linhaStyle}><td>${dataAlvoFormatada}</td><td><a href="#" class="view-processo-link" data-action="view-desc" data-id="${item.id}">${item.titulo}</a></td><td>${tipoTarefa}</td><td class="tasks-status-cell">${statusBadge}</td><td class="actions-cell tasks-actions-cell"><div style="display: flex; justify-content: center; align-items: center; gap: 8px;">${acoesBtnDesfazer}<button class="action-icon icon-edit" title="Editar Tarefa" data-action="edit" data-id="${item.id}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button><button class="action-icon icon-delete" title="Excluir Tarefa" data-action="delete" data-id="${item.id}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></div></td></tr>`;
  });
  tableHTML += `</tbody></table>`;
  container.innerHTML = tableHTML;
}

function handleDiligenciaAction(event) {
  const target = event.target.closest("[data-action]");
  if (!target || !target.closest("#diligencias-list-container")) return;

  event.preventDefault();

  const action = target.dataset.action;
  const diligenciaId = target.dataset.id;
  const mesChave = target.dataset.mesChave;

  if (action === "cumprir") {
    handleCumprirDiligencia(diligenciaId, mesChave);
  } else if (action === "desfazer") {
    handleDesfazerDiligencia(diligenciaId, mesChave);
  } else if (action === "edit") {
    const tarefa = diligenciasCache.find((d) => d.id === diligenciaId);
    if (tarefa) {
      renderDiligenciaFormModal(tarefa);
    }
  } else if (action === "delete") {
    handleDeleteDiligencia(diligenciaId);
  } else if (action === "view-desc") {
    const tarefa = diligenciasCache.find((d) => d.id === diligenciaId);
    if (tarefa) {
      // AQUI ESTÁ A MUDANÇA: Chamando o novo modal
      renderTaskDetailsModal(tarefa);
    }
  }
}

function handleCumprirDiligencia(diligenciaId, anoMesChave) {
  const updateData = {};
  // Usa a chave do mês para marcar como cumprido
  updateData[`historicoCumprimentos.${anoMesChave}`] =
    firebase.firestore.FieldValue.serverTimestamp();

  db.collection("diligenciasMensais")
    .doc(diligenciaId)
    .update(updateData)
    .then(() => {
      showToast("Tarefa marcada como cumprida!");
    })
    .catch((error) => {
      console.error("Erro ao cumprir tarefa: ", error);
      showToast("Ocorreu um erro.", "error");
    });
}

function handleDesfazerDiligencia(diligenciaId, anoMesChave) {
  const updateData = {};
  // Usa a chave do mês para remover o registro de cumprimento
  updateData[`historicoCumprimentos.${anoMesChave}`] =
    firebase.firestore.FieldValue.delete();

  db.collection("diligenciasMensais")
    .doc(diligenciaId)
    .update(updateData)
    .then(() => {
      showToast("Ação desfeita.");
    })
    .catch((error) => {
      console.error("Erro ao desfazer tarefa: ", error);
      showToast("Ocorreu um erro.", "error");
    });
}

// CÓDIGO PARA SUBSTITUIR
function handleDeleteDiligencia(diligenciaId) {
  if (
    confirm(
      "Tem certeza que deseja excluir este modelo de tarefa? Esta ação é permanente."
    )
  ) {
    db.collection("diligenciasMensais")
      .doc(diligenciaId)
      .delete()
      .then(() => {
        showToast("Tarefa excluída com sucesso.");
      })
      .catch((error) => {
        console.error("Erro ao excluir tarefa:", error);
        showToast("Ocorreu um erro ao excluir.", "error");
      });
  }
}

function renderReadOnlyTextModal(title, content) {
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

// NOVO MODAL ESPECÍFICO PARA TAREFAS
function renderTaskDetailsModal(tarefa) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";

  // Prepara o conteúdo do processo, se houver
  let processoHTML = `
        <div class="detail-item">
            <span class="detail-label">Processo Vinculado:</span>
            <span class="detail-value">Nenhum</span>
        </div>`;
  if (tarefa.processoVinculado) {
    processoHTML = `
        <div class="detail-item">
            <span class="detail-label">Processo Vinculado:</span>
            <span class="detail-value">${formatProcessoForDisplay(
              tarefa.processoVinculado
            )}</span>
        </div>`;
  }

  // Prepara o conteúdo da descrição
  const descricaoFormatada = (
    tarefa.descricao || "Nenhuma descrição cadastrada."
  ).replace(/\n/g, "<br>");

  modalOverlay.innerHTML = `
        <div class="modal-content">
            <h3>Detalhes da Tarefa</h3>
            <div class="task-details-container">
                ${processoHTML}
                <div class="detail-item-full">
                    <span class="detail-label">Descrição:</span>
                    <div class="detail-description-box">${descricaoFormatada}</div>
                </div>
            </div>
            <div class="form-buttons" style="justify-content: flex-end; margin-top: 20px;">
                <button id="close-task-details-modal" class="btn-secondary">Fechar</button>
            </div>
        </div>
    `;

  document.body.appendChild(modalOverlay);

  const closeModal = () => document.body.removeChild(modalOverlay);
  document
    .getElementById("close-task-details-modal")
    .addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
}

// Adicione esta nova função
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
      if (!acc[chave]) {
        acc[chave] = [];
      }
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
                    </div>
                `;
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

// Localize e substitua a função renderDevedorDetailPage inteira
async function renderDevedorDetailPage(devedorId) {
  pageTitle.textContent = "Carregando...";
  document.title = "SASIF | Carregando...";
  renderSidebar(null);
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
    setupProcessosListener(devedorId);
  } catch (error) {
    console.error("Erro ao carregar página do devedor:", error);
    showToast("Ocorreu um erro ao carregar os dados.", "error");
  }
}

// Localize e substitua a função renderProcessosList inteira
function renderProcessosList(processos, incidentesDoDevedor = []) {
  const totalProcessos = processos.length;
  const totaisPorExequente = {};
  const contagemPorExequente = {};
  const numerosProcessosComIncidentes = new Set(
    incidentesDoDevedor.map((inc) => inc.numeroProcessoPrincipal)
  );
  processos.forEach((processo) => {
    const valor = processo.valorAtual
      ? processo.valorAtual.valor
      : processo.valorDivida || 0;
    const exequenteId = processo.exequenteId;
    if (exequenteId) {
      if (totaisPorExequente[exequenteId]) {
        totaisPorExequente[exequenteId] += valor;
      } else {
        totaisPorExequente[exequenteId] = valor;
      }
      if (contagemPorExequente[exequenteId]) {
        contagemPorExequente[exequenteId]++;
      } else {
        contagemPorExequente[exequenteId] = 1;
      }
    }
  });
  const valorTotalGeral = Object.values(totaisPorExequente).reduce(
    (total, valor) => total + valor,
    0
  );
  let detalhamentoHTML = "";
  for (const exequenteId in totaisPorExequente) {
    const exequente = exequentesCache.find((e) => e.id === exequenteId);
    const nomeExequente = exequente
      ? exequente.nome
      : "Exequente não identificado";
    const contagem = contagemPorExequente[exequenteId] || 0;
    detalhamentoHTML += `<p style="margin-left: 20px; margin-top: 8px;">↳ <strong>${nomeExequente}:</strong> ${formatCurrency(
      totaisPorExequente[exequenteId]
    )} <span style="font-weight: 500; color: #555;">(${contagem})</span></p>`;
  }
  const resumoContainer = document.getElementById(
    "resumo-financeiro-container"
  );
  if (resumoContainer) {
    resumoContainer.innerHTML = `<div class="detail-card" style="margin-top: 20px;"><h3>Resumo Financeiro e Processual</h3><div class="detail-grid" style="grid-template-columns: 1fr;"><div><div class="info-tooltip-container" style="margin-bottom: 10px;"><strong>Valor Total (Gerencial):</strong> ${formatCurrency(
      valorTotalGeral
    )} <span style="font-weight: 700; color: #333;">(${totalProcessos})</span><span class="info-icon">i</span><div class="info-tooltip-text">Este valor é uma referência, resultado da soma dos valores cadastrados para cada processo. O número entre parênteses indica a quantidade total de processos.</div></div><div id="detalhamento-exequente">${detalhamentoHTML}</div></div></div></div>`;
  }
  const container = document.getElementById("processos-list-container");
  if (!container) return;
  let itemsParaOrdenar = processos.filter(
    (p) => p.tipoProcesso === "autônomo" || p.tipoProcesso === "piloto"
  );
  const apensos = processos.filter((p) => p.tipoProcesso === "apenso");
  itemsParaOrdenar.sort((a, b) => {
    const exequenteA =
      exequentesCache.find((ex) => ex.id === a.exequenteId)?.nome || "";
    const exequenteB =
      exequentesCache.find((ex) => ex.id === b.exequenteId)?.nome || "";
    if (exequenteA < exequenteB) return -1;
    if (exequenteA > exequenteB) return 1;
    const timeA = a.criadoEm ? a.criadoEm.seconds : 0;
    const timeB = b.criadoEm ? b.criadoEm.seconds : 0;
    return timeB - timeA;
  });
  const apensosMap = apensos.reduce((map, apenso) => {
    const pilotoId = apenso.processoPilotoId;
    if (!map.has(pilotoId)) map.set(pilotoId, []);
    map.get(pilotoId).push(apenso);
    return map;
  }, new Map());
  const itemsOrdenados = itemsParaOrdenar;
  if (itemsOrdenados.length === 0 && apensos.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhum processo cadastrado.</p>`;
    return;
  }
  let tableHTML = `<table class="data-table"><thead><tr><th>Número do Processo</th><th>Exequente</th><th>Tipo</th><th>Status</th><th>Valor</th><th class="actions-cell">Ações</th></tr></thead><tbody>`;
  const renderRow = (proc, isApenso = false) => {
    const temIncidentes = numerosProcessosComIncidentes.has(
      proc.numeroProcesso
    );
    const indicadorIncidente = temIncidentes
      ? ` <svg title="Possui incidente(s) vinculado(s)" style="width:16px; height:16px; vertical-align:middle; fill:#555;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v11.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>`
      : "";
    const exequente = exequentesCache.find((ex) => ex.id === proc.exequenteId);
    const motivo =
      proc.status === "Suspenso" && proc.motivoSuspensaoId
        ? motivosSuspensaoCache.find((m) => m.id === proc.motivoSuspensaoId)
        : null;
    const statusText = motivo
      ? `Suspenso (${motivo.descricao})`
      : proc.status || "Ativo";
    const valorExibido = proc.valorAtual
      ? proc.valorAtual.valor
      : proc.valorDivida || 0;
    const tipoProcessoTexto = isApenso
      ? "Apenso"
      : proc.tipoProcesso.charAt(0).toUpperCase() + proc.tipoProcesso.slice(1);
    let rowClass = isApenso ? "apenso-row" : `${proc.tipoProcesso}-row`;
    let rowDataAttrs = `data-id="${proc.id}"`;
    if (isApenso) {
      rowDataAttrs += ` data-piloto-ref="${proc.processoPilotoId}"`;
    } else if (proc.tipoProcesso === "piloto") {
      rowDataAttrs += ` data-piloto-id="${proc.id}"`;
    }
    return `<tr class="${rowClass}" ${rowDataAttrs}><td>${
      proc.tipoProcesso === "piloto" ? '<span class="toggle-icon"></span>' : ""
    }<a href="#" class="view-processo-link" data-action="view-detail">${formatProcessoForDisplay(
      proc.numeroProcesso
    )}</a>${indicadorIncidente}</td><td>${
      exequente ? exequente.nome : "N/A"
    }</td><td>${tipoProcessoTexto}</td><td><span class="status-badge status-${(
      proc.status || "Ativo"
    )
      .toLowerCase()
      .replace(" ", "-")}">${statusText}</span></td><td>${formatCurrency(
      valorExibido
    )}</td><td class="actions-cell"><button class="action-icon icon-edit" title="Editar Processo" data-id="${
      proc.id
    }"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button><button class="action-icon icon-delete" title="Excluir Processo" data-id="${
      proc.id
    }"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></td></tr>`;
  };
  itemsOrdenados.forEach((item) => {
    tableHTML += renderRow(item);
    if (item.tipoProcesso === "piloto" && apensosMap.has(item.id)) {
      apensosMap.get(item.id).forEach((apenso) => {
        tableHTML += renderRow(apenso, true);
      });
    }
  });
  tableHTML += `</tbody></table>`;
  container.innerHTML = tableHTML;
  container
    .querySelector("tbody")
    .addEventListener("click", handleProcessoAction);
}

function renderProcessoDetailPage(processoId) {
  pageTitle.textContent = "Carregando Processo...";
  document.title = "SASIF | Carregando...";
  renderSidebar(null);

  db.collection("processos")
    .doc(processoId)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        showToast("Processo não encontrado.", "error");
        navigateTo("dashboard");
        return;
      }
      const processo = { id: doc.id, ...doc.data() };
      const devedor = devedoresCache.find((d) => d.id === processo.devedorId);
      const exequente = exequentesCache.find(
        (e) => e.id === processo.exequenteId
      );

      const pageTitleText = `Processo ${formatProcessoForDisplay(
        processo.numeroProcesso
      )}`;
      pageTitle.textContent = pageTitleText;
      document.title = `SASIF | ${pageTitleText}`;

      contentArea.innerHTML = `
                <div class="dashboard-actions">
                    <button id="back-to-devedor-btn" class="btn-secondary"> ← Voltar para ${
                      devedor ? devedor.razaoSocial : "Devedor"
                    }</button>
                    ${
                      processo.tipoProcesso === "apenso" ||
                      processo.tipoProcesso === "autônomo"
                        ? `<button id="promote-piloto-btn" class="btn-primary" style="background-color: var(--cor-sucesso);">★ Promover a Piloto</button>`
                        : ""
                    }
                    ${
                      processo.tipoProcesso === "apenso"
                        ? `<button id="unattach-processo-btn" class="btn-secondary" style="background-color: #ffc107; color: #333;">⬚ Desapensar</button>`
                        : ""
                    }
                    <div style="margin-left: auto; display: flex; gap: 8px;">
                        <button id="edit-processo-btn" class="action-icon icon-edit" title="Editar Processo"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                        <button id="delete-processo-btn" class="action-icon icon-delete" title="Excluir Processo"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
                    </div>
                </div>
                <div class="detail-card">
                    <h3>Detalhes do Processo</h3>
                    <div class="detail-grid" style="grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));">
                        <div> <p><strong>Exequente:</strong> ${
                          exequente ? exequente.nome : "N/A"
                        }</p> <p><strong>Executado:</strong> ${
        devedor ? devedor.razaoSocial : "N/A"
      }</p> </div>
                        <div> <p><strong>Tipo:</strong> ${
                          processo.tipoProcesso.charAt(0).toUpperCase() +
                          processo.tipoProcesso.slice(1)
                        }</p> <div class="valor-divida-container"> <p><strong>Valor da Dívida:</strong> ${formatCurrency(
        processo.valorAtual ? processo.valorAtual.valor : processo.valorDivida
      )}</p> <div class="valor-divida-actions"> <button id="update-valor-btn" class="action-btn btn-edit">Atualizar</button> <button id="view-history-btn" class="action-btn btn-secondary">Histórico</button> </div> </div> </div>
                    </div>
                    <div class="detail-full-width"> <strong>CDA(s):</strong> <p>${
                      processo.cdas
                        ? processo.cdas.replace(/\n/g, "<br>")
                        : "Nenhuma CDA cadastrada."
                    }</p> </div>
                </div>
                <div class="content-section"> <div class="section-header"> <h2>Corresponsáveis Tributários</h2> <button id="add-corresponsavel-btn" class="btn-primary">Adicionar</button> </div> <div id="corresponsaveis-list-container"></div> </div>
                <div class="content-section"> <div class="section-header"> <h2>Constrições Patrimoniais</h2> <button id="add-penhora-btn" class="btn-primary">Adicionar</button> </div> <div id="penhoras-list-container"></div> </div>
                <div class="content-section"> <div class="section-header"> <h2>Audiências Agendadas</h2> <button id="add-audiencia-btn" class="btn-primary">Adicionar</button> </div> <div id="audiencias-list-container"></div> </div>
                <div class="content-section"> <div class="section-header"> <h2>Incidentes Processuais Vinculados</h2> </div> <div id="incidentes-list-container"></div> </div>

                <!-- NOVA SEÇÃO DE ANEXOS -->
                <div class="content-section">
                    <div class="section-header">
                        <h2>Anexos</h2>
                        <div id="anexos-actions-container">
                            <!-- Botões de visualizar e anexar serão inseridos aqui -->
                        </div>
                    </div>
                    <div id="anexos-list-container">
                         <p class="empty-list-message">Nenhum anexo para este processo.</p>
                    </div>
                </div>
            `;

      document
        .getElementById("back-to-devedor-btn")
        .addEventListener("click", () => {
          renderDevedorDetailPage(processo.devedorId);
        });
      document
        .getElementById("add-corresponsavel-btn")
        .addEventListener("click", () =>
          renderCorresponsavelFormModal(processoId)
        );
      setupCorresponsaveisListener(processoId);
      document
        .getElementById("add-penhora-btn")
        .addEventListener("click", () => renderPenhoraFormModal(processoId));
      setupPenhorasListener(processoId);
      document
        .getElementById("add-audiencia-btn")
        .addEventListener("click", () => renderAudienciaFormModal(processoId));
      setupAudienciasListener(processoId);
      setupIncidentesDoProcessoListener(processo.numeroProcesso);
      setupAnexosListener(processoId);

      // Adicionaremos o setupAnexosListener aqui no Passo 4

      if (document.getElementById("promote-piloto-btn")) {
        document
          .getElementById("promote-piloto-btn")
          .addEventListener("click", () => {
            handlePromoteToPiloto(processo.id);
          });
      }
      if (document.getElementById("unattach-processo-btn")) {
        document
          .getElementById("unattach-processo-btn")
          .addEventListener("click", () => {
            handleUnattachProcesso(processo.id);
          });
      }
      document
        .getElementById("update-valor-btn")
        .addEventListener("click", () => {
          renderValorUpdateModal(processo.id);
        });
      document
        .getElementById("view-history-btn")
        .addEventListener("click", () => {
          renderValorHistoryModal(processo.id);
        });
      document
        .getElementById("delete-processo-btn")
        .addEventListener("click", () => {
          handleDeleteProcesso(processo.id);
        });
      document
        .getElementById("edit-processo-btn")
        .addEventListener("click", () => {
          handleEditProcesso(processo.id);
        });
    })
    .catch((error) => {
      console.error("Erro ao buscar detalhes do processo:", error);
      showToast("Erro ao carregar o processo.", "error");
    });
}

function renderRelatorioResultados(processos) {
  const resultsContainer = document.getElementById("report-results-container");

  if (processos.length === 0) {
    resultsContainer.innerHTML = `<p class="empty-list-message">Nenhum processo encontrado com os filtros selecionados.</p>`;
    return;
  }

  const total = processos.length;
  const valorTotal = processos.reduce(
    (sum, proc) => sum + (proc.valorAtual?.valor || proc.valorDivida || 0),
    0
  );

  // ADICIONA A CLASSE 'sortable' E OS ATRIBUTOS 'data-sort-key' AOS CABEÇALHOS
  let tableHTML = `
        <div class="detail-card">
            <h3>Resultados do Relatório</h3>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <p><strong>Total de Processos:</strong> ${total}</p>
                <p><strong>Valor Total das Dívidas:</strong> ${formatCurrency(
                  valorTotal
                )}</p>
                <button id="download-pdf-btn" class="btn-secondary">Download PDF</button>
            </div>
            <table class="data-table" id="report-table">
                <thead>
                    <tr>
                        <th class="sortable" data-sort-key="numeroProcesso">Número do Processo <span class="sort-icon"></span></th>
                        <th class="sortable" data-sort-key="devedor">Devedor <span class="sort-icon"></span></th>
                        <th class="sortable" data-sort-key="exequente">Exequente <span class="sort-icon"></span></th>
                        <th class="sortable" data-sort-key="valor">Valor <span class="sort-icon"></span></th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            </table>
        </div>
    `;

  resultsContainer.innerHTML = tableHTML;

  // CHAMA UMA NOVA FUNÇÃO PARA RENDERIZAR APENAS O CORPO DA TABELA
  renderReportTableBody(processos);

  // Adiciona listener para os cliques de ordenação no cabeçalho
  resultsContainer
    .querySelector("thead")
    .addEventListener("click", handleReportSort);

  document.getElementById("download-pdf-btn").addEventListener("click", () => {
    gerarPDFRelatorio();
  });
}

function gerarPDFRelatorio() {
  // Pega a instância do jsPDF que foi carregada no window
  const { jsPDF } = window.jspdf;

  if (currentReportData.length === 0) {
    showToast("Não há dados para gerar o relatório.", "error");
    return;
  }

  // Cria um novo documento PDF no formato retrato (portrait), usando milímetros e tamanho A4.
  const doc = new jsPDF("p", "mm", "a4");

  // Define o título do documento
  doc.setFontSize(18);
  doc.text("Relatório de Processos - SASIF", 14, 22);

  // Adiciona informações sobre os filtros aplicados
  doc.setFontSize(11);
  doc.setTextColor(100); // Cor cinza

  const tipoFiltro =
    document.getElementById("filtro-tipo-processo").value || "Todos";
  const statusFiltro =
    document.getElementById("filtro-status-processo").value || "Todos";
  const exequenteId = document.getElementById("filtro-exequente").value;
  const devedorId = document.getElementById("filtro-devedor").value;

  const exequenteFiltro =
    exequentesCache.find((e) => e.id === exequenteId)?.nome || "Todos";
  const devedorFiltro =
    devedoresCache.find((d) => d.id === devedorId)?.razaoSocial || "Todos";

  const filtrosTexto = `Filtros Aplicados:
- Tipo: ${tipoFiltro.charAt(0).toUpperCase() + tipoFiltro.slice(1)}
- Status: ${statusFiltro}
- Exequente: ${exequenteFiltro}
- Executado: ${devedorFiltro}
`;
  doc.text(filtrosTexto, 14, 32);

  // Usa o plugin autoTable para gerar a tabela a partir do nosso elemento HTML
  doc.autoTable({
    html: "#report-table", // Pega a tabela que já está na tela
    startY: 65, // Posição vertical para começar a tabela, abaixo do texto
    theme: "grid", // Estilo da tabela
    headStyles: {
      fillColor: [13, 71, 161], // Azul escuro do nosso tema (var(--cor-primaria))
      textColor: [255, 255, 255], // Texto branco
    },
    didParseCell: function (data) {
      // Remove os ícones de ordenação ▲/▼ da célula do cabeçalho
      if (data.section === "head") {
        data.cell.text = data.cell.text.map((s) =>
          s.replace(" ▲", "").replace(" ▼", "")
        );
      }
    },
  });

  // Gera o nome do arquivo dinamicamente
  const dataGeracao = new Date()
    .toLocaleDateString("pt-BR")
    .replace(/\//g, "-");
  const nomeArquivo = `SASIF-Relatorio-Processos-${dataGeracao}.pdf`;

  // Salva o arquivo
  doc.save(nomeArquivo);
}

// FUNÇÃO 1: RENDERIZA APENAS O CORPO DA TABELA
function renderReportTableBody(processos) {
  const tableBody = document.querySelector("#report-table tbody");
  if (!tableBody) return;

  let bodyHTML = "";
  processos.forEach((proc) => {
    const devedor = devedoresCache.find((d) => d.id === proc.devedorId);
    const exequente = exequentesCache.find((e) => e.id === proc.exequenteId);
    const valor = proc.valorAtual?.valor || proc.valorDivida || 0;

    bodyHTML += `
            <tr>
                <td><a href="#" class="view-processo-link" data-id="${
                  proc.id
                }">${formatProcessoForDisplay(proc.numeroProcesso)}</a></td>
                <td>${devedor ? devedor.razaoSocial : "N/A"}</td>
                <td>${exequente ? exequente.nome : "N/A"}</td>
                <td>${formatCurrency(valor)}</td>
            </tr>
        `;
  });
  tableBody.innerHTML = bodyHTML;

  // Adiciona listener para os links dos processos no corpo da tabela
  tableBody.addEventListener("click", (e) => {
    if (e.target.matches(".view-processo-link")) {
      e.preventDefault();
      navigateTo("processoDetail", { id: e.target.dataset.id });
    }
  });
}

// FUNÇÃO 2: ATUALIZA OS ÍCONES DE ORDENAÇÃO NOS CABEÇALHOS
function updateSortIcons() {
  document.querySelectorAll("#report-table th.sortable").forEach((th) => {
    const key = th.dataset.sortKey;
    const icon = th.querySelector(".sort-icon");
    if (key === currentSortState.key) {
      icon.textContent = currentSortState.direction === "asc" ? "▲" : "▼";
    } else {
      icon.textContent = "";
    }
  });
}

// FUNÇÃO 3: LIDA COM O CLIQUE NO CABEÇALHO PARA ORDENAR
function handleReportSort(event) {
  const target = event.target.closest("th.sortable");
  if (!target) return;

  const sortKey = target.dataset.sortKey;

  // Define a direção da ordenação
  if (currentSortState.key === sortKey) {
    currentSortState.direction =
      currentSortState.direction === "asc" ? "desc" : "asc";
  } else {
    currentSortState.key = sortKey;
    currentSortState.direction = "asc";
  }

  // Ordena os dados
  currentReportData.sort((a, b) => {
    let comparison = 0;

    switch (sortKey) {
      // LÓGICA DE ORDENAÇÃO CUSTOMIZADA PARA NÚMERO DE PROCESSO
      case "numeroProcesso":
        const anoA = parseInt(a.numeroProcesso.substring(9, 13), 10);
        const anoB = parseInt(b.numeroProcesso.substring(9, 13), 10);

        // 1. Compara pelo ano primeiro
        if (anoA !== anoB) {
          comparison = anoA - anoB;
        } else {
          // 2. Se os anos são iguais, compara pelo número sequencial
          const seqA = parseInt(a.numeroProcesso.substring(0, 7), 10);
          const seqB = parseInt(b.numeroProcesso.substring(0, 7), 10);
          comparison = seqA - seqB;
        }
        break;

      case "valor":
        const valA_valor = a.valorAtual?.valor || a.valorDivida || 0;
        const valB_valor = b.valorAtual?.valor || b.valorDivida || 0;
        comparison = valA_valor - valB_valor;
        break;

      case "devedor":
        const valA_dev =
          devedoresCache.find((d) => d.id === a.devedorId)?.razaoSocial || "";
        const valB_dev =
          devedoresCache.find((d) => d.id === b.devedorId)?.razaoSocial || "";
        comparison = valA_dev.localeCompare(valB_dev, "pt-BR");
        break;

      case "exequente":
        const valA_ex =
          exequentesCache.find((e) => e.id === a.exequenteId)?.nome || "";
        const valB_ex =
          exequentesCache.find((e) => e.id === b.exequenteId)?.nome || "";
        comparison = valA_ex.localeCompare(valB_ex, "pt-BR");
        break;
    }

    return currentSortState.direction === "asc" ? comparison : -comparison;
  });

  // Re-renderiza o corpo da tabela e atualiza os ícones
  renderReportTableBody(currentReportData);
  updateSortIcons();
}

function renderCorresponsavelFormModal(processoId, corresponsavel = null) {
  const isEditing = corresponsavel !== null;
  const tipoPessoa = isEditing
    ? corresponsavel.cpfCnpj && corresponsavel.cpfCnpj.length > 11
      ? "juridica"
      : "fisica"
    : "fisica";

  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";

  modalOverlay.innerHTML = `
        <div class="modal-content modal-large">
            <h3>${isEditing ? "Editar" : "Adicionar"} Corresponsável</h3>
            <div class="form-group">
                <label for="corresponsavel-nome">Nome / Razão Social (Obrigatório)</label>
                <input type="text" id="corresponsavel-nome" value="${
                  isEditing ? corresponsavel.nome : ""
                }" required>
            </div>
            <div class="form-group">
                <label for="tipo-pessoa">Tipo de Pessoa</label>
                <select id="tipo-pessoa" class="import-devedor-select">
                    <option value="fisica">Pessoa Física</option>
                    <option value="juridica">Pessoa Jurídica</option>
                </select>
            </div>
            <div class="form-group">
                <label for="corresponsavel-documento">CPF / CNPJ</label>
                <input type="text" id="corresponsavel-documento" 
                       value="${
                         isEditing
                           ? formatDocumentForDisplay(corresponsavel.cpfCnpj)
                           : ""
                       }"
                       placeholder="Digite o CPF">
            </div>
            <div id="error-message"></div>
            <div class="form-buttons">
                <button id="save-corresponsavel-btn" class="btn-primary">Salvar</button>
                <button id="cancel-corresponsavel-btn">Cancelar</button>
            </div>
        </div>
    `;

  document.body.appendChild(modalOverlay);

  const tipoPessoaSelect = document.getElementById("tipo-pessoa");
  const documentoInput = document.getElementById("corresponsavel-documento");

  tipoPessoaSelect.value = tipoPessoa;

  const updateDocumentField = () => {
    if (tipoPessoaSelect.value === "fisica") {
      documentoInput.placeholder = "Digite o CPF";
    } else {
      documentoInput.placeholder = "Digite o CNPJ";
    }
    documentoInput.value = "";
  };

  updateDocumentField();

  documentoInput.addEventListener("input", () =>
    maskDocument(documentoInput, tipoPessoaSelect.value)
  );
  tipoPessoaSelect.addEventListener("change", updateDocumentField);

  if (isEditing) {
    documentoInput.value = formatDocumentForDisplay(corresponsavel.cpfCnpj);
  } else {
    updateDocumentField();
  }

  const closeModal = () => document.body.removeChild(modalOverlay);

  document
    .getElementById("save-corresponsavel-btn")
    .addEventListener("click", () => {
      handleSaveCorresponsavel(
        processoId,
        isEditing ? corresponsavel.id : null
      );
    });
  document
    .getElementById("cancel-corresponsavel-btn")
    .addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });
}

function setupCorresponsaveisListener(processoId) {
  if (corresponsaveisListenerUnsubscribe) corresponsaveisListenerUnsubscribe();

  corresponsaveisListenerUnsubscribe = db
    .collection("corresponsaveis")
    .where("processoId", "==", processoId)
    .orderBy("criadoEm", "desc")
    .onSnapshot(
      (snapshot) => {
        const corresponsaveis = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        renderCorresponsaveisList(corresponsaveis, processoId);
      },
      (error) => {
        console.error("Erro ao buscar corresponsáveis: ", error);
        const container = document.getElementById(
          "corresponsaveis-list-container"
        );
        if (container)
          container.innerHTML = `<p class="empty-list-message">Ocorreu um erro ao carregar os corresponsáveis.</p>`;
      }
    );
}

function renderCorresponsaveisList(corresponsaveis, processoId) {
  const container = document.getElementById("corresponsaveis-list-container");
  if (!container) return;

  container.dataset.processoId = processoId;

  if (corresponsaveis.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhum corresponsável cadastrado para este processo.</p>`;
    return;
  }

  let tableHTML = `<table class="data-table"><thead><tr><th>Nome / Razão Social</th><th>CPF/CNPJ</th><th class="detail-actions-cell">Ações</th></tr></thead><tbody>`;
  corresponsaveis.forEach((item) => {
    tableHTML += `
            <tr data-id="${item.id}" data-nome="${item.nome}" data-cpf-cnpj="${
      item.cpfCnpj || ""
    }">
                <td>${item.nome}</td>
                <td>${formatDocumentForDisplay(item.cpfCnpj)}</td>
                <td class="detail-actions-cell">
                    <div class="actions-container">
                        <button class="action-icon icon-edit" title="Editar Corresponsável" data-id="${
                          item.id
                        }">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                        </button>
                        <button class="action-icon icon-delete" title="Excluir Corresponsável" data-id="${
                          item.id
                        }">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
  });
  tableHTML += `</tbody></table>`;
  container.innerHTML = tableHTML;

  container
    .querySelector("tbody")
    .addEventListener("click", handleCorresponsavelAction);
}
function handleCorresponsavelAction(event) {
  const button = event.target.closest(".action-icon");
  if (!button) return;

  const row = button.closest("tr");
  const corresponsavelId = row.dataset.id;
  const container = document.getElementById("corresponsaveis-list-container");
  const processoId = container.dataset.processoId;

  if (button.classList.contains("icon-edit")) {
    const corresponsavelData = {
      id: corresponsavelId,
      nome: row.dataset.nome,
      cpfCnpj: row.dataset.cpfCnpj,
    };
    renderCorresponsavelFormModal(processoId, corresponsavelData);
  } else if (button.classList.contains("icon-delete")) {
    handleDeleteCorresponsavel(corresponsavelId);
  }
}

function handleSaveCorresponsavel(processoId, corresponsavelId = null) {
  const nome = document.getElementById("corresponsavel-nome").value.trim();
  const documento = document
    .getElementById("corresponsavel-documento")
    .value.trim();
  const errorMessage = document.getElementById("error-message");
  errorMessage.textContent = "";

  if (!nome) {
    errorMessage.textContent = "O campo Nome / Razão Social é obrigatório.";
    return;
  }

  const data = {
    processoId,
    nome,
    cpfCnpj: documento.replace(/\D/g, ""),
  };

  let promise;
  if (corresponsavelId) {
    data.atualizadoEm = firebase.firestore.FieldValue.serverTimestamp();
    promise = db
      .collection("corresponsaveis")
      .doc(corresponsavelId)
      .update(data);
  } else {
    data.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
    promise = db.collection("corresponsaveis").add(data);
  }

  promise
    .then(() => {
      showToast(
        `Corresponsável ${
          corresponsavelId ? "atualizado" : "salvo"
        } com sucesso!`
      );
      document.body.removeChild(document.querySelector(".modal-overlay"));
    })
    .catch((error) => {
      console.error("Erro ao salvar corresponsável:", error);
      errorMessage.textContent = "Ocorreu um erro ao salvar.";
    });
}

function handleDeleteCorresponsavel(corresponsavelId) {
  if (confirm("Tem certeza que deseja excluir este corresponsável?")) {
    db.collection("corresponsaveis")
      .doc(corresponsavelId)
      .delete()
      .then(() => showToast("Corresponsável excluído com sucesso."))
      .catch((error) => {
        console.error("Erro ao excluir corresponsável:", error);
        showToast("Erro ao excluir o corresponsável.", "error");
      });
  }
}

function renderIncidenteFormModal(incidente = null) {
  const isEditing = incidente !== null;
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";

  const devedorOptions = [...devedoresCache]
    .sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial))
    .map(
      (d) =>
        `<option value="${d.id}" ${
          isEditing && incidente.devedorId === d.id ? "selected" : ""
        }>${d.razaoSocial}</option>`
    )
    .join("");

  modalOverlay.innerHTML = `
        <div class="modal-content modal-large">
            <h3>${isEditing ? "Editar" : "Cadastrar"} Incidente Processual</h3>
            
            <div class="form-group">
                <label for="incidente-devedor">Grande Devedor Vinculado (Obrigatório)</label>
                <select id="incidente-devedor" class="import-devedor-select" ${
                  isEditing ? "disabled" : ""
                }>
                    <option value="">Selecione um devedor...</option>
                    ${devedorOptions}
                </select>
            </div>

            <div class="form-group">
                <label for="incidente-numero">Número do Incidente (Obrigatório)</label>
                <input type="text" id="incidente-numero" placeholder="Formato: 0000000-00.0000.0.00.0000" 
                       value="${
                         isEditing
                           ? formatProcessoForDisplay(incidente.numeroIncidente)
                           : ""
                       }" required>
            </div>

            <div class="form-group">
                <label for="incidente-processo-principal">Número do Processo Principal (Obrigatório)</label>
                <input type="text" id="incidente-processo-principal" placeholder="Formato: 0000000-00.0000.0.00.0000"
                       value="${
                         isEditing
                           ? formatProcessoForDisplay(
                               incidente.numeroProcessoPrincipal
                             )
                           : ""
                       }" required>
                <small style="color: #555; margin-top: 4px; display: block;">
                    Digite o número ou, se o processo estiver no SASIF, use a busca ao lado. 
                    A vinculação visual só ocorrerá se o processo principal estiver cadastrado.
                </small>
            </div>

            <div class="form-group">
                <label for="incidente-descricao">Descrição (Obrigatório)</label>
                <textarea id="incidente-descricao" rows="4" required>${
                  isEditing ? incidente.descricao : ""
                }</textarea>
            </div>

            <div class="form-group">
                <label for="incidente-status">Status</label>
                <select id="incidente-status" class="import-devedor-select">
                    <option value="Em Andamento" ${
                      isEditing && incidente.status === "Em Andamento"
                        ? "selected"
                        : ""
                    }>Em Andamento</option>
                    <option value="Concluído" ${
                      isEditing && incidente.status === "Concluído"
                        ? "selected"
                        : ""
                    }>Concluído</option>
                </select>
            </div>

            <div id="error-message"></div>
            <div class="form-buttons">
                <button id="save-incidente-btn" class="btn-primary">Salvar</button>
                <button id="cancel-incidente-btn">Cancelar</button>
            </div>
        </div>
    `;

  document.body.appendChild(modalOverlay);

  // Adiciona as máscaras aos campos de número de processo
  document
    .getElementById("incidente-numero")
    .addEventListener("input", (e) => maskProcesso(e.target));
  document
    .getElementById("incidente-processo-principal")
    .addEventListener("input", (e) => maskProcesso(e.target));

  const closeModal = () => document.body.removeChild(modalOverlay);

  document
    .getElementById("save-incidente-btn")
    .addEventListener("click", () => {
      handleSaveIncidente(isEditing ? incidente.id : null);
    });
  document
    .getElementById("cancel-incidente-btn")
    .addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
}

function handleSaveIncidente(incidenteId = null) {
  const devedorId = document.getElementById("incidente-devedor").value;
  const numeroIncidenteInput =
    document.getElementById("incidente-numero").value;
  const numeroProcessoPrincipalInput = document.getElementById(
    "incidente-processo-principal"
  ).value;
  const descricao = document.getElementById("incidente-descricao").value.trim();
  const status = document.getElementById("incidente-status").value;
  const errorMessage = document.getElementById("error-message");
  errorMessage.textContent = "";

  const numeroIncidente = numeroIncidenteInput.replace(/\D/g, "");
  const numeroProcessoPrincipal = numeroProcessoPrincipalInput.replace(
    /\D/g,
    ""
  );

  // Validação dos campos
  if (
    !devedorId ||
    !numeroIncidente ||
    !numeroProcessoPrincipal ||
    !descricao
  ) {
    errorMessage.textContent =
      "Todos os campos obrigatórios devem ser preenchidos.";
    return;
  }
  if (numeroIncidente.length !== 20 || numeroProcessoPrincipal.length !== 20) {
    errorMessage.textContent =
      "Os números de processo (incidente e principal) devem ser válidos.";
    return;
  }

  const data = {
    devedorId,
    numeroIncidente,
    numeroProcessoPrincipal,
    descricao,
    status,
  };

  let promise;
  if (incidenteId) {
    // Editando um incidente existente
    data.atualizadoEm = firebase.firestore.FieldValue.serverTimestamp();
    promise = db
      .collection("incidentesProcessuais")
      .doc(incidenteId)
      .update(data);
  } else {
    // Criando um novo incidente
    data.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
    promise = db.collection("incidentesProcessuais").add(data);
  }

  promise
    .then(() => {
      showToast(
        `Incidente ${incidenteId ? "atualizado" : "salvo"} com sucesso!`
      );
      document.body.removeChild(document.querySelector(".modal-overlay"));
      // Atualiza a lista de incidentes se o usuário estiver na página
      if (document.title.includes("Incidentes Processuais")) {
        // A função setupTodosIncidentesListener() ainda será criada.
      }
    })
    .catch((error) => {
      console.error("Erro ao salvar incidente:", error);
      errorMessage.textContent = "Ocorreu um erro ao salvar o incidente.";
    });
}

function renderPenhoraFormModal(
  processoId,
  penhora = null,
  isReadOnly = false
) {
  const isEditing = penhora !== null;
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";

  let formContentHTML = "";
  let formButtonsHTML = "";

  if (isReadOnly) {
    formContentHTML = `
            <div class="form-group">
                <label>Descrição Completa do Bem</label>
                <div class="readonly-textarea">${penhora.descricao}</div>
            </div>
        `;
    formButtonsHTML = `<button id="close-penhora-btn" class="btn-primary">Fechar</button>`;
  } else {
    formContentHTML = `
            <div class="form-group">
                <label for="penhora-descricao">Descrição do Bem (Obrigatório)</label>
                <textarea id="penhora-descricao" required rows="5">${
                  isEditing ? penhora.descricao : ""
                }</textarea>
            </div>
            <div class="form-group">
                <label for="penhora-valor">Valor de Avaliação</label>
                <input type="number" id="penhora-valor" placeholder="0.00" step="0.01" value="${
                  isEditing ? penhora.valor : ""
                }">
            </div>
            <div class="form-group">
                <label for="penhora-data">Data da Penhora</label>
                <input type="date" id="penhora-data" value="${
                  isEditing ? penhora.data : ""
                }">
            </div>
            <div id="error-message"></div>
        `;
    formButtonsHTML = `
            <button id="save-penhora-btn" class="btn-primary">Salvar</button>
            <button id="cancel-penhora-btn">Cancelar</button>
        `;
  }

  modalOverlay.innerHTML = `
        <div class="modal-content modal-large">
            <h3>${
              isReadOnly
                ? "Detalhes da Penhora"
                : (isEditing ? "Editar" : "Adicionar") + " Penhora"
            }</h3>
            ${formContentHTML}
            <div class="form-buttons">
                ${formButtonsHTML}
            </div>
        </div>
    `;

  document.body.appendChild(modalOverlay);

  const closeModal = () => document.body.removeChild(modalOverlay);

  if (isReadOnly) {
    document
      .getElementById("close-penhora-btn")
      .addEventListener("click", closeModal);
  } else {
    document
      .getElementById("save-penhora-btn")
      .addEventListener("click", () => {
        handleSavePenhora(processoId, isEditing ? penhora.id : null);
      });
    document
      .getElementById("cancel-penhora-btn")
      .addEventListener("click", closeModal);
  }

  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });
}

function setupPenhorasListener(processoId) {
  if (penhorasListenerUnsubscribe) penhorasListenerUnsubscribe();

  penhorasListenerUnsubscribe = db
    .collection("penhoras")
    .where("processoId", "==", processoId)
    .orderBy("criadoEm", "desc")
    .onSnapshot(
      (snapshot) => {
        const penhoras = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        renderPenhorasList(penhoras, processoId);
      },
      (error) => {
        console.error("Erro ao buscar penhoras: ", error);
        const container = document.getElementById("penhoras-list-container");
        if (container)
          container.innerHTML = `<p class="empty-list-message">Ocorreu um erro ao carregar as penhoras.</p>`;
      }
    );
}

function renderPenhorasList(penhoras, processoId) {
  const container = document.getElementById("penhoras-list-container");
  if (!container) return;

  container.dataset.processoId = processoId;

  if (penhoras.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhuma penhora cadastrada para este processo.</p>`;
    return;
  }

  const truncateText = (text, maxLength) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  let tableHTML = `<table class="data-table"><thead><tr><th>Descrição do Bem</th><th>Valor</th><th>Data</th><th class="detail-actions-cell">Ações</th></tr></thead><tbody>`;
  penhoras.forEach((item) => {
    let dataFormatada = "Não informada";
    if (item.data) {
      const partes = item.data.split("-");
      dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    tableHTML += `
            <tr data-id="${item.id}" 
                data-descricao="${item.descricao}" 
                data-valor="${item.valor || ""}" 
                data-data="${item.data || ""}">
                <td>
                    <a href="#" class="view-penhora-link" data-action="view">
                        ${truncateText(item.descricao, 80)}
                    </a>
                </td>
                <td>${formatCurrency(item.valor || 0)}</td>
                <td>${dataFormatada}</td>
                <td class="detail-actions-cell">
                    <div class="actions-container">
                        <button class="action-icon icon-edit" title="Editar Penhora">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                        </button>
                        <button class="action-icon icon-delete" title="Excluir Penhora">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
  });
  tableHTML += `</tbody></table>`;
  container.innerHTML = tableHTML;

  container
    .querySelector("tbody")
    .addEventListener("click", handlePenhoraAction);
}

function handlePenhoraAction(event) {
  event.preventDefault();
  const target = event.target;

  // Ação de visualizar a descrição completa
  const viewLink = target.closest('[data-action="view"]');
  if (viewLink) {
    const row = viewLink.closest("tr");
    const penhoraData = {
      descricao: row.dataset.descricao,
    };
    renderPenhoraFormModal(null, penhoraData, true); // Passa null para processoId pois não é necessário para visualização
    return;
  }

  // Ações de editar e excluir
  const button = target.closest(".action-icon");
  if (button) {
    const row = button.closest("tr");
    const penhoraId = row.dataset.id;
    const container = document.getElementById("penhoras-list-container");
    const processoId = container.dataset.processoId;
    const penhoraData = {
      id: penhoraId,
      descricao: row.dataset.descricao,
      valor: row.dataset.valor,
      data: row.dataset.data,
    };

    if (button.classList.contains("icon-edit")) {
      renderPenhoraFormModal(processoId, penhoraData, false);
    } else if (button.classList.contains("icon-delete")) {
      handleDeletePenhora(penhoraId);
    }
  }
}

function handleSavePenhora(processoId, penhoraId = null) {
  const descricao = document.getElementById("penhora-descricao").value.trim();
  const valor = document.getElementById("penhora-valor").value;
  const data = document.getElementById("penhora-data").value;
  const errorMessage = document.getElementById("error-message");
  errorMessage.textContent = "";

  if (!descricao) {
    errorMessage.textContent = "O campo Descrição do Bem é obrigatório.";
    return;
  }

  const penhoraData = {
    processoId,
    descricao,
    valor: parseFloat(valor) || 0,
    data: data || null,
  };

  let promise;
  if (penhoraId) {
    penhoraData.atualizadoEm = firebase.firestore.FieldValue.serverTimestamp();
    promise = db.collection("penhoras").doc(penhoraId).update(penhoraData);
  } else {
    penhoraData.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
    promise = db.collection("penhoras").add(penhoraData);
  }

  promise
    .then(() => {
      showToast(`Penhora ${penhoraId ? "atualizada" : "salva"} com sucesso!`);
      document.body.removeChild(document.querySelector(".modal-overlay"));
    })
    .catch((error) => {
      console.error("Erro ao salvar penhora:", error);
      errorMessage.textContent = "Ocorreu um erro ao salvar.";
    });
}

function handleDeletePenhora(penhoraId) {
  if (confirm("Tem certeza que deseja excluir esta penhora?")) {
    db.collection("penhoras")
      .doc(penhoraId)
      .delete()
      .then(() => showToast("Penhora excluída com sucesso."))
      .catch((error) => {
        console.error("Erro ao excluir penhora:", error);
        showToast("Erro ao excluir a penhora.", "error");
      });
  }
}

function renderAudienciaFormModal(processoId, audiencia = null) {
  const isEditing = audiencia !== null;
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";

  let dataHora = "";
  if (isEditing && audiencia.dataHora) {
    dataHora = new Date(audiencia.dataHora.seconds * 1000)
      .toISOString()
      .slice(0, 16);
  }

  modalOverlay.innerHTML = `
        <div class="modal-content">
            <h3>${isEditing ? "Editar" : "Agendar"} Audiência</h3>
            <div class="form-group">
                <label for="audiencia-data-hora">Data e Hora (Obrigatório)</label>
                <input type="datetime-local" id="audiencia-data-hora" value="${dataHora}" required>
            </div>
            <div class="form-group">
                <label for="audiencia-local">Local</label>
                <input type="text" id="audiencia-local" placeholder="Ex: Sala de Audiências da 6ª Vara" value="${
                  isEditing ? audiencia.local : ""
                }">
            </div>
            <div class="form-group">
                <label for="audiencia-obs">Observações</label>
                <textarea id="audiencia-obs" rows="3">${
                  isEditing ? audiencia.observacoes : ""
                }</textarea>
            </div>
            <div id="error-message"></div>
            <div class="form-buttons">
                <button id="save-audiencia-btn" class="btn-primary">Salvar</button>
                <button id="cancel-audiencia-btn">Cancelar</button>
            </div>
        </div>
    `;

  document.body.appendChild(modalOverlay);

  const closeModal = () => document.body.removeChild(modalOverlay);

  document
    .getElementById("save-audiencia-btn")
    .addEventListener("click", () => {
      handleSaveAudiencia(processoId, isEditing ? audiencia.id : null);
    });
  document
    .getElementById("cancel-audiencia-btn")
    .addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });
}

function setupAudienciasListener(processoId) {
  if (audienciasListenerUnsubscribe) audienciasListenerUnsubscribe();

  audienciasListenerUnsubscribe = db
    .collection("audiencias")
    .where("processoId", "==", processoId)
    .orderBy("dataHora", "desc")
    .onSnapshot(
      (snapshot) => {
        const audiencias = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        renderAudienciasList(audiencias, processoId);
      },
      (error) => {
        console.error("Erro ao buscar audiências: ", error);
        const container = document.getElementById("audiencias-list-container");
        if (container)
          container.innerHTML = `<p class="empty-list-message">Ocorreu um erro ao carregar as audiências.</p>`;
      }
    );
}

function renderAudienciasList(audiencias, processoId) {
  const container = document.getElementById("audiencias-list-container");
  if (!container) return;

  container.dataset.processoId = processoId;

  if (audiencias.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhuma audiência agendada para este processo.</p>`;
    return;
  }

  let tableHTML = `<table class="data-table"><thead><tr><th>Data e Hora</th><th>Local</th><th>Observações</th><th class="detail-actions-cell">Ações</th></tr></thead><tbody>`;
  audiencias.forEach((item) => {
    const data = new Date(item.dataHora.seconds * 1000);
    const dataFormatada = data.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    tableHTML += `
            <tr data-id="${item.id}">
                <td>${dataFormatada}</td>
                <td>${item.local || "Não informado"}</td>
                <td style="white-space: pre-wrap;">${
                  item.observacoes || ""
                }</td>
                <td class="detail-actions-cell">
                    <div class="actions-container">
                        <button class="action-icon icon-edit" title="Editar Audiência">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                        </button>
                        <button class="action-icon icon-delete" title="Excluir Audiência">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
  });
  tableHTML += `</tbody></table>`;
  container.innerHTML = tableHTML;

  container
    .querySelector("tbody")
    .addEventListener("click", (event) =>
      handleAudienciaAction(event, audiencias)
    );
}

function handleAudienciaAction(event, audiencias) {
  const button = event.target.closest(".action-icon");
  if (!button) return;

  const row = button.closest("tr");
  const audienciaId = row.dataset.id;
  const container = document.getElementById("audiencias-list-container");
  const processoId = container.dataset.processoId;

  const audienciaData = audiencias.find((a) => a.id === audienciaId);

  if (button.classList.contains("icon-edit")) {
    renderAudienciaFormModal(processoId, audienciaData);
  } else if (button.classList.contains("icon-delete")) {
    handleDeleteAudiencia(audienciaId);
  }
}

function handleSaveAudiencia(processoId, audienciaId = null) {
  const dataHoraInput = document.getElementById("audiencia-data-hora").value;
  const local = document.getElementById("audiencia-local").value.trim();
  const observacoes = document.getElementById("audiencia-obs").value.trim();
  const errorMessage = document.getElementById("error-message");
  errorMessage.textContent = "";

  if (!dataHoraInput) {
    errorMessage.textContent = "O campo Data e Hora é obrigatório.";
    return;
  }

  const dataDaAudiencia = new Date(dataHoraInput);

  if (isNaN(dataDaAudiencia.getTime())) {
    errorMessage.textContent =
      "A data ou hora inserida é inválida. Por favor, verifique.";
    return;
  }

  const ano = dataDaAudiencia.getFullYear();
  if (ano < 1900 || ano > 2100) {
    errorMessage.textContent =
      "Por favor, insira um ano válido (entre 1900 e 2100).";
    return;
  }

  const processo = processosCache.find((p) => p.id === processoId);
  if (!processo) {
    errorMessage.textContent = "Erro: Processo associado não encontrado.";
    return;
  }
  const devedor = devedoresCache.find((d) => d.id === processo.devedorId);

  const audienciaData = {
    processoId,
    dataHora: dataDaAudiencia,
    local,
    observacoes,
    numeroProcesso: processo.numeroProcesso,
    razaoSocialDevedor: devedor ? devedor.razaoSocial : "Não encontrado",
    devedorId: devedor ? devedor.id : null,
  };

  let promise;
  if (audienciaId) {
    audienciaData.atualizadoEm =
      firebase.firestore.FieldValue.serverTimestamp();
    promise = db
      .collection("audiencias")
      .doc(audienciaId)
      .update(audienciaData);
  } else {
    audienciaData.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
    promise = db.collection("audiencias").add(audienciaData);
  }

  promise
    .then(() => {
      showToast(
        `Audiência ${audienciaId ? "atualizada" : "agendada"} com sucesso!`
      );
      document.body.removeChild(document.querySelector(".modal-overlay"));
    })
    .catch((error) => {
      console.error("Erro ao salvar audiência:", error);
      errorMessage.textContent = "Ocorreu um erro ao salvar.";
    });
}

function handleDeleteAudiencia(audienciaId) {
  if (confirm("Tem certeza que deseja cancelar esta audiência?")) {
    db.collection("audiencias")
      .doc(audienciaId)
      .delete()
      .then(() => showToast("Audiência cancelada com sucesso."))
      .catch((error) => {
        console.error("Erro ao excluir audiência:", error);
        showToast("Erro ao cancelar a audiência.", "error");
      });
  }
}

// Localize e substitua a função handleIncidenteAction inteira
function handleIncidenteAction(event) {
  const target = event.target.closest("[data-action], .action-icon"); // Procura por links de ação ou botões de ícone
  if (!target) return;

  event.preventDefault();

  const row = target.closest("tr");
  if (!row) return; // Segurança extra

  const incidenteId = row.dataset.id;
  const action =
    target.dataset.action ||
    (target.classList.contains("icon-edit") ? "edit" : "delete");

  if (action === "view-details") {
    const descricao = row.dataset.descricao;
    renderReadOnlyTextModal("Descrição do Incidente", descricao);
  } else if (action === "edit") {
    // A busca no banco de dados é a forma mais segura de obter o objeto completo
    db.collection("incidentesProcessuais")
      .doc(incidenteId)
      .get()
      .then((doc) => {
        if (doc.exists) {
          renderIncidenteFormModal({ id: doc.id, ...doc.data() });
        } else {
          showToast(
            "Não foi possível encontrar os dados do incidente para edição.",
            "error"
          );
        }
      })
      .catch((err) => {
        console.error("Erro ao buscar incidente para edição:", err);
        showToast("Erro ao carregar dados para edição.", "error");
      });
  } else if (action === "delete") {
    handleDeleteIncidente(incidenteId);
  }
}

function setupIncidentesDoProcessoListener(numeroProcessoPrincipal) {
  if (diligenciasListenerUnsubscribe) {
    diligenciasListenerUnsubscribe();
    diligenciasListenerUnsubscribe = null;
  }

  diligenciasListenerUnsubscribe = db
    .collection("incidentesProcessuais")
    .where("numeroProcessoPrincipal", "==", numeroProcessoPrincipal)
    .onSnapshot(
      (snapshot) => {
        const incidentes = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        renderIncidentesDoProcessoList(incidentes);
      },
      (error) => {
        console.error("Erro ao buscar incidentes do processo: ", error);
        const container = document.getElementById("incidentes-list-container");
        if (container)
          container.innerHTML = `<p class="empty-list-message">Ocorreu um erro ao carregar os incidentes.</p>`;
      }
    );
}

function renderIncidentesDoProcessoList(incidentes) {
  const container = document.getElementById("incidentes-list-container");
  if (!container) return;

  if (incidentes.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhum incidente vinculado a este processo.</p>`;
    return;
  }

  let tableHTML = `<table class="data-table"><thead><tr><th>Nº do Incidente</th><th>Descrição</th><th>Status</th><th class="detail-actions-cell">Ações</th></tr></thead><tbody>`;

  incidentes.forEach((item) => {
    const descricaoResumida =
      item.descricao.length > 100
        ? item.descricao.substring(0, 100) + "..."
        : item.descricao;

    tableHTML += `
            <tr data-id="${item.id}" data-descricao="${item.descricao}">
                <td><a href="#" class="view-processo-link" data-action="view-details">${formatProcessoForDisplay(
                  item.numeroIncidente
                )}</a></td>
                <td title="${item.descricao}">${descricaoResumida.replace(
      /\n/g,
      "<br>"
    )}</td>
                <td><span class="status-badge status-${item.status
                  .toLowerCase()
                  .replace(" ", "-")}">${item.status}</span></td>
                <td class="detail-actions-cell">
                    <div class="actions-container">
                        <button class="action-icon icon-edit" title="Editar Incidente" data-id="${
                          item.id
                        }"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                        <button class="action-icon icon-delete" title="Excluir Incidente" data-id="${
                          item.id
                        }"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
                    </div>
                </td>
            </tr>`;
  });

  tableHTML += `</tbody></table>`;
  container.innerHTML = tableHTML;

  const table = container.querySelector(".data-table");
  if (table) {
    table.addEventListener("click", handleIncidenteAction);
  }
}

function handleDeleteIncidente(incidenteId) {
  if (
    confirm(
      "Tem certeza que deseja excluir este incidente processual? Esta ação não pode ser desfeita."
    )
  ) {
    db.collection("incidentesProcessuais")
      .doc(incidenteId)
      .delete()
      .then(() => {
        showToast("Incidente excluído com sucesso.");
      })
      .catch((error) => {
        console.error("Erro ao excluir incidente:", error);
        showToast("Ocorreu um erro ao excluir o incidente.", "error");
      });
  }
}

// CÓDIGO PARA SUBSTITUIR
function setupDashboardWidgets() {
  const hoje = new Date();

  db.collection("diligenciasMensais")
    .where("userId", "==", auth.currentUser.uid)
    .get()
    .then((snapshot) => {
      const diligencias = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      renderProximasDiligenciasWidget(diligencias);
    })
    .catch((error) => {
      console.error("Erro ao buscar tarefas para o dashboard:", error);
      const container = document.getElementById("diligencias-widget-container");
      if (container)
        container.innerHTML = `<div class="widget-card"><h3>Próximas Tarefas</h3><p class="empty-list-message">Ocorreu um erro ao carregar.</p></div>`;
    });

  db.collection("audiencias")
    .where("dataHora", ">=", hoje)
    .orderBy("dataHora", "asc")
    .limit(10)
    .get()
    .then((snapshot) => {
      const audienciasFuturas = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      renderProximasAudienciasWidget(audienciasFuturas);
    })
    .catch((error) => {
      console.error("Erro ao buscar audiências para o dashboard:", error);
      const container = document.getElementById("audiencias-widget-container");
      if (container)
        container.innerHTML = `<div class="widget-card"><h3>Próximas Audiências</h3><p class="empty-list-message">Ocorreu um erro ao carregar.</p></div>`;
    });

  renderAnalisePendenteWidget(devedoresCache);
}

// CÓDIGO PARA SUBSTITUIR
// Substitua esta função inteira
function renderProximasDiligenciasWidget(diligencias) {
  const container = document.getElementById("diligencias-widget-container");
  if (!container) return;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const cincoDiasFrente = new Date(hoje);
  cincoDiasFrente.setDate(hoje.getDate() + 5);

  const anoMesAtual = `${hoje.getFullYear()}-${String(
    hoje.getMonth() + 1
  ).padStart(2, "0")}`;

  // FILTRO ATUALIZADO COM A MESMA LÓGICA DA PÁGINA DE TAREFAS
  const diligenciasParaExibir = diligencias.filter((item) => {
    if (!item.dataAlvo) return false;

    // REGRA DE INÍCIO: A tarefa deve ter sido criada no mês atual ou antes
    const inicioDaVigencia = item.criadoEm
      ? new Date(
          item.criadoEm.toDate().getFullYear(),
          item.criadoEm.toDate().getMonth(),
          1
        )
      : new Date(1970, 0, 1);
    if (new Date(hoje.getFullYear(), hoje.getMonth(), 1) < inicioDaVigencia) {
      return false;
    }

    // REGRA DE TÉRMINO: A tarefa não pode ter terminado antes do mês atual
    if (item.recorrenciaTerminaEm) {
      const dataTermino = item.recorrenciaTerminaEm.toDate();
      if (new Date(hoje.getFullYear(), hoje.getMonth(), 1) > dataTermino) {
        return false;
      }
    }

    // REGRA DE CUMPRIMENTO: Não mostra tarefas já cumpridas este mês
    if (item.isRecorrente) {
      if (
        item.historicoCumprimentos &&
        item.historicoCumprimentos[anoMesAtual]
      ) {
        return false;
      }
    } else {
      if (
        item.historicoCumprimentos &&
        Object.keys(item.historicoCumprimentos).length > 0
      ) {
        return false;
      }
    }

    // REGRA DE DATA ALVO: Mostra tarefas que vencem nos próximos 5 dias ou que estão atrasadas
    const dataAlvoOriginal = new Date(item.dataAlvo.seconds * 1000);
    let dataRelevante = item.isRecorrente
      ? new Date(
          hoje.getFullYear(),
          hoje.getMonth(),
          dataAlvoOriginal.getUTCDate()
        )
      : dataAlvoOriginal;
    dataRelevante.setHours(0, 0, 0, 0);

    return dataRelevante <= cincoDiasFrente;
  });

  diligenciasParaExibir.sort((a, b) => {
    const dataA = a.isRecorrente
      ? new Date(
          hoje.getFullYear(),
          hoje.getMonth(),
          new Date(a.dataAlvo.seconds * 1000).getUTCDate()
        )
      : new Date(a.dataAlvo.seconds * 1000);
    const dataB = b.isRecorrente
      ? new Date(
          hoje.getFullYear(),
          hoje.getMonth(),
          new Date(b.dataAlvo.seconds * 1000).getUTCDate()
        )
      : new Date(b.dataAlvo.seconds * 1000);
    return dataA - dataB;
  });

  let contentHTML = "";
  if (diligenciasParaExibir.length === 0) {
    contentHTML =
      '<p class="empty-list-message">Nenhuma tarefa próxima ou em atraso.</p>';
  } else {
    diligenciasParaExibir.forEach((item) => {
      const dataAlvo = new Date(item.dataAlvo.seconds * 1000);
      const dataRelevante = item.isRecorrente
        ? new Date(hoje.getFullYear(), hoje.getMonth(), dataAlvo.getUTCDate())
        : dataAlvo;
      dataRelevante.setHours(0, 0, 0, 0);

      const isAtrasada = dataRelevante < hoje;
      const itemStyle = isAtrasada ? 'style="background-color: #ffebee;"' : "";
      const vencimentoLabel = `Vencimento: ${dataRelevante.toLocaleDateString(
        "pt-BR",
        { timeZone: "UTC" }
      )}`;

      contentHTML += `<div class="analise-item" ${itemStyle} data-id="${
        item.id
      }"><div class="analise-item-devedor">${
        isAtrasada
          ? '<span class="status-dot status-expired"></span>'
          : '<span class="status-dot status-warning"></span>'
      } ${item.titulo} ${
        item.isRecorrente ? "(Recorrente)" : ""
      }</div><div class="analise-item-detalhes"><strong>${vencimentoLabel}</strong></div></div>`;
    });
  }

  container.innerHTML = `<div class="widget-card"><h3>Próximas Tarefas</h3>${contentHTML}</div>`;

  container
    .querySelector(".widget-card")
    ?.addEventListener("click", (event) => {
      const item = event.target.closest(".analise-item");
      if (item) navigateTo("diligencias");
    });
}

function renderProximasAudienciasWidget(audiencias) {
  const container = document.getElementById("audiencias-widget-container");
  if (!container) return;

  let contentHTML = "";
  if (audiencias.length === 0) {
    contentHTML =
      '<p class="empty-list-message">Nenhuma audiência futura agendada.</p>';
  } else {
    const hoje = new Date();
    const umaSemana = new Date();
    umaSemana.setDate(hoje.getDate() + 8);

    audiencias.forEach((item) => {
      const data = new Date(item.dataHora.seconds * 1000);
      const dataFormatada = data.toLocaleString("pt-BR", {
        dateStyle: "full",
        timeStyle: "short",
      });

      const isDestaque = data < umaSemana;

      contentHTML += `
            <div class="audiencia-item ${isDestaque ? "destaque" : ""}">
                <div class="audiencia-item-processo">
                    <a href="#" class="view-processo-link" data-action="view-processo" data-id="${
                      item.processoId
                    }">
                        ${formatProcessoForDisplay(item.numeroProcesso)}
                    </a>
                </div>
                <div class="audiencia-item-devedor">${
                  item.razaoSocialDevedor
                }</div>
                <div class="audiencia-item-detalhes">
                    <strong>Data:</strong> ${dataFormatada}<br>
                    <strong>Local:</strong> ${item.local || "A definir"}
                </div>
            </div>
        `;
    });
  }

  container.innerHTML = `
        <div class="widget-card">
            <h3>Próximas Audiências</h3>
            ${contentHTML}
        </div>
    `;

  container
    .querySelector(".widget-card")
    ?.addEventListener("click", (event) => {
      const link = event.target.closest('[data-action="view-processo"]');
      if (link) {
        event.preventDefault();
        navigateTo("processoDetail", { id: link.dataset.id });
      }
    });
}

// CÓDIGO PARA SUBSTITUIR
function renderAnalisePendenteWidget(devedores) {
  const container = document.getElementById("analises-widget-container");
  if (!container) return;

  // Filtra devedores que precisam de atenção
  const devedoresParaAnalise = devedores
    .map((devedor) => {
      return {
        ...devedor,
        analise: getAnaliseStatus(devedor),
      };
    })
    .filter(
      (d) =>
        d.analise.status === "status-expired" ||
        d.analise.status === "status-warning"
    );

  devedoresParaAnalise.sort((a, b) => {
    if (
      a.analise.status === "status-expired" &&
      b.analise.status !== "status-expired"
    )
      return -1;
    if (
      a.analise.status !== "status-expired" &&
      b.analise.status === "status-expired"
    )
      return 1;
    return 0;
  });

  let contentHTML = "";
  if (devedoresParaAnalise.length === 0) {
    contentHTML =
      '<p class="empty-list-message">Nenhuma análise pendente. Bom trabalho!</p>';
  } else {
    devedoresParaAnalise.forEach((item) => {
      // A div 'analise-item-detalhes' foi removida para limpar a interface.
      // A informação de prazo (ex: 'Vencido há 5 dias') já está no title da lista principal de devedores.
      contentHTML += `
                <div class="analise-item" data-id="${item.id}" title="Ir para a lista de Grandes Devedores">
                    <div class="analise-item-devedor">
                        <span class="status-dot ${item.analise.status}" style="margin-right: 10px;"></span>
                        ${item.razaoSocial}
                    </div>
                </div>
            `;
    });
  }

  const widgetHTML = `
        <div class="widget-card">
            <h3>Análises Pendentes</h3>
            ${contentHTML}
        </div>
    `;
  container.innerHTML = widgetHTML;

  container
    .querySelector(".widget-card")
    ?.addEventListener("click", (event) => {
      const item = event.target.closest(".analise-item");
      if (item) {
        navigateTo("grandesDevedores");
      }
    });
}

function handleDevedorAction(event) {
  const target = event.target;
  const actionTarget = target.closest("[data-action]");

  if (actionTarget) {
    const action = actionTarget.dataset.action;
    const devedorId = actionTarget.dataset.id;

    if (action === "registrar-analise") {
      event.stopPropagation();
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

function handleEditDevedor(devedorId) {
  db.collection("grandes_devedores")
    .doc(devedorId)
    .get()
    .then((doc) => {
      if (doc.exists) renderDevedorForm({ id: doc.id, ...doc.data() });
    });
}

function handleDeleteDevedor(devedorId) {
  if (confirm("Tem certeza que deseja excluir este Grande Devedor?")) {
    db.collection("grandes_devedores")
      .doc(devedorId)
      .delete()
      .then(() => showToast("Devedor excluído com sucesso."))
      .catch(() => showToast("Ocorreu um erro ao excluir.", "error"));
  }
}

function handleProcessoAction(event) {
  event.preventDefault();
  const target = event.target;

  // Ação 1: Clicar no link do número do processo para ver detalhes
  const link = target.closest(".view-processo-link");
  if (link) {
    const processoId = link.closest("tr").dataset.id;
    navigateTo("processoDetail", { id: processoId });
    return;
  }

  // Ação 2: Clicar nos ícones de editar ou excluir
  const button = target.closest(".action-icon");
  if (button) {
    event.stopPropagation();
    const processoId = button.closest("tr").dataset.id;
    if (button.classList.contains("icon-delete")) {
      handleDeleteProcesso(processoId);
    } else if (button.classList.contains("icon-edit")) {
      handleEditProcesso(processoId);
    }
    return;
  }

  // Ação 3: Clicar na linha de um processo piloto para expandir/recolher apensos
  const row = target.closest("tr.piloto-row");
  if (row) {
    row.classList.toggle("expanded");
    document
      .querySelectorAll(`.apenso-row[data-piloto-ref="${row.dataset.id}"]`)
      .forEach((apensoRow) => {
        apensoRow.classList.toggle("visible");
      });
  }
}

async function handleEditProcesso(processoId) {
  try {
    const doc = await db.collection("processos").doc(processoId).get();
    if (doc.exists) {
      const processo = { id: doc.id, ...doc.data() };
      renderProcessoForm(processo.devedorId, processo);
    } else {
      showToast("Processo não encontrado no banco de dados.", "error");
    }
  } catch (error) {
    console.error("Erro ao buscar processo para edição:", error);
    showToast("Erro ao carregar dados do processo.", "error");
  }
}

async function handleDeleteProcesso(processoId) {
  const processoRef = db.collection("processos").doc(processoId);
  let processo;
  try {
    const doc = await processoRef.get();
    if (!doc.exists) {
      showToast("Erro: Processo não encontrado no banco de dados.", "error");
      return;
    }
    processo = { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error("Erro ao buscar processo para exclusão:", error);
    showToast("Erro de comunicação com o banco de dados.", "error");
    return;
  }

  let confirmMessage = `Tem certeza que deseja excluir o processo ${formatProcessoForDisplay(
    processo.numeroProcesso
  )}?`;

  const isPiloto = processo.tipoProcesso === "piloto";
  let apensosParaExcluir = [];

  if (isPiloto) {
    const apensosSnapshot = await db
      .collection("processos")
      .where("processoPilotoId", "==", processo.id)
      .get();
    apensosParaExcluir = apensosSnapshot.docs;

    if (apensosParaExcluir.length > 0) {
      confirmMessage = `ATENÇÃO: Você está excluindo um Processo Piloto com ${
        apensosParaExcluir.length
      } apenso(s).\n\nAo confirmar, TODOS os apensos serão excluídos permanentemente.\n\nDeseja continuar com a exclusão de todos os ${
        apensosParaExcluir.length + 1
      } processos?`;
    }
  }

  if (!confirm(confirmMessage)) {
    return;
  }

  try {
    const batch = db.batch();

    if (isPiloto && apensosParaExcluir.length > 0) {
      apensosParaExcluir.forEach((apensoDoc) => {
        batch.delete(apensoDoc.ref);
      });
    }

    batch.delete(processoRef);

    await batch.commit();
    showToast("Processo(s) excluído(s) com sucesso!");

    renderDevedorDetailPage(processo.devedorId);
  } catch (error) {
    console.error("Erro ao excluir processo(s):", error);
    showToast("Ocorreu um erro ao excluir o(s) processo(s).", "error");
  }
}

async function handlePromoteToPiloto(processoId) {
  const processoAlvo = processosCache.find((p) => p.id === processoId);
  if (!processoAlvo) {
    showToast("Processo alvo não encontrado no cache.", "error");
    return;
  }

  const confirmMessage = `Tem certeza que deseja promover o processo ${formatProcessoForDisplay(
    processoAlvo.numeroProcesso
  )} a novo Piloto? \n\nEsta ação reorganizará o grupo de processos ao qual ele pertence.`;

  if (!confirm(confirmMessage)) {
    return;
  }

  const batch = db.batch();

  try {
    const processoAlvoRef = db.collection("processos").doc(processoAlvo.id);
    batch.update(processoAlvoRef, {
      tipoProcesso: "piloto",
      processoPilotoId: null,
      status: "Ativo", // <-- LINHA ADICIONADA
      motivoSuspensaoId: null, // <-- BÔNUS: Limpa o motivo da suspensão, se houver
    });

    if (
      processoAlvo.tipoProcesso === "apenso" &&
      processoAlvo.processoPilotoId
    ) {
      const antigoPilotoId = processoAlvo.processoPilotoId;

      const antigoPilotoRef = db.collection("processos").doc(antigoPilotoId);
      batch.update(antigoPilotoRef, {
        tipoProcesso: "apenso",
        processoPilotoId: processoAlvo.id,
      });

      const irmaosApensos = processosCache.filter(
        (p) => p.processoPilotoId === antigoPilotoId && p.id !== processoAlvo.id
      );

      irmaosApensos.forEach((irmao) => {
        const irmaoRef = db.collection("processos").doc(irmao.id);
        batch.update(irmaoRef, { processoPilotoId: processoAlvo.id });
      });
    }

    await batch.commit();
    showToast("Processo promovido a Piloto com sucesso!", "success");

    renderDevedorDetailPage(processoAlvo.devedorId);
  } catch (error) {
    console.error("Erro ao promover processo a piloto: ", error);
    showToast(
      "Ocorreu um erro crítico durante a promoção. Os dados não foram alterados.",
      "error"
    );
  }
}

function handleUnattachProcesso(processoId) {
  const processo = processosCache.find((p) => p.id === processoId);
  if (!processo) {
    showToast("Processo não encontrado.", "error");
    return;
  }

  if (
    !confirm(
      `Tem certeza que deseja desapensar o processo ${formatProcessoForDisplay(
        processo.numeroProcesso
      )}? \n\nEle se tornará um processo Autônomo.`
    )
  ) {
    return;
  }

  db.collection("processos")
    .doc(processoId)
    .update({
      tipoProcesso: "autônomo",
      processoPilotoId: firebase.firestore.FieldValue.delete(),
    })
    .then(() => {
      showToast("Processo desapensado com sucesso!", "success");
      renderDevedorDetailPage(processo.devedorId);
    })
    .catch((error) => {
      console.error("Erro ao desapensar processo: ", error);
      showToast("Ocorreu um erro ao desapensar o processo.", "error");
    });
}

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

      // 1. Busca por Devedores
      const devedoresFound = devedoresCache.filter(
        (devedor) =>
          devedor.razaoSocial.toLowerCase().includes(searchTermLower) ||
          (devedor.nomeFantasia &&
            devedor.nomeFantasia.toLowerCase().includes(searchTermLower))
      );

      if (searchTermNumerico.length > 0) {
        // 2. Busca por Número de Processo
        promises.push(
          db
            .collection("processos")
            .where("numeroProcesso", ">=", searchTermNumerico)
            .where("numeroProcesso", "<=", searchTermNumerico + "\uf8ff")
            .get()
        );

        // 3. Busca por CDA
        promises.push(
          db
            .collection("processos")
            .where("cdasNormalizadas", "array-contains", searchTermNumerico)
            .get()
        );

        // 4. Busca por Número do Incidente
        promises.push(
          db
            .collection("incidentesProcessuais")
            .where("numeroIncidente", ">=", searchTermNumerico)
            .where("numeroIncidente", "<=", searchTermNumerico + "\uf8ff")
            .get()
        );
      }

      const results = await Promise.all(promises);
      let processosFound = [];
      let cdasFound = [];
      let incidentesFound = [];

      if (results.length > 0) {
        // Processa resultados da busca por número de processo
        results[0].forEach((doc) => {
          processosFound.push({ ...doc.data(), id: doc.id });
        });

        // Processa resultados da busca por CDA
        results[1].forEach((doc) => {
          if (!processosFound.some((p) => p.id === doc.id)) {
            cdasFound.push({ ...doc.data(), id: doc.id });
          }
        });

        // Processa resultados da busca por Incidente
        if (results[2]) {
          results[2].forEach((doc) => {
            incidentesFound.push({ ...doc.data(), id: doc.id });
          });
        }
      }

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

  // Unifica a renderização para evitar duplicatas visuais
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
      const devedor = devedoresCache.find((d) => d.id === processo.devedorId);
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
          try {
            const query = db
              .collection("processos")
              .where("numeroProcesso", "==", processo.numeroProcessoPrincipal)
              .limit(1);
            const snapshot = await query.get();
            if (!snapshot.empty) {
              const processoPrincipalDoc = snapshot.docs[0];
              navigateTo("processoDetail", { id: processoPrincipalDoc.id });
            } else {
              showToast(
                "Processo principal deste incidente não encontrado no SASIF.",
                "error"
              );
            }
          } catch (err) {
            console.error("Erro ao buscar processo principal:", err);
            showToast("Erro ao buscar processo principal.", "error");
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

function renderValorUpdateModal(processoId) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `
        <div class="modal-content">
            <h3>Atualizar Valor da Dívida</h3>
            <div class="form-group">
                <label for="novo-valor">Novo Valor (R$)</label>
                <input type="number" id="novo-valor" placeholder="0.00" step="0.01" required>
            </div>
            <div class="form-group">
                <label for="data-calculo">Data do Cálculo (Obrigatório)</label>
                <input type="date" id="data-calculo" required>
            </div>
            <div id="error-message"></div>
            <div class="form-buttons">
                <button id="save-new-valor-btn" class="btn-primary">Salvar Atualização</button>
                <button id="cancel-valor-btn">Cancelar</button>
            </div>
        </div>
    `;

  document.body.appendChild(modalOverlay);

  const closeModal = () => document.body.removeChild(modalOverlay);
  document
    .getElementById("save-new-valor-btn")
    .addEventListener("click", () => handleSaveValorUpdate(processoId));
  document
    .getElementById("cancel-valor-btn")
    .addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
}

async function handleSaveValorUpdate(processoId) {
  const novoValorInput = document.getElementById("novo-valor").value;
  const dataCalculoInput = document.getElementById("data-calculo").value;
  const errorMessage = document.getElementById("error-message");
  errorMessage.textContent = "";

  if (!novoValorInput || !dataCalculoInput) {
    errorMessage.textContent =
      "Ambos os campos, Novo Valor e Data do Cálculo, são obrigatórios.";
    return;
  }
  const novoValor = parseFloat(novoValorInput);
  const dataCalculo = new Date(dataCalculoInput + "T00:00:00");

  const batch = db.batch();
  const processoRef = db.collection("processos").doc(processoId);
  const historicoRef = processoRef.collection("historicoValores").doc();

  const dataParaSalvar = firebase.firestore.Timestamp.fromDate(dataCalculo);

  batch.update(processoRef, {
    "valorAtual.valor": novoValor,
    "valorAtual.data": dataParaSalvar,
  });

  batch.set(historicoRef, {
    valor: novoValor,
    data: dataParaSalvar,
    tipo: "Atualização Manual",
  });

  try {
    await batch.commit();
    showToast("Valor da dívida atualizado com sucesso!");
    document.body.removeChild(document.querySelector(".modal-overlay"));

    renderProcessoDetailPage(processoId);
  } catch (error) {
    console.error("Erro ao atualizar valor: ", error);
    errorMessage.textContent = "Ocorreu um erro ao salvar a atualização.";
  }
}

async function renderValorHistoryModal(processoId) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `
        <div class="modal-content modal-large">
            <h3>Histórico de Valores da Dívida</h3>
            <div id="history-list-container"><p>Carregando histórico...</p></div>
            <div class="form-buttons" style="justify-content: flex-end; margin-top: 20px;">
                <button id="close-history-modal" class="btn-secondary">Fechar</button>
            </div>
        </div>
    `;
  document.body.appendChild(modalOverlay);

  const closeModal = () => document.body.removeChild(modalOverlay);
  document
    .getElementById("close-history-modal")
    .addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  try {
    const snapshot = await db
      .collection("processos")
      .doc(processoId)
      .collection("historicoValores")
      .orderBy("data", "desc")
      .get();
    const historyContainer = document.getElementById("history-list-container");

    if (snapshot.empty) {
      historyContainer.innerHTML = `<p class="empty-list-message">Nenhum histórico de valores encontrado.</p>`;
      return;
    }

    let tableHTML = `<table class="data-table"><thead><tr><th>Data</th><th>Valor</th><th>Tipo</th></tr></thead><tbody>`;
    snapshot.docs.forEach((doc) => {
      const item = doc.data();
      const data = item.data
        ? new Date(item.data.seconds * 1000).toLocaleDateString("pt-BR", {
            timeZone: "UTC",
          })
        : "N/A";
      tableHTML += `
                <tr>
                    <td>${data}</td>
                    <td>${formatCurrency(item.valor)}</td>
                    <td>${item.tipo}</td>
                </tr>
            `;
    });
    tableHTML += `</tbody></table>`;
    historyContainer.innerHTML = tableHTML;
  } catch (error) {
    console.error("Erro ao buscar histórico de valores: ", error);
    document.getElementById(
      "history-list-container"
    ).innerHTML = `<p class="empty-list-message">Ocorreu um erro ao carregar o histórico.</p>`;
  }
}

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

function renderDevedorForm(devedor = null) {
  const isEditing = devedor !== null;
  const formTitle = isEditing
    ? "Editar Grande Devedor"
    : "Cadastrar Novo Grande Devedor";
  navigateTo(null);
  pageTitle.textContent = formTitle;
  document.title = `SASIF | ${formTitle}`;
  const razaoSocial = isEditing ? devedor.razaoSocial : "";
  const cnpj = isEditing ? formatCNPJForDisplay(devedor.cnpj) : "";
  const nomeFantasia = isEditing ? devedor.nomeFantasia : "";
  const nivelPrioridade = isEditing ? devedor.nivelPrioridade : "1";
  const observacoes = isEditing ? devedor.observacoes : "";
  contentArea.innerHTML = `<div class="form-container" data-id="${
    isEditing ? devedor.id : ""
  }"><div class="form-group"><label for="razao-social">Razão Social (Obrigatório)</label><input type="text" id="razao-social" value="${razaoSocial}" required></div><div class="form-group"><label for="cnpj">CNPJ (Obrigatório)</label><input type="text" id="cnpj" value="${cnpj}" required oninput="maskCNPJ(this)"></div><div class="form-group"><label for="nome-fantasia">Nome Fantasia</label><input type="text" id="nome-fantasia" value="${nomeFantasia}"></div><div class="form-group"><label for="nivel-prioridade">Nível de Prioridade</label><select id="nivel-prioridade"><option value="1">Nível 1 (30 dias)</option><option value="2">Nível 2 (45 dias)</option><option value="3">Nível 3 (60 dias)</option></select></div><div class="form-group"><label for="observacoes">Observações</label><textarea id="observacoes">${observacoes}</textarea></div><div id="error-message"></div><div class="form-buttons"><button id="save-devedor-btn" class="btn-primary">Salvar</button><button id="cancel-btn">Cancelar</button></div></div>`;
  document.getElementById("nivel-prioridade").value = nivelPrioridade;
  document.getElementById("save-devedor-btn").addEventListener("click", () => {
    isEditing ? handleUpdateDevedor(devedor.id) : handleSaveDevedor();
  });
  document
    .getElementById("cancel-btn")
    .addEventListener("click", () => navigateTo("grandesDevedores"));
}
function getDevedorDataFromForm() {
  const razaoSocial = document.getElementById("razao-social").value;
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
    nomeFantasia: document.getElementById("nome-fantasia").value,
    nivelPrioridade: parseInt(
      document.getElementById("nivel-prioridade").value
    ),
    observacoes: document.getElementById("observacoes").value,
  };
}
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
function renderExequentesPage() {
  pageTitle.textContent = "Exequentes";
  document.title = "SASIF | Exequentes";
  contentArea.innerHTML = `
        <div class="dashboard-actions">
            <button id="add-exequente-btn" class="btn-primary">Cadastrar Novo Exequente</button>
            <button id="back-to-config-btn" class="btn-secondary" style="margin-left: 16px;">← Voltar para Configurações</button>
        </div>
        <h2>Lista de Exequentes</h2>
        <div id="exequentes-list-container"></div>
    `;
  document
    .getElementById("add-exequente-btn")
    .addEventListener("click", () => renderExequenteForm());
  document
    .getElementById("back-to-config-btn")
    .addEventListener("click", () => navigateTo("configuracoes"));
  renderExequentesList(exequentesCache);
}
function renderExequentesList(exequentes) {
  const container = document.getElementById("exequentes-list-container");
  if (!container) return;

  if (exequentes.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhum exequente cadastrado ainda.</p>`;
    return;
  }

  let tableHTML = `<table class="data-table"><thead><tr><th class="number-cell">#</th><th>Nome</th><th>CNPJ</th><th class="actions-cell">Ações</th></tr></thead><tbody>`;

  exequentes.forEach((exequente, index) => {
    tableHTML += `
            <tr data-id="${exequente.id}">
                <td class="number-cell">${index + 1}</td>
                <td>${exequente.nome}</td>
                <td>${formatCNPJForDisplay(exequente.cnpj)}</td>
                <td class="actions-cell">
                    <button class="action-icon icon-edit" title="Editar Exequente" data-id="${
                      exequente.id
                    }">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    </button>
                    <button class="action-icon icon-delete" title="Excluir Exequente" data-id="${
                      exequente.id
                    }">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                </td>
            </tr>
        `;
  });

  tableHTML += `</tbody></table>`;
  container.innerHTML = tableHTML;
  container
    .querySelector("tbody")
    .addEventListener("click", handleExequenteAction);
}
function renderExequenteForm(exequente = null) {
  const isEditing = exequente !== null;
  const formTitle = isEditing ? "Editar Exequente" : "Cadastrar Novo Exequente";
  navigateTo(null);
  pageTitle.textContent = formTitle;
  document.title = `SASIF | ${formTitle}`;
  const nome = isEditing ? exequente.nome : "";
  const cnpj = isEditing ? formatCNPJForDisplay(exequente.cnpj) : "";
  contentArea.innerHTML = `<div class="form-container"><div class="form-group"><label for="nome">Nome (Obrigatório)</label><input type="text" id="nome" value="${nome}" required></div><div class="form-group"><label for="cnpj">CNPJ</label><input type="text" id="cnpj" value="${cnpj}" oninput="maskCNPJ(this)"></div><div id="error-message"></div><div class="form-buttons"><button id="save-exequente-btn" class="btn-primary">Salvar</button><button id="cancel-btn">Cancelar</button></div></div>`;
  document
    .getElementById("save-exequente-btn")
    .addEventListener("click", () => {
      isEditing ? handleUpdateExequente(exequente.id) : handleSaveExequente();
    });
  document
    .getElementById("cancel-btn")
    .addEventListener("click", () => navigateTo("exequentes"));
}
function handleExequenteAction(event) {
  const button = event.target.closest(".action-icon"); // Procura pelo botão, mesmo que o clique seja no ícone
  if (!button) return;

  const exequenteId = button.dataset.id;
  if (!exequenteId) return;

  if (button.classList.contains("icon-delete")) {
    handleDeleteExequente(exequenteId);
  } else if (button.classList.contains("icon-edit")) {
    // Busca o exequente no cache local para evitar uma nova chamada ao DB
    const exequente = exequentesCache.find((e) => e.id === exequenteId);
    if (exequente) {
      renderExequenteForm(exequente);
    } else {
      // Fallback caso não encontre no cache (pouco provável)
      db.collection("exequentes")
        .doc(exequenteId)
        .get()
        .then((doc) => {
          if (doc.exists) renderExequenteForm({ id: doc.id, ...doc.data() });
        });
    }
  }
}
function handleSaveExequente() {
  const nome = document.getElementById("nome").value;
  const cnpjInput = document.getElementById("cnpj").value;
  if (!nome) {
    document.getElementById("error-message").textContent =
      "O nome do exequente é obrigatório.";
    return;
  }
  const data = {
    nome,
    cnpj: cnpjInput.replace(/\D/g, ""),
    criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
  };
  db.collection("exequentes")
    .add(data)
    .then(() => {
      navigateTo("exequentes");
      setTimeout(() => showToast("Exequente salvo com sucesso!"), 100);
    });
}
function handleUpdateExequente(exequenteId) {
  const nome = document.getElementById("nome").value;
  const cnpjInput = document.getElementById("cnpj").value;
  if (!nome) {
    document.getElementById("error-message").textContent =
      "O nome do exequente é obrigatório.";
    return;
  }
  const data = {
    nome,
    cnpj: cnpjInput.replace(/\D/g, ""),
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
  };
  db.collection("exequentes")
    .doc(exequenteId)
    .update(data)
    .then(() => {
      navigateTo("exequentes");
      setTimeout(() => showToast("Exequente atualizado com sucesso!"), 100);
    });
}
function handleDeleteExequente(exequenteId) {
  if (confirm("Tem certeza que deseja excluir este Exequente?")) {
    db.collection("exequentes")
      .doc(exequenteId)
      .delete()
      .then(() => showToast("Exequente excluído com sucesso."))
      .catch(() => showToast("Ocorreu um erro ao excluir.", "error"));
  }
}
function renderMotivosPage() {
  pageTitle.textContent = "Motivos de Suspensão";
  document.title = "SASIF | Motivos de Suspensão";
  contentArea.innerHTML = `
        <div class="dashboard-actions">
            <button id="add-motivo-btn" class="btn-primary">Cadastrar Novo Motivo</button>
            <button id="back-to-config-btn" class="btn-secondary" style="margin-left: 16px;">← Voltar para Configurações</button>
        </div>
        <h2>Lista de Motivos</h2>
        <div id="motivos-list-container"></div>
    `;
  document
    .getElementById("add-motivo-btn")
    .addEventListener("click", () => renderMotivoForm());
  document
    .getElementById("back-to-config-btn")
    .addEventListener("click", () => navigateTo("configuracoes"));
  renderMotivosList(motivosSuspensaoCache);
}

function renderTodosIncidentesList(incidentes) {
  const container = document.getElementById("todos-incidentes-list-container");
  if (!container) return;
  if (incidentes.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhum incidente processual cadastrado.</p>`;
    return;
  }
  let tableHTML = `<table class="data-table"><thead><tr><th>Nº do Incidente</th><th>Processo Principal</th><th>Devedor</th><th>Status</th><th class="actions-cell">Ações</th></tr></thead><tbody>`;
  incidentes.forEach((item) => {
    const devedor = devedoresCache.find((d) => d.id === item.devedorId);
    tableHTML += `<tr data-id="${item.id}" data-descricao="${
      item.descricao
    }"><td><a href="#" class="view-processo-link" data-action="view-details">${formatProcessoForDisplay(
      item.numeroIncidente
    )}</a></td><td>${formatProcessoForDisplay(
      item.numeroProcessoPrincipal
    )}</td><td>${
      devedor ? devedor.razaoSocial : "Não encontrado"
    }</td><td><span class="status-badge status-${item.status
      .toLowerCase()
      .replace(" ", "-")}">${
      item.status
    }</span></td><td class="actions-cell"><button class="action-icon icon-edit" title="Editar Incidente" data-id="${
      item.id
    }"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button><button class="action-icon icon-delete" title="Excluir Incidente" data-id="${
      item.id
    }"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></td></tr>`;
  });
  tableHTML += `</tbody></table>`;
  container.innerHTML = tableHTML;
  const table = container.querySelector(".data-table");
  if (table) {
    table.addEventListener("click", handleIncidenteAction);
  }
}

function renderMotivosList(motivos) {
  const container = document.getElementById("motivos-list-container");
  if (!container) return;
  if (motivos.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhum motivo de suspensão cadastrado.</p>`;
    return;
  }
  let tableHTML = `<table class="data-table"><thead><tr><th>Descrição do Motivo</th><th class="actions-cell">Ações</th></tr></thead><tbody>`;
  motivos.forEach((motivo) => {
    tableHTML += `
            <tr data-id="${motivo.id}">
                <td>${motivo.descricao}</td>
                <td class="actions-cell">
                    <button class="action-icon icon-edit" title="Editar Motivo" data-id="${motivo.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    </button>
                    <button class="action-icon icon-delete" title="Excluir Motivo" data-id="${motivo.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                </td>
            </tr>`;
  });
  tableHTML += `</tbody></table>`;
  container.innerHTML = tableHTML;
  container
    .querySelector("tbody")
    .addEventListener("click", handleMotivoAction);
}

function renderMotivoForm(motivo = null) {
  const isEditing = motivo !== null;
  const formTitle = isEditing
    ? "Editar Motivo de Suspensão"
    : "Cadastrar Novo Motivo";
  navigateTo(null);
  pageTitle.textContent = formTitle;
  document.title = `SASIF | ${formTitle}`;

  const descricao = isEditing ? motivo.descricao : "";

  contentArea.innerHTML = `
        <div class="form-container">
            <div class="form-group">
                <label for="descricao">Descrição (Obrigatório)</label>
                <input type="text" id="descricao" value="${descricao}" required>
            </div>
            <div id="error-message"></div>
            <div class="form-buttons">
                <button id="save-motivo-btn" class="btn-primary">Salvar</button>
                <button id="cancel-btn">Cancelar</button>
            </div>
        </div>`;

  document.getElementById("save-motivo-btn").addEventListener("click", () => {
    isEditing ? handleUpdateMotivo(motivo.id) : handleSaveMotivo();
  });
  document
    .getElementById("cancel-btn")
    .addEventListener("click", () => navigateTo("motivos"));
}

function handleMotivoAction(event) {
  const button = event.target.closest(".action-icon"); // Procura pelo botão, mesmo que o clique seja no ícone
  if (!button) return;

  const motivoId = button.dataset.id;
  if (!motivoId) return;

  if (button.classList.contains("icon-delete")) {
    handleDeleteMotivo(motivoId);
  } else if (button.classList.contains("icon-edit")) {
    const motivo = motivosSuspensaoCache.find((m) => m.id === motivoId);
    if (motivo) renderMotivoForm(motivo);
  }
}

function handleSaveMotivo() {
  const descricao = document.getElementById("descricao").value;
  if (!descricao) {
    document.getElementById("error-message").textContent =
      "A descrição é obrigatória.";
    return;
  }
  const data = {
    descricao,
    criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
  };
  db.collection("motivos_suspensao")
    .add(data)
    .then(() => {
      navigateTo("motivos");
      setTimeout(() => showToast("Motivo salvo com sucesso!"), 100);
    });
}

function handleUpdateMotivo(motivoId) {
  const descricao = document.getElementById("descricao").value;
  if (!descricao) {
    document.getElementById("error-message").textContent =
      "A descrição é obrigatória.";
    return;
  }
  const data = {
    descricao,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
  };
  db.collection("motivos_suspensao")
    .doc(motivoId)
    .update(data)
    .then(() => {
      navigateTo("motivos");
      setTimeout(() => showToast("Motivo atualizado com sucesso!"), 100);
    });
}

function handleDeleteMotivo(motivoId) {
  if (confirm("Tem certeza que deseja excluir este Motivo?")) {
    db.collection("motivos_suspensao")
      .doc(motivoId)
      .delete()
      .then(() => showToast("Motivo excluído com sucesso."))
      .catch(() => showToast("Ocorreu um erro ao excluir.", "error"));
  }
}

function renderProcessoForm(devedorId, processo = null) {
  const isEditing = processo !== null;
  pageTitle.textContent = isEditing ? "Editar Processo" : "Novo Processo";
  document.title = `SASIF | ${pageTitle.textContent}`;

  const exequenteOptions = exequentesCache
    .map(
      (ex) =>
        `<option value="${ex.id}" ${
          isEditing && processo.exequenteId === ex.id ? "selected" : ""
        }>${ex.nome}</option>`
    )
    .join("");
  const motivosOptions = motivosSuspensaoCache
    .map(
      (m) =>
        `<option value="${m.id}" ${
          isEditing && processo.motivoSuspensaoId === m.id ? "selected" : ""
        }>${m.descricao}</option>`
    )
    .join("");

  contentArea.innerHTML = `
        <div class="form-container">
            <div class="form-group">
                <label for="numero-processo">Número do Processo (Obrigatório)</label>
                <input type="text" id="numero-processo" required oninput="maskProcesso(this)" value="${
                  isEditing
                    ? formatProcessoForDisplay(processo.numeroProcesso)
                    : ""
                }">
            </div>
            <div class="form-group">
                <label for="exequente">Exequente (Obrigatório)</label>
                <select id="exequente"><option value="">Selecione...</option>${exequenteOptions}</select>
            </div>
            <div class="form-group">
    <label for="tipo-processo">Tipo</label>
    <select id="tipo-processo">
        <option value="autônomo">Autônomo</option> <!-- CORREÇÃO AQUI -->
        <option value="piloto">Piloto</option>
        <option value="apenso">Apenso</option>
    </select>
</div>
            <div id="piloto-select-container"></div>
            <hr style="margin: 20px 0;">
            <div class="form-group">
                <label for="status-processo">Status</label>
                <select id="status-processo">
                    <option value="Ativo">Ativo</option>
                    <option value="Suspenso">Suspenso</option>
                    <option value="Baixado">Baixado</option>
                    <option value="Extinto">Extinto</option>
                </select>
            </div>
            <div id="motivo-suspensao-container" class="hidden">
                <div class="form-group">
                    <label for="motivo-suspensao">Motivo da Suspensão</label>
                    <select id="motivo-suspensao"><option value="">Selecione o motivo...</option>${motivosOptions}</select>
                </div>
            </div>
            <hr style="margin: 20px 0;">
            <div class="form-group">
                <label for="valor-divida">Valor da Dívida</label>
                <input type="number" id="valor-divida" placeholder="0.00" step="0.01" value="${
                  isEditing
                    ? processo.valorAtual
                      ? processo.valorAtual.valor
                      : processo.valorDivida || 0
                    : ""
                }">
            </div>
            <div class="form-group">
                <label for="cdas">CDA(s)</label>
                <textarea id="cdas" rows="3">${
                  isEditing ? processo.cdas || "" : ""
                }</textarea>
            </div>
            <div id="error-message"></div>
            <div class="form-buttons">
                <button id="save-processo-btn" class="btn-primary">Salvar</button>
                <button id="cancel-btn">Cancelar</button>
            </div>
        </div>`;

  const tipoProcessoSelect = document.getElementById("tipo-processo");
  const exequenteSelect = document.getElementById("exequente");
  const statusSelect = document.getElementById("status-processo");
  const motivoContainer = document.getElementById("motivo-suspensao-container");
  const pilotoContainer = document.getElementById("piloto-select-container");

  if (isEditing) {
    tipoProcessoSelect.value = processo.tipoProcesso;
    exequenteSelect.value = processo.exequenteId;
    statusSelect.value = processo.status || "Ativo";
    if (processo.motivoSuspensaoId) {
      document.getElementById("motivo-suspensao").value =
        processo.motivoSuspensaoId;
    }
  }

  function toggleMotivoSelect() {
    motivoContainer.classList.toggle(
      "hidden",
      statusSelect.value !== "Suspenso"
    );
  }

  function togglePilotoSelect() {
    const exequenteIdSelecionado = exequenteSelect.value;
    if (tipoProcessoSelect.value === "apenso") {
      const pilotosDisponiveis = processosCache.filter(
        (p) =>
          p.tipoProcesso === "piloto" &&
          p.exequenteId === exequenteIdSelecionado &&
          p.id !== (isEditing ? processo.id : null)
      );

      if (pilotosDisponiveis.length > 0) {
        const pilotoOptionsHTML = pilotosDisponiveis
          .map(
            (p) =>
              `<option value="${p.id}">${formatProcessoForDisplay(
                p.numeroProcesso
              )}</option>`
          )
          .join("");
        pilotoContainer.innerHTML = `<div class="form-group"><label for="processo-piloto">Vincular ao Piloto</label><select id="processo-piloto"><option value="">Selecione...</option>${pilotoOptionsHTML}</select></div>`;
        if (isEditing && processo.processoPilotoId) {
          document.getElementById("processo-piloto").value =
            processo.processoPilotoId;
        }
      } else {
        pilotoContainer.innerHTML = `<p class="empty-list-message" style="margin-top:10px;">Não há processos piloto cadastrados para o exequente selecionado.</p>`;
      }
    } else {
      pilotoContainer.innerHTML = "";
    }
  }

  toggleMotivoSelect();
  togglePilotoSelect();

  statusSelect.addEventListener("change", toggleMotivoSelect);
  tipoProcessoSelect.addEventListener("change", togglePilotoSelect);
  exequenteSelect.addEventListener("change", togglePilotoSelect);

  document
    .getElementById("save-processo-btn")
    .addEventListener("click", () =>
      handleSaveProcesso(devedorId, isEditing ? processo.id : null)
    );
  document
    .getElementById("cancel-btn")
    .addEventListener("click", () => showDevedorPage(devedorId));
}

async function handleSaveProcesso(devedorId, processoId = null) {
  const numeroProcessoInput = document.getElementById("numero-processo").value;
  const exequenteId = document.getElementById("exequente").value;
  const tipoProcesso = document.getElementById("tipo-processo").value;
  const status = document.getElementById("status-processo").value;
  const motivoSuspensaoId = document.getElementById("motivo-suspensao")?.value;
  const valorInputString = document
    .getElementById("valor-divida")
    .value.replace(",", ".");
  const valorInput = parseFloat(valorInputString) || 0;
  const cdasInput = document.getElementById("cdas").value;

  const errorMessage = document.getElementById("error-message");
  errorMessage.textContent = "";

  const numeroProcesso = numeroProcessoInput.replace(/\D/g, "");
  if (!numeroProcesso || numeroProcesso.length !== 20 || !exequenteId) {
    errorMessage.textContent =
      "Número do Processo (válido) e Exequente são obrigatórios.";
    return;
  }

  if (!processoId) {
    try {
      const query = db
        .collection("processos")
        .where("numeroProcesso", "==", numeroProcesso);
      const snapshot = await query.get();
      if (!snapshot.empty) {
        errorMessage.textContent = `ERRO: O processo ${formatProcessoForDisplay(
          numeroProcesso
        )} já está cadastrado no sistema.`;
        return;
      }
    } catch (error) {
      errorMessage.textContent = "Ocorreu um erro ao validar o processo.";
      return;
    }
  }

  // LÓGICA DE NORMALIZAÇÃO DAS CDAs (VERSÃO FINAL)
  const cdasNormalizadas = cdasInput
    .split(/[,;]/) // Divide a string APENAS por vírgula ou ponto e vírgula
    .map((cda) => cda.replace(/\D/g, "")) // Remove tudo que não for dígito de cada CDA
    .filter((cda) => cda.length > 0); // Remove entradas vazias

  const processoData = {
    devedorId,
    numeroProcesso: numeroProcesso,
    exequenteId,
    tipoProcesso,
    status,
    motivoSuspensaoId: status === "Suspenso" ? motivoSuspensaoId : null,
    cdas: cdasInput,
    cdasNormalizadas: cdasNormalizadas,
    uidUsuario: auth.currentUser.uid,
    valorAtual: {
      valor: valorInput,
      data: firebase.firestore.FieldValue.serverTimestamp(),
    },
  };

  if (tipoProcesso === "apenso") {
    const processoPilotoId = document.getElementById("processo-piloto")?.value;
    if (!processoPilotoId) {
      errorMessage.textContent =
        "Para apensos, é obrigatório selecionar um processo piloto.";
      return;
    }
    processoData.processoPilotoId = processoPilotoId;
    const pilotoSelecionado = processosCache.find(
      (p) => p.id === processoPilotoId
    );
    if (pilotoSelecionado && pilotoSelecionado.exequenteId !== exequenteId) {
      errorMessage.textContent =
        "Não é permitido apensar um processo a um piloto com exequentes diferentes.";
      return;
    }
  } else {
    processoData.processoPilotoId = null;
  }

  try {
    if (processoId) {
      const batch = db.batch();
      const processoRef = db.collection("processos").doc(processoId);
      processoData.atualizadoEm =
        firebase.firestore.FieldValue.serverTimestamp();

      const processoOriginal = processosCache.find((p) => p.id === processoId);
      if (processoOriginal) {
        const valorOriginal = processoOriginal.valorAtual
          ? processoOriginal.valorAtual.valor
          : processoOriginal.valorDivida || 0;
        if (valorInput !== valorOriginal) {
          const historicoRef = processoRef.collection("historicoValores").doc();
          batch.set(historicoRef, {
            valor: valorInput,
            data: firebase.firestore.FieldValue.serverTimestamp(),
            tipo: "Atualização Manual (Edição)",
          });
        }
      }
      batch.update(processoRef, processoData);
      await batch.commit();
    } else {
      processoData.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("processos").add(processoData);
    }

    showDevedorPage(devedorId);
    setTimeout(
      () =>
        showToast(
          `Processo ${processoId ? "atualizado" : "salvo"} com sucesso!`
        ),
      100
    );
  } catch (err) {
    console.error("Erro ao salvar processo: ", err);
    errorMessage.textContent = "Ocorreu um erro ao salvar.";
  }
}

function renderImportacaoPage() {
  pageTitle.textContent = "Importação em Lote de Processos";
  document.title = "SASIF | Importação em Lote";

  const devedorOptions = [...devedoresCache]
    .sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial))
    .map(
      (devedor) =>
        `<option value="${devedor.id}">${devedor.razaoSocial}</option>`
    )
    .join("");

  contentArea.innerHTML = `
        <div class="import-container">
            <div class="detail-card">
                <h3>1. Selecione o Grande Devedor</h3>
                <p>Escolha o devedor ao qual os processos abaixo pertencem.</p>
                
                <!-- LABEL REMOVIDO E CLASSE ADICIONADA AO SELECT -->
                <select id="devedor-import-select" class="import-devedor-select" style="margin-top: 16px;">
                    <option value="">Selecione um devedor...</option>
                    ${devedorOptions}
                </select>
            </div>

            <div class="detail-card">
                <h3>2. Cole os Dados da Planilha</h3>
                <!-- TEXTO DA INSTRUÇÃO ALTERADO -->
                <p>Copie as cinco colunas de cada devedor e cole no campo abaixo (processo, exequente, tipo, valor e CDAs).</p>
                <textarea id="import-data-textarea" placeholder="Cole os dados aqui..."></textarea>
                <button id="processar-import-btn" class="btn-primary">Processar e Importar</button>
            </div>
            
            <div class="detail-card">
                <h3>3. Resultados da Importação</h3>
                <div id="import-results-container">Aguardando dados para processamento...</div>
            </div>
        </div>
    `;

  document
    .getElementById("processar-import-btn")
    .addEventListener("click", handleProcessarImportacao);
}

async function handleProcessarImportacao() {
  const devedorId = document.getElementById("devedor-import-select").value;
  const rawData = document.getElementById("import-data-textarea").value;
  const resultsContainer = document.getElementById("import-results-container");
  const processarBtn = document.getElementById("processar-import-btn");

  if (!devedorId) {
    resultsContainer.innerHTML =
      '<div class="result-line error">Erro: Por favor, selecione um Grande Devedor.</div>';
    return;
  }
  if (!rawData.trim()) {
    resultsContainer.innerHTML =
      '<div class="result-line error">Erro: Por favor, cole os dados da planilha na caixa de texto.</div>';
    return;
  }

  processarBtn.disabled = true;
  processarBtn.textContent = "Processando...";
  resultsContainer.innerHTML = "Iniciando o processamento...";

  const linhas = rawData.trim().split("\n");
  const processosParaCriar = [];
  const resultadosLog = [];
  let ultimoPilotoId = null;

  for (const [index, linha] of linhas.entries()) {
    const colunas = linha.split("\t");
    if (colunas.length < 3) {
      resultadosLog.push({
        type: "error",
        message: `Linha ${index + 1}: Formato inválido. Pulando.`,
      });
      continue;
    }

    const [
      numeroProcessoRaw,
      exequenteNomeRaw,
      tipoProcessoRaw,
      valorRaw = "0",
      cdasRaw = "",
    ] = colunas;

    const numeroProcesso = numeroProcessoRaw.replace(/\D/g, "");
    const tipoProcesso = tipoProcessoRaw.trim().toLowerCase();
    const exequenteNome = exequenteNomeRaw.trim();

    if (numeroProcesso.length !== 20) {
      resultadosLog.push({
        type: "error",
        message: `Linha ${
          index + 1
        } (${numeroProcessoRaw}): Número de processo inválido. Pulando.`,
      });
      continue;
    }
    const exequente = exequentesCache.find(
      (e) => e.nome.toLowerCase() === exequenteNome.toLowerCase()
    );
    if (!exequente) {
      resultadosLog.push({
        type: "error",
        message: `Linha ${
          index + 1
        } (${numeroProcessoRaw}): Exequente "${exequenteNome}" não encontrado. Cadastre-o primeiro. Pulando.`,
      });
      continue;
    }

    const valor =
      parseFloat(
        String(valorRaw).replace("R$", "").replace(/\./g, "").replace(",", ".")
      ) || 0;

    const processoData = {
      numeroProcesso: numeroProcesso,
      exequenteId: exequente.id,
      tipoProcesso: tipoProcesso,
      cdas: cdasRaw.trim(),
      devedorId: devedorId,
      uidUsuario: auth.currentUser.uid,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      valorAtual: {
        valor: valor,
        data: firebase.firestore.FieldValue.serverTimestamp(),
      },
    };

    if (tipoProcesso === "piloto") {
      processoData.status = "Ativo";
      const novoId = db.collection("processos").doc().id;
      processoData.id = novoId;
      ultimoPilotoId = novoId;
    } else if (tipoProcesso === "apenso") {
      if (!ultimoPilotoId) {
        resultadosLog.push({
          type: "error",
          message: `Linha ${
            index + 1
          } (${numeroProcessoRaw}): Apenso encontrado sem um Piloto anterior. Pulando.`,
        });
        continue;
      }
      processoData.status = "Baixado";
      processoData.processoPilotoId = ultimoPilotoId;
      processoData.id = db.collection("processos").doc().id;
    } else if (tipoProcesso === "autônomo") {
      processoData.status = "Ativo";
      ultimoPilotoId = null;
      processoData.id = db.collection("processos").doc().id;
    } else {
      resultadosLog.push({
        type: "error",
        message: `Linha ${
          index + 1
        } (${numeroProcessoRaw}): Tipo "${tipoProcessoRaw}" inválido. Pulando.`,
      });
      continue;
    }

    processosParaCriar.push(processoData);
    resultadosLog.push({
      type: "success",
      message: `Linha ${index + 1}: Processo ${formatProcessoForDisplay(
        numeroProcesso
      )} validado.`,
    });
  }

  if (processosParaCriar.some((p) => p.id)) {
    const batch = db.batch();

    processosParaCriar.forEach((proc) => {
      const processoRef = db.collection("processos").doc(proc.id);
      const { id, ...dataToSave } = proc;
      batch.set(processoRef, dataToSave);
    });

    try {
      await batch.commit();
      resultadosLog.push({
        type: "success",
        message: `\nLOTE FINALIZADO: ${processosParaCriar.length} processos importados com sucesso!`,
      });
    } catch (error) {
      console.error("Erro na importação em lote:", error);
      resultadosLog.push({
        type: "error",
        message: `\nERRO CRÍTICO: A importação falhou. Nenhum processo foi salvo.`,
      });
    }
  } else {
    resultadosLog.push({
      type: "error",
      message: `\nNenhum processo válido encontrado para importação.`,
    });
  }

  resultsContainer.innerHTML =
    `<div class="import-results-header">Log da Importação:</div>` +
    resultadosLog
      .map((log) => `<div class="result-line ${log.type}">${log.message}</div>`)
      .join("");

  processarBtn.disabled = false;
  processarBtn.textContent = "Processar e Importar";
  document.getElementById("import-data-textarea").value = "";
}

function setupListeners() {
  db.collection("grandes_devedores")
    .orderBy("nivelPrioridade")
    .orderBy("razaoSocial")
    .onSnapshot((snapshot) => {
      devedoresCache = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      if (document.title.includes("Grandes Devedores")) {
        renderDevedoresList(devedoresCache);
      }
      if (document.title.includes("Dashboard")) {
        setupDashboardWidgets();
      }
    });
  db.collection("exequentes")
    .orderBy("nome")
    .onSnapshot((snapshot) => {
      exequentesCache = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      if (document.title.includes("Exequentes"))
        renderExequentesList(exequentesCache);
    });
  db.collection("motivos_suspensao")
    .orderBy("descricao")
    .onSnapshot((snapshot) => {
      motivosSuspensaoCache = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      if (document.title.includes("Motivos de Suspensão"))
        renderMotivosList(motivosSuspensaoCache);
    });
}

async function setupProcessosListener(devedorId) {
  if (processosListenerUnsubscribe) processosListenerUnsubscribe();

  // Busca todos os incidentes vinculados a este devedor UMA VEZ
  const incidentesSnapshot = await db
    .collection("incidentesProcessuais")
    .where("devedorId", "==", devedorId)
    .get();
  const incidentesDoDevedor = incidentesSnapshot.docs.map((doc) => doc.data());

  // Listener para os processos (continua em tempo real)
  processosListenerUnsubscribe = db
    .collection("processos")
    .where("devedorId", "==", devedorId)
    .onSnapshot(
      (snapshot) => {
        // LINHA CRUCIAL REINTRODUZIDA AQUI
        processosCache = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Passa os dados para a função de renderização
        renderProcessosList(processosCache, incidentesDoDevedor);
      },
      (error) => {
        console.error("Erro ao buscar processos: ", error);
        if (
          error.code === "failed-precondition" &&
          document.getElementById("processos-list-container")
        ) {
          document.getElementById(
            "processos-list-container"
          ).innerHTML = `<p class="empty-list-message">Erro: O índice necessário para esta consulta não existe. Verifique o console.</p>`;
        }
      }
    );
}

function setupTodosIncidentesListener() {
  // Desconecta qualquer listener anterior para evitar duplicação
  if (diligenciasListenerUnsubscribe) {
    diligenciasListenerUnsubscribe();
    diligenciasListenerUnsubscribe = null;
  }

  diligenciasListenerUnsubscribe = db
    .collection("incidentesProcessuais")
    .orderBy("criadoEm", "desc")
    .onSnapshot(
      (snapshot) => {
        const incidentes = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        renderTodosIncidentesList(incidentes);
      },
      (error) => {
        console.error("Erro ao buscar incidentes: ", error);
        const container = document.getElementById(
          "todos-incidentes-list-container"
        );
        if (container)
          container.innerHTML = `<p class="empty-list-message">Ocorreu um erro ao carregar os incidentes.</p>`;
      }
    );
}

function initApp(user) {
  userEmailSpan.textContent = user.email;
  logoutButton.addEventListener("click", () => {
    auth.signOut();
  });

  setupGlobalSearch();
  navigateTo("dashboard");
  setupListeners();
}

document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged((user) => {
    if (user) {
      appContainer.classList.remove("hidden");
      loginContainer.classList.add("hidden");
      initApp(user);
    } else {
      appContainer.classList.add("hidden");
      loginContainer.classList.remove("hidden");
      renderLoginForm();
    }
  });
});

function renderLoginForm() {
  document.title = "SASIF | Login";
  loginContainer.innerHTML = `
        <h1>SASIF</h1>
        <p>Acesso ao Sistema de Acompanhamento</p>
        <div class="form-group">
            <label for="email">E-mail</label>
            <input type="email" id="email" required>
        </div>
        <div class="form-group">
            <label for="password">Senha</label>
            <input type="password" id="password" required>
        </div>
        <a href="#" id="forgot-password-link" class="forgot-password-link">Esqueci minha senha</a>
        <div id="error-message"></div>
        <div class="form-buttons">
            <button id="login-btn">Entrar</button>
        </div>`;

  document.getElementById("login-btn").addEventListener("click", handleLogin);
  document
    .getElementById("forgot-password-link")
    .addEventListener("click", handlePasswordResetRequest);
}

function handleLogin() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const errorMessage = document.getElementById("error-message");
  if (!email || !password) {
    errorMessage.textContent = "Por favor, preencha e-mail e senha.";
    return;
  }
  auth.signInWithEmailAndPassword(email, password).catch((error) => {
    errorMessage.textContent = "E-mail ou senha incorretos.";
  });
}

function handlePasswordResetRequest(event) {
  event.preventDefault();
  const email = document.getElementById("email").value;
  const errorMessage = document.getElementById("error-message");

  if (!email) {
    errorMessage.textContent =
      "Por favor, digite seu e-mail no campo acima para redefinir a senha.";
    return;
  }

  auth
    .sendPasswordResetEmail(email)
    .then(() => {
      showToast("E-mail de redefinição de senha enviado com sucesso!");
      errorMessage.textContent =
        "Verifique sua caixa de entrada para o link de redefinição.";
      errorMessage.style.color = "var(--cor-sucesso)";
    })
    .catch((error) => {
      console.error("Erro ao enviar e-mail de redefinição:", error);
      if (error.code === "auth/user-not-found") {
        errorMessage.textContent = "Nenhum usuário encontrado com este e-mail.";
      } else {
        errorMessage.textContent = "Ocorreu um erro ao tentar enviar o e-mail.";
      }
      errorMessage.style.color = "var(--cor-erro)";
    });
}

// Substitua esta função inteira
async function gerarRelatorioPenhoras() {
  const devedorId = document.getElementById("filtro-devedor-penhora").value;
  const exequenteId = document.getElementById("filtro-exequente-penhora").value;
  const processoId = document.getElementById("filtro-processo-penhora").value;

  const resultsContainer = document.getElementById("report-results-container");
  if (!devedorId) {
    resultsContainer.innerHTML = `<p class="empty-list-message error">Por favor, selecione um executado para gerar o relatório.</p>`;
    return;
  }
  resultsContainer.innerHTML = `<p class="empty-list-message">Gerando relatório, por favor aguarde...</p>`;

  try {
    let processosQuery = db
      .collection("processos")
      .where("devedorId", "==", devedorId);
    if (exequenteId) {
      processosQuery = processosQuery.where("exequenteId", "==", exequenteId);
    }
    if (processoId) {
      processosQuery = processosQuery.where(
        firebase.firestore.FieldPath.documentId(),
        "==",
        processoId
      );
    }

    const processosSnapshot = await processosQuery.get();
    if (processosSnapshot.empty) {
      resultsContainer.innerHTML = `<p class="empty-list-message">Nenhum processo encontrado para os filtros selecionados.</p>`;
      return;
    }

    const processosMap = new Map(
      processosSnapshot.docs.map((doc) => [
        doc.id,
        { id: doc.id, ...doc.data() },
      ])
    );
    const processoIds = Array.from(processosMap.keys());

    if (processoIds.length === 0) {
      resultsContainer.innerHTML = `<p class="empty-list-message">Nenhuma penhora encontrada para os processos deste executado.</p>`;
      return;
    }

    // AQUI ESTÁ A CORREÇÃO PRINCIPAL: Buscando em "chunks" de 10
    let penhoras = [];
    const chunks = [];
    // Quebra a lista de IDs em pedaços de no máximo 10
    for (let i = 0; i < processoIds.length; i += 10) {
      chunks.push(processoIds.slice(i, i + 10));
    }

    // Executa uma busca para cada pedaço em paralelo
    await Promise.all(
      chunks.map(async (chunk) => {
        const penhorasSnapshot = await db
          .collection("penhoras")
          .where("processoId", "in", chunk)
          .get();
        penhorasSnapshot.forEach((doc) =>
          penhoras.push({ id: doc.id, ...doc.data() })
        );
      })
    );

    if (penhoras.length === 0) {
      resultsContainer.innerHTML = `<p class="empty-list-message">Nenhuma penhora encontrada para os processos deste executado.</p>`;
      return;
    }

    const groupedData = penhoras.reduce((acc, penhora) => {
      const processo = processosMap.get(penhora.processoId);
      if (!processo) return acc;
      const exId = processo.exequenteId;
      if (!acc[exId]) {
        acc[exId] = {};
      }
      if (!acc[exId][processo.id]) {
        acc[exId][processo.id] = [];
      }
      acc[exId][processo.id].push(penhora);
      return acc;
    }, {});

    currentReportData = {
      raw: penhoras,
      grouped: groupedData,
      processos: processosMap,
    };
    renderRelatorioPenhorasResultados(groupedData, processosMap);
  } catch (error) {
    console.error("Erro ao gerar relatório de penhoras:", error);
    resultsContainer.innerHTML = `<p class="empty-list-message error">Ocorreu um erro ao gerar o relatório.</p>`;
  }
}

// FUNÇÃO 2: RENDERIZA A TABELA DE PENHORAS NA TELA
// ALTERAÇÃO AQUI: Recebe 'processosMap' como segundo argumento
function renderRelatorioPenhorasResultados(groupedData, processosMap) {
  const resultsContainer = document.getElementById("report-results-container");

  let tableHTML = `
        <div class="detail-card">
            <h3>Resultados do Relatório</h3>
            <div style="display: flex; justify-content: flex-end; align-items: center; margin-bottom: 20px;">
                <button id="download-pdf-penhora-btn" class="btn-secondary">Download PDF</button>
            </div>
            <table class="data-table" id="report-table-penhoras">
                <thead>
                    <tr>
                        <th>Descrição do Bem</th>
                        <th style="width: 15%;">Valor</th>
                        <th style="width: 15%;">Data</th>
                    </tr>
                </thead>
                <tbody>`;

  for (const exequenteId in groupedData) {
    const exequente = exequentesCache.find((e) => e.id === exequenteId);
    tableHTML += `<tr class="group-header"><td colspan="3"><strong>Exequente:</strong> ${
      exequente ? exequente.nome : "Não Identificado"
    }</td></tr>`;

    for (const processoId in groupedData[exequenteId]) {
      // ALTERAÇÃO AQUI: Usa o processosMap em vez do cache global
      const processo = processosMap.get(processoId) || {
        numeroProcesso: "Desconhecido",
      };
      tableHTML += `<tr class="subgroup-header"><td colspan="3"><strong>Processo:</strong> ${formatProcessoForDisplay(
        processo.numeroProcesso
      )}</td></tr>`;

      groupedData[exequenteId][processoId].forEach((penhora) => {
        let dataFormatada = "Não informada";
        if (penhora.data) {
          const partes = penhora.data.split("-");
          dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
        }
        tableHTML += `
                    <tr>
                        <td>${penhora.descricao}</td>
                        <td>${formatCurrency(penhora.valor || 0)}</td>
                        <td>${dataFormatada}</td>
                    </tr>`;
      });
    }
  }

  tableHTML += `</tbody></table></div>`;
  resultsContainer.innerHTML = tableHTML;

  document
    .getElementById("download-pdf-penhora-btn")
    .addEventListener("click", gerarPDFRelatorioPenhoras);
}

// FUNÇÃO 3: GERA O PDF DO RELATÓRIO DE PENHORAS
function gerarPDFRelatorioPenhoras() {
  const { jsPDF } = window.jspdf;
  if (
    !currentReportData.grouped ||
    !currentReportData.processos ||
    Object.keys(currentReportData.grouped).length === 0
  ) {
    showToast("Não há dados para gerar o PDF.", "error");
    return;
  }

  const doc = new jsPDF("p", "mm", "a4");
  doc.setFontSize(18);
  // Título do documento alterado
  doc.text("Relatório de Constrições Patrimoniais - SASIF", 14, 22);

  const tableRows = [];
  const tableHeaders = [["Descrição do Bem", "Valor", "Data"]];

  for (const exequenteId in currentReportData.grouped) {
    const exequente = exequentesCache.find((e) => e.id === exequenteId);
    tableRows.push([
      {
        content: `Exequente: ${
          exequente ? exequente.nome : "Não Identificado"
        }`,
        colSpan: 3,
        styles: { fontStyle: "bold", fillColor: "#eef1f5", textColor: "#333" },
      },
    ]);

    for (const processoId in currentReportData.grouped[exequenteId]) {
      const processo = currentReportData.processos.get(processoId) || {
        numeroProcesso: "Desconhecido",
      };
      tableRows.push([
        {
          content: `Processo: ${formatProcessoForDisplay(
            processo.numeroProcesso
          )}`,
          colSpan: 3,
          styles: { fontStyle: "italic", fillColor: "#fafafa" },
        },
      ]);

      currentReportData.grouped[exequenteId][processoId].forEach((penhora) => {
        let dataFormatada = "Não informada";
        if (penhora.data) {
          const partes = penhora.data.split("-");
          dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
        }
        tableRows.push([
          penhora.descricao,
          formatCurrency(penhora.valor || 0),
          dataFormatada,
        ]);
      });
    }
  }

  doc.autoTable({
    head: tableHeaders,
    body: tableRows,
    startY: 30,
    theme: "grid",
    headStyles: { fillColor: [13, 71, 161], textColor: [255, 255, 255] },
  });

  const dataGeracao = new Date()
    .toLocaleDateString("pt-BR")
    .replace(/\//g, "-");
  // Nome do arquivo alterado
  doc.save(`SASIF-Relatorio-Constricoes-${dataGeracao}.pdf`);
}

// FUNÇÃO 1: LÓGICA PRINCIPAL DO RELATÓRIO DE INCIDENTES
async function gerarRelatorioIncidentes() {
  const devedorId = document.getElementById("filtro-devedor-incidente").value;
  const exequenteId = document.getElementById(
    "filtro-exequente-incidente"
  ).value;

  const resultsContainer = document.getElementById("report-results-container");
  if (!devedorId) {
    resultsContainer.innerHTML = `<p class="empty-list-message error">Por favor, selecione um executado para gerar o relatório.</p>`;
    return;
  }
  resultsContainer.innerHTML = `<p class="empty-list-message">Gerando relatório, por favor aguarde...</p>`;

  try {
    let numerosProcessosFiltrados = null;

    // Se um exequente foi selecionado, primeiro filtramos os processos
    if (exequenteId) {
      const processosSnapshot = await db
        .collection("processos")
        .where("devedorId", "==", devedorId)
        .where("exequenteId", "==", exequenteId)
        .get();

      if (processosSnapshot.empty) {
        resultsContainer.innerHTML = `<p class="empty-list-message">Nenhum processo encontrado para este executado e exequente.</p>`;
        return;
      }
      numerosProcessosFiltrados = processosSnapshot.docs.map(
        (doc) => doc.data().numeroProcesso
      );
    }

    // Agora, buscamos os incidentes
    let incidentesQuery = db
      .collection("incidentesProcessuais")
      .where("devedorId", "==", devedorId);

    if (numerosProcessosFiltrados) {
      // Se filtramos processos, usamos a lista de números para filtrar os incidentes
      incidentesQuery = incidentesQuery.where(
        "numeroProcessoPrincipal",
        "in",
        numerosProcessosFiltrados
      );
    }

    const incidentesSnapshot = await incidentesQuery.get();

    if (incidentesSnapshot.empty) {
      resultsContainer.innerHTML = `<p class="empty-list-message">Nenhum incidente processual encontrado para os filtros selecionados.</p>`;
      return;
    }

    const incidentes = incidentesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    currentReportData = incidentes; // Salva os dados para o PDF
    renderRelatorioIncidentesResultados(incidentes);
  } catch (error) {
    console.error("Erro ao gerar relatório de incidentes:", error);
    resultsContainer.innerHTML = `<p class="empty-list-message error">Ocorreu um erro ao gerar o relatório.</p>`;
  }
}

// FUNÇÃO 2: RENDERIZA A TABELA DE INCIDENTES NA TELA (VERSÃO ATUALIZADA)
function renderRelatorioIncidentesResultados(incidentes) {
  const resultsContainer = document.getElementById("report-results-container");

  let tableHTML = `
        <div class="detail-card">
            <h3>Resultados do Relatório de Incidentes Processuais</h3>
            <div style="display: flex; justify-content: flex-end; align-items: center; margin-bottom: 20px;">
                <button id="download-pdf-incidente-btn" class="btn-secondary">Download PDF</button>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Nº do Incidente</th>
                        <th>Processo Principal Vinculado</th>
                        <th>Descrição</th>
                    </tr>
                </thead>
                <tbody>`;

  incidentes.forEach((incidente) => {
    const descricaoResumida =
      incidente.descricao.length > 100
        ? incidente.descricao.substring(0, 100) + "..."
        : incidente.descricao;

    // ALTERAÇÃO AQUI: As células agora são links clicáveis
    tableHTML += `
            <tr>
                <td>
                    <a href="#" class="view-processo-link" data-action="view-incidente-desc" data-id="${
                      incidente.id
                    }">
                        ${formatProcessoForDisplay(incidente.numeroIncidente)}
                    </a>
                </td>
                <td>${formatProcessoForDisplay(
                  incidente.numeroProcessoPrincipal
                )}</td>
                <td title="Clique para ver a descrição completa">
                    <a href="#" class="view-penhora-link" data-action="view-incidente-desc" data-id="${
                      incidente.id
                    }">
                        ${descricaoResumida.replace(/\n/g, "<br>")}
                    </a>
                </td>
            </tr>`;
  });

  tableHTML += `</tbody></table></div>`;
  resultsContainer.innerHTML = tableHTML;

  // ADIÇÃO AQUI: Event listener para os novos links
  const tableBody = resultsContainer.querySelector("tbody");
  if (tableBody) {
    tableBody.addEventListener("click", (event) => {
      const link = event.target.closest('[data-action="view-incidente-desc"]');
      if (link) {
        event.preventDefault();
        const incidenteId = link.dataset.id;
        const incidenteCompleto = currentReportData.find(
          (inc) => inc.id === incidenteId
        );

        if (incidenteCompleto) {
          renderReadOnlyTextModal(
            "Descrição Completa do Incidente",
            incidenteCompleto.descricao
          );
        } else {
          showToast(
            "Não foi possível encontrar os detalhes do incidente.",
            "error"
          );
        }
      }
    });
  }

  document
    .getElementById("download-pdf-incidente-btn")
    .addEventListener("click", gerarPDFRelatorioIncidentes);
}

// FUNÇÃO 3: GERA O PDF DO RELATÓRIO DE INCIDENTES
function gerarPDFRelatorioIncidentes() {
  const { jsPDF } = window.jspdf;
  if (!currentReportData || currentReportData.length === 0) {
    showToast("Não há dados para gerar o PDF.", "error");
    return;
  }

  const doc = new jsPDF("p", "mm", "a4");
  doc.setFontSize(18);
  doc.text("Relatório de Incidentes Processuais - SASIF", 14, 22);

  const tableRows = currentReportData.map((incidente) => [
    formatProcessoForDisplay(incidente.numeroIncidente),
    formatProcessoForDisplay(incidente.numeroProcessoPrincipal),
    incidente.descricao,
  ]);

  const tableHeaders = [["Nº do Incidente", "Processo Principal", "Descrição"]];

  doc.autoTable({
    head: tableHeaders,
    body: tableRows,
    startY: 30,
    theme: "grid",
    headStyles: { fillColor: [13, 71, 161], textColor: [255, 255, 255] },
    columnStyles: {
      2: { cellWidth: "auto" }, // Coluna de descrição se ajustará
    },
  });

  const dataGeracao = new Date()
    .toLocaleDateString("pt-BR")
    .replace(/\//g, "-");
  doc.save(`SASIF-Relatorio-Incidentes-${dataGeracao}.pdf`);
}

// ==================================================================
// MÓDULO DE ANEXOS
// ==================================================================

function setupAnexosListener(processoId) {
  if (anexosListenerUnsubscribe) {
    anexosListenerUnsubscribe();
    anexosListenerUnsubscribe = null;
  }

  anexosListenerUnsubscribe = db
    .collection("anexos")
    .where("processoId", "==", processoId)
    .orderBy("criadoEm", "desc")
    .onSnapshot(
      (snapshot) => {
        const anexos = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        renderAnexosUI(anexos, processoId);
      },
      (error) => {
        console.error("Erro ao buscar anexos: ", error);
        const container = document.getElementById("anexos-list-container");
        if (container)
          container.innerHTML = `<p class="empty-list-message error">Ocorreu um erro ao carregar os anexos.</p>`;
      }
    );
}

function renderAnexosUI(anexos, processoId) {
  const actionsContainer = document.getElementById("anexos-actions-container");
  const listContainer = document.getElementById("anexos-list-container");

  if (!actionsContainer || !listContainer) return;

  let actionsHTML = "";
  if (anexos.length > 0) {
    actionsHTML += `<button id="view-anexos-btn" class="btn-secondary">Visualizar Anexos (${anexos.length})</button>`;
  }
  actionsHTML += `<button id="add-anexo-btn" class="btn-primary" style="margin-left: 8px;">Anexar Novo</button>`;
  actionsContainer.innerHTML = actionsHTML;

  if (anexos.length > 0) {
    document
      .getElementById("view-anexos-btn")
      .addEventListener("click", () => renderAnexosListModal(anexos));
  }
  document
    .getElementById("add-anexo-btn")
    .addEventListener("click", () => renderAnexoFormModal(processoId));

  listContainer.innerHTML =
    anexos.length === 0
      ? `<p class="empty-list-message">Nenhum anexo para este processo.</p>`
      : "";
}

function renderAnexoFormModal(processoId) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";

  modalOverlay.innerHTML = `
        <div class="modal-content">
            <h3>Anexar Novo Arquivo</h3>
            <div class="form-group">
                <label for="anexo-nome">Nome do Arquivo (Obrigatório)</label>
                <input type="text" id="anexo-nome" placeholder="Ex: Petição da União, Decisão, etc." required>
            </div>
            <div class="form-group">
                <label for="anexo-file">Selecionar Arquivo (PDF)</label>
                <input type="file" id="anexo-file" accept=".pdf" required>
            </div>
            <div id="error-message"></div>
            <div class="form-buttons">
                <button id="save-anexo-btn" class="btn-primary">Salvar Anexo</button>
                <button id="cancel-anexo-btn">Cancelar</button>
            </div>
        </div>
    `;
  document.body.appendChild(modalOverlay);

  const closeModal = () => document.body.removeChild(modalOverlay);
  document
    .getElementById("cancel-anexo-btn")
    .addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  document
    .getElementById("save-anexo-btn")
    .addEventListener("click", () => handleSaveAnexo(processoId));
}

async function handleSaveAnexo(processoId) {
  const nomeArquivo = document.getElementById("anexo-nome").value.trim();
  const fileInput = document.getElementById("anexo-file");
  const file = fileInput.files[0];
  const saveButton = document.getElementById("save-anexo-btn");
  const errorMessage = document.getElementById("error-message");
  errorMessage.textContent = "";

  if (!nomeArquivo || !file) {
    errorMessage.textContent =
      "Nome do arquivo e a seleção de um arquivo são obrigatórios.";
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Enviando...";

  try {
    const uniqueId = Date.now();
    const storagePath = `anexos/${processoId}/${uniqueId}-${file.name}`;
    const storageRef = storage.ref(storagePath);

    const uploadTask = await storageRef.put(file);
    const downloadURL = await uploadTask.ref.getDownloadURL();

    await db.collection("anexos").add({
      processoId,
      nomeArquivo,
      nomeOriginal: file.name,
      storagePath,
      downloadURL,
      tipoArquivo: file.type,
      tamanhoArquivo: file.size,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      userId: auth.currentUser.uid,
    });

    showToast("Anexo salvo com sucesso!");
    document.body.removeChild(document.querySelector(".modal-overlay"));
  } catch (error) {
    console.error("Erro ao salvar anexo:", error);
    errorMessage.textContent =
      "Ocorreu um erro durante o upload. Tente novamente.";
    saveButton.disabled = false;
    saveButton.textContent = "Salvar Anexo";
  }
}

function renderAnexosListModal(anexos) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";

  let anexosHTML = "";
  if (anexos.length === 0) {
    anexosHTML = `<p class="empty-list-message">Nenhum anexo encontrado.</p>`;
  } else {
    anexosHTML = `<ul class="anexos-list">`;
    anexos.forEach((anexo) => {
      const dataAnexo = anexo.criadoEm
        ? anexo.criadoEm.toDate().toLocaleDateString("pt-BR")
        : "Data indisponível";
      anexosHTML += `
                <li class="anexo-item">
                    <div class="anexo-info">
                        <span class="anexo-nome">${anexo.nomeArquivo}</span>
                        <span class="anexo-data">Anexado em: ${dataAnexo}</span>
                    </div>
                    <div class="anexo-actions">
                        <a href="${anexo.downloadURL}" target="_blank" rel="noopener noreferrer" class="action-icon" title="Visualizar/Baixar">
                           <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#555"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                        </a>
                        <button class="action-icon icon-delete" title="Excluir Anexo" data-id="${anexo.id}" data-path="${anexo.storagePath}">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                    </div>
                </li>
            `;
    });
    anexosHTML += `</ul>`;
  }

  modalOverlay.innerHTML = `
        <div class="modal-content modal-large">
            <h3>Anexos do Processo</h3>
            ${anexosHTML}
            <div class="form-buttons" style="justify-content: flex-end; margin-top: 20px;">
                <button id="close-anexos-modal" class="btn-secondary">Fechar</button>
            </div>
        </div>
    `;
  document.body.appendChild(modalOverlay);

  const closeModal = () => document.body.removeChild(modalOverlay);
  document
    .getElementById("close-anexos-modal")
    .addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  modalOverlay.querySelector(".anexos-list")?.addEventListener("click", (e) => {
    const deleteButton = e.target.closest(".icon-delete");
    if (deleteButton) {
      const anexoId = deleteButton.dataset.id;
      const storagePath = deleteButton.dataset.path;
      handleDeleteAnexo(anexoId, storagePath);
    }
  });
}

async function handleDeleteAnexo(anexoId, storagePath) {
  if (!confirm("Tem certeza que deseja excluir este anexo permanentemente?")) {
    return;
  }

  try {
    if (storagePath) {
      const storageRef = storage.ref(storagePath);
      await storageRef.delete();
    } else {
      console.warn(
        "Storage path não encontrado para o anexo, pulando deleção do Storage."
      );
    }

    await db.collection("anexos").doc(anexoId).delete();

    showToast("Anexo excluído com sucesso.");
    const modal = document.querySelector(".modal-overlay");
    if (modal) modal.remove();
  } catch (error) {
    console.error("Erro ao excluir anexo: ", error);
    showToast("Ocorreu um erro ao excluir o anexo.", "error");
  }
}
