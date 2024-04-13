// ==UserScript==
// @name         TikTok Counter Skip Timer
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  Modify TikTok Counter page content
// @author       Darth Obvious
// @match        https://tiktokcounter.net/travel/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function resetTimer(varName) {
       window[varName] = 0;
    }

    function getVarName() {
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
            var script = scripts[i];
            if (script.innerHTML.includes('window.wpSiteUrl = "https://tiktokcounter.net/travel";')) {
                var regex = /var (.+) = (\d+);/;
                var match = script.innerHTML.match(regex);
                if (match !== null) {
                    var variableName = match[1];
                    return variableName;
                }
            }
        }
        return "";
    }

    // Add a "SKIP" button
    function addSkipButton() {
        var skipButton = document.createElement('button');
        skipButton.id = 'skipButton';
        skipButton.textContent = 'SKIP';
        skipButton.style.position = 'fixed';
        skipButton.style.top = '10px';
        skipButton.style.left = '10px';
        skipButton.style.zIndex = '9999';

        skipButton.addEventListener('click', function() {
            var varName = getVarName();
            if (varName.length > 0) {
                resetTimer(varName);
            }
        });
        document.body.appendChild(skipButton);
    }


    function autoClickSkipButton() {
        var skipButton = document.getElementById('skipButton');
        if (skipButton) {
            skipButton.click();
        }

        var continueButton = document.getElementById('cbt');
        if (continueButton) {
            isHoverDone = true;
            isTimerCompleted = true;
            isAdClickDone = true;
            isFirstClickDone = true;
            continueButton.removeAttribute('disabled');
            continueButton.setAttribute('type', 'submit');
            continueButton.click();
        }
    }

    addSkipButton();
    setInterval(autoClickSkipButton, 1000); // 1000 ms = 1 seconde

})();
