const fs = require('fs');
const http = require('http');
const path = require('path');

const SCAN_DIR = './scans';
const TEST_FILE = 'test_scan_doc.pdf';

(async () => {
    // 1. Create Scan File (Clean up first)
    if (!fs.existsSync(SCAN_DIR)) fs.mkdirSync(SCAN_DIR);
    const filePath = path.join(SCAN_DIR, TEST_FILE);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Removed existing test file');
        // Wait briefly to ensure events settle
        await new Promise(r => setTimeout(r, 1000));
    }

    console.log('Creating dummy scan file...');
    fs.writeFileSync(filePath, 'dummy pdf content');

    // 2. Poll API
    setTimeout(() => {
        console.log('Polling /api/scans/latest...');
        http.get('http://127.0.0.1:3000/api/scans/latest', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('API Response:', data);
                
                try {
                    const json = JSON.parse(data);
                    if (json.scan && json.scan.filename === TEST_FILE) {
                        console.log('SUCCESS: Scan detected!');
                    } else {
                        console.log('FAILURE: Scan not detected or wrong file.');
                    }
                } catch (e) {
                    console.log('FAILURE: Invalid JSON');
                }
            });
        }).on('error', (err) => {
            console.error('Request Error:', err.message);
        });
    }, 2000);
})();
