// ==================================================================
// Módulo: demandasEstruturais.js
// Responsabilidade: Lógica da página "Demandas Estruturais".
// ==================================================================

import { db, storage } from "./firebase.js";
import { contentArea, pageTitle, showToast } from "./ui.js";
import { devedoresCache } from "./state.js";
import { navigateTo } from "./navigation.js";
import { formatCNPJForDisplay, maskProcesso } from "./utils.js";

let demandasCache = [];
let activeDemandaState = {
  demandaId: null,
  devedorId: null,
  activeTab: "visaoGeral",
  activeEixoId: null,
  isEditingAtores: false,
  isEditingEixos: false,
  isEditingEventos: false,
  isEditingEncaminhamentos: false,
};

// ==================================================================
// PÁGINA DE LISTAGEM PRINCIPAL
// ==================================================================
export function renderDemandasEstruturaisPage() {
  pageTitle.textContent = "Demandas Estruturais";
  document.title = "SASIF | Demandas Estruturais";
  activeDemandaState = {
    demandaId: null,
    devedorId: null,
    activeTab: "visaoGeral",
    activeEixoId: null,
    isEditingAtores: false,
    isEditingEixos: false,
    isEditingEventos: false,
    isEditingEncaminhamentos: false,
  };
  document.body.removeEventListener("click", handlePageActions);
  document.body.addEventListener("click", handlePageActions);
  setupDemandasListener();
  contentArea.innerHTML = `<div class="dashboard-actions"><button data-action="add-demanda-modal" class="btn-primary">Cadastrar Nova Demanda Estrutural</button></div><div id="demandas-list-container"><p class="empty-list-message">Carregando...</p></div>`;
}
function setupDemandasListener() {
  db.collection("demandasEstruturais")
    .orderBy("criadoEm", "desc")
    .onSnapshot(
      (snapshot) => {
        demandasCache = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        if (activeDemandaState.demandaId) {
          renderDemandaEstruturalDetailPage(
            activeDemandaState.demandaId,
            activeDemandaState.devedorId
          );
        } else {
          renderDemandasList();
        }
      },
      (error) => {
        console.error("Erro:", error);
      }
    );
}
function renderDemandasList() {
  const container = document.getElementById("demandas-list-container");
  if (!container) return;
  if (demandasCache.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhuma demanda cadastrada.</p>`;
    return;
  }
  const sortedDemandas = [...demandasCache].sort((a, b) =>
    (
      devedoresCache.find((d) => d.id === a.devedorId)?.razaoSocial || ""
    ).localeCompare(
      devedoresCache.find((d) => d.id === b.devedorId)?.razaoSocial || ""
    )
  );
  container.innerHTML = `<table class="data-table"><thead><tr><th>#</th><th>Razão Social</th><th class="actions-cell">Ações</th></tr></thead><tbody>${sortedDemandas
    .map((demanda, index) => {
      const devedor = devedoresCache.find((d) => d.id === demanda.devedorId);
      return `<tr class="clickable-row" data-action="view-details" data-id="${
        demanda.id
      }" data-devedor-id="${demanda.devedorId}"><td class="number-cell">${
        index + 1
      }</td><td>${
        devedor?.razaoSocial || "..."
      }</td><td class="actions-cell"><button class="action-icon icon-delete" title="Excluir" data-action="delete-demanda" data-id="${
        demanda.id
      }"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></td></tr>`;
    })
    .join("")}</tbody></table>`;
}
function renderCadastroModal() {
  const devedoresJaVinculados = new Set(demandasCache.map((d) => d.devedorId));
  const devedoresElegiveis = devedoresCache
    .filter((d) => !devedoresJaVinculados.has(d.id))
    .sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial));
  if (devedoresElegiveis.length === 0) {
    showToast("Todos os Grandes Devedores já foram cadastrados.", "error");
    return;
  }
  const options = devedoresElegiveis
    .map((d) => `<option value="${d.id}">${d.razaoSocial}</option>`)
    .join("");
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `<div class="modal-content"><h3>Cadastrar Nova Demanda</h3><div class="form-group"><label for="devedor-select">Selecione o Devedor</label><select id="devedor-select"><option value="">-- Escolha --</option>${options}</select></div><div id="error-message"></div><div class="form-buttons"><button data-action="save-demanda" class="btn-primary">Salvar</button><button data-action="close-modal" class="btn-secondary">Cancelar</button></div></div>`;
  document.body.appendChild(modalOverlay);
}
async function handleSaveDemanda() {
  const devedorId = document.getElementById("devedor-select").value;
  if (!devedorId) {
    document.getElementById("error-message").textContent =
      "Selecione um devedor.";
    return;
  }
  try {
    await db.collection("demandasEstruturais").add({
      devedorId,
      descricaoGeral: "",
      eixos: [],
      atores: [],
      eventos: [],
      atosDeAudiencia: [],
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    });
    showToast("Demanda cadastrada!");
    document.body.removeChild(document.querySelector(".modal-overlay"));
  } catch (error) {
    document.getElementById("error-message").textContent = "Erro.";
  }
}
function handleDeleteDemanda(demandaId) {
  if (confirm("Tem certeza?")) {
    db.collection("demandasEstruturais")
      .doc(demandaId)
      .delete()
      .then(() => showToast("Demanda removida."))
      .catch(() => showToast("Erro.", "error"));
  }
}

// ==================================================================
// PÁGINA DE DETALHES (LAYOUT DE ABAS)
// ==================================================================
export function renderDemandaEstruturalDetailPage(demandaId, devedorId) {
  activeDemandaState = { ...activeDemandaState, demandaId, devedorId };
  const devedor = devedoresCache.find((d) => d.id === devedorId);
  pageTitle.textContent = "Demandas Estruturais";
  document.title = "SASIF | Demandas Estruturais";
  const tabs = [
    { id: "visaoGeral", name: "Visão Geral" },
    { id: "atores", name: "Atores Envolvidos" },
    { id: "historico", name: "Histórico" },
    { id: "encaminhamentos", name: "Encaminhamentos" },
    { id: "gerenciarEixos", name: "Gerenciar Eixos" },
  ];
  contentArea.innerHTML = `<div class="detail-page-header"><h2>${
    devedor?.razaoSocial || "Carregando..."
  }</h2><p>CNPJ: ${formatCNPJForDisplay(
    devedor?.cnpj
  )}</p></div><div class="detail-tabs">${tabs
    .map(
      (tab) =>
        `<button class="tab-link ${
          activeDemandaState.activeTab === tab.id ? "active" : ""
        }" data-action="select-tab" data-tab-id="${tab.id}">${
          tab.name
        }</button>`
    )
    .join(
      ""
    )}</div><div id="tab-content" class="tab-content">Carregando...</div>`;
  renderActiveTabContent();
}
function renderActiveTabContent() {
  const demanda = demandasCache.find(
    (d) => d.id === activeDemandaState.demandaId
  );
  if (!demanda) return;
  const container = document.getElementById("tab-content");
  if (!container) return;
  switch (activeDemandaState.activeTab) {
    case "visaoGeral":
      renderVisaoGeralTab(demanda);
      break;
    case "atores":
      renderAtoresTab(demanda);
      break;
    case "historico":
      renderHistoricoTab(demanda);
      break;
    case "encaminhamentos":
      renderEncaminhamentosTab(demanda);
      break;
    case "gerenciarEixos":
      renderGerenciarEixosTab(demanda);
      break;
    default:
      container.innerHTML = "Aba não encontrada.";
  }
}

// --- RENDERIZADORES DE CONTEÚDO DAS ABAS ---
function renderVisaoGeralTab(demanda) {
  const c = document.getElementById("tab-content");
  c.innerHTML = `<div class="description-card"><div class="description-header"><h3>Descrição Geral</h3><button class="action-icon" data-action="edit-descricao-geral" title="Editar"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button></div><div class="description-content ${
    demanda.descricaoGeral ? "" : "empty"
  }">${demanda.descricaoGeral || "Nenhuma descrição geral."}</div></div>`;
}
function renderAtoresTab(demanda) {
  const c = document.getElementById("tab-content");
  const fill = activeDemandaState.isEditingAtores
    ? "var(--cor-primaria)"
    : "#555";
  c.innerHTML = `<div class="atores-card ${
    activeDemandaState.isEditingAtores ? "edit-mode" : ""
  }"><div class="atores-header"><h3>Atores Envolvidos</h3><div class="eixos-actions"><button class="action-icon" data-action="add-ator" title="Adicionar"><svg viewBox="0 0 24 24" fill="#4CAF50"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></button><button class="action-icon" data-action="toggle-edit-atores" title="Gerenciar"><svg viewBox="0 0 24 24" fill="${fill}"><path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/></svg></button></div></div><div id="atores-list-container"></div></div>`;
  renderAtoresList(demanda.atores || []);
}
function renderHistoricoTab(demanda) {
  const c = document.getElementById("tab-content");
  const fill = activeDemandaState.isEditingEventos
    ? "var(--cor-primaria)"
    : "#555";
  const hasEvents = demanda.eventos && demanda.eventos.length > 0;
  c.innerHTML = `<div class="atores-card"><div class="atores-header"><h3>Histórico de Eventos</h3><div class="eixos-actions"><button class="action-icon" data-action="add-evento" title="Adicionar"><svg viewBox="0 0 24 24" fill="#4CAF50"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></button><button class="action-icon" data-action="toggle-edit-eventos" title="Gerenciar"><svg viewBox="0 0 24 24" fill="${fill}"><path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/></svg></button></div></div><div id="timeline-container" class="timeline-container ${
    activeDemandaState.isEditingEventos ? "edit-mode" : ""
  } ${hasEvents ? "" : "no-events"}"></div></div>`;
  renderTimeline(demanda.eventos || []);
}
function renderGerenciarEixosTab(demanda) {
  const c = document.getElementById("tab-content");
  const fill = activeDemandaState.isEditingEixos
    ? "var(--cor-primaria)"
    : "#555";
  c.innerHTML = `<div class="eixos-section ${
    activeDemandaState.isEditingEixos ? "edit-mode" : ""
  }"><div class="eixos-header"><h3>Eixos da Demanda</h3><div class="eixos-actions"><button class="action-icon" data-action="add-eixo" title="Adicionar"><svg viewBox="0 0 24 24" fill="#4CAF50"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></button><button class="action-icon" data-action="toggle-edit-eixos" title="Gerenciar"><svg viewBox="0 0 24 24" fill="${fill}"><path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/></svg></button></div></div><div id="eixos-buttons-list" class="eixos-list"></div></div><div id="eixo-content-area"></div>`;
  renderEixosUI(demanda);
}
function renderEncaminhamentosTab(demanda) {
  const container = document.getElementById("tab-content");
  const fill = activeDemandaState.isEditingEncaminhamentos
    ? "var(--cor-primaria)"
    : "#555";
  container.innerHTML = `<div class="atores-card"><div class="atores-header"><h3>Atos Processuais e Encaminhamentos</h3><div class="eixos-actions"><button class="action-icon" data-action="add-ato" title="Adicionar Ato Processual"><svg viewBox="0 0 24 24" fill="#4CAF50"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></button><button class="action-icon" data-action="toggle-edit-encaminhamentos" title="Gerenciar"><svg viewBox="0 0 24 24" fill="${fill}"><path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/></svg></button></div></div><div id="atos-timeline-container"></div></div>`;
  renderAtosTimeline(demanda.atosDeAudiencia || []);
}

