// utils/storage.js
import { Logger } from './logger.js';

export const Storage = {
  set: (key, value) => {
    try {
      const serialized = JSON.stringify(value);
      if (typeof tizen !== "undefined" && tizen.preference) {
        tizen.preference.setValue(key, serialized);
      } else {
        localStorage.setItem(key, serialized);
      }
    } catch (error) { Logger.error(`Storage: Error saving ${key}`, "STORAGE", error);}
  },

  get: (key) => {
        try {
            let raw = null;
            if (typeof tizen !== "undefined" && tizen.preference) {
                try {
                    raw = tizen.preference.getValue(key);
                } catch (e) { Logger.warn(`Storage: Tizen preference ${key} not found`, e);
                    return null;
                }
            } else {
                raw = localStorage.getItem(key);
            }
            if (!raw) return null;
            try {
                return JSON.parse(raw);
            } catch (e) {
                Logger.warn(`Storage: Corrupt data in ${key}, removing...`, e);
                Storage.remove(key);
                return null;
            }
        } catch (error) { Logger.error(`Storage: Error getting ${key}`, "STORAGE", error); return null;}
    },

  remove: (key) => {
    try {
      if (typeof tizen !== "undefined" && tizen.preference) {
        if (tizen.preference.exists(key)) {
          tizen.preference.remove(key);
        }
      } else {
        localStorage.removeItem(key);
      }
    } catch (error) {
      Logger.error(`Storage: Error removing ${key}`, "STORAGE", error);
    }
  },

  clearAll: () => {
    try {
      if (typeof tizen !== "undefined" && tizen.preference) {
        const keys = tizen.preference.getAllKeys() || [];
       keys.forEach(k => {
                    try { tizen.preference.remove(k); } catch (e) {Logger.warn(`Storage: Failed to remove ${k}`, e);}
                });
            } else {
                localStorage.clear();
            }
            Logger.info("Storage: All data cleared", "STORAGE");
    } catch (error) {
      Logger.error("Storage: Clear all failed", "STORAGE", error);
    }
  }
};
