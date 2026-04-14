const db = require('../models/db');

// Get Dashboard Stats
exports.getStats = (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Use parallel queries for better performance
    const queries = {
        totalPrints: "SELECT COUNT(*) as count FROM print_jobs WHERE status = 'completed'",
        todayPrints: `SELECT COUNT(*) as count FROM print_jobs WHERE status = 'completed' AND timestamp LIKE '${today}%'`,
        revenue: "SELECT SUM(cost) as total FROM print_jobs WHERE status = 'completed'",
        failedJobs: "SELECT COUNT(*) as count FROM print_jobs WHERE status = 'failed'",
        activeSessions: "SELECT COUNT(*) as count FROM sessions WHERE status = 'active'"
    };

    const results = {};
    let pending = Object.keys(queries).length;

    Object.keys(queries).forEach(key => {
        db.get(queries[key], (err, row) => {
            if (err) console.error(err);
            results[key] = row ? row.count || row.total || 0 : 0;
            pending--;
            
            if (pending === 0) {
                res.json(results);
            }
        });
    });
};

// Get Config (Pricing)
exports.getConfig = (req, res) => {
    db.all("SELECT * FROM config", (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        
        const config = {};
        rows.forEach(row => config[row.key] = row.value);
        
        // Return defaults if not set
        if (!config.price_bw) config.price_bw = '5';
        if (!config.price_color) config.price_color = '15';
        
        res.json(config);
    });
};

// Get Public Config (Pricing only)
exports.getPublicConfig = (req, res) => {
    db.all("SELECT * FROM config", (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        
        const config = {};
        rows.forEach(row => {
            if (['price_bw', 'price_color'].includes(row.key)) {
                config[row.key] = row.value;
            }
        });
        
        // Defaults
        if (!config.price_bw) config.price_bw = '5';
        if (!config.price_color) config.price_color = '15';
        
        res.json(config);
    });
};

// Update Config
exports.updateConfig = (req, res) => {
    const { price_bw, price_color } = req.body;
    
    db.serialize(() => {
        const stmt = db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)");
        if (price_bw) stmt.run('price_bw', price_bw);
        if (price_color) stmt.run('price_color', price_color);
        stmt.finalize();
        
        res.json({ message: 'Configuration updated' });
    });
};

// Get Recent Jobs
exports.getRecentJobs = (req, res) => {
    db.all("SELECT * FROM print_jobs ORDER BY timestamp DESC LIMIT 20", (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json(rows);
    });
};
// Prepared Files Management
exports.getPreparedFiles = (req, res) => {
    db.all("SELECT * FROM prepared_files ORDER BY created_at DESC", (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json(rows);
    });
};

exports.deletePreparedFile = (req, res) => {
    const id = req.params.id;
    db.get("SELECT file_path FROM prepared_files WHERE id = ?", [id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'File not found' });
        
        // Delete actual file
        const fs = require('fs');
        if (fs.existsSync(row.file_path)) {
            try { fs.unlinkSync(row.file_path); } catch(e) {}
        }
        
        db.run("DELETE FROM prepared_files WHERE id = ?", [id], (err) => {
            if (err) return res.status(500).json({ error: 'DB Error' });
            res.json({ message: 'File deleted' });
        });
    });
};

exports.uploadPreparedFile = async (req, res) => {
    try {
        const file = req.file;
        const fileService = require('../services/fileService');
        
        // Validate
        fileService.validateFile(file);
        
        // Process
        const path = require('path');
        const filePath = path.join(__dirname, '../../uploads', file.filename);
        const { pageCount, newFilePath } = await fileService.processFile(filePath, file.mimetype);
        
        const isPdf = newFilePath.endsWith('.pdf');
        let finalOriginalName = file.originalname;
        if (isPdf && !file.originalname.toLowerCase().endsWith('.pdf')) {
            const parsed = path.parse(file.originalname);
            finalOriginalName = parsed.name + '.pdf';
        }

        // Save to DB
        const stmt = db.prepare("INSERT INTO prepared_files (filename, file_path, page_count) VALUES (?, ?, ?)");
        stmt.run(finalOriginalName, newFilePath, pageCount, function(err) {
            if (err) return res.status(500).json({ error: 'DB Error' });
            res.json({ message: 'File uploaded', id: this.lastID });
        });
        stmt.finalize();

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
