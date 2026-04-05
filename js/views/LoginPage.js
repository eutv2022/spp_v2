// js/views/LoginPage.js
import { router } from '../core/router.js';
import { auth } from '../services/auth.js';
import { homeLoginFocus } from '../core/homeLoginFocus.js';
import { setupHomePage } from './HomePage.js';
import { Logger } from '../../utils/logger.js';

const LOGIN_MARKUP = `
  <div class="view-login">
    <div id="login-logo-container" class="app-logo-login">
      <video id="loginVideo" class="login-video-logo"
             autoplay playsinline muted preload="auto"
             poster="assets/logo/logo11.png">
        Video No Soportado...
      </video>
    </div>

    <div class="login-container" role="form" aria-labelledby="login-title">
      <h1 id="login-title" class="login-title">Datos de Acceso</h1>
      
      <input type="text" id="username" placeholder="Usuario" class="login-input focusable" tabindex="0" />
      <input type="password" id="password" placeholder="Contraseña" class="login-input focusable" tabindex="0" />
      
      <button id="loginBtn" class="login-button focusable" tabindex="0" type="button">
        <i class="fas fa-key" aria-hidden="true"></i> Conectar
      </button>

      <button id="exitLoginBtn" class="login-button focusable" tabindex="0" type="button" style="margin-top: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
        <i class="fas fa-power-off" aria-hidden="true"></i> Salir
      </button>
      
      <div id="eula-modal" class="modal-overlay" style="display:flex; position:fixed; top:0; left:0; width:100%; height:100%; background:var(--overlay-bg); z-index:9999; justify-content:center; align-items:center;">
        <div class="modal-content" style="background:var(--element-bg); color:var(--text-sub); padding:30px; border-radius:10px; width:70%; max-height:80%; display:flex; flex-direction:column; border: 1px solid var(--panel-inner);">
          <h2 style="color:var(--eula-header); margin-top:0; text-align:center;">Protocolo de Seguridad</h2>
          <div id="eula-text-body" class="focusable" tabindex="0" style="height: 300px; overflow-y: hidden; text-align:left; font-size:0.85rem; line-height:1.6; margin-bottom:20px; padding-right:10px; outline: none; border: 1px solid transparent;">
             </div>
          <button id="close-eula" class="focusable" style="display: block; margin: 0 auto; min-width: 150px; padding: 10px 20px; background:var(--eula-header); color:var(--back-white); border:none; border-radius:5px;" tabindex="0">Aceptar y Continuar</button>
        </div>
      </div>
      
      <div id="login-error" class="error-message" role="status" aria-live="polite"></div>
    </div>
  </div>
`;

export function renderLogin() {
    const appContainer = document.getElementById('app-container');
    if (appContainer) appContainer.innerHTML = LOGIN_MARKUP;
}

export function setupLoginPage() {
    homeLoginFocus.init();
    const loginButton = document.getElementById('loginBtn');
    const exitButton = document.getElementById('exitLoginBtn'); // Referencia al nuevo botón
    const usernameInput = document.getElementById('username');
    const eulaModal = document.getElementById('eula-modal');
    const eulaTextBody = document.getElementById('eula-text-body');
    const closeEulaBtn = document.getElementById('close-eula');
    const errorDiv = document.getElementById('login-error');
    const videoElement = document.querySelector('.login-video-logo');

    // Función para cerrar la app limpiamente
    const exitApp = () => {
        try {
            Logger.info("Saliendo de la app desde Login...");
            if (typeof tizen !== 'undefined') {
                tizen.application.getCurrentApplication().exit();
            } else {
                window.close(); // Para Electron / PC
            }
        } catch (e) {
            Logger.error("Error al salir de la app", e);
        }
    };

    const showEulaModal = () => {
        eulaTextBody.innerHTML = `
            <h3 style="text-align:center; color:var(--eula-header); margin-bottom:15px;">LICENCIA DE USO Y ACCESO A INFRAESTRUCTURA</h3>
            <p><strong>1. NATURALEZA DEL SERVICIO:</strong> Esta aplicación constituye una interfaz de gestión para la sincronización y visualización de activos digitales remotos.</p>
            <p><strong>2. AUTORIZACIÓN DE ACCESO:</strong> Al introducir sus credenciales, el usuario certifica poseer los derechos legales necesarios.</p>
            <p><strong>3. SEGURIDAD:</strong> Todas las transferencias se realizan bajo protocolos seguros (TLS/SSL).</p>
            <p><strong>4. TELEMETRÍA TÉCNICA:</strong> No se recopila información de identificación personal (PII).</p>
            <p><strong>5. RESTRICCIONES:</strong> Prohibido el uso de herramientas de interceptación de tráfico.</p>
            <p><strong>6. ACEPTACIÓN:</strong> El uso implica la aceptación de estos protocolos.</p>
        `;
        
        eulaModal.style.display = 'flex';

        setTimeout(() => {
            if (homeLoginFocus.openEulaModal) {
                homeLoginFocus.openEulaModal();
            } else {
                eulaTextBody.focus();
            }
        }, 150);
    };

    const acceptEula = () => {
        localStorage.setItem('lion_legal_accepted', 'true');
        eulaModal.style.display = 'none';
        if (homeLoginFocus.closeEulaModal) {
            homeLoginFocus.closeEulaModal();
        }
        setTimeout(() => {
            usernameInput.focus();
            usernameInput.classList.add('focused');
        }, 100);
    };

    const initFlow = () => {
        const hasAccepted = localStorage.getItem('lion_legal_accepted');
        if (!hasAccepted) {
            showEulaModal();
        } else {
            setTimeout(() => {
                usernameInput.focus();
                usernameInput.classList.add('focused');
            }, 100);
        }
    };

    // Listeners
    closeEulaBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        acceptEula();
    });

    // Acción de Salir
    if (exitButton) {
        exitButton.addEventListener('click', exitApp);
    }

    loginButton.addEventListener('click', async () => {
        let username = document.getElementById('username').value.trim();
        let password = document.getElementById('password').value.trim();
        if (!username || !password) {
            if (errorDiv) errorDiv.textContent = "Ingrese credenciales válidas.";
            return;
        }
        if (errorDiv) errorDiv.textContent = "Verificando acceso...";
        
        try {
            const errorMessage = await auth.login(username, password);
            if (!errorMessage) {
                router.loadView('home', { callback: setupHomePage }); 
            } else {
                if (errorDiv) errorDiv.textContent = errorMessage;
            }
        } catch (_) {
            Logger.error('LoginPage: Error en login.', _);
            if (errorDiv) errorDiv.textContent = "Error de conexión";
        }
    });

    if (videoElement && usernameInput) {
        usernameInput.addEventListener('focus', () => {
            videoElement.currentTime = 0;
            videoElement.muted = false;
            videoElement.play().catch(() => {});
        }, { once: true });
    }
    setTimeout(initFlow, 50);
}