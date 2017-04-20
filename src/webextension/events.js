// Is there a better way to introduce this variable into scope?
// The background-script.js file has PageVisit model, but the files are only
// merged together in this background/scripts target in manifest.json.
//
// Or is this why we have webpack?

/* globals PageVisitModel */

/*
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

  if (this.eventDetails && this.eventDetails.url && this.eventDetails.url.startsWith("wyciwyg:")) {
    this.eventDetails.url = this.eventDetails.url.replace(/^wyciwyg:\/\/\d+/i, "");
  }

  this.oldPageModel = oldPageModel;

  if (this.oldPageModel === null) {
    this.oldPageModel = new PageVisitModel(this.eventDetails);
  }
}

BaseEvent.prototype = {};

function WebNavOnBeforeNavigateEvent(details, oldPageModel) {
  // Invoke the constructor of BaseEvent
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
  updatePageVisitModel() {
    let result = null;
    if (this.url !== this.oldPageModel.url) {
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

const TabMovedToNewWindowEvent = function(details, oldPageModel) {
  BaseEvent.call(this, details, oldPageModel);

  this.newTabIndex = this.eventDetails.newTabIndex;
  this.newWindowId = this.eventDetails.newWindowId;
};

TabMovedToNewWindowEvent.prototype = Object.create(BaseEvent.prototype, {
  updatePageVisitModel() {
    this.oldPageModel.windowId = this.newWindowId;
    this.oldPageModel.tabIndex = this.newTabIndex;
    return null;
  }
});

const TabOnActivatedEvent = function(details, oldPageModel) {
  BaseEvent.call(this, details, oldPageModel);

  this.tabId = this.eventDetails.tabId;
  this.windowId = this.eventDetails.windowId;
};

TabOnActivatedEvent.prototype = Object.create(BaseEvent.prototype, {
  updatePageVisitModel() {
    // Not quite sure we have a sensible way of keeping track of
    // this.
    // The miracle dataset is only concerned with dwell time, not
    // on actual foreground tab time.
    return null;
  }
});

const TabOnCreatedEvent = function(details, oldPageModel) {
  BaseEvent.call(this, details, oldPageModel);

  this.tabId = this.eventDetails.tabId;
  this.windowId = this.eventDetails.windowId;
};

TabOnCreatedEvent.prototype = Object.create(BaseEvent.prototype, {
  updatePageVisitModel() {
     // We probably don't care about new tab creation very much as
     // it's not necessarily related to web navigation.  Maybe it's
     // interesting if the user has activity stream installed
     // though?
    return null;
  }
});

const TabOnRemoveEvent = function(details, oldPageModel) {
  BaseEvent.call(this, details, oldPageModel);

  this.tabId = this.eventDetails.tabId;
  this.windowId = this.eventDetails.windowId;
};

TabOnRemoveEvent.prototype = Object.create(BaseEvent.prototype, {
  updatePageVisitModel() {
    console.log("TODO: Need to determine what to do with a tab close event");
    return null;
  }
});

const WebReqOnBeforeSendHeadersEvent = function(details, oldPageModel) {
  BaseEvent.call(this, details, oldPageModel);

  // We only care about the referrer header
  let headers = details.requestHeaders;
  for (let header of headers) {
    if (header.name === "referer") {
      this.referrer = header.value;
      break;
    }
  }
};

WebReqOnBeforeSendHeadersEvent.prototype = Object.create(BaseEvent.prototype, {
  updatePageVisitModel() {
    this.oldPageModel.referrer = this.referrer;
    return null;
  }
});
