const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const isWindows = os.platform() === 'win32';

exports.triggerScan = async () => {
    return new Promise(async (resolve, reject) => {
        if (!isWindows) {
            return reject(new Error('Scanning is only supported on Windows.'));
        }

        const scanTempDir = path.join(__dirname, '../../scans');
        if (!fs.existsSync(scanTempDir)) {
            fs.mkdirSync(scanTempDir, { recursive: true });
        }

        const filename = `scan-${uuidv4()}.jpg`;
        const outputPath = path.join(scanTempDir, filename);
        
        // Force-kill any open scanner dialogs or stuck TWAIN driver hosts that lock the COM object
        try {
            require('child_process').execSync('taskkill /IM wiaacmgr.exe /F 2>nul');
            require('child_process').execSync('taskkill /IM naps2.console.exe /F 2>nul');
        } catch (e) {
            // It just means process wasn't found, which is fine
        }

        const scriptPath = path.join(__dirname, 'wiaScan.ps1');
        const cmd = `powershell.exe -ExecutionPolicy Bypass -NoProfile -File "${scriptPath}" -OutputPath "${outputPath}"`;
        console.log(`[SCANNER] Executing Headless WIA Scan: ${cmd}`);

        exec(cmd, (error, stdout, stderr) => {
            const output = stdout.toString() + stderr.toString();
            console.log('[SCANNER VERBOSE]', output);
            
            if (error || !fs.existsSync(outputPath)) {
                console.error('[SCAN ERROR]', output || error?.message);
                
                let errorMsg = output || error?.message || 'Failed to trigger scanner.';
                if (errorMsg.includes('busy') || errorMsg.includes('0x80210006')) {
                     errorMsg = 'Scanner is currently busy. Please wait a moment and try again.';
                } else if (errorMsg.includes('No scanner found')) {
                     errorMsg = 'No scanner detected. Please ensure your EPSON scanner is powered on.';
                }
                
                return reject(new Error(errorMsg));
            }

            console.log(`[SCANNER] Headless WIA Scan Complete. Saved to ${outputPath}`);
            resolve({ filename, path: outputPath });
        });
    });
};
