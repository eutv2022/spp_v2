// Utils/apiModule.js
import { Logger } from './logger.js';

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_API_KEY = "58d45b70f6e7483ed3caaa69b740ef3d"; 
const DEFAULT_TIMEOUT = 15000;

function fetchWithTimeout(resource, options = {}) {
  const { timeout = DEFAULT_TIMEOUT } = options;
  return Promise.race([
      fetch(resource, options),
      new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), timeout)
      )
  ]);
}

/**
 * 1. OBTENER URL BASE DIRECTO DEL LOCALSTORAGE
 */
function getBaseUrl() {
    const serverUrl = localStorage.getItem('server_url');
    if (!serverUrl) {
        Logger.warn('[ApiModule] No hay server_url en localStorage. La app no está logeada.');
        return ""; 
    }
    return serverUrl.replace(/\/$/, ""); // Quitamos la barra final por seguridad
}

/**
 * 2. OBTENER CREDENCIALES DIRECTO DEL LOCALSTORAGE
 * Las llaves exactas que inyectará nuestro puente
 */
function getAuthParams() {
    const u = localStorage.getItem('iptv_user');
    const p = localStorage.getItem('iptv_pass');
    
    if (u && p) {
        return `username=${u}&password=${p}`;
    }
    return '';
}

/**
 * 3. MOTOR PRINCIPAL DE LLAMADAS GET A XTREAM CODES
 */
export async function apiGet(actionParams, customOptions = {}) {
  try {
    const baseUrl = getBaseUrl();
    const auth = getAuthParams();
    
    if (!baseUrl || !auth) {
        throw new Error("Credenciales faltantes. El usuario debe pasar por la pantalla de vinculación.");
    }

    let url;

    // Construcción inteligente de la URL
    if (actionParams.includes('player_api.php') || actionParams.includes('api.php')) {
        // Si el parámetro ya trae el archivo base (usualmente el primer login que hace la app)
        const separator = actionParams.includes('?') ? '&' : '?';
        url = `${baseUrl}/${actionParams.replace(/^\//, '')}${separator}${auth}`;
    } else {
        // Llamadas estándar (ej: action=get_live_categories)
        // Nos aseguramos de inyectar player_api.php siempre
        const cleanAction = actionParams.replace(/^\?|&/, "");
        const separator = cleanAction ? '&' : '';
        url = `${baseUrl}/player_api.php?${auth}${separator}${cleanAction}`;
    }

    const options = {
        method: 'GET',
        ...customOptions 
    };

    // Logger.debug(`[ApiModule] Fetching: ${url}`); // Descomenta para debugear

    const response = await fetchWithTimeout(url, options);
    
    if (!response.ok) throw new Error(`GET failed: ${response.status}`);
    return await response.json();

  } catch (error) {
    Logger.error(`API GET fail: ${actionParams}`, error);
    throw error; 
  }
}

/**
 * 4. FUNCIONES DE TMDB (SE MANTIENEN INTACTAS)
 */
export async function fetchFromTMDB(path, params = {}) {
  try {
    const query = new URLSearchParams({
        api_key: TMDB_API_KEY,
        language: 'es-ES',
        ...params 
    });
    const url = `${TMDB_BASE_URL}${path}?${query.toString()}`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error(`TMDB ${path} failed: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    Logger.warn("TMDB fetch fail", error);
    throw error; 
  }
}

export async function fetchTmdbMovieVideos(tmdbId) {
    if (!tmdbId) return null;
    const url = `${TMDB_BASE_URL}/movie/${tmdbId}/videos?api_key=${TMDB_API_KEY}`;
    try {
        const response = await fetchWithTimeout(url);
        if (!response.ok) throw new Error(`TMDB Videos failed: ${response.status}`);
        return await response.json();
    } catch (err) {
        Logger.warn("TMDB fetch fail", err);
        return null;
    }
}