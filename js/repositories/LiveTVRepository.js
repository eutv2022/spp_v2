// js/repositories/LiveTVRepository.js

import { DataManager } from '../services/dataManager.js';
import { DB } from '../db/db.js';
import { sessionManager } from '../services/sessionManager.js';
import { SettingsPreferences } from '../services/SettingsPreferences.js';
import { Logger } from '../../utils/logger.js';



const normalizeStream = (s) => ({
    num: s.nm || s.num,
    name: s.n || s.name || "Canal Sin Nombre",
    stream_id: s.i || s.stream_id,
    stream_icon: s.p || s.stream_icon,
    category_id: s.c || s.category_id,
    tv_archive: s.t || s.tv_archive || 0,
    container_extension: s.e || s.container_extension || "ts",
    direct_source: s.direct_source
});

export const LiveTVRepository = {
  _cachedStreams: null,

  syncCategories: async () => {
    return DataManager.fetchAndSaveLiveCategories().catch(e => Logger.warn("LiveTVRepo: syncCategories fail", e));
  },

  syncStreams: async () => {
    try {
      LiveTVRepository.invalidateCache();  

    return DataManager.fetchAndSaveLiveStreams();      
    } catch (err) {
      Logger.warn("LiveTVRepo: syncStreams fail", err);
    }
  },

  getCategories: async (returnAll = false) => {
    try {
    let categories = await DB.get('live_categories');
    if (Array.isArray(categories) && categories.length > 0) {
      categories.sort((a, b) => (a._data_order || 0) - (b._data_order || 0));
      let cleanList = categories.map(c => ({
          ...c,
          name: c.name || c.category_name || ""
      }));
      if (!returnAll) {
          const hiddenIds = SettingsPreferences.get('hide_live'); 
          if (Array.isArray(hiddenIds) && hiddenIds.length > 0) {
               cleanList = cleanList.filter(c => !hiddenIds.includes(String(c.category_id)));
          }
      }

      return cleanList;
    }
    return [];
    } catch(e) {Logger.error("LiveTVRepo: getCategories fail", e); return [];}
  },

  getAllStreams: async function() {
    if (Array.isArray(this._cachedStreams) && this._cachedStreams.length) {
      return this._cachedStreams;
    }
    try {
    const all = await DB.get('live_streams');
    if (Array.isArray(all) && all.length > 0) {
        this._cachedStreams = all.map(normalizeStream);
        return this._cachedStreams;
    }
    return [];
    } catch(e) {Logger.error("LiveTVRepo: getAllStreams fail", e); return [];}
  },
  
 getStreamsForCategory: async (categoryId) => {
  try {
    let items = await DB.getByIndex('live_streams', 'idx_category', String(categoryId));
    if (!items || items.length === 0) {
         items = await DB.getByIndex('live_streams', 'idx_category', Number(categoryId));
    }
    if (!items || items.length === 0) return [];
    let filtered = items.map(normalizeStream);
    const sortMode = SettingsPreferences.get('sort_order');
    if (sortMode === 'date_desc') {
        filtered.sort((a, b) => Number(b.added || 0) - Number(a.added || 0));
    } 
    else if (sortMode === 'name_asc') {
        filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } 
    else if (sortMode === 'name_desc') {
        filtered.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
    }
    else {
        filtered.sort((a, b) => (Number(a.num) || 0) - (Number(b.num) || 0));
    }
    return filtered;
    } catch(e) {Logger.error("LiveTVRepo: getStreamsForCategory fail", e); return [];}
  },

  getStreamByNum: async function(channelNum) {
    const num = Number(channelNum);
    if (isNaN(num)) return null;
    const allStreams = await this.getAllStreams();
    return allStreams.find(s => Number(s.num) === num) || null;
  },

  getStreamById: async function(streamId) {
    const allStreams = await this.getAllStreams();
    if (!allStreams) return null;
    return allStreams.find(s => String(s.stream_id) === String(streamId)) || null;
  },

getStreamUrl: async function(stream, opts = {}) {
    if (!stream) return null;
    if (opts.preferDirectSource && stream.direct_source) return String(stream.direct_source).trim();
    const authData = sessionManager.getAuthData?.() || {};
    const user = authData.user_info;
    if (!user || !user.username || !user.password) return null;

    let baseUrl = window.ApiConfig ? window.ApiConfig.BASE_URL : null;

    if (typeof ApiConfig === 'undefined' || !baseUrl) {
        Logger.error("LiveTV: ApiConfig missing");
        return null;
    }
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    const id = stream.stream_id || stream.i; 
    const userFormat = SettingsPreferences.get('stream_format'); 
    let extension = userFormat ? `.${userFormat}` : '.ts'; 
    if (!userFormat && (stream.container_extension || stream.e)) {
        extension = `.${String(stream.container_extension || stream.e).replace(/^\./,'')}`;
    }
    const finalUrl = `${baseUrl}/live/${user.username}/${user.password}/${id}${extension}`;
    Logger.debug(`LiveTVRepo: stream URL generated -> ${id}`);
    return finalUrl;
},

  getChannelWindow: async function(centerNum, windowSize = 5) {
    const num = Number(centerNum);
    if (isNaN(num)) return [];

    const startNum = num - windowSize;
    const endNum = num + windowSize;

    const allStreams = await this.getAllStreams();
    if (!allStreams) return [];

    const window = allStreams.filter(s => {
      const sNum = Number(s.num);
      return sNum >= startNum && sNum <= endNum;
    });

    window.sort((a, b) => Number(a.num) - Number(b.num));
    return window;
  },
  getCategoryPlaylist: async function(categoryId) {
    if (!categoryId) return [];
        
    let items = await DB.getByIndex('live_streams', 'idx_category', String(categoryId));
    
    if (!items || items.length === 0) {
        items = await DB.getByIndex('live_streams', 'idx_category', Number(categoryId));
    }

    if (!items || items.length === 0) return [];

    if (items.length > 3000) {
        Logger.debug(`LiveTVRepo: category too big (${items.length}), slicing.`);
        items = items.slice(0, 3000);
    }

    items.sort((a, b) => Number(a.num) - Number(b.num));
    const optimizedList = items.map(item => ({
        stream_id: item.stream_id,
        num: item.num,
        name: item.name || item.n, 
        stream_icon: item.stream_icon || item.p,
        container_extension: item.container_extension || item.e || "ts"
    }));
    
    return optimizedList;
  },
  search: async function(query, opts = {}) {
    const qRaw = (query || '').toString();
    const q = qRaw.trim().toLowerCase();
    const limit = typeof opts.limit === 'number' ? opts.limit : 500;
    
    if (!q) return [];

    const all = await this.getAllStreams();
    if (!Array.isArray(all) || all.length === 0) return [];

    const results = [];
    for (let i = 0; i < all.length && results.length < limit; i++) {
      const it = all[i];
      const name = (it.name || '').toString().toLowerCase();
      if (name.includes(q)) results.push(it);
    }
    return results;
  },

  invalidateCache: function() {
    this._cachedStreams = null;
  }
};