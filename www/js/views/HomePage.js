// js/views/HomePage.js

import { router } from '../core/router.js';
import { sessionManager } from '../services/sessionManager.js';
import { homeLoginFocus } from '../core/homeLoginFocus.js';
import { CarouselRepository } from '../repositories/CarouselRepository.js';
import { forceAppRefresh, smartDataSync } from '../services/DataPreloader.js';
import { setupContentView } from './ContentPage.js'; 
import { setupMovieDetailsPage } from './MovieDetails.js';
import { setupSeriesDetailsPage } from './SeriesDetails.js';
import { setupSettingsPage } from './SettingsPage.js';
import { waitForElement } from '../../../utils/domWatcher.js';
import { Logger } from '../../../utils/logger.js';
import { DataManager } from '../services/dataManager.js';

let carouselTimer = null; 
let carouselItems = [];
let currentIndex = 0;
let lastFocusedId = 'nav-refresh';
let homeExitModalEl = null;

const HOME_MARKUP = `
  <div class="view-home">
    <div class="home-container">
      <div class="app-logo">
        <img src="./assets/logo/logo11.png" alt="LionTV Logo" class="main-logo">
      </div>

      <nav id="column-nav" class="main-nav" data-column="1">
        <button class="nav-item focusable" id="nav-refresh" data-nav-right="pill-play-btn" type="button">
          <i class="fas fa-sync" aria-hidden="true"></i>
          <span>Actualizar</span>
        </button>

        <button class="nav-item focusable" id="nav-settings" data-nav-right="pill-play-btn" type="button">
          <i class="fas fa-cog" aria-hidden="true"></i>
          <span>Menú</span>
        </button>

        <button class="nav-item focusable" id="logoutBtn" data-nav-right="pill-play-btn" type="button">
          <i class="fas fa-power-off" aria-hidden="true"></i>
          <span>Salir</span>
        </button>
      </nav>

      <div class="main-content-area">
        <section id="content-pill" class="hero-section" data-column="2">
          
                    <button id="pill-prev-btn" class="pill-nav-btn focusable" data-zone="pill-nav" tabindex="0">
            <i class="fas fa-chevron-left"></i>
          </button>

                   <div class="hero-text-left">
  <h2 id="pill-title" class="pill-title">Cargando...</h2>
  <p id="pill-type" class="pill-type pill-metadata"></p>
  <p id="pill-year" class="pill-year pill-metadata"></p>

  <!-- Contenedor donde el JS inyectará hasta 3 cápsulas -->
  <div id="left-genres" class="left-genres-wrapper" aria-hidden="false"></div>

  <div class="hero-buttons">
    <!-- Cambiamos clases: mantenemos id y focusable para el sistema, pero usamos .btn + .pill-info-btn -->
    <button id="pill-info-btn" class="btn pill-info-btn focusable" data-zone="pill" tabindex="0">
      <i class="fas fa-info-circle" aria-hidden="true"></i>
      Ver Detalles
    </button>
  </div>
</div>

                    <div id="pill-image-wrapper" class="pill-image-wrapper">
            <div id="pillImage" class="pill-image" role="img"></div>
          </div>

                    <div class="hero-text-right">
            <h3 class="pill-synopsis-label">Sinopsis</h3>
            <p id="pill-plot" class="pill-description">Cargando datos...</p>
          </div>

                    <button id="pill-next-btn" class="pill-nav-btn focusable" data-zone="pill-nav" tabindex="0">
            <i class="fas fa-chevron-right"></i>
          </button>

        </section>

        <div class="lower-content-flex">
          <div id="feature-buttons" class="feature-buttons-row" data-column="3">
            <button class="btn feature-btn focusable" id="livetv-btn" data-type="livetv" data-nav-up="pill-play-btn" data-nav-right="series-btn" type="button">
              <i class="fas fa-tv" aria-hidden="true"></i>
              LiveTV
            </button>

            <button class="btn feature-btn focusable" id="series-btn" data-type="series" data-nav-up="pill-play-btn" data-nav-left="livetv-btn" data-nav-right="movies-btn" type="button">
              <i class="fas fa-compact-disc" aria-hidden="true"></i>
              Series
            </button>

            <button class="btn feature-btn focusable" id="movies-btn" data-type="movies" data-nav-up="pill-play-btn" data-nav-left="series-btn" type="button">
              <i class="fas fa-film" aria-hidden="true"></i>
              Movies
            </button>
          </div>

          <nav id="secondary-nav" class="secondary-nav" data-column="4"></nav>
        </div>

        <section id="content-rows" class="content-rows" data-column="5"></section>
      </div> <!-- .main-content-area -->
    </div> <!-- .home-container -->

  <div id="home-exit-modal" class="home-modal-overlay"> 
      <div class="home-modal-container"> 
          <h2 class="home-modal-title">¿Desea salir de la aplicación?</h2> 
          <div class="home-modal-buttons"> 
              <button id="btnExitNo" class="home-modal-btn focusable" type="button">Cancelar</button>
              <button id="btnExitYes" class="home-modal-btn focusable" type="button">Salir</button>
          </div>
      </div>
  </div>
  </div>
`;

