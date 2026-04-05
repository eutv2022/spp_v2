// js/repositories/SeriesRepository.js

import { DataManager } from '../services/dataManager.js';
import { SettingsPreferences } from '../services/SettingsPreferences.js';
import { DB } from '../db/db.js';
import { sessionManager } from '../services/sessionManager.js';
import { Logger } from '../../utils/logger.js';


function formatSecondsToUI(seconds) {
  if (!seconds || isNaN(seconds)) return "00m00s";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}m${String(s).padStart(2, '0')}s`;
}

function normalizeSeriesList(rawList) {
  return rawList.map(s => ({
    nm: s.num,
    n: s.name ? s.name.substring(0, 45) : "Sin Nombre",
    i: s.series_id,
    tmi: s.tmdb_id,
    p: s.cover,
    c: s.category_id,
    r5: s.rating_5based,
    series_id: s.series_id,         
    category_id: s.category_id,     
    name: s.name,
    cover: s.cover,
    last_modified: s.last_modified,
    added: s.added || s.last_modified || 0,
    rating_5based: s.rating_5based
  }));
}

function normalizeSeriesDetails(apiDetails) {
  const info = apiDetails.info || {};
  const episodes = apiDetails.episodes || {};
  const normalizedEpisodes = Object.values(episodes).flat().map(ep => ({
    id: ep.id,
    title: ep.title,
    poster: ep.info?.movie_image || ep.info?.cover || "",
    plot: ep.info?.plot || "",
    e: ep.container_extension || "mkv",
    season: ep.season,
    episode_num: ep.episode_num
  }));

  return {
   n: info.name || "Sin Título",
    p: info.cover || info.poster || "", 
    g: info.genre || "",
    t: info.releaseDate || "", 
    s: info.plot || info.description || "Sinopsis no disponible.",
    r5: info.rating_5based || 0,
    tagline: info.director ? `Director: ${info.director}` : "",
    episodes: normalizedEpisodes
  };
}

export const SeriesRepository = {
  _cachedSeries: null,

  
  syncCategories: async () => {
    try {
      return DataManager.fetchAndSaveSeriesCategories().catch(e => Logger.warn("Series: cat sync fail", e));
    } catch (err) {Logger.warn("Series: sync fail", err);}
  },

  syncSeriesList: async function() {
    this.invalidateCache();
    return DataManager.fetchAndSaveSeriesList().catch(e => Logger.warn("Series: sync fail", e));
  },

 getCategories: async (returnAll = false) => {
  try {
    let categories = await DB.get('series_categories');
    if (Array.isArray(categories) && categories.length > 0) {
       categories.sort((a, b) => (a._data_order || 0) - (b._data_order || 0));
       let cleanList = categories.map(c => ({
           ...c,
           category_id: c.category_id,
           name: c.name || c.category_name || ""
       }));
       if (!returnAll) {
           const hiddenIds = SettingsPreferences.get('hide_series'); 
           if (Array.isArray(hiddenIds) && hiddenIds.length > 0) {
               cleanList = cleanList.filter(c => !hiddenIds.includes(String(c.category_id)));
           }
       }
       return cleanList;
    }
    return [];
    } catch(e) { Logger.error("Series: getCat fail", e); return [];}
  },

  getAllSeries: async function() {
    if (Array.isArray(this._cachedSeries) && this._cachedSeries.length) {
      return this._cachedSeries;
    }
    try {
    const all = await DB.get('series') || [];
    const normalized = normalizeSeriesList(all);
    this._cachedSeries = normalized;
    return this._cachedSeries;
    } catch(e) {Logger.error("Series: getAll fail", e); return [];}
  },

  getSeriesForCategory: async (categoryId) => {
    try {
    let items = await DB.getByIndex('series', 'idx_category', String(categoryId));
    if (!items || items.length === 0) {
         items = await DB.getByIndex('series', 'idx_category', Number(categoryId));
    }
    if (!items || items.length === 0) return [];
    let filtered = normalizeSeriesList(items);
    const sortMode = SettingsPreferences.get('sort_order');
    if (sortMode === 'date_desc') {
      filtered.sort((a, b) => Number(b.added || 0) - Number(a.added || 0));
    } 
    else if (sortMode === 'date_asc') {
      filtered.sort((a, b) => Number(a.added || 0) - Number(b.added || 0));
    }
    else if (sortMode === 'name_asc') {
      filtered.sort((a, b) => (a.n || "").localeCompare(b.n || ""));
    } 
    else if (sortMode === 'name_desc') {
      filtered.sort((a, b) => (b.n || "").localeCompare(a.n || ""));
    }
    return filtered;
    } catch(e) { Logger.error("Series: getByCat fail", e); return []; }
  },

  getSeriesDetails: async (seriesId) => {
    try {
    let details = await DB.getDetails('series_details', seriesId);
    if (details) {
      return details.data; 
    }
    } catch(e) { Logger.warn("Series: cache read fail", e); }
    const apiDetails = await DataManager.fetchSeriesDetails(seriesId);
    if (apiDetails) {
      const normalized = normalizeSeriesDetails(apiDetails);
      await DB.saveDetails('series_details', { id: seriesId, data: normalized }).catch(e => Logger.warn("Series: saveDetails fail", e));
      return normalized;
    }
    return null;
  },

  getStreamUrl: async function(episode, opts = {}) {
    if (!episode) return null;
    if (opts.preferDirectSource && episode.direct_source) {
        return String(episode.direct_source).trim();}
    const authData = sessionManager.getAuthData?.() || {};
    const user = authData.user_info;
    if (!user) return null;
    let baseUrl = window.ApiConfig ? window.ApiConfig.BASE_URL : null;
    if (!baseUrl) {Logger.error("Series: ApiConfig missing"); return null;}
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    const id = episode.id || episode.stream_id;
    const extRaw = episode.container_extension || episode.e || "mkv";
    const extension = `.${String(extRaw).replace(/^\./,'')}`;
    const finalUrl = `${baseUrl}/series/${user.username}/${user.password}/${id}${extension}`;

    return finalUrl;
  },

  search: async function(query, opts = {}) {
    const qRaw = (query || '').toString();
    const q = qRaw.trim().toLowerCase();
    const limit = typeof opts.limit === 'number' ? opts.limit : 500;
    if (!q) return [];
    try {
    const all = await this.getAllSeries();
    if (!Array.isArray(all) || all.length === 0) return [];
    const results = [];
    for (let i = 0; i < all.length && results.length < limit; i++) {
      const it = all[i];
      const name = (it.n || it.name || '').toString().toLowerCase();
      if (name.includes(q)) results.push(it);}

    return results;
    } catch(e) {Logger.error("Series: search fail", e); return [];}
  },

  saveProgress: async (meta, currentTime, duration) => {
      if (!meta.id || !meta.seriesId) return;
      const endThreshold = (duration > 300) ? (duration - 300) : (duration * 0.9);
      let status = 'watching';
      if (currentTime >= endThreshold) status = 'watched';
      if (currentTime < 30) status = 'started';
      const entry = {
          id: String(meta.id),
          parent_id: String(meta.seriesId),
          season: meta.season,
          episode: meta.episode_num,
          time: currentTime,
          duration: duration,
          status: status,
          last_updated: Date.now()
      };

      try {
          await DB.saveDetails('playback_progress', entry);
      } catch (e) { Logger.warn("Series: saveProgress fail", e);}
  },

  getResumeInfo: async (seriesId) => {
    try {
      const progressList = await DB.getByIndex('playback_progress', 'idx_parent', String(seriesId));
      const map = {};
      let lastWatched = null;
      let lastWatching = null;
      if (Array.isArray(progressList)) {
          progressList.sort((a, b) => b.last_updated - a.last_updated);
          progressList.forEach(p => {
              map[p.id] = p;
              if (p.status === 'watching' && !lastWatching) lastWatching = p;
              if (p.status === 'watched' && !lastWatched) lastWatched = p;
          });
      }
      return {
          map: map,
          resume: lastWatching,
          last_seen: lastWatched
      };
      } catch(e) { Logger.warn("Series: getResumeInfo fail", e); return { map: {}, resume: null, last_seen: null };}
  },

  invalidateCache: function() {
    this._cachedSeries = null;
  },

  getResumeButtonData: async function(seriesId) {
    try {
    const info = await this.getResumeInfo(seriesId);
    const activeEp = info.resume; 
    if (!activeEp) {
       return null; 
    }
    const timeStr = formatSecondsToUI(activeEp.time);
    const seasonEpStr = `T${activeEp.season}E${activeEp.episode}`;

    return {
       label: `${seasonEpStr}: ${timeStr}`,
       fullText: `Continuar ${seasonEpStr} (${timeStr})`,
       episodeId: activeEp.id,
       startTime: activeEp.time,
       percent: (activeEp.time / activeEp.duration) * 100
    };
  } catch(e) { Logger.warn("Series: getResumeButtonData fail", e); return null; }
}};