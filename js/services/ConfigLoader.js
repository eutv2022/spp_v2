// js/services/ConfigLoader.js
import { Logger } from '../../utils/logger.js';

// MODO PC: No consultamos URL remota para evitar que se active el "Modo Review".
const HARDCODED_CONFIG = {
    status: "active",               // <--- ESTO ES LA CLAVE. Siempre "active".
    worker_url: "http://liontv.es:8080", // Tu servidor real
    message: ""
};

export const ConfigLoader = {
    load: async () => {
        Logger.info("[Config] MODO PC: Usando configuración Local Forzada.");

        // Cambiamos sessionStorage por localStorage para persistencia real
        localStorage.setItem('API_BASE_URL', HARDCODED_CONFIG.worker_url);

        return HARDCODED_CONFIG;
    }
};