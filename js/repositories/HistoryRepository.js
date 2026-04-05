// js/repositories/HistoryRepository.js

import { DB } from '../db/db.js';
import { Logger } from '../../utils/logger.js';

export const HistoryRepository = {
    
    add: async (item) => {
        if (!item || !item.id || !item.type) return;
        const uniqueId = `${item.type}-${item.id}`;
        const entry = {
            uniqueId: uniqueId,
            id: item.id,
            type: item.type,
            name: item.name || "Sin Nombre",
            image: item.image || item.poster || item.cover || "",
            tmdbId: item.tmdbId || null,
            extension: item.extension || null,
            date: Date.now()
        };

        try {
            await DB.saveDetails('history', entry);
            await HistoryRepository.trimHistory(item.type);
        } catch (e) {Logger.warn("HistoryRepo: add fail", e);}
    },

    getByType: async (type) => {
        try {
        const all = await DB.get('history');
        if (!all) return [];
        return all
            .filter(i => i.type === type)
            .sort((a, b) => b.date - a.date);
            } catch (e) { Logger.error("HistoryRepo: getByType fail", e); return []; }
    },

    trimHistory: async (type) => {
        try {
        const items = await HistoryRepository.getByType(type);
        const MAX_ITEMS = 15;
        if (items.length > MAX_ITEMS) {
            const toDelete = items.slice(MAX_ITEMS);
            const promises = toDelete.map(item => DB.delete('history', item.uniqueId));
            await Promise.all(promises);
        }
        } catch (e) {Logger.warn("HistoryRepo: trim fail", e);}
    },
    clearAll: async () => {
        try {
            await DB.save('history', []);
            return true;
        } catch (e) {Logger.error("HistoryRepo: clearAll fail", e); return false;}
    }
};