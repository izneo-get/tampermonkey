// ==UserScript==
// @name         Twitter: hide promoted tweets
// @name:fr      Twitter : masque les tweets sponsorisés
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Hide promoted tweets
// @description:fr  Masque les tweets sponsorisés
// @author       Darth Obvious
// @match       *://twitter.com/*
// @match       *://*.twitter.com/*
// @license MIT
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    let count_hidden = 0;
    var i = setInterval(function() {
        // Sélection de tous les éléments <article> non traités
        const unprocessedArticles = document.querySelectorAll('article:not([data-processed])');

        // Parcours de chaque article
        unprocessedArticles.forEach(article => {
            article.setAttribute('data-processed', 'true');
            // Recherche de tous les div descendants de l'article
            const divs = article.querySelectorAll('div');

            // Vérification si au moins un div contient un span avec uniquement le texte "Ad"
            let containsAd = false;
            divs.forEach(div => {
                const spans = div.querySelectorAll('span');
                spans.forEach(span => {
                    if (span.textContent.trim() === 'Ad') {
                        containsAd = true;
                    }
                });
            });

            // Si l'article contient un div avec un span contenant uniquement "Ad" on le masque
            if (containsAd) {
                article.style.display = 'none';
                count_hidden += 1;
                console.log("Promoted tweet hidden (" + count_hidden + ")");
            }
        });
    }, 1000);

})();
