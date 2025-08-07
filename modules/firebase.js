// ==================================================================
// Módulo: firebase.js
// Responsabilidade: Inicializar e exportar as instâncias do Firebase.
// ==================================================================

// Configuração do seu projeto Firebase.
const firebaseConfig = {
  apiKey: "AIzaSyBKDnfYqBV7lF_8o-LGuaLn_VIrb2keyh0",
  authDomain: "sasif-app.firebaseapp.com",
  projectId: "sasif-app",
  storageBucket: "sasif-app.firebasestorage.app",
  messagingSenderId: "695074109375",
  appId: "1:695074109375:web:0b564986ef12555091d30a",
};

// Inicializa o Firebase
const app = firebase.initializeApp(firebaseConfig);

// Exporta os serviços que serão usados em outros módulos.
// A palavra 'export' permite que outras partes do código importem estas variáveis.
export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();
