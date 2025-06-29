import process from "node:process";

var util$1;

(function(util) {
    util.assertEqual = _ => {};
    function assertIs(_arg) {}
    util.assertIs = assertIs;
    function assertNever(_x) {
        throw new Error;
    }
    util.assertNever = assertNever;
    util.arrayToEnum = items => {
        const obj = {};
        for (const item of items) {
            obj[item] = item;
        }
        return obj;
    };
    util.getValidEnumValues = obj => {
        const validKeys = util.objectKeys(obj).filter(k => typeof obj[obj[k]] !== "number");
        const filtered = {};
        for (const k of validKeys) {
            filtered[k] = obj[k];
        }
        return util.objectValues(filtered);
    };
    util.objectValues = obj => util.objectKeys(obj).map(function(e) {
        return obj[e];
    });
    util.objectKeys = typeof Object.keys === "function" ? obj => Object.keys(obj) : object => {
        const keys = [];
        for (const key in object) {
            if (Object.prototype.hasOwnProperty.call(object, key)) {
                keys.push(key);
            }
        }
        return keys;
    };
    util.find = (arr, checker) => {
        for (const item of arr) {
            if (checker(item)) return item;
        }
        return undefined;
    };
    util.isInteger = typeof Number.isInteger === "function" ? val => Number.isInteger(val) : val => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
    function joinValues(array, separator = " | ") {
        return array.map(val => typeof val === "string" ? `'${val}'` : val).join(separator);
    }
    util.joinValues = joinValues;
    util.jsonStringifyReplacer = (_, value) => {
        if (typeof value === "bigint") {
            return value.toString();
        }
        return value;
    };
})(util$1 || (util$1 = {}));

var objectUtil;

(function(objectUtil) {
    objectUtil.mergeShapes = (first, second) => ({
        ...first,
        ...second
    });
})(objectUtil || (objectUtil = {}));

const ZodParsedType = util$1.arrayToEnum([ "string", "nan", "number", "integer", "float", "boolean", "date", "bigint", "symbol", "function", "undefined", "null", "array", "object", "unknown", "promise", "void", "never", "map", "set" ]);

const getParsedType = data => {
    const t = typeof data;
    switch (t) {
      case "undefined":
        return ZodParsedType.undefined;

      case "string":
        return ZodParsedType.string;

      case "number":
        return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;

      case "boolean":
        return ZodParsedType.boolean;

      case "function":
        return ZodParsedType.function;

      case "bigint":
        return ZodParsedType.bigint;

      case "symbol":
        return ZodParsedType.symbol;

      case "object":
        if (Array.isArray(data)) {
            return ZodParsedType.array;
        }
        if (data === null) {
            return ZodParsedType.null;
        }
        if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
            return ZodParsedType.promise;
        }
        if (typeof Map !== "undefined" && data instanceof Map) {
            return ZodParsedType.map;
        }
        if (typeof Set !== "undefined" && data instanceof Set) {
            return ZodParsedType.set;
        }
        if (typeof Date !== "undefined" && data instanceof Date) {
            return ZodParsedType.date;
        }
        return ZodParsedType.object;

      default:
        return ZodParsedType.unknown;
    }
};

const ZodIssueCode = util$1.arrayToEnum([ "invalid_type", "invalid_literal", "custom", "invalid_union", "invalid_union_discriminator", "invalid_enum_value", "unrecognized_keys", "invalid_arguments", "invalid_return_type", "invalid_date", "invalid_string", "too_small", "too_big", "invalid_intersection_types", "not_multiple_of", "not_finite" ]);

class ZodError extends Error {
    get errors() {
        return this.issues;
    }
    constructor(issues) {
        super();
        this.issues = [];
        this.addIssue = sub => {
            this.issues = [ ...this.issues, sub ];
        };
        this.addIssues = (subs = []) => {
            this.issues = [ ...this.issues, ...subs ];
        };
        const actualProto = new.target.prototype;
        if (Object.setPrototypeOf) {
            Object.setPrototypeOf(this, actualProto);
        } else {
            this.__proto__ = actualProto;
        }
        this.name = "ZodError";
        this.issues = issues;
    }
    format(_mapper) {
        const mapper = _mapper || function(issue) {
            return issue.message;
        };
        const fieldErrors = {
            _errors: []
        };
        const processError = error => {
            for (const issue of error.issues) {
                if (issue.code === "invalid_union") {
                    issue.unionErrors.map(processError);
                } else if (issue.code === "invalid_return_type") {
                    processError(issue.returnTypeError);
                } else if (issue.code === "invalid_arguments") {
                    processError(issue.argumentsError);
                } else if (issue.path.length === 0) {
                    fieldErrors._errors.push(mapper(issue));
                } else {
                    let curr = fieldErrors;
                    let i = 0;
                    while (i < issue.path.length) {
                        const el = issue.path[i];
                        const terminal = i === issue.path.length - 1;
                        if (!terminal) {
                            curr[el] = curr[el] || {
                                _errors: []
                            };
                        } else {
                            curr[el] = curr[el] || {
                                _errors: []
                            };
                            curr[el]._errors.push(mapper(issue));
                        }
                        curr = curr[el];
                        i++;
                    }
                }
            }
        };
        processError(this);
        return fieldErrors;
    }
    static assert(value) {
        if (!(value instanceof ZodError)) {
            throw new Error(`Not a ZodError: ${value}`);
        }
    }
    toString() {
        return this.message;
    }
    get message() {
        return JSON.stringify(this.issues, util$1.jsonStringifyReplacer, 2);
    }
    get isEmpty() {
        return this.issues.length === 0;
    }
    flatten(mapper = issue => issue.message) {
        const fieldErrors = {};
        const formErrors = [];
        for (const sub of this.issues) {
            if (sub.path.length > 0) {
                fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
                fieldErrors[sub.path[0]].push(mapper(sub));
            } else {
                formErrors.push(mapper(sub));
            }
        }
        return {
            formErrors,
            fieldErrors
        };
    }
    get formErrors() {
        return this.flatten();
    }
}

ZodError.create = issues => {
    const error = new ZodError(issues);
    return error;
};

const errorMap = (issue, _ctx) => {
    let message;
    switch (issue.code) {
      case ZodIssueCode.invalid_type:
        if (issue.received === ZodParsedType.undefined) {
            message = "Required";
        } else {
            message = `Expected ${issue.expected}, received ${issue.received}`;
        }
        break;

      case ZodIssueCode.invalid_literal:
        message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util$1.jsonStringifyReplacer)}`;
        break;

      case ZodIssueCode.unrecognized_keys:
        message = `Unrecognized key(s) in object: ${util$1.joinValues(issue.keys, ", ")}`;
        break;

      case ZodIssueCode.invalid_union:
        message = `Invalid input`;
        break;

      case ZodIssueCode.invalid_union_discriminator:
        message = `Invalid discriminator value. Expected ${util$1.joinValues(issue.options)}`;
        break;

      case ZodIssueCode.invalid_enum_value:
        message = `Invalid enum value. Expected ${util$1.joinValues(issue.options)}, received '${issue.received}'`;
        break;

      case ZodIssueCode.invalid_arguments:
        message = `Invalid function arguments`;
        break;

      case ZodIssueCode.invalid_return_type:
        message = `Invalid function return type`;
        break;

      case ZodIssueCode.invalid_date:
        message = `Invalid date`;
        break;

      case ZodIssueCode.invalid_string:
        if (typeof issue.validation === "object") {
            if ("includes" in issue.validation) {
                message = `Invalid input: must include "${issue.validation.includes}"`;
                if (typeof issue.validation.position === "number") {
                    message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
                }
            } else if ("startsWith" in issue.validation) {
                message = `Invalid input: must start with "${issue.validation.startsWith}"`;
            } else if ("endsWith" in issue.validation) {
                message = `Invalid input: must end with "${issue.validation.endsWith}"`;
            } else {
                util$1.assertNever(issue.validation);
            }
        } else if (issue.validation !== "regex") {
            message = `Invalid ${issue.validation}`;
        } else {
            message = "Invalid";
        }
        break;

      case ZodIssueCode.too_small:
        if (issue.type === "array") message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`; else if (issue.type === "string") message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`; else if (issue.type === "number") message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`; else if (issue.type === "date") message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`; else message = "Invalid input";
        break;

      case ZodIssueCode.too_big:
        if (issue.type === "array") message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`; else if (issue.type === "string") message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`; else if (issue.type === "number") message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`; else if (issue.type === "bigint") message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`; else if (issue.type === "date") message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`; else message = "Invalid input";
        break;

      case ZodIssueCode.custom:
        message = `Invalid input`;
        break;

      case ZodIssueCode.invalid_intersection_types:
        message = `Intersection results could not be merged`;
        break;

      case ZodIssueCode.not_multiple_of:
        message = `Number must be a multiple of ${issue.multipleOf}`;
        break;

      case ZodIssueCode.not_finite:
        message = "Number must be finite";
        break;

      default:
        message = _ctx.defaultError;
        util$1.assertNever(issue);
    }
    return {
        message
    };
};

let overrideErrorMap = errorMap;

function getErrorMap() {
    return overrideErrorMap;
}

const makeIssue = params => {
    const {data, path, errorMaps, issueData} = params;
    const fullPath = [ ...path, ...issueData.path || [] ];
    const fullIssue = {
        ...issueData,
        path: fullPath
    };
    if (issueData.message !== undefined) {
        return {
            ...issueData,
            path: fullPath,
            message: issueData.message
        };
    }
    let errorMessage = "";
    const maps = errorMaps.filter(m => !!m).slice().reverse();
    for (const map of maps) {
        errorMessage = map(fullIssue, {
            data,
            defaultError: errorMessage
        }).message;
    }
    return {
        ...issueData,
        path: fullPath,
        message: errorMessage
    };
};

function addIssueToContext(ctx, issueData) {
    const overrideMap = getErrorMap();
    const issue = makeIssue({
        issueData,
        data: ctx.data,
        path: ctx.path,
        errorMaps: [ ctx.common.contextualErrorMap, ctx.schemaErrorMap, overrideMap, overrideMap === errorMap ? undefined : errorMap ].filter(x => !!x)
    });
    ctx.common.issues.push(issue);
}

class ParseStatus {
    constructor() {
        this.value = "valid";
    }
    dirty() {
        if (this.value === "valid") this.value = "dirty";
    }
    abort() {
        if (this.value !== "aborted") this.value = "aborted";
    }
    static mergeArray(status, results) {
        const arrayValue = [];
        for (const s of results) {
            if (s.status === "aborted") return INVALID;
            if (s.status === "dirty") status.dirty();
            arrayValue.push(s.value);
        }
        return {
            status: status.value,
            value: arrayValue
        };
    }
    static async mergeObjectAsync(status, pairs) {
        const syncPairs = [];
        for (const pair of pairs) {
            const key = await pair.key;
            const value = await pair.value;
            syncPairs.push({
                key,
                value
            });
        }
        return ParseStatus.mergeObjectSync(status, syncPairs);
    }
    static mergeObjectSync(status, pairs) {
        const finalObject = {};
        for (const pair of pairs) {
            const {key, value} = pair;
            if (key.status === "aborted") return INVALID;
            if (value.status === "aborted") return INVALID;
            if (key.status === "dirty") status.dirty();
            if (value.status === "dirty") status.dirty();
            if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
                finalObject[key.value] = value.value;
            }
        }
        return {
            status: status.value,
            value: finalObject
        };
    }
}

const INVALID = Object.freeze({
    status: "aborted"
});

const DIRTY = value => ({
    status: "dirty",
    value
});

const OK = value => ({
    status: "valid",
    value
});

const isAborted = x => x.status === "aborted";

const isDirty = x => x.status === "dirty";

const isValid = x => x.status === "valid";

const isAsync = x => typeof Promise !== "undefined" && x instanceof Promise;

var errorUtil;

(function(errorUtil) {
    errorUtil.errToObj = message => typeof message === "string" ? {
        message
    } : message || {};
    errorUtil.toString = message => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

class ParseInputLazyPath {
    constructor(parent, value, path, key) {
        this._cachedPath = [];
        this.parent = parent;
        this.data = value;
        this._path = path;
        this._key = key;
    }
    get path() {
        if (!this._cachedPath.length) {
            if (Array.isArray(this._key)) {
                this._cachedPath.push(...this._path, ...this._key);
            } else {
                this._cachedPath.push(...this._path, this._key);
            }
        }
        return this._cachedPath;
    }
}

const handleResult = (ctx, result) => {
    if (isValid(result)) {
        return {
            success: true,
            data: result.value
        };
    } else {
        if (!ctx.common.issues.length) {
            throw new Error("Validation failed but no issues detected.");
        }
        return {
            success: false,
            get error() {
                if (this._error) return this._error;
                const error = new ZodError(ctx.common.issues);
                this._error = error;
                return this._error;
            }
        };
    }
};

function processCreateParams$1(params) {
    if (!params) return {};
    const {errorMap, invalid_type_error, required_error, description} = params;
    if (errorMap && (invalid_type_error || required_error)) {
        throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
    }
    if (errorMap) return {
        errorMap,
        description
    };
    const customMap = (iss, ctx) => {
        const {message} = params;
        if (iss.code === "invalid_enum_value") {
            return {
                message: message ?? ctx.defaultError
            };
        }
        if (typeof ctx.data === "undefined") {
            return {
                message: message ?? required_error ?? ctx.defaultError
            };
        }
        if (iss.code !== "invalid_type") return {
            message: ctx.defaultError
        };
        return {
            message: message ?? invalid_type_error ?? ctx.defaultError
        };
    };
    return {
        errorMap: customMap,
        description
    };
}

class ZodType {
    get description() {
        return this._def.description;
    }
    _getType(input) {
        return getParsedType(input.data);
    }
    _getOrReturnCtx(input, ctx) {
        return ctx || {
            common: input.parent.common,
            data: input.data,
            parsedType: getParsedType(input.data),
            schemaErrorMap: this._def.errorMap,
            path: input.path,
            parent: input.parent
        };
    }
    _processInputParams(input) {
        return {
            status: new ParseStatus,
            ctx: {
                common: input.parent.common,
                data: input.data,
                parsedType: getParsedType(input.data),
                schemaErrorMap: this._def.errorMap,
                path: input.path,
                parent: input.parent
            }
        };
    }
    _parseSync(input) {
        const result = this._parse(input);
        if (isAsync(result)) {
            throw new Error("Synchronous parse encountered promise.");
        }
        return result;
    }
    _parseAsync(input) {
        const result = this._parse(input);
        return Promise.resolve(result);
    }
    parse(data, params) {
        const result = this.safeParse(data, params);
        if (result.success) return result.data;
        throw result.error;
    }
    safeParse(data, params) {
        const ctx = {
            common: {
                issues: [],
                async: params?.async ?? false,
                contextualErrorMap: params?.errorMap
            },
            path: params?.path || [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data,
            parsedType: getParsedType(data)
        };
        const result = this._parseSync({
            data,
            path: ctx.path,
            parent: ctx
        });
        return handleResult(ctx, result);
    }
    "~validate"(data) {
        const ctx = {
            common: {
                issues: [],
                async: !!this["~standard"].async
            },
            path: [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data,
            parsedType: getParsedType(data)
        };
        if (!this["~standard"].async) {
            try {
                const result = this._parseSync({
                    data,
                    path: [],
                    parent: ctx
                });
                return isValid(result) ? {
                    value: result.value
                } : {
                    issues: ctx.common.issues
                };
            } catch (err) {
                if (err?.message?.toLowerCase()?.includes("encountered")) {
                    this["~standard"].async = true;
                }
                ctx.common = {
                    issues: [],
                    async: true
                };
            }
        }
        return this._parseAsync({
            data,
            path: [],
            parent: ctx
        }).then(result => isValid(result) ? {
            value: result.value
        } : {
            issues: ctx.common.issues
        });
    }
    async parseAsync(data, params) {
        const result = await this.safeParseAsync(data, params);
        if (result.success) return result.data;
        throw result.error;
    }
    async safeParseAsync(data, params) {
        const ctx = {
            common: {
                issues: [],
                contextualErrorMap: params?.errorMap,
                async: true
            },
            path: params?.path || [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data,
            parsedType: getParsedType(data)
        };
        const maybeAsyncResult = this._parse({
            data,
            path: ctx.path,
            parent: ctx
        });
        const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
        return handleResult(ctx, result);
    }
    refine(check, message) {
        const getIssueProperties = val => {
            if (typeof message === "string" || typeof message === "undefined") {
                return {
                    message
                };
            } else if (typeof message === "function") {
                return message(val);
            } else {
                return message;
            }
        };
        return this._refinement((val, ctx) => {
            const result = check(val);
            const setError = () => ctx.addIssue({
                code: ZodIssueCode.custom,
                ...getIssueProperties(val)
            });
            if (typeof Promise !== "undefined" && result instanceof Promise) {
                return result.then(data => {
                    if (!data) {
                        setError();
                        return false;
                    } else {
                        return true;
                    }
                });
            }
            if (!result) {
                setError();
                return false;
            } else {
                return true;
            }
        });
    }
    refinement(check, refinementData) {
        return this._refinement((val, ctx) => {
            if (!check(val)) {
                ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
                return false;
            } else {
                return true;
            }
        });
    }
    _refinement(refinement) {
        return new ZodEffects({
            schema: this,
            typeName: ZodFirstPartyTypeKind.ZodEffects,
            effect: {
                type: "refinement",
                refinement
            }
        });
    }
    superRefine(refinement) {
        return this._refinement(refinement);
    }
    constructor(def) {
        this.spa = this.safeParseAsync;
        this._def = def;
        this.parse = this.parse.bind(this);
        this.safeParse = this.safeParse.bind(this);
        this.parseAsync = this.parseAsync.bind(this);
        this.safeParseAsync = this.safeParseAsync.bind(this);
        this.spa = this.spa.bind(this);
        this.refine = this.refine.bind(this);
        this.refinement = this.refinement.bind(this);
        this.superRefine = this.superRefine.bind(this);
        this.optional = this.optional.bind(this);
        this.nullable = this.nullable.bind(this);
        this.nullish = this.nullish.bind(this);
        this.array = this.array.bind(this);
        this.promise = this.promise.bind(this);
        this.or = this.or.bind(this);
        this.and = this.and.bind(this);
        this.transform = this.transform.bind(this);
        this.brand = this.brand.bind(this);
        this.default = this.default.bind(this);
        this.catch = this.catch.bind(this);
        this.describe = this.describe.bind(this);
        this.pipe = this.pipe.bind(this);
        this.readonly = this.readonly.bind(this);
        this.isNullable = this.isNullable.bind(this);
        this.isOptional = this.isOptional.bind(this);
        this["~standard"] = {
            version: 1,
            vendor: "zod",
            validate: data => this["~validate"](data)
        };
    }
    optional() {
        return ZodOptional.create(this, this._def);
    }
    nullable() {
        return ZodNullable.create(this, this._def);
    }
    nullish() {
        return this.nullable().optional();
    }
    array() {
        return ZodArray.create(this);
    }
    promise() {
        return ZodPromise.create(this, this._def);
    }
    or(option) {
        return ZodUnion.create([ this, option ], this._def);
    }
    and(incoming) {
        return ZodIntersection.create(this, incoming, this._def);
    }
    transform(transform) {
        return new ZodEffects({
            ...processCreateParams$1(this._def),
            schema: this,
            typeName: ZodFirstPartyTypeKind.ZodEffects,
            effect: {
                type: "transform",
                transform
            }
        });
    }
    default(def) {
        const defaultValueFunc = typeof def === "function" ? def : () => def;
        return new ZodDefault({
            ...processCreateParams$1(this._def),
            innerType: this,
            defaultValue: defaultValueFunc,
            typeName: ZodFirstPartyTypeKind.ZodDefault
        });
    }
    brand() {
        return new ZodBranded({
            typeName: ZodFirstPartyTypeKind.ZodBranded,
            type: this,
            ...processCreateParams$1(this._def)
        });
    }
    catch(def) {
        const catchValueFunc = typeof def === "function" ? def : () => def;
        return new ZodCatch({
            ...processCreateParams$1(this._def),
            innerType: this,
            catchValue: catchValueFunc,
            typeName: ZodFirstPartyTypeKind.ZodCatch
        });
    }
    describe(description) {
        const This = this.constructor;
        return new This({
            ...this._def,
            description
        });
    }
    pipe(target) {
        return ZodPipeline.create(this, target);
    }
    readonly() {
        return ZodReadonly.create(this);
    }
    isOptional() {
        return this.safeParse(undefined).success;
    }
    isNullable() {
        return this.safeParse(null).success;
    }
}

const cuidRegex = /^c[^\s-]{8,}$/i;

const cuid2Regex = /^[0-9a-z]+$/;

const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

const uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;

const nanoidRegex = /^[a-z0-9_-]{21}$/i;

const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;

const durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;

const emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;

const _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;

let emojiRegex$1;

const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;

const ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;

const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

const ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;

const base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;

const base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;

const dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;

const dateRegex = new RegExp(`^${dateRegexSource}$`);

function timeRegexSource(args) {
    let secondsRegexSource = `[0-5]\\d`;
    if (args.precision) {
        secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
    } else if (args.precision == null) {
        secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
    }
    const secondsQuantifier = args.precision ? "+" : "?";
    return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}

function timeRegex(args) {
    return new RegExp(`^${timeRegexSource(args)}$`);
}

function datetimeRegex(args) {
    let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
    const opts = [];
    opts.push(args.local ? `Z?` : `Z`);
    if (args.offset) opts.push(`([+-]\\d{2}:?\\d{2})`);
    regex = `${regex}(${opts.join("|")})`;
    return new RegExp(`^${regex}$`);
}

function isValidIP(ip, version) {
    if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
        return true;
    }
    if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
        return true;
    }
    return false;
}

function isValidJWT(jwt, alg) {
    if (!jwtRegex.test(jwt)) return false;
    try {
        const [header] = jwt.split(".");
        const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
        const decoded = JSON.parse(atob(base64));
        if (typeof decoded !== "object" || decoded === null) return false;
        if ("typ" in decoded && decoded?.typ !== "JWT") return false;
        if (!decoded.alg) return false;
        if (alg && decoded.alg !== alg) return false;
        return true;
    } catch {
        return false;
    }
}

function isValidCidr(ip, version) {
    if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
        return true;
    }
    if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
        return true;
    }
    return false;
}

class ZodString extends ZodType {
    _parse(input) {
        if (this._def.coerce) {
            input.data = String(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.string) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.string,
                received: ctx.parsedType
            });
            return INVALID;
        }
        const status = new ParseStatus;
        let ctx = undefined;
        for (const check of this._def.checks) {
            if (check.kind === "min") {
                if (input.data.length < check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_small,
                        minimum: check.value,
                        type: "string",
                        inclusive: true,
                        exact: false,
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "max") {
                if (input.data.length > check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_big,
                        maximum: check.value,
                        type: "string",
                        inclusive: true,
                        exact: false,
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "length") {
                const tooBig = input.data.length > check.value;
                const tooSmall = input.data.length < check.value;
                if (tooBig || tooSmall) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    if (tooBig) {
                        addIssueToContext(ctx, {
                            code: ZodIssueCode.too_big,
                            maximum: check.value,
                            type: "string",
                            inclusive: true,
                            exact: true,
                            message: check.message
                        });
                    } else if (tooSmall) {
                        addIssueToContext(ctx, {
                            code: ZodIssueCode.too_small,
                            minimum: check.value,
                            type: "string",
                            inclusive: true,
                            exact: true,
                            message: check.message
                        });
                    }
                    status.dirty();
                }
            } else if (check.kind === "email") {
                if (!emailRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "email",
                        code: ZodIssueCode.invalid_string,
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "emoji") {
                if (!emojiRegex$1) {
                    emojiRegex$1 = new RegExp(_emojiRegex, "u");
                }
                if (!emojiRegex$1.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "emoji",
                        code: ZodIssueCode.invalid_string,
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "uuid") {
                if (!uuidRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "uuid",
                        code: ZodIssueCode.invalid_string,
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "nanoid") {
                if (!nanoidRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "nanoid",
                        code: ZodIssueCode.invalid_string,
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "cuid") {
                if (!cuidRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "cuid",
                        code: ZodIssueCode.invalid_string,
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "cuid2") {
                if (!cuid2Regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "cuid2",
                        code: ZodIssueCode.invalid_string,
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "ulid") {
                if (!ulidRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "ulid",
                        code: ZodIssueCode.invalid_string,
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "url") {
                try {
                    new URL(input.data);
                } catch {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "url",
                        code: ZodIssueCode.invalid_string,
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "regex") {
                check.regex.lastIndex = 0;
                const testResult = check.regex.test(input.data);
                if (!testResult) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "regex",
                        code: ZodIssueCode.invalid_string,
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "trim") {
                input.data = input.data.trim();
            } else if (check.kind === "includes") {
                if (!input.data.includes(check.value, check.position)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: {
                            includes: check.value,
                            position: check.position
                        },
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "toLowerCase") {
                input.data = input.data.toLowerCase();
            } else if (check.kind === "toUpperCase") {
                input.data = input.data.toUpperCase();
            } else if (check.kind === "startsWith") {
                if (!input.data.startsWith(check.value)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: {
                            startsWith: check.value
                        },
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "endsWith") {
                if (!input.data.endsWith(check.value)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: {
                            endsWith: check.value
                        },
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "datetime") {
                const regex = datetimeRegex(check);
                if (!regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: "datetime",
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "date") {
                const regex = dateRegex;
                if (!regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: "date",
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "time") {
                const regex = timeRegex(check);
                if (!regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: "time",
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "duration") {
                if (!durationRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "duration",
                        code: ZodIssueCode.invalid_string,
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "ip") {
                if (!isValidIP(input.data, check.version)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "ip",
                        code: ZodIssueCode.invalid_string,
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "jwt") {
                if (!isValidJWT(input.data, check.alg)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "jwt",
                        code: ZodIssueCode.invalid_string,
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "cidr") {
                if (!isValidCidr(input.data, check.version)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "cidr",
                        code: ZodIssueCode.invalid_string,
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "base64") {
                if (!base64Regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "base64",
                        code: ZodIssueCode.invalid_string,
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "base64url") {
                if (!base64urlRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "base64url",
                        code: ZodIssueCode.invalid_string,
                        message: check.message
                    });
                    status.dirty();
                }
            } else {
                util$1.assertNever(check);
            }
        }
        return {
            status: status.value,
            value: input.data
        };
    }
    _regex(regex, validation, message) {
        return this.refinement(data => regex.test(data), {
            validation,
            code: ZodIssueCode.invalid_string,
            ...errorUtil.errToObj(message)
        });
    }
    _addCheck(check) {
        return new ZodString({
            ...this._def,
            checks: [ ...this._def.checks, check ]
        });
    }
    email(message) {
        return this._addCheck({
            kind: "email",
            ...errorUtil.errToObj(message)
        });
    }
    url(message) {
        return this._addCheck({
            kind: "url",
            ...errorUtil.errToObj(message)
        });
    }
    emoji(message) {
        return this._addCheck({
            kind: "emoji",
            ...errorUtil.errToObj(message)
        });
    }
    uuid(message) {
        return this._addCheck({
            kind: "uuid",
            ...errorUtil.errToObj(message)
        });
    }
    nanoid(message) {
        return this._addCheck({
            kind: "nanoid",
            ...errorUtil.errToObj(message)
        });
    }
    cuid(message) {
        return this._addCheck({
            kind: "cuid",
            ...errorUtil.errToObj(message)
        });
    }
    cuid2(message) {
        return this._addCheck({
            kind: "cuid2",
            ...errorUtil.errToObj(message)
        });
    }
    ulid(message) {
        return this._addCheck({
            kind: "ulid",
            ...errorUtil.errToObj(message)
        });
    }
    base64(message) {
        return this._addCheck({
            kind: "base64",
            ...errorUtil.errToObj(message)
        });
    }
    base64url(message) {
        return this._addCheck({
            kind: "base64url",
            ...errorUtil.errToObj(message)
        });
    }
    jwt(options) {
        return this._addCheck({
            kind: "jwt",
            ...errorUtil.errToObj(options)
        });
    }
    ip(options) {
        return this._addCheck({
            kind: "ip",
            ...errorUtil.errToObj(options)
        });
    }
    cidr(options) {
        return this._addCheck({
            kind: "cidr",
            ...errorUtil.errToObj(options)
        });
    }
    datetime(options) {
        if (typeof options === "string") {
            return this._addCheck({
                kind: "datetime",
                precision: null,
                offset: false,
                local: false,
                message: options
            });
        }
        return this._addCheck({
            kind: "datetime",
            precision: typeof options?.precision === "undefined" ? null : options?.precision,
            offset: options?.offset ?? false,
            local: options?.local ?? false,
            ...errorUtil.errToObj(options?.message)
        });
    }
    date(message) {
        return this._addCheck({
            kind: "date",
            message
        });
    }
    time(options) {
        if (typeof options === "string") {
            return this._addCheck({
                kind: "time",
                precision: null,
                message: options
            });
        }
        return this._addCheck({
            kind: "time",
            precision: typeof options?.precision === "undefined" ? null : options?.precision,
            ...errorUtil.errToObj(options?.message)
        });
    }
    duration(message) {
        return this._addCheck({
            kind: "duration",
            ...errorUtil.errToObj(message)
        });
    }
    regex(regex, message) {
        return this._addCheck({
            kind: "regex",
            regex,
            ...errorUtil.errToObj(message)
        });
    }
    includes(value, options) {
        return this._addCheck({
            kind: "includes",
            value,
            position: options?.position,
            ...errorUtil.errToObj(options?.message)
        });
    }
    startsWith(value, message) {
        return this._addCheck({
            kind: "startsWith",
            value,
            ...errorUtil.errToObj(message)
        });
    }
    endsWith(value, message) {
        return this._addCheck({
            kind: "endsWith",
            value,
            ...errorUtil.errToObj(message)
        });
    }
    min(minLength, message) {
        return this._addCheck({
            kind: "min",
            value: minLength,
            ...errorUtil.errToObj(message)
        });
    }
    max(maxLength, message) {
        return this._addCheck({
            kind: "max",
            value: maxLength,
            ...errorUtil.errToObj(message)
        });
    }
    length(len, message) {
        return this._addCheck({
            kind: "length",
            value: len,
            ...errorUtil.errToObj(message)
        });
    }
    nonempty(message) {
        return this.min(1, errorUtil.errToObj(message));
    }
    trim() {
        return new ZodString({
            ...this._def,
            checks: [ ...this._def.checks, {
                kind: "trim"
            } ]
        });
    }
    toLowerCase() {
        return new ZodString({
            ...this._def,
            checks: [ ...this._def.checks, {
                kind: "toLowerCase"
            } ]
        });
    }
    toUpperCase() {
        return new ZodString({
            ...this._def,
            checks: [ ...this._def.checks, {
                kind: "toUpperCase"
            } ]
        });
    }
    get isDatetime() {
        return !!this._def.checks.find(ch => ch.kind === "datetime");
    }
    get isDate() {
        return !!this._def.checks.find(ch => ch.kind === "date");
    }
    get isTime() {
        return !!this._def.checks.find(ch => ch.kind === "time");
    }
    get isDuration() {
        return !!this._def.checks.find(ch => ch.kind === "duration");
    }
    get isEmail() {
        return !!this._def.checks.find(ch => ch.kind === "email");
    }
    get isURL() {
        return !!this._def.checks.find(ch => ch.kind === "url");
    }
    get isEmoji() {
        return !!this._def.checks.find(ch => ch.kind === "emoji");
    }
    get isUUID() {
        return !!this._def.checks.find(ch => ch.kind === "uuid");
    }
    get isNANOID() {
        return !!this._def.checks.find(ch => ch.kind === "nanoid");
    }
    get isCUID() {
        return !!this._def.checks.find(ch => ch.kind === "cuid");
    }
    get isCUID2() {
        return !!this._def.checks.find(ch => ch.kind === "cuid2");
    }
    get isULID() {
        return !!this._def.checks.find(ch => ch.kind === "ulid");
    }
    get isIP() {
        return !!this._def.checks.find(ch => ch.kind === "ip");
    }
    get isCIDR() {
        return !!this._def.checks.find(ch => ch.kind === "cidr");
    }
    get isBase64() {
        return !!this._def.checks.find(ch => ch.kind === "base64");
    }
    get isBase64url() {
        return !!this._def.checks.find(ch => ch.kind === "base64url");
    }
    get minLength() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min) min = ch.value;
            }
        }
        return min;
    }
    get maxLength() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max) max = ch.value;
            }
        }
        return max;
    }
}

ZodString.create = params => new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams$1(params)
});

function floatSafeRemainder(val, step) {
    const valDecCount = (val.toString().split(".")[1] || "").length;
    const stepDecCount = (step.toString().split(".")[1] || "").length;
    const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
    const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
    const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
    return valInt % stepInt / 10 ** decCount;
}

class ZodNumber extends ZodType {
    constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
        this.step = this.multipleOf;
    }
    _parse(input) {
        if (this._def.coerce) {
            input.data = Number(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.number) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.number,
                received: ctx.parsedType
            });
            return INVALID;
        }
        let ctx = undefined;
        const status = new ParseStatus;
        for (const check of this._def.checks) {
            if (check.kind === "int") {
                if (!util$1.isInteger(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_type,
                        expected: "integer",
                        received: "float",
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "min") {
                const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
                if (tooSmall) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_small,
                        minimum: check.value,
                        type: "number",
                        inclusive: check.inclusive,
                        exact: false,
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "max") {
                const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
                if (tooBig) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_big,
                        maximum: check.value,
                        type: "number",
                        inclusive: check.inclusive,
                        exact: false,
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "multipleOf") {
                if (floatSafeRemainder(input.data, check.value) !== 0) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.not_multiple_of,
                        multipleOf: check.value,
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "finite") {
                if (!Number.isFinite(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.not_finite,
                        message: check.message
                    });
                    status.dirty();
                }
            } else {
                util$1.assertNever(check);
            }
        }
        return {
            status: status.value,
            value: input.data
        };
    }
    gte(value, message) {
        return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
        return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
        return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
        return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
        return new ZodNumber({
            ...this._def,
            checks: [ ...this._def.checks, {
                kind,
                value,
                inclusive,
                message: errorUtil.toString(message)
            } ]
        });
    }
    _addCheck(check) {
        return new ZodNumber({
            ...this._def,
            checks: [ ...this._def.checks, check ]
        });
    }
    int(message) {
        return this._addCheck({
            kind: "int",
            message: errorUtil.toString(message)
        });
    }
    positive(message) {
        return this._addCheck({
            kind: "min",
            value: 0,
            inclusive: false,
            message: errorUtil.toString(message)
        });
    }
    negative(message) {
        return this._addCheck({
            kind: "max",
            value: 0,
            inclusive: false,
            message: errorUtil.toString(message)
        });
    }
    nonpositive(message) {
        return this._addCheck({
            kind: "max",
            value: 0,
            inclusive: true,
            message: errorUtil.toString(message)
        });
    }
    nonnegative(message) {
        return this._addCheck({
            kind: "min",
            value: 0,
            inclusive: true,
            message: errorUtil.toString(message)
        });
    }
    multipleOf(value, message) {
        return this._addCheck({
            kind: "multipleOf",
            value,
            message: errorUtil.toString(message)
        });
    }
    finite(message) {
        return this._addCheck({
            kind: "finite",
            message: errorUtil.toString(message)
        });
    }
    safe(message) {
        return this._addCheck({
            kind: "min",
            inclusive: true,
            value: Number.MIN_SAFE_INTEGER,
            message: errorUtil.toString(message)
        })._addCheck({
            kind: "max",
            inclusive: true,
            value: Number.MAX_SAFE_INTEGER,
            message: errorUtil.toString(message)
        });
    }
    get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min) min = ch.value;
            }
        }
        return min;
    }
    get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max) max = ch.value;
            }
        }
        return max;
    }
    get isInt() {
        return !!this._def.checks.find(ch => ch.kind === "int" || ch.kind === "multipleOf" && util$1.isInteger(ch.value));
    }
    get isFinite() {
        let max = null;
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
                return true;
            } else if (ch.kind === "min") {
                if (min === null || ch.value > min) min = ch.value;
            } else if (ch.kind === "max") {
                if (max === null || ch.value < max) max = ch.value;
            }
        }
        return Number.isFinite(min) && Number.isFinite(max);
    }
}

ZodNumber.create = params => new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams$1(params)
});

class ZodBigInt extends ZodType {
    constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
    }
    _parse(input) {
        if (this._def.coerce) {
            try {
                input.data = BigInt(input.data);
            } catch {
                return this._getInvalidInput(input);
            }
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.bigint) {
            return this._getInvalidInput(input);
        }
        let ctx = undefined;
        const status = new ParseStatus;
        for (const check of this._def.checks) {
            if (check.kind === "min") {
                const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
                if (tooSmall) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_small,
                        type: "bigint",
                        minimum: check.value,
                        inclusive: check.inclusive,
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "max") {
                const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
                if (tooBig) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_big,
                        type: "bigint",
                        maximum: check.value,
                        inclusive: check.inclusive,
                        message: check.message
                    });
                    status.dirty();
                }
            } else if (check.kind === "multipleOf") {
                if (input.data % check.value !== BigInt(0)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.not_multiple_of,
                        multipleOf: check.value,
                        message: check.message
                    });
                    status.dirty();
                }
            } else {
                util$1.assertNever(check);
            }
        }
        return {
            status: status.value,
            value: input.data
        };
    }
    _getInvalidInput(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.bigint,
            received: ctx.parsedType
        });
        return INVALID;
    }
    gte(value, message) {
        return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
        return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
        return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
        return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
        return new ZodBigInt({
            ...this._def,
            checks: [ ...this._def.checks, {
                kind,
                value,
                inclusive,
                message: errorUtil.toString(message)
            } ]
        });
    }
    _addCheck(check) {
        return new ZodBigInt({
            ...this._def,
            checks: [ ...this._def.checks, check ]
        });
    }
    positive(message) {
        return this._addCheck({
            kind: "min",
            value: BigInt(0),
            inclusive: false,
            message: errorUtil.toString(message)
        });
    }
    negative(message) {
        return this._addCheck({
            kind: "max",
            value: BigInt(0),
            inclusive: false,
            message: errorUtil.toString(message)
        });
    }
    nonpositive(message) {
        return this._addCheck({
            kind: "max",
            value: BigInt(0),
            inclusive: true,
            message: errorUtil.toString(message)
        });
    }
    nonnegative(message) {
        return this._addCheck({
            kind: "min",
            value: BigInt(0),
            inclusive: true,
            message: errorUtil.toString(message)
        });
    }
    multipleOf(value, message) {
        return this._addCheck({
            kind: "multipleOf",
            value,
            message: errorUtil.toString(message)
        });
    }
    get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min) min = ch.value;
            }
        }
        return min;
    }
    get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max) max = ch.value;
            }
        }
        return max;
    }
}

ZodBigInt.create = params => new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams$1(params)
});

class ZodBoolean extends ZodType {
    _parse(input) {
        if (this._def.coerce) {
            input.data = Boolean(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.boolean) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.boolean,
                received: ctx.parsedType
            });
            return INVALID;
        }
        return OK(input.data);
    }
}

ZodBoolean.create = params => new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams$1(params)
});

class ZodDate extends ZodType {
    _parse(input) {
        if (this._def.coerce) {
            input.data = new Date(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.date) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.date,
                received: ctx.parsedType
            });
            return INVALID;
        }
        if (Number.isNaN(input.data.getTime())) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_date
            });
            return INVALID;
        }
        const status = new ParseStatus;
        let ctx = undefined;
        for (const check of this._def.checks) {
            if (check.kind === "min") {
                if (input.data.getTime() < check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_small,
                        message: check.message,
                        inclusive: true,
                        exact: false,
                        minimum: check.value,
                        type: "date"
                    });
                    status.dirty();
                }
            } else if (check.kind === "max") {
                if (input.data.getTime() > check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_big,
                        message: check.message,
                        inclusive: true,
                        exact: false,
                        maximum: check.value,
                        type: "date"
                    });
                    status.dirty();
                }
            } else {
                util$1.assertNever(check);
            }
        }
        return {
            status: status.value,
            value: new Date(input.data.getTime())
        };
    }
    _addCheck(check) {
        return new ZodDate({
            ...this._def,
            checks: [ ...this._def.checks, check ]
        });
    }
    min(minDate, message) {
        return this._addCheck({
            kind: "min",
            value: minDate.getTime(),
            message: errorUtil.toString(message)
        });
    }
    max(maxDate, message) {
        return this._addCheck({
            kind: "max",
            value: maxDate.getTime(),
            message: errorUtil.toString(message)
        });
    }
    get minDate() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min) min = ch.value;
            }
        }
        return min != null ? new Date(min) : null;
    }
    get maxDate() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max) max = ch.value;
            }
        }
        return max != null ? new Date(max) : null;
    }
}

ZodDate.create = params => new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams$1(params)
});

class ZodSymbol extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.symbol) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.symbol,
                received: ctx.parsedType
            });
            return INVALID;
        }
        return OK(input.data);
    }
}

ZodSymbol.create = params => new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams$1(params)
});

class ZodUndefined extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.undefined) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.undefined,
                received: ctx.parsedType
            });
            return INVALID;
        }
        return OK(input.data);
    }
}

ZodUndefined.create = params => new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams$1(params)
});

class ZodNull extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.null) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.null,
                received: ctx.parsedType
            });
            return INVALID;
        }
        return OK(input.data);
    }
}

ZodNull.create = params => new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams$1(params)
});

class ZodAny extends ZodType {
    constructor() {
        super(...arguments);
        this._any = true;
    }
    _parse(input) {
        return OK(input.data);
    }
}

ZodAny.create = params => new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams$1(params)
});

class ZodUnknown extends ZodType {
    constructor() {
        super(...arguments);
        this._unknown = true;
    }
    _parse(input) {
        return OK(input.data);
    }
}

ZodUnknown.create = params => new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams$1(params)
});

class ZodNever extends ZodType {
    _parse(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.never,
            received: ctx.parsedType
        });
        return INVALID;
    }
}

ZodNever.create = params => new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams$1(params)
});

class ZodVoid extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.undefined) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.void,
                received: ctx.parsedType
            });
            return INVALID;
        }
        return OK(input.data);
    }
}

ZodVoid.create = params => new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams$1(params)
});

class ZodArray extends ZodType {
    _parse(input) {
        const {ctx, status} = this._processInputParams(input);
        const def = this._def;
        if (ctx.parsedType !== ZodParsedType.array) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.array,
                received: ctx.parsedType
            });
            return INVALID;
        }
        if (def.exactLength !== null) {
            const tooBig = ctx.data.length > def.exactLength.value;
            const tooSmall = ctx.data.length < def.exactLength.value;
            if (tooBig || tooSmall) {
                addIssueToContext(ctx, {
                    code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
                    minimum: tooSmall ? def.exactLength.value : undefined,
                    maximum: tooBig ? def.exactLength.value : undefined,
                    type: "array",
                    inclusive: true,
                    exact: true,
                    message: def.exactLength.message
                });
                status.dirty();
            }
        }
        if (def.minLength !== null) {
            if (ctx.data.length < def.minLength.value) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.too_small,
                    minimum: def.minLength.value,
                    type: "array",
                    inclusive: true,
                    exact: false,
                    message: def.minLength.message
                });
                status.dirty();
            }
        }
        if (def.maxLength !== null) {
            if (ctx.data.length > def.maxLength.value) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.too_big,
                    maximum: def.maxLength.value,
                    type: "array",
                    inclusive: true,
                    exact: false,
                    message: def.maxLength.message
                });
                status.dirty();
            }
        }
        if (ctx.common.async) {
            return Promise.all([ ...ctx.data ].map((item, i) => def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i)))).then(result => ParseStatus.mergeArray(status, result));
        }
        const result = [ ...ctx.data ].map((item, i) => def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i)));
        return ParseStatus.mergeArray(status, result);
    }
    get element() {
        return this._def.type;
    }
    min(minLength, message) {
        return new ZodArray({
            ...this._def,
            minLength: {
                value: minLength,
                message: errorUtil.toString(message)
            }
        });
    }
    max(maxLength, message) {
        return new ZodArray({
            ...this._def,
            maxLength: {
                value: maxLength,
                message: errorUtil.toString(message)
            }
        });
    }
    length(len, message) {
        return new ZodArray({
            ...this._def,
            exactLength: {
                value: len,
                message: errorUtil.toString(message)
            }
        });
    }
    nonempty(message) {
        return this.min(1, message);
    }
}

ZodArray.create = (schema, params) => new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams$1(params)
});

function deepPartialify(schema) {
    if (schema instanceof ZodObject) {
        const newShape = {};
        for (const key in schema.shape) {
            const fieldSchema = schema.shape[key];
            newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
        }
        return new ZodObject({
            ...schema._def,
            shape: () => newShape
        });
    } else if (schema instanceof ZodArray) {
        return new ZodArray({
            ...schema._def,
            type: deepPartialify(schema.element)
        });
    } else if (schema instanceof ZodOptional) {
        return ZodOptional.create(deepPartialify(schema.unwrap()));
    } else if (schema instanceof ZodNullable) {
        return ZodNullable.create(deepPartialify(schema.unwrap()));
    } else if (schema instanceof ZodTuple) {
        return ZodTuple.create(schema.items.map(item => deepPartialify(item)));
    } else {
        return schema;
    }
}

class ZodObject extends ZodType {
    constructor() {
        super(...arguments);
        this._cached = null;
        this.nonstrict = this.passthrough;
        this.augment = this.extend;
    }
    _getCached() {
        if (this._cached !== null) return this._cached;
        const shape = this._def.shape();
        const keys = util$1.objectKeys(shape);
        this._cached = {
            shape,
            keys
        };
        return this._cached;
    }
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.object) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.object,
                received: ctx.parsedType
            });
            return INVALID;
        }
        const {status, ctx} = this._processInputParams(input);
        const {shape, keys: shapeKeys} = this._getCached();
        const extraKeys = [];
        if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
            for (const key in ctx.data) {
                if (!shapeKeys.includes(key)) {
                    extraKeys.push(key);
                }
            }
        }
        const pairs = [];
        for (const key of shapeKeys) {
            const keyValidator = shape[key];
            const value = ctx.data[key];
            pairs.push({
                key: {
                    status: "valid",
                    value: key
                },
                value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
                alwaysSet: key in ctx.data
            });
        }
        if (this._def.catchall instanceof ZodNever) {
            const unknownKeys = this._def.unknownKeys;
            if (unknownKeys === "passthrough") {
                for (const key of extraKeys) {
                    pairs.push({
                        key: {
                            status: "valid",
                            value: key
                        },
                        value: {
                            status: "valid",
                            value: ctx.data[key]
                        }
                    });
                }
            } else if (unknownKeys === "strict") {
                if (extraKeys.length > 0) {
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.unrecognized_keys,
                        keys: extraKeys
                    });
                    status.dirty();
                }
            } else if (unknownKeys === "strip") ; else {
                throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
            }
        } else {
            const catchall = this._def.catchall;
            for (const key of extraKeys) {
                const value = ctx.data[key];
                pairs.push({
                    key: {
                        status: "valid",
                        value: key
                    },
                    value: catchall._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
                    alwaysSet: key in ctx.data
                });
            }
        }
        if (ctx.common.async) {
            return Promise.resolve().then(async () => {
                const syncPairs = [];
                for (const pair of pairs) {
                    const key = await pair.key;
                    const value = await pair.value;
                    syncPairs.push({
                        key,
                        value,
                        alwaysSet: pair.alwaysSet
                    });
                }
                return syncPairs;
            }).then(syncPairs => ParseStatus.mergeObjectSync(status, syncPairs));
        } else {
            return ParseStatus.mergeObjectSync(status, pairs);
        }
    }
    get shape() {
        return this._def.shape();
    }
    strict(message) {
        errorUtil.errToObj;
        return new ZodObject({
            ...this._def,
            unknownKeys: "strict",
            ...message !== undefined ? {
                errorMap: (issue, ctx) => {
                    const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
                    if (issue.code === "unrecognized_keys") return {
                        message: errorUtil.errToObj(message).message ?? defaultError
                    };
                    return {
                        message: defaultError
                    };
                }
            } : {}
        });
    }
    strip() {
        return new ZodObject({
            ...this._def,
            unknownKeys: "strip"
        });
    }
    passthrough() {
        return new ZodObject({
            ...this._def,
            unknownKeys: "passthrough"
        });
    }
    extend(augmentation) {
        return new ZodObject({
            ...this._def,
            shape: () => ({
                ...this._def.shape(),
                ...augmentation
            })
        });
    }
    merge(merging) {
        const merged = new ZodObject({
            unknownKeys: merging._def.unknownKeys,
            catchall: merging._def.catchall,
            shape: () => ({
                ...this._def.shape(),
                ...merging._def.shape()
            }),
            typeName: ZodFirstPartyTypeKind.ZodObject
        });
        return merged;
    }
    setKey(key, schema) {
        return this.augment({
            [key]: schema
        });
    }
    catchall(index) {
        return new ZodObject({
            ...this._def,
            catchall: index
        });
    }
    pick(mask) {
        const shape = {};
        for (const key of util$1.objectKeys(mask)) {
            if (mask[key] && this.shape[key]) {
                shape[key] = this.shape[key];
            }
        }
        return new ZodObject({
            ...this._def,
            shape: () => shape
        });
    }
    omit(mask) {
        const shape = {};
        for (const key of util$1.objectKeys(this.shape)) {
            if (!mask[key]) {
                shape[key] = this.shape[key];
            }
        }
        return new ZodObject({
            ...this._def,
            shape: () => shape
        });
    }
    deepPartial() {
        return deepPartialify(this);
    }
    partial(mask) {
        const newShape = {};
        for (const key of util$1.objectKeys(this.shape)) {
            const fieldSchema = this.shape[key];
            if (mask && !mask[key]) {
                newShape[key] = fieldSchema;
            } else {
                newShape[key] = fieldSchema.optional();
            }
        }
        return new ZodObject({
            ...this._def,
            shape: () => newShape
        });
    }
    required(mask) {
        const newShape = {};
        for (const key of util$1.objectKeys(this.shape)) {
            if (mask && !mask[key]) {
                newShape[key] = this.shape[key];
            } else {
                const fieldSchema = this.shape[key];
                let newField = fieldSchema;
                while (newField instanceof ZodOptional) {
                    newField = newField._def.innerType;
                }
                newShape[key] = newField;
            }
        }
        return new ZodObject({
            ...this._def,
            shape: () => newShape
        });
    }
    keyof() {
        return createZodEnum(util$1.objectKeys(this.shape));
    }
}

ZodObject.create = (shape, params) => new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams$1(params)
});

ZodObject.strictCreate = (shape, params) => new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams$1(params)
});

ZodObject.lazycreate = (shape, params) => new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams$1(params)
});

class ZodUnion extends ZodType {
    _parse(input) {
        const {ctx} = this._processInputParams(input);
        const options = this._def.options;
        function handleResults(results) {
            for (const result of results) {
                if (result.result.status === "valid") {
                    return result.result;
                }
            }
            for (const result of results) {
                if (result.result.status === "dirty") {
                    ctx.common.issues.push(...result.ctx.common.issues);
                    return result.result;
                }
            }
            const unionErrors = results.map(result => new ZodError(result.ctx.common.issues));
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_union,
                unionErrors
            });
            return INVALID;
        }
        if (ctx.common.async) {
            return Promise.all(options.map(async option => {
                const childCtx = {
                    ...ctx,
                    common: {
                        ...ctx.common,
                        issues: []
                    },
                    parent: null
                };
                return {
                    result: await option._parseAsync({
                        data: ctx.data,
                        path: ctx.path,
                        parent: childCtx
                    }),
                    ctx: childCtx
                };
            })).then(handleResults);
        } else {
            let dirty = undefined;
            const issues = [];
            for (const option of options) {
                const childCtx = {
                    ...ctx,
                    common: {
                        ...ctx.common,
                        issues: []
                    },
                    parent: null
                };
                const result = option._parseSync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: childCtx
                });
                if (result.status === "valid") {
                    return result;
                } else if (result.status === "dirty" && !dirty) {
                    dirty = {
                        result,
                        ctx: childCtx
                    };
                }
                if (childCtx.common.issues.length) {
                    issues.push(childCtx.common.issues);
                }
            }
            if (dirty) {
                ctx.common.issues.push(...dirty.ctx.common.issues);
                return dirty.result;
            }
            const unionErrors = issues.map(issues => new ZodError(issues));
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_union,
                unionErrors
            });
            return INVALID;
        }
    }
    get options() {
        return this._def.options;
    }
}

ZodUnion.create = (types, params) => new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams$1(params)
});

const getDiscriminator = type => {
    if (type instanceof ZodLazy) {
        return getDiscriminator(type.schema);
    } else if (type instanceof ZodEffects) {
        return getDiscriminator(type.innerType());
    } else if (type instanceof ZodLiteral) {
        return [ type.value ];
    } else if (type instanceof ZodEnum) {
        return type.options;
    } else if (type instanceof ZodNativeEnum) {
        return util$1.objectValues(type.enum);
    } else if (type instanceof ZodDefault) {
        return getDiscriminator(type._def.innerType);
    } else if (type instanceof ZodUndefined) {
        return [ undefined ];
    } else if (type instanceof ZodNull) {
        return [ null ];
    } else if (type instanceof ZodOptional) {
        return [ undefined, ...getDiscriminator(type.unwrap()) ];
    } else if (type instanceof ZodNullable) {
        return [ null, ...getDiscriminator(type.unwrap()) ];
    } else if (type instanceof ZodBranded) {
        return getDiscriminator(type.unwrap());
    } else if (type instanceof ZodReadonly) {
        return getDiscriminator(type.unwrap());
    } else if (type instanceof ZodCatch) {
        return getDiscriminator(type._def.innerType);
    } else {
        return [];
    }
};

class ZodDiscriminatedUnion extends ZodType {
    _parse(input) {
        const {ctx} = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.object) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.object,
                received: ctx.parsedType
            });
            return INVALID;
        }
        const discriminator = this.discriminator;
        const discriminatorValue = ctx.data[discriminator];
        const option = this.optionsMap.get(discriminatorValue);
        if (!option) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_union_discriminator,
                options: Array.from(this.optionsMap.keys()),
                path: [ discriminator ]
            });
            return INVALID;
        }
        if (ctx.common.async) {
            return option._parseAsync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx
            });
        } else {
            return option._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx
            });
        }
    }
    get discriminator() {
        return this._def.discriminator;
    }
    get options() {
        return this._def.options;
    }
    get optionsMap() {
        return this._def.optionsMap;
    }
    static create(discriminator, options, params) {
        const optionsMap = new Map;
        for (const type of options) {
            const discriminatorValues = getDiscriminator(type.shape[discriminator]);
            if (!discriminatorValues.length) {
                throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
            }
            for (const value of discriminatorValues) {
                if (optionsMap.has(value)) {
                    throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
                }
                optionsMap.set(value, type);
            }
        }
        return new ZodDiscriminatedUnion({
            typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
            discriminator,
            options,
            optionsMap,
            ...processCreateParams$1(params)
        });
    }
}

function mergeValues(a, b) {
    const aType = getParsedType(a);
    const bType = getParsedType(b);
    if (a === b) {
        return {
            valid: true,
            data: a
        };
    } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
        const bKeys = util$1.objectKeys(b);
        const sharedKeys = util$1.objectKeys(a).filter(key => bKeys.indexOf(key) !== -1);
        const newObj = {
            ...a,
            ...b
        };
        for (const key of sharedKeys) {
            const sharedValue = mergeValues(a[key], b[key]);
            if (!sharedValue.valid) {
                return {
                    valid: false
                };
            }
            newObj[key] = sharedValue.data;
        }
        return {
            valid: true,
            data: newObj
        };
    } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
        if (a.length !== b.length) {
            return {
                valid: false
            };
        }
        const newArray = [];
        for (let index = 0; index < a.length; index++) {
            const itemA = a[index];
            const itemB = b[index];
            const sharedValue = mergeValues(itemA, itemB);
            if (!sharedValue.valid) {
                return {
                    valid: false
                };
            }
            newArray.push(sharedValue.data);
        }
        return {
            valid: true,
            data: newArray
        };
    } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
        return {
            valid: true,
            data: a
        };
    } else {
        return {
            valid: false
        };
    }
}

class ZodIntersection extends ZodType {
    _parse(input) {
        const {status, ctx} = this._processInputParams(input);
        const handleParsed = (parsedLeft, parsedRight) => {
            if (isAborted(parsedLeft) || isAborted(parsedRight)) {
                return INVALID;
            }
            const merged = mergeValues(parsedLeft.value, parsedRight.value);
            if (!merged.valid) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.invalid_intersection_types
                });
                return INVALID;
            }
            if (isDirty(parsedLeft) || isDirty(parsedRight)) {
                status.dirty();
            }
            return {
                status: status.value,
                value: merged.data
            };
        };
        if (ctx.common.async) {
            return Promise.all([ this._def.left._parseAsync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx
            }), this._def.right._parseAsync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx
            }) ]).then(([left, right]) => handleParsed(left, right));
        } else {
            return handleParsed(this._def.left._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx
            }), this._def.right._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx
            }));
        }
    }
}

ZodIntersection.create = (left, right, params) => new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams$1(params)
});

class ZodTuple extends ZodType {
    _parse(input) {
        const {status, ctx} = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.array) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.array,
                received: ctx.parsedType
            });
            return INVALID;
        }
        if (ctx.data.length < this._def.items.length) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: this._def.items.length,
                inclusive: true,
                exact: false,
                type: "array"
            });
            return INVALID;
        }
        const rest = this._def.rest;
        if (!rest && ctx.data.length > this._def.items.length) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: this._def.items.length,
                inclusive: true,
                exact: false,
                type: "array"
            });
            status.dirty();
        }
        const items = [ ...ctx.data ].map((item, itemIndex) => {
            const schema = this._def.items[itemIndex] || this._def.rest;
            if (!schema) return null;
            return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
        }).filter(x => !!x);
        if (ctx.common.async) {
            return Promise.all(items).then(results => ParseStatus.mergeArray(status, results));
        } else {
            return ParseStatus.mergeArray(status, items);
        }
    }
    get items() {
        return this._def.items;
    }
    rest(rest) {
        return new ZodTuple({
            ...this._def,
            rest
        });
    }
}

ZodTuple.create = (schemas, params) => {
    if (!Array.isArray(schemas)) {
        throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
    }
    return new ZodTuple({
        items: schemas,
        typeName: ZodFirstPartyTypeKind.ZodTuple,
        rest: null,
        ...processCreateParams$1(params)
    });
};

class ZodRecord extends ZodType {
    get keySchema() {
        return this._def.keyType;
    }
    get valueSchema() {
        return this._def.valueType;
    }
    _parse(input) {
        const {status, ctx} = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.object) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.object,
                received: ctx.parsedType
            });
            return INVALID;
        }
        const pairs = [];
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        for (const key in ctx.data) {
            pairs.push({
                key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
                value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
                alwaysSet: key in ctx.data
            });
        }
        if (ctx.common.async) {
            return ParseStatus.mergeObjectAsync(status, pairs);
        } else {
            return ParseStatus.mergeObjectSync(status, pairs);
        }
    }
    get element() {
        return this._def.valueType;
    }
    static create(first, second, third) {
        if (second instanceof ZodType) {
            return new ZodRecord({
                keyType: first,
                valueType: second,
                typeName: ZodFirstPartyTypeKind.ZodRecord,
                ...processCreateParams$1(third)
            });
        }
        return new ZodRecord({
            keyType: ZodString.create(),
            valueType: first,
            typeName: ZodFirstPartyTypeKind.ZodRecord,
            ...processCreateParams$1(second)
        });
    }
}

class ZodMap extends ZodType {
    get keySchema() {
        return this._def.keyType;
    }
    get valueSchema() {
        return this._def.valueType;
    }
    _parse(input) {
        const {status, ctx} = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.map) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.map,
                received: ctx.parsedType
            });
            return INVALID;
        }
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        const pairs = [ ...ctx.data.entries() ].map(([key, value], index) => ({
            key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [ index, "key" ])),
            value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [ index, "value" ]))
        }));
        if (ctx.common.async) {
            const finalMap = new Map;
            return Promise.resolve().then(async () => {
                for (const pair of pairs) {
                    const key = await pair.key;
                    const value = await pair.value;
                    if (key.status === "aborted" || value.status === "aborted") {
                        return INVALID;
                    }
                    if (key.status === "dirty" || value.status === "dirty") {
                        status.dirty();
                    }
                    finalMap.set(key.value, value.value);
                }
                return {
                    status: status.value,
                    value: finalMap
                };
            });
        } else {
            const finalMap = new Map;
            for (const pair of pairs) {
                const key = pair.key;
                const value = pair.value;
                if (key.status === "aborted" || value.status === "aborted") {
                    return INVALID;
                }
                if (key.status === "dirty" || value.status === "dirty") {
                    status.dirty();
                }
                finalMap.set(key.value, value.value);
            }
            return {
                status: status.value,
                value: finalMap
            };
        }
    }
}

ZodMap.create = (keyType, valueType, params) => new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams$1(params)
});

class ZodSet extends ZodType {
    _parse(input) {
        const {status, ctx} = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.set) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.set,
                received: ctx.parsedType
            });
            return INVALID;
        }
        const def = this._def;
        if (def.minSize !== null) {
            if (ctx.data.size < def.minSize.value) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.too_small,
                    minimum: def.minSize.value,
                    type: "set",
                    inclusive: true,
                    exact: false,
                    message: def.minSize.message
                });
                status.dirty();
            }
        }
        if (def.maxSize !== null) {
            if (ctx.data.size > def.maxSize.value) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.too_big,
                    maximum: def.maxSize.value,
                    type: "set",
                    inclusive: true,
                    exact: false,
                    message: def.maxSize.message
                });
                status.dirty();
            }
        }
        const valueType = this._def.valueType;
        function finalizeSet(elements) {
            const parsedSet = new Set;
            for (const element of elements) {
                if (element.status === "aborted") return INVALID;
                if (element.status === "dirty") status.dirty();
                parsedSet.add(element.value);
            }
            return {
                status: status.value,
                value: parsedSet
            };
        }
        const elements = [ ...ctx.data.values() ].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
        if (ctx.common.async) {
            return Promise.all(elements).then(elements => finalizeSet(elements));
        } else {
            return finalizeSet(elements);
        }
    }
    min(minSize, message) {
        return new ZodSet({
            ...this._def,
            minSize: {
                value: minSize,
                message: errorUtil.toString(message)
            }
        });
    }
    max(maxSize, message) {
        return new ZodSet({
            ...this._def,
            maxSize: {
                value: maxSize,
                message: errorUtil.toString(message)
            }
        });
    }
    size(size, message) {
        return this.min(size, message).max(size, message);
    }
    nonempty(message) {
        return this.min(1, message);
    }
}

ZodSet.create = (valueType, params) => new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams$1(params)
});

class ZodLazy extends ZodType {
    get schema() {
        return this._def.getter();
    }
    _parse(input) {
        const {ctx} = this._processInputParams(input);
        const lazySchema = this._def.getter();
        return lazySchema._parse({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
        });
    }
}

ZodLazy.create = (getter, params) => new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams$1(params)
});

class ZodLiteral extends ZodType {
    _parse(input) {
        if (input.data !== this._def.value) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                received: ctx.data,
                code: ZodIssueCode.invalid_literal,
                expected: this._def.value
            });
            return INVALID;
        }
        return {
            status: "valid",
            value: input.data
        };
    }
    get value() {
        return this._def.value;
    }
}

ZodLiteral.create = (value, params) => new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams$1(params)
});

function createZodEnum(values, params) {
    return new ZodEnum({
        values,
        typeName: ZodFirstPartyTypeKind.ZodEnum,
        ...processCreateParams$1(params)
    });
}

class ZodEnum extends ZodType {
    _parse(input) {
        if (typeof input.data !== "string") {
            const ctx = this._getOrReturnCtx(input);
            const expectedValues = this._def.values;
            addIssueToContext(ctx, {
                expected: util$1.joinValues(expectedValues),
                received: ctx.parsedType,
                code: ZodIssueCode.invalid_type
            });
            return INVALID;
        }
        if (!this._cache) {
            this._cache = new Set(this._def.values);
        }
        if (!this._cache.has(input.data)) {
            const ctx = this._getOrReturnCtx(input);
            const expectedValues = this._def.values;
            addIssueToContext(ctx, {
                received: ctx.data,
                code: ZodIssueCode.invalid_enum_value,
                options: expectedValues
            });
            return INVALID;
        }
        return OK(input.data);
    }
    get options() {
        return this._def.values;
    }
    get enum() {
        const enumValues = {};
        for (const val of this._def.values) {
            enumValues[val] = val;
        }
        return enumValues;
    }
    get Values() {
        const enumValues = {};
        for (const val of this._def.values) {
            enumValues[val] = val;
        }
        return enumValues;
    }
    get Enum() {
        const enumValues = {};
        for (const val of this._def.values) {
            enumValues[val] = val;
        }
        return enumValues;
    }
    extract(values, newDef = this._def) {
        return ZodEnum.create(values, {
            ...this._def,
            ...newDef
        });
    }
    exclude(values, newDef = this._def) {
        return ZodEnum.create(this.options.filter(opt => !values.includes(opt)), {
            ...this._def,
            ...newDef
        });
    }
}

ZodEnum.create = createZodEnum;

class ZodNativeEnum extends ZodType {
    _parse(input) {
        const nativeEnumValues = util$1.getValidEnumValues(this._def.values);
        const ctx = this._getOrReturnCtx(input);
        if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
            const expectedValues = util$1.objectValues(nativeEnumValues);
            addIssueToContext(ctx, {
                expected: util$1.joinValues(expectedValues),
                received: ctx.parsedType,
                code: ZodIssueCode.invalid_type
            });
            return INVALID;
        }
        if (!this._cache) {
            this._cache = new Set(util$1.getValidEnumValues(this._def.values));
        }
        if (!this._cache.has(input.data)) {
            const expectedValues = util$1.objectValues(nativeEnumValues);
            addIssueToContext(ctx, {
                received: ctx.data,
                code: ZodIssueCode.invalid_enum_value,
                options: expectedValues
            });
            return INVALID;
        }
        return OK(input.data);
    }
    get enum() {
        return this._def.values;
    }
}

ZodNativeEnum.create = (values, params) => new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams$1(params)
});

class ZodPromise extends ZodType {
    unwrap() {
        return this._def.type;
    }
    _parse(input) {
        const {ctx} = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.promise,
                received: ctx.parsedType
            });
            return INVALID;
        }
        const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
        return OK(promisified.then(data => this._def.type.parseAsync(data, {
            path: ctx.path,
            errorMap: ctx.common.contextualErrorMap
        })));
    }
}

ZodPromise.create = (schema, params) => new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams$1(params)
});

class ZodEffects extends ZodType {
    innerType() {
        return this._def.schema;
    }
    sourceType() {
        return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
    }
    _parse(input) {
        const {status, ctx} = this._processInputParams(input);
        const effect = this._def.effect || null;
        const checkCtx = {
            addIssue: arg => {
                addIssueToContext(ctx, arg);
                if (arg.fatal) {
                    status.abort();
                } else {
                    status.dirty();
                }
            },
            get path() {
                return ctx.path;
            }
        };
        checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
        if (effect.type === "preprocess") {
            const processed = effect.transform(ctx.data, checkCtx);
            if (ctx.common.async) {
                return Promise.resolve(processed).then(async processed => {
                    if (status.value === "aborted") return INVALID;
                    const result = await this._def.schema._parseAsync({
                        data: processed,
                        path: ctx.path,
                        parent: ctx
                    });
                    if (result.status === "aborted") return INVALID;
                    if (result.status === "dirty") return DIRTY(result.value);
                    if (status.value === "dirty") return DIRTY(result.value);
                    return result;
                });
            } else {
                if (status.value === "aborted") return INVALID;
                const result = this._def.schema._parseSync({
                    data: processed,
                    path: ctx.path,
                    parent: ctx
                });
                if (result.status === "aborted") return INVALID;
                if (result.status === "dirty") return DIRTY(result.value);
                if (status.value === "dirty") return DIRTY(result.value);
                return result;
            }
        }
        if (effect.type === "refinement") {
            const executeRefinement = acc => {
                const result = effect.refinement(acc, checkCtx);
                if (ctx.common.async) {
                    return Promise.resolve(result);
                }
                if (result instanceof Promise) {
                    throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
                }
                return acc;
            };
            if (ctx.common.async === false) {
                const inner = this._def.schema._parseSync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx
                });
                if (inner.status === "aborted") return INVALID;
                if (inner.status === "dirty") status.dirty();
                executeRefinement(inner.value);
                return {
                    status: status.value,
                    value: inner.value
                };
            } else {
                return this._def.schema._parseAsync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx
                }).then(inner => {
                    if (inner.status === "aborted") return INVALID;
                    if (inner.status === "dirty") status.dirty();
                    return executeRefinement(inner.value).then(() => ({
                        status: status.value,
                        value: inner.value
                    }));
                });
            }
        }
        if (effect.type === "transform") {
            if (ctx.common.async === false) {
                const base = this._def.schema._parseSync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx
                });
                if (!isValid(base)) return INVALID;
                const result = effect.transform(base.value, checkCtx);
                if (result instanceof Promise) {
                    throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
                }
                return {
                    status: status.value,
                    value: result
                };
            } else {
                return this._def.schema._parseAsync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx
                }).then(base => {
                    if (!isValid(base)) return INVALID;
                    return Promise.resolve(effect.transform(base.value, checkCtx)).then(result => ({
                        status: status.value,
                        value: result
                    }));
                });
            }
        }
        util$1.assertNever(effect);
    }
}

ZodEffects.create = (schema, effect, params) => new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams$1(params)
});

ZodEffects.createWithPreprocess = (preprocess, schema, params) => new ZodEffects({
    schema,
    effect: {
        type: "preprocess",
        transform: preprocess
    },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams$1(params)
});

class ZodOptional extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType.undefined) {
            return OK(undefined);
        }
        return this._def.innerType._parse(input);
    }
    unwrap() {
        return this._def.innerType;
    }
}

ZodOptional.create = (type, params) => new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams$1(params)
});

class ZodNullable extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType.null) {
            return OK(null);
        }
        return this._def.innerType._parse(input);
    }
    unwrap() {
        return this._def.innerType;
    }
}

ZodNullable.create = (type, params) => new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams$1(params)
});

class ZodDefault extends ZodType {
    _parse(input) {
        const {ctx} = this._processInputParams(input);
        let data = ctx.data;
        if (ctx.parsedType === ZodParsedType.undefined) {
            data = this._def.defaultValue();
        }
        return this._def.innerType._parse({
            data,
            path: ctx.path,
            parent: ctx
        });
    }
    removeDefault() {
        return this._def.innerType;
    }
}

ZodDefault.create = (type, params) => new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams$1(params)
});

class ZodCatch extends ZodType {
    _parse(input) {
        const {ctx} = this._processInputParams(input);
        const newCtx = {
            ...ctx,
            common: {
                ...ctx.common,
                issues: []
            }
        };
        const result = this._def.innerType._parse({
            data: newCtx.data,
            path: newCtx.path,
            parent: {
                ...newCtx
            }
        });
        if (isAsync(result)) {
            return result.then(result => ({
                status: "valid",
                value: result.status === "valid" ? result.value : this._def.catchValue({
                    get error() {
                        return new ZodError(newCtx.common.issues);
                    },
                    input: newCtx.data
                })
            }));
        } else {
            return {
                status: "valid",
                value: result.status === "valid" ? result.value : this._def.catchValue({
                    get error() {
                        return new ZodError(newCtx.common.issues);
                    },
                    input: newCtx.data
                })
            };
        }
    }
    removeCatch() {
        return this._def.innerType;
    }
}

ZodCatch.create = (type, params) => new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams$1(params)
});

class ZodNaN extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.nan) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.nan,
                received: ctx.parsedType
            });
            return INVALID;
        }
        return {
            status: "valid",
            value: input.data
        };
    }
}

ZodNaN.create = params => new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams$1(params)
});

class ZodBranded extends ZodType {
    _parse(input) {
        const {ctx} = this._processInputParams(input);
        const data = ctx.data;
        return this._def.type._parse({
            data,
            path: ctx.path,
            parent: ctx
        });
    }
    unwrap() {
        return this._def.type;
    }
}

class ZodPipeline extends ZodType {
    _parse(input) {
        const {status, ctx} = this._processInputParams(input);
        if (ctx.common.async) {
            const handleAsync = async () => {
                const inResult = await this._def.in._parseAsync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx
                });
                if (inResult.status === "aborted") return INVALID;
                if (inResult.status === "dirty") {
                    status.dirty();
                    return DIRTY(inResult.value);
                } else {
                    return this._def.out._parseAsync({
                        data: inResult.value,
                        path: ctx.path,
                        parent: ctx
                    });
                }
            };
            return handleAsync();
        } else {
            const inResult = this._def.in._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx
            });
            if (inResult.status === "aborted") return INVALID;
            if (inResult.status === "dirty") {
                status.dirty();
                return {
                    status: "dirty",
                    value: inResult.value
                };
            } else {
                return this._def.out._parseSync({
                    data: inResult.value,
                    path: ctx.path,
                    parent: ctx
                });
            }
        }
    }
    static create(a, b) {
        return new ZodPipeline({
            in: a,
            out: b,
            typeName: ZodFirstPartyTypeKind.ZodPipeline
        });
    }
}

class ZodReadonly extends ZodType {
    _parse(input) {
        const result = this._def.innerType._parse(input);
        const freeze = data => {
            if (isValid(data)) {
                data.value = Object.freeze(data.value);
            }
            return data;
        };
        return isAsync(result) ? result.then(data => freeze(data)) : freeze(result);
    }
    unwrap() {
        return this._def.innerType;
    }
}

ZodReadonly.create = (type, params) => new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams$1(params)
});

var ZodFirstPartyTypeKind;

(function(ZodFirstPartyTypeKind) {
    ZodFirstPartyTypeKind["ZodString"] = "ZodString";
    ZodFirstPartyTypeKind["ZodNumber"] = "ZodNumber";
    ZodFirstPartyTypeKind["ZodNaN"] = "ZodNaN";
    ZodFirstPartyTypeKind["ZodBigInt"] = "ZodBigInt";
    ZodFirstPartyTypeKind["ZodBoolean"] = "ZodBoolean";
    ZodFirstPartyTypeKind["ZodDate"] = "ZodDate";
    ZodFirstPartyTypeKind["ZodSymbol"] = "ZodSymbol";
    ZodFirstPartyTypeKind["ZodUndefined"] = "ZodUndefined";
    ZodFirstPartyTypeKind["ZodNull"] = "ZodNull";
    ZodFirstPartyTypeKind["ZodAny"] = "ZodAny";
    ZodFirstPartyTypeKind["ZodUnknown"] = "ZodUnknown";
    ZodFirstPartyTypeKind["ZodNever"] = "ZodNever";
    ZodFirstPartyTypeKind["ZodVoid"] = "ZodVoid";
    ZodFirstPartyTypeKind["ZodArray"] = "ZodArray";
    ZodFirstPartyTypeKind["ZodObject"] = "ZodObject";
    ZodFirstPartyTypeKind["ZodUnion"] = "ZodUnion";
    ZodFirstPartyTypeKind["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
    ZodFirstPartyTypeKind["ZodIntersection"] = "ZodIntersection";
    ZodFirstPartyTypeKind["ZodTuple"] = "ZodTuple";
    ZodFirstPartyTypeKind["ZodRecord"] = "ZodRecord";
    ZodFirstPartyTypeKind["ZodMap"] = "ZodMap";
    ZodFirstPartyTypeKind["ZodSet"] = "ZodSet";
    ZodFirstPartyTypeKind["ZodFunction"] = "ZodFunction";
    ZodFirstPartyTypeKind["ZodLazy"] = "ZodLazy";
    ZodFirstPartyTypeKind["ZodLiteral"] = "ZodLiteral";
    ZodFirstPartyTypeKind["ZodEnum"] = "ZodEnum";
    ZodFirstPartyTypeKind["ZodEffects"] = "ZodEffects";
    ZodFirstPartyTypeKind["ZodNativeEnum"] = "ZodNativeEnum";
    ZodFirstPartyTypeKind["ZodOptional"] = "ZodOptional";
    ZodFirstPartyTypeKind["ZodNullable"] = "ZodNullable";
    ZodFirstPartyTypeKind["ZodDefault"] = "ZodDefault";
    ZodFirstPartyTypeKind["ZodCatch"] = "ZodCatch";
    ZodFirstPartyTypeKind["ZodPromise"] = "ZodPromise";
    ZodFirstPartyTypeKind["ZodBranded"] = "ZodBranded";
    ZodFirstPartyTypeKind["ZodPipeline"] = "ZodPipeline";
    ZodFirstPartyTypeKind["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));

const stringType = ZodString.create;

const numberType = ZodNumber.create;

const booleanType = ZodBoolean.create;

const unknownType = ZodUnknown.create;

ZodNever.create;

const arrayType = ZodArray.create;

const objectType = ZodObject.create;

const unionType = ZodUnion.create;

const discriminatedUnionType = ZodDiscriminatedUnion.create;

ZodIntersection.create;

ZodTuple.create;

const recordType = ZodRecord.create;

const literalType = ZodLiteral.create;

const enumType = ZodEnum.create;

ZodPromise.create;

const optionalType = ZodOptional.create;

ZodNullable.create;

const LATEST_PROTOCOL_VERSION = "2025-06-18";

const SUPPORTED_PROTOCOL_VERSIONS = [ LATEST_PROTOCOL_VERSION, "2025-03-26", "2024-11-05", "2024-10-07" ];

const JSONRPC_VERSION = "2.0";

const ProgressTokenSchema = unionType([ stringType(), numberType().int() ]);

const CursorSchema = stringType();

const RequestMetaSchema = objectType({
    progressToken: optionalType(ProgressTokenSchema)
}).passthrough();

const BaseRequestParamsSchema = objectType({
    _meta: optionalType(RequestMetaSchema)
}).passthrough();

const RequestSchema = objectType({
    method: stringType(),
    params: optionalType(BaseRequestParamsSchema)
});

const BaseNotificationParamsSchema = objectType({
    _meta: optionalType(objectType({}).passthrough())
}).passthrough();

const NotificationSchema = objectType({
    method: stringType(),
    params: optionalType(BaseNotificationParamsSchema)
});

const ResultSchema = objectType({
    _meta: optionalType(objectType({}).passthrough())
}).passthrough();

const RequestIdSchema = unionType([ stringType(), numberType().int() ]);

const JSONRPCRequestSchema = objectType({
    jsonrpc: literalType(JSONRPC_VERSION),
    id: RequestIdSchema
}).merge(RequestSchema).strict();

const isJSONRPCRequest = value => JSONRPCRequestSchema.safeParse(value).success;

const JSONRPCNotificationSchema = objectType({
    jsonrpc: literalType(JSONRPC_VERSION)
}).merge(NotificationSchema).strict();

const isJSONRPCNotification = value => JSONRPCNotificationSchema.safeParse(value).success;

const JSONRPCResponseSchema = objectType({
    jsonrpc: literalType(JSONRPC_VERSION),
    id: RequestIdSchema,
    result: ResultSchema
}).strict();

const isJSONRPCResponse = value => JSONRPCResponseSchema.safeParse(value).success;

var ErrorCode;

(function(ErrorCode) {
    ErrorCode[ErrorCode["ConnectionClosed"] = -32e3] = "ConnectionClosed";
    ErrorCode[ErrorCode["RequestTimeout"] = -32001] = "RequestTimeout";
    ErrorCode[ErrorCode["ParseError"] = -32700] = "ParseError";
    ErrorCode[ErrorCode["InvalidRequest"] = -32600] = "InvalidRequest";
    ErrorCode[ErrorCode["MethodNotFound"] = -32601] = "MethodNotFound";
    ErrorCode[ErrorCode["InvalidParams"] = -32602] = "InvalidParams";
    ErrorCode[ErrorCode["InternalError"] = -32603] = "InternalError";
})(ErrorCode || (ErrorCode = {}));

const JSONRPCErrorSchema = objectType({
    jsonrpc: literalType(JSONRPC_VERSION),
    id: RequestIdSchema,
    error: objectType({
        code: numberType().int(),
        message: stringType(),
        data: optionalType(unknownType())
    })
}).strict();

const isJSONRPCError = value => JSONRPCErrorSchema.safeParse(value).success;

const JSONRPCMessageSchema = unionType([ JSONRPCRequestSchema, JSONRPCNotificationSchema, JSONRPCResponseSchema, JSONRPCErrorSchema ]);

const EmptyResultSchema = ResultSchema.strict();

const CancelledNotificationSchema = NotificationSchema.extend({
    method: literalType("notifications/cancelled"),
    params: BaseNotificationParamsSchema.extend({
        requestId: RequestIdSchema,
        reason: stringType().optional()
    })
});

const BaseMetadataSchema = objectType({
    name: stringType(),
    title: optionalType(stringType())
}).passthrough();

const ImplementationSchema = BaseMetadataSchema.extend({
    version: stringType()
});

const ClientCapabilitiesSchema = objectType({
    experimental: optionalType(objectType({}).passthrough()),
    sampling: optionalType(objectType({}).passthrough()),
    elicitation: optionalType(objectType({}).passthrough()),
    roots: optionalType(objectType({
        listChanged: optionalType(booleanType())
    }).passthrough())
}).passthrough();

const InitializeRequestSchema = RequestSchema.extend({
    method: literalType("initialize"),
    params: BaseRequestParamsSchema.extend({
        protocolVersion: stringType(),
        capabilities: ClientCapabilitiesSchema,
        clientInfo: ImplementationSchema
    })
});

const ServerCapabilitiesSchema = objectType({
    experimental: optionalType(objectType({}).passthrough()),
    logging: optionalType(objectType({}).passthrough()),
    completions: optionalType(objectType({}).passthrough()),
    prompts: optionalType(objectType({
        listChanged: optionalType(booleanType())
    }).passthrough()),
    resources: optionalType(objectType({
        subscribe: optionalType(booleanType()),
        listChanged: optionalType(booleanType())
    }).passthrough()),
    tools: optionalType(objectType({
        listChanged: optionalType(booleanType())
    }).passthrough())
}).passthrough();

const InitializeResultSchema = ResultSchema.extend({
    protocolVersion: stringType(),
    capabilities: ServerCapabilitiesSchema,
    serverInfo: ImplementationSchema,
    instructions: optionalType(stringType())
});

const InitializedNotificationSchema = NotificationSchema.extend({
    method: literalType("notifications/initialized")
});

const PingRequestSchema = RequestSchema.extend({
    method: literalType("ping")
});

const ProgressSchema = objectType({
    progress: numberType(),
    total: optionalType(numberType()),
    message: optionalType(stringType())
}).passthrough();

const ProgressNotificationSchema = NotificationSchema.extend({
    method: literalType("notifications/progress"),
    params: BaseNotificationParamsSchema.merge(ProgressSchema).extend({
        progressToken: ProgressTokenSchema
    })
});

const PaginatedRequestSchema = RequestSchema.extend({
    params: BaseRequestParamsSchema.extend({
        cursor: optionalType(CursorSchema)
    }).optional()
});

const PaginatedResultSchema = ResultSchema.extend({
    nextCursor: optionalType(CursorSchema)
});

const ResourceContentsSchema = objectType({
    uri: stringType(),
    mimeType: optionalType(stringType()),
    _meta: optionalType(objectType({}).passthrough())
}).passthrough();

const TextResourceContentsSchema = ResourceContentsSchema.extend({
    text: stringType()
});

const BlobResourceContentsSchema = ResourceContentsSchema.extend({
    blob: stringType().base64()
});

const ResourceSchema = BaseMetadataSchema.extend({
    uri: stringType(),
    description: optionalType(stringType()),
    mimeType: optionalType(stringType()),
    _meta: optionalType(objectType({}).passthrough())
});

const ResourceTemplateSchema = BaseMetadataSchema.extend({
    uriTemplate: stringType(),
    description: optionalType(stringType()),
    mimeType: optionalType(stringType()),
    _meta: optionalType(objectType({}).passthrough())
});

const ListResourcesRequestSchema = PaginatedRequestSchema.extend({
    method: literalType("resources/list")
});

const ListResourcesResultSchema = PaginatedResultSchema.extend({
    resources: arrayType(ResourceSchema)
});

const ListResourceTemplatesRequestSchema = PaginatedRequestSchema.extend({
    method: literalType("resources/templates/list")
});

const ListResourceTemplatesResultSchema = PaginatedResultSchema.extend({
    resourceTemplates: arrayType(ResourceTemplateSchema)
});

const ReadResourceRequestSchema = RequestSchema.extend({
    method: literalType("resources/read"),
    params: BaseRequestParamsSchema.extend({
        uri: stringType()
    })
});

const ReadResourceResultSchema = ResultSchema.extend({
    contents: arrayType(unionType([ TextResourceContentsSchema, BlobResourceContentsSchema ]))
});

const ResourceListChangedNotificationSchema = NotificationSchema.extend({
    method: literalType("notifications/resources/list_changed")
});

const SubscribeRequestSchema = RequestSchema.extend({
    method: literalType("resources/subscribe"),
    params: BaseRequestParamsSchema.extend({
        uri: stringType()
    })
});

const UnsubscribeRequestSchema = RequestSchema.extend({
    method: literalType("resources/unsubscribe"),
    params: BaseRequestParamsSchema.extend({
        uri: stringType()
    })
});

const ResourceUpdatedNotificationSchema = NotificationSchema.extend({
    method: literalType("notifications/resources/updated"),
    params: BaseNotificationParamsSchema.extend({
        uri: stringType()
    })
});

const PromptArgumentSchema = objectType({
    name: stringType(),
    description: optionalType(stringType()),
    required: optionalType(booleanType())
}).passthrough();

const PromptSchema = BaseMetadataSchema.extend({
    description: optionalType(stringType()),
    arguments: optionalType(arrayType(PromptArgumentSchema)),
    _meta: optionalType(objectType({}).passthrough())
});

const ListPromptsRequestSchema = PaginatedRequestSchema.extend({
    method: literalType("prompts/list")
});

const ListPromptsResultSchema = PaginatedResultSchema.extend({
    prompts: arrayType(PromptSchema)
});

const GetPromptRequestSchema = RequestSchema.extend({
    method: literalType("prompts/get"),
    params: BaseRequestParamsSchema.extend({
        name: stringType(),
        arguments: optionalType(recordType(stringType()))
    })
});

const TextContentSchema = objectType({
    type: literalType("text"),
    text: stringType(),
    _meta: optionalType(objectType({}).passthrough())
}).passthrough();

const ImageContentSchema = objectType({
    type: literalType("image"),
    data: stringType().base64(),
    mimeType: stringType(),
    _meta: optionalType(objectType({}).passthrough())
}).passthrough();

const AudioContentSchema = objectType({
    type: literalType("audio"),
    data: stringType().base64(),
    mimeType: stringType(),
    _meta: optionalType(objectType({}).passthrough())
}).passthrough();

const EmbeddedResourceSchema = objectType({
    type: literalType("resource"),
    resource: unionType([ TextResourceContentsSchema, BlobResourceContentsSchema ]),
    _meta: optionalType(objectType({}).passthrough())
}).passthrough();

const ResourceLinkSchema = ResourceSchema.extend({
    type: literalType("resource_link")
});

const ContentBlockSchema = unionType([ TextContentSchema, ImageContentSchema, AudioContentSchema, ResourceLinkSchema, EmbeddedResourceSchema ]);

const PromptMessageSchema = objectType({
    role: enumType([ "user", "assistant" ]),
    content: ContentBlockSchema
}).passthrough();

const GetPromptResultSchema = ResultSchema.extend({
    description: optionalType(stringType()),
    messages: arrayType(PromptMessageSchema)
});

const PromptListChangedNotificationSchema = NotificationSchema.extend({
    method: literalType("notifications/prompts/list_changed")
});

const ToolAnnotationsSchema = objectType({
    title: optionalType(stringType()),
    readOnlyHint: optionalType(booleanType()),
    destructiveHint: optionalType(booleanType()),
    idempotentHint: optionalType(booleanType()),
    openWorldHint: optionalType(booleanType())
}).passthrough();

const ToolSchema = BaseMetadataSchema.extend({
    description: optionalType(stringType()),
    inputSchema: objectType({
        type: literalType("object"),
        properties: optionalType(objectType({}).passthrough()),
        required: optionalType(arrayType(stringType()))
    }).passthrough(),
    outputSchema: optionalType(objectType({
        type: literalType("object"),
        properties: optionalType(objectType({}).passthrough()),
        required: optionalType(arrayType(stringType()))
    }).passthrough()),
    annotations: optionalType(ToolAnnotationsSchema),
    _meta: optionalType(objectType({}).passthrough())
});

const ListToolsRequestSchema = PaginatedRequestSchema.extend({
    method: literalType("tools/list")
});

const ListToolsResultSchema = PaginatedResultSchema.extend({
    tools: arrayType(ToolSchema)
});

const CallToolResultSchema = ResultSchema.extend({
    content: arrayType(ContentBlockSchema).default([]),
    structuredContent: objectType({}).passthrough().optional(),
    isError: optionalType(booleanType())
});

CallToolResultSchema.or(ResultSchema.extend({
    toolResult: unknownType()
}));

const CallToolRequestSchema = RequestSchema.extend({
    method: literalType("tools/call"),
    params: BaseRequestParamsSchema.extend({
        name: stringType(),
        arguments: optionalType(recordType(unknownType()))
    })
});

const ToolListChangedNotificationSchema = NotificationSchema.extend({
    method: literalType("notifications/tools/list_changed")
});

const LoggingLevelSchema = enumType([ "debug", "info", "notice", "warning", "error", "critical", "alert", "emergency" ]);

const SetLevelRequestSchema = RequestSchema.extend({
    method: literalType("logging/setLevel"),
    params: BaseRequestParamsSchema.extend({
        level: LoggingLevelSchema
    })
});

const LoggingMessageNotificationSchema = NotificationSchema.extend({
    method: literalType("notifications/message"),
    params: BaseNotificationParamsSchema.extend({
        level: LoggingLevelSchema,
        logger: optionalType(stringType()),
        data: unknownType()
    })
});

const ModelHintSchema = objectType({
    name: stringType().optional()
}).passthrough();

const ModelPreferencesSchema = objectType({
    hints: optionalType(arrayType(ModelHintSchema)),
    costPriority: optionalType(numberType().min(0).max(1)),
    speedPriority: optionalType(numberType().min(0).max(1)),
    intelligencePriority: optionalType(numberType().min(0).max(1))
}).passthrough();

const SamplingMessageSchema = objectType({
    role: enumType([ "user", "assistant" ]),
    content: unionType([ TextContentSchema, ImageContentSchema, AudioContentSchema ])
}).passthrough();

const CreateMessageRequestSchema = RequestSchema.extend({
    method: literalType("sampling/createMessage"),
    params: BaseRequestParamsSchema.extend({
        messages: arrayType(SamplingMessageSchema),
        systemPrompt: optionalType(stringType()),
        includeContext: optionalType(enumType([ "none", "thisServer", "allServers" ])),
        temperature: optionalType(numberType()),
        maxTokens: numberType().int(),
        stopSequences: optionalType(arrayType(stringType())),
        metadata: optionalType(objectType({}).passthrough()),
        modelPreferences: optionalType(ModelPreferencesSchema)
    })
});

const CreateMessageResultSchema = ResultSchema.extend({
    model: stringType(),
    stopReason: optionalType(enumType([ "endTurn", "stopSequence", "maxTokens" ]).or(stringType())),
    role: enumType([ "user", "assistant" ]),
    content: discriminatedUnionType("type", [ TextContentSchema, ImageContentSchema, AudioContentSchema ])
});

const BooleanSchemaSchema = objectType({
    type: literalType("boolean"),
    title: optionalType(stringType()),
    description: optionalType(stringType()),
    default: optionalType(booleanType())
}).passthrough();

const StringSchemaSchema = objectType({
    type: literalType("string"),
    title: optionalType(stringType()),
    description: optionalType(stringType()),
    minLength: optionalType(numberType()),
    maxLength: optionalType(numberType()),
    format: optionalType(enumType([ "email", "uri", "date", "date-time" ]))
}).passthrough();

const NumberSchemaSchema = objectType({
    type: enumType([ "number", "integer" ]),
    title: optionalType(stringType()),
    description: optionalType(stringType()),
    minimum: optionalType(numberType()),
    maximum: optionalType(numberType())
}).passthrough();

const EnumSchemaSchema = objectType({
    type: literalType("string"),
    title: optionalType(stringType()),
    description: optionalType(stringType()),
    enum: arrayType(stringType()),
    enumNames: optionalType(arrayType(stringType()))
}).passthrough();

const PrimitiveSchemaDefinitionSchema = unionType([ BooleanSchemaSchema, StringSchemaSchema, NumberSchemaSchema, EnumSchemaSchema ]);

const ElicitRequestSchema = RequestSchema.extend({
    method: literalType("elicitation/create"),
    params: BaseRequestParamsSchema.extend({
        message: stringType(),
        requestedSchema: objectType({
            type: literalType("object"),
            properties: recordType(stringType(), PrimitiveSchemaDefinitionSchema),
            required: optionalType(arrayType(stringType()))
        }).passthrough()
    })
});

const ElicitResultSchema = ResultSchema.extend({
    action: enumType([ "accept", "reject", "cancel" ]),
    content: optionalType(recordType(stringType(), unknownType()))
});

const ResourceTemplateReferenceSchema = objectType({
    type: literalType("ref/resource"),
    uri: stringType()
}).passthrough();

const PromptReferenceSchema = objectType({
    type: literalType("ref/prompt"),
    name: stringType()
}).passthrough();

const CompleteRequestSchema = RequestSchema.extend({
    method: literalType("completion/complete"),
    params: BaseRequestParamsSchema.extend({
        ref: unionType([ PromptReferenceSchema, ResourceTemplateReferenceSchema ]),
        argument: objectType({
            name: stringType(),
            value: stringType()
        }).passthrough(),
        context: optionalType(objectType({
            arguments: optionalType(recordType(stringType(), stringType()))
        }))
    })
});

const CompleteResultSchema = ResultSchema.extend({
    completion: objectType({
        values: arrayType(stringType()).max(100),
        total: optionalType(numberType().int()),
        hasMore: optionalType(booleanType())
    }).passthrough()
});

const RootSchema = objectType({
    uri: stringType().startsWith("file://"),
    name: optionalType(stringType()),
    _meta: optionalType(objectType({}).passthrough())
}).passthrough();

const ListRootsRequestSchema = RequestSchema.extend({
    method: literalType("roots/list")
});

const ListRootsResultSchema = ResultSchema.extend({
    roots: arrayType(RootSchema)
});

const RootsListChangedNotificationSchema = NotificationSchema.extend({
    method: literalType("notifications/roots/list_changed")
});

unionType([ PingRequestSchema, InitializeRequestSchema, CompleteRequestSchema, SetLevelRequestSchema, GetPromptRequestSchema, ListPromptsRequestSchema, ListResourcesRequestSchema, ListResourceTemplatesRequestSchema, ReadResourceRequestSchema, SubscribeRequestSchema, UnsubscribeRequestSchema, CallToolRequestSchema, ListToolsRequestSchema ]);

unionType([ CancelledNotificationSchema, ProgressNotificationSchema, InitializedNotificationSchema, RootsListChangedNotificationSchema ]);

unionType([ EmptyResultSchema, CreateMessageResultSchema, ElicitResultSchema, ListRootsResultSchema ]);

unionType([ PingRequestSchema, CreateMessageRequestSchema, ElicitRequestSchema, ListRootsRequestSchema ]);

unionType([ CancelledNotificationSchema, ProgressNotificationSchema, LoggingMessageNotificationSchema, ResourceUpdatedNotificationSchema, ResourceListChangedNotificationSchema, ToolListChangedNotificationSchema, PromptListChangedNotificationSchema ]);

unionType([ EmptyResultSchema, InitializeResultSchema, CompleteResultSchema, GetPromptResultSchema, ListPromptsResultSchema, ListResourcesResultSchema, ListResourceTemplatesResultSchema, ReadResourceResultSchema, CallToolResultSchema, ListToolsResultSchema ]);

class McpError extends Error {
    constructor(code, message, data) {
        super(`MCP error ${code}: ${message}`);
        this.code = code;
        this.data = data;
        this.name = "McpError";
    }
}

const DEFAULT_REQUEST_TIMEOUT_MSEC = 6e4;

class Protocol {
    constructor(_options) {
        this._options = _options;
        this._requestMessageId = 0;
        this._requestHandlers = new Map;
        this._requestHandlerAbortControllers = new Map;
        this._notificationHandlers = new Map;
        this._responseHandlers = new Map;
        this._progressHandlers = new Map;
        this._timeoutInfo = new Map;
        this.setNotificationHandler(CancelledNotificationSchema, notification => {
            const controller = this._requestHandlerAbortControllers.get(notification.params.requestId);
            controller === null || controller === void 0 ? void 0 : controller.abort(notification.params.reason);
        });
        this.setNotificationHandler(ProgressNotificationSchema, notification => {
            this._onprogress(notification);
        });
        this.setRequestHandler(PingRequestSchema, _request => ({}));
    }
    _setupTimeout(messageId, timeout, maxTotalTimeout, onTimeout, resetTimeoutOnProgress = false) {
        this._timeoutInfo.set(messageId, {
            timeoutId: setTimeout(onTimeout, timeout),
            startTime: Date.now(),
            timeout,
            maxTotalTimeout,
            resetTimeoutOnProgress,
            onTimeout
        });
    }
    _resetTimeout(messageId) {
        const info = this._timeoutInfo.get(messageId);
        if (!info) return false;
        const totalElapsed = Date.now() - info.startTime;
        if (info.maxTotalTimeout && totalElapsed >= info.maxTotalTimeout) {
            this._timeoutInfo.delete(messageId);
            throw new McpError(ErrorCode.RequestTimeout, "Maximum total timeout exceeded", {
                maxTotalTimeout: info.maxTotalTimeout,
                totalElapsed
            });
        }
        clearTimeout(info.timeoutId);
        info.timeoutId = setTimeout(info.onTimeout, info.timeout);
        return true;
    }
    _cleanupTimeout(messageId) {
        const info = this._timeoutInfo.get(messageId);
        if (info) {
            clearTimeout(info.timeoutId);
            this._timeoutInfo.delete(messageId);
        }
    }
    async connect(transport) {
        var _a, _b, _c;
        this._transport = transport;
        const _onclose = (_a = this.transport) === null || _a === void 0 ? void 0 : _a.onclose;
        this._transport.onclose = () => {
            _onclose === null || _onclose === void 0 ? void 0 : _onclose();
            this._onclose();
        };
        const _onerror = (_b = this.transport) === null || _b === void 0 ? void 0 : _b.onerror;
        this._transport.onerror = error => {
            _onerror === null || _onerror === void 0 ? void 0 : _onerror(error);
            this._onerror(error);
        };
        const _onmessage = (_c = this._transport) === null || _c === void 0 ? void 0 : _c.onmessage;
        this._transport.onmessage = (message, extra) => {
            _onmessage === null || _onmessage === void 0 ? void 0 : _onmessage(message, extra);
            if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
                this._onresponse(message);
            } else if (isJSONRPCRequest(message)) {
                this._onrequest(message, extra);
            } else if (isJSONRPCNotification(message)) {
                this._onnotification(message);
            } else {
                this._onerror(new Error(`Unknown message type: ${JSON.stringify(message)}`));
            }
        };
        await this._transport.start();
    }
    _onclose() {
        var _a;
        const responseHandlers = this._responseHandlers;
        this._responseHandlers = new Map;
        this._progressHandlers.clear();
        this._transport = undefined;
        (_a = this.onclose) === null || _a === void 0 ? void 0 : _a.call(this);
        const error = new McpError(ErrorCode.ConnectionClosed, "Connection closed");
        for (const handler of responseHandlers.values()) {
            handler(error);
        }
    }
    _onerror(error) {
        var _a;
        (_a = this.onerror) === null || _a === void 0 ? void 0 : _a.call(this, error);
    }
    _onnotification(notification) {
        var _a;
        const handler = (_a = this._notificationHandlers.get(notification.method)) !== null && _a !== void 0 ? _a : this.fallbackNotificationHandler;
        if (handler === undefined) {
            return;
        }
        Promise.resolve().then(() => handler(notification)).catch(error => this._onerror(new Error(`Uncaught error in notification handler: ${error}`)));
    }
    _onrequest(request, extra) {
        var _a, _b, _c, _d;
        const handler = (_a = this._requestHandlers.get(request.method)) !== null && _a !== void 0 ? _a : this.fallbackRequestHandler;
        if (handler === undefined) {
            (_b = this._transport) === null || _b === void 0 ? void 0 : _b.send({
                jsonrpc: "2.0",
                id: request.id,
                error: {
                    code: ErrorCode.MethodNotFound,
                    message: "Method not found"
                }
            }).catch(error => this._onerror(new Error(`Failed to send an error response: ${error}`)));
            return;
        }
        const abortController = new AbortController;
        this._requestHandlerAbortControllers.set(request.id, abortController);
        const fullExtra = {
            signal: abortController.signal,
            sessionId: (_c = this._transport) === null || _c === void 0 ? void 0 : _c.sessionId,
            _meta: (_d = request.params) === null || _d === void 0 ? void 0 : _d._meta,
            sendNotification: notification => this.notification(notification, {
                relatedRequestId: request.id
            }),
            sendRequest: (r, resultSchema, options) => this.request(r, resultSchema, {
                ...options,
                relatedRequestId: request.id
            }),
            authInfo: extra === null || extra === void 0 ? void 0 : extra.authInfo,
            requestId: request.id,
            requestInfo: extra === null || extra === void 0 ? void 0 : extra.requestInfo
        };
        Promise.resolve().then(() => handler(request, fullExtra)).then(result => {
            var _a;
            if (abortController.signal.aborted) {
                return;
            }
            return (_a = this._transport) === null || _a === void 0 ? void 0 : _a.send({
                result,
                jsonrpc: "2.0",
                id: request.id
            });
        }, error => {
            var _a, _b;
            if (abortController.signal.aborted) {
                return;
            }
            return (_a = this._transport) === null || _a === void 0 ? void 0 : _a.send({
                jsonrpc: "2.0",
                id: request.id,
                error: {
                    code: Number.isSafeInteger(error["code"]) ? error["code"] : ErrorCode.InternalError,
                    message: (_b = error.message) !== null && _b !== void 0 ? _b : "Internal error"
                }
            });
        }).catch(error => this._onerror(new Error(`Failed to send response: ${error}`))).finally(() => {
            this._requestHandlerAbortControllers.delete(request.id);
        });
    }
    _onprogress(notification) {
        const {progressToken, ...params} = notification.params;
        const messageId = Number(progressToken);
        const handler = this._progressHandlers.get(messageId);
        if (!handler) {
            this._onerror(new Error(`Received a progress notification for an unknown token: ${JSON.stringify(notification)}`));
            return;
        }
        const responseHandler = this._responseHandlers.get(messageId);
        const timeoutInfo = this._timeoutInfo.get(messageId);
        if (timeoutInfo && responseHandler && timeoutInfo.resetTimeoutOnProgress) {
            try {
                this._resetTimeout(messageId);
            } catch (error) {
                responseHandler(error);
                return;
            }
        }
        handler(params);
    }
    _onresponse(response) {
        const messageId = Number(response.id);
        const handler = this._responseHandlers.get(messageId);
        if (handler === undefined) {
            this._onerror(new Error(`Received a response for an unknown message ID: ${JSON.stringify(response)}`));
            return;
        }
        this._responseHandlers.delete(messageId);
        this._progressHandlers.delete(messageId);
        this._cleanupTimeout(messageId);
        if (isJSONRPCResponse(response)) {
            handler(response);
        } else {
            const error = new McpError(response.error.code, response.error.message, response.error.data);
            handler(error);
        }
    }
    get transport() {
        return this._transport;
    }
    async close() {
        var _a;
        await ((_a = this._transport) === null || _a === void 0 ? void 0 : _a.close());
    }
    request(request, resultSchema, options) {
        const {relatedRequestId, resumptionToken, onresumptiontoken} = options !== null && options !== void 0 ? options : {};
        return new Promise((resolve, reject) => {
            var _a, _b, _c, _d, _e, _f;
            if (!this._transport) {
                reject(new Error("Not connected"));
                return;
            }
            if (((_a = this._options) === null || _a === void 0 ? void 0 : _a.enforceStrictCapabilities) === true) {
                this.assertCapabilityForMethod(request.method);
            }
            (_b = options === null || options === void 0 ? void 0 : options.signal) === null || _b === void 0 ? void 0 : _b.throwIfAborted();
            const messageId = this._requestMessageId++;
            const jsonrpcRequest = {
                ...request,
                jsonrpc: "2.0",
                id: messageId
            };
            if (options === null || options === void 0 ? void 0 : options.onprogress) {
                this._progressHandlers.set(messageId, options.onprogress);
                jsonrpcRequest.params = {
                    ...request.params,
                    _meta: {
                        ...((_c = request.params) === null || _c === void 0 ? void 0 : _c._meta) || {},
                        progressToken: messageId
                    }
                };
            }
            const cancel = reason => {
                var _a;
                this._responseHandlers.delete(messageId);
                this._progressHandlers.delete(messageId);
                this._cleanupTimeout(messageId);
                (_a = this._transport) === null || _a === void 0 ? void 0 : _a.send({
                    jsonrpc: "2.0",
                    method: "notifications/cancelled",
                    params: {
                        requestId: messageId,
                        reason: String(reason)
                    }
                }, {
                    relatedRequestId,
                    resumptionToken,
                    onresumptiontoken
                }).catch(error => this._onerror(new Error(`Failed to send cancellation: ${error}`)));
                reject(reason);
            };
            this._responseHandlers.set(messageId, response => {
                var _a;
                if ((_a = options === null || options === void 0 ? void 0 : options.signal) === null || _a === void 0 ? void 0 : _a.aborted) {
                    return;
                }
                if (response instanceof Error) {
                    return reject(response);
                }
                try {
                    const result = resultSchema.parse(response.result);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
            (_d = options === null || options === void 0 ? void 0 : options.signal) === null || _d === void 0 ? void 0 : _d.addEventListener("abort", () => {
                var _a;
                cancel((_a = options === null || options === void 0 ? void 0 : options.signal) === null || _a === void 0 ? void 0 : _a.reason);
            });
            const timeout = (_e = options === null || options === void 0 ? void 0 : options.timeout) !== null && _e !== void 0 ? _e : DEFAULT_REQUEST_TIMEOUT_MSEC;
            const timeoutHandler = () => cancel(new McpError(ErrorCode.RequestTimeout, "Request timed out", {
                timeout
            }));
            this._setupTimeout(messageId, timeout, options === null || options === void 0 ? void 0 : options.maxTotalTimeout, timeoutHandler, (_f = options === null || options === void 0 ? void 0 : options.resetTimeoutOnProgress) !== null && _f !== void 0 ? _f : false);
            this._transport.send(jsonrpcRequest, {
                relatedRequestId,
                resumptionToken,
                onresumptiontoken
            }).catch(error => {
                this._cleanupTimeout(messageId);
                reject(error);
            });
        });
    }
    async notification(notification, options) {
        if (!this._transport) {
            throw new Error("Not connected");
        }
        this.assertNotificationCapability(notification.method);
        const jsonrpcNotification = {
            ...notification,
            jsonrpc: "2.0"
        };
        await this._transport.send(jsonrpcNotification, options);
    }
    setRequestHandler(requestSchema, handler) {
        const method = requestSchema.shape.method.value;
        this.assertRequestHandlerCapability(method);
        this._requestHandlers.set(method, (request, extra) => Promise.resolve(handler(requestSchema.parse(request), extra)));
    }
    removeRequestHandler(method) {
        this._requestHandlers.delete(method);
    }
    assertCanSetRequestHandler(method) {
        if (this._requestHandlers.has(method)) {
            throw new Error(`A request handler for ${method} already exists, which would be overridden`);
        }
    }
    setNotificationHandler(notificationSchema, handler) {
        this._notificationHandlers.set(notificationSchema.shape.method.value, notification => Promise.resolve(handler(notificationSchema.parse(notification))));
    }
    removeNotificationHandler(method) {
        this._notificationHandlers.delete(method);
    }
}

function mergeCapabilities(base, additional) {
    return Object.entries(additional).reduce((acc, [key, value]) => {
        if (value && typeof value === "object") {
            acc[key] = acc[key] ? {
                ...acc[key],
                ...value
            } : value;
        } else {
            acc[key] = value;
        }
        return acc;
    }, {
        ...base
    });
}

function getDefaultExportFromCjs(x) {
    return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}

var uri_all$1 = {
    exports: {}
};

/** @license URI.js v4.4.1 (c) 2011 Gary Court. License: http://github.com/garycourt/uri-js */ var uri_all = uri_all$1.exports;

var hasRequiredUri_all;

function requireUri_all() {
    if (hasRequiredUri_all) return uri_all$1.exports;
    hasRequiredUri_all = 1;
    (function(module, exports) {
        (function(global, factory) {
            factory(exports);
        })(uri_all, function(exports) {
            function merge() {
                for (var _len = arguments.length, sets = Array(_len), _key = 0; _key < _len; _key++) {
                    sets[_key] = arguments[_key];
                }
                if (sets.length > 1) {
                    sets[0] = sets[0].slice(0, -1);
                    var xl = sets.length - 1;
                    for (var x = 1; x < xl; ++x) {
                        sets[x] = sets[x].slice(1, -1);
                    }
                    sets[xl] = sets[xl].slice(1);
                    return sets.join("");
                } else {
                    return sets[0];
                }
            }
            function subexp(str) {
                return "(?:" + str + ")";
            }
            function typeOf(o) {
                return o === undefined ? "undefined" : o === null ? "null" : Object.prototype.toString.call(o).split(" ").pop().split("]").shift().toLowerCase();
            }
            function toUpperCase(str) {
                return str.toUpperCase();
            }
            function toArray(obj) {
                return obj !== undefined && obj !== null ? obj instanceof Array ? obj : typeof obj.length !== "number" || obj.split || obj.setInterval || obj.call ? [ obj ] : Array.prototype.slice.call(obj) : [];
            }
            function assign(target, source) {
                var obj = target;
                if (source) {
                    for (var key in source) {
                        obj[key] = source[key];
                    }
                }
                return obj;
            }
            function buildExps(isIRI) {
                var ALPHA$$ = "[A-Za-z]", DIGIT$$ = "[0-9]", HEXDIG$$ = merge(DIGIT$$, "[A-Fa-f]"), PCT_ENCODED$ = subexp(subexp("%[EFef]" + HEXDIG$$ + "%" + HEXDIG$$ + HEXDIG$$ + "%" + HEXDIG$$ + HEXDIG$$) + "|" + subexp("%[89A-Fa-f]" + HEXDIG$$ + "%" + HEXDIG$$ + HEXDIG$$) + "|" + subexp("%" + HEXDIG$$ + HEXDIG$$)), GEN_DELIMS$$ = "[\\:\\/\\?\\#\\[\\]\\@]", SUB_DELIMS$$ = "[\\!\\$\\&\\'\\(\\)\\*\\+\\,\\;\\=]", RESERVED$$ = merge(GEN_DELIMS$$, SUB_DELIMS$$), UCSCHAR$$ = isIRI ? "[\\xA0-\\u200D\\u2010-\\u2029\\u202F-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFEF]" : "[]", IPRIVATE$$ = isIRI ? "[\\uE000-\\uF8FF]" : "[]", UNRESERVED$$ = merge(ALPHA$$, DIGIT$$, "[\\-\\.\\_\\~]", UCSCHAR$$);
                subexp(ALPHA$$ + merge(ALPHA$$, DIGIT$$, "[\\+\\-\\.]") + "*");
                subexp(subexp(PCT_ENCODED$ + "|" + merge(UNRESERVED$$, SUB_DELIMS$$, "[\\:]")) + "*");
                var DEC_OCTET_RELAXED$ = subexp(subexp("25[0-5]") + "|" + subexp("2[0-4]" + DIGIT$$) + "|" + subexp("1" + DIGIT$$ + DIGIT$$) + "|" + subexp("0?[1-9]" + DIGIT$$) + "|0?0?" + DIGIT$$), IPV4ADDRESS$ = subexp(DEC_OCTET_RELAXED$ + "\\." + DEC_OCTET_RELAXED$ + "\\." + DEC_OCTET_RELAXED$ + "\\." + DEC_OCTET_RELAXED$), H16$ = subexp(HEXDIG$$ + "{1,4}"), LS32$ = subexp(subexp(H16$ + "\\:" + H16$) + "|" + IPV4ADDRESS$), IPV6ADDRESS1$ = subexp(subexp(H16$ + "\\:") + "{6}" + LS32$), IPV6ADDRESS2$ = subexp("\\:\\:" + subexp(H16$ + "\\:") + "{5}" + LS32$), IPV6ADDRESS3$ = subexp(subexp(H16$) + "?\\:\\:" + subexp(H16$ + "\\:") + "{4}" + LS32$), IPV6ADDRESS4$ = subexp(subexp(subexp(H16$ + "\\:") + "{0,1}" + H16$) + "?\\:\\:" + subexp(H16$ + "\\:") + "{3}" + LS32$), IPV6ADDRESS5$ = subexp(subexp(subexp(H16$ + "\\:") + "{0,2}" + H16$) + "?\\:\\:" + subexp(H16$ + "\\:") + "{2}" + LS32$), IPV6ADDRESS6$ = subexp(subexp(subexp(H16$ + "\\:") + "{0,3}" + H16$) + "?\\:\\:" + H16$ + "\\:" + LS32$), IPV6ADDRESS7$ = subexp(subexp(subexp(H16$ + "\\:") + "{0,4}" + H16$) + "?\\:\\:" + LS32$), IPV6ADDRESS8$ = subexp(subexp(subexp(H16$ + "\\:") + "{0,5}" + H16$) + "?\\:\\:" + H16$), IPV6ADDRESS9$ = subexp(subexp(subexp(H16$ + "\\:") + "{0,6}" + H16$) + "?\\:\\:"), IPV6ADDRESS$ = subexp([ IPV6ADDRESS1$, IPV6ADDRESS2$, IPV6ADDRESS3$, IPV6ADDRESS4$, IPV6ADDRESS5$, IPV6ADDRESS6$, IPV6ADDRESS7$, IPV6ADDRESS8$, IPV6ADDRESS9$ ].join("|")), ZONEID$ = subexp(subexp(UNRESERVED$$ + "|" + PCT_ENCODED$) + "+");
                subexp("[vV]" + HEXDIG$$ + "+\\." + merge(UNRESERVED$$, SUB_DELIMS$$, "[\\:]") + "+");
                subexp(subexp(PCT_ENCODED$ + "|" + merge(UNRESERVED$$, SUB_DELIMS$$)) + "*");
                var PCHAR$ = subexp(PCT_ENCODED$ + "|" + merge(UNRESERVED$$, SUB_DELIMS$$, "[\\:\\@]"));
                subexp(subexp(PCT_ENCODED$ + "|" + merge(UNRESERVED$$, SUB_DELIMS$$, "[\\@]")) + "+");
                subexp(subexp(PCHAR$ + "|" + merge("[\\/\\?]", IPRIVATE$$)) + "*");
                return {
                    NOT_SCHEME: new RegExp(merge("[^]", ALPHA$$, DIGIT$$, "[\\+\\-\\.]"), "g"),
                    NOT_USERINFO: new RegExp(merge("[^\\%\\:]", UNRESERVED$$, SUB_DELIMS$$), "g"),
                    NOT_HOST: new RegExp(merge("[^\\%\\[\\]\\:]", UNRESERVED$$, SUB_DELIMS$$), "g"),
                    NOT_PATH: new RegExp(merge("[^\\%\\/\\:\\@]", UNRESERVED$$, SUB_DELIMS$$), "g"),
                    NOT_PATH_NOSCHEME: new RegExp(merge("[^\\%\\/\\@]", UNRESERVED$$, SUB_DELIMS$$), "g"),
                    NOT_QUERY: new RegExp(merge("[^\\%]", UNRESERVED$$, SUB_DELIMS$$, "[\\:\\@\\/\\?]", IPRIVATE$$), "g"),
                    NOT_FRAGMENT: new RegExp(merge("[^\\%]", UNRESERVED$$, SUB_DELIMS$$, "[\\:\\@\\/\\?]"), "g"),
                    ESCAPE: new RegExp(merge("[^]", UNRESERVED$$, SUB_DELIMS$$), "g"),
                    UNRESERVED: new RegExp(UNRESERVED$$, "g"),
                    OTHER_CHARS: new RegExp(merge("[^\\%]", UNRESERVED$$, RESERVED$$), "g"),
                    PCT_ENCODED: new RegExp(PCT_ENCODED$, "g"),
                    IPV4ADDRESS: new RegExp("^(" + IPV4ADDRESS$ + ")$"),
                    IPV6ADDRESS: new RegExp("^\\[?(" + IPV6ADDRESS$ + ")" + subexp(subexp("\\%25|\\%(?!" + HEXDIG$$ + "{2})") + "(" + ZONEID$ + ")") + "?\\]?$")
                };
            }
            var URI_PROTOCOL = buildExps(false);
            var IRI_PROTOCOL = buildExps(true);
            var slicedToArray = function() {
                function sliceIterator(arr, i) {
                    var _arr = [];
                    var _n = true;
                    var _d = false;
                    var _e = undefined;
                    try {
                        for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
                            _arr.push(_s.value);
                            if (i && _arr.length === i) break;
                        }
                    } catch (err) {
                        _d = true;
                        _e = err;
                    } finally {
                        try {
                            if (!_n && _i["return"]) _i["return"]();
                        } finally {
                            if (_d) throw _e;
                        }
                    }
                    return _arr;
                }
                return function(arr, i) {
                    if (Array.isArray(arr)) {
                        return arr;
                    } else if (Symbol.iterator in Object(arr)) {
                        return sliceIterator(arr, i);
                    } else {
                        throw new TypeError("Invalid attempt to destructure non-iterable instance");
                    }
                };
            }();
            var toConsumableArray = function(arr) {
                if (Array.isArray(arr)) {
                    for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];
                    return arr2;
                } else {
                    return Array.from(arr);
                }
            };
            var maxInt = 2147483647;
            var base = 36;
            var tMin = 1;
            var tMax = 26;
            var skew = 38;
            var damp = 700;
            var initialBias = 72;
            var initialN = 128;
            var delimiter = "-";
            var regexPunycode = /^xn--/;
            var regexNonASCII = /[^\0-\x7E]/;
            var regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g;
            var errors = {
                overflow: "Overflow: input needs wider integers to process",
                "not-basic": "Illegal input >= 0x80 (not a basic code point)",
                "invalid-input": "Invalid input"
            };
            var baseMinusTMin = base - tMin;
            var floor = Math.floor;
            var stringFromCharCode = String.fromCharCode;
            function error$1(type) {
                throw new RangeError(errors[type]);
            }
            function map(array, fn) {
                var result = [];
                var length = array.length;
                while (length--) {
                    result[length] = fn(array[length]);
                }
                return result;
            }
            function mapDomain(string, fn) {
                var parts = string.split("@");
                var result = "";
                if (parts.length > 1) {
                    result = parts[0] + "@";
                    string = parts[1];
                }
                string = string.replace(regexSeparators, ".");
                var labels = string.split(".");
                var encoded = map(labels, fn).join(".");
                return result + encoded;
            }
            function ucs2decode(string) {
                var output = [];
                var counter = 0;
                var length = string.length;
                while (counter < length) {
                    var value = string.charCodeAt(counter++);
                    if (value >= 55296 && value <= 56319 && counter < length) {
                        var extra = string.charCodeAt(counter++);
                        if ((extra & 64512) == 56320) {
                            output.push(((value & 1023) << 10) + (extra & 1023) + 65536);
                        } else {
                            output.push(value);
                            counter--;
                        }
                    } else {
                        output.push(value);
                    }
                }
                return output;
            }
            var ucs2encode = function ucs2encode(array) {
                return String.fromCodePoint.apply(String, toConsumableArray(array));
            };
            var basicToDigit = function basicToDigit(codePoint) {
                if (codePoint - 48 < 10) {
                    return codePoint - 22;
                }
                if (codePoint - 65 < 26) {
                    return codePoint - 65;
                }
                if (codePoint - 97 < 26) {
                    return codePoint - 97;
                }
                return base;
            };
            var digitToBasic = function digitToBasic(digit, flag) {
                return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
            };
            var adapt = function adapt(delta, numPoints, firstTime) {
                var k = 0;
                delta = firstTime ? floor(delta / damp) : delta >> 1;
                delta += floor(delta / numPoints);
                for (;delta > baseMinusTMin * tMax >> 1; k += base) {
                    delta = floor(delta / baseMinusTMin);
                }
                return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
            };
            var decode = function decode(input) {
                var output = [];
                var inputLength = input.length;
                var i = 0;
                var n = initialN;
                var bias = initialBias;
                var basic = input.lastIndexOf(delimiter);
                if (basic < 0) {
                    basic = 0;
                }
                for (var j = 0; j < basic; ++j) {
                    if (input.charCodeAt(j) >= 128) {
                        error$1("not-basic");
                    }
                    output.push(input.charCodeAt(j));
                }
                for (var index = basic > 0 ? basic + 1 : 0; index < inputLength; ) {
                    var oldi = i;
                    for (var w = 1, k = base; ;k += base) {
                        if (index >= inputLength) {
                            error$1("invalid-input");
                        }
                        var digit = basicToDigit(input.charCodeAt(index++));
                        if (digit >= base || digit > floor((maxInt - i) / w)) {
                            error$1("overflow");
                        }
                        i += digit * w;
                        var t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
                        if (digit < t) {
                            break;
                        }
                        var baseMinusT = base - t;
                        if (w > floor(maxInt / baseMinusT)) {
                            error$1("overflow");
                        }
                        w *= baseMinusT;
                    }
                    var out = output.length + 1;
                    bias = adapt(i - oldi, out, oldi == 0);
                    if (floor(i / out) > maxInt - n) {
                        error$1("overflow");
                    }
                    n += floor(i / out);
                    i %= out;
                    output.splice(i++, 0, n);
                }
                return String.fromCodePoint.apply(String, output);
            };
            var encode = function encode(input) {
                var output = [];
                input = ucs2decode(input);
                var inputLength = input.length;
                var n = initialN;
                var delta = 0;
                var bias = initialBias;
                var _iteratorNormalCompletion = true;
                var _didIteratorError = false;
                var _iteratorError = undefined;
                try {
                    for (var _iterator = input[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                        var _currentValue2 = _step.value;
                        if (_currentValue2 < 128) {
                            output.push(stringFromCharCode(_currentValue2));
                        }
                    }
                } catch (err) {
                    _didIteratorError = true;
                    _iteratorError = err;
                } finally {
                    try {
                        if (!_iteratorNormalCompletion && _iterator.return) {
                            _iterator.return();
                        }
                    } finally {
                        if (_didIteratorError) {
                            throw _iteratorError;
                        }
                    }
                }
                var basicLength = output.length;
                var handledCPCount = basicLength;
                if (basicLength) {
                    output.push(delimiter);
                }
                while (handledCPCount < inputLength) {
                    var m = maxInt;
                    var _iteratorNormalCompletion2 = true;
                    var _didIteratorError2 = false;
                    var _iteratorError2 = undefined;
                    try {
                        for (var _iterator2 = input[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                            var currentValue = _step2.value;
                            if (currentValue >= n && currentValue < m) {
                                m = currentValue;
                            }
                        }
                    } catch (err) {
                        _didIteratorError2 = true;
                        _iteratorError2 = err;
                    } finally {
                        try {
                            if (!_iteratorNormalCompletion2 && _iterator2.return) {
                                _iterator2.return();
                            }
                        } finally {
                            if (_didIteratorError2) {
                                throw _iteratorError2;
                            }
                        }
                    }
                    var handledCPCountPlusOne = handledCPCount + 1;
                    if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
                        error$1("overflow");
                    }
                    delta += (m - n) * handledCPCountPlusOne;
                    n = m;
                    var _iteratorNormalCompletion3 = true;
                    var _didIteratorError3 = false;
                    var _iteratorError3 = undefined;
                    try {
                        for (var _iterator3 = input[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                            var _currentValue = _step3.value;
                            if (_currentValue < n && ++delta > maxInt) {
                                error$1("overflow");
                            }
                            if (_currentValue == n) {
                                var q = delta;
                                for (var k = base; ;k += base) {
                                    var t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
                                    if (q < t) {
                                        break;
                                    }
                                    var qMinusT = q - t;
                                    var baseMinusT = base - t;
                                    output.push(stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0)));
                                    q = floor(qMinusT / baseMinusT);
                                }
                                output.push(stringFromCharCode(digitToBasic(q, 0)));
                                bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
                                delta = 0;
                                ++handledCPCount;
                            }
                        }
                    } catch (err) {
                        _didIteratorError3 = true;
                        _iteratorError3 = err;
                    } finally {
                        try {
                            if (!_iteratorNormalCompletion3 && _iterator3.return) {
                                _iterator3.return();
                            }
                        } finally {
                            if (_didIteratorError3) {
                                throw _iteratorError3;
                            }
                        }
                    }
                    ++delta;
                    ++n;
                }
                return output.join("");
            };
            var toUnicode = function toUnicode(input) {
                return mapDomain(input, function(string) {
                    return regexPunycode.test(string) ? decode(string.slice(4).toLowerCase()) : string;
                });
            };
            var toASCII = function toASCII(input) {
                return mapDomain(input, function(string) {
                    return regexNonASCII.test(string) ? "xn--" + encode(string) : string;
                });
            };
            var punycode = {
                version: "2.1.0",
                ucs2: {
                    decode: ucs2decode,
                    encode: ucs2encode
                },
                decode,
                encode,
                toASCII,
                toUnicode
            };
            var SCHEMES = {};
            function pctEncChar(chr) {
                var c = chr.charCodeAt(0);
                var e = void 0;
                if (c < 16) e = "%0" + c.toString(16).toUpperCase(); else if (c < 128) e = "%" + c.toString(16).toUpperCase(); else if (c < 2048) e = "%" + (c >> 6 | 192).toString(16).toUpperCase() + "%" + (c & 63 | 128).toString(16).toUpperCase(); else e = "%" + (c >> 12 | 224).toString(16).toUpperCase() + "%" + (c >> 6 & 63 | 128).toString(16).toUpperCase() + "%" + (c & 63 | 128).toString(16).toUpperCase();
                return e;
            }
            function pctDecChars(str) {
                var newStr = "";
                var i = 0;
                var il = str.length;
                while (i < il) {
                    var c = parseInt(str.substr(i + 1, 2), 16);
                    if (c < 128) {
                        newStr += String.fromCharCode(c);
                        i += 3;
                    } else if (c >= 194 && c < 224) {
                        if (il - i >= 6) {
                            var c2 = parseInt(str.substr(i + 4, 2), 16);
                            newStr += String.fromCharCode((c & 31) << 6 | c2 & 63);
                        } else {
                            newStr += str.substr(i, 6);
                        }
                        i += 6;
                    } else if (c >= 224) {
                        if (il - i >= 9) {
                            var _c = parseInt(str.substr(i + 4, 2), 16);
                            var c3 = parseInt(str.substr(i + 7, 2), 16);
                            newStr += String.fromCharCode((c & 15) << 12 | (_c & 63) << 6 | c3 & 63);
                        } else {
                            newStr += str.substr(i, 9);
                        }
                        i += 9;
                    } else {
                        newStr += str.substr(i, 3);
                        i += 3;
                    }
                }
                return newStr;
            }
            function _normalizeComponentEncoding(components, protocol) {
                function decodeUnreserved(str) {
                    var decStr = pctDecChars(str);
                    return !decStr.match(protocol.UNRESERVED) ? str : decStr;
                }
                if (components.scheme) components.scheme = String(components.scheme).replace(protocol.PCT_ENCODED, decodeUnreserved).toLowerCase().replace(protocol.NOT_SCHEME, "");
                if (components.userinfo !== undefined) components.userinfo = String(components.userinfo).replace(protocol.PCT_ENCODED, decodeUnreserved).replace(protocol.NOT_USERINFO, pctEncChar).replace(protocol.PCT_ENCODED, toUpperCase);
                if (components.host !== undefined) components.host = String(components.host).replace(protocol.PCT_ENCODED, decodeUnreserved).toLowerCase().replace(protocol.NOT_HOST, pctEncChar).replace(protocol.PCT_ENCODED, toUpperCase);
                if (components.path !== undefined) components.path = String(components.path).replace(protocol.PCT_ENCODED, decodeUnreserved).replace(components.scheme ? protocol.NOT_PATH : protocol.NOT_PATH_NOSCHEME, pctEncChar).replace(protocol.PCT_ENCODED, toUpperCase);
                if (components.query !== undefined) components.query = String(components.query).replace(protocol.PCT_ENCODED, decodeUnreserved).replace(protocol.NOT_QUERY, pctEncChar).replace(protocol.PCT_ENCODED, toUpperCase);
                if (components.fragment !== undefined) components.fragment = String(components.fragment).replace(protocol.PCT_ENCODED, decodeUnreserved).replace(protocol.NOT_FRAGMENT, pctEncChar).replace(protocol.PCT_ENCODED, toUpperCase);
                return components;
            }
            function _stripLeadingZeros(str) {
                return str.replace(/^0*(.*)/, "$1") || "0";
            }
            function _normalizeIPv4(host, protocol) {
                var matches = host.match(protocol.IPV4ADDRESS) || [];
                var _matches = slicedToArray(matches, 2), address = _matches[1];
                if (address) {
                    return address.split(".").map(_stripLeadingZeros).join(".");
                } else {
                    return host;
                }
            }
            function _normalizeIPv6(host, protocol) {
                var matches = host.match(protocol.IPV6ADDRESS) || [];
                var _matches2 = slicedToArray(matches, 3), address = _matches2[1], zone = _matches2[2];
                if (address) {
                    var _address$toLowerCase$ = address.toLowerCase().split("::").reverse(), _address$toLowerCase$2 = slicedToArray(_address$toLowerCase$, 2), last = _address$toLowerCase$2[0], first = _address$toLowerCase$2[1];
                    var firstFields = first ? first.split(":").map(_stripLeadingZeros) : [];
                    var lastFields = last.split(":").map(_stripLeadingZeros);
                    var isLastFieldIPv4Address = protocol.IPV4ADDRESS.test(lastFields[lastFields.length - 1]);
                    var fieldCount = isLastFieldIPv4Address ? 7 : 8;
                    var lastFieldsStart = lastFields.length - fieldCount;
                    var fields = Array(fieldCount);
                    for (var x = 0; x < fieldCount; ++x) {
                        fields[x] = firstFields[x] || lastFields[lastFieldsStart + x] || "";
                    }
                    if (isLastFieldIPv4Address) {
                        fields[fieldCount - 1] = _normalizeIPv4(fields[fieldCount - 1], protocol);
                    }
                    var allZeroFields = fields.reduce(function(acc, field, index) {
                        if (!field || field === "0") {
                            var lastLongest = acc[acc.length - 1];
                            if (lastLongest && lastLongest.index + lastLongest.length === index) {
                                lastLongest.length++;
                            } else {
                                acc.push({
                                    index,
                                    length: 1
                                });
                            }
                        }
                        return acc;
                    }, []);
                    var longestZeroFields = allZeroFields.sort(function(a, b) {
                        return b.length - a.length;
                    })[0];
                    var newHost = void 0;
                    if (longestZeroFields && longestZeroFields.length > 1) {
                        var newFirst = fields.slice(0, longestZeroFields.index);
                        var newLast = fields.slice(longestZeroFields.index + longestZeroFields.length);
                        newHost = newFirst.join(":") + "::" + newLast.join(":");
                    } else {
                        newHost = fields.join(":");
                    }
                    if (zone) {
                        newHost += "%" + zone;
                    }
                    return newHost;
                } else {
                    return host;
                }
            }
            var URI_PARSE = /^(?:([^:\/?#]+):)?(?:\/\/((?:([^\/?#@]*)@)?(\[[^\/?#\]]+\]|[^\/?#:]*)(?:\:(\d*))?))?([^?#]*)(?:\?([^#]*))?(?:#((?:.|\n|\r)*))?/i;
            var NO_MATCH_IS_UNDEFINED = "".match(/(){0}/)[1] === undefined;
            function parse(uriString) {
                var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
                var components = {};
                var protocol = options.iri !== false ? IRI_PROTOCOL : URI_PROTOCOL;
                if (options.reference === "suffix") uriString = (options.scheme ? options.scheme + ":" : "") + "//" + uriString;
                var matches = uriString.match(URI_PARSE);
                if (matches) {
                    if (NO_MATCH_IS_UNDEFINED) {
                        components.scheme = matches[1];
                        components.userinfo = matches[3];
                        components.host = matches[4];
                        components.port = parseInt(matches[5], 10);
                        components.path = matches[6] || "";
                        components.query = matches[7];
                        components.fragment = matches[8];
                        if (isNaN(components.port)) {
                            components.port = matches[5];
                        }
                    } else {
                        components.scheme = matches[1] || undefined;
                        components.userinfo = uriString.indexOf("@") !== -1 ? matches[3] : undefined;
                        components.host = uriString.indexOf("//") !== -1 ? matches[4] : undefined;
                        components.port = parseInt(matches[5], 10);
                        components.path = matches[6] || "";
                        components.query = uriString.indexOf("?") !== -1 ? matches[7] : undefined;
                        components.fragment = uriString.indexOf("#") !== -1 ? matches[8] : undefined;
                        if (isNaN(components.port)) {
                            components.port = uriString.match(/\/\/(?:.|\n)*\:(?:\/|\?|\#|$)/) ? matches[4] : undefined;
                        }
                    }
                    if (components.host) {
                        components.host = _normalizeIPv6(_normalizeIPv4(components.host, protocol), protocol);
                    }
                    if (components.scheme === undefined && components.userinfo === undefined && components.host === undefined && components.port === undefined && !components.path && components.query === undefined) {
                        components.reference = "same-document";
                    } else if (components.scheme === undefined) {
                        components.reference = "relative";
                    } else if (components.fragment === undefined) {
                        components.reference = "absolute";
                    } else {
                        components.reference = "uri";
                    }
                    if (options.reference && options.reference !== "suffix" && options.reference !== components.reference) {
                        components.error = components.error || "URI is not a " + options.reference + " reference.";
                    }
                    var schemeHandler = SCHEMES[(options.scheme || components.scheme || "").toLowerCase()];
                    if (!options.unicodeSupport && (!schemeHandler || !schemeHandler.unicodeSupport)) {
                        if (components.host && (options.domainHost || schemeHandler && schemeHandler.domainHost)) {
                            try {
                                components.host = punycode.toASCII(components.host.replace(protocol.PCT_ENCODED, pctDecChars).toLowerCase());
                            } catch (e) {
                                components.error = components.error || "Host's domain name can not be converted to ASCII via punycode: " + e;
                            }
                        }
                        _normalizeComponentEncoding(components, URI_PROTOCOL);
                    } else {
                        _normalizeComponentEncoding(components, protocol);
                    }
                    if (schemeHandler && schemeHandler.parse) {
                        schemeHandler.parse(components, options);
                    }
                } else {
                    components.error = components.error || "URI can not be parsed.";
                }
                return components;
            }
            function _recomposeAuthority(components, options) {
                var protocol = options.iri !== false ? IRI_PROTOCOL : URI_PROTOCOL;
                var uriTokens = [];
                if (components.userinfo !== undefined) {
                    uriTokens.push(components.userinfo);
                    uriTokens.push("@");
                }
                if (components.host !== undefined) {
                    uriTokens.push(_normalizeIPv6(_normalizeIPv4(String(components.host), protocol), protocol).replace(protocol.IPV6ADDRESS, function(_, $1, $2) {
                        return "[" + $1 + ($2 ? "%25" + $2 : "") + "]";
                    }));
                }
                if (typeof components.port === "number" || typeof components.port === "string") {
                    uriTokens.push(":");
                    uriTokens.push(String(components.port));
                }
                return uriTokens.length ? uriTokens.join("") : undefined;
            }
            var RDS1 = /^\.\.?\//;
            var RDS2 = /^\/\.(\/|$)/;
            var RDS3 = /^\/\.\.(\/|$)/;
            var RDS5 = /^\/?(?:.|\n)*?(?=\/|$)/;
            function removeDotSegments(input) {
                var output = [];
                while (input.length) {
                    if (input.match(RDS1)) {
                        input = input.replace(RDS1, "");
                    } else if (input.match(RDS2)) {
                        input = input.replace(RDS2, "/");
                    } else if (input.match(RDS3)) {
                        input = input.replace(RDS3, "/");
                        output.pop();
                    } else if (input === "." || input === "..") {
                        input = "";
                    } else {
                        var im = input.match(RDS5);
                        if (im) {
                            var s = im[0];
                            input = input.slice(s.length);
                            output.push(s);
                        } else {
                            throw new Error("Unexpected dot segment condition");
                        }
                    }
                }
                return output.join("");
            }
            function serialize(components) {
                var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
                var protocol = options.iri ? IRI_PROTOCOL : URI_PROTOCOL;
                var uriTokens = [];
                var schemeHandler = SCHEMES[(options.scheme || components.scheme || "").toLowerCase()];
                if (schemeHandler && schemeHandler.serialize) schemeHandler.serialize(components, options);
                if (components.host) {
                    if (protocol.IPV6ADDRESS.test(components.host)) ; else if (options.domainHost || schemeHandler && schemeHandler.domainHost) {
                        try {
                            components.host = !options.iri ? punycode.toASCII(components.host.replace(protocol.PCT_ENCODED, pctDecChars).toLowerCase()) : punycode.toUnicode(components.host);
                        } catch (e) {
                            components.error = components.error || "Host's domain name can not be converted to " + (!options.iri ? "ASCII" : "Unicode") + " via punycode: " + e;
                        }
                    }
                }
                _normalizeComponentEncoding(components, protocol);
                if (options.reference !== "suffix" && components.scheme) {
                    uriTokens.push(components.scheme);
                    uriTokens.push(":");
                }
                var authority = _recomposeAuthority(components, options);
                if (authority !== undefined) {
                    if (options.reference !== "suffix") {
                        uriTokens.push("//");
                    }
                    uriTokens.push(authority);
                    if (components.path && components.path.charAt(0) !== "/") {
                        uriTokens.push("/");
                    }
                }
                if (components.path !== undefined) {
                    var s = components.path;
                    if (!options.absolutePath && (!schemeHandler || !schemeHandler.absolutePath)) {
                        s = removeDotSegments(s);
                    }
                    if (authority === undefined) {
                        s = s.replace(/^\/\//, "/%2F");
                    }
                    uriTokens.push(s);
                }
                if (components.query !== undefined) {
                    uriTokens.push("?");
                    uriTokens.push(components.query);
                }
                if (components.fragment !== undefined) {
                    uriTokens.push("#");
                    uriTokens.push(components.fragment);
                }
                return uriTokens.join("");
            }
            function resolveComponents(base, relative) {
                var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
                var skipNormalization = arguments[3];
                var target = {};
                if (!skipNormalization) {
                    base = parse(serialize(base, options), options);
                    relative = parse(serialize(relative, options), options);
                }
                options = options || {};
                if (!options.tolerant && relative.scheme) {
                    target.scheme = relative.scheme;
                    target.userinfo = relative.userinfo;
                    target.host = relative.host;
                    target.port = relative.port;
                    target.path = removeDotSegments(relative.path || "");
                    target.query = relative.query;
                } else {
                    if (relative.userinfo !== undefined || relative.host !== undefined || relative.port !== undefined) {
                        target.userinfo = relative.userinfo;
                        target.host = relative.host;
                        target.port = relative.port;
                        target.path = removeDotSegments(relative.path || "");
                        target.query = relative.query;
                    } else {
                        if (!relative.path) {
                            target.path = base.path;
                            if (relative.query !== undefined) {
                                target.query = relative.query;
                            } else {
                                target.query = base.query;
                            }
                        } else {
                            if (relative.path.charAt(0) === "/") {
                                target.path = removeDotSegments(relative.path);
                            } else {
                                if ((base.userinfo !== undefined || base.host !== undefined || base.port !== undefined) && !base.path) {
                                    target.path = "/" + relative.path;
                                } else if (!base.path) {
                                    target.path = relative.path;
                                } else {
                                    target.path = base.path.slice(0, base.path.lastIndexOf("/") + 1) + relative.path;
                                }
                                target.path = removeDotSegments(target.path);
                            }
                            target.query = relative.query;
                        }
                        target.userinfo = base.userinfo;
                        target.host = base.host;
                        target.port = base.port;
                    }
                    target.scheme = base.scheme;
                }
                target.fragment = relative.fragment;
                return target;
            }
            function resolve(baseURI, relativeURI, options) {
                var schemelessOptions = assign({
                    scheme: "null"
                }, options);
                return serialize(resolveComponents(parse(baseURI, schemelessOptions), parse(relativeURI, schemelessOptions), schemelessOptions, true), schemelessOptions);
            }
            function normalize(uri, options) {
                if (typeof uri === "string") {
                    uri = serialize(parse(uri, options), options);
                } else if (typeOf(uri) === "object") {
                    uri = parse(serialize(uri, options), options);
                }
                return uri;
            }
            function equal(uriA, uriB, options) {
                if (typeof uriA === "string") {
                    uriA = serialize(parse(uriA, options), options);
                } else if (typeOf(uriA) === "object") {
                    uriA = serialize(uriA, options);
                }
                if (typeof uriB === "string") {
                    uriB = serialize(parse(uriB, options), options);
                } else if (typeOf(uriB) === "object") {
                    uriB = serialize(uriB, options);
                }
                return uriA === uriB;
            }
            function escapeComponent(str, options) {
                return str && str.toString().replace(!options || !options.iri ? URI_PROTOCOL.ESCAPE : IRI_PROTOCOL.ESCAPE, pctEncChar);
            }
            function unescapeComponent(str, options) {
                return str && str.toString().replace(!options || !options.iri ? URI_PROTOCOL.PCT_ENCODED : IRI_PROTOCOL.PCT_ENCODED, pctDecChars);
            }
            var handler = {
                scheme: "http",
                domainHost: true,
                parse: function parse(components, options) {
                    if (!components.host) {
                        components.error = components.error || "HTTP URIs must have a host.";
                    }
                    return components;
                },
                serialize: function serialize(components, options) {
                    var secure = String(components.scheme).toLowerCase() === "https";
                    if (components.port === (secure ? 443 : 80) || components.port === "") {
                        components.port = undefined;
                    }
                    if (!components.path) {
                        components.path = "/";
                    }
                    return components;
                }
            };
            var handler$1 = {
                scheme: "https",
                domainHost: handler.domainHost,
                parse: handler.parse,
                serialize: handler.serialize
            };
            function isSecure(wsComponents) {
                return typeof wsComponents.secure === "boolean" ? wsComponents.secure : String(wsComponents.scheme).toLowerCase() === "wss";
            }
            var handler$2 = {
                scheme: "ws",
                domainHost: true,
                parse: function parse(components, options) {
                    var wsComponents = components;
                    wsComponents.secure = isSecure(wsComponents);
                    wsComponents.resourceName = (wsComponents.path || "/") + (wsComponents.query ? "?" + wsComponents.query : "");
                    wsComponents.path = undefined;
                    wsComponents.query = undefined;
                    return wsComponents;
                },
                serialize: function serialize(wsComponents, options) {
                    if (wsComponents.port === (isSecure(wsComponents) ? 443 : 80) || wsComponents.port === "") {
                        wsComponents.port = undefined;
                    }
                    if (typeof wsComponents.secure === "boolean") {
                        wsComponents.scheme = wsComponents.secure ? "wss" : "ws";
                        wsComponents.secure = undefined;
                    }
                    if (wsComponents.resourceName) {
                        var _wsComponents$resourc = wsComponents.resourceName.split("?"), _wsComponents$resourc2 = slicedToArray(_wsComponents$resourc, 2), path = _wsComponents$resourc2[0], query = _wsComponents$resourc2[1];
                        wsComponents.path = path && path !== "/" ? path : undefined;
                        wsComponents.query = query;
                        wsComponents.resourceName = undefined;
                    }
                    wsComponents.fragment = undefined;
                    return wsComponents;
                }
            };
            var handler$3 = {
                scheme: "wss",
                domainHost: handler$2.domainHost,
                parse: handler$2.parse,
                serialize: handler$2.serialize
            };
            var O = {};
            var UNRESERVED$$ = "[A-Za-z0-9\\-\\.\\_\\~" + "\\xA0-\\u200D\\u2010-\\u2029\\u202F-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFEF" + "]";
            var HEXDIG$$ = "[0-9A-Fa-f]";
            var PCT_ENCODED$ = subexp(subexp("%[EFef]" + HEXDIG$$ + "%" + HEXDIG$$ + HEXDIG$$ + "%" + HEXDIG$$ + HEXDIG$$) + "|" + subexp("%[89A-Fa-f]" + HEXDIG$$ + "%" + HEXDIG$$ + HEXDIG$$) + "|" + subexp("%" + HEXDIG$$ + HEXDIG$$));
            var ATEXT$$ = "[A-Za-z0-9\\!\\$\\%\\'\\*\\+\\-\\^\\_\\`\\{\\|\\}\\~]";
            var QTEXT$$ = "[\\!\\$\\%\\'\\(\\)\\*\\+\\,\\-\\.0-9\\<\\>A-Z\\x5E-\\x7E]";
            var VCHAR$$ = merge(QTEXT$$, '[\\"\\\\]');
            var SOME_DELIMS$$ = "[\\!\\$\\'\\(\\)\\*\\+\\,\\;\\:\\@]";
            var UNRESERVED = new RegExp(UNRESERVED$$, "g");
            var PCT_ENCODED = new RegExp(PCT_ENCODED$, "g");
            var NOT_LOCAL_PART = new RegExp(merge("[^]", ATEXT$$, "[\\.]", '[\\"]', VCHAR$$), "g");
            var NOT_HFNAME = new RegExp(merge("[^]", UNRESERVED$$, SOME_DELIMS$$), "g");
            var NOT_HFVALUE = NOT_HFNAME;
            function decodeUnreserved(str) {
                var decStr = pctDecChars(str);
                return !decStr.match(UNRESERVED) ? str : decStr;
            }
            var handler$4 = {
                scheme: "mailto",
                parse: function parse$$1(components, options) {
                    var mailtoComponents = components;
                    var to = mailtoComponents.to = mailtoComponents.path ? mailtoComponents.path.split(",") : [];
                    mailtoComponents.path = undefined;
                    if (mailtoComponents.query) {
                        var unknownHeaders = false;
                        var headers = {};
                        var hfields = mailtoComponents.query.split("&");
                        for (var x = 0, xl = hfields.length; x < xl; ++x) {
                            var hfield = hfields[x].split("=");
                            switch (hfield[0]) {
                              case "to":
                                var toAddrs = hfield[1].split(",");
                                for (var _x = 0, _xl = toAddrs.length; _x < _xl; ++_x) {
                                    to.push(toAddrs[_x]);
                                }
                                break;

                              case "subject":
                                mailtoComponents.subject = unescapeComponent(hfield[1], options);
                                break;

                              case "body":
                                mailtoComponents.body = unescapeComponent(hfield[1], options);
                                break;

                              default:
                                unknownHeaders = true;
                                headers[unescapeComponent(hfield[0], options)] = unescapeComponent(hfield[1], options);
                                break;
                            }
                        }
                        if (unknownHeaders) mailtoComponents.headers = headers;
                    }
                    mailtoComponents.query = undefined;
                    for (var _x2 = 0, _xl2 = to.length; _x2 < _xl2; ++_x2) {
                        var addr = to[_x2].split("@");
                        addr[0] = unescapeComponent(addr[0]);
                        if (!options.unicodeSupport) {
                            try {
                                addr[1] = punycode.toASCII(unescapeComponent(addr[1], options).toLowerCase());
                            } catch (e) {
                                mailtoComponents.error = mailtoComponents.error || "Email address's domain name can not be converted to ASCII via punycode: " + e;
                            }
                        } else {
                            addr[1] = unescapeComponent(addr[1], options).toLowerCase();
                        }
                        to[_x2] = addr.join("@");
                    }
                    return mailtoComponents;
                },
                serialize: function serialize$$1(mailtoComponents, options) {
                    var components = mailtoComponents;
                    var to = toArray(mailtoComponents.to);
                    if (to) {
                        for (var x = 0, xl = to.length; x < xl; ++x) {
                            var toAddr = String(to[x]);
                            var atIdx = toAddr.lastIndexOf("@");
                            var localPart = toAddr.slice(0, atIdx).replace(PCT_ENCODED, decodeUnreserved).replace(PCT_ENCODED, toUpperCase).replace(NOT_LOCAL_PART, pctEncChar);
                            var domain = toAddr.slice(atIdx + 1);
                            try {
                                domain = !options.iri ? punycode.toASCII(unescapeComponent(domain, options).toLowerCase()) : punycode.toUnicode(domain);
                            } catch (e) {
                                components.error = components.error || "Email address's domain name can not be converted to " + (!options.iri ? "ASCII" : "Unicode") + " via punycode: " + e;
                            }
                            to[x] = localPart + "@" + domain;
                        }
                        components.path = to.join(",");
                    }
                    var headers = mailtoComponents.headers = mailtoComponents.headers || {};
                    if (mailtoComponents.subject) headers["subject"] = mailtoComponents.subject;
                    if (mailtoComponents.body) headers["body"] = mailtoComponents.body;
                    var fields = [];
                    for (var name in headers) {
                        if (headers[name] !== O[name]) {
                            fields.push(name.replace(PCT_ENCODED, decodeUnreserved).replace(PCT_ENCODED, toUpperCase).replace(NOT_HFNAME, pctEncChar) + "=" + headers[name].replace(PCT_ENCODED, decodeUnreserved).replace(PCT_ENCODED, toUpperCase).replace(NOT_HFVALUE, pctEncChar));
                        }
                    }
                    if (fields.length) {
                        components.query = fields.join("&");
                    }
                    return components;
                }
            };
            var URN_PARSE = /^([^\:]+)\:(.*)/;
            var handler$5 = {
                scheme: "urn",
                parse: function parse$$1(components, options) {
                    var matches = components.path && components.path.match(URN_PARSE);
                    var urnComponents = components;
                    if (matches) {
                        var scheme = options.scheme || urnComponents.scheme || "urn";
                        var nid = matches[1].toLowerCase();
                        var nss = matches[2];
                        var urnScheme = scheme + ":" + (options.nid || nid);
                        var schemeHandler = SCHEMES[urnScheme];
                        urnComponents.nid = nid;
                        urnComponents.nss = nss;
                        urnComponents.path = undefined;
                        if (schemeHandler) {
                            urnComponents = schemeHandler.parse(urnComponents, options);
                        }
                    } else {
                        urnComponents.error = urnComponents.error || "URN can not be parsed.";
                    }
                    return urnComponents;
                },
                serialize: function serialize$$1(urnComponents, options) {
                    var scheme = options.scheme || urnComponents.scheme || "urn";
                    var nid = urnComponents.nid;
                    var urnScheme = scheme + ":" + (options.nid || nid);
                    var schemeHandler = SCHEMES[urnScheme];
                    if (schemeHandler) {
                        urnComponents = schemeHandler.serialize(urnComponents, options);
                    }
                    var uriComponents = urnComponents;
                    var nss = urnComponents.nss;
                    uriComponents.path = (nid || options.nid) + ":" + nss;
                    return uriComponents;
                }
            };
            var UUID = /^[0-9A-Fa-f]{8}(?:\-[0-9A-Fa-f]{4}){3}\-[0-9A-Fa-f]{12}$/;
            var handler$6 = {
                scheme: "urn:uuid",
                parse: function parse(urnComponents, options) {
                    var uuidComponents = urnComponents;
                    uuidComponents.uuid = uuidComponents.nss;
                    uuidComponents.nss = undefined;
                    if (!options.tolerant && (!uuidComponents.uuid || !uuidComponents.uuid.match(UUID))) {
                        uuidComponents.error = uuidComponents.error || "UUID is not valid.";
                    }
                    return uuidComponents;
                },
                serialize: function serialize(uuidComponents, options) {
                    var urnComponents = uuidComponents;
                    urnComponents.nss = (uuidComponents.uuid || "").toLowerCase();
                    return urnComponents;
                }
            };
            SCHEMES[handler.scheme] = handler;
            SCHEMES[handler$1.scheme] = handler$1;
            SCHEMES[handler$2.scheme] = handler$2;
            SCHEMES[handler$3.scheme] = handler$3;
            SCHEMES[handler$4.scheme] = handler$4;
            SCHEMES[handler$5.scheme] = handler$5;
            SCHEMES[handler$6.scheme] = handler$6;
            exports.SCHEMES = SCHEMES;
            exports.pctEncChar = pctEncChar;
            exports.pctDecChars = pctDecChars;
            exports.parse = parse;
            exports.removeDotSegments = removeDotSegments;
            exports.serialize = serialize;
            exports.resolveComponents = resolveComponents;
            exports.resolve = resolve;
            exports.normalize = normalize;
            exports.equal = equal;
            exports.escapeComponent = escapeComponent;
            exports.unescapeComponent = unescapeComponent;
            Object.defineProperty(exports, "__esModule", {
                value: true
            });
        });
    })(uri_all$1, uri_all$1.exports);
    return uri_all$1.exports;
}

var fastDeepEqual;

var hasRequiredFastDeepEqual;

function requireFastDeepEqual() {
    if (hasRequiredFastDeepEqual) return fastDeepEqual;
    hasRequiredFastDeepEqual = 1;
    fastDeepEqual = function equal(a, b) {
        if (a === b) return true;
        if (a && b && typeof a == "object" && typeof b == "object") {
            if (a.constructor !== b.constructor) return false;
            var length, i, keys;
            if (Array.isArray(a)) {
                length = a.length;
                if (length != b.length) return false;
                for (i = length; i-- !== 0; ) if (!equal(a[i], b[i])) return false;
                return true;
            }
            if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
            if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
            if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
            keys = Object.keys(a);
            length = keys.length;
            if (length !== Object.keys(b).length) return false;
            for (i = length; i-- !== 0; ) if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
            for (i = length; i-- !== 0; ) {
                var key = keys[i];
                if (!equal(a[key], b[key])) return false;
            }
            return true;
        }
        return a !== a && b !== b;
    };
    return fastDeepEqual;
}

var ucs2length;

var hasRequiredUcs2length;

function requireUcs2length() {
    if (hasRequiredUcs2length) return ucs2length;
    hasRequiredUcs2length = 1;
    ucs2length = function ucs2length(str) {
        var length = 0, len = str.length, pos = 0, value;
        while (pos < len) {
            length++;
            value = str.charCodeAt(pos++);
            if (value >= 55296 && value <= 56319 && pos < len) {
                value = str.charCodeAt(pos);
                if ((value & 64512) == 56320) pos++;
            }
        }
        return length;
    };
    return ucs2length;
}

var util;

var hasRequiredUtil;

function requireUtil() {
    if (hasRequiredUtil) return util;
    hasRequiredUtil = 1;
    util = {
        copy,
        checkDataType,
        checkDataTypes,
        coerceToTypes,
        toHash,
        getProperty,
        escapeQuotes,
        equal: requireFastDeepEqual(),
        ucs2length: requireUcs2length(),
        varOccurences,
        varReplace,
        schemaHasRules,
        schemaHasRulesExcept,
        schemaUnknownRules,
        toQuotedString,
        getPathExpr,
        getPath,
        getData,
        unescapeFragment,
        unescapeJsonPointer,
        escapeFragment,
        escapeJsonPointer
    };
    function copy(o, to) {
        to = to || {};
        for (var key in o) to[key] = o[key];
        return to;
    }
    function checkDataType(dataType, data, strictNumbers, negate) {
        var EQUAL = negate ? " !== " : " === ", AND = negate ? " || " : " && ", OK = negate ? "!" : "", NOT = negate ? "" : "!";
        switch (dataType) {
          case "null":
            return data + EQUAL + "null";

          case "array":
            return OK + "Array.isArray(" + data + ")";

          case "object":
            return "(" + OK + data + AND + "typeof " + data + EQUAL + '"object"' + AND + NOT + "Array.isArray(" + data + "))";

          case "integer":
            return "(typeof " + data + EQUAL + '"number"' + AND + NOT + "(" + data + " % 1)" + AND + data + EQUAL + data + (strictNumbers ? AND + OK + "isFinite(" + data + ")" : "") + ")";

          case "number":
            return "(typeof " + data + EQUAL + '"' + dataType + '"' + (strictNumbers ? AND + OK + "isFinite(" + data + ")" : "") + ")";

          default:
            return "typeof " + data + EQUAL + '"' + dataType + '"';
        }
    }
    function checkDataTypes(dataTypes, data, strictNumbers) {
        switch (dataTypes.length) {
          case 1:
            return checkDataType(dataTypes[0], data, strictNumbers, true);

          default:
            var code = "";
            var types = toHash(dataTypes);
            if (types.array && types.object) {
                code = types.null ? "(" : "(!" + data + " || ";
                code += "typeof " + data + ' !== "object")';
                delete types.null;
                delete types.array;
                delete types.object;
            }
            if (types.number) delete types.integer;
            for (var t in types) code += (code ? " && " : "") + checkDataType(t, data, strictNumbers, true);
            return code;
        }
    }
    var COERCE_TO_TYPES = toHash([ "string", "number", "integer", "boolean", "null" ]);
    function coerceToTypes(optionCoerceTypes, dataTypes) {
        if (Array.isArray(dataTypes)) {
            var types = [];
            for (var i = 0; i < dataTypes.length; i++) {
                var t = dataTypes[i];
                if (COERCE_TO_TYPES[t]) types[types.length] = t; else if (optionCoerceTypes === "array" && t === "array") types[types.length] = t;
            }
            if (types.length) return types;
        } else if (COERCE_TO_TYPES[dataTypes]) {
            return [ dataTypes ];
        } else if (optionCoerceTypes === "array" && dataTypes === "array") {
            return [ "array" ];
        }
    }
    function toHash(arr) {
        var hash = {};
        for (var i = 0; i < arr.length; i++) hash[arr[i]] = true;
        return hash;
    }
    var IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i;
    var SINGLE_QUOTE = /'|\\/g;
    function getProperty(key) {
        return typeof key == "number" ? "[" + key + "]" : IDENTIFIER.test(key) ? "." + key : "['" + escapeQuotes(key) + "']";
    }
    function escapeQuotes(str) {
        return str.replace(SINGLE_QUOTE, "\\$&").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\f/g, "\\f").replace(/\t/g, "\\t");
    }
    function varOccurences(str, dataVar) {
        dataVar += "[^0-9]";
        var matches = str.match(new RegExp(dataVar, "g"));
        return matches ? matches.length : 0;
    }
    function varReplace(str, dataVar, expr) {
        dataVar += "([^0-9])";
        expr = expr.replace(/\$/g, "$$$$");
        return str.replace(new RegExp(dataVar, "g"), expr + "$1");
    }
    function schemaHasRules(schema, rules) {
        if (typeof schema == "boolean") return !schema;
        for (var key in schema) if (rules[key]) return true;
    }
    function schemaHasRulesExcept(schema, rules, exceptKeyword) {
        if (typeof schema == "boolean") return !schema && exceptKeyword != "not";
        for (var key in schema) if (key != exceptKeyword && rules[key]) return true;
    }
    function schemaUnknownRules(schema, rules) {
        if (typeof schema == "boolean") return;
        for (var key in schema) if (!rules[key]) return key;
    }
    function toQuotedString(str) {
        return "'" + escapeQuotes(str) + "'";
    }
    function getPathExpr(currentPath, expr, jsonPointers, isNumber) {
        var path = jsonPointers ? "'/' + " + expr + (isNumber ? "" : ".replace(/~/g, '~0').replace(/\\//g, '~1')") : isNumber ? "'[' + " + expr + " + ']'" : "'[\\'' + " + expr + " + '\\']'";
        return joinPaths(currentPath, path);
    }
    function getPath(currentPath, prop, jsonPointers) {
        var path = jsonPointers ? toQuotedString("/" + escapeJsonPointer(prop)) : toQuotedString(getProperty(prop));
        return joinPaths(currentPath, path);
    }
    var JSON_POINTER = /^\/(?:[^~]|~0|~1)*$/;
    var RELATIVE_JSON_POINTER = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
    function getData($data, lvl, paths) {
        var up, jsonPointer, data, matches;
        if ($data === "") return "rootData";
        if ($data[0] == "/") {
            if (!JSON_POINTER.test($data)) throw new Error("Invalid JSON-pointer: " + $data);
            jsonPointer = $data;
            data = "rootData";
        } else {
            matches = $data.match(RELATIVE_JSON_POINTER);
            if (!matches) throw new Error("Invalid JSON-pointer: " + $data);
            up = +matches[1];
            jsonPointer = matches[2];
            if (jsonPointer == "#") {
                if (up >= lvl) throw new Error("Cannot access property/index " + up + " levels up, current level is " + lvl);
                return paths[lvl - up];
            }
            if (up > lvl) throw new Error("Cannot access data " + up + " levels up, current level is " + lvl);
            data = "data" + (lvl - up || "");
            if (!jsonPointer) return data;
        }
        var expr = data;
        var segments = jsonPointer.split("/");
        for (var i = 0; i < segments.length; i++) {
            var segment = segments[i];
            if (segment) {
                data += getProperty(unescapeJsonPointer(segment));
                expr += " && " + data;
            }
        }
        return expr;
    }
    function joinPaths(a, b) {
        if (a == '""') return b;
        return (a + " + " + b).replace(/([^\\])' \+ '/g, "$1");
    }
    function unescapeFragment(str) {
        return unescapeJsonPointer(decodeURIComponent(str));
    }
    function escapeFragment(str) {
        return encodeURIComponent(escapeJsonPointer(str));
    }
    function escapeJsonPointer(str) {
        return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
    function unescapeJsonPointer(str) {
        return str.replace(/~1/g, "/").replace(/~0/g, "~");
    }
    return util;
}

var schema_obj;

var hasRequiredSchema_obj;

function requireSchema_obj() {
    if (hasRequiredSchema_obj) return schema_obj;
    hasRequiredSchema_obj = 1;
    var util = requireUtil();
    schema_obj = SchemaObject;
    function SchemaObject(obj) {
        util.copy(obj, this);
    }
    return schema_obj;
}

var jsonSchemaTraverse = {
    exports: {}
};

var hasRequiredJsonSchemaTraverse;

function requireJsonSchemaTraverse() {
    if (hasRequiredJsonSchemaTraverse) return jsonSchemaTraverse.exports;
    hasRequiredJsonSchemaTraverse = 1;
    var traverse = jsonSchemaTraverse.exports = function(schema, opts, cb) {
        if (typeof opts == "function") {
            cb = opts;
            opts = {};
        }
        cb = opts.cb || cb;
        var pre = typeof cb == "function" ? cb : cb.pre || function() {};
        var post = cb.post || function() {};
        _traverse(opts, pre, post, schema, "", schema);
    };
    traverse.keywords = {
        additionalItems: true,
        items: true,
        contains: true,
        additionalProperties: true,
        propertyNames: true,
        not: true
    };
    traverse.arrayKeywords = {
        items: true,
        allOf: true,
        anyOf: true,
        oneOf: true
    };
    traverse.propsKeywords = {
        definitions: true,
        properties: true,
        patternProperties: true,
        dependencies: true
    };
    traverse.skipKeywords = {
        default: true,
        enum: true,
        const: true,
        required: true,
        maximum: true,
        minimum: true,
        exclusiveMaximum: true,
        exclusiveMinimum: true,
        multipleOf: true,
        maxLength: true,
        minLength: true,
        pattern: true,
        format: true,
        maxItems: true,
        minItems: true,
        uniqueItems: true,
        maxProperties: true,
        minProperties: true
    };
    function _traverse(opts, pre, post, schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex) {
        if (schema && typeof schema == "object" && !Array.isArray(schema)) {
            pre(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
            for (var key in schema) {
                var sch = schema[key];
                if (Array.isArray(sch)) {
                    if (key in traverse.arrayKeywords) {
                        for (var i = 0; i < sch.length; i++) _traverse(opts, pre, post, sch[i], jsonPtr + "/" + key + "/" + i, rootSchema, jsonPtr, key, schema, i);
                    }
                } else if (key in traverse.propsKeywords) {
                    if (sch && typeof sch == "object") {
                        for (var prop in sch) _traverse(opts, pre, post, sch[prop], jsonPtr + "/" + key + "/" + escapeJsonPtr(prop), rootSchema, jsonPtr, key, schema, prop);
                    }
                } else if (key in traverse.keywords || opts.allKeys && !(key in traverse.skipKeywords)) {
                    _traverse(opts, pre, post, sch, jsonPtr + "/" + key, rootSchema, jsonPtr, key, schema);
                }
            }
            post(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
        }
    }
    function escapeJsonPtr(str) {
        return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
    return jsonSchemaTraverse.exports;
}

var resolve_1;

var hasRequiredResolve;

function requireResolve() {
    if (hasRequiredResolve) return resolve_1;
    hasRequiredResolve = 1;
    var URI = requireUri_all(), equal = requireFastDeepEqual(), util = requireUtil(), SchemaObject = requireSchema_obj(), traverse = requireJsonSchemaTraverse();
    resolve_1 = resolve;
    resolve.normalizeId = normalizeId;
    resolve.fullPath = getFullPath;
    resolve.url = resolveUrl;
    resolve.ids = resolveIds;
    resolve.inlineRef = inlineRef;
    resolve.schema = resolveSchema;
    function resolve(compile, root, ref) {
        var refVal = this._refs[ref];
        if (typeof refVal == "string") {
            if (this._refs[refVal]) refVal = this._refs[refVal]; else return resolve.call(this, compile, root, refVal);
        }
        refVal = refVal || this._schemas[ref];
        if (refVal instanceof SchemaObject) {
            return inlineRef(refVal.schema, this._opts.inlineRefs) ? refVal.schema : refVal.validate || this._compile(refVal);
        }
        var res = resolveSchema.call(this, root, ref);
        var schema, v, baseId;
        if (res) {
            schema = res.schema;
            root = res.root;
            baseId = res.baseId;
        }
        if (schema instanceof SchemaObject) {
            v = schema.validate || compile.call(this, schema.schema, root, undefined, baseId);
        } else if (schema !== undefined) {
            v = inlineRef(schema, this._opts.inlineRefs) ? schema : compile.call(this, schema, root, undefined, baseId);
        }
        return v;
    }
    function resolveSchema(root, ref) {
        var p = URI.parse(ref), refPath = _getFullPath(p), baseId = getFullPath(this._getId(root.schema));
        if (Object.keys(root.schema).length === 0 || refPath !== baseId) {
            var id = normalizeId(refPath);
            var refVal = this._refs[id];
            if (typeof refVal == "string") {
                return resolveRecursive.call(this, root, refVal, p);
            } else if (refVal instanceof SchemaObject) {
                if (!refVal.validate) this._compile(refVal);
                root = refVal;
            } else {
                refVal = this._schemas[id];
                if (refVal instanceof SchemaObject) {
                    if (!refVal.validate) this._compile(refVal);
                    if (id == normalizeId(ref)) return {
                        schema: refVal,
                        root,
                        baseId
                    };
                    root = refVal;
                } else {
                    return;
                }
            }
            if (!root.schema) return;
            baseId = getFullPath(this._getId(root.schema));
        }
        return getJsonPointer.call(this, p, baseId, root.schema, root);
    }
    function resolveRecursive(root, ref, parsedRef) {
        var res = resolveSchema.call(this, root, ref);
        if (res) {
            var schema = res.schema;
            var baseId = res.baseId;
            root = res.root;
            var id = this._getId(schema);
            if (id) baseId = resolveUrl(baseId, id);
            return getJsonPointer.call(this, parsedRef, baseId, schema, root);
        }
    }
    var PREVENT_SCOPE_CHANGE = util.toHash([ "properties", "patternProperties", "enum", "dependencies", "definitions" ]);
    function getJsonPointer(parsedRef, baseId, schema, root) {
        parsedRef.fragment = parsedRef.fragment || "";
        if (parsedRef.fragment.slice(0, 1) != "/") return;
        var parts = parsedRef.fragment.split("/");
        for (var i = 1; i < parts.length; i++) {
            var part = parts[i];
            if (part) {
                part = util.unescapeFragment(part);
                schema = schema[part];
                if (schema === undefined) break;
                var id;
                if (!PREVENT_SCOPE_CHANGE[part]) {
                    id = this._getId(schema);
                    if (id) baseId = resolveUrl(baseId, id);
                    if (schema.$ref) {
                        var $ref = resolveUrl(baseId, schema.$ref);
                        var res = resolveSchema.call(this, root, $ref);
                        if (res) {
                            schema = res.schema;
                            root = res.root;
                            baseId = res.baseId;
                        }
                    }
                }
            }
        }
        if (schema !== undefined && schema !== root.schema) return {
            schema,
            root,
            baseId
        };
    }
    var SIMPLE_INLINED = util.toHash([ "type", "format", "pattern", "maxLength", "minLength", "maxProperties", "minProperties", "maxItems", "minItems", "maximum", "minimum", "uniqueItems", "multipleOf", "required", "enum" ]);
    function inlineRef(schema, limit) {
        if (limit === false) return false;
        if (limit === undefined || limit === true) return checkNoRef(schema); else if (limit) return countKeys(schema) <= limit;
    }
    function checkNoRef(schema) {
        var item;
        if (Array.isArray(schema)) {
            for (var i = 0; i < schema.length; i++) {
                item = schema[i];
                if (typeof item == "object" && !checkNoRef(item)) return false;
            }
        } else {
            for (var key in schema) {
                if (key == "$ref") return false;
                item = schema[key];
                if (typeof item == "object" && !checkNoRef(item)) return false;
            }
        }
        return true;
    }
    function countKeys(schema) {
        var count = 0, item;
        if (Array.isArray(schema)) {
            for (var i = 0; i < schema.length; i++) {
                item = schema[i];
                if (typeof item == "object") count += countKeys(item);
                if (count == Infinity) return Infinity;
            }
        } else {
            for (var key in schema) {
                if (key == "$ref") return Infinity;
                if (SIMPLE_INLINED[key]) {
                    count++;
                } else {
                    item = schema[key];
                    if (typeof item == "object") count += countKeys(item) + 1;
                    if (count == Infinity) return Infinity;
                }
            }
        }
        return count;
    }
    function getFullPath(id, normalize) {
        if (normalize !== false) id = normalizeId(id);
        var p = URI.parse(id);
        return _getFullPath(p);
    }
    function _getFullPath(p) {
        return URI.serialize(p).split("#")[0] + "#";
    }
    var TRAILING_SLASH_HASH = /#\/?$/;
    function normalizeId(id) {
        return id ? id.replace(TRAILING_SLASH_HASH, "") : "";
    }
    function resolveUrl(baseId, id) {
        id = normalizeId(id);
        return URI.resolve(baseId, id);
    }
    function resolveIds(schema) {
        var schemaId = normalizeId(this._getId(schema));
        var baseIds = {
            "": schemaId
        };
        var fullPaths = {
            "": getFullPath(schemaId, false)
        };
        var localRefs = {};
        var self = this;
        traverse(schema, {
            allKeys: true
        }, function(sch, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex) {
            if (jsonPtr === "") return;
            var id = self._getId(sch);
            var baseId = baseIds[parentJsonPtr];
            var fullPath = fullPaths[parentJsonPtr] + "/" + parentKeyword;
            if (keyIndex !== undefined) fullPath += "/" + (typeof keyIndex == "number" ? keyIndex : util.escapeFragment(keyIndex));
            if (typeof id == "string") {
                id = baseId = normalizeId(baseId ? URI.resolve(baseId, id) : id);
                var refVal = self._refs[id];
                if (typeof refVal == "string") refVal = self._refs[refVal];
                if (refVal && refVal.schema) {
                    if (!equal(sch, refVal.schema)) throw new Error('id "' + id + '" resolves to more than one schema');
                } else if (id != normalizeId(fullPath)) {
                    if (id[0] == "#") {
                        if (localRefs[id] && !equal(sch, localRefs[id])) throw new Error('id "' + id + '" resolves to more than one schema');
                        localRefs[id] = sch;
                    } else {
                        self._refs[id] = fullPath;
                    }
                }
            }
            baseIds[jsonPtr] = baseId;
            fullPaths[jsonPtr] = fullPath;
        });
        return localRefs;
    }
    return resolve_1;
}

var error_classes;

var hasRequiredError_classes;

function requireError_classes() {
    if (hasRequiredError_classes) return error_classes;
    hasRequiredError_classes = 1;
    var resolve = requireResolve();
    error_classes = {
        Validation: errorSubclass(ValidationError),
        MissingRef: errorSubclass(MissingRefError)
    };
    function ValidationError(errors) {
        this.message = "validation failed";
        this.errors = errors;
        this.ajv = this.validation = true;
    }
    MissingRefError.message = function(baseId, ref) {
        return "can't resolve reference " + ref + " from id " + baseId;
    };
    function MissingRefError(baseId, ref, message) {
        this.message = message || MissingRefError.message(baseId, ref);
        this.missingRef = resolve.url(baseId, ref);
        this.missingSchema = resolve.normalizeId(resolve.fullPath(this.missingRef));
    }
    function errorSubclass(Subclass) {
        Subclass.prototype = Object.create(Error.prototype);
        Subclass.prototype.constructor = Subclass;
        return Subclass;
    }
    return error_classes;
}

var fastJsonStableStringify;

var hasRequiredFastJsonStableStringify;

function requireFastJsonStableStringify() {
    if (hasRequiredFastJsonStableStringify) return fastJsonStableStringify;
    hasRequiredFastJsonStableStringify = 1;
    fastJsonStableStringify = function(data, opts) {
        if (!opts) opts = {};
        if (typeof opts === "function") opts = {
            cmp: opts
        };
        var cycles = typeof opts.cycles === "boolean" ? opts.cycles : false;
        var cmp = opts.cmp && function(f) {
            return function(node) {
                return function(a, b) {
                    var aobj = {
                        key: a,
                        value: node[a]
                    };
                    var bobj = {
                        key: b,
                        value: node[b]
                    };
                    return f(aobj, bobj);
                };
            };
        }(opts.cmp);
        var seen = [];
        return function stringify(node) {
            if (node && node.toJSON && typeof node.toJSON === "function") {
                node = node.toJSON();
            }
            if (node === undefined) return;
            if (typeof node == "number") return isFinite(node) ? "" + node : "null";
            if (typeof node !== "object") return JSON.stringify(node);
            var i, out;
            if (Array.isArray(node)) {
                out = "[";
                for (i = 0; i < node.length; i++) {
                    if (i) out += ",";
                    out += stringify(node[i]) || "null";
                }
                return out + "]";
            }
            if (node === null) return "null";
            if (seen.indexOf(node) !== -1) {
                if (cycles) return JSON.stringify("__cycle__");
                throw new TypeError("Converting circular structure to JSON");
            }
            var seenIndex = seen.push(node) - 1;
            var keys = Object.keys(node).sort(cmp && cmp(node));
            out = "";
            for (i = 0; i < keys.length; i++) {
                var key = keys[i];
                var value = stringify(node[key]);
                if (!value) continue;
                if (out) out += ",";
                out += JSON.stringify(key) + ":" + value;
            }
            seen.splice(seenIndex, 1);
            return "{" + out + "}";
        }(data);
    };
    return fastJsonStableStringify;
}

var validate;

var hasRequiredValidate;

function requireValidate() {
    if (hasRequiredValidate) return validate;
    hasRequiredValidate = 1;
    validate = function generate_validate(it, $keyword, $ruleType) {
        var out = "";
        var $async = it.schema.$async === true, $refKeywords = it.util.schemaHasRulesExcept(it.schema, it.RULES.all, "$ref"), $id = it.self._getId(it.schema);
        if (it.opts.strictKeywords) {
            var $unknownKwd = it.util.schemaUnknownRules(it.schema, it.RULES.keywords);
            if ($unknownKwd) {
                var $keywordsMsg = "unknown keyword: " + $unknownKwd;
                if (it.opts.strictKeywords === "log") it.logger.warn($keywordsMsg); else throw new Error($keywordsMsg);
            }
        }
        if (it.isTop) {
            out += " var validate = ";
            if ($async) {
                it.async = true;
                out += "async ";
            }
            out += "function(data, dataPath, parentData, parentDataProperty, rootData) { 'use strict'; ";
            if ($id && (it.opts.sourceCode || it.opts.processCode)) {
                out += " " + ("/*# sourceURL=" + $id + " */") + " ";
            }
        }
        if (typeof it.schema == "boolean" || !($refKeywords || it.schema.$ref)) {
            var $keyword = "false schema";
            var $lvl = it.level;
            var $dataLvl = it.dataLevel;
            var $schema = it.schema[$keyword];
            var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
            var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
            var $breakOnError = !it.opts.allErrors;
            var $errorKeyword;
            var $data = "data" + ($dataLvl || "");
            var $valid = "valid" + $lvl;
            if (it.schema === false) {
                if (it.isTop) {
                    $breakOnError = true;
                } else {
                    out += " var " + $valid + " = false; ";
                }
                var $$outStack = $$outStack || [];
                $$outStack.push(out);
                out = "";
                if (it.createErrors !== false) {
                    out += " { keyword: '" + ($errorKeyword || "false schema") + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: {} ";
                    if (it.opts.messages !== false) {
                        out += " , message: 'boolean schema is false' ";
                    }
                    if (it.opts.verbose) {
                        out += " , schema: false , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                    }
                    out += " } ";
                } else {
                    out += " {} ";
                }
                var __err = out;
                out = $$outStack.pop();
                if (!it.compositeRule && $breakOnError) {
                    if (it.async) {
                        out += " throw new ValidationError([" + __err + "]); ";
                    } else {
                        out += " validate.errors = [" + __err + "]; return false; ";
                    }
                } else {
                    out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                }
            } else {
                if (it.isTop) {
                    if ($async) {
                        out += " return data; ";
                    } else {
                        out += " validate.errors = null; return true; ";
                    }
                } else {
                    out += " var " + $valid + " = true; ";
                }
            }
            if (it.isTop) {
                out += " }; return validate; ";
            }
            return out;
        }
        if (it.isTop) {
            var $top = it.isTop, $lvl = it.level = 0, $dataLvl = it.dataLevel = 0, $data = "data";
            it.rootId = it.resolve.fullPath(it.self._getId(it.root.schema));
            it.baseId = it.baseId || it.rootId;
            delete it.isTop;
            it.dataPathArr = [ "" ];
            if (it.schema.default !== undefined && it.opts.useDefaults && it.opts.strictDefaults) {
                var $defaultMsg = "default is ignored in the schema root";
                if (it.opts.strictDefaults === "log") it.logger.warn($defaultMsg); else throw new Error($defaultMsg);
            }
            out += " var vErrors = null; ";
            out += " var errors = 0;     ";
            out += " if (rootData === undefined) rootData = data; ";
        } else {
            var $lvl = it.level, $dataLvl = it.dataLevel, $data = "data" + ($dataLvl || "");
            if ($id) it.baseId = it.resolve.url(it.baseId, $id);
            if ($async && !it.async) throw new Error("async schema in sync schema");
            out += " var errs_" + $lvl + " = errors;";
        }
        var $valid = "valid" + $lvl, $breakOnError = !it.opts.allErrors, $closingBraces1 = "", $closingBraces2 = "";
        var $errorKeyword;
        var $typeSchema = it.schema.type, $typeIsArray = Array.isArray($typeSchema);
        if ($typeSchema && it.opts.nullable && it.schema.nullable === true) {
            if ($typeIsArray) {
                if ($typeSchema.indexOf("null") == -1) $typeSchema = $typeSchema.concat("null");
            } else if ($typeSchema != "null") {
                $typeSchema = [ $typeSchema, "null" ];
                $typeIsArray = true;
            }
        }
        if ($typeIsArray && $typeSchema.length == 1) {
            $typeSchema = $typeSchema[0];
            $typeIsArray = false;
        }
        if (it.schema.$ref && $refKeywords) {
            if (it.opts.extendRefs == "fail") {
                throw new Error('$ref: validation keywords used in schema at path "' + it.errSchemaPath + '" (see option extendRefs)');
            } else if (it.opts.extendRefs !== true) {
                $refKeywords = false;
                it.logger.warn('$ref: keywords ignored in schema at path "' + it.errSchemaPath + '"');
            }
        }
        if (it.schema.$comment && it.opts.$comment) {
            out += " " + it.RULES.all.$comment.code(it, "$comment");
        }
        if ($typeSchema) {
            if (it.opts.coerceTypes) {
                var $coerceToTypes = it.util.coerceToTypes(it.opts.coerceTypes, $typeSchema);
            }
            var $rulesGroup = it.RULES.types[$typeSchema];
            if ($coerceToTypes || $typeIsArray || $rulesGroup === true || $rulesGroup && !$shouldUseGroup($rulesGroup)) {
                var $schemaPath = it.schemaPath + ".type", $errSchemaPath = it.errSchemaPath + "/type";
                var $schemaPath = it.schemaPath + ".type", $errSchemaPath = it.errSchemaPath + "/type", $method = $typeIsArray ? "checkDataTypes" : "checkDataType";
                out += " if (" + it.util[$method]($typeSchema, $data, it.opts.strictNumbers, true) + ") { ";
                if ($coerceToTypes) {
                    var $dataType = "dataType" + $lvl, $coerced = "coerced" + $lvl;
                    out += " var " + $dataType + " = typeof " + $data + "; var " + $coerced + " = undefined; ";
                    if (it.opts.coerceTypes == "array") {
                        out += " if (" + $dataType + " == 'object' && Array.isArray(" + $data + ") && " + $data + ".length == 1) { " + $data + " = " + $data + "[0]; " + $dataType + " = typeof " + $data + "; if (" + it.util.checkDataType(it.schema.type, $data, it.opts.strictNumbers) + ") " + $coerced + " = " + $data + "; } ";
                    }
                    out += " if (" + $coerced + " !== undefined) ; ";
                    var arr1 = $coerceToTypes;
                    if (arr1) {
                        var $type, $i = -1, l1 = arr1.length - 1;
                        while ($i < l1) {
                            $type = arr1[$i += 1];
                            if ($type == "string") {
                                out += " else if (" + $dataType + " == 'number' || " + $dataType + " == 'boolean') " + $coerced + " = '' + " + $data + "; else if (" + $data + " === null) " + $coerced + " = ''; ";
                            } else if ($type == "number" || $type == "integer") {
                                out += " else if (" + $dataType + " == 'boolean' || " + $data + " === null || (" + $dataType + " == 'string' && " + $data + " && " + $data + " == +" + $data + " ";
                                if ($type == "integer") {
                                    out += " && !(" + $data + " % 1)";
                                }
                                out += ")) " + $coerced + " = +" + $data + "; ";
                            } else if ($type == "boolean") {
                                out += " else if (" + $data + " === 'false' || " + $data + " === 0 || " + $data + " === null) " + $coerced + " = false; else if (" + $data + " === 'true' || " + $data + " === 1) " + $coerced + " = true; ";
                            } else if ($type == "null") {
                                out += " else if (" + $data + " === '' || " + $data + " === 0 || " + $data + " === false) " + $coerced + " = null; ";
                            } else if (it.opts.coerceTypes == "array" && $type == "array") {
                                out += " else if (" + $dataType + " == 'string' || " + $dataType + " == 'number' || " + $dataType + " == 'boolean' || " + $data + " == null) " + $coerced + " = [" + $data + "]; ";
                            }
                        }
                    }
                    out += " else {   ";
                    var $$outStack = $$outStack || [];
                    $$outStack.push(out);
                    out = "";
                    if (it.createErrors !== false) {
                        out += " { keyword: '" + ($errorKeyword || "type") + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { type: '";
                        if ($typeIsArray) {
                            out += "" + $typeSchema.join(",");
                        } else {
                            out += "" + $typeSchema;
                        }
                        out += "' } ";
                        if (it.opts.messages !== false) {
                            out += " , message: 'should be ";
                            if ($typeIsArray) {
                                out += "" + $typeSchema.join(",");
                            } else {
                                out += "" + $typeSchema;
                            }
                            out += "' ";
                        }
                        if (it.opts.verbose) {
                            out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                        }
                        out += " } ";
                    } else {
                        out += " {} ";
                    }
                    var __err = out;
                    out = $$outStack.pop();
                    if (!it.compositeRule && $breakOnError) {
                        if (it.async) {
                            out += " throw new ValidationError([" + __err + "]); ";
                        } else {
                            out += " validate.errors = [" + __err + "]; return false; ";
                        }
                    } else {
                        out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                    }
                    out += " } if (" + $coerced + " !== undefined) {  ";
                    var $parentData = $dataLvl ? "data" + ($dataLvl - 1 || "") : "parentData", $parentDataProperty = $dataLvl ? it.dataPathArr[$dataLvl] : "parentDataProperty";
                    out += " " + $data + " = " + $coerced + "; ";
                    if (!$dataLvl) {
                        out += "if (" + $parentData + " !== undefined)";
                    }
                    out += " " + $parentData + "[" + $parentDataProperty + "] = " + $coerced + "; } ";
                } else {
                    var $$outStack = $$outStack || [];
                    $$outStack.push(out);
                    out = "";
                    if (it.createErrors !== false) {
                        out += " { keyword: '" + ($errorKeyword || "type") + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { type: '";
                        if ($typeIsArray) {
                            out += "" + $typeSchema.join(",");
                        } else {
                            out += "" + $typeSchema;
                        }
                        out += "' } ";
                        if (it.opts.messages !== false) {
                            out += " , message: 'should be ";
                            if ($typeIsArray) {
                                out += "" + $typeSchema.join(",");
                            } else {
                                out += "" + $typeSchema;
                            }
                            out += "' ";
                        }
                        if (it.opts.verbose) {
                            out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                        }
                        out += " } ";
                    } else {
                        out += " {} ";
                    }
                    var __err = out;
                    out = $$outStack.pop();
                    if (!it.compositeRule && $breakOnError) {
                        if (it.async) {
                            out += " throw new ValidationError([" + __err + "]); ";
                        } else {
                            out += " validate.errors = [" + __err + "]; return false; ";
                        }
                    } else {
                        out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                    }
                }
                out += " } ";
            }
        }
        if (it.schema.$ref && !$refKeywords) {
            out += " " + it.RULES.all.$ref.code(it, "$ref") + " ";
            if ($breakOnError) {
                out += " } if (errors === ";
                if ($top) {
                    out += "0";
                } else {
                    out += "errs_" + $lvl;
                }
                out += ") { ";
                $closingBraces2 += "}";
            }
        } else {
            var arr2 = it.RULES;
            if (arr2) {
                var $rulesGroup, i2 = -1, l2 = arr2.length - 1;
                while (i2 < l2) {
                    $rulesGroup = arr2[i2 += 1];
                    if ($shouldUseGroup($rulesGroup)) {
                        if ($rulesGroup.type) {
                            out += " if (" + it.util.checkDataType($rulesGroup.type, $data, it.opts.strictNumbers) + ") { ";
                        }
                        if (it.opts.useDefaults) {
                            if ($rulesGroup.type == "object" && it.schema.properties) {
                                var $schema = it.schema.properties, $schemaKeys = Object.keys($schema);
                                var arr3 = $schemaKeys;
                                if (arr3) {
                                    var $propertyKey, i3 = -1, l3 = arr3.length - 1;
                                    while (i3 < l3) {
                                        $propertyKey = arr3[i3 += 1];
                                        var $sch = $schema[$propertyKey];
                                        if ($sch.default !== undefined) {
                                            var $passData = $data + it.util.getProperty($propertyKey);
                                            if (it.compositeRule) {
                                                if (it.opts.strictDefaults) {
                                                    var $defaultMsg = "default is ignored for: " + $passData;
                                                    if (it.opts.strictDefaults === "log") it.logger.warn($defaultMsg); else throw new Error($defaultMsg);
                                                }
                                            } else {
                                                out += " if (" + $passData + " === undefined ";
                                                if (it.opts.useDefaults == "empty") {
                                                    out += " || " + $passData + " === null || " + $passData + " === '' ";
                                                }
                                                out += " ) " + $passData + " = ";
                                                if (it.opts.useDefaults == "shared") {
                                                    out += " " + it.useDefault($sch.default) + " ";
                                                } else {
                                                    out += " " + JSON.stringify($sch.default) + " ";
                                                }
                                                out += "; ";
                                            }
                                        }
                                    }
                                }
                            } else if ($rulesGroup.type == "array" && Array.isArray(it.schema.items)) {
                                var arr4 = it.schema.items;
                                if (arr4) {
                                    var $sch, $i = -1, l4 = arr4.length - 1;
                                    while ($i < l4) {
                                        $sch = arr4[$i += 1];
                                        if ($sch.default !== undefined) {
                                            var $passData = $data + "[" + $i + "]";
                                            if (it.compositeRule) {
                                                if (it.opts.strictDefaults) {
                                                    var $defaultMsg = "default is ignored for: " + $passData;
                                                    if (it.opts.strictDefaults === "log") it.logger.warn($defaultMsg); else throw new Error($defaultMsg);
                                                }
                                            } else {
                                                out += " if (" + $passData + " === undefined ";
                                                if (it.opts.useDefaults == "empty") {
                                                    out += " || " + $passData + " === null || " + $passData + " === '' ";
                                                }
                                                out += " ) " + $passData + " = ";
                                                if (it.opts.useDefaults == "shared") {
                                                    out += " " + it.useDefault($sch.default) + " ";
                                                } else {
                                                    out += " " + JSON.stringify($sch.default) + " ";
                                                }
                                                out += "; ";
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        var arr5 = $rulesGroup.rules;
                        if (arr5) {
                            var $rule, i5 = -1, l5 = arr5.length - 1;
                            while (i5 < l5) {
                                $rule = arr5[i5 += 1];
                                if ($shouldUseRule($rule)) {
                                    var $code = $rule.code(it, $rule.keyword, $rulesGroup.type);
                                    if ($code) {
                                        out += " " + $code + " ";
                                        if ($breakOnError) {
                                            $closingBraces1 += "}";
                                        }
                                    }
                                }
                            }
                        }
                        if ($breakOnError) {
                            out += " " + $closingBraces1 + " ";
                            $closingBraces1 = "";
                        }
                        if ($rulesGroup.type) {
                            out += " } ";
                            if ($typeSchema && $typeSchema === $rulesGroup.type && !$coerceToTypes) {
                                out += " else { ";
                                var $schemaPath = it.schemaPath + ".type", $errSchemaPath = it.errSchemaPath + "/type";
                                var $$outStack = $$outStack || [];
                                $$outStack.push(out);
                                out = "";
                                if (it.createErrors !== false) {
                                    out += " { keyword: '" + ($errorKeyword || "type") + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { type: '";
                                    if ($typeIsArray) {
                                        out += "" + $typeSchema.join(",");
                                    } else {
                                        out += "" + $typeSchema;
                                    }
                                    out += "' } ";
                                    if (it.opts.messages !== false) {
                                        out += " , message: 'should be ";
                                        if ($typeIsArray) {
                                            out += "" + $typeSchema.join(",");
                                        } else {
                                            out += "" + $typeSchema;
                                        }
                                        out += "' ";
                                    }
                                    if (it.opts.verbose) {
                                        out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                                    }
                                    out += " } ";
                                } else {
                                    out += " {} ";
                                }
                                var __err = out;
                                out = $$outStack.pop();
                                if (!it.compositeRule && $breakOnError) {
                                    if (it.async) {
                                        out += " throw new ValidationError([" + __err + "]); ";
                                    } else {
                                        out += " validate.errors = [" + __err + "]; return false; ";
                                    }
                                } else {
                                    out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                                }
                                out += " } ";
                            }
                        }
                        if ($breakOnError) {
                            out += " if (errors === ";
                            if ($top) {
                                out += "0";
                            } else {
                                out += "errs_" + $lvl;
                            }
                            out += ") { ";
                            $closingBraces2 += "}";
                        }
                    }
                }
            }
        }
        if ($breakOnError) {
            out += " " + $closingBraces2 + " ";
        }
        if ($top) {
            if ($async) {
                out += " if (errors === 0) return data;           ";
                out += " else throw new ValidationError(vErrors); ";
            } else {
                out += " validate.errors = vErrors; ";
                out += " return errors === 0;       ";
            }
            out += " }; return validate;";
        } else {
            out += " var " + $valid + " = errors === errs_" + $lvl + ";";
        }
        function $shouldUseGroup($rulesGroup) {
            var rules = $rulesGroup.rules;
            for (var i = 0; i < rules.length; i++) if ($shouldUseRule(rules[i])) return true;
        }
        function $shouldUseRule($rule) {
            return it.schema[$rule.keyword] !== undefined || $rule.implements && $ruleImplementsSomeKeyword($rule);
        }
        function $ruleImplementsSomeKeyword($rule) {
            var impl = $rule.implements;
            for (var i = 0; i < impl.length; i++) if (it.schema[impl[i]] !== undefined) return true;
        }
        return out;
    };
    return validate;
}

var compile_1;

var hasRequiredCompile;

function requireCompile() {
    if (hasRequiredCompile) return compile_1;
    hasRequiredCompile = 1;
    var resolve = requireResolve(), util = requireUtil(), errorClasses = requireError_classes(), stableStringify = requireFastJsonStableStringify();
    var validateGenerator = requireValidate();
    var ucs2length = util.ucs2length;
    var equal = requireFastDeepEqual();
    var ValidationError = errorClasses.Validation;
    compile_1 = compile;
    function compile(schema, root, localRefs, baseId) {
        var self = this, opts = this._opts, refVal = [ undefined ], refs = {}, patterns = [], patternsHash = {}, defaults = [], defaultsHash = {}, customRules = [];
        root = root || {
            schema,
            refVal,
            refs
        };
        var c = checkCompiling.call(this, schema, root, baseId);
        var compilation = this._compilations[c.index];
        if (c.compiling) return compilation.callValidate = callValidate;
        var formats = this._formats;
        var RULES = this.RULES;
        try {
            var v = localCompile(schema, root, localRefs, baseId);
            compilation.validate = v;
            var cv = compilation.callValidate;
            if (cv) {
                cv.schema = v.schema;
                cv.errors = null;
                cv.refs = v.refs;
                cv.refVal = v.refVal;
                cv.root = v.root;
                cv.$async = v.$async;
                if (opts.sourceCode) cv.source = v.source;
            }
            return v;
        } finally {
            endCompiling.call(this, schema, root, baseId);
        }
        function callValidate() {
            var validate = compilation.validate;
            var result = validate.apply(this, arguments);
            callValidate.errors = validate.errors;
            return result;
        }
        function localCompile(_schema, _root, localRefs, baseId) {
            var isRoot = !_root || _root && _root.schema == _schema;
            if (_root.schema != root.schema) return compile.call(self, _schema, _root, localRefs, baseId);
            var $async = _schema.$async === true;
            var sourceCode = validateGenerator({
                isTop: true,
                schema: _schema,
                isRoot,
                baseId,
                root: _root,
                schemaPath: "",
                errSchemaPath: "#",
                errorPath: '""',
                MissingRefError: errorClasses.MissingRef,
                RULES,
                validate: validateGenerator,
                util,
                resolve,
                resolveRef,
                usePattern,
                useDefault,
                useCustomRule,
                opts,
                formats,
                logger: self.logger,
                self
            });
            sourceCode = vars(refVal, refValCode) + vars(patterns, patternCode) + vars(defaults, defaultCode) + vars(customRules, customRuleCode) + sourceCode;
            if (opts.processCode) sourceCode = opts.processCode(sourceCode, _schema);
            var validate;
            try {
                var makeValidate = new Function("self", "RULES", "formats", "root", "refVal", "defaults", "customRules", "equal", "ucs2length", "ValidationError", sourceCode);
                validate = makeValidate(self, RULES, formats, root, refVal, defaults, customRules, equal, ucs2length, ValidationError);
                refVal[0] = validate;
            } catch (e) {
                self.logger.error("Error compiling schema, function code:", sourceCode);
                throw e;
            }
            validate.schema = _schema;
            validate.errors = null;
            validate.refs = refs;
            validate.refVal = refVal;
            validate.root = isRoot ? validate : _root;
            if ($async) validate.$async = true;
            if (opts.sourceCode === true) {
                validate.source = {
                    code: sourceCode,
                    patterns,
                    defaults
                };
            }
            return validate;
        }
        function resolveRef(baseId, ref, isRoot) {
            ref = resolve.url(baseId, ref);
            var refIndex = refs[ref];
            var _refVal, refCode;
            if (refIndex !== undefined) {
                _refVal = refVal[refIndex];
                refCode = "refVal[" + refIndex + "]";
                return resolvedRef(_refVal, refCode);
            }
            if (!isRoot && root.refs) {
                var rootRefId = root.refs[ref];
                if (rootRefId !== undefined) {
                    _refVal = root.refVal[rootRefId];
                    refCode = addLocalRef(ref, _refVal);
                    return resolvedRef(_refVal, refCode);
                }
            }
            refCode = addLocalRef(ref);
            var v = resolve.call(self, localCompile, root, ref);
            if (v === undefined) {
                var localSchema = localRefs && localRefs[ref];
                if (localSchema) {
                    v = resolve.inlineRef(localSchema, opts.inlineRefs) ? localSchema : compile.call(self, localSchema, root, localRefs, baseId);
                }
            }
            if (v === undefined) {
                removeLocalRef(ref);
            } else {
                replaceLocalRef(ref, v);
                return resolvedRef(v, refCode);
            }
        }
        function addLocalRef(ref, v) {
            var refId = refVal.length;
            refVal[refId] = v;
            refs[ref] = refId;
            return "refVal" + refId;
        }
        function removeLocalRef(ref) {
            delete refs[ref];
        }
        function replaceLocalRef(ref, v) {
            var refId = refs[ref];
            refVal[refId] = v;
        }
        function resolvedRef(refVal, code) {
            return typeof refVal == "object" || typeof refVal == "boolean" ? {
                code,
                schema: refVal,
                inline: true
            } : {
                code,
                $async: refVal && !!refVal.$async
            };
        }
        function usePattern(regexStr) {
            var index = patternsHash[regexStr];
            if (index === undefined) {
                index = patternsHash[regexStr] = patterns.length;
                patterns[index] = regexStr;
            }
            return "pattern" + index;
        }
        function useDefault(value) {
            switch (typeof value) {
              case "boolean":
              case "number":
                return "" + value;

              case "string":
                return util.toQuotedString(value);

              case "object":
                if (value === null) return "null";
                var valueStr = stableStringify(value);
                var index = defaultsHash[valueStr];
                if (index === undefined) {
                    index = defaultsHash[valueStr] = defaults.length;
                    defaults[index] = value;
                }
                return "default" + index;
            }
        }
        function useCustomRule(rule, schema, parentSchema, it) {
            if (self._opts.validateSchema !== false) {
                var deps = rule.definition.dependencies;
                if (deps && !deps.every(function(keyword) {
                    return Object.prototype.hasOwnProperty.call(parentSchema, keyword);
                })) throw new Error("parent schema must have all required keywords: " + deps.join(","));
                var validateSchema = rule.definition.validateSchema;
                if (validateSchema) {
                    var valid = validateSchema(schema);
                    if (!valid) {
                        var message = "keyword schema is invalid: " + self.errorsText(validateSchema.errors);
                        if (self._opts.validateSchema == "log") self.logger.error(message); else throw new Error(message);
                    }
                }
            }
            var compile = rule.definition.compile, inline = rule.definition.inline, macro = rule.definition.macro;
            var validate;
            if (compile) {
                validate = compile.call(self, schema, parentSchema, it);
            } else if (macro) {
                validate = macro.call(self, schema, parentSchema, it);
                if (opts.validateSchema !== false) self.validateSchema(validate, true);
            } else if (inline) {
                validate = inline.call(self, it, rule.keyword, schema, parentSchema);
            } else {
                validate = rule.definition.validate;
                if (!validate) return;
            }
            if (validate === undefined) throw new Error('custom keyword "' + rule.keyword + '"failed to compile');
            var index = customRules.length;
            customRules[index] = validate;
            return {
                code: "customRule" + index,
                validate
            };
        }
    }
    function checkCompiling(schema, root, baseId) {
        var index = compIndex.call(this, schema, root, baseId);
        if (index >= 0) return {
            index,
            compiling: true
        };
        index = this._compilations.length;
        this._compilations[index] = {
            schema,
            root,
            baseId
        };
        return {
            index,
            compiling: false
        };
    }
    function endCompiling(schema, root, baseId) {
        var i = compIndex.call(this, schema, root, baseId);
        if (i >= 0) this._compilations.splice(i, 1);
    }
    function compIndex(schema, root, baseId) {
        for (var i = 0; i < this._compilations.length; i++) {
            var c = this._compilations[i];
            if (c.schema == schema && c.root == root && c.baseId == baseId) return i;
        }
        return -1;
    }
    function patternCode(i, patterns) {
        return "var pattern" + i + " = new RegExp(" + util.toQuotedString(patterns[i]) + ");";
    }
    function defaultCode(i) {
        return "var default" + i + " = defaults[" + i + "];";
    }
    function refValCode(i, refVal) {
        return refVal[i] === undefined ? "" : "var refVal" + i + " = refVal[" + i + "];";
    }
    function customRuleCode(i) {
        return "var customRule" + i + " = customRules[" + i + "];";
    }
    function vars(arr, statement) {
        if (!arr.length) return "";
        var code = "";
        for (var i = 0; i < arr.length; i++) code += statement(i, arr);
        return code;
    }
    return compile_1;
}

var cache = {
    exports: {}
};

var hasRequiredCache;

function requireCache() {
    if (hasRequiredCache) return cache.exports;
    hasRequiredCache = 1;
    var Cache = cache.exports = function Cache() {
        this._cache = {};
    };
    Cache.prototype.put = function Cache_put(key, value) {
        this._cache[key] = value;
    };
    Cache.prototype.get = function Cache_get(key) {
        return this._cache[key];
    };
    Cache.prototype.del = function Cache_del(key) {
        delete this._cache[key];
    };
    Cache.prototype.clear = function Cache_clear() {
        this._cache = {};
    };
    return cache.exports;
}

var formats_1;

var hasRequiredFormats;

function requireFormats() {
    if (hasRequiredFormats) return formats_1;
    hasRequiredFormats = 1;
    var util = requireUtil();
    var DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
    var DAYS = [ 0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ];
    var TIME = /^(\d\d):(\d\d):(\d\d)(\.\d+)?(z|[+-]\d\d(?::?\d\d)?)?$/i;
    var HOSTNAME = /^(?=.{1,253}\.?$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*\.?$/i;
    var URI = /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
    var URIREF = /^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'"()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?(?:\?(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
    var URITEMPLATE = /^(?:(?:[^\x00-\x20"'<>%\\^`{|}]|%[0-9a-f]{2})|\{[+#./;?&=,!@|]?(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?(?:,(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?)*\})*$/i;
    var URL = /^(?:(?:http[s\u017F]?|ftp):\/\/)(?:(?:[\0-\x08\x0E-\x1F!-\x9F\xA1-\u167F\u1681-\u1FFF\u200B-\u2027\u202A-\u202E\u2030-\u205E\u2060-\u2FFF\u3001-\uD7FF\uE000-\uFEFE\uFF00-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])+(?::(?:[\0-\x08\x0E-\x1F!-\x9F\xA1-\u167F\u1681-\u1FFF\u200B-\u2027\u202A-\u202E\u2030-\u205E\u2060-\u2FFF\u3001-\uD7FF\uE000-\uFEFE\uFF00-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])*)?@)?(?:(?!10(?:\.[0-9]{1,3}){3})(?!127(?:\.[0-9]{1,3}){3})(?!169\.254(?:\.[0-9]{1,3}){2})(?!192\.168(?:\.[0-9]{1,3}){2})(?!172\.(?:1[6-9]|2[0-9]|3[01])(?:\.[0-9]{1,3}){2})(?:[1-9][0-9]?|1[0-9][0-9]|2[01][0-9]|22[0-3])(?:\.(?:1?[0-9]{1,2}|2[0-4][0-9]|25[0-5])){2}(?:\.(?:[1-9][0-9]?|1[0-9][0-9]|2[0-4][0-9]|25[0-4]))|(?:(?:(?:[0-9a-z\xA1-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])+-)*(?:[0-9a-z\xA1-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])+)(?:\.(?:(?:[0-9a-z\xA1-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])+-)*(?:[0-9a-z\xA1-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])+)*(?:\.(?:(?:[a-z\xA1-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]){2,})))(?::[0-9]{2,5})?(?:\/(?:[\0-\x08\x0E-\x1F!-\x9F\xA1-\u167F\u1681-\u1FFF\u200B-\u2027\u202A-\u202E\u2030-\u205E\u2060-\u2FFF\u3001-\uD7FF\uE000-\uFEFE\uFF00-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])*)?$/i;
    var UUID = /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
    var JSON_POINTER = /^(?:\/(?:[^~/]|~0|~1)*)*$/;
    var JSON_POINTER_URI_FRAGMENT = /^#(?:\/(?:[a-z0-9_\-.!$&'()*+,;:=@]|%[0-9a-f]{2}|~0|~1)*)*$/i;
    var RELATIVE_JSON_POINTER = /^(?:0|[1-9][0-9]*)(?:#|(?:\/(?:[^~/]|~0|~1)*)*)$/;
    formats_1 = formats;
    function formats(mode) {
        mode = mode == "full" ? "full" : "fast";
        return util.copy(formats[mode]);
    }
    formats.fast = {
        date: /^\d\d\d\d-[0-1]\d-[0-3]\d$/,
        time: /^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i,
        "date-time": /^\d\d\d\d-[0-1]\d-[0-3]\d[t\s](?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i,
        uri: /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/)?[^\s]*$/i,
        "uri-reference": /^(?:(?:[a-z][a-z0-9+\-.]*:)?\/?\/)?(?:[^\\\s#][^\s#]*)?(?:#[^\\\s]*)?$/i,
        "uri-template": URITEMPLATE,
        url: URL,
        email: /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i,
        hostname: HOSTNAME,
        ipv4: /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
        ipv6: /^\s*(?:(?:(?:[0-9a-f]{1,4}:){7}(?:[0-9a-f]{1,4}|:))|(?:(?:[0-9a-f]{1,4}:){6}(?::[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(?:(?:[0-9a-f]{1,4}:){5}(?:(?:(?::[0-9a-f]{1,4}){1,2})|:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(?:(?:[0-9a-f]{1,4}:){4}(?:(?:(?::[0-9a-f]{1,4}){1,3})|(?:(?::[0-9a-f]{1,4})?:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){3}(?:(?:(?::[0-9a-f]{1,4}){1,4})|(?:(?::[0-9a-f]{1,4}){0,2}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){2}(?:(?:(?::[0-9a-f]{1,4}){1,5})|(?:(?::[0-9a-f]{1,4}){0,3}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){1}(?:(?:(?::[0-9a-f]{1,4}){1,6})|(?:(?::[0-9a-f]{1,4}){0,4}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?::(?:(?:(?::[0-9a-f]{1,4}){1,7})|(?:(?::[0-9a-f]{1,4}){0,5}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(?:%.+)?\s*$/i,
        regex,
        uuid: UUID,
        "json-pointer": JSON_POINTER,
        "json-pointer-uri-fragment": JSON_POINTER_URI_FRAGMENT,
        "relative-json-pointer": RELATIVE_JSON_POINTER
    };
    formats.full = {
        date,
        time,
        "date-time": date_time,
        uri,
        "uri-reference": URIREF,
        "uri-template": URITEMPLATE,
        url: URL,
        email: /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i,
        hostname: HOSTNAME,
        ipv4: /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
        ipv6: /^\s*(?:(?:(?:[0-9a-f]{1,4}:){7}(?:[0-9a-f]{1,4}|:))|(?:(?:[0-9a-f]{1,4}:){6}(?::[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(?:(?:[0-9a-f]{1,4}:){5}(?:(?:(?::[0-9a-f]{1,4}){1,2})|:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(?:(?:[0-9a-f]{1,4}:){4}(?:(?:(?::[0-9a-f]{1,4}){1,3})|(?:(?::[0-9a-f]{1,4})?:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){3}(?:(?:(?::[0-9a-f]{1,4}){1,4})|(?:(?::[0-9a-f]{1,4}){0,2}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){2}(?:(?:(?::[0-9a-f]{1,4}){1,5})|(?:(?::[0-9a-f]{1,4}){0,3}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){1}(?:(?:(?::[0-9a-f]{1,4}){1,6})|(?:(?::[0-9a-f]{1,4}){0,4}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?::(?:(?:(?::[0-9a-f]{1,4}){1,7})|(?:(?::[0-9a-f]{1,4}){0,5}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(?:%.+)?\s*$/i,
        regex,
        uuid: UUID,
        "json-pointer": JSON_POINTER,
        "json-pointer-uri-fragment": JSON_POINTER_URI_FRAGMENT,
        "relative-json-pointer": RELATIVE_JSON_POINTER
    };
    function isLeapYear(year) {
        return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    }
    function date(str) {
        var matches = str.match(DATE);
        if (!matches) return false;
        var year = +matches[1];
        var month = +matches[2];
        var day = +matches[3];
        return month >= 1 && month <= 12 && day >= 1 && day <= (month == 2 && isLeapYear(year) ? 29 : DAYS[month]);
    }
    function time(str, full) {
        var matches = str.match(TIME);
        if (!matches) return false;
        var hour = matches[1];
        var minute = matches[2];
        var second = matches[3];
        var timeZone = matches[5];
        return (hour <= 23 && minute <= 59 && second <= 59 || hour == 23 && minute == 59 && second == 60) && (!full || timeZone);
    }
    var DATE_TIME_SEPARATOR = /t|\s/i;
    function date_time(str) {
        var dateTime = str.split(DATE_TIME_SEPARATOR);
        return dateTime.length == 2 && date(dateTime[0]) && time(dateTime[1], true);
    }
    var NOT_URI_FRAGMENT = /\/|:/;
    function uri(str) {
        return NOT_URI_FRAGMENT.test(str) && URI.test(str);
    }
    var Z_ANCHOR = /[^\\]\\Z/;
    function regex(str) {
        if (Z_ANCHOR.test(str)) return false;
        try {
            new RegExp(str);
            return true;
        } catch (e) {
            return false;
        }
    }
    return formats_1;
}

var ref;

var hasRequiredRef;

function requireRef() {
    if (hasRequiredRef) return ref;
    hasRequiredRef = 1;
    ref = function generate_ref(it, $keyword, $ruleType) {
        var out = " ";
        var $lvl = it.level;
        var $dataLvl = it.dataLevel;
        var $schema = it.schema[$keyword];
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        var $breakOnError = !it.opts.allErrors;
        var $data = "data" + ($dataLvl || "");
        var $valid = "valid" + $lvl;
        var $async, $refCode;
        if ($schema == "#" || $schema == "#/") {
            if (it.isRoot) {
                $async = it.async;
                $refCode = "validate";
            } else {
                $async = it.root.schema.$async === true;
                $refCode = "root.refVal[0]";
            }
        } else {
            var $refVal = it.resolveRef(it.baseId, $schema, it.isRoot);
            if ($refVal === undefined) {
                var $message = it.MissingRefError.message(it.baseId, $schema);
                if (it.opts.missingRefs == "fail") {
                    it.logger.error($message);
                    var $$outStack = $$outStack || [];
                    $$outStack.push(out);
                    out = "";
                    if (it.createErrors !== false) {
                        out += " { keyword: '" + "$ref" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { ref: '" + it.util.escapeQuotes($schema) + "' } ";
                        if (it.opts.messages !== false) {
                            out += " , message: 'can\\'t resolve reference " + it.util.escapeQuotes($schema) + "' ";
                        }
                        if (it.opts.verbose) {
                            out += " , schema: " + it.util.toQuotedString($schema) + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                        }
                        out += " } ";
                    } else {
                        out += " {} ";
                    }
                    var __err = out;
                    out = $$outStack.pop();
                    if (!it.compositeRule && $breakOnError) {
                        if (it.async) {
                            out += " throw new ValidationError([" + __err + "]); ";
                        } else {
                            out += " validate.errors = [" + __err + "]; return false; ";
                        }
                    } else {
                        out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                    }
                    if ($breakOnError) {
                        out += " if (false) { ";
                    }
                } else if (it.opts.missingRefs == "ignore") {
                    it.logger.warn($message);
                    if ($breakOnError) {
                        out += " if (true) { ";
                    }
                } else {
                    throw new it.MissingRefError(it.baseId, $schema, $message);
                }
            } else if ($refVal.inline) {
                var $it = it.util.copy(it);
                $it.level++;
                var $nextValid = "valid" + $it.level;
                $it.schema = $refVal.schema;
                $it.schemaPath = "";
                $it.errSchemaPath = $schema;
                var $code = it.validate($it).replace(/validate\.schema/g, $refVal.code);
                out += " " + $code + " ";
                if ($breakOnError) {
                    out += " if (" + $nextValid + ") { ";
                }
            } else {
                $async = $refVal.$async === true || it.async && $refVal.$async !== false;
                $refCode = $refVal.code;
            }
        }
        if ($refCode) {
            var $$outStack = $$outStack || [];
            $$outStack.push(out);
            out = "";
            if (it.opts.passContext) {
                out += " " + $refCode + ".call(this, ";
            } else {
                out += " " + $refCode + "( ";
            }
            out += " " + $data + ", (dataPath || '')";
            if (it.errorPath != '""') {
                out += " + " + it.errorPath;
            }
            var $parentData = $dataLvl ? "data" + ($dataLvl - 1 || "") : "parentData", $parentDataProperty = $dataLvl ? it.dataPathArr[$dataLvl] : "parentDataProperty";
            out += " , " + $parentData + " , " + $parentDataProperty + ", rootData)  ";
            var __callValidate = out;
            out = $$outStack.pop();
            if ($async) {
                if (!it.async) throw new Error("async schema referenced by sync schema");
                if ($breakOnError) {
                    out += " var " + $valid + "; ";
                }
                out += " try { await " + __callValidate + "; ";
                if ($breakOnError) {
                    out += " " + $valid + " = true; ";
                }
                out += " } catch (e) { if (!(e instanceof ValidationError)) throw e; if (vErrors === null) vErrors = e.errors; else vErrors = vErrors.concat(e.errors); errors = vErrors.length; ";
                if ($breakOnError) {
                    out += " " + $valid + " = false; ";
                }
                out += " } ";
                if ($breakOnError) {
                    out += " if (" + $valid + ") { ";
                }
            } else {
                out += " if (!" + __callValidate + ") { if (vErrors === null) vErrors = " + $refCode + ".errors; else vErrors = vErrors.concat(" + $refCode + ".errors); errors = vErrors.length; } ";
                if ($breakOnError) {
                    out += " else { ";
                }
            }
        }
        return out;
    };
    return ref;
}

var allOf;

var hasRequiredAllOf;

function requireAllOf() {
    if (hasRequiredAllOf) return allOf;
    hasRequiredAllOf = 1;
    allOf = function generate_allOf(it, $keyword, $ruleType) {
        var out = " ";
        var $schema = it.schema[$keyword];
        var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        var $breakOnError = !it.opts.allErrors;
        var $it = it.util.copy(it);
        var $closingBraces = "";
        $it.level++;
        var $nextValid = "valid" + $it.level;
        var $currentBaseId = $it.baseId, $allSchemasEmpty = true;
        var arr1 = $schema;
        if (arr1) {
            var $sch, $i = -1, l1 = arr1.length - 1;
            while ($i < l1) {
                $sch = arr1[$i += 1];
                if (it.opts.strictKeywords ? typeof $sch == "object" && Object.keys($sch).length > 0 || $sch === false : it.util.schemaHasRules($sch, it.RULES.all)) {
                    $allSchemasEmpty = false;
                    $it.schema = $sch;
                    $it.schemaPath = $schemaPath + "[" + $i + "]";
                    $it.errSchemaPath = $errSchemaPath + "/" + $i;
                    out += "  " + it.validate($it) + " ";
                    $it.baseId = $currentBaseId;
                    if ($breakOnError) {
                        out += " if (" + $nextValid + ") { ";
                        $closingBraces += "}";
                    }
                }
            }
        }
        if ($breakOnError) {
            if ($allSchemasEmpty) {
                out += " if (true) { ";
            } else {
                out += " " + $closingBraces.slice(0, -1) + " ";
            }
        }
        return out;
    };
    return allOf;
}

var anyOf;

var hasRequiredAnyOf;

function requireAnyOf() {
    if (hasRequiredAnyOf) return anyOf;
    hasRequiredAnyOf = 1;
    anyOf = function generate_anyOf(it, $keyword, $ruleType) {
        var out = " ";
        var $lvl = it.level;
        var $dataLvl = it.dataLevel;
        var $schema = it.schema[$keyword];
        var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        var $breakOnError = !it.opts.allErrors;
        var $data = "data" + ($dataLvl || "");
        var $valid = "valid" + $lvl;
        var $errs = "errs__" + $lvl;
        var $it = it.util.copy(it);
        var $closingBraces = "";
        $it.level++;
        var $nextValid = "valid" + $it.level;
        var $noEmptySchema = $schema.every(function($sch) {
            return it.opts.strictKeywords ? typeof $sch == "object" && Object.keys($sch).length > 0 || $sch === false : it.util.schemaHasRules($sch, it.RULES.all);
        });
        if ($noEmptySchema) {
            var $currentBaseId = $it.baseId;
            out += " var " + $errs + " = errors; var " + $valid + " = false;  ";
            var $wasComposite = it.compositeRule;
            it.compositeRule = $it.compositeRule = true;
            var arr1 = $schema;
            if (arr1) {
                var $sch, $i = -1, l1 = arr1.length - 1;
                while ($i < l1) {
                    $sch = arr1[$i += 1];
                    $it.schema = $sch;
                    $it.schemaPath = $schemaPath + "[" + $i + "]";
                    $it.errSchemaPath = $errSchemaPath + "/" + $i;
                    out += "  " + it.validate($it) + " ";
                    $it.baseId = $currentBaseId;
                    out += " " + $valid + " = " + $valid + " || " + $nextValid + "; if (!" + $valid + ") { ";
                    $closingBraces += "}";
                }
            }
            it.compositeRule = $it.compositeRule = $wasComposite;
            out += " " + $closingBraces + " if (!" + $valid + ") {   var err =   ";
            if (it.createErrors !== false) {
                out += " { keyword: '" + "anyOf" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: {} ";
                if (it.opts.messages !== false) {
                    out += " , message: 'should match some schema in anyOf' ";
                }
                if (it.opts.verbose) {
                    out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                }
                out += " } ";
            } else {
                out += " {} ";
            }
            out += ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
            if (!it.compositeRule && $breakOnError) {
                if (it.async) {
                    out += " throw new ValidationError(vErrors); ";
                } else {
                    out += " validate.errors = vErrors; return false; ";
                }
            }
            out += " } else {  errors = " + $errs + "; if (vErrors !== null) { if (" + $errs + ") vErrors.length = " + $errs + "; else vErrors = null; } ";
            if (it.opts.allErrors) {
                out += " } ";
            }
        } else {
            if ($breakOnError) {
                out += " if (true) { ";
            }
        }
        return out;
    };
    return anyOf;
}

var comment;

var hasRequiredComment;

function requireComment() {
    if (hasRequiredComment) return comment;
    hasRequiredComment = 1;
    comment = function generate_comment(it, $keyword, $ruleType) {
        var out = " ";
        var $schema = it.schema[$keyword];
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        !it.opts.allErrors;
        var $comment = it.util.toQuotedString($schema);
        if (it.opts.$comment === true) {
            out += " console.log(" + $comment + ");";
        } else if (typeof it.opts.$comment == "function") {
            out += " self._opts.$comment(" + $comment + ", " + it.util.toQuotedString($errSchemaPath) + ", validate.root.schema);";
        }
        return out;
    };
    return comment;
}

var _const;

var hasRequired_const;

function require_const() {
    if (hasRequired_const) return _const;
    hasRequired_const = 1;
    _const = function generate_const(it, $keyword, $ruleType) {
        var out = " ";
        var $lvl = it.level;
        var $dataLvl = it.dataLevel;
        var $schema = it.schema[$keyword];
        var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        var $breakOnError = !it.opts.allErrors;
        var $data = "data" + ($dataLvl || "");
        var $valid = "valid" + $lvl;
        var $isData = it.opts.$data && $schema && $schema.$data;
        if ($isData) {
            out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
        }
        if (!$isData) {
            out += " var schema" + $lvl + " = validate.schema" + $schemaPath + ";";
        }
        out += "var " + $valid + " = equal(" + $data + ", schema" + $lvl + "); if (!" + $valid + ") {   ";
        var $$outStack = $$outStack || [];
        $$outStack.push(out);
        out = "";
        if (it.createErrors !== false) {
            out += " { keyword: '" + "const" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { allowedValue: schema" + $lvl + " } ";
            if (it.opts.messages !== false) {
                out += " , message: 'should be equal to constant' ";
            }
            if (it.opts.verbose) {
                out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
            }
            out += " } ";
        } else {
            out += " {} ";
        }
        var __err = out;
        out = $$outStack.pop();
        if (!it.compositeRule && $breakOnError) {
            if (it.async) {
                out += " throw new ValidationError([" + __err + "]); ";
            } else {
                out += " validate.errors = [" + __err + "]; return false; ";
            }
        } else {
            out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
        }
        out += " }";
        if ($breakOnError) {
            out += " else { ";
        }
        return out;
    };
    return _const;
}

var contains;

var hasRequiredContains;

function requireContains() {
    if (hasRequiredContains) return contains;
    hasRequiredContains = 1;
    contains = function generate_contains(it, $keyword, $ruleType) {
        var out = " ";
        var $lvl = it.level;
        var $dataLvl = it.dataLevel;
        var $schema = it.schema[$keyword];
        var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        var $breakOnError = !it.opts.allErrors;
        var $data = "data" + ($dataLvl || "");
        var $valid = "valid" + $lvl;
        var $errs = "errs__" + $lvl;
        var $it = it.util.copy(it);
        var $closingBraces = "";
        $it.level++;
        var $nextValid = "valid" + $it.level;
        var $idx = "i" + $lvl, $dataNxt = $it.dataLevel = it.dataLevel + 1, $nextData = "data" + $dataNxt, $currentBaseId = it.baseId, $nonEmptySchema = it.opts.strictKeywords ? typeof $schema == "object" && Object.keys($schema).length > 0 || $schema === false : it.util.schemaHasRules($schema, it.RULES.all);
        out += "var " + $errs + " = errors;var " + $valid + ";";
        if ($nonEmptySchema) {
            var $wasComposite = it.compositeRule;
            it.compositeRule = $it.compositeRule = true;
            $it.schema = $schema;
            $it.schemaPath = $schemaPath;
            $it.errSchemaPath = $errSchemaPath;
            out += " var " + $nextValid + " = false; for (var " + $idx + " = 0; " + $idx + " < " + $data + ".length; " + $idx + "++) { ";
            $it.errorPath = it.util.getPathExpr(it.errorPath, $idx, it.opts.jsonPointers, true);
            var $passData = $data + "[" + $idx + "]";
            $it.dataPathArr[$dataNxt] = $idx;
            var $code = it.validate($it);
            $it.baseId = $currentBaseId;
            if (it.util.varOccurences($code, $nextData) < 2) {
                out += " " + it.util.varReplace($code, $nextData, $passData) + " ";
            } else {
                out += " var " + $nextData + " = " + $passData + "; " + $code + " ";
            }
            out += " if (" + $nextValid + ") break; }  ";
            it.compositeRule = $it.compositeRule = $wasComposite;
            out += " " + $closingBraces + " if (!" + $nextValid + ") {";
        } else {
            out += " if (" + $data + ".length == 0) {";
        }
        var $$outStack = $$outStack || [];
        $$outStack.push(out);
        out = "";
        if (it.createErrors !== false) {
            out += " { keyword: '" + "contains" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: {} ";
            if (it.opts.messages !== false) {
                out += " , message: 'should contain a valid item' ";
            }
            if (it.opts.verbose) {
                out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
            }
            out += " } ";
        } else {
            out += " {} ";
        }
        var __err = out;
        out = $$outStack.pop();
        if (!it.compositeRule && $breakOnError) {
            if (it.async) {
                out += " throw new ValidationError([" + __err + "]); ";
            } else {
                out += " validate.errors = [" + __err + "]; return false; ";
            }
        } else {
            out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
        }
        out += " } else { ";
        if ($nonEmptySchema) {
            out += "  errors = " + $errs + "; if (vErrors !== null) { if (" + $errs + ") vErrors.length = " + $errs + "; else vErrors = null; } ";
        }
        if (it.opts.allErrors) {
            out += " } ";
        }
        return out;
    };
    return contains;
}

var dependencies;

var hasRequiredDependencies;

function requireDependencies() {
    if (hasRequiredDependencies) return dependencies;
    hasRequiredDependencies = 1;
    dependencies = function generate_dependencies(it, $keyword, $ruleType) {
        var out = " ";
        var $lvl = it.level;
        var $dataLvl = it.dataLevel;
        var $schema = it.schema[$keyword];
        var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        var $breakOnError = !it.opts.allErrors;
        var $data = "data" + ($dataLvl || "");
        var $errs = "errs__" + $lvl;
        var $it = it.util.copy(it);
        var $closingBraces = "";
        $it.level++;
        var $nextValid = "valid" + $it.level;
        var $schemaDeps = {}, $propertyDeps = {}, $ownProperties = it.opts.ownProperties;
        for ($property in $schema) {
            if ($property == "__proto__") continue;
            var $sch = $schema[$property];
            var $deps = Array.isArray($sch) ? $propertyDeps : $schemaDeps;
            $deps[$property] = $sch;
        }
        out += "var " + $errs + " = errors;";
        var $currentErrorPath = it.errorPath;
        out += "var missing" + $lvl + ";";
        for (var $property in $propertyDeps) {
            $deps = $propertyDeps[$property];
            if ($deps.length) {
                out += " if ( " + $data + it.util.getProperty($property) + " !== undefined ";
                if ($ownProperties) {
                    out += " && Object.prototype.hasOwnProperty.call(" + $data + ", '" + it.util.escapeQuotes($property) + "') ";
                }
                if ($breakOnError) {
                    out += " && ( ";
                    var arr1 = $deps;
                    if (arr1) {
                        var $propertyKey, $i = -1, l1 = arr1.length - 1;
                        while ($i < l1) {
                            $propertyKey = arr1[$i += 1];
                            if ($i) {
                                out += " || ";
                            }
                            var $prop = it.util.getProperty($propertyKey), $useData = $data + $prop;
                            out += " ( ( " + $useData + " === undefined ";
                            if ($ownProperties) {
                                out += " || ! Object.prototype.hasOwnProperty.call(" + $data + ", '" + it.util.escapeQuotes($propertyKey) + "') ";
                            }
                            out += ") && (missing" + $lvl + " = " + it.util.toQuotedString(it.opts.jsonPointers ? $propertyKey : $prop) + ") ) ";
                        }
                    }
                    out += ")) {  ";
                    var $propertyPath = "missing" + $lvl, $missingProperty = "' + " + $propertyPath + " + '";
                    if (it.opts._errorDataPathProperty) {
                        it.errorPath = it.opts.jsonPointers ? it.util.getPathExpr($currentErrorPath, $propertyPath, true) : $currentErrorPath + " + " + $propertyPath;
                    }
                    var $$outStack = $$outStack || [];
                    $$outStack.push(out);
                    out = "";
                    if (it.createErrors !== false) {
                        out += " { keyword: '" + "dependencies" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { property: '" + it.util.escapeQuotes($property) + "', missingProperty: '" + $missingProperty + "', depsCount: " + $deps.length + ", deps: '" + it.util.escapeQuotes($deps.length == 1 ? $deps[0] : $deps.join(", ")) + "' } ";
                        if (it.opts.messages !== false) {
                            out += " , message: 'should have ";
                            if ($deps.length == 1) {
                                out += "property " + it.util.escapeQuotes($deps[0]);
                            } else {
                                out += "properties " + it.util.escapeQuotes($deps.join(", "));
                            }
                            out += " when property " + it.util.escapeQuotes($property) + " is present' ";
                        }
                        if (it.opts.verbose) {
                            out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                        }
                        out += " } ";
                    } else {
                        out += " {} ";
                    }
                    var __err = out;
                    out = $$outStack.pop();
                    if (!it.compositeRule && $breakOnError) {
                        if (it.async) {
                            out += " throw new ValidationError([" + __err + "]); ";
                        } else {
                            out += " validate.errors = [" + __err + "]; return false; ";
                        }
                    } else {
                        out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                    }
                } else {
                    out += " ) { ";
                    var arr2 = $deps;
                    if (arr2) {
                        var $propertyKey, i2 = -1, l2 = arr2.length - 1;
                        while (i2 < l2) {
                            $propertyKey = arr2[i2 += 1];
                            var $prop = it.util.getProperty($propertyKey), $missingProperty = it.util.escapeQuotes($propertyKey), $useData = $data + $prop;
                            if (it.opts._errorDataPathProperty) {
                                it.errorPath = it.util.getPath($currentErrorPath, $propertyKey, it.opts.jsonPointers);
                            }
                            out += " if ( " + $useData + " === undefined ";
                            if ($ownProperties) {
                                out += " || ! Object.prototype.hasOwnProperty.call(" + $data + ", '" + it.util.escapeQuotes($propertyKey) + "') ";
                            }
                            out += ") {  var err =   ";
                            if (it.createErrors !== false) {
                                out += " { keyword: '" + "dependencies" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { property: '" + it.util.escapeQuotes($property) + "', missingProperty: '" + $missingProperty + "', depsCount: " + $deps.length + ", deps: '" + it.util.escapeQuotes($deps.length == 1 ? $deps[0] : $deps.join(", ")) + "' } ";
                                if (it.opts.messages !== false) {
                                    out += " , message: 'should have ";
                                    if ($deps.length == 1) {
                                        out += "property " + it.util.escapeQuotes($deps[0]);
                                    } else {
                                        out += "properties " + it.util.escapeQuotes($deps.join(", "));
                                    }
                                    out += " when property " + it.util.escapeQuotes($property) + " is present' ";
                                }
                                if (it.opts.verbose) {
                                    out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                                }
                                out += " } ";
                            } else {
                                out += " {} ";
                            }
                            out += ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; } ";
                        }
                    }
                }
                out += " }   ";
                if ($breakOnError) {
                    $closingBraces += "}";
                    out += " else { ";
                }
            }
        }
        it.errorPath = $currentErrorPath;
        var $currentBaseId = $it.baseId;
        for (var $property in $schemaDeps) {
            var $sch = $schemaDeps[$property];
            if (it.opts.strictKeywords ? typeof $sch == "object" && Object.keys($sch).length > 0 || $sch === false : it.util.schemaHasRules($sch, it.RULES.all)) {
                out += " " + $nextValid + " = true; if ( " + $data + it.util.getProperty($property) + " !== undefined ";
                if ($ownProperties) {
                    out += " && Object.prototype.hasOwnProperty.call(" + $data + ", '" + it.util.escapeQuotes($property) + "') ";
                }
                out += ") { ";
                $it.schema = $sch;
                $it.schemaPath = $schemaPath + it.util.getProperty($property);
                $it.errSchemaPath = $errSchemaPath + "/" + it.util.escapeFragment($property);
                out += "  " + it.validate($it) + " ";
                $it.baseId = $currentBaseId;
                out += " }  ";
                if ($breakOnError) {
                    out += " if (" + $nextValid + ") { ";
                    $closingBraces += "}";
                }
            }
        }
        if ($breakOnError) {
            out += "   " + $closingBraces + " if (" + $errs + " == errors) {";
        }
        return out;
    };
    return dependencies;
}

var _enum;

var hasRequired_enum;

function require_enum() {
    if (hasRequired_enum) return _enum;
    hasRequired_enum = 1;
    _enum = function generate_enum(it, $keyword, $ruleType) {
        var out = " ";
        var $lvl = it.level;
        var $dataLvl = it.dataLevel;
        var $schema = it.schema[$keyword];
        var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        var $breakOnError = !it.opts.allErrors;
        var $data = "data" + ($dataLvl || "");
        var $valid = "valid" + $lvl;
        var $isData = it.opts.$data && $schema && $schema.$data;
        if ($isData) {
            out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
        }
        var $i = "i" + $lvl, $vSchema = "schema" + $lvl;
        if (!$isData) {
            out += " var " + $vSchema + " = validate.schema" + $schemaPath + ";";
        }
        out += "var " + $valid + ";";
        if ($isData) {
            out += " if (schema" + $lvl + " === undefined) " + $valid + " = true; else if (!Array.isArray(schema" + $lvl + ")) " + $valid + " = false; else {";
        }
        out += "" + $valid + " = false;for (var " + $i + "=0; " + $i + "<" + $vSchema + ".length; " + $i + "++) if (equal(" + $data + ", " + $vSchema + "[" + $i + "])) { " + $valid + " = true; break; }";
        if ($isData) {
            out += "  }  ";
        }
        out += " if (!" + $valid + ") {   ";
        var $$outStack = $$outStack || [];
        $$outStack.push(out);
        out = "";
        if (it.createErrors !== false) {
            out += " { keyword: '" + "enum" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { allowedValues: schema" + $lvl + " } ";
            if (it.opts.messages !== false) {
                out += " , message: 'should be equal to one of the allowed values' ";
            }
            if (it.opts.verbose) {
                out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
            }
            out += " } ";
        } else {
            out += " {} ";
        }
        var __err = out;
        out = $$outStack.pop();
        if (!it.compositeRule && $breakOnError) {
            if (it.async) {
                out += " throw new ValidationError([" + __err + "]); ";
            } else {
                out += " validate.errors = [" + __err + "]; return false; ";
            }
        } else {
            out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
        }
        out += " }";
        if ($breakOnError) {
            out += " else { ";
        }
        return out;
    };
    return _enum;
}

var format;

var hasRequiredFormat;

function requireFormat() {
    if (hasRequiredFormat) return format;
    hasRequiredFormat = 1;
    format = function generate_format(it, $keyword, $ruleType) {
        var out = " ";
        var $lvl = it.level;
        var $dataLvl = it.dataLevel;
        var $schema = it.schema[$keyword];
        var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        var $breakOnError = !it.opts.allErrors;
        var $data = "data" + ($dataLvl || "");
        if (it.opts.format === false) {
            if ($breakOnError) {
                out += " if (true) { ";
            }
            return out;
        }
        var $isData = it.opts.$data && $schema && $schema.$data, $schemaValue;
        if ($isData) {
            out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
            $schemaValue = "schema" + $lvl;
        } else {
            $schemaValue = $schema;
        }
        var $unknownFormats = it.opts.unknownFormats, $allowUnknown = Array.isArray($unknownFormats);
        if ($isData) {
            var $format = "format" + $lvl, $isObject = "isObject" + $lvl, $formatType = "formatType" + $lvl;
            out += " var " + $format + " = formats[" + $schemaValue + "]; var " + $isObject + " = typeof " + $format + " == 'object' && !(" + $format + " instanceof RegExp) && " + $format + ".validate; var " + $formatType + " = " + $isObject + " && " + $format + ".type || 'string'; if (" + $isObject + ") { ";
            if (it.async) {
                out += " var async" + $lvl + " = " + $format + ".async; ";
            }
            out += " " + $format + " = " + $format + ".validate; } if (  ";
            if ($isData) {
                out += " (" + $schemaValue + " !== undefined && typeof " + $schemaValue + " != 'string') || ";
            }
            out += " (";
            if ($unknownFormats != "ignore") {
                out += " (" + $schemaValue + " && !" + $format + " ";
                if ($allowUnknown) {
                    out += " && self._opts.unknownFormats.indexOf(" + $schemaValue + ") == -1 ";
                }
                out += ") || ";
            }
            out += " (" + $format + " && " + $formatType + " == '" + $ruleType + "' && !(typeof " + $format + " == 'function' ? ";
            if (it.async) {
                out += " (async" + $lvl + " ? await " + $format + "(" + $data + ") : " + $format + "(" + $data + ")) ";
            } else {
                out += " " + $format + "(" + $data + ") ";
            }
            out += " : " + $format + ".test(" + $data + "))))) {";
        } else {
            var $format = it.formats[$schema];
            if (!$format) {
                if ($unknownFormats == "ignore") {
                    it.logger.warn('unknown format "' + $schema + '" ignored in schema at path "' + it.errSchemaPath + '"');
                    if ($breakOnError) {
                        out += " if (true) { ";
                    }
                    return out;
                } else if ($allowUnknown && $unknownFormats.indexOf($schema) >= 0) {
                    if ($breakOnError) {
                        out += " if (true) { ";
                    }
                    return out;
                } else {
                    throw new Error('unknown format "' + $schema + '" is used in schema at path "' + it.errSchemaPath + '"');
                }
            }
            var $isObject = typeof $format == "object" && !($format instanceof RegExp) && $format.validate;
            var $formatType = $isObject && $format.type || "string";
            if ($isObject) {
                var $async = $format.async === true;
                $format = $format.validate;
            }
            if ($formatType != $ruleType) {
                if ($breakOnError) {
                    out += " if (true) { ";
                }
                return out;
            }
            if ($async) {
                if (!it.async) throw new Error("async format in sync schema");
                var $formatRef = "formats" + it.util.getProperty($schema) + ".validate";
                out += " if (!(await " + $formatRef + "(" + $data + "))) { ";
            } else {
                out += " if (! ";
                var $formatRef = "formats" + it.util.getProperty($schema);
                if ($isObject) $formatRef += ".validate";
                if (typeof $format == "function") {
                    out += " " + $formatRef + "(" + $data + ") ";
                } else {
                    out += " " + $formatRef + ".test(" + $data + ") ";
                }
                out += ") { ";
            }
        }
        var $$outStack = $$outStack || [];
        $$outStack.push(out);
        out = "";
        if (it.createErrors !== false) {
            out += " { keyword: '" + "format" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { format:  ";
            if ($isData) {
                out += "" + $schemaValue;
            } else {
                out += "" + it.util.toQuotedString($schema);
            }
            out += "  } ";
            if (it.opts.messages !== false) {
                out += " , message: 'should match format \"";
                if ($isData) {
                    out += "' + " + $schemaValue + " + '";
                } else {
                    out += "" + it.util.escapeQuotes($schema);
                }
                out += "\"' ";
            }
            if (it.opts.verbose) {
                out += " , schema:  ";
                if ($isData) {
                    out += "validate.schema" + $schemaPath;
                } else {
                    out += "" + it.util.toQuotedString($schema);
                }
                out += "         , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
            }
            out += " } ";
        } else {
            out += " {} ";
        }
        var __err = out;
        out = $$outStack.pop();
        if (!it.compositeRule && $breakOnError) {
            if (it.async) {
                out += " throw new ValidationError([" + __err + "]); ";
            } else {
                out += " validate.errors = [" + __err + "]; return false; ";
            }
        } else {
            out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
        }
        out += " } ";
        if ($breakOnError) {
            out += " else { ";
        }
        return out;
    };
    return format;
}

var _if;

var hasRequired_if;

function require_if() {
    if (hasRequired_if) return _if;
    hasRequired_if = 1;
    _if = function generate_if(it, $keyword, $ruleType) {
        var out = " ";
        var $lvl = it.level;
        var $dataLvl = it.dataLevel;
        var $schema = it.schema[$keyword];
        var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        var $breakOnError = !it.opts.allErrors;
        var $data = "data" + ($dataLvl || "");
        var $valid = "valid" + $lvl;
        var $errs = "errs__" + $lvl;
        var $it = it.util.copy(it);
        $it.level++;
        var $nextValid = "valid" + $it.level;
        var $thenSch = it.schema["then"], $elseSch = it.schema["else"], $thenPresent = $thenSch !== undefined && (it.opts.strictKeywords ? typeof $thenSch == "object" && Object.keys($thenSch).length > 0 || $thenSch === false : it.util.schemaHasRules($thenSch, it.RULES.all)), $elsePresent = $elseSch !== undefined && (it.opts.strictKeywords ? typeof $elseSch == "object" && Object.keys($elseSch).length > 0 || $elseSch === false : it.util.schemaHasRules($elseSch, it.RULES.all)), $currentBaseId = $it.baseId;
        if ($thenPresent || $elsePresent) {
            var $ifClause;
            $it.createErrors = false;
            $it.schema = $schema;
            $it.schemaPath = $schemaPath;
            $it.errSchemaPath = $errSchemaPath;
            out += " var " + $errs + " = errors; var " + $valid + " = true;  ";
            var $wasComposite = it.compositeRule;
            it.compositeRule = $it.compositeRule = true;
            out += "  " + it.validate($it) + " ";
            $it.baseId = $currentBaseId;
            $it.createErrors = true;
            out += "  errors = " + $errs + "; if (vErrors !== null) { if (" + $errs + ") vErrors.length = " + $errs + "; else vErrors = null; }  ";
            it.compositeRule = $it.compositeRule = $wasComposite;
            if ($thenPresent) {
                out += " if (" + $nextValid + ") {  ";
                $it.schema = it.schema["then"];
                $it.schemaPath = it.schemaPath + ".then";
                $it.errSchemaPath = it.errSchemaPath + "/then";
                out += "  " + it.validate($it) + " ";
                $it.baseId = $currentBaseId;
                out += " " + $valid + " = " + $nextValid + "; ";
                if ($thenPresent && $elsePresent) {
                    $ifClause = "ifClause" + $lvl;
                    out += " var " + $ifClause + " = 'then'; ";
                } else {
                    $ifClause = "'then'";
                }
                out += " } ";
                if ($elsePresent) {
                    out += " else { ";
                }
            } else {
                out += " if (!" + $nextValid + ") { ";
            }
            if ($elsePresent) {
                $it.schema = it.schema["else"];
                $it.schemaPath = it.schemaPath + ".else";
                $it.errSchemaPath = it.errSchemaPath + "/else";
                out += "  " + it.validate($it) + " ";
                $it.baseId = $currentBaseId;
                out += " " + $valid + " = " + $nextValid + "; ";
                if ($thenPresent && $elsePresent) {
                    $ifClause = "ifClause" + $lvl;
                    out += " var " + $ifClause + " = 'else'; ";
                } else {
                    $ifClause = "'else'";
                }
                out += " } ";
            }
            out += " if (!" + $valid + ") {   var err =   ";
            if (it.createErrors !== false) {
                out += " { keyword: '" + "if" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { failingKeyword: " + $ifClause + " } ";
                if (it.opts.messages !== false) {
                    out += " , message: 'should match \"' + " + $ifClause + " + '\" schema' ";
                }
                if (it.opts.verbose) {
                    out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                }
                out += " } ";
            } else {
                out += " {} ";
            }
            out += ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
            if (!it.compositeRule && $breakOnError) {
                if (it.async) {
                    out += " throw new ValidationError(vErrors); ";
                } else {
                    out += " validate.errors = vErrors; return false; ";
                }
            }
            out += " }   ";
            if ($breakOnError) {
                out += " else { ";
            }
        } else {
            if ($breakOnError) {
                out += " if (true) { ";
            }
        }
        return out;
    };
    return _if;
}

var items;

var hasRequiredItems;

function requireItems() {
    if (hasRequiredItems) return items;
    hasRequiredItems = 1;
    items = function generate_items(it, $keyword, $ruleType) {
        var out = " ";
        var $lvl = it.level;
        var $dataLvl = it.dataLevel;
        var $schema = it.schema[$keyword];
        var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        var $breakOnError = !it.opts.allErrors;
        var $data = "data" + ($dataLvl || "");
        var $valid = "valid" + $lvl;
        var $errs = "errs__" + $lvl;
        var $it = it.util.copy(it);
        var $closingBraces = "";
        $it.level++;
        var $nextValid = "valid" + $it.level;
        var $idx = "i" + $lvl, $dataNxt = $it.dataLevel = it.dataLevel + 1, $nextData = "data" + $dataNxt, $currentBaseId = it.baseId;
        out += "var " + $errs + " = errors;var " + $valid + ";";
        if (Array.isArray($schema)) {
            var $additionalItems = it.schema.additionalItems;
            if ($additionalItems === false) {
                out += " " + $valid + " = " + $data + ".length <= " + $schema.length + "; ";
                var $currErrSchemaPath = $errSchemaPath;
                $errSchemaPath = it.errSchemaPath + "/additionalItems";
                out += "  if (!" + $valid + ") {   ";
                var $$outStack = $$outStack || [];
                $$outStack.push(out);
                out = "";
                if (it.createErrors !== false) {
                    out += " { keyword: '" + "additionalItems" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { limit: " + $schema.length + " } ";
                    if (it.opts.messages !== false) {
                        out += " , message: 'should NOT have more than " + $schema.length + " items' ";
                    }
                    if (it.opts.verbose) {
                        out += " , schema: false , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                    }
                    out += " } ";
                } else {
                    out += " {} ";
                }
                var __err = out;
                out = $$outStack.pop();
                if (!it.compositeRule && $breakOnError) {
                    if (it.async) {
                        out += " throw new ValidationError([" + __err + "]); ";
                    } else {
                        out += " validate.errors = [" + __err + "]; return false; ";
                    }
                } else {
                    out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                }
                out += " } ";
                $errSchemaPath = $currErrSchemaPath;
                if ($breakOnError) {
                    $closingBraces += "}";
                    out += " else { ";
                }
            }
            var arr1 = $schema;
            if (arr1) {
                var $sch, $i = -1, l1 = arr1.length - 1;
                while ($i < l1) {
                    $sch = arr1[$i += 1];
                    if (it.opts.strictKeywords ? typeof $sch == "object" && Object.keys($sch).length > 0 || $sch === false : it.util.schemaHasRules($sch, it.RULES.all)) {
                        out += " " + $nextValid + " = true; if (" + $data + ".length > " + $i + ") { ";
                        var $passData = $data + "[" + $i + "]";
                        $it.schema = $sch;
                        $it.schemaPath = $schemaPath + "[" + $i + "]";
                        $it.errSchemaPath = $errSchemaPath + "/" + $i;
                        $it.errorPath = it.util.getPathExpr(it.errorPath, $i, it.opts.jsonPointers, true);
                        $it.dataPathArr[$dataNxt] = $i;
                        var $code = it.validate($it);
                        $it.baseId = $currentBaseId;
                        if (it.util.varOccurences($code, $nextData) < 2) {
                            out += " " + it.util.varReplace($code, $nextData, $passData) + " ";
                        } else {
                            out += " var " + $nextData + " = " + $passData + "; " + $code + " ";
                        }
                        out += " }  ";
                        if ($breakOnError) {
                            out += " if (" + $nextValid + ") { ";
                            $closingBraces += "}";
                        }
                    }
                }
            }
            if (typeof $additionalItems == "object" && (it.opts.strictKeywords ? typeof $additionalItems == "object" && Object.keys($additionalItems).length > 0 || $additionalItems === false : it.util.schemaHasRules($additionalItems, it.RULES.all))) {
                $it.schema = $additionalItems;
                $it.schemaPath = it.schemaPath + ".additionalItems";
                $it.errSchemaPath = it.errSchemaPath + "/additionalItems";
                out += " " + $nextValid + " = true; if (" + $data + ".length > " + $schema.length + ") {  for (var " + $idx + " = " + $schema.length + "; " + $idx + " < " + $data + ".length; " + $idx + "++) { ";
                $it.errorPath = it.util.getPathExpr(it.errorPath, $idx, it.opts.jsonPointers, true);
                var $passData = $data + "[" + $idx + "]";
                $it.dataPathArr[$dataNxt] = $idx;
                var $code = it.validate($it);
                $it.baseId = $currentBaseId;
                if (it.util.varOccurences($code, $nextData) < 2) {
                    out += " " + it.util.varReplace($code, $nextData, $passData) + " ";
                } else {
                    out += " var " + $nextData + " = " + $passData + "; " + $code + " ";
                }
                if ($breakOnError) {
                    out += " if (!" + $nextValid + ") break; ";
                }
                out += " } }  ";
                if ($breakOnError) {
                    out += " if (" + $nextValid + ") { ";
                    $closingBraces += "}";
                }
            }
        } else if (it.opts.strictKeywords ? typeof $schema == "object" && Object.keys($schema).length > 0 || $schema === false : it.util.schemaHasRules($schema, it.RULES.all)) {
            $it.schema = $schema;
            $it.schemaPath = $schemaPath;
            $it.errSchemaPath = $errSchemaPath;
            out += "  for (var " + $idx + " = " + 0 + "; " + $idx + " < " + $data + ".length; " + $idx + "++) { ";
            $it.errorPath = it.util.getPathExpr(it.errorPath, $idx, it.opts.jsonPointers, true);
            var $passData = $data + "[" + $idx + "]";
            $it.dataPathArr[$dataNxt] = $idx;
            var $code = it.validate($it);
            $it.baseId = $currentBaseId;
            if (it.util.varOccurences($code, $nextData) < 2) {
                out += " " + it.util.varReplace($code, $nextData, $passData) + " ";
            } else {
                out += " var " + $nextData + " = " + $passData + "; " + $code + " ";
            }
            if ($breakOnError) {
                out += " if (!" + $nextValid + ") break; ";
            }
            out += " }";
        }
        if ($breakOnError) {
            out += " " + $closingBraces + " if (" + $errs + " == errors) {";
        }
        return out;
    };
    return items;
}

var _limit;

var hasRequired_limit;

function require_limit() {
    if (hasRequired_limit) return _limit;
    hasRequired_limit = 1;
    _limit = function generate__limit(it, $keyword, $ruleType) {
        var out = " ";
        var $lvl = it.level;
        var $dataLvl = it.dataLevel;
        var $schema = it.schema[$keyword];
        var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        var $breakOnError = !it.opts.allErrors;
        var $errorKeyword;
        var $data = "data" + ($dataLvl || "");
        var $isData = it.opts.$data && $schema && $schema.$data, $schemaValue;
        if ($isData) {
            out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
            $schemaValue = "schema" + $lvl;
        } else {
            $schemaValue = $schema;
        }
        var $isMax = $keyword == "maximum", $exclusiveKeyword = $isMax ? "exclusiveMaximum" : "exclusiveMinimum", $schemaExcl = it.schema[$exclusiveKeyword], $isDataExcl = it.opts.$data && $schemaExcl && $schemaExcl.$data, $op = $isMax ? "<" : ">", $notOp = $isMax ? ">" : "<", $errorKeyword = undefined;
        if (!($isData || typeof $schema == "number" || $schema === undefined)) {
            throw new Error($keyword + " must be number");
        }
        if (!($isDataExcl || $schemaExcl === undefined || typeof $schemaExcl == "number" || typeof $schemaExcl == "boolean")) {
            throw new Error($exclusiveKeyword + " must be number or boolean");
        }
        if ($isDataExcl) {
            var $schemaValueExcl = it.util.getData($schemaExcl.$data, $dataLvl, it.dataPathArr), $exclusive = "exclusive" + $lvl, $exclType = "exclType" + $lvl, $exclIsNumber = "exclIsNumber" + $lvl, $opExpr = "op" + $lvl, $opStr = "' + " + $opExpr + " + '";
            out += " var schemaExcl" + $lvl + " = " + $schemaValueExcl + "; ";
            $schemaValueExcl = "schemaExcl" + $lvl;
            out += " var " + $exclusive + "; var " + $exclType + " = typeof " + $schemaValueExcl + "; if (" + $exclType + " != 'boolean' && " + $exclType + " != 'undefined' && " + $exclType + " != 'number') { ";
            var $errorKeyword = $exclusiveKeyword;
            var $$outStack = $$outStack || [];
            $$outStack.push(out);
            out = "";
            if (it.createErrors !== false) {
                out += " { keyword: '" + ($errorKeyword || "_exclusiveLimit") + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: {} ";
                if (it.opts.messages !== false) {
                    out += " , message: '" + $exclusiveKeyword + " should be boolean' ";
                }
                if (it.opts.verbose) {
                    out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                }
                out += " } ";
            } else {
                out += " {} ";
            }
            var __err = out;
            out = $$outStack.pop();
            if (!it.compositeRule && $breakOnError) {
                if (it.async) {
                    out += " throw new ValidationError([" + __err + "]); ";
                } else {
                    out += " validate.errors = [" + __err + "]; return false; ";
                }
            } else {
                out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
            }
            out += " } else if ( ";
            if ($isData) {
                out += " (" + $schemaValue + " !== undefined && typeof " + $schemaValue + " != 'number') || ";
            }
            out += " " + $exclType + " == 'number' ? ( (" + $exclusive + " = " + $schemaValue + " === undefined || " + $schemaValueExcl + " " + $op + "= " + $schemaValue + ") ? " + $data + " " + $notOp + "= " + $schemaValueExcl + " : " + $data + " " + $notOp + " " + $schemaValue + " ) : ( (" + $exclusive + " = " + $schemaValueExcl + " === true) ? " + $data + " " + $notOp + "= " + $schemaValue + " : " + $data + " " + $notOp + " " + $schemaValue + " ) || " + $data + " !== " + $data + ") { var op" + $lvl + " = " + $exclusive + " ? '" + $op + "' : '" + $op + "='; ";
            if ($schema === undefined) {
                $errorKeyword = $exclusiveKeyword;
                $errSchemaPath = it.errSchemaPath + "/" + $exclusiveKeyword;
                $schemaValue = $schemaValueExcl;
                $isData = $isDataExcl;
            }
        } else {
            var $exclIsNumber = typeof $schemaExcl == "number", $opStr = $op;
            if ($exclIsNumber && $isData) {
                var $opExpr = "'" + $opStr + "'";
                out += " if ( ";
                if ($isData) {
                    out += " (" + $schemaValue + " !== undefined && typeof " + $schemaValue + " != 'number') || ";
                }
                out += " ( " + $schemaValue + " === undefined || " + $schemaExcl + " " + $op + "= " + $schemaValue + " ? " + $data + " " + $notOp + "= " + $schemaExcl + " : " + $data + " " + $notOp + " " + $schemaValue + " ) || " + $data + " !== " + $data + ") { ";
            } else {
                if ($exclIsNumber && $schema === undefined) {
                    $exclusive = true;
                    $errorKeyword = $exclusiveKeyword;
                    $errSchemaPath = it.errSchemaPath + "/" + $exclusiveKeyword;
                    $schemaValue = $schemaExcl;
                    $notOp += "=";
                } else {
                    if ($exclIsNumber) $schemaValue = Math[$isMax ? "min" : "max"]($schemaExcl, $schema);
                    if ($schemaExcl === ($exclIsNumber ? $schemaValue : true)) {
                        $exclusive = true;
                        $errorKeyword = $exclusiveKeyword;
                        $errSchemaPath = it.errSchemaPath + "/" + $exclusiveKeyword;
                        $notOp += "=";
                    } else {
                        $exclusive = false;
                        $opStr += "=";
                    }
                }
                var $opExpr = "'" + $opStr + "'";
                out += " if ( ";
                if ($isData) {
                    out += " (" + $schemaValue + " !== undefined && typeof " + $schemaValue + " != 'number') || ";
                }
                out += " " + $data + " " + $notOp + " " + $schemaValue + " || " + $data + " !== " + $data + ") { ";
            }
        }
        $errorKeyword = $errorKeyword || $keyword;
        var $$outStack = $$outStack || [];
        $$outStack.push(out);
        out = "";
        if (it.createErrors !== false) {
            out += " { keyword: '" + ($errorKeyword || "_limit") + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { comparison: " + $opExpr + ", limit: " + $schemaValue + ", exclusive: " + $exclusive + " } ";
            if (it.opts.messages !== false) {
                out += " , message: 'should be " + $opStr + " ";
                if ($isData) {
                    out += "' + " + $schemaValue;
                } else {
                    out += "" + $schemaValue + "'";
                }
            }
            if (it.opts.verbose) {
                out += " , schema:  ";
                if ($isData) {
                    out += "validate.schema" + $schemaPath;
                } else {
                    out += "" + $schema;
                }
                out += "         , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
            }
            out += " } ";
        } else {
            out += " {} ";
        }
        var __err = out;
        out = $$outStack.pop();
        if (!it.compositeRule && $breakOnError) {
            if (it.async) {
                out += " throw new ValidationError([" + __err + "]); ";
            } else {
                out += " validate.errors = [" + __err + "]; return false; ";
            }
        } else {
            out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
        }
        out += " } ";
        if ($breakOnError) {
            out += " else { ";
        }
        return out;
    };
    return _limit;
}

var _limitItems;

var hasRequired_limitItems;

function require_limitItems() {
    if (hasRequired_limitItems) return _limitItems;
    hasRequired_limitItems = 1;
    _limitItems = function generate__limitItems(it, $keyword, $ruleType) {
        var out = " ";
        var $lvl = it.level;
        var $dataLvl = it.dataLevel;
        var $schema = it.schema[$keyword];
        var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        var $breakOnError = !it.opts.allErrors;
        var $errorKeyword;
        var $data = "data" + ($dataLvl || "");
        var $isData = it.opts.$data && $schema && $schema.$data, $schemaValue;
        if ($isData) {
            out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
            $schemaValue = "schema" + $lvl;
        } else {
            $schemaValue = $schema;
        }
        if (!($isData || typeof $schema == "number")) {
            throw new Error($keyword + " must be number");
        }
        var $op = $keyword == "maxItems" ? ">" : "<";
        out += "if ( ";
        if ($isData) {
            out += " (" + $schemaValue + " !== undefined && typeof " + $schemaValue + " != 'number') || ";
        }
        out += " " + $data + ".length " + $op + " " + $schemaValue + ") { ";
        var $errorKeyword = $keyword;
        var $$outStack = $$outStack || [];
        $$outStack.push(out);
        out = "";
        if (it.createErrors !== false) {
            out += " { keyword: '" + ($errorKeyword || "_limitItems") + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { limit: " + $schemaValue + " } ";
            if (it.opts.messages !== false) {
                out += " , message: 'should NOT have ";
                if ($keyword == "maxItems") {
                    out += "more";
                } else {
                    out += "fewer";
                }
                out += " than ";
                if ($isData) {
                    out += "' + " + $schemaValue + " + '";
                } else {
                    out += "" + $schema;
                }
                out += " items' ";
            }
            if (it.opts.verbose) {
                out += " , schema:  ";
                if ($isData) {
                    out += "validate.schema" + $schemaPath;
                } else {
                    out += "" + $schema;
                }
                out += "         , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
            }
            out += " } ";
        } else {
            out += " {} ";
        }
        var __err = out;
        out = $$outStack.pop();
        if (!it.compositeRule && $breakOnError) {
            if (it.async) {
                out += " throw new ValidationError([" + __err + "]); ";
            } else {
                out += " validate.errors = [" + __err + "]; return false; ";
            }
        } else {
            out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
        }
        out += "} ";
        if ($breakOnError) {
            out += " else { ";
        }
        return out;
    };
    return _limitItems;
}

var _limitLength;

var hasRequired_limitLength;

function require_limitLength() {
    if (hasRequired_limitLength) return _limitLength;
    hasRequired_limitLength = 1;
    _limitLength = function generate__limitLength(it, $keyword, $ruleType) {
        var out = " ";
        var $lvl = it.level;
        var $dataLvl = it.dataLevel;
        var $schema = it.schema[$keyword];
        var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        var $breakOnError = !it.opts.allErrors;
        var $errorKeyword;
        var $data = "data" + ($dataLvl || "");
        var $isData = it.opts.$data && $schema && $schema.$data, $schemaValue;
        if ($isData) {
            out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
            $schemaValue = "schema" + $lvl;
        } else {
            $schemaValue = $schema;
        }
        if (!($isData || typeof $schema == "number")) {
            throw new Error($keyword + " must be number");
        }
        var $op = $keyword == "maxLength" ? ">" : "<";
        out += "if ( ";
        if ($isData) {
            out += " (" + $schemaValue + " !== undefined && typeof " + $schemaValue + " != 'number') || ";
        }
        if (it.opts.unicode === false) {
            out += " " + $data + ".length ";
        } else {
            out += " ucs2length(" + $data + ") ";
        }
        out += " " + $op + " " + $schemaValue + ") { ";
        var $errorKeyword = $keyword;
        var $$outStack = $$outStack || [];
        $$outStack.push(out);
        out = "";
        if (it.createErrors !== false) {
            out += " { keyword: '" + ($errorKeyword || "_limitLength") + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { limit: " + $schemaValue + " } ";
            if (it.opts.messages !== false) {
                out += " , message: 'should NOT be ";
                if ($keyword == "maxLength") {
                    out += "longer";
                } else {
                    out += "shorter";
                }
                out += " than ";
                if ($isData) {
                    out += "' + " + $schemaValue + " + '";
                } else {
                    out += "" + $schema;
                }
                out += " characters' ";
            }
            if (it.opts.verbose) {
                out += " , schema:  ";
                if ($isData) {
                    out += "validate.schema" + $schemaPath;
                } else {
                    out += "" + $schema;
                }
                out += "         , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
            }
            out += " } ";
        } else {
            out += " {} ";
        }
        var __err = out;
        out = $$outStack.pop();
        if (!it.compositeRule && $breakOnError) {
            if (it.async) {
                out += " throw new ValidationError([" + __err + "]); ";
            } else {
                out += " validate.errors = [" + __err + "]; return false; ";
            }
        } else {
            out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
        }
        out += "} ";
        if ($breakOnError) {
            out += " else { ";
        }
        return out;
    };
    return _limitLength;
}

var _limitProperties;

var hasRequired_limitProperties;

function require_limitProperties() {
    if (hasRequired_limitProperties) return _limitProperties;
    hasRequired_limitProperties = 1;
    _limitProperties = function generate__limitProperties(it, $keyword, $ruleType) {
        var out = " ";
        var $lvl = it.level;
        var $dataLvl = it.dataLevel;
        var $schema = it.schema[$keyword];
        var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        var $breakOnError = !it.opts.allErrors;
        var $errorKeyword;
        var $data = "data" + ($dataLvl || "");
        var $isData = it.opts.$data && $schema && $schema.$data, $schemaValue;
        if ($isData) {
            out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
            $schemaValue = "schema" + $lvl;
        } else {
            $schemaValue = $schema;
        }
        if (!($isData || typeof $schema == "number")) {
            throw new Error($keyword + " must be number");
        }
        var $op = $keyword == "maxProperties" ? ">" : "<";
        out += "if ( ";
        if ($isData) {
            out += " (" + $schemaValue + " !== undefined && typeof " + $schemaValue + " != 'number') || ";
        }
        out += " Object.keys(" + $data + ").length " + $op + " " + $schemaValue + ") { ";
        var $errorKeyword = $keyword;
        var $$outStack = $$outStack || [];
        $$outStack.push(out);
        out = "";
        if (it.createErrors !== false) {
            out += " { keyword: '" + ($errorKeyword || "_limitProperties") + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { limit: " + $schemaValue + " } ";
            if (it.opts.messages !== false) {
                out += " , message: 'should NOT have ";
                if ($keyword == "maxProperties") {
                    out += "more";
                } else {
                    out += "fewer";
                }
                out += " than ";
                if ($isData) {
                    out += "' + " + $schemaValue + " + '";
                } else {
                    out += "" + $schema;
                }
                out += " properties' ";
            }
            if (it.opts.verbose) {
                out += " , schema:  ";
                if ($isData) {
                    out += "validate.schema" + $schemaPath;
                } else {
                    out += "" + $schema;
                }
                out += "         , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
            }
            out += " } ";
        } else {
            out += " {} ";
        }
        var __err = out;
        out = $$outStack.pop();
        if (!it.compositeRule && $breakOnError) {
            if (it.async) {
                out += " throw new ValidationError([" + __err + "]); ";
            } else {
                out += " validate.errors = [" + __err + "]; return false; ";
            }
        } else {
            out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
        }
        out += "} ";
        if ($breakOnError) {
            out += " else { ";
        }
        return out;
    };
    return _limitProperties;
}

var multipleOf;

var hasRequiredMultipleOf;

function requireMultipleOf() {
    if (hasRequiredMultipleOf) return multipleOf;
    hasRequiredMultipleOf = 1;
    multipleOf = function generate_multipleOf(it, $keyword, $ruleType) {
        var out = " ";
        var $lvl = it.level;
        var $dataLvl = it.dataLevel;
        var $schema = it.schema[$keyword];
        var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        var $breakOnError = !it.opts.allErrors;
        var $data = "data" + ($dataLvl || "");
        var $isData = it.opts.$data && $schema && $schema.$data, $schemaValue;
        if ($isData) {
            out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
            $schemaValue = "schema" + $lvl;
        } else {
            $schemaValue = $schema;
        }
        if (!($isData || typeof $schema == "number")) {
            throw new Error($keyword + " must be number");
        }
        out += "var division" + $lvl + ";if (";
        if ($isData) {
            out += " " + $schemaValue + " !== undefined && ( typeof " + $schemaValue + " != 'number' || ";
        }
        out += " (division" + $lvl + " = " + $data + " / " + $schemaValue + ", ";
        if (it.opts.multipleOfPrecision) {
            out += " Math.abs(Math.round(division" + $lvl + ") - division" + $lvl + ") > 1e-" + it.opts.multipleOfPrecision + " ";
        } else {
            out += " division" + $lvl + " !== parseInt(division" + $lvl + ") ";
        }
        out += " ) ";
        if ($isData) {
            out += "  )  ";
        }
        out += " ) {   ";
        var $$outStack = $$outStack || [];
        $$outStack.push(out);
        out = "";
        if (it.createErrors !== false) {
            out += " { keyword: '" + "multipleOf" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { multipleOf: " + $schemaValue + " } ";
            if (it.opts.messages !== false) {
                out += " , message: 'should be multiple of ";
                if ($isData) {
                    out += "' + " + $schemaValue;
                } else {
                    out += "" + $schemaValue + "'";
                }
            }
            if (it.opts.verbose) {
                out += " , schema:  ";
                if ($isData) {
                    out += "validate.schema" + $schemaPath;
                } else {
                    out += "" + $schema;
                }
                out += "         , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
            }
            out += " } ";
        } else {
            out += " {} ";
        }
        var __err = out;
        out = $$outStack.pop();
        if (!it.compositeRule && $breakOnError) {
            if (it.async) {
                out += " throw new ValidationError([" + __err + "]); ";
            } else {
                out += " validate.errors = [" + __err + "]; return false; ";
            }
        } else {
            out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
        }
        out += "} ";
        if ($breakOnError) {
            out += " else { ";
        }
        return out;
    };
    return multipleOf;
}

var not;

var hasRequiredNot;

function requireNot() {
    if (hasRequiredNot) return not;
    hasRequiredNot = 1;
    not = function generate_not(it, $keyword, $ruleType) {
        var out = " ";
        var $lvl = it.level;
        var $dataLvl = it.dataLevel;
        var $schema = it.schema[$keyword];
        var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        var $breakOnError = !it.opts.allErrors;
        var $data = "data" + ($dataLvl || "");
        var $errs = "errs__" + $lvl;
        var $it = it.util.copy(it);
        $it.level++;
        var $nextValid = "valid" + $it.level;
        if (it.opts.strictKeywords ? typeof $schema == "object" && Object.keys($schema).length > 0 || $schema === false : it.util.schemaHasRules($schema, it.RULES.all)) {
            $it.schema = $schema;
            $it.schemaPath = $schemaPath;
            $it.errSchemaPath = $errSchemaPath;
            out += " var " + $errs + " = errors;  ";
            var $wasComposite = it.compositeRule;
            it.compositeRule = $it.compositeRule = true;
            $it.createErrors = false;
            var $allErrorsOption;
            if ($it.opts.allErrors) {
                $allErrorsOption = $it.opts.allErrors;
                $it.opts.allErrors = false;
            }
            out += " " + it.validate($it) + " ";
            $it.createErrors = true;
            if ($allErrorsOption) $it.opts.allErrors = $allErrorsOption;
            it.compositeRule = $it.compositeRule = $wasComposite;
            out += " if (" + $nextValid + ") {   ";
            var $$outStack = $$outStack || [];
            $$outStack.push(out);
            out = "";
            if (it.createErrors !== false) {
                out += " { keyword: '" + "not" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: {} ";
                if (it.opts.messages !== false) {
                    out += " , message: 'should NOT be valid' ";
                }
                if (it.opts.verbose) {
                    out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                }
                out += " } ";
            } else {
                out += " {} ";
            }
            var __err = out;
            out = $$outStack.pop();
            if (!it.compositeRule && $breakOnError) {
                if (it.async) {
                    out += " throw new ValidationError([" + __err + "]); ";
                } else {
                    out += " validate.errors = [" + __err + "]; return false; ";
                }
            } else {
                out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
            }
            out += " } else {  errors = " + $errs + "; if (vErrors !== null) { if (" + $errs + ") vErrors.length = " + $errs + "; else vErrors = null; } ";
            if (it.opts.allErrors) {
                out += " } ";
            }
        } else {
            out += "  var err =   ";
            if (it.createErrors !== false) {
                out += " { keyword: '" + "not" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: {} ";
                if (it.opts.messages !== false) {
                    out += " , message: 'should NOT be valid' ";
                }
                if (it.opts.verbose) {
                    out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                }
                out += " } ";
            } else {
                out += " {} ";
            }
            out += ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
            if ($breakOnError) {
                out += " if (false) { ";
            }
        }
        return out;
    };
    return not;
}

var oneOf;

var hasRequiredOneOf;

function requireOneOf() {
    if (hasRequiredOneOf) return oneOf;
    hasRequiredOneOf = 1;
    oneOf = function generate_oneOf(it, $keyword, $ruleType) {
        var out = " ";
        var $lvl = it.level;
        var $dataLvl = it.dataLevel;
        var $schema = it.schema[$keyword];
        var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        var $breakOnError = !it.opts.allErrors;
        var $data = "data" + ($dataLvl || "");
        var $valid = "valid" + $lvl;
        var $errs = "errs__" + $lvl;
        var $it = it.util.copy(it);
        var $closingBraces = "";
        $it.level++;
        var $nextValid = "valid" + $it.level;
        var $currentBaseId = $it.baseId, $prevValid = "prevValid" + $lvl, $passingSchemas = "passingSchemas" + $lvl;
        out += "var " + $errs + " = errors , " + $prevValid + " = false , " + $valid + " = false , " + $passingSchemas + " = null; ";
        var $wasComposite = it.compositeRule;
        it.compositeRule = $it.compositeRule = true;
        var arr1 = $schema;
        if (arr1) {
            var $sch, $i = -1, l1 = arr1.length - 1;
            while ($i < l1) {
                $sch = arr1[$i += 1];
                if (it.opts.strictKeywords ? typeof $sch == "object" && Object.keys($sch).length > 0 || $sch === false : it.util.schemaHasRules($sch, it.RULES.all)) {
                    $it.schema = $sch;
                    $it.schemaPath = $schemaPath + "[" + $i + "]";
                    $it.errSchemaPath = $errSchemaPath + "/" + $i;
                    out += "  " + it.validate($it) + " ";
                    $it.baseId = $currentBaseId;
                } else {
                    out += " var " + $nextValid + " = true; ";
                }
                if ($i) {
                    out += " if (" + $nextValid + " && " + $prevValid + ") { " + $valid + " = false; " + $passingSchemas + " = [" + $passingSchemas + ", " + $i + "]; } else { ";
                    $closingBraces += "}";
                }
                out += " if (" + $nextValid + ") { " + $valid + " = " + $prevValid + " = true; " + $passingSchemas + " = " + $i + "; }";
            }
        }
        it.compositeRule = $it.compositeRule = $wasComposite;
        out += "" + $closingBraces + "if (!" + $valid + ") {   var err =   ";
        if (it.createErrors !== false) {
            out += " { keyword: '" + "oneOf" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { passingSchemas: " + $passingSchemas + " } ";
            if (it.opts.messages !== false) {
                out += " , message: 'should match exactly one schema in oneOf' ";
            }
            if (it.opts.verbose) {
                out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
            }
            out += " } ";
        } else {
            out += " {} ";
        }
        out += ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
        if (!it.compositeRule && $breakOnError) {
            if (it.async) {
                out += " throw new ValidationError(vErrors); ";
            } else {
                out += " validate.errors = vErrors; return false; ";
            }
        }
        out += "} else {  errors = " + $errs + "; if (vErrors !== null) { if (" + $errs + ") vErrors.length = " + $errs + "; else vErrors = null; }";
        if (it.opts.allErrors) {
            out += " } ";
        }
        return out;
    };
    return oneOf;
}

var pattern;

var hasRequiredPattern;

function requirePattern() {
    if (hasRequiredPattern) return pattern;
    hasRequiredPattern = 1;
    pattern = function generate_pattern(it, $keyword, $ruleType) {
        var out = " ";
        var $lvl = it.level;
        var $dataLvl = it.dataLevel;
        var $schema = it.schema[$keyword];
        var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        var $breakOnError = !it.opts.allErrors;
        var $data = "data" + ($dataLvl || "");
        var $isData = it.opts.$data && $schema && $schema.$data, $schemaValue;
        if ($isData) {
            out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
            $schemaValue = "schema" + $lvl;
        } else {
            $schemaValue = $schema;
        }
        var $regexp = $isData ? "(new RegExp(" + $schemaValue + "))" : it.usePattern($schema);
        out += "if ( ";
        if ($isData) {
            out += " (" + $schemaValue + " !== undefined && typeof " + $schemaValue + " != 'string') || ";
        }
        out += " !" + $regexp + ".test(" + $data + ") ) {   ";
        var $$outStack = $$outStack || [];
        $$outStack.push(out);
        out = "";
        if (it.createErrors !== false) {
            out += " { keyword: '" + "pattern" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { pattern:  ";
            if ($isData) {
                out += "" + $schemaValue;
            } else {
                out += "" + it.util.toQuotedString($schema);
            }
            out += "  } ";
            if (it.opts.messages !== false) {
                out += " , message: 'should match pattern \"";
                if ($isData) {
                    out += "' + " + $schemaValue + " + '";
                } else {
                    out += "" + it.util.escapeQuotes($schema);
                }
                out += "\"' ";
            }
            if (it.opts.verbose) {
                out += " , schema:  ";
                if ($isData) {
                    out += "validate.schema" + $schemaPath;
                } else {
                    out += "" + it.util.toQuotedString($schema);
                }
                out += "         , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
            }
            out += " } ";
        } else {
            out += " {} ";
        }
        var __err = out;
        out = $$outStack.pop();
        if (!it.compositeRule && $breakOnError) {
            if (it.async) {
                out += " throw new ValidationError([" + __err + "]); ";
            } else {
                out += " validate.errors = [" + __err + "]; return false; ";
            }
        } else {
            out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
        }
        out += "} ";
        if ($breakOnError) {
            out += " else { ";
        }
        return out;
    };
    return pattern;
}

var properties$2;

var hasRequiredProperties;

function requireProperties() {
    if (hasRequiredProperties) return properties$2;
    hasRequiredProperties = 1;
    properties$2 = function generate_properties(it, $keyword, $ruleType) {
        var out = " ";
        var $lvl = it.level;
        var $dataLvl = it.dataLevel;
        var $schema = it.schema[$keyword];
        var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        var $breakOnError = !it.opts.allErrors;
        var $data = "data" + ($dataLvl || "");
        var $errs = "errs__" + $lvl;
        var $it = it.util.copy(it);
        var $closingBraces = "";
        $it.level++;
        var $nextValid = "valid" + $it.level;
        var $key = "key" + $lvl, $idx = "idx" + $lvl, $dataNxt = $it.dataLevel = it.dataLevel + 1, $nextData = "data" + $dataNxt, $dataProperties = "dataProperties" + $lvl;
        var $schemaKeys = Object.keys($schema || {}).filter(notProto), $pProperties = it.schema.patternProperties || {}, $pPropertyKeys = Object.keys($pProperties).filter(notProto), $aProperties = it.schema.additionalProperties, $someProperties = $schemaKeys.length || $pPropertyKeys.length, $noAdditional = $aProperties === false, $additionalIsSchema = typeof $aProperties == "object" && Object.keys($aProperties).length, $removeAdditional = it.opts.removeAdditional, $checkAdditional = $noAdditional || $additionalIsSchema || $removeAdditional, $ownProperties = it.opts.ownProperties, $currentBaseId = it.baseId;
        var $required = it.schema.required;
        if ($required && !(it.opts.$data && $required.$data) && $required.length < it.opts.loopRequired) {
            var $requiredHash = it.util.toHash($required);
        }
        function notProto(p) {
            return p !== "__proto__";
        }
        out += "var " + $errs + " = errors;var " + $nextValid + " = true;";
        if ($ownProperties) {
            out += " var " + $dataProperties + " = undefined;";
        }
        if ($checkAdditional) {
            if ($ownProperties) {
                out += " " + $dataProperties + " = " + $dataProperties + " || Object.keys(" + $data + "); for (var " + $idx + "=0; " + $idx + "<" + $dataProperties + ".length; " + $idx + "++) { var " + $key + " = " + $dataProperties + "[" + $idx + "]; ";
            } else {
                out += " for (var " + $key + " in " + $data + ") { ";
            }
            if ($someProperties) {
                out += " var isAdditional" + $lvl + " = !(false ";
                if ($schemaKeys.length) {
                    if ($schemaKeys.length > 8) {
                        out += " || validate.schema" + $schemaPath + ".hasOwnProperty(" + $key + ") ";
                    } else {
                        var arr1 = $schemaKeys;
                        if (arr1) {
                            var $propertyKey, i1 = -1, l1 = arr1.length - 1;
                            while (i1 < l1) {
                                $propertyKey = arr1[i1 += 1];
                                out += " || " + $key + " == " + it.util.toQuotedString($propertyKey) + " ";
                            }
                        }
                    }
                }
                if ($pPropertyKeys.length) {
                    var arr2 = $pPropertyKeys;
                    if (arr2) {
                        var $pProperty, $i = -1, l2 = arr2.length - 1;
                        while ($i < l2) {
                            $pProperty = arr2[$i += 1];
                            out += " || " + it.usePattern($pProperty) + ".test(" + $key + ") ";
                        }
                    }
                }
                out += " ); if (isAdditional" + $lvl + ") { ";
            }
            if ($removeAdditional == "all") {
                out += " delete " + $data + "[" + $key + "]; ";
            } else {
                var $currentErrorPath = it.errorPath;
                var $additionalProperty = "' + " + $key + " + '";
                if (it.opts._errorDataPathProperty) {
                    it.errorPath = it.util.getPathExpr(it.errorPath, $key, it.opts.jsonPointers);
                }
                if ($noAdditional) {
                    if ($removeAdditional) {
                        out += " delete " + $data + "[" + $key + "]; ";
                    } else {
                        out += " " + $nextValid + " = false; ";
                        var $currErrSchemaPath = $errSchemaPath;
                        $errSchemaPath = it.errSchemaPath + "/additionalProperties";
                        var $$outStack = $$outStack || [];
                        $$outStack.push(out);
                        out = "";
                        if (it.createErrors !== false) {
                            out += " { keyword: '" + "additionalProperties" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { additionalProperty: '" + $additionalProperty + "' } ";
                            if (it.opts.messages !== false) {
                                out += " , message: '";
                                if (it.opts._errorDataPathProperty) {
                                    out += "is an invalid additional property";
                                } else {
                                    out += "should NOT have additional properties";
                                }
                                out += "' ";
                            }
                            if (it.opts.verbose) {
                                out += " , schema: false , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                            }
                            out += " } ";
                        } else {
                            out += " {} ";
                        }
                        var __err = out;
                        out = $$outStack.pop();
                        if (!it.compositeRule && $breakOnError) {
                            if (it.async) {
                                out += " throw new ValidationError([" + __err + "]); ";
                            } else {
                                out += " validate.errors = [" + __err + "]; return false; ";
                            }
                        } else {
                            out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                        }
                        $errSchemaPath = $currErrSchemaPath;
                        if ($breakOnError) {
                            out += " break; ";
                        }
                    }
                } else if ($additionalIsSchema) {
                    if ($removeAdditional == "failing") {
                        out += " var " + $errs + " = errors;  ";
                        var $wasComposite = it.compositeRule;
                        it.compositeRule = $it.compositeRule = true;
                        $it.schema = $aProperties;
                        $it.schemaPath = it.schemaPath + ".additionalProperties";
                        $it.errSchemaPath = it.errSchemaPath + "/additionalProperties";
                        $it.errorPath = it.opts._errorDataPathProperty ? it.errorPath : it.util.getPathExpr(it.errorPath, $key, it.opts.jsonPointers);
                        var $passData = $data + "[" + $key + "]";
                        $it.dataPathArr[$dataNxt] = $key;
                        var $code = it.validate($it);
                        $it.baseId = $currentBaseId;
                        if (it.util.varOccurences($code, $nextData) < 2) {
                            out += " " + it.util.varReplace($code, $nextData, $passData) + " ";
                        } else {
                            out += " var " + $nextData + " = " + $passData + "; " + $code + " ";
                        }
                        out += " if (!" + $nextValid + ") { errors = " + $errs + "; if (validate.errors !== null) { if (errors) validate.errors.length = errors; else validate.errors = null; } delete " + $data + "[" + $key + "]; }  ";
                        it.compositeRule = $it.compositeRule = $wasComposite;
                    } else {
                        $it.schema = $aProperties;
                        $it.schemaPath = it.schemaPath + ".additionalProperties";
                        $it.errSchemaPath = it.errSchemaPath + "/additionalProperties";
                        $it.errorPath = it.opts._errorDataPathProperty ? it.errorPath : it.util.getPathExpr(it.errorPath, $key, it.opts.jsonPointers);
                        var $passData = $data + "[" + $key + "]";
                        $it.dataPathArr[$dataNxt] = $key;
                        var $code = it.validate($it);
                        $it.baseId = $currentBaseId;
                        if (it.util.varOccurences($code, $nextData) < 2) {
                            out += " " + it.util.varReplace($code, $nextData, $passData) + " ";
                        } else {
                            out += " var " + $nextData + " = " + $passData + "; " + $code + " ";
                        }
                        if ($breakOnError) {
                            out += " if (!" + $nextValid + ") break; ";
                        }
                    }
                }
                it.errorPath = $currentErrorPath;
            }
            if ($someProperties) {
                out += " } ";
            }
            out += " }  ";
            if ($breakOnError) {
                out += " if (" + $nextValid + ") { ";
                $closingBraces += "}";
            }
        }
        var $useDefaults = it.opts.useDefaults && !it.compositeRule;
        if ($schemaKeys.length) {
            var arr3 = $schemaKeys;
            if (arr3) {
                var $propertyKey, i3 = -1, l3 = arr3.length - 1;
                while (i3 < l3) {
                    $propertyKey = arr3[i3 += 1];
                    var $sch = $schema[$propertyKey];
                    if (it.opts.strictKeywords ? typeof $sch == "object" && Object.keys($sch).length > 0 || $sch === false : it.util.schemaHasRules($sch, it.RULES.all)) {
                        var $prop = it.util.getProperty($propertyKey), $passData = $data + $prop, $hasDefault = $useDefaults && $sch.default !== undefined;
                        $it.schema = $sch;
                        $it.schemaPath = $schemaPath + $prop;
                        $it.errSchemaPath = $errSchemaPath + "/" + it.util.escapeFragment($propertyKey);
                        $it.errorPath = it.util.getPath(it.errorPath, $propertyKey, it.opts.jsonPointers);
                        $it.dataPathArr[$dataNxt] = it.util.toQuotedString($propertyKey);
                        var $code = it.validate($it);
                        $it.baseId = $currentBaseId;
                        if (it.util.varOccurences($code, $nextData) < 2) {
                            $code = it.util.varReplace($code, $nextData, $passData);
                            var $useData = $passData;
                        } else {
                            var $useData = $nextData;
                            out += " var " + $nextData + " = " + $passData + "; ";
                        }
                        if ($hasDefault) {
                            out += " " + $code + " ";
                        } else {
                            if ($requiredHash && $requiredHash[$propertyKey]) {
                                out += " if ( " + $useData + " === undefined ";
                                if ($ownProperties) {
                                    out += " || ! Object.prototype.hasOwnProperty.call(" + $data + ", '" + it.util.escapeQuotes($propertyKey) + "') ";
                                }
                                out += ") { " + $nextValid + " = false; ";
                                var $currentErrorPath = it.errorPath, $currErrSchemaPath = $errSchemaPath, $missingProperty = it.util.escapeQuotes($propertyKey);
                                if (it.opts._errorDataPathProperty) {
                                    it.errorPath = it.util.getPath($currentErrorPath, $propertyKey, it.opts.jsonPointers);
                                }
                                $errSchemaPath = it.errSchemaPath + "/required";
                                var $$outStack = $$outStack || [];
                                $$outStack.push(out);
                                out = "";
                                if (it.createErrors !== false) {
                                    out += " { keyword: '" + "required" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { missingProperty: '" + $missingProperty + "' } ";
                                    if (it.opts.messages !== false) {
                                        out += " , message: '";
                                        if (it.opts._errorDataPathProperty) {
                                            out += "is a required property";
                                        } else {
                                            out += "should have required property \\'" + $missingProperty + "\\'";
                                        }
                                        out += "' ";
                                    }
                                    if (it.opts.verbose) {
                                        out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                                    }
                                    out += " } ";
                                } else {
                                    out += " {} ";
                                }
                                var __err = out;
                                out = $$outStack.pop();
                                if (!it.compositeRule && $breakOnError) {
                                    if (it.async) {
                                        out += " throw new ValidationError([" + __err + "]); ";
                                    } else {
                                        out += " validate.errors = [" + __err + "]; return false; ";
                                    }
                                } else {
                                    out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                                }
                                $errSchemaPath = $currErrSchemaPath;
                                it.errorPath = $currentErrorPath;
                                out += " } else { ";
                            } else {
                                if ($breakOnError) {
                                    out += " if ( " + $useData + " === undefined ";
                                    if ($ownProperties) {
                                        out += " || ! Object.prototype.hasOwnProperty.call(" + $data + ", '" + it.util.escapeQuotes($propertyKey) + "') ";
                                    }
                                    out += ") { " + $nextValid + " = true; } else { ";
                                } else {
                                    out += " if (" + $useData + " !== undefined ";
                                    if ($ownProperties) {
                                        out += " &&   Object.prototype.hasOwnProperty.call(" + $data + ", '" + it.util.escapeQuotes($propertyKey) + "') ";
                                    }
                                    out += " ) { ";
                                }
                            }
                            out += " " + $code + " } ";
                        }
                    }
                    if ($breakOnError) {
                        out += " if (" + $nextValid + ") { ";
                        $closingBraces += "}";
                    }
                }
            }
        }
        if ($pPropertyKeys.length) {
            var arr4 = $pPropertyKeys;
            if (arr4) {
                var $pProperty, i4 = -1, l4 = arr4.length - 1;
                while (i4 < l4) {
                    $pProperty = arr4[i4 += 1];
                    var $sch = $pProperties[$pProperty];
                    if (it.opts.strictKeywords ? typeof $sch == "object" && Object.keys($sch).length > 0 || $sch === false : it.util.schemaHasRules($sch, it.RULES.all)) {
                        $it.schema = $sch;
                        $it.schemaPath = it.schemaPath + ".patternProperties" + it.util.getProperty($pProperty);
                        $it.errSchemaPath = it.errSchemaPath + "/patternProperties/" + it.util.escapeFragment($pProperty);
                        if ($ownProperties) {
                            out += " " + $dataProperties + " = " + $dataProperties + " || Object.keys(" + $data + "); for (var " + $idx + "=0; " + $idx + "<" + $dataProperties + ".length; " + $idx + "++) { var " + $key + " = " + $dataProperties + "[" + $idx + "]; ";
                        } else {
                            out += " for (var " + $key + " in " + $data + ") { ";
                        }
                        out += " if (" + it.usePattern($pProperty) + ".test(" + $key + ")) { ";
                        $it.errorPath = it.util.getPathExpr(it.errorPath, $key, it.opts.jsonPointers);
                        var $passData = $data + "[" + $key + "]";
                        $it.dataPathArr[$dataNxt] = $key;
                        var $code = it.validate($it);
                        $it.baseId = $currentBaseId;
                        if (it.util.varOccurences($code, $nextData) < 2) {
                            out += " " + it.util.varReplace($code, $nextData, $passData) + " ";
                        } else {
                            out += " var " + $nextData + " = " + $passData + "; " + $code + " ";
                        }
                        if ($breakOnError) {
                            out += " if (!" + $nextValid + ") break; ";
                        }
                        out += " } ";
                        if ($breakOnError) {
                            out += " else " + $nextValid + " = true; ";
                        }
                        out += " }  ";
                        if ($breakOnError) {
                            out += " if (" + $nextValid + ") { ";
                            $closingBraces += "}";
                        }
                    }
                }
            }
        }
        if ($breakOnError) {
            out += " " + $closingBraces + " if (" + $errs + " == errors) {";
        }
        return out;
    };
    return properties$2;
}

var propertyNames;

var hasRequiredPropertyNames;

function requirePropertyNames() {
    if (hasRequiredPropertyNames) return propertyNames;
    hasRequiredPropertyNames = 1;
    propertyNames = function generate_propertyNames(it, $keyword, $ruleType) {
        var out = " ";
        var $lvl = it.level;
        var $dataLvl = it.dataLevel;
        var $schema = it.schema[$keyword];
        var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        var $breakOnError = !it.opts.allErrors;
        var $data = "data" + ($dataLvl || "");
        var $errs = "errs__" + $lvl;
        var $it = it.util.copy(it);
        var $closingBraces = "";
        $it.level++;
        var $nextValid = "valid" + $it.level;
        out += "var " + $errs + " = errors;";
        if (it.opts.strictKeywords ? typeof $schema == "object" && Object.keys($schema).length > 0 || $schema === false : it.util.schemaHasRules($schema, it.RULES.all)) {
            $it.schema = $schema;
            $it.schemaPath = $schemaPath;
            $it.errSchemaPath = $errSchemaPath;
            var $key = "key" + $lvl, $idx = "idx" + $lvl, $i = "i" + $lvl, $invalidName = "' + " + $key + " + '", $dataNxt = $it.dataLevel = it.dataLevel + 1, $nextData = "data" + $dataNxt, $dataProperties = "dataProperties" + $lvl, $ownProperties = it.opts.ownProperties, $currentBaseId = it.baseId;
            if ($ownProperties) {
                out += " var " + $dataProperties + " = undefined; ";
            }
            if ($ownProperties) {
                out += " " + $dataProperties + " = " + $dataProperties + " || Object.keys(" + $data + "); for (var " + $idx + "=0; " + $idx + "<" + $dataProperties + ".length; " + $idx + "++) { var " + $key + " = " + $dataProperties + "[" + $idx + "]; ";
            } else {
                out += " for (var " + $key + " in " + $data + ") { ";
            }
            out += " var startErrs" + $lvl + " = errors; ";
            var $passData = $key;
            var $wasComposite = it.compositeRule;
            it.compositeRule = $it.compositeRule = true;
            var $code = it.validate($it);
            $it.baseId = $currentBaseId;
            if (it.util.varOccurences($code, $nextData) < 2) {
                out += " " + it.util.varReplace($code, $nextData, $passData) + " ";
            } else {
                out += " var " + $nextData + " = " + $passData + "; " + $code + " ";
            }
            it.compositeRule = $it.compositeRule = $wasComposite;
            out += " if (!" + $nextValid + ") { for (var " + $i + "=startErrs" + $lvl + "; " + $i + "<errors; " + $i + "++) { vErrors[" + $i + "].propertyName = " + $key + "; }   var err =   ";
            if (it.createErrors !== false) {
                out += " { keyword: '" + "propertyNames" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { propertyName: '" + $invalidName + "' } ";
                if (it.opts.messages !== false) {
                    out += " , message: 'property name \\'" + $invalidName + "\\' is invalid' ";
                }
                if (it.opts.verbose) {
                    out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                }
                out += " } ";
            } else {
                out += " {} ";
            }
            out += ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
            if (!it.compositeRule && $breakOnError) {
                if (it.async) {
                    out += " throw new ValidationError(vErrors); ";
                } else {
                    out += " validate.errors = vErrors; return false; ";
                }
            }
            if ($breakOnError) {
                out += " break; ";
            }
            out += " } }";
        }
        if ($breakOnError) {
            out += " " + $closingBraces + " if (" + $errs + " == errors) {";
        }
        return out;
    };
    return propertyNames;
}

var required$1;

var hasRequiredRequired;

function requireRequired() {
    if (hasRequiredRequired) return required$1;
    hasRequiredRequired = 1;
    required$1 = function generate_required(it, $keyword, $ruleType) {
        var out = " ";
        var $lvl = it.level;
        var $dataLvl = it.dataLevel;
        var $schema = it.schema[$keyword];
        var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        var $breakOnError = !it.opts.allErrors;
        var $data = "data" + ($dataLvl || "");
        var $valid = "valid" + $lvl;
        var $isData = it.opts.$data && $schema && $schema.$data;
        if ($isData) {
            out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
        }
        var $vSchema = "schema" + $lvl;
        if (!$isData) {
            if ($schema.length < it.opts.loopRequired && it.schema.properties && Object.keys(it.schema.properties).length) {
                var $required = [];
                var arr1 = $schema;
                if (arr1) {
                    var $property, i1 = -1, l1 = arr1.length - 1;
                    while (i1 < l1) {
                        $property = arr1[i1 += 1];
                        var $propertySch = it.schema.properties[$property];
                        if (!($propertySch && (it.opts.strictKeywords ? typeof $propertySch == "object" && Object.keys($propertySch).length > 0 || $propertySch === false : it.util.schemaHasRules($propertySch, it.RULES.all)))) {
                            $required[$required.length] = $property;
                        }
                    }
                }
            } else {
                var $required = $schema;
            }
        }
        if ($isData || $required.length) {
            var $currentErrorPath = it.errorPath, $loopRequired = $isData || $required.length >= it.opts.loopRequired, $ownProperties = it.opts.ownProperties;
            if ($breakOnError) {
                out += " var missing" + $lvl + "; ";
                if ($loopRequired) {
                    if (!$isData) {
                        out += " var " + $vSchema + " = validate.schema" + $schemaPath + "; ";
                    }
                    var $i = "i" + $lvl, $propertyPath = "schema" + $lvl + "[" + $i + "]", $missingProperty = "' + " + $propertyPath + " + '";
                    if (it.opts._errorDataPathProperty) {
                        it.errorPath = it.util.getPathExpr($currentErrorPath, $propertyPath, it.opts.jsonPointers);
                    }
                    out += " var " + $valid + " = true; ";
                    if ($isData) {
                        out += " if (schema" + $lvl + " === undefined) " + $valid + " = true; else if (!Array.isArray(schema" + $lvl + ")) " + $valid + " = false; else {";
                    }
                    out += " for (var " + $i + " = 0; " + $i + " < " + $vSchema + ".length; " + $i + "++) { " + $valid + " = " + $data + "[" + $vSchema + "[" + $i + "]] !== undefined ";
                    if ($ownProperties) {
                        out += " &&   Object.prototype.hasOwnProperty.call(" + $data + ", " + $vSchema + "[" + $i + "]) ";
                    }
                    out += "; if (!" + $valid + ") break; } ";
                    if ($isData) {
                        out += "  }  ";
                    }
                    out += "  if (!" + $valid + ") {   ";
                    var $$outStack = $$outStack || [];
                    $$outStack.push(out);
                    out = "";
                    if (it.createErrors !== false) {
                        out += " { keyword: '" + "required" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { missingProperty: '" + $missingProperty + "' } ";
                        if (it.opts.messages !== false) {
                            out += " , message: '";
                            if (it.opts._errorDataPathProperty) {
                                out += "is a required property";
                            } else {
                                out += "should have required property \\'" + $missingProperty + "\\'";
                            }
                            out += "' ";
                        }
                        if (it.opts.verbose) {
                            out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                        }
                        out += " } ";
                    } else {
                        out += " {} ";
                    }
                    var __err = out;
                    out = $$outStack.pop();
                    if (!it.compositeRule && $breakOnError) {
                        if (it.async) {
                            out += " throw new ValidationError([" + __err + "]); ";
                        } else {
                            out += " validate.errors = [" + __err + "]; return false; ";
                        }
                    } else {
                        out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                    }
                    out += " } else { ";
                } else {
                    out += " if ( ";
                    var arr2 = $required;
                    if (arr2) {
                        var $propertyKey, $i = -1, l2 = arr2.length - 1;
                        while ($i < l2) {
                            $propertyKey = arr2[$i += 1];
                            if ($i) {
                                out += " || ";
                            }
                            var $prop = it.util.getProperty($propertyKey), $useData = $data + $prop;
                            out += " ( ( " + $useData + " === undefined ";
                            if ($ownProperties) {
                                out += " || ! Object.prototype.hasOwnProperty.call(" + $data + ", '" + it.util.escapeQuotes($propertyKey) + "') ";
                            }
                            out += ") && (missing" + $lvl + " = " + it.util.toQuotedString(it.opts.jsonPointers ? $propertyKey : $prop) + ") ) ";
                        }
                    }
                    out += ") {  ";
                    var $propertyPath = "missing" + $lvl, $missingProperty = "' + " + $propertyPath + " + '";
                    if (it.opts._errorDataPathProperty) {
                        it.errorPath = it.opts.jsonPointers ? it.util.getPathExpr($currentErrorPath, $propertyPath, true) : $currentErrorPath + " + " + $propertyPath;
                    }
                    var $$outStack = $$outStack || [];
                    $$outStack.push(out);
                    out = "";
                    if (it.createErrors !== false) {
                        out += " { keyword: '" + "required" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { missingProperty: '" + $missingProperty + "' } ";
                        if (it.opts.messages !== false) {
                            out += " , message: '";
                            if (it.opts._errorDataPathProperty) {
                                out += "is a required property";
                            } else {
                                out += "should have required property \\'" + $missingProperty + "\\'";
                            }
                            out += "' ";
                        }
                        if (it.opts.verbose) {
                            out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                        }
                        out += " } ";
                    } else {
                        out += " {} ";
                    }
                    var __err = out;
                    out = $$outStack.pop();
                    if (!it.compositeRule && $breakOnError) {
                        if (it.async) {
                            out += " throw new ValidationError([" + __err + "]); ";
                        } else {
                            out += " validate.errors = [" + __err + "]; return false; ";
                        }
                    } else {
                        out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                    }
                    out += " } else { ";
                }
            } else {
                if ($loopRequired) {
                    if (!$isData) {
                        out += " var " + $vSchema + " = validate.schema" + $schemaPath + "; ";
                    }
                    var $i = "i" + $lvl, $propertyPath = "schema" + $lvl + "[" + $i + "]", $missingProperty = "' + " + $propertyPath + " + '";
                    if (it.opts._errorDataPathProperty) {
                        it.errorPath = it.util.getPathExpr($currentErrorPath, $propertyPath, it.opts.jsonPointers);
                    }
                    if ($isData) {
                        out += " if (" + $vSchema + " && !Array.isArray(" + $vSchema + ")) {  var err =   ";
                        if (it.createErrors !== false) {
                            out += " { keyword: '" + "required" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { missingProperty: '" + $missingProperty + "' } ";
                            if (it.opts.messages !== false) {
                                out += " , message: '";
                                if (it.opts._errorDataPathProperty) {
                                    out += "is a required property";
                                } else {
                                    out += "should have required property \\'" + $missingProperty + "\\'";
                                }
                                out += "' ";
                            }
                            if (it.opts.verbose) {
                                out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                            }
                            out += " } ";
                        } else {
                            out += " {} ";
                        }
                        out += ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; } else if (" + $vSchema + " !== undefined) { ";
                    }
                    out += " for (var " + $i + " = 0; " + $i + " < " + $vSchema + ".length; " + $i + "++) { if (" + $data + "[" + $vSchema + "[" + $i + "]] === undefined ";
                    if ($ownProperties) {
                        out += " || ! Object.prototype.hasOwnProperty.call(" + $data + ", " + $vSchema + "[" + $i + "]) ";
                    }
                    out += ") {  var err =   ";
                    if (it.createErrors !== false) {
                        out += " { keyword: '" + "required" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { missingProperty: '" + $missingProperty + "' } ";
                        if (it.opts.messages !== false) {
                            out += " , message: '";
                            if (it.opts._errorDataPathProperty) {
                                out += "is a required property";
                            } else {
                                out += "should have required property \\'" + $missingProperty + "\\'";
                            }
                            out += "' ";
                        }
                        if (it.opts.verbose) {
                            out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                        }
                        out += " } ";
                    } else {
                        out += " {} ";
                    }
                    out += ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; } } ";
                    if ($isData) {
                        out += "  }  ";
                    }
                } else {
                    var arr3 = $required;
                    if (arr3) {
                        var $propertyKey, i3 = -1, l3 = arr3.length - 1;
                        while (i3 < l3) {
                            $propertyKey = arr3[i3 += 1];
                            var $prop = it.util.getProperty($propertyKey), $missingProperty = it.util.escapeQuotes($propertyKey), $useData = $data + $prop;
                            if (it.opts._errorDataPathProperty) {
                                it.errorPath = it.util.getPath($currentErrorPath, $propertyKey, it.opts.jsonPointers);
                            }
                            out += " if ( " + $useData + " === undefined ";
                            if ($ownProperties) {
                                out += " || ! Object.prototype.hasOwnProperty.call(" + $data + ", '" + it.util.escapeQuotes($propertyKey) + "') ";
                            }
                            out += ") {  var err =   ";
                            if (it.createErrors !== false) {
                                out += " { keyword: '" + "required" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { missingProperty: '" + $missingProperty + "' } ";
                                if (it.opts.messages !== false) {
                                    out += " , message: '";
                                    if (it.opts._errorDataPathProperty) {
                                        out += "is a required property";
                                    } else {
                                        out += "should have required property \\'" + $missingProperty + "\\'";
                                    }
                                    out += "' ";
                                }
                                if (it.opts.verbose) {
                                    out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                                }
                                out += " } ";
                            } else {
                                out += " {} ";
                            }
                            out += ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; } ";
                        }
                    }
                }
            }
            it.errorPath = $currentErrorPath;
        } else if ($breakOnError) {
            out += " if (true) {";
        }
        return out;
    };
    return required$1;
}

var uniqueItems;

var hasRequiredUniqueItems;

function requireUniqueItems() {
    if (hasRequiredUniqueItems) return uniqueItems;
    hasRequiredUniqueItems = 1;
    uniqueItems = function generate_uniqueItems(it, $keyword, $ruleType) {
        var out = " ";
        var $lvl = it.level;
        var $dataLvl = it.dataLevel;
        var $schema = it.schema[$keyword];
        var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        var $breakOnError = !it.opts.allErrors;
        var $data = "data" + ($dataLvl || "");
        var $valid = "valid" + $lvl;
        var $isData = it.opts.$data && $schema && $schema.$data, $schemaValue;
        if ($isData) {
            out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
            $schemaValue = "schema" + $lvl;
        } else {
            $schemaValue = $schema;
        }
        if (($schema || $isData) && it.opts.uniqueItems !== false) {
            if ($isData) {
                out += " var " + $valid + "; if (" + $schemaValue + " === false || " + $schemaValue + " === undefined) " + $valid + " = true; else if (typeof " + $schemaValue + " != 'boolean') " + $valid + " = false; else { ";
            }
            out += " var i = " + $data + ".length , " + $valid + " = true , j; if (i > 1) { ";
            var $itemType = it.schema.items && it.schema.items.type, $typeIsArray = Array.isArray($itemType);
            if (!$itemType || $itemType == "object" || $itemType == "array" || $typeIsArray && ($itemType.indexOf("object") >= 0 || $itemType.indexOf("array") >= 0)) {
                out += " outer: for (;i--;) { for (j = i; j--;) { if (equal(" + $data + "[i], " + $data + "[j])) { " + $valid + " = false; break outer; } } } ";
            } else {
                out += " var itemIndices = {}, item; for (;i--;) { var item = " + $data + "[i]; ";
                var $method = "checkDataType" + ($typeIsArray ? "s" : "");
                out += " if (" + it.util[$method]($itemType, "item", it.opts.strictNumbers, true) + ") continue; ";
                if ($typeIsArray) {
                    out += " if (typeof item == 'string') item = '\"' + item; ";
                }
                out += " if (typeof itemIndices[item] == 'number') { " + $valid + " = false; j = itemIndices[item]; break; } itemIndices[item] = i; } ";
            }
            out += " } ";
            if ($isData) {
                out += "  }  ";
            }
            out += " if (!" + $valid + ") {   ";
            var $$outStack = $$outStack || [];
            $$outStack.push(out);
            out = "";
            if (it.createErrors !== false) {
                out += " { keyword: '" + "uniqueItems" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { i: i, j: j } ";
                if (it.opts.messages !== false) {
                    out += " , message: 'should NOT have duplicate items (items ## ' + j + ' and ' + i + ' are identical)' ";
                }
                if (it.opts.verbose) {
                    out += " , schema:  ";
                    if ($isData) {
                        out += "validate.schema" + $schemaPath;
                    } else {
                        out += "" + $schema;
                    }
                    out += "         , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                }
                out += " } ";
            } else {
                out += " {} ";
            }
            var __err = out;
            out = $$outStack.pop();
            if (!it.compositeRule && $breakOnError) {
                if (it.async) {
                    out += " throw new ValidationError([" + __err + "]); ";
                } else {
                    out += " validate.errors = [" + __err + "]; return false; ";
                }
            } else {
                out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
            }
            out += " } ";
            if ($breakOnError) {
                out += " else { ";
            }
        } else {
            if ($breakOnError) {
                out += " if (true) { ";
            }
        }
        return out;
    };
    return uniqueItems;
}

var dotjs;

var hasRequiredDotjs;

function requireDotjs() {
    if (hasRequiredDotjs) return dotjs;
    hasRequiredDotjs = 1;
    dotjs = {
        $ref: requireRef(),
        allOf: requireAllOf(),
        anyOf: requireAnyOf(),
        $comment: requireComment(),
        const: require_const(),
        contains: requireContains(),
        dependencies: requireDependencies(),
        enum: require_enum(),
        format: requireFormat(),
        if: require_if(),
        items: requireItems(),
        maximum: require_limit(),
        minimum: require_limit(),
        maxItems: require_limitItems(),
        minItems: require_limitItems(),
        maxLength: require_limitLength(),
        minLength: require_limitLength(),
        maxProperties: require_limitProperties(),
        minProperties: require_limitProperties(),
        multipleOf: requireMultipleOf(),
        not: requireNot(),
        oneOf: requireOneOf(),
        pattern: requirePattern(),
        properties: requireProperties(),
        propertyNames: requirePropertyNames(),
        required: requireRequired(),
        uniqueItems: requireUniqueItems(),
        validate: requireValidate()
    };
    return dotjs;
}

var rules;

var hasRequiredRules;

function requireRules() {
    if (hasRequiredRules) return rules;
    hasRequiredRules = 1;
    var ruleModules = requireDotjs(), toHash = requireUtil().toHash;
    rules = function rules() {
        var RULES = [ {
            type: "number",
            rules: [ {
                maximum: [ "exclusiveMaximum" ]
            }, {
                minimum: [ "exclusiveMinimum" ]
            }, "multipleOf", "format" ]
        }, {
            type: "string",
            rules: [ "maxLength", "minLength", "pattern", "format" ]
        }, {
            type: "array",
            rules: [ "maxItems", "minItems", "items", "contains", "uniqueItems" ]
        }, {
            type: "object",
            rules: [ "maxProperties", "minProperties", "required", "dependencies", "propertyNames", {
                properties: [ "additionalProperties", "patternProperties" ]
            } ]
        }, {
            rules: [ "$ref", "const", "enum", "not", "anyOf", "oneOf", "allOf", "if" ]
        } ];
        var ALL = [ "type", "$comment" ];
        var KEYWORDS = [ "$schema", "$id", "id", "$data", "$async", "title", "description", "default", "definitions", "examples", "readOnly", "writeOnly", "contentMediaType", "contentEncoding", "additionalItems", "then", "else" ];
        var TYPES = [ "number", "integer", "string", "array", "object", "boolean", "null" ];
        RULES.all = toHash(ALL);
        RULES.types = toHash(TYPES);
        RULES.forEach(function(group) {
            group.rules = group.rules.map(function(keyword) {
                var implKeywords;
                if (typeof keyword == "object") {
                    var key = Object.keys(keyword)[0];
                    implKeywords = keyword[key];
                    keyword = key;
                    implKeywords.forEach(function(k) {
                        ALL.push(k);
                        RULES.all[k] = true;
                    });
                }
                ALL.push(keyword);
                var rule = RULES.all[keyword] = {
                    keyword,
                    code: ruleModules[keyword],
                    implements: implKeywords
                };
                return rule;
            });
            RULES.all.$comment = {
                keyword: "$comment",
                code: ruleModules.$comment
            };
            if (group.type) RULES.types[group.type] = group;
        });
        RULES.keywords = toHash(ALL.concat(KEYWORDS));
        RULES.custom = {};
        return RULES;
    };
    return rules;
}

var data;

var hasRequiredData;

function requireData() {
    if (hasRequiredData) return data;
    hasRequiredData = 1;
    var KEYWORDS = [ "multipleOf", "maximum", "exclusiveMaximum", "minimum", "exclusiveMinimum", "maxLength", "minLength", "pattern", "additionalItems", "maxItems", "minItems", "uniqueItems", "maxProperties", "minProperties", "required", "additionalProperties", "enum", "format", "const" ];
    data = function(metaSchema, keywordsJsonPointers) {
        for (var i = 0; i < keywordsJsonPointers.length; i++) {
            metaSchema = JSON.parse(JSON.stringify(metaSchema));
            var segments = keywordsJsonPointers[i].split("/");
            var keywords = metaSchema;
            var j;
            for (j = 1; j < segments.length; j++) keywords = keywords[segments[j]];
            for (j = 0; j < KEYWORDS.length; j++) {
                var key = KEYWORDS[j];
                var schema = keywords[key];
                if (schema) {
                    keywords[key] = {
                        anyOf: [ schema, {
                            $ref: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#"
                        } ]
                    };
                }
            }
        }
        return metaSchema;
    };
    return data;
}

var async;

var hasRequiredAsync;

function requireAsync() {
    if (hasRequiredAsync) return async;
    hasRequiredAsync = 1;
    var MissingRefError = requireError_classes().MissingRef;
    async = compileAsync;
    function compileAsync(schema, meta, callback) {
        var self = this;
        if (typeof this._opts.loadSchema != "function") throw new Error("options.loadSchema should be a function");
        if (typeof meta == "function") {
            callback = meta;
            meta = undefined;
        }
        var p = loadMetaSchemaOf(schema).then(function() {
            var schemaObj = self._addSchema(schema, undefined, meta);
            return schemaObj.validate || _compileAsync(schemaObj);
        });
        if (callback) {
            p.then(function(v) {
                callback(null, v);
            }, callback);
        }
        return p;
        function loadMetaSchemaOf(sch) {
            var $schema = sch.$schema;
            return $schema && !self.getSchema($schema) ? compileAsync.call(self, {
                $ref: $schema
            }, true) : Promise.resolve();
        }
        function _compileAsync(schemaObj) {
            try {
                return self._compile(schemaObj);
            } catch (e) {
                if (e instanceof MissingRefError) return loadMissingSchema(e);
                throw e;
            }
            function loadMissingSchema(e) {
                var ref = e.missingSchema;
                if (added(ref)) throw new Error("Schema " + ref + " is loaded but " + e.missingRef + " cannot be resolved");
                var schemaPromise = self._loadingSchemas[ref];
                if (!schemaPromise) {
                    schemaPromise = self._loadingSchemas[ref] = self._opts.loadSchema(ref);
                    schemaPromise.then(removePromise, removePromise);
                }
                return schemaPromise.then(function(sch) {
                    if (!added(ref)) {
                        return loadMetaSchemaOf(sch).then(function() {
                            if (!added(ref)) self.addSchema(sch, ref, undefined, meta);
                        });
                    }
                }).then(function() {
                    return _compileAsync(schemaObj);
                });
                function removePromise() {
                    delete self._loadingSchemas[ref];
                }
                function added(ref) {
                    return self._refs[ref] || self._schemas[ref];
                }
            }
        }
    }
    return async;
}

var custom;

var hasRequiredCustom;

function requireCustom() {
    if (hasRequiredCustom) return custom;
    hasRequiredCustom = 1;
    custom = function generate_custom(it, $keyword, $ruleType) {
        var out = " ";
        var $lvl = it.level;
        var $dataLvl = it.dataLevel;
        var $schema = it.schema[$keyword];
        var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
        var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
        var $breakOnError = !it.opts.allErrors;
        var $errorKeyword;
        var $data = "data" + ($dataLvl || "");
        var $valid = "valid" + $lvl;
        var $errs = "errs__" + $lvl;
        var $isData = it.opts.$data && $schema && $schema.$data, $schemaValue;
        if ($isData) {
            out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
            $schemaValue = "schema" + $lvl;
        } else {
            $schemaValue = $schema;
        }
        var $rule = this, $definition = "definition" + $lvl, $rDef = $rule.definition, $closingBraces = "";
        var $compile, $inline, $macro, $ruleValidate, $validateCode;
        if ($isData && $rDef.$data) {
            $validateCode = "keywordValidate" + $lvl;
            var $validateSchema = $rDef.validateSchema;
            out += " var " + $definition + " = RULES.custom['" + $keyword + "'].definition; var " + $validateCode + " = " + $definition + ".validate;";
        } else {
            $ruleValidate = it.useCustomRule($rule, $schema, it.schema, it);
            if (!$ruleValidate) return;
            $schemaValue = "validate.schema" + $schemaPath;
            $validateCode = $ruleValidate.code;
            $compile = $rDef.compile;
            $inline = $rDef.inline;
            $macro = $rDef.macro;
        }
        var $ruleErrs = $validateCode + ".errors", $i = "i" + $lvl, $ruleErr = "ruleErr" + $lvl, $asyncKeyword = $rDef.async;
        if ($asyncKeyword && !it.async) throw new Error("async keyword in sync schema");
        if (!($inline || $macro)) {
            out += "" + $ruleErrs + " = null;";
        }
        out += "var " + $errs + " = errors;var " + $valid + ";";
        if ($isData && $rDef.$data) {
            $closingBraces += "}";
            out += " if (" + $schemaValue + " === undefined) { " + $valid + " = true; } else { ";
            if ($validateSchema) {
                $closingBraces += "}";
                out += " " + $valid + " = " + $definition + ".validateSchema(" + $schemaValue + "); if (" + $valid + ") { ";
            }
        }
        if ($inline) {
            if ($rDef.statements) {
                out += " " + $ruleValidate.validate + " ";
            } else {
                out += " " + $valid + " = " + $ruleValidate.validate + "; ";
            }
        } else if ($macro) {
            var $it = it.util.copy(it);
            var $closingBraces = "";
            $it.level++;
            var $nextValid = "valid" + $it.level;
            $it.schema = $ruleValidate.validate;
            $it.schemaPath = "";
            var $wasComposite = it.compositeRule;
            it.compositeRule = $it.compositeRule = true;
            var $code = it.validate($it).replace(/validate\.schema/g, $validateCode);
            it.compositeRule = $it.compositeRule = $wasComposite;
            out += " " + $code;
        } else {
            var $$outStack = $$outStack || [];
            $$outStack.push(out);
            out = "";
            out += "  " + $validateCode + ".call( ";
            if (it.opts.passContext) {
                out += "this";
            } else {
                out += "self";
            }
            if ($compile || $rDef.schema === false) {
                out += " , " + $data + " ";
            } else {
                out += " , " + $schemaValue + " , " + $data + " , validate.schema" + it.schemaPath + " ";
            }
            out += " , (dataPath || '')";
            if (it.errorPath != '""') {
                out += " + " + it.errorPath;
            }
            var $parentData = $dataLvl ? "data" + ($dataLvl - 1 || "") : "parentData", $parentDataProperty = $dataLvl ? it.dataPathArr[$dataLvl] : "parentDataProperty";
            out += " , " + $parentData + " , " + $parentDataProperty + " , rootData )  ";
            var def_callRuleValidate = out;
            out = $$outStack.pop();
            if ($rDef.errors === false) {
                out += " " + $valid + " = ";
                if ($asyncKeyword) {
                    out += "await ";
                }
                out += "" + def_callRuleValidate + "; ";
            } else {
                if ($asyncKeyword) {
                    $ruleErrs = "customErrors" + $lvl;
                    out += " var " + $ruleErrs + " = null; try { " + $valid + " = await " + def_callRuleValidate + "; } catch (e) { " + $valid + " = false; if (e instanceof ValidationError) " + $ruleErrs + " = e.errors; else throw e; } ";
                } else {
                    out += " " + $ruleErrs + " = null; " + $valid + " = " + def_callRuleValidate + "; ";
                }
            }
        }
        if ($rDef.modifying) {
            out += " if (" + $parentData + ") " + $data + " = " + $parentData + "[" + $parentDataProperty + "];";
        }
        out += "" + $closingBraces;
        if ($rDef.valid) {
            if ($breakOnError) {
                out += " if (true) { ";
            }
        } else {
            out += " if ( ";
            if ($rDef.valid === undefined) {
                out += " !";
                if ($macro) {
                    out += "" + $nextValid;
                } else {
                    out += "" + $valid;
                }
            } else {
                out += " " + !$rDef.valid + " ";
            }
            out += ") { ";
            $errorKeyword = $rule.keyword;
            var $$outStack = $$outStack || [];
            $$outStack.push(out);
            out = "";
            var $$outStack = $$outStack || [];
            $$outStack.push(out);
            out = "";
            if (it.createErrors !== false) {
                out += " { keyword: '" + ($errorKeyword || "custom") + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { keyword: '" + $rule.keyword + "' } ";
                if (it.opts.messages !== false) {
                    out += " , message: 'should pass \"" + $rule.keyword + "\" keyword validation' ";
                }
                if (it.opts.verbose) {
                    out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                }
                out += " } ";
            } else {
                out += " {} ";
            }
            var __err = out;
            out = $$outStack.pop();
            if (!it.compositeRule && $breakOnError) {
                if (it.async) {
                    out += " throw new ValidationError([" + __err + "]); ";
                } else {
                    out += " validate.errors = [" + __err + "]; return false; ";
                }
            } else {
                out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
            }
            var def_customError = out;
            out = $$outStack.pop();
            if ($inline) {
                if ($rDef.errors) {
                    if ($rDef.errors != "full") {
                        out += "  for (var " + $i + "=" + $errs + "; " + $i + "<errors; " + $i + "++) { var " + $ruleErr + " = vErrors[" + $i + "]; if (" + $ruleErr + ".dataPath === undefined) " + $ruleErr + ".dataPath = (dataPath || '') + " + it.errorPath + "; if (" + $ruleErr + ".schemaPath === undefined) { " + $ruleErr + '.schemaPath = "' + $errSchemaPath + '"; } ';
                        if (it.opts.verbose) {
                            out += " " + $ruleErr + ".schema = " + $schemaValue + "; " + $ruleErr + ".data = " + $data + "; ";
                        }
                        out += " } ";
                    }
                } else {
                    if ($rDef.errors === false) {
                        out += " " + def_customError + " ";
                    } else {
                        out += " if (" + $errs + " == errors) { " + def_customError + " } else {  for (var " + $i + "=" + $errs + "; " + $i + "<errors; " + $i + "++) { var " + $ruleErr + " = vErrors[" + $i + "]; if (" + $ruleErr + ".dataPath === undefined) " + $ruleErr + ".dataPath = (dataPath || '') + " + it.errorPath + "; if (" + $ruleErr + ".schemaPath === undefined) { " + $ruleErr + '.schemaPath = "' + $errSchemaPath + '"; } ';
                        if (it.opts.verbose) {
                            out += " " + $ruleErr + ".schema = " + $schemaValue + "; " + $ruleErr + ".data = " + $data + "; ";
                        }
                        out += " } } ";
                    }
                }
            } else if ($macro) {
                out += "   var err =   ";
                if (it.createErrors !== false) {
                    out += " { keyword: '" + ($errorKeyword || "custom") + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { keyword: '" + $rule.keyword + "' } ";
                    if (it.opts.messages !== false) {
                        out += " , message: 'should pass \"" + $rule.keyword + "\" keyword validation' ";
                    }
                    if (it.opts.verbose) {
                        out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                    }
                    out += " } ";
                } else {
                    out += " {} ";
                }
                out += ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                if (!it.compositeRule && $breakOnError) {
                    if (it.async) {
                        out += " throw new ValidationError(vErrors); ";
                    } else {
                        out += " validate.errors = vErrors; return false; ";
                    }
                }
            } else {
                if ($rDef.errors === false) {
                    out += " " + def_customError + " ";
                } else {
                    out += " if (Array.isArray(" + $ruleErrs + ")) { if (vErrors === null) vErrors = " + $ruleErrs + "; else vErrors = vErrors.concat(" + $ruleErrs + "); errors = vErrors.length;  for (var " + $i + "=" + $errs + "; " + $i + "<errors; " + $i + "++) { var " + $ruleErr + " = vErrors[" + $i + "]; if (" + $ruleErr + ".dataPath === undefined) " + $ruleErr + ".dataPath = (dataPath || '') + " + it.errorPath + ";  " + $ruleErr + '.schemaPath = "' + $errSchemaPath + '";  ';
                    if (it.opts.verbose) {
                        out += " " + $ruleErr + ".schema = " + $schemaValue + "; " + $ruleErr + ".data = " + $data + "; ";
                    }
                    out += " } } else { " + def_customError + " } ";
                }
            }
            out += " } ";
            if ($breakOnError) {
                out += " else { ";
            }
        }
        return out;
    };
    return custom;
}

var $schema$1 = "http://json-schema.org/draft-07/schema#";

var $id$1 = "http://json-schema.org/draft-07/schema#";

var title = "Core schema meta-schema";

var definitions = {
    schemaArray: {
        type: "array",
        minItems: 1,
        items: {
            $ref: "#"
        }
    },
    nonNegativeInteger: {
        type: "integer",
        minimum: 0
    },
    nonNegativeIntegerDefault0: {
        allOf: [ {
            $ref: "#/definitions/nonNegativeInteger"
        }, {
            default: 0
        } ]
    },
    simpleTypes: {
        enum: [ "array", "boolean", "integer", "null", "number", "object", "string" ]
    },
    stringArray: {
        type: "array",
        items: {
            type: "string"
        },
        uniqueItems: true,
        default: []
    }
};

var type$1 = [ "object", "boolean" ];

var properties$1 = {
    $id: {
        type: "string",
        format: "uri-reference"
    },
    $schema: {
        type: "string",
        format: "uri"
    },
    $ref: {
        type: "string",
        format: "uri-reference"
    },
    $comment: {
        type: "string"
    },
    title: {
        type: "string"
    },
    description: {
        type: "string"
    },
    default: true,
    readOnly: {
        type: "boolean",
        default: false
    },
    examples: {
        type: "array",
        items: true
    },
    multipleOf: {
        type: "number",
        exclusiveMinimum: 0
    },
    maximum: {
        type: "number"
    },
    exclusiveMaximum: {
        type: "number"
    },
    minimum: {
        type: "number"
    },
    exclusiveMinimum: {
        type: "number"
    },
    maxLength: {
        $ref: "#/definitions/nonNegativeInteger"
    },
    minLength: {
        $ref: "#/definitions/nonNegativeIntegerDefault0"
    },
    pattern: {
        type: "string",
        format: "regex"
    },
    additionalItems: {
        $ref: "#"
    },
    items: {
        anyOf: [ {
            $ref: "#"
        }, {
            $ref: "#/definitions/schemaArray"
        } ],
        default: true
    },
    maxItems: {
        $ref: "#/definitions/nonNegativeInteger"
    },
    minItems: {
        $ref: "#/definitions/nonNegativeIntegerDefault0"
    },
    uniqueItems: {
        type: "boolean",
        default: false
    },
    contains: {
        $ref: "#"
    },
    maxProperties: {
        $ref: "#/definitions/nonNegativeInteger"
    },
    minProperties: {
        $ref: "#/definitions/nonNegativeIntegerDefault0"
    },
    required: {
        $ref: "#/definitions/stringArray"
    },
    additionalProperties: {
        $ref: "#"
    },
    definitions: {
        type: "object",
        additionalProperties: {
            $ref: "#"
        },
        default: {}
    },
    properties: {
        type: "object",
        additionalProperties: {
            $ref: "#"
        },
        default: {}
    },
    patternProperties: {
        type: "object",
        additionalProperties: {
            $ref: "#"
        },
        propertyNames: {
            format: "regex"
        },
        default: {}
    },
    dependencies: {
        type: "object",
        additionalProperties: {
            anyOf: [ {
                $ref: "#"
            }, {
                $ref: "#/definitions/stringArray"
            } ]
        }
    },
    propertyNames: {
        $ref: "#"
    },
    const: true,
    enum: {
        type: "array",
        items: true,
        minItems: 1,
        uniqueItems: true
    },
    type: {
        anyOf: [ {
            $ref: "#/definitions/simpleTypes"
        }, {
            type: "array",
            items: {
                $ref: "#/definitions/simpleTypes"
            },
            minItems: 1,
            uniqueItems: true
        } ]
    },
    format: {
        type: "string"
    },
    contentMediaType: {
        type: "string"
    },
    contentEncoding: {
        type: "string"
    },
    if: {
        $ref: "#"
    },
    then: {
        $ref: "#"
    },
    else: {
        $ref: "#"
    },
    allOf: {
        $ref: "#/definitions/schemaArray"
    },
    anyOf: {
        $ref: "#/definitions/schemaArray"
    },
    oneOf: {
        $ref: "#/definitions/schemaArray"
    },
    not: {
        $ref: "#"
    }
};

var require$$13 = {
    $schema: $schema$1,
    $id: $id$1,
    title,
    definitions,
    type: type$1,
    properties: properties$1,
    default: true
};

var definition_schema;

var hasRequiredDefinition_schema;

function requireDefinition_schema() {
    if (hasRequiredDefinition_schema) return definition_schema;
    hasRequiredDefinition_schema = 1;
    var metaSchema = require$$13;
    definition_schema = {
        $id: "https://github.com/ajv-validator/ajv/blob/master/lib/definition_schema.js",
        definitions: {
            simpleTypes: metaSchema.definitions.simpleTypes
        },
        type: "object",
        dependencies: {
            schema: [ "validate" ],
            $data: [ "validate" ],
            statements: [ "inline" ],
            valid: {
                not: {
                    required: [ "macro" ]
                }
            }
        },
        properties: {
            type: metaSchema.properties.type,
            schema: {
                type: "boolean"
            },
            statements: {
                type: "boolean"
            },
            dependencies: {
                type: "array",
                items: {
                    type: "string"
                }
            },
            metaSchema: {
                type: "object"
            },
            modifying: {
                type: "boolean"
            },
            valid: {
                type: "boolean"
            },
            $data: {
                type: "boolean"
            },
            async: {
                type: "boolean"
            },
            errors: {
                anyOf: [ {
                    type: "boolean"
                }, {
                    const: "full"
                } ]
            }
        }
    };
    return definition_schema;
}

var keyword;

var hasRequiredKeyword;

function requireKeyword() {
    if (hasRequiredKeyword) return keyword;
    hasRequiredKeyword = 1;
    var IDENTIFIER = /^[a-z_$][a-z0-9_$-]*$/i;
    var customRuleCode = requireCustom();
    var definitionSchema = requireDefinition_schema();
    keyword = {
        add: addKeyword,
        get: getKeyword,
        remove: removeKeyword,
        validate: validateKeyword
    };
    function addKeyword(keyword, definition) {
        var RULES = this.RULES;
        if (RULES.keywords[keyword]) throw new Error("Keyword " + keyword + " is already defined");
        if (!IDENTIFIER.test(keyword)) throw new Error("Keyword " + keyword + " is not a valid identifier");
        if (definition) {
            this.validateKeyword(definition, true);
            var dataType = definition.type;
            if (Array.isArray(dataType)) {
                for (var i = 0; i < dataType.length; i++) _addRule(keyword, dataType[i], definition);
            } else {
                _addRule(keyword, dataType, definition);
            }
            var metaSchema = definition.metaSchema;
            if (metaSchema) {
                if (definition.$data && this._opts.$data) {
                    metaSchema = {
                        anyOf: [ metaSchema, {
                            $ref: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#"
                        } ]
                    };
                }
                definition.validateSchema = this.compile(metaSchema, true);
            }
        }
        RULES.keywords[keyword] = RULES.all[keyword] = true;
        function _addRule(keyword, dataType, definition) {
            var ruleGroup;
            for (var i = 0; i < RULES.length; i++) {
                var rg = RULES[i];
                if (rg.type == dataType) {
                    ruleGroup = rg;
                    break;
                }
            }
            if (!ruleGroup) {
                ruleGroup = {
                    type: dataType,
                    rules: []
                };
                RULES.push(ruleGroup);
            }
            var rule = {
                keyword,
                definition,
                custom: true,
                code: customRuleCode,
                implements: definition.implements
            };
            ruleGroup.rules.push(rule);
            RULES.custom[keyword] = rule;
        }
        return this;
    }
    function getKeyword(keyword) {
        var rule = this.RULES.custom[keyword];
        return rule ? rule.definition : this.RULES.keywords[keyword] || false;
    }
    function removeKeyword(keyword) {
        var RULES = this.RULES;
        delete RULES.keywords[keyword];
        delete RULES.all[keyword];
        delete RULES.custom[keyword];
        for (var i = 0; i < RULES.length; i++) {
            var rules = RULES[i].rules;
            for (var j = 0; j < rules.length; j++) {
                if (rules[j].keyword == keyword) {
                    rules.splice(j, 1);
                    break;
                }
            }
        }
        return this;
    }
    function validateKeyword(definition, throwError) {
        validateKeyword.errors = null;
        var v = this._validateKeyword = this._validateKeyword || this.compile(definitionSchema, true);
        if (v(definition)) return true;
        validateKeyword.errors = v.errors;
        if (throwError) throw new Error("custom keyword definition is invalid: " + this.errorsText(v.errors)); else return false;
    }
    return keyword;
}

var $schema = "http://json-schema.org/draft-07/schema#";

var $id = "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#";

var description = "Meta-schema for $data reference (JSON Schema extension proposal)";

var type = "object";

var required = [ "$data" ];

var properties = {
    $data: {
        type: "string",
        anyOf: [ {
            format: "relative-json-pointer"
        }, {
            format: "json-pointer"
        } ]
    }
};

var additionalProperties = false;

var require$$12 = {
    $schema,
    $id,
    description,
    type,
    required,
    properties,
    additionalProperties
};

var ajv;

var hasRequiredAjv;

function requireAjv() {
    if (hasRequiredAjv) return ajv;
    hasRequiredAjv = 1;
    var compileSchema = requireCompile(), resolve = requireResolve(), Cache = requireCache(), SchemaObject = requireSchema_obj(), stableStringify = requireFastJsonStableStringify(), formats = requireFormats(), rules = requireRules(), $dataMetaSchema = requireData(), util = requireUtil();
    ajv = Ajv;
    Ajv.prototype.validate = validate;
    Ajv.prototype.compile = compile;
    Ajv.prototype.addSchema = addSchema;
    Ajv.prototype.addMetaSchema = addMetaSchema;
    Ajv.prototype.validateSchema = validateSchema;
    Ajv.prototype.getSchema = getSchema;
    Ajv.prototype.removeSchema = removeSchema;
    Ajv.prototype.addFormat = addFormat;
    Ajv.prototype.errorsText = errorsText;
    Ajv.prototype._addSchema = _addSchema;
    Ajv.prototype._compile = _compile;
    Ajv.prototype.compileAsync = requireAsync();
    var customKeyword = requireKeyword();
    Ajv.prototype.addKeyword = customKeyword.add;
    Ajv.prototype.getKeyword = customKeyword.get;
    Ajv.prototype.removeKeyword = customKeyword.remove;
    Ajv.prototype.validateKeyword = customKeyword.validate;
    var errorClasses = requireError_classes();
    Ajv.ValidationError = errorClasses.Validation;
    Ajv.MissingRefError = errorClasses.MissingRef;
    Ajv.$dataMetaSchema = $dataMetaSchema;
    var META_SCHEMA_ID = "http://json-schema.org/draft-07/schema";
    var META_IGNORE_OPTIONS = [ "removeAdditional", "useDefaults", "coerceTypes", "strictDefaults" ];
    var META_SUPPORT_DATA = [ "/properties" ];
    function Ajv(opts) {
        if (!(this instanceof Ajv)) return new Ajv(opts);
        opts = this._opts = util.copy(opts) || {};
        setLogger(this);
        this._schemas = {};
        this._refs = {};
        this._fragments = {};
        this._formats = formats(opts.format);
        this._cache = opts.cache || new Cache;
        this._loadingSchemas = {};
        this._compilations = [];
        this.RULES = rules();
        this._getId = chooseGetId(opts);
        opts.loopRequired = opts.loopRequired || Infinity;
        if (opts.errorDataPath == "property") opts._errorDataPathProperty = true;
        if (opts.serialize === undefined) opts.serialize = stableStringify;
        this._metaOpts = getMetaSchemaOptions(this);
        if (opts.formats) addInitialFormats(this);
        if (opts.keywords) addInitialKeywords(this);
        addDefaultMetaSchema(this);
        if (typeof opts.meta == "object") this.addMetaSchema(opts.meta);
        if (opts.nullable) this.addKeyword("nullable", {
            metaSchema: {
                type: "boolean"
            }
        });
        addInitialSchemas(this);
    }
    function validate(schemaKeyRef, data) {
        var v;
        if (typeof schemaKeyRef == "string") {
            v = this.getSchema(schemaKeyRef);
            if (!v) throw new Error('no schema with key or ref "' + schemaKeyRef + '"');
        } else {
            var schemaObj = this._addSchema(schemaKeyRef);
            v = schemaObj.validate || this._compile(schemaObj);
        }
        var valid = v(data);
        if (v.$async !== true) this.errors = v.errors;
        return valid;
    }
    function compile(schema, _meta) {
        var schemaObj = this._addSchema(schema, undefined, _meta);
        return schemaObj.validate || this._compile(schemaObj);
    }
    function addSchema(schema, key, _skipValidation, _meta) {
        if (Array.isArray(schema)) {
            for (var i = 0; i < schema.length; i++) this.addSchema(schema[i], undefined, _skipValidation, _meta);
            return this;
        }
        var id = this._getId(schema);
        if (id !== undefined && typeof id != "string") throw new Error("schema id must be string");
        key = resolve.normalizeId(key || id);
        checkUnique(this, key);
        this._schemas[key] = this._addSchema(schema, _skipValidation, _meta, true);
        return this;
    }
    function addMetaSchema(schema, key, skipValidation) {
        this.addSchema(schema, key, skipValidation, true);
        return this;
    }
    function validateSchema(schema, throwOrLogError) {
        var $schema = schema.$schema;
        if ($schema !== undefined && typeof $schema != "string") throw new Error("$schema must be a string");
        $schema = $schema || this._opts.defaultMeta || defaultMeta(this);
        if (!$schema) {
            this.logger.warn("meta-schema not available");
            this.errors = null;
            return true;
        }
        var valid = this.validate($schema, schema);
        if (!valid && throwOrLogError) {
            var message = "schema is invalid: " + this.errorsText();
            if (this._opts.validateSchema == "log") this.logger.error(message); else throw new Error(message);
        }
        return valid;
    }
    function defaultMeta(self) {
        var meta = self._opts.meta;
        self._opts.defaultMeta = typeof meta == "object" ? self._getId(meta) || meta : self.getSchema(META_SCHEMA_ID) ? META_SCHEMA_ID : undefined;
        return self._opts.defaultMeta;
    }
    function getSchema(keyRef) {
        var schemaObj = _getSchemaObj(this, keyRef);
        switch (typeof schemaObj) {
          case "object":
            return schemaObj.validate || this._compile(schemaObj);

          case "string":
            return this.getSchema(schemaObj);

          case "undefined":
            return _getSchemaFragment(this, keyRef);
        }
    }
    function _getSchemaFragment(self, ref) {
        var res = resolve.schema.call(self, {
            schema: {}
        }, ref);
        if (res) {
            var schema = res.schema, root = res.root, baseId = res.baseId;
            var v = compileSchema.call(self, schema, root, undefined, baseId);
            self._fragments[ref] = new SchemaObject({
                ref,
                fragment: true,
                schema,
                root,
                baseId,
                validate: v
            });
            return v;
        }
    }
    function _getSchemaObj(self, keyRef) {
        keyRef = resolve.normalizeId(keyRef);
        return self._schemas[keyRef] || self._refs[keyRef] || self._fragments[keyRef];
    }
    function removeSchema(schemaKeyRef) {
        if (schemaKeyRef instanceof RegExp) {
            _removeAllSchemas(this, this._schemas, schemaKeyRef);
            _removeAllSchemas(this, this._refs, schemaKeyRef);
            return this;
        }
        switch (typeof schemaKeyRef) {
          case "undefined":
            _removeAllSchemas(this, this._schemas);
            _removeAllSchemas(this, this._refs);
            this._cache.clear();
            return this;

          case "string":
            var schemaObj = _getSchemaObj(this, schemaKeyRef);
            if (schemaObj) this._cache.del(schemaObj.cacheKey);
            delete this._schemas[schemaKeyRef];
            delete this._refs[schemaKeyRef];
            return this;

          case "object":
            var serialize = this._opts.serialize;
            var cacheKey = serialize ? serialize(schemaKeyRef) : schemaKeyRef;
            this._cache.del(cacheKey);
            var id = this._getId(schemaKeyRef);
            if (id) {
                id = resolve.normalizeId(id);
                delete this._schemas[id];
                delete this._refs[id];
            }
        }
        return this;
    }
    function _removeAllSchemas(self, schemas, regex) {
        for (var keyRef in schemas) {
            var schemaObj = schemas[keyRef];
            if (!schemaObj.meta && (!regex || regex.test(keyRef))) {
                self._cache.del(schemaObj.cacheKey);
                delete schemas[keyRef];
            }
        }
    }
    function _addSchema(schema, skipValidation, meta, shouldAddSchema) {
        if (typeof schema != "object" && typeof schema != "boolean") throw new Error("schema should be object or boolean");
        var serialize = this._opts.serialize;
        var cacheKey = serialize ? serialize(schema) : schema;
        var cached = this._cache.get(cacheKey);
        if (cached) return cached;
        shouldAddSchema = shouldAddSchema || this._opts.addUsedSchema !== false;
        var id = resolve.normalizeId(this._getId(schema));
        if (id && shouldAddSchema) checkUnique(this, id);
        var willValidate = this._opts.validateSchema !== false && !skipValidation;
        var recursiveMeta;
        if (willValidate && !(recursiveMeta = id && id == resolve.normalizeId(schema.$schema))) this.validateSchema(schema, true);
        var localRefs = resolve.ids.call(this, schema);
        var schemaObj = new SchemaObject({
            id,
            schema,
            localRefs,
            cacheKey,
            meta
        });
        if (id[0] != "#" && shouldAddSchema) this._refs[id] = schemaObj;
        this._cache.put(cacheKey, schemaObj);
        if (willValidate && recursiveMeta) this.validateSchema(schema, true);
        return schemaObj;
    }
    function _compile(schemaObj, root) {
        if (schemaObj.compiling) {
            schemaObj.validate = callValidate;
            callValidate.schema = schemaObj.schema;
            callValidate.errors = null;
            callValidate.root = root ? root : callValidate;
            if (schemaObj.schema.$async === true) callValidate.$async = true;
            return callValidate;
        }
        schemaObj.compiling = true;
        var currentOpts;
        if (schemaObj.meta) {
            currentOpts = this._opts;
            this._opts = this._metaOpts;
        }
        var v;
        try {
            v = compileSchema.call(this, schemaObj.schema, root, schemaObj.localRefs);
        } catch (e) {
            delete schemaObj.validate;
            throw e;
        } finally {
            schemaObj.compiling = false;
            if (schemaObj.meta) this._opts = currentOpts;
        }
        schemaObj.validate = v;
        schemaObj.refs = v.refs;
        schemaObj.refVal = v.refVal;
        schemaObj.root = v.root;
        return v;
        function callValidate() {
            var _validate = schemaObj.validate;
            var result = _validate.apply(this, arguments);
            callValidate.errors = _validate.errors;
            return result;
        }
    }
    function chooseGetId(opts) {
        switch (opts.schemaId) {
          case "auto":
            return _get$IdOrId;

          case "id":
            return _getId;

          default:
            return _get$Id;
        }
    }
    function _getId(schema) {
        if (schema.$id) this.logger.warn("schema $id ignored", schema.$id);
        return schema.id;
    }
    function _get$Id(schema) {
        if (schema.id) this.logger.warn("schema id ignored", schema.id);
        return schema.$id;
    }
    function _get$IdOrId(schema) {
        if (schema.$id && schema.id && schema.$id != schema.id) throw new Error("schema $id is different from id");
        return schema.$id || schema.id;
    }
    function errorsText(errors, options) {
        errors = errors || this.errors;
        if (!errors) return "No errors";
        options = options || {};
        var separator = options.separator === undefined ? ", " : options.separator;
        var dataVar = options.dataVar === undefined ? "data" : options.dataVar;
        var text = "";
        for (var i = 0; i < errors.length; i++) {
            var e = errors[i];
            if (e) text += dataVar + e.dataPath + " " + e.message + separator;
        }
        return text.slice(0, -separator.length);
    }
    function addFormat(name, format) {
        if (typeof format == "string") format = new RegExp(format);
        this._formats[name] = format;
        return this;
    }
    function addDefaultMetaSchema(self) {
        var $dataSchema;
        if (self._opts.$data) {
            $dataSchema = require$$12;
            self.addMetaSchema($dataSchema, $dataSchema.$id, true);
        }
        if (self._opts.meta === false) return;
        var metaSchema = require$$13;
        if (self._opts.$data) metaSchema = $dataMetaSchema(metaSchema, META_SUPPORT_DATA);
        self.addMetaSchema(metaSchema, META_SCHEMA_ID, true);
        self._refs["http://json-schema.org/schema"] = META_SCHEMA_ID;
    }
    function addInitialSchemas(self) {
        var optsSchemas = self._opts.schemas;
        if (!optsSchemas) return;
        if (Array.isArray(optsSchemas)) self.addSchema(optsSchemas); else for (var key in optsSchemas) self.addSchema(optsSchemas[key], key);
    }
    function addInitialFormats(self) {
        for (var name in self._opts.formats) {
            var format = self._opts.formats[name];
            self.addFormat(name, format);
        }
    }
    function addInitialKeywords(self) {
        for (var name in self._opts.keywords) {
            var keyword = self._opts.keywords[name];
            self.addKeyword(name, keyword);
        }
    }
    function checkUnique(self, id) {
        if (self._schemas[id] || self._refs[id]) throw new Error('schema with key or id "' + id + '" already exists');
    }
    function getMetaSchemaOptions(self) {
        var metaOpts = util.copy(self._opts);
        for (var i = 0; i < META_IGNORE_OPTIONS.length; i++) delete metaOpts[META_IGNORE_OPTIONS[i]];
        return metaOpts;
    }
    function setLogger(self) {
        var logger = self._opts.logger;
        if (logger === false) {
            self.logger = {
                log: noop,
                warn: noop,
                error: noop
            };
        } else {
            if (logger === undefined) logger = console;
            if (!(typeof logger == "object" && logger.log && logger.warn && logger.error)) throw new Error("logger must implement log, warn and error methods");
            self.logger = logger;
        }
    }
    function noop() {}
    return ajv;
}

var ajvExports = requireAjv();

var Ajv = getDefaultExportFromCjs(ajvExports);

class Server extends Protocol {
    constructor(_serverInfo, options) {
        var _a;
        super(options);
        this._serverInfo = _serverInfo;
        this._capabilities = (_a = options === null || options === void 0 ? void 0 : options.capabilities) !== null && _a !== void 0 ? _a : {};
        this._instructions = options === null || options === void 0 ? void 0 : options.instructions;
        this.setRequestHandler(InitializeRequestSchema, request => this._oninitialize(request));
        this.setNotificationHandler(InitializedNotificationSchema, () => {
            var _a;
            return (_a = this.oninitialized) === null || _a === void 0 ? void 0 : _a.call(this);
        });
    }
    registerCapabilities(capabilities) {
        if (this.transport) {
            throw new Error("Cannot register capabilities after connecting to transport");
        }
        this._capabilities = mergeCapabilities(this._capabilities, capabilities);
    }
    assertCapabilityForMethod(method) {
        var _a, _b, _c;
        switch (method) {
          case "sampling/createMessage":
            if (!((_a = this._clientCapabilities) === null || _a === void 0 ? void 0 : _a.sampling)) {
                throw new Error(`Client does not support sampling (required for ${method})`);
            }
            break;

          case "elicitation/create":
            if (!((_b = this._clientCapabilities) === null || _b === void 0 ? void 0 : _b.elicitation)) {
                throw new Error(`Client does not support elicitation (required for ${method})`);
            }
            break;

          case "roots/list":
            if (!((_c = this._clientCapabilities) === null || _c === void 0 ? void 0 : _c.roots)) {
                throw new Error(`Client does not support listing roots (required for ${method})`);
            }
            break;
        }
    }
    assertNotificationCapability(method) {
        switch (method) {
          case "notifications/message":
            if (!this._capabilities.logging) {
                throw new Error(`Server does not support logging (required for ${method})`);
            }
            break;

          case "notifications/resources/updated":
          case "notifications/resources/list_changed":
            if (!this._capabilities.resources) {
                throw new Error(`Server does not support notifying about resources (required for ${method})`);
            }
            break;

          case "notifications/tools/list_changed":
            if (!this._capabilities.tools) {
                throw new Error(`Server does not support notifying of tool list changes (required for ${method})`);
            }
            break;

          case "notifications/prompts/list_changed":
            if (!this._capabilities.prompts) {
                throw new Error(`Server does not support notifying of prompt list changes (required for ${method})`);
            }
            break;
        }
    }
    assertRequestHandlerCapability(method) {
        switch (method) {
          case "sampling/createMessage":
            if (!this._capabilities.sampling) {
                throw new Error(`Server does not support sampling (required for ${method})`);
            }
            break;

          case "logging/setLevel":
            if (!this._capabilities.logging) {
                throw new Error(`Server does not support logging (required for ${method})`);
            }
            break;

          case "prompts/get":
          case "prompts/list":
            if (!this._capabilities.prompts) {
                throw new Error(`Server does not support prompts (required for ${method})`);
            }
            break;

          case "resources/list":
          case "resources/templates/list":
          case "resources/read":
            if (!this._capabilities.resources) {
                throw new Error(`Server does not support resources (required for ${method})`);
            }
            break;

          case "tools/call":
          case "tools/list":
            if (!this._capabilities.tools) {
                throw new Error(`Server does not support tools (required for ${method})`);
            }
            break;
        }
    }
    async _oninitialize(request) {
        const requestedVersion = request.params.protocolVersion;
        this._clientCapabilities = request.params.capabilities;
        this._clientVersion = request.params.clientInfo;
        const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion) ? requestedVersion : LATEST_PROTOCOL_VERSION;
        return {
            protocolVersion,
            capabilities: this.getCapabilities(),
            serverInfo: this._serverInfo,
            ...this._instructions && {
                instructions: this._instructions
            }
        };
    }
    getClientCapabilities() {
        return this._clientCapabilities;
    }
    getClientVersion() {
        return this._clientVersion;
    }
    getCapabilities() {
        return this._capabilities;
    }
    async ping() {
        return this.request({
            method: "ping"
        }, EmptyResultSchema);
    }
    async createMessage(params, options) {
        return this.request({
            method: "sampling/createMessage",
            params
        }, CreateMessageResultSchema, options);
    }
    async elicitInput(params, options) {
        const result = await this.request({
            method: "elicitation/create",
            params
        }, ElicitResultSchema, options);
        if (result.action === "accept" && result.content) {
            try {
                const ajv = new Ajv;
                const validate = ajv.compile(params.requestedSchema);
                const isValid = validate(result.content);
                if (!isValid) {
                    throw new McpError(ErrorCode.InvalidParams, `Elicitation response content does not match requested schema: ${ajv.errorsText(validate.errors)}`);
                }
            } catch (error) {
                if (error instanceof McpError) {
                    throw error;
                }
                throw new McpError(ErrorCode.InternalError, `Error validating elicitation response: ${error}`);
            }
        }
        return result;
    }
    async listRoots(params, options) {
        return this.request({
            method: "roots/list",
            params
        }, ListRootsResultSchema, options);
    }
    async sendLoggingMessage(params) {
        return this.notification({
            method: "notifications/message",
            params
        });
    }
    async sendResourceUpdated(params) {
        return this.notification({
            method: "notifications/resources/updated",
            params
        });
    }
    async sendResourceListChanged() {
        return this.notification({
            method: "notifications/resources/list_changed"
        });
    }
    async sendToolListChanged() {
        return this.notification({
            method: "notifications/tools/list_changed"
        });
    }
    async sendPromptListChanged() {
        return this.notification({
            method: "notifications/prompts/list_changed"
        });
    }
}

const ignoreOverride = Symbol("Let zodToJsonSchema decide on which parser to use");

const defaultOptions = {
    name: undefined,
    $refStrategy: "root",
    basePath: [ "#" ],
    effectStrategy: "input",
    pipeStrategy: "all",
    dateStrategy: "format:date-time",
    mapStrategy: "entries",
    removeAdditionalStrategy: "passthrough",
    allowedAdditionalProperties: true,
    rejectedAdditionalProperties: false,
    definitionPath: "definitions",
    target: "jsonSchema7",
    strictUnions: false,
    definitions: {},
    errorMessages: false,
    markdownDescription: false,
    patternStrategy: "escape",
    applyRegexFlags: false,
    emailStrategy: "format:email",
    base64Strategy: "contentEncoding:base64",
    nameStrategy: "ref",
    openAiAnyTypeName: "OpenAiAnyType"
};

const getDefaultOptions = options => typeof options === "string" ? {
    ...defaultOptions,
    name: options
} : {
    ...defaultOptions,
    ...options
};

const getRefs = options => {
    const _options = getDefaultOptions(options);
    const currentPath = _options.name !== undefined ? [ ..._options.basePath, _options.definitionPath, _options.name ] : _options.basePath;
    return {
        ..._options,
        flags: {
            hasReferencedOpenAiAnyType: false
        },
        currentPath,
        propertyPath: undefined,
        seen: new Map(Object.entries(_options.definitions).map(([name, def]) => [ def._def, {
            def: def._def,
            path: [ ..._options.basePath, _options.definitionPath, name ],
            jsonSchema: undefined
        } ]))
    };
};

function addErrorMessage(res, key, errorMessage, refs) {
    if (!refs?.errorMessages) return;
    if (errorMessage) {
        res.errorMessage = {
            ...res.errorMessage,
            [key]: errorMessage
        };
    }
}

function setResponseValueAndErrors(res, key, value, errorMessage, refs) {
    res[key] = value;
    addErrorMessage(res, key, errorMessage, refs);
}

const getRelativePath = (pathA, pathB) => {
    let i = 0;
    for (;i < pathA.length && i < pathB.length; i++) {
        if (pathA[i] !== pathB[i]) break;
    }
    return [ (pathA.length - i).toString(), ...pathB.slice(i) ].join("/");
};

function parseAnyDef(refs) {
    if (refs.target !== "openAi") {
        return {};
    }
    const anyDefinitionPath = [ ...refs.basePath, refs.definitionPath, refs.openAiAnyTypeName ];
    refs.flags.hasReferencedOpenAiAnyType = true;
    return {
        $ref: refs.$refStrategy === "relative" ? getRelativePath(anyDefinitionPath, refs.currentPath) : anyDefinitionPath.join("/")
    };
}

function parseArrayDef(def, refs) {
    const res = {
        type: "array"
    };
    if (def.type?._def && def.type?._def?.typeName !== ZodFirstPartyTypeKind.ZodAny) {
        res.items = parseDef(def.type._def, {
            ...refs,
            currentPath: [ ...refs.currentPath, "items" ]
        });
    }
    if (def.minLength) {
        setResponseValueAndErrors(res, "minItems", def.minLength.value, def.minLength.message, refs);
    }
    if (def.maxLength) {
        setResponseValueAndErrors(res, "maxItems", def.maxLength.value, def.maxLength.message, refs);
    }
    if (def.exactLength) {
        setResponseValueAndErrors(res, "minItems", def.exactLength.value, def.exactLength.message, refs);
        setResponseValueAndErrors(res, "maxItems", def.exactLength.value, def.exactLength.message, refs);
    }
    return res;
}

function parseBigintDef(def, refs) {
    const res = {
        type: "integer",
        format: "int64"
    };
    if (!def.checks) return res;
    for (const check of def.checks) {
        switch (check.kind) {
          case "min":
            if (refs.target === "jsonSchema7") {
                if (check.inclusive) {
                    setResponseValueAndErrors(res, "minimum", check.value, check.message, refs);
                } else {
                    setResponseValueAndErrors(res, "exclusiveMinimum", check.value, check.message, refs);
                }
            } else {
                if (!check.inclusive) {
                    res.exclusiveMinimum = true;
                }
                setResponseValueAndErrors(res, "minimum", check.value, check.message, refs);
            }
            break;

          case "max":
            if (refs.target === "jsonSchema7") {
                if (check.inclusive) {
                    setResponseValueAndErrors(res, "maximum", check.value, check.message, refs);
                } else {
                    setResponseValueAndErrors(res, "exclusiveMaximum", check.value, check.message, refs);
                }
            } else {
                if (!check.inclusive) {
                    res.exclusiveMaximum = true;
                }
                setResponseValueAndErrors(res, "maximum", check.value, check.message, refs);
            }
            break;

          case "multipleOf":
            setResponseValueAndErrors(res, "multipleOf", check.value, check.message, refs);
            break;
        }
    }
    return res;
}

function parseBooleanDef() {
    return {
        type: "boolean"
    };
}

function parseBrandedDef(_def, refs) {
    return parseDef(_def.type._def, refs);
}

const parseCatchDef = (def, refs) => parseDef(def.innerType._def, refs);

function parseDateDef(def, refs, overrideDateStrategy) {
    const strategy = overrideDateStrategy ?? refs.dateStrategy;
    if (Array.isArray(strategy)) {
        return {
            anyOf: strategy.map((item, i) => parseDateDef(def, refs, item))
        };
    }
    switch (strategy) {
      case "string":
      case "format:date-time":
        return {
            type: "string",
            format: "date-time"
        };

      case "format:date":
        return {
            type: "string",
            format: "date"
        };

      case "integer":
        return integerDateParser(def, refs);
    }
}

const integerDateParser = (def, refs) => {
    const res = {
        type: "integer",
        format: "unix-time"
    };
    if (refs.target === "openApi3") {
        return res;
    }
    for (const check of def.checks) {
        switch (check.kind) {
          case "min":
            setResponseValueAndErrors(res, "minimum", check.value, check.message, refs);
            break;

          case "max":
            setResponseValueAndErrors(res, "maximum", check.value, check.message, refs);
            break;
        }
    }
    return res;
};

function parseDefaultDef(_def, refs) {
    return {
        ...parseDef(_def.innerType._def, refs),
        default: _def.defaultValue()
    };
}

function parseEffectsDef(_def, refs) {
    return refs.effectStrategy === "input" ? parseDef(_def.schema._def, refs) : parseAnyDef(refs);
}

function parseEnumDef(def) {
    return {
        type: "string",
        enum: Array.from(def.values)
    };
}

const isJsonSchema7AllOfType = type => {
    if ("type" in type && type.type === "string") return false;
    return "allOf" in type;
};

function parseIntersectionDef(def, refs) {
    const allOf = [ parseDef(def.left._def, {
        ...refs,
        currentPath: [ ...refs.currentPath, "allOf", "0" ]
    }), parseDef(def.right._def, {
        ...refs,
        currentPath: [ ...refs.currentPath, "allOf", "1" ]
    }) ].filter(x => !!x);
    let unevaluatedProperties = refs.target === "jsonSchema2019-09" ? {
        unevaluatedProperties: false
    } : undefined;
    const mergedAllOf = [];
    allOf.forEach(schema => {
        if (isJsonSchema7AllOfType(schema)) {
            mergedAllOf.push(...schema.allOf);
            if (schema.unevaluatedProperties === undefined) {
                unevaluatedProperties = undefined;
            }
        } else {
            let nestedSchema = schema;
            if ("additionalProperties" in schema && schema.additionalProperties === false) {
                const {additionalProperties, ...rest} = schema;
                nestedSchema = rest;
            } else {
                unevaluatedProperties = undefined;
            }
            mergedAllOf.push(nestedSchema);
        }
    });
    return mergedAllOf.length ? {
        allOf: mergedAllOf,
        ...unevaluatedProperties
    } : undefined;
}

function parseLiteralDef(def, refs) {
    const parsedType = typeof def.value;
    if (parsedType !== "bigint" && parsedType !== "number" && parsedType !== "boolean" && parsedType !== "string") {
        return {
            type: Array.isArray(def.value) ? "array" : "object"
        };
    }
    if (refs.target === "openApi3") {
        return {
            type: parsedType === "bigint" ? "integer" : parsedType,
            enum: [ def.value ]
        };
    }
    return {
        type: parsedType === "bigint" ? "integer" : parsedType,
        const: def.value
    };
}

let emojiRegex = undefined;

const zodPatterns = {
    cuid: /^[cC][^\s-]{8,}$/,
    cuid2: /^[0-9a-z]+$/,
    ulid: /^[0-9A-HJKMNP-TV-Z]{26}$/,
    email: /^(?!\.)(?!.*\.\.)([a-zA-Z0-9_'+\-\.]*)[a-zA-Z0-9_+-]@([a-zA-Z0-9][a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}$/,
    emoji: () => {
        if (emojiRegex === undefined) {
            emojiRegex = RegExp("^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$", "u");
        }
        return emojiRegex;
    },
    uuid: /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/,
    ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,
    ipv4Cidr: /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/,
    ipv6: /^(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))$/,
    ipv6Cidr: /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,
    base64: /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/,
    base64url: /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/,
    nanoid: /^[a-zA-Z0-9_-]{21}$/,
    jwt: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/
};

function parseStringDef(def, refs) {
    const res = {
        type: "string"
    };
    if (def.checks) {
        for (const check of def.checks) {
            switch (check.kind) {
              case "min":
                setResponseValueAndErrors(res, "minLength", typeof res.minLength === "number" ? Math.max(res.minLength, check.value) : check.value, check.message, refs);
                break;

              case "max":
                setResponseValueAndErrors(res, "maxLength", typeof res.maxLength === "number" ? Math.min(res.maxLength, check.value) : check.value, check.message, refs);
                break;

              case "email":
                switch (refs.emailStrategy) {
                  case "format:email":
                    addFormat(res, "email", check.message, refs);
                    break;

                  case "format:idn-email":
                    addFormat(res, "idn-email", check.message, refs);
                    break;

                  case "pattern:zod":
                    addPattern(res, zodPatterns.email, check.message, refs);
                    break;
                }
                break;

              case "url":
                addFormat(res, "uri", check.message, refs);
                break;

              case "uuid":
                addFormat(res, "uuid", check.message, refs);
                break;

              case "regex":
                addPattern(res, check.regex, check.message, refs);
                break;

              case "cuid":
                addPattern(res, zodPatterns.cuid, check.message, refs);
                break;

              case "cuid2":
                addPattern(res, zodPatterns.cuid2, check.message, refs);
                break;

              case "startsWith":
                addPattern(res, RegExp(`^${escapeLiteralCheckValue(check.value, refs)}`), check.message, refs);
                break;

              case "endsWith":
                addPattern(res, RegExp(`${escapeLiteralCheckValue(check.value, refs)}$`), check.message, refs);
                break;

              case "datetime":
                addFormat(res, "date-time", check.message, refs);
                break;

              case "date":
                addFormat(res, "date", check.message, refs);
                break;

              case "time":
                addFormat(res, "time", check.message, refs);
                break;

              case "duration":
                addFormat(res, "duration", check.message, refs);
                break;

              case "length":
                setResponseValueAndErrors(res, "minLength", typeof res.minLength === "number" ? Math.max(res.minLength, check.value) : check.value, check.message, refs);
                setResponseValueAndErrors(res, "maxLength", typeof res.maxLength === "number" ? Math.min(res.maxLength, check.value) : check.value, check.message, refs);
                break;

              case "includes":
                {
                    addPattern(res, RegExp(escapeLiteralCheckValue(check.value, refs)), check.message, refs);
                    break;
                }

              case "ip":
                {
                    if (check.version !== "v6") {
                        addFormat(res, "ipv4", check.message, refs);
                    }
                    if (check.version !== "v4") {
                        addFormat(res, "ipv6", check.message, refs);
                    }
                    break;
                }

              case "base64url":
                addPattern(res, zodPatterns.base64url, check.message, refs);
                break;

              case "jwt":
                addPattern(res, zodPatterns.jwt, check.message, refs);
                break;

              case "cidr":
                {
                    if (check.version !== "v6") {
                        addPattern(res, zodPatterns.ipv4Cidr, check.message, refs);
                    }
                    if (check.version !== "v4") {
                        addPattern(res, zodPatterns.ipv6Cidr, check.message, refs);
                    }
                    break;
                }

              case "emoji":
                addPattern(res, zodPatterns.emoji(), check.message, refs);
                break;

              case "ulid":
                {
                    addPattern(res, zodPatterns.ulid, check.message, refs);
                    break;
                }

              case "base64":
                {
                    switch (refs.base64Strategy) {
                      case "format:binary":
                        {
                            addFormat(res, "binary", check.message, refs);
                            break;
                        }

                      case "contentEncoding:base64":
                        {
                            setResponseValueAndErrors(res, "contentEncoding", "base64", check.message, refs);
                            break;
                        }

                      case "pattern:zod":
                        {
                            addPattern(res, zodPatterns.base64, check.message, refs);
                            break;
                        }
                    }
                    break;
                }

              case "nanoid":
                {
                    addPattern(res, zodPatterns.nanoid, check.message, refs);
                }
            }
        }
    }
    return res;
}

function escapeLiteralCheckValue(literal, refs) {
    return refs.patternStrategy === "escape" ? escapeNonAlphaNumeric(literal) : literal;
}

const ALPHA_NUMERIC = new Set("ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvxyz0123456789");

function escapeNonAlphaNumeric(source) {
    let result = "";
    for (let i = 0; i < source.length; i++) {
        if (!ALPHA_NUMERIC.has(source[i])) {
            result += "\\";
        }
        result += source[i];
    }
    return result;
}

function addFormat(schema, value, message, refs) {
    if (schema.format || schema.anyOf?.some(x => x.format)) {
        if (!schema.anyOf) {
            schema.anyOf = [];
        }
        if (schema.format) {
            schema.anyOf.push({
                format: schema.format,
                ...schema.errorMessage && refs.errorMessages && {
                    errorMessage: {
                        format: schema.errorMessage.format
                    }
                }
            });
            delete schema.format;
            if (schema.errorMessage) {
                delete schema.errorMessage.format;
                if (Object.keys(schema.errorMessage).length === 0) {
                    delete schema.errorMessage;
                }
            }
        }
        schema.anyOf.push({
            format: value,
            ...message && refs.errorMessages && {
                errorMessage: {
                    format: message
                }
            }
        });
    } else {
        setResponseValueAndErrors(schema, "format", value, message, refs);
    }
}

function addPattern(schema, regex, message, refs) {
    if (schema.pattern || schema.allOf?.some(x => x.pattern)) {
        if (!schema.allOf) {
            schema.allOf = [];
        }
        if (schema.pattern) {
            schema.allOf.push({
                pattern: schema.pattern,
                ...schema.errorMessage && refs.errorMessages && {
                    errorMessage: {
                        pattern: schema.errorMessage.pattern
                    }
                }
            });
            delete schema.pattern;
            if (schema.errorMessage) {
                delete schema.errorMessage.pattern;
                if (Object.keys(schema.errorMessage).length === 0) {
                    delete schema.errorMessage;
                }
            }
        }
        schema.allOf.push({
            pattern: stringifyRegExpWithFlags(regex, refs),
            ...message && refs.errorMessages && {
                errorMessage: {
                    pattern: message
                }
            }
        });
    } else {
        setResponseValueAndErrors(schema, "pattern", stringifyRegExpWithFlags(regex, refs), message, refs);
    }
}

function stringifyRegExpWithFlags(regex, refs) {
    if (!refs.applyRegexFlags || !regex.flags) {
        return regex.source;
    }
    const flags = {
        i: regex.flags.includes("i"),
        m: regex.flags.includes("m"),
        s: regex.flags.includes("s")
    };
    const source = flags.i ? regex.source.toLowerCase() : regex.source;
    let pattern = "";
    let isEscaped = false;
    let inCharGroup = false;
    let inCharRange = false;
    for (let i = 0; i < source.length; i++) {
        if (isEscaped) {
            pattern += source[i];
            isEscaped = false;
            continue;
        }
        if (flags.i) {
            if (inCharGroup) {
                if (source[i].match(/[a-z]/)) {
                    if (inCharRange) {
                        pattern += source[i];
                        pattern += `${source[i - 2]}-${source[i]}`.toUpperCase();
                        inCharRange = false;
                    } else if (source[i + 1] === "-" && source[i + 2]?.match(/[a-z]/)) {
                        pattern += source[i];
                        inCharRange = true;
                    } else {
                        pattern += `${source[i]}${source[i].toUpperCase()}`;
                    }
                    continue;
                }
            } else if (source[i].match(/[a-z]/)) {
                pattern += `[${source[i]}${source[i].toUpperCase()}]`;
                continue;
            }
        }
        if (flags.m) {
            if (source[i] === "^") {
                pattern += `(^|(?<=[\r\n]))`;
                continue;
            } else if (source[i] === "$") {
                pattern += `($|(?=[\r\n]))`;
                continue;
            }
        }
        if (flags.s && source[i] === ".") {
            pattern += inCharGroup ? `${source[i]}\r\n` : `[${source[i]}\r\n]`;
            continue;
        }
        pattern += source[i];
        if (source[i] === "\\") {
            isEscaped = true;
        } else if (inCharGroup && source[i] === "]") {
            inCharGroup = false;
        } else if (!inCharGroup && source[i] === "[") {
            inCharGroup = true;
        }
    }
    try {
        new RegExp(pattern);
    } catch {
        console.warn(`Could not convert regex pattern at ${refs.currentPath.join("/")} to a flag-independent form! Falling back to the flag-ignorant source`);
        return regex.source;
    }
    return pattern;
}

function parseRecordDef(def, refs) {
    if (refs.target === "openAi") {
        console.warn("Warning: OpenAI may not support records in schemas! Try an array of key-value pairs instead.");
    }
    if (refs.target === "openApi3" && def.keyType?._def.typeName === ZodFirstPartyTypeKind.ZodEnum) {
        return {
            type: "object",
            required: def.keyType._def.values,
            properties: def.keyType._def.values.reduce((acc, key) => ({
                ...acc,
                [key]: parseDef(def.valueType._def, {
                    ...refs,
                    currentPath: [ ...refs.currentPath, "properties", key ]
                }) ?? parseAnyDef(refs)
            }), {}),
            additionalProperties: refs.rejectedAdditionalProperties
        };
    }
    const schema = {
        type: "object",
        additionalProperties: parseDef(def.valueType._def, {
            ...refs,
            currentPath: [ ...refs.currentPath, "additionalProperties" ]
        }) ?? refs.allowedAdditionalProperties
    };
    if (refs.target === "openApi3") {
        return schema;
    }
    if (def.keyType?._def.typeName === ZodFirstPartyTypeKind.ZodString && def.keyType._def.checks?.length) {
        const {type, ...keyType} = parseStringDef(def.keyType._def, refs);
        return {
            ...schema,
            propertyNames: keyType
        };
    } else if (def.keyType?._def.typeName === ZodFirstPartyTypeKind.ZodEnum) {
        return {
            ...schema,
            propertyNames: {
                enum: def.keyType._def.values
            }
        };
    } else if (def.keyType?._def.typeName === ZodFirstPartyTypeKind.ZodBranded && def.keyType._def.type._def.typeName === ZodFirstPartyTypeKind.ZodString && def.keyType._def.type._def.checks?.length) {
        const {type, ...keyType} = parseBrandedDef(def.keyType._def, refs);
        return {
            ...schema,
            propertyNames: keyType
        };
    }
    return schema;
}

function parseMapDef(def, refs) {
    if (refs.mapStrategy === "record") {
        return parseRecordDef(def, refs);
    }
    const keys = parseDef(def.keyType._def, {
        ...refs,
        currentPath: [ ...refs.currentPath, "items", "items", "0" ]
    }) || parseAnyDef(refs);
    const values = parseDef(def.valueType._def, {
        ...refs,
        currentPath: [ ...refs.currentPath, "items", "items", "1" ]
    }) || parseAnyDef(refs);
    return {
        type: "array",
        maxItems: 125,
        items: {
            type: "array",
            items: [ keys, values ],
            minItems: 2,
            maxItems: 2
        }
    };
}

function parseNativeEnumDef(def) {
    const object = def.values;
    const actualKeys = Object.keys(def.values).filter(key => typeof object[object[key]] !== "number");
    const actualValues = actualKeys.map(key => object[key]);
    const parsedTypes = Array.from(new Set(actualValues.map(values => typeof values)));
    return {
        type: parsedTypes.length === 1 ? parsedTypes[0] === "string" ? "string" : "number" : [ "string", "number" ],
        enum: actualValues
    };
}

function parseNeverDef(refs) {
    return refs.target === "openAi" ? undefined : {
        not: parseAnyDef({
            ...refs,
            currentPath: [ ...refs.currentPath, "not" ]
        })
    };
}

function parseNullDef(refs) {
    return refs.target === "openApi3" ? {
        enum: [ "null" ],
        nullable: true
    } : {
        type: "null"
    };
}

const primitiveMappings = {
    ZodString: "string",
    ZodNumber: "number",
    ZodBigInt: "integer",
    ZodBoolean: "boolean",
    ZodNull: "null"
};

function parseUnionDef(def, refs) {
    if (refs.target === "openApi3") return asAnyOf(def, refs);
    const options = def.options instanceof Map ? Array.from(def.options.values()) : def.options;
    if (options.every(x => x._def.typeName in primitiveMappings && (!x._def.checks || !x._def.checks.length))) {
        const types = options.reduce((types, x) => {
            const type = primitiveMappings[x._def.typeName];
            return type && !types.includes(type) ? [ ...types, type ] : types;
        }, []);
        return {
            type: types.length > 1 ? types : types[0]
        };
    } else if (options.every(x => x._def.typeName === "ZodLiteral" && !x.description)) {
        const types = options.reduce((acc, x) => {
            const type = typeof x._def.value;
            switch (type) {
              case "string":
              case "number":
              case "boolean":
                return [ ...acc, type ];

              case "bigint":
                return [ ...acc, "integer" ];

              case "object":
                if (x._def.value === null) return [ ...acc, "null" ];

              case "symbol":
              case "undefined":
              case "function":
              default:
                return acc;
            }
        }, []);
        if (types.length === options.length) {
            const uniqueTypes = types.filter((x, i, a) => a.indexOf(x) === i);
            return {
                type: uniqueTypes.length > 1 ? uniqueTypes : uniqueTypes[0],
                enum: options.reduce((acc, x) => acc.includes(x._def.value) ? acc : [ ...acc, x._def.value ], [])
            };
        }
    } else if (options.every(x => x._def.typeName === "ZodEnum")) {
        return {
            type: "string",
            enum: options.reduce((acc, x) => [ ...acc, ...x._def.values.filter(x => !acc.includes(x)) ], [])
        };
    }
    return asAnyOf(def, refs);
}

const asAnyOf = (def, refs) => {
    const anyOf = (def.options instanceof Map ? Array.from(def.options.values()) : def.options).map((x, i) => parseDef(x._def, {
        ...refs,
        currentPath: [ ...refs.currentPath, "anyOf", `${i}` ]
    })).filter(x => !!x && (!refs.strictUnions || typeof x === "object" && Object.keys(x).length > 0));
    return anyOf.length ? {
        anyOf
    } : undefined;
};

function parseNullableDef(def, refs) {
    if ([ "ZodString", "ZodNumber", "ZodBigInt", "ZodBoolean", "ZodNull" ].includes(def.innerType._def.typeName) && (!def.innerType._def.checks || !def.innerType._def.checks.length)) {
        if (refs.target === "openApi3") {
            return {
                type: primitiveMappings[def.innerType._def.typeName],
                nullable: true
            };
        }
        return {
            type: [ primitiveMappings[def.innerType._def.typeName], "null" ]
        };
    }
    if (refs.target === "openApi3") {
        const base = parseDef(def.innerType._def, {
            ...refs,
            currentPath: [ ...refs.currentPath ]
        });
        if (base && "$ref" in base) return {
            allOf: [ base ],
            nullable: true
        };
        return base && {
            ...base,
            nullable: true
        };
    }
    const base = parseDef(def.innerType._def, {
        ...refs,
        currentPath: [ ...refs.currentPath, "anyOf", "0" ]
    });
    return base && {
        anyOf: [ base, {
            type: "null"
        } ]
    };
}

function parseNumberDef(def, refs) {
    const res = {
        type: "number"
    };
    if (!def.checks) return res;
    for (const check of def.checks) {
        switch (check.kind) {
          case "int":
            res.type = "integer";
            addErrorMessage(res, "type", check.message, refs);
            break;

          case "min":
            if (refs.target === "jsonSchema7") {
                if (check.inclusive) {
                    setResponseValueAndErrors(res, "minimum", check.value, check.message, refs);
                } else {
                    setResponseValueAndErrors(res, "exclusiveMinimum", check.value, check.message, refs);
                }
            } else {
                if (!check.inclusive) {
                    res.exclusiveMinimum = true;
                }
                setResponseValueAndErrors(res, "minimum", check.value, check.message, refs);
            }
            break;

          case "max":
            if (refs.target === "jsonSchema7") {
                if (check.inclusive) {
                    setResponseValueAndErrors(res, "maximum", check.value, check.message, refs);
                } else {
                    setResponseValueAndErrors(res, "exclusiveMaximum", check.value, check.message, refs);
                }
            } else {
                if (!check.inclusive) {
                    res.exclusiveMaximum = true;
                }
                setResponseValueAndErrors(res, "maximum", check.value, check.message, refs);
            }
            break;

          case "multipleOf":
            setResponseValueAndErrors(res, "multipleOf", check.value, check.message, refs);
            break;
        }
    }
    return res;
}

function parseObjectDef(def, refs) {
    const forceOptionalIntoNullable = refs.target === "openAi";
    const result = {
        type: "object",
        properties: {}
    };
    const required = [];
    const shape = def.shape();
    for (const propName in shape) {
        let propDef = shape[propName];
        if (propDef === undefined || propDef._def === undefined) {
            continue;
        }
        let propOptional = safeIsOptional(propDef);
        if (propOptional && forceOptionalIntoNullable) {
            if (propDef._def.typeName === "ZodOptional") {
                propDef = propDef._def.innerType;
            }
            if (!propDef.isNullable()) {
                propDef = propDef.nullable();
            }
            propOptional = false;
        }
        const parsedDef = parseDef(propDef._def, {
            ...refs,
            currentPath: [ ...refs.currentPath, "properties", propName ],
            propertyPath: [ ...refs.currentPath, "properties", propName ]
        });
        if (parsedDef === undefined) {
            continue;
        }
        result.properties[propName] = parsedDef;
        if (!propOptional) {
            required.push(propName);
        }
    }
    if (required.length) {
        result.required = required;
    }
    const additionalProperties = decideAdditionalProperties(def, refs);
    if (additionalProperties !== undefined) {
        result.additionalProperties = additionalProperties;
    }
    return result;
}

function decideAdditionalProperties(def, refs) {
    if (def.catchall._def.typeName !== "ZodNever") {
        return parseDef(def.catchall._def, {
            ...refs,
            currentPath: [ ...refs.currentPath, "additionalProperties" ]
        });
    }
    switch (def.unknownKeys) {
      case "passthrough":
        return refs.allowedAdditionalProperties;

      case "strict":
        return refs.rejectedAdditionalProperties;

      case "strip":
        return refs.removeAdditionalStrategy === "strict" ? refs.allowedAdditionalProperties : refs.rejectedAdditionalProperties;
    }
}

function safeIsOptional(schema) {
    try {
        return schema.isOptional();
    } catch {
        return true;
    }
}

const parseOptionalDef = (def, refs) => {
    if (refs.currentPath.toString() === refs.propertyPath?.toString()) {
        return parseDef(def.innerType._def, refs);
    }
    const innerSchema = parseDef(def.innerType._def, {
        ...refs,
        currentPath: [ ...refs.currentPath, "anyOf", "1" ]
    });
    return innerSchema ? {
        anyOf: [ {
            not: parseAnyDef(refs)
        }, innerSchema ]
    } : parseAnyDef(refs);
};

const parsePipelineDef = (def, refs) => {
    if (refs.pipeStrategy === "input") {
        return parseDef(def.in._def, refs);
    } else if (refs.pipeStrategy === "output") {
        return parseDef(def.out._def, refs);
    }
    const a = parseDef(def.in._def, {
        ...refs,
        currentPath: [ ...refs.currentPath, "allOf", "0" ]
    });
    const b = parseDef(def.out._def, {
        ...refs,
        currentPath: [ ...refs.currentPath, "allOf", a ? "1" : "0" ]
    });
    return {
        allOf: [ a, b ].filter(x => x !== undefined)
    };
};

function parsePromiseDef(def, refs) {
    return parseDef(def.type._def, refs);
}

function parseSetDef(def, refs) {
    const items = parseDef(def.valueType._def, {
        ...refs,
        currentPath: [ ...refs.currentPath, "items" ]
    });
    const schema = {
        type: "array",
        uniqueItems: true,
        items
    };
    if (def.minSize) {
        setResponseValueAndErrors(schema, "minItems", def.minSize.value, def.minSize.message, refs);
    }
    if (def.maxSize) {
        setResponseValueAndErrors(schema, "maxItems", def.maxSize.value, def.maxSize.message, refs);
    }
    return schema;
}

function parseTupleDef(def, refs) {
    if (def.rest) {
        return {
            type: "array",
            minItems: def.items.length,
            items: def.items.map((x, i) => parseDef(x._def, {
                ...refs,
                currentPath: [ ...refs.currentPath, "items", `${i}` ]
            })).reduce((acc, x) => x === undefined ? acc : [ ...acc, x ], []),
            additionalItems: parseDef(def.rest._def, {
                ...refs,
                currentPath: [ ...refs.currentPath, "additionalItems" ]
            })
        };
    } else {
        return {
            type: "array",
            minItems: def.items.length,
            maxItems: def.items.length,
            items: def.items.map((x, i) => parseDef(x._def, {
                ...refs,
                currentPath: [ ...refs.currentPath, "items", `${i}` ]
            })).reduce((acc, x) => x === undefined ? acc : [ ...acc, x ], [])
        };
    }
}

function parseUndefinedDef(refs) {
    return {
        not: parseAnyDef(refs)
    };
}

function parseUnknownDef(refs) {
    return parseAnyDef(refs);
}

const parseReadonlyDef = (def, refs) => parseDef(def.innerType._def, refs);

const selectParser = (def, typeName, refs) => {
    switch (typeName) {
      case ZodFirstPartyTypeKind.ZodString:
        return parseStringDef(def, refs);

      case ZodFirstPartyTypeKind.ZodNumber:
        return parseNumberDef(def, refs);

      case ZodFirstPartyTypeKind.ZodObject:
        return parseObjectDef(def, refs);

      case ZodFirstPartyTypeKind.ZodBigInt:
        return parseBigintDef(def, refs);

      case ZodFirstPartyTypeKind.ZodBoolean:
        return parseBooleanDef();

      case ZodFirstPartyTypeKind.ZodDate:
        return parseDateDef(def, refs);

      case ZodFirstPartyTypeKind.ZodUndefined:
        return parseUndefinedDef(refs);

      case ZodFirstPartyTypeKind.ZodNull:
        return parseNullDef(refs);

      case ZodFirstPartyTypeKind.ZodArray:
        return parseArrayDef(def, refs);

      case ZodFirstPartyTypeKind.ZodUnion:
      case ZodFirstPartyTypeKind.ZodDiscriminatedUnion:
        return parseUnionDef(def, refs);

      case ZodFirstPartyTypeKind.ZodIntersection:
        return parseIntersectionDef(def, refs);

      case ZodFirstPartyTypeKind.ZodTuple:
        return parseTupleDef(def, refs);

      case ZodFirstPartyTypeKind.ZodRecord:
        return parseRecordDef(def, refs);

      case ZodFirstPartyTypeKind.ZodLiteral:
        return parseLiteralDef(def, refs);

      case ZodFirstPartyTypeKind.ZodEnum:
        return parseEnumDef(def);

      case ZodFirstPartyTypeKind.ZodNativeEnum:
        return parseNativeEnumDef(def);

      case ZodFirstPartyTypeKind.ZodNullable:
        return parseNullableDef(def, refs);

      case ZodFirstPartyTypeKind.ZodOptional:
        return parseOptionalDef(def, refs);

      case ZodFirstPartyTypeKind.ZodMap:
        return parseMapDef(def, refs);

      case ZodFirstPartyTypeKind.ZodSet:
        return parseSetDef(def, refs);

      case ZodFirstPartyTypeKind.ZodLazy:
        return () => def.getter()._def;

      case ZodFirstPartyTypeKind.ZodPromise:
        return parsePromiseDef(def, refs);

      case ZodFirstPartyTypeKind.ZodNaN:
      case ZodFirstPartyTypeKind.ZodNever:
        return parseNeverDef(refs);

      case ZodFirstPartyTypeKind.ZodEffects:
        return parseEffectsDef(def, refs);

      case ZodFirstPartyTypeKind.ZodAny:
        return parseAnyDef(refs);

      case ZodFirstPartyTypeKind.ZodUnknown:
        return parseUnknownDef(refs);

      case ZodFirstPartyTypeKind.ZodDefault:
        return parseDefaultDef(def, refs);

      case ZodFirstPartyTypeKind.ZodBranded:
        return parseBrandedDef(def, refs);

      case ZodFirstPartyTypeKind.ZodReadonly:
        return parseReadonlyDef(def, refs);

      case ZodFirstPartyTypeKind.ZodCatch:
        return parseCatchDef(def, refs);

      case ZodFirstPartyTypeKind.ZodPipeline:
        return parsePipelineDef(def, refs);

      case ZodFirstPartyTypeKind.ZodFunction:
      case ZodFirstPartyTypeKind.ZodVoid:
      case ZodFirstPartyTypeKind.ZodSymbol:
        return undefined;

      default:
        return (_ => undefined)();
    }
};

function parseDef(def, refs, forceResolution = false) {
    const seenItem = refs.seen.get(def);
    if (refs.override) {
        const overrideResult = refs.override?.(def, refs, seenItem, forceResolution);
        if (overrideResult !== ignoreOverride) {
            return overrideResult;
        }
    }
    if (seenItem && !forceResolution) {
        const seenSchema = get$ref(seenItem, refs);
        if (seenSchema !== undefined) {
            return seenSchema;
        }
    }
    const newItem = {
        def,
        path: refs.currentPath,
        jsonSchema: undefined
    };
    refs.seen.set(def, newItem);
    const jsonSchemaOrGetter = selectParser(def, def.typeName, refs);
    const jsonSchema = typeof jsonSchemaOrGetter === "function" ? parseDef(jsonSchemaOrGetter(), refs) : jsonSchemaOrGetter;
    if (jsonSchema) {
        addMeta(def, refs, jsonSchema);
    }
    if (refs.postProcess) {
        const postProcessResult = refs.postProcess(jsonSchema, def, refs);
        newItem.jsonSchema = jsonSchema;
        return postProcessResult;
    }
    newItem.jsonSchema = jsonSchema;
    return jsonSchema;
}

const get$ref = (item, refs) => {
    switch (refs.$refStrategy) {
      case "root":
        return {
            $ref: item.path.join("/")
        };

      case "relative":
        return {
            $ref: getRelativePath(refs.currentPath, item.path)
        };

      case "none":
      case "seen":
        {
            if (item.path.length < refs.currentPath.length && item.path.every((value, index) => refs.currentPath[index] === value)) {
                console.warn(`Recursive reference detected at ${refs.currentPath.join("/")}! Defaulting to any`);
                return parseAnyDef(refs);
            }
            return refs.$refStrategy === "seen" ? parseAnyDef(refs) : undefined;
        }
    }
};

const addMeta = (def, refs, jsonSchema) => {
    if (def.description) {
        jsonSchema.description = def.description;
        if (refs.markdownDescription) {
            jsonSchema.markdownDescription = def.description;
        }
    }
    return jsonSchema;
};

const zodToJsonSchema = (schema, options) => {
    const refs = getRefs(options);
    let definitions = typeof options === "object" && options.definitions ? Object.entries(options.definitions).reduce((acc, [name, schema]) => ({
        ...acc,
        [name]: parseDef(schema._def, {
            ...refs,
            currentPath: [ ...refs.basePath, refs.definitionPath, name ]
        }, true) ?? parseAnyDef(refs)
    }), {}) : undefined;
    const name = typeof options === "string" ? options : options?.nameStrategy === "title" ? undefined : options?.name;
    const main = parseDef(schema._def, name === undefined ? refs : {
        ...refs,
        currentPath: [ ...refs.basePath, refs.definitionPath, name ]
    }, false) ?? parseAnyDef(refs);
    const title = typeof options === "object" && options.name !== undefined && options.nameStrategy === "title" ? options.name : undefined;
    if (title !== undefined) {
        main.title = title;
    }
    if (refs.flags.hasReferencedOpenAiAnyType) {
        if (!definitions) {
            definitions = {};
        }
        if (!definitions[refs.openAiAnyTypeName]) {
            definitions[refs.openAiAnyTypeName] = {
                type: [ "string", "number", "integer", "boolean", "array", "null" ],
                items: {
                    $ref: refs.$refStrategy === "relative" ? "1" : [ ...refs.basePath, refs.definitionPath, refs.openAiAnyTypeName ].join("/")
                }
            };
        }
    }
    const combined = name === undefined ? definitions ? {
        ...main,
        [refs.definitionPath]: definitions
    } : main : {
        $ref: [ ...refs.$refStrategy === "relative" ? [] : refs.basePath, refs.definitionPath, name ].join("/"),
        [refs.definitionPath]: {
            ...definitions,
            [name]: main
        }
    };
    if (refs.target === "jsonSchema7") {
        combined.$schema = "http://json-schema.org/draft-07/schema#";
    } else if (refs.target === "jsonSchema2019-09" || refs.target === "openAi") {
        combined.$schema = "https://json-schema.org/draft/2019-09/schema#";
    }
    if (refs.target === "openAi" && ("anyOf" in combined || "oneOf" in combined || "allOf" in combined || "type" in combined && Array.isArray(combined.type))) {
        console.warn("Warning: OpenAI may not support schemas with unions as roots! Try wrapping it in an object property.");
    }
    return combined;
};

var McpZodTypeKind;

(function(McpZodTypeKind) {
    McpZodTypeKind["Completable"] = "McpCompletable";
})(McpZodTypeKind || (McpZodTypeKind = {}));

class Completable extends ZodType {
    _parse(input) {
        const {ctx} = this._processInputParams(input);
        const data = ctx.data;
        return this._def.type._parse({
            data,
            path: ctx.path,
            parent: ctx
        });
    }
    unwrap() {
        return this._def.type;
    }
}

Completable.create = (type, params) => new Completable({
    type,
    typeName: McpZodTypeKind.Completable,
    complete: params.complete,
    ...processCreateParams(params)
});

function processCreateParams(params) {
    if (!params) return {};
    const {errorMap, invalid_type_error, required_error, description} = params;
    if (errorMap && (invalid_type_error || required_error)) {
        throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
    }
    if (errorMap) return {
        errorMap,
        description
    };
    const customMap = (iss, ctx) => {
        var _a, _b;
        const {message} = params;
        if (iss.code === "invalid_enum_value") {
            return {
                message: message !== null && message !== void 0 ? message : ctx.defaultError
            };
        }
        if (typeof ctx.data === "undefined") {
            return {
                message: (_a = message !== null && message !== void 0 ? message : required_error) !== null && _a !== void 0 ? _a : ctx.defaultError
            };
        }
        if (iss.code !== "invalid_type") return {
            message: ctx.defaultError
        };
        return {
            message: (_b = message !== null && message !== void 0 ? message : invalid_type_error) !== null && _b !== void 0 ? _b : ctx.defaultError
        };
    };
    return {
        errorMap: customMap,
        description
    };
}

const MAX_TEMPLATE_LENGTH = 1e6;

const MAX_VARIABLE_LENGTH = 1e6;

const MAX_TEMPLATE_EXPRESSIONS = 1e4;

const MAX_REGEX_LENGTH = 1e6;

class UriTemplate {
    static isTemplate(str) {
        return /\{[^}\s]+\}/.test(str);
    }
    static validateLength(str, max, context) {
        if (str.length > max) {
            throw new Error(`${context} exceeds maximum length of ${max} characters (got ${str.length})`);
        }
    }
    get variableNames() {
        return this.parts.flatMap(part => typeof part === "string" ? [] : part.names);
    }
    constructor(template) {
        UriTemplate.validateLength(template, MAX_TEMPLATE_LENGTH, "Template");
        this.template = template;
        this.parts = this.parse(template);
    }
    toString() {
        return this.template;
    }
    parse(template) {
        const parts = [];
        let currentText = "";
        let i = 0;
        let expressionCount = 0;
        while (i < template.length) {
            if (template[i] === "{") {
                if (currentText) {
                    parts.push(currentText);
                    currentText = "";
                }
                const end = template.indexOf("}", i);
                if (end === -1) throw new Error("Unclosed template expression");
                expressionCount++;
                if (expressionCount > MAX_TEMPLATE_EXPRESSIONS) {
                    throw new Error(`Template contains too many expressions (max ${MAX_TEMPLATE_EXPRESSIONS})`);
                }
                const expr = template.slice(i + 1, end);
                const operator = this.getOperator(expr);
                const exploded = expr.includes("*");
                const names = this.getNames(expr);
                const name = names[0];
                for (const name of names) {
                    UriTemplate.validateLength(name, MAX_VARIABLE_LENGTH, "Variable name");
                }
                parts.push({
                    name,
                    operator,
                    names,
                    exploded
                });
                i = end + 1;
            } else {
                currentText += template[i];
                i++;
            }
        }
        if (currentText) {
            parts.push(currentText);
        }
        return parts;
    }
    getOperator(expr) {
        const operators = [ "+", "#", ".", "/", "?", "&" ];
        return operators.find(op => expr.startsWith(op)) || "";
    }
    getNames(expr) {
        const operator = this.getOperator(expr);
        return expr.slice(operator.length).split(",").map(name => name.replace("*", "").trim()).filter(name => name.length > 0);
    }
    encodeValue(value, operator) {
        UriTemplate.validateLength(value, MAX_VARIABLE_LENGTH, "Variable value");
        if (operator === "+" || operator === "#") {
            return encodeURI(value);
        }
        return encodeURIComponent(value);
    }
    expandPart(part, variables) {
        if (part.operator === "?" || part.operator === "&") {
            const pairs = part.names.map(name => {
                const value = variables[name];
                if (value === undefined) return "";
                const encoded = Array.isArray(value) ? value.map(v => this.encodeValue(v, part.operator)).join(",") : this.encodeValue(value.toString(), part.operator);
                return `${name}=${encoded}`;
            }).filter(pair => pair.length > 0);
            if (pairs.length === 0) return "";
            const separator = part.operator === "?" ? "?" : "&";
            return separator + pairs.join("&");
        }
        if (part.names.length > 1) {
            const values = part.names.map(name => variables[name]).filter(v => v !== undefined);
            if (values.length === 0) return "";
            return values.map(v => Array.isArray(v) ? v[0] : v).join(",");
        }
        const value = variables[part.name];
        if (value === undefined) return "";
        const values = Array.isArray(value) ? value : [ value ];
        const encoded = values.map(v => this.encodeValue(v, part.operator));
        switch (part.operator) {
          case "":
            return encoded.join(",");

          case "+":
            return encoded.join(",");

          case "#":
            return "#" + encoded.join(",");

          case ".":
            return "." + encoded.join(".");

          case "/":
            return "/" + encoded.join("/");

          default:
            return encoded.join(",");
        }
    }
    expand(variables) {
        let result = "";
        let hasQueryParam = false;
        for (const part of this.parts) {
            if (typeof part === "string") {
                result += part;
                continue;
            }
            const expanded = this.expandPart(part, variables);
            if (!expanded) continue;
            if ((part.operator === "?" || part.operator === "&") && hasQueryParam) {
                result += expanded.replace("?", "&");
            } else {
                result += expanded;
            }
            if (part.operator === "?" || part.operator === "&") {
                hasQueryParam = true;
            }
        }
        return result;
    }
    escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    partToRegExp(part) {
        const patterns = [];
        for (const name of part.names) {
            UriTemplate.validateLength(name, MAX_VARIABLE_LENGTH, "Variable name");
        }
        if (part.operator === "?" || part.operator === "&") {
            for (let i = 0; i < part.names.length; i++) {
                const name = part.names[i];
                const prefix = i === 0 ? "\\" + part.operator : "&";
                patterns.push({
                    pattern: prefix + this.escapeRegExp(name) + "=([^&]+)",
                    name
                });
            }
            return patterns;
        }
        let pattern;
        const name = part.name;
        switch (part.operator) {
          case "":
            pattern = part.exploded ? "([^/]+(?:,[^/]+)*)" : "([^/,]+)";
            break;

          case "+":
          case "#":
            pattern = "(.+)";
            break;

          case ".":
            pattern = "\\.([^/,]+)";
            break;

          case "/":
            pattern = "/" + (part.exploded ? "([^/]+(?:,[^/]+)*)" : "([^/,]+)");
            break;

          default:
            pattern = "([^/]+)";
        }
        patterns.push({
            pattern,
            name
        });
        return patterns;
    }
    match(uri) {
        UriTemplate.validateLength(uri, MAX_TEMPLATE_LENGTH, "URI");
        let pattern = "^";
        const names = [];
        for (const part of this.parts) {
            if (typeof part === "string") {
                pattern += this.escapeRegExp(part);
            } else {
                const patterns = this.partToRegExp(part);
                for (const {pattern: partPattern, name} of patterns) {
                    pattern += partPattern;
                    names.push({
                        name,
                        exploded: part.exploded
                    });
                }
            }
        }
        pattern += "$";
        UriTemplate.validateLength(pattern, MAX_REGEX_LENGTH, "Generated regex pattern");
        const regex = new RegExp(pattern);
        const match = uri.match(regex);
        if (!match) return null;
        const result = {};
        for (let i = 0; i < names.length; i++) {
            const {name, exploded} = names[i];
            const value = match[i + 1];
            const cleanName = name.replace("*", "");
            if (exploded && value.includes(",")) {
                result[cleanName] = value.split(",");
            } else {
                result[cleanName] = value;
            }
        }
        return result;
    }
}

class McpServer {
    constructor(serverInfo, options) {
        this._registeredResources = {};
        this._registeredResourceTemplates = {};
        this._registeredTools = {};
        this._registeredPrompts = {};
        this._toolHandlersInitialized = false;
        this._completionHandlerInitialized = false;
        this._resourceHandlersInitialized = false;
        this._promptHandlersInitialized = false;
        this.server = new Server(serverInfo, options);
    }
    async connect(transport) {
        return await this.server.connect(transport);
    }
    async close() {
        await this.server.close();
    }
    setToolRequestHandlers() {
        if (this._toolHandlersInitialized) {
            return;
        }
        this.server.assertCanSetRequestHandler(ListToolsRequestSchema.shape.method.value);
        this.server.assertCanSetRequestHandler(CallToolRequestSchema.shape.method.value);
        this.server.registerCapabilities({
            tools: {
                listChanged: true
            }
        });
        this.server.setRequestHandler(ListToolsRequestSchema, () => ({
            tools: Object.entries(this._registeredTools).filter(([, tool]) => tool.enabled).map(([name, tool]) => {
                const toolDefinition = {
                    name,
                    title: tool.title,
                    description: tool.description,
                    inputSchema: tool.inputSchema ? zodToJsonSchema(tool.inputSchema, {
                        strictUnions: true
                    }) : EMPTY_OBJECT_JSON_SCHEMA,
                    annotations: tool.annotations
                };
                if (tool.outputSchema) {
                    toolDefinition.outputSchema = zodToJsonSchema(tool.outputSchema, {
                        strictUnions: true
                    });
                }
                return toolDefinition;
            })
        }));
        this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
            const tool = this._registeredTools[request.params.name];
            if (!tool) {
                throw new McpError(ErrorCode.InvalidParams, `Tool ${request.params.name} not found`);
            }
            if (!tool.enabled) {
                throw new McpError(ErrorCode.InvalidParams, `Tool ${request.params.name} disabled`);
            }
            let result;
            if (tool.inputSchema) {
                const parseResult = await tool.inputSchema.safeParseAsync(request.params.arguments);
                if (!parseResult.success) {
                    throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for tool ${request.params.name}: ${parseResult.error.message}`);
                }
                const args = parseResult.data;
                const cb = tool.callback;
                try {
                    result = await Promise.resolve(cb(args, extra));
                } catch (error) {
                    result = {
                        content: [ {
                            type: "text",
                            text: error instanceof Error ? error.message : String(error)
                        } ],
                        isError: true
                    };
                }
            } else {
                const cb = tool.callback;
                try {
                    result = await Promise.resolve(cb(extra));
                } catch (error) {
                    result = {
                        content: [ {
                            type: "text",
                            text: error instanceof Error ? error.message : String(error)
                        } ],
                        isError: true
                    };
                }
            }
            if (tool.outputSchema && !result.isError) {
                if (!result.structuredContent) {
                    throw new McpError(ErrorCode.InvalidParams, `Tool ${request.params.name} has an output schema but no structured content was provided`);
                }
                const parseResult = await tool.outputSchema.safeParseAsync(result.structuredContent);
                if (!parseResult.success) {
                    throw new McpError(ErrorCode.InvalidParams, `Invalid structured content for tool ${request.params.name}: ${parseResult.error.message}`);
                }
            }
            return result;
        });
        this._toolHandlersInitialized = true;
    }
    setCompletionRequestHandler() {
        if (this._completionHandlerInitialized) {
            return;
        }
        this.server.assertCanSetRequestHandler(CompleteRequestSchema.shape.method.value);
        this.server.registerCapabilities({
            completions: {}
        });
        this.server.setRequestHandler(CompleteRequestSchema, async request => {
            switch (request.params.ref.type) {
              case "ref/prompt":
                return this.handlePromptCompletion(request, request.params.ref);

              case "ref/resource":
                return this.handleResourceCompletion(request, request.params.ref);

              default:
                throw new McpError(ErrorCode.InvalidParams, `Invalid completion reference: ${request.params.ref}`);
            }
        });
        this._completionHandlerInitialized = true;
    }
    async handlePromptCompletion(request, ref) {
        const prompt = this._registeredPrompts[ref.name];
        if (!prompt) {
            throw new McpError(ErrorCode.InvalidParams, `Prompt ${ref.name} not found`);
        }
        if (!prompt.enabled) {
            throw new McpError(ErrorCode.InvalidParams, `Prompt ${ref.name} disabled`);
        }
        if (!prompt.argsSchema) {
            return EMPTY_COMPLETION_RESULT;
        }
        const field = prompt.argsSchema.shape[request.params.argument.name];
        if (!(field instanceof Completable)) {
            return EMPTY_COMPLETION_RESULT;
        }
        const def = field._def;
        const suggestions = await def.complete(request.params.argument.value, request.params.context);
        return createCompletionResult(suggestions);
    }
    async handleResourceCompletion(request, ref) {
        const template = Object.values(this._registeredResourceTemplates).find(t => t.resourceTemplate.uriTemplate.toString() === ref.uri);
        if (!template) {
            if (this._registeredResources[ref.uri]) {
                return EMPTY_COMPLETION_RESULT;
            }
            throw new McpError(ErrorCode.InvalidParams, `Resource template ${request.params.ref.uri} not found`);
        }
        const completer = template.resourceTemplate.completeCallback(request.params.argument.name);
        if (!completer) {
            return EMPTY_COMPLETION_RESULT;
        }
        const suggestions = await completer(request.params.argument.value, request.params.context);
        return createCompletionResult(suggestions);
    }
    setResourceRequestHandlers() {
        if (this._resourceHandlersInitialized) {
            return;
        }
        this.server.assertCanSetRequestHandler(ListResourcesRequestSchema.shape.method.value);
        this.server.assertCanSetRequestHandler(ListResourceTemplatesRequestSchema.shape.method.value);
        this.server.assertCanSetRequestHandler(ReadResourceRequestSchema.shape.method.value);
        this.server.registerCapabilities({
            resources: {
                listChanged: true
            }
        });
        this.server.setRequestHandler(ListResourcesRequestSchema, async (request, extra) => {
            const resources = Object.entries(this._registeredResources).filter(([_, resource]) => resource.enabled).map(([uri, resource]) => ({
                uri,
                name: resource.name,
                ...resource.metadata
            }));
            const templateResources = [];
            for (const template of Object.values(this._registeredResourceTemplates)) {
                if (!template.resourceTemplate.listCallback) {
                    continue;
                }
                const result = await template.resourceTemplate.listCallback(extra);
                for (const resource of result.resources) {
                    templateResources.push({
                        ...template.metadata,
                        ...resource
                    });
                }
            }
            return {
                resources: [ ...resources, ...templateResources ]
            };
        });
        this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
            const resourceTemplates = Object.entries(this._registeredResourceTemplates).map(([name, template]) => ({
                name,
                uriTemplate: template.resourceTemplate.uriTemplate.toString(),
                ...template.metadata
            }));
            return {
                resourceTemplates
            };
        });
        this.server.setRequestHandler(ReadResourceRequestSchema, async (request, extra) => {
            const uri = new URL(request.params.uri);
            const resource = this._registeredResources[uri.toString()];
            if (resource) {
                if (!resource.enabled) {
                    throw new McpError(ErrorCode.InvalidParams, `Resource ${uri} disabled`);
                }
                return resource.readCallback(uri, extra);
            }
            for (const template of Object.values(this._registeredResourceTemplates)) {
                const variables = template.resourceTemplate.uriTemplate.match(uri.toString());
                if (variables) {
                    return template.readCallback(uri, variables, extra);
                }
            }
            throw new McpError(ErrorCode.InvalidParams, `Resource ${uri} not found`);
        });
        this.setCompletionRequestHandler();
        this._resourceHandlersInitialized = true;
    }
    setPromptRequestHandlers() {
        if (this._promptHandlersInitialized) {
            return;
        }
        this.server.assertCanSetRequestHandler(ListPromptsRequestSchema.shape.method.value);
        this.server.assertCanSetRequestHandler(GetPromptRequestSchema.shape.method.value);
        this.server.registerCapabilities({
            prompts: {
                listChanged: true
            }
        });
        this.server.setRequestHandler(ListPromptsRequestSchema, () => ({
            prompts: Object.entries(this._registeredPrompts).filter(([, prompt]) => prompt.enabled).map(([name, prompt]) => ({
                name,
                title: prompt.title,
                description: prompt.description,
                arguments: prompt.argsSchema ? promptArgumentsFromSchema(prompt.argsSchema) : undefined
            }))
        }));
        this.server.setRequestHandler(GetPromptRequestSchema, async (request, extra) => {
            const prompt = this._registeredPrompts[request.params.name];
            if (!prompt) {
                throw new McpError(ErrorCode.InvalidParams, `Prompt ${request.params.name} not found`);
            }
            if (!prompt.enabled) {
                throw new McpError(ErrorCode.InvalidParams, `Prompt ${request.params.name} disabled`);
            }
            if (prompt.argsSchema) {
                const parseResult = await prompt.argsSchema.safeParseAsync(request.params.arguments);
                if (!parseResult.success) {
                    throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for prompt ${request.params.name}: ${parseResult.error.message}`);
                }
                const args = parseResult.data;
                const cb = prompt.callback;
                return await Promise.resolve(cb(args, extra));
            } else {
                const cb = prompt.callback;
                return await Promise.resolve(cb(extra));
            }
        });
        this.setCompletionRequestHandler();
        this._promptHandlersInitialized = true;
    }
    resource(name, uriOrTemplate, ...rest) {
        let metadata;
        if (typeof rest[0] === "object") {
            metadata = rest.shift();
        }
        const readCallback = rest[0];
        if (typeof uriOrTemplate === "string") {
            if (this._registeredResources[uriOrTemplate]) {
                throw new Error(`Resource ${uriOrTemplate} is already registered`);
            }
            const registeredResource = this._createRegisteredResource(name, undefined, uriOrTemplate, metadata, readCallback);
            this.setResourceRequestHandlers();
            this.sendResourceListChanged();
            return registeredResource;
        } else {
            if (this._registeredResourceTemplates[name]) {
                throw new Error(`Resource template ${name} is already registered`);
            }
            const registeredResourceTemplate = this._createRegisteredResourceTemplate(name, undefined, uriOrTemplate, metadata, readCallback);
            this.setResourceRequestHandlers();
            this.sendResourceListChanged();
            return registeredResourceTemplate;
        }
    }
    registerResource(name, uriOrTemplate, config, readCallback) {
        if (typeof uriOrTemplate === "string") {
            if (this._registeredResources[uriOrTemplate]) {
                throw new Error(`Resource ${uriOrTemplate} is already registered`);
            }
            const registeredResource = this._createRegisteredResource(name, config.title, uriOrTemplate, config, readCallback);
            this.setResourceRequestHandlers();
            this.sendResourceListChanged();
            return registeredResource;
        } else {
            if (this._registeredResourceTemplates[name]) {
                throw new Error(`Resource template ${name} is already registered`);
            }
            const registeredResourceTemplate = this._createRegisteredResourceTemplate(name, config.title, uriOrTemplate, config, readCallback);
            this.setResourceRequestHandlers();
            this.sendResourceListChanged();
            return registeredResourceTemplate;
        }
    }
    _createRegisteredResource(name, title, uri, metadata, readCallback) {
        const registeredResource = {
            name,
            title,
            metadata,
            readCallback,
            enabled: true,
            disable: () => registeredResource.update({
                enabled: false
            }),
            enable: () => registeredResource.update({
                enabled: true
            }),
            remove: () => registeredResource.update({
                uri: null
            }),
            update: updates => {
                if (typeof updates.uri !== "undefined" && updates.uri !== uri) {
                    delete this._registeredResources[uri];
                    if (updates.uri) this._registeredResources[updates.uri] = registeredResource;
                }
                if (typeof updates.name !== "undefined") registeredResource.name = updates.name;
                if (typeof updates.title !== "undefined") registeredResource.title = updates.title;
                if (typeof updates.metadata !== "undefined") registeredResource.metadata = updates.metadata;
                if (typeof updates.callback !== "undefined") registeredResource.readCallback = updates.callback;
                if (typeof updates.enabled !== "undefined") registeredResource.enabled = updates.enabled;
                this.sendResourceListChanged();
            }
        };
        this._registeredResources[uri] = registeredResource;
        return registeredResource;
    }
    _createRegisteredResourceTemplate(name, title, template, metadata, readCallback) {
        const registeredResourceTemplate = {
            resourceTemplate: template,
            title,
            metadata,
            readCallback,
            enabled: true,
            disable: () => registeredResourceTemplate.update({
                enabled: false
            }),
            enable: () => registeredResourceTemplate.update({
                enabled: true
            }),
            remove: () => registeredResourceTemplate.update({
                name: null
            }),
            update: updates => {
                if (typeof updates.name !== "undefined" && updates.name !== name) {
                    delete this._registeredResourceTemplates[name];
                    if (updates.name) this._registeredResourceTemplates[updates.name] = registeredResourceTemplate;
                }
                if (typeof updates.title !== "undefined") registeredResourceTemplate.title = updates.title;
                if (typeof updates.template !== "undefined") registeredResourceTemplate.resourceTemplate = updates.template;
                if (typeof updates.metadata !== "undefined") registeredResourceTemplate.metadata = updates.metadata;
                if (typeof updates.callback !== "undefined") registeredResourceTemplate.readCallback = updates.callback;
                if (typeof updates.enabled !== "undefined") registeredResourceTemplate.enabled = updates.enabled;
                this.sendResourceListChanged();
            }
        };
        this._registeredResourceTemplates[name] = registeredResourceTemplate;
        return registeredResourceTemplate;
    }
    _createRegisteredPrompt(name, title, description, argsSchema, callback) {
        const registeredPrompt = {
            title,
            description,
            argsSchema: argsSchema === undefined ? undefined : objectType(argsSchema),
            callback,
            enabled: true,
            disable: () => registeredPrompt.update({
                enabled: false
            }),
            enable: () => registeredPrompt.update({
                enabled: true
            }),
            remove: () => registeredPrompt.update({
                name: null
            }),
            update: updates => {
                if (typeof updates.name !== "undefined" && updates.name !== name) {
                    delete this._registeredPrompts[name];
                    if (updates.name) this._registeredPrompts[updates.name] = registeredPrompt;
                }
                if (typeof updates.title !== "undefined") registeredPrompt.title = updates.title;
                if (typeof updates.description !== "undefined") registeredPrompt.description = updates.description;
                if (typeof updates.argsSchema !== "undefined") registeredPrompt.argsSchema = objectType(updates.argsSchema);
                if (typeof updates.callback !== "undefined") registeredPrompt.callback = updates.callback;
                if (typeof updates.enabled !== "undefined") registeredPrompt.enabled = updates.enabled;
                this.sendPromptListChanged();
            }
        };
        this._registeredPrompts[name] = registeredPrompt;
        return registeredPrompt;
    }
    _createRegisteredTool(name, title, description, inputSchema, outputSchema, annotations, callback) {
        const registeredTool = {
            title,
            description,
            inputSchema: inputSchema === undefined ? undefined : objectType(inputSchema),
            outputSchema: outputSchema === undefined ? undefined : objectType(outputSchema),
            annotations,
            callback,
            enabled: true,
            disable: () => registeredTool.update({
                enabled: false
            }),
            enable: () => registeredTool.update({
                enabled: true
            }),
            remove: () => registeredTool.update({
                name: null
            }),
            update: updates => {
                if (typeof updates.name !== "undefined" && updates.name !== name) {
                    delete this._registeredTools[name];
                    if (updates.name) this._registeredTools[updates.name] = registeredTool;
                }
                if (typeof updates.title !== "undefined") registeredTool.title = updates.title;
                if (typeof updates.description !== "undefined") registeredTool.description = updates.description;
                if (typeof updates.paramsSchema !== "undefined") registeredTool.inputSchema = objectType(updates.paramsSchema);
                if (typeof updates.callback !== "undefined") registeredTool.callback = updates.callback;
                if (typeof updates.annotations !== "undefined") registeredTool.annotations = updates.annotations;
                if (typeof updates.enabled !== "undefined") registeredTool.enabled = updates.enabled;
                this.sendToolListChanged();
            }
        };
        this._registeredTools[name] = registeredTool;
        this.setToolRequestHandlers();
        this.sendToolListChanged();
        return registeredTool;
    }
    tool(name, ...rest) {
        if (this._registeredTools[name]) {
            throw new Error(`Tool ${name} is already registered`);
        }
        let description;
        let inputSchema;
        let outputSchema;
        let annotations;
        if (typeof rest[0] === "string") {
            description = rest.shift();
        }
        if (rest.length > 1) {
            const firstArg = rest[0];
            if (isZodRawShape(firstArg)) {
                inputSchema = rest.shift();
                if (rest.length > 1 && typeof rest[0] === "object" && rest[0] !== null && !isZodRawShape(rest[0])) {
                    annotations = rest.shift();
                }
            } else if (typeof firstArg === "object" && firstArg !== null) {
                annotations = rest.shift();
            }
        }
        const callback = rest[0];
        return this._createRegisteredTool(name, undefined, description, inputSchema, outputSchema, annotations, callback);
    }
    registerTool(name, config, cb) {
        if (this._registeredTools[name]) {
            throw new Error(`Tool ${name} is already registered`);
        }
        const {title, description, inputSchema, outputSchema, annotations} = config;
        return this._createRegisteredTool(name, title, description, inputSchema, outputSchema, annotations, cb);
    }
    prompt(name, ...rest) {
        if (this._registeredPrompts[name]) {
            throw new Error(`Prompt ${name} is already registered`);
        }
        let description;
        if (typeof rest[0] === "string") {
            description = rest.shift();
        }
        let argsSchema;
        if (rest.length > 1) {
            argsSchema = rest.shift();
        }
        const cb = rest[0];
        const registeredPrompt = this._createRegisteredPrompt(name, undefined, description, argsSchema, cb);
        this.setPromptRequestHandlers();
        this.sendPromptListChanged();
        return registeredPrompt;
    }
    registerPrompt(name, config, cb) {
        if (this._registeredPrompts[name]) {
            throw new Error(`Prompt ${name} is already registered`);
        }
        const {title, description, argsSchema} = config;
        const registeredPrompt = this._createRegisteredPrompt(name, title, description, argsSchema, cb);
        this.setPromptRequestHandlers();
        this.sendPromptListChanged();
        return registeredPrompt;
    }
    isConnected() {
        return this.server.transport !== undefined;
    }
    sendResourceListChanged() {
        if (this.isConnected()) {
            this.server.sendResourceListChanged();
        }
    }
    sendToolListChanged() {
        if (this.isConnected()) {
            this.server.sendToolListChanged();
        }
    }
    sendPromptListChanged() {
        if (this.isConnected()) {
            this.server.sendPromptListChanged();
        }
    }
}

class ResourceTemplate {
    constructor(uriTemplate, _callbacks) {
        this._callbacks = _callbacks;
        this._uriTemplate = typeof uriTemplate === "string" ? new UriTemplate(uriTemplate) : uriTemplate;
    }
    get uriTemplate() {
        return this._uriTemplate;
    }
    get listCallback() {
        return this._callbacks.list;
    }
    completeCallback(variable) {
        var _a;
        return (_a = this._callbacks.complete) === null || _a === void 0 ? void 0 : _a[variable];
    }
}

const EMPTY_OBJECT_JSON_SCHEMA = {
    type: "object"
};

function isZodRawShape(obj) {
    if (typeof obj !== "object" || obj === null) return false;
    const isEmptyObject = Object.keys(obj).length === 0;
    return isEmptyObject || Object.values(obj).some(isZodTypeLike);
}

function isZodTypeLike(value) {
    return value !== null && typeof value === "object" && "parse" in value && typeof value.parse === "function" && "safeParse" in value && typeof value.safeParse === "function";
}

function promptArgumentsFromSchema(schema) {
    return Object.entries(schema.shape).map(([name, field]) => ({
        name,
        description: field.description,
        required: !field.isOptional()
    }));
}

function createCompletionResult(suggestions) {
    return {
        completion: {
            values: suggestions.slice(0, 100),
            total: suggestions.length,
            hasMore: suggestions.length > 100
        }
    };
}

const EMPTY_COMPLETION_RESULT = {
    completion: {
        values: [],
        hasMore: false
    }
};

class ReadBuffer {
    append(chunk) {
        this._buffer = this._buffer ? Buffer.concat([ this._buffer, chunk ]) : chunk;
    }
    readMessage() {
        if (!this._buffer) {
            return null;
        }
        const index = this._buffer.indexOf("\n");
        if (index === -1) {
            return null;
        }
        const line = this._buffer.toString("utf8", 0, index).replace(/\r$/, "");
        this._buffer = this._buffer.subarray(index + 1);
        return deserializeMessage(line);
    }
    clear() {
        this._buffer = undefined;
    }
}

function deserializeMessage(line) {
    return JSONRPCMessageSchema.parse(JSON.parse(line));
}

function serializeMessage(message) {
    return JSON.stringify(message) + "\n";
}

class StdioServerTransport {
    constructor(_stdin = process.stdin, _stdout = process.stdout) {
        this._stdin = _stdin;
        this._stdout = _stdout;
        this._readBuffer = new ReadBuffer;
        this._started = false;
        this._ondata = chunk => {
            this._readBuffer.append(chunk);
            this.processReadBuffer();
        };
        this._onerror = error => {
            var _a;
            (_a = this.onerror) === null || _a === void 0 ? void 0 : _a.call(this, error);
        };
    }
    async start() {
        if (this._started) {
            throw new Error("StdioServerTransport already started! If using Server class, note that connect() calls start() automatically.");
        }
        this._started = true;
        this._stdin.on("data", this._ondata);
        this._stdin.on("error", this._onerror);
    }
    processReadBuffer() {
        var _a, _b;
        while (true) {
            try {
                const message = this._readBuffer.readMessage();
                if (message === null) {
                    break;
                }
                (_a = this.onmessage) === null || _a === void 0 ? void 0 : _a.call(this, message);
            } catch (error) {
                (_b = this.onerror) === null || _b === void 0 ? void 0 : _b.call(this, error);
            }
        }
    }
    async close() {
        var _a;
        this._stdin.off("data", this._ondata);
        this._stdin.off("error", this._onerror);
        const remainingDataListeners = this._stdin.listenerCount("data");
        if (remainingDataListeners === 0) {
            this._stdin.pause();
        }
        this._readBuffer.clear();
        (_a = this.onclose) === null || _a === void 0 ? void 0 : _a.call(this);
    }
    send(message) {
        return new Promise(resolve => {
            const json = serializeMessage(message);
            if (this._stdout.write(json)) {
                resolve();
            } else {
                this._stdout.once("drain", resolve);
            }
        });
    }
}

export { McpServer, ResourceTemplate, StdioServerTransport };
