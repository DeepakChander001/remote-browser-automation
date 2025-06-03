// WebSocket message handling utilities

// Send message to a specific client
function sendToClient(client, message) {
    if (client && client.ws && client.ws.readyState === 1) { // WebSocket.OPEN = 1
        try {
            client.ws.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error('Failed to send message:', error);
            return false;
        }
    }
    return false;
}

// Broadcast message to paired device
function broadcastToPair(clients, senderDeviceId, message) {
    const sender = clients.get(senderDeviceId);
    if (!sender || !sender.pairedWith) {
        return false;
    }
    
    const target = clients.get(sender.pairedWith);
    return sendToClient(target, message);
}

// Handle socket message with error handling
async function handleSocketMessage(handler, ...args) {
    try {
        await handler(...args);
    } catch (error) {
        console.error('Socket message handler error:', error);
        throw error;
    }
}

// Validate WebSocket message format
function validateMessage(message) {
    if (!message || typeof message !== 'object') {
        throw new Error('Invalid message format');
    }
    
    if (!message.type || typeof message.type !== 'string') {
        throw new Error('Message must have a type field');
    }
    
    return true;
}

// Create error message
function createErrorMessage(error, details = {}) {
    return {
        type: 'error',
        message: error.message || 'An error occurred',
        code: error.code || 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString(),
        ...details
    };
}

// Create success message
function createSuccessMessage(type, data = {}) {
    return {
        type: type,
        success: true,
        timestamp: new Date().toISOString(),
        ...data
    };
}

// Check if client is authenticated
function isAuthenticated(client) {
    return client && client.deviceId && client.token;
}

// Check if client is paired
function isPaired(client) {
    return client && client.pairedWith;
}

// Get client info for logging
function getClientInfo(client) {
    return {
        deviceId: client.deviceId || 'unknown',
        mode: client.mode || 'unknown',
        paired: isPaired(client),
        pairedWith: client.pairedWith || null
    };
}

module.exports = {
    sendToClient,
    broadcastToPair,
    handleSocketMessage,
    validateMessage,
    createErrorMessage,
    createSuccessMessage,
    isAuthenticated,
    isPaired,
    getClientInfo
};