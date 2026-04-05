// js/views/SeriesDetails.js

import { SeriesRepository } from '../repositories/SeriesRepository.js';
import { SeriesDetailsFocus } from '../core/SeriesDetailsFocus.js';
import { DB } from '../db/db.js';
import { router } from '../core/router.js';
import { setupPlayerPage } from './PlayerPage.js';
import { setupContentView } from './ContentPage.js';
import { Logger } from '../../utils/logger.js';

const spinnerOverlayMarkup = `
<div id="details-loader-overlay" class="details-loader-overlay">
  <div class="loading-diamonds">
    <div class="diamond"></div>
    <div class="diamond middle"></div>
    <div class="diamond"></div>
  </div>
</div>
`;

const seriesDetailsMarkup = `
<div id="series-details-view" class="detail-view series-view hidden">
    <main class="detail-main">
        <div class="poster-column">
            <div id="series-details-logo" class="details-logo logo focusable" data-zone="logo" tabindex="0"></div>
            <img id="series-poster" class="detail-poster" alt="Cargando...">
        </div>

        <div class="info-column">
            <section class="top-info-section meta-plot-row">
                <div id="series-meta-box" class="meta-box focusable" data-zone="meta" tabindex="0">
                    <h1 id="series-title" class="title-text">TÍTULO DE LA SERIE</h1>
                    <p id="series-tagline" class="metadata-text tagline-text"></p>
                    <p id="series-year" class="metadata-text"></p>
                    <p id="series-seasons-count" class="metadata-text runtime-info"></p>
                    <p id="series-rating" class="metadata-text rating-info"></p>
                    <p id="series-genres" class="metadata-text genres-list"></p>
                </div>
                
                <div class="plot-box">
                    <p class="plot-label">SINOPSIS</p>
                    <div id="series-plot-text" class="plot-text"></div>
                </div>
            </section>

            <section id="series-buttons" class="buttons-bar">
                <button id="btn-play-series" class="detail-btn focusable" data-zone="buttons" tabindex="0">
                    REPRODUCIR
                </button>
                <button id="btn-resume-series" class="detail-btn focusable hidden" data-zone="buttons" tabindex="0">
                    REANUDAR
                </button>
            </section>

            <section id="details-extra" class="additional-info-box focusable" tabindex="0">
                <h3 class="section-title">TEMPORADAS Y EPISODIOS</h3>
                
                <div id="seasons-list-container" class="seasons-list-container">
                     <div id="seasons-list" class="horizontal-list" data-zone="seasons"></div>
                </div>

                <div id="episodes-list-container" class="episodes-list-container">
                     <h4 id="episodes-title" class="section-title">Episodios</h4>
                     <ul id="episodes-list" class="vertical-list" data-zone="episodes"></ul>
                </div>
            </section>
        </div>
    </main>
</div>
`;

function safeText(value, fallback = '') {
    return value == null ? fallback : String(value);
}

function generateStarsHTML(ratingBase5) {
    if (ratingBase5 === 'N/A' || Number(ratingBase5) === 0) return '<span class="value-label">N/A</span>';
    const rating = Number(ratingBase5);
    let starsHTML = '';
    const fullStars = Math.floor(rating);
    const hasHalfStar = (rating - fullStars) >= 0.3 && (rating - fullStars) <= 0.8;
    const fullStarsRounded = (rating - fullStars) > 0.8 ? fullStars + 1 : fullStars;
    const emptyStars = 5 - fullStarsRounded - (hasHalfStar ? 1 : 0);

    for (let i = 0; i < fullStarsRounded; i++) starsHTML += '<i class="fas fa-star star-gold"></i>';
    if (hasHalfStar) starsHTML += '<i class="fas fa-star-half-alt star-gold"></i>';
    for (let i = 0; i < emptyStars; i++) starsHTML += '<i class="far fa-star star-empty"></i>';
    return starsHTML;
}

