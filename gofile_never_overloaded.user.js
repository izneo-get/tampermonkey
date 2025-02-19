// ==UserScript==
// @name        Gofile.io never overloaded
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Les fichiers Gofile ne sont jamais en "overloaded" ni en "cold storage".
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
            if (response.headers.get('content-type') &&
                response.headers.get('content-type').includes('json') &&
                response.url.match(/https:\/\/api.gofile.io\/contents/)) {
                return response.text().then(function(text) {
                    // Get links
                    const links = extractLink(text);
                    setTimeout(addOriginalLinks, 1000, links);
                    // Modifie la réponse
                    var modifiedContent = removeIsFrozen(text);
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

    function removeIsFrozen(json) {
        if (typeof json === 'string') {
            json = JSON.parse(json);
        }
        if (json.data && json.data.children) {
            Object.values(json.data.children).forEach(child => {
                if (child.hasOwnProperty("isFrozen")) {
                    delete child.isFrozen;
                    delete child.isFrozenTimestamp;
                    child.name += " (merci Darth Obvious !)";
                }
            });
        }
        return json;
    }

    function extractLink(json) {
        const pairs = [];
        if (typeof json === 'string') {
            json = JSON.parse(json);
        }
        if (json.data && json.data.children) {
            const children = json.data.children;
            for (const childKey in children) {
                if (children.hasOwnProperty(childKey)) {
                    const child = children[childKey];
                    pairs.push({
                        id: child.id,
                        link: child.link
                    });
                }
            }
        }
        return pairs;
    }

    function getLinkById(id, links) {
        const pair = links.find(pair => pair.id === id);
        return pair ? pair.link : undefined;
    }

    function addOriginalLinks(links) {
        const targetDivs = document.querySelectorAll('div[data-item-id]');
        // Itérer sur chaque div trouvé
        targetDivs.forEach(div => {
            const itemId = div.getAttribute('data-item-id');
            const link = getLinkById(itemId, links);
            if (link) {
                const newDiv = document.createElement('div');
                newDiv.innerHTML = '<a href="' + link + '" rel="noopener noreferrer" target="_blank">' + link + '</a>';
                div.appendChild(newDiv);
            }
        });
    }

})();
