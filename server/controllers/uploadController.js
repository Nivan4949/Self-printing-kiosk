const db = require('../models/db');
const fileService = require('../services/fileService');
const multer = require('multer');
const path = require('path');

// Configure Multer Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Upload Handler
exports.uploadFile = async (req, res) => {
    const sessionToken = req.headers['x-session-token'];
    
    if (!sessionToken) {
        return res.status(401).json({ error: 'Session token required' });
    }

    // Check session validity
    db.get('SELECT id FROM sessions WHERE session_token = ? AND status = ?', [sessionToken, 'active'], async (err, session) => {
        if (err || !session) {
            return res.status(403).json({ error: 'Invalid or expired session' });
        }

        try {
            const file = req.file;
            
            // Validate Logic using service
            fileService.validateFile(file);
            
            // Process File (Convert Images -> PDF, Count Pages)
            const filePath = path.join(__dirname, '../../uploads', file.filename);
            const { pageCount, newFilePath } = await fileService.processFile(filePath, file.mimetype);
            
            // All documents stored and served are now technically PDFs
            const newMimeType = 'application/pdf';
            const finalFilename = path.basename(newFilePath);
            
            // Insert into DB
            const stmt = db.prepare('INSERT INTO documents (session_id, filename, file_path, file_type, page_count, status) VALUES (?, ?, ?, ?, ?, ?)');
            stmt.run(session.id, finalFilename, newFilePath, newMimeType, pageCount, 'uploaded', function(err) {
                if (err) {
                   fileService.deleteFile(newFilePath);
                   return res.status(500).json({ error: 'Database error saving document' });
                }
                
                res.json({
                    documentId: this.lastID,
                    filename: finalFilename,
                    originalName: file.originalname, // helpful for UI
                    pageCount: pageCount,
                    message: 'File uploaded successfully'
                });
            });
            stmt.finalize();

        } catch (error) {
            // Cleanup upload if validation fails
            if (req.file) {
                 fileService.deleteFile(req.file.path);
            }
            res.status(400).json({ error: error.message });
        }
    });
};

exports.multerMiddleware = upload.single('file');

const fs = require('fs');
// Serve Uploaded File
exports.serveFile = (req, res) => {
    const filename = req.params.filename;
    
    // Basic path traversal protection
    if (filename.includes('..') || filename.includes('/')) {
        return res.status(400).send('Invalid filename');
    }

    // Safely look up the exact physical file path from the database
    db.get('SELECT file_path FROM documents WHERE filename = ? OR file_path LIKE ?', [filename, `%${filename}`], (err, doc) => {
        let filePath;
        
        if (doc && doc.file_path && fs.existsSync(doc.file_path)) {
            filePath = doc.file_path;
        } else {
            // Fallback for older legacy files or direct matches
            filePath = path.join(__dirname, '../../uploads', filename);
        }
        
        if (filePath && fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/pdf'); // We serve everything as PDF now
            fs.createReadStream(filePath).pipe(res);
        } else {
            res.status(404).send('File not found');
        }
    });
};
