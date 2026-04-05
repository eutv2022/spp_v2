// Utils/apiModule.js
import { Logger } from './logger.js';

// Intentamos leer la URL configurada por ConfigLoader, si no, usamos la default
const storedUrl = sessionStorage.getItem('API_BASE_URL');

const ApiConfig = {
    BASE_URL: storedUrl || "http://liontv.es:8080", 
    TIMEOUT: 15000,
    VERSION: "1.0.0"
};
window.ApiConfig = ApiConfig; 

Logger.debug(`[ApiModule] Base URL: ${ApiConfig.BASE_URL}`);

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

// Función para recuperar usuario/contraseña
function getAuthParams() {
    // 1. Intentamos leer de localStorage directo (lo más seguro)
    const u = localStorage.getItem('username');
    const p = localStorage.getItem('password');
    if (u && p) return `username=${u}&password=${p}`;

    // 2. Si no, intentamos leer del AUTH_JSON (backup)
    const json = localStorage.getItem('AUTH_JSON');
    if (json) {
        try {
            const parsed = JSON.parse(json);
            const info = parsed.user_info || parsed.user;
            if (info && info.username && info.password) {
                return `username=${info.username}&password=${info.password}`;
            }
        } catch (e) {}
    }
    
    return '';
}

export async function apiGet(actionParams, customOptions = {}) {
  try {
    const auth = getAuthParams();
    let url;

    // --- LÓGICA DE CONSTRUCCIÓN DE URL (CORREGIDA) ---
    
    // Si la URL base termina en slash, se lo quitamos para evitar duplicados
    const baseUrl = ApiConfig.BASE_URL.replace(/\/$/, "");

    if (actionParams.includes('player_api.php')) {
        // Caso A: Ya viene la ruta completa (ej: login inicial)
        url = `${baseUrl}${actionParams}`;
    } else {
        // Caso B: Son parámetros sueltos (ej: &action=get_live_categories)
        // AQUÍ ES DONDE ESTABA EL ERROR. Agregamos /player_api.php?
        
        // Nos aseguramos de que haya un '?' antes de los params
        const separator = auth ? '&' : ''; 
        url = `${baseUrl}/player_api.php?${auth}${separator}${actionParams.replace(/^\?|&/, "")}`;
    }

    const options = {
        method: 'GET',
        ...customOptions 
    };

    // Logger.debug(`API Call: ${url}`); // Descomenta si quieres ver la URL completa

    const response = await fetchWithTimeout(url, options);
    
    if (!response.ok) throw new Error(`GET failed: ${response.status}`);
    return await response.json();

  } catch (error) {
    Logger.error(`API GET fail: ${actionParams}`, error);
    throw error; 
  }
}

export async function apiPost(endpoint, data) {
  try {
    const baseUrl = ApiConfig.BASE_URL.replace(/\/$/, "");
    const url = `${baseUrl}${endpoint}`;
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`POST ${endpoint} failed`);
    return await response.json();
  } catch (error) {
    Logger.error(`API POST fail: ${endpoint}`, error);
    throw error;
  }
}

// --- TMDB (IGUAL QUE SIEMPRE) ---
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