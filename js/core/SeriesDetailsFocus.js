// js/core/SeriesDetailsFocus.js
import { Logger } from '../../utils/logger.js';

export const SeriesDetailsFocus = {
    zones: { 
        logo: [],
        meta: [], 
        buttons: [], 
        seasons: [],
        episodes: [] 
    },
    currentZone: "buttons",
    currentIndex: 0,

    init() {
        this.zones = { logo: [], meta: [], buttons: [], seasons: [], episodes: [] };
        this.currentZone = 'buttons'; 
        this.currentIndex = 0;

        document.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));

        requestAnimationFrame(() => {
            this.reindexAll();
            if (this._hasItems('buttons')) {
                this.currentZone = 'buttons';
            } else if (this._hasItems('seasons')) {
                this.currentZone = 'seasons';
            } else if (this._hasItems('logo')) {
                this.currentZone = 'logo';
            }
            
            this.setFocus(this.currentIndex);
        });
    },

    reindexAll() {
        this.zones.logo = Array.from(document.querySelectorAll("#series-details-logo.focusable"));
        this.zones.meta = Array.from(document.querySelectorAll("#series-meta-box.focusable")); 
        const rawButtons = Array.from(document.querySelectorAll("#series-buttons .focusable:not(.disabled)"));
        this.zones.buttons = rawButtons.filter(el => el.offsetParent !== null);
        this.zones.seasons = Array.from(document.querySelectorAll("#seasons-list .focusable"));
        this.reindexEpisodes();
    },
    
    reindexEpisodes() {
        this.zones.episodes = Array.from(document.querySelectorAll("#episodes-list .focusable"));
        if (this.currentZone === 'episodes' && this.zones.episodes.length === 0) {
            this._goToZone('seasons', 0);
        }
    },

    setFocus(index) {
        if (!this._hasItems(this.currentZone)) {
             this.reindexAll();
             if (!this._hasItems(this.currentZone)) return;
        }

        const list = this.zones[this.currentZone];
        let idx = Number.isFinite(index) ? Math.floor(index) : 0;
        idx = Math.max(0, Math.min(idx, list.length - 1));
        const newEl = list[idx];
        if (!newEl || !newEl.isConnected) {
            this.reindexAll();
            if (this.zones[this.currentZone].length > 0) this.setFocus(0);
            return;
        }

        document.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));
        
        newEl.classList.add("focused");
        try { newEl.focus(); } catch {/* ignore */ }
        if (this.currentZone === 'episodes' || this.currentZone === 'seasons') {
            newEl.scrollIntoView({
                behavior: 'auto',
                block: 'center',
                inline: 'nearest' 
            });
        } else {
            newEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        this.currentIndex = idx;
    },

    navigate(direction) {
        if (this.currentZone === 'episodes') this.reindexEpisodes();

        const zone = this.currentZone;
        const idx = this.currentIndex;
        const list = this.zones[zone];
        let targetZone = zone;
        let targetIndex = idx;

        if (zone === 'logo') {
            if (direction === 'right') targetZone = 'meta';
            else if (direction === 'down') targetZone = 'buttons';
        }
        else if (zone === 'meta') { 
            if (direction === 'left') targetZone = 'logo';     
            else if (direction === 'down') targetZone = 'buttons'; 
        }
        else if (zone === 'buttons') {
            if (direction === 'up') targetZone = 'logo';
            else if (direction === 'down') targetZone = 'seasons';
            else if (direction === 'left') {
                if (idx > 0) targetIndex = idx - 1;
            }
            else if (direction === 'right') {
                if (idx < list.length - 1) targetIndex = idx + 1;
            }
        }
        else if (zone === 'seasons') {
            if (direction === 'up') targetZone = 'buttons';
            else if (direction === 'down') targetZone = 'episodes';
            else if (direction === 'left') {
                if (idx > 0) targetIndex = idx - 1;
            }
            else if (direction === 'right') {
                if (idx < list.length - 1) targetIndex = idx + 1;
            }
        }
        else if (zone === 'episodes') {
            if (direction === 'up') {
                if (idx > 0) targetIndex = idx - 1;
                else targetZone = 'seasons';
            }
            else if (direction === 'down') {
                if (idx < list.length - 1) targetIndex = idx + 1;
            }
        }

        if (targetZone !== zone) {
            this._goToZone(targetZone, targetIndex);
        } else if (targetIndex !== idx) {
            this.setFocus(targetIndex);
        }
    },
    
    select() {
        const el = this.zones[this.currentZone]?.[this.currentIndex];
        if (el && el.isConnected && !el.classList.contains('disabled')) {
            el.click();
        } else {
            this.reindexAll();
        }
    },

    handleBack() {
        return false; 
    },

    handleMediaKey(action) {
        if (action === 'play_pause') {
            const playBtn = document.getElementById('btn-play') || document.querySelector('#series-buttons .focusable');
            if (playBtn && !playBtn.classList.contains('hidden') && !playBtn.classList.contains('disabled')) {
                playBtn.click();
            }
        }
    },

    _goToZone(targetZone, targetIndex = 0) {
        if (this._hasItems(targetZone)) {
            this.currentZone = targetZone;
            this.currentIndex = Math.max(0, Math.min(targetIndex, this.zones[targetZone].length - 1));
            this.setFocus(this.currentIndex);
        } else {
            Logger.debug(`SeriesFocus: Zone ${targetZone} is empty.`, "UI");
        }
    },

    _hasItems(zone) {
        return this.zones[zone] && this.zones[zone].length > 0;
    },

    getFocusedIndex() { return this.currentIndex; },
    
    setFocusIndex(index, zoneName) {
        if (zoneName && this.zones[zoneName]) this.currentZone = zoneName;
        this.setFocus(index);
    },
    
    focusZone(zoneName, index = 0) {
        this.reindexAll();
        this._goToZone(zoneName, index);
    }
};