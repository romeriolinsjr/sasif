// ==================================================================
// Módulo: investigacaoFiscal.js
// Responsabilidade: Lógica da página "Investigação Fiscal".
// (Versão com Layout de 2 Colunas no Modal - 02/08/2025)
// ==================================================================

import { db } from "./firebase.js";
import { contentArea, pageTitle, showToast } from "./ui.js";
import {
  getSafeDate,
  maskProcesso,
  formatProcessoForDisplay,
  getPrazoStatus,
} from "./utils.js";

let investigacaoListenerUnsubscribe = null;
let currentInvestigacao = null;
let currentInvestigacoesList = [];
let currentArchivedList = [];

export function renderInvestigacaoFiscalPage() {
  pageTitle.textContent = "Investigação Fiscal";
  document.title = "SASIF | Investigação Fiscal";
  contentArea.innerHTML = `
        <div class="dashboard-actions">
            <button data-action="add-investigacao" class="btn-primary">Cadastrar Processo</button>
            <button data-action="view-arquivados" class="btn-secondary">Consultar Arquivados</button>
        </div>
        <h2>Processos em Andamento</h2>
        <div id="investigacao-list-container"><p class="empty-list-message">Carregando investigações...</p></div>
    `;
  setupInvestigacaoListener();
  setupPageEventListeners();
}

function setupInvestigacaoListener() {
  if (investigacaoListenerUnsubscribe) investigacaoListenerUnsubscribe();
  const query = db
    .collection("investigacoesFiscais")
    .where("status", "==", "ativo")
    .orderBy("criadoEm", "desc");
  investigacaoListenerUnsubscribe = query.onSnapshot(
    (snapshot) => {
      currentInvestigacoesList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      renderInvestigacaoList(currentInvestigacoesList);
    },
    (error) => {
      console.error("Erro ao buscar investigações: ", error);
      showToast("Erro ao carregar os dados.", "error");
    }
  );
}

function setupPageEventListeners() {
  document.body.addEventListener("click", handlePageActions);
}

