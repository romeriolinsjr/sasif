// ==================================================================
// Módulo: processos.js
// Responsabilidade: Gerenciamento completo da entidade "Processos" e suas sub-entidades.
// ==================================================================

import { db, storage, auth } from "./firebase.js";
import {
  contentArea,
  pageTitle,
  showToast,
  renderReadOnlyTextModal,
  renderSidebar, // <-- ADICIONE ESTA LINHA
} from "./ui.js";
import { navigateTo } from "./navigation.js";
import { renderDevedorDetailPage } from "./devedores.js";
import * as state from "./state.js";
import {
  formatProcessoForDisplay,
  formatCurrency,
  maskProcesso,
  maskDocument,
  formatDocumentForDisplay,
} from "./utils.js";

// Importa a função de renderização do formulário de incidentes do módulo de configurações
import {
  renderIncidenteFormModal,
  handleIncidenteAction,
} from "./configuracoes.js";

// ==================================================================
// SEÇÃO: LISTAGEM E FORMULÁRIO PRINCIPAL DE PROCESSOS
// ==================================================================

/**
 * Renderiza a lista de processos na página de detalhes de um devedor.
 * @param {Array} processos - Lista de processos do devedor.
 * @param {Array} incidentesDoDevedor - Lista de incidentes para marcar os processos.
 */
/**
 * Helper para extrair o ano e a cabeça de um número de processo de 20 dígitos.
 * @param {string} numero - O número do processo (20 dígitos).
 * @returns {{ano: string, cabeca: string}}
 */
function getNumeroProcessoParts(numero) {
  if (!numero || numero.length !== 20) {
    return { ano: "0", cabeca: "0" }; // Retorno seguro para dados inválidos
  }
  return {
    ano: numero.substring(9, 13),
    cabeca: numero.substring(0, 7),
  };
}

/**
 * Renderiza la lista de processos na página de detalhes de um devedor.
 * @param {Array} processos - Lista de processos do devedor.
 * @param {Array} incidentesDoDevedor - Lista de incidentes para marcar os processos.
 */
