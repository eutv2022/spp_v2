// js/views/ContentPage.js

import { ContentFocus } from '../core/contentFocus.js';
import { router } from '../core/router.js';
import { LiveTVRepository } from '../repositories/LiveTVRepository.js';
import { MoviesRepository } from '../repositories/MoviesRepository.js';
import { SeriesRepository } from '../repositories/SeriesRepository.js';
import { FavoritesRepository } from '../repositories/FavoritesRepository.js';
import { DB } from '../db/db.js';
import { setupPlayerPage } from './PlayerPage.js';
import { setupHomePage } from './HomePage.js';
import { setupMovieDetailsPage } from './MovieDetails.js';
import { setupSeriesDetailsPage } from './SeriesDetails.js';
import { SettingsPreferences } from '../services/SettingsPreferences.js';
import { HistoryRepository } from '../repositories/HistoryRepository.js';
import { Logger } from '../../../utils/logger.js';


let currentViewCategoryId = null;
window._lastContentType = null;
let globalPinKeyHandlerRef = null;
let savedNavigationState = null;

const CONTENT_MARKUP = `
<div class="content-layout">
  <header class="content-header">
    <div id="content-logo" class="content-logo focusable" data-zone="logo">
      <img src="./assets/logo/return.png" alt="LionTV Logo" class="main-logo">
    </div>

    <div id="content-search" class="search-bar focusable" data-zone="search" tabindex="0" aria-label="Buscar">
      <i class="fas fa-search" aria-hidden="true"></i>
      <input id="search-input" type="search" placeholder="Buscar ..." aria-label="Buscar" class="search-input" tabindex="0" />
    </div>
  </header>

  <main class="content-main">
    <nav id="content-categories" class="content-column category-nav" data-zone="categories">
      <div id="category-title" class="column-title">Categorías</div>
      <div id="category-list-container" class="category-list"></div>
    </nav>

    <section id="content-grid" class="content-column" data-zone="grid">
      <div id="grid-title" class="column-title">Cargando...</div>
      <div id="channel-grid-container" class="grid-container"></div>
    </section>
  </main>
  <div id="pin-modal-overlay" class="settings-modal-overlay">
     <div class="settings-modal-content">
        <h2 class="modal-title" style="color: var(--warning);">Contenido Protegido</h2>
        <p style="color: var(--text-sub); margin-bottom: 20px;">Ingrese su PIN de acceso</p>
        
        <div id="pin-display-row" class="pin-row" style="margin-bottom: 30px;">
            <div class="pin-box"></div><div class="pin-box"></div><div class="pin-box"></div><div class="pin-box"></div>
        </div>

        <div id="pin-error-msg" style="color: var(--warning); height: 20px; font-weight: bold;"></div>
     </div>
  </div>
</div>
`;

let pressTimer = null;
let longPressTriggered = false;
let isPageActive = false;
let renderTimeout = null;

export function cleanupContentPage() {
    isPageActive = false; 
    if (renderTimeout) {
        clearTimeout(renderTimeout);
        renderTimeout = null;
    }
    if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
    }
    const container = document.getElementById('channel-grid-container');
    if (container) container.innerHTML = '';
}

export async function renderContentView() {
  const appContainer = document.getElementById('app-container');
  if (appContainer) {
    const html = (typeof CONTENT_MARKUP !== 'undefined' ? CONTENT_MARKUP : '<div id="channel-grid-container"></div>');
    appContainer.innerHTML = html.trim();
  }
  isPageActive = true; 
  const channelContainer = document.getElementById('channel-grid-container') || document.getElementById('grid-container');
  
  if (channelContainer) {
      channelContainer.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Enter') return;
        ev.preventDefault();
        if (ev.repeat || pressTimer) return;
        const focusedCard = document.activeElement.closest('.channel-card'); // Ojo con la clase, debe coincidir con createCardHTML
        if (!focusedCard) return;

        longPressTriggered = false;
        
        pressTimer = setTimeout(async () => {
          longPressTriggered = true;
          let type = window._lastContentType || 'movies'; 
          if(window.currentViewCategoryId === 'favorites' && focusedCard.dataset.type) {
              type = focusedCard.dataset.type === 'movie' ? 'movies' : focusedCard.dataset.type;
          }
          
          if (typeof toggleFavorite === 'function') await toggleFavorite(focusedCard, type);
        }, 500); 
      });

      channelContainer.addEventListener('keyup', (ev) => {
        if (ev.key !== 'Enter') return;
        
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }

        if (longPressTriggered) {
        } else {
           const focusedCard = document.activeElement.closest('.channel-card');
           if (focusedCard && typeof navigateToDetails === 'function') {
               navigateToDetails(focusedCard);
           }
        }
        longPressTriggered = false;
      });
  }
}

