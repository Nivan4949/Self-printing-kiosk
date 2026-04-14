const db = require('../models/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Admin Login
exports.login = (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check Password
        // For prototype, if using placeholder hash, direct compare (not secure but practical if bcrypt wasn't used for init)
        // Correct implementation:
        try {
            const match = await bcrypt.compare(password, user.password_hash);
            
            // Handle successful bcrypt match first
            if (match) {
                const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
                return res.json({ token, username: user.username });
            }
            
            // Fallback for placeholder hash (dev only)
            if (user.password_hash === '$2b$10$PlaceholderHashForAdmin' && password === 'admin') {
                const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
                return res.json({ token, username: user.username });
            }
            
            // If neither matched
            return res.status(401).json({ error: 'Invalid credentials' });
            
        } catch (error) {
            res.status(500).json({ error: 'Auth failed' });
        }
    });
};

// Admin Middleware
exports.authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden' });
        req.user = user;
        next();
    });
};

// Change Password
exports.changePassword = async (req, res) => {
    const { newPassword } = req.body;
    const userId = req.user.id;
    
    if (!newPassword || newPassword.length < 5) {
        return res.status(400).json({ error: 'Password must be at least 5 characters' });
    }

    try {
        const hash = await bcrypt.hash(newPassword, 10);
        
        db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId], (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ message: 'Password updated successfully' });
        });
    } catch (error) {
        res.status(500).json({ error: 'Encryption failed' });
    }
};