function renderInvestigacaoList(investigacoes) {
  const container = document.getElementById("investigacao-list-container");
  if (!container) return;
  if (investigacoes.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhuma investigação em andamento.</p>`;
    return;
  }
  const tableRows = investigacoes
    .map((item) => {
      const prazoInfo = getPrazoStatus(item.prazoRetorno);
      const numeroFormatado = item.numeroProcesso
        ? formatProcessoForDisplay(item.numeroProcesso)
        : "Não informado";
      const faseAtual = item.faseAtual || "Indefinida";
      const statusCellHTML = `<td><span class="status-dot ${prazoInfo.statusClass}"></span>${prazoInfo.text}</td>`;
      return `<tr>
          <td><span class="link-like" data-action="view-details" data-id="${
            item.id
          }">${numeroFormatado}</span></td>
          <td>${item.suscitado || "Não informado"}</td>
          <td>${faseAtual}</td>
          ${statusCellHTML}
        </tr>`;
    })
    .join("");
  container.innerHTML = `
    <table class="data-table">
        <thead>
            <tr>
                <th>Nº do Processo</th>
                <th>Suscitado</th>
                <th>Fase Atual</th>
                <th>Prazo para Retorno</th>
            </tr>
        </thead>
        <tbody>${tableRows}</tbody>
    </table>`;
}

function renderUnifiedInvestigacaoModal(investigacao, isEditing = false) {
  currentInvestigacao = investigacao;
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";

  const isNew = investigacao === null;
  let headerHTML, contentHTML, footerHTML;

  if (isEditing) {
    headerHTML = `<div class="modal-header-actions"><h3>${
      isNew ? "Cadastrar Nova" : "Editando"
    } Investigação</h3></div>`;
    contentHTML = buildEditModeContent(investigacao);
    footerHTML = `
      <button data-action="save-unified" data-id="${
        isNew ? "" : investigacao.id
      }" class="btn-primary">Salvar</button>
      ${
        !isNew
          ? `<button data-action="archive-investigacao" data-id="${investigacao.id}" class="btn-secondary">Arquivar</button>`
          : ""
      }
      <button data-action="cancel-edit" data-id="${
        isNew ? "" : investigacao.id
      }" class="btn-secondary">Cancelar</button>
    `;
  } else {
    headerHTML = `
      <div class="modal-header-actions">
          <h3>Detalhes da Investigação</h3>
          <div class="modal-actions-container">
              <button class="action-icon icon-edit" title="Editar" data-action="toggle-edit-mode" data-id="${investigacao.id}"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
              <button class="action-icon icon-delete" title="Excluir" data-action="delete-investigacao" data-id="${investigacao.id}"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
          </div>
      </div>`;
    contentHTML = buildViewModeContent(investigacao);
    footerHTML = `<button data-action="close-modal" class="btn-secondary">Fechar</button>`;
  }

  modalOverlay.innerHTML = `
    <div class="modal-content modal-large modal-scrollable" data-id="${
      isNew ? "" : investigacao.id
    }">
        ${headerHTML}
        <div class="modal-body">${contentHTML}</div>
        <div id="error-message" style="padding: 0 16px;"></div>
        <div class="form-buttons">${footerHTML}</div>
    </div>`;

  document.body.appendChild(modalOverlay);

  if (!isNew) {
    const audienciasContainer = modalOverlay.querySelector(
      "#if-audiencias-list"
    );
    if (audienciasContainer) {
      populateAudienciasList(audienciasContainer, investigacao.id, isEditing);
    }
  }

  if (isEditing) {
    const processoInput = modalOverlay.querySelector(
      "#inv-numero-processo-edit"
    );
    if (processoInput)
      processoInput.addEventListener("input", (e) => maskProcesso(e.target));
  }
}

function buildViewModeContent(investigacao) {
  const dataAjuizamento = getSafeDate(investigacao.dataAjuizamento);
  const dataAjuizamentoFormatada = dataAjuizamento
    ? dataAjuizamento.toLocaleDateString("pt-BR", { timeZone: "UTC" })
    : "Não informada";
  const fases = investigacao.fasesStatus || {};
  const faseMap = {
    pendente: "Pendente",
    feito: "Sim",
    nao_aplicavel: "Não Aplicável",
  };

  return `
    <div style="padding: 0 16px;">
        <!-- Título para o primeiro bloco -->
        <h4 style="font-size: 1.1em; color: var(--cor-primaria); margin-bottom: 16px; border-bottom: 1px solid var(--cor-borda); padding-bottom: 8px;">Informações Gerais</h4>
        <div class="task-details-container">
            <div class="detail-item"><span class="detail-label">Nº do Processo</span><span class="detail-value">${formatProcessoForDisplay(
              investigacao.numeroProcesso
            )}</span></div>
            <div class="detail-item"><span class="detail-label">Data de Ajuizamento</span><span class="detail-value">${dataAjuizamentoFormatada}</span></div>
            <div class="detail-item"><span class="detail-label">Suscitante</span><span class="detail-value">${
              investigacao.suscitante || "Não informado"
            }</span></div>
            <div class="detail-item"><span class="detail-label">Suscitado</span><span class="detail-value">${
              investigacao.suscitado || "Não informado"
            }</span></div>
        </div>

        <div class="andamento-secao">
            <h4 style="font-size: 1.1em; color: var(--cor-primaria); margin-top: 24px; margin-bottom: 16px; border-bottom: 1px solid var(--cor-borda); padding-bottom: 8px;">Trâmite Processual</h4>
            <p style="margin: 10px 0;"><strong>Decisão de Tutela:</strong> ${
              faseMap[fases.tutela] || "Pendente"
            }</p>
            <p style="margin: 10px 0;"><strong>Designação de Audiência:</strong> ${
              faseMap[fases.audiencia] || "Pendente"
            }</p>
            <p style="margin: 10px 0;"><strong>Julgamento Final:</strong> ${
              faseMap[fases.julgamento] || "Pendente"
            }</p>
        </div>

        ${
          investigacao.descricao
            ? `<div class="detail-item-full" style="margin-top: 24px;"><span class="detail-label">Descrição</span><div class="detail-description-box">${investigacao.descricao}</div></div>`
            : ""
        }
        <div class="andamento-secao"><h4 style="margin-top: 24px;">Audiências</h4><div id="if-audiencias-list"></div></div>
    </div>
  `;
}

function buildEditModeContent(investigacao) {
  const isNew = investigacao === null;
  const fases = isNew
    ? { tutela: "pendente", audiencia: "pendente", julgamento: "pendente" }
    : investigacao.fasesStatus || {};
  const createFaseSelector = (faseId, faseLabel, statusAtual) => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
      <label for="status-${faseId}" class="detail-label" style="margin-bottom: 0;">${faseLabel}</label>
      <select id="status-${faseId}" class="form-input" style="width: 150px;">
        <option value="pendente" ${
          statusAtual === "pendente" ? "selected" : ""
        }>Pendente</option>
        <option value="feito" ${
          statusAtual === "feito" ? "selected" : ""
        }>Sim</option>
        <option value="nao_aplicavel" ${
          statusAtual === "nao_aplicavel" ? "selected" : ""
        }>Não Aplicável</option>
      </select>
    </div>`;

  return `
    <div style="padding: 0 16px;">
        <!-- Título para o primeiro bloco -->
        <h4 style="font-size: 1.1em; color: var(--cor-primaria); margin-bottom: 16px; border-bottom: 1px solid var(--cor-borda); padding-bottom: 8px;">Informações Gerais</h4>
        <div class="form-group"><label for="inv-numero-processo-edit">Nº do Processo</label><input type="text" id="inv-numero-processo-edit" class="form-input" value="${
          isNew ? "" : formatProcessoForDisplay(investigacao.numeroProcesso)
        }"></div>
        <div class="form-group"><label for="inv-data-ajuizamento-edit">Data de Ajuizamento</label><input type="date" id="inv-data-ajuizamento-edit" class="form-input" value="${
          isNew
            ? ""
            : getSafeDate(investigacao.dataAjuizamento)
                .toISOString()
                .split("T")[0]
        }"></div>
        <div class="form-group"><label for="inv-suscitante-edit">Suscitante</label><input type="text" id="inv-suscitante-edit" class="form-input" value="${
          isNew ? "" : investigacao.suscitante || ""
        }"></div>
        <div class="form-group"><label for="inv-suscitado-edit">Suscitado</label><input type="text" id="inv-suscitado-edit" class="form-input" value="${
          isNew ? "" : investigacao.suscitado || ""
        }"></div>

        <div class="andamento-secao">
            <h4 style="font-size: 1.1em; color: var(--cor-primaria); margin-top: 24px; margin-bottom: 16px; border-bottom: 1px solid var(--cor-borda); padding-bottom: 8px;">Trâmite Processual</h4>
            ${createFaseSelector("tutela", "Decisão de Tutela", fases.tutela)}
            ${createFaseSelector(
              "audiencia",
              "Designação de Audiência",
              fases.audiencia
            )}
            ${createFaseSelector(
              "julgamento",
              "Julgamento Final",
              fases.julgamento
            )}
            <div class="form-group" style="margin-top: 24px;"><label for="andamento-prazo-retorno">Previsão da próxima conclusão</label><input type="date" id="andamento-prazo-retorno" class="form-input" value="${
              isNew || !investigacao.prazoRetorno
                ? ""
                : getSafeDate(investigacao.prazoRetorno)
                    .toISOString()
                    .split("T")[0]
            }"></div>
        </div>

        <div class="form-group" style="margin-top: 16px;"><label for="inv-descricao-edit">Descrição</label><textarea id="inv-descricao-edit" class="form-input" rows="3">${
          isNew ? "" : investigacao.descricao || ""
        }</textarea></div>
        ${
          !isNew
            ? `<div class="andamento-secao" style="margin-bottom: 24px;"><h4 style="margin-top: 24px;">Audiências</h4><div id="if-audiencias-list"></div><button data-action="agendar-audiencia" class="btn-secondary btn-small" style="margin-top: 10px;">Agendar audiência</button></div>`
            : ""
        }
    </div>
  `;
}

