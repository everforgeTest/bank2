# Banking Contract Tests

## Prerequisites
- Contract deployed locally and accessible at `wss://localhost:8081`

## Run
From project root:
```bash
npm test
```

These tests:
- Create two users
- Deposit to user A
- Transfer A -> B
- Withdraw from B
- Verify balances and error cases