// ==================================================================
// FUNÇÕES DE LÓGICA INTERNA
// ==================================================================
function renderAtoresList(atores) {
  const container = document.getElementById("atores-list-container");
  if (!container) return;
  if (!atores || atores.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhum ator cadastrado.</p>`;
    return;
  }
  const tableRows = atores
    .map((ator, index) => {
      const isFirst = index === 0;
      const isLast = index === atores.length - 1;
      return `<tr><td class="coluna-ordem" style="width:100px;"><div class="order-controls"><button class="order-btn" data-action="move-ator" data-ator-id="${
        ator.id
      }" data-direction="up" ${
        isFirst ? "disabled" : ""
      }><svg viewBox="0 0 24 24"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg></button><button class="order-btn" data-action="move-ator" data-ator-id="${
        ator.id
      }" data-direction="down" ${
        isLast ? "disabled" : ""
      }><svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg></button></div></td><td>${
        ator.nome
      }</td><td>${
        ator.representante || "-"
      }</td><td class="actions-cell coluna-acoes"><button class="action-icon icon-edit" title="Editar Ator" data-action="edit-ator" data-ator-id="${
        ator.id
      }"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button><button class="action-icon icon-delete" title="Excluir Ator" data-action="delete-ator" data-ator-id="${
        ator.id
      }"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></td></tr>`;
    })
    .join("");
  container.innerHTML = `<table class="data-table"><thead><tr><th class="coluna-ordem" style="width:100px;">Ordem</th><th>Nome da Entidade</th><th>Representante</th><th class="actions-cell coluna-acoes">Ações</th></tr></thead><tbody>${tableRows}</tbody></table>`;
}
function renderAtorModal(ator = null) {
  const isEditing = ator !== null;
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `<div class="modal-content"><h3>${
    isEditing ? "Editar" : "Adicionar"
  } Ator</h3><div class="form-group"><label for="ator-nome">Nome da Entidade</label><input type="text" id="ator-nome" value="${
    ator?.nome || ""
  }"></div><div class="form-group"><label for="ator-representante">Representante</label><input type="text" id="ator-representante" value="${
    ator?.representante || ""
  }"></div><div id="error-message"></div><div class="form-buttons"><button data-action="save-ator" data-ator-id="${
    ator?.id || ""
  }" class="btn-primary">Salvar</button><button data-action="close-modal" class="btn-secondary">Cancelar</button></div></div>`;
  document.body.appendChild(modalOverlay);
}
async function handleSaveAtor(atorId = null) {
  const nome = document.getElementById("ator-nome").value.trim();
  const representante = document
    .getElementById("ator-representante")
    .value.trim();
  if (!nome || !representante) {
    document.getElementById("error-message").textContent =
      "Ambos os campos são obrigatórios.";
    return;
  }
  const demanda = demandasCache.find(
    (d) => d.id === activeDemandaState.demandaId
  );
  let atores = demanda.atores || [];
  if (atorId) {
    atores = atores.map((ator) =>
      ator.id === atorId ? { ...ator, nome, representante } : ator
    );
  } else {
    const novoAtor = {
      id: `_${Math.random().toString(36).substr(2, 9)}`,
      nome,
      representante,
    };
    atores.push(novoAtor);
  }
  try {
    await db
      .collection("demandasEstruturais")
      .doc(activeDemandaState.demandaId)
      .update({ atores });
    showToast(`Ator ${atorId ? "atualizado" : "salvo"}!`);
    document.body.removeChild(document.querySelector(".modal-overlay"));
  } catch (error) {
    document.getElementById("error-message").textContent = "Erro ao salvar.";
  }
}
function handleDeleteAtor(atorId) {
  if (!confirm("Excluir este ator?")) return;
  const demanda = demandasCache.find(
    (d) => d.id === activeDemandaState.demandaId
  );
  const atoresAtualizados = (demanda.atores || []).filter(
    (ator) => ator.id !== atorId
  );
  db.collection("demandasEstruturais")
    .doc(activeDemandaState.demandaId)
    .update({ atores: atoresAtualizados })
    .then(() => showToast("Ator excluído."))
    .catch(() => showToast("Erro.", "error"));
}
async function handleMoveAtor(atorId, direction) {
  const demanda = demandasCache.find(
    (d) => d.id === activeDemandaState.demandaId
  );
  let atores = [...(demanda.atores || [])];
  const index = atores.findIndex((ator) => ator.id === atorId);
  if (index === -1) return;
  if (direction === "up" && index > 0) {
    [atores[index], atores[index - 1]] = [atores[index - 1], atores[index]];
  } else if (direction === "down" && index < atores.length - 1) {
    [atores[index], atores[index + 1]] = [atores[index + 1], atores[index]];
  } else {
    return;
  }
  try {
    await db
      .collection("demandasEstruturais")
      .doc(activeDemandaState.demandaId)
      .update({ atores });
  } catch (error) {
    showToast("Erro ao reordenar.", "error");
  }
}
function renderEixosUI(demanda) {
  const eixos = demanda.eixos || [];
  const container = document.getElementById("eixos-buttons-list");
  if (!container) return;
  if (
    eixos.length > 0 &&
    !eixos.find((e) => e.id === activeDemandaState.activeEixoId)
  ) {
    activeDemandaState.activeEixoId = eixos[0].id;
  } else if (eixos.length === 0) {
    activeDemandaState.activeEixoId = null;
  }
  container.innerHTML = eixos
    .map(
      (eixo) =>
        `<button class="eixo-button ${
          eixo.id === activeDemandaState.activeEixoId ? "active" : ""
        }" data-action="select-eixo" data-eixo-id="${eixo.id}">${
          eixo.nome
        }<span class="eixo-delete-btn" data-action="delete-eixo" data-eixo-id="${
          eixo.id
        }" data-eixo-nome="${eixo.nome}">×</span></button>`
    )
    .join("");
  const contentContainer = document.getElementById("eixo-content-area");
  if (!contentContainer) return;
  const activeEixo = eixos.find(
    (e) => e.id === activeDemandaState.activeEixoId
  );
  if (activeEixo) {
    contentContainer.innerHTML = `<div class="description-card"><div class="description-header"><h3>Descrição do Eixo</h3><button class="action-icon" data-action="edit-descricao-eixo" title="Editar Descrição"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button></div><div class="description-content ${
      activeEixo.descricao ? "" : "empty"
    }">${
      activeEixo.descricao || "Nenhuma descrição para este eixo."
    }</div></div>`;
  } else {
    contentContainer.innerHTML = `<div class="empty-list-message">Selecione ou adicione um eixo.</div>`;
  }
}
function renderDescricaoModal(title, currentText, onSave) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `<div class="modal-content"><h3 id="modal-title">${title}</h3><div class="form-group"><textarea id="descricao-textarea" rows="10" style="width: 100%;">${currentText}</textarea></div><div id="error-message"></div><div class="form-buttons"><button id="save-descricao-btn" class="btn-primary">Salvar</button><button data-action="close-modal" class="btn-secondary">Cancelar</button></div></div>`;
  document.body.appendChild(modalOverlay);
  document
    .getElementById("save-descricao-btn")
    .addEventListener("click", () => {
      onSave(document.getElementById("descricao-textarea").value);
    });
}
async function handleSaveDescricaoGeral(newText) {
  try {
    await db
      .collection("demandasEstruturais")
      .doc(activeDemandaState.demandaId)
      .update({ descricaoGeral: newText });
    showToast("Descrição salva!");
    document.body.removeChild(document.querySelector(".modal-overlay"));
  } catch (error) {
    document.getElementById("error-message").textContent = "Erro.";
  }
}
async function handleSaveDescricaoEixo(newText) {
  const demanda = demandasCache.find(
    (d) => d.id === activeDemandaState.demandaId
  );
  const eixosAtualizados = demanda.eixos.map((eixo) =>
    eixo.id === activeDemandaState.activeEixoId
      ? { ...eixo, descricao: newText }
      : eixo
  );
  try {
    await db
      .collection("demandasEstruturais")
      .doc(activeDemandaState.demandaId)
      .update({ eixos: eixosAtualizados });
    showToast("Descrição salva!");
    document.body.removeChild(document.querySelector(".modal-overlay"));
  } catch (error) {
    document.getElementById("error-message").textContent = "Erro.";
  }
}
function renderEixoModal() {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `<div class="modal-content"><h3>Adicionar Novo Eixo</h3><div class="form-group"><label for="eixo-name">Nome</label><input type="text" id="eixo-name" required></div><div id="error-message"></div><div class="form-buttons"><button data-action="save-eixo" class="btn-primary">Salvar</button><button data-action="close-modal" class="btn-secondary">Cancelar</button></div></div>`;
  document.body.appendChild(modalOverlay);
  document.getElementById("eixo-name").focus();
}
async function handleSaveEixo() {
  const nomeEixo = document.getElementById("eixo-name").value.trim();
  if (!nomeEixo) {
    document.getElementById("error-message").textContent =
      "O nome é obrigatório.";
    return;
  }
  const novoEixo = {
    id: `_${Math.random().toString(36).substr(2, 9)}`,
    nome: nomeEixo,
    descricao: "",
    criadoEm: firebase.firestore.Timestamp.now(),
  };
  try {
    await db
      .collection("demandasEstruturais")
      .doc(activeDemandaState.demandaId)
      .update({ eixos: firebase.firestore.FieldValue.arrayUnion(novoEixo) });
    activeDemandaState.activeEixoId = novoEixo.id;
    showToast("Eixo adicionado!");
    document.body.removeChild(document.querySelector(".modal-overlay"));
  } catch (error) {
    document.getElementById("error-message").textContent = "Erro.";
  }
}
async function handleDeleteEixo(eixoId, eixoNome) {
  if (!confirm(`Excluir o eixo "${eixoNome}"?`)) return;
  const demanda = demandasCache.find(
    (d) => d.id === activeDemandaState.demandaId
  );
  const eixoParaRemover = demanda.eixos.find((e) => e.id === eixoId);
  try {
    await db
      .collection("demandasEstruturais")
      .doc(activeDemandaState.demandaId)
      .update({
        eixos: firebase.firestore.FieldValue.arrayRemove(eixoParaRemover),
      });
    showToast("Eixo excluído!");
  } catch (error) {
    showToast("Erro.", "error");
  }
}
function renderTimeline(eventos) {
  const container = document.getElementById("timeline-container");
  if (!container) return;
  const sortedEventos = (eventos || []).sort(
    (a, b) => b.data.toDate() - a.data.toDate()
  );
  if (sortedEventos.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhum evento no histórico.</p>`;
    return;
  }
  container.innerHTML = sortedEventos
    .map((evento, index) => {
      const position = index % 2 === 0 ? "left" : "right";
      const dataFormatada = evento.data.toDate().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const anexoHTML = evento.anexoURL
        ? `<div class="timeline-event-footer"><a href="${evento.anexoURL}" target="_blank" class="anexo-link" title="Abrir anexo: ${evento.anexoNome}"><svg viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v11.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg><span>${evento.anexoNome}</span></a></div>`
        : "";
      return `<div class="timeline-event timeline-${position}"><div class="timeline-event-content"><div class="timeline-event-header"><h4>${evento.titulo}</h4><span class="timeline-event-tipo">${evento.tipo}</span></div><div class="timeline-event-data">${dataFormatada}</div><p class="timeline-event-descricao">${evento.descricao}</p>${anexoHTML}<div class="timeline-actions"><button class="action-icon icon-edit" title="Editar Evento" data-action="edit-evento" data-evento-id="${evento.id}"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button><button class="action-icon icon-delete" title="Excluir Evento" data-action="delete-evento" data-evento-id="${evento.id}"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></div></div></div>`;
    })
    .join("");
}
function renderEventoModal(evento = null) {
  const isEditing = evento !== null;
  const dataFormatada = evento
    ? new Date(evento.data.seconds * 1000).toISOString().split("T")[0]
    : "";
  const anexoDisplayHTML = evento?.anexoURL
    ? `<div class="current-anexo-display" id="current-anexo-display"><span>${evento.anexoNome}</span><button class="action-icon icon-delete" data-action="remove-anexo" title="Remover anexo"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></div>`
    : "";
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `<div class="modal-content modal-large"><h3>${
    isEditing ? "Editar" : "Adicionar"
  } Evento</h3><div class="form-group"><label for="evento-titulo">Título</label><input type="text" id="evento-titulo" value="${
    evento?.titulo || ""
  }"></div><div style="display:flex;gap:16px;"><div class="form-group" style="flex-grow:1;"><label for="evento-data">Data</label><input type="date" id="evento-data" value="${dataFormatada}"></div><div class="form-group" style="flex-grow:1;"><label for="evento-tipo">Tipo</label><input type="text" id="evento-tipo" value="${
    evento?.tipo || ""
  }" placeholder="Ex: Audiência, Decisão..."></div></div><div class="form-group"><label for="evento-descricao">Descrição</label><textarea id="evento-descricao" rows="5">${
    evento?.descricao || ""
  }</textarea></div><div class="form-group anexo-upload-container"><label for="evento-anexo-input">Anexar (Opcional)</label><input type="file" id="evento-anexo-input" style="width:100%; margin-top: 8px;">${anexoDisplayHTML}</div><div id="error-message"></div><div class="form-buttons"><button data-action="save-evento" data-evento-id="${
    evento?.id || ""
  }" class="btn-primary">Salvar</button><button data-action="close-modal" class="btn-secondary">Cancelar</button></div></div>`;
  document.body.appendChild(modalOverlay);
}
async function handleSaveEvento(eventoId = null) {
  const errorMsg = document.getElementById("error-message");
  errorMsg.textContent = "";
  const saveBtn = document.querySelector('[data-action="save-evento"]');
  saveBtn.disabled = true;
  saveBtn.textContent = "Salvando...";
  const fileInput = document.getElementById("evento-anexo-input");
  const file = fileInput.files[0];
  const anexoDisplay = document.getElementById("current-anexo-display");
  const anexoFoiRemovido = anexoDisplay === null;
  const demanda = demandasCache.find(
    (d) => d.id === activeDemandaState.demandaId
  );
  let eventos = demanda.eventos || [];
  const eventoExistente = eventoId
    ? eventos.find((e) => e.id === eventoId)
    : null;
  let eventoData = {
    titulo: document.getElementById("evento-titulo").value.trim(),
    dataInput: document.getElementById("evento-data").value,
    tipo: document.getElementById("evento-tipo").value.trim(),
    descricao: document.getElementById("evento-descricao").value.trim(),
    anexoURL: eventoExistente?.anexoURL || null,
    anexoNome: eventoExistente?.anexoNome || null,
  };
  if (
    !eventoData.titulo ||
    !eventoData.dataInput ||
    !eventoData.tipo ||
    !eventoData.descricao
  ) {
    errorMsg.textContent = "Todos os campos de texto são obrigatórios.";
    saveBtn.disabled = false;
    saveBtn.textContent = "Salvar";
    return;
  }
  try {
    if (file) {
      if (eventoExistente?.anexoURL) {
        await storage.refFromURL(eventoExistente.anexoURL).delete();
      }
      const anexoRef = storage.ref(
        `demandas/${demanda.id}/eventos/${
          eventoId || `_${Math.random().toString(36).substr(2, 9)}`
        }/${file.name}`
      );
      await anexoRef.put(file);
      eventoData.anexoURL = await anexoRef.getDownloadURL();
      eventoData.anexoNome = file.name;
    } else if (anexoFoiRemovido && eventoExistente?.anexoURL) {
      await storage.refFromURL(eventoExistente.anexoURL).delete();
      eventoData.anexoURL = null;
      eventoData.anexoNome = null;
    }
    const dataFinal = {
      id: eventoId || `_${Math.random().toString(36).substr(2, 9)}`,
      titulo: eventoData.titulo,
      data: firebase.firestore.Timestamp.fromDate(
        new Date(eventoData.dataInput + "T00:00:00")
      ),
      tipo: eventoData.tipo,
      descricao: eventoData.descricao,
      anexoURL: eventoData.anexoURL,
      anexoNome: eventoData.anexoNome,
    };
    if (eventoId) {
      eventos = eventos.map((e) => (e.id === eventoId ? dataFinal : e));
    } else {
      eventos.push(dataFinal);
    }
    await db
      .collection("demandasEstruturais")
      .doc(demanda.id)
      .update({ eventos });
    showToast(`Evento ${eventoId ? "atualizado" : "salvo"}!`);
    document.body.removeChild(document.querySelector(".modal-overlay"));
  } catch (error) {
    console.error("Erro:", error);
    errorMsg.textContent = "Erro ao salvar anexo.";
    saveBtn.disabled = false;
    saveBtn.textContent = "Salvar";
  }
}
async function handleDeleteEvento(eventoId) {
  if (!confirm("Excluir este evento?")) return;
  const demanda = demandasCache.find(
    (d) => d.id === activeDemandaState.demandaId
  );
  const eventoParaExcluir = (demanda.eventos || []).find(
    (e) => e.id === eventoId
  );
  if (eventoParaExcluir?.anexoURL) {
    try {
      await storage.refFromURL(eventoParaExcluir.anexoURL).delete();
    } catch (e) {
      console.warn("Anexo não encontrado.");
    }
  }
  const eventosAtualizados = (demanda.eventos || []).filter(
    (e) => e.id !== eventoId
  );
  db.collection("demandasEstruturais")
    .doc(demanda.id)
    .update({ eventos: eventosAtualizados })
    .then(() => showToast("Evento excluído."))
    .catch(() => showToast("Erro.", "error"));
}

