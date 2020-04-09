"use strict";
/**
 * The ModuleLoader is used for reading gir modules from the file system and to solve conflicts (e.g. Gtk-3.0 and Gtk-4.0 would be a conflict)
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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const inquirer = __importStar(require("inquirer"));
const tiny_glob_1 = __importDefault(require("tiny-glob"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const chalk_1 = require("chalk");
const xml2js = __importStar(require("xml2js"));
const types_1 = require("./types");
const gir_module_1 = require("./gir-module");
const config_1 = require("./config");
const logger_1 = require("./logger");
const utils_1 = require("./utils");
class ModuleLoader {
    constructor(config) {
        this.config = config;
        /** Transitive module dependencies */
        this.modDependencyMap = {};
        this.log = new logger_1.Logger('', config.verbose, 'ModuleLoader');
    }
    /**
     * Groupes Gir modules by name id
     * E.g. Gtk-3.0 and Gtk-4.0 will be grouped
     * @param girFiles
     */
    groupGirFiles(resolveGirModules) {
        const girModulesGrouped = {};
        for (const resolveGirModule of resolveGirModules) {
            const { name } = utils_1.Utils.splitModuleName(resolveGirModule.packageName);
            const id = name.toLowerCase();
            if (!girModulesGrouped[id]) {
                girModulesGrouped[id] = {
                    name: name,
                    modules: [resolveGirModule],
                    hasConflict: false,
                };
            }
            else {
                girModulesGrouped[id].modules.push(resolveGirModule);
                girModulesGrouped[id].hasConflict = true;
            }
        }
        return girModulesGrouped;
    }
    /**
     * Sorts out the module the user has not choosed via cli prompt
     * @param girModulesGrouped
     * @param keepFullName Users choosed module packageName
     */
    sortVersionsByAnswer(girModulesGrouped, answeredFullName) {
        const keep = new Set();
        let ignore = [];
        if (!girModulesGrouped.hasConflict) {
            keep.add(girModulesGrouped.modules[0]);
        }
        else {
            const keepModule = this.findGirModuleByFullName(girModulesGrouped.modules, answeredFullName);
            const girModulePackageNames = girModulesGrouped.modules.map(resolveGirModule => resolveGirModule.packageName);
            if (!keepModule) {
                throw new Error('Module not found!');
            }
            keep.add(keepModule);
            const toIgnore = girModulePackageNames.filter(packageName => packageName !== answeredFullName);
            ignore = ignore.concat(toIgnore);
        }
        return {
            keep,
            ignore,
        };
    }
    generateContinueQuestion(message = `do you want to continue?`, choices = ['Yes', 'Go back']) {
        const question = {
            name: 'continue',
            message,
            type: 'list',
            choices,
        };
        return question;
    }
    generateIgnoreDepsQuestion(message = `Do you want to ignore them too?`, choices = ['Yes', 'No', 'Go back']) {
        const question = {
            name: 'continue',
            message,
            type: 'list',
            choices,
        };
        return question;
    }
    askIgnoreDepsPrompt(deps) {
        return __awaiter(this, void 0, void 0, function* () {
            let question = null;
            const size = deps.length || deps.size || 0;
            if (size > 0) {
                this.log.log(chalk_1.bold('\nThe following modules have the ignored modules as dependencies:'));
                for (const dep of deps) {
                    this.log.log(`- ${dep.packageName}`);
                }
                this.log.log(chalk_1.bold('\n'));
                question = this.generateIgnoreDepsQuestion();
            }
            else {
                this.log.log(chalk_1.bold('\nNo dependencies found on the ignored modules'));
                question = this.generateContinueQuestion();
            }
            const answer = (yield inquirer.prompt([question])).continue;
            return answer;
        });
    }
    generateModuleVersionQuestion(girModuleGrouped, message) {
        message = message || `Multiple versions of '${girModuleGrouped.name}' found, which one do you want to use?`;
        const question = {
            name: girModuleGrouped.name,
            message,
            type: 'list',
            choices: girModuleGrouped.modules.map(module => module.packageName),
        };
        return question;
    }
    /**
     * Find modules that depend on the module with the name 'packageName'
     * @param girModulesGroupedMap
     * @param packageName
     */
    findModulesDependOnPackage(girModulesGroupedMap, packageName) {
        const girModules = [];
        for (const girModulesGrouped of Object.values(girModulesGroupedMap)) {
            for (const girModuleResolvedBy of girModulesGrouped.modules) {
                if (girModuleResolvedBy.packageName === packageName) {
                    continue;
                }
                for (const dep of girModuleResolvedBy.module.dependencies) {
                    if (dep === packageName && !girModules.includes(girModuleResolvedBy)) {
                        girModules.push(girModuleResolvedBy);
                    }
                }
            }
        }
        return girModules;
    }
    /**
     * Find modules that depend on the module with the names in `packageNames`
     * @param girModulesGroupedMap
     * @param packageName
     */
    findModulesDependOnPackages(girModulesGroupedMap, packageNames) {
        let girModules = [];
        for (const packageName of packageNames) {
            girModules = girModules.concat(this.findModulesDependOnPackage(girModulesGroupedMap, packageName));
        }
        return girModules;
    }
    askForVersionsPrompt(girModulesGrouped) {
        return __awaiter(this, void 0, void 0, function* () {
            const question = this.generateModuleVersionQuestion(girModulesGrouped);
            if (!question.choices) {
                throw new Error('No valid questions!');
            }
            const choosed = (yield inquirer.prompt([question]))[girModulesGrouped.name];
            if (!choosed) {
                throw new Error('No valid answer!');
            }
            const unchoosed = question.choices.filter(choice => choice !== choosed);
            return {
                choosed,
                unchoosed,
            };
        });
    }
    /**
     * If multiple versions of the same module are found, this will aks the user with input prompts for the version he wish to use.
     * Ignores also modules that depend on a module that should be ignored
     * @param resolveFirModules
     */
    askForEachConflictVersionsPrompt(girModulesGroupedMap, ignore) {
        return __awaiter(this, void 0, void 0, function* () {
            let keep = new Set();
            for (const girModulesGrouped of Object.values(girModulesGroupedMap)) {
                // Remove ignored modules from group
                girModulesGrouped.modules = girModulesGrouped.modules.filter(girGroup => !ignore.includes(girGroup.packageName));
                girModulesGrouped.hasConflict = girModulesGrouped.modules.length >= 2;
                if (girModulesGrouped.modules.length <= 0) {
                    continue;
                }
                // Ask for version if there is a conflict
                if (!girModulesGrouped.hasConflict) {
                    keep = utils_1.Utils.union(keep, girModulesGrouped.modules);
                }
                else {
                    let goBack = true;
                    let versionAnswer = null;
                    let ignoreDepsAnswer = null;
                    let wouldIgnoreDeps = [];
                    while (goBack) {
                        versionAnswer = yield this.askForVersionsPrompt(girModulesGrouped);
                        // Check modules that depend on the unchoosed modules
                        wouldIgnoreDeps = this.findModulesDependOnPackages(girModulesGroupedMap, versionAnswer.unchoosed);
                        // Do not check dependencies that have already been ignored
                        wouldIgnoreDeps = wouldIgnoreDeps.filter(dep => !ignore.includes(dep.packageName));
                        ignoreDepsAnswer = yield this.askIgnoreDepsPrompt(wouldIgnoreDeps);
                        goBack = ignoreDepsAnswer === 'Go back';
                    }
                    if (!versionAnswer) {
                        throw new Error('Error in processing the prompt versionAnswer');
                    }
                    if (ignoreDepsAnswer === 'Yes') {
                        // Also ignore the dependencies of the unselected version
                        ignore = ignore.concat(wouldIgnoreDeps.map(dep => dep.packageName));
                    }
                    const unionMe = this.sortVersionsByAnswer(girModulesGrouped, versionAnswer.choosed);
                    // Do not ignore the choosed package version
                    keep = utils_1.Utils.union(keep, unionMe.keep);
                    // Ignore the unchoosed package versions
                    ignore = ignore.concat(unionMe.ignore);
                }
            }
            if (ignore && ignore.length > 0) {
                const ignoreLogList = '- ' + ignore.join('\n- ');
                this.log.log(chalk_1.bold(`\n The following modules will be ignored:`));
                this.log.log(`\n${ignoreLogList}\n`);
                yield this.askAddToIgnoreToConfigPrompt(ignore);
            }
            return {
                keep,
                ignore,
            };
        });
    }
    /**
     * Asks via cli prompt if the user wants to add the ignored modules to his config file
     * @param ignore
     */
    askAddToIgnoreToConfigPrompt(ignore) {
        return __awaiter(this, void 0, void 0, function* () {
            const questions = [
                {
                    name: 'addToIgnore',
                    message: `Do you want to add the ignored modules to your config so that you don't need to select them again next time?\n  Config path: '${config_1.Config.configFilePath}`,
                    type: 'list',
                    choices: ['No', 'Yes'],
                },
            ];
            const answer = yield inquirer.prompt(questions);
            if (answer.addToIgnore === 'Yes') {
                try {
                    yield config_1.Config.addToConfig({
                        ignore: Array.from(ignore),
                    });
                }
                catch (error) {
                    this.log.error(error);
                    process.exit(1);
                }
                this.log.log(`Add ignored modules to '${config_1.Config.configFilePath}'`);
            }
        });
    }
    /**
     * Figure out transitive module dependencies
     * @param packageName
     * @param result
     */
    traverseDependencies(packageName, result = {}) {
        const deps = this.modDependencyMap[packageName];
        if (utils_1.Utils.isIterable(deps)) {
            for (const dep of deps) {
                if (result[dep.packageName])
                    continue;
                result[dep.packageName] = 1;
                this.traverseDependencies(dep.packageName, result);
            }
        }
        else {
            // this.log.warn('`deps` is not iterable: ', deps, packageName, modDependencyMap)
        }
    }
    /**
     * Extends the modDependencyMap by the current Module,
     * should be called for each girModule so that the modDependencyMap is complete
     * @param girModule
     */
    extendDependencyMapByGirModule(girModule) {
        this.modDependencyMap[girModule.packageName || '-'] = utils_1.Utils.map(girModule.dependencies || [], (packageName) => {
            const { name, version } = utils_1.Utils.splitModuleName(packageName);
            return {
                name,
                version,
                packageName,
            };
        });
    }
    /**
     * Sets the traverse dependencies for the current girModule,
     * is required so that all dependencies can be found internally when generating the dependency imports for the module .d.ts file
     * @param girModules
     */
    setTraverseDependenciesForModules(girModules) {
        for (const girModule of girModules) {
            const result = {};
            this.traverseDependencies(girModule.packageName, result);
            girModule.module.transitiveDependencies = Object.keys(result);
        }
    }
    /**
     * Reads a gir xml module file and creates an object of GirModule.
     * Also sets the setDependencyMap
     * @param fillName
     * @param config
     */
    loadAndCreateGirModule(packageName) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = utils_1.Utils.findFileInDirs(this.config.girDirectories, packageName + '.gir');
            if (!file.exists || file.path === null) {
                return null;
            }
            this.log.log(`Parsing ${file.path}...`);
            const fileContents = fs_1.default.readFileSync(file.path, 'utf8');
            const result = (yield xml2js.parseStringPromise(fileContents));
            const gi = new gir_module_1.GirModule(result, this.config);
            // Figure out transitive module dependencies
            this.extendDependencyMapByGirModule(gi);
            return gi;
        });
    }
    /**
     * Returns a girModule found by `packageName` property
     * @param girModules Array of girModules
     * @param packageName Full name like 'Gtk-3.0' you are looking for
     */
    findGirModuleByFullName(girModules, packageName) {
        return girModules.find(girModule => girModule.packageName === packageName);
    }
    /**
     * Checks if a girModule with an equal `packageName` property exists
     * @param girModules
     * @param packageName
     */
    existsGirModule(girModules, packageName) {
        const foundModule = this.findGirModuleByFullName(girModules, packageName);
        return typeof foundModule !== 'undefined';
    }
    /**
     * Reads the gir xml module files and creates an object of GirModule for each module
     * @param girModulesToRead
     * @param girModules is modified and corresponds to the return value
     * @param config
     */
    loadGirModules(girModulesToRead, girModules = [], resolvedBy = types_1.ResolveType.BY_HAND, failedGirModules = new Set()) {
        return __awaiter(this, void 0, void 0, function* () {
            // A copy is needed here because we are changing the array for the while loop
            const girToLoad = Array.from(girModulesToRead);
            let newModuleFound = false;
            while (girToLoad.length > 0) {
                const packageName = girToLoad.shift();
                if (!packageName)
                    throw new Error(`Module name '${packageName} 'not found!`);
                // If module has not already been loaded
                if (!this.existsGirModule(girModules, packageName)) {
                    const gi = yield this.loadAndCreateGirModule(packageName);
                    if (!gi) {
                        if (!failedGirModules.has(packageName)) {
                            this.log.warn(`No gir file found for '${packageName}', this module will be ignored`);
                            failedGirModules.add(packageName);
                        }
                    }
                    else if (gi && gi.packageName) {
                        const addModule = {
                            packageName: gi.packageName,
                            module: gi,
                            resolvedBy,
                        };
                        girModules.push(addModule);
                        newModuleFound = true;
                    }
                }
            }
            if (!newModuleFound) {
                return {
                    loaded: girModules,
                    failed: failedGirModules,
                };
            }
            // Figure out transitive module dependencies
            this.setTraverseDependenciesForModules(girModules);
            // Load girModules for dependencies
            for (const girModule of girModules) {
                // Load dependencies
                if (girModule.module.transitiveDependencies.length > 0) {
                    yield this.loadGirModules(girModule.module.transitiveDependencies, girModules, types_1.ResolveType.DEPENDENCE, failedGirModules);
                }
            }
            return {
                loaded: girModules,
                failed: failedGirModules,
            };
        });
    }
    /**
     * Find modules with the possibility to use wild cards for module names. E.g. `Gtk*` or `'*'`
     * @param girDirectories
     * @param modules
     */
    findModules(modules, ignore = []) {
        return __awaiter(this, void 0, void 0, function* () {
            const foundModules = new Set();
            for (const i in modules) {
                if (modules[i]) {
                    const filename = `${modules[i]}.gir`;
                    let files = [];
                    for (const girDirectory of this.config.girDirectories) {
                        files = files.concat(yield tiny_glob_1.default(filename, { cwd: girDirectory }));
                    }
                    let globModules = files.map(file => path_1.default.basename(file, '.gir'));
                    // Filter out the ignored modules
                    globModules = globModules.filter(mod => {
                        return !ignore.includes(mod);
                    });
                    globModules.forEach(mod => foundModules.add(mod));
                }
            }
            return foundModules;
        });
    }
    /**
     * Loads all found modules and sorts out those that the user does not want to use
     * (if multiple versions of a gir file are found) including their dependencies
     * @param girDirectories
     * @param modules
     */
    getModulesResolved(modules, ignore = [], doNotAskForVersionOnConflict = true) {
        return __awaiter(this, void 0, void 0, function* () {
            const foundGirModules = yield this.findModules(modules, ignore);
            const { loaded, failed } = yield this.loadGirModules(foundGirModules);
            let keep = [];
            if (doNotAskForVersionOnConflict) {
                keep = loaded;
            }
            else {
                const girModulesGrouped = this.groupGirFiles(loaded);
                const filtered = yield this.askForEachConflictVersionsPrompt(girModulesGrouped, ignore);
                keep = Array.from(filtered.keep);
            }
            return { keep, ignore, failed };
        });
    }
    /**
     * Find modules with the possibility to use wild cards for module names. E.g. `Gtk*` or `'*'`
     * @param girDirectories
     * @param modules
     */
    getModules(modules, ignore = []) {
        return __awaiter(this, void 0, void 0, function* () {
            const foundGirModules = yield this.findModules(modules, ignore);
            const { loaded, failed } = yield this.loadGirModules(foundGirModules);
            const grouped = this.groupGirFiles(loaded);
            return { grouped, loaded, failed: Array.from(failed) };
        });
    }
}
exports.ModuleLoader = ModuleLoader;
//# sourceMappingURL=module-loader.js.map