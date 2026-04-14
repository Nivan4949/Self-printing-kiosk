const db = require('../models/db');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const SESSION_EXPIRY_MS = 3600000; // 1 hour

// Create a new session (Kiosk side)
exports.createSession = async (req, res) => {
    const sessionToken = uuidv4();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS).toISOString();
    
    const os = require('os');
    
    // Get Local IP Address
    const interfaces = os.networkInterfaces();
    let localIp = null;
    
    // Priority list for interface names
    const priorityInterfaces = ['Wi-Fi', 'WiFi', 'Ethernet', 'en0', 'eth0'];
    
    // 1. Try to find IP based on priority names
    for (const name of priorityInterfaces) {
        const ifaceList = interfaces[name] || []; // Handle partial matches later if needed
        for (const iface of ifaceList) {
            if (iface.family === 'IPv4' && !iface.internal) {
                localIp = iface.address;
                break;
            }
        }
        if (localIp) break;
    }

    // 2. Fallback: Find any non-internal IPv4 if no priority interface found
    if (!localIp) {
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    localIp = iface.address;
                    break;
                }
            }
            if (localIp) break;
        }
    }

    localIp = localIp || 'localhost';
    console.log(`[SESSION] Selected Local IP: ${localIp}`);

    const port = process.env.PORT || 3000;

    // START RACE CONDITION HANDLING
    // If tunnel is enabled but not yet ready, wait briefly (up to 15 seconds)
    if (process.env.ENABLE_TUNNEL === 'true' && !process.env.PUBLIC_URL) {
        console.log('[SESSION] Waiting for Cloudflare Tunnel URL...');
        for (let i = 0; i < 30; i++) { // 30 * 500ms = 15 seconds
            await new Promise(resolve => setTimeout(resolve, 500));
            if (process.env.PUBLIC_URL) {
                console.log('[SESSION] Tunnel URL acquired!');
                break;
            }
        }
    }
    // END RACE CONDITION HANDLING

    // Determine Base URL
    // CRITICAL: If tunnel is enabled, we MUST use the public URL for the QR code
    // regardless of whether we are on the same network or not, to avoid confusion.
    let baseUrl;
    if (process.env.PUBLIC_URL) {
        baseUrl = process.env.PUBLIC_URL;
    } else if (localIp && localIp !== 'localhost' && !localIp.startsWith('127.')) {
        baseUrl = `http://${localIp}:${port}`;
    } else {
        baseUrl = `http://localhost:${port}`;
    }

    console.log(`[SESSION] Generated Base URL: ${baseUrl}`);
    console.log(`[SESSION] Tunnel Password Env: ${process.env.TUNNEL_PASSWORD}`);

    const uploadUrl = `${baseUrl}/upload.html?session=${sessionToken}`;

    const stmt = db.prepare('INSERT INTO sessions (session_token, status, expires_at) VALUES (?, ?, ?)');
    stmt.run(sessionToken, 'active', expiresAt, async function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        try {
            const qrCodeData = await QRCode.toDataURL(uploadUrl);
            
            // Update session with QR code data URL if needed, or just return it
            db.run('UPDATE sessions SET qr_code_data = ? WHERE id = ?', [qrCodeData, this.lastID]);
            
            res.json({
                sessionId: this.lastID,
                sessionToken: sessionToken,
                qrCode: qrCodeData,
                uploadUrl: uploadUrl,
                expiresAt: expiresAt
            });
        } catch (qrErr) {
            res.status(500).json({ error: 'QR Generation failed' });
        }
    });
    stmt.finalize();
};

