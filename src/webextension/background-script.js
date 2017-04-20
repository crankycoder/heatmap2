/* global TabOnCreatedEvent, WebReqOnBeforeSendHeadersEvent */
/* global TabMovedToNewWindowEvent, TabOnActivatedEvent */
/* global WebNavOnBeforeNavigateEvent */

/* global browser */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "MESSAGE_PORT" }] */

/*
 * BrowserModel maintains the state of the running browser engine.
 *
 * We are interested in being able to determine the following
 * attributes of the browser:
 *
 *  - number and identity of open browser windows
 *  - number and identity of open tabs per browser window
 *  - determining which window and which tab is currently active
 *
 * Each (window, tab, window-create-time, tab-create-time) tuple
 * uniquely identifies a tab.  This hash value unique to the lifespan
 * of the tab.  This is to work around the fact that tab-id values and
 * window-id values are reused.
 *
 */
const BrowserEventListener = function(browserModel) {
  this.browserModel = browserModel;

  this.tabs = this.browserModel.tabs;

  this.tabsOnCreatedListener = tab => {
    console.log("tabsOnCreatedListener invoked");
    // create a unique ID based on tabId, windowId and
    // createTime

    let details = {tabId: tab.id, windowId: tab.windowId};
    let event = new TabOnCreatedEvent(details, this.tabs[tab.id]);
    event.updatePageVisitModel();
  };

  /* This is probably not useful, as headers are not ready yet.  For
   * that, you need to use onBeforeSendHeaders.
  this.webReqOnBeforeRequest = details => {
    // console.log("onBeforeRequest: " + JSON.stringify(details));
  };
   */

  /* This is where the magic happens.  All headers have been set
   * including (hopefully) the referrer
   */
  this.webReqOnBeforeSendHeaders = details => {
    let event = WebReqOnBeforeSendHeadersEvent(details, this.tabs[details.tabId]);
    event.updatePageVisitModel();
  };

  /*
   * Invoked when a tab is attached to a window.  Note that this will
   * change the tab's windowId
   */
  this.tabsOnAttachedListener = (tabId, attachInfo) => {
    let newWindowId = attachInfo.newWindowId;
    let newIndex = attachInfo.newPosition;

    let details = {newIndex, newWindowId};
    let event = new TabMovedToNewWindowEvent(details, this.tabs[tabId]);
    event.updatePageVisitModel();
  };

  this.tabsOnActivatedListener = activeInfo => {
    let tabId = activeInfo.tabId;
    let windowId = activeInfo.windowId;

    let details = {tabId, windowId};
    let event = new TabOnActivatedEvent(details, this.tabs[tabId]);
    event.updatePageVisitModel();
  };

  /*
   * Redirects are mostly useful when disambiguating URL shortener links
   */
  this.webReqOnBeforeRedirect = details => {
    console.log(`onBeforeRedirect: ${JSON.stringify(details)}`);
  };

  /*
   * Note that webReqOnResponseStarted is mostly valuable to prefilter
   * content in subframes.
   */
  this.webReqOnResponseStarted = details => {
    // Not sure if want to track sub_frame and media types,
    // var media_types = ["main_frame", "sub_frame", "media"];
    let media_types = ["main_frame"];
    if (media_types.indexOf(details.type) > -1) {
      console.log(`onResponseStarted: ${JSON.stringify(details)}`);
    }
  };

  /* This is triggered when different browser *windows* are activated.
   * It's important to track this as the onActivated event handler is
   * not triggered.  We should probably just delegate
   * */
  this.winOnFocusChanges = windowId => {
    // TODO: this should probably force heatmap to serialize all
    // data and send it out to the miracle server as firefox is no
    // longer in foreground. Or at least demarcate a gap in the
    // time series data.

    console.log(`focusChanged windowId: ${windowId}`);

    if (windowId === -1) {
      // TODO: send an event into the journal that the browser
      // was switched away from
      console.log("Firefox is backgrounded");
      return;
    }

    let getting = browser.windows.get(windowId, {populate: true, windowTypes: ["normal"]});
    getting.then(windowInfo => {
      console.log("START Logging focus change data");
      for (let tabInfo of windowInfo.tabs) {
        if (tabInfo.selected) {
          console.log(`Activated windowId=[${windowId}] and tab: ${JSON.stringify(tabInfo)}`);

          // TODO: send the tabInfo JSON into the journal
          // serializer
        }
      }
      console.log("FINISHED Logging focus change data");
      return 0;
    }).catch(e => {console.log(e);});
  };

  /*
   * This is triggered whenever a DOM is completely loaded. Probably
   * not entirely useful.
   */
  this.webNavOnCompleted = details => {
    // TODO: we want to extract the page title
    console.log(`webNavOnCompleted: ${details}`);
  };

  /*
   * This is triggered at the very start of the navigation. Use this
   * as the start point of the state transition for a tab.
   */
  this.webNavOnBeforeNavigate = details => {
    let event = new WebNavOnBeforeNavigateEvent(details, this.tabs[details.tabId]);
    event.updatePageVisitModel();
  };

  /*
   * Fired when the browser is about to start a navigation event.
   * Use this to mark the start of a page view.
   *
   * We also keep track of tabs that are open starting by capturing
   * the tabId
   *
  this.webNavOnCommited = details => {
    // TODO: Note that this gets called two times sometimes when an
    // a tab is being restored from a cold-start state.  You can
    // detect this by seeing that the same URL is loaded twice in
    // 1) the same (windowId, tabId)
    // 2) the URL is loaded twice within 1000ms
    // 3) the second call will include "transitionQualifiers":["forward_back"] in the details

    // TODO: capture tabId and put a minimal JSON data blob into
    // the tab map and event journal.
    // console.log("webNavOnCommited: " + JSON.stringify(details));
  };
   */
};

