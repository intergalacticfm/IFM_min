import * as constants from './constants.js';
import {
    feedHTML,
    showElement,
    hideElement,
    displayMessage,
    fetchedStations,
    setScrollingText,
    fetchStations,
    audioContext,
    updateScrollingText
} from './index.js';

var currentNowPlayingUrl;
var nowPlayingRequestTimer;
var selectedChannel;
var stations;
var previousTrackHash = constants.EMPTY_VAL;
var previousExtractedCoverHTML = constants.EMPTY_VAL;
var AUDIO_PLAYER;

const channelButtons = [
    document.getElementById(constants.CBS_BUTTON_ID),
    document.getElementById(constants.DF_BUTTON_ID),
    document.getElementById(constants.TDM_BUTTON_ID)
];

window.addEventListener('DOMContentLoaded', () => {
    // bind the channel buttons to the playChannel function
    document.getElementById(constants.CBS_BUTTON_ID).addEventListener(constants.CLICK_EVENT_NAME, function () {
        document.getElementById(constants.CBS_BUTTON_ID).classList.add(constants.IS_DISABLED_CSS_CLASS);
        playChannel(0);
    });
    document.getElementById(constants.DF_BUTTON_ID).addEventListener(constants.CLICK_EVENT_NAME, function () {
        document.getElementById(constants.DF_BUTTON_ID).classList.add(constants.IS_DISABLED_CSS_CLASS);
        playChannel(1);
    });
    document.getElementById(constants.TDM_BUTTON_ID).addEventListener(constants.CLICK_EVENT_NAME, function () {
        document.getElementById(constants.TDM_BUTTON_ID).classList.add(constants.IS_DISABLED_CSS_CLASS);
        playChannel(2);
    });

    // bind the stop button to stop music from playing
    document.getElementById(constants.STOP_BUTTON_ID).addEventListener(constants.CLICK_EVENT_NAME, function () {
        stop();
        reset();
    });
    AUDIO_PLAYER = document.getElementById('player');
    if (isTouchDevice()) {
        channelButtons.forEach(btn => {
            // prevents involountary selection
            btn.style.userSelect = 'none';
            btn.style.webkitUserSelect = 'none';
            btn.style.msUserSelect = 'none';
            btn.style.MozUserSelect = 'none';

        });
    }
});

// stop the audio player
export function stop() {
    if (AUDIO_PLAYER) {
        AUDIO_PLAYER.src = '';
        if (typeof isAndroidMusicServiceAvailable === 'function' && isAndroidMusicServiceAvailable()) {
            cordova.plugins.MusicService.setPlaying(false);
        }
    }
}

function isAndroidMusicServiceAvailable() {
    return typeof cordova !== 'undefined' &&
        cordova.plugins &&
        cordova.plugins.MusicService;
}

function isTouchDevice() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
}

function disableChannelButtons() {
    channelButtons.forEach(b => b.disabled = true);
}

function enableChannelButtons() {
    channelButtons.forEach(b => b.disabled = false);
}

// plays the channel stream url
export async function playChannel(channelNumber) {

    disableChannelButtons();

    var channelTitle = 'Unknown';
    if (!fetchedStations || fetchedStations.length === 0) {
        await fetchStations();
    }
    const station = fetchedStations[channelNumber];
    if (!station || !station.src) {
        displayMessage('Station not available');
        return;
    }
    channelTitle = fetchedStations[channelNumber].title;
    try {
        selectedChannel = channelNumber;
        AUDIO_PLAYER.src = fetchedStations[channelNumber].src;
        AUDIO_PLAYER.load();
        audioContext.resume().then(() => {
            AUDIO_PLAYER.play();
        });
        setLockscreenTrackCommands();
        addAudioEventListeners(AUDIO_PLAYER);
        clearTimeout(nowPlayingRequestTimer);
        previousExtractedCoverHTML = constants.EMPTY_VAL;

        displayMessage(constants.LOADING_MSG + channelTitle + "...");
        currentNowPlayingUrl = constants.NOW_PLAYING_REQUEST_PREFIX + channelTitle;

        getNowPlaying();
    } catch (error) {
        var errorMessage = "Error while loading " + channelTitle + ": " + error;
        console.log(errorMessage);
        reset();
        displayMessage(errorMessage);
    } finally {
        enableChannelButtons();
    }
}

