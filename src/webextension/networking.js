"use strict";

/* global XMLHttpRequest, $  */

var Jose = require("./jose").Jose;
var JoseJWE = require("./jose").JoseJWE;

const CRYPTO_KEYS = require("./heatmap_consts").CRYPTO_KEYS;


function uploadData(jsonData) {
    try {

        var ROOT_URL = "https://miracle.services.mozilla.com/v2";
        var UPLOAD_URL = ROOT_URL + "/upload";
        var DELETE_URL = ROOT_URL + "/delete";

        var xhr = new XMLHttpRequest();
        // open asynchronously
        xhr.open('POST', UPLOAD_URL, true);

        xhr.onreadystatechange = function() {//Call a function when the state changes.
            if (xhr.readyState == XMLHttpRequest.DONE) {
                console.log("XHR Status: " + xhr.status);
            }
        };

        // Set the JSON header
        xhr.setRequestHeader('content-type', 'application/json');

        // send
        xhr.send(jsonData);
    } catch(e) {
        console.warn('could not send POST request. reason %s', e.toString());
    }
}

function getUUID() {
    /*
     * We use our own custom GUID for the user.  It's unrelated to
     * anything other than the specific browser that this addon is
     * installed into.
     */

    // TODO: read the UUID from the preferences
    var uuid;
    if (uuid === undefined) {
        // Generate a UUID if we don't have a user ID yet and
        // stuff it into prefs
        uuid = makeGUID();
        // TODO: save the GUID into a pref
    }
    return uuid;
}

function makeGUID() {
    /*
     * Generate a URL friendly 10 character UUID.
     * This code is lifted out of the sync client code in Firefox.
     */
    // 70 characters that are not-escaped URL-friendly
    const code =
        "!()*-.0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz~";

    let guid = "";
    let num = 0;
    let val;

    // Generate ten 70-value characters for a 70^10 (~61.29-bit) GUID
    for (let i = 0; i < 10; i++) {
        // Refresh the number source after using it a few times
        if (i === 0 || i === 5)
            num = Math.random();

        // Figure out which code to use for the next GUID character
        num *= 70;
        val = Math.floor(num);
        guid += code[val];
        num -= val;
    }

    return guid;
}
