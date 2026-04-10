const fs = require("fs");
const settings = require("../../settings.json").settings;

function cleanup() {
    if (fs.existsSync(settings.dbPath)) {
        fs.unlinkSync(settings.dbPath);
        console.log("Deleted db file:", settings.dbPath);
    } else {
        console.log("No db file found.");
    }
}

if (require.main === module) {
    cleanup();
}

module.exports = { cleanup };
