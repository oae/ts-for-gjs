"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
/* eslint-disable @typescript-eslint/no-var-requires */
const SegfaultHandler = __importStar(require("segfault-handler"));
SegfaultHandler.registerHandler('crash.log');
require("source-map-support/register");
__exportStar(require("./commands/generate"), exports);
__exportStar(require("./commands/list"), exports);
__exportStar(require("./types"), exports);
__exportStar(require("./config"), exports);
__exportStar(require("./generator"), exports);
__exportStar(require("./gir-module"), exports);
__exportStar(require("./logger"), exports);
__exportStar(require("./module-loader"), exports);
__exportStar(require("./template-processor"), exports);
__exportStar(require("./transformation"), exports);
__exportStar(require("./utils"), exports);
var command_1 = require("@oclif/command");
Object.defineProperty(exports, "run", { enumerable: true, get: function () { return command_1.run; } });
if (require.main === module) {
    // If we don't catch exceptions, stdout gets truncated
    try {
        require('@oclif/command')
            .run()
            .then(require('@oclif/command/flush'))
            .catch((error) => {
            console.log(error);
            require('@oclif/errors/handle')(error);
        });
    }
    catch (ex) {
        console.log(ex.stack);
    }
}
//# sourceMappingURL=index.js.map