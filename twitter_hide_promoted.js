// ==UserScript==
// @name         Twitter: hide promoted tweets
// @name:fr      Twitter : masque les tweets sponsorisés
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Hide promoted tweets
// @description:fr  Masque les tweets sponsorisés
// @author       Darth Obvious
// @match       *://twitter.com/*
// @match       *://*.twitter.com/*
// @license MIT
// @grant        none
// ==/UserScript==

let count_hidden = 0;
function hide_promoted(){
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
}


// Création d'une instance de MutationObserver pour observer les changements dans <body>
const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
            // Vérifier si le noeud ajouté est un <div>
            if (node instanceof HTMLDivElement) {
                // Vérifier les enfants du <div> ajouté pour trouver les balises <article>
                const articlesInDiv = node.querySelectorAll('article');
                if (articlesInDiv.length > 0) {
                    hide_promoted();
                }
            }
        });
    });
});

// Configuration de l'observer pour surveiller les changements dans <body>
const observerConfig = { childList: true, subtree: true };
observer.observe(document.body, observerConfig);
