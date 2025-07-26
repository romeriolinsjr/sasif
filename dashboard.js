// ==================================================================
// Módulo: dashboard.js
// Responsabilidade: Lógica de renderização e funcionamento do Dashboard.
// ==================================================================

import { auth, db } from "./firebase.js";
import { contentArea, pageTitle } from "./ui.js";
import * as state from "./state.js";
import {
  getAnaliseStatus,
  formatProcessoForDisplay,
  getSafeDate,
} from "./utils.js"; // <-- 1. IMPORTAÇÃO DA FUNÇÃO SEGURA
import { navigateTo } from "./navigation.js";

/**
 * Renderiza a estrutura principal da página do Dashboard.
 */
export function renderDashboard() {
  pageTitle.textContent = "Dashboard";
  document.title = "SASIF | Dashboard";

  contentArea.innerHTML = `
        <div id="dashboard-widgets-container">
            <div id="diligencias-widget-container"></div>
            <div id="analises-widget-container"></div>
            <div id="audiencias-widget-container"></div>
        </div>
    `;

  setupDashboardWidgets();
}

// Substitua esta função
export function setupDashboardWidgets() {
  const hoje = new Date();
  const userId = auth.currentUser.uid;

  // Busca as tarefas (diligências) do usuário
  db.collection("diligenciasMensais")
    .where("userId", "==", userId)
    .get()
    .then((snapshot) => {
      const diligencias = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      renderProximasDiligenciasWidget(diligencias);
    })
    .catch((error) => {
      console.error("Erro ao buscar tarefas para o dashboard:", error);
      const container = document.getElementById("diligencias-widget-container");
      if (container)
        container.innerHTML = `<div class="widget-card"><h3>Próximas Tarefas</h3><p class="empty-list-message">Ocorreu um erro ao carregar.</p></div>`;
    });

  // Busca TODAS as audiências para filtrar no lado do cliente
  db.collection("audiencias")
    .get()
    .then((snapshot) => {
      const todasAudiencias = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Filtra e ordena no lado do cliente usando getSafeDate
      const audienciasFuturas = todasAudiencias
        .map((item) => ({ ...item, dataHoraObj: getSafeDate(item.dataHora) })) // Converte a data primeiro
        .filter((item) => item.dataHoraObj && item.dataHoraObj >= hoje) // Filtra as futuras
        .sort((a, b) => a.dataHoraObj - b.dataHoraObj) // Ordena pela data
        .slice(0, 10); // Pega as próximas 10

      renderProximasAudienciasWidget(audienciasFuturas);
    })
    .catch((error) => {
      console.error("Erro ao buscar audiências para o dashboard:", error);
      const container = document.getElementById("audiencias-widget-container");
      if (container)
        container.innerHTML = `<div class="widget-card"><h3>Próximas Audiências</h3><p class="empty-list-message">Ocorreu um erro ao carregar.</p></div>`;
    });

  // Renderiza o widget de análises pendentes usando os dados já em cache
  renderAnalisePendenteWidget(state.devedoresCache);
}

/**
 * Renderiza o widget de próximas tarefas.
 * @param {Array} diligencias - A lista de todas as diligências do usuário.
 */
function renderProximasDiligenciasWidget(diligencias) {
  const container = document.getElementById("diligencias-widget-container");
  if (!container) return;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const cincoDiasFrente = new Date(hoje);
  cincoDiasFrente.setDate(hoje.getDate() + 5);

  const anoMesAtual = `${hoje.getFullYear()}-${String(
    hoje.getMonth() + 1
  ).padStart(2, "0")}`;

  const diligenciasParaExibir = diligencias.filter((item) => {
    // <-- 2. CORREÇÃO NA LEITURA
    const dataAlvoObj = getSafeDate(item.dataAlvo);
    const criadoEmObj = getSafeDate(item.criadoEm);
    const recorrenciaTerminaEmObj = getSafeDate(item.recorrenciaTerminaEm);

    if (!dataAlvoObj) return false;

    const inicioDaVigencia = criadoEmObj
      ? new Date(criadoEmObj.getFullYear(), criadoEmObj.getMonth(), 1)
      : new Date(1970, 0, 1);

    if (new Date(hoje.getFullYear(), hoje.getMonth(), 1) < inicioDaVigencia) {
      return false;
    }

    if (
      recorrenciaTerminaEmObj &&
      new Date(hoje.getFullYear(), hoje.getMonth(), 1) > recorrenciaTerminaEmObj
    ) {
      return false;
    }

    if (item.isRecorrente) {
      if (
        item.historicoCumprimentos &&
        item.historicoCumprimentos[anoMesAtual]
      ) {
        return false;
      }
    } else {
      if (
        item.historicoCumprimentos &&
        Object.keys(item.historicoCumprimentos).length > 0
      ) {
        return false;
      }
    }

    let dataRelevante = item.isRecorrente
      ? new Date(hoje.getFullYear(), hoje.getMonth(), dataAlvoObj.getUTCDate())
      : dataAlvoObj;
    dataRelevante.setHours(0, 0, 0, 0);

    return dataRelevante <= cincoDiasFrente;
  });

  diligenciasParaExibir.sort((a, b) => {
    // <-- 3. CORREÇÃO NA LEITURA
    const dataAObj = getSafeDate(a.dataAlvo);
    const dataBObj = getSafeDate(b.dataAlvo);
    if (!dataAObj || !dataBObj) return 0;

    const dataA = a.isRecorrente
      ? new Date(hoje.getFullYear(), hoje.getMonth(), dataAObj.getUTCDate())
      : dataAObj;
    const dataB = b.isRecorrente
      ? new Date(hoje.getFullYear(), hoje.getMonth(), dataBObj.getUTCDate())
      : dataBObj;
    return dataA - dataB;
  });

  let contentHTML = "";
  if (diligenciasParaExibir.length === 0) {
    contentHTML =
      '<p class="empty-list-message">Nenhuma tarefa próxima ou em atraso.</p>';
  } else {
    diligenciasParaExibir.forEach((item) => {
      // <-- 4. CORREÇÃO NA LEITURA
      const dataAlvoObj = getSafeDate(item.dataAlvo);
      if (!dataAlvoObj) return;

      const dataRelevante = item.isRecorrente
        ? new Date(
            hoje.getFullYear(),
            hoje.getMonth(),
            dataAlvoObj.getUTCDate()
          )
        : dataAlvoObj;
      dataRelevante.setHours(0, 0, 0, 0);

      const isAtrasada = dataRelevante < hoje;
      const itemStyle = isAtrasada ? 'style="background-color: #ffebee;"' : "";
      const vencimentoLabel = `Vencimento: ${dataRelevante.toLocaleDateString(
        "pt-BR",
        { timeZone: "UTC" }
      )}`;

      contentHTML += `<div class="analise-item" ${itemStyle} data-id="${
        item.id
      }"><div class="analise-item-devedor">${
        isAtrasada
          ? '<span class="status-dot status-expired"></span>'
          : '<span class="status-dot status-warning"></span>'
      } ${item.titulo} ${
        item.isRecorrente ? "(Recorrente)" : ""
      }</div><div class="analise-item-detalhes"><strong>${vencimentoLabel}</strong></div></div>`;
    });
  }

  container.innerHTML = `<div class="widget-card"><h3>Próximas Tarefas</h3>${contentHTML}</div>`;

  container
    .querySelector(".widget-card")
    ?.addEventListener("click", (event) => {
      const item = event.target.closest(".analise-item");
      if (item) navigateTo("diligencias");
    });
}

