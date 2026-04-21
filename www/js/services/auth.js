// js/services/auth.js

import { apiGet } from '../../../utils/apiModule.js';
import { Logger } from '../../../utils/logger.js';

// --- NUESTRA ÚNICA FUENTE DE VERDAD (TU PANEL) ---
const PANEL_URL = 'http://127.0.0.1:8000/api/worldtv/check_device';;

function getFriendlyErrorMessage(errorMsg) {
    const msg = String(errorMsg).toLowerCase();
    if (msg.includes("401")) return "❌ Usuario o contraseña incorrectos en el servidor origen.";
    if (msg.includes("403")) return "⛔ Tu cuenta ha expirado o está desactivada por el proveedor.";
    if (msg.includes("404")) return "⚠️ Error de conexión (Servidor no encontrado).";
    if (msg.includes("500") || msg.includes("502") || msg.includes("520")) return "🛠️ Servidor origen en mantenimiento.";
    if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed")) return "📡 Sin conexión a internet.";
    if (msg.includes("timeout")) return "🐢 Tiempo de espera agotado.";
    return msg.replace(/error:/gi, "").trim() || "Error desconocido.";
}

const auth = {
    /**
     * 1. NUEVO MOTOR DE ARRANQUE (Reemplaza la necesidad de escribir usuario/password)
     * La pantalla inicial de tu app debe llamar a esta función.
     */
    checkDevicePanel: async function() {
        let deviceId = this.getDeviceId();

        try {
            // Le preguntamos a TU PANEL si este cliente está al día
            const res = await fetch(`${PANEL_URL}?device_id=${deviceId}&t=${new Date().getTime()}`, { cache: 'no-store' });
            const data = await res.json();
            
            if (data.status === 'success') {
                // EL PANEL DIO LUZ VERDE. Guardamos los datos inyectados.
                localStorage.setItem('server_url', data.data.host);
                if (data.data.port) localStorage.setItem('server_port', data.data.port);
                else localStorage.removeItem('server_port');
                
                localStorage.setItem('iptv_user', data.data.username);
                localStorage.setItem('iptv_pass', data.data.password);
                
                // Hacemos el login silencioso contra Xtream Codes para obtener el user_info 
                // que el resto de tu app (menús, perfiles) necesita para funcionar.
                return await this.loginSilencioso(data.data.username, data.data.password);

            } else if (data.status === 'pending') {
                // Lanzamos un error especial para que la interfaz sepa que debe mostrar el código
                throw new Error(`PENDING_CODE:${deviceId}`);
            } else if (data.status === 'expired') {
                throw new Error(`BLOQUEO_PANEL:${data.message}`); // "Tu servicio expiró..."
            } else {
                throw new Error(data.message || "Error de comunicación con el panel maestro.");
            }
        } catch (error) {
            Logger.error("Panel Auth fail:", error);
            throw error; // Pasamos el error a la interfaz para que lo pinte
        }
    },

    /**
     * 2. LOGIN SILENCIOSO CONTRA XTREAM CODES
     * Adaptado de tu código original. Ya no usa sessionManager.
     */
    loginSilencioso: async function(username, password) {
        // apiModule ya sabe armar la URL base
        const endpoint = `/player_api.php?username=${username}&password=${password}`;        
        
        try {
            const data = await apiGet(endpoint);
            if (data?.message) throw new Error(data.message);
            if (!data || (!data.user_info && !data.user)) throw new Error("Formato de respuesta inválido");

            const userInfo = data.user_info || data.user;
            if (!userInfo) throw new Error("Sin datos de usuario");

            if (userInfo.status === "Active") {
                Logger.info("Auth: IPTV login success");
                // Guardamos el JSON completo por si el resto de tu app necesita
                // leer la fecha de expiración del servidor, el max_connections, etc.
                localStorage.setItem('AUTH_JSON', JSON.stringify(data));
                return null; // Todo Perfecto
            } else {
                const status = userInfo.status || "Unknown";
                if (["Expired", "Banned", "Disabled"].includes(status)) throw new Error("403 Account Inactive");
                throw new Error(`Acceso denegado por el servidor proveedor (${status})`);
            }
        } catch (error) {
            Logger.error("Auth IPTV fail:", error.message);
            throw new Error(getFriendlyErrorMessage(error.message));
        }
    },

    /**
     * 3. MÁQUINA DE ESTADOS (Doble Validación)
     * Tu app llama a esto cada cierto tiempo para ver si no lo has cortado.
     */
    validateCurrentSession: async function() {
        try {
            const deviceId = this.getDeviceId();
            
            // A) Preguntamos al Panel (Nuestra fuente de verdad)
            const resPanel = await fetch(`${PANEL_URL}?device_id=${deviceId}`);
            const dataPanel = await resPanel.json();
            
            if (dataPanel.status !== 'success') {
                Logger.warn("El Panel maestro ha revocado la sesión.");
                return false; // Cortar el acceso
            }

            // B) Preguntamos al servidor IPTV
            const u = localStorage.getItem('iptv_user');
            const p = localStorage.getItem('iptv_pass');
            if (!u || !p) return false;

            const endpoint = `/player_api.php?username=${u}&password=${p}`;
            const data = await apiGet(endpoint);
            const userInfo = data?.user_info || data?.user;
            
            return userInfo && userInfo.status === "Active";
            
        } catch (error) {
            // Si hay error de red, no lo sacamos de la app, asumimos que sigue activo temporalmente
            const msg = (error.message || "").toLowerCase();
            if (msg.includes("network") || msg.includes("fetch")) return true;
            return false;
        }
    },

    /**
     * 4. LECTURA DE CREDENCIALES
     * Limpio y directo, sin sessionManager.
     */
    getCredentials: function() {
        const u = localStorage.getItem('iptv_user');
        const p = localStorage.getItem('iptv_pass');
        if (u && p) {
            return { username: u, password: p };
        }
        Logger.warn("Auth: No se encontraron credenciales en localStorage");
        return { username: '', password: '' };
    },

    /**
     * 5. GENERADOR DE MAC/DEVICE ID
     */
    getDeviceId: function() {
        let deviceId = localStorage.getItem('mi_device_id');
        if (!deviceId) {
            const pares = Array.from({length: 3}, () => Math.floor(Math.random() * 100).toString().padStart(2, '0'));
            deviceId = pares.join(':');
            localStorage.setItem('mi_device_id', deviceId);
        }
        return deviceId;
    }
};

export { auth };