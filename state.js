// ==================================================================
// Módulo: state.js
// Responsabilidade: Centralizar e gerenciar o estado global da aplicação.
// ==================================================================

// --- Caches de Dados ---
// Armazenam os dados vindos do Firebase para evitar múltiplas buscas.
export let devedoresCache = [];
export let exequentesCache = [];
export let processosCache = [];
export let diligenciasCache = [];
export let motivosSuspensaoCache = [];

// --- Estado da Interface (UI State) ---
// Controlam informações específicas de páginas ou componentes.
export let currentTasksPageDate = new Date(); // Data da página "Tarefas do Mês"
export let currentReportData = []; // Dados do último relatório gerado
export let currentSortState = { key: null, direction: "asc" }; // Ordenação da tabela de relatório

// --- Funções de "Unsubscribe" dos Listeners ---
// Armazenam as funções para "desligar" os listeners do Firebase e evitar vazamento de memória.
export let processosListenerUnsubscribe = null;
export let corresponsaveisListenerUnsubscribe = null;
export let penhorasListenerUnsubscribe = null;
export let audienciasListenerUnsubscribe = null;
export let diligenciasListenerUnsubscribe = null;
export let incidentesListenerUnsubscribe = null;
export let anexosListenerUnsubscribe = null;

// --- Funções "Setters" para atualizar o estado ---
// Padrão recomendado para modificar o estado a partir de outros módulos.

export function setDevedoresCache(data) {
  devedoresCache = data;
}
export function setExequentesCache(data) {
  exequentesCache = data;
}
export function setProcessosCache(data) {
  processosCache = data;
}
export function setDiligenciasCache(data) {
  diligenciasCache = data;
}
export function setMotivosSuspensaoCache(data) {
  motivosSuspensaoCache = data;
}

export function setCurrentTasksPageDate(date) {
  currentTasksPageDate = date;
}
export function setCurrentReportData(data) {
  currentReportData = data;
}
export function setCurrentSortState(state) {
  currentSortState = state;
}

export function setProcessosListenerUnsubscribe(func) {
  processosListenerUnsubscribe = func;
}
export function setCorresponsaveisListenerUnsubscribe(func) {
  corresponsaveisListenerUnsubscribe = func;
}
export function setPenhorasListenerUnsubscribe(func) {
  penhorasListenerUnsubscribe = func;
}
export function setAudienciasListenerUnsubscribe(func) {
  audienciasListenerUnsubscribe = func;
}
export function setDiligenciasListenerUnsubscribe(func) {
  diligenciasListenerUnsubscribe = func;
}
export function setIncidentesListenerUnsubscribe(func) {
  incidentesListenerUnsubscribe = func;
}
export function setAnexosListenerUnsubscribe(func) {
  anexosListenerUnsubscribe = func;
}
