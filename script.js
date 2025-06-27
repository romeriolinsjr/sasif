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

// --- NAVEGAÇÃO E RENDERIZAÇÃO DE PÁGINAS ---

function renderSidebar(activePage) {
    const pages = [
        { id: 'dashboard', name: 'Dashboard' },
        { id: 'exequentes', name: 'Exequentes' }
    ];
    mainNav.innerHTML = `
        <ul>
            ${pages.map(page => `
                <li>
                    <a href="#" class="nav-link ${page.id === activePage ? 'active' : ''}" data-page="${page.id}">
                        ${page.name}
                    </a>
                </li>
            `).join('')}
        </ul>
    `;
    mainNav.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(e.target.dataset.page);
        });
    });
}

function navigateTo(page) {
    renderSidebar(page);
    switch (page) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'exequentes':
            renderExequentesPage();
            break;
        default:
            renderDashboard();
    }
}

// --- PÁGINA: DASHBOARD / GRANDES DEVEDORES ---

function renderDashboard() {
    pageTitle.textContent = 'Dashboard';
    document.title = 'SASIF | Dashboard';
    contentArea.innerHTML = `
        <div class="dashboard-actions">
            <button id="add-devedor-btn" class="btn-primary">Cadastrar Novo Devedor</button>
        </div>
        <h2>Lista de Grandes Devedores</h2>
        <div id="devedores-list-container"></div>
    `;
    document.getElementById('add-devedor-btn').addEventListener('click', () => renderDevedorForm());
    renderDevedoresList(devedoresCache);
}

function renderDevedoresList(devedores) {
    const container = document.getElementById('devedores-list-container');
    if (!container) return;
    if (devedores.length === 0) {
        container.innerHTML = `<p class="empty-list-message">Nenhum grande devedor cadastrado ainda.</p>`;
        return;
    }
    let tableHTML = `<table class="data-table"><thead><tr><th class="number-cell">#</th><th>Razão Social</th><th>CNPJ</th><th>Prioridade</th><th class="actions-cell">Ações</th></tr></thead><tbody>`;
    devedores.forEach((devedor, index) => {
        tableHTML += `<tr data-id="${devedor.id}"><td class="number-cell">${index + 1}</td><td>${devedor.razaoSocial}</td><td>${formatCNPJForDisplay(devedor.cnpj)}</td><td class="level-${devedor.nivelPrioridade}">Nível ${devedor.nivelPrioridade}</td><td class="actions-cell"><button class="action-btn btn-edit" data-id="${devedor.id}">Editar</button><button class="action-btn btn-delete" data-id="${devedor.id}">Excluir</button></td></tr>`;
    });
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
    container.querySelector('tbody').addEventListener('click', handleDevedorAction);
}

function renderDevedorForm(devedor = null) {
    const isEditing = devedor !== null;
    const formTitle = isEditing ? 'Editar Grande Devedor' : 'Cadastrar Novo Grande Devedor';
    navigateTo(null); // Remove a classe 'active' de todos os links do menu
    pageTitle.textContent = formTitle;
    document.title = `SASIF | ${formTitle}`;
    const razaoSocial = isEditing ? devedor.razaoSocial : '';
    const cnpj = isEditing ? formatCNPJForDisplay(devedor.cnpj) : '';
    const nomeFantasia = isEditing ? devedor.nomeFantasia : '';
    const nivelPrioridade = isEditing ? devedor.nivelPrioridade : '1';
    const observacoes = isEditing ? devedor.observacoes : '';
    contentArea.innerHTML = `<div class="form-container" data-id="${isEditing ? devedor.id : ''}"><div class="form-group"><label for="razao-social">Razão Social (Obrigatório)</label><input type="text" id="razao-social" value="${razaoSocial}" required></div><div class="form-group"><label for="cnpj">CNPJ (Obrigatório)</label><input type="text" id="cnpj" value="${cnpj}" required oninput="maskCNPJ(this)"></div><div class="form-group"><label for="nome-fantasia">Nome Fantasia</label><input type="text" id="nome-fantasia" value="${nomeFantasia}"></div><div class="form-group"><label for="nivel-prioridade">Nível de Prioridade</label><select id="nivel-prioridade"><option value="1">Nível 1 (30 dias)</option><option value="2">Nível 2 (45 dias)</option><option value="3">Nível 3 (60 dias)</option></select></div><div class="form-group"><label for="observacoes">Observações</label><textarea id="observacoes">${observacoes}</textarea></div><div id="error-message"></div><div class="form-buttons"><button id="save-devedor-btn" class="btn-primary">Salvar</button><button id="cancel-btn">Cancelar</button></div></div>`;
    document.getElementById('nivel-prioridade').value = nivelPrioridade;
    document.getElementById('save-devedor-btn').addEventListener('click', () => { isEditing ? handleUpdateDevedor(devedor.id) : handleSaveDevedor(); });
    document.getElementById('cancel-btn').addEventListener('click', () => navigateTo('dashboard'));
}