// iOS and browsers receive event listeners from media session object, not Android
function addAudioEventListeners(audioPlayer) {
    if (constants.MEDIASESSION_NAME in navigator) {
        audioPlayer.addEventListener(constants.PLAY_ACTION_NAME, () => {
            navigator.mediaSession.playbackState = 'playing';
        });
        audioPlayer.addEventListener(constants.PAUSE_ACTION_NAME, () => {
            navigator.mediaSession.playbackState = 'paused';
        });

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                if (navigator.mediaSession.playbackState === "playing") {
                    // no action needed
                }
            }
        });
    }
}

// request now playing from IFM server every constants.NOW_PLAYING_REQUEST_TIMEOUT_MSEC
async function getNowPlaying() {
    var trackMetadata;
    try {
        var response = await fetch(currentNowPlayingUrl);
        if (!response.ok) {
            trackMetadata = setDefaultNowPlayingInfo();
        } else {
            trackMetadata = await response.json();
            if (!trackMetadata || typeof trackMetadata.title !== 'string') {
                trackMetadata = setDefaultNowPlayingInfo();
            } else {
                trackMetadata.title = fixEncoding(trackMetadata.title);
                if (!trackMetadata.image_file) {
                    trackMetadata.image_file = constants.DEFAULT_IMAGE_NOT_FOUND;
                }
            }
        }
    } catch (error) {
        console.warn("NowPlaying API error:", error);
        trackMetadata = setDefaultNowPlayingInfo();
    }

    var metaDataHash = trackMetadata.title + trackMetadata.image_file;
    if (previousTrackHash !== metaDataHash) {
        setTrackMetadata(trackMetadata);
        previousTrackHash = metaDataHash;
        feedNowPlaying(trackMetadata);
    }

    nowPlayingRequestTimer = setTimeout(getNowPlaying, constants.NOW_PLAYING_REQUEST_TIMEOUT_MSEC);
}

// force UTF-8 decoding
function fixEncoding(str) {
    try {
        return decodeURIComponent(escape(str));
    } catch (e) {
        return str;
    }
}

// default info if API fails
function setDefaultNowPlayingInfo() {
    return {
        title: "No info received from Mothership.",
        image_file: constants.DEFAULT_IMAGE_NOT_FOUND
    };
}

// object for current track metadata
var nowPlayingMetadatas = {
    artist: "",
    title: "",
    album: "",
    label: "",
    year: "",
    country: "",
    ifmxLog: "",
    artwork_url: ""
};

// safely sets track metadata
function setTrackMetadata(trackMetadata) {
    if (!trackMetadata || typeof trackMetadata.title !== "string") return;
    var rawTitle = trackMetadata.title || constants.EMPTY_VAL;
    var trackMetadatas = rawTitle.split(constants.METADATA_SPLIT_CHAR);
    var mainPart = trackMetadatas[0] || constants.EMPTY_VAL;
    var splitString = constants.ARTIST_TITLE_SPLIT_STRING || ' - ';

    var artist = mainPart || '';
    var title = '';

    if (mainPart && mainPart.indexOf(splitString) >= 0) {
        var parts = mainPart.split(splitString);
        if (parts.length >= 2) {
            artist = parts[0].trim();
            title = parts[1].trim();
        }
    }
    nowPlayingMetadatas.artist = artist;
    nowPlayingMetadatas.title = title;
    nowPlayingMetadatas.album = trackMetadatas[1] ? trackMetadatas[1].trim() : '';
    nowPlayingMetadatas.label = trackMetadatas[2] ? trackMetadatas[2].trim() : '';
    nowPlayingMetadatas.year = trackMetadatas[3] ? trackMetadatas[3].trim() : '';
    nowPlayingMetadatas.country = trackMetadatas[4] ? trackMetadatas[4].trim() : '';
    nowPlayingMetadatas.artwork_url = trackMetadata.image_file || constants.DEFAULT_IMAGE_NOT_FOUND;

    var ifmxLog = trackMetadatas[5] ? trackMetadatas[5].trim() : constants.DEFAULT_SCROLLING_TEXT || '';
    setScrollingText(ifmxLog);

    var coverPath = constants.DEFAULT_IMAGE_NOT_FOUND;
    if (constants.COVER_PATH_ARRAY && constants.COVER_PATH_ARRAY[selectedChannel]) {
        coverPath = constants.COVER_PATH_ARRAY[selectedChannel];
    }

    if (constants.MEDIASESSION_NAME in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: title,
            artist: artist,
            album: nowPlayingMetadatas.album,
            artwork: [{
                src: coverPath
            }]
        });
    }

    if (typeof isAndroidMusicServiceAvailable === 'function' &&
        isAndroidMusicServiceAvailable() &&
        typeof cordova !== 'undefined' &&
        cordova.plugins &&
        cordova.plugins.MusicService) {
        cordova.plugins.MusicService.updateMetadata(
            nowPlayingMetadatas.title,
            nowPlayingMetadatas.artist,
            nowPlayingMetadatas.album,
            coverPath
        );
        cordova.plugins.MusicService.setPlaying(true);
    }
}