async function toggleFavorite(card, currentViewType = null) {
  if (!card) return;
  const { id, type: itemType } = card.dataset;
  if (!id || !itemType) return;

  const name = card.querySelector('.stream-name')?.textContent || 'Sin Título';
  const cover = card.querySelector('.channel-logo')?.dataset.orig || '';
  const uniqueKey = `${itemType}-${id}`;

  try {
    const existingSet = await FavoritesRepository.getAllIdsAsSet();
    const isFav = existingSet.has(uniqueKey);

    if (isFav) {
      if (typeof FavoritesRepository.removeByUniqueId === 'function') {
        await FavoritesRepository.removeByUniqueId(uniqueKey);
      } else {
        await FavoritesRepository.remove(id, itemType);
      }
      card.classList.remove('is-favorite');

      const activeCat = currentViewType === 'favorites' || currentViewCategoryId === 'favorites';
      if (activeCat) {
        card.remove();
        requestAnimationFrame(() => ContentFocus.reindexGrid());
      }
    } else {
      await FavoritesRepository.add({ id, type: itemType, name, cover });
      card.classList.add('is-favorite');
    }

    try {
      const allFavorites = await FavoritesRepository.getAll();
      const favoritesForThisType = allFavorites.filter(f => f.type === itemType);
      const categoryContainer = document.getElementById('category-list-container');
      if (categoryContainer) {
        const favButton = categoryContainer.querySelector('[data-category-id="favorites"]');
        if (favoritesForThisType.length > 0) {
          if (!favButton) {
            const buttonHTML = `<button class="btn category-btn focusable" data-category-id="favorites">★ Favoritos</button>`;
            categoryContainer.insertAdjacentHTML('afterbegin', buttonHTML);
            const newFavButton = categoryContainer.querySelector('[data-category-id="favorites"]');
            if (newFavButton) {
              newFavButton.addEventListener('click', async () => {
                document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('selected'));
                newFavButton.classList.add('selected');
                currentViewCategoryId = 'favorites';
                window._lastContentType = currentViewType || window._lastContentType;
                await loadAndRenderStreams('favorites', '★ Favoritos', window._lastContentType || 'movies');
              });
            }
            requestAnimationFrame(() => ContentFocus.reindexCategories());
          }
        } else if (favButton) {
          favButton.remove();
          requestAnimationFrame(() => ContentFocus.reindexCategories());
        }
      }
    } catch (err) {
      Logger.error('Error updating favorites category button', 'ContentPage', err);
    }
  } catch (err) {
    Logger.error('Error toggling favorite', 'ContentPage', err);
  }
}

