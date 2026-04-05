// js/auth.js

import { apiGet } from '../../utils/apiModule.js';
import { sessionManager } from './sessionManager.js';
import { Logger } from '../../utils/logger.js';

function getFriendlyErrorMessage(errorMsg) {
    const msg = String(errorMsg).toLowerCase();
    if (msg.includes("401")) return "❌ Usuario o contraseña incorrectos.";
    if (msg.includes("403")) return "⛔ Tu cuenta ha expirado o está desactivada.";
    if (msg.includes("404")) return "⚠️ Error de conexión (Servidor no encontrado).";
    if (msg.includes("500") || msg.includes("502") || msg.includes("520")) return "🛠️ Servidor en mantenimiento.";
    if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed")) return "📡 Sin conexión a internet.";
    if (msg.includes("timeout")) return "🐢 Tiempo de espera agotado.";
    return msg.replace(/error:/gi, "").trim() || "Error desconocido.";
}

const auth = {
    login: async function(username, password) {
        const endpoint = `/player_api.php?username=${username}&password=${password}`;        
        try {
            const data = await apiGet(endpoint);
            if (data?.message) throw new Error(data.message);
            if (!data || (!data.user_info && !data.user)) throw new Error("Formato de respuesta inválido");

            const userInfo = data.user_info || data.user;
            if (!userInfo) throw new Error("Sin datos de usuario");

            if (userInfo.status === "Active") {
                Logger.info("Auth: login success");
                // ✅ CORRECTO: Usamos tu sessionManager tal cual es.
                // Asumimos que la API devuelve user y pass dentro del objeto data
                sessionManager.createSession(data);
                return null;
            } else {
                const status = userInfo.status || "Unknown";
                if (["Expired", "Banned", "Disabled"].includes(status)) throw new Error("403 Account Inactive");
                throw new Error(`Acceso denegado (${status})`);
            }

        } catch (error) {
            Logger.error("Auth: fail", error.message);
            return getFriendlyErrorMessage(error.message);
        }
    },

    validateCurrentSession: async function(username, password) {
        const endpoint = `/player_api.php?username=${username}&password=${password}`;
        try {
            const data = await apiGet(endpoint);
            const userInfo = data?.user_info || data?.user;
            return userInfo && userInfo.status === "Active";
        } catch (error) {
            const msg = error.message.toLowerCase();
            if (msg.includes("network") || msg.includes("fetch")) return true;
            return false;
        }
    },

    // 🔗 EL PUENTE MÁGICO
    getCredentials: function() {
        // 1. Verificamos si sessionManager está disponible
        if (!sessionManager) {
            Logger.warn("Auth: sessionManager no importado");
            return { username: '', password: '' };
        }

        // 2. Usamos EL MÉTODO QUE SÍ EXISTE en tu sessionManager
        if (typeof sessionManager.getAccountInfo === 'function') {
            const userInfo = sessionManager.getAccountInfo();
            
            if (userInfo) {
                return {
                    username: userInfo.username || "",
                    password: userInfo.password || ""
                };
            }
        }
        
        // 3. Fallback: Intentamos con getAuthData si getAccountInfo falló
        if (typeof sessionManager.getAuthData === 'function') {
             const allData = sessionManager.getAuthData();
             const uInfo = allData?.user_info || allData?.user;
             if (uInfo) {
                 return {
                     username: uInfo.username || "",
                     password: uInfo.password || ""
                 };
             }
        }

        Logger.warn("Auth: No se encontraron credenciales en sessionManager");
        return { username: '', password: '' };
    }
};

export { auth };