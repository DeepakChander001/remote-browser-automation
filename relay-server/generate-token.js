// Quick script to generate JWT tokens
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Load environment variables if .env exists
try {
    require('dotenv').config({ path: '../.env' });
} catch (e) {
    console.log('No .env file found, using defaults');
}

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-this-in-production';

// Generate a token
function generateToken() {
    const deviceId = `device_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    const payload = {
        deviceId: deviceId,
        mode: 'controller', // or 'viewer'
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
        jti: crypto.randomBytes(16).toString('hex')
    };
    
    const token = jwt.sign(payload, JWT_SECRET);
    
    console.log('\n========================================');
    console.log('🔐 JWT TOKEN GENERATED SUCCESSFULLY! 🔐');
    console.log('========================================\n');
    
    console.log('Device ID:', deviceId);
    console.log('Mode:', payload.mode);
    console.log('Expires:', new Date(payload.exp * 1000).toLocaleString());
    
    console.log('\n📋 JWT Token (copy this):');
    console.log('----------------------------------------');
    console.log(token);
    console.log('----------------------------------------');
    
    console.log('\n📦 Full Token Details:');
    console.log(JSON.stringify({
        token: token,
        deviceId: deviceId,
        payload: payload
    }, null, 2));
    
    return { token, deviceId, payload };
}

// Generate the token
generateToken();

console.log('\n💡 Save this token in your extension or use it for testing!');
console.log('⚠️  Remember to change JWT_SECRET in production!');