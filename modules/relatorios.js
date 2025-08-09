// ==================================================================
// Módulo: relatorios.js
// Responsabilidade: Lógica de geração de todos os relatórios da aplicação.
// (Versão com exportação de PDF padronizada e com logo)
// ==================================================================

import { db } from "./firebase.js";
import {
  contentArea,
  pageTitle,
  showToast,
  renderReadOnlyTextModal,
  showLoadingOverlay,
  hideLoadingOverlay,
} from "./ui.js";
import { navigateTo } from "./navigation.js";
import * as state from "./state.js";
import {
  formatProcessoForDisplay,
  formatCurrency,
  loadImageAsBase64,
} from "./utils.js";

/**
 * Renderiza a estrutura principal da página de Relatórios.
 */
export function renderRelatoriosPage() {
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
                    <option value="processosPorTipoStatus">a) Processos</option> 
                    <option value="penhorasPorDevedor">b) Constrições Patrimoniais</option>
                    <option value="incidentesPorDevedor">c) Incidentes Processuais</option>
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
      renderReportFilters(e.target.value);
    });
}

/**
 * Renderiza os campos de filtro apropriados para o tipo de relatório selecionado.
 * @param {string} reportType - O tipo de relatório (ex: 'processosPorTipoStatus').
 */
export function renderReportFilters(reportType) {
  const filtersContainer = document.getElementById("report-filters-container");
  if (!filtersContainer) return;

  filtersContainer.innerHTML = "";
  document.getElementById("report-results-container").innerHTML = "";

  if (!reportType) return;

  let filtersHTML = '<div class="detail-card">';

  const exequenteOptions = state.exequentesCache
    .map((ex) => `<option value="${ex.id}">${ex.nome}</option>`)
    .join("");
  const devedorOptions = [...state.devedoresCache]
    .sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial))
    .map((dev) => `<option value="${dev.id}">${dev.razaoSocial}</option>`)
    .join("");

  switch (reportType) {
    case "processosPorTipoStatus":
      filtersHTML += `<h4>Filtros para "Processos"</h4><div class="detail-grid" style="grid-template-columns: repeat(4, 1fr); gap: 20px; align-items: end;"><div class="form-group"><label for="filtro-devedor">Executado</label><select id="filtro-devedor" class="import-devedor-select"><option value="">Todos</option>${devedorOptions}</select></div><div class="form-group"><label for="filtro-exequente">Exequente</label><select id="filtro-exequente" class="import-devedor-select"><option value="">Todos</option>${exequenteOptions}</select></div><div class="form-group"><label for="filtro-tipo-processo">Tipo</label><select id="filtro-tipo-processo" class="import-devedor-select"><option value="">Todos</option><option value="piloto">Piloto</option><option value="apenso">Apenso</option><option value="autonomo">Autônomo</option></select></div><div class="form-group"><label for="filtro-status-processo">Status</label><select id="filtro-status-processo" class="import-devedor-select"><option value="">Todos</option><option value="Ativo">Ativo</option><option value="Suspenso">Suspenso</option><option value="Baixado">Baixado</option><option value="Extinto">Extinto</option></select></div></div><div style="margin-top: 20px;"><button id="gerar-relatorio-btn" class="btn-primary">Gerar Relatório</button></div>`;
      break;
    case "penhorasPorDevedor":
      filtersHTML += `<h4>Filtros para "Constrições Patrimoniais"</h4><div class="detail-grid" style="grid-template-columns: repeat(3, 1fr); gap: 20px; align-items: end;"><div class="form-group"><label for="filtro-devedor-penhora">Executado (Obrigatório)</label><select id="filtro-devedor-penhora" class="import-devedor-select" required><option value="">Selecione...</option>${devedorOptions}</select></div><div class="form-group"><label for="filtro-exequente-penhora">Exequente (Opcional)</label><select id="filtro-exequente-penhora" class="import-devedor-select"><option value="">Todos</option>${exequenteOptions}</select></div><div class="form-group"><label for="filtro-processo-penhora">Processo (Opcional)</label><select id="filtro-processo-penhora" class="import-devedor-select" disabled><option value="">Todos</option></select></div></div><div style="margin-top: 20px;"><button id="gerar-relatorio-penhora-btn" class="btn-primary">Gerar Relatório</button></div>`;
      break;
    case "incidentesPorDevedor":
      filtersHTML += `<h4>Filtros para "Incidentes Processuais"</h4><div class="detail-grid" style="grid-template-columns: repeat(2, 1fr); gap: 20px; align-items: end;"><div class="form-group"><label for="filtro-devedor-incidente">Executado (Obrigatório)</label><select id="filtro-devedor-incidente" class="import-devedor-select" required><option value="">Selecione...</option>${devedorOptions}</select></div><div class="form-group"><label for="filtro-exequente-incidente">Exequente (Opcional)</label><select id="filtro-exequente-incidente" class="import-devedor-select"><option value="">Todos</option>${exequenteOptions}</select></div></div><div style="margin-top: 20px;"><button id="gerar-relatorio-incidente-btn" class="btn-primary">Gerar Relatório</button></div>`;
      break;
    case "processosPorValor":
      filtersHTML += `<h4>Filtros para "Valor da Execução"</h4><div class="detail-grid" style="grid-template-columns: repeat(3, 1fr); gap: 20px; align-items: end;"><div class="form-group"><label for="filtro-condicao-valor">Condição</label><select id="filtro-condicao-valor" class="import-devedor-select"><option value="maior">Maior que</option><option value="menor">Menor que</option></select></div><div class="form-group"><label for="filtro-valor">Valor (R$)</label><input type="number" id="filtro-valor" placeholder="Ex: 50000" class="form-group input" style="width: 100%; padding: 12px; border: 1px solid var(--cor-borda); border-radius: 4px; font-size: 16px;"></div><div class="form-group"></div><div class="form-group"><label for="filtro-devedor">Executado</label><select id="filtro-devedor" class="import-devedor-select"><option value="">Todos</option>${devedorOptions}</select></div><div class="form-group"><label for="filtro-exequente">Exequente</label><select id="filtro-exequente" class="import-devedor-select"><option value="">Todos</option>${exequenteOptions}</select></div><div class="form-group"></div><div class="form-group"><label for="filtro-tipo-processo">Tipo</label><select id="filtro-tipo-processo" class="import-devedor-select"><option value="">Todos</option><option value="piloto">Piloto</option><option value="apenso">Apenso</option><option value="autonomo">Autônomo</option></select></div><div class="form-group"><label for="filtro-status-processo">Status</label><select id="filtro-status-processo" class="import-devedor-select"><option value="">Todos</option><option value="Ativo">Ativo</option><option value="Suspenso">Suspenso</option><option value="Baixado">Baixado</option><option value="Extinto">Extinto</option></select></div></div><div style="margin-top: 20px;"><button id="gerar-relatorio-btn" class="btn-primary">Gerar Relatório</button></div>`;
      break;
  }

  filtersHTML += "</div>";
  filtersContainer.innerHTML = filtersHTML;

  if (
    reportType === "processosPorTipoStatus" ||
    reportType === "processosPorValor"
  ) {
    document
      .getElementById("gerar-relatorio-btn")
      .addEventListener("click", gerarRelatorioProcessos);
  } else if (reportType === "penhorasPorDevedor") {
    document
      .getElementById("gerar-relatorio-penhora-btn")
      .addEventListener("click", gerarRelatorioPenhoras);
    document
      .getElementById("filtro-devedor-penhora")
      .addEventListener("change", (e) =>
        populateProcessosFiltro(e.target.value)
      );
  } else if (reportType === "incidentesPorDevedor") {
    document
      .getElementById("gerar-relatorio-incidente-btn")
      .addEventListener("click", gerarRelatorioIncidentes);
  }
}

