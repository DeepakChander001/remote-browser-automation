// Popup script for handling UI interactions

let currentMode = null;
let pairCode = null;
let codeTimer = null;

// DOM Elements
const modeSelection = document.getElementById('modeSelection');
const viewerInterface = document.getElementById('viewerInterface');
const controllerInterface = document.getElementById('controllerInterface');
const viewerModeBtn = document.getElementById('viewerMode');
const controllerModeBtn = document.getElementById('controllerMode');
const pairCodeInput = document.getElementById('pairCodeInput');
const connectBtn = document.getElementById('connectBtn');
const controlPanel = document.getElementById('controlPanel');
const promptInput = document.getElementById('promptInput');
const sendPromptBtn = document.getElementById('sendPromptBtn');
const generateCodeBtn = document.getElementById('generateCodeBtn');
const pairCodeDisplay = document.getElementById('pairCodeDisplay');
const generatedCode = document.getElementById('generatedCode');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const codeTimerDisplay = document.getElementById('codeTimer');
const connectionStatus = document.getElementById('connectionStatus');
const statusMessage = document.getElementById('statusMessage');
const remoteVideo = document.getElementById('remoteVideo');
const streamStatus = document.getElementById('streamStatus');

// Mode selection handlers
viewerModeBtn.addEventListener('click', () => {
    selectMode('viewer');
});

controllerModeBtn.addEventListener('click', () => {
    selectMode('controller');
});

// Select mode and register with backend
async function selectMode(mode) {
    currentMode = mode;
    modeSelection.classList.add('hidden');
    
    // Show appropriate interface
    if (mode === 'viewer') {
        viewerInterface.classList.remove('hidden');
    } else {
        controllerInterface.classList.remove('hidden');
    }
    
    // Register with background script
    try {
        await chrome.runtime.sendMessage({
            action: 'register',
            mode: mode
        });
        showStatus('Registered as ' + mode, 'success');
    } catch (error) {
        showStatus('Failed to register: ' + error.message, 'error');
    }
}

// Viewer mode handlers
connectBtn.addEventListener('click', async () => {
    const code = pairCodeInput.value.trim();
    if (code.length !== 6) {
        showStatus('Please enter a valid 6-digit code', 'error');
        return;
    }
    
    try {
        await chrome.runtime.sendMessage({
            action: 'enterPairCode',
            code: code
        });
        
        // Show control panel
        controlPanel.classList.remove('hidden');
        showStatus('Connected successfully!', 'success');
        
        // Start checking for stream
        checkForStream();
    } catch (error) {
        showStatus('Failed to connect: ' + error.message, 'error');
    }
});

sendPromptBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) {
        showStatus('Please enter a command', 'error');
        return;
    }
    
    try {
        await chrome.runtime.sendMessage({
            action: 'sendPrompt',
            prompt: prompt
        });
        
        promptInput.value = '';
        showStatus('Command sent', 'success');
    } catch (error) {
        showStatus('Failed to send command: ' + error.message, 'error');
    }
});

// Controller mode handlers
generateCodeBtn.addEventListener('click', async () => {
    try {
        await chrome.runtime.sendMessage({
            action: 'generatePairCode'
        });
        
        // Generate a random 6-digit code
        pairCode = Math.floor(100000 + Math.random() * 900000).toString();
        generatedCode.textContent = pairCode;
        pairCodeDisplay.classList.remove('hidden');
        generateCodeBtn.classList.add('hidden');
        
        // Start countdown timer
        startCodeTimer();
        
        // Listen for pairing success
        listenForPairing();
    } catch (error) {
        showStatus('Failed to generate code: ' + error.message, 'error');
    }
});

copyCodeBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(pairCode).then(() => {
        showStatus('Code copied to clipboard', 'success');
    });
});

// Start countdown timer for pairing code
function startCodeTimer() {
    let timeLeft = 300; // 5 minutes
    
    codeTimer = setInterval(() => {
        timeLeft--;
        codeTimerDisplay.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(codeTimer);
            pairCodeDisplay.classList.add('hidden');
            generateCodeBtn.classList.remove('hidden');
            showStatus('Pairing code expired', 'warning');
        }
    }, 1000);
}

// Listen for successful pairing
function listenForPairing() {
    // This would be replaced with actual WebSocket message handling
    setTimeout(() => {
        // Simulate successful pairing
        if (Math.random() > 0.5) {
            clearInterval(codeTimer);
            pairCodeDisplay.classList.add('hidden');
            connectionStatus.classList.remove('hidden');
            showStatus('Successfully paired!', 'success');
        }
    }, 3000);
}

// Check for incoming stream
async function checkForStream() {
    const interval = setInterval(async () => {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getStream'
            });
            
            if (response.peerConnection) {
                streamStatus.textContent = 'Stream connected';
                clearInterval(interval);
                
                // In a real implementation, we would get the stream from the background script
                // For now, we'll show the stream container
                streamStatus.style.color = '#4CAF50';
            }
        } catch (error) {
            console.error('Failed to check stream:', error);
        }
    }, 1000);
}

// Show status message
function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';
    
    setTimeout(() => {
        statusMessage.style.display = 'none';
    }, 3000);
}

// Load saved state
chrome.storage.local.get(['currentMode'], (result) => {
    if (result.currentMode) {
        selectMode(result.currentMode);
    }
});