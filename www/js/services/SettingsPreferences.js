// js/services/SettingsPreferences.js
import { Logger } from "../../../utils/logger.js";

const STORAGE_KEY = 'liontv_user_preferences';

const ADULT_KEYWORDS = [
    "xxx", "adult", "adultos", "porn", "sex", "18+", "erotic", "hentai", 
    "red light", "exxxtreme", "for adults", "private", "sensual", "uncensored", 
    "playboy", "hustler", "venus", "man-x", "not for kids", "hot", "❌❌❌"
];

const DEFAULT_PREFS = {
    update_interval: 12,
    parental_control: false,
    parental_pin: '0000',
    sort_order: 'name_default',
    hidden_live: [],
    hide_movies: [],
    hide_series: [],
    layout_design: 'modern',
    stream_format: 'ts',
    clear_history: false,
    subtitle_size: 28,
    subtitle_color: '#FFFFFF',
    subtitle_font: 'sans-serif'
};

let _prefsCache = null;

export const SettingsPreferences = {
    load: () => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                _prefsCache = { ...DEFAULT_PREFS, ...JSON.parse(stored) };
            } else {
                _prefsCache = { ...DEFAULT_PREFS };
            }
        } catch (e) {Logger.warn("Settings: load fail, using defaults", e);
            _prefsCache = { ...DEFAULT_PREFS };}

        return _prefsCache;
    },

    get: (key) => {
        if (!_prefsCache) SettingsPreferences.load();
        return _prefsCache[key];
    },

    set: (key, value) => {
        if (!_prefsCache) SettingsPreferences.load();
        _prefsCache[key] = value;
        
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(_prefsCache));
            Logger.debug(`Settings: set ${key} = ${value}`);
            window.dispatchEvent(new CustomEvent('settings:changed', { 
                detail: { key, value } 
            }));
        } catch (e) { Logger.error("Settings: save fail", e); }
    },

    resetToDefaults: () => {
        _prefsCache = { ...DEFAULT_PREFS };
        try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_prefsCache));
        Logger.info("Settings: reset to defaults");
        } catch (e) {Logger.error("Settings: reset fail", e);}
    },

    getUpdateIntervalMs: () => {
        const hours = SettingsPreferences.get('update_interval');
        return hours * 60 * 60 * 1000;
    },
    
    isParentalEnabled: () => {
        return SettingsPreferences.get('parental_control') === true;
    },

    checkPin: (inputPin) => {
        const savedPin = SettingsPreferences.get('parental_pin') || '0000';
        return String(inputPin) === String(savedPin);
    },

    isAdultContent: (name) => {
        if (!name) return false;
        const lower = name.toLowerCase();
        return ADULT_KEYWORDS.some(word => lower.includes(word));
    }
};

SettingsPreferences.load();