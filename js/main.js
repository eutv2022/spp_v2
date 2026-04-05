// main.js

import { router } from './core/router.js';
import Remote from './core/remote.js'; // Asumo que Remote maneja las flechas y Enter
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
    
    // Si estamos en Tizen, registramos las teclas especiales
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
    // Si NO estamos en Tizen, asumimos PC/Web
    if (typeof tizen !== 'undefined') return;

    Logger.info("💻 Modo PC detectado: Habilitando atajos de teclado.", "Input");

    document.addEventListener('keydown', (e) => {
        // Mapeo de ESCAPE para volver atrás (emula el botón RETURN del control remoto)
        if (e.key === 'Escape' || e.key === 'Backspace') {
            // Evitamos que Backspace navegue atrás en el historial del navegador
            // si no estamos en un input de texto
            const tag = document.activeElement.tagName;
            if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
                e.preventDefault();
                Logger.debug("PC Key: Escape/Back detectado -> Router Back", "Input");
                router.back(); 
            }
        }

        // Mapeo de Teclas de Colores (Opcional, útil si tu UI las usa)
        if (e.key === 'F1') handleColorKey('Red');
        if (e.key === 'F2') handleColorKey('Green');
        if (e.key === 'F3') handleColorKey('Yellow');
        if (e.key === 'F4') handleColorKey('Blue');
    });
}

function handleColorKey(color) {
    // Disparamos un evento sintético para que Remote.js o la Vista actual lo capturen
    // como si fuera una tecla del control remoto
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

// --- VERIFICACIÓN DE SESIÓN ---
async function verifySessionSilently() {    
    const authData = sessionManager.getAuthData();
    if (!authData) return false;

    // ESTRATEGIA: "Optimistic Auth"
    // Si tenemos datos, entramos al Home de una vez para no hacer esperar al usuario.
    router.loadView('home', { callback: setupHomePage }); 
    showInitialLoaders();
    triggerSmartSync();
    startAutoPreload();

    // Luego, en segundo plano, verificamos si la cuenta sigue activa
    try {
        const username = authData.user_info.username;
        const password = authData.user_info.password;
        
        const loginPromise = auth.login(username, password);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000));
        
        const errorMessage = await Promise.race([loginPromise, timeoutPromise]);
        
        if (errorMessage) {
            // SOLO borramos sesión si el error es de credenciales (401 o 403)
            if (errorMessage.includes("incorrectos") || errorMessage.includes("expirado") || errorMessage.includes("403")) {
                Logger.warn("Sesión expirada o inválida. Cerrando...", "Auth");
                sessionManager.clearSession();
                router.loadView('login', { callback: setupLoginPage });
                return false;
            }
            // Si es error de red o timeout, NO BORRAMOS NADA. 
            // El usuario sigue en el Home viendo lo que hay en la DB.
            Logger.info("Error de red en validación, manteniendo sesión local.", "Auth");
        }
        return true;
    } catch (e) {
        Logger.error("Error silencioso de validación", "Auth", e);
        return true; // Mantenemos la sesión ante errores de código
    }
}

// --- INICIALIZACIÓN (BOOT) ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cargar Configuración (Ahora ignora el proxy y fuerza local)
    const config = await ConfigLoader.load();
    const currentSession = sessionManager.getAuthData();

    // 2. Chequeo de Mantenimiento
    if (config.status === 'maintenance') {
        if (currentSession) sessionManager.clearSession();
        document.body.innerHTML = `
            <div style="background:#111; color:#fff; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; font-family:sans-serif;">
                <h1 style="font-size:3em; color:#ff4444;">⚠️ Mantenimiento</h1>
                <p style="font-size:1.5em; margin-top:20px;">Estamos mejorando el servidor. Vuelve pronto.</p>
            </div>`;
        return;
    }

    // 3. Inicializar Controles
    try {
        registerTizenKeys(); // Solo funcionará en TV
        registerPCKeys();    // Solo funcionará en PC
        
        Remote.init();       // Inicia navegación por flechas
        
        if(StatusOverlay && typeof StatusOverlay.init === 'function') {
            StatusOverlay.init();
        }
    } catch (e) {
        Logger.error("Fallo inicialización módulos", "Boot", e);
    }

    // 4. Intentar restaurar sesión o ir a Login
    const sessionRestored = await verifySessionSilently(); 
    
    if (!sessionRestored) {
        router.loadView('login', { callback: setupLoginPage });
    }
    
    startStatusMonitor();
});

// --- MONITOR DE ESTADO ---
const CHECK_INTERVAL = 30000; // Aumentado a 30s para no saturar XUI
let lastKnownStatus = "active";

function startStatusMonitor() {
    setInterval(async () => {
        try {
            // Solo verificamos si la configuración remota dice "mantenimiento"
            // No validamos la sesión contra XUI cada 10s para no ser bloqueados por flood
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
    // Solo mostramos logs si es una tecla rara, para no ensuciar la consola
    if(e.code !== 'ArrowUp' && e.code !== 'ArrowDown' && e.code !== 'ArrowLeft' && e.code !== 'ArrowRight') {
        Logger.debug(`Tecla: ${e.key} (${e.code})`, "Input");
    }
}, true);