const { startTunnel } = require('untun');

let activeTunnel = null;

exports.startTunnel = async (port) => {
    try {
        console.log('[TUNNEL] Initializing Cloudflare Quick Tunnel...');
        
        activeTunnel = await startTunnel({
            port: port,
        });

        const url = await activeTunnel.getURL();
        
        console.log(`[TUNNEL] Success! Public Access URL: ${url}`);
        
        // Expose internally for the session generator to pick up dynamically 
        process.env.PUBLIC_URL = url;

        return url;

    } catch (error) {
        console.error('[TUNNEL] Failed to initialize tunnel:', error.message);
        return null; // The server will fall back to local IP normally
    }
};

exports.stopTunnel = async () => {
    if (activeTunnel) {
        await activeTunnel.close();
        console.log('[TUNNEL] Cloudflare Tunnel closed.');
    }
};