// Check session status (Kiosk polling)
exports.checkSessionStatus = (req, res) => {
    const token = req.params.token;
    
    db.get('SELECT * FROM sessions WHERE session_token = ?', [token], (err, session) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!session) return res.status(404).json({ error: 'Session not found' });
        
        // Check for documents uploaded exclusively for this session
        db.all('SELECT * FROM documents WHERE session_id = ?', [session.id], (err, docs) => {
            if (err) return res.status(500).json({ error: err.message });
            
            // Scan docs to see if any are uploaded
            const uploadedDocs = docs.filter(d => d.status === 'uploaded' || d.status === 'verified').map(doc => {
                return {
                    ...doc,
                    stored_filename: require('path').basename(doc.file_path)
                };
            });
            
            res.json({
                status: session.status,
                documents: uploadedDocs,
                hasUploads: uploadedDocs.length > 0
            });
        });
    });
};
// Create Session from Prepared File (Quick Print)
exports.createSessionFromPreparedFile = (req, res) => {
    const { fileId } = req.body;
    
    db.get("SELECT * FROM prepared_files WHERE id = ?", [fileId], (err, file) => {
        if (err || !file) return res.status(404).json({ error: 'File not found' });

        // 1. Create Session
        const sessionToken = uuidv4();
        const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS).toISOString();
        
        const stmt = db.prepare('INSERT INTO sessions (session_token, status, expires_at) VALUES (?, ?, ?)');
        stmt.run(sessionToken, 'active', expiresAt, function(err) {
            if (err) return res.status(500).json({ error: 'Session creation failed' });
            
            const sessionId = this.lastID;
            
            // 2. Link File to Session (Copy entry to documents table)
            // We reuse the same file path to save space
            
            const docStmt = db.prepare('INSERT INTO documents (session_id, filename, file_path, file_type, page_count, status) VALUES (?, ?, ?, ?, ?, ?)');
            docStmt.run(sessionId, file.filename, file.file_path, 'application/pdf', file.page_count, 'verified', function(err) {
                if (err) return res.status(500).json({ error: 'Document linking failed' });
                
                res.json({
                    sessionToken: sessionToken,
                    documentId: this.lastID
                });
            });
            docStmt.finalize();
        });
        stmt.finalize();
    });
};

