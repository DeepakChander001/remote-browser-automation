// Background service worker for handling browser automation and WebRTC streaming

let ws = null;
let peerConnection = null;
let localStream = null;
let deviceId = null;
let deviceToken = null;
let isController = false;
let debuggeeTab = null;

// WebSocket connection management
async function connectWebSocket() {
  try {
    ws = new WebSocket('ws://localhost:8080');
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      // Re-authenticate if we have credentials
      if (deviceId && deviceToken) {
        ws.send(JSON.stringify({
          type: 'authenticate',
          deviceId,
          token: deviceToken
        }));
      }
    };
    
    ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      await handleWebSocketMessage(message);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected, retrying in 3s...');
      setTimeout(connectWebSocket, 3000);
    };
  } catch (error) {
    console.error('Failed to connect WebSocket:', error);
    setTimeout(connectWebSocket, 3000);
  }
}

// Handle incoming WebSocket messages
async function handleWebSocketMessage(message) {
  switch (message.type) {
    case 'registered':
      deviceId = message.deviceId;
      deviceToken = message.token;
      chrome.storage.local.set({ deviceId, deviceToken });
      break;
      
    case 'paired':
      console.log('Successfully paired with device');
      break;
      
    case 'command':
      if (isController) {
        await executeCommand(message.command);
      }
      break;
      
    case 'offer':
      await handleWebRTCOffer(message.offer);
      break;
      
    case 'answer':
      await handleWebRTCAnswer(message.answer);
      break;
      
    case 'ice-candidate':
      await handleICECandidate(message.candidate);
      break;
      
    case 'start-stream':
      if (isController) {
        await startStreaming();
      }
      break;
  }
}

// Execute browser automation commands
async function executeCommand(command) {
  try {
    if (!debuggeeTab) {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      debuggeeTab = { tabId: tab.id };
      
      // Attach debugger
      await chrome.debugger.attach(debuggeeTab, '1.3');
      await chrome.debugger.sendCommand(debuggeeTab, 'Page.enable');
      await chrome.debugger.sendCommand(debuggeeTab, 'Runtime.enable');
      await chrome.debugger.sendCommand(debuggeeTab, 'Input.enable');
    }
    
    switch (command.action) {
      case 'navigate':
        await chrome.debugger.sendCommand(debuggeeTab, 'Page.navigate', {
          url: command.url
        });
        break;
        
      case 'click':
        await chrome.debugger.sendCommand(debuggeeTab, 'Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: command.x,
          y: command.y,
          button: 'left',
          clickCount: 1
        });
        await chrome.debugger.sendCommand(debuggeeTab, 'Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: command.x,
          y: command.y,
          button: 'left'
        });
        break;
        
      case 'type':
        for (const char of command.text) {
          await chrome.debugger.sendCommand(debuggeeTab, 'Input.dispatchKeyEvent', {
            type: 'char',
            text: char
          });
        }
        break;
        
      case 'scroll':
        await chrome.debugger.sendCommand(debuggeeTab, 'Input.dispatchMouseEvent', {
          type: 'mouseWheel',
          x: command.x || 0,
          y: command.y || 0,
          deltaX: 0,
          deltaY: command.deltaY || 100
        });
        break;
        
      case 'search':
        // Navigate to search URL
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(command.query)}`;
        await chrome.debugger.sendCommand(debuggeeTab, 'Page.navigate', {
          url: searchUrl
        });
        break;
    }
    
    // Send success response
    ws.send(JSON.stringify({
      type: 'command-result',
      success: true,
      command: command
    }));
    
  } catch (error) {
    console.error('Command execution error:', error);
    ws.send(JSON.stringify({
      type: 'command-result',
      success: false,
      error: error.message
    }));
  }
}

// WebRTC stream setup
async function startStreaming() {
  try {
    // Get the current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Capture tab video/audio
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tab.id
    });
    
    // Get media stream
    const constraints = {
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      },
      video: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
          maxWidth: 1920,
          maxHeight: 1080
        }
      }
    };
    
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Create peer connection
    await createPeerConnection();
    
    // Add stream to peer connection
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
    
    // Create offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    // Send offer through WebSocket
    ws.send(JSON.stringify({
      type: 'offer',
      offer: offer
    }));
    
  } catch (error) {
    console.error('Failed to start streaming:', error);
  }
}

// Create WebRTC peer connection
async function createPeerConnection() {
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: 'turn:localhost:3478',
        username: 'user',
        credential: 'pass'
      }
    ]
  };
  
  peerConnection = new RTCPeerConnection(configuration);
  
  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({
        type: 'ice-candidate',
        candidate: event.candidate
      }));
    }
  };
  
  // Handle incoming stream (for viewer)
  peerConnection.ontrack = (event) => {
    console.log('Received remote stream');
    // Store stream for popup to access
    chrome.storage.local.set({ hasRemoteStream: true });
  };
}

// Handle WebRTC offer (viewer side)
async function handleWebRTCOffer(offer) {
  if (!peerConnection) {
    await createPeerConnection();
  }
  
  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  
  ws.send(JSON.stringify({
    type: 'answer',
    answer: answer
  }));
}

// Handle WebRTC answer (controller side)
async function handleWebRTCAnswer(answer) {
  if (peerConnection) {
    await peerConnection.setRemoteDescription(answer);
  }
}

// Handle ICE candidates
async function handleICECandidate(candidate) {
  if (peerConnection) {
    await peerConnection.addIceCandidate(candidate);
  }
}

// Message handler from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'register':
      isController = request.mode === 'controller';
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'register',
          mode: request.mode
        }));
      }
      sendResponse({ success: true });
      break;
      
    case 'generatePairCode':
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'generate-pair-code'
        }));
      }
      sendResponse({ success: true });
      break;
      
    case 'enterPairCode':
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'enter-pair-code',
          code: request.code
        }));
      }
      sendResponse({ success: true });
      break;
      
    case 'sendPrompt':
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'prompt',
          prompt: request.prompt
        }));
      }
      sendResponse({ success: true });
      break;
      
    case 'getStream':
      sendResponse({ 
        peerConnection: peerConnection ? true : false,
        hasStream: localStream ? true : false
      });
      break;
  }
  return true;
});

// Initialize WebSocket connection
connectWebSocket();

// Load saved credentials
chrome.storage.local.get(['deviceId', 'deviceToken'], (result) => {
  if (result.deviceId && result.deviceToken) {
    deviceId = result.deviceId;
    deviceToken = result.deviceToken;
  }
});