async function populateAudienciasList(
  container,
  investigacaoId,
  isEditing = false
) {
  if (!container) return;
  try {
    const snapshot = await db
      .collection("audiencias")
      .where("investigacaoId", "==", investigacaoId)
      .orderBy("dataHora", "desc")
      .get();
    const audiencias = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    if (audiencias.length === 0) {
      container.innerHTML = `<p class="empty-list-message" style="margin: 0; padding: 10px;">Nenhuma audiência agendada.</p>`;
    } else {
      container.innerHTML = audiencias
        .map((aud) => {
          const dataFormatada = getSafeDate(aud.dataHora).toLocaleString(
            "pt-BR",
            { dateStyle: "short", timeStyle: "short" }
          );
          const deleteButtonHTML = isEditing
            ? `<button class="action-icon icon-delete" data-action="delete-audiencia" data-audiencia-id="${aud.id}" title="Excluir Audiência"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>`
            : "";
          return `<div class="anexo-item"><span><strong>${dataFormatada}h</strong> - ${
            aud.local || "Local a definir"
          }</span><div class="anexo-actions">${deleteButtonHTML}</div></div>`;
        })
        .join("");
    }
  } catch (e) {
    console.error("Erro ao carregar audiências:", e);
  }
}

async function handlePageActions(e) {
  const target = e.target.closest("[data-action]");
  if (!target) return;
  e.stopPropagation();
  const action = target.dataset.action;
  const id = target.dataset.id;
  switch (action) {
    case "view-details":
    case "view-archived-details": {
      const list =
        action === "view-details"
          ? currentInvestigacoesList
          : currentArchivedList;
      const investigacao = list.find((inv) => inv.id === id);
      if (investigacao) renderUnifiedInvestigacaoModal(investigacao, false);
      break;
    }
    case "toggle-edit-mode": {
      const investigacao =
        currentInvestigacoesList.find((inv) => inv.id === id) ||
        currentArchivedList.find((inv) => inv.id === id);
      if (investigacao) {
        document.querySelector(".modal-overlay")?.remove();
        renderUnifiedInvestigacaoModal(investigacao, true);
      }
      break;
    }
    case "cancel-edit": {
      const isNew = !id;
      if (isNew) {
        document.querySelector(".modal-overlay")?.remove();
      } else {
        const investigacao =
          currentInvestigacoesList.find((inv) => inv.id === id) ||
          currentArchivedList.find((inv) => inv.id === id);
        if (investigacao) {
          document.querySelector(".modal-overlay")?.remove();
          renderUnifiedInvestigacaoModal(investigacao, false);
        }
      }
      break;
    }
    case "save-unified":
      handleSaveUnifiedModal(id);
      break;
    case "add-investigacao":
      renderUnifiedInvestigacaoModal(null, true);
      break;
    case "close-modal":
      target.closest(".modal-overlay")?.remove();
      break;
    case "view-arquivados":
      renderArquivadosModal();
      break;
    case "agendar-audiencia":
      renderAgendarAudienciaModal();
      break;
    case "close-audiencia-modal":
      target.closest(".modal-overlay")?.remove();
      break;
    case "save-audiencia":
      handleSaveAudiencia();
      break;
    case "delete-audiencia":
      handleDeleteAudiencia(target.dataset.audienciaId);
      break;
    case "delete-investigacao":
      handleDeleteInvestigacao(id);
      break;
    case "archive-investigacao":
      handleArquivarProcesso(id);
      break;
  }
}

