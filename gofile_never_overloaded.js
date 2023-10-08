// ==UserScript==
// @name        Gofile.io never overloaded
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Les fichiers Gofile ne sont jamais en "overloaded".
// @author      Darth Obvious
// @match        https://gofile.io/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    var originalFetch = window.fetch;
    // Intercepte tous les fetch
    window.fetch = function(input, init) {
        return originalFetch.apply(this, arguments).then(function(response) {
            // Teste si c'est l'appel à l'API qui retourne le contenu
            if (response.headers.get('content-type') &&
                response.headers.get('content-type').includes('json') &&
                response.url.match(/https:\/\/api.gofile.io\/getContent/)) {
                return response.text().then(function(text) {
                    // Modifie la réponse
                    var modifiedContent = removeOverloaded(text);
                    // Créez une nouvelle réponse avec le texte modifié.
                    var modifiedResponse = new Response(JSON.stringify(modifiedContent, null, 2), {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers
                    });
                    return modifiedResponse;
                });
            }
            return response;
        });
    };

    function removeOverloaded(json) {
        if (typeof json === 'string') {
            json = JSON.parse(json);
        }
        if (typeof json.data.contents == 'undefined') {
            return json;
        }
        // Vérifie tous les items
        for (var key in json.data.contents) {
            if (json.data.contents[key].hasOwnProperty("overloaded")) {
                delete json.data.contents[key].overloaded;
                json.data.contents[key].name += " (merci Darth Obvious !)";
            }
        }
        return json;
    }
})();
