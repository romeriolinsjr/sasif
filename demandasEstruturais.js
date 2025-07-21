// ==================================================================
// Módulo: demandasEstruturais.js
// Responsabilidade: Lógica da página "Demandas Estruturais".
// ==================================================================

import { db, storage } from "./firebase.js";
import { contentArea, pageTitle, showToast } from "./ui.js";
import { devedoresCache } from "./state.js";
import { navigateTo } from "./navigation.js";

let demandasCache = [];
let activeDemandaState = {
  demandaId: null,
  devedorId: null,
  activeTab: "visaoGeral",
  activeEixoId: null,
  isEditingAtores: false,
  isEditingEixos: false,
  isEditingEventos: false,
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
  };
  document.body.removeEventListener("click", handlePageActions);
  document.body.addEventListener("click", handlePageActions);
  setupDemandasListener();
  contentArea.innerHTML = `<div class="dashboard-actions"><button data-action="add-demanda-modal" class="btn-primary">Cadastrar Nova Demanda Estrutural</button></div><div id="demandas-list-container"><p class="empty-list-message">Carregando demandas...</p></div>`;
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
        console.error("Erro ao buscar demandas:", error);
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
    await db
      .collection("demandasEstruturais")
      .add({
        devedorId,
        descricaoGeral: "",
        eixos: [],
        atores: [],
        eventos: [],
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });
    showToast("Demanda cadastrada com sucesso!");
    document.body.removeChild(document.querySelector(".modal-overlay"));
  } catch (error) {
    document.getElementById("error-message").textContent = "Ocorreu um erro.";
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
    { id: "historico", name: "Histórico de Eventos" },
    { id: "gerenciarEixos", name: "Gerenciar Eixos" },
  ];
  contentArea.innerHTML = `<div class="detail-page-header"><h2>${
    devedor?.razaoSocial
  }</h2><p>CNPJ: ${devedor?.cnpj}</p></div><div class="detail-tabs">${tabs
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
    case "gerenciarEixos":
      renderGerenciarEixosTab(demanda);
      break;
    default:
      container.innerHTML = "Aba não encontrada.";
  }
}

// --- RENDERIZADORES DE CONTEÚDO DAS ABAS ---
function renderVisaoGeralTab(demanda) {
  const container = document.getElementById("tab-content");
  container.innerHTML = `<div class="description-card"><div class="description-header"><h3>Descrição Geral da Demanda</h3><button class="action-icon" data-action="edit-descricao-geral" title="Editar Descrição"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button></div><div class="description-content ${
    demanda.descricaoGeral ? "" : "empty"
  }">${
    demanda.descricaoGeral || "Nenhuma descrição geral cadastrada."
  }</div></div><p class="empty-list-message">Outras informações de visão geral podem ser adicionadas aqui no futuro.</p>`;
}
function renderAtoresTab(demanda) {
  const container = document.getElementById("tab-content");
  const editAtoresIconFill = activeDemandaState.isEditingAtores
    ? "var(--cor-primaria)"
    : "#555";
  container.innerHTML = `<div class="atores-card ${
    activeDemandaState.isEditingAtores ? "edit-mode" : ""
  }"><div class="atores-header"><h3>Atores Envolvidos</h3><div class="eixos-actions"><button class="action-icon" data-action="add-ator" title="Adicionar Ator"><svg viewBox="0 0 24 24" fill="#4CAF50"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></button><button class="action-icon" data-action="toggle-edit-atores" title="Gerenciar Atores"><svg viewBox="0 0 24 24" fill="${editAtoresIconFill}"><path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/></svg></button></div></div><div id="atores-list-container"></div></div>`;
  renderAtoresList(demanda.atores || []);
}
function renderHistoricoTab(demanda) {
  const container = document.getElementById("tab-content");
  const editEventosIconFill = activeDemandaState.isEditingEventos
    ? "var(--cor-primaria)"
    : "#555";
  const hasEvents = demanda.eventos && demanda.eventos.length > 0;
  container.innerHTML = `<div class="atores-card"><div class="atores-header"><h3>Histórico de Eventos</h3><div class="eixos-actions"><button class="action-icon" data-action="add-evento" title="Adicionar Evento"><svg viewBox="0 0 24 24" fill="#4CAF50"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></button><button class="action-icon" data-action="toggle-edit-eventos" title="Gerenciar Eventos"><svg viewBox="0 0 24 24" fill="${editEventosIconFill}"><path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/></svg></button></div></div><div id="timeline-container" class="timeline-container ${
    activeDemandaState.isEditingEventos ? "edit-mode" : ""
  } ${hasEvents ? "" : "no-events"}"></div></div>`;
  renderTimeline(demanda.eventos || []);
}
function renderGerenciarEixosTab(demanda) {
  const container = document.getElementById("tab-content");
  const editEixosIconFill = activeDemandaState.isEditingEixos
    ? "var(--cor-primaria)"
    : "#555";
  container.innerHTML = `<div class="eixos-section ${
    activeDemandaState.isEditingEixos ? "edit-mode" : ""
  }"><div class="eixos-header"><h3>Eixos da Demanda</h3><div class="eixos-actions"><button class="action-icon" data-action="add-eixo" title="Adicionar Eixo"><svg viewBox="0 0 24 24" fill="#4CAF50"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></button><button class="action-icon" data-action="toggle-edit-eixos" title="Gerenciar Eixos"><svg viewBox="0 0 24 24" fill="${editEixosIconFill}"><path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/></svg></button></div></div><div id="eixos-buttons-list" class="eixos-list"></div></div><div id="eixo-content-area"></div>`;
  renderEixosUI(demanda);
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
      const dataFormatada = evento.data
        .toDate()
        .toLocaleDateString("pt-BR", {
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
    ? `<div class="current-anexo-display" id="current-anexo-display"><span>${evento.anexoNome}</span><button class="action-icon icon-delete" data-action="remove-anexo" title="Remover anexo existente"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></div>`
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
  }</textarea></div><div class="form-group anexo-upload-container"><label for="evento-anexo-input">Anexar Documento (Opcional)</label><input type="file" id="evento-anexo-input" style="width:100%; margin-top: 8px;">${anexoDisplayHTML}</div><div id="error-message"></div><div class="form-buttons"><button data-action="save-evento" data-evento-id="${
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
    console.error("Erro ao salvar evento:", error);
    errorMsg.textContent = "Ocorreu um erro ao salvar o anexo.";
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
  }
}