function renderAtosTimeline(atos) {
  const container = document.getElementById("atos-timeline-container");
  if (!container) return;
  const sortedAtos = (atos || []).sort(
    (a, b) => b.data.toDate() - a.data.toDate()
  );
  if (sortedAtos.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhum ato processual cadastrado.</p>`;
    return;
  }
  const isEditing = activeDemandaState.isEditingEncaminhamentos;
  container.innerHTML = sortedAtos
    .map((ato, index) => {
      const position = index % 2 === 0 ? "left" : "right";
      const dataFormatada = ato.data.toDate().toLocaleDateString("pt-BR");
      return `<div class="timeline-event timeline-${position}"><div id="${
        ato.id
      }" class="timeline-event-content ${
        isEditing ? "edit-mode" : ""
      }"><div class="audiencia-card-header"><h4>Ato Processual</h4><div class="timeline-actions"><button class="action-icon icon-edit" title="Editar Ato" data-action="edit-ato" data-ato-id="${
        ato.id
      }"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button><button class="action-icon icon-delete" title="Excluir Ato" data-action="delete-ato" data-ato-id="${
        ato.id
      }"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></div></div><div class="audiencia-card-info"><span><strong>Processo:</strong> ${
        ato.processoNumero
      }</span><span><strong>Data:</strong> ${dataFormatada}</span><span><strong>Hora:</strong> ${
        ato.hora
      }</span></div><div class="encaminhamentos-header"><h5>Encaminhamentos</h5><button class="action-icon" data-action="add-encaminhamento" data-ato-id="${
        ato.id
      }" title="Adicionar Encaminhamento"><svg viewBox="0 0 24 24" fill="#4CAF50"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></button></div><div id="encaminhamentos-list-${
        ato.id
      }"></div></div></div>`;
    })
    .join("");
  sortedAtos.forEach((ato) =>
    renderEncaminhamentosList(ato.id, ato.encaminhamentos || [])
  );
}
function renderEncaminhamentosList(atoId, encaminhamentos) {
  const container = document.getElementById(`encaminhamentos-list-${atoId}`);
  if (!container) return;
  if (encaminhamentos.length === 0) {
    container.innerHTML = `<p style="font-size:14px; text-align:center; padding:10px;">Nenhum encaminhamento.</p>`;
    return;
  }
  const demanda = demandasCache.find(
    (d) => d.id === activeDemandaState.demandaId
  );
  const isEditing = activeDemandaState.isEditingEncaminhamentos;
  const tableRows = encaminhamentos
    .map((enc) => {
      const ator = (demanda.atores || []).find((a) => a.id === enc.entidadeId);
      const actionsCell = isEditing
        ? `<td class="actions-cell"><button class="action-icon icon-edit" title="Editar" data-action="edit-encaminhamento" data-ato-id="${atoId}" data-enc-id="${enc.id}"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button><button class="action-icon icon-delete" title="Excluir" data-action="delete-encaminhamento" data-ato-id="${atoId}" data-enc-id="${enc.id}"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></td>`
        : "";

      return `<tr class="${
        enc.status === "cumprido" ? "encaminhamento-cumprido" : ""
      }"><td style="width: 40px;"><input type="checkbox" class="status-checkbox" data-action="toggle-encaminhamento-status" data-ato-id="${atoId}" data-enc-id="${
        enc.id
      }" ${enc.status === "cumprido" ? "checked" : ""}></td><td><strong>${
        ator?.nome || "Entidade não encontrada"
      }</strong><br><span style="font-size:13px; color:#555;">${
        enc.descricao
      }</span></td><td>${enc.prazo}</td>${actionsCell}</tr>`;
    })
    .join("");

  const headerActionsCell = isEditing
    ? `<th class="actions-cell">Ações</th>`
    : "";
  container.innerHTML = `<table class="encaminhamentos-table"><thead><tr><th style="width:40px;">Status</th><th>Descrição</th><th>Prazo</th>${headerActionsCell}</tr></thead><tbody>${tableRows}</tbody></table>`;
}
function renderAtoModal(ato = null) {
  const isEditing = ato !== null;
  const dataFormatada = ato
    ? new Date(ato.data.seconds * 1000).toISOString().split("T")[0]
    : "";
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `<div class="modal-content modal-large"><h3>${
    isEditing ? "Editar" : "Adicionar"
  } Ato Processual</h3><div class="form-group"><label for="ato-processo">Nº do Processo</label><input type="text" id="ato-processo" value="${
    ato?.processoNumero || ""
  }"></div><div style="display:flex;gap:16px;"><div class="form-group" style="flex:1;"><label for="ato-data">Data</label><input type="date" id="ato-data" value="${dataFormatada}"></div><div class="form-group" style="flex:1;"><label for="ato-hora">Hora</label><input type="time" id="ato-hora" value="${
    ato?.hora || ""
  }"></div></div><div class="form-group"><label for="ato-descricao">Descrição (Opcional)</label><textarea id="ato-descricao" rows="3">${
    ato?.descricao || ""
  }</textarea></div><div id="error-message"></div><div class="form-buttons"><button data-action="save-ato" data-ato-id="${
    ato?.id || ""
  }" class="btn-primary">Salvar</button><button data-action="close-modal" class="btn-secondary">Cancelar</button></div></div>`;
  document.body.appendChild(modalOverlay);

  const processoInput = document.getElementById("ato-processo");
  if (processoInput) {
    processoInput.addEventListener("input", (e) => {
      maskProcesso(e.target); // <-- MUDANÇA PRINCIPAL AQUI
    });
  }
}
async function handleSaveAto(atoId = null) {
  const processoNumero = document.getElementById("ato-processo").value.trim();
  const dataInput = document.getElementById("ato-data").value;
  const hora = document.getElementById("ato-hora").value.trim();
  const descricao = document.getElementById("ato-descricao").value.trim();
  if (!processoNumero || !dataInput || !hora) {
    document.getElementById("error-message").textContent =
      "Processo, Data e Hora são obrigatórios.";
    return;
  }
  const data = firebase.firestore.Timestamp.fromDate(
    new Date(dataInput + "T00:00:00")
  );
  const demanda = demandasCache.find(
    (d) => d.id === activeDemandaState.demandaId
  );
  let atos = demanda.atosDeAudiencia || [];
  if (atoId) {
    atos = atos.map((a) =>
      a.id === atoId ? { ...a, processoNumero, data, hora, descricao } : a
    );
  } else {
    const novoAto = {
      id: `_${Math.random().toString(36).substr(2, 9)}`,
      processoNumero,
      data,
      hora,
      descricao,
      encaminhamentos: [],
    };
    atos.push(novoAto);
  }
  try {
    await db
      .collection("demandasEstruturais")
      .doc(demanda.id)
      .update({ atosDeAudiencia: atos });
    showToast(`Ato ${atoId ? "atualizado" : "salvo"}!`);
    document.body.removeChild(document.querySelector(".modal-overlay"));
  } catch (e) {
    document.getElementById("error-message").textContent = "Erro ao salvar.";
  }
}
async function handleDeleteAto(atoId) {
  if (!confirm("Excluir este ato e todos os seus encaminhamentos?")) return;
  const demanda = demandasCache.find(
    (d) => d.id === activeDemandaState.demandaId
  );
  const atosAtualizados = (demanda.atosDeAudiencia || []).filter(
    (a) => a.id !== atoId
  );
  try {
    await db
      .collection("demandasEstruturais")
      .doc(demanda.id)
      .update({ atosDeAudiencia: atosAtualizados });
    showToast("Ato excluído!");
  } catch (e) {
    showToast("Erro.", "error");
  }
}
function renderEncaminhamentoModal(atoId, encaminhamento = null) {
  const isEditing = encaminhamento !== null;
  const demanda = demandasCache.find(
    (d) => d.id === activeDemandaState.demandaId
  );
  const atoresOptions = (demanda.atores || [])
    .map(
      (ator) =>
        `<option value="${ator.id}" ${
          encaminhamento?.entidadeId === ator.id ? "selected" : ""
        }>${ator.nome}</option>`
    )
    .join("");
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `<div class="modal-content"><h3>${
    isEditing ? "Editar" : "Adicionar"
  } Encaminhamento</h3><div class="form-group"><label for="enc-entidade">Entidade Responsável</label><select id="enc-entidade"><option value="">-- Selecione --</option>${atoresOptions}</select></div><div class="form-group"><label for="enc-pessoa">Pessoa (Opcional)</label><input type="text" id="enc-pessoa" value="${
    encaminhamento?.pessoa || ""
  }"></div><div class="form-group"><label for="enc-prazo">Prazo</label><input type="text" id="enc-prazo" value="${
    encaminhamento?.prazo || ""
  }"></div><div class="form-group"><label for="enc-descricao">Descrição</label><textarea id="enc-descricao" rows="4">${
    encaminhamento?.descricao || ""
  }</textarea></div><div id="error-message"></div><div class="form-buttons"><button data-action="save-encaminhamento" data-ato-id="${atoId}" data-enc-id="${
    encaminhamento?.id || ""
  }" class="btn-primary">Salvar</button><button data-action="close-modal" class="btn-secondary">Cancelar</button></div></div>`;
  document.body.appendChild(modalOverlay);
}
async function handleSaveEncaminhamento(atoId, encId = null) {
  const entidadeId = document.getElementById("enc-entidade").value;
  const pessoa = document.getElementById("enc-pessoa").value.trim();
  const prazo = document.getElementById("enc-prazo").value.trim();
  const descricao = document.getElementById("enc-descricao").value.trim();
  if (!entidadeId || !prazo || !descricao) {
    document.getElementById("error-message").textContent =
      "Entidade, Prazo e Descrição são obrigatórios.";
    return;
  }
  const demanda = demandasCache.find(
    (d) => d.id === activeDemandaState.demandaId
  );
  const atos = demanda.atosDeAudiencia || [];
  const atoIndex = atos.findIndex((a) => a.id === atoId);
  if (atoIndex === -1) return;
  let encaminhamentos = atos[atoIndex].encaminhamentos || [];
  if (encId) {
    encaminhamentos = encaminhamentos.map((enc) =>
      enc.id === encId ? { ...enc, entidadeId, pessoa, prazo, descricao } : enc
    );
  } else {
    const novoEnc = {
      id: `_${Math.random().toString(36).substr(2, 9)}`,
      entidadeId,
      pessoa,
      prazo,
      descricao,
      status: "pendente",
    };
    encaminhamentos.push(novoEnc);
  }
  atos[atoIndex].encaminhamentos = encaminhamentos;
  try {
    await db
      .collection("demandasEstruturais")
      .doc(demanda.id)
      .update({ atosDeAudiencia: atos });
    showToast(`Encaminhamento ${encId ? "atualizado" : "salvo"}!`);
    document.body.removeChild(document.querySelector(".modal-overlay"));
  } catch (e) {
    document.getElementById("error-message").textContent = "Erro ao salvar.";
  }
}
async function handleDeleteEncaminhamento(atoId, encId) {
  if (!confirm("Excluir este encaminhamento?")) return;
  const demanda = demandasCache.find(
    (d) => d.id === activeDemandaState.demandaId
  );
  const atos = demanda.atosDeAudiencia || [];
  const atoIndex = atos.findIndex((a) => a.id === atoId);
  if (atoIndex === -1) return;
  atos[atoIndex].encaminhamentos = (
    atos[atoIndex].encaminhamentos || []
  ).filter((enc) => enc.id !== encId);
  try {
    await db
      .collection("demandasEstruturais")
      .doc(demanda.id)
      .update({ atosDeAudiencia: atos });
    showToast("Encaminhamento excluído!");
  } catch (e) {
    showToast("Erro.", "error");
  }
}
async function handleToggleEncaminhamentoStatus(atoId, encId) {
  const demanda = demandasCache.find(
    (d) => d.id === activeDemandaState.demandaId
  );
  const atos = demanda.atosDeAudiencia || [];
  const atoIndex = atos.findIndex((a) => a.id === atoId);
  if (atoIndex === -1) return;
  atos[atoIndex].encaminhamentos = (atos[atoIndex].encaminhamentos || []).map(
    (enc) => {
      if (enc.id === encId) {
        return {
          ...enc,
          status: enc.status === "pendente" ? "cumprido" : "pendente",
        };
      }
      return enc;
    }
  );
  try {
    await db
      .collection("demandasEstruturais")
      .doc(demanda.id)
      .update({ atosDeAudiencia: atos });
  } catch (e) {
    showToast("Erro ao atualizar status.", "error");
  }
}

