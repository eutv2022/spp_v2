// main.js

import { router } from './core/router.js';
import Remote from './core/remote.js'; 
import { auth } from './services/auth.js';
import { sessionManager } from './services/sessionManager.js';
import { setupLoginPage } from './views/LoginPage.js';
import { setupHomePage } from './views/HomePage.js';
import { startAutoPreload, smartDataSync } from './services/DataPreloader.js';
import { StatusOverlay } from '../utils/StatusOverlay.js';
import { Logger } from '../utils/logger.js';
import { ConfigLoader } from './services/ConfigLoader.js';

// --- CONFIGURACIÓN GLOBAL ---
window.GLOBAL_REVIEW_MODE = false;
// window.DEV_USER = 'samsung'; // Comentado para PC para evitar auto-logout en pruebas

if (!window.__smartSyncTriggered) window.__smartSyncTriggered = false;

function triggerSmartSync() {
    if (!window.__smartSyncTriggered) {
        window.__smartSyncTriggered = true;
        smartDataSync();
    } else {
        Logger.info('[Main] smartDataSync ya fue disparado en este arranque.');
    }
}

// --- SOPORTE TIZEN (TV) ---
function registerTizenKeys() {
    if (typeof tizen === 'undefined') return;
    
    const inputApi = tizen.tvinputdevice;
    const keys = [
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
        'VolumeUp', 'VolumeDown', 'ChannelUp', 'ChannelDown',
        'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind',
        'Info', 'Search', 'Guide', 
        'Red', 'Green', 'Yellow', 'Blue'
    ];

    try {
        inputApi.registerKeyBatch(keys, 
            () => Logger.info("✅ Teclas Tizen registradas.", "Input"), 
            (err) => Logger.warn("⚠️ Falló registro teclas Tizen.", "Input", err)
        );
    } catch (e) {
        Logger.error("Error intentando registrar teclas Tizen", "Input", e);
    }
}

// --- SOPORTE PC (WINDOWS/ELECTRON) ---
function registerPCKeys() {
    if (typeof tizen !== 'undefined') return;

    Logger.info("💻 Modo PC detectado: Habilitando atajos de teclado.", "Input");

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Backspace') {
            const tag = document.activeElement.tagName;
            if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
                e.preventDefault();
                Logger.debug("PC Key: Escape/Back detectado -> Router Back", "Input");
                router.back(); 
            }
        }

        if (e.key === 'F1') handleColorKey('Red');
        if (e.key === 'F2') handleColorKey('Green');
        if (e.key === 'F3') handleColorKey('Yellow');
        if (e.key === 'F4') handleColorKey('Blue');
    });
}

function handleColorKey(color) {
    const event = new CustomEvent('remote:colorkey', { detail: { color: color } });
    window.dispatchEvent(event);
}

// --- UI HELPERS ---
window.addEventListener('db:updated', (e) => {
    const key = e.detail.key;
    if(StatusOverlay && typeof StatusOverlay.hide === 'function') StatusOverlay.hide(key); 
});

function showInitialLoaders() {
    if (StatusOverlay) {
        StatusOverlay.show('live');
        StatusOverlay.show('movies');
        StatusOverlay.show('series');
    }
}

// --- VERIFICACIÓN DE SESIÓN (ACTUALIZADO AL NUEVO PANEL) ---
async function verifySessionSilently() {    
    // 1. Verificamos si tenemos credenciales en memoria
    if (!sessionManager.isAuthenticated()) {
        return false;
    }

    // 2. ESTRATEGIA: "Optimistic Auth"
    // Asumimos que la sesión sigue viva y entramos al Home rápido.
    router.loadView('home', { callback: setupHomePage }); 
    showInitialLoaders();
    triggerSmartSync();
    startAutoPreload();

    // 3. Validación en segundo plano (Doble chequeo: Panel y luego Servidor IPTV)
    try {
        const isValidPromise = auth.validateCurrentSession();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000));
        
        // Esperamos a ver qué responde primero, si la validación o el timeout de 10s
        const isValid = await Promise.race([isValidPromise, timeoutPromise]);
        
        if (!isValid) {
            // El panel o el servidor IPTV dijeron que la cuenta ya no es válida (venció o fue baneada)
            Logger.warn("Sesión revocada por el Panel maestro o expirada. Cerrando...", "Auth");
            sessionManager.clearSession(); // Borra user/pass pero MANTIENE el Código de Vinculación
            
            // Notificamos al usuario y lo devolvemos a la pantalla de código
            alert("Su sesión ha expirado o el dispositivo fue desvinculado.");
            router.loadView('login', { callback: setupLoginPage });
            return false;
        }
        
        Logger.info("Validación silenciosa completada: Dispositivo Activo.", "Auth");
        return true;

    } catch (e) {
        // Si hay Timeout o error de Red (sin internet temporal), NO BORRAMOS NADA. 
        // El usuario sigue en el Home viendo lo que ya cacheó la DB.
        Logger.info("Error de red en validación, manteniendo sesión local optimista.", "Auth");
        return true; 
    }
}

// --- INICIALIZACIÓN (BOOT) ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cargar Configuración
    const config = await ConfigLoader.load();
    const currentSession = sessionManager.isAuthenticated();

    // 2. Chequeo de Mantenimiento Global
    if (config.status === 'maintenance') {
        if (currentSession) sessionManager.clearSession();
        document.body.innerHTML = `
            <div style="background:#111; color:#fff; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; font-family:sans-serif;">
                <h1 style="font-size:3em; color:#ff4444;">⚠️ Mantenimiento</h1>
                <p style="font-size:1.5em; margin-top:20px;">Estamos mejorando la infraestructura. Vuelve pronto.</p>
            </div>`;
        return;
    }

    // 3. Inicializar Controles
    try {
        registerTizenKeys();
        registerPCKeys(); 
        Remote.init(); 
        if(StatusOverlay && typeof StatusOverlay.init === 'function') {
            StatusOverlay.init();
        }
    } catch (e) {
        Logger.error("Fallo inicialización módulos", "Boot", e);
    }

    // 4. Intentar restaurar sesión optimista o ir a Mostrar Código (Login)
    const sessionRestored = await verifySessionSilently(); 
    
    if (!sessionRestored) {
        router.loadView('login', { callback: setupLoginPage });
    }
    
    startStatusMonitor();
});

// --- MONITOR DE ESTADO ---
const CHECK_INTERVAL = 30000; 
function startStatusMonitor() {
    setInterval(async () => {
        try {
            // Solo verificamos la config general (no saturamos el panel PHP ni el IPTV)
            const config = await ConfigLoader.load();
            if (config.status === 'maintenance') {
                sessionManager.clearSession();
                window.location.reload();
            }
        } catch (e) {
            // Ignorar errores de red temporales
        }
    }, CHECK_INTERVAL);
}

// Debugger simple de teclas
window.addEventListener('keydown', (e) => {
    if(e.code !== 'ArrowUp' && e.code !== 'ArrowDown' && e.code !== 'ArrowLeft' && e.code !== 'ArrowRight') {
        Logger.debug(`Tecla: ${e.key} (${e.code})`, "Input");
    }
}, true);