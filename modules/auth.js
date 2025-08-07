// ==================================================================
// Módulo: auth.js
// Responsabilidade: Lógica de autenticação e gerenciamento da sessão do usuário.
// ==================================================================

import { auth } from "./firebase.js"; // Importa a instância de autenticação do Firebase
import { appContainer, loginContainer, showToast } from "./ui.js";
import { initApp } from "./main.js";

/**
 * Renderiza o formulário de login na tela.
 */
export function renderLoginForm() {
  document.title = "SASIF | Login";
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
        <a href="#" id="forgot-password-link" class="forgot-password-link">Esqueci minha senha</a>
        <div id="error-message"></div>
        <div class="form-buttons">
            <button id="login-btn">Entrar</button>
        </div>`;

  document.getElementById("login-btn").addEventListener("click", handleLogin);
  document
    .getElementById("forgot-password-link")
    .addEventListener("click", handlePasswordResetRequest);
}

/**
 * Realiza o processo de login do usuário.
 */
export function handleLogin() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const errorMessage = document.getElementById("error-message");
  if (!email || !password) {
    errorMessage.textContent = "Por favor, preencha e-mail e senha.";
    return;
  }
  auth.signInWithEmailAndPassword(email, password).catch((error) => {
    errorMessage.textContent = "E-mail ou senha incorretos.";
  });
}

/**
 * Lida com o pedido de redefinição de senha.
 */
export function handlePasswordResetRequest(event) {
  event.preventDefault();
  const email = document.getElementById("email").value;
  const errorMessage = document.getElementById("error-message");

  if (!email) {
    errorMessage.textContent =
      "Por favor, digite seu e-mail no campo acima para redefinir a senha.";
    return;
  }

  auth
    .sendPasswordResetEmail(email)
    .then(() => {
      showToast("E-mail de redefinição de senha enviado com sucesso!");
      errorMessage.textContent =
        "Verifique sua caixa de entrada para o link de redefinição.";
      errorMessage.style.color = "var(--cor-sucesso)";
    })
    .catch((error) => {
      console.error("Erro ao enviar e-mail de redefinição:", error);
      if (error.code === "auth/user-not-found") {
        errorMessage.textContent = "Nenhum usuário encontrado com este e-mail.";
      } else {
        errorMessage.textContent = "Ocorreu um erro ao tentar enviar o e-mail.";
      }
      errorMessage.style.color = "var(--cor-erro)";
    });
}
