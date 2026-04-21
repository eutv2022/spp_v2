// js/services/panelIntegration.js
import { sessionManager } from './sessionManager.js';
import { auth } from './auth.js';
import { Logger } from '../../utils/logger.js';

/**
 * NOTA IMPORTANTE SOBRE SEGURIDAD:
 * 
 * En Android, la app usa Security.getStringData() que:
 * 1. Crea un JSON con: app_device_id (MAC), app_type, version, is_paid
 * 2. Lo codifica en Base64
 * 3. Inserta strings random en posiciones random
 * 4. Agrega 2 caracteres finales con las posiciones
 * 5. Envía: {"data": "string_cifrado"}
 * 
 * El servidor (Getappuser.php) descifra y extrae el MAC.
 * 
 * En Electron/Web, simulamos el mismo flujo.
 */

export const panelIntegration = {
    PANEL_URL: 'https://panel.worldtv.me/MiStreamV3',
    
    /**
     * Obtener el ID del dispositivo (MAC simulado en Web)
     * En Android viene de Utils.getDeviceId()
     * En Web simulamos uno basado en identifiers disponibles
     */
    getDeviceId: function() {
        // Intenta leer un MAC guardado previamente
        const savedMAC = localStorage.getItem('device_mac');
        if (savedMAC) return savedMAC;

        // Si no existe, genera un identificador basado en navegador
        // (En Electron, podrías usar node-macaddress)
        const navigator_ = window.navigator;
        const screen_ = window.screen;
        
        // Generar un "pseudo-MAC" basado en propiedades del dispositivo
        const userAgent = navigator_.userAgent;
        const language = navigator_.language;
        const screenRes = `${screen_.width}x${screen_.height}`;
        
        const combined = `${userAgent}|${language}|${screenRes}`;
        const hash = this._simpleHash(combined);
        
        // Convertir a formato similar a MAC (pares hexadecimales)
        const mac = this._hashToMAC(hash);
        
        // Guardar para futuras referencias
        localStorage.setItem('device_mac', mac);
        
        return mac;
    },

    /**
     * Hash simple para generar pseudo-MAC
     */
    _simpleHash: function(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    },

    /**
     * Convertir hash a formato MAC (AA:BB:CC:DD:EE:FF)
     */
    _hashToMAC: function(hash) {
        const hex = hash.toString(16).padStart(12, '0').substring(0, 12);
        const parts = hex.match(/.{1,2}/g);
        return parts.join(':').toUpperCase();
    },

    /**
     * Obtener versión de la app
     * En Android viene de LTVApp.version_name
     */
    getAppVersion: function() {
        // Simular versión (en Electron podrías leer de package.json)
        return '2.0.0';
    },

    /**
     * Obtener tipo de dispositivo
     * En Android viene de SharedPreferences
     */
    getDeviceType: function() {
        const userAgent = window.navigator.userAgent.toLowerCase();
        if (userAgent.includes('electron')) return 'electron';
        if (userAgent.includes('android')) return 'android';
        if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'ios';
        return 'web';
    },

    /**
     * PARTE CLAVE: Simular el cifrado de Security.getStringData()
     * 
     * En Android:
     * 1. Crea JSON con app_device_id, app_type, version, is_paid
     * 2. Convierte a Base64
     * 3. Inserta string random en posición random
     * 4. Agrega 2 chars con posiciones
     * 
     * Aquí simulamos eso en Web
     */
    encodeRequestData: function(deviceId, version, deviceType) {
        try {
            // 1. Crear JSON (igual que Android)
            const dataObj = {
                app_device_id: deviceId,
                app_type: deviceType,
                version: version,
                is_paid: false
            };

            const jsonStr = JSON.stringify(dataObj);
            Logger.debug('panelIntegration: JSON a enviar:', jsonStr);

            // 2. Convertir a Base64 (usar método robusto)
            const base64Data = this._toBase64(jsonStr);
            Logger.debug('panelIntegration: Base64:', base64Data);

            // 3. Insertar string random en posición random
            const charSet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
            
            // Posición donde insertar (0-42)
            const insertPos = Math.floor(Math.random() * Math.min(base64Data.length, 42));
            
            // Longitud del string random (0-20)
            const randomLen = Math.floor(Math.random() * 20);
            let randomStr = '';
            for (let i = 0; i < randomLen; i++) {
                randomStr += charSet[Math.floor(Math.random() * charSet.length)];
            }

            // 4. Insertar el string random
            const modifiedBase64 = 
                base64Data.substring(0, insertPos) + 
                randomStr + 
                base64Data.substring(insertPos);

            // 5. Agregar 2 caracteres con las posiciones
            const positionChar1 = charSet[insertPos];
            const positionChar2 = charSet[randomLen];

            const finalData = modifiedBase64 + positionChar1 + positionChar2;

            Logger.debug('panelIntegration: Data cifrado (primeros 100 chars):', finalData.substring(0, 100));

            return finalData;

        } catch (error) {
            Logger.error('panelIntegration: Error en encodeRequestData', error);
            throw error;
        }
    },

    /**
     * Convertir string a Base64 (robusto)
     */
    _toBase64: function(str) {
        try {
            return btoa(unescape(encodeURIComponent(str)));
        } catch (e) {
            Logger.warn('panelIntegration: btoa error, usando fallback');
            let binary = '';
            for (let i = 0; i < str.length; i++) {
                binary += String.fromCharCode(str.charCodeAt(i));
            }
            return btoa(binary);
        }
    },

    /**
     * Llamar a Getappuser.php del panel
     */
    fetchCredentialsFromPanel: async function(encryptedData) {
        try {
            const url = `${this.PANEL_URL}/api/Getappuser.php`;
            
            Logger.info('panelIntegration: Llamando a', url);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    data: encryptedData
                }),
                timeout: 15000
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Panel returned error');
            }

            Logger.info('panelIntegration: Credenciales obtenidas del panel');
            return result;

        } catch (error) {
            Logger.error('panelIntegration: Error fetchCredentialsFromPanel', error);
            throw error;
        }
    },

    /**
     * Inicializar: obtener MAC y preparar datos
     */
    init: async function() {
        try {
            const deviceId = this.getDeviceId();
            const version = this.getAppVersion();
            const deviceType = this.getDeviceType();

            Logger.info('panelIntegration: Device ID:', deviceId);
            Logger.info('panelIntegration: Version:', version);
            Logger.info('panelIntegration: Type:', deviceType);

            // Mostrar MAC en el login
            const macDisplay = document.getElementById('mac-address');
            if (macDisplay) {
                macDisplay.textContent = deviceId;
            }

            // Guardar info del dispositivo para usar después
            this._deviceInfo = { deviceId, version, deviceType };

            return true;

        } catch (error) {
            Logger.error('panelIntegration: Error en init', error);
            return false;
        }
    },

    /**
     * FLUJO PRINCIPAL: Conectar con credenciales del panel
     */
    connectWithPanelCredentials: async function() {
        try {
            if (!this._deviceInfo) {
                throw new Error('Device info not initialized');
            }

            const { deviceId, version, deviceType } = this._deviceInfo;

            // 1. Cifrar datos (simular Security.getStringData)
            const encryptedData = this.encodeRequestData(deviceId, version, deviceType);

            // 2. Llamar a Getappuser.php
            const panelResponse = await this.fetchCredentialsFromPanel(encryptedData);

            // 3. Guardar credenciales
            if (panelResponse.username && panelResponse.password) {
                // Guardar en localStorage para apiModule
                localStorage.setItem('username', panelResponse.username);
                localStorage.setItem('password', panelResponse.password);

                // También guardar en sessionManager
                sessionManager.setPanelData({
                    mac: panelResponse.mac,
                    username: panelResponse.username,
                    password: panelResponse.password,
                    url: panelResponse.url,
                    title: panelResponse.title,
                    host: panelResponse.url // Para apiModule.getBaseUrl()
                });

                Logger.info('panelIntegration: Credenciales guardadas');

                // 4. Intentar conectar con las credenciales
                const errorMsg = await auth.login(panelResponse.username, panelResponse.password);
                
                if (!errorMsg) {
                    Logger.info('panelIntegration: Conexión exitosa');
                    return true;
                } else {
                    throw new Error(errorMsg);
                }
            } else {
                throw new Error('Invalid credentials from panel');
            }

        } catch (error) {
            Logger.error('panelIntegration: connectWithPanelCredentials error', error);
            throw error;
        }
    }
};
