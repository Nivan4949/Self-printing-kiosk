const http = require('http');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data'); // Ensure this is installed

const BASE_URL = 'http://localhost:3000/api';

async function request(method, endpoint, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + endpoint);
        const options = {
            method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            headers: { ...headers }
        };

        let reqBody = '';
        if (body) {
            if (body instanceof FormData) {
                Object.assign(options.headers, body.getHeaders());
                reqBody = body;
            } else {
                reqBody = JSON.stringify(body);
                options.headers['Content-Type'] = 'application/json';
                options.headers['Content-Length'] = Buffer.byteLength(reqBody);
            }
        }

        const req = http.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : null;
                    resolve({ status: res.statusCode, data: parsed, raw: data });
                } catch (e) {
                    resolve({ status: res.statusCode, data: null, raw: data });
                }
            });
        });

        req.on('error', err => reject(err));

        if (body instanceof FormData) {
            body.pipe(req);
        } else if (reqBody) {
            req.write(reqBody);
            req.end();
        } else {
            req.end();
        }
    });
}

async function runTests() {
    console.log("=== STARTING E2E API TESTS ===");
    let sessionToken = '';

    // 1. Test Session Creation
    console.log("\n1. Testing Session Creation...");
    const sessionRes = await request('POST', '/session/create');
    console.log(`Status: ${sessionRes.status}`);
    if (sessionRes.status !== 200 || !sessionRes.data.sessionToken) {
        console.error("FAIL: Could not create session.", sessionRes.raw);
        return;
    }
    sessionToken = sessionRes.data.sessionToken;
    console.log(`Success! Token: ${sessionToken}`);

    // 2. Test File Upload (Mobile Flow)
    console.log("\n2. Testing File Upload...");
    const testFilePath = path.join(__dirname, 'test_upload.jpg');
    // Using a valid extension
    fs.writeFileSync(testFilePath, 'dummy data');

    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath));

    const uploadRes = await request('POST', '/upload', form, { 'x-session-token': sessionToken });
    console.log(`Status: ${uploadRes.status}`);
    if (uploadRes.status !== 200) {
        console.error("FAIL: Upload failed.", uploadRes.raw);
        // Continue anyway to test other flows
    } else {
        console.log("Success! Upload message:", uploadRes.data);
    }

    // 3. Test Session Status Details
    console.log("\n3. Testing Session Status...");
    const statusRes = await request('GET', `/session/${sessionToken}/status`);
    console.log(`Status: ${statusRes.status}`);
    if (statusRes.status !== 200) {
        console.error("FAIL: Status check failed.", statusRes.raw);
    } else {
        console.log("Success! Status:", statusRes.data.status, "HasUploads:", statusRes.data.hasUploads);
        
        // 4. Test Print Submission
        if (statusRes.data.documents && statusRes.data.documents.length > 0) {
            console.log("\n4. Testing Print Submission...");
            const docId = statusRes.data.documents[0].id;
            
            // Get mock printer
            const printerRes = await request('GET', '/printers');
            const printerName = printerRes.data.printers[0].name || 'Mock_Printer_BW';

            const printReq = {
                documentId: docId,
                printerName: printerName,
                options: { copies: 1, duplex: true, color: false, range: '' }
            };

            const printRes = await request('POST', '/print', printReq, { 'x-session-token': sessionToken });
            console.log(`Status: ${printRes.status}`);
            if (printRes.status !== 200) {
                console.error("FAIL: Print submission failed.", printRes.raw);
            } else {
                console.log("Success! Print job:", printRes.data);
            }
        } else {
            console.log("Skipping Print test because upload failed to register in session status.");
        }
    }

    // 5. Test Scan Setup
    console.log("\n5. Testing Scanner API...");
    const scanClear = await request('POST', '/scans/clear');
    console.log(`Status /clear: ${scanClear.status}`);
    const scanLatest = await request('GET', '/scans/latest');
    console.log(`Status /latest: ${scanLatest.status}`);
    if (scanClear.status === 200 && scanLatest.status === 200) {
         console.log("Success! Scanner API operational.");
    } else {
         console.error("FAIL: Scanner API error.");
    }
    
    // 6. Test Public Config
    console.log("\n6. Testing Public Config...");
    const configRes = await request('GET', '/config');
    console.log(`Status: ${configRes.status}`);
    if (configRes.status === 200) {
         console.log("Success! Config:", configRes.data);
    } else {
         console.error("FAIL: Config API error.", configRes.raw);
    }

    console.log("\n=== TESTING COMPLETE ===");
    try { fs.unlinkSync(testFilePath); } catch(e){}
}

runTests();