async function renderArquivadosModal() {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `<div class="modal-content modal-large"><h3>Processos Arquivados</h3><div id="arquivados-list"><p class="empty-list-message">Carregando...</p></div><div class="form-buttons"><button data-action="close-modal" class="btn-secondary">Fechar</button></div></div>`;
  document.body.appendChild(modalOverlay);
  try {
    const snapshot = await db
      .collection("investigacoesFiscais")
      .where("status", "==", "arquivado")
      .orderBy("criadoEm", "desc")
      .get();
    currentArchivedList = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    const container = document.getElementById("arquivados-list");
    if (currentArchivedList.length === 0) {
      container.innerHTML = `<p class="empty-list-message">Nenhum processo arquivado encontrado.</p>`;
      return;
    }
    const tableRows = currentArchivedList
      .map((item) => {
        const dataAjuizamento = item.dataAjuizamento
          ? getSafeDate(item.dataAjuizamento).toLocaleDateString("pt-BR")
          : "N/D";
        return `<tr>
            <td><span class="link-like" data-action="view-archived-details" data-id="${
              item.id
            }">${formatProcessoForDisplay(item.numeroProcesso)}</span></td>
            <td>${item.suscitado}</td>
            <td>${dataAjuizamento}</td>
        </tr>`;
      })
      .join("");
    container.innerHTML = `<table class="data-table"><thead><tr><th>Nº do Processo</th><th>Suscitado</th><th>Data de Ajuizamento</th></tr></thead><tbody>${tableRows}</tbody></table>`;
  } catch (error) {
    console.error("Erro ao buscar arquivados: ", error);
  }
}

