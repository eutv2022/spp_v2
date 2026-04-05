// js/core/homeLoginFocus.js

export const homeLoginFocus = {
    zones: { 
        menu: [], pill: [], buttons: [], secondary: [], rows: [], 
        fallback: [], 
        modal: [] 
    },
    currentZone: "menu",
    currentIndex: 0,

    init(forceReset = false) {
        const eulaEl = document.getElementById('eula-modal');
        
        // Detección de arranque con Modal EULA
        if (eulaEl && eulaEl.style.display === 'flex') {
            this._refreshZones();
            if (this.zones.modal.length > 0) {
                this.currentZone = 'modal';
                this.currentIndex = 0;
                this.setFocus(0);
                return;
            }
        }

        if (!forceReset && this._zoneHasItems('menu')) return;

        this.currentZone = "menu";
        this.currentIndex = 0;
        this.zones = { menu: [], pill: [], buttons: [], secondary: [], rows: [], fallback: [], modal: [] };

        document.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this._refreshZones();
                if (this._zoneHasItems('menu')) {
                    this.currentZone = 'menu';
                } else if (this._zoneHasItems('fallback')) {
                    this.currentZone = 'fallback';
                } else {
                    const firstValid = this._findFirstNonEmptyZone();
                    if (firstValid) this.currentZone = firstValid;
                }
                this.setFocus(this.currentIndex);
            });
        });
    },

    _refreshZones() {
        const eulaEl = document.getElementById('eula-modal');
        const exitEl = document.getElementById('home-exit-modal');
        
        const isEulaOpen = eulaEl && eulaEl.style.display === 'flex';
        const isExitOpen = exitEl && exitEl.classList.contains('visible');

        let modalItems = [];
        if (isEulaOpen) {
            modalItems = Array.from(document.querySelectorAll("#eula-modal .focusable"));
        } else if (isExitOpen) {
            modalItems = Array.from(document.querySelectorAll("#home-exit-modal .focusable"));
        }

        this.zones = { 
            menu: Array.from(document.querySelectorAll("#column-nav .focusable")),
            pill: Array.from(document.querySelectorAll("#content-pill .focusable")),
            buttons: Array.from(document.querySelectorAll("#feature-buttons .focusable")),
            secondary: Array.from(document.querySelectorAll("#secondary-nav .focusable")),
            rows: Array.from(document.querySelectorAll("#content-rows .focusable")),
            modal: modalItems,
            // Si hay modal, anulamos fallback para atrapar el foco
            fallback: (isEulaOpen || isExitOpen) ? [] : Array.from(document.querySelectorAll(".focusable"))
        };
    },

    setFocus(index) {
        if (!this._zoneHasItems(this.currentZone)) this._refreshZones();

        const zoneList = this.zones[this.currentZone];
        if (!zoneList || zoneList.length === 0) return;
        
        const safeIndex = Math.max(0, Math.min(index, zoneList.length - 1));
        const newEl = zoneList[safeIndex];
        
        if (!newEl || !newEl.isConnected) {
            setTimeout(() => { this._refreshZones(); this.setFocus(safeIndex); }, 50);
            return;
        }

        document.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));
        newEl.classList.add("focused");
        
        if (!newEl.hasAttribute('tabindex')) newEl.setAttribute('tabindex', '0');

        try { 
            newEl.focus(); 
            // IMPORTANTE: No hacer scrollIntoView automático si es el texto del EULA
            // porque el scroll lo manejamos manualmente en 'navigate'
            if (newEl.id !== 'eula-text-body') {
                newEl.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
            }
        } catch {}
        this.currentIndex = safeIndex;
    },

    navigate(direction) {
        let zone = this.currentZone;
        let idx = this.currentIndex;
        
        if (!this._zoneHasItems(zone)) {
            this.init(true);
            return;
        }

        const zoneList = this.zones[zone];
        const jumpTo = (targetZone, targetIndex = 0) => {
            if (!this._zoneHasItems(targetZone)) return false;
            zone = targetZone;
            idx = Math.max(0, Math.min(targetIndex, this.zones[targetZone].length - 1));
            return true;
        };
        
        // =========================================================
        // 🔥 LÓGICA EULA / EXIT (ZONA MODAL)
        // =========================================================
        if (zone === "modal") {
            const currentItem = zoneList[idx];
            const isEula = document.getElementById('eula-modal').contains(currentItem);

            if (direction === "back" || direction === "escape") {
                if (isEula) this.closeEulaModal();
                else this.closeExitModal();
                return;
            }

            if (isEula) {
                // --- Lógica Específica EULA ---
                const textEl = document.getElementById('eula-text-body');
                const isTextSelected = (currentItem.id === 'eula-text-body');
                const scrollStep = 50; 

                if (direction === "down") {
                    if (isTextSelected) {
                        // Calculamos si podemos bajar más
                        const maxScroll = textEl.scrollHeight - textEl.clientHeight;
                        const currentScroll = Math.ceil(textEl.scrollTop);

                        // Tolerancia de 5px
                        if (currentScroll < maxScroll - 5) {
                            textEl.scrollTop += scrollStep;
                            return; // CONSUMIMOS EL EVENTO (Solo scroll, no mover foco)
                        }
                        // Si ya no hay scroll, pasamos al botón (índice 1)
                        if (zoneList.length > 1) idx = 1; 
                    }
                } 
                else if (direction === "up") {
                    if (idx === 1) { 
                        idx = 0; // Subir del botón al texto
                    } else if (isTextSelected) {
                        if (textEl.scrollTop > 0) {
                            textEl.scrollTop -= scrollStep;
                            return; // CONSUMIMOS EL EVENTO (Scroll arriba)
                        }
                    }
                }
                // En EULA bloqueamos izq/der
                
            } else {
                // --- Lógica Exit Modal (Horizontal) ---
                if (direction === "left" && idx > 0) idx--;
                else if (direction === "right" && idx < zoneList.length - 1) idx++;
            }
        }
        // =========================================================
        
        else if (zone === "fallback") {
            if (direction === "down") idx = (idx + 1) % Math.max(1, zoneList.length);
            else if (direction === "up") idx = (idx - 1 + Math.max(1, zoneList.length)) % Math.max(1, zoneList.length);
        }
        else if (zone === "menu") {
            if (direction === "down") { if (idx < zoneList.length - 1) idx++; }
            else if (direction === "up") { if (idx > 0) idx--; }
            else if (direction === "right") { 
                if (!jumpTo("buttons", 0)) { if (!jumpTo("pill", 0)) jumpTo("rows", 0); }
            }
        }
        else if (zone === "pill") {
            if (direction === "right") { if (idx < zoneList.length - 1) idx++; }
            else if (direction === "left") { if (idx > 0) idx--; else jumpTo("menu", 0); }
            else if (direction === "down") { if (!jumpTo("buttons", 0)) jumpTo("rows", 0); } 
        }
        else if (zone === "buttons") {            
            if (direction === "left") { if (idx > 0) idx--; else jumpTo("menu", 0); }
            else if (direction === "right") { if (idx < zoneList.length - 1) idx++; }
            else if (direction === "up") { if (!jumpTo("pill", 1)) {} }
            else if (direction === "down") { jumpTo("rows", 0); }
        }
        else if (zone === "rows") {
             if (direction === "left") { if (idx > 0) idx--; else jumpTo("menu", 2); }
            else if (direction === "right") { if (idx < zoneList.length - 1) idx++; }
            else if (direction === "up") { if (idx < 4) { if (!jumpTo("buttons", 0)) jumpTo("pill", 0); } else { idx -= 4; } }
            else if (direction === "down") { if (idx + 4 < zoneList.length) idx += 4; }
        }

        this.currentZone = zone;
        this.setFocus(idx);
    },

    select() {
        if (!this._zoneHasItems(this.currentZone)) this._refreshZones();

        const list = this.zones[this.currentZone];
        if (!list || list.length === 0) return;
        
        const el = list[this.currentIndex];
        
        if (el && el.isConnected) {
            // Manejo Modal
            if (this.currentZone === 'modal') {
                if (el.id === 'eula-text-body') return; // Click en texto ignorado
                
                if (el.id === 'close-eula') {
                    el.click(); // Dispara evento en LoginPage
                    return;
                }
                
                if (el.id === 'btnExitNo') {
                    this.closeExitModal();
                    return;
                }
                if (el.id === 'btnExitYes') {
                     try { tizen.application.getCurrentApplication().exit(); } catch { window.close(); }
                     return;
                }
            }
            el.click();
        } else {
            this.init(true);
        }
    },

    _zoneHasItems(zoneName) {
        return this.zones[zoneName] && this.zones[zoneName].length > 0;
    },

    _findFirstNonEmptyZone() {
        this._refreshZones(); 
        for (const name of ["menu", "pill", "buttons", "rows"]) {
            if (this._zoneHasItems(name)) return name;
        }
        return "fallback";
    },

    openExitModal() {
        const modalEl = document.getElementById('home-exit-modal');
        if (modalEl) modalEl.classList.add('visible');
        
        this._refreshZones(); 
        
        if (this.zones.modal.length > 0) {
            this.currentZone = 'modal';
            this.currentIndex = this.zones.modal.length > 1 ? 1 : 0;
            this.setFocus(this.currentIndex);
            return true;
        }
        return false;
    },

    closeExitModal() {
        document.getElementById('home-exit-modal')?.classList.remove('visible');
        this.currentZone = 'menu';
        this.currentIndex = 0;
        this.setFocus(0);
    },

    openEulaModal() {
        const modalEl = document.getElementById('eula-modal');
        if (modalEl) {
            modalEl.style.display = 'flex';
            this._refreshZones();

            if (this.zones.modal.length > 0) {
                this.currentZone = 'modal';
                this.currentIndex = 0;
                this.setFocus(0);
                return true;
            } else {
                setTimeout(() => {
                    this._refreshZones();
                    if (this.zones.modal.length > 0) {
                        this.currentZone = 'modal';
                        this.currentIndex = 0;
                        this.setFocus(0);
                    }
                }, 100);
                return true;
            }
        }
        return false;
    },

    closeEulaModal() {
        const eulaEl = document.getElementById('eula-modal');
        if (eulaEl) eulaEl.style.display = 'none';
        
        this._refreshZones(); 
        this.currentZone = 'fallback'; 
        
        const usernameInput = document.getElementById('username');
        if (usernameInput) {
            // Buscamos dinámicamente el índice del username en la nueva lista de fallback
            const fallbackList = this.zones.fallback; 
            const idx = fallbackList.findIndex(el => el.id === 'username');
            this.currentIndex = idx >= 0 ? idx : 0;
        } else {
            this.currentIndex = 0;
        }
        this.setFocus(this.currentIndex);
    },

    handleBack() {
        if (this.currentZone === 'modal') {
            const firstItem = this.zones.modal[0];
            if (firstItem && document.getElementById('eula-modal').contains(firstItem)) {
                this.closeEulaModal();
            } else {
                this.closeExitModal();
            }
            return true;
        }
        
        if (this.currentZone !== 'menu' && this._zoneHasItems('menu')) {
            this.currentZone = 'menu';
            this.currentIndex = 0;
            this.setFocus(0);
            return true;
        }

        return this.openExitModal();
    },

    handleMediaKey(action) {
        if (action === 'play_pause') this.select();
    }
};