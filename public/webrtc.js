'use strict';
var webSocket;
var roomNumber; // of type string
var msg;
var pc;
var getRoomButton;
var joinRoomButton;
var getmsg;
var sendmsg;
var getmsgButton;
var sendmsgButton;
var msgArea;
var localStream;
var isInitiator = false;
var remoteCandidatesDrained = false;
var remoteCandidatesArray = [];
var streamId = 0;
var RemoteStream;


// Put variables in global scope to make them available to the browser console.
const constraints = window.constraints = {
    audio: false,
    video: true
};

function handleSuccess(stream) {
    const video = document.querySelector('#gum-local');
    const videoTracks = stream.getVideoTracks();
    console.log('Got stream with constraints:', constraints);
    console.log(`Using video device: ${videoTracks[0].label}`);
    window.stream = stream; // make variable available to browser console
    video.srcObject = stream;
    localStream = stream;

    if (isInitiator == true) {
        createPeerConnection(stream);
        createOffer();
    }
}


function handleError(error) {
    if (error.name === 'ConstraintNotSatisfiedError') {
        const v = constraints.video;
        errorMsg(`The resolution ${v.width.exact}x${v.height.exact} px is not supported by your device.`);
    } else if (error.name === 'PermissionDeniedError') {
        errorMsg('Permissions have not been granted to use your camera and ' +
            'microphone, you need to allow the page access to your devices in ' +
            'order for the demo to work.');
    }
    errorMsg(`getUserMedia error: ${error.name}`, error);
}


function errorMsg(msg, error) {
    const errorElement = document.querySelector('#errorMsg');
    errorElement.innerHTML += `<p>${msg}</p>`;
    if (typeof error !== 'undefined') {
        console.error(error);
    }
}

function init(e) {
    navigator.mediaDevices.getUserMedia(constraints).then(function(s) {
        console.log("getUserMedia succeeds");
        handleSuccess(s);
        e.target.disabled = true;
    }).catch(function(err) {
        console.log("getUserMedia fails");
        handleError(err);
    });
}


function DisplayAndHiddenBtn(btnId, type) {
    var currentBtn = document.getElementById(btnId);
    if (type == "d") {
        currentBtn.style.display = "block"; 
    } else if (type == "h") {
        currentBtn.style.display = "none";
    }
}

function createWebSocket() {
    console.log("create websocket");
    webSocket = new WebSocket("wss://192.168.2.195:4443");
    webSocket.onopen = function(evt) { onWebSocketOpen(evt) };
    webSocket.onclose = function(evt) { onWebSocketClose(evt) };
    webSocket.onmessage = function(evt) { onWebSocketMessage(evt) };
    webSocket.onerror = function(evt) { onWebSocketError(evt) };
}

function onWebSocketOpen(evt) {
    console.log("onWebSocketOpen, roomNumber:" + roomNumber);
    if (!roomNumber) {
        var getRoom = {msg_type : "get_room"};
        console.log('>> getroom:' + JSON.stringify(getRoom));
        webSocket.send(JSON.stringify(getRoom));
    } else {
        var joinRoom = {msg_type : "join_room",
                       room_number : roomNumber};
        console.log('>> joinroom:' + JSON.stringify(joinRoom));
        DisplayAndHiddenBtn("getRoom","h");
        webSocket.send(JSON.stringify(joinRoom));
    }
}

function onWebSocketClose(evt) {
    console.log("onWebSocketClose");
    webSocket = null;
}

function onWebSocketMessage(evt) {
    console.log("<< onWebSocketMessage:" + evt.data + "\n");
    var response = JSON.parse(evt.data);
    switch (response.msg_type) {
    case "get_room":
        roomNumber = response.room_number;
        console.log("room is:" + roomNumber);
        DisplayAndHiddenBtn("getRoom", "h");
    break;
    case "message":
        var msg = response.msg;
        writeToScreen('<span style="color: blue;">RESPONSE: ' + msg +'</span>');
        console.log("msg is:" + msg);
//      msg.innerHTML = msgArea.value;
    break;
    case "webrtc":
        var type = response.webrtc.type;
        if (type == "offer") {
            setupIncomingCall(response.webrtc.sdp);
        } else if (type == "answer") {
            pc.setRemoteDescription(new RTCSessionDescription({type: 'answer', sdp: response.webrtc.sdp}));
        } else if(type == "candidate"){
            console.log('Adding ice candidate: ' + response.webrtc.candidate);
            pc.addIceCandidate(new RTCIceCandidate({
                    sdpMid: response.webrtc.id,
                    sdpMLineIndex: response.webrtc.label,
                    type: 'candidate',
                    candidate: response.webrtc.candidate
                }));
        }
        console.log("webrtc is" + response.webrtc );
    break;
    }
}

function onWebSocketError(evt) {
    console.log("onWebSocketError:" + evt.data);
}