function renderAgendarAudienciaModal() {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.style.zIndex = "1001";
  modalOverlay.innerHTML = `
        <div class="modal-content">
            <h3>Agendar Audiência</h3>
            <p><strong>Processo:</strong> ${formatProcessoForDisplay(
              currentInvestigacao.numeroProcesso
            )}</p>
            <div class="form-group"><label for="aud-data">Data</label><input type="date" id="aud-data" class="form-input"></div>
            <div class="form-group"><label for="aud-hora">Hora</label><input type="time" id="aud-hora" class="form-input"></div>
            <div class="form-group"><label for="aud-local">Local</label><input type="text" id="aud-local" class="form-input"></div>
            <div id="error-message-aud"></div><div class="form-buttons">
                <button data-action="save-audiencia" class="btn-primary">Salvar</button>
                <button data-action="close-audiencia-modal" class="btn-secondary">Cancelar</button>
            </div></div>`;
  document.body.appendChild(modalOverlay);
}

async function handleSaveUnifiedModal(id) {
  const errorMsg = document.querySelector(".modal-content #error-message");
  errorMsg.textContent = "";
  const numeroProcesso = document
    .getElementById("inv-numero-processo-edit")
    .value.replace(/\D/g, "");
  const suscitante = document
    .getElementById("inv-suscitante-edit")
    .value.trim();
  const suscitado = document.getElementById("inv-suscitado-edit").value.trim();
  const dataAjuizamentoInput = document.getElementById(
    "inv-data-ajuizamento-edit"
  ).value;
  if (!numeroProcesso || !suscitante || !suscitado || !dataAjuizamentoInput) {
    errorMsg.textContent = "Preencha todos os campos cadastrais obrigatórios.";
    return;
  }
  const dataToSave = {
    numeroProcesso,
    suscitante,
    suscitado,
    descricao: document.getElementById("inv-descricao-edit").value.trim(),
    dataAjuizamento: firebase.firestore.Timestamp.fromDate(
      new Date(dataAjuizamentoInput + "T00:00:00")
    ),
    fasesStatus: {
      tutela: document.getElementById("status-tutela").value,
      audiencia: document.getElementById("status-audiencia").value,
      julgamento: document.getElementById("status-julgamento").value,
    },
    prazoRetorno: null,
  };
  let newFaseAtual = "Ajuizado";
  if (dataToSave.fasesStatus.julgamento === "feito") newFaseAtual = "Julgado";
  else if (dataToSave.fasesStatus.audiencia === "feito")
    newFaseAtual = "Aguardando audiência";
  else if (dataToSave.fasesStatus.tutela === "feito")
    newFaseAtual = "Decisão de tutela";
  dataToSave.faseAtual = newFaseAtual;
  const prazoRetornoInput = document.getElementById("andamento-prazo-retorno");
  if (prazoRetornoInput.value) {
    dataToSave.prazoRetorno = firebase.firestore.Timestamp.fromDate(
      new Date(prazoRetornoInput.value + "T00:00:00")
    );
  }
  try {
    if (id) {
      await db.collection("investigacoesFiscais").doc(id).update(dataToSave);
      showToast("Investigação atualizada com sucesso!", "success");
    } else {
      dataToSave.status = "ativo";
      dataToSave.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("investigacoesFiscais").add(dataToSave);
      showToast("Investigação cadastrada com sucesso!", "success");
    }
    document.querySelector(".modal-overlay")?.remove();
  } catch (error) {
    console.error("Erro ao salvar investigação:", error);
    errorMsg.textContent = "Erro ao salvar. Verifique o console.";
  }
}

