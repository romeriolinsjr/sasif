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

// Variável para guardar a lista de devedores em memória (nosso cache)
let devedoresCache = [];

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

// --- FUNÇÕES DE RENDERIZAÇÃO DE CONTEÚDO ---

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
    
    // Agora, sempre que o dashboard for renderizado, ele usa o cache para redesenhar a lista
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
    pageTitle.textContent = formTitle;
    document.title = `SASIF | ${formTitle}`;
    const razaoSocial = isEditing ? devedor.razaoSocial : '';
    const cnpj = isEditing ? formatCNPJForDisplay(devedor.cnpj) : '';
    const nomeFantasia = isEditing ? devedor.nomeFantasia : '';
    const nivelPrioridade = isEditing ? devedor.nivelPrioridade : '1';
    const observacoes = isEditing ? devedor.observacoes : '';
    const devedorId = isEditing ? devedor.id : '';
    contentArea.innerHTML = `<div class="form-container" data-id="${devedorId}"><div class="form-group"><label for="razao-social">Razão Social (Obrigatório)</label><input type="text" id="razao-social" value="${razaoSocial}" required></div><div class="form-group"><label for="cnpj">CNPJ (Obrigatório)</label><input type="text" id="cnpj" value="${cnpj}" required oninput="maskCNPJ(this)"></div><div class="form-group"><label for="nome-fantasia">Nome Fantasia</label><input type="text" id="nome-fantasia" value="${nomeFantasia}"></div><div class="form-group"><label for="nivel-prioridade">Nível de Prioridade</label><select id="nivel-prioridade"><option value="1">Nível 1 (Análise a cada 30 dias)</option><option value="2">Nível 2 (Análise a cada 45 dias)</option><option value="3">Nível 3 (Análise a cada 60 dias)</option></select></div><div class="form-group"><label for="observacoes">Observações</label><textarea id="observacoes">${observacoes}</textarea></div><div id="error-message"></div><div class="form-buttons"><button id="save-devedor-btn" class="btn-primary">Salvar</button><button id="cancel-btn">Cancelar</button></div></div>`;
    document.getElementById('nivel-prioridade').value = nivelPrioridade;
    document.getElementById('save-devedor-btn').addEventListener('click', () => { isEditing ? handleUpdateDevedor(devedorId) : handleSaveDevedor(); });
    document.getElementById('cancel-btn').addEventListener('click', renderDashboard);
}

// --- FUNÇÕES DE LÓGICA (HANDLERS) ---

function handleDevedorAction(event) {
    const target = event.target;
    const devedorId = target.dataset.id;
    if (!devedorId) return;
    if (target.classList.contains('btn-delete')) {
        handleDeleteDevedor(devedorId);
    } else if (target.classList.contains('btn-edit')) {
        handleEditDevedor(devedorId);
    }
}

function handleDeleteDevedor(devedorId) {
    if (confirm("Tem certeza que deseja excluir este Grande Devedor? Esta ação não pode ser desfeita.")) {
        db.collection("grandes_devedores").doc(devedorId).delete()
            .then(() => showToast("Devedor excluído com sucesso."))
            .catch(error => {
                console.error("Erro ao excluir devedor: ", error);
                showToast("Ocorreu um erro ao excluir o devedor.", "error");
            });
    }
}

function handleEditDevedor(devedorId) {
    db.collection("grandes_devedores").doc(devedorId).get()
        .then(doc => {
            if (doc.exists) {
                renderDevedorForm({ id: doc.id, ...doc.data() });
            } else {
                showToast("Devedor não encontrado. Pode ter sido excluído.", "error");
                renderDashboard();
            }
        }).catch(error => {
            console.error("Erro ao buscar devedor para edição: ", error);
            showToast("Erro ao buscar dados do devedor.", "error");
        });
}

function getDevedorDataFromForm() {
    const razaoSocial = document.getElementById('razao-social').value;
    const cnpj = document.getElementById('cnpj').value;
    const errorMessage = document.getElementById('error-message');
    errorMessage.textContent = '';
    if (!razaoSocial || !cnpj) {
        errorMessage.textContent = 'Razão Social e CNPJ são obrigatórios.';
        return null;
    }
    if (cnpj.replace(/\D/g, '').length !== 14) {
        errorMessage.textContent = 'Por favor, preencha um CNPJ válido com 14 dígitos.';
        return null;
    }
    return {
        razaoSocial: razaoSocial,
        cnpj: cnpj.replace(/\D/g, ''),
        nomeFantasia: document.getElementById('nome-fantasia').value,
        nivelPrioridade: parseInt(document.getElementById('nivel-prioridade').value),
        observacoes: document.getElementById('observacoes').value,
    };
}

