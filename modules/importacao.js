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
 * Processa os dados colados da planilha e os importa para o Firebase,
 * verificando duplicados e pedindo a ação do usuário.
 */
async function handleProcessarImportacao() {
  const devedorId = document.getElementById("devedor-import-select").value;
  const rawData = document.getElementById("import-data-textarea").value;
  const resultsContainer = document.getElementById("import-results-container");
  const processarBtn = document.getElementById("processar-import-btn");

  if (!devedorId || !rawData.trim()) {
    resultsContainer.innerHTML =
      '<div class="result-line error">Erro: Selecione um devedor e cole os dados da planilha.</div>';
    return;
  }

  processarBtn.disabled = true;
  processarBtn.textContent = "Verificando...";
  resultsContainer.innerHTML =
    "Iniciando verificação de processos existentes...";

  const linhas = rawData.trim().split("\n");
  let importMode = "manter"; // 'manter' ou 'substituir'

  // ===== LÓGICA DE VERIFICAÇÃO DE DUPLICADOS =====
  const numerosDeProcessoNaLista = linhas
    .map((linha) => linha.split("\t")[0].replace(/\D/g, ""))
    .filter((np) => np.length === 20);

  // Para evitar limitações do 'where-in', fazemos a consulta em lotes de 10 se necessário
  const chunks = [];
  for (let i = 0; i < numerosDeProcessoNaLista.length; i += 10) {
    chunks.push(numerosDeProcessoNaLista.slice(i, i + 10));
  }

  const processosExistentesMap = new Map();
  for (const chunk of chunks) {
    const processosExistentesSnapshot = await db
      .collection("processos")
      .where("devedorId", "==", devedorId)
      .where("numeroProcesso", "in", chunk)
      .get();
    processosExistentesSnapshot.forEach((doc) => {
      processosExistentesMap.set(doc.data().numeroProcesso, doc.id);
    });
  }

  const duplicados = numerosDeProcessoNaLista.filter((np) =>
    processosExistentesMap.has(np)
  );

  if (duplicados.length > 0) {
    const userChoice = confirm(
      `Foram encontrados ${duplicados.length} processos que já existem no sistema para este devedor.\n\nClique em "OK" para SUBSTITUIR os dados dos processos existentes com as informações da sua lista.\n\nClique em "Cancelar" para MANTER os processos existentes e importar apenas os que são novos.`
    );
    importMode = userChoice ? "substituir" : "manter";
  }
  // ===== FIM DA LÓGICA DE VERIFICAÇÃO =====

  processarBtn.textContent = "Processando...";
  const resultadosLog = [];
  const processosParaCriar = [];
  const processosParaAtualizar = [];
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
        } (${numeroProcessoRaw}): Exequente "${exequenteNome}" não encontrado. Pulando.`,
      });
      continue;
    }

    const valor =
      parseFloat(
        String(valorRaw).replace("R$", "").replace(/\./g, "").replace(",", ".")
      ) || 0;
    const processoData = {
      numeroProcesso: numeroProcesso,
      exequenteId: exequente.id,
      tipoProcesso: tipoProcesso,
      cdas: cdasRaw.trim(),
      devedorId: devedorId,
      uidUsuario: auth.currentUser.uid,
      valorAtual: {
        valor: valor,
        data: firebase.firestore.FieldValue.serverTimestamp(),
      },
      // Os campos 'status' e 'processoPilotoId' são definidos abaixo
    };

    // ===== LÓGICA CONDICIONAL DE AÇÃO =====
    if (processosExistentesMap.has(numeroProcesso)) {
      if (importMode === "substituir") {
        const idExistente = processosExistentesMap.get(numeroProcesso);
        processosParaAtualizar.push({ id: idExistente, data: processoData });
        resultadosLog.push({
          type: "success",
          message: `Linha ${index + 1}: ${formatProcessoForDisplay(
            numeroProcesso
          )} marcado para SUBSTITUIÇÃO.`,
        });
      } else {
        resultadosLog.push({
          type: "info",
          message: `Linha ${index + 1}: ${formatProcessoForDisplay(
            numeroProcesso
          )} MANTIDO (ignorado).`,
        });
      }
      // Importante: atualiza o último piloto, mesmo se estiver mantendo
      if (tipoProcesso === "piloto") {
        ultimoPilotoId = processosExistentesMap.get(numeroProcesso);
      }
      continue;
    }

    // Lógica para processos NOVOS
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
      message: `Linha ${index + 1}: ${formatProcessoForDisplay(
        numeroProcesso
      )} validado para CRIAÇÃO.`,
    });
  }

  if (processosParaCriar.length > 0 || processosParaAtualizar.length > 0) {
    const batch = db.batch();

    processosParaCriar.forEach((proc) => {
      const { id, ...dataToSave } = proc;
      dataToSave.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
      batch.set(db.collection("processos").doc(id), dataToSave);
    });

    processosParaAtualizar.forEach((proc) => {
      proc.data.atualizadoEmImportacao =
        firebase.firestore.FieldValue.serverTimestamp();
      batch.update(db.collection("processos").doc(proc.id), proc.data);
    });

    try {
      await batch.commit();
      resultadosLog.push({
        type: "success",
        message: `\nLOTE FINALIZADO: ${processosParaCriar.length} processos criados e ${processosParaAtualizar.length} atualizados.`,
      });
    } catch (error) {
      console.error("Erro na importação em lote:", error);
      resultadosLog.push({
        type: "error",
        message: `\nERRO CRÍTICO: A importação falhou. Nenhuma alteração foi salva.`,
      });
    }
  } else {
    resultadosLog.push({
      type: "info",
      message: `\nNenhum processo novo para importar ou substituir.`,
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