const BrowserModel = function() {
  // This is a map of tabId -> PageVisitModel objects
  this.tabs = {};

  this._listeners = new BrowserEventListener(this);

  this.getListener = () => {
    let result = this._listeners;
    return result;
  };

  /*
   * Dump the attributes of tabs.Tab into a JSON compatible
   * structure.
   *
   * All attribute names are taken from the tabs.Tab specification
   */
  this.updateTabJson = (tab, evtType) => {
    let tabData = {};
    tabData.active = tab.active;
    tabData.audible = tab.audible;
    tabData.cookieStoreId = tab.cookieStoreId;
    tabData.favIconUrl = tab.favIconUrl;
    tabData.height = tab.height;
    tabData.highlighted = tab.highlighted;
    tabData.id = tab.id;
    tabData.incognito = tab.incognito;
    tabData.index = tab.index;
    // skip mutedInfo
    tabData.openerTabId = tab.openerTabId;
    tabData.pinned = tab.pinned;
    tabData.selected = tab.selected;
    tabData.sessionId = tab.sessionId;
    tabData.status = tab.status;
    tabData.title = tab.title;
    tabData.url = tab.url;
    tabData.width = tab.width;
    tabData.windowId = tab.windowId;

    tabData.heatmap_evtType = evtType;

    this.tabs.append(tab.id, JSON.stringify(tabData, null, 2));
  };

  this.updateTab = (tab, evtType) => {
    // keep a journal of all tab information by making a copy so
    // that we can serialize to disk
    this.updateTabJson(tab, evtType, null);
  };

  this.addNewTab = (tab, evtType, createTimeMs) => {
    this.updateTabJson(tab, evtType, createTimeMs);
  };

  /*
   * The BrowserModel only changes state using discrete commands.
   *
   * Valid model mutator commands
   *
   * msgClass |       msgCmd    |       msgPayload
   * -----------------------------------------------------------
   * window   |  create         |  {window: 'window-id', 'create_time': time_ms_epoch}
   * window   |  activate       |  {window: 'window-id'}
   * window   |  destroy        |  {window: 'window-id'}
   * window   |  currentActive  |  {window: 'window-id'}

   * tab      |  create         |  {window: 'window-id', tab: 'tab-id', 'create_time': time_ms_epoch}
   * tab      |  activate       |  {window_id, tab: 'tab-id'}
   * tab      |  destroy        |  {window_id, tab: 'tab-id'}
   * tab      |  currentActive  |  {window_id, tab: 'tab-id'}
   * tab      |  urlChange      |  {tab_id, old_url, new_url}
   *
   */

  /* Query commands
   *
   * status   |  tab            |  (tab_hash) -> {create_time, tab_duration, current_session, {tab_data} }
   * status   |  all            |  [{create_time, tab_duration, current_session}, ...]
   *
   */
};

const fx = new BrowserModel();
let MESSAGE_PORT;

/*
function getActiveTab() {
    return browser.tabs.query({currentWindow: true, active: true});
}
*/

/* The PageVisitModel is initialized from the webNav API using the
 * onBeforeNavigate event.
 */
