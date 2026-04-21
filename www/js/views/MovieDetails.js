// js/views/MovieDetails.js

import { MoviesRepository } from '../repositories/MoviesRepository.js';
import { MovieDetailsFocus } from '../core/MovieDetailsFocus.js';
import { router } from '../core/router.js';
import { setupContentView } from './ContentPage.js';
import { setupPlayerPage } from './PlayerPage.js'; 
import { DB } from '../db/db.js';
import { Logger } from '../../../utils/logger.js';


const TMDB_POSTER_IMG = "https://image.tmdb.org/t/p/w342";
const TMDB_CAST_IMG = "https://image.tmdb.org/t/p/w185";

const spinnerOverlayMarkup = `
<div id="details-loader-overlay" class="details-loader-overlay">
  <div class="loading-diamonds">
    <div class="diamond"></div>
    <div class="diamond middle"></div>
    <div class="diamond"></div>
  </div>
</div>
`;

const movieDetailsMarkup = `
<div id="movie-details-view" class="detail-view hidden">
  <section id="top-content-area" class="top-content-area">
    <div class="poster-column">
      <div id="details-logo" class="logo focusable" data-zone="logo" tabindex="0"></div>
      <img id="movie-poster" class="detail-poster" alt="Cargando...">
    </div>
    <div class="info-column">
      <div class="meta-plot-row">
        <div class="meta-box">
          <h1 id="movie-title" class="title-text">TÍTULO DE LA PELÍCULA</h1>
          <p id="movie-tagline" class="metadata-text tagline-text"></p>
          <p id="movie-year" class="metadata-text">AÑO: </p>
          <p id="movie-runtime" class="metadata-text runtime-info"></p>
          <p id="movie-rating" class="metadata-text rating-info"></p>
          <p id="movie-genres" class="metadata-text genres-list"></p>
        </div>
        <div class="plot-box">
          <p class="plot-label">SINOPSIS</p>
          <div id="movie-plot-text" class="plot-text"></div>
        </div>
      </div>
      <section id="details-buttons" class="buttons-bar">
        <button id="btn-play" class="detail-btn focusable" data-zone="buttons" tabindex="0">REPRODUCIR</button>
        <button id="btn-continue" class="detail-btn focusable hidden" data-zone="buttons" tabindex="0">CONTINUAR</button>
      </section>
    </div>
  </section>
  <section id="details-extra" class="additional-info-box focusable hidden" tabindex="0">
    <h3 class="section-title">REPARTO Y TRAILER</h3>
    <div class="cast-and-trailer-container">
      <button id="btn-trailer" class="trailer-btn focusable hidden" data-zone="cast" tabindex="0">VER TRAILER</button>
      <div id="cast-list" class="horizontal-list"></div>
    </div>
  </section>
</div>
`;

function safeText(value, fallback = '') {
  return value == null ? fallback : String(value);
}


/**
 * @param {object} props
 */
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

/**
 * @param {object} props
 */
