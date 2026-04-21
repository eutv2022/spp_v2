// js/views/LoginPage.js
import { router } from '../core/router.js';
import { auth } from '../services/auth.js';
import { homeLoginFocus } from '../core/homeLoginFocus.js';
import { setupHomePage } from './HomePage.js';
import { Logger } from '../../../utils/logger.js';

// NOTA SENIOR: Eliminamos los inputs de user/pass. El cliente solo necesita ver su código.
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
      <h1 id="login-title" class="login-title">Activación de Servicio</h1>
      
      <div id="mac-display" class="mac-info-box" style="background: rgba(76, 175, 80, 0.1); border: 1px solid rgba(76, 175, 80, 0.3); padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
        <p style="margin: 0; font-size: 0.9rem; color: rgba(255,255,255,0.6);">Código de Vinculación:</p>
        <p id="mac-address" style="margin: 8px 0 0 0; font-size: 1.5rem; color: #4CAF50; font-family: monospace; font-weight: bold; letter-spacing: 2px;">Cargando...</p>
      </div>
      
      <button id="loginBtn" class="login-button focusable" tabindex="0" type="button">
        <i class="fas fa-link" aria-hidden="true"></i> Conectar / Actualizar
      </button>

      <button id="exitLoginBtn" class="login-button focusable" tabindex="0" type="button" style="margin-top: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
        <i class="fas fa-power-off" aria-hidden="true"></i> Salir
      </button>
      
      <div id="eula-modal" class="modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:var(--overlay-bg); z-index:9999; justify-content:center; align-items:center;">
        <div class="modal-content" style="background:var(--element-bg); color:var(--text-sub); padding:30px; border-radius:10px; width:70%; max-height:80%; display:flex; flex-direction:column; border: 1px solid var(--panel-inner);">
          <h2 style="color:var(--eula-header); margin-top:0; text-align:center;">Protocolo de Seguridad</h2>
          <div id="eula-text-body" class="focusable" tabindex="0" style="height: 300px; overflow-y: hidden; text-align:left; font-size:0.85rem; line-height:1.6; margin-bottom:20px; padding-right:10px; outline: none; border: 1px solid transparent;">
          </div>
          <button id="close-eula" class="focusable" style="display: block; margin: 0 auto; min-width: 150px; padding: 10px 20px; background:var(--eula-header); color:var(--back-white); border:none; border-radius:5px;" tabindex="0">Aceptar y Continuar</button>
        </div>
      </div>
      
      <div id="login-error" class="error-message" role="status" aria-live="polite" style="margin-top: 15px; font-weight: bold; text-align: center;"></div>
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
    const exitButton = document.getElementById('exitLoginBtn');
    const macAddressDisplay = document.getElementById('mac-address');
    const eulaModal = document.getElementById('eula-modal');
    const eulaTextBody = document.getElementById('eula-text-body');
    const closeEulaBtn = document.getElementById('close-eula');
    const errorDiv = document.getElementById('login-error');
    const videoElement = document.querySelector('.login-video-logo');

    // Mostramos el Device ID en pantalla inmediatamente
    macAddressDisplay.textContent = auth.getDeviceId();

    const exitApp = () => {
        try {
            Logger.info("Saliendo de la app desde Login...");
            if (typeof tizen !== 'undefined') {
                tizen.application.getCurrentApplication().exit();
            } else {
                window.close();
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
            <p><strong>3. SEGURIDAD:</strong> Todas las transferencias se realizan bajo protocolos seguros.</p>
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
            loginButton.focus();
        }, 100);
    };

    const initFlow = () => {
        const hasAccepted = localStorage.getItem('lion_legal_accepted');
        if (!hasAccepted) {
            showEulaModal();
        } else {
            setTimeout(() => {
                loginButton.focus();
                
                // OPCIONAL: Auto-conectar al iniciar la app si ya aceptó el EULA
                // loginButton.click(); 
            }, 100);
        }
    };

    // Listeners
    closeEulaBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        acceptEula();
    });

    if (exitButton) {
        exitButton.addEventListener('click', exitApp);
    }

    // EL CEREBRO DE LA CONEXIÓN
    loginButton.addEventListener('click', async () => {
        if (errorDiv) {
            errorDiv.style.color = "white";
            errorDiv.textContent = "Verificando dispositivo...";
        }
        
        try {
            // Llamamos a nuestro nuevo motor de autenticación
            await auth.checkDevicePanel();
            
            // Si el motor no lanzó ningún error (try), ¡estamos dentro!
            Logger.info('LoginPage: Acceso autorizado y credenciales guardadas.');
            if (errorDiv) {
                errorDiv.style.color = "#4CAF50"; // Verde éxito
                errorDiv.textContent = "¡Conexión Exitosa! Iniciando...";
            }
            
            // Pasamos a la vista principal (Home)
            router.loadView('home', { callback: setupHomePage });

        } catch (error) {
            Logger.error('LoginPage: Error en conexión', error);
            const errorMsg = error.message;

            if (errorDiv) {
                if (errorMsg.startsWith('PENDING_CODE:')) {
                    // El cliente aún no existe en tu base de datos
                    errorDiv.style.color = "#FFEB3B"; // Amarillo advertencia
                    errorDiv.textContent = "Por favor, envíe el Código de Vinculación a su proveedor para activar el servicio.";
                } else if (errorMsg.startsWith('BLOQUEO_PANEL:')) {
                    // El panel dice que la fecha se venció o está inactivo
                    errorDiv.style.color = "#F44336"; // Rojo error
                    errorDiv.textContent = errorMsg.split(':')[1];
                } else {
    // Esto te mostrará la IP que la App está intentando tocar y el error real
    errorDiv.style.color = "#F44336";
    errorDiv.textContent = `Error: ${errorMsg} | URL: ${PANEL_URL}`;
    console.error("DEBUG URL:", PANEL_URL);
}
            }
        }
    });

    if (videoElement) {
        loginButton.addEventListener('focus', () => {
            videoElement.currentTime = 0;
            videoElement.muted = false;
            videoElement.play().catch(() => {});
        });
    }

    setTimeout(initFlow, 50);
}