async function handleSaveAudiencia() {
  const data = document.getElementById("aud-data").value,
    hora = document.getElementById("aud-hora").value,
    local = document.getElementById("aud-local").value.trim();
  const errorMsg = document.getElementById("error-message-aud");
  if (!data || !hora || !local) {
    errorMsg.textContent = "Todos os campos são obrigatórios.";
    return;
  }
  const dataToSave = {
    dataHora: firebase.firestore.Timestamp.fromDate(
      new Date(`${data}T${hora}`)
    ),
    local,
    investigacaoId: currentInvestigacao.id,
    numeroProcesso: currentInvestigacao.numeroProcesso,
    razaoSocialDevedor: `IF: ${currentInvestigacao.suscitado}`,
    tipo: "investigacaoFiscal",
  };
  try {
    await db.collection("audiencias").add(dataToSave);
    showToast("Audiência agendada com sucesso!", "success");
    document
      .querySelector('button[data-action="close-audiencia-modal"]')
      .closest(".modal-overlay")
      .remove();
    const audienciasContainer = document.querySelector(
      ".modal-large #if-audiencias-list"
    );
    if (audienciasContainer)
      populateAudienciasList(audienciasContainer, currentInvestigacao.id, true);
  } catch (error) {
    console.error("Erro ao salvar audiência:", error);
    errorMsg.textContent = "Erro ao salvar.";
  }
}

async function handleDeleteAudiencia(audienciaId) {
  if (!confirm("Tem certeza que deseja excluir esta audiência?")) return;
  try {
    await db.collection("audiencias").doc(audienciaId).delete();
    showToast("Audiência excluída com sucesso.", "success");
    const audienciasContainer = document.querySelector(
      ".modal-large #if-audiencias-list"
    );
    if (audienciasContainer && currentInvestigacao)
      populateAudienciasList(audienciasContainer, currentInvestigacao.id, true);
  } catch (error) {
    console.error("Erro ao excluir audiência:", error);
    showToast("Ocorreu um erro.", "error");
  }
}

async function handleDeleteInvestigacao(id) {
  if (
    !confirm(
      "Tem certeza que deseja excluir este processo de investigação? Esta ação é irreversível."
    )
  )
    return;
  try {
    await db.collection("investigacoesFiscais").doc(id).delete();
    document.querySelector(".modal-overlay")?.remove();
    showToast("Investigação excluída com sucesso.", "success");
  } catch (error) {
    console.error("Erro ao excluir investigação: ", error);
    showToast("Ocorreu um erro.", "error");
  }
}

async function handleArquivarProcesso(id) {
  if (!confirm("Tem certeza que deseja arquivar este processo?")) return;
  try {
    await db
      .collection("investigacoesFiscais")
      .doc(id)
      .update({ status: "arquivado", prazoRetorno: null });
    document.querySelector(".modal-overlay")?.remove();
    showToast("Processo arquivado com sucesso.", "success");
  } catch (error) {
    console.error("Erro ao arquivar processo: ", error);
    showToast("Ocorreu um erro.", "error");
  }
}
