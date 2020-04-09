"use strict";
/**
 * Default values, parse the config file and handle CLI flags
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const command_1 = require("@oclif/command");
const cosmiconfig_1 = require("cosmiconfig");
const path_1 = __importDefault(require("path"));
const utils_1 = require("./utils");
const fs_1 = require("fs");
const logger_1 = require("./logger");
class Config {
    /**
     * Overwrites values in the user config
     * @param configsToAdd
     */
    static addToConfig(configsToAdd) {
        return __awaiter(this, void 0, void 0, function* () {
            const userConfig = yield this.loadConfigFile();
            const path = (userConfig === null || userConfig === void 0 ? void 0 : userConfig.filepath) || this.configFilePath;
            const configToStore = {};
            utils_1.Utils.merge(configToStore, (userConfig === null || userConfig === void 0 ? void 0 : userConfig.config) || {}, configsToAdd);
            const fileExtension = path_1.default.extname(path);
            let writeConfigString = '';
            switch (fileExtension) {
                case '.js':
                    writeConfigString = `module.exports = ${JSON.stringify(configToStore, null, 4)}`;
                    break;
                case '.jsson':
                    writeConfigString = `${JSON.stringify(configToStore, null, 4)}`;
                    break;
                default:
                    logger_1.Logger.error('Only configs with the extension .js and .json are currently supported. Do nothing');
                    break;
            }
            if (writeConfigString && path) {
                return fs_1.promises.writeFile(path, writeConfigString);
            }
        });
    }
    /**
     * The user can create a `.ts-for-girrc` file for his default configs,
     * this method load this config file an returns the user configuration
     * @param configName If the user uses a custom config file name
     */
    static loadConfigFile(configName) {
        return __awaiter(this, void 0, void 0, function* () {
            const configSearchOptions = {};
            if (configName) {
                configSearchOptions.searchPlaces = [configName];
            }
            const userConfig = yield cosmiconfig_1.cosmiconfig(Config.appName, configSearchOptions).search();
            if (userConfig === null || userConfig === void 0 ? void 0 : userConfig.filepath) {
                Config.configFilePath = userConfig === null || userConfig === void 0 ? void 0 : userConfig.filepath;
            }
            return userConfig;
        });
    }
    static getGenerateConfig(config, environment = 'gjs') {
        const defaultBuildType = environment === 'gjs' ? 'lib' : 'types';
        const generateConfig = {
            environment: environment,
            girDirectories: config.girDirectories,
            outdir: config.outdir,
            pretty: config.pretty,
            verbose: config.verbose,
            buildType: config.buildType || defaultBuildType,
        };
        return generateConfig;
    }
    /**
     * Loads the values of the config file and concatenate them with passed cli flags / arguments.
     * The values from config file  are prefered if the cli flag value is the default (and so not set / overwritten)
     * @param flags
     * @param modules
     */
    static load(flags, modules) {
        return __awaiter(this, void 0, void 0, function* () {
            const configFile = yield this.loadConfigFile(flags.configName);
            const config = {
                environments: flags.environments,
                buildType: flags.buildType,
                verbose: flags.verbose,
                ignoreConflicts: flags.ignoreConflicts,
                pretty: flags.pretty,
                print: flags.print,
                outdir: flags.outdir,
                girDirectories: flags.girDirectories,
                ignore: flags.ignore,
                modules,
            };
            if (configFile) {
                if (utils_1.Utils.isEqual(config.environments, Config.defaults.environments) && configFile.config.environments) {
                    config.environments = configFile.config.environments;
                }
                if (configFile.config.buildType) {
                    config.buildType = configFile.config.buildType;
                }
                if (config.verbose === Config.defaultCliFlags.verbose.default &&
                    typeof configFile.config.verbose === 'boolean') {
                    config.verbose = configFile.config.verbose;
                }
                if (config.pretty === Config.defaultCliFlags.pretty.default &&
                    typeof configFile.config.pretty === 'boolean') {
                    config.pretty = configFile.config.pretty;
                }
                if (config.print === Config.defaultCliFlags.print.default && typeof configFile.config.print === 'boolean') {
                    config.print = configFile.config.print;
                }
                if (config.outdir === Config.defaultCliFlags.outdir.default && configFile.config.outdir) {
                    config.outdir = config.print ? null : configFile.config.outdir;
                }
                if (config.girDirectories === Config.defaultCliFlags.girDirectories.default &&
                    configFile.config.girDirectories) {
                    config.girDirectories = configFile.config.girDirectories;
                }
                if ((!config.ignore || config.ignore.length <= 0 || utils_1.Utils.isEqual(config.ignore, Config.defaults.ignore)) &&
                    configFile.config.ignore) {
                    config.ignore = configFile.config.ignore;
                }
                if ((config.modules.length <= 0 || utils_1.Utils.isEqual(config.modules, Config.defaults.modules)) &&
                    configFile.config.modules) {
                    config.modules = configFile.config.modules;
                }
            }
            return config;
        });
    }
}
exports.Config = Config;
Config.appName = 'ts-for-gir';
Config.configFilePath = path_1.default.join(process.cwd(), '.ts-for-girrc.js');
/**
 * Default cli flag and argument values
 */
Config.defaults = {
    environments: ['gjs', 'node'],
    pretty: false,
    print: false,
    outdir: '@types',
    girDirectories: ['/usr/share/gir-1.0'],
    modules: ['*'],
    ignore: [],
    verbose: true,
    ignoreConflicts: false,
};
/**
 * CLI flags used in commands/generate.ts and commands/list.ts
 */
Config.defaultCliFlags = {
    help: command_1.flags.help({ char: 'h' }),
    girDirectories: command_1.flags.string({
        char: 'g',
        description: 'GIR directory',
        multiple: true,
        default: Config.defaults.girDirectories,
    }),
    outdir: command_1.flags.string({
        char: 'o',
        description: 'directory to output to',
        default: Config.defaults.outdir,
    }),
    environments: command_1.flags.string({
        char: 'e',
        description: 'javascript environment',
        multiple: true,
        options: ['gjs', 'node'],
        default: Config.defaults.environments,
    }),
    ignore: command_1.flags.string({
        char: 'i',
        description: 'modules that should be ignored',
        multiple: true,
        default: Config.defaults.ignore,
    }),
    buildType: command_1.flags.string({
        char: 'b',
        description: '[default for gjs: lib, default for node: types] Force the definitions generation type',
        multiple: false,
        options: ['lib', 'types'],
    }),
    pretty: command_1.flags.boolean({
        description: 'prettifies the generated .d.ts files',
        default: Config.defaults.pretty,
    }),
    verbose: command_1.flags.boolean({
        char: 'v',
        description: 'Switch on/off the verbose mode',
        default: Config.defaults.verbose,
    }),
    ignoreConflicts: command_1.flags.boolean({
        description: 'Do not ask for package versions if multiple versions are found',
        default: Config.defaults.ignoreConflicts,
    }),
    print: command_1.flags.boolean({
        char: 'p',
        description: 'print the output to console and create no files',
        default: Config.defaults.print,
    }),
    configName: command_1.flags.string({
        description: 'name of the config if you want to use a different name',
    }),
};
/**
 * CLI arguments used in commands/generate.ts and commands/list.ts
 */
Config.defaultCliArgs = {
    modules: {
        name: 'modules',
        description: "GIR modules to load, e.g. 'Gio-2.0'. Accepts multiple modules",
        required: true,
        default: Config.defaults.modules[0],
    },
};
//# sourceMappingURL=config.js.map