/**
 * Preenche o select de processos com base no devedor selecionado no filtro.
 */
export async function populateProcessosFiltro(devedorId) {
  const processoSelect = document.getElementById("filtro-processo-penhora");
  processoSelect.innerHTML = '<option value="">Carregando...</option>';
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
      processos.sort((a, b) =>
        a.numeroProcesso.localeCompare(b.numeroProcesso)
      );
      let optionsHTML = '<option value="">Todos</option>';
      processos.forEach((proc) => {
        optionsHTML += `<option value="${proc.id}">${formatProcessoForDisplay(
          proc.numeroProcesso
        )}</option>`;
      });
      processoSelect.innerHTML = optionsHTML;
      processoSelect.disabled = false;
    } else {
      processoSelect.innerHTML = '<option value="">Nenhum processo</option>';
    }
  } catch (error) {
    processoSelect.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

// --- Relatório de Processos ---
async function gerarRelatorioProcessos() {
  const tipo = document.getElementById("filtro-tipo-processo")?.value;
  const status = document.getElementById("filtro-status-processo")?.value;
  const exequenteId = document.getElementById("filtro-exequente")?.value;
  const devedorId = document.getElementById("filtro-devedor")?.value;
  const condicaoValor = document.getElementById("filtro-condicao-valor")?.value;
  const valorFiltro = document.getElementById("filtro-valor")?.value
    ? parseFloat(document.getElementById("filtro-valor").value)
    : null;

  const resultsContainer = document.getElementById("report-results-container");
  resultsContainer.innerHTML = `<p class="empty-list-message">Gerando relatório...</p>`;

  try {
    let query = db.collection("processos");
    if (tipo)
      query = query.where(
        "tipoProcesso",
        "==",
        tipo === "autonomo" ? "autônomo" : tipo
      );
    if (status) query = query.where("status", "==", status);
    if (exequenteId) query = query.where("exequenteId", "==", exequenteId);
    if (devedorId) query = query.where("devedorId", "==", devedorId);

    const snapshot = await query.get();
    let processos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (valorFiltro !== null && !isNaN(valorFiltro)) {
      processos = processos.filter((proc) => {
        const valorProcesso = proc.valorAtual?.valor || proc.valorDivida || 0;
        return condicaoValor === "maior"
          ? valorProcesso > valorFiltro
          : valorProcesso < valorFiltro;
      });
    }

    state.setCurrentReportData(processos);
    state.setCurrentSortState({ key: null, direction: "asc" });
    renderRelatorioProcessosResultados(processos);
  } catch (error) {
    if (error.code === "failed-precondition") {
      resultsContainer.innerHTML = `<p class="empty-list-message error"><b>Erro:</b> A combinação de filtros selecionada requer um índice no banco de dados que não existe. Verifique o console do navegador (F12) para criar o índice.</p>`;
    } else {
      resultsContainer.innerHTML = `<p class="empty-list-message error">Ocorreu um erro ao gerar o relatório.</p>`;
    }
  }
}

function renderRelatorioProcessosResultados(processos) {
  const resultsContainer = document.getElementById("report-results-container");
  if (processos.length === 0) {
    resultsContainer.innerHTML = `<p class="empty-list-message">Nenhum processo encontrado.</p>`;
    return;
  }
  const total = processos.length;
  const valorTotal = processos.reduce(
    (sum, proc) => sum + (proc.valorAtual?.valor || proc.valorDivida || 0),
    0
  );

  resultsContainer.innerHTML = `
        <div class="detail-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3>Resultados do Relatório</h3>
                <button id="download-pdf-btn" class="action-icon" title="Exportar para PDF">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                </button>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <p><strong>Total de Processos:</strong> ${total}</p>
                <p><strong>Valor Total das Dívidas:</strong> ${formatCurrency(
                  valorTotal
                )}</p>
            </div>
            <table class="data-table" id="report-table">
                <thead>
                    <tr>
                        <th class="sortable" data-sort-key="numeroProcesso">Nº do Processo <span class="sort-icon"></span></th>
                        <th class="sortable" data-sort-key="devedor">Devedor <span class="sort-icon"></span></th>
                        <th class="sortable" data-sort-key="exequente">Exequente <span class="sort-icon"></span></th>
                        <th class="sortable" data-sort-key="valor">Valor <span class="sort-icon"></span></th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>`;

  renderReportTableBody(processos);
  resultsContainer
    .querySelector("thead")
    .addEventListener("click", handleReportSort);
  document
    .getElementById("download-pdf-btn")
    .addEventListener("click", gerarPDFRelatorioProcessos);
}

function renderReportTableBody(processos) {
  const tableBody = document.querySelector("#report-table tbody");
  if (!tableBody) return;
  let bodyHTML = "";
  processos.forEach((proc) => {
    const devedor = state.devedoresCache.find((d) => d.id === proc.devedorId);
    const exequente = state.exequentesCache.find(
      (e) => e.id === proc.exequenteId
    );
    const valor = proc.valorAtual?.valor || proc.valorDivida || 0;
    bodyHTML += `<tr><td><a href="#" class="view-processo-link" data-id="${
      proc.id
    }">${formatProcessoForDisplay(proc.numeroProcesso)}</a></td><td>${
      devedor ? devedor.razaoSocial : "N/A"
    }</td><td>${exequente ? exequente.nome : "N/A"}</td><td>${formatCurrency(
      valor
    )}</td></tr>`;
  });
  tableBody.innerHTML = bodyHTML;
  tableBody.addEventListener("click", (e) => {
    if (e.target.matches(".view-processo-link")) {
      e.preventDefault();
      navigateTo("processoDetail", { id: e.target.dataset.id });
    }
  });
}

function updateSortIcons() {
  document.querySelectorAll("#report-table th.sortable").forEach((th) => {
    const icon = th.querySelector(".sort-icon");
    if (th.dataset.sortKey === state.currentSortState.key) {
      icon.textContent = state.currentSortState.direction === "asc" ? "▲" : "▼";
    } else {
      icon.textContent = "";
    }
  });
}

/**
 * Lida com o clique no cabeçalho da tabela de relatório para ordenar os dados.
 */
function handleReportSort(event) {
  const target = event.target.closest("th.sortable");
  if (!target) return;

  const sortKey = target.dataset.sortKey;

  const newDirection =
    state.currentSortState.key === sortKey &&
    state.currentSortState.direction === "asc"
      ? "desc"
      : "asc";

  state.setCurrentSortState({ key: sortKey, direction: newDirection });

  state.currentReportData.sort((a, b) => {
    let comparison = 0;
    switch (sortKey) {
      case "numeroProcesso": {
        const anoA = parseInt(a.numeroProcesso.substring(9, 13), 10);
        const anoB = parseInt(b.numeroProcesso.substring(9, 13), 10);
        comparison = anoA - anoB;
        if (comparison === 0) {
          const seqA = parseInt(a.numeroProcesso.substring(0, 7), 10);
          const seqB = parseInt(b.numeroProcesso.substring(0, 7), 10);
          comparison = seqA - seqB;
        }
        break;
      }
      case "valor": {
        const valA = a.valorAtual?.valor || a.valorDivida || 0;
        const valB = b.valorAtual?.valor || b.valorDivida || 0;
        comparison = valA - valB;
        break;
      }
      case "devedor": {
        const valA =
          state.devedoresCache.find((d) => d.id === a.devedorId)?.razaoSocial ||
          "";
        const valB =
          state.devedoresCache.find((d) => d.id === b.devedorId)?.razaoSocial ||
          "";
        comparison = valA.localeCompare(valB, "pt-BR");
        break;
      }
      case "exequente": {
        const valA =
          state.exequentesCache.find((e) => e.id === a.exequenteId)?.nome || "";
        const valB =
          state.exequentesCache.find((e) => e.id === b.exequenteId)?.nome || "";
        comparison = valA.localeCompare(valB, "pt-BR");
        break;
      }
    }
    return newDirection === "asc" ? comparison : -comparison;
  });

  renderReportTableBody(state.currentReportData);
  updateSortIcons();
}

async function gerarPDFRelatorioProcessos() {
  if (state.currentReportData.length === 0) {
    showToast("Não há dados para gerar PDF.", "warning");
    return;
  }

  showLoadingOverlay("Gerando PDF...");
  try {
    const logoBase64 = await loadImageAsBase64("images/logo.png");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");
    const page_width = doc.internal.pageSize.getWidth();

    doc.addImage(logoBase64, "PNG", page_width / 2 - 20, 15, 40, 0);
    doc.setFontSize(18);
    doc.text("Relatório de Processos", page_width / 2, 45, {
      align: "center",
    });

    doc.autoTable({
      html: "#report-table",
      startY: 55,
      theme: "grid",
      headStyles: { fillColor: [13, 71, 161] },
      didParseCell: (data) => {
        if (data.section === "head") {
          data.cell.text = data.cell.text.map((s) =>
            s.replace(" ▲", "").replace(" ▼", "")
          );
        }
      },
    });

    doc.save(
      `SASIF-Relatorio-Processos-${new Date()
        .toLocaleDateString("pt-BR")
        .replace(/\//g, "-")}.pdf`
    );
    showToast("Arquivo PDF gerado com sucesso!", "success");
  } catch (error) {
    console.error("Erro ao gerar PDF de processos:", error);
    showToast("Ocorreu um erro ao gerar o PDF.", "error");
  } finally {
    hideLoadingOverlay();
  }
}

// --- Relatório de Penhoras (Constrições) ---
async function gerarRelatorioPenhoras() {
  const devedorId = document.getElementById("filtro-devedor-penhora").value;
  const exequenteId = document.getElementById("filtro-exequente-penhora").value;
  const processoId = document.getElementById("filtro-processo-penhora").value;

  const resultsContainer = document.getElementById("report-results-container");
  if (!devedorId) {
    resultsContainer.innerHTML = `<p class="empty-list-message error">Selecione um executado.</p>`;
    return;
  }
  resultsContainer.innerHTML = `<p class="empty-list-message">Gerando relatório...</p>`;

  try {
    let processosQuery = db
      .collection("processos")
      .where("devedorId", "==", devedorId);
    if (exequenteId)
      processosQuery = processosQuery.where("exequenteId", "==", exequenteId);
    if (processoId)
      processosQuery = processosQuery.where(
        firebase.firestore.FieldPath.documentId(),
        "==",
        processoId
      );

    const processosSnapshot = await processosQuery.get();
    if (processosSnapshot.empty) {
      resultsContainer.innerHTML = `<p class="empty-list-message">Nenhum processo encontrado.</p>`;
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
      resultsContainer.innerHTML = `<p class="empty-list-message">Nenhuma penhora encontrada.</p>`;
      return;
    }

    let penhoras = [];
    const chunks = [];
    for (let i = 0; i < processoIds.length; i += 10) {
      chunks.push(processoIds.slice(i, i + 10));
    }
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
      resultsContainer.innerHTML = `<p class="empty-list-message">Nenhuma penhora encontrada.</p>`;
      return;
    }

    const groupedData = penhoras.reduce((acc, penhora) => {
      const processo = processosMap.get(penhora.processoId);
      if (!processo) return acc;
      const exId = processo.exequenteId;
      if (!acc[exId]) acc[exId] = {};
      if (!acc[exId][processo.id]) acc[exId][processo.id] = [];
      acc[exId][processo.id].push(penhora);
      return acc;
    }, {});

    state.setCurrentReportData({
      raw: penhoras,
      grouped: groupedData,
      processos: processosMap,
    });
    renderRelatorioPenhorasResultados(groupedData, processosMap);
  } catch (error) {
    resultsContainer.innerHTML = `<p class="empty-list-message error">Ocorreu um erro ao gerar o relatório.</p>`;
  }
}

