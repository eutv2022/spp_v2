// js/core/PlayerFocus.js

import {
    closeTrackMenu,
    onTrackItemSelected,
    showExitModal,
    hideExitModal,
} from '../views/PlayerPage.js';
import { Logger } from '../../../utils/logger.js';

let zones = {
    top: [],
    seek: [],
    buttons: [],
    menu: [],
    modal: []
};

let focusMode = 'controls';
let currentZone = 'buttons';
let currentIndex = 0;
let playerType = 'vod';
let lastControlZone = 'buttons';
let lastControlIndex = 0;
let playPauseBtn = null;
let hideControlsTimer = null;
let _active = false;
let lastBackTime = 0;
const BACK_DEBOUNCE_MS = 300;


export function activate() { _active = true; }
export function deactivate() { _active = false; }
export function snapshotState() {
    return { currentZone, currentIndex, focusMode, playerType };
}

export function restoreState(state = {}) {
    try {
        if (state.focusMode) focusMode = state.focusMode;
        if (state.playerType) playerType = state.playerType;
        if (state.currentZone) currentZone = state.currentZone;
        if (typeof state.currentIndex === 'number') currentIndex = state.currentIndex;
        if ((zones[currentZone] || []).length > 0) setFocus(currentZone, currentIndex);
    } catch (e) { Logger.error("PlayerFocus restoreState Fail", "PlayerFocus", e);}
}


function resetHideTimer() {
    const playerView = document.getElementById('player-view');
    if (playerView && focusMode !== 'modal') {
        playerView.classList.add('show-controls');
    }
    clearTimeout(hideControlsTimer);
    hideControlsTimer = setTimeout(() => {
        if (playerView && focusMode !== 'modal') {
            playerView.classList.remove('show-controls');
        }
    }, 5000);
}

function clearAllFocus() {
    [...zones.top, ...zones.seek, ...zones.buttons, ...zones.menu, ...zones.modal].forEach(el =>
        el.classList.remove('focused')
    );
}

function setFocus(zone, index) {
    resetHideTimer();
    clearAllFocus();

    currentZone = zone;
    let element;

    if (zone === 'top') {
        currentIndex = 0;
        element = zones.top[0];
    } else if (zone === 'seek') {
        currentIndex = 0;
        element = zones.seek[0];
    } else if (zone === 'buttons') {
        currentIndex = index;
        element = zones.buttons[index];
    } else if (zone === 'menu') {
        currentIndex = index;
        element = zones.menu[index];
    } else if (zone === 'modal') {
        currentIndex = index;
        element = zones.modal[index];
    }

    if (element) {
        element.classList.add('focused');
        try { element.focus(); } catch (e) {Logger.error("PlayerFocus setFocus Fail", "PlayerFocus", e);}
    }
}


function findNextEnabledIndex(startIndex) {
    if (!zones.buttons) return -1;
    for (let i = startIndex + 1; i < zones.buttons.length; i++) {
        if (zones.buttons[i] && !zones.buttons[i].classList.contains('disabled')) {
            return i;
        }
    }
    return -1;
}
function findPrevEnabledIndex(startIndex) {
    if (!zones.buttons) return -1;
    for (let i = startIndex - 1; i >= 0; i--) {
        if (zones.buttons[i] && !zones.buttons[i].classList.contains('disabled')) {
            return i;
        }
    }
    return -1;
}


