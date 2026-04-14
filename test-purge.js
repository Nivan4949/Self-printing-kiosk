const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('database/kiosk.sqlite');
db.serialize(() => {
    db.run("DELETE FROM prepared_files WHERE typeof(page_count) != 'integer' OR page_count = '[object Object]'", function(err) {
        if(err) console.error(err);
        else console.log("Deleted corrupted prepared_files: " + this.changes);
    });
    db.run("DELETE FROM documents WHERE typeof(page_count) != 'integer' OR page_count = '[object Object]'", function(err) {
        if(err) console.error(err);
        else console.log("Deleted corrupted documents: " + this.changes);
    });
});
setTimeout(() => process.exit(0), 1000);
