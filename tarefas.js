// ==================================================================
// Módulo: tarefas.js
// Responsabilidade: Lógica da página "Tarefas do Mês".
// ==================================================================

import { db, auth } from "./firebase.js";
import { contentArea, pageTitle, showToast } from "./ui.js";
import * as state from "./state.js";
import { formatProcessoForDisplay, maskProcesso } from "./utils.js";

/**
 * Renderiza a estrutura principal da página de Tarefas do Mês.
 * @param {Date} date - A data (mês e ano) a ser exibida.
 */
export function renderDiligenciasPage(date = new Date()) {
  state.setCurrentTasksPageDate(date); // Atualiza a data global

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
<div class="month-title">${
    mesAtual.charAt(0).toUpperCase() + mesAtual.slice(1)
  }</div>
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
    .addEventListener("click", () => renderDiligenciaFormModal());
  document
    .getElementById("prev-month-btn")
    .addEventListener("click", () => renderDiligenciasPage(mesAnterior));
  if (!desabilitarProximo) {
    document
      .getElementById("next-month-btn")
      .addEventListener("click", () => renderDiligenciasPage(mesSeguinte));
  }

  // Garante que o listener seja anexado apenas uma vez
  contentArea.removeEventListener("click", handleDiligenciaAction);
  contentArea.addEventListener("click", handleDiligenciaAction);

  setupDiligenciasListener(date);
}