export async function loadAndRenderStreams(categoryId, categoryName, type, opts = {}) {
  const channelContainer = document.getElementById('channel-grid-container') || document.getElementById('grid-container');
  const channelTitle = document.getElementById('channel-grid-title') || document.getElementById('grid-title');
  
  if (!channelContainer || !channelTitle) {
    Logger.warn("[ContentPage] loadAndRenderStreams: grid containers not found.");
    return;
  }

  window._lastContentType = type;
  channelContainer.innerHTML = '<div class="tizen-loader-text"><span>CARGANDO...</span></div>';
  channelTitle.textContent = categoryName || '';

  let items = [];

  if (opts.itemsOverride && Array.isArray(opts.itemsOverride)) {
      items = opts.itemsOverride;
      currentViewCategoryId = 'search_results';
  }
  else if (categoryId === 'history') {
      let repoType = type;
      if (type === 'movies') repoType = 'movie';
      const historyItems = await HistoryRepository.getByType(repoType);
      const recentLimit = historyItems.slice(0, 15);
      items = recentLimit.map(h => ({
          stream_id: h.id,
          name: h.name,
          stream_icon: h.image,
          tmdb_id: h.tmdbId,
          container_extension: h.extension,
          _is_history: true 
      }));
      
      currentViewCategoryId = 'history';
  }
  else if (categoryId === 'favorites') {
    const allFavorites = await FavoritesRepository.getAll(); 
    const resolvedItems = [];
    for (const fav of allFavorites) {
      if (!fav) continue;
      const originalId = fav?.itemId ?? (typeof fav?.id === 'string' ? fav.id.split('-').slice(1).join('-') : null);
      if (!originalId) continue;
      let expectedType = type === 'movies' ? 'movie' : (type === 'series' ? 'series' : 'livetv');
      if(type === 'livetv' && (fav.type === 'live' || fav.type === 'livetv')) expectedType = fav.type;
      if (fav.type !== expectedType) continue;
      let original = null;
      try {
         const storeName = type === 'movies' ? 'movies' : (type === 'series' ? 'series' : 'live_streams');
         original = await DB.getByKey(storeName, originalId);
         if(!original) original = await DB.getByKey(storeName, Number(originalId));
      } catch {Logger.error();}

      if (!original) {
        original = {
          stream_id: originalId,
          name: fav.name || 'Sin título',
          stream_icon: fav.cover || '',
          _is_offline_fav: true 
        };
      }
      resolvedItems.push(original);
    }
    items = resolvedItems;
    currentViewCategoryId = 'favorites';
  } 

  else {
    try {
      const waitForWorker = (dbKey) => new Promise(resolve => {
          const handler = (e) => {
              if (e.detail.key === dbKey) {
                  window.removeEventListener('db:updated', handler);
                  resolve(true); 
              }
          };
          window.addEventListener('db:updated', handler);
          setTimeout(() => { window.removeEventListener('db:updated', handler); resolve(false); }, 20000); 
      });

      if (type === 'livetv') {
        items = await LiveTVRepository.getStreamsForCategory(categoryId);
        if ((!items || items.length === 0) && categoryId) {
          LiveTVRepository.syncStreams(); 
          await waitForWorker('live_streams');
          items = await LiveTVRepository.getStreamsForCategory(categoryId);
        }
      } 
      else if (type === 'movies') {
        items = await MoviesRepository.getMoviesForCategory(categoryId);
        if ((!items || items.length === 0) && categoryId) {
          MoviesRepository.syncMoviesList();
          await waitForWorker('movies');
          items = await MoviesRepository.getMoviesForCategory(categoryId);
        }
      } 
      else if (type === 'series') {
        items = await SeriesRepository.getSeriesForCategory(categoryId);
        if ((!items || items.length === 0) && categoryId) {
          SeriesRepository.syncSeriesList();
          await waitForWorker('series');
          items = await SeriesRepository.getSeriesForCategory(categoryId);
        }
      }
      
      currentViewCategoryId = categoryId;
    } catch (err) {
      Logger.error("[ContentPage] loadAndRenderStreams error:", err);
      items = [];
    }
  }
  if (!isPageActive) { return; }
  const favoritesSet = await FavoritesRepository.getAllIdsAsSet();

  channelContainer.className = 'grid-container';
  if (type === 'livetv') channelContainer.classList.add('live-tv-grid');
  else channelContainer.classList.add('poster-grid');

  if (!Array.isArray(items) || items.length === 0) {
    channelContainer.innerHTML = `<h4 style="color:var(--text-sub); margin-top:40px;">No se encontraron items.</h4>`;
    requestAnimationFrame(() => ContentFocus.reindexGrid());
    return;
  }

  const BATCH_CREATE = 12;
  const MAX_CONCURRENT_IMG = 6;
  const PLACEHOLDER_SVG = "assets/logo/cont_placeholder.png"; 
  const TMDB_WIDTH = 154;
  const isLive = type === 'livetv';
  const IMG_WIDTH = isLive ? 220 : 180;
  const IMG_HEIGHT = isLive ? 124 : 260;
  
  channelContainer.innerHTML = '';
  let createIndex = 0;
  let activeImageLoads = 0;
  const imageLoadQueue = [];

  function enqueueImageLoad(imgEl, src) {
    imageLoadQueue.push({ imgEl, src });
    processQueue();
  }

function processQueue() {
    while (activeImageLoads < MAX_CONCURRENT_IMG && imageLoadQueue.length > 0) {
      const { imgEl, src } = imageLoadQueue.shift();
      activeImageLoads++;
      
      const finish = () => { 
          activeImageLoads--; 
          processQueue(); 
      };
      
      imgEl.onload = () => {
          imgEl.classList.add('loaded');
          if (!imgEl.src.includes('poster-placeholder')) {
              imgEl.classList.remove('is-placeholder');
          }
          finish();
      };

      imgEl.onerror = () => { 
          imgEl.onerror = null; 
          
          if (imgEl.src !== window.location.origin + '/' + PLACEHOLDER_IMG && !imgEl.src.includes('placeholder')) {
              imgEl.src = PLACEHOLDER_IMG;
              imgEl.classList.add('is-placeholder');
              finish();
          } else {
              finish();
          }
      };
      imgEl.src = src;
    }
  }

  function normalizeThumbUrl(url) {
    if (!url) return PLACEHOLDER_SVG;
    if (typeof url !== 'string') return PLACEHOLDER_SVG;
    if (isLive) return url || PLACEHOLDER_SVG;
    if (url.startsWith('/')) return `https://image.tmdb.org/t/p/w${TMDB_WIDTH}${url}`;
    return url;
  }

  function renderBatch() {

    if (!isPageActive) return;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < BATCH_CREATE && createIndex < items.length; i++, createIndex++) {
      const it = items[createIndex];
      const card = document.createElement('div');
      card.className = 'channel-card focusable';
      if (isLive) card.classList.add('channel-card--live');
      else card.classList.add('channel-card--poster');

      const itemStreamId = String(it.i || it.stream_id || it.id || '');
      const itemTmdbId   = String(it.tmi || it.tmdb_id || '');
      const itemExtension = String(it.e || it.container_extension || '');
      const itemName = it.n || it.name || '';
      const itemImg = it.p || it.stream_icon || it.cover || '';

      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.dataset.streamId = itemStreamId;
      card.dataset.tmdbId = itemTmdbId;
      card.dataset.extension = itemExtension;
      
      let itemType = 'livetv';
      if (type === 'movies') itemType = 'movie';
      else if (type === 'series') itemType = 'series';
      
      card.dataset.type = itemType;
      const uniqueId = itemType === 'series' ? (it.series_id || itemStreamId) : itemStreamId;
      card.dataset.id = uniqueId;

      const imgWrap = document.createElement('div');
      imgWrap.className = isLive ? 'channel-logo-wrap channel-logo-wrap--live' : 'channel-logo-wrap';
      const img = document.createElement('img');
      img.className = 'channel-logo';
      if (isLive) img.classList.add('channel-logo--live'); else img.classList.add('channel-logo--poster');
      
      img.alt = itemName;
      img.loading = 'lazy';
      img.width = IMG_WIDTH;
      img.height = IMG_HEIGHT;
      img.style.width = IMG_WIDTH + 'px';
      img.style.height = IMG_HEIGHT + 'px';
      img.style.objectFit = isLive ? 'contain' : 'cover';
      img.src = PLACEHOLDER_SVG; 
      
      const resolved = normalizeThumbUrl(itemImg);
      if (resolved.includes('poster-placeholder')) {
          img.classList.add('is-placeholder');
      }
      enqueueImageLoad(img, resolved);

      imgWrap.appendChild(img);

      const p = document.createElement('p');
      p.className = 'stream-name';
      p.textContent = itemName;

      if (!isLive) {
        const textOverlay = document.createElement('div');
        textOverlay.className = 'poster-name-overlay';
        textOverlay.appendChild(p);
        card.appendChild(imgWrap);
        card.appendChild(textOverlay);
      } else {
        card.appendChild(imgWrap);
        card.appendChild(p);
      }

      const heartIcon = document.createElement('div');
      heartIcon.className = 'favorite-icon';
      heartIcon.innerHTML = '<i class="fas fa-heart"></i>';
      card.appendChild(heartIcon);

      if (uniqueId && favoritesSet.has(`${itemType}-${uniqueId}`)) {
        card.classList.add('is-favorite');
      }
      card.addEventListener('click', (e) => {
          // Evitamos que el click se propague si pulsamos botones internos (como favoritos si tuviera)
          e.stopPropagation();
          
          // Sincronizamos el foco visual (usando la función que agregamos a ContentFocus)
          if (typeof ContentFocus.syncFocusToElement === 'function') {
              ContentFocus.syncFocusToElement(card);
          }
          
          // Ejecutamos la navegación (la misma función que usa el mando)
          navigateToDetails(card);
      });

      // 2. EVENTO HOVER: Para que el foco siga al mouse
      card.addEventListener('mouseenter', () => {
          if (typeof ContentFocus.syncFocusToElement === 'function') {
              ContentFocus.syncFocusToElement(card);
          }
      });

      frag.appendChild(card);
    }

    channelContainer.appendChild(frag);

    if (createIndex < items.length) {
      requestAnimationFrame(renderBatch);
    } else {
      processQueue();
      
      requestAnimationFrame(() => {
          ContentFocus.reindexGrid(); 
          if (opts.restoreFocusId) {
              const targetCard = document.querySelector(`.channel-card[data-id="${opts.restoreFocusId}"]`) || 
                                 document.querySelector(`.channel-card[data-stream-id="${opts.restoreFocusId}"]`);
              if (targetCard) {
                  targetCard.focus();
                  window.ActiveFocusManager = ContentFocus;
                  return; 
              }
          }
          const activeEl = document.activeElement;
          const isUserTyping = activeEl && activeEl.id === 'search-input';

          if (isUserTyping) {
          } else {
              if (!window.ActiveFocusManager || window.ActiveFocusManager !== ContentFocus) {
                  window.ActiveFocusManager = ContentFocus;
              }
              if (currentViewCategoryId !== 'search_results') {
                  ContentFocus.init();
              }
          }
      });
    }
  }

  renderBatch();
}

