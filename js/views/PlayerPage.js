// js/views/PlayerPage.js

import { router } from '../core/router.js';
import { auth } from '../services/auth.js';
import { Logger } from '../../utils/logger.js';
import { DB } from '../db/db.js'; // Importante para buscar la lista de canales

let hlsInstance = null;
let currentPlaylist = [];
let currentIndex = 0;
let currentContentType = '';
let controlsTimeout = null;
let savedReturnContext = null;

// ---------------------------------------------------------
// 1. INICIALIZACIÓN DEL REPRODUCTOR
// ---------------------------------------------------------
export async function setupPlayerPage(media, type, meta = {}, returnContext = null) {
    savedReturnContext = returnContext;
    currentContentType = type;
    
    // Construir la Interfaz HTML
    buildPlayerUI();

    const loader = document.getElementById('player-loader');
    loader.style.display = 'block';

    // ---------------------------------------------------------
    // 2. CONSTRUIR LA PLAYLIST SEGÚN EL TIPO
    // ---------------------------------------------------------
    try {
        if (type === 'series' && Array.isArray(media)) {
            // Viene de SeriesDetails (Ya es un arreglo)
            currentPlaylist = media[0];
            currentIndex = media[1] || 0;
        } 
        else if (type === 'livetv') {
            // Viene de ContentPage (Solo tenemos 1 canal, buscamos sus hermanos)
            const catId = meta.categoryId;
            if (catId) {
                const canalesCat = await DB.getByIndex('live_streams', 'idx_category', String(catId));
                if (canalesCat && canalesCat.length > 0) {
                    currentPlaylist = canalesCat;
                    // Buscamos en qué posición está el canal que clickeamos
                    currentIndex = currentPlaylist.findIndex(c => String(c.stream_id) === String(meta.streamId));
                    if (currentIndex === -1) currentIndex = 0;
                } else {
                    currentPlaylist = [meta];
                    currentIndex = 0;
                }
            } else {
                currentPlaylist = [meta];
                currentIndex = 0;
            }
        } 
        else {
            // Películas (Solo 1 archivo)
            currentPlaylist = [meta];
            currentIndex = 0;
        }

        // Cargar el video actual
        loadCurrentVideo();

    } catch (error) {
        Logger.error("Error inicializando Player:", error);
        loader.textContent = "Error al cargar la lista de reproducción.";
    }

    // Configurar eventos del control remoto y UI
    setupPlayerEvents();
}

// ---------------------------------------------------------
// 3. CARGADOR DEL VIDEO ACTUAL
// ---------------------------------------------------------
function loadCurrentVideo() {
    const creds = auth.getCredentials();
    let SERVER_BASE_URL = localStorage.getItem('server_url') || "http://liontv.es:8080";
    SERVER_BASE_URL = SERVER_BASE_URL.replace(/\/$/, "");

    const videoElement = document.getElementById('html5-player');
    const titleElement = document.getElementById('player-title');
    const loader = document.getElementById('player-loader');
    const trackBtn = document.getElementById('btn-tracks');
    
    const currentItem = currentPlaylist[currentIndex];
    if (!currentItem) return exitPlayer();

    // Reset UI
    loader.style.display = 'block';
    loader.textContent = 'Cargando...';
    trackBtn.style.display = 'none'; // Ocultar botón de pistas hasta saber si hay
    titleElement.textContent = currentItem.title || currentItem.name || currentItem.n || 'Reproduciendo...';

    // Destruir HLS anterior si existe
    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }

    let fileToPlay = "";
    const streamId = currentItem.streamId || currentItem.id || currentItem.stream_id || currentItem.i;

    // Construir URL engañando al servidor para Android
    if (currentContentType === 'livetv') {
        fileToPlay = `${SERVER_BASE_URL}/live/${creds.username}/${creds.password}/${streamId}.m3u8`;
    } else if (currentContentType === 'series') {
        const ext = (currentItem.containerExtension || currentItem.e || "mp4").replace('.', '');
        fileToPlay = `${SERVER_BASE_URL}/series/${creds.username}/${creds.password}/${streamId}.${ext}`;
    } else {
        const ext = (currentItem.containerExtension || currentItem.e || "mp4").replace('.', '');
        fileToPlay = `${SERVER_BASE_URL}/movie/${creds.username}/${creds.password}/${streamId}.${ext}`;
    }

    Logger.info("Reproduciendo:", fileToPlay);

    // Arrancar HLS o Nativo
    if (fileToPlay.includes('.m3u8') && typeof Hls !== 'undefined' && Hls.isSupported()) {
        hlsInstance = new Hls({ maxBufferLength: 30 });
        hlsInstance.loadSource(fileToPlay);
        hlsInstance.attachMedia(videoElement);

        hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
            loader.style.display = 'none';
            // Revisar si hay pistas de audio/subtítulos múltiples
            if (hlsInstance.audioTracks.length > 1 || hlsInstance.subtitleTracks.length > 0) {
                trackBtn.style.display = 'inline-block';
            }
            videoElement.play().catch(e => Logger.warn("Autoplay bloqueado", e));
        });

        hlsInstance.on(Hls.Events.ERROR, function (event, data) {
            if (data.fatal) loader.textContent = "Error de conexión con el servidor.";
        });
    } else {
        // MP4 / MKV Nativo
        videoElement.src = fileToPlay;
        videoElement.load();
        
        videoElement.onloadeddata = () => { loader.style.display = 'none'; videoElement.play(); };
        videoElement.onerror = () => { loader.textContent = "Error al reproducir el formato."; };
    }
}

