const http = require('http');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const BASE_URL = 'http://localhost:3000/api';

async function run() {
    try {
        const sessionRes = await fetch(BASE_URL + '/session/create', { method: 'POST' });
        const sessionData = await sessionRes.json();
        const token = sessionData.sessionToken;
        
        console.log('Session:', token);
        
        const testFilePath = path.join(__dirname, 'test_upload.txt');
        fs.writeFileSync(testFilePath, 'Hello World!');

        const form = new FormData();
        form.append('file', fs.createReadStream(testFilePath)); // <-- Form field must match multer's "upload.single('file')"

        const options = {
            method: 'POST',
            host: 'localhost',
            port: 3000,
            path: '/api/upload',
            headers: {
                ...form.getHeaders(),
                'x-session-token': token
            }
        };

        const req = http.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('Upload Status:', res.statusCode);
                console.log('Upload Data:', data);
            });
        });

        form.pipe(req);
    } catch(e) {
        console.error(e);
    }
}
run();