export const PlayerFocus = {

    init: (type) => {
        _active = true;
        playerType = type;
        playPauseBtn = null;
        focusMode = 'controls';
        zones.modal = Array.from(document.querySelectorAll('#exit-modal-buttons .focusable'));
        zones.menu = [];
        zones.top = Array.from(document.querySelectorAll('#top-zone .focusable'));

        if (type === 'livetv') {

            zones.seek = [];
            zones.buttons = Array.from(document.querySelectorAll('#live-buttons-zone .focusable'));
            playPauseBtn = document.getElementById('live-play-pause');
        } else {

            zones.seek = Array.from(document.querySelectorAll('#seek-zone.focusable-seek'));
            zones.buttons = Array.from(document.querySelectorAll('#buttons-zone .focusable'));
            playPauseBtn = document.getElementById('vod-play-pause');
        }
        if (type === 'livetv') {
            currentZone = 'buttons';
            const playIndex = zones.buttons.findIndex(el => el && el.id === 'live-play-pause');
            currentIndex = (playIndex !== -1) ? playIndex : 0;
        } else {
            const playIndex = zones.buttons.findIndex(el => el && el.id === 'vod-play-pause');
            currentIndex = (playIndex !== -1) ? playIndex : 0;
            currentZone = 'buttons';
        }

         setFocus(currentZone, currentIndex);
    },

    navigate: (direction) => {
        if (!_active) return;
        resetHideTimer();

        if (focusMode === 'menu') {
            let newIndex = currentIndex;
            if (direction === 'up') {
                if (currentIndex > 0) newIndex--;
            } else if (direction === 'down') {
                if (currentIndex < zones.menu.length - 1) newIndex++;
            }
             setFocus('menu', newIndex);

        } else if (focusMode === 'modal') {
            let newIndex = currentIndex;
            if (direction === 'left') {
                if (currentIndex > 0) newIndex--;
            } else if (direction === 'right') {
                if (currentIndex < zones.modal.length - 1) newIndex++;
            }
            setFocus('modal', newIndex);
        } else {

            if (playerType !== 'livetv') {
                if (currentZone === 'buttons') {
                    if (direction === 'up') {
                        setFocus('seek', 0);
                    } else if (direction === 'left') {
                        const prevIndex = findPrevEnabledIndex(currentIndex);
                        if (prevIndex !== -1) setFocus('buttons', prevIndex);
                    } else if (direction === 'right') {
                        const nextIndex = findNextEnabledIndex(currentIndex);
                        if (nextIndex !== -1) setFocus('buttons', nextIndex);
                    }
                }
                else if (currentZone === 'seek') {
                    if (direction === 'up') {
                        setFocus('top', 0);
                    } else if (direction === 'down') {
                        const playIndex = zones.buttons.findIndex(el => el && el.id === 'vod-play-pause');
                        setFocus('buttons', (playIndex !== -1) ? playIndex : 0);
                    }
                }
                else if (currentZone === 'top') {
                    if (direction === 'down') {
                        setFocus('seek', 0);
                    }
                }
            } else { 
                if (currentZone === 'buttons') {
                    if (direction === 'up') {
                        setFocus('top', 0);
                    } else if (direction === 'left') {
                        if (currentIndex > 0) setFocus('buttons', currentIndex - 1);
                    } else if (direction === 'right') {
                        if (currentIndex < zones.buttons.length - 1) setFocus('buttons', currentIndex + 1);
                    }
                }
                else if (currentZone === 'top') {
                    if (direction === 'down') {
                        const playIndex = zones.buttons.findIndex(el => el && el.id === 'live-play-pause');
                        setFocus('buttons', (playIndex !== -1) ? playIndex : 0);
                    }
                }
            }

        }
    },

    select: () => {
        if (!_active) return;
        resetHideTimer();
        
        if (focusMode === 'menu') {
            const selectedItem = zones.menu[currentIndex];
            if (selectedItem) onTrackItemSelected(selectedItem);

        } else if (focusMode === 'modal') {
            const selectedItem = zones.modal[currentIndex];
            if (selectedItem) {
                selectedItem.click();
            }
        } else {
            let element;
            if (currentZone === 'top') element = zones.top[currentIndex];
            if (currentZone === 'seek') element = zones.seek[currentIndex];
            if (currentZone === 'buttons') element = zones.buttons[currentIndex];

            if (element) {
                if (element.classList.contains('disabled')) {
                    return;
                }

                element.click();
                if (element === playPauseBtn) {
                    const icon = playPauseBtn ? playPauseBtn.querySelector('i') : null;
                    if (icon) {
                        if (icon.classList.contains('fa-play')) {
                            icon.classList.replace('fa-play', 'fa-pause');
                } else {
                            icon.classList.replace('fa-pause', 'fa-play');
                        }
}
                }
            }
        }
    },
    handleMediaKey: (action) => {
        if (!_active) return;
        
        switch(action) {
            case 'play_pause':
                if (playPauseBtn) playPauseBtn.click();
                break;
            case 'stop':
                PlayerFocus.handleBack();
                break;
            case 'ff':
                document.getElementById('vod-ffw')?.click();
                break;
            case 'rw':
                document.getElementById('vod-rwd')?.click();
                break;
        }
    },
    enterMenu: (menuType) => {
        if (!_active) return;
        focusMode = menuType;
        lastControlZone = currentZone;
        lastControlIndex = currentIndex;

        if (menuType === 'menu') {
            zones.menu = Array.from(document.querySelectorAll('#track-menu-list .focusable'));
            setFocus('menu', 0);
        } else if (menuType === 'modal') {
            setTimeout(() => {
                zones.modal = Array.from(document.querySelectorAll('.exit-modal-buttons .focusable'));
                if (zones.modal.length > 0) {
                    currentZone = 'modal'; 
                    const targetIndex = zones.modal.length > 1 ? 1 : 0;
                    setFocus('modal', targetIndex);
                } else {
                }
            }, 100);
        }
    },

    exitMenu: () => {
        if (!_active) return;
        focusMode = 'controls';
        zones.menu = [];
        setFocus(lastControlZone, lastControlIndex);
    },

    handleBack: () => {
    if (!_active) return false;
    const now = Date.now();
        if (now - lastBackTime < BACK_DEBOUNCE_MS) {
            return true;
        }
        lastBackTime = now;
    clearTimeout(hideControlsTimer);

    if (focusMode === 'menu') {
        closeTrackMenu();
        PlayerFocus.exitMenu();
        return true;
    } else if (focusMode === 'modal') {
        hideExitModal();
        PlayerFocus.exitMenu();
        return true;
    } else {
        showExitModal();
        PlayerFocus.enterMenu('modal');

        return true; 
    }
},

    cleanup: () => {
        zones = { top: [], seek: [], buttons: [], menu: [], modal: [] };
        focusMode = 'controls';
        currentZone = 'buttons';
        currentIndex = 0;
        _active = false;
    },

    shortPress: (direction) => {
        if (!_active) return;
        resetHideTimer();
        if (direction === 'left') {
            document.getElementById('vod-rwd')?.click();
        } else if (direction === 'right') {
            document.getElementById('vod-ffw')?.click();
        }
    },

    longPress: (direction) => {
        if (!_active) return;
        if (playerType !== 'livetv') {
            if (direction === 'left') {
            } else if (direction === 'right') {
            }
        }
    }
};
