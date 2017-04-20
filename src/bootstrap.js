"use strict";

/* global Components, TelemetryController */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "install|startup|shutdown" }] */

function install(data, reason) {
  console.log(`Install: ${reason}`);
}

function startup({webExtension}, reason) {
  console.log(`Startup: ${reason}`);
  Components.utils.import("resource://gre/modules/TelemetryController.jsm");

  // Start the embedded webextension.
  webExtension.startup().then(api => {
    const {browser} = api;
    browser.runtime.onMessage.addListener(msg => {
      if (msg && msg.type === "contextgraph-heatmap") {
        // When the embedded webextension asks for the legacy data,
        // dump the data which needs to be preserved and send it back to the
        // embedded extension.

        TelemetryController.submitExternalPing("contextgraph-heatmap",
          msg.payload);
      }
    });
    return 0;
  }).catch(e => {
    console.log(e);
  });
}

function shutdown(data, reason) {
  console.log(`Shutdown: ${reason}`);
}

function uninstall(data, reason) {
  console.log(`Uninstall: ${reason}`);
}
