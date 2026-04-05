export const DeviceGuard = {
    isSamsung: function() {
        const ua = navigator.userAgent.toLowerCase();
        const hasTizen = ua.indexOf('tizen') !== -1;
        const hasWebapis = typeof window.webapis !== 'undefined';
        const hasTizenObject = typeof window.tizen !== 'undefined';

        return hasTizen || (hasWebapis && hasTizenObject);
    },

    enforceSamsung: function() {
        if (!this.isSamsung()) {
            console.warn("⚠️ Entorno no compatible detectado. Bloqueando funciones de hardware.");
            return false;
        }
        return true;
    }
};