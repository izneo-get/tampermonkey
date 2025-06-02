// ==UserScript==
// @name         Cover Tooltip
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Affiche la première image d'un thread en tooltip au survol d'un lien de discussion
// @author       Darth Obvious
// @match        https://ebdz.net/forum/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      ebdz.net
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const TOOLTIP_WIDTH = 250; // Largeur fixe de la tooltip en pixels
    const LINK_SELECTOR_PREFIX = 'showthread.php?tid=';
    const POST_CONTENT_SELECTOR = 'div.post_content'; // Sélecteur du contenu du premier post
    const IMAGE_IN_POST_SELECTOR = 'img'; // Sélecteur de la première image dans le post
    const IMAGE_CLASS_BLACKLIST = ['smilie', 'emoji']; // Liste des images à ne pas prendre en compte.

    // Création de la tooltip
    let tooltipElement = document.createElement('div');
    tooltipElement.id = 'cover-tooltip-userscript';
    document.body.appendChild(tooltipElement);

    // Styles pour la tooltip
    GM_addStyle(`
        #cover-tooltip-userscript {
            position: fixed; /* Position par rapport à la fenêtre */
            display: none;
            width: ${TOOLTIP_WIDTH}px;
            border: 1px solid #ccc;
            background-color: #fff;
            box-shadow: 3px 3px 8px rgba(0,0,0,0.3);
            padding: 5px;
            z-index: 99999; /* Assurer que la tooltip est au-dessus des autres éléments */
            overflow: hidden; /* Pour que l'image ne dépasse pas si elle est plus grande que la tooltip */
            pointer-events: none; /* Pour que la tooltip ne capture pas les événements souris */
        }
        #cover-tooltip-userscript img {
            width: 100%;
            height: auto;
            display: block;
        }
        #cover-tooltip-userscript .tooltip-loading,
        #cover-tooltip-userscript .tooltip-no-image {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 50px; /* Hauteur indicative pour les messages */
            font-style: italic;
            color: #555;
        }
    `);

    // Cache pour les URLs d'images
    // Key: URL du thread
    // Value: URL de l'image ou 'not_found' ou 'loading'
    const imageCache = new Map();

    // Fonctions

    function showTooltip(event, contentHtml) {
        tooltipElement.innerHTML = contentHtml;
        positionTooltip(event);
        tooltipElement.style.display = 'block';
    }

    function hideTooltip() {
        tooltipElement.style.display = 'none';
        tooltipElement.innerHTML = ''; // Vider le contenu pour éviter affichage fugace
    }

    function positionTooltip(event) {
        // Décalage pour que la tooltip n'apparaisse pas directement sous le curseur,
        // ce qui pourrait causer du scintillement si elle capture les événements souris (évité avec pointer-events: none)
        let x = event.clientX + 15;
        let y = event.clientY + 15;

        // Ajustement pour que la tooltip ne sorte pas de la fenêtre visible
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const tooltipRect = tooltipElement.getBoundingClientRect(); // Donne les dimensions réelles après injection du contenu

        // Si on n'a pas encore de dimensions (ex: premier affichage), utiliser la largeur configurée
        const currentTooltipWidth = tooltipRect.width > 0 ? tooltipRect.width : TOOLTIP_WIDTH;
        // La hauteur est dynamique, mais on peut prévoir une hauteur max ou gérer au mieux
        const currentTooltipHeight = tooltipRect.height;


        if (x + currentTooltipWidth > viewportWidth - 10) { // 10px de marge
            x = event.clientX - currentTooltipWidth - 15; // Placer à gauche du curseur
             if (x < 10) x = 10; // Eviter de coller au bord gauche
        }

        if (y + currentTooltipHeight > viewportHeight - 10) {
            y = event.clientY - currentTooltipHeight - 15; // Placer au-dessus du curseur
            if (y < 10) y = 10; // Eviter de coller au bord haut
        }

        tooltipElement.style.left = `${x}px`;
        tooltipElement.style.top = `${y}px`;
    }

    function fetchAndDisplayImage(event, threadUrl) {
        const linkElement = event.currentTarget;

        if (imageCache.has(threadUrl)) {
            const cachedData = imageCache.get(threadUrl);
            if (cachedData === 'not_found') {
                showTooltip(event, '<div class="tooltip-no-image">Aucune image trouvée.</div>');
            } else if (cachedData === 'loading') {
                showTooltip(event, '<div class="tooltip-loading">Chargement...</div>');
            } else {
                showTooltip(event, `<img src="${cachedData}" alt="Couverture BD">`);
            }
            return;
        }

        imageCache.set(threadUrl, 'loading');
        showTooltip(event, '<div class="tooltip-loading">Chargement...</div>');

        GM_xmlhttpRequest({
            method: "GET",
            url: threadUrl,
            onload: function(response) {
                if (response.status >= 200 && response.status < 300) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, "text/html");
                    const firstPostContent = doc.querySelector(POST_CONTENT_SELECTOR); // Par ex. 'div.post_content'
                    let imageUrl = null;

                    if (firstPostContent) {
                        const allImagesInPost = firstPostContent.querySelectorAll('img'); // Récupère toutes les images du post

                        for (const image of allImagesInPost) {
                            if (!image.src) continue; // Ignore les images sans attribut src

                            // Vérifie si l'image a une classe de la blacklist
                            const isBlacklisted = IMAGE_CLASS_BLACKLIST.some(blacklistedClass =>
                                                                             image.classList.contains(blacklistedClass)
                                                                            );

                            if (!isBlacklisted) {
                                imageUrl = image.src; // Prend la première image non blacklistée
                                break; // Sort de la boucle dès qu'une image valide est trouvée
                            }
                        }
                    }

                    if (imageUrl) {
                        imageCache.set(threadUrl, imageUrl);
                        if (linkElement.matches(':hover')) {
                            showTooltip(event, `<img src="${imageUrl}" alt="Couverture BD">`);
                        }
                    } else {
                        imageCache.set(threadUrl, 'not_found');
                        if (linkElement.matches(':hover')) {
                            showTooltip(event, '<div class="tooltip-no-image">Aucune image trouvée.</div>');
                        }
                    }
                } else {
                    console.warn(`Erreur de requête pour ${threadUrl}: ${response.statusText}`);
                    imageCache.set(threadUrl, 'not_found');
                    if (linkElement.matches(':hover')) {
                        showTooltip(event, '<div class="tooltip-no-image">Erreur chargement.</div>');
                    }
                }
            },
            onerror: function(response) {
                console.error(`Erreur GM_xmlhttpRequest pour ${threadUrl}: ${response.statusText || 'Erreur inconnue'}`);
                imageCache.set(threadUrl, 'not_found');
                if (linkElement.matches(':hover')) {
                    showTooltip(event, '<div class="tooltip-no-image">Erreur réseau.</div>');
                }
            }
        });
    }


    // Ajout des écouteurs d'événements
    function addListenersToLinks() {
        const potentialLinksNodeList = document.querySelectorAll(`a[href^="${LINK_SELECTOR_PREFIX}"]`);
        const potentialLinksArray = Array.from(potentialLinksNodeList);
        const tidValuePattern = /^\d+$/;

        potentialLinksArray
            .filter(link => {
            const href = link.href;
            const tidValueString = href.substring(href.indexOf(LINK_SELECTOR_PREFIX) + LINK_SELECTOR_PREFIX.length);
            return tidValuePattern.test(tidValueString);
        })
            .forEach(link => {
            // Vérifier si l'écouteur n'a pas déjà été ajouté
            if (link.dataset.bdTooltipAttached) {
                return; // Déjà traité
            }
            link.dataset.bdTooltipAttached = 'true';

            // Ajout de l'écouteur pour le survol de la souris (mouseenter)
            link.addEventListener('mouseenter', (event) => {
                fetchAndDisplayImage(event, link.href); // Affiche la tooltip avec l'image
            });

            // Ajout de l'écouteur pour lorsque la souris quitte le lien (mouseleave)
            link.addEventListener('mouseleave', () => {
                hideTooltip(); // Cache la tooltip
            });

            // Optionnel: Mettre à jour la position de la tooltip si la souris bouge sur le lien
            link.addEventListener('mousemove', (event) => {
                if (tooltipElement.style.display === 'block') { // Si la tooltip est visible
                    positionTooltip(event); // Met à jour sa position
                }
            });
        });
    }

    // Initialisation et observation des changements
    addListenersToLinks();

    // Si le forum charge du contenu dynamiquement (ex: infinite scroll, navigation AJAX)
    const observer = new MutationObserver((mutationsList, observerInstance) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // On vérifie si des liens pertinents ont été ajoutés
                let newLinksFound = false;
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches(`a[href^="${LINK_SELECTOR_PREFIX}"]`)) {
                            newLinksFound = true;
                        } else if (node.querySelector(`a[href^="${LINK_SELECTOR_PREFIX}"]`)) {
                            newLinksFound = true;
                        }
                    }
                });
                if (newLinksFound) {
                    addListenersToLinks(); // Réappliquer les écouteurs
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();
