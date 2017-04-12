/*
 *
 * Each event must inherit the BaseEvent.prototype to get the emitJSON
 * method and BaseEvent constructor.
 *
 * Each event must accept a dictionary of event specific data and the
 * old page model object in the constructor.
 *
 * Each event must implement an updatePageVisitModel method with
 * accepts no arguments as the old page model would have been passed
 * in via the constructor. The method must not mutate the old page
 * model, but must create a new instance.
 */

function BaseEvent(eventDetails, oldPageModel) {
    this.eventDetails = eventDetails;

    if (this.eventDetails && this.eventDetails.url && this.eventDetails.url.startsWith('wyciwyg:')) {
        this.eventDetails.url = this.eventDetails.url.replace('^wyciwyg:\/\/\d+\/', '');
    }

    this.oldPageModel = oldPageModel;

    if (this.oldPageModel === null) {
        this.oldPageModel = new PageVisitModel(this.eventDetails);
    }
}

BaseEvent.prototype = {
};

function WebNavOnBeforeNavigateEvent(details, oldPageModel) {
    BaseEvent.call(this, details, oldPageModel);

    // Each event must expose a tabId attribute
    this.tabId = this.eventDetails.tabId;

    this.url = this.eventDetails.url;

    this.processId = this.eventDetails.processId;
    this.frameId = this.eventDetails.frameId;
    this.parentFrameId = this.eventDetails.parentFrameId;
    this.timeStamp = this.eventDetails.timeStamp;
}

WebNavOnBeforeNavigateEvent.prototype = Object.create(BaseEvent.prototype, {
    updatePageVisitModel: function() {
        var result = null;
        if (this.url != this.oldPageModel.url) {
            // Serialize the old model with the duration and clobber
            // the model
            this.oldPageModel.duration = this.timeStamp - this.oldPageModel.timeStamp;
            result = this.oldPageModel.emitJSON();

            // Now reset the tab data with this new link data
            this.oldPageModel.reset(this.eventDetails);
        }
        return result;
    }
});

var TabMovedToNewWindowEvent = function(details, oldPageModel) {
    BaseEvent.call(this, details, oldPageModel);

    this.newTabIndex = this.eventDetails.newTabIndex;
    this.newWindowId = this.eventDetails.newWindowId;
};

TabMovedToNewWindowEvent.prototype = Object.create(BaseEvent.prototype, {
    updatePageVisitModel: function() {
        this.oldPageModel.windowId = this.newWindowId;
        this.oldPageModel.tabIndex = this.newTabIndex;
        return null;
    }
});

var TabOnActivatedEvent = function(details, oldPageModel) {
    BaseEvent.call(this, details, oldPageModel);

    this.tabId = this.eventDetails.tabId;
    this.windowId = this.eventDetails.windowId;
};

TabOnActivatedEvent.prototype = Object.create(BaseEvent.prototype, {
    updatePageVisitModel: function() {
        /*
         * Not quite sure we have a sensible way of keeping track of
         * this.
         *
         * The miracle dataset is only concerned with dwell time, not
         * on actual foreground tab time.
         */
        return null;
    }
});

var TabOnCreatedEvent = function(details, oldPageModel) {
    BaseEvent.call(this, details, oldPageModel);

    this.tabId = this.eventDetails.tabId;
    this.windowId = this.eventDetails.windowId;
};

TabOnCreatedEvent.prototype = Object.create(BaseEvent.prototype, {
    updatePageVisitModel: function() {
        /*
         * We probably don't care about new tab creation very much as
         * it's not necessarily related to web navigation.  Maybe it's
         * interesting if the user has activity stream installed
         * though?
         */
        return null;
    }
});

var WebReqOnBeforeSendHeadersEvent = function(details, oldPageModel) {
    BaseEvent.call(this, details, oldPageModel);

    // We only care about the referrer header
    var headers = details.requestHeaders;
    for (var header of headers) {
        if (header.name === "referer") {
            var oldData = this.tabs.get(details.tabId);
            var newData = JSON.parse(JSON.stringify(oldData));
            this.referrer = header.value;
            break;
        }
    }
};

WebReqOnBeforeSendHeadersEvent.prototype = Object.create(BaseEvent.prototype, {
    updatePageVisitModel: function() {
        this.oldPageModel.referrer = this.referrer;
        return null;
    }
});
