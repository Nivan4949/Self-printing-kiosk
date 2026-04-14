const { startTunnel } = require('untun');

async function test() {
    try {
        console.log('Starting tunnel...');
        const t = await startTunnel({ port: 3000 });
        const url = await t.getURL();
        console.log('URL:', url);
        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}
test();
