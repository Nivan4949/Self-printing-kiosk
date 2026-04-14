const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug Middleware
app.use((req, res, next) => {
    console.log(`[DEBUG] ${req.method} ${req.url}`);
    next();
});

// Startup Diagnostics
console.log(`[STARTUP] Working Directory: ${process.cwd()}`);
console.log(`[STARTUP] Entry Directory: ${__dirname}`);

// Static Files (for Local Dev)
app.use(express.static(path.join(__dirname, '../client/public')));

const isVercel = process.env.VERCEL === '1';

// Health Check for monitoring
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'UP', 
        environment: isVercel ? 'cloud' : 'local',
        timestamp: new Date().toISOString() 
    });
});

// API Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Only start the server if this file is run directly (local development)
if (require.main === module) {
    app.listen(PORT, async () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log('[DEBUG] Server Ready');

        if (!isVercel) {
            // Auto-start tunnel if configured (Local Only)
            if (process.env.ENABLE_TUNNEL === 'true') {
                const tunnelService = require('./services/tunnelService');
                await tunnelService.startTunnel(PORT);
            }

            // Initialize Scan Watcher (Local Only)
            const scanWatcher = require('./services/scanWatcher');
            scanWatcher.initialize();
        }
    });
}

// Export for Vercel Serverless environment
module.exports = app;