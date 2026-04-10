const nacl = require("tweetnacl");
const { ContractResponseTypes } = require("../Constants/ContractReponses");
const { UpgradeService } = require("../Services/Common.Services/Upgrade.Service");

function readEnvMaintainer() {
    const expected = (process.env.MAINTAINER_PUBKEY || "").trim().toLowerCase();
    if (!expected) throw { code: ContractResponseTypes.INTERNAL_SERVER_ERROR, message: "MAINTAINER_PUBKEY is not set." };
    if (!expected.match(/^[0-9a-f]+$/)) throw { code: ContractResponseTypes.INTERNAL_SERVER_ERROR, message: "MAINTAINER_PUBKEY must be hex." };
    return expected;
}

function isMaintainer(userPubKeyHex) {
    const expected = readEnvMaintainer();
    if (!userPubKeyHex) return false;
    return userPubKeyHex.toLowerCase() === expected;
}

class UpgradeController {
    constructor(message) {
        this.message = message;
        this.service = new UpgradeService(message);
    }

    async handleRequest() {
        try {
            if (this.message.Action !== "UpgradeContract")
                return { error: { code: 400, message: "Invalid action." } };

            const userPubKey = this.message.userPubKey;
            if (!isMaintainer(userPubKey)) {
                return { error: { code: ContractResponseTypes.UNAUTHORIZED, message: "Unauthorized" } };
            }

            const data = this.message.data || {};
            const zipBase64 = data.zipBase64;
            const zipSignatureHex = data.zipSignatureHex;

            if (!zipBase64 || !zipSignatureHex) {
                return { error: { code: 400, message: "zipBase64 and zipSignatureHex are required." } };
            }

            const zipBuf = Buffer.from(zipBase64, "base64");
            const sigBuf = Buffer.from(zipSignatureHex, "hex");

            const pubKeyBuf = Buffer.from(readEnvMaintainer(), "hex");

            const ok = nacl.sign.detached.verify(
                new Uint8Array(zipBuf),
                new Uint8Array(sigBuf),
                new Uint8Array(pubKeyBuf),
            );

            if (!ok) {
                return { error: { code: ContractResponseTypes.UNAUTHORIZED, message: "Invalid signature." } };
            }

            return await this.service.upgradeContract(zipBuf, parseFloat(data.version), data.description || "");
        } catch (e) {
            return {
                error: {
                    code: e && e.code ? e.code : ContractResponseTypes.INTERNAL_SERVER_ERROR,
                    message: e && e.message ? e.message : "Upgrade failed."
                }
            };
        }
    }
}

module.exports = { UpgradeController };
