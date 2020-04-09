"use strict";
/**
 * The TemplateProcessor is used generate strings from templates files or template strings
 * For example, the signal methods are generated here
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ejs_1 = __importDefault(require("ejs"));
const transformation_1 = require("./transformation");
const logger_1 = require("./logger");
const CLIEngine = require('eslint').CLIEngine;
const lint = new CLIEngine({ ignore: false, fix: true, useEslintrc: true });
const TEMPLATE_DIR = path_1.default.join(__dirname, '../templates');
class TemplateProcessor {
    constructor(data, moduleName = 'TemplateProcessor', config) {
        this.data = data;
        this.config = config;
        this.environmentTemplateDir = transformation_1.Transformation.getEnvironmentDir(config.environment, TEMPLATE_DIR);
        this.log = new logger_1.Logger(config.environment, config.verbose, moduleName);
    }
    static generateIndent(indents = 1, spaceForIndent = 4) {
        return ' '.repeat(indents * spaceForIndent);
    }
    /**
     * See https://github.com/microsoft/tsdoc
     * @param description
     */
    static generateTSDocComment(description) {
        const result = [];
        result.push('/**');
        result.push(` * ${description}`);
        result.push(' */');
        return result;
    }
    static generateModuleDependenciesImport(namespace, baseFilename, asType = false, config) {
        const result = [];
        if (config.buildType === 'lib') {
            result.push(`import * as ${namespace} from './${baseFilename}';`);
        }
        else {
            if (asType) {
                result.push(`/// <reference types="${baseFilename}" />`);
            }
            else {
                result.push(`/// <reference path="${baseFilename}.d.ts" />`);
            }
        }
        return result;
    }
    static generateSignalMethods(environment, sigName, clsName, paramComma, params, retType, identCount = 1) {
        const ident = this.generateIndent(identCount);
        const signalMethods = [
            `${ident}connect(sigName: "${sigName}", callback: (($obj: ${clsName}${paramComma}${params}) => ${retType})): number`,
            `${ident}connect_after(sigName: "${sigName}", callback: (($obj: ${clsName}${paramComma}${params}) => ${retType})): number`,
            `${ident}emit(sigName: "${sigName}"${paramComma}${params}): void`,
        ];
        if (environment === 'node') {
            signalMethods.push(`${ident}on(sigName: "${sigName}", callback: (...args: any[]) => void): NodeJS.EventEmitter`, `${ident}once(sigName: "${sigName}", callback: (...args: any[]) => void): NodeJS.EventEmitter`, `${ident}off(sigName: "${sigName}", callback: (...args: any[]) => void): NodeJS.EventEmitter`);
        }
        return signalMethods;
    }
    static generateGObjectSignalMethods(environment, propertyName, callbackObjectName, nampespacePrefix, identCount = 1) {
        const result = [];
        const ident = this.generateIndent(identCount);
        result.push(`${ident}connect(sigName: "notify::${propertyName}", callback: (($obj: ${callbackObjectName}, pspec: ${nampespacePrefix}ParamSpec) => void)): number`, `${ident}connect_after(sigName: "notify::${propertyName}", callback: (($obj: ${callbackObjectName}, pspec: ${nampespacePrefix}ParamSpec) => void)): number`);
        result.push();
        if (environment === 'node') {
            result.push(`${ident}on(sigName: "notify::${propertyName}", callback: (...args: any[]) => void): NodeJS.EventEmitter`, `${ident}once(sigName: "notify::${propertyName}", callback: (...args: any[]) => void): NodeJS.EventEmitter`, `${ident}off(sigName: "notify::${propertyName}", callback: (...args: any[]) => void): NodeJS.EventEmitter`);
        }
        return result;
    }
    static generateGeneralSignalMethods(environment, identCount = 1) {
        const result = [];
        const ident = this.generateIndent(identCount);
        result.push(`${ident}connect(sigName: string, callback: any): number`, `${ident}connect_after(sigName: string, callback: any): number`, `${ident}emit(sigName: string, ...args: any[]): void`, `${ident}disconnect(id: number): void`);
        if (environment === 'node') {
            result.push(`${ident}on(sigName: string, callback: any): NodeJS.EventEmitter`, `${ident}once(sigName: string, callback: any): NodeJS.EventEmitter`, `${ident}off(sigName: string, callback: any): NodeJS.EventEmitter`);
        }
        return result;
    }
    /**
     * Loads and renders a template and gets the rendered string back
     * @param templateFilename
     */
    load(templateFilename) {
        const fileContent = this.read(templateFilename);
        return this.render(fileContent);
    }
    /**
     * Loads an template, render the template and write the template to the filesystem
     * @param templateFilename
     * @param outputDir
     * @param outputFilename
     * @return The rendered (and if possible prettified) code string
     */
    create(templateFilename, outputDir, outputFilename) {
        const fileContent = this.load(templateFilename);
        const renderedCode = this.render(fileContent);
        const destPath = this.write(renderedCode, outputDir, outputFilename);
        const prettifiedCode = this.config.pretty ? this.prettify(destPath, true) : null;
        return prettifiedCode || renderedCode;
    }
    write(content, outputDir, outputFilename) {
        outputDir = transformation_1.Transformation.getEnvironmentDir(this.config.environment, outputDir);
        const destPath = path_1.default.join(outputDir, outputFilename);
        // write template result file
        fs_1.default.mkdirSync(outputDir, { recursive: true });
        fs_1.default.writeFileSync(destPath, content, { encoding: 'utf8', flag: 'w' });
        return destPath;
    }
    render(templateString, additionalData = {}) {
        const renderedCode = ejs_1.default.render(templateString, Object.assign(Object.assign(Object.assign({}, this.config), this.data), additionalData));
        return renderedCode;
    }
    /**
     * Checks if the template file exists and returns the path if found
     * Tries first to load the file from the environment-specific template folder and otherwise looks for it in the general template folder
     * @param templateFilename
     */
    exists(templateFilename) {
        const fullEnvironmentTemplatePath = path_1.default.join(this.environmentTemplateDir, templateFilename);
        const fullGeneralTemplatePath = path_1.default.join(TEMPLATE_DIR, templateFilename);
        if (fs_1.default.existsSync(fullEnvironmentTemplatePath)) {
            return fullEnvironmentTemplatePath;
        }
        if (fs_1.default.existsSync(fullGeneralTemplatePath)) {
            return fullGeneralTemplatePath;
        }
        return null;
    }
    prettify(path, changeFile = false) {
        var _a;
        let hasError = false;
        let report;
        let prettifiedCode = null;
        this.log.info(`   Prettify ...`);
        try {
            report = lint.executeOnFiles([path]);
        }
        catch (error) {
            this.log.warn(error);
            hasError = true;
        }
        if ((report === null || report === void 0 ? void 0 : report.errorCount) > 0) {
            hasError = true;
        }
        prettifiedCode = ((_a = report === null || report === void 0 ? void 0 : report.results[0]) === null || _a === void 0 ? void 0 : _a.output) || null;
        if (hasError) {
            if (!prettifiedCode) {
                this.log.warn(`Can't prettify file: "${path}", please check your .eslintrc.js in your working directory`);
                this.log.dir(report);
                report === null || report === void 0 ? void 0 : report.results.forEach(result => {
                    if (result.message) {
                        this.log.log(result.message);
                    }
                });
            }
        }
        else {
            prettifiedCode = report.results[0].output;
            if (prettifiedCode && changeFile) {
                this.write(prettifiedCode, path_1.default.dirname(path), path_1.default.basename(path));
            }
        }
        return prettifiedCode;
    }
    /**
     * Reads a template file from filesystem and gets the unrendered string back
     * @param templateFilename
     * @return The unrendered template content
     */
    read(templateFilename) {
        const path = this.exists(templateFilename);
        if (path) {
            return fs_1.default.readFileSync(path, 'utf8');
        }
        throw new Error(`Template '${templateFilename}' not found'`);
    }
}
exports.TemplateProcessor = TemplateProcessor;
exports.default = TemplateProcessor;
//# sourceMappingURL=template-processor.js.map