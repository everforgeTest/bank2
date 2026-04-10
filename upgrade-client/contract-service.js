const HotPocket = require("hotpocket-js-client");

class ContractService {
    constructor(servers, userKeyPair, protocol) {
        this.servers = servers;
        this.userKeyPair = userKeyPair;
        this.protocol = protocol || HotPocket.protocols.bson;
        this.client = null;
        this.isConnectionSucceeded = false;
        this.promiseMap = new Map();
    }

    async init() {
        if (!this.userKeyPair) {
            this.userKeyPair = await HotPocket.generateKeys();
        }
        if (!this.client) {
            this.client = await HotPocket.createClient(this.servers, this.userKeyPair, {
                protocol: this.protocol
            });
        }

        this.client.on(HotPocket.events.disconnect, () => {
            this.isConnectionSucceeded = false;
        });

        this.client.on(HotPocket.events.contractOutput, r => {
            r.outputs.forEach(o => {
                let out = null;
                try {
                    out = JSON.parse(o.toString());
                } catch (e) {
                    out = null;
                }

                if (!out || !out.promiseId) return;

                const p = this.promiseMap.get(out.promiseId);
                if (!p) return;

                if (out.error) p.rejecter(out.error);
                else p.resolver(out.success);

                this.promiseMap.delete(out.promiseId);
            });
        });

        if (!this.isConnectionSucceeded) {
            const ok = await this.client.connect();
            if (!ok) return false;
            this.isConnectionSucceeded = true;
        }

        return true;
    }

    submitInputToContract(inp) {
        const promiseId = this.#getUniqueId();
        const payload = Buffer.from(JSON.stringify({ promiseId, ...inp }));

        this.client.submitContractInput(payload).then(input => {
            input && input.submissionStatus && input.submissionStatus.then(s => {
                if (s.status !== "accepted") {
                    throw new Error(`Ledger_Rejection: ${s.reason}`);
                }
            });
        });

        return new Promise((resolve, reject) => {
            this.promiseMap.set(promiseId, { resolver: resolve, rejecter: reject });
        });
    }

    #getUniqueId() {
        const bytes = Buffer.from(Array.from({ length: 10 }, () => Math.floor(Math.random() * 256)));
        return bytes.toString("hex");
    }
}

module.exports = ContractService;
