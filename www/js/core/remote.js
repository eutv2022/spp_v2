// js/core/remote.js
import { router } from './router.js'; 
import { Logger } from '../../../utils/logger.js';

const Remote = {
    init: function() {
        window.addEventListener('keydown', this.handleKeyDown.bind(this), true);
    },

    handleKeyDown: function(e) {
        const keyCode = e.keyCode || e.which;

        if (router.isNavigating) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        const activeEl = document.activeElement;
        const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

        if (isInput) {
            if ([8, 13, 46, 37, 39].includes(keyCode)) return; 
            if (keyCode === 10009 || keyCode === 38 || keyCode === 40) {
                activeEl.blur(); 
            }
        }

        if (keyCode === 10009 || keyCode === 27 || keyCode === 461 || keyCode === 8) {
            
            e.preventDefault();
            
            if (window.ActiveFocusManager && typeof window.ActiveFocusManager.handleBack === 'function') {
                if (window.ActiveFocusManager.handleBack()) {
                    return; 
                }
            }

            if (typeof router.handleBack === 'function') {
                if (router.handleBack()) {
                    return;
                }
            } 
            else if (typeof router.back === 'function') {
                router.back(); 
                return;
            }
            try {
                if (typeof tizen !== 'undefined') {
                    tizen.application.getCurrentApplication().exit();
                } else {
                    window.close();
                }
            } catch (err) {
                Logger.error("Error al salir", "Remote", err);
            }
            return;
        }

        if (!window.ActiveFocusManager) return;
        const focusMgr = window.ActiveFocusManager;

        try {
            switch(keyCode) {
                case 37:e.preventDefault(); 
                    if (focusMgr.navigate) focusMgr.navigate('left'); 
                    break;
                case 38: e.preventDefault(); 
                    if (focusMgr.navigate) focusMgr.navigate('up'); 
                    break;
                case 39: e.preventDefault(); 
                    if(focusMgr.navigate) focusMgr.navigate('right'); 
                    break;
                case 40: e.preventDefault(); 
                    if(focusMgr.navigate) focusMgr.navigate('down'); 
                    break;
                case 13: e.preventDefault(); 
                    if(focusMgr.select) focusMgr.select(); 
                    break;
                
                case 415: case 19: case 10252: 
                    if (focusMgr.handleMediaKey) {focusMgr.handleMediaKey('play_pause');
                    } else if (focusMgr.select) { focusMgr.select();}
                    break;
                case 413: if(focusMgr.handleMediaKey) focusMgr.handleMediaKey('stop'); break;
                case 417: if(focusMgr.handleMediaKey) focusMgr.handleMediaKey('ff'); break;
                case 412: if(focusMgr.handleMediaKey) focusMgr.handleMediaKey('rw'); break;
            }
        } catch (err) {
            Logger.error("Error en delegación", "Remote", err);
        }
    }
};

export default Remote;