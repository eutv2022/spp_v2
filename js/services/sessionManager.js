// js/sessionManager.js (Versión Final - Directo a Server)
import { Logger } from '../../utils/logger.js';

export const sessionManager = {
    /**
     * @param {object} authJson
     */
    createSession: function(authJson) {
        try {
            localStorage.setItem("AUTH_JSON", JSON.stringify(authJson));
            Logger.info("SM: init ok");
        } catch (e) {Logger.error("SM: write fail", e);}
    },

    /**
     * @returns {object|null}
     */
    getAccountInfo: function() {
        const data = localStorage.getItem("AUTH_JSON");
        if (!data) return null;
        try {
            return JSON.parse(data).user_info;
        } catch (e) {Logger.error("SM: parse err", e); return null;}
    },

    getAuthData: function() {
        const data = localStorage.getItem("AUTH_JSON");
        try {
            return data ? JSON.parse(data) : null;
        } catch (e) {Logger.debug("SM: getAuthData fail", e); return null;}
    },

    // CAMBIO IMPORTANTE AQUÍ
    getContentBaseUrl: function() {
        const authData = this.getAuthData();
        if (!authData) return null;
        if (!authData.user_info) return null;
        
        // Ya no usamos user_info aquí dentro para la URL base, 
        // porque la estructura de XUI varía si es live o movie.
        // Devolvemos la RAÍZ del servidor.
        
        const protocol = "http"; // El servidor no tiene SSL
        const url = "liontv.es:8080"; 
        
        // Retornamos la base limpia: "http://liontv.es:8080/"
        // El reproductor se encargará de añadir: "movie/user/pass/123.mp4"
        return `${protocol}://${url}/`;
    },

    /**
     * @returns {boolean}
     */
    isAuthenticated: function() {
        const data = localStorage.getItem("AUTH_JSON");
        if (!data) return false;
        try {
            const authData = JSON.parse(data);
            return authData && authData.user_info && authData.user_info.status === "Active";
        } catch (e) { Logger.warn("SM: auth check fail", e); return false;}
    },

    clearSession: function() {
        localStorage.removeItem("AUTH_JSON");
        Logger.info("SM: clear");
    }
};