function renderRelatorioPenhorasResultados(groupedData, processosMap) {
  const resultsContainer = document.getElementById("report-results-container");
  let tableHTML = `<div class="detail-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3>Resultados do Relatório</h3>
                <button id="download-pdf-penhora-btn" class="action-icon" title="Exportar para PDF">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                </button>
            </div>
            <table class="data-table" id="report-table-penhoras"><thead><tr><th>Descrição do Bem</th><th style="width: 15%;">Valor</th><th style="width: 15%;">Data</th></tr></thead><tbody>`;
  for (const exequenteId in groupedData) {
    const exequente = state.exequentesCache.find((e) => e.id === exequenteId);
    tableHTML += `<tr class="group-header"><td colspan="3"><strong>Exequente:</strong> ${
      exequente ? exequente.nome : "N/I"
    }</td></tr>`;
    for (const processoId in groupedData[exequenteId]) {
      const processo = processosMap.get(processoId) || {
        numeroProcesso: "Desconhecido",
      };
      tableHTML += `<tr class="subgroup-header"><td colspan="3"><strong>Processo:</strong> ${formatProcessoForDisplay(
        processo.numeroProcesso
      )}</td></tr>`;
      groupedData[exequenteId][processoId].forEach((penhora) => {
        const dataFormatada = penhora.data
          ? `${penhora.data.split("-")[2]}/${penhora.data.split("-")[1]}/${
              penhora.data.split("-")[0]
            }`
          : "N/I";
        tableHTML += `<tr><td>${penhora.descricao}</td><td>${formatCurrency(
          penhora.valor || 0
        )}</td><td>${dataFormatada}</td></tr>`;
      });
    }
  }
  tableHTML += `</tbody></table></div>`;
  resultsContainer.innerHTML = tableHTML;
  document
    .getElementById("download-pdf-penhora-btn")
    .addEventListener("click", gerarPDFRelatorioPenhoras);
}

