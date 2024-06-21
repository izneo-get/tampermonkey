// ==UserScript==
// @name         Amazon Invoices Extractor
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Extract PDF invoices from order page
// @author       Darth Obvious
// @match        https://www.amazon.fr/your-orders/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// ==/UserScript==

(function() {
    'use strict';

    // Fonction pour récupérer le "Request Id".
    function getXAmzRid() {
        const pageContent = document.body.innerHTML;
        const match = pageContent.match(/data:\s*{"biaHcbRid":"([^"]+)"}/);

        if (match && match[1]) {
            console.log('Valeur de biaHcbRid:', match[1]);
            return match[1];
        } else {
            console.log('biaHcbRid non trouvé dans la page');
            return null;
        }
    }

    // Fonction pour extraire les infos de commande.
    function extractOrders(rid) {
        const blockElements = document.querySelectorAll('.order-card');
        const orders = Array.from(blockElements).map(element => {
            var order = element.querySelector('.yohtmlc-order-id');
            var spans = order.querySelectorAll('span');
            order = spans.length >= 1 ? spans[spans.length - 1].textContent.trim() : '';
            var title = element.querySelector('.yohtmlc-product-title')
            if (title) {
                title = title.textContent.trim();
            } else {
                title = order;
            }
            var date = element.querySelector('.a-size-base').textContent.trim();
            var link = 'https://www.amazon.fr/gp/shared-cs/ajax/invoice/invoice.html?orderId=' + order + '&relatedRequestId=' + rid + '&isADriveSubscription=0&isBookingOrder=0';
            return {
                order: order,
                title: title,
                date: date,
                link: link
            }
        });
        console.log('Commandes trouvées :', orders);
        return orders;
    }



    function extractPdfLinks(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const links = doc.querySelectorAll('a[href$=".pdf"]');
        return Array.from(links).map(link => link.href);
    }

    function downloadInvoice(order) {
        GM_xmlhttpRequest({
            method: 'GET',
            url:order.link,
            onload: function(response) {
                if (response.status === 200) {
                    var pdfLinks = extractPdfLinks(response.responseText);
                    pdfLinks.forEach((link, index) => {
                        var suffix = '';
                        if (index > 0) {
                            suffix = '_' + (index + 1)
                        }
                        var name = sanitizeFilename(order.title) + ' (' + order.date + ')' + suffix + '.pdf';
                        console.log(name);
                        GM_download({url: link,
                                     name: name,
                                     onload: function() {
                                         console.log('loaded');
                                     },
                                     ontimeout: function(message) {
                                         console.log('timeout ' + message.error);
                                     },
                                     onerror: function(message) {
                                         console.log('error ' + message.error);
                                     }
                                    }
                                     );
                    }
                    );
                } else {
                    console.error("Erreur de requête");
                }
            }
        });
    }

    // Le bouton pour télécharger.
    let button;
    function createDownloadButton() {
        button = document.createElement('button');
        button.textContent = 'Télécharger les factures de cette page';
        button.style.cssText = `
            position: fixed;
            top: 150px;
            left: 10px;
            z-index: 9999;
            padding: 10px 20px;
            background-color: #2663a6;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
        `;

        button.addEventListener('click', onDownloadClick);

        document.body.appendChild(button);
    }

    function onDownloadClick() {
        button.textContent = '... travail en cours ...';
        button.disabled = true;
        orders.forEach((order, index) => {
            downloadInvoice(order);
        });
        button.textContent = 'Télécharger les factures de cette page';
        button.disabled = false;
    }

    function sanitizeFilename(filename) {
        return filename.replace(/[^a-z0-9éèêàâçôöïñ ]/gi, '_');
    }

    var rid = getXAmzRid();
    // Exécuter la fonction après le chargement de la page
    var orders = extractOrders(rid);
    console.log(orders);
    createDownloadButton();
})();
