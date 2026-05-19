const { startTunnel } = require('untun');
require('dotenv').config();

let activeTunnel = null;

exports.startTunnel = async (port) => {
    try {
        console.log(`[TUNNEL] Initializing Cloudflare Tunnel via untun...`);
        
        activeTunnel = await startTunnel({ port: port });
        const url = await activeTunnel.getURL();
        
        console.log(`[TUNNEL] Success! Cloudflare URL: ${url}`);
        
        process.env.PUBLIC_URL = url;

        return url;

    } catch (error) {
        console.error('[TUNNEL] Failed to initialize tunnel:', error.message);
        return null;
    }
};

exports.stopTunnel = async () => {
    if (activeTunnel) {
        await activeTunnel.close();
        activeTunnel = null;
    }
};

