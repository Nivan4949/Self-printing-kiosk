const db = require('../models/db');
const printerService = require('../services/printerService');

// Get available printers
exports.getPrinters = async (req, res) => {
    try {
        const printers = await printerService.getPrinters();
        res.json({ printers });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch printers' });
    }
};

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

// Submit Print Job
exports.submitPrintJob = async (req, res) => {
    const sessionToken = req.headers['x-session-token'];
    const { documentId, printerName, options } = req.body;

    if (!sessionToken || !documentId || !printerName) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    db.get(`
        SELECT s.id, d.file_path, d.status, d.page_count
        FROM sessions s 
        JOIN documents d ON s.id = d.session_id 
        WHERE s.session_token = ? AND d.id = ? AND s.status = 'active'
    `, [sessionToken, documentId], async (err, row) => {
        if (err || !row) return res.status(403).json({ error: 'Invalid session or document' });

        // Calculate Cost
        db.all("SELECT * FROM config", (err, configRows) => {
            const config = {};
            configRows.forEach(r => config[r.key] = r.value);
            const priceBw = parseFloat(config.price_bw || 5);
            const priceColor = parseFloat(config.price_color || 15);

            const effectivePages = parsePageRange(options.range, row.page_count);
            
            // Apply "Per Sheet" logic if duplex
            const billableUnits = options.duplex ? Math.ceil(effectivePages / 2) : effectivePages;
            
            const price = options.color ? priceColor : priceBw;
            const totalCost = billableUnits * price * (options.copies || 1);

            const stmt = db.prepare('INSERT INTO print_jobs (document_id, printer_name, status, options, cost) VALUES (?, ?, ?, ?, ?)');
            stmt.run(documentId, printerName, 'queued', JSON.stringify(options), totalCost, async function(err) {
                 if (err) return res.status(500).json({ error: 'Database error' });
                 
                 const jobId = this.lastID;
                 
                 try {
                     await printerService.printFile(row.file_path, printerName, options);
                     db.run("UPDATE print_jobs SET status = 'completed' WHERE id = ?", [jobId]);
                     db.run("UPDATE documents SET status = 'printed' WHERE id = ?", [documentId]);
                     res.json({ message: 'Print job submitted', jobId: jobId, cost: totalCost });
                 } catch (printErr) {
                     console.error(printErr);
                     db.run("UPDATE print_jobs SET status = 'failed' WHERE id = ?", [jobId]);
                     res.status(500).json({ error: 'Printing failed: ' + printErr.message });
                 }
            });
            stmt.finalize();
        });
    });
};

// Start Print Job after payment
exports.startPrintJob = async (req, res) => {
    const { jobId } = req.params;

    if (!jobId) {
        return res.status(400).json({ error: 'Missing jobId' });
    }

    db.get(`
        SELECT p.id, p.status, p.options, p.printer_name, d.file_path, d.id as documentId
        FROM print_jobs p
        JOIN documents d ON p.document_id = d.id
        WHERE p.id = ?
    `, [jobId], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Job not found' });

        if (row.status !== 'PAID') {
            return res.status(400).json({ error: 'Payment required before printing' });
        }

        db.run("UPDATE print_jobs SET status = 'PRINTING' WHERE id = ?", [jobId], async function(err) {
            if (err) return res.status(500).json({ error: 'Failed to update job status' });

            try {
                let options = {};
                if (row.options) {
                    try {
                        options = JSON.parse(row.options);
                    } catch (e) {
                        console.warn("Failed to parse print options");
                    }
                }
                
                await printerService.printFile(row.file_path, row.printer_name, options);
                
                db.run("UPDATE print_jobs SET status = 'PRINTED' WHERE id = ?", [jobId]);
                db.run("UPDATE documents SET status = 'printed' WHERE id = ?", [row.documentId]);
                res.json({ success: true, message: 'Print job completed successfully' });
            } catch (printErr) {
                console.error(printErr);
                db.run("UPDATE print_jobs SET status = 'PAYMENT_FAILED' WHERE id = ?", [jobId]); // Could also be failed
                res.status(500).json({ error: 'Printing failed: ' + printErr.message });
            }
        });
    });
};

