"use strict";
/**
 * Everything you need for the `ts-for-gir generate` command is located here
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
Object.defineProperty(exports, "__esModule", { value: true });
const command_1 = require("@oclif/command");
const generator_1 = require("../generator");
const config_1 = require("../config");
const module_loader_1 = require("../module-loader");
class Generate extends command_1.Command {
    constructor(argv, config) {
        super(argv, config);
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const { argv, flags } = this.parse(Generate);
            const config = yield config_1.Config.load(flags, argv);
            if (argv.length === 0) {
                this.error("Need to pass an argument via 'ts-for-git generate [arguments here]'!");
            }
            for (const i in config.environments) {
                if (config.environments[i]) {
                    const generateConfig = config_1.Config.getGenerateConfig(config, config.environments[i]);
                    const moduleLoader = new module_loader_1.ModuleLoader(generateConfig);
                    const { keep } = yield moduleLoader.getModulesResolved(config.modules, config.ignore || [], config.ignoreConflicts);
                    if (keep.length === 0) {
                        this.error('No module found!');
                    }
                    const tsForGir = new generator_1.Generator(generateConfig);
                    tsForGir.start(Array.from(keep).map(girModuleResolvedBy => girModuleResolvedBy.module));
                }
            }
        });
    }
}
exports.default = Generate;
Generate.description = 'Generates .d.ts files from GIR for gjs or node-gtk';
Generate.strict = false;
Generate.examples = [
    `# Run '${config_1.Config.appName} generate' in your gjs or node-gtk project to generate typings for your project, pass the gir modules you need for your project`,
    `${config_1.Config.appName} generate`,
    '',
    '# You can also use wild cards',
    `${config_1.Config.appName} generate Gtk*`,
    '',
    '# If you want to parse all of your locally installed gir modules run',
    `${config_1.Config.appName} generate '*'`,
    '',
    '# Generate .d.ts. files only for gjs',
    `${config_1.Config.appName} generate '*' -e gjs`,
    '',
    '# Generate .d.ts. files only for node',
    `${config_1.Config.appName} generate '*' -e node`,
    '',
    '# Use a special config file',
    `${config_1.Config.appName} generate --configName='.ts-for-gir.gtk4.rc.js`,
    '',
    '# Generate .d.ts. files but not for Gtk-3.0 and xrandr-1.3',
    `${config_1.Config.appName} generate --ignore=Gtk-3.0 xrandr-1.3`,
];
Generate.flags = {
    help: config_1.Config.defaultCliFlags.help,
    girDirectories: config_1.Config.defaultCliFlags.girDirectories,
    outdir: config_1.Config.defaultCliFlags.outdir,
    environments: config_1.Config.defaultCliFlags.environments,
    ignore: config_1.Config.defaultCliFlags.ignore,
    buildType: config_1.Config.defaultCliFlags.buildType,
    pretty: config_1.Config.defaultCliFlags.pretty,
    verbose: config_1.Config.defaultCliFlags.verbose,
    ignoreConflicts: config_1.Config.defaultCliFlags.ignoreConflicts,
    print: config_1.Config.defaultCliFlags.print,
    configName: config_1.Config.defaultCliFlags.configName,
};
Generate.args = [config_1.Config.defaultCliArgs.modules];
//# sourceMappingURL=generate.js.map