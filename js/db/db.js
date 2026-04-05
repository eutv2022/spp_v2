// js/db/db.js
import { Logger } from '../../utils/logger.js';

const DB_NAME = 'LionDB';
const DB_VERSION = 1;

let _dbPromise = null;
let _dbReadyResolve;
const _dbReady = new Promise((res) => { _dbReadyResolve = res; });
function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const createStore = (name, keyPath, indexName, indexKey) => {
          if (db.objectStoreNames.contains(name)) {
              db.deleteObjectStore(name); 
          }
          const store = db.createObjectStore(name, { keyPath: keyPath });
          if (indexName && indexKey) {
              store.createIndex(indexName, indexKey, { unique: false });
          }
      };
      createStore('live_categories', 'category_id', 'idx_order', '_data_order');
      createStore('movie_categories', 'category_id', 'idx_order', '_data_order');
      createStore('series_categories', 'category_id', 'idx_order', '_data_order');
      createStore('movies', 'stream_id', 'idx_category', 'c'); 
      createStore('live_streams', 'stream_id', 'idx_category', 'category_id');
      createStore('series',       'series_id', 'idx_category', 'category_id');
      createStore('playback_progress', 'id', 'idx_parent', 'parent_id');
      createStore('series_details', 'id');
      createStore('movie_details', 'stream_id');
      createStore('movie_details_tmdb', 'id');
      createStore('favorites', 'id');
      createStore('history', 'uniqueId');
      createStore('home_carousel', 'uniqueId');
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      db.onversionchange = () => {
        try { db.close(); } catch (e) {Logger.warn('[DB] Database version conflict', e); }
        _dbPromise = null;
      };
      db.onclose = () => { _dbPromise = null; };
      try { _dbReadyResolve(true); } catch (e) {Logger.warn('[DB] Error resolving DB ready', e); }
      Logger.debug('[DB] Connection open (v' + DB_VERSION + ')');
      resolve(db);
    };

    request.onerror = (event) => {
      _dbPromise = null;
      try { _dbReadyResolve(false); } catch(e) {Logger.warn('[DB] Error resolving DB ready', e); }
      Logger.error('[DB] Open Error:', event?.target?.error);
      reject(event.target.error);
    };

    request.onblocked = () => {
      _dbPromise = null;
      Logger.warn('[DB] Connection blocked. Close other tabs.');
    };
  });
  return _dbPromise;
}

export const DB = {
  getByIndex: async (storeName, indexName, value) => {
    try {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readonly');
    const index = tx.objectStore(storeName).index(indexName);
    const request = index.getAll(String(value)); 
    return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve([]);
    });
    } catch (e) { Logger.error(`[DB] getByIndex error (${storeName})`, e); return []; }
  },

  save: async (storeName, items) => {
    try {
    const db = await openDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    store.clear();

    for (const item of items) {
      store.put(item);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        Logger.debug(`[DB] Saved ${items.length} items to "${storeName}"`);
        resolve(true);
      };
      transaction.onerror = (event) => reject(event.target.error);
    });
    } catch (e) {Logger.error(`[DB] save error (${storeName})`, e); return false; }
  },


  get: async (storeName) => {
    try {
    const db = await openDB();
    const store = db.transaction(storeName, 'readonly').objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(event.target.error);
    });
    } catch (e) { Logger.error(`[DB] get error (${storeName})`, e); return [];}
  },

  delete: async (storeName, key) => {
    try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target?.error || e);
      } catch (e) {
        reject(e);
      }
    });
    } catch (e) {Logger.error(`[DB] delete error (${storeName})`, e); return false;}
  },

  saveDetails: async (storeName, item) => {
    try {
    const db = await openDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    store.put(item);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = (event) => reject(event.target.error);
    });
    } catch (e) { Logger.error(`[DB] saveDetails error (${storeName})`, e); return false; }
  },

  getByKey: async (storeName, key) => {
    try {
    const db = await openDB();
    const store = db.transaction(storeName, 'readonly').objectStore(storeName);
    const candidates = [key];
    if (typeof key === 'string' && /^\d+$/.test(key)) candidates.push(Number(key));

    return new Promise((resolve, reject) => {
      (function tryNext(idx) {
        if (idx >= candidates.length) {
          const requestAll = store.getAll();
          requestAll.onsuccess = () => {
            const all = requestAll.result || [];
            const found = all.find(item => {
              return (
                String(item.stream_id) === String(key) ||
                String(item.id) === String(key) ||
                String(item.movie_id) === String(key)
              );
            });
            resolve(found || null);
          };
          requestAll.onerror = (e) => reject(e.target?.error || e);
          return;
        }
        const req = store.get(candidates[idx]);
        req.onsuccess = () => {
          if (req.result !== undefined) {
            resolve(req.result);
          } else {
            tryNext(idx + 1);
          }
        };
        req.onerror = () => {
          tryNext(idx + 1);
        };
      })(0);
    });
    } catch (e) {Logger.error(`[DB] getByKey error (${storeName})`, e); return null;}
  },


  getDetails: async (storeName, id) => {
    try {
    const db = await openDB();
    const store = db.transaction(storeName, 'readonly').objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(event.target.error);
    });
    } catch (e) {Logger.error(`[DB] getDetails error (${storeName})`, e); return null;}
  },

  count: async (storeName) => {
    try {
    const db = await openDB();
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.count(); // Método nativo de IndexedDB
      request.onsuccess = () => resolve(request.result); // Devuelve el número (ej: 500)
      request.onerror = (event) => reject(event.target.error);
    });
    } catch (e) {Logger.error(`[DB] count error (${storeName})`, e);return 0;}
  },
  
  clearContent: async function() {
    const db = await openDB();
    Logger.info("[DB] 🧹 Limpiando contenido (Refresh)...");

    // Lista de tablas a borrar (NO incluimos favorites ni history)
    const stores = [
        'live_streams', 'live_categories',
        'movies', 'movie_categories', 'movie_details', 'movie_details_tmdb',
        'series', 'series_categories', 'series_details',
        'home_carousel'
    ];
    
    const promises = stores.map(storeName => {
        return new Promise((resolve) => {
            if (!db.objectStoreNames.contains(storeName)) return resolve();
            try {
                const tx = db.transaction([storeName], 'readwrite');
                const req = tx.objectStore(storeName).clear();
                req.onsuccess = () => resolve();
                req.onerror = () => resolve(); 
            } catch (e) { Logger.warn('[DB] Error clearing store', e); resolve(); }
        });
    });

    await Promise.all(promises);
    Logger.info("[DB] ✔️ Contenido actualizado. Favoritos intactos.");
    return true;
  },

  deleteDatabase: async () => {
    Logger.warn("[DB] ☢️ BORRADO NUCLEAR...");
    if (_dbPromise) {
        try { 
            const db = await _dbPromise; 
            db.close(); 
        } catch(e) { Logger.warn('Error al cerrar conexión previa', e);}
        _dbPromise = null;
    }
    return new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase(DB_NAME);

        req.onsuccess = () => { Logger.info("Base de datos eliminada.");
            resolve(true);
        };

        req.onerror = (event) => {Logger.error("System purge failed", event.target.error);
            reject(event.target.error);
        };

        req.onblocked = () => { Logger.warn("Operación bloqueada: Reintentar");
        };
    });
  },

  ready: () => _dbReady,
};
