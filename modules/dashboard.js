// ==================================================================
// Módulo: dashboard.js
// Responsabilidade: Lógica de renderização e funcionamento do Dashboard.
// (Versão com container de rolagem nos widgets - 07/08/2025)
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

export function renderDashboard() {
  pageTitle.textContent = "Dashboard";
  document.title = "SASIF | Dashboard";
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

export function setupDashboardWidgets() {
  const hoje = new Date();
  const userId = auth.currentUser.uid;
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
    });
  db.collection("audiencias")
    .get()
    .then((snapshot) => {
      const audienciasFuturas = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .map((item) => ({ ...item, dataHoraObj: getSafeDate(item.dataHora) }))
        .filter((item) => item.dataHoraObj && item.dataHoraObj >= hoje)
        .sort((a, b) => a.dataHoraObj - b.dataHoraObj)
        .slice(0, 10);
      renderProximasAudienciasWidget(audienciasFuturas);
    })
    .catch((error) => {
      console.error("Erro ao buscar audiências para o dashboard:", error);
    });
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
    });
  renderAnalisePendenteWidget(state.devedoresCache);
}

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
      )
        return;
      if (dataAlvoObj <= diasParaFrente)
        ocorrenciasParaExibir.push({ ...tarefa, dataRelevante: dataAlvoObj });
      return;
    }
    const hojePrimeiroDiaDoMes = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      1
    );
    const criadoEmObj = getSafeDate(tarefa.criadoEm);
    if (criadoEmObj) {
      const inicioDaVigencia = new Date(
        criadoEmObj.getFullYear(),
        criadoEmObj.getMonth(),
        1
      );
      if (hojePrimeiroDiaDoMes < inicioDaVigencia) return;
    }
    const recorrenciaTerminaEmObj = getSafeDate(tarefa.recorrenciaTerminaEm);
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
      if (dataOcorrencia <= diasParaFrente)
        ocorrenciasParaExibir.push({
          ...tarefa,
          dataRelevante: dataOcorrencia,
        });
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
      if (dataOcorrencia >= hoje && dataOcorrencia <= diasParaFrente)
        ocorrenciasParaExibir.push({
          ...tarefa,
          dataRelevante: dataOcorrencia,
        });
    }
  });
  const tarefasFiltradas = Array.from(
    new Map(ocorrenciasParaExibir.map((t) => [t.id, t])).values()
  );
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
  container.innerHTML = `
    <div class="widget-card">
        <div class="widget-header">
            <svg class="widget-icon" viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7v-5z"/></svg>
            <h3>Próximas Tarefas</h3>
        </div>
        <div class="widget-content">
            ${contentHTML}
        </div>
    </div>`;
  container
    .querySelector(".widget-card")
    ?.addEventListener("click", (event) => {
      if (event.target.closest(".analise-item")) navigateTo("diligencias");
    });
}

