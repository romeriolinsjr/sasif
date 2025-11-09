// ==================================================================
// Módulo: configuracoes.js
// Responsabilidade: Gerenciamento de Configurações, Backup e Restauração.
// ==================================================================

import { db } from "./firebase.js";
import {
  contentArea,
  pageTitle,
  showToast,
  renderReadOnlyTextModal,
  showLoadingOverlay,
  hideLoadingOverlay,
  updateLoadingOverlay,
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
// Apenas a função renderConfiguracoesPage precisa ser alterada.

export function renderConfiguracoesPage() {
  pageTitle.textContent = "Configurações";
  document.title = "SASIF | Configurações";

  const isAdmin =
    state.currentUserProfile &&
    state.currentUserProfile.perfil === "administrador";

  const adminCardHTML = isAdmin
    ? `
    <div class="setting-card" data-action="goto-gerenciamento-dados">
        <h3>Gerenciamento de Dados</h3>
        <p>Backup, restauração e limpeza de dados do sistema.</p>
    </div>`
    : "";

  // O bloco <style> foi REMOVIDO daqui.
  contentArea.innerHTML = `
    <div class="settings-grid" id="settings-grid-container">
        <div class="setting-card" data-action="goto-exequentes"><h3>Gerenciar Exequentes</h3><p>Adicione, edite ou remova os entes exequentes.</p></div>
        <div class="setting-card" data-action="goto-motivos"><h3>Gerenciar Motivos de Suspensão</h3><p>Customize os motivos utilizados para suspender processos.</p></div>
        <div class="setting-card" data-action="goto-incidentes"><h3>Gerenciar Incidentes Processuais</h3><p>Cadastre e acompanhe processos incidentais.</p></div>
        <div class="setting-card" data-action="goto-importacao"><h3>Importação em Lote</h3><p>Importe múltiplos processos de uma só vez.</p></div>
        ${adminCardHTML}
    </div>`;

  const gridContainer = document.getElementById("settings-grid-container");
  if (gridContainer) {
    gridContainer.addEventListener("click", (e) => {
      const target = e.target.closest("[data-action]");
      if (!target) return;
      const action = target.dataset.action;
      switch (action) {
        case "goto-exequentes":
          navigateTo("exequentes");
          break;
        case "goto-motivos":
          navigateTo("motivos");
          break;
        case "goto-incidentes":
          navigateTo("incidentes");
          break;
        case "goto-importacao":
          navigateTo("importacao");
          break;
        case "goto-gerenciamento-dados":
          renderGerenciamentoDadosPage();
          break;
      }
    });
  }
}
function renderGerenciamentoDadosPage() {
  pageTitle.textContent = "Gerenciamento de Dados";
  document.title = "SASIF | Gerenciamento de Dados";
  contentArea.innerHTML = `
        <div class="dashboard-actions">
            <button id="back-to-config-btn" class="btn-secondary">← Voltar para Configurações</button>
        </div>
        <div class="settings-grid">
            <div class="setting-card" id="start-backup">
                <h3>Backup de Dados</h3>
                <p>Gere e baixe um arquivo com todos os dados do sistema.</p>
            </div>
            <div class="setting-card restore-card" id="start-restore">
                <h3>Restauração de Dados</h3>
                <p>Restaure o sistema a partir de um arquivo de backup.</p>
            </div>
            <div class="setting-card cleanup-card" id="cleanup-test-data">
                <h3>Limpar Dados de Teste</h3>
                <p>Remove as coleções temporárias criadas pelo "Modo de Teste".</p>
            </div>
        </div>
    `;

  document
    .getElementById("back-to-config-btn")
    .addEventListener("click", () => navigateTo("configuracoes"));
  document
    .getElementById("start-backup")
    .addEventListener("click", startBackupProcess);
  document
    .getElementById("start-restore")
    .addEventListener("click", startRestoreProcess);
  document
    .getElementById("cleanup-test-data")
    .addEventListener("click", cleanupTestData);
}

// ==================================================================
// SEÇÃO: BACKUP E RESTAURAÇÃO
// ==================================================================

// Dentro de configuracoes.js

const COLLECTIONS_SCHEMA = {
  grandes_devedores: {},
  exequentes: {},
  motivos_suspensao: {},
  diligenciasMensais: {},
  // --- AQUI ESTÁ A ADIÇÃO ---
  investigacoesFiscais: {},
  // -------------------------
  incidentesProcessuais: {},
  demandasEstruturais: {},
  corresponsaveis: {},
  penhoras: {},
  audiencias: {},
  anexos: {},
  processos: {
    historicoValores: {},
  },
  usuarios: {}, // <-- ADICIONE ESTA LINHA
};

/**
 * Função Auxiliar Definitiva: Converte recursivamente todos os objetos _fsTimestamp
 * em um objeto de dados, não importa quão aninhados estejam.
 * @param {*} data - O dado a ser processado (objeto, array, etc.).
 * @returns {*} O dado com todos os Timestamps convertidos.
 */
function deepConvertTimestamps(data) {
  if (!data) return data;

  // Caso base: é um objeto de timestamp, converte e retorna.
  if (data._fsTimestamp && typeof data._fsTimestamp.seconds === "number") {
    return new firebase.firestore.Timestamp(
      data._fsTimestamp.seconds,
      data._fsTimestamp.nanoseconds
    );
  }

  // Caso recursivo: é um array, processa cada item.
  if (Array.isArray(data)) {
    return data.map((item) => deepConvertTimestamps(item));
  }

  // Caso recursivo: é um objeto, processa cada valor.
  if (typeof data === "object") {
    const newObj = {};
    for (const key in data) {
      newObj[key] = deepConvertTimestamps(data[key]);
    }
    return newObj;
  }

  // Caso base: é um primitivo (string, número, etc.), retorna como está.
  return data;
}

// ---- Funções de Backup (Versão correta para USO FUTURO) ----

async function startBackupProcess() {
  if (
    !confirm(
      "Você deseja criar um backup completo do sistema? O processo pode levar alguns minutos."
    )
  )
    return;

  showLoadingOverlay("Calculando o total de itens para o backup...");
  try {
    let totalDocs = 0;
    const countPromises = Object.keys(COLLECTIONS_SCHEMA).map(
      (collectionName) =>
        db
          .collection(collectionName)
          .get()
          .then((snap) => snap.size)
    );
    const counts = await Promise.all(countPromises);
    totalDocs = counts.reduce((sum, count) => sum + count, 0);

    const progressTracker = { current: 0, total: totalDocs };

    const backupData = await fetchAllDataForBackup(progressTracker);

    updateLoadingOverlay(100, "Finalizando e gerando arquivo...");

    const jsonString = JSON.stringify(
      backupData,
      (key, value) => {
        if (value && typeof value.toDate === "function") {
          return {
            _fsTimestamp: {
              seconds: value.seconds,
              nanoseconds: value.nanoseconds,
            },
          };
        }
        return value;
      },
      2
    );

    downloadBackupFile(jsonString);

    // ALTERAÇÃO: Salva o timestamp do backup bem-sucedido no localStorage
    localStorage.setItem(
      "sasif_last_backup_timestamp",
      new Date().toISOString()
    );
    // Dispara um evento customizado para que a UI possa ser atualizada em tempo real
    window.dispatchEvent(new CustomEvent("backupCompleted"));

    showToast("Backup gerado com sucesso!", "success");
  } catch (error) {
    console.error("Erro ao gerar backup:", error);
    showToast(`Erro ao gerar backup: ${error.message}`, "error", null);
  } finally {
    hideLoadingOverlay();
  }
}

async function fetchAllDataForBackup(progressTracker) {
  const backupData = {};
  for (const collectionName in COLLECTIONS_SCHEMA) {
    const collectionRef = db.collection(collectionName);
    const schema = COLLECTIONS_SCHEMA[collectionName];

    backupData[collectionName] = await fetchCollectionDataRecursive(
      collectionRef,
      schema,
      progressTracker
    );
  }
  return backupData;
}

async function fetchCollectionDataRecursive(
  collectionRef,
  schema,
  progressTracker
) {
  const snapshot = await collectionRef.get();
  const data = [];

  for (const doc of snapshot.docs) {
    if (progressTracker.total > 0) {
      progressTracker.current++;
      const percentage = Math.round(
        (progressTracker.current / progressTracker.total) * 100
      );
      updateLoadingOverlay(
        percentage,
        `Fazendo backup: ${progressTracker.current} / ${progressTracker.total} itens...`
      );
    }

    const docData = { id: doc.id, ...doc.data() };
    for (const subCollName in schema) {
      const subCollSchema = schema[subCollName];
      const subCollRef = doc.ref.collection(subCollName);
      docData[subCollName] = await fetchCollectionDataRecursive(
        subCollRef,
        subCollSchema,
        { current: 0, total: 0 }
      );
    }
    data.push(docData);
  }
  return data;
}

function downloadBackupFile(jsonString) {
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `backup-sasif-${timestamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- Funções de Restauração (Versão correta e final) ----

function startRestoreProcess() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";

  input.onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const isTestMode = confirm(
      "Deseja executar a restauração em 'Modo de Teste'?\n\nNeste modo, os dados serão restaurados em coleções temporárias (com sufixo '_TESTE') e seus dados reais NÃO serão afetados."
    );

    let proceed = false;
    if (isTestMode) {
      proceed = confirm(
        "Você confirma que deseja iniciar a restauração em MODO DE TESTE?"
      );
    } else {
      if (
        confirm(
          "ATENÇÃO: A restauração real APAGARÁ TODOS os dados atuais do sistema. Esta ação é IRREVERSÍVEL. Deseja continuar?"
        )
      ) {
        const confirmationText = "RESTAURAR";
        const userInput = prompt(
          `Para confirmar, digite "${confirmationText}" no campo abaixo:`
        );
        if (userInput === confirmationText) {
          proceed = true;
        } else {
          showToast(
            "Restauração cancelada. Texto de confirmação incorreto.",
            "warning"
          );
        }
      }
    }

    if (!proceed) {
      showToast("Restauração cancelada pelo usuário.", "info");
      return;
    }

    showLoadingOverlay("Iniciando restauração...");

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const backupData = JSON.parse(e.target.result);

          let totalDocs = 0;
          for (const collectionName in backupData) {
            if (Array.isArray(backupData[collectionName])) {
              totalDocs += backupData[collectionName].length;
            }
          }
          const progressTracker = { current: 0, total: totalDocs };

          await deleteAllData(isTestMode);

          await restoreDataFromBackup(backupData, isTestMode, progressTracker);

          updateLoadingOverlay(
            100,
            "Restauração concluída! A página será recarregada."
          );
          showToast(
            "Restauração concluída com sucesso! A página será recarregada.",
            "success",
            5000
          );
          setTimeout(() => window.location.reload(), 5000);
        } catch (error) {
          console.error("ERRO FATAL NA RESTAURAÇÃO:", error);
          showToast(
            `Erro fatal na restauração: ${error.message}. Verifique o console.`,
            "error",
            null
          );
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error("ERRO AO LER ARQUIVO:", error);
      showToast(`Erro ao ler o arquivo: ${error.message}`, "error", null);
      hideLoadingOverlay();
    }
  };

  input.click();
}

async function deleteAllData(testMode = false) {
  const suffix = testMode ? "_TESTE" : "";
  showLoadingOverlay("Calculando itens para limpar...");

  let totalDocs = 0;
  const collectionNames = Object.keys(COLLECTIONS_SCHEMA);

  const countPromises = collectionNames.map(async (collectionName) => {
    const collectionRef = db.collection(collectionName + suffix);
    try {
      const snapshot = await collectionRef.get();
      return snapshot.size;
    } catch (e) {
      if (
        e.code.includes("permission-denied") ||
        e.code.includes("resource-exhausted")
      ) {
        console.error(`Erro crítico ao contar ${collectionName + suffix}:`, e);
        throw e;
      }
      console.warn(
        `Aviso: Não foi possível contar a coleção ${
          collectionName + suffix
        }. Pode não existir.`,
        e
      );
      return 0;
    }
  });

  try {
    const counts = await Promise.all(countPromises);
    totalDocs = counts.reduce((sum, count) => sum + count, 0);
  } catch (error) {
    showToast(
      "Erro crítico ao calcular itens para limpeza. Verifique o console.",
      "error",
      null
    );
    hideLoadingOverlay();
    return;
  }

  const progressTracker = { current: 0, total: totalDocs };
  updateLoadingOverlay(0, `Iniciando limpeza de ${totalDocs} itens...`);

  for (const collectionName in COLLECTIONS_SCHEMA) {
    const schema = COLLECTIONS_SCHEMA[collectionName];
    const collectionRef = db.collection(collectionName + suffix);
    await deleteCollectionRecursive(collectionRef, schema, progressTracker);
  }
}

async function deleteCollectionRecursive(
  collectionRef,
  schema,
  progressTracker
) {
  const snapshot = await collectionRef.get();

  if (snapshot.empty) {
    return;
  }

  const docs = snapshot.docs;
  const totalDocsInCollection = docs.length;
  let subItemCounter = 0;
  const hasSubCollections = Object.keys(schema).length > 0;

  if (hasSubCollections) {
    for (const doc of docs) {
      subItemCounter++;
      const currentPercentage =
        progressTracker.total > 0
          ? Math.round((progressTracker.current / progressTracker.total) * 100)
          : 0;
      updateLoadingOverlay(
        currentPercentage,
        `Limpando dados internos de '${collectionRef.id}' (${subItemCounter}/${totalDocsInCollection})`
      );

      for (const subCollName in schema) {
        const subCollRef = doc.ref.collection(subCollName);
        await _deleteCollectionInBatches(subCollRef, { current: 0, total: 0 });
      }
    }
  }

  await _deleteCollectionInBatches(collectionRef, progressTracker);
}

async function _deleteCollectionInBatches(collectionRef, progressTracker) {
  const snapshot = await collectionRef.limit(500).get();
  if (snapshot.size === 0) {
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  if (progressTracker && progressTracker.total > 0) {
    progressTracker.current += snapshot.size;
    if (progressTracker.current > progressTracker.total) {
      progressTracker.current = progressTracker.total;
    }
    const percentage = Math.round(
      (progressTracker.current / progressTracker.total) * 100
    );
    updateLoadingOverlay(
      percentage,
      `Limpando: ${progressTracker.current} / ${progressTracker.total} itens...`
    );
  }

  await _deleteCollectionInBatches(collectionRef, progressTracker);
}

async function restoreDataFromBackup(data, testMode = false, progressTracker) {
  const suffix = testMode ? "_TESTE" : "";

  for (const collectionName in data) {
    if (COLLECTIONS_SCHEMA[collectionName]) {
      const collectionRef = db.collection(collectionName + suffix);
      const schema = COLLECTIONS_SCHEMA[collectionName];
      await restoreCollectionRecursive(
        collectionRef,
        data[collectionName],
        schema,
        progressTracker
      );
    }
  }
}

async function restoreCollectionRecursive(
  collectionRef,
  collectionData,
  schema,
  progressTracker
) {
  for (const docData of collectionData) {
    try {
      if (progressTracker.total > 0) {
        progressTracker.current++;
        const percentage = Math.round(
          (progressTracker.current / progressTracker.total) * 100
        );
        updateLoadingOverlay(
          percentage,
          `Restaurando: ${progressTracker.current} / ${progressTracker.total} itens...`
        );
      }

      const { id, ...rest } = docData;
      const docRef = collectionRef.doc(id);

      // AQUI ESTÁ A CORREÇÃO FINAL: Usa a função recursiva para sanitizar os dados
      const sanitizedData = deepConvertTimestamps(rest);

      const payload = {};
      const subcollectionsToRestore = {};

      for (const key in sanitizedData) {
        if (schema[key] !== undefined && Array.isArray(sanitizedData[key])) {
          subcollectionsToRestore[key] = sanitizedData[key];
        } else {
          payload[key] = sanitizedData[key];
        }
      }

      await docRef.set(payload);

      for (const subCollName in subcollectionsToRestore) {
        const subCollSchema = schema[subCollName];
        const subCollRef = docRef.collection(subCollName);
        await restoreCollectionRecursive(
          subCollRef,
          subcollectionsToRestore[subCollName],
          subCollSchema,
          { current: 0, total: 0 }
        );
      }
    } catch (error) {
      console.error(
        `FALHA CRÍTICA ao restaurar o documento ${docData.id} na coleção ${collectionRef.path}.`
      );
      console.error("DADOS DO DOCUMENTO:", docData);
      console.error("ERRO ESPECÍFICO:", error);
      throw new Error(
        `Falha no documento '${docData.id}' da coleção '${collectionRef.path}'`
      );
    }
  }
}

async function cleanupTestData() {
  if (
    !confirm(
      "ATENÇÃO: Esta ação removerá TODAS as coleções com o sufixo '_TESTE'. Deseja continuar?"
    )
  )
    return;

  showLoadingOverlay("Limpando dados de teste...");
  try {
    await deleteAllData(true);
    showToast("Dados de teste removidos com sucesso!", "success");
  } catch (error) {
    console.error("Erro ao limpar dados de teste:", error);
    showToast(`Erro ao limpar dados de teste: ${error.message}`, "error", null);
  } finally {
    hideLoadingOverlay();
  }
}

// ==================================================================
// SEÇÕES DE GERENCIAMENTO (CÓDIGO INALTERADO)
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
            <div class="form-group"><label for="incidente-status">Status</label><select id="incidente-status" class="import-devedor-select">
                <option value="Ativo" ${
                  isEditing &&
                  (incidente.status === "Ativo" ||
                    incidente.status === "Em Andamento")
                    ? "selected"
                    : ""
                }>Ativo</option>
                <option value="Inativo" ${
                  isEditing &&
                  (incidente.status === "Inativo" ||
                    incidente.status === "Concluído")
                    ? "selected"
                    : ""
                }>Inativo</option>
            </select></div>
            <div id="error-message"></div>
            <div class="form-buttons">
                <button id="save-incidente-btn" class="btn-primary">Salvar</button>
                <button id="cancel-incidente-btn">Cancelar</button>
            </div>
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

    // --- INÍCIO DA CORREÇÃO ---
    // Lógica de tradução para o status e a classe do CSS
    let statusText = "Inativo";
    let statusClass = "status-baixado"; // Cor cinza (padrão)

    if (item.status === "Ativo" || item.status === "Em Andamento") {
      statusText = "Ativo";
      statusClass = "status-ativo"; // Cor verde
    }
    // --- FIM DA CORREÇÃO ---

    tableHTML += `<tr data-id="${item.id}" data-descricao="${
      item.descricao
    }"><td><a href="#" class="view-processo-link" data-action="view-details">${formatProcessoForDisplay(
      item.numeroIncidente
    )}</a></td><td>${formatProcessoForDisplay(
      item.numeroProcessoPrincipal
    )}</td><td>${
      devedor ? devedor.razaoSocial : "N/I"
    }</td><td><span class="status-badge ${statusClass}">${statusText}</span></td><td class="actions-cell"><button class="action-icon icon-edit" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button><button class="action-icon icon-delete" title="Excluir" data-id="${
      item.id
    }"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></td></tr>`;
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