/**
 * Renderiza o widget de próximas audiências.
 * @param {Array} audiencias - A lista de audiências futuras.
 */
function renderProximasAudienciasWidget(audiencias) {
  const container = document.getElementById("audiencias-widget-container");
  if (!container) return;

  let contentHTML = "";
  if (audiencias.length === 0) {
    contentHTML =
      '<p class="empty-list-message">Nenhuma audiência futura agendada.</p>';
  } else {
    const hoje = new Date();
    const umaSemana = new Date();
    umaSemana.setDate(hoje.getDate() + 8);

    audiencias.forEach((item) => {
      // <-- 5. CORREÇÃO NA LEITURA
      const dataObj = getSafeDate(item.dataHora);
      if (!dataObj) return;

      const dataFormatada = dataObj.toLocaleString("pt-BR", {
        dateStyle: "full",
        timeStyle: "short",
      });
      const isDestaque = dataObj < umaSemana;

      contentHTML += `
                <div class="audiencia-item ${isDestaque ? "destaque" : ""}">
                    <div class="audiencia-item-processo">
                        <a href="#" class="view-processo-link" data-action="view-processo" data-id="${
                          item.processoId
                        }">
                            ${formatProcessoForDisplay(item.numeroProcesso)}
                        </a>
                    </div>
                    <div class="audiencia-item-devedor">${
                      item.razaoSocialDevedor
                    }</div>
                    <div class="audiencia-item-detalhes">
                        <strong>Data:</strong> ${dataFormatada}<br>
                        <strong>Local:</strong> ${item.local || "A definir"}
                    </div>
                </div>
            `;
    });
  }

  container.innerHTML = `
        <div class="widget-card">
            <h3>Próximas Audiências</h3>
            ${contentHTML}
        </div>
    `;

  container
    .querySelector(".widget-card")
    ?.addEventListener("click", (event) => {
      const link = event.target.closest('[data-action="view-processo"]');
      if (link) {
        event.preventDefault();
        navigateTo("processoDetail", { id: link.dataset.id });
      }
    });
}

/**
 * Renderiza o widget de análises pendentes.
 * @param {Array} devedores - A lista de devedores do cache.
 */
function renderAnalisePendenteWidget(devedores) {
  const container = document.getElementById("analises-widget-container");
  if (!container) return;

  const devedoresParaAnalise = devedores
    .map((devedor) => ({ ...devedor, analise: getAnaliseStatus(devedor) }))
    .filter(
      (d) =>
        d.analise.status === "status-expired" ||
        d.analise.status === "status-warning"
    );

  devedoresParaAnalise.sort((a, b) => {
    if (
      a.analise.status === "status-expired" &&
      b.analise.status !== "status-expired"
    )
      return -1;
    if (
      a.analise.status !== "status-expired" &&
      b.analise.status === "status-expired"
    )
      return 1;
    return 0;
  });

  let contentHTML = "";
  if (devedoresParaAnalise.length === 0) {
    contentHTML =
      '<p class="empty-list-message">Nenhuma análise pendente. Bom trabalho!</p>';
  } else {
    devedoresParaAnalise.forEach((item) => {
      contentHTML += `
                <div class="analise-item" data-id="${item.id}" title="Ir para a lista de Grandes Devedores">
                    <div class="analise-item-devedor">
                        <span class="status-dot ${item.analise.status}" style="margin-right: 10px;"></span>
                        ${item.razaoSocial}
                    </div>
                </div>
            `;
    });
  }

  const widgetHTML = `
        <div class="widget-card">
            <h3>Análises Pendentes</h3>
            ${contentHTML}
        </div>
    `;
  container.innerHTML = widgetHTML;

  container
    .querySelector(".widget-card")
    ?.addEventListener("click", (event) => {
      const item = event.target.closest(".analise-item");
      if (item) {
        navigateTo("grandesDevedores");
      }
    });
}
