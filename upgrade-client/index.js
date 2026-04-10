// Run as:
// node index.js <contractUrl> <zipFilePath> <maintainerPrivateKeyHex> <version> <description>

const fs = require("fs");
const path = require("path");
const HotPocket = require("hotpocket-js-client");
const ContractService = require("./contract-service");

async function main() {
    const contractUrl = process.argv[2];
    const zipPath = process.argv[3];
    const maintainerPrivateKeyHex = process.argv[4];
    const version = process.argv[5];
    const description = process.argv[6] || "";

    if (!contractUrl || !zipPath || !maintainerPrivateKeyHex || !version) {
        console.log("Usage: node index.js <contractUrl> <zipFilePath> <maintainerPrivateKeyHex> <version> <description>");
        process.exit(1);
    }

    const fileName = path.basename(zipPath);
    const zipBuf = fs.readFileSync(zipPath);

    const privateKey = Buffer.from(maintainerPrivateKeyHex, "hex");
    if (privateKey.length !== 64) {
        console.log("maintainerPrivateKeyHex must be 64 bytes (128 hex chars) ed25519 secret key.");
        process.exit(1);
    }

    const pubKey = privateKey.subarray(32);
    const userKeyPair = { privateKey, publicKey: pubKey };

    const svc = new ContractService([contractUrl], userKeyPair, HotPocket.protocols.json);
    const ok = await svc.init();
    if (!ok) {
        console.log("Connection failed.");
        process.exit(1);
    }

    // Sign using HotPocket client util.
    // Create a temporary client instance to use sign() API.
    const tmpClient = await HotPocket.createClient([contractUrl], userKeyPair, { protocol: HotPocket.protocols.json });
    const sig = tmpClient.sign(zipBuf);

    const request = {
        Service: "Upgrade",
        Action: "UpgradeContract",
        data: {
            version: parseFloat(version),
            description,
            zipBase64: zipBuf.toString("base64"),
            zipSignatureHex: Buffer.from(sig).toString("hex")
        }
    };

    console.log(`Uploading ${fileName} (${Math.round(zipBuf.length / 1024)}KB) version=${version}`);

    try {
        const res = await svc.submitInputToContract(request);
        console.log("Upgrade submitted:", res);
    } catch (e) {
        console.log("Upgrade failed:", e);
        process.exitCode = 1;
    } finally {
        process.exit();
    }
}

main();
