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

// --- FUNÇÕES DE UTILIDADE ---

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
    document.getElementById('page-title').textContent = 'Dashboard';
    contentArea.innerHTML = `
        <div class="dashboard-actions">
            <button id="add-devedor-btn" class="btn-primary">Cadastrar Novo Devedor</button>
        </div>
        <h2>Lista de Grandes Devedores</h2>
        <div id="devedores-list-container">
            <!-- A lista de devedores aparecerá aqui -->
        </div>
    `;

    document.getElementById('add-devedor-btn').addEventListener('click', renderNovoDevedorForm);
}

function renderDevedoresList(devedores) {
    const container = document.getElementById('devedores-list-container');
    if (!container) return; // Se o container não estiver na tela, não faz nada

    if (devedores.length === 0) {
        container.innerHTML = `<p class="empty-list-message">Nenhum grande devedor cadastrado ainda.</p>`;
        return;
    }

    let tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Razão Social</th>
                    <th>CNPJ</th>
                    <th>Prioridade</th>
                </tr>
            </thead>
            <tbody>
    `;

    devedores.forEach(devedor => {
        tableHTML += `
            <tr>
                <td>${devedor.razaoSocial}</td>
                <td>${formatCNPJForDisplay(devedor.cnpj)}</td>
                <td class="level-${devedor.nivelPrioridade}">Nível ${devedor.nivelPrioridade}</td>
            </tr>
        `;
    });

    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}

function renderNovoDevedorForm() {
    document.getElementById('page-title').textContent = 'Novo Devedor';
    contentArea.innerHTML = `
        <div class="form-container">
            <div class="form-group">
                <label for="razao-social">Razão Social (Obrigatório)</label>
                <input type="text" id="razao-social" required>
            </div>
            <div class="form-group">
                <label for="cnpj">CNPJ (Obrigatório)</label>
                <input type="text" id="cnpj" required oninput="maskCNPJ(this)">
            </div>
            <div class="form-group">
                <label for="nome-fantasia">Nome Fantasia</label>
                <input type="text" id="nome-fantasia">
            </div>
            <div class="form-group">
                <label for="nivel-prioridade">Nível de Prioridade</label>
                <select id="nivel-prioridade">
                    <option value="1">Nível 1 (Análise a cada 30 dias)</option>
                    <option value="2">Nível 2 (Análise a cada 45 dias)</option>
                    <option value="3">Nível 3 (Análise a cada 60 dias)</option>
                </select>
            </div>
             <div class="form-group">
                <label for="observacoes">Observações</label>
                <textarea id="observacoes"></textarea>
            </div>
            <div id="error-message"></div>
            <div class="form-buttons">
                <button id="save-devedor-btn" class="btn-primary">Salvar</button>
                <button id="cancel-btn">Cancelar</button>
            </div>
        </div>
    `;

    document.getElementById('save-devedor-btn').addEventListener('click', handleSaveDevedor);
    document.getElementById('cancel-btn').addEventListener('click', renderDashboard);
}

// --- FUNÇÕES DE LÓGICA (HANDLERS) ---

function handleSaveDevedor() {
    const razaoSocial = document.getElementById('razao-social').value;
    const cnpj = document.getElementById('cnpj').value;
    const errorMessage = document.getElementById('error-message');

    if (!razaoSocial || !cnpj) {
        errorMessage.textContent = 'Razão Social e CNPJ são obrigatórios.';
        return;
    }
    if (cnpj.replace(/\D/g, '').length !== 14) {
        errorMessage.textContent = 'Por favor, preencha um CNPJ válido com 14 dígitos.';
        return;
    }

    const devedorData = {
        razaoSocial: razaoSocial,
        cnpj: cnpj.replace(/\D/g, ''),
        nomeFantasia: document.getElementById('nome-fantasia').value,
        nivelPrioridade: parseInt(document.getElementById('nivel-prioridade').value),
        observacoes: document.getElementById('observacoes').value,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        uidUsuario: auth.currentUser.uid
    };

    db.collection("grandes_devedores").add(devedorData)
        .then(() => {
            console.log("Devedor salvo com sucesso!");
            alert("Grande Devedor salvo com sucesso!");
            renderDashboard();
        })
        .catch(error => {
            console.error("Erro ao salvar devedor: ", error);
            errorMessage.textContent = "Erro ao salvar. Tente novamente.";
        });
}


// --- FUNÇÕES DE AUTENTICAÇÃO ---

function renderLoginForm() {
    loginContainer.innerHTML = `
        <h1>SASIF</h1>
        <p>Acesso ao Sistema de Acompanhamento</p>
        <div class="form-group">
            <label for="email">E-mail</label>
            <input type="email" id="email" required>
        </div>
        <div class="form-group">
            <label for="password">Senha</label>
            <input type="password" id="password" required>
        </div>
        <div id="error-message"></div>
        <div class="form-buttons">
            <button id="login-btn">Entrar</button>
            <button id="signup-btn">Cadastrar</button>
        </div>
    `;
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
    db.collection("grandes_devedores").orderBy("razaoSocial")
      .onSnapshot((snapshot) => {
        const devedores = [];
        snapshot.forEach((doc) => {
            devedores.push({ id: doc.id, ...doc.data() });
        });
        renderDevedoresList(devedores);
      }, (error) => {
        console.error("Erro ao buscar devedores: ", error);
        document.getElementById('devedores-list-container').innerHTML = 
            `<p class="empty-list-message">Erro ao carregar a lista de devedores.</p>`;
      });
}

function initApp(user) {
    userEmailSpan.textContent = user.email;
    logoutButton.addEventListener('click', () => {
        auth.signOut();
    });
    
    renderDashboard(); // Renderiza a tela inicial do app
    setupDevedoresListener(); // Ativa o listener para a lista de devedores
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