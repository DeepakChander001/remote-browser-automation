// WebSocket Relay Server for Remote Browser Automation
const WebSocket = require('ws');
const http = require('http');
const { handlePairing, cleanupExpiredPairs } = require('./pairing');
const { handleSocketMessage, broadcastToPair } = require('./sockets');
const { generateToken, verifyToken } = require('./utils/token');

// Configuration
const PORT = process.env.PORT || 8080;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

// Create HTTP server
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Remote Browser Automation Relay Server\n');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Map();
const devicePairs = new Map();

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('New client connected');
    
    // Initialize client data
    const clientData = {
        ws: ws,
        deviceId: null,
        token: null,
        mode: null,
        pairedWith: null,
        isAlive: true,
        pairCode: null
    };
    
    // Heartbeat mechanism
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });
    
    // Message handler
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received message:', data.type);
            
            switch (data.type) {
                case 'register':
                    await handleRegister(clientData, data);
                    break;
                    
                case 'authenticate':
                    await handleAuthenticate(clientData, data);
                    break;
                    
                case 'generate-pair-code':
                    await handleGeneratePairCode(clientData);
                    break;
                    
                case 'enter-pair-code':
                    await handleEnterPairCode(clientData, data.code);
                    break;
                    
                case 'prompt':
                    await handlePrompt(clientData, data.prompt);
                    break;
                    
                case 'command':
                    await forwardCommand(clientData, data.command);
                    break;
                    
                case 'offer':
                case 'answer':
                case 'ice-candidate':
                    await handleWebRTC(clientData, data);
                    break;
                    
                case 'command-result':
                    await forwardCommandResult(clientData, data);
                    break;
                    
                default:
                    console.log('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Message handling error:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: error.message
            }));
        }
    });
    
    // Connection close handler
    ws.on('close', () => {
        console.log('Client disconnected:', clientData.deviceId);
        handleDisconnect(clientData);
    });
    
    // Error handler
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Handle device registration
async function handleRegister(clientData, data) {
    const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const token = generateToken(deviceId);
    
    clientData.deviceId = deviceId;
    clientData.token = token;
    clientData.mode = data.mode;
    
    // Store client
    clients.set(deviceId, clientData);
    
    // Send registration confirmation
    clientData.ws.send(JSON.stringify({
        type: 'registered',
        deviceId: deviceId,
        token: token,
        mode: data.mode
    }));
    
    console.log(`Registered ${data.mode}: ${deviceId}`);
}

// Handle authentication
async function handleAuthenticate(clientData, data) {
    if (!verifyToken(data.token, data.deviceId)) {
        clientData.ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid authentication token'
        }));
        return;
    }
    
    clientData.deviceId = data.deviceId;
    clientData.token = data.token;
    
    // Restore client data if exists
    const existingClient = clients.get(data.deviceId);
    if (existingClient) {
        clientData.mode = existingClient.mode;
        clientData.pairedWith = existingClient.pairedWith;
    }
    
    clients.set(data.deviceId, clientData);
    
    clientData.ws.send(JSON.stringify({
        type: 'authenticated',
        success: true
    }));
}

// Handle pair code generation (Controller)
async function handleGeneratePairCode(clientData) {
    if (clientData.mode !== 'controller') {
        clientData.ws.send(JSON.stringify({
            type: 'error',
            message: 'Only controllers can generate pair codes'
        }));
        return;
    }
    
    // Generate 6-digit code
    const pairCode = Math.floor(100000 + Math.random() * 900000).toString();
    clientData.pairCode = pairCode;
    
    // Store pairing data
    handlePairing.storePairCode(pairCode, clientData.deviceId);
    
    clientData.ws.send(JSON.stringify({
        type: 'pair-code-generated',
        code: pairCode,
        expiresIn: 300 // 5 minutes
    }));
    
    console.log(`Generated pair code ${pairCode} for ${clientData.deviceId}`);
}

