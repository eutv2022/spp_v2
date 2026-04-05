import { router } from '../core/router.js';
import { auth } from '../services/auth.js';
import { Logger } from '../../utils/logger.js';

let child_process = null;
let path = null;
let fs = null;  // <--- Necesario para crear la playlist
let os = null;  // <--- Necesario para saber donde guardar el archivo temporal

try {
    if (typeof require !== 'undefined') {
        child_process = require('child_process');
        path = require('path');
        fs = require('fs');
        os = require('os');
    }
} catch (e) { console.warn("Modo Web - No se puede ejecutar VLC local"); }

const SERVER_BASE_URL = "http://liontv.es:8080"; 

export function setupPlayerPage(media, type, meta = {}) {
    // UI simple de "Cargando"
    document.getElementById('app-container').innerHTML = `
    <div id="player-view" style="background: #111; height: 100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white;">
        <div style="font-size:60px; margin-bottom:20px;">🎬</div>
        <h1>Lanzando VLC...</h1>
        <p id="player-status" style="color:#aaa;">Preparando lista de reproducción...</p>
        <button id="btn-back" class="focusable" style="padding:10px 30px; margin-top:30px; cursor:pointer; background:#b90909; border:none; color:white; font-size:16px;">
            ⬅ Volver
        </button>
    </div>`;

    const creds = auth.getCredentials();
    let fileToPlay = "";
    let startIndex = 0;

    // ---------------------------------------------------------
    // CASO 1: SERIES (Playlist completa)
    // ---------------------------------------------------------
    if (type === 'series' && Array.isArray(media)) {
        const playlist = media[0];  // La lista de todos los episodios
        startIndex = media[1] || 0; // El índice del episodio clickeado

        // Generamos el contenido del archivo .m3u
        let m3uContent = "#EXTM3U\n";
        
        playlist.forEach(ep => {
            const ext = ep.containerExtension || "mkv";
            // Construir URL real del episodio
            const url = `${SERVER_BASE_URL}/series/${creds.username}/${creds.password}/${ep.id}.${ext}`;
            
            // #EXTINF:-1, Titulo del episodio
            m3uContent += `#EXTINF:-1,${ep.title}\n`;
            m3uContent += `${url}\n`;
        });

        // Guardamos el archivo .m3u en la carpeta temporal del sistema
        try {
            const tempDir = os.tmpdir();
            const tempFilePath = path.join(tempDir, 'liontv_playlist.m3u');
            fs.writeFileSync(tempFilePath, m3uContent);
            
            fileToPlay = tempFilePath;
            Logger.info("Playlist M3U generada en:", fileToPlay);
            document.getElementById('player-status').textContent = `Cargando ${playlist.length} episodios...`;

        } catch (e) {
            Logger.error("Error escribiendo M3U:", e);
            // Si falla crear el archivo, usamos el método antiguo (solo 1 episodio)
            const currentEp = playlist[startIndex];
            const ext = currentEp.containerExtension || "mkv";
            fileToPlay = `${SERVER_BASE_URL}/series/${creds.username}/${creds.password}/${currentEp.id}.${ext}`;
            startIndex = 0;
        }
    } 
    // ---------------------------------------------------------
    // CASO 2: PELÍCULAS / LIVE TV (Un solo archivo)
    // ---------------------------------------------------------
    else {
        const streamId = meta.stream_id || meta.streamId || meta.id;
        const ext = (meta.containerExtension || meta.extension || "mp4").replace('.', '');
        
        let urlType = 'movie';
        if (type.includes('live')) urlType = 'live';

        if (urlType === 'live') {
            fileToPlay = `${SERVER_BASE_URL}/${creds.username}/${creds.password}/${streamId}`;
        } else {
            fileToPlay = `${SERVER_BASE_URL}/${urlType}/${creds.username}/${creds.password}/${streamId}.${ext}`;
        }
    }

    // Ejecutar VLC
    launchPortableVLC(fileToPlay, startIndex);

    document.getElementById('btn-back').addEventListener('click', () => {
        router.back();
    });
}

function launchPortableVLC(fileUrl, startIndex = 0) {
    if (!child_process || !path) return;

    // 1. Detección de ruta REFORZADA
    let vlcExecutablePath;
    
    // En Electron, si 'defaultApp' es true, estamos en modo desarrollo (npm start)
    const isDev = process.defaultApp || /node_modules[\\/]electron[\\/]/.test(process.execPath);

    if (isDev) {
        // MODO DESARROLLO: Raíz del proyecto / bin / vlc / vlc.exe
        vlcExecutablePath = path.join(process.cwd(), 'bin', 'vlc', 'vlc.exe');
    } else {
        // MODO PRODUCCIÓN: Carpeta Instalación / resources / bin / vlc / vlc.exe
        vlcExecutablePath = path.join(process.resourcesPath, 'bin', 'vlc', 'vlc.exe');
    }

    // 2. Diagnóstico rápido (Solo para probar en la otra PC, luego puedes quitarlo)
    // alert("Buscando VLC en: " + vlcExecutablePath);

    const vlcDir = path.dirname(vlcExecutablePath);

    const args = [
        '--fullscreen',
        '--no-video-title-show',
        '--no-qt-privacy-ask',
        '--no-qt-updates-notif',
        '--play-and-exit',
        '--no-osd',
        '--no-interact',
        '--video-on-top',
        '--mouse-hide-timeout=1000',
        '--no-metadata-network-access'
    ];

    if (fileUrl.endsWith('.m3u') && startIndex > 0) {
        args.push(`--playlist-start=${startIndex}`);
    }

    args.push(fileUrl);

    // 3. Ejecución con CWD corregido
    child_process.execFile(vlcExecutablePath, args, { cwd: vlcDir }, (err) => {
        if (err) {
            Logger.error("Error lanzando VLC:", err);
            // Si hay error, lanzamos un aviso visible en la otra PC
            alert("Error al abrir VLC: " + err.message);
        }
    });
}

// Dummies para evitar errores de importación en otros archivos
export function renderPlayerPage() {}
export function closeTrackMenu() {}
export function openTrackMenu() {}
export function onTrackItemSelected() {}
export function showExitModal() {}
export function hideExitModal() {}
export function confirmExit() { router.back(); }
export function exitPlayer() { document.getElementById('player-view')?.remove(); }