export function renderProcessosList(processos, incidentesDoDevedor = []) {
  // --- 1. Lógica de Resumo Financeiro (sem alterações) ---
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
      totaisPorExequente[exequenteId] =
        (totaisPorExequente[exequenteId] || 0) + valor;
      contagemPorExequente[exequenteId] =
        (contagemPorExequente[exequenteId] || 0) + 1;
    }
  });

  const valorTotalGeral = Object.values(totaisPorExequente).reduce(
    (total, valor) => total + valor,
    0
  );

  let detalhamentoHTML = "";
  for (const exequenteId in totaisPorExequente) {
    const exequente = state.exequentesCache.find((e) => e.id === exequenteId);
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

  // --- 2. NOVA LÓGICA DE ORDENAÇÃO ---

  // Separa os processos por tipo
  const itemsParaOrdenar = processos.filter(
    (p) => p.tipoProcesso === "autônomo" || p.tipoProcesso === "piloto"
  );
  const apensos = processos.filter((p) => p.tipoProcesso === "apenso");

  // Ordena a lista principal (pilotos e autônomos)
  itemsParaOrdenar.sort((a, b) => {
    // Nível 1: Ordena por Exequente (A-Z)
    const exequenteA =
      state.exequentesCache.find((ex) => ex.id === a.exequenteId)?.nome || "";
    const exequenteB =
      state.exequentesCache.find((ex) => ex.id === b.exequenteId)?.nome || "";
    if (exequenteA.localeCompare(exequenteB) !== 0) {
      return exequenteA.localeCompare(exequenteB);
    }

    // Nível 2: Ordena por Tipo (Piloto > Autônomo)
    const tipoValor = { piloto: 1, autônomo: 2 };
    const valorA = tipoValor[a.tipoProcesso] || 3;
    const valorB = tipoValor[b.tipoProcesso] || 3;
    if (valorA !== valorB) {
      return valorA - valorB;
    }

    // Nível 3: Ordena por Número do Processo (Mais novo primeiro)
    const partsA = getNumeroProcessoParts(a.numeroProcesso);
    const partsB = getNumeroProcessoParts(b.numeroProcesso);
    if (partsB.ano !== partsA.ano) {
      return partsB.ano.localeCompare(partsA.ano); // Ano descendente
    }
    return partsB.cabeca.localeCompare(partsA.cabeca); // Cabeça descendente
  });

  // Cria um mapa de apensos e já ordena cada lista de apensos
  const apensosMap = apensos.reduce((map, apenso) => {
    const pilotoId = apenso.processoPilotoId;
    if (!map.has(pilotoId)) map.set(pilotoId, []);
    map.get(pilotoId).push(apenso);
    return map;
  }, new Map());

  // Ordena a lista de apensos dentro de cada piloto
  apensosMap.forEach((apensosDoPiloto) => {
    apensosDoPiloto.sort((a, b) => {
      const partsA = getNumeroProcessoParts(a.numeroProcesso);
      const partsB = getNumeroProcessoParts(b.numeroProcesso);
      if (partsB.ano !== partsA.ano) {
        return partsB.ano.localeCompare(partsA.ano); // Ano descendente
      }
      return partsB.cabeca.localeCompare(partsA.cabeca); // Cabeça descendente
    });
  });

  // --- 3. Lógica de Renderização (sem alterações na estrutura) ---
  if (itemsParaOrdenar.length === 0 && apensos.length === 0) {
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
    const exequente = state.exequentesCache.find(
      (ex) => ex.id === proc.exequenteId
    );
    const motivo =
      proc.status === "Suspenso" && proc.motivoSuspensaoId
        ? state.motivosSuspensaoCache.find(
            (m) => m.id === proc.motivoSuspensaoId
          )
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
    if (isApenso) rowDataAttrs += ` data-piloto-ref="${proc.processoPilotoId}"`;
    else if (proc.tipoProcesso === "piloto")
      rowDataAttrs += ` data-piloto-id="${proc.id}"`;

    return `<tr class="${rowClass}" ${rowDataAttrs}>
            <td>${
              proc.tipoProcesso === "piloto"
                ? '<span class="toggle-icon"></span>'
                : ""
            }<a href="#" class="view-processo-link" data-action="view-detail">${formatProcessoForDisplay(
      proc.numeroProcesso
    )}</a>${indicadorIncidente}</td>
            <td>${exequente ? exequente.nome : "N/A"}</td>
            <td>${tipoProcessoTexto}</td>
            <td><span class="status-badge status-${(proc.status || "Ativo")
              .toLowerCase()
              .replace(" ", "-")}">${statusText}</span></td>
            <td>${formatCurrency(valorExibido)}</td>
            <td class="actions-cell">
                <button class="action-icon icon-edit" title="Editar Processo" data-id="${
                  proc.id
                }"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                <button class="action-icon icon-delete" title="Excluir Processo" data-id="${
                  proc.id
                }"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
            </td>
        </tr>`;
  };

  itemsParaOrdenar.forEach((item) => {
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
/**
 * Renderiza o formulário para criar ou editar um processo.
 * @param {string} devedorId - ID do devedor ao qual o processo pertence.
 * @param {object|null} processo - O objeto do processo para edição, ou null para criação.
 */
export function renderProcessoForm(devedorId, processo = null) {
  const isEditing = processo !== null;
  pageTitle.textContent = isEditing ? "Editar Processo" : "Novo Processo";
  document.title = `SASIF | ${pageTitle.textContent}`;

  const exequenteOptions = state.exequentesCache
    .map(
      (ex) =>
        `<option value="${ex.id}" ${
          isEditing && processo.exequenteId === ex.id ? "selected" : ""
        }>${ex.nome}</option>`
    )
    .join("");
  const motivosOptions = state.motivosSuspensaoCache
    .map(
      (m) =>
        `<option value="${m.id}" ${
          isEditing && processo.motivoSuspensaoId === m.id ? "selected" : ""
        }>${m.descricao}</option>`
    )
    .join("");

  contentArea.innerHTML = `
        <div class="form-container">
            <div class="form-group"><label for="numero-processo">Número do Processo (Obrigatório)</label><input type="text" id="numero-processo" required value="${
              isEditing ? formatProcessoForDisplay(processo.numeroProcesso) : ""
            }"></div>
            <div class="form-group"><label for="exequente">Exequente (Obrigatório)</label><select id="exequente"><option value="">Selecione...</option>${exequenteOptions}</select></div>
            <div class="form-group"><label for="tipo-processo">Tipo</label><select id="tipo-processo"><option value="autônomo">Autônomo</option><option value="piloto">Piloto</option><option value="apenso">Apenso</option></select></div>
            <div id="piloto-select-container"></div>
            <hr style="margin: 20px 0;">
            <div class="form-group"><label for="status-processo">Status</label><select id="status-processo"><option value="Ativo">Ativo</option><option value="Suspenso">Suspenso</option><option value="Baixado">Baixado</option><option value="Extinto">Extinto</option></select></div>
            <div id="motivo-suspensao-container" class="hidden"><div class="form-group"><label for="motivo-suspensao">Motivo da Suspensão</label><select id="motivo-suspensao"><option value="">Selecione o motivo...</option>${motivosOptions}</select></div></div>
            <hr style="margin: 20px 0;">
            <div class="form-group"><label for="valor-divida">Valor da Dívida</label><input type="number" id="valor-divida" placeholder="0.00" step="0.01" value="${
              isEditing
                ? processo.valorAtual
                  ? processo.valorAtual.valor
                  : processo.valorDivida || 0
                : ""
            }"></div>
            <div class="form-group"><label for="cdas">CDA(s)</label><textarea id="cdas" rows="3">${
              isEditing ? processo.cdas || "" : ""
            }</textarea></div>
            <div id="error-message"></div>
            <div class="form-buttons"><button id="save-processo-btn" class="btn-primary">Salvar</button><button id="cancel-btn">Cancelar</button></div>
        </div>`;

  document
    .getElementById("numero-processo")
    .addEventListener("input", (e) => maskProcesso(e.target));

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
      const pilotosDisponiveis = state.processosCache.filter(
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
    .addEventListener("click", () => renderDevedorDetailPage(devedorId));
}

/**
 * Salva um processo (novo ou editado) no banco de dados.
 */
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
      const snapshot = await db
        .collection("processos")
        .where("numeroProcesso", "==", numeroProcesso)
        .get();
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

  const cdasNormalizadas = cdasInput
    .split(/[,;]/)
    .map((cda) => cda.replace(/\D/g, ""))
    .filter((cda) => cda.length > 0);
  const processoData = {
    devedorId,
    numeroProcesso,
    exequenteId,
    tipoProcesso,
    status,
    motivoSuspensaoId: status === "Suspenso" ? motivoSuspensaoId : null,
    cdas: cdasInput,
    cdasNormalizadas,
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
    const pilotoSelecionado = state.processosCache.find(
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
      const processoOriginal = state.processosCache.find(
        (p) => p.id === processoId
      );
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
    renderDevedorDetailPage(devedorId);
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

// ==================================================================
// SEÇÃO: DETALHES DO PROCESSO E AÇÕES
// ==================================================================

/**
 * Renderiza a página de detalhes de um único processo.
 * @param {string} processoId - O ID do processo a ser exibido.
 */
export function renderProcessoDetailPage(processoId) {
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
      const devedor = state.devedoresCache.find(
        (d) => d.id === processo.devedorId
      );
      const exequente = state.exequentesCache.find(
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
                    <div><p><strong>Exequente:</strong> ${
                      exequente ? exequente.nome : "N/A"
                    }</p><p><strong>Executado:</strong> ${
        devedor ? devedor.razaoSocial : "N/A"
      }</p></div>
                    <div><p><strong>Tipo:</strong> ${
                      processo.tipoProcesso.charAt(0).toUpperCase() +
                      processo.tipoProcesso.slice(1)
                    }</p><div class="valor-divida-container"><p><strong>Valor da Dívida:</strong> ${formatCurrency(
        processo.valorAtual ? processo.valorAtual.valor : processo.valorDivida
      )}</p><div class="valor-divida-actions"><button id="update-valor-btn" class="action-btn btn-edit">Atualizar</button><button id="view-history-btn" class="action-btn btn-secondary">Histórico</button></div></div></div>
                </div>
                <div class="detail-full-width"><strong>CDA(s):</strong><p>${
                  processo.cdas
                    ? processo.cdas.replace(/\n/g, "<br>")
                    : "Nenhuma CDA cadastrada."
                }</p></div>
            </div>
            <div class="content-section"><div class="section-header"><h2>Corresponsáveis Tributários</h2><button id="add-corresponsavel-btn" class="btn-primary">Adicionar</button></div><div id="corresponsaveis-list-container"></div></div>
            <div class="content-section"><div class="section-header"><h2>Constrições Patrimoniais</h2><button id="add-penhora-btn" class="btn-primary">Adicionar</button></div><div id="penhoras-list-container"></div></div>
            <div class="content-section"><div class="section-header"><h2>Audiências Agendadas</h2><button id="add-audiencia-btn" class="btn-primary">Adicionar</button></div><div id="audiencias-list-container"></div></div>
            <div class="content-section"><div class="section-header"><h2>Incidentes Processuais Vinculados</h2></div><div id="incidentes-list-container"></div></div>
            <div class="content-section"><div class="section-header"><h2>Anexos</h2><div id="anexos-actions-container"></div></div><div id="anexos-list-container"><p class="empty-list-message">Nenhum anexo para este processo.</p></div></div>
        `;

      document
        .getElementById("back-to-devedor-btn")
        .addEventListener("click", () =>
          renderDevedorDetailPage(processo.devedorId)
        );
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

      if (document.getElementById("promote-piloto-btn")) {
        document
          .getElementById("promote-piloto-btn")
          .addEventListener("click", () => handlePromoteToPiloto(processo.id));
      }
      if (document.getElementById("unattach-processo-btn")) {
        document
          .getElementById("unattach-processo-btn")
          .addEventListener("click", () => handleUnattachProcesso(processo.id));
      }
      document
        .getElementById("update-valor-btn")
        .addEventListener("click", () => renderValorUpdateModal(processo.id));
      document
        .getElementById("view-history-btn")
        .addEventListener("click", () => renderValorHistoryModal(processo.id));
      document
        .getElementById("delete-processo-btn")
        .addEventListener("click", () => handleDeleteProcesso(processo.id));
      document
        .getElementById("edit-processo-btn")
        .addEventListener("click", () => handleEditProcesso(processo.id));
    })
    .catch((error) => {
      console.error("Erro ao buscar detalhes do processo:", error);
      showToast("Erro ao carregar o processo.", "error");
    });
}

/**
 * Lida com cliques na lista de processos (detalhe, editar, excluir, expandir).
 */
function handleProcessoAction(event) {
  event.preventDefault();
  const target = event.target;

  const link = target.closest(".view-processo-link");
  if (link) {
    const processoId = link.closest("tr").dataset.id;
    navigateTo("processoDetail", { id: processoId });
    return;
  }

  const button = target.closest(".action-icon");
  if (button) {
    event.stopPropagation();
    const processoId = button.closest("tr").dataset.id;
    if (button.classList.contains("icon-delete"))
      handleDeleteProcesso(processoId);
    else if (button.classList.contains("icon-edit"))
      handleEditProcesso(processoId);
    return;
  }

  const row = target.closest("tr.piloto-row");
  if (row) {
    row.classList.toggle("expanded");
    document
      .querySelectorAll(
        `.apenso-row[data-piloto-ref="${row.dataset.pilotoId}"]`
      )
      .forEach((apensoRow) => {
        apensoRow.classList.toggle("visible");
      });
  }
}

/**
 * Busca dados de um processo e abre o formulário de edição.
 */
async function handleEditProcesso(processoId) {
  try {
    const doc = await db.collection("processos").doc(processoId).get();
    if (doc.exists) {
      renderProcessoForm(doc.data().devedorId, { id: doc.id, ...doc.data() });
    } else {
      showToast("Processo não encontrado no banco de dados.", "error");
    }
  } catch (error) {
    console.error("Erro ao buscar processo para edição:", error);
    showToast("Erro ao carregar dados do processo.", "error");
  }
}

/**
 * Exclui um processo (e seus apensos, se for piloto) após confirmação.
 */
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
    showToast("Erro de comunicação com o banco de dados.", "error");
    return;
  }

  let confirmMessage = `Tem certeza que deseja excluir o processo ${formatProcessoForDisplay(
    processo.numeroProcesso
  )}?`;
  let apensosParaExcluir = [];
  if (processo.tipoProcesso === "piloto") {
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

  if (!confirm(confirmMessage)) return;

  try {
    const batch = db.batch();
    apensosParaExcluir.forEach((apensoDoc) => batch.delete(apensoDoc.ref));
    batch.delete(processoRef);
    await batch.commit();
    showToast("Processo(s) excluído(s) com sucesso!");
    renderDevedorDetailPage(processo.devedorId);
  } catch (error) {
    console.error("Erro ao excluir processo(s):", error);
    showToast("Ocorreu um erro ao excluir o(s) processo(s).", "error");
  }
}

/**
 * Promove um processo apenso ou autônomo a piloto.
 */
async function handlePromoteToPiloto(processoId) {
  const processoAlvo = state.processosCache.find((p) => p.id === processoId);
  if (!processoAlvo) return showToast("Processo alvo não encontrado.", "error");
  if (
    !confirm(
      `Tem certeza que deseja promover o processo ${formatProcessoForDisplay(
        processoAlvo.numeroProcesso
      )} a novo Piloto?`
    )
  )
    return;

  const batch = db.batch();
  try {
    const processoAlvoRef = db.collection("processos").doc(processoAlvo.id);
    batch.update(processoAlvoRef, {
      tipoProcesso: "piloto",
      processoPilotoId: null,
      status: "Ativo",
      motivoSuspensaoId: null,
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
      state.processosCache
        .filter(
          (p) =>
            p.processoPilotoId === antigoPilotoId && p.id !== processoAlvo.id
        )
        .forEach((irmao) => {
          batch.update(db.collection("processos").doc(irmao.id), {
            processoPilotoId: processoAlvo.id,
          });
        });
    }
    await batch.commit();
    showToast("Processo promovido a Piloto com sucesso!", "success");
    renderDevedorDetailPage(processoAlvo.devedorId);
  } catch (error) {
    console.error("Erro ao promover processo a piloto: ", error);
    showToast("Ocorreu um erro crítico durante a promoção.", "error");
  }
}

/**
 * Desapensa um processo, tornando-o autônomo.
 */
function handleUnattachProcesso(processoId) {
  const processo = state.processosCache.find((p) => p.id === processoId);
  if (!processo) return showToast("Processo não encontrado.", "error");
  if (
    !confirm(
      `Tem certeza que deseja desapensar o processo ${formatProcessoForDisplay(
        processo.numeroProcesso
      )}? \n\nEle se tornará um processo Autônomo.`
    )
  )
    return;
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
    .catch((error) =>
      showToast("Ocorreu um erro ao desapensar o processo.", "error")
    );
}

// ==================================================================
// SEÇÃO: HISTÓRICO DE VALORES
// ==================================================================

function renderValorUpdateModal(processoId) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `
        <div class="modal-content">
            <h3>Atualizar Valor da Dívida</h3>
            <div class="form-group"><label for="novo-valor">Novo Valor (R$)</label><input type="number" id="novo-valor" placeholder="0.00" step="0.01" required></div>
            <div class="form-group"><label for="data-calculo">Data do Cálculo (Obrigatório)</label><input type="date" id="data-calculo" required></div>
            <div id="error-message"></div>
            <div class="form-buttons"><button id="save-new-valor-btn" class="btn-primary">Salvar</button><button id="cancel-valor-btn">Cancelar</button></div>
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
            <div class="form-buttons" style="justify-content: flex-end; margin-top: 20px;"><button id="close-history-modal" class="btn-secondary">Fechar</button></div>
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
      tableHTML += `<tr><td>${data}</td><td>${formatCurrency(
        item.valor
      )}</td><td>${item.tipo}</td></tr>`;
    });
    tableHTML += `</tbody></table>`;
    historyContainer.innerHTML = tableHTML;
  } catch (error) {
    document.getElementById(
      "history-list-container"
    ).innerHTML = `<p class="empty-list-message">Ocorreu um erro ao carregar o histórico.</p>`;
  }
}

// ==================================================================
// SEÇÃO: LISTENERS E CRUDs DAS SUB-ENTIDADES
// ==================================================================

/**
 * Configura o listener para a lista de processos de um devedor.
 * @param {string} devedorId - O ID do devedor.
 */
export async function setupProcessosListener(devedorId) {
  if (state.processosListenerUnsubscribe) state.processosListenerUnsubscribe();

  const incidentesSnapshot = await db
    .collection("incidentesProcessuais")
    .where("devedorId", "==", devedorId)
    .get();
  const incidentesDoDevedor = incidentesSnapshot.docs.map((doc) => doc.data());

  const unsubscribe = db
    .collection("processos")
    .where("devedorId", "==", devedorId)
    .onSnapshot(
      (snapshot) => {
        const processos = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        state.setProcessosCache(processos);
        renderProcessosList(processos, incidentesDoDevedor);
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
  state.setProcessosListenerUnsubscribe(unsubscribe);
}

// ... Lógica para Corresponsáveis ...
function setupCorresponsaveisListener(processoId) {
  if (state.corresponsaveisListenerUnsubscribe)
    state.corresponsaveisListenerUnsubscribe();
  const unsubscribe = db
    .collection("corresponsaveis")
    .where("processoId", "==", processoId)
    .orderBy("criadoEm", "desc")
    .onSnapshot((snapshot) => {
      const corresponsaveis = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      renderCorresponsaveisList(corresponsaveis, processoId);
    });
  state.setCorresponsaveisListenerUnsubscribe(unsubscribe);
}
function renderCorresponsaveisList(corresponsaveis, processoId) {
  const container = document.getElementById("corresponsaveis-list-container");
  if (!container) return;
  container.dataset.processoId = processoId;
  if (corresponsaveis.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhum corresponsável cadastrado.</p>`;
    return;
  }
  let tableHTML = `<table class="data-table"><thead><tr><th>Nome / Razão Social</th><th>CPF/CNPJ</th><th class="detail-actions-cell">Ações</th></tr></thead><tbody>`;
  corresponsaveis.forEach((item) => {
    tableHTML += `<tr data-id="${item.id}" data-nome="${
      item.nome
    }" data-cpf-cnpj="${item.cpfCnpj || ""}"><td >${
      item.nome
    }</td><td>${formatDocumentForDisplay(
      item.cpfCnpj
    )}</td><td class="detail-actions-cell"><div class="actions-container"><button class="action-icon icon-edit" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button><button class="action-icon icon-delete" title="Excluir"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></div></td></tr>`;
  });
  tableHTML += `</tbody></table>`;
  container.innerHTML = tableHTML;
  container
    .querySelector("tbody")
    .addEventListener("click", handleCorresponsavelAction);
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
            <div class="form-group"><label for="corresponsavel-nome">Nome / Razão Social (Obrigatório)</label><input type="text" id="corresponsavel-nome" value="${
              isEditing ? corresponsavel.nome : ""
            }" required></div>
            <div class="form-group"><label for="tipo-pessoa">Tipo de Pessoa</label><select id="tipo-pessoa" class="import-devedor-select"><option value="fisica">Pessoa Física</option><option value="juridica">Pessoa Jurídica</option></select></div>
            <div class="form-group"><label for="corresponsavel-documento">CPF / CNPJ</label><input type="text" id="corresponsavel-documento" value="${
              isEditing ? formatDocumentForDisplay(corresponsavel.cpfCnpj) : ""
            }" placeholder="Digite o CPF"></div>
            <div id="error-message"></div>
            <div class="form-buttons"><button id="save-corresponsavel-btn" class="btn-primary">Salvar</button><button id="cancel-corresponsavel-btn">Cancelar</button></div>
        </div>
    `;
  document.body.appendChild(modalOverlay);
  const tipoPessoaSelect = document.getElementById("tipo-pessoa");
  const documentoInput = document.getElementById("corresponsavel-documento");
  tipoPessoaSelect.value = tipoPessoa;
  const updateDocumentField = () => {
    documentoInput.placeholder =
      tipoPessoaSelect.value === "fisica" ? "Digite o CPF" : "Digite o CNPJ";
    documentoInput.value = "";
  };
  updateDocumentField();
  documentoInput.addEventListener("input", () =>
    maskDocument(documentoInput, tipoPessoaSelect.value)
  );
  tipoPessoaSelect.addEventListener("change", updateDocumentField);
  if (isEditing)
    documentoInput.value = formatDocumentForDisplay(corresponsavel.cpfCnpj);
  else updateDocumentField();
  const closeModal = () => document.body.removeChild(modalOverlay);
  document
    .getElementById("save-corresponsavel-btn")
    .addEventListener("click", () =>
      handleSaveCorresponsavel(processoId, isEditing ? corresponsavel.id : null)
    );
  document
    .getElementById("cancel-corresponsavel-btn")
    .addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
}
function handleCorresponsavelAction(event) {
  const button = event.target.closest(".action-icon");
  if (!button) return;
  const row = button.closest("tr");
  const corresponsavelId = row.dataset.id;
  const processoId = document.getElementById("corresponsaveis-list-container")
    .dataset.processoId;
  if (button.classList.contains("icon-edit")) {
    renderCorresponsavelFormModal(processoId, {
      id: corresponsavelId,
      nome: row.dataset.nome,
      cpfCnpj: row.dataset.cpfCnpj,
    });
  } else if (button.classList.contains("icon-delete")) {
    handleDeleteCorresponsavel(corresponsavelId);
  }
}
function handleSaveCorresponsavel(processoId, corresponsavelId = null) {
  const nome = document.getElementById("corresponsavel-nome").value.trim();
  if (!nome) {
    document.getElementById("error-message").textContent =
      "O campo Nome / Razão Social é obrigatório.";
    return;
  }
  const data = {
    processoId,
    nome,
    cpfCnpj: document
      .getElementById("corresponsavel-documento")
      .value.replace(/\D/g, ""),
  };
  const promise = corresponsavelId
    ? db
        .collection("corresponsaveis")
        .doc(corresponsavelId)
        .update({
          ...data,
          atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        })
    : db.collection("corresponsaveis").add({
        ...data,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });
  promise
    .then(() => {
      showToast(
        `Corresponsável ${
          corresponsavelId ? "atualizado" : "salvo"
        } com sucesso!`
      );
      document.body.removeChild(document.querySelector(".modal-overlay"));
    })
    .catch(
      () =>
        (document.getElementById("error-message").textContent =
          "Ocorreu um erro ao salvar.")
    );
}
function handleDeleteCorresponsavel(corresponsavelId) {
  if (confirm("Tem certeza que deseja excluir este corresponsável?")) {
    db.collection("corresponsaveis")
      .doc(corresponsavelId)
      .delete()
      .then(() => showToast("Corresponsável excluído com sucesso."))
      .catch(() => showToast("Erro ao excluir o corresponsável.", "error"));
  }
}

// ... Lógica para Penhoras ...
function setupPenhorasListener(processoId) {
  if (state.penhorasListenerUnsubscribe) state.penhorasListenerUnsubscribe();
  const unsubscribe = db
    .collection("penhoras")
    .where("processoId", "==", processoId)
    .orderBy("criadoEm", "desc")
    .onSnapshot((snapshot) => {
      const penhoras = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      renderPenhorasList(penhoras, processoId);
    });
  state.setPenhorasListenerUnsubscribe(unsubscribe);
}
function renderPenhorasList(penhoras, processoId) {
  const container = document.getElementById("penhoras-list-container");
  if (!container) return;
  container.dataset.processoId = processoId;
  if (penhoras.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhuma penhora cadastrada para este processo.</p>`;
    return;
  }
  const truncateText = (text, maxLength) =>
    text.length <= maxLength ? text : text.substring(0, maxLength) + "...";
  let tableHTML = `<table class="data-table"><thead><tr><th>Descrição do Bem</th><th>Valor</th><th>Data</th><th class="detail-actions-cell">Ações</th></tr></thead><tbody>`;
  penhoras.forEach((item) => {
    const dataFormatada = item.data
      ? `${item.data.split("-")[2]}/${item.data.split("-")[1]}/${
          item.data.split("-")[0]
        }`
      : "Não informada";
    tableHTML += `<tr data-id="${item.id}" data-descricao="${
      item.descricao
    }" data-valor="${item.valor || ""}" data-data="${
      item.data || ""
    }"><td ><a href="#" class="view-penhora-link" data-action="view">${truncateText(
      item.descricao,
      80
    )}</a></td><td>${formatCurrency(
      item.valor || 0
    )}</td><td>${dataFormatada}</td><td class="detail-actions-cell"><div class="actions-container"><button class="action-icon icon-edit" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button><button class="action-icon icon-delete" title="Excluir"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></div></td></tr>`;
  });
  tableHTML += `</tbody></table>`;
  container.innerHTML = tableHTML;
  container
    .querySelector("tbody")
    .addEventListener("click", handlePenhoraAction);
}
function renderPenhoraFormModal(
  processoId,
  penhora = null,
  isReadOnly = false
) {
  const isEditing = penhora !== null;
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  let formContentHTML = isReadOnly
    ? `<div class="form-group"><label>Descrição Completa</label><div class="readonly-textarea">${penhora.descricao}</div></div>`
    : `<div class="form-group"><label for="penhora-descricao">Descrição (Obrigatório)</label><textarea id="penhora-descricao" required rows="5">${
        isEditing ? penhora.descricao : ""
      }</textarea></div><div class="form-group"><label for="penhora-valor">Valor</label><input type="number" id="penhora-valor" placeholder="0.00" step="0.01" value="${
        isEditing ? penhora.valor : ""
      }"></div><div class="form-group"><label for="penhora-data">Data</label><input type="date" id="penhora-data" value="${
        isEditing ? penhora.data : ""
      }"></div><div id="error-message"></div>`;
  let formButtonsHTML = isReadOnly
    ? `<button id="close-penhora-btn" class="btn-primary">Fechar</button>`
    : `<button id="save-penhora-btn" class="btn-primary">Salvar</button><button id="cancel-penhora-btn">Cancelar</button>`;
  modalOverlay.innerHTML = `<div class="modal-content modal-large"><h3>${
    isReadOnly
      ? "Detalhes da Penhora"
      : (isEditing ? "Editar" : "Adicionar") + " Penhora"
  }</h3>${formContentHTML}<div class="form-buttons">${formButtonsHTML}</div></div>`;
  document.body.appendChild(modalOverlay);
  const closeModal = () => document.body.removeChild(modalOverlay);
  if (isReadOnly)
    document
      .getElementById("close-penhora-btn")
      .addEventListener("click", closeModal);
  else {
    document
      .getElementById("save-penhora-btn")
      .addEventListener("click", () =>
        handleSavePenhora(processoId, isEditing ? penhora.id : null)
      );
    document
      .getElementById("cancel-penhora-btn")
      .addEventListener("click", closeModal);
  }
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
}
function handlePenhoraAction(event) {
  event.preventDefault();
  const target = event.target;
  const viewLink = target.closest('[data-action="view"]');
  if (viewLink) {
    renderPenhoraFormModal(
      null,
      { descricao: viewLink.closest("tr").dataset.descricao },
      true
    );
    return;
  }
  const button = target.closest(".action-icon");
  if (button) {
    const row = button.closest("tr");
    const penhoraId = row.dataset.id;
    const processoId = document.getElementById("penhoras-list-container")
      .dataset.processoId;
    const penhoraData = {
      id: penhoraId,
      descricao: row.dataset.descricao,
      valor: row.dataset.valor,
      data: row.dataset.data,
    };
    if (button.classList.contains("icon-edit"))
      renderPenhoraFormModal(processoId, penhoraData, false);
    else if (button.classList.contains("icon-delete"))
      handleDeletePenhora(penhoraId);
  }
}
function handleSavePenhora(processoId, penhoraId = null) {
  const descricao = document.getElementById("penhora-descricao").value.trim();
  if (!descricao) {
    document.getElementById("error-message").textContent =
      "A Descrição é obrigatória.";
    return;
  }
  const penhoraData = {
    processoId,
    descricao,
    valor: parseFloat(document.getElementById("penhora-valor").value) || 0,
    data: document.getElementById("penhora-data").value || null,
  };
  const promise = penhoraId
    ? db
        .collection("penhoras")
        .doc(penhoraId)
        .update({
          ...penhoraData,
          atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        })
    : db.collection("penhoras").add({
        ...penhoraData,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });
  promise
    .then(() => {
      showToast(`Penhora ${penhoraId ? "atualizada" : "salva"} com sucesso!`);
      document.body.removeChild(document.querySelector(".modal-overlay"));
    })
    .catch(
      () =>
        (document.getElementById("error-message").textContent =
          "Ocorreu um erro ao salvar.")
    );
}
function handleDeletePenhora(penhoraId) {
  if (confirm("Tem certeza que deseja excluir esta penhora?")) {
    db.collection("penhoras")
      .doc(penhoraId)
      .delete()
      .then(() => showToast("Penhora excluída com sucesso."))
      .catch(() => showToast("Erro ao excluir a penhora.", "error"));
  }
}

// ... Lógica para Audiências ...
function setupAudienciasListener(processoId) {
  if (state.audienciasListenerUnsubscribe)
    state.audienciasListenerUnsubscribe();
  const unsubscribe = db
    .collection("audiencias")
    .where("processoId", "==", processoId)
    .orderBy("dataHora", "desc")
    .onSnapshot((snapshot) => {
      const audiencias = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      renderAudienciasList(audiencias, processoId);
    });
  state.setAudienciasListenerUnsubscribe(unsubscribe);
}
function renderAudienciasList(audiencias, processoId) {
  const container = document.getElementById("audiencias-list-container");
  if (!container) return;
  container.dataset.processoId = processoId;
  if (audiencias.length === 0) {
    container.innerHTML = `<p class="empty-list-message">Nenhuma audiência agendada.</p>`;
    return;
  }
  let tableHTML = `<table class="data-table"><thead><tr><th>Data e Hora</th><th>Local</th><th>Observações</th><th class="detail-actions-cell">Ações</th></tr></thead><tbody>`;
  audiencias.forEach((item) => {
    const dataFormatada = new Date(item.dataHora.seconds * 1000).toLocaleString(
      "pt-BR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
    tableHTML += `<tr data-id="${item.id}"><td>${dataFormatada}</td><td>${
      item.local || "Não informado"
    }</td><td style="white-space: pre-wrap;">${
      item.observacoes || ""
    }</td><td class="detail-actions-cell"><div class="actions-container"><button class="action-icon icon-edit" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button><button class="action-icon icon-delete" title="Excluir"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></div></td></tr>`;
  });
  tableHTML += `</tbody></table>`;
  container.innerHTML = tableHTML;
  container
    .querySelector("tbody")
    .addEventListener("click", (event) =>
      handleAudienciaAction(event, audiencias)
    );
}
function renderAudienciaFormModal(processoId, audiencia = null) {
  const isEditing = audiencia !== null;
  const dataHora =
    isEditing && audiencia.dataHora
      ? new Date(audiencia.dataHora.seconds * 1000).toISOString().slice(0, 16)
      : "";
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `
        <div class="modal-content">
            <h3>${isEditing ? "Editar" : "Agendar"} Audiência</h3>
            <div class="form-group"><label for="audiencia-data-hora">Data e Hora (Obrigatório)</label><input type="datetime-local" id="audiencia-data-hora" value="${dataHora}" required></div>
            <div class="form-group"><label for="audiencia-local">Local</label><input type="text" id="audiencia-local" placeholder="Ex: Sala de Audiências da 6ª Vara" value="${
              isEditing ? audiencia.local : ""
            }"></div>
            <div class="form-group"><label for="audiencia-obs">Observações</label><textarea id="audiencia-obs" rows="3">${
              isEditing ? audiencia.observacoes : ""
            }</textarea></div>
            <div id="error-message"></div>
            <div class="form-buttons"><button id="save-audiencia-btn" class="btn-primary">Salvar</button><button id="cancel-audiencia-btn">Cancelar</button></div>
        </div>
    `;
  document.body.appendChild(modalOverlay);
  const closeModal = () => document.body.removeChild(modalOverlay);
  document
    .getElementById("save-audiencia-btn")
    .addEventListener("click", () =>
      handleSaveAudiencia(processoId, isEditing ? audiencia.id : null)
    );
  document
    .getElementById("cancel-audiencia-btn")
    .addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
}
function handleAudienciaAction(event, audiencias) {
  const button = event.target.closest(".action-icon");
  if (!button) return;
  const row = button.closest("tr");
  const audienciaId = row.dataset.id;
  const processoId = document.getElementById("audiencias-list-container")
    .dataset.processoId;
  const audienciaData = audiencias.find((a) => a.id === audienciaId);
  if (button.classList.contains("icon-edit"))
    renderAudienciaFormModal(processoId, audienciaData);
  else if (button.classList.contains("icon-delete"))
    handleDeleteAudiencia(audienciaId);
}
function handleSaveAudiencia(processoId, audienciaId = null) {
  const dataHoraInput = document.getElementById("audiencia-data-hora").value;
  const errorMessage = document.getElementById("error-message");
  if (!dataHoraInput) {
    errorMessage.textContent = "O campo Data e Hora é obrigatório.";
    return;
  }
  const dataDaAudiencia = new Date(dataHoraInput);
  if (
    isNaN(dataDaAudiencia.getTime()) ||
    dataDaAudiencia.getFullYear() < 1900 ||
    dataDaAudiencia.getFullYear() > 2100
  ) {
    errorMessage.textContent = "Por favor, insira uma data e hora válidas.";
    return;
  }
  const processo = state.processosCache.find((p) => p.id === processoId);
  if (!processo) {
    errorMessage.textContent = "Erro: Processo associado não encontrado.";
    return;
  }
  const devedor = state.devedoresCache.find((d) => d.id === processo.devedorId);
  const audienciaData = {
    processoId,
    dataHora: dataDaAudiencia,
    local: document.getElementById("audiencia-local").value.trim(),
    observacoes: document.getElementById("audiencia-obs").value.trim(),
    numeroProcesso: processo.numeroProcesso,
    razaoSocialDevedor: devedor ? devedor.razaoSocial : "Não encontrado",
    devedorId: devedor ? devedor.id : null,
  };
  const promise = audienciaId
    ? db
        .collection("audiencias")
        .doc(audienciaId)
        .update({
          ...audienciaData,
          atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        })
    : db.collection("audiencias").add({
        ...audienciaData,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });
  promise
    .then(() => {
      showToast(
        `Audiência ${audienciaId ? "atualizada" : "agendada"} com sucesso!`
      );
      document.body.removeChild(document.querySelector(".modal-overlay"));
    })
    .catch(() => (errorMessage.textContent = "Ocorreu um erro ao salvar."));
}
function handleDeleteAudiencia(audienciaId) {
  if (confirm("Tem certeza que deseja cancelar esta audiência?")) {
    db.collection("audiencias")
      .doc(audienciaId)
      .delete()
      .then(() => showToast("Audiência cancelada com sucesso."))
      .catch(() => showToast("Erro ao cancelar a audiência.", "error"));
  }
}

// ... Lógica para Incidentes Vinculados ao Processo ...
function setupIncidentesDoProcessoListener(numeroProcessoPrincipal) {
  if (state.incidentesListenerUnsubscribe)
    state.incidentesListenerUnsubscribe();
  const unsubscribe = db
    .collection("incidentesProcessuais")
    .where("numeroProcessoPrincipal", "==", numeroProcessoPrincipal)
    .onSnapshot((snapshot) => {
      const incidentes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      renderIncidentesDoProcessoList(incidentes);
    });
  state.setIncidentesListenerUnsubscribe(unsubscribe);
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
    tableHTML += `<tr data-id="${item.id}" data-descricao="${
      item.descricao
    }"><td><a href="#" class="view-processo-link" data-action="view-details">${formatProcessoForDisplay(
      item.numeroIncidente
    )}</a></td><td title="${item.descricao}">${descricaoResumida.replace(
      /\n/g,
      "<br>"
    )}</td><td><span class="status-badge status-${item.status
      .toLowerCase()
      .replace(" ", "-")}">${
      item.status
    }</span></td><td class="detail-actions-cell"><div class="actions-container"><button class="action-icon icon-edit" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button><button class="action-icon icon-delete" title="Excluir"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></div></td></tr>`;
  });
  tableHTML += `</tbody></table>`;
  container.innerHTML = tableHTML;
  const table = container.querySelector(".data-table");
  if (table) table.addEventListener("click", handleIncidenteAction);
}

// ... Lógica para Anexos ...
function setupAnexosListener(processoId) {
  if (state.anexosListenerUnsubscribe) state.anexosListenerUnsubscribe();
  const unsubscribe = db
    .collection("anexos")
    .where("processoId", "==", processoId)
    .orderBy("criadoEm", "desc")
    .onSnapshot((snapshot) => {
      const anexos = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      renderAnexosUI(anexos, processoId);
    });
  state.setAnexosListenerUnsubscribe(unsubscribe);
}
function renderAnexosUI(anexos, processoId) {
  const actionsContainer = document.getElementById("anexos-actions-container");
  if (!actionsContainer) return;
  let actionsHTML =
    anexos.length > 0
      ? `<button id="view-anexos-btn" class="btn-secondary">Visualizar Anexos (${anexos.length})</button>`
      : "";
  actionsHTML += `<button id="add-anexo-btn" class="btn-primary" style="margin-left: 8px;">Anexar Novo</button>`;
  actionsContainer.innerHTML = actionsHTML;
  if (anexos.length > 0)
    document
      .getElementById("view-anexos-btn")
      .addEventListener("click", () => renderAnexosListModal(anexos));
  document
    .getElementById("add-anexo-btn")
    .addEventListener("click", () => renderAnexoFormModal(processoId));
  document.getElementById("anexos-list-container").innerHTML =
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
            <div class="form-group"><label for="anexo-nome">Nome do Arquivo (Obrigatório)</label><input type="text" id="anexo-nome" placeholder="Ex: Petição da União, Decisão, etc." required></div>
            <div class="form-group"><label for="anexo-file">Selecionar Arquivo (PDF)</label><input type="file" id="anexo-file" accept=".pdf" required></div>
            <div id="error-message"></div>
            <div class="form-buttons"><button id="save-anexo-btn" class="btn-primary">Salvar Anexo</button><button id="cancel-anexo-btn">Cancelar</button></div>
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
  const file = document.getElementById("anexo-file").files[0];
  const saveButton = document.getElementById("save-anexo-btn");
  const errorMessage = document.getElementById("error-message");
  if (!nomeArquivo || !file) {
    errorMessage.textContent = "Nome e seleção de arquivo são obrigatórios.";
    return;
  }
  saveButton.disabled = true;
  saveButton.textContent = "Enviando...";
  try {
    const storagePath = `anexos/${processoId}/${Date.now()}-${file.name}`;
    const uploadTask = await storage.ref(storagePath).put(file);
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
    errorMessage.textContent =
      "Ocorreu um erro durante o upload. Tente novamente.";
    saveButton.disabled = false;
    saveButton.textContent = "Salvar Anexo";
  }
}
function renderAnexosListModal(anexos) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  let anexosHTML =
    anexos.length === 0
      ? `<p class="empty-list-message">Nenhum anexo encontrado.</p>`
      : `<ul class="anexos-list">`;
  if (anexos.length > 0) {
    anexos.forEach((anexo) => {
      const dataAnexo = anexo.criadoEm
        ? anexo.criadoEm.toDate().toLocaleDateString("pt-BR")
        : "Data indisponível";
      anexosHTML += `<li class="anexo-item"><div class="anexo-info"><span class="anexo-nome">${anexo.nomeArquivo}</span><span class="anexo-data">Anexado em: ${dataAnexo}</span></div><div class="anexo-actions"><a href="${anexo.downloadURL}" target="_blank" rel="noopener noreferrer" class="action-icon" title="Visualizar/Baixar"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#555"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg></a><button class="action-icon icon-delete" title="Excluir Anexo" data-id="${anexo.id}" data-path="${anexo.storagePath}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></div></li>`;
    });
    anexosHTML += `</ul>`;
  }
  modalOverlay.innerHTML = `<div class="modal-content modal-large"><h3>Anexos do Processo</h3>${anexosHTML}<div class="form-buttons" style="justify-content: flex-end; margin-top: 20px;"><button id="close-anexos-modal" class="btn-secondary">Fechar</button></div></div>`;
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
    if (deleteButton)
      handleDeleteAnexo(deleteButton.dataset.id, deleteButton.dataset.path);
  });
}
async function handleDeleteAnexo(anexoId, storagePath) {
  if (!confirm("Tem certeza que deseja excluir este anexo permanentemente?"))
    return;
  try {
    if (storagePath) await storage.ref(storagePath).delete();
    await db.collection("anexos").doc(anexoId).delete();
    showToast("Anexo excluído com sucesso.");
    const modal = document.querySelector(".modal-overlay");
    if (modal) modal.remove();
  } catch (error) {
    showToast("Ocorreu um erro ao excluir o anexo.", "error");
  }
}
