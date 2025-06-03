// JWT token generation and validation
const crypto = require('crypto');

// Get secret from environment or use default (change in production!)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-this-in-production';

// Simple JWT implementation (for production, use jsonwebtoken library)
class SimpleJWT {
    static base64UrlEncode(str) {
        return Buffer.from(str)
            .toString('base64')
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
    }
    
    static base64UrlDecode(str) {
        str += '='.repeat((4 - str.length % 4) % 4);
        return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    }
    
    static sign(payload, secret) {
        const header = {
            alg: 'HS256',
            typ: 'JWT'
        };
        
        const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
        const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
        
        const signature = crypto
            .createHmac('sha256', secret)
            .update(`${encodedHeader}.${encodedPayload}`)
            .digest('base64')
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
        
        return `${encodedHeader}.${encodedPayload}.${signature}`;
    }
    
    static verify(token, secret) {
        try {
            const [encodedHeader, encodedPayload, signature] = token.split('.');
            
            const expectedSignature = crypto
                .createHmac('sha256', secret)
                .update(`${encodedHeader}.${encodedPayload}`)
                .digest('base64')
                .replace(/=/g, '')
                .replace(/\+/g, '-')
                .replace(/\//g, '_');
            
            if (signature !== expectedSignature) {
                return null;
            }
            
            const payload = JSON.parse(this.base64UrlDecode(encodedPayload));
            
            // Check expiration
            if (payload.exp && Date.now() >= payload.exp * 1000) {
                return null;
            }
            
            return payload;
        } catch (error) {
            return null;
        }
    }
}

// Generate a new token for a device
function generateToken(deviceId) {
    const payload = {
        deviceId: deviceId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
        jti: crypto.randomBytes(16).toString('hex')
    };
    
    return SimpleJWT.sign(payload, JWT_SECRET);
}

// Verify token and check device ID
function verifyToken(token, deviceId) {
    if (!token || !deviceId) {
        return false;
    }
    
    const payload = SimpleJWT.verify(token, JWT_SECRET);
    
    if (!payload) {
        return false;
    }
    
    return payload.deviceId === deviceId;
}

// Generate a secure random string
function generateSecureRandom(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

// Hash a string (for sensitive data)
function hashString(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
}

module.exports = {
    generateToken,
    verifyToken,
    generateSecureRandom,
    hashString
};