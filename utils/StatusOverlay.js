import { Logger } from '../utils/logger.js';

export const StatusOverlay = {
    init() {
        if (document.getElementById('status-overlay-system')) return;
        
        try {
            const container = document.createElement('div');
            container.id = 'status-overlay-system';
            
            container.innerHTML = `
                <div id="status-bar-container">
                    <div id="loader-livetv" class="status-pill" data-label="Live TV">
                        <div class="icon-area"><div class="mini-loader"></div></div>
                        <span class="text-area">Actualizando Live TV</span>
                    </div>
                    <div id="loader-movies" class="status-pill" data-label="Películas">
                        <div class="icon-area"><div class="mini-loader"></div></div>
                        <span class="text-area">Actualizando Películas</span>
                    </div>
                    <div id="loader-series" class="status-pill" data-label="Series">
                        <div class="icon-area"><div class="mini-loader"></div></div>
                        <span class="text-area">Actualizando Series</span>
                    </div>
                </div>

                <div id="global-sync-modal" class="sync-overlay">
                    <div class="sync-modal-frame">
                        
                        <div id="sync-step-live" class="sync-step-pill">
                            ACTUALIZANDO LIVE
                        </div>

                        <div id="sync-step-movies" class="sync-step-pill">
                            ACTUALIZANDO MOVIES
                        </div>

                        <div id="sync-step-series" class="sync-step-pill">
                            ACTUALIZANDO SERIES
                        </div>

                    </div>
                </div>
            `;
            
            document.body.appendChild(container);
        } catch (e) { 
            Logger.error("StatusOverlay: Failed to initialize", "UI", e);
        }
    },

    showModal() {
        this.init();
        const modal = document.getElementById('global-sync-modal');
        if (modal) {
            ['live', 'movies', 'series'].forEach(type => {
                const el = document.getElementById(`sync-step-${type}`);
                if (el) el.className = 'sync-step-pill'; 
            });
            modal.classList.add('visible');
        }
    },

    hideModal() {
        const modal = document.getElementById('global-sync-modal');
        if (modal) {
            modal.classList.remove('visible');
        }
    },

    setStep(type, state) {
        const el = document.getElementById(`sync-step-${type}`);
        if (!el) return;
        el.className = 'sync-step-pill';
        if (state === 'loading') {
            el.classList.add('active');
        } else if (state === 'success') {
            el.classList.add('success');
        }
    },

    show(key) {
        this.init();
        if (key === 'Conectando...' || key === 'Limpiando base de datos...') {
            this.showModal();
            return;
        }
        const modal = document.getElementById('global-sync-modal');
        if (modal && modal.classList.contains('visible')) return;
        const id = this._mapToId(key);
        const el = document.getElementById(id);
        if (!el) return;
        if (el.hideTimeout) clearTimeout(el.hideTimeout);
        el.classList.remove('success', 'hiding');
        const label = el.dataset.label;
        const iconArea = el.querySelector('.icon-area');
        const textArea = el.querySelector('.text-area');
        if(iconArea) iconArea.innerHTML = '<div class="mini-loader"></div>';
        if(textArea) textArea.textContent = `Actualizando ${label}`;
        el.classList.add('visible');
    },

    hide(key) {
        if (!key) { 
            this.hideModal(); 
            return; 
        }

        const id = this._mapToId(key);
        const el = document.getElementById(id);
        if (!el || !el.classList.contains('visible')) return;
        el.classList.add('success');
        const label = el.dataset.label;
        const iconArea = el.querySelector('.icon-area');
        const textArea = el.querySelector('.text-area');
        if(iconArea) iconArea.innerHTML = '<i class="fas fa-check-circle"></i>';
        if(textArea) textArea.textContent = `${label} Completado`;
        if (el.hideTimeout) clearTimeout(el.hideTimeout);
        el.hideTimeout = setTimeout(() => {
            el.classList.remove('visible');
            setTimeout(() => el.classList.remove('success'), 500); 
        }, 3000);
    },

    _mapToId(key) {
        if (!key) return '';
        const k = key.toLowerCase();
        if (k.includes('live')) return 'loader-livetv';
        if (k.includes('movie') || k.includes('película')) return 'loader-movies'; 
        if (k.includes('serie')) return 'loader-series';
        return '';
    }
};