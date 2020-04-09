"use strict";
/**
 * A logger that displays information in different colors on the console.
 * In addition, the environment or the module currently being processed is also included as prepended to the logging string
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chalk_1 = __importDefault(require("chalk"));
class Logger {
    constructor(environment, verbose, moduleName) {
        this.environment = environment;
        this.verbose = verbose;
        this.moduleName = moduleName;
    }
    static prepend(args, prepend) {
        if (typeof args[0] === 'string') {
            args[0] = `${prepend}${args[0]}`;
        }
        return args;
    }
    /**
     * Returns something like '[node][Gda-5.0] Could not find type 'Gda.SqlExpr' for 'expr''
     * @param args
     * @param logLevel
     */
    prependInfos(args, logLevel) {
        if (logLevel || this.moduleName.length > 0 || this.environment.length > 0) {
            args = Logger.prepend(args, ' ');
        }
        if (logLevel) {
            if (this.moduleName.length > 0 || this.environment.length > 0) {
                args = Logger.prepend(args, ' ' + logLevel);
            }
            else {
                args = Logger.prepend(args, logLevel);
            }
        }
        if (this.moduleName.length > 0) {
            args = Logger.prepend(args, `[${this.moduleName}]`);
        }
        if (this.environment.length > 0) {
            args = Logger.prepend(args, `[${this.environment}]`);
        }
        return args;
    }
    log(...args) {
        if (!this.verbose) {
            return;
        }
        return console.log(...args);
    }
    dir(...args) {
        if (!this.verbose) {
            return;
        }
        args.forEach(arg => {
            console.dir(arg);
        });
        return;
    }
    info(...args) {
        if (!this.verbose) {
            return;
        }
        return console.info(chalk_1.default.blue(...args));
    }
    warn(...args) {
        if (!this.verbose) {
            return;
        }
        args = this.prependInfos(args, 'WARN:');
        return console.warn(chalk_1.default.yellow(...args));
    }
    debug(...args) {
        if (!this.verbose) {
            return;
        }
        args = this.prependInfos(args, 'DEBUG:');
        return console.debug(chalk_1.default.yellowBright(...args));
    }
    error(...args) {
        args = this.prependInfos(args, 'ERROR:');
        return this.danger(args);
    }
    success(...args) {
        if (!this.verbose) {
            return;
        }
        console.log(chalk_1.default.green(...args));
    }
    danger(...args) {
        console.log(chalk_1.default.red(...args));
    }
    // Static versions (Here it must be ensured that Verbose is activated)
    static log(...args) {
        return console.log(...args);
    }
    static dir(...args) {
        args.forEach(arg => {
            console.dir(arg);
        });
        return;
    }
    static info(...args) {
        args = this.prepend(args, 'INFO: ');
        return console.info(chalk_1.default.blue(...args));
    }
    static warn(...args) {
        args = this.prepend(args, 'WARN: ');
        return console.warn(chalk_1.default.yellow(...args));
    }
    static debug(...args) {
        args = this.prepend(args, 'DEBUG: ');
        return console.debug(chalk_1.default.yellowBright(...args));
    }
    static error(...args) {
        args = this.prepend(args, 'ERROR: ');
        return this.danger(args);
    }
    static success(...args) {
        console.log(chalk_1.default.green(...args));
    }
    static danger(...args) {
        console.log(chalk_1.default.red(...args));
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map