// ==================================================================
// HANDLER DE AÇÕES GERAL
// ==================================================================
function handlePageActions(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (action !== "view-details") event.preventDefault();
  if (
    ["delete-eixo", "delete-demanda", "delete-ator", "move-ator"].includes(
      action
    )
  )
    event.stopPropagation();
  switch (action) {
    case "close-modal":
      document.body.removeChild(document.querySelector(".modal-overlay"));
      break;
    case "select-tab":
      activeDemandaState.activeTab = target.dataset.tabId;
      renderDemandaEstruturalDetailPage(
        activeDemandaState.demandaId,
        activeDemandaState.devedorId
      );
      break;
    case "add-demanda-modal":
      renderCadastroModal();
      break;
    case "save-demanda":
      handleSaveDemanda();
      break;
    case "delete-demanda":
      handleDeleteDemanda(target.dataset.id);
      break;
    case "view-details":
      navigateTo("demandaEstruturalDetail", {
        id: target.dataset.id,
        devedorId: target.dataset.devedorId,
      });
      break;
    case "add-eixo":
      renderEixoModal();
      break;
    case "save-eixo":
      handleSaveEixo();
      break;
    case "toggle-edit-eixos":
      activeDemandaState.isEditingEixos = !activeDemandaState.isEditingEixos;
      renderActiveTabContent();
      break;
    case "select-eixo":
      if (activeDemandaState.isEditingEixos) return;
      activeDemandaState.activeEixoId = target.dataset.eixoId;
      renderActiveTabContent();
      break;
    case "delete-eixo":
      handleDeleteEixo(target.dataset.eixoId, target.dataset.eixoNome);
      break;
    case "edit-descricao-geral": {
      const d = demandasCache.find(
        (d) => d.id === activeDemandaState.demandaId
      );
      renderDescricaoModal(
        "Editar Descrição Geral",
        d.descricaoGeral || "",
        handleSaveDescricaoGeral
      );
      break;
    }
    case "edit-descricao-eixo": {
      const d = demandasCache.find(
        (d) => d.id === activeDemandaState.demandaId
      );
      const e = d.eixos.find((e) => e.id === activeDemandaState.activeEixoId);
      renderDescricaoModal(
        "Editar Descrição do Eixo",
        e.descricao || "",
        handleSaveDescricaoEixo
      );
      break;
    }
    case "add-ator":
      renderAtorModal();
      break;
    case "edit-ator": {
      const d = demandasCache.find(
        (d) => d.id === activeDemandaState.demandaId
      );
      const a = d.atores.find((a) => a.id === target.dataset.atorId);
      renderAtorModal(a);
      break;
    }
    case "save-ator":
      handleSaveAtor(target.dataset.atorId);
      break;
    case "delete-ator":
      handleDeleteAtor(target.dataset.atorId);
      break;
    case "move-ator":
      handleMoveAtor(target.dataset.atorId, target.dataset.direction);
      break;
    case "toggle-edit-atores":
      activeDemandaState.isEditingAtores = !activeDemandaState.isEditingAtores;
      renderActiveTabContent();
      break;
    case "add-evento":
      renderEventoModal();
      break;
    case "edit-evento": {
      const d = demandasCache.find(
        (d) => d.id === activeDemandaState.demandaId
      );
      const e = d.eventos.find((e) => e.id === target.dataset.eventoId);
      renderEventoModal(e);
      break;
    }
    case "save-evento":
      handleSaveEvento(target.dataset.eventoId);
      break;
    case "delete-evento":
      handleDeleteEvento(target.dataset.eventoId);
      break;
    case "toggle-edit-eventos":
      activeDemandaState.isEditingEventos =
        !activeDemandaState.isEditingEventos;
      renderActiveTabContent();
      break;
    case "remove-anexo": {
      const anexoDisplay = document.getElementById("current-anexo-display");
      if (anexoDisplay) anexoDisplay.remove();
      break;
    }
    case "toggle-edit-encaminhamentos":
      activeDemandaState.isEditingEncaminhamentos =
        !activeDemandaState.isEditingEncaminhamentos;
      renderActiveTabContent();
      break;
    // Encaminhamentos
    case "add-ato":
      renderAtoModal();
      break;
    case "save-ato":
      handleSaveAto(target.dataset.atoId);
      break;
    case "edit-ato": {
      const d = demandasCache.find(
        (d) => d.id === activeDemandaState.demandaId
      );
      const a = d.atosDeAudiencia.find((a) => a.id === target.dataset.atoId);
      renderAtoModal(a);
      break;
    }
    case "delete-ato":
      handleDeleteAto(target.dataset.atoId);
      break;
    case "add-encaminhamento":
      renderEncaminhamentoModal(target.dataset.atoId);
      break;
    case "edit-encaminhamento": {
      const d = demandasCache.find(
        (d) => d.id === activeDemandaState.demandaId
      );
      const a = d.atosDeAudiencia.find((a) => a.id === target.dataset.atoId);
      const e = a.encaminhamentos.find(
        (enc) => enc.id === target.dataset.encId
      );
      renderEncaminhamentoModal(target.dataset.atoId, e);
      break;
    }
    case "save-encaminhamento":
      handleSaveEncaminhamento(target.dataset.atoId, target.dataset.encId);
      break;
    case "delete-encaminhamento":
      handleDeleteEncaminhamento(target.dataset.atoId, target.dataset.encId);
      break;
    case "toggle-encaminhamento-status":
      handleToggleEncaminhamentoStatus(
        target.dataset.atoId,
        target.dataset.encId
      );
      break;
  }
}
