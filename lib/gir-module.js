"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const template_processor_1 = __importDefault(require("./template-processor"));
const transformation_1 = require("./transformation");
const logger_1 = require("./logger");
const utils_1 = require("./utils");
/**
 * In gjs all classes haben einen static name property but the classes listed here already have a static name property
 */
exports.STATIC_NAME_ALREADY_EXISTS = ['GMime.Charset', 'Camel.StoreInfo'];
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
                const nsName = girClass ? girClass._fullSymName : this.name;
                func._fullSymName = `${nsName}.${func.$.name}`;
                this.annotateFunctionArguments(func);
                this.annotateFunctionReturn(func);
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
        var _a;
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
        else {
            return 'any';
        }
        if (girVar.$) {
            const nullable = this.girBool(girVar.$.nullable) || this.girBool(girVar.$['allow-none']);
            if (nullable) {
                nul = ' | null';
            }
        }
        if (!type.$)
            return 'any';
        const suffix = (arr + nul);
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
        let fullTypeName = type.$.name;
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
        return fullTypeName + suffix;
    }
    /**
     * E.g. replaces something like `NetworkManager.80211ApFlags` with `NetworkManager.TODO_80211ApFlags`
     * @param girVar
     */
    typeLookupTransformed(girVar) {
        let names = this.typeLookup(girVar).split('.');
        names = names.map(name => this.transformation.transformTypeName(name));
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
    getReturnType(e) {
        var _a;
        let returnType;
        const returnVal = e['return-value'] ? e['return-value'][0] : undefined;
        if (returnVal) {
            returnType = this.typeLookupTransformed(returnVal);
        }
        else
            returnType = 'void';
        const outArrayLengthIndex = returnVal.array && ((_a = returnVal.array[0].$) === null || _a === void 0 ? void 0 : _a.length) ? Number(returnVal.array[0].$.length) : -1;
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
    getParameters(outArrayLengthIndex, parameters) {
        const def = [];
        const outParams = [];
        if (parameters && parameters.length > 0) {
            const parametersArray = parameters[0].parameter;
            if (parametersArray) {
                const skip = outArrayLengthIndex === -1 ? [] : [parametersArray[outArrayLengthIndex]];
                this.processParams(parametersArray, skip, this.arrayLengthIndexLookup);
                this.processParams(parametersArray, skip, this.closureDataIndexLookup);
                this.processParams(parametersArray, skip, this.destroyDataIndexLookup);
                for (const param of parametersArray) {
                    const paramName = this.transformation.transformParameterName(param.$.name || '-', false);
                    const paramType = this.typeLookupTransformed(param);
                    if (skip.indexOf(param) !== -1) {
                        continue;
                    }
                    const optDirection = param.$.direction;
                    if (optDirection) {
                        if (optDirection === 'out') {
                            outParams.push(`/* ${paramName} */ ${paramType}`);
                            continue;
                        }
                    }
                    let isOptional = param.$['allow-none'] ? '?' : '';
                    if (isOptional) {
                        const index = parametersArray.indexOf(param);
                        const following = parametersArray
                            .slice(index)
                            .filter(() => skip.indexOf(param) === -1)
                            .filter(p => p.$.direction !== 'out');
                        if (following.some(p => !p.$['allow-none'])) {
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
        let typeName = this.typeLookupTransformed(v);
        const nameSuffix = optional ? '?' : '';
        typeName = this.transformation.transformTypeName(typeName);
        return [[`${name}${nameSuffix}: ${typeName}`], name];
    }
    getProperty(v, construct = false) {
        if (this.girBool(v.$['construct-only']) && !construct)
            return [[], null, null];
        if (!this.girBool(v.$.writable) && construct)
            return [[], null, null];
        if (this.girBool(v.$.private))
            return [[], null, null];
        const propPrefix = this.girBool(v.$.writable) ? '' : 'readonly ';
        const [propDesc, propName] = this.getVariable(v, construct, true, 'property');
        let origName = null;
        if (!propName)
            return [[], null, null];
        if (v.$.name) {
            // TODO does that make sense here? This also changes the signal names
            origName = this.transformation.transformTypeName(v.$.name);
        }
        return [[`    ${propPrefix}${propDesc}`], propName, origName];
    }
    getFunction(e, prefix, funcNamePrefix = '') {
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
        if (outParams.length + (retTypeIsVoid ? 0 : 1) > 1) {
            if (!retTypeIsVoid) {
                outParams.unshift(`/* returnType */ ${retType}`);
            }
            const retDesc = outParams.join(', ');
            retType = `[ ${retDesc} ]`;
        }
        else if (outParams.length === 1 && retTypeIsVoid) {
            retType = outParams[0];
        }
        return [[`${prefix}${name}(${params}): ${retType}`], name];
    }
    getConstructorFunction(name, e, prefix, funcNamePrefix = '') {
        // eslint-disable-next-line prefer-const
        let [desc, funcName] = this.getFunction(e, prefix, funcNamePrefix);
        if (!funcName)
            return [[], null];
        const [retType] = this.getReturnType(e);
        if (retType.split(' ')[0] !== name) {
            // this.log.warn(`Constructor returns ${retType} should return ${name}`)
            // Force constructors to return the type of the class they are actually
            // constructing. In a lot of cases the GI data says they return a base
            // class instead; I'm not sure why.
            e['return-value'] = [
                {
                    $: {
                    // nullable
                    },
                    type: [
                        {
                            $: {
                                name: name,
                            },
                        },
                    ],
                },
            ];
            desc = this.getFunction(e, prefix)[0];
        }
        return [desc, funcName];
    }
    getSignalFunc(e, clsName) {
        const sigName = this.transformation.transform('signalName', e.$.name);
        const [retType, outArrayLengthIndex] = this.getReturnType(e);
        const [params] = this.getParameters(outArrayLengthIndex, e.parameters);
        const paramComma = params.length > 0 ? ', ' : '';
        return template_processor_1.default.generateSignalMethods(this.config.environment, sigName, clsName, paramComma, params, retType);
    }
    traverseInheritanceTree(girClass, callback) {
        if (!girClass || !girClass.$)
            return;
        let parent = null;
        // const parentModule: GirModule | undefined = undefined
        const mod = girClass._module ? girClass._module : this;
        let name = girClass.$.name;
        if (name.indexOf('.') < 0) {
            name = mod.name + '.' + name;
        }
        if (girClass.$.parent) {
            let parentName = girClass.$.parent;
            const origParentName = parentName;
            if (parentName.indexOf('.') < 0) {
                parentName = mod.name + '.' + parentName;
            }
            if (this.symTable[parentName]) {
                parent = this.symTable[parentName];
            }
            if (!parent && origParentName === 'Object') {
                parent = this.symTable['GObject.Object'] || null;
            }
        }
        // this.log.log(`${girClass.$.name} : ${parent && parent.$ ? parent.$.name : 'none'} : ${parentModule ? parentModule.name : 'none'}`)
        callback(girClass);
        if (parent)
            this.traverseInheritanceTree(parent, callback);
    }
    forEachInterface(girClass, callback) {
        for (const { $ } of girClass.implements || []) {
            let name = $.name;
            if (name.indexOf('.') < 0) {
                name = this.name + '.' + name;
            }
            const iface = this.symTable[name];
            if (iface) {
                callback(iface);
            }
        }
    }
    isDerivedFromGObject(girClass) {
        let ret = false;
        this.traverseInheritanceTree(girClass, cls => {
            if (cls._fullSymName === 'GObject.Object') {
                ret = true;
            }
        });
        return ret;
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
    exportObjectInternal(girClass, isAbstract = false) {
        const name = this.transformation.transformClassName(girClass.$.name);
        let def = [];
        const isDerivedFromGObject = this.isDerivedFromGObject(girClass);
        // Is this a abstract class? E.g GObject.ObjectClass is a such abstract class and required by UPowerGlib-1.0, UDisks-2.0 and others
        if (girClass.$ && girClass.$['glib:is-gtype-struct-for']) {
            isAbstract = true;
        }
        const checkName = (desc, name, localNames) => {
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
            localNames[name] = 1;
            return [desc, true];
        };
        let parentName = null;
        let counter = 0;
        this.traverseInheritanceTree(girClass, cls => {
            if (counter++ !== 1)
                return;
            parentName = cls._fullSymName || null;
        });
        let parentNameShort = parentName || '';
        if (parentNameShort && this.name) {
            const s = parentNameShort.split('.', 2);
            if (s[0] === this.name) {
                parentNameShort = s[1];
            }
        }
        // Properties for construction
        if (isDerivedFromGObject) {
            let ext = ' ';
            if (parentName)
                ext = `extends ${parentNameShort}_ConstructProps `;
            def.push(`export interface ${name}_ConstructProps ${ext}{`);
            const constructPropNames = {};
            if (girClass.property) {
                for (const p of girClass.property) {
                    const [desc, name] = this.getProperty(p, true);
                    def = def.concat(checkName(desc, name, constructPropNames)[0]);
                }
            }
            def.push('}');
        }
        // Instance side
        if (isAbstract) {
            def.push(`export abstract class ${name} {`);
        }
        else {
            def.push(`export class ${name} {`);
        }
        const localNames = {};
        const propertyNames = [];
        const copyProperties = (cls) => {
            if (cls.property) {
                def.push(`    /* Properties of ${cls._fullSymName} */`);
                for (const p of cls.property) {
                    const [desc, name, origName] = this.getProperty(p);
                    const [aDesc, added] = checkName(desc, name, localNames);
                    if (added) {
                        if (origName)
                            propertyNames.push(origName);
                    }
                    def = def.concat(aDesc);
                }
            }
        };
        this.traverseInheritanceTree(girClass, copyProperties);
        this.forEachInterface(girClass, copyProperties);
        // Fields
        const copyFields = (cls) => {
            if (cls.field) {
                def.push(`    /* Fields of ${cls._fullSymName} */`);
                for (const f of cls.field) {
                    const [desc, name] = this.getVariable(f, false, false, 'field');
                    const [aDesc, added] = checkName(desc, name, localNames);
                    if (added) {
                        def.push(`    ${aDesc[0]}`);
                    }
                }
            }
        };
        this.traverseInheritanceTree(girClass, copyFields);
        // Instance methods
        const copyMethods = (cls) => {
            if (cls.method) {
                def.push(`    /* Methods of ${cls._fullSymName} */`);
                for (const func of cls.method) {
                    const [desc, name] = this.getFunction(func, '    ');
                    def = def.concat(checkName(desc, name, localNames)[0]);
                }
            }
        };
        this.traverseInheritanceTree(girClass, copyMethods);
        this.forEachInterface(girClass, copyMethods);
        // Instance methods, vfunc_ prefix
        this.traverseInheritanceTree(girClass, cls => {
            const vmeth = cls['virtual-method'];
            if (vmeth) {
                def.push(`    /* Virtual methods of ${cls._fullSymName} */`);
                for (const f of vmeth) {
                    // eslint-disable-next-line prefer-const
                    let [desc, name] = this.getFunction(f, '    ', 'vfunc_');
                    desc = checkName(desc, name, localNames)[0];
                    if (desc[0]) {
                        desc[0] = desc[0].replace('(', '?(');
                    }
                    def = def.concat(desc);
                }
            }
        });
        const copySignals = (cls) => {
            const signals = cls['glib:signal'];
            if (signals) {
                def.push(`    /* Signals of ${cls._fullSymName} */`);
                for (const s of signals)
                    def = def.concat(this.getSignalFunc(s, name));
            }
        };
        this.traverseInheritanceTree(girClass, copySignals);
        this.forEachInterface(girClass, copySignals);
        if (isDerivedFromGObject) {
            let prefix = 'GObject.';
            if (this.name === 'GObject')
                prefix = '';
            for (const p of propertyNames) {
                def = def.concat(template_processor_1.default.generateGObjectSignalMethods(this.config.environment, p, name, prefix));
            }
            def = def.concat(template_processor_1.default.generateGeneralSignalMethods(this.config.environment));
        }
        // TODO: Records have fields
        // Static side: default constructor
        if (girClass._fullSymName && !exports.STATIC_NAME_ALREADY_EXISTS.includes(girClass._fullSymName)) {
            def.push(`    static name: string`);
        }
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
                        def = def.concat(desc);
                        const jsStyleCtor = desc[0].replace('static new', 'constructor').replace(/:[^:]+$/, '');
                        def = def.concat(jsStyleCtor);
                    }
                }
                // else {
                //     debugger
                // }
            }
        }
        // Static methods
        let stc = [];
        const constructor_ = (girClass['constructor'] || []);
        if (constructor_) {
            if (Array.isArray(constructor_)) {
                for (const f of constructor_) {
                    const [desc, funcName] = this.getConstructorFunction(name, f, '    static ');
                    if (!funcName)
                        continue;
                    stc = stc.concat(desc);
                }
            }
            // else {
            //     this.log.warn('Warn: constructor_ is not an array:')
            //     this.log.dir(constructor_)
            //     debugger
            // }
        }
        if (girClass.function) {
            for (const f of girClass.function) {
                const [desc, funcName] = this.getFunction(f, '    static ');
                if (funcName === 'new')
                    continue;
                stc = stc.concat(desc);
            }
        }
        if (stc.length > 0) {
            def = def.concat(stc);
        }
        if (isDerivedFromGObject) {
            def.push(`    static $gtype: ${this.packageName === 'GObject-2.0' ? '' : 'GObject.'}Type`);
        }
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
        const typeName = this.typeLookupTransformed(girAlias);
        const name = girAlias.$.name;
        return [`type ${name} = ${typeName}`];
    }
    exportInterface(girClass) {
        return this.exportObjectInternal(girClass);
    }
    exportClass(girClass) {
        return this.exportObjectInternal(girClass);
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
        let out = [];
        out = out.concat(template_processor_1.default.generateTSDocComment(`${this.packageName}`));
        out.push('');
        const deps = this.transitiveDependencies;
        // Always pull in GObject-2.0, as we may need it for e.g. GObject-2.0.type
        if (this.packageName !== 'GObject-2.0') {
            if (!utils_1.Utils.find(deps, x => x === 'GObject-2.0')) {
                deps.push('GObject-2.0');
            }
        }
        // Add missing dependencies
        if (this.packageName === 'UnityExtras-7.0') {
            if (!utils_1.Utils.find(deps, x => x === 'Unity-7.0')) {
                deps.push('Unity-7.0');
            }
        }
        if (this.packageName === 'UnityExtras-6.0') {
            if (!utils_1.Utils.find(deps, x => x === 'Unity-6.0')) {
                deps.push('Unity-6.0');
            }
        }
        if (this.packageName === 'GTop-2.0') {
            if (!utils_1.Utils.find(deps, x => x === 'GLib-2.0')) {
                deps.push('GLib-2.0');
            }
        }
        // Module dependencies as type references or imports
        if (this.config.environment === 'gjs') {
            out = out.concat(template_processor_1.default.generateModuleDependenciesImport('Gjs', 'Gjs', false, this.config));
        }
        else {
            out = out.concat(template_processor_1.default.generateModuleDependenciesImport('node', 'node', true, this.config));
        }
        for (const dep of deps) {
            // Don't reference yourself as a dependency
            if (this.packageName !== dep) {
                const girFilename = `${dep}.gir`;
                const { name } = utils_1.Utils.splitModuleName(dep);
                const depFile = utils_1.Utils.findFileInDirs(this.config.girDirectories, girFilename);
                if (depFile.exists) {
                    out = out.concat(template_processor_1.default.generateModuleDependenciesImport(name, dep, false, this.config));
                }
                else {
                    out = out.concat(`// WARN: Dependency not found: '${dep}'`);
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
                out = out.concat(this.exportEnumeration(e));
        if (this.ns.bitfield)
            for (const e of this.ns.bitfield)
                out = out.concat(this.exportEnumeration(e));
        if (this.ns.constant)
            for (const e of this.ns.constant)
                out = out.concat(this.exportConstant(e));
        if (this.ns.function)
            for (const e of this.ns.function)
                out = out.concat(this.exportFunction(e));
        if (this.ns.callback)
            for (const e of this.ns.callback)
                out = out.concat(this.exportCallback(e));
        if (this.ns.interface)
            for (const e of this.ns.interface)
                out = out.concat(this.exportInterface(e));
        const templateProcessor = new template_processor_1.default({ name: this.name, version: this.version }, this.packageName, this.config);
        // Extra interfaces if a template with the module name  (e.g. '../templates/GObject-2.0.d.ts') is found
        // E.g. used for GObject-2.0 to help define GObject classes in js;
        // these aren't part of gi.
        if (templateProcessor.exists(`${this.packageName}.d.ts`)) {
            const patches = templateProcessor.load(`${this.packageName}.d.ts`);
            out = out.concat(patches);
        }
        if (this.ns.class)
            for (const e of this.ns.class)
                out = out.concat(this.exportInterface(e));
        if (this.ns.record)
            for (const e of this.ns.record)
                out = out.concat(this.exportInterface(e));
        if (this.ns.union)
            for (const e of this.ns.union)
                out = out.concat(this.exportInterface(e));
        if (this.ns.alias)
            // GType is not a number in GJS
            for (const e of this.ns.alias)
                if (this.packageName !== 'GObject-2.0' || e.$.name !== 'Type')
                    out = out.concat(this.exportAlias(e));
        if (this.packageName === 'GObject-2.0')
            out = out.concat(['export interface Type {', '    name: string', '}']);
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