const PageVisitModel = function(details) {
  this.reset(details);
};

PageVisitModel.prototype = {
  reset(details) {
    this.duration = 0;
    this.frameId = details.frameId;
    this.parentFrameId = details.parentFrameId;
    this.processId = details.processId;
    this.tabId = details.tabId;
    this.timeStamp = details.timeStamp;
    this.title = null;
    this.url = details.url;
  },

  // Update the duration of the visit
  updateDuration(tabId, url) {
    // Verify that the tabId and URL still match
    if (tabId !== this.tabId && url === this.url) {
      this.lastTimeStamp = Date.now();
    } else {
      throw new Error("tabId or URL didn't match");
    }
  },

  setTitle(title) {
    this.title = title;
  },

  // Set the referring site
  setReferrer(referringSite) {
    this.referrer = referringSite;
  },

  // This is just a getter function
  duration() {
    return this.lastTimeStamp - this.timeStamp;
  },

  emitJSON() {
    return {
      duration: this.duration,
      tabId: this.tabId,
      title: this.title,
      url: this.url
    };
  }
};

/*
 * portConnected is invoked on initial connection of a port from the
 * content script to the background script
 */
function portConnected(p) {
  MESSAGE_PORT = p;
  // TODO: iterate over each tab and getOrSet tab identifiers within
  // the DOM of each tab.

  function getOrSetTabs(tabs) {
    for (let tab of tabs) {
      // Communicate with the DOM of the tab to getOrSet the tabID
      // tab.url requires the `tabs` permission
      // TODO: this is probably not needed
      console.log(tab.url);
    }
  }

  function onError(error) {
    console.log(`Error: ${error}`);
  }

  let querying = browser.tabs.query({});
  querying.then(getOrSetTabs).catch(onError);

  MESSAGE_PORT.onMessage.addListener(m => {
    console.log("In background script, received message from content script");
    console.log(`TabIdentity received: [${m.url}][${m.page_ident}]`);

    /* TODO: run a check against the BrowserModel to make sure that this
     * tabident is registered with the heatmap
     */
  });

  // TODO: Send messages to communicate with a tab by including the tabident in the
  // payload body
  //    MESSAGE_PORT.postMessage({tabident: "background-script-tabident"});
}

/* We directly wire in listeners in the BrowserEventListener
 */
function registerListeners(fx) {
  console.log("Registering listeners");
  let listener = fx.getListener();

  let bRt = browser.runtime;
  let bTabs = browser.tabs;
  let bWebNav = browser.webNavigation;
  let bWebReq = browser.webRequest;
  // let bWin = browser.windows;

  bTabs.onActivated.addListener(listener.tabsOnActivatedListener);
  bTabs.onAttached.addListener(listener.tabsOnAttachedListener);
  bTabs.onCreated.addListener(listener.tabsOnCreatedListener);

  console.log("Completed registering bTabs");

  // Now connect the port between the background-script and the
  // content-script
  bRt.onConnect.addListener(portConnected);
  console.log("Completed registering bRt");

  bWebReq.onBeforeSendHeaders.addListener(listener.webReqOnBeforeSendHeaders,
    {urls: ["<all_urls>"]},
    ["requestHeaders"]);
  console.log("Completed registering bWebReq");

  /*

    bWebReq.onBeforeRequest.addListener(listener.webReqOnBeforeRequest,
                                        {urls: ["<all_urls>"]});

    bWebReq.onBeforeRedirect.addListener(listener.webReqOnBeforeRedirect ,
                                         {urls: ["<all_urls>"]});

    bWebReq.onResponseStarted.addListener(listener.webReqOnResponseStarted,
                                          {urls: ["<all_urls>"]});

    bWin.onFocusChanged.addListener(listener.winOnFocusChanges);
    */

  let navFilter = {url: [{urlMatches: "^.*$"}]};
  bWebNav.onBeforeNavigate.addListener(listener.webNavOnBeforeNavigate, navFilter);
  console.log("Completed registering bWebNav:onBefore");
  bWebNav.onCompleted.addListener(listener.webNavOnCompleted, navFilter);
  console.log("Completed registering bWebNav:onCompleted");
  console.log("Completed registering bWebNav");

  // bWebNav.onCommitted.addListener(listener.webNavOnCommited, navFilter);

  console.log("Completed registering listeners");
}

function main() {
  registerListeners(fx);
}

// Kick off the background script
main();
