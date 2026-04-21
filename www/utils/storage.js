// utils/storage.js
import { Logger } from './logger.js';

// Lista VIP: Llaves que NUNCA deben borrarse a menos que desinstales la app
const PROTECTED_KEYS = ['mi_device_id', 'lion_legal_accepted'];

export const Storage = {
  set: (key, value) => {
    try {
      // Si ya es un string básico, no lo doble-codificamos, lo guardamos directo
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (typeof tizen !== "undefined" && tizen.preference) {
        tizen.preference.setValue(key, serialized);
      } else {
        localStorage.setItem(key, serialized);
      }
    } catch (error) { 
        Logger.error(`Storage: Error saving ${key}`, "STORAGE", error);
    }
  },

  get: (key) => {
        try {
            let raw = null;
            if (typeof tizen !== "undefined" && tizen.preference) {
                try {
                    raw = tizen.preference.getValue(key);
                } catch (e) { 
                    // Logger.warn(`Storage: Tizen preference ${key} not found`); // Oculto para no ensuciar consola
                    return null;
                }
            } else {
                raw = localStorage.getItem(key);
            }
            
            if (!raw) return null;
            
            // Intentamos parsearlo como JSON. Si falla, asumimos que es un texto simple y lo devolvemos tal cual.
            try {
                return JSON.parse(raw);
            } catch (e) {
                return raw; // <-- EL FIX SALVAVIDAS
            }
        } catch (error) { 
            Logger.error(`Storage: Error getting ${key}`, "STORAGE", error); 
            return null;
        }
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
      // Rescatamos los valores protegidos ANTES de detonar la bomba
      const savedProtectedData = {};
      PROTECTED_KEYS.forEach(key => {
          const val = Storage.get(key);
          if (val !== null) savedProtectedData[key] = val;
      });

      // Detonamos la bomba (Borramos todo)
      if (typeof tizen !== "undefined" && tizen.preference) {
        const keys = tizen.preference.getAllKeys() || [];
        keys.forEach(k => {
            try { tizen.preference.remove(k); } catch (e) { Logger.warn(`Storage: Failed to remove ${k}`, e); }
        });
      } else {
        localStorage.clear();
      }

      // Restauramos a los sobrevivientes (Lista VIP)
      Object.keys(savedProtectedData).forEach(key => {
          Storage.set(key, savedProtectedData[key]);
      });

      Logger.info("Storage: All data cleared (Protected keys preserved)", "STORAGE");
    } catch (error) {
      Logger.error("Storage: Clear all failed", "STORAGE", error);
    }
  }
};