function renderInvestigacoesWidget(investigacoes) {
  const container = document.getElementById("investigacoes-widget-container");
  if (!container) return;
  let contentHTML = "";
  if (investigacoes.length === 0) {
    contentHTML =
      '<p class="empty-list-message">Nenhum processo com prazo de retorno definido.</p>';
  } else {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    investigacoes.forEach((item) => {
      const prazoDate = getSafeDate(item.prazoRetorno);
      const diffDays = Math.ceil(
        (prazoDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
      );
      let prazoStatus = "",
        statusClass = "";
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
      const faseAtual = item.faseAtual || "Indefinida";
      contentHTML += `
          <div class="analise-item" data-id="${
            item.id
          }" title="Ir para a página de Investigação Fiscal">
              <div class="analise-item-devedor"><span class="status-dot ${statusClass}" style="margin-right: 10px;"></span>${formatProcessoForDisplay(
        item.numeroProcesso
      )}</div>
              <div class="analise-item-detalhes">
                  <strong>Suscitado:</strong> ${item.suscitado} <br>
                  <strong>Fase:</strong> ${faseAtual} <br>
                  <strong>Prazo:</strong> ${prazoStatus}
              </div>
          </div>`;
    });
  }
  container.innerHTML = `
    <div class="widget-card">
        <div class="widget-header">
            <svg class="widget-icon" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            <h3>Investigações Fiscais</h3>
        </div>
        <div class="widget-content">
            ${contentHTML}
        </div>
    </div>`;
  container
    .querySelector(".widget-card")
    ?.addEventListener("click", () => navigateTo("investigacaoFiscal"));
}

function renderProximasAudienciasWidget(audiencias) {
  const container = document.getElementById("audiencias-widget-container");
  if (!container) return;
  let contentHTML = "";
  if (audiencias.length === 0) {
    contentHTML =
      '<p class="empty-list-message">Nenhuma audiência futura agendada.</p>';
  } else {
    const hoje = new Date(),
      umaSemana = new Date();
    umaSemana.setDate(hoje.getDate() + 8);
    audiencias.forEach((item) => {
      const dataObj = getSafeDate(item.dataHora);
      if (!dataObj) return;
      const dataFormatada = dataObj.toLocaleString("pt-BR", {
        dateStyle: "full",
        timeStyle: "short",
      });
      const devedorLabel =
        item.tipo === "investigacaoFiscal"
          ? `<span style="font-weight: normal;">IF: ${
              item.razaoSocialDevedor || ""
            }</span>`
          : item.razaoSocialDevedor;
      contentHTML += `
          <div class="audiencia-item ${dataObj < umaSemana ? "destaque" : ""}">
              <div class="audiencia-item-processo"><a href="#" class="view-processo-link" data-action="view-processo" data-id="${
                item.processoId || ""
              }" data-investigacao-id="${
        item.investigacaoId || ""
      }">${formatProcessoForDisplay(item.numeroProcesso)}</a></div>
              <div class="audiencia-item-devedor">${devedorLabel}</div>
              <div class="audiencia-item-detalhes"><strong>Data:</strong> ${dataFormatada}<br><strong>Local:</strong> ${
        item.local || "A definir"
      }</div>
          </div>`;
    });
  }
  container.innerHTML = `
    <div class="widget-card">
        <div class="widget-header">
            <svg class="widget-icon" viewBox="0 0 24 24"><path d="M1 21h12v-2H1v2zm2-4h12v-2H3v2zm0-4h12v-2H3v2zm0-4h12V7H3v2zm16.5-6-2.75 2.75L15.34 8 18.09 5.25 15.34 2.5 16.75 1.09l4.17 4.16-4.17 4.16-1.41-1.41z"/></svg>
            <h3>Próximas Audiências</h3>
        </div>
        <div class="widget-content">
            ${contentHTML}
        </div>
    </div>`;
  container
    .querySelector(".widget-card")
    ?.addEventListener("click", (event) => {
      const link = event.target.closest(".view-processo-link");
      if (link) {
        event.preventDefault();
        if (link.dataset.investigacaoId) navigateTo("investigacaoFiscal");
        else if (link.dataset.id)
          navigateTo("processoDetail", { id: link.dataset.id });
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
    )
    .sort((a, b) =>
      a.analise.status === "status-expired" &&
      b.analise.status !== "status-expired"
        ? -1
        : 1
    );
  let contentHTML = "";
  if (devedoresParaAnalise.length === 0) {
    contentHTML =
      '<p class="empty-list-message">Nenhuma análise pendente. Bom trabalho!</p>';
  } else {
    devedoresParaAnalise.forEach((item) => {
      contentHTML += `<div class="analise-item" data-id="${item.id}" title="Ir para a lista de Grandes Devedores"><div class="analise-item-devedor"><span class="status-dot ${item.analise.status}" style="margin-right: 10px;"></span>${item.razaoSocial}</div></div>`;
    });
  }
  container.innerHTML = `
    <div class="widget-card">
        <div class="widget-header">
            <svg class="widget-icon" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/><path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
            <h3>Análises Pendentes</h3>
        </div>
        <div class="widget-content">
            ${contentHTML}
        </div>
    </div>`;
  container
    .querySelector(".widget-card")
    ?.addEventListener("click", (event) => {
      if (event.target.closest(".analise-item")) navigateTo("grandesDevedores");
    });
}
