// ==================================================================
// Módulo: configuracoes.js
// Responsabilidade: Gerenciamento das entidades de configuração (Exequentes, Motivos, Incidentes).
// ==================================================================

import { db } from "./firebase.js";
import {
  contentArea,
  pageTitle,
  showToast,
  renderReadOnlyTextModal,
} from "./ui.js";
import { navigateTo } from "./navigation.js";
import * as state from "./state.js";
import {
  formatCNPJForDisplay,
  maskCNPJ,
  formatProcessoForDisplay,
  maskProcesso,
} from "./utils.js";

/**
 * Renderiza a página principal de "Configurações" com os cards de navegação.
 */
export function renderConfiguracoesPage() {
  pageTitle.textContent = "Configurações";
  document.title = "SASIF | Configurações";

  contentArea.innerHTML = `
        <style>
            .settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; }
            .setting-card { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px 20px; background-color: white; border-radius: 8px; box-shadow: var(--sombra); cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
            .setting-card:hover { transform: translateY(-5px); box-shadow: 0 6px 12px rgba(0,0,0,0.15); }
            .setting-card h3 { margin: 0 0 10px 0; font-size: 20px; color: var(--cor-primaria); }
            .setting-card p { margin: 0; color: #555; }
        </style>
        <div class="settings-grid">
            <div class="setting-card" id="goto-exequentes"><h3>Gerenciar Exequentes</h3><p>Adicione, edite ou remova os entes exequentes.</p></div>
            <div class="setting-card" id="goto-motivos"><h3>Gerenciar Motivos de Suspensão</h3><p>Customize os motivos utilizados para suspender processos.</p></div>
            <div class="setting-card" id="goto-incidentes"><h3>Gerenciar Incidentes Processuais</h3><p>Cadastre e acompanhe processos incidentais.</p></div>
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

// ==================================================================
// SEÇÃO: GERENCIAMENTO DE EXEQUENTES
// ==================================================================
export function renderExequentesPage() {
  pageTitle.textContent = "Exequentes";
  document.title = "SASIF | Exequentes";
  contentArea.innerHTML = `<div class="dashboard-actions"><button id="add-exequente-btn" class="btn-primary">Cadastrar Novo Exequente</button><button id="back-to-config-btn" class="btn-secondary" style="margin-left: 16px;">← Voltar para Configurações</button></div><h2>Lista de Exequentes</h2><div id="exequentes-list-container"></div>`;
  document
    .getElementById("add-exequente-btn")
    .addEventListener("click", () => renderExequenteForm());
  document
    .getElementById("back-to-config-btn")
    .addEventListener("click", () => navigateTo("configuracoes"));
  renderExequentesList(state.exequentesCache);
}
function renderExequentesList(exequentes) {
  const container = document.getElementById("exequentes-list-container");
  if (!container) return;
  if (exequentes.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhum exequente cadastrado.</p>`;
    return;
  }
  let tableHTML = `<table class="data-table"><thead><tr><th class="number-cell">#</th><th>Nome</th><th>CNPJ</th><th class="actions-cell">Ações</th></tr></thead><tbody>`;
  exequentes.forEach((exequente, index) => {
    tableHTML += `<tr data-id="${exequente.id}"><td class="number-cell">${
      index + 1
    }</td><td>${exequente.nome}</td><td>${formatCNPJForDisplay(
      exequente.cnpj
    )}</td><td class="actions-cell"><button class="action-icon icon-edit" title="Editar" data-id="${
      exequente.id
    }"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button><button class="action-icon icon-delete" title="Excluir" data-id="${
      exequente.id
    }"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></td></tr>`;
  });
  tableHTML += `</tbody></table>`;
  container.innerHTML = tableHTML;
  container
    .querySelector("tbody")
    .addEventListener("click", handleExequenteAction);
}
function renderExequenteForm(exequente = null) {
  const isEditing = exequente !== null;
  navigateTo(null);
  pageTitle.textContent = isEditing
    ? "Editar Exequente"
    : "Cadastrar Novo Exequente";
  document.title = `SASIF | ${pageTitle.textContent}`;
  contentArea.innerHTML = `<div class="form-container"><div class="form-group"><label for="nome">Nome (Obrigatório)</label><input type="text" id="nome" value="${
    isEditing ? exequente.nome : ""
  }" required></div><div class="form-group"><label for="cnpj">CNPJ</label><input type="text" id="cnpj" value="${
    isEditing ? formatCNPJForDisplay(exequente.cnpj) : ""
  }" ></div><div id="error-message"></div><div class="form-buttons"><button id="save-exequente-btn" class="btn-primary">Salvar</button><button id="cancel-btn">Cancelar</button></div></div>`;
  document
    .getElementById("cnpj")
    .addEventListener("input", (e) => maskCNPJ(e.target));
  document
    .getElementById("save-exequente-btn")
    .addEventListener("click", () =>
      isEditing ? handleUpdateExequente(exequente.id) : handleSaveExequente()
    );
  document
    .getElementById("cancel-btn")
    .addEventListener("click", () => navigateTo("exequentes"));
}
function handleExequenteAction(event) {
  const button = event.target.closest(".action-icon");
  if (!button) return;
  const exequenteId = button.dataset.id;
  if (button.classList.contains("icon-delete"))
    handleDeleteExequente(exequenteId);
  else if (button.classList.contains("icon-edit")) {
    const exequente = state.exequentesCache.find((e) => e.id === exequenteId);
    if (exequente) renderExequenteForm(exequente);
  }
}
function handleSaveExequente() {
  const nome = document.getElementById("nome").value;
  if (!nome) {
    document.getElementById("error-message").textContent =
      "O nome do exequente é obrigatório.";
    return;
  }
  db.collection("exequentes")
    .add({
      nome,
      cnpj: document.getElementById("cnpj").value.replace(/\D/g, ""),
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .then(() => {
      navigateTo("exequentes");
      setTimeout(() => showToast("Exequente salvo com sucesso!"), 100);
    });
}
function handleUpdateExequente(exequenteId) {
  const nome = document.getElementById("nome").value;
  if (!nome) {
    document.getElementById("error-message").textContent =
      "O nome do exequente é obrigatório.";
    return;
  }
  db.collection("exequentes")
    .doc(exequenteId)
    .update({
      nome,
      cnpj: document.getElementById("cnpj").value.replace(/\D/g, ""),
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    })
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

// ==================================================================
// SEÇÃO: GERENCIAMENTO DE MOTIVOS DE SUSPENSÃO
// ==================================================================
export function renderMotivosPage() {
  pageTitle.textContent = "Motivos de Suspensão";
  document.title = "SASIF | Motivos de Suspensão";
  contentArea.innerHTML = `<div class="dashboard-actions"><button id="add-motivo-btn" class="btn-primary">Cadastrar Novo Motivo</button><button id="back-to-config-btn" class="btn-secondary" style="margin-left: 16px;">← Voltar para Configurações</button></div><h2>Lista de Motivos</h2><div id="motivos-list-container"></div>`;
  document
    .getElementById("add-motivo-btn")
    .addEventListener("click", () => renderMotivoForm());
  document
    .getElementById("back-to-config-btn")
    .addEventListener("click", () => navigateTo("configuracoes"));
  renderMotivosList(state.motivosSuspensaoCache);
}
function renderMotivosList(motivos) {
  const container = document.getElementById("motivos-list-container");
  if (!container) return;
  if (motivos.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhum motivo cadastrado.</p>`;
    return;
  }
  let tableHTML = `<table class="data-table"><thead><tr><th>Descrição do Motivo</th><th class="actions-cell">Ações</th></tr></thead><tbody>`;
  motivos.forEach((motivo) => {
    tableHTML += `<tr data-id="${motivo.id}"><td>${motivo.descricao}</td><td class="actions-cell"><button class="action-icon icon-edit" title="Editar" data-id="${motivo.id}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button><button class="action-icon icon-delete" title="Excluir" data-id="${motivo.id}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></td></tr>`;
  });
  tableHTML += `</tbody></table>`;
  container.innerHTML = tableHTML;
  container
    .querySelector("tbody")
    .addEventListener("click", handleMotivoAction);
}
function renderMotivoForm(motivo = null) {
  const isEditing = motivo !== null;
  navigateTo(null);
  pageTitle.textContent = isEditing ? "Editar Motivo" : "Cadastrar Novo Motivo";
  document.title = `SASIF | ${pageTitle.textContent}`;
  contentArea.innerHTML = `<div class="form-container"><div class="form-group"><label for="descricao">Descrição (Obrigatório)</label><input type="text" id="descricao" value="${
    isEditing ? motivo.descricao : ""
  }" required></div><div id="error-message"></div><div class="form-buttons"><button id="save-motivo-btn" class="btn-primary">Salvar</button><button id="cancel-btn">Cancelar</button></div></div>`;
  document
    .getElementById("save-motivo-btn")
    .addEventListener("click", () =>
      isEditing ? handleUpdateMotivo(motivo.id) : handleSaveMotivo()
    );
  document
    .getElementById("cancel-btn")
    .addEventListener("click", () => navigateTo("motivos"));
}
function handleMotivoAction(event) {
  const button = event.target.closest(".action-icon");
  if (!button) return;
  const motivoId = button.dataset.id;
  if (button.classList.contains("icon-delete")) handleDeleteMotivo(motivoId);
  else if (button.classList.contains("icon-edit")) {
    const motivo = state.motivosSuspensaoCache.find((m) => m.id === motivoId);
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
  db.collection("motivos_suspensao")
    .add({
      descricao,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    })
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
  db.collection("motivos_suspensao")
    .doc(motivoId)
    .update({
      descricao,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    })
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

// ==================================================================
// SEÇÃO: GERENCIAMENTO GERAL DE INCIDENTES
// ==================================================================
export function renderIncidentesPage() {
  pageTitle.textContent = "Incidentes Processuais";
  document.title = "SASIF | Incidentes Processuais";
  contentArea.innerHTML = `<div class="dashboard-actions"><button id="add-incidente-btn" class="btn-primary">Cadastrar Novo Incidente</button><button id="back-to-config-btn" class="btn-secondary" style="margin-left: 16px;">← Voltar para Configurações</button></div><h2>Lista de Todos os Incidentes</h2><div id="todos-incidentes-list-container"><p class="empty-list-message">Nenhum incidente cadastrado.</p></div>`;
  document
    .getElementById("add-incidente-btn")
    .addEventListener("click", () => renderIncidenteFormModal());
  document
    .getElementById("back-to-config-btn")
    .addEventListener("click", () => navigateTo("configuracoes"));
  setupTodosIncidentesListener();
}
export function renderIncidenteFormModal(incidente = null) {
  const isEditing = incidente !== null;
  const devedorOptions = [...state.devedoresCache]
    .sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial))
    .map(
      (d) =>
        `<option value="${d.id}" ${
          isEditing && incidente.devedorId === d.id ? "selected" : ""
        }>${d.razaoSocial}</option>`
    )
    .join("");
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `
        <div class="modal-content modal-large">
            <h3>${isEditing ? "Editar" : "Cadastrar"} Incidente</h3>
            <div class="form-group"><label for="incidente-devedor">Devedor Vinculado (Obrigatório)</label><select id="incidente-devedor" class="import-devedor-select" ${
              isEditing ? "disabled" : ""
            }><option value="">Selecione...</option>${devedorOptions}</select></div>
            <div class="form-group"><label for="incidente-numero">Nº do Incidente (Obrigatório)</label><input type="text" id="incidente-numero" placeholder="Formato: 0000000-00.0000.0.00.0000" value="${
              isEditing
                ? formatProcessoForDisplay(incidente.numeroIncidente)
                : ""
            }" required></div>
            <div class="form-group"><label for="incidente-processo-principal">Nº do Processo Principal (Obrigatório)</label><input type="text" id="incidente-processo-principal" placeholder="Formato: 0000000-00.0000.0.00.0000" value="${
              isEditing
                ? formatProcessoForDisplay(incidente.numeroProcessoPrincipal)
                : ""
            }" required></div>
            <div class="form-group"><label for="incidente-descricao">Descrição (Obrigatório)</label><textarea id="incidente-descricao" rows="4" required>${
              isEditing ? incidente.descricao : ""
            }</textarea></div>
            <div class="form-group"><label for="incidente-status">Status</label><select id="incidente-status" class="import-devedor-select"><option value="Em Andamento" ${
              isEditing && incidente.status === "Em Andamento" ? "selected" : ""
            }>Em Andamento</option><option value="Concluído" ${
    isEditing && incidente.status === "Concluído" ? "selected" : ""
  }>Concluído</option></select></div>
            <div id="error-message"></div>
            <div class="form-buttons"><button id="save-incidente-btn" class="btn-primary">Salvar</button><button id="cancel-incidente-btn">Cancelar</button></div>
        </div>
    `;
  document.body.appendChild(modalOverlay);
  document
    .getElementById("incidente-numero")
    .addEventListener("input", (e) => maskProcesso(e.target));
  document
    .getElementById("incidente-processo-principal")
    .addEventListener("input", (e) => maskProcesso(e.target));
  const closeModal = () => document.body.removeChild(modalOverlay);
  document
    .getElementById("save-incidente-btn")
    .addEventListener("click", () =>
      handleSaveIncidente(isEditing ? incidente.id : null)
    );
  document
    .getElementById("cancel-incidente-btn")
    .addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
}
export function handleSaveIncidente(incidenteId = null) {
  const devedorId = document.getElementById("incidente-devedor").value;
  const numeroIncidente = document
    .getElementById("incidente-numero")
    .value.replace(/\D/g, "");
  const numeroProcessoPrincipal = document
    .getElementById("incidente-processo-principal")
    .value.replace(/\D/g, "");
  const descricao = document.getElementById("incidente-descricao").value.trim();
  const status = document.getElementById("incidente-status").value;
  const errorMessage = document.getElementById("error-message");
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
    errorMessage.textContent = "Os números de processo devem ser válidos.";
    return;
  }
  const data = {
    devedorId,
    numeroIncidente,
    numeroProcessoPrincipal,
    descricao,
    status,
  };
  const promise = incidenteId
    ? db
        .collection("incidentesProcessuais")
        .doc(incidenteId)
        .update({
          ...data,
          atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        })
    : db.collection("incidentesProcessuais").add({
        ...data,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });
  promise
    .then(() => {
      showToast(
        `Incidente ${incidenteId ? "atualizado" : "salvo"} com sucesso!`
      );
      document.body.removeChild(document.querySelector(".modal-overlay"));
    })
    .catch(
      () =>
        (errorMessage.textContent = "Ocorreu um erro ao salvar o incidente.")
    );
}
function setupTodosIncidentesListener() {
  if (state.incidentesListenerUnsubscribe)
    state.incidentesListenerUnsubscribe();
  const unsubscribe = db
    .collection("incidentesProcessuais")
    .orderBy("criadoEm", "desc")
    .onSnapshot((snapshot) => {
      const incidentes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      renderTodosIncidentesList(incidentes);
    });
  state.setIncidentesListenerUnsubscribe(unsubscribe);
}
function renderTodosIncidentesList(incidentes) {
  const container = document.getElementById("todos-incidentes-list-container");
  if (!container) return;
  if (incidentes.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhum incidente cadastrado.</p>`;
    return;
  }
  let tableHTML = `<table class="data-table"><thead><tr><th>Nº do Incidente</th><th>Processo Principal</th><th>Devedor</th><th>Status</th><th class="actions-cell">Ações</th></tr></thead><tbody>`;
  incidentes.forEach((item) => {
    const devedor = state.devedoresCache.find((d) => d.id === item.devedorId);
    tableHTML += `<tr data-id="${item.id}" data-descricao="${
      item.descricao
    }"><td><a href="#" class="view-processo-link" data-action="view-details">${formatProcessoForDisplay(
      item.numeroIncidente
    )}</a></td><td>${formatProcessoForDisplay(
      item.numeroProcessoPrincipal
    )}</td><td>${
      devedor ? devedor.razaoSocial : "N/I"
    }</td><td><span class="status-badge status-${item.status
      .toLowerCase()
      .replace(" ", "-")}">${
      item.status
    }</span></td><td class="actions-cell"><button class="action-icon icon-edit" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button><button class="action-icon icon-delete" title="Excluir"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></td></tr>`;
  });
  tableHTML += `</tbody></table>`;
  container.innerHTML = tableHTML;
  container
    .querySelector(".data-table")
    ?.addEventListener("click", handleIncidenteAction);
}
export function handleIncidenteAction(event) {
  const target = event.target.closest("[data-action], .action-icon");
  if (!target) return;
  event.preventDefault();
  const row = target.closest("tr");
  if (!row) return;
  const incidenteId = row.dataset.id;
  const action =
    target.dataset.action ||
    (target.classList.contains("icon-edit") ? "edit" : "delete");
  if (action === "view-details")
    renderReadOnlyTextModal("Descrição do Incidente", row.dataset.descricao);
  else if (action === "edit") {
    db.collection("incidentesProcessuais")
      .doc(incidenteId)
      .get()
      .then((doc) => {
        if (doc.exists) renderIncidenteFormModal({ id: doc.id, ...doc.data() });
        else
          showToast("Não foi possível encontrar dados para edição.", "error");
      });
  } else if (action === "delete") handleDeleteIncidente(incidenteId);
}
function handleDeleteIncidente(incidenteId) {
  if (
    confirm(
      "Tem certeza que deseja excluir este incidente? Esta ação não pode ser desfeita."
    )
  ) {
    db.collection("incidentesProcessuais")
      .doc(incidenteId)
      .delete()
      .then(() => showToast("Incidente excluído com sucesso."))
      .catch(() =>
        showToast("Ocorreu um erro ao excluir o incidente.", "error")
      );
  }
}