// ---------------------------------------------------------
// 4. FUNCIONES DE ZAPPING Y REPRODUCCIÓN
// ---------------------------------------------------------
function playNext() {
    if (currentIndex < currentPlaylist.length - 1) {
        currentIndex++;
        loadCurrentVideo();
        showControls();
    }
}

function playPrev() {
    if (currentIndex > 0) {
        currentIndex--;
        loadCurrentVideo();
        showControls();
    }
}

function togglePlayPause() {
    const video = document.getElementById('html5-player');
    const btn = document.getElementById('btn-play-pause');
    if (video.paused) {
        video.play();
        btn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
        video.pause();
        btn.innerHTML = '<i class="fas fa-play"></i>';
    }
    showControls();
}

// ---------------------------------------------------------
// 5. INTERFAZ Y CONTROLES HTML
// ---------------------------------------------------------
function buildPlayerUI() {
    document.getElementById('app-container').innerHTML = `
    <div id="player-view" style="width: 100vw; height: 100vh; background: #000; position: relative; overflow: hidden;">
        
        <video id="html5-player" style="width: 100%; height: 100%; object-fit: contain;"></video>
        
        <div id="player-osd" class="player-osd">
            <div class="osd-header">
                <button id="btn-back" class="osd-btn"><i class="fas fa-arrow-left"></i> Atrás</button>
                <h2 id="player-title" class="osd-title">Cargando...</h2>
                <button id="btn-tracks" class="osd-btn" style="display:none;"><i class="fas fa-closed-captioning"></i> Audios/Subs</button>
            </div>
            
            <div class="osd-footer">
                <button id="btn-prev" class="osd-btn"><i class="fas fa-step-backward"></i> Anterior</button>
                <button id="btn-play-pause" class="osd-btn osd-play"><i class="fas fa-pause"></i></button>
                <button id="btn-next" class="osd-btn"><i class="fas fa-step-forward"></i> Siguiente</button>
            </div>
        </div>

        <div id="track-menu" class="track-menu hidden">
            <div class="track-columns">
                <div class="track-col">
                    <h3>Audio</h3>
                    <ul id="audio-list"></ul>
                </div>
                <div class="track-col">
                    <h3>Subtítulos</h3>
                    <ul id="subs-list"></ul>
                </div>
            </div>
            <button id="btn-close-tracks" class="osd-btn" style="margin-top:20px;">Cerrar</button>
        </div>

        <div id="player-loader" class="player-loader">Cargando...</div>
    </div>

    <style>
        .player-osd { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.8) 100%); display: flex; flex-direction: column; justify-content: space-between; padding: 30px; transition: opacity 0.3s; z-index: 10; opacity: 1; }
        .osd-hidden { opacity: 0; pointer-events: none; }
        .osd-header, .osd-footer { display: flex; align-items: center; justify-content: space-between; }
        .osd-footer { justify-content: center; gap: 30px; }
        .osd-title { color: white; font-size: 24px; font-weight: bold; text-align: center; flex: 1; text-shadow: 2px 2px 4px #000; }
        .osd-btn { background: rgba(255,255,255,0.1); border: 2px solid transparent; color: white; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 18px; transition: 0.2s; }
        .osd-btn:focus, .osd-btn.selected { background: #00f2ff; color: black; border-color: white; transform: scale(1.1); outline: none; }
        .osd-play { border-radius: 50%; width: 60px; height: 60px; padding: 0; }
        
        .track-menu { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.9); border: 2px solid #00f2ff; padding: 30px; border-radius: 12px; color: white; z-index: 20; min-width: 400px; text-align: center; }
        .track-columns { display: flex; justify-content: space-around; text-align: left; gap: 40px; }
        .track-col ul { list-style: none; padding: 0; margin-top: 10px; }
        .track-col li { padding: 10px; margin: 5px 0; background: #222; border-radius: 5px; cursor: pointer; }
        .track-col li.active { background: #00f2ff; color: black; }
        .track-col li:focus { outline: 2px solid white; background: #333; }
        .hidden { display: none; }
        .player-loader { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 24px; z-index: 5; text-shadow: 2px 2px 5px black; }
    </style>
    `;
}

// ---------------------------------------------------------
// 6. EVENTOS Y CONTROL REMOTO
// ---------------------------------------------------------
function setupPlayerEvents() {
    const osd = document.getElementById('player-osd');
    const trackMenu = document.getElementById('track-menu');

    // Botones UI
    document.getElementById('btn-back').addEventListener('click', exitPlayer);
    document.getElementById('btn-play-pause').addEventListener('click', togglePlayPause);
    document.getElementById('btn-next').addEventListener('click', playNext);
    document.getElementById('btn-prev').addEventListener('click', playPrev);
    
    document.getElementById('btn-tracks').addEventListener('click', openTrackMenu);
    document.getElementById('btn-close-tracks').addEventListener('click', () => { trackMenu.classList.add('hidden'); });

    // Foco inicial
    document.getElementById('btn-play-pause').focus();
    showControls();

    // Eventos de teclado (Control Remoto)
    window.addEventListener('keydown', handleRemoteKeys);
    window.addEventListener('mousemove', showControls);
}

