// login.js
// Gestão de autenticação via Modal para o modo online.
// Usa Network.register para verificar/registar.
// Guarda credenciais (incluindo Grupo) no sessionStorage.

(function (global) {
  const STORAGE_KEY = 'tab_credentials';

  // --- Gestão de Credenciais ---

  function saveCredentials(nick, password, group) {
    const data = { nick, password, group };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function clearCredentials() {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function getCredentials() {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function isLoggedIn() {
    const c = getCredentials();
    return !!(c && c.nick && c.password);
  }

  // --- UI do Header ---

  function updateIdentificationUI() {
    const ident = document.getElementById('identification');
    if (!ident) return;
    ident.innerHTML = ''; // Limpar zona

    if (isLoggedIn()) {
      const { nick, group } = getCredentials();
      const span = document.createElement('span');
      span.id = 'logged-user';
      // Mostra Nick e Grupo (opcional, mas útil)
      span.textContent = `Player: ${nick} (Grp ${group || '?'})`;
      span.style.fontWeight = '700';
      span.style.color = '#5D4037';
      span.style.marginRight = '12px';

      const logoutBtn = document.createElement('button');
      logoutBtn.id = 'logout-button';
      logoutBtn.className = 'auth-button';
      logoutBtn.textContent = 'Logout';
      logoutBtn.style.marginLeft = '5px';

      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        clearCredentials();
        updateIdentificationUI();
        window.location.reload(); // Recarregar para limpar estados de jogo
      });

      ident.appendChild(span);
      ident.appendChild(logoutBtn);
    } else {
      // Botão único para Entrar/Registar (abre modal)
      const authBtn = document.createElement('button');
      authBtn.id = 'login-button';
      authBtn.className = 'auth-button';
      authBtn.textContent = 'Entrar / Registar';

      authBtn.addEventListener('click', () => {
        showAuthModal();
      });

      ident.appendChild(authBtn);
    }
  }

  // --- Modal Logic ---

  function showAuthModal() {
    const modal = document.getElementById('auth-modal');
    const nickInput = document.getElementById('auth-nick');
    const groupInput = document.getElementById('auth-group');

    if (modal) {
      modal.style.display = 'flex';
      // Auto-focus no nick
      if (nickInput) nickInput.focus();

      // Pré-preencher se houver (ex: re-login)
      const creds = getCredentials();
      if (creds) {
        if (nickInput) nickInput.value = creds.nick || '';
        if (groupInput) groupInput.value = creds.group || '';
      }
    }
  }

  function hideAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
    // Limpar form? Opcional
    document.getElementById('auth-form').reset();
  }

  function setupModalListeners() {
    const modal = document.getElementById('auth-modal');
    const cancelBtn = document.getElementById('modal-cancel');
    const form = document.getElementById('auth-form');

    // Fechar ao clicar fora (overlay)
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) hideAuthModal();
      });
    }

    // Botão cancelar
    if (cancelBtn) {
      cancelBtn.addEventListener('click', hideAuthModal);
    }

    // Submit form
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const nick = document.getElementById('auth-nick').value.trim();
        const password = document.getElementById('auth-password').value.trim();
        const group = document.getElementById('auth-group').value.trim();

        if (!nick || !password || !group) {
          alert("Por favor preencha todos os campos.");
          return;
        }

        performRegister(nick, password, group);
      });
    }
  }

  function performRegister(nick, password, group) {
    if (!window.Network || !window.Network.register) {
      alert("Erro: Network module not loaded.");
      return;
    }

    // O servidor não recebe 'group' no register, mas nós guardamos localmente
    window.Network.register({ nick, password })
      .then(() => {
        saveCredentials(nick, password, group);
        hideAuthModal();
        updateIdentificationUI();
        alert(`Bem-vindo, ${nick}!`);
      })
      .catch(err => {
        console.error("Register Error:", err);
        alert("Erro na autenticação: " + (err.message || JSON.stringify(err)));
      });
  }

  // --- API Exportada ---
  global.Auth = {
    saveCredentials,
    clearCredentials,
    getCredentials,
    isLoggedIn,
    updateIdentificationUI,
    showAuthModal // Útil se o jogo quiser forçar login
  };

  // Inicialização
  document.addEventListener('DOMContentLoaded', () => {
    setupModalListeners();
    updateIdentificationUI();
  });

})(window);