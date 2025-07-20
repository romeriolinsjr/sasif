// ==================================================================
// Módulo: demandasEstruturais.js
// Responsabilidade: Lógica da página "Demandas Estruturais".
// ==================================================================

import { contentArea, pageTitle } from "./ui.js";

/**
 * Renderiza a página de Demandas Estruturais (atualmente como placeholder).
 */
export function renderDemandasEstruturaisPage() {
  pageTitle.textContent = "Demandas Estruturais";
  document.title = "SASIF | Demandas Estruturais";

  contentArea.innerHTML = `
    <div class="empty-list-message" style="text-align: center; padding-top: 40px; padding-bottom: 40px;">
        <h2 style="margin-bottom: 16px;">Em Desenvolvimento</h2>
        <p style="font-size: 16px; max-width: 600px; margin: 0 auto; line-height: 1.6;">
            Esta seção será dedicada ao gerenciamento e acompanhamento de processos complexos classificados como demandas estruturais. As funcionalidades específicas para lidar com múltiplos atores, audiências públicas e planos de ação serão implementadas aqui.
        </p>
    </div>
  `;
}