function handleSaveDevedor() {
    const devedorData = getDevedorDataFromForm();
    if (!devedorData) return;
    devedorData.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
    devedorData.uidUsuario = auth.currentUser.uid;
    db.collection("grandes_devedores").add(devedorData)
        .then(() => {
            renderDashboard();
            setTimeout(() => showToast("Grande Devedor salvo com sucesso!"), 100);
        })
        .catch(error => {
            console.error("Erro ao salvar devedor: ", error);
            document.getElementById('error-message').textContent = "Erro ao salvar. Tente novamente.";
        });
}

function handleUpdateDevedor(devedorId) {
    const devedorData = getDevedorDataFromForm();
    if (!devedorData) return;
    devedorData.atualizadoEm = firebase.firestore.FieldValue.serverTimestamp();
    db.collection("grandes_devedores").doc(devedorId).update(devedorData)
        .then(() => {
            renderDashboard();
            setTimeout(() => showToast("Devedor atualizado com sucesso!"), 100);
        })
        .catch(error => {
            console.error("Erro ao atualizar devedor: ", error);
            document.getElementById('error-message').textContent = "Erro ao atualizar. Tente novamente.";
        });
}

// --- FUNÇÕES DE AUTENTICAÇÃO ---

function renderLoginForm() {
    document.title = 'SASIF | Login';
    loginContainer.innerHTML = `<h1>SASIF</h1><p>Acesso ao Sistema de Acompanhamento</p><div class="form-group"><label for="email">E-mail</label><input type="email" id="email" required></div><div class="form-group"><label for="password">Senha</label><input type="password" id="password" required></div><div id="error-message"></div><div class="form-buttons"><button id="login-btn">Entrar</button><button id="signup-btn">Cadastrar</button></div>`;
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('signup-btn').addEventListener('click', handleSignUp);
}

function handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');
    if (!email || !password) {
        errorMessage.textContent = 'Por favor, preencha e-mail e senha.';
        return;
    }
    auth.signInWithEmailAndPassword(email, password).catch(error => {
        errorMessage.textContent = 'E-mail ou senha incorretos.';
    });
}

function handleSignUp() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');
    if (!email || !password) {
        errorMessage.textContent = 'Por favor, preencha e-mail e senha.';
        return;
    }
    auth.createUserWithEmailAndPassword(email, password).catch(error => {
        if (error.code === 'auth/weak-password') {
            errorMessage.textContent = 'A senha deve ter no mínimo 6 caracteres.';
        } else if (error.code === 'auth/email-already-in-use') {
            errorMessage.textContent = 'Este e-mail já está em uso.';
        } else {
            errorMessage.textContent = 'Ocorreu um erro ao tentar cadastrar.';
        }
    });
}

// --- PONTO DE ENTRADA E INICIALIZAÇÃO ---

function setupDevedoresListener() {
    db.collection("grandes_devedores").orderBy("nivelPrioridade").orderBy("razaoSocial")
      .onSnapshot((snapshot) => {
        const devedores = [];
        snapshot.forEach((doc) => {
            devedores.push({ id: doc.id, ...doc.data() });
        });
        
        devedoresCache = devedores; // Atualiza nosso cache com os dados mais recentes

        if (pageTitle.textContent === 'Dashboard') {
            renderDevedoresList(devedores);
        }
      }, (error) => {
        console.error("Erro ao buscar devedores: ", error);
        if (document.getElementById('devedores-list-container')) {
             document.getElementById('devedores-list-container').innerHTML = `<p class="empty-list-message">Erro ao carregar a lista. Verifique o console para criar o índice necessário no Firebase.</p>`;
        }
      });
}

function initApp(user) {
    userEmailSpan.textContent = user.email;
    logoutButton.addEventListener('click', () => { auth.signOut(); });
    
    // Inicia o listener primeiro para que os dados já estejam disponíveis
    setupDevedoresListener();
    // Renderiza o dashboard inicial
    renderDashboard();
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
            renderLoginForm();
        }
    });
});