// Create Session from Scanned File
exports.createSessionFromScan = async (req, res) => {
    const { filename } = req.body;
    
    if (!filename) {
        return res.status(400).json({ error: 'Filename is required' });
    }

    try {
        const scanWatcher = require('../services/scanWatcher');
        
        // 1. Generate Session
        const sessionToken = uuidv4();
        const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS).toISOString();

        // 2. Create DB Entry
        const stmt = db.prepare('INSERT INTO sessions (session_token, status, expires_at) VALUES (?, ?, ?)');
        stmt.run(sessionToken, 'active', expiresAt, async function(err) {
            if (err) {
                console.error('DB Error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            // 3. Process File (Copy from scans to uploads)
            const watchPath = process.env.SCAN_WATCH_PATH || './scans';
            const sourcePath = path.join(watchPath, filename);
            const targetFilename = `${sessionToken}_${filename}`;
            const targetPath = path.join(__dirname, '../../uploads', targetFilename);

            try {
                // Ensure upload directory exists
                const uploadDir = path.dirname(targetPath);
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }

                if (fs.existsSync(sourcePath)) {
                    fs.copyFileSync(sourcePath, targetPath);
                    scanWatcher.clearLatestScan();
                } else {
                     return res.status(404).json({ error: 'Source file not found' });
                }

                // Call fileService to convert if it's an image, and count pages
                const fileService = require('../services/fileService');
                const tempMimeType = path.extname(filename).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
                // Process the copied file
                const { pageCount, newFilePath } = await fileService.processFile(targetPath, tempMimeType);
                
                // All scans are now converted to PDF
                const newMimeType = 'application/pdf';
                const finalFilename = path.basename(newFilePath);

                const docStmt = db.prepare('INSERT INTO documents (session_id, filename, file_path, file_type, status, page_count) VALUES (?, ?, ?, ?, ?, ?)');
                
                docStmt.run(this.lastID, filename, newFilePath, newMimeType, 'uploaded', pageCount, async function(err) {
                    if (err) {
                        console.error('Doc Insert Error:', err);
                        return res.status(500).json({ error: 'Document error' });
                    }
                    
                    if (req.body.autoprint) {
                         try {
                             const printerService = require('../services/printerService');
                             // Pass undefined for printerName so it targets the OS default physically
                             await printerService.printFile(newFilePath, undefined, { copies: 1, scale: 'fit' });
                             console.log(`[SESSION] Auto-printed scan headlessly: ${newFilePath}`);
                             
                             // Optional: we leave the session active if we want, or we can just return success
                             return res.json({ success: true, message: 'Print job successfully spooled to OS.' });
                         } catch (printErr) {
                             console.error('Auto-print exception:', printErr);
                             return res.status(500).json({ error: 'Scanning succeeded but direct print failed: ' + printErr.message });
                         }
                    } else {
                        console.log(`[SESSION] Created from Scan: ${sessionToken}`);
                        res.json({ sessionToken });
                    }
                });
                docStmt.finalize();

            } catch (copyErr) {
                 console.error('File Copy Error:', copyErr);
                 return res.status(500).json({ error: 'File processing error' });
            }
        });
        stmt.finalize();

    } catch (error) {
        console.error('Create Scan Session Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Actively trigger a scan via software and create a session
exports.triggerUiScan = (req, res) => {
    try {
        const { spawn } = require('child_process');
        // Launch Windows Scanner Wizard in the background
        spawn('wiaacmgr.exe', [], { detached: true, stdio: 'ignore' });
        res.json({ success: true, message: 'Scanner UI launched' });
    } catch (error) {
        console.error('Failed to launch scanner UI:', error);
        res.status(500).json({ error: 'Failed to launch scanner interface' });
    }
};

// Actively trigger a scan via software and create a session
exports.triggerScanSession = async (req, res) => {
    try {
        const scannerService = require('../services/scannerService');
        const fileService = require('../services/fileService');

        // 1. Trigger Hardware Scan
        // This will take a few seconds as the scanner warms up and scans
        const scanResult = await scannerService.triggerScan();

        // 2. Generate Session
        const sessionToken = uuidv4();
        const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS).toISOString();

        // 3. Create DB Entry
        const stmt = db.prepare('INSERT INTO sessions (session_token, status, expires_at) VALUES (?, ?, ?)');
        stmt.run(sessionToken, 'active', expiresAt, async function(err) {
            if (err) {
                console.error('DB Error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            const sessionId = this.lastID;
            const targetFilename = `${sessionToken}_${scanResult.filename}`;
            const targetPath = path.join(__dirname, '../../uploads', targetFilename);

            try {
                // Ensure upload directory exists
                const uploadDir = path.dirname(targetPath);
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }

                fs.copyFileSync(scanResult.path, targetPath);

                // Process the copied file
                const tempMimeType = 'image/jpeg';
                const { pageCount, newFilePath } = await fileService.processFile(targetPath, tempMimeType);
                
                const newMimeType = 'application/pdf';
                const finalFilename = path.basename(newFilePath);

                const docStmt = db.prepare('INSERT INTO documents (session_id, filename, file_path, file_type, status, page_count) VALUES (?, ?, ?, ?, ?, ?)');
                
                docStmt.run(sessionId, scanResult.filename, newFilePath, newMimeType, 'uploaded', pageCount, function(err) {
                    if (err) {
                        console.error('Doc Insert Error:', err);
                        return res.status(500).json({ error: 'Document error' });
                    }
                    
                    console.log(`[SESSION] Created from Active Scan Trigger: ${sessionToken}`);
                    res.json({ sessionToken });
                });
                docStmt.finalize();

            } catch (procErr) {
                 console.error('File Processing Error:', procErr);
                 return res.status(500).json({ error: 'File processing error' });
            }
        });
        stmt.finalize();

    } catch (error) {
        console.error('Active Scan Error:', error);
        res.status(500).json({ error: error.message || 'Scanner failed to start' });
    }
};

// Headless scan execution that returns the PDF for browser Print Preview
exports.scanAndReturnDocument = async (req, res) => {
    try {
        const scannerService = require('../services/scannerService');
        const fileService = require('../services/fileService');
        const path = require('path');

        // 1. Trigger Silent Hardware Scan via PowerShell WIA
        const scanResult = await scannerService.triggerScan();

        // 2. Convert raw JPEG to PDF
        const targetPath = scanResult.path;
        console.log(`[DEBUG] Scanning completed. Processing image at: ${targetPath}`);
        
        const tempMimeType = 'image/jpeg';
        const { pageCount, newFilePath } = await fileService.processFile(targetPath, tempMimeType);
        
        const finalFilename = path.basename(newFilePath);
        console.log(`[DEBUG] PDF generated successfully: ${finalFilename}`);

        // 3. Return the generated file path so the frontend can load it into an iframe for print preview
        res.json({ 
            success: true, 
            filename: finalFilename,
            url: `/api/file/${finalFilename}`
        });

    } catch (error) {
        console.error('Scan & Return Error:', error);
        res.status(500).json({ error: error.message || 'Failed to scan document' });
    }
};
