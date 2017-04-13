"use strict";

// const Jose = require("./jose").Jose;
// const JoseJWE = require("./jose").JoseJWE;
// const CRYPTO_KEYS = require("./heatmap_consts").CRYPTO_KEYS;

function uploadData(jsonData) {
  console.log("WARNING: this needs to emit data to the telemetry backend");
}

/* We use our own custom GUID for the user.  It's unrelated to
 * anything other than the specific browser that this addon is
 * installed into.
 */
function getUUID() {
  // TODO: read the UUID from the preferences via messaging bootstrap.js
  let uuid;
  if (uuid === undefined) {
    // Generate a UUID if we don't have a user ID yet and
    // stuff it into prefs
    uuid = makeGUID();
    // TODO: save the GUID into a pref
  }
  return uuid;
}

/* Generate a URL friendly 10 character UUID.
 * This code is lifted out of the sync client code in Firefox.
 */
function makeGUID() {
  // 70 characters that are not-escaped URL-friendly
  const code =
    "!()*-.0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz~";

  let guid = "";
  let num = 0;
  let val;

  // Generate ten 70-value characters for a 70^10 (~61.29-bit) GUID
  for (let i = 0; i < 10; i++) {
    // Refresh the number source after using it a few times
    if (i === 0 || i === 5) {
      num = Math.random();
    }

    // Figure out which code to use for the next GUID character
    num *= 70;
    val = Math.floor(num);
    guid += code[val];
    num -= val;
  }

  return guid;
}
