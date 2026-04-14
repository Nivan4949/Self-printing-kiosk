const scannerService = require('./server/services/scannerService');
const fileService = require('./server/services/fileService');

async function testHeadless() {
    try {
        console.log('Triggering hardware scan...');
        const scanResult = await scannerService.triggerScan();
        console.log('Scan path:', scanResult.path);
        
        console.log('Processing via fileService...');
        const targetPath = scanResult.path;
        const tempMimeType = 'image/jpeg';
        
        const { pageCount, newFilePath } = await fileService.processFile(targetPath, tempMimeType);
        console.log('Processed PDF:', newFilePath, pageCount);
        
    } catch (e) {
        console.error('Test Failed:', e);
    }
}

testHeadless();
