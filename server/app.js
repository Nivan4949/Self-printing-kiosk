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

// Static Files
app.use(express.static(path.join(__dirname, '../client/public')));

const views = [
    { route: '/', file: 'index.html' },
    { route: '/login', file: 'login.html' },
    { route: '/dashboard', file: 'admin/dashboard.html' },
    { route: '/options', file: 'options.html' },
    { route: '/print', file: 'print.html' },
    { route: '/upload', file: 'upload.html' },
    { route: '/preview', file: 'preview.html' },
    // Keep raw html extensions working for backwards compatibility
    { route: '/options.html', file: 'options.html' },
    { route: '/print.html', file: 'print.html' },
    { route: '/upload.html', file: 'upload.html' },
    { route: '/preview.html', file: 'preview.html' }
];

views.forEach(({ route, file }) => {
    app.get(route, (req, res) => {
        const filePath = path.join(__dirname, `../client/views/${file}`);
        res.sendFile(filePath, err => {
            if (err) console.error(`[ERROR] Could not serve ${file}:`, err);
            else console.log(`[DEBUG] Served ${file}`);
        });
    });
});

// Admin Dashboard
app.get('/admin', (req, res) => {
    const filePath = path.join(__dirname, '../client/views/admin/dashboard.html');
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
        console.error('[ERROR] Admin dashboard file not found:', filePath);
        return res.status(404).send('Admin Dashboard File Not Found');
    }
    res.sendFile(filePath);
});

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