// DOM Elements
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const generateLinkBtn = document.getElementById('generate-link');
const meetingLinkContainer = document.getElementById('meeting-link-container');
const meetingLinkInput = document.getElementById('meeting-link');
const copyLinkButton = document.getElementById('copy-link-button');
const startMeetingButton = document.getElementById('start-meeting');
const endMeetingButton = document.getElementById('end-meeting');
const screenShareButton = document.getElementById('screen-share');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');
const sendButton = document.getElementById('send-button');

const socket = new WebSocket('ws://localhost:3000');
let localStream;
let remoteStream;
let peerConnection;
let roomId = "";
let screenStream;

// WebRTC configuration
const config = {
    iceServers: [
        {
            urls: 'stun:stun.l.google.com:19302', // Free STUN server
        },
    ],
};

// Generate Meeting Link
generateLinkBtn.onclick = () => {
    roomId = Math.random().toString(36).substr(2, 9);
    const meetingLink = `${window.location.origin}?room=${roomId}`;
    meetingLinkContainer.style.display = 'block';
    meetingLinkInput.value = meetingLink;
};

// Copy Meeting Link to Clipboard
copyLinkButton.onclick = () => {
    meetingLinkInput.select();
    navigator.clipboard.writeText(meetingLinkInput.value)
        .then(() => alert('Meeting link copied to clipboard!'))
        .catch(err => console.error('Error copying link:', err));
};

// Auto-join using the room ID in the URL
window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const room = urlParams.get('room');
    if (room) {
        roomId = room;
        startMeeting();
    }
};

// Start Meeting
startMeetingButton.onclick = startMeeting;

async function startMeeting() {
    if (!roomId) {
        alert('Please generate or use a valid meeting link.');
        return;
    }

    // Get local video/audio stream
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    // Join the room
    socket.send(JSON.stringify({ type: 'join', room: roomId }));

    socket.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
            case 'new-participant':
                createOffer();
                break;

            case 'offer':
                await createAnswer(data.offer);
                break;

            case 'answer':
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                break;

            case 'candidate':
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                break;

            case 'chat':
                appendMessage(`Peer: ${data.message}`);
                break;
        }
    };
}

// End Meeting
endMeetingButton.onclick = () => {
    if (peerConnection) peerConnection.close();
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    if (screenStream) screenStream.getTracks().forEach(track => track.stop());
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    alert('Meeting ended.');
};

// Screen Sharing
screenShareButton.onclick = async () => {
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);

        screenTrack.onended = () => {
            const originalTrack = localStream.getVideoTracks()[0];
            if (sender) sender.replaceTrack(originalTrack);
        };
    } catch (err) {
        console.error('Screen sharing failed:', err);
        alert('Failed to share screen.');
    }
};

// WebRTC Signaling - Create Offer
async function createOffer() {
    peerConnection = new RTCPeerConnection(config);
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate, room: roomId }));
        }
    };

    peerConnection.ontrack = (event) => {
        remoteStream = event.streams[0];
        remoteVideo.srcObject = remoteStream;
    };

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.send(JSON.stringify({ type: 'offer', offer, room: roomId }));
}

// WebRTC Signaling - Create Answer
async function createAnswer(offer) {
    peerConnection = new RTCPeerConnection(config);
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate, room: roomId }));
        }
    };

    peerConnection.ontrack = (event) => {
        remoteStream = event.streams[0];
        remoteVideo.srcObject = remoteStream;
    };

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.send(JSON.stringify({ type: 'answer', answer, room: roomId }));
}

// Chat Functionality
sendButton.onclick = () => {
    const message = chatInput.value.trim();
    if (message) {
        appendMessage(`You: ${message}`);
        socket.send(JSON.stringify({ type: 'chat', message, room: roomId }));
        chatInput.value = '';
    }
};

function appendMessage(message) {
    const msgDiv = document.createElement('div');
    msgDiv.textContent = message;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