/**
 * Renderiza o modal para adicionar ou editar uma tarefa.
 * @param {object|null} diligencia - O objeto da tarefa para edição, ou null para criação.
 */
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

  modalOverlay.innerHTML = `
    <div class="modal-content modal-large" data-mes-referencia="${state.currentTasksPageDate.toISOString()}">
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
    .addEventListener("click", () =>
      handleSaveDiligencia(
        isEditing ? diligencia.id : null,
        isEditing ? diligencia : null
      )
    );
  document
    .getElementById("cancel-diligencia-btn")
    .addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
}

/**
 * Salva a tarefa (nova ou editada) no banco de dados.
 */
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

  // Lógica para editar tarefa recorrente (bifurcação)
  if (diligenciaId && diligenciaOriginal && diligenciaOriginal.isRecorrente) {
    if (
      confirm(
        "Você está editando uma tarefa recorrente. As alterações serão aplicadas a partir deste mês, preservando o histórico anterior. Deseja continuar?"
      )
    ) {
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

      const { id, ...dadosDaTarefaOriginalSemId } = diligenciaOriginal;
      const newTaskRef = db.collection("diligenciasMensais").doc();
      const novaTarefaData = {
        ...dadosDaTarefaOriginalSemId,
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
        errorMessage.textContent = "Ocorreu um erro ao atualizar a tarefa.";
      }
    }
    return;
  }

  // Lógica para novas tarefas ou edição de tarefas únicas
  const data = {
    titulo,
    dataAlvo: firebase.firestore.Timestamp.fromDate(dataAlvo),
    isRecorrente,
    processoVinculado: processoVinculado || null,
    descricao,
    userId: auth.currentUser.uid,
  };

  if (diligenciaId) {
    // Editando
    data.atualizadoEm = firebase.firestore.FieldValue.serverTimestamp();
    db.collection("diligenciasMensais")
      .doc(diligenciaId)
      .update(data)
      .then(() => {
        showToast(`Tarefa atualizada com sucesso!`);
        document.body.removeChild(document.querySelector(".modal-overlay"));
      })
      .catch(
        (error) =>
          (errorMessage.textContent = "Ocorreu um erro ao salvar a tarefa.")
      );
  } else {
    // Criando
    data.historicoCumprimentos = {};
    const mesDeCriacao = state.currentTasksPageDate;
    data.criadoEm = firebase.firestore.Timestamp.fromDate(
      new Date(mesDeCriacao.getFullYear(), mesDeCriacao.getMonth(), 1)
    );
    db.collection("diligenciasMensais")
      .add(data)
      .then(() => {
        showToast(`Tarefa salva com sucesso!`);
        document.body.removeChild(document.querySelector(".modal-overlay"));
      })
      .catch(
        (error) =>
          (errorMessage.textContent = "Ocorreu um erro ao salvar a tarefa.")
      );
  }
}

/**
 * Configura o listener do Firebase para buscar as tarefas do usuário.
 */
function setupDiligenciasListener(date) {
  if (state.diligenciasListenerUnsubscribe)
    state.diligenciasListenerUnsubscribe();

  const userId = auth.currentUser.uid;
  const unsubscribe = db
    .collection("diligenciasMensais")
    .where("userId", "==", userId)
    .orderBy("dataAlvo")
    .onSnapshot(
      (snapshot) => {
        const diligencias = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        state.setDiligenciasCache(diligencias);
        renderDiligenciasList(diligencias, date); // Passa a data para a função de renderização
      },
      (error) => {
        console.error("Erro detalhado do Firebase:", error);
        const container = document.getElementById("diligencias-list-container");
        if (container)
          container.innerHTML = `<p class="empty-list-message">Ocorreu um erro ao carregar as tarefas.</p>`;
      }
    );
  state.setDiligenciasListenerUnsubscribe(unsubscribe);
}

/**
 * Renderiza a lista de tarefas para o mês selecionado.
 */
function renderDiligenciasList(diligencias, date) {
  const container = document.getElementById("diligencias-list-container");
  if (!container) return;

  const anoMesSelecionado = `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
  const inicioDoMesVisivel = new Date(date.getFullYear(), date.getMonth(), 1);

  const tarefasDoMes = diligencias.filter((item) => {
    if (!item.dataAlvo) return false;
    const inicioDaVigencia = item.criadoEm
      ? new Date(
          item.criadoEm.toDate().getFullYear(),
          item.criadoEm.toDate().getMonth(),
          1
        )
      : new Date(1970, 0, 1);
    if (inicioDoMesVisivel < inicioDaVigencia) return false;
    if (
      item.recorrenciaTerminaEm &&
      inicioDoMesVisivel > item.recorrenciaTerminaEm.toDate()
    )
      return false;
    if (item.isRecorrente) return true;
    const dataAlvoTarefa = new Date(item.dataAlvo.seconds * 1000);
    return (
      dataAlvoTarefa.getFullYear() === date.getFullYear() &&
      dataAlvoTarefa.getMonth() === date.getMonth()
    );
  });

  tarefasDoMes.sort((a, b) => {
    const dataA = a.isRecorrente
      ? new Date(
          date.getFullYear(),
          date.getMonth(),
          new Date(a.dataAlvo.seconds * 1000).getUTCDate()
        )
      : new Date(a.dataAlvo.seconds * 1000);
    const dataB = b.isRecorrente
      ? new Date(
          date.getFullYear(),
          date.getMonth(),
          new Date(b.dataAlvo.seconds * 1000).getUTCDate()
        )
      : new Date(b.dataAlvo.seconds * 1000);
    return dataA - dataB;
  });

  if (tarefasDoMes.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhuma tarefa para este mês.</p>`;
    return;
  }

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
    const dataAlvoFormatada = item.isRecorrente
      ? `${String(dataAlvo.getUTCDate()).padStart(2, "0")}/${String(
          date.getMonth() + 1
        ).padStart(2, "0")}/${date.getFullYear()}`
      : dataAlvo.toLocaleDateString("pt-BR", { timeZone: "UTC" });
    const tipoTarefa = item.isRecorrente
      ? '<span class="status-badge status-suspenso" style="background-color: #6a1b9a;">Recorrente</span>'
      : '<span class="status-badge status-ativo" style="background-color: #1565c0;">Única</span>';

    let statusBadge = "";
    let acoesBtnDesfazer = "";
    let linhaStyle = "";

    if (isCumprida) {
      const dataCumprimentoTimestamp = isCumpridaUnica
        ? Object.values(item.historicoCumprimentos)[0]
        : item.historicoCumprimentos[anoMesSelecionado];
      const dataFormatada = new Date(
        dataCumprimentoTimestamp.seconds * 1000
      ).toLocaleDateString("pt-BR", { timeZone: "UTC" });
      statusBadge = `<span class="status-badge status-ativo">Cumprido em ${dataFormatada}</span>`;
      acoesBtnDesfazer = `<button class="action-icon" title="Desfazer cumprimento" data-action="desfazer" data-id="${item.id}" data-mes-chave="${anoMesSelecionado}"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#5a6268"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg></button>`;
      linhaStyle = 'style="background-color: #e8f5e9;"';
    } else {
      statusBadge = `<span class="status-badge status-suspenso clickable-status" data-action="cumprir" data-id="${item.id}" data-mes-chave="${anoMesSelecionado}" title="Clique para marcar como cumprido">Pendente</span>`;
      acoesBtnDesfazer = `<button class="action-icon" disabled style="opacity: 0.3; cursor: not-allowed;"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#5a6268"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg></button>`;
    }

    tableHTML += `<tr ${linhaStyle}><td>${dataAlvoFormatada}</td><td><a href="#" class="view-processo-link" data-action="view-desc" data-id="${item.id}">${item.titulo}</a></td><td>${tipoTarefa}</td><td class="tasks-status-cell">${statusBadge}</td><td class="actions-cell tasks-actions-cell"><div style="display: flex; justify-content: center; align-items: center; gap: 8px;">${acoesBtnDesfazer}<button class="action-icon icon-edit" title="Editar" data-action="edit" data-id="${item.id}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button><button class="action-icon icon-delete" title="Excluir" data-action="delete" data-id="${item.id}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></div></td></tr>`;
  });
  tableHTML += `</tbody></table>`;
  container.innerHTML = tableHTML;
}