export async function setupSeriesDetailsPage(props) {
    const { seriesId, tmdbId } = props;

    if (!seriesId) {
        Logger.warn('SeriesDetails: Series ID missing');
        return;
    }

    const appContainer = document.getElementById('app-container');
    if (appContainer) {
        appContainer.innerHTML = seriesDetailsMarkup;
        appContainer.insertAdjacentHTML('beforeend', spinnerOverlayMarkup);
    }
    const loaderOverlay = document.getElementById('details-loader-overlay');
    const viewRoot = document.getElementById('series-details-view');
    const titleEl = document.getElementById('series-title');
    const yearEl = document.getElementById('series-year');
    const seasonsCountEl = document.getElementById('series-seasons-count');
    const ratingEl = document.getElementById('series-rating');
    const genresEl = document.getElementById('series-genres');
    const plotEl = document.getElementById('series-plot-text');
    const seasonsListEl = document.getElementById('seasons-list');
    const episodesTitleEl = document.getElementById('episodes-title');
    const taglineEl = document.getElementById('series-tagline');
    const posterEl = document.getElementById('series-poster');

    try {
        const baseDataPromise = DB.getByKey('series', Number(seriesId));
        const richDataPromise = SeriesRepository.getSeriesDetails(seriesId);
        
        const progressMapPromise = SeriesRepository.getResumeInfo(seriesId);
        const resumeBtnPromise = SeriesRepository.getResumeButtonData(seriesId);
        
        const [baseData, richData, progressInfo, resumeBtnData] = await Promise.all([
            baseDataPromise, 
            richDataPromise, 
            progressMapPromise,
            resumeBtnPromise
        ]);
        const progressMap = progressInfo.map || {};
        if (loaderOverlay) loaderOverlay.remove();
        const details = richData || {};
        const basic = baseData || {};
        const finalTitle = details.n || basic.name || basic.n || 'Serie Desconocida';
        const finalPoster = details.p || basic.cover || basic.p || 'assets/logo/placeholder-actor.png';
        const finalPlot = details.s || basic.plot || 'Sinopsis no disponible.';
        const finalGenre = details.g || '';
        const finalDate = details.t || basic.last_modified || '';
        const finalRating = details.r5 || basic.rating_5based || 0;        
        const rawEpisodes = details.episodes || [];
        const episodesBySeason = {};
        
        if (Array.isArray(rawEpisodes)) {
            rawEpisodes.forEach(ep => {
                const sNum = ep.season || ep.season_num || 1; 
                if (!episodesBySeason[sNum]) episodesBySeason[sNum] = [];
                episodesBySeason[sNum].push(ep);
            });
        } else {
             Object.assign(episodesBySeason, rawEpisodes);
        }
        const seasons = Object.keys(episodesBySeason).sort((a,b) => Number(a) - Number(b));
        titleEl.textContent = finalTitle;
        const len = finalTitle.length;
        if (len > 45) titleEl.classList.add('title-small');
        else if (len >= 20) titleEl.classList.add('title-medium');

        let yearValue = 'N/A';
        if (finalDate) {
            if (!isNaN(finalDate) && String(finalDate).length > 1) {
                 const d = new Date(Number(finalDate) * 1000);
                 yearValue = d.getFullYear();
            } else if (String(finalDate).length >= 4) {
                yearValue = String(finalDate).substring(0, 4);
            }
        }
        
        yearEl.innerHTML = `<span class="value-label">AÑO:</span> <span class="value-large">${yearValue}</span>`;
        seasonsCountEl.innerHTML = `<span class="value-label">TEMPORADAS:</span> <span class="value-large">${seasons.length || 0}</span>`;
        ratingEl.innerHTML = `<span class="value-label">RATING:</span> <div id="series-rating-stars">${generateStarsHTML(finalRating)}</div>`;

        if (finalGenre) {
            genresEl.innerHTML = finalGenre.split(',').map(g => `<span class="genre-item">${g.trim()}</span>`).join('');
        }

        const PLOT_LIMIT = 380;
        let plotDisplay = finalPlot;
        if (plotDisplay.length > PLOT_LIMIT) plotDisplay = plotDisplay.substring(0, PLOT_LIMIT) + '...';
        plotEl.textContent = plotDisplay;
        if (taglineEl && details.tagline) taglineEl.textContent = `"${details.tagline}"`;
        if (posterEl) posterEl.src = finalPoster;
        seasonsListEl.innerHTML = '';
        let initialSeason = seasons[0];
        if (progressInfo.resume) {
            initialSeason = String(progressInfo.resume.season);
        } else if (progressInfo.last_seen) {
             initialSeason = String(progressInfo.last_seen.season);
        }

        seasons.forEach((seasonNum) => {
            const seasonBtn = document.createElement('div');
            seasonBtn.className = 'season-item focusable';
            seasonBtn.setAttribute('data-zone', 'seasons');
            seasonBtn.tabIndex = 0;
            seasonBtn.textContent = `Temporada ${seasonNum}`;

            if (String(seasonNum) === String(initialSeason)) seasonBtn.classList.add('selected');

            seasonBtn.addEventListener('click', () => {
                document.querySelectorAll('.season-item').forEach(btn => btn.classList.remove('selected'));
                seasonBtn.classList.add('selected');
                renderEpisodes(episodesBySeason[seasonNum], seasonNum, progressMap);
                if(SeriesDetailsFocus && typeof SeriesDetailsFocus.focusZone === 'function') {
                    SeriesDetailsFocus.focusZone('episodes');
                }
            });
            seasonsListEl.appendChild(seasonBtn);
        });

        if (seasons.length > 0) {
            renderEpisodes(episodesBySeason[initialSeason], initialSeason, progressMap);
        } else {
            episodesTitleEl.textContent = 'No se encontraron episodios.';
        }

        const btnResume = document.getElementById('btn-resume-series');
        const btnPlay = document.getElementById('btn-play-series');
        const cleanBtnResume = btnResume.cloneNode(true);
        btnResume.parentNode.replaceChild(cleanBtnResume, btnResume);
        const cleanBtnPlay = btnPlay.cloneNode(true);
        btnPlay.parentNode.replaceChild(cleanBtnPlay, btnPlay);
        
        if (resumeBtnData) {
            cleanBtnResume.innerText = resumeBtnData.fullText; 
            cleanBtnResume.classList.remove('hidden');
            cleanBtnPlay.innerText = "VER DESDE INICIO";
            
            cleanBtnResume.addEventListener('click', async () => {
                cleanBtnResume.innerText = "Cargando...";
                
                // Buscamos el episodio objetivo usando IDs flexibles
                const targetEp = rawEpisodes.find(e => {
                    const eId = e.id || e.stream_id || e.i;
                    return String(eId) === String(resumeBtnData.episodeId);
                });

                if (targetEp) {
                    const seasonNum = targetEp.season || targetEp.season_num;
                    const seasonEpisodes = episodesBySeason[seasonNum];
                    const playlist = await buildPlaylistFromEpisodes(seasonEpisodes);
                    
                    // Buscamos índice en la playlist
                    const playlistIndex = playlist.findIndex(p => String(p.id) === String(resumeBtnData.episodeId));
                    
                    if (playlistIndex !== -1) {
                        callPlayer(playlist, playlistIndex, seasonNum, resumeBtnData.startTime);
                    }
                } else {
                   Logger.error("Next Episode not found via ID matching");
                }
            });

        } else {
            cleanBtnResume.classList.add('hidden');
            cleanBtnPlay.innerText = "REPRODUCIR";
        }

        cleanBtnPlay.addEventListener('click', async () => {
             const firstSeasonNum = seasons[0];
             const firstSeasonEps = episodesBySeason[firstSeasonNum];
             cleanBtnPlay.innerText = "Cargando...";
             const playlist = await buildPlaylistFromEpisodes(firstSeasonEps);
             
             if(playlist.length > 0) {
                 callPlayer(playlist, 0, firstSeasonNum, 0);
             }
        });

        const logoButton = document.getElementById('series-details-logo');
        if (logoButton) {
            logoButton.addEventListener('click', () => {
                router.loadView('content', { callback: setupContentView, type: 'series' });
            });
        }

    } catch (error) {
        Logger.error("Error getting series details:", error);
        if (loaderOverlay) loaderOverlay.innerHTML = '<h1 style="color:var(--warning)">Error al cargar</h1>';
    }
    
    if (SeriesDetailsFocus) SeriesDetailsFocus.init();
    if(viewRoot) viewRoot.classList.remove('hidden');

    // -------------------------------------------------------------
    // FUNCIÓN DE RENDERIZADO CORREGIDA PARA DATOS NORMALIZADOS
    // -------------------------------------------------------------
    async function renderEpisodes(episodes, seasonNum, progressData = {}) {
        const episodesListEl = document.getElementById('episodes-list');
        const episodesTitleEl = document.getElementById('episodes-title');
        if (!episodesListEl || !episodesTitleEl) return;

        episodesTitleEl.textContent = `Episodios de Temp. ${seasonNum}`;
        episodesListEl.innerHTML = '';

        if (!Array.isArray(episodes) || episodes.length === 0) {
            episodesListEl.innerHTML = `<li class="episode-item-empty">No hay episodios.</li>`;
            return;
        }

        const playlist = await buildPlaylistFromEpisodes(episodes);

        episodes.forEach((ep) => {
            // DETECTAR ID (NORMALIZADO O CRUDO)
            const realId = ep.id || ep.stream_id || ep.i;

            const li = document.createElement('li');
            li.className = 'episode-item focusable';
            li.setAttribute('data-zone', 'episodes');
            li.setAttribute('data-ep-id', realId);
            li.tabIndex = 0;
            
            // Lógica de Progreso
            let pState = null;
            if (progressData && progressData[String(realId)]) {
                 pState = progressData[String(realId)];
            }

            if (pState) {
                if (pState.status === 'watched') li.classList.add('is-watched');
                else if (pState.status === 'watching') {
                    li.classList.add('is-watching');
                    const percent = Math.min(100, Math.round((pState.time / pState.duration) * 100));
                    const bar = document.createElement('div');
                    bar.style.cssText = `position:absolute;bottom:0;left:0;height:3px;background:#FF6A00;width:${percent}%;`;
                    li.appendChild(bar);
                }
            }

            // Datos visuales (usamos la playlist generada para tener datos limpios)
            const playlistItem = playlist.find(p => String(p.id) === String(realId));
            const playlistIndex = playlist.findIndex(p => String(p.id) === String(realId));
            
            // Fallback visual si falla la playlist
            const displayTitle = playlistItem ? playlistItem.title : `Episodio ${ep.episode_num || ep.num || '?'}`;
            const displayCover = playlistItem ? playlistItem.cover : (ep.p || ep.cover || 'assets/logo/placeholder-episode.png');
            const displayPlot  = playlistItem ? playlistItem.plot : (ep.s || ep.plot || '');

            li.innerHTML += `
                <img src="${displayCover}" class="episode-cover" alt="" loading="lazy">
                <div class="episode-meta">
                    <span class="episode-title">${displayTitle}</span>
                    <span class="episode-plot">${displayPlot}</span>
                </div>
            `;
            
            if (playlistItem) {
                li.addEventListener('click', () => {
                    let startTime = 0;
                    if (progressData && progressData[String(realId)]) {
                          const pData = progressData[String(realId)];
                          if (pData.status === 'watching') startTime = pData.time;
                    }
                    callPlayer(playlist, playlistIndex, seasonNum, startTime);
                });
            } else {
                li.classList.add('disabled');
            }
            episodesListEl.appendChild(li);
        });

        if (SeriesDetailsFocus && typeof SeriesDetailsFocus.reindexEpisodes === 'function') {
             SeriesDetailsFocus.reindexEpisodes();
        }
    }

    function callPlayer(playlist, startIndex, seasonNum, startTime = 0) {
        const episodeToPlay = playlist[startIndex];
        if (!episodeToPlay) return;

        const returnContext = {
            view: 'series-details',
            params: { seriesId, tmdbId, season: seasonNum, focusIndex: startIndex },
            callback: () => setupSeriesDetailsPage({ seriesId, tmdbId }),
            restore: (p = {}) => {
                router.loadView('series-details', {
                    seriesId: p.seriesId || seriesId,
                    tmdbId: p.tmdbId || tmdbId,
                    callback: () => {
                        setupSeriesDetailsPage({ seriesId, tmdbId });
                        setTimeout(() => {
                            try { if (window.SeriesDetailsFocus) window.SeriesDetailsFocus.setFocusIndex(p.focusIndex || startIndex, 'episodes'); 
                            } catch(e){Logger.error("Error setting focus index", e);}
                        }, 100);
                    }
                });
            }
        };

        router.loadView('player', {
            media: [playlist, startIndex],
            type: 'series',
            meta: {
                title: episodeToPlay.title,
                startTime: startTime,
                streamId: episodeToPlay.id,
                containerExtension: episodeToPlay.containerExtension,
                image: episodeToPlay.cover,
                seriesId: seriesId,
                season: seasonNum,
                episode_num: episodeToPlay.episode_num
            },
            callback: () => {
                setupPlayerPage(
                    [playlist, startIndex],
                    'series',
                    {
                        title: episodeToPlay.title,
                        startTime: startTime,
                        streamId: episodeToPlay.id,
                        containerExtension: episodeToPlay.containerExtension,
                        image: episodeToPlay.cover,
                        seriesId: seriesId,
                        season: seasonNum,
                        episode_num: episodeToPlay.episode_num
                    }, 
                    returnContext
                );
            }
        });
    }
}

