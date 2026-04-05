// js/repositories/MoviesRepository.js

import { DataManager } from '../services/dataManager.js';
import { SettingsPreferences } from '../services/SettingsPreferences.js';
import { DB } from '../db/db.js';
import { sessionManager } from '../services/sessionManager.js';
import { Logger } from '../../utils/logger.js';

export const MoviesRepository = {
  _cachedMovies: null, 
  syncMoviesList: async function() {
    this.invalidateCache();
    return DataManager.fetchAndSaveMoviesList().catch(e => Logger.warn("Movies: sync fail", e));
  },

  syncCategories: async () => {
    return DataManager.fetchAndSaveMovieCategories().catch(e => Logger.warn("Movies: cat sync fail", e));
  },

  getAllMovies: async function() {
    if (this._cachedMovies && this._cachedMovies.length > 0) return this._cachedMovies;
    try {
        const all = await DB.get('movies'); 
        if (all && all.length > 0) {
            this._cachedMovies = all;

            return this._cachedMovies;
    }
    return [];
    } catch(e) {Logger.error("Movies: getAll fail", e); return [];}
  },

  getMoviesForCategory: async function(categoryId) {
    try {
        let items = await DB.getByIndex('movies', 'idx_category', String(categoryId));  
        if (!items || items.length === 0) {
            items = await DB.getByIndex('movies', 'idx_category', Number(categoryId));
        }
        if (!items || items.length === 0) return [];
        const sortMode = SettingsPreferences.get('sort_order');
        const list = [...items];
        if (sortMode === 'date_desc') {
            list.sort((a, b) => Number(b.ad|| 0) - Number(a.ad|| 0));
        } else if (sortMode === 'date_asc') {
            list.sort((a, b) => Number(a.ad || 0) - Number(b.ad || 0));
        } else if (sortMode === 'name_asc') {
            list.sort((a, b) => (a.n || "").localeCompare(b.n|| ""));
        } else if (sortMode === 'name_desc') {
            list.sort((a, b) => (b.n || "").localeCompare(a.n || ""));
        }
    return list;
    } catch(e) {Logger.error("Movies: getByCat fail", e); return [];}
  },

  getCategories: async (returnAll = false) => {
    try {
    let categories = await DB.get('movie_categories');
    if (Array.isArray(categories) && categories.length > 0) {
       categories.sort((a, b) => (a._data_order || 0) - (b._data_order || 0));
       let cleanList = categories.map(c => ({
           category_id: c.category_id,
           name: c.name || c.category_name || ""
       }));
       if (!returnAll) {
           const hiddenIds = SettingsPreferences.get('hide_movies');
           if (Array.isArray(hiddenIds) && hiddenIds.length > 0) {
               cleanList = cleanList.filter(c => !hiddenIds.includes(String(c.category_id)));
           }
       }
       return cleanList;
    }
    return [];
    } catch(e) {Logger.error("Movies: getCategories fail", e); return [];}
  },

  invalidateCache: function() {
    this._cachedMovies = null;
  },
  
  getMoviesPage: async function(page = 0, size = 15) {
    const all = await this.getAllMovies();
    const start = page * size;
    return all.slice(start, start + size);
  },

  getMovieDetails: async (vodId, tmdbId) => {
    if (!vodId) return null;
    const cleanId = Number(vodId);
    try {
        const cachedEntry = await DB.getDetails('movie_details', cleanId);

        if (cachedEntry && cachedEntry.data && cachedEntry.data.n) {
            return cachedEntry.data;
        }
    } catch (err) {
        Logger.warn("Movies: cache read fail", err);
    }
    let details = await DataManager.fetchVodInfo(cleanId);
    if (!details) return null;
    const detectedTmdb = details.tmi || tmdbId;
    if (detectedTmdb) {
       try {
        const t = await DataManager.fetchTmdbMovieDetails(detectedTmdb);
        if (t) {
            if (t.overview && (!details.s || details.s.length < 10)) details.s = t.overview;
            if (t.tagline) details.tagline = t.tagline;
            if(t.credits) {
                 const d = t.credits.crew.find(c => c.job === "Director");
                 if(d) details.dr = { n: d.name, p: d.profile_path };
                 details.ca = t.credits.cast.slice(0, 12).map(c => ({
                     n: c.name, 
                     ch: c.character, 
                     p: c.profile_path
                 }));
            }
            if (t.videos) details.yt = t.videos;
        }
       } catch(e){Logger.warn("Movies: TMDB fail", e);}
    }
    if (details.n) {
      const entryToSave = {
          stream_id: cleanId,
          data: details,
          last_updated: Date.now()
      };
      DB.saveDetails('movie_details', entryToSave).catch(e => Logger.warn("Movies: saveDetails fail", e));
    }
    return details;
  },

  getStreamUrl: async function(movie, opts = {}) {
    if (!movie) return null;
    if (opts.preferDirectSource && movie.direct_source) {
        return String(movie.direct_source).trim();
    }
    const authData = sessionManager.getAuthData?.() || {};
    const user = authData.user_info;
    if (!user) return null;
    let baseUrl = window.ApiConfig ? window.ApiConfig.BASE_URL : null;
    if (!baseUrl) { Logger.error("Movies: ApiConfig missing"); return null;}
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    const id = movie.i || movie.stream_id;
    let rawExt = movie.e || movie.container_extension || movie.extension;
    if (!rawExt) rawExt = 'mp4'; 
    const extension = String(rawExt).startsWith('.') ? rawExt : `.${rawExt}`;
    const finalUrl = `${baseUrl}/movie/${user.username}/${user.password}/${id}${extension}`;
    return finalUrl;
  },

  saveProgress: async (meta, currentTime, duration) => {
      const id = meta.i || meta.id || meta.stream_id;
      if (!id) return;
      const endThreshold = (duration > 300) ? (duration - 300) : (duration * 0.95);
      let status = 'watching';
      if (currentTime >= endThreshold) status = 'watched';
      if (currentTime < 10) status = 'started'; 
      const entry = {
          id: String(id),
          parent_id: "movies",
          time: currentTime,
          duration: duration,
          status: status,
          last_updated: Date.now()
      };

      try {
          await DB.saveDetails('playback_progress', entry);
      } catch (e) { Logger.warn("Movies: saveProgress fail", e); }
  },

  getResumeInfo: async (vodId) => {
      try {
          const entry = await DB.getDetails('playback_progress', String(vodId));
          if (entry && entry.status === 'watching') {
              return entry;
          }
      } catch (e) {Logger.warn("Movies: getResumeInfo fail", e);}
      return null;
  },
  
  search: async function(query, opts = {}) {
     const q = (query||'').toLowerCase().trim();
     if(!q) return [];
     try {
     const all = await this.getAllMovies();
    return all.filter(m => (m.n || '').toLowerCase().includes(q)).slice(0, opts.limit||50);}
    catch (e) {Logger.error("Movies: search fail", e); return [];}}
};