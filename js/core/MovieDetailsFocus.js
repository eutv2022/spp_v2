// js/core/MovieDetailsFocus.js
import { Logger } from '../../utils/logger.js';

export const MovieDetailsFocus = {
    zones: {
        logo: [],
        buttons: [],
        cast: []
    },
    currentZone: 'buttons',
    currentIndex: 0,

    init() {
        this.zones = { logo: [], buttons: [], cast: [] };
        this.currentZone = 'buttons';
        this.currentIndex = 0;

        document.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));

        requestAnimationFrame(() => {
            this.reindex();
            
            if (this._hasItems('buttons')) {
                this.currentZone = 'buttons';
            } else if (this._hasItems('logo')) {
                this.currentZone = 'logo';
            } else {
                Logger.warn("MovieDetailsFocus: No items visible yet.", "UI");
            }

            this.setFocus(this.currentIndex);
        });
    },

    reindex() {
        const isVisible = (el) => el && el.offsetParent !== null;
        this.zones.logo = Array.from(document.querySelectorAll('#details-logo.focusable'));
        const allButtons = Array.from(document.querySelectorAll('#details-buttons .focusable:not(.disabled)'));
        this.zones.buttons = allButtons.filter(el => el.offsetParent !== null);
        const castItems = Array.from(document.querySelectorAll('#details-extra .focusable:not(.disabled)'));
        const visibleCastItems = castItems.filter(isVisible);
        
        if (visibleCastItems.length > 0) {
            this.zones.cast = visibleCastItems;
        } else {
            const detailsExtra = document.getElementById('details-extra');
            if (detailsExtra && !detailsExtra.classList.contains('hidden')) {
                this.zones.cast = [detailsExtra];
            } else {
                const detailsExtra = document.getElementById('details-extra');
            if (detailsExtra && !detailsExtra.classList.contains('hidden') && isVisible(detailsExtra)) {
                this.zones.cast = [detailsExtra];
            } else {
                this.zones.cast = [];
            }
        }
    }
        if (!this._hasItems(this.currentZone)) {
            if (this._hasItems('buttons')) this.currentZone = 'buttons';
            else if (this._hasItems('logo')) this.currentZone = 'logo';
            this.currentIndex = 0;
        }
    },

    setFocus(index) {
        if (!this._hasItems(this.currentZone)) this.reindex();

        const list = this.zones[this.currentZone];
        if (!list || list.length === 0) return;
        const safeIndex = Math.max(0, Math.min(index, list.length - 1));
        const el = list[safeIndex];
        if (!el || !el.isConnected) {
            this.reindex();
            return;
        }

        document.querySelectorAll('.focused').forEach(e => e.classList.remove('focused'));

        el.classList.add('focused');
        try { el.focus(); } catch { /* ignore */ }

        const isBlock = el.id === 'details-extra' || el.classList.contains('additional-info-box');
        try {
        el.scrollIntoView({
            behavior: 'auto',
            block: isBlock ? 'center' : 'nearest',
            inline: 'nearest'
        });
        } catch (_) {Logger.warn("scrollIntoView failed", _);}
        this.currentIndex = safeIndex;
    },

    navigate(direction) {
        if (this.currentZone === 'buttons' && this.zones.buttons.length === 0) this.reindex();

        let idx = this.currentIndex;

        if (this.currentZone === 'logo') {
            if (direction === 'down') {
                this._goToZone('buttons');
            }
            return;
        }
        if (this.currentZone === 'buttons') {
            if (direction === 'up') {
                this._goToZone('logo');
            } else if (direction === 'down') {
                this._goToZone('cast');
            } else if (direction === 'left') {
                if (idx > 0) this.setFocus(idx - 1);
            } else if (direction === 'right') {
                if (idx < this.zones.buttons.length - 1) this.setFocus(idx + 1);
            }
            return;
        }
        if (this.currentZone === 'cast') {
            if (direction === 'up') {
                this._goToZone('buttons');
            } else if (direction === 'left') {
                if (idx > 0) this.setFocus(idx - 1);
            } else if (direction === 'right') {
                if (idx < this.zones.cast.length - 1) this.setFocus(idx + 1);
            }
            return;
        }
    },

    select() {
        const el = (this.zones[this.currentZone] || [])[this.currentIndex];
        if (el && el.isConnected) {
            if (el.id === 'details-extra' || el.classList.contains('additional-info-box')) return;
            el.click();
        } else {
            this.reindex();
        }
    },

    _goToZone(targetZone) {
        if (this._hasItems(targetZone)) {
            this.currentZone = targetZone;
            this.currentIndex = 0;
            this.setFocus(0);
        }
    },

    _hasItems(zone) {
        return this.zones[zone] && this.zones[zone].length > 0;
    },

    handleBack() {
        return false;
    },

    handleMediaKey(action) {
        if (action === 'play_pause') {
            const playBtn = document.getElementById('btn-play');
            if (playBtn && !playBtn.classList.contains('hidden') && !playBtn.classList.contains('disabled')) {
                playBtn.click();
            }
        }
    }
};