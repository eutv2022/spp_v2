// js/services/dataManager.js

import { apiGet, fetchFromTMDB, fetchTmdbMovieVideos as apiFetchTmdbVideos } from '../../../utils/apiModule.js';
import { sessionManager } from './sessionManager.js';
import { Logger } from '../../../utils/logger.js';
import { DB } from '../db/db.js';
import { StatusOverlay } from '../../../utils/StatusOverlay.js';

// Mappers: Se mantienen igual porque tus mappers ya soportan las claves nativas de XUI (stream_id, name, etc)
const Mappers = {
    movies: (m) => ({
        stream_id: m.stream_id || m.i,
        i:   m.stream_id || m.i,
        n:   (m.name || m.n || "").substring(0, 50), 
        p:   m.stream_icon || m.p || "",
        c:   m.category_id || m.c,
        r5:  m.rating_5based || m.r5,
        e:   m.container_extension || m.e,
        tmi: m.tmdb_id || m.tmi,
        ad:  m.added
    }),
    series: (s) => ({
        series_id: s.series_id || s.i,
        name: (s.name || s.n || "").substring(0, 50),
        cover: s.cover || s.p || "",
        category_id: s.category_id || s.c,
        rating: s.rating || s.r,
        last_modified: s.last_modified
    }),
    live_streams: (l) => ({
        stream_id: l.stream_id || l.i,
        name: (l.name || l.n || "").substring(0, 40),
        stream_icon: l.stream_icon || l.p || "",
        category_id: l.category_id || l.c,
        tv_archive: l.tv_archive || l.t || 0,
        num: l.num
    })
};

const inFlight = new Map();

// NOTA: Eliminamos _getAuthParams porque apiModule ya se encarga de inyectar username/password

async function fetchAndSaveGeneric(actionParams, dbKey, labelUI, timeoutMs = 20000) {
    if (inFlight.has(dbKey)) return inFlight.get(dbKey);

    const promise = (async () => {
        const tStart = performance.now();
        if (labelUI) StatusOverlay.show(labelUI);

        try {
            // CAMBIO: Pasamos directamente los parámetros de acción (ej: &action=get_live...)
            // apiModule se encargará de poner la URL base y las credenciales.
            let raw = await apiGet(actionParams, { timeout: timeoutMs });
            
            if (!Array.isArray(raw) || raw.length === 0) {
                Logger.warn(`[DM] 0 items for ${dbKey}.`);
                return []; 
            }
            let data = [];
            if (Mappers[dbKey]) {
                const mapper = Mappers[dbKey];
                let i = raw.length;
                data = new Array(i);
                while (i--) {
                    const item = raw[i];
                    if (item) {
                        const m = mapper(item);
                        m._data_order = i; 
                        data[i] = m;
                    }
                }
                raw = null; 
            } else {
                let i = raw.length;
                while(i--) { if(raw[i]) raw[i]._data_order = i; }
                data = raw;
            }
            const cleanData = data.filter(Boolean); 
            await DB.save(dbKey, cleanData);
            const time = (performance.now() - tStart).toFixed(0);
            Logger.info(`[DM] Synced ${dbKey}: ${cleanData.length} items in ${time}ms`);
            
            // Disparamos evento para avisar a la UI que refresque
            window.dispatchEvent(new CustomEvent('db:updated', { detail: { key: dbKey } }));
            return cleanData;

        } catch (err) {
            Logger.error(`[DM] Error syncing ${dbKey}`, err);
            throw err;
        } finally {
            inFlight.delete(dbKey);
            if (labelUI) StatusOverlay.hide(labelUI);
        }
    })();

    inFlight.set(dbKey, promise);
    return promise;
}

export const DataManager = {
    // CAMBIO MASIVO: Rutas del Proxy (/v1/...) reemplazadas por Acciones de XUI (&action=...)
    
    fetchAndSaveLiveCategories:   () => fetchAndSaveGeneric('&action=get_live_categories', 'live_categories'),
    fetchAndSaveMovieCategories:  () => fetchAndSaveGeneric('&action=get_vod_categories', 'movie_categories'),
    fetchAndSaveSeriesCategories: () => fetchAndSaveGeneric('&action=get_series_categories', 'series_categories'),
    
    fetchAndSaveLiveStreams:      () => fetchAndSaveGeneric('&action=get_live_streams', 'live_streams', 'Actualizando Live TV...', 40000),
    fetchAndSaveMoviesList:       () => fetchAndSaveGeneric('&action=get_vod_streams', 'movies', 'Actualizando Películas...', 60000),
    fetchAndSaveSeriesList:       () => fetchAndSaveGeneric('&action=get_series', 'series', 'Actualizando Series...', 60000),

    fetchVodInfo: async (vodId) => {
        if (!vodId) return null;
        try { 
            // XUI requiere 'vod_id' para info de películas
            const ep = `&action=get_vod_info&vod_id=${vodId}`;
            const raw = await apiGet(ep);
            
            // XUI devuelve { info: {...}, movie_data: {...} }
            if (!raw?.info) return null;

            return {
                i:   parseInt(raw.movie_data?.stream_id || vodId),
                n:   String(raw.info.name || "").trim(),
                p:   raw.info.movie_image || raw.info.cover || "",
                s:   raw.info.plot || raw.info.description || "",
                d:   raw.info.duration || "",
                t:   raw.info.releasedate || "",
                g:   raw.info.genre || "",
                dr:  raw.info.director || "",
                ca:  raw.info.cast || "",
                yt:  raw.info.youtube_trailer || "",
                r5:  raw.info.rating_5based || 0,
                e:   raw.movie_data?.container_extension,
            };
        } catch(e) { Logger.error("fetchVodInfo error", e); return null; }
    },
    
    fetchSeriesDetails: async (seriesId) => {
        if (!seriesId) return null;
        try { 
            // XUI requiere 'series_id' para info de series
            const ep = `&action=get_series_info&series_id=${seriesId}`;
            return await apiGet(ep); 
        } catch(e) { Logger.error("fetchSeriesDetails error", e); return null; }
    },

    // --- TMDB (Sin cambios, va por fuera) ---
    fetchTmdbMovieDetails: async (tmdbId) => {
        try { return await fetchFromTMDB(`/movie/${tmdbId}`, { append_to_response: 'credits,videos' }); } 
        catch { return null; }
    },
    
    fetchTmdbMovieVideos: async (tmdbId) => {
       try { return await apiFetchTmdbVideos(tmdbId); } catch { return null; }
    },

    ensureFetched: (key) => {
        const map = {
            movies: DataManager.fetchAndSaveMoviesList,
            series: DataManager.fetchAndSaveSeriesList,
            live_streams: DataManager.fetchAndSaveLiveStreams,
            movie_categories: DataManager.fetchAndSaveMovieCategories,
            live_categories: DataManager.fetchAndSaveLiveCategories,
            series_categories: DataManager.fetchAndSaveSeriesCategories
        };
        return map[key] ? map[key]() : null;
    },

    clearAllData: async () => {
        try {
            await DB.deleteDatabase();
            localStorage.clear();
            Logger.info("[DM] Sistema limpio.");
            return true;
        } catch (e) {
            Logger.error("[DM] Error en borrado nuclear", e);
            return true;
        }
    }
};