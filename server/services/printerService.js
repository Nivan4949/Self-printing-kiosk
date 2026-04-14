const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const isWindows = os.platform() === 'win32';

const isVercel = process.env.VERCEL === '1';

// List available printers
exports.getPrinters = () => {
    return new Promise((resolve, reject) => {
        if (isVercel) {
            console.log('[PRINTER] Cloud environment, returning mock printers');
            return resolve([
                { name: 'Cloud_Virtual_Printer_Color', status: 'idle' },
                { name: 'Cloud_Virtual_Printer_BW', status: 'idle' }
            ]);
        }

        // wmic is deprecated/removed in Windows 11, use PowerShell instead
        const cmd = isWindows ? 'powershell.exe -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"' : 'lpstat -a';

        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error('Error listing printers:', error);
                // Return mock printers if command fails (likely in dev env without printers)
                return resolve([
                    { name: 'Mock_Printer_Color', status: 'idle' },
                    { name: 'Mock_Printer_BW', status: 'idle' }
                ]);
            }

            const printers = [];
            const lines = stdout.split('\n');

            if (isWindows) {
                // Parse Windows output (PowerShell)
                 lines.forEach(line => {
                    const name = line.trim();
                    // Skip empty lines or header if any (Get-Printer just returns names)
                    if (name && name !== 'Name' && !name.startsWith('---')) {
                         printers.push({ name: name, status: 'unknown' });
                    }
                });
            } else {
                // Parse Linux output
                lines.forEach(line => {
                    const parts = line.split(' ');
                    if (parts.length > 0 && parts[0]) {
                        printers.push({ name: parts[0], status: 'idle' });
                    }
                });
            }
            
            if (printers.length === 0) {
                 return resolve([
                    { name: 'Mock_Printer_Color', status: 'idle' },
                    { name: 'Mock_Printer_BW', status: 'idle' }
                ]);
            }

            resolve(printers);
        });
    });
};

// Send File to Printer
exports.printFile = (filePath, printerName, options = {}) => {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            return reject(new Error('File not found'));
        }

        // Optional implicit default printer
        let targetPrinter = printerName;
        if (!targetPrinter || typeof targetPrinter !== 'string' || targetPrinter === 'Default_Printer') {
            targetPrinter = undefined; // Telling pdf-to-printer to use the native OS default
        }

        // Mock Mode for Development
        if (targetPrinter && targetPrinter.startsWith('Mock_')) {
            console.log(`[MOCK PRINT] Sending ${filePath} to ${targetPrinter} with options:`, options);
            setTimeout(() => {
                resolve({ jobParams: options, status: 'completed' });
            }, 3000); 
            return;
        }

        if (isWindows) {
            // Windows Real Printing using pdf-to-printer
            const ptp = require('pdf-to-printer');
            
            // Map options to pdf-to-printer format
            const printOptions = {
                scale: "fit"
            };
            if (targetPrinter) {
                printOptions.printer = targetPrinter;
            }
            
            // Note: pdf-to-printer has limited options compared to cups, but covers basics
            // It doesn't natively support 'copies' in the options object usually, 
            // but we can loop or check documentation. 
            // Actually, the library documentation says: .print(file, [options])
            // options: printer, win32 (array of CLI args), unix (array of CLI args)
            // But let's stick to basic print for now or use the 'sumatraPdf' args if needed.
            // A common wrapper usage:
            
            ptp.print(filePath, printOptions)
                .then(() => {
                    console.log(`[WINDOWS PRINT] Printed to ${targetPrinter || 'OS Default Printer'}`);
                    resolve({ jobParams: options, status: 'completed' }); // Windows spooling is "completed" for us
                })
                .catch(err => {
                    console.error('[WINDOWS PRINT] Error:', err);
                    reject(err);
                });

        } else {
            // Linux CUPS - Robust
            const cupsOptions = [];
            if (options.copies) cupsOptions.push(`-n ${options.copies}`);
            if (options.range) cupsOptions.push(`-o page-ranges=${options.range}`);
            if (options.duplex) cupsOptions.push('-o sides=two-sided-long-edge');
            if (options.color === false) cupsOptions.push('-o ColorModel=Gray');

            const destOpt = targetPrinter ? `-d "${targetPrinter}" ` : '';
            const cmd = `lp ${destOpt}${cupsOptions.join(' ')} "${filePath}"`;
            console.log(`[LINUX PRINT] Executing: ${cmd}`);

            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    console.error('Print Error:', error);
                    return reject(error);
                }
                console.log('Print Output:', stdout);
                resolve({ jobParams: options, status: 'queued' });
            });
        }
    });
};
