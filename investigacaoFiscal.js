// ==================================================================
// Módulo: investigacaoFiscal.js
// Responsabilidade: Lógica da página "Investigação Fiscal".
// ==================================================================

import { db } from "./firebase.js";
import { contentArea, pageTitle, showToast } from "./ui.js";
import { navigateTo } from "./navigation.js";
import {
  getSafeDate,
  maskProcesso,
  formatProcessoForDisplay,
} from "./utils.js";

let investigacaoListenerUnsubscribe = null;

// Funções principais
export function renderInvestigacaoFiscalPage() {
  pageTitle.textContent = "Investigação Fiscal";
  document.title = "SASIF | Investigação Fiscal";
  contentArea.innerHTML = `
        <div class="dashboard-actions">
            <button id="add-investigacao-btn" class="btn-primary">Cadastrar Processo</button>
            <button id="view-arquivados-btn" class="btn-secondary">Consultar Arquivados</button>
        </div>
        <h2>Processos em Andamento</h2>
        <div id="investigacao-list-container">
            <p class="empty-list-message">Carregando investigações...</p>
        </div>
    `;
  setupInvestigacaoListener();
  setupPageEventListeners();
}

function setupInvestigacaoListener() {
  if (investigacaoListenerUnsubscribe) investigacaoListenerUnsubscribe();
  const query = db
    .collection("investigacoesFiscais")
    .where("status", "==", "ativo")
    .orderBy("prazoRetorno", "asc");
  investigacaoListenerUnsubscribe = query.onSnapshot(
    (snapshot) => {
      const investigacoes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      renderInvestigacaoList(investigacoes);
    },
    (error) => {
      console.error("Erro ao buscar investigações: ", error);
      showToast("Erro ao carregar os dados.", "error");
      document.getElementById(
        "investigacao-list-container"
      ).innerHTML = `<p class="empty-list-message error">Não foi possível carregar os processos.</p>`;
    }
  );
}

function setupPageEventListeners() {
  document.body.addEventListener("click", handlePageActions);
}

