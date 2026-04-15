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

// Serve static assets from client/public (CSS, JS, icons, etc.)
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

// HTML Page Routes - serve client views for all page requests
const viewsDir = path.join(__dirname, '../client/views');

const htmlRoutes = [
    { path: '/', file: 'index.html' },
    { path: '/upload', file: 'upload.html' },
    { path: '/upload.html', file: 'upload.html' },
    { path: '/preview', file: 'preview.html' },
    { path: '/preview.html', file: 'preview.html' },
    { path: '/print', file: 'print.html' },
    { path: '/print.html', file: 'print.html' },
    { path: '/options', file: 'options.html' },
    { path: '/options.html', file: 'options.html' },
    { path: '/login', file: 'login.html' },
    { path: '/login.html', file: 'login.html' },
    { path: '/dashboard', file: 'dashboard.html' },
    { path: '/dashboard.html', file: 'dashboard.html' },
    { path: '/admin', file: 'admin/dashboard.html' },
];

htmlRoutes.forEach(({ path: routePath, file }) => {
    app.get(routePath, (req, res) => {
        res.sendFile(path.join(viewsDir, file));
    });
});

// Catchall: try to serve any *.html from views folder
app.get('/:page', (req, res, next) => {
    const page = req.params.page.replace(/\.html$/, '');
    const filePath = path.join(viewsDir, `${page}.html`);
    res.sendFile(filePath, (err) => {
        if (err) next(); // 404 if not found
    });
});

// 404 Fallback
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

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