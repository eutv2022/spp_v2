// js/repositories/FavoritesRepository.js
import { DB } from '../db/db.js';
import { Logger } from '../../../utils/logger.js';

const STORE = 'favorites';
const DB_NAME = 'LionTVDatabase';
const DB_VERSION = 3;

function makeKey(id, type) {
  return `${type}-${id}`;
}

function openRawDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onsuccess = (ev) => resolve(ev.target.result);
    req.onerror = (ev) => reject(ev.target.error);
  });
}

export const FavoritesRepository = {

  async getAll() {
    try {
      if (DB && typeof DB.getAll === 'function') {
        const all = await DB.getAll(STORE);
        return Array.isArray(all) ? all : [];
      }

      if (DB && typeof DB.get === 'function') {
        try {
          const maybe = await DB.get(STORE);
          if (Array.isArray(maybe)) return maybe;
        } catch (e) { Logger.debug("FavRepo: DB.get fallback skipped", e);}
      }

      const db = await openRawDB();
      return await new Promise((resolve, reject) => {
        try {
          const tx = db.transaction(STORE, 'readonly');
          const store = tx.objectStore(STORE);
          const req = store.getAll ? store.getAll() : store.openCursor();
          if (store.getAll) {
            req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
            req.onerror = (e) => reject(e.target?.error || e);
          } else {
            const out = [];
            req.onsuccess = (ev) => {
              const cursor = ev.target.result;
              if (cursor) {
                out.push(cursor.value);
                cursor.continue();
              } else {
                resolve(out);
              }
            };
            req.onerror = (e) => reject(e.target?.error || e);
          }
        } catch (err) {
          reject(err);
        }
      });
    } catch (e) {Logger.error('FavRepo: getAll fail', e); return [];}
  },
 async getAllIdsAsSet() {
    try {
      const all = await FavoritesRepository.getAll();
      const s = new Set();
      if (Array.isArray(all)) {
        for (const it of all) {
          if (!it) continue;
          if (it.id) {
            s.add(String(it.id));
            continue;
          }
          if (it.itemId && it.type) {
            s.add(makeKey(String(it.itemId), it.type));
            continue;
          }
        }
      }
      return s;
    } catch (err) {Logger.error('FavRepo: getAllIdsAsSet fail', err); return new Set();}
  },


  async add(item) {
    if (!item || !item.id || !item.type) {
      Logger.warn('FavRepo: add missing id/type', item);
      throw new Error('FavoritesRepository.add: item debe contener id y type');
    }
    const key = makeKey(item.id, item.type);
    const toSave = {
      id: key,
      itemId: String(item.id),
      type: item.type,
      name: item.name || '',
      cover: item.cover || '',
      meta: item.meta || {},
      createdAt: Date.now()
    };

    try {
      await DB.saveDetails(STORE, toSave);
      return true;
    } catch (err) {Logger.error('FavRepo: add fail', err); throw err;}
  },


  async removeByUniqueId(uniqueId) {
    if (!uniqueId) throw new Error('FavoritesRepository.removeByUniqueId: uniqueId requerido');
    try {
      const db = await openRawDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const req = store.delete(uniqueId);
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target?.error || e);
      });
    } catch (err) {Logger.error('FavRepo: removeByUniqueId fail', err); throw err;}
  },


  async remove(id, type) {
    if (!id || !type) {
      throw new Error('FavoritesRepository.remove: requiere id y type');
    }
    const key = makeKey(id, type);
    return await FavoritesRepository.removeByUniqueId(key);
  },

  async exists(id, type) {
    if (!id || !type) return false;
    const key = makeKey(id, type);
    try {
      const db = await openRawDB();
      return await new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readonly');
        const store = tx.objectStore(STORE);
        const req = store.get(key);
        req.onsuccess = () => resolve(Boolean(req.result));
        req.onerror = () => resolve(false);
      });
    } catch (err) {Logger.error('FavRepo: exists fail', err); return false;}
  },

  async get(id, type) {
    if (!id || !type) return null;
    const key = makeKey(id, type);
    try {
      const db = await openRawDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const store = tx.objectStore(STORE);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = (e) => reject(e.target?.error || e);
      });
    } catch (err) {Logger.error('FavRepo: get fail', err); return null;}
  }
};