function setLockscreenTrackCommands() {
    if (constants.MEDIASESSION_NAME in navigator) {
        var previousIndex = selectedChannel === 0 ? 2 : (selectedChannel - 1);
        var nextIndex = selectedChannel === 2 ? 0 : (selectedChannel + 1);

        if (selectedChannel === 0) {
            navigator.mediaSession.setActionHandler(constants.PREVIOUS_TRACK_ACTION_NAME, null);
            navigator.mediaSession.setActionHandler(constants.NEXT_TRACK_ACTION_NAME, () => playChannel(nextIndex));
        } else if (selectedChannel === 1) {
            navigator.mediaSession.setActionHandler(constants.PREVIOUS_TRACK_ACTION_NAME, () => playChannel(previousIndex));
            navigator.mediaSession.setActionHandler(constants.NEXT_TRACK_ACTION_NAME, () => playChannel(nextIndex));
        } else if (selectedChannel === 2) {
            navigator.mediaSession.setActionHandler(constants.NEXT_TRACK_ACTION_NAME, null);
            navigator.mediaSession.setActionHandler(constants.PREVIOUS_TRACK_ACTION_NAME, () => playChannel(previousIndex));
        }
    }
}

export function feedNowPlaying(nowPlayingMetadata) {
    var meta = nowPlayingMetadata || {};
    var main = (nowPlayingMetadatas.artist || '') + constants.ARTIST_TITLE_SPLIT_STRING + (nowPlayingMetadatas.title || '');
    var otherInfo = (nowPlayingMetadatas.album || '') +
        (nowPlayingMetadatas.label ? constants.ARTIST_TITLE_SPLIT_STRING + nowPlayingMetadatas.label : '') +
        (nowPlayingMetadatas.year ? constants.LINE_BREAK + nowPlayingMetadatas.year : '') +
        (nowPlayingMetadatas.country ? ", " + nowPlayingMetadatas.country : '');

    feedHTML(constants.NOW_PLAYING_DIV_ID, main);
    feedHTML(constants.NOW_PLAYING_DIV_EXT_ID, otherInfo);
    feedHTML(constants.NOW_PLAYING_COVER_DIV_ID, getCoverHTMLfromUrl(meta.image_file || constants.DEFAULT_IMAGE_NOT_FOUND));

    var modal = document.getElementById(constants.TRACK_INFO_MODAL_ID);
    var homeContainer = document.getElementById(constants.CONTAINER_ID);
    var stopButton = document.getElementsByClassName(constants.CLOSE)[0];

    if (homeContainer) hideElement(homeContainer);
    if (modal) showElement(modal);
    if (stopButton) showElement(stopButton);
}

function stopButtonAction() {
    stop();
    reset();
}

function getCoverHTMLfromUrl(image_url) {
    return `<img src="${image_url}" style="width:90%" onerror="this.src='${constants.DEFAULT_IMAGE_NOT_FOUND}'; this.onerror=null;">`;
}

export function reset() {
    feedHTML(constants.NOW_PLAYING_DIV_ID, constants.EMPTY_VAL);
    feedHTML(constants.NOW_PLAYING_DIV_EXT_ID, constants.EMPTY_VAL);
    feedHTML(constants.NOW_PLAYING_COVER_DIV_ID, constants.EMPTY_VAL);
    clearTimeout(nowPlayingRequestTimer);
    previousTrackHash = constants.EMPTY_VAL;
    previousExtractedCoverHTML = constants.EMPTY_VAL;
    selectedChannel = constants.EMPTY_VAL;
    document.title = constants.PAGE_TITLE_DEFAULT;
    hideElement(document.getElementsByClassName(constants.CLOSE)[0]);
    hideElement(document.getElementById(constants.TRACK_INFO_MODAL_ID));
    fetchStations();
    updateScrollingText();
    showElement(document.getElementById(constants.CONTAINER_ID));
    document.getElementById(constants.CBS_BUTTON_ID).classList.remove(constants.IS_DISABLED_CSS_CLASS);
    document.getElementById(constants.DF_BUTTON_ID).classList.remove(constants.IS_DISABLED_CSS_CLASS);
    document.getElementById(constants.TDM_BUTTON_ID).classList.remove(constants.IS_DISABLED_CSS_CLASS);
}
