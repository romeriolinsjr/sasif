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

// Variáveis de Cache e Listeners
let devedoresCache = [];
let exequentesCache = [];
let processosCache = [];
let diligenciasCache = []; // <-- ADICIONAR
let processosListenerUnsubscribe = null;
let corresponsaveisListenerUnsubscribe = null;
let diligenciasListenerUnsubscribe = null; // <-- ADICIONAR

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
    if (!cnpj || cnpj.length !== 14) return cnpj;
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

function maskDocument(input, tipoPessoa) {
    let value = input.value.replace(/\D/g, '');

    if (tipoPessoa === 'juridica') { // Se for Pessoa Jurídica, aplica máscara de CNPJ
        value = value.substring(0, 14); // Limita a 14 dígitos
        value = value.replace(/^(\d{2})(\d)/, '$1.$2');
        value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
        value = value.replace(/(\d{4})(\d)/, '$1-$2');
    } else { // Se for Pessoa Física (ou qualquer outro caso), aplica máscara de CPF
        value = value.substring(0, 11); // Limita a 11 dígitos
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    input.value = value;
}

function formatDocumentForDisplay(doc) {
    if (!doc) return 'Não informado';
    doc = doc.replace(/\D/g, '');
    if (doc.length === 11) { // CPF
        return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    if (doc.length === 14) { // CNPJ
        return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return doc; // Retorna o número sem formatação se não for nem CPF nem CNPJ
}

// --- NAVEGAÇÃO ---
// --- NAVEGAÇÃO ---
function renderSidebar(activePage) { const pages = [{ id: 'dashboard', name: 'Dashboard' }, { id: 'grandesDevedores', name: 'Grandes Devedores' }, { id: 'diligencias', name: 'Diligências Mensais' }, { id: 'exequentes', name: 'Exequentes' }, { id: 'motivos', name: 'Motivos de Suspensão' }];
mainNav.innerHTML = `<ul>${pages.map(page => `<li><a href="#" class="nav-link ${page.id === activePage ? 'active' : ''}" data-page="${page.id}">${page.name}</a></li>`).join('')}</ul>`; mainNav.querySelectorAll('.nav-link').forEach(link => { link.addEventListener('click', (e) => { e.preventDefault(); navigateTo(e.target.dataset.page); }); }); }
function navigateTo(page, params = {}) {
    if (processosListenerUnsubscribe) { processosListenerUnsubscribe(); processosListenerUnsubscribe = null; }
    if (corresponsaveisListenerUnsubscribe) { corresponsaveisListenerUnsubscribe(); corresponsaveisListenerUnsubscribe = null; }
    if (penhorasListenerUnsubscribe) { penhorasListenerUnsubscribe(); penhorasListenerUnsubscribe = null; }
    if (audienciasListenerUnsubscribe) { audienciasListenerUnsubscribe(); audienciasListenerUnsubscribe = null; }
    if (diligenciasListenerUnsubscribe) { diligenciasListenerUnsubscribe(); diligenciasListenerUnsubscribe = null; }
    
    renderSidebar(page);
    switch (page) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'grandesDevedores':
            renderGrandesDevedoresPage();
            break;
        case 'diligencias':
            renderDiligenciasPage();
            break;
        case 'exequentes':
            renderExequentesPage();
            break;
        case 'motivos':
            renderMotivosPage();
            break;
        case 'processoDetail':
            renderProcessoDetailPage(params.id);
            break;
        default:
            renderDashboard();
    }
}

// --- DASHBOARD / DEVEDORES ---

function renderDashboard() {
    pageTitle.textContent = 'Dashboard';
    document.title = 'SASIF | Dashboard';
    
    contentArea.innerHTML = `
        <div id="dashboard-widgets-container">
            <div id="audiencias-widget-container"></div>
            <div id="analises-widget-container"></div>
        </div>
    `;
    
    // Dispara a busca e renderização dos widgets toda vez que o dashboard é exibido.
    setupDashboardWidgets();
}

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

function renderGrandesDevedoresPage() {
    pageTitle.textContent = 'Grandes Devedores';
    document.title = 'SASIF | Grandes Devedores';

    contentArea.innerHTML = `
        <div class="dashboard-actions">
            <button id="add-devedor-btn" class="btn-primary">Cadastrar Novo Devedor</button>
        </div>
        <h2>Lista de Grandes Devedores</h2>
        <div id="devedores-list-container"></div>
    `;
    
    document.getElementById('add-devedor-btn').addEventListener('click', () => renderDevedorForm());
    
    // Renderiza a lista com os dados do cache
    renderDevedoresList(devedoresCache);
}

function renderDiligenciasPage() {
    pageTitle.textContent = 'Controle de Diligências do Mês';
    document.title = 'SASIF | Diligências Mensais';

    contentArea.innerHTML = `
        <div class="dashboard-actions">
            <button id="add-diligencia-btn" class="btn-primary">Adicionar Diligência</button>
        </div>
        <h2>Lista de Diligências do Mês</h2>
        <div id="diligencias-list-container">
            <p class="empty-list-message">Carregando diligências...</p>
        </div>
    `;
    
    document.getElementById('add-diligencia-btn').addEventListener('click', () => {
        renderDiligenciaFormModal();
    });

    setupDiligenciasListener(); // <-- ATIVAR O LISTENER AQUI
}

function renderDiligenciaFormModal(diligencia = null) {
    const isEditing = diligencia !== null;
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';

    modalOverlay.innerHTML = `
        <div class="modal-content modal-large">
            <h3>${isEditing ? 'Editar' : 'Adicionar'} Diligência Mensal</h3>
            
            <div class="form-group">
                <label for="diligencia-titulo">Título da Diligência (Obrigatório)</label>
                <input type="text" id="diligencia-titulo" value="${isEditing ? diligencia.titulo : ''}" required>
            </div>
            
            <div class="form-group">
                <label for="diligencia-dia">Dia Alvo do Mês (1-31, Obrigatório)</label>
                <input type="number" id="diligencia-dia" min="1" max="31" value="${isEditing ? diligencia.diaDoMes : ''}" required>
            </div>
            
            <div class="form-group">
                <label for="diligencia-processo">Processo Vinculado (Opcional)</label>
                <input type="text" id="diligencia-processo" placeholder="Formato: 0000000-00.0000.0.00.0000" value="${isEditing && diligencia.processoVinculado ? formatProcessoForDisplay(diligencia.processoVinculado) : ''}">
            </div>
            
            <div class="form-group">
                <label for="diligencia-descricao">Descrição Completa (Opcional)</label>
                <textarea id="diligencia-descricao" rows="5">${isEditing ? diligencia.descricao : ''}</textarea>
            </div>

            <div id="error-message"></div>
            <div class="form-buttons">
                <button id="save-diligencia-btn" class="btn-primary">Salvar</button>
                <button id="cancel-diligencia-btn">Cancelar</button>
            </div>
        </div>
    `;

    document.body.appendChild(modalOverlay);
    
    // Adiciona máscara ao campo de processo
    document.getElementById('diligencia-processo').addEventListener('input', (e) => maskProcesso(e.target));

    const closeModal = () => document.body.removeChild(modalOverlay);
    
    document.getElementById('save-diligencia-btn').addEventListener('click', () => {
        handleSaveDiligencia(isEditing ? diligencia.id : null);
    });
    document.getElementById('cancel-diligencia-btn').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
}

function handleSaveDiligencia(diligenciaId = null) {
    const titulo = document.getElementById('diligencia-titulo').value.trim();
    const diaDoMes = parseInt(document.getElementById('diligencia-dia').value, 10);
    const processoVinculadoInput = document.getElementById('diligencia-processo').value.trim();
    const descricao = document.getElementById('diligencia-descricao').value.trim();
    const errorMessage = document.getElementById('error-message');
    errorMessage.textContent = '';

    // Validações
    if (!titulo || !diaDoMes) {
        errorMessage.textContent = 'Título e Dia Alvo são obrigatórios.';
        return;
    }
    if (isNaN(diaDoMes) || diaDoMes < 1 || diaDoMes > 31) {
        errorMessage.textContent = 'O Dia Alvo deve ser um número entre 1 e 31.';
        return;
    }
    const processoVinculado = processoVinculadoInput.replace(/\D/g, '');
    if (processoVinculado && processoVinculado.length !== 20) {
        errorMessage.textContent = 'O Número do Processo, se preenchido, deve ser válido.';
        return;
    }

    const data = {
        titulo,
        diaDoMes,
        processoVinculado: processoVinculado || null, // Salva null se estiver vazio
        descricao,
        userId: auth.currentUser.uid
    };

    let promise;
    if (diligenciaId) {
        // Editando - ainda não vamos usar, mas a estrutura já está pronta
        data.atualizadoEm = firebase.firestore.FieldValue.serverTimestamp();
        promise = db.collection("diligenciasMensais").doc(diligenciaId).update(data);
    } else {
        // Criando
        data.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
        data.historicoCumprimentos = {}; // Inicia o histórico vazio
        promise = db.collection("diligenciasMensais").add(data);
    }

    promise.then(() => {
        showToast(`Diligência ${diligenciaId ? 'atualizada' : 'salva'} com sucesso!`);
        document.body.removeChild(document.querySelector('.modal-overlay'));
    }).catch(error => {
        console.error("Erro ao salvar diligência:", error);
        errorMessage.textContent = "Ocorreu um erro ao salvar a diligência.";
    });
}

function setupDiligenciasListener() {
    if (diligenciasListenerUnsubscribe) diligenciasListenerUnsubscribe(); // Limpa listener anterior

    const userId = auth.currentUser.uid;
    diligenciasListenerUnsubscribe = db.collection("diligenciasMensais")
        .where("userId", "==", userId)
        .orderBy("diaDoMes", "asc")
        .onSnapshot((snapshot) => {
            diligenciasCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderDiligenciasList(diligenciasCache);
        }, error => {
            console.error("Erro ao buscar diligências: ", error);
            const container = document.getElementById('diligencias-list-container');
            if(container) container.innerHTML = `<p class="empty-list-message">Ocorreu um erro ao carregar as diligências.</p>`;
        });
}

function renderDiligenciasList(diligencias) {
    const container = document.getElementById('diligencias-list-container');
    if (!container) return;

    if (diligencias.length === 0) {
        container.innerHTML = `<p class="empty-list-message">Nenhuma diligência mensal cadastrada. Clique em "Adicionar Diligência" para começar.</p>`;
        return;
    }

    const hoje = new Date();
    const anoMesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    let tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Dia Alvo</th>
                    <th>Título da Diligência</th>
                    <th>Processo Vinculado</th>
                    <th>Status (Mês Atual)</th>
                    <th class="actions-cell">Ações</th>
                </tr>
            </thead>
            <tbody>`;

    diligencias.forEach(item => {
        const isCumprida = item.historicoCumprimentos && item.historicoCumprimentos[anoMesAtual];
        let statusBadge = '';
        let acoesBtn = '';
        let linhaStyle = '';

        if (isCumprida) {
            const dataCumprimento = new Date(item.historicoCumprimentos[anoMesAtual].seconds * 1000);
            const dataFormatada = dataCumprimento.toLocaleDateString('pt-BR');
            statusBadge = `<span class="status-badge status-ativo">Cumprido em ${dataFormatada}</span>`;
            acoesBtn = `<button class="action-btn" data-action="desfazer" data-id="${item.id}">Desfazer</button>`;
            linhaStyle = 'style="background-color: #e8f5e9; text-decoration: line-through;"'; // Estilo para cumprido
        } else {
            statusBadge = `<span class="status-badge status-suspenso">Pendente</span>`; // Reutilizando a classe de suspenso para 'Pendente'
            acoesBtn = `<button class="action-btn btn-primary" style="background-color: var(--cor-sucesso);" data-action="cumprir" data-id="${item.id}">Cumprir</button>`;
        }
        
        tableHTML += `
            <tr ${linhaStyle}>
                <td style="text-align: center; font-weight: 500;">${item.diaDoMes}</td>
                <td><a href="#" class="view-processo-link" data-action="view-desc" data-id="${item.id}">${item.titulo}</a></td>
                <td>${item.processoVinculado ? formatProcessoForDisplay(item.processoVinculado) : 'N/A'}</td>
                <td>${statusBadge}</td>
                <td class="actions-cell">
                    ${acoesBtn}
                    <button class="action-btn btn-edit" data-action="edit" data-id="${item.id}">Editar</button>
                    <button class="action-btn btn-delete" data-action="delete" data-id="${item.id}">Excluir</button>
                </td>
            </tr>
        `;
    });

    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
    container.querySelector('tbody').addEventListener('click', handleDiligenciaAction);
}

function handleDiligenciaAction(event) {
    const target = event.target;
    const action = target.dataset.action;
    if (!action) return;

    event.preventDefault();
    const diligenciaId = target.dataset.id;

    if (action === 'cumprir') {
        handleCumprirDiligencia(diligenciaId);
    } else if (action === 'desfazer') {
        handleDesfazerDiligencia(diligenciaId);
    } else if (action === 'edit') {
        const diligencia = diligenciasCache.find(d => d.id === diligenciaId);
        if (diligencia) {
            renderDiligenciaFormModal(diligencia);
        }
    } else if (action === 'delete') {
        handleDeleteDiligencia(diligenciaId);
    } else if (action === 'view-desc') {
        const diligencia = diligenciasCache.find(d => d.id === diligenciaId);
        if (diligencia) {
            renderReadOnlyTextModal('Descrição da Diligência', diligencia.descricao);
        }
    }
}

function handleCumprirDiligencia(diligenciaId) {
    const hoje = new Date();
    const anoMesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    
    const updateData = {};
    updateData[`historicoCumprimentos.${anoMesAtual}`] = firebase.firestore.FieldValue.serverTimestamp();

    db.collection("diligenciasMensais").doc(diligenciaId).update(updateData)
        .then(() => {
            showToast("Diligência marcada como cumprida!");
        })
        .catch(error => {
            console.error("Erro ao cumprir diligência: ", error);
            showToast("Ocorreu um erro.", "error");
        });
}

function handleDesfazerDiligencia(diligenciaId) {
    const hoje = new Date();
    const anoMesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    const updateData = {};
    updateData[`historicoCumprimentos.${anoMesAtual}`] = firebase.firestore.FieldValue.delete();

    db.collection("diligenciasMensais").doc(diligenciaId).update(updateData)
        .then(() => {
            showToast("Ação desfeita.");
        })
        .catch(error => {
            console.error("Erro ao desfazer diligência: ", error);
            showToast("Ocorreu um erro.", "error");
        });
}

function handleDeleteDiligencia(diligenciaId) {
    if (confirm("Tem certeza que deseja excluir este modelo de diligência? Esta ação é permanente.")) {
        db.collection("diligenciasMensais").doc(diligenciaId).delete()
            .then(() => {
                showToast("Diligência excluída com sucesso.");
            })
            .catch(error => {
                console.error("Erro ao excluir diligência: ", error);
                showToast("Ocorreu um erro ao excluir.", "error");
            });
    }
}

function renderReadOnlyTextModal(title, content) {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';

    modalOverlay.innerHTML = `
        <div class="modal-content">
            <h3>${title}</h3>
            <div class="readonly-textarea">${content ? content.replace(/\n/g, '<br>') : 'Nenhuma informação cadastrada.'}</div>
            <div class="form-buttons" style="justify-content: flex-end; margin-top: 20px;">
                <button id="close-readonly-modal" class="btn-secondary">Fechar</button>
            </div>
        </div>
    `;

    document.body.appendChild(modalOverlay);

    const closeModal = () => document.body.removeChild(modalOverlay);

    document.getElementById('close-readonly-modal').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
}

// --- DETALHES DO DEVEDOR E PROCESSOS ---
function renderDevedorDetailPage(devedorId) { pageTitle.textContent = 'Carregando...'; document.title = 'SASIF | Carregando...'; renderSidebar(null); db.collection("grandes_devedores").doc(devedorId).get().then(doc => { if (!doc.exists) { showToast("Devedor não encontrado.", "error"); navigateTo('dashboard'); return; } const devedor = { id: doc.id, ...doc.data() }; pageTitle.textContent = devedor.razaoSocial; document.title = `SASIF | ${devedor.razaoSocial}`; // Substitua pelo seguinte trecho completo:
        contentArea.innerHTML = `
            <div class="detail-header-card">
                <p><strong>CNPJ:</strong> ${formatCNPJForDisplay(devedor.cnpj)}</p>
                ${devedor.nomeFantasia ? `<p><strong>Nome Fantasia:</strong> ${devedor.nomeFantasia}</p>` : ''}
            </div>

            ${ devedor.observacoes ? `
                <div class="detail-card">
                    <h3>Observações sobre o Devedor</h3>
                    <div class="detail-full-width">
                        <p>${devedor.observacoes.replace(/\n/g, '<br>')}</p>
                    </div>
                </div>
            ` : '' }
            
            <div class="dashboard-actions">
                <button id="add-processo-btn" class="btn-primary">Cadastrar Novo Processo</button>
                <button id="registrar-analise-btn" class="btn-primary">Registrar Análise Hoje</button>
            </div>

            <h2>Lista de Processos</h2>
            <div id="processos-list-container"></div>
        `; document.getElementById('add-processo-btn').addEventListener('click', () => renderProcessoForm(devedorId)); document.getElementById('registrar-analise-btn').addEventListener('click', () => handleRegistrarAnalise(devedorId)); setupProcessosListener(devedorId); }); }
function renderProcessosList(processos) {
    const container = document.getElementById('processos-list-container');
    if (!container) return;

    const autonomos = processos.filter(p => p.tipoProcesso === 'autonomo').sort((a,b) => (a.criadoEm.seconds < b.criadoEm.seconds) ? 1 : -1);
    const pilotos = processos.filter(p => p.tipoProcesso === 'piloto').sort((a,b) => (a.criadoEm.seconds < b.criadoEm.seconds) ? 1 : -1);
    const apensosMap = processos.filter(p => p.tipoProcesso === 'apenso').reduce((map, apenso) => { const pilotoId = apenso.processoPilotoId; if (!map.has(pilotoId)) map.set(pilotoId, []); map.get(pilotoId).push(apenso); return map; }, new Map());
    
    const itemsOrdenados = [...autonomos, ...pilotos];

    if (itemsOrdenados.length === 0) {
        container.innerHTML = `<p class="empty-list-message">Nenhum processo cadastrado.</p>`;
        return;
    }

    let tableHTML = `<table class="data-table"><thead><tr><th>Número do Processo</th><th>Exequente</th><th>Tipo</th><th>Status</th><th>Valor</th><th class="actions-cell">Ações</th></tr></thead><tbody>`;

    itemsOrdenados.forEach(item => {
        const exequente = exequentesCache.find(ex => ex.id === item.exequenteId);
        
        // Lógica de status para piloto/autônomo
        const motivo = item.status === 'Suspenso' && item.motivoSuspensaoId 
            ? motivosSuspensaoCache.find(m => m.id === item.motivoSuspensaoId)
            : null;
        const statusText = motivo ? `Suspenso (${motivo.descricao})` : (item.status || 'Ativo');

        const itemHTML = `
            <td>${item.tipoProcesso === 'piloto' ? '<span class="toggle-icon"></span>' : ''}<a href="#" class="view-processo-link" data-action="view-detail">${formatProcessoForDisplay(item.numeroProcesso)}</a></td>
            <td>${exequente ? exequente.nome : 'N/A'}</td>
            <td>${item.tipoProcesso.charAt(0).toUpperCase() + item.tipoProcesso.slice(1)}</td>
            <td><span class="status-badge status-${(item.status || 'Ativo').toLowerCase()}">${statusText}</span></td>
            <td>${formatCurrency(item.valorAtual ? item.valorAtual.valor : item.valorDivida)}</td>
            <td class="actions-cell">
                <button class="action-btn btn-edit" data-id="${item.id}">Editar</button>
                <button class="action-btn btn-delete" data-id="${item.id}">Excluir</button>
            </td>`;
        
        tableHTML += `<tr class="${item.tipoProcesso}-row" data-id="${item.id}" ${item.tipoProcesso === 'piloto' ? `data-piloto-id="${item.id}"` : ''}>${itemHTML}</tr>`;

        if (item.tipoProcesso === 'piloto' && apensosMap.has(item.id)) {
            apensosMap.get(item.id).forEach(apenso => {
                const exApenso = exequentesCache.find(ex => ex.id === apenso.exequenteId);

                // Lógica de status para processo apenso
                const motivoApenso = apenso.status === 'Suspenso' && apenso.motivoSuspensaoId 
                    ? motivosSuspensaoCache.find(m => m.id === apenso.motivoSuspensaoId)
                    : null;
                const statusTextApenso = motivoApenso ? `Suspenso (${motivoApenso.descricao})` : (apenso.status || 'Ativo');

                const apensoHTML = `
                    <td><a href="#" class="view-processo-link" data-action="view-detail">${formatProcessoForDisplay(apenso.numeroProcesso)}</a></td>
                    <td>${exApenso ? exApenso.nome : 'N/A'}</td>
                    <td>Apenso</td>
                    <td><span class="status-badge status-${(apenso.status || 'Ativo').toLowerCase()}">${statusTextApenso}</span></td>
                    <td>${formatCurrency(apenso.valorDivida)}</td>
                    <td class="actions-cell">
                        <button class="action-btn btn-edit" data-id="${apenso.id}">Editar</button>
                        <button class="action-btn btn-delete" data-id="${apenso.id}">Excluir</button>
                    </td>`;
                    
                tableHTML += `<tr class="apenso-row" data-id="${apenso.id}" data-piloto-ref="${item.id}">${apensoHTML}</tr>`;
            });
        }
    });

    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
    container.querySelector('tbody').addEventListener('click', handleProcessoAction);
}

// --- DETALHES DO PROCESSO, CORRESPONSÁVEIS, ETC ---
function renderProcessoDetailPage(processoId) {
    pageTitle.textContent = 'Carregando Processo...';
    document.title = 'SASIF | Carregando...';
    renderSidebar(null); 

    db.collection("processos").doc(processoId).get().then(doc => {
        if (!doc.exists) {
            showToast("Processo não encontrado.", "error");
            navigateTo('dashboard');
            return;
        }
        const processo = { id: doc.id, ...doc.data() };
        const devedor = devedoresCache.find(d => d.id === processo.devedorId);
        const exequente = exequentesCache.find(e => e.id === processo.exequenteId);

        const pageTitleText = `Processo ${formatProcessoForDisplay(processo.numeroProcesso)}`;
        pageTitle.textContent = pageTitleText;
        document.title = `SASIF | ${pageTitleText}`;
        
        contentArea.innerHTML = `
            <div class="dashboard-actions">
            <button id="back-to-devedor-btn" class="btn-secondary"> ← Voltar para ${devedor ? devedor.razaoSocial : 'Devedor'}</button>
${ (processo.tipoProcesso === 'apenso' || processo.tipoProcesso === 'autonomo') ? `<button id="promote-piloto-btn" class="btn-primary" style="background-color: var(--cor-sucesso);">★ Promover a Piloto</button>` : '' }
${ (processo.tipoProcesso === 'apenso') ? `<button id="unattach-processo-btn" class="btn-secondary" style="background-color: #ffc107; color: #333;">⬚ Desapensar</button>` : '' }
            </div>
            
            <div class="detail-card">
    <h3>Detalhes do Processo</h3>
    <div class="detail-grid" style="grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));">
        
        <!-- Coluna Esquerda -->
        <div>
            <p><strong>Exequente:</strong> ${exequente ? exequente.nome : 'N/A'}</p>
            <p><strong>Executado:</strong> ${devedor ? devedor.razaoSocial : 'N/A'}</p>
        </div>

        <!-- Coluna Direita -->
        <div>
            <p><strong>Tipo:</strong> ${processo.tipoProcesso.charAt(0).toUpperCase() + processo.tipoProcesso.slice(1)}</p>
            <div class="valor-divida-container">
                <p><strong>Valor da Dívida:</strong> ${formatCurrency(processo.valorAtual ? processo.valorAtual.valor : processo.valorDivida)}</p>
                <div class="valor-divida-actions">
                    <button id="update-valor-btn" class="action-btn btn-edit">Atualizar</button>
                    <button id="view-history-btn" class="action-btn btn-secondary">Histórico</button>
                </div>
            </div>
        </div>

    </div>
    <div class="detail-full-width">
        <strong>CDA(s):</strong> 
        <p>${processo.cdas ? processo.cdas.replace(/\n/g, '<br>') : 'Nenhuma CDA cadastrada.'}</p>
    </div>
</div>

            <div class="content-section">
                <div class="section-header">
                    <h2>Corresponsáveis Tributários</h2>
                    <button id="add-corresponsavel-btn" class="btn-primary">Adicionar</button>
                </div>
                <div id="corresponsaveis-list-container">
                    <!-- A lista de corresponsáveis será renderizada aqui -->
                </div>
            </div>

            <div class="content-section">
                <div class="section-header">
                    <h2>Penhoras Realizadas</h2>
                    <button id="add-penhora-btn" class="btn-primary">Adicionar</button>
                </div>
                <div id="penhoras-list-container">
                    <!-- A lista de penhoras será renderizada aqui -->
                </div>
            </div>
                        <div class="content-section">
                <div class="section-header">
                    <h2>Audiências Agendadas</h2>
                    <button id="add-audiencia-btn" class="btn-primary">Adicionar</button>
                </div>
                <div id="audiencias-list-container">
                    <!-- A lista de audiências será renderizada aqui -->
                </div>
            </div>
        `;

        document.getElementById('back-to-devedor-btn').addEventListener('click', () => {
            renderDevedorDetailPage(processo.devedorId);
        });
        
        document.getElementById('add-corresponsavel-btn').addEventListener('click', () => renderCorresponsavelFormModal(processoId));
        setupCorresponsaveisListener(processoId);
        document.getElementById('add-penhora-btn').addEventListener('click', () => renderPenhoraFormModal(processoId));
        setupPenhorasListener(processoId);
        document.getElementById('add-audiencia-btn').addEventListener('click', () => renderAudienciaFormModal(processoId));
        setupAudienciasListener(processoId);
            if (document.getElementById('promote-piloto-btn')) {
            document.getElementById('promote-piloto-btn').addEventListener('click', () => {
                handlePromoteToPiloto(processo.id);
            });
        }
        // ADICIONE O CÓDIGO DO NOVO LISTENER AQUI
        if (document.getElementById('unattach-processo-btn')) {
            document.getElementById('unattach-processo-btn').addEventListener('click', () => {
                handleUnattachProcesso(processo.id);
            });
        }
        // Adicione este bloco no final da cadeia de listeners, antes do .catch
        document.getElementById('update-valor-btn').addEventListener('click', () => {
            renderValorUpdateModal(processo.id);
        });

        document.getElementById('view-history-btn').addEventListener('click', () => {
            renderValorHistoryModal(processo.id);
        });
    }).catch(error => { //...
    }).catch(error => {
        console.error("Erro ao buscar detalhes do processo:", error);
        showToast("Erro ao carregar o processo.", "error");
    });
}

function renderCorresponsavelFormModal(processoId, corresponsavel = null) {
    const isEditing = corresponsavel !== null;
    const tipoPessoa = isEditing ? (corresponsavel.cpfCnpj && corresponsavel.cpfCnpj.length > 11 ? 'juridica' : 'fisica') : 'fisica';

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';

    modalOverlay.innerHTML = `
        <div class="modal-content modal-large">
            <h3>${isEditing ? 'Editar' : 'Adicionar'} Corresponsável</h3>
            <div class="form-group">
                <label for="corresponsavel-nome">Nome / Razão Social (Obrigatório)</label>
                <input type="text" id="corresponsavel-nome" value="${isEditing ? corresponsavel.nome : ''}" required>
            </div>
            <div class="form-group">
                <label for="tipo-pessoa">Tipo de Pessoa</label>
                <select id="tipo-pessoa">
                    <option value="fisica">Pessoa Física</option>
                    <option value="juridica">Pessoa Jurídica</option>
                </select>
            </div>
            <div class="form-group">
                <label for="corresponsavel-documento">CPF / CNPJ</label>
                <input type="text" id="corresponsavel-documento" 
                       value="${isEditing ? formatDocumentForDisplay(corresponsavel.cpfCnpj) : ''}"
                       placeholder="Digite o CPF">
            </div>
            <div id="error-message"></div>
            <div class="form-buttons">
                <button id="save-corresponsavel-btn" class="btn-primary">Salvar</button>
                <button id="cancel-corresponsavel-btn">Cancelar</button>
            </div>
        </div>
    `;

    document.body.appendChild(modalOverlay);

    const tipoPessoaSelect = document.getElementById('tipo-pessoa');
    const documentoInput = document.getElementById('corresponsavel-documento');
    
    // Define o valor inicial do seletor
    tipoPessoaSelect.value = tipoPessoa;

    // Função para ajustar o campo de documento
    const updateDocumentField = () => {
        if (tipoPessoaSelect.value === 'fisica') {
            documentoInput.placeholder = 'Digite o CPF';
        } else {
            documentoInput.placeholder = 'Digite o CNPJ';
        }
        documentoInput.value = ''; // Limpa o campo ao trocar o tipo
    };

    updateDocumentField(); // Chama a função uma vez para o estado inicial
    
    // Adiciona o listener para a máscara e para a troca de tipo
    documentoInput.addEventListener('input', () => maskDocument(documentoInput, tipoPessoaSelect.value));
    tipoPessoaSelect.addEventListener('change', updateDocumentField);
    
    // Se estiver editando, não limpa o campo inicial
    if(isEditing) {
        documentoInput.value = formatDocumentForDisplay(corresponsavel.cpfCnpj);
    } else {
        updateDocumentField();
    }


    const closeModal = () => document.body.removeChild(modalOverlay);
    
    document.getElementById('save-corresponsavel-btn').addEventListener('click', () => {
        handleSaveCorresponsavel(processoId, isEditing ? corresponsavel.id : null);
    });
    document.getElementById('cancel-corresponsavel-btn').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });
}

function setupCorresponsaveisListener(processoId) {
    if (corresponsaveisListenerUnsubscribe) corresponsaveisListenerUnsubscribe();

    corresponsaveisListenerUnsubscribe = db.collection("corresponsaveis")
        .where("processoId", "==", processoId)
        .orderBy("criadoEm", "desc")
        .onSnapshot((snapshot) => {
            const corresponsaveis = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderCorresponsaveisList(corresponsaveis, processoId);
        }, error => {
            console.error("Erro ao buscar corresponsáveis: ", error);
            const container = document.getElementById('corresponsaveis-list-container');
            if(container) container.innerHTML = `<p class="empty-list-message">Ocorreu um erro ao carregar os corresponsáveis.</p>`;
        });
}

function renderCorresponsaveisList(corresponsaveis, processoId) {
    const container = document.getElementById('corresponsaveis-list-container');
    if (!container) return;

    container.dataset.processoId = processoId;

    if (corresponsaveis.length === 0) {
        container.innerHTML = `<p class="empty-list-message">Nenhum corresponsável cadastrado para este processo.</p>`;
        return;
    }

    let tableHTML = `<table class="data-table"><thead><tr><th>Nome / Razão Social</th><th>CPF/CNPJ</th><th class="actions-cell">Ações</th></tr></thead><tbody>`;
    corresponsaveis.forEach(item => {
        tableHTML += `
            <tr data-id="${item.id}" data-nome="${item.nome}" data-cpf-cnpj="${item.cpfCnpj || ''}">
                <td>${item.nome}</td>
                <td>${formatDocumentForDisplay(item.cpfCnpj)}</td>
                <td class="actions-cell">
                    <button class="action-btn btn-edit" data-action="edit">Editar</button>
                    <button class="action-btn btn-delete" data-action="delete">Excluir</button>
                </td>
            </tr>
        `;
    });
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
    
    container.querySelector('tbody').addEventListener('click', handleCorresponsavelAction);
}

function handleCorresponsavelAction(event) {
    const button = event.target;
    const action = button.dataset.action;
    if (!action) return;

    const row = button.closest('tr');
    const corresponsavelId = row.dataset.id;
    const container = document.getElementById('corresponsaveis-list-container');
    const processoId = container.dataset.processoId;

    if (action === 'edit') {
        const corresponsavelData = {
            id: corresponsavelId,
            nome: row.dataset.nome,
            cpfCnpj: row.dataset.cpfCnpj
        };
        renderCorresponsavelFormModal(processoId, corresponsavelData);
    } else if (action === 'delete') {
        handleDeleteCorresponsavel(corresponsavelId);
    }
}

function handleSaveCorresponsavel(processoId, corresponsavelId = null) {
    const nome = document.getElementById('corresponsavel-nome').value.trim();
    const documento = document.getElementById('corresponsavel-documento').value.trim();
    const errorMessage = document.getElementById('error-message');
    errorMessage.textContent = '';

    if (!nome) {
        errorMessage.textContent = 'O campo Nome / Razão Social é obrigatório.';
        return;
    }
    
    const data = {
        processoId,
        nome,
        cpfCnpj: documento.replace(/\D/g, '') // Salva apenas os números
    };

    let promise;
    if (corresponsavelId) {
        // Editando
        data.atualizadoEm = firebase.firestore.FieldValue.serverTimestamp();
        promise = db.collection("corresponsaveis").doc(corresponsavelId).update(data);
    } else {
        // Criando
        data.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
        promise = db.collection("corresponsaveis").add(data);
    }

    promise.then(() => {
        showToast(`Corresponsável ${corresponsavelId ? 'atualizado' : 'salvo'} com sucesso!`);
        document.body.removeChild(document.querySelector('.modal-overlay'));
    }).catch(error => {
        console.error("Erro ao salvar corresponsável:", error);
        errorMessage.textContent = "Ocorreu um erro ao salvar.";
    });
}

function handleDeleteCorresponsavel(corresponsavelId) {
    if (confirm("Tem certeza que deseja excluir este corresponsável?")) {
        db.collection("corresponsaveis").doc(corresponsavelId).delete()
            .then(() => showToast("Corresponsável excluído com sucesso."))
            .catch(error => {
                console.error("Erro ao excluir corresponsável:", error);
                showToast("Erro ao excluir o corresponsável.", "error");
            });
    }
}

// --- GERENCIAMENTO DE PENHORAS ---

let penhorasListenerUnsubscribe = null;

function renderPenhoraFormModal(processoId, penhora = null, isReadOnly = false) {
    const isEditing = penhora !== null;
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';

    // Define o conteúdo e os botões com base no modo (leitura ou edição)
    let formContentHTML = '';
    let formButtonsHTML = '';

    if (isReadOnly) {
        // --- MODO DE VISUALIZAÇÃO ---
        formContentHTML = `
            <div class="form-group">
                <label>Descrição Completa do Bem</label>
                <div class="readonly-textarea">${penhora.descricao}</div>
            </div>
        `;
        formButtonsHTML = `<button id="close-penhora-btn" class="btn-primary">Fechar</button>`;
    } else {
        // --- MODO DE CRIAÇÃO/EDIÇÃO ---
        formContentHTML = `
            <div class="form-group">
                <label for="penhora-descricao">Descrição do Bem (Obrigatório)</label>
                <textarea id="penhora-descricao" required rows="5">${isEditing ? penhora.descricao : ''}</textarea>
            </div>
            <div class="form-group">
                <label for="penhora-valor">Valor de Avaliação</label>
                <input type="number" id="penhora-valor" placeholder="0.00" step="0.01" value="${isEditing ? penhora.valor : ''}">
            </div>
            <div class="form-group">
                <label for="penhora-data">Data da Penhora</label>
                <input type="date" id="penhora-data" value="${isEditing ? penhora.data : ''}">
            </div>
            <div id="error-message"></div>
        `;
        formButtonsHTML = `
            <button id="save-penhora-btn" class="btn-primary">Salvar</button>
            <button id="cancel-penhora-btn">Cancelar</button>
        `;
    }

    modalOverlay.innerHTML = `
        <div class="modal-content modal-large">
            <h3>${isReadOnly ? 'Detalhes da Penhora' : (isEditing ? 'Editar' : 'Adicionar') + ' Penhora'}</h3>
            ${formContentHTML}
            <div class="form-buttons">
                ${formButtonsHTML}
            </div>
        </div>
    `;

    document.body.appendChild(modalOverlay);

    const closeModal = () => document.body.removeChild(modalOverlay);

    // Adiciona os listeners apropriados
    if (isReadOnly) {
        document.getElementById('close-penhora-btn').addEventListener('click', closeModal);
    } else {
        document.getElementById('save-penhora-btn').addEventListener('click', () => {
            handleSavePenhora(processoId, isEditing ? penhora.id : null);
        });
        document.getElementById('cancel-penhora-btn').addEventListener('click', closeModal);
    }
    
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });
}

function setupPenhorasListener(processoId) {
    if (penhorasListenerUnsubscribe) penhorasListenerUnsubscribe();

    penhorasListenerUnsubscribe = db.collection("penhoras")
        .where("processoId", "==", processoId)
        .orderBy("criadoEm", "desc")
        .onSnapshot((snapshot) => {
            const penhoras = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderPenhorasList(penhoras, processoId);
        }, error => {
            console.error("Erro ao buscar penhoras: ", error);
            const container = document.getElementById('penhoras-list-container');
            if(container) container.innerHTML = `<p class="empty-list-message">Ocorreu um erro ao carregar as penhoras. Verifique se o índice do Firestore foi criado (veja o console do navegador).</p>`;
        });
}

function renderPenhorasList(penhoras, processoId) {
    const container = document.getElementById('penhoras-list-container');
    if (!container) return;

    container.dataset.processoId = processoId;

    if (penhoras.length === 0) {
        container.innerHTML = `<p class="empty-list-message">Nenhuma penhora cadastrada para este processo.</p>`;
        return;
    }

    const truncateText = (text, maxLength) => {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    };

    let tableHTML = `<table class="data-table"><thead><tr><th>Descrição do Bem</th><th>Valor</th><th>Data</th><th class="actions-cell">Ações</th></tr></thead><tbody>`;
    penhoras.forEach(item => {
        let dataFormatada = 'Não informada';
        if (item.data) {
            const partes = item.data.split('-');
            dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
        }
        
        tableHTML += `
            <tr data-id="${item.id}" 
                data-descricao="${item.descricao}" 
                data-valor="${item.valor || ''}" 
                data-data="${item.data || ''}">
                <td>
                    <a href="#" class="view-penhora-link" data-action="view">
                        ${truncateText(item.descricao, 80)}
                    </a>
                </td>
                <td>${formatCurrency(item.valor || 0)}</td>
                <td>${dataFormatada}</td>
                <td class="actions-cell">
                    <button class="action-btn btn-edit" data-action="edit">Editar</button>
                    <button class="action-btn btn-delete" data-action="delete">Excluir</button>
                </td>
            </tr>
        `;
    });
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
    
    container.querySelector('tbody').addEventListener('click', handlePenhoraAction);
}

function handlePenhoraAction(event) {
    event.preventDefault();
    const target = event.target;
    const action = target.dataset.action;
    if (!action) return;

    const row = target.closest('tr');
    const penhoraId = row.dataset.id;
    const container = document.getElementById('penhoras-list-container');
    const processoId = container.dataset.processoId;

    const penhoraData = {
        id: penhoraId,
        descricao: row.dataset.descricao,
        valor: row.dataset.valor,
        data: row.dataset.data
    };

    if (action === 'view') {
        // Abre o modal em modo SOMENTE LEITURA
        renderPenhoraFormModal(processoId, penhoraData, true);
    } else if (action === 'edit') {
        // Abre o modal em modo de EDIÇÃO
        renderPenhoraFormModal(processoId, penhoraData, false);
    } else if (action === 'delete') {
        handleDeletePenhora(penhoraId);
    }
}

function handleSavePenhora(processoId, penhoraId = null) {
    const descricao = document.getElementById('penhora-descricao').value.trim();
    const valor = document.getElementById('penhora-valor').value;
    const data = document.getElementById('penhora-data').value;
    const errorMessage = document.getElementById('error-message');
    errorMessage.textContent = '';

    if (!descricao) {
        errorMessage.textContent = 'O campo Descrição do Bem é obrigatório.';
        return;
    }
    
    const penhoraData = {
        processoId,
        descricao,
        valor: parseFloat(valor) || 0,
        data: data || null
    };

    let promise;
    if (penhoraId) {
        penhoraData.atualizadoEm = firebase.firestore.FieldValue.serverTimestamp();
        promise = db.collection("penhoras").doc(penhoraId).update(penhoraData);
    } else {
        penhoraData.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
        promise = db.collection("penhoras").add(penhoraData);
    }

    promise.then(() => {
        showToast(`Penhora ${penhoraId ? 'atualizada' : 'salva'} com sucesso!`);
        document.body.removeChild(document.querySelector('.modal-overlay'));
    }).catch(error => {
        console.error("Erro ao salvar penhora:", error);
        errorMessage.textContent = "Ocorreu um erro ao salvar.";
    });
}

function handleDeletePenhora(penhoraId) {
    if (confirm("Tem certeza que deseja excluir esta penhora?")) {
        db.collection("penhoras").doc(penhoraId).delete()
            .then(() => showToast("Penhora excluída com sucesso."))
            .catch(error => {
                console.error("Erro ao excluir penhora:", error);
                showToast("Erro ao excluir a penhora.", "error");
            });
    }
}

// --- GERENCIAMENTO DE AUDIÊNCIAS ---

let audienciasListenerUnsubscribe = null;

function renderAudienciaFormModal(processoId, audiencia = null) {
    const isEditing = audiencia !== null;
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';

    // Para o campo de data e hora, precisamos do formato YYYY-MM-DDTHH:MM
    let dataHora = '';
    if (isEditing && audiencia.dataHora) {
        dataHora = new Date(audiencia.dataHora.seconds * 1000).toISOString().slice(0, 16);
    }
    
    modalOverlay.innerHTML = `
        <div class="modal-content">
            <h3>${isEditing ? 'Editar' : 'Agendar'} Audiência</h3>
            <div class="form-group">
                <label for="audiencia-data-hora">Data e Hora (Obrigatório)</label>
                <input type="datetime-local" id="audiencia-data-hora" value="${dataHora}" required>
            </div>
            <div class="form-group">
                <label for="audiencia-local">Local</label>
                <input type="text" id="audiencia-local" placeholder="Ex: Sala de Audiências da 6ª Vara" value="${isEditing ? audiencia.local : ''}">
            </div>
            <div class="form-group">
                <label for="audiencia-obs">Observações</label>
                <textarea id="audiencia-obs" rows="3">${isEditing ? audiencia.observacoes : ''}</textarea>
            </div>
            <div id="error-message"></div>
            <div class="form-buttons">
                <button id="save-audiencia-btn" class="btn-primary">Salvar</button>
                <button id="cancel-audiencia-btn">Cancelar</button>
            </div>
        </div>
    `;

    document.body.appendChild(modalOverlay);

    const closeModal = () => document.body.removeChild(modalOverlay);
    
    document.getElementById('save-audiencia-btn').addEventListener('click', () => {
        handleSaveAudiencia(processoId, isEditing ? audiencia.id : null);
    });
    document.getElementById('cancel-audiencia-btn').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });
}

function setupAudienciasListener(processoId) {
    if (audienciasListenerUnsubscribe) audienciasListenerUnsubscribe();

    audienciasListenerUnsubscribe = db.collection("audiencias")
        .where("processoId", "==", processoId)
        .orderBy("dataHora", "desc")
        .onSnapshot((snapshot) => {
            const audiencias = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderAudienciasList(audiencias, processoId);
        }, error => {
            console.error("Erro ao buscar audiências: ", error);
            const container = document.getElementById('audiencias-list-container');
            if(container) container.innerHTML = `<p class="empty-list-message">Ocorreu um erro ao carregar as audiências. Verifique se o índice do Firestore foi criado.</p>`;
        });
}

function renderAudienciasList(audiencias, processoId) {
    const container = document.getElementById('audiencias-list-container');
    if (!container) return;

    container.dataset.processoId = processoId;

    if (audiencias.length === 0) {
        container.innerHTML = `<p class="empty-list-message">Nenhuma audiência agendada para este processo.</p>`;
        return;
    }

    let tableHTML = `<table class="data-table"><thead><tr><th>Data e Hora</th><th>Local</th><th>Observações</th><th class="actions-cell">Ações</th></tr></thead><tbody>`;
    audiencias.forEach(item => {
        const data = new Date(item.dataHora.seconds * 1000);
        const dataFormatada = data.toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        
        tableHTML += `
            <tr data-id="${item.id}">
                <td>${dataFormatada}</td>
                <td>${item.local || 'Não informado'}</td>
                <td style="white-space: pre-wrap;">${item.observacoes || ''}</td>
                <td class="actions-cell">
                    <button class="action-btn btn-edit" data-action="edit">Editar</button>
                    <button class="action-btn btn-delete" data-action="delete">Excluir</button>
                </td>
            </tr>
        `;
    });
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
    
    container.querySelector('tbody').addEventListener('click', (event) => handleAudienciaAction(event, audiencias));
}

function handleAudienciaAction(event, audiencias) {
    const button = event.target;
    const action = button.dataset.action;
    if (!action) return;

    const row = button.closest('tr');
    const audienciaId = row.dataset.id;
    const container = document.getElementById('audiencias-list-container');
    const processoId = container.dataset.processoId;
    
    const audienciaData = audiencias.find(a => a.id === audienciaId);

    if (action === 'edit') {
        renderAudienciaFormModal(processoId, audienciaData);
    } else if (action === 'delete') {
        handleDeleteAudiencia(audienciaId);
    }
}

function handleSaveAudiencia(processoId, audienciaId = null) {
    const dataHoraInput = document.getElementById('audiencia-data-hora').value;
    const local = document.getElementById('audiencia-local').value.trim();
    const observacoes = document.getElementById('audiencia-obs').value.trim();
    const errorMessage = document.getElementById('error-message');
    errorMessage.textContent = '';

    if (!dataHoraInput) {
        errorMessage.textContent = 'O campo Data e Hora é obrigatório.';
        return;
    }

    // --- LÓGICA NOVA: BUSCAR DADOS PARA DESNORMALIZAÇÃO ---
    const processo = processosCache.find(p => p.id === processoId);
    const devedor = devedoresCache.find(d => d.id === processo.devedorId);
    // --------------------------------------------------------
    
    const audienciaData = {
        processoId,
        dataHora: new Date(dataHoraInput),
        local,
        observacoes,
        // --- CAMPOS NOVOS PARA O DASHBOARD ---
        numeroProcesso: processo ? processo.numeroProcesso : 'Não encontrado',
        razaoSocialDevedor: devedor ? devedor.razaoSocial : 'Não encontrado',
        devedorId: devedor ? devedor.id : null
        // ------------------------------------
    };

    let promise;
    if (audienciaId) {
        audienciaData.atualizadoEm = firebase.firestore.FieldValue.serverTimestamp();
        promise = db.collection("audiencias").doc(audienciaId).update(audienciaData);
    } else {
        audienciaData.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
        promise = db.collection("audiencias").add(audienciaData);
    }

    promise.then(() => {
        showToast(`Audiência ${audienciaId ? 'atualizada' : 'agendada'} com sucesso!`);
        document.body.removeChild(document.querySelector('.modal-overlay'));
    }).catch(error => {
        console.error("Erro ao salvar audiência:", error);
        errorMessage.textContent = "Ocorreu um erro ao salvar.";
    });
}

function handleDeleteAudiencia(audienciaId) {
    if (confirm("Tem certeza que deseja cancelar esta audiência?")) {
        db.collection("audiencias").doc(audienciaId).delete()
            .then(() => showToast("Audiência cancelada com sucesso."))
            .catch(error => {
                console.error("Erro ao excluir audiência:", error);
                showToast("Erro ao cancelar a audiência.", "error");
            });
    }
}

function setupDashboardWidgets() {
    // --- Widget de Próximas Audiências ---
    const hoje = new Date();
    db.collection("audiencias")
      .where("dataHora", ">=", hoje)
      .orderBy("dataHora", "asc")
      .limit(10)
      .get()
      .then((snapshot) => {
          const audienciasFuturas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          // Renderiza APENAS o widget de audiências
          renderProximasAudienciasWidget(audienciasFuturas);
      })
      .catch(error => {
          console.error("Erro ao buscar audiências para o dashboard:", error);
          const container = document.getElementById('audiencias-widget-container');
          if(container) container.innerHTML = `<div class="widget-card"><h3>Próximas Audiências</h3><p class="empty-list-message">Ocorreu um erro ao carregar.</p></div>`;
      });

    // --- Widget de Análises Pendentes ---
    // Renderiza APENAS o widget de análises usando os dados do cache
    renderAnalisePendenteWidget(devedoresCache);
}

function renderProximasAudienciasWidget(audiencias) {
    const container = document.getElementById('audiencias-widget-container');
    if (!container) return;

    let contentHTML = '';
    if (audiencias.length === 0) {
        contentHTML = '<p class="empty-list-message">Nenhuma audiência futura agendada.</p>';
    } else {
        const hoje = new Date();
        const umaSemana = new Date();
        umaSemana.setDate(hoje.getDate() + 8); // Pega os próximos 8 dias

        audiencias.forEach(item => {
            const data = new Date(item.dataHora.seconds * 1000);
            const dataFormatada = data.toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' });
            
            // Verifica se a audiência é na próxima semana para dar destaque
            const isDestaque = data < umaSemana;

            contentHTML += `
                <div class="audiencia-item ${isDestaque ? 'destaque' : ''}">
                    <div class="audiencia-item-processo">${formatProcessoForDisplay(item.numeroProcesso)}</div>
                    <div class="audiencia-item-devedor">${item.razaoSocialDevedor}</div>
                    <div class="audiencia-item-detalhes">
                        <strong>Data:</strong> ${dataFormatada}<br>
                        <strong>Local:</strong> ${item.local || 'A definir'}
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
}

function renderAnalisePendenteWidget(devedores) {
    const container = document.getElementById('analises-widget-container');
    if (!container) return;

    // Filtra devedores que precisam de atenção
    const devedoresParaAnalise = devedores.map(devedor => {
        return {
            ...devedor,
            analise: getAnaliseStatus(devedor) // Reutiliza nossa função de status!
        };
    }).filter(d => d.analise.status === 'status-expired' || d.analise.status === 'status-warning');
    
    // Ordena por urgência: primeiro os vencidos, depois os com alerta
    devedoresParaAnalise.sort((a, b) => {
        if (a.analise.status === 'status-expired' && b.analise.status !== 'status-expired') return -1;
        if (a.analise.status !== 'status-expired' && b.analise.status === 'status-expired') return 1;
        return 0; // Mantém a ordem original entre os de mesmo status
    });


    let contentHTML = '';
    if (devedoresParaAnalise.length === 0) {
        contentHTML = '<p class="empty-list-message">Nenhuma análise pendente. Bom trabalho!</p>';
    } else {
        devedoresParaAnalise.forEach(item => {
            contentHTML += `
                <div class="analise-item" data-id="${item.id}">
                    <div class="analise-item-devedor">
                        <span class="status-dot ${item.analise.status}" style="margin-right: 10px;"></span>
                        ${item.razaoSocial}
                    </div>
                    <div class="analise-item-detalhes">
                        <strong>Status:</strong> ${item.analise.text}
                    </div>
                </div>
            `;
        });
    }

    // Cria o novo widget e o adiciona ao container
    const widgetHTML = `
        <div class="widget-card">
            <h3>Análises Pendentes</h3>
            ${contentHTML}
        </div>
    `;
    container.innerHTML = widgetHTML;

    // Adiciona um listener para que o item seja clicável
    container.querySelector('.widget-card')?.addEventListener('click', (event) => {
        const item = event.target.closest('.analise-item');
        if (item && item.dataset.id) {
            renderDevedorDetailPage(item.dataset.id);
        }
    });
}

// --- HANDLERS (CRUD) ---
function handleDevedorAction(event) { const target = event.target; if (target.classList.contains('action-btn')) { const devedorId = target.dataset.id; if (target.classList.contains('btn-delete')) handleDeleteDevedor(devedorId); else if (target.classList.contains('btn-edit')) handleEditDevedor(devedorId); } else { const row = target.closest('tr'); if (row && row.dataset.id) renderDevedorDetailPage(row.dataset.id); } }
function handleEditDevedor(devedorId) { db.collection("grandes_devedores").doc(devedorId).get().then(doc => { if (doc.exists) renderDevedorForm({ id: doc.id, ...doc.data() }); }); }
function handleDeleteDevedor(devedorId) { if (confirm("Tem certeza que deseja excluir este Grande Devedor?")) db.collection("grandes_devedores").doc(devedorId).delete().then(() => showToast("Devedor excluído com sucesso.")).catch(() => showToast("Ocorreu um erro ao excluir.", "error")); }
function handleProcessoAction(event) {
    event.preventDefault(); 
    const target = event.target;
    const row = target.closest('tr');
    if (!row) return;

    const processoId = row.dataset.id;

    if (target.closest('.view-processo-link')) {
        navigateTo('processoDetail', { id: processoId });
        return;
    }

    const button = target.closest('.action-btn');
    if (button) {
        event.stopPropagation();
        if (button.classList.contains('btn-delete')) {
            handleDeleteProcesso(processoId);
        } else if (button.classList.contains('btn-edit')) {
            handleEditProcesso(processoId);
        }
        return;
    }

    if (row.classList.contains('piloto-row')) {
        row.classList.toggle('expanded');
        document.querySelectorAll(`.apenso-row[data-piloto-ref="${row.dataset.id}"]`).forEach(apensoRow => {
            apensoRow.classList.toggle('visible');
        });
    }
}
function handleEditProcesso(processoId) { const processo = processosCache.find(p => p.id === processoId); if (processo) renderProcessoForm(processo.devedorId, processo); else showToast("Processo não encontrado.", "error"); }
function handleDeleteProcesso(processoId) { const processo = processosCache.find(p => p.id === processoId); if (confirm(`Tem certeza que deseja excluir o processo ${formatProcessoForDisplay(processo.numeroProcesso)}?`)) db.collection("processos").doc(processoId).delete().then(() => showToast("Processo excluído com sucesso.")).catch(() => showToast("Ocorreu um erro ao excluir.", "error")); }
async function handlePromoteToPiloto(processoId) {
    const processoAlvo = processosCache.find(p => p.id === processoId);
    if (!processoAlvo) {
        showToast("Processo alvo não encontrado no cache.", "error");
        return;
    }

    const confirmMessage = `Tem certeza que deseja promover o processo ${formatProcessoForDisplay(processoAlvo.numeroProcesso)} a novo Piloto? \n\nEsta ação reorganizará o grupo de processos ao qual ele pertence.`;

    if (!confirm(confirmMessage)) {
        return; // Usuário cancelou
    }

    const batch = db.batch(); // Inicia um Write Batch

    try {
        // 1. Promove o processo alvo a 'piloto'
        const processoAlvoRef = db.collection("processos").doc(processoAlvo.id);
        batch.update(processoAlvoRef, {
            tipoProcesso: 'piloto',
            processoPilotoId: null
        });

        // 2. Se o processo alvo era um 'apenso', reorganiza seu antigo grupo
        if (processoAlvo.tipoProcesso === 'apenso' && processoAlvo.processoPilotoId) {
            const antigoPilotoId = processoAlvo.processoPilotoId;
            
            // 2a. Rebaixa o antigo piloto para ser um apenso do novo piloto
            const antigoPilotoRef = db.collection("processos").doc(antigoPilotoId);
            batch.update(antigoPilotoRef, {
                tipoProcesso: 'apenso',
                processoPilotoId: processoAlvo.id // Vincula ao novo piloto
            });

            // 2b. Re-vincula todos os 'irmãos' (outros apensos do mesmo grupo) ao novo piloto
            const irmaosApensos = processosCache.filter(p => 
                p.processoPilotoId === antigoPilotoId && p.id !== processoAlvo.id
            );

            irmaosApensos.forEach(irmao => {
                const irmaoRef = db.collection("processos").doc(irmao.id);
                batch.update(irmaoRef, { processoPilotoId: processoAlvo.id });
            });
        }
        // Se for 'autonomo', não há grupo para reorganizar, então o trabalho termina no passo 1.

        // 3. Executa todas as operações em uma única transação
        await batch.commit();
        showToast("Processo promovido a Piloto com sucesso!", "success");
        
        // Atualiza a visualização para refletir as mudanças
        renderDevedorDetailPage(processoAlvo.devedorId);

    } catch (error) {
        console.error("Erro ao promover processo a piloto: ", error);
        showToast("Ocorreu um erro crítico durante a promoção. Os dados não foram alterados.", "error");
    }
}
function handleUnattachProcesso(processoId) {
    const processo = processosCache.find(p => p.id === processoId);
    if (!processo) {
        showToast("Processo não encontrado.", "error");
        return;
    }

    if (!confirm(`Tem certeza que deseja desapensar o processo ${formatProcessoForDisplay(processo.numeroProcesso)}? \n\nEle se tornará um processo Autônomo.`)) {
        return; // Usuário cancelou
    }

    db.collection("processos").doc(processoId).update({
        tipoProcesso: 'autonomo',
        processoPilotoId: firebase.firestore.FieldValue.delete()
    }).then(() => {
        showToast("Processo desapensado com sucesso!", "success");
        // Recarrega a página de detalhes do devedor para ver a lista atualizada
        renderDevedorDetailPage(processo.devedorId);
    }).catch(error => {
        console.error("Erro ao desapensar processo: ", error);
        showToast("Ocorreu um erro ao desapensar o processo.", "error");
    });
}

function renderValorUpdateModal(processoId) {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.innerHTML = `
        <div class="modal-content">
            <h3>Atualizar Valor da Dívida</h3>
            <div class="form-group">
                <label for="novo-valor">Novo Valor (R$)</label>
                <input type="number" id="novo-valor" placeholder="0.00" step="0.01" required>
            </div>
            <div class="form-group">
                <label for="data-calculo">Data do Cálculo (Obrigatório)</label>
                <input type="date" id="data-calculo" required>
            </div>
            <div id="error-message"></div>
            <div class="form-buttons">
                <button id="save-new-valor-btn" class="btn-primary">Salvar Atualização</button>
                <button id="cancel-valor-btn">Cancelar</button>
            </div>
        </div>
    `;

    document.body.appendChild(modalOverlay);

    const closeModal = () => document.body.removeChild(modalOverlay);
    document.getElementById('save-new-valor-btn').addEventListener('click', () => handleSaveValorUpdate(processoId));
    document.getElementById('cancel-valor-btn').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
}

async function handleSaveValorUpdate(processoId) {
    const novoValorInput = document.getElementById('novo-valor').value;
    const dataCalculoInput = document.getElementById('data-calculo').value;
    const errorMessage = document.getElementById('error-message');
    errorMessage.textContent = '';

    if (!novoValorInput || !dataCalculoInput) {
        errorMessage.textContent = 'Ambos os campos, Novo Valor e Data do Cálculo, são obrigatórios.';
        return;
    }
    const novoValor = parseFloat(novoValorInput);
    const dataCalculo = new Date(dataCalculoInput + "T00:00:00");

    const batch = db.batch();
    const processoRef = db.collection("processos").doc(processoId);
    const historicoRef = processoRef.collection("historicoValores").doc();

    const dataParaSalvar = firebase.firestore.Timestamp.fromDate(dataCalculo);

    // 1. Atualiza o valor no documento principal do processo
    batch.update(processoRef, {
        "valorAtual.valor": novoValor,
        "valorAtual.data": dataParaSalvar
    });

    // 2. Adiciona um novo registro na subcoleção de histórico
    batch.set(historicoRef, {
        valor: novoValor,
        data: dataParaSalvar,
        tipo: 'Atualização Manual'
    });

    try {
        await batch.commit();
        showToast("Valor da dívida atualizado com sucesso!");
        document.body.removeChild(document.querySelector('.modal-overlay'));
        
        renderProcessoDetailPage(processoId); 
    } catch (error) {
        console.error("Erro ao atualizar valor: ", error);
        errorMessage.textContent = "Ocorreu um erro ao salvar a atualização.";
    }
}

async function renderValorHistoryModal(processoId) {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.innerHTML = `
        <div class="modal-content modal-large">
            <h3>Histórico de Valores da Dívida</h3>
            <div id="history-list-container"><p>Carregando histórico...</p></div>
            <div class="form-buttons" style="justify-content: flex-end; margin-top: 20px;">
                <button id="close-history-modal" class="btn-secondary">Fechar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalOverlay);

    const closeModal = () => document.body.removeChild(modalOverlay);
    document.getElementById('close-history-modal').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

    // Busca os dados da subcoleção e renderiza a tabela
    try {
        const snapshot = await db.collection("processos").doc(processoId).collection("historicoValores").orderBy("data", "desc").get();
        const historyContainer = document.getElementById('history-list-container');
        
        if (snapshot.empty) {
            historyContainer.innerHTML = `<p class="empty-list-message">Nenhum histórico de valores encontrado.</p>`;
            return;
        }

        let tableHTML = `<table class="data-table"><thead><tr><th>Data</th><th>Valor</th><th>Tipo</th></tr></thead><tbody>`;
        snapshot.docs.forEach(doc => {
            const item = doc.data();
            const data = item.data ? new Date(item.data.seconds * 1000).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';
            tableHTML += `
                <tr>
                    <td>${data}</td>
                    <td>${formatCurrency(item.valor)}</td>
                    <td>${item.tipo}</td>
                </tr>
            `;
        });
        tableHTML += `</tbody></table>`;
        historyContainer.innerHTML = tableHTML;

    } catch (error) {
        console.error("Erro ao buscar histórico de valores: ", error);
        document.getElementById('history-list-container').innerHTML = `<p class="empty-list-message">Ocorreu um erro ao carregar o histórico.</p>`;
    }
}

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

// --- PÁGINA: MOTIVOS DE SUSPENSÃO ---
let motivosSuspensaoCache = [];

function renderMotivosPage() {
    pageTitle.textContent = 'Motivos de Suspensão';
    document.title = 'SASIF | Motivos de Suspensão';
    contentArea.innerHTML = `
        <div class="dashboard-actions">
            <button id="add-motivo-btn" class="btn-primary">Cadastrar Novo Motivo</button>
        </div>
        <h2>Lista de Motivos</h2>
        <div id="motivos-list-container"></div>
    `;
    document.getElementById('add-motivo-btn').addEventListener('click', () => renderMotivoForm());
    renderMotivosList(motivosSuspensaoCache);
}

function renderMotivosList(motivos) {
    const container = document.getElementById('motivos-list-container');
    if (!container) return;
    if (motivos.length === 0) {
        container.innerHTML = `<p class="empty-list-message">Nenhum motivo de suspensão cadastrado.</p>`;
        return;
    }
    let tableHTML = `<table class="data-table"><thead><tr><th>Descrição do Motivo</th><th class="actions-cell">Ações</th></tr></thead><tbody>`;
    motivos.forEach(motivo => {
        tableHTML += `
            <tr data-id="${motivo.id}">
                <td>${motivo.descricao}</td>
                <td class="actions-cell">
                    <button class="action-btn btn-edit" data-id="${motivo.id}">Editar</button>
                    <button class="action-btn btn-delete" data-id="${motivo.id}">Excluir</button>
                </td>
            </tr>`;
    });
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
    container.querySelector('tbody').addEventListener('click', handleMotivoAction);
}

function renderMotivoForm(motivo = null) {
    const isEditing = motivo !== null;
    const formTitle = isEditing ? 'Editar Motivo de Suspensão' : 'Cadastrar Novo Motivo';
    navigateTo(null); 
    pageTitle.textContent = formTitle;
    document.title = `SASIF | ${formTitle}`;
    
    const descricao = isEditing ? motivo.descricao : '';
    
    contentArea.innerHTML = `
        <div class="form-container">
            <div class="form-group">
                <label for="descricao">Descrição (Obrigatório)</label>
                <input type="text" id="descricao" value="${descricao}" required>
            </div>
            <div id="error-message"></div>
            <div class="form-buttons">
                <button id="save-motivo-btn" class="btn-primary">Salvar</button>
                <button id="cancel-btn">Cancelar</button>
            </div>
        </div>`;
    
    document.getElementById('save-motivo-btn').addEventListener('click', () => {
        isEditing ? handleUpdateMotivo(motivo.id) : handleSaveMotivo();
    });
    document.getElementById('cancel-btn').addEventListener('click', () => navigateTo('motivos'));
}

function handleMotivoAction(event) {
    const target = event.target;
    const motivoId = target.dataset.id;
    if (!motivoId) return;

    if (target.classList.contains('btn-delete')) {
        handleDeleteMotivo(motivoId);
    } else if (target.classList.contains('btn-edit')) {
        const motivo = motivosSuspensaoCache.find(m => m.id === motivoId);
        if(motivo) renderMotivoForm(motivo);
    }
}

function handleSaveMotivo() {
    const descricao = document.getElementById('descricao').value;
    if (!descricao) {
        document.getElementById('error-message').textContent = 'A descrição é obrigatória.';
        return;
    }
    const data = { descricao, criadoEm: firebase.firestore.FieldValue.serverTimestamp() };
    db.collection("motivos_suspensao").add(data).then(() => {
        navigateTo('motivos');
        setTimeout(() => showToast("Motivo salvo com sucesso!"), 100);
    });
}

function handleUpdateMotivo(motivoId) {
    const descricao = document.getElementById('descricao').value;
    if (!descricao) {
        document.getElementById('error-message').textContent = 'A descrição é obrigatória.';
        return;
    }
    const data = { descricao, atualizadoEm: firebase.firestore.FieldValue.serverTimestamp() };
    db.collection("motivos_suspensao").doc(motivoId).update(data).then(() => {
        navigateTo('motivos');
        setTimeout(() => showToast("Motivo atualizado com sucesso!"), 100);
    });
}

function handleDeleteMotivo(motivoId) {
    if (confirm("Tem certeza que deseja excluir este Motivo? Processos que o utilizam não serão afetados, mas o motivo não aparecerá mais na lista.")) {
        db.collection("motivos_suspensao").doc(motivoId).delete()
            .then(() => showToast("Motivo excluído com sucesso."))
            .catch(() => showToast("Ocorreu um erro ao excluir.", "error"));
    }
}

// --- FORMULÁRIOS E HANDLERS: PROCESSOS ---
function renderProcessoForm(devedorId, processo = null) {
    const isEditing = processo !== null;
    pageTitle.textContent = isEditing ? 'Editar Processo' : 'Novo Processo';
    document.title = `SASIF | ${pageTitle.textContent}`;
    
    // Prepara as opções para os seletores
    const pilotosDoDevedor = processosCache.filter(p => p.tipoProcesso === 'piloto' && p.id !== (processo ? processo.id : null));
    const pilotoOptions = pilotosDoDevedor.map(p => `<option value="${p.id}" ${isEditing && processo.processoPilotoId === p.id ? 'selected' : ''}>${formatProcessoForDisplay(p.numeroProcesso)}</option>`).join('');
    const exequenteOptions = exequentesCache.map(ex => `<option value="${ex.id}" ${isEditing && processo.exequenteId === ex.id ? 'selected' : ''}>${ex.nome}</option>`).join('');
    const motivosOptions = motivosSuspensaoCache.map(m => `<option value="${m.id}" ${isEditing && processo.motivoSuspensaoId === m.id ? 'selected' : ''}>${m.descricao}</option>`).join('');

    contentArea.innerHTML = `
        <div class="form-container">
            <div class="form-group">
                <label for="numero-processo">Número do Processo (Obrigatório)</label>
                <input type="text" id="numero-processo" required oninput="maskProcesso(this)" value="${isEditing ? formatProcessoForDisplay(processo.numeroProcesso) : ''}">
            </div>
            <div class="form-group">
                <label for="exequente">Exequente (Obrigatório)</label>
                <select id="exequente"><option value="">Selecione...</option>${exequenteOptions}</select>
            </div>
            <div class="form-group">
                <label for="tipo-processo">Tipo</label>
                <select id="tipo-processo">
                    <option value="autonomo">Autônomo</option>
                    <option value="piloto">Piloto</option>
                    <option value="apenso">Apenso</option>
                </select>
            </div>
            <div id="piloto-select-container"></div>
            
            <hr style="margin: 20px 0;">

            <div class="form-group">
                <label for="status-processo">Status</label>
                <select id="status-processo">
                    <option value="Ativo">Ativo</option>
                    <option value="Suspenso">Suspenso</option>
                    <option value="Baixado">Baixado</option>
                    <option value="Extinto">Extinto</option>
                </select>
            </div>
            <div id="motivo-suspensao-container" class="hidden">
                <div class="form-group">
                    <label for="motivo-suspensao">Motivo da Suspensão</label>
                    <select id="motivo-suspensao">
                        <option value="">Selecione o motivo...</option>
                        ${motivosOptions}
                    </select>
                </div>
            </div>

            <hr style="margin: 20px 0;">

            <div class="form-group">
                <label for="valor-divida">Valor da Dívida</label>
                <input type="number" id="valor-divida" placeholder="0.00" step="0.01" value="${isEditing ? processo.valorDivida : ''}">
            </div>
            <div class="form-group">
                <label for="cdas">CDA(s)</label>
                <textarea id="cdas" rows="3">${isEditing ? (processo.cdas || '') : ''}</textarea>
            </div>

            <div id="error-message"></div>
            <div class="form-buttons">
                <button id="save-processo-btn" class="btn-primary">Salvar</button>
                <button id="cancel-btn">Cancelar</button>
            </div>
        </div>`;
    
    // Popula os valores iniciais dos seletores
    if (isEditing) {
        document.getElementById('tipo-processo').value = processo.tipoProcesso;
        document.getElementById('exequente').value = processo.exequenteId;
        document.getElementById('status-processo').value = processo.status || 'Ativo';
    }
    
    // Lógica para mostrar/esconder o seletor de motivo
    const statusSelect = document.getElementById('status-processo');
    const motivoContainer = document.getElementById('motivo-suspensao-container');

    const toggleMotivoSelect = () => {
        if (statusSelect.value === 'Suspenso') {
            motivoContainer.classList.remove('hidden');
        } else {
            motivoContainer.classList.add('hidden');
        }
    };

    toggleMotivoSelect(); // Verifica o estado inicial
    statusSelect.addEventListener('change', toggleMotivoSelect);

    // Lógica para o seletor de piloto (já existente)
    const tipoProcessoSelect = document.getElementById('tipo-processo');
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
    
    // Listeners dos botões
    document.getElementById('save-processo-btn').addEventListener('click', () => handleSaveProcesso(devedorId, processo ? processo.id : null));
    document.getElementById('cancel-btn').addEventListener('click', () => renderDevedorDetailPage(devedorId));
}

// Substitua a função inteira
async function handleSaveProcesso(devedorId, processoId = null) {
    const numeroProcesso = document.getElementById('numero-processo').value;
    const exequenteId = document.getElementById('exequente').value;
    const tipoProcesso = document.getElementById('tipo-processo').value;
    const status = document.getElementById('status-processo').value;
    const motivoSuspensaoId = document.getElementById('motivo-suspensao')?.value;
    const valorInput = parseFloat(document.getElementById('valor-divida').value) || 0;
    const errorMessage = document.getElementById('error-message');
    errorMessage.textContent = '';
    
    if (!numeroProcesso || !exequenteId) { 
        errorMessage.textContent = 'Número do Processo e Exequente são obrigatórios.';
        return; 
    }
    
    const processoData = {
        devedorId,
        numeroProcesso: numeroProcesso.replace(/\D/g, ''),
        exequenteId,
        tipoProcesso,
        status,
        motivoSuspensaoId: status === 'Suspenso' ? motivoSuspensaoId : null,
        cdas: document.getElementById('cdas').value,
        uidUsuario: auth.currentUser.uid,
        // Nova estrutura para o valor
        valorAtual: {
            valor: valorInput,
            data: firebase.firestore.FieldValue.serverTimestamp()
        }
    };
    
    // Removendo o campo antigo para manter a consistência
    delete processoData.valorDivida;
    
    if (tipoProcesso === 'apenso') {
        const processoPilotoId = document.getElementById('processo-piloto')?.value;
        if (!processoPilotoId) {
            errorMessage.textContent = 'Para apensos, é obrigatório selecionar um processo piloto.';
            return;
        }
        processoData.processoPilotoId = processoPilotoId;
    } else {
        processoData.processoPilotoId = null; 
    }
    
    const batch = db.batch();
    
    try {
        if (processoId) {
            // Editando um processo existente
            const processoRef = db.collection("processos").doc(processoId);
            processoData.atualizadoEm = firebase.firestore.FieldValue.serverTimestamp();
            batch.update(processoRef, processoData);

            // Ao editar, podemos considerar se o valor foi alterado e adicionar ao histórico.
            // Por simplicidade agora, vamos apenas atualizar. A lógica de histórico na edição pode vir depois.
        } else {
            // Criando um novo processo
            const processoRef = db.collection("processos").doc(); // Gera um novo ID
            processoData.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
            batch.set(processoRef, processoData);

            // Adiciona a primeira entrada no histórico
            const historicoRef = processoRef.collection("historicoValores").doc();
            batch.set(historicoRef, {
                valor: valorInput,
                data: firebase.firestore.FieldValue.serverTimestamp(),
                tipo: 'Valor de Causa'
            });
        }
        
        await batch.commit();
        
        renderDevedorDetailPage(devedorId);
        setTimeout(() => showToast(`Processo ${processoId ? 'atualizado' : 'salvo'} com sucesso!`), 100);

    } catch (err) {
        console.error("Erro ao salvar processo: ", err);
        errorMessage.textContent = 'Ocorreu um erro ao salvar.';
    }
}

// --- AUTENTICAÇÃO E INICIALIZAÇÃO ---
function renderLoginForm() { document.title = 'SASIF | Login'; loginContainer.innerHTML = `<h1>SASIF</h1><p>Acesso ao Sistema de Acompanhamento</p><div class="form-group"><label for="email">E-mail</label><input type="email" id="email" required></div><div class="form-group"><label for="password">Senha</label><input type="password" id="password" required></div><div id="error-message"></div><div class="form-buttons"><button id="login-btn">Entrar</button><button id="signup-btn">Cadastrar</button></div>`; document.getElementById('login-btn').addEventListener('click', handleLogin); document.getElementById('signup-btn').addEventListener('click', handleSignUp); }
function handleLogin() { const email = document.getElementById('email').value; const password = document.getElementById('password').value; const errorMessage = document.getElementById('error-message'); if (!email || !password) { errorMessage.textContent = 'Por favor, preencha e-mail e senha.'; return; } auth.signInWithEmailAndPassword(email, password).catch(error => { errorMessage.textContent = 'E-mail ou senha incorretos.'; }); }
function handleSignUp() { const email = document.getElementById('email').value; const password = document.getElementById('password').value; const errorMessage = document.getElementById('error-message'); if (!email || !password) { errorMessage.textContent = 'Por favor, preencha e-mail e senha.'; return; } auth.createUserWithEmailAndPassword(email, password).catch(error => { if (error.code === 'auth/weak-password') errorMessage.textContent = 'A senha deve ter no mínimo 6 caracteres.'; else if (error.code === 'auth/email-already-in-use') errorMessage.textContent = 'Este e-mail já está em uso.'; else errorMessage.textContent = 'Ocorreu um erro ao tentar cadastrar.'; }); }
function setupListeners() {
db.collection("grandes_devedores").orderBy("nivelPrioridade").orderBy("razaoSocial").onSnapshot((snapshot) => {
    devedoresCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Se a página de Grandes Devedores estiver aberta, atualiza a lista
    if (document.title.includes('Grandes Devedores')) {
        renderDevedoresList(devedoresCache);
    }
    
    // Se a página do Dashboard estiver aberta, chama a função que monta TODOS os widgets
    if (document.title.includes('Dashboard')) {
        setupDashboardWidgets();
    }
});
db.collection("exequentes").orderBy("nome").onSnapshot((snapshot) => { exequentesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); if (document.title.includes('Exequentes')) renderExequentesList(exequentesCache); }); db.collection("motivos_suspensao").orderBy("descricao").onSnapshot((snapshot) => {
        motivosSuspensaoCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if(document.title.includes('Motivos de Suspensão')) renderMotivosList(motivosSuspensaoCache);
    });
}
function setupProcessosListener(devedorId) { if (processosListenerUnsubscribe) processosListenerUnsubscribe(); processosListenerUnsubscribe = db.collection("processos").where("devedorId", "==", devedorId).onSnapshot((snapshot) => { processosCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); renderProcessosList(processosCache); }, error => { console.error("Erro ao buscar processos: ", error); if (error.code === 'failed-precondition' && document.getElementById('processos-list-container')) document.getElementById('processos-list-container').innerHTML = `<p class="empty-list-message">Erro: O índice necessário para esta consulta não existe. Verifique o console.</p>`; }); }
function initApp(user) {
    userEmailSpan.textContent = user.email;
    logoutButton.addEventListener('click', () => { auth.signOut(); });
    
    // Primeiro, navega para o dashboard para garantir que a estrutura HTML exista.
    navigateTo('dashboard');
    
    // Depois, inicia os listeners que irão popular a tela.
    setupListeners();
}
document.addEventListener('DOMContentLoaded', () => { auth.onAuthStateChanged(user => { if (user) { appContainer.classList.remove('hidden'); loginContainer.classList.add('hidden'); initApp(user); } else { appContainer.classList.add('hidden'); loginContainer.classList.remove('hidden'); renderLoginForm(); } }); });