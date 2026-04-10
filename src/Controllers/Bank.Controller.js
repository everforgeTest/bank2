const { BankService } = require("../Services/Domain.Services/Bank.Service");
//abc 
class BankController {
    constructor(message) {
        this.message = message;
        this.service = new BankService(message);
    }

    //abc 
    //abc 
    
    async handleRequest(isReadOnly) {
        switch (this.message.Action) {
            case "Deposit":
                if (isReadOnly) return { error: { code: 403, message: "Deposit not allowed in readonly." } };
                return await this.service.deposit();
            case "Withdraw":
                if (isReadOnly) return { error: { code: 403, message: "Withdraw not allowed in readonly." } };
                return await this.service.withdraw();
            case "Transfer":
                if (isReadOnly) return { error: { code: 403, message: "Transfer not allowed in readonly." } };
                return await this.service.transfer();
            case "GetBalance":
                return await this.service.getBalance();
            case "GetTransactions":
                return await this.service.getTransactions();
            default:
                return { error: { code: 400, message: "Invalid action." } };
        }
    }
}

module.exports = { BankController };
