var currentNowPlayingUrl;
var selectedChannel;
var nowPlayingRequestTimer;
var channelContentUrl;

window.onload = function () {
    // any init function needed at the load
    playTV('cbstv');

    feedHTML(PARTY_AGENDA_ID, PARTY_AGENDA_WIDGET);
    feedHTML(RADIO_AGENDA_ID, RADIO_AGENDA_WIDGET);

}

function playChannel(channelNumber) {
    reset();
    showElement(AUDIO_PLAYER_DIV_ELEMENT);
    feedHTML(LOADING_DIV_ID, LOADING_MSG);
    var source = document.getElementById(AUDIO_PLAYER_SOURCE_ID);
    var channelElement = document.getElementById(channelsId[channelNumber - 1]);
    channelElement.classList.add(ACTIVE_CHANNEL_CLASS);
    source.src = channelElement.getAttribute(CHANNEL_DATA_VALUE_KEY);
    audio.load();
    audio.play();
    currentNowPlayingUrl = NOW_PLAYING_REQUEST_PREFIX + channelElement.innerHTML;
    channelContentUrl = NOW_PLAYING_PICTURE_REQUEST_PREFIX + channelNumber;
    selectedChannel = channelNumber;
}

var ongoingHLS;

function playTV(tvChannelName) {
    reset();
    var channelElement = document.getElementById(tvChannelName);
    channelElement.classList.add(ACTIVE_CHANNEL_CLASS);
    showElement(VIDEO_PLAYER_DIV_ELEMENT);
    var videoSrc = tvChannelName === 'mtv' ? MTV_PLAYLIST : CBS_TV_PLAYLIST;
    /* compatibility with safari/ios */
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = videoSrc;
    } else if (Hls.isSupported()) {
        const hls = new Hls();
        ongoingHLS = hls;
        hls.loadSource(videoSrc);
        hls.attachMedia(video);
    }

    video.play().catch(err => {
        manageError(err);
    });

}

function stopAudio() {
    audio.pause();
    audio.currentTime = 0;
}

function stopVideo() {
    if (video.currentTime > 0) {
        video.pause();
        video.currentTime = 0;
        if (ongoingHLS) {
            ongoingHLS.destroy();
        } else {
            video.removeAttribute("src");
            video.load();
        }
    }
}

// when the audio player has finished loading and is ready to play
audio.addEventListener(AUDIO_EVENT_PLAYING_NAME, function () {
    feedHTML(LOADING_DIV_ID, EMPTY_VAL);
    audio.controls = AUDIO_CONTROLS_KEY;
    getNowPlaying(currentNowPlayingUrl);
});

// when there is an error
audio.addEventListener(AUDIO_EVENT_ERROR_NAME, function (e) {
    clearTimeout(nowPlayingRequestTimer);
    var errorCode = e.currentTarget.error.code;
    reset();
    manageError(errorCode, EMPTY_VAL);
});

// action performed on pause button click
audio.addEventListener(AUDIO_EVENT_PAUSE_NAME, function (e) {
    audio.pause();
    audio.currentTime = 0;
});

// request now playing from IFM server every NOW_PLAYING_REQUEST_TIMEOUT_MSEC
var previousTrackTitle = EMPTY_VAL;
async function getNowPlaying() {
    if (selectedChannel) { // if playing
        try {
            const response = await fetch(currentNowPlayingUrl);
            const trackMetadata = await response.json();
            if (trackMetadata) {
                var title = trackMetadata.title;
                var stationMessage = trackMetadata.station_message[0].value;
                feedStationMessage(stationMessage);
                if (previousTrackTitle != title) {
                    // new track
                    previousTrackTitle = title;
                    feedNowPlaying(title);
                    removeWebConnectorDependencies();
                    addWebConnectorDependencies();
                    previousTrackTitle = title;
                    setNavigatorMetadata(trackMetadata);
                }
            }
        } catch (error) {
            console.log(error);
            clearTimeout(nowPlayingRequestTimer);
            manageError(error);
        }
        nowPlayingRequestTimer = setTimeout(getNowPlaying, NOW_PLAYING_REQUEST_TIMEOUT_MSEC);
    }
}

function feedStationMessage(stationMessage) {
    feedHTML(STATION_MESSAGE_ID, '<img src="' + STATION_LOGOS[selectedChannel - 1] + '" style="height: 10%; width: 10%; object-fit: contain; padding:2%"/>' + stationMessage);
}

/* this allows devices with media commands to get track metadatas */
function setNavigatorMetadata(metadata) {
    const trackMetadatas = metadata.title.split(METADATA_SPLIT_CHAR);
    var notCorrupted = trackMetadatas[0].includes(ARTIST_TITLE_SPLIT_STRING);
    var manydash = (trackMetadatas[0].match(/-/g) || []).length != 1;
    var artist_title = trackMetadatas[0];
    var artist = artist_title;
    var title = "";
    if (notCorrupted && !manydash) {
        artist = artist_title.split(ARTIST_TITLE_SPLIT_STRING)[0].trim();
        title = artist_title.split(ARTIST_TITLE_SPLIT_STRING)[1].trim();
    }
    var album = trackMetadatas[1] ? trackMetadatas[1].trim() : EMPTY_VAL;
    var coverPath = STATION_LOGOS[selectedChannel];
    if ("mediaSession" in navigator) {
        // iOS metadata update
        navigator.mediaSession.metadata = new MediaMetadata({
            title: title,
            artist: artist,
            album: album,
            artwork: [{
                src: coverPath
                }]
        });
    }
}

