// ==================================================================
// Módulo: importacao.js
// Responsabilidade: Lógica da página de "Importação em Lote".
// ==================================================================

import { db, auth } from "./firebase.js";
import { contentArea, pageTitle } from "./ui.js";
import * as state from "./state.js";
import { formatProcessoForDisplay } from "./utils.js";

/**
 * Renderiza a página de Importação em Lote.
 */
export function renderImportacaoPage() {
  pageTitle.textContent = "Importação em Lote de Processos";
  document.title = "SASIF | Importação em Lote";

  const devedorOptions = [...state.devedoresCache]
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
                <select id="devedor-import-select" class="import-devedor-select" style="margin-top: 16px;">
                    <option value="">Selecione um devedor...</option>
                    ${devedorOptions}
                </select>
            </div>
            <div class="detail-card">
                <h3>2. Cole os Dados da Planilha</h3>
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

/**
 * Processa os dados colados da planilha e os importa para o Firebase.
 */
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
      '<div class="result-line error">Erro: Por favor, cole os dados da planilha.</div>';
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

    const exequente = state.exequentesCache.find(
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
      numeroProcesso,
      exequenteId: exequente.id,
      tipoProcesso,
      cdas: cdasRaw.trim(),
      devedorId,
      uidUsuario: auth.currentUser.uid,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      valorAtual: {
        valor,
        data: firebase.firestore.FieldValue.serverTimestamp(),
      },
    };

    if (tipoProcesso === "piloto") {
      processoData.status = "Ativo";
      processoData.id = db.collection("processos").doc().id;
      ultimoPilotoId = processoData.id;
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
      const { id, ...dataToSave } = proc;
      batch.set(db.collection("processos").doc(id), dataToSave);
    });

    try {
      await batch.commit();
      resultadosLog.push({
        type: "success",
        message: `\nLOTE FINALIZADO: ${processosParaCriar.length} processos importados com sucesso!`,
      });
    } catch (error) {
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