function showHomeExitModal() {
    if (!homeExitModalEl) {
        homeExitModalEl = document.getElementById('home-exit-modal');
    }
    
    if (homeExitModalEl) {
        homeExitModalEl.classList.add('visible');
        void homeExitModalEl.offsetWidth; 
    }
}

function hideHomeExitModal() {
    if (!homeExitModalEl) {
        homeExitModalEl = document.getElementById('home-exit-modal');
    }

    if (homeExitModalEl) {
        homeExitModalEl.classList.remove('visible');
       
    }
}

async function confirmExitApp() {
    try {
        // ELIMINADO: DataManager.clearAllData(); <--- Esto era lo que borraba todo
        
        if (typeof tizen !== 'undefined') {
            tizen.application.getCurrentApplication().exit();
        } else {
            // En Electron (PC), esto cierra la ventana y mantiene los datos guardados
            window.close();
        }
    } catch (e) {
        Logger.error("Error exiting app", "HomePage", e);
    }
}

export function renderHome() {
    const appContainer = document.getElementById('app-container');
    const existingHome = document.querySelector('.view-home');
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
    if (appContainer && !existingHome) {
        appContainer.innerHTML = HOME_MARKUP.trim();
        return true;
    } else {
        return false;
    }
}

export async function setupHomePage() {
    window.ActiveFocusManager = homeLoginFocus;

    if (carouselTimer) {
        clearInterval(carouselTimer);
        carouselTimer = null;
    }

    const isNewView = renderHome(); 
    const titleEl = document.getElementById("pill-title");
    const infoBtn = document.getElementById("pill-info-btn");
    const prevBtn = document.getElementById("pill-prev-btn");
    const nextBtn = document.getElementById("pill-next-btn");
    const refreshBtn = document.getElementById('nav-refresh');
    const logoutButton = document.getElementById('logoutBtn');
    const settingsBtn = document.getElementById('nav-settings');
    const liveNav = document.querySelector('[data-type="livetv"]');
    const moviesNav = document.querySelector('[data-type="movies"]');
    const seriesNav = document.querySelector('[data-type="series"]');
    
    homeExitModalEl = document.getElementById('home-exit-modal');
    const homeExitYesBtn = document.getElementById('btnExitYes');
    const homeExitNoBtn = document.getElementById('btnExitNo');

    document.querySelectorAll('.focusable').forEach(el => {
        el.classList.remove('focused', 'focus', 'selected', 'active');
    });

    if (isNewView) {
        const navItems = document.querySelectorAll('.main-nav .nav-item');
        const floatingText = document.getElementById('floating-text');
        if (floatingText) {
            navItems.forEach(item => {
                item.addEventListener('focus', () => {
                    const textSpan = item.querySelector('span');
                    const text = textSpan ? textSpan.textContent : item.textContent;
                    const rect = item.getBoundingClientRect();
                    floatingText.textContent = text;
                    floatingText.style.top = `${rect.top + (rect.height / 2)}px`;
                    floatingText.classList.add('visible');
                });
                item.addEventListener('blur', () => floatingText.classList.remove('visible'));
            });
        }

        if (infoBtn) {
            infoBtn.addEventListener('click', () => {
                const item = carouselItems[currentIndex];
                if (!item) return;
                if (item.type === 'movie') {
                    router.loadView('movie-details', { 
                        callback: () => setupMovieDetailsPage({ streamId: item.i, tmdbId: item.tmi, containerExtension: item.container_extension })
                    });
                } else if (item.type === 'series') {
                    router.loadView('series-details', { 
                        callback: () => setupSeriesDetailsPage({ seriesId: item.i, tmdbId: item.tmi }) 
                    });
                }
            });
        }

        if (nextBtn) nextBtn.addEventListener('click', () => {
            if (carouselTimer) clearInterval(carouselTimer);
            if (carouselItems.length > 0) {
                currentIndex = (currentIndex + 1) % carouselItems.length;
                renderSlide(currentIndex);
            }
        });

        if (prevBtn) prevBtn.addEventListener('click', () => {
            if (carouselTimer) clearInterval(carouselTimer);
            if (carouselItems.length > 0) {
                currentIndex = (currentIndex - 1 + carouselItems.length) % carouselItems.length;
                renderSlide(currentIndex);
            }
        });

        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                const icon = refreshBtn.querySelector('i');
                if(icon) icon.classList.add('fa-spin'); 
                try { await forceAppRefresh(); } 
                catch (e) { console.error(e); } 
                finally { if(icon) icon.classList.remove('fa-spin'); }
            });
        }

        if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
        try {
            // 1. Solo borramos la sesión del usuario
            sessionManager.clearSession();
            
            // 2. ELIMINADOS: DataManager.clearAllData() y localStorage.clear()
            // Al no borrarlos, la próxima vez que alguien entre, 
            // la app no tendrá que descargar todo de nuevo.

            Logger.info("Logout: Sesion cerrada, reiniciando al Login...");
            window.location.reload(); 
        } catch (e) {
            Logger.error("Error during logout", "HomePage", e);
            window.location.reload();
        }
    });
}

        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                router.loadView('settings', { callback: setupSettingsPage });
            });
        }

        if (liveNav) liveNav.addEventListener('click', () => router.loadView('content', { callback: setupContentView, type: 'livetv' }));
        if (moviesNav) moviesNav.addEventListener('click', () => router.loadView('content', { callback: setupContentView, type: 'movies' }));
        if (seriesNav) seriesNav.addEventListener('click', () => router.loadView('content', { callback: setupContentView, type: 'series' }));
        if (homeExitYesBtn) homeExitYesBtn.addEventListener('click', confirmExitApp);
        if (homeExitNoBtn) homeExitNoBtn.addEventListener('click', hideHomeExitModal);

        const homeContainer = document.querySelector('.view-home');
        if (homeContainer) {
            homeContainer.addEventListener('focus', (e) => {
                const modalOverlay = document.getElementById('home-exit-modal');
                const isInsideModal = modalOverlay && modalOverlay.contains(e.target);
                if (e.target && e.target.id && !isInsideModal) {
                    lastFocusedId = e.target.id;
                }
            }, true); 
        }
    } 

    if (!window.__smartSyncTriggered) {
        window.__smartSyncTriggered = true;
        smartDataSync();
        if (typeof startAutoPreload === 'function') startAutoPreload();
    }

    homeLoginFocus.uiShowModal = showHomeExitModal;
    homeLoginFocus.uiHideModal = hideHomeExitModal;

    if (homeLoginFocus && typeof homeLoginFocus.init === 'function') {
        homeLoginFocus.init();
    }
    try {
        if (carouselItems.length === 0) {
             const cachedItems = await CarouselRepository.getCarouselItems();
             if (cachedItems && cachedItems.length > 0) {
                 carouselItems = cachedItems;
                 startCarousel();
             } else {
                 if(titleEl) titleEl.textContent = "Cargando destacados...";
                 CarouselRepository.generateAndSave().then(async () => {
                     const freshItems = await CarouselRepository.getCarouselItems();
                     if(freshItems.length > 0) {
                         carouselItems = freshItems;
                         startCarousel();
                     }
                 });
             }
        } else {
            startCarousel();
        }
    } catch (err) { Logger.error("Error setting up carousel", "HomePage", err); }

    window.focus();
    if (document.body) document.body.focus();

    try {
        let targetId = lastFocusedId;
        if (!targetId) targetId = 'nav-refresh';
        const focusTarget = await waitForElement(`#${targetId}`);
        if (focusTarget) {
            focusTarget.setAttribute('tabindex', '0');

            requestAnimationFrame(() => {
                homeLoginFocus.setFocus(focusTarget);
            });
        } else {
            const fallback = document.querySelector('.focusable');
            if (fallback) {
                homeLoginFocus.setFocus(fallback);
            }
        }
    } catch (error) {
        Logger.error("Error setting focus on HomePage", "HomePage", error);
    }
}

