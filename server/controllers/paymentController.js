const Razorpay = require('razorpay');
const crypto = require('crypto');
const db = require('../models/db');
const printerService = require('../services/printerService');

let razorpayInstance = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpayInstance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
}

// Helper to parse page range (same as frontend)
function parsePageRange(rangeStr, maxPages) {
    if (!rangeStr || rangeStr.trim() === '') return maxPages;
    const parts = rangeStr.split(',').map(p => p.trim());
    const uniquePages = new Set();
    parts.forEach(part => {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(num => parseInt(num));
            if (!isNaN(start) && !isNaN(end) && start <= end) {
                for (let i = start; i <= end; i++) {
                    if (i >= 1 && i <= maxPages) uniquePages.add(i);
                }
            }
        } else {
            const page = parseInt(part);
            if (!isNaN(page) && page >= 1 && page <= maxPages) uniquePages.add(page);
        }
    });
    return uniquePages.size > 0 ? uniquePages.size : maxPages;
}

exports.createOrder = async (req, res) => {
    const sessionToken = req.headers['x-session-token'];
    const { documentId, printerName, options } = req.body;

    if (!sessionToken || !documentId || !printerName) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!razorpayInstance) {
        console.warn('Razorpay not configured. Returning fallback response for testing mode only.');
        // For local development fallback if keys are missing
        if (process.env.NODE_ENV !== 'production') {
             // Create mock job
             return createMockOrder(res, documentId, printerName, options, sessionToken);
        }
        return res.status(500).json({ error: 'Payment gateway not configured' });
    }

    db.get(`
        SELECT s.id, d.file_path, d.status, d.page_count
        FROM sessions s 
        JOIN documents d ON s.id = d.session_id 
        WHERE s.session_token = ? AND d.id = ? AND s.status = 'active'
    `, [sessionToken, documentId], async (err, row) => {
        if (err || !row) return res.status(403).json({ error: 'Invalid session or document' });

        // Calculate Cost
        db.all("SELECT * FROM config", async (err, configRows) => {
            const config = {};
            configRows.forEach(r => config[r.key] = r.value);
            const priceBw = parseFloat(config.price_bw || 5);
            const priceColor = parseFloat(config.price_color || 15);

            const effectivePages = parsePageRange(options.range, row.page_count);
            
            // Apply "Per Sheet" logic if duplex
            const billableUnits = options.duplex ? Math.ceil(effectivePages / 2) : effectivePages;
            
            const price = options.color ? priceColor : priceBw;
            const totalCost = billableUnits * price * (options.copies || 1);
            
            const amountInPaise = Math.round(totalCost * 100);

            try {
                const order = await razorpayInstance.orders.create({
                    amount: amountInPaise,
                    currency: "INR",
                    receipt: `receipt_doc_${documentId}`
                });

                const stmt = db.prepare('INSERT INTO print_jobs (document_id, printer_name, status, options, cost, amount, razorpay_order_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
                stmt.run(documentId, printerName, 'PENDING_PAYMENT', JSON.stringify(options), totalCost, totalCost, order.id, function(err) {
                    if (err) return res.status(500).json({ error: 'Database error' });
                    
                    const jobId = this.lastID;
                    res.json({
                        success: true,
                        key: process.env.RAZORPAY_KEY_ID,
                        orderId: order.id,
                        amount: amountInPaise,
                        currency: "INR",
                        jobId: jobId
                    });
                });
                stmt.finalize();
            } catch (err) {
                console.error("Razorpay order creation failed:", err);
                return res.status(500).json({ 
                    error: 'Failed to create payment order',
                    details: err.error ? err.error.description : err.message || JSON.stringify(err)
                });
            }
        });
    });
};

