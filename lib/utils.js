"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
class Utils {
    static splitModuleName(packageName) {
        // There are modules that use multiple hyphens like 'GUPnP-DLNA-1.0'
        const splitted = packageName.split('-');
        const version = splitted.splice(-1, 1)[0];
        const name = splitted.join('-');
        return {
            packageName,
            name,
            version,
        };
    }
    /**
     * Checking whether some variable is iterable
     * see https://stackoverflow.com/a/32538867
     * @param obj Variable to check for iterable
     */
    static isIterable(obj) {
        return obj != null && typeof obj[Symbol.iterator] === 'function';
    }
    static isNumeric(str) {
        return !isNaN(str - parseFloat(str));
    }
    static getFirstChar(str) {
        return str.charAt(0);
    }
    static getLastChar(str) {
        return str.charAt(str.length - 1);
    }
    static isFirstCharNumeric(str) {
        return Utils.isNumeric(this.getFirstChar(str));
    }
    static camelCase(str) {
        return str
            .replace(/\s(.)|(\s|-|_|\.)(.)/g, a => {
            return a.toUpperCase();
        })
            .replace(/(\s|-|_|\.)/g, '');
    }
    static lowerCamelCase(str) {
        str = this.camelCase(str);
        str = this.getFirstChar(str).toLowerCase() + str.slice(1);
        return str;
    }
    static upperCamelCase(str) {
        str = this.camelCase(str);
        str = this.getFirstChar(str).toUpperCase() + str.slice(1);
        return str;
    }
    static findFileInDirs(dirs, filename) {
        let exists = false;
        for (const dir of dirs) {
            const filePath = path_1.default.join(dir, filename);
            exists = fs_1.default.existsSync(filePath);
            if (exists) {
                return {
                    path: filePath,
                    exists,
                };
            }
        }
        return {
            path: null,
            exists,
        };
    }
    /**
     * Union (a ∪ b): create a set that contains the elements of both set a and set b.
     * See https://2ality.com/2015/01/es6-set-operations.html#union
     * @param target
     * @param source
     */
    static union(target, source) {
        return (target = new Set([...target, ...source]));
    }
}
exports.Utils = Utils;
Utils.isEqual = lodash_1.default.isEqual;
Utils.map = lodash_1.default.map;
Utils.find = lodash_1.default.find;
Utils.merge = lodash_1.default.merge;
//# sourceMappingURL=utils.js.map