function safeText(value, fallback = 'N/A') {
    return value == null || value === '' ? fallback : String(value);
}

function renderSlide(index) {
    if (!carouselItems[index]) return;
    
    const titleEl = document.getElementById("pill-title");
    const typeEl = document.getElementById("pill-type");
    const yearEl = document.getElementById("pill-year");
    const genresEl = document.getElementById("left-genres");
    const plotEl = document.getElementById("pill-plot");
    const pillImageEl = document.getElementById("pillImage");
    const item = carouselItems[index];
    const itemType = (item.type === 'movie') ? 'Película' : 'Serie';
    const releaseDate = item.releaseDate || item.release_date || '';
    const year = (releaseDate && releaseDate.length > 3) ? releaseDate.substring(0, 4) : 'N/A';
    const plot = safeText(item.plot, 'Sinopsis no disponible.');
    
    if (titleEl) titleEl.textContent = safeText(item.n, 'Sin Título');
    if (typeEl) typeEl.textContent = itemType;
    if (yearEl) yearEl.innerHTML = `<span class="value-label">AÑO:</span> ${year}`;
    
    if (genresEl) {
         genresEl.innerHTML = '';
         const genreString = safeText(item.genre, '');
         let genreList = [];
         if (genreString.includes(',')) {
            genreList = genreString.split(',').map(g => g.trim()).filter(g => g.length > 0);
         } else if (genreString.length > 0) {
            genreList = [genreString];
         }
         const finalList = genreList.slice(0, 3); 
         finalList.forEach(genreName => {
             const capsule = document.createElement('span');
             capsule.className = 'genre-capsule'; 
             capsule.textContent = genreName;
             genresEl.appendChild(capsule);
         });
    }

    if (plotEl) plotEl.textContent = plot;
    if (pillImageEl) pillImageEl.style.backgroundImage = `url(${item.p || 'assets/img/poster-placeholder-small.png'})`;
}

function startCarousel() {
    if (carouselTimer) clearInterval(carouselTimer);
    if (carouselItems.length === 0) return;
    
    renderSlide(currentIndex);
    
    carouselTimer = setInterval(() => {
        currentIndex = (currentIndex + 1) % carouselItems.length;
        renderSlide(currentIndex);
    }, 5000);
}