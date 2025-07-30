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
} from "./utils.js";
import { navigateTo } from "./navigation.js";

/**
 * Renderiza a estrutura principal da página do Dashboard.
 */
export function renderDashboard() {
  pageTitle.textContent = "Dashboard";
  document.title = "SASIF | Dashboard";

  // ALTERAÇÃO: Adicionado o container para o novo widget de investigações
  contentArea.innerHTML = `
        <div id="dashboard-widgets-container">
            <div id="diligencias-widget-container"></div>
            <div id="analises-widget-container"></div>
            <div id="investigacoes-widget-container"></div> 
            <div id="audiencias-widget-container"></div>
        </div>
    `;

  setupDashboardWidgets();
}

/**
 * Orquestra a busca de dados e a renderização de todos os widgets.
 */
export function setupDashboardWidgets() {
  const hoje = new Date();
  const userId = auth.currentUser.uid;

  // Widget de Tarefas
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

  // Widget de Audiências
  db.collection("audiencias")
    .get()
    .then((snapshot) => {
      const todasAudiencias = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const audienciasFuturas = todasAudiencias
        .map((item) => ({ ...item, dataHoraObj: getSafeDate(item.dataHora) }))
        .filter((item) => item.dataHoraObj && item.dataHoraObj >= hoje)
        .sort((a, b) => a.dataHoraObj - b.dataHoraObj)
        .slice(0, 10);
      renderProximasAudienciasWidget(audienciasFuturas);
    })
    .catch((error) => {
      console.error("Erro ao buscar audiências para o dashboard:", error);
      const container = document.getElementById("audiencias-widget-container");
      if (container)
        container.innerHTML = `<div class="widget-card"><h3>Próximas Audiências</h3><p class="empty-list-message">Ocorreu um erro ao carregar.</p></div>`;
    });

  // NOVO WIDGET: Busca de Investigações Fiscais
  db.collection("investigacoesFiscais")
    .where("status", "==", "ativo")
    .where("prazoRetorno", "!=", null)
    .orderBy("prazoRetorno", "asc")
    .limit(10)
    .get()
    .then((snapshot) => {
      const investigacoes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      renderInvestigacoesWidget(investigacoes);
    })
    .catch((error) => {
      console.error("Erro ao buscar investigações para o dashboard:", error);
      const container = document.getElementById(
        "investigacoes-widget-container"
      );
      if (container)
        container.innerHTML = `<div class="widget-card"><h3>Acompanhamento de Investigações</h3><p class="empty-list-message">Ocorreu um erro ao carregar.</p></div>`;
    });

  // Widget de Análises Pendentes
  renderAnalisePendenteWidget(state.devedoresCache);
}

