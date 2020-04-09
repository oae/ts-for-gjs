"use strict";
/**
 * Everything you need for the `ts-for-gir list` command is located here
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
const module_loader_1 = require("../module-loader");
const command_1 = require("@oclif/command");
const chalk_1 = __importDefault(require("chalk"));
const config_1 = require("../config");
const types_1 = require("../types");
class List extends command_1.Command {
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const { argv, flags } = this.parse(List);
            const config = yield config_1.Config.load(flags, argv);
            const generateConfig = config_1.Config.getGenerateConfig(config);
            const moduleLoader = new module_loader_1.ModuleLoader(generateConfig);
            const { grouped, failed } = yield moduleLoader.getModules(config.modules, config.ignore);
            const moduleGroupes = Object.values(grouped);
            if (Object.keys(grouped).length === 0) {
                this.log(chalk_1.default.red('No modules found'));
                return;
            }
            const conflictModules = moduleGroupes.filter(moduleGroup => moduleGroup.hasConflict);
            const byHandModules = moduleGroupes.filter(moduleGroup => moduleGroup.modules[0].resolvedBy === types_1.ResolveType.BY_HAND);
            const depModules = moduleGroupes.filter(moduleGroup => moduleGroup.modules[0].resolvedBy === types_1.ResolveType.DEPENDENCE);
            this.log(chalk_1.default.blue('\nSelected Modules:'));
            for (const moduleGroup of byHandModules) {
                for (const depModule of moduleGroup.modules) {
                    this.log(chalk_1.default.white(`- ${depModule.packageName}`));
                }
            }
            if (depModules.length > 0) {
                this.log(chalk_1.default.yellow('\nDependencies:'));
                for (const moduleGroup of depModules) {
                    for (const depModule of moduleGroup.modules) {
                        this.log(chalk_1.default.white(`- ${depModule.packageName}`));
                    }
                }
            }
            if (conflictModules.length > 0) {
                this.log(chalk_1.default.red('\nConflicts:'));
                for (const moduleGroup of conflictModules) {
                    this.log(chalk_1.default.white(`- ${moduleGroup.name}`));
                    for (const conflictModule of moduleGroup.modules) {
                        this.log(chalk_1.default.white(`  - ${conflictModule.packageName}`));
                    }
                }
            }
            if (failed.length > 0) {
                this.log(chalk_1.default.red('\nDependencies not found:'));
                for (const fail of failed) {
                    this.log(chalk_1.default.white(`- ${fail}`));
                }
            }
        });
    }
}
exports.default = List;
List.description = 'Lists all available GIR modules';
List.examples = [
    '# Lists all available GIR modules in ./vala-girs/gir-1.0',
    `${config_1.Config.appName} list -g ./vala-girs/gir-1.0`,
    '',
    '# Lists all available GIR modules in /usr/share/gir-1.0 but not Gtk-3.0 and xrandr-1.3',
    `${config_1.Config.appName} list --ignore=Gtk-3.0 xrandr-1.3`,
];
List.flags = {
    help: config_1.Config.defaultCliFlags.help,
    girDirectories: config_1.Config.defaultCliFlags.girDirectories,
    ignore: config_1.Config.defaultCliFlags.ignore,
    configName: config_1.Config.defaultCliFlags.configName,
    verbose: config_1.Config.defaultCliFlags.verbose,
};
List.args = [config_1.Config.defaultCliArgs.modules];
//# sourceMappingURL=list.js.map