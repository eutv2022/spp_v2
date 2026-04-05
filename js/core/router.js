// js/core/router.js

import { homeLoginFocus } from './homeLoginFocus.js';
import { ContentFocus } from './contentFocus.js';
import { setupHomePage } from '../views/HomePage.js'; 
import { renderLogin } from '../views/LoginPage.js';
import { MovieDetailsFocus } from './MovieDetailsFocus.js';
import { SeriesDetailsFocus } from './SeriesDetailsFocus.js';
import { renderContentView, cleanupContentPage } from '../views/ContentPage.js';
import { renderPlayerPage } from '../views/PlayerPage.js';
import { PlayerFocus } from './PlayerFocus.js';
import { renderSettingsPage } from '../views/SettingsPage.js';
import { SettingsFocus } from './SettingsFocus.js';
import { Logger } from '../../utils/logger.js';

export let ActiveFocusManager = homeLoginFocus;

window.ActiveFocusManager = ActiveFocusManager;

function normalizeOptions(arg) {
    if (!arg) return { callback: null, type: null };
    if (typeof arg === 'function') return { callback: arg, type: null };
    if (typeof arg === 'object') {
        return { 
            callback: typeof arg.callback === 'function' ? arg.callback : null, 
            type: typeof arg.type === 'string' ? arg.type : null 
        };
    }
    return { callback: null, type: null };
}

function killGhostKeyboard() {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        try { document.activeElement.blur(); } catch(e) {Logger.error(e);}
    }
    const inputs = document.querySelectorAll('input, textarea');
    if (inputs.length > 0) {
        inputs.forEach(input => {
            input.disabled = true;
            setTimeout(() => { try { input.disabled = false; } catch(e){Logger.error(e);} }, 500);
        });
    }
    document.body.focus();
}

export const router = {
    currentView: null,
    previousContext: null,
    isNavigating: false,

    loadView: async function(viewName, options) {
        if (this.isNavigating) {
            Logger.warn("[Router] 🚫 Navegación ignorada: Ya hay una en curso.");
            return;
        }
        
        this.isNavigating = true;
        const { callback, type } = normalizeOptions(options);
        
        killGhostKeyboard();

        if (viewName === 'player' && this.currentView) {
            this.previousContext = { name: this.currentView.name, params: this.currentView.params };
        }
        if (this.currentView) {
            const oldView = this.currentView.name;
            if (['content', 'movies', 'series', 'livetv'].includes(oldView)) {
                if (typeof cleanupContentPage === 'function') cleanupContentPage();
            }
        }

        try {
            let targetManager = null;

            if (viewName === 'home' || viewName === 'login') {
                targetManager = homeLoginFocus;
            } else if (viewName === 'movie-details') {
                targetManager = MovieDetailsFocus;
            } else if (viewName === 'series-details') {
                targetManager = SeriesDetailsFocus;
            } else if (viewName === 'player') {
                if (typeof renderPlayerPage === 'function') renderPlayerPage();
                targetManager = PlayerFocus;
            } else if (['content', 'livetv', 'movies', 'series'].includes(viewName)) {
                if (typeof renderContentView === 'function') renderContentView();
                targetManager = ContentFocus;
            } else if (viewName === 'settings') {
                if (typeof renderSettingsPage === 'function') renderSettingsPage();
                targetManager = SettingsFocus;
            }

            if (!targetManager) {
               Logger.error(`[Router] ❌ FocusManager no encontrado para la vista: ${viewName}`);
               Logger.info(`[Router] 🔄 Volviendo a Home como fallback seguro.`);
            } else {
               Logger.log(`[Router] 🎯 FocusManager asignado para la vista: ${viewName}`);
            }

            ActiveFocusManager = targetManager;
            window.ActiveFocusManager = targetManager; 

            if (viewName === 'login') renderLogin(); 
            
            if (callback && typeof callback === 'function') {
                await callback(type);
            }

            this.currentView = { name: viewName, params: options };
            if (viewName === 'home') this.previousContext = null;

            requestAnimationFrame(() => {
               try {
                   if (ActiveFocusManager && typeof ActiveFocusManager.init === 'function') {
                       ActiveFocusManager.init(false); 
                   } else {
                       Logger.warn("[Router] ⚠️ ActiveFocusManager o su método init no están disponibles.");
                   }
               } catch (err) {
                   Logger.error("[Router] Error al inicializar ActiveFocusManager:", err);
               } finally {
                   setTimeout(() => {
                       this.isNavigating = false; 
                       console.groupEnd();
                   }, 300); 
               }
            });

        } catch (error) {
            Logger.error("[Router] ❌ Error durante la carga de la vista:", error);
            this.isNavigating = false;
            console.groupEnd();
        }
    },

    back: function() {
        if (this.isNavigating) {
            Logger.warn("[Router] 🚫 Back ignorado: Navegación en curso.");
            return false;
        }

        if (!this.currentView) {
            Logger.warn("[Router] 🔙 Back ignorado: No hay currentView.");
            return false;
        }

        const currentName = this.currentView.name;        
        switch (currentName) {       
            case 'player':
                import('../views/PlayerPage.js').then(m => { if (m.exitPlayer) m.exitPlayer(); }).catch(e => Logger.error(e));
                if (this.previousContext) {
                    this.loadView(this.previousContext.name, this.previousContext.params);
                } else {
                    this.loadView('home', { callback: setupHomePage });
                }
                return true;

            case 'movie-details':
            case 'series-details':
                import('../views/ContentPage.js').then(m => {
                    const type = currentName.includes('movie') ? 'movies' : 'series';
                    this.loadView('content', { type: type, callback: m.setupContentView });
                });
                return true;

            case 'content':
            case 'movies':
            case 'series':
            case 'livetv':
            case 'settings':
                this.loadView('home', { callback: setupHomePage });
                return true;

            case 'home':
            case 'login':
                return false; 

            default:
                Logger.warn(`[Router] 🔄 Back por defecto a Home desde vista desconocida: ${currentName}`);
                this.loadView('home', { callback: setupHomePage });
                return true;
        }
    }
};