function tokenInvalid(t) {
  return t !== window.runningSearchToken;
}

async function doScopedSearch(type, query, token) {
  const container = document.getElementById('channel-grid-container') || document.getElementById('grid-container');
  const title = document.getElementById('channel-grid-title') || document.getElementById('grid-title');
  if (!container || !title) {    return;}

  container.innerHTML = '<h4>Buscando...</h4>';
  title.textContent = `Resultados para "${query}"`;

  try {
    let repo;
    if (type === 'livetv') repo = LiveTVRepository;
    else if (type === 'movies') repo = MoviesRepository;
    else repo = SeriesRepository;

    let raw = [];

    if (typeof repo.search === 'function') {
      raw = await repo.search(query, { limit: 500 });
    } else {
      if (type === 'livetv' && typeof repo.getAllStreams === 'function') {
        raw = await repo.getAllStreams();
      } else if (type === 'movies' && typeof repo.getAllMovies === 'function') {
        raw = await repo.getAllMovies();
      } else if (type === 'series' && typeof repo.getAllSeries === 'function') {
        raw = await repo.getAllSeries();
      } else {
        const cats = (typeof repo.getCategories === 'function') ? await repo.getCategories() : [];
        if (Array.isArray(cats) && cats.length > 0) {
          const LIMIT = 4;
          let idx = 0;
          const out = [];
          async function worker() {
            while (idx < cats.length) {
              const c = cats[idx++];
              try {
                const getter =
                  type === 'livetv' ? 'getStreamsForCategory' :
                    type === 'movies' ? 'getMoviesForCategory' :
                      'getSeriesForCategory';
                if (typeof repo[getter] === 'function') {
                  const items = await repo[getter](c.category_id || c.id || '');
                  if (Array.isArray(items)) out.push(...items);
                }
              } catch (e) {Logger.error('[ContentPage/search] worker error:', e);
              }
            }
          }
          const workers = [];
          for (let i = 0; i < LIMIT; i++) workers.push(worker());
          await Promise.all(workers);
          raw = out;
        } else {
          raw = [];
        }
      }

      if (Array.isArray(raw)) {
        const q = query.toLowerCase();
        raw = raw.filter(it => ((it.name || it.title || it.channel_name || '').toString().toLowerCase().includes(q))).slice(0, 500);
      } else {
        raw = [];
      }
    }

    if (tokenInvalid(token)) return;

    if (!Array.isArray(raw) || raw.length === 0) {
      container.innerHTML = `<h4 style="color:#ff6a00;">No se encontraron resultados para "${query}".</h4>`;
      requestAnimationFrame(() => ContentFocus.reindexGrid());
      return;
    }

   const norm = raw.map(it => ({
  ...it,
  __type: type,
  n: it.n || it.name || it.title || it.series_name || it.channel_name || '',
  p: it.p || it.logo || it.stream_icon || it.cover || it.poster_path || '',
  i: it.i || it.stream_id || it.series_id || it.id || it.movie_id || '',
  tmi: it.tmi || it.tmdb_id || '',
    e: it.e || it.container_extension || ''
}));
    const searchTitle = `Resultados para "${query}"`;
    loadAndRenderStreams(null, searchTitle, type, { itemsOverride: norm });

  } catch (err) {
    if (tokenInvalid(token)) return;
    Logger.error('[ContentPage/search] Search Error.', err);
    container.innerHTML = `<h4 style="color:red;">Error al buscar.</h4>`;
  }
}

