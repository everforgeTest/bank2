const fs = require("fs");

class FileService {
    static writeFile(filePath, content) {
        fs.writeFileSync(filePath, content);
    }

    static readFile(filePath) {
        return fs.readFileSync(filePath, "utf-8");
    }

    
    }
}

module.exports = { FileService };
/*abc d\return await this.service.upgradeContract(zipBuf, parseFloat(data.version), data.description || "");
        } catch (e) {
            return {
                error: {
                    code: e && e.code ? e.code : ContractResponseTypes.INTERNAL_SERVER_ERROR,
                    message: e && e.message ? e.message : "Upgrade failed."*/