function createMockOrder(res, documentId, printerName, options, sessionToken) {
    db.get(`
        SELECT s.id, d.file_path, d.status, d.page_count
        FROM sessions s 
        JOIN documents d ON s.id = d.session_id 
        WHERE s.session_token = ? AND d.id = ? AND s.status = 'active'
    `, [sessionToken, documentId], async (err, row) => {
        if (err || !row) return res.status(403).json({ error: 'Invalid session or document' });

        db.all("SELECT * FROM config", async (err, configRows) => {
            const config = {};
            configRows.forEach(r => config[r.key] = r.value);
            const priceBw = parseFloat(config.price_bw || 5);
            const priceColor = parseFloat(config.price_color || 15);
            const effectivePages = parsePageRange(options.range, row.page_count);
            const billableUnits = options.duplex ? Math.ceil(effectivePages / 2) : effectivePages;
            const price = options.color ? priceColor : priceBw;
            const totalCost = billableUnits * price * (options.copies || 1);
            const amountInPaise = Math.round(totalCost * 100);

            const mockOrderId = "order_mock_" + Date.now();

            const stmt = db.prepare('INSERT INTO print_jobs (document_id, printer_name, status, options, cost, amount, razorpay_order_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
            stmt.run(documentId, printerName, 'PENDING_PAYMENT', JSON.stringify(options), totalCost, totalCost, mockOrderId, function(err) {
                if (err) return res.status(500).json({ error: 'Database error' });
                
                res.json({
                    success: true,
                    key: 'rzp_test_mock_key',
                    orderId: mockOrderId,
                    amount: amountInPaise,
                    currency: "INR",
                    jobId: this.lastID
                });
            });
            stmt.finalize();
        });
    });
}

exports.verifyPayment = async (req, res) => {
    const { jobId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!jobId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ error: 'Missing payment details' });
    }

    if (!razorpayInstance && process.env.NODE_ENV !== 'production' && razorpay_order_id.startsWith('order_mock_')) {
        // Mock verification
        db.run("UPDATE print_jobs SET status = 'PAID', razorpay_payment_id = ? WHERE id = ? AND razorpay_order_id = ? AND status IN ('PENDING_PAYMENT', 'PAYMENT_FAILED')", 
            [razorpay_payment_id, jobId, razorpay_order_id], function(err) {
            if (err) return res.status(400).json({ error: 'Database error' });
            return res.json({ success: true, message: 'Payment verified successfully (mock)' });
        });
        return;
    }

    try {
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature === razorpay_signature) {
            db.run("UPDATE print_jobs SET status = 'PAID', razorpay_payment_id = ? WHERE id = ? AND razorpay_order_id = ? AND status IN ('PENDING_PAYMENT', 'PAYMENT_FAILED')", 
                [razorpay_payment_id, jobId, razorpay_order_id], function(err) {
                if (err) {
                    return res.status(400).json({ error: 'Failed to update job status or invalid job ID' });
                }
                return res.json({ success: true, message: 'Payment verified successfully' });
            });
        } else {
            db.run("UPDATE print_jobs SET status = 'PAYMENT_FAILED' WHERE id = ? AND razorpay_order_id = ?", 
                [jobId, razorpay_order_id]);
            return res.status(400).json({ error: 'Invalid payment signature' });
        }
    } catch (error) {
        console.error("Signature verification failed:", error);
        res.status(500).json({ error: 'Verification failed' });
    }
};

exports.webhook = async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    // Validate webhook signature
    const signature = req.headers['x-razorpay-signature'];
    
    try {
        const expectedSignature = crypto.createHmac('sha256', secret)
                                      .update(JSON.stringify(req.body))
                                      .digest('hex');
                                      
        if (signature !== expectedSignature) {
            return res.status(400).send('Invalid signature');
        }
        
        const event = req.body.event;
        const paymentEntity = req.body.payload.payment.entity;
        const orderId = paymentEntity.order_id;
        const paymentId = paymentEntity.id;
        
        if (event === 'payment.captured') {
            db.run("UPDATE print_jobs SET status = 'PAID', razorpay_payment_id = ? WHERE razorpay_order_id = ? AND status = 'PENDING_PAYMENT'",
                [paymentId, orderId]);
        } else if (event === 'payment.failed') {
            db.run("UPDATE print_jobs SET status = 'PAYMENT_FAILED', razorpay_payment_id = ? WHERE razorpay_order_id = ? AND status = 'PENDING_PAYMENT'",
                [paymentId, orderId]);
        }
        
        res.status(200).send('Webhook processed');
    } catch (err) {
        console.error('Webhook processing failed:', err);
        res.status(500).send('Webhook error');
    }
};