export function initScopedSearch(type, inputSelector = '#search-input', opts = {}) {
  const minLen = opts.minLen || 2;
  const debounceMs = typeof opts.debounceMs === 'number' ? opts.debounceMs : 300;
  const input = document.querySelector(inputSelector);
  if (!input) {return;}

  let debounceTimer = null;
  window.runningSearchToken = 0;

  input.addEventListener('input', (e) => {
    const q = (e.target.value || '').trim();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (q.length < minLen) {
        const sel = document.querySelector('.category-btn.selected');
        if (sel) sel.click();
        return;
      }
      window.runningSearchToken++;
      doScopedSearch(type, q, window.runningSearchToken).catch(err => {
        if (window.runningSearchToken !== window.runningSearchToken) return;
        Logger.error('[ContentPage/search] error scoped', err);
      });
    }, debounceMs);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      clearTimeout(debounceTimer);
      const q = (input.value || '').trim();
      if (q.length >= minLen) {
        window.runningSearchToken++;
        doScopedSearch(type, q, window.runningSearchToken).catch();
      }
    }
  });
}

export async function setupContentView(type) {
  isPageActive = true;
  const logoButton = document.getElementById('content-logo');
  if (logoButton) {
    setTimeout(() => {
        const currentLogo = document.getElementById('content-logo');
        if (currentLogo) {
            currentLogo.addEventListener('click', () => {
                router.loadView('home', { callback: setupHomePage });
            });
        }
    }, 400);
  }

  const categoryContainer = document.getElementById('category-list-container');
  const titleContainer = document.getElementById('category-title') || document.getElementById('channel-grid-title');

  if (!categoryContainer) {
    return; 
  }

  categoryContainer.innerHTML = '<div class="spinner-cat-dots"><div></div><div></div><div></div><div></div><div></div></div>';

  let categories = [];
  let title = "Contenido";
  let repository;
  let customFoldersAdded = 0;

  if (type === 'livetv') {
    repository = LiveTVRepository;
    title = "Live TV";
  } else if (type === 'movies') {
    repository = MoviesRepository;
    title = "Películas";
  } else if (type === 'series') {
    repository = SeriesRepository;
    title = "Series";
  }

  if (titleContainer) titleContainer.textContent = title;

  try {
    categories = await repository.getCategories();
  } catch (err) {
    Logger.error("[ContentPage] Fetch categories error:", err);
    categories = [];
  }

  if (!document.getElementById('category-list-container')) {
      return;
  }

  let filterType = type;
  if (type === 'movies') filterType = 'movie';
  const historyItems = await HistoryRepository.getByType(filterType);
  
  if (historyItems && historyItems.length > 0) {
      categories.unshift({ 
          category_id: 'history', 
          category_name: '🕒 Recientes' 
      });
      customFoldersAdded++;
  }
  const allFavorites = await FavoritesRepository.getAll();
  const favoritesForThisType = allFavorites.filter(item => item.type === filterType);
  if (favoritesForThisType.length > 0) {
    categories.unshift({ category_id: 'favorites', category_name: '★ Favoritos' });
    customFoldersAdded++;
  }

  if (!Array.isArray(categories) || categories.length === 0) {
    categoryContainer.innerHTML = `<h4 style="color:red;">No se encontraron categorías.</h4>`;
    requestAnimationFrame(() => {
        if(document.getElementById('category-list-container')) ContentFocus.init();
        initScopedSearch(type, '#search-input');
    });
    return;
  }

  const categoriesHTML = categories.map(cat => {
    const id = cat.category_id || cat.id || cat.categoryId || '';
    const label = cat.category_name || cat.name || cat.title || '';
    return `<button class="btn category-btn focusable" data-category-id="${id}">${label}</button>`;
  }).join('');

  categoryContainer.innerHTML = categoriesHTML;

  requestAnimationFrame(() => {
      const inputEl = document.getElementById('search-input');
      if (!inputEl) return; 

      initScopedSearch(type, '#search-input');
      
      const searchContainer = document.getElementById('livetv-search');
      if (searchContainer) {
        searchContainer.addEventListener('focus', () => inputEl.focus());
        searchContainer.addEventListener('click', () => inputEl.focus());
      }
      
      if (document.getElementById('category-list-container')) {
          ContentFocus.reindexCategories();
      }
  });

  const categoryButtons = Array.from(document.querySelectorAll('.category-btn'));
  const pinModal = document.getElementById('pin-modal-overlay');
  const pinBoxes = document.querySelectorAll('#pin-display-row .pin-box');
  const pinError = document.getElementById('pin-error-msg');
  let currentInputPin = "";
  let pendingCategory = null;

  const updatePinUI = () => {
      pinBoxes.forEach((box, idx) => {
          box.textContent = idx < currentInputPin.length ? '•' : '';
          box.classList.toggle('filled', idx < currentInputPin.length);
      });
  };

  const pinKeyHandler = (e) => {
      if (!pinModal || !pinModal.classList.contains('visible')) return;
      if (!document.body.contains(pinModal)) {
           document.removeEventListener('keydown', globalPinKeyHandlerRef);
           return;
      }
      
      e.preventDefault(); 
      e.stopPropagation();

      if (/^\d$/.test(e.key)) {
          if (currentInputPin.length < 4) {
              currentInputPin += e.key;
              updatePinUI();
              pinError.textContent = "";

              if (currentInputPin.length === 4) {
                  setTimeout(() => {
                      if (SettingsPreferences.checkPin(currentInputPin)) {
                          pinModal.classList.remove('visible');
                          if (pendingCategory) {
                              loadAndRenderStreams(pendingCategory.id, pendingCategory.name, type);
                              const allBtns = document.querySelectorAll('.category-btn');
                              allBtns.forEach(b => b.classList.remove('selected'));
                              if(pendingCategory.btn) pendingCategory.btn.classList.add('selected');
                          }
                      } else {
                          pinError.textContent = "PIN Incorrecto";
                          currentInputPin = "";
                          updatePinUI();
                      }
                  }, 200);
              }
          }
      } else if (e.key === 'Backspace' || e.key === 'Escape' || e.keyCode === 10009) {
          if (e.key === 'Backspace' && currentInputPin.length > 0) {
              currentInputPin = currentInputPin.slice(0, -1);
              updatePinUI();
          } else {
              pinModal.classList.remove('visible');
              currentInputPin = "";
          }
      }
  };

  globalPinKeyHandlerRef = pinKeyHandler;
  document.addEventListener('keydown', globalPinKeyHandlerRef);

  categoryButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const categoryId = button.getAttribute('data-category-id');
        const categoryName = button.textContent.trim();

        if (SettingsPreferences.isParentalEnabled() && SettingsPreferences.isAdultContent(categoryName)) {
            pendingCategory = { id: categoryId, name: categoryName, btn: button };
            currentInputPin = "";
            pinError.textContent = "";
            updatePinUI();
            
            const grid = document.getElementById('channel-grid-container');
            if(grid) grid.innerHTML = '<div style="text-align:center; margin-top:50px; color:#555;"><i class="fas fa-lock" style="font-size:40px; margin-bottom:10px;"></i><br>Contenido Protegido</div>';

            pinModal.classList.add('visible');
            return; 
        }

        categoryButtons.forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');
        currentViewCategoryId = categoryId;
        window._lastContentType = type;

        await loadAndRenderStreams(categoryId, button.textContent.trim(), type);
      });
  });

  if (categoryButtons.length > 0) {
    let targetBtn = null;
    let restoreFocusId = null;

    if (savedNavigationState && savedNavigationState.type === type) {
        const savedBtn = categoryButtons.find(b => b.dataset.categoryId === savedNavigationState.categoryId);
        if (savedBtn) {
            targetBtn = savedBtn;
            restoreFocusId = savedNavigationState.focusedId;
        }
    }

    if (!targetBtn) {
        savedNavigationState = null; 
        const defaultIndex = customFoldersAdded;
        const finalIndex = Math.min(defaultIndex, categoryButtons.length - 1);
        targetBtn = categoryButtons[finalIndex];
    }

    if (targetBtn) {
        const catName = targetBtn.textContent.trim();
        const catId = targetBtn.getAttribute('data-category-id');
        categoryButtons.forEach(btn => btn.classList.remove('selected'));
        targetBtn.classList.add('selected');
        currentViewCategoryId = catId; 

        if (!SettingsPreferences.isParentalEnabled() || !SettingsPreferences.isAdultContent(catName)) {
            await loadAndRenderStreams(catId, catName, type, { restoreFocusId: restoreFocusId });
        } else {
            const grid = document.getElementById('channel-grid-container');
            if(grid) grid.innerHTML = '<div style="text-align:center; margin-top:50px;">Seleccione una categoría</div>';
            ContentFocus.init();
        }
    }
  } else {
      ContentFocus.init();
  }
}

