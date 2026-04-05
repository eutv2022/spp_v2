// js/views/SettingsPage.js

import { router } from '../core/router.js';
import { SettingsFocus } from '../core/SettingsFocus.js';
import { setupHomePage } from './HomePage.js';
import { SettingsPreferences } from '../services/SettingsPreferences.js';
import { HistoryRepository } from '../repositories/HistoryRepository.js';
import { Logger } from '../../utils/logger.js';


const injectStyles = () => {
    const styleId = 'settings-fix-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            .sub-dropdown-list { display: none !important; opacity: 0; }
            .sub-dropdown-list.visible { display: block !important; opacity: 1 !important; z-index: 99999 !important; background-color: #111; border: 1px solid #333; }
            .sub-config-item, .sub-config-container, .settings-modal-content { overflow: visible !important; }
            .modal-option-btn.selected { background-color: var(--accent); color: black; font-weight: bold; }
            
            /* Estilos PIN */
            .pin-setup-container { display: none; margin-top: 15px; background: #222; padding: 10px; border-radius: 8px; }
            .pin-setup-container.visible { display: block; }
            
            /* CONTENEDOR DE LA FILA DE PIN (Ahora tiene estado focused) */
            .pin-row-container { 
                display: flex; gap: 10px; justify-content: center; margin-bottom: 10px; 
                padding: 5px; border: 2px solid transparent; border-radius: 8px; transition: all 0.2s;
            }
            .pin-row-container.focused { 
                border-color: #FF6A00; 
                background: rgba(255, 106, 0, 0.1); 
                transform: scale(1.02);
            }

            .pin-box { width: 40px; height: 40px; border: 1px solid #555; display: flex; align-items: center; justify-content: center; font-size: 20px; color: white; background: #000; }
            .pin-box.filled { background: #FF6A00; color: black; border-color: #FF6A00; }
            .pin-label { font-size: 12px; color: #ccc; margin-bottom: 5px; text-align: center; }
            .pin-error { color: #ff4444; font-size: 12px; text-align: center; min-height: 15px; margin-top: 5px;}
        `;
        document.head.appendChild(style);
    }
};

const SUB_FONTS = [{ label: 'Sistema Default', value: 'sans-serif' }, { label: 'Roboto', value: 'Roboto, Arial, sans-serif' }, { label: 'Open Sans', value: 'Open Sans, Arial, sans-serif' }];
const SUB_SIZES = [20,24,28,32,36,40,50];
const SUB_COLORS = [{ label:'Blanco', value:'#FFFFFF' }, { label:'Amarillo', value:'#FFFF00' }, { label:'Rojo', value:'#FF0000' }, { label:'Gris', value:'#AAAAAA' }, { label:'Azul', value:'#00BFFF' }];

const MENU_DEFINITIONS = {
  'set-update': { title:'Frecuencia de Actualización', prefKey:'update_interval', type:'select', options:[{label:'1 Hora',value:1},{label:'4 Horas',value:4},{label:'6 Horas',value:6},{label:'12 Horas',value:12}]},
  'set-parental': { title:'Control Parental', prefKey:'parental_control', type:'parental_control', options:[{label:'Activado',value:true},{label:'Desactivado',value:false}]},
  'set-sort': { title:'Orden del Contenido', prefKey:'sort_order', type:'select', options:[{label:'Default',value:'name_default'},{label:'Más Recientes',value:'date_desc'},{label:'A - Z',value:'name_asc'},{label:'Z - A',value:'name_desc'}]},
  'set-hidelive': { title:'Ocultar Live TV', prefKey:'hide_live', type:'dynamic_multi_select'},
  'set-hidemovie': { title:'Ocultar Películas', prefKey:'hide_movies', type:'dynamic_multi_select'},
  'set-hideserie': { title:'Ocultar Series', prefKey:'hide_series', type:'dynamic_multi_select'},
  'set-layout': { title:'Diseño de Interfaz', prefKey:'layout_design', type:'select', options:[{label:'Moderno',value:'modern'},{label:'Clásico',value:'classic'}]},
  'set-format': { title:'Formato de Stream Live', prefKey:'stream_format', type:'select', options:[{label:'MPEG-TS (.ts)',value:'ts'},{label:'HLS (.m3u8)',value:'m3u8'}]},
  'set-subs': { title:'Ajustes de Subtítulos', type:'custom_subtitle_config', prefKey: 'custom_subtitle_config'}
};

const SETTINGS_GRID_ITEMS = [
  { id:'set-update', icon:'fa-clock', label:'Actualización' },
  { id:'set-sort', icon:'fa-sort-alpha-down', label:'Orden' },
  { id:'set-hidelive', icon:'fa-tv', label:'Ocultar Live' },
  { id:'set-hidemovie', icon:'fa-film', label:'Ocultar Pelis' },
  { id:'set-hideserie', icon:'fa-layer-group', label:'Ocultar Series' },
  { id:'set-parental', icon:'fa-lock', label:'Control Parental' },
  { id:'set-format', icon:'fa-file-video', label:'Formato Live' },
  { id:'set-history', icon:'fa-trash-alt', label:'Borrar Historia' },
  { id:'set-subs', icon:'fa-closed-captioning', label:'Subtítulos' }
];

// Añadimos 'focusable-modal' a los botones de historial para que SettingsFocus los detecte automáticamente
const SETTINGS_MARKUP = `
<div class="settings-layout">
  <div class="settings-header">
     <div id="settings-logo" class="settings-logo-container focusable">
        <img src="./assets/logo/return.png" alt="LionTV" class="settings-logo-img">
     </div>
     <h1 class="settings-title">Configuración</h1>
  </div>
  <div class="settings-body">
     <div id="settings-grid" class="settings-grid"></div>
  </div>
  <div id="setting-status-bar" class="setting-description">Seleccione una opción</div>

  <div id="settings-modal" class="settings-modal-overlay">
     <div class="settings-modal-content">
        <h2 id="modal-title" class="modal-title">Título</h2>
        <div id="modal-options-container" class="modal-options"></div>
        <div class="modal-actions">
           <button id="btn-modal-cancel" class="modal-action-btn focusable-modal">Cancelar</button>
           <button id="btn-modal-ok" class="modal-action-btn btn-confirm focusable-modal">Guardar</button>
        </div>
     </div>
  </div>

  <div id="history-modal-overlay" class="confirm-overlay"> 
    <div class="confirm-box">
      <h2 class="confirm-title danger">¿Borrar Historial?</h2>
      <p class="confirm-text">Se eliminarán todos los registros.<br>Esta acción no se puede deshacer.</p>
      <div class="confirm-actions">
        <button id="hist-btn-cancel" class="confirm-btn cancel focusable-hist focusable-modal">CANCELAR</button>
        <button id="hist-btn-confirm" class="confirm-btn focusable-hist focusable-modal">BORRAR</button>
      </div>
    </div>
  </div>
</div>
`;

export function renderSettingsPage() {
  injectStyles();
  const container = document.getElementById('app-container');
  if (container) container.innerHTML = SETTINGS_MARKUP.trim();
}

let currentModalKey = null;
let tempValue = null;
let tempHiddenList = []; 
let tempSubFont = SUB_FONTS[0].value;
let tempSubSize = SUB_SIZES[1];
let tempSubColor = SUB_COLORS[0].value;
let globalSettingsKeyHandler = null;
let currentPin = "";
let confirmPin = "";
let pinMode = "";

const renderPinInputs = (container, labelText, isConfirm = false) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'pin-setup-container visible';
    wrapper.innerHTML = `
        <div class="pin-label">${labelText}</div>
        <div class="pin-row-container" id="${isConfirm ? 'pin-row-confirm' : 'pin-row-main'}">
            <div class="pin-box"></div><div class="pin-box"></div><div class="pin-box"></div><div class="pin-box"></div>
        </div>
        <div class="pin-error" id="pin-error-msg"></div>
    `;
    container.appendChild(wrapper);
};

const updatePinVisuals = (pin, isConfirm = false) => {
    const rowId = isConfirm ? 'pin-row-confirm' : 'pin-row-main';
    const row = document.getElementById(rowId);
    if (!row) return;
    const boxes = row.querySelectorAll('.pin-box');
    boxes.forEach((box, i) => {
        if (i < pin.length) {
            box.textContent = "•"; 
            box.classList.add('filled');
        } else {
            box.textContent = "";
            box.classList.remove('filled');
        }
    });
};

const renderSubOptions = (list, containerId, prefType, currentValue) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    container.style.position = 'relative';
    container.style.overflow = 'visible'; 

    const currentItem = list.find(i => String(i.value) === String(currentValue)) || list[0];
    
    const mainBtn = document.createElement('button');
    mainBtn.className = 'sub-selector-main-btn focusable-modal';
    mainBtn.innerHTML = `<span>${currentItem.label || currentItem.value}</span> <i class="fas fa-chevron-down"></i>`;
    if (prefType === 'subtitle_color') mainBtn.style.borderLeft = `5px solid ${currentItem.value}`;

    const dropdownList = document.createElement('div');
    dropdownList.className = 'sub-dropdown-list'; 
    
    list.forEach((item) => {
      const itemBtn = document.createElement('button');
      itemBtn.className = 'sub-dropdown-item focusable-modal-list';
      itemBtn.textContent = item.label || item.value;
      if (String(item.value) === String(currentValue)) itemBtn.classList.add('active');

      itemBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (prefType === 'subtitle_size') tempSubSize = item.value;
        else if (prefType === 'subtitle_color') tempSubColor = item.value;
        else if (prefType === 'subtitle_font') tempSubFont = item.value;

        mainBtn.innerHTML = `<span>${item.label || item.value}</span> <i class="fas fa-chevron-down"></i>`;
        if (prefType === 'subtitle_color') mainBtn.style.borderLeft = `5px solid ${item.value}`;
        
        updateSubPreview();
        dropdownList.classList.remove('visible');
        mainBtn.focus();
      });
      dropdownList.appendChild(itemBtn);
    });

    mainBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasVisible = dropdownList.classList.contains('visible');
      document.querySelectorAll('.sub-dropdown-list').forEach(el => el.classList.remove('visible'));
      if (!wasVisible) dropdownList.classList.add('visible');
    });

    container.appendChild(mainBtn);
    container.appendChild(dropdownList);
};

function updateSubPreview() {
    const statusEl = document.getElementById('sub-config-status');
    if (statusEl) {
        const font = SUB_FONTS.find(f => f.value === tempSubFont)?.label || 'Sistema';
        const color = SUB_COLORS.find(c => c.value === tempSubColor)?.label || 'Blanco';
        statusEl.style.fontFamily = tempSubFont;
        statusEl.style.fontSize = `${tempSubSize}px`;
        statusEl.style.color = tempSubColor;
        statusEl.innerHTML = `Vista Previa: ${font} - ${tempSubSize}px - ${color}`;
    }
}

export function setupSettingsPage() {
  renderSettingsPage();

  const gridContainer = document.getElementById('settings-grid');
  if (gridContainer) {
    let html = '';
    SETTINGS_GRID_ITEMS.forEach((item, index) => {
      html += `
        <div class="setting-card focusable" data-id="${item.id}" data-index="${index}">
          <i class="fas ${item.icon}"></i>
          <span>${item.label}</span>
        </div>`;
    });
    gridContainer.innerHTML = html;
  }

  const safeGoBack = () => {
    if (globalSettingsKeyHandler) {
      document.removeEventListener('keydown', globalSettingsKeyHandler);
      globalSettingsKeyHandler = null;
    }
    router.loadView('home', { callback: setupHomePage });
  };
  const logoBtn = document.getElementById('settings-logo');
  if (logoBtn) {
    logoBtn.addEventListener('click', safeGoBack);
  }

  // MODALES
  const modal = document.getElementById('settings-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalContainer = document.getElementById('modal-options-container');
  const btnCancel = document.getElementById('btn-modal-cancel');
  const btnOk = document.getElementById('btn-modal-ok');
  
  // HISTORIAL
  const histModal = document.getElementById('history-modal-overlay');
  const histBtnCancel = document.getElementById('hist-btn-cancel');
  const histBtnConfirm = document.getElementById('hist-btn-confirm');

  function openHistoryModal() {
      histModal.classList.add('visible');
      SettingsFocus.enterModal();
  }

  histBtnCancel.addEventListener('click', () => {
      histModal.classList.remove('visible');
      SettingsFocus.exitModal();
  });

  histBtnConfirm.addEventListener('click', async () => {
      await HistoryRepository.clearAll();
      const status = document.getElementById('setting-status-bar');
      if(status) status.textContent = "Historial borrado.";
      histModal.classList.remove('visible');
      SettingsFocus.exitModal();
  });

  function closeModal() {
    document.querySelectorAll('.sub-dropdown-list').forEach(el => el.classList.remove('visible'));
    modal.classList.remove('visible');
    SettingsFocus.exitModal();
  }

  function saveAndClose() {
    const errorMsg = document.getElementById('pin-error-msg');
    
    if (currentModalKey === 'parental_control') {
        if (pinMode === 'new') {
            if (currentPin.length !== 4) { if(errorMsg) errorMsg.textContent = "El PIN debe tener 4 dígitos"; return; }
            if (currentPin !== confirmPin) { if(errorMsg) errorMsg.textContent = "Los PINs no coinciden"; return; }
            SettingsPreferences.set('parental_pin', currentPin);
            SettingsPreferences.set('parental_control', true);
        } else if (pinMode === 'verify') {
            const storedPin = SettingsPreferences.get('parental_pin');
            if (currentPin !== storedPin) { if(errorMsg) errorMsg.textContent = "PIN incorrecto"; return; }
            SettingsPreferences.set('parental_control', false);
        } else {
            SettingsPreferences.set('parental_control', tempValue);
        }
    } 
    else if (currentModalKey === 'custom_subtitle_config') {
        SettingsPreferences.set('subtitle_size', tempSubSize);
        SettingsPreferences.set('subtitle_color', tempSubColor);
        SettingsPreferences.set('subtitle_font', tempSubFont);
    } 
    else if (Array.isArray(tempHiddenList) && ['hide_live','hide_movies','hide_series'].includes(currentModalKey)) {
        SettingsPreferences.set(currentModalKey, tempHiddenList);
    } 
    else if (currentModalKey) {
        SettingsPreferences.set(currentModalKey, tempValue);
    }
    
    closeModal();
  }

  btnCancel.addEventListener('click', closeModal);
  btnOk.addEventListener('click', saveAndClose);
  const pinHandler = (e) => {
            if (!modal.classList.contains('visible')) return;
            const key = e.key;
            if (/^\d$/.test(key)) {
                if (pinMode === 'new') {
                    if (currentPin.length < 4) { currentPin += key; updatePinVisuals(currentPin, false); } 
                    else if (confirmPin.length < 4) { confirmPin += key; updatePinVisuals(confirmPin, true); }
                } else if (pinMode === 'verify') {
                    if (currentPin.length < 4) { currentPin += key; updatePinVisuals(currentPin, false); }
                }
            } else if (key === 'Backspace' || key === '10009') { 
                if (pinMode === 'new') {
                    if (confirmPin.length > 0) { confirmPin = confirmPin.slice(0,-1); updatePinVisuals(confirmPin, true); }
                    else if (currentPin.length > 0) { currentPin = currentPin.slice(0,-1); updatePinVisuals(currentPin, false); }
                } else if (pinMode === 'verify') {
                    if (currentPin.length > 0) { currentPin = currentPin.slice(0,-1); updatePinVisuals(currentPin, false); }
                }
            }
        };

  async function openModal(id) {
    const config = MENU_DEFINITIONS[id];
    if (!config) return;
    currentModalKey = config.prefKey;
    const currentVal = SettingsPreferences.get(config.prefKey);
    tempValue = currentVal;
    currentPin = ""; confirmPin = ""; pinMode = "";
    modalTitle.textContent = config.title;
    modalContainer.innerHTML = '';

    if (config.type === 'custom_subtitle_config') {
       tempSubFont = SettingsPreferences.get('subtitle_font') || SUB_FONTS[0].value;
       tempSubSize = SettingsPreferences.get('subtitle_size') || SUB_SIZES[1];
       tempSubColor = SettingsPreferences.get('subtitle_color') || SUB_COLORS[0].value;

       modalContainer.innerHTML = `
         <div id="sub-config-status" class="confirm-text" style="margin-bottom:15px; min-height:30px;">Vista Previa</div>
         <div class="sub-config-container">
           <div class="sub-config-item"><div class="section-title-small">TAMAÑO</div><div id="sub-size-options"></div></div>
           <div class="sub-config-item"><div class="section-title-small">COLOR</div><div id="sub-color-options"></div></div>
           <div class="sub-config-item"><div class="section-title-small">FUENTE</div><div id="sub-font-options"></div></div>
         </div>
       `;
       renderSubOptions(SUB_SIZES.map(s => ({ label: `${s}px`, value: s })), 'sub-size-options', 'subtitle_size', tempSubSize);
       renderSubOptions(SUB_COLORS, 'sub-color-options', 'subtitle_color', tempSubColor);
       renderSubOptions(SUB_FONTS, 'sub-font-options', 'subtitle_font', tempSubFont);
       updateSubPreview();

       modal.classList.add('visible');
       SettingsFocus.enterModal('subtitles');
       return;
    }

    if (config.type === 'dynamic_multi_select') {
         modalContainer.innerHTML = '<div style="color:#ccc; padding:20px;">Cargando...</div>';
         modal.classList.add('visible');
         let categories = [];
         try {
             if (id === 'set-hidelive') { const { LiveTVRepository } = await import('../repositories/LiveTVRepository.js'); categories = await LiveTVRepository.getCategories(true); }
             else if (id === 'set-hidemovie') { const { MoviesRepository } = await import('../repositories/MoviesRepository.js'); categories = await MoviesRepository.getCategories(true); }
             else if (id === 'set-hideserie') { const { SeriesRepository } = await import('../repositories/SeriesRepository.js'); categories = await SeriesRepository.getCategories(true); }
         } catch (e) { Logger.error(e); }

         modalContainer.innerHTML = '';
         tempHiddenList = Array.isArray(currentVal) ? [...currentVal] : [];

         categories.forEach(cat => {
            const catId = String(cat.category_id || cat.id);
            const isHidden = tempHiddenList.includes(catId);
            const div = document.createElement('div');
            div.className = 'modal-option-btn focusable-modal';
            if (isHidden) div.classList.add('selected');
            div.textContent = cat.name || "Sin Nombre";
            div.addEventListener('click', () => {
                const idx = tempHiddenList.indexOf(catId);
                if (idx > -1) { tempHiddenList.splice(idx, 1); div.classList.remove('selected'); }
                else { tempHiddenList.push(catId); div.classList.add('selected'); }
            });
            modalContainer.appendChild(div);
         });
         SettingsFocus.enterModal();
         return;
    }
    
    if (config.type === 'parental_control') {
        config.options.forEach(opt => {
             const div = document.createElement('div');
             div.className = 'modal-option-btn focusable-modal';
             div.textContent = opt.label;
             if (opt.value === tempValue) div.classList.add('selected');
             
             div.addEventListener('click', () => {
                 document.querySelectorAll('.modal-option-btn').forEach(el => el.classList.remove('selected'));
                 div.classList.add('selected');
                 tempValue = opt.value;
                 const existingPins = modalContainer.querySelectorAll('.pin-setup-container');
                 existingPins.forEach(el => el.remove());
                 currentPin = ""; confirmPin = ""; 

                 if (tempValue === true) {
                     pinMode = 'new';
                     renderPinInputs(modalContainer, "Cree su PIN (4 dígitos)");
                     renderPinInputs(modalContainer, "Confirme su PIN", true);
                 } else if (tempValue === false && currentVal === true) {
                     pinMode = 'verify';
                     renderPinInputs(modalContainer, "Ingrese PIN actual para desactivar");
                 }
             });
             modalContainer.appendChild(div);
        });
        
        document.addEventListener('keydown', pinHandler);
    }
    
    else if (config.options) {
        config.options.forEach(opt => {
             const div = document.createElement('div');
             div.className = 'modal-option-btn focusable-modal';
             div.textContent = opt.label;
             if (String(opt.value) === String(currentVal)) div.classList.add('selected');
             
             div.addEventListener('click', () => {
                 document.querySelectorAll('.modal-option-btn').forEach(el => el.classList.remove('selected'));
                 div.classList.add('selected');
                 if (opt.value === 'true') tempValue = true;
                 else if (opt.value === 'false') tempValue = false;
                 else tempValue = opt.value;
             });
             modalContainer.appendChild(div);
        });
    }

    modal.classList.add('visible');
    SettingsFocus.enterModal();
  }

  const cards = document.querySelectorAll('.setting-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      if (id === 'set-history') {
          openHistoryModal();
          return;
      }
      if (MENU_DEFINITIONS[id]) openModal(id);
    });
  });

  SettingsFocus.init();
}