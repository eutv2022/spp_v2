// js/services/DataPreloader.js

import { DataManager } from './dataManager.js';
import { CarouselRepository } from '../repositories/CarouselRepository.js';
import { SettingsPreferences } from '../services/SettingsPreferences.js';
import { StatusOverlay } from '../../utils/StatusOverlay.js';
import { DB } from '../db/db.js';
import { Logger } from '../../utils/logger.js';
import { sessionManager } from './sessionManager.js';

const LAST_SYNC_KEY = 'last_content_sync_timestamp';
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let autoUpdateIntervalId = null;
let _isRunningPreload = false;

export async function smartDataSync() {
  if (!sessionManager.isAuthenticated()) {
      Logger.warn("DataPreloader: No active session. Aborting sync.");
      return;
  }

  Logger.info("DataPreloader: analyzing DB state...");
  
  await delay(500);

  try { await DB.ready(); } 
  catch (e) { 
      Logger.error('DataPreloader: DB.ready fail', e); 
      return; 
  }

  let count = 0;
  try { count = await DB.count('movies'); } catch (e) { Logger.warn("DB.count error", e); count = 0; }
  if (count === 0) {
    Logger.info("DataPreloader: DB empty -> Starting Full Sync (UI).");
    await executeSequence(true); 
    startAutoPreload();
    return;
  }

  const lastSync = Number(localStorage.getItem(LAST_SYNC_KEY)) || 0;
  const now = Date.now();
  const intervalHours = Number(SettingsPreferences.get('update_interval')) || 12;
  const intervalMs = intervalHours * 60 * 60 * 1000;
  
  if ((now - lastSync) >= intervalMs) {
    Logger.info("DataPreloader: data expired -> Background Update.");
    await executeSequence(false); 
  } else {
    Logger.info("DataPreloader: data fresh. No sync needed.");
  }
  startAutoPreload();
}

async function executeSequence(showUI = false) {
    if (_isRunningPreload) return false;
    _isRunningPreload = true;
    let success = false;

    if (showUI) {
        StatusOverlay.showModal(); 
    }

    try {
        Logger.info("DataPreloader: Starting Sequence...");
        if (showUI) StatusOverlay.setStep('live', 'loading'); 
        try {
            await DataManager.fetchAndSaveLiveCategories();
            await DataManager.fetchAndSaveMovieCategories();
            await DataManager.fetchAndSaveSeriesCategories();
        } catch(e) { Logger.warn("Cat sync error", e); }
        if (!showUI) StatusOverlay.show('live');
        try {
            await DataManager.fetchAndSaveLiveStreams();
            if (showUI) {
                StatusOverlay.setStep('live', 'success'); 
                await delay(300); 
                StatusOverlay.setStep('movies', 'loading');
            } else {
                StatusOverlay.hide('live');
            }
        } catch (e) {
            Logger.error("Live Sync Error", e);
        }
        
        await delay(500); 
        if (!showUI) StatusOverlay.show('movies');
        try {
            await DataManager.fetchAndSaveMoviesList(); 
            if (showUI) {
                StatusOverlay.setStep('movies', 'success'); 
                await delay(300);
                StatusOverlay.setStep('series', 'loading'); 
            } else {
                StatusOverlay.hide('movies');
            }
        } catch (e) {
            Logger.error("Movies Sync Error", e);
        }

        await delay(500); 
        if (!showUI) StatusOverlay.show('series');
        try {
            await DataManager.fetchAndSaveSeriesList();
            if (showUI) {
                StatusOverlay.setStep('series', 'success'); 
            } else {
                StatusOverlay.hide('series');
            }
        } catch (e) {
            Logger.error("Series Sync Error", e);
        }
        
        await delay(500);
        if (CarouselRepository.generateAndSave) {
            await CarouselRepository.generateAndSave().catch(e => Logger.warn("Carousel error", e));
        }
        success = true;
        if (showUI) await delay(1000);

    } catch (e) {
        Logger.error('DataPreloader: FATAL executeSequence error', e);
    } finally {
        if (success) {
            try { localStorage.setItem(LAST_SYNC_KEY, Date.now().toString()); } catch(e){Logger.warn("Failed to set last sync timestamp", e);}
        }
        
        _isRunningPreload = false;
        if (showUI) {
            StatusOverlay.hideModal();
            if (window.router) window.router.loadView('home'); 
        }
    }
    return success;
}

export function startAutoPreload() {
    if (autoUpdateIntervalId) clearInterval(autoUpdateIntervalId);
    if (!sessionManager.isAuthenticated()) return; 
    const hours = Number(SettingsPreferences.get('update_interval')) || 12;
    const intervalMs = hours * 60 * 60 * 1000;
    autoUpdateIntervalId = setInterval(() => {
        if (!_isRunningPreload && sessionManager.isAuthenticated()) {
            smartDataSync();
        }
    }, intervalMs);
}

export function restartAutoPreload() {
    startAutoPreload();
}

export async function forceAppRefresh() {
    Logger.info("DataPreloader: FORCE REFRESH.");
    StatusOverlay.showModal(); 
    
    try {
        await DB.clearContent(); 
        const masterAuth = localStorage.getItem("AUTH_JSON");
        const serverUrl = localStorage.getItem("server_url");
        Logger.info("DataPreloader: Salvando credenciales maestras...");
        localStorage.clear();
        if (masterAuth) {
            localStorage.setItem("AUTH_JSON", masterAuth);
            Logger.info("DataPreloader: AUTH_JSON restaurada con éxito.");
        } else {
            Logger.warn("DataPreloader: No se encontró AUTH_JSON para restaurar.");
        }
        
        if (serverUrl) localStorage.setItem("server_url", serverUrl);
        await delay(200);
        await executeSequence(true);

    } catch(e) { 
        Logger.error("DataPreloader: forceRefresh fail", e);
        StatusOverlay.hideModal();
    }
}