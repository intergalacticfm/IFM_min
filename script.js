const audio = document.getElementById('audioPlayer');
const video = document.getElementById('videoPlayer');
const NOW_PLAYING_REQUEST_TIMEOUT_MSEC = 5000;
const NOW_PLAYING_REQUEST_PREFIX = 'https://www.intergalactic.fm/now-playing?channel=';
const NOW_PLAYING_PICTURE_REQUEST_PREFIX = 'https://www.intergalactic.fm/channel-content/';
const NOW_PLAYING_DIV_ID = 'nowPlaying';
const SCROBBLER_SHADOW_ID = 'shadowScrobblerId';
const TRACK_META_DIV_ID = 'track-meta';
const NOW_PLAYING_DIV_EXT_ID = 'nowPlayingExt';
const NOW_PLAYING_COVER_DIV_ID = 'nowPlayingCover';
const AUDIO_PLAYER_SOURCE_ID = 'audioPlayerSource';
const VIDEO_PLAYER_SOURCE_ID = 'videoPlayerSource';
const CBS_TV_PLAYLIST = 'https://intergalactic.tv/live/smil:tv.smil/playlist.m3u8';
const MTV_PLAYLIST = 'https://intergalactic.tv/live/smil:mtv.smil/playlist.m3u8';
const ERROR_MSG = 'Error: ';
const STYLE = 'style';
const NO_INFO_MSG = 'No info available';
const META_TAGS_SPLIT_CHAR = '|';
const CBS_CHANNEL_ID = 'cbs';
const DF_CHANNEL_ID = 'df';
const TDM_CHANNEL_ID = 'tdm';
const channelsId = ['cbs', 'df', 'tdm'];
const CHANNEL_DATA_VALUE_KEY = 'data-value';
const AUDIO_CONTROLS_KEY = 'controls';
const AUDIO_EVENT_PLAYING_NAME = 'playing';
const AUDIO_EVENT_PAUSE_NAME = 'pause';
const AUDIO_EVENT_ERROR_NAME = 'error';
const LOADING_DIV_ID = 'loading';
const LOADING_MSG = 'Loading...';
const VJS_PLAY_CONTROL_CLASS = 'vjs-play-control';
const VJS_PLAYING_CLASS = 'vjs-playing';
const LINE_BREAK = '<br>';
const EMPTY_VAL = '';
const ERROR_MSG_TITLE = 'Error: ';
const ERROR_UNKNOWN_MSG = 'Unknown';
const ERROR_REASON_TITLE = 'Reason: ';
const MEDIA_ERR_ABORTED_CODE = 1;
const MEDIA_ERR_NETWORK_CODE = 2;
const MEDIA_ERR_DECODE_CODE = 3;
const MEDIA_ERR_SRC_NOT_SUPPORTED_CODE = 4;
const ERR_ABORTED_MSG = 'ABORTED';
const MEDIA_ERR_NETWORK_CODE_MSG = 'NETWORK';
const MEDIA_ERR_DECODE_CODE_MSG = 'DECODE';
const MEDIA_ERR_SRC_NOT_SUPPORTED_CODE_MSG = 'NOT SUPPORTED';
const TRACK_META_CLASS = 'track-meta';
const AUDIO_PLAYER_DIV_ELEMENT = document.getElementById('audioPlayerDiv');
const VIDEO_PLAYER_DIV_ELEMENT = document.getElementById('videoPlayerDiv');
const IFMX_AGENDA_ID = 'ifmx_agenda';
const IFM_AGENDA_ID = 'ifm_agenda';
const IFMX_PARTY_AGENDA_WIDGET =
    '<iframe id="ifmxAgenda" src="https://it.ra.co/widget/eventlisting?dj=i-f&bgcolor=000000&linkcolor=6b96c2&textcolor=ffffff"' + 'overflow:hidden; position:relative; height="100%" width="100%" style="border:none;"/>';
const IFM_PROMOTER_AGENDA_WIDGET =
    '<iframe src="https://ra.co/promoters/167717/widget/events?theme=dark" height="640px" width="100%" style="border:none" />';

var currentNowPlayingUrl;
var selectedChannel;
var nowPlayingRequestTimer;
var channelContentUrl;

window.onload = function () {
    // any init function needed at the load
    playTV('cbstv');
    feedHTML(IFMX_AGENDA_ID, IFMX_PARTY_AGENDA_WIDGET);
    //document.getElementById('ifmxAgenda').contents().find("logo-footer").remove();
    //document.getElementById('ifmxAgenda').contents().find("copy-footer").remove();
    //feedHTML(IFM_AGENDA_ID, IFM_PROMOTER_AGENDA_WIDGET);
}

function playChannel(channelNumber) {
    reset();
    showElement(AUDIO_PLAYER_DIV_ELEMENT);
    feedHTML(LOADING_DIV_ID, LOADING_MSG);
    var source = document.getElementById(AUDIO_PLAYER_SOURCE_ID);
    var channelElement = document.getElementById(channelsId[channelNumber - 1]);
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
    showElement(VIDEO_PLAYER_DIV_ELEMENT);
    var videoSrc = tvChannelName === 'mtv' ? MTV_PLAYLIST : CBS_TV_PLAYLIST;

    if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(videoSrc);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play();
        });
        ongoingHLS = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // fallback for Safari/iOS
        video.src = videoSrc;
        video.play();
    }
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
                if (previousTrackTitle != title) {
                    // new track
                    feedNowPlaying(title);
                    removeWebConnectorDependencies();
                    addWebConnectorDependencies();
                    previousTrackTitle = title;
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
        //feedHTML(NOW_PLAYING_DIV_EXT_ID, otherFieldsProcessed);
        extractCoverFromChannelContent();
    } else {
        feedHTML(NOW_PLAYING_DIV_ID, EMPTY_VAL);
        feedHTML(NOW_PLAYING_DIV_EXT_ID, EMPTY_VAL);
        feedHTML(NOW_PLAYING_COVER_DIV_ID, EMPTY_VAL);
    }
}

function reset() {
    clearTimeout(nowPlayingRequestTimer);
    audio.controls = EMPTY_VAL;
    stopVideo();
    stopAudio();
    removeWebConnectorDependencies();
    feedHTML(NOW_PLAYING_DIV_ID, EMPTY_VAL);
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
