const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const settings = require("../settings.json").settings;
const { Tables } = require("../Constants/Tables");

class DBInitializer {
    static #db = null;

    static async init() {
        if (!fs.existsSync(settings.dbPath)) {
            this.#db = new sqlite3.Database(settings.dbPath);
            await this.#runQuery("PRAGMA foreign_keys = ON");

            await this.#runQuery(`CREATE TABLE IF NOT EXISTS ${Tables.CONTRACTVERSION} (
                Id INTEGER,
                Version FLOAT NOT NULL,
                Description TEXT,
                CreatedOn DATETIME DEFAULT CURRENT_TIMESTAMP,
                LastUpdatedOn DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY("Id" AUTOINCREMENT)
            )`);

            await this.#runQuery(`CREATE TABLE IF NOT EXISTS ${Tables.SQLSCRIPTMIGRATIONS} (
                Id INTEGER,
                Sprint TEXT NOT NULL,
                ScriptName TEXT NOT NULL,
                ExecutedTimestamp TEXT,
                ConcurrencyKey TEXT
                    CHECK (ConcurrencyKey LIKE '0x%' AND length(ConcurrencyKey) = 18),
                PRIMARY KEY("Id" AUTOINCREMENT)
            )`);

            await this.#runQuery(`CREATE TABLE IF NOT EXISTS ${Tables.ACCOUNTS} (
                PubKeyHex TEXT PRIMARY KEY,
                Balance INTEGER NOT NULL DEFAULT 0,
                CreatedOn DATETIME DEFAULT CURRENT_TIMESTAMP,
                LastUpdatedOn DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            await this.#runQuery(`CREATE TABLE IF NOT EXISTS ${Tables.TRANSACTIONS} (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Type TEXT NOT NULL,
                FromPubKeyHex TEXT,
                ToPubKeyHex TEXT,
                Amount INTEGER NOT NULL,
                Memo TEXT,
                CreatedOn DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            this.#db.close();
            this.#db = null;
        }

        if (!fs.existsSync(settings.dbScriptsFolderPath)) {
            return;
        }

        if (fs.existsSync(settings.dbPath)) {
            this.#db = new sqlite3.Database(settings.dbPath);

            const getLastExecutedSprintQuery =
                `SELECT Sprint FROM ${Tables.SQLSCRIPTMIGRATIONS} ORDER BY Sprint DESC LIMIT 1`;
            const rc = await this.#getRecord(getLastExecutedSprintQuery);
            const lastExecutedSprint = rc ? rc.Sprint : "Sprint_00";

            const scriptFolders = fs
                .readdirSync(settings.dbScriptsFolderPath)
                .filter(folder => folder.startsWith("Sprint_") && folder >= lastExecutedSprint)
                .sort();

            for (const sprintFolder of scriptFolders) {
                const sprintFolderPath = path.join(settings.dbScriptsFolderPath, sprintFolder);
                const sqlFiles = fs
                    .readdirSync(sprintFolderPath)
                    .filter(file => file.match(/^\d+_.+\.sql$/))
                    .sort();

                for (const sqlFile of sqlFiles) {
                    const scriptPath = path.join(sprintFolderPath, sqlFile);
                    const q = `SELECT * FROM ${Tables.SQLSCRIPTMIGRATIONS} WHERE Sprint = ? AND ScriptName = ?`;
                    const exists = await this.#getRecord(q, [sprintFolder, sqlFile]);
                    if (!exists) {
                        const sqlScript = fs.readFileSync(scriptPath, "utf8");
                        const sqlStatements = sqlScript
                            .split(";")
                            .map(statement =>
                                statement
                                    .split(/\?\
/)
                                    .map(line => (line.trim().startsWith("--") ? "" : line))
                                    .join("\
"),
                            )
                            .filter(statement => statement.trim() !== "");

                        for (const statement of sqlStatements) {
                            await this.#runQuery(statement);
                        }

                        const insertQuery =
                            `INSERT INTO ${Tables.SQLSCRIPTMIGRATIONS} (Sprint, ScriptName, ExecutedTimestamp) VALUES (?, ?, ?)`;
                        await this.#runQuery(insertQuery, [sprintFolder, sqlFile, new Date().toISOString()]);
                    }
                }
            }

            this.#db.close();
            this.#db = null;
        }
    }

    static #runQuery(query, params = null) {
        return new Promise((resolve, reject) => {
            this.#db.run(query, params ? params : [], function (err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({ lastId: this.lastID, changes: this.changes });
            });
        });
    }

    static #getRecord(query, filters = []) {
        return new Promise((resolve, reject) => {
            if (filters.length > 0) {
                this.#db.get(query, filters, (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            } else {
                this.#db.get(query, (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            }
        });
    }
}

module.exports = { DBInitializer };
