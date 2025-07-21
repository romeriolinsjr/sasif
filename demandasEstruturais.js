// ==================================================================
// Módulo: demandasEstruturais.js
// Responsabilidade: Lógica da página "Demandas Estruturais".
// ==================================================================

import { db } from "./firebase.js";
import { contentArea, pageTitle, showToast } from "./ui.js";
import { devedoresCache } from "./state.js";
import { navigateTo } from "./navigation.js";

let demandasCache = [];
let activeDemandaState = {
  demandaId: null,
  devedorId: null,
  activeEixoId: null,
  isEditingEixos: false,
};

// ==================================================================
// FUNÇÕES DA PÁGINA DE LISTAGEM PRINCIPAL
// ==================================================================

export function renderDemandasEstruturaisPage() {
  pageTitle.textContent = "Demandas Estruturais";
  document.title = "SASIF | Demandas Estruturais";
  activeDemandaState = {
    demandaId: null,
    devedorId: null,
    activeEixoId: null,
    isEditingEixos: false,
  };
  document.body.removeEventListener("click", handlePageActions);
  document.body.addEventListener("click", handlePageActions);
  setupDemandasListener();
  contentArea.innerHTML = `
    <div class="dashboard-actions">
        <button data-action="add-demanda-modal" class="btn-primary">Cadastrar Nova Demanda Estrutural</button>
    </div>
    <div id="demandas-list-container">
        <p class="empty-list-message">Carregando demandas...</p>
    </div>`;
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

// ... (Funções de CRUD de Demanda permanecem as mesmas, com pequena alteração)
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
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    });
    showToast("Demanda cadastrada com sucesso!");
    document.body.removeChild(document.querySelector(".modal-overlay"));
  } catch (error) {
    document.getElementById("error-message").textContent = "Ocorreu um erro.";
  }
}
function handleDeleteDemanda(demandaId) {
  if (confirm("Tem certeza? Esta ação removerá a demanda.")) {
    db.collection("demandasEstruturais")
      .doc(demandaId)
      .delete()
      .then(() => showToast("Demanda removida com sucesso."))
      .catch(() => showToast("Ocorreu um erro.", "error"));
  }
}

// ==================================================================
// FUNÇÕES DA PÁGINA DE DETALHES
// ==================================================================

export function renderDemandaEstruturalDetailPage(demandaId, devedorId) {
  activeDemandaState = { ...activeDemandaState, demandaId, devedorId };
  const devedor = devedoresCache.find((d) => d.id === devedorId);
  const demanda = demandasCache.find((d) => d.id === demandaId);
  if (!demanda) {
    contentArea.innerHTML = "Carregando...";
    return;
  }

  pageTitle.textContent = `Detalhes: ${devedor?.razaoSocial || "..."}`;
  document.title = `SASIF | Detalhes - ${devedor?.razaoSocial || "..."}`;
  const editIconFill = activeDemandaState.isEditingEixos
    ? "var(--cor-primaria)"
    : "#555";

  contentArea.innerHTML = `
    <div class="detail-page-header"><h2>${devedor?.razaoSocial}</h2><p>CNPJ: ${
    devedor?.cnpj
  }</p></div>
    <div class="description-card"><div class="description-header"><h3>Descrição Geral da Demanda</h3><button class="action-icon" data-action="edit-descricao-geral" title="Editar Descrição"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button></div><div class="description-content ${
      demanda.descricaoGeral ? "" : "empty"
    }">${
    demanda.descricaoGeral || "Nenhuma descrição geral cadastrada."
  }</div></div>
    <div class="atores-card"><div class="atores-header"><h3>Atores Envolvidos</h3><button class="action-icon" data-action="add-ator" title="Adicionar Ator"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#4CAF50"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></button></div><div id="atores-list-container"></div></div>
    <div class="eixos-section ${
      activeDemandaState.isEditingEixos ? "edit-mode" : ""
    }"><div class="eixos-header"><h3>Eixos da Demanda</h3><div class="eixos-actions"><button class="action-icon" data-action="add-eixo" title="Adicionar Eixo"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#4CAF50"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></button><button class="action-icon" data-action="toggle-edit-eixos" title="Gerenciar Eixos"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${editIconFill}"><path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/></svg></button></div></div><div id="eixos-buttons-list" class="eixos-list"></div></div>
    <div id="eixo-content-area"></div>`;

  renderAtoresList(demanda.atores || []);
  renderEixosUI(demanda);
}

