const fs = require('fs');
const path = require('path');
const os = require('os');
const sessionController = require('../controllers/sessionController'); 

// Store the latest detected file info
let latestScan = null;
const SCAN_TIMEOUT = 30000; // Only keep "new" status for 30 seconds

exports.initialize = () => {
    const defaultWatchPath = process.env.SCAN_WATCH_PATH || './scans';
    
    const pathsToWatch = [
        defaultWatchPath,
        path.join(os.homedir(), 'Pictures', 'Scans'),
        path.join(os.homedir(), 'Pictures'),
        path.join(os.homedir(), 'Documents', 'Scanned Documents')
    ];

    pathsToWatch.forEach(watchPath => {
        // Ensure local default directory exists
        if (watchPath === defaultWatchPath && !fs.existsSync(watchPath)) {
            try {
                fs.mkdirSync(watchPath, { recursive: true });
            } catch (err) {}
        }

        if (fs.existsSync(watchPath)) {
            console.log(`[SCANNER] Watching for new files in: ${watchPath}`);
            fs.watch(watchPath, (eventType, filename) => {
                if (eventType === 'rename' && filename) {
                    const filePath = path.join(watchPath, filename);
                    
                    if (fs.existsSync(filePath)) {
                        // Ignore temporary or hidden files
                        if (filename.startsWith('.') || filename.endsWith('.tmp')) return;
                        
                        // Limit to valid image/pdf extensions
                        const ext = path.extname(filename).toLowerCase();
                        if (!['.jpg', '.jpeg', '.png', '.pdf'].includes(ext)) return;

                        console.log(`[SCANNER] New file detected: ${filename} in ${watchPath}`);
                        
                        latestScan = {
                            filename: filename,
                            path: filePath,
                            timestamp: Date.now(),
                            processed: false
                        };
                    }
                }
            });
        }
    });
};

exports.getLatestScan = () => {
    if (!latestScan) return null;

    // Check if scan is stale (older than 30s)
    if (Date.now() - latestScan.timestamp > SCAN_TIMEOUT) {
        latestScan = null;
        return null;
    }

    // Return scan info and mark as processed so it's not picked up again immediately by the same client
    // unless we want it to be persistent. For now, let's keep it simple:
    // The client polls, gets it, and creates a session.
    
    return latestScan;
};

// Clear the latest scan after it's been "claimed" by a session creation
exports.clearLatestScan = () => {
    latestScan = null;
};