getRoomButton = document.getElementById('getRoom');
getmsgButton = document.getElementById('getmsg');
sendmsgButton = document.getElementById('sendmsg');
msgArea = document.getElementById('msg');

getRoomButton.addEventListener('click', function() {
    createWebSocket();
});

sendmsgButton.addEventListener('click', function() {
    var send = {msg_type : 'message',
                room_number : roomNumber,
                msg : msgArea.value};

    console.log(">> sendMsg:" + JSON.stringify(send));
    webSocket.send(JSON.stringify(send));
    msgArea.value = "";
});



function onLoad() {
    console.log("OnLoad, window.pathname:" + location.pathname);
    var path = location.pathname;
    if (path.split('/').length == 3) {
        roomNumber = parseInt(path.split('/')[2]);
        console.log("room number is:" + roomNumber);
        getRoomButton.innerText = "Join Room " + roomNumber;
        isInitiator = true;
    }
}


function writeToScreen(message) {
    var pre = document.createElement("p");
    pre.style.wordWrap = "break-word";
    pre.innerHTML = message;
    output.appendChild(pre);
}

function joinRoom(roomNumber) {
    createWebSocket(); 
}

function createPeerConnection(stream) {
    pc = new RTCPeerConnection({});
    pc.addStream(localStream);
    pc.onicecandidate = function (evnt) {
        console.log("onicecandidate: " + evnt.candidate);
        sendIceCandidate(evnt.candidate);
    };

    pc.onaddstream = function (evnt) {
        console.log('Received new stream');
        const remotevideo = document.querySelector('#remoteVideo');
        remotevideo.srcObject = evnt.stream;
    };

    pc.onsignalingstatechange = function() {
        if (!pc) {
            return;
        }
        console.log('onsignalingstatechange, ' + pc.signalingState);
    };

    pc.oniceconnectionstatechange = function() {
        if (!pc) {
            return;
        }
        console.log('oniceconnectionstatechange, ' + pc.iceConnectionState);
    };
}

function createOffer() {
    var constraints = {
        offerToReceiveAudio: 1,
        offerToReceiveVideo: 1
    };
    pc.createOffer(constraints)
        .then(function(sessionDescription) {
            console.log("createOffer: " + sessionDescription);
            pc.setLocalDescription(sessionDescription)
                .then(function() {
                console.log("setLocalDescription succeeds");
                sendOffer(sessionDescription.sdp);
            })
            .catch(function(err) {
                console.log("setLocalDescription error: " + error);
            });
        })
        .catch(function(err) {
            console.log("createOffer error: " + err);
        });
}

function sendOffer(offer_) {
    var msg = {
        msg_type: 'webrtc',
        webrtc: {
            type: 'offer',
            sdp: offer_
        }
    };
    console.log(">> " + JSON.stringify(msg));
    webSocket.send(JSON.stringify(msg));
}

function setupIncomingCall(offer) {
    console.log('setupIncomingCall with offer: ' + offer);
    createPeerConnection();
    pc.setRemoteDescription(new RTCSessionDescription({type: 'offer', sdp: offer}))
        .then(function () {
            console.log('Setting remote description offer succeeds');
            pc.createAnswer()
                .then(function (sessionDescription) {
                console.log('createAnswer succeeds: ' + sessionDescription);
                pc.setLocalDescription(sessionDescription)
                    .then(function() {
                    console.log('setLocalDescription succeeds');
                    sendAnswer(sessionDescription.sdp);
                    drainRemoteCandidates();
                })
                .catch(function(err) {
                    console.log('setLocalDescription error: ' + err);
                });
            })
            .catch(function (e) {
                console.log('createAnswer error: ' + e);
            });
        })
        .catch(function (e) {
            console.log('setRmoteDecription error: ' + e);
        });
}

function sendAnswer(answer_) {
    if (isInitiator) {
        return;
    }
    var msg = {
        msg_type: 'webrtc',
        webrtc: {
            type: 'answer',
            sdp : answer_
        }
    };
    console.log(JSON.stringify(msg));
    webSocket.send(JSON.stringify(msg));
}

function sendIceCandidate(candidate_) {
    if (!candidate_) {
        return;
    }
    var msg = {
        msg_type: 'webrtc',
        webrtc: {
            type: 'candidate',
            label: candidate_.sdpMLineIndex,
            id: candidate_.sdpMid,
            candidate: candidate_.candidate
        }
    };
    console.log(JSON.stringify(msg));
    webSocket.send(JSON.stringify(msg));
}

function drainRemoteCandidates() {
    // drain the candidates
    for (var i = 0, len = remoteCandidatesArray.length; i < len; i++) {
        pc.addIceCandidate(remoteCandidatesArray[i]);
    }
    remoteCandidatesArray = []
    remoteCandidatesDrained = true;
}

document.querySelector('#showVideo').addEventListener('click', e => init(e));
