The heatmap webextension is roughly composed of 2 parts.

* Content Script: which runs within the browser. This mostly controls
  the button within the Firefox button bar and acts as a controller
  for a dropdown menu where users may select options to enable or
  disable for uplift into the Miracle server.
 
  The content script also has access to the DOM document object, so we
  are able to inject nodes into the DOM within the <meta> tag of the
  header to disambiguate what the tab identifier is.

* background-script: This script is the primary event loop. We keep
  track of the current browser state including but not limited to:

        * open windows
        * open tabs per window
        * near complete tab state as defined by tabs.Tab in the
          WebExtension specification
        * tab URL history including visitation time
        * each URL contains a referrer object which maintains state
          of the referring URL, or the source tab if a link was opened
          in a new tab