export async function navigateToDetails(card) {
  if (!card) return;
  savedNavigationState = {
      type: window._lastContentType,
      categoryId: currentViewCategoryId,
      focusedId: card.dataset.id || card.dataset.streamId
  };
  const { id, type: itemType, tmdbId, extension, streamId, seriesId } = card.dataset;

  try {
   if (itemType === 'movie') {
  const movieProps = { 
    streamId: streamId || id,
    tmdbId: tmdbId,
    containerExtension: extension || ''
  };
  if (!movieProps.streamId || !movieProps.tmdbId) {
    return;
  }
  router.loadView('movie-details', { callback: () => setupMovieDetailsPage(movieProps) });
  return;
}

    if (itemType === 'series') {
      const seriesProps = { seriesId: seriesId || id };
      if (!seriesProps.seriesId) {
        return;
      }
      router.loadView('series-details', { callback: () => setupSeriesDetailsPage(seriesProps) });
      return;
    }

    if (itemType === 'livetv') {
      const streamObj = await LiveTVRepository.getStreamById(id);
      
      if (!streamObj) {
        return;
      }

      const videoUrl = await LiveTVRepository.getStreamUrl(streamObj, { preferDirectSource: true });
      
      if (!videoUrl) {
        return;
      }

      const cardTitle = streamObj.name || streamObj.n || 'Canal de TV';
      const returnContext = {
        view: 'content',
        params: { type: window._lastContentType || 'livetv' },
        callback: () => { router.loadView('content', { callback: setupContentView, type: window._lastContentType || 'livetv' }); }
      };

      router.loadView('player', {
        callback: () => {
          setupPlayerPage(videoUrl, 'livetv', { 
            title: cardTitle,
            streamId: streamObj.stream_id,
            num: streamObj.num,
            categoryId: streamObj.category_id,
            image: streamObj.stream_icon || streamObj.p,
            containerExtension: streamObj.container_extension
          }, returnContext);
        }
      });
      return;
    }
  } catch (err) {
    Logger.error('ContentPage: error opening details', err);
  }
}
