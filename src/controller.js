const { ServiceTypes } = require("./Constants/ServiceTypes");
const { BankController } = require("./Controllers/Bank.Controller");
const { UpgradeController } = require("./Controllers/Upgrade.Controller");

class Controller {
    constructor() {
        this.bankController = null;
        this.upgradeController = null;
    }

    async handleRequest(user, message, isReadOnly) {
        if (!message || typeof message !== "object") {
            await user.send({ error: { code: 400, message: "Message must be an object." } });
            return;
        }

        const service = message.Service || message.service;

        this.bankController = new BankController(message);
        this.upgradeController = new UpgradeController(message);

        let result = {};

        try {
            if (service === ServiceTypes.UPGRADE) {
                message.userPubKey = user.pubKey;
                result = await this.upgradeController.handleRequest();
            } else if (service === ServiceTypes.BANK) {
                message.userPubKey = user.pubKey;
                result = await this.bankController.handleRequest(isReadOnly);
            } else {
                result = { error: { code: 404, message: "Service not found." } };
            }
        } catch (e) {
            result = { error: { code: 500, message: e && e.message ? e.message : "Internal error." } };
        }

        if (isReadOnly) {
            await this.sendOutput(user, result);
        } else {
            await this.sendOutput(user, message.promiseId ? { promiseId: message.promiseId, ...result } : result);
        }
    }

    async sendOutput(user, response) {
        await user.send(response);
    }
}

module.exports = { Controller };
