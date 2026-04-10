const settings = require("../../settings.json").settings;
const { SqliteDatabase } = require("../Common.Services/dbHandler").default;
const { Tables } = require("../../Constants/Tables");

function toIntAmount(v) {
    const n = typeof v === "string" ? parseInt(v, 10) : v;
    if (!Number.isInteger(n) || n <= 0) return null;
    return n;
}

function normalizeHex(hex) {
    if (typeof hex !== "string") return null;
    const h = hex.toLowerCase();
    if (!h.match(/^[0-9a-f]+$/)) return null;
    return h;
}

class BankService {
    constructor(message) {
        this.message = message;
        this.db = new SqliteDatabase(settings.dbPath);
    }

    async #ensureAccount(pubKeyHex) {
        const rows = await this.db.runSelectQuery(
            `SELECT PubKeyHex, Balance FROM ${Tables.ACCOUNTS} WHERE PubKeyHex = ?`,
            [pubKeyHex],
        );
        if (rows.length) return rows[0];

        await this.db.runQuery(
            `INSERT INTO ${Tables.ACCOUNTS}(PubKeyHex, Balance) VALUES(?, 0)`,
            [pubKeyHex],
        );
        const created = await this.db.runSelectQuery(
            `SELECT PubKeyHex, Balance FROM ${Tables.ACCOUNTS} WHERE PubKeyHex = ?`,
            [pubKeyHex],
        );
        return created[0];
    }

    async deposit() {
        const from = normalizeHex(this.message.userPubKey);
        const amount = toIntAmount(this.message.data && this.message.data.amount);
        const memo = (this.message.data && this.message.data.memo) || null;

        if (!from) return { error: { code: 400, message: "Invalid userPubKey." } };
        if (amount === null) return { error: { code: 400, message: "Invalid amount." } };

        this.db.open();
        try {
            await this.#ensureAccount(from);
            await this.db.runQuery(
                `UPDATE ${Tables.ACCOUNTS} SET Balance = Balance + ?, LastUpdatedOn = CURRENT_TIMESTAMP WHERE PubKeyHex = ?`,
                [amount, from],
            );
            await this.db.runQuery(
                `INSERT INTO ${Tables.TRANSACTIONS}(Type, FromPubKeyHex, ToPubKeyHex, Amount, Memo) VALUES(?, ?, ?, ?, ?)`,
                ["DEPOSIT", from, from, amount, memo],
            );

            const rows = await this.db.runSelectQuery(
                `SELECT Balance FROM ${Tables.ACCOUNTS} WHERE PubKeyHex = ?`,
                [from],
            );
            return { success: { balance: rows[0].Balance } };
        } finally {
            this.db.close();
        }
    }

    async withdraw() {
        const from = normalizeHex(this.message.userPubKey);
        const amount = toIntAmount(this.message.data && this.message.data.amount);
        const memo = (this.message.data && this.message.data.memo) || null;

        if (!from) return { error: { code: 400, message: "Invalid userPubKey." } };
        if (amount === null) return { error: { code: 400, message: "Invalid amount." } };

        this.db.open();
        try {
            await this.#ensureAccount(from);
            const balRows = await this.db.runSelectQuery(
                `SELECT Balance FROM ${Tables.ACCOUNTS} WHERE PubKeyHex = ?`,
                [from],
            );
            const bal = balRows[0].Balance;
            if (bal < amount) return { error: { code: 403, message: "Insufficient funds." } };

            await this.db.runQuery(
                `UPDATE ${Tables.ACCOUNTS} SET Balance = Balance - ?, LastUpdatedOn = CURRENT_TIMESTAMP WHERE PubKeyHex = ?`,
                [amount, from],
            );
            await this.db.runQuery(
                `INSERT INTO ${Tables.TRANSACTIONS}(Type, FromPubKeyHex, ToPubKeyHex, Amount, Memo) VALUES(?, ?, ?, ?, ?)`,
                ["WITHDRAW", from, from, amount, memo],
            );

            const rows = await this.db.runSelectQuery(
                `SELECT Balance FROM ${Tables.ACCOUNTS} WHERE PubKeyHex = ?`,
                [from],
            );
            return { success: { balance: rows[0].Balance } };
        } finally {
            this.db.close();
        }
    }

    async transfer() {
        const from = normalizeHex(this.message.userPubKey);
        const to = normalizeHex(this.message.data && this.message.data.toPubKey);
        const amount = toIntAmount(this.message.data && this.message.data.amount);
        const memo = (this.message.data && this.message.data.memo) || null;

        if (!from) return { error: { code: 400, message: "Invalid userPubKey." } };
        if (!to) return { error: { code: 400, message: "Invalid toPubKey." } };
        if (from === to) return { error: { code: 400, message: "Cannot transfer to self." } };
        if (amount === null) return { error: { code: 400, message: "Invalid amount." } };

        this.db.open();
        try {
            await this.#ensureAccount(from);
            await this.#ensureAccount(to);

            const balRows = await this.db.runSelectQuery(
                `SELECT Balance FROM ${Tables.ACCOUNTS} WHERE PubKeyHex = ?`,
                [from],
            );
            const bal = balRows[0].Balance;
            if (bal < amount) return { error: { code: 403, message: "Insufficient funds." } };

            await this.db.runQuery("BEGIN TRANSACTION");
            try {
                await this.db.runQuery(
                    `UPDATE ${Tables.ACCOUNTS} SET Balance = Balance - ?, LastUpdatedOn = CURRENT_TIMESTAMP WHERE PubKeyHex = ?`,
                    [amount, from],
                );
                await this.db.runQuery(
                    `UPDATE ${Tables.ACCOUNTS} SET Balance = Balance + ?, LastUpdatedOn = CURRENT_TIMESTAMP WHERE PubKeyHex = ?`,
                    [amount, to],
                );
                await this.db.runQuery(
                    `INSERT INTO ${Tables.TRANSACTIONS}(Type, FromPubKeyHex, ToPubKeyHex, Amount, Memo) VALUES(?, ?, ?, ?, ?)`,
                    ["TRANSFER", from, to, amount, memo],
                );
                await this.db.runQuery("COMMIT");
            } catch (e) {
                await this.db.runQuery("ROLLBACK");
                throw e;
            }

            const fromBalRows = await this.db.runSelectQuery(
                `SELECT Balance FROM ${Tables.ACCOUNTS} WHERE PubKeyHex = ?`,
                [from],
            );
            return { success: { balance: fromBalRows[0].Balance } };
        } finally {
            this.db.close();
        }
    }

    async getBalance() {
        const who = normalizeHex(this.message.userPubKey);
        if (!who) return { error: { code: 400, message: "Invalid userPubKey." } };

        this.db.open();
        try {
            await this.#ensureAccount(who);
            const rows = await this.db.runSelectQuery(
                `SELECT Balance FROM ${Tables.ACCOUNTS} WHERE PubKeyHex = ?`,
                [who],
            );
            return { success: { balance: rows[0].Balance } };
        } finally {
            this.db.close();
        }
    }

    async getTransactions() {
        const who = normalizeHex(this.message.userPubKey);
        if (!who) return { error: { code: 400, message: "Invalid userPubKey." } };

        const limit = this.message.data && this.message.data.limit ? parseInt(this.message.data.limit, 10) : 50;
        const offset = this.message.data && this.message.data.offset ? parseInt(this.message.data.offset, 10) : 0;
        const safeLimit = Number.isInteger(limit) && limit > 0 && limit <= 200 ? limit : 50;
        const safeOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;

        this.db.open();
        try {
            await this.#ensureAccount(who);
            const rows = await this.db.runSelectQuery(
                `SELECT Id, Type, FromPubKeyHex, ToPubKeyHex, Amount, Memo, CreatedOn
                 FROM ${Tables.TRANSACTIONS}
                 WHERE FromPubKeyHex = ? OR ToPubKeyHex = ?
                 ORDER BY Id DESC
                 LIMIT ? OFFSET ?`,
                [who, who, safeLimit, safeOffset],
            );
            return { success: { items: rows, limit: safeLimit, offset: safeOffset } };
        } finally {
            this.db.close();
        }
    }
}

module.exports = { BankService };