function handleDevedorAction(event) {
    const target = event.target;
    const devedorId = target.dataset.id;
    if (!devedorId) return;
    if (target.classList.contains('btn-delete')) {
        handleDeleteDevedor(devedorId);
    } else if (target.classList.contains('btn-edit')) {
        db.collection("grandes_devedores").doc(devedorId).get().then(doc => {
            if (doc.exists) renderDevedorForm({ id: doc.id, ...doc.data() });
        });
    }
}

function handleSaveDevedor() { /* ...código existente sem alterações... */ }
function handleUpdateDevedor(devedorId) { /* ...código existente sem alterações... */ }
function handleDeleteDevedor(devedorId) { /* ...código existente sem alterações... */ }
function getDevedorDataFromForm() { /* ...código existente sem alterações... */ }

// --- PÁGINA: EXEQUENTES ---

function renderExequentesPage() {
    pageTitle.textContent = 'Exequentes';
    document.title = 'SASIF | Exequentes';
    contentArea.innerHTML = `
        <div class="dashboard-actions">
            <button id="add-exequente-btn" class="btn-primary">Cadastrar Novo Exequente</button>
        </div>
        <h2>Lista de Exequentes</h2>
        <div id="exequentes-list-container"></div>
    `;
    document.getElementById('add-exequente-btn').addEventListener('click', () => renderExequenteForm());
    renderExequentesList(exequentesCache);
}

function renderExequentesList(exequentes) {
    const container = document.getElementById('exequentes-list-container');
    if (!container) return;
    if (exequentes.length === 0) {
        container.innerHTML = `<p class="empty-list-message">Nenhum exequente cadastrado ainda.</p>`;
        return;
    }
    let tableHTML = `<table class="data-table"><thead><tr><th class="number-cell">#</th><th>Nome</th><th>CNPJ</th><th class="actions-cell">Ações</th></tr></thead><tbody>`;
    exequentes.forEach((exequente, index) => {
        tableHTML += `<tr data-id="${exequente.id}"><td class="number-cell">${index + 1}</td><td>${exequente.nome}</td><td>${formatCNPJForDisplay(exequente.cnpj)}</td><td class="actions-cell"><button class="action-btn btn-edit" data-id="${exequente.id}">Editar</button><button class="action-btn btn-delete" data-id="${exequente.id}">Excluir</button></td></tr>`;
    });
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
    container.querySelector('tbody').addEventListener('click', handleExequenteAction);
}

