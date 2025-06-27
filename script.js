// Cole aqui as suas credenciais do Firebase
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

// Função principal que roda quando a página carrega
document.addEventListener('DOMContentLoaded', () => {
    // Verifica o estado de autenticação do usuário
    auth.onAuthStateChanged(user => {
        if (user) {
            // Usuário está logado
            console.log("Usuário logado:", user.email);
            // Mostra o app e esconde o login
            document.getElementById('app-container').classList.remove('hidden');
            document.getElementById('login-container').classList.add('hidden');
            // Futuramente, aqui vamos inicializar o app
        } else {
            // Usuário não está logado
            console.log("Nenhum usuário logado.");
            // Mostra o login e esconde o app
            document.getElementById('app-container').classList.add('hidden');
            document.getElementById('login-container').classList.remove('hidden');
            // Futuramente, aqui vamos renderizar o formulário de login
        }
    });
});