const express = require('express');
const router = express.Router();
console.log('[DEBUG] API Router Initialized');

const sessionController = require('../controllers/sessionController');
const uploadController = require('../controllers/uploadController');
const printController = require('../controllers/printController');
const authController = require('../controllers/authController');
const adminController = require('../controllers/adminController');
const paymentController = require('../controllers/paymentController');
const scanWatcher = require('../services/scanWatcher');
const printerService = require('../services/printerService');

// ✅ Test Print Route
router.get("/test-print", async (req, res) => {
    console.log('[DEBUG] /api/test-print HIT');
    const filePath = "C:/Users/Nivan/Desktop/sample.pdf"; // Make sure the file exists

    try {
        await printerService.printFile(filePath, {
            printer: "Microsoft Print to PDF"
        });
        res.json({ message: "Print triggered successfully" });
    } catch (err) {
        console.error('[ERROR] Print failed:', err);
        res.status(500).json({ error: "Print failed" });
    }
});

// Session Routes
router.post('/session/create', sessionController.createSession);
router.get('/session/:token/status', sessionController.checkSessionStatus);
router.post('/session/quick-print', sessionController.createSessionFromPreparedFile);
router.post('/session/create-from-scan', sessionController.createSessionFromScan);

// Scanner Active Trigger Route
router.post('/scan/trigger', sessionController.triggerScanSession);
router.post('/scan/trigger-ui', sessionController.triggerUiScan);
router.post('/scan/headless-print', sessionController.scanAndReturnDocument);

// File Upload Routes
router.post('/upload', uploadController.multerMiddleware, uploadController.uploadFile);
router.get('/file/:filename', uploadController.serveFile);

// Printer Routes
router.get('/printers', printController.getPrinters);
router.post('/print', printController.submitPrintJob); // Legacy/unprotected
router.post('/print/start/:jobId', printController.startPrintJob); // Protected

// Payment Routes
router.post('/payment/create-order', paymentController.createOrder);
router.post('/payment/verify', paymentController.verifyPayment);
router.post('/payment/webhook', paymentController.webhook);

// Admin Routes
router.post('/admin/login', authController.login);
router.post('/admin/change-password', authController.authenticateAdmin, authController.changePassword);
router.get('/admin/stats', authController.authenticateAdmin, adminController.getStats);
router.get('/admin/config', authController.authenticateAdmin, adminController.getConfig);
router.post('/admin/config', authController.authenticateAdmin, adminController.updateConfig);
router.get('/admin/jobs', authController.authenticateAdmin, adminController.getRecentJobs);

// Prepared Files Routes
router.get('/admin/prepared-files', authController.authenticateAdmin, adminController.getPreparedFiles);
router.post('/admin/prepared-files', authController.authenticateAdmin, uploadController.multerMiddleware, adminController.uploadPreparedFile);
router.delete('/admin/prepared-files/:id', authController.authenticateAdmin, adminController.deletePreparedFile);

// Public Routes
router.get('/prepared-files', (req, res) => {
    const db = require('../models/db');
    db.all("SELECT id, filename, page_count FROM prepared_files ORDER BY created_at DESC", (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json(rows);
    });
});

router.get('/scans/latest', (req, res) => {
    const scan = scanWatcher.getLatestScan();
    res.json({ scan });
});

router.post('/scans/clear', (req, res) => {
    scanWatcher.clearLatestScan();
    res.json({ success: true, message: 'Scan state cleared' });
});

router.get('/config', adminController.getPublicConfig);

module.exports = router;