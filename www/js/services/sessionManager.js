// js/sessionManager.js (VERSIÓN LIMPIA - INTEGRACIÓN PANEL)

import { Logger } from '../../../utils/logger.js';

export const sessionManager = {
    
    // ============================================
    // MÉTODOS DE XTREAM CODES (Compatibilidad App)
    // ============================================
    
    createSession: function(authJson) {
        try {
            localStorage.setItem("AUTH_JSON", JSON.stringify(authJson));
            Logger.info("SM: createSession - OK");
        } catch (e) {
            Logger.error("SM: write fail", e);
        }
    },

    getAccountInfo: function() {
        const data = localStorage.getItem("AUTH_JSON");
        if (!data) return null;
        try {
            const parsed = JSON.parse(data);
            return parsed.user_info || parsed.user;
        } catch (e) {
            Logger.error("SM: parse err", e);
            return null;
        }
    },

    getAuthData: function() {
        const data = localStorage.getItem("AUTH_JSON");
        try {
            return data ? JSON.parse(data) : null;
        } catch (e) {
            Logger.debug("SM: getAuthData fail", e);
            return null;
        }
    },

    /**
     * OBTENER URL DEL SERVIDOR
     * Lee ciegamente lo que el panel ordenó usar.
     */
    getContentBaseUrl: function() {
        const url = localStorage.getItem('server_url');
        const port = localStorage.getItem('server_port');
        
        if (!url) return null;

        // Si hay puerto, lo arma. Si no, devuelve la IP/Dominio limpia.
        const baseUrl = port ? `${url}:${port}` : url;
        return baseUrl.replace(/\/$/, ""); // Remueve la barra final por seguridad
    },

    isAuthenticated: function() {
        // Doble validación rápida: Que tenga los datos del panel y los del servidor
        const data = localStorage.getItem("AUTH_JSON");
        const serverUrl = localStorage.getItem("server_url");
        
        if (!data || !serverUrl) return false;
        
        try {
            const authData = JSON.parse(data);
            const userInfo = authData.user_info || authData.user;
            return userInfo && userInfo.status === "Active";
        } catch (e) {
            Logger.warn("SM: auth check fail", e);
            return false;
        }
    },

    // ============================================
    // MÉTODOS DEL PANEL / DISPOSITIVO
    // ============================================

    getDeviceId: function() {
        return localStorage.getItem("mi_device_id") || "00:00:00";
    },

    // ============================================
    // LIMPIEZA
    // ============================================

    clearSession: function() {
        // Borramos todas las credenciales de Xtream Codes y del Panel
        localStorage.removeItem("AUTH_JSON");
        localStorage.removeItem("server_url");
        localStorage.removeItem("server_port");
        localStorage.removeItem("iptv_user");
        localStorage.removeItem("iptv_pass");
        Logger.info("SM: session cleared");
    },

    clearAll: function() {
        this.clearSession();
        // NOTA SENIOR: NUNCA borres 'mi_device_id' a menos que sea un "Hard Reset"
        // Si borras el Device ID, la TV generará uno nuevo y el cliente perderá 
        // la vinculación con tu panel administrativo.
        Logger.info("SM: All data cleared");
    }
};