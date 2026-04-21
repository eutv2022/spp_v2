// js/core/SettingsFocus.js

export const SettingsFocus = {
    items: [],
    logo: null,
    currentIndex: 0,
    inGrid: true, 
    isModalOpen: false,
    modalType: 'default', 
    subRow: 0, 
    subCol: 0, 
    modalMode: 'complex',
    modalSection: 'list',
    modalListIndex: 0,    
    modalBtnIndex: 1,
    modalPinIndex: 0,     
    simpleItems: [],
    simpleIndex: 0,
    onPinInput: null, 

    init() {
        this.items = Array.from(document.querySelectorAll('.setting-card'));
        this.logo = document.getElementById('settings-logo');
        if (this.items.length === 0 && !this.logo) return;
        this.inGrid = true;
        this.isModalOpen = false;
        this.currentIndex = 0; 
        this.updateFocus();
    },

    handleBack() {
        const openDropdown = document.querySelector('.sub-dropdown-list.visible');
        if (openDropdown) {
            openDropdown.classList.remove('visible');
            this.updateModalFocus();
            return true; 
        }

        if (this.isModalOpen) {
            const btnCancel = document.getElementById('btn-modal-cancel');
            if(btnCancel) btnCancel.click(); 
            else this.exitModal();
            
            return true; 
        }

        return false;
    },

    enterModal(type = 'default') {
        this.isModalOpen = true;
        this.modalType = type;

        if (this.modalType === 'subtitles') {
            this.subRow = 0; 
            this.subCol = 0; 
        } 
        else {
            const historyOverlay = document.querySelector('.confirm-overlay.visible');
            
            if (historyOverlay) {
                this.modalMode = 'simple';
                this.simpleItems = Array.from(historyOverlay.querySelectorAll('.focusable-modal'));
                this.simpleIndex = 1;
            } else {
                this.modalMode = 'complex';
                this.modalSection = 'list';
                this.modalListIndex = 0;
                this.modalBtnIndex = 1; 

                const listItems = document.querySelectorAll('.settings-modal-overlay.visible .modal-option-btn');
                const selectedIdx = Array.from(listItems).findIndex(el => el.classList.contains('selected'));
                if (selectedIdx !== -1) this.modalListIndex = selectedIdx;
            }
        }
        setTimeout(() => this.updateModalFocus(), 50);
    },

    exitModal() {
        this.isModalOpen = false;
        this.inGrid = true; 
        this.updateFocus();
    },

    updateModalFocus() {
        // Limpiar foco anterior
        document.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));

        // Caso 1: Dropdown de subtítulos
        const openDropdown = document.querySelector('.sub-dropdown-list.visible');
        if (openDropdown) {
            const options = Array.from(openDropdown.querySelectorAll('.sub-dropdown-item'));
            let idx = openDropdown._focusIdx || 0;
            // Clamp
            if (idx >= options.length) idx = options.length - 1;
            if (idx < 0) idx = 0;
            
            if (options[idx]) {
                options[idx].classList.add('focused');
                options[idx].focus();
            }
            return;
        }

        // Caso 2: Configuración de Subtítulos (Matriz)
        if (this.modalType === 'subtitles') {
            if (this.subRow === 0) {
                const drops = document.querySelectorAll('.sub-selector-main-btn');
                if (drops[this.subCol]) {
                    drops[this.subCol].classList.add('focused');
                    drops[this.subCol].focus();
                }
            } else {
                const btns = document.querySelectorAll('.settings-modal-content .modal-actions .modal-action-btn');
                if (btns[this.subCol]) {
                    btns[this.subCol].classList.add('focused');
                    btns[this.subCol].focus();
                }
            }
            return;
        }

        // Caso 3: Modal Simple (Confirmación borrar historia)
        if (this.modalMode === 'simple') {
            const el = this.simpleItems[this.simpleIndex];
            if (el) {
                el.classList.add('focused');
                el.focus();
            }
            return;
        }

        // Caso 4: Modal Complejo (Settings estándar)
        // Lógica de secciones
        if (this.modalSection === 'list') {
            const listItems = document.querySelectorAll('.settings-modal-overlay.visible .modal-option-btn');
            if (listItems[this.modalListIndex]) {
                listItems[this.modalListIndex].classList.add('focused');
                listItems[this.modalListIndex].focus();
                // Scroll into view si es necesario para listas largas
                listItems[this.modalListIndex].scrollIntoView({block: "center", behavior: "auto"});
            }
        } else if (this.modalSection === 'pin') {
            // El contenedor del PIN recibe el foco visual
            const pinRows = document.querySelectorAll('.settings-modal-overlay.visible .pin-row-container');
            if(pinRows[this.modalPinIndex]){
                pinRows[this.modalPinIndex].classList.add('focused');
            }
           
        } else {
            // Botones de acción (Cancelar / Guardar)
            const btns = document.querySelectorAll('.settings-modal-content .modal-actions .modal-action-btn');
            if (btns[this.modalBtnIndex]) {
                btns[this.modalBtnIndex].classList.add('focused');
                btns[this.modalBtnIndex].focus();
            }
        }
    },

    _handleModalAction(action) { 
        if (/^\d$/.test(action) && this.modalSection === 'pin' && typeof this.onPinInput === 'function') {
            this.onPinInput(action);
            return;
        }

        const openDropdown = document.querySelector('.sub-dropdown-list.visible');
        
        if (openDropdown) {
            const options = Array.from(openDropdown.querySelectorAll('.sub-dropdown-item'));
            let idx = openDropdown._focusIdx || 0;
            switch(action) {
                case 'up': if (idx > 0) idx--; break;
                case 'down': if (idx < options.length - 1) idx++; break;
                case 'enter': options[idx]?.click(); return;
            }
            openDropdown._focusIdx = idx;
            this.updateModalFocus();
            return;
        }

        if (this.modalType === 'subtitles') {
            switch(action) {
                case 'left': if (this.subCol > 0) this.subCol--; break;
                case 'right': const max = (this.subRow === 0) ? 2 : 1; if (this.subCol < max) this.subCol++; break;
                case 'down': if (this.subRow === 0) { this.subRow = 1; if (this.subCol > 1) this.subCol = 1; } break;
                case 'up': if (this.subRow === 1) this.subRow = 0; break;
                case 'enter':
                    if (this.subRow === 0) document.querySelectorAll('.sub-selector-main-btn')[this.subCol]?.click();
                    else document.querySelectorAll('.settings-modal-content .modal-actions .modal-action-btn')[this.subCol]?.click();
                    break;
            }
            this.updateModalFocus();
            return;
        }

        if (this.modalMode === 'simple') {
            switch(action) {
                case 'left': if (this.simpleIndex > 0) this.simpleIndex--; break;
                case 'right': if (this.simpleIndex < this.simpleItems.length - 1) this.simpleIndex++; break;
                case 'enter': this.simpleItems[this.simpleIndex]?.click(); break;
            }
            this.updateModalFocus();
            return;
        }

        const listItems = document.querySelectorAll('.settings-modal-overlay.visible .modal-option-btn');
        const pinRows = document.querySelectorAll('.settings-modal-overlay.visible .pin-row-container');
        const btns = document.querySelectorAll('.settings-modal-content .modal-actions .modal-action-btn');

        if (listItems.length === 0 && btns.length === 0 && pinRows.length === 0) return; 

        switch(action) {
            case 'up':
                if (this.modalSection === 'list') {
                    if (this.modalListIndex > 0) this.modalListIndex--;
                } else if (this.modalSection === 'pin') {
                    if (this.modalPinIndex > 0) this.modalPinIndex--;
                    else { 
                        this.modalSection = 'list'; 
                        if (listItems.length > 0) this.modalListIndex = listItems.length - 1; 
                    }
                } else if (this.modalSection === 'buttons') {
                    if (pinRows.length > 0) { 
                        this.modalSection = 'pin'; 
                        this.modalPinIndex = pinRows.length - 1; 
                    } else if (listItems.length > 0) { 
                        this.modalSection = 'list'; 
                        this.modalListIndex = listItems.length - 1; 
                    }
                }
                break;

            case 'down':
                if (this.modalSection === 'list') {
                    if (this.modalListIndex < listItems.length - 1) {
                        this.modalListIndex++;
                    } else {
                        if (pinRows.length > 0) { this.modalSection = 'pin'; this.modalPinIndex = 0; }
                        else { this.modalSection = 'buttons'; this.modalBtnIndex = 0; }
                    }
                } else if (this.modalSection === 'pin') {
                    if (this.modalPinIndex < pinRows.length - 1) this.modalPinIndex++;
                    else { this.modalSection = 'buttons'; this.modalBtnIndex = 0; }
                }
                break;

            case 'left':
                if (this.modalSection === 'buttons') {
                    if (this.modalBtnIndex > 0) {
                        this.modalBtnIndex--;
                    } else {
                        if (listItems.length > 0) {
                            this.modalSection = 'list';
                        }
                    }
                }
                break;

            case 'right':
                if (this.modalSection === 'list') {
                    if (btns.length > 0) {
                        this.modalSection = 'buttons';
                        this.modalBtnIndex = btns.length > 1 ? 1 : 0; 
                    }
                }
                else if (this.modalSection === 'buttons') {
                    if (this.modalBtnIndex < btns.length - 1) this.modalBtnIndex++;
                }
                break;

            case 'enter':
                if (this.modalSection === 'list') listItems[this.modalListIndex]?.click();
                else if (this.modalSection === 'buttons') btns[this.modalBtnIndex]?.click();
                break;
                
            case 'Backspace':
            case '10009':
                 if (this.modalSection === 'pin' && typeof this.onPinInput === 'function') {
                    this.onPinInput('backspace');
                 }
                 break;
        }
        this.updateModalFocus();
    },

    navigate(direction) {
        if (this.isModalOpen) {
            this._handleModalAction(direction);
            return; 
        }

        const COLUMNS = 5;
        const total = this.items.length;

        if(!this.items[this.currentIndex]) this.currentIndex = 0;

        switch(direction) {
            case 'right': if (this.inGrid && (this.currentIndex + 1) % COLUMNS !== 0 && this.currentIndex < total - 1) this.currentIndex++; break;
            case 'left': if (this.inGrid && this.currentIndex % COLUMNS !== 0) this.currentIndex--; break;
            case 'down': 
                if (this.inGrid) { 
                    if (this.currentIndex + COLUMNS < total) this.currentIndex += COLUMNS; 
                    else if (this.currentIndex + COLUMNS >= total && this.currentIndex < total) this.currentIndex = total -1;
                } 
                else { this.inGrid = true; this.currentIndex = 0; } break;
            case 'up': 
                if (this.inGrid) { 
                    if (this.currentIndex - COLUMNS >= 0) this.currentIndex -= COLUMNS; 
                    else this.inGrid = false; 
                } break;
        }
        this.updateFocus();
    },

    select() {
        if (this.isModalOpen) {
            this._handleModalAction('enter');
            return;
        }
        const target = this.inGrid ? this.items[this.currentIndex] : this.logo;
        target?.click();
    },
    
    handleInput(key) {
        if (this.isModalOpen) {
            this._handleModalAction(key);
        }
    },

    updateFocus() {
        this.items.forEach(el => el.classList.remove('focused'));
        if(this.logo) this.logo.classList.remove('focused');
        
        if (this.inGrid && this.items[this.currentIndex]) {
            this.items[this.currentIndex].classList.add('focused');
            this.items[this.currentIndex].focus();
        } else if (!this.inGrid && this.logo) {
            this.logo.classList.add('focused');
            this.logo.focus();
        }
    },
};