var MESSAGE_PORT;

function logCookie(c) {
    console.log(c);
}

function logError(e) {
    console.error(e);
}

function logTab(tab) {
    console.log("Found: " + tab.url);
}

function getActiveTab() {
    return browser.tabs.query({currentWindow: true, active: true});
}

var PageVisitModel = function(details) {
    /*
     * THe PageVisitModel is initialized from the webNav API using the
     * onBeforeNavigate event.
     */

    this.reset(details);
};

PageVisitModel.prototype = {
    reset: function(details) {
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
    updateDuration: function(tabId, url) {
        // Verify that the tabId and URL still match
        if (tabId != this.tabId && url === this.url) {
            this.lastTimeStamp = Date.now();
        } else {
            throw "tabId or URL didn't match";
        }
    },

    setTitle: function(title) {
        this.title = title;
    },

    // Set the referring site
    setReferrer: function(referringSite) {
        this.referrer = referringSite;
    },

    // This is just a getter function
    duration: function() {
        return this.lastTimeStamp - this.timeStamp;
    },

    emitJSON: function() {
        return {
            duration: this.duration,
            tabId: this.tabId,
            title: this.title,
            url: this.url,
        };
    }
};


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
var BrowserEventListener = function(browserModel) {
    this.browserModel = browserModel;

    this.tabs = this.browserModel.tabs;

    this.tabsOnCreatedListener = (tab) => {
        console.log("tabsOnCreatedListener invoked");
        // create a unique ID based on tabId, windowId and
        // createTime

        var details = {tabId: tab.id, windowId: tab.windowId};
        var event = new TabOnCreatedEvent(details, this.tabs[tabId]);
        event.updatePageVisitModel();
    };


    /* This is probably not useful, as headers are not ready yet.  For
     * that, you need to use onBeforeSendHeaders.
     */
    this.webReqOnBeforeRequest = (details) => {
        // console.log("onBeforeRequest: " + JSON.stringify(details));
    };

    /* This is where the magic happens.  All headers have been set
     * including (hopefully) the referrer
     */
    this.webReqOnBeforeSendHeaders = (details) => {
        var event = WebReqOnBeforeSendHeadersEvent(details, this.tabs[details.tabId]);
        event.updatePageVisitModel();
    };

    /*
     * Invoked when a tab is attached to a window.  Note that this will
     * change the tab's windowId
     */
    this.tabsOnAttachedListener = (tabId, attachInfo) => {
        var newWindowId = attachInfo.newWindowId;
        var newIndex = attachInfo.newPosition;

        var details = {newIndex: newIndex, newWindowId: newWindowId};
        var event = new TabMovedToNewWindowEvent(details, this.tabs[tabId]);
        event.updatePageVisitModel();
    };


    this.tabsOnActivatedListener = (activeInfo) => {
        var tabId = activeInfo.tabId;
        var windowId = activeInfo.windowId;

        var details = {tabId: tabId, windowId: windowId};
        var event = new TabOnActivatedEvent(details, this.tabs[tabId]);
        event.updatePageVisitModel();
    };

    /*
     * Redirects are mostly useful when disambiguating URL shortener links
     */
    this.webReqOnBeforeRedirect = (details) => {
        console.log("onBeforeRedirect: " + JSON.stringify(details));
    };

    /*
     * Note that webReqOnResponseStarted is mostly valuable to prefilter
     * content in subframes.
     */
    this.webReqOnResponseStarted = (details) => {
        // Not sure if want to track sub_frame and media types,
        // var media_types = ["main_frame", "sub_frame", "media"];
        var media_types = ["main_frame"];
        if (media_types.indexOf(details.type) > -1) {
            console.log("onResponseStarted: " + JSON.stringify(details));
        }
    };

    /* This is triggered when different browser *windows* are activated.
     * It's important to track this as the onActivated event handler is
     * not triggered.  We should probably just delegate
     * */
    this.winOnFocusChanges = (windowId) => {
        // TODO: this should probably force heatmap to serialize all
        // data and send it out to the miracle server as firefox is no
        // longer in foreground. Or at least demarcate a gap in the
        // time series data.

        console.log("focusChanged windowId: " + windowId);

        if (windowId === -1) {
            // TODO: send an event into the journal that the browser
            // was switched away from
            console.log("Firefox is backgrounded");
            return;
        }

        var getting = browser.windows.get(windowId, {populate: true, windowTypes: ['normal']});
        getting.then((windowInfo) => {
            console.log("START Logging focus change data");
            for (var tabInfo of windowInfo.tabs) {
                if (tabInfo.selected) {
                    console.log("Activated windowId=["+windowId+"] and tab: " + JSON.stringify(tabInfo));

                    // TODO: send the tabInfo JSON into the journal
                    // serializer
                }
            }
            console.log("FINISHED Logging focus change data");
        }, (error) => { console.log(error); });
    };

    /*
     * This is triggered whenever a DOM is completely loaded. Probably
     * not entirely useful.
     */
    this.webNavOnCompleted = (details) => {
        // TODO: we want to extract the page title
    };

    /*
     * This is triggered at the very start of the navigation. Use this
     * as the start point of the state transition for a tab.
     */
    this.webNavOnBeforeNavigate = (details) => {
        var event = new WebNavOnBeforeNavigateEvent(details, this.tabs[details.tabId]);
        event.updatePageVisitModel();
    };

    /*
     * Fired when the browser is about to start a navigation event.
     * Use this to mark the start of a page view.
     *
     * We also keep track of tabs that are open starting by capturing
     * the tabId
     */
    this.webNavOnCommited = (details) => {
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
};

var BrowserModel = function() {

    // This is a map of tabId -> PageVisitModel objects
    this.tabs = {};

    this._listeners = new BrowserEventListener(this);

    this.getListener = () => {
        return this._listeners;
    };

    /*
     * Dump the attributes of tabs.Tab into a JSON compatible
     * structure.
     *
     * All attribute names are taken from the tabs.Tab specification
     */
    this.updateTabJson = (tab, evtType, createTimeMs) => {
        var tabData = {};
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

/*
 * portConnected is invoked on initial connection of a port from the
 * content script to the background script
 */
function portConnected(p) {
    MESSAGE_PORT = p;
    // TODO: iterate over each tab and getOrSet tab identifiers within
    // the DOM of each tab.

    function getOrSetTabs(tabs) {
        for (var tab of tabs) {
            // Communicate with the DOM of the tab to getOrSet the tabID
            // tab.url requires the `tabs` permission
            // console.log(tab.url);
        }
    }

    function onError(error) {
        console.log(`Error: ${error}`);
    }

    var querying = browser.tabs.query({});
    querying.then(getOrSetTabs, onError);

    MESSAGE_PORT.onMessage.addListener(function(m) {
        console.log("In background script, received message from content script");
        console.log("TabIdentity received: ["+m.url+"]["+m.page_ident+"]");
        /*
         * TODO: run a check against the BrowserModel to make sure that this
         * tabident is registered with the heatmap
         */
    });

    // TODO: Send messages to communicate with a tab by including the tabident in the
    // payload body
    //    MESSAGE_PORT.postMessage({tabident: "background-script-tabident"});

}


function registerListeners(fx) {
    /*
     * We direclty wire in listeners in the BrowserEventListener
     */
    // Listeners that are properly wired up
    var listener = fx.getListener();

    var bBAction = browser.browserAction;
    var bRt = browser.runtime;
    var bTabs = browser.tabs;
    var bWebNav = browser.webNavigation;
    var bWebReq = browser.webRequest;
    var bWin = browser.windows;

    bTabs.onActivated.addListener(listener.tabsOnActivatedListener);
    bTabs.onAttached.addListener(listener.tabsOnAttachedListener);
    bTabs.onCreated.addListener(listener.tabsOnCreatedListener);

    // Now connect the port between the background-script and the
    // content-script
    bRt.onConnect.addListener(portConnected);

    bBAction.onClicked.addListener(function() {
        MESSAGE_PORT.postMessage({greeting: "they clicked the button!"});
    });


    bWebReq.onBeforeSendHeaders.addListener(listener.webReqOnBeforeSendHeaders,
                                            {urls: ["<all_urls>"]},
                                            ["requestHeaders"]);

    /*

    bWebReq.onBeforeRequest.addListener(listener.webReqOnBeforeRequest,
                                        {urls: ["<all_urls>"]});

    bWebReq.onBeforeRedirect.addListener(listener.webReqOnBeforeRedirect ,
                                         {urls: ["<all_urls>"]});

    bWebReq.onResponseStarted.addListener(listener.webReqOnResponseStarted,
                                          {urls: ["<all_urls>"]});

    bWin.onFocusChanged.addListener(listener.winOnFocusChanges);
    */



    var navFilter = {url: [{urlMatches: "^.*$"}]};
    bWebNav.onBeforeNavigate.addListener(listener.webNavOnBeforeNavigate, navFilter);
    bWebNav.onCompleted.addListener(listener.webNavOnCompleted, navFilter);

    //bWebNav.onCommitted.addListener(listener.webNavOnCommited, navFilter);

}


var fx = new BrowserModel();

function main() {
    registerListeners(fx);
}

// Kick off the background script
main();
