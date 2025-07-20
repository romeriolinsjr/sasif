// ==================================================================
// Módulo: navigation.js
// Responsabilidade: O "roteador" da aplicação, controla qual página é exibida.
// ==================================================================

import { renderDashboard } from "./dashboard.js";
import { renderGrandesDevedoresPage } from "./devedores.js";
import { renderProcessoDetailPage } from "./processos.js";
import { renderImportacaoPage } from "./importacao.js";
import { renderDiligenciasPage } from "./tarefas.js";
import { renderRelatoriosPage } from "./relatorios.js";
import {
  renderConfiguracoesPage,
  renderExequentesPage,
  renderMotivosPage,
  renderIncidentesPage,
} from "./configuracoes.js";
import { renderSidebar } from "./ui.js";
import { renderDemandasEstruturaisPage } from "./demandasEstruturais.js";

// Importa todas as variáveis de listener e suas funções 'setter' do módulo de estado
import * as state from "./state.js";

/**
 * Desliga todos os listeners ativos do Firebase para evitar sobrecarga e vazamento de memória
 * ao trocar de página.
 */
function unsubscribeAllListeners() {
  if (state.processosListenerUnsubscribe) {
    state.processosListenerUnsubscribe();
    state.setProcessosListenerUnsubscribe(null);
  }
  if (state.corresponsaveisListenerUnsubscribe) {
    state.corresponsaveisListenerUnsubscribe();
    state.setCorresponsaveisListenerUnsubscribe(null);
  }
  if (state.penhorasListenerUnsubscribe) {
    state.penhorasListenerUnsubscribe();
    state.setPenhorasListenerUnsubscribe(null);
  }
  if (state.audienciasListenerUnsubscribe) {
    state.audienciasListenerUnsubscribe();
    state.setAudienciasListenerUnsubscribe(null);
  }
  if (state.diligenciasListenerUnsubscribe) {
    state.diligenciasListenerUnsubscribe();
    state.setDiligenciasListenerUnsubscribe(null);
  }
  if (state.incidentesListenerUnsubscribe) {
    state.incidentesListenerUnsubscribe();
    state.setIncidentesListenerUnsubscribe(null);
  }
  if (state.anexosListenerUnsubscribe) {
    state.anexosListenerUnsubscribe();
    state.setAnexosListenerUnsubscribe(null);
  }
}

/**
 * Navega para uma página específica da aplicação, renderizando seu conteúdo.
 * @param {string | null} page O ID da página para a qual navegar.
 * @param {object} params Parâmetros adicionais para a página (ex: { id: 'processo123' }).
 */
export function navigateTo(page, params = {}) {
  // Passo 1: Limpa todos os listeners da página anterior.
  unsubscribeAllListeners();

  // Passo 2: Atualiza a aparência da sidebar.
  renderSidebar(page);

  // Passo 3: Renderiza a página correta com base no ID.
  switch (page) {
    case "dashboard":
      renderDashboard();
      break;
    case "grandesDevedores":
      renderGrandesDevedoresPage();
      break;
    case "demandasEstruturais":
      renderDemandasEstruturaisPage();
      break;
    case "diligencias":
      renderDiligenciasPage();
      break;
    case "relatorios":
      renderRelatoriosPage();
      break;
    case "importacao":
      renderImportacaoPage();
      break;
    case "configuracoes":
      renderConfiguracoesPage();
      break;
    case "exequentes":
      renderExequentesPage();
      break;
    case "motivos":
      renderMotivosPage();
      break;
    case "incidentes":
      renderIncidentesPage();
      break;
    case "processoDetail":
      renderProcessoDetailPage(params.id);
      break;
    // Se a página não for encontrada, vai para o dashboard como padrão.
    default:
      if (page) renderDashboard(); // Só renderiza se 'page' não for nulo
      break;
  }
}
