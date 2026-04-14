const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const isVercel = process.env.VERCEL === '1';
let dbPath = process.env.DB_PATH || path.join(__dirname, '../../database/kiosk.sqlite');

if (isVercel) {
    // Vercel has a read-only filesystem, except for /tmp
    dbPath = '/tmp/kiosk.sqlite';
    console.log('[DB] Running on Vercel, using /tmp for database');
}

// Ensure database directory exists (if not on Vercel)
if (!isVercel) {
    const dbDir = path.dirname(dbPath);
    try {
        if (!fs.existsSync(dbDir)){
            fs.mkdirSync(dbDir, { recursive: true });
        }
    } catch (err) {
        console.error('[DB] Failed to create database directory:', err.message);
    }
}

let db;

try {
    const sqlite3 = require('sqlite3').verbose();
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('[DB ERROR] Error opening database:', err.message);
            // On Vercel, if DB fails, we still want the server to stay alive for health checks
            if (isVercel) {
                console.warn('[DB] Falling back to Mock DB mode due to connection error.');
                db = createMockDb(err.message);
            }
        } else {
            console.log('Connected to the SQLite database.');
            initSchema();
        }
    });
} catch (loadErr) {
    console.error('[DB FATAL] Failed to load sqlite3 module:', loadErr.message);
    if (isVercel) {
        db = createMockDb(loadErr.message);
    } else {
        throw loadErr;
    }
}

function createMockDb(errorMsg) {
    console.error('[DB MOCK] Database is disabled. Reason:', errorMsg);
    return {
        run: (sql, params, cb) => { if (typeof params === 'function') params(null); else if (cb) cb(null); },
        get: (sql, params, cb) => { if (typeof params === 'function') params(null, null); else if (cb) cb(null, null); },
        all: (sql, params, cb) => { if (typeof params === 'function') params(null, []); else if (cb) cb(null, []); },
        prepare: () => ({ run: (p, cb) => { if (cb) cb(null); }, finalize: () => {} }),
        serialize: (cb) => cb()
    };
}

function initSchema() {
    db.serialize(() => {
        // Users Table (Admin)
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'admin',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Sessions Table (QR Code Login)
        db.run(`CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_token TEXT UNIQUE NOT NULL,
            qr_code_data TEXT,
            status TEXT DEFAULT 'active', -- active, expired
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME
        )`);

        // Documents Table
        db.run(`CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_type TEXT,
            page_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'uploaded', -- uploaded, verified, printed, error
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(session_id) REFERENCES sessions(id)
        )`);
        
        // Print Jobs Table
        db.run(`CREATE TABLE IF NOT EXISTS print_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER,
            printer_name TEXT,
            status TEXT DEFAULT 'queued', -- queued, printing, completed, failed
            cost REAL DEFAULT 0,
            options TEXT, -- JSON string of print options
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(document_id) REFERENCES documents(id)
        )`);

        // Config Table
        db.run(`CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT
        )`, (err) => {
            if (!err) {
                // Insert default config if empty
                db.run(`INSERT OR IGNORE INTO config (key, value) VALUES ('price_bw', '5'), ('price_color', '15')`);
                console.log('Config table ready.');
            }
        });

        // Prepared Files Table
        db.run(`CREATE TABLE IF NOT EXISTS prepared_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT,
            file_path TEXT,
            page_count INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Insert Default Admin (Password: admin) - HASH IN REAL APP
        // For prototype, storing plain text temporarily or simple hash logic in auth service
        // We will implement bcrypt later.
        db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
            if (!row) {
                // Placeholder hash for 'admin'
                db.run(`INSERT INTO users (username, password_hash) VALUES ('admin', '$2b$10$PlaceholderHashForAdmin')`); 
            }
        });
        
        console.log('Database schema initialized.');
    });
}

module.exports = db;