// ==================================================================
// FUNÇÕES DE LÓGICA INTERNA (Eixos, Descrições, etc.)
// ==================================================================

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
      (eixo) => `
      <button class="eixo-button ${
        eixo.id === activeDemandaState.activeEixoId ? "active" : ""
      }" data-action="select-eixo" data-eixo-id="${eixo.id}">
        ${eixo.nome}
        <span class="eixo-delete-btn" data-action="delete-eixo" data-eixo-id="${
          eixo.id
        }" data-eixo-nome="${eixo.nome}">×</span>
      </button>
    `
    )
    .join("");

  const contentContainer = document.getElementById("eixo-content-area");
  if (!contentContainer) return;

  const activeEixo = eixos.find(
    (e) => e.id === activeDemandaState.activeEixoId
  );
  if (activeEixo) {
    contentContainer.innerHTML = `
      <div class="description-card">
        <div class="description-header">
          <h3>Descrição do Eixo</h3>
          <button class="action-icon" data-action="edit-descricao-eixo" title="Editar Descrição do Eixo">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
        </div>
        <div class="description-content ${activeEixo.descricao ? "" : "empty"}">
          ${
            activeEixo.descricao ||
            "Nenhuma descrição para este eixo. Clique em editar para adicionar uma."
          }
        </div>
      </div>`;
  } else {
    contentContainer.innerHTML = `<div class="empty-list-message">Selecione ou adicione um eixo para ver os detalhes.</div>`;
  }
}

function renderDescricaoModal(title, currentText, onSave) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `
    <div class="modal-content">
      <h3 id="modal-title">${title}</h3>
      <div class="form-group">
        <textarea id="descricao-textarea" rows="10" style="width: 100%;">${currentText}</textarea>
      </div>
      <div id="error-message"></div>
      <div class="form-buttons">
        <button id="save-descricao-btn" class="btn-primary">Salvar</button>
        <button data-action="close-modal" class="btn-secondary">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(modalOverlay);
  document
    .getElementById("save-descricao-btn")
    .addEventListener("click", () => {
      const newText = document.getElementById("descricao-textarea").value;
      onSave(newText);
    });
}

async function handleSaveDescricaoGeral(newText) {
  try {
    await db
      .collection("demandasEstruturais")
      .doc(activeDemandaState.demandaId)
      .update({ descricaoGeral: newText });
    showToast("Descrição geral salva com sucesso!");
    document.body.removeChild(document.querySelector(".modal-overlay"));
  } catch (error) {
    document.getElementById("error-message").textContent =
      "Ocorreu um erro ao salvar.";
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
    showToast("Descrição do eixo salva com sucesso!");
    document.body.removeChild(document.querySelector(".modal-overlay"));
  } catch (error) {
    document.getElementById("error-message").textContent =
      "Ocorreu um erro ao salvar.";
  }
}

function renderEixoModal() {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `
    <div class="modal-content">
      <h3>Adicionar Novo Eixo</h3>
      <div class="form-group">
        <label for="eixo-name">Nome do Eixo</label>
        <input type="text" id="eixo-name" required>
      </div>
      <div id="error-message"></div>
      <div class="form-buttons">
        <button data-action="save-eixo" class="btn-primary">Salvar</button>
        <button data-action="close-modal" class="btn-secondary">Cancelar</button>
      </div>
    </div>`;
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
    const demandaRef = db
      .collection("demandasEstruturais")
      .doc(activeDemandaState.demandaId);
    await demandaRef.update({
      eixos: firebase.firestore.FieldValue.arrayUnion(novoEixo),
    });
    activeDemandaState.activeEixoId = novoEixo.id;
    showToast("Eixo adicionado com sucesso!");
    document.body.removeChild(document.querySelector(".modal-overlay"));
  } catch (error) {
    document.getElementById("error-message").textContent =
      "Ocorreu um erro ao salvar.";
  }
}

async function handleDeleteEixo(eixoId, eixoNome) {
  if (!confirm(`Tem certeza que deseja excluir o eixo "${eixoNome}"?`)) return;
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
    showToast("Eixo excluído com sucesso!");
  } catch (error) {
    showToast("Ocorreu um erro ao excluir o eixo.", "error");
  }
}

// ATUALIZADO: Funções de CRUD para Atores
function renderAtoresList(atores) {
  const container = document.getElementById("atores-list-container");
  if (!container) return;
  if (!atores || atores.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhum ator envolvido cadastrado.</p>`;
    return;
  }
  const tableRows = atores
    .map((ator, index) => {
      const isFirst = index === 0;
      const isLast = index === atores.length - 1;
      return `
        <tr>
            <td>
                <div class="order-controls">
                    <button class="order-btn" data-action="move-ator" data-ator-id="${
                      ator.id
                    }" data-direction="up" ${isFirst ? "disabled" : ""}>
                        <svg viewBox="0 0 24 24"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
                    </button>
                    <button class="order-btn" data-action="move-ator" data-ator-id="${
                      ator.id
                    }" data-direction="down" ${isLast ? "disabled" : ""}>
                        <svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
                    </button>
                </div>
            </td>
            <td>${ator.nome}</td>
            <td>${ator.representante || "-"}</td>
            <td class="actions-cell">
                <button class="action-icon icon-edit" title="Editar Ator" data-action="edit-ator" data-ator-id="${
                  ator.id
                }"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                <button class="action-icon icon-delete" title="Excluir Ator" data-action="delete-ator" data-ator-id="${
                  ator.id
                }"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
            </td>
        </tr>
    `;
    })
    .join("");
  container.innerHTML = `<table class="data-table"><thead><tr><th style="width: 100px;">Ordem</th><th>Nome da Entidade</th><th>Representante</th><th class="actions-cell">Ações</th></tr></thead><tbody>${tableRows}</tbody></table>`;
}

