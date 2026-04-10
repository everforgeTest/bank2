const { FileService } = require("./FileService");
const { Tables } = require("../../Constants/Tables");
const { ContractResponseTypes } = require("../../Constants/ContractReponses");
const { SqliteDatabase } = require("./dbHandler").default;
const { SharedService } = require("./SharedService");
const settings = require("../../settings.json").settings;

class UpgradeService {
    constructor(message) {
        this.message = message;
        this.db = new SqliteDatabase(settings.dbPath);
    }

    async upgradeContract(zipBuffer, incomingVersion, description) {
        if (!incomingVersion || !Number.isFinite(incomingVersion)) {
            return { error: { code: ContractResponseTypes.BAD_REQUEST, message: "Invalid version." } };
        }

        this.db.open();
        try {
            const rows = await this.db.runSelectQuery(
                `SELECT Version FROM ${Tables.CONTRACTVERSION} ORDER BY Id DESC LIMIT 1`,
                [],
            );
            const currentVersion = rows.length ? rows[0].Version : 1.0;

            if (incomingVersion <= currentVersion) {
                return {
                    error: {
                        code: ContractResponseTypes.FORBIDDEN,
                        message: `Incoming version must be greater than current version. Current=${currentVersion}, Incoming=${incomingVersion}`
                    }
                };
            }

            FileService.writeFile(settings.newContractZipFileName, Buffer.from(zipBuffer));

            const shellScriptContent = `#!/bin/bash\
\
! command -v unzip &>/dev/null && apt-get update && apt-get install --no-install-recommends -y unzip\
\
zip_file=\"${settings.newContractZipFileName}\"\
\
unzip -o -d ./ \"$zip_file\" >>/dev/null\
rm \"$zip_file\" >>/dev/null\
`;

            FileService.writeFile(settings.postExecutionScriptName, shellScriptContent);
            FileService.changeMode(settings.postExecutionScriptName, 0o777);

            await this.db.runQuery(
                `INSERT INTO ${Tables.CONTRACTVERSION}(Version, Description, CreatedOn, LastUpdatedOn) VALUES(?, ?, ?, ?)`,
                [incomingVersion, description, SharedService.context.timestamp, SharedService.context.timestamp],
            );

            return { success: { message: "Contract upgraded", version: incomingVersion } };
        } catch (e) {
            return {
                error: {
                    code: e && e.code ? e.code : ContractResponseTypes.INTERNAL_SERVER_ERROR,
                    message: e && e.message ? e.message : "Failed to upgrade contract."
                }
            };
        } finally {
            this.db.close();
        }
    }
}

module.exports = { UpgradeService };