export async function setupMovieDetailsPage(props) {
  const { streamId: i, tmdbId: tmi, containerExtension: e } = props;
  if (!i || !tmi) { console.error('Faltan IDs'); return; }
  const appContainer = document.getElementById('app-container');
  if (!appContainer) return;
  appContainer.innerHTML = ''; 
  appContainer.innerHTML = movieDetailsMarkup;
  appContainer.insertAdjacentHTML('beforeend', spinnerOverlayMarkup);
  const viewRoot = document.getElementById('movie-details-view');
  try {
    let baseData = await DB.getByKey('movies', Number(i)) || {};
    let details = await MoviesRepository.getMovieDetails(i, tmi);
    if (!details || Object.keys(details).length === 0) {
        details = baseData || {};
    }
    const progressInfo = await MoviesRepository.getResumeInfo(i);
    const finalTitle = safeText(details.n || baseData.n || 'Cargando...');
    const rawPoster = details.p || baseData.p || baseData.stream_icon || details.poster_path;
    const finalPoster = rawPoster
      ? (rawPoster.startsWith('/') ? `${TMDB_POSTER_IMG}${rawPoster}` : rawPoster)
      : 'assets/img/poster-placeholder-small.png';
    const releaseDate = details.t || details.release_date || null;
    const genres = details.g ? details.g.split('/') : [];
    const ratingValue = details.r5 || 0;
    const duration = details.d || details.runtime || 'N/A';
    const tagline = details.tagline || '';
    const director = details.dr || null;
    const titleEl = document.getElementById('movie-title');
    titleEl.textContent = finalTitle;
    const len = finalTitle.length;
    if (len > 45) titleEl.classList.add('title-small');
    else if (len >= 33) titleEl.classList.add('title-medium');
    else if (len >= 20) titleEl.classList.add('title-medium-large');

    document.getElementById('movie-runtime').innerHTML =
      `<span class="value-label">DURACIÓN:</span> <span class="value-large">${duration}</span>`;
    document.getElementById('movie-year').innerHTML =
      `<span class="value-label">AÑO:</span> <span class="value-large">${releaseDate ? releaseDate.split('-')[0] : 'N/A'}</span>`;

    const ratingEl = document.getElementById('movie-rating');
    ratingEl.innerHTML =
      `<span class="value-label">RATING:</span> <div id="movie-rating-stars">${generateStarsHTML(ratingValue)}</div>`;

    const genresEl = document.getElementById('movie-genres');
    if (genres.length > 0) {
      genresEl.innerHTML = genres.map(g => `<span class="genre-item">${g.trim()}</span>`).join('');
    } else {
      genresEl.textContent = 'N/A';
    }

    const taglineEl = document.getElementById('movie-tagline');
    if (taglineEl) taglineEl.textContent = tagline ? `"${tagline}"` : '';

    const posterNode = document.getElementById('movie-poster');
    posterNode.src = finalPoster;
    posterNode.alt = finalTitle;

    const PLOT_LIMIT = 380;
    let plotText = safeText(details.s || 'Sinopsis no disponible.');
    if (plotText.length > PLOT_LIMIT) plotText = plotText.substring(0, PLOT_LIMIT) + '...';
    document.getElementById('movie-plot-text').textContent = plotText;

const castArray = Array.isArray(details.ca) ? details.ca : [];
    const castSection = document.getElementById('details-extra');
    const castListNode = document.getElementById('cast-list');
    if (castListNode) castListNode.innerHTML = '';
if (director) {
  castSection.classList.remove('hidden');
  const card = document.createElement('div');
  card.className = 'cast-card focusable director-card';
  card.setAttribute('data-zone', 'cast');
  card.tabIndex = 0;

  const img = document.createElement('img');
  img.className = 'cast-photo';

  let dirName = "";
  let dirPhoto = null;

  if (typeof director === 'object') {
      dirName = director.n;
      dirPhoto = director.p;
  } else { dirName = director;}

  if (dirPhoto) {
      img.src = `${TMDB_CAST_IMG}${dirPhoto}`;
  } else { img.src = 'assets/placeholder/director_ph.png';}

  const name = document.createElement('p');
  name.className = 'cast-name';
  name.textContent = dirName;
  const character = document.createElement('p');
  character.className = 'cast-character';
  character.textContent = "Director";

  card.appendChild(img);
  card.appendChild(name);
  card.appendChild(character);
  castListNode.appendChild(card);
}

if (castArray.length > 0) {
  castSection.classList.remove('hidden');
  castArray.forEach(actor => {
    const card = document.createElement('div');
    card.className = 'cast-card focusable';
    card.setAttribute('data-zone', 'cast');
    card.tabIndex = 0;
    const img = document.createElement('img');
    img.className = 'cast-photo';
    img.src = actor.p
      ? `${TMDB_CAST_IMG}${actor.p}`
      : 'assets/placeholder/cast_ph.png';

    const name = document.createElement('p');
    name.className = 'cast-name';
    name.textContent = actor.n || "";
    const character = document.createElement('p');
    character.className = 'cast-character';
    character.textContent = actor.ch || "";
    card.appendChild(img);
    card.appendChild(name);
    card.appendChild(character);
    castListNode.appendChild(card);
  });
}
    let videoUrl = null;
    try {
        videoUrl = await MoviesRepository.getStreamUrl(details);
    } catch (e) {
        Logger.error("Error creating movies url", "MovieDetails", e);
    }

    const btnPlay = document.getElementById('btn-play');
    const btnContinue = document.getElementById('btn-continue');
    const newBtnPlay = btnPlay.cloneNode(true);
    btnPlay.parentNode.replaceChild(newBtnPlay, btnPlay);
    const newBtnContinue = btnContinue.cloneNode(true);
    btnContinue.parentNode.replaceChild(newBtnContinue, btnContinue);
    const formatSecs = (s) => {
        const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
        return h>0 ? `${h}h ${m}m` : `${m}m`;
    };

    const playMovie = (startTime = 0) => {
        if (!videoUrl) return;
        const returnContext = {
          view: 'movie-details',
          params: { streamId: i, tmdbId: tmi, containerExtension: e },
          callback: () => setupMovieDetailsPage({ streamId: i, tmdbId: tmi, containerExtension: e }),
          restore: (p = {}) => {
            router.loadView('movie-details', { ...p, callback: () => setupMovieDetailsPage(p) });
          }
        };

        router.loadView('player', {
            callback: () => {
                setupPlayerPage(videoUrl, 'movie', {
                    title: finalTitle,
                    image: finalPoster,
                    startTime: startTime,
                    streamId: i,
                    tmdbId: tmi,
                    containerExtension: details.e || e
                }, returnContext);
            }
        });
    };

    if (videoUrl) {
      newBtnPlay.classList.remove('disabled', 'hidden');
      
      if (progressInfo && progressInfo.time > 0) {
          newBtnContinue.classList.remove('hidden');
          newBtnContinue.textContent = `CONTINUAR (${formatSecs(progressInfo.time)})`;
          newBtnContinue.addEventListener('click', () => playMovie(progressInfo.time));
          newBtnPlay.textContent = "VER DESDE INICIO";
      } else {
          newBtnContinue.classList.add('hidden');
          newBtnPlay.textContent = "REPRODUCIR";
      }

      newBtnPlay.addEventListener('click', () => playMovie(0));

    } else {
      newBtnPlay.classList.add('disabled');
      newBtnPlay.textContent = "NO DISPONIBLE";
    }

    const btnTrailer = document.getElementById('btn-trailer');
    const trailers = details.videos?.results?.filter(v => v.site === 'YouTube' && v.type === 'Trailer') || [];
    if (btnTrailer && trailers.length > 0) {
      const trailerKey = trailers[0].key;
      btnTrailer.classList.remove('disabled', 'hidden');
      castSection.classList.remove('hidden');
      btnTrailer.addEventListener('click', () => {
        const ytUrl = `https://www.youtube.com/watch?v=${trailerKey}`;
        try {
          if (typeof tizen !== 'undefined' && tizen.application) {
            tizen.application.launchApp(
              "org.tizen.browser",
              new tizen.ApplicationControlData("http://tizen.org/appcontrol/data/url", [ytUrl]),
              () => Logger.info("Navegador de Tizen lanzado para ver trailer.", "MovieDetails"),
              (err) => Logger.error("Error al abrir el navegador de Tizen:", "MovieDetails", err)
            );
          } else {
            window.open(ytUrl, '_blank');
          }
        } 
        catch (error) {
          Logger.error("Error while trying to open trailer:", "MovieDetails", error);
        }
      });
    }

    const logoButton = document.getElementById('details-logo');
    if (logoButton) {
      logoButton.addEventListener('click', () => {
        router.loadView('content', { callback: setupContentView, type: 'movies' });
      });
    }

    if (typeof MovieDetailsFocus?.reindex === 'function') {
      MovieDetailsFocus.reindex();
    }
 
    const finalOverlay = document.getElementById('details-loader-overlay');
    if (finalOverlay) finalOverlay.remove();
   
    if (viewRoot) viewRoot.classList.remove('hidden');

  } catch (error) {
    Logger.error("fatal error in MovieDetails:", "MovieDetails", error);
    const overlay = document.getElementById('details-loader-overlay');
    if (overlay) {
      overlay.innerHTML = `
        <div style="text-align: center;">
          <h1 style="color: var(--warning); font-size: 24px;">Error al Cargar</h1>
          <p style="color: var(--text-sub);">No se pudieron obtener los detalles.</p>
        </div>`;
    }
  }

}