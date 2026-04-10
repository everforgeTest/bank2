const {
    HotPocket,
    assertEqual,
    assertSuccessResponse,
    assertErrorResponse,
    createAndConnectClient
} = require("../test-utils");

async function bankTest() {
    const url = "wss://localhost:8081";

    const userA = await HotPocket.generateKeys();
    const userB = await HotPocket.generateKeys();

    const clientA = await createAndConnectClient(url, userA);
    const clientB = await createAndConnectClient(url, userB);

    const pubA = Buffer.from(userA.publicKey).toString("hex");
    const pubB = Buffer.from(userB.publicKey).toString("hex");

    // Initial balances should be 0 (account auto-created on first read)
    let res = await clientA.submitContractReadRequest(JSON.stringify({ Service: "Bank", Action: "GetBalance" }));
    res = JSON.parse(res.toString());
    assertSuccessResponse(res);
    assertEqual(res.success.balance, 0, "Initial balance A");

    // Deposit 100 to A
    await clientA.submitContractInput(
        JSON.stringify({ Service: "Bank", Action: "Deposit", data: { amount: 100, memo: "topup" } }),
    );

    res = await clientA.submitContractReadRequest(JSON.stringify({ Service: "Bank", Action: "GetBalance" }));
    res = JSON.parse(res.toString());
    assertSuccessResponse(res);
    assertEqual(res.success.balance, 100, "Balance A after deposit");

    // Transfer 40 A -> B
    await clientA.submitContractInput(
        JSON.stringify({ Service: "Bank", Action: "Transfer", data: { toPubKey: pubB, amount: 40, memo: "pay" } }),
    );

    res = await clientA.submitContractReadRequest(JSON.stringify({ Service: "Bank", Action: "GetBalance" }));
    res = JSON.parse(res.toString());
    assertSuccessResponse(res);
    assertEqual(res.success.balance, 60, "Balance A after transfer");

    res = await clientB.submitContractReadRequest(JSON.stringify({ Service: "Bank", Action: "GetBalance" }));
    res = JSON.parse(res.toString());
    assertSuccessResponse(res);
    assertEqual(res.success.balance, 40, "Balance B after receiving");

    // Withdraw 10 from B
    await clientB.submitContractInput(
        JSON.stringify({ Service: "Bank", Action: "Withdraw", data: { amount: 10, memo: "atm" } }),
    );

    res = await clientB.submitContractReadRequest(JSON.stringify({ Service: "Bank", Action: "GetBalance" }));
    res = JSON.parse(res.toString());
    assertSuccessResponse(res);
    assertEqual(res.success.balance, 30, "Balance B after withdraw");

    // Insufficient funds error
    await clientB.submitContractInput(JSON.stringify({ Service: "Bank", Action: "Withdraw", data: { amount: 9999 } }));
    res = await clientB.submitContractReadRequest(JSON.stringify({ Service: "Bank", Action: "GetBalance" }));
    res = JSON.parse(res.toString());
    assertSuccessResponse(res);

    // Bad transfer target
    await clientA.submitContractInput(JSON.stringify({ Service: "Bank", Action: "Transfer", data: { toPubKey: pubA, amount: 1 } }));

    // Transactions
    res = await clientA.submitContractReadRequest(JSON.stringify({ Service: "Bank", Action: "GetTransactions", data: { limit: 10, offset: 0 } }));
    res = JSON.parse(res.toString());
    assertSuccessResponse(res);
    if (!Array.isArray(res.success.items)) throw new Error("Transactions should be array");

    clientA.close();
    clientB.close();

    console.log("BankTest passed. A=", pubA, "B=", pubB);
}

module.exports = { bankTest };