function renderExequenteForm(exequente = null) {
    const isEditing = exequente !== null;
    const formTitle = isEditing ? 'Editar Exequente' : 'Cadastrar Novo Exequente';
    navigateTo(null); // Desmarca item do menu
    pageTitle.textContent = formTitle;
    document.title = `SASIF | ${formTitle}`;
    const nome = isEditing ? exequente.nome : '';
    const cnpj = isEditing ? formatCNPJForDisplay(exequente.cnpj) : '';
    contentArea.innerHTML = `<div class="form-container"><div class="form-group"><label for="nome">Nome (Obrigatório)</label><input type="text" id="nome" value="${nome}" required></div><div class="form-group"><label for="cnpj">CNPJ</label><input type="text" id="cnpj" value="${cnpj}" oninput="maskCNPJ(this)"></div><div id="error-message"></div><div class="form-buttons"><button id="save-exequente-btn" class="btn-primary">Salvar</button><button id="cancel-btn">Cancelar</button></div></div>`;
    document.getElementById('save-exequente-btn').addEventListener('click', () => { isEditing ? handleUpdateExequente(exequente.id) : handleSaveExequente(); });
    document.getElementById('cancel-btn').addEventListener('click', () => navigateTo('exequentes'));
}

function handleExequenteAction(event) {
    const target = event.target;
    const exequenteId = target.dataset.id;
    if (!exequenteId) return;
    if (target.classList.contains('btn-delete')) {
        handleDeleteExequente(exequenteId);
    } else if (target.classList.contains('btn-edit')) {
        db.collection("exequentes").doc(exequenteId).get().then(doc => {
            if (doc.exists) renderExequenteForm({ id: doc.id, ...doc.data() });
        });
    }
}

function handleSaveExequente() {
    const nome = document.getElementById('nome').value;
    const cnpjInput = document.getElementById('cnpj').value;
    if (!nome) {
        document.getElementById('error-message').textContent = 'O nome do exequente é obrigatório.';
        return;
    }
    const data = {
        nome: nome,
        cnpj: cnpjInput.replace(/\D/g, ''),
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    };
    db.collection("exequentes").add(data).then(() => {
        navigateTo('exequentes');
        showToast("Exequente salvo com sucesso!");
    });
}

function handleUpdateExequente(exequenteId) {
    const nome = document.getElementById('nome').value;
    const cnpjInput = document.getElementById('cnpj').value;
    if (!nome) {
        document.getElementById('error-message').textContent = 'O nome do exequente é obrigatório.';
        return;
    }
    const data = {
        nome: nome,
        cnpj: cnpjInput.replace(/\D/g, ''),
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    };
    db.collection("exequentes").doc(exequenteId).update(data).then(() => {
        navigateTo('exequentes');
        showToast("Exequente atualizado com sucesso!");
    });
}

function handleDeleteExequente(exequenteId) {
    if (confirm("Tem certeza que deseja excluir este Exequente?")) {
        db.collection("exequentes").doc(exequenteId).delete()
            .then(() => showToast("Exequente excluído com sucesso."))
            .catch(() => showToast("Ocorreu um erro ao excluir.", "error"));
    }
}


// --- FUNÇÕES DE AUTENTICAÇÃO E INICIALIZAÇÃO ---

// As funções de autenticação (renderLoginForm, handleLogin, etc.) continuam aqui, inalteradas

function setupListeners() {
    db.collection("grandes_devedores").orderBy("nivelPrioridade").orderBy("razaoSocial")
      .onSnapshot((snapshot) => {
        devedoresCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (pageTitle.textContent === 'Dashboard') {
            renderDevedoresList(devedoresCache);
        }
      });
    
    db.collection("exequentes").orderBy("nome")
      .onSnapshot((snapshot) => {
        exequentesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (pageTitle.textContent === 'Exequentes') {
            renderExequentesList(exequentesCache);
        }
      });
}

function initApp(user) {
    userEmailSpan.textContent = user.email;
    logoutButton.addEventListener('click', () => { auth.signOut(); });
    setupListeners();
    navigateTo('dashboard'); // A página inicial agora é controlada aqui
}

document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (user) {
            appContainer.classList.remove('hidden');
            loginContainer.classList.add('hidden');
            initApp(user);
        } else {
            appContainer.classList.add('hidden');
            loginContainer.classList.remove('hidden');
            renderLoginForm(); // As funções de login estão omitidas aqui para economizar espaço
        }
    });
});

// Cole as funções de login/signup aqui para completar