// -------------------------------------------------------------
// HELPER: CONSTRUCTOR DE PLAYLIST QUE ENTIENDE FORMATO NORMALIZADO
// -------------------------------------------------------------
async function buildPlaylistFromEpisodes(episodesList) {
    if (!Array.isArray(episodesList)) return [];
    
    const results = episodesList.map((ep) => {
        // 1. ID: Normalizado 'i', Stream 'stream_id' o Simple 'id'
        const streamId = ep.id || ep.stream_id || ep.i;
        if (!streamId) return null;
        
        // 2. Extensión: Normalizado 'e' o 'container_extension'
        const extension = ep.container_extension || ep.e || "mkv";
        const dummyUrl = "masked://series"; 
        
        // 3. Título: Normalizado 'n' o 'title'
        const rawTitle = ep.title || ep.n || ep.name || 'Episodio';
        const epNum = ep.episode_num || ep.num || '?';
        
        // 4. Imagen: Normalizado 'p', 'cover' o 'info.movie_image'
        const cover = ep.p || ep.cover || ep.poster || ep.info?.movie_image || 'assets/logo/placeholder-episode.png';
        
        // 5. Sinopsis: Normalizado 's' o 'plot'
        const plot = safeText(ep.s || ep.plot || ep.info?.plot || ep.description, '');

        return {
            id: streamId,
            containerExtension: extension,
            title: `E${epNum}: ${safeText(rawTitle)}`,
            url: dummyUrl,
            cover: cover,
            plot: plot,
            episode_num: epNum,
            season: ep.season || ep.season_num
        };
    });

    return results.filter(Boolean);
}