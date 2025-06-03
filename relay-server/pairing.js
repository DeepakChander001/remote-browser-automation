// Pairing management module

const pairCodes = new Map();
const PAIR_CODE_EXPIRY = 5 * 60 * 1000; // 5 minutes

// Store a new pair code
function storePairCode(code, deviceId) {
    pairCodes.set(code, {
        deviceId: deviceId,
        createdAt: Date.now(),
        expiresAt: Date.now() + PAIR_CODE_EXPIRY
    });
}

// Validate pair code and return device ID
function validatePairCode(code) {
    const pairData = pairCodes.get(code);
    
    if (!pairData) {
        return null;
    }
    
    // Check if expired
    if (Date.now() > pairData.expiresAt) {
        pairCodes.delete(code);
        return null;
    }
    
    // Valid code - remove it (one-time use)
    pairCodes.delete(code);
    return pairData.deviceId;
}

// Remove a pair code
function removePairCode(code) {
    pairCodes.delete(code);
}

// Clean up expired pair codes
function cleanupExpiredPairs() {
    const now = Date.now();
    for (const [code, data] of pairCodes.entries()) {
        if (now > data.expiresAt) {
            pairCodes.delete(code);
            console.log(`Removed expired pair code: ${code}`);
        }
    }
}

// Get active pair codes (for debugging)
function getActivePairCodes() {
    const active = [];
    const now = Date.now();
    
    for (const [code, data] of pairCodes.entries()) {
        if (now <= data.expiresAt) {
            active.push({
                code: code,
                deviceId: data.deviceId,
                remainingTime: Math.floor((data.expiresAt - now) / 1000)
            });
        }
    }
    
    return active;
}

module.exports = {
    handlePairing: {
        storePairCode,
        validatePairCode,
        removePairCode
    },
    cleanupExpiredPairs,
    getActivePairCodes
};