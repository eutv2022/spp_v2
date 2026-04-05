// utils/domWatcher.js
import { Logger } from './logger.js';

/**
 * @param {string} selector
 * @param {HTMLElement} parent
 * @param {number} timeoutMs
 * @returns {Promise<Element>}
 */

export function waitForElement(selector, parent = document.body, timeoutMs = 0) {
    return new Promise((resolve) => {
        const element = document.querySelector(selector);
        if (element) {
            return resolve(element);
        }

        const observer = new MutationObserver(() => {
            const target = document.querySelector(selector);
            if (target) {
                observer.disconnect();
                if (timeoutTimer) clearTimeout(timeoutTimer);
                resolve(target);
            }
        });
        let timeoutTimer = null;
        if (timeoutMs > 0) {
            timeoutTimer = setTimeout(() => {
                observer.disconnect();
                Logger.warn(`waitForElement: Timeout esperando ${selector}`);
                resolve(null);
            }, timeoutMs);
        }

        observer.observe(parent, {
            childList: true,
            subtree: true
        });
    });
}