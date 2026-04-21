// js/utils/logger.js

const _getTime = () => new Date().toISOString().split('T')[1].slice(0, -1);

export const Logger = {
    level: "debug", 

    _shouldLog(currentLevel) {
        const levels = { debug: 0, info: 1, warn: 2, error: 3, none: 4 };
        return levels[currentLevel] >= levels[this.level];
    },

    debug(msg, context = "General") {
        if (this._shouldLog("debug")) {
            console.log(`⚙️ [${_getTime()}] [DEBUG] ${context} → ${msg}`);
        }
    },
    
    log(msg, context = "General") {
        this.debug(msg, context);
    },

    info(msg, context = "General") {
        if (this._shouldLog("info")) {
            console.info(`🔹 [${_getTime()}] [INFO] ${context} → ${msg}`);
        }
    },

    warn(msg, context = "General") {
        if (this._shouldLog("warn")) {
            console.warn(`⚠️ [${_getTime()}] [WARN] ${context} → ${msg}`);
        }
    },

    error(msg, context = "General", errorObj = null) {
        if (this._shouldLog("error")) {
            if (errorObj) {
                console.error(`🔴 [${_getTime()}] [ERROR] ${context} → ${msg}`, errorObj);
            } else {
                console.error(`🔴 [${_getTime()}] [ERROR] ${context} → ${msg}`);
            }
        }
    },

    json(obj, context = "Data") {
        if (this._shouldLog("debug")) {
            const time = _getTime();
            try {
                const safeString = JSON.stringify(obj, null, 2);
                console.log(`📦 [${time}] [JSON] ${context} →`, safeString);
            } catch (e) {
                console.warn(`⚠️ [${time}] [JSON-FAIL] ${context} → Error serializando:`, e);
            }
        }
    },
    setLevel(newLevel) {
        if (["debug", "info", "warn", "error", "none"].includes(newLevel)) {
            this.level = newLevel;
        }
    }
};