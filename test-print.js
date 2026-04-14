const printerService = require('./server/services/printerService');

async function run() {
    try {
        console.log("Fetching printers...");
        const printers = await printerService.getPrinters();
        console.log("Printers:", printers);
        
        let printerName = printers.length > 0 ? printers[0].name : 'Default';
        console.log("Testing print to:", printerName);
        
        // This is where we think the crash happens
        // Testing with a dummy path or actual path
        const result = await printerService.printFile('C:/Users/Nivan/Desktop/sample.pdf', printerName, { copies: 1, duplex: true });
        console.log("Result:", result);
    } catch (e) {
        console.error("CAUGHT ERROR:", e);
    }
}
run();
