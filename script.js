// Suas credenciais do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBKDnfYqBV7lF_8o-LGuaLn_VIrb2keyh0",
    authDomain: "sasif-app.firebaseapp.com",
    projectId: "sasif-app",
    storageBucket: "sasif-app.firebasestorage.app",
    messagingSenderId: "695074109375",
    appId: "1:695074109375:web:0b564986ef12555091d30a"
};

// Inicializa o Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Elementos da UI
const appContainer = document.getElementById('app-container');
const loginContainer = document.getElementById('login-container');
const userEmailSpan = document.getElementById('user-email');
const logoutButton = document.getElementById('logout-button');
const contentArea = document.getElementById('content-area');
const pageTitle = document.getElementById('page-title');
const mainNav = document.getElementById('main-nav');

// Variáveis de Cache
let devedoresCache = [];
let exequentesCache = [];
let processosCache = [];
let processosListenerUnsubscribe = null;

// --- FUNÇÕES DE UTILIDADE ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('show'); }, 10);
    setTimeout(() => { toast.remove(); }, 3000);
}

function maskCNPJ(input) {
    let value = input.value.replace(/\D/g, '').substring(0, 14);
    value = value.replace(/^(\d{2})(\d)/, '$1.$2');
    value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
    value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
    value = value.replace(/(\d{4})(\d)/, '$1-$2');
    input.value = value;
}