// Handle pair code entry (Viewer)
async function handleEnterPairCode(clientData, code) {
    if (clientData.mode !== 'viewer') {
        clientData.ws.send(JSON.stringify({
            type: 'error',
            message: 'Only viewers can enter pair codes'
        }));
        return;
    }
    
    // Validate and get controller device ID
    const controllerDeviceId = handlePairing.validatePairCode(code);
    if (!controllerDeviceId) {
        clientData.ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid or expired pairing code'
        }));
        return;
    }
    
    // Get controller client
    const controllerClient = clients.get(controllerDeviceId);
    if (!controllerClient || !controllerClient.ws || controllerClient.ws.readyState !== WebSocket.OPEN) {
        clientData.ws.send(JSON.stringify({
            type: 'error',
            message: 'Controller device not available'
        }));
        return;
    }
    
    // Create pairing
    clientData.pairedWith = controllerDeviceId;
    controllerClient.pairedWith = clientData.deviceId;
    
    // Store pair mapping
    devicePairs.set(clientData.deviceId, controllerDeviceId);
    devicePairs.set(controllerDeviceId, clientData.deviceId);
    
    // Notify both devices
    clientData.ws.send(JSON.stringify({
        type: 'paired',
        with: 'controller',
        deviceId: controllerDeviceId
    }));
    
    controllerClient.ws.send(JSON.stringify({
        type: 'paired',
        with: 'viewer',
        deviceId: clientData.deviceId
    }));
    
    // Initiate stream
    controllerClient.ws.send(JSON.stringify({
        type: 'start-stream'
    }));
    
    console.log(`Paired viewer ${clientData.deviceId} with controller ${controllerDeviceId}`);
}

// Handle prompt from viewer
async function handlePrompt(clientData, prompt) {
    if (clientData.mode !== 'viewer' || !clientData.pairedWith) {
        clientData.ws.send(JSON.stringify({
            type: 'error',
            message: 'Not connected to a controller'
        }));
        return;
    }
    
    try {
        // Send prompt to translator API
        const response = await fetch('http://localhost:5000/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt })
        });
        
        const command = await response.json();
        
        // Forward command to controller
        const controllerClient = clients.get(clientData.pairedWith);
        if (controllerClient && controllerClient.ws.readyState === WebSocket.OPEN) {
            controllerClient.ws.send(JSON.stringify({
                type: 'command',
                command: command
            }));
            
            console.log(`Forwarded command from ${clientData.deviceId} to ${clientData.pairedWith}`);
        }
    } catch (error) {
        console.error('Failed to translate prompt:', error);
        clientData.ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to process command'
        }));
    }
}

// Forward command directly
async function forwardCommand(clientData, command) {
    if (!clientData.pairedWith) {
        return;
    }
    
    const targetClient = clients.get(clientData.pairedWith);
    if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
        targetClient.ws.send(JSON.stringify({
            type: 'command',
            command: command
        }));
    }
}

// Handle WebRTC signaling
async function handleWebRTC(clientData, data) {
    if (!clientData.pairedWith) {
        return;
    }
    
    const targetClient = clients.get(clientData.pairedWith);
    if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
        targetClient.ws.send(JSON.stringify(data));
        console.log(`Forwarded WebRTC ${data.type} from ${clientData.deviceId} to ${clientData.pairedWith}`);
    }
}

// Forward command results
async function forwardCommandResult(clientData, data) {
    if (!clientData.pairedWith) {
        return;
    }
    
    const targetClient = clients.get(clientData.pairedWith);
    if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
        targetClient.ws.send(JSON.stringify({
            type: 'command-result',
            success: data.success,
            error: data.error,
            command: data.command
        }));
    }
}

// Handle client disconnect
function handleDisconnect(clientData) {
    if (!clientData.deviceId) return;
    
    // Notify paired device
    if (clientData.pairedWith) {
        const pairedClient = clients.get(clientData.pairedWith);
        if (pairedClient && pairedClient.ws.readyState === WebSocket.OPEN) {
            pairedClient.ws.send(JSON.stringify({
                type: 'peer-disconnected'
            }));
            pairedClient.pairedWith = null;
        }
        
        // Clean up pairing
        devicePairs.delete(clientData.deviceId);
        devicePairs.delete(clientData.pairedWith);
    }
    
    // Remove client
    clients.delete(clientData.deviceId);
    
    // Clean up pair code if any
    if (clientData.pairCode) {
        handlePairing.removePairCode(clientData.pairCode);
    }
}

// Heartbeat interval
const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
    });
}, HEARTBEAT_INTERVAL);

// Cleanup expired pairs interval
setInterval(() => {
    cleanupExpiredPairs();
}, 60000); // Every minute

// Server cleanup on exit
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    clearInterval(heartbeatInterval);
    
    // Close all connections
    wss.clients.forEach((ws) => {
        ws.close();
    });
    
    server.close(() => {
        console.log('Server shut down');
        process.exit(0);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`WebSocket Relay Server running on port ${PORT}`);
});