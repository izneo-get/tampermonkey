// ==UserScript==
// @name         Cover Tooltip
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Affiche l'image principale à gauche et si besoin une grille d'images additionnelles à droite.
// @author       Darth Obvious
// @match        https://ebdz.net/forum/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      ebdz.net
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // --- Configuration ---
    const MAIN_IMAGE_WIDTH = 250; // Largeur de l'image principale
    const GRID_THUMBNAIL_SIZE = 75; // Largeur d'une vignette dans la grille
    const GRID_THUMBNAIL_HEIGHT = Math.round(GRID_THUMBNAIL_SIZE * (4 / 3)); // Hauteur d'une miniature pour un ratio 4/3 portrait
    const GRID_COLUMNS = 3; // Nombre de colonnes dans la grille
    const GRID_GAP = 4; // Espace entre les vignettes
    const GRID_CONTAINER_MAX_HEIGHT = 330; // Hauteur maximale pour le conteneur de la grille
    const HIDE_TOOLTIP_DELAY = 300; // Délai avant de masquer la tooltip (en ms)

    const LINK_SELECTOR_PREFIX = 'showthread.php?tid='; // Préfixe pour les liens des threads
    const POST_CONTENT_SELECTOR = 'div.post_body';  // Sélecteur pour le contenu du premier post
    const IMAGE_CLASS_BLACKLIST = ['smilie', 'emoji', 'avatar']; // Classes d'images à ignorer
    const URL_REGEX_BLACKLIST = [
        'emule\\.png$',
        '/icones/',
    ]; // Regex pour les URLs d'images à ignorer

    // --- Variables globales ---
    let tooltipElement = document.createElement('div');
    tooltipElement.id = 'cover-tooltip-userscript';
    document.body.appendChild(tooltipElement);
    let hideTooltipTimer = null;

    // --- Dimensions calculées ---
    const gridInternalWidth = (GRID_THUMBNAIL_SIZE * GRID_COLUMNS) + (GRID_GAP * (GRID_COLUMNS - 1));
    const gridContainerWidth = gridInternalWidth + (GRID_GAP * 2);


    // --- Styles ---
    GM_addStyle(`
    #cover-tooltip-userscript {
        position: fixed;
        display: none;
        width: auto;
        max-width: calc(${MAIN_IMAGE_WIDTH}px + ${gridContainerWidth}px + 24px);
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
        width: ${MAIN_IMAGE_WIDTH}px;
        height: auto;
        max-height: ${GRID_CONTAINER_MAX_HEIGHT}px;
        object-fit: contain;
        display: block;
        margin-right: 8px;
        flex-shrink: 0;
    }
    .tooltip-additional-grid-container {
        display: grid;
        grid-template-columns: repeat(${GRID_COLUMNS}, ${GRID_THUMBNAIL_SIZE}px);
        gap: ${GRID_GAP}px;
        padding: ${GRID_GAP}px;
        width: ${gridContainerWidth}px;
        height: auto;
        max-height: ${GRID_CONTAINER_MAX_HEIGHT}px;
        overflow-y: auto;
        overflow-x: hidden;
        border: 1px solid #f0f0f0;
        background-color: #f9f9f9;
    }
    .tooltip-additional-grid-image {
        width: ${GRID_THUMBNAIL_SIZE}px;
        height: ${GRID_THUMBNAIL_HEIGHT}px; 
        object-fit: cover;
        border: 1px solid #ddd;
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
`);

    const imageCache = new Map();
    const compiledUrlRegexBlacklist = URL_REGEX_BLACKLIST.map(pattern => {
        try {
            return new RegExp(pattern, 'i');
        } catch (e) {
            return null;
        }
    }).filter(regex => regex !== null);

    const cancelHideTooltip = () => { clearTimeout(hideTooltipTimer); };
    const requestHideTooltip = () => {
        cancelHideTooltip();
        hideTooltipTimer = setTimeout(() => { tooltipElement.style.display = 'none'; }, HIDE_TOOLTIP_DELAY);
    };

    const showTooltipImmediately = (event, contentHtml) => {
        cancelHideTooltip();
        tooltipElement.innerHTML = contentHtml;
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
            x = Math.max(x, 10)
        }
        if (y + currentTooltipHeight > viewportHeight - 10) {
            y = event.clientY - currentTooltipHeight - 15;
            y = Math.max(y, 10)
        }
        tooltipElement.style.left = `${x}px`;
        tooltipElement.style.top = `${y}px`;
    };

    const generateAndShowTooltipHtml = (event, imageData) => {
        let htmlContent = '';
        cancelHideTooltip();

        if (imageData === 'loading') {
            htmlContent = '<div class="tooltip-loading">Chargement...</div>';
        } else if (Array.isArray(imageData) && imageData.length > 0) {
            const mainImageUrl = imageData[0];
            let additionalImagesHtml = '';
            if (imageData.length > 1) {
                for (let i = 1; i < imageData.length; i++) {
                    additionalImagesHtml += `<img src="${imageData[i]}" alt="Image ${i + 1}" class="tooltip-additional-grid-image">`;
                }
            }
            htmlContent = `
                <div class="tooltip-content-wrapper">
                    <img src="${mainImageUrl}" alt="Couverture principale" class="tooltip-main-image-left">
                    ${imageData.length > 1 ? `<div class="tooltip-additional-grid-container">${additionalImagesHtml}</div>` : ''}
                </div>`;
        } else {
            htmlContent = '<div class="tooltip-message">Aucune image trouvée.</div>';
        }
        showTooltipImmediately(event, htmlContent);
    };

    const fetchAndDisplayImage = (event, threadUrl) => {
        const linkElement = event.currentTarget;
        cancelHideTooltip(); // Annule tout masquage en attente si la souris bouge rapidement

        if (imageCache.has(threadUrl)) {
            // Si la donnée est en cache
            generateAndShowTooltipHtml(event, imageCache.get(threadUrl));
            return;
        }

        // Si pas en cache, initier le chargement
        imageCache.set(threadUrl, 'loading');
        generateAndShowTooltipHtml(event, 'loading'); // Affiche "Chargement..."

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

                            const hasBlacklistedClass = IMAGE_CLASS_BLACKLIST.some(blacklistedClass =>
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

                    // On met à jour la tooltip si elle est visible
                    if (linkElement.matches(':hover') || tooltipElement.matches(':hover')) {
                        generateAndShowTooltipHtml(event, foundImageUrls);
                    }
                } else { // Erreur HTTP
                    console.warn(`Erreur de requête pour ${threadUrl}: ${response.statusText}`);
                    // Retirer l'état 'loading'. La prochaine fois, une nouvelle requête sera tentée.
                    imageCache.delete(threadUrl);

                    if (linkElement.matches(':hover') || tooltipElement.matches(':hover')) {
                        showTooltipImmediately(event, `<div class="tooltip-message">Erreur chargement (${response.status}).</div>`);
                    }
                }
            },
            onerror: function (response) { // Erreur réseau
                console.error(`Erreur GM_xmlhttpRequest pour ${threadUrl}: ${response.statusText || 'Erreur inconnue'}`);
                // Retirer l'état 'loading'. La prochaine fois, une nouvelle requête sera tentée.
                imageCache.delete(threadUrl);

                if (linkElement.matches(':hover') || tooltipElement.matches(':hover')) {
                    showTooltipImmediately(event, '<div class="tooltip-message">Erreur réseau.</div>');
                }
            }
        });
    };

    const addListenersToLinks = () => {
        const potentialLinksNodeList = document.querySelectorAll(`a[href*="${LINK_SELECTOR_PREFIX}"]`);
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

    addListenersToLinks();
    const observer = new MutationObserver((mutationsList) => {
        let newLinksFound = false;
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE && (node.matches(`a[href*="${LINK_SELECTOR_PREFIX}"]`) || node.querySelector(`a[href*="${LINK_SELECTOR_PREFIX}"]`))) {
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