function formatCNPJForDisplay(cnpj) {
    if (!cnpj) return '';
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function maskProcesso(input) {
    let v = input.value.replace(/\D/g, '').substring(0, 20);
    if (v.length > 16) { v = `${v.slice(0, 7)}-${v.slice(7, 9)}.${v.slice(9, 13)}.${v.slice(13, 14)}.${v.slice(14, 16)}.${v.slice(16, 20)}`; } else if (v.length > 14) { v = `${v.slice(0, 7)}-${v.slice(7, 9)}.${v.slice(9, 13)}.${v.slice(13, 14)}.${v.slice(14, 16)}`; } else if (v.length > 13) { v = `${v.slice(0, 7)}-${v.slice(7, 9)}.${v.slice(9, 13)}.${v.slice(13, 14)}`; } else if (v.length > 9) { v = `${v.slice(0, 7)}-${v.slice(7, 9)}.${v.slice(9, 13)}`; } else if (v.length > 7) { v = `${v.slice(0, 7)}-${v.slice(7, 9)}`; }
    input.value = v;
}

function formatProcessoForDisplay(numero) {
    if (!numero || numero.length !== 20) return numero;
    return numero.replace(/^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/, "$1-$2.$3.$4.$5.$6");
}

function formatCurrency(value) {
    if (typeof value !== 'number') return 'R$ 0,00';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getAnaliseStatus(devedor) {
    if (!devedor.dataUltimaAnalise) {
        return { status: 'status-expired', text: 'Pendente' };
    }
    const prazos = { 1: 30, 2: 45, 3: 60 };
    const prazoDias = prazos[devedor.nivelPrioridade];
    const hoje = new Date();
    const dataUltima = devedor.dataUltimaAnalise.toDate();
    const dataVencimento = new Date(dataUltima);
    dataVencimento.setDate(dataVencimento.getDate() + prazoDias);
    const diffTime = dataVencimento - hoje;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { status: 'status-expired', text: `Vencido há ${Math.abs(diffDays)} dia(s)` };
    if (diffDays <= 7) return { status: 'status-warning', text: `Vence em ${diffDays} dia(s)` };
    return { status: 'status-ok', text: `OK (Vence em ${diffDays} dia(s))` };
}

// --- NAVEGAÇÃO ---
function renderSidebar(activePage) { const pages = [{ id: 'dashboard', name: 'Dashboard' }, { id: 'exequentes', name: 'Exequentes' }]; mainNav.innerHTML = `<ul>${pages.map(page => `<li><a href="#" class="nav-link ${page.id === activePage ? 'active' : ''}" data-page="${page.id}">${page.name}</a></li>`).join('')}</ul>`; mainNav.querySelectorAll('.nav-link').forEach(link => { link.addEventListener('click', (e) => { e.preventDefault(); navigateTo(e.target.dataset.page); }); }); }
function navigateTo(page) { if (processosListenerUnsubscribe) { processosListenerUnsubscribe(); processosListenerUnsubscribe = null; } renderSidebar(page); switch (page) { case 'dashboard': renderDashboard(); break; case 'exequentes': renderExequentesPage(); break; default: renderDashboard(); } }

// --- DASHBOARD / DEVEDORES ---
function renderDashboard() { pageTitle.textContent = 'Grandes Devedores'; document.title = 'SASIF | Grandes Devedores'; contentArea.innerHTML = `<div class="dashboard-actions"><button id="add-devedor-btn" class="btn-primary">Cadastrar Novo Devedor</button></div><h2>Lista de Grandes Devedores</h2><div id="devedores-list-container"></div>`; document.getElementById('add-devedor-btn').addEventListener('click', () => renderDevedorForm()); renderDevedoresList(devedoresCache); }
function renderDevedoresList(devedores) {
    const container = document.getElementById('devedores-list-container');
    if (!container) return;
    if (devedores.length === 0) {
        container.innerHTML = `<p class="empty-list-message">Nenhum grande devedor cadastrado ainda.</p>`;
        return;
    }
    let tableHTML = `<table class="data-table"><thead><tr><th class="number-cell">#</th><th>Razão Social</th><th>CNPJ</th><th>Prioridade</th><th>Status Análise</th><th class="actions-cell">Ações</th></tr></thead><tbody>`;
    devedores.forEach((devedor, index) => {
        const analise = getAnaliseStatus(devedor);
        tableHTML += `<tr data-id="${devedor.id}" class="clickable-row"><td class="number-cell">${index + 1}</td><td>${devedor.razaoSocial}</td><td>${formatCNPJForDisplay(devedor.cnpj)}</td><td class="level-${devedor.nivelPrioridade}">Nível ${devedor.nivelPrioridade}</td><td><span class="status-dot ${analise.status}"></span>${analise.text}</td><td class="actions-cell"><button class="action-btn btn-edit" data-id="${devedor.id}">Editar</button><button class="action-btn btn-delete" data-id="${devedor.id}">Excluir</button></td></tr>`;
    });
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
    container.querySelector('tbody').addEventListener('click', handleDevedorAction);
}

// --- DETALHES DO DEVEDOR E PROCESSOS ---
function renderDevedorDetailPage(devedorId) { pageTitle.textContent = 'Carregando...'; document.title = 'SASIF | Carregando...'; renderSidebar(null); db.collection("grandes_devedores").doc(devedorId).get().then(doc => { if (!doc.exists) { showToast("Devedor não encontrado.", "error"); navigateTo('dashboard'); return; } const devedor = { id: doc.id, ...doc.data() }; pageTitle.textContent = devedor.razaoSocial; document.title = `SASIF | ${devedor.razaoSocial}`; contentArea.innerHTML = `<div class="detail-header-card"><h2>${devedor.razaoSocial}</h2><p>CNPJ: ${formatCNPJForDisplay(devedor.cnpj)}</p></div><div class="dashboard-actions"><button id="add-processo-btn" class="btn-primary">Cadastrar Novo Processo</button><button id="registrar-analise-btn" class="btn-primary">Registrar Análise Hoje</button></div><h2>Lista de Processos</h2><div id="processos-list-container"></div>`; document.getElementById('add-processo-btn').addEventListener('click', () => renderProcessoForm(devedorId)); document.getElementById('registrar-analise-btn').addEventListener('click', () => handleRegistrarAnalise(devedorId)); setupProcessosListener(devedorId); }); }
function renderProcessosList(processos) {
    const container = document.getElementById('processos-list-container');
    if (!container) return;
    const autonomos = processos.filter(p => p.tipoProcesso === 'autonomo').sort((a,b) => (a.criadoEm.seconds < b.criadoEm.seconds) ? 1 : -1);
    const pilotos = processos.filter(p => p.tipoProcesso === 'piloto').sort((a,b) => (a.criadoEm.seconds < b.criadoEm.seconds) ? 1 : -1);
    const apensosMap = processos.filter(p => p.tipoProcesso === 'apenso').reduce((map, apenso) => { const pilotoId = apenso.processoPilotoId; if (!map.has(pilotoId)) map.set(pilotoId, []); map.get(pilotoId).push(apenso); return map; }, new Map());
    const itemsOrdenados = [...autonomos, ...pilotos];
    if (itemsOrdenados.length === 0) { container.innerHTML = `<p class="empty-list-message">Nenhum processo cadastrado.</p>`; return; }
    let tableHTML = `<table class="data-table"><thead><tr><th>Número do Processo</th><th>Exequente</th><th>Tipo</th><th>Valor</th><th class="actions-cell">Ações</th></tr></thead><tbody>`;
    itemsOrdenados.forEach(item => {
        const exequente = exequentesCache.find(ex => ex.id === item.exequenteId);
        const itemHTML = (proc) => `<td>${proc.tipoProcesso === 'piloto' ? '<span class="toggle-icon"></span>' : ''}${formatProcessoForDisplay(proc.numeroProcesso)}</td><td>${exequente ? exequente.nome : 'N/A'}</td><td>${proc.tipoProcesso.charAt(0).toUpperCase() + proc.tipoProcesso.slice(1)}</td><td>${formatCurrency(proc.valorDivida)}</td><td class="actions-cell"><button class="action-btn btn-edit" data-id="${proc.id}">Editar</button><button class="action-btn btn-delete" data-id="${proc.id}">Excluir</button></td>`;
        tableHTML += `<tr class="${item.tipoProcesso}-row" data-id="${item.id}" ${item.tipoProcesso === 'piloto' ? `data-piloto-id="${item.id}"` : ''}>${itemHTML(item)}</tr>`;
        if (item.tipoProcesso === 'piloto' && apensosMap.has(item.id)) {
            apensosMap.get(item.id).forEach(apenso => {
                const exApenso = exequentesCache.find(ex => ex.id === apenso.exequenteId);
                tableHTML += `<tr class="apenso-row" data-id="${apenso.id}" data-piloto-ref="${item.id}"><td>${formatProcessoForDisplay(apenso.numeroProcesso)}</td><td>${exApenso ? exApenso.nome : 'N/A'}</td><td>Apenso</td><td>${formatCurrency(apenso.valorDivida)}</td><td class="actions-cell"><button class="action-btn btn-edit" data-id="${apenso.id}">Editar</button><button class="action-btn btn-delete" data-id="${apenso.id}">Excluir</button></td></tr>`;
            });
        }
    });
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
    container.querySelector('tbody').addEventListener('click', handleProcessoAction);
}

// --- HANDLERS (CRUD) ---
function handleDevedorAction(event) { const target = event.target; if (target.classList.contains('action-btn')) { const devedorId = target.dataset.id; if (target.classList.contains('btn-delete')) handleDeleteDevedor(devedorId); else if (target.classList.contains('btn-edit')) handleEditDevedor(devedorId); } else { const row = target.closest('tr'); if (row && row.dataset.id) renderDevedorDetailPage(row.dataset.id); } }
function handleEditDevedor(devedorId) { db.collection("grandes_devedores").doc(devedorId).get().then(doc => { if (doc.exists) renderDevedorForm({ id: doc.id, ...doc.data() }); }); }
function handleDeleteDevedor(devedorId) { if (confirm("Tem certeza que deseja excluir este Grande Devedor?")) db.collection("grandes_devedores").doc(devedorId).delete().then(() => showToast("Devedor excluído com sucesso.")).catch(() => showToast("Ocorreu um erro ao excluir.", "error")); }
function handleProcessoAction(event) { const button = event.target.closest('.action-btn'); if (button) { event.stopPropagation(); const processoId = button.dataset.id; if (button.classList.contains('btn-delete')) handleDeleteProcesso(processoId); else if (button.classList.contains('btn-edit')) handleEditProcesso(processoId); } else { const row = event.target.closest('.piloto-row'); if (row) { row.classList.toggle('expanded'); document.querySelectorAll(`.apenso-row[data-piloto-ref="${row.dataset.id}"]`).forEach(apensoRow => apensoRow.classList.toggle('visible')); } } }
function handleEditProcesso(processoId) { const processo = processosCache.find(p => p.id === processoId); if (processo) renderProcessoForm(processo.devedorId, processo); else showToast("Processo não encontrado.", "error"); }
function handleDeleteProcesso(processoId) { const processo = processosCache.find(p => p.id === processoId); if (confirm(`Tem certeza que deseja excluir o processo ${formatProcessoForDisplay(processo.numeroProcesso)}?`)) db.collection("processos").doc(processoId).delete().then(() => showToast("Processo excluído com sucesso.")).catch(() => showToast("Ocorreu um erro ao excluir.", "error")); }
function handleRegistrarAnalise(devedorId) { if (confirm("Deseja registrar a data de análise para hoje?")) { db.collection("grandes_devedores").doc(devedorId).update({ dataUltimaAnalise: firebase.firestore.FieldValue.serverTimestamp() }).then(() => showToast("Data de análise registrada com sucesso!")).catch(err => { console.error("Erro ao registrar análise: ", err); showToast("Erro ao registrar análise.", "error"); }); } }

// --- FORMULÁRIOS: DEVEDORES ---
function renderDevedorForm(devedor = null) { const isEditing = devedor !== null; const formTitle = isEditing ? 'Editar Grande Devedor' : 'Cadastrar Novo Grande Devedor'; navigateTo(null); pageTitle.textContent = formTitle; document.title = `SASIF | ${formTitle}`; const razaoSocial = isEditing ? devedor.razaoSocial : ''; const cnpj = isEditing ? formatCNPJForDisplay(devedor.cnpj) : ''; const nomeFantasia = isEditing ? devedor.nomeFantasia : ''; const nivelPrioridade = isEditing ? devedor.nivelPrioridade : '1'; const observacoes = isEditing ? devedor.observacoes : ''; contentArea.innerHTML = `<div class="form-container" data-id="${isEditing ? devedor.id : ''}"><div class="form-group"><label for="razao-social">Razão Social (Obrigatório)</label><input type="text" id="razao-social" value="${razaoSocial}" required></div><div class="form-group"><label for="cnpj">CNPJ (Obrigatório)</label><input type="text" id="cnpj" value="${cnpj}" required oninput="maskCNPJ(this)"></div><div class="form-group"><label for="nome-fantasia">Nome Fantasia</label><input type="text" id="nome-fantasia" value="${nomeFantasia}"></div><div class="form-group"><label for="nivel-prioridade">Nível de Prioridade</label><select id="nivel-prioridade"><option value="1">Nível 1 (30 dias)</option><option value="2">Nível 2 (45 dias)</option><option value="3">Nível 3 (60 dias)</option></select></div><div class="form-group"><label for="observacoes">Observações</label><textarea id="observacoes">${observacoes}</textarea></div><div id="error-message"></div><div class="form-buttons"><button id="save-devedor-btn" class="btn-primary">Salvar</button><button id="cancel-btn">Cancelar</button></div></div>`; document.getElementById('nivel-prioridade').value = nivelPrioridade; document.getElementById('save-devedor-btn').addEventListener('click', () => { isEditing ? handleUpdateDevedor(devedor.id) : handleSaveDevedor(); }); document.getElementById('cancel-btn').addEventListener('click', () => navigateTo('dashboard')); }
function getDevedorDataFromForm() { const razaoSocial = document.getElementById('razao-social').value; const cnpj = document.getElementById('cnpj').value; const errorMessage = document.getElementById('error-message'); errorMessage.textContent = ''; if (!razaoSocial || !cnpj) { errorMessage.textContent = 'Razão Social e CNPJ são obrigatórios.'; return null; } if (cnpj.replace(/\D/g, '').length !== 14) { errorMessage.textContent = 'Por favor, preencha um CNPJ válido com 14 dígitos.'; return null; } return { razaoSocial, cnpj: cnpj.replace(/\D/g, ''), nomeFantasia: document.getElementById('nome-fantasia').value, nivelPrioridade: parseInt(document.getElementById('nivel-prioridade').value), observacoes: document.getElementById('observacoes').value }; }
function handleSaveDevedor() { const devedorData = getDevedorDataFromForm(); if (!devedorData) return; devedorData.criadoEm = firebase.firestore.FieldValue.serverTimestamp(); devedorData.uidUsuario = auth.currentUser.uid; db.collection("grandes_devedores").add(devedorData).then(() => { navigateTo('dashboard'); setTimeout(() => showToast("Grande Devedor salvo com sucesso!"), 100); }); }
function handleUpdateDevedor(devedorId) { const devedorData = getDevedorDataFromForm(); if (!devedorData) return; devedorData.atualizadoEm = firebase.firestore.FieldValue.serverTimestamp(); db.collection("grandes_devedores").doc(devedorId).update(devedorData).then(() => { navigateTo('dashboard'); setTimeout(() => showToast("Devedor atualizado com sucesso!"), 100); }); }

// --- PÁGINA: EXEQUENTES ---
function renderExequentesPage() { pageTitle.textContent = 'Exequentes'; document.title = 'SASIF | Exequentes'; contentArea.innerHTML = `<div class="dashboard-actions"><button id="add-exequente-btn" class="btn-primary">Cadastrar Novo Exequente</button></div><h2>Lista de Exequentes</h2><div id="exequentes-list-container"></div>`; document.getElementById('add-exequente-btn').addEventListener('click', () => renderExequenteForm()); renderExequentesList(exequentesCache); }
function renderExequentesList(exequentes) { const container = document.getElementById('exequentes-list-container'); if (!container) return; if (exequentes.length === 0) { container.innerHTML = `<p class="empty-list-message">Nenhum exequente cadastrado ainda.</p>`; return; } let tableHTML = `<table class="data-table"><thead><tr><th class="number-cell">#</th><th>Nome</th><th>CNPJ</th><th class="actions-cell">Ações</th></tr></thead><tbody>`; exequentes.forEach((exequente, index) => { tableHTML += `<tr data-id="${exequente.id}"><td class="number-cell">${index + 1}</td><td>${exequente.nome}</td><td>${formatCNPJForDisplay(exequente.cnpj)}</td><td class="actions-cell"><button class="action-btn btn-edit" data-id="${exequente.id}">Editar</button><button class="action-btn btn-delete" data-id="${exequente.id}">Excluir</button></td></tr>`; }); tableHTML += `</tbody></table>`; container.innerHTML = tableHTML; container.querySelector('tbody').addEventListener('click', handleExequenteAction); }
function renderExequenteForm(exequente = null) { const isEditing = exequente !== null; const formTitle = isEditing ? 'Editar Exequente' : 'Cadastrar Novo Exequente'; navigateTo(null); pageTitle.textContent = formTitle; document.title = `SASIF | ${formTitle}`; const nome = isEditing ? exequente.nome : ''; const cnpj = isEditing ? formatCNPJForDisplay(exequente.cnpj) : ''; contentArea.innerHTML = `<div class="form-container"><div class="form-group"><label for="nome">Nome (Obrigatório)</label><input type="text" id="nome" value="${nome}" required></div><div class="form-group"><label for="cnpj">CNPJ</label><input type="text" id="cnpj" value="${cnpj}" oninput="maskCNPJ(this)"></div><div id="error-message"></div><div class="form-buttons"><button id="save-exequente-btn" class="btn-primary">Salvar</button><button id="cancel-btn">Cancelar</button></div></div>`; document.getElementById('save-exequente-btn').addEventListener('click', () => { isEditing ? handleUpdateExequente(exequente.id) : handleSaveExequente(); }); document.getElementById('cancel-btn').addEventListener('click', () => navigateTo('exequentes')); }
function handleExequenteAction(event) { const target = event.target; const exequenteId = target.dataset.id; if (!exequenteId) return; if (target.classList.contains('btn-delete')) { handleDeleteExequente(exequenteId); } else if (target.classList.contains('btn-edit')) { db.collection("exequentes").doc(exequenteId).get().then(doc => { if (doc.exists) renderExequenteForm({ id: doc.id, ...doc.data() }); }); } }
function handleSaveExequente() { const nome = document.getElementById('nome').value; const cnpjInput = document.getElementById('cnpj').value; if (!nome) { document.getElementById('error-message').textContent = 'O nome do exequente é obrigatório.'; return; } const data = { nome, cnpj: cnpjInput.replace(/\D/g, ''), criadoEm: firebase.firestore.FieldValue.serverTimestamp() }; db.collection("exequentes").add(data).then(() => { navigateTo('exequentes'); setTimeout(() => showToast("Exequente salvo com sucesso!"), 100); }); }
function handleUpdateExequente(exequenteId) { const nome = document.getElementById('nome').value; const cnpjInput = document.getElementById('cnpj').value; if (!nome) { document.getElementById('error-message').textContent = 'O nome do exequente é obrigatório.'; return; } const data = { nome, cnpj: cnpjInput.replace(/\D/g, ''), atualizadoEm: firebase.firestore.FieldValue.serverTimestamp() }; db.collection("exequentes").doc(exequenteId).update(data).then(() => { navigateTo('exequentes'); setTimeout(() => showToast("Exequente atualizado com sucesso!"), 100); }); }
function handleDeleteExequente(exequenteId) { if (confirm("Tem certeza que deseja excluir este Exequente?")) { db.collection("exequentes").doc(exequenteId).delete().then(() => showToast("Exequente excluído com sucesso.")).catch(() => showToast("Ocorreu um erro ao excluir.", "error")); } }

// --- FORMULÁRIOS E HANDLERS: PROCESSOS ---
function renderProcessoForm(devedorId, processo = null) {
    const isEditing = processo !== null;
    pageTitle.textContent = isEditing ? 'Editar Processo' : 'Novo Processo';
    document.title = `SASIF | ${pageTitle.textContent}`;
    
    const pilotosDoDevedor = processosCache.filter(p => p.tipoProcesso === 'piloto' && p.id !== (processo ? processo.id : null));
    const pilotoOptions = pilotosDoDevedor.map(p => `<option value="${p.id}" ${isEditing && processo.processoPilotoId === p.id ? 'selected' : ''}>${formatProcessoForDisplay(p.numeroProcesso)}</option>`).join('');
    const exequenteOptions = exequentesCache.map(ex => `<option value="${ex.id}" ${isEditing && processo.exequenteId === ex.id ? 'selected' : ''}>${ex.nome}</option>`).join('');

    contentArea.innerHTML = `<div class="form-container"><div class="form-group"><label for="numero-processo">Número do Processo (Obrigatório)</label><input type="text" id="numero-processo" required oninput="maskProcesso(this)" value="${isEditing ? formatProcessoForDisplay(processo.numeroProcesso) : ''}"></div><div class="form-group"><label for="exequente">Exequente (Obrigatório)</label><select id="exequente"><option value="">Selecione...</option>${exequenteOptions}</select></div><div class="form-group"><label for="tipo-processo">Tipo</label><select id="tipo-processo"><option value="autonomo">Autônomo</option><option value="piloto">Piloto</option><option value="apenso">Apenso</option></select></div><div id="piloto-select-container"></div><div class="form-group"><label for="valor-divida">Valor da Dívida</label><input type="number" id="valor-divida" placeholder="0.00" step="0.01" value="${isEditing ? processo.valorDivida : ''}"></div><div class="form-group"><label for="cdas">CDA(s)</label><textarea id="cdas">${isEditing ? (processo.cdas || '') : ''}</textarea></div><div id="error-message"></div><div class="form-buttons"><button id="save-processo-btn" class="btn-primary">Salvar</button><button id="cancel-btn">Cancelar</button></div></div>`;
    
    const tipoProcessoSelect = document.getElementById('tipo-processo');
    if (isEditing) {
        tipoProcessoSelect.value = processo.tipoProcesso;
        document.getElementById('exequente').value = processo.exequenteId;
    }
    
    function togglePilotoSelect() {
        const container = document.getElementById('piloto-select-container');
        if (tipoProcessoSelect.value === 'apenso') {
            if (pilotosDoDevedor.length > 0) {
                container.innerHTML = `<div class="form-group"><label for="processo-piloto">Vincular ao Piloto</label><select id="processo-piloto"><option value="">Selecione o piloto...</option>${pilotoOptions}</select></div>`;
                if (isEditing && processo.processoPilotoId) document.getElementById('processo-piloto').value = processo.processoPilotoId;
            } else {
                container.innerHTML = `<p class="empty-list-message" style="margin-top:10px;">Não há processos piloto cadastrados para este devedor.</p>`;
            }
        } else { container.innerHTML = ''; }
    }
    
    togglePilotoSelect();
    tipoProcessoSelect.addEventListener('change', togglePilotoSelect);
    document.getElementById('save-processo-btn').addEventListener('click', () => handleSaveProcesso(devedorId, processo ? processo.id : null));
    document.getElementById('cancel-btn').addEventListener('click', () => renderDevedorDetailPage(devedorId));
}

function handleSaveProcesso(devedorId, processoId = null) {
    const numeroProcesso = document.getElementById('numero-processo').value;
    const exequenteId = document.getElementById('exequente').value;
    const tipoProcesso = document.getElementById('tipo-processo').value;
    const errorMessage = document.getElementById('error-message');
    if (!numeroProcesso || !exequenteId) { errorMessage.textContent = 'Número do Processo e Exequente são obrigatórios.'; return; }
    
    const processoData = { devedorId, numeroProcesso: numeroProcesso.replace(/\D/g, ''), exequenteId, tipoProcesso, valorDivida: parseFloat(document.getElementById('valor-divida').value) || 0, cdas: document.getElementById('cdas').value, uidUsuario: auth.currentUser.uid };
    
    if (tipoProcesso === 'apenso') {
        const processoPilotoId = document.getElementById('processo-piloto')?.value;
        if (!processoPilotoId) { errorMessage.textContent = 'Para apensos, é obrigatório selecionar um processo piloto.'; return; }
        processoData.processoPilotoId = processoPilotoId;
    } else {
        processoData.processoPilotoId = null; 
    }
    
    const promise = processoId
        ? db.collection("processos").doc(processoId).update({...processoData, atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()})
        : db.collection("processos").add({...processoData, criadoEm: firebase.firestore.FieldValue.serverTimestamp()});
        
    promise.then(() => { renderDevedorDetailPage(devedorId); setTimeout(() => showToast(`Processo ${processoId ? 'atualizado' : 'salvo'} com sucesso!`), 100); }).catch(err => { console.error("Erro ao salvar processo: ", err); errorMessage.textContent = 'Ocorreu um erro ao salvar.'; });
}

// --- AUTENTICAÇÃO E INICIALIZAÇÃO ---
function renderLoginForm() { document.title = 'SASIF | Login'; loginContainer.innerHTML = `<h1>SASIF</h1><p>Acesso ao Sistema de Acompanhamento</p><div class="form-group"><label for="email">E-mail</label><input type="email" id="email" required></div><div class="form-group"><label for="password">Senha</label><input type="password" id="password" required></div><div id="error-message"></div><div class="form-buttons"><button id="login-btn">Entrar</button><button id="signup-btn">Cadastrar</button></div>`; document.getElementById('login-btn').addEventListener('click', handleLogin); document.getElementById('signup-btn').addEventListener('click', handleSignUp); }
function handleLogin() { const email = document.getElementById('email').value; const password = document.getElementById('password').value; const errorMessage = document.getElementById('error-message'); if (!email || !password) { errorMessage.textContent = 'Por favor, preencha e-mail e senha.'; return; } auth.signInWithEmailAndPassword(email, password).catch(error => { errorMessage.textContent = 'E-mail ou senha incorretos.'; }); }
function handleSignUp() { const email = document.getElementById('email').value; const password = document.getElementById('password').value; const errorMessage = document.getElementById('error-message'); if (!email || !password) { errorMessage.textContent = 'Por favor, preencha e-mail e senha.'; return; } auth.createUserWithEmailAndPassword(email, password).catch(error => { if (error.code === 'auth/weak-password') errorMessage.textContent = 'A senha deve ter no mínimo 6 caracteres.'; else if (error.code === 'auth/email-already-in-use') errorMessage.textContent = 'Este e-mail já está em uso.'; else errorMessage.textContent = 'Ocorreu um erro ao tentar cadastrar.'; }); }
function setupListeners() { db.collection("grandes_devedores").orderBy("nivelPrioridade").orderBy("razaoSocial").onSnapshot((snapshot) => { devedoresCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); if (document.title.includes('Grandes Devedores')) renderDevedoresList(devedoresCache); }); db.collection("exequentes").orderBy("nome").onSnapshot((snapshot) => { exequentesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); if (document.title.includes('Exequentes')) renderExequentesList(exequentesCache); }); }
function setupProcessosListener(devedorId) { if (processosListenerUnsubscribe) processosListenerUnsubscribe(); processosListenerUnsubscribe = db.collection("processos").where("devedorId", "==", devedorId).onSnapshot((snapshot) => { processosCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); renderProcessosList(processosCache); }, error => { console.error("Erro ao buscar processos: ", error); if (error.code === 'failed-precondition' && document.getElementById('processos-list-container')) document.getElementById('processos-list-container').innerHTML = `<p class="empty-list-message">Erro: O índice necessário para esta consulta não existe. Verifique o console.</p>`; }); }
function initApp(user) { userEmailSpan.textContent = user.email; logoutButton.addEventListener('click', () => { auth.signOut(); }); setupListeners(); navigateTo('dashboard'); }
document.addEventListener('DOMContentLoaded', () => { auth.onAuthStateChanged(user => { if (user) { appContainer.classList.remove('hidden'); loginContainer.classList.add('hidden'); initApp(user); } else { appContainer.classList.add('hidden'); loginContainer.classList.remove('hidden'); renderLoginForm(); } }); });