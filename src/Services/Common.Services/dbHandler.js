const sqlite3 = require("sqlite3").verbose();

class SqliteDatabase {
    constructor(dbFile) {
        this.dbFile = dbFile;
        this.openConnections = 0;
        this.db = null;
    }

    open() {
        if (this.openConnections <= 0) {
            this.db = new sqlite3.Database(this.dbFile);
            this.openConnections = 1;
        } else {
            this.openConnections++;
        }
    }

    close() {
        if (this.openConnections <= 1) {
            if (this.db) this.db.close();
            this.db = null;
            this.openConnections = 0;
        } else {
            this.openConnections--;
        }
    }

    runSelectQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    getLastRecord(tableName) {
        const query = `SELECT * FROM ${tableName} ORDER BY rowid DESC LIMIT 1`;
        return new Promise((resolve, reject) => {
            this.db.get(query, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    runQuery(query, params = null) {
        return new Promise((resolve, reject) => {
            this.db.run(query, params ? params : [], function (err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({ lastId: this.lastID, changes: this.changes });
            });
        });
    }

    insertValue(tableName, value) {
        const columnNames = Object.keys(value);
        const placeholders = columnNames.map(() => "?").join(", ");
        const values = columnNames.map(k => value[k]);
        const query = `INSERT INTO ${tableName}(${columnNames.join(", ")}) VALUES (${placeholders})`;
        return this.runQuery(query, values);
    }

    updateValue(tableName, value, filter) {
        const colNames = Object.keys(value);
        const setClause = colNames.map(k => `${k} = ?`).join(", ");
        const setValues = colNames.map(k => value[k]);

        const filterNames = Object.keys(filter || {});
        const whereClause = filterNames.length
            ? filterNames.map(k => `${k} = ?`).join(" AND ")
            : "1";
        const whereValues = filterNames.map(k => filter[k]);

        const query = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`;
        return this.runQuery(query, [...setValues, ...whereValues]);
    }

    deleteValues(tableName, filter) {
        const filterNames = Object.keys(filter || {});
        const whereClause = filterNames.length
            ? filterNames.map(k => `${k} = ?`).join(" AND ")
            : "1";
        const whereValues = filterNames.map(k => filter[k]);
        const query = `DELETE FROM ${tableName} WHERE ${whereClause}`;
        return this.runQuery(query, whereValues);
    }
}

module.exports = {
    default: {
        SqliteDatabase
    }
};