/**
 * Lida com todas as ações na lista de tarefas (cumprir, desfazer, editar, etc.).
 */
function handleDiligenciaAction(event) {
  const target = event.target.closest("[data-action]");
  if (!target || !target.closest("#diligencias-list-container")) return;
  event.preventDefault();

  const action = target.dataset.action;
  const diligenciaId = target.dataset.id;
  const mesChave = target.dataset.mesChave;

  if (action === "cumprir") handleCumprirDiligencia(diligenciaId, mesChave);
  else if (action === "desfazer")
    handleDesfazerDiligencia(diligenciaId, mesChave);
  else if (action === "edit") {
    const tarefa = state.diligenciasCache.find((d) => d.id === diligenciaId);
    if (tarefa) renderDiligenciaFormModal(tarefa);
  } else if (action === "delete") {
    handleDeleteDiligencia(diligenciaId);
  } else if (action === "view-desc") {
    const tarefa = state.diligenciasCache.find((d) => d.id === diligenciaId);
    if (tarefa) renderTaskDetailsModal(tarefa);
  }
}

function handleCumprirDiligencia(diligenciaId, anoMesChave) {
  const updateData = {};
  updateData[`historicoCumprimentos.${anoMesChave}`] =
    firebase.firestore.FieldValue.serverTimestamp();
  db.collection("diligenciasMensais")
    .doc(diligenciaId)
    .update(updateData)
    .then(() => showToast("Tarefa marcada como cumprida!"))
    .catch(() => showToast("Ocorreu um erro.", "error"));
}

function handleDesfazerDiligencia(diligenciaId, anoMesChave) {
  const updateData = {};
  updateData[`historicoCumprimentos.${anoMesChave}`] =
    firebase.firestore.FieldValue.delete();
  db.collection("diligenciasMensais")
    .doc(diligenciaId)
    .update(updateData)
    .then(() => showToast("Ação desfeita."))
    .catch(() => showToast("Ocorreu um erro.", "error"));
}

function handleDeleteDiligencia(diligenciaId) {
  if (
    confirm(
      "Tem certeza que deseja excluir este modelo de tarefa? Esta ação é permanente."
    )
  ) {
    db.collection("diligenciasMensais")
      .doc(diligenciaId)
      .delete()
      .then(() => showToast("Tarefa excluída com sucesso."))
      .catch(() => showToast("Ocorreu um erro ao excluir.", "error"));
  }
}

/**
 * Renderiza um modal específico para exibir os detalhes de uma tarefa.
 * @param {object} tarefa - O objeto da tarefa.
 */
function renderTaskDetailsModal(tarefa) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";

  let processoHTML = `<div class="detail-item"><span class="detail-label">Processo Vinculado:</span><span class="detail-value">Nenhum</span></div>`;
  if (tarefa.processoVinculado) {
    processoHTML = `<div class="detail-item"><span class="detail-label">Processo Vinculado:</span><span class="detail-value">${formatProcessoForDisplay(
      tarefa.processoVinculado
    )}</span></div>`;
  }
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