function handleRemoteKeys(e) {
    showControls();
    const trackMenu = document.getElementById('track-menu');
    const isMenuOpen = !trackMenu.classList.contains('hidden');

    switch(e.key) {
        case 'Escape':
        case 'Backspace':
            e.preventDefault();
            if (isMenuOpen) trackMenu.classList.add('hidden');
            else exitPlayer();
            break;
        case 'MediaPlayPause':
        case 'Enter':
            if (!isMenuOpen && e.target.tagName !== 'BUTTON') { togglePlayPause(); }
            break;
        case 'ArrowRight':
        case 'ChannelUp':
            if (!isMenuOpen && e.target.tagName !== 'BUTTON') playNext();
            break;
        case 'ArrowLeft':
        case 'ChannelDown':
            if (!isMenuOpen && e.target.tagName !== 'BUTTON') playPrev();
            break;
        case 'MediaTrackNext': playNext(); break;
        case 'MediaTrackPrevious': playPrev(); break;
    }
}

function showControls() {
    const osd = document.getElementById('player-osd');
    const trackMenu = document.getElementById('track-menu');
    osd.classList.remove('osd-hidden');
    
    clearTimeout(controlsTimeout);
    // Solo ocultar si el menú de pistas está cerrado
    if (trackMenu.classList.contains('hidden')) {
        controlsTimeout = setTimeout(() => {
            osd.classList.add('osd-hidden');
        }, 4000);
    }
}

// ---------------------------------------------------------
// 7. LÓGICA DEL MENÚ DE PISTAS (HLS.JS)
// ---------------------------------------------------------
function openTrackMenu() {
    if (!hlsInstance) return;
    
    const menu = document.getElementById('track-menu');
    const audioList = document.getElementById('audio-list');
    const subsList = document.getElementById('subs-list');
    
    audioList.innerHTML = '';
    subsList.innerHTML = '';

    // Audios
    hlsInstance.audioTracks.forEach((track, index) => {
        const li = document.createElement('li');
        li.textContent = track.name || `Audio ${index + 1}`;
        li.tabIndex = 0;
        if (hlsInstance.audioTrack === index) li.classList.add('active');
        
        li.addEventListener('click', () => {
            hlsInstance.audioTrack = index;
            menu.classList.add('hidden');
        });
        li.addEventListener('keydown', (e) => { if(e.key === 'Enter') li.click(); });
        audioList.appendChild(li);
    });

    // Subtítulos
    const noSubLi = document.createElement('li');
    noSubLi.textContent = "Apagado";
    noSubLi.tabIndex = 0;
    if (hlsInstance.subtitleTrack === -1) noSubLi.classList.add('active');
    noSubLi.addEventListener('click', () => { hlsInstance.subtitleTrack = -1; menu.classList.add('hidden'); });
    subsList.appendChild(noSubLi);

    hlsInstance.subtitleTracks.forEach((track, index) => {
        const li = document.createElement('li');
        li.textContent = track.name || `Subtítulo ${index + 1}`;
        li.tabIndex = 0;
        if (hlsInstance.subtitleTrack === index) li.classList.add('active');
        
        li.addEventListener('click', () => {
            hlsInstance.subtitleTrack = index;
            menu.classList.add('hidden');
        });
        li.addEventListener('keydown', (e) => { if(e.key === 'Enter') li.click(); });
        subsList.appendChild(li);
    });

    menu.classList.remove('hidden');
    document.getElementById('btn-close-tracks').focus();
    clearTimeout(controlsTimeout); // Evitar que la OSD se oculte mientras está en el menú
}

// ---------------------------------------------------------
// 8. SALIDA LIMPIA (CLEANUP)
// ---------------------------------------------------------
export function exitPlayer() {
    window.removeEventListener('keydown', handleRemoteKeys);
    window.removeEventListener('mousemove', showControls);
    clearTimeout(controlsTimeout);

    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }
    
    const video = document.getElementById('html5-player');
    if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
    }

    document.getElementById('player-view')?.remove();

    // Regresar a la vista anterior preservando el estado
    if (savedReturnContext && savedReturnContext.restore) {
        savedReturnContext.restore({ focusIndex: currentIndex });
    } else {
        router.back();
    }
}
// ---------------------------------------------------------
// 9. COMPATIBILIDAD CON PLAYERFOCUS.JS
// ---------------------------------------------------------
export { openTrackMenu };

export function closeTrackMenu() {
    const menu = document.getElementById('track-menu');
    if (menu) menu.classList.add('hidden');
}

export function renderPlayerPage() {}
export function onTrackItemSelected() {}
export function showExitModal() {}
export function hideExitModal() {}
export function confirmExit() { 
    exitPlayer(); 
}