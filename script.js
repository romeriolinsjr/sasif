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

// Função que renderiza o formulário de login
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

    // Adiciona os event listeners aos botões
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('signup-btn').addEventListener('click', handleSignUp);
}

// Função para tratar o login
function handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');
    
    if (!email || !password) {
        errorMessage.textContent = 'Por favor, preencha e-mail e senha.';
        return;
    }

    auth.signInWithEmailAndPassword(email, password)
        .catch(error => {
            console.error("Erro no login:", error);
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                errorMessage.textContent = 'E-mail ou senha incorretos.';
            } else {
                errorMessage.textContent = 'Ocorreu um erro ao tentar fazer o login.';
            }
        });
}

// Função para tratar o cadastro de novo usuário
function handleSignUp() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');

    if (!email || !password) {
        errorMessage.textContent = 'Por favor, preencha e-mail e senha.';
        return;
    }

    auth.createUserWithEmailAndPassword(email, password)
        .then(userCredential => {
            console.log("Usuário cadastrado com sucesso:", userCredential.user.email);
            // O onAuthStateChanged vai cuidar de redirecionar para o app
        })
        .catch(error => {
            console.error("Erro no cadastro:", error);
            if (error.code === 'auth/weak-password') {
                errorMessage.textContent = 'A senha deve ter no mínimo 6 caracteres.';
            } else if (error.code === 'auth/email-already-in-use') {
                errorMessage.textContent = 'Este e-mail já está em uso.';
            } else {
                errorMessage.textContent = 'Ocorreu um erro ao tentar cadastrar.';
            }
        });
}

// Função para inicializar o app principal (quando o usuário está logado)
function initApp(user) {
    userEmailSpan.textContent = user.email;
    logoutButton.addEventListener('click', () => {
        auth.signOut();
    });
    
    // Futuramente, aqui chamaremos as funções para carregar os dados do SASIF
}

// Ponto de entrada do script
document.addEventListener('DOMContentLoaded', () => {
    // Gerenciador central de autenticação do Firebase
    auth.onAuthStateChanged(user => {
        if (user) {
            // Usuário está logado
            appContainer.classList.remove('hidden');
            loginContainer.classList.add('hidden');
            initApp(user);
        } else {
            // Usuário não está logado
            appContainer.classList.add('hidden');
            loginContainer.classList.remove('hidden');
            renderLoginForm();
        }
    });
});