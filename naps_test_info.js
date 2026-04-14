const cp = require('child_process');
const fs = require('fs');
try {
    const helpOut = cp.execSync('"server/services/naps2/App/naps2.console.exe" --help').toString();
    fs.writeFileSync('help.txt', helpOut);
} catch (e) {
    fs.writeFileSync('help.txt', e.stderr ? e.stderr.toString() : e.message);
}

try {
    const devicesOut = cp.execSync('"server/services/naps2/App/naps2.console.exe" --list-devices').toString();
    fs.appendFileSync('help.txt', '\n\nDEVICES:\n' + devicesOut);
} catch (e) {
    fs.appendFileSync('help.txt', '\n\nDEVICES ERROR:\n' + (e.stderr ? e.stderr.toString() : e.message));
}
