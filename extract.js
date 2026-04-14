const fs = require('fs');
try {
  const log = fs.readFileSync('e2e.log', 'utf16le');
  const start = log.indexOf('<pre>');
  const end = log.indexOf('</pre>');
  if(start > -1 && end > -1) {
    console.log(log.substring(start + 5, end));
  } else {
    console.log(log.replace(/\0/g, ''));
  }
} catch(e) {}