// ... (Função renderProximasDiligenciasWidget permanece a mesma)
function renderProximasDiligenciasWidget(diligencias) {
  const container = document.getElementById("diligencias-widget-container");
  if (!container) return;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diasParaFrente = new Date(hoje);
  diasParaFrente.setDate(hoje.getDate() + 7);
  let ocorrenciasParaExibir = [];
  diligencias.forEach((tarefa) => {
    const dataAlvoObj = getSafeDate(tarefa.dataAlvo);
    if (!dataAlvoObj) return;
    if (!tarefa.isRecorrente) {
      if (
        tarefa.historicoCumprimentos &&
        Object.keys(tarefa.historicoCumprimentos).length > 0
      ) {
        return;
      }
      if (dataAlvoObj <= diasParaFrente) {
        ocorrenciasParaExibir.push({ ...tarefa, dataRelevante: dataAlvoObj });
      }
      return;
    }
    const hojePrimeiroDiaDoMes = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      1
    );
    const criadoEmObj = getSafeDate(tarefa.criadoEm);
    const recorrenciaTerminaEmObj = getSafeDate(tarefa.recorrenciaTerminaEm);
    if (criadoEmObj) {
      const inicioDaVigencia = new Date(
        criadoEmObj.getFullYear(),
        criadoEmObj.getMonth(),
        1
      );
      if (hojePrimeiroDiaDoMes < inicioDaVigencia) return;
    }
    if (
      recorrenciaTerminaEmObj &&
      hojePrimeiroDiaDoMes > recorrenciaTerminaEmObj
    )
      return;
    const diaAlvo = dataAlvoObj.getUTCDate();
    const anoMesAtual = `${hoje.getFullYear()}-${String(
      hoje.getMonth() + 1
    ).padStart(2, "0")}`;
    if (
      !(
        tarefa.historicoCumprimentos &&
        tarefa.historicoCumprimentos[anoMesAtual]
      )
    ) {
      const dataOcorrencia = new Date(
        hoje.getFullYear(),
        hoje.getMonth(),
        diaAlvo
      );
      if (dataOcorrencia <= diasParaFrente) {
        ocorrenciasParaExibir.push({
          ...tarefa,
          dataRelevante: dataOcorrencia,
        });
      }
    }
    const proximoMesDate = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
    const anoMesProximo = `${proximoMesDate.getFullYear()}-${String(
      proximoMesDate.getMonth() + 1
    ).padStart(2, "0")}`;
    if (
      !(
        tarefa.historicoCumprimentos &&
        tarefa.historicoCumprimentos[anoMesProximo]
      )
    ) {
      const dataOcorrencia = new Date(
        proximoMesDate.getFullYear(),
        proximoMesDate.getMonth(),
        diaAlvo
      );
      if (dataOcorrencia >= hoje && dataOcorrencia <= diasParaFrente) {
        ocorrenciasParaExibir.push({
          ...tarefa,
          dataRelevante: dataOcorrencia,
        });
      }
    }
  });
  const tarefasUnicasMap = new Map();
  ocorrenciasParaExibir.forEach((tarefa) => {
    if (
      !tarefasUnicasMap.has(tarefa.id) ||
      tarefa.dataRelevante < tarefasUnicasMap.get(tarefa.id).dataRelevante
    ) {
      tarefasUnicasMap.set(tarefa.id, tarefa);
    }
  });
  const tarefasFiltradas = Array.from(tarefasUnicasMap.values());
  tarefasFiltradas.sort((a, b) => a.dataRelevante - b.dataRelevante);
  let contentHTML = "";
  if (tarefasFiltradas.length === 0) {
    contentHTML =
      '<p class="empty-list-message">Nenhuma tarefa próxima ou em atraso.</p>';
  } else {
    tarefasFiltradas.forEach((item) => {
      const isAtrasada = item.dataRelevante < hoje;
      const itemStyle = isAtrasada ? 'style="background-color: #ffebee;"' : "";
      const vencimentoLabel = `Vencimento: ${item.dataRelevante.toLocaleDateString(
        "pt-BR"
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
      if (event.target.closest(".analise-item")) navigateTo("diligencias");
    });
}

/**
 * NOVA FUNÇÃO: Renderiza o widget de Acompanhamento de Investigações.
 * @param {Array} investigacoes - A lista de investigações com prazo de retorno.
 */
/**
 * NOVA FUNÇÃO: Renderiza o widget de Acompanhamento de Investigações.
 * @param {Array} investigacoes - A lista de investigações com prazo de retorno.
 */
function renderInvestigacoesWidget(investigacoes) {
  const container = document.getElementById("investigacoes-widget-container");
  if (!container) return;

  // Objeto para mapear o estado interno para o texto da fase atual
  const fasesMap = {
    "Tutela Provisória": "Ajuizado",
    "Designação de Audiência": "Decidida Tutela Provisória",
    Julgamento: "Marcada Audiência",
    "Análise de Embargos": "Julgado",
    "Trânsito em Julgado": "Decididos Embargos",
  };

  let contentHTML = "";
  if (investigacoes.length === 0) {
    contentHTML =
      '<p class="empty-list-message">Nenhum processo com prazo de retorno definido.</p>';
  } else {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    investigacoes.forEach((item) => {
      const prazoDate = getSafeDate(item.prazoRetorno);
      const diffTime = prazoDate.getTime() - hoje.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let prazoStatus = "";
      let statusClass = "";

      if (diffDays < 0) {
        prazoStatus = `Vencido há ${Math.abs(diffDays)} dia(s)`;
        statusClass = "status-expired";
      } else if (diffDays === 0) {
        prazoStatus = "Retorno hoje";
        statusClass = "status-warning";
      } else {
        prazoStatus = `Retorno em ${diffDays} dia(s)`;
        statusClass = "status-ok";
      }

      // ALTERAÇÃO: Mapeia o 'decisaoPendente' para a fase atual
      const faseAtual = fasesMap[item.decisaoPendente] || item.decisaoPendente;

      contentHTML += `
                <div class="analise-item" data-id="${
                  item.id
                }" title="Ir para a página de Investigação Fiscal">
                    <div class="analise-item-devedor">
                        <span class="status-dot ${statusClass}" style="margin-right: 10px;"></span>
                        ${formatProcessoForDisplay(item.numeroProcesso)}
                    </div>
                     <div class="analise-item-detalhes">
                        <strong>Suscitado:</strong> ${item.suscitado} <br>
                        <!-- ALTERAÇÃO: Adiciona a fase atual e o prazo -->
                        <strong>Fase:</strong> ${faseAtual} <br>
                        <strong>Prazo:</strong> ${prazoStatus}
                     </div>
                </div>`;
    });
  }

  // ALTERAÇÃO: Título do widget atualizado
  const widgetHTML = `
        <div class="widget-card">
            <h3>Investigações Fiscais</h3>
            ${contentHTML}
        </div>
    `;
  container.innerHTML = widgetHTML;

  container
    .querySelector(".widget-card")
    ?.addEventListener("click", (event) => {
      if (event.target.closest(".analise-item")) {
        navigateTo("investigacaoFiscal");
      }
    });
}
// ... (Funções renderProximasAudienciasWidget e renderAnalisePendenteWidget permanecem as mesmas)
/**
 * Renderiza o widget de próximas audiências.
 * @param {Array} audiencias - A lista de audiências futuras.
 */
/**
 * Renderiza o widget de próximas audiências.
 * @param {Array} audiencias - A lista de audiências futuras.
 */
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
      const dataObj = getSafeDate(item.dataHora);
      if (!dataObj) return;
      const dataFormatada = dataObj.toLocaleString("pt-BR", {
        dateStyle: "full",
        timeStyle: "short",
      });
      const isDestaque = dataObj < umaSemana;

      // CORREÇÃO: Exibe "IF: [nome do suscitado]" para audiências de IF.
      const devedorLabel =
        item.tipo === "investigacaoFiscal"
          ? `<span style="font-weight: normal;">IF: ${
              item.razaoSocialDevedor || item.suscitado || ""
            }</span>`
          : item.razaoSocialDevedor;

      contentHTML += `
          <div class="audiencia-item ${isDestaque ? "destaque" : ""}">
              <div class="audiencia-item-processo">
                  <a href="#" class="view-processo-link" data-action="view-processo" data-id="${
                    item.processoId || ""
                  }" data-investigacao-id="${item.investigacaoId || ""}">
                      ${formatProcessoForDisplay(item.numeroProcesso)}
                  </a>
              </div>
              <div class="audiencia-item-devedor">${devedorLabel}</div>
              <div class="audiencia-item-detalhes"><strong>Data:</strong> ${dataFormatada}<br><strong>Local:</strong> ${
        item.local || "A definir"
      }</div>
          </div>`;
    });
  }
  container.innerHTML = `<div class="widget-card"><h3>Próximas Audiências</h3>${contentHTML}</div>`;
  container
    .querySelector(".widget-card")
    ?.addEventListener("click", (event) => {
      const link = event.target.closest(".view-processo-link");
      if (link) {
        event.preventDefault();
        if (link.dataset.investigacaoId) {
          navigateTo("investigacaoFiscal");
        } else if (link.dataset.id) {
          navigateTo("processoDetail", { id: link.dataset.id });
        }
      }
    });
}
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
      contentHTML += `<div class="analise-item" data-id="${item.id}" title="Ir para a lista de Grandes Devedores"><div class="analise-item-devedor"><span class="status-dot ${item.analise.status}" style="margin-right: 10px;"></span>${item.razaoSocial}</div></div>`;
    });
  }
  const widgetHTML = `<div class="widget-card"><h3>Análises Pendentes</h3>${contentHTML}</div>`;
  container.innerHTML = widgetHTML;
  container
    .querySelector(".widget-card")
    ?.addEventListener("click", (event) => {
      if (event.target.closest(".analise-item")) {
        navigateTo("grandesDevedores");
      }
    });
}
