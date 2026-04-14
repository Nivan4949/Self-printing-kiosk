const http = require('http');

const endpoints = [
  '/api/config',
  '/api/session/123/status',
  '/api/printers'
];

endpoints.forEach(path => {
  http.get('http://localhost:3000' + path, res => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      console.log(`\n--- Response for ${path} ---`);
      console.log(`Status: ${res.statusCode}`);
      console.log(`Headers:`, res.headers['content-type']);
      console.log(`Body (first 100 chars):`, data.substring(0, 100).replace(/\n/g, '\\n'));
    });
  }).on('error', err => {
    console.error(`Error fetching ${path}:`, err.message);
  });
});
