// ==UserScript==
// @name             MyBB Cover Tooltip
// @namespace        http://tampermonkey.net/
// @version          1.4
// @description      Displays the main image on the left and if needed a grid of additional images on the right.
// @author           Darth Obvious
// @match            */*
// @grant            GM_xmlhttpRequest
// @grant            GM_addStyle
// @grant            GM_setValue
// @grant            GM_getValue
// @grant            GM_registerMenuCommand
// @license          MIT
// ==/UserScript==

(function () {
    'use strict';

    // --- Configuration Defaults ---
    const DEFAULT_SETTINGS = {
        MAIN_IMAGE_WIDTH: 250, // Main image width
        GRID_THUMBNAIL_SIZE: 75, // Thumbnail width in grid
        GRID_COLUMNS: 3, // Number of columns in grid
        GRID_CONTAINER_MAX_HEIGHT: 330, // Maximum height for grid container
        HIDE_TOOLTIP_DELAY: 300, // Delay before hiding tooltip (in ms)
        IMAGE_CLASS_BLACKLIST: ['smilie', 'emoji', 'avatar'], // Image classes to ignore
        URL_REGEX_BLACKLIST: [
            'emule\\.png$',
            'emule64\\.png$',
            '/icones/',
        ] // Regex patterns for image URLs to ignore
    };

    // --- Script Settings (will be populated from GM_getValue or defaults) ---
    let settings = {};

    // --- Fixed constants (not configurable via UI as per current request) ---
    const GRID_GAP = 4; // Space between thumbnails
    const LINK_SELECTOR_PREFIX = 'showthread.php?tid='; // Prefix for thread links
    const POST_CONTENT_SELECTOR = 'div.post_body'; // Selector for the content of the first post

    // --- Global variables ---
    let tooltipElement = document.createElement('div');
    tooltipElement.id = 'cover-tooltip-userscript';
    document.body.appendChild(tooltipElement);
    let hideTooltipTimer = null;
    let styleElement = null; // To hold the GM_addStyle element for updates

    // --- Calculated dimensions (will be calculated after settings are loaded) ---
    let GRID_THUMBNAIL_HEIGHT;
    let gridInternalWidth;
    let gridContainerWidth;

    const imageCache = new Map();
    let compiledUrlRegexBlacklist = [];

    // --- Functions for Settings Management ---
    const loadSettings = () => {
        settings.MAIN_IMAGE_WIDTH = GM_getValue('MAIN_IMAGE_WIDTH', DEFAULT_SETTINGS.MAIN_IMAGE_WIDTH);
        settings.GRID_THUMBNAIL_SIZE = GM_getValue('GRID_THUMBNAIL_SIZE', DEFAULT_SETTINGS.GRID_THUMBNAIL_SIZE);
        settings.GRID_COLUMNS = GM_getValue('GRID_COLUMNS', DEFAULT_SETTINGS.GRID_COLUMNS);
        settings.GRID_CONTAINER_MAX_HEIGHT = GM_getValue('GRID_CONTAINER_MAX_HEIGHT', DEFAULT_SETTINGS.GRID_CONTAINER_MAX_HEIGHT);
        settings.HIDE_TOOLTIP_DELAY = GM_getValue('HIDE_TOOLTIP_DELAY', DEFAULT_SETTINGS.HIDE_TOOLTIP_DELAY);
        settings.IMAGE_CLASS_BLACKLIST = GM_getValue('IMAGE_CLASS_BLACKLIST', DEFAULT_SETTINGS.IMAGE_CLASS_BLACKLIST);
        settings.URL_REGEX_BLACKLIST = GM_getValue('URL_REGEX_BLACKLIST', DEFAULT_SETTINGS.URL_REGEX_BLACKLIST);

        applyConfiguration();
    };

    const applyConfiguration = () => {
        GRID_THUMBNAIL_HEIGHT = Math.round(settings.GRID_THUMBNAIL_SIZE * (4 / 3));
        gridInternalWidth = (settings.GRID_THUMBNAIL_SIZE * settings.GRID_COLUMNS) + (GRID_GAP * (settings.GRID_COLUMNS - 1));
        gridContainerWidth = gridInternalWidth + (GRID_GAP * 2);

        compiledUrlRegexBlacklist = settings.URL_REGEX_BLACKLIST.map(pattern => {
            try {
                return new RegExp(pattern, 'i');
            } catch (e) {
                console.warn(`[MyBB Cover Tooltip] Invalid regex pattern in URL_REGEX_BLACKLIST: ${pattern}`, e);
                return null; // Ignore invalid regex
            }
        }).filter(regex => regex !== null);

        updateStyles();
    };

    const updateStyles = () => {
        if (styleElement && styleElement.parentNode) {
            styleElement.parentNode.removeChild(styleElement);
        }
        const css = `
        #cover-tooltip-userscript {
            position: fixed;
            display: none;
            width: auto;
            max-width: calc(${settings.MAIN_IMAGE_WIDTH}px + ${gridContainerWidth}px + 8px /* margin main image */ + 16px /* padding tooltip */);
            border: 1px solid #ccc;
            background-color: #fff;
            box-shadow: 3px 3px 8px rgba(0,0,0,0.3);
            padding: 8px;
            z-index: 99999;
            overflow: visible;
        }
        .tooltip-content-wrapper {
            display: flex;
            align-items: flex-start;
        }
        .tooltip-main-image-left {
            width: ${settings.MAIN_IMAGE_WIDTH}px;
            height: auto;
            max-height: ${settings.GRID_CONTAINER_MAX_HEIGHT}px;
            object-fit: contain;
            display: block;
            margin-right: 8px;
            flex-shrink: 0;
        }
        .tooltip-additional-grid-container {
            display: grid;
            grid-template-columns: repeat(${settings.GRID_COLUMNS}, ${settings.GRID_THUMBNAIL_SIZE}px);
            gap: ${GRID_GAP}px;
            padding: ${GRID_GAP}px;
            width: ${gridContainerWidth}px;
            height: auto;
            max-height: ${settings.GRID_CONTAINER_MAX_HEIGHT}px;
            overflow-y: auto;
            overflow-x: hidden;
            border: 1px solid #f0f0f0;
            background-color: #f9f9f9;
        }
        .tooltip-additional-grid-image {
            width: ${settings.GRID_THUMBNAIL_SIZE}px;
            height: ${GRID_THUMBNAIL_HEIGHT}px;
            object-fit: cover;
            border: 1px solid #ddd;
            box-sizing: border-box;
            cursor: pointer;
        }
        .tooltip-additional-grid-image.tooltip-thumbnail-selected {
            border: 2px solid dodgerblue;
        }
        #cover-tooltip-userscript .tooltip-loading,
        #cover-tooltip-userscript .tooltip-message {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 10px 0;
            min-height: 50px;
            font-style: italic;
            color: #555;
        }
        /* Styles for Settings Modal */
        #ct-settings-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background-color: rgba(0,0,0,0.5); z-index: 999999; display: flex;
            align-items: center; justify-content: center;
        }
        #ct-settings-modal {
            background-color: white; border: 1px solid #ccc;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            padding: 20px; width: 500px; max-width: 90vw;
            max-height: 80vh; overflow-y: auto;
            font-family: Arial, sans-serif; font-size: 14px;
            border-radius: 5px;
        }
        #ct-settings-modal h2 {
            margin-top: 0; margin-bottom: 20px; font-size: 18px;
            border-bottom: 1px solid #eee; padding-bottom: 10px; color: #333;
        }
        #ct-settings-modal h3 {
            margin-top: 20px; margin-bottom: 10px; font-size: 16px; color: #555;
             border-bottom: 1px solid #f0f0f0; padding-bottom: 5px;
        }
        #ct-settings-modal label {
            display: block; margin-top: 12px; margin-bottom: 4px;
            font-weight: bold; color: #444;
        }
        #ct-settings-modal input[type="number"],
        #ct-settings-modal textarea {
            padding: 7px; /* Slight padding adjustment */
            border: 1px solid #ccc;
            border-radius: 3px;
            box-sizing: border-box;
            font-size: 14px;
            resize: vertical;
        }

        /* Style for parameter rows (label on the left, input on the right) */
        .setting-row {
            display: flex;
            justify-content: space-between; /* Pushes label to the left and input to the right */
            align-items: center;          /* Center vertical alignment */
            margin-bottom: 12px;          /* Space between rows */
        }

        .setting-row label {
            margin-right: 15px;           /* Space between label and input field */
            flex-shrink: 0;               /* Prevents label from shrinking if text is long */
            white-space: nowrap;          /* Prevents label text from wrapping too early */
        }

        .setting-row input[type="number"],
        .setting-row textarea {
            width: 220px;                 /* Fixed width for input fields */
        }

        .setting-row textarea {
            min-height: 50px;             /* Specific height for textareas in a row */
        }

        /* Styles for Save/Cancel buttons */
        #ct-settings-modal .buttons {
            margin-top: 25px;
            padding-top: 15px;
            border-top: 1px solid #e0e0e0; /* Slightly more visible border */
            text-align: right;           /* Aligns buttons to the right of the .buttons container */
        }

        #ct-settings-modal .buttons button {
            padding: 9px 18px;           /* Adjusted padding */
            margin-left: 10px;           /* Space to the left of each button (thus between buttons) */
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;            /* Slightly bolder font */
            transition: background-color 0.2s ease, box-shadow 0.2s ease;
        }
        #ct-settings-modal .buttons button:hover {
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); /* Subtle shadow on hover */
        }

        #ct-settings-modal button#ct-save-settings {
            background: #28a745;
            color: white;
        }
        #ct-settings-modal button#ct-save-settings:hover {
            background-color: #218838;
        }

        #ct-settings-modal button#ct-cancel-settings {
            background: #dc3545;
            color: white;
        }
        #ct-settings-modal button#ct-cancel-settings:hover {
            background-color: #c82333; 
        }
        `;
        styleElement = GM_addStyle(css);
    };

    const openSettingsPage = () => {
        if (document.getElementById('ct-settings-overlay')) {
            return;
        } // Already open

        const overlay = document.createElement('div');
        overlay.id = 'ct-settings-overlay';

        const modal = document.createElement('div');
        modal.id = 'ct-settings-modal';
        modal.innerHTML = `
            <h2>Cover Tooltip settings</h2>

            <h3>Display</h3>
            <div class="setting-row">
                <label for="ctMainImageWidth">Main image width (px):</label>
                <input type="number" id="ctMainImageWidth" value="${settings.MAIN_IMAGE_WIDTH}" min="50">
            </div>
            <div class="setting-row">
                <label for="ctGridThumbnailSize">Grid thumbnail size (px):</label>
                <input type="number" id="ctGridThumbnailSize" value="${settings.GRID_THUMBNAIL_SIZE}" min="20">
            </div>
            <div class="setting-row">
                <label for="ctGridColumns">Grid columns:</label>
                <input type="number" id="ctGridColumns" value="${settings.GRID_COLUMNS}" min="1">
            </div>
            <div class="setting-row">
                <label for="ctGridContainerMaxHeight">Grid container max height (px):</label>
                <input type="number" id="ctGridContainerMaxHeight" value="${settings.GRID_CONTAINER_MAX_HEIGHT}" min="50">
            </div>
            <div class="setting-row">
                <label for="ctHideTooltipDelay">Hide tooltip delay (ms):</label>
                <input type="number" id="ctHideTooltipDelay" value="${settings.HIDE_TOOLTIP_DELAY}" min="0">
            </div>

            <h3>Filters</h3>
            <div class="setting-row">
                <label for="ctImageClassBlacklist">Image classes to ignore<br/>(one per line):</label>
                <textarea id="ctImageClassBlacklist" rows="5">${settings.IMAGE_CLASS_BLACKLIST.join('\n')}</textarea>
            </div>
            <div class="setting-row">
                <label for="ctUrlRegexBlacklist">Image URL regex to ignore<br/>(one per line):</label>
                <textarea id="ctUrlRegexBlacklist" rows="5">${settings.URL_REGEX_BLACKLIST.join('\n')}</textarea>
            </div>

            <div class="buttons">
                <button id="ct-save-settings">Save</button>
                <button id="ct-cancel-settings">Cancel</button>
            </div>
        `;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const getInt = (id, defaultValue) => parseInt(document.getElementById(id).value, 10) || defaultValue;
        const getList = (id) => document.getElementById(id).value.split('\n').map(s => s.trim()).filter(s => s.length > 0);

        document.getElementById('ct-save-settings').addEventListener('click', () => {
            settings.MAIN_IMAGE_WIDTH = getInt('ctMainImageWidth', DEFAULT_SETTINGS.MAIN_IMAGE_WIDTH);
            settings.GRID_THUMBNAIL_SIZE = getInt('ctGridThumbnailSize', DEFAULT_SETTINGS.GRID_THUMBNAIL_SIZE);
            settings.GRID_COLUMNS = getInt('ctGridColumns', DEFAULT_SETTINGS.GRID_COLUMNS);
            settings.GRID_CONTAINER_MAX_HEIGHT = getInt('ctGridContainerMaxHeight', DEFAULT_SETTINGS.GRID_CONTAINER_MAX_HEIGHT);
            settings.HIDE_TOOLTIP_DELAY = getInt('ctHideTooltipDelay', DEFAULT_SETTINGS.HIDE_TOOLTIP_DELAY);
            settings.IMAGE_CLASS_BLACKLIST = getList('ctImageClassBlacklist');
            settings.URL_REGEX_BLACKLIST = getList('ctUrlRegexBlacklist');

            GM_setValue('MAIN_IMAGE_WIDTH', settings.MAIN_IMAGE_WIDTH);
            GM_setValue('GRID_THUMBNAIL_SIZE', settings.GRID_THUMBNAIL_SIZE);
            GM_setValue('GRID_COLUMNS', settings.GRID_COLUMNS);
            GM_setValue('GRID_CONTAINER_MAX_HEIGHT', settings.GRID_CONTAINER_MAX_HEIGHT);
            GM_setValue('HIDE_TOOLTIP_DELAY', settings.HIDE_TOOLTIP_DELAY);
            GM_setValue('IMAGE_CLASS_BLACKLIST', settings.IMAGE_CLASS_BLACKLIST);
            GM_setValue('URL_REGEX_BLACKLIST', settings.URL_REGEX_BLACKLIST);

            applyConfiguration();
            closeSettingsPage();
        });

        document.getElementById('ct-cancel-settings').addEventListener('click', closeSettingsPage);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeSettingsPage();
            }
        });
    };

    const closeSettingsPage = () => {
        const overlay = document.getElementById('ct-settings-overlay');
        if (overlay) {
            overlay.remove();
        }
    };

    const cancelHideTooltip = () => { clearTimeout(hideTooltipTimer); };
    const requestHideTooltip = () => {
        cancelHideTooltip();
        hideTooltipTimer = setTimeout(() => { tooltipElement.style.display = 'none'; }, settings.HIDE_TOOLTIP_DELAY);
    };

    const showTooltipImmediately = (event, contentHtml) => {
        cancelHideTooltip();
        tooltipElement.innerHTML = contentHtml;
        const mainImageDisplay = tooltipElement.querySelector('.tooltip-main-image-left');
        const thumbnails = tooltipElement.querySelectorAll('.tooltip-additional-grid-image');

        if (mainImageDisplay && thumbnails.length > 0) {
            // Select the first thumbnail by default if it corresponds to the main image
            if (thumbnails[0] && mainImageDisplay.src === thumbnails[0].src) {
                thumbnails[0].classList.add('tooltip-thumbnail-selected');
            }

            thumbnails.forEach(thumbnail => {
                thumbnail.addEventListener('click', (clickEvent) => {
                    clickEvent.preventDefault();
                    const newSrc = thumbnail.src;
                    const newAlt = thumbnail.alt.replace('Thumbnail', 'Image');
                    mainImageDisplay.src = newSrc;
                    mainImageDisplay.alt = newAlt;
                    thumbnails.forEach(t => t.classList.remove('tooltip-thumbnail-selected'));
                    thumbnail.classList.add('tooltip-thumbnail-selected');
                });
            });
        }
        if (event) {
            positionTooltip(event);
        }
        tooltipElement.style.display = 'block';
    };

    tooltipElement.addEventListener('mouseenter', cancelHideTooltip);
    tooltipElement.addEventListener('mouseleave', requestHideTooltip);

    const positionTooltip = (event) => {
        let x = event.clientX + 15;
        let y = event.clientY + 15;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const currentTooltipWidth = tooltipElement.offsetWidth;
        const currentTooltipHeight = tooltipElement.offsetHeight;

        if (x + currentTooltipWidth > viewportWidth - 10) {
            x = event.clientX - currentTooltipWidth - 15;
            x = Math.max(x, 10);
        }
        if (y + currentTooltipHeight > viewportHeight - 10) {
            y = event.clientY - currentTooltipHeight - 15;
            y = Math.max(y, 10);
        }
        tooltipElement.style.left = `${x}px`;
        tooltipElement.style.top = `${y}px`;
    };

    const generateAndShowTooltipHtml = (event, imageData) => {
        let htmlContent = '';
        cancelHideTooltip();

        if (imageData === 'loading') {
            htmlContent = '<div class="tooltip-loading">Loading...</div>';
        } else if (Array.isArray(imageData) && imageData.length > 0) {
            const mainImageUrl = imageData[0];
            let additionalImagesHtml = '';
            if (imageData.length > 1) {
                for (let i = 0; i < imageData.length; i++) {
                    additionalImagesHtml += `<img src="${imageData[i]}" alt="Thumbnail ${i + 1}" class="tooltip-additional-grid-image">`;
                }
            }
            htmlContent = `
                <div class="tooltip-content-wrapper">
                    <img src="${mainImageUrl}" alt="Main Image" class="tooltip-main-image-left">
                    ${additionalImagesHtml ? `<div class="tooltip-additional-grid-container">${additionalImagesHtml}</div>` : ''}
                </div>`;
        } else {
            htmlContent = '<div class="tooltip-message">No images found.</div>';
        }
        showTooltipImmediately(event, htmlContent);
    };

    const fetchAndDisplayImage = (event, threadUrl) => {
        const linkElement = event.currentTarget;
        cancelHideTooltip();

        if (imageCache.has(threadUrl)) {
            generateAndShowTooltipHtml(event, imageCache.get(threadUrl));
            return;
        }

        imageCache.set(threadUrl, 'loading');
        generateAndShowTooltipHtml(event, 'loading');

        GM_xmlhttpRequest({
            method: "GET",
            url: threadUrl,
            onload: function (response) {
                if (response.status >= 200 && response.status < 300) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, "text/html");
                    const firstPostContent = doc.querySelector(POST_CONTENT_SELECTOR);
                    let foundImageUrls = [];

                    if (firstPostContent) {
                        const allImagesInPost = firstPostContent.querySelectorAll('img');
                        for (const image of allImagesInPost) {
                            const imageUrl = image.src;
                            if (!imageUrl || imageUrl.startsWith('data:')) {
                                continue;
                            }
                            const hasBlacklistedClass = settings.IMAGE_CLASS_BLACKLIST.some(blacklistedClass =>
                                image.classList.contains(blacklistedClass)
                            );
                            if (hasBlacklistedClass) {
                                continue;
                            }
                            const isUrlBlacklisted = compiledUrlRegexBlacklist.some(regex =>
                                regex.test(imageUrl)
                            );
                            if (isUrlBlacklisted) {
                                continue;
                            }
                            if (!foundImageUrls.includes(imageUrl)) {
                                foundImageUrls.push(imageUrl);
                            }
                        }
                    }
                    imageCache.set(threadUrl, foundImageUrls);
                    if (linkElement.matches(':hover') || tooltipElement.matches(':hover')) {
                        generateAndShowTooltipHtml(event, foundImageUrls);
                    }
                } else {
                    console.warn(`Request error for ${threadUrl}: ${response.statusText}`);
                    imageCache.delete(threadUrl);
                    if (linkElement.matches(':hover') || tooltipElement.matches(':hover')) {
                        showTooltipImmediately(event, `<div class="tooltip-message">Loading error (${response.status}).</div>`);
                    }
                }
            },
            onerror: function (response) {
                console.error(`GM_xmlhttpRequest error for ${threadUrl}: ${response.statusText || 'Unknown error'}`);
                imageCache.delete(threadUrl);
                if (linkElement.matches(':hover') || tooltipElement.matches(':hover')) {
                    showTooltipImmediately(event, '<div class="tooltip-message">Network error.</div>');
                }
            }
        });
    };

    const addListenersToLinks = () => {
        const potentialLinksNodeList = document.querySelectorAll(`a[href*="${LINK_SELECTOR_PREFIX.split('=')[0]}="]`); // Broader search ex: showthread.php?tid=
        const potentialLinksArray = Array.from(potentialLinksNodeList);
        const tidValuePattern = /^\d+$/;

        potentialLinksArray
            .filter(link => {
                const { href } = link;
                const indexOfPrefix = href.indexOf(LINK_SELECTOR_PREFIX);
                if (indexOfPrefix === -1) {
                    return false;
                }
                const tidValueString = href.substring(indexOfPrefix + LINK_SELECTOR_PREFIX.length);
                return tidValuePattern.test(tidValueString);
            })
            .forEach(link => {
                if (link.dataset.bdTooltipAttached) {
                    return;
                }
                link.dataset.bdTooltipAttached = 'true';
                link.addEventListener('mouseenter', (event) => { fetchAndDisplayImage(event, link.href); });
                link.addEventListener('mouseleave', requestHideTooltip);
                link.addEventListener('mousemove', (event) => {
                    if (tooltipElement.style.display === 'block' && !tooltipElement.matches(':hover')) {
                        positionTooltip(event);
                    }
                });
            });
    };

    // --- Initialization ---
    loadSettings(); // Load settings and apply configuration (including styles)
    GM_registerMenuCommand("Parameters", openSettingsPage);

    addListenersToLinks();
    const observer = new MutationObserver((mutationsList) => {
        let newLinksFound = false;
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE && (node.matches(`a[href*="${LINK_SELECTOR_PREFIX.split('=')[0]}="]`) || node.querySelector(`a[href*="${LINK_SELECTOR_PREFIX.split('=')[0]}="]`))) {
                        newLinksFound = true;
                    }
                });
            }
        }
        if (newLinksFound) {
            addListenersToLinks();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

})();
