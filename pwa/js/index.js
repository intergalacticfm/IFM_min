import * as constants from './constants.js';

export let fetchedStations = [];
export let audioContext;
let appVersion = "";

window.addEventListener('DOMContentLoaded', () => {
    if (!fetchedStations) {
        fetchStations();
    }

    updateScrollingText();
    refreshScrollingTextAnimation();
    // unlock iOS audio context
    if (!audioContext) {
        audioContext = new(window.AudioContext || window.webkitAudioContext)();
    }
    document.addEventListener(constants.DEVICE_READY_EVENT_NAME, onDeviceReady, false);
    /* prevent all pinch-zoom actions */
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('gesturechange', e => e.preventDefault());
    document.addEventListener('gestureend', e => e.preventDefault());

    // page links actions
    document.getElementById(constants.DONATE_LINK_ID).addEventListener(constants.CLICK_EVENT_NAME,
        function () {
            window.location.href = constants.DONATE_URL;
        });

    document.getElementById(constants.WEBSITE_LINK_ID).addEventListener(constants.CLICK_EVENT_NAME,
        function () {
            window.location.href = constants.WEBSITE_URL;
        });

    document.getElementById(constants.ARCHIVE_LINK_ID).addEventListener(constants.CLICK_EVENT_NAME,
        function () {
            window.location.href = constants.ARCHIVE_URL;
        });
});

/*
this function is for using the android plugin, cordova libraries will not be available before this event has triggered
*/
function onDeviceReady() {
    // app version
    if (
        typeof cordova !== "undefined" &&
        cordova.getAppVersion &&
        typeof cordova.getAppVersion.getVersionNumber === "function"
    ) {
        cordova.getAppVersion.getVersionNumber().then(function (version) {
            appVersion = version;
            updateScrollingText();
        });
    }
    if (isAndroidMusicServiceAvailable()) {
        // android
        cordova.plugins.MusicService.start(
            () => console.log("Music service started"),
            (err) => console.error("Failed to start music service:", err)
        );
        // android menu backbutton to behave like the app backbutton
        document.addEventListener("backbutton", (e) => {
            e.preventDefault();
            stopButtonAction();
        }, false);
    }
}

function isAndroidMusicServiceAvailable() {
    return (
        typeof cordova !== "undefined" &&
        cordova.platformId === "android" &&
        cordova.plugins &&
        cordova.plugins.MusicService &&
        typeof cordova.plugins.MusicService.setPlaying === "function"
    );
}


/* requests stations info and stream url from IFM server constants.STATIONS_JSON_URL */
export async function fetchStations() {
    const response = await fetch(constants.STATIONS_JSON_URL).then((response) => {
        if (response.status >= 400 && response.status < 600) {
            var errorMessage = "Unable to load the playlist: " + response.status + " - " +
                response.statusText;
            displayMessage(errorMessage);
        }
        return response;
    });

    const stationsJson = await response.json();
    var cbsInfo = stationsJson.stations[0];
    var dfInfo = stationsJson.stations[1];
    var tdmInfo = stationsJson.stations[2];

    // init stations object shared with audio.js 
    fetchedStations = [
        {
            title: cbsInfo.name,
            src: cbsInfo.url,
            howl: null
                },
        {
            title: dfInfo.name,
            src: dfInfo.url,
            howl: null
                },
        {
            title: tdmInfo.name,
            src: tdmInfo.url,
            howl: null
                    }
                ];

    // playlist loaded successfuly
    displayMessage(constants.SYSTEM_READY_MSG);
}

/* the rolling text right after the ifm logo, set as default in constants.DEFAULT_SCROLLING_TEXT */
export function updateScrollingText(customText) {
    const baseText = customText || constants.DEFAULT_SCROLLING_TEXT;

    const fullText = appVersion ?
        baseText + " - " + appVersion :
        baseText;

    setScrollingText(fullText);
}

export function setScrollingText(textForScrolling) {
    document.getElementsByClassName(constants.IFMX_SCROLL_TEXT_CLASS_NAME)[0].innerHTML = textForScrolling;
}

function refreshScrollingTextAnimation() {
    const el = document.getElementsByClassName(constants.IFMX_SCROLL_TEXT_CLASS_NAME)[0];
    el.style.animation = constants.NONE;
    void el.offsetWidth;
    el.style.animation = constants.EMPTY_VAL;
}

/* set the message displayed after the channels */
export function displayMessage(message) {
    feedHTML(constants.DISPLAY_MESSAGE_BOX_ID, message);
}

/* utility function for changing inner html given an element id */
export function feedHTML(elementId, value) {
    document.getElementById(elementId).innerHTML = value;
}
/* utility function for showing an element in html, used for the "now playing" modal */
export function showElement(element) {
    element.style.display = constants.BLOCK;
}
/* utility function for hiding an element in html, used for the "now playing" modal */
export function hideElement(element) {
    element.style.display = constants.NONE;
}
