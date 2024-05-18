// ==UserScript==
// @name         PSA Rips Skip Ads Timer
// @namespace    http://tampermonkey.net/
// @version      0.6
// @description  Modify TikTok Counter page content
// @author       Darth Obvious
// @match        https://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    var cbtElement = document.getElementById('cbt');
    if (!cbtElement || !cbtElement.getAttribute('onclick').endsWith("formulaSend(event)")) {
        return;
    }

    function resetTimer(varName) {
       window[varName] = 0;
    }

    function getVarName() {
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
            var script = scripts[i];
            if (script.innerHTML.includes('window.wpSiteUrl = "')) {
                var regex = /var (.+) = (\d+);/;
                var match = script.innerHTML.match(regex);
                if (match !== null) {
                    var variableName = match[1];
                    console.log(variableName);
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
            if (typeof isHoverDone !== "undefined") {
                isHoverDone = true;
            }
            if (typeof isTimerCompleted !== "undefined") {
                isTimerCompleted = true;
            }
            if (typeof isAdClickDone !== "undefined") {
                isAdClickDone = true;
            }
            if (typeof isClownClickDone !== "undefined") {
                isClownClickDone = true;
            }
            if (typeof isFirstClickDone !== "undefined") {
                isFirstClickDone = true;
            }
            continueButton.removeAttribute('disabled');
            continueButton.setAttribute('type', 'submit');
            continueButton.click();
            //document.querySelector("#userForm").submit();
        }
    }


    addSkipButton();
    setInterval(autoClickSkipButton, 1000); // 1000 ms = 1 seconde

})();
