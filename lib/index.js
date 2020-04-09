"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-var-requires */
__export(require("./commands/generate"));
__export(require("./commands/list"));
__export(require("./types"));
__export(require("./config"));
__export(require("./generator"));
__export(require("./gir-module"));
__export(require("./logger"));
__export(require("./module-loader"));
__export(require("./template-processor"));
__export(require("./transformation"));
__export(require("./utils"));
var command_1 = require("@oclif/command");
exports.run = command_1.run;
if (require.main === module) {
    // If we don't catch exceptions, stdout gets truncated
    try {
        require('@oclif/command')
            .run()
            .then(require('@oclif/command/flush'))
            .catch(require('@oclif/errors/handle'));
    }
    catch (ex) {
        console.log(ex.stack);
    }
}
//# sourceMappingURL=index.js.map