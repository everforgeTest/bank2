const HotPocket = require("hotpocket-nodejs-contract");
const bson = require("bson");

const { Controller } = require("./controller");
const { DBInitializer } = require("./Data.Deploy/initDB");
const { SharedService } = require("./Services/Common.Services/SharedService");
const { Tables } = require("./Constants/Tables");
const settings = require("./settings.json").settings;
const { SqliteDatabase } = require("./Services/Common.Services/dbHandler").default;
/*abc d\return await this.service.upgradeContract(zipBuf, parseFloat(data.version), data.description || "");
        } catch (e) {
            return {
                error: {
                    code: e && e.code ? e.code : ContractResponseTypes.INTERNAL_SERVER_ERROR,
                    message: e && e.message ? e.message : "Upgrade failed."*/
const contract = async ctx => {
    console.log("Banking contract is running.");

    SharedService.context = ctx;
    const isReadOnly = ctx.readonly;

    if (!isReadOnly) {
        ctx.unl.onMessage((node, msg) => {
            let obj = null;
            try {
                obj = JSON.parse(msg.toString());
            } catch (e) {
                return;
            }
            if (obj && obj.type) {
                SharedService.nplEventEmitter.emit(obj.type, node, msg);
            }
        });
    }

    try {
        await DBInitializer.init();
    } catch (e) {
        console.error("DB init failed:", e);
    }

    const dbContext = new SqliteDatabase(settings.dbPath);
    try {
        dbContext.open();
        let row = await dbContext.getLastRecord(Tables.CONTRACTVERSION);
        row = row || { Version: 1.0 };
        console.log("Current contract version:", row.Version);
    } catch (e) {
        console.log("Error while getting contract version", e);
    } finally {
        dbContext.close();
    }

    
            if (message && message.Data && !message.data) message.data = message.Data;
            await controller.handleRequest(user, message, isReadOnly);
        }
    }
};

const hpc = new HotPocket.Contract();
hpc.init(contract, HotPocket.clientProtocols.JSON, true);
