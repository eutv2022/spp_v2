// js/core/contentFocus.js

let zones = { 
    logo: [], 
    search: [], 
    categories: [], 
    grid: []
};
let currentZone = "categories";
let currentIndex = 0;
const NUM_COLS_GRID = 5;

function setFocus(index) {
    const prevFocused = document.querySelector('.focused');
    if (prevFocused) prevFocused.classList.remove('focused');

    const zoneList = zones[currentZone];
    if (!zoneList || zoneList.length === 0) {
        return currentIndex;
    }
    let idx = Number.isFinite(index) ? Math.floor(index) : 0;
    idx = Math.max(0, Math.min(idx, zoneList.length - 1));

    const newEl = zoneList[idx];

    if (newEl) {
        newEl.classList.add("focused");
        try { newEl.focus(); } catch {}

        newEl.scrollIntoView({
            behavior: 'auto', 
            block: 'center', 
            inline: 'nearest'
        });
    }

    currentIndex = idx;
    return currentIndex;
}

export const ContentFocus = {
   init() {
        zones = { logo: [], search: [], categories: [], grid: [] }; 
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.refreshZones();
                const selectedCat = document.querySelector('#category-list-container .category-btn.selected');
                    if (selectedCat && zones.categories.length > 0) {
                    const foundIndex = zones.categories.indexOf(selectedCat);
                        if (foundIndex !== -1) {
                            currentZone = 'categories';
                            currentIndex = foundIndex;
                            setFocus(currentIndex);
                        return;
                       }
                    }           

                currentZone = this._findFirstNonEmptyZone(['categories', 'search', 'logo']);
                currentIndex = 0;
                if (currentZone) setFocus(0);
            });
        });
    },

    refreshZones() {
        zones.logo = Array.from(document.querySelectorAll("#content-logo.focusable")); 
        zones.search = Array.from(document.querySelectorAll("#content-search.focusable")); 
        zones.categories = Array.from(document.querySelectorAll("#category-list-container .focusable"));
        zones.grid = Array.from(document.querySelectorAll("#channel-grid-container .focusable"));
    },

    reindexCategories() {
        zones.categories = Array.from(document.querySelectorAll("#category-list-container .focusable"));
        const selectedCat = document.querySelector('#category-list-container .category-btn.selected');
        
        if (selectedCat && zones.categories.length > 0) {
            const foundIndex = zones.categories.indexOf(selectedCat);
            if (foundIndex !== -1) {
                currentZone = 'categories';
                currentIndex = foundIndex;
                setFocus(currentIndex);
                return;
            }
        }

        if (currentZone === 'categories') setFocus(currentIndex);
    },

    reindexGrid() {
        zones.grid = Array.from(document.querySelectorAll("#channel-grid-container .focusable"));
    },

    navigate(direction) {
        const z = zones;
        const zoneList = z[currentZone];
        if (!zoneList || zoneList.length === 0) return;
        let targetZone = currentZone;
        let targetIndex = currentIndex;

        if (currentZone === 'logo') {
            if (direction === 'down') { 
                targetZone = 'categories';
                const selectedCat = document.querySelector('.category-btn.selected');
                if (selectedCat) {
                    const idx = z.categories.indexOf(selectedCat);
                    targetIndex = idx !== -1 ? idx : 0;
                } else {
                    targetIndex = 0;
                }
            }
            else if (direction === 'right') { targetZone = 'search'; targetIndex = 0; }
        } 
        else if (currentZone === 'search') {
            if (direction === 'left') { targetZone = 'logo'; targetIndex = 0; }
            else if (direction === 'down') { 
                this.reindexGrid(); 
                targetZone = 'grid'; 
                targetIndex = 0; 
            }
        } 
        else if (currentZone === 'categories') {
            if (direction === 'up') {
                if (currentIndex === 0) { targetZone = 'logo'; targetIndex = 0; } 
                else { targetIndex = currentIndex - 1; }
            } 
            else if (direction === 'down') {
                if (currentIndex < zoneList.length - 1) targetIndex = currentIndex + 1;
            } 
            else if (direction === 'right') {
                this.reindexGrid(); 
                if (this._zoneHasItems('grid')) {
                    targetZone = 'grid';
                    targetIndex = 0;
                } else {
                    return;
                }
            }
        } 
        else if (currentZone === 'grid') {
            if (direction === 'left') {
                if (currentIndex % NUM_COLS_GRID === 0) { 
                    targetZone = 'categories';
                    const selectedCategory = document.querySelector('.category-btn.selected');
                    if (selectedCategory) {
                        this.reindexCategories();
                        const foundIndex = zones.categories.indexOf(selectedCategory);
                        targetIndex = (foundIndex !== -1) ? foundIndex : 0;
                    } else {
                        targetIndex = 0;
                    }
                } else {
                    targetIndex = currentIndex - 1;
                }
            }
            else if (direction === 'right') {
                if (currentIndex < zoneList.length - 1) targetIndex = currentIndex + 1;
            }
            else if (direction === 'up') {
                if (currentIndex < NUM_COLS_GRID) { 
                    targetZone = 'search'; targetIndex = 0;
                } else {
                    targetIndex = currentIndex - NUM_COLS_GRID;
                }
            }
            else if (direction === 'down') {
                if (currentIndex + NUM_COLS_GRID < zoneList.length) {
                    targetIndex = currentIndex + NUM_COLS_GRID;
                }
            }
        }

        if (targetZone !== currentZone) {
            const destList = zones[targetZone];
            if (!destList || destList.length === 0) return;
            
            targetIndex = Math.max(0, Math.min(targetIndex, destList.length - 1));
            currentZone = targetZone;
            currentIndex = targetIndex;
        } else {
            currentIndex = targetIndex;
        }

        setFocus(currentIndex);
    },

    select() {
        const list = zones[currentZone];
        if (!list || list.length === 0) return;
        const el = list[currentIndex];
        
        if (el) {
            if (currentZone === 'search') {
                const inputField = document.getElementById('search-input'); 
                if (inputField) { inputField.focus(); return; }
            }
            el.click();
        }
    },
        
    _zoneHasItems(zoneName) {
        const list = zones[zoneName]; 
        return Array.isArray(list) && list.length > 0;
    },
    
    _findFirstNonEmptyZone(zoneOrder) {
        for (const name of zoneOrder) {
            if (this._zoneHasItems(name)) return name;
        }
        return null;
    },
    handleBack() {
        this.refreshZones();
        
        if (currentZone === 'grid' || currentZone === 'search') {
            const selectedCat = document.querySelector('.category-btn.selected');
            if (selectedCat) {
                const idx = zones.categories.indexOf(selectedCat);
                if (idx !== -1) {
                    currentZone = 'categories';
                    currentIndex = idx;
                    setFocus(currentIndex);
                    return true;
                }
            }
            if (this._zoneHasItems('categories')) {
                currentZone = 'categories';
                currentIndex = 0;
                setFocus(0);
                return true;
            }
        }
        return false; 
    },

    handleMediaKey(action) {
        if (action === 'play_pause') {
            this.select();
        }
    }
};