async function gerarPDFRelatorioPenhoras() {
  if (!state.currentReportData.grouped) {
    showToast("Não há dados para gerar PDF.", "warning");
    return;
  }
  showLoadingOverlay("Gerando PDF...");
  try {
    const logoBase64 = await loadImageAsBase64("images/logo.png");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");
    const page_width = doc.internal.pageSize.getWidth();

    doc.addImage(logoBase64, "PNG", page_width / 2 - 20, 15, 40, 0);
    doc.setFontSize(18);
    doc.text("Relatório de Constrições Patrimoniais", page_width / 2, 45, {
      align: "center",
    });

    const tableRows = [];
    for (const exequenteId in state.currentReportData.grouped) {
      const exequente = state.exequentesCache.find((e) => e.id === exequenteId);
      tableRows.push([
        {
          content: `Exequente: ${exequente ? exequente.nome : "N/I"}`,
          colSpan: 3,
          styles: {
            fontStyle: "bold",
            fillColor: "#eef1f5",
            textColor: "#333",
          },
        },
      ]);
      for (const processoId in state.currentReportData.grouped[exequenteId]) {
        const processo = state.currentReportData.processos.get(processoId) || {
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
        state.currentReportData.grouped[exequenteId][processoId].forEach(
          (penhora) => {
            const dataFormatada = penhora.data
              ? `${penhora.data.split("-")[2]}/${penhora.data.split("-")[1]}/${
                  penhora.data.split("-")[0]
                }`
              : "N/I";
            tableRows.push([
              penhora.descricao,
              formatCurrency(penhora.valor || 0),
              dataFormatada,
            ]);
          }
        );
      }
    }

    doc.autoTable({
      head: [["Descrição do Bem", "Valor", "Data"]],
      body: tableRows,
      startY: 55,
      theme: "grid",
      headStyles: { fillColor: [13, 71, 161] },
    });

    doc.save(
      `SASIF-Relatorio-Constricoes-${new Date()
        .toLocaleDateString("pt-BR")
        .replace(/\//g, "-")}.pdf`
    );
    showToast("Arquivo PDF gerado com sucesso!", "success");
  } catch (error) {
    console.error("Erro ao gerar PDF de constrições:", error);
    showToast("Ocorreu um erro ao gerar o PDF.", "error");
  } finally {
    hideLoadingOverlay();
  }
}

// --- Relatório de Incidentes ---
async function gerarRelatorioIncidentes() {
  const devedorId = document.getElementById("filtro-devedor-incidente").value;
  const exequenteId = document.getElementById(
    "filtro-exequente-incidente"
  ).value;
  const resultsContainer = document.getElementById("report-results-container");
  if (!devedorId) {
    resultsContainer.innerHTML = `<p class="empty-list-message error">Selecione um executado.</p>`;
    return;
  }
  resultsContainer.innerHTML = `<p class="empty-list-message">Gerando relatório...</p>`;

  try {
    let numerosProcessosFiltrados = null;
    if (exequenteId) {
      const processosSnapshot = await db
        .collection("processos")
        .where("devedorId", "==", devedorId)
        .where("exequenteId", "==", exequenteId)
        .get();
      if (processosSnapshot.empty) {
        resultsContainer.innerHTML = `<p class="empty-list-message">Nenhum processo para este executado e exequente.</p>`;
        return;
      }
      numerosProcessosFiltrados = processosSnapshot.docs.map(
        (doc) => doc.data().numeroProcesso
      );
    }

    let incidentesQuery = db
      .collection("incidentesProcessuais")
      .where("devedorId", "==", devedorId);
    if (numerosProcessosFiltrados) {
      incidentesQuery = incidentesQuery.where(
        "numeroProcessoPrincipal",
        "in",
        numerosProcessosFiltrados
      );
    }
    const incidentesSnapshot = await incidentesQuery.get();
    if (incidentesSnapshot.empty) {
      resultsContainer.innerHTML = `<p class="empty-list-message">Nenhum incidente encontrado.</p>`;
      return;
    }

    const incidentes = incidentesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    state.setCurrentReportData(incidentes);
    renderRelatorioIncidentesResultados(incidentes);
  } catch (error) {
    resultsContainer.innerHTML = `<p class="empty-list-message error">Ocorreu um erro ao gerar o relatório.</p>`;
  }
}

function renderRelatorioIncidentesResultados(incidentes) {
  const resultsContainer = document.getElementById("report-results-container");
  let tableHTML = `<div class="detail-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3>Resultados do Relatório de Incidentes</h3>
            <button id="download-pdf-incidente-btn" class="action-icon" title="Exportar para PDF">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            </button>
        </div>
        <table class="data-table"><thead><tr><th>Nº do Incidente</th><th>Processo Principal</th><th>Descrição</th></tr></thead><tbody>`;
  incidentes.forEach((incidente) => {
    const descricaoResumida =
      incidente.descricao.length > 100
        ? incidente.descricao.substring(0, 100) + "..."
        : incidente.descricao;
    tableHTML += `<tr><td><a href="#" class="view-processo-link" data-action="view-incidente-desc" data-id="${
      incidente.id
    }">${formatProcessoForDisplay(
      incidente.numeroIncidente
    )}</a></td><td>${formatProcessoForDisplay(
      incidente.numeroProcessoPrincipal
    )}</td><td title="Clique para ver a descrição completa"><a href="#" class="view-penhora-link" data-action="view-incidente-desc" data-id="${
      incidente.id
    }">${descricaoResumida.replace(/\n/g, "<br>")}</a></td></tr>`;
  });
  tableHTML += `</tbody></table></div>`;
  resultsContainer.innerHTML = tableHTML;
  resultsContainer
    .querySelector("tbody")
    ?.addEventListener("click", (event) => {
      const link = event.target.closest('[data-action="view-incidente-desc"]');
      if (link) {
        event.preventDefault();
        const incidenteCompleto = state.currentReportData.find(
          (inc) => inc.id === link.dataset.id
        );
        if (incidenteCompleto)
          renderReadOnlyTextModal(
            "Descrição Completa do Incidente",
            incidenteCompleto.descricao
          );
      }
    });
  document
    .getElementById("download-pdf-incidente-btn")
    .addEventListener("click", gerarPDFRelatorioIncidentes);
}

async function gerarPDFRelatorioIncidentes() {
  if (!state.currentReportData || state.currentReportData.length === 0) {
    showToast("Não há dados para gerar PDF.", "warning");
    return;
  }
  showLoadingOverlay("Gerando PDF...");
  try {
    const logoBase64 = await loadImageAsBase64("images/logo.png");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");
    const page_width = doc.internal.pageSize.getWidth();

    doc.addImage(logoBase64, "PNG", page_width / 2 - 20, 15, 40, 0);
    doc.setFontSize(18);
    doc.text("Relatório de Incidentes Processuais", page_width / 2, 45, {
      align: "center",
    });

    const tableRows = state.currentReportData.map((incidente) => [
      formatProcessoForDisplay(incidente.numeroIncidente),
      formatProcessoForDisplay(incidente.numeroProcessoPrincipal),
      incidente.descricao,
    ]);
    doc.autoTable({
      head: [["Nº do Incidente", "Processo Principal", "Descrição"]],
      body: tableRows,
      startY: 55,
      theme: "grid",
      headStyles: { fillColor: [13, 71, 161] },
      columnStyles: { 2: { cellWidth: "auto" } },
    });

    doc.save(
      `SASIF-Relatorio-Incidentes-${new Date()
        .toLocaleDateString("pt-BR")
        .replace(/\//g, "-")}.pdf`
    );
    showToast("Arquivo PDF gerado com sucesso!", "success");
  } catch (error) {
    console.error("Erro ao gerar PDF de incidentes:", error);
    showToast("Ocorreu um erro ao gerar o PDF.", "error");
  } finally {
    hideLoadingOverlay();
  }
}
