const HotPocket = require("hotpocket-js-client");

function assertEqual(actual, expected, msg) {
    if (actual !== expected) {
        throw new Error(`${msg || "assertEqual failed"}: expected=${expected} actual=${actual}`);
    }
}

function assertTrue(val, msg) {
    if (!val) throw new Error(msg || "assertTrue failed");
}

function assertSuccessResponse(res) {
    assertTrue(res && typeof res === "object", "Response must be object");
    if (!res.success) throw new Error(`Expected success response. Got: ${JSON.stringify(res)}`);
}

function assertErrorResponse(res) {
    assertTrue(res && typeof res === "object", "Response must be object");
    if (!res.error) throw new Error(`Expected error response. Got: ${JSON.stringify(res)}`);
}

async function createAndConnectClient(url, keyPair) {
    const client = await HotPocket.createClient([url], keyPair);
    const ok = await client.connect();
    if (!ok) throw new Error("Failed to connect");
    return client;
}

module.exports = {
    HotPocket,
    assertEqual,
    assertTrue,
    assertSuccessResponse,
    assertErrorResponse,
    createAndConnectClient
};
