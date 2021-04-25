"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GirModule = exports.MAXIMUM_RECUSION_DEPTH = exports.STATIC_NAME_ALREADY_EXISTS = void 0;
const template_processor_1 = __importDefault(require("./template-processor"));
const transformation_1 = require("./transformation");
const logger_1 = require("./logger");
const utils_1 = require("./utils");
/**
 * In gjs all classes have a static name property but the classes listed below already have a static name property
 */
exports.STATIC_NAME_ALREADY_EXISTS = ['GMime.Charset', 'Camel.StoreInfo'];
exports.MAXIMUM_RECUSION_DEPTH = 100;
class GirModule {
    constructor(xml, config) {
        this.config = config;
        /**
         * E.g. '3.0'
         */
        this.version = '0.0';
        this.dependencies = [];
        this.transitiveDependencies = [];
        this.ns = { $: { name: '', version: '' } };
        /**
         * Used to find namespaces that are used in other modules
         */
        this.symTable = {};
        this.patch = {};
        /**
         * To prevent constants from being exported twice, the names already exported are saved here for comparison.
         * Please note: Such a case is only known for Zeitgeist-2.0 with the constant "ATTACHMENT"
         */
        this.constNames = {};
        this.commentRegExp = /\/\*.*\*\//g;
        this.paramRegExp = /[0-9a-zA-Z_]*:/g;
        this.optParamRegExp = /[0-9a-zA-Z_]*\?:/g;
        this.repo = xml.repository;
        if (!this.repo.namespace || !this.repo.namespace.length) {
            throw new Error(`Namespace not found!`);
        }
        if (this.repo.include) {
            this.dependencies = this.loadDependencies(this.repo.include);
        }
        this.ns = this.repo.namespace[0];
        this.name = this.ns.$.name;
        this.version = this.ns.$.version;
        this.packageName = `${this.name}-${this.version}`;
        this.transformation = new transformation_1.Transformation(this.packageName, config);
        this.log = new logger_1.Logger(config.environment, config.verbose, this.packageName || 'GirModule');
        this.importName = this.transformation.transformModuleNamespaceName(this.packageName);
    }
    loadDependencies(girInclude) {
        const dependencies = [];
        for (const i of girInclude) {
            dependencies.unshift(`${i.$.name}-${i.$.version}`);
        }
        return dependencies;
    }
    annotateFunctionArguments(girFunc) {
        const funcName = girFunc._fullSymName;
        if (girFunc.parameters) {
            for (const girParam of girFunc.parameters) {
                if (girParam.parameter) {
                    for (const girVar of girParam.parameter) {
                        girVar._module = this;
                        if (girVar.$ && girVar.$.name) {
                            girVar._fullSymName = `${funcName}.${girVar.$.name}`;
                        }
                    }
                }
            }
        }
    }
    annotateFunctionReturn(girFunc) {
        const retVals = girFunc['return-value'];
        if (retVals)
            for (const retVal of retVals) {
                retVal._module = this;
                if (retVal.$ && retVal.$.name) {
                    retVal._fullSymName = `${girFunc._fullSymName}.${retVal.$.name}`;
                }
            }
    }
    annotateFunctions(girClass, funcs) {
        if (funcs)
            for (const func of funcs) {
                if (func.$ && func.$.name) {
                    const nsName = girClass ? girClass._fullSymName : this.name;
                    func._fullSymName = `${nsName}.${func.$.name}`;
                    this.annotateFunctionArguments(func);
                    this.annotateFunctionReturn(func);
                }
            }
    }
    annotateVariables(girClass, girVars) {
        if (girVars)
            for (const girVar of girVars) {
                const nsName = girClass ? girClass._fullSymName : this.name;
                girVar._module = this;
                if (girVar.$ && girVar.$.name) {
                    girVar._fullSymName = `${nsName}.${girVar.$.name}`;
                }
            }
    }
    loadTypesInternal(dict, girConstructs) {
        if (girConstructs) {
            for (const girConstruct of girConstructs) {
                if (girConstruct === null || girConstruct === void 0 ? void 0 : girConstruct.$) {
                    if (girConstruct.$.introspectable) {
                        if (!this.girBool(girConstruct.$.introspectable, true))
                            continue;
                    }
                    const symName = `${this.name}.${girConstruct.$.name}`;
                    if (dict[symName]) {
                        this.log.warn(`Duplicate symbol: ${symName}`);
                        debugger;
                    }
                    girConstruct._module = this;
                    girConstruct._fullSymName = symName;
                    dict[symName] = girConstruct;
                }
            }
        }
    }
    loadTypes(dict) {
        this.loadTypesInternal(dict, this.ns.bitfield);
        this.loadTypesInternal(dict, this.ns.callback);
        this.loadTypesInternal(dict, this.ns.class);
        this.loadTypesInternal(dict, this.ns.constant);
        this.loadTypesInternal(dict, this.ns.enumeration);
        this.loadTypesInternal(dict, this.ns.function);
        this.loadTypesInternal(dict, this.ns.interface);
        this.loadTypesInternal(dict, this.ns.record);
        this.loadTypesInternal(dict, this.ns.union);
        this.loadTypesInternal(dict, this.ns.alias);
        if (this.ns.callback)
            for (const func of this.ns.callback)
                this.annotateFunctionArguments(func);
        const girClasses = (this.ns.class ? this.ns.class : [])
            .concat(this.ns.record ? this.ns.record : [])
            .concat(this.ns.interface ? this.ns.interface : []);
        for (const girClass of girClasses) {
            girClass._module = this;
            girClass._fullSymName = `${this.name}.${girClass.$.name}`;
            const cons = girClass.constructor instanceof Array ? girClass.constructor : [];
            this.annotateFunctions(girClass, cons);
            this.annotateFunctions(girClass, girClass.function || []);
            this.annotateFunctions(girClass, girClass.method || []);
            this.annotateFunctions(girClass, girClass['virtual-method'] || []);
            this.annotateFunctions(girClass, girClass['glib:signal'] || []);
            this.annotateVariables(girClass, girClass.property);
            this.annotateVariables(girClass, girClass.field);
        }
        if (this.ns.function)
            this.annotateFunctions(null, this.ns.function);
        if (this.ns.constant)
            this.annotateVariables(null, this.ns.constant);
        // if (this.ns.)
        // props
        this.symTable = dict;
    }
    loadInheritance(inheritanceTable) {
        // Class hierarchy
        for (const cls of this.ns.class ? this.ns.class : []) {
            let parent = null;
            if (cls.$ && cls.$.parent)
                parent = cls.$.parent;
            if (!parent)
                continue;
            if (!cls._fullSymName)
                continue;
            if (parent.indexOf('.') < 0) {
                parent = this.name + '.' + parent;
            }
            const clsName = cls._fullSymName;
            const arr = inheritanceTable[clsName] || [];
            arr.push(parent);
            inheritanceTable[clsName] = arr;
        }
        // Class interface implementations
        for (const cls of this.ns.class ? this.ns.class : []) {
            if (!cls._fullSymName)
                continue;
            const names = [];
            for (const i of cls.implements ? cls.implements : []) {
                if (i.$.name) {
                    let name = i.$.name;
                    if (name.indexOf('.') < 0) {
                        name = cls._fullSymName.substring(0, cls._fullSymName.indexOf('.') + 1) + name;
                    }
                    names.push(name);
                }
            }
            if (names.length > 0) {
                const clsName = cls._fullSymName;
                const arr = inheritanceTable[clsName] || [];
                inheritanceTable[clsName] = arr.concat(names);
            }
        }
    }
    typeLookup(girVar) {
        var _a, _b, _c;
        let type;
        let arr = '';
        let arrCType;
        let nul = '';
        const collection = girVar.array
            ? girVar.array
            : girVar.type && /^GLib.S?List$/.test((_a = girVar.type[0].$) === null || _a === void 0 ? void 0 : _a.name)
                ? girVar.type
                : undefined;
        if (collection && collection.length > 0) {
            const typeArray = collection[0].type;
            if (!typeArray || typeArray.length === 0)
                return 'any';
            if (collection[0].$) {
                const ea = collection[0].$;
                arrCType = ea['c:type'];
            }
            type = typeArray[0];
            arr = '[]';
        }
        else if (girVar.type) {
            type = girVar.type[0];
        }
        else if ((_b = girVar.callback) === null || _b === void 0 ? void 0 : _b.length) {
            type = null;
        }
        else {
            return 'any';
        }
        if (girVar.$) {
            const nullable = this.paramIsNullable(girVar);
            if (nullable) {
                nul = ' | null';
            }
        }
        const suffix = (arr + nul);
        let fullTypeName;
        if ((_c = girVar.callback) === null || _c === void 0 ? void 0 : _c.length) {
            fullTypeName = this.getFunction(girVar.callback[0], '', '', undefined, true)[0][0];
            if (suffix.length)
                fullTypeName = '(' + fullTypeName + ')';
        }
        else {
            if (!(type === null || type === void 0 ? void 0 : type.$))
                return 'any';
            if (arr) {
                if (transformation_1.POD_TYPE_MAP_ARRAY(this.config.environment)[type.$.name]) {
                    return transformation_1.POD_TYPE_MAP_ARRAY(this.config.environment)[type.$.name] + nul;
                }
            }
            if (transformation_1.POD_TYPE_MAP[type.$.name]) {
                return transformation_1.POD_TYPE_MAP[type.$.name] + suffix;
            }
            if (!this.name)
                return 'any';
            let cType = type.$['c:type'];
            if (!cType && arrCType)
                cType = arrCType;
            if (cType) {
                if (transformation_1.C_TYPE_MAP(this.packageName, suffix)[cType]) {
                    return transformation_1.C_TYPE_MAP(this.packageName, suffix)[cType];
                }
            }
            fullTypeName = type.$.name;
            if (typeof fullTypeName === 'string') {
                if (transformation_1.FULL_TYPE_MAP(this.config.environment)[fullTypeName]) {
                    return transformation_1.FULL_TYPE_MAP(this.config.environment)[fullTypeName];
                }
                // Fully qualify our type name if need be
                if (!fullTypeName.includes('.')) {
                    // eslint-disable-next-line @typescript-eslint/no-this-alias
                    let mod = this;
                    if (girVar._module)
                        mod = girVar._module;
                    fullTypeName = `${mod.name}.${type.$.name}`;
                }
            }
            if (!fullTypeName || !this.symTable[fullTypeName]) {
                this.log.warn(`Could not find type '${fullTypeName}' for '${girVar.$.name}'`);
                return ('any' + arr);
            }
            if (fullTypeName.indexOf(this.name + '.') === 0) {
                const ret = fullTypeName.substring(this.name.length + 1);
                // this.log.warn(`Rewriting ${fullTypeName} to ${ret} + ${suffix} -- ${this.name} -- ${girVar._module}`)
                const result = ret + suffix;
                return result;
            }
        }
        return fullTypeName + suffix;
    }
    /**
     * E.g. replaces something like `NetworkManager.80211ApFlags` with `NetworkManager.TODO_80211ApFlags`
     * @param girVar
     */
    typeLookupTransformed(girVar, out = true) {
        let names = this.typeLookup(girVar).split('.');
        names = names.map((name) => this.transformation.transformTypeName(name));
        return names.join('.');
    }
    girBool(e, defaultVal = false) {
        if (e) {
            if (parseInt(e) === 0)
                return false;
            return true;
        }
        return defaultVal;
    }
    getReturnType(func) {
        var _a;
        let returnType = 'void';
        let outArrayLengthIndex = -1;
        const returnVal = func['return-value'] ? func['return-value'][0] : null;
        if (returnVal) {
            returnType = this.typeLookupTransformed(returnVal, true);
            outArrayLengthIndex =
                returnVal.array && ((_a = returnVal.array[0].$) === null || _a === void 0 ? void 0 : _a.length) ? Number(returnVal.array[0].$.length) : -1;
        }
        return [returnType, outArrayLengthIndex];
    }
    arrayLengthIndexLookup(param) {
        if (!param.array)
            return -1;
        const arr = param.array[0];
        if (!arr.$)
            return -1;
        if (arr.$.length) {
            return parseInt(arr.$.length);
        }
        return -1;
    }
    closureDataIndexLookup(param) {
        if (!param.$.closure)
            return -1;
        return parseInt(param.$.closure);
    }
    destroyDataIndexLookup(param) {
        if (!param.$.destroy)
            return -1;
        return parseInt(param.$.destroy);
    }
    processParams(parametersArray, skip, getIndex) {
        for (const param of parametersArray) {
            const index = getIndex(param);
            if (index < 0)
                continue;
            if (index >= parametersArray.length)
                continue;
            skip.push(parametersArray[index]);
        }
    }
    /**
     * Checks if the parameter is nullable or optional.
     * TODO Check if it makes sence to split this in `paramIsNullable` and `paramIsOptional`
     *
     * @param param Param to test
     *
     * @author realh
     * @see https://github.com/realh/ts-for-gjs/commit/e4bdba8d4ca279dfa4abbca413eaae6ecc6a81f8
     */
    paramIsNullable(param) {
        const a = param.$;
        return a && (this.girBool(a.nullable) || this.girBool(a['allow-none']) || this.girBool(a.optional));
    }
    getParameters(outArrayLengthIndex, parameters) {
        var _a;
        const def = [];
        const outParams = [];
        if (parameters && parameters.length > 0) {
            const parametersArray = parameters[0].parameter || [];
            // Instance parameter needs to be exposed for class methods (see comment above getClassMethods())
            const instanceParameter = parameters[0]['instance-parameter'];
            if (instanceParameter && instanceParameter[0]) {
                const typeName = instanceParameter[0].type ? instanceParameter[0].type[0].$.name : undefined;
                const rec = typeName ? (_a = this.ns.record) === null || _a === void 0 ? void 0 : _a.find((r) => r.$.name == typeName) : undefined;
                const structFor = rec === null || rec === void 0 ? void 0 : rec.$['glib:is-gtype-struct-for'];
                const gobject = this.name === 'GObject' || this.name === 'GLib' ? '' : 'GObject.';
                if (structFor) {
                    // TODO: Should use of a constructor, and even of an instance, be discouraged?
                    def.push(`${instanceParameter[0].$.name}: ${structFor} | Function | ${gobject}Type`);
                }
            }
            if (parametersArray.length) {
                const skip = outArrayLengthIndex === -1 ? [] : [parametersArray[outArrayLengthIndex]];
                this.processParams(parametersArray, skip, this.arrayLengthIndexLookup);
                this.processParams(parametersArray, skip, this.closureDataIndexLookup);
                this.processParams(parametersArray, skip, this.destroyDataIndexLookup);
                for (const param of parametersArray) {
                    if (skip.indexOf(param) !== -1) {
                        continue;
                    }
                    const paramName = this.transformation.transformParameterName(param.$.name || '-', false);
                    const optDirection = param.$.direction;
                    const out = optDirection === 'out' || optDirection == 'inout';
                    // I think it's safest to force inout params to have the
                    // same type for in and out
                    const paramType = this.typeLookupTransformed(param, out);
                    if (out) {
                        outParams.push(`/* ${paramName} */ ${paramType}`);
                        if (optDirection == 'out')
                            continue;
                    }
                    let isOptional = this.paramIsNullable(param) ? '?' : '';
                    if (isOptional === '?') {
                        const index = parametersArray.indexOf(param);
                        const following = parametersArray
                            .slice(index)
                            .filter(() => skip.indexOf(param) === -1)
                            .filter((p) => p.$.direction !== 'out');
                        if (following.some((p) => !this.paramIsNullable(p))) {
                            isOptional = '';
                        }
                    }
                    const paramDesc = `${paramName}${isOptional}: ${paramType}`;
                    def.push(paramDesc);
                }
            }
        }
        return [def.join(', '), outParams];
    }
    getVariable(v, optional = false, allowQuotes = false, type) {
        if (!v.$.name)
            return [[], null];
        if (!v || !v.$ || !this.girBool(v.$.introspectable, true) || this.girBool(v.$.private))
            return [[], null];
        let name = v.$.name;
        switch (type) {
            case 'property':
                name = this.transformation.transformPropertyName(v.$.name, allowQuotes);
                break;
            case 'constant':
                name = this.transformation.transformConstantName(v.$.name, allowQuotes);
                break;
            case 'field':
                name = this.transformation.transformFieldName(v.$.name, allowQuotes);
                break;
        }
        // Use the out type because in can be a union which isn't appropriate
        // for a property
        let typeName = this.typeLookupTransformed(v, true);
        const nameSuffix = optional ? '?' : '';
        typeName = this.transformation.transformTypeName(typeName);
        return [[`${name}${nameSuffix}: ${typeName}`], name];
    }
    /**
     *
     * @param v
     * @param construct construct means include the property even if it's construct-only,
     * @param optional optional means if it's construct-only it will also be marked optional (?)
     */
    getProperty(v, construct = false, optional = true) {
        if (this.girBool(v.$['construct-only']) && !construct)
            return [[], null, null];
        if (!this.girBool(v.$.writable) && construct)
            return [[], null, null];
        if (this.girBool(v.$.private))
            return [[], null, null];
        const propPrefix = this.girBool(v.$.writable) ? '' : 'readonly ';
        const [propDesc, propName] = this.getVariable(v, construct && optional, true, 'property');
        let origName = null;
        if (!propName)
            return [[], null, null];
        if (v.$.name) {
            // TODO does that make sense here? This also changes the signal names
            origName = this.transformation.transformTypeName(v.$.name);
        }
        return [[`    ${propPrefix}${propDesc}`], propName, origName];
    }
    getFunction(e, prefix, funcNamePrefix = '', overrideReturnType, arrowType = false) {
        if (!e || !e.$ || !this.girBool(e.$.introspectable, true) || e.$['shadowed-by'])
            return [[], null];
        const patch = e._fullSymName ? this.patch[e._fullSymName] : [];
        let name = e.$.name;
        // eslint-disable-next-line prefer-const
        let [retType, outArrayLengthIndex] = this.getReturnType(e);
        const [params, outParams] = this.getParameters(outArrayLengthIndex, e.parameters);
        if (e.$['shadows']) {
            name = e.$['shadows'];
        }
        if (funcNamePrefix)
            name = funcNamePrefix + name;
        if (patch && patch.length === 1)
            return [patch, null];
        // Function name transformation by environment
        name = this.transformation.transformFunctionName(name);
        if (patch && patch.length === 2)
            return [[`${prefix}${funcNamePrefix}${patch[patch.length - 1]}`], name];
        const retTypeIsVoid = retType === 'void';
        if (overrideReturnType) {
            retType = overrideReturnType;
        }
        else if (outParams.length + (retTypeIsVoid ? 0 : 1) > 1) {
            if (!retTypeIsVoid) {
                outParams.unshift(`/* returnType */ ${retType}`);
            }
            const retDesc = outParams.join(', ');
            retType = `[ ${retDesc} ]`;
        }
        else if (outParams.length === 1 && retTypeIsVoid) {
            retType = outParams[0];
        }
        let retSep;
        if (arrowType) {
            prefix = '';
            name = '';
            retSep = ' =>';
        }
        else {
            retSep = ':';
        }
        return [[`${prefix}${name}(${params})${retSep} ${retType}`], name];
    }
    getConstructorFunction(name, e, prefix, funcNamePrefix = '') {
        // eslint-disable-next-line prefer-const
        let [desc, funcName] = this.getFunction(e, prefix, funcNamePrefix, name);
        if (!funcName)
            return [[], null];
        return [desc, funcName];
    }
    getSignalFunc(e, clsName) {
        const sigName = this.transformation.transform('signalName', e.$.name);
        const [retType, outArrayLengthIndex] = this.getReturnType(e);
        const [params] = this.getParameters(outArrayLengthIndex, e.parameters);
        const paramComma = params.length > 0 ? ', ' : '';
        return template_processor_1.default.generateSignalMethods(this.config.environment, sigName, clsName, paramComma, params, retType);
    }
    traverseInheritanceTree(girClass, callback, depth = 0, recursive = true) {
        var _a, _b;
        const details = this.getClassDetails(girClass);
        if (!details)
            return;
        const { parentName, qualifiedParentName } = details;
        let parentPtr = null;
        let name = girClass.$.name;
        if (name.indexOf('.') < 0) {
            name = this.name + '.' + name;
        }
        if (parentName && qualifiedParentName) {
            if (this.symTable[qualifiedParentName]) {
                parentPtr = this.symTable[qualifiedParentName] || null;
            }
            if (!parentPtr && parentName == 'Object') {
                parentPtr = this.symTable['GObject.Object'] || null;
            }
            // check circular dependency
            if (typeof ((_a = parentPtr === null || parentPtr === void 0 ? void 0 : parentPtr.$) === null || _a === void 0 ? void 0 : _a.parent) === 'string') {
                let parentName = parentPtr.$.parent;
                if (parentName.indexOf('.') < 0 && ((_b = parentPtr._module) === null || _b === void 0 ? void 0 : _b.name))
                    parentName = parentPtr._module.name + '.' + parentName;
                if (parentName === girClass._fullSymName) {
                    this.log.warn(`Circular dependency found! Ignore next parent "${parentName}".`);
                    recursive = false;
                }
            }
            // this.log.log(
            //     `[traverseInheritanceTree] (depth: ${depth}) ${girClass.$.name} : ${parentName} : ${parent?.$?.parent}`,
            // )
        }
        callback(girClass);
        if (depth >= exports.MAXIMUM_RECUSION_DEPTH) {
            this.log.warn(`Maximum recursion depth of ${exports.MAXIMUM_RECUSION_DEPTH} reached for "${girClass.$.name}"`);
        }
        else {
            if (parentPtr && recursive && depth <= exports.MAXIMUM_RECUSION_DEPTH) {
                this.traverseInheritanceTree(parentPtr, callback, ++depth, recursive);
            }
        }
    }
    forEachInterface(girClass, callback, recurseObjects = false, dups = {}) {
        for (const { $ } of girClass.implements || []) {
            let name = $.name;
            if (name.indexOf('.') < 0) {
                name = this.name + '.' + name;
            }
            if (Object.prototype.hasOwnProperty.call(dups, name)) {
                continue;
            }
            dups[name] = true;
            const iface = this.symTable[name];
            if (iface) {
                callback(iface);
                this.forEachInterface(iface, callback, recurseObjects, dups);
            }
        }
        if (girClass.prerequisite) {
            let parentName = girClass.prerequisite[0].$.name;
            if (!parentName) {
                return;
            }
            if (parentName.indexOf('.') < 0) {
                parentName = this.name + '.' + parentName;
            }
            if (Object.prototype.hasOwnProperty.call(dups, parentName))
                return;
            const parentPtr = this.symTable[parentName];
            if (parentPtr && (parentPtr.prerequisite || recurseObjects)) {
                // iface's prerequisite is also an interface, or it's
                // a class and we also want to recurse classes
                callback(parentPtr);
                this.forEachInterface(parentPtr, callback, recurseObjects, dups);
            }
        }
    }
    forEachInterfaceAndSelf(e, callback) {
        callback(e);
        this.forEachInterface(e, callback);
    }
    isDerivedFromGObject(girClass) {
        let ret = false;
        this.traverseInheritanceTree(girClass, (cls) => {
            if (cls._fullSymName === 'GObject.Object') {
                ret = true;
            }
        });
        return ret;
    }
    checkName(desc, name, localNames) {
        if (!desc || desc.length === 0)
            return [[], false];
        if (!name) {
            // this.log.error(`No name for ${desc}`)
            return [[], false];
        }
        if (localNames[name]) {
            // this.log.warn(`Name ${name} already defined (${desc})`)
            return [[], false];
        }
        localNames[name] = true;
        return [desc, true];
    }
    processFields(cls, localNames) {
        const def = [];
        if (cls.field) {
            for (const f of cls.field) {
                const [desc, name] = this.getVariable(f, false, false, 'field');
                const [aDesc, added] = this.checkName(desc, name, localNames);
                if (added) {
                    def.push(`    ${aDesc[0]}`);
                }
            }
        }
        if (def.length) {
            def.unshift(`    /* Fields of ${cls._fullSymName} */`);
        }
        return def;
    }
    processProperties(cls, localNames, propertyNames) {
        const def = [];
        if (cls.property) {
            for (const p of cls.property) {
                const [desc, name, origName] = this.getProperty(p);
                const [aDesc, added] = this.checkName(desc, name, localNames);
                if (added) {
                    if (origName)
                        propertyNames.push(origName);
                }
                def.push(...aDesc);
            }
        }
        if (def.length) {
            def.unshift(`    /* Properties of ${cls._fullSymName} */`);
        }
        return def;
    }
    /**
     * Instance methods
     * @param cls
     * @param localNames
     */
    processMethods(cls, localNames) {
        const def = [];
        if (cls.method) {
            for (const func of cls.method) {
                const [desc, name] = this.getFunction(func, '    ');
                def.push(...this.checkName(desc, name, localNames)[0]);
            }
        }
        if (def.length) {
            def.unshift(`    /* Methods of ${cls._fullSymName} */`);
        }
        return def;
    }
    exportOverloadableMethods(fnMap, explicits) {
        const def = [];
        for (const k of Array.from(explicits.values())) {
            const f = fnMap.get(k);
            if (f)
                def.push(...f);
        }
        return def;
    }
    /**
     * Instance methods, vfunc_ prefix
     * @param cls
     */
    processVirtualMethods(cls) {
        const [fnMap, explicits] = this.processOverloadableMethods(cls, (e) => {
            let methods = (e['virtual-method'] || []).map((f) => {
                const desc = this.getFunction(f, '    ', 'vfunc_');
                return desc;
            });
            methods = methods.filter((f) => f[1] != null);
            return methods;
        });
        const def = this.exportOverloadableMethods(fnMap, explicits);
        if (def.length) {
            def.unshift(`    /* Virtual methods of ${cls._fullSymName} */`);
        }
        return def;
    }
    processSignals(cls, clsName) {
        const def = [];
        const signals = cls['glib:signal'];
        if (signals) {
            for (const s of signals)
                def.push(...this.getSignalFunc(s, clsName));
        }
        if (def.length) {
            def.unshift(`    /* Signals of ${cls._fullSymName} */`);
        }
        return def;
    }
    stripParamNames(f, ignoreTail = false) {
        const g = f;
        f = f.replace(this.commentRegExp, '');
        const lb = f.split('(', 2);
        if (lb.length < 2)
            console.log(`Bad function definition ${g}`);
        const rb = lb[1].split(')');
        const tail = ignoreTail ? '' : rb[rb.length - 1];
        let params = rb.slice(0, rb.length - 1).join(')');
        params = params.replace(this.paramRegExp, ':');
        params = params.replace(this.optParamRegExp, '?:');
        return `${lb[0]}(${params})${tail}`;
    }
    /**
     * Some classes implement interfaces which are also implemented by a superclass
     * and we need to exclude those in some circumstances
     * @param cls
     * @param iface
     */
    interfaceIsDuplicate(cls, iface) {
        if (typeof iface !== 'string') {
            if (!iface._fullSymName)
                return false;
            iface = iface._fullSymName;
        }
        let rpt = false;
        let bottom = true;
        this.traverseInheritanceTree(cls, (sub) => {
            if (rpt)
                return;
            if (bottom) {
                bottom = false;
                return;
            }
            this.forEachInterface(sub, (e) => {
                if (rpt)
                    return;
                if (e._fullSymName === iface) {
                    rpt = true;
                }
            }, true);
        });
        return rpt;
    }
    getStaticConstructors(e, name, filter) {
        const funcs = e['constructor'];
        if (!Array.isArray(funcs))
            return [[[], null]];
        let ctors = funcs.map((f) => {
            return this.getConstructorFunction(name, f, '    static ', undefined);
        });
        if (filter)
            ctors = ctors.filter(([, funcName]) => funcName && filter(funcName));
        return ctors;
    }
    isGtypeStructFor(e, rec) {
        const isFor = rec.$['glib:is-gtype-struct-for'];
        return isFor && isFor == e.$.name;
    }
    /**
     * Some class/static methods are defined in a separate record which is not
     * exported, but the methods are available as members of the JS constructor.
     * In gjs one can use an instance of the object, a JS constructor or a GType
     * as the methods' instance-parameter.
     * @see https://discourse.gnome.org/t/using-class-methods-like-gtk-widget-class-get-css-name-from-gjs/4001
     * @param girClass
     */
    getClassMethods(girClass) {
        var _a, _b;
        if (!girClass.$.name)
            return [];
        const fName = girClass.$.name + 'Class';
        let rec = (_a = this.ns.record) === null || _a === void 0 ? void 0 : _a.find((r) => r.$.name == fName);
        if (!rec || !this.isGtypeStructFor(girClass, rec)) {
            rec = (_b = this.ns.record) === null || _b === void 0 ? void 0 : _b.find((r) => this.isGtypeStructFor(girClass, r));
            fName == (rec === null || rec === void 0 ? void 0 : rec.$.name);
        }
        if (!rec)
            return [];
        const methods = rec.method || [];
        return methods.map((m) => this.getFunction(m, '    static '));
    }
    getOtherStaticFunctions(girClass, stat = true) {
        const fns = [];
        if (girClass.function) {
            for (const func of girClass.function) {
                const [desc, funcName] = this.getFunction(func, stat ? '    static ' : '    ', undefined, undefined);
                if (funcName && funcName !== 'new')
                    fns.push([desc, funcName]);
            }
        }
        return fns;
    }
    getClassDetails(girClass) {
        if (!girClass || !girClass.$)
            return null;
        const mod = girClass._module ? girClass._module : this;
        let name = this.transformation.transformClassName(girClass.$.name);
        let qualifiedName;
        if (name.indexOf('.') < 0) {
            qualifiedName = mod.name + '.' + name;
        }
        else {
            qualifiedName = name;
            const split = name.split('.');
            name = split[split.length - 1];
        }
        let parentName = undefined;
        let qualifiedParentName = undefined;
        let localParentName = undefined;
        if (girClass.prerequisite) {
            parentName = girClass.prerequisite[0].$.name;
        }
        else if (girClass.$.parent) {
            parentName = girClass.$.parent;
        }
        let parentModName;
        if (parentName) {
            if (parentName.indexOf('.') < 0) {
                qualifiedParentName = mod.name + '.' + parentName;
                parentModName = mod.name;
            }
            else {
                qualifiedParentName = parentName;
                const split = parentName.split('.');
                parentName = split[split.length - 1];
                parentModName = split.slice(0, split.length - 1).join('.');
            }
            localParentName = parentModName == mod.name ? parentName : qualifiedParentName;
        }
        return { name, qualifiedName, parentName, qualifiedParentName, localParentName };
    }
    /**
     * Returns true if the function definitions in f1 and f2 have equivalent signatures
     * @param f1
     * @param f2
     */
    functionSignaturesMatch(f1, f2) {
        return this.stripParamNames(f1) == this.stripParamNames(f2);
    }
    /**
     * See comment for addOverloadableFunctions.
     * Returns true if (a definition from) func is added to map to satisfy
     * an overload, but false if it was forced
     * @param map
     * @param func
     * @param force
     */
    mergeOverloadableFunctions(map, func, force = true) {
        if (!func[1])
            return false;
        const defs = map.get(func[1]);
        if (!defs) {
            if (force)
                map.set(func[1], func[0]);
            return false;
        }
        let result = false;
        for (const newDef of func[0]) {
            let match = false;
            for (const oldDef of defs) {
                if (this.functionSignaturesMatch(newDef, oldDef)) {
                    match = true;
                    break;
                }
            }
            if (!match) {
                defs.push(newDef);
                result = true;
            }
        }
        return result;
    }
    /**
     * fnMap values are equivalent to the second element of a FunctionDescription.
     * If an entry in fnMap is changed its name is added to explicits (set of names which must be declared).
     * If force is true, every function of f2 is added to fnMap and overloads even
     * if it doesn't already contain a function of the same name.
     * @param fnMap
     * @param explicits
     * @param funcs
     * @param force
     */
    addOverloadableFunctions(fnMap, explicits, funcs, force = false) {
        for (const func of funcs) {
            if (!func[1])
                continue;
            if (this.mergeOverloadableFunctions(fnMap, func) || force) {
                explicits.add(func[1]);
            }
        }
    }
    /**
     * Used for <method> and <virtual-method>
     * @param cls
     * @param getMethods
     * @param statics
     */
    processOverloadableMethods(cls, getMethods, statics = false) {
        const fnMap = new Map();
        const explicits = new Set();
        const funcs = getMethods(cls);
        this.addOverloadableFunctions(fnMap, explicits, funcs, true);
        // Have to implement methods from cls' interfaces
        this.forEachInterface(cls, (iface) => {
            if (!this.interfaceIsDuplicate(cls, iface)) {
                const funcs = getMethods(iface);
                this.addOverloadableFunctions(fnMap, explicits, funcs, true);
            }
        }, false);
        // Check for overloads among all inherited methods
        let bottom = true;
        this.traverseInheritanceTree(cls, (e) => {
            if (bottom) {
                bottom = false;
                return;
            }
            if (statics) {
                const funcs = getMethods(e);
                this.addOverloadableFunctions(fnMap, explicits, funcs, false);
            }
            else {
                let self = true;
                this.forEachInterfaceAndSelf(e, (iface) => {
                    if (self || this.interfaceIsDuplicate(cls, iface)) {
                        const funcs = getMethods(iface);
                        this.addOverloadableFunctions(fnMap, explicits, funcs, false);
                    }
                    self = false;
                });
            }
        });
        return [fnMap, explicits];
    }
    processStaticFunctions(cls, getter) {
        const [fnMap, explicits] = this.processOverloadableMethods(cls, getter, true);
        return this.exportOverloadableMethods(fnMap, explicits);
    }
    generateSignalMethods(cls, propertyNames, callbackObjectName) {
        const def = [];
        const isDerivedFromGObject = this.isDerivedFromGObject(cls);
        if (isDerivedFromGObject) {
            let prefix = 'GObject.';
            if (this.name === 'GObject')
                prefix = '';
            for (const prop of propertyNames) {
                def.push(...template_processor_1.default.generateGObjectSignalMethods(this.config.environment, prop, callbackObjectName, prefix));
            }
            def.push(...template_processor_1.default.generateGeneralSignalMethods(this.config.environment));
        }
        return def;
    }
    /**
     * Static methods, <constructor> and <function>
     * @param girClass
     * @param name
     */
    getAllStaticFunctions(girClass, name) {
        const stc = [];
        stc.push(...this.processStaticFunctions(girClass, (cls) => {
            return this.getStaticConstructors(cls, name);
        }));
        stc.push(...this.processStaticFunctions(girClass, (cls) => {
            return this.getOtherStaticFunctions(cls);
        }));
        stc.push(...this.processStaticFunctions(girClass, (cls) => {
            return this.getClassMethods(cls);
        }));
        if (stc.length > 0) {
            stc.unshift('    /* Static methods and pseudo-constructors */');
        }
        return stc;
    }
    generateConstructorAndStaticMethods(girClass, name) {
        const def = [];
        const isDerivedFromGObject = this.isDerivedFromGObject(girClass);
        if (girClass._fullSymName && !exports.STATIC_NAME_ALREADY_EXISTS.includes(girClass._fullSymName)) {
            // Records, classes and interfaces all have a static name
            def.push(`    static name: string`);
        }
        // JS constructor(s)
        if (isDerivedFromGObject) {
            def.push(`    constructor (config?: ${name}_ConstructProps)`, `    _init (config?: ${name}_ConstructProps): void`);
        }
        else {
            const constructor_ = (girClass['constructor'] || []);
            if (constructor_) {
                if (Array.isArray(constructor_)) {
                    for (const f of constructor_) {
                        const [desc, funcName] = this.getConstructorFunction(name, f, '    static ');
                        if (!funcName)
                            continue;
                        if (funcName !== 'new')
                            continue;
                        def.push(...desc);
                        const jsStyleCtor = desc[0].replace('static new', 'constructor').replace(/:[^:]+$/, '');
                        def.push(jsStyleCtor);
                    }
                }
            }
        }
        def.push(...this.getAllStaticFunctions(girClass, name));
        if (isDerivedFromGObject) {
            def.push(`    static $gtype: ${this.packageName === 'GObject-2.0' ? '' : 'GObject.'}Type`);
        }
        return def;
    }
    generateConstructPropsInterface(girClass, name, qualifiedParentName, localParentName) {
        const def = [];
        const isDerivedFromGObject = this.isDerivedFromGObject(girClass);
        if (isDerivedFromGObject) {
            let ext = ' ';
            if (qualifiedParentName) {
                ext = `extends ${localParentName}_ConstructProps `;
            }
            def.push(`export interface ${name}_ConstructProps ${ext}{`);
            const constructPropNames = {};
            if (girClass.property) {
                for (const p of girClass.property) {
                    const [desc, name] = this.getProperty(p, true, true);
                    def.push(...this.checkName(desc, name, constructPropNames)[0]);
                }
            }
            // Include props of implemented interfaces
            if (girClass.implements) {
                this.forEachInterface(girClass, (iface) => {
                    if (iface.property) {
                        for (const p of iface.property) {
                            const [desc, name] = this.getProperty(p, true, true);
                            def.push(...this.checkName(desc, name, constructPropNames)[0]);
                        }
                    }
                });
            }
            def.push('}');
        }
        return def;
    }
    exportEnumeration(e) {
        const def = [];
        if (!e || !e.$ || !this.girBool(e.$.introspectable, true))
            return [];
        let name = e.$.name;
        // E.g. the NetworkManager-1.0 has enum names starting with 80211
        name = this.transformation.transformEnumName(name);
        def.push(`export enum ${name} {`);
        if (e.member) {
            for (const member of e.member) {
                const _name = member.$.name || member.$['glib:nick'] || member.$['c:identifier'];
                if (!_name) {
                    continue;
                }
                const name = this.transformation.transform('enumValue', _name);
                if (/\d/.test(name[0]))
                    def.push(`    /* ${name} (invalid, starts with a number) */`);
                else
                    def.push(`    ${name},`);
            }
        }
        def.push('}');
        return def;
    }
    exportConstant(girVar) {
        const [varDesc, varName] = this.getVariable(girVar, false, false, 'constant');
        if (varName) {
            if (!this.constNames[varName]) {
                this.constNames[varName] = 1;
                return [`export const ${varDesc}`];
            }
            else {
                this.log.warn(`The constant '${varDesc}' has already been exported`);
            }
        }
        return [];
    }
    /**
     * Represents a record or GObject class or interface as a Typescript class
     * @param girClass
     * @param isAbstract
     * @param record
     */
    exportClassInternal(girClass, record = false, isAbstract = false) {
        const def = [];
        // Is this a abstract class? E.g GObject.ObjectClass is a such abstract class and required by UPowerGlib-1.0, UDisks-2.0 and others
        if (girClass.$ && girClass.$['glib:is-gtype-struct-for']) {
            isAbstract = true;
        }
        const details = this.getClassDetails(girClass);
        if (!details)
            return [];
        // eslint-disable-next-line prefer-const
        let { name, qualifiedParentName, localParentName } = details;
        // Properties for construction
        def.push(...this.generateConstructPropsInterface(girClass, name, qualifiedParentName, localParentName));
        // START CLASS
        if (isAbstract) {
            def.push(`export abstract class ${name} {`);
        }
        else {
            def.push(`export class ${name} {`);
        }
        const localNames = {};
        const propertyNames = [];
        // Can't export fields for GObjects because names would clash
        if (record)
            def.push(...this.processFields(girClass, localNames));
        // Copy properties from inheritance tree
        this.traverseInheritanceTree(girClass, (cls) => def.push(...this.processProperties(cls, localNames, propertyNames)));
        // Copy properties from implemented interface
        this.forEachInterface(girClass, (cls) => def.push(...this.processProperties(cls, localNames, propertyNames)));
        // Copy fields from inheritance tree
        this.traverseInheritanceTree(girClass, (cls) => def.push(...this.processFields(cls, localNames)));
        // Copy methods from inheritance tree
        this.traverseInheritanceTree(girClass, (cls) => def.push(...this.processMethods(cls, localNames)));
        // Copy methods from implemented interfaces
        this.forEachInterface(girClass, (cls) => def.push(...this.processMethods(cls, localNames)));
        // Copy virtual methods from inheritance tree
        this.traverseInheritanceTree(girClass, (cls) => def.push(...this.processVirtualMethods(cls)));
        // Copy signals from inheritance tree
        this.traverseInheritanceTree(girClass, (cls) => def.push(...this.processSignals(cls, name)));
        // Copy signals from implemented interfaces
        this.forEachInterface(girClass, (cls) => def.push(...this.processSignals(cls, name)));
        def.push(...this.generateSignalMethods(girClass, propertyNames, name));
        // TODO: Records have fields
        // Static side: default constructor
        def.push(...this.generateConstructorAndStaticMethods(girClass, name));
        // END CLASS
        def.push('}');
        return def;
    }
    exportFunction(e) {
        return this.getFunction(e, 'export function ')[0];
    }
    exportCallback(e) {
        if (!e || !e.$ || !this.girBool(e.$.introspectable, true))
            return [];
        const name = e.$.name;
        const [retType, outArrayLengthIndex] = this.getReturnType(e);
        const [params] = this.getParameters(outArrayLengthIndex, e.parameters);
        const def = [];
        def.push(`export interface ${name} {`);
        def.push(`    (${params}): ${retType}`);
        def.push('}');
        return def;
    }
    exportAlias(girAlias) {
        if (!girAlias || !girAlias.$ || !this.girBool(girAlias.$.introspectable, true))
            return [];
        const typeName = this.typeLookupTransformed(girAlias, true);
        const name = girAlias.$.name;
        return [`type ${name} = ${typeName}`];
    }
    exportInterface(girClass) {
        return this.exportClassInternal(girClass, true);
    }
    exportClass(girClass) {
        return this.exportClassInternal(girClass, false);
    }
    exportJs() {
        const templateProcessor = new template_processor_1.default({
            name: this.name,
            version: this.version,
            importName: this.importName,
        }, this.packageName || undefined, this.config);
        if (this.config.outdir) {
            templateProcessor.create('module.js', this.config.outdir, `${this.packageName}.js`);
        }
        else {
            const moduleContent = templateProcessor.load('module.js');
            this.log.log(moduleContent);
        }
    }
    export(outStream, outputPath) {
        const out = [];
        out.push(...template_processor_1.default.generateTSDocComment(`${this.packageName}`));
        out.push('');
        const deps = this.transitiveDependencies;
        // Always pull in GObject-2.0, as we may need it for e.g. GObject-2.0.type
        if (this.packageName !== 'GObject-2.0') {
            if (!utils_1.Utils.find(deps, (x) => x === 'GObject-2.0')) {
                deps.push('GObject-2.0');
            }
        }
        // Add missing dependencies
        if (this.packageName === 'UnityExtras-7.0') {
            if (!utils_1.Utils.find(deps, (x) => x === 'Unity-7.0')) {
                deps.push('Unity-7.0');
            }
        }
        if (this.packageName === 'UnityExtras-6.0') {
            if (!utils_1.Utils.find(deps, (x) => x === 'Unity-6.0')) {
                deps.push('Unity-6.0');
            }
        }
        if (this.packageName === 'GTop-2.0') {
            if (!utils_1.Utils.find(deps, (x) => x === 'GLib-2.0')) {
                deps.push('GLib-2.0');
            }
        }
        // Module dependencies as type references or imports
        if (this.config.environment === 'gjs') {
            out.push(...template_processor_1.default.generateModuleDependenciesImport('Gjs', 'Gjs', false, this.config));
        }
        else {
            out.push(...template_processor_1.default.generateModuleDependenciesImport('node', 'node', true, this.config));
        }
        for (const dep of deps) {
            // Don't reference yourself as a dependency
            if (this.packageName !== dep) {
                const girFilename = `${dep}.gir`;
                const { name } = utils_1.Utils.splitModuleName(dep);
                const depFile = utils_1.Utils.findFileInDirs(this.config.girDirectories, girFilename);
                if (depFile.exists) {
                    out.push(...template_processor_1.default.generateModuleDependenciesImport(name, dep, false, this.config));
                }
                else {
                    out.push(`// WARN: Dependency not found: '${dep}'`);
                    this.log.error(`Dependency gir file not found: '${girFilename}'`);
                }
            }
        }
        // START Namespace
        if (this.config.buildType === 'types') {
            out.push('');
            out.push(`declare namespace ${this.name} {`);
        }
        // Newline
        out.push('');
        if (this.ns.enumeration)
            for (const e of this.ns.enumeration)
                out.push(...this.exportEnumeration(e));
        if (this.ns.bitfield)
            for (const e of this.ns.bitfield)
                out.push(...this.exportEnumeration(e));
        if (this.ns.constant)
            for (const e of this.ns.constant)
                out.push(...this.exportConstant(e));
        if (this.ns.function)
            for (const e of this.ns.function)
                out.push(...this.exportFunction(e));
        if (this.ns.callback)
            for (const e of this.ns.callback)
                out.push(...this.exportCallback(e));
        if (this.ns.interface)
            for (const e of this.ns.interface)
                out.push(...this.exportClassInternal(e));
        const templateProcessor = new template_processor_1.default({ name: this.name, version: this.version }, this.packageName, this.config);
        // Extra interfaces if a template with the module name  (e.g. '../templates/GObject-2.0.d.ts') is found
        // E.g. used for GObject-2.0 to help define GObject classes in js;
        // these aren't part of gi.
        if (templateProcessor.exists(`${this.packageName}.d.ts`)) {
            const patches = templateProcessor.load(`${this.packageName}.d.ts`);
            out.push(patches);
        }
        if (this.ns.class)
            for (const e of this.ns.class)
                out.push(...this.exportClassInternal(e, false));
        if (this.ns.record)
            for (const e of this.ns.record)
                out.push(...this.exportClassInternal(e, true));
        if (this.ns.union)
            for (const e of this.ns.union)
                out.push(...this.exportClassInternal(e, true));
        if (this.ns.alias)
            // GType is not a number in GJS
            for (const e of this.ns.alias)
                if (this.packageName !== 'GObject-2.0' || e.$.name !== 'Type')
                    out.push(...this.exportAlias(e));
        if (this.packageName === 'GObject-2.0')
            out.push('export interface Type {', '    name: string', '}');
        // END Namespace
        if (this.config.buildType === 'types') {
            out.push(`}`);
        }
        // End of file
        outStream.write(out.join('\n'));
        if (outputPath) {
            templateProcessor.prettify(outputPath);
        }
    }
}
exports.GirModule = GirModule;
//# sourceMappingURL=gir-module.js.map