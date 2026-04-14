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

// API Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Start Server
app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('[DEBUG] Server Ready');

    // Auto-start tunnel if configured
    if (process.env.ENABLE_TUNNEL === 'true') {
        const tunnelService = require('./services/tunnelService');
        await tunnelService.startTunnel(PORT);
    }

    // Initialize Scan Watcher
    const scanWatcher = require('./services/scanWatcher');
    scanWatcher.initialize();
});