const { bankTest } = require("./TestCases/BankTest");

async function run() {
    const tests = [bankTest];

    for (const t of tests) {
        const name = t.name || "(anonymous test)";
        process.stdout.write(`Running ${name}...\
`);
        await t();
    }

    process.stdout.write("All tests passed.\
");
}

run().catch(e => {
    console.error("Test run failed:", e);
    process.exit(1);
});