// populate the now playing html
function feedNowPlaying(value) {
    if (value) {
        var fields = value.split(META_TAGS_SPLIT_CHAR);
        var main = fields[0];
        var otherInfo = fields.slice(1);
        var otherFieldsProcessed = EMPTY_VAL;
        for (var i = 0; i < otherInfo.length; i++) {
            field = otherInfo[i];
            if (field && field.trim() !== EMPTY_VAL) {
                otherFieldsProcessed += otherInfo[i] + LINE_BREAK;
            }
        }
        feedHTML(SCROBBLER_SHADOW_ID, main);
        extractCoverFromChannelContent();
    } else {
        feedHTML(NOW_PLAYING_DIV_ID, EMPTY_VAL);
        feedHTML(NOW_PLAYING_DIV_EXT_ID, EMPTY_VAL);
        feedHTML(NOW_PLAYING_COVER_DIV_ID, EMPTY_VAL);
    }
}

function reset() {
    // remove active animation from all channels
    var allChannelButtons = document.getElementsByClassName('channelButton');
    Array.prototype.forEach.call(allChannelButtons, function (button) {
        button.classList.remove(ACTIVE_CHANNEL_CLASS);
    });

    clearTimeout(nowPlayingRequestTimer);
    audio.controls = EMPTY_VAL;
    stopVideo();
    stopAudio();
    removeWebConnectorDependencies();
    feedHTML(NOW_PLAYING_DIV_ID, EMPTY_VAL);
    feedHTML(STATION_MESSAGE_ID, EMPTY_VAL);
    selectedChannel = EMPTY_VAL;
    previousTrackTitle = EMPTY_VAL;
    removeWebConnectorDependencies();
    hideElement(VIDEO_PLAYER_DIV_ELEMENT);
    hideElement(AUDIO_PLAYER_DIV_ELEMENT);
}

/* utility function for showing an element in html, used for the "now playing" modal */
function showElement(element) {
    element.style.display = "block";
}
/* utility function for hiding an element in html, used for the "now playing" modal */
function hideElement(element) {
    element.style.display = "none";
}

function manageError(code, message) {
    var errorMessage = ERROR_MSG_TITLE;
    if (code) {
        switch (code) {
            case MEDIA_ERR_ABORTED_CODE:
                errorMessage += ERR_ABORTED_MSG;
                break;
            case MEDIA_ERR_NETWORK_CODE:
                errorMessage += MEDIA_ERR_NETWORK_CODE_MSG;
                break;
            case MEDIA_ERR_DECODE_CODE:
                errorMessage += MEDIA_ERR_DECODE_CODE_MSG;
                break;
            case MEDIA_ERR_SRC_NOT_SUPPORTED_CODE:
                errorMessage += MEDIA_ERR_SRC_NOT_SUPPORTED_CODE_MSG;
                break;
            default:
                errorMessage += ERROR_UNKNOWN_MSG;
        }
    }
    if (errorMessage) {
        errorMessage += message;
    }
    feedHTML(NOW_PLAYING_DIV_ID, errorMessage);
    feedHTML(NOW_PLAYING_DIV_EXT_ID, EMPTY_VAL);
}

async function extractCoverFromChannelContent() {
    var response = await fetch(NOW_PLAYING_PICTURE_REQUEST_PREFIX + selectedChannel);
    var body = await response.text();
    //var startOfCoverImgIndex = body.indexOf('<img');
    //var endOfCoverImgIndex = body.indexOf('alt=""/>') + 10;
    //var extractedCoverHTML = body.substring(startOfCoverImgIndex, endOfCoverImgIndex);
    //console.log(extractedCoverHTML);
    var cleantBody = body.replaceAll('now playing', '').replaceAll('airtime', '').replaceAll('mb-4', '');
    feedHTML(NOW_PLAYING_DIV_ID, cleantBody);
}

/* following two functions adds/remove fake classes to the player to keep the web scrobble connector compatibility 
https://github.com/web-scrobbler/web-scrobbler/blob/master/src/connectors/intergalacticfm.ts#L8
*/
function removeWebConnectorDependencies() {
    audio.classList.remove(VJS_PLAY_CONTROL_CLASS);
    audio.classList.remove(VJS_PLAYING_CLASS);
    document.getElementById(SCROBBLER_SHADOW_ID).classList.remove(TRACK_META_CLASS);
}

function addWebConnectorDependencies() {
    audio.classList.add(VJS_PLAY_CONTROL_CLASS);
    audio.classList.add(VJS_PLAYING_CLASS);
    document.getElementById(SCROBBLER_SHADOW_ID).classList.add(TRACK_META_CLASS);
}

function feedHTML(elementId, value) {
    document.getElementById(elementId).innerHTML = value;
}
