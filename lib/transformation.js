"use strict";
/**
 * This is where transformations take place for gjs and node-gtk.
 * For example a function names should be transformed to lowerCamelCase for node-gtk but should keep their original name for gjs
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const utils_1 = require("./utils");
const logger_1 = require("./logger");
exports.POD_TYPE_MAP_ARRAY = (environment) => {
    return {
        guint8: environment === 'gjs' ? 'Gjs.byteArray.ByteArray' : 'any',
        gint8: environment === 'gjs' ? 'Gjs.byteArray.ByteArray' : 'any',
        gunichar: 'string',
    };
};
exports.POD_TYPE_MAP = {
    utf8: 'string',
    none: 'void',
    double: 'number',
    guint32: 'number',
    guint16: 'number',
    gint16: 'number',
    gunichar: 'number',
    gint8: 'number',
    gint32: 'number',
    gushort: 'number',
    gfloat: 'number',
    gboolean: 'boolean',
    gpointer: 'object',
    gchar: 'number',
    guint: 'number',
    glong: 'number',
    gulong: 'number',
    gint: 'number',
    guint8: 'number',
    guint64: 'number',
    gint64: 'number',
    gdouble: 'number',
    gssize: 'number',
    gsize: 'number',
    long: 'number',
    object: 'any',
    gshort: 'number',
    filename: 'string',
    // eslint-disable-next-line @typescript-eslint/camelcase
    va_list: 'any',
};
exports.C_TYPE_MAP = (targetFullName, suffix = '') => {
    return {
        'char*': 'string',
        'gchar*': 'string',
        'gchar**': 'any',
        GType: ((targetFullName === 'GObject-2.0' ? 'Type' : 'GObject.Type') + suffix),
    };
};
exports.FULL_TYPE_MAP = (environment) => {
    return {
        'GObject.Value': 'any',
        'GObject.Closure': 'Function',
        'GLib.ByteArray': environment === 'gjs' ? 'Gjs.byteArray.ByteArray' : 'any',
        'GLib.Bytes': environment === 'gjs' ? 'Gjs.byteArray.ByteArray' : 'any',
    };
};
exports.RESERVED_VARIABLE_NAMES = [
    'in',
    'function',
    'true',
    'false',
    'break',
    'arguments',
    'eval',
    'default',
    'new',
    'extends',
    'with',
    'var',
    'class',
    'delete',
    'return',
];
exports.RESERVED_CLASS_NAMES = [
    'break',
    'boolean',
    'case',
    'catch',
    'class',
    'const',
    'continue',
    'debugger',
    'default',
    'delete',
    'do',
    'else',
    'enum',
    'export',
    'extends',
    'false',
    'finally',
    'for',
    'function',
    'if',
    'implements',
    'import',
    'in',
    'instanceof',
    'interface',
    'let',
    'new',
    'number',
    'package',
    'private',
    'protected',
    'public',
    'return',
    'static',
    'super',
    'switch',
    'string',
    'this',
    'throw',
    'true',
    'try',
    'typeof',
    'var',
    'void',
    'while',
    'with',
    'yield',
];
exports.RESERVED_FUNCTION_NAMES = ['false', 'true', 'break'];
exports.RESERVED_NAMESPACE_NAMES = {};
class Transformation {
    constructor(moduleName = 'Transformation', config) {
        this.config = config;
        /**
         * Rules for the name conventions
         * For node-gtk naming conventions see https://github.com/romgrk/node-gtk#naming-conventions
         * For gjs see https://gjs-docs.gnome.org/ and https://wiki.gnome.org/Attic/Gjs
         */
        this.transformations = {
            functionName: {
                node: {
                    transformation: 'lowerCamelCase',
                },
                gjs: {
                    transformation: 'original',
                },
            },
            enumName: {
                node: {
                    transformation: 'original',
                },
                gjs: {
                    transformation: 'original',
                },
            },
            enumValue: {
                node: {
                    transformation: 'upperCase',
                },
                gjs: {
                    transformation: 'upperCase',
                },
            },
            signalName: {
                node: {
                    transformation: 'original',
                },
                gjs: {
                    transformation: 'original',
                },
            },
            // GJS always re-writes - to _ (I think?)
            propertyName: {
                node: {
                    transformation: 'lowerCamelCase',
                },
                gjs: {
                    transformation: 'underscores',
                },
            },
            parameterName: {
                node: {
                    transformation: 'lowerCamelCase',
                },
                gjs: {
                    transformation: 'underscores',
                },
            },
            fieldName: {
                node: {
                    transformation: 'lowerCamelCase',
                },
                gjs: {
                    transformation: 'underscores',
                },
            },
            constantName: {
                node: {
                    transformation: 'original',
                },
                gjs: {
                    transformation: 'original',
                },
            },
            importName: {
                node: {
                    transformation: 'upperCamelCase',
                },
                gjs: {
                    transformation: 'upperCamelCase',
                },
            },
        };
        this.log = new logger_1.Logger(config.environment, config.verbose, moduleName);
    }
    transformModuleNamespaceName(name) {
        name = this.transformNumericName(name);
        name = this.transform('importName', name);
        if (exports.RESERVED_NAMESPACE_NAMES[name]) {
            name = `${name}_`;
        }
        return name;
    }
    transformClassName(name) {
        const originalName = `${name}`;
        name = this.transformNumericName(name);
        if (exports.RESERVED_CLASS_NAMES.includes(name)) {
            name = `${name}_`;
        }
        if (originalName !== name) {
            this.log.warn(`Class name renamed from '${originalName}' to '${name}'`);
        }
        return name;
    }
    transformEnumName(name) {
        name = this.transform('enumName', name);
        const originalName = `${name}`;
        // For an example enum starting with a number see https://gjs-docs.gnome.org/nm10~1.20.8/nm.80211mode
        name = this.transformNumericName(name);
        if (exports.RESERVED_CLASS_NAMES.includes(name)) {
            name = `${name}_`;
        }
        if (originalName !== name) {
            this.log.warn(`Enum name renamed from '${originalName}' to '${name}'`);
        }
        return name;
    }
    transformFunctionName(name) {
        name = this.transform('functionName', name);
        const originalName = `${name}`;
        name = this.transformNumericName(name);
        if (exports.RESERVED_FUNCTION_NAMES.includes(name)) {
            name = `${name}_TODO`;
        }
        if (originalName !== name) {
            this.log.warn(`Function name renamed from '${originalName}' to '${name}'`);
        }
        return name;
    }
    /**
     * E.g. GstVideo-1.0 has a class `VideoScaler` with a method called `2d`
     * or NetworkManager-1.0 has methods starting with `80211`
     */
    transformPropertyName(name, allowQuotes) {
        name = this.transform('propertyName', name);
        const originalName = `${name}`;
        if (exports.RESERVED_VARIABLE_NAMES.includes(name)) {
            if (allowQuotes)
                name = `"${name}"`;
            else
                name = `${name}_`;
        }
        name = this.transformNumericName(name, allowQuotes);
        if (originalName !== name) {
            // this.log.warn(`Property name renamed from '${originalName}' to '${name}'`)
        }
        return name;
    }
    transformConstantName(name, allowQuotes) {
        name = this.transform('constantName', name);
        const originalName = `${name}`;
        if (exports.RESERVED_VARIABLE_NAMES.includes(name)) {
            if (allowQuotes)
                name = `"${name}"`;
            else
                name = `${name}_`;
        }
        name = this.transformNumericName(name, allowQuotes);
        if (originalName !== name) {
            this.log.warn(`Constant name renamed from '${originalName}' to '${name}'`);
        }
        return name;
    }
    transformFieldName(name, allowQuotes) {
        name = this.transform('fieldName', name);
        const originalName = `${name}`;
        if (exports.RESERVED_VARIABLE_NAMES.includes(name)) {
            if (allowQuotes)
                name = `"${name}"`;
            else
                name = `${name}_`;
        }
        name = this.transformNumericName(name, allowQuotes);
        if (originalName !== name) {
            this.log.warn(`Field name renamed from '${originalName}' to '${name}'`);
        }
        return name;
    }
    transformParameterName(name, allowQuotes) {
        // Such a variable name exists in `GConf-2.0.d.ts` class `Engine` method `change_set_from_current`
        if (name === '...') {
            return '...args';
        }
        name = this.transform('parameterName', name);
        const originalName = `${name}`;
        if (exports.RESERVED_VARIABLE_NAMES.includes(name)) {
            if (allowQuotes)
                name = `"${name}"`;
            else
                name = `${name}_`;
        }
        name = this.transformNumericName(name, allowQuotes);
        if (originalName !== name) {
            this.log.warn(`Parameter name renamed from '${originalName}' to '${name}'`);
        }
        return name;
    }
    /**
     * Fixes type names, e.g. Return types or enum definitions can not start with numbers
     * @param typeName
     */
    transformTypeName(name) {
        name = this.transformNumericName(name);
        return name;
    }
    transform(construct, transformMe) {
        const transformations = this.transformations[construct][this.config.environment].transformation;
        if (transformations === 'original') {
            return transformMe;
        }
        if (transformations === 'lowerCamelCase') {
            return utils_1.Utils.lowerCamelCase(transformMe);
        }
        if (transformations === 'upperCamelCase') {
            return utils_1.Utils.upperCamelCase(transformMe);
        }
        if (transformations === 'upperCase') {
            return transformMe.toUpperCase();
        }
        if (transformations === 'lowerCase') {
            return transformMe.toLowerCase();
        }
        if (transformations === 'underscores') {
            return transformMe.replace(/-|_/g, '_');
        }
        return transformMe;
    }
    /**
     * In JavaScript there can be no variables, methods, class names or enum names that start with a number.
     * This method converts such names.
     * TODO ala prepends an `@` to numeric starting names how does gjs and node-gtk do that?
     * @param name
     * @param allowQuotes
     */
    transformNumericName(name, allowQuotes = false) {
        if (utils_1.Utils.isFirstCharNumeric(name)) {
            if (allowQuotes)
                name = `"${name}"`;
            else
                name = `TODO_${name}`;
        }
        return name;
    }
    static getEnvironmentDir(environment, baseDir) {
        if (environment == 'gjs') {
            return path_1.default.join(baseDir, 'Gjs');
        }
        if (environment == 'node') {
            return path_1.default.join(baseDir, 'node-gtk');
        }
        return baseDir;
    }
    getEnvironmentDir(baseDir) {
        return Transformation.getEnvironmentDir(this.config.environment, baseDir);
    }
}
exports.Transformation = Transformation;
//# sourceMappingURL=transformation.js.map