// Funções de Renderização
function renderInvestigacaoList(investigacoes) {
  const container = document.getElementById("investigacao-list-container");
  if (!container) return;
  if (investigacoes.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhuma investigação em andamento.</p>`;
    return;
  }
  const fasesMap = {
    "Tutela Provisória": "Ajuizado",
    "Designação de Audiência": "Decidida Tutela Provisória",
    Julgamento: "Marcada Audiência",
    "Análise de Embargos": "Julgado",
    "Trânsito em Julgado": "Decididos Embargos",
  };
  const tableRows = investigacoes
    .map((item) => {
      const { prazoStatus, statusClass } = getPrazoRetornoStatus(
        item.prazoRetorno
      );
      const numeroFormatado = item.numeroProcesso
        ? formatProcessoForDisplay(item.numeroProcesso)
        : "Não informado";
      const faseAtual = fasesMap[item.decisaoPendente] || item.decisaoPendente;
      return `
            <tr>
                <td>${numeroFormatado}</td>
                <td>${item.suscitado || "Não informado"}</td>
                <td>${faseAtual}</td>
                <td class="status-cell ${statusClass}">${prazoStatus}</td>
                <td class="actions-cell">
                    <button class="btn-primary btn-small" data-action="update-andamento" data-id="${
                      item.id
                    }">Atualizar Andamento</button>
                    <button class="action-icon icon-edit" title="Editar Dados Cadastrais" data-action="edit-investigacao" data-id="${
                      item.id
                    }"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                    <button class="action-icon icon-delete" title="Excluir" data-action="delete-investigacao" data-id="${
                      item.id
                    }"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
                </td>
            </tr>
        `;
    })
    .join("");
  container.innerHTML = `<table class="data-table"><thead><tr><th>Nº do Processo</th><th>Suscitado</th><th>Fase Atual</th><th>Prazo para Retorno</th><th class="actions-cell">Ações</th></tr></thead><tbody>${tableRows}</tbody></table>`;
}

function renderInvestigacaoFormModal(investigacao = null) {
  const isEditing = investigacao !== null;
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `
        <div class="modal-content modal-large">
            <h3>${isEditing ? "Editar" : "Cadastrar Nova"} Investigação</h3>
            <div class="form-group"><label for="inv-numero-processo">Nº do Processo</label><input type="text" id="inv-numero-processo" class="form-input" placeholder="0000000-00.0000.0.00.0000" value="${
              isEditing
                ? formatProcessoForDisplay(investigacao.numeroProcesso)
                : ""
            }"></div>
            <div style="display: flex; gap: 16px;"><div class="form-group" style="flex: 1;"><label for="inv-suscitante">Suscitante</label><input type="text" id="inv-suscitante" class="form-input" value="${
              isEditing ? investigacao.suscitante : ""
            }"></div><div class="form-group" style="flex: 1;"><label for="inv-suscitado">Suscitado</label><input type="text" id="inv-suscitado" class="form-input" value="${
    isEditing ? investigacao.suscitado : ""
  }"></div></div>
            <div style="display: flex; gap: 16px;"><div class="form-group" style="flex: 1;"><label for="inv-data-ajuizamento">Data de Ajuizamento</label><input type="date" id="inv-data-ajuizamento" class="form-input" value="${
              isEditing
                ? getSafeDate(investigacao.dataAjuizamento)
                    .toISOString()
                    .split("T")[0]
                : ""
            }"></div><div class="form-group" style="flex: 1;"><label for="inv-decisao-pendente">Motivo da Análise</label><select id="inv-decisao-pendente" class="form-input"><option value="Tutela Provisória" ${
    isEditing && investigacao.decisaoPendente === "Tutela Provisória"
      ? "selected"
      : ""
  }>Tutela Provisória</option><option value="Designação de Audiência" ${
    isEditing && investigacao.decisaoPendente === "Designação de Audiência"
      ? "selected"
      : ""
  }>Designação de Audiência</option><option value="Julgamento" ${
    isEditing && investigacao.decisaoPendente === "Julgamento" ? "selected" : ""
  }>Julgamento</option></select></div></div>
            <div class="form-group"><label for="inv-descricao">Descrição (Opcional)</label><textarea id="inv-descricao" class="form-input" rows="3">${
              isEditing ? investigacao.descricao : ""
            }</textarea></div>
            <div id="error-message"></div>
            <div class="form-buttons"><button data-action="save-investigacao" data-id="${
              isEditing ? investigacao.id : ""
            }" class="btn-primary">Salvar</button><button data-action="close-modal" class="btn-secondary">Cancelar</button></div>
        </div>
    `;
  document.body.appendChild(modalOverlay);
  document
    .getElementById("inv-numero-processo")
    .addEventListener("input", (e) => maskProcesso(e.target));
}

function renderAndamentoModal(investigacao) {
  // ... (código sem alterações)
  const fases = {
    "Tutela Provisória": {
      proxima: "Designação de Audiência",
      statusAnterior: "Ajuizado",
    },
    "Designação de Audiência": {
      proxima: "Julgamento",
      statusAnterior: "Decidida Tutela Provisória",
    },
    Julgamento: {
      proxima: "Análise de Embargos",
      statusAnterior: "Marcada Audiência",
    },
    "Análise de Embargos": {
      proxima: "Trânsito em Julgado",
      statusAnterior: "Julgado",
    },
  };
  const proximaAcao = fases[investigacao.decisaoPendente]?.proxima || "Nenhuma";
  const statusAtual =
    fases[investigacao.decisaoPendente]?.statusAnterior || "Status inicial";
  const historicoCorrigido = (investigacao.historicoFases || []).map((fase) => {
    if (fase.id === "impugnacao") return { ...fase, nome: "Impugnação" };
    if (fase.id === "audiencia") return { ...fase, nome: "Audiência" };
    if (fase.id === "julgamento") return { ...fase, nome: "Julgamento" };
    if (fase.id === "tutela") return { ...fase, nome: "Tutela" };
    return fase;
  });
  const trackerHTML = historicoCorrigido
    .map(
      (fase) =>
        `<div class="form-group-checkbox tracker-item"><input type="checkbox" id="fase-${
          fase.id
        }" data-fase-id="${fase.id}" ${
          fase.concluido ? "checked" : ""
        }><label for="fase-${fase.id}">${fase.nome}</label></div>`
    )
    .join("");
  const prazoRetornoAtual = investigacao.prazoRetorno
    ? getSafeDate(investigacao.prazoRetorno).toISOString().split("T")[0]
    : "";
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `
        <div class="modal-content modal-large">
            <h3>Andamento: ${formatProcessoForDisplay(
              investigacao.numeroProcesso
            )}</h3>
            <div class="andamento-secao"><h4>Status Atual do Processo</h4><p><strong>${statusAtual}</strong></p></div>
            <div class="andamento-secao"><button id="btn-conclui-minuta" class="btn-primary">✓ Processo Minutado (para ${
              investigacao.decisaoPendente
            })</button></div>
            <div id="proximo-passo-secao" class="andamento-secao">
                <h4>Próximo Passo e Prazos</h4>
                <div class="form-group" style="display:none;" id="proxima-acao-container"><label for="andamento-proxima-acao">Próxima Decisão Pendente</label><input type="text" id="andamento-proxima-acao" class="form-input" value="${proximaAcao}" readonly></div>
                <div class="form-group"><label for="andamento-prazo-retorno">Nova Previsão de Retorno</label><input type="date" id="andamento-prazo-retorno" class="form-input" value="${prazoRetornoAtual}"></div>
            </div>
            <div class="andamento-secao"><h4>Tracker de Fases do Processo</h4><div class="tracker-container">${trackerHTML}</div></div>
            <div id="error-message"></div>
            <div class="form-buttons"><button data-action="save-andamento" data-id="${
              investigacao.id
            }" class="btn-primary">Salvar Andamento</button><button data-action="archive-investigacao" data-id="${
    investigacao.id
  }" class="btn-secondary">Arquivar Processo</button><button data-action="close-modal" class="btn-secondary">Cancelar</button></div>
        </div>
    `;
  document.body.appendChild(modalOverlay);
  const btnConclui = document.getElementById("btn-conclui-minuta");
  const containerProximaAcao = document.getElementById(
    "proxima-acao-container"
  );
  btnConclui.addEventListener("click", () => {
    btnConclui.style.backgroundColor = "#4CAF50";
    btnConclui.textContent = "Minuta Concluída!";
    btnConclui.disabled = true;
    containerProximaAcao.style.display = "block";
  });
}

/**
 * NOVA FUNÇÃO: Renderiza o modal com a lista de processos arquivados.
 */
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

    const arquivados = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    const container = document.getElementById("arquivados-list");

    if (arquivados.length === 0) {
      container.innerHTML = `<p class="empty-list-message">Nenhum processo arquivado encontrado.</p>`;
      return;
    }

    const tableRows = arquivados
      .map((item) => {
        const dataAjuizamento = item.dataAjuizamento
          ? getSafeDate(item.dataAjuizamento).toLocaleDateString("pt-BR")
          : "N/D";
        return `
                <tr>
                    <td>${formatProcessoForDisplay(item.numeroProcesso)}</td>
                    <td>${item.suscitado}</td>
                    <td>${dataAjuizamento}</td>
                </tr>
            `;
      })
      .join("");

    container.innerHTML = `
            <table class="data-table">
                <thead><tr><th>Nº do Processo</th><th>Suscitado</th><th>Data de Ajuizamento</th></tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
        `;
  } catch (error) {
    console.error("Erro ao buscar arquivados: ", error);
    document.getElementById(
      "arquivados-list"
    ).innerHTML = `<p class="empty-list-message error">Não foi possível carregar os arquivados.</p>`;
  }
}

// Funções de Manipulação de Dados (Handlers)
async function handlePageActions(e) {
  if (
    !document.title.includes("Investigação Fiscal") &&
    !document.querySelector(".modal-overlay")
  )
    return;
  const target = e.target.closest("button[data-action], button[id]");
  if (!target) return;
  const action = target.dataset.action || target.id;
  const id = target.dataset.id;
  switch (action) {
    case "add-investigacao-btn":
      renderInvestigacaoFormModal();
      break;
    case "save-investigacao":
      handleSaveInvestigacao(id);
      break;
    case "close-modal":
      const modal = document.querySelector(".modal-overlay");
      if (modal) modal.remove();
      break;
    case "view-arquivados-btn":
      renderArquivadosModal();
      break; // <-- AÇÃO ATIVADA
    case "update-andamento": {
      const doc = await db.collection("investigacoesFiscais").doc(id).get();
      if (doc.exists) renderAndamentoModal({ id: doc.id, ...doc.data() });
      else showToast("Processo não encontrado.", "error");
      break;
    }
    case "edit-investigacao": {
      const doc = await db.collection("investigacoesFiscais").doc(id).get();
      if (doc.exists)
        renderInvestigacaoFormModal({ id: doc.id, ...doc.data() });
      else showToast("Processo não encontrado.", "error");
      break;
    }
    case "delete-investigacao":
      handleDeleteInvestigacao(id);
      break;
    case "save-andamento":
      handleUpdateAndamento(id);
      break;
    case "archive-investigacao":
      handleArquivarProcesso(id);
      break;
  }
}

async function handleSaveInvestigacao(id = null) {
  // ... (código sem alterações)
  const numeroProcesso = document
    .getElementById("inv-numero-processo")
    .value.replace(/\D/g, "");
  const suscitante = document.getElementById("inv-suscitante").value.trim();
  const suscitado = document.getElementById("inv-suscitado").value.trim();
  const dataAjuizamentoInput = document.getElementById(
    "inv-data-ajuizamento"
  ).value;
  const decisaoPendente = document.getElementById("inv-decisao-pendente").value;
  const descricao = document.getElementById("inv-descricao").value.trim();
  const errorMsg = document.getElementById("error-message");
  if (
    !numeroProcesso ||
    !suscitante ||
    !suscitado ||
    !dataAjuizamentoInput ||
    !decisaoPendente
  ) {
    errorMsg.textContent = "Preencha todos os campos obrigatórios.";
    return;
  }
  const dataToSave = {
    numeroProcesso,
    suscitante,
    suscitado,
    descricao,
    dataAjuizamento: firebase.firestore.Timestamp.fromDate(
      new Date(dataAjuizamentoInput + "T00:00:00")
    ),
    decisaoPendente: decisaoPendente,
  };
  try {
    if (id) {
      await db.collection("investigacoesFiscais").doc(id).update(dataToSave);
      showToast("Investigação atualizada com sucesso!", "success");
    } else {
      dataToSave.status = "ativo";
      dataToSave.prazoRetorno = null;
      dataToSave.dataUltimaMinuta = null;
      dataToSave.historicoFases = [
        { id: "tutela", concluido: false },
        { id: "impugnacao", concluido: false },
        { id: "audiencia", concluido: false },
        { id: "julgamento", concluido: false },
      ];
      dataToSave.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("investigacoesFiscais").add(dataToSave);
      showToast("Investigação cadastrada com sucesso!", "success");
    }
    const modal = document.querySelector(".modal-overlay");
    if (modal) modal.remove();
  } catch (error) {
    console.error("Erro ao salvar investigação: ", error);
    errorMsg.textContent = "Erro ao salvar. Verifique o console.";
  }
}

async function handleUpdateAndamento(id) {
  // ... (código sem alterações)
  const prazoRetornoInput = document.getElementById("andamento-prazo-retorno");
  const errorMsg = document.getElementById("error-message");
  const btnConclui = document.getElementById("btn-conclui-minuta");
  const minutaFoiConcluida = btnConclui.disabled;
  if (minutaFoiConcluida && !prazoRetornoInput.value) {
    errorMsg.textContent =
      "Se a minuta foi concluída, a previsão de retorno é obrigatória.";
    return;
  }
  const historicoCheckboxes = document.querySelectorAll(
    '.tracker-container input[type="checkbox"]'
  );
  const historicoFases = Array.from(historicoCheckboxes).map((cb) => ({
    id: cb.dataset.faseId,
    concluido: cb.checked,
  }));
  const dataToUpdate = { historicoFases: historicoFases };
  if (prazoRetornoInput.value) {
    dataToUpdate.prazoRetorno = firebase.firestore.Timestamp.fromDate(
      new Date(prazoRetornoInput.value + "T00:00:00")
    );
  }
  if (minutaFoiConcluida) {
    const proximaAcaoInput = document.getElementById("andamento-proxima-acao");
    dataToUpdate.decisaoPendente = proximaAcaoInput.value;
    dataToUpdate.dataUltimaMinuta =
      firebase.firestore.FieldValue.serverTimestamp();
  }
  try {
    await db.collection("investigacoesFiscais").doc(id).update(dataToUpdate);
    showToast("Andamento atualizado com sucesso!", "success");
    const modal = document.querySelector(".modal-overlay");
    if (modal) modal.remove();
  } catch (error) {
    console.error("Erro ao atualizar andamento:", error);
    errorMsg.textContent = "Erro ao salvar. Verifique o console.";
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
    showToast("Investigação excluída com sucesso.", "success");
  } catch (error) {
    console.error("Erro ao excluir investigação: ", error);
    showToast("Ocorreu um erro ao excluir.", "error");
  }
}

async function handleArquivarProcesso(id) {
  if (
    !confirm(
      "Tem certeza que deseja arquivar este processo? Ele sairá da lista de processos em andamento."
    )
  )
    return;
  try {
    await db
      .collection("investigacoesFiscais")
      .doc(id)
      .update({
        status: "arquivado",
        prazoRetorno: null,
        decisaoPendente: "Arquivado",
      });
    showToast("Processo arquivado com sucesso.", "success");
    const modal = document.querySelector(".modal-overlay");
    if (modal) modal.remove();
  } catch (error) {
    console.error("Erro ao arquivar processo: ", error);
    showToast("Ocorreu um erro ao arquivar.", "error");
  }
}

// Funções Utilitárias
function getPrazoRetornoStatus(prazoTimestamp) {
  if (!prazoTimestamp)
    return { prazoStatus: "Sem prazo", statusClass: "status-none" };
  const prazoDate = getSafeDate(prazoTimestamp);
  if (!prazoDate)
    return { prazoStatus: "Data inválida", statusClass: "status-overdue" };
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diffTime = prazoDate.getTime() - hoje.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0)
    return {
      prazoStatus: `Vencido há ${Math.abs(diffDays)} dia(s)`,
      statusClass: "status-overdue",
    };
  if (diffDays === 0)
    return { prazoStatus: "Vence hoje", statusClass: "status-due-soon" };
  if (diffDays <= 7)
    return {
      prazoStatus: `Vence em ${diffDays} dia(s)`,
      statusClass: "status-due-soon",
    };
  return {
    prazoStatus: `Vence em ${diffDays} dia(s)`,
    statusClass: "status-ok",
  };
}