function renderAtorModal(ator = null) {
  const isEditing = ator !== null;
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `
        <div class="modal-content">
            <h3>${isEditing ? "Editar" : "Adicionar"} Ator</h3>
            <div class="form-group"><label for="ator-nome">Nome da Entidade</label><input type="text" id="ator-nome" value="${
              ator?.nome || ""
            }"></div>
            <div class="form-group"><label for="ator-representante">Representante</label><input type="text" id="ator-representante" value="${
              ator?.representante || ""
            }"></div>
            <div id="error-message"></div>
            <div class="form-buttons"><button data-action="save-ator" data-ator-id="${
              ator?.id || ""
            }" class="btn-primary">Salvar</button><button data-action="close-modal" class="btn-secondary">Cancelar</button></div>
        </div>`;
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
    // Editando
    atores = atores.map((ator) =>
      ator.id === atorId ? { ...ator, nome, representante } : ator
    );
  } else {
    // Adicionando
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
    showToast(`Ator ${atorId ? "atualizado" : "salvo"} com sucesso!`);
    document.body.removeChild(document.querySelector(".modal-overlay"));
  } catch (error) {
    document.getElementById("error-message").textContent =
      "Ocorreu um erro ao salvar.";
  }
}

function handleDeleteAtor(atorId) {
  if (!confirm("Tem certeza que deseja excluir este ator?")) return;
  const demanda = demandasCache.find(
    (d) => d.id === activeDemandaState.demandaId
  );
  const atoresAtualizados = (demanda.atores || []).filter(
    (ator) => ator.id !== atorId
  );
  db.collection("demandasEstruturais")
    .doc(activeDemandaState.demandaId)
    .update({ atores: atoresAtualizados })
    .then(() => showToast("Ator excluído com sucesso."))
    .catch(() => showToast("Ocorreu um erro.", "error"));
}

async function handleMoveAtor(atorId, direction) {
  const demanda = demandasCache.find(
    (d) => d.id === activeDemandaState.demandaId
  );
  let atores = [...(demanda.atores || [])];
  const index = atores.findIndex((ator) => ator.id === atorId);

  if (index === -1) return;

  if (direction === "up" && index > 0) {
    [atores[index], atores[index - 1]] = [atores[index - 1], atores[index]]; // Troca
  } else if (direction === "down" && index < atores.length - 1) {
    [atores[index], atores[index + 1]] = [atores[index + 1], atores[index]]; // Troca
  } else {
    return; // Não faz nada se já está no topo/fundo
  }

  try {
    await db
      .collection("demandasEstruturais")
      .doc(activeDemandaState.demandaId)
      .update({ atores });
    // O listener onSnapshot cuidará da re-renderização
  } catch (error) {
    showToast("Ocorreu um erro ao reordenar.", "error");
  }
}

// ==================================================================
// HANDLER DE AÇÕES GERAL
// ==================================================================
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
    // Modal Geral
    case "close-modal":
      document.body.removeChild(document.querySelector(".modal-overlay"));
      break;

    // CRUD Demandas
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

    // CRUD Eixos
    case "add-eixo":
      renderEixoModal();
      break;
    case "save-eixo":
      handleSaveEixo();
      break;
    case "toggle-edit-eixos":
      activeDemandaState.isEditingEixos = !activeDemandaState.isEditingEixos;
      renderDemandaEstruturalDetailPage(
        activeDemandaState.demandaId,
        activeDemandaState.devedorId
      );
      break;
    case "select-eixo":
      if (activeDemandaState.isEditingEixos) return;
      activeDemandaState.activeEixoId = target.dataset.eixoId;
      renderDemandaEstruturalDetailPage(
        activeDemandaState.demandaId,
        activeDemandaState.devedorId
      );
      break;
    case "delete-eixo":
      handleDeleteEixo(target.dataset.eixoId, target.dataset.eixoNome);
      break;

    // CRUD Descrições
    case "edit-descricao-geral": {
      const demanda = demandasCache.find(
        (d) => d.id === activeDemandaState.demandaId
      );
      renderDescricaoModal(
        "Editar Descrição Geral",
        demanda.descricaoGeral || "",
        handleSaveDescricaoGeral
      );
      break;
    }
    case "edit-descricao-eixo": {
      const demanda = demandasCache.find(
        (d) => d.id === activeDemandaState.demandaId
      );
      const eixo = demanda.eixos.find(
        (e) => e.id === activeDemandaState.activeEixoId
      );
      renderDescricaoModal(
        "Editar Descrição do Eixo",
        eixo.descricao || "",
        handleSaveDescricaoEixo
      );
      break;
    }

    // CRUD Atores
    case "add-ator":
      renderAtorModal();
      break;
    case "edit-ator": {
      const demanda = demandasCache.find(
        (d) => d.id === activeDemandaState.demandaId
      );
      const ator = demanda.atores.find((a) => a.id === target.dataset.atorId);
      renderAtorModal(ator);
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
  }
}
