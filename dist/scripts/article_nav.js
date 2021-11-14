/******/ (function() { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 7818:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", ({ value: true }));

var shared = __webpack_require__(9109);

let activeEffectScope;
const effectScopeStack = [];
class EffectScope {
    constructor(detached = false) {
        this.active = true;
        this.effects = [];
        this.cleanups = [];
        if (!detached && activeEffectScope) {
            this.parent = activeEffectScope;
            this.index =
                (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(this) - 1;
        }
    }
    run(fn) {
        if (this.active) {
            try {
                this.on();
                return fn();
            }
            finally {
                this.off();
            }
        }
    }
    on() {
        if (this.active) {
            effectScopeStack.push(this);
            activeEffectScope = this;
        }
    }
    off() {
        if (this.active) {
            effectScopeStack.pop();
            activeEffectScope = effectScopeStack[effectScopeStack.length - 1];
        }
    }
    stop(fromParent) {
        if (this.active) {
            this.effects.forEach(e => e.stop());
            this.cleanups.forEach(cleanup => cleanup());
            if (this.scopes) {
                this.scopes.forEach(e => e.stop(true));
            }
            // nested scope, dereference from parent to avoid memory leaks
            if (this.parent && !fromParent) {
                // optimized O(1) removal
                const last = this.parent.scopes.pop();
                if (last && last !== this) {
                    this.parent.scopes[this.index] = last;
                    last.index = this.index;
                }
            }
            this.active = false;
        }
    }
}
function effectScope(detached) {
    return new EffectScope(detached);
}
function recordEffectScope(effect, scope) {
    scope = scope || activeEffectScope;
    if (scope && scope.active) {
        scope.effects.push(effect);
    }
}
function getCurrentScope() {
    return activeEffectScope;
}
function onScopeDispose(fn) {
    if (activeEffectScope) {
        activeEffectScope.cleanups.push(fn);
    }
}

const createDep = (effects) => {
    const dep = new Set(effects);
    dep.w = 0;
    dep.n = 0;
    return dep;
};
const wasTracked = (dep) => (dep.w & trackOpBit) > 0;
const newTracked = (dep) => (dep.n & trackOpBit) > 0;
const initDepMarkers = ({ deps }) => {
    if (deps.length) {
        for (let i = 0; i < deps.length; i++) {
            deps[i].w |= trackOpBit; // set was tracked
        }
    }
};
const finalizeDepMarkers = (effect) => {
    const { deps } = effect;
    if (deps.length) {
        let ptr = 0;
        for (let i = 0; i < deps.length; i++) {
            const dep = deps[i];
            if (wasTracked(dep) && !newTracked(dep)) {
                dep.delete(effect);
            }
            else {
                deps[ptr++] = dep;
            }
            // clear bits
            dep.w &= ~trackOpBit;
            dep.n &= ~trackOpBit;
        }
        deps.length = ptr;
    }
};

const targetMap = new WeakMap();
// The number of effects currently being tracked recursively.
let effectTrackDepth = 0;
let trackOpBit = 1;
/**
 * The bitwise track markers support at most 30 levels op recursion.
 * This value is chosen to enable modern JS engines to use a SMI on all platforms.
 * When recursion depth is greater, fall back to using a full cleanup.
 */
const maxMarkerBits = 30;
const effectStack = [];
let activeEffect;
const ITERATE_KEY = Symbol('');
const MAP_KEY_ITERATE_KEY = Symbol('');
class ReactiveEffect {
    constructor(fn, scheduler = null, scope) {
        this.fn = fn;
        this.scheduler = scheduler;
        this.active = true;
        this.deps = [];
        recordEffectScope(this, scope);
    }
    run() {
        if (!this.active) {
            return this.fn();
        }
        if (!effectStack.includes(this)) {
            try {
                effectStack.push((activeEffect = this));
                enableTracking();
                trackOpBit = 1 << ++effectTrackDepth;
                if (effectTrackDepth <= maxMarkerBits) {
                    initDepMarkers(this);
                }
                else {
                    cleanupEffect(this);
                }
                return this.fn();
            }
            finally {
                if (effectTrackDepth <= maxMarkerBits) {
                    finalizeDepMarkers(this);
                }
                trackOpBit = 1 << --effectTrackDepth;
                resetTracking();
                effectStack.pop();
                const n = effectStack.length;
                activeEffect = n > 0 ? effectStack[n - 1] : undefined;
            }
        }
    }
    stop() {
        if (this.active) {
            cleanupEffect(this);
            if (this.onStop) {
                this.onStop();
            }
            this.active = false;
        }
    }
}
function cleanupEffect(effect) {
    const { deps } = effect;
    if (deps.length) {
        for (let i = 0; i < deps.length; i++) {
            deps[i].delete(effect);
        }
        deps.length = 0;
    }
}
function effect(fn, options) {
    if (fn.effect) {
        fn = fn.effect.fn;
    }
    const _effect = new ReactiveEffect(fn);
    if (options) {
        shared.extend(_effect, options);
        if (options.scope)
            recordEffectScope(_effect, options.scope);
    }
    if (!options || !options.lazy) {
        _effect.run();
    }
    const runner = _effect.run.bind(_effect);
    runner.effect = _effect;
    return runner;
}
function stop(runner) {
    runner.effect.stop();
}
let shouldTrack = true;
const trackStack = [];
function pauseTracking() {
    trackStack.push(shouldTrack);
    shouldTrack = false;
}
function enableTracking() {
    trackStack.push(shouldTrack);
    shouldTrack = true;
}
function resetTracking() {
    const last = trackStack.pop();
    shouldTrack = last === undefined ? true : last;
}
function track(target, type, key) {
    if (!isTracking()) {
        return;
    }
    let depsMap = targetMap.get(target);
    if (!depsMap) {
        targetMap.set(target, (depsMap = new Map()));
    }
    let dep = depsMap.get(key);
    if (!dep) {
        depsMap.set(key, (dep = createDep()));
    }
    trackEffects(dep);
}
function isTracking() {
    return shouldTrack && activeEffect !== undefined;
}
function trackEffects(dep, debuggerEventExtraInfo) {
    let shouldTrack = false;
    if (effectTrackDepth <= maxMarkerBits) {
        if (!newTracked(dep)) {
            dep.n |= trackOpBit; // set newly tracked
            shouldTrack = !wasTracked(dep);
        }
    }
    else {
        // Full cleanup mode.
        shouldTrack = !dep.has(activeEffect);
    }
    if (shouldTrack) {
        dep.add(activeEffect);
        activeEffect.deps.push(dep);
    }
}
function trigger(target, type, key, newValue, oldValue, oldTarget) {
    const depsMap = targetMap.get(target);
    if (!depsMap) {
        // never been tracked
        return;
    }
    let deps = [];
    if (type === "clear" /* CLEAR */) {
        // collection being cleared
        // trigger all effects for target
        deps = [...depsMap.values()];
    }
    else if (key === 'length' && shared.isArray(target)) {
        depsMap.forEach((dep, key) => {
            if (key === 'length' || key >= newValue) {
                deps.push(dep);
            }
        });
    }
    else {
        // schedule runs for SET | ADD | DELETE
        if (key !== void 0) {
            deps.push(depsMap.get(key));
        }
        // also run for iteration key on ADD | DELETE | Map.SET
        switch (type) {
            case "add" /* ADD */:
                if (!shared.isArray(target)) {
                    deps.push(depsMap.get(ITERATE_KEY));
                    if (shared.isMap(target)) {
                        deps.push(depsMap.get(MAP_KEY_ITERATE_KEY));
                    }
                }
                else if (shared.isIntegerKey(key)) {
                    // new index added to array -> length changes
                    deps.push(depsMap.get('length'));
                }
                break;
            case "delete" /* DELETE */:
                if (!shared.isArray(target)) {
                    deps.push(depsMap.get(ITERATE_KEY));
                    if (shared.isMap(target)) {
                        deps.push(depsMap.get(MAP_KEY_ITERATE_KEY));
                    }
                }
                break;
            case "set" /* SET */:
                if (shared.isMap(target)) {
                    deps.push(depsMap.get(ITERATE_KEY));
                }
                break;
        }
    }
    if (deps.length === 1) {
        if (deps[0]) {
            {
                triggerEffects(deps[0]);
            }
        }
    }
    else {
        const effects = [];
        for (const dep of deps) {
            if (dep) {
                effects.push(...dep);
            }
        }
        {
            triggerEffects(createDep(effects));
        }
    }
}
function triggerEffects(dep, debuggerEventExtraInfo) {
    // spread into array for stabilization
    for (const effect of shared.isArray(dep) ? dep : [...dep]) {
        if (effect !== activeEffect || effect.allowRecurse) {
            if (effect.scheduler) {
                effect.scheduler();
            }
            else {
                effect.run();
            }
        }
    }
}

const isNonTrackableKeys = /*#__PURE__*/ shared.makeMap(`__proto__,__v_isRef,__isVue`);
const builtInSymbols = new Set(Object.getOwnPropertyNames(Symbol)
    .map(key => Symbol[key])
    .filter(shared.isSymbol));
const get = /*#__PURE__*/ createGetter();
const shallowGet = /*#__PURE__*/ createGetter(false, true);
const readonlyGet = /*#__PURE__*/ createGetter(true);
const shallowReadonlyGet = /*#__PURE__*/ createGetter(true, true);
const arrayInstrumentations = /*#__PURE__*/ createArrayInstrumentations();
function createArrayInstrumentations() {
    const instrumentations = {};
    ['includes', 'indexOf', 'lastIndexOf'].forEach(key => {
        instrumentations[key] = function (...args) {
            const arr = toRaw(this);
            for (let i = 0, l = this.length; i < l; i++) {
                track(arr, "get" /* GET */, i + '');
            }
            // we run the method using the original args first (which may be reactive)
            const res = arr[key](...args);
            if (res === -1 || res === false) {
                // if that didn't work, run it again using raw values.
                return arr[key](...args.map(toRaw));
            }
            else {
                return res;
            }
        };
    });
    ['push', 'pop', 'shift', 'unshift', 'splice'].forEach(key => {
        instrumentations[key] = function (...args) {
            pauseTracking();
            const res = toRaw(this)[key].apply(this, args);
            resetTracking();
            return res;
        };
    });
    return instrumentations;
}
function createGetter(isReadonly = false, shallow = false) {
    return function get(target, key, receiver) {
        if (key === "__v_isReactive" /* IS_REACTIVE */) {
            return !isReadonly;
        }
        else if (key === "__v_isReadonly" /* IS_READONLY */) {
            return isReadonly;
        }
        else if (key === "__v_raw" /* RAW */ &&
            receiver ===
                (isReadonly
                    ? shallow
                        ? shallowReadonlyMap
                        : readonlyMap
                    : shallow
                        ? shallowReactiveMap
                        : reactiveMap).get(target)) {
            return target;
        }
        const targetIsArray = shared.isArray(target);
        if (!isReadonly && targetIsArray && shared.hasOwn(arrayInstrumentations, key)) {
            return Reflect.get(arrayInstrumentations, key, receiver);
        }
        const res = Reflect.get(target, key, receiver);
        if (shared.isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
            return res;
        }
        if (!isReadonly) {
            track(target, "get" /* GET */, key);
        }
        if (shallow) {
            return res;
        }
        if (isRef(res)) {
            // ref unwrapping - does not apply for Array + integer key.
            const shouldUnwrap = !targetIsArray || !shared.isIntegerKey(key);
            return shouldUnwrap ? res.value : res;
        }
        if (shared.isObject(res)) {
            // Convert returned value into a proxy as well. we do the isObject check
            // here to avoid invalid value warning. Also need to lazy access readonly
            // and reactive here to avoid circular dependency.
            return isReadonly ? readonly(res) : reactive(res);
        }
        return res;
    };
}
const set = /*#__PURE__*/ createSetter();
const shallowSet = /*#__PURE__*/ createSetter(true);
function createSetter(shallow = false) {
    return function set(target, key, value, receiver) {
        let oldValue = target[key];
        if (!shallow) {
            value = toRaw(value);
            oldValue = toRaw(oldValue);
            if (!shared.isArray(target) && isRef(oldValue) && !isRef(value)) {
                oldValue.value = value;
                return true;
            }
        }
        const hadKey = shared.isArray(target) && shared.isIntegerKey(key)
            ? Number(key) < target.length
            : shared.hasOwn(target, key);
        const result = Reflect.set(target, key, value, receiver);
        // don't trigger if target is something up in the prototype chain of original
        if (target === toRaw(receiver)) {
            if (!hadKey) {
                trigger(target, "add" /* ADD */, key, value);
            }
            else if (shared.hasChanged(value, oldValue)) {
                trigger(target, "set" /* SET */, key, value);
            }
        }
        return result;
    };
}
function deleteProperty(target, key) {
    const hadKey = shared.hasOwn(target, key);
    target[key];
    const result = Reflect.deleteProperty(target, key);
    if (result && hadKey) {
        trigger(target, "delete" /* DELETE */, key, undefined);
    }
    return result;
}
function has(target, key) {
    const result = Reflect.has(target, key);
    if (!shared.isSymbol(key) || !builtInSymbols.has(key)) {
        track(target, "has" /* HAS */, key);
    }
    return result;
}
function ownKeys(target) {
    track(target, "iterate" /* ITERATE */, shared.isArray(target) ? 'length' : ITERATE_KEY);
    return Reflect.ownKeys(target);
}
const mutableHandlers = {
    get,
    set,
    deleteProperty,
    has,
    ownKeys
};
const readonlyHandlers = {
    get: readonlyGet,
    set(target, key) {
        return true;
    },
    deleteProperty(target, key) {
        return true;
    }
};
const shallowReactiveHandlers = /*#__PURE__*/ shared.extend({}, mutableHandlers, {
    get: shallowGet,
    set: shallowSet
});
// Props handlers are special in the sense that it should not unwrap top-level
// refs (in order to allow refs to be explicitly passed down), but should
// retain the reactivity of the normal readonly object.
const shallowReadonlyHandlers = /*#__PURE__*/ shared.extend({}, readonlyHandlers, {
    get: shallowReadonlyGet
});

const toReactive = (value) => shared.isObject(value) ? reactive(value) : value;
const toReadonly = (value) => shared.isObject(value) ? readonly(value) : value;
const toShallow = (value) => value;
const getProto = (v) => Reflect.getPrototypeOf(v);
function get$1(target, key, isReadonly = false, isShallow = false) {
    // #1772: readonly(reactive(Map)) should return readonly + reactive version
    // of the value
    target = target["__v_raw" /* RAW */];
    const rawTarget = toRaw(target);
    const rawKey = toRaw(key);
    if (key !== rawKey) {
        !isReadonly && track(rawTarget, "get" /* GET */, key);
    }
    !isReadonly && track(rawTarget, "get" /* GET */, rawKey);
    const { has } = getProto(rawTarget);
    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
    if (has.call(rawTarget, key)) {
        return wrap(target.get(key));
    }
    else if (has.call(rawTarget, rawKey)) {
        return wrap(target.get(rawKey));
    }
    else if (target !== rawTarget) {
        // #3602 readonly(reactive(Map))
        // ensure that the nested reactive `Map` can do tracking for itself
        target.get(key);
    }
}
function has$1(key, isReadonly = false) {
    const target = this["__v_raw" /* RAW */];
    const rawTarget = toRaw(target);
    const rawKey = toRaw(key);
    if (key !== rawKey) {
        !isReadonly && track(rawTarget, "has" /* HAS */, key);
    }
    !isReadonly && track(rawTarget, "has" /* HAS */, rawKey);
    return key === rawKey
        ? target.has(key)
        : target.has(key) || target.has(rawKey);
}
function size(target, isReadonly = false) {
    target = target["__v_raw" /* RAW */];
    !isReadonly && track(toRaw(target), "iterate" /* ITERATE */, ITERATE_KEY);
    return Reflect.get(target, 'size', target);
}
function add(value) {
    value = toRaw(value);
    const target = toRaw(this);
    const proto = getProto(target);
    const hadKey = proto.has.call(target, value);
    if (!hadKey) {
        target.add(value);
        trigger(target, "add" /* ADD */, value, value);
    }
    return this;
}
function set$1(key, value) {
    value = toRaw(value);
    const target = toRaw(this);
    const { has, get } = getProto(target);
    let hadKey = has.call(target, key);
    if (!hadKey) {
        key = toRaw(key);
        hadKey = has.call(target, key);
    }
    const oldValue = get.call(target, key);
    target.set(key, value);
    if (!hadKey) {
        trigger(target, "add" /* ADD */, key, value);
    }
    else if (shared.hasChanged(value, oldValue)) {
        trigger(target, "set" /* SET */, key, value);
    }
    return this;
}
function deleteEntry(key) {
    const target = toRaw(this);
    const { has, get } = getProto(target);
    let hadKey = has.call(target, key);
    if (!hadKey) {
        key = toRaw(key);
        hadKey = has.call(target, key);
    }
    get ? get.call(target, key) : undefined;
    // forward the operation before queueing reactions
    const result = target.delete(key);
    if (hadKey) {
        trigger(target, "delete" /* DELETE */, key, undefined);
    }
    return result;
}
function clear() {
    const target = toRaw(this);
    const hadItems = target.size !== 0;
    // forward the operation before queueing reactions
    const result = target.clear();
    if (hadItems) {
        trigger(target, "clear" /* CLEAR */, undefined, undefined);
    }
    return result;
}
function createForEach(isReadonly, isShallow) {
    return function forEach(callback, thisArg) {
        const observed = this;
        const target = observed["__v_raw" /* RAW */];
        const rawTarget = toRaw(target);
        const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
        !isReadonly && track(rawTarget, "iterate" /* ITERATE */, ITERATE_KEY);
        return target.forEach((value, key) => {
            // important: make sure the callback is
            // 1. invoked with the reactive map as `this` and 3rd arg
            // 2. the value received should be a corresponding reactive/readonly.
            return callback.call(thisArg, wrap(value), wrap(key), observed);
        });
    };
}
function createIterableMethod(method, isReadonly, isShallow) {
    return function (...args) {
        const target = this["__v_raw" /* RAW */];
        const rawTarget = toRaw(target);
        const targetIsMap = shared.isMap(rawTarget);
        const isPair = method === 'entries' || (method === Symbol.iterator && targetIsMap);
        const isKeyOnly = method === 'keys' && targetIsMap;
        const innerIterator = target[method](...args);
        const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
        !isReadonly &&
            track(rawTarget, "iterate" /* ITERATE */, isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY);
        // return a wrapped iterator which returns observed versions of the
        // values emitted from the real iterator
        return {
            // iterator protocol
            next() {
                const { value, done } = innerIterator.next();
                return done
                    ? { value, done }
                    : {
                        value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
                        done
                    };
            },
            // iterable protocol
            [Symbol.iterator]() {
                return this;
            }
        };
    };
}
function createReadonlyMethod(type) {
    return function (...args) {
        return type === "delete" /* DELETE */ ? false : this;
    };
}
function createInstrumentations() {
    const mutableInstrumentations = {
        get(key) {
            return get$1(this, key);
        },
        get size() {
            return size(this);
        },
        has: has$1,
        add,
        set: set$1,
        delete: deleteEntry,
        clear,
        forEach: createForEach(false, false)
    };
    const shallowInstrumentations = {
        get(key) {
            return get$1(this, key, false, true);
        },
        get size() {
            return size(this);
        },
        has: has$1,
        add,
        set: set$1,
        delete: deleteEntry,
        clear,
        forEach: createForEach(false, true)
    };
    const readonlyInstrumentations = {
        get(key) {
            return get$1(this, key, true);
        },
        get size() {
            return size(this, true);
        },
        has(key) {
            return has$1.call(this, key, true);
        },
        add: createReadonlyMethod("add" /* ADD */),
        set: createReadonlyMethod("set" /* SET */),
        delete: createReadonlyMethod("delete" /* DELETE */),
        clear: createReadonlyMethod("clear" /* CLEAR */),
        forEach: createForEach(true, false)
    };
    const shallowReadonlyInstrumentations = {
        get(key) {
            return get$1(this, key, true, true);
        },
        get size() {
            return size(this, true);
        },
        has(key) {
            return has$1.call(this, key, true);
        },
        add: createReadonlyMethod("add" /* ADD */),
        set: createReadonlyMethod("set" /* SET */),
        delete: createReadonlyMethod("delete" /* DELETE */),
        clear: createReadonlyMethod("clear" /* CLEAR */),
        forEach: createForEach(true, true)
    };
    const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator];
    iteratorMethods.forEach(method => {
        mutableInstrumentations[method] = createIterableMethod(method, false, false);
        readonlyInstrumentations[method] = createIterableMethod(method, true, false);
        shallowInstrumentations[method] = createIterableMethod(method, false, true);
        shallowReadonlyInstrumentations[method] = createIterableMethod(method, true, true);
    });
    return [
        mutableInstrumentations,
        readonlyInstrumentations,
        shallowInstrumentations,
        shallowReadonlyInstrumentations
    ];
}
const [mutableInstrumentations, readonlyInstrumentations, shallowInstrumentations, shallowReadonlyInstrumentations] = /* #__PURE__*/ createInstrumentations();
function createInstrumentationGetter(isReadonly, shallow) {
    const instrumentations = shallow
        ? isReadonly
            ? shallowReadonlyInstrumentations
            : shallowInstrumentations
        : isReadonly
            ? readonlyInstrumentations
            : mutableInstrumentations;
    return (target, key, receiver) => {
        if (key === "__v_isReactive" /* IS_REACTIVE */) {
            return !isReadonly;
        }
        else if (key === "__v_isReadonly" /* IS_READONLY */) {
            return isReadonly;
        }
        else if (key === "__v_raw" /* RAW */) {
            return target;
        }
        return Reflect.get(shared.hasOwn(instrumentations, key) && key in target
            ? instrumentations
            : target, key, receiver);
    };
}
const mutableCollectionHandlers = {
    get: /*#__PURE__*/ createInstrumentationGetter(false, false)
};
const shallowCollectionHandlers = {
    get: /*#__PURE__*/ createInstrumentationGetter(false, true)
};
const readonlyCollectionHandlers = {
    get: /*#__PURE__*/ createInstrumentationGetter(true, false)
};
const shallowReadonlyCollectionHandlers = {
    get: /*#__PURE__*/ createInstrumentationGetter(true, true)
};

const reactiveMap = new WeakMap();
const shallowReactiveMap = new WeakMap();
const readonlyMap = new WeakMap();
const shallowReadonlyMap = new WeakMap();
function targetTypeMap(rawType) {
    switch (rawType) {
        case 'Object':
        case 'Array':
            return 1 /* COMMON */;
        case 'Map':
        case 'Set':
        case 'WeakMap':
        case 'WeakSet':
            return 2 /* COLLECTION */;
        default:
            return 0 /* INVALID */;
    }
}
function getTargetType(value) {
    return value["__v_skip" /* SKIP */] || !Object.isExtensible(value)
        ? 0 /* INVALID */
        : targetTypeMap(shared.toRawType(value));
}
function reactive(target) {
    // if trying to observe a readonly proxy, return the readonly version.
    if (target && target["__v_isReadonly" /* IS_READONLY */]) {
        return target;
    }
    return createReactiveObject(target, false, mutableHandlers, mutableCollectionHandlers, reactiveMap);
}
/**
 * Return a shallowly-reactive copy of the original object, where only the root
 * level properties are reactive. It also does not auto-unwrap refs (even at the
 * root level).
 */
function shallowReactive(target) {
    return createReactiveObject(target, false, shallowReactiveHandlers, shallowCollectionHandlers, shallowReactiveMap);
}
/**
 * Creates a readonly copy of the original object. Note the returned copy is not
 * made reactive, but `readonly` can be called on an already reactive object.
 */
function readonly(target) {
    return createReactiveObject(target, true, readonlyHandlers, readonlyCollectionHandlers, readonlyMap);
}
/**
 * Returns a reactive-copy of the original object, where only the root level
 * properties are readonly, and does NOT unwrap refs nor recursively convert
 * returned properties.
 * This is used for creating the props proxy object for stateful components.
 */
function shallowReadonly(target) {
    return createReactiveObject(target, true, shallowReadonlyHandlers, shallowReadonlyCollectionHandlers, shallowReadonlyMap);
}
function createReactiveObject(target, isReadonly, baseHandlers, collectionHandlers, proxyMap) {
    if (!shared.isObject(target)) {
        return target;
    }
    // target is already a Proxy, return it.
    // exception: calling readonly() on a reactive object
    if (target["__v_raw" /* RAW */] &&
        !(isReadonly && target["__v_isReactive" /* IS_REACTIVE */])) {
        return target;
    }
    // target already has corresponding Proxy
    const existingProxy = proxyMap.get(target);
    if (existingProxy) {
        return existingProxy;
    }
    // only a whitelist of value types can be observed.
    const targetType = getTargetType(target);
    if (targetType === 0 /* INVALID */) {
        return target;
    }
    const proxy = new Proxy(target, targetType === 2 /* COLLECTION */ ? collectionHandlers : baseHandlers);
    proxyMap.set(target, proxy);
    return proxy;
}
function isReactive(value) {
    if (isReadonly(value)) {
        return isReactive(value["__v_raw" /* RAW */]);
    }
    return !!(value && value["__v_isReactive" /* IS_REACTIVE */]);
}
function isReadonly(value) {
    return !!(value && value["__v_isReadonly" /* IS_READONLY */]);
}
function isProxy(value) {
    return isReactive(value) || isReadonly(value);
}
function toRaw(observed) {
    const raw = observed && observed["__v_raw" /* RAW */];
    return raw ? toRaw(raw) : observed;
}
function markRaw(value) {
    shared.def(value, "__v_skip" /* SKIP */, true);
    return value;
}

function trackRefValue(ref) {
    if (isTracking()) {
        ref = toRaw(ref);
        if (!ref.dep) {
            ref.dep = createDep();
        }
        {
            trackEffects(ref.dep);
        }
    }
}
function triggerRefValue(ref, newVal) {
    ref = toRaw(ref);
    if (ref.dep) {
        {
            triggerEffects(ref.dep);
        }
    }
}
const convert = (val) => shared.isObject(val) ? reactive(val) : val;
function isRef(r) {
    return Boolean(r && r.__v_isRef === true);
}
function ref(value) {
    return createRef(value, false);
}
function shallowRef(value) {
    return createRef(value, true);
}
class RefImpl {
    constructor(value, _shallow) {
        this._shallow = _shallow;
        this.dep = undefined;
        this.__v_isRef = true;
        this._rawValue = _shallow ? value : toRaw(value);
        this._value = _shallow ? value : convert(value);
    }
    get value() {
        trackRefValue(this);
        return this._value;
    }
    set value(newVal) {
        newVal = this._shallow ? newVal : toRaw(newVal);
        if (shared.hasChanged(newVal, this._rawValue)) {
            this._rawValue = newVal;
            this._value = this._shallow ? newVal : convert(newVal);
            triggerRefValue(this);
        }
    }
}
function createRef(rawValue, shallow) {
    if (isRef(rawValue)) {
        return rawValue;
    }
    return new RefImpl(rawValue, shallow);
}
function triggerRef(ref) {
    triggerRefValue(ref);
}
function unref(ref) {
    return isRef(ref) ? ref.value : ref;
}
const shallowUnwrapHandlers = {
    get: (target, key, receiver) => unref(Reflect.get(target, key, receiver)),
    set: (target, key, value, receiver) => {
        const oldValue = target[key];
        if (isRef(oldValue) && !isRef(value)) {
            oldValue.value = value;
            return true;
        }
        else {
            return Reflect.set(target, key, value, receiver);
        }
    }
};
function proxyRefs(objectWithRefs) {
    return isReactive(objectWithRefs)
        ? objectWithRefs
        : new Proxy(objectWithRefs, shallowUnwrapHandlers);
}
class CustomRefImpl {
    constructor(factory) {
        this.dep = undefined;
        this.__v_isRef = true;
        const { get, set } = factory(() => trackRefValue(this), () => triggerRefValue(this));
        this._get = get;
        this._set = set;
    }
    get value() {
        return this._get();
    }
    set value(newVal) {
        this._set(newVal);
    }
}
function customRef(factory) {
    return new CustomRefImpl(factory);
}
function toRefs(object) {
    const ret = shared.isArray(object) ? new Array(object.length) : {};
    for (const key in object) {
        ret[key] = toRef(object, key);
    }
    return ret;
}
class ObjectRefImpl {
    constructor(_object, _key) {
        this._object = _object;
        this._key = _key;
        this.__v_isRef = true;
    }
    get value() {
        return this._object[this._key];
    }
    set value(newVal) {
        this._object[this._key] = newVal;
    }
}
function toRef(object, key) {
    const val = object[key];
    return isRef(val) ? val : new ObjectRefImpl(object, key);
}

class ComputedRefImpl {
    constructor(getter, _setter, isReadonly) {
        this._setter = _setter;
        this.dep = undefined;
        this._dirty = true;
        this.__v_isRef = true;
        this.effect = new ReactiveEffect(getter, () => {
            if (!this._dirty) {
                this._dirty = true;
                triggerRefValue(this);
            }
        });
        this["__v_isReadonly" /* IS_READONLY */] = isReadonly;
    }
    get value() {
        // the computed ref may get wrapped by other proxies e.g. readonly() #3376
        const self = toRaw(this);
        trackRefValue(self);
        if (self._dirty) {
            self._dirty = false;
            self._value = self.effect.run();
        }
        return self._value;
    }
    set value(newValue) {
        this._setter(newValue);
    }
}
function computed(getterOrOptions, debugOptions) {
    let getter;
    let setter;
    if (shared.isFunction(getterOrOptions)) {
        getter = getterOrOptions;
        setter = shared.NOOP;
    }
    else {
        getter = getterOrOptions.get;
        setter = getterOrOptions.set;
    }
    const cRef = new ComputedRefImpl(getter, setter, shared.isFunction(getterOrOptions) || !getterOrOptions.set);
    return cRef;
}

var _a;
const tick = Promise.resolve();
const queue = [];
let queued = false;
const scheduler = (fn) => {
    queue.push(fn);
    if (!queued) {
        queued = true;
        tick.then(flush);
    }
};
const flush = () => {
    for (let i = 0; i < queue.length; i++) {
        queue[i]();
    }
    queue.length = 0;
    queued = false;
};
class DeferredComputedRefImpl {
    constructor(getter) {
        this.dep = undefined;
        this._dirty = true;
        this.__v_isRef = true;
        this[_a] = true;
        let compareTarget;
        let hasCompareTarget = false;
        let scheduled = false;
        this.effect = new ReactiveEffect(getter, (computedTrigger) => {
            if (this.dep) {
                if (computedTrigger) {
                    compareTarget = this._value;
                    hasCompareTarget = true;
                }
                else if (!scheduled) {
                    const valueToCompare = hasCompareTarget ? compareTarget : this._value;
                    scheduled = true;
                    hasCompareTarget = false;
                    scheduler(() => {
                        if (this.effect.active && this._get() !== valueToCompare) {
                            triggerRefValue(this);
                        }
                        scheduled = false;
                    });
                }
                // chained upstream computeds are notified synchronously to ensure
                // value invalidation in case of sync access; normal effects are
                // deferred to be triggered in scheduler.
                for (const e of this.dep) {
                    if (e.computed) {
                        e.scheduler(true /* computedTrigger */);
                    }
                }
            }
            this._dirty = true;
        });
        this.effect.computed = true;
    }
    _get() {
        if (this._dirty) {
            this._dirty = false;
            return (this._value = this.effect.run());
        }
        return this._value;
    }
    get value() {
        trackRefValue(this);
        // the computed ref may get wrapped by other proxies e.g. readonly() #3376
        return toRaw(this)._get();
    }
}
_a = "__v_isReadonly" /* IS_READONLY */;
function deferredComputed(getter) {
    return new DeferredComputedRefImpl(getter);
}

exports.EffectScope = EffectScope;
exports.ITERATE_KEY = ITERATE_KEY;
exports.ReactiveEffect = ReactiveEffect;
exports.computed = computed;
exports.customRef = customRef;
exports.deferredComputed = deferredComputed;
exports.effect = effect;
exports.effectScope = effectScope;
exports.enableTracking = enableTracking;
exports.getCurrentScope = getCurrentScope;
exports.isProxy = isProxy;
exports.isReactive = isReactive;
exports.isReadonly = isReadonly;
exports.isRef = isRef;
exports.markRaw = markRaw;
exports.onScopeDispose = onScopeDispose;
exports.pauseTracking = pauseTracking;
exports.proxyRefs = proxyRefs;
exports.reactive = reactive;
exports.readonly = readonly;
exports.ref = ref;
exports.resetTracking = resetTracking;
exports.shallowReactive = shallowReactive;
exports.shallowReadonly = shallowReadonly;
exports.shallowRef = shallowRef;
exports.stop = stop;
exports.toRaw = toRaw;
exports.toRef = toRef;
exports.toRefs = toRefs;
exports.track = track;
exports.trigger = trigger;
exports.triggerRef = triggerRef;
exports.unref = unref;


/***/ }),

/***/ 8586:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


if (true) {
  module.exports = __webpack_require__(7818)
} else {}


/***/ }),

/***/ 6447:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", ({ value: true }));

var reactivity = __webpack_require__(8586);
var shared = __webpack_require__(9109);

function setDevtoolsHook(hook) {
    exports.devtools = hook;
}

function warnDeprecation(key, instance, ...args) {
    {
        return;
    }
}
const globalCompatConfig = {
    MODE: 2
};
function getCompatConfigForKey(key, instance) {
    const instanceConfig = instance && instance.type.compatConfig;
    if (instanceConfig && key in instanceConfig) {
        return instanceConfig[key];
    }
    return globalCompatConfig[key];
}
function isCompatEnabled(key, instance, enableForBuiltIn = false) {
    // skip compat for built-in components
    if (!enableForBuiltIn && instance && instance.type.__isBuiltIn) {
        return false;
    }
    const rawMode = getCompatConfigForKey('MODE', instance) || 2;
    const val = getCompatConfigForKey(key, instance);
    const mode = shared.isFunction(rawMode)
        ? rawMode(instance && instance.type)
        : rawMode;
    if (mode === 2) {
        return val !== false;
    }
    else {
        return val === true || val === 'suppress-warning';
    }
}

function emit(instance, event, ...rawArgs) {
    const props = instance.vnode.props || shared.EMPTY_OBJ;
    let args = rawArgs;
    const isModelListener = event.startsWith('update:');
    // for v-model update:xxx events, apply modifiers on args
    const modelArg = isModelListener && event.slice(7);
    if (modelArg && modelArg in props) {
        const modifiersKey = `${modelArg === 'modelValue' ? 'model' : modelArg}Modifiers`;
        const { number, trim } = props[modifiersKey] || shared.EMPTY_OBJ;
        if (trim) {
            args = rawArgs.map(a => a.trim());
        }
        else if (number) {
            args = rawArgs.map(shared.toNumber);
        }
    }
    let handlerName;
    let handler = props[(handlerName = shared.toHandlerKey(event))] ||
        // also try camelCase event handler (#2249)
        props[(handlerName = shared.toHandlerKey(shared.camelize(event)))];
    // for v-model update:xxx events, also trigger kebab-case equivalent
    // for props passed via kebab-case
    if (!handler && isModelListener) {
        handler = props[(handlerName = shared.toHandlerKey(shared.hyphenate(event)))];
    }
    if (handler) {
        callWithAsyncErrorHandling(handler, instance, 6 /* COMPONENT_EVENT_HANDLER */, args);
    }
    const onceHandler = props[handlerName + `Once`];
    if (onceHandler) {
        if (!instance.emitted) {
            instance.emitted = {};
        }
        else if (instance.emitted[handlerName]) {
            return;
        }
        instance.emitted[handlerName] = true;
        callWithAsyncErrorHandling(onceHandler, instance, 6 /* COMPONENT_EVENT_HANDLER */, args);
    }
}
function normalizeEmitsOptions(comp, appContext, asMixin = false) {
    const cache = appContext.emitsCache;
    const cached = cache.get(comp);
    if (cached !== undefined) {
        return cached;
    }
    const raw = comp.emits;
    let normalized = {};
    // apply mixin/extends props
    let hasExtends = false;
    if (!shared.isFunction(comp)) {
        const extendEmits = (raw) => {
            const normalizedFromExtend = normalizeEmitsOptions(raw, appContext, true);
            if (normalizedFromExtend) {
                hasExtends = true;
                shared.extend(normalized, normalizedFromExtend);
            }
        };
        if (!asMixin && appContext.mixins.length) {
            appContext.mixins.forEach(extendEmits);
        }
        if (comp.extends) {
            extendEmits(comp.extends);
        }
        if (comp.mixins) {
            comp.mixins.forEach(extendEmits);
        }
    }
    if (!raw && !hasExtends) {
        cache.set(comp, null);
        return null;
    }
    if (shared.isArray(raw)) {
        raw.forEach(key => (normalized[key] = null));
    }
    else {
        shared.extend(normalized, raw);
    }
    cache.set(comp, normalized);
    return normalized;
}
// Check if an incoming prop key is a declared emit event listener.
// e.g. With `emits: { click: null }`, props named `onClick` and `onclick` are
// both considered matched listeners.
function isEmitListener(options, key) {
    if (!options || !shared.isOn(key)) {
        return false;
    }
    key = key.slice(2).replace(/Once$/, '');
    return (shared.hasOwn(options, key[0].toLowerCase() + key.slice(1)) ||
        shared.hasOwn(options, shared.hyphenate(key)) ||
        shared.hasOwn(options, key));
}

/**
 * mark the current rendering instance for asset resolution (e.g.
 * resolveComponent, resolveDirective) during render
 */
let currentRenderingInstance = null;
let currentScopeId = null;
/**
 * Note: rendering calls maybe nested. The function returns the parent rendering
 * instance if present, which should be restored after the render is done:
 *
 * ```js
 * const prev = setCurrentRenderingInstance(i)
 * // ...render
 * setCurrentRenderingInstance(prev)
 * ```
 */
function setCurrentRenderingInstance(instance) {
    const prev = currentRenderingInstance;
    currentRenderingInstance = instance;
    currentScopeId = (instance && instance.type.__scopeId) || null;
    return prev;
}
/**
 * Set scope id when creating hoisted vnodes.
 * @private compiler helper
 */
function pushScopeId(id) {
    currentScopeId = id;
}
/**
 * Technically we no longer need this after 3.0.8 but we need to keep the same
 * API for backwards compat w/ code generated by compilers.
 * @private
 */
function popScopeId() {
    currentScopeId = null;
}
/**
 * Only for backwards compat
 * @private
 */
const withScopeId = (_id) => withCtx;
/**
 * Wrap a slot function to memoize current rendering instance
 * @private compiler helper
 */
function withCtx(fn, ctx = currentRenderingInstance, isNonScopedSlot // false only
) {
    if (!ctx)
        return fn;
    // already normalized
    if (fn._n) {
        return fn;
    }
    const renderFnWithContext = (...args) => {
        // If a user calls a compiled slot inside a template expression (#1745), it
        // can mess up block tracking, so by default we disable block tracking and
        // force bail out when invoking a compiled slot (indicated by the ._d flag).
        // This isn't necessary if rendering a compiled `<slot>`, so we flip the
        // ._d flag off when invoking the wrapped fn inside `renderSlot`.
        if (renderFnWithContext._d) {
            setBlockTracking(-1);
        }
        const prevInstance = setCurrentRenderingInstance(ctx);
        const res = fn(...args);
        setCurrentRenderingInstance(prevInstance);
        if (renderFnWithContext._d) {
            setBlockTracking(1);
        }
        return res;
    };
    // mark normalized to avoid duplicated wrapping
    renderFnWithContext._n = true;
    // mark this as compiled by default
    // this is used in vnode.ts -> normalizeChildren() to set the slot
    // rendering flag.
    renderFnWithContext._c = true;
    // disable block tracking by default
    renderFnWithContext._d = true;
    return renderFnWithContext;
}

/**
 * dev only flag to track whether $attrs was used during render.
 * If $attrs was used during render then the warning for failed attrs
 * fallthrough can be suppressed.
 */
let accessedAttrs = false;
function markAttrsAccessed() {
    accessedAttrs = true;
}
function renderComponentRoot(instance) {
    const { type: Component, vnode, proxy, withProxy, props, propsOptions: [propsOptions], slots, attrs, emit, render, renderCache, data, setupState, ctx, inheritAttrs } = instance;
    let result;
    const prev = setCurrentRenderingInstance(instance);
    try {
        let fallthroughAttrs;
        if (vnode.shapeFlag & 4 /* STATEFUL_COMPONENT */) {
            // withProxy is a proxy with a different `has` trap only for
            // runtime-compiled render functions using `with` block.
            const proxyToUse = withProxy || proxy;
            result = normalizeVNode(render.call(proxyToUse, proxyToUse, renderCache, props, setupState, data, ctx));
            fallthroughAttrs = attrs;
        }
        else {
            // functional
            const render = Component;
            // in dev, mark attrs accessed if optional props (attrs === props)
            if (false) {}
            result = normalizeVNode(render.length > 1
                ? render(props,  false
                    ? 0
                    : { attrs, slots, emit })
                : render(props, null /* we know it doesn't need it */));
            fallthroughAttrs = Component.props
                ? attrs
                : getFunctionalFallthrough(attrs);
        }
        // attr merging
        // in dev mode, comments are preserved, and it's possible for a template
        // to have comments along side the root element which makes it a fragment
        let root = result;
        let setRoot = undefined;
        if (false /* DEV_ROOT_FRAGMENT */) {}
        if (fallthroughAttrs && inheritAttrs !== false) {
            const keys = Object.keys(fallthroughAttrs);
            const { shapeFlag } = root;
            if (keys.length) {
                if (shapeFlag & (1 /* ELEMENT */ | 6 /* COMPONENT */)) {
                    if (propsOptions && keys.some(shared.isModelListener)) {
                        // If a v-model listener (onUpdate:xxx) has a corresponding declared
                        // prop, it indicates this component expects to handle v-model and
                        // it should not fallthrough.
                        // related: #1543, #1643, #1989
                        fallthroughAttrs = filterModelListeners(fallthroughAttrs, propsOptions);
                    }
                    root = cloneVNode(root, fallthroughAttrs);
                }
                else if (false) {}
            }
        }
        if (false) {}
        // inherit directives
        if (vnode.dirs) {
            if (false) {}
            root.dirs = root.dirs ? root.dirs.concat(vnode.dirs) : vnode.dirs;
        }
        // inherit transition data
        if (vnode.transition) {
            if (false) {}
            root.transition = vnode.transition;
        }
        if (false) {}
        else {
            result = root;
        }
    }
    catch (err) {
        blockStack.length = 0;
        handleError(err, instance, 1 /* RENDER_FUNCTION */);
        result = createVNode(Comment);
    }
    setCurrentRenderingInstance(prev);
    return result;
}
/**
 * dev only
 * In dev mode, template root level comments are rendered, which turns the
 * template into a fragment root, but we need to locate the single element
 * root for attrs and scope id processing.
 */
const getChildRoot = (vnode) => {
    const rawChildren = vnode.children;
    const dynamicChildren = vnode.dynamicChildren;
    const childRoot = filterSingleRoot(rawChildren);
    if (!childRoot) {
        return [vnode, undefined];
    }
    const index = rawChildren.indexOf(childRoot);
    const dynamicIndex = dynamicChildren ? dynamicChildren.indexOf(childRoot) : -1;
    const setRoot = (updatedRoot) => {
        rawChildren[index] = updatedRoot;
        if (dynamicChildren) {
            if (dynamicIndex > -1) {
                dynamicChildren[dynamicIndex] = updatedRoot;
            }
            else if (updatedRoot.patchFlag > 0) {
                vnode.dynamicChildren = [...dynamicChildren, updatedRoot];
            }
        }
    };
    return [normalizeVNode(childRoot), setRoot];
};
function filterSingleRoot(children) {
    let singleRoot;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (isVNode(child)) {
            // ignore user comment
            if (child.type !== Comment || child.children === 'v-if') {
                if (singleRoot) {
                    // has more than 1 non-comment child, return now
                    return;
                }
                else {
                    singleRoot = child;
                }
            }
        }
        else {
            return;
        }
    }
    return singleRoot;
}
const getFunctionalFallthrough = (attrs) => {
    let res;
    for (const key in attrs) {
        if (key === 'class' || key === 'style' || shared.isOn(key)) {
            (res || (res = {}))[key] = attrs[key];
        }
    }
    return res;
};
const filterModelListeners = (attrs, props) => {
    const res = {};
    for (const key in attrs) {
        if (!shared.isModelListener(key) || !(key.slice(9) in props)) {
            res[key] = attrs[key];
        }
    }
    return res;
};
const isElementRoot = (vnode) => {
    return (vnode.shapeFlag & (6 /* COMPONENT */ | 1 /* ELEMENT */) ||
        vnode.type === Comment // potential v-if branch switch
    );
};
function shouldUpdateComponent(prevVNode, nextVNode, optimized) {
    const { props: prevProps, children: prevChildren, component } = prevVNode;
    const { props: nextProps, children: nextChildren, patchFlag } = nextVNode;
    const emits = component.emitsOptions;
    // force child update for runtime directive or transition on component vnode.
    if (nextVNode.dirs || nextVNode.transition) {
        return true;
    }
    if (optimized && patchFlag >= 0) {
        if (patchFlag & 1024 /* DYNAMIC_SLOTS */) {
            // slot content that references values that might have changed,
            // e.g. in a v-for
            return true;
        }
        if (patchFlag & 16 /* FULL_PROPS */) {
            if (!prevProps) {
                return !!nextProps;
            }
            // presence of this flag indicates props are always non-null
            return hasPropsChanged(prevProps, nextProps, emits);
        }
        else if (patchFlag & 8 /* PROPS */) {
            const dynamicProps = nextVNode.dynamicProps;
            for (let i = 0; i < dynamicProps.length; i++) {
                const key = dynamicProps[i];
                if (nextProps[key] !== prevProps[key] &&
                    !isEmitListener(emits, key)) {
                    return true;
                }
            }
        }
    }
    else {
        // this path is only taken by manually written render functions
        // so presence of any children leads to a forced update
        if (prevChildren || nextChildren) {
            if (!nextChildren || !nextChildren.$stable) {
                return true;
            }
        }
        if (prevProps === nextProps) {
            return false;
        }
        if (!prevProps) {
            return !!nextProps;
        }
        if (!nextProps) {
            return true;
        }
        return hasPropsChanged(prevProps, nextProps, emits);
    }
    return false;
}
function hasPropsChanged(prevProps, nextProps, emitsOptions) {
    const nextKeys = Object.keys(nextProps);
    if (nextKeys.length !== Object.keys(prevProps).length) {
        return true;
    }
    for (let i = 0; i < nextKeys.length; i++) {
        const key = nextKeys[i];
        if (nextProps[key] !== prevProps[key] &&
            !isEmitListener(emitsOptions, key)) {
            return true;
        }
    }
    return false;
}
function updateHOCHostEl({ vnode, parent }, el // HostNode
) {
    while (parent && parent.subTree === vnode) {
        (vnode = parent.vnode).el = el;
        parent = parent.parent;
    }
}

const isSuspense = (type) => type.__isSuspense;
// Suspense exposes a component-like API, and is treated like a component
// in the compiler, but internally it's a special built-in type that hooks
// directly into the renderer.
const SuspenseImpl = {
    name: 'Suspense',
    // In order to make Suspense tree-shakable, we need to avoid importing it
    // directly in the renderer. The renderer checks for the __isSuspense flag
    // on a vnode's type and calls the `process` method, passing in renderer
    // internals.
    __isSuspense: true,
    process(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized, 
    // platform-specific impl passed from renderer
    rendererInternals) {
        if (n1 == null) {
            mountSuspense(n2, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized, rendererInternals);
        }
        else {
            patchSuspense(n1, n2, container, anchor, parentComponent, isSVG, slotScopeIds, optimized, rendererInternals);
        }
    },
    hydrate: hydrateSuspense,
    create: createSuspenseBoundary,
    normalize: normalizeSuspenseChildren
};
// Force-casted public typing for h and TSX props inference
const Suspense = (SuspenseImpl );
function triggerEvent(vnode, name) {
    const eventListener = vnode.props && vnode.props[name];
    if (shared.isFunction(eventListener)) {
        eventListener();
    }
}
function mountSuspense(vnode, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized, rendererInternals) {
    const { p: patch, o: { createElement } } = rendererInternals;
    const hiddenContainer = createElement('div');
    const suspense = (vnode.suspense = createSuspenseBoundary(vnode, parentSuspense, parentComponent, container, hiddenContainer, anchor, isSVG, slotScopeIds, optimized, rendererInternals));
    // start mounting the content subtree in an off-dom container
    patch(null, (suspense.pendingBranch = vnode.ssContent), hiddenContainer, null, parentComponent, suspense, isSVG, slotScopeIds);
    // now check if we have encountered any async deps
    if (suspense.deps > 0) {
        // has async
        // invoke @fallback event
        triggerEvent(vnode, 'onPending');
        triggerEvent(vnode, 'onFallback');
        // mount the fallback tree
        patch(null, vnode.ssFallback, container, anchor, parentComponent, null, // fallback tree will not have suspense context
        isSVG, slotScopeIds);
        setActiveBranch(suspense, vnode.ssFallback);
    }
    else {
        // Suspense has no async deps. Just resolve.
        suspense.resolve();
    }
}
function patchSuspense(n1, n2, container, anchor, parentComponent, isSVG, slotScopeIds, optimized, { p: patch, um: unmount, o: { createElement } }) {
    const suspense = (n2.suspense = n1.suspense);
    suspense.vnode = n2;
    n2.el = n1.el;
    const newBranch = n2.ssContent;
    const newFallback = n2.ssFallback;
    const { activeBranch, pendingBranch, isInFallback, isHydrating } = suspense;
    if (pendingBranch) {
        suspense.pendingBranch = newBranch;
        if (isSameVNodeType(newBranch, pendingBranch)) {
            // same root type but content may have changed.
            patch(pendingBranch, newBranch, suspense.hiddenContainer, null, parentComponent, suspense, isSVG, slotScopeIds, optimized);
            if (suspense.deps <= 0) {
                suspense.resolve();
            }
            else if (isInFallback) {
                patch(activeBranch, newFallback, container, anchor, parentComponent, null, // fallback tree will not have suspense context
                isSVG, slotScopeIds, optimized);
                setActiveBranch(suspense, newFallback);
            }
        }
        else {
            // toggled before pending tree is resolved
            suspense.pendingId++;
            if (isHydrating) {
                // if toggled before hydration is finished, the current DOM tree is
                // no longer valid. set it as the active branch so it will be unmounted
                // when resolved
                suspense.isHydrating = false;
                suspense.activeBranch = pendingBranch;
            }
            else {
                unmount(pendingBranch, parentComponent, suspense);
            }
            // increment pending ID. this is used to invalidate async callbacks
            // reset suspense state
            suspense.deps = 0;
            // discard effects from pending branch
            suspense.effects.length = 0;
            // discard previous container
            suspense.hiddenContainer = createElement('div');
            if (isInFallback) {
                // already in fallback state
                patch(null, newBranch, suspense.hiddenContainer, null, parentComponent, suspense, isSVG, slotScopeIds, optimized);
                if (suspense.deps <= 0) {
                    suspense.resolve();
                }
                else {
                    patch(activeBranch, newFallback, container, anchor, parentComponent, null, // fallback tree will not have suspense context
                    isSVG, slotScopeIds, optimized);
                    setActiveBranch(suspense, newFallback);
                }
            }
            else if (activeBranch && isSameVNodeType(newBranch, activeBranch)) {
                // toggled "back" to current active branch
                patch(activeBranch, newBranch, container, anchor, parentComponent, suspense, isSVG, slotScopeIds, optimized);
                // force resolve
                suspense.resolve(true);
            }
            else {
                // switched to a 3rd branch
                patch(null, newBranch, suspense.hiddenContainer, null, parentComponent, suspense, isSVG, slotScopeIds, optimized);
                if (suspense.deps <= 0) {
                    suspense.resolve();
                }
            }
        }
    }
    else {
        if (activeBranch && isSameVNodeType(newBranch, activeBranch)) {
            // root did not change, just normal patch
            patch(activeBranch, newBranch, container, anchor, parentComponent, suspense, isSVG, slotScopeIds, optimized);
            setActiveBranch(suspense, newBranch);
        }
        else {
            // root node toggled
            // invoke @pending event
            triggerEvent(n2, 'onPending');
            // mount pending branch in off-dom container
            suspense.pendingBranch = newBranch;
            suspense.pendingId++;
            patch(null, newBranch, suspense.hiddenContainer, null, parentComponent, suspense, isSVG, slotScopeIds, optimized);
            if (suspense.deps <= 0) {
                // incoming branch has no async deps, resolve now.
                suspense.resolve();
            }
            else {
                const { timeout, pendingId } = suspense;
                if (timeout > 0) {
                    setTimeout(() => {
                        if (suspense.pendingId === pendingId) {
                            suspense.fallback(newFallback);
                        }
                    }, timeout);
                }
                else if (timeout === 0) {
                    suspense.fallback(newFallback);
                }
            }
        }
    }
}
function createSuspenseBoundary(vnode, parent, parentComponent, container, hiddenContainer, anchor, isSVG, slotScopeIds, optimized, rendererInternals, isHydrating = false) {
    const { p: patch, m: move, um: unmount, n: next, o: { parentNode, remove } } = rendererInternals;
    const timeout = shared.toNumber(vnode.props && vnode.props.timeout);
    const suspense = {
        vnode,
        parent,
        parentComponent,
        isSVG,
        container,
        hiddenContainer,
        anchor,
        deps: 0,
        pendingId: 0,
        timeout: typeof timeout === 'number' ? timeout : -1,
        activeBranch: null,
        pendingBranch: null,
        isInFallback: true,
        isHydrating,
        isUnmounted: false,
        effects: [],
        resolve(resume = false) {
            const { vnode, activeBranch, pendingBranch, pendingId, effects, parentComponent, container } = suspense;
            if (suspense.isHydrating) {
                suspense.isHydrating = false;
            }
            else if (!resume) {
                const delayEnter = activeBranch &&
                    pendingBranch.transition &&
                    pendingBranch.transition.mode === 'out-in';
                if (delayEnter) {
                    activeBranch.transition.afterLeave = () => {
                        if (pendingId === suspense.pendingId) {
                            move(pendingBranch, container, anchor, 0 /* ENTER */);
                        }
                    };
                }
                // this is initial anchor on mount
                let { anchor } = suspense;
                // unmount current active tree
                if (activeBranch) {
                    // if the fallback tree was mounted, it may have been moved
                    // as part of a parent suspense. get the latest anchor for insertion
                    anchor = next(activeBranch);
                    unmount(activeBranch, parentComponent, suspense, true);
                }
                if (!delayEnter) {
                    // move content from off-dom container to actual container
                    move(pendingBranch, container, anchor, 0 /* ENTER */);
                }
            }
            setActiveBranch(suspense, pendingBranch);
            suspense.pendingBranch = null;
            suspense.isInFallback = false;
            // flush buffered effects
            // check if there is a pending parent suspense
            let parent = suspense.parent;
            let hasUnresolvedAncestor = false;
            while (parent) {
                if (parent.pendingBranch) {
                    // found a pending parent suspense, merge buffered post jobs
                    // into that parent
                    parent.effects.push(...effects);
                    hasUnresolvedAncestor = true;
                    break;
                }
                parent = parent.parent;
            }
            // no pending parent suspense, flush all jobs
            if (!hasUnresolvedAncestor) {
                queuePostFlushCb(effects);
            }
            suspense.effects = [];
            // invoke @resolve event
            triggerEvent(vnode, 'onResolve');
        },
        fallback(fallbackVNode) {
            if (!suspense.pendingBranch) {
                return;
            }
            const { vnode, activeBranch, parentComponent, container, isSVG } = suspense;
            // invoke @fallback event
            triggerEvent(vnode, 'onFallback');
            const anchor = next(activeBranch);
            const mountFallback = () => {
                if (!suspense.isInFallback) {
                    return;
                }
                // mount the fallback tree
                patch(null, fallbackVNode, container, anchor, parentComponent, null, // fallback tree will not have suspense context
                isSVG, slotScopeIds, optimized);
                setActiveBranch(suspense, fallbackVNode);
            };
            const delayEnter = fallbackVNode.transition && fallbackVNode.transition.mode === 'out-in';
            if (delayEnter) {
                activeBranch.transition.afterLeave = mountFallback;
            }
            suspense.isInFallback = true;
            // unmount current active branch
            unmount(activeBranch, parentComponent, null, // no suspense so unmount hooks fire now
            true // shouldRemove
            );
            if (!delayEnter) {
                mountFallback();
            }
        },
        move(container, anchor, type) {
            suspense.activeBranch &&
                move(suspense.activeBranch, container, anchor, type);
            suspense.container = container;
        },
        next() {
            return suspense.activeBranch && next(suspense.activeBranch);
        },
        registerDep(instance, setupRenderEffect) {
            const isInPendingSuspense = !!suspense.pendingBranch;
            if (isInPendingSuspense) {
                suspense.deps++;
            }
            const hydratedEl = instance.vnode.el;
            instance
                .asyncDep.catch(err => {
                handleError(err, instance, 0 /* SETUP_FUNCTION */);
            })
                .then(asyncSetupResult => {
                // retry when the setup() promise resolves.
                // component may have been unmounted before resolve.
                if (instance.isUnmounted ||
                    suspense.isUnmounted ||
                    suspense.pendingId !== instance.suspenseId) {
                    return;
                }
                // retry from this component
                instance.asyncResolved = true;
                const { vnode } = instance;
                handleSetupResult(instance, asyncSetupResult, false);
                if (hydratedEl) {
                    // vnode may have been replaced if an update happened before the
                    // async dep is resolved.
                    vnode.el = hydratedEl;
                }
                const placeholder = !hydratedEl && instance.subTree.el;
                setupRenderEffect(instance, vnode, 
                // component may have been moved before resolve.
                // if this is not a hydration, instance.subTree will be the comment
                // placeholder.
                parentNode(hydratedEl || instance.subTree.el), 
                // anchor will not be used if this is hydration, so only need to
                // consider the comment placeholder case.
                hydratedEl ? null : next(instance.subTree), suspense, isSVG, optimized);
                if (placeholder) {
                    remove(placeholder);
                }
                updateHOCHostEl(instance, vnode.el);
                // only decrease deps count if suspense is not already resolved
                if (isInPendingSuspense && --suspense.deps === 0) {
                    suspense.resolve();
                }
            });
        },
        unmount(parentSuspense, doRemove) {
            suspense.isUnmounted = true;
            if (suspense.activeBranch) {
                unmount(suspense.activeBranch, parentComponent, parentSuspense, doRemove);
            }
            if (suspense.pendingBranch) {
                unmount(suspense.pendingBranch, parentComponent, parentSuspense, doRemove);
            }
        }
    };
    return suspense;
}
function hydrateSuspense(node, vnode, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized, rendererInternals, hydrateNode) {
    /* eslint-disable no-restricted-globals */
    const suspense = (vnode.suspense = createSuspenseBoundary(vnode, parentSuspense, parentComponent, node.parentNode, document.createElement('div'), null, isSVG, slotScopeIds, optimized, rendererInternals, true /* hydrating */));
    // there are two possible scenarios for server-rendered suspense:
    // - success: ssr content should be fully resolved
    // - failure: ssr content should be the fallback branch.
    // however, on the client we don't really know if it has failed or not
    // attempt to hydrate the DOM assuming it has succeeded, but we still
    // need to construct a suspense boundary first
    const result = hydrateNode(node, (suspense.pendingBranch = vnode.ssContent), parentComponent, suspense, slotScopeIds, optimized);
    if (suspense.deps === 0) {
        suspense.resolve();
    }
    return result;
    /* eslint-enable no-restricted-globals */
}
function normalizeSuspenseChildren(vnode) {
    const { shapeFlag, children } = vnode;
    const isSlotChildren = shapeFlag & 32 /* SLOTS_CHILDREN */;
    vnode.ssContent = normalizeSuspenseSlot(isSlotChildren ? children.default : children);
    vnode.ssFallback = isSlotChildren
        ? normalizeSuspenseSlot(children.fallback)
        : createVNode(Comment);
}
function normalizeSuspenseSlot(s) {
    let block;
    if (shared.isFunction(s)) {
        const isCompiledSlot = s._c;
        if (isCompiledSlot) {
            // disableTracking: false
            // allow block tracking for compiled slots
            // (see ./componentRenderContext.ts)
            s._d = false;
            openBlock();
        }
        s = s();
        if (isCompiledSlot) {
            s._d = true;
            block = currentBlock;
            closeBlock();
        }
    }
    if (shared.isArray(s)) {
        const singleChild = filterSingleRoot(s);
        s = singleChild;
    }
    s = normalizeVNode(s);
    if (block && !s.dynamicChildren) {
        s.dynamicChildren = block.filter(c => c !== s);
    }
    return s;
}
function queueEffectWithSuspense(fn, suspense) {
    if (suspense && suspense.pendingBranch) {
        if (shared.isArray(fn)) {
            suspense.effects.push(...fn);
        }
        else {
            suspense.effects.push(fn);
        }
    }
    else {
        queuePostFlushCb(fn);
    }
}
function setActiveBranch(suspense, branch) {
    suspense.activeBranch = branch;
    const { vnode, parentComponent } = suspense;
    const el = (vnode.el = branch.el);
    // in case suspense is the root node of a component,
    // recursively update the HOC el
    if (parentComponent && parentComponent.subTree === vnode) {
        parentComponent.vnode.el = el;
        updateHOCHostEl(parentComponent, el);
    }
}

function provide(key, value) {
    if (!currentInstance) ;
    else {
        let provides = currentInstance.provides;
        // by default an instance inherits its parent's provides object
        // but when it needs to provide values of its own, it creates its
        // own provides object using parent provides object as prototype.
        // this way in `inject` we can simply look up injections from direct
        // parent and let the prototype chain do the work.
        const parentProvides = currentInstance.parent && currentInstance.parent.provides;
        if (parentProvides === provides) {
            provides = currentInstance.provides = Object.create(parentProvides);
        }
        // TS doesn't allow symbol as index type
        provides[key] = value;
    }
}
function inject(key, defaultValue, treatDefaultAsFactory = false) {
    // fallback to `currentRenderingInstance` so that this can be called in
    // a functional component
    const instance = currentInstance || currentRenderingInstance;
    if (instance) {
        // #2400
        // to support `app.use` plugins,
        // fallback to appContext's `provides` if the intance is at root
        const provides = instance.parent == null
            ? instance.vnode.appContext && instance.vnode.appContext.provides
            : instance.parent.provides;
        if (provides && key in provides) {
            // TS doesn't allow symbol as index type
            return provides[key];
        }
        else if (arguments.length > 1) {
            return treatDefaultAsFactory && shared.isFunction(defaultValue)
                ? defaultValue.call(instance.proxy)
                : defaultValue;
        }
        else ;
    }
}

function useTransitionState() {
    const state = {
        isMounted: false,
        isLeaving: false,
        isUnmounting: false,
        leavingVNodes: new Map()
    };
    onMounted(() => {
        state.isMounted = true;
    });
    onBeforeUnmount(() => {
        state.isUnmounting = true;
    });
    return state;
}
const TransitionHookValidator = [Function, Array];
const BaseTransitionImpl = {
    name: `BaseTransition`,
    props: {
        mode: String,
        appear: Boolean,
        persisted: Boolean,
        // enter
        onBeforeEnter: TransitionHookValidator,
        onEnter: TransitionHookValidator,
        onAfterEnter: TransitionHookValidator,
        onEnterCancelled: TransitionHookValidator,
        // leave
        onBeforeLeave: TransitionHookValidator,
        onLeave: TransitionHookValidator,
        onAfterLeave: TransitionHookValidator,
        onLeaveCancelled: TransitionHookValidator,
        // appear
        onBeforeAppear: TransitionHookValidator,
        onAppear: TransitionHookValidator,
        onAfterAppear: TransitionHookValidator,
        onAppearCancelled: TransitionHookValidator
    },
    setup(props, { slots }) {
        const instance = getCurrentInstance();
        const state = useTransitionState();
        let prevTransitionKey;
        return () => {
            const children = slots.default && getTransitionRawChildren(slots.default(), true);
            if (!children || !children.length) {
                return;
            }
            // there's no need to track reactivity for these props so use the raw
            // props for a bit better perf
            const rawProps = reactivity.toRaw(props);
            const { mode } = rawProps;
            // at this point children has a guaranteed length of 1.
            const child = children[0];
            if (state.isLeaving) {
                return emptyPlaceholder(child);
            }
            // in the case of <transition><keep-alive/></transition>, we need to
            // compare the type of the kept-alive children.
            const innerChild = getKeepAliveChild(child);
            if (!innerChild) {
                return emptyPlaceholder(child);
            }
            const enterHooks = resolveTransitionHooks(innerChild, rawProps, state, instance);
            setTransitionHooks(innerChild, enterHooks);
            const oldChild = instance.subTree;
            const oldInnerChild = oldChild && getKeepAliveChild(oldChild);
            let transitionKeyChanged = false;
            const { getTransitionKey } = innerChild.type;
            if (getTransitionKey) {
                const key = getTransitionKey();
                if (prevTransitionKey === undefined) {
                    prevTransitionKey = key;
                }
                else if (key !== prevTransitionKey) {
                    prevTransitionKey = key;
                    transitionKeyChanged = true;
                }
            }
            // handle mode
            if (oldInnerChild &&
                oldInnerChild.type !== Comment &&
                (!isSameVNodeType(innerChild, oldInnerChild) || transitionKeyChanged)) {
                const leavingHooks = resolveTransitionHooks(oldInnerChild, rawProps, state, instance);
                // update old tree's hooks in case of dynamic transition
                setTransitionHooks(oldInnerChild, leavingHooks);
                // switching between different views
                if (mode === 'out-in') {
                    state.isLeaving = true;
                    // return placeholder node and queue update when leave finishes
                    leavingHooks.afterLeave = () => {
                        state.isLeaving = false;
                        instance.update();
                    };
                    return emptyPlaceholder(child);
                }
                else if (mode === 'in-out' && innerChild.type !== Comment) {
                    leavingHooks.delayLeave = (el, earlyRemove, delayedLeave) => {
                        const leavingVNodesCache = getLeavingNodesForType(state, oldInnerChild);
                        leavingVNodesCache[String(oldInnerChild.key)] = oldInnerChild;
                        // early removal callback
                        el._leaveCb = () => {
                            earlyRemove();
                            el._leaveCb = undefined;
                            delete enterHooks.delayedLeave;
                        };
                        enterHooks.delayedLeave = delayedLeave;
                    };
                }
            }
            return child;
        };
    }
};
// export the public type for h/tsx inference
// also to avoid inline import() in generated d.ts files
const BaseTransition = BaseTransitionImpl;
function getLeavingNodesForType(state, vnode) {
    const { leavingVNodes } = state;
    let leavingVNodesCache = leavingVNodes.get(vnode.type);
    if (!leavingVNodesCache) {
        leavingVNodesCache = Object.create(null);
        leavingVNodes.set(vnode.type, leavingVNodesCache);
    }
    return leavingVNodesCache;
}
// The transition hooks are attached to the vnode as vnode.transition
// and will be called at appropriate timing in the renderer.
function resolveTransitionHooks(vnode, props, state, instance) {
    const { appear, mode, persisted = false, onBeforeEnter, onEnter, onAfterEnter, onEnterCancelled, onBeforeLeave, onLeave, onAfterLeave, onLeaveCancelled, onBeforeAppear, onAppear, onAfterAppear, onAppearCancelled } = props;
    const key = String(vnode.key);
    const leavingVNodesCache = getLeavingNodesForType(state, vnode);
    const callHook = (hook, args) => {
        hook &&
            callWithAsyncErrorHandling(hook, instance, 9 /* TRANSITION_HOOK */, args);
    };
    const hooks = {
        mode,
        persisted,
        beforeEnter(el) {
            let hook = onBeforeEnter;
            if (!state.isMounted) {
                if (appear) {
                    hook = onBeforeAppear || onBeforeEnter;
                }
                else {
                    return;
                }
            }
            // for same element (v-show)
            if (el._leaveCb) {
                el._leaveCb(true /* cancelled */);
            }
            // for toggled element with same key (v-if)
            const leavingVNode = leavingVNodesCache[key];
            if (leavingVNode &&
                isSameVNodeType(vnode, leavingVNode) &&
                leavingVNode.el._leaveCb) {
                // force early removal (not cancelled)
                leavingVNode.el._leaveCb();
            }
            callHook(hook, [el]);
        },
        enter(el) {
            let hook = onEnter;
            let afterHook = onAfterEnter;
            let cancelHook = onEnterCancelled;
            if (!state.isMounted) {
                if (appear) {
                    hook = onAppear || onEnter;
                    afterHook = onAfterAppear || onAfterEnter;
                    cancelHook = onAppearCancelled || onEnterCancelled;
                }
                else {
                    return;
                }
            }
            let called = false;
            const done = (el._enterCb = (cancelled) => {
                if (called)
                    return;
                called = true;
                if (cancelled) {
                    callHook(cancelHook, [el]);
                }
                else {
                    callHook(afterHook, [el]);
                }
                if (hooks.delayedLeave) {
                    hooks.delayedLeave();
                }
                el._enterCb = undefined;
            });
            if (hook) {
                hook(el, done);
                if (hook.length <= 1) {
                    done();
                }
            }
            else {
                done();
            }
        },
        leave(el, remove) {
            const key = String(vnode.key);
            if (el._enterCb) {
                el._enterCb(true /* cancelled */);
            }
            if (state.isUnmounting) {
                return remove();
            }
            callHook(onBeforeLeave, [el]);
            let called = false;
            const done = (el._leaveCb = (cancelled) => {
                if (called)
                    return;
                called = true;
                remove();
                if (cancelled) {
                    callHook(onLeaveCancelled, [el]);
                }
                else {
                    callHook(onAfterLeave, [el]);
                }
                el._leaveCb = undefined;
                if (leavingVNodesCache[key] === vnode) {
                    delete leavingVNodesCache[key];
                }
            });
            leavingVNodesCache[key] = vnode;
            if (onLeave) {
                onLeave(el, done);
                if (onLeave.length <= 1) {
                    done();
                }
            }
            else {
                done();
            }
        },
        clone(vnode) {
            return resolveTransitionHooks(vnode, props, state, instance);
        }
    };
    return hooks;
}
// the placeholder really only handles one special case: KeepAlive
// in the case of a KeepAlive in a leave phase we need to return a KeepAlive
// placeholder with empty content to avoid the KeepAlive instance from being
// unmounted.
function emptyPlaceholder(vnode) {
    if (isKeepAlive(vnode)) {
        vnode = cloneVNode(vnode);
        vnode.children = null;
        return vnode;
    }
}
function getKeepAliveChild(vnode) {
    return isKeepAlive(vnode)
        ? vnode.children
            ? vnode.children[0]
            : undefined
        : vnode;
}
function setTransitionHooks(vnode, hooks) {
    if (vnode.shapeFlag & 6 /* COMPONENT */ && vnode.component) {
        setTransitionHooks(vnode.component.subTree, hooks);
    }
    else if (vnode.shapeFlag & 128 /* SUSPENSE */) {
        vnode.ssContent.transition = hooks.clone(vnode.ssContent);
        vnode.ssFallback.transition = hooks.clone(vnode.ssFallback);
    }
    else {
        vnode.transition = hooks;
    }
}
function getTransitionRawChildren(children, keepComment = false) {
    let ret = [];
    let keyedFragmentCount = 0;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        // handle fragment children case, e.g. v-for
        if (child.type === Fragment) {
            if (child.patchFlag & 128 /* KEYED_FRAGMENT */)
                keyedFragmentCount++;
            ret = ret.concat(getTransitionRawChildren(child.children, keepComment));
        }
        // comment placeholders should be skipped, e.g. v-if
        else if (keepComment || child.type !== Comment) {
            ret.push(child);
        }
    }
    // #1126 if a transition children list contains multiple sub fragments, these
    // fragments will be merged into a flat children array. Since each v-for
    // fragment may contain different static bindings inside, we need to de-op
    // these children to force full diffs to ensure correct behavior.
    if (keyedFragmentCount > 1) {
        for (let i = 0; i < ret.length; i++) {
            ret[i].patchFlag = -2 /* BAIL */;
        }
    }
    return ret;
}

// implementation, close to no-op
function defineComponent(options) {
    return shared.isFunction(options) ? { setup: options, name: options.name } : options;
}

const isAsyncWrapper = (i) => !!i.type.__asyncLoader;
function defineAsyncComponent(source) {
    if (shared.isFunction(source)) {
        source = { loader: source };
    }
    const { loader, loadingComponent, errorComponent, delay = 200, timeout, // undefined = never times out
    suspensible = true, onError: userOnError } = source;
    let pendingRequest = null;
    let resolvedComp;
    let retries = 0;
    const retry = () => {
        retries++;
        pendingRequest = null;
        return load();
    };
    const load = () => {
        let thisRequest;
        return (pendingRequest ||
            (thisRequest = pendingRequest =
                loader()
                    .catch(err => {
                    err = err instanceof Error ? err : new Error(String(err));
                    if (userOnError) {
                        return new Promise((resolve, reject) => {
                            const userRetry = () => resolve(retry());
                            const userFail = () => reject(err);
                            userOnError(err, userRetry, userFail, retries + 1);
                        });
                    }
                    else {
                        throw err;
                    }
                })
                    .then((comp) => {
                    if (thisRequest !== pendingRequest && pendingRequest) {
                        return pendingRequest;
                    }
                    // interop module default
                    if (comp &&
                        (comp.__esModule || comp[Symbol.toStringTag] === 'Module')) {
                        comp = comp.default;
                    }
                    resolvedComp = comp;
                    return comp;
                })));
    };
    return defineComponent({
        name: 'AsyncComponentWrapper',
        __asyncLoader: load,
        get __asyncResolved() {
            return resolvedComp;
        },
        setup() {
            const instance = currentInstance;
            // already resolved
            if (resolvedComp) {
                return () => createInnerComp(resolvedComp, instance);
            }
            const onError = (err) => {
                pendingRequest = null;
                handleError(err, instance, 13 /* ASYNC_COMPONENT_LOADER */, !errorComponent /* do not throw in dev if user provided error component */);
            };
            // suspense-controlled or SSR.
            if ((suspensible && instance.suspense) ||
                (isInSSRComponentSetup)) {
                return load()
                    .then(comp => {
                    return () => createInnerComp(comp, instance);
                })
                    .catch(err => {
                    onError(err);
                    return () => errorComponent
                        ? createVNode(errorComponent, {
                            error: err
                        })
                        : null;
                });
            }
            const loaded = reactivity.ref(false);
            const error = reactivity.ref();
            const delayed = reactivity.ref(!!delay);
            if (delay) {
                setTimeout(() => {
                    delayed.value = false;
                }, delay);
            }
            if (timeout != null) {
                setTimeout(() => {
                    if (!loaded.value && !error.value) {
                        const err = new Error(`Async component timed out after ${timeout}ms.`);
                        onError(err);
                        error.value = err;
                    }
                }, timeout);
            }
            load()
                .then(() => {
                loaded.value = true;
                if (instance.parent && isKeepAlive(instance.parent.vnode)) {
                    // parent is keep-alive, force update so the loaded component's
                    // name is taken into account
                    queueJob(instance.parent.update);
                }
            })
                .catch(err => {
                onError(err);
                error.value = err;
            });
            return () => {
                if (loaded.value && resolvedComp) {
                    return createInnerComp(resolvedComp, instance);
                }
                else if (error.value && errorComponent) {
                    return createVNode(errorComponent, {
                        error: error.value
                    });
                }
                else if (loadingComponent && !delayed.value) {
                    return createVNode(loadingComponent);
                }
            };
        }
    });
}
function createInnerComp(comp, { vnode: { ref, props, children } }) {
    const vnode = createVNode(comp, props, children);
    // ensure inner component inherits the async wrapper's ref owner
    vnode.ref = ref;
    return vnode;
}

const isKeepAlive = (vnode) => vnode.type.__isKeepAlive;
const KeepAliveImpl = {
    name: `KeepAlive`,
    // Marker for special handling inside the renderer. We are not using a ===
    // check directly on KeepAlive in the renderer, because importing it directly
    // would prevent it from being tree-shaken.
    __isKeepAlive: true,
    props: {
        include: [String, RegExp, Array],
        exclude: [String, RegExp, Array],
        max: [String, Number]
    },
    setup(props, { slots }) {
        const instance = getCurrentInstance();
        // KeepAlive communicates with the instantiated renderer via the
        // ctx where the renderer passes in its internals,
        // and the KeepAlive instance exposes activate/deactivate implementations.
        // The whole point of this is to avoid importing KeepAlive directly in the
        // renderer to facilitate tree-shaking.
        const sharedContext = instance.ctx;
        // if the internal renderer is not registered, it indicates that this is server-side rendering,
        // for KeepAlive, we just need to render its children
        if (!sharedContext.renderer) {
            return slots.default;
        }
        const cache = new Map();
        const keys = new Set();
        let current = null;
        const parentSuspense = instance.suspense;
        const { renderer: { p: patch, m: move, um: _unmount, o: { createElement } } } = sharedContext;
        const storageContainer = createElement('div');
        sharedContext.activate = (vnode, container, anchor, isSVG, optimized) => {
            const instance = vnode.component;
            move(vnode, container, anchor, 0 /* ENTER */, parentSuspense);
            // in case props have changed
            patch(instance.vnode, vnode, container, anchor, instance, parentSuspense, isSVG, vnode.slotScopeIds, optimized);
            queuePostRenderEffect(() => {
                instance.isDeactivated = false;
                if (instance.a) {
                    shared.invokeArrayFns(instance.a);
                }
                const vnodeHook = vnode.props && vnode.props.onVnodeMounted;
                if (vnodeHook) {
                    invokeVNodeHook(vnodeHook, instance.parent, vnode);
                }
            }, parentSuspense);
        };
        sharedContext.deactivate = (vnode) => {
            const instance = vnode.component;
            move(vnode, storageContainer, null, 1 /* LEAVE */, parentSuspense);
            queuePostRenderEffect(() => {
                if (instance.da) {
                    shared.invokeArrayFns(instance.da);
                }
                const vnodeHook = vnode.props && vnode.props.onVnodeUnmounted;
                if (vnodeHook) {
                    invokeVNodeHook(vnodeHook, instance.parent, vnode);
                }
                instance.isDeactivated = true;
            }, parentSuspense);
        };
        function unmount(vnode) {
            // reset the shapeFlag so it can be properly unmounted
            resetShapeFlag(vnode);
            _unmount(vnode, instance, parentSuspense);
        }
        function pruneCache(filter) {
            cache.forEach((vnode, key) => {
                const name = getComponentName(vnode.type);
                if (name && (!filter || !filter(name))) {
                    pruneCacheEntry(key);
                }
            });
        }
        function pruneCacheEntry(key) {
            const cached = cache.get(key);
            if (!current || cached.type !== current.type) {
                unmount(cached);
            }
            else if (current) {
                // current active instance should no longer be kept-alive.
                // we can't unmount it now but it might be later, so reset its flag now.
                resetShapeFlag(current);
            }
            cache.delete(key);
            keys.delete(key);
        }
        // prune cache on include/exclude prop change
        watch(() => [props.include, props.exclude], ([include, exclude]) => {
            include && pruneCache(name => matches(include, name));
            exclude && pruneCache(name => !matches(exclude, name));
        }, 
        // prune post-render after `current` has been updated
        { flush: 'post', deep: true });
        // cache sub tree after render
        let pendingCacheKey = null;
        const cacheSubtree = () => {
            // fix #1621, the pendingCacheKey could be 0
            if (pendingCacheKey != null) {
                cache.set(pendingCacheKey, getInnerChild(instance.subTree));
            }
        };
        onMounted(cacheSubtree);
        onUpdated(cacheSubtree);
        onBeforeUnmount(() => {
            cache.forEach(cached => {
                const { subTree, suspense } = instance;
                const vnode = getInnerChild(subTree);
                if (cached.type === vnode.type) {
                    // current instance will be unmounted as part of keep-alive's unmount
                    resetShapeFlag(vnode);
                    // but invoke its deactivated hook here
                    const da = vnode.component.da;
                    da && queuePostRenderEffect(da, suspense);
                    return;
                }
                unmount(cached);
            });
        });
        return () => {
            pendingCacheKey = null;
            if (!slots.default) {
                return null;
            }
            const children = slots.default();
            const rawVNode = children[0];
            if (children.length > 1) {
                current = null;
                return children;
            }
            else if (!isVNode(rawVNode) ||
                (!(rawVNode.shapeFlag & 4 /* STATEFUL_COMPONENT */) &&
                    !(rawVNode.shapeFlag & 128 /* SUSPENSE */))) {
                current = null;
                return rawVNode;
            }
            let vnode = getInnerChild(rawVNode);
            const comp = vnode.type;
            // for async components, name check should be based in its loaded
            // inner component if available
            const name = getComponentName(isAsyncWrapper(vnode)
                ? vnode.type.__asyncResolved || {}
                : comp);
            const { include, exclude, max } = props;
            if ((include && (!name || !matches(include, name))) ||
                (exclude && name && matches(exclude, name))) {
                current = vnode;
                return rawVNode;
            }
            const key = vnode.key == null ? comp : vnode.key;
            const cachedVNode = cache.get(key);
            // clone vnode if it's reused because we are going to mutate it
            if (vnode.el) {
                vnode = cloneVNode(vnode);
                if (rawVNode.shapeFlag & 128 /* SUSPENSE */) {
                    rawVNode.ssContent = vnode;
                }
            }
            // #1513 it's possible for the returned vnode to be cloned due to attr
            // fallthrough or scopeId, so the vnode here may not be the final vnode
            // that is mounted. Instead of caching it directly, we store the pending
            // key and cache `instance.subTree` (the normalized vnode) in
            // beforeMount/beforeUpdate hooks.
            pendingCacheKey = key;
            if (cachedVNode) {
                // copy over mounted state
                vnode.el = cachedVNode.el;
                vnode.component = cachedVNode.component;
                if (vnode.transition) {
                    // recursively update transition hooks on subTree
                    setTransitionHooks(vnode, vnode.transition);
                }
                // avoid vnode being mounted as fresh
                vnode.shapeFlag |= 512 /* COMPONENT_KEPT_ALIVE */;
                // make this key the freshest
                keys.delete(key);
                keys.add(key);
            }
            else {
                keys.add(key);
                // prune oldest entry
                if (max && keys.size > parseInt(max, 10)) {
                    pruneCacheEntry(keys.values().next().value);
                }
            }
            // avoid vnode being unmounted
            vnode.shapeFlag |= 256 /* COMPONENT_SHOULD_KEEP_ALIVE */;
            current = vnode;
            return rawVNode;
        };
    }
};
// export the public type for h/tsx inference
// also to avoid inline import() in generated d.ts files
const KeepAlive = KeepAliveImpl;
function matches(pattern, name) {
    if (shared.isArray(pattern)) {
        return pattern.some((p) => matches(p, name));
    }
    else if (shared.isString(pattern)) {
        return pattern.split(',').indexOf(name) > -1;
    }
    else if (pattern.test) {
        return pattern.test(name);
    }
    /* istanbul ignore next */
    return false;
}
function onActivated(hook, target) {
    registerKeepAliveHook(hook, "a" /* ACTIVATED */, target);
}
function onDeactivated(hook, target) {
    registerKeepAliveHook(hook, "da" /* DEACTIVATED */, target);
}
function registerKeepAliveHook(hook, type, target = currentInstance) {
    // cache the deactivate branch check wrapper for injected hooks so the same
    // hook can be properly deduped by the scheduler. "__wdc" stands for "with
    // deactivation check".
    const wrappedHook = hook.__wdc ||
        (hook.__wdc = () => {
            // only fire the hook if the target instance is NOT in a deactivated branch.
            let current = target;
            while (current) {
                if (current.isDeactivated) {
                    return;
                }
                current = current.parent;
            }
            hook();
        });
    injectHook(type, wrappedHook, target);
    // In addition to registering it on the target instance, we walk up the parent
    // chain and register it on all ancestor instances that are keep-alive roots.
    // This avoids the need to walk the entire component tree when invoking these
    // hooks, and more importantly, avoids the need to track child components in
    // arrays.
    if (target) {
        let current = target.parent;
        while (current && current.parent) {
            if (isKeepAlive(current.parent.vnode)) {
                injectToKeepAliveRoot(wrappedHook, type, target, current);
            }
            current = current.parent;
        }
    }
}
function injectToKeepAliveRoot(hook, type, target, keepAliveRoot) {
    // injectHook wraps the original for error handling, so make sure to remove
    // the wrapped version.
    const injected = injectHook(type, hook, keepAliveRoot, true /* prepend */);
    onUnmounted(() => {
        shared.remove(keepAliveRoot[type], injected);
    }, target);
}
function resetShapeFlag(vnode) {
    let shapeFlag = vnode.shapeFlag;
    if (shapeFlag & 256 /* COMPONENT_SHOULD_KEEP_ALIVE */) {
        shapeFlag -= 256 /* COMPONENT_SHOULD_KEEP_ALIVE */;
    }
    if (shapeFlag & 512 /* COMPONENT_KEPT_ALIVE */) {
        shapeFlag -= 512 /* COMPONENT_KEPT_ALIVE */;
    }
    vnode.shapeFlag = shapeFlag;
}
function getInnerChild(vnode) {
    return vnode.shapeFlag & 128 /* SUSPENSE */ ? vnode.ssContent : vnode;
}

function injectHook(type, hook, target = currentInstance, prepend = false) {
    if (target) {
        const hooks = target[type] || (target[type] = []);
        // cache the error handling wrapper for injected hooks so the same hook
        // can be properly deduped by the scheduler. "__weh" stands for "with error
        // handling".
        const wrappedHook = hook.__weh ||
            (hook.__weh = (...args) => {
                if (target.isUnmounted) {
                    return;
                }
                // disable tracking inside all lifecycle hooks
                // since they can potentially be called inside effects.
                reactivity.pauseTracking();
                // Set currentInstance during hook invocation.
                // This assumes the hook does not synchronously trigger other hooks, which
                // can only be false when the user does something really funky.
                setCurrentInstance(target);
                const res = callWithAsyncErrorHandling(hook, target, type, args);
                unsetCurrentInstance();
                reactivity.resetTracking();
                return res;
            });
        if (prepend) {
            hooks.unshift(wrappedHook);
        }
        else {
            hooks.push(wrappedHook);
        }
        return wrappedHook;
    }
}
const createHook = (lifecycle) => (hook, target = currentInstance) => 
// post-create lifecycle registrations are noops during SSR (except for serverPrefetch)
(!isInSSRComponentSetup || lifecycle === "sp" /* SERVER_PREFETCH */) &&
    injectHook(lifecycle, hook, target);
const onBeforeMount = createHook("bm" /* BEFORE_MOUNT */);
const onMounted = createHook("m" /* MOUNTED */);
const onBeforeUpdate = createHook("bu" /* BEFORE_UPDATE */);
const onUpdated = createHook("u" /* UPDATED */);
const onBeforeUnmount = createHook("bum" /* BEFORE_UNMOUNT */);
const onUnmounted = createHook("um" /* UNMOUNTED */);
const onServerPrefetch = createHook("sp" /* SERVER_PREFETCH */);
const onRenderTriggered = createHook("rtg" /* RENDER_TRIGGERED */);
const onRenderTracked = createHook("rtc" /* RENDER_TRACKED */);
function onErrorCaptured(hook, target = currentInstance) {
    injectHook("ec" /* ERROR_CAPTURED */, hook, target);
}

let shouldCacheAccess = true;
function applyOptions(instance) {
    const options = resolveMergedOptions(instance);
    const publicThis = instance.proxy;
    const ctx = instance.ctx;
    // do not cache property access on public proxy during state initialization
    shouldCacheAccess = false;
    // call beforeCreate first before accessing other options since
    // the hook may mutate resolved options (#2791)
    if (options.beforeCreate) {
        callHook(options.beforeCreate, instance, "bc" /* BEFORE_CREATE */);
    }
    const { 
    // state
    data: dataOptions, computed: computedOptions, methods, watch: watchOptions, provide: provideOptions, inject: injectOptions, 
    // lifecycle
    created, beforeMount, mounted, beforeUpdate, updated, activated, deactivated, beforeDestroy, beforeUnmount, destroyed, unmounted, render, renderTracked, renderTriggered, errorCaptured, serverPrefetch, 
    // public API
    expose, inheritAttrs, 
    // assets
    components, directives, filters } = options;
    const checkDuplicateProperties = null;
    // options initialization order (to be consistent with Vue 2):
    // - props (already done outside of this function)
    // - inject
    // - methods
    // - data (deferred since it relies on `this` access)
    // - computed
    // - watch (deferred since it relies on `this` access)
    if (injectOptions) {
        resolveInjections(injectOptions, ctx, checkDuplicateProperties, instance.appContext.config.unwrapInjectedRef);
    }
    if (methods) {
        for (const key in methods) {
            const methodHandler = methods[key];
            if (shared.isFunction(methodHandler)) {
                // In dev mode, we use the `createRenderContext` function to define
                // methods to the proxy target, and those are read-only but
                // reconfigurable, so it needs to be redefined here
                {
                    ctx[key] = methodHandler.bind(publicThis);
                }
            }
        }
    }
    if (dataOptions) {
        const data = dataOptions.call(publicThis, publicThis);
        if (!shared.isObject(data)) ;
        else {
            instance.data = reactivity.reactive(data);
        }
    }
    // state initialization complete at this point - start caching access
    shouldCacheAccess = true;
    if (computedOptions) {
        for (const key in computedOptions) {
            const opt = computedOptions[key];
            const get = shared.isFunction(opt)
                ? opt.bind(publicThis, publicThis)
                : shared.isFunction(opt.get)
                    ? opt.get.bind(publicThis, publicThis)
                    : shared.NOOP;
            const set = !shared.isFunction(opt) && shared.isFunction(opt.set)
                ? opt.set.bind(publicThis)
                : shared.NOOP;
            const c = reactivity.computed({
                get,
                set
            });
            Object.defineProperty(ctx, key, {
                enumerable: true,
                configurable: true,
                get: () => c.value,
                set: v => (c.value = v)
            });
        }
    }
    if (watchOptions) {
        for (const key in watchOptions) {
            createWatcher(watchOptions[key], ctx, publicThis, key);
        }
    }
    if (provideOptions) {
        const provides = shared.isFunction(provideOptions)
            ? provideOptions.call(publicThis)
            : provideOptions;
        Reflect.ownKeys(provides).forEach(key => {
            provide(key, provides[key]);
        });
    }
    if (created) {
        callHook(created, instance, "c" /* CREATED */);
    }
    function registerLifecycleHook(register, hook) {
        if (shared.isArray(hook)) {
            hook.forEach(_hook => register(_hook.bind(publicThis)));
        }
        else if (hook) {
            register(hook.bind(publicThis));
        }
    }
    registerLifecycleHook(onBeforeMount, beforeMount);
    registerLifecycleHook(onMounted, mounted);
    registerLifecycleHook(onBeforeUpdate, beforeUpdate);
    registerLifecycleHook(onUpdated, updated);
    registerLifecycleHook(onActivated, activated);
    registerLifecycleHook(onDeactivated, deactivated);
    registerLifecycleHook(onErrorCaptured, errorCaptured);
    registerLifecycleHook(onRenderTracked, renderTracked);
    registerLifecycleHook(onRenderTriggered, renderTriggered);
    registerLifecycleHook(onBeforeUnmount, beforeUnmount);
    registerLifecycleHook(onUnmounted, unmounted);
    registerLifecycleHook(onServerPrefetch, serverPrefetch);
    if (shared.isArray(expose)) {
        if (expose.length) {
            const exposed = instance.exposed || (instance.exposed = {});
            expose.forEach(key => {
                Object.defineProperty(exposed, key, {
                    get: () => publicThis[key],
                    set: val => (publicThis[key] = val)
                });
            });
        }
        else if (!instance.exposed) {
            instance.exposed = {};
        }
    }
    // options that are handled when creating the instance but also need to be
    // applied from mixins
    if (render && instance.render === shared.NOOP) {
        instance.render = render;
    }
    if (inheritAttrs != null) {
        instance.inheritAttrs = inheritAttrs;
    }
    // asset options.
    if (components)
        instance.components = components;
    if (directives)
        instance.directives = directives;
}
function resolveInjections(injectOptions, ctx, checkDuplicateProperties = shared.NOOP, unwrapRef = false) {
    if (shared.isArray(injectOptions)) {
        injectOptions = normalizeInject(injectOptions);
    }
    for (const key in injectOptions) {
        const opt = injectOptions[key];
        let injected;
        if (shared.isObject(opt)) {
            if ('default' in opt) {
                injected = inject(opt.from || key, opt.default, true /* treat default function as factory */);
            }
            else {
                injected = inject(opt.from || key);
            }
        }
        else {
            injected = inject(opt);
        }
        if (reactivity.isRef(injected)) {
            // TODO remove the check in 3.3
            if (unwrapRef) {
                Object.defineProperty(ctx, key, {
                    enumerable: true,
                    configurable: true,
                    get: () => injected.value,
                    set: v => (injected.value = v)
                });
            }
            else {
                ctx[key] = injected;
            }
        }
        else {
            ctx[key] = injected;
        }
    }
}
function callHook(hook, instance, type) {
    callWithAsyncErrorHandling(shared.isArray(hook)
        ? hook.map(h => h.bind(instance.proxy))
        : hook.bind(instance.proxy), instance, type);
}
function createWatcher(raw, ctx, publicThis, key) {
    const getter = key.includes('.')
        ? createPathGetter(publicThis, key)
        : () => publicThis[key];
    if (shared.isString(raw)) {
        const handler = ctx[raw];
        if (shared.isFunction(handler)) {
            watch(getter, handler);
        }
    }
    else if (shared.isFunction(raw)) {
        watch(getter, raw.bind(publicThis));
    }
    else if (shared.isObject(raw)) {
        if (shared.isArray(raw)) {
            raw.forEach(r => createWatcher(r, ctx, publicThis, key));
        }
        else {
            const handler = shared.isFunction(raw.handler)
                ? raw.handler.bind(publicThis)
                : ctx[raw.handler];
            if (shared.isFunction(handler)) {
                watch(getter, handler, raw);
            }
        }
    }
    else ;
}
/**
 * Resolve merged options and cache it on the component.
 * This is done only once per-component since the merging does not involve
 * instances.
 */
function resolveMergedOptions(instance) {
    const base = instance.type;
    const { mixins, extends: extendsOptions } = base;
    const { mixins: globalMixins, optionsCache: cache, config: { optionMergeStrategies } } = instance.appContext;
    const cached = cache.get(base);
    let resolved;
    if (cached) {
        resolved = cached;
    }
    else if (!globalMixins.length && !mixins && !extendsOptions) {
        {
            resolved = base;
        }
    }
    else {
        resolved = {};
        if (globalMixins.length) {
            globalMixins.forEach(m => mergeOptions(resolved, m, optionMergeStrategies, true));
        }
        mergeOptions(resolved, base, optionMergeStrategies);
    }
    cache.set(base, resolved);
    return resolved;
}
function mergeOptions(to, from, strats, asMixin = false) {
    const { mixins, extends: extendsOptions } = from;
    if (extendsOptions) {
        mergeOptions(to, extendsOptions, strats, true);
    }
    if (mixins) {
        mixins.forEach((m) => mergeOptions(to, m, strats, true));
    }
    for (const key in from) {
        if (asMixin && key === 'expose') ;
        else {
            const strat = internalOptionMergeStrats[key] || (strats && strats[key]);
            to[key] = strat ? strat(to[key], from[key]) : from[key];
        }
    }
    return to;
}
const internalOptionMergeStrats = {
    data: mergeDataFn,
    props: mergeObjectOptions,
    emits: mergeObjectOptions,
    // objects
    methods: mergeObjectOptions,
    computed: mergeObjectOptions,
    // lifecycle
    beforeCreate: mergeAsArray,
    created: mergeAsArray,
    beforeMount: mergeAsArray,
    mounted: mergeAsArray,
    beforeUpdate: mergeAsArray,
    updated: mergeAsArray,
    beforeDestroy: mergeAsArray,
    beforeUnmount: mergeAsArray,
    destroyed: mergeAsArray,
    unmounted: mergeAsArray,
    activated: mergeAsArray,
    deactivated: mergeAsArray,
    errorCaptured: mergeAsArray,
    serverPrefetch: mergeAsArray,
    // assets
    components: mergeObjectOptions,
    directives: mergeObjectOptions,
    // watch
    watch: mergeWatchOptions,
    // provide / inject
    provide: mergeDataFn,
    inject: mergeInject
};
function mergeDataFn(to, from) {
    if (!from) {
        return to;
    }
    if (!to) {
        return from;
    }
    return function mergedDataFn() {
        return (shared.extend)(shared.isFunction(to) ? to.call(this, this) : to, shared.isFunction(from) ? from.call(this, this) : from);
    };
}
function mergeInject(to, from) {
    return mergeObjectOptions(normalizeInject(to), normalizeInject(from));
}
function normalizeInject(raw) {
    if (shared.isArray(raw)) {
        const res = {};
        for (let i = 0; i < raw.length; i++) {
            res[raw[i]] = raw[i];
        }
        return res;
    }
    return raw;
}
function mergeAsArray(to, from) {
    return to ? [...new Set([].concat(to, from))] : from;
}
function mergeObjectOptions(to, from) {
    return to ? shared.extend(shared.extend(Object.create(null), to), from) : from;
}
function mergeWatchOptions(to, from) {
    if (!to)
        return from;
    if (!from)
        return to;
    const merged = shared.extend(Object.create(null), to);
    for (const key in from) {
        merged[key] = mergeAsArray(to[key], from[key]);
    }
    return merged;
}

function initProps(instance, rawProps, isStateful, // result of bitwise flag comparison
isSSR = false) {
    const props = {};
    const attrs = {};
    shared.def(attrs, InternalObjectKey, 1);
    instance.propsDefaults = Object.create(null);
    setFullProps(instance, rawProps, props, attrs);
    // ensure all declared prop keys are present
    for (const key in instance.propsOptions[0]) {
        if (!(key in props)) {
            props[key] = undefined;
        }
    }
    if (isStateful) {
        // stateful
        instance.props = isSSR ? props : reactivity.shallowReactive(props);
    }
    else {
        if (!instance.type.props) {
            // functional w/ optional props, props === attrs
            instance.props = attrs;
        }
        else {
            // functional w/ declared props
            instance.props = props;
        }
    }
    instance.attrs = attrs;
}
function updateProps(instance, rawProps, rawPrevProps, optimized) {
    const { props, attrs, vnode: { patchFlag } } = instance;
    const rawCurrentProps = reactivity.toRaw(props);
    const [options] = instance.propsOptions;
    let hasAttrsChanged = false;
    if (
    // always force full diff in dev
    // - #1942 if hmr is enabled with sfc component
    // - vite#872 non-sfc component used by sfc component
    (optimized || patchFlag > 0) &&
        !(patchFlag & 16 /* FULL_PROPS */)) {
        if (patchFlag & 8 /* PROPS */) {
            // Compiler-generated props & no keys change, just set the updated
            // the props.
            const propsToUpdate = instance.vnode.dynamicProps;
            for (let i = 0; i < propsToUpdate.length; i++) {
                let key = propsToUpdate[i];
                // PROPS flag guarantees rawProps to be non-null
                const value = rawProps[key];
                if (options) {
                    // attr / props separation was done on init and will be consistent
                    // in this code path, so just check if attrs have it.
                    if (shared.hasOwn(attrs, key)) {
                        if (value !== attrs[key]) {
                            attrs[key] = value;
                            hasAttrsChanged = true;
                        }
                    }
                    else {
                        const camelizedKey = shared.camelize(key);
                        props[camelizedKey] = resolvePropValue(options, rawCurrentProps, camelizedKey, value, instance, false /* isAbsent */);
                    }
                }
                else {
                    if (value !== attrs[key]) {
                        attrs[key] = value;
                        hasAttrsChanged = true;
                    }
                }
            }
        }
    }
    else {
        // full props update.
        if (setFullProps(instance, rawProps, props, attrs)) {
            hasAttrsChanged = true;
        }
        // in case of dynamic props, check if we need to delete keys from
        // the props object
        let kebabKey;
        for (const key in rawCurrentProps) {
            if (!rawProps ||
                // for camelCase
                (!shared.hasOwn(rawProps, key) &&
                    // it's possible the original props was passed in as kebab-case
                    // and converted to camelCase (#955)
                    ((kebabKey = shared.hyphenate(key)) === key || !shared.hasOwn(rawProps, kebabKey)))) {
                if (options) {
                    if (rawPrevProps &&
                        // for camelCase
                        (rawPrevProps[key] !== undefined ||
                            // for kebab-case
                            rawPrevProps[kebabKey] !== undefined)) {
                        props[key] = resolvePropValue(options, rawCurrentProps, key, undefined, instance, true /* isAbsent */);
                    }
                }
                else {
                    delete props[key];
                }
            }
        }
        // in the case of functional component w/o props declaration, props and
        // attrs point to the same object so it should already have been updated.
        if (attrs !== rawCurrentProps) {
            for (const key in attrs) {
                if (!rawProps || !shared.hasOwn(rawProps, key)) {
                    delete attrs[key];
                    hasAttrsChanged = true;
                }
            }
        }
    }
    // trigger updates for $attrs in case it's used in component slots
    if (hasAttrsChanged) {
        reactivity.trigger(instance, "set" /* SET */, '$attrs');
    }
}
function setFullProps(instance, rawProps, props, attrs) {
    const [options, needCastKeys] = instance.propsOptions;
    let hasAttrsChanged = false;
    let rawCastValues;
    if (rawProps) {
        for (let key in rawProps) {
            // key, ref are reserved and never passed down
            if (shared.isReservedProp(key)) {
                continue;
            }
            const value = rawProps[key];
            // prop option names are camelized during normalization, so to support
            // kebab -> camel conversion here we need to camelize the key.
            let camelKey;
            if (options && shared.hasOwn(options, (camelKey = shared.camelize(key)))) {
                if (!needCastKeys || !needCastKeys.includes(camelKey)) {
                    props[camelKey] = value;
                }
                else {
                    (rawCastValues || (rawCastValues = {}))[camelKey] = value;
                }
            }
            else if (!isEmitListener(instance.emitsOptions, key)) {
                if (value !== attrs[key]) {
                    attrs[key] = value;
                    hasAttrsChanged = true;
                }
            }
        }
    }
    if (needCastKeys) {
        const rawCurrentProps = reactivity.toRaw(props);
        const castValues = rawCastValues || shared.EMPTY_OBJ;
        for (let i = 0; i < needCastKeys.length; i++) {
            const key = needCastKeys[i];
            props[key] = resolvePropValue(options, rawCurrentProps, key, castValues[key], instance, !shared.hasOwn(castValues, key));
        }
    }
    return hasAttrsChanged;
}
function resolvePropValue(options, props, key, value, instance, isAbsent) {
    const opt = options[key];
    if (opt != null) {
        const hasDefault = shared.hasOwn(opt, 'default');
        // default values
        if (hasDefault && value === undefined) {
            const defaultValue = opt.default;
            if (opt.type !== Function && shared.isFunction(defaultValue)) {
                const { propsDefaults } = instance;
                if (key in propsDefaults) {
                    value = propsDefaults[key];
                }
                else {
                    setCurrentInstance(instance);
                    value = propsDefaults[key] = defaultValue.call(null, props);
                    unsetCurrentInstance();
                }
            }
            else {
                value = defaultValue;
            }
        }
        // boolean casting
        if (opt[0 /* shouldCast */]) {
            if (isAbsent && !hasDefault) {
                value = false;
            }
            else if (opt[1 /* shouldCastTrue */] &&
                (value === '' || value === shared.hyphenate(key))) {
                value = true;
            }
        }
    }
    return value;
}
function normalizePropsOptions(comp, appContext, asMixin = false) {
    const cache = appContext.propsCache;
    const cached = cache.get(comp);
    if (cached) {
        return cached;
    }
    const raw = comp.props;
    const normalized = {};
    const needCastKeys = [];
    // apply mixin/extends props
    let hasExtends = false;
    if (!shared.isFunction(comp)) {
        const extendProps = (raw) => {
            hasExtends = true;
            const [props, keys] = normalizePropsOptions(raw, appContext, true);
            shared.extend(normalized, props);
            if (keys)
                needCastKeys.push(...keys);
        };
        if (!asMixin && appContext.mixins.length) {
            appContext.mixins.forEach(extendProps);
        }
        if (comp.extends) {
            extendProps(comp.extends);
        }
        if (comp.mixins) {
            comp.mixins.forEach(extendProps);
        }
    }
    if (!raw && !hasExtends) {
        cache.set(comp, shared.EMPTY_ARR);
        return shared.EMPTY_ARR;
    }
    if (shared.isArray(raw)) {
        for (let i = 0; i < raw.length; i++) {
            const normalizedKey = shared.camelize(raw[i]);
            if (validatePropName(normalizedKey)) {
                normalized[normalizedKey] = shared.EMPTY_OBJ;
            }
        }
    }
    else if (raw) {
        for (const key in raw) {
            const normalizedKey = shared.camelize(key);
            if (validatePropName(normalizedKey)) {
                const opt = raw[key];
                const prop = (normalized[normalizedKey] =
                    shared.isArray(opt) || shared.isFunction(opt) ? { type: opt } : opt);
                if (prop) {
                    const booleanIndex = getTypeIndex(Boolean, prop.type);
                    const stringIndex = getTypeIndex(String, prop.type);
                    prop[0 /* shouldCast */] = booleanIndex > -1;
                    prop[1 /* shouldCastTrue */] =
                        stringIndex < 0 || booleanIndex < stringIndex;
                    // if the prop needs boolean casting or default value
                    if (booleanIndex > -1 || shared.hasOwn(prop, 'default')) {
                        needCastKeys.push(normalizedKey);
                    }
                }
            }
        }
    }
    const res = [normalized, needCastKeys];
    cache.set(comp, res);
    return res;
}
function validatePropName(key) {
    if (key[0] !== '$') {
        return true;
    }
    return false;
}
// use function string name to check type constructors
// so that it works across vms / iframes.
function getType(ctor) {
    const match = ctor && ctor.toString().match(/^\s*function (\w+)/);
    return match ? match[1] : ctor === null ? 'null' : '';
}
function isSameType(a, b) {
    return getType(a) === getType(b);
}
function getTypeIndex(type, expectedTypes) {
    if (shared.isArray(expectedTypes)) {
        return expectedTypes.findIndex(t => isSameType(t, type));
    }
    else if (shared.isFunction(expectedTypes)) {
        return isSameType(expectedTypes, type) ? 0 : -1;
    }
    return -1;
}

const isInternalKey = (key) => key[0] === '_' || key === '$stable';
const normalizeSlotValue = (value) => shared.isArray(value)
    ? value.map(normalizeVNode)
    : [normalizeVNode(value)];
const normalizeSlot = (key, rawSlot, ctx) => {
    const normalized = withCtx((...args) => {
        return normalizeSlotValue(rawSlot(...args));
    }, ctx);
    normalized._c = false;
    return normalized;
};
const normalizeObjectSlots = (rawSlots, slots, instance) => {
    const ctx = rawSlots._ctx;
    for (const key in rawSlots) {
        if (isInternalKey(key))
            continue;
        const value = rawSlots[key];
        if (shared.isFunction(value)) {
            slots[key] = normalizeSlot(key, value, ctx);
        }
        else if (value != null) {
            const normalized = normalizeSlotValue(value);
            slots[key] = () => normalized;
        }
    }
};
const normalizeVNodeSlots = (instance, children) => {
    const normalized = normalizeSlotValue(children);
    instance.slots.default = () => normalized;
};
const initSlots = (instance, children) => {
    if (instance.vnode.shapeFlag & 32 /* SLOTS_CHILDREN */) {
        const type = children._;
        if (type) {
            // users can get the shallow readonly version of the slots object through `this.$slots`,
            // we should avoid the proxy object polluting the slots of the internal instance
            instance.slots = reactivity.toRaw(children);
            // make compiler marker non-enumerable
            shared.def(children, '_', type);
        }
        else {
            normalizeObjectSlots(children, (instance.slots = {}));
        }
    }
    else {
        instance.slots = {};
        if (children) {
            normalizeVNodeSlots(instance, children);
        }
    }
    shared.def(instance.slots, InternalObjectKey, 1);
};
const updateSlots = (instance, children, optimized) => {
    const { vnode, slots } = instance;
    let needDeletionCheck = true;
    let deletionComparisonTarget = shared.EMPTY_OBJ;
    if (vnode.shapeFlag & 32 /* SLOTS_CHILDREN */) {
        const type = children._;
        if (type) {
            // compiled slots.
            if (optimized && type === 1 /* STABLE */) {
                // compiled AND stable.
                // no need to update, and skip stale slots removal.
                needDeletionCheck = false;
            }
            else {
                // compiled but dynamic (v-if/v-for on slots) - update slots, but skip
                // normalization.
                shared.extend(slots, children);
                // #2893
                // when rendering the optimized slots by manually written render function,
                // we need to delete the `slots._` flag if necessary to make subsequent updates reliable,
                // i.e. let the `renderSlot` create the bailed Fragment
                if (!optimized && type === 1 /* STABLE */) {
                    delete slots._;
                }
            }
        }
        else {
            needDeletionCheck = !children.$stable;
            normalizeObjectSlots(children, slots);
        }
        deletionComparisonTarget = children;
    }
    else if (children) {
        // non slot object children (direct value) passed to a component
        normalizeVNodeSlots(instance, children);
        deletionComparisonTarget = { default: 1 };
    }
    // delete stale slots
    if (needDeletionCheck) {
        for (const key in slots) {
            if (!isInternalKey(key) && !(key in deletionComparisonTarget)) {
                delete slots[key];
            }
        }
    }
};

/**
Runtime helper for applying directives to a vnode. Example usage:

const comp = resolveComponent('comp')
const foo = resolveDirective('foo')
const bar = resolveDirective('bar')

return withDirectives(h(comp), [
  [foo, this.x],
  [bar, this.y]
])
*/
/**
 * Adds directives to a VNode.
 */
function withDirectives(vnode, directives) {
    const internalInstance = currentRenderingInstance;
    if (internalInstance === null) {
        return vnode;
    }
    const instance = internalInstance.proxy;
    const bindings = vnode.dirs || (vnode.dirs = []);
    for (let i = 0; i < directives.length; i++) {
        let [dir, value, arg, modifiers = shared.EMPTY_OBJ] = directives[i];
        if (shared.isFunction(dir)) {
            dir = {
                mounted: dir,
                updated: dir
            };
        }
        if (dir.deep) {
            traverse(value);
        }
        bindings.push({
            dir,
            instance,
            value,
            oldValue: void 0,
            arg,
            modifiers
        });
    }
    return vnode;
}
function invokeDirectiveHook(vnode, prevVNode, instance, name) {
    const bindings = vnode.dirs;
    const oldBindings = prevVNode && prevVNode.dirs;
    for (let i = 0; i < bindings.length; i++) {
        const binding = bindings[i];
        if (oldBindings) {
            binding.oldValue = oldBindings[i].value;
        }
        let hook = binding.dir[name];
        if (hook) {
            // disable tracking inside all lifecycle hooks
            // since they can potentially be called inside effects.
            reactivity.pauseTracking();
            callWithAsyncErrorHandling(hook, instance, 8 /* DIRECTIVE_HOOK */, [
                vnode.el,
                binding,
                vnode,
                prevVNode
            ]);
            reactivity.resetTracking();
        }
    }
}

function createAppContext() {
    return {
        app: null,
        config: {
            isNativeTag: shared.NO,
            performance: false,
            globalProperties: {},
            optionMergeStrategies: {},
            errorHandler: undefined,
            warnHandler: undefined,
            compilerOptions: {}
        },
        mixins: [],
        components: {},
        directives: {},
        provides: Object.create(null),
        optionsCache: new WeakMap(),
        propsCache: new WeakMap(),
        emitsCache: new WeakMap()
    };
}
let uid = 0;
function createAppAPI(render, hydrate) {
    return function createApp(rootComponent, rootProps = null) {
        if (rootProps != null && !shared.isObject(rootProps)) {
            rootProps = null;
        }
        const context = createAppContext();
        const installedPlugins = new Set();
        let isMounted = false;
        const app = (context.app = {
            _uid: uid++,
            _component: rootComponent,
            _props: rootProps,
            _container: null,
            _context: context,
            _instance: null,
            version,
            get config() {
                return context.config;
            },
            set config(v) {
            },
            use(plugin, ...options) {
                if (installedPlugins.has(plugin)) ;
                else if (plugin && shared.isFunction(plugin.install)) {
                    installedPlugins.add(plugin);
                    plugin.install(app, ...options);
                }
                else if (shared.isFunction(plugin)) {
                    installedPlugins.add(plugin);
                    plugin(app, ...options);
                }
                else ;
                return app;
            },
            mixin(mixin) {
                {
                    if (!context.mixins.includes(mixin)) {
                        context.mixins.push(mixin);
                    }
                }
                return app;
            },
            component(name, component) {
                if (!component) {
                    return context.components[name];
                }
                context.components[name] = component;
                return app;
            },
            directive(name, directive) {
                if (!directive) {
                    return context.directives[name];
                }
                context.directives[name] = directive;
                return app;
            },
            mount(rootContainer, isHydrate, isSVG) {
                if (!isMounted) {
                    const vnode = createVNode(rootComponent, rootProps);
                    // store app context on the root VNode.
                    // this will be set on the root instance on initial mount.
                    vnode.appContext = context;
                    if (isHydrate && hydrate) {
                        hydrate(vnode, rootContainer);
                    }
                    else {
                        render(vnode, rootContainer, isSVG);
                    }
                    isMounted = true;
                    app._container = rootContainer;
                    rootContainer.__vue_app__ = app;
                    return vnode.component.proxy;
                }
            },
            unmount() {
                if (isMounted) {
                    render(null, app._container);
                    delete app._container.__vue_app__;
                }
            },
            provide(key, value) {
                // TypeScript doesn't allow symbols as index type
                // https://github.com/Microsoft/TypeScript/issues/24587
                context.provides[key] = value;
                return app;
            }
        });
        return app;
    };
}

let hasMismatch = false;
const isSVGContainer = (container) => /svg/.test(container.namespaceURI) && container.tagName !== 'foreignObject';
const isComment = (node) => node.nodeType === 8 /* COMMENT */;
// Note: hydration is DOM-specific
// But we have to place it in core due to tight coupling with core - splitting
// it out creates a ton of unnecessary complexity.
// Hydration also depends on some renderer internal logic which needs to be
// passed in via arguments.
function createHydrationFunctions(rendererInternals) {
    const { mt: mountComponent, p: patch, o: { patchProp, nextSibling, parentNode, remove, insert, createComment } } = rendererInternals;
    const hydrate = (vnode, container) => {
        if (!container.hasChildNodes()) {
            patch(null, vnode, container);
            flushPostFlushCbs();
            return;
        }
        hasMismatch = false;
        hydrateNode(container.firstChild, vnode, null, null, null);
        flushPostFlushCbs();
        if (hasMismatch && !false) {
            // this error should show up in production
            console.error(`Hydration completed but contains mismatches.`);
        }
    };
    const hydrateNode = (node, vnode, parentComponent, parentSuspense, slotScopeIds, optimized = false) => {
        const isFragmentStart = isComment(node) && node.data === '[';
        const onMismatch = () => handleMismatch(node, vnode, parentComponent, parentSuspense, slotScopeIds, isFragmentStart);
        const { type, ref, shapeFlag } = vnode;
        const domType = node.nodeType;
        vnode.el = node;
        let nextNode = null;
        switch (type) {
            case Text:
                if (domType !== 3 /* TEXT */) {
                    nextNode = onMismatch();
                }
                else {
                    if (node.data !== vnode.children) {
                        hasMismatch = true;
                        node.data = vnode.children;
                    }
                    nextNode = nextSibling(node);
                }
                break;
            case Comment:
                if (domType !== 8 /* COMMENT */ || isFragmentStart) {
                    nextNode = onMismatch();
                }
                else {
                    nextNode = nextSibling(node);
                }
                break;
            case Static:
                if (domType !== 1 /* ELEMENT */) {
                    nextNode = onMismatch();
                }
                else {
                    // determine anchor, adopt content
                    nextNode = node;
                    // if the static vnode has its content stripped during build,
                    // adopt it from the server-rendered HTML.
                    const needToAdoptContent = !vnode.children.length;
                    for (let i = 0; i < vnode.staticCount; i++) {
                        if (needToAdoptContent)
                            vnode.children += nextNode.outerHTML;
                        if (i === vnode.staticCount - 1) {
                            vnode.anchor = nextNode;
                        }
                        nextNode = nextSibling(nextNode);
                    }
                    return nextNode;
                }
                break;
            case Fragment:
                if (!isFragmentStart) {
                    nextNode = onMismatch();
                }
                else {
                    nextNode = hydrateFragment(node, vnode, parentComponent, parentSuspense, slotScopeIds, optimized);
                }
                break;
            default:
                if (shapeFlag & 1 /* ELEMENT */) {
                    if (domType !== 1 /* ELEMENT */ ||
                        vnode.type.toLowerCase() !==
                            node.tagName.toLowerCase()) {
                        nextNode = onMismatch();
                    }
                    else {
                        nextNode = hydrateElement(node, vnode, parentComponent, parentSuspense, slotScopeIds, optimized);
                    }
                }
                else if (shapeFlag & 6 /* COMPONENT */) {
                    // when setting up the render effect, if the initial vnode already
                    // has .el set, the component will perform hydration instead of mount
                    // on its sub-tree.
                    vnode.slotScopeIds = slotScopeIds;
                    const container = parentNode(node);
                    mountComponent(vnode, container, null, parentComponent, parentSuspense, isSVGContainer(container), optimized);
                    // component may be async, so in the case of fragments we cannot rely
                    // on component's rendered output to determine the end of the fragment
                    // instead, we do a lookahead to find the end anchor node.
                    nextNode = isFragmentStart
                        ? locateClosingAsyncAnchor(node)
                        : nextSibling(node);
                    // #3787
                    // if component is async, it may get moved / unmounted before its
                    // inner component is loaded, so we need to give it a placeholder
                    // vnode that matches its adopted DOM.
                    if (isAsyncWrapper(vnode)) {
                        let subTree;
                        if (isFragmentStart) {
                            subTree = createVNode(Fragment);
                            subTree.anchor = nextNode
                                ? nextNode.previousSibling
                                : container.lastChild;
                        }
                        else {
                            subTree =
                                node.nodeType === 3 ? createTextVNode('') : createVNode('div');
                        }
                        subTree.el = node;
                        vnode.component.subTree = subTree;
                    }
                }
                else if (shapeFlag & 64 /* TELEPORT */) {
                    if (domType !== 8 /* COMMENT */) {
                        nextNode = onMismatch();
                    }
                    else {
                        nextNode = vnode.type.hydrate(node, vnode, parentComponent, parentSuspense, slotScopeIds, optimized, rendererInternals, hydrateChildren);
                    }
                }
                else if (shapeFlag & 128 /* SUSPENSE */) {
                    nextNode = vnode.type.hydrate(node, vnode, parentComponent, parentSuspense, isSVGContainer(parentNode(node)), slotScopeIds, optimized, rendererInternals, hydrateNode);
                }
                else ;
        }
        if (ref != null) {
            setRef(ref, null, parentSuspense, vnode);
        }
        return nextNode;
    };
    const hydrateElement = (el, vnode, parentComponent, parentSuspense, slotScopeIds, optimized) => {
        optimized = optimized || !!vnode.dynamicChildren;
        const { type, props, patchFlag, shapeFlag, dirs } = vnode;
        // #4006 for form elements with non-string v-model value bindings
        // e.g. <option :value="obj">, <input type="checkbox" :true-value="1">
        const forcePatchValue = (type === 'input' && dirs) || type === 'option';
        // skip props & children if this is hoisted static nodes
        if (forcePatchValue || patchFlag !== -1 /* HOISTED */) {
            if (dirs) {
                invokeDirectiveHook(vnode, null, parentComponent, 'created');
            }
            // props
            if (props) {
                if (forcePatchValue ||
                    !optimized ||
                    patchFlag & (16 /* FULL_PROPS */ | 32 /* HYDRATE_EVENTS */)) {
                    for (const key in props) {
                        if ((forcePatchValue && key.endsWith('value')) ||
                            (shared.isOn(key) && !shared.isReservedProp(key))) {
                            patchProp(el, key, null, props[key]);
                        }
                    }
                }
                else if (props.onClick) {
                    // Fast path for click listeners (which is most often) to avoid
                    // iterating through props.
                    patchProp(el, 'onClick', null, props.onClick);
                }
            }
            // vnode / directive hooks
            let vnodeHooks;
            if ((vnodeHooks = props && props.onVnodeBeforeMount)) {
                invokeVNodeHook(vnodeHooks, parentComponent, vnode);
            }
            if (dirs) {
                invokeDirectiveHook(vnode, null, parentComponent, 'beforeMount');
            }
            if ((vnodeHooks = props && props.onVnodeMounted) || dirs) {
                queueEffectWithSuspense(() => {
                    vnodeHooks && invokeVNodeHook(vnodeHooks, parentComponent, vnode);
                    dirs && invokeDirectiveHook(vnode, null, parentComponent, 'mounted');
                }, parentSuspense);
            }
            // children
            if (shapeFlag & 16 /* ARRAY_CHILDREN */ &&
                // skip if element has innerHTML / textContent
                !(props && (props.innerHTML || props.textContent))) {
                let next = hydrateChildren(el.firstChild, vnode, el, parentComponent, parentSuspense, slotScopeIds, optimized);
                while (next) {
                    hasMismatch = true;
                    // The SSRed DOM contains more nodes than it should. Remove them.
                    const cur = next;
                    next = next.nextSibling;
                    remove(cur);
                }
            }
            else if (shapeFlag & 8 /* TEXT_CHILDREN */) {
                if (el.textContent !== vnode.children) {
                    hasMismatch = true;
                    el.textContent = vnode.children;
                }
            }
        }
        return el.nextSibling;
    };
    const hydrateChildren = (node, parentVNode, container, parentComponent, parentSuspense, slotScopeIds, optimized) => {
        optimized = optimized || !!parentVNode.dynamicChildren;
        const children = parentVNode.children;
        const l = children.length;
        for (let i = 0; i < l; i++) {
            const vnode = optimized
                ? children[i]
                : (children[i] = normalizeVNode(children[i]));
            if (node) {
                node = hydrateNode(node, vnode, parentComponent, parentSuspense, slotScopeIds, optimized);
            }
            else if (vnode.type === Text && !vnode.children) {
                continue;
            }
            else {
                hasMismatch = true;
                // the SSRed DOM didn't contain enough nodes. Mount the missing ones.
                patch(null, vnode, container, null, parentComponent, parentSuspense, isSVGContainer(container), slotScopeIds);
            }
        }
        return node;
    };
    const hydrateFragment = (node, vnode, parentComponent, parentSuspense, slotScopeIds, optimized) => {
        const { slotScopeIds: fragmentSlotScopeIds } = vnode;
        if (fragmentSlotScopeIds) {
            slotScopeIds = slotScopeIds
                ? slotScopeIds.concat(fragmentSlotScopeIds)
                : fragmentSlotScopeIds;
        }
        const container = parentNode(node);
        const next = hydrateChildren(nextSibling(node), vnode, container, parentComponent, parentSuspense, slotScopeIds, optimized);
        if (next && isComment(next) && next.data === ']') {
            return nextSibling((vnode.anchor = next));
        }
        else {
            // fragment didn't hydrate successfully, since we didn't get a end anchor
            // back. This should have led to node/children mismatch warnings.
            hasMismatch = true;
            // since the anchor is missing, we need to create one and insert it
            insert((vnode.anchor = createComment(`]`)), container, next);
            return next;
        }
    };
    const handleMismatch = (node, vnode, parentComponent, parentSuspense, slotScopeIds, isFragment) => {
        hasMismatch = true;
        vnode.el = null;
        if (isFragment) {
            // remove excessive fragment nodes
            const end = locateClosingAsyncAnchor(node);
            while (true) {
                const next = nextSibling(node);
                if (next && next !== end) {
                    remove(next);
                }
                else {
                    break;
                }
            }
        }
        const next = nextSibling(node);
        const container = parentNode(node);
        remove(node);
        patch(null, vnode, container, next, parentComponent, parentSuspense, isSVGContainer(container), slotScopeIds);
        return next;
    };
    const locateClosingAsyncAnchor = (node) => {
        let match = 0;
        while (node) {
            node = nextSibling(node);
            if (node && isComment(node)) {
                if (node.data === '[')
                    match++;
                if (node.data === ']') {
                    if (match === 0) {
                        return nextSibling(node);
                    }
                    else {
                        match--;
                    }
                }
            }
        }
        return node;
    };
    return [hydrate, hydrateNode];
}

const queuePostRenderEffect = queueEffectWithSuspense
    ;
/**
 * The createRenderer function accepts two generic arguments:
 * HostNode and HostElement, corresponding to Node and Element types in the
 * host environment. For example, for runtime-dom, HostNode would be the DOM
 * `Node` interface and HostElement would be the DOM `Element` interface.
 *
 * Custom renderers can pass in the platform specific types like this:
 *
 * ``` js
 * const { render, createApp } = createRenderer<Node, Element>({
 *   patchProp,
 *   ...nodeOps
 * })
 * ```
 */
function createRenderer(options) {
    return baseCreateRenderer(options);
}
// Separate API for creating hydration-enabled renderer.
// Hydration logic is only used when calling this function, making it
// tree-shakable.
function createHydrationRenderer(options) {
    return baseCreateRenderer(options, createHydrationFunctions);
}
// implementation
function baseCreateRenderer(options, createHydrationFns) {
    const { insert: hostInsert, remove: hostRemove, patchProp: hostPatchProp, createElement: hostCreateElement, createText: hostCreateText, createComment: hostCreateComment, setText: hostSetText, setElementText: hostSetElementText, parentNode: hostParentNode, nextSibling: hostNextSibling, setScopeId: hostSetScopeId = shared.NOOP, cloneNode: hostCloneNode, insertStaticContent: hostInsertStaticContent } = options;
    // Note: functions inside this closure should use `const xxx = () => {}`
    // style in order to prevent being inlined by minifiers.
    const patch = (n1, n2, container, anchor = null, parentComponent = null, parentSuspense = null, isSVG = false, slotScopeIds = null, optimized = !!n2.dynamicChildren) => {
        if (n1 === n2) {
            return;
        }
        // patching & not same type, unmount old tree
        if (n1 && !isSameVNodeType(n1, n2)) {
            anchor = getNextHostNode(n1);
            unmount(n1, parentComponent, parentSuspense, true);
            n1 = null;
        }
        if (n2.patchFlag === -2 /* BAIL */) {
            optimized = false;
            n2.dynamicChildren = null;
        }
        const { type, ref, shapeFlag } = n2;
        switch (type) {
            case Text:
                processText(n1, n2, container, anchor);
                break;
            case Comment:
                processCommentNode(n1, n2, container, anchor);
                break;
            case Static:
                if (n1 == null) {
                    mountStaticNode(n2, container, anchor, isSVG);
                }
                break;
            case Fragment:
                processFragment(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized);
                break;
            default:
                if (shapeFlag & 1 /* ELEMENT */) {
                    processElement(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized);
                }
                else if (shapeFlag & 6 /* COMPONENT */) {
                    processComponent(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized);
                }
                else if (shapeFlag & 64 /* TELEPORT */) {
                    type.process(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized, internals);
                }
                else if (shapeFlag & 128 /* SUSPENSE */) {
                    type.process(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized, internals);
                }
                else ;
        }
        // set ref
        if (ref != null && parentComponent) {
            setRef(ref, n1 && n1.ref, parentSuspense, n2 || n1, !n2);
        }
    };
    const processText = (n1, n2, container, anchor) => {
        if (n1 == null) {
            hostInsert((n2.el = hostCreateText(n2.children)), container, anchor);
        }
        else {
            const el = (n2.el = n1.el);
            if (n2.children !== n1.children) {
                hostSetText(el, n2.children);
            }
        }
    };
    const processCommentNode = (n1, n2, container, anchor) => {
        if (n1 == null) {
            hostInsert((n2.el = hostCreateComment(n2.children || '')), container, anchor);
        }
        else {
            // there's no support for dynamic comments
            n2.el = n1.el;
        }
    };
    const mountStaticNode = (n2, container, anchor, isSVG) => {
        [n2.el, n2.anchor] = hostInsertStaticContent(n2.children, container, anchor, isSVG);
    };
    const moveStaticNode = ({ el, anchor }, container, nextSibling) => {
        let next;
        while (el && el !== anchor) {
            next = hostNextSibling(el);
            hostInsert(el, container, nextSibling);
            el = next;
        }
        hostInsert(anchor, container, nextSibling);
    };
    const removeStaticNode = ({ el, anchor }) => {
        let next;
        while (el && el !== anchor) {
            next = hostNextSibling(el);
            hostRemove(el);
            el = next;
        }
        hostRemove(anchor);
    };
    const processElement = (n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized) => {
        isSVG = isSVG || n2.type === 'svg';
        if (n1 == null) {
            mountElement(n2, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized);
        }
        else {
            patchElement(n1, n2, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized);
        }
    };
    const mountElement = (vnode, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized) => {
        let el;
        let vnodeHook;
        const { type, props, shapeFlag, transition, patchFlag, dirs } = vnode;
        if (vnode.el &&
            hostCloneNode !== undefined &&
            patchFlag === -1 /* HOISTED */) {
            // If a vnode has non-null el, it means it's being reused.
            // Only static vnodes can be reused, so its mounted DOM nodes should be
            // exactly the same, and we can simply do a clone here.
            // only do this in production since cloned trees cannot be HMR updated.
            el = vnode.el = hostCloneNode(vnode.el);
        }
        else {
            el = vnode.el = hostCreateElement(vnode.type, isSVG, props && props.is, props);
            // mount children first, since some props may rely on child content
            // being already rendered, e.g. `<select value>`
            if (shapeFlag & 8 /* TEXT_CHILDREN */) {
                hostSetElementText(el, vnode.children);
            }
            else if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
                mountChildren(vnode.children, el, null, parentComponent, parentSuspense, isSVG && type !== 'foreignObject', slotScopeIds, optimized);
            }
            if (dirs) {
                invokeDirectiveHook(vnode, null, parentComponent, 'created');
            }
            // props
            if (props) {
                for (const key in props) {
                    if (key !== 'value' && !shared.isReservedProp(key)) {
                        hostPatchProp(el, key, null, props[key], isSVG, vnode.children, parentComponent, parentSuspense, unmountChildren);
                    }
                }
                /**
                 * Special case for setting value on DOM elements:
                 * - it can be order-sensitive (e.g. should be set *after* min/max, #2325, #4024)
                 * - it needs to be forced (#1471)
                 * #2353 proposes adding another renderer option to configure this, but
                 * the properties affects are so finite it is worth special casing it
                 * here to reduce the complexity. (Special casing it also should not
                 * affect non-DOM renderers)
                 */
                if ('value' in props) {
                    hostPatchProp(el, 'value', null, props.value);
                }
                if ((vnodeHook = props.onVnodeBeforeMount)) {
                    invokeVNodeHook(vnodeHook, parentComponent, vnode);
                }
            }
            // scopeId
            setScopeId(el, vnode, vnode.scopeId, slotScopeIds, parentComponent);
        }
        if (dirs) {
            invokeDirectiveHook(vnode, null, parentComponent, 'beforeMount');
        }
        // #1583 For inside suspense + suspense not resolved case, enter hook should call when suspense resolved
        // #1689 For inside suspense + suspense resolved case, just call it
        const needCallTransitionHooks = (!parentSuspense || (parentSuspense && !parentSuspense.pendingBranch)) &&
            transition &&
            !transition.persisted;
        if (needCallTransitionHooks) {
            transition.beforeEnter(el);
        }
        hostInsert(el, container, anchor);
        if ((vnodeHook = props && props.onVnodeMounted) ||
            needCallTransitionHooks ||
            dirs) {
            queuePostRenderEffect(() => {
                vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode);
                needCallTransitionHooks && transition.enter(el);
                dirs && invokeDirectiveHook(vnode, null, parentComponent, 'mounted');
            }, parentSuspense);
        }
    };
    const setScopeId = (el, vnode, scopeId, slotScopeIds, parentComponent) => {
        if (scopeId) {
            hostSetScopeId(el, scopeId);
        }
        if (slotScopeIds) {
            for (let i = 0; i < slotScopeIds.length; i++) {
                hostSetScopeId(el, slotScopeIds[i]);
            }
        }
        if (parentComponent) {
            let subTree = parentComponent.subTree;
            if (vnode === subTree) {
                const parentVNode = parentComponent.vnode;
                setScopeId(el, parentVNode, parentVNode.scopeId, parentVNode.slotScopeIds, parentComponent.parent);
            }
        }
    };
    const mountChildren = (children, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized, start = 0) => {
        for (let i = start; i < children.length; i++) {
            const child = (children[i] = optimized
                ? cloneIfMounted(children[i])
                : normalizeVNode(children[i]));
            patch(null, child, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized);
        }
    };
    const patchElement = (n1, n2, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized) => {
        const el = (n2.el = n1.el);
        let { patchFlag, dynamicChildren, dirs } = n2;
        // #1426 take the old vnode's patch flag into account since user may clone a
        // compiler-generated vnode, which de-opts to FULL_PROPS
        patchFlag |= n1.patchFlag & 16 /* FULL_PROPS */;
        const oldProps = n1.props || shared.EMPTY_OBJ;
        const newProps = n2.props || shared.EMPTY_OBJ;
        let vnodeHook;
        if ((vnodeHook = newProps.onVnodeBeforeUpdate)) {
            invokeVNodeHook(vnodeHook, parentComponent, n2, n1);
        }
        if (dirs) {
            invokeDirectiveHook(n2, n1, parentComponent, 'beforeUpdate');
        }
        const areChildrenSVG = isSVG && n2.type !== 'foreignObject';
        if (dynamicChildren) {
            patchBlockChildren(n1.dynamicChildren, dynamicChildren, el, parentComponent, parentSuspense, areChildrenSVG, slotScopeIds);
        }
        else if (!optimized) {
            // full diff
            patchChildren(n1, n2, el, null, parentComponent, parentSuspense, areChildrenSVG, slotScopeIds, false);
        }
        if (patchFlag > 0) {
            // the presence of a patchFlag means this element's render code was
            // generated by the compiler and can take the fast path.
            // in this path old node and new node are guaranteed to have the same shape
            // (i.e. at the exact same position in the source template)
            if (patchFlag & 16 /* FULL_PROPS */) {
                // element props contain dynamic keys, full diff needed
                patchProps(el, n2, oldProps, newProps, parentComponent, parentSuspense, isSVG);
            }
            else {
                // class
                // this flag is matched when the element has dynamic class bindings.
                if (patchFlag & 2 /* CLASS */) {
                    if (oldProps.class !== newProps.class) {
                        hostPatchProp(el, 'class', null, newProps.class, isSVG);
                    }
                }
                // style
                // this flag is matched when the element has dynamic style bindings
                if (patchFlag & 4 /* STYLE */) {
                    hostPatchProp(el, 'style', oldProps.style, newProps.style, isSVG);
                }
                // props
                // This flag is matched when the element has dynamic prop/attr bindings
                // other than class and style. The keys of dynamic prop/attrs are saved for
                // faster iteration.
                // Note dynamic keys like :[foo]="bar" will cause this optimization to
                // bail out and go through a full diff because we need to unset the old key
                if (patchFlag & 8 /* PROPS */) {
                    // if the flag is present then dynamicProps must be non-null
                    const propsToUpdate = n2.dynamicProps;
                    for (let i = 0; i < propsToUpdate.length; i++) {
                        const key = propsToUpdate[i];
                        const prev = oldProps[key];
                        const next = newProps[key];
                        // #1471 force patch value
                        if (next !== prev || key === 'value') {
                            hostPatchProp(el, key, prev, next, isSVG, n1.children, parentComponent, parentSuspense, unmountChildren);
                        }
                    }
                }
            }
            // text
            // This flag is matched when the element has only dynamic text children.
            if (patchFlag & 1 /* TEXT */) {
                if (n1.children !== n2.children) {
                    hostSetElementText(el, n2.children);
                }
            }
        }
        else if (!optimized && dynamicChildren == null) {
            // unoptimized, full diff
            patchProps(el, n2, oldProps, newProps, parentComponent, parentSuspense, isSVG);
        }
        if ((vnodeHook = newProps.onVnodeUpdated) || dirs) {
            queuePostRenderEffect(() => {
                vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, n2, n1);
                dirs && invokeDirectiveHook(n2, n1, parentComponent, 'updated');
            }, parentSuspense);
        }
    };
    // The fast path for blocks.
    const patchBlockChildren = (oldChildren, newChildren, fallbackContainer, parentComponent, parentSuspense, isSVG, slotScopeIds) => {
        for (let i = 0; i < newChildren.length; i++) {
            const oldVNode = oldChildren[i];
            const newVNode = newChildren[i];
            // Determine the container (parent element) for the patch.
            const container = 
            // oldVNode may be an errored async setup() component inside Suspense
            // which will not have a mounted element
            oldVNode.el &&
                // - In the case of a Fragment, we need to provide the actual parent
                // of the Fragment itself so it can move its children.
                (oldVNode.type === Fragment ||
                    // - In the case of different nodes, there is going to be a replacement
                    // which also requires the correct parent container
                    !isSameVNodeType(oldVNode, newVNode) ||
                    // - In the case of a component, it could contain anything.
                    oldVNode.shapeFlag & (6 /* COMPONENT */ | 64 /* TELEPORT */))
                ? hostParentNode(oldVNode.el)
                : // In other cases, the parent container is not actually used so we
                    // just pass the block element here to avoid a DOM parentNode call.
                    fallbackContainer;
            patch(oldVNode, newVNode, container, null, parentComponent, parentSuspense, isSVG, slotScopeIds, true);
        }
    };
    const patchProps = (el, vnode, oldProps, newProps, parentComponent, parentSuspense, isSVG) => {
        if (oldProps !== newProps) {
            for (const key in newProps) {
                // empty string is not valid prop
                if (shared.isReservedProp(key))
                    continue;
                const next = newProps[key];
                const prev = oldProps[key];
                // defer patching value
                if (next !== prev && key !== 'value') {
                    hostPatchProp(el, key, prev, next, isSVG, vnode.children, parentComponent, parentSuspense, unmountChildren);
                }
            }
            if (oldProps !== shared.EMPTY_OBJ) {
                for (const key in oldProps) {
                    if (!shared.isReservedProp(key) && !(key in newProps)) {
                        hostPatchProp(el, key, oldProps[key], null, isSVG, vnode.children, parentComponent, parentSuspense, unmountChildren);
                    }
                }
            }
            if ('value' in newProps) {
                hostPatchProp(el, 'value', oldProps.value, newProps.value);
            }
        }
    };
    const processFragment = (n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized) => {
        const fragmentStartAnchor = (n2.el = n1 ? n1.el : hostCreateText(''));
        const fragmentEndAnchor = (n2.anchor = n1 ? n1.anchor : hostCreateText(''));
        let { patchFlag, dynamicChildren, slotScopeIds: fragmentSlotScopeIds } = n2;
        // check if this is a slot fragment with :slotted scope ids
        if (fragmentSlotScopeIds) {
            slotScopeIds = slotScopeIds
                ? slotScopeIds.concat(fragmentSlotScopeIds)
                : fragmentSlotScopeIds;
        }
        if (n1 == null) {
            hostInsert(fragmentStartAnchor, container, anchor);
            hostInsert(fragmentEndAnchor, container, anchor);
            // a fragment can only have array children
            // since they are either generated by the compiler, or implicitly created
            // from arrays.
            mountChildren(n2.children, container, fragmentEndAnchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized);
        }
        else {
            if (patchFlag > 0 &&
                patchFlag & 64 /* STABLE_FRAGMENT */ &&
                dynamicChildren &&
                // #2715 the previous fragment could've been a BAILed one as a result
                // of renderSlot() with no valid children
                n1.dynamicChildren) {
                // a stable fragment (template root or <template v-for>) doesn't need to
                // patch children order, but it may contain dynamicChildren.
                patchBlockChildren(n1.dynamicChildren, dynamicChildren, container, parentComponent, parentSuspense, isSVG, slotScopeIds);
                if (
                // #2080 if the stable fragment has a key, it's a <template v-for> that may
                //  get moved around. Make sure all root level vnodes inherit el.
                // #2134 or if it's a component root, it may also get moved around
                // as the component is being moved.
                n2.key != null ||
                    (parentComponent && n2 === parentComponent.subTree)) {
                    traverseStaticChildren(n1, n2, true /* shallow */);
                }
            }
            else {
                // keyed / unkeyed, or manual fragments.
                // for keyed & unkeyed, since they are compiler generated from v-for,
                // each child is guaranteed to be a block so the fragment will never
                // have dynamicChildren.
                patchChildren(n1, n2, container, fragmentEndAnchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized);
            }
        }
    };
    const processComponent = (n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized) => {
        n2.slotScopeIds = slotScopeIds;
        if (n1 == null) {
            if (n2.shapeFlag & 512 /* COMPONENT_KEPT_ALIVE */) {
                parentComponent.ctx.activate(n2, container, anchor, isSVG, optimized);
            }
            else {
                mountComponent(n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
            }
        }
        else {
            updateComponent(n1, n2, optimized);
        }
    };
    const mountComponent = (initialVNode, container, anchor, parentComponent, parentSuspense, isSVG, optimized) => {
        const instance = (initialVNode.component = createComponentInstance(initialVNode, parentComponent, parentSuspense));
        // inject renderer internals for keepAlive
        if (isKeepAlive(initialVNode)) {
            instance.ctx.renderer = internals;
        }
        // resolve props and slots for setup context
        {
            setupComponent(instance);
        }
        // setup() is async. This component relies on async logic to be resolved
        // before proceeding
        if (instance.asyncDep) {
            parentSuspense && parentSuspense.registerDep(instance, setupRenderEffect);
            // Give it a placeholder if this is not hydration
            // TODO handle self-defined fallback
            if (!initialVNode.el) {
                const placeholder = (instance.subTree = createVNode(Comment));
                processCommentNode(null, placeholder, container, anchor);
            }
            return;
        }
        setupRenderEffect(instance, initialVNode, container, anchor, parentSuspense, isSVG, optimized);
    };
    const updateComponent = (n1, n2, optimized) => {
        const instance = (n2.component = n1.component);
        if (shouldUpdateComponent(n1, n2, optimized)) {
            if (instance.asyncDep &&
                !instance.asyncResolved) {
                updateComponentPreRender(instance, n2, optimized);
                return;
            }
            else {
                // normal update
                instance.next = n2;
                // in case the child component is also queued, remove it to avoid
                // double updating the same child component in the same flush.
                invalidateJob(instance.update);
                // instance.update is the reactive effect.
                instance.update();
            }
        }
        else {
            // no update needed. just copy over properties
            n2.component = n1.component;
            n2.el = n1.el;
            instance.vnode = n2;
        }
    };
    const setupRenderEffect = (instance, initialVNode, container, anchor, parentSuspense, isSVG, optimized) => {
        const componentUpdateFn = () => {
            if (!instance.isMounted) {
                let vnodeHook;
                const { el, props } = initialVNode;
                const { bm, m, parent } = instance;
                const isAsyncWrapperVNode = isAsyncWrapper(initialVNode);
                effect.allowRecurse = false;
                // beforeMount hook
                if (bm) {
                    shared.invokeArrayFns(bm);
                }
                // onVnodeBeforeMount
                if (!isAsyncWrapperVNode &&
                    (vnodeHook = props && props.onVnodeBeforeMount)) {
                    invokeVNodeHook(vnodeHook, parent, initialVNode);
                }
                effect.allowRecurse = true;
                if (el && hydrateNode) {
                    // vnode has adopted host node - perform hydration instead of mount.
                    const hydrateSubTree = () => {
                        instance.subTree = renderComponentRoot(instance);
                        hydrateNode(el, instance.subTree, instance, parentSuspense, null);
                    };
                    if (isAsyncWrapperVNode) {
                        initialVNode.type.__asyncLoader().then(
                        // note: we are moving the render call into an async callback,
                        // which means it won't track dependencies - but it's ok because
                        // a server-rendered async wrapper is already in resolved state
                        // and it will never need to change.
                        () => !instance.isUnmounted && hydrateSubTree());
                    }
                    else {
                        hydrateSubTree();
                    }
                }
                else {
                    const subTree = (instance.subTree = renderComponentRoot(instance));
                    patch(null, subTree, container, anchor, instance, parentSuspense, isSVG);
                    initialVNode.el = subTree.el;
                }
                // mounted hook
                if (m) {
                    queuePostRenderEffect(m, parentSuspense);
                }
                // onVnodeMounted
                if (!isAsyncWrapperVNode &&
                    (vnodeHook = props && props.onVnodeMounted)) {
                    const scopedInitialVNode = initialVNode;
                    queuePostRenderEffect(() => invokeVNodeHook(vnodeHook, parent, scopedInitialVNode), parentSuspense);
                }
                // activated hook for keep-alive roots.
                // #1742 activated hook must be accessed after first render
                // since the hook may be injected by a child keep-alive
                if (initialVNode.shapeFlag & 256 /* COMPONENT_SHOULD_KEEP_ALIVE */) {
                    instance.a && queuePostRenderEffect(instance.a, parentSuspense);
                }
                instance.isMounted = true;
                // #2458: deference mount-only object parameters to prevent memleaks
                initialVNode = container = anchor = null;
            }
            else {
                // updateComponent
                // This is triggered by mutation of component's own state (next: null)
                // OR parent calling processComponent (next: VNode)
                let { next, bu, u, parent, vnode } = instance;
                let originNext = next;
                let vnodeHook;
                // Disallow component effect recursion during pre-lifecycle hooks.
                effect.allowRecurse = false;
                if (next) {
                    next.el = vnode.el;
                    updateComponentPreRender(instance, next, optimized);
                }
                else {
                    next = vnode;
                }
                // beforeUpdate hook
                if (bu) {
                    shared.invokeArrayFns(bu);
                }
                // onVnodeBeforeUpdate
                if ((vnodeHook = next.props && next.props.onVnodeBeforeUpdate)) {
                    invokeVNodeHook(vnodeHook, parent, next, vnode);
                }
                effect.allowRecurse = true;
                const nextTree = renderComponentRoot(instance);
                const prevTree = instance.subTree;
                instance.subTree = nextTree;
                patch(prevTree, nextTree, 
                // parent may have changed if it's in a teleport
                hostParentNode(prevTree.el), 
                // anchor may have changed if it's in a fragment
                getNextHostNode(prevTree), instance, parentSuspense, isSVG);
                next.el = nextTree.el;
                if (originNext === null) {
                    // self-triggered update. In case of HOC, update parent component
                    // vnode el. HOC is indicated by parent instance's subTree pointing
                    // to child component's vnode
                    updateHOCHostEl(instance, nextTree.el);
                }
                // updated hook
                if (u) {
                    queuePostRenderEffect(u, parentSuspense);
                }
                // onVnodeUpdated
                if ((vnodeHook = next.props && next.props.onVnodeUpdated)) {
                    queuePostRenderEffect(() => invokeVNodeHook(vnodeHook, parent, next, vnode), parentSuspense);
                }
            }
        };
        // create reactive effect for rendering
        const effect = new reactivity.ReactiveEffect(componentUpdateFn, () => queueJob(instance.update), instance.scope // track it in component's effect scope
        );
        const update = (instance.update = effect.run.bind(effect));
        update.id = instance.uid;
        // allowRecurse
        // #1801, #2043 component render effects should allow recursive updates
        effect.allowRecurse = update.allowRecurse = true;
        update();
    };
    const updateComponentPreRender = (instance, nextVNode, optimized) => {
        nextVNode.component = instance;
        const prevProps = instance.vnode.props;
        instance.vnode = nextVNode;
        instance.next = null;
        updateProps(instance, nextVNode.props, prevProps, optimized);
        updateSlots(instance, nextVNode.children, optimized);
        reactivity.pauseTracking();
        // props update may have triggered pre-flush watchers.
        // flush them before the render update.
        flushPreFlushCbs(undefined, instance.update);
        reactivity.resetTracking();
    };
    const patchChildren = (n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized = false) => {
        const c1 = n1 && n1.children;
        const prevShapeFlag = n1 ? n1.shapeFlag : 0;
        const c2 = n2.children;
        const { patchFlag, shapeFlag } = n2;
        // fast path
        if (patchFlag > 0) {
            if (patchFlag & 128 /* KEYED_FRAGMENT */) {
                // this could be either fully-keyed or mixed (some keyed some not)
                // presence of patchFlag means children are guaranteed to be arrays
                patchKeyedChildren(c1, c2, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized);
                return;
            }
            else if (patchFlag & 256 /* UNKEYED_FRAGMENT */) {
                // unkeyed
                patchUnkeyedChildren(c1, c2, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized);
                return;
            }
        }
        // children has 3 possibilities: text, array or no children.
        if (shapeFlag & 8 /* TEXT_CHILDREN */) {
            // text children fast path
            if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
                unmountChildren(c1, parentComponent, parentSuspense);
            }
            if (c2 !== c1) {
                hostSetElementText(container, c2);
            }
        }
        else {
            if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
                // prev children was array
                if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
                    // two arrays, cannot assume anything, do full diff
                    patchKeyedChildren(c1, c2, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized);
                }
                else {
                    // no new children, just unmount old
                    unmountChildren(c1, parentComponent, parentSuspense, true);
                }
            }
            else {
                // prev children was text OR null
                // new children is array OR null
                if (prevShapeFlag & 8 /* TEXT_CHILDREN */) {
                    hostSetElementText(container, '');
                }
                // mount new if array
                if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
                    mountChildren(c2, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized);
                }
            }
        }
    };
    const patchUnkeyedChildren = (c1, c2, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized) => {
        c1 = c1 || shared.EMPTY_ARR;
        c2 = c2 || shared.EMPTY_ARR;
        const oldLength = c1.length;
        const newLength = c2.length;
        const commonLength = Math.min(oldLength, newLength);
        let i;
        for (i = 0; i < commonLength; i++) {
            const nextChild = (c2[i] = optimized
                ? cloneIfMounted(c2[i])
                : normalizeVNode(c2[i]));
            patch(c1[i], nextChild, container, null, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized);
        }
        if (oldLength > newLength) {
            // remove old
            unmountChildren(c1, parentComponent, parentSuspense, true, false, commonLength);
        }
        else {
            // mount new
            mountChildren(c2, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized, commonLength);
        }
    };
    // can be all-keyed or mixed
    const patchKeyedChildren = (c1, c2, container, parentAnchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized) => {
        let i = 0;
        const l2 = c2.length;
        let e1 = c1.length - 1; // prev ending index
        let e2 = l2 - 1; // next ending index
        // 1. sync from start
        // (a b) c
        // (a b) d e
        while (i <= e1 && i <= e2) {
            const n1 = c1[i];
            const n2 = (c2[i] = optimized
                ? cloneIfMounted(c2[i])
                : normalizeVNode(c2[i]));
            if (isSameVNodeType(n1, n2)) {
                patch(n1, n2, container, null, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized);
            }
            else {
                break;
            }
            i++;
        }
        // 2. sync from end
        // a (b c)
        // d e (b c)
        while (i <= e1 && i <= e2) {
            const n1 = c1[e1];
            const n2 = (c2[e2] = optimized
                ? cloneIfMounted(c2[e2])
                : normalizeVNode(c2[e2]));
            if (isSameVNodeType(n1, n2)) {
                patch(n1, n2, container, null, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized);
            }
            else {
                break;
            }
            e1--;
            e2--;
        }
        // 3. common sequence + mount
        // (a b)
        // (a b) c
        // i = 2, e1 = 1, e2 = 2
        // (a b)
        // c (a b)
        // i = 0, e1 = -1, e2 = 0
        if (i > e1) {
            if (i <= e2) {
                const nextPos = e2 + 1;
                const anchor = nextPos < l2 ? c2[nextPos].el : parentAnchor;
                while (i <= e2) {
                    patch(null, (c2[i] = optimized
                        ? cloneIfMounted(c2[i])
                        : normalizeVNode(c2[i])), container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized);
                    i++;
                }
            }
        }
        // 4. common sequence + unmount
        // (a b) c
        // (a b)
        // i = 2, e1 = 2, e2 = 1
        // a (b c)
        // (b c)
        // i = 0, e1 = 0, e2 = -1
        else if (i > e2) {
            while (i <= e1) {
                unmount(c1[i], parentComponent, parentSuspense, true);
                i++;
            }
        }
        // 5. unknown sequence
        // [i ... e1 + 1]: a b [c d e] f g
        // [i ... e2 + 1]: a b [e d c h] f g
        // i = 2, e1 = 4, e2 = 5
        else {
            const s1 = i; // prev starting index
            const s2 = i; // next starting index
            // 5.1 build key:index map for newChildren
            const keyToNewIndexMap = new Map();
            for (i = s2; i <= e2; i++) {
                const nextChild = (c2[i] = optimized
                    ? cloneIfMounted(c2[i])
                    : normalizeVNode(c2[i]));
                if (nextChild.key != null) {
                    keyToNewIndexMap.set(nextChild.key, i);
                }
            }
            // 5.2 loop through old children left to be patched and try to patch
            // matching nodes & remove nodes that are no longer present
            let j;
            let patched = 0;
            const toBePatched = e2 - s2 + 1;
            let moved = false;
            // used to track whether any node has moved
            let maxNewIndexSoFar = 0;
            // works as Map<newIndex, oldIndex>
            // Note that oldIndex is offset by +1
            // and oldIndex = 0 is a special value indicating the new node has
            // no corresponding old node.
            // used for determining longest stable subsequence
            const newIndexToOldIndexMap = new Array(toBePatched);
            for (i = 0; i < toBePatched; i++)
                newIndexToOldIndexMap[i] = 0;
            for (i = s1; i <= e1; i++) {
                const prevChild = c1[i];
                if (patched >= toBePatched) {
                    // all new children have been patched so this can only be a removal
                    unmount(prevChild, parentComponent, parentSuspense, true);
                    continue;
                }
                let newIndex;
                if (prevChild.key != null) {
                    newIndex = keyToNewIndexMap.get(prevChild.key);
                }
                else {
                    // key-less node, try to locate a key-less node of the same type
                    for (j = s2; j <= e2; j++) {
                        if (newIndexToOldIndexMap[j - s2] === 0 &&
                            isSameVNodeType(prevChild, c2[j])) {
                            newIndex = j;
                            break;
                        }
                    }
                }
                if (newIndex === undefined) {
                    unmount(prevChild, parentComponent, parentSuspense, true);
                }
                else {
                    newIndexToOldIndexMap[newIndex - s2] = i + 1;
                    if (newIndex >= maxNewIndexSoFar) {
                        maxNewIndexSoFar = newIndex;
                    }
                    else {
                        moved = true;
                    }
                    patch(prevChild, c2[newIndex], container, null, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized);
                    patched++;
                }
            }
            // 5.3 move and mount
            // generate longest stable subsequence only when nodes have moved
            const increasingNewIndexSequence = moved
                ? getSequence(newIndexToOldIndexMap)
                : shared.EMPTY_ARR;
            j = increasingNewIndexSequence.length - 1;
            // looping backwards so that we can use last patched node as anchor
            for (i = toBePatched - 1; i >= 0; i--) {
                const nextIndex = s2 + i;
                const nextChild = c2[nextIndex];
                const anchor = nextIndex + 1 < l2 ? c2[nextIndex + 1].el : parentAnchor;
                if (newIndexToOldIndexMap[i] === 0) {
                    // mount new
                    patch(null, nextChild, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized);
                }
                else if (moved) {
                    // move if:
                    // There is no stable subsequence (e.g. a reverse)
                    // OR current node is not among the stable sequence
                    if (j < 0 || i !== increasingNewIndexSequence[j]) {
                        move(nextChild, container, anchor, 2 /* REORDER */);
                    }
                    else {
                        j--;
                    }
                }
            }
        }
    };
    const move = (vnode, container, anchor, moveType, parentSuspense = null) => {
        const { el, type, transition, children, shapeFlag } = vnode;
        if (shapeFlag & 6 /* COMPONENT */) {
            move(vnode.component.subTree, container, anchor, moveType);
            return;
        }
        if (shapeFlag & 128 /* SUSPENSE */) {
            vnode.suspense.move(container, anchor, moveType);
            return;
        }
        if (shapeFlag & 64 /* TELEPORT */) {
            type.move(vnode, container, anchor, internals);
            return;
        }
        if (type === Fragment) {
            hostInsert(el, container, anchor);
            for (let i = 0; i < children.length; i++) {
                move(children[i], container, anchor, moveType);
            }
            hostInsert(vnode.anchor, container, anchor);
            return;
        }
        if (type === Static) {
            moveStaticNode(vnode, container, anchor);
            return;
        }
        // single nodes
        const needTransition = moveType !== 2 /* REORDER */ &&
            shapeFlag & 1 /* ELEMENT */ &&
            transition;
        if (needTransition) {
            if (moveType === 0 /* ENTER */) {
                transition.beforeEnter(el);
                hostInsert(el, container, anchor);
                queuePostRenderEffect(() => transition.enter(el), parentSuspense);
            }
            else {
                const { leave, delayLeave, afterLeave } = transition;
                const remove = () => hostInsert(el, container, anchor);
                const performLeave = () => {
                    leave(el, () => {
                        remove();
                        afterLeave && afterLeave();
                    });
                };
                if (delayLeave) {
                    delayLeave(el, remove, performLeave);
                }
                else {
                    performLeave();
                }
            }
        }
        else {
            hostInsert(el, container, anchor);
        }
    };
    const unmount = (vnode, parentComponent, parentSuspense, doRemove = false, optimized = false) => {
        const { type, props, ref, children, dynamicChildren, shapeFlag, patchFlag, dirs } = vnode;
        // unset ref
        if (ref != null) {
            setRef(ref, null, parentSuspense, vnode, true);
        }
        if (shapeFlag & 256 /* COMPONENT_SHOULD_KEEP_ALIVE */) {
            parentComponent.ctx.deactivate(vnode);
            return;
        }
        const shouldInvokeDirs = shapeFlag & 1 /* ELEMENT */ && dirs;
        const shouldInvokeVnodeHook = !isAsyncWrapper(vnode);
        let vnodeHook;
        if (shouldInvokeVnodeHook &&
            (vnodeHook = props && props.onVnodeBeforeUnmount)) {
            invokeVNodeHook(vnodeHook, parentComponent, vnode);
        }
        if (shapeFlag & 6 /* COMPONENT */) {
            unmountComponent(vnode.component, parentSuspense, doRemove);
        }
        else {
            if (shapeFlag & 128 /* SUSPENSE */) {
                vnode.suspense.unmount(parentSuspense, doRemove);
                return;
            }
            if (shouldInvokeDirs) {
                invokeDirectiveHook(vnode, null, parentComponent, 'beforeUnmount');
            }
            if (shapeFlag & 64 /* TELEPORT */) {
                vnode.type.remove(vnode, parentComponent, parentSuspense, optimized, internals, doRemove);
            }
            else if (dynamicChildren &&
                // #1153: fast path should not be taken for non-stable (v-for) fragments
                (type !== Fragment ||
                    (patchFlag > 0 && patchFlag & 64 /* STABLE_FRAGMENT */))) {
                // fast path for block nodes: only need to unmount dynamic children.
                unmountChildren(dynamicChildren, parentComponent, parentSuspense, false, true);
            }
            else if ((type === Fragment &&
                patchFlag &
                    (128 /* KEYED_FRAGMENT */ | 256 /* UNKEYED_FRAGMENT */)) ||
                (!optimized && shapeFlag & 16 /* ARRAY_CHILDREN */)) {
                unmountChildren(children, parentComponent, parentSuspense);
            }
            if (doRemove) {
                remove(vnode);
            }
        }
        if ((shouldInvokeVnodeHook &&
            (vnodeHook = props && props.onVnodeUnmounted)) ||
            shouldInvokeDirs) {
            queuePostRenderEffect(() => {
                vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode);
                shouldInvokeDirs &&
                    invokeDirectiveHook(vnode, null, parentComponent, 'unmounted');
            }, parentSuspense);
        }
    };
    const remove = vnode => {
        const { type, el, anchor, transition } = vnode;
        if (type === Fragment) {
            removeFragment(el, anchor);
            return;
        }
        if (type === Static) {
            removeStaticNode(vnode);
            return;
        }
        const performRemove = () => {
            hostRemove(el);
            if (transition && !transition.persisted && transition.afterLeave) {
                transition.afterLeave();
            }
        };
        if (vnode.shapeFlag & 1 /* ELEMENT */ &&
            transition &&
            !transition.persisted) {
            const { leave, delayLeave } = transition;
            const performLeave = () => leave(el, performRemove);
            if (delayLeave) {
                delayLeave(vnode.el, performRemove, performLeave);
            }
            else {
                performLeave();
            }
        }
        else {
            performRemove();
        }
    };
    const removeFragment = (cur, end) => {
        // For fragments, directly remove all contained DOM nodes.
        // (fragment child nodes cannot have transition)
        let next;
        while (cur !== end) {
            next = hostNextSibling(cur);
            hostRemove(cur);
            cur = next;
        }
        hostRemove(end);
    };
    const unmountComponent = (instance, parentSuspense, doRemove) => {
        const { bum, scope, update, subTree, um } = instance;
        // beforeUnmount hook
        if (bum) {
            shared.invokeArrayFns(bum);
        }
        // stop effects in component scope
        scope.stop();
        // update may be null if a component is unmounted before its async
        // setup has resolved.
        if (update) {
            // so that scheduler will no longer invoke it
            update.active = false;
            unmount(subTree, instance, parentSuspense, doRemove);
        }
        // unmounted hook
        if (um) {
            queuePostRenderEffect(um, parentSuspense);
        }
        queuePostRenderEffect(() => {
            instance.isUnmounted = true;
        }, parentSuspense);
        // A component with async dep inside a pending suspense is unmounted before
        // its async dep resolves. This should remove the dep from the suspense, and
        // cause the suspense to resolve immediately if that was the last dep.
        if (parentSuspense &&
            parentSuspense.pendingBranch &&
            !parentSuspense.isUnmounted &&
            instance.asyncDep &&
            !instance.asyncResolved &&
            instance.suspenseId === parentSuspense.pendingId) {
            parentSuspense.deps--;
            if (parentSuspense.deps === 0) {
                parentSuspense.resolve();
            }
        }
    };
    const unmountChildren = (children, parentComponent, parentSuspense, doRemove = false, optimized = false, start = 0) => {
        for (let i = start; i < children.length; i++) {
            unmount(children[i], parentComponent, parentSuspense, doRemove, optimized);
        }
    };
    const getNextHostNode = vnode => {
        if (vnode.shapeFlag & 6 /* COMPONENT */) {
            return getNextHostNode(vnode.component.subTree);
        }
        if (vnode.shapeFlag & 128 /* SUSPENSE */) {
            return vnode.suspense.next();
        }
        return hostNextSibling((vnode.anchor || vnode.el));
    };
    const render = (vnode, container, isSVG) => {
        if (vnode == null) {
            if (container._vnode) {
                unmount(container._vnode, null, null, true);
            }
        }
        else {
            patch(container._vnode || null, vnode, container, null, null, null, isSVG);
        }
        flushPostFlushCbs();
        container._vnode = vnode;
    };
    const internals = {
        p: patch,
        um: unmount,
        m: move,
        r: remove,
        mt: mountComponent,
        mc: mountChildren,
        pc: patchChildren,
        pbc: patchBlockChildren,
        n: getNextHostNode,
        o: options
    };
    let hydrate;
    let hydrateNode;
    if (createHydrationFns) {
        [hydrate, hydrateNode] = createHydrationFns(internals);
    }
    return {
        render,
        hydrate,
        createApp: createAppAPI(render, hydrate)
    };
}
function setRef(rawRef, oldRawRef, parentSuspense, vnode, isUnmount = false) {
    if (shared.isArray(rawRef)) {
        rawRef.forEach((r, i) => setRef(r, oldRawRef && (shared.isArray(oldRawRef) ? oldRawRef[i] : oldRawRef), parentSuspense, vnode, isUnmount));
        return;
    }
    if (isAsyncWrapper(vnode) && !isUnmount) {
        // when mounting async components, nothing needs to be done,
        // because the template ref is forwarded to inner component
        return;
    }
    const refValue = vnode.shapeFlag & 4 /* STATEFUL_COMPONENT */
        ? getExposeProxy(vnode.component) || vnode.component.proxy
        : vnode.el;
    const value = isUnmount ? null : refValue;
    const { i: owner, r: ref } = rawRef;
    const oldRef = oldRawRef && oldRawRef.r;
    const refs = owner.refs === shared.EMPTY_OBJ ? (owner.refs = {}) : owner.refs;
    const setupState = owner.setupState;
    // dynamic ref changed. unset old ref
    if (oldRef != null && oldRef !== ref) {
        if (shared.isString(oldRef)) {
            refs[oldRef] = null;
            if (shared.hasOwn(setupState, oldRef)) {
                setupState[oldRef] = null;
            }
        }
        else if (reactivity.isRef(oldRef)) {
            oldRef.value = null;
        }
    }
    if (shared.isString(ref)) {
        const doSet = () => {
            {
                refs[ref] = value;
            }
            if (shared.hasOwn(setupState, ref)) {
                setupState[ref] = value;
            }
        };
        // #1789: for non-null values, set them after render
        // null values means this is unmount and it should not overwrite another
        // ref with the same key
        if (value) {
            doSet.id = -1;
            queuePostRenderEffect(doSet, parentSuspense);
        }
        else {
            doSet();
        }
    }
    else if (reactivity.isRef(ref)) {
        const doSet = () => {
            ref.value = value;
        };
        if (value) {
            doSet.id = -1;
            queuePostRenderEffect(doSet, parentSuspense);
        }
        else {
            doSet();
        }
    }
    else if (shared.isFunction(ref)) {
        callWithErrorHandling(ref, owner, 12 /* FUNCTION_REF */, [value, refs]);
    }
    else ;
}
function invokeVNodeHook(hook, instance, vnode, prevVNode = null) {
    callWithAsyncErrorHandling(hook, instance, 7 /* VNODE_HOOK */, [
        vnode,
        prevVNode
    ]);
}
/**
 * #1156
 * When a component is HMR-enabled, we need to make sure that all static nodes
 * inside a block also inherit the DOM element from the previous tree so that
 * HMR updates (which are full updates) can retrieve the element for patching.
 *
 * #2080
 * Inside keyed `template` fragment static children, if a fragment is moved,
 * the children will always moved so that need inherit el form previous nodes
 * to ensure correct moved position.
 */
function traverseStaticChildren(n1, n2, shallow = false) {
    const ch1 = n1.children;
    const ch2 = n2.children;
    if (shared.isArray(ch1) && shared.isArray(ch2)) {
        for (let i = 0; i < ch1.length; i++) {
            // this is only called in the optimized path so array children are
            // guaranteed to be vnodes
            const c1 = ch1[i];
            let c2 = ch2[i];
            if (c2.shapeFlag & 1 /* ELEMENT */ && !c2.dynamicChildren) {
                if (c2.patchFlag <= 0 || c2.patchFlag === 32 /* HYDRATE_EVENTS */) {
                    c2 = ch2[i] = cloneIfMounted(ch2[i]);
                    c2.el = c1.el;
                }
                if (!shallow)
                    traverseStaticChildren(c1, c2);
            }
        }
    }
}
// https://en.wikipedia.org/wiki/Longest_increasing_subsequence
function getSequence(arr) {
    const p = arr.slice();
    const result = [0];
    let i, j, u, v, c;
    const len = arr.length;
    for (i = 0; i < len; i++) {
        const arrI = arr[i];
        if (arrI !== 0) {
            j = result[result.length - 1];
            if (arr[j] < arrI) {
                p[i] = j;
                result.push(i);
                continue;
            }
            u = 0;
            v = result.length - 1;
            while (u < v) {
                c = (u + v) >> 1;
                if (arr[result[c]] < arrI) {
                    u = c + 1;
                }
                else {
                    v = c;
                }
            }
            if (arrI < arr[result[u]]) {
                if (u > 0) {
                    p[i] = result[u - 1];
                }
                result[u] = i;
            }
        }
    }
    u = result.length;
    v = result[u - 1];
    while (u-- > 0) {
        result[u] = v;
        v = p[v];
    }
    return result;
}

const isTeleport = (type) => type.__isTeleport;
const isTeleportDisabled = (props) => props && (props.disabled || props.disabled === '');
const isTargetSVG = (target) => typeof SVGElement !== 'undefined' && target instanceof SVGElement;
const resolveTarget = (props, select) => {
    const targetSelector = props && props.to;
    if (shared.isString(targetSelector)) {
        if (!select) {
            return null;
        }
        else {
            const target = select(targetSelector);
            return target;
        }
    }
    else {
        return targetSelector;
    }
};
const TeleportImpl = {
    __isTeleport: true,
    process(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized, internals) {
        const { mc: mountChildren, pc: patchChildren, pbc: patchBlockChildren, o: { insert, querySelector, createText, createComment } } = internals;
        const disabled = isTeleportDisabled(n2.props);
        let { shapeFlag, children, dynamicChildren } = n2;
        if (n1 == null) {
            // insert anchors in the main view
            const placeholder = (n2.el = createText(''));
            const mainAnchor = (n2.anchor = createText(''));
            insert(placeholder, container, anchor);
            insert(mainAnchor, container, anchor);
            const target = (n2.target = resolveTarget(n2.props, querySelector));
            const targetAnchor = (n2.targetAnchor = createText(''));
            if (target) {
                insert(targetAnchor, target);
                // #2652 we could be teleporting from a non-SVG tree into an SVG tree
                isSVG = isSVG || isTargetSVG(target);
            }
            const mount = (container, anchor) => {
                // Teleport *always* has Array children. This is enforced in both the
                // compiler and vnode children normalization.
                if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
                    mountChildren(children, container, anchor, parentComponent, parentSuspense, isSVG, slotScopeIds, optimized);
                }
            };
            if (disabled) {
                mount(container, mainAnchor);
            }
            else if (target) {
                mount(target, targetAnchor);
            }
        }
        else {
            // update content
            n2.el = n1.el;
            const mainAnchor = (n2.anchor = n1.anchor);
            const target = (n2.target = n1.target);
            const targetAnchor = (n2.targetAnchor = n1.targetAnchor);
            const wasDisabled = isTeleportDisabled(n1.props);
            const currentContainer = wasDisabled ? container : target;
            const currentAnchor = wasDisabled ? mainAnchor : targetAnchor;
            isSVG = isSVG || isTargetSVG(target);
            if (dynamicChildren) {
                // fast path when the teleport happens to be a block root
                patchBlockChildren(n1.dynamicChildren, dynamicChildren, currentContainer, parentComponent, parentSuspense, isSVG, slotScopeIds);
                // even in block tree mode we need to make sure all root-level nodes
                // in the teleport inherit previous DOM references so that they can
                // be moved in future patches.
                traverseStaticChildren(n1, n2, true);
            }
            else if (!optimized) {
                patchChildren(n1, n2, currentContainer, currentAnchor, parentComponent, parentSuspense, isSVG, slotScopeIds, false);
            }
            if (disabled) {
                if (!wasDisabled) {
                    // enabled -> disabled
                    // move into main container
                    moveTeleport(n2, container, mainAnchor, internals, 1 /* TOGGLE */);
                }
            }
            else {
                // target changed
                if ((n2.props && n2.props.to) !== (n1.props && n1.props.to)) {
                    const nextTarget = (n2.target = resolveTarget(n2.props, querySelector));
                    if (nextTarget) {
                        moveTeleport(n2, nextTarget, null, internals, 0 /* TARGET_CHANGE */);
                    }
                }
                else if (wasDisabled) {
                    // disabled -> enabled
                    // move into teleport target
                    moveTeleport(n2, target, targetAnchor, internals, 1 /* TOGGLE */);
                }
            }
        }
    },
    remove(vnode, parentComponent, parentSuspense, optimized, { um: unmount, o: { remove: hostRemove } }, doRemove) {
        const { shapeFlag, children, anchor, targetAnchor, target, props } = vnode;
        if (target) {
            hostRemove(targetAnchor);
        }
        // an unmounted teleport should always remove its children if not disabled
        if (doRemove || !isTeleportDisabled(props)) {
            hostRemove(anchor);
            if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
                for (let i = 0; i < children.length; i++) {
                    const child = children[i];
                    unmount(child, parentComponent, parentSuspense, true, !!child.dynamicChildren);
                }
            }
        }
    },
    move: moveTeleport,
    hydrate: hydrateTeleport
};
function moveTeleport(vnode, container, parentAnchor, { o: { insert }, m: move }, moveType = 2 /* REORDER */) {
    // move target anchor if this is a target change.
    if (moveType === 0 /* TARGET_CHANGE */) {
        insert(vnode.targetAnchor, container, parentAnchor);
    }
    const { el, anchor, shapeFlag, children, props } = vnode;
    const isReorder = moveType === 2 /* REORDER */;
    // move main view anchor if this is a re-order.
    if (isReorder) {
        insert(el, container, parentAnchor);
    }
    // if this is a re-order and teleport is enabled (content is in target)
    // do not move children. So the opposite is: only move children if this
    // is not a reorder, or the teleport is disabled
    if (!isReorder || isTeleportDisabled(props)) {
        // Teleport has either Array children or no children.
        if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
            for (let i = 0; i < children.length; i++) {
                move(children[i], container, parentAnchor, 2 /* REORDER */);
            }
        }
    }
    // move main view anchor if this is a re-order.
    if (isReorder) {
        insert(anchor, container, parentAnchor);
    }
}
function hydrateTeleport(node, vnode, parentComponent, parentSuspense, slotScopeIds, optimized, { o: { nextSibling, parentNode, querySelector } }, hydrateChildren) {
    const target = (vnode.target = resolveTarget(vnode.props, querySelector));
    if (target) {
        // if multiple teleports rendered to the same target element, we need to
        // pick up from where the last teleport finished instead of the first node
        const targetNode = target._lpa || target.firstChild;
        if (vnode.shapeFlag & 16 /* ARRAY_CHILDREN */) {
            if (isTeleportDisabled(vnode.props)) {
                vnode.anchor = hydrateChildren(nextSibling(node), vnode, parentNode(node), parentComponent, parentSuspense, slotScopeIds, optimized);
                vnode.targetAnchor = targetNode;
            }
            else {
                vnode.anchor = nextSibling(node);
                vnode.targetAnchor = hydrateChildren(targetNode, vnode, target, parentComponent, parentSuspense, slotScopeIds, optimized);
            }
            target._lpa =
                vnode.targetAnchor && nextSibling(vnode.targetAnchor);
        }
    }
    return vnode.anchor && nextSibling(vnode.anchor);
}
// Force-casted public typing for h and TSX props inference
const Teleport = TeleportImpl;

const COMPONENTS = 'components';
const DIRECTIVES = 'directives';
/**
 * @private
 */
function resolveComponent(name, maybeSelfReference) {
    return resolveAsset(COMPONENTS, name, true, maybeSelfReference) || name;
}
const NULL_DYNAMIC_COMPONENT = Symbol();
/**
 * @private
 */
function resolveDynamicComponent(component) {
    if (shared.isString(component)) {
        return resolveAsset(COMPONENTS, component, false) || component;
    }
    else {
        // invalid types will fallthrough to createVNode and raise warning
        return (component || NULL_DYNAMIC_COMPONENT);
    }
}
/**
 * @private
 */
function resolveDirective(name) {
    return resolveAsset(DIRECTIVES, name);
}
// implementation
function resolveAsset(type, name, warnMissing = true, maybeSelfReference = false) {
    const instance = currentRenderingInstance || currentInstance;
    if (instance) {
        const Component = instance.type;
        // explicit self name has highest priority
        if (type === COMPONENTS) {
            const selfName = getComponentName(Component);
            if (selfName &&
                (selfName === name ||
                    selfName === shared.camelize(name) ||
                    selfName === shared.capitalize(shared.camelize(name)))) {
                return Component;
            }
        }
        const res = 
        // local registration
        // check instance[type] first which is resolved for options API
        resolve(instance[type] || Component[type], name) ||
            // global registration
            resolve(instance.appContext[type], name);
        if (!res && maybeSelfReference) {
            // fallback to implicit self-reference
            return Component;
        }
        return res;
    }
}
function resolve(registry, name) {
    return (registry &&
        (registry[name] ||
            registry[shared.camelize(name)] ||
            registry[shared.capitalize(shared.camelize(name))]));
}

const Fragment = Symbol(undefined);
const Text = Symbol(undefined);
const Comment = Symbol(undefined);
const Static = Symbol(undefined);
// Since v-if and v-for are the two possible ways node structure can dynamically
// change, once we consider v-if branches and each v-for fragment a block, we
// can divide a template into nested blocks, and within each block the node
// structure would be stable. This allows us to skip most children diffing
// and only worry about the dynamic nodes (indicated by patch flags).
const blockStack = [];
let currentBlock = null;
/**
 * Open a block.
 * This must be called before `createBlock`. It cannot be part of `createBlock`
 * because the children of the block are evaluated before `createBlock` itself
 * is called. The generated code typically looks like this:
 *
 * ```js
 * function render() {
 *   return (openBlock(),createBlock('div', null, [...]))
 * }
 * ```
 * disableTracking is true when creating a v-for fragment block, since a v-for
 * fragment always diffs its children.
 *
 * @private
 */
function openBlock(disableTracking = false) {
    blockStack.push((currentBlock = disableTracking ? null : []));
}
function closeBlock() {
    blockStack.pop();
    currentBlock = blockStack[blockStack.length - 1] || null;
}
// Whether we should be tracking dynamic child nodes inside a block.
// Only tracks when this value is > 0
// We are not using a simple boolean because this value may need to be
// incremented/decremented by nested usage of v-once (see below)
let isBlockTreeEnabled = 1;
/**
 * Block tracking sometimes needs to be disabled, for example during the
 * creation of a tree that needs to be cached by v-once. The compiler generates
 * code like this:
 *
 * ``` js
 * _cache[1] || (
 *   setBlockTracking(-1),
 *   _cache[1] = createVNode(...),
 *   setBlockTracking(1),
 *   _cache[1]
 * )
 * ```
 *
 * @private
 */
function setBlockTracking(value) {
    isBlockTreeEnabled += value;
}
function setupBlock(vnode) {
    // save current block children on the block vnode
    vnode.dynamicChildren =
        isBlockTreeEnabled > 0 ? currentBlock || shared.EMPTY_ARR : null;
    // close block
    closeBlock();
    // a block is always going to be patched, so track it as a child of its
    // parent block
    if (isBlockTreeEnabled > 0 && currentBlock) {
        currentBlock.push(vnode);
    }
    return vnode;
}
/**
 * @private
 */
function createElementBlock(type, props, children, patchFlag, dynamicProps, shapeFlag) {
    return setupBlock(createBaseVNode(type, props, children, patchFlag, dynamicProps, shapeFlag, true /* isBlock */));
}
/**
 * Create a block root vnode. Takes the same exact arguments as `createVNode`.
 * A block root keeps track of dynamic nodes within the block in the
 * `dynamicChildren` array.
 *
 * @private
 */
function createBlock(type, props, children, patchFlag, dynamicProps) {
    return setupBlock(createVNode(type, props, children, patchFlag, dynamicProps, true /* isBlock: prevent a block from tracking itself */));
}
function isVNode(value) {
    return value ? value.__v_isVNode === true : false;
}
function isSameVNodeType(n1, n2) {
    return n1.type === n2.type && n1.key === n2.key;
}
/**
 * Internal API for registering an arguments transform for createVNode
 * used for creating stubs in the test-utils
 * It is *internal* but needs to be exposed for test-utils to pick up proper
 * typings
 */
function transformVNodeArgs(transformer) {
}
const InternalObjectKey = `__vInternal`;
const normalizeKey = ({ key }) => key != null ? key : null;
const normalizeRef = ({ ref }) => {
    return (ref != null
        ? shared.isString(ref) || reactivity.isRef(ref) || shared.isFunction(ref)
            ? { i: currentRenderingInstance, r: ref }
            : ref
        : null);
};
function createBaseVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, shapeFlag = type === Fragment ? 0 : 1 /* ELEMENT */, isBlockNode = false, needFullChildrenNormalization = false) {
    const vnode = {
        __v_isVNode: true,
        __v_skip: true,
        type,
        props,
        key: props && normalizeKey(props),
        ref: props && normalizeRef(props),
        scopeId: currentScopeId,
        slotScopeIds: null,
        children,
        component: null,
        suspense: null,
        ssContent: null,
        ssFallback: null,
        dirs: null,
        transition: null,
        el: null,
        anchor: null,
        target: null,
        targetAnchor: null,
        staticCount: 0,
        shapeFlag,
        patchFlag,
        dynamicProps,
        dynamicChildren: null,
        appContext: null
    };
    if (needFullChildrenNormalization) {
        normalizeChildren(vnode, children);
        // normalize suspense children
        if (shapeFlag & 128 /* SUSPENSE */) {
            type.normalize(vnode);
        }
    }
    else if (children) {
        // compiled element vnode - if children is passed, only possible types are
        // string or Array.
        vnode.shapeFlag |= shared.isString(children)
            ? 8 /* TEXT_CHILDREN */
            : 16 /* ARRAY_CHILDREN */;
    }
    // track vnode for block tree
    if (isBlockTreeEnabled > 0 &&
        // avoid a block node from tracking itself
        !isBlockNode &&
        // has current parent block
        currentBlock &&
        // presence of a patch flag indicates this node needs patching on updates.
        // component nodes also should always be patched, because even if the
        // component doesn't need to update, it needs to persist the instance on to
        // the next vnode so that it can be properly unmounted later.
        (vnode.patchFlag > 0 || shapeFlag & 6 /* COMPONENT */) &&
        // the EVENTS flag is only for hydration and if it is the only flag, the
        // vnode should not be considered dynamic due to handler caching.
        vnode.patchFlag !== 32 /* HYDRATE_EVENTS */) {
        currentBlock.push(vnode);
    }
    return vnode;
}
const createVNode = (_createVNode);
function _createVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, isBlockNode = false) {
    if (!type || type === NULL_DYNAMIC_COMPONENT) {
        type = Comment;
    }
    if (isVNode(type)) {
        // createVNode receiving an existing vnode. This happens in cases like
        // <component :is="vnode"/>
        // #2078 make sure to merge refs during the clone instead of overwriting it
        const cloned = cloneVNode(type, props, true /* mergeRef: true */);
        if (children) {
            normalizeChildren(cloned, children);
        }
        return cloned;
    }
    // class component normalization.
    if (isClassComponent(type)) {
        type = type.__vccOpts;
    }
    // class & style normalization.
    if (props) {
        // for reactive or proxy objects, we need to clone it to enable mutation.
        props = guardReactiveProps(props);
        let { class: klass, style } = props;
        if (klass && !shared.isString(klass)) {
            props.class = shared.normalizeClass(klass);
        }
        if (shared.isObject(style)) {
            // reactive state objects need to be cloned since they are likely to be
            // mutated
            if (reactivity.isProxy(style) && !shared.isArray(style)) {
                style = shared.extend({}, style);
            }
            props.style = shared.normalizeStyle(style);
        }
    }
    // encode the vnode type information into a bitmap
    const shapeFlag = shared.isString(type)
        ? 1 /* ELEMENT */
        : isSuspense(type)
            ? 128 /* SUSPENSE */
            : isTeleport(type)
                ? 64 /* TELEPORT */
                : shared.isObject(type)
                    ? 4 /* STATEFUL_COMPONENT */
                    : shared.isFunction(type)
                        ? 2 /* FUNCTIONAL_COMPONENT */
                        : 0;
    return createBaseVNode(type, props, children, patchFlag, dynamicProps, shapeFlag, isBlockNode, true);
}
function guardReactiveProps(props) {
    if (!props)
        return null;
    return reactivity.isProxy(props) || InternalObjectKey in props
        ? shared.extend({}, props)
        : props;
}
function cloneVNode(vnode, extraProps, mergeRef = false) {
    // This is intentionally NOT using spread or extend to avoid the runtime
    // key enumeration cost.
    const { props, ref, patchFlag, children } = vnode;
    const mergedProps = extraProps ? mergeProps(props || {}, extraProps) : props;
    const cloned = {
        __v_isVNode: true,
        __v_skip: true,
        type: vnode.type,
        props: mergedProps,
        key: mergedProps && normalizeKey(mergedProps),
        ref: extraProps && extraProps.ref
            ? // #2078 in the case of <component :is="vnode" ref="extra"/>
                // if the vnode itself already has a ref, cloneVNode will need to merge
                // the refs so the single vnode can be set on multiple refs
                mergeRef && ref
                    ? shared.isArray(ref)
                        ? ref.concat(normalizeRef(extraProps))
                        : [ref, normalizeRef(extraProps)]
                    : normalizeRef(extraProps)
            : ref,
        scopeId: vnode.scopeId,
        slotScopeIds: vnode.slotScopeIds,
        children: children,
        target: vnode.target,
        targetAnchor: vnode.targetAnchor,
        staticCount: vnode.staticCount,
        shapeFlag: vnode.shapeFlag,
        // if the vnode is cloned with extra props, we can no longer assume its
        // existing patch flag to be reliable and need to add the FULL_PROPS flag.
        // note: perserve flag for fragments since they use the flag for children
        // fast paths only.
        patchFlag: extraProps && vnode.type !== Fragment
            ? patchFlag === -1 // hoisted node
                ? 16 /* FULL_PROPS */
                : patchFlag | 16 /* FULL_PROPS */
            : patchFlag,
        dynamicProps: vnode.dynamicProps,
        dynamicChildren: vnode.dynamicChildren,
        appContext: vnode.appContext,
        dirs: vnode.dirs,
        transition: vnode.transition,
        // These should technically only be non-null on mounted VNodes. However,
        // they *should* be copied for kept-alive vnodes. So we just always copy
        // them since them being non-null during a mount doesn't affect the logic as
        // they will simply be overwritten.
        component: vnode.component,
        suspense: vnode.suspense,
        ssContent: vnode.ssContent && cloneVNode(vnode.ssContent),
        ssFallback: vnode.ssFallback && cloneVNode(vnode.ssFallback),
        el: vnode.el,
        anchor: vnode.anchor
    };
    return cloned;
}
/**
 * @private
 */
function createTextVNode(text = ' ', flag = 0) {
    return createVNode(Text, null, text, flag);
}
/**
 * @private
 */
function createStaticVNode(content, numberOfNodes) {
    // A static vnode can contain multiple stringified elements, and the number
    // of elements is necessary for hydration.
    const vnode = createVNode(Static, null, content);
    vnode.staticCount = numberOfNodes;
    return vnode;
}
/**
 * @private
 */
function createCommentVNode(text = '', 
// when used as the v-else branch, the comment node must be created as a
// block to ensure correct updates.
asBlock = false) {
    return asBlock
        ? (openBlock(), createBlock(Comment, null, text))
        : createVNode(Comment, null, text);
}
function normalizeVNode(child) {
    if (child == null || typeof child === 'boolean') {
        // empty placeholder
        return createVNode(Comment);
    }
    else if (shared.isArray(child)) {
        // fragment
        return createVNode(Fragment, null, 
        // #3666, avoid reference pollution when reusing vnode
        child.slice());
    }
    else if (typeof child === 'object') {
        // already vnode, this should be the most common since compiled templates
        // always produce all-vnode children arrays
        return cloneIfMounted(child);
    }
    else {
        // strings and numbers
        return createVNode(Text, null, String(child));
    }
}
// optimized normalization for template-compiled render fns
function cloneIfMounted(child) {
    return child.el === null || child.memo ? child : cloneVNode(child);
}
function normalizeChildren(vnode, children) {
    let type = 0;
    const { shapeFlag } = vnode;
    if (children == null) {
        children = null;
    }
    else if (shared.isArray(children)) {
        type = 16 /* ARRAY_CHILDREN */;
    }
    else if (typeof children === 'object') {
        if (shapeFlag & (1 /* ELEMENT */ | 64 /* TELEPORT */)) {
            // Normalize slot to plain children for plain element and Teleport
            const slot = children.default;
            if (slot) {
                // _c marker is added by withCtx() indicating this is a compiled slot
                slot._c && (slot._d = false);
                normalizeChildren(vnode, slot());
                slot._c && (slot._d = true);
            }
            return;
        }
        else {
            type = 32 /* SLOTS_CHILDREN */;
            const slotFlag = children._;
            if (!slotFlag && !(InternalObjectKey in children)) {
                children._ctx = currentRenderingInstance;
            }
            else if (slotFlag === 3 /* FORWARDED */ && currentRenderingInstance) {
                // a child component receives forwarded slots from the parent.
                // its slot type is determined by its parent's slot type.
                if (currentRenderingInstance.slots._ === 1 /* STABLE */) {
                    children._ = 1 /* STABLE */;
                }
                else {
                    children._ = 2 /* DYNAMIC */;
                    vnode.patchFlag |= 1024 /* DYNAMIC_SLOTS */;
                }
            }
        }
    }
    else if (shared.isFunction(children)) {
        children = { default: children, _ctx: currentRenderingInstance };
        type = 32 /* SLOTS_CHILDREN */;
    }
    else {
        children = String(children);
        // force teleport children to array so it can be moved around
        if (shapeFlag & 64 /* TELEPORT */) {
            type = 16 /* ARRAY_CHILDREN */;
            children = [createTextVNode(children)];
        }
        else {
            type = 8 /* TEXT_CHILDREN */;
        }
    }
    vnode.children = children;
    vnode.shapeFlag |= type;
}
function mergeProps(...args) {
    const ret = {};
    for (let i = 0; i < args.length; i++) {
        const toMerge = args[i];
        for (const key in toMerge) {
            if (key === 'class') {
                if (ret.class !== toMerge.class) {
                    ret.class = shared.normalizeClass([ret.class, toMerge.class]);
                }
            }
            else if (key === 'style') {
                ret.style = shared.normalizeStyle([ret.style, toMerge.style]);
            }
            else if (shared.isOn(key)) {
                const existing = ret[key];
                const incoming = toMerge[key];
                if (existing !== incoming) {
                    ret[key] = existing
                        ? [].concat(existing, incoming)
                        : incoming;
                }
            }
            else if (key !== '') {
                ret[key] = toMerge[key];
            }
        }
    }
    return ret;
}

/**
 * Actual implementation
 */
function renderList(source, renderItem, cache, index) {
    let ret;
    const cached = (cache && cache[index]);
    if (shared.isArray(source) || shared.isString(source)) {
        ret = new Array(source.length);
        for (let i = 0, l = source.length; i < l; i++) {
            ret[i] = renderItem(source[i], i, undefined, cached && cached[i]);
        }
    }
    else if (typeof source === 'number') {
        ret = new Array(source);
        for (let i = 0; i < source; i++) {
            ret[i] = renderItem(i + 1, i, undefined, cached && cached[i]);
        }
    }
    else if (shared.isObject(source)) {
        if (source[Symbol.iterator]) {
            ret = Array.from(source, (item, i) => renderItem(item, i, undefined, cached && cached[i]));
        }
        else {
            const keys = Object.keys(source);
            ret = new Array(keys.length);
            for (let i = 0, l = keys.length; i < l; i++) {
                const key = keys[i];
                ret[i] = renderItem(source[key], key, i, cached && cached[i]);
            }
        }
    }
    else {
        ret = [];
    }
    if (cache) {
        cache[index] = ret;
    }
    return ret;
}

/**
 * Compiler runtime helper for creating dynamic slots object
 * @private
 */
function createSlots(slots, dynamicSlots) {
    for (let i = 0; i < dynamicSlots.length; i++) {
        const slot = dynamicSlots[i];
        // array of dynamic slot generated by <template v-for="..." #[...]>
        if (shared.isArray(slot)) {
            for (let j = 0; j < slot.length; j++) {
                slots[slot[j].name] = slot[j].fn;
            }
        }
        else if (slot) {
            // conditional single slot generated by <template v-if="..." #foo>
            slots[slot.name] = slot.fn;
        }
    }
    return slots;
}

/**
 * Compiler runtime helper for rendering `<slot/>`
 * @private
 */
function renderSlot(slots, name, props = {}, 
// this is not a user-facing function, so the fallback is always generated by
// the compiler and guaranteed to be a function returning an array
fallback, noSlotted) {
    if (currentRenderingInstance.isCE) {
        return createVNode('slot', name === 'default' ? null : { name }, fallback && fallback());
    }
    let slot = slots[name];
    // a compiled slot disables block tracking by default to avoid manual
    // invocation interfering with template-based block tracking, but in
    // `renderSlot` we can be sure that it's template-based so we can force
    // enable it.
    if (slot && slot._c) {
        slot._d = false;
    }
    openBlock();
    const validSlotContent = slot && ensureValidVNode(slot(props));
    const rendered = createBlock(Fragment, { key: props.key || `_${name}` }, validSlotContent || (fallback ? fallback() : []), validSlotContent && slots._ === 1 /* STABLE */
        ? 64 /* STABLE_FRAGMENT */
        : -2 /* BAIL */);
    if (!noSlotted && rendered.scopeId) {
        rendered.slotScopeIds = [rendered.scopeId + '-s'];
    }
    if (slot && slot._c) {
        slot._d = true;
    }
    return rendered;
}
function ensureValidVNode(vnodes) {
    return vnodes.some(child => {
        if (!isVNode(child))
            return true;
        if (child.type === Comment)
            return false;
        if (child.type === Fragment &&
            !ensureValidVNode(child.children))
            return false;
        return true;
    })
        ? vnodes
        : null;
}

/**
 * For prefixing keys in v-on="obj" with "on"
 * @private
 */
function toHandlers(obj) {
    const ret = {};
    for (const key in obj) {
        ret[shared.toHandlerKey(key)] = obj[key];
    }
    return ret;
}

/**
 * #2437 In Vue 3, functional components do not have a public instance proxy but
 * they exist in the internal parent chain. For code that relies on traversing
 * public $parent chains, skip functional ones and go to the parent instead.
 */
const getPublicInstance = (i) => {
    if (!i)
        return null;
    if (isStatefulComponent(i))
        return getExposeProxy(i) || i.proxy;
    return getPublicInstance(i.parent);
};
const publicPropertiesMap = shared.extend(Object.create(null), {
    $: i => i,
    $el: i => i.vnode.el,
    $data: i => i.data,
    $props: i => (i.props),
    $attrs: i => (i.attrs),
    $slots: i => (i.slots),
    $refs: i => (i.refs),
    $parent: i => getPublicInstance(i.parent),
    $root: i => getPublicInstance(i.root),
    $emit: i => i.emit,
    $options: i => (resolveMergedOptions(i) ),
    $forceUpdate: i => () => queueJob(i.update),
    $nextTick: i => nextTick.bind(i.proxy),
    $watch: i => (instanceWatch.bind(i) )
});
const PublicInstanceProxyHandlers = {
    get({ _: instance }, key) {
        const { ctx, setupState, data, props, accessCache, type, appContext } = instance;
        // data / props / ctx
        // This getter gets called for every property access on the render context
        // during render and is a major hotspot. The most expensive part of this
        // is the multiple hasOwn() calls. It's much faster to do a simple property
        // access on a plain object, so we use an accessCache object (with null
        // prototype) to memoize what access type a key corresponds to.
        let normalizedProps;
        if (key[0] !== '$') {
            const n = accessCache[key];
            if (n !== undefined) {
                switch (n) {
                    case 0 /* SETUP */:
                        return setupState[key];
                    case 1 /* DATA */:
                        return data[key];
                    case 3 /* CONTEXT */:
                        return ctx[key];
                    case 2 /* PROPS */:
                        return props[key];
                    // default: just fallthrough
                }
            }
            else if (setupState !== shared.EMPTY_OBJ && shared.hasOwn(setupState, key)) {
                accessCache[key] = 0 /* SETUP */;
                return setupState[key];
            }
            else if (data !== shared.EMPTY_OBJ && shared.hasOwn(data, key)) {
                accessCache[key] = 1 /* DATA */;
                return data[key];
            }
            else if (
            // only cache other properties when instance has declared (thus stable)
            // props
            (normalizedProps = instance.propsOptions[0]) &&
                shared.hasOwn(normalizedProps, key)) {
                accessCache[key] = 2 /* PROPS */;
                return props[key];
            }
            else if (ctx !== shared.EMPTY_OBJ && shared.hasOwn(ctx, key)) {
                accessCache[key] = 3 /* CONTEXT */;
                return ctx[key];
            }
            else if (shouldCacheAccess) {
                accessCache[key] = 4 /* OTHER */;
            }
        }
        const publicGetter = publicPropertiesMap[key];
        let cssModule, globalProperties;
        // public $xxx properties
        if (publicGetter) {
            if (key === '$attrs') {
                reactivity.track(instance, "get" /* GET */, key);
            }
            return publicGetter(instance);
        }
        else if (
        // css module (injected by vue-loader)
        (cssModule = type.__cssModules) &&
            (cssModule = cssModule[key])) {
            return cssModule;
        }
        else if (ctx !== shared.EMPTY_OBJ && shared.hasOwn(ctx, key)) {
            // user may set custom properties to `this` that start with `$`
            accessCache[key] = 3 /* CONTEXT */;
            return ctx[key];
        }
        else if (
        // global properties
        ((globalProperties = appContext.config.globalProperties),
            shared.hasOwn(globalProperties, key))) {
            {
                return globalProperties[key];
            }
        }
        else ;
    },
    set({ _: instance }, key, value) {
        const { data, setupState, ctx } = instance;
        if (setupState !== shared.EMPTY_OBJ && shared.hasOwn(setupState, key)) {
            setupState[key] = value;
        }
        else if (data !== shared.EMPTY_OBJ && shared.hasOwn(data, key)) {
            data[key] = value;
        }
        else if (shared.hasOwn(instance.props, key)) {
            return false;
        }
        if (key[0] === '$' && key.slice(1) in instance) {
            return false;
        }
        else {
            {
                ctx[key] = value;
            }
        }
        return true;
    },
    has({ _: { data, setupState, accessCache, ctx, appContext, propsOptions } }, key) {
        let normalizedProps;
        return (accessCache[key] !== undefined ||
            (data !== shared.EMPTY_OBJ && shared.hasOwn(data, key)) ||
            (setupState !== shared.EMPTY_OBJ && shared.hasOwn(setupState, key)) ||
            ((normalizedProps = propsOptions[0]) && shared.hasOwn(normalizedProps, key)) ||
            shared.hasOwn(ctx, key) ||
            shared.hasOwn(publicPropertiesMap, key) ||
            shared.hasOwn(appContext.config.globalProperties, key));
    }
};
const RuntimeCompiledPublicInstanceProxyHandlers = /*#__PURE__*/ shared.extend({}, PublicInstanceProxyHandlers, {
    get(target, key) {
        // fast path for unscopables when using `with` block
        if (key === Symbol.unscopables) {
            return;
        }
        return PublicInstanceProxyHandlers.get(target, key, target);
    },
    has(_, key) {
        const has = key[0] !== '_' && !shared.isGloballyWhitelisted(key);
        return has;
    }
});

const emptyAppContext = createAppContext();
let uid$1 = 0;
function createComponentInstance(vnode, parent, suspense) {
    const type = vnode.type;
    // inherit parent app context - or - if root, adopt from root vnode
    const appContext = (parent ? parent.appContext : vnode.appContext) || emptyAppContext;
    const instance = {
        uid: uid$1++,
        vnode,
        type,
        parent,
        appContext,
        root: null,
        next: null,
        subTree: null,
        update: null,
        scope: new reactivity.EffectScope(true /* detached */),
        render: null,
        proxy: null,
        exposed: null,
        exposeProxy: null,
        withProxy: null,
        provides: parent ? parent.provides : Object.create(appContext.provides),
        accessCache: null,
        renderCache: [],
        // local resovled assets
        components: null,
        directives: null,
        // resolved props and emits options
        propsOptions: normalizePropsOptions(type, appContext),
        emitsOptions: normalizeEmitsOptions(type, appContext),
        // emit
        emit: null,
        emitted: null,
        // props default value
        propsDefaults: shared.EMPTY_OBJ,
        // inheritAttrs
        inheritAttrs: type.inheritAttrs,
        // state
        ctx: shared.EMPTY_OBJ,
        data: shared.EMPTY_OBJ,
        props: shared.EMPTY_OBJ,
        attrs: shared.EMPTY_OBJ,
        slots: shared.EMPTY_OBJ,
        refs: shared.EMPTY_OBJ,
        setupState: shared.EMPTY_OBJ,
        setupContext: null,
        // suspense related
        suspense,
        suspenseId: suspense ? suspense.pendingId : 0,
        asyncDep: null,
        asyncResolved: false,
        // lifecycle hooks
        // not using enums here because it results in computed properties
        isMounted: false,
        isUnmounted: false,
        isDeactivated: false,
        bc: null,
        c: null,
        bm: null,
        m: null,
        bu: null,
        u: null,
        um: null,
        bum: null,
        da: null,
        a: null,
        rtg: null,
        rtc: null,
        ec: null,
        sp: null
    };
    {
        instance.ctx = { _: instance };
    }
    instance.root = parent ? parent.root : instance;
    instance.emit = emit.bind(null, instance);
    // apply custom element special handling
    if (vnode.ce) {
        vnode.ce(instance);
    }
    return instance;
}
let currentInstance = null;
const getCurrentInstance = () => currentInstance || currentRenderingInstance;
const setCurrentInstance = (instance) => {
    currentInstance = instance;
    instance.scope.on();
};
const unsetCurrentInstance = () => {
    currentInstance && currentInstance.scope.off();
    currentInstance = null;
};
function isStatefulComponent(instance) {
    return instance.vnode.shapeFlag & 4 /* STATEFUL_COMPONENT */;
}
let isInSSRComponentSetup = false;
function setupComponent(instance, isSSR = false) {
    isInSSRComponentSetup = isSSR;
    const { props, children } = instance.vnode;
    const isStateful = isStatefulComponent(instance);
    initProps(instance, props, isStateful, isSSR);
    initSlots(instance, children);
    const setupResult = isStateful
        ? setupStatefulComponent(instance, isSSR)
        : undefined;
    isInSSRComponentSetup = false;
    return setupResult;
}
function setupStatefulComponent(instance, isSSR) {
    const Component = instance.type;
    // 0. create render proxy property access cache
    instance.accessCache = Object.create(null);
    // 1. create public instance / render proxy
    // also mark it raw so it's never observed
    instance.proxy = reactivity.markRaw(new Proxy(instance.ctx, PublicInstanceProxyHandlers));
    // 2. call setup()
    const { setup } = Component;
    if (setup) {
        const setupContext = (instance.setupContext =
            setup.length > 1 ? createSetupContext(instance) : null);
        setCurrentInstance(instance);
        reactivity.pauseTracking();
        const setupResult = callWithErrorHandling(setup, instance, 0 /* SETUP_FUNCTION */, [instance.props, setupContext]);
        reactivity.resetTracking();
        unsetCurrentInstance();
        if (shared.isPromise(setupResult)) {
            setupResult.then(unsetCurrentInstance, unsetCurrentInstance);
            if (isSSR) {
                // return the promise so server-renderer can wait on it
                return setupResult
                    .then((resolvedResult) => {
                    handleSetupResult(instance, resolvedResult, isSSR);
                })
                    .catch(e => {
                    handleError(e, instance, 0 /* SETUP_FUNCTION */);
                });
            }
            else {
                // async setup returned Promise.
                // bail here and wait for re-entry.
                instance.asyncDep = setupResult;
            }
        }
        else {
            handleSetupResult(instance, setupResult, isSSR);
        }
    }
    else {
        finishComponentSetup(instance, isSSR);
    }
}
function handleSetupResult(instance, setupResult, isSSR) {
    if (shared.isFunction(setupResult)) {
        // setup returned an inline render function
        if (instance.type.__ssrInlineRender) {
            // when the function's name is `ssrRender` (compiled by SFC inline mode),
            // set it as ssrRender instead.
            instance.ssrRender = setupResult;
        }
        else {
            instance.render = setupResult;
        }
    }
    else if (shared.isObject(setupResult)) {
        instance.setupState = reactivity.proxyRefs(setupResult);
    }
    else ;
    finishComponentSetup(instance, isSSR);
}
let compile;
let installWithProxy;
/**
 * For runtime-dom to register the compiler.
 * Note the exported method uses any to avoid d.ts relying on the compiler types.
 */
function registerRuntimeCompiler(_compile) {
    compile = _compile;
    installWithProxy = i => {
        if (i.render._rc) {
            i.withProxy = new Proxy(i.ctx, RuntimeCompiledPublicInstanceProxyHandlers);
        }
    };
}
// dev only
const isRuntimeOnly = () => !compile;
function finishComponentSetup(instance, isSSR, skipOptions) {
    const Component = instance.type;
    // template / render function normalization
    if (isSSR) {
        // 1. the render function may already exist, returned by `setup`
        // 2. otherwise try to use the `Component.render`
        // 3. if the component doesn't have a render function,
        //    set `instance.render` to NOOP so that it can inherit the render
        //    function from mixins/extend
        instance.render = (instance.render ||
            Component.render ||
            shared.NOOP);
    }
    else if (!instance.render) {
        // could be set from setup()
        if (compile && !Component.render) {
            const template = Component.template;
            if (template) {
                const { isCustomElement, compilerOptions } = instance.appContext.config;
                const { delimiters, compilerOptions: componentCompilerOptions } = Component;
                const finalCompilerOptions = shared.extend(shared.extend({
                    isCustomElement,
                    delimiters
                }, compilerOptions), componentCompilerOptions);
                Component.render = compile(template, finalCompilerOptions);
            }
        }
        instance.render = (Component.render || shared.NOOP);
        // for runtime-compiled render functions using `with` blocks, the render
        // proxy used needs a different `has` handler which is more performant and
        // also only allows a whitelist of globals to fallthrough.
        if (installWithProxy) {
            installWithProxy(instance);
        }
    }
    // support for 2.x options
    {
        setCurrentInstance(instance);
        reactivity.pauseTracking();
        applyOptions(instance);
        reactivity.resetTracking();
        unsetCurrentInstance();
    }
}
function createAttrsProxy(instance) {
    return new Proxy(instance.attrs, {
            get(target, key) {
                reactivity.track(instance, "get" /* GET */, '$attrs');
                return target[key];
            }
        });
}
function createSetupContext(instance) {
    const expose = exposed => {
        instance.exposed = exposed || {};
    };
    let attrs;
    {
        return {
            get attrs() {
                return attrs || (attrs = createAttrsProxy(instance));
            },
            slots: instance.slots,
            emit: instance.emit,
            expose
        };
    }
}
function getExposeProxy(instance) {
    if (instance.exposed) {
        return (instance.exposeProxy ||
            (instance.exposeProxy = new Proxy(reactivity.proxyRefs(reactivity.markRaw(instance.exposed)), {
                get(target, key) {
                    if (key in target) {
                        return target[key];
                    }
                    else if (key in publicPropertiesMap) {
                        return publicPropertiesMap[key](instance);
                    }
                }
            })));
    }
}
const classifyRE = /(?:^|[-_])(\w)/g;
const classify = (str) => str.replace(classifyRE, c => c.toUpperCase()).replace(/[-_]/g, '');
function getComponentName(Component) {
    return shared.isFunction(Component)
        ? Component.displayName || Component.name
        : Component.name;
}
/* istanbul ignore next */
function formatComponentName(instance, Component, isRoot = false) {
    let name = getComponentName(Component);
    if (!name && Component.__file) {
        const match = Component.__file.match(/([^/\\]+)\.\w+$/);
        if (match) {
            name = match[1];
        }
    }
    if (!name && instance && instance.parent) {
        // try to infer the name based on reverse resolution
        const inferFromRegistry = (registry) => {
            for (const key in registry) {
                if (registry[key] === Component) {
                    return key;
                }
            }
        };
        name =
            inferFromRegistry(instance.components ||
                instance.parent.type.components) || inferFromRegistry(instance.appContext.components);
    }
    return name ? classify(name) : isRoot ? `App` : `Anonymous`;
}
function isClassComponent(value) {
    return shared.isFunction(value) && '__vccOpts' in value;
}

const stack = [];
function warn(msg, ...args) {
    // avoid props formatting or warn handler tracking deps that might be mutated
    // during patch, leading to infinite recursion.
    reactivity.pauseTracking();
    const instance = stack.length ? stack[stack.length - 1].component : null;
    const appWarnHandler = instance && instance.appContext.config.warnHandler;
    const trace = getComponentTrace();
    if (appWarnHandler) {
        callWithErrorHandling(appWarnHandler, instance, 11 /* APP_WARN_HANDLER */, [
            msg + args.join(''),
            instance && instance.proxy,
            trace
                .map(({ vnode }) => `at <${formatComponentName(instance, vnode.type)}>`)
                .join('\n'),
            trace
        ]);
    }
    else {
        const warnArgs = [`[Vue warn]: ${msg}`, ...args];
        /* istanbul ignore if */
        if (trace.length &&
            // avoid spamming console during tests
            !false) {
            warnArgs.push(`\n`, ...formatTrace(trace));
        }
        console.warn(...warnArgs);
    }
    reactivity.resetTracking();
}
function getComponentTrace() {
    let currentVNode = stack[stack.length - 1];
    if (!currentVNode) {
        return [];
    }
    // we can't just use the stack because it will be incomplete during updates
    // that did not start from the root. Re-construct the parent chain using
    // instance parent pointers.
    const normalizedStack = [];
    while (currentVNode) {
        const last = normalizedStack[0];
        if (last && last.vnode === currentVNode) {
            last.recurseCount++;
        }
        else {
            normalizedStack.push({
                vnode: currentVNode,
                recurseCount: 0
            });
        }
        const parentInstance = currentVNode.component && currentVNode.component.parent;
        currentVNode = parentInstance && parentInstance.vnode;
    }
    return normalizedStack;
}
/* istanbul ignore next */
function formatTrace(trace) {
    const logs = [];
    trace.forEach((entry, i) => {
        logs.push(...(i === 0 ? [] : [`\n`]), ...formatTraceEntry(entry));
    });
    return logs;
}
function formatTraceEntry({ vnode, recurseCount }) {
    const postfix = recurseCount > 0 ? `... (${recurseCount} recursive calls)` : ``;
    const isRoot = vnode.component ? vnode.component.parent == null : false;
    const open = ` at <${formatComponentName(vnode.component, vnode.type, isRoot)}`;
    const close = `>` + postfix;
    return vnode.props
        ? [open, ...formatProps(vnode.props), close]
        : [open + close];
}
/* istanbul ignore next */
function formatProps(props) {
    const res = [];
    const keys = Object.keys(props);
    keys.slice(0, 3).forEach(key => {
        res.push(...formatProp(key, props[key]));
    });
    if (keys.length > 3) {
        res.push(` ...`);
    }
    return res;
}
/* istanbul ignore next */
function formatProp(key, value, raw) {
    if (shared.isString(value)) {
        value = JSON.stringify(value);
        return raw ? value : [`${key}=${value}`];
    }
    else if (typeof value === 'number' ||
        typeof value === 'boolean' ||
        value == null) {
        return raw ? value : [`${key}=${value}`];
    }
    else if (reactivity.isRef(value)) {
        value = formatProp(key, reactivity.toRaw(value.value), true);
        return raw ? value : [`${key}=Ref<`, value, `>`];
    }
    else if (shared.isFunction(value)) {
        return [`${key}=fn${value.name ? `<${value.name}>` : ``}`];
    }
    else {
        value = reactivity.toRaw(value);
        return raw ? value : [`${key}=`, value];
    }
}

function callWithErrorHandling(fn, instance, type, args) {
    let res;
    try {
        res = args ? fn(...args) : fn();
    }
    catch (err) {
        handleError(err, instance, type);
    }
    return res;
}
function callWithAsyncErrorHandling(fn, instance, type, args) {
    if (shared.isFunction(fn)) {
        const res = callWithErrorHandling(fn, instance, type, args);
        if (res && shared.isPromise(res)) {
            res.catch(err => {
                handleError(err, instance, type);
            });
        }
        return res;
    }
    const values = [];
    for (let i = 0; i < fn.length; i++) {
        values.push(callWithAsyncErrorHandling(fn[i], instance, type, args));
    }
    return values;
}
function handleError(err, instance, type, throwInDev = true) {
    const contextVNode = instance ? instance.vnode : null;
    if (instance) {
        let cur = instance.parent;
        // the exposed instance is the render proxy to keep it consistent with 2.x
        const exposedInstance = instance.proxy;
        // in production the hook receives only the error code
        const errorInfo = type;
        while (cur) {
            const errorCapturedHooks = cur.ec;
            if (errorCapturedHooks) {
                for (let i = 0; i < errorCapturedHooks.length; i++) {
                    if (errorCapturedHooks[i](err, exposedInstance, errorInfo) === false) {
                        return;
                    }
                }
            }
            cur = cur.parent;
        }
        // app-level handling
        const appErrorHandler = instance.appContext.config.errorHandler;
        if (appErrorHandler) {
            callWithErrorHandling(appErrorHandler, null, 10 /* APP_ERROR_HANDLER */, [err, exposedInstance, errorInfo]);
            return;
        }
    }
    logError(err, type, contextVNode, throwInDev);
}
function logError(err, type, contextVNode, throwInDev = true) {
    {
        // recover in prod to reduce the impact on end-user
        console.error(err);
    }
}

let isFlushing = false;
let isFlushPending = false;
const queue = [];
let flushIndex = 0;
const pendingPreFlushCbs = [];
let activePreFlushCbs = null;
let preFlushIndex = 0;
const pendingPostFlushCbs = [];
let activePostFlushCbs = null;
let postFlushIndex = 0;
const resolvedPromise = Promise.resolve();
let currentFlushPromise = null;
let currentPreFlushParentJob = null;
const RECURSION_LIMIT = 100;
function nextTick(fn) {
    const p = currentFlushPromise || resolvedPromise;
    return fn ? p.then(this ? fn.bind(this) : fn) : p;
}
// #2768
// Use binary-search to find a suitable position in the queue,
// so that the queue maintains the increasing order of job's id,
// which can prevent the job from being skipped and also can avoid repeated patching.
function findInsertionIndex(id) {
    // the start index should be `flushIndex + 1`
    let start = flushIndex + 1;
    let end = queue.length;
    while (start < end) {
        const middle = (start + end) >>> 1;
        const middleJobId = getId(queue[middle]);
        middleJobId < id ? (start = middle + 1) : (end = middle);
    }
    return start;
}
function queueJob(job) {
    // the dedupe search uses the startIndex argument of Array.includes()
    // by default the search index includes the current job that is being run
    // so it cannot recursively trigger itself again.
    // if the job is a watch() callback, the search will start with a +1 index to
    // allow it recursively trigger itself - it is the user's responsibility to
    // ensure it doesn't end up in an infinite loop.
    if ((!queue.length ||
        !queue.includes(job, isFlushing && job.allowRecurse ? flushIndex + 1 : flushIndex)) &&
        job !== currentPreFlushParentJob) {
        if (job.id == null) {
            queue.push(job);
        }
        else {
            queue.splice(findInsertionIndex(job.id), 0, job);
        }
        queueFlush();
    }
}
function queueFlush() {
    if (!isFlushing && !isFlushPending) {
        isFlushPending = true;
        currentFlushPromise = resolvedPromise.then(flushJobs);
    }
}
function invalidateJob(job) {
    const i = queue.indexOf(job);
    if (i > flushIndex) {
        queue.splice(i, 1);
    }
}
function queueCb(cb, activeQueue, pendingQueue, index) {
    if (!shared.isArray(cb)) {
        if (!activeQueue ||
            !activeQueue.includes(cb, cb.allowRecurse ? index + 1 : index)) {
            pendingQueue.push(cb);
        }
    }
    else {
        // if cb is an array, it is a component lifecycle hook which can only be
        // triggered by a job, which is already deduped in the main queue, so
        // we can skip duplicate check here to improve perf
        pendingQueue.push(...cb);
    }
    queueFlush();
}
function queuePreFlushCb(cb) {
    queueCb(cb, activePreFlushCbs, pendingPreFlushCbs, preFlushIndex);
}
function queuePostFlushCb(cb) {
    queueCb(cb, activePostFlushCbs, pendingPostFlushCbs, postFlushIndex);
}
function flushPreFlushCbs(seen, parentJob = null) {
    if (pendingPreFlushCbs.length) {
        currentPreFlushParentJob = parentJob;
        activePreFlushCbs = [...new Set(pendingPreFlushCbs)];
        pendingPreFlushCbs.length = 0;
        for (preFlushIndex = 0; preFlushIndex < activePreFlushCbs.length; preFlushIndex++) {
            activePreFlushCbs[preFlushIndex]();
        }
        activePreFlushCbs = null;
        preFlushIndex = 0;
        currentPreFlushParentJob = null;
        // recursively flush until it drains
        flushPreFlushCbs(seen, parentJob);
    }
}
function flushPostFlushCbs(seen) {
    if (pendingPostFlushCbs.length) {
        const deduped = [...new Set(pendingPostFlushCbs)];
        pendingPostFlushCbs.length = 0;
        // #1947 already has active queue, nested flushPostFlushCbs call
        if (activePostFlushCbs) {
            activePostFlushCbs.push(...deduped);
            return;
        }
        activePostFlushCbs = deduped;
        activePostFlushCbs.sort((a, b) => getId(a) - getId(b));
        for (postFlushIndex = 0; postFlushIndex < activePostFlushCbs.length; postFlushIndex++) {
            activePostFlushCbs[postFlushIndex]();
        }
        activePostFlushCbs = null;
        postFlushIndex = 0;
    }
}
const getId = (job) => job.id == null ? Infinity : job.id;
function flushJobs(seen) {
    isFlushPending = false;
    isFlushing = true;
    flushPreFlushCbs(seen);
    // Sort queue before flush.
    // This ensures that:
    // 1. Components are updated from parent to child. (because parent is always
    //    created before the child so its render effect will have smaller
    //    priority number)
    // 2. If a component is unmounted during a parent component's update,
    //    its update can be skipped.
    queue.sort((a, b) => getId(a) - getId(b));
    try {
        for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
            const job = queue[flushIndex];
            if (job && job.active !== false) {
                if (false) {}
                // console.log(`running:`, job.id)
                callWithErrorHandling(job, null, 14 /* SCHEDULER */);
            }
        }
    }
    finally {
        flushIndex = 0;
        queue.length = 0;
        flushPostFlushCbs();
        isFlushing = false;
        currentFlushPromise = null;
        // some postFlushCb queued jobs!
        // keep flushing until it drains.
        if (queue.length ||
            pendingPreFlushCbs.length ||
            pendingPostFlushCbs.length) {
            flushJobs(seen);
        }
    }
}
function checkRecursiveUpdates(seen, fn) {
    if (!seen.has(fn)) {
        seen.set(fn, 1);
    }
    else {
        const count = seen.get(fn);
        if (count > RECURSION_LIMIT) {
            const instance = fn.ownerInstance;
            const componentName = instance && getComponentName(instance.type);
            warn(`Maximum recursive updates exceeded${componentName ? ` in component <${componentName}>` : ``}. ` +
                `This means you have a reactive effect that is mutating its own ` +
                `dependencies and thus recursively triggering itself. Possible sources ` +
                `include component template, render function, updated hook or ` +
                `watcher source function.`);
            return true;
        }
        else {
            seen.set(fn, count + 1);
        }
    }
}

// Simple effect.
function watchEffect(effect, options) {
    return doWatch(effect, null, options);
}
function watchPostEffect(effect, options) {
    return doWatch(effect, null, ({ flush: 'post' }));
}
function watchSyncEffect(effect, options) {
    return doWatch(effect, null, ({ flush: 'sync' }));
}
// initial value for watchers to trigger on undefined initial values
const INITIAL_WATCHER_VALUE = {};
// implementation
function watch(source, cb, options) {
    return doWatch(source, cb, options);
}
function doWatch(source, cb, { immediate, deep, flush, onTrack, onTrigger } = shared.EMPTY_OBJ) {
    const instance = currentInstance;
    let getter;
    let forceTrigger = false;
    let isMultiSource = false;
    if (reactivity.isRef(source)) {
        getter = () => source.value;
        forceTrigger = !!source._shallow;
    }
    else if (reactivity.isReactive(source)) {
        getter = () => source;
        deep = true;
    }
    else if (shared.isArray(source)) {
        isMultiSource = true;
        forceTrigger = source.some(reactivity.isReactive);
        getter = () => source.map(s => {
            if (reactivity.isRef(s)) {
                return s.value;
            }
            else if (reactivity.isReactive(s)) {
                return traverse(s);
            }
            else if (shared.isFunction(s)) {
                return callWithErrorHandling(s, instance, 2 /* WATCH_GETTER */);
            }
            else ;
        });
    }
    else if (shared.isFunction(source)) {
        if (cb) {
            // getter with cb
            getter = () => callWithErrorHandling(source, instance, 2 /* WATCH_GETTER */);
        }
        else {
            // no cb -> simple effect
            getter = () => {
                if (instance && instance.isUnmounted) {
                    return;
                }
                if (cleanup) {
                    cleanup();
                }
                return callWithAsyncErrorHandling(source, instance, 3 /* WATCH_CALLBACK */, [onInvalidate]);
            };
        }
    }
    else {
        getter = shared.NOOP;
    }
    if (cb && deep) {
        const baseGetter = getter;
        getter = () => traverse(baseGetter());
    }
    let cleanup;
    let onInvalidate = (fn) => {
        cleanup = effect.onStop = () => {
            callWithErrorHandling(fn, instance, 4 /* WATCH_CLEANUP */);
        };
    };
    // in SSR there is no need to setup an actual effect, and it should be noop
    // unless it's eager
    if (isInSSRComponentSetup) {
        // we will also not call the invalidate callback (+ runner is not set up)
        onInvalidate = shared.NOOP;
        if (!cb) {
            getter();
        }
        else if (immediate) {
            callWithAsyncErrorHandling(cb, instance, 3 /* WATCH_CALLBACK */, [
                getter(),
                isMultiSource ? [] : undefined,
                onInvalidate
            ]);
        }
        return shared.NOOP;
    }
    let oldValue = isMultiSource ? [] : INITIAL_WATCHER_VALUE;
    const job = () => {
        if (!effect.active) {
            return;
        }
        if (cb) {
            // watch(source, cb)
            const newValue = effect.run();
            if (deep ||
                forceTrigger ||
                (isMultiSource
                    ? newValue.some((v, i) => shared.hasChanged(v, oldValue[i]))
                    : shared.hasChanged(newValue, oldValue)) ||
                (false  )) {
                // cleanup before running cb again
                if (cleanup) {
                    cleanup();
                }
                callWithAsyncErrorHandling(cb, instance, 3 /* WATCH_CALLBACK */, [
                    newValue,
                    // pass undefined as the old value when it's changed for the first time
                    oldValue === INITIAL_WATCHER_VALUE ? undefined : oldValue,
                    onInvalidate
                ]);
                oldValue = newValue;
            }
        }
        else {
            // watchEffect
            effect.run();
        }
    };
    // important: mark the job as a watcher callback so that scheduler knows
    // it is allowed to self-trigger (#1727)
    job.allowRecurse = !!cb;
    let scheduler;
    if (flush === 'sync') {
        scheduler = job; // the scheduler function gets called directly
    }
    else if (flush === 'post') {
        scheduler = () => queuePostRenderEffect(job, instance && instance.suspense);
    }
    else {
        // default: 'pre'
        scheduler = () => {
            if (!instance || instance.isMounted) {
                queuePreFlushCb(job);
            }
            else {
                // with 'pre' option, the first call must happen before
                // the component is mounted so it is called synchronously.
                job();
            }
        };
    }
    const effect = new reactivity.ReactiveEffect(getter, scheduler);
    // initial run
    if (cb) {
        if (immediate) {
            job();
        }
        else {
            oldValue = effect.run();
        }
    }
    else if (flush === 'post') {
        queuePostRenderEffect(effect.run.bind(effect), instance && instance.suspense);
    }
    else {
        effect.run();
    }
    return () => {
        effect.stop();
        if (instance && instance.scope) {
            shared.remove(instance.scope.effects, effect);
        }
    };
}
// this.$watch
function instanceWatch(source, value, options) {
    const publicThis = this.proxy;
    const getter = shared.isString(source)
        ? source.includes('.')
            ? createPathGetter(publicThis, source)
            : () => publicThis[source]
        : source.bind(publicThis, publicThis);
    let cb;
    if (shared.isFunction(value)) {
        cb = value;
    }
    else {
        cb = value.handler;
        options = value;
    }
    const cur = currentInstance;
    setCurrentInstance(this);
    const res = doWatch(getter, cb.bind(publicThis), options);
    if (cur) {
        setCurrentInstance(cur);
    }
    else {
        unsetCurrentInstance();
    }
    return res;
}
function createPathGetter(ctx, path) {
    const segments = path.split('.');
    return () => {
        let cur = ctx;
        for (let i = 0; i < segments.length && cur; i++) {
            cur = cur[segments[i]];
        }
        return cur;
    };
}
function traverse(value, seen = new Set()) {
    if (!shared.isObject(value) || value["__v_skip" /* SKIP */]) {
        return value;
    }
    seen = seen || new Set();
    if (seen.has(value)) {
        return value;
    }
    seen.add(value);
    if (reactivity.isRef(value)) {
        traverse(value.value, seen);
    }
    else if (shared.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            traverse(value[i], seen);
        }
    }
    else if (shared.isSet(value) || shared.isMap(value)) {
        value.forEach((v) => {
            traverse(v, seen);
        });
    }
    else if (shared.isPlainObject(value)) {
        for (const key in value) {
            traverse(value[key], seen);
        }
    }
    return value;
}

const isFunction = (val) => typeof val === 'function';
const isObject = (val) => val !== null && typeof val === 'object';
const isPromise = (val) => {
    return isObject(val) && isFunction(val.then) && isFunction(val.catch);
};

// implementation
function defineProps() {
    return null;
}
// implementation
function defineEmits() {
    return null;
}
/**
 * Vue `<script setup>` compiler macro for declaring a component's exposed
 * instance properties when it is accessed by a parent component via template
 * refs.
 *
 * `<script setup>` components are closed by default - i.e. varaibles inside
 * the `<script setup>` scope is not exposed to parent unless explicitly exposed
 * via `defineExpose`.
 *
 * This is only usable inside `<script setup>`, is compiled away in the
 * output and should **not** be actually called at runtime.
 */
function defineExpose(exposed) {
}
/**
 * Vue `<script setup>` compiler macro for providing props default values when
 * using type-based `defineProps` declaration.
 *
 * Example usage:
 * ```ts
 * withDefaults(defineProps<{
 *   size?: number
 *   labels?: string[]
 * }>(), {
 *   size: 3,
 *   labels: () => ['default label']
 * })
 * ```
 *
 * This is only usable inside `<script setup>`, is compiled away in the output
 * and should **not** be actually called at runtime.
 */
function withDefaults(props, defaults) {
    return null;
}
function useSlots() {
    return getContext().slots;
}
function useAttrs() {
    return getContext().attrs;
}
function getContext() {
    const i = getCurrentInstance();
    return i.setupContext || (i.setupContext = createSetupContext(i));
}
/**
 * Runtime helper for merging default declarations. Imported by compiled code
 * only.
 * @internal
 */
function mergeDefaults(
// the base props is compiler-generated and guaranteed to be in this shape.
props, defaults) {
    for (const key in defaults) {
        const val = props[key];
        if (val) {
            val.default = defaults[key];
        }
        else if (val === null) {
            props[key] = { default: defaults[key] };
        }
        else ;
    }
    return props;
}
/**
 * `<script setup>` helper for persisting the current instance context over
 * async/await flows.
 *
 * `@vue/compiler-sfc` converts the following:
 *
 * ```ts
 * const x = await foo()
 * ```
 *
 * into:
 *
 * ```ts
 * let __temp, __restore
 * const x = (([__temp, __restore] = withAsyncContext(() => foo())),__temp=await __temp,__restore(),__temp)
 * ```
 * @internal
 */
function withAsyncContext(getAwaitable) {
    const ctx = getCurrentInstance();
    let awaitable = getAwaitable();
    unsetCurrentInstance();
    if (isPromise(awaitable)) {
        awaitable = awaitable.catch(e => {
            setCurrentInstance(ctx);
            throw e;
        });
    }
    return [awaitable, () => setCurrentInstance(ctx)];
}

// Actual implementation
function h(type, propsOrChildren, children) {
    const l = arguments.length;
    if (l === 2) {
        if (shared.isObject(propsOrChildren) && !shared.isArray(propsOrChildren)) {
            // single vnode without props
            if (isVNode(propsOrChildren)) {
                return createVNode(type, null, [propsOrChildren]);
            }
            // props without children
            return createVNode(type, propsOrChildren);
        }
        else {
            // omit props
            return createVNode(type, null, propsOrChildren);
        }
    }
    else {
        if (l > 3) {
            children = Array.prototype.slice.call(arguments, 2);
        }
        else if (l === 3 && isVNode(children)) {
            children = [children];
        }
        return createVNode(type, propsOrChildren, children);
    }
}

const ssrContextKey = Symbol(``);
const useSSRContext = () => {
    {
        const ctx = inject(ssrContextKey);
        if (!ctx) {
            warn(`Server rendering context not provided. Make sure to only call ` +
                `useSSRContext() conditionally in the server build.`);
        }
        return ctx;
    }
};

function initCustomFormatter() {
    /* eslint-disable no-restricted-globals */
    {
        return;
    }
}

function withMemo(memo, render, cache, index) {
    const cached = cache[index];
    if (cached && isMemoSame(cached, memo)) {
        return cached;
    }
    const ret = render();
    // shallow clone
    ret.memo = memo.slice();
    return (cache[index] = ret);
}
function isMemoSame(cached, memo) {
    const prev = cached.memo;
    if (prev.length != memo.length) {
        return false;
    }
    for (let i = 0; i < prev.length; i++) {
        if (prev[i] !== memo[i]) {
            return false;
        }
    }
    // make sure to let parent block track it when returning cached
    if (isBlockTreeEnabled > 0 && currentBlock) {
        currentBlock.push(cached);
    }
    return true;
}

// Core API ------------------------------------------------------------------
const version = "3.2.10";
const _ssrUtils = {
    createComponentInstance,
    setupComponent,
    renderComponentRoot,
    setCurrentRenderingInstance,
    isVNode,
    normalizeVNode
};
/**
 * SSR utils for \@vue/server-renderer. Only exposed in cjs builds.
 * @internal
 */
const ssrUtils = (_ssrUtils );
/**
 * @internal only exposed in compat builds
 */
const resolveFilter = null;
/**
 * @internal only exposed in compat builds.
 */
const compatUtils = (null);

exports.EffectScope = reactivity.EffectScope;
exports.ReactiveEffect = reactivity.ReactiveEffect;
exports.computed = reactivity.computed;
exports.customRef = reactivity.customRef;
exports.effect = reactivity.effect;
exports.effectScope = reactivity.effectScope;
exports.getCurrentScope = reactivity.getCurrentScope;
exports.isProxy = reactivity.isProxy;
exports.isReactive = reactivity.isReactive;
exports.isReadonly = reactivity.isReadonly;
exports.isRef = reactivity.isRef;
exports.markRaw = reactivity.markRaw;
exports.onScopeDispose = reactivity.onScopeDispose;
exports.proxyRefs = reactivity.proxyRefs;
exports.reactive = reactivity.reactive;
exports.readonly = reactivity.readonly;
exports.ref = reactivity.ref;
exports.shallowReactive = reactivity.shallowReactive;
exports.shallowReadonly = reactivity.shallowReadonly;
exports.shallowRef = reactivity.shallowRef;
exports.stop = reactivity.stop;
exports.toRaw = reactivity.toRaw;
exports.toRef = reactivity.toRef;
exports.toRefs = reactivity.toRefs;
exports.triggerRef = reactivity.triggerRef;
exports.unref = reactivity.unref;
exports.camelize = shared.camelize;
exports.capitalize = shared.capitalize;
exports.normalizeClass = shared.normalizeClass;
exports.normalizeProps = shared.normalizeProps;
exports.normalizeStyle = shared.normalizeStyle;
exports.toDisplayString = shared.toDisplayString;
exports.toHandlerKey = shared.toHandlerKey;
exports.BaseTransition = BaseTransition;
exports.Comment = Comment;
exports.Fragment = Fragment;
exports.KeepAlive = KeepAlive;
exports.Static = Static;
exports.Suspense = Suspense;
exports.Teleport = Teleport;
exports.Text = Text;
exports.callWithAsyncErrorHandling = callWithAsyncErrorHandling;
exports.callWithErrorHandling = callWithErrorHandling;
exports.cloneVNode = cloneVNode;
exports.compatUtils = compatUtils;
exports.createBlock = createBlock;
exports.createCommentVNode = createCommentVNode;
exports.createElementBlock = createElementBlock;
exports.createElementVNode = createBaseVNode;
exports.createHydrationRenderer = createHydrationRenderer;
exports.createRenderer = createRenderer;
exports.createSlots = createSlots;
exports.createStaticVNode = createStaticVNode;
exports.createTextVNode = createTextVNode;
exports.createVNode = createVNode;
exports.defineAsyncComponent = defineAsyncComponent;
exports.defineComponent = defineComponent;
exports.defineEmits = defineEmits;
exports.defineExpose = defineExpose;
exports.defineProps = defineProps;
exports.getCurrentInstance = getCurrentInstance;
exports.getTransitionRawChildren = getTransitionRawChildren;
exports.guardReactiveProps = guardReactiveProps;
exports.h = h;
exports.handleError = handleError;
exports.initCustomFormatter = initCustomFormatter;
exports.inject = inject;
exports.isMemoSame = isMemoSame;
exports.isRuntimeOnly = isRuntimeOnly;
exports.isVNode = isVNode;
exports.mergeDefaults = mergeDefaults;
exports.mergeProps = mergeProps;
exports.nextTick = nextTick;
exports.onActivated = onActivated;
exports.onBeforeMount = onBeforeMount;
exports.onBeforeUnmount = onBeforeUnmount;
exports.onBeforeUpdate = onBeforeUpdate;
exports.onDeactivated = onDeactivated;
exports.onErrorCaptured = onErrorCaptured;
exports.onMounted = onMounted;
exports.onRenderTracked = onRenderTracked;
exports.onRenderTriggered = onRenderTriggered;
exports.onServerPrefetch = onServerPrefetch;
exports.onUnmounted = onUnmounted;
exports.onUpdated = onUpdated;
exports.openBlock = openBlock;
exports.popScopeId = popScopeId;
exports.provide = provide;
exports.pushScopeId = pushScopeId;
exports.queuePostFlushCb = queuePostFlushCb;
exports.registerRuntimeCompiler = registerRuntimeCompiler;
exports.renderList = renderList;
exports.renderSlot = renderSlot;
exports.resolveComponent = resolveComponent;
exports.resolveDirective = resolveDirective;
exports.resolveDynamicComponent = resolveDynamicComponent;
exports.resolveFilter = resolveFilter;
exports.resolveTransitionHooks = resolveTransitionHooks;
exports.setBlockTracking = setBlockTracking;
exports.setDevtoolsHook = setDevtoolsHook;
exports.setTransitionHooks = setTransitionHooks;
exports.ssrContextKey = ssrContextKey;
exports.ssrUtils = ssrUtils;
exports.toHandlers = toHandlers;
exports.transformVNodeArgs = transformVNodeArgs;
exports.useAttrs = useAttrs;
exports.useSSRContext = useSSRContext;
exports.useSlots = useSlots;
exports.useTransitionState = useTransitionState;
exports.version = version;
exports.warn = warn;
exports.watch = watch;
exports.watchEffect = watchEffect;
exports.watchPostEffect = watchPostEffect;
exports.watchSyncEffect = watchSyncEffect;
exports.withAsyncContext = withAsyncContext;
exports.withCtx = withCtx;
exports.withDefaults = withDefaults;
exports.withDirectives = withDirectives;
exports.withMemo = withMemo;
exports.withScopeId = withScopeId;


/***/ }),

/***/ 3561:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


if (true) {
  module.exports = __webpack_require__(6447)
} else {}


/***/ }),

/***/ 4577:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", ({ value: true }));

var runtimeCore = __webpack_require__(3561);
var shared = __webpack_require__(9109);

const svgNS = 'http://www.w3.org/2000/svg';
const doc = (typeof document !== 'undefined' ? document : null);
const staticTemplateCache = new Map();
const nodeOps = {
    insert: (child, parent, anchor) => {
        parent.insertBefore(child, anchor || null);
    },
    remove: child => {
        const parent = child.parentNode;
        if (parent) {
            parent.removeChild(child);
        }
    },
    createElement: (tag, isSVG, is, props) => {
        const el = isSVG
            ? doc.createElementNS(svgNS, tag)
            : doc.createElement(tag, is ? { is } : undefined);
        if (tag === 'select' && props && props.multiple != null) {
            el.setAttribute('multiple', props.multiple);
        }
        return el;
    },
    createText: text => doc.createTextNode(text),
    createComment: text => doc.createComment(text),
    setText: (node, text) => {
        node.nodeValue = text;
    },
    setElementText: (el, text) => {
        el.textContent = text;
    },
    parentNode: node => node.parentNode,
    nextSibling: node => node.nextSibling,
    querySelector: selector => doc.querySelector(selector),
    setScopeId(el, id) {
        el.setAttribute(id, '');
    },
    cloneNode(el) {
        const cloned = el.cloneNode(true);
        // #3072
        // - in `patchDOMProp`, we store the actual value in the `el._value` property.
        // - normally, elements using `:value` bindings will not be hoisted, but if
        //   the bound value is a constant, e.g. `:value="true"` - they do get
        //   hoisted.
        // - in production, hoisted nodes are cloned when subsequent inserts, but
        //   cloneNode() does not copy the custom property we attached.
        // - This may need to account for other custom DOM properties we attach to
        //   elements in addition to `_value` in the future.
        if (`_value` in el) {
            cloned._value = el._value;
        }
        return cloned;
    },
    // __UNSAFE__
    // Reason: innerHTML.
    // Static content here can only come from compiled templates.
    // As long as the user only uses trusted templates, this is safe.
    insertStaticContent(content, parent, anchor, isSVG) {
        // <parent> before | first ... last | anchor </parent>
        const before = anchor ? anchor.previousSibling : parent.lastChild;
        let template = staticTemplateCache.get(content);
        if (!template) {
            const t = doc.createElement('template');
            t.innerHTML = isSVG ? `<svg>${content}</svg>` : content;
            template = t.content;
            if (isSVG) {
                // remove outer svg wrapper
                const wrapper = template.firstChild;
                while (wrapper.firstChild) {
                    template.appendChild(wrapper.firstChild);
                }
                template.removeChild(wrapper);
            }
            staticTemplateCache.set(content, template);
        }
        parent.insertBefore(template.cloneNode(true), anchor);
        return [
            // first
            before ? before.nextSibling : parent.firstChild,
            // last
            anchor ? anchor.previousSibling : parent.lastChild
        ];
    }
};

// compiler should normalize class + :class bindings on the same element
// into a single binding ['staticClass', dynamic]
function patchClass(el, value, isSVG) {
    // directly setting className should be faster than setAttribute in theory
    // if this is an element during a transition, take the temporary transition
    // classes into account.
    const transitionClasses = el._vtc;
    if (transitionClasses) {
        value = (value ? [value, ...transitionClasses] : [...transitionClasses]).join(' ');
    }
    if (value == null) {
        el.removeAttribute('class');
    }
    else if (isSVG) {
        el.setAttribute('class', value);
    }
    else {
        el.className = value;
    }
}

function patchStyle(el, prev, next) {
    const style = el.style;
    const currentDisplay = style.display;
    if (!next) {
        el.removeAttribute('style');
    }
    else if (shared.isString(next)) {
        if (prev !== next) {
            style.cssText = next;
        }
    }
    else {
        for (const key in next) {
            setStyle(style, key, next[key]);
        }
        if (prev && !shared.isString(prev)) {
            for (const key in prev) {
                if (next[key] == null) {
                    setStyle(style, key, '');
                }
            }
        }
    }
    // indicates that the `display` of the element is controlled by `v-show`,
    // so we always keep the current `display` value regardless of the `style` value,
    // thus handing over control to `v-show`.
    if ('_vod' in el) {
        style.display = currentDisplay;
    }
}
const importantRE = /\s*!important$/;
function setStyle(style, name, val) {
    if (shared.isArray(val)) {
        val.forEach(v => setStyle(style, name, v));
    }
    else {
        if (name.startsWith('--')) {
            // custom property definition
            style.setProperty(name, val);
        }
        else {
            const prefixed = autoPrefix(style, name);
            if (importantRE.test(val)) {
                // !important
                style.setProperty(shared.hyphenate(prefixed), val.replace(importantRE, ''), 'important');
            }
            else {
                style[prefixed] = val;
            }
        }
    }
}
const prefixes = ['Webkit', 'Moz', 'ms'];
const prefixCache = {};
function autoPrefix(style, rawName) {
    const cached = prefixCache[rawName];
    if (cached) {
        return cached;
    }
    let name = runtimeCore.camelize(rawName);
    if (name !== 'filter' && name in style) {
        return (prefixCache[rawName] = name);
    }
    name = shared.capitalize(name);
    for (let i = 0; i < prefixes.length; i++) {
        const prefixed = prefixes[i] + name;
        if (prefixed in style) {
            return (prefixCache[rawName] = prefixed);
        }
    }
    return rawName;
}

const xlinkNS = 'http://www.w3.org/1999/xlink';
function patchAttr(el, key, value, isSVG, instance) {
    if (isSVG && key.startsWith('xlink:')) {
        if (value == null) {
            el.removeAttributeNS(xlinkNS, key.slice(6, key.length));
        }
        else {
            el.setAttributeNS(xlinkNS, key, value);
        }
    }
    else {
        // note we are only checking boolean attributes that don't have a
        // corresponding dom prop of the same name here.
        const isBoolean = shared.isSpecialBooleanAttr(key);
        if (value == null || (isBoolean && !shared.includeBooleanAttr(value))) {
            el.removeAttribute(key);
        }
        else {
            el.setAttribute(key, isBoolean ? '' : value);
        }
    }
}

// __UNSAFE__
// functions. The user is responsible for using them with only trusted content.
function patchDOMProp(el, key, value, 
// the following args are passed only due to potential innerHTML/textContent
// overriding existing VNodes, in which case the old tree must be properly
// unmounted.
prevChildren, parentComponent, parentSuspense, unmountChildren) {
    if (key === 'innerHTML' || key === 'textContent') {
        if (prevChildren) {
            unmountChildren(prevChildren, parentComponent, parentSuspense);
        }
        el[key] = value == null ? '' : value;
        return;
    }
    if (key === 'value' && el.tagName !== 'PROGRESS') {
        // store value as _value as well since
        // non-string values will be stringified.
        el._value = value;
        const newValue = value == null ? '' : value;
        if (el.value !== newValue) {
            el.value = newValue;
        }
        if (value == null) {
            el.removeAttribute(key);
        }
        return;
    }
    if (value === '' || value == null) {
        const type = typeof el[key];
        if (type === 'boolean') {
            // e.g. <select multiple> compiles to { multiple: '' }
            el[key] = shared.includeBooleanAttr(value);
            return;
        }
        else if (value == null && type === 'string') {
            // e.g. <div :id="null">
            el[key] = '';
            el.removeAttribute(key);
            return;
        }
        else if (type === 'number') {
            // e.g. <img :width="null">
            // the value of some IDL attr must be greater than 0, e.g. input.size = 0 -> error
            try {
                el[key] = 0;
            }
            catch (_a) { }
            el.removeAttribute(key);
            return;
        }
    }
    // some properties perform value validation and throw
    try {
        el[key] = value;
    }
    catch (e) {
    }
}

// Async edge case fix requires storing an event listener's attach timestamp.
let _getNow = Date.now;
let skipTimestampCheck = false;
if (typeof window !== 'undefined') {
    // Determine what event timestamp the browser is using. Annoyingly, the
    // timestamp can either be hi-res (relative to page load) or low-res
    // (relative to UNIX epoch), so in order to compare time we have to use the
    // same timestamp type when saving the flush timestamp.
    if (_getNow() > document.createEvent('Event').timeStamp) {
        // if the low-res timestamp which is bigger than the event timestamp
        // (which is evaluated AFTER) it means the event is using a hi-res timestamp,
        // and we need to use the hi-res version for event listeners as well.
        _getNow = () => performance.now();
    }
    // #3485: Firefox <= 53 has incorrect Event.timeStamp implementation
    // and does not fire microtasks in between event propagation, so safe to exclude.
    const ffMatch = navigator.userAgent.match(/firefox\/(\d+)/i);
    skipTimestampCheck = !!(ffMatch && Number(ffMatch[1]) <= 53);
}
// To avoid the overhead of repeatedly calling performance.now(), we cache
// and use the same timestamp for all event listeners attached in the same tick.
let cachedNow = 0;
const p = Promise.resolve();
const reset = () => {
    cachedNow = 0;
};
const getNow = () => cachedNow || (p.then(reset), (cachedNow = _getNow()));
function addEventListener(el, event, handler, options) {
    el.addEventListener(event, handler, options);
}
function removeEventListener(el, event, handler, options) {
    el.removeEventListener(event, handler, options);
}
function patchEvent(el, rawName, prevValue, nextValue, instance = null) {
    // vei = vue event invokers
    const invokers = el._vei || (el._vei = {});
    const existingInvoker = invokers[rawName];
    if (nextValue && existingInvoker) {
        // patch
        existingInvoker.value = nextValue;
    }
    else {
        const [name, options] = parseName(rawName);
        if (nextValue) {
            // add
            const invoker = (invokers[rawName] = createInvoker(nextValue, instance));
            addEventListener(el, name, invoker, options);
        }
        else if (existingInvoker) {
            // remove
            removeEventListener(el, name, existingInvoker, options);
            invokers[rawName] = undefined;
        }
    }
}
const optionsModifierRE = /(?:Once|Passive|Capture)$/;
function parseName(name) {
    let options;
    if (optionsModifierRE.test(name)) {
        options = {};
        let m;
        while ((m = name.match(optionsModifierRE))) {
            name = name.slice(0, name.length - m[0].length);
            options[m[0].toLowerCase()] = true;
        }
    }
    return [shared.hyphenate(name.slice(2)), options];
}
function createInvoker(initialValue, instance) {
    const invoker = (e) => {
        // async edge case #6566: inner click event triggers patch, event handler
        // attached to outer element during patch, and triggered again. This
        // happens because browsers fire microtask ticks between event propagation.
        // the solution is simple: we save the timestamp when a handler is attached,
        // and the handler would only fire if the event passed to it was fired
        // AFTER it was attached.
        const timeStamp = e.timeStamp || _getNow();
        if (skipTimestampCheck || timeStamp >= invoker.attached - 1) {
            runtimeCore.callWithAsyncErrorHandling(patchStopImmediatePropagation(e, invoker.value), instance, 5 /* NATIVE_EVENT_HANDLER */, [e]);
        }
    };
    invoker.value = initialValue;
    invoker.attached = getNow();
    return invoker;
}
function patchStopImmediatePropagation(e, value) {
    if (shared.isArray(value)) {
        const originalStop = e.stopImmediatePropagation;
        e.stopImmediatePropagation = () => {
            originalStop.call(e);
            e._stopped = true;
        };
        return value.map(fn => (e) => !e._stopped && fn(e));
    }
    else {
        return value;
    }
}

const nativeOnRE = /^on[a-z]/;
const patchProp = (el, key, prevValue, nextValue, isSVG = false, prevChildren, parentComponent, parentSuspense, unmountChildren) => {
    if (key === 'class') {
        patchClass(el, nextValue, isSVG);
    }
    else if (key === 'style') {
        patchStyle(el, prevValue, nextValue);
    }
    else if (shared.isOn(key)) {
        // ignore v-model listeners
        if (!shared.isModelListener(key)) {
            patchEvent(el, key, prevValue, nextValue, parentComponent);
        }
    }
    else if (key[0] === '.'
        ? ((key = key.slice(1)), true)
        : key[0] === '^'
            ? ((key = key.slice(1)), false)
            : shouldSetAsProp(el, key, nextValue, isSVG)) {
        patchDOMProp(el, key, nextValue, prevChildren, parentComponent, parentSuspense, unmountChildren);
    }
    else {
        // special case for <input v-model type="checkbox"> with
        // :true-value & :false-value
        // store value as dom properties since non-string values will be
        // stringified.
        if (key === 'true-value') {
            el._trueValue = nextValue;
        }
        else if (key === 'false-value') {
            el._falseValue = nextValue;
        }
        patchAttr(el, key, nextValue, isSVG);
    }
};
function shouldSetAsProp(el, key, value, isSVG) {
    if (isSVG) {
        // most keys must be set as attribute on svg elements to work
        // ...except innerHTML & textContent
        if (key === 'innerHTML' || key === 'textContent') {
            return true;
        }
        // or native onclick with function values
        if (key in el && nativeOnRE.test(key) && shared.isFunction(value)) {
            return true;
        }
        return false;
    }
    // spellcheck and draggable are numerated attrs, however their
    // corresponding DOM properties are actually booleans - this leads to
    // setting it with a string "false" value leading it to be coerced to
    // `true`, so we need to always treat them as attributes.
    // Note that `contentEditable` doesn't have this problem: its DOM
    // property is also enumerated string values.
    if (key === 'spellcheck' || key === 'draggable') {
        return false;
    }
    // #1787, #2840 form property on form elements is readonly and must be set as
    // attribute.
    if (key === 'form') {
        return false;
    }
    // #1526 <input list> must be set as attribute
    if (key === 'list' && el.tagName === 'INPUT') {
        return false;
    }
    // #2766 <textarea type> must be set as attribute
    if (key === 'type' && el.tagName === 'TEXTAREA') {
        return false;
    }
    // native onclick with string value, must be set as attribute
    if (nativeOnRE.test(key) && shared.isString(value)) {
        return false;
    }
    return key in el;
}

function defineCustomElement(options, hydate) {
    const Comp = runtimeCore.defineComponent(options);
    class VueCustomElement extends VueElement {
        constructor(initialProps) {
            super(Comp, initialProps, hydate);
        }
    }
    VueCustomElement.def = Comp;
    return VueCustomElement;
}
const defineSSRCustomElement = ((options) => {
    // @ts-ignore
    return defineCustomElement(options, hydrate);
});
const BaseClass = (typeof HTMLElement !== 'undefined' ? HTMLElement : class {
});
class VueElement extends BaseClass {
    constructor(_def, _props = {}, hydrate) {
        super();
        this._def = _def;
        this._props = _props;
        /**
         * @internal
         */
        this._instance = null;
        this._connected = false;
        this._resolved = false;
        if (this.shadowRoot && hydrate) {
            hydrate(this._createVNode(), this.shadowRoot);
        }
        else {
            this.attachShadow({ mode: 'open' });
        }
        // set initial attrs
        for (let i = 0; i < this.attributes.length; i++) {
            this._setAttr(this.attributes[i].name);
        }
        // watch future attr changes
        const observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                this._setAttr(m.attributeName);
            }
        });
        observer.observe(this, { attributes: true });
    }
    connectedCallback() {
        this._connected = true;
        if (!this._instance) {
            this._resolveDef();
            render(this._createVNode(), this.shadowRoot);
        }
    }
    disconnectedCallback() {
        this._connected = false;
        runtimeCore.nextTick(() => {
            if (!this._connected) {
                render(null, this.shadowRoot);
                this._instance = null;
            }
        });
    }
    /**
     * resolve inner component definition (handle possible async component)
     */
    _resolveDef() {
        if (this._resolved) {
            return;
        }
        const resolve = (def) => {
            this._resolved = true;
            // check if there are props set pre-upgrade or connect
            for (const key of Object.keys(this)) {
                if (key[0] !== '_') {
                    this._setProp(key, this[key]);
                }
            }
            const { props, styles } = def;
            // defining getter/setters on prototype
            const rawKeys = props ? (shared.isArray(props) ? props : Object.keys(props)) : [];
            for (const key of rawKeys.map(shared.camelize)) {
                Object.defineProperty(this, key, {
                    get() {
                        return this._getProp(key);
                    },
                    set(val) {
                        this._setProp(key, val);
                    }
                });
            }
            this._applyStyles(styles);
        };
        const asyncDef = this._def.__asyncLoader;
        if (asyncDef) {
            asyncDef().then(resolve);
        }
        else {
            resolve(this._def);
        }
    }
    _setAttr(key) {
        this._setProp(shared.camelize(key), shared.toNumber(this.getAttribute(key)), false);
    }
    /**
     * @internal
     */
    _getProp(key) {
        return this._props[key];
    }
    /**
     * @internal
     */
    _setProp(key, val, shouldReflect = true) {
        if (val !== this._props[key]) {
            this._props[key] = val;
            if (this._instance) {
                render(this._createVNode(), this.shadowRoot);
            }
            // reflect
            if (shouldReflect) {
                if (val === true) {
                    this.setAttribute(shared.hyphenate(key), '');
                }
                else if (typeof val === 'string' || typeof val === 'number') {
                    this.setAttribute(shared.hyphenate(key), val + '');
                }
                else if (!val) {
                    this.removeAttribute(shared.hyphenate(key));
                }
            }
        }
    }
    _createVNode() {
        const vnode = runtimeCore.createVNode(this._def, shared.extend({}, this._props));
        if (!this._instance) {
            vnode.ce = instance => {
                this._instance = instance;
                instance.isCE = true;
                // intercept emit
                instance.emit = (event, ...args) => {
                    this.dispatchEvent(new CustomEvent(event, {
                        detail: args
                    }));
                };
                // locate nearest Vue custom element parent for provide/inject
                let parent = this;
                while ((parent =
                    parent && (parent.parentNode || parent.host))) {
                    if (parent instanceof VueElement) {
                        instance.parent = parent._instance;
                        break;
                    }
                }
            };
        }
        return vnode;
    }
    _applyStyles(styles) {
        if (styles) {
            styles.forEach(css => {
                const s = document.createElement('style');
                s.textContent = css;
                this.shadowRoot.appendChild(s);
            });
        }
    }
}

function useCssModule(name = '$style') {
    /* istanbul ignore else */
    {
        const instance = runtimeCore.getCurrentInstance();
        if (!instance) {
            return shared.EMPTY_OBJ;
        }
        const modules = instance.type.__cssModules;
        if (!modules) {
            return shared.EMPTY_OBJ;
        }
        const mod = modules[name];
        if (!mod) {
            return shared.EMPTY_OBJ;
        }
        return mod;
    }
}

/**
 * Runtime helper for SFC's CSS variable injection feature.
 * @private
 */
function useCssVars(getter) {
    return;
}

const TRANSITION = 'transition';
const ANIMATION = 'animation';
// DOM Transition is a higher-order-component based on the platform-agnostic
// base Transition component, with DOM-specific logic.
const Transition = (props, { slots }) => runtimeCore.h(runtimeCore.BaseTransition, resolveTransitionProps(props), slots);
Transition.displayName = 'Transition';
const DOMTransitionPropsValidators = {
    name: String,
    type: String,
    css: {
        type: Boolean,
        default: true
    },
    duration: [String, Number, Object],
    enterFromClass: String,
    enterActiveClass: String,
    enterToClass: String,
    appearFromClass: String,
    appearActiveClass: String,
    appearToClass: String,
    leaveFromClass: String,
    leaveActiveClass: String,
    leaveToClass: String
};
const TransitionPropsValidators = (Transition.props =
    /*#__PURE__*/ shared.extend({}, runtimeCore.BaseTransition.props, DOMTransitionPropsValidators));
/**
 * #3227 Incoming hooks may be merged into arrays when wrapping Transition
 * with custom HOCs.
 */
const callHook = (hook, args = []) => {
    if (shared.isArray(hook)) {
        hook.forEach(h => h(...args));
    }
    else if (hook) {
        hook(...args);
    }
};
/**
 * Check if a hook expects a callback (2nd arg), which means the user
 * intends to explicitly control the end of the transition.
 */
const hasExplicitCallback = (hook) => {
    return hook
        ? shared.isArray(hook)
            ? hook.some(h => h.length > 1)
            : hook.length > 1
        : false;
};
function resolveTransitionProps(rawProps) {
    const baseProps = {};
    for (const key in rawProps) {
        if (!(key in DOMTransitionPropsValidators)) {
            baseProps[key] = rawProps[key];
        }
    }
    if (rawProps.css === false) {
        return baseProps;
    }
    const { name = 'v', type, duration, enterFromClass = `${name}-enter-from`, enterActiveClass = `${name}-enter-active`, enterToClass = `${name}-enter-to`, appearFromClass = enterFromClass, appearActiveClass = enterActiveClass, appearToClass = enterToClass, leaveFromClass = `${name}-leave-from`, leaveActiveClass = `${name}-leave-active`, leaveToClass = `${name}-leave-to` } = rawProps;
    const durations = normalizeDuration(duration);
    const enterDuration = durations && durations[0];
    const leaveDuration = durations && durations[1];
    const { onBeforeEnter, onEnter, onEnterCancelled, onLeave, onLeaveCancelled, onBeforeAppear = onBeforeEnter, onAppear = onEnter, onAppearCancelled = onEnterCancelled } = baseProps;
    const finishEnter = (el, isAppear, done) => {
        removeTransitionClass(el, isAppear ? appearToClass : enterToClass);
        removeTransitionClass(el, isAppear ? appearActiveClass : enterActiveClass);
        done && done();
    };
    const finishLeave = (el, done) => {
        removeTransitionClass(el, leaveToClass);
        removeTransitionClass(el, leaveActiveClass);
        done && done();
    };
    const makeEnterHook = (isAppear) => {
        return (el, done) => {
            const hook = isAppear ? onAppear : onEnter;
            const resolve = () => finishEnter(el, isAppear, done);
            callHook(hook, [el, resolve]);
            nextFrame(() => {
                removeTransitionClass(el, isAppear ? appearFromClass : enterFromClass);
                addTransitionClass(el, isAppear ? appearToClass : enterToClass);
                if (!hasExplicitCallback(hook)) {
                    whenTransitionEnds(el, type, enterDuration, resolve);
                }
            });
        };
    };
    return shared.extend(baseProps, {
        onBeforeEnter(el) {
            callHook(onBeforeEnter, [el]);
            addTransitionClass(el, enterFromClass);
            addTransitionClass(el, enterActiveClass);
        },
        onBeforeAppear(el) {
            callHook(onBeforeAppear, [el]);
            addTransitionClass(el, appearFromClass);
            addTransitionClass(el, appearActiveClass);
        },
        onEnter: makeEnterHook(false),
        onAppear: makeEnterHook(true),
        onLeave(el, done) {
            const resolve = () => finishLeave(el, done);
            addTransitionClass(el, leaveFromClass);
            // force reflow so *-leave-from classes immediately take effect (#2593)
            forceReflow();
            addTransitionClass(el, leaveActiveClass);
            nextFrame(() => {
                removeTransitionClass(el, leaveFromClass);
                addTransitionClass(el, leaveToClass);
                if (!hasExplicitCallback(onLeave)) {
                    whenTransitionEnds(el, type, leaveDuration, resolve);
                }
            });
            callHook(onLeave, [el, resolve]);
        },
        onEnterCancelled(el) {
            finishEnter(el, false);
            callHook(onEnterCancelled, [el]);
        },
        onAppearCancelled(el) {
            finishEnter(el, true);
            callHook(onAppearCancelled, [el]);
        },
        onLeaveCancelled(el) {
            finishLeave(el);
            callHook(onLeaveCancelled, [el]);
        }
    });
}
function normalizeDuration(duration) {
    if (duration == null) {
        return null;
    }
    else if (shared.isObject(duration)) {
        return [NumberOf(duration.enter), NumberOf(duration.leave)];
    }
    else {
        const n = NumberOf(duration);
        return [n, n];
    }
}
function NumberOf(val) {
    const res = shared.toNumber(val);
    return res;
}
function addTransitionClass(el, cls) {
    cls.split(/\s+/).forEach(c => c && el.classList.add(c));
    (el._vtc ||
        (el._vtc = new Set())).add(cls);
}
function removeTransitionClass(el, cls) {
    cls.split(/\s+/).forEach(c => c && el.classList.remove(c));
    const { _vtc } = el;
    if (_vtc) {
        _vtc.delete(cls);
        if (!_vtc.size) {
            el._vtc = undefined;
        }
    }
}
function nextFrame(cb) {
    requestAnimationFrame(() => {
        requestAnimationFrame(cb);
    });
}
let endId = 0;
function whenTransitionEnds(el, expectedType, explicitTimeout, resolve) {
    const id = (el._endId = ++endId);
    const resolveIfNotStale = () => {
        if (id === el._endId) {
            resolve();
        }
    };
    if (explicitTimeout) {
        return setTimeout(resolveIfNotStale, explicitTimeout);
    }
    const { type, timeout, propCount } = getTransitionInfo(el, expectedType);
    if (!type) {
        return resolve();
    }
    const endEvent = type + 'end';
    let ended = 0;
    const end = () => {
        el.removeEventListener(endEvent, onEnd);
        resolveIfNotStale();
    };
    const onEnd = (e) => {
        if (e.target === el && ++ended >= propCount) {
            end();
        }
    };
    setTimeout(() => {
        if (ended < propCount) {
            end();
        }
    }, timeout + 1);
    el.addEventListener(endEvent, onEnd);
}
function getTransitionInfo(el, expectedType) {
    const styles = window.getComputedStyle(el);
    // JSDOM may return undefined for transition properties
    const getStyleProperties = (key) => (styles[key] || '').split(', ');
    const transitionDelays = getStyleProperties(TRANSITION + 'Delay');
    const transitionDurations = getStyleProperties(TRANSITION + 'Duration');
    const transitionTimeout = getTimeout(transitionDelays, transitionDurations);
    const animationDelays = getStyleProperties(ANIMATION + 'Delay');
    const animationDurations = getStyleProperties(ANIMATION + 'Duration');
    const animationTimeout = getTimeout(animationDelays, animationDurations);
    let type = null;
    let timeout = 0;
    let propCount = 0;
    /* istanbul ignore if */
    if (expectedType === TRANSITION) {
        if (transitionTimeout > 0) {
            type = TRANSITION;
            timeout = transitionTimeout;
            propCount = transitionDurations.length;
        }
    }
    else if (expectedType === ANIMATION) {
        if (animationTimeout > 0) {
            type = ANIMATION;
            timeout = animationTimeout;
            propCount = animationDurations.length;
        }
    }
    else {
        timeout = Math.max(transitionTimeout, animationTimeout);
        type =
            timeout > 0
                ? transitionTimeout > animationTimeout
                    ? TRANSITION
                    : ANIMATION
                : null;
        propCount = type
            ? type === TRANSITION
                ? transitionDurations.length
                : animationDurations.length
            : 0;
    }
    const hasTransform = type === TRANSITION &&
        /\b(transform|all)(,|$)/.test(styles[TRANSITION + 'Property']);
    return {
        type,
        timeout,
        propCount,
        hasTransform
    };
}
function getTimeout(delays, durations) {
    while (delays.length < durations.length) {
        delays = delays.concat(delays);
    }
    return Math.max(...durations.map((d, i) => toMs(d) + toMs(delays[i])));
}
// Old versions of Chromium (below 61.0.3163.100) formats floating pointer
// numbers in a locale-dependent way, using a comma instead of a dot.
// If comma is not replaced with a dot, the input will be rounded down
// (i.e. acting as a floor function) causing unexpected behaviors
function toMs(s) {
    return Number(s.slice(0, -1).replace(',', '.')) * 1000;
}
// synchronously force layout to put elements into a certain state
function forceReflow() {
    return document.body.offsetHeight;
}

const positionMap = new WeakMap();
const newPositionMap = new WeakMap();
const TransitionGroupImpl = {
    name: 'TransitionGroup',
    props: /*#__PURE__*/ shared.extend({}, TransitionPropsValidators, {
        tag: String,
        moveClass: String
    }),
    setup(props, { slots }) {
        const instance = runtimeCore.getCurrentInstance();
        const state = runtimeCore.useTransitionState();
        let prevChildren;
        let children;
        runtimeCore.onUpdated(() => {
            // children is guaranteed to exist after initial render
            if (!prevChildren.length) {
                return;
            }
            const moveClass = props.moveClass || `${props.name || 'v'}-move`;
            if (!hasCSSTransform(prevChildren[0].el, instance.vnode.el, moveClass)) {
                return;
            }
            // we divide the work into three loops to avoid mixing DOM reads and writes
            // in each iteration - which helps prevent layout thrashing.
            prevChildren.forEach(callPendingCbs);
            prevChildren.forEach(recordPosition);
            const movedChildren = prevChildren.filter(applyTranslation);
            // force reflow to put everything in position
            forceReflow();
            movedChildren.forEach(c => {
                const el = c.el;
                const style = el.style;
                addTransitionClass(el, moveClass);
                style.transform = style.webkitTransform = style.transitionDuration = '';
                const cb = (el._moveCb = (e) => {
                    if (e && e.target !== el) {
                        return;
                    }
                    if (!e || /transform$/.test(e.propertyName)) {
                        el.removeEventListener('transitionend', cb);
                        el._moveCb = null;
                        removeTransitionClass(el, moveClass);
                    }
                });
                el.addEventListener('transitionend', cb);
            });
        });
        return () => {
            const rawProps = runtimeCore.toRaw(props);
            const cssTransitionProps = resolveTransitionProps(rawProps);
            let tag = rawProps.tag || runtimeCore.Fragment;
            prevChildren = children;
            children = slots.default ? runtimeCore.getTransitionRawChildren(slots.default()) : [];
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (child.key != null) {
                    runtimeCore.setTransitionHooks(child, runtimeCore.resolveTransitionHooks(child, cssTransitionProps, state, instance));
                }
            }
            if (prevChildren) {
                for (let i = 0; i < prevChildren.length; i++) {
                    const child = prevChildren[i];
                    runtimeCore.setTransitionHooks(child, runtimeCore.resolveTransitionHooks(child, cssTransitionProps, state, instance));
                    positionMap.set(child, child.el.getBoundingClientRect());
                }
            }
            return runtimeCore.createVNode(tag, null, children);
        };
    }
};
const TransitionGroup = TransitionGroupImpl;
function callPendingCbs(c) {
    const el = c.el;
    if (el._moveCb) {
        el._moveCb();
    }
    if (el._enterCb) {
        el._enterCb();
    }
}
function recordPosition(c) {
    newPositionMap.set(c, c.el.getBoundingClientRect());
}
function applyTranslation(c) {
    const oldPos = positionMap.get(c);
    const newPos = newPositionMap.get(c);
    const dx = oldPos.left - newPos.left;
    const dy = oldPos.top - newPos.top;
    if (dx || dy) {
        const s = c.el.style;
        s.transform = s.webkitTransform = `translate(${dx}px,${dy}px)`;
        s.transitionDuration = '0s';
        return c;
    }
}
function hasCSSTransform(el, root, moveClass) {
    // Detect whether an element with the move class applied has
    // CSS transitions. Since the element may be inside an entering
    // transition at this very moment, we make a clone of it and remove
    // all other transition classes applied to ensure only the move class
    // is applied.
    const clone = el.cloneNode();
    if (el._vtc) {
        el._vtc.forEach(cls => {
            cls.split(/\s+/).forEach(c => c && clone.classList.remove(c));
        });
    }
    moveClass.split(/\s+/).forEach(c => c && clone.classList.add(c));
    clone.style.display = 'none';
    const container = (root.nodeType === 1 ? root : root.parentNode);
    container.appendChild(clone);
    const { hasTransform } = getTransitionInfo(clone);
    container.removeChild(clone);
    return hasTransform;
}

const getModelAssigner = (vnode) => {
    const fn = vnode.props['onUpdate:modelValue'];
    return shared.isArray(fn) ? value => shared.invokeArrayFns(fn, value) : fn;
};
function onCompositionStart(e) {
    e.target.composing = true;
}
function onCompositionEnd(e) {
    const target = e.target;
    if (target.composing) {
        target.composing = false;
        trigger(target, 'input');
    }
}
function trigger(el, type) {
    const e = document.createEvent('HTMLEvents');
    e.initEvent(type, true, true);
    el.dispatchEvent(e);
}
// We are exporting the v-model runtime directly as vnode hooks so that it can
// be tree-shaken in case v-model is never used.
const vModelText = {
    created(el, { modifiers: { lazy, trim, number } }, vnode) {
        el._assign = getModelAssigner(vnode);
        const castToNumber = number || (vnode.props && vnode.props.type === 'number');
        addEventListener(el, lazy ? 'change' : 'input', e => {
            if (e.target.composing)
                return;
            let domValue = el.value;
            if (trim) {
                domValue = domValue.trim();
            }
            else if (castToNumber) {
                domValue = shared.toNumber(domValue);
            }
            el._assign(domValue);
        });
        if (trim) {
            addEventListener(el, 'change', () => {
                el.value = el.value.trim();
            });
        }
        if (!lazy) {
            addEventListener(el, 'compositionstart', onCompositionStart);
            addEventListener(el, 'compositionend', onCompositionEnd);
            // Safari < 10.2 & UIWebView doesn't fire compositionend when
            // switching focus before confirming composition choice
            // this also fixes the issue where some browsers e.g. iOS Chrome
            // fires "change" instead of "input" on autocomplete.
            addEventListener(el, 'change', onCompositionEnd);
        }
    },
    // set value on mounted so it's after min/max for type="range"
    mounted(el, { value }) {
        el.value = value == null ? '' : value;
    },
    beforeUpdate(el, { value, modifiers: { lazy, trim, number } }, vnode) {
        el._assign = getModelAssigner(vnode);
        // avoid clearing unresolved text. #2302
        if (el.composing)
            return;
        if (document.activeElement === el) {
            if (lazy) {
                return;
            }
            if (trim && el.value.trim() === value) {
                return;
            }
            if ((number || el.type === 'number') && shared.toNumber(el.value) === value) {
                return;
            }
        }
        const newValue = value == null ? '' : value;
        if (el.value !== newValue) {
            el.value = newValue;
        }
    }
};
const vModelCheckbox = {
    // #4096 array checkboxes need to be deep traversed
    deep: true,
    created(el, _, vnode) {
        el._assign = getModelAssigner(vnode);
        addEventListener(el, 'change', () => {
            const modelValue = el._modelValue;
            const elementValue = getValue(el);
            const checked = el.checked;
            const assign = el._assign;
            if (shared.isArray(modelValue)) {
                const index = shared.looseIndexOf(modelValue, elementValue);
                const found = index !== -1;
                if (checked && !found) {
                    assign(modelValue.concat(elementValue));
                }
                else if (!checked && found) {
                    const filtered = [...modelValue];
                    filtered.splice(index, 1);
                    assign(filtered);
                }
            }
            else if (shared.isSet(modelValue)) {
                const cloned = new Set(modelValue);
                if (checked) {
                    cloned.add(elementValue);
                }
                else {
                    cloned.delete(elementValue);
                }
                assign(cloned);
            }
            else {
                assign(getCheckboxValue(el, checked));
            }
        });
    },
    // set initial checked on mount to wait for true-value/false-value
    mounted: setChecked,
    beforeUpdate(el, binding, vnode) {
        el._assign = getModelAssigner(vnode);
        setChecked(el, binding, vnode);
    }
};
function setChecked(el, { value, oldValue }, vnode) {
    el._modelValue = value;
    if (shared.isArray(value)) {
        el.checked = shared.looseIndexOf(value, vnode.props.value) > -1;
    }
    else if (shared.isSet(value)) {
        el.checked = value.has(vnode.props.value);
    }
    else if (value !== oldValue) {
        el.checked = shared.looseEqual(value, getCheckboxValue(el, true));
    }
}
const vModelRadio = {
    created(el, { value }, vnode) {
        el.checked = shared.looseEqual(value, vnode.props.value);
        el._assign = getModelAssigner(vnode);
        addEventListener(el, 'change', () => {
            el._assign(getValue(el));
        });
    },
    beforeUpdate(el, { value, oldValue }, vnode) {
        el._assign = getModelAssigner(vnode);
        if (value !== oldValue) {
            el.checked = shared.looseEqual(value, vnode.props.value);
        }
    }
};
const vModelSelect = {
    // <select multiple> value need to be deep traversed
    deep: true,
    created(el, { value, modifiers: { number } }, vnode) {
        const isSetModel = shared.isSet(value);
        addEventListener(el, 'change', () => {
            const selectedVal = Array.prototype.filter
                .call(el.options, (o) => o.selected)
                .map((o) => number ? shared.toNumber(getValue(o)) : getValue(o));
            el._assign(el.multiple
                ? isSetModel
                    ? new Set(selectedVal)
                    : selectedVal
                : selectedVal[0]);
        });
        el._assign = getModelAssigner(vnode);
    },
    // set value in mounted & updated because <select> relies on its children
    // <option>s.
    mounted(el, { value }) {
        setSelected(el, value);
    },
    beforeUpdate(el, _binding, vnode) {
        el._assign = getModelAssigner(vnode);
    },
    updated(el, { value }) {
        setSelected(el, value);
    }
};
function setSelected(el, value) {
    const isMultiple = el.multiple;
    if (isMultiple && !shared.isArray(value) && !shared.isSet(value)) {
        return;
    }
    for (let i = 0, l = el.options.length; i < l; i++) {
        const option = el.options[i];
        const optionValue = getValue(option);
        if (isMultiple) {
            if (shared.isArray(value)) {
                option.selected = shared.looseIndexOf(value, optionValue) > -1;
            }
            else {
                option.selected = value.has(optionValue);
            }
        }
        else {
            if (shared.looseEqual(getValue(option), value)) {
                if (el.selectedIndex !== i)
                    el.selectedIndex = i;
                return;
            }
        }
    }
    if (!isMultiple && el.selectedIndex !== -1) {
        el.selectedIndex = -1;
    }
}
// retrieve raw value set via :value bindings
function getValue(el) {
    return '_value' in el ? el._value : el.value;
}
// retrieve raw value for true-value and false-value set via :true-value or :false-value bindings
function getCheckboxValue(el, checked) {
    const key = checked ? '_trueValue' : '_falseValue';
    return key in el ? el[key] : checked;
}
const vModelDynamic = {
    created(el, binding, vnode) {
        callModelHook(el, binding, vnode, null, 'created');
    },
    mounted(el, binding, vnode) {
        callModelHook(el, binding, vnode, null, 'mounted');
    },
    beforeUpdate(el, binding, vnode, prevVNode) {
        callModelHook(el, binding, vnode, prevVNode, 'beforeUpdate');
    },
    updated(el, binding, vnode, prevVNode) {
        callModelHook(el, binding, vnode, prevVNode, 'updated');
    }
};
function callModelHook(el, binding, vnode, prevVNode, hook) {
    let modelToUse;
    switch (el.tagName) {
        case 'SELECT':
            modelToUse = vModelSelect;
            break;
        case 'TEXTAREA':
            modelToUse = vModelText;
            break;
        default:
            switch (vnode.props && vnode.props.type) {
                case 'checkbox':
                    modelToUse = vModelCheckbox;
                    break;
                case 'radio':
                    modelToUse = vModelRadio;
                    break;
                default:
                    modelToUse = vModelText;
            }
    }
    const fn = modelToUse[hook];
    fn && fn(el, binding, vnode, prevVNode);
}
// SSR vnode transforms
{
    vModelText.getSSRProps = ({ value }) => ({ value });
    vModelRadio.getSSRProps = ({ value }, vnode) => {
        if (vnode.props && shared.looseEqual(vnode.props.value, value)) {
            return { checked: true };
        }
    };
    vModelCheckbox.getSSRProps = ({ value }, vnode) => {
        if (shared.isArray(value)) {
            if (vnode.props && shared.looseIndexOf(value, vnode.props.value) > -1) {
                return { checked: true };
            }
        }
        else if (shared.isSet(value)) {
            if (vnode.props && value.has(vnode.props.value)) {
                return { checked: true };
            }
        }
        else if (value) {
            return { checked: true };
        }
    };
}

const systemModifiers = ['ctrl', 'shift', 'alt', 'meta'];
const modifierGuards = {
    stop: e => e.stopPropagation(),
    prevent: e => e.preventDefault(),
    self: e => e.target !== e.currentTarget,
    ctrl: e => !e.ctrlKey,
    shift: e => !e.shiftKey,
    alt: e => !e.altKey,
    meta: e => !e.metaKey,
    left: e => 'button' in e && e.button !== 0,
    middle: e => 'button' in e && e.button !== 1,
    right: e => 'button' in e && e.button !== 2,
    exact: (e, modifiers) => systemModifiers.some(m => e[`${m}Key`] && !modifiers.includes(m))
};
/**
 * @private
 */
const withModifiers = (fn, modifiers) => {
    return (event, ...args) => {
        for (let i = 0; i < modifiers.length; i++) {
            const guard = modifierGuards[modifiers[i]];
            if (guard && guard(event, modifiers))
                return;
        }
        return fn(event, ...args);
    };
};
// Kept for 2.x compat.
// Note: IE11 compat for `spacebar` and `del` is removed for now.
const keyNames = {
    esc: 'escape',
    space: ' ',
    up: 'arrow-up',
    left: 'arrow-left',
    right: 'arrow-right',
    down: 'arrow-down',
    delete: 'backspace'
};
/**
 * @private
 */
const withKeys = (fn, modifiers) => {
    return (event) => {
        if (!('key' in event)) {
            return;
        }
        const eventKey = shared.hyphenate(event.key);
        if (modifiers.some(k => k === eventKey || keyNames[k] === eventKey)) {
            return fn(event);
        }
    };
};

const vShow = {
    beforeMount(el, { value }, { transition }) {
        el._vod = el.style.display === 'none' ? '' : el.style.display;
        if (transition && value) {
            transition.beforeEnter(el);
        }
        else {
            setDisplay(el, value);
        }
    },
    mounted(el, { value }, { transition }) {
        if (transition && value) {
            transition.enter(el);
        }
    },
    updated(el, { value, oldValue }, { transition }) {
        if (!value === !oldValue)
            return;
        if (transition) {
            if (value) {
                transition.beforeEnter(el);
                setDisplay(el, true);
                transition.enter(el);
            }
            else {
                transition.leave(el, () => {
                    setDisplay(el, false);
                });
            }
        }
        else {
            setDisplay(el, value);
        }
    },
    beforeUnmount(el, { value }) {
        setDisplay(el, value);
    }
};
{
    vShow.getSSRProps = ({ value }) => {
        if (!value) {
            return { style: { display: 'none' } };
        }
    };
}
function setDisplay(el, value) {
    el.style.display = value ? el._vod : 'none';
}

const rendererOptions = shared.extend({ patchProp }, nodeOps);
// lazy create the renderer - this makes core renderer logic tree-shakable
// in case the user only imports reactivity utilities from Vue.
let renderer;
let enabledHydration = false;
function ensureRenderer() {
    return (renderer ||
        (renderer = runtimeCore.createRenderer(rendererOptions)));
}
function ensureHydrationRenderer() {
    renderer = enabledHydration
        ? renderer
        : runtimeCore.createHydrationRenderer(rendererOptions);
    enabledHydration = true;
    return renderer;
}
// use explicit type casts here to avoid import() calls in rolled-up d.ts
const render = ((...args) => {
    ensureRenderer().render(...args);
});
const hydrate = ((...args) => {
    ensureHydrationRenderer().hydrate(...args);
});
const createApp = ((...args) => {
    const app = ensureRenderer().createApp(...args);
    const { mount } = app;
    app.mount = (containerOrSelector) => {
        const container = normalizeContainer(containerOrSelector);
        if (!container)
            return;
        const component = app._component;
        if (!shared.isFunction(component) && !component.render && !component.template) {
            // __UNSAFE__
            // Reason: potential execution of JS expressions in in-DOM template.
            // The user must make sure the in-DOM template is trusted. If it's
            // rendered by the server, the template should not contain any user data.
            component.template = container.innerHTML;
        }
        // clear content before mounting
        container.innerHTML = '';
        const proxy = mount(container, false, container instanceof SVGElement);
        if (container instanceof Element) {
            container.removeAttribute('v-cloak');
            container.setAttribute('data-v-app', '');
        }
        return proxy;
    };
    return app;
});
const createSSRApp = ((...args) => {
    const app = ensureHydrationRenderer().createApp(...args);
    const { mount } = app;
    app.mount = (containerOrSelector) => {
        const container = normalizeContainer(containerOrSelector);
        if (container) {
            return mount(container, true, container instanceof SVGElement);
        }
    };
    return app;
});
function normalizeContainer(container) {
    if (shared.isString(container)) {
        const res = document.querySelector(container);
        return res;
    }
    return container;
}

Object.keys(runtimeCore).forEach(function (k) {
  if (k !== 'default') exports[k] = runtimeCore[k];
});
exports.Transition = Transition;
exports.TransitionGroup = TransitionGroup;
exports.VueElement = VueElement;
exports.createApp = createApp;
exports.createSSRApp = createSSRApp;
exports.defineCustomElement = defineCustomElement;
exports.defineSSRCustomElement = defineSSRCustomElement;
exports.hydrate = hydrate;
exports.render = render;
exports.useCssModule = useCssModule;
exports.useCssVars = useCssVars;
exports.vModelCheckbox = vModelCheckbox;
exports.vModelDynamic = vModelDynamic;
exports.vModelRadio = vModelRadio;
exports.vModelSelect = vModelSelect;
exports.vModelText = vModelText;
exports.vShow = vShow;
exports.withKeys = withKeys;
exports.withModifiers = withModifiers;


/***/ }),

/***/ 7834:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


if (true) {
  module.exports = __webpack_require__(4577)
} else {}


/***/ }),

/***/ 6397:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", ({ value: true }));

/**
 * Make a map and return a function for checking if a key
 * is in that map.
 * IMPORTANT: all calls of this function must be prefixed with
 * \/\*#\_\_PURE\_\_\*\/
 * So that rollup can tree-shake them if necessary.
 */
function makeMap(str, expectsLowerCase) {
    const map = Object.create(null);
    const list = str.split(',');
    for (let i = 0; i < list.length; i++) {
        map[list[i]] = true;
    }
    return expectsLowerCase ? val => !!map[val.toLowerCase()] : val => !!map[val];
}

/**
 * dev only flag -> name mapping
 */
const PatchFlagNames = {
    [1 /* TEXT */]: `TEXT`,
    [2 /* CLASS */]: `CLASS`,
    [4 /* STYLE */]: `STYLE`,
    [8 /* PROPS */]: `PROPS`,
    [16 /* FULL_PROPS */]: `FULL_PROPS`,
    [32 /* HYDRATE_EVENTS */]: `HYDRATE_EVENTS`,
    [64 /* STABLE_FRAGMENT */]: `STABLE_FRAGMENT`,
    [128 /* KEYED_FRAGMENT */]: `KEYED_FRAGMENT`,
    [256 /* UNKEYED_FRAGMENT */]: `UNKEYED_FRAGMENT`,
    [512 /* NEED_PATCH */]: `NEED_PATCH`,
    [1024 /* DYNAMIC_SLOTS */]: `DYNAMIC_SLOTS`,
    [2048 /* DEV_ROOT_FRAGMENT */]: `DEV_ROOT_FRAGMENT`,
    [-1 /* HOISTED */]: `HOISTED`,
    [-2 /* BAIL */]: `BAIL`
};

/**
 * Dev only
 */
const slotFlagsText = {
    [1 /* STABLE */]: 'STABLE',
    [2 /* DYNAMIC */]: 'DYNAMIC',
    [3 /* FORWARDED */]: 'FORWARDED'
};

const GLOBALS_WHITE_LISTED = 'Infinity,undefined,NaN,isFinite,isNaN,parseFloat,parseInt,decodeURI,' +
    'decodeURIComponent,encodeURI,encodeURIComponent,Math,Number,Date,Array,' +
    'Object,Boolean,String,RegExp,Map,Set,JSON,Intl,BigInt';
const isGloballyWhitelisted = /*#__PURE__*/ makeMap(GLOBALS_WHITE_LISTED);

const range = 2;
function generateCodeFrame(source, start = 0, end = source.length) {
    // Split the content into individual lines but capture the newline sequence
    // that separated each line. This is important because the actual sequence is
    // needed to properly take into account the full line length for offset
    // comparison
    let lines = source.split(/(\r?\n)/);
    // Separate the lines and newline sequences into separate arrays for easier referencing
    const newlineSequences = lines.filter((_, idx) => idx % 2 === 1);
    lines = lines.filter((_, idx) => idx % 2 === 0);
    let count = 0;
    const res = [];
    for (let i = 0; i < lines.length; i++) {
        count +=
            lines[i].length +
                ((newlineSequences[i] && newlineSequences[i].length) || 0);
        if (count >= start) {
            for (let j = i - range; j <= i + range || end > count; j++) {
                if (j < 0 || j >= lines.length)
                    continue;
                const line = j + 1;
                res.push(`${line}${' '.repeat(Math.max(3 - String(line).length, 0))}|  ${lines[j]}`);
                const lineLength = lines[j].length;
                const newLineSeqLength = (newlineSequences[j] && newlineSequences[j].length) || 0;
                if (j === i) {
                    // push underline
                    const pad = start - (count - (lineLength + newLineSeqLength));
                    const length = Math.max(1, end > count ? lineLength - pad : end - start);
                    res.push(`   |  ` + ' '.repeat(pad) + '^'.repeat(length));
                }
                else if (j > i) {
                    if (end > count) {
                        const length = Math.max(Math.min(end - count, lineLength), 1);
                        res.push(`   |  ` + '^'.repeat(length));
                    }
                    count += lineLength + newLineSeqLength;
                }
            }
            break;
        }
    }
    return res.join('\n');
}

/**
 * On the client we only need to offer special cases for boolean attributes that
 * have different names from their corresponding dom properties:
 * - itemscope -> N/A
 * - allowfullscreen -> allowFullscreen
 * - formnovalidate -> formNoValidate
 * - ismap -> isMap
 * - nomodule -> noModule
 * - novalidate -> noValidate
 * - readonly -> readOnly
 */
const specialBooleanAttrs = `itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly`;
const isSpecialBooleanAttr = /*#__PURE__*/ makeMap(specialBooleanAttrs);
/**
 * The full list is needed during SSR to produce the correct initial markup.
 */
const isBooleanAttr = /*#__PURE__*/ makeMap(specialBooleanAttrs +
    `,async,autofocus,autoplay,controls,default,defer,disabled,hidden,` +
    `loop,open,required,reversed,scoped,seamless,` +
    `checked,muted,multiple,selected`);
/**
 * Boolean attributes should be included if the value is truthy or ''.
 * e.g. <select multiple> compiles to { multiple: '' }
 */
function includeBooleanAttr(value) {
    return !!value || value === '';
}
const unsafeAttrCharRE = /[>/="'\u0009\u000a\u000c\u0020]/;
const attrValidationCache = {};
function isSSRSafeAttrName(name) {
    if (attrValidationCache.hasOwnProperty(name)) {
        return attrValidationCache[name];
    }
    const isUnsafe = unsafeAttrCharRE.test(name);
    if (isUnsafe) {
        console.error(`unsafe attribute name: ${name}`);
    }
    return (attrValidationCache[name] = !isUnsafe);
}
const propsToAttrMap = {
    acceptCharset: 'accept-charset',
    className: 'class',
    htmlFor: 'for',
    httpEquiv: 'http-equiv'
};
/**
 * CSS properties that accept plain numbers
 */
const isNoUnitNumericStyleProp = /*#__PURE__*/ makeMap(`animation-iteration-count,border-image-outset,border-image-slice,` +
    `border-image-width,box-flex,box-flex-group,box-ordinal-group,column-count,` +
    `columns,flex,flex-grow,flex-positive,flex-shrink,flex-negative,flex-order,` +
    `grid-row,grid-row-end,grid-row-span,grid-row-start,grid-column,` +
    `grid-column-end,grid-column-span,grid-column-start,font-weight,line-clamp,` +
    `line-height,opacity,order,orphans,tab-size,widows,z-index,zoom,` +
    // SVG
    `fill-opacity,flood-opacity,stop-opacity,stroke-dasharray,stroke-dashoffset,` +
    `stroke-miterlimit,stroke-opacity,stroke-width`);
/**
 * Known attributes, this is used for stringification of runtime static nodes
 * so that we don't stringify bindings that cannot be set from HTML.
 * Don't also forget to allow `data-*` and `aria-*`!
 * Generated from https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes
 */
const isKnownHtmlAttr = /*#__PURE__*/ makeMap(`accept,accept-charset,accesskey,action,align,allow,alt,async,` +
    `autocapitalize,autocomplete,autofocus,autoplay,background,bgcolor,` +
    `border,buffered,capture,challenge,charset,checked,cite,class,code,` +
    `codebase,color,cols,colspan,content,contenteditable,contextmenu,controls,` +
    `coords,crossorigin,csp,data,datetime,decoding,default,defer,dir,dirname,` +
    `disabled,download,draggable,dropzone,enctype,enterkeyhint,for,form,` +
    `formaction,formenctype,formmethod,formnovalidate,formtarget,headers,` +
    `height,hidden,high,href,hreflang,http-equiv,icon,id,importance,integrity,` +
    `ismap,itemprop,keytype,kind,label,lang,language,loading,list,loop,low,` +
    `manifest,max,maxlength,minlength,media,min,multiple,muted,name,novalidate,` +
    `open,optimum,pattern,ping,placeholder,poster,preload,radiogroup,readonly,` +
    `referrerpolicy,rel,required,reversed,rows,rowspan,sandbox,scope,scoped,` +
    `selected,shape,size,sizes,slot,span,spellcheck,src,srcdoc,srclang,srcset,` +
    `start,step,style,summary,tabindex,target,title,translate,type,usemap,` +
    `value,width,wrap`);
/**
 * Generated from https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute
 */
const isKnownSvgAttr = /*#__PURE__*/ makeMap(`xmlns,accent-height,accumulate,additive,alignment-baseline,alphabetic,amplitude,` +
    `arabic-form,ascent,attributeName,attributeType,azimuth,baseFrequency,` +
    `baseline-shift,baseProfile,bbox,begin,bias,by,calcMode,cap-height,class,` +
    `clip,clipPathUnits,clip-path,clip-rule,color,color-interpolation,` +
    `color-interpolation-filters,color-profile,color-rendering,` +
    `contentScriptType,contentStyleType,crossorigin,cursor,cx,cy,d,decelerate,` +
    `descent,diffuseConstant,direction,display,divisor,dominant-baseline,dur,dx,` +
    `dy,edgeMode,elevation,enable-background,end,exponent,fill,fill-opacity,` +
    `fill-rule,filter,filterRes,filterUnits,flood-color,flood-opacity,` +
    `font-family,font-size,font-size-adjust,font-stretch,font-style,` +
    `font-variant,font-weight,format,from,fr,fx,fy,g1,g2,glyph-name,` +
    `glyph-orientation-horizontal,glyph-orientation-vertical,glyphRef,` +
    `gradientTransform,gradientUnits,hanging,height,href,hreflang,horiz-adv-x,` +
    `horiz-origin-x,id,ideographic,image-rendering,in,in2,intercept,k,k1,k2,k3,` +
    `k4,kernelMatrix,kernelUnitLength,kerning,keyPoints,keySplines,keyTimes,` +
    `lang,lengthAdjust,letter-spacing,lighting-color,limitingConeAngle,local,` +
    `marker-end,marker-mid,marker-start,markerHeight,markerUnits,markerWidth,` +
    `mask,maskContentUnits,maskUnits,mathematical,max,media,method,min,mode,` +
    `name,numOctaves,offset,opacity,operator,order,orient,orientation,origin,` +
    `overflow,overline-position,overline-thickness,panose-1,paint-order,path,` +
    `pathLength,patternContentUnits,patternTransform,patternUnits,ping,` +
    `pointer-events,points,pointsAtX,pointsAtY,pointsAtZ,preserveAlpha,` +
    `preserveAspectRatio,primitiveUnits,r,radius,referrerPolicy,refX,refY,rel,` +
    `rendering-intent,repeatCount,repeatDur,requiredExtensions,requiredFeatures,` +
    `restart,result,rotate,rx,ry,scale,seed,shape-rendering,slope,spacing,` +
    `specularConstant,specularExponent,speed,spreadMethod,startOffset,` +
    `stdDeviation,stemh,stemv,stitchTiles,stop-color,stop-opacity,` +
    `strikethrough-position,strikethrough-thickness,string,stroke,` +
    `stroke-dasharray,stroke-dashoffset,stroke-linecap,stroke-linejoin,` +
    `stroke-miterlimit,stroke-opacity,stroke-width,style,surfaceScale,` +
    `systemLanguage,tabindex,tableValues,target,targetX,targetY,text-anchor,` +
    `text-decoration,text-rendering,textLength,to,transform,transform-origin,` +
    `type,u1,u2,underline-position,underline-thickness,unicode,unicode-bidi,` +
    `unicode-range,units-per-em,v-alphabetic,v-hanging,v-ideographic,` +
    `v-mathematical,values,vector-effect,version,vert-adv-y,vert-origin-x,` +
    `vert-origin-y,viewBox,viewTarget,visibility,width,widths,word-spacing,` +
    `writing-mode,x,x-height,x1,x2,xChannelSelector,xlink:actuate,xlink:arcrole,` +
    `xlink:href,xlink:role,xlink:show,xlink:title,xlink:type,xml:base,xml:lang,` +
    `xml:space,y,y1,y2,yChannelSelector,z,zoomAndPan`);

function normalizeStyle(value) {
    if (isArray(value)) {
        const res = {};
        for (let i = 0; i < value.length; i++) {
            const item = value[i];
            const normalized = isString(item)
                ? parseStringStyle(item)
                : normalizeStyle(item);
            if (normalized) {
                for (const key in normalized) {
                    res[key] = normalized[key];
                }
            }
        }
        return res;
    }
    else if (isString(value)) {
        return value;
    }
    else if (isObject(value)) {
        return value;
    }
}
const listDelimiterRE = /;(?![^(]*\))/g;
const propertyDelimiterRE = /:(.+)/;
function parseStringStyle(cssText) {
    const ret = {};
    cssText.split(listDelimiterRE).forEach(item => {
        if (item) {
            const tmp = item.split(propertyDelimiterRE);
            tmp.length > 1 && (ret[tmp[0].trim()] = tmp[1].trim());
        }
    });
    return ret;
}
function stringifyStyle(styles) {
    let ret = '';
    if (!styles || isString(styles)) {
        return ret;
    }
    for (const key in styles) {
        const value = styles[key];
        const normalizedKey = key.startsWith(`--`) ? key : hyphenate(key);
        if (isString(value) ||
            (typeof value === 'number' && isNoUnitNumericStyleProp(normalizedKey))) {
            // only render valid values
            ret += `${normalizedKey}:${value};`;
        }
    }
    return ret;
}
function normalizeClass(value) {
    let res = '';
    if (isString(value)) {
        res = value;
    }
    else if (isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            const normalized = normalizeClass(value[i]);
            if (normalized) {
                res += normalized + ' ';
            }
        }
    }
    else if (isObject(value)) {
        for (const name in value) {
            if (value[name]) {
                res += name + ' ';
            }
        }
    }
    return res.trim();
}
function normalizeProps(props) {
    if (!props)
        return null;
    let { class: klass, style } = props;
    if (klass && !isString(klass)) {
        props.class = normalizeClass(klass);
    }
    if (style) {
        props.style = normalizeStyle(style);
    }
    return props;
}

// These tag configs are shared between compiler-dom and runtime-dom, so they
// https://developer.mozilla.org/en-US/docs/Web/HTML/Element
const HTML_TAGS = 'html,body,base,head,link,meta,style,title,address,article,aside,footer,' +
    'header,h1,h2,h3,h4,h5,h6,nav,section,div,dd,dl,dt,figcaption,' +
    'figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,' +
    'data,dfn,em,i,kbd,mark,q,rp,rt,ruby,s,samp,small,span,strong,sub,sup,' +
    'time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,' +
    'canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,' +
    'th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,' +
    'option,output,progress,select,textarea,details,dialog,menu,' +
    'summary,template,blockquote,iframe,tfoot';
// https://developer.mozilla.org/en-US/docs/Web/SVG/Element
const SVG_TAGS = 'svg,animate,animateMotion,animateTransform,circle,clipPath,color-profile,' +
    'defs,desc,discard,ellipse,feBlend,feColorMatrix,feComponentTransfer,' +
    'feComposite,feConvolveMatrix,feDiffuseLighting,feDisplacementMap,' +
    'feDistanceLight,feDropShadow,feFlood,feFuncA,feFuncB,feFuncG,feFuncR,' +
    'feGaussianBlur,feImage,feMerge,feMergeNode,feMorphology,feOffset,' +
    'fePointLight,feSpecularLighting,feSpotLight,feTile,feTurbulence,filter,' +
    'foreignObject,g,hatch,hatchpath,image,line,linearGradient,marker,mask,' +
    'mesh,meshgradient,meshpatch,meshrow,metadata,mpath,path,pattern,' +
    'polygon,polyline,radialGradient,rect,set,solidcolor,stop,switch,symbol,' +
    'text,textPath,title,tspan,unknown,use,view';
const VOID_TAGS = 'area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr';
const isHTMLTag = /*#__PURE__*/ makeMap(HTML_TAGS);
const isSVGTag = /*#__PURE__*/ makeMap(SVG_TAGS);
const isVoidTag = /*#__PURE__*/ makeMap(VOID_TAGS);

const escapeRE = /["'&<>]/;
function escapeHtml(string) {
    const str = '' + string;
    const match = escapeRE.exec(str);
    if (!match) {
        return str;
    }
    let html = '';
    let escaped;
    let index;
    let lastIndex = 0;
    for (index = match.index; index < str.length; index++) {
        switch (str.charCodeAt(index)) {
            case 34: // "
                escaped = '&quot;';
                break;
            case 38: // &
                escaped = '&amp;';
                break;
            case 39: // '
                escaped = '&#39;';
                break;
            case 60: // <
                escaped = '&lt;';
                break;
            case 62: // >
                escaped = '&gt;';
                break;
            default:
                continue;
        }
        if (lastIndex !== index) {
            html += str.substring(lastIndex, index);
        }
        lastIndex = index + 1;
        html += escaped;
    }
    return lastIndex !== index ? html + str.substring(lastIndex, index) : html;
}
// https://www.w3.org/TR/html52/syntax.html#comments
const commentStripRE = /^-?>|<!--|-->|--!>|<!-$/g;
function escapeHtmlComment(src) {
    return src.replace(commentStripRE, '');
}

function looseCompareArrays(a, b) {
    if (a.length !== b.length)
        return false;
    let equal = true;
    for (let i = 0; equal && i < a.length; i++) {
        equal = looseEqual(a[i], b[i]);
    }
    return equal;
}
function looseEqual(a, b) {
    if (a === b)
        return true;
    let aValidType = isDate(a);
    let bValidType = isDate(b);
    if (aValidType || bValidType) {
        return aValidType && bValidType ? a.getTime() === b.getTime() : false;
    }
    aValidType = isArray(a);
    bValidType = isArray(b);
    if (aValidType || bValidType) {
        return aValidType && bValidType ? looseCompareArrays(a, b) : false;
    }
    aValidType = isObject(a);
    bValidType = isObject(b);
    if (aValidType || bValidType) {
        /* istanbul ignore if: this if will probably never be called */
        if (!aValidType || !bValidType) {
            return false;
        }
        const aKeysCount = Object.keys(a).length;
        const bKeysCount = Object.keys(b).length;
        if (aKeysCount !== bKeysCount) {
            return false;
        }
        for (const key in a) {
            const aHasKey = a.hasOwnProperty(key);
            const bHasKey = b.hasOwnProperty(key);
            if ((aHasKey && !bHasKey) ||
                (!aHasKey && bHasKey) ||
                !looseEqual(a[key], b[key])) {
                return false;
            }
        }
    }
    return String(a) === String(b);
}
function looseIndexOf(arr, val) {
    return arr.findIndex(item => looseEqual(item, val));
}

/**
 * For converting {{ interpolation }} values to displayed strings.
 * @private
 */
const toDisplayString = (val) => {
    return val == null
        ? ''
        : isArray(val) ||
            (isObject(val) &&
                (val.toString === objectToString || !isFunction(val.toString)))
            ? JSON.stringify(val, replacer, 2)
            : String(val);
};
const replacer = (_key, val) => {
    // can't use isRef here since @vue/shared has no deps
    if (val && val.__v_isRef) {
        return replacer(_key, val.value);
    }
    else if (isMap(val)) {
        return {
            [`Map(${val.size})`]: [...val.entries()].reduce((entries, [key, val]) => {
                entries[`${key} =>`] = val;
                return entries;
            }, {})
        };
    }
    else if (isSet(val)) {
        return {
            [`Set(${val.size})`]: [...val.values()]
        };
    }
    else if (isObject(val) && !isArray(val) && !isPlainObject(val)) {
        return String(val);
    }
    return val;
};

/**
 * List of @babel/parser plugins that are used for template expression
 * transforms and SFC script transforms. By default we enable proposals slated
 * for ES2020. This will need to be updated as the spec moves forward.
 * Full list at https://babeljs.io/docs/en/next/babel-parser#plugins
 */
const babelParserDefaultPlugins = [
    'bigInt',
    'optionalChaining',
    'nullishCoalescingOperator'
];
const EMPTY_OBJ = {};
const EMPTY_ARR = [];
const NOOP = () => { };
/**
 * Always return false.
 */
const NO = () => false;
const onRE = /^on[^a-z]/;
const isOn = (key) => onRE.test(key);
const isModelListener = (key) => key.startsWith('onUpdate:');
const extend = Object.assign;
const remove = (arr, el) => {
    const i = arr.indexOf(el);
    if (i > -1) {
        arr.splice(i, 1);
    }
};
const hasOwnProperty = Object.prototype.hasOwnProperty;
const hasOwn = (val, key) => hasOwnProperty.call(val, key);
const isArray = Array.isArray;
const isMap = (val) => toTypeString(val) === '[object Map]';
const isSet = (val) => toTypeString(val) === '[object Set]';
const isDate = (val) => val instanceof Date;
const isFunction = (val) => typeof val === 'function';
const isString = (val) => typeof val === 'string';
const isSymbol = (val) => typeof val === 'symbol';
const isObject = (val) => val !== null && typeof val === 'object';
const isPromise = (val) => {
    return isObject(val) && isFunction(val.then) && isFunction(val.catch);
};
const objectToString = Object.prototype.toString;
const toTypeString = (value) => objectToString.call(value);
const toRawType = (value) => {
    // extract "RawType" from strings like "[object RawType]"
    return toTypeString(value).slice(8, -1);
};
const isPlainObject = (val) => toTypeString(val) === '[object Object]';
const isIntegerKey = (key) => isString(key) &&
    key !== 'NaN' &&
    key[0] !== '-' &&
    '' + parseInt(key, 10) === key;
const isReservedProp = /*#__PURE__*/ makeMap(
// the leading comma is intentional so empty string "" is also included
',key,ref,' +
    'onVnodeBeforeMount,onVnodeMounted,' +
    'onVnodeBeforeUpdate,onVnodeUpdated,' +
    'onVnodeBeforeUnmount,onVnodeUnmounted');
const cacheStringFunction = (fn) => {
    const cache = Object.create(null);
    return ((str) => {
        const hit = cache[str];
        return hit || (cache[str] = fn(str));
    });
};
const camelizeRE = /-(\w)/g;
/**
 * @private
 */
const camelize = cacheStringFunction((str) => {
    return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''));
});
const hyphenateRE = /\B([A-Z])/g;
/**
 * @private
 */
const hyphenate = cacheStringFunction((str) => str.replace(hyphenateRE, '-$1').toLowerCase());
/**
 * @private
 */
const capitalize = cacheStringFunction((str) => str.charAt(0).toUpperCase() + str.slice(1));
/**
 * @private
 */
const toHandlerKey = cacheStringFunction((str) => str ? `on${capitalize(str)}` : ``);
// compare whether a value has changed, accounting for NaN.
const hasChanged = (value, oldValue) => !Object.is(value, oldValue);
const invokeArrayFns = (fns, arg) => {
    for (let i = 0; i < fns.length; i++) {
        fns[i](arg);
    }
};
const def = (obj, key, value) => {
    Object.defineProperty(obj, key, {
        configurable: true,
        enumerable: false,
        value
    });
};
const toNumber = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? val : n;
};
let _globalThis;
const getGlobalThis = () => {
    return (_globalThis ||
        (_globalThis =
            typeof globalThis !== 'undefined'
                ? globalThis
                : typeof self !== 'undefined'
                    ? self
                    : typeof window !== 'undefined'
                        ? window
                        : typeof __webpack_require__.g !== 'undefined'
                            ? __webpack_require__.g
                            : {}));
};

exports.EMPTY_ARR = EMPTY_ARR;
exports.EMPTY_OBJ = EMPTY_OBJ;
exports.NO = NO;
exports.NOOP = NOOP;
exports.PatchFlagNames = PatchFlagNames;
exports.babelParserDefaultPlugins = babelParserDefaultPlugins;
exports.camelize = camelize;
exports.capitalize = capitalize;
exports.def = def;
exports.escapeHtml = escapeHtml;
exports.escapeHtmlComment = escapeHtmlComment;
exports.extend = extend;
exports.generateCodeFrame = generateCodeFrame;
exports.getGlobalThis = getGlobalThis;
exports.hasChanged = hasChanged;
exports.hasOwn = hasOwn;
exports.hyphenate = hyphenate;
exports.includeBooleanAttr = includeBooleanAttr;
exports.invokeArrayFns = invokeArrayFns;
exports.isArray = isArray;
exports.isBooleanAttr = isBooleanAttr;
exports.isDate = isDate;
exports.isFunction = isFunction;
exports.isGloballyWhitelisted = isGloballyWhitelisted;
exports.isHTMLTag = isHTMLTag;
exports.isIntegerKey = isIntegerKey;
exports.isKnownHtmlAttr = isKnownHtmlAttr;
exports.isKnownSvgAttr = isKnownSvgAttr;
exports.isMap = isMap;
exports.isModelListener = isModelListener;
exports.isNoUnitNumericStyleProp = isNoUnitNumericStyleProp;
exports.isObject = isObject;
exports.isOn = isOn;
exports.isPlainObject = isPlainObject;
exports.isPromise = isPromise;
exports.isReservedProp = isReservedProp;
exports.isSSRSafeAttrName = isSSRSafeAttrName;
exports.isSVGTag = isSVGTag;
exports.isSet = isSet;
exports.isSpecialBooleanAttr = isSpecialBooleanAttr;
exports.isString = isString;
exports.isSymbol = isSymbol;
exports.isVoidTag = isVoidTag;
exports.looseEqual = looseEqual;
exports.looseIndexOf = looseIndexOf;
exports.makeMap = makeMap;
exports.normalizeClass = normalizeClass;
exports.normalizeProps = normalizeProps;
exports.normalizeStyle = normalizeStyle;
exports.objectToString = objectToString;
exports.parseStringStyle = parseStringStyle;
exports.propsToAttrMap = propsToAttrMap;
exports.remove = remove;
exports.slotFlagsText = slotFlagsText;
exports.stringifyStyle = stringifyStyle;
exports.toDisplayString = toDisplayString;
exports.toHandlerKey = toHandlerKey;
exports.toNumber = toNumber;
exports.toRawType = toRawType;
exports.toTypeString = toTypeString;


/***/ }),

/***/ 9109:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


if (true) {
  module.exports = __webpack_require__(6397)
} else {}


/***/ }),

/***/ 4206:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

module.exports = __webpack_require__(8057);

/***/ }),

/***/ 4387:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(7485);
var settle = __webpack_require__(4570);
var cookies = __webpack_require__(2940);
var buildURL = __webpack_require__(581);
var buildFullPath = __webpack_require__(574);
var parseHeaders = __webpack_require__(3845);
var isURLSameOrigin = __webpack_require__(8338);
var createError = __webpack_require__(8524);

module.exports = function xhrAdapter(config) {
  return new Promise(function dispatchXhrRequest(resolve, reject) {
    var requestData = config.data;
    var requestHeaders = config.headers;
    var responseType = config.responseType;

    if (utils.isFormData(requestData)) {
      delete requestHeaders['Content-Type']; // Let the browser set it
    }

    var request = new XMLHttpRequest();

    // HTTP basic authentication
    if (config.auth) {
      var username = config.auth.username || '';
      var password = config.auth.password ? unescape(encodeURIComponent(config.auth.password)) : '';
      requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
    }

    var fullPath = buildFullPath(config.baseURL, config.url);
    request.open(config.method.toUpperCase(), buildURL(fullPath, config.params, config.paramsSerializer), true);

    // Set the request timeout in MS
    request.timeout = config.timeout;

    function onloadend() {
      if (!request) {
        return;
      }
      // Prepare the response
      var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
      var responseData = !responseType || responseType === 'text' ||  responseType === 'json' ?
        request.responseText : request.response;
      var response = {
        data: responseData,
        status: request.status,
        statusText: request.statusText,
        headers: responseHeaders,
        config: config,
        request: request
      };

      settle(resolve, reject, response);

      // Clean up request
      request = null;
    }

    if ('onloadend' in request) {
      // Use onloadend if available
      request.onloadend = onloadend;
    } else {
      // Listen for ready state to emulate onloadend
      request.onreadystatechange = function handleLoad() {
        if (!request || request.readyState !== 4) {
          return;
        }

        // The request errored out and we didn't get a response, this will be
        // handled by onerror instead
        // With one exception: request that using file: protocol, most browsers
        // will return status as 0 even though it's a successful request
        if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
          return;
        }
        // readystate handler is calling before onerror or ontimeout handlers,
        // so we should call onloadend on the next 'tick'
        setTimeout(onloadend);
      };
    }

    // Handle browser request cancellation (as opposed to a manual cancellation)
    request.onabort = function handleAbort() {
      if (!request) {
        return;
      }

      reject(createError('Request aborted', config, 'ECONNABORTED', request));

      // Clean up request
      request = null;
    };

    // Handle low level network errors
    request.onerror = function handleError() {
      // Real errors are hidden from us by the browser
      // onerror should only fire if it's a network error
      reject(createError('Network Error', config, null, request));

      // Clean up request
      request = null;
    };

    // Handle timeout
    request.ontimeout = function handleTimeout() {
      var timeoutErrorMessage = 'timeout of ' + config.timeout + 'ms exceeded';
      if (config.timeoutErrorMessage) {
        timeoutErrorMessage = config.timeoutErrorMessage;
      }
      reject(createError(
        timeoutErrorMessage,
        config,
        config.transitional && config.transitional.clarifyTimeoutError ? 'ETIMEDOUT' : 'ECONNABORTED',
        request));

      // Clean up request
      request = null;
    };

    // Add xsrf header
    // This is only done if running in a standard browser environment.
    // Specifically not if we're in a web worker, or react-native.
    if (utils.isStandardBrowserEnv()) {
      // Add xsrf header
      var xsrfValue = (config.withCredentials || isURLSameOrigin(fullPath)) && config.xsrfCookieName ?
        cookies.read(config.xsrfCookieName) :
        undefined;

      if (xsrfValue) {
        requestHeaders[config.xsrfHeaderName] = xsrfValue;
      }
    }

    // Add headers to the request
    if ('setRequestHeader' in request) {
      utils.forEach(requestHeaders, function setRequestHeader(val, key) {
        if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
          // Remove Content-Type if data is undefined
          delete requestHeaders[key];
        } else {
          // Otherwise add header to the request
          request.setRequestHeader(key, val);
        }
      });
    }

    // Add withCredentials to request if needed
    if (!utils.isUndefined(config.withCredentials)) {
      request.withCredentials = !!config.withCredentials;
    }

    // Add responseType to request if needed
    if (responseType && responseType !== 'json') {
      request.responseType = config.responseType;
    }

    // Handle progress if needed
    if (typeof config.onDownloadProgress === 'function') {
      request.addEventListener('progress', config.onDownloadProgress);
    }

    // Not all browsers support upload events
    if (typeof config.onUploadProgress === 'function' && request.upload) {
      request.upload.addEventListener('progress', config.onUploadProgress);
    }

    if (config.cancelToken) {
      // Handle cancellation
      config.cancelToken.promise.then(function onCanceled(cancel) {
        if (!request) {
          return;
        }

        request.abort();
        reject(cancel);
        // Clean up request
        request = null;
      });
    }

    if (!requestData) {
      requestData = null;
    }

    // Send the request
    request.send(requestData);
  });
};


/***/ }),

/***/ 8057:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(7485);
var bind = __webpack_require__(875);
var Axios = __webpack_require__(5029);
var mergeConfig = __webpack_require__(4941);
var defaults = __webpack_require__(3141);

/**
 * Create an instance of Axios
 *
 * @param {Object} defaultConfig The default config for the instance
 * @return {Axios} A new instance of Axios
 */
function createInstance(defaultConfig) {
  var context = new Axios(defaultConfig);
  var instance = bind(Axios.prototype.request, context);

  // Copy axios.prototype to instance
  utils.extend(instance, Axios.prototype, context);

  // Copy context to instance
  utils.extend(instance, context);

  return instance;
}

// Create the default instance to be exported
var axios = createInstance(defaults);

// Expose Axios class to allow class inheritance
axios.Axios = Axios;

// Factory for creating new instances
axios.create = function create(instanceConfig) {
  return createInstance(mergeConfig(axios.defaults, instanceConfig));
};

// Expose Cancel & CancelToken
axios.Cancel = __webpack_require__(7132);
axios.CancelToken = __webpack_require__(4603);
axios.isCancel = __webpack_require__(1475);

// Expose all/spread
axios.all = function all(promises) {
  return Promise.all(promises);
};
axios.spread = __webpack_require__(5739);

// Expose isAxiosError
axios.isAxiosError = __webpack_require__(5835);

module.exports = axios;

// Allow use of default import syntax in TypeScript
module.exports["default"] = axios;


/***/ }),

/***/ 7132:
/***/ (function(module) {

"use strict";


/**
 * A `Cancel` is an object that is thrown when an operation is canceled.
 *
 * @class
 * @param {string=} message The message.
 */
function Cancel(message) {
  this.message = message;
}

Cancel.prototype.toString = function toString() {
  return 'Cancel' + (this.message ? ': ' + this.message : '');
};

Cancel.prototype.__CANCEL__ = true;

module.exports = Cancel;


/***/ }),

/***/ 4603:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


var Cancel = __webpack_require__(7132);

/**
 * A `CancelToken` is an object that can be used to request cancellation of an operation.
 *
 * @class
 * @param {Function} executor The executor function.
 */
function CancelToken(executor) {
  if (typeof executor !== 'function') {
    throw new TypeError('executor must be a function.');
  }

  var resolvePromise;
  this.promise = new Promise(function promiseExecutor(resolve) {
    resolvePromise = resolve;
  });

  var token = this;
  executor(function cancel(message) {
    if (token.reason) {
      // Cancellation has already been requested
      return;
    }

    token.reason = new Cancel(message);
    resolvePromise(token.reason);
  });
}

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
CancelToken.prototype.throwIfRequested = function throwIfRequested() {
  if (this.reason) {
    throw this.reason;
  }
};

/**
 * Returns an object that contains a new `CancelToken` and a function that, when called,
 * cancels the `CancelToken`.
 */
CancelToken.source = function source() {
  var cancel;
  var token = new CancelToken(function executor(c) {
    cancel = c;
  });
  return {
    token: token,
    cancel: cancel
  };
};

module.exports = CancelToken;


/***/ }),

/***/ 1475:
/***/ (function(module) {

"use strict";


module.exports = function isCancel(value) {
  return !!(value && value.__CANCEL__);
};


/***/ }),

/***/ 5029:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(7485);
var buildURL = __webpack_require__(581);
var InterceptorManager = __webpack_require__(8096);
var dispatchRequest = __webpack_require__(5009);
var mergeConfig = __webpack_require__(4941);
var validator = __webpack_require__(6144);

var validators = validator.validators;
/**
 * Create a new instance of Axios
 *
 * @param {Object} instanceConfig The default config for the instance
 */
function Axios(instanceConfig) {
  this.defaults = instanceConfig;
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}

/**
 * Dispatch a request
 *
 * @param {Object} config The config specific for this request (merged with this.defaults)
 */
Axios.prototype.request = function request(config) {
  /*eslint no-param-reassign:0*/
  // Allow for axios('example/url'[, config]) a la fetch API
  if (typeof config === 'string') {
    config = arguments[1] || {};
    config.url = arguments[0];
  } else {
    config = config || {};
  }

  config = mergeConfig(this.defaults, config);

  // Set config.method
  if (config.method) {
    config.method = config.method.toLowerCase();
  } else if (this.defaults.method) {
    config.method = this.defaults.method.toLowerCase();
  } else {
    config.method = 'get';
  }

  var transitional = config.transitional;

  if (transitional !== undefined) {
    validator.assertOptions(transitional, {
      silentJSONParsing: validators.transitional(validators.boolean, '1.0.0'),
      forcedJSONParsing: validators.transitional(validators.boolean, '1.0.0'),
      clarifyTimeoutError: validators.transitional(validators.boolean, '1.0.0')
    }, false);
  }

  // filter out skipped interceptors
  var requestInterceptorChain = [];
  var synchronousRequestInterceptors = true;
  this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
    if (typeof interceptor.runWhen === 'function' && interceptor.runWhen(config) === false) {
      return;
    }

    synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous;

    requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected);
  });

  var responseInterceptorChain = [];
  this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
    responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
  });

  var promise;

  if (!synchronousRequestInterceptors) {
    var chain = [dispatchRequest, undefined];

    Array.prototype.unshift.apply(chain, requestInterceptorChain);
    chain = chain.concat(responseInterceptorChain);

    promise = Promise.resolve(config);
    while (chain.length) {
      promise = promise.then(chain.shift(), chain.shift());
    }

    return promise;
  }


  var newConfig = config;
  while (requestInterceptorChain.length) {
    var onFulfilled = requestInterceptorChain.shift();
    var onRejected = requestInterceptorChain.shift();
    try {
      newConfig = onFulfilled(newConfig);
    } catch (error) {
      onRejected(error);
      break;
    }
  }

  try {
    promise = dispatchRequest(newConfig);
  } catch (error) {
    return Promise.reject(error);
  }

  while (responseInterceptorChain.length) {
    promise = promise.then(responseInterceptorChain.shift(), responseInterceptorChain.shift());
  }

  return promise;
};

Axios.prototype.getUri = function getUri(config) {
  config = mergeConfig(this.defaults, config);
  return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, '');
};

// Provide aliases for supported request methods
utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, config) {
    return this.request(mergeConfig(config || {}, {
      method: method,
      url: url,
      data: (config || {}).data
    }));
  };
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, data, config) {
    return this.request(mergeConfig(config || {}, {
      method: method,
      url: url,
      data: data
    }));
  };
});

module.exports = Axios;


/***/ }),

/***/ 8096:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(7485);

function InterceptorManager() {
  this.handlers = [];
}

/**
 * Add a new interceptor to the stack
 *
 * @param {Function} fulfilled The function to handle `then` for a `Promise`
 * @param {Function} rejected The function to handle `reject` for a `Promise`
 *
 * @return {Number} An ID used to remove interceptor later
 */
InterceptorManager.prototype.use = function use(fulfilled, rejected, options) {
  this.handlers.push({
    fulfilled: fulfilled,
    rejected: rejected,
    synchronous: options ? options.synchronous : false,
    runWhen: options ? options.runWhen : null
  });
  return this.handlers.length - 1;
};

/**
 * Remove an interceptor from the stack
 *
 * @param {Number} id The ID that was returned by `use`
 */
InterceptorManager.prototype.eject = function eject(id) {
  if (this.handlers[id]) {
    this.handlers[id] = null;
  }
};

/**
 * Iterate over all the registered interceptors
 *
 * This method is particularly useful for skipping over any
 * interceptors that may have become `null` calling `eject`.
 *
 * @param {Function} fn The function to call for each interceptor
 */
InterceptorManager.prototype.forEach = function forEach(fn) {
  utils.forEach(this.handlers, function forEachHandler(h) {
    if (h !== null) {
      fn(h);
    }
  });
};

module.exports = InterceptorManager;


/***/ }),

/***/ 574:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


var isAbsoluteURL = __webpack_require__(2642);
var combineURLs = __webpack_require__(2288);

/**
 * Creates a new URL by combining the baseURL with the requestedURL,
 * only when the requestedURL is not already an absolute URL.
 * If the requestURL is absolute, this function returns the requestedURL untouched.
 *
 * @param {string} baseURL The base URL
 * @param {string} requestedURL Absolute or relative URL to combine
 * @returns {string} The combined full path
 */
module.exports = function buildFullPath(baseURL, requestedURL) {
  if (baseURL && !isAbsoluteURL(requestedURL)) {
    return combineURLs(baseURL, requestedURL);
  }
  return requestedURL;
};


/***/ }),

/***/ 8524:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


var enhanceError = __webpack_require__(9953);

/**
 * Create an Error with the specified message, config, error code, request and response.
 *
 * @param {string} message The error message.
 * @param {Object} config The config.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 * @param {Object} [request] The request.
 * @param {Object} [response] The response.
 * @returns {Error} The created error.
 */
module.exports = function createError(message, config, code, request, response) {
  var error = new Error(message);
  return enhanceError(error, config, code, request, response);
};


/***/ }),

/***/ 5009:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(7485);
var transformData = __webpack_require__(9212);
var isCancel = __webpack_require__(1475);
var defaults = __webpack_require__(3141);

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
function throwIfCancellationRequested(config) {
  if (config.cancelToken) {
    config.cancelToken.throwIfRequested();
  }
}

/**
 * Dispatch a request to the server using the configured adapter.
 *
 * @param {object} config The config that is to be used for the request
 * @returns {Promise} The Promise to be fulfilled
 */
module.exports = function dispatchRequest(config) {
  throwIfCancellationRequested(config);

  // Ensure headers exist
  config.headers = config.headers || {};

  // Transform request data
  config.data = transformData.call(
    config,
    config.data,
    config.headers,
    config.transformRequest
  );

  // Flatten headers
  config.headers = utils.merge(
    config.headers.common || {},
    config.headers[config.method] || {},
    config.headers
  );

  utils.forEach(
    ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
    function cleanHeaderConfig(method) {
      delete config.headers[method];
    }
  );

  var adapter = config.adapter || defaults.adapter;

  return adapter(config).then(function onAdapterResolution(response) {
    throwIfCancellationRequested(config);

    // Transform response data
    response.data = transformData.call(
      config,
      response.data,
      response.headers,
      config.transformResponse
    );

    return response;
  }, function onAdapterRejection(reason) {
    if (!isCancel(reason)) {
      throwIfCancellationRequested(config);

      // Transform response data
      if (reason && reason.response) {
        reason.response.data = transformData.call(
          config,
          reason.response.data,
          reason.response.headers,
          config.transformResponse
        );
      }
    }

    return Promise.reject(reason);
  });
};


/***/ }),

/***/ 9953:
/***/ (function(module) {

"use strict";


/**
 * Update an Error with the specified config, error code, and response.
 *
 * @param {Error} error The error to update.
 * @param {Object} config The config.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 * @param {Object} [request] The request.
 * @param {Object} [response] The response.
 * @returns {Error} The error.
 */
module.exports = function enhanceError(error, config, code, request, response) {
  error.config = config;
  if (code) {
    error.code = code;
  }

  error.request = request;
  error.response = response;
  error.isAxiosError = true;

  error.toJSON = function toJSON() {
    return {
      // Standard
      message: this.message,
      name: this.name,
      // Microsoft
      description: this.description,
      number: this.number,
      // Mozilla
      fileName: this.fileName,
      lineNumber: this.lineNumber,
      columnNumber: this.columnNumber,
      stack: this.stack,
      // Axios
      config: this.config,
      code: this.code
    };
  };
  return error;
};


/***/ }),

/***/ 4941:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(7485);

/**
 * Config-specific merge-function which creates a new config-object
 * by merging two configuration objects together.
 *
 * @param {Object} config1
 * @param {Object} config2
 * @returns {Object} New object resulting from merging config2 to config1
 */
module.exports = function mergeConfig(config1, config2) {
  // eslint-disable-next-line no-param-reassign
  config2 = config2 || {};
  var config = {};

  var valueFromConfig2Keys = ['url', 'method', 'data'];
  var mergeDeepPropertiesKeys = ['headers', 'auth', 'proxy', 'params'];
  var defaultToConfig2Keys = [
    'baseURL', 'transformRequest', 'transformResponse', 'paramsSerializer',
    'timeout', 'timeoutMessage', 'withCredentials', 'adapter', 'responseType', 'xsrfCookieName',
    'xsrfHeaderName', 'onUploadProgress', 'onDownloadProgress', 'decompress',
    'maxContentLength', 'maxBodyLength', 'maxRedirects', 'transport', 'httpAgent',
    'httpsAgent', 'cancelToken', 'socketPath', 'responseEncoding'
  ];
  var directMergeKeys = ['validateStatus'];

  function getMergedValue(target, source) {
    if (utils.isPlainObject(target) && utils.isPlainObject(source)) {
      return utils.merge(target, source);
    } else if (utils.isPlainObject(source)) {
      return utils.merge({}, source);
    } else if (utils.isArray(source)) {
      return source.slice();
    }
    return source;
  }

  function mergeDeepProperties(prop) {
    if (!utils.isUndefined(config2[prop])) {
      config[prop] = getMergedValue(config1[prop], config2[prop]);
    } else if (!utils.isUndefined(config1[prop])) {
      config[prop] = getMergedValue(undefined, config1[prop]);
    }
  }

  utils.forEach(valueFromConfig2Keys, function valueFromConfig2(prop) {
    if (!utils.isUndefined(config2[prop])) {
      config[prop] = getMergedValue(undefined, config2[prop]);
    }
  });

  utils.forEach(mergeDeepPropertiesKeys, mergeDeepProperties);

  utils.forEach(defaultToConfig2Keys, function defaultToConfig2(prop) {
    if (!utils.isUndefined(config2[prop])) {
      config[prop] = getMergedValue(undefined, config2[prop]);
    } else if (!utils.isUndefined(config1[prop])) {
      config[prop] = getMergedValue(undefined, config1[prop]);
    }
  });

  utils.forEach(directMergeKeys, function merge(prop) {
    if (prop in config2) {
      config[prop] = getMergedValue(config1[prop], config2[prop]);
    } else if (prop in config1) {
      config[prop] = getMergedValue(undefined, config1[prop]);
    }
  });

  var axiosKeys = valueFromConfig2Keys
    .concat(mergeDeepPropertiesKeys)
    .concat(defaultToConfig2Keys)
    .concat(directMergeKeys);

  var otherKeys = Object
    .keys(config1)
    .concat(Object.keys(config2))
    .filter(function filterAxiosKeys(key) {
      return axiosKeys.indexOf(key) === -1;
    });

  utils.forEach(otherKeys, mergeDeepProperties);

  return config;
};


/***/ }),

/***/ 4570:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


var createError = __webpack_require__(8524);

/**
 * Resolve or reject a Promise based on response status.
 *
 * @param {Function} resolve A function that resolves the promise.
 * @param {Function} reject A function that rejects the promise.
 * @param {object} response The response.
 */
module.exports = function settle(resolve, reject, response) {
  var validateStatus = response.config.validateStatus;
  if (!response.status || !validateStatus || validateStatus(response.status)) {
    resolve(response);
  } else {
    reject(createError(
      'Request failed with status code ' + response.status,
      response.config,
      null,
      response.request,
      response
    ));
  }
};


/***/ }),

/***/ 9212:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(7485);
var defaults = __webpack_require__(3141);

/**
 * Transform the data for a request or a response
 *
 * @param {Object|String} data The data to be transformed
 * @param {Array} headers The headers for the request or response
 * @param {Array|Function} fns A single function or Array of functions
 * @returns {*} The resulting transformed data
 */
module.exports = function transformData(data, headers, fns) {
  var context = this || defaults;
  /*eslint no-param-reassign:0*/
  utils.forEach(fns, function transform(fn) {
    data = fn.call(context, data, headers);
  });

  return data;
};


/***/ }),

/***/ 3141:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(7485);
var normalizeHeaderName = __webpack_require__(1446);
var enhanceError = __webpack_require__(9953);

var DEFAULT_CONTENT_TYPE = {
  'Content-Type': 'application/x-www-form-urlencoded'
};

function setContentTypeIfUnset(headers, value) {
  if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
    headers['Content-Type'] = value;
  }
}

function getDefaultAdapter() {
  var adapter;
  if (typeof XMLHttpRequest !== 'undefined') {
    // For browsers use XHR adapter
    adapter = __webpack_require__(4387);
  } else if (typeof process !== 'undefined' && Object.prototype.toString.call(process) === '[object process]') {
    // For node use HTTP adapter
    adapter = __webpack_require__(4387);
  }
  return adapter;
}

function stringifySafely(rawValue, parser, encoder) {
  if (utils.isString(rawValue)) {
    try {
      (parser || JSON.parse)(rawValue);
      return utils.trim(rawValue);
    } catch (e) {
      if (e.name !== 'SyntaxError') {
        throw e;
      }
    }
  }

  return (encoder || JSON.stringify)(rawValue);
}

var defaults = {

  transitional: {
    silentJSONParsing: true,
    forcedJSONParsing: true,
    clarifyTimeoutError: false
  },

  adapter: getDefaultAdapter(),

  transformRequest: [function transformRequest(data, headers) {
    normalizeHeaderName(headers, 'Accept');
    normalizeHeaderName(headers, 'Content-Type');

    if (utils.isFormData(data) ||
      utils.isArrayBuffer(data) ||
      utils.isBuffer(data) ||
      utils.isStream(data) ||
      utils.isFile(data) ||
      utils.isBlob(data)
    ) {
      return data;
    }
    if (utils.isArrayBufferView(data)) {
      return data.buffer;
    }
    if (utils.isURLSearchParams(data)) {
      setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
      return data.toString();
    }
    if (utils.isObject(data) || (headers && headers['Content-Type'] === 'application/json')) {
      setContentTypeIfUnset(headers, 'application/json');
      return stringifySafely(data);
    }
    return data;
  }],

  transformResponse: [function transformResponse(data) {
    var transitional = this.transitional;
    var silentJSONParsing = transitional && transitional.silentJSONParsing;
    var forcedJSONParsing = transitional && transitional.forcedJSONParsing;
    var strictJSONParsing = !silentJSONParsing && this.responseType === 'json';

    if (strictJSONParsing || (forcedJSONParsing && utils.isString(data) && data.length)) {
      try {
        return JSON.parse(data);
      } catch (e) {
        if (strictJSONParsing) {
          if (e.name === 'SyntaxError') {
            throw enhanceError(e, this, 'E_JSON_PARSE');
          }
          throw e;
        }
      }
    }

    return data;
  }],

  /**
   * A timeout in milliseconds to abort a request. If set to 0 (default) a
   * timeout is not created.
   */
  timeout: 0,

  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',

  maxContentLength: -1,
  maxBodyLength: -1,

  validateStatus: function validateStatus(status) {
    return status >= 200 && status < 300;
  }
};

defaults.headers = {
  common: {
    'Accept': 'application/json, text/plain, */*'
  }
};

utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
  defaults.headers[method] = {};
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  defaults.headers[method] = utils.merge(DEFAULT_CONTENT_TYPE);
});

module.exports = defaults;


/***/ }),

/***/ 875:
/***/ (function(module) {

"use strict";


module.exports = function bind(fn, thisArg) {
  return function wrap() {
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    return fn.apply(thisArg, args);
  };
};


/***/ }),

/***/ 581:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(7485);

function encode(val) {
  return encodeURIComponent(val).
    replace(/%3A/gi, ':').
    replace(/%24/g, '$').
    replace(/%2C/gi, ',').
    replace(/%20/g, '+').
    replace(/%5B/gi, '[').
    replace(/%5D/gi, ']');
}

/**
 * Build a URL by appending params to the end
 *
 * @param {string} url The base of the url (e.g., http://www.google.com)
 * @param {object} [params] The params to be appended
 * @returns {string} The formatted url
 */
module.exports = function buildURL(url, params, paramsSerializer) {
  /*eslint no-param-reassign:0*/
  if (!params) {
    return url;
  }

  var serializedParams;
  if (paramsSerializer) {
    serializedParams = paramsSerializer(params);
  } else if (utils.isURLSearchParams(params)) {
    serializedParams = params.toString();
  } else {
    var parts = [];

    utils.forEach(params, function serialize(val, key) {
      if (val === null || typeof val === 'undefined') {
        return;
      }

      if (utils.isArray(val)) {
        key = key + '[]';
      } else {
        val = [val];
      }

      utils.forEach(val, function parseValue(v) {
        if (utils.isDate(v)) {
          v = v.toISOString();
        } else if (utils.isObject(v)) {
          v = JSON.stringify(v);
        }
        parts.push(encode(key) + '=' + encode(v));
      });
    });

    serializedParams = parts.join('&');
  }

  if (serializedParams) {
    var hashmarkIndex = url.indexOf('#');
    if (hashmarkIndex !== -1) {
      url = url.slice(0, hashmarkIndex);
    }

    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }

  return url;
};


/***/ }),

/***/ 2288:
/***/ (function(module) {

"use strict";


/**
 * Creates a new URL by combining the specified URLs
 *
 * @param {string} baseURL The base URL
 * @param {string} relativeURL The relative URL
 * @returns {string} The combined URL
 */
module.exports = function combineURLs(baseURL, relativeURL) {
  return relativeURL
    ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
    : baseURL;
};


/***/ }),

/***/ 2940:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(7485);

module.exports = (
  utils.isStandardBrowserEnv() ?

  // Standard browser envs support document.cookie
    (function standardBrowserEnv() {
      return {
        write: function write(name, value, expires, path, domain, secure) {
          var cookie = [];
          cookie.push(name + '=' + encodeURIComponent(value));

          if (utils.isNumber(expires)) {
            cookie.push('expires=' + new Date(expires).toGMTString());
          }

          if (utils.isString(path)) {
            cookie.push('path=' + path);
          }

          if (utils.isString(domain)) {
            cookie.push('domain=' + domain);
          }

          if (secure === true) {
            cookie.push('secure');
          }

          document.cookie = cookie.join('; ');
        },

        read: function read(name) {
          var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
          return (match ? decodeURIComponent(match[3]) : null);
        },

        remove: function remove(name) {
          this.write(name, '', Date.now() - 86400000);
        }
      };
    })() :

  // Non standard browser env (web workers, react-native) lack needed support.
    (function nonStandardBrowserEnv() {
      return {
        write: function write() {},
        read: function read() { return null; },
        remove: function remove() {}
      };
    })()
);


/***/ }),

/***/ 2642:
/***/ (function(module) {

"use strict";


/**
 * Determines whether the specified URL is absolute
 *
 * @param {string} url The URL to test
 * @returns {boolean} True if the specified URL is absolute, otherwise false
 */
module.exports = function isAbsoluteURL(url) {
  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
  // by any combination of letters, digits, plus, period, or hyphen.
  return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
};


/***/ }),

/***/ 5835:
/***/ (function(module) {

"use strict";


/**
 * Determines whether the payload is an error thrown by Axios
 *
 * @param {*} payload The value to test
 * @returns {boolean} True if the payload is an error thrown by Axios, otherwise false
 */
module.exports = function isAxiosError(payload) {
  return (typeof payload === 'object') && (payload.isAxiosError === true);
};


/***/ }),

/***/ 8338:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(7485);

module.exports = (
  utils.isStandardBrowserEnv() ?

  // Standard browser envs have full support of the APIs needed to test
  // whether the request URL is of the same origin as current location.
    (function standardBrowserEnv() {
      var msie = /(msie|trident)/i.test(navigator.userAgent);
      var urlParsingNode = document.createElement('a');
      var originURL;

      /**
    * Parse a URL to discover it's components
    *
    * @param {String} url The URL to be parsed
    * @returns {Object}
    */
      function resolveURL(url) {
        var href = url;

        if (msie) {
        // IE needs attribute set twice to normalize properties
          urlParsingNode.setAttribute('href', href);
          href = urlParsingNode.href;
        }

        urlParsingNode.setAttribute('href', href);

        // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
        return {
          href: urlParsingNode.href,
          protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
          host: urlParsingNode.host,
          search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
          hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
          hostname: urlParsingNode.hostname,
          port: urlParsingNode.port,
          pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
            urlParsingNode.pathname :
            '/' + urlParsingNode.pathname
        };
      }

      originURL = resolveURL(window.location.href);

      /**
    * Determine if a URL shares the same origin as the current location
    *
    * @param {String} requestURL The URL to test
    * @returns {boolean} True if URL shares the same origin, otherwise false
    */
      return function isURLSameOrigin(requestURL) {
        var parsed = (utils.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
        return (parsed.protocol === originURL.protocol &&
            parsed.host === originURL.host);
      };
    })() :

  // Non standard browser envs (web workers, react-native) lack needed support.
    (function nonStandardBrowserEnv() {
      return function isURLSameOrigin() {
        return true;
      };
    })()
);


/***/ }),

/***/ 1446:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(7485);

module.exports = function normalizeHeaderName(headers, normalizedName) {
  utils.forEach(headers, function processHeader(value, name) {
    if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
      headers[normalizedName] = value;
      delete headers[name];
    }
  });
};


/***/ }),

/***/ 3845:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(7485);

// Headers whose duplicates are ignored by node
// c.f. https://nodejs.org/api/http.html#http_message_headers
var ignoreDuplicateOf = [
  'age', 'authorization', 'content-length', 'content-type', 'etag',
  'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
  'last-modified', 'location', 'max-forwards', 'proxy-authorization',
  'referer', 'retry-after', 'user-agent'
];

/**
 * Parse headers into an object
 *
 * ```
 * Date: Wed, 27 Aug 2014 08:58:49 GMT
 * Content-Type: application/json
 * Connection: keep-alive
 * Transfer-Encoding: chunked
 * ```
 *
 * @param {String} headers Headers needing to be parsed
 * @returns {Object} Headers parsed into an object
 */
module.exports = function parseHeaders(headers) {
  var parsed = {};
  var key;
  var val;
  var i;

  if (!headers) { return parsed; }

  utils.forEach(headers.split('\n'), function parser(line) {
    i = line.indexOf(':');
    key = utils.trim(line.substr(0, i)).toLowerCase();
    val = utils.trim(line.substr(i + 1));

    if (key) {
      if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
        return;
      }
      if (key === 'set-cookie') {
        parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
      } else {
        parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
      }
    }
  });

  return parsed;
};


/***/ }),

/***/ 5739:
/***/ (function(module) {

"use strict";


/**
 * Syntactic sugar for invoking a function and expanding an array for arguments.
 *
 * Common use case would be to use `Function.prototype.apply`.
 *
 *  ```js
 *  function f(x, y, z) {}
 *  var args = [1, 2, 3];
 *  f.apply(null, args);
 *  ```
 *
 * With `spread` this example can be re-written.
 *
 *  ```js
 *  spread(function(x, y, z) {})([1, 2, 3]);
 *  ```
 *
 * @param {Function} callback
 * @returns {Function}
 */
module.exports = function spread(callback) {
  return function wrap(arr) {
    return callback.apply(null, arr);
  };
};


/***/ }),

/***/ 6144:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


var pkg = __webpack_require__(9843);

var validators = {};

// eslint-disable-next-line func-names
['object', 'boolean', 'number', 'function', 'string', 'symbol'].forEach(function(type, i) {
  validators[type] = function validator(thing) {
    return typeof thing === type || 'a' + (i < 1 ? 'n ' : ' ') + type;
  };
});

var deprecatedWarnings = {};
var currentVerArr = pkg.version.split('.');

/**
 * Compare package versions
 * @param {string} version
 * @param {string?} thanVersion
 * @returns {boolean}
 */
function isOlderVersion(version, thanVersion) {
  var pkgVersionArr = thanVersion ? thanVersion.split('.') : currentVerArr;
  var destVer = version.split('.');
  for (var i = 0; i < 3; i++) {
    if (pkgVersionArr[i] > destVer[i]) {
      return true;
    } else if (pkgVersionArr[i] < destVer[i]) {
      return false;
    }
  }
  return false;
}

/**
 * Transitional option validator
 * @param {function|boolean?} validator
 * @param {string?} version
 * @param {string} message
 * @returns {function}
 */
validators.transitional = function transitional(validator, version, message) {
  var isDeprecated = version && isOlderVersion(version);

  function formatMessage(opt, desc) {
    return '[Axios v' + pkg.version + '] Transitional option \'' + opt + '\'' + desc + (message ? '. ' + message : '');
  }

  // eslint-disable-next-line func-names
  return function(value, opt, opts) {
    if (validator === false) {
      throw new Error(formatMessage(opt, ' has been removed in ' + version));
    }

    if (isDeprecated && !deprecatedWarnings[opt]) {
      deprecatedWarnings[opt] = true;
      // eslint-disable-next-line no-console
      console.warn(
        formatMessage(
          opt,
          ' has been deprecated since v' + version + ' and will be removed in the near future'
        )
      );
    }

    return validator ? validator(value, opt, opts) : true;
  };
};

/**
 * Assert object's properties type
 * @param {object} options
 * @param {object} schema
 * @param {boolean?} allowUnknown
 */

function assertOptions(options, schema, allowUnknown) {
  if (typeof options !== 'object') {
    throw new TypeError('options must be an object');
  }
  var keys = Object.keys(options);
  var i = keys.length;
  while (i-- > 0) {
    var opt = keys[i];
    var validator = schema[opt];
    if (validator) {
      var value = options[opt];
      var result = value === undefined || validator(value, opt, options);
      if (result !== true) {
        throw new TypeError('option ' + opt + ' must be ' + result);
      }
      continue;
    }
    if (allowUnknown !== true) {
      throw Error('Unknown option ' + opt);
    }
  }
}

module.exports = {
  isOlderVersion: isOlderVersion,
  assertOptions: assertOptions,
  validators: validators
};


/***/ }),

/***/ 7485:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


var bind = __webpack_require__(875);

// utils is a library of generic helper functions non-specific to axios

var toString = Object.prototype.toString;

/**
 * Determine if a value is an Array
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Array, otherwise false
 */
function isArray(val) {
  return toString.call(val) === '[object Array]';
}

/**
 * Determine if a value is undefined
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if the value is undefined, otherwise false
 */
function isUndefined(val) {
  return typeof val === 'undefined';
}

/**
 * Determine if a value is a Buffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Buffer, otherwise false
 */
function isBuffer(val) {
  return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor)
    && typeof val.constructor.isBuffer === 'function' && val.constructor.isBuffer(val);
}

/**
 * Determine if a value is an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an ArrayBuffer, otherwise false
 */
function isArrayBuffer(val) {
  return toString.call(val) === '[object ArrayBuffer]';
}

/**
 * Determine if a value is a FormData
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an FormData, otherwise false
 */
function isFormData(val) {
  return (typeof FormData !== 'undefined') && (val instanceof FormData);
}

/**
 * Determine if a value is a view on an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
 */
function isArrayBufferView(val) {
  var result;
  if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
    result = ArrayBuffer.isView(val);
  } else {
    result = (val) && (val.buffer) && (val.buffer instanceof ArrayBuffer);
  }
  return result;
}

/**
 * Determine if a value is a String
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a String, otherwise false
 */
function isString(val) {
  return typeof val === 'string';
}

/**
 * Determine if a value is a Number
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Number, otherwise false
 */
function isNumber(val) {
  return typeof val === 'number';
}

/**
 * Determine if a value is an Object
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Object, otherwise false
 */
function isObject(val) {
  return val !== null && typeof val === 'object';
}

/**
 * Determine if a value is a plain Object
 *
 * @param {Object} val The value to test
 * @return {boolean} True if value is a plain Object, otherwise false
 */
function isPlainObject(val) {
  if (toString.call(val) !== '[object Object]') {
    return false;
  }

  var prototype = Object.getPrototypeOf(val);
  return prototype === null || prototype === Object.prototype;
}

/**
 * Determine if a value is a Date
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Date, otherwise false
 */
function isDate(val) {
  return toString.call(val) === '[object Date]';
}

/**
 * Determine if a value is a File
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a File, otherwise false
 */
function isFile(val) {
  return toString.call(val) === '[object File]';
}

/**
 * Determine if a value is a Blob
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Blob, otherwise false
 */
function isBlob(val) {
  return toString.call(val) === '[object Blob]';
}

/**
 * Determine if a value is a Function
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Function, otherwise false
 */
function isFunction(val) {
  return toString.call(val) === '[object Function]';
}

/**
 * Determine if a value is a Stream
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Stream, otherwise false
 */
function isStream(val) {
  return isObject(val) && isFunction(val.pipe);
}

/**
 * Determine if a value is a URLSearchParams object
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a URLSearchParams object, otherwise false
 */
function isURLSearchParams(val) {
  return typeof URLSearchParams !== 'undefined' && val instanceof URLSearchParams;
}

/**
 * Trim excess whitespace off the beginning and end of a string
 *
 * @param {String} str The String to trim
 * @returns {String} The String freed of excess whitespace
 */
function trim(str) {
  return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '');
}

/**
 * Determine if we're running in a standard browser environment
 *
 * This allows axios to run in a web worker, and react-native.
 * Both environments support XMLHttpRequest, but not fully standard globals.
 *
 * web workers:
 *  typeof window -> undefined
 *  typeof document -> undefined
 *
 * react-native:
 *  navigator.product -> 'ReactNative'
 * nativescript
 *  navigator.product -> 'NativeScript' or 'NS'
 */
function isStandardBrowserEnv() {
  if (typeof navigator !== 'undefined' && (navigator.product === 'ReactNative' ||
                                           navigator.product === 'NativeScript' ||
                                           navigator.product === 'NS')) {
    return false;
  }
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined'
  );
}

/**
 * Iterate over an Array or an Object invoking a function for each item.
 *
 * If `obj` is an Array callback will be called passing
 * the value, index, and complete array for each item.
 *
 * If 'obj' is an Object callback will be called passing
 * the value, key, and complete object for each property.
 *
 * @param {Object|Array} obj The object to iterate
 * @param {Function} fn The callback to invoke for each item
 */
function forEach(obj, fn) {
  // Don't bother if no value provided
  if (obj === null || typeof obj === 'undefined') {
    return;
  }

  // Force an array if not already something iterable
  if (typeof obj !== 'object') {
    /*eslint no-param-reassign:0*/
    obj = [obj];
  }

  if (isArray(obj)) {
    // Iterate over array values
    for (var i = 0, l = obj.length; i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    // Iterate over object keys
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        fn.call(null, obj[key], key, obj);
      }
    }
  }
}

/**
 * Accepts varargs expecting each argument to be an object, then
 * immutably merges the properties of each object and returns result.
 *
 * When multiple objects contain the same key the later object in
 * the arguments list will take precedence.
 *
 * Example:
 *
 * ```js
 * var result = merge({foo: 123}, {foo: 456});
 * console.log(result.foo); // outputs 456
 * ```
 *
 * @param {Object} obj1 Object to merge
 * @returns {Object} Result of all merge properties
 */
function merge(/* obj1, obj2, obj3, ... */) {
  var result = {};
  function assignValue(val, key) {
    if (isPlainObject(result[key]) && isPlainObject(val)) {
      result[key] = merge(result[key], val);
    } else if (isPlainObject(val)) {
      result[key] = merge({}, val);
    } else if (isArray(val)) {
      result[key] = val.slice();
    } else {
      result[key] = val;
    }
  }

  for (var i = 0, l = arguments.length; i < l; i++) {
    forEach(arguments[i], assignValue);
  }
  return result;
}

/**
 * Extends object a by mutably adding to it the properties of object b.
 *
 * @param {Object} a The object to be extended
 * @param {Object} b The object to copy properties from
 * @param {Object} thisArg The object to bind function to
 * @return {Object} The resulting value of object a
 */
function extend(a, b, thisArg) {
  forEach(b, function assignValue(val, key) {
    if (thisArg && typeof val === 'function') {
      a[key] = bind(val, thisArg);
    } else {
      a[key] = val;
    }
  });
  return a;
}

/**
 * Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
 *
 * @param {string} content with BOM
 * @return {string} content value without BOM
 */
function stripBOM(content) {
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  return content;
}

module.exports = {
  isArray: isArray,
  isArrayBuffer: isArrayBuffer,
  isBuffer: isBuffer,
  isFormData: isFormData,
  isArrayBufferView: isArrayBufferView,
  isString: isString,
  isNumber: isNumber,
  isObject: isObject,
  isPlainObject: isPlainObject,
  isUndefined: isUndefined,
  isDate: isDate,
  isFile: isFile,
  isBlob: isBlob,
  isFunction: isFunction,
  isStream: isStream,
  isURLSearchParams: isURLSearchParams,
  isStandardBrowserEnv: isStandardBrowserEnv,
  forEach: forEach,
  merge: merge,
  extend: extend,
  trim: trim,
  stripBOM: stripBOM
};


/***/ }),

/***/ 1259:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "X", ({
  value: true
}));
exports.Z = void 0;

var _factory = __webpack_require__(1956);

var _mArticle = _interopRequireDefault(__webpack_require__(6454));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default2 = {
  components: {
    'm-article': _mArticle.default
  },
  inject: {
    data: {
      type: Object,
      default: function _default() {}
    }
  },
  data: function data() {
    return {
      actionURL: _factory.actionURL
    };
  }
};
exports.Z = _default2;

/***/ }),

/***/ 1622:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "X", ({
  value: true
}));
exports.Z = void 0;

var _axios = __webpack_require__(5347);

var _factory = __webpack_require__(1956);

var _Svg = _interopRequireDefault(__webpack_require__(1798));

var _vue = __webpack_require__(7834);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

var _default = {
  components: {
    'm-svg': _Svg.default
  },
  setup: function setup() {
    var info = (0, _vue.inject)('set');
    var social = (0, _vue.reactive)([]);
    var socialData = ['yt', 'ig', 'fb'];
    var socialName = ['youtube', 'instagram', 'facebook'];
    var sccialURL = ['youtubeURL', 'instagramURL', 'facebookURL'];

    for (var i = 0; i < socialData.length; i += 1) {
      social.push({
        icon: socialData[i],
        name: socialName[i],
        URL: info[sccialURL[i]]
      });
    }

    return {
      info: info,
      social: social
    };
  },
  data: function data() {
    return {
      language: (0, _factory.language)(),
      actionURL: _factory.actionURL,
      links: [],
      isAct: null
    };
  },
  created: function created() {
    var vm = this;

    var apiAsync = /*#__PURE__*/function () {
      var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return (0, _axios.apiCategories)({
                  FunctionCode: 'link'
                }).then(function (res) {
                  var status = res.status,
                      data = res.data;

                  if (status === 200) {
                    var items = data.data.items;

                    for (var i = 0; i < items.length; i += 1) {
                      vm.links.push(items[i]);
                      vm.links[i].subLinks = [];
                    }
                  }
                });

              case 2:
                _context.next = 4;
                return (0, _axios.apiLinks)({
                  CategoryId: null,
                  UserRoleId: null
                }).then(function (resp) {
                  var status = resp.status,
                      data = resp.data;

                  if (status === 200) {
                    var items = data.data.items;

                    for (var i = 0; i < items.length; i += 1) {
                      var categoryId = items[i].categoryId;

                      for (var j = 0; j < vm.links.length; j += 1) {
                        var linksCategoryId = vm.links[j].categoryId;

                        if (categoryId === linksCategoryId) {
                          vm.links[j].subLinks.push(items[i]);
                        }
                      }
                    }
                  }
                });

              case 4:
              case "end":
                return _context.stop();
            }
          }
        }, _callee);
      }));

      return function apiAsync() {
        return _ref.apply(this, arguments);
      };
    }();

    apiAsync();
  },
  methods: {
    clickLinks: function clickLinks(index) {
      var vm = this;

      if ((0, _factory.device)() === 'M') {
        if (vm.isAct !== null && vm.isAct === index) {
          vm.isAct = null;
        } else {
          vm.isAct = index;
        }
      }
    }
  }
};
exports.Z = _default;

/***/ }),

/***/ 3439:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "X", ({
  value: true
}));
exports.Z = void 0;

var _Svg = _interopRequireDefault(__webpack_require__(1798));

var _Nav = _interopRequireDefault(__webpack_require__(1141));

var _factory = __webpack_require__(1956);

var _vue = __webpack_require__(7834);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = {
  components: {
    'm-svg': _Svg.default,
    'm-nav': _Nav.default
  },
  setup: function setup() {
    var info = (0, _vue.inject)('set');
    return {
      info: info
    };
  },
  data: function data() {
    return {
      isHome: !!document.querySelector('#home'),
      language: (0, _factory.language)(),
      actionURL: _factory.actionURL
    };
  },
  created: function created() {
    var vm = this;

    switch (vm.info.colorTheme) {
      case 1:
        vm.info.styleClass = 'bg-xb139 pt:border-xb139 text-xf';
        vm.info.tabletClass = 't:bg-xb139';
        vm.info.logoClass = 'fill-xf';
        vm.info.navBgClass = 'tm:bg-xb139';
        vm.info.navTextClass = 'tm:text-xf';
        break;

      case 2:
        vm.info.styleClass = 'bg-x057d pt:border-x057d text-xf';
        vm.info.tabletClass = 't:bg-x057d';
        vm.info.logoClass = 'fill-xf';
        vm.info.navBgClass = 'tm:bg-x057d';
        vm.info.navTextClass = 'tm:text-xf';
        break;

      case 3:
        vm.info.styleClass = 'bg-xf pt:border-xdca1 text-xba79';
        vm.info.tabletClass = 't:bg-xf';
        vm.info.logoClass = 'fill-xba79';
        vm.info.navBgClass = 'tm:bg-xf';
        vm.info.navTextClass = 'tm:text-xba79';
        break;

      case 4:
        vm.info.styleClass = 'bg-xba79 pt:border-xba79 text-xf';
        vm.info.tabletClass = 't:bg-xba79';
        vm.info.logoClass = 'fill-xf';
        vm.info.navBgClass = 'tm:bg-xba79';
        vm.info.navTextClass = 'tm:text-xf';
        break;

      default:
        break;
    }
  },
  methods: {
    changeColor: function changeColor(color) {
      var vm = this;
      return vm.isHome ? color : 'text-x1479';
    },
    logoPath: function logoPath(item) {
      return (0, _factory.getImageSrc)(item.logoFilePath);
    }
  }
};
exports.Z = _default;

/***/ }),

/***/ 81:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "X", ({
  value: true
}));
exports.Z = void 0;

var _factory = __webpack_require__(1956);

var _default2 = {
  props: {
    datas: {
      type: [Object, Array],
      default: function _default() {}
    }
  },
  data: function data() {
    return {
      imgPath: (0, _factory.path)('apiPath')
    };
  },
  computed: {
    bannerImg: function bannerImg() {
      var vm = this;
      var src = '/static/img/banner.jpg';

      if (true) {
        src = (0, _factory.getImageSrc)(vm.datas.data.menuPage.menuPageBannerPath);
      }

      return src;
    }
  }
};
exports.Z = _default2;

/***/ }),

/***/ 132:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "X", ({
  value: true
}));
exports.Z = void 0;

var _mMenu = _interopRequireDefault(__webpack_require__(4145));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default2 = {
  components: {
    'm-menu': _mMenu.default
  },
  props: {
    datas: {
      type: [Object, Array],
      default: function _default() {}
    }
  },
  data: function data() {
    return {
      menu: [],
      category: null,
      pageItem: null
    };
  },
  created: function created() {
    var vm = this;
    vm.menu = vm.datas.data.menuPage.menuPageItems;
  }
};
exports.Z = _default2;

/***/ }),

/***/ 4569:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "X", ({
  value: true
}));
exports.Z = void 0;

var _axios = __webpack_require__(5347);

var _factory = __webpack_require__(1956);

var _vue = __webpack_require__(7834);

var _Svg = _interopRequireDefault(__webpack_require__(1798));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

var _default = {
  components: {
    'm-svg': _Svg.default
  },
  props: {
    bgColor: {
      type: String,
      default: ''
    },
    textColor: {
      type: String,
      default: ''
    },
    svgColor: {
      type: String,
      default: ''
    }
  },
  setup: function setup() {
    var langText = (0, _vue.ref)(null);
    var langURL = (0, _vue.ref)(null);
    (0, _factory.language)(function (item, lang, text) {
      langText = text;
      langURL = lang;
    });
    return {
      langText: langText,
      langURL: langURL
    };
  },
  data: function data() {
    return {
      language: (0, _factory.language)(),
      links: _factory.functionCode,
      actionURL: _factory.actionURL,
      listPath: (0, _factory.path)('listPath'),
      id: [],
      menu: [],
      isNav: null,
      isAct: false
    };
  },
  computed: {
    typeLinks: function typeLinks() {
      var vm = this;
      var links = [];

      if (/en/.test(vm.language)) {
        links = JSON.parse(document.querySelector('[name="engilshTypeLinks"]').value.replace(/'/g, '"'));
      } else {
        links = JSON.parse(document.querySelector('[name="chiineseTypeLinks"]').value.replace(/'/g, '"'));
      }

      return links;
    }
  },
  created: function created() {
    var vm = this;
    var routeId = null;
    var routeName = null;

    var apiAsync = /*#__PURE__*/function () {
      var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return (0, _axios.apiUserRoles)().then(function (res) {
                  var status = res.status,
                      data = res.data;

                  if (status === 200) {
                    var items = data.data.items;
                    console.log(data);

                    for (var i = 0; i < items.length; i += 1) {
                      vm.id.push(items[i]);

                      if (new RegExp(items[i].routeName).test(window.location.pathname)) {
                        routeId = items[i].userRoleId;
                        routeName = items[i].routeName;
                      }
                    }
                  }
                });

              case 2:
                _context.next = 4;
                return (0, _axios.apiMenu)({
                  UserRoleId: routeId,
                  UserRoleRouteName: routeName
                }).then(function (res) {
                  var data = res.data;

                  if (data.code === 200) {
                    var items = data.data.items;
                    console.log(items);

                    for (var i = 0; i < items.length; i += 1) {
                      if (items[i].children) {
                        items[i].children = vm.startDate(items[i].children);
                      }

                      vm.menu.push(items[i]);
                    }

                    vm.menu = vm.startDate(vm.menu);
                  }
                });

              case 4:
              case "end":
                return _context.stop();
            }
          }
        }, _callee);
      }));

      return function apiAsync() {
        return _ref.apply(this, arguments);
      };
    }();

    apiAsync().then(function () {
      vm.getMaxHeight();
      window.addEventListener('resize', vm.getMaxHeight);

      _factory.prjs.$b.on('keyup', function (e) {
        var keyCode = e.keyCode || e.which;

        if (keyCode === 9) {
          if ((0, _factory.j$)(e.target).parent().hasClass('.jNavItem'.replace(/^\./, ''))) {
            (0, _factory.j$)('.jNavItem').trigger('mouseleave');
            (0, _factory.j$)(e.target).parent().trigger('mouseenter');
          } else if (!(0, _factory.j$)(e.target).parents('.jNav')) {
            (0, _factory.j$)('.jNavItem').trigger('mouseleave');
          }
        }
      });
    });
  },
  methods: {
    startDate: function startDate(data) {
      return data.sort(function (a, b) {
        return Number(a.sortNumber) > Number(b.sortNumber) ? 1 : -1;
      });
    },
    getRel: function getRel(type) {
      return type === '_blank' ? 'noopener' : null;
    },
    getMaxHeight: function getMaxHeight() {
      var vm = this;
      var $navMainSub = document.querySelectorAll(".".concat(vm.$refs.navMainSub.classList[0]));
      $navMainSub.forEach(function (item) {
        item.style.maxHeight = "".concat(item.firstChild.clientHeight, "px");
      });
    },
    setNavFz: function setNavFz() {
      var vm = this;
      return /en/.test(vm.language) ? 'p:text-18' : 'p:text-20';
    },
    setNavIDFz: function setNavIDFz() {
      var vm = this;
      return /en/.test(vm.language) ? 'p:text-16' : 'p:text-18';
    },
    mouseenterFun: function mouseenterFun(index) {
      var vm = this;
      vm.isNav = index;
    },
    mouseleaveFun: function mouseleaveFun() {
      var vm = this;
      vm.isNav = null;
    }
  }
};
exports.Z = _default;

/***/ }),

/***/ 9461:
/***/ (function(__unused_webpack_module, exports) {

"use strict";


Object.defineProperty(exports, "X", ({
  value: true
}));
exports.Z = void 0;
var _default = {
  props: {
    svgIcon: {
      type: String,
      default: ''
    }
  }
};
exports.Z = _default;

/***/ }),

/***/ 1496:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "X", ({
  value: true
}));
exports.Z = void 0;

var _mTools = _interopRequireDefault(__webpack_require__(8394));

var _MenuNav = _interopRequireDefault(__webpack_require__(3375));

var _KvNav = _interopRequireDefault(__webpack_require__(163));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default2 = {
  components: {
    'm-tools': _mTools.default,
    'm-menu-nav': _MenuNav.default,
    'm-kv': _KvNav.default
  },
  inject: {
    data: {
      type: Object,
      default: function _default() {}
    }
  }
};
exports.Z = _default2;

/***/ }),

/***/ 1341:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "X", ({
  value: true
}));
exports.Z = void 0;

var _mTitle = _interopRequireDefault(__webpack_require__(8747));

var _mBreadCrumbs = _interopRequireDefault(__webpack_require__(1693));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default2 = {
  components: {
    'm-bread-crumbs': _mBreadCrumbs.default,
    'm-title': _mTitle.default
  },
  props: {
    style: {
      type: Object,
      default: function _default() {}
    },
    breadCrumbs: {
      type: Array,
      default: function _default() {
        return [];
      }
    }
  }
};
exports.Z = _default2;

/***/ }),

/***/ 5083:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "X", ({
  value: true
}));
exports.Z = void 0;

var _factory = __webpack_require__(1956);

var _default2 = {
  props: {
    path: {
      type: Array,
      default: function _default() {
        return [];
      }
    }
  },
  data: function data() {
    return {
      language: (0, _factory.language)(),
      actionURL: _factory.actionURL,
      breadCrumbs: []
    };
  }
};
exports.Z = _default2;

/***/ }),

/***/ 2873:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "X", ({
  value: true
}));
exports.Z = void 0;

var _common = __webpack_require__(1359);

var _factory = __webpack_require__(1956);

var _default2 = {
  props: {
    menu: {
      type: [Object, Array],
      default: function _default() {}
    },
    category: {
      type: [String, Number],
      default: ''
    },
    allLists: {
      type: Boolean,
      default: true
    },
    clickEvent: {
      type: Function,
      default: function _default() {}
    }
  },
  data: function data() {
    return {
      language: (0, _factory.language)(),
      funCode: (0, _factory.getFunctionCadeData)(),
      listAllName: _factory.listAllName,
      listPath: (0, _factory.path)('listPath'),
      actionURL: _factory.actionURL,
      saveScrollTo: _common.saveScrollTo,
      isArticle: !!document.querySelector('#article'),
      selectValue: Number((0, _factory.params)('categoryId'))
    };
  },
  methods: {
    changeFun: function changeFun(e) {
      var vm = this;
      var $select = (0, _factory.j$)(e.currentTarget);
      var $options = $select.find('option');

      for (var i = 0; i < $options[0].length; i += 1) {
        var value = $options.eq(i).val();
        var url = $options.eq(i).attr('url');

        if (Number(value) === Number(vm.selectValue)) {
          (0, _common.saveScrollToSession)();
          window.location.href = url;
        }
      }
    }
  }
};
exports.Z = _default2;

/***/ }),

/***/ 6404:
/***/ (function(__unused_webpack_module, exports) {

"use strict";


Object.defineProperty(exports, "X", ({
  value: true
}));
exports.Z = void 0;
var _default2 = {
  props: {
    style: {
      type: Object,
      default: function _default() {}
    }
  }
};
exports.Z = _default2;

/***/ }),

/***/ 9159:
/***/ (function(__unused_webpack_module, exports) {

"use strict";


Object.defineProperty(exports, "X", ({
  value: true
}));
exports.Z = void 0;
var _default = {};
exports.Z = _default;

/***/ }),

/***/ 1890:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;


__webpack_unused_export__ = ({
  value: true
});
exports.s = render;

var _vue = __webpack_require__(7834);

var _hoisted_1 = ["innerHTML"];
var _hoisted_2 = {
  key: 1
};
var _hoisted_3 = ["href", "title"];
var _hoisted_4 = ["href", "title"];

function render(_ctx, _cache, $props, $setup, $data, $options) {
  var _component_m_article = (0, _vue.resolveComponent)("m-article");

  return (0, _vue.openBlock)(), (0, _vue.createBlock)(_component_m_article, {
    style: {
      'title': '--badge'
    },
    "bread-crumbs": [$options.data.data.menuPage.menuPageName, $options.data.data.page.pageName]
  }, {
    article_header: (0, _vue.withCtx)(function () {
      return [(0, _vue.createTextVNode)((0, _vue.toDisplayString)($options.data.data.page.pageName), 1)];
    }),
    article_content: (0, _vue.withCtx)(function () {
      return [$options.data.data.isActive === 1 ? ((0, _vue.openBlock)(), (0, _vue.createElementBlock)("div", {
        key: 0,
        class: "p:text-20 t:text-18 m:text-16",
        innerHTML: $options.data.data.page.pageContent
      }, null, 8, _hoisted_1)) : ((0, _vue.openBlock)(), (0, _vue.createElementBlock)("div", _hoisted_2, [$options.data.data.isActive === 2 ? ((0, _vue.openBlock)(), (0, _vue.createElementBlock)("a", {
        key: 0,
        class: "p:text-20 t:text-18 m:text-16",
        href: $options.data.data.url,
        title: $options.data.data.url,
        target: "_blank",
        rel: "noopener"
      }, (0, _vue.toDisplayString)($options.data.data.url), 9, _hoisted_3)) : ((0, _vue.openBlock)(), (0, _vue.createElementBlock)("a", {
        key: 1,
        class: "p:text-20 t:text-18 m:text-16",
        href: $options.data.data.filePath,
        title: $options.data.data.filePath,
        target: "_blank",
        rel: "noopener"
      }, (0, _vue.toDisplayString)($options.data.data.filePath), 9, _hoisted_4))]))];
    }),
    _: 1
  }, 8, ["bread-crumbs"]);
}

/***/ }),

/***/ 963:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;


__webpack_unused_export__ = ({
  value: true
});
exports.s = render;

var _vue = __webpack_require__(7834);

var _hoisted_1 = {
  class: "mFt mx-auto overflow-hidden relative z-0 p:pt-76 p:pb-100 t:p-20 m:p-28"
};

var _hoisted_2 = /*#__PURE__*/(0, _vue.createElementVNode)("a", {
  href: "#Z",
  title: "下方功能區塊",
  accesskey: "Z",
  name: "Z",
  class: "assetsKey top-0 left-0 absolute"
}, ":::", -1);

var _hoisted_3 = {
  class: "mFtLinks"
};
var _hoisted_4 = {
  class: "flex m:flex-wrap"
};
var _hoisted_5 = {
  class: "mFtLinksItemHd p:mb-24 t:mb-12"
};
var _hoisted_6 = ["title", "onClick"];
var _hoisted_7 = {
  class: "p:text-24 t:text-22 m:text-20"
};
var _hoisted_8 = {
  class: "mFtLinksIconFrame ml-5 relative pt:hidden"
};
var _hoisted_9 = {
  class: "space-y-5 m:py-5 m:border-t-1 m:bordr-xf"
};
var _hoisted_10 = ["href", "title"];
var _hoisted_11 = {
  class: "p:pt-76 t:pt-28"
};
var _hoisted_12 = {
  class: "p:-mx-12 p:flex p:items-center"
};
var _hoisted_13 = {
  class: "p:px-12 flex-grow flex pt:items-center t:mx-auto t:w-2/3 t:justify-between m:flex-col-reverse"
};
var _hoisted_14 = {
  class: "mFtLogo p:mr-24 m:mx-auto"
};
var _hoisted_15 = ["href"];
var _hoisted_16 = {
  class: "mFtSocial flex items-center p:-mx-10 m:mx-auto m:my-20 m:w-11/12 m:justify-between"
};
var _hoisted_17 = ["href", "title"];
var _hoisted_18 = {
  class: "flex-shrink-0 p:px-12 p:text-right tm:mt-20 tm:text-center"
};
var _hoisted_19 = {
  class: "pt:inline-flex pt:items-center p:text-16 m:mb-10 m:text-14"
};
var _hoisted_20 = {
  class: "text-xf"
};
var _hoisted_21 = ["href", "title"];
var _hoisted_22 = {
  class: "text-xf opacity-35 p:text-14 t:text-13 m:text-12"
};

function render(_ctx, _cache, $props, $setup, $data, $options) {
  var _component_m_svg = (0, _vue.resolveComponent)("m-svg");

  return (0, _vue.openBlock)(), (0, _vue.createElementBlock)("footer", _hoisted_1, [_hoisted_2, (0, _vue.createElementVNode)("div", _hoisted_3, [(0, _vue.createElementVNode)("ul", _hoisted_4, [((0, _vue.openBlock)(true), (0, _vue.createElementBlock)(_vue.Fragment, null, (0, _vue.renderList)($data.links, function (item, index) {
    return (0, _vue.openBlock)(), (0, _vue.createElementBlock)("li", {
      key: "".concat(item.chineseName, "_").concat(index),
      class: (0, _vue.normalizeClass)(["mFtLinksItem pt:flex-1 m:w-1/2 m:mb-5", {
        'act': $data.isAct === index
      }])
    }, [(0, _vue.createElementVNode)("div", _hoisted_5, [(0, _vue.createElementVNode)("button", {
      type: "button",
      class: "mFtLinksItemCtrl text-xf pt:block pt:text-left m:w-full m:flex m:items-center m:justify-center m:text-center",
      title: /en/.test($data.language) ? item.englishName : item.chineseName,
      onClick: function onClick($event) {
        return $options.clickLinks(index);
      }
    }, [(0, _vue.createElementVNode)("b", _hoisted_7, (0, _vue.toDisplayString)(/en/.test($data.language) ? item.englishName : item.chineseName), 1), (0, _vue.createElementVNode)("div", _hoisted_8, [(0, _vue.createVNode)(_component_m_svg, {
      class: "mFtLinksIcon --plus top-0 left-0 fill-xf w-full h-full absolute",
      "svg-icon": "plus"
    }), (0, _vue.createVNode)(_component_m_svg, {
      class: "mFtLinksIcon --minus top-0 left-0 fill-xf w-full h-full absolute",
      "svg-icon": "minus"
    })])], 8, _hoisted_6)]), (0, _vue.createElementVNode)("div", {
      class: (0, _vue.normalizeClass)(["mFtLinksItemBd m:overflow-hidden m:text-center", {
        '--delay': $data.isAct !== null
      }])
    }, [(0, _vue.createElementVNode)("ul", _hoisted_9, [((0, _vue.openBlock)(true), (0, _vue.createElementBlock)(_vue.Fragment, null, (0, _vue.renderList)(item.subLinks, function (subLink) {
      return (0, _vue.openBlock)(), (0, _vue.createElementBlock)("li", {
        key: subLink.chineseName
      }, [(0, _vue.createElementVNode)("a", {
        href: /en/.test($data.language) ? subLink.englishURL : subLink.chineseURL,
        class: "text-xf p:text-18 t:text-16 m:text-14",
        title: /en/.test($data.language) ? subLink.englishName : subLink.chineseName,
        target: "_blank",
        rel: "noopener"
      }, (0, _vue.toDisplayString)(/en/.test($data.language) ? subLink.englishName : subLink.chineseName), 9, _hoisted_10)]);
    }), 128))])], 2)], 2);
  }), 128))])]), (0, _vue.createElementVNode)("div", _hoisted_11, [(0, _vue.createElementVNode)("ul", _hoisted_12, [(0, _vue.createElementVNode)("li", _hoisted_13, [(0, _vue.createElementVNode)("div", _hoisted_14, [(0, _vue.createElementVNode)("a", {
    href: $data.actionURL('index'),
    class: "w-full h-full block"
  }, [(0, _vue.createVNode)(_component_m_svg, {
    class: "fill-xf w-full h-full",
    "svg-icon": "logo_footer"
  })], 8, _hoisted_15)]), (0, _vue.createElementVNode)("ul", _hoisted_16, [((0, _vue.openBlock)(true), (0, _vue.createElementBlock)(_vue.Fragment, null, (0, _vue.renderList)($setup.social, function (item) {
    return (0, _vue.openBlock)(), (0, _vue.createElementBlock)("li", {
      key: item.name,
      class: "pt:px-10"
    }, [(0, _vue.createElementVNode)("a", {
      href: item.URL,
      class: "mFtSocialLink block",
      title: item.name,
      target: "_blank",
      rel: "noopener"
    }, [(0, _vue.createVNode)(_component_m_svg, {
      class: "fill-xf w-full h-full",
      "svg-icon": item.icon
    }, null, 8, ["svg-icon"])], 8, _hoisted_17)]);
  }), 128))])]), (0, _vue.createElementVNode)("li", _hoisted_18, [(0, _vue.createElementVNode)("div", _hoisted_19, [(0, _vue.createElementVNode)("p", _hoisted_20, (0, _vue.toDisplayString)(/en/.test($data.language) ? $setup.info.englishAddress : $setup.info.chineseAddress), 1), (0, _vue.createElementVNode)("a", {
    class: "p:ml-20 text-xf pt:inline-block",
    href: "tel:".concat(/en/.test($data.language) ? $setup.info.englishPhoneNumber : $setup.info.chinesePhoneNumber),
    title: /en/.test($data.language) ? $setup.info.englishPhoneNumber : $setup.info.chinesePhoneNumber
  }, (0, _vue.toDisplayString)(/en/.test($data.language) ? $setup.info.englishPhoneNumber : $setup.info.chinesePhoneNumber), 9, _hoisted_21)]), (0, _vue.createElementVNode)("p", _hoisted_22, (0, _vue.toDisplayString)(/en/.test($data.language) ? $setup.info.englishDeclare : $setup.info.chineseDeclare), 1)])])])]);
}

/***/ }),

/***/ 8290:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;


__webpack_unused_export__ = ({
  value: true
});
exports.s = render;

var _vue = __webpack_require__(7834);

var _hoisted_1 = /*#__PURE__*/(0, _vue.createElementVNode)("a", {
  href: "#U",
  title: "上方功能區塊",
  accesskey: "U",
  name: "U",
  class: "assetsKey top-0 left-0 absolute"
}, ":::", -1);

var _hoisted_2 = /*#__PURE__*/(0, _vue.createElementVNode)("h1", {
  class: "sr-only"
}, " 天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY ", -1);

var _hoisted_3 = ["href"];
var _hoisted_4 = {
  key: 1,
  class: "mHdPhotoFrame p:left-0 absolute"
};
var _hoisted_5 = {
  class: "mHdFig w-full h-full relative p:overflow-hidden"
};
var _hoisted_6 = ["src"];
var _hoisted_7 = ["href"];

function render(_ctx, _cache, $props, $setup, $data, $options) {
  var _component_m_svg = (0, _vue.resolveComponent)("m-svg");

  var _component_m_nav = (0, _vue.resolveComponent)("m-nav");

  return (0, _vue.openBlock)(), (0, _vue.createElementBlock)("div", {
    class: (0, _vue.normalizeClass)(["mHd box-border p:flex", {
      'p:items-center': !$data.isHome
    }])
  }, [_hoisted_1, (0, _vue.createElementVNode)("header", {
    class: (0, _vue.normalizeClass)(["mHdCnt p:flex-shrink-0", {
      '--width': $data.isHome
    }])
  }, [_hoisted_2, (0, _vue.createElementVNode)("div", {
    class: (0, _vue.normalizeClass)(["mHdLogo p:text-center t:px-20 t:py-5 m:px-12 m:py-10", [{
      '--large p:pt-32 p:border-1': $data.isHome,
      'flex-shrink-0 tm:bg-x1479': !$data.isHome
    }, $options.changeColor($setup.info.styleClass)]])
  }, [(0, _vue.createElementVNode)("div", null, [$data.isHome ? ((0, _vue.openBlock)(), (0, _vue.createElementBlock)("a", {
    key: 0,
    class: "mHdLogoFrame p:mx-auto p:mb-84 inline-block relative z-1",
    href: $data.actionURL('index'),
    title: "天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY:回首頁"
  }, [!/en/.test($data.language) ? ((0, _vue.openBlock)(), (0, _vue.createBlock)(_component_m_svg, {
    key: 0,
    class: (0, _vue.normalizeClass)(["tm:hidden w-full h-full", $options.changeColor($setup.info.logoClass)]),
    "svg-icon": "logo_large",
    alt: "天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY"
  }, null, 8, ["class"])) : ((0, _vue.openBlock)(), (0, _vue.createBlock)(_component_m_svg, {
    key: 1,
    class: (0, _vue.normalizeClass)(["tm:hidden w-full h-full", $options.changeColor($setup.info.logoClass)]),
    "svg-icon": "logo_large_en",
    alt: "天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY"
  }, null, 8, ["class"])), !/en/.test($data.language) ? ((0, _vue.openBlock)(), (0, _vue.createBlock)(_component_m_svg, {
    key: 2,
    class: (0, _vue.normalizeClass)(["w-full h-full p:hidden m:hidden", $options.changeColor($setup.info.logoClass)]),
    "svg-icon": "logo",
    alt: "天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY:回首頁"
  }, null, 8, ["class"])) : ((0, _vue.openBlock)(), (0, _vue.createBlock)(_component_m_svg, {
    key: 3,
    class: (0, _vue.normalizeClass)(["w-full h-full p:hidden m:hidden", $options.changeColor($setup.info.logoClass)]),
    "svg-icon": "logo_en",
    alt: "天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY:回首頁"
  }, null, 8, ["class"])), (0, _vue.createVNode)(_component_m_svg, {
    class: (0, _vue.normalizeClass)(["w-full h-full pt:hidden", $options.changeColor($setup.info.logoClass)]),
    "svg-icon": "logo_mobile",
    alt: "天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY"
  }, null, 8, ["class"])], 8, _hoisted_3)) : (0, _vue.createCommentVNode)("", true), $data.isHome ? ((0, _vue.openBlock)(), (0, _vue.createElementBlock)("div", _hoisted_4, [(0, _vue.createElementVNode)("figure", _hoisted_5, [(0, _vue.createElementVNode)("img", {
    class: "pt:top-0 p:right-0 p:absolute",
    src: $options.logoPath($setup.info),
    alt: "天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY",
    tabindex: "-1"
  }, null, 8, _hoisted_6)])])) : (0, _vue.createCommentVNode)("", true), !$data.isHome ? ((0, _vue.openBlock)(), (0, _vue.createElementBlock)("a", {
    key: 2,
    class: "mHdLogoFrame inline-block",
    href: $data.actionURL('index'),
    title: "天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY:回首頁"
  }, [!/en/.test($data.language) ? ((0, _vue.openBlock)(), (0, _vue.createBlock)(_component_m_svg, {
    key: 0,
    class: "w-full h-full p:mx-auto p:fill-x1479 t:fill-xf m:hidden",
    "svg-icon": "logo",
    alt: "天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY:回首頁"
  })) : ((0, _vue.openBlock)(), (0, _vue.createBlock)(_component_m_svg, {
    key: 1,
    class: "w-full h-full p:mx-auto p:fill-x1479 t:fill-xf m:hidden",
    "svg-icon": "logo_en",
    alt: "天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY:回首頁"
  })), (0, _vue.createVNode)(_component_m_svg, {
    class: "w-full h-full m:fill-xf pt:hidden",
    "svg-icon": "logo_mobile",
    alt: "天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY:回首頁"
  })], 8, _hoisted_7)) : (0, _vue.createCommentVNode)("", true)])], 2)], 2), (0, _vue.createVNode)(_component_m_nav, {
    "bg-color": $data.isHome ? $setup.info.navBgClass : 'tm:bg-x1479',
    "text-color": $data.isHome ? $setup.info.navTextClass : 'tm:text-xf',
    "svg-color": $data.isHome ? $setup.info.logoClass : 'tm:fill-xf'
  }, null, 8, ["bg-color", "text-color", "svg-color"])], 2);
}

/***/ }),

/***/ 9519:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;


__webpack_unused_export__ = ({
  value: true
});
exports.s = render;

var _vue = __webpack_require__(7834);

var _hoisted_1 = {
  class: "mKv h-full overflow-hidden relative"
};
var _hoisted_2 = {
  key: 0,
  class: "mKvTitle p:text-44 t:text-28 m:text-20 text-xf absolute"
};
var _hoisted_3 = {
  class: "mKvFig top-1/2 left-1/2 flex justify-center absolute"
};
var _hoisted_4 = ["src", "alt"];

function render(_ctx, _cache, $props, $setup, $data, $options) {
  return (0, _vue.openBlock)(), (0, _vue.createElementBlock)("div", _hoisted_1, [$props.datas.data.menuPage.menuPageBannerText ? ((0, _vue.openBlock)(), (0, _vue.createElementBlock)("p", _hoisted_2, (0, _vue.toDisplayString)($props.datas.data.menuPage.menuPageBannerText), 1)) : (0, _vue.createCommentVNode)("", true), (0, _vue.createElementVNode)("figure", _hoisted_3, [(0, _vue.createElementVNode)("img", {
    class: "max-h-full",
    src: $options.bannerImg,
    alt: $props.datas.data.menuPage.menuPageBannerText
  }, null, 8, _hoisted_4)])]);
}

/***/ }),

/***/ 1354:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;


__webpack_unused_export__ = ({
  value: true
});
exports.s = render;

var _vue = __webpack_require__(7834);

var _hoisted_1 = ["href", "title"];
var _hoisted_2 = {
  class: "p:text-20 t:text-15 not-italic"
};

function render(_ctx, _cache, $props, $setup, $data, $options) {
  var _component_m_menu = (0, _vue.resolveComponent)("m-menu");

  return (0, _vue.openBlock)(), (0, _vue.createBlock)(_component_m_menu, {
    menu: $data.menu,
    "all-lists": false
  }, {
    menu_header: (0, _vue.withCtx)(function () {
      return [(0, _vue.createTextVNode)((0, _vue.toDisplayString)($props.datas.data.menuPage.menuPageName), 1)];
    }),
    menu_content: (0, _vue.withCtx)(function (_ref) {
      var data = _ref.data;
      return [(0, _vue.createElementVNode)("a", {
        href: data.menuPageItemURL,
        class: (0, _vue.normalizeClass)({
          'text-xba79': $props.datas.data.name === data.menuPageItemName,
          'text-xf': $props.datas.data.name !== data.menuPageItemName
        }),
        title: data.menuPageItemName
      }, [(0, _vue.createElementVNode)("em", _hoisted_2, (0, _vue.toDisplayString)(data.menuPageItemName), 1)], 10, _hoisted_1)];
    }),
    _: 1
  }, 8, ["menu"]);
}

/***/ }),

/***/ 6160:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;


__webpack_unused_export__ = ({
  value: true
});
exports.s = render;

var _vue = __webpack_require__(7834);

var _hoisted_1 = {
  class: "p:h-1/2 p:flex p:items-start p:justify-end t:pt-20 m:pt-10 jNav"
};
var _hoisted_2 = {
  class: "p:-mx-10 p:h-full p:flex p:items-center t:space-y-14 m:space-y-10"
};
var _hoisted_3 = ["onMouseenter"];
var _hoisted_4 = ["href", "title", "target", "rel"];
var _hoisted_5 = ["onClick"];
var _hoisted_6 = {
  class: "p:px-20 p:py-14 p:space-y-16 t:space-y-8 t:mt-8 m:space-y-3 m:mt-4"
};
var _hoisted_7 = ["href", "title", "target", "rel"];
var _hoisted_8 = {
  class: "p:text-20 t:text-18 m:text-16 not-italic"
};
var _hoisted_9 = {
  class: "p:mb-12 p:h-1/2 p:flex p:items-end p:justify-end t:mt-16 m:mt-12"
};
var _hoisted_10 = {
  class: "mNavTools p:flex p:items-center tm:relative t:pt-16 m:pt-12"
};
var _hoisted_11 = {
  class: "mNavId t:mt-8 t:mb-16"
};
var _hoisted_12 = {
  class: "flex items-center p:-mx-10 p:h-full tm:flex-wrap"
};
var _hoisted_13 = ["href", "title", "target", "rel"];
var _hoisted_14 = {
  class: "mNavLinks p:ml-24 p:px-24 p:py-4 p:bg-x1479 p:rounded-20 tm:relative t:py-16 m:mt-12 m:py-12"
};
var _hoisted_15 = {
  class: "mNavType overflow-hidden p:left-0 p:top-1/2 p:absolute t:mb-20 m:mb-14"
};
var _hoisted_16 = {
  class: "flex item-center p:-mx-10 t:-mx-8 m:-mx-5"
};
var _hoisted_17 = ["href", "title", "target", "innerHTML"];
var _hoisted_18 = {
  class: "flex items-center tm:text-x1479 p:text-14 p:text-xf p:-mx-10 t:mx-auto t:w-1/2"
};
var _hoisted_19 = ["href", "title"];
var _hoisted_20 = {
  class: "mNavItem box-border text-center relative p:px-10"
};
var _hoisted_21 = ["href", "title"];
var _hoisted_22 = {
  class: "mNavSearch p:ml-28 flex-shrink-0 tm:absolute"
};
var _hoisted_23 = ["href"];
var _hoisted_24 = {
  class: "mNavCtrl p:hidden tm:absolute"
};
var _hoisted_25 = ["aria-label"];

var _hoisted_26 = /*#__PURE__*/(0, _vue.createElementVNode)("i", null, "MENU", -1);

var _hoisted_27 = [_hoisted_26];

function render(_ctx, _cache, $props, $setup, $data, $options) {
  var _component_m_svg = (0, _vue.resolveComponent)("m-svg");

  return (0, _vue.openBlock)(), (0, _vue.createElementBlock)("div", {
    class: (0, _vue.normalizeClass)(["mNav p:px-60 p:h-full p:flex-grow p:flex p:items-center", {
      'act': $data.isAct
    }])
  }, [(0, _vue.createElementVNode)("div", {
    class: (0, _vue.normalizeClass)(["mNavMain tm:left-0 tm:w-full tm:overflow-hidden tm:z-10 tm:absolute p:h-full p:flex p:flex-grow p:flex-col-reverse p:relative t:px-48 m:px-32", $props.bgColor])
  }, [(0, _vue.createElementVNode)("nav", _hoisted_1, [(0, _vue.createElementVNode)("ul", _hoisted_2, [((0, _vue.openBlock)(true), (0, _vue.createElementBlock)(_vue.Fragment, null, (0, _vue.renderList)($data.menu, function (item, index) {
    return (0, _vue.openBlock)(), (0, _vue.createElementBlock)("li", {
      key: item.chineseName,
      class: (0, _vue.normalizeClass)(["mNavMainItem relative p:mx-10 p:h-full p:text-x1479 p:hover:text-x0 jNavItem", [$props.textColor, {
        'act': $data.isNav === index
      }]]),
      onMouseenter: function onMouseenter($event) {
        return $options.mouseenterFun(index);
      },
      onMouseleave: _cache[0] || (_cache[0] = function () {
        return $options.mouseleaveFun && $options.mouseleaveFun.apply($options, arguments);
      })
    }, [(/en/.test($data.language) ? item.englishURL : item.chineseURL) ? ((0, _vue.openBlock)(), (0, _vue.createElementBlock)("a", {
      key: 0,
      href: /en/.test($data.language) ? item.englishURL : item.chineseURL,
      title: /en/.test($data.language) ? item.englishName : item.chineseName,
      target: /en/.test($data.language) ? item.englishURLActionType : item.chineseURLActionType,
      rel: $options.getRel(/en/.test($data.language) ? item.englishURLActionType : item.chineseURLActionType),
      class: "p:h-full block"
    }, [(0, _vue.createElementVNode)("em", {
      class: (0, _vue.normalizeClass)(["t:text-20 m:text-18 not-italic", $options.setNavFz()])
    }, [(0, _vue.createElementVNode)("strong", null, (0, _vue.toDisplayString)(/en/.test($data.language) ? item.englishName : item.chineseName), 1)], 2)], 8, _hoisted_4)) : ((0, _vue.openBlock)(), (0, _vue.createElementBlock)("button", {
      key: 1,
      type: "button",
      class: "w-full flex tm:items-center p:flex-col p:h-full",
      onClick: function onClick($event) {
        return $data.isNav = index;
      }
    }, [(0, _vue.createElementVNode)("em", {
      class: (0, _vue.normalizeClass)(["t:text-20 m:text-18 not-italic", $options.setNavFz()])
    }, [(0, _vue.createElementVNode)("strong", null, (0, _vue.toDisplayString)(/en/.test($data.language) ? item.englishName : item.chineseName), 1)], 2), (0, _vue.createVNode)(_component_m_svg, {
      class: (0, _vue.normalizeClass)(["t:ml-8 m:ml-6 p:hidden", $props.svgColor]),
      "svg-icon": "arrow_nav"
    }, null, 8, ["class"])], 8, _hoisted_5)), item.children ? ((0, _vue.openBlock)(), (0, _vue.createElementBlock)("div", {
      key: 2,
      ref: "navMainSub",
      class: (0, _vue.normalizeClass)(["mNavMainSub overflow-hidden p:bg-xf2 p:absolute", {
        'p:left-1/2': $data.menu.length !== index + 1
      }])
    }, [(0, _vue.createElementVNode)("ul", _hoisted_6, [((0, _vue.openBlock)(true), (0, _vue.createElementBlock)(_vue.Fragment, null, (0, _vue.renderList)(item.children, function (sunItem) {
      return (0, _vue.openBlock)(), (0, _vue.createElementBlock)("li", {
        key: sunItem.chineseName,
        class: "mNavMainSubItem tm:text-xd0 p:text-x60 p:hover:text-x0"
      }, [(0, _vue.createElementVNode)("a", {
        href: (/en/.test($data.language) ? sunItem.englishURL : sunItem.chineseURL) || 'javascript:;',
        title: /en/.test($data.language) ? sunItem.englishName : sunItem.chineseName,
        target: /en/.test($data.language) ? item.englishURLActionType : item.chineseURLActionType,
        rel: $options.getRel(/en/.test($data.language) ? item.englishURLActionType : item.chineseURLActionType),
        class: "whitespace-no-wrap text-center"
      }, [(0, _vue.createElementVNode)("em", _hoisted_8, (0, _vue.toDisplayString)(/en/.test($data.language) ? sunItem.englishName : sunItem.chineseName), 1)], 8, _hoisted_7)]);
    }), 128))])], 2)) : (0, _vue.createCommentVNode)("", true)], 42, _hoisted_3);
  }), 128))])]), (0, _vue.createElementVNode)("div", _hoisted_9, [(0, _vue.createElementVNode)("div", _hoisted_10, [(0, _vue.createElementVNode)("p", {
    class: (0, _vue.normalizeClass)(["p:hidden t:text-20 m:text-18", $props.textColor])
  }, [(0, _vue.createElementVNode)("b", null, (0, _vue.toDisplayString)(/en/.test($data.language) ? 'Login' : '使用者登入'), 1)], 2), (0, _vue.createElementVNode)("div", _hoisted_11, [(0, _vue.createElementVNode)("ul", _hoisted_12, [((0, _vue.openBlock)(true), (0, _vue.createElementBlock)(_vue.Fragment, null, (0, _vue.renderList)($data.id, function (item) {
    return (0, _vue.openBlock)(), (0, _vue.createElementBlock)("li", {
      key: item.chineseName,
      class: "text-center p:px-10 t:w-1/5 m:w-1/2"
    }, [(0, _vue.createElementVNode)("a", {
      href: item.url || $data.actionURL(null, ["userRoute-".concat(item.routeName)]),
      title: /en/.test($data.language) ? item.englishName : item.chineseName,
      target: item.isInternal ? null : '_blank',
      rel: item.isInternal ? null : 'noopener',
      class: (0, _vue.normalizeClass)(["t:text-16 m:text-14 p:text-x057d", [$options.setNavIDFz(), $props.textColor]])
    }, (0, _vue.toDisplayString)(/en/.test($data.language) ? item.englishName : item.chineseName), 11, _hoisted_13)]);
  }), 128))])]), (0, _vue.createElementVNode)("div", _hoisted_14, [(0, _vue.createElementVNode)("div", _hoisted_15, [(0, _vue.createElementVNode)("ul", _hoisted_16, [((0, _vue.openBlock)(true), (0, _vue.createElementBlock)(_vue.Fragment, null, (0, _vue.renderList)($options.typeLinks, function (item) {
    return (0, _vue.openBlock)(), (0, _vue.createElementBlock)("li", {
      key: item.name,
      class: "p:px-10 t:px-8 m:px-5"
    }, [(0, _vue.createElementVNode)("a", {
      class: (0, _vue.normalizeClass)(["px-8 py-5 w-full h-full box-border block text-center border-2 rounded-10 pt:text-13 m:text-12", [item.borderColor, item.color]]),
      href: item.url,
      title: item.name.replace(/<[^>]+>/g, ''),
      target: item.target,
      innerHTML: item.name
    }, null, 10, _hoisted_17)]);
  }), 128))])]), (0, _vue.createElementVNode)("ul", _hoisted_18, [((0, _vue.openBlock)(true), (0, _vue.createElementBlock)(_vue.Fragment, null, (0, _vue.renderList)($data.links, function (item) {
    return (0, _vue.openBlock)(), (0, _vue.createElementBlock)("li", {
      key: item.chineseName,
      class: "mNavItem box-border text-center relative p:px-10"
    }, [(0, _vue.createElementVNode)("a", {
      class: "box-border tm:flex tm:flex-col tm:justify-center t:px-16 t:text-15 m:px-12 m:text-13",
      href: $data.actionURL($data.listPath, [item.id, '0', '1']),
      title: /en/.test($data.language) ? item.englishName : item.chineseName
    }, (0, _vue.toDisplayString)(/en/.test($data.language) ? item.englishName : item.chineseName), 9, _hoisted_19)]);
  }), 128)), (0, _vue.createElementVNode)("li", _hoisted_20, [(0, _vue.createElementVNode)("a", {
    class: "box-border tm:flex tm:flex-col tm:justify-center t:px-16 t:text-15 m:px-12 m:text-13",
    href: $data.actionURL(null, ["language-".concat($setup.langURL)]),
    title: $setup.langText
  }, (0, _vue.toDisplayString)($setup.langText), 9, _hoisted_21)])])])])])], 2), (0, _vue.createElementVNode)("div", _hoisted_22, [(0, _vue.createElementVNode)("a", {
    href: $data.actionURL(null, ['search']),
    class: "w-full h-full p:block tm:flex tm:items-center tm:justify-center"
  }, [(0, _vue.createVNode)(_component_m_svg, {
    class: "p:fill-x1479 tm:fill-xf",
    "svg-icon": "search"
  })], 8, _hoisted_23)]), (0, _vue.createElementVNode)("div", _hoisted_24, [(0, _vue.createElementVNode)("button", {
    class: (0, _vue.normalizeClass)(["mNavCtrlBtn w-full h-full rounded-10 relative", {
      'm:bg-xba79': $props.bgColor == 'm:bg-xf'
    }]),
    type: "button",
    "aria-label": /en/.test($data.language) ? 'OPEN MENU' : '打開選單',
    onClick: _cache[1] || (_cache[1] = function ($event) {
      $data.isAct = !$data.isAct;
    })
  }, _hoisted_27, 10, _hoisted_25)])], 2);
}

/***/ }),

/***/ 8875:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;


__webpack_unused_export__ = ({
  value: true
});
exports.s = render;

var _vue = __webpack_require__(7834);

var _hoisted_1 = {
  class: "block"
};
var _hoisted_2 = ["xlink:href"];

function render(_ctx, _cache, $props, $setup, $data, $options) {
  return (0, _vue.openBlock)(), (0, _vue.createElementBlock)("svg", _hoisted_1, [(0, _vue.createElementVNode)("use", {
    "xlink:href": "#".concat($props.svgIcon)
  }, null, 8, _hoisted_2)]);
}

/***/ }),

/***/ 5839:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;


__webpack_unused_export__ = ({
  value: true
});
exports.s = render;

var _vue = __webpack_require__(7834);

function render(_ctx, _cache, $props, $setup, $data, $options) {
  var _component_m_menu_nav = (0, _vue.resolveComponent)("m-menu-nav");

  var _component_m_kv = (0, _vue.resolveComponent)("m-kv");

  var _component_m_tools = (0, _vue.resolveComponent)("m-tools");

  return (0, _vue.openBlock)(), (0, _vue.createBlock)(_component_m_tools, null, {
    tools_content: (0, _vue.withCtx)(function () {
      return [(0, _vue.createVNode)(_component_m_menu_nav, {
        datas: $options.data
      }, null, 8, ["datas"]), (0, _vue.createVNode)(_component_m_kv, {
        datas: $options.data,
        class: "flex-grow"
      }, null, 8, ["datas"])];
    }),
    _: 1
  });
}

/***/ }),

/***/ 2617:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;


__webpack_unused_export__ = ({
  value: true
});
exports.s = render;

var _vue = __webpack_require__(7834);

var _hoisted_1 = {
  class: "mArticle mx-auto p:w-cnt t:w-4/5 m:px-12"
};
var _hoisted_2 = {
  key: 0,
  class: "mArticleLoading"
};

function render(_ctx, _cache, $props, $setup, $data, $options) {
  var _$props$style, _$props$style2, _$props$style3, _$props$style4, _$props$style5;

  var _component_m_bread_crumbs = (0, _vue.resolveComponent)("m-bread-crumbs");

  var _component_m_title = (0, _vue.resolveComponent)("m-title");

  return (0, _vue.openBlock)(), (0, _vue.createElementBlock)("div", _hoisted_1, [(0, _vue.createVNode)(_component_m_bread_crumbs, {
    path: $props.breadCrumbs
  }, null, 8, ["path"]), (0, _vue.createElementVNode)("article", {
    class: (0, _vue.normalizeClass)((_$props$style = $props.style) === null || _$props$style === void 0 ? void 0 : _$props$style.article)
  }, [(0, _vue.createElementVNode)("header", {
    class: (0, _vue.normalizeClass)(["mArticleHd flex flex-col-reverse p:mb-40 tm:mb-28", (_$props$style2 = $props.style) === null || _$props$style2 === void 0 ? void 0 : _$props$style2.hd])
  }, [(0, _vue.createVNode)(_component_m_title, {
    style: (0, _vue.normalizeStyle)({
      'main': (_$props$style3 = $props.style) === null || _$props$style3 === void 0 ? void 0 : _$props$style3.title
    })
  }, {
    title: (0, _vue.withCtx)(function () {
      return [(0, _vue.renderSlot)(_ctx.$slots, "article_header")];
    }),
    _: 3
  }, 8, ["style"]), _ctx.$slots.article_tools ? ((0, _vue.openBlock)(), (0, _vue.createElementBlock)("div", {
    key: 0,
    class: (0, _vue.normalizeClass)(["mArticleTools flex border-xd0 p:mb-76 p:border-b-6 t:mb-28 t:border-b-4 m:mb-5 m:border-b-2", (_$props$style4 = $props.style) === null || _$props$style4 === void 0 ? void 0 : _$props$style4.tools])
  }, [(0, _vue.renderSlot)(_ctx.$slots, "article_tools")], 2)) : (0, _vue.createCommentVNode)("", true)], 2), (0, _vue.createElementVNode)("div", {
    class: (0, _vue.normalizeClass)(["mArticleBd p:text-20 t:text-18 m:text-16", (_$props$style5 = $props.style) === null || _$props$style5 === void 0 ? void 0 : _$props$style5.bd])
  }, [(0, _vue.renderSlot)(_ctx.$slots, "article_content")], 2)], 2), _ctx.$slots.article_loading ? ((0, _vue.openBlock)(), (0, _vue.createElementBlock)("div", _hoisted_2, [(0, _vue.renderSlot)(_ctx.$slots, "article_loading")])) : (0, _vue.createCommentVNode)("", true)]);
}

/***/ }),

/***/ 8893:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;


__webpack_unused_export__ = ({
  value: true
});
exports.s = render;

var _vue = __webpack_require__(7834);

var _hoisted_1 = {
  class: "mBreadCrumbs p:mb-48 t:mb-16 m:hidden"
};
var _hoisted_2 = {
  class: "flex items-center"
};
var _hoisted_3 = {
  class: "mBreadCrumbsItem flex items-center p:text-20 t:text-14 relative"
};
var _hoisted_4 = ["href"];
var _hoisted_5 = ["href"];
var _hoisted_6 = {
  key: 1,
  class: "not-italic inline-block"
};

function render(_ctx, _cache, $props, $setup, $data, $options) {
  return (0, _vue.openBlock)(), (0, _vue.createElementBlock)("div", _hoisted_1, [(0, _vue.createElementVNode)("ol", _hoisted_2, [(0, _vue.createElementVNode)("li", _hoisted_3, [(0, _vue.createElementVNode)("a", {
    href: $data.actionURL('index')
  }, (0, _vue.toDisplayString)(/en/.test($data.language) ? 'Home' : '首頁'), 9, _hoisted_4)]), ((0, _vue.openBlock)(true), (0, _vue.createElementBlock)(_vue.Fragment, null, (0, _vue.renderList)($props.path, function (item, index) {
    return (0, _vue.openBlock)(), (0, _vue.createElementBlock)("li", {
      key: "".concat(item, "_").concat(index),
      class: "mBreadCrumbsItem flex items-center p:text-20 t:text-14 relative"
    }, [item !== null && item !== void 0 && item.split('|||')[1] ? ((0, _vue.openBlock)(), (0, _vue.createElementBlock)("a", {
      key: 0,
      class: "inline-block",
      href: item === null || item === void 0 ? void 0 : item.split('|||')[1]
    }, (0, _vue.toDisplayString)(item === null || item === void 0 ? void 0 : item.split('|||')[0]), 9, _hoisted_5)) : ((0, _vue.openBlock)(), (0, _vue.createElementBlock)("em", _hoisted_6, (0, _vue.toDisplayString)(item === null || item === void 0 ? void 0 : item.split('|||')[0]), 1))]);
  }), 128))])]);
}

/***/ }),

/***/ 6727:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;


__webpack_unused_export__ = ({
  value: true
});
exports.s = render;

var _vue = __webpack_require__(7834);

var _hoisted_1 = {
  class: "mMenuHd p:mb-10 t:mb-5 m:hidden"
};
var _hoisted_2 = {
  class: "p:text-30 t:text-20 text-xf"
};
var _hoisted_3 = {
  key: 0,
  class: "mMenuBd p:space-y-10 t:space-y-5 m:hidden"
};
var _hoisted_4 = {
  key: 0
};
var _hoisted_5 = ["href", "title"];
var _hoisted_6 = {
  class: "p:text-20 t:text-15 not-italic"
};
var _hoisted_7 = ["label"];
var _hoisted_8 = ["url"];
var _hoisted_9 = ["value", "url"];

function render(_ctx, _cache, $props, $setup, $data, $options) {
  var _$data$funCode, _$data$funCode2;

  return (0, _vue.openBlock)(), (0, _vue.createElementBlock)("div", {
    class: (0, _vue.normalizeClass)(["mMenu pt:h-full pt:bg-x1479 box-border pt:flex-shrink-0 p:px-56 p:py-32 t:px-32 t:py-20", {
      'm:px-12': $data.isArticle
    }])
  }, [(0, _vue.createElementVNode)("div", _hoisted_1, [(0, _vue.createElementVNode)("p", _hoisted_2, [(0, _vue.createElementVNode)("b", null, [(0, _vue.renderSlot)(_ctx.$slots, "menu_header")])])]), Array.isArray($props.menu) ? ((0, _vue.openBlock)(), (0, _vue.createElementBlock)("ul", _hoisted_3, [$props.allLists ? ((0, _vue.openBlock)(), (0, _vue.createElementBlock)("li", _hoisted_4, [(0, _vue.createElementVNode)("a", {
    href: $data.actionURL($data.listPath, ["".concat((_$data$funCode = $data.funCode) === null || _$data$funCode === void 0 ? void 0 : _$data$funCode.id), '0', '1']),
    class: (0, _vue.normalizeClass)({
      'text-xba79': !$props.category,
      'text-xf': $props.category
    }),
    title: /en/.test($data.language) ? $data.listAllName.englishName : $data.listAllName.chineseName,
    onClick: _cache[0] || (_cache[0] = function ($event) {
      return $data.saveScrollTo($event);
    })
  }, [(0, _vue.createElementVNode)("em", _hoisted_6, (0, _vue.toDisplayString)(/en/.test($data.language) ? $data.listAllName.englishName : $data.listAllName.chineseName), 1)], 10, _hoisted_5)])) : (0, _vue.createCommentVNode)("", true), ((0, _vue.openBlock)(true), (0, _vue.createElementBlock)(_vue.Fragment, null, (0, _vue.renderList)($props.menu, function (item, index) {
    return (0, _vue.openBlock)(), (0, _vue.createElementBlock)("li", {
      key: "menu_".concat(index)
    }, [(0, _vue.renderSlot)(_ctx.$slots, "menu_content", {
      data: item
    })]);
  }), 128))])) : (0, _vue.createCommentVNode)("", true), Array.isArray($props.menu) ? ((0, _vue.openBlock)(), (0, _vue.createElementBlock)("footer", {
    key: 1,
    class: (0, _vue.normalizeClass)(["mMenuFt pt:hidden", {
      'm:absolute': !$data.isArticle,
      '--article m:ml-auto m:mt-20': $data.isArticle
    }])
  }, [(0, _vue.withDirectives)((0, _vue.createElementVNode)("select", {
    "onUpdate:modelValue": _cache[1] || (_cache[1] = function ($event) {
      return $data.selectValue = $event;
    }),
    class: "mMenuSelect w-full h-full border-1 border-solid border-x1479 rounded-8 bg-xf text-15",
    onChange: _cache[2] || (_cache[2] = function ($event) {
      return $options.changeFun($event);
    })
  }, [(0, _vue.createElementVNode)("optgroup", {
    label: /en/.test($data.language) ? $data.funCode.englishName : $data.funCode.chineseName
  }, [$props.allLists ? ((0, _vue.openBlock)(), (0, _vue.createElementBlock)("option", {
    key: 0,
    value: "0",
    url: $data.actionURL($data.listPath, ["".concat((_$data$funCode2 = $data.funCode) === null || _$data$funCode2 === void 0 ? void 0 : _$data$funCode2.id), '0', '1'])
  }, (0, _vue.toDisplayString)(/en/.test($data.language) ? $data.listAllName.englishName : $data.listAllName.chineseName), 9, _hoisted_8)) : (0, _vue.createCommentVNode)("", true), ((0, _vue.openBlock)(true), (0, _vue.createElementBlock)(_vue.Fragment, null, (0, _vue.renderList)($props.menu, function (item, index) {
    var _$data$funCode3;

    return (0, _vue.openBlock)(), (0, _vue.createElementBlock)("option", {
      key: "menu_".concat(index),
      value: item.categoryId,
      url: $data.actionURL($data.listPath, ["functionCode-".concat((_$data$funCode3 = $data.funCode) === null || _$data$funCode3 === void 0 ? void 0 : _$data$funCode3.id), "listCategory-".concat(item.categoryId), "".concat($data.isArticle ? '1' : 'page-1')])
    }, (0, _vue.toDisplayString)(/en/.test($data.language) ? item.englishName : item.chineseName), 9, _hoisted_9);
  }), 128))], 8, _hoisted_7)], 544), [[_vue.vModelSelect, $data.selectValue]])], 2)) : (0, _vue.createCommentVNode)("", true)], 2);
}

/***/ }),

/***/ 3387:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;


__webpack_unused_export__ = ({
  value: true
});
exports.s = render;

var _vue = __webpack_require__(7834);

function render(_ctx, _cache, $props, $setup, $data, $options) {
  return (0, _vue.openBlock)(), (0, _vue.createElementBlock)("h2", {
    class: (0, _vue.normalizeClass)(["mTitle text-x1479 p:text-32 t:text-28 m:text-26", $props.style.main])
  }, [(0, _vue.createElementVNode)("strong", null, [(0, _vue.renderSlot)(_ctx.$slots, "title")])], 2);
}

/***/ }),

/***/ 8218:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;


__webpack_unused_export__ = ({
  value: true
});
exports.s = render;

var _vue = __webpack_require__(7834);

var _hoisted_1 = {
  class: "mTools pt:flex pt:items-center m:flex m:flex-col-reverse relative"
};

function render(_ctx, _cache, $props, $setup, $data, $options) {
  return (0, _vue.openBlock)(), (0, _vue.createElementBlock)("div", _hoisted_1, [(0, _vue.renderSlot)(_ctx.$slots, "tools_content")]);
}

/***/ }),

/***/ 5347:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.apiPositionSetting = exports.apiPage = exports.apiMenupage = exports.apiPpagepictures = exports.apiLinks = exports.apiArticles = exports.apiCategories = exports.apiUserRoles = exports.apiMenu = exports.apiInfo = void 0;

var _axios = _interopRequireDefault(__webpack_require__(4206));

var _factory = __webpack_require__(1956);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var apiRequest = _axios.default.create({
  baseURL:  false ? 0 : "".concat((0, _factory.path)('apiPath'), "/web/"),
  headers: {
    'Access-Control-Allow-Origin': '*'
  }
}); // common


var apiInfo = function apiInfo(data) {
  return apiRequest.get('information', {
    params: data
  });
};

exports.apiInfo = apiInfo;

var apiMenu = function apiMenu(data) {
  return apiRequest.get('menus', {
    params: data
  });
};

exports.apiMenu = apiMenu;

var apiUserRoles = function apiUserRoles(data) {
  return apiRequest.get('userroles', {
    params: data
  });
};

exports.apiUserRoles = apiUserRoles;

var apiCategories = function apiCategories(data) {
  return apiRequest.get('categories', {
    params: data
  });
};

exports.apiCategories = apiCategories;

var apiArticles = function apiArticles(data) {
  var _data$params;

  return apiRequest.get("articles".concat((_data$params = data.params) !== null && _data$params !== void 0 && _data$params.articleId ? '/' + data.params.articleId : ''), {
    params: data
  });
};

exports.apiArticles = apiArticles;

var apiLinks = function apiLinks(data) {
  return apiRequest.get('links', {
    params: data
  });
};

exports.apiLinks = apiLinks;

var apiPpagepictures = function apiPpagepictures(data) {
  return apiRequest.get('indexpagepictures', {
    params: data
  });
};

exports.apiPpagepictures = apiPpagepictures;

var apiMenupage = function apiMenupage(data) {
  return apiRequest.get('menupage', {
    params: data
  });
};

exports.apiMenupage = apiMenupage;

var apiPage = function apiPage(data) {
  return apiRequest.get('page', {
    params: data
  });
};

exports.apiPage = apiPage;

var apiPositionSetting = function apiPositionSetting(data) {
  return apiRequest.get('websitesectionpositionsettings', {
    params: data
  });
};

exports.apiPositionSetting = apiPositionSetting;

/***/ }),

/***/ 1359:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.saveScrollTo = exports.saveScrollToSession = void 0;

__webpack_require__(6248);

var _axios = __webpack_require__(5347);

var _vue = __webpack_require__(7834);

var _Header = _interopRequireDefault(__webpack_require__(5438));

var _Footer = _interopRequireDefault(__webpack_require__(8314));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var svgRequire = function svgRequire(requireContext) {
  return requireContext.keys().map(requireContext);
};

var req = __webpack_require__(339);

svgRequire(req);

var saveScrollToSession = function saveScrollToSession() {
  sessionStorage.setItem('scrollTo', 'true');
};

exports.saveScrollToSession = saveScrollToSession;

var saveScrollTo = function saveScrollTo(e) {
  e.preventDefault();
  saveScrollToSession();
  window.location.href = e.currentTarget.href;
}; // 取得 Information api


exports.saveScrollTo = saveScrollTo;
(0, _axios.apiInfo)().then(function (res) {
  var status = res.status,
      data = res.data;
  console.log(res);

  if (status === 200) {
    (0, _vue.createApp)(_Header.default).provide('set', data.data).mount('#header');
    (0, _vue.createApp)(_Footer.default).provide('set', data.data).mount('#footer');
  }
});

/***/ }),

/***/ 1956:
/***/ (function(__unused_webpack_module, exports) {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.scrollTo = exports.prjs = exports.eventQueue = exports.j$ = exports.getImageSrc = exports.getYoutubeImage = exports.actionURL = exports.dateReturn = exports.queryParam = exports.params = exports.path = exports.getFunctionCadeData = exports.language = exports.device = exports.svgRequire = exports.importantName = exports.listAllName = exports.functionCode = exports.userRoute = exports.rootPath = void 0;
var rootPath = '/University';
exports.rootPath = rootPath;
var userRoute = new RegExp("(?!".concat(rootPath, ")\\/(\\w+)\\/(.*TW|.*tw|en)")).test(window.location.pathname) ? new RegExp("(?!".concat(rootPath, ")\\/(\\w+)\\/(.*TW|.*tw|en)")).exec(window.location.pathname)[1] : 'Web';
exports.userRoute = userRoute;
var functionCode = JSON.parse(document.querySelector('[name="functionCode"]').value.replace(/'/g, '"'));
exports.functionCode = functionCode;
var listAllName = JSON.parse(document.querySelector('[name="listName"]').value.replace(/'/g, '"'));
exports.listAllName = listAllName;
var importantName = JSON.parse(document.querySelector('[name="importantName"]').value.replace(/'/g, '"'));
exports.importantName = importantName;

var svgRequire = function svgRequire(req) {
  var use = Array.prototype.slice.call(document.getElementsByTagName('use'));
  use.forEach(function (elem) {
    var href = elem.href;
    var svg = "".concat(/(?!#).*/.exec(href.baseVal)[0], ".svg");
    var files = {};
    req.keys().forEach(function (filename) {
      if (new RegExp(filename).test(svg)) {
        files[filename] = req(filename);
      }
    });
  });
};

exports.svgRequire = svgRequire;

var device = function device() {
  var angle = window.screen.orientation ? window.screen.orientation.angle : 0;

  if (window.innerWidth <= 740 || /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    return 'M';
  }

  if (angle === 0 && window.innerWidth > 740 && window.innerWidth < 1024 || /Android|webOS|iPad|BlackBerry/i.test(navigator.userAgent)) {
    return 'T';
  }

  if (angle !== 0 && window.innerWidth > 730 && window.innerWidth < 815 || /iPhone/i.test(navigator.userAgent)) {
    return 'M';
  }

  return 'P';
};

exports.device = device;

var language = function language(callback) {
  var langData = document.querySelector('[name="language"]').value.split(',');
  var langResult = null;

  for (var i = 0; i < langData.length; i += 1) {
    var item = langData[i].replace(/^\s/, '');
    var lang = item.split('-')[0];
    var text = item.split('-')[1];

    if (new RegExp(lang).test(window.location.pathname)) {
      langResult = lang;
    } else if (!new RegExp(lang).test(window.location.pathname) && callback) {
      callback(item, lang, text);
    }

    if (!langResult && /tw/.test(lang.toLowerCase())) {
      langResult = lang;
    }
  }

  return langResult;
};

exports.language = language;

var getFunctionCadeData = function getFunctionCadeData(key) {
  var funCode = null;

  for (var i = 0; i < functionCode.length; i += 1) {
    var id = functionCode[i].id;

    if (key && key === id) {
      funCode = functionCode[i];
    } else if (new RegExp(id).test(window.location.pathname)) {
      funCode = functionCode[i];
    }
  }

  return funCode;
};

exports.getFunctionCadeData = getFunctionCadeData;

var path = function path(name) {
  return document.querySelector("[name=\"".concat(name, "\"]")).value;
};

exports.path = path;

var params = function params(key) {
  var paramsValue = null;
  var listRegex = new RegExp("".concat(document.querySelector('[name="listPath"]').value, "\\w+\\/(\\d+)"));

  if (key === 'listPath' && listRegex.test(window.location.pathname)) {
    var id = listRegex.exec(window.location.pathname)[1];
    paramsValue = id === '0' ? null : id;
  } else if (key === 'categoryId') {
    paramsValue = new RegExp("".concat(getFunctionCadeData().id, "/(\\d+)")).test(window.location.pathname) ? new RegExp("".concat(getFunctionCadeData().id, "/(\\d+)")).exec(window.location.pathname)[1] : null;
  } else if (key === 'articleId' && /(\d+)\/?$/.test(window.location.pathname) || key === 'listPage') {
    paramsValue = /(\d+)\/?$/.exec(window.location.pathname)[1];
  } else if (key === 'menuPage') {
    paramsValue = new RegExp("(?!".concat(rootPath, ")\\/(.*TW|.*tw|en)\\/(\\w+)")).exec(window.location.pathname)[2];
  } else if (key === 'menuPageId' || key === 'page') {
    paramsValue = /([^/]+)\/?$/.exec(window.location.pathname)[1];
  } // console.log(path(key));
  // if (key === 'functionCode') {
  //   for (let i = 0; i < functionCode.length; i += 1) {
  //     const { id } = functionCode[i];
  //     if (new RegExp(id).test(window.location.pathname)) {
  //       paramsValue = id;
  //     }
  //   }
  // }
  // const paramsKey = new RegExp(`${key}=([^?&#]*)`);


  return paramsValue;
};

exports.params = params;

var queryParam = function queryParam(param, value) {
  var symbol = /\?/.test(window.location.href) ? '&' : '?';
  var paramsKey = new RegExp("([?;&])".concat(param, "[^&;]*[;&]?"));
  var query = null;

  if (paramsKey.test(window.location.href)) {
    query = window.location.href.replace(paramsKey, "$1".concat(param, "=").concat(value));
  } else {
    query = "".concat(window.location.href).concat(symbol).concat(param, "=").concat(value);
  }

  return query;
};

exports.queryParam = queryParam;

var dateReturn = function dateReturn(date) {
  var dateValue = date ? /\d{4}\W\d{2}\W\d{2}/.exec(date)[0] : null;
  return dateValue;
};

exports.dateReturn = dateReturn;

var actionURL = function actionURL(page, param) {
  // const symbol = /\?/.test(window.location.href) ? '&' : '?';
  var newPath = "".concat(rootPath, "/").concat(userRoute, "/").concat(language(), "/").concat(page || '');
  var query = null;

  if (page === 'index') {
    newPath = /en/.test(language()) ? "".concat(rootPath, "/").concat(userRoute, "/").concat(language()) : '/';
    query = newPath;
  } else {
    for (var i = 0; i < param.length; i += 1) {
      var paramName = param[i].toString().split('-')[0];
      var paramValue = param[i].toString().split('-').length === 1 ? null : param[i].toString().split('-')[1]; // const paramsKey = new RegExp(`([?;&])${paramName}[^&;]*[;&]?`);

      if (paramValue) {
        if (paramName === 'userRoute') {
          newPath = "".concat(rootPath, "/").concat(paramValue, "/").concat(language(), "/").concat(page || '');
          query = newPath;
        } else if (paramName === 'language') {
          var lang = null;

          if (/en\w+\/?$/.test(window.location.pathname)) {
            lang = '/';
          } else if (new RegExp(language()).test(window.location.pathname)) {
            lang = window.location.pathname.replace(language(), paramValue);
          } else {
            lang = "".concat(rootPath, "/").concat(userRoute, "/").concat(paramValue, "/").concat(page || '');
          }

          query = lang;
        } else if (paramName === 'functionCode') {
          // const funCode = new RegExp(paramValue).test(window.location.pathname)
          //   ? `${window.location.pathname.replace(/\/$/, '').replace(getFunctionCadeData().id, `${paramValue}/`)}`
          //   : `${query || newPath}${paramValue}/`;
          query = "".concat(newPath).concat(paramValue, "/");
        } else if (paramName === 'listCategory') {
          var categoryId = /List\/(\w+)\/(\d+)\//.test(window.location.pathname) ? "".concat(window.location.pathname.replace(/\/$/, '').replace(/List\/(\w+)\/(\d+)\//, "List/$1/".concat(paramValue, "/"))) : "".concat(query || newPath).concat(paramValue, "/");
          query = categoryId;
        } else if (paramName === 'articleCategory') {
          query = "".concat(query).concat(paramValue, "/");
          console.log(query);
        } else if (paramName === 'page') {
          // console.log(query);
          query = "".concat(query.replace(/\d+$/, paramValue), "/");
        } else {
          query = "".concat(query || newPath).concat(paramName);
        }
      } else {
        query = "".concat(query || newPath).concat(paramName, "/");
      } // if (i === 0) {
      // } else if (paramName) {
      //   query = `${query}/${paramName}/${paramValue}`;
      // } else {
      //   query = `${query}/${paramName}/${params(paramName)}`;
      // }

    }
  }

  return query;
};

exports.actionURL = actionURL;

var getYoutubeImage = function getYoutubeImage(item) {
  var youtubeURL = /en/.test(language()) ? item.englishVideoURL : item.chineseVideoURL;
  var cover = youtubeURL ? youtubeURL.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/i)[1] : null;
  var coverPath = cover ? "https://img.youtube.com/vi/".concat(cover, "/mqdefault.jpg") : null;
  return coverPath;
};

exports.getYoutubeImage = getYoutubeImage;

var getImageSrc = function getImageSrc(src) {
  var imgPath = null;
  var apiPath = path('apiPath');

  if (src) {
    if (/^www\./.test(src)) {
      imgPath = "http://".concat(src);
    } else if (/^\/uploads/.test(src.toLowerCase())) {
      imgPath = "".concat(apiPath).concat(src);
    } else {
      imgPath = src;
    }
  } // console.log(src);


  return imgPath;
};

exports.getImageSrc = getImageSrc;
var _j$ = null;
exports.j$ = _j$;
var eventQueue = [];
exports.eventQueue = eventQueue;

if (typeof _j$ === 'undefined') {
  window.j$ = {};
}

document.addEventListener('DOMContentLoaded', function () {
  eventQueue.forEach(function (fn) {
    fn();
  });
}, {
  passive: true
});

exports.j$ = _j$ = function j$(arg) {
  var htmlEls;
  var matches;

  if (arg instanceof Function) {
    eventQueue.push(arg);
    return document;
  }

  if (arg instanceof Object) {
    return new _j$.Fn([arg]);
  }

  if (arg instanceof HTMLElement) {
    htmlEls = [arg];
  } else {
    matches = arg ? arg.match(/^<(\w+)>$/) : null;

    if (matches) {
      htmlEls = [document.createElement(matches[1])];
    } else {
      htmlEls = Array.prototype.slice.call(document.querySelectorAll(arg));
    }
  }

  return new _j$.Fn(htmlEls);
}; // eslint-disable-next-line func-names


_j$.Fn = function (elements) {
  this[0] = elements;
  return this;
};

_j$.Fn.prototype = {
  // eslint-disable-next-line func-names
  html: function html(string) {
    if (typeof string !== 'undefined') {
      this[0].forEach(function (el) {
        el.innerHTML = string;
      });
      return this;
    }

    return this[0][0].innerHTML;
  },
  // eslint-disable-next-line func-names
  text: function text(string) {
    var text = '';

    if (typeof string !== 'undefined') {
      this[0].forEach(function (el) {
        el.innerText = string;
      });
      return this;
    }

    this[0].forEach(function (el) {
      text += el.innerText;
    });
    return text;
  },
  // eslint-disable-next-line func-names
  parents: function parents(className) {
    var target = this[0][0];
    var $parents = null;

    while (target.parentNode != null && target.parentNode !== document.documentElement) {
      if (target.matches) {
        if (target.matches(className)) {
          $parents = new _j$.Fn([target]);
          break;
        }
      } else if (target.msMatchesSelector) {
        if (target.msMatchesSelector(className)) {
          $parents = new _j$.Fn([target]);
          break;
        }
      }

      target = target.parentNode;
    }

    return $parents;
  },
  // eslint-disable-next-line func-names
  parent: function parent() {
    var parents = [];
    var currentParent = null;
    this[0].forEach(function (el) {
      currentParent = el.parentElement;

      if (parents.indexOf(currentParent) === -1) {
        parents.push(currentParent);
      }
    });
    return new _j$.Fn(parents);
  },
  // eslint-disable-next-line func-names
  prev: function prev() {
    var prev = null;
    this[0].forEach(function (el) {
      prev = el.previousElementSibling;
    });
    return new _j$.Fn([prev]);
  },
  // eslint-disable-next-line func-names
  next: function next() {
    var next = null;
    this[0].forEach(function (el) {
      next = el.nextElementSibling;
    });
    return new _j$.Fn([next]);
  },
  // eslint-disable-next-line func-names
  find: function find(selector) {
    var matchingElements = [];
    var currentMatchesQuery = null;
    var currentMatches = null;
    this[0].forEach(function (el) {
      var className = el.className ? ".".concat(el.className.replace(/(?!\s)(\W)/g, '\\$1').replace(/\s/g, '.')) : null;
      currentMatchesQuery = /^\s?>/.test(selector) ? document.querySelectorAll("".concat(className, " ").concat(selector.replace(/^\s/, ''))) : el.querySelectorAll(selector);
      currentMatches = Array.prototype.slice.call(currentMatchesQuery);
      currentMatches.forEach(function (match) {
        if (matchingElements.indexOf(match) === -1) {
          matchingElements.push(match);
        }
      });
    });
    return new _j$.Fn(matchingElements);
  },
  // eslint-disable-next-line func-names
  children: function children(tagName) {
    var children = [];
    this[0].forEach(function (el) {
      for (var i = 0; i < el.children.length; i += 1) {
        var $children = el.children[i];

        if (tagName) {
          if (/^./.test(tagName) && $children.className === tagName || /^#/.test(tagName) && $children.id === tagName) {
            children.push($children);
          } else if ($children.nodeName.toLowerCase() === tagName) {
            children.push($children);
          }
        } else {
          children.push($children);
        }
      }
    });
    return new _j$.Fn(children);
  },
  // eslint-disable-next-line func-names
  siblings: function siblings() {
    var sibling = this[0][0].parentNode.firstChild;
    var siblings = [];

    while (sibling) {
      if (sibling.nodeType === 1 && sibling !== this[0][0]) {
        siblings.push(sibling);
      }

      sibling = sibling.nextSibling;
    }

    return new _j$.Fn(siblings);
  },
  // eslint-disable-next-line func-names
  closest: function closest(selector) {
    if (!Element.prototype.matches) {
      Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
    }

    if (!Element.prototype.closest) {
      // eslint-disable-next-line func-names
      Element.prototype.closest = function (s) {
        var el = this;
        if (!document.documentElement.contains(el)) return null;

        do {
          if (el.matches(s)) return el;
          el = el.parentElement;
        } while (el !== null);

        return null;
      };
    }

    var closest = null;
    this[0].forEach(function (el) {
      closest = el.closest(selector);
    });
    return new _j$.Fn([closest]);
  },
  // eslint-disable-next-line func-names
  click: function click() {
    this[0].forEach(function (el) {
      el.click();
    });
    return this;
  },
  // eslint-disable-next-line func-names
  trigger: function trigger(eventName) {
    this[0].forEach(function (el) {
      var event = document.createEvent('Event');
      event.initEvent(eventName, true, true);
      el.dispatchEvent(event);
    });
    return this;
  },
  // eslint-disable-next-line func-names
  hover: function hover(mouseoverhandle, mouseouthandle) {
    this[0].forEach(function (el) {
      el.addEventListener('mouseenter', mouseoverhandle, {
        passive: false
      });
      el.addEventListener('mouseleave', mouseouthandle || mouseoverhandle, {
        passive: false
      });
    });
    return this;
  },
  // eslint-disable-next-line func-names
  on: function on(eventName, elementSelector, handle) {
    var _this = this;

    this[0].forEach(function (el) {
      if (elementSelector && typeof elementSelector === 'string') {
        if (eventName === 'ready') {
          el.addEventListener('DOMContentLoaded', function (e) {
            handle.call(e);
          }, {
            passive: false
          });
        } else {
          el.addEventListener(eventName, function (e) {
            for (var target = e.target; target && target !== _this; target = target.parentNode) {
              if (target.matches) {
                if (target.matches(elementSelector)) {
                  e.$this = target;
                  handle.call(target, e);
                  break;
                }
              } else if (target.msMatchesSelector) {
                if (target.msMatchesSelector(elementSelector)) {
                  e.$this = target;
                  handle.call(target, e);
                  break;
                }
              }
            }
          }, {
            passive: false
          });
        }
      } else {
        var func = elementSelector;

        if (eventName === 'ready') {
          el.addEventListener('DOMContentLoaded', function (e) {
            func.call(e);
          }, {
            passive: false
          });
        } else {
          el.addEventListener(eventName, function (e) {
            e.$this = el;
            func.call(e.target, e);
          }, {
            passive: false
          });
        }
      }
    });
    return this;
  },
  // eslint-disable-next-line func-names
  off: function off(eventName, elementSelector, handle) {
    // eslint-disable-next-line func-names
    this[0].forEach(function (el) {
      if (elementSelector && typeof elementSelector === 'string') {
        // eslint-disable-next-line func-names
        el.removeEventListener(eventName, function (e) {
          for (var target = e.target; target && target !== this; target = target.parentNode) {
            if (target.matches) {
              if (target.matches(elementSelector)) {
                e.$this = target;
                handle.call(target, e);
                break;
              }
            } else if (target.msMatchesSelector) {
              if (target.msMatchesSelector(elementSelector)) {
                e.$this = target;
                handle.call(target, e);
                break;
              }
            }
          }
        }, {
          passive: false
        });
      } else {
        var func = elementSelector || null;
        el.removeEventListener(eventName, function (e) {
          e.$this = el;
          func.call(e.target, e);
        }, {
          passive: false
        });
      }
    });
    return this;
  },
  // eslint-disable-next-line func-names
  addClass: function addClass(className) {
    this[0].forEach(function (el) {
      el.classList.add(className);
    });
    return this;
  },
  // eslint-disable-next-line func-names
  removeClass: function removeClass(className) {
    this[0].forEach(function (el) {
      el.classList.remove(className);
    });
    return this;
  },
  // eslint-disable-next-line func-names
  toggleClass: function toggleClass(className) {
    this[0].forEach(function (el) {
      el.classList.toggle(className);
    });
    return this;
  },
  // eslint-disable-next-line func-names
  hasClass: function hasClass(className) {
    var hasClass = false;
    this[0].forEach(function (el) {
      hasClass = el ? new RegExp('(\\s|^)' + className + '(\\s|$)').test(el.className) : false; // if (el.className.replace(/[\n\t]/g, ' ').indexOf(className) > -1) {
      //   hasClass = true;
      // } else {
      //   hasClass = false;
      // }
    });
    return hasClass;
  },
  // eslint-disable-next-line func-names
  attr: function attr(attributeName, attributeValue) {
    if (typeof attributeValue !== 'undefined') {
      this[0].forEach(function (el) {
        el.setAttribute(attributeName, attributeValue);
      });
      return this;
    }

    return this[0][0].getAttribute(attributeName);
  },
  // eslint-disable-next-line func-names
  data: function data(attributeName, attributeValue) {
    if (typeof attributeValue !== 'undefined') {
      this[0].forEach(function (el) {
        el.dataset[attributeName] = attributeValue;
      });
      return this;
    }

    return this[0][0].dataset[attributeName];
  },
  // eslint-disable-next-line func-names
  removeAttr: function removeAttr(attributeName) {
    this[0].forEach(function (el) {
      el.removeAttribute(attributeName);
    });
    return this;
  },
  // eslint-disable-next-line func-names
  width: function width() {
    var width = '';
    this[0].forEach(function (el) {
      width = el.innerWidth || el.offsetWidth || el.scrollWidth || el.clientWidth;
    });
    return width;
  },
  // eslint-disable-next-line func-names
  height: function height() {
    var height = '';
    this[0].forEach(function (el) {
      height = el.innerHeight || el.offsetHeight || el.scrollHeight || el.clientHeight;
    });
    return height;
  },
  // eslint-disable-next-line func-names
  css: function css(style, value) {
    if (typeof style !== 'undefined' && typeof value !== 'undefined') {
      this[0].forEach(function (el) {
        el.style[style] = value;
      });
      return this;
    }

    return getComputedStyle(this[0][0])[style];
  },
  // eslint-disable-next-line func-names
  empty: function empty() {
    while (this[0][0].firstChild) {
      this[0][0].removeChild(this[0][0].firstChild);
    }

    return this;
  },
  // eslint-disable-next-line func-names
  remove: function remove() {
    this[0].forEach(function (el) {
      if (!('remove' in Element.prototype)) {
        el.parentNode.removeChild(el);
      } else {
        el.remove();
      }
    });
  },
  // eslint-disable-next-line func-names
  append: function append(arg) {
    if (arg instanceof _j$.Fn) {
      // eslint-disable-next-line func-names
      arg[0].forEach(function (el) {
        var elem = el.length ? el.cloneNode(true) : el;
        this[0][0].appendChild(elem);
      }.bind(this));
    } else if (arg instanceof HTMLElement) {
      var child = arg.length ? arg.cloneNode(true) : arg;
      this[0][0].appendChild(child);
    } else if (typeof arg === 'string') {
      this[0].forEach(function (el) {
        el.innerHTML += arg;
      });
    }

    return this;
  },
  // eslint-disable-next-line func-names
  before: function before(arg) {
    if (arg instanceof _j$.Fn) {
      // eslint-disable-next-line func-names
      arg[0].forEach(function (el) {
        this[0][0].parentNode.insertBefore(el, this[0][0]);
      }.bind(this));
    }

    return this;
  },
  // eslint-disable-next-line func-names
  after: function after(arg) {
    if (arg instanceof _j$.Fn) {
      // eslint-disable-next-line func-names
      arg[0].forEach(function (el) {
        if (this[0][0].parentNode.lastChild === this[0][0]) {
          this[0][0].parentNode.appendChild(el, this[0][0]);
        } else {
          this[0][0].parentNode.insertBefore(el, this[0][0].nextSibling);
        }
      }.bind(this));
    }

    return this;
  },
  // eslint-disable-next-line func-names
  val: function val(value) {
    if (typeof value !== 'undefined') {
      this[0].forEach(function (el) {
        el.value = value;
      });
      return this;
    }

    return this[0][0].value;
  },
  // eslint-disable-next-line func-names
  offset: function offset() {
    var wScroll = {
      y: /(iPhone||iPad)\W+.*\sOS\s12_/.test(navigator.userAgent) ? window.scrollY : 0
    };
    var $el = this[0][0];
    var top = 0;
    var left = 0;

    while ($el && typeof $el.offsetLeft !== 'undefined' && typeof $el.offsetTop !== 'undefined') {
      top += $el.offsetTop - $el.scrollTop + $el.clientTop;
      left += $el.offsetLeft - $el.scrollLeft + $el.clientLeft;
      $el = $el.offsetParent;
    }

    return {
      top: top + wScroll.y,
      left: left
    };
  },
  // eslint-disable-next-line func-names
  position: function position() {
    var $el = this[0][0];
    var top = 0;
    var left = 0;
    var parentTop = $el.offsetParent.offsetTop;
    var parentLeft = $el.offsetParent.offsetLeft;

    while ($el) {
      top += $el.offsetTop - $el.scrollTop + $el.clientTop;
      left += $el.offsetLeft - $el.scrollLeft + $el.clientLeft;
      $el = $el.offsetParent;
    }

    return {
      top: top - parentTop,
      left: left - parentLeft
    };
  },
  // eslint-disable-next-line func-names
  prop: function prop(type, value) {
    var prop = null;

    if (typeof value !== 'undefined') {
      this[0].forEach(function (el) {
        el[type] = value;
      });
      return this;
    }

    this[0].forEach(function (el) {
      prop = el[type];
    });
    return prop;
  },
  // eslint-disable-next-line func-names
  eq: function eq(index) {
    return new _j$.Fn([typeof this[0][0][0] !== 'undefined' ? this[0][0][0][index] : this[0][index]]);
  },
  // eslint-disable-next-line func-names
  index: function index() {
    var children = this[0][0].parentNode.children;
    var num = 0;

    for (var i = 0; i < children.length; i += 1) {
      if (children[i] === this[0][0]) {
        return num;
      }

      if (children[i].nodeType === 1) {
        num += 1;
      }
    }

    return -1;
  }
};
var prjs = {
  $w: _j$(window),
  $d: _j$(document),
  $hb: _j$('html, body'),
  $b: _j$('body')
};
exports.prjs = prjs;

var scrollTo = function scrollTo(obj) {
  var top = obj.top ? obj.top : 0;
  var left = obj.left ? obj.left : 0;
  var supportsNativeSmoothScroll = ('scrollBehavior' in document.documentElement.style);

  var nativeSmoothScrollTo = function nativeSmoothScrollTo() {
    window.scroll({
      top: top,
      left: left,
      behavior: 'smooth'
    });
  };

  var smoothScrollTo = function smoothScrollTo() {
    var element = document.scrollingElement || document.documentElement;
    var start = element.scrollTop;
    var change = top - start;
    var startDate = +new Date();

    var easeInOutQuad = function easeInOutQuad(t, b, c, d) {
      var T = t / (d / 2);
      if (T < 1) return c / 2 * T * T + b;
      T = t - 1;
      return -c / 2 * (t * (t - 2) - 1) + b;
    };

    var animateScroll = function animateScroll() {
      var currentDate = +new Date();
      var currentTime = currentDate - startDate;
      element.scrollTop = parseInt(easeInOutQuad(currentTime, start, change, 600), 10);

      if (currentTime < 600) {
        requestAnimationFrame(animateScroll);
      } else {
        element.scrollTop = top;
      }
    };

    animateScroll();
  };

  if (supportsNativeSmoothScroll) {
    nativeSmoothScrollTo();
  } else {
    smoothScrollTo();
  }
};

exports.scrollTo = scrollTo;

/***/ }),

/***/ 3941:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ }),

/***/ 6248:
/***/ (function(module) {

/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var runtime = (function (exports) {
  "use strict";

  var Op = Object.prototype;
  var hasOwn = Op.hasOwnProperty;
  var undefined; // More compressible than void 0.
  var $Symbol = typeof Symbol === "function" ? Symbol : {};
  var iteratorSymbol = $Symbol.iterator || "@@iterator";
  var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
  var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";

  function define(obj, key, value) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
    return obj[key];
  }
  try {
    // IE 8 has a broken Object.defineProperty that only works on DOM objects.
    define({}, "");
  } catch (err) {
    define = function(obj, key, value) {
      return obj[key] = value;
    };
  }

  function wrap(innerFn, outerFn, self, tryLocsList) {
    // If outerFn provided and outerFn.prototype is a Generator, then outerFn.prototype instanceof Generator.
    var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
    var generator = Object.create(protoGenerator.prototype);
    var context = new Context(tryLocsList || []);

    // The ._invoke method unifies the implementations of the .next,
    // .throw, and .return methods.
    generator._invoke = makeInvokeMethod(innerFn, self, context);

    return generator;
  }
  exports.wrap = wrap;

  // Try/catch helper to minimize deoptimizations. Returns a completion
  // record like context.tryEntries[i].completion. This interface could
  // have been (and was previously) designed to take a closure to be
  // invoked without arguments, but in all the cases we care about we
  // already have an existing method we want to call, so there's no need
  // to create a new function object. We can even get away with assuming
  // the method takes exactly one argument, since that happens to be true
  // in every case, so we don't have to touch the arguments object. The
  // only additional allocation required is the completion record, which
  // has a stable shape and so hopefully should be cheap to allocate.
  function tryCatch(fn, obj, arg) {
    try {
      return { type: "normal", arg: fn.call(obj, arg) };
    } catch (err) {
      return { type: "throw", arg: err };
    }
  }

  var GenStateSuspendedStart = "suspendedStart";
  var GenStateSuspendedYield = "suspendedYield";
  var GenStateExecuting = "executing";
  var GenStateCompleted = "completed";

  // Returning this object from the innerFn has the same effect as
  // breaking out of the dispatch switch statement.
  var ContinueSentinel = {};

  // Dummy constructor functions that we use as the .constructor and
  // .constructor.prototype properties for functions that return Generator
  // objects. For full spec compliance, you may wish to configure your
  // minifier not to mangle the names of these two functions.
  function Generator() {}
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}

  // This is a polyfill for %IteratorPrototype% for environments that
  // don't natively support it.
  var IteratorPrototype = {};
  define(IteratorPrototype, iteratorSymbol, function () {
    return this;
  });

  var getProto = Object.getPrototypeOf;
  var NativeIteratorPrototype = getProto && getProto(getProto(values([])));
  if (NativeIteratorPrototype &&
      NativeIteratorPrototype !== Op &&
      hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
    // This environment has a native %IteratorPrototype%; use it instead
    // of the polyfill.
    IteratorPrototype = NativeIteratorPrototype;
  }

  var Gp = GeneratorFunctionPrototype.prototype =
    Generator.prototype = Object.create(IteratorPrototype);
  GeneratorFunction.prototype = GeneratorFunctionPrototype;
  define(Gp, "constructor", GeneratorFunctionPrototype);
  define(GeneratorFunctionPrototype, "constructor", GeneratorFunction);
  GeneratorFunction.displayName = define(
    GeneratorFunctionPrototype,
    toStringTagSymbol,
    "GeneratorFunction"
  );

  // Helper for defining the .next, .throw, and .return methods of the
  // Iterator interface in terms of a single ._invoke method.
  function defineIteratorMethods(prototype) {
    ["next", "throw", "return"].forEach(function(method) {
      define(prototype, method, function(arg) {
        return this._invoke(method, arg);
      });
    });
  }

  exports.isGeneratorFunction = function(genFun) {
    var ctor = typeof genFun === "function" && genFun.constructor;
    return ctor
      ? ctor === GeneratorFunction ||
        // For the native GeneratorFunction constructor, the best we can
        // do is to check its .name property.
        (ctor.displayName || ctor.name) === "GeneratorFunction"
      : false;
  };

  exports.mark = function(genFun) {
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
    } else {
      genFun.__proto__ = GeneratorFunctionPrototype;
      define(genFun, toStringTagSymbol, "GeneratorFunction");
    }
    genFun.prototype = Object.create(Gp);
    return genFun;
  };

  // Within the body of any async function, `await x` is transformed to
  // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
  // `hasOwn.call(value, "__await")` to determine if the yielded value is
  // meant to be awaited.
  exports.awrap = function(arg) {
    return { __await: arg };
  };

  function AsyncIterator(generator, PromiseImpl) {
    function invoke(method, arg, resolve, reject) {
      var record = tryCatch(generator[method], generator, arg);
      if (record.type === "throw") {
        reject(record.arg);
      } else {
        var result = record.arg;
        var value = result.value;
        if (value &&
            typeof value === "object" &&
            hasOwn.call(value, "__await")) {
          return PromiseImpl.resolve(value.__await).then(function(value) {
            invoke("next", value, resolve, reject);
          }, function(err) {
            invoke("throw", err, resolve, reject);
          });
        }

        return PromiseImpl.resolve(value).then(function(unwrapped) {
          // When a yielded Promise is resolved, its final value becomes
          // the .value of the Promise<{value,done}> result for the
          // current iteration.
          result.value = unwrapped;
          resolve(result);
        }, function(error) {
          // If a rejected Promise was yielded, throw the rejection back
          // into the async generator function so it can be handled there.
          return invoke("throw", error, resolve, reject);
        });
      }
    }

    var previousPromise;

    function enqueue(method, arg) {
      function callInvokeWithMethodAndArg() {
        return new PromiseImpl(function(resolve, reject) {
          invoke(method, arg, resolve, reject);
        });
      }

      return previousPromise =
        // If enqueue has been called before, then we want to wait until
        // all previous Promises have been resolved before calling invoke,
        // so that results are always delivered in the correct order. If
        // enqueue has not been called before, then it is important to
        // call invoke immediately, without waiting on a callback to fire,
        // so that the async generator function has the opportunity to do
        // any necessary setup in a predictable way. This predictability
        // is why the Promise constructor synchronously invokes its
        // executor callback, and why async functions synchronously
        // execute code before the first await. Since we implement simple
        // async functions in terms of async generators, it is especially
        // important to get this right, even though it requires care.
        previousPromise ? previousPromise.then(
          callInvokeWithMethodAndArg,
          // Avoid propagating failures to Promises returned by later
          // invocations of the iterator.
          callInvokeWithMethodAndArg
        ) : callInvokeWithMethodAndArg();
    }

    // Define the unified helper method that is used to implement .next,
    // .throw, and .return (see defineIteratorMethods).
    this._invoke = enqueue;
  }

  defineIteratorMethods(AsyncIterator.prototype);
  define(AsyncIterator.prototype, asyncIteratorSymbol, function () {
    return this;
  });
  exports.AsyncIterator = AsyncIterator;

  // Note that simple async functions are implemented on top of
  // AsyncIterator objects; they just return a Promise for the value of
  // the final result produced by the iterator.
  exports.async = function(innerFn, outerFn, self, tryLocsList, PromiseImpl) {
    if (PromiseImpl === void 0) PromiseImpl = Promise;

    var iter = new AsyncIterator(
      wrap(innerFn, outerFn, self, tryLocsList),
      PromiseImpl
    );

    return exports.isGeneratorFunction(outerFn)
      ? iter // If outerFn is a generator, return the full iterator.
      : iter.next().then(function(result) {
          return result.done ? result.value : iter.next();
        });
  };

  function makeInvokeMethod(innerFn, self, context) {
    var state = GenStateSuspendedStart;

    return function invoke(method, arg) {
      if (state === GenStateExecuting) {
        throw new Error("Generator is already running");
      }

      if (state === GenStateCompleted) {
        if (method === "throw") {
          throw arg;
        }

        // Be forgiving, per 25.3.3.3.3 of the spec:
        // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
        return doneResult();
      }

      context.method = method;
      context.arg = arg;

      while (true) {
        var delegate = context.delegate;
        if (delegate) {
          var delegateResult = maybeInvokeDelegate(delegate, context);
          if (delegateResult) {
            if (delegateResult === ContinueSentinel) continue;
            return delegateResult;
          }
        }

        if (context.method === "next") {
          // Setting context._sent for legacy support of Babel's
          // function.sent implementation.
          context.sent = context._sent = context.arg;

        } else if (context.method === "throw") {
          if (state === GenStateSuspendedStart) {
            state = GenStateCompleted;
            throw context.arg;
          }

          context.dispatchException(context.arg);

        } else if (context.method === "return") {
          context.abrupt("return", context.arg);
        }

        state = GenStateExecuting;

        var record = tryCatch(innerFn, self, context);
        if (record.type === "normal") {
          // If an exception is thrown from innerFn, we leave state ===
          // GenStateExecuting and loop back for another invocation.
          state = context.done
            ? GenStateCompleted
            : GenStateSuspendedYield;

          if (record.arg === ContinueSentinel) {
            continue;
          }

          return {
            value: record.arg,
            done: context.done
          };

        } else if (record.type === "throw") {
          state = GenStateCompleted;
          // Dispatch the exception by looping back around to the
          // context.dispatchException(context.arg) call above.
          context.method = "throw";
          context.arg = record.arg;
        }
      }
    };
  }

  // Call delegate.iterator[context.method](context.arg) and handle the
  // result, either by returning a { value, done } result from the
  // delegate iterator, or by modifying context.method and context.arg,
  // setting context.delegate to null, and returning the ContinueSentinel.
  function maybeInvokeDelegate(delegate, context) {
    var method = delegate.iterator[context.method];
    if (method === undefined) {
      // A .throw or .return when the delegate iterator has no .throw
      // method always terminates the yield* loop.
      context.delegate = null;

      if (context.method === "throw") {
        // Note: ["return"] must be used for ES3 parsing compatibility.
        if (delegate.iterator["return"]) {
          // If the delegate iterator has a return method, give it a
          // chance to clean up.
          context.method = "return";
          context.arg = undefined;
          maybeInvokeDelegate(delegate, context);

          if (context.method === "throw") {
            // If maybeInvokeDelegate(context) changed context.method from
            // "return" to "throw", let that override the TypeError below.
            return ContinueSentinel;
          }
        }

        context.method = "throw";
        context.arg = new TypeError(
          "The iterator does not provide a 'throw' method");
      }

      return ContinueSentinel;
    }

    var record = tryCatch(method, delegate.iterator, context.arg);

    if (record.type === "throw") {
      context.method = "throw";
      context.arg = record.arg;
      context.delegate = null;
      return ContinueSentinel;
    }

    var info = record.arg;

    if (! info) {
      context.method = "throw";
      context.arg = new TypeError("iterator result is not an object");
      context.delegate = null;
      return ContinueSentinel;
    }

    if (info.done) {
      // Assign the result of the finished delegate to the temporary
      // variable specified by delegate.resultName (see delegateYield).
      context[delegate.resultName] = info.value;

      // Resume execution at the desired location (see delegateYield).
      context.next = delegate.nextLoc;

      // If context.method was "throw" but the delegate handled the
      // exception, let the outer generator proceed normally. If
      // context.method was "next", forget context.arg since it has been
      // "consumed" by the delegate iterator. If context.method was
      // "return", allow the original .return call to continue in the
      // outer generator.
      if (context.method !== "return") {
        context.method = "next";
        context.arg = undefined;
      }

    } else {
      // Re-yield the result returned by the delegate method.
      return info;
    }

    // The delegate iterator is finished, so forget it and continue with
    // the outer generator.
    context.delegate = null;
    return ContinueSentinel;
  }

  // Define Generator.prototype.{next,throw,return} in terms of the
  // unified ._invoke helper method.
  defineIteratorMethods(Gp);

  define(Gp, toStringTagSymbol, "Generator");

  // A Generator should always return itself as the iterator object when the
  // @@iterator function is called on it. Some browsers' implementations of the
  // iterator prototype chain incorrectly implement this, causing the Generator
  // object to not be returned from this call. This ensures that doesn't happen.
  // See https://github.com/facebook/regenerator/issues/274 for more details.
  define(Gp, iteratorSymbol, function() {
    return this;
  });

  define(Gp, "toString", function() {
    return "[object Generator]";
  });

  function pushTryEntry(locs) {
    var entry = { tryLoc: locs[0] };

    if (1 in locs) {
      entry.catchLoc = locs[1];
    }

    if (2 in locs) {
      entry.finallyLoc = locs[2];
      entry.afterLoc = locs[3];
    }

    this.tryEntries.push(entry);
  }

  function resetTryEntry(entry) {
    var record = entry.completion || {};
    record.type = "normal";
    delete record.arg;
    entry.completion = record;
  }

  function Context(tryLocsList) {
    // The root entry object (effectively a try statement without a catch
    // or a finally block) gives us a place to store values thrown from
    // locations where there is no enclosing try statement.
    this.tryEntries = [{ tryLoc: "root" }];
    tryLocsList.forEach(pushTryEntry, this);
    this.reset(true);
  }

  exports.keys = function(object) {
    var keys = [];
    for (var key in object) {
      keys.push(key);
    }
    keys.reverse();

    // Rather than returning an object with a next method, we keep
    // things simple and return the next function itself.
    return function next() {
      while (keys.length) {
        var key = keys.pop();
        if (key in object) {
          next.value = key;
          next.done = false;
          return next;
        }
      }

      // To avoid creating an additional object, we just hang the .value
      // and .done properties off the next function object itself. This
      // also ensures that the minifier will not anonymize the function.
      next.done = true;
      return next;
    };
  };

  function values(iterable) {
    if (iterable) {
      var iteratorMethod = iterable[iteratorSymbol];
      if (iteratorMethod) {
        return iteratorMethod.call(iterable);
      }

      if (typeof iterable.next === "function") {
        return iterable;
      }

      if (!isNaN(iterable.length)) {
        var i = -1, next = function next() {
          while (++i < iterable.length) {
            if (hasOwn.call(iterable, i)) {
              next.value = iterable[i];
              next.done = false;
              return next;
            }
          }

          next.value = undefined;
          next.done = true;

          return next;
        };

        return next.next = next;
      }
    }

    // Return an iterator with no values.
    return { next: doneResult };
  }
  exports.values = values;

  function doneResult() {
    return { value: undefined, done: true };
  }

  Context.prototype = {
    constructor: Context,

    reset: function(skipTempReset) {
      this.prev = 0;
      this.next = 0;
      // Resetting context._sent for legacy support of Babel's
      // function.sent implementation.
      this.sent = this._sent = undefined;
      this.done = false;
      this.delegate = null;

      this.method = "next";
      this.arg = undefined;

      this.tryEntries.forEach(resetTryEntry);

      if (!skipTempReset) {
        for (var name in this) {
          // Not sure about the optimal order of these conditions:
          if (name.charAt(0) === "t" &&
              hasOwn.call(this, name) &&
              !isNaN(+name.slice(1))) {
            this[name] = undefined;
          }
        }
      }
    },

    stop: function() {
      this.done = true;

      var rootEntry = this.tryEntries[0];
      var rootRecord = rootEntry.completion;
      if (rootRecord.type === "throw") {
        throw rootRecord.arg;
      }

      return this.rval;
    },

    dispatchException: function(exception) {
      if (this.done) {
        throw exception;
      }

      var context = this;
      function handle(loc, caught) {
        record.type = "throw";
        record.arg = exception;
        context.next = loc;

        if (caught) {
          // If the dispatched exception was caught by a catch block,
          // then let that catch block handle the exception normally.
          context.method = "next";
          context.arg = undefined;
        }

        return !! caught;
      }

      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        var record = entry.completion;

        if (entry.tryLoc === "root") {
          // Exception thrown outside of any try block that could handle
          // it, so set the completion value of the entire function to
          // throw the exception.
          return handle("end");
        }

        if (entry.tryLoc <= this.prev) {
          var hasCatch = hasOwn.call(entry, "catchLoc");
          var hasFinally = hasOwn.call(entry, "finallyLoc");

          if (hasCatch && hasFinally) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            } else if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else if (hasCatch) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            }

          } else if (hasFinally) {
            if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else {
            throw new Error("try statement without catch or finally");
          }
        }
      }
    },

    abrupt: function(type, arg) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc <= this.prev &&
            hasOwn.call(entry, "finallyLoc") &&
            this.prev < entry.finallyLoc) {
          var finallyEntry = entry;
          break;
        }
      }

      if (finallyEntry &&
          (type === "break" ||
           type === "continue") &&
          finallyEntry.tryLoc <= arg &&
          arg <= finallyEntry.finallyLoc) {
        // Ignore the finally entry if control is not jumping to a
        // location outside the try/catch block.
        finallyEntry = null;
      }

      var record = finallyEntry ? finallyEntry.completion : {};
      record.type = type;
      record.arg = arg;

      if (finallyEntry) {
        this.method = "next";
        this.next = finallyEntry.finallyLoc;
        return ContinueSentinel;
      }

      return this.complete(record);
    },

    complete: function(record, afterLoc) {
      if (record.type === "throw") {
        throw record.arg;
      }

      if (record.type === "break" ||
          record.type === "continue") {
        this.next = record.arg;
      } else if (record.type === "return") {
        this.rval = this.arg = record.arg;
        this.method = "return";
        this.next = "end";
      } else if (record.type === "normal" && afterLoc) {
        this.next = afterLoc;
      }

      return ContinueSentinel;
    },

    finish: function(finallyLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.finallyLoc === finallyLoc) {
          this.complete(entry.completion, entry.afterLoc);
          resetTryEntry(entry);
          return ContinueSentinel;
        }
      }
    },

    "catch": function(tryLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc === tryLoc) {
          var record = entry.completion;
          if (record.type === "throw") {
            var thrown = record.arg;
            resetTryEntry(entry);
          }
          return thrown;
        }
      }

      // The context.catch method must only be called with a location
      // argument that corresponds to a known catch block.
      throw new Error("illegal catch attempt");
    },

    delegateYield: function(iterable, resultName, nextLoc) {
      this.delegate = {
        iterator: values(iterable),
        resultName: resultName,
        nextLoc: nextLoc
      };

      if (this.method === "next") {
        // Deliberately forget the last sent value so that we don't
        // accidentally pass it on to the delegate.
        this.arg = undefined;
      }

      return ContinueSentinel;
    }
  };

  // Regardless of whether this script is executing as a CommonJS module
  // or not, return the runtime object so that we can declare the variable
  // regeneratorRuntime in the outer scope, which allows this module to be
  // injected easily by `bin/regenerator --include-runtime script.js`.
  return exports;

}(
  // If this script is executing as a CommonJS module, use module.exports
  // as the regeneratorRuntime namespace. Otherwise create a new empty
  // object. Either way, the resulting object will be used to initialize
  // the regeneratorRuntime variable at the top of this file.
   true ? module.exports : 0
));

try {
  regeneratorRuntime = runtime;
} catch (accidentalStrictMode) {
  // This module should not be running in strict mode, so the above
  // assignment should always work unless something is misconfigured. Just
  // in case runtime.js accidentally runs in strict mode, in modern engines
  // we can explicitly access globalThis. In older engines we can escape
  // strict mode using a global Function call. This could conceivably fail
  // if a Content Security Policy forbids using Function, but in that case
  // the proper solution is to fix the accidental strict mode problem. If
  // you've misconfigured your bundler to force strict mode and applied a
  // CSP to forbid Function, and you're not willing to fix either of those
  // problems, please detail your unique predicament in a GitHub issue.
  if (typeof globalThis === "object") {
    globalThis.regeneratorRuntime = runtime;
  } else {
    Function("r", "regeneratorRuntime = r")(runtime);
  }
}


/***/ }),

/***/ 3465:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

(function (global, factory) {
	 true ? module.exports = factory() :
	0;
}(this, (function () { 'use strict';

var SpriteSymbol = function SpriteSymbol(ref) {
  var id = ref.id;
  var viewBox = ref.viewBox;
  var content = ref.content;

  this.id = id;
  this.viewBox = viewBox;
  this.content = content;
};

/**
 * @return {string}
 */
SpriteSymbol.prototype.stringify = function stringify () {
  return this.content;
};

/**
 * @return {string}
 */
SpriteSymbol.prototype.toString = function toString () {
  return this.stringify();
};

SpriteSymbol.prototype.destroy = function destroy () {
    var this$1 = this;

  ['id', 'viewBox', 'content'].forEach(function (prop) { return delete this$1[prop]; });
};

/**
 * @param {string} content
 * @return {Element}
 */
var parse = function (content) {
  var hasImportNode = !!document.importNode;
  var doc = new DOMParser().parseFromString(content, 'image/svg+xml').documentElement;

  /**
   * Fix for browser which are throwing WrongDocumentError
   * if you insert an element which is not part of the document
   * @see http://stackoverflow.com/a/7986519/4624403
   */
  if (hasImportNode) {
    return document.importNode(doc, true);
  }

  return doc;
};

var commonjsGlobal = typeof window !== 'undefined' ? window : typeof __webpack_require__.g !== 'undefined' ? __webpack_require__.g : typeof self !== 'undefined' ? self : {};





function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var deepmerge = createCommonjsModule(function (module, exports) {
(function (root, factory) {
    if (false) {} else {
        module.exports = factory();
    }
}(commonjsGlobal, function () {

function isMergeableObject(val) {
    var nonNullObject = val && typeof val === 'object';

    return nonNullObject
        && Object.prototype.toString.call(val) !== '[object RegExp]'
        && Object.prototype.toString.call(val) !== '[object Date]'
}

function emptyTarget(val) {
    return Array.isArray(val) ? [] : {}
}

function cloneIfNecessary(value, optionsArgument) {
    var clone = optionsArgument && optionsArgument.clone === true;
    return (clone && isMergeableObject(value)) ? deepmerge(emptyTarget(value), value, optionsArgument) : value
}

function defaultArrayMerge(target, source, optionsArgument) {
    var destination = target.slice();
    source.forEach(function(e, i) {
        if (typeof destination[i] === 'undefined') {
            destination[i] = cloneIfNecessary(e, optionsArgument);
        } else if (isMergeableObject(e)) {
            destination[i] = deepmerge(target[i], e, optionsArgument);
        } else if (target.indexOf(e) === -1) {
            destination.push(cloneIfNecessary(e, optionsArgument));
        }
    });
    return destination
}

function mergeObject(target, source, optionsArgument) {
    var destination = {};
    if (isMergeableObject(target)) {
        Object.keys(target).forEach(function (key) {
            destination[key] = cloneIfNecessary(target[key], optionsArgument);
        });
    }
    Object.keys(source).forEach(function (key) {
        if (!isMergeableObject(source[key]) || !target[key]) {
            destination[key] = cloneIfNecessary(source[key], optionsArgument);
        } else {
            destination[key] = deepmerge(target[key], source[key], optionsArgument);
        }
    });
    return destination
}

function deepmerge(target, source, optionsArgument) {
    var array = Array.isArray(source);
    var options = optionsArgument || { arrayMerge: defaultArrayMerge };
    var arrayMerge = options.arrayMerge || defaultArrayMerge;

    if (array) {
        return Array.isArray(target) ? arrayMerge(target, source, optionsArgument) : cloneIfNecessary(source, optionsArgument)
    } else {
        return mergeObject(target, source, optionsArgument)
    }
}

deepmerge.all = function deepmergeAll(array, optionsArgument) {
    if (!Array.isArray(array) || array.length < 2) {
        throw new Error('first argument should be an array with at least two elements')
    }

    // we are sure there are at least 2 values, so it is safe to have no initial value
    return array.reduce(function(prev, next) {
        return deepmerge(prev, next, optionsArgument)
    })
};

return deepmerge

}));
});

var namespaces_1 = createCommonjsModule(function (module, exports) {
var namespaces = {
  svg: {
    name: 'xmlns',
    uri: 'http://www.w3.org/2000/svg'
  },
  xlink: {
    name: 'xmlns:xlink',
    uri: 'http://www.w3.org/1999/xlink'
  }
};

exports.default = namespaces;
module.exports = exports.default;
});

/**
 * @param {Object} attrs
 * @return {string}
 */
var objectToAttrsString = function (attrs) {
  return Object.keys(attrs).map(function (attr) {
    var value = attrs[attr].toString().replace(/"/g, '&quot;');
    return (attr + "=\"" + value + "\"");
  }).join(' ');
};

var svg = namespaces_1.svg;
var xlink = namespaces_1.xlink;

var defaultAttrs = {};
defaultAttrs[svg.name] = svg.uri;
defaultAttrs[xlink.name] = xlink.uri;

/**
 * @param {string} [content]
 * @param {Object} [attributes]
 * @return {string}
 */
var wrapInSvgString = function (content, attributes) {
  if ( content === void 0 ) content = '';

  var attrs = deepmerge(defaultAttrs, attributes || {});
  var attrsRendered = objectToAttrsString(attrs);
  return ("<svg " + attrsRendered + ">" + content + "</svg>");
};

var BrowserSpriteSymbol = (function (SpriteSymbol$$1) {
  function BrowserSpriteSymbol () {
    SpriteSymbol$$1.apply(this, arguments);
  }

  if ( SpriteSymbol$$1 ) BrowserSpriteSymbol.__proto__ = SpriteSymbol$$1;
  BrowserSpriteSymbol.prototype = Object.create( SpriteSymbol$$1 && SpriteSymbol$$1.prototype );
  BrowserSpriteSymbol.prototype.constructor = BrowserSpriteSymbol;

  var prototypeAccessors = { isMounted: {} };

  prototypeAccessors.isMounted.get = function () {
    return !!this.node;
  };

  /**
   * @param {Element} node
   * @return {BrowserSpriteSymbol}
   */
  BrowserSpriteSymbol.createFromExistingNode = function createFromExistingNode (node) {
    return new BrowserSpriteSymbol({
      id: node.getAttribute('id'),
      viewBox: node.getAttribute('viewBox'),
      content: node.outerHTML
    });
  };

  BrowserSpriteSymbol.prototype.destroy = function destroy () {
    if (this.isMounted) {
      this.unmount();
    }
    SpriteSymbol$$1.prototype.destroy.call(this);
  };

  /**
   * @param {Element|string} target
   * @return {Element}
   */
  BrowserSpriteSymbol.prototype.mount = function mount (target) {
    if (this.isMounted) {
      return this.node;
    }

    var mountTarget = typeof target === 'string' ? document.querySelector(target) : target;
    var node = this.render();
    this.node = node;

    mountTarget.appendChild(node);

    return node;
  };

  /**
   * @return {Element}
   */
  BrowserSpriteSymbol.prototype.render = function render () {
    var content = this.stringify();
    return parse(wrapInSvgString(content)).childNodes[0];
  };

  BrowserSpriteSymbol.prototype.unmount = function unmount () {
    this.node.parentNode.removeChild(this.node);
  };

  Object.defineProperties( BrowserSpriteSymbol.prototype, prototypeAccessors );

  return BrowserSpriteSymbol;
}(SpriteSymbol));

return BrowserSpriteSymbol;

})));


/***/ }),

/***/ 3998:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3465);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2594);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__);


var symbol = new (_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default())({
  "id": "arrow_nav",
  "use": "arrow_nav-usage",
  "viewBox": "0 0 8 10",
  "content": "<symbol xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 8 10\" id=\"arrow_nav\"><path style=\"fill:#fff\" d=\"M0 0v10l8-5z\" /></symbol>"
});
var result = _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default().add(symbol);
/* harmony default export */ __webpack_exports__["default"] = (symbol);

/***/ }),

/***/ 7963:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3465);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2594);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__);


var symbol = new (_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default())({
  "id": "chevron",
  "use": "chevron-usage",
  "viewBox": "0 0 40 72",
  "content": "<symbol xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 72\" id=\"chevron\"><path d=\"M1.75.57.58 1.71c-.77.76-.77 1.98 0 2.74L32.88 36 .58 67.55c-.77.76-.77 1.98 0 2.74l1.17 1.14c.77.76 2.03.76 2.8 0l34.87-34.06c.77-.76.77-1.98 0-2.74L4.55.57c-.77-.76-2.03-.76-2.8 0z\" /></symbol>"
});
var result = _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default().add(symbol);
/* harmony default export */ __webpack_exports__["default"] = (symbol);

/***/ }),

/***/ 4420:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3465);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2594);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__);


var symbol = new (_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default())({
  "id": "fb",
  "use": "fb-usage",
  "viewBox": "0 0 72 72",
  "content": "<symbol xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 72 72\" id=\"fb\"><path d=\"M36 72C16.12 72 0 55.88 0 36S16.12 0 36 0s36 16.12 36 36c0 9.55-3.79 18.7-10.54 25.45A35.747 35.747 0 0 1 36 72zm-4.64-33.84v16.08c2.11.37 4.27.37 6.38 0V38.16h4.76l.9-6.66h-5.66v-4.32a3.16 3.16 0 0 1 2.69-3.57c.21-.03.42-.04.64-.03h2.58v-5.65c-1.51-.27-3.04-.42-4.57-.45-4.83 0-7.71 3.35-7.71 8.95v5.07h-5.19v6.66h5.18z\" /></symbol>"
});
var result = _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default().add(symbol);
/* harmony default export */ __webpack_exports__["default"] = (symbol);

/***/ }),

/***/ 2001:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3465);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2594);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__);


var symbol = new (_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default())({
  "id": "ig",
  "use": "ig-usage",
  "viewBox": "0 0 72 72",
  "content": "<symbol xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 72 72\" id=\"ig\"><path d=\"M0 36C0 16.12 16.12 0 36 0s36 16.12 36 36-16.12 36-36 36S0 55.88 0 36zm14.9-8.48v16.85c.01 7 5.68 12.67 12.68 12.68h16.85c7-.01 12.67-5.68 12.68-12.68V27.52c-.01-7-5.68-12.67-12.68-12.68H27.57c-7 .01-12.67 5.68-12.67 12.68zm12.67 25.56c-4.81 0-8.7-3.9-8.71-8.71V27.52c0-4.81 3.9-8.7 8.71-8.71h16.85c4.81 0 8.7 3.9 8.71 8.71v16.85c-.01 4.81-3.9 8.7-8.71 8.71H27.57zm-1.8-17.13c0 5.74 4.65 10.4 10.39 10.4s10.4-4.65 10.4-10.39-4.65-10.4-10.39-10.4c-5.74.01-10.38 4.65-10.4 10.39zm18.92-11.09c0 1.37 1.11 2.47 2.48 2.47 1.37 0 2.47-1.11 2.47-2.48 0-1.37-1.11-2.47-2.48-2.47-1.36 0-2.46 1.11-2.47 2.48zM29.52 35.94c0-3.68 2.98-6.66 6.66-6.66s6.66 2.98 6.66 6.66-2.98 6.66-6.66 6.66c-3.67 0-6.65-2.99-6.66-6.66z\" /></symbol>"
});
var result = _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default().add(symbol);
/* harmony default export */ __webpack_exports__["default"] = (symbol);

/***/ }),

/***/ 7625:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3465);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2594);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__);


var symbol = new (_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default())({
  "id": "logo",
  "use": "logo-usage",
  "viewBox": "0 0 388 90",
  "content": "<symbol xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 388 90\" id=\"logo\"><path d=\"M125.6 31.7c1.28 5.13 5.37 10.13 14.65 13.1l-.03.41c-1.99.37-3.17 1.45-3.48 3.68-7.73-3.88-10.5-10.6-11.58-16.27-1.22 7.19-4.9 12.56-16.58 16.27l-.27-.51c9.22-4.46 11.91-9.89 12.73-16.68h-11.55l-.27-.98h11.92c.23-2.74.23-5.64.23-8.84h-9.93l-.27-.98h20.09l2.33-2.94s2.63 1.99 4.25 3.38c-.1.37-.51.54-.98.54h-11c-.07 3.21-.14 6.14-.41 8.84h7.8l2.36-2.97s2.67 1.99 4.26 3.41c-.1.37-.47.54-.98.54H125.6zM176.83 43.24s2.7 2.06 4.39 3.48c-.1.37-.47.54-.98.54h-30.39l-.27-.95h13.54V36.12h-9.59l-.27-.98h9.86V26.5h-11.01l-.27-.95h21.34l2.36-2.97s2.63 1.99 4.26 3.37c-.1.37-.47.54-.98.54h-11.34v8.64h4.59l2.3-2.87s2.57 1.92 4.12 3.31c-.07.37-.47.54-.91.54h-10.09V46.3h6.95l2.39-3.06zm-17.05-25.86c11.82.68 9.49 9.19 5.13 6.92-.94-2.43-3.34-5.1-5.37-6.65l.24-.27zM220.19 25.76c-.57 5.2-1.86 9.79-4.42 13.64 1.89 2.37 4.32 4.29 7.33 5.71l-.1.34c-1.86.37-2.97 1.42-3.44 3.21-2.5-1.75-4.35-4.05-5.74-6.78-2.73 2.97-6.55 5.33-11.82 6.96l-.23-.34c5.06-2.63 8.44-5.97 10.63-9.86-.88-2.53-1.52-5.33-1.96-8.34-1.15 1.92-2.5 3.61-4.05 5.03l-.44-.27c.98-1.96 1.89-4.36 2.67-6.99-.1.04-.2.04-.34.04h-5.47c-1.05 1.21-2.16 2.4-3.38 3.51h2.47l1.79-1.86 3.31 2.87c-.27.27-.64.34-1.32.41-1.08.64-2.4 1.45-3.71 2.09l1.08.1c-.1.51-.4.74-1.11.84v1.38c2.03-.27 4.22-.57 6.38-.88l.07.47c-1.72.68-3.85 1.45-6.45 2.33v5.03c0 2.67-.57 4.08-4.9 4.49-.1-1.18-.27-2.06-.78-2.6-.54-.57-1.25-.98-2.87-1.25v-.47s3.48.21 4.15.21c.51 0 .68-.14.68-.54v-3.65c-1.42.47-2.97.95-4.63 1.45-.17.4-.54.71-.91.81l-1.65-4.08c1.52-.14 4.08-.41 7.19-.81v-3.17l1.99.17c.54-.74 1.08-1.62 1.52-2.36h-3.41c-2.26 1.92-4.8 3.68-7.67 5.06l-.34-.37c1.92-1.35 3.75-2.97 5.4-4.69h-3.24l-.3-.98h4.43a40.98 40.98 0 0 0 2.83-3.51h-8.51l-.27-.98h5.6v-4.35h-3.98l-.27-.98h4.25v-4.56l5 .4c-.07.51-.34.81-1.25.95v3.21h.1l1.59-2.16s.95.78 1.86 1.62c.64-1.25 1.15-2.47 1.59-3.61l4.42 2.13c-.2.37-.54.57-1.39.44-1.18 2.23-2.7 4.59-4.56 6.89h1.05l1.59-2.09s1.49 1.18 2.6 2.23c.84-3.14 1.52-6.55 1.82-9.93l5.44 1.28c-.1.44-.51.74-1.32.77a45.64 45.64 0 0 1-1.69 5.4h3.91l2.1-2.7s2.36 1.89 3.75 3.14c-.1.37-.44.54-.91.54h-1.76v.01zM200 27.1h.13c.98-1.45 1.86-2.9 2.67-4.35H200v4.35zm12.73-1.34c-.51 1.21-1.08 2.36-1.65 3.44.61 2.57 1.42 4.86 2.53 6.92 1.32-3.18 1.99-6.65 2.26-10.36h-3.14zM256.97 24.17v3h2.3l1.62-1.82 3.44 2.67c-.2.24-.64.51-1.25.61v15.94c0 2.57-.44 3.92-3.78 4.22-.03-1.08-.07-2.03-.3-2.53-.24-.57-.61-.95-1.42-1.12v-.47s1.18.07 1.59.07c.37 0 .44-.17.44-.54v-4.73h-2.63v7.76c0 .44-1.45 1.25-2.73 1.25h-.68v-9.01h-2.36v8.17c0 .37-1.32 1.15-2.77 1.15h-.54v-7.06h-6.02v6.18c0 .2-1.11.98-2.9.98h-.64v-7.16h-5.53l-.27-.94h5.8v-4.05h-1.45v.81c0 .3-1.38 1.05-2.73 1.05h-.5V24.57l3.41 1.38h1.28v-3.07h-5.5l-.27-.95h5.77V17.2l4.66.41c-.04.44-.31.74-1.12.88v3.44h.81l1.93-2.53s2.19 1.72 3.54 2.94c-.1.37-.44.54-.91.54h-5.37v3.07h1.28l1.45-1.52 3.07 2.3c-.17.24-.57.47-1.12.57v9.59c-.03.27-1.55 1.01-2.6 1.01h-.54v-1.18h-1.55v4.05h1.32l1.92-2.5s1.49 1.18 2.77 2.26V25.65l3.48 1.52h2.19v-3h-6.15l-.27-.95h6.42v-5.77l4.76.47c-.1.51-.37.91-1.35 1.05v4.25h2.19l1.28-1.72c-.14-1.18-.98-2.57-1.79-3.34l.3-.21c5.2.24 5.03 3.14 3.48 3.85.71.57 1.52 1.25 2.12 1.82-.1.37-.44.54-.91.54h-6.67v.01zm-20.09 2.77v4.02h1.62v-4.02h-1.62zm0 8.81h1.62V31.9h-1.62v3.85zm4.83-8.81v4.02h1.72v-4.02h-1.72zm1.72 8.81V31.9h-1.72v3.85h1.72zm7.77-7.63v4.56h2.36v-4.56h-2.36zm2.36 10.36v-4.86h-2.36v4.86h2.36zm3.41-10.36v4.56h2.63v-4.56h-2.63zm2.63 10.36v-4.86h-2.63v4.86h2.63zM286.35 18.93c-.14.44-.57.74-1.35.71-1.05 2.6-2.23 4.97-3.58 7.06l1.55.57c-.1.3-.41.51-1.05.64V47.7c-.07.3-1.69 1.15-3.24 1.15h-.78V31.26c-1.32 1.42-2.73 2.7-4.22 3.78l-.37-.27c2.94-4.19 5.87-10.94 7.36-17.62l5.68 1.78zm15 22.35s2.63 2.13 4.22 3.61c-.1.37-.47.54-1.01.54h-21.13l-.3-1.08h15.9l2.32-3.07zM284.77 24.2h12.86l2.26-3.04s2.57 2.12 4.15 3.61c-.1.34-.47.51-1.01.51h-17.96l-.3-1.08zM332.43 28.35c1.18 6.25 5.1 12.46 14.55 16.27l-.07.38c-2.06.37-3.28 1.62-3.65 3.92-7.87-4.79-10.4-13-11.31-19.75-1.01 8.04-4.39 14.92-16.64 19.75l-.3-.51c9.38-5.67 12.02-12.36 12.76-20.05h-12.19l-.27-.98h12.52c.23-3.17.2-6.55.2-10.06l5.67.54c-.1.5-.4.84-1.21.98-.07 2.94-.1 5.81-.34 8.54h7.59l2.5-3.07s2.73 2.06 4.42 3.51c-.1.37-.47.54-.98.54h-13.25v-.01zM360.9 30.99c.3 1.96-.27 3.51-1.79 4.19-2.57 1.08-4.29-2.16-1.45-3.65.95-.47 1.86-1.76 1.82-3.68l.41-.03c.37.78.64 1.52.84 2.23h.47l-.34-11.38 3.07.61c1.05-.75 2.1-1.59 2.67-2.13l2.7 2.06.1-.1c1.01.04 1.89.17 2.6.34.51-.68.91-1.39 1.22-2.03l3.1 1.59c-.14.3-.47.37-1.08.23-.31.41-.71.78-1.15 1.19 1.69 1.35.91 3.14-.68 2.6-.27-.37-.68-.81-1.11-1.22-1.12.74-2.36 1.42-3.54 1.89l-.07-.1c-.1.27-.41.37-.78.37h-3.44l.1 2.6h.77l1.25-1.65s1.42 1.18 2.3 2.09c-.1.37-.41.54-.84.54h-3.48l.1 2.5h14.52l.1-2.5h-2.77l-.27-.98h3.1l.1-2.6h-2.8l-.3-.94h3.17l.13-2.64h-3.34l-.27-.98h3.31l1.49-1.76 3.54 2.7c-.27.27-.54.41-1.18.47l-.44 8.88 1.72-1.69 3.51 3.38c-.27.27-.61.34-1.28.37-1.28.78-3.44 1.89-4.86 2.53l-.31-.24c.27-.77.68-2.06.98-3.07H360.9v.01zm22.42 5.87s2.36 1.96 3.75 3.27c-.1.37-.44.54-.95.54H374.1v3.51c0 2.77-.61 4.29-5.17 4.69-.1-1.25-.3-2.13-.84-2.77-.54-.61-1.32-1.05-3.11-1.32v-.47s3.82.24 4.56.24c.5 0 .68-.14.68-.57v-3.31h-12.93l-.27-.98h13.2V37l3.01.27c.84-.74 1.72-1.59 2.43-2.33h-12.05l-.3-.98h12.89l2.13-2.03 3.64 3.21c-.3.27-.64.37-1.38.41-1.49.57-3.44 1.32-5.37 1.89-.07.51-.4.74-1.11.84v1.42h7.09l2.12-2.84zm-16.81-15.39s1.15.88 1.99 1.69c.88-.68 1.75-1.55 2.53-2.47-.54-.4-1.11-.78-1.62-1.08-.2.07-.5.03-.84-.07-.94.31-2.53.64-4.19.88l.07 2.6h.84l1.22-1.55zm10.33 3.37c-.17.34-.54.41-1.08.27-.34.47-.81.91-1.32 1.39 1.72 1.55.81 3.51-.91 2.8-.24-.44-.57-.94-1.01-1.42-1.28.81-2.73 1.49-4.15 1.93l-.27-.51c1.12-.71 2.23-1.62 3.17-2.63-.68-.57-1.42-1.11-2.06-1.52l.34-.34c1.15.1 2.09.27 2.87.54.54-.64.94-1.35 1.28-1.99l3.14 1.48z\" /><g><path d=\"M49.12 5.43V3.26c-1-.1-2.08-.17-3.32-.21h-.08V.59h-2.43v2.46h-.08c-1.24.04-2.33.1-3.33.21v2.17c.99-.11 2.08-.17 3.33-.21l.08-.01v7.01h2.43v-7l.08.01c1.25.03 2.33.1 3.32.2z\" /><path style=\"fill-rule:evenodd;clip-rule:evenodd\" d=\"M22.14 10.49c.08.02.16.02.23.02 2.21-.35 5.64-2.63 7.03-4.41.02-.03.05-.07.06-.12a.284.284 0 0 0-.22-.35c-3.02 0-6.6 1.88-7.62 3.8-.02.05-.04.09-.06.14-.09.41.17.82.58.92zM8.51 23.64c.09 0 .18-.01.26-.04.01 0 .02-.01.02-.01.09-.03.17-.09.24-.15 2.05-2.71 2.71-5.93 2.91-9.14a.306.306 0 0 0-.3-.29c-.01 0-.03 0-.05.01-.07.01-.12.04-.17.08-.39.42-.83.88-1.16 1.28-1.58 1.94-2.64 4.08-2.64 6.64 0 .36.04.72.13 1.07.11.32.4.55.76.55zM2.78 44.19c.13.08.27.14.43.14.1 0 .19-.01.27-.05.01 0 .02-.01.02-.01.14-.05.26-.15.35-.26.08-.11.13-.23.15-.37.35-2.91-1.15-8.73-2.78-10.36a.304.304 0 0 0-.21-.08H.96c-.07.01-.13.04-.17.09-.02.03-.04.06-.06.1-.73 3.05-.73 6.05.6 8.96.35.73.83 1.35 1.45 1.84zM17.64 19.69l.03-.1v-.01c0-.16-.11-.28-.26-.31-3.18-.06-6.68 2.48-7.53 4.81-.02.07-.04.15-.04.23 0 .07.01.14.03.21.09.35.41.6.78.6.06 0 .12-.01.17-.03 2.29-.62 5.69-3.24 6.82-5.4zM14.27 15.02c.08.03.17.04.25.04h.03c.09-.01.18-.04.26-.07 2.63-1.85 4.16-4.56 5.28-7.4.04-.15-.04-.3-.18-.34-.02-.01-.03-.01-.05-.01-.06-.01-.12 0-.18.03-.47.26-1.01.55-1.42.82-1.99 1.29-3.57 2.92-4.3 5.22-.1.32-.17.65-.19 1-.02.31.18.61.5.71zM23.5 12.58c.01-.02.03-.06.03-.09v-.01a.296.296 0 0 0-.21-.31c-3-.32-6.52 1.77-7.52 3.89-.02.07-.05.14-.05.21-.01.07 0 .14.01.2.06.33.33.6.68.63.05 0 .11-.01.17-.01 2.21-.4 5.64-2.58 6.89-4.51zM6.99 34.78c.09 0 .17-.02.25-.05 2.3-1.07 4.79-4.59 5.71-7.07.01-.02.01-.04.01-.07v-.02c0-.02 0-.05-.01-.07a.312.312 0 0 0-.27-.21c-2.59.07-6.08 3.77-6.52 6.66v.08c0 .07.02.13.04.2.02.06.05.12.08.17.13.23.4.39.71.38zM3.78 33.19a.8.8 0 0 0 .69.33c.1 0 .19-.02.27-.06.01 0 .02-.01.03-.01.14-.06.26-.17.34-.29.02-.02.03-.04.04-.07 1.15-2.42 1.45-7.27.53-10a.324.324 0 0 0-.32-.23c-.01 0-.03 0-.05.01a.27.27 0 0 0-.17.1c-.01.03-.02.04-.03.05-.3.52-.57.98-.81 1.46-1.1 2.3-1.66 4.69-1.1 7.24.12.53.31 1.02.58 1.47zM5.25 44.02c.05.15.13.28.25.38.14.11.32.19.51.19.1 0 .19-.02.27-.05.01 0 .02-.01.03-.01.08-.03.14-.07.21-.13 2.06-1.69 3.69-6.1 3.89-8.44 0-.08-.03-.15-.09-.21a.31.31 0 0 0-.22-.09c-2.87.87-5.4 5.37-4.85 8.36zM3.33 54.3c.26.27.57.49.9.67a.957.957 0 0 0 .69.03.87.87 0 0 0 .37-.25c.05-.05.09-.11.12-.17.03-.07.06-.13.08-.2s.03-.15.03-.24c-.3-3.12-2.97-7.72-4.92-9.59a.338.338 0 0 0-.19-.09H.34c-.02 0-.04.01-.06.01-.11.02-.19.09-.24.19-.02.02-.03.06-.04.08-.09 2.6.4 5 1.56 7.25.44.85 1.11 1.61 1.77 2.31zM23.83 79.32c.12-.06.24-.14.33-.24.05-.06.1-.12.14-.19.08-.15.13-.32.13-.5 0-.28-.11-.53-.29-.7a.689.689 0 0 0-.13-.11c-2.76-1.91-7.96-3.02-10.85-2.74-.11.03-.2.09-.26.18-.02.04-.04.09-.06.14-.01.04-.01.09-.01.14.01.04.01.08.03.12.01.03.02.05.04.07.01.02.03.04.05.06 1.63 1.58 3.52 2.74 5.65 3.52 1.37.5 2.79.77 4.25.52.33-.07.66-.15.98-.27zM8.87 64.71c.09-.01.18-.02.26-.05a.87.87 0 0 0 .37-.25c.04-.05.09-.11.12-.17.04-.07.06-.13.08-.2.02-.08.03-.16.03-.24v-.09a.727.727 0 0 0-.06-.21c-1.7-3.43-4.5-5.66-7.68-7.6a.21.21 0 0 0-.11-.04h-.07c-.02 0-.04.01-.06.01-.11.03-.19.09-.24.18l-.03.09c0 .01-.01.03-.01.04v.07c.86 3.09 2.43 5.74 5.11 7.62.69.46 1.44.74 2.29.84zM7.06 54.5c.06.06.11.12.18.17l.09.06c.13.07.28.11.44.11.11 0 .21-.02.31-.05.14-.05.27-.14.37-.25.01 0 .01-.01.01-.02 1.57-2.11 2.07-6.71 1.7-9.43 0-.06-.02-.11-.05-.16-.02-.03-.04-.06-.07-.07a.346.346 0 0 0-.21-.1h-.07c-.02 0-.04.01-.06.01-.04.01-.07.03-.1.06-2.96 2.49-3.7 7.11-2.64 9.53.03.03.06.09.1.14zM14.98 72.49c.05-.01.1-.02.15-.04a.87.87 0 0 0 .37-.25c.05-.05.09-.11.12-.17.03-.06.06-.13.08-.2.02-.08.03-.16.03-.25 0-.03 0-.06-.01-.09-.01-.1-.04-.21-.08-.3a.864.864 0 0 0-.1-.16c-2.14-2.37-7.03-4.97-9.73-5.12h-.04c-.02 0-.04.01-.06.01-.11.03-.19.1-.24.19l-.03.09c0 .01-.01.03-.01.05v.07c.01.03.01.06.02.08 0 .02.01.04.03.06 1.44 2.67 5.41 6.02 8.54 6.09.31 0 .63-.02.96-.06zM11.08 63.8c.03.05.05.09.09.13.05.06.11.12.18.17.03.02.06.04.1.06.09.05.19.08.3.1.05.01.09.01.14.01.11 0 .21-.02.31-.05.14-.06.27-.14.37-.25.05-.05.09-.11.13-.17.01-.02.01-.04.02-.06.2-.5.37-1.01.46-1.52.38-2.06.13-4.11-.29-6.15-.1-.47-.22-.94-.36-1.47a.3.3 0 0 0-.04-.1.27.27 0 0 0-.07-.08c-.02-.02-.04-.03-.06-.05a.246.246 0 0 0-.15-.05h-.07c-.02 0-.04.01-.06.01-.08.02-.14.07-.2.13-.02.03-.04.05-.06.08-1.54 2.15-2.15 4.54-1.6 7.12.14.73.48 1.45.86 2.14zM17.59 71.6c.02.02.04.03.06.04.09.05.19.08.3.1.04.01.09.01.14.01h.1c.07-.01.14-.03.21-.05.14-.05.27-.14.37-.25.05-.05.09-.11.13-.17.03-.05.04-.11.06-.16.52-2.52-.83-6.73-2.4-9.2a.265.265 0 0 0-.05-.06.265.265 0 0 1-.06-.05.442.442 0 0 0-.15-.05h-.08c-.02 0-.04.01-.06.01-.09.02-.16.08-.21.16-1.55 2.76-1 7.36 1.64 9.67zM25.33 77.23c.14.07.29.11.46.11h.07c.09 0 .19-.03.27-.06.16-.06.3-.15.41-.28.05-.06.1-.13.14-.19.08-.15.13-.32.13-.5-.31-3.35-2.28-5.91-4.37-8.48a.689.689 0 0 0-.13-.11c-.05-.02-.1-.04-.15-.05h-.09c-.02 0-.05 0-.07.01-.11.02-.2.09-.26.18-.02.04-.04.07-.05.11-.91 3.02 1.06 7.72 3.64 9.26zM33.76 81.79a.899.899 0 0 0-.24-.12c-3.16-1.08-8.4-.77-11.13.27-.08.04-.15.08-.19.15a.35.35 0 0 0-.06.14c0 .01-.01.03-.01.05v.09c0 .04.01.08.02.12.01.03.02.05.03.08.02.03.04.06.07.08.02.02.05.04.07.05 1.99 1.09 4.12 1.7 6.38 1.87 1.47.11 2.9 0 4.24-.64.31-.14.6-.32.87-.51.04-.03.08-.06.11-.1.05-.06.1-.13.14-.19a.95.95 0 0 0 .12-.5c0-.27-.11-.52-.29-.71a.404.404 0 0 0-.13-.13z\" /><path style=\"fill-rule:evenodd;clip-rule:evenodd\" d=\"M54.09 81.28c3.13-.27 6.58-5.34 6.09-8.86v-.02a.424.424 0 0 0-.32-.32c-.02-.01-.05-.01-.07-.01h-.09c-.05.01-.1.02-.15.05-.03.01-.05.03-.08.05-2.63 2.37-5.13 4.73-5.8 8.36-2 .52-5.58 1.51-9.14 2.79-3.55-1.28-7.14-2.27-9.13-2.79-.66-3.63-3.16-6-5.8-8.36a.218.218 0 0 0-.08-.05c-.05-.02-.1-.04-.15-.05h-.09c-.02 0-.05 0-.07.01-.11.03-.2.09-.26.18a.35.35 0 0 0-.06.14v.02c-.5 3.52 2.95 8.58 6.09 8.86 2.17.45 5.07 1.44 7.93 2.66-3.11 1.22-5.98 2.64-7.49 4.15l1.13 1.32c1.39-1.38 4.54-3.18 7.99-4.75 3.45 1.57 6.6 3.37 7.99 4.75l1.12-1.32c-1.51-1.51-4.38-2.93-7.49-4.15 2.86-1.22 5.76-2.21 7.93-2.66zM59.67 6.1c1.38 1.78 4.82 4.06 7.03 4.41.08 0 .16 0 .23-.02.41-.1.67-.51.57-.92-.01-.05-.04-.09-.06-.14-1.02-1.93-4.6-3.8-7.62-3.8-.16.04-.25.19-.22.35.03.04.05.08.07.12zM80.28 23.58c.01.01.01.01.02.01.08.03.17.04.26.04.35 0 .65-.23.75-.55.09-.35.13-.71.13-1.07 0-2.56-1.06-4.71-2.64-6.64-.32-.4-.77-.87-1.16-1.28a.337.337 0 0 0-.17-.08c-.01-.01-.02-.01-.04-.01-.16 0-.29.13-.3.29.2 3.22.86 6.44 2.91 9.14.07.06.15.12.24.15zM85.07 43.64c.02.14.07.26.15.37.09.12.21.21.35.26.01 0 .01.01.02.01.09.03.17.05.27.05.16 0 .31-.06.44-.14.61-.5 1.1-1.11 1.43-1.84 1.33-2.91 1.33-5.91.61-8.96a.207.207 0 0 0-.06-.1.284.284 0 0 0-.17-.09h-.05c-.08 0-.15.03-.21.08-1.64 1.63-3.13 7.45-2.78 10.36zM78.42 25.11c.37 0 .69-.25.78-.6.02-.07.03-.14.03-.21a.62.62 0 0 0-.04-.23c-.85-2.33-4.35-4.87-7.53-4.81-.14.03-.25.15-.25.31v.01c0 .03.01.07.03.1 1.13 2.15 4.53 4.78 6.81 5.39.05.03.11.04.17.04zM74.27 14.98c.08.04.17.07.26.07h.03c.08 0 .16-.01.25-.04.32-.1.52-.4.51-.72-.02-.35-.09-.68-.19-1-.74-2.31-2.32-3.94-4.31-5.22-.41-.27-.95-.56-1.42-.82-.05-.03-.11-.04-.18-.03-.01 0-.03.01-.05.01a.29.29 0 0 0-.18.35c1.12 2.85 2.64 5.56 5.28 7.4zM72.63 17.09c.35-.04.62-.3.68-.63.01-.07.02-.13.01-.2a.83.83 0 0 0-.06-.21c-1-2.11-4.52-4.21-7.52-3.89-.13.04-.23.16-.21.31v.01l.03.09c1.25 1.94 4.69 4.12 6.89 4.5.06.01.12.02.18.02zM76.12 27.49c-.01.02-.01.05-.01.07v.02c0 .03.01.05.01.07.92 2.49 3.41 6.01 5.71 7.07.08.03.15.05.25.05.3.01.57-.15.72-.39.03-.06.06-.11.08-.17.02-.07.03-.14.03-.2 0-.03 0-.06-.01-.08-.44-2.89-3.92-6.59-6.51-6.66-.12.01-.23.09-.27.22zM83.96 33.17c.08.12.21.22.34.29.01 0 .02 0 .03.01.08.03.18.05.27.06a.8.8 0 0 0 .69-.33c.27-.45.46-.94.58-1.47.56-2.55 0-4.94-1.1-7.24-.24-.48-.51-.94-.81-1.46-.01-.01-.02-.03-.03-.04a.277.277 0 0 0-.17-.1c-.01-.01-.04-.01-.05-.01-.15 0-.27.09-.32.23-.92 2.73-.62 7.58.53 10 .02.01.03.04.04.06zM82.79 44.54c.08.03.17.05.27.05.19 0 .37-.07.51-.19.12-.1.2-.23.25-.38.54-2.99-1.98-7.49-4.85-8.36h-.01a.31.31 0 0 0-.22.09c-.05.06-.08.13-.09.21.2 2.34 1.83 6.75 3.89 8.44.06.05.13.1.21.13.02 0 .03 0 .04.01zM88.74 44.45h-.07c-.07.01-.14.04-.19.09-1.95 1.87-4.62 6.47-4.92 9.59a.928.928 0 0 0 .11.44c.04.06.08.12.12.17.1.11.23.2.37.25.1.04.2.05.31.05.14 0 .27-.03.38-.08.33-.17.63-.39.89-.67.67-.7 1.34-1.46 1.78-2.31 1.16-2.25 1.65-4.66 1.56-7.25-.01-.03-.02-.06-.04-.08a.394.394 0 0 0-.23-.19c-.03 0-.05 0-.07-.01zM76.17 75.02a.443.443 0 0 0-.26-.18c-2.89-.28-8.1.83-10.85 2.74-.05.03-.09.07-.13.11a.99.99 0 0 0-.29.7c0 .18.04.35.13.5.04.07.08.14.14.19.09.1.21.18.33.24.32.11.65.2.99.26 1.47.25 2.88-.02 4.25-.52 2.13-.77 4.02-1.93 5.65-3.52.02-.02.04-.04.05-.06s.03-.04.04-.07l.03-.12c0-.05 0-.09-.01-.14-.02-.04-.04-.09-.07-.13zM87.59 56.13c-.01-.04-.02-.06-.03-.09a.4.4 0 0 0-.24-.18c-.02 0-.04-.01-.06-.01h-.07c-.04.01-.08.02-.11.04-3.18 1.94-5.97 4.17-7.68 7.6-.03.07-.05.13-.06.21v.09c0 .08.01.16.03.24.02.07.05.14.08.2s.08.12.12.17c.1.11.23.2.37.25.08.03.17.05.27.05.85-.1 1.6-.38 2.28-.85 2.69-1.88 4.25-4.53 5.11-7.62v-.07s-.01-.01-.01-.03zM80.62 54.52c.1.11.23.2.37.25.1.03.2.05.31.05.16 0 .31-.04.44-.11.03-.02.07-.04.1-.06a.864.864 0 0 0 .28-.33c1.06-2.42.32-7.04-2.64-9.53-.03-.02-.06-.04-.1-.06-.02 0-.04-.01-.06-.01h-.07c-.08.01-.15.04-.21.1-.03.02-.05.05-.07.07-.03.05-.05.1-.05.16-.37 2.72.13 7.32 1.7 9.43-.01.03-.01.04 0 .04zM83.63 66.2l-.03-.09a.415.415 0 0 0-.24-.19c-.02 0-.04-.01-.06-.01h-.04c-2.7.15-7.58 2.75-9.73 5.12-.04.05-.07.1-.1.16-.04.09-.07.2-.08.3 0 .03-.01.06-.01.09 0 .09.01.17.03.25.02.07.05.14.08.2.04.07.08.12.12.17.1.11.22.2.37.25.05.02.1.02.15.04.32.04.64.06.96.05 3.13-.06 7.1-3.42 8.54-6.09l.03-.06c.01-.02.01-.05.01-.08V66.2zM76.37 63.73c.01.02.02.03.02.06.04.06.08.12.13.17a.87.87 0 0 0 .68.3c.05 0 .09 0 .14-.01.1-.02.21-.05.3-.1.03-.02.06-.04.1-.06.07-.05.13-.11.18-.17.04-.04.06-.08.09-.13.37-.69.71-1.41.87-2.15.55-2.58-.06-4.97-1.6-7.12-.02-.02-.04-.05-.06-.08a.407.407 0 0 0-.19-.13c-.02 0-.04-.01-.06-.01h-.07c-.06.01-.11.03-.15.05-.02.01-.04.03-.06.05-.03.02-.05.05-.07.08s-.03.07-.04.1c-.14.53-.26 1-.36 1.47-.42 2.03-.67 4.08-.29 6.15.08.53.24 1.04.44 1.53zM72.93 61.76c-.02 0-.04-.01-.06-.01h-.08c-.05.01-.1.03-.15.05-.02.01-.04.03-.06.05s-.03.04-.05.06c-1.58 2.47-2.93 6.69-2.41 9.2.02.05.04.11.07.16a.935.935 0 0 0 .49.42c.07.02.14.04.21.05h.1c.05 0 .1 0 .14-.01a.761.761 0 0 0 .36-.14c2.64-2.31 3.19-6.91 1.65-9.68a.408.408 0 0 0-.21-.15zM67.07 67.69c-.02-.01-.05-.01-.07-.01h-.09c-.05.01-.1.03-.15.05-.05.03-.09.07-.13.11-2.1 2.57-4.06 5.13-4.37 8.48 0 .18.05.35.13.5.04.07.08.13.14.19.11.13.25.22.41.28.08.03.18.05.27.06h.07c.16 0 .32-.04.46-.11 2.59-1.54 4.55-6.23 3.64-9.25a.37.37 0 0 0-.05-.11.357.357 0 0 0-.26-.19z\" /><path style=\"fill-rule:evenodd;clip-rule:evenodd\" d=\"M66.94 82.22a.424.424 0 0 0-.06-.14c-.04-.07-.11-.11-.19-.15-2.72-1.04-7.97-1.35-11.13-.27-.09.03-.17.07-.24.12-.05.04-.1.08-.14.13-.18.18-.29.43-.29.71 0 .18.04.35.13.5.04.07.08.14.14.19.03.04.07.06.11.1.27.19.57.36.87.51 1.34.64 2.78.75 4.24.64 2.26-.17 4.39-.78 6.38-1.87.02-.01.05-.03.07-.05.02-.02.05-.05.07-.08.01-.02.02-.05.03-.08.01-.04.02-.07.03-.12v-.09c-.02-.02-.02-.03-.02-.05z\" /><g><path d=\"M49.13 35.25h-.96v2.08c0 .75-.32 1.25-.98 1.55-.55.24-1.11.25-1.12.25v.48l-.01.49h.01v.69c.55 0 1.04-.08 1.45-.24v9.03h.96V39.9c0-.01 0-.01.01-.01.68-.75.65-1.69.63-1.88l.01-2.76zM50.12 36.05h5.76v1.66h-5.76zM50.12 47.45h5.76v1.66h-5.76z\" /><g><path d=\"M34.3 43.07h1.01v1.64H34.3zM34.3 39.9h1.01v1.64H34.3zM40.96 43.07h.99v1.64h-.99zM39.22 39.9h.99v1.64h-.99zM36.06 43.07h.99v1.64h-.99z\" /><path d=\"M61.34 19.1c-.37 0-.75.03-1.11.08-.81.11-1.64.16-2.49.16-3.19 0-6.2-.8-8.84-2.2-.4-.22-.79-.45-1.17-.68-.19-.11-.38-.24-.56-.36-.16-.11-.49-.35-.49-.35-.62-.44-1.37-.7-2.19-.7s-1.57.26-2.18.7c0 0-.32.23-.48.35-.19.12-.37.25-.56.36-.38.24-.77.47-1.17.68-2.64 1.4-5.65 2.2-8.84 2.2-.85 0-1.68-.05-2.5-.17a7.708 7.708 0 0 0-8.8 7.63v15.85c-.01.3-.02.6-.02.91 0 14.26 10.12 26.13 23.58 28.86a7.032 7.032 0 0 0 1.91.01c13.41-2.7 23.52-14.51 23.62-28.69V26.81c0-4.26-3.45-7.71-7.71-7.71zM42.68 35.24v2.27h-1.72v.87h1.72v11.25h-.74v-3.38h-.99v3.44h-.74v-3.44h-.99v3.38h-.74l.01-11.25h1.72v-.87h-1.72v-1.53h1.72v-.74h.74v.74h.99v-.74h.74zm-3.38-9.12.7-1.39.68 1.38v.01l1.53.22-1.1 1.07-.01.01.26 1.53-1.38-.72-1.37.72.25-1.51v-.01l-1.1-1.08 1.54-.23zm-7.09 4.44h.02l.69-1.39.68 1.37.01.01 1.54.22-1.1 1.07-.01.01.26 1.53-1.37-.72-1.37.72.26-1.52v-.01l-1.11-1.09 1.5-.2zm-4.22 7.33H28l.69-1.39.68 1.38.01.01 1.54.23-1.1 1.07-.01.01.26 1.53-1.36-.71-.02-.02-1.37.72.26-1.51v-.01l-1.11-1.08 1.52-.23zm.92 10.61-.01-.01-1.37.72.26-1.51v-.01l-1.1-1.08 1.51-.22h.01L28.9 45l.68 1.38.01.01 1.53.22-1.1 1.07-.01.01.26 1.53-1.36-.72zm5.79 7.84-1.36-.72h-.01l-1.38.72.26-1.51v-.02l-1.12-1.08 1.52-.22h.01l.69-1.39.68 1.38.01.01 1.54.22-1.1 1.07-.01.01.27 1.53zm3.09-18.83h-1.73v.87h1.73v7.87h-1.73v.88h1.73v1.53h-1.73v1.03h-.74v-1.03h-1.75v-1.53h1.75v-.88h-1.75v-7.87h1.75v-.87h-1.75v-1.53h1.75v-.74h.74v.74h1.73v1.53zm4.1 23.05-1.37-.72-1.37.72.26-1.51v-.01l-1.11-1.08 1.52-.22h.01l.69-1.39.68 1.38.01.01 1.53.22-1.1 1.07-.01.01.26 1.52zm25.43-16.97c0 13.26-9.43 24.31-21.94 26.84-.29.04-.58.06-.88.06l-.01-53.42c.76 0 1.48.32 2.05.73h.01c.15.11.29.21.45.31.17.11.34.23.52.34.35.22.72.43 1.09.63 2.45 1.3 5.57 1.98 8.54 1.98.79 0 1.62-.1 2.39-.21.32-.05.97-.06 1.31-.06 3.87 0 6.44 2.97 6.59 6.8.01.01-.12 15.87-.12 16z\" /><path d=\"M39.22 43.07h.99v1.64h-.99zM40.96 39.9h.99v1.64h-.99zM36.06 39.9h.99v1.64h-.99z\" /></g><g><path d=\"m50.61 26.36-1.48-.22-.02-.02-.65-1.32-.66 1.34-1.48.22 1.07 1.05-.25 1.48 1.32-.7 1.33.7-.25-1.48zM56.97 31.55l1.05-1.03-1.48-.21-.67-1.35-.67 1.35-1.48.21 1.07 1.06v.03l-.25 1.44 1.33-.7 1.32.7-.25-1.47zM61.2 38.51l1.05-1.02-1.49-.22-.01-.03-.65-1.31-.66 1.34-1.49.22 1.08 1.05-.26 1.48 1.33-.71 1.32.71-.25-1.48zM62.45 45.93l-1.48-.21-.02-.03-.64-1.32-.68 1.35-1.47.21 1.07 1.05-.26 1.48 1.34-.7 1.32.7-.26-1.48zM58.45 53.34l-1.48-.21-.02-.04-.64-1.31-.67 1.35-1.48.21 1.07 1.05-.25 1.48 1.33-.7 1.33.7-.26-1.48zM50.27 58.79l1.05-1.03-1.48-.21-.66-1.34-.67 1.34h-.03l-1.45.21 1.07 1.05v.04l-.25 1.44 1.33-.7 1.33.7-.26-1.48z\" /></g></g></g><g><path d=\"m185.3 59.51.03.05h.37l.01-.1.06-2.09-.07-.03c-.46-.14-.88-.25-1.25-.32-.38-.09-.71-.14-1-.19-.3-.04-.57-.07-.83-.08-.25-.01-.5-.01-.74-.01-.23 0-.55.01-.94.04-.4.02-.85.09-1.35.21-.5.12-1.02.31-1.56.57-.55.27-1.08.64-1.57 1.11-.45.43-.8.87-1.07 1.32-.26.45-.45.88-.59 1.31-.13.41-.21.8-.25 1.17-.03.36-.05.64-.05.86 0 .65.09 1.28.26 1.89.17.59.43 1.15.76 1.66s.75.97 1.23 1.35c.48.39 1.03.71 1.65.95.31.14.62.23.93.29.31.06.58.11.84.14.26.03.49.05.69.06.2.01.35.01.47.01.48 0 1.03-.04 1.62-.11.6-.06 1.14-.17 1.6-.3.2-.06.38-.11.57-.17.19-.05.38-.11.57-.19l.07-.02-.07-2.11h-.38l-.02.07c-.03.09-.08.2-.13.34-.05.12-.15.27-.3.45l-.28.25c-.11.09-.26.19-.44.27-.23.11-.47.2-.74.26-.25.06-.5.11-.73.15-.23.04-.43.05-.6.06-.17 0-.3.01-.36.01-.19 0-.44-.01-.76-.03-.31-.02-.65-.09-1.01-.2-.37-.11-.75-.28-1.14-.5-.38-.23-.76-.55-1.13-.95v-.01.01c-.14-.15-.3-.35-.46-.58-.16-.23-.31-.51-.45-.82-.14-.31-.25-.68-.35-1.08a6.44 6.44 0 0 1-.14-1.38c0-.55.06-1.04.17-1.47.12-.44.26-.82.43-1.15.16-.31.34-.59.54-.81.2-.23.38-.43.54-.56.37-.32.74-.56 1.13-.74.39-.18.76-.31 1.11-.38.35-.08.66-.12.95-.15.29-.02.52-.02.67-.02.45 0 .93.05 1.44.14.5.09.93.28 1.29.56.23.2.39.39.5.57.12.17.21.32.26.42zM189.87 69.01v-.09l-.09-.01c-.12-.02-.24-.06-.35-.11l-.24-.24-.07-.18-.01-.12c0-.1.03-.23.1-.41.07-.17.15-.38.26-.64l.99-2.31h4.2l.92 2.23c.06.15.11.3.18.43.06.13.12.27.17.41.03.13.05.22.05.27v.1l-.07.17c-.07.15-.16.22-.27.28-.14.05-.28.09-.43.11l-.08.01-.03.29-.01.12h3.88V68.97l-.07-.03c-.12-.05-.28-.12-.46-.23-.16-.08-.33-.26-.51-.54l-.12-.22-.13-.29-.13-.29-.11-.24-4.34-10.19H192.81l-4.7 10.53c-.12.27-.22.48-.32.66-.1.17-.19.31-.29.41l-.32.26c-.11.05-.24.09-.4.11l-.09.01V69.32h3.17v-.31h.01zm1.06-5.14 1.69-3.76 1.6 3.76h-3.29zM201.55 68.32c-.07.15-.17.28-.29.37l-.34.16-.22.06-.07.02-.02.28-.01.12h3.9v-.39l-.08-.02c-.22-.05-.38-.11-.47-.17l-.27-.2-.18-.29-.07-.32c-.01-.13-.01-.27-.01-.45v-9.32h2.55c.38 0 .67.05.88.15.18.09.32.31.38.72l.02.09h.39v-2.04H197.5v2.06h.4l.02-.09c.01-.06.03-.17.06-.32.02-.12.1-.25.23-.36.11-.09.25-.15.41-.19.16-.04.41-.06.73-.07h2.35v9.46c-.04.33-.08.58-.15.74zM212.51 69.01v-.09l-.24-.03-.23-.09-.25-.16-.2-.27a1.41 1.41 0 0 1-.08-.46c0-.2-.01-.46-.01-.79v-3.76h6.47v3.73c0 .28 0 .53-.01.75 0 .21-.02.36-.03.45l-.07.17-.07.11-.29.24c-.13.05-.26.09-.4.11h-.1l-.02.29-.01.12h3.74v-.39l-.08-.02c-.15-.03-.28-.07-.39-.12l-.31-.23-.18-.34c-.03-.12-.05-.24-.06-.4l-.02-.36v-8.19c0-.14 0-.35.01-.59 0-.25.03-.45.07-.56l.17-.29.25-.19.25-.09.16-.04.09-.01v-.42h-3.71v.4l.24.03.25.07.25.16.18.28c.04.11.07.25.07.43v3.86h-6.47v-3.13c0-.3.01-.55.02-.76.02-.2.06-.35.1-.44l.18-.24.23-.14.22-.07.16-.04.08-.02v-.39h-3.72v.39l.26.06.24.07.24.16.18.28c.05.15.08.3.09.44v.19c0 .14 0 .31-.01.52v8.64c-.01.22-.03.36-.05.44l-.18.3-.26.2-.25.09-.17.04-.09.02V69.33h3.72v-.32h.04zM234.33 67.6c.37-.41.66-.83.88-1.26.21-.41.37-.82.47-1.2.1-.38.16-.72.19-1.04.02-.31.03-.56.03-.78 0-.6-.06-1.14-.18-1.64a6.93 6.93 0 0 0-.44-1.31c-.18-.38-.36-.71-.56-.99-.2-.27-.37-.49-.54-.67a8.46 8.46 0 0 0-.65-.6c-.27-.23-.6-.45-.98-.66-.38-.19-.83-.38-1.33-.51-.5-.14-1.07-.2-1.69-.2-.72 0-1.37.09-1.94.26-.57.19-1.07.39-1.5.64-.43.25-.79.51-1.09.8-.29.28-.52.52-.69.74-.13.16-.27.36-.43.6-.16.25-.31.55-.46.89-.15.34-.26.73-.37 1.17-.09.45-.14.94-.14 1.46 0 .67.08 1.27.22 1.81.15.53.34 1 .56 1.42.22.4.46.75.72 1.02a6.018 6.018 0 0 0 2.7 1.79c.72.22 1.48.33 2.27.33 1 0 1.9-.15 2.72-.46.83-.31 1.56-.84 2.23-1.61zm-.55-2.03c-.17.47-.39.89-.66 1.26-.28.38-.59.7-.96.98s-.77.48-1.21.62a4.4 4.4 0 0 1-1.42.22c-.59 0-1.1-.08-1.55-.26-.45-.17-.83-.37-1.16-.62h-.01c-.31-.24-.58-.48-.78-.74-.2-.26-.37-.49-.48-.66a5.68 5.68 0 0 1-.5-.98c-.13-.32-.22-.62-.27-.91a6.76 6.76 0 0 1-.11-.77c-.02-.23-.02-.43-.02-.59 0-.6.06-1.11.17-1.58.12-.46.27-.87.45-1.22l.01-.01c.18-.35.37-.64.59-.88.21-.24.42-.45.61-.6.28-.22.56-.4.85-.53.3-.14.58-.23.84-.3.25-.07.49-.11.7-.12a4.84 4.84 0 0 1 1.77.13c.38.12.7.25.98.41.29.15.53.32.72.49v.01c.19.18.35.33.46.48.15.19.31.42.49.7.17.27.32.6.46.99.13.38.24.82.31 1.3.04.3.06.6.06.93 0 .23-.01.45-.03.68-.01.14-.03.34-.07.62-.04.28-.11.6-.24.95zM238.58 57.63l.27.2c.08.07.15.18.2.31.04.11.06.28.08.5.01.23.02.5.02.81v7.12c0 .3 0 .59-.01.88 0 .28-.01.46-.02.54-.03.2-.08.34-.16.44l-.26.27-.3.15-.25.06-.08.02V69.33h8.81v-2.11h-.39l-.01.09c-.06.18-.12.33-.16.44l-.16.24-.29.19-.35.09c-.13.02-.26.03-.38.03-.13.01-.25.01-.36.01h-2.35c-.29-.01-.52-.02-.67-.02-.14-.01-.27-.05-.4-.11a.633.633 0 0 1-.36-.47c-.04-.23-.07-.56-.08-.99v-7.26c.01-.3.02-.55.03-.8.01-.23.03-.4.05-.5.04-.14.1-.24.18-.31l.26-.2.25-.09.19-.04.08-.01v-.42h-3.91v.39l.26.06.27.09zM251.85 68.76l-.34-.26-.16-.33-.02-.27v-.01c-.02-.13-.03-.26-.03-.39v-8.24c0-.28 0-.51.01-.71 0-.2.02-.34.05-.44.04-.14.1-.24.16-.3l.24-.18.25-.08.17-.04.09-.01v-.41h-3.77v.39l.28.06.27.08.27.19c.08.07.15.18.2.33.04.12.07.26.08.43v8.48c-.01.39-.02.69-.02.92-.01.2-.06.37-.16.5-.11.15-.22.25-.34.3-.15.07-.3.1-.46.14l-.08.02V69.33h3.81v-.38l-.07-.03c-.15-.05-.29-.1-.43-.16zM255.56 66.87c.34.51.75.96 1.23 1.35.49.39 1.04.71 1.64.95.32.14.63.23.93.29.3.06.58.11.84.14.26.03.49.05.7.06.19.01.35.01.46.01.48 0 1.03-.04 1.62-.11.6-.06 1.14-.17 1.61-.3.2-.06.39-.11.57-.17.19-.05.38-.11.58-.19l.07-.02-.07-2.11h-.38l-.03.07c-.03.09-.07.2-.13.34-.05.12-.15.27-.31.45l-.27.25c-.11.09-.26.19-.45.27-.23.11-.48.2-.72.26-.26.06-.51.11-.74.15-.23.04-.43.05-.6.06-.18 0-.3.01-.37.01-.19 0-.44-.01-.76-.03-.31-.02-.65-.09-1.01-.2-.37-.11-.74-.28-1.13-.5-.38-.23-.76-.55-1.14-.95v-.01.01c-.14-.15-.3-.35-.46-.58-.16-.23-.31-.51-.45-.82s-.26-.68-.35-1.08a6.44 6.44 0 0 1-.14-1.38c0-.55.05-1.04.18-1.47.12-.44.26-.82.42-1.15.17-.31.34-.59.54-.81.2-.23.38-.43.54-.56.37-.32.75-.56 1.14-.74.39-.18.76-.31 1.11-.38.36-.08.68-.12.96-.15.28-.02.5-.02.66-.02.45 0 .93.05 1.43.14.51.09.94.28 1.3.56.23.2.4.39.5.57.11.2.19.36.25.46l.03.05h.37v-.1l.07-2.09-.08-.03c-.47-.14-.88-.25-1.25-.32-.37-.09-.71-.14-1.01-.19-.3-.04-.57-.07-.82-.08-.25-.01-.5-.01-.74-.01-.23 0-.54.01-.94.04-.41.02-.86.09-1.35.21-.49.12-1.01.31-1.56.57-.55.27-1.07.64-1.57 1.11-.45.43-.8.87-1.06 1.32s-.46.88-.58 1.31c-.14.41-.23.8-.26 1.17-.03.36-.05.64-.05.86 0 .65.08 1.28.26 1.89.18.56.44 1.12.77 1.62zM282.32 68.73l-.01-.01zM288.33 57.39v.09l.19.04.2.05.23.1.19.15c.12.15.2.36.2.62V64.58c0 .3 0 .55-.01.76-.02.22-.04.42-.07.6-.02.17-.06.32-.11.45-.05.15-.09.28-.15.43-.08.18-.16.32-.24.46-.07.13-.14.21-.18.26-.09.11-.22.22-.37.35-.16.12-.35.23-.56.32-.22.11-.48.19-.77.26-.29.07-.61.11-.98.11-.54 0-1.07-.1-1.58-.3-.51-.19-.93-.52-1.28-.96-.17-.22-.3-.45-.39-.67-.09-.23-.16-.46-.21-.69-.04-.24-.07-.48-.08-.73-.01-.25-.01-.51-.01-.78v-5.37c.01-.24.02-.45.03-.63 0-.17.03-.32.08-.44l.25-.3c.12-.08.31-.16.58-.23l.07-.01.03-.26v-.12h-3.76v.38l.07.02c.32.08.54.18.62.26h.01v.01c.15.12.23.25.25.44.02.21.03.5.03.88V64.89c0 .41.02.75.05 1.03.05.32.12.63.21.92.11.32.28.65.52.99.22.34.53.63.91.9s.85.49 1.39.66c.55.17 1.2.24 1.96.24.77 0 1.42-.09 1.97-.28.54-.18.99-.42 1.35-.71.36-.29.64-.61.83-.97.2-.35.34-.7.44-1.04.06-.22.1-.44.13-.67.03-.22.05-.44.06-.63V59.03c0-.31.01-.55.02-.7v-.01c.01-.14.05-.27.14-.39.09-.15.2-.23.32-.28.15-.06.3-.11.47-.15l.07-.02v-.39h-3.14v.3h.02zM302.86 57.39v.09l.08.01c.41.08.66.22.76.37.11.16.18.35.2.54v.01l.02.29v.08c0 .13-.01.21-.01.25v7.03L296 57.09h-2.61v.4l.1.01c.16.02.31.05.46.1.12.04.23.13.31.28.07.11.11.24.11.39 0 .16.01.39.01.67v8.54c0 .16-.01.35-.02.59-.02.21-.08.38-.18.49-.11.15-.24.24-.38.28-.17.04-.29.06-.33.08l-.09.02-.02.28-.01.12h3.18v-.39l-.08-.02a1.67 1.67 0 0 1-.6-.24c-.14-.1-.23-.27-.29-.54l-.02-.26v-8.72l9.15 10.36h.31V58.98c0-.24.02-.49.03-.71.02-.2.1-.37.3-.53l.23-.14c.08-.04.21-.08.38-.11l.07-.01v-.08l.02-.18.01-.12h-3.19l.01.29zM311.39 68.76l-.34-.26-.15-.33-.02-.27v-.01c-.02-.13-.03-.26-.03-.39v-8.95c0-.2.03-.34.06-.44.04-.14.1-.24.16-.3l.24-.18.24-.08.18-.04.08-.01v-.41h-3.77v.39l.28.06.27.08.27.19c.08.07.15.18.2.33.04.12.06.26.06.43.01.16.01.4.01.69v7.79c-.01.39-.02.69-.02.92-.01.2-.06.37-.16.5-.1.15-.22.25-.35.3-.14.07-.29.1-.45.14l-.08.02V69.33h3.82v-.38l-.08-.03c-.13-.05-.28-.1-.42-.16zM321.89 57.39v.08l.43.12.27.22.06.16v.11l-.04.34-.1.32-.11.27-.05.12-3.15 7.23-2.98-7.22-.14-.33-.1-.34c-.04-.16-.07-.3-.07-.39 0-.15.05-.27.15-.36.09-.08.29-.17.6-.22l.09-.01V57.09h-3.84v.39l.08.01c.14.03.25.07.33.1l.29.2c.15.13.25.27.32.42.08.16.12.27.14.33l.24.51c.07.17.14.35.2.52v.01l4.18 9.9h.31l4.42-10.05c.09-.21.19-.44.31-.71.11-.26.23-.49.34-.68.12-.18.24-.31.36-.38.11-.08.28-.13.5-.18l.09-.01v-.38h-3.14v.3h.01zM334.29 67.2l-.03.08c-.04.15-.08.28-.14.41l-.21.33c-.11.11-.23.17-.36.19-.15.02-.26.03-.31.03h-.01l-.35.04H330.95c-.42-.02-.78-.02-1.1-.04-.3-.02-.51-.07-.62-.15l-.11-.12-.06-.09c-.08-.18-.13-.38-.13-.59l-.03-.63v-3.33h2.52c.25 0 .5.02.76.06.22.04.39.16.52.4l.08.17c.02.06.05.16.09.29l.02.08H333.29v-3.09h-.39l-.06.25-.08.26-.18.27-.29.18c-.13.05-.28.08-.43.08h-2.93v-4.15h3.13c.22 0 .42.02.61.06.16.04.3.15.41.36l.11.24.08.26.02.08.28.02.11.01.04-2.06h-7.51v.4l.27.03.26.07.26.16c.07.08.13.17.17.29h.01v.01c.05.12.07.25.07.4V67l-.01.33v.64c-.01.18-.05.32-.12.46a.67.67 0 0 1-.32.3l-.22.1-.25.06-.07.02-.02.28-.01.12h8.53V67.2h-.47zM346.68 68.66l-.26-.31-.14-.23c-.19-.29-.37-.59-.53-.91l-2.33-4.28c.06-.04.12-.07.22-.11.15-.08.3-.19.48-.31s.36-.28.53-.46h.01c.18-.19.34-.4.47-.65h.01c.19-.38.3-.82.3-1.3 0-.45-.07-.84-.22-1.15-.14-.3-.25-.52-.35-.67l-.01-.01c-.22-.29-.48-.52-.78-.68-.29-.15-.59-.27-.91-.34-.31-.07-.65-.12-.98-.14-.34-.01-.65-.02-.97-.02h-4.35v.39l.23.04.25.07.26.15.2.25c.05.11.08.25.09.41.01.17.02.4.02.68v8.19c-.01.26-.02.49-.03.68-.01.18-.03.32-.07.4l-.17.28-.25.16-.24.09-.17.02-.09.01V69.31h3.86v-.39l-.08-.02c-.24-.06-.42-.12-.52-.17l-.28-.2-.18-.32c-.03-.1-.04-.23-.05-.38l-.02-.31-.02-.33V63.5c.12 0 .24 0 .34.01.14.01.29.01.45.01.23 0 .46-.01.71-.03.21-.01.42-.04.62-.06l2.2 4.04c.13.24.26.47.42.73.16.26.35.48.58.66.14.12.29.21.44.27.15.07.29.11.43.14.13.03.26.05.37.05h1.05v-.38l-.26-.11-.28-.17zm-3.14-7.69c-.05.2-.1.34-.16.41v.01c-.13.23-.28.42-.46.55-.2.15-.41.26-.63.33-.24.07-.48.13-.74.16s-.52.04-.75.04h-1.18l.03-4.31h1.45c.24 0 .49.01.74.03.31.03.61.15.9.33.31.2.53.45.67.77.15.32.22.66.22 1 0 .27-.03.49-.09.68zM355.38 63.45c-.21-.2-.44-.38-.7-.56-.26-.16-.51-.33-.73-.47l-.99-.56c-.29-.18-.59-.38-.9-.6-.3-.21-.51-.48-.65-.82-.06-.15-.09-.28-.09-.4-.01-.12-.01-.22-.01-.27 0-.32.05-.59.16-.83.12-.25.26-.46.45-.61.19-.16.41-.29.67-.37.26-.09.54-.13.83-.13.41 0 .75.06 1.02.18.27.13.49.27.66.44.16.17.3.35.39.54.09.2.18.38.24.52l.02.05h.36V57.4l-.06-.03c-.13-.05-.28-.1-.45-.16-.18-.07-.38-.14-.61-.19-.22-.06-.48-.12-.76-.16-.29-.04-.6-.07-.94-.07-.12 0-.28 0-.49.02-.21.01-.45.04-.7.11-.26.07-.53.16-.8.33-.28.14-.54.34-.78.6-.17.17-.35.42-.52.77-.19.36-.29.82-.29 1.38 0 .19.01.39.05.62.03.22.1.45.21.69.11.23.27.47.48.73.21.26.49.5.83.74l.01.01.33.21.33.2 1.09.65c.34.2.65.42.93.64.27.22.48.51.63.87v.01-.01c.03.07.08.18.12.34.05.15.07.33.07.55 0 .33-.05.58-.12.77v.01V67c-.09.21-.16.37-.21.47-.25.39-.57.67-.97.85-.39.18-.82.28-1.29.28-.29 0-.55-.04-.77-.09-.22-.06-.42-.14-.59-.23-.16-.09-.31-.19-.41-.3l-.27-.3-.17-.31c-.06-.11-.14-.28-.22-.49l-.02-.06-.26-.02-.12-.01v2.17l.06.03c.28.11.63.26 1.06.42.45.15 1.03.23 1.74.23.13 0 .31-.01.54-.02.23-.01.49-.04.77-.11s.57-.17.88-.32c.32-.14.62-.36.91-.64.25-.24.45-.49.6-.74.15-.26.25-.5.33-.75.08-.23.12-.45.14-.66.02-.19.02-.35.02-.48.03-.97-.33-1.8-1.04-2.47zM362.49 68.76l-.34-.26-.16-.33-.03-.27v-.01c-.02-.13-.03-.26-.03-.39v-8.24c0-.28.01-.51.01-.71 0-.2.02-.34.05-.44.04-.14.1-.24.17-.3l.23-.18.25-.08.18-.04.09-.01v-.41h-3.77v.39l.28.06.26.08.28.19c.08.07.15.18.2.33.05.12.07.26.07.43 0 .16.01.4.01.69v7.79c-.01.39-.02.69-.02.92-.01.2-.06.37-.16.5-.11.15-.22.25-.34.3-.15.07-.3.1-.46.14l-.08.02V69.33H363v-.38l-.07-.03c-.17-.05-.31-.1-.44-.16zM364.12 59.15h.4l.02-.09c.01-.06.03-.17.06-.32.02-.12.09-.25.22-.36.12-.09.24-.15.41-.19.16-.04.41-.06.73-.07h2.35v9.46c0 .33-.04.58-.12.74a.89.89 0 0 1-.29.37l-.34.16-.22.06-.08.02-.02.28-.01.12h3.9v-.39l-.08-.02c-.22-.05-.38-.11-.47-.17l-.27-.2-.18-.29-.07-.32c-.01-.13-.02-.27-.02-.45v-9.32h2.55c.38 0 .67.05.87.15.18.09.32.31.38.72l.01.09h.38v-2.04H364.1v2.06h.02zM383.02 57.09v.4l.09.01c.15.02.28.04.38.07.08.02.15.08.22.21l.08.2.01.11c0 .15-.04.3-.13.46-.1.17-.18.33-.26.46l-2.33 3.8-2.43-3.8V59c-.09-.11-.17-.27-.27-.44-.09-.18-.14-.34-.14-.5 0-.13.03-.21.08-.27l.2-.17.22-.08.15-.02.09-.01v-.42h-3.84v.38l.08.02c.13.03.23.07.31.11l.22.14.18.2.2.27.16.23.16.22 3.4 5.27v3.54c0 .33-.01.57-.03.72v.01c-.02.14-.08.27-.2.41l-.31.22c-.13.03-.27.06-.43.08l-.09.01-.02.29-.01.12h3.81v-.39l-.09-.02c-.06-.01-.16-.03-.3-.05l-.35-.18a.739.739 0 0 1-.28-.54c-.03-.23-.04-.46-.04-.67v-3.44l3.4-5.49c.1-.16.21-.32.32-.5.11-.15.23-.29.38-.36l.29-.13.19-.05.08-.01v-.41h-3.15zM107.56 56.95v.1l.27.02.26.09.27.16c.07.07.14.16.17.31h.01v.01c.04.08.05.2.05.35v9.8c0 .22-.03.38-.07.49l-.01.01v.01c-.07.21-.16.35-.32.42-.17.09-.36.16-.57.21l-.08.02v.4h4.02v-.4l-.08-.02c-.21-.06-.4-.12-.59-.21-.16-.07-.28-.2-.37-.41l-.1-.26-.02-.28V63.1h2.6c.27.01.54.02.82.05.25.03.43.13.57.33l.12.22c.03.09.06.22.1.38l.01.09h.41v-3.24h-.4l-.04.25-.07.25-.16.28-.26.19c-.11.06-.25.08-.42.09-.17.02-.39.02-.67.02h-2.6v-4.34h3.12c.24.01.49.02.72.07.22.04.38.15.53.37l.13.26.09.29.02.07h.4l.02-2.07h-7.9v.29h.02zM125.87 56.95v.09l.2.03.21.07.24.1.2.16c.13.16.2.37.21.64.01.29.01.54.01.74v5.68c0 .3-.01.56-.03.79-.02.22-.04.43-.07.61-.03.17-.07.33-.11.48s-.09.29-.15.44c-.08.18-.16.34-.25.48-.09.12-.15.22-.2.28-.1.11-.23.22-.39.36-.16.12-.35.23-.58.34-.23.1-.5.19-.79.26-.3.07-.64.12-1.02.12-.57 0-1.12-.1-1.65-.31a2.87 2.87 0 0 1-1.33-.99c-.18-.24-.31-.46-.41-.69-.1-.24-.18-.48-.22-.72v-.01c-.04-.25-.07-.5-.08-.76-.01-.26-.01-.53-.01-.81v-5.6c.01-.25.01-.47.02-.66 0-.18.04-.33.09-.45.05-.12.14-.23.26-.32.13-.08.33-.17.6-.23l.07-.02.03-.27.01-.11h-3.91v.37l.08.03c.33.09.56.19.65.27h.01c.15.11.24.26.25.46.03.21.04.52.04.91v6.05c0 .43.02.78.05 1.06.05.34.12.66.22.96.12.34.3.69.54 1.03.23.35.55.66.94.93.4.3.88.51 1.45.68.58.17 1.25.26 2.04.26.81 0 1.49-.09 2.06-.29.56-.19 1.03-.44 1.41-.75.36-.3.66-.63.87-1.01.2-.36.35-.73.45-1.07.06-.23.11-.46.14-.69.03-.24.05-.46.06-.67.01-.2.01-.38.01-.53V58.65c0-.32 0-.57.01-.73.02-.16.07-.3.15-.42.1-.16.21-.25.34-.3.14-.06.31-.11.48-.15l.08-.02v-.39h-3.26v.31h-.02zM144.96 67.17l-.02.08c-.05.15-.1.29-.14.42l-.22.34c-.12.11-.24.18-.38.2-.16.03-.27.04-.32.04h-.02l-.35.03h-2.02c-.43-.01-.82-.03-1.14-.04-.31-.02-.53-.08-.65-.16l-.12-.13-.07-.11c-.09-.19-.14-.38-.14-.61-.01-.24-.02-.45-.03-.65v-3.47h2.62c.27 0 .53.01.79.06.23.04.41.17.55.42l.07.19c.02.06.06.16.09.31l.02.08H143.88v-3.21h-.39l-.06.27-.09.26-.2.28-.3.19-.01.01c-.14.05-.28.08-.44.08H139.33v-4.32h3.26c.23 0 .44.02.64.07.16.05.3.16.42.37l.11.26.07.27.02.07.29.02.11.01.04-2.13h-7.81v.39l.28.02.27.09.27.16c.08.07.14.16.18.31v.01c.05.13.08.27.08.42v8.89l-.02.33v.34l-.01.35c0 .18-.05.34-.12.47-.06.14-.17.24-.33.33l-.23.1-.27.07-.07.02-.02.29-.01.1h8.86v-2.19h-.38zM157.52 56.95v.09l.08.02c.42.09.69.23.78.38.12.17.19.36.21.56v.01l.03.29v.09c-.01.13-.01.22-.01.27v7.33l-8.24-9.33h-2.71v.38l.1.02c.17.01.33.06.48.11.13.04.23.14.32.3h.01c.07.11.11.24.12.4.01.17.01.39.01.69v8.89c0 .17-.01.37-.02.61-.02.22-.07.39-.18.52-.12.15-.25.26-.4.29l-.01.01c-.17.04-.3.06-.35.07l-.07.01-.03.3-.01.1h3.31v-.4l-.08-.02a1.84 1.84 0 0 1-.63-.26c-.14-.1-.25-.28-.3-.56l-.03-.27v-9.09l9.54 10.79h.31V58.62c.01-.27.01-.51.03-.75.01-.21.11-.39.31-.55l.24-.15c.09-.04.22-.09.39-.11l.08-.02v-.08l.02-.19.01-.11h-3.3l-.01.29zM130.85 56.95v.09l.09.02c.19.03.38.09.55.17.15.06.26.19.34.39.07.21.11.61.1 1.19v10.47c0 .49-.02.98-.08 1.44-.05.46-.24.89-.56 1.27V72c-.13.15-.27.29-.42.43-.17.14-.28.22-.3.25l-.08.05.18.3.04.07.09-.04c.31-.14.55-.25.73-.35.17-.1.33-.2.46-.29.39-.25.7-.53.93-.83.22-.3.39-.59.51-.87.11-.28.19-.54.22-.81.03-.26.05-.48.06-.66V58.82c0-.48.02-.85.06-1.08.04-.22.16-.38.39-.51l.22-.11c.05-.02.16-.04.32-.06l.09-.02v-.39h-3.93l-.01.3z\" /></g><g><path style=\"fill:#00517e\" d=\"M243.19-119c.11-.21.23-.4.36-.55.13-.15.25-.28.36-.37.25-.21.5-.37.75-.49.26-.12.51-.21.74-.26.24-.05.45-.08.64-.09.2-.01.34-.02.44-.02.29 0 .62.03.96.1.33.06.62.19.86.38.15.12.26.25.33.38l.19.34h.25l.05-1.46-.05-.01c-.3-.09-.59-.16-.84-.21-.25-.05-.47-.1-.67-.13-.2-.03-.38-.05-.55-.06-.17-.01-.33-.01-.49-.01-.16 0-.37.01-.63.02-.27.02-.57.06-.9.14-.33.08-.67.21-1.04.38-.36.18-.71.42-1.04.74-.3.28-.54.58-.71.88-.17.3-.3.59-.39.87-.09.28-.14.54-.17.78s-.04.43-.04.57c0 .44.06.86.17 1.25.12.4.29.77.51 1.11.22.34.5.64.82.9a4.196 4.196 0 0 0 1.71.82c.2.04.39.07.56.1.17.02.32.04.46.04h.31c.32 0 .68-.03 1.08-.07.4-.05.76-.12 1.07-.2.13-.04.25-.08.38-.11.12-.04.25-.08.38-.13l.05-.02-.05-1.4h-.26l-.01.04a1.538 1.538 0 0 1-.29.52c-.04.04-.11.1-.18.17-.07.06-.17.12-.3.18-.15.07-.32.13-.48.17-.17.04-.34.07-.49.09-.15.02-.29.04-.4.04-.12 0-.2.01-.24.01-.13 0-.3-.01-.5-.02-.21-.01-.43-.06-.68-.13-.24-.07-.5-.19-.75-.34-.26-.15-.51-.36-.75-.63-.09-.1-.2-.23-.31-.39-.11-.16-.21-.34-.3-.55a4.35 4.35 0 0 1-.23-.72c-.06-.27-.09-.58-.09-.92 0-.36.04-.69.12-.98.08-.28.17-.54.28-.75zM251.5-113.36l-.06-.01a.843.843 0 0 1-.24-.07.332.332 0 0 1-.16-.15c-.03-.04-.04-.08-.05-.12 0-.04-.01-.07-.01-.09 0-.07.02-.17.06-.27.04-.12.1-.26.17-.42l.66-1.54h2.79l.62 1.48c.04.1.08.19.12.29l.12.27c.03.1.03.16.03.19 0 .01 0 .04-.01.08 0 .03-.01.06-.04.1-.04.09-.1.15-.18.18-.09.04-.18.06-.28.07l-.05.01-.02.27h2.58v-.23l-.04-.02c-.08-.04-.18-.09-.31-.15-.11-.06-.23-.18-.34-.36a.676.676 0 0 1-.08-.15c-.03-.06-.06-.13-.09-.19l-.08-.19c-.03-.06-.05-.11-.08-.16l-2.86-6.74-.02-.04h-.19l-3.13 7c-.07.17-.14.31-.21.44-.06.12-.13.21-.19.28-.07.07-.13.12-.21.16-.07.04-.16.06-.26.08l-.06.01v.27h2.11v-.28zm.7-3.36 1.12-2.51 1.06 2.51h-2.18zM256.21-119.87h.26l.01-.06c.01-.04.02-.11.04-.21.01-.08.06-.16.15-.24.08-.06.16-.1.27-.13.11-.03.28-.04.49-.05H259v6.29c0 .21-.02.38-.07.49-.05.11-.11.19-.2.25-.07.05-.14.09-.21.1-.09.02-.14.03-.17.04l-.04.02-.02.26h2.59v-.26l-.05-.01c-.14-.04-.25-.07-.31-.11a.623.623 0 0 1-.18-.14.997.997 0 0 1-.12-.19c-.02-.06-.04-.14-.05-.22-.01-.08-.01-.18-.01-.29v-6.2h1.7c.24 0 .44.03.58.1.13.06.21.22.26.47l.01.06h.25v-1.34h-6.74v1.37zM265.87-113.37h-.07c-.01 0-.03 0-.09-.02a.772.772 0 0 1-.15-.06c-.06-.03-.11-.07-.17-.11-.05-.04-.1-.1-.13-.17-.03-.08-.05-.18-.06-.31 0-.13-.01-.31-.01-.52v-2.5h4.3v2.98c0 .14-.01.24-.03.3-.01.04-.03.08-.05.12a.447.447 0 0 1-.24.23c-.08.04-.17.06-.26.07l-.06.01-.02.27h2.49v-.26l-.05-.01c-.1-.02-.19-.05-.26-.08a.587.587 0 0 1-.21-.16.691.691 0 0 1-.12-.22c-.02-.08-.03-.17-.04-.28-.01-.08-.01-.16-.01-.24V-120.18c0-.16.02-.29.05-.37.03-.08.07-.14.12-.19.06-.05.11-.1.17-.13.05-.03.11-.05.15-.06.06-.01.1-.02.13-.03l.05-.02v-.25h-2.46v.26h.07c.01 0 .04 0 .09.02.05.01.11.03.17.05.06.02.12.06.17.11.05.05.09.1.12.18.03.08.04.18.04.3v2.56h-4.3v-2.09c0-.19.01-.36.02-.5.01-.13.03-.23.07-.3.03-.06.06-.11.11-.15.06-.04.11-.07.16-.09.05-.02.1-.04.15-.05.05-.01.09-.02.12-.03l.05-.02v-.24h-2.47v.25l.05.02c.03.01.07.02.13.03.05.01.1.03.16.05.05.02.11.06.16.1.05.05.09.11.12.19.04.1.06.2.06.29.01.1 0 .26 0 .47v5.74c0 .14-.01.24-.03.3-.03.08-.07.14-.12.2-.05.06-.11.1-.17.12-.06.03-.12.05-.17.06-.07.02-.09.02-.1.02h-.07v.28h2.47v-.27zM280.05-114.24c.25-.27.44-.56.58-.83.14-.28.25-.55.32-.8s.11-.49.13-.69c.01-.21.02-.38.02-.51 0-.39-.04-.76-.12-1.09a5.21 5.21 0 0 0-.29-.87 5.01 5.01 0 0 0-.37-.66c-.13-.18-.25-.33-.36-.45-.11-.12-.25-.25-.43-.4-.18-.15-.4-.3-.66-.43-.26-.14-.56-.25-.89-.34a4.29 4.29 0 0 0-1.12-.14c-.48 0-.92.06-1.29.18-.38.12-.71.26-.99.43-.28.16-.52.34-.72.53-.19.19-.35.35-.46.49-.08.11-.18.24-.29.41-.11.17-.21.36-.3.59-.09.23-.18.49-.24.78-.07.29-.1.62-.1.98 0 .44.05.85.15 1.2.1.35.23.66.38.94.15.27.31.5.48.69.17.19.32.33.45.45.41.34.87.59 1.34.74.48.15.98.22 1.51.22.67 0 1.27-.11 1.81-.31.52-.25 1.02-.61 1.46-1.11zm-3.19.7a2.944 2.944 0 0 1-1.8-.58c-.21-.16-.39-.33-.53-.5-.14-.18-.24-.32-.32-.44-.14-.22-.25-.44-.33-.65-.08-.21-.14-.42-.18-.61-.04-.19-.06-.36-.07-.51-.01-.16-.02-.28-.02-.39a4.154 4.154 0 0 1 .41-1.86 3.019 3.019 0 0 1 .8-.99c.18-.15.37-.26.57-.35.19-.09.38-.16.55-.2.17-.05.33-.07.47-.08.14-.01.25-.02.33-.02.32 0 .6.04.85.11s.47.17.66.27c.19.1.35.21.47.33.13.12.23.22.32.32.09.13.2.29.32.47s.22.41.31.66c.09.26.16.55.2.87.05.32.05.68.02 1.06-.01.09-.03.23-.05.41-.03.18-.08.4-.16.63-.11.31-.26.59-.44.84s-.39.47-.64.65c-.24.18-.51.32-.8.42-.29.09-.6.14-.94.14zM282.36-120.94c.06.01.11.03.17.06.06.03.12.07.18.13s.1.13.13.21c.03.08.05.19.05.33.01.15.01.33.01.53v4.73c0 .2 0 .4-.01.59 0 .19-.01.31-.02.36-.02.13-.06.22-.11.29-.05.07-.11.13-.17.18-.06.04-.12.08-.19.1-.07.02-.12.04-.16.04l-.06.01v.27h5.86v-1.4h-.26l-.01.05c-.04.13-.07.22-.11.3-.03.07-.06.12-.1.16-.05.05-.12.09-.19.12-.08.03-.16.05-.24.06-.08.01-.17.02-.25.02-.08 0-.16.01-.24.01h-1.56l-.45-.02c-.09 0-.18-.03-.27-.07a.46.46 0 0 1-.24-.32c-.03-.15-.05-.37-.05-.65v-4.83c.01-.2.01-.37.02-.53.01-.15.02-.27.03-.33.03-.09.07-.16.12-.21a.643.643 0 0 1 .33-.19.63.63 0 0 0 .13-.03l.05-.01v-.25h-2.6v.24l.05.02c.05.01.1.02.16.03zM288.99-120.94c.06.01.12.03.18.06s.12.07.18.12c.05.05.1.13.13.22.03.08.05.18.05.29 0 .11.01.27.01.46v5.18c-.01.26-.01.46-.02.61 0 .13-.04.25-.11.34-.07.09-.14.16-.23.2-.09.04-.19.07-.3.09l-.06.01v.26h2.54v-.26l-.05-.02c-.09-.03-.19-.06-.28-.1a.506.506 0 0 1-.22-.17.457.457 0 0 1-.11-.22c-.01-.08-.01-.14-.02-.19-.01-.08-.02-.17-.02-.26v-5.48c0-.19 0-.35.01-.48 0-.13.01-.23.04-.29.03-.09.06-.16.11-.2.05-.05.1-.09.16-.11a.64.64 0 0 1 .16-.06c.05-.01.1-.02.13-.03l.05-.01v-.25h-2.51v.25l.05.01c.02.01.06.02.13.03zM299.16-113.13c.13-.04.26-.08.38-.11.13-.04.25-.08.38-.13l.05-.02-.05-1.4h-.25l-.02.04a1.538 1.538 0 0 1-.29.52c-.04.04-.1.1-.18.17-.07.06-.17.12-.3.18-.16.07-.32.13-.48.17-.17.04-.34.07-.49.09-.15.02-.29.04-.4.04-.12 0-.2.01-.24.01-.13 0-.3-.01-.51-.02a3.36 3.36 0 0 1-1.43-.47c-.26-.15-.51-.36-.75-.63-.1-.1-.2-.23-.3-.39-.11-.16-.21-.34-.3-.55-.09-.21-.17-.46-.24-.72-.06-.27-.09-.58-.09-.92a3.806 3.806 0 0 1 .4-1.73c.11-.21.23-.4.36-.55a3.213 3.213 0 0 1 1.11-.86c.26-.12.51-.21.74-.26.24-.05.45-.08.63-.09.2-.01.34-.02.44-.02.29 0 .62.03.96.1.33.06.62.19.85.38.15.12.26.25.34.38l.19.34h.24l.05-1.46-.05-.01c-.31-.09-.59-.16-.84-.21-.25-.05-.47-.1-.67-.13-.2-.03-.38-.05-.55-.06-.17-.01-.33-.01-.49-.01-.16 0-.37.01-.63.02-.27.02-.57.06-.89.14-.33.08-.68.21-1.04.38-.36.18-.71.42-1.04.74-.3.28-.54.58-.71.88-.17.3-.31.59-.39.87-.09.28-.15.54-.17.78-.02.24-.04.43-.04.57 0 .44.06.86.17 1.25.12.4.28.77.51 1.11.22.34.5.64.82.9.32.26.69.47 1.09.63.2.08.41.15.62.19.2.04.39.07.56.1.17.02.32.04.46.04h.32c.32 0 .68-.03 1.08-.07.41-.05.77-.12 1.08-.2z\" /><g><path style=\"fill:#00517e\" d=\"M246.96-107.34h.07c.01 0 .03.01.06.01l.14.04.15.06a.4.4 0 0 1 .12.1c.09.11.13.25.14.42v4.09c0 .19 0 .36-.02.51-.01.14-.03.27-.04.39-.02.11-.04.22-.07.31-.03.09-.06.19-.1.28-.05.12-.1.22-.16.3-.06.08-.1.14-.12.18-.07.07-.15.15-.25.23-.1.08-.23.15-.37.22-.15.07-.32.12-.51.17-.19.05-.41.07-.65.07-.36 0-.71-.06-1.05-.19-.34-.13-.62-.34-.85-.64-.11-.14-.2-.29-.26-.44a2.69 2.69 0 0 1-.14-.46c-.03-.16-.05-.32-.06-.48-.01-.16-.01-.33-.01-.52v-3.57c.01-.16.01-.3.02-.42 0-.11.02-.21.06-.29.04-.08.09-.14.17-.2.08-.06.21-.11.38-.15l.05-.01.02-.25h-2.5v.25l.05.01c.26.07.37.14.42.18.1.07.15.17.16.29.01.14.02.33.02.58v3.64c-.01.38 0 .68.04.9.03.22.08.43.14.61.08.22.19.44.34.66.15.22.36.42.61.6s.56.32.93.44c.36.11.8.17 1.31.17s.95-.06 1.31-.19c.36-.12.66-.28.9-.47.24-.19.42-.41.55-.65.13-.23.23-.46.29-.69.04-.15.07-.3.09-.45.02-.15.03-.29.04-.42 0-.13.01-.24.01-.34v-3.85c0-.2 0-.36.01-.46.01-.1.04-.19.09-.27.06-.09.13-.16.22-.19.09-.04.2-.07.31-.1l.05-.01v-.25h-2.09l-.02.25zM256.62-107.36l.06.01c.26.06.43.14.5.24.08.11.12.23.14.37.01.08.02.16.02.24-.01.09-.01.14-.01.17v4.68l-5.24-5.94-.02-.02h-1.73v.26l.06.01c.11.01.21.04.31.07.08.03.15.09.21.19.05.07.07.16.07.25V-100.7c0 .1 0 .23-.02.38-.01.14-.05.25-.12.33-.07.1-.16.16-.25.18-.11.03-.19.04-.22.05l-.05.01-.02.27h2.12v-.27l-.06-.01c-.16-.04-.3-.09-.4-.16a.566.566 0 0 1-.19-.35c-.01-.06-.01-.12-.02-.18v-5.8l6.09 6.89h.21v-6.99c.01-.17.01-.33.02-.48 0-.14.07-.25.2-.35.04-.03.09-.06.15-.09a.96.96 0 0 1 .25-.07l.05-.01.02-.26h-2.12v.25zM262.29-99.85a.533.533 0 0 1-.33-.39c-.01-.08-.02-.14-.02-.19-.01-.09-.02-.17-.02-.26V-106.65c0-.13.02-.22.04-.29.03-.09.06-.16.11-.2.05-.05.1-.09.15-.11a.64.64 0 0 1 .16-.06c.05-.01.09-.02.13-.03l.05-.01v-.25h-2.51v.25l.05.01c.03.01.08.02.14.03a.759.759 0 0 1 .36.18c.05.05.1.13.14.22.03.08.04.18.05.28 0 .11.01.27.01.46v5.18c-.01.26-.01.46-.02.61 0 .13-.04.24-.1.34a.57.57 0 0 1-.23.19c-.09.04-.2.07-.3.09l-.06.01v.27h2.54v-.26l-.05-.01c-.1-.03-.19-.06-.29-.1zM269.28-107.36l.05.01c.08.02.16.05.25.07.07.02.12.07.17.14.02.03.04.07.04.1 0 .04.01.07.01.09 0 .07-.01.14-.03.22-.02.07-.04.15-.07.22-.02.07-.05.13-.07.18-.02.05-.03.08-.04.09l-2.09 4.8-1.99-4.8-.09-.23c-.03-.07-.05-.14-.07-.22-.03-.11-.04-.2-.04-.27 0-.1.03-.18.09-.24.07-.06.2-.11.4-.15l.06-.01v-.26h-2.55v.25l.05.01c.1.02.17.05.23.07.05.02.12.07.19.13.1.08.17.17.21.27.05.11.08.18.1.22.05.11.11.23.15.34.05.11.1.23.14.35l2.76 6.54.02.04h.21l2.94-6.69c.06-.13.13-.29.21-.47.07-.17.15-.32.23-.45.08-.12.16-.2.23-.25.08-.05.19-.09.34-.11l.06-.01v-.25h-2.09v.27zM277.51-100.83c-.03.1-.06.19-.09.28a.553.553 0 0 1-.38.34c-.13.02-.19.02-.22.02-.08.01-.15.02-.22.02h-1.29c-.28-.01-.52-.02-.73-.03-.2-.01-.34-.04-.41-.1-.03-.03-.06-.05-.07-.07-.02-.03-.04-.06-.05-.07-.05-.12-.08-.25-.09-.39 0-.15-.01-.29-.02-.42v-2.22h1.67c.17 0 .34.01.51.04.15.02.26.11.35.25.01.04.03.08.05.13.02.04.04.11.06.19l.01.05h.26v-2.05h-.25l-.02.05a.63.63 0 0 0-.03.13c-.01.05-.03.11-.06.17a.94.94 0 0 1-.12.18c-.05.05-.11.09-.19.12a.93.93 0 0 1-.29.05h-1.95v-2.76h2.08c.15 0 .28.01.4.04.11.03.2.1.27.24.03.05.05.1.07.16.02.06.04.12.05.18l.01.05.26.02.02-1.37h-5v.27h.07c.02 0 .06 0 .11.01s.11.02.17.05c.06.03.12.07.17.12.05.04.09.11.12.2.03.08.05.17.05.27v5.68c-.01.11-.01.22-.01.33v.33c-.01.11-.04.21-.08.3-.04.08-.11.15-.22.21-.04.03-.08.04-.13.06-.06.02-.11.03-.17.05l-.05.01-.02.26h5.67v-1.41h-.26l-.01.03zM285.95-99.8a.76.76 0 0 1-.19-.12.551.551 0 0 1-.17-.2c-.05-.08-.08-.14-.1-.16-.13-.19-.25-.39-.36-.6l-1.55-2.85c.04-.02.09-.04.15-.07.09-.05.21-.12.33-.2.12-.09.24-.19.36-.31s.23-.27.31-.43c.13-.26.2-.55.2-.87 0-.3-.05-.56-.14-.76-.09-.2-.17-.35-.24-.44-.15-.2-.32-.35-.51-.45-.19-.1-.39-.18-.61-.23-.21-.05-.43-.08-.65-.09-.22-.01-.43-.01-.64-.01h-2.9v.27h.07c.01 0 .04 0 .09.01.05.01.11.03.17.05.05.02.11.05.17.09.05.04.1.1.13.16.04.07.06.17.06.27 0 .12.01.27.01.46v5.44c-.01.18-.01.34-.02.46 0 .12-.02.21-.05.27-.02.07-.06.13-.11.18-.05.05-.11.08-.16.11a.64.64 0 0 1-.16.06c-.06.02-.09.02-.1.02h-.07v.28h2.56v-.26l-.05-.01c-.16-.05-.28-.08-.35-.12a.551.551 0 0 1-.18-.14.394.394 0 0 1-.12-.2c-.01-.08-.02-.16-.03-.27-.01-.06-.01-.13-.01-.2s0-.15-.01-.22v-2.45h.23c.23.01.49.01.77-.01.14-.01.29-.02.42-.04l1.46 2.69c.08.15.18.31.28.48.11.18.24.33.39.44.09.08.19.14.3.18.1.04.19.07.28.09.09.02.17.03.25.03h.69v-.25l-.04-.02c-.04-.01-.09-.03-.16-.06zm-4.86-7.1h.8c.22-.01.44 0 .65.02.21.02.41.09.6.21.21.13.36.3.45.51.09.21.14.44.14.67 0 .18-.02.34-.05.46-.04.16-.08.23-.11.27-.08.16-.19.28-.31.37-.13.09-.27.17-.42.22-.16.05-.32.09-.49.11-.17.02-.33.03-.5.03h-.78l.02-2.87zM291.09-103.75l-.49-.32-.66-.37c-.19-.12-.4-.25-.6-.4-.2-.14-.34-.32-.43-.54a.737.737 0 0 1-.06-.27c-.01-.08-.01-.14-.01-.18 0-.21.04-.39.11-.55a1.237 1.237 0 0 1 .74-.65c.17-.06.36-.09.55-.09.27 0 .5.04.67.12.18.08.33.18.44.29.11.12.2.24.26.36.06.13.12.25.16.34l.02.04h.24v-1.44l-.05-.02c-.08-.03-.18-.07-.3-.11-.12-.05-.26-.09-.41-.13-.15-.04-.32-.07-.5-.1a4.258 4.258 0 0 0-.95-.04c-.14.01-.29.03-.46.08-.17.04-.35.11-.53.21-.18.1-.36.23-.52.4-.11.11-.23.28-.35.51-.12.23-.19.54-.19.92 0 .12.01.26.04.41.02.15.07.31.14.46.07.16.18.32.32.49.14.17.33.33.56.49.07.05.15.1.23.15.07.04.14.08.22.13l.72.43c.22.13.43.27.62.42.18.15.33.34.43.58.02.05.04.13.08.23.03.1.04.22.04.37 0 .21-.03.38-.08.51s-.1.24-.14.31c-.16.26-.38.45-.64.57-.26.12-.55.18-.86.18-.19 0-.36-.02-.51-.06-.15-.04-.28-.09-.39-.15-.11-.06-.2-.13-.28-.2-.08-.07-.13-.14-.18-.2-.04-.06-.08-.13-.11-.21-.04-.08-.09-.18-.15-.33l-.02-.04-.25-.02v1.43l.04.02c.18.08.42.18.71.28.29.1.68.16 1.16.16.08 0 .2 0 .36-.01.15-.01.33-.03.52-.07.19-.04.38-.11.59-.21.2-.1.41-.24.6-.43a2.32 2.32 0 0 0 .62-.99c.05-.16.08-.31.09-.44.01-.13.02-.24.02-.32 0-.64-.24-1.2-.71-1.63-.14-.13-.3-.25-.47-.37zM296.28-99.85a.598.598 0 0 1-.23-.17.435.435 0 0 1-.1-.22c-.01-.08-.01-.14-.02-.19-.02-.09-.02-.17-.02-.26V-106.65c.01-.13.02-.22.04-.29.03-.09.06-.16.11-.2.05-.05.1-.09.16-.11a.64.64 0 0 1 .16-.06c.05-.01.09-.02.13-.03l.05-.01v-.25h-2.51v.25l.05.01c.03.01.08.02.14.03.05.01.11.03.18.06.06.03.12.07.18.12.06.05.1.13.13.22.03.08.04.18.05.28 0 .11.01.27.01.46v5.18c-.01.26-.01.46-.02.61 0 .13-.04.24-.11.34-.07.09-.14.16-.23.19-.09.04-.19.07-.3.09l-.06.01v.27h2.54v-.26l-.05-.01c-.09-.03-.19-.06-.28-.1zM297.36-106.25h.26l.01-.06c.01-.04.02-.11.04-.21.02-.09.07-.16.15-.24.08-.06.17-.11.27-.13.11-.03.28-.04.49-.05h1.56v6.29c0 .21-.03.38-.07.48-.05.11-.11.19-.2.25-.07.06-.14.09-.21.11-.09.02-.14.03-.17.04l-.04.01-.02.26h2.59v-.26l-.05-.01c-.14-.04-.25-.07-.32-.11a.862.862 0 0 1-.18-.14.76.76 0 0 1-.12-.19c-.03-.06-.04-.14-.05-.22-.01-.08-.01-.18-.01-.29v-6.2H303c.25 0 .44.03.58.1.13.06.21.22.25.47l.01.06h.25v-1.34h-6.74v1.38zM309.94-107.61v.26l.06.01c.09.01.18.03.25.05.05.01.1.06.15.15.03.04.05.08.05.11 0 .04.01.07.01.09 0 .1-.03.2-.09.31-.07.11-.12.21-.17.3l-1.55 2.53-1.62-2.53c-.06-.08-.12-.18-.18-.3a.677.677 0 0 1-.09-.32c0-.08.02-.14.05-.19.04-.05.08-.09.13-.11.05-.03.1-.05.15-.05.07-.01.08-.01.09-.01h.07v-.27h-2.55v.25l.05.01c.08.02.16.05.21.07.05.03.1.06.14.09.04.03.08.08.12.13.04.06.09.12.14.18.04.05.07.1.1.15.03.05.07.1.1.14l2.26 3.51v2.36c0 .21 0 .38-.02.48-.01.09-.06.18-.13.27-.07.07-.14.12-.21.14-.08.03-.18.05-.29.06l-.06.01-.02.27h2.53v-.27l-.06-.01c-.04-.01-.11-.02-.2-.03a.398.398 0 0 1-.23-.12.533.533 0 0 1-.19-.36 3.64 3.64 0 0 1-.03-.45v-2.3l2.26-3.65.22-.33c.07-.11.15-.19.25-.24.06-.04.12-.07.18-.08.07-.02.12-.03.14-.04l.05-.02v-.25h-2.07z\" /></g><g><path style=\"fill:#00517e\" d=\"M141.48-121.27h.05c.06 0 .17.01.33.03.15.02.31.07.49.15.18.08.35.2.51.34.16.14.29.35.37.62.08.18.12.41.12.69v17.48c0 .39-.05.71-.16.94-.12.41-.34.69-.64.84-.31.15-.65.29-1.03.39l-.04.01v.46h6.89v-.46l-.04-.01c-.38-.11-.74-.23-1.07-.38-.33-.14-.56-.41-.73-.83-.08-.16-.14-.32-.17-.48-.03-.15-.05-.33-.05-.53v-8.5h4.78c.48.02.97.05 1.47.09.48.04.85.26 1.12.65.1.1.17.24.22.41.06.19.12.43.17.71l.01.04h.47v-5.47h-.48v.05c0 .02 0 .08-.05.27-.04.16-.08.32-.14.48-.07.19-.17.36-.29.52-.13.17-.3.3-.5.38-.23.1-.5.16-.81.17-.31.01-.71.01-1.2.01h-4.78v-8.02h5.7c.43.02.88.07 1.32.14.43.07.78.31 1.04.72.1.16.19.33.25.5.06.18.12.34.16.5l.01.04h.46l.03-3.37v-.05h-13.81v.47zM174.15-121.31v.05h.05c.01 0 .06.01.19.05.12.03.25.07.4.11.15.04.3.1.45.18.15.08.28.18.38.3.26.33.4.75.42 1.25.01.49.01.93.01 1.31v10.11c0 .55-.01 1.03-.05 1.43-.03.39-.07.77-.13 1.1-.05.32-.12.61-.2.88-.08.26-.18.53-.28.8-.15.35-.3.64-.46.86-.14.22-.27.41-.36.52-.19.21-.43.43-.72.66-.3.23-.66.44-1.07.62-.42.19-.9.35-1.44.49-.54.13-1.17.2-1.85.2-1.02 0-2.02-.18-2.98-.55-.96-.37-1.78-.98-2.44-1.83-.31-.42-.56-.85-.74-1.27-.18-.42-.31-.86-.39-1.32-.08-.45-.14-.91-.16-1.37-.02-.46-.03-.95-.03-1.45v-9.98c.02-.42.04-.81.04-1.17.01-.32.07-.61.17-.87.1-.24.28-.45.52-.62.25-.18.63-.33 1.12-.45l.03-.01.04-.44H158v.43l.03.01c.6.17 1.01.34 1.22.53.3.22.48.53.52.91.04.4.06.94.06 1.64v10.17c-.02 1.07.01 1.89.1 2.5.08.61.21 1.18.38 1.68.21.59.53 1.19.94 1.8.41.6.97 1.15 1.66 1.64.68.48 1.53.88 2.54 1.19 1 .31 2.22.46 3.6.46 1.41 0 2.62-.17 3.61-.51.99-.33 1.82-.77 2.47-1.3.65-.53 1.16-1.13 1.51-1.77.36-.65.63-1.29.8-1.89.11-.43.19-.83.24-1.22.05-.44.08-.81.09-1.16.01-.33.02-.66.02-.93v-10.76c0-.56.01-1 .03-1.31.02-.3.11-.57.28-.82.18-.28.41-.48.67-.58.28-.11.58-.21.88-.28l.03-.01v-.43h-5.53v.42zM208.15-102.91c-.08.26-.16.51-.25.77-.08.24-.22.45-.43.66-.22.22-.48.36-.76.4-.36.05-.52.06-.6.06-.23.04-.45.06-.66.06h-3.6c-.8-.02-1.47-.05-2.05-.08-.58-.03-.99-.14-1.24-.32a.8.8 0 0 1-.22-.24c-.04-.07-.09-.14-.14-.22-.17-.34-.25-.73-.26-1.15-.01-.47-.03-.84-.05-1.17v-6.33h4.82c.49 0 .97.04 1.43.11.46.07.82.34 1.08.8.04.11.09.22.14.35.05.13.11.32.17.56l.01.04h.46v-5.44h-.46l-.01.03c-.02.06-.04.16-.08.34-.04.16-.09.33-.17.5-.08.17-.2.35-.36.52-.15.17-.35.3-.6.38-.27.11-.55.16-.85.16h-5.59v-7.99h5.96c.41 0 .8.04 1.16.12.35.08.63.32.85.74.08.15.15.3.2.46.06.2.11.36.14.5l.01.03.46.04.06-3.46v-.05h-13.65v.44h.05c.06 0 .18.01.34.03.16.02.33.07.5.15.18.08.35.2.51.34.16.14.29.35.37.61.1.24.15.51.15.8v15.86c-.02.29-.03.6-.01.91.01.31.01.62-.02.93-.02.33-.1.63-.23.9-.14.27-.35.48-.67.64-.12.08-.26.14-.41.18-.16.05-.32.09-.49.13l-.03.01-.04.46h15.52v-3.63h-.46v.06zM230.61-121.71v.44l.04.01c.77.17 1.27.41 1.49.74.22.33.36.69.41 1.09.04.23.06.46.05.7-.01.21-.02.39-.02.46v13.46l-14.89-16.87-.01-.02h-4.62v.44l.04.01c.31.04.61.11.89.2.28.09.49.28.66.6.14.22.22.49.23.78.01.28.02.65.02 1.25v15.86c0 .29-.02.64-.05 1.08-.03.43-.15.76-.36 1-.22.31-.49.5-.79.57-.26.06-.5.12-.63.14l-.03.01-.04.47h5.6v-.47l-.04-.01c-.48-.1-.87-.27-1.17-.48-.29-.21-.49-.58-.6-1.09a7.69 7.69 0 0 1-.05-.5c-.01-.17-.02-.41-.02-.72v-15.86l17.2 19.46.01.02h.36v-19.38c.02-.4.04-.79.05-1.17l.01-.17c.02-.41.23-.78.62-1.08.12-.1.27-.19.45-.28.18-.08.43-.16.73-.21l.04-.01.04-.44h-5.62zM183.03-121.27l.04.01c.35.06.69.16 1.02.31.31.14.54.4.68.79.13.42.19 1.13.19 2.17v18.67c0 .89-.05 1.76-.16 2.6-.1.84-.45 1.62-1.03 2.33-.21.27-.47.54-.78.81-.27.23-.47.39-.53.43l-.04.03.27.46.04-.02c.54-.25.97-.46 1.28-.63.29-.16.56-.32.81-.51.7-.44 1.25-.93 1.64-1.45.4-.54.69-1.03.89-1.51.2-.49.33-.96.39-1.42.05-.44.09-.83.11-1.16V-118c0-.88.04-1.52.11-1.95.07-.42.33-.76.78-1.01.14-.08.27-.14.39-.19.11-.04.31-.08.6-.12l.04-.01v-.44h-6.73v.45z\" /></g><g><path style=\"fill:#00517e\" d=\"M109.76-132.08v-1.19c-.54-.06-1.14-.09-1.81-.11h-.04v-1.34h-1.32v1.34h-.04c-.68.02-1.27.06-1.82.11v1.19c.54-.06 1.14-.1 1.82-.11h.05v3.82h1.32v-3.82h.05c.66.02 1.25.06 1.79.11z\" /><path style=\"fill-rule:evenodd;clip-rule:evenodd;fill:#00517e\" d=\"M95.04-129.32c.04.01.09.01.13.01 1.2-.19 3.08-1.43 3.84-2.41.01-.02.03-.04.03-.06a.154.154 0 0 0-.12-.19c-1.65 0-3.6 1.03-4.16 2.08-.01.03-.02.05-.03.08-.05.22.09.44.31.49zM87.6-122.14c.05 0 .1-.01.14-.02 0 0 .01 0 .01-.01.05-.02.09-.05.13-.08 1.12-1.48 1.48-3.23 1.59-4.99 0-.09-.07-.16-.16-.16h-.03c-.04.01-.07.02-.09.05-.21.23-.46.48-.63.7-.86 1.06-1.44 2.23-1.44 3.63 0 .2.02.39.07.58.06.17.22.3.41.3zM84.48-110.93c.07.04.15.08.24.08.05 0 .1-.01.15-.03h.01a.45.45 0 0 0 .19-.14c.04-.06.07-.13.08-.2.19-1.59-.63-4.76-1.52-5.65a.15.15 0 0 0-.11-.04h-.03c-.04.01-.07.02-.09.05-.01.02-.02.03-.03.05-.4 1.67-.4 3.3.33 4.89.18.39.45.72.78.99zM92.59-124.3c.01-.02.01-.04.01-.05v-.01c0-.09-.06-.15-.14-.17-1.74-.03-3.64 1.36-4.11 2.62-.01.04-.02.08-.02.12 0 .04 0 .08.01.11.05.19.22.33.43.33.03 0 .06-.01.09-.02 1.26-.32 3.12-1.75 3.73-2.93zM90.75-126.85c.05.02.09.02.14.02h.01c.05 0 .1-.02.14-.04 1.44-1.01 2.27-2.48 2.88-4.04a.158.158 0 0 0-.1-.19c-.01 0-.02-.01-.03-.01-.03 0-.07 0-.09.02-.26.14-.55.3-.78.44-1.08.7-1.95 1.59-2.35 2.85-.05.18-.09.36-.1.55 0 .19.11.35.28.4zM95.79-128.18c.01-.01.01-.03.02-.05v-.01a.154.154 0 0 0-.12-.17c-1.64-.18-3.55.97-4.1 2.12-.01.04-.03.07-.03.11 0 .04 0 .07.01.11.03.18.18.33.37.34.03 0 .06 0 .09-.01 1.2-.19 3.08-1.38 3.76-2.44zM86.78-116.06c.05 0 .09-.01.13-.03 1.26-.58 2.61-2.5 3.12-3.86 0-.01.01-.03.01-.04v-.05c-.02-.07-.08-.11-.15-.12-1.41.04-3.32 2.06-3.56 3.63v.04c0 .04.01.07.02.11.01.03.03.06.04.1.07.14.22.22.39.22zM85.02-116.93c.09.12.22.19.38.18.05 0 .1-.01.15-.03.01 0 .01 0 .01-.01.08-.03.14-.09.19-.15.01-.01.01-.02.02-.04.63-1.32.79-3.96.29-5.46-.02-.07-.09-.13-.17-.12h-.03c-.04.01-.07.03-.1.06-.01.01-.01.02-.02.02-.16.28-.31.53-.44.8-.6 1.25-.91 2.56-.6 3.95.07.28.18.55.32.8zM85.83-111.02c.03.08.07.15.14.21.08.06.17.1.28.1.05 0 .1-.01.15-.03h.01c.04-.02.08-.04.12-.07 1.12-.92 2.01-3.33 2.12-4.6 0-.04-.02-.08-.05-.12a.166.166 0 0 0-.12-.05c-1.57.47-2.95 2.92-2.65 4.56zM84.78-105.41c.14.15.31.27.49.36a.465.465 0 0 0 .38.02c.08-.03.15-.07.2-.14a.55.55 0 0 0 .07-.09c.02-.04.03-.07.05-.11.01-.04.02-.08.02-.13-.17-1.7-1.62-4.21-2.68-5.23a.16.16 0 0 0-.11-.05h-.04c-.01 0-.02 0-.03.01-.06.01-.1.05-.13.1-.01.01-.01.03-.02.04-.05 1.42.22 2.73.85 3.96.22.46.59.88.95 1.26zM95.97-91.76c.07-.03.13-.07.18-.13.03-.03.05-.07.07-.1.05-.08.07-.18.07-.27 0-.15-.06-.29-.16-.38a.435.435 0 0 0-.07-.06c-1.51-1.04-4.34-1.65-5.92-1.49-.06.02-.11.05-.14.1-.01.02-.03.05-.03.07-.01.02-.01.05-.01.08 0 .02.01.04.01.07 0 .01.01.03.02.04l.03.03c.89.86 1.92 1.5 3.08 1.92.75.27 1.52.42 2.32.29.19-.06.37-.11.55-.17zM87.8-99.73c.05 0 .1-.01.15-.03.08-.03.15-.07.2-.14a.55.55 0 0 0 .07-.09c.02-.04.03-.07.05-.11.01-.04.02-.09.02-.13v-.05c0-.04-.02-.08-.03-.11-.93-1.87-2.45-3.09-4.19-4.15-.02-.01-.04-.02-.06-.02h-.04c-.01 0-.02 0-.03.01a.17.17 0 0 0-.13.1c-.01.01-.01.03-.02.05v.05c.47 1.69 1.32 3.13 2.79 4.16.35.25.76.4 1.22.46zM86.82-105.31c.03.03.06.06.1.09.02.01.03.02.05.03.07.04.15.06.24.06.06 0 .12-.01.17-.03.08-.03.15-.07.2-.14l.01-.01c.86-1.15 1.13-3.66.93-5.15 0-.03-.01-.06-.03-.09a.078.078 0 0 0-.04-.04.166.166 0 0 0-.12-.05h-.04c-.01 0-.02 0-.03.01-.02.01-.04.02-.05.03-1.62 1.36-2.02 3.88-1.44 5.2.01.04.03.07.05.09zM91.14-95.49c.03-.01.05-.01.08-.02.08-.03.15-.08.2-.14a.55.55 0 0 0 .07-.09.585.585 0 0 0 .06-.24v-.05a.42.42 0 0 0-.04-.16c-.01-.03-.04-.06-.05-.08-1.17-1.29-3.84-2.71-5.31-2.79h-.05a.22.22 0 0 0-.13.1c-.01.02-.01.03-.02.05v.07c0 .02.01.03.01.05 0 .01.01.02.01.03.79 1.46 2.95 3.29 4.66 3.32.16-.02.33-.03.51-.05zM89.01-100.23c.01.03.03.05.05.07.03.04.06.07.1.09.02.01.03.02.05.03.05.03.1.04.16.05.03 0 .05.01.08.01a.483.483 0 0 0 .37-.17.55.55 0 0 0 .07-.09c0-.01.01-.02.01-.03.11-.27.2-.55.25-.83.21-1.12.07-2.24-.16-3.35-.05-.26-.12-.52-.2-.8 0-.02-.01-.04-.02-.05-.01-.02-.02-.03-.04-.05-.01-.01-.02-.02-.03-.02-.03-.02-.05-.03-.08-.03h-.04c-.01 0-.02 0-.03.01-.04.01-.08.04-.11.07-.01.02-.02.03-.03.04-.84 1.17-1.17 2.48-.87 3.88.08.4.26.79.47 1.17zM92.56-95.97c.01.01.02.01.03.02.05.03.1.05.16.05.02 0 .05.01.08.01h.05c.04-.01.08-.01.12-.03.08-.03.15-.08.2-.14a.55.55 0 0 0 .07-.09c.01-.03.03-.06.03-.09.29-1.37-.45-3.67-1.31-5.02l-.03-.03c-.01-.01-.02-.02-.03-.02-.03-.02-.05-.02-.08-.03h-.04c-.01 0-.02 0-.03.01-.05.01-.09.05-.12.09-.84 1.5-.54 4 .9 5.27zM96.79-92.91c.08.04.16.06.25.06h.04c.05 0 .1-.02.15-.03.09-.03.17-.08.23-.15.03-.03.05-.07.08-.11.04-.08.07-.18.07-.27-.17-1.83-1.24-3.22-2.39-4.63a.435.435 0 0 0-.07-.06c-.03-.01-.05-.02-.08-.03h-.04c-.01 0-.03 0-.04.01-.06.01-.11.05-.14.1l-.03.06c-.52 1.65.56 4.21 1.97 5.05zM101.38-90.42c-.04-.03-.09-.05-.13-.07-1.72-.59-4.58-.42-6.07.15-.04.02-.08.04-.11.08-.01.02-.03.05-.03.07 0 .01 0 .02-.01.03v.05c0 .02.01.05.01.06.01.01.01.03.02.04.01.02.02.03.03.04.01.01.03.02.04.03 1.09.59 2.25.93 3.48 1.02.8.06 1.58 0 2.31-.35.17-.08.33-.17.48-.28.02-.02.04-.03.06-.05.03-.03.05-.07.07-.1a.552.552 0 0 0-.09-.66c0-.01-.03-.04-.06-.06z\" /><path style=\"fill-rule:evenodd;clip-rule:evenodd;fill:#00517e\" d=\"M112.48-90.69c1.71-.15 3.59-2.91 3.32-4.83v-.01c-.01-.03-.02-.05-.03-.08a.243.243 0 0 0-.14-.1c-.01 0-.03 0-.04-.01h-.05c-.03 0-.06.01-.08.03-.02.01-.03.02-.04.03-1.44 1.29-2.8 2.58-3.16 4.56-1.09.28-3.05.82-4.99 1.52-1.94-.7-3.9-1.24-4.99-1.52-.36-1.98-1.72-3.27-3.16-4.56-.01-.01-.03-.02-.04-.03-.03-.01-.05-.02-.08-.03h-.04c-.01 0-.03 0-.04.01-.06.01-.11.05-.14.1-.01.02-.03.05-.03.08v.01c-.27 1.92 1.61 4.68 3.32 4.83 1.18.25 2.76.79 4.33 1.45-1.7.66-3.26 1.44-4.09 2.26l.62.72c.76-.75 2.48-1.73 4.36-2.59 1.88.86 3.6 1.84 4.36 2.59l.61-.72c-.83-.82-2.39-1.6-4.09-2.26 1.54-.67 3.12-1.21 4.31-1.45zM115.52-131.71c.76.97 2.63 2.21 3.83 2.41.04 0 .09 0 .13-.01.22-.05.36-.28.31-.5-.01-.03-.02-.05-.03-.08-.55-1.05-2.51-2.08-4.15-2.08-.09.02-.14.11-.12.19 0 .03.02.05.03.07zM126.76-122.17s.01 0 .01.01c.04.02.09.02.14.02.19 0 .35-.13.41-.3.05-.19.07-.39.07-.58 0-1.4-.58-2.57-1.44-3.63-.18-.22-.42-.47-.63-.7a.193.193 0 0 0-.09-.05h-.03c-.09 0-.16.07-.16.16.11 1.76.47 3.51 1.59 4.99.04.03.08.06.13.08zM129.37-111.23c.01.08.04.14.08.2.05.06.11.11.19.14h.01c.05.02.09.03.15.03.09 0 .17-.03.24-.08.34-.27.6-.61.78-1 .73-1.59.73-3.22.33-4.89-.01-.02-.02-.04-.03-.05a.405.405 0 0 0-.09-.05H131c-.05 0-.08.02-.11.04-.89.9-1.71 4.07-1.52 5.66zM125.75-121.34c.21 0 .38-.14.43-.33.01-.04.01-.07.01-.11 0-.04-.01-.08-.02-.12-.47-1.27-2.37-2.66-4.11-2.62-.08.02-.14.08-.14.17v.01c0 .02.01.04.01.05.62 1.18 2.47 2.61 3.72 2.94.03.01.07.01.1.01zM123.48-126.87c.04.02.09.04.14.04h.01c.04 0 .09 0 .14-.02.17-.06.28-.22.28-.39-.01-.19-.05-.37-.11-.55-.4-1.26-1.27-2.15-2.35-2.85a7.05 7.05 0 0 0-.77-.44c-.03-.02-.06-.02-.1-.02-.01 0-.02 0-.03.01-.08.02-.12.11-.1.19.62 1.55 1.45 3.03 2.89 4.03zM122.59-125.72c.19-.02.34-.17.37-.34.01-.04.01-.07.01-.11 0-.04-.01-.08-.03-.11-.55-1.15-2.46-2.3-4.1-2.12-.07.02-.12.09-.12.17v.01c0 .02.01.03.02.05.68 1.06 2.56 2.25 3.76 2.46.03-.01.06 0 .09-.01zM124.5-120.04c0 .01-.01.03-.01.04v.01c0 .02 0 .03.01.04.5 1.35 1.86 3.27 3.11 3.86a.425.425 0 0 0 .52-.18.3.3 0 0 0 .04-.1c.01-.04.02-.07.02-.11v-.04c-.24-1.57-2.14-3.6-3.56-3.63-.06 0-.11.04-.13.11zM128.77-116.94a.4.4 0 0 0 .19.15c.01 0 .01 0 .01.01a.452.452 0 0 0 .53-.15c.15-.24.25-.51.31-.8.3-1.39 0-2.7-.6-3.95-.13-.26-.28-.51-.44-.8 0-.01-.01-.02-.01-.02a.207.207 0 0 0-.1-.06h-.03c-.08 0-.15.05-.17.12-.5 1.49-.34 4.13.29 5.46.01.01.02.03.02.04zM128.13-110.74c.05.02.09.03.15.03.11 0 .2-.04.28-.1.07-.05.11-.12.14-.21.3-1.63-1.08-4.09-2.65-4.56-.05 0-.09.02-.12.05-.03.03-.05.07-.05.12.11 1.28 1 3.68 2.12 4.6.03.03.07.05.11.07h.02zM131.38-110.79h-.04a.16.16 0 0 0-.11.05c-1.07 1.02-2.52 3.53-2.68 5.23 0 .05 0 .09.02.13.01.04.03.08.04.11.02.04.04.07.07.09a.483.483 0 0 0 .58.12c.18-.09.35-.21.49-.36.37-.38.73-.8.97-1.26.63-1.23.9-2.54.85-3.96-.01-.02-.01-.03-.02-.04-.03-.05-.07-.09-.13-.1-.02 0-.03 0-.04-.01zM124.52-94.11a.243.243 0 0 0-.14-.1c-1.58-.15-4.42.45-5.92 1.49-.03.02-.05.04-.07.06-.09.1-.15.23-.16.38 0 .1.03.19.07.27.02.04.04.07.07.1.05.06.11.1.18.13.17.06.35.11.54.14.8.14 1.57-.01 2.32-.29a8.384 8.384 0 0 0 3.08-1.92l.03-.03c.01-.01.01-.02.02-.04s.01-.04.01-.07c0-.03 0-.05-.01-.08.01.01 0-.02-.02-.04zM130.75-104.42c-.01-.02-.01-.03-.02-.05-.03-.05-.07-.09-.13-.1-.01 0-.02-.01-.03-.01h-.04c-.02 0-.04.01-.06.02-1.73 1.06-3.25 2.27-4.19 4.15-.01.04-.03.07-.03.11v.05c0 .04 0 .09.02.13.01.04.03.08.05.11.02.03.04.07.07.09.05.06.12.11.2.14.05.02.09.02.14.03.46-.05.88-.2 1.25-.46 1.47-1.03 2.32-2.47 2.79-4.16v-.03c-.02 0-.02-.01-.02-.02zM126.95-105.29c.06.06.12.11.2.14.05.02.11.03.17.03.09 0 .17-.02.24-.06.02-.01.03-.02.05-.03.04-.03.07-.06.1-.09l.06-.09c.58-1.32.17-3.84-1.44-5.2-.02-.01-.03-.02-.05-.03-.01 0-.02-.01-.03-.01h-.04c-.04.01-.08.02-.11.05l-.04.04c-.01.03-.02.05-.03.09-.22 1.49.05 4 .92 5.16-.01-.01 0 0 0 0zM128.59-98.92c-.01-.02-.01-.03-.02-.05-.03-.05-.07-.09-.13-.1h-.05c-1.47.08-4.14 1.5-5.31 2.79-.02.03-.04.05-.05.08-.02.05-.04.11-.05.16v.05c0 .05.01.09.02.13.01.04.03.07.04.11.02.04.04.07.07.09.05.06.12.11.2.14.03.01.05.01.08.02.18.02.35.03.52.03 1.7-.03 3.87-1.86 4.66-3.32 0-.01.01-.02.01-.03 0-.01.01-.03.01-.05v-.05zM124.63-100.27c0 .01.01.02.01.03.02.03.04.06.07.09a.483.483 0 0 0 .37.17c.03 0 .05 0 .08-.01a.75.75 0 0 0 .16-.05c.02-.01.04-.02.05-.03.04-.02.07-.06.1-.09.02-.02.04-.05.05-.07.2-.38.39-.77.48-1.17.3-1.41-.04-2.71-.87-3.88-.01-.01-.02-.03-.03-.04-.03-.03-.06-.06-.11-.07-.01 0-.02-.01-.03-.01h-.04c-.03 0-.06.01-.08.03-.01.01-.02.01-.03.02-.01.01-.03.03-.04.05-.01.02-.02.04-.02.05-.08.29-.14.55-.2.8-.23 1.11-.37 2.23-.16 3.35.04.28.13.56.24.83zM122.75-101.34c-.01 0-.02-.01-.04-.01h-.04c-.03.01-.06.01-.08.03-.01.01-.02.02-.03.02l-.03.03c-.86 1.35-1.6 3.65-1.31 5.02l.03.09c.02.03.04.07.07.09.05.06.12.11.2.14l.11.03h.05c.03 0 .05 0 .08-.01a.75.75 0 0 0 .16-.05c.01-.01.02-.01.03-.02 1.44-1.26 1.74-3.77.9-5.28-.01-.04-.05-.07-.1-.08zM119.56-98.11c-.01 0-.03-.01-.04-.01h-.04c-.03 0-.06.01-.08.03-.03.02-.05.04-.07.06-1.14 1.4-2.22 2.8-2.39 4.63 0 .1.03.19.07.27.02.04.05.07.08.11a.541.541 0 0 0 .37.18h.04c.09 0 .17-.02.25-.06 1.41-.84 2.48-3.4 1.99-5.05-.01-.02-.01-.04-.03-.06-.05-.05-.09-.09-.15-.1z\" /><path style=\"fill-rule:evenodd;clip-rule:evenodd;fill:#00517e\" d=\"M119.48-90.18c-.01-.03-.02-.05-.03-.07a.254.254 0 0 0-.1-.08c-1.49-.57-4.35-.74-6.07-.15a.539.539 0 0 0-.21.14.552.552 0 0 0-.09.66c.02.04.05.07.08.1.02.02.04.04.06.05.15.1.31.2.47.28.73.35 1.52.41 2.32.35 1.23-.09 2.39-.42 3.48-1.02.01-.01.03-.02.04-.03.01-.01.03-.03.03-.04.01-.01.01-.03.02-.04.01-.02.01-.04.01-.06v-.05c0-.02 0-.03-.01-.04z\" /><g><path style=\"fill:#00517e\" d=\"M109.77-115.81h-.53v1.13c0 .41-.18.68-.53.84-.3.13-.61.14-.61.14v.91c.3 0 .57-.04.79-.13v4.93h.53v-5.28s0-.01.01-.01c.37-.41.35-.92.34-1.03v-1.5zM110.31-115.37h3.14v.91h-3.14zM110.31-109.15h3.14v.91h-3.14z\" /><g><path style=\"fill:#00517e\" d=\"M101.68-111.54h.55v.9h-.55zM101.68-113.27h.55v.9h-.55zM105.31-111.54h.54v.9h-.54zM104.36-113.27h.54v.9h-.54zM102.64-111.54h.54v.9h-.54z\" /><path style=\"fill:#00517e\" d=\"M116.43-124.62c-.2 0-.41.01-.6.04a10.303 10.303 0 0 1-6.82-1.48c-.1-.06-.2-.13-.3-.2-.09-.06-.27-.19-.27-.19a2.056 2.056 0 0 0-2.38 0s-.18.13-.26.19c-.1.06-.2.13-.3.2-.21.13-.42.26-.64.37-1.44.77-3.08 1.2-4.82 1.2-.46 0-.92-.03-1.36-.09-.2-.03-.39-.04-.6-.04a4.21 4.21 0 0 0-4.21 4.21v8.65c-.01.16-.01.33-.01.5 0 7.78 5.52 14.26 12.86 15.75.17.02.35.04.53.04.17 0 .34-.01.51-.03 7.32-1.47 12.83-7.91 12.89-15.65v-9.24c-.01-2.35-1.9-4.23-4.22-4.23zm-10.18 8.81v1.24h-.94v.47h.94v6.14h-.4v-1.85h-.54v1.87h-.41v-1.87h-.54v1.85h-.4v-6.14h.94v-.47h-.94v-.83h.94v-.4h.41v.4h.54v-.4h.4zm-1.84-4.98.38-.76.37.75v.01l.84.12-.6.58v.01l.14.83-.75-.39-.75.39.14-.82v-.01l-.6-.59.83-.12zm-3.87 2.42.38-.76.37.75v.01l.84.12-.6.58-.01.01.14.83-.75-.4-.75.4.14-.83v-.01l-.61-.59.85-.11zm-2.3 4 .38-.76.37.75v.01l.84.12-.6.58-.01.01.14.83-.74-.39h-.01l-.75.39.14-.82v-.01l-.61-.59.85-.12zm.5 5.79-.76.39.14-.82v-.01l-.6-.59.83-.12h.01l.38-.76.37.75v.01l.84.12-.6.58-.01.01.14.83-.74-.39zm3.15 4.28-.74-.39h-.01l-.75.39.14-.82v-.01l-.61-.59.83-.12h.01l.38-.76.37.75v.01l.84.12-.6.59h-.01l.15.83zm1.69-10.28h-.95v.47h.95v4.29h-.95v.48h.95v.83h-.95v.56h-.4v-.56h-.96v-.83h.96v-.48h-.96v-4.29h.96v-.47h-.96v-.83h.96v-.4h.4v.4h.95v.83zm2.24 12.58-.75-.4-.75.4.14-.83v-.01l-.61-.59.83-.12h.01l.37-.76.37.75v.01l.84.12-.6.58-.01.01.16.84zm13.88-9.26c0 7.24-5.14 13.26-11.97 14.64-.16.02-.32.03-.48.03v-29.14c.41 0 .81.18 1.12.4.08.06.16.12.25.17.09.06.19.12.28.18.19.12.39.24.59.35 1.34.71 3.04 1.08 4.66 1.08.43 0 .88-.06 1.3-.11.18-.03.53-.04.71-.04 2.11 0 3.51 1.62 3.59 3.71.01.01-.05 8.66-.05 8.73z\" /><path style=\"fill:#00517e\" d=\"M104.36-111.54h.54v.9h-.54zM105.31-113.27h.54v.9h-.54zM102.64-113.27h.54v.9h-.54z\" /></g><g><path style=\"fill:#00517e\" d=\"m110.58-120.66-.81-.11-.01-.02-.35-.72-.37.74-.81.11.59.58-.14.8.73-.38.72.38-.14-.8zM114.04-117.82l.58-.57-.81-.11-.36-.74-.37.74-.81.11.59.58v.02l-.14.78.73-.38.72.38-.14-.8zM116.35-114.03l.57-.56-.8-.11-.01-.02-.36-.72-.36.74-.81.11.59.58-.14.8.72-.38.73.38-.14-.8zM117.04-109.98l-.81-.12-.01-.01-.36-.72-.36.73-.81.12.59.57-.14.81.72-.38.73.38-.14-.81zM114.86-105.94l-.81-.11-.01-.02-.36-.72-.36.74-.81.11.59.57-.14.81.72-.38.73.38-.14-.81zM110.39-102.96l.57-.56-.81-.12-.36-.74-.36.74h-.02l-.79.12.59.57-.01.02-.13.79.72-.39.73.39-.14-.81z\" /></g></g></g></g></symbol>"
});
var result = _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default().add(symbol);
/* harmony default export */ __webpack_exports__["default"] = (symbol);

/***/ }),

/***/ 5307:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3465);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2594);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__);


var symbol = new (_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default())({
  "id": "logo_en",
  "use": "logo_en-usage",
  "viewBox": "0 0 388 90",
  "content": "<symbol xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 388 90\" id=\"logo_en\"><path d=\"M271.39 30.59c.18-.36.39-.67.61-.93.22-.25.42-.47.61-.63.42-.35.85-.63 1.28-.83.44-.2.86-.35 1.25-.43.41-.09.76-.14 1.08-.16.33-.02.57-.03.75-.03.5 0 1.04.05 1.62.16.56.1 1.05.32 1.45.64.25.2.44.42.56.64l.32.58h.42l.08-2.47-.09-.02c-.52-.15-1-.27-1.42-.36-.42-.09-.8-.16-1.13-.22-.33-.05-.65-.08-.93-.1-.28-.01-.56-.02-.83-.02-.27 0-.62.01-1.06.04-.45.03-.96.11-1.52.24-.55.14-1.14.35-1.76.65-.62.3-1.21.72-1.76 1.25-.51.48-.91.98-1.2 1.48-.29.51-.51 1-.66 1.47-.15.47-.24.92-.28 1.32-.04.41-.06.72-.06.97 0 .74.1 1.45.29 2.12.2.67.48 1.31.86 1.87.38.57.84 1.08 1.38 1.52.55.44 1.17.8 1.85 1.07.35.14.7.25 1.05.32.34.07.66.12.95.16.29.04.55.06.78.07.22 0 .4.01.53.01.54 0 1.16-.04 1.83-.13.67-.08 1.28-.2 1.81-.34.22-.06.43-.13.64-.19.21-.07.43-.14.65-.22l.08-.03-.08-2.37h-.43l-.02.08-.15.38c-.06.14-.17.31-.34.5-.07.07-.18.17-.31.28-.13.11-.29.21-.5.31-.26.12-.53.22-.82.29-.29.07-.57.12-.82.16-.26.04-.49.06-.68.07-.2.01-.33.01-.41.01-.22 0-.51-.01-.85-.04-.35-.02-.73-.1-1.14-.22-.41-.13-.84-.32-1.28-.57-.43-.25-.87-.61-1.28-1.06-.16-.17-.33-.39-.52-.66-.18-.26-.35-.58-.51-.93-.16-.36-.29-.77-.4-1.22-.11-.46-.16-.98-.16-1.55 0-.62.07-1.17.2-1.66.12-.48.28-.92.47-1.27zM285.46 40.13l-.1-.02c-.15-.02-.28-.06-.4-.12a.507.507 0 0 1-.26-.26.52.52 0 0 1-.08-.2c-.01-.06-.01-.11-.01-.14 0-.12.03-.28.11-.46.08-.2.17-.44.28-.72l1.12-2.61h4.73l1.04 2.51c.06.17.14.33.2.48.07.15.14.31.2.46.04.18.05.27.05.32 0 .02 0 .07-.01.13 0 .05-.02.11-.07.18-.07.15-.18.25-.31.31-.15.06-.31.1-.48.13l-.09.01-.04.45h4.37v-.39l-.07-.03c-.14-.07-.31-.15-.52-.26-.19-.1-.38-.31-.57-.62-.04-.06-.09-.14-.13-.25-.05-.11-.1-.21-.15-.33l-.14-.33c-.05-.11-.09-.19-.13-.27l-4.85-11.41-.03-.07h-.33l-5.31 11.86c-.12.28-.24.53-.35.74-.1.2-.22.36-.33.47a1.222 1.222 0 0 1-.8.4l-.11.02v.45h3.58v-.43zm1.19-5.69 1.9-4.24 1.8 4.24h-3.7zM293.44 29.11h.45l.02-.1c.01-.06.03-.18.07-.36.02-.14.11-.28.26-.4.13-.1.28-.17.45-.21.19-.04.47-.07.83-.08h2.64v10.66c0 .36-.04.64-.12.82-.08.18-.19.32-.33.42-.11.09-.23.15-.35.18-.15.03-.24.06-.28.07l-.08.03-.04.44h4.39v-.44l-.09-.02c-.24-.06-.42-.12-.53-.19-.12-.07-.22-.14-.31-.23-.09-.11-.16-.21-.2-.32-.04-.11-.06-.23-.08-.37-.01-.14-.02-.31-.02-.5V28H303c.41 0 .74.06.98.17.22.11.36.37.43.8l.01.1h.43V26.8h-11.42v2.31zM309.81 40.11h-.12c-.01 0-.05 0-.15-.03-.07-.02-.16-.05-.25-.09-.1-.05-.19-.11-.28-.19a.825.825 0 0 1-.22-.29c-.06-.14-.09-.31-.1-.53-.01-.22-.01-.52-.01-.89v-4.24h7.28v4.2c0 .32 0 .6-.01.84-.01.23-.02.4-.04.5-.02.07-.05.14-.08.2-.03.07-.06.1-.07.12-.09.12-.2.21-.33.27-.14.06-.29.1-.45.13l-.1.02-.04.45h4.22v-.45l-.09-.02a2.39 2.39 0 0 1-.45-.14 1.033 1.033 0 0 1-.55-.64 3 3 0 0 1-.06-.47c-.01-.14-.02-.27-.02-.4v-9.23c0-.16 0-.39.01-.68.01-.28.03-.48.08-.62s.11-.24.2-.33c.1-.09.19-.16.28-.21a.77.77 0 0 1 .26-.1c.1-.02.17-.04.22-.05l.08-.03v-.42h-4.17v.45h.12c.02 0 .07.01.16.03.09.02.19.04.28.09.1.04.2.1.28.18.09.08.15.17.2.3.05.13.07.3.07.51v4.34h-7.28v-3.54c0-.32.01-.61.03-.84.02-.22.06-.39.11-.51a.54.54 0 0 1 .19-.25c.1-.07.19-.12.27-.16.09-.04.17-.06.25-.08.09-.02.15-.04.2-.05l.08-.03v-.41h-4.19v.42l.08.03c.04.01.11.03.22.05.09.02.18.04.27.09.09.04.18.1.27.18.08.08.16.19.21.32.06.16.1.33.1.5.01.17.01.43-.01.8v8.91c0 .31 0 .58-.01.82-.01.23-.02.4-.06.5-.05.13-.12.25-.2.34-.09.09-.19.16-.28.21-.11.05-.2.08-.29.11-.11.03-.16.03-.17.03h-.12v.47h4.19v-.49zM333.82 38.64c.42-.47.75-.94.98-1.41.24-.48.42-.93.54-1.36.12-.43.19-.82.22-1.18.02-.35.04-.64.04-.87 0-.67-.07-1.29-.21-1.85-.14-.56-.3-1.05-.49-1.48-.2-.42-.41-.8-.63-1.11-.21-.31-.42-.57-.61-.76-.18-.2-.43-.42-.73-.68-.31-.26-.68-.51-1.11-.73-.44-.23-.94-.42-1.5-.57-.56-.16-1.21-.23-1.9-.23-.81 0-1.55.1-2.19.3-.64.2-1.2.44-1.68.72-.48.28-.89.58-1.22.9-.33.32-.59.59-.79.83-.14.18-.31.41-.49.69-.18.28-.36.62-.52 1a7.607 7.607 0 0 0-.58 2.97c0 .75.08 1.43.25 2.03.17.59.38 1.12.64 1.59.25.46.52.85.81 1.17.29.31.54.56.76.76.7.58 1.47 1.01 2.27 1.26.81.25 1.67.38 2.56.38 1.13 0 2.16-.18 3.06-.53.93-.37 1.77-.98 2.52-1.84zm-5.4 1.19c-.66 0-1.25-.1-1.75-.29-.51-.19-.94-.43-1.31-.69-.36-.27-.66-.55-.89-.84-.23-.3-.41-.55-.54-.75a6.16 6.16 0 0 1-.87-2.14c-.06-.31-.11-.61-.12-.87-.02-.27-.03-.48-.03-.65 0-.66.07-1.26.2-1.78s.3-.99.5-1.38c.2-.39.42-.73.66-1 .24-.28.47-.51.69-.68.31-.25.63-.45.96-.6.33-.15.65-.26.94-.34.29-.08.56-.12.8-.14.24-.02.43-.03.56-.03.54 0 1.02.06 1.43.19.42.12.8.28 1.11.45.32.17.59.36.8.56.22.2.4.38.54.54.16.22.34.49.54.8.2.31.37.69.53 1.12.15.43.27.93.35 1.47a8.17 8.17 0 0 1-.05 2.5c-.04.31-.14.67-.27 1.07-.18.52-.44 1-.74 1.42-.31.43-.67.8-1.08 1.1-.41.3-.87.54-1.36.7-.5.17-1.04.26-1.6.26zM337.74 27.3a1.185 1.185 0 0 1 .61.32c.1.09.17.21.23.36.05.13.08.32.09.57.01.26.02.56.02.9v8.01c0 .35 0 .68-.01.99-.01.32-.02.53-.03.62-.04.21-.1.38-.18.5-.09.12-.18.22-.29.3-.1.07-.21.13-.32.16-.11.04-.21.06-.28.07l-.1.02v.45h9.92V38.2h-.44l-.02.08c-.06.21-.12.38-.18.5a.825.825 0 0 1-.5.47c-.13.05-.27.08-.41.1-.14.02-.29.03-.43.04-.14.01-.28.01-.41.01h-2.64l-.76-.03c-.15-.01-.31-.05-.45-.13-.22-.13-.36-.3-.4-.53-.05-.26-.08-.63-.09-1.11v-8.18c.01-.33.02-.63.04-.9.01-.26.03-.45.05-.56.04-.15.11-.26.2-.35.1-.1.19-.17.28-.22.1-.05.19-.09.27-.1.1-.02.18-.04.22-.05l.09-.02v-.42h-4.4v.41l.08.03c.05.02.13.04.24.06zM348.95 27.3c.1.02.2.05.3.1.11.05.2.12.31.21.09.09.17.21.22.37.05.14.08.31.08.49.01.19.01.45.01.78v8.78c-.01.44-.02.78-.03 1.03-.01.23-.06.42-.18.58-.11.16-.24.27-.39.33-.16.07-.33.12-.51.15l-.1.02v.45h4.3v-.44l-.08-.03c-.15-.05-.32-.1-.48-.17a.945.945 0 0 1-.38-.29.795.795 0 0 1-.18-.37c-.02-.14-.02-.24-.03-.32-.02-.14-.03-.29-.03-.44v-9.28c0-.32 0-.59.01-.81.01-.21.02-.38.06-.49.04-.15.11-.27.18-.35.08-.09.17-.15.26-.19.1-.05.19-.08.27-.1.09-.02.17-.04.22-.05l.09-.02v-.42h-4.24v.42l.09.02c.05 0 .13.02.23.04zM366.19 40.52c.22-.06.43-.13.64-.19.22-.07.43-.14.65-.22l.08-.03-.08-2.37h-.43l-.03.08-.15.38c-.06.14-.18.31-.34.5-.07.07-.18.17-.31.28-.13.11-.29.21-.5.31-.26.12-.54.22-.82.29-.29.07-.57.12-.82.16-.26.04-.48.06-.68.07-.2.01-.34.01-.41.01-.22 0-.51-.01-.86-.04-.34-.02-.73-.1-1.14-.22-.42-.13-.85-.32-1.28-.57-.43-.25-.86-.61-1.28-1.06a5.384 5.384 0 0 1-1.02-1.59c-.16-.36-.29-.77-.4-1.22-.11-.46-.16-.98-.16-1.55 0-.62.07-1.17.2-1.66s.29-.92.48-1.28.39-.67.61-.93c.21-.25.42-.47.61-.63.41-.35.85-.63 1.28-.83.45-.2.86-.35 1.26-.43.41-.09.75-.14 1.07-.16.33-.02.58-.03.75-.03.5 0 1.05.05 1.62.16.56.1 1.05.32 1.45.64.26.2.45.42.57.64l.32.58h.41l.08-2.47-.09-.02a19.8 19.8 0 0 0-1.42-.36c-.42-.09-.8-.16-1.13-.22-.34-.05-.65-.08-.93-.1-.28-.01-.56-.02-.83-.02-.26 0-.62.01-1.06.04-.45.03-.96.11-1.51.24-.56.14-1.15.35-1.76.65-.62.3-1.21.72-1.76 1.25-.5.48-.91.98-1.2 1.48-.29.51-.52 1-.66 1.47-.15.47-.25.92-.28 1.32-.04.41-.06.72-.06.97 0 .74.1 1.45.29 2.12.2.67.48 1.31.86 1.87.37.57.84 1.08 1.39 1.52.54.44 1.16.8 1.85 1.07.35.14.69.25 1.04.32.34.07.66.12.95.16.28.04.55.06.78.07.23 0 .4.01.54.01.54 0 1.16-.04 1.82-.13.66-.08 1.27-.19 1.8-.33z\" /><g><path d=\"M277.77 50.32h.12c.01 0 .05.01.1.02l.24.07c.08.03.16.06.25.11.08.04.15.1.2.16.15.18.22.42.23.7.01.31.01.58.01.79v6.13a11.24 11.24 0 0 1-.1 1.53c-.03.19-.07.37-.12.52-.05.16-.11.32-.17.47-.09.2-.18.37-.26.51-.1.14-.16.24-.21.3-.11.12-.25.25-.43.39-.17.13-.38.25-.63.37-.25.11-.54.21-.86.29-.32.08-.69.12-1.1.12-.61 0-1.21-.11-1.78-.33-.57-.22-1.05-.58-1.45-1.08-.19-.24-.33-.5-.43-.75-.11-.25-.19-.52-.23-.78-.05-.26-.08-.54-.1-.82-.01-.27-.02-.57-.02-.88v-6.05c.01-.27.02-.51.03-.71.01-.19.04-.35.1-.5.06-.13.15-.24.29-.34.14-.1.36-.19.65-.26l.08-.02.03-.43h-4.24v.42l.09.02c.44.12.63.23.71.31.17.12.26.28.28.49.02.24.04.57.04.99v6.17c-.02.64.01 1.16.06 1.53.05.38.13.73.23 1.04.13.37.32.74.58 1.11.26.37.6.71 1.03 1.02.43.3.95.55 1.57.74.62.18 1.36.28 2.21.28.86 0 1.61-.11 2.22-.32.61-.21 1.12-.48 1.52-.8.4-.33.71-.7.94-1.1.22-.39.39-.78.49-1.17.06-.25.11-.5.14-.75.03-.26.05-.49.06-.71.01-.22.01-.41.01-.57v-6.53c0-.34 0-.61.02-.79.01-.17.06-.32.15-.45.1-.16.22-.26.37-.32.16-.06.33-.12.52-.17l.09-.02v-.42h-3.54l.01.47zM294.13 50.3l.1.02c.44.09.73.23.85.41.13.19.21.39.23.62.02.13.03.27.03.41-.01.15-.01.24-.01.28v7.93l-8.88-10.06-.03-.04h-2.93v.44l.1.01c.18.02.36.06.53.12.14.05.25.15.35.33.08.12.12.26.12.43.01.18.01.43.01.75v9.63c0 .17-.01.38-.03.65-.02.24-.08.42-.2.56-.12.17-.26.27-.43.31-.19.04-.32.07-.38.08l-.09.02-.04.45h3.59v-.45l-.1-.02c-.28-.06-.5-.15-.68-.28-.16-.11-.26-.32-.32-.6l-.03-.3v-9.82l10.31 11.67h.35V52.01c.01-.28.02-.55.04-.82.01-.23.12-.42.34-.6.07-.06.15-.11.25-.16s.24-.09.42-.12l.09-.02.04-.43h-3.59v.44zM303.74 63.02a.973.973 0 0 1-.39-.29.688.688 0 0 1-.17-.37c-.02-.14-.03-.24-.03-.32-.02-.15-.03-.29-.03-.44v-9.28c0-.32 0-.59.01-.81.01-.21.03-.38.06-.49.04-.15.11-.26.18-.34.08-.09.17-.15.26-.19.1-.05.19-.08.27-.1.09-.02.16-.04.22-.05l.09-.02v-.43h-4.25v.42l.09.02c.06.01.13.03.24.05a1.167 1.167 0 0 1 .6.31c.09.09.17.22.23.38.05.14.07.3.08.48 0 .19.01.45.01.78v8.78c-.01.43-.02.77-.03 1.03-.01.23-.06.41-.18.58-.11.16-.25.27-.39.33-.16.07-.33.12-.51.16l-.1-.01v.45h4.3v-.44l-.09-.02c-.15-.05-.31-.11-.47-.17zM315.57 50.3l.09.02.42.12c.12.04.21.11.28.23.04.06.06.12.06.16a1.61 1.61 0 0 1-.03.52c-.03.13-.07.25-.11.37-.04.12-.08.22-.12.3-.04.09-.06.13-.06.16l-3.54 8.13-3.36-8.14-.16-.38c-.05-.12-.09-.24-.11-.37-.05-.18-.07-.33-.07-.45 0-.17.05-.3.16-.4.12-.11.35-.19.68-.25l.1-.02v-.43h-4.32v.43l.09.02c.16.04.29.08.38.12.09.04.2.11.32.22.16.14.29.3.36.46.08.18.13.31.16.38.09.19.18.38.26.57.08.19.17.39.24.6l4.68 11.08.03.08h.35l4.98-11.33c.1-.22.22-.48.35-.79.12-.29.25-.55.39-.76.13-.2.27-.34.39-.42.14-.08.33-.15.57-.19l.1-.02v-.43h-3.54v.41zM329.52 61.35c-.05.16-.1.32-.15.47-.05.13-.12.25-.24.36-.12.13-.26.19-.41.22-.22.03-.31.04-.37.04-.13.02-.26.04-.38.04h-2.18c-.47-.01-.89-.03-1.24-.05-.33-.01-.57-.08-.7-.17a.453.453 0 0 1-.12-.12c-.03-.05-.06-.1-.08-.12-.09-.2-.14-.43-.15-.66-.01-.26-.02-.5-.03-.71V56.9h2.83c.29 0 .58.02.86.07.25.04.44.18.59.43.02.07.05.14.09.22.03.07.06.18.1.33l.02.09h.44v-3.48h-.43l-.03.08c-.02.04-.03.11-.05.22-.01.09-.05.18-.1.28-.05.1-.11.2-.2.3-.08.09-.19.16-.33.21-.15.06-.31.08-.48.08h-3.3v-4.67H327c.25 0 .48.02.68.07.18.04.34.17.46.4.05.08.08.17.11.27s.06.2.08.3l.02.08.44.04.04-2.32h-8.46v.45h.12c.03 0 .1 0 .19.02.09.01.18.04.28.08.09.05.2.12.29.2.08.07.15.18.2.34.05.14.08.29.08.45v9.62c-.01.19-.02.37-.01.56 0 .18 0 .37-.01.55-.02.19-.06.36-.13.51-.08.14-.19.26-.37.36-.07.05-.14.08-.22.1-.09.03-.19.05-.29.08l-.09.02-.04.45h9.61V61.3h-.44l-.02.05zM343.8 63.09c-.11-.04-.22-.11-.32-.2-.12-.09-.21-.2-.29-.33-.08-.14-.14-.23-.17-.27-.22-.31-.42-.66-.61-1.02l-2.63-4.82c.07-.03.15-.07.25-.13.16-.08.35-.2.55-.34.2-.15.41-.32.6-.52.21-.2.39-.45.53-.73.23-.44.34-.93.34-1.47 0-.51-.08-.95-.24-1.29-.16-.34-.29-.59-.4-.75a2.75 2.75 0 0 0-.87-.77c-.32-.17-.66-.31-1.03-.4-.36-.09-.73-.13-1.11-.15-.37-.01-.73-.02-1.08-.02h-4.91v.45h.12c.02 0 .07.01.15.02.08.02.18.04.28.08.09.03.19.09.28.16.09.07.16.17.21.28.06.12.09.28.11.47.01.2.02.46.02.77v9.22c-.01.31-.02.57-.03.79 0 .2-.03.36-.08.46-.04.12-.11.22-.19.3-.08.08-.18.14-.28.19-.1.05-.19.08-.27.09-.1.03-.15.03-.16.03h-.12v.47h4.34v-.44l-.09-.02c-.27-.08-.47-.14-.6-.2a.928.928 0 0 1-.3-.23.771.771 0 0 1-.2-.34c-.02-.13-.04-.28-.05-.45-.01-.11-.02-.22-.02-.34 0-.12-.01-.26-.02-.38V57.1c.13 0 .26.01.38.01.38.02.83.02 1.31-.02l.71-.06 2.47 4.56c.14.26.3.53.47.82.18.3.4.55.65.75.16.14.33.24.5.31.16.07.33.12.48.15.15.04.3.06.42.06h1.17v-.43l-.07-.03c.02-.04-.07-.07-.2-.13zm-8.22-12.02h1.36c.37-.01.74 0 1.11.04.36.04.7.16 1.01.36.35.22.6.5.76.86.16.36.24.74.24 1.13 0 .31-.03.57-.09.78-.07.27-.14.39-.18.46-.14.27-.32.48-.53.63-.21.16-.45.28-.71.37-.26.09-.54.15-.83.18-.28.03-.57.05-.85.05h-1.32l.03-4.86zM352.51 56.41l-.83-.54-1.11-.63c-.32-.2-.67-.43-1.02-.68-.33-.23-.58-.54-.73-.91-.06-.17-.1-.33-.11-.46-.01-.14-.02-.24-.02-.31 0-.35.06-.66.19-.94.13-.27.3-.5.51-.68.21-.18.46-.32.75-.42.29-.1.61-.15.94-.15.45 0 .84.07 1.14.2.31.13.55.3.74.49.19.2.34.4.44.61.11.22.2.42.28.58l.03.07h.4v-2.45l-.08-.03c-.14-.05-.31-.11-.5-.19-.21-.08-.43-.15-.69-.21a7.97 7.97 0 0 0-1.91-.25c-.13 0-.31 0-.54.02-.23.01-.5.05-.79.13-.29.07-.59.19-.9.36-.31.16-.61.39-.88.68-.19.19-.38.47-.6.86-.21.39-.32.92-.32 1.56 0 .21.02.44.06.69.04.25.12.52.24.78s.3.54.54.83c.23.28.55.56.94.83.12.09.26.17.38.25.12.07.24.14.37.22l1.23.73c.38.22.73.46 1.05.72.31.25.55.58.72.99.03.09.08.22.13.39.04.17.07.38.07.62 0 .35-.05.65-.14.87-.09.22-.17.41-.23.52-.28.44-.65.76-1.09.96-.45.2-.94.3-1.46.3-.32 0-.61-.04-.86-.1a2.672 2.672 0 0 1-1.13-.59c-.13-.12-.23-.24-.3-.34-.06-.1-.13-.22-.19-.35-.07-.13-.16-.31-.26-.56l-.03-.07-.42-.03v2.43l.07.03c.31.14.71.3 1.2.47.5.18 1.16.27 1.96.27.14 0 .34-.01.6-.02.25-.01.55-.06.88-.13.32-.07.65-.19 1-.36a4.251 4.251 0 0 0 1.7-1.56c.16-.28.29-.56.37-.83.09-.27.14-.52.16-.74.02-.23.03-.41.03-.55 0-1.09-.41-2.02-1.21-2.77-.21-.2-.47-.41-.77-.61zM361.3 63.02a.945.945 0 0 1-.38-.29.795.795 0 0 1-.18-.37c-.02-.14-.02-.24-.03-.32-.03-.15-.03-.29-.03-.44v-9.28c0-.32 0-.59.01-.81.01-.21.03-.38.06-.49.04-.15.11-.26.18-.34.08-.09.17-.15.26-.19.1-.05.19-.08.27-.1.09-.02.16-.04.21-.05l.09-.02v-.43h-4.25v.42l.09.02c.05.01.13.03.24.05.09.02.19.05.3.1.1.05.2.12.3.21.1.09.17.22.23.38.05.14.07.3.08.48.01.19.01.45.01.78v8.78c-.01.43-.02.77-.03 1.03-.01.23-.06.41-.18.58-.11.16-.24.27-.39.33-.15.07-.33.12-.51.16l-.1.02v.45h4.3v-.44l-.08-.02c-.14-.08-.31-.14-.47-.2zM363.14 52.18h.45l.02-.1.06-.35c.03-.15.11-.28.26-.4.13-.11.28-.18.46-.22.19-.04.47-.07.83-.08h2.64v10.66c0 .36-.04.64-.12.82-.08.18-.19.32-.33.43-.11.09-.23.15-.35.18-.15.04-.24.06-.28.07l-.07.02-.04.44h4.39v-.44l-.09-.02c-.24-.06-.42-.12-.54-.19-.11-.07-.21-.15-.3-.24-.09-.1-.16-.21-.2-.32-.04-.11-.07-.23-.08-.37-.01-.14-.01-.31-.01-.5v-10.5h2.87c.42 0 .75.06.99.17.22.1.36.37.43.8l.02.1h.43v-2.27h-11.42v2.31zM384.44 49.87v.44l.1.01c.16.02.31.05.43.08.09.02.18.1.26.25.05.07.08.13.08.18 0 .07.01.12.01.15 0 .17-.05.35-.15.52-.11.19-.21.36-.3.51l-2.62 4.28-2.74-4.29c-.1-.14-.21-.31-.31-.52a1.2 1.2 0 0 1-.15-.55c0-.14.03-.24.09-.32a.77.77 0 0 1 .22-.19c.09-.04.17-.08.25-.09.11-.02.14-.02.15-.02h.12v-.45h-4.33v.43l.09.02c.14.04.27.08.36.12.09.05.18.1.24.16.07.06.14.13.2.22.07.1.16.2.24.31.06.09.12.17.17.25.06.09.11.17.17.24l3.83 5.95v3.99c0 .36-.01.64-.03.81-.02.16-.1.31-.22.46-.11.12-.23.2-.36.24-.14.05-.31.08-.49.1l-.1.01-.03.46h4.29v-.43l-.1-.02c-.06-.01-.18-.03-.34-.06a.733.733 0 0 1-.39-.2.985.985 0 0 1-.32-.61c-.03-.27-.05-.53-.05-.76v-3.88l3.83-6.18.37-.56c.11-.18.25-.32.42-.41.1-.07.2-.12.3-.14l.24-.06.08-.03v-.42h-3.51z\" /></g><g><path d=\"M99.12 26.75h.08c.11 0 .29.02.55.05.25.03.53.12.83.26.3.14.59.33.87.57.27.24.48.59.62 1.04.14.3.21.7.21 1.17v29.61c0 .66-.09 1.2-.27 1.59-.21.69-.57 1.17-1.08 1.42-.52.26-1.11.48-1.75.66l-.06.02v.78h11.67v-.78l-.06-.02c-.64-.18-1.25-.39-1.81-.64-.55-.24-.95-.7-1.24-1.41-.14-.27-.24-.55-.28-.81-.06-.26-.08-.56-.08-.89V44.99h8.1c.81.03 1.65.09 2.49.16.81.07 1.45.44 1.9 1.1.17.17.29.4.38.69.1.33.2.73.29 1.2l.01.06h.79v-9.26h-.81v.08c0 .03-.01.14-.08.46-.06.27-.14.54-.24.82-.12.32-.28.61-.5.89-.22.29-.5.5-.85.65-.38.17-.85.27-1.36.29-.53.02-1.21.02-2.03.02h-8.1V28.56h9.65c.73.03 1.49.12 2.23.24.72.12 1.31.52 1.76 1.22.17.28.32.56.42.84.11.3.2.58.26.85l.02.06h.79l.05-5.7v-.08H99.12v.76zM154.45 26.66v.08h.08c.01 0 .11.02.33.08.2.05.42.12.67.19.25.07.5.17.75.31.26.13.47.31.65.51.45.56.68 1.27.7 2.12.01.83.02 1.57.02 2.22V49.3c0 .93-.02 1.75-.08 2.43-.05.67-.12 1.3-.22 1.87-.08.54-.2 1.03-.34 1.49-.14.45-.31.9-.48 1.35-.26.6-.51 1.08-.77 1.46-.24.37-.45.69-.61.88-.32.36-.74.73-1.22 1.12-.5.39-1.11.75-1.81 1.06-.7.33-1.53.6-2.44.83-.92.23-1.98.34-3.14.34-1.73 0-3.43-.31-5.05-.93-1.63-.62-3.02-1.67-4.14-3.1-.53-.71-.95-1.43-1.25-2.15-.3-.71-.52-1.46-.66-2.23s-.23-1.55-.27-2.32c-.03-.78-.05-1.61-.05-2.46V32.02c.03-.71.06-1.38.08-1.98.02-.54.12-1.04.29-1.47.18-.41.47-.77.88-1.06.42-.3 1.06-.56 1.9-.77l.06-.01.07-.74h-11.3v.73l.06.01c1.01.28 1.71.58 2.06.9.51.37.81.89.88 1.54.07.68.1 1.59.1 2.78v17.23c-.03 1.81.02 3.19.16 4.24.14 1.04.36 2 .64 2.85.36 1 .89 2.02 1.59 3.04.69 1.01 1.64 1.94 2.8 2.77 1.14.82 2.59 1.5 4.3 2.02 1.7.52 3.75.78 6.1.78 2.38 0 4.45-.29 6.12-.86 1.68-.57 3.08-1.31 4.18-2.21 1.09-.9 1.96-1.91 2.56-2.99.61-1.1 1.07-2.18 1.35-3.2.19-.74.32-1.41.4-2.07.09-.74.14-1.38.16-1.96.01-.57.03-1.12.03-1.58V31.8c0-.96.02-1.7.05-2.21.03-.51.19-.97.47-1.38.31-.48.69-.81 1.14-.98.48-.19.98-.35 1.49-.48l.06-.01v-.73h-9.37v.65zM212.03 57.84c-.13.43-.27.87-.43 1.31-.14.4-.38.77-.73 1.12-.37.38-.81.6-1.29.67-.6.09-.88.11-1.02.11-.39.07-.76.1-1.11.1h-6.1c-1.36-.04-2.49-.08-3.47-.13-.97-.05-1.68-.23-2.1-.55-.17-.14-.3-.28-.38-.4-.07-.12-.15-.24-.23-.37-.28-.58-.43-1.24-.45-1.95-.02-.8-.05-1.43-.09-1.98V45.05h8.16c.84 0 1.65.06 2.42.19.77.12 1.39.58 1.83 1.36.07.18.15.38.24.59.09.22.19.54.29.95l.02.06h.79V39h-.78l-.02.06c-.03.1-.07.27-.14.57-.06.27-.16.55-.29.84-.14.29-.34.59-.6.89-.26.29-.6.51-1.01.64-.45.18-.93.26-1.44.26h-9.47V28.72h10.09c.69 0 1.35.07 1.96.21.59.14 1.06.55 1.44 1.25.14.25.26.51.34.78.11.34.18.61.24.85l.02.06.78.07.11-5.87v-.08h-23.12v.75h.08c.1 0 .3.02.58.05.27.03.56.12.85.26.3.14.59.33.87.57.27.24.48.59.62 1.04.17.41.26.87.26 1.36v26.86c-.03.5-.04 1.01-.02 1.53s.01 1.04-.03 1.57c-.03.55-.16 1.06-.39 1.52-.23.45-.6.81-1.13 1.09-.2.14-.43.24-.7.31-.26.08-.53.15-.83.22l-.06.02-.06.79h26.28v-6.16h-.78v.07zM250.07 25.99v.74l.07.01c1.3.28 2.15.7 2.52 1.25.38.56.61 1.18.69 1.84.07.39.1.77.08 1.18-.02.36-.03.65-.03.78v22.79l-25.22-28.57-.02-.03h-7.82v.74l.07.01c.53.07 1.04.18 1.51.34.47.15.83.48 1.11 1.01.24.38.37.82.39 1.32.02.47.03 1.1.03 2.11V58.4c0 .48-.03 1.09-.08 1.84-.06.73-.25 1.28-.61 1.7-.37.52-.83.84-1.34.96-.44.11-.84.2-1.07.24l-.06.01-.07.79h9.48v-.79l-.06-.01c-.81-.18-1.48-.45-1.98-.82-.5-.36-.83-.97-1.01-1.84-.03-.27-.06-.55-.08-.85-.01-.28-.03-.69-.03-1.22V31.53l29.12 32.96.02.03h.6V31.7l.09-1.98.01-.3c.03-.7.38-1.32 1.05-1.84.2-.17.45-.33.75-.47.31-.14.73-.26 1.24-.36l.06-.01.06-.74h-9.47zM169.5 26.73l.06.01c.59.1 1.17.28 1.72.52.53.24.92.68 1.16 1.34.22.71.32 1.91.32 3.67V63.9c0 1.5-.09 2.98-.27 4.4-.18 1.42-.76 2.75-1.75 3.95-.36.46-.79.92-1.32 1.38-.46.39-.79.67-.9.74l-.07.04.45.78.07-.03c.92-.42 1.65-.78 2.17-1.07.5-.27.95-.55 1.37-.86 1.18-.75 2.12-1.58 2.78-2.45.68-.91 1.17-1.74 1.51-2.56.34-.82.56-1.63.65-2.4.09-.75.15-1.41.19-1.97V32.28c0-1.49.06-2.57.19-3.31.12-.72.56-1.29 1.32-1.71.23-.13.45-.24.66-.32.18-.07.52-.14 1.02-.21l.07-.01v-.74h-11.4v.75z\" /></g><g><path d=\"M45.4 8.44V6.43c-.92-.1-1.92-.16-3.06-.19h-.08V3.96h-2.24v2.27h-.07c-1.15.03-2.16.1-3.08.19v2.01c.92-.1 1.93-.16 3.08-.19h.08v6.48h2.24V8.24h.08c1.14.03 2.14.1 3.05.2z\" /><path style=\"fill-rule:evenodd;clip-rule:evenodd\" d=\"M20.46 13.11c.07.02.15.02.22.01 2.04-.32 5.22-2.43 6.5-4.07a.37.37 0 0 0 .05-.11.275.275 0 0 0-.2-.33c-2.79 0-6.1 1.74-7.04 3.52-.02.04-.04.08-.05.13-.09.38.15.76.52.85zM7.87 25.26c.09 0 .17-.01.24-.04.01 0 .01 0 .02-.01.08-.03.15-.09.22-.14 1.9-2.5 2.5-5.48 2.69-8.45a.273.273 0 0 0-.27-.26h-.05c-.06.01-.11.04-.16.08-.36.38-.77.82-1.08 1.18-1.46 1.79-2.44 3.77-2.44 6.14 0 .33.03.66.12.99.11.3.38.51.71.51zM2.58 44.26c.12.07.25.13.4.13.09 0 .17-.01.25-.04.01 0 .01 0 .02-.01a.726.726 0 0 0 .46-.58c.32-2.69-1.06-8.07-2.57-9.57-.04-.06-.11-.09-.19-.09H.9c-.06.01-.12.04-.16.08l-.06.09c-.67 2.82-.67 5.59.56 8.28.32.68.77 1.25 1.34 1.71zM16.31 21.61c.01-.03.02-.06.02-.09v-.01c0-.15-.1-.26-.23-.29-2.94-.05-6.17 2.3-6.96 4.45-.02.06-.03.13-.03.21 0 .06.01.13.02.19.09.32.38.56.72.56.06 0 .11-.01.16-.03 2.11-.57 5.26-3 6.3-4.99zM13.2 17.29c.08.03.16.04.23.03h.02c.09 0 .16-.03.24-.07 2.44-1.7 3.85-4.21 4.88-6.84a.273.273 0 0 0-.17-.32c-.01-.01-.03-.01-.05-.01-.06-.01-.11 0-.16.03-.44.24-.94.5-1.31.75-1.83 1.19-3.3 2.7-3.98 4.83-.09.3-.16.61-.18.93 0 .31.18.58.48.67zM21.73 15.04c.01-.02.02-.05.03-.08v-.01a.273.273 0 0 0-.2-.29c-2.77-.3-6.02 1.64-6.95 3.59-.02.06-.04.12-.05.19-.01.06 0 .12.01.18.05.3.3.55.63.58.05 0 .11 0 .16-.01 2.04-.35 5.21-2.36 6.37-4.15zM6.47 35.56c.08 0 .16-.02.23-.05 2.13-.99 4.42-4.24 5.28-6.53 0-.02.01-.04.01-.07v-.02c0-.02-.01-.05-.01-.07-.03-.11-.14-.18-.25-.2-2.39.06-5.62 3.49-6.02 6.15 0 .02-.01.05-.01.08 0 .06.02.12.03.19.02.06.04.11.07.16.14.22.39.37.67.36zM3.5 34.08c.15.2.38.33.64.31.09 0 .17-.02.25-.05.01 0 .02 0 .02-.01.13-.06.24-.15.32-.26.02-.02.02-.04.03-.06 1.06-2.24 1.34-6.72.49-9.24a.303.303 0 0 0-.29-.21c-.02 0-.03 0-.05.01a.32.32 0 0 0-.16.09c-.01.01-.02.03-.03.04-.28.48-.53.9-.75 1.35-1.02 2.12-1.54 4.33-1.02 6.69.12.48.3.93.55 1.34zM4.86 44.09c.04.14.12.26.23.35a.714.714 0 0 0 .72.12c.01 0 .02 0 .02-.01.07-.03.14-.07.2-.12 1.9-1.56 3.41-5.64 3.6-7.8 0-.08-.03-.14-.08-.2a.28.28 0 0 0-.2-.08c-2.66.82-4.99 4.98-4.49 7.74zM3.09 53.6c.24.25.52.45.83.61.11.05.23.08.35.08.1 0 .19-.02.28-.05.13-.05.25-.13.34-.23.04-.05.08-.1.11-.16s.06-.12.08-.19a.78.78 0 0 0 .03-.22c-.28-2.88-2.74-7.13-4.55-8.86-.05-.04-.11-.08-.18-.08H.31c-.02 0-.04.01-.06.01-.1.02-.17.09-.22.17-.01.02-.02.05-.03.08-.09 2.4.37 4.62 1.44 6.7.41.79 1.03 1.49 1.65 2.14zM22.03 76.72a.84.84 0 0 0 .31-.22.93.93 0 0 0 .25-.64c0-.26-.1-.49-.27-.65-.04-.04-.08-.07-.12-.1-2.55-1.77-7.35-2.79-10.03-2.53-.1.03-.18.09-.24.17-.02.04-.04.08-.05.12-.01.04-.01.08-.01.13 0 .04.01.08.02.11l.03.06c.01.02.03.04.04.05 1.51 1.46 3.25 2.53 5.22 3.25 1.27.46 2.58.72 3.93.49.32-.06.62-.14.92-.24zM8.21 63.21c.08 0 .17-.02.25-.04.13-.05.25-.13.34-.23.04-.05.08-.1.11-.16s.06-.12.08-.19c.02-.07.03-.15.03-.22v-.08a.933.933 0 0 0-.07-.2c-1.57-3.17-4.15-5.23-7.09-7.02a.3.3 0 0 0-.1-.04h-.07c-.02 0-.04.01-.06.01-.1.02-.18.09-.22.17-.01.02-.02.05-.03.08 0 .01-.01.03-.01.04v.06c.79 2.86 2.24 5.3 4.72 7.04.63.44 1.33.69 2.12.78zM6.54 53.77c.05.06.11.11.17.16.03.02.06.04.09.05.12.06.26.1.41.1.1 0 .2-.02.28-.05.13-.05.25-.13.34-.23l.01-.01c1.45-1.96 1.92-6.2 1.57-8.72 0-.06-.02-.1-.05-.15-.02-.03-.04-.05-.06-.07a.337.337 0 0 0-.2-.09h-.06c-.02 0-.04.01-.06.01-.03.01-.07.03-.09.05-2.74 2.31-3.42 6.57-2.44 8.81.02.05.05.1.09.14zM13.85 70.4l.14-.03c.13-.05.25-.13.34-.23.05-.05.08-.1.11-.16s.06-.12.08-.19c.02-.07.03-.15.03-.23 0-.03 0-.06-.01-.08a.9.9 0 0 0-.08-.28c-.02-.05-.06-.1-.09-.14-1.98-2.19-6.5-4.59-8.99-4.73h-.03c-.02 0-.03.01-.05.01-.1.03-.18.09-.22.17-.02.03-.02.05-.03.08 0 .01 0 .03-.01.04v.07c.01.03.01.05.01.08.01.02.02.04.02.05 1.34 2.47 5 5.57 7.89 5.62.29.01.59-.02.89-.05zM10.24 62.37c.02.04.05.08.08.12.05.06.1.11.16.15.03.02.06.04.09.05.08.05.18.08.27.09.04.01.09.01.13.01.1 0 .2-.02.28-.05.13-.05.25-.13.34-.23.05-.05.08-.1.12-.16.01-.02.01-.04.02-.05.18-.46.34-.93.43-1.41.35-1.9.12-3.8-.27-5.68-.09-.44-.21-.87-.33-1.36-.01-.03-.02-.07-.04-.09-.02-.03-.03-.06-.06-.08-.02-.02-.04-.03-.06-.04-.04-.03-.09-.04-.14-.05h-.07c-.02 0-.04 0-.05.01-.07.02-.14.06-.18.12-.02.03-.04.05-.06.07-1.4 2-1.97 4.21-1.46 6.59.14.69.46 1.35.8 1.99zM16.26 69.58c.02.01.04.02.05.04.08.04.18.08.28.09.04.01.08.01.13.01h.09a.892.892 0 0 0 .54-.28c.05-.05.08-.1.11-.16.02-.05.04-.1.06-.14.48-2.33-.76-6.22-2.22-8.51a.12.12 0 0 0-.05-.05.218.218 0 0 0-.05-.04c-.04-.03-.09-.04-.14-.05h-.07c-.02 0-.04.01-.06.01a.37.37 0 0 0-.2.15c-1.41 2.55-.91 6.79 1.53 8.93zM23.42 74.78c.13.07.27.1.42.1h.07c.09-.01.17-.03.25-.05.15-.05.28-.14.38-.26.05-.06.09-.12.13-.18.07-.14.12-.3.12-.46-.29-3.09-2.11-5.46-4.04-7.84a.4.4 0 0 0-.12-.1.326.326 0 0 0-.14-.04h-.08c-.02 0-.05 0-.06.01-.1.02-.18.08-.24.17-.02.03-.03.07-.05.11-.84 2.78.97 7.12 3.36 8.54zM31.2 79a.755.755 0 0 0-.22-.11c-2.91-1-7.76-.71-10.28.25-.07.03-.14.07-.18.14-.02.04-.04.08-.05.13 0 .01 0 .03-.01.05v.08c0 .04.01.08.02.11.01.02.02.05.03.07.01.03.04.05.06.07.02.02.04.04.07.05 1.84 1.01 3.81 1.57 5.9 1.72 1.35.1 2.68 0 3.92-.59.28-.13.55-.29.81-.47.03-.03.07-.06.1-.09.05-.05.09-.12.13-.18.07-.14.12-.3.12-.46 0-.25-.1-.48-.26-.65-.06-.05-.11-.09-.16-.12z\" /><path style=\"fill-rule:evenodd;clip-rule:evenodd\" d=\"M49.99 78.53c2.9-.25 6.09-4.93 5.62-8.18v-.02a.398.398 0 0 0-.3-.29c-.02-.01-.04-.01-.06-.01h-.08c-.05.01-.1.02-.14.04-.03.01-.05.03-.07.05-2.44 2.18-4.75 4.37-5.35 7.73-1.85.47-5.16 1.39-8.44 2.58-3.28-1.18-6.6-2.1-8.44-2.58-.61-3.36-2.92-5.54-5.35-7.73a.304.304 0 0 0-.07-.05c-.05-.02-.09-.04-.14-.04h-.08c-.02 0-.04 0-.06.01-.1.02-.18.08-.24.16-.02.04-.04.08-.06.13v.02c-.46 3.25 2.73 7.93 5.62 8.18 2 .42 4.68 1.33 7.33 2.46-2.87 1.12-5.53 2.44-6.93 3.83l1.04 1.22c1.29-1.28 4.2-2.94 7.38-4.39 3.18 1.45 6.1 3.11 7.39 4.39l1.04-1.22c-1.4-1.39-4.05-2.71-6.93-3.83 2.64-1.13 5.32-2.05 7.32-2.46zM55.15 9.05c1.28 1.64 4.46 3.75 6.5 4.07.07.01.15 0 .22-.01a.71.71 0 0 0 .53-.85c-.01-.05-.03-.09-.05-.13-.94-1.78-4.25-3.51-7.04-3.52-.15.03-.24.18-.21.33.01.04.03.08.05.11zM74.19 25.21c.01 0 .02.01.02.01a.723.723 0 0 0 .93-.47c.09-.33.12-.65.12-.99 0-2.37-.98-4.35-2.44-6.14-.3-.37-.71-.8-1.08-1.18a.272.272 0 0 0-.16-.08h-.05c-.15 0-.27.12-.27.26.19 2.97.79 5.95 2.69 8.45.09.05.16.11.24.14zM78.62 43.74c.02.13.07.24.14.34.08.11.19.19.32.24.01 0 .01.01.02.01a.707.707 0 0 0 .65-.09c.57-.46 1.01-1.03 1.32-1.7 1.23-2.69 1.23-5.46.56-8.28-.02-.03-.03-.06-.06-.09a.305.305 0 0 0-.16-.08h-.05c-.08 0-.14.03-.19.07-1.49 1.52-2.88 6.9-2.55 9.58zM72.47 26.62c.35 0 .64-.23.72-.56.02-.06.02-.12.02-.19s-.01-.14-.03-.21c-.79-2.15-4.02-4.5-6.96-4.45-.13.03-.23.14-.23.29v.01c0 .03.01.06.02.09 1.05 1.99 4.19 4.42 6.3 4.98.05.03.11.04.16.04zM68.64 17.26c.08.03.16.06.24.07h.02c.07 0 .16-.01.23-.03.29-.09.47-.37.47-.66-.01-.32-.08-.63-.18-.93-.68-2.13-2.15-3.64-3.98-4.83-.38-.25-.87-.52-1.31-.75-.05-.03-.11-.04-.16-.03-.01 0-.03 0-.04.01-.13.04-.21.18-.17.32 1.03 2.62 2.44 5.13 4.88 6.83zM67.12 19.21c.32-.03.57-.28.63-.58.01-.06.01-.12.01-.18a.592.592 0 0 0-.05-.19c-.92-1.95-4.17-3.89-6.95-3.59-.12.04-.21.15-.2.29v.01c.01.03.02.06.03.08 1.15 1.79 4.33 3.81 6.36 4.16.07-.01.12 0 .17 0zM70.35 28.82c-.01.02-.01.05-.01.07v.02c0 .03.01.05.01.07.85 2.29 3.15 5.55 5.27 6.53.07.03.15.05.23.05.28.01.53-.14.67-.36.03-.05.05-.11.07-.16.02-.06.03-.12.03-.19 0-.03 0-.05-.01-.08-.41-2.66-3.63-6.09-6.02-6.15-.11.01-.2.08-.24.2zM77.59 34.07c.08.11.19.21.32.26.01 0 .01.01.02.01.08.03.16.05.25.05.26.02.49-.11.64-.31.25-.41.42-.87.53-1.36.52-2.35 0-4.57-1.02-6.69-.22-.44-.47-.87-.75-1.35-.01-.01-.01-.03-.02-.04a.26.26 0 0 0-.16-.09c-.01-.01-.03-.01-.05-.01-.14-.01-.25.08-.29.21-.85 2.53-.57 7 .49 9.24l.04.08zM76.51 44.57c.08.03.16.05.25.05.18 0 .35-.07.47-.17.11-.09.19-.21.23-.35.5-2.77-1.83-6.93-4.48-7.72a.28.28 0 0 0-.2.08.28.28 0 0 0-.08.2c.19 2.16 1.69 6.24 3.6 7.8.06.05.12.09.19.12 0-.01.01-.01.02-.01zM82.01 44.5h-.07a.37.37 0 0 0-.18.08c-1.8 1.72-4.27 5.98-4.55 8.86 0 .08.01.15.03.22.02.07.04.13.07.19.03.06.07.11.12.16.09.1.21.18.34.23a.817.817 0 0 0 .63-.03c.31-.16.59-.36.83-.61.62-.65 1.24-1.35 1.64-2.14 1.07-2.08 1.53-4.3 1.44-6.7-.01-.03-.02-.05-.03-.08a.322.322 0 0 0-.22-.17c-.02-.01-.03-.01-.05-.01zM70.4 72.74a.463.463 0 0 0-.24-.17c-2.68-.26-7.48.76-10.03 2.53-.04.03-.08.07-.12.1a.95.95 0 0 0-.14 1.11c.03.06.08.12.13.18.08.1.19.17.31.22.29.11.6.18.92.24 1.35.23 2.66-.02 3.93-.49 1.97-.71 3.72-1.78 5.22-3.25.02-.02.03-.03.04-.05l.03-.06c.01-.04.02-.07.02-.11 0-.04 0-.09-.01-.13l-.06-.12zM80.95 55.28a.689.689 0 0 0-.03-.08.345.345 0 0 0-.22-.17c-.02 0-.04-.01-.05-.01h-.07c-.04 0-.07.02-.11.04-2.93 1.79-5.51 3.85-7.09 7.02-.02.06-.05.12-.05.19v.08c0 .08.01.15.03.22.02.07.04.13.08.19.03.06.07.11.11.16.09.1.21.18.34.23.08.03.16.04.24.04.78-.09 1.48-.35 2.11-.78 2.48-1.74 3.93-4.18 4.72-7.04v-.06c-.01 0-.01-.01-.01-.03zM74.5 53.8c.09.11.21.19.34.23.09.03.19.05.28.05.15 0 .29-.03.41-.1.03-.02.06-.04.09-.05.06-.05.12-.1.17-.16.04-.05.06-.1.1-.15.97-2.24.29-6.5-2.45-8.81-.03-.02-.05-.04-.09-.05-.02-.01-.04-.01-.05-.01h-.07c-.07.01-.14.04-.19.09-.02.02-.04.05-.06.07-.02.04-.04.09-.05.15-.34 2.52.12 6.76 1.57 8.72-.01.01 0 .02 0 .02zM77.29 64.59c-.01-.03-.02-.05-.03-.08a.345.345 0 0 0-.22-.17c-.01 0-.03 0-.05-.01h-.03c-2.49.14-7.01 2.54-8.99 4.73-.03.05-.07.09-.09.14-.04.08-.07.18-.08.28v.08c0 .08.01.16.03.23.02.06.04.13.07.19.03.06.07.11.11.16.09.1.21.18.34.23.04.02.09.02.14.03.3.03.59.06.89.05 2.89-.06 6.56-3.16 7.89-5.62.01-.02.02-.04.02-.05.01-.02.01-.05.01-.08v-.07c-.01-.01-.01-.03-.01-.04zM70.58 62.31c.01.01.01.03.02.05a.892.892 0 0 0 .46.39c.09.03.19.05.28.05.04 0 .09 0 .13-.01.1-.01.19-.04.27-.09.03-.01.06-.03.09-.05a.768.768 0 0 0 .24-.27c.34-.64.66-1.3.81-1.99.51-2.38-.06-4.59-1.48-6.58-.02-.02-.04-.05-.06-.07a.36.36 0 0 0-.18-.12c-.01 0-.04-.01-.05-.01h-.07c-.05.01-.1.02-.14.05-.02.01-.04.02-.05.04-.02.02-.04.05-.06.08-.02.03-.03.06-.04.09-.13.49-.24.93-.33 1.36-.38 1.87-.62 3.77-.27 5.67.09.48.25.95.43 1.41zM67.4 60.49c-.02 0-.04-.01-.06-.01h-.07c-.05.01-.1.02-.14.05-.02.01-.04.03-.05.04l-.05.05c-1.46 2.29-2.7 6.18-2.22 8.51.01.05.03.1.06.14.03.06.07.11.11.16.09.1.21.18.34.23.06.02.12.04.19.05h.09c.05 0 .09 0 .13-.01.1-.01.19-.04.28-.09.02-.01.04-.02.05-.04 2.44-2.14 2.94-6.38 1.53-8.95a.381.381 0 0 0-.19-.13zM61.99 65.96c-.02-.01-.04-.01-.06-.01h-.08c-.05.01-.1.02-.14.04a.4.4 0 0 0-.12.1c-1.93 2.38-3.75 4.74-4.04 7.84a.93.93 0 0 0 .25.64c.1.11.23.2.38.26.08.03.17.05.25.05h.07c.15 0 .29-.04.42-.1 2.39-1.42 4.2-5.76 3.36-8.55a.27.27 0 0 0-.05-.11.487.487 0 0 0-.24-.16z\" /><path style=\"fill-rule:evenodd;clip-rule:evenodd\" d=\"M61.86 79.4a.31.31 0 0 0-.06-.13.368.368 0 0 0-.18-.14c-2.52-.96-7.37-1.25-10.28-.25-.08.03-.16.06-.22.11-.05.03-.09.07-.13.11-.17.17-.27.4-.27.65 0 .17.04.33.12.46.04.06.08.12.13.18.03.03.07.06.1.09.25.17.52.33.8.47 1.24.59 2.57.69 3.92.59 2.08-.15 4.05-.72 5.89-1.72.02-.01.05-.03.07-.05.02-.02.04-.05.06-.07.01-.02.02-.04.03-.07a.36.36 0 0 0 .02-.11v-.12z\" /><g><path d=\"M45.41 35.99h-.89v1.92c0 .69-.3 1.16-.9 1.43-.51.23-1.03.23-1.04.23v1.53c.51 0 .96-.07 1.34-.22v8.34h.89v-8.94c0-.01.01-.01.01-.01.62-.69.6-1.56.58-1.74v-2.54zM46.32 36.73h5.33v1.54h-5.33zM46.32 47.27h5.33v1.54h-5.33z\" /><g><path d=\"M31.71 43.22h.93v1.52h-.93zM31.71 40.29h.93v1.52h-.93zM37.85 43.22h.92v1.52h-.92zM36.25 40.29h.91v1.52h-.91zM33.33 43.22h.91v1.52h-.91z\" /><path d=\"M56.69 21.07c-.35 0-.69.02-1.02.07-.75.1-1.52.15-2.3.15-2.95 0-5.73-.74-8.17-2.03-.37-.2-.73-.41-1.08-.63l-.51-.33c-.15-.11-.45-.32-.45-.32-.57-.41-1.27-.65-2.02-.65s-1.45.24-2.02.65c0 0-.3.21-.45.32-.17.11-.34.23-.52.33-.35.22-.71.43-1.08.63-2.44 1.3-5.22 2.03-8.17 2.03-.79 0-1.55-.05-2.31-.15a7.134 7.134 0 0 0-8.14 7.06v14.65c-.01.28-.02.56-.02.84 0 13.17 9.36 24.15 21.79 26.67.29.04.6.07.9.07.29 0 .58-.02.86-.06 12.39-2.5 21.74-13.4 21.82-26.51V28.19c.02-3.93-3.17-7.12-7.11-7.12zM39.45 35.98v2.09h-1.6v.8h1.6v10.4h-.68v-3.13h-.92v3.17h-.69v-3.17h-.91v3.13h-.68v-10.4h1.59v-.8h-1.59v-1.41h1.59v-.68h.69v.68h.92v-.68h.68zm-3.12-8.43h.01l.64-1.29.63 1.27v.01l1.42.2-1.02.99-.01.03.24 1.41-1.27-.67-1.26.67.23-1.4v-.01l-1.02-1 1.41-.21zm-6.55 4.11h.01l.64-1.28.63 1.27.01.01 1.42.21-1.01.99-.01.01.24 1.41-1.27-.67-1.27.67.24-1.4v-.01l-1.03-1 1.4-.21zm-3.9 6.77h.01l.64-1.28.63 1.27.01.01 1.42.21-1.02.99-.01.01.24 1.41-1.26-.66-.01-.01-1.27.66.24-1.4v-.01l-1.03-1 1.41-.2zm.85 9.8-.01-.01-1.27.67.24-1.39v-.01l-1.02-1 1.4-.2h.01l.64-1.29.63 1.27.01.01 1.42.21-1.02.99-.01.01.24 1.41-1.26-.67zm5.34 7.25-1.26-.66-.01-.01-1.27.66.24-1.4v-.02l-1.03-1 1.41-.2h.01l.64-1.29.63 1.27.01.01 1.42.2-1.01.99-.01.01.23 1.44zm2.86-17.4h-1.6v.8h1.6v7.27h-1.6v.81h1.6v1.41h-1.6v.95h-.68v-.95h-1.62v-1.41h1.62v-.81h-1.62v-7.27h1.62v-.8h-1.62v-1.41h1.62v-.68h.68v.68h1.6v1.41zm3.79 21.3-1.27-.67-1.27.67.24-1.4v-.01l-1.03-1 1.4-.2h.01l.63-1.29.63 1.27.01.01 1.42.2-1.01.99-.01.01.25 1.42zm23.5-15.69c0 12.26-8.71 22.46-20.28 24.8-.27.04-.54.06-.81.06l-.01-49.36c.7 0 1.37.3 1.9.68.14.1.27.2.42.29.16.11.32.21.48.31.33.21.66.4 1.01.59 2.27 1.2 5.15 1.83 7.9 1.83.73 0 1.5-.1 2.21-.19.3-.04.89-.06 1.21-.06 3.57 0 5.95 2.74 6.09 6.28h.01c-.02 0-.13 14.65-.13 14.77z\" /><path d=\"M36.25 43.22h.91v1.52h-.91zM37.85 40.29h.92v1.52h-.92zM33.33 40.29h.91v1.52h-.91z\" /></g><g><path d=\"m46.78 27.78-1.38-.2-.01-.03-.6-1.21-.61 1.24-1.37.2.99.97-.24 1.36 1.23-.65 1.23.65-.24-1.36zM52.65 32.57l.97-.95-1.37-.19-.61-1.25-.62 1.25-1.37.19.99.98v.02l-.23 1.34 1.23-.65 1.22.65-.23-1.36zM56.56 39l.97-.94-1.37-.2-.02-.03-.6-1.21-.61 1.24-1.37.2.99.97-.23 1.36 1.22-.64 1.23.64-.23-1.36zM57.72 45.86l-1.37-.2-.02-.02-.6-1.22-.61 1.24-1.37.2.99.97-.24 1.37 1.23-.65 1.23.65-.24-1.37zM54.02 52.71l-1.37-.2-.01-.03-.6-1.22-.62 1.25-1.36.2.99.96-.24 1.37 1.23-.65 1.23.65-.24-1.37zM46.47 57.74l.96-.95-1.37-.19-.61-1.25-.61 1.25h-.03l-1.34.19.99.97-.01.04-.23 1.33 1.23-.65 1.23.65-.24-1.37z\" /></g></g></g></symbol>"
});
var result = _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default().add(symbol);
/* harmony default export */ __webpack_exports__["default"] = (symbol);

/***/ }),

/***/ 9397:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3465);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2594);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__);


var symbol = new (_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default())({
  "id": "logo_footer",
  "use": "logo_footer-usage",
  "viewBox": "0 0 284 60",
  "content": "<symbol xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 284 60\" id=\"logo_footer\"><path d=\"M198.63 19.48c.14-.27.29-.49.44-.68.16-.19.31-.34.45-.46.3-.25.62-.46.93-.6a4.817 4.817 0 0 1 1.71-.44c.24-.01.42-.02.55-.02.37 0 .76.04 1.18.12.41.08.77.23 1.06.47.19.15.32.31.41.47l.24.42h.3l.06-1.81-.06-.02c-.38-.11-.73-.2-1.04-.27-.31-.07-.58-.12-.83-.16-.25-.04-.48-.06-.68-.07-.21-.01-.41-.01-.61-.01-.19 0-.45.01-.78.03a6.36 6.36 0 0 0-2.4.66c-.45.22-.88.52-1.29.91-.37.35-.66.72-.88 1.09a5.6 5.6 0 0 0-.48 1.08c-.11.34-.18.67-.21.96-.03.3-.04.53-.04.71 0 .54.07 1.07.21 1.55.15.49.35.95.63 1.37.27.42.61.79 1.01 1.11.4.33.86.59 1.36.79.25.1.51.18.77.24.24.05.48.09.69.12.21.03.4.04.57.05.16 0 .29.01.39.01.4 0 .85-.03 1.34-.09.49-.06.94-.14 1.32-.25.16-.05.31-.09.47-.14.16-.05.31-.1.47-.16l.06-.02-.06-1.73h-.31l-.02.05c-.03.08-.07.17-.11.28-.04.1-.13.23-.25.37-.05.05-.13.12-.22.21-.09.08-.22.15-.37.22-.19.09-.39.16-.6.21-.21.05-.42.09-.6.12-.19.03-.35.04-.5.05-.14.01-.24.01-.3.01-.16 0-.37-.01-.63-.03-.25-.02-.54-.07-.84-.16-.3-.09-.62-.23-.94-.42-.32-.18-.63-.45-.93-.78-.12-.13-.25-.29-.38-.48s-.26-.42-.37-.68c-.11-.26-.21-.56-.29-.89-.08-.33-.12-.72-.12-1.14 0-.45.05-.86.14-1.21.13-.38.25-.7.38-.96zM208.93 26.47l-.07-.02a1.1 1.1 0 0 1-.29-.09.435.435 0 0 1-.19-.19.726.726 0 0 1-.06-.14c-.01-.05-.01-.08-.01-.11 0-.09.03-.21.08-.34.06-.14.13-.32.21-.52l.82-1.91h3.46l.76 1.84c.05.12.1.24.15.35.05.11.1.22.14.33.03.13.04.2.04.23 0 .02 0 .05-.01.1 0 .03-.02.08-.05.13-.06.11-.13.19-.23.22-.11.05-.23.08-.35.09l-.07.01-.03.33h3.2v-.28l-.05-.02c-.1-.05-.23-.11-.38-.19-.14-.07-.28-.22-.42-.45-.03-.05-.06-.1-.1-.18-.03-.08-.07-.16-.11-.24l-.11-.24c-.04-.08-.06-.14-.09-.2l-3.55-8.35-.02-.05h-.24l-3.88 8.68c-.09.21-.18.39-.25.54-.08.14-.16.26-.24.35-.08.09-.17.15-.26.2-.09.05-.2.08-.33.1l-.08.01v.33h2.62v-.32zm.88-4.17 1.4-3.11 1.32 3.11h-2.72zM214.78 18.41h.33l.01-.07c.01-.05.02-.13.05-.26.02-.1.08-.2.19-.29.09-.07.21-.13.34-.16.14-.03.34-.05.61-.06h1.93v7.8c0 .27-.03.47-.09.6s-.14.23-.24.31c-.08.07-.17.11-.26.13-.11.03-.18.04-.2.05l-.05.02-.03.32h3.21v-.33l-.07-.01c-.18-.05-.31-.09-.39-.14-.08-.05-.16-.11-.22-.17a.896.896 0 0 1-.15-.23c-.03-.08-.05-.17-.06-.27-.01-.1-.01-.23-.01-.36V17.6h2.1c.3 0 .54.04.72.12.16.08.26.27.32.59l.01.07h.32v-1.66h-8.36v1.69zM226.76 26.45h-.09c-.01 0-.04 0-.11-.02a.45.45 0 0 1-.18-.07c-.07-.04-.14-.08-.21-.14a.491.491 0 0 1-.16-.21c-.04-.1-.07-.23-.07-.38-.01-.16-.01-.38-.01-.65v-3.1h5.33v3.07c0 .23 0 .44-.01.61 0 .17-.02.3-.03.37-.02.05-.04.1-.06.14-.03.05-.04.07-.06.09-.06.09-.15.16-.24.19-.1.05-.22.08-.33.09l-.07.01-.03.33h3.09v-.33l-.07-.01c-.13-.03-.24-.06-.33-.1a.733.733 0 0 1-.25-.2.586.586 0 0 1-.14-.27c-.02-.1-.03-.21-.05-.34-.01-.1-.01-.2-.01-.29V18.5c0-.12 0-.29.01-.5.01-.2.02-.35.06-.46.03-.1.08-.18.15-.24.07-.07.14-.12.21-.16.07-.04.13-.06.19-.07.08-.02.13-.03.16-.04l.06-.02v-.3h-3.05v.33h.09c.02 0 .05.01.12.02.07.01.14.03.21.07a.8.8 0 0 1 .21.13c.07.06.11.13.14.22.03.1.05.22.05.37v3.17h-5.33v-2.59c0-.24.01-.44.02-.62.02-.16.04-.29.09-.38.03-.08.08-.14.14-.18a.942.942 0 0 1 .38-.18c.06-.02.11-.03.14-.04l.06-.02v-.3h-3.07v.3l.06.02c.03.01.08.02.16.04.07.01.13.03.2.07.07.03.13.07.19.13s.11.14.15.23c.04.12.07.24.07.36V24.97c0 .22 0 .42-.01.6-.01.17-.02.29-.05.37a.685.685 0 0 1-.36.4c-.08.03-.14.06-.21.08-.08.02-.12.02-.13.02h-.09v.34h3.07v-.33zM244.34 25.38c.3-.34.55-.69.72-1.04a5.113 5.113 0 0 0 .55-1.85c.02-.26.03-.47.03-.64 0-.49-.05-.95-.15-1.35-.1-.41-.22-.77-.36-1.08-.14-.31-.3-.58-.46-.81a6.5 6.5 0 0 0-.44-.56c-.13-.14-.31-.31-.53-.5-.22-.19-.5-.37-.82-.54a5.25 5.25 0 0 0-1.1-.42c-.41-.12-.88-.17-1.39-.17-.6 0-1.14.07-1.61.22-.47.15-.88.33-1.23.53s-.65.42-.89.66c-.24.23-.43.43-.58.6-.1.13-.22.3-.35.5-.14.21-.26.45-.38.73-.12.28-.22.61-.3.96-.08.36-.12.77-.12 1.21 0 .55.06 1.05.19 1.48.12.43.28.82.46 1.16.19.33.38.62.59.85.22.23.4.41.56.55.51.43 1.07.74 1.66.92.59.18 1.22.28 1.87.28.82 0 1.58-.13 2.24-.39.67-.23 1.29-.68 1.84-1.3zm-3.95.86c-.49 0-.92-.07-1.28-.21-.37-.14-.69-.31-.96-.51-.26-.2-.48-.4-.65-.62-.17-.22-.3-.4-.4-.55-.17-.27-.31-.55-.41-.81-.1-.27-.17-.52-.22-.75a3.93 3.93 0 0 1-.09-.64c-.01-.2-.02-.35-.02-.48 0-.49.05-.92.15-1.3.09-.38.22-.72.36-1.01.15-.28.31-.53.49-.73.18-.2.35-.37.5-.5.23-.18.46-.33.7-.44.24-.11.47-.19.69-.25.22-.06.41-.09.58-.11.18-.01.32-.02.41-.02a3.796 3.796 0 0 1 1.86.47c.23.13.43.27.58.41.16.15.29.28.39.39.12.16.25.36.39.58.14.23.27.5.39.82.11.32.2.68.26 1.08s.06.84.02 1.32c-.01.11-.03.28-.06.51-.03.23-.1.49-.2.78-.14.38-.32.74-.54 1.04-.22.31-.49.58-.79.8-.3.22-.63.4-1 .52-.35.15-.74.21-1.15.21zM247.2 17.08c.07.01.14.04.22.07.07.04.15.09.22.16s.13.16.17.26c.04.09.06.23.07.42.01.19.01.41.01.66v5.87c0 .25 0 .5-.01.73-.01.23-.02.38-.02.45-.03.16-.07.28-.13.36-.07.09-.13.16-.21.22-.07.05-.15.1-.23.12-.08.03-.15.05-.2.05l-.08.01v.33h7.27v-1.73h-.32l-.02.06c-.05.15-.09.28-.13.37-.04.08-.08.15-.13.2-.07.06-.14.12-.23.15-.1.04-.2.06-.3.07l-.32.03c-.1 0-.2.01-.3.01h-1.93l-.56-.02c-.11 0-.23-.03-.33-.09a.546.546 0 0 1-.29-.39c-.04-.19-.06-.47-.07-.81v-5.99l.03-.66c.01-.19.02-.33.04-.41.03-.11.08-.2.15-.26.07-.07.14-.12.21-.16a.6.6 0 0 1 .2-.07c.07-.01.13-.03.16-.04l.07-.01v-.31h-3.22v.3l.06.02c.02 0 .07.01.15.03zM255.41 17.08c.07.01.14.04.22.07.08.03.15.09.22.15s.12.15.16.27c.03.1.05.22.06.36 0 .14.01.33.01.57v6.42c-.01.32-.02.57-.02.75 0 .17-.05.3-.13.42s-.18.2-.29.24c-.12.05-.24.09-.38.11l-.07.02v.33h3.15v-.32l-.06-.02c-.11-.03-.23-.07-.35-.12a.69.69 0 0 1-.28-.21.562.562 0 0 1-.13-.27c-.01-.1-.02-.18-.02-.24-.02-.1-.03-.21-.03-.32V18.5c0-.23 0-.43.01-.6.01-.16.02-.28.05-.36a.622.622 0 0 1 .33-.39.6.6 0 0 1 .2-.07c.07-.01.12-.03.16-.04l.07-.01v-.31h-3.11v.31l.07.01c.03.01.09.02.16.04zM268.03 26.75c.16-.05.32-.09.47-.14.16-.05.31-.1.47-.16l.06-.02-.06-1.73h-.31l-.02.05c-.03.08-.07.17-.11.28-.04.1-.13.23-.25.37-.05.05-.13.12-.23.21-.09.08-.22.15-.37.22-.19.09-.39.16-.6.21-.21.05-.42.09-.6.12-.19.03-.36.04-.5.05-.15.01-.25.01-.3.01-.16 0-.37-.01-.63-.03-.25-.02-.53-.07-.83-.16-.3-.09-.62-.23-.94-.42-.32-.18-.63-.45-.93-.78-.12-.13-.24-.29-.38-.48-.13-.19-.25-.42-.37-.68-.12-.26-.21-.56-.29-.89-.08-.33-.12-.72-.12-1.14 0-.45.05-.86.14-1.21.1-.36.22-.67.35-.93.14-.27.29-.49.44-.68.16-.19.31-.34.45-.46.3-.25.62-.46.94-.6a4.817 4.817 0 0 1 1.71-.44c.24-.01.42-.02.55-.02.37 0 .76.04 1.18.12.41.08.77.23 1.06.47.19.15.32.31.41.47l.24.42h.3l.06-1.81-.06-.02c-.38-.11-.73-.2-1.04-.27-.31-.07-.58-.12-.83-.16-.25-.04-.48-.06-.68-.07-.21-.01-.41-.01-.61-.01-.19 0-.45.01-.78.03a6.417 6.417 0 0 0-2.4.66c-.45.22-.88.52-1.29.91-.37.35-.66.72-.88 1.09-.21.37-.38.73-.48 1.08-.11.34-.18.67-.21.96-.03.3-.04.53-.04.71 0 .54.07 1.07.21 1.55.14.49.35.95.63 1.37.27.42.61.79 1.01 1.11.4.33.85.59 1.36.79.25.1.51.18.77.24.25.05.48.09.69.12.21.03.4.04.57.05.16 0 .29.01.39.01.4 0 .85-.03 1.33-.09.52-.09.97-.17 1.35-.28z\" /><g><path d=\"M203.31 33.93h.09c.01 0 .04.01.07.02l.18.05c.06.02.12.05.19.08.06.03.11.07.15.12.11.13.16.31.17.52.01.23.01.42.01.58v4.49c0 .24-.01.45-.02.63s-.04.34-.06.48c-.02.14-.05.27-.09.38-.04.12-.08.23-.13.35-.06.15-.13.27-.19.37-.07.1-.12.18-.15.22-.08.09-.19.19-.31.29-.12.1-.28.19-.46.27-.18.08-.39.15-.63.21-.23.06-.51.09-.81.09-.45 0-.88-.08-1.3-.24-.42-.16-.77-.43-1.06-.79-.14-.18-.24-.36-.32-.55-.08-.18-.14-.38-.17-.57-.04-.19-.06-.4-.07-.6-.01-.2-.01-.42-.01-.64v-4.43c.01-.2.02-.37.02-.52 0-.14.03-.26.07-.36.04-.1.11-.18.21-.25.1-.07.26-.14.47-.19l.06-.02.03-.31h-3.1v.31l.07.02c.32.09.46.17.52.23.12.09.19.2.2.36.02.17.03.42.03.72v4.51c-.01.47 0 .85.04 1.12.04.28.1.53.17.76.1.27.24.54.42.81.19.27.44.52.75.74.31.22.7.4 1.15.54.45.13 1 .2 1.62.2.63 0 1.18-.08 1.63-.23.45-.15.82-.35 1.12-.59.29-.24.52-.51.69-.81.16-.29.28-.57.36-.85.05-.18.08-.36.11-.55.02-.19.04-.36.04-.52 0-.16.01-.3.01-.42v-4.78c0-.25 0-.44.01-.58a.76.76 0 0 1 .11-.33c.07-.12.17-.19.27-.23.12-.05.25-.08.38-.12l.07-.02v-.3h-2.59l-.02.33zM215.28 33.91l.07.01c.33.07.53.17.62.3.09.14.15.29.17.46.02.1.02.2.02.3-.01.11-.01.18-.01.21v5.8l-6.5-7.36-.03-.03h-2.15v.32l.08.01c.13.02.26.05.38.09.1.03.19.11.25.24.06.09.09.19.09.32s.01.32.01.55v7.05c0 .12-.01.28-.02.48-.01.17-.06.31-.14.41-.09.13-.19.2-.31.23l-.28.06-.06.02-.03.33h2.63v-.33l-.07-.04c-.2-.04-.37-.11-.5-.2-.12-.08-.2-.23-.24-.44-.01-.07-.02-.15-.02-.22-.01-.07-.01-.18-.01-.31V35.3l7.55 8.54h.25v-8.67l.03-.6c.01-.17.09-.31.25-.44.05-.04.11-.08.18-.12.07-.03.18-.07.31-.09l.07-.01.03-.32h-2.63v.32zM222.32 43.22a.69.69 0 0 1-.28-.21.562.562 0 0 1-.13-.27c-.01-.1-.02-.18-.02-.23-.02-.11-.03-.21-.03-.32V34.8c.01-.16.02-.28.05-.36a.65.65 0 0 1 .13-.25c.06-.06.12-.11.19-.14a.96.96 0 0 1 .2-.07c.07-.02.12-.03.16-.04l.07-.02v-.32h-3.11v.31l.07.02c.04.01.1.02.17.04.07.01.14.04.22.07.08.03.15.09.22.15a.7.7 0 0 1 .17.28c.03.1.05.22.06.35 0 .14.01.33.01.57v6.42c-.01.32-.01.57-.02.75 0 .17-.05.3-.13.42s-.18.2-.29.24c-.12.05-.24.09-.37.11l-.07.02v.33h3.15v-.32l-.06-.02c-.13-.04-.24-.08-.36-.12zM230.98 33.91l.06.02.3.09c.09.03.15.08.21.17.03.04.04.08.05.12 0 .05.01.09.01.11 0 .09-.01.18-.04.27a2.48 2.48 0 0 1-.17.49c-.03.06-.04.1-.05.12l-2.59 5.95-2.46-5.95-.11-.3c-.04-.09-.06-.18-.08-.27-.04-.13-.05-.24-.05-.33 0-.12.04-.22.12-.29.08-.08.25-.14.5-.18l.07-.01v-.32h-3.16v.31l.06.02c.12.03.21.06.28.09.07.03.14.08.23.16.12.1.21.22.27.34.06.13.1.23.12.28.07.14.13.28.19.42.06.14.12.28.17.44l3.42 8.11.02.06h.26l3.64-8.29c.08-.16.16-.35.25-.58.09-.22.19-.4.29-.56.1-.15.19-.25.29-.31.1-.06.24-.11.42-.14l.07-.01v-.34h-2.59v.31zM241.19 41.99c-.04.12-.08.23-.11.34a.72.72 0 0 1-.17.27c-.09.09-.19.14-.3.16-.17.02-.23.03-.27.03-.1.02-.19.03-.28.03h-1.6c-.35-.01-.65-.02-.91-.04-.24-.01-.42-.06-.51-.13a.382.382 0 0 1-.09-.09c-.02-.03-.04-.07-.06-.09-.07-.15-.11-.31-.11-.48 0-.19-.01-.36-.02-.52v-2.75h2.07c.21 0 .42.02.63.05.19.03.33.14.43.31.02.05.04.1.07.16.02.05.05.13.07.24l.02.07h.32v-2.54h-.31l-.02.06c-.01.03-.02.08-.04.16-.01.06-.04.13-.07.2-.04.07-.08.15-.15.22-.06.07-.14.12-.24.15-.11.04-.23.06-.36.06h-2.42v-3.42h2.58c.18 0 .35.02.5.05.13.03.24.13.34.3.04.06.06.12.08.19.02.07.04.14.06.22l.02.06.32.03.03-1.7h-6.2v.33h.09c.03 0 .07 0 .14.01s.13.03.2.06c.07.04.15.09.21.14.06.05.11.13.15.25.04.1.06.21.06.33v7.04c-.01.14-.02.27-.01.41v.41c-.01.14-.04.26-.1.37-.05.1-.14.19-.27.26-.05.03-.1.06-.16.07l-.21.06-.06.02-.03.33h7.03v-1.75h-.32l-.02.06zM251.65 43.27a.651.651 0 0 1-.23-.15.809.809 0 0 1-.21-.24c-.06-.1-.1-.17-.12-.2-.16-.23-.31-.48-.45-.75l-1.92-3.53c.05-.02.11-.05.18-.09.12-.06.25-.15.4-.25.15-.11.3-.23.44-.38.15-.15.28-.33.39-.53.16-.32.25-.68.25-1.08 0-.38-.06-.7-.18-.95-.11-.25-.21-.43-.29-.55-.19-.25-.4-.43-.64-.56-.23-.13-.48-.23-.75-.29-.26-.06-.54-.1-.81-.11-.27-.01-.53-.01-.79-.01h-3.6v.33h.09c.02 0 .05.01.11.02.06.02.13.03.2.06.07.02.14.07.21.12.06.05.12.12.15.2.04.09.07.21.08.34.01.15.01.34.01.57v6.74c-.01.23-.02.42-.02.58 0 .15-.02.26-.06.34-.03.09-.08.16-.14.22-.06.06-.13.1-.2.14a.96.96 0 0 1-.2.07c-.08.02-.11.02-.12.02h-.09v.35h3.18v-.32l-.06-.02c-.2-.06-.35-.1-.44-.14a.688.688 0 0 1-.22-.17c-.08-.09-.14-.17-.15-.25-.02-.09-.03-.2-.04-.33-.01-.08-.01-.16-.01-.25s0-.19-.02-.28V38.9h.28c.28.01.61.01.96-.01.18-.01.35-.03.52-.05l1.81 3.34c.1.19.22.39.34.6.14.22.3.4.48.55a1.618 1.618 0 0 0 .72.34c.11.03.22.04.31.04h.86v-.31l-.05-.03c-.01-.03-.07-.06-.16-.1zm-6.03-8.8h1c.27-.01.54 0 .81.03.26.03.51.12.74.27.26.16.44.37.55.63.12.26.18.54.18.83 0 .23-.02.42-.07.57-.06.19-.1.29-.14.34-.1.2-.24.35-.39.46-.16.12-.33.21-.52.27-.19.07-.4.11-.61.13-.21.02-.42.04-.62.04h-.96l.03-3.57zM258.02 38.38l-.61-.4-.81-.46a9.65 9.65 0 0 1-.74-.5c-.24-.17-.43-.4-.54-.67-.04-.12-.07-.24-.08-.34-.01-.1-.01-.18-.01-.22 0-.26.05-.48.14-.68.09-.2.22-.37.37-.5s.34-.23.55-.3c.22-.07.45-.11.69-.11.33 0 .61.05.83.15.22.1.4.22.54.36.14.14.25.29.32.45.08.17.15.31.2.43l.02.05h.3v-1.79l-.06-.02c-.1-.04-.23-.08-.37-.14-.15-.06-.32-.11-.5-.16s-.39-.09-.62-.13c-.23-.04-.5-.06-.78-.06-.09 0-.23 0-.4.02a2.907 2.907 0 0 0-1.24.35c-.23.12-.44.29-.64.5-.14.14-.28.35-.44.63-.15.29-.24.67-.24 1.15 0 .15.02.32.04.51.03.18.09.38.17.57.09.19.22.4.4.6.17.2.4.41.69.61.09.07.19.13.28.18.09.05.18.1.27.16l.9.53c.28.16.53.34.77.53.23.18.4.42.53.72.03.06.06.16.1.28.03.13.05.28.05.45 0 .26-.03.47-.1.64-.07.16-.12.3-.17.38-.2.32-.48.56-.8.71-.33.15-.69.22-1.07.22-.23 0-.45-.03-.63-.07-.18-.05-.35-.11-.49-.19-.14-.07-.25-.16-.35-.25-.09-.09-.17-.17-.22-.25l-.14-.25c-.05-.1-.11-.23-.19-.41l-.02-.05-.3-.03v1.78l.05.02c.23.1.52.22.88.35.37.13.85.2 1.43.2.1 0 .25 0 .44-.01s.41-.04.64-.09c.23-.05.48-.14.73-.26s.5-.3.75-.53c.21-.2.38-.41.5-.61.12-.21.21-.41.28-.61.06-.2.1-.38.12-.54.01-.17.02-.3.02-.4 0-.8-.3-1.48-.88-2.03a2.96 2.96 0 0 0-.56-.47zM264.45 43.22a.69.69 0 0 1-.28-.21.562.562 0 0 1-.13-.27c-.02-.1-.02-.18-.02-.23-.02-.12-.02-.23-.02-.34v-7.39c.01-.16.02-.28.05-.36a.65.65 0 0 1 .13-.25c.06-.06.12-.11.19-.14a.96.96 0 0 1 .2-.07c.07-.02.12-.03.16-.04l.06-.02v-.3h-3.11v.31l.07.02c.04.01.09.02.17.04.07.01.14.04.22.07.07.03.15.09.22.15a.7.7 0 0 1 .17.28c.04.1.05.22.06.35 0 .14.01.33.01.57v6.42c-.01.32-.02.57-.02.75 0 .17-.05.3-.13.42s-.18.2-.29.24c-.11.05-.24.09-.37.11l-.07.02v.33h3.15v-.32l-.06-.02-.36-.12zM265.8 35.29h.33l.02-.07c.01-.05.02-.13.05-.26.02-.11.08-.2.19-.29.09-.08.2-.13.34-.16s.35-.05.61-.06h1.93v7.8c0 .27-.03.47-.09.6a.76.76 0 0 1-.24.31c-.08.07-.17.11-.26.13-.11.03-.18.04-.21.05l-.05.02-.03.32h3.22v-.33l-.07-.02c-.18-.05-.31-.09-.39-.14a.962.962 0 0 1-.22-.18.651.651 0 0 1-.15-.23c-.03-.08-.05-.17-.06-.27-.01-.11-.01-.23-.01-.36v-7.69h2.1c.3 0 .55.04.72.12.16.08.27.27.31.59l.01.07h.31V33.6h-8.36v1.69zM281.4 33.6v.32l.07.01c.12.02.22.04.31.06.07.02.13.07.19.18.04.05.06.1.06.13 0 .05.01.09.01.11 0 .13-.04.25-.11.38-.08.14-.15.27-.22.38l-1.92 3.14-2.01-3.14c-.07-.1-.15-.23-.22-.38a.93.93 0 0 1-.11-.4c0-.1.02-.18.07-.23.05-.06.11-.11.16-.14.06-.03.12-.06.18-.07.08-.02.1-.02.11-.02h.09v-.33h-3.17v.31l.07.02c.1.03.19.06.26.09s.13.07.18.12c.05.04.1.09.15.16.05.07.11.15.18.23.05.06.08.13.12.19.04.07.08.13.13.18l2.81 4.36v2.92c0 .27-.01.46-.03.59-.02.12-.07.23-.16.33-.08.09-.17.15-.26.18-.1.03-.22.06-.36.07l-.07.01-.03.34h3.14v-.33l-.07-.02c-.05-.01-.13-.02-.25-.04a.517.517 0 0 1-.28-.15.638.638 0 0 1-.23-.44c-.02-.2-.03-.39-.03-.56v-2.84l2.81-4.52.27-.41c.08-.13.19-.23.31-.3.08-.05.15-.09.22-.1.09-.02.15-.04.18-.05l.05-.04v-.3h-2.6z\" /></g><g><path d=\"M72.52 16.67h.06c.08 0 .21.01.4.04.19.02.39.09.61.19.22.1.43.25.64.42.2.18.35.43.45.76.1.22.15.51.15.86v21.67c0 .48-.06.88-.19 1.16-.15.5-.42.85-.8 1.04-.38.19-.81.35-1.28.48l-.04.01v.57h8.54v-.57l-.04-.01c-.47-.13-.92-.29-1.33-.47-.4-.18-.7-.51-.91-1.03-.1-.2-.17-.4-.21-.59-.04-.19-.06-.41-.06-.65V30.03h5.93c.59.02 1.21.07 1.82.12.59.05 1.06.32 1.39.81.12.12.22.29.28.51.07.24.14.54.21.88l.01.05h.58v-6.8h-.59v.06c0 .02 0 .1-.06.34-.04.19-.1.4-.17.6-.08.23-.21.45-.37.65-.16.21-.37.37-.62.47-.28.12-.62.2-1 .21-.39.01-.89.02-1.49.02H78.5V18h7.07c.54.02 1.08.09 1.64.18.53.08.96.38 1.29.89.13.2.23.41.31.62.08.22.14.42.2.62l.01.05h.58l.04-4.17v-.06H72.52v.54zM113.03 16.61v.06h.06c.01 0 .08.01.24.06.14.04.31.09.49.14.18.05.37.13.55.23.19.1.34.23.47.38.33.41.5.93.51 1.55.01.61.02 1.15.02 1.62v12.53c0 .68-.02 1.28-.06 1.78-.04.49-.09.95-.16 1.37-.06.39-.15.76-.25 1.09-.1.33-.22.66-.35.99-.19.44-.38.79-.56 1.07-.17.27-.33.5-.44.64a6.7 6.7 0 0 1-2.22 1.58c-.52.24-1.12.44-1.79.61-.68.17-1.45.25-2.3.25-1.27 0-2.51-.23-3.7-.68a7.014 7.014 0 0 1-3.03-2.27c-.39-.52-.7-1.05-.92-1.58-.22-.52-.38-1.07-.49-1.63a13.9 13.9 0 0 1-.2-1.69c-.02-.57-.04-1.18-.04-1.8V20.53c.02-.52.04-1.01.06-1.45.01-.4.08-.76.21-1.07.13-.3.35-.56.65-.77.31-.22.78-.41 1.39-.56l.04-.01.05-.54h-8.28v.54l.04.01c.74.21 1.25.42 1.51.65.37.28.59.66.64 1.13.05.5.08 1.16.08 2.03V33.1c-.03 1.33.01 2.34.12 3.1.11.76.26 1.46.47 2.09.26.73.66 1.48 1.17 2.23.5.74 1.2 1.42 2.05 2.03.84.6 1.9 1.1 3.15 1.48 1.25.38 2.75.57 4.47.57 1.75 0 3.25-.21 4.48-.63 1.23-.41 2.25-.96 3.06-1.62.8-.66 1.43-1.39 1.87-2.19.45-.8.78-1.59.99-2.34.14-.54.23-1.03.29-1.51.07-.54.11-1.01.12-1.44.01-.42.02-.82.02-1.16V20.37c0-.7.01-1.24.04-1.62.02-.37.14-.71.34-1.01.22-.35.5-.59.83-.72.35-.13.72-.25 1.09-.35l.04-.01v-.54h-6.86v.49zM155.18 39.42c-.09.32-.2.64-.31.96-.1.29-.28.56-.54.82-.27.28-.59.44-.94.5-.44.06-.64.08-.75.08-.28.05-.56.07-.81.07h-4.46c-1-.03-1.83-.06-2.54-.1-.71-.03-1.23-.17-1.54-.4-.13-.1-.22-.2-.28-.3-.05-.09-.11-.18-.17-.27-.2-.43-.31-.91-.32-1.42-.02-.59-.04-1.04-.06-1.44v-7.85h5.98c.61 0 1.21.05 1.77.14.56.08 1.01.42 1.34 1 .05.13.11.28.18.43.07.16.14.39.21.7l.01.05h.58v-6.74h-.57l-.01.04c-.02.07-.05.2-.1.42-.05.2-.12.4-.21.61-.1.21-.25.43-.44.65-.19.22-.44.37-.74.47-.33.13-.68.19-1.06.19h-6.94v-9.9h7.39c.5 0 .99.05 1.44.15.43.1.78.4 1.06.91.1.19.19.38.25.57.08.25.13.45.18.63l.01.04.57.05.08-4.29v-.06h-16.93v.55h.06c.08 0 .22.01.43.04.2.02.41.09.63.19.22.11.43.25.63.42.2.18.35.43.46.76.12.3.19.64.19.99v19.66c-.02.37-.03.74-.02 1.12.01.38.01.76-.02 1.15-.02.4-.12.78-.28 1.11-.17.33-.44.59-.83.8-.15.1-.32.18-.51.22-.2.06-.39.11-.6.16l-.04.01-.05.58h19.24v-4.5h-.57l-.05.03zM183.03 16.12v.54l.05.01c.95.21 1.57.51 1.84.91.28.41.45.86.5 1.35.05.28.07.57.06.87-.01.26-.02.48-.02.57v16.68l-18.47-20.91-.02-.02h-5.73v.54l.05.01c.39.05.76.13 1.1.25.34.11.6.35.81.74.18.28.27.6.29.97.02.35.02.81.02 1.54v19.66c0 .35-.02.8-.06 1.34-.04.53-.19.94-.44 1.24-.28.38-.6.61-.98.7-.33.08-.62.14-.78.18l-.04.01-.05.58h6.94v-.58l-.05-.01c-.6-.13-1.08-.33-1.45-.6-.36-.26-.61-.71-.74-1.35l-.06-.62c-.01-.21-.02-.51-.02-.9V20.17l21.32 24.12.02.02h.44V20.3c.02-.5.05-.98.07-1.45l.01-.21c.02-.51.28-.96.76-1.34.15-.13.33-.24.55-.35.23-.1.53-.19.91-.27l.05-.01.05-.54h-6.93zM124.04 16.66l.05.01c.43.07.86.2 1.26.38.39.18.67.5.85.98.16.52.23 1.4.23 2.69v23.14c0 1.1-.07 2.18-.2 3.22s-.56 2.01-1.28 2.89c-.27.34-.58.67-.97 1.01-.34.28-.58.49-.66.54l-.05.03.33.57.05-.02c.67-.31 1.21-.57 1.59-.79.36-.2.69-.4 1-.63.87-.55 1.55-1.16 2.03-1.79.5-.66.86-1.27 1.1-1.88.25-.6.41-1.19.48-1.76.06-.55.11-1.03.14-1.44v-23.1c0-1.09.05-1.88.14-2.42.08-.53.41-.95.96-1.25.17-.1.33-.17.48-.23.13-.05.38-.1.75-.15l.05-.01v-.54h-8.34v.55z\" /></g><g><path d=\"M24.33 23.47h-.44v.5H22.7v.97h1.18v.64H22.7v5.26h1.18v.65H22.7v.97h1.18v.7h.44v-.7h1.17v-.96h-1.17v-.65h1.17v-5.26h-1.17v-.64h1.17v-.97h-1.17v-.51zm-.44 5.24v1.17h-.74v-1.17h.74zm0-2.15v1.17h-.74v-1.17h.74zm1.17 2.15v1.17h-.73v-1.17h.73zm-.73-.98v-1.17h.73v1.17h-.73zM27.64 25.59v-.64h1.17v-1.47h-.44v.5h-.73v-.5h-.44v.5h-1.16v.97h1.16v.64h-1.16v7.54h.44v-2.29h.72v2.32h.44v-2.32h.73v2.29h.44v-7.54h-1.17zm-.45 3.12v1.17h-.72v-1.17h.72zm0-2.15v1.17h-.72v-1.17h.72zm1.18 2.15v1.17h-.73v-1.17h.73zm0-2.15v1.17h-.73v-1.17h.73zM28.47 17.45l-.99-.14-.46-.91-.44.91-1.01.14.73.71v.02l-.17.98.89-.48.9.48-.17-1zM23.69 20.45l-1.01-.15v-.01l-.44-.89-.45.9-1 .15.72.71v.02l-.17.98.9-.48.89.48-.17-1zM20.13 26.09l.71-.69-1-.14-.46-.91-.44.91-1 .14.72.71-.17.99.89-.46.03.01.87.46-.17-1zM20.98 31.14l-1.01-.15-.45-.91-.44.91-1 .15.72.7-.01.02-.16.98.89-.47.03.01.87.46-.17-1zM23.26 36.63l.7-.69-1-.14-.01-.02-.44-.89-.45.91h-.02l-.98.14.73.71-.17 1 .89-.47.9.47-.17-1zM28.82 38.79l-1-.14-.45-.91-.45.91h-.02l-.98.14.73.71-.01.02-.16.98.89-.48.9.48-.17-1z\" /><path d=\"M41.44 12.55c-.25 0-.5.02-.75.06-.55.07-1.11.11-1.68.11a12.636 12.636 0 0 1-7.14-2.2c-.11-.08-.33-.23-.33-.23-.42-.3-.93-.47-1.48-.47-.55 0-1.06.17-1.48.47 0 0-.22.15-.33.23-.13.08-.25.17-.38.25-.26.16-.52.31-.79.46-1.78.95-3.82 1.49-5.97 1.49-.57 0-1.14-.04-1.69-.11-.24-.04-.49-.05-.74-.05-2.88 0-5.21 2.33-5.21 5.21v10.7c0 .2-.01.41-.01.61 0 9.63 6.84 17.65 15.93 19.49.22.03.44.05.66.05.21 0 .42-.01.63-.04 9.06-1.82 15.89-9.79 15.95-19.37V17.75c.02-2.87-2.31-5.2-5.19-5.2zM30.06 47.51c-.2 0-.4-.02-.6-.04-8.58-1.73-15.04-9.3-15.04-18.39l-.09-10.95h.01c.1-2.63 1.87-4.66 4.51-4.66.23 0 .67.01.9.04.53.07 1.09.14 1.64.14 2.04 0 4.17-.46 5.85-1.35.25-.14.51-.28.75-.44.12-.07.24-.15.36-.23.1-.07.2-.14.31-.22.39-.28.89-.5 1.41-.5l-.01 36.6zM40.6 23.68l.51 1.04 1.15.17-.83.81.2 1.14-1.03-.54-1.03.54.2-1.15-.83-.81 1.15-.17.51-1.03zm-3.37-3.66.52-1.04.51 1.04 1.15.17-.83.81.2 1.14-1.03-.54-1.03.54.2-1.14-.83-.81 1.14-.17zm-3.46 5.18v-1.3h4.06v1.29h-4.06zm4.07 6.41v1.29h-4.06v-1.29h4.06zm-5.62-14.4.52-1.04.52 1.04 1.15.17-.84.81.2 1.15-1.03-.54-1.03.54.2-1.15-.83-.81 1.14-.17zm-1.18 10.06v-1.29h.08c.01 0 .37 0 .72-.16.41-.18.61-.5.61-.96v-1.49h.82v1.95c.01.18.01.8-.43 1.31v6.59h-.82v-6.06c-.26.08-.56.13-.9.13h-.08zm3.21 13.27L33.22 40l-1.03.54.19-1.15-.83-.81 1.15-.17.52-1.05.51 1.05 1.15.17-.83.81.2 1.15zm4.82-2.98-1.03-.54-1.03.54.2-1.15-.83-.81 1.15-.17.52-1.05.51 1.05 1.15.17-.83.81.19 1.15zm2.7-5.01-1.03-.54-1.03.54.2-1.15-.83-.81 1.15-.17.51-1.04.52 1.04 1.15.17-.84.81.2 1.15z\" /><g><path style=\"fill-rule:evenodd;clip-rule:evenodd\" d=\"M14.96 6.71c.05.01.11.01.16.01 1.49-.24 3.81-1.78 4.75-2.98.02-.02.04-.05.04-.08.03-.11-.04-.21-.15-.24-2.04 0-4.46 1.27-5.14 2.57-.01.03-.03.06-.04.09-.07.29.1.56.38.63zM5.75 15.59c.06 0 .12-.01.18-.03 0 0 .01-.01.02-.01.06-.02.11-.06.16-.11 1.39-1.83 1.83-4 1.97-6.17-.01-.11-.09-.19-.2-.19h-.03c-.05.01-.09.03-.12.06-.27.28-.57.6-.78.87-1.07 1.31-1.78 2.76-1.78 4.49 0 .24.02.48.09.72.05.21.25.37.49.37zM1.88 29.47c.09.06.18.09.29.09.06 0 .12-.01.18-.03.01 0 .01 0 .02-.01.09-.04.17-.1.23-.18.06-.07.09-.16.1-.25.24-1.96-.78-5.9-1.87-6.99-.04-.03-.09-.06-.14-.06H.66c-.04.01-.08.03-.12.06-.02.02-.03.04-.04.07-.49 2.06-.49 4.08.41 6.05.23.5.56.91.97 1.25zM11.92 12.92c.01-.02.01-.04.02-.06v-.01c0-.11-.07-.19-.17-.21-2.15-.04-4.51 1.68-5.09 3.25-.01.05-.02.1-.02.15 0 .05.01.09.02.14.06.23.27.4.53.4.04 0 .08-.01.12-.02 1.53-.41 3.83-2.18 4.59-3.64zM9.65 9.77c.05.02.11.03.16.02h.02a.48.48 0 0 0 .17-.05c1.78-1.25 2.81-3.08 3.57-5 .02-.1-.03-.2-.13-.23-.01 0-.02-.01-.03-.01-.04-.01-.08 0-.12.02-.32.18-.68.37-.96.55-1.34.87-2.41 1.97-2.91 3.53-.06.23-.11.45-.12.68 0 .22.13.42.35.49zM15.88 8.12c.01-.02.02-.04.02-.06v-.01c.01-.1-.05-.18-.14-.21-2.03-.22-4.4 1.2-5.08 2.62-.02.05-.03.09-.04.14 0 .05 0 .09.01.13.04.22.22.4.46.42h.11c1.5-.25 3.82-1.72 4.66-3.03zM4.73 23.11c.06 0 .12-.02.17-.03 1.55-.72 3.23-3.1 3.85-4.77.01-.02.01-.03.01-.05v-.01c0-.02 0-.04-.01-.05a.183.183 0 0 0-.18-.14c-1.75.04-4.11 2.55-4.4 4.49v.06c0 .05.01.09.03.14.01.04.03.08.05.12.09.14.27.25.48.24zM2.56 22.04c.11.14.28.24.47.23.07 0 .13-.02.19-.04.01 0 .01 0 .02-.01a.485.485 0 0 0 .26-.24c.77-1.64.98-4.91.36-6.75-.03-.09-.11-.16-.21-.15h-.03c-.05.01-.09.03-.12.07-.01.01-.01.02-.02.03-.2.35-.39.66-.55.99-.74 1.55-1.12 3.16-.74 4.89.06.34.18.67.37.98zM3.55 29.35c.03.1.09.19.17.25a.513.513 0 0 0 .52.1c.01 0 .01 0 .02-.01.05-.02.1-.05.14-.08 1.4-1.14 2.49-4.12 2.63-5.7 0-.06-.02-.11-.06-.14a.204.204 0 0 0-.15-.06c-1.93.58-3.64 3.62-3.27 5.64zM2.26 36.3c.18.18.38.33.61.45.08.03.17.06.26.06a.62.62 0 0 0 .46-.21c.03-.03.06-.07.09-.12.02-.04.04-.09.05-.14.01-.05.02-.1.02-.16-.2-2.11-2.01-5.21-3.33-6.47a.31.31 0 0 0-.13-.06H.24c-.01 0-.03 0-.04.01-.07.02-.13.07-.16.13-.01.02-.02.04-.02.06-.07 1.75.27 3.38 1.05 4.9.28.56.74 1.07 1.19 1.55zM16.1 53.19c.08-.04.16-.09.22-.16a.38.38 0 0 0 .09-.13c.06-.1.09-.22.09-.34 0-.19-.08-.35-.19-.48-.03-.03-.06-.05-.09-.08-1.87-1.29-5.38-2.04-7.33-1.85-.07.02-.14.06-.18.12-.02.03-.03.06-.04.09-.01.03-.01.06-.01.09s.01.06.02.08c.01.02.01.03.02.05.01.01.02.03.03.04a10.54 10.54 0 0 0 3.82 2.37c.93.34 1.88.52 2.87.35.24-.02.47-.07.68-.15zM6 43.32a.566.566 0 0 0 .51-.32c.02-.04.04-.09.06-.14a.88.88 0 0 0 .02-.17v-.06c-.01-.05-.02-.1-.04-.14-1.15-2.32-3.04-3.83-5.18-5.14-.03-.01-.05-.02-.08-.03h-.05c-.02 0-.03 0-.04.01-.07.02-.13.06-.16.13-.01.02-.02.04-.02.06v.08c.58 2.09 1.64 3.87 3.45 5.14.44.33.95.51 1.53.58zM4.78 36.43c.04.04.08.08.12.11.02.01.04.03.07.04.09.05.19.07.3.07.07 0 .14-.02.21-.04.1-.03.18-.09.25-.17l.01-.01C6.8 35 7.14 31.9 6.89 30.06c0-.04-.01-.08-.04-.1a.265.265 0 0 0-.05-.06c-.04-.03-.09-.06-.14-.06h-.05c-.01 0-.03 0-.04.01-.03.01-.05.02-.07.04-2 1.68-2.5 4.8-1.79 6.44.02.02.04.06.07.1zM10.12 48.57c.03 0 .07-.01.1-.02.09-.03.18-.1.25-.17.03-.03.06-.07.08-.11.02-.05.04-.09.06-.14a.88.88 0 0 0 .02-.17v-.06a.664.664 0 0 0-.06-.2.36.36 0 0 0-.07-.1c-1.45-1.6-4.75-3.36-6.57-3.46H3.9c-.01 0-.03 0-.04.01-.07.02-.13.07-.16.13-.01.02-.02.04-.02.06 0 .01-.01.02-.01.03v.05c0 .02.01.04.01.05 0 .02.01.03.02.04.98 1.8 3.66 4.07 5.77 4.11.22 0 .43-.02.65-.05zM7.49 42.71l.06.09c.04.04.08.08.12.11.02.01.04.03.07.04.06.03.13.06.2.06.03.01.06.01.09.01.07 0 .14-.01.21-.04.1-.03.18-.09.25-.17a.36.36 0 0 0 .08-.12c.01-.01.01-.03.01-.04.13-.34.25-.68.31-1.03.26-1.39.09-2.78-.2-4.15-.07-.32-.15-.64-.24-.99 0-.02-.01-.05-.03-.07a.12.12 0 0 0-.05-.05c-.01-.01-.03-.02-.04-.03a.3.3 0 0 0-.1-.04h-.05c-.01 0-.03 0-.04.01-.05.02-.1.05-.13.08-.01.02-.03.04-.05.06-1.03 1.45-1.45 3.06-1.08 4.8.13.52.36 1 .61 1.47zM11.89 47.98c.01.01.02.02.04.02.06.03.13.06.2.07.03 0 .06.01.09.01h.07l.14-.03c.09-.03.18-.1.25-.17.03-.03.06-.07.08-.11.02-.03.03-.07.04-.11.35-1.7-.56-4.55-1.63-6.22-.01-.01-.02-.03-.04-.04a.138.138 0 0 0-.04-.03.193.193 0 0 0-.1-.03h-.04c-.02 0-.03.01-.04.01a.27.27 0 0 0-.15.11c-1.03 1.85-.66 4.95 1.13 6.52zM17.12 51.77c.09.05.2.08.31.08h.05c.07 0 .13-.02.18-.04.11-.04.21-.1.28-.19.04-.04.07-.08.1-.13.05-.1.08-.22.08-.34-.21-2.26-1.54-3.99-2.95-5.73a.16.16 0 0 0-.09-.07.193.193 0 0 0-.1-.03h-.06c-.02 0-.03 0-.05.01-.07.02-.13.06-.17.12-.02.02-.03.05-.03.08-.63 2.04.7 5.2 2.45 6.24zM22.81 54.85c-.05-.03-.11-.06-.16-.09-2.13-.73-5.68-.51-7.52.19-.05.02-.1.06-.13.1-.02.03-.04.06-.04.09 0 .01 0 .02-.01.03v.06c0 .03.01.06.02.08.01.02.01.03.02.05.01.02.03.04.04.06.02.01.03.02.05.03 1.34.73 2.79 1.15 4.31 1.26.99.07 1.96 0 2.87-.43.21-.1.41-.22.59-.34.03-.02.05-.04.07-.06.04-.04.07-.08.1-.13.05-.1.08-.22.08-.34a.69.69 0 0 0-.19-.48c-.03-.02-.06-.05-.1-.08z\" /><path style=\"fill-rule:evenodd;clip-rule:evenodd\" d=\"M36.54 54.51c2.12-.19 4.45-3.61 4.11-5.98v-.01c-.01-.03-.02-.06-.04-.09-.04-.06-.1-.1-.17-.12-.02 0-.03-.01-.05-.01h-.06c-.04 0-.07.02-.1.03-.02.01-.04.02-.05.04-1.78 1.6-3.47 3.19-3.92 5.64-1.35.35-3.77 1.02-6.17 1.89-2.4-.87-4.82-1.54-6.17-1.89-.45-2.45-2.13-4.05-3.92-5.64a.218.218 0 0 0-.05-.04.193.193 0 0 0-.1-.03h-.06c-.02 0-.03 0-.05.01-.07.02-.13.06-.17.12-.02.03-.03.06-.04.09v.01c-.34 2.37 1.99 5.79 4.11 5.98 1.46.3 3.43.97 5.36 1.79-2.1.82-4.04 1.78-5.06 2.8l.75.9c.94-.94 3.07-2.14 5.4-3.21 2.33 1.06 4.46 2.27 5.4 3.21l.76-.89c-1.02-1.02-2.96-1.98-5.06-2.8 1.93-.83 3.89-1.5 5.35-1.8zM40.31 3.74c.94 1.2 3.26 2.74 4.75 2.98.05 0 .1 0 .16-.01.28-.07.45-.34.38-.62 0-.03-.02-.06-.04-.09-.69-1.3-3.11-2.57-5.14-2.57-.11.03-.17.13-.15.24.01.03.03.05.04.07zM54.23 15.55s.01.01.02.01a.537.537 0 0 0 .69-.35c.06-.24.09-.48.09-.72 0-1.73-.72-3.18-1.78-4.49-.22-.27-.52-.59-.78-.87a.238.238 0 0 0-.11-.06h-.04c-.11 0-.2.09-.2.19.14 2.17.58 4.35 1.97 6.17.03.06.08.1.14.12zM57.46 29.1c.01.09.05.18.1.25a.578.578 0 0 0 .25.19c.06.02.12.03.18.03.11 0 .21-.03.29-.09.42-.33.74-.75.97-1.24.9-1.97.9-3.99.41-6.05-.01-.02-.02-.05-.04-.07a.228.228 0 0 0-.12-.06h-.03c-.06 0-.11.02-.14.06-1.09 1.08-2.1 5.01-1.87 6.98zM52.98 16.58c.25 0 .47-.17.53-.4.01-.05.02-.09.02-.14 0-.05-.01-.1-.03-.15-.57-1.57-2.94-3.28-5.09-3.25-.1.02-.17.1-.17.21v.01c0 .02.01.04.02.06.76 1.46 3.06 3.23 4.6 3.64.04.01.08.02.12.02zM50.17 9.74c.06.02.12.04.18.05h.02c.05 0 .11-.01.17-.02a.5.5 0 0 0 .35-.48c-.01-.23-.06-.46-.13-.68-.5-1.56-1.57-2.66-2.91-3.53-.29-.18-.65-.38-.97-.55-.04-.02-.08-.03-.12-.02-.01 0-.02 0-.03.01a.18.18 0 0 0-.12.23c.75 1.92 1.78 3.75 3.56 4.99zM49.06 11.16c.24-.02.42-.2.46-.42.01-.04.01-.09 0-.13 0-.05-.02-.1-.04-.14-.68-1.43-3.05-2.84-5.08-2.62-.09.03-.15.11-.14.21v.01c0 .02.01.04.02.06.84 1.31 3.16 2.78 4.65 3.04.06-.01.09 0 .13-.01zM51.42 18.19c0 .02-.01.03-.01.05v.01c0 .02.01.03.01.05.62 1.67 2.3 4.05 3.85 4.77.05.02.11.03.17.03a.545.545 0 0 0 .54-.39.59.59 0 0 0 .02-.14v-.06c-.3-1.95-2.65-4.45-4.4-4.49-.08.03-.15.08-.18.17zM56.72 22.02a.603.603 0 0 0 .25.2c.06.02.12.04.19.04.19.01.36-.08.47-.23.18-.3.31-.64.39-.99.38-1.72 0-3.34-.74-4.89-.16-.32-.34-.64-.55-.99-.01-.01-.01-.02-.02-.03a.24.24 0 0 0-.12-.07h-.03c-.1 0-.19.06-.21.15-.62 1.85-.42 5.12.36 6.75-.01.03 0 .05.01.06zM55.93 29.7c.06.02.12.03.18.03a.56.56 0 0 0 .52-.38c.37-2.02-1.33-5.06-3.27-5.64-.06 0-.11.02-.15.06-.04.04-.06.09-.06.14.14 1.58 1.23 4.56 2.63 5.7.04.03.09.06.14.08 0 .01 0 .01.01.01zM59.94 29.64h-.05a.31.31 0 0 0-.13.06c-1.32 1.26-3.12 4.37-3.32 6.47 0 .06.01.11.02.16s.03.09.05.14c.02.04.05.08.08.12.07.08.15.14.25.17.07.02.14.04.21.04.09 0 .18-.02.26-.06.22-.12.43-.27.6-.45.45-.47.91-.99 1.2-1.56.78-1.52 1.12-3.15 1.05-4.9 0-.02-.01-.04-.02-.06a.262.262 0 0 0-.16-.13c-.01.01-.02 0-.04 0zM51.46 50.28c-.04-.06-.1-.1-.18-.12-1.96-.19-5.47.56-7.33 1.85-.03.02-.06.05-.08.08-.12.12-.19.29-.2.48 0 .12.03.24.09.34.03.05.06.09.09.13.06.07.14.12.22.16.22.08.44.13.67.17.99.17 1.95-.02 2.87-.35 1.44-.52 2.72-1.3 3.82-2.37.01-.01.02-.03.03-.04.01-.02.02-.03.02-.05.01-.02.02-.05.02-.08s0-.06-.01-.09a.18.18 0 0 0-.03-.11zM59.17 37.53c0-.02-.01-.04-.02-.06a.262.262 0 0 0-.16-.13c-.01 0-.03 0-.04-.01h-.05c-.03 0-.05.01-.08.03-2.15 1.31-4.03 2.82-5.18 5.14-.02.04-.04.09-.04.14v.06c0 .06.01.11.02.17.01.05.03.09.06.14.02.04.05.08.08.12.07.07.15.13.25.17.06.02.12.03.18.03a3.24 3.24 0 0 0 1.54-.57c1.82-1.27 2.87-3.05 3.45-5.14v-.05c-.01-.02-.01-.03-.01-.04zM54.46 36.44c.07.08.15.13.25.17.07.02.13.04.21.04.11 0 .21-.03.3-.07.02-.01.04-.03.07-.04.04-.03.08-.07.12-.11.03-.03.05-.07.07-.11.71-1.64.21-4.75-1.78-6.44-.02-.01-.04-.03-.07-.04-.01 0-.03-.01-.04-.01h-.05a.35.35 0 0 0-.14.06c-.02.02-.03.03-.04.06-.02.03-.03.07-.03.1-.28 1.85.06 4.95 1.13 6.39-.01 0 0 0 0 0zM56.49 44.33c0-.02-.01-.04-.02-.06a.262.262 0 0 0-.16-.13c-.01 0-.03 0-.04-.01h-.03c-1.82.1-5.12 1.86-6.57 3.46-.03.03-.05.07-.07.1-.03.07-.05.13-.06.2v.06c0 .06.01.11.02.17.01.05.03.09.06.14.02.04.05.08.08.11.07.08.15.14.25.17.03.01.06.02.1.02.22.02.44.04.65.04 2.11-.04 4.8-2.31 5.77-4.11.01-.01.01-.03.02-.04s.01-.03.01-.05v-.05s0-.01-.01-.02zM51.59 42.66c0 .01.01.02.02.04.02.04.05.08.08.12.07.07.15.13.25.17.07.02.14.04.21.04.03 0 .06 0 .09-.01.07-.01.14-.03.2-.06.02-.01.04-.03.06-.04.05-.03.09-.07.12-.11l.06-.09c.25-.47.48-.95.59-1.45.37-1.74-.04-3.36-1.08-4.8-.01-.02-.03-.04-.04-.06a.222.222 0 0 0-.13-.08c-.01 0-.03-.01-.04-.01h-.05c-.04 0-.07.02-.1.04-.02.01-.03.02-.04.03-.02.02-.03.03-.04.05-.01.02-.02.04-.03.07-.09.36-.17.68-.24.99-.28 1.37-.45 2.76-.2 4.15.06.33.18.68.31 1.01zM49.26 41.33c-.01 0-.03-.01-.04-.01h-.05c-.04 0-.07.02-.1.03-.02.01-.03.02-.04.03-.01.01-.02.03-.03.04-1.06 1.67-1.98 4.52-1.62 6.22.01.04.03.07.04.11.02.04.05.08.08.11.07.08.15.14.25.17.05.01.09.03.14.03h.06c.03 0 .06 0 .09-.01a.48.48 0 0 0 .2-.07c.01-.01.03-.02.04-.02 1.78-1.56 2.15-4.66 1.11-6.54a.228.228 0 0 0-.13-.09zM45.31 45.33c-.01 0-.03-.01-.05-.01h-.06l-.1.03c-.04.02-.07.04-.09.07-1.41 1.74-2.75 3.47-2.95 5.73 0 .12.03.24.09.34.02.05.06.09.09.13.08.08.17.15.28.19.06.02.12.03.18.04h.05c.11 0 .21-.03.31-.08 1.75-1.04 3.08-4.21 2.46-6.25-.01-.03-.02-.05-.03-.08a.367.367 0 0 0-.18-.11z\" /><path style=\"fill-rule:evenodd;clip-rule:evenodd\" d=\"M45.22 55.15c-.01-.03-.02-.07-.04-.09a.256.256 0 0 0-.13-.1c-1.84-.7-5.39-.91-7.52-.19-.06.02-.12.05-.17.09-.03.02-.07.05-.09.08a.68.68 0 0 0-.2.48c0 .12.03.24.08.34.03.05.06.09.1.13.02.02.05.04.07.06.18.13.38.24.59.34.91.43 1.88.5 2.86.43 1.53-.11 2.96-.53 4.31-1.26.02-.01.03-.02.05-.03.02-.02.03-.04.04-.06.01-.01.02-.03.02-.05.01-.03.02-.05.02-.08v-.06c.01-.01.01-.03.01-.03z\" /></g><path d=\"M33.07 3.15V1.74c-.65-.07-1.36-.11-2.17-.13h-.05V0h-1.58v1.6h-.05c-.81.02-1.52.07-2.18.13v1.41c.65-.07 1.36-.11 2.17-.14h.06v4.57h1.58V3.01h.06c.81.03 1.52.08 2.16.14z\" /></g></symbol>"
});
var result = _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default().add(symbol);
/* harmony default export */ __webpack_exports__["default"] = (symbol);

/***/ }),

/***/ 2685:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3465);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2594);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__);


var symbol = new (_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default())({
  "id": "logo_large",
  "use": "logo_large-usage",
  "viewBox": "0 0 320 260",
  "content": "<symbol xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 320 260\" id=\"logo_large\"><path d=\"M17.75 210.89c1.32 5.25 5.52 10.38 15.06 13.42l-.03.41c-2.05.38-3.26 1.49-3.57 3.77-7.95-3.98-10.79-10.86-11.9-16.68-1.25 7.37-5.03 12.87-17.03 16.68l-.29-.51c9.47-4.57 12.25-10.14 13.08-17.09H1.2l-.28-1h12.25c.24-2.8.24-5.78.24-9.06H3.22l-.28-1.01h20.64l2.39-3.01s2.7 2.04 4.37 3.46c-.1.38-.52.56-1.01.56h-11.3c-.07 3.28-.14 6.29-.42 9.06h8.02l2.43-3.05s2.74 2.04 4.37 3.5c-.1.38-.49.55-1.01.55H17.75zM75.94 222.72s2.78 2.11 4.51 3.56c-.1.38-.49.56-1.01.56H48.22l-.28-.97h13.91v-10.45H52l-.28-1.01h10.13v-8.85h-11.3l-.28-.97H72.2l2.43-3.04s2.71 2.03 4.37 3.46c-.1.38-.49.56-1.01.56H66.33v8.85h4.72l2.36-2.94s2.64 1.97 4.23 3.39c-.07.38-.49.56-.94.56H66.33v10.45h7.15l2.46-3.16zm-17.52-26.49c12.14.69 9.75 9.41 5.27 7.09-.97-2.49-3.44-5.22-5.52-6.81l.25-.28zM126.06 204.8c-.59 5.32-1.91 10.03-4.55 13.97 1.94 2.42 4.44 4.4 7.53 5.84l-.1.35c-1.91.38-3.05 1.46-3.54 3.28-2.57-1.79-4.47-4.15-5.9-6.95-2.81 3.04-6.73 5.46-12.14 7.13l-.24-.35c5.2-2.7 8.67-6.12 10.93-10.1-.9-2.59-1.56-5.46-2.01-8.55-1.18 1.97-2.57 3.71-4.16 5.15l-.45-.27c1.01-2 1.95-4.47 2.74-7.16-.1.03-.21.03-.35.03h-5.62a43.484 43.484 0 0 1-3.47 3.6h2.53l1.84-1.9 3.4 2.94c-.28.28-.66.35-1.35.42-1.11.66-2.46 1.49-3.82 2.14l1.11.11c-.1.52-.42.76-1.14.86v1.42c2.08-.28 4.34-.59 6.56-.9l.07.49c-1.77.69-3.96 1.49-6.63 2.39v5.15c0 2.73-.59 4.19-5.03 4.61-.1-1.22-.28-2.11-.8-2.66-.56-.59-1.28-1.01-2.95-1.29v-.48s3.57.2 4.27.2c.52 0 .69-.14.69-.56V220c-1.46.48-3.05.97-4.75 1.49-.17.42-.56.73-.94.83l-1.7-4.19c1.56-.14 4.2-.42 7.39-.83v-3.25l2.05.17c.55-.76 1.11-1.67 1.56-2.42h-3.5c-2.32 1.97-4.93 3.77-7.88 5.19l-.35-.38c1.98-1.39 3.85-3.04 5.55-4.81h-3.33l-.31-1h4.55c1.04-1.15 2.01-2.35 2.91-3.6h-8.74l-.28-1.01h5.76v-4.46h-4.09l-.28-.97h4.37v-4.68l5.14.42c-.07.52-.35.83-1.28.97v3.29h.1l1.63-2.21s.97.8 1.91 1.67c.66-1.28 1.18-2.52 1.63-3.7l4.55 2.18c-.21.38-.56.59-1.42.45a43.434 43.434 0 0 1-4.68 7.05h1.08l1.63-2.14s1.53 1.22 2.67 2.28c.87-3.21 1.56-6.71 1.87-10.17l5.58 1.32c-.1.45-.52.77-1.35.8-.49 1.97-1.08 3.81-1.73 5.53h4.03l2.15-2.76s2.43 1.93 3.85 3.22c-.1.38-.45.56-.94.56h-1.83v-.04zm-20.76 1.39h.14c1.01-1.49 1.91-2.97 2.74-4.46h-2.88v4.46zm13.09-1.39c-.52 1.25-1.11 2.42-1.7 3.53.62 2.63 1.46 4.99 2.6 7.09 1.35-3.25 2.05-6.81 2.32-10.62h-3.22zM168.71 203.18v3.08h2.36l1.67-1.87 3.54 2.73c-.21.24-.66.52-1.28.63v16.33c0 2.62-.45 4.01-3.89 4.33-.04-1.11-.07-2.07-.31-2.59-.24-.59-.62-.97-1.46-1.14v-.49s1.22.07 1.63.07c.38 0 .45-.17.45-.55v-4.85h-2.71v7.96c0 .45-1.49 1.28-2.81 1.28h-.69v-9.23h-2.43v8.38c0 .38-1.35 1.18-2.84 1.18h-.56v-7.23h-6.18v6.33c0 .2-1.14 1.01-2.98 1.01h-.66v-7.34h-5.69l-.28-.97h5.97v-4.15h-1.49v.83c0 .32-1.42 1.08-2.81 1.08h-.52v-14.36l3.5 1.42h1.32v-3.15h-5.66l-.28-.97h5.93v-4.85l4.79.41c-.03.45-.31.77-1.14.9v3.53h.83l1.98-2.59s2.25 1.76 3.64 3.01c-.1.38-.45.56-.94.56h-5.52v3.15h1.32l1.49-1.56 3.16 2.35c-.17.24-.59.48-1.14.59v9.82c-.03.28-1.59 1.04-2.67 1.04h-.55v-1.22h-1.6v4.15h1.35l1.98-2.55s1.53 1.21 2.84 2.31v-15.26l3.58 1.56h2.25v-3.08h-6.32l-.28-.97h6.59v-5.91l4.89.49c-.1.52-.38.93-1.39 1.07v4.36h2.25l1.32-1.76c-.14-1.22-1.01-2.63-1.84-3.42l.31-.21c5.34.25 5.17 3.22 3.57 3.95.73.59 1.56 1.28 2.19 1.86-.1.38-.45.56-.94.56h-6.84v-.04zm-20.65 2.84v4.12h1.66v-4.12h-1.66zm0 9.02h1.66v-3.94h-1.66v3.94zm4.96-9.02v4.12h1.77v-4.12h-1.77zm1.78 9.02v-3.94h-1.77v3.94h1.77zm7.97-7.82v4.67h2.43v-4.67h-2.43zm2.43 10.62v-4.98h-2.43v4.98h2.43zm3.51-10.62v4.67h2.71v-4.67h-2.71zm2.7 10.62v-4.98h-2.71v4.98h2.71zM204.45 197.81c-.14.45-.59.77-1.39.73-1.08 2.66-2.29 5.09-3.68 7.23l1.59.59c-.1.31-.41.52-1.07.66v20.27c-.07.32-1.74 1.18-3.33 1.18h-.8v-18.03a29.725 29.725 0 0 1-4.34 3.88l-.38-.28c3.02-4.29 6.04-11.21 7.56-18.06l5.84 1.83zm15.42 22.9s2.71 2.18 4.34 3.7c-.1.38-.49.56-1.04.56h-21.72l-.31-1.11h16.34l2.39-3.15zm-17.05-17.49h13.22l2.32-3.11s2.64 2.18 4.27 3.7c-.1.35-.48.52-1.04.52h-18.46l-.31-1.11zM257.34 207.46c1.22 6.4 5.24 12.76 14.95 16.68l-.07.38c-2.12.38-3.37 1.66-3.75 4.01-8.08-4.91-10.69-13.32-11.62-20.24-1.04 8.24-4.51 15.3-17.11 20.24l-.31-.52c9.64-5.81 12.35-12.66 13.11-20.55h-12.53l-.28-1.01h12.87c.24-3.25.21-6.71.21-10.31l5.83.55c-.1.52-.42.87-1.25 1.01-.07 3.01-.1 5.95-.35 8.75h7.81l2.57-3.15s2.81 2.11 4.55 3.6c-.1.38-.49.56-1.01.56h-13.62zM292.15 210.17c.31 2-.28 3.6-1.84 4.29-2.64 1.11-4.41-2.21-1.49-3.74.97-.48 1.91-1.79 1.87-3.77l.42-.04c.38.8.66 1.56.87 2.28h.49l-.35-11.66 3.16.62c1.07-.76 2.15-1.63 2.74-2.18l2.78 2.11.1-.1c1.04.04 1.94.17 2.67.35.52-.69.94-1.42 1.25-2.07l3.19 1.63c-.14.32-.48.38-1.11.25-.31.41-.73.8-1.18 1.21 1.73 1.39.93 3.22-.7 2.66a9.65 9.65 0 0 0-1.14-1.25c-1.14.76-2.43 1.45-3.64 1.93l-.07-.11c-.1.28-.42.38-.8.38h-3.54l.1 2.66h.8l1.28-1.7s1.46 1.22 2.36 2.14c-.1.38-.42.55-.87.55h-3.57l.1 2.56h14.92l.1-2.56h-2.85l-.28-1h3.19l.1-2.66h-2.88l-.31-.97h3.26l.14-2.69h-3.44l-.28-1.01h3.4l1.53-1.79 3.64 2.76c-.28.28-.56.42-1.22.49l-.45 9.09 1.77-1.73 3.61 3.46c-.28.28-.62.35-1.32.38-1.32.8-3.54 1.93-5 2.59l-.31-.24c.28-.8.69-2.11 1.01-3.15h-22.21v.03zm23.04 6.02s2.43 2 3.85 3.36c-.1.38-.45.55-.97.55h-12.35v3.6c0 2.83-.63 4.39-5.31 4.81-.1-1.28-.31-2.18-.87-2.84-.55-.62-1.35-1.08-3.19-1.35v-.49s3.92.25 4.68.25c.52 0 .7-.14.7-.59v-3.39h-13.29l-.28-1.01h13.57v-2.77l3.09.28c.87-.76 1.77-1.63 2.5-2.38h-12.38l-.31-1.01h13.25l2.19-2.07 3.75 3.28c-.31.28-.66.38-1.42.42-1.53.59-3.54 1.35-5.52 1.93-.07.52-.42.76-1.14.87v1.46h7.28l2.17-2.91zm-17.28-15.79s1.18.9 2.05 1.73c.9-.69 1.8-1.59 2.6-2.52-.56-.41-1.14-.8-1.66-1.11-.21.07-.52.04-.87-.07-.97.32-2.6.66-4.3.9l.07 2.66h.87l1.24-1.59zm10.62 3.47c-.17.35-.55.42-1.11.28-.35.49-.83.94-1.35 1.42 1.77 1.6.83 3.6-.94 2.87-.24-.45-.59-.97-1.04-1.46-1.32.83-2.81 1.52-4.27 1.97l-.28-.52c1.14-.73 2.29-1.67 3.26-2.7-.7-.59-1.46-1.14-2.12-1.56l.35-.35c1.18.1 2.15.27 2.95.55.56-.66.97-1.39 1.32-2.04l3.23 1.54z\" /><g><path d=\"m89.32 244.6.04.05h.41l.01-.11.07-2.36-.09-.03c-.53-.16-1-.28-1.42-.36-.43-.1-.81-.16-1.14-.21-.34-.05-.65-.09-.94-.1-.29-.01-.57-.02-.84-.02-.26 0-.62.02-1.08.04-.45.02-.96.1-1.53.24-.57.14-1.15.36-1.78.65-.62.31-1.22.73-1.78 1.26-.51.48-.91.98-1.22 1.5-.29.5-.51 1-.66 1.48-.15.47-.25.91-.29 1.32-.04.41-.06.73-.06.98 0 .74.1 1.46.29 2.14.19.67.49 1.3.87 1.87.38.58.85 1.1 1.39 1.54.55.45 1.18.81 1.88 1.08.35.16.7.26 1.05.33.34.08.66.13.95.17.29.03.55.06.78.06.23.01.41.01.54.01.55 0 1.16-.04 1.84-.13.68-.07 1.29-.19 1.82-.34.22-.07.43-.13.65-.19.21-.06.43-.13.65-.22l.08-.02-.08-2.38h-.43l-.03.07c-.03.1-.09.23-.15.38-.06.14-.16.31-.34.51l-.31.29c-.12.1-.29.21-.5.31-.27.12-.53.22-.83.29-.29.07-.56.12-.83.16-.26.04-.49.06-.68.07-.19 0-.33.01-.41.01-.22 0-.51-.01-.86-.04-.36-.02-.74-.11-1.15-.23-.43-.13-.85-.32-1.29-.57-.43-.26-.87-.62-1.29-1.08V253c-.15-.17-.33-.39-.52-.66a5.71 5.71 0 0 1-.51-.93 8.08 8.08 0 0 1-.4-1.23c-.1-.46-.16-.98-.16-1.56 0-.63.06-1.18.19-1.68.14-.5.3-.93.49-1.29.19-.37.39-.68.61-.93.22-.26.43-.48.62-.63.42-.36.84-.63 1.29-.83.44-.21.86-.35 1.26-.43.4-.09.76-.14 1.08-.16.33-.02.59-.03.76-.03.5 0 1.05.05 1.63.16.57.11 1.06.32 1.47.64.26.22.44.44.56.65.16.23.26.4.32.51zM94.52 255.35v-.1l-.1-.01c-.13-.02-.27-.07-.39-.13l-.28-.28-.08-.2-.01-.13c0-.11.03-.27.11-.46s.17-.43.29-.72l1.13-2.62h4.77l1.05 2.53c.07.17.13.34.21.48.07.16.13.31.19.48.03.14.05.25.05.31v.12l-.08.2c-.08.16-.18.24-.31.31-.16.06-.32.11-.48.13l-.1.01-.03.33v.13h4.4v-.39l-.07-.04c-.14-.05-.32-.14-.53-.26-.18-.09-.38-.29-.58-.62l-.13-.26-.15-.33-.15-.33-.12-.27-4.93-11.53h-.33l-5.34 11.93c-.13.3-.25.54-.36.75-.11.19-.22.35-.33.46l-.36.29c-.12.06-.27.11-.45.13l-.1.01v.46h3.6l-.01-.38zm1.2-5.82 1.92-4.26 1.82 4.26h-3.74zM107.79 254.58c-.08.17-.19.32-.32.41l-.39.19-.26.07-.08.02-.03.32-.01.13h4.43V255.27l-.09-.02c-.25-.06-.43-.13-.53-.2l-.31-.23-.2-.33-.08-.37c-.01-.14-.01-.31-.01-.51V243.06h2.89c.43 0 .76.06 1 .16.2.11.36.35.43.82l.02.1h.44v-2.28h-11.51v2.32H103.63l.02-.1c.02-.07.04-.19.07-.36.02-.14.11-.28.26-.4.12-.11.28-.18.46-.22.19-.05.47-.07.84-.08h2.66v10.71c-.03.39-.08.66-.15.85zM120.23 255.35v-.1l-.28-.04-.26-.11-.28-.18-.22-.3c-.06-.14-.08-.31-.09-.52-.01-.23-.01-.52-.01-.9v-4.25h7.34v4.23c0 .31-.01.6-.02.84 0 .23-.02.41-.04.5l-.08.19-.08.12-.33.28c-.15.06-.3.11-.45.13l-.1.01-.02.33-.01.13h4.25V255.26l-.09-.02c-.18-.03-.32-.08-.44-.14l-.35-.27-.21-.39c-.03-.13-.05-.27-.06-.45l-.02-.4v-9.28c0-.16 0-.39.01-.68 0-.29.04-.51.08-.63l.2-.32.29-.21.28-.11.19-.05.1-.01V241.87h-4.21v.45l.27.04.29.09.29.18.2.31c.04.12.07.28.07.5v4.37h-7.34v-3.54c0-.34.01-.62.03-.86.02-.23.07-.39.11-.51l.21-.28.26-.15.25-.08.19-.05.09-.02v-.43h-4.22V242.33l.29.07.28.09.27.18.21.32c.06.17.09.34.1.5v.21c0 .16 0 .36-.01.6V254.09c-.01.25-.03.41-.06.51l-.2.34-.3.21-.28.1-.2.04-.1.02v.45h4.22l-.01-.41zM145.02 253.76c.42-.46.75-.94.99-1.43.24-.47.42-.93.54-1.36.12-.43.19-.82.22-1.18.02-.35.04-.63.04-.88 0-.68-.07-1.3-.21-1.85-.13-.57-.3-1.06-.5-1.49-.2-.43-.41-.81-.63-1.12-.23-.31-.43-.56-.61-.77-.19-.2-.43-.43-.74-.68a6.23 6.23 0 0 0-1.12-.75 8.81 8.81 0 0 0-1.51-.58c-.58-.16-1.22-.23-1.92-.23-.82 0-1.56.1-2.21.3-.66.21-1.22.45-1.7.73-.49.29-.89.58-1.23.91-.33.32-.6.6-.79.84a7.09 7.09 0 0 0-1.01 1.7c-.17.39-.3.83-.42 1.32a7.86 7.86 0 0 0-.16 1.66c0 .77.09 1.44.26 2.04.17.6.38 1.13.64 1.6.26.45.52.86.82 1.16.29.32.54.57.76.77.71.58 1.47 1.01 2.3 1.27a8.8 8.8 0 0 0 2.58.38c1.13 0 2.16-.17 3.09-.53.92-.36 1.76-.96 2.52-1.83zm-.62-2.3c-.19.53-.45 1.01-.75 1.43-.31.44-.67.8-1.09 1.11-.41.31-.87.54-1.37.7-.51.17-1.04.25-1.61.25-.67 0-1.26-.1-1.77-.3-.51-.2-.95-.42-1.31-.7v-.01c-.36-.27-.66-.54-.89-.84h-.01a9.11 9.11 0 0 1-.54-.75c-.24-.38-.43-.75-.57-1.12-.14-.37-.24-.71-.3-1.03-.06-.32-.1-.61-.13-.87-.02-.27-.02-.48-.02-.66 0-.68.06-1.27.19-1.79s.3-.99.5-1.38v-.01c.2-.39.42-.72.67-1 .24-.28.48-.51.69-.68.32-.25.64-.45.97-.61.34-.15.66-.26.95-.33.29-.08.56-.12.79-.14.24-.02.44-.04.57-.04.55 0 1.03.07 1.45.19.43.13.8.28 1.11.46.33.18.6.36.81.56v.01c.22.2.4.38.53.55.17.21.35.48.55.8.19.31.37.68.53 1.13.15.44.27.93.35 1.47.05.34.06.68.06 1.06a10.104 10.104 0 0 1-.11 1.47c-.03.32-.12.68-.25 1.07zM149.84 242.47l.31.23c.09.08.17.2.23.35.04.12.07.32.09.58.01.26.02.57.02.91v8.06c0 .35 0 .68-.01 1.01 0 .31-.01.52-.02.61-.03.23-.1.39-.18.5l-.29.3-.34.17-.29.07-.09.02v.45h10v-2.38H158.83l-.02.1c-.07.2-.13.37-.18.49l-.19.27-.33.21-.4.1c-.15.01-.29.03-.43.03-.14.01-.28.02-.41.02h-2.66c-.34-.02-.59-.03-.76-.04-.16-.01-.3-.04-.46-.12a.797.797 0 0 1-.41-.54c-.04-.26-.09-.64-.09-1.13v-8.23c0-.34.02-.63.03-.9.02-.26.03-.46.05-.57.05-.15.12-.27.2-.35l.29-.23.29-.11.21-.05.1-.01v-.44h-4.43V242.29l.29.07.32.11zM164.91 255.07l-.39-.29-.18-.38-.02-.3v-.02c-.02-.15-.03-.29-.03-.44V243.5c.01-.23.03-.38.06-.5.05-.16.12-.27.19-.35l.27-.2.28-.09.2-.05.1-.01V241.87h-4.28V242.31l.32.07.3.09.3.22c.09.08.17.2.23.37.05.14.08.3.09.48v9.61c-.01.45-.02.78-.02 1.04 0 .22-.07.42-.18.57a.94.94 0 0 1-.39.34c-.16.07-.34.12-.52.16l-.1.02v.45h4.33v-.44l-.08-.03c-.16-.07-.32-.12-.48-.19zM169.13 252.94c.38.58.85 1.09 1.39 1.53.56.45 1.18.81 1.87 1.08.36.16.71.26 1.05.33.35.08.66.13.95.17.3.03.56.06.79.06.22.01.4.01.53.01.55 0 1.17-.04 1.84-.13.68-.07 1.29-.19 1.82-.34.22-.07.44-.13.65-.19.21-.06.43-.13.65-.22l.08-.02-.08-2.38h-.43l-.04.07-.15.38c-.06.14-.17.31-.35.51l-.31.29c-.12.1-.29.21-.51.31-.26.12-.54.22-.82.29-.3.07-.58.12-.84.16-.26.04-.49.06-.68.07-.21 0-.34.01-.42.01-.22 0-.5-.01-.86-.04-.35-.02-.73-.11-1.15-.23-.42-.13-.84-.32-1.29-.57-.43-.26-.87-.62-1.29-1.08V253c-.16-.17-.34-.39-.53-.66-.17-.26-.35-.57-.5-.93-.16-.36-.29-.77-.4-1.23-.1-.46-.16-.98-.16-1.56 0-.63.06-1.18.2-1.68.13-.5.29-.93.48-1.29.18-.37.39-.68.61-.93.22-.26.43-.48.61-.63.42-.36.85-.63 1.29-.83.45-.21.87-.35 1.26-.43.41-.09.76-.14 1.09-.16.32-.02.57-.03.75-.03.51 0 1.05.05 1.63.16.57.11 1.06.32 1.47.64.26.22.45.44.57.65.13.23.22.4.29.52l.03.05h.42v-.11l.08-2.36-.09-.03c-.53-.16-1-.28-1.42-.36-.42-.1-.8-.16-1.14-.21-.34-.05-.65-.09-.94-.1-.28-.01-.57-.02-.84-.02-.25 0-.62.02-1.06.04-.46.02-.98.1-1.54.24-.55.14-1.15.36-1.76.65-.63.31-1.22.73-1.78 1.26-.51.48-.91.98-1.21 1.5-.3.5-.52 1-.66 1.48-.15.47-.25.91-.29 1.32-.04.41-.06.73-.06.98 0 .74.09 1.46.29 2.14.24.65.52 1.28.91 1.86zM199.51 255.04zM206.34 242.19v.1l.22.04.23.06.27.12.22.18c.14.17.22.4.23.7v6.96c0 .33 0 .62-.02.86-.03.25-.05.48-.08.68-.02.2-.07.36-.12.51-.05.16-.1.32-.17.49-.08.2-.18.36-.28.52-.09.14-.16.24-.2.29-.11.12-.25.25-.42.39-.18.14-.39.26-.64.37-.25.12-.54.22-.87.29-.33.08-.7.13-1.11.13-.62 0-1.21-.12-1.79-.34v.01c-.58-.23-1.06-.59-1.45-1.09-.19-.25-.34-.5-.45-.75-.1-.26-.18-.52-.23-.8-.05-.27-.08-.54-.1-.82-.01-.28-.02-.58-.02-.88v-6.09c.02-.27.02-.51.03-.72 0-.19.04-.36.1-.5l.28-.35c.14-.09.36-.18.66-.26l.08-.01.03-.3v-.14h-4.27V242.27l.09.02c.36.1.61.21.7.3h.02c.17.14.25.28.28.5.02.24.04.57.04.99v6.59c0 .47.02.85.06 1.17.05.38.13.73.24 1.04.13.38.33.75.58 1.12.26.38.61.72 1.03 1.02.43.31.96.55 1.58.75.63.19 1.36.28 2.22.28.88 0 1.62-.11 2.24-.32h.01c.61-.2 1.12-.48 1.53-.81.41-.34.73-.7.95-1.11.22-.4.39-.8.5-1.18.07-.25.12-.51.15-.77.03-.25.05-.5.06-.72 0-.21.01-.41.01-.57v-6.56c0-.34 0-.62.02-.8v-.01c.01-.16.06-.31.16-.44.11-.17.23-.27.37-.32.16-.07.34-.12.53-.18l.08-.02v-.43h-3.56v.38h-.02zM222.84 242.19v.1l.1.01c.47.1.75.26.86.42.13.18.2.39.23.61v.01l.03.32v.09c0 .14-.01.24-.01.28V252l-8.99-10.16h-2.96v.45l.11.01c.19.02.36.06.52.12.14.06.26.15.35.33.07.12.12.27.12.44 0 .18.01.44.01.76v9.66c0 .18-.01.4-.03.66-.02.25-.09.43-.19.56h-.01c-.13.18-.27.28-.43.32-.19.05-.32.08-.38.09l-.09.02-.03.32-.01.13h3.61V255.26l-.09-.02c-.29-.06-.51-.16-.68-.28-.16-.11-.27-.31-.33-.62l-.02-.29c-.01-.11-.01-.24-.01-.44v-9.42l10.4 11.74h.35V244c0-.27.02-.55.03-.81.02-.23.12-.42.34-.61l.26-.15c.1-.05.25-.09.42-.13l.09-.01v-.09l.02-.2.02-.14h-3.62l.01.33zM232.52 255.07l-.38-.29-.18-.38-.03-.3v-.02c-.02-.15-.04-.29-.04-.44v-9.33c0-.32 0-.59.01-.81.01-.23.03-.38.06-.5.05-.16.11-.27.19-.35l.27-.2.27-.09.21-.05.09-.01V241.87h-4.28V242.31l.32.07.31.09.31.22c.09.08.17.2.23.37.04.14.07.3.07.48.02.18.02.45.02.79v8.82c-.02.45-.02.78-.03 1.04-.01.22-.06.42-.18.57-.11.17-.25.28-.39.34-.16.07-.33.12-.51.16l-.1.02v.45h4.34v-.44l-.09-.03c-.16-.07-.33-.12-.49-.19zM244.45 242.19v.09l.48.14.31.25.07.17v.13l-.04.39-.11.36-.12.3-.07.14-3.57 8.19-3.39-8.19-.16-.37-.12-.38a2.26 2.26 0 0 1-.07-.45c0-.17.06-.3.17-.4.1-.1.33-.19.68-.26l.11-.01v-.44h-4.36V242.29l.09.01c.16.04.29.09.38.11l.33.23c.17.15.28.31.36.47.08.19.14.31.16.38.1.2.18.38.27.57.08.2.16.4.24.59v.01l4.75 11.22H241.19l5.02-11.38c.1-.23.22-.5.35-.8s.26-.57.39-.77c.14-.2.28-.34.4-.42.13-.09.32-.15.57-.21l.1-.01v-.44h-3.56v.34h-.01zM258.54 253.32l-.03.09c-.05.16-.1.31-.16.46l-.23.37h-.01c-.12.12-.26.19-.41.21-.18.03-.3.04-.35.03h-.01l-.41.04h-2.2c-.48-.02-.89-.03-1.25-.04-.35-.02-.58-.09-.7-.18l-.13-.14-.07-.11c-.1-.2-.15-.43-.15-.66 0-.27-.02-.51-.03-.72v-3.77h2.86c.29 0 .57.02.86.07.25.04.44.18.6.45l.09.19c.03.07.06.18.1.33l.01.09h.46v-3.5H256.92l-.07.29-.1.29-.21.3-.33.21c-.15.06-.31.09-.49.09h-3.33v-4.7h3.55c.25 0 .48.02.69.07.18.04.33.17.46.41l.12.27.09.29.02.09.31.02.12.01.05-2.33h-8.54v.45l.31.04.29.08.3.19c.08.09.15.19.19.33l.01.01v.01c.05.14.08.29.08.46v9.67l-.02.38.01.18v.19l-.01.37c-.01.2-.06.36-.14.52-.07.14-.19.25-.36.34l-.25.12-.28.07-.09.02-.03.32-.01.13h9.68v-2.39H258.54v-.01zM272.6 254.96l-.3-.35-.17-.27a9.32 9.32 0 0 1-.61-1.03l-2.65-4.85c.07-.05.14-.08.25-.12.17-.09.35-.21.55-.36.21-.14.4-.32.6-.53h.01c.21-.21.38-.45.53-.74.23-.44.34-.94.34-1.48 0-.51-.08-.95-.25-1.31-.16-.33-.29-.59-.39-.76h-.01c-.25-.33-.55-.59-.88-.78-.33-.16-.66-.31-1.03-.39-.36-.09-.74-.14-1.11-.15-.38-.02-.73-.02-1.1-.02h-4.95V242.26l.26.04.28.08.29.17.22.28c.05.13.09.28.1.48.01.19.02.44.02.76v9.28c-.01.3-.02.56-.03.78 0 .21-.03.36-.08.46l-.2.32-.28.18-.27.11-.18.02-.1.01v.46h4.38V255.24l-.09-.02a2.99 2.99 0 0 1-.59-.2l-.32-.23-.2-.37c-.03-.11-.04-.26-.06-.43l-.02-.35-.02-.37v-4.19c.13 0 .27 0 .39.02.16.01.33.01.51.01.27 0 .53-.01.81-.04.24-.01.48-.04.71-.06l2.5 4.57c.15.27.3.54.48.83.17.3.4.55.65.75.15.14.33.24.5.31.17.08.33.12.49.15h-.01c.15.04.3.06.42.06H273.17v-.44l-.29-.12-.28-.16zm-3.56-8.71c-.06.22-.12.38-.18.46v.01c-.15.27-.32.49-.53.63-.22.16-.46.3-.72.38-.27.08-.55.14-.84.18s-.59.04-.86.04h-1.33l.04-4.88H266.28c.27 0 .56.01.84.04.36.04.69.16 1.02.37.35.22.6.5.76.87.16.36.25.75.25 1.13-.02.3-.05.56-.11.77zM282.48 249.07c-.23-.23-.5-.43-.79-.64-.3-.18-.58-.37-.83-.54l-1.13-.63c-.33-.21-.67-.43-1.02-.68-.34-.24-.58-.55-.74-.92-.06-.17-.1-.33-.1-.46-.01-.14-.02-.25-.02-.31 0-.36.06-.67.19-.94.14-.29.29-.52.51-.69.21-.18.46-.33.76-.42.29-.1.6-.15.95-.15.46 0 .85.07 1.15.2.31.15.55.31.74.51.19.19.34.39.44.61.1.22.21.43.28.59l.03.05H283.3V242.2l-.07-.03c-.15-.06-.32-.11-.52-.18-.2-.09-.43-.16-.68-.22a7.57 7.57 0 0 0-.86-.18c-.32-.05-.67-.08-1.07-.08-.13 0-.32.01-.55.02-.23.02-.51.06-.79.13-.29.08-.6.19-.9.37-.32.17-.62.39-.89.68-.19.2-.4.48-.59.87-.23.41-.33.93-.33 1.58 0 .21.02.44.06.7.04.26.12.52.24.78.12.27.3.54.54.83.24.3.55.57.95.84v.01l.38.23.38.23 1.23.73c.39.23.74.48 1.06.73.31.24.56.57.73.99.03.07.08.21.13.39.05.17.08.37.08.62 0 .38-.05.66-.14.87v.02-.02c-.1.24-.18.42-.24.54-.28.45-.65.77-1.1.97-.45.21-.93.32-1.46.32-.33 0-.62-.05-.87-.11-.25-.07-.48-.16-.67-.27-.19-.1-.35-.21-.47-.34l-.31-.34-.19-.36a4.01 4.01 0 0 1-.25-.56l-.03-.07-.29-.02-.13-.02v2.45l.07.04c.32.13.71.29 1.21.47.51.17 1.17.26 1.97.26.15 0 .35-.01.61-.02.26-.02.56-.05.88-.12.32-.08.66-.2 1-.37.36-.16.7-.41 1.03-.73.28-.27.51-.56.68-.84.17-.29.29-.56.38-.84.08-.26.13-.52.16-.75.02-.22.03-.4.03-.55-.01-1.09-.41-2.03-1.22-2.78zM290.55 255.07l-.39-.29-.18-.38-.03-.3v-.02c-.02-.15-.03-.29-.03-.44v-9.33c0-.32.01-.59.01-.81 0-.23.02-.38.06-.5.04-.16.11-.27.19-.35l.27-.2.28-.09.2-.05.1-.01V241.87h-4.28V242.31l.32.07.31.09.31.22c.09.08.17.2.23.37.05.14.07.3.08.48 0 .18.01.45.01.79v8.82c-.02.45-.02.78-.02 1.04-.01.22-.07.42-.19.57a.94.94 0 0 1-.39.34c-.17.07-.34.12-.53.16l-.09.02v.45h4.34v-.44l-.08-.03c-.18-.07-.34-.12-.5-.19zM292.41 244.19H292.87l.02-.1c.01-.07.03-.19.07-.36.02-.14.1-.28.25-.4.13-.11.27-.18.46-.22.18-.05.46-.07.83-.08h2.67v10.71c0 .37-.05.65-.13.83-.08.17-.19.32-.32.41l-.38.19-.25.07-.08.02-.03.32-.01.13h4.43V255.26l-.09-.02c-.24-.06-.43-.13-.53-.2l-.31-.23-.21-.33-.08-.37c-.02-.14-.02-.31-.02-.51V243.05h2.9c.43 0 .76.06.99.16.21.11.36.35.43.82l.02.1h.43v-2.28h-11.5v2.34h-.02zM313.87 241.86v.45l.1.01c.16.02.31.05.44.09.08.02.17.09.25.24l.09.22.01.13c0 .16-.04.34-.15.52-.11.2-.21.38-.29.52l-2.65 4.31-2.76-4.31v-.01c-.1-.13-.2-.3-.31-.51-.11-.2-.16-.38-.16-.56 0-.14.03-.25.09-.32l.23-.2.25-.09.16-.03.11-.01v-.44h-4.36V242.3l.09.02c.15.04.26.09.36.12l.25.16.21.23.23.31.18.26.18.25 3.86 5.97v4.01c0 .37-.01.65-.03.82v.01-.01c-.02.16-.1.31-.23.47l-.35.24c-.14.04-.31.08-.49.1l-.1.01-.03.33-.01.13h4.33V255.28l-.1-.02c-.06-.01-.18-.03-.33-.06l-.39-.21a.876.876 0 0 1-.32-.61c-.03-.27-.05-.52-.05-.76v-3.9l3.86-6.22c.12-.18.24-.38.37-.58.12-.17.26-.32.43-.41l.32-.15.22-.05.09-.01v-.44h-3.6zM1.04 241.7v.11l.31.02.3.11.31.19c.08.08.15.18.19.35h.01v.02c.04.09.07.23.07.39v11.1c0 .25-.04.43-.09.56h-.01v.02c-.08.25-.19.4-.36.48-.19.1-.41.17-.64.24l-.09.02v.45H5.6V255.31l-.09-.02c-.24-.06-.46-.14-.66-.24-.18-.07-.32-.23-.42-.47l-.11-.29-.03-.32v-5.31h2.95c.31.01.62.03.93.06.28.03.49.15.64.37l.14.25c.04.11.07.25.11.43l.02.1H9.54v-3.67H9.09l-.04.29-.08.29-.18.31-.29.22c-.13.07-.28.09-.48.1-.19.01-.44.01-.76.01H4.3v-4.91h3.54c.28 0 .55.03.83.08.25.05.44.18.6.43l.15.3.1.32.02.08h.44l.03-2.34H1.04v.32zM21.84 241.7v.11l.22.04.24.07.27.11.23.18c.15.19.23.43.24.73.01.34.01.62.01.84v6.43c0 .34-.01.64-.03.9v.01c-.02.25-.04.48-.08.7-.04.19-.08.37-.13.54-.05.16-.1.33-.17.5-.09.21-.19.39-.29.54-.09.14-.17.25-.22.32-.11.12-.26.26-.44.41-.17.14-.4.27-.66.38-.26.13-.56.23-.9.31-.34.08-.73.13-1.16.13-.65 0-1.26-.11-1.87-.36-.6-.22-1.1-.6-1.51-1.12-.2-.27-.36-.53-.47-.79-.1-.27-.2-.55-.24-.82v-.01a8.39 8.39 0 0 1-.1-.86c-.01-.3-.02-.6-.02-.92v-6.33c.01-.28.02-.53.03-.75.01-.2.04-.38.1-.52s.16-.26.3-.36c.14-.1.37-.2.68-.27l.09-.02.02-.31.02-.13h-4.44V241.8l.09.04c.38.09.63.21.74.3l.01.01c.17.13.27.29.28.52.03.25.05.59.05 1.04V250.56c0 .48.02.88.06 1.2.06.38.14.75.25 1.09.14.39.34.78.61 1.16.26.4.63.75 1.08 1.06.45.33 1 .58 1.64.78.66.19 1.43.3 2.32.3.91 0 1.69-.11 2.34-.32.64-.22 1.17-.5 1.59-.85.42-.34.75-.72.99-1.15.23-.4.4-.82.51-1.22v-.01c.07-.26.12-.52.15-.78.04-.27.05-.52.06-.75.01-.23.02-.43.02-.6v-6.82c0-.36 0-.64.01-.83.02-.18.08-.34.17-.47.11-.18.23-.28.39-.34.16-.07.35-.13.55-.17l.09-.02v-.44h-3.7v.32h-.02zM43.51 253.28l-.02.08c-.06.17-.12.33-.17.49l-.25.38c-.13.13-.27.2-.43.22-.19.03-.31.04-.36.04h-.03l-.4.03h-2.29c-.49-.01-.93-.03-1.3-.05-.35-.01-.6-.09-.73-.19l-.14-.14-.08-.12c-.1-.21-.15-.43-.16-.68-.01-.27-.02-.52-.04-.75v-3.93h2.98c.31 0 .6.01.9.07.26.04.46.19.62.47l.08.21c.02.07.06.18.11.35l.02.09h.45V246.21H41.82l-.07.31-.1.29-.22.31-.34.22v.01c-.15.06-.32.09-.51.09H37.1v-4.9h3.7c.26 0 .5.02.72.08.19.05.34.18.48.42l.12.29.08.31.03.08.32.03.12.01.05-2.41h-8.87v.44l.32.02.3.11.31.19c.09.08.16.18.2.35v.01c.06.15.09.31.09.47V253l-.02.38v.39l-.02.39c0 .2-.05.38-.13.53-.07.16-.19.28-.38.37l-.26.12-.3.07-.08.02.03.37-.01.12h10.07v-2.47h-.46zM57.78 241.7v.11l.09.02c.48.09.78.25.89.43.13.2.21.41.25.64v.01l.03.32v.11c-.01.15-.01.24-.01.3v8.3l-9.36-10.57h-3.08v.44l.11.02c.18.02.37.06.55.12.15.05.26.15.36.34v.01c.08.12.13.27.13.45.01.18.01.45.01.78v10.07c0 .19-.01.41-.03.68-.02.25-.08.45-.21.59-.14.18-.28.3-.45.33h-.01c-.19.05-.33.08-.39.09l-.08.02-.03.34-.01.12h3.75V255.32l-.1-.02c-.3-.06-.53-.16-.71-.29V255c-.17-.11-.28-.31-.34-.62l-.04-.31V243.78l10.83 12.21h.36V243.6l.03-.84c.01-.24.12-.44.36-.63l.27-.16c.1-.05.25-.1.44-.13l.09-.02v-.09l.03-.22.01-.13h-3.75v.33h.01zM27.48 241.7v.11l.11.02c.21.03.42.09.62.19.17.07.3.21.38.45.08.24.12.69.12 1.35v11.85c0 .56-.03 1.11-.1 1.64-.06.52-.27 1.01-.64 1.44v.01c-.14.17-.31.33-.48.5-.19.16-.32.25-.34.27l-.1.06.2.35.05.06.1-.05c.35-.16.63-.29.82-.4.2-.12.37-.22.53-.33.44-.29.8-.6 1.05-.94.26-.34.45-.67.58-.99.13-.32.22-.62.25-.92.04-.29.06-.54.07-.75v-11.83c0-.55.02-.96.07-1.23.04-.25.17-.43.44-.58l.25-.13c.05-.02.18-.04.36-.06l.1-.02v-.44h-4.46v.35h.02z\" /></g><g><path d=\"M142.76 70.13h-1.33v1.49h-3.55v2.91h3.55v1.92h-3.55v15.7h3.55v1.94h-3.55V97h3.55v2.07h1.33V97h3.5v-2.9h-3.5v-1.94h3.5V76.44h-3.5v-1.92h3.5V71.6h-3.5v-1.47zm-1.33 15.62v3.49h-2.22v-3.49h2.22zm0-6.4v3.49h-2.22v-3.49h2.22zm3.5 6.4v3.49h-2.18v-3.49h2.18zm-2.17-2.92v-3.49h2.18v3.49h-2.18zM152.66 76.44v-1.92h3.49v-4.4h-1.32v1.49h-2.18v-1.49h-1.33v1.49h-3.48v2.91h3.48v1.92h-3.48v1.41h-.01v21.12h1.32v-6.83h2.17v6.93h1.33v-6.93h2.18v6.83h1.32V76.44h-3.49zm-1.33 9.31v3.49h-2.17v-3.49h2.17zm0-6.4v3.49h-2.17v-3.49h2.17zm3.51 6.4v3.49h-2.18v-3.49h2.18zm0-6.4v3.49h-2.18v-3.49h2.18zM155.17 52.13l-3-.44-1.35-2.71-1.34 2.71-3 .44 2.17 2.1-.01.07-.49 2.92 2.67-1.41 2.69 1.41-.51-2.99zM140.82 61.08l-3-.44-.03-.05-1.3-2.65-1.34 2.7-3.01.44 2.17 2.12-.01.06-.49 2.92 2.68-1.41 2.68 1.41-.51-2.98zM130.17 77.94l2.13-2.06-3.01-.44-1.34-2.71-1.35 2.71-2.99.44 2.17 2.11-.52 2.97 2.69-1.39.06.03 2.62 1.37-.51-2.98zM132.71 93l-3-.43-1.35-2.71-1.34 2.71-3 .43 2.16 2.11-.01.07-.5 2.91 2.69-1.4.06.03 2.63 1.37-.52-2.98zM139.54 109.43l2.12-2.06-3-.44-.03-.06-1.31-2.64-1.35 2.7-.07.02-2.93.42 2.18 2.11-.53 2.98 2.7-1.4 2.68 1.4-.51-2.98zM156.21 115.88l-3-.44-1.34-2.71-1.34 2.71-.07.01-2.94.43 2.17 2.12-.01.05-.5 2.93 2.69-1.42 2.68 1.42-.51-2.98z\" /><path d=\"M193.99 37.48c-.75 0-1.5.05-2.23.16-1.64.22-3.32.33-5.03.33a37.99 37.99 0 0 1-20.26-5.82c-.38-.24-.76-.49-1.12-.74l-.99-.69c-1.24-.9-2.77-1.42-4.42-1.42s-3.18.52-4.42 1.42c0 0-.65.46-.97.69-.38.25-.75.5-1.13.74-.77.48-1.57.94-2.37 1.37a38.079 38.079 0 0 1-17.89 4.45c-1.72 0-3.41-.11-5.06-.33-.73-.11-1.46-.16-2.21-.16-8.62 0-15.61 6.96-15.61 15.55v31.98c-.02.61-.03 1.22-.03 1.83 0 28.76 20.48 52.71 47.69 58.22.64.09 1.31.14 1.98.14.64 0 1.27-.04 1.89-.12 27.12-5.44 47.59-29.25 47.78-57.86V53.03c0-8.59-6.98-15.55-15.6-15.55zm-34.08 104.44c-.61 0-1.21-.04-1.8-.13-25.68-5.17-45.03-27.79-45.03-54.93 0-.27-.26-32.72-.26-32.72h.02c.3-7.85 5.58-13.92 13.51-13.92.7 0 2.02.03 2.69.14 1.57.21 3.28.42 4.9.42 6.11 0 12.5-1.38 17.53-4.05.76-.42 1.51-.84 2.23-1.31.36-.22.71-.46 1.06-.69.31-.21.62-.43.92-.65h.01c1.17-.84 2.66-1.5 4.22-1.5v109.34zm31.58-71.18 1.53 3.11 3.45.51-2.5 2.43.58 3.42-3.07-1.62-3.09 1.62.6-3.42-2.5-2.42 3.45-.51 1.55-3.12zm-10.11-10.93 1.55-3.11 1.54 3.11 3.45.5-2.5 2.43.59 3.42-3.08-1.62-3.09 1.62.59-3.42-2.5-2.43 3.45-.5zm-10.35 15.46V71.4h12.18v3.87h-12.18zm12.17 19.14v3.87h-12.18v-3.87h12.18zm-16.8-42.99 1.55-3.12 1.55 3.12 3.45.5-2.5 2.42.59 3.43-3.08-1.63-3.09 1.63.59-3.43-2.5-2.42 3.44-.5zm-3.55 30.05v-3.85h.26c.01 0 1.11-.01 2.16-.49 1.22-.56 1.82-1.5 1.82-2.89V69.8h2.46v5.82c.03.52.04 2.38-1.3 3.9V99.2h-2.46V81.09c-.78.25-1.68.37-2.68.37l-.26.01zm9.62 39.64-3.08-1.63-3.08 1.63.58-3.43-2.49-2.43 3.44-.49 1.55-3.12 1.53 3.12 3.45.49-2.49 2.43.59 3.43zm14.42-8.93-3.09-1.62-3.08 1.62.59-3.43-2.49-2.42 3.44-.51 1.54-3.12 1.54 3.12 3.45.5-2.49 2.42.59 3.44zm8.09-14.94-3.09-1.63-3.09 1.63.59-3.42-2.5-2.42 3.44-.5 1.55-3.11 1.55 3.11 3.44.5-2.5 2.42.61 3.42z\" /><g><path style=\"fill-rule:evenodd;clip-rule:evenodd\" d=\"M114.69 20.04c.16.04.32.04.47.03 4.47-.71 11.42-5.3 14.22-8.89a.596.596 0 0 0-.32-.96c-6.11.01-13.35 3.79-15.41 7.68-.04.09-.09.18-.12.28-.19.83.32 1.66 1.16 1.86zM87.1 46.57c.19 0 .36-.03.53-.09.02-.01.04-.02.05-.02.18-.07.34-.19.48-.32 4.15-5.45 5.48-11.96 5.89-18.45a.612.612 0 0 0-.6-.58c-.04 0-.07 0-.1.01-.13.02-.25.08-.34.18-.8.84-1.7 1.77-2.35 2.58-3.2 3.9-5.34 8.24-5.34 13.4 0 .72.07 1.44.26 2.15.21.67.81 1.14 1.52 1.14zM75.51 88.02a1.586 1.586 0 0 0 1.43.19c.02-.01.04-.02.05-.02.28-.11.52-.3.7-.54.17-.22.27-.47.3-.76.71-5.86-2.32-17.61-5.61-20.88a.64.64 0 0 0-.43-.17c-.03 0-.07 0-.1.01-.13.02-.25.09-.35.18-.05.06-.09.12-.12.2-1.47 6.16-1.47 12.19 1.22 18.07.69 1.48 1.67 2.73 2.91 3.72zM105.58 38.6c.02-.06.05-.12.06-.19v-.03c0-.32-.22-.57-.52-.62-6.44-.11-13.52 5.02-15.23 9.7-.04.15-.08.3-.08.46 0 .14.02.29.06.42.18.7.82 1.21 1.57 1.21.12 0 .24-.02.35-.05 4.62-1.25 11.51-6.55 13.79-10.9zM98.76 29.17c.17.05.34.08.51.07h.05c.19-.02.36-.08.53-.15 5.33-3.72 8.42-9.18 10.68-14.93a.58.58 0 0 0-.47-.71c-.13-.02-.25 0-.36.06-.96.52-2.04 1.11-2.87 1.65-4.02 2.59-7.22 5.88-8.71 10.54-.21.66-.35 1.33-.39 2.02-.01.65.39 1.26 1.03 1.45zM117.45 24.25c.03-.06.06-.11.07-.18v-.03a.578.578 0 0 0-.43-.63c-6.07-.66-13.18 3.57-15.21 7.84-.05.13-.09.27-.11.42-.01.14 0 .27.02.4.11.67.67 1.2 1.38 1.27.11.01.23 0 .34-.02 4.46-.77 11.41-5.16 13.94-9.07zM84.03 69.04c.18-.01.35-.05.5-.11 4.65-2.15 9.69-9.26 11.54-14.27.02-.05.03-.1.03-.15v-.04c0-.05-.01-.11-.02-.16-.07-.25-.29-.4-.55-.43-5.24.13-12.3 7.61-13.18 13.42 0 .06-.01.11-.01.17.01.14.03.28.07.41.04.13.09.25.15.36.31.5.86.83 1.47.8zM77.53 65.83a1.649 1.649 0 0 0 1.95.56c.02 0 .04-.01.05-.02.28-.13.53-.33.7-.58.03-.04.05-.09.08-.13 2.32-4.89 2.94-14.66 1.07-20.17a.649.649 0 0 0-.64-.45c-.03 0-.07 0-.11.01-.13.03-.26.1-.35.2-.02.03-.04.06-.05.08-.61 1.05-1.16 1.97-1.64 2.95-2.23 4.63-3.36 9.45-2.23 14.6.24 1.04.63 2.03 1.17 2.95zM80.51 87.67c.1.3.27.57.51.76.28.24.64.38 1.03.38.19 0 .38-.04.55-.09.02 0 .04-.01.05-.02.15-.06.3-.15.42-.25 4.17-3.41 7.47-12.3 7.87-17.02a.649.649 0 0 0-.18-.43.595.595 0 0 0-.45-.18h-.01c-5.79 1.74-10.89 10.81-9.79 16.85zM76.64 108.41c.53.55 1.14.99 1.81 1.34a1.808 1.808 0 0 0 1.39.06c.29-.1.55-.28.75-.51.1-.11.18-.22.25-.35.07-.13.12-.27.17-.41.04-.15.06-.31.06-.48-.61-6.29-6-15.56-9.96-19.33a.705.705 0 0 0-.39-.18h-.15c-.04 0-.08.01-.12.02-.21.05-.38.19-.48.37a.51.51 0 0 0-.07.17c-.19 5.23.81 10.09 3.15 14.63.88 1.73 2.23 3.27 3.59 4.67zM118.11 158.89c.25-.12.49-.27.67-.48.11-.12.2-.25.28-.4.16-.29.26-.64.26-1.01 0-.56-.23-1.06-.58-1.43-.08-.08-.17-.15-.26-.23-5.58-3.85-16.1-6.09-21.96-5.51-.22.05-.4.18-.52.36-.05.09-.09.18-.12.28a.863.863 0 0 0 .04.52c.02.05.04.1.07.14.02.04.06.08.09.12 3.29 3.19 7.12 5.53 11.44 7.09 2.78 1.01 5.64 1.57 8.6 1.06.68-.12 1.34-.29 1.99-.51zM87.84 129.4c.19-.01.37-.04.54-.1.29-.11.54-.28.75-.5.09-.11.17-.23.25-.35.07-.13.13-.26.17-.41.04-.16.07-.33.06-.5 0-.06 0-.12-.01-.18-.02-.15-.07-.29-.12-.42-3.45-6.93-9.1-11.44-15.53-15.34a.572.572 0 0 0-.23-.08h-.15c-.04 0-.08.01-.13.02-.21.05-.39.19-.48.37-.03.05-.05.11-.07.17-.01.03-.01.06-.02.09-.01.02-.01.05-.01.08v.05c1.74 6.24 4.91 11.57 10.34 15.37 1.39.98 2.92 1.54 4.64 1.73zM84.19 108.8c.1.13.23.24.36.34.06.04.12.08.19.12.26.14.57.22.89.22.22 0 .42-.04.62-.11.29-.1.55-.28.75-.5.01-.01.02-.02.02-.03 3.18-4.27 4.19-13.53 3.44-19.02a.803.803 0 0 0-.1-.32c-.04-.06-.08-.12-.13-.16a.721.721 0 0 0-.42-.2h-.15c-.04 0-.09.01-.13.02-.08.02-.14.07-.2.1-5.99 5.04-7.48 14.35-5.35 19.23.06.11.13.22.21.31zM100.19 145.1c.1-.02.2-.03.3-.07.29-.11.54-.28.75-.5.1-.1.18-.22.25-.35s.13-.27.17-.41c.04-.16.06-.32.06-.5 0-.06-.01-.13-.01-.18-.02-.22-.08-.42-.17-.61-.05-.12-.13-.21-.2-.31-4.34-4.78-14.22-10.02-19.67-10.34h-.08c-.04 0-.08.02-.12.02-.21.06-.39.2-.48.38-.03.05-.05.11-.07.17-.01.03-.01.06-.02.09V132.64c.01.06.02.11.03.16.01.05.03.09.05.13 2.92 5.38 10.96 12.14 17.28 12.27.63.03 1.28-.03 1.93-.1zM92.3 127.57c.05.09.11.18.18.27.11.13.23.24.37.34.06.04.12.08.19.12.18.1.39.16.61.2a1.795 1.795 0 0 0 .9-.09c.29-.1.54-.28.75-.5.1-.1.18-.23.25-.35.02-.04.03-.07.05-.11.4-1.01.74-2.03.93-3.07.77-4.15.26-8.3-.59-12.39-.2-.96-.45-1.9-.73-2.97-.02-.07-.05-.14-.08-.2a.54.54 0 0 0-.14-.16l-.12-.09a.761.761 0 0 0-.3-.1c-.05-.01-.1-.01-.15-.01-.04.01-.09.02-.13.02a.83.83 0 0 0-.4.25c-.04.06-.09.11-.13.16-3.1 4.34-4.34 9.15-3.23 14.36.33 1.48 1.02 2.92 1.77 4.32zM105.47 143.31c.04.03.08.05.12.07.18.1.39.17.6.2.09.02.19.02.28.02.07 0 .13 0 .2-.01.15-.02.29-.06.42-.1.29-.11.55-.28.75-.51.1-.11.18-.22.25-.35.06-.1.09-.21.13-.32 1.06-5.08-1.68-13.58-4.87-18.57-.03-.04-.06-.09-.1-.12-.04-.03-.07-.07-.12-.09a.63.63 0 0 0-.3-.1h-.14c-.05 0-.09.01-.13.02-.19.04-.34.16-.44.32-3.09 5.61-1.99 14.87 3.35 19.54zM121.16 154.66c.28.14.59.23.92.22h.15c.19-.01.37-.06.55-.12a2.139 2.139 0 0 0 1.12-.96c.17-.3.26-.64.26-1-.63-6.76-4.61-11.92-8.85-17.11a.897.897 0 0 0-.26-.22c-.1-.05-.2-.08-.31-.1H114.57c-.05.01-.1.01-.15.02-.22.05-.4.18-.52.37-.05.07-.08.14-.1.23-1.85 6.09 2.12 15.56 7.36 18.67zM138.2 163.86c-.15-.11-.31-.19-.49-.26-6.38-2.18-17-1.54-22.51.56-.15.06-.29.16-.39.3-.06.08-.1.18-.12.28-.01.03-.01.07-.02.1 0 .06-.01.12 0 .18.01.09.02.17.05.25.02.05.04.1.07.14.04.06.08.12.13.17.04.04.1.07.15.11 4.03 2.19 8.34 3.42 12.91 3.76 2.96.22 5.86 0 8.58-1.29.62-.29 1.21-.64 1.76-1.02.07-.07.15-.12.22-.19a2.044 2.044 0 0 0 .53-1.4c0-.56-.23-1.06-.58-1.43-.09-.1-.19-.19-.29-.26z\" /><path style=\"fill-rule:evenodd;clip-rule:evenodd\" d=\"M179.33 162.83c6.34-.56 13.32-10.77 12.31-17.87 0-.01-.01-.02-.01-.04-.03-.1-.07-.19-.12-.27a.9.9 0 0 0-.52-.37c-.05-.01-.09-.02-.15-.02H190.67c-.11.02-.21.05-.31.1-.06.03-.11.07-.16.11-5.33 4.77-10.39 9.53-11.73 16.86-4.03 1.05-11.29 3.04-18.48 5.63-7.19-2.59-14.44-4.59-18.48-5.63-1.34-7.33-6.39-12.09-11.73-16.86-.05-.04-.1-.08-.16-.11-.1-.05-.2-.08-.31-.1H129.14c-.05 0-.1.01-.15.02a.888.888 0 0 0-.64.64c0 .02 0 .03-.01.04-1.01 7.09 5.97 17.31 12.31 17.87 4.39.91 10.25 2.91 16.04 5.36-6.28 2.45-12.1 5.32-15.15 8.37l2.27 2.66c2.82-2.79 9.19-6.41 16.17-9.58 6.97 3.18 13.35 6.79 16.17 9.58l2.27-2.66c-3.05-3.04-8.87-5.91-15.15-8.37 5.81-2.44 11.67-4.45 16.06-5.36zM190.62 11.18c2.8 3.59 9.75 8.19 14.22 8.89.16.01.31 0 .47-.03.83-.2 1.35-1.03 1.15-1.85-.02-.1-.08-.19-.11-.28-2.06-3.89-9.3-7.68-15.41-7.68-.32.08-.52.4-.44.72.02.08.07.16.12.23zM232.32 46.45c.01.01.03.02.05.02a1.578 1.578 0 0 0 2.04-1.04c.2-.72.26-1.44.26-2.15.01-5.16-2.14-9.5-5.33-13.4-.66-.81-1.55-1.75-2.35-2.58a.627.627 0 0 0-.34-.18c-.03-.01-.07-.01-.1-.01-.32 0-.59.25-.61.58.42 6.49 1.74 12.99 5.9 18.45.14.13.29.24.48.31zM242 86.91c.04.29.15.54.31.76.18.24.42.42.7.54.02 0 .03.01.05.02a1.586 1.586 0 0 0 1.43-.19c1.25-1 2.22-2.24 2.9-3.71 2.7-5.87 2.69-11.92 1.22-18.07-.04-.07-.07-.14-.12-.2a.627.627 0 0 0-.34-.18c-.03-.01-.07-.01-.1-.01a.64.64 0 0 0-.43.17c-3.3 3.26-6.33 15-5.62 20.87zM228.55 49.54c.75 0 1.39-.51 1.58-1.21a1.421 1.421 0 0 0-.02-.88c-1.72-4.69-8.79-9.81-15.23-9.7-.29.06-.51.3-.51.62v.03c.01.07.03.13.06.19 2.28 4.36 9.17 9.65 13.78 10.88.1.04.22.07.34.07zM220.15 29.1c.17.07.34.14.53.15h.05c.16 0 .34-.02.5-.07.65-.2 1.04-.81 1.04-1.45a8.03 8.03 0 0 0-.39-2.02c-1.49-4.66-4.7-7.95-8.71-10.54-.83-.54-1.91-1.13-2.87-1.65-.11-.06-.23-.08-.36-.06a.57.57 0 0 0-.47.71c2.26 5.75 5.35 11.22 10.68 14.93zM216.83 33.34c.71-.07 1.27-.6 1.38-1.27.02-.13.03-.27.02-.4-.01-.15-.06-.29-.11-.42-2.02-4.27-9.13-8.5-15.2-7.84-.27.08-.46.33-.43.63 0 0 0 .01.01.03.01.06.04.12.07.18 2.53 3.91 9.48 8.31 13.93 9.08.1.01.22.02.33.01zM223.91 54.32c-.01.05-.02.1-.02.16v.04c0 .05.02.11.03.15 1.86 5.01 6.89 12.1 11.54 14.27.16.06.33.1.51.11a1.641 1.641 0 0 0 1.62-1.15c.04-.13.07-.27.07-.41 0-.06 0-.11-.01-.17-.88-5.81-7.94-13.29-13.18-13.42-.27.02-.49.17-.56.42zM239.77 65.79c.17.25.41.45.69.58.02.01.03.02.05.02.17.07.36.11.55.12.57.02 1.08-.25 1.4-.68.55-.91.93-1.89 1.17-2.96 1.13-5.14 0-9.97-2.23-14.6-.47-.97-1.03-1.9-1.64-2.95a.649.649 0 0 0-.41-.28c-.03-.01-.07-.01-.1-.01-.3-.01-.55.18-.64.45-1.86 5.51-1.24 15.29 1.07 20.17.04.05.06.09.09.14zM237.4 88.72a1.61 1.61 0 0 0 1.57-.29c.24-.19.41-.46.51-.76 1.1-6.04-4-15.12-9.8-16.86h-.01c-.18 0-.33.07-.45.18-.11.11-.18.26-.18.43.41 4.72 3.7 13.61 7.87 17.02.13.1.26.2.42.25.03.01.05.02.07.03zM249.43 88.55h-.15a.78.78 0 0 0-.39.18c-3.95 3.77-9.34 13.04-9.95 19.33 0 .17.02.33.06.48.04.15.09.28.17.41.07.13.15.24.25.35a1.839 1.839 0 0 0 1.37.62c.27 0 .53-.07.77-.17.67-.35 1.28-.79 1.81-1.34 1.36-1.42 2.71-2.95 3.6-4.67 2.34-4.54 3.34-9.39 3.15-14.63a.865.865 0 0 0-.07-.17.752.752 0 0 0-.48-.37c-.06-.01-.1-.01-.14-.02zM224.01 150.2a.845.845 0 0 0-.52-.36c-5.87-.58-16.38 1.67-21.96 5.51a2.08 2.08 0 0 0-.84 1.66c0 .37.1.72.26 1.01.08.14.17.27.28.4.18.2.42.36.67.48.65.23 1.31.4 2 .52 2.96.5 5.82-.06 8.6-1.06 4.32-1.56 8.14-3.9 11.44-7.09.03-.04.07-.08.09-.12.03-.04.05-.09.07-.14.03-.07.05-.16.05-.24 0-.1 0-.19-.02-.28a.744.744 0 0 0-.12-.29zM247.1 112.1a.865.865 0 0 0-.07-.17.752.752 0 0 0-.48-.37c-.04-.01-.08-.02-.12-.02h-.15c-.08.01-.16.04-.23.08-6.43 3.9-12.07 8.41-15.53 15.34-.05.13-.1.27-.12.42 0 .06-.01.12-.01.18 0 .17.02.34.06.5.04.14.1.28.17.41.07.13.15.25.25.35a1.804 1.804 0 0 0 1.28.6c1.72-.19 3.25-.75 4.63-1.71 5.43-3.8 8.6-9.13 10.34-15.37v-.13c0-.05-.01-.09-.02-.11zM233 108.86c.2.22.46.4.75.5.19.07.4.11.62.11.32 0 .63-.08.89-.22.07-.04.13-.08.19-.12.13-.1.26-.21.36-.34.08-.1.15-.21.2-.32 2.14-4.89.65-14.19-5.34-19.23-.07-.04-.13-.08-.2-.1a.507.507 0 0 0-.13-.02h-.14c-.16.02-.31.09-.42.2-.05.04-.1.1-.13.16-.06.09-.09.2-.1.32-.76 5.49.26 14.76 3.43 19.02 0 .02.01.03.02.04zM239.09 132.41a.669.669 0 0 0-.07-.17.766.766 0 0 0-.48-.38c-.04 0-.08-.02-.12-.02h-.08c-5.45.32-15.34 5.55-19.67 10.34-.07.1-.15.2-.2.31-.09.18-.15.39-.17.61 0 .06-.01.12-.01.18 0 .17.02.34.06.5.04.14.1.28.17.41s.15.25.25.35c.2.22.46.4.75.5.09.04.2.05.3.07.65.07 1.3.13 1.94.11 6.32-.13 14.35-6.89 17.28-12.27.02-.04.04-.08.05-.13.01-.05.02-.1.03-.16V132.51c-.02-.05-.03-.07-.03-.1zM224.41 127.44c.02.03.03.07.05.11.07.12.15.25.25.35.2.22.45.4.74.5.2.07.41.11.62.11.09 0 .19 0 .28-.02.22-.04.42-.1.61-.2.07-.04.13-.08.19-.12.14-.1.26-.21.37-.34.06-.08.12-.17.18-.27.75-1.4 1.44-2.84 1.76-4.35 1.11-5.2-.13-10.02-3.23-14.36-.04-.06-.09-.11-.13-.16a.763.763 0 0 0-.53-.27c-.05 0-.1 0-.15.01-.11.01-.21.05-.3.1l-.12.09c-.05.05-.1.1-.13.16-.04.06-.07.13-.08.2-.27 1.07-.52 2.01-.72 2.97-.85 4.1-1.36 8.24-.59 12.39.19 1.06.53 2.09.93 3.1zM217.44 123.46a.507.507 0 0 0-.13-.02h-.14c-.11.01-.21.05-.3.1-.05.02-.08.06-.12.09-.04.03-.07.08-.1.12-3.19 4.99-5.92 13.49-4.87 18.57.04.11.08.22.13.32.07.12.15.24.25.35.2.23.46.4.75.51.14.04.28.08.43.1.06.01.13.01.2.01.1 0 .19-.01.28-.02.22-.03.42-.1.6-.2.04-.02.08-.04.12-.07 5.34-4.67 6.44-13.93 3.34-19.53a.8.8 0 0 0-.44-.33zM205.59 135.4a.68.68 0 0 0-.15-.02H205.27c-.11.02-.21.05-.31.1s-.19.13-.26.22c-4.24 5.18-8.22 10.35-8.85 17.11 0 .36.09.7.26 1 .07.14.17.27.28.39.23.25.51.45.84.57.17.06.36.1.55.12h.15c.33 0 .64-.09.92-.22 5.23-3.11 9.21-12.57 7.36-18.66-.03-.09-.06-.16-.1-.23a.863.863 0 0 0-.52-.38z\" /><path style=\"fill-rule:evenodd;clip-rule:evenodd\" d=\"M205.31 164.73a.767.767 0 0 0-.12-.28c-.09-.14-.23-.23-.39-.3-5.51-2.09-16.12-2.73-22.51-.56-.18.07-.34.15-.49.26-.11.07-.21.16-.29.25-.36.37-.58.87-.58 1.43 0 .37.09.71.25 1.01.08.14.18.27.28.39.06.07.15.12.22.19.55.38 1.14.72 1.76 1.02 2.72 1.29 5.62 1.51 8.58 1.29 4.56-.34 8.88-1.57 12.9-3.76.05-.03.1-.07.15-.11.05-.05.09-.11.13-.17.02-.04.04-.09.06-.14.03-.08.05-.16.05-.25.01-.06 0-.12 0-.18.01-.03.01-.06 0-.09z\" /></g><path d=\"M168.94 9.42V5.19c-1.95-.2-4.07-.34-6.48-.41h-.17V0h-4.73v4.8h-.16c-2.42.07-4.55.2-6.51.41v4.22c1.94-.2 4.07-.34 6.5-.41h.17v13.66h4.73V9.01h.18c2.42.07 4.54.21 6.47.41z\" /></g></symbol>"
});
var result = _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default().add(symbol);
/* harmony default export */ __webpack_exports__["default"] = (symbol);

/***/ }),

/***/ 2763:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3465);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2594);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__);


var symbol = new (_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default())({
  "id": "logo_large_en",
  "use": "logo_large_en-usage",
  "viewBox": "0 0 206 260",
  "content": "<symbol xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 206 260\" id=\"logo_large_en\"><path d=\"M2.33 250.98c.16-.32.34-.58.53-.8.19-.22.37-.41.53-.55.36-.3.72-.54 1.11-.71.37-.17.74-.3 1.08-.37.34-.07.65-.13.93-.14.28-.01.5-.02.65-.02.43 0 .9.04 1.4.14.48.09.9.27 1.25.55.23.18.39.36.49.54l.28.51h.36l.07-2.14-.08-.02c-.46-.13-.88-.24-1.23-.31-.36-.08-.69-.14-.98-.18-.29-.05-.56-.08-.81-.09-.24-.01-.48-.01-.72-.01-.22 0-.53.01-.92.03-.4.02-.83.1-1.32.21-.48.12-.99.31-1.53.56-.53.25-1.05.62-1.53 1.08-.44.41-.79.84-1.04 1.28-.25.44-.44.86-.57 1.27-.13.41-.21.79-.25 1.14-.01.33-.03.61-.03.83 0 .63.09 1.25.25 1.83.17.58.42 1.13.75 1.61.33.49.73.93 1.2 1.32.47.38 1.01.69 1.61.92.3.12.61.22.91.29.29.05.57.1.82.13s.48.05.68.06c.19.01.35.01.46.01.47 0 1-.04 1.59-.11.58-.07 1.11-.17 1.57-.29.19-.05.37-.11.56-.17.19-.06.37-.12.57-.19l.07-.02-.07-2.05h-.38l-.02.07c-.04.09-.08.2-.13.33-.05.12-.15.26-.29.42-.07.07-.16.15-.27.25-.11.09-.25.18-.43.27-.23.11-.46.19-.71.25-.26.07-.5.11-.72.14-.24.04-.43.05-.59.06-.17.01-.28.01-.35.01-.21 0-.46-.01-.74-.03-.3-.02-.63-.09-.99-.19a5.55 5.55 0 0 1-1.11-.49 4.79 4.79 0 0 1-1.1-.91c-.14-.15-.29-.34-.45-.57-.15-.22-.3-.49-.44-.81-.13-.3-.25-.67-.34-1.05-.09-.4-.14-.84-.14-1.34 0-.53.06-1.01.17-1.43.09-.44.23-.81.39-1.12zM23.39 259.02c-.16-.09-.33-.27-.5-.54-.03-.05-.06-.13-.11-.21-.04-.09-.09-.19-.13-.28l-.13-.29-.1-.23-4.21-9.84-.03-.06h-.29l-4.6 10.24c-.11.25-.22.46-.3.64-.1.16-.19.3-.29.41-.1.1-.2.18-.31.23-.1.06-.23.09-.39.11l-.09.01v.4h3.11v-.39l-.09-.02c-.12-.02-.24-.05-.35-.1a.488.488 0 0 1-.23-.22.596.596 0 0 1-.07-.18c-.01-.05-.01-.09-.01-.12 0-.1.02-.24.09-.4.07-.16.15-.37.25-.61l.97-2.25h4.1l.91 2.16c.05.15.12.29.18.43.06.13.12.26.17.39.04.16.04.23.04.27v.11c-.01.04-.03.09-.06.15-.07.13-.16.22-.27.26-.13.06-.27.09-.41.11l-.09.01-.03.4h3.79v-.34l-.06-.03c-.13-.06-.28-.13-.46-.22zm-4.12-4.72h-3.2l1.65-3.65 1.55 3.65zM22.44 249.72h.39l.08-.4c.02-.12.1-.23.22-.34.11-.09.24-.15.4-.19.17-.04.41-.06.72-.07h2.29v9.18c0 .32-.04.56-.1.71a.89.89 0 0 1-.29.37c-.1.08-.2.13-.31.16-.13.03-.21.05-.25.06l-.06.02-.03.39h3.82v-.39l-.08-.02c-.21-.06-.37-.11-.46-.16-.1-.06-.18-.12-.27-.21-.08-.09-.13-.18-.17-.27-.03-.09-.06-.2-.07-.32-.01-.12-.01-.26-.01-.43v-9.06h2.49c.36 0 .65.05.86.15.19.09.31.32.37.69l.01.09h.38v-1.97h-9.91v2.01zM44.68 259.08a.714.714 0 0 1-.3-.23.716.716 0 0 1-.17-.32c-.02-.12-.04-.24-.05-.4-.02-.11-.02-.23-.02-.34v-8.55c.01-.24.03-.42.07-.54.03-.11.09-.2.17-.27a.94.94 0 0 1 .24-.18c.08-.04.16-.07.23-.09.09-.02.15-.04.19-.05l.07-.02v-.36H41.5l.01.39h.1c.03 0 .07.01.14.03.07.01.15.04.24.07.09.04.16.09.24.16.07.06.13.15.17.26.04.11.06.25.06.43v3.74h-6.3v-3.05c0-.28.01-.52.02-.73.01-.19.05-.34.1-.44.04-.09.1-.16.17-.21.08-.06.16-.12.23-.14.07-.03.14-.05.22-.07.07-.02.13-.04.17-.05l.07-.02v-.36H33.5v.36l.06.02c.04.01.1.03.2.05.07.01.16.04.24.07.07.04.15.09.23.16.07.06.13.16.18.27.05.15.08.29.08.44.01.15.01.38-.01.69v7.69c0 .26-.01.5-.01.71 0 .2-.02.34-.06.43-.03.12-.09.22-.17.29-.08.08-.16.15-.25.18-.09.04-.17.07-.25.09-.11.02-.14.03-.15.03h-.1v.41h3.64v-.41h-.1c-.02 0-.05-.01-.13-.02a.739.739 0 0 1-.22-.08.963.963 0 0 1-.25-.16.658.658 0 0 1-.18-.24c-.06-.12-.09-.28-.09-.45-.01-.19-.01-.45-.01-.77v-3.65h6.3v3.62c0 .27 0 .51-.01.72-.01.2-.02.35-.04.44-.02.06-.05.12-.07.16-.02.06-.04.09-.06.1a.77.77 0 0 1-.28.23c-.12.05-.26.09-.4.1l-.08.01-.04.4h3.67v-.39l-.09-.01c-.13-.07-.26-.11-.37-.15zM59.39 250.9c-.17-.37-.36-.69-.54-.96-.2-.27-.37-.48-.52-.65-.16-.17-.36-.36-.63-.59-.26-.22-.59-.43-.97-.63s-.82-.36-1.3-.49a6.43 6.43 0 0 0-1.65-.2c-.7 0-1.34.09-1.9.26-.56.17-1.05.38-1.46.62-.41.24-.77.5-1.06.78-.28.27-.51.51-.67.71-.13.15-.27.35-.42.59-.16.25-.31.54-.45.86-.14.33-.26.71-.36 1.13-.09.43-.15.91-.15 1.43 0 .64.07 1.23.22 1.75.15.51.33.97.55 1.37.22.4.46.73.71 1 .25.27.47.49.66.66.61.5 1.27.87 1.97 1.08.7.22 1.45.34 2.22.34.97 0 1.87-.16 2.65-.45.8-.31 1.53-.84 2.18-1.58.36-.39.64-.8.85-1.21.21-.41.37-.8.46-1.17.1-.37.17-.71.19-1.01.02-.3.04-.55.04-.75 0-.58-.06-1.12-.18-1.6a7.19 7.19 0 0 0-.44-1.29zm-5.62 8.04c-.57 0-1.08-.08-1.51-.25-.44-.17-.82-.37-1.14-.6-.31-.23-.57-.47-.76-.73-.2-.25-.36-.47-.47-.64a5.444 5.444 0 0 1-.75-1.84c-.06-.28-.1-.53-.11-.75-.02-.22-.02-.42-.02-.56 0-.58.05-1.09.17-1.54.11-.45.26-.84.43-1.19.17-.33.37-.62.58-.86.21-.23.41-.43.59-.58.27-.22.55-.39.84-.52.29-.13.56-.23.81-.29.25-.06.48-.1.69-.12.21-.02.38-.03.49-.03.46 0 .88.05 1.24.16s.69.24.96.39c.27.15.5.31.69.48.19.18.35.33.46.47.14.18.29.4.46.68.17.27.32.59.46.96.14.38.24.8.31 1.27.06.47.08 1 .03 1.56-.01.13-.04.33-.08.61-.03.27-.11.58-.23.92-.16.46-.37.87-.64 1.23-.26.36-.57.68-.93.94-.36.26-.75.47-1.18.6-.43.17-.89.23-1.39.23zM70.32 257.63c-.05.18-.1.32-.15.43-.05.1-.1.17-.15.23a.75.75 0 0 1-.28.18c-.11.04-.23.07-.35.08-.13.01-.25.03-.38.03s-.24.01-.35.01h-2.29l-.66-.03c-.13 0-.26-.04-.39-.11a.659.659 0 0 1-.34-.46c-.04-.23-.07-.55-.08-.96v-7.06c.01-.28.02-.54.03-.77.01-.22.03-.39.05-.48.04-.13.1-.23.17-.31.08-.07.17-.14.25-.19.08-.04.16-.07.25-.09.08-.01.14-.04.18-.04l.08-.02v-.37h-3.82v.36l.07.02c.04.02.1.03.2.05.07.01.16.05.25.09.09.05.18.11.26.19.08.08.15.19.2.31.03.11.06.27.07.49.01.23.02.49.02.78v6.91c0 .3-.01.59-.01.86s-.01.45-.02.53c-.03.18-.09.33-.16.43-.08.11-.16.19-.25.26s-.19.11-.28.15c-.1.03-.18.04-.24.05l-.09.02v.39h8.6v-2.05h-.38l-.01.09zM75.57 259.05a.853.853 0 0 1-.33-.25c-.08-.11-.14-.21-.15-.32-.02-.15-.02-.22-.03-.28a2.34 2.34 0 0 1-.03-.38v-8c0-.28.01-.51.01-.7 0-.18.02-.32.05-.43.04-.12.1-.22.16-.3.07-.07.14-.13.22-.17.09-.04.17-.07.24-.08l.04-.01c.06-.01.12-.03.16-.04l.07-.02v-.37h-3.69v.37l.08.02c.04.01.11.03.21.05.08.01.16.04.26.08.09.04.17.1.26.18.09.08.15.18.2.32.04.12.06.26.07.41 0 .17.01.39.01.68v7.57c-.01.38-.02.67-.03.89 0 .19-.06.37-.15.5-.1.14-.21.23-.34.29-.14.05-.29.1-.45.13l-.08.02v.39h3.74v-.39l-.07-.02c-.15-.04-.29-.08-.43-.14zM80.52 250.98c.17-.32.34-.58.53-.8.19-.22.37-.41.53-.55.35-.3.72-.54 1.1-.71.38-.17.75-.3 1.09-.37.34-.07.65-.13.93-.14.28-.01.5-.02.65-.02.43 0 .91.04 1.4.14.48.09.91.27 1.26.55.22.18.38.36.49.54l.28.51h.36l.07-2.14-.08-.02c-.46-.13-.88-.24-1.23-.31-.36-.08-.69-.14-.98-.18-.29-.05-.56-.08-.81-.09-.24-.01-.48-.01-.72-.01-.22 0-.53.01-.92.03-.4.02-.83.1-1.31.21-.48.12-1 .31-1.53.56-.53.25-1.05.62-1.54 1.08-.44.41-.78.84-1.04 1.28-.25.44-.45.86-.57 1.27-.13.41-.22.79-.25 1.14-.04.34-.05.63-.05.84 0 .63.08 1.25.25 1.83.17.58.42 1.13.74 1.61.33.49.73.93 1.2 1.32.47.38 1.01.69 1.61.92.3.12.61.22.91.29.29.05.57.1.82.13s.48.05.67.06c.2.01.35.01.46.01.47 0 1-.04 1.59-.11.58-.07 1.11-.17 1.57-.29.19-.05.38-.11.56-.17.19-.06.38-.12.57-.19l.07-.02-.07-2.05h-.37l-.03.07c-.03.09-.08.2-.13.33-.05.12-.16.26-.29.42-.06.07-.16.15-.27.25-.11.09-.25.18-.43.27-.22.11-.46.19-.71.25-.26.07-.5.11-.72.14-.23.04-.43.05-.59.06-.17.01-.29.01-.35.01-.2 0-.45-.01-.74-.03-.3-.02-.63-.09-.99-.19a5.55 5.55 0 0 1-1.11-.49c-.37-.22-.74-.53-1.1-.91-.14-.15-.29-.34-.45-.57-.15-.22-.3-.49-.44-.81-.13-.3-.25-.67-.34-1.05-.1-.4-.14-.84-.14-1.34 0-.53.06-1.01.17-1.43.12-.45.26-.82.42-1.13zM110.35 248.2h.11c.02 0 .04.01.09.03l.21.06c.08.02.15.05.22.09.07.04.13.08.18.13.13.16.19.36.2.61 0 .27.01.5.01.69v5.29c0 .28-.01.53-.02.74-.02.21-.04.4-.07.57-.03.17-.06.31-.1.45-.04.13-.09.27-.14.41-.08.17-.16.32-.23.43-.08.13-.14.21-.18.27-.1.1-.22.21-.37.33-.15.11-.33.22-.55.32-.21.09-.47.18-.75.25-.28.06-.59.1-.95.1-.53 0-1.05-.09-1.55-.29a2.77 2.77 0 0 1-1.25-.93c-.16-.21-.29-.43-.37-.64-.09-.22-.16-.44-.2-.68-.04-.23-.07-.47-.08-.7-.02-.24-.02-.5-.02-.76v-5.22c.01-.24.02-.44.02-.62.01-.16.03-.31.08-.42.05-.12.13-.22.25-.3.12-.09.31-.16.56-.23l.08-.01.03-.37h-3.68v.37l.08.02c.3.09.51.18.61.27.14.1.23.24.25.42.02.21.03.49.03.85v5.32c-.01.55.01 1 .05 1.33.05.32.11.62.2.9.12.31.28.64.51.95.22.32.53.62.89.89.37.26.83.47 1.36.64.53.16 1.18.24 1.91.24.76 0 1.4-.09 1.93-.27.53-.18.98-.41 1.32-.69.35-.28.62-.61.82-.95.2-.34.34-.68.42-1.01.05-.21.1-.42.13-.65.03-.22.05-.42.05-.62 0-.19.01-.35.01-.49v-5.63c0-.3.01-.53.02-.68.01-.14.05-.27.13-.39.09-.13.19-.23.31-.27.13-.05.28-.1.46-.15l.08-.02v-.37h-3.07l-.03.39zM124.54 248.18l.09.02c.38.08.63.2.73.35.11.16.18.34.2.54.02.12.03.23.02.35 0 .13-.01.21-.01.25v6.82l-7.69-8.67-.04-.04h-2.55v.38l.1.01c.17.03.32.06.46.11.12.04.21.13.3.28.06.11.1.23.11.37V257.89c0 .16 0 .34-.02.57-.01.2-.07.37-.17.48-.11.14-.23.23-.38.26-.16.04-.27.07-.32.08l-.08.01-.04.39h3.12v-.38l-.09-.02c-.24-.06-.44-.13-.58-.24-.13-.11-.23-.28-.28-.52-.02-.09-.02-.17-.03-.26-.01-.08-.01-.21-.01-.38v-8.09l8.94 10.07h.31v-10.22l.03-.7c.01-.2.1-.37.29-.51.06-.05.13-.09.22-.13.09-.04.22-.08.37-.11l.08-.02.03-.38h-3.12v.39zM132.88 259.15a.853.853 0 0 1-.33-.25.69.69 0 0 1-.16-.32c-.02-.15-.02-.23-.02-.28a2.34 2.34 0 0 1-.03-.38v-8c0-.27 0-.51.01-.7 0-.18.02-.33.05-.43.04-.13.09-.22.16-.3.07-.08.15-.13.23-.17.1-.04.17-.06.23-.08l.04-.01c.06-.01.11-.03.16-.04l.08-.02v-.37h-3.69v.37l.08.02c.05.02.12.03.21.05a1.058 1.058 0 0 1 .53.26c.08.08.14.18.19.32.04.13.06.26.07.42 0 .17.01.39.01.67v7.57c-.01.37-.02.67-.02.88-.01.19-.06.36-.16.5-.1.13-.21.23-.34.28-.14.05-.29.1-.44.14l-.08.02v.38h3.74v-.38l-.08-.02c-.16-.02-.31-.08-.44-.13zM143.14 248.18l.07.02c.13.04.25.07.37.11.1.03.18.09.24.2.04.05.05.1.06.14.01.06.01.1.01.13 0 .1-.01.21-.04.32-.03.11-.06.22-.09.32-.04.1-.07.18-.1.26-.04.08-.06.11-.06.14l-3.07 7-2.91-7.01-.13-.33c-.04-.11-.08-.21-.1-.32-.04-.15-.06-.28-.06-.39 0-.14.04-.25.14-.34.09-.09.29-.16.59-.22l.09-.02v-.38h-3.75v.37l.08.02c.13.03.25.06.33.1.08.03.17.1.27.2.14.12.24.25.31.4.07.16.12.26.14.33.08.16.15.33.22.49.07.16.14.33.21.51l4.06 9.56.03.06h.3l4.32-9.77c.09-.19.19-.41.3-.68.11-.26.23-.48.35-.66.11-.17.22-.29.33-.36.12-.07.29-.13.49-.17l.09-.02v-.37h-3.07v.36zM155.23 257.71c-.05.14-.09.28-.14.4-.04.11-.11.22-.2.32-.11.11-.23.17-.36.18-.19.03-.26.04-.32.04-.12.02-.23.03-.33.03h-1.89c-.41-.01-.77-.03-1.08-.04-.29-.02-.49-.07-.6-.15a.47.47 0 0 1-.1-.11c-.02-.04-.05-.08-.06-.1-.08-.17-.13-.37-.13-.57 0-.22-.02-.42-.03-.61v-3.23h2.45c.25 0 .49.02.74.06.22.03.39.16.51.37.02.06.05.12.07.19.03.06.05.16.09.28l.02.08h.39v-3.01h-.39l-.02.08c-.01.03-.02.09-.04.18a1.284 1.284 0 0 1-.26.5c-.08.08-.17.13-.29.17-.13.05-.27.08-.42.08h-2.86v-4.02h3.05c.21 0 .41.02.59.06.16.04.29.15.39.35.04.07.07.14.1.22.02.08.05.17.07.26l.02.07.39.03.03-2.01h-7.34v.39h.1c.03 0 .08.01.17.02.07.01.16.04.24.08.09.04.17.1.25.16.07.06.13.16.17.29.05.12.07.25.07.39l.01 8.29c-.01.16-.01.32-.01.48 0 .16 0 .32-.01.48-.01.16-.05.31-.12.44-.06.12-.16.22-.32.3-.06.04-.12.07-.19.08-.09.03-.17.05-.26.07l-.07.02-.03.38h8.33v-2.06h-.38v.09zM167.62 259.21a.744.744 0 0 1-.27-.16.877.877 0 0 1-.25-.29c-.07-.12-.12-.2-.14-.24-.19-.28-.36-.57-.52-.88l-2.28-4.15c.06-.03.13-.06.21-.11.14-.07.3-.18.48-.3.17-.13.35-.27.53-.45.18-.18.33-.39.46-.63.2-.38.29-.8.29-1.27 0-.44-.07-.82-.21-1.12-.13-.29-.25-.5-.34-.64-.22-.29-.47-.51-.76-.67-.28-.15-.57-.27-.89-.34-.31-.07-.63-.12-.96-.13-.32-.01-.63-.02-.93-.02h-4.27l.01.39h.1c.02 0 .06.01.13.03.07.01.15.04.24.07.09.03.17.08.24.14.08.06.14.14.19.24.05.11.08.25.09.4.01.17.02.39.02.66v7.95c-.02.26-.02.49-.03.68-.01.17-.03.31-.07.4-.04.11-.1.2-.17.26-.08.07-.15.12-.24.16-.09.04-.16.07-.23.09-.09.02-.13.02-.15.02h-.1v.4h3.77v-.38l-.08-.02c-.24-.07-.41-.12-.52-.17-.1-.04-.19-.1-.26-.19a.7.7 0 0 1-.18-.3c-.02-.11-.03-.24-.05-.39-.01-.09-.01-.19-.01-.3 0-.1-.01-.21-.02-.32v-3.58c.11.01.22.01.33.01.34.01.73.01 1.13-.02.21-.01.42-.03.61-.05l2.15 3.92c.12.22.26.46.41.7.16.26.35.48.57.65.14.12.29.2.43.27.14.05.29.1.42.12.13.03.25.04.37.04h1.02v-.37l-.06-.03c-.03.01-.09-.03-.21-.08zm-7.13-10.35h1.18c.32-.01.64 0 .96.03.31.03.6.14.88.32.3.18.52.43.65.74.14.31.21.65.21.97 0 .27-.03.5-.08.67-.06.18-.1.32-.16.41-.12.22-.28.41-.46.54-.18.13-.39.24-.62.32-.23.07-.47.12-.72.15-.25.02-.5.04-.73.04h-1.14l.03-4.19zM175.17 253.46l-.57-.37-1.11-.65c-.28-.17-.58-.37-.89-.58-.29-.2-.5-.47-.63-.78-.05-.14-.08-.28-.09-.39-.01-.13-.02-.22-.02-.27 0-.3.06-.58.16-.81.11-.23.26-.42.44-.58.19-.16.4-.28.66-.36.25-.08.53-.12.81-.12.39 0 .73.06.99.17.27.12.48.26.64.42.17.18.29.35.38.54.09.19.17.35.24.5l.03.06h.36v-2.12l-.07-.02c-.12-.04-.27-.09-.44-.16-.17-.07-.37-.13-.59-.19-.22-.05-.47-.1-.74-.15-.28-.05-.58-.07-.92-.07-.11 0-.27.01-.47.02-.2.01-.44.05-.68.1-.25.07-.51.17-.78.31-.27.14-.53.34-.76.59-.16.15-.33.41-.51.74-.19.34-.29.8-.29 1.35 0 .18.02.38.06.6.04.22.1.44.21.67.1.22.26.47.46.71.2.25.48.48.82.72.12.08.22.15.33.21l.06.03c.09.05.17.1.26.16l1.06.63c.33.2.63.4.92.62.26.21.47.49.62.85.03.07.07.18.12.33.04.14.06.32.06.54 0 .3-.04.56-.12.74-.08.2-.15.36-.2.45-.24.38-.56.66-.94.83-.38.18-.81.27-1.26.27-.28 0-.53-.03-.75-.08-.21-.06-.4-.14-.57-.23a1.865 1.865 0 0 1-.66-.58c-.06-.09-.12-.19-.17-.3-.06-.11-.14-.27-.22-.48l-.02-.05-.36-.04v2.1l.06.03c.27.12.62.26 1.04.41.43.15 1 .23 1.7.23.12 0 .3 0 .52-.02.23-.01.48-.05.76-.11s.57-.16.86-.31c.31-.14.61-.35.89-.63.25-.23.45-.48.59-.72.14-.24.25-.48.32-.71.08-.24.13-.45.14-.64.01-.19.03-.35.03-.47 0-.95-.35-1.75-1.05-2.4-.23-.2-.46-.38-.72-.54zM182.79 259.15a.853.853 0 0 1-.33-.25.666.666 0 0 1-.15-.32c-.02-.15-.02-.23-.02-.28a2.34 2.34 0 0 1-.03-.38v-8c0-.27 0-.51.01-.7 0-.18.02-.33.05-.43.04-.13.09-.22.16-.3.07-.08.14-.13.22-.17.1-.04.17-.06.23-.08l.04-.01c.06-.01.11-.03.16-.04l.08-.02v-.37h-3.69v.37l.08.02c.04.02.11.03.21.05.07.01.16.04.26.08.08.04.17.1.26.18.08.08.14.18.19.32.04.13.06.26.07.42 0 .17.01.39.01.67v7.57c-.01.37-.02.67-.02.88 0 .19-.06.36-.15.5a.88.88 0 0 1-.34.28c-.14.05-.29.1-.44.14l-.08.02v.38h3.73v-.38l-.08-.02c-.16-.02-.29-.08-.43-.13zM184.38 249.81h.39l.08-.39c.02-.12.09-.23.21-.34.11-.09.25-.16.4-.18.17-.04.41-.07.72-.07h2.28v9.19c0 .31-.03.55-.1.71-.07.16-.16.28-.29.36-.1.08-.2.13-.31.15-.13.03-.2.06-.24.07l-.06.02-.03.38h3.81v-.38l-.08-.02c-.21-.06-.36-.11-.46-.16-.09-.06-.18-.13-.27-.2a.725.725 0 0 1-.16-.28c-.04-.09-.06-.2-.07-.32-.01-.12-.02-.27-.02-.43v-9.05h2.49c.36 0 .64.04.86.15.18.08.31.32.37.69l.02.09h.38v-1.97h-9.91v1.98zM202.86 247.81v.38l.09.01c.14.03.26.05.37.08.08.02.15.09.22.21.05.08.07.12.07.15.01.06.01.1.01.13 0 .14-.04.3-.13.45-.1.16-.18.31-.25.45l-2.28 3.69-2.37-3.7c-.09-.13-.18-.27-.26-.44a1.02 1.02 0 0 1-.13-.48c0-.12.02-.21.08-.27.05-.08.12-.13.18-.16.09-.04.16-.07.21-.08.07-.01.11-.03.13-.03h.11v-.39h-3.76v.37l.08.01c.11.04.22.07.31.11.08.05.15.09.21.14.06.05.12.11.18.19.06.09.13.18.21.27.05.08.1.15.14.22.04.08.1.15.15.21l3.32 5.14v3.43c0 .32-.01.55-.03.69-.02.14-.09.28-.19.4-.1.11-.2.17-.31.21-.12.04-.27.07-.42.1l-.09.01-.03.39h3.73v-.38l-.08-.02c-.06-.01-.15-.03-.29-.06a.646.646 0 0 1-.34-.17.803.803 0 0 1-.27-.52 5.18 5.18 0 0 1-.04-.66v-3.34l3.32-5.33.32-.49c.1-.16.23-.28.37-.37.09-.05.17-.09.26-.11.11-.02.18-.05.22-.06l.07-.03v-.36h-3.09zM.01 191.75h.1c.14 0 .37.02.71.07.33.04.68.15 1.07.33.38.18.76.43 1.11.74.36.31.62.75.8 1.33.18.39.26.89.26 1.49v37.83c0 .84-.11 1.52-.33 2.03-.27.88-.74 1.49-1.39 1.81-.67.34-1.43.62-2.25.85l-.08.02v1h14.98v-1l-.08-.02c-.82-.23-1.61-.51-2.32-.82-.71-.31-1.23-.89-1.6-1.79-.17-.35-.3-.69-.37-1.04-.06-.32-.1-.71-.1-1.14v-18.38h10.4c1.04.05 2.12.11 3.2.2 1.04.1 1.86.56 2.44 1.4.22.22.38.52.49.89.12.42.25.93.37 1.53l.02.08h1.02v-11.82h-1.04v.1c0 .03-.01.17-.1.59-.08.34-.18.69-.3 1.05-.15.4-.37.78-.64 1.13-.29.37-.64.64-1.1.83-.5.22-1.08.35-1.75.37-.68.02-1.56.03-2.61.03h-10.4v-17.36h12.39c.95.04 1.91.15 2.87.31.93.15 1.69.67 2.27 1.55.22.35.4.71.54 1.08.14.38.25.73.34 1.08l.02.09h1l.07-7.29v-.1H.01v.95zM71.05 191.65v.1h.1c.03 0 .15.02.42.1.25.06.54.15.86.24.32.09.64.22.97.4.33.17.6.4.83.65.58.72.88 1.63.9 2.71.02 1.05.03 2.01.03 2.83v21.88c0 1.18-.04 2.23-.1 3.09-.06.85-.16 1.66-.28 2.38-.1.68-.26 1.32-.43 1.9-.19.57-.4 1.15-.62 1.73-.33.77-.66 1.38-.98 1.86-.31.47-.59.87-.78 1.12-.41.46-.95.94-1.57 1.42-.65.5-1.42.95-2.32 1.36-.91.41-1.96.77-3.14 1.05-1.18.29-2.54.44-4.03.44-2.22 0-4.41-.4-6.49-1.18-2.09-.8-3.87-2.13-5.31-3.96-.68-.9-1.22-1.83-1.6-2.76-.38-.9-.67-1.86-.86-2.84a21.3 21.3 0 0 1-.34-2.96c-.05-1.01-.07-2.07-.07-3.14v-21.6c.05-.91.08-1.76.11-2.53.02-.7.14-1.33.37-1.88.23-.53.6-.98 1.13-1.36.55-.38 1.36-.71 2.44-.97l.07-.02.08-.94h-14.5v.93l.08.02c1.31.36 2.19.74 2.65 1.15.65.48 1.03 1.14 1.12 1.97.09.87.13 2.03.13 3.55v22c-.04 2.31.02 4.08.21 5.42.19 1.33.46 2.55.83 3.64.46 1.28 1.15 2.59 2.05 3.89.88 1.3 2.09 2.49 3.6 3.54 1.47 1.05 3.33 1.91 5.52 2.58 2.19.66 4.82.99 7.83.99 3.06 0 5.71-.37 7.86-1.09 2.16-.72 3.96-1.67 5.36-2.82 1.41-1.15 2.51-2.44 3.29-3.82.79-1.4 1.37-2.78 1.74-4.09.24-.94.4-1.8.51-2.64.12-.94.18-1.76.21-2.5.02-.73.04-1.43.04-2.02V198.2c0-1.22.02-2.16.06-2.83.04-.64.24-1.23.6-1.76.4-.62.89-1.04 1.46-1.26.62-.24 1.27-.44 1.91-.61l.08-.02v-.94H71.05v.87zM144.98 231.46c-.17.56-.36 1.12-.55 1.67-.18.51-.49.98-.94 1.43-.48.48-1.04.78-1.66.86-.78.12-1.13.14-1.31.14-.5.08-.98.13-1.43.13h-7.83c-1.74-.05-3.2-.09-4.46-.16-1.25-.07-2.15-.3-2.69-.7-.23-.19-.39-.35-.49-.52a6.15 6.15 0 0 0-.3-.47c-.36-.75-.55-1.59-.57-2.49-.03-1.02-.07-1.83-.11-2.52v-13.7h10.48c1.07 0 2.12.08 3.11.24.99.14 1.78.74 2.35 1.74.09.23.2.48.31.75.12.28.24.69.38 1.21l.02.08h1.01v-11.76h-1l-.02.07c-.04.12-.09.34-.17.73a4.83 4.83 0 0 1-1.15 2.21c-.33.37-.77.64-1.3.82-.59.23-1.19.34-1.85.34h-12.16v-17.28h12.95c.88 0 1.73.08 2.52.26.76.18 1.37.71 1.85 1.6.18.32.33.66.44 1 .14.44.23.78.31 1.09l.02.07 1.01.09.14-7.49v-.1H112.2v.96h.1c.14 0 .38.02.75.07.34.04.72.15 1.1.33.38.18.76.43 1.11.74.35.31.62.75.8 1.33.22.53.33 1.11.33 1.73v34.31c-.05.64-.06 1.3-.04 1.96.02.66.02 1.33-.03 2-.04.7-.21 1.36-.5 1.94-.29.58-.76 1.04-1.44 1.39-.26.18-.56.31-.9.4-.34.09-.69.18-1.06.27l-.07.02-.09 1h33.75v-7.86H145l-.02.07zM193.82 190.79v.94l.08.02c1.67.36 2.76.9 3.23 1.6.49.71.78 1.5.88 2.35.09.49.13.99.1 1.51-.03.47-.04.83-.04 1v29.11l-32.38-36.49-.03-.04h-10.04v.95l.09.01c.68.09 1.33.23 1.94.44.59.19 1.06.61 1.42 1.29.32.49.48 1.06.5 1.69.03.61.03 1.41.03 2.69v34.32c0 .62-.03 1.39-.1 2.34-.07.93-.33 1.63-.78 2.18-.48.66-1.06 1.07-1.72 1.22-.57.14-1.09.25-1.37.31l-.07.01-.09 1.01h12.18v-1l-.08-.02c-1.05-.22-1.91-.57-2.54-1.05-.63-.45-1.07-1.25-1.29-2.35-.05-.35-.08-.72-.1-1.09-.02-.36-.03-.89-.03-1.56v-34.31l37.39 42.1.03.03h.78l-.01-41.93c.04-.87.08-1.7.12-2.53l.01-.38c.05-.89.49-1.68 1.35-2.35.25-.22.58-.42.97-.6.4-.18.94-.34 1.59-.46l.08-.02.08-.94h-12.18z\" /><path d=\"m90.37 191.73.09.02c.76.13 1.5.35 2.21.67.68.31 1.17.87 1.49 1.71.28.91.41 2.44.41 4.69v40.39c0 1.92-.11 3.81-.35 5.62-.23 1.82-.98 3.52-2.24 5.04-.46.6-1.02 1.18-1.7 1.77-.59.5-1.02.85-1.15.94l-.08.05.58 1 .09-.04c1.18-.54 2.11-1 2.78-1.37.64-.34 1.21-.71 1.76-1.1 1.52-.96 2.72-2.02 3.57-3.13.86-1.16 1.5-2.23 1.93-3.27.44-1.06.72-2.09.84-3.07.11-.95.19-1.8.24-2.51v-40.32c0-1.9.08-3.28.24-4.23.15-.91.72-1.65 1.69-2.17.29-.17.59-.31.85-.41.23-.08.66-.17 1.32-.26l.09-.01v-.95H90.37v.94z\" /><g><path d=\"M112.12 9.59V5.28c-1.98-.2-4.14-.34-6.6-.41h-.16V0h-4.83v4.87h-.16c-2.47.07-4.64.21-6.64.41v4.31c1.97-.21 4.15-.35 6.62-.42l.17-.01v13.88h4.83V9.16l.17.01c2.48.07 4.64.21 6.6.42z\" /><path style=\"fill-rule:evenodd;clip-rule:evenodd\" d=\"M58.4 19.61c.16.04.31.04.46.03 4.4-.69 11.24-5.21 14-8.73.05-.07.1-.14.11-.23a.565.565 0 0 0-.43-.7c-6.01 0-13.14 3.72-15.17 7.54-.04.09-.09.18-.11.28-.19.8.32 1.61 1.14 1.81zM31.25 45.66c.19 0 .36-.03.53-.09.02 0 .04-.01.05-.02.18-.07.33-.18.48-.31 4.09-5.36 5.39-11.73 5.8-18.11a.603.603 0 0 0-.6-.57c-.03 0-.06 0-.09.01-.13.02-.24.08-.33.17-.79.82-1.67 1.75-2.31 2.54-3.15 3.83-5.26 8.09-5.26 13.16 0 .71.07 1.42.26 2.12.18.63.77 1.1 1.47 1.1zM19.84 86.38c.25.16.54.27.87.27.19 0 .37-.03.54-.09.02 0 .03-.01.05-.02.28-.11.52-.29.69-.52.16-.21.26-.46.31-.74.69-5.76-2.29-17.29-5.54-20.51a.59.59 0 0 0-.42-.16c-.03 0-.07 0-.1.01-.13.02-.25.09-.34.18-.05.06-.09.12-.12.2-1.44 6.04-1.45 11.98 1.21 17.75.67 1.42 1.63 2.65 2.85 3.63zM49.44 37.83c.02-.06.05-.12.06-.19v-.03c0-.32-.22-.55-.51-.61-6.35-.11-13.31 4.93-14.99 9.53a1.33 1.33 0 0 0-.02.85c.18.68.81 1.19 1.55 1.19.12 0 .23-.02.35-.05 4.54-1.21 11.32-6.41 13.56-10.69zM42.73 28.58c.17.05.34.08.5.07h.05c.18-.01.35-.07.52-.14 5.25-3.65 8.28-9.02 10.51-14.66a.554.554 0 0 0-.37-.68c-.03-.01-.06-.02-.1-.02-.12-.02-.24 0-.35.06-.95.51-2.01 1.08-2.83 1.62-3.95 2.55-7.1 5.78-8.58 10.35-.2.64-.35 1.3-.38 1.98 0 .63.39 1.22 1.03 1.42zM61.12 23.74c.03-.05.06-.11.07-.18v-.03c.03-.3-.16-.54-.42-.62-5.97-.64-12.97 3.51-14.97 7.7-.05.13-.09.27-.11.41-.02.13 0 .27.02.4.11.65.66 1.18 1.36 1.25.11.01.22-.01.33-.02 4.39-.75 11.23-5.07 13.72-8.91zM28.23 67.74c.18-.01.34-.05.5-.11 4.58-2.11 9.54-9.09 11.37-14 .01-.04.03-.1.03-.15v-.05c0-.05-.01-.1-.02-.15a.602.602 0 0 0-.54-.42c-5.16.12-12.11 7.47-12.98 13.18 0 .05-.01.11-.01.16.01.14.03.27.07.4a1.592 1.592 0 0 0 1.58 1.14zM21.83 64.57c.32.42.82.69 1.38.66.19 0 .37-.05.54-.11.02-.01.04-.01.05-.02a1.563 1.563 0 0 0 .76-.69c2.28-4.8 2.9-14.4 1.06-19.81a.628.628 0 0 0-.63-.45c-.03 0-.07.01-.1.02-.13.03-.26.09-.34.2-.02.03-.04.06-.06.08-.6 1.03-1.14 1.94-1.61 2.89-2.19 4.55-3.31 9.28-2.2 14.33.24 1.04.62 2.01 1.15 2.9zM24.77 86.04c.09.29.26.56.5.75.28.23.63.37 1.02.37.19 0 .37-.04.54-.09.02-.01.04-.01.05-.02.16-.06.29-.15.42-.25 4.11-3.35 7.35-12.09 7.75-16.72a.56.56 0 0 0-.18-.42.647.647 0 0 0-.44-.18c-5.72 1.71-10.74 10.62-9.66 16.56zM20.96 106.4c.52.54 1.12.97 1.78 1.31.23.1.49.17.76.17.21 0 .42-.04.61-.11.29-.1.54-.27.74-.49.1-.1.17-.22.25-.35a1.78 1.78 0 0 0 .22-.87c-.61-6.18-5.91-15.29-9.8-18.99a.789.789 0 0 0-.38-.18h-.15c-.04 0-.08.01-.12.02-.21.06-.38.19-.47.37-.03.05-.05.11-.07.17-.19 5.14.79 9.91 3.1 14.37.86 1.69 2.19 3.2 3.53 4.58zM61.77 155.97c.25-.12.47-.27.66-.47a2.095 2.095 0 0 0 .53-1.38c0-.54-.23-1.04-.57-1.4-.07-.08-.17-.15-.25-.22-5.5-3.79-15.85-5.99-21.62-5.43-.21.06-.4.19-.51.36-.05.08-.09.17-.12.27-.02.09-.03.18-.02.27 0 .08.02.17.05.24.02.05.04.09.07.14l.09.12c3.24 3.13 7.01 5.43 11.26 6.96 2.73.99 5.55 1.53 8.47 1.04.66-.11 1.32-.28 1.96-.5zM31.98 127.02c.18-.01.36-.04.53-.09.28-.1.53-.28.74-.49a2.003 2.003 0 0 0 .41-.74c.04-.16.06-.32.06-.49 0-.06 0-.12-.01-.18-.02-.15-.07-.28-.12-.41-3.4-6.8-8.95-11.23-15.28-15.06a.584.584 0 0 0-.22-.08c-.05-.01-.1-.01-.15-.01l-.12.03c-.21.05-.38.18-.48.36-.02.05-.05.11-.06.17 0 .03-.02.06-.02.09v.13c1.71 6.13 4.82 11.36 10.18 15.1 1.35.93 2.85 1.48 4.54 1.67zM28.38 106.78c.1.13.23.23.36.34.06.04.12.08.19.11.26.14.56.22.87.21a2 2 0 0 0 .61-.11c.29-.1.54-.27.74-.49.01-.01.02-.02.02-.03 3.12-4.19 4.13-13.29 3.38-18.68a.668.668 0 0 0-.1-.31.502.502 0 0 0-.14-.15.694.694 0 0 0-.41-.2h-.14c-.05 0-.09.01-.13.02-.08.02-.14.07-.21.1-5.89 4.95-7.36 14.09-5.26 18.88.08.11.14.22.22.31zM44.14 142.43c.1-.02.2-.04.29-.07.29-.1.53-.28.74-.5.1-.1.18-.22.24-.34.07-.13.13-.26.16-.4.04-.15.06-.32.06-.49 0-.06-.01-.12-.01-.18-.02-.21-.08-.42-.17-.59-.06-.12-.12-.21-.2-.31-4.27-4.7-14-9.84-19.37-10.15h-.08c-.04.01-.07.01-.11.02a.71.71 0 0 0-.47.37c-.03.06-.05.11-.07.17-.01.03-.01.06-.02.09V130.2l.03.16.06.12c2.87 5.29 10.78 11.94 17 12.06.64.01 1.27-.04 1.92-.11zM36.37 125.21c.06.09.11.18.18.26a1.562 1.562 0 0 0 .54.44c.18.1.38.16.6.2.09.01.18.02.27.02a2 2 0 0 0 .61-.11 1.883 1.883 0 0 0 .99-.83c.02-.04.03-.07.05-.1.39-.99.73-1.99.92-3.02.76-4.08.25-8.15-.58-12.17-.2-.94-.44-1.87-.71-2.92a.722.722 0 0 0-.09-.2.509.509 0 0 0-.13-.16c-.03-.04-.07-.06-.12-.09a.667.667 0 0 0-.29-.1h-.14c-.04 0-.09.01-.13.02-.15.04-.29.13-.39.25-.04.05-.09.1-.13.16-3.05 4.26-4.27 8.99-3.18 14.1.31 1.46.99 2.88 1.73 4.25zM49.33 140.67c.04.03.08.05.12.07a1.944 1.944 0 0 0 .87.21c.06 0 .13 0 .19-.01.15-.02.28-.05.42-.09.28-.1.54-.28.73-.5.09-.1.17-.22.24-.34.05-.1.09-.2.13-.31 1.04-4.99-1.65-13.34-4.79-18.23-.03-.04-.06-.08-.1-.12-.04-.03-.07-.06-.12-.09a.771.771 0 0 0-.29-.1h-.15c-.04 0-.09.01-.13.02-.18.05-.33.17-.43.32-3.03 5.49-1.94 14.59 3.31 19.17zM64.76 151.82c.28.13.58.22.91.22.05 0 .1 0 .15-.01.19-.01.37-.05.54-.12.32-.11.61-.3.83-.55.1-.12.2-.25.27-.38.17-.29.25-.64.25-.99-.61-6.63-4.54-11.7-8.71-16.8a.922.922 0 0 0-.26-.22.954.954 0 0 0-.3-.09c-.03 0-.06-.01-.09-.01-.02 0-.05 0-.08.01a.902.902 0 0 0-.66.37c-.04.07-.07.15-.1.22-1.81 6 2.1 15.29 7.25 18.35zM81.54 160.85c-.15-.11-.31-.18-.48-.25-6.28-2.14-16.73-1.52-22.16.54a.794.794 0 0 0-.5.56c-.01.03-.01.06-.02.1 0 .06-.01.12 0 .17a.93.93 0 0 0 .11.38c.03.06.08.11.13.16.04.04.09.08.14.11 3.97 2.16 8.21 3.36 12.71 3.69 2.91.23 5.77 0 8.45-1.26.61-.29 1.19-.63 1.74-1 .07-.06.15-.12.21-.19.11-.12.2-.24.28-.38.16-.29.25-.64.25-1 0-.55-.22-1.04-.57-1.4-.09-.07-.19-.16-.29-.23z\" /><path style=\"fill-rule:evenodd;clip-rule:evenodd\" d=\"M122.03 159.84c6.25-.54 13.12-10.58 12.12-17.54-.01-.01-.01-.03-.01-.04-.03-.1-.07-.19-.12-.27a.851.851 0 0 0-.65-.38H133.2c-.11.02-.21.05-.3.09-.06.03-.11.07-.16.11-5.25 4.69-10.22 9.37-11.54 16.57-3.97 1.02-11.11 2.98-18.19 5.53-7.08-2.54-14.22-4.51-18.19-5.53-1.31-7.2-6.29-11.88-11.54-16.57-.05-.04-.1-.08-.16-.11a.802.802 0 0 0-.3-.09h-.18c-.05 0-.09.01-.14.02-.22.05-.4.18-.51.36-.05.08-.09.17-.12.27 0 .01 0 .03-.01.04-.99 6.97 5.88 17 12.12 17.54 4.32.89 10.09 2.86 15.79 5.27-6.18 2.41-11.91 5.23-14.92 8.22l2.24 2.61c2.77-2.74 9.05-6.29 15.91-9.41 6.87 3.11 13.14 6.66 15.92 9.41l2.23-2.61c-3-2.99-8.73-5.81-14.91-8.22 5.69-2.41 11.47-4.37 15.79-5.27zM133.14 10.91c2.76 3.52 9.6 8.04 14 8.73.15.01.31.01.46-.03.82-.2 1.33-1 1.14-1.82-.02-.1-.07-.19-.11-.28-2.03-3.82-9.16-7.53-15.17-7.54a.579.579 0 0 0-.32.94zM174.17 45.55c.02.01.04.01.05.02a1.551 1.551 0 0 0 2.01-1.01c.19-.7.26-1.41.26-2.12 0-5.07-2.11-9.33-5.25-13.16-.64-.8-1.53-1.72-2.32-2.54a.555.555 0 0 0-.33-.17c-.03 0-.06-.01-.1-.01-.32 0-.57.25-.59.57.41 6.38 1.71 12.76 5.8 18.11.14.13.3.24.47.31zM183.71 85.28c.03.28.14.53.3.74.17.23.41.42.69.52.02.01.03.02.05.02.17.06.35.09.54.09.32 0 .61-.11.86-.27 1.22-.98 2.19-2.21 2.86-3.65 2.65-5.77 2.65-11.7 1.2-17.75a.666.666 0 0 0-.12-.2.701.701 0 0 0-.34-.18c-.03 0-.07-.01-.1-.01-.16 0-.31.06-.42.16-3.24 3.24-6.22 14.77-5.52 20.53zM170.47 48.57c.74 0 1.37-.5 1.55-1.19.04-.13.06-.27.06-.4 0-.16-.03-.31-.07-.45-1.7-4.6-8.66-9.64-15-9.53-.29.06-.51.29-.51.61v.03c.01.07.03.13.06.19 2.25 4.28 9.03 9.48 13.57 10.69.11.03.22.05.34.05zM162.2 28.51c.16.07.34.13.52.14h.05c.17.01.33-.01.5-.07.64-.2 1.03-.79 1.02-1.42-.03-.69-.18-1.34-.38-1.98-1.47-4.57-4.62-7.8-8.57-10.35-.81-.54-1.88-1.11-2.83-1.62a.537.537 0 0 0-.35-.06c-.03 0-.06.01-.09.02-.29.09-.44.39-.37.68 2.22 5.63 5.25 11.01 10.5 14.66zM158.94 32.68c.7-.07 1.25-.6 1.36-1.25.03-.13.03-.26.02-.4-.02-.15-.06-.28-.11-.41-1.99-4.19-8.99-8.34-14.97-7.7-.27.08-.45.32-.42.62v.03c.01.06.04.12.07.18 2.48 3.84 9.33 8.16 13.71 8.92.11 0 .23.02.34.01zM165.9 53.28c-.01.05-.02.1-.02.15v.05c0 .05.02.1.03.15 1.83 4.92 6.79 11.89 11.37 14 .15.06.31.1.49.11a1.6 1.6 0 0 0 1.44-.78c.07-.11.12-.23.16-.35.04-.13.06-.26.07-.4 0-.06 0-.11-.01-.16-.87-5.72-7.82-13.06-12.98-13.18-.26.01-.48.17-.55.41zM181.51 64.53c.17.24.41.44.68.56.02.01.04.02.05.02.17.07.35.11.55.11.56.03 1.06-.24 1.38-.66.54-.89.92-1.86 1.15-2.91 1.11-5.05 0-9.79-2.19-14.33-.47-.95-1.01-1.87-1.62-2.89a.922.922 0 0 0-.05-.08.649.649 0 0 0-.35-.2.355.355 0 0 0-.1-.02.645.645 0 0 0-.63.45c-1.84 5.41-1.23 15.01 1.05 19.81.03.06.05.11.08.14zM179.18 87.06a1.615 1.615 0 0 0 1.56-.28c.24-.19.41-.45.5-.75 1.09-5.93-3.94-14.85-9.65-16.56h-.01c-.17 0-.33.07-.44.18-.11.11-.17.25-.18.42.4 4.63 3.64 13.37 7.75 16.72.13.1.26.19.42.25.01.01.03.01.05.02zM191.02 86.89h-.14a.78.78 0 0 0-.39.18c-3.89 3.7-9.2 12.81-9.8 18.99 0 .16.02.32.06.47.04.15.1.28.16.4.07.13.15.24.24.35.21.22.45.39.74.49.19.07.4.11.61.11.27 0 .53-.07.76-.17.66-.34 1.27-.78 1.78-1.31 1.34-1.39 2.67-2.89 3.54-4.58 2.3-4.46 3.29-9.23 3.1-14.37a.765.765 0 0 0-.54-.54c-.04 0-.08-.01-.12-.02zM166 147.44a.908.908 0 0 0-.51-.36c-5.77-.56-16.12 1.64-21.62 5.43-.09.07-.18.14-.25.22-.35.36-.57.85-.57 1.4 0 .36.09.71.25 1 .07.14.16.27.27.38.18.21.41.35.66.47.63.22 1.29.39 1.97.51 2.92.49 5.74-.05 8.47-1.04 4.25-1.53 8.01-3.83 11.25-6.96.03-.04.07-.07.09-.12.03-.04.05-.09.07-.14.03-.07.04-.16.05-.24a.961.961 0 0 0-.13-.55zM188.73 110.02a.738.738 0 0 0-.55-.53c-.04-.01-.08-.02-.13-.03-.05 0-.09 0-.14.01-.08.01-.15.04-.22.08-6.33 3.84-11.88 8.26-15.28 15.06-.05.14-.1.26-.12.41 0 .06-.01.12-.01.18-.01.17.02.33.06.49a2.003 2.003 0 0 0 .41.74c.2.22.45.39.74.49.17.06.35.08.53.09 1.69-.19 3.19-.74 4.55-1.68 5.35-3.73 8.47-8.97 10.17-15.1v-.13c.01-.02 0-.05-.01-.08zM174.84 106.84c.2.22.45.39.74.49.19.06.4.11.61.11.31 0 .61-.07.88-.21.06-.03.13-.08.19-.11.13-.1.25-.21.36-.34.08-.09.14-.21.2-.32 2.11-4.8.63-13.94-5.26-18.88a.75.75 0 0 0-.2-.1.585.585 0 0 0-.13-.02h-.15c-.16.02-.3.09-.42.2-.05.04-.09.1-.13.15-.06.1-.09.2-.1.31-.74 5.4.26 14.5 3.39 18.68.01.02.02.03.02.04zM180.85 129.97a.865.865 0 0 0-.07-.17.752.752 0 0 0-.48-.37c-.04-.01-.08-.01-.11-.02h-.08c-5.37.3-15.1 5.45-19.37 10.15-.07.1-.14.19-.19.31-.09.18-.15.38-.17.59 0 .05-.01.11-.01.18 0 .17.02.33.06.49.04.14.09.27.17.4.07.13.15.24.24.34.2.22.45.39.74.5.1.03.2.05.29.07.64.07 1.28.12 1.91.11 6.23-.12 14.13-6.76 17-12.06.02-.04.05-.08.06-.12.01-.05.02-.1.03-.16V130.06c-.02-.03-.02-.06-.02-.09zM166.39 125.09c.02.03.03.07.05.1.07.12.16.23.25.34.2.22.45.39.74.49a1.781 1.781 0 0 0 .89.09c.21-.03.41-.1.6-.2.06-.03.13-.07.19-.11.13-.09.25-.2.36-.33.06-.08.13-.16.17-.26.74-1.37 1.42-2.8 1.74-4.26 1.09-5.11-.13-9.84-3.19-14.1a1.01 1.01 0 0 0-.13-.16.736.736 0 0 0-.52-.27h-.15a.71.71 0 0 0-.3.1c-.04.03-.08.05-.12.09-.05.05-.09.1-.13.16-.04.06-.07.13-.09.2-.27 1.05-.51 1.98-.71 2.92-.83 4.02-1.34 8.09-.58 12.17.2 1.03.54 2.04.93 3.03zM159.53 121.18a.507.507 0 0 0-.13-.02h-.14c-.1.02-.21.05-.3.1-.04.02-.08.06-.12.09-.04.03-.06.07-.1.12-3.14 4.9-5.83 13.25-4.79 18.23.04.11.07.21.13.31.07.12.15.24.25.34.2.22.45.4.73.5.14.05.27.08.42.09.06.01.13.01.19.01.1 0 .19-.01.28-.02.22-.03.42-.1.6-.19.04-.02.08-.05.12-.07 5.26-4.58 6.34-13.68 3.29-19.18a.714.714 0 0 0-.43-.31zM147.87 132.91a.605.605 0 0 0-.15-.02c-.03-.01-.06-.01-.08-.01-.03 0-.05.01-.09.01-.1.01-.21.05-.3.09-.1.05-.19.13-.26.22-4.17 5.1-8.09 10.17-8.71 16.8 0 .35.09.69.25.99.08.13.17.26.27.38.23.25.51.44.83.55.17.06.35.11.53.12.06.01.1.01.15.01.33 0 .63-.08.9-.22 5.15-3.05 9.06-12.35 7.25-18.33a.625.625 0 0 0-.1-.22.74.74 0 0 0-.49-.37z\" /><path style=\"fill-rule:evenodd;clip-rule:evenodd\" d=\"M147.6 161.71a.66.66 0 0 0-.12-.27.845.845 0 0 0-.38-.29c-5.43-2.06-15.88-2.68-22.16-.54-.17.06-.34.14-.48.25-.11.07-.2.16-.28.25-.36.36-.57.85-.58 1.4 0 .36.09.7.25 1 .08.14.17.26.27.38.06.07.14.13.22.19.55.37 1.12.71 1.73 1 2.68 1.26 5.53 1.48 8.45 1.26 4.49-.33 8.74-1.53 12.7-3.69.05-.03.1-.07.14-.11.05-.05.09-.1.13-.16.03-.04.05-.09.07-.14a.85.85 0 0 0 .05-.24c.01-.06.01-.12 0-.17.01-.06 0-.09-.01-.12z\" /><g><path d=\"M112.16 68.66h-1.92v4.11c0 1.47-.64 2.48-1.94 3.06-1.09.48-2.21.5-2.23.5v.95l-.01.96h.01v1.38c1.1 0 2.07-.15 2.89-.47v17.88h1.92V77.87c0-.01 0-.02.01-.02 1.34-1.49 1.29-3.36 1.26-3.72v-5.47zM114.11 70.24h11.48v3.3h-11.48zM114.11 92.84h11.48v3.3h-11.48z\" /><g><path d=\"M82.63 84.16h2.01v3.26h-2.01zM82.63 77.87h2.01v3.26h-2.01zM95.86 84.16h1.98v3.26h-1.98zM92.42 77.87h1.97v3.26h-1.97zM86.11 84.16h1.97v3.26h-1.97z\" /><path d=\"M136.46 36.67c-.74 0-1.48.05-2.2.16-1.62.22-3.27.33-4.95.33-6.36 0-12.35-1.58-17.61-4.36-.8-.42-1.58-.88-2.33-1.35-.37-.23-.74-.48-1.11-.72-.32-.22-.96-.68-.96-.68a7.513 7.513 0 0 0-4.35-1.39c-1.62 0-3.13.52-4.35 1.39 0 0-.64.45-.96.68-.38.24-.74.49-1.11.72-.76.47-1.54.93-2.33 1.35a37.543 37.543 0 0 1-17.61 4.36c-1.69 0-3.35-.11-4.98-.33-.72-.1-1.44-.15-2.18-.15-8.48 0-15.35 6.84-15.35 15.28v31.4c-.02.59-.03 1.2-.03 1.8 0 28.24 20.17 51.77 46.95 57.17.63.09 1.28.14 1.95.14.63 0 1.25-.04 1.86-.12 26.7-5.35 46.84-28.73 47.03-56.83V51.95c-.02-8.45-6.89-15.28-15.38-15.28zM99.3 68.64v4.49h-3.44v1.72h3.44v22.29h-1.46v-6.7h-1.98v6.8h-1.48v-6.8h-1.97v6.7h-1.47l.01-22.29h3.43v-1.72h-3.43V70.1h3.43v-1.46h1.48v1.46h1.98v-1.46h1.46zm-6.72-18.07h.03l1.37-2.76 1.36 2.73.01.03 3.06.44-2.19 2.12-.02.02.52 3.03-2.73-1.43-2.73 1.43.51-3v-.03l-2.2-2.14 3.01-.44zm-14.12 8.8.03-.01 1.37-2.75 1.34 2.72.01.03 3.05.44-2.19 2.12-.02.02.53 3.03-2.73-1.44-2.74 1.44.51-3.01.01-.03-2.21-2.15 3.04-.41zM70.05 73.9l.03-.01 1.37-2.75 1.35 2.72.02.02 3.06.45-2.19 2.12-.02.02.51 3.02-2.7-1.41-.03-.01-2.74 1.43.52-2.99.01-.03-2.21-2.14 3.02-.44zm1.84 21.01-.03-.02-2.73 1.43.51-2.99.01-.03-2.2-2.15 3.02-.43.03-.01 1.37-2.76 1.36 2.73.02.03 3.05.44-2.19 2.12-.02.02.53 3.02-2.73-1.4zm11.52 15.52-2.71-1.41-.03-.01-2.74 1.43.53-3v-.03l-2.21-2.14 3.02-.44h.03l1.37-2.75 1.35 2.72.02.03 3.06.44-2.19 2.13-.02.02.52 3.01zm6.15-37.3h-3.45v1.72h3.45v15.59h-3.45v1.74h3.45v3.02h-3.45v2.04h-1.47V95.2h-3.49v-3.02h3.49v-1.74h-3.49V74.85h3.49v-1.72h-3.49V70.1h3.49v-1.46h1.47v1.46h3.45v3.03zm8.17 45.66L95 117.36l-2.73 1.43.51-3 .01-.02-2.21-2.15 3.03-.43.03-.01 1.36-2.76 1.36 2.73.01.03 3.05.44-2.19 2.12-.02.02.52 3.03zm50.65-33.62c0 26.27-18.77 48.16-43.69 53.17-.57.08-1.16.12-1.75.12l-.01-105.82c1.51 0 2.95.64 4.09 1.45l.01-.01c.29.22.59.42.9.62.33.22.68.45 1.03.67.7.44 1.43.86 2.16 1.26 4.88 2.58 11.09 3.92 17.01 3.92 1.58 0 3.23-.21 4.76-.41.65-.09 1.92-.12 2.61-.12 7.69 0 12.82 5.88 13.11 13.47h.01c0 .01-.24 31.43-.24 31.68z\" /><path d=\"M92.42 84.16h1.97v3.26h-1.97zM95.86 77.87h1.98v3.26h-1.98zM86.11 77.87h1.97v3.26h-1.97z\" /></g><g><path d=\"m115.1 51.06-2.96-.43-.03-.06-1.29-2.61-1.33 2.67-2.95.43 2.14 2.07-.51 2.93 2.65-1.39 2.64 1.39-.5-2.93zM127.75 61.33l2.1-2.03-2.96-.43-1.32-2.66-1.33 2.66-2.95.43 2.13 2.08v.06l-.5 2.86 2.65-1.38 2.64 1.38-.51-2.92zM136.18 75.12l2.09-2.03-2.96-.43-.03-.05-1.29-2.6-1.32 2.65-2.96.43 2.15 2.08-.52 2.93 2.65-1.39 2.63 1.39-.49-2.93zM138.68 89.82l-2.96-.43-.03-.05-1.29-2.61-1.33 2.66-2.95.43 2.14 2.08-.51 2.92 2.65-1.38 2.64 1.38-.51-2.92zM130.71 104.5l-2.95-.43-.04-.06-1.28-2.61-1.33 2.67-2.95.43 2.14 2.07-.51 2.93 2.65-1.39 2.64 1.39-.51-2.93zM114.43 115.29l2.08-2.03-2.95-.42-1.32-2.67-1.33 2.67-.06.01-2.89.41 2.14 2.08-.02.07-.48 2.86 2.64-1.39 2.64 1.39-.5-2.93z\" /></g></g></g></symbol>"
});
var result = _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default().add(symbol);
/* harmony default export */ __webpack_exports__["default"] = (symbol);

/***/ }),

/***/ 9858:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3465);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2594);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__);


var symbol = new (_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default())({
  "id": "logo_mobile",
  "use": "logo_mobile-usage",
  "viewBox": "0 0 214 64",
  "content": "<symbol xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 214 64\" id=\"logo_mobile\"><path d=\"m64.65 29.85-.94-1.81c-.45-.86-.62-1.83-.48-2.79l.28-1.98c.21-1.51-.33-3.02-1.47-4.07l-1.5-1.41a4.65 4.65 0 0 1-1.41-2.46l-.42-1.96c-.32-1.49-1.36-2.75-2.8-3.38L54 9.16c-.9-.39-1.65-1.04-2.17-1.84l-1.09-1.7a4.98 4.98 0 0 0-3.86-2.26L44.8 3.2a5.11 5.11 0 0 1-2.67-.98L40.48 1a5.152 5.152 0 0 0-4.47-.8l-1.99.58c-.93.27-1.93.27-2.86 0L29.17.2c-1.54-.44-3.2-.15-4.47.8l-1.65 1.22c-.77.57-1.7.91-2.67.98l-2.08.15c-1.59.11-3.03.96-3.86 2.26l-1.09 1.7c-.52.81-1.27 1.45-2.17 1.84L9.27 10c-1.44.63-2.48 1.89-2.8 3.38l-.42 1.96c-.2.94-.7 1.8-1.4 2.46l-1.51 1.4c-1.13 1.06-1.68 2.57-1.46 4.08l.28 1.98c.14.96-.03 1.93-.48 2.79l-.94 1.81c-.7 1.35-.7 2.94 0 4.29l.94 1.8c.45.86.62 1.83.48 2.79l-.28 1.99c-.21 1.5.33 3.01 1.46 4.07l1.5 1.4c.71.67 1.2 1.53 1.41 2.46l.42 1.96c.32 1.49 1.36 2.75 2.8 3.38l1.91.83c.9.4 1.65 1.04 2.17 1.85l1.09 1.7c.83 1.31 2.27 2.15 3.86 2.26l2.09.15c.97.07 1.9.41 2.67.98L24.7 63c1.27.94 2.93 1.24 4.47.8l1.99-.58a5.15 5.15 0 0 1 2.86 0l1.99.58c1.53.44 3.2.15 4.47-.8l1.65-1.22c.77-.57 1.7-.91 2.67-.98l2.09-.15c1.59-.11 3.03-.95 3.86-2.26l1.09-1.7c.52-.81 1.27-1.45 2.17-1.85l1.9-.84c1.44-.63 2.48-1.89 2.8-3.38l.42-1.96c.2-.94.69-1.79 1.41-2.46l1.5-1.4a4.72 4.72 0 0 0 1.47-4.07l-.28-1.99c-.14-.96.03-1.93.48-2.79l.94-1.8c.71-1.36.71-2.95 0-4.3zM32.59 60.08c-15.61 0-28.26-12.57-28.26-28.09C4.33 16.48 16.98 3.9 32.59 3.9c15.61 0 28.26 12.57 28.26 28.09 0 15.51-12.65 28.09-28.26 28.09z\" /><path d=\"M7.48 38.38c-.06.01-.16.04-.22.09-.09.09-.09.19-.08.28l-.07.02-.51-2.26.66-.15.02.07c-.24.11-.26.21-.2.48l.19.82 1.07-.24-.14-.63c-.08-.35-.16-.43-.4-.41l-.02-.07.95-.21.02.07c-.06.02-.13.05-.16.11-.09.1-.07.19-.04.33l.17.74 1-.23c.36-.08.43-.11.45-.42l.07-.02.29 1.27-.07.01c-.13-.25-.22-.26-.56-.18l-2.42.53zM6.89 35c-.3.02-.41.06-.44.33h-.07l-.08-1.28.07-.01c.08.25.16.29.48.27l1.54-.1c.22-.01.34-.02.46-.06.38-.11.64-.44.61-.93-.03-.39-.21-.61-.35-.71-.24-.16-.57-.15-.76-.13l-1.61.1c-.29.02-.4.04-.44.32h-.08l-.06-.97h.07c.08.28.21.28.45.27l1.6-.1c.35-.02.8-.04 1.15.31.32.32.38.77.4 1.03.02.42-.06.79-.24 1.05-.32.44-.78.48-1.1.51l-1.6.1zM6.32 29.58l.07.01c0 .08.01.19.12.26.07.05.17.06.33.07l2.59.17c.18.01.4.03.56.09.45.18.6.61.75.99l-.07.03c-.26-.34-.42-.37-1.28-.43l-2.59-.18c-.31-.02-.42-.02-.49.28l-.07-.01.08-1.28zM9.22 27.87c.4.07.46.02.53-.37l.11-.59c.05-.28.06-.36-.21-.5l.02-.07.67.12-.48 2.51-.07-.01c.01-.29-.16-.33-.45-.38l-2.38-.44c-.23-.04-.38-.04-.45.22l-.07-.02.42-2.22.66.12-.02.08c-.29.01-.32.11-.36.32l-.16.82 1.07.2.12-.63c.05-.3 0-.41-.22-.49l.02-.07.96.18-.01.07c-.3.01-.33.13-.38.43l-.11.58.79.14zM7.78 24.42c-.09-.03-.16-.06-.24-.05-.15.01-.21.12-.25.19l-.07-.02.34-.91 2.97-1.08-1.76-.65c-.26-.09-.39-.11-.53.13L8.17 22l.34-.91.07.03c-.04.25.04.33.3.42l2.82 1.04-.1.28-3.5 1.27 2.16.8c.32.12.4.04.51-.13l.07.02-.35.91-.06-.03c.02-.07.03-.14-.01-.23-.05-.1-.13-.15-.29-.2l-2.35-.85zM14.99 17.12c-.07.22-.2.63-.57 1.13-.16.21-.33.4-.53.55-.62.47-1.43.49-2.1 0-.26-.19-.47-.44-.6-.73-.11-.25-.16-.52-.15-.79.02-.58.3-1.02.51-1.3.29-.39.55-.6.79-.8l.57.42-.04.06c-.23-.05-.55-.12-.99.48-.61.82-.35 1.59.26 2.03.68.5 1.54.45 2.08-.29.15-.19.29-.48.29-.73 0-.2-.08-.31-.13-.38l.05-.06.56.41zM14.26 13.06l.24-.23 2.89 1.25c.36.15.46.19.68.08l.05.05-.94.89-.05-.05c.07-.1.12-.22.02-.32-.04-.04-.12-.08-.25-.14l-.55-.25-.92.87.21.57c.04.11.08.2.13.25.1.11.24.04.32-.01l.04.05-.72.68-.04-.05c.13-.16.08-.32-.01-.58l-1.1-3.06zm1.05 1.8.7-.66-1.13-.5.43 1.16zM16.5 11.61c-.08.06-.18.13-.2.26-.01.08.02.14.05.21l-.06.05-.39-.54 2.42-1.74.39.53-.06.04c-.19-.2-.31-.14-.51.01l-.53.38 1.45 1.98c.25.35.3.38.59.28l.04.05-1.06.77-.04-.05c.21-.24.12-.36-.08-.65l-1.45-1.98-.56.4zM19.78 9.6c-.11-.23-.19-.38-.48-.29l-.03-.06 1.16-.57.03.06c-.25.17-.18.32-.06.57l.4.8 1.5-.73-.4-.82c-.13-.25-.18-.38-.48-.28l-.03-.06 1.16-.56.03.06c-.21.15-.19.28-.03.6l1 2.01c.17.35.22.44.51.37l.03.06-1.15.56-.03-.06c.25-.18.18-.3.05-.58l-.48-.95-1.5.73.48.96c.12.25.19.39.5.31l.03.06-1.17.57-.03-.06c.25-.18.18-.32.05-.58L19.78 9.6zM27.95 7.87c.06.22.08.44.07.66-.03.24-.1.48-.22.68-.33.57-.86.79-1.26.89-1.19.31-2.04-.31-2.28-1.25-.31-1.14.43-2.02 1.44-2.29 1.08-.28 1.98.31 2.25 1.31zm-.69 1.23c.14-.32.11-.68.02-1.02-.2-.77-.78-1.34-1.57-1.13-.67.18-1.02.83-.8 1.65.18.68.78 1.34 1.59 1.13.39-.09.63-.35.76-.63zM29.08 6.52c-.03-.27-.05-.43-.36-.46L28.71 6l1.31-.13.01.07c-.26.07-.28.21-.26.52l.2 2.08c.01.14.03.24.07.3.08.12.2.11.4.09l.7-.07c.29-.03.4-.09.43-.35l.07-.01.07.67-2.67.26v-.07c.1-.04.17-.07.22-.15.06-.09.06-.18.03-.47l-.21-2.22zM33.68 5.76v.07c-.27.04-.31.16-.31.47l-.04 2.33c0 .36.01.42.3.52v.07l-1.31-.02v-.07c.31-.08.31-.19.32-.51l.04-2.33c0-.24 0-.43-.3-.48v-.07l1.3.02zM37.55 9.57c-.23.04-.66.11-1.27.02-.26-.04-.5-.1-.73-.21a1.692 1.692 0 0 1-.98-1.85c.05-.31.17-.62.37-.86.16-.21.38-.38.63-.5.52-.24 1.05-.21 1.38-.16.49.07.79.2 1.08.33l-.12.69-.07-.01c-.06-.22-.15-.54-.88-.65-1.01-.15-1.57.43-1.68 1.17-.13.83.32 1.56 1.22 1.7.25.04.57.03.79-.08.18-.1.24-.22.28-.29l.07.01-.09.69zM41.95 7.99c.13-.27.14-.39-.08-.54l.03-.06 1.17.53-.03.06c-.25-.05-.33 0-.47.29l-.64 1.39c-.09.2-.14.31-.17.43-.08.38.09.77.54.98.36.16.64.11.8.02.26-.13.4-.42.48-.6l.67-1.46c.12-.27.15-.37-.07-.54l.03-.06.89.4-.03.07c-.29-.06-.35.05-.45.27l-.67 1.45c-.15.32-.34.72-.82.86-.43.13-.86-.03-1.1-.14-.39-.17-.68-.42-.82-.71-.25-.49-.06-.91.07-1.2l.67-1.44zM46.29 10.09c.05-.08.1-.14.11-.21.03-.15-.07-.24-.12-.29l.04-.06.8.56.29 3.14 1.1-1.53c.16-.23.2-.34.01-.54l.05-.06.8.56-.04.06c-.23-.1-.33-.04-.49.18l-1.74 2.44-.24-.17-.35-3.7-1.33 1.87c-.2.27-.15.37-.01.52l-.04.06-.8-.56.04-.06c.06.03.13.07.22.05.1-.02.17-.09.27-.23l1.43-2.03zM51.22 13.44l-.05.05c-.23-.15-.33-.09-.55.13L49 15.3c-.25.26-.28.32-.13.58l-.05.05-.94-.89.05-.05c.28.15.36.07.58-.16l1.62-1.69c.17-.17.29-.32.1-.55l.05-.05.94.9zM51.74 14.91c.24-.44.28-.52.19-.73l.05-.05.8 1-.06.04c-.03-.03-.06-.06-.1-.07-.05-.02-.15-.03-.22.04-.07.06-.13.15-.19.26l-1.02 1.88 2.08-.57c.14-.04.23-.07.29-.12.11-.09.11-.21.05-.32l.05-.04.61.76-.05.04c-.17-.15-.27-.12-.75.01l-2.99.8-.19-.24 1.45-2.69zM53.05 20.07c-.36.2-.37.28-.17.63l.3.52c.14.25.19.31.49.24l.04.07-.59.33-1.26-2.22.06-.04c.18.22.33.15.59 0l2.11-1.18c.2-.12.32-.21.2-.45l.06-.03L56 19.9l-.58.33-.04-.07c.21-.19.18-.29.07-.47l-.41-.72-.94.53.32.56c.15.26.27.31.49.23l.04.07-.85.48-.04-.06c.22-.2.16-.31.01-.58l-.29-.52-.73.39zM56.31 21.79c.25-.09.39-.15.33-.44l.07-.02.51 1.38c.12.31.19.52.15.78-.04.27-.23.54-.56.66-.21.08-.45.08-.67-.01-.15-.06-.24-.15-.3-.21l-.91 1.03c-.27.3-.31.38-.31.58l-.07.02-.14-.38c-.14-.38-.02-.61.22-.89l.8-.92-.1-.23c-.02-.05-.05-.13-.07-.22l-.97.36c-.34.13-.37.21-.35.47l-.07.02-.46-1.23.07-.02c.16.25.3.21.5.13l2.33-.86zm-.69.99.1.27c.03.08.07.16.12.24.2.31.5.29.67.22.26-.09.33-.27.36-.36.05-.18-.01-.33-.06-.47l-.11-.31-1.08.41zM56.51 26.66c.12-.4.29-.75.77-.85.14-.03.33-.03.5.02.39.13.61.5.7.94.08.39.04.66.01.85l-.69.14-.01-.07c.16-.1.45-.29.34-.77-.07-.33-.32-.55-.63-.48-.3.06-.37.3-.48.69l-.06.18c-.08.29-.23.79-.81.91-.32.06-.62-.02-.86-.2-.32-.26-.42-.65-.46-.84-.02-.13-.04-.25-.04-.38-.02-.28.01-.43.04-.56l.69-.14.01.07c-.09.06-.22.14-.29.29-.07.14-.1.34-.05.55.09.43.42.62.74.56.33-.07.42-.34.52-.69l.06-.22zM58.87 30.36l-.07.01c-.07-.26-.19-.29-.5-.26l-2.34.2c-.36.03-.43.05-.49.35l-.07.01-.11-1.29.07-.01c.11.3.22.29.54.26l2.34-.2c.24-.02.43-.05.45-.35l.07-.01.11 1.29zM58.56 31.77c0-.1 0-.22-.08-.31-.06-.06-.12-.07-.2-.09v-.08l.67.02-.09 2.97-.67-.02v-.07c.27-.03.3-.16.31-.41l.02-.65-2.46-.08c-.43-.01-.48 0-.59.29h-.07l.04-1.31h.07c.07.31.22.32.56.33l2.46.08.03-.67zM58.31 35.53c.26-.1.31-.13.38-.28l.07.01-.25 1.29-.07-.01c0-.04.02-.22-.16-.25-.09-.02-.19.02-.26.05l-1.19.45.94.84c.09.07.14.12.21.13.15.03.22-.13.25-.19l.07.01-.19.99-.06-.01c0-.18-.04-.22-.21-.38l-1.42-1.3-.97-.19c-.24-.05-.37-.05-.48.22l-.07-.01.25-1.26.07.01c-.02.29.13.34.37.38l.97.19 1.75-.69z\" /><g><path d=\"M17 50.39c-.29.53-.28 1.28.3 2.22l-.04.03c-.25-.15-.49-.13-.73.08-.32-.87-.03-1.66.33-2.23-.69.51-1.44.66-2.77.01l.02-.06c1.16.32 1.82.05 2.42-.48l-.98-.88.06-.1 1 .91c.24-.22.48-.48.73-.76l-.82-.75.05-.1.85.77.48.44.37.34.5-.08s.08.43.12.71c-.04.03-.09.01-.13-.03l-.94-.85c-.27.28-.5.53-.75.75l.59.53.51-.08s.08.44.12.72c-.04.02-.09.01-.13-.03L17 50.39zM22.12 55.4s.19.42.3.69c-.03.03-.08.03-.14 0l-3.2-1.74.02-.11 1.37.75.59-1.07-.96-.52.03-.11.98.53.49-.89-1.11-.6.03-.11 2.17 1.18.48-.2s.19.4.29.67c-.03.04-.08.03-.13 0l-1.15-.63-.49.89.37.2.45-.2s.18.39.28.65c-.03.03-.08.03-.13 0l-1.03-.56-.59 1.07.59.32.49-.21zm-.31-3.61c1.35.73.45 1.59.07 1 .06-.31 0-.71-.11-.99l.04-.01zM28.86 55.46c-.22.57-.5 1.07-.91 1.44.16.29.38.55.66.78l-.02.03a.614.614 0 0 0-.6.34c-.21-.25-.34-.55-.41-.88-.41.24-.92.38-1.57.4l-.02-.04c.67-.16 1.15-.46 1.51-.86-.01-.29 0-.61.04-.94-.18.16-.39.3-.6.4l-.04-.04c.06-.07.11-.14.17-.22h-.12c-.15.04-.32.08-.49.11l.14.05c-.02.06-.07.07-.15.06l-.03.13.74.09-.01.05c-.21.04-.47.08-.8.11l-.14.54c-.09.35-.22.52-.79.42.03-.17.03-.29 0-.38-.05-.09-.11-.16-.29-.25l.01-.05s.4.13.48.15c.05.01.07 0 .09-.04l.08-.32c-.16.01-.33.03-.51.05-.04.04-.09.07-.14.07l-.08-.61c.17.03.46.07.82.12l.09-.34.25.09c.07-.07.15-.16.21-.23l-.34-.08c-.32.15-.67.27-1.05.34l-.02-.05c.25-.1.5-.23.72-.38l-.34-.09-.01-.12.47.12c.15-.1.28-.21.42-.32l-.94-.24-.01-.12.58.15.13-.51-.41-.1-.01-.11.44.11.14-.53.65.22c-.02.06-.06.08-.17.08l-.09.34.24-.2s.07.1.15.21c.1-.12.19-.24.27-.35l.51.43c-.04.04-.08.05-.17.01-.2.21-.45.44-.73.64l.12.03.26-.21s.12.16.21.3c.18-.33.34-.7.46-1.07l.69.36c-.03.05-.08.07-.18.05-.11.2-.23.39-.34.55l.32.08.36-.29s.25.32.38.53c-.02.04-.07.05-.12.03l-.16-.04zm-1.77.38c.09-.14.19-.29.29-.46l-.64-.16c-.15.1-.32.21-.5.3l.23.06.31-.19.31.45zm-.53-1.32-.11.43c.13-.12.25-.24.36-.36l-.25-.07zm1.44.73c-.11.14-.23.28-.35.39 0 .26.03.51.09.74.22-.31.38-.68.5-1.07l-.24-.06zM33.93 55.62v.33h.15l.22-.24.46.35c-.02.03-.07.06-.14.07l-.01 1.84c0 .35-.06.52-.53.56 0-.16 0-.28-.02-.36-.02-.07-.06-.12-.15-.15v.3c0 .06-.21.17-.4.17h-.09l.01-1.09h-.18v.96c0 .05-.19.16-.4.16h-.08l.01-.83h-.67v.71c0 .03-.16.13-.42.13h-.09v-.84l-.64-.01-.03-.11h.67v-.48h-.1v.08c0 .04-.2.14-.4.14h-.07l.01-1.71.48.19h.07l.01-.37h-.64l-.03-.11.67.01v-.57l.64.06c-.01.05-.04.09-.13.1l-.01.41h.01l.26-.33s.29.23.46.39c-.01.04-.06.06-.11.06l-.62-.01v.37h.06l.21-.21.4.3v-.15l.49.21h.15v-.34h-.69l-.03-.11h.72v-.71l.65.07c-.02.06-.04.11-.16.12v.53h.15l.21-.27a.846.846 0 0 0-.16-.36l.03-.02c.71.03.65.42.41.51.08.07.16.13.22.19-.01.04-.05.06-.11.06h-.72zm-2.42 1.36h.12v-.47h-.13l.01.47zm0-1.07v.49h.13v-.49h-.13zm.71.6h-.14v.47h.13l.01-.47zm-.13-.6v.49h.13v-.49h-.13zm.36 1.34s.17.14.32.27l.01-1.61c-.03.02-.06.04-.12.06l-.01 1.12c-.01.04-.22.14-.37.13h-.07v-.13h-.1l-.01.49h.09l.26-.33zm.98.04v-.58h-.18v.58h.18zm-.17-1.23v.54h.18v-.54h-.18zm.66 1.91c.02 0 .11 0 .14.01.05 0 .05-.02.05-.06v-.51h-.19v.56zm0-.67h.19l.01-.58h-.2v.58zm.01-1.24v.54h.19v-.54h-.19zM37.82 55.56c0 .03-.03.07-.1.1l.53 2.26c0 .05-.2.22-.42.27l-.11.02-.47-1.98c-.11.18-.24.34-.39.49l-.05-.02c.22-.57.36-1.43.33-2.23l.84.06c0 .05-.05.1-.14.12-.05.33-.12.62-.23.9l.21.01zm.08-.41 1.39-.33.21-.47s.4.2.65.33c0 .05-.05.08-.11.09l-2.08.49-.06-.11zm2.31 1.5s.41.2.66.34c0 .05-.04.08-.11.09l-2.45.57-.06-.11 1.75-.4.21-.49zM44.13 53.38c.47.58 1.23.96 2.37.8l.02.05c-.23.19-.3.44-.18.76-1-.08-1.71-.8-2.18-1.45.34.91.37 1.81-.7 2.99l-.05-.03c.63-1.13.51-1.96.14-2.8l-1.22.65-.08-.08 1.26-.68c-.16-.35-.35-.69-.55-1.07l.74-.31c.02.06 0 .11-.07.17.16.31.32.61.45.91l.68-.36.09-.52s.46.07.75.13c.01.04-.02.09-.08.11l-1.39.73zM47.88 51.26c.2.15.28.34.18.53-.17.34-.65.14-.49-.26.05-.12.03-.29-.12-.44l.03-.03c.11.04.22.08.31.14l.01-.01-.94-.97.34-.22c.02-.15.03-.31.03-.39l.43-.04c.07-.07.15-.13.21-.17-.02-.1-.04-.2-.07-.28l.46-.12c.01.04-.02.07-.07.11v.19c.24-.01.31.22.12.32a.897.897 0 0 0-.18-.02c-.04.14-.09.28-.15.4.01.03 0 .07-.04.1l-.26.24.21.23.01-.01-.02-.26s.23-.01.39 0c.02.04.01.08-.03.11l-.26.24.2.21 1.16-1.05-.19-.22-.19.17-.11-.06.23-.21-.2-.24-.19.18-.1-.06.23-.2-.21-.24-.24.22-.1-.06.24-.22-.02-.31.6-.07c0 .05-.01.08-.06.14l.62.73.01-.23.66.02c0 .04-.02.08-.08.14-.07.18-.2.47-.3.65h-.04c-.04-.09-.12-.23-.18-.34l-1.84 1.66zm-.3-1.26s.17-.01.31-.01c.01-.12.02-.25.01-.38-.07.01-.13.01-.2.03-.01.01-.03.02-.05.03-.06.09-.17.24-.28.38l.21.22.02-.01-.02-.26zm1.19-.52c.01.04-.02.08-.08.11.01.07.01.14 0 .21.26 0 .33.27.11.36a.802.802 0 0 0-.18-.04c-.05.17-.13.34-.23.49l-.07-.02c.04-.15.07-.31.07-.48-.11 0-.21.01-.29.02v-.05c.1-.09.19-.15.28-.2-.01-.1-.04-.19-.06-.28l.45-.12zm1.45.54s.41-.02.67-.02c.02.04 0 .08-.04.12l-1.02.92.24.26c.26.28.33.49-.09.95-.14-.13-.23-.2-.35-.23-.11-.01-.21 0-.4.12l-.03-.04s.36-.29.43-.35c.04-.03.04-.06.01-.09l-.22-.24-1.1 1-.1-.06 1.13-1.02-.25-.24.32-.24c0-.12 0-.24-.01-.35l-.99.9-.1-.06 1.05-.95.03-.41.66-.01c0 .05-.02.08-.08.15-.09.16-.2.36-.32.56.03.05.02.1-.03.16l.12.13.53-.48-.06-.48z\" /></g><path d=\"m12.62 45.51-.38-.83.01-.02.45-.76-.91.11-.62-.69-.17.9-.85.37.82.44.08.91.67-.62zM53.32 44.4l.32-.85-.01-.02-.52-.73.93.04.55-.73.24.88.87.3-.76.5-.02.92-.72-.57z\" /><g><path d=\"M32.58 53.49c-11.95 0-21.68-9.66-21.68-21.54 0-11.88 9.73-21.54 21.68-21.54s21.68 9.66 21.68 21.54c-.01 11.87-9.73 21.54-21.68 21.54zm0-42.62c-11.69 0-21.2 9.45-21.2 21.07 0 11.62 9.51 21.07 21.2 21.07s21.2-9.45 21.2-21.07c0-11.62-9.51-21.07-21.2-21.07z\" /></g><g><path d=\"M29.01 28.18h-.28v.31H28v.6h.74v.4H28v3.25h.74v.4H28v.6h.74v.43h.28v-.43h.73v-.6h-.73v-.4h.73v-3.25h-.73v-.4h.73v-.6h-.73v-.31zm-.28 3.23v.72h-.46v-.72h.46zm0-1.33v.72h-.46v-.72h.46zm.73 1.33v.72h-.45v-.72h.45zm-.45-.6v-.72h.45v.72h-.45zM31.06 29.48v-.4h.73v-.91h-.27v.31h-.45v-.31h-.28v.31h-.72v.6h.72v.4h-.72v4.66h.28v-1.41h.45v1.43h.28v-1.43h.45v1.41h.27v-4.66h-.74zm-.27 1.93v.72h-.45v-.72h.45zm0-1.33v.72h-.45v-.72h.45zm.73 1.33v.72h-.45v-.72h.45zm0-1.33v.72h-.45v-.72h.45zM31.59 24.45l-.63-.09-.28-.56-.27.56-.63.09.45.44v.01l-.1.6.55-.29.56.29-.1-.61zM28.61 26.3l-.62-.09-.01-.01-.27-.55-.28.56-.62.09.45.44-.01.01-.1.61.56-.29.56.29-.11-.62zM26.4 29.79l.44-.42-.63-.1-.28-.56-.27.56-.63.1.45.43-.1.62.55-.29.02.01.54.28-.1-.62zM26.92 32.91l-.62-.09-.28-.56-.28.56-.62.09.45.44v.01l-.11.6.56-.29.01.01.55.28-.11-.61zM28.34 36.31l.44-.43-.62-.09-.01-.01-.27-.55-.28.56h-.01l-.61.09.45.44-.11.62.56-.3.56.3-.11-.62zM31.8 37.64l-.62-.09-.28-.56-.28.56-.01.01-.61.08.45.44v.02l-.11.6.56-.29.56.29-.11-.62z\" /><path d=\"M39.65 21.42c-.16 0-.31.01-.46.03-.34.04-.69.07-1.05.07-1.34 0-2.61-.33-3.71-.92-.17-.09-.33-.18-.49-.28-.08-.05-.16-.1-.23-.15l-.2-.14c-.26-.18-.58-.29-.92-.29-.34 0-.66.11-.92.29 0 0-.14.09-.2.14-.08.05-.16.1-.23.15-.16.1-.33.19-.49.28-1.11.59-2.37.92-3.72.92-.35 0-.71-.02-1.05-.07-.15-.02-.3-.03-.46-.03-1.79 0-3.24 1.44-3.24 3.22v6.62c0 .12-.01.25-.01.38 0 5.95 4.25 10.91 9.9 12.05a2.728 2.728 0 0 0 .8 0c5.63-1.13 9.88-6.05 9.92-11.97v-7.08c0-1.78-1.45-3.22-3.24-3.22zm-7.08 21.61c-.13 0-.25-.01-.37-.03-5.33-1.07-9.35-5.75-9.35-11.37l-.05-6.77c.06-1.62 1.16-2.88 2.81-2.88.15 0 .42.01.56.03.33.04.68.09 1.02.09 1.27 0 2.59-.28 3.64-.84.16-.08.31-.17.46-.27.07-.05.15-.1.22-.14l.19-.13c.25-.17.55-.31.88-.31l-.01 22.62zm6.56-14.73.32.64.72.1-.52.5.12.71-.64-.33-.64.33.12-.71-.52-.5.72-.1.32-.64zm-2.1-2.26.32-.65.32.65.71.1-.52.5.12.71-.64-.34-.64.34.12-.71-.52-.5.73-.1zm-2.15 3.2v-.8h2.53v.8h-2.53zm2.53 3.96v.8h-2.53v-.8h2.53zm-3.49-8.9.32-.64.32.64.72.1-.52.5.12.71-.64-.34-.64.34.12-.71-.52-.5.72-.1zm-.74 6.22v-.8h.05s.23 0 .45-.1c.25-.11.38-.31.38-.6v-.92h.51v1.21c.01.11.01.49-.27.81v4.07h-.51v-3.74c-.16.05-.35.08-.56.08h-.05zm2 8.21-.64-.34-.64.34.12-.71-.52-.5.71-.1.32-.65.32.65.72.1-.52.5.13.71zm2.99-1.85-.64-.33-.64.33.12-.71-.52-.5.71-.11.32-.65.32.65.72.11-.52.5.13.71zm1.68-3.09-.64-.33-.64.33.12-.71-.52-.5.71-.1.32-.65.32.65.71.1-.52.5.14.71z\" /><g><path style=\"fill-rule:evenodd;clip-rule:evenodd\" d=\"M23.18 17.81c.03.01.07.01.1.01.93-.15 2.37-1.1 2.95-1.84.01-.01.02-.03.02-.05.02-.07-.02-.13-.09-.15-1.27 0-2.77.78-3.2 1.59-.01.02-.02.04-.02.06-.04.17.07.34.24.38zM17.46 23.3c.04 0 .08-.01.11-.02h.01a.36.36 0 0 0 .1-.07c.86-1.13 1.14-2.47 1.22-3.82-.01-.07-.06-.12-.12-.12h-.02c-.03 0-.05.02-.07.04-.16.17-.35.37-.49.54-.66.81-1.11 1.71-1.11 2.77 0 .15.02.3.05.45.04.13.17.23.32.23zM15.05 31.88c.06.04.12.06.18.06.04 0 .08-.01.12-.02h.01c.06-.02.11-.06.15-.11.03-.04.06-.1.06-.16.15-1.21-.48-3.64-1.16-4.32a.149.149 0 0 0-.09-.04h-.02c-.03 0-.05.02-.07.04-.01.01-.02.03-.02.04-.31 1.27-.31 2.52.25 3.74.13.31.33.56.59.77zM21.29 21.65c.01-.01.01-.03.01-.04v-.01a.13.13 0 0 0-.11-.13c-1.34-.02-2.81 1.04-3.16 2.01-.01.03-.01.06-.01.1 0 .03 0 .06.01.09.04.14.17.25.33.25.02 0 .05 0 .07-.01.96-.26 2.39-1.36 2.86-2.26zM19.88 19.7c.03.01.07.02.11.01H20c.04 0 .07-.01.11-.03 1.11-.77 1.75-1.9 2.22-3.09a.123.123 0 0 0-.08-.14h-.02c-.03 0-.05 0-.07.01-.2.11-.42.23-.6.34-.84.54-1.5 1.22-1.81 2.18-.04.13-.07.27-.08.42-.01.13.07.26.21.3zM23.75 18.68c.01-.01.01-.02.01-.04v-.01c.01-.06-.03-.11-.09-.13-1.26-.14-2.74.74-3.16 1.62-.01.03-.02.06-.02.09v.08c.02.14.14.25.29.26h.07c.94-.15 2.38-1.06 2.9-1.87zM16.82 27.95c.04 0 .07-.01.1-.02.97-.45 2.01-1.92 2.4-2.95 0-.01.01-.02.01-.03v-.04a.144.144 0 0 0-.11-.09c-1.09.03-2.55 1.57-2.74 2.78v.04c0 .03.01.06.02.08.01.03.02.05.03.07.05.1.16.16.29.16zM15.47 27.28c.07.09.17.15.29.14.04 0 .08-.01.11-.02h.01c.06-.03.11-.07.14-.12.01-.01.01-.02.02-.03.48-1.01.61-3.03.22-4.17-.02-.06-.07-.1-.13-.09h-.02c-.03.01-.05.02-.07.04 0 0-.01.01-.01.02-.13.22-.24.41-.34.61-.46.96-.7 1.96-.46 3.02.05.21.13.42.24.6zM16.09 31.81c.02.06.05.12.1.16a.33.33 0 0 0 .33.06s.01 0 .01-.01c.03-.01.06-.03.09-.05.87-.7 1.55-2.55 1.64-3.52 0-.03-.01-.07-.04-.09a.149.149 0 0 0-.09-.04c-1.21.36-2.27 2.24-2.04 3.49zM15.28 36.1c.11.11.24.2.38.28.05.02.1.04.16.04.05 0 .09-.01.13-.02.06-.02.11-.06.15-.11.02-.02.04-.05.05-.07.02-.03.03-.05.03-.08.01-.03.01-.06.01-.1-.13-1.3-1.25-3.22-2.07-4-.02-.02-.05-.03-.08-.04h-.06c-.04.01-.08.04-.1.08-.01.01-.01.02-.01.04-.04 1.08.17 2.09.65 3.03.2.34.48.66.76.95zM23.89 46.54c.05-.02.1-.06.14-.1.02-.03.04-.05.06-.08a.425.425 0 0 0-.07-.5c-.02-.02-.04-.03-.06-.05-1.16-.8-3.34-1.26-4.56-1.14a.21.21 0 0 0-.11.08c-.01.02-.02.04-.02.06-.01.02-.01.04-.01.06 0 .02.01.04.01.05 0 .01.01.02.01.03.01.01.01.02.02.02.68.66 1.48 1.14 2.37 1.47.58.21 1.17.32 1.79.22.16-.03.3-.07.43-.12zM17.61 40.44c.04 0 .08-.01.11-.02.06-.02.11-.06.16-.1a.18.18 0 0 0 .05-.07c.01-.03.03-.05.04-.09.01-.03.01-.07.01-.1v-.04c0-.03-.02-.06-.03-.09-.72-1.43-1.89-2.37-3.22-3.17-.02-.01-.03-.01-.05-.02h-.03c-.01 0-.02 0-.03.01-.04.01-.08.04-.1.08-.01.01-.01.02-.02.04v.05c.36 1.29 1.02 2.39 2.15 3.18.29.19.6.3.96.34zM16.85 36.18c.02.03.05.05.07.07.02.01.03.02.04.02.05.03.12.05.19.05.04 0 .09-.01.13-.02.06-.02.11-.06.16-.11h.01c.66-.88.87-2.8.71-3.94 0-.02-.01-.05-.02-.07l-.03-.03a.127.127 0 0 0-.09-.04h-.06c-.02 0-.03.01-.04.02-1.24 1.04-1.55 2.97-1.11 3.98.01.03.02.05.04.07zM20.17 43.69c.02 0 .04-.01.06-.01a.419.419 0 0 0 .21-.18c.01-.03.03-.05.03-.09.01-.03.01-.07.01-.1v-.04a.495.495 0 0 0-.04-.13c-.01-.02-.03-.04-.04-.06-.9-.99-2.95-2.07-4.08-2.14h-.02c-.01 0-.02 0-.02.01-.04.01-.08.04-.1.08 0 .01-.01.02-.01.04v.05c0 .01 0 .02.01.03 0 .01.01.02.01.03.61 1.11 2.27 2.51 3.59 2.54.13 0 .26-.01.39-.03zM18.54 40.06c.01.02.02.04.04.06.02.03.05.05.08.07.01.01.03.02.04.02.04.02.08.03.13.04h.06c.04 0 .09-.01.13-.02.06-.02.11-.06.15-.1.02-.02.04-.05.05-.07 0-.01.01-.02.01-.02.08-.21.15-.42.19-.64.16-.86.05-1.72-.12-2.56-.04-.2-.09-.39-.15-.62 0-.02-.01-.03-.02-.04l-.03-.03c-.01-.01-.02-.01-.02-.02-.02-.01-.04-.02-.06-.02h-.05c-.03.01-.06.03-.08.05-.01.01-.02.02-.02.03-.65.9-.9 1.89-.67 2.97.04.31.18.61.34.9zM21.27 43.32c.01.01.02.01.02.02.04.02.08.03.13.04h.1c.03 0 .06-.01.09-.02.06-.02.11-.06.15-.11.02-.02.04-.05.05-.07.01-.02.02-.04.03-.07.22-1.05-.35-2.81-1.01-3.84-.01-.01-.01-.02-.02-.02-.01-.01-.02-.01-.02-.02-.02-.01-.04-.02-.06-.02h-.06a.16.16 0 0 0-.09.07c-.65 1.16-.42 3.08.69 4.04zM24.53 45.67c.06.03.12.05.19.05h.03c.04 0 .08-.01.12-.02.07-.02.13-.06.17-.12.02-.02.04-.05.06-.08.03-.06.05-.13.05-.21-.13-1.4-.96-2.47-1.83-3.54a.317.317 0 0 0-.06-.05.145.145 0 0 0-.07-.02h-.04c-.01 0-.02 0-.03.01-.05.01-.08.04-.11.08 0 0-.01.02-.01.04-.39 1.26.44 3.22 1.53 3.86zM28.06 47.57a.467.467 0 0 0-.1-.05c-1.32-.45-3.53-.32-4.67.11-.03.01-.06.03-.08.06-.01.02-.02.04-.02.06v.06c0 .02.01.04.01.05 0 .01.01.02.01.03l.03.03c.01.01.02.02.03.02.84.45 1.73.71 2.68.78.62.05 1.22 0 1.78-.27.13-.06.25-.13.37-.21.02-.01.03-.02.04-.04.02-.03.04-.05.06-.08.03-.06.05-.13.05-.21 0-.12-.05-.22-.12-.29-.03-.02-.05-.03-.07-.05z\" /><path style=\"fill-rule:evenodd;clip-rule:evenodd\" d=\"M36.6 47.36c1.32-.11 2.77-2.23 2.55-3.7v-.01c-.01-.02-.01-.04-.02-.06a.226.226 0 0 0-.11-.08h-.07c-.02 0-.04.01-.06.02-.01.01-.02.01-.03.02-1.11.99-2.16 1.97-2.44 3.49-.84.22-2.34.63-3.84 1.16-1.49-.54-3-.95-3.84-1.16-.28-1.52-1.33-2.5-2.44-3.49-.01-.01-.02-.02-.03-.02-.02-.01-.04-.02-.06-.02h-.07c-.05.01-.08.04-.11.08-.01.02-.02.04-.02.06v.01c-.21 1.47 1.24 3.58 2.56 3.7.91.19 2.13.6 3.33 1.11-1.3.51-2.51 1.1-3.15 1.73l.47.55c.59-.58 1.91-1.33 3.36-1.98 1.45.66 2.77 1.4 3.36 1.98l.47-.55c-.63-.63-1.84-1.22-3.15-1.73 1.21-.51 2.43-.92 3.34-1.11zM38.95 15.98c.58.74 2.03 1.69 2.95 1.84.03 0 .07 0 .1-.01.17-.04.28-.21.24-.38-.01-.02-.02-.04-.02-.06-.43-.81-1.93-1.59-3.2-1.59-.07.02-.11.08-.09.15 0 .02.01.03.02.05zM47.6 23.28h.01c.03.01.07.02.11.02.15 0 .27-.1.32-.23.04-.15.05-.3.05-.45 0-1.07-.44-1.97-1.11-2.77-.14-.17-.32-.36-.49-.54a.161.161 0 0 0-.07-.04h-.02c-.07 0-.12.05-.13.12.09 1.34.36 2.69 1.22 3.82.04.03.07.05.11.07zM49.61 31.65c.01.06.03.11.06.16.04.05.09.09.15.11h.01c.04.01.07.02.12.02.07 0 .13-.02.18-.06.26-.2.46-.46.6-.77.56-1.22.56-2.47.25-3.74-.01-.01-.01-.03-.02-.04-.02-.02-.05-.03-.07-.04h-.02c-.03 0-.07.01-.09.04-.69.67-1.32 3.1-1.17 4.32zM46.82 23.91c.16 0 .29-.11.33-.25.01-.03.01-.06.01-.09s-.01-.06-.02-.1c-.36-.97-1.82-2.03-3.16-2.01a.13.13 0 0 0-.11.13v.01c0 .01.01.03.01.04.47.9 1.9 2 2.86 2.25.03.02.06.02.08.02zM45.08 19.69c.03.02.07.03.11.03h.01c.03 0 .07-.01.11-.01a.3.3 0 0 0 .21-.3 1.95 1.95 0 0 0-.08-.42c-.31-.96-.98-1.64-1.81-2.18-.17-.11-.4-.23-.6-.34-.02-.01-.05-.02-.07-.01h-.02c-.06.02-.09.08-.08.14.47 1.18 1.11 2.32 2.22 3.09zM44.39 20.56c.15-.01.26-.12.29-.26 0-.03.01-.05 0-.08 0-.03-.01-.06-.02-.09-.42-.88-1.9-1.76-3.16-1.62-.06.02-.1.07-.09.13v.01c0 .01.01.02.01.04.53.81 1.97 1.72 2.89 1.88.03-.01.05-.01.08-.01zM45.86 24.9v.04c0 .01 0 .02.01.03.39 1.04 1.43 2.51 2.4 2.95.03.01.07.02.11.02.13 0 .24-.06.3-.16.01-.02.02-.05.03-.07.01-.03.01-.05.02-.08v-.04c-.18-1.2-1.65-2.75-2.74-2.78-.07.01-.12.04-.13.09zM49.15 27.28c.04.05.08.09.14.12h.01c.04.02.07.02.11.02.12.01.22-.05.29-.14.11-.19.19-.39.24-.61.24-1.06 0-2.06-.46-3.02-.1-.2-.21-.39-.34-.61-.01-.01-.01-.01-.01-.02-.02-.02-.05-.04-.07-.04h-.02c-.06 0-.11.04-.13.09-.39 1.14-.26 3.16.22 4.17.01.02.01.03.02.04zM48.66 32.02c.03.01.07.02.11.02.08 0 .16-.03.22-.08.05-.04.09-.09.1-.16.23-1.25-.83-3.13-2.03-3.49-.04 0-.07.01-.09.04-.02.02-.03.05-.04.09.08.98.77 2.82 1.63 3.52.03.02.06.04.09.05 0 .01 0 .01.01.01zM51.16 31.99h-.03c-.03 0-.06.02-.08.04-.82.78-1.94 2.7-2.07 4 0 .03 0 .07.01.1s.02.06.03.08c.01.03.03.05.05.07.04.05.1.08.16.11.04.01.08.02.13.02.06 0 .11-.01.16-.04.14-.07.27-.16.37-.28.28-.29.56-.61.75-.97.49-.94.69-1.94.65-3.03 0-.01-.01-.03-.02-.04a.159.159 0 0 0-.1-.08c0 .02-.01.02-.01.02zM45.88 44.75c-.02-.04-.06-.06-.11-.08-1.22-.12-3.4.35-4.56 1.14a.12.12 0 0 0-.05.05c-.07.08-.12.18-.12.29 0 .08.02.15.05.21.02.03.04.06.06.08.04.04.09.07.14.1.13.05.27.08.42.11.61.1 1.21-.01 1.79-.22.9-.32 1.69-.81 2.37-1.47.01-.01.01-.02.02-.02.01-.01.01-.02.01-.03.01-.02.01-.03.01-.05v-.06c-.01-.02-.02-.04-.03-.05zM50.67 36.86c0-.01-.01-.02-.01-.04a.159.159 0 0 0-.1-.08c-.01 0-.02-.01-.03-.01h-.03c-.02 0-.03.01-.05.02-1.33.81-2.51 1.74-3.22 3.17-.01.03-.02.06-.02.09v.04c0 .04 0 .07.01.1l.03.09c.01.03.03.05.05.07.04.05.1.08.16.1.04.01.07.02.11.02.36-.04.67-.15.96-.35 1.13-.79 1.79-1.89 2.15-3.18v-.03s-.01 0-.01-.01zM47.74 36.19c.04.05.1.08.16.11.04.01.08.02.13.02.07 0 .13-.02.19-.05.01-.01.03-.02.04-.02a.5.5 0 0 0 .08-.07c.02-.02.03-.04.04-.06.44-1.01.13-2.94-1.11-3.98a.076.076 0 0 0-.04-.02h-.06c-.03 0-.07.02-.09.04l-.03.03c-.01.02-.02.04-.02.07-.16 1.12.05 3.04.71 3.93zM49.01 41.06c0-.01-.01-.03-.02-.04a.159.159 0 0 0-.1-.08c-.01 0-.02 0-.02-.01h-.02c-1.13.07-3.19 1.15-4.09 2.14-.01.02-.03.04-.04.06-.02.04-.03.08-.04.13v.04c0 .04.01.07.01.1.01.03.02.06.04.09.01.03.03.05.05.07.04.05.1.08.16.11.02.01.04.01.06.01.14.02.27.03.4.02 1.31-.03 2.98-1.43 3.59-2.54 0-.01.01-.02.01-.03 0-.01 0-.02.01-.03v-.04zM45.96 40.03c0 .01.01.02.01.02.01.03.03.05.05.07.04.05.09.08.15.1.04.02.08.02.13.02h.06c.05-.01.09-.02.13-.04.01-.01.03-.02.04-.02a.5.5 0 0 0 .08-.07c.01-.02.03-.04.04-.06.16-.29.3-.59.37-.9.23-1.08-.03-2.07-.67-2.97l-.03-.03a.218.218 0 0 0-.08-.05h-.06c-.02 0-.04.01-.06.02-.01 0-.02.01-.02.02l-.03.03c-.01.01-.01.03-.02.04a9.2 9.2 0 0 0-.15.62c-.18.85-.28 1.7-.12 2.56.03.23.1.44.18.64zM44.51 39.21H44.45c-.02 0-.04.01-.06.02-.01.01-.02.01-.03.02-.01.01-.01.02-.02.02-.66 1.03-1.23 2.79-1.01 3.84.01.02.01.04.03.07.02.03.03.05.05.07.04.05.1.08.15.11.03.01.06.02.09.02h.1c.05-.01.09-.02.13-.04.01-.01.02-.01.02-.02 1.11-.96 1.34-2.88.69-4.04a.114.114 0 0 0-.08-.07zM42.05 41.69c-.01 0-.02 0-.03-.01h-.04c-.02 0-.05.01-.07.02a.12.12 0 0 0-.05.05c-.88 1.07-1.71 2.14-1.84 3.54 0 .07.02.15.05.21.02.03.03.05.06.08.05.05.11.09.17.12.04.01.07.02.11.02h.03c.07 0 .13-.02.19-.05 1.09-.64 1.91-2.6 1.53-3.86-.01-.02-.01-.03-.02-.05 0-.04-.04-.06-.09-.07z\" /><path style=\"fill-rule:evenodd;clip-rule:evenodd\" d=\"M42 47.75c0-.02-.01-.04-.02-.06a.156.156 0 0 0-.08-.06c-1.15-.43-3.35-.57-4.67-.11-.04.01-.07.03-.1.05-.02.02-.04.03-.06.05a.4.4 0 0 0-.12.29c0 .08.02.15.05.21.02.03.04.06.06.08l.04.04c.11.08.24.15.37.21.57.26 1.17.31 1.78.27.95-.07 1.84-.32 2.68-.78.01-.01.02-.01.03-.02l.03-.03c.01-.01.01-.02.01-.03v-.11z\" /></g><path d=\"M34.44 15.61v-.88c-.4-.04-.84-.07-1.35-.08h-.03v-.99h-.98v.99h-.03c-.5.02-.95.04-1.35.08v.88c.4-.04.84-.07 1.35-.08h.04v2.83h.98v-2.83h.04c.5.01.94.04 1.33.08z\" /></g><g><path d=\"M97.5 2.35v.07h.07c.03 0 .1 0 .2.02.09.01.19.04.29.09.11.05.21.12.31.21.09.08.17.2.22.36v.01c.05.11.07.24.07.41v10.82c0 .24-.03.43-.09.56-.08.25-.2.41-.38.5-.19.09-.4.17-.63.24l-.05.01V16h4.37v-.35l-.05-.01a4.67 4.67 0 0 1-.66-.23c-.19-.09-.33-.24-.44-.49a.863.863 0 0 1-.1-.28c-.02-.09-.03-.2-.03-.32V9.08h2.94c.3.02.61.03.91.06.29.03.51.15.67.38v.01h.01c.06.05.1.13.13.24.03.11.07.25.11.43l.01.05h.36V6.79h-.37v.07a1.905 1.905 0 0 1-.12.45c-.04.11-.1.21-.18.32-.08.1-.18.17-.3.22-.14.06-.3.09-.49.1-.19.01-.44.01-.74.01h-2.94V3.08h3.51c.27.02.54.04.82.09.26.04.46.18.62.43.06.1.11.2.15.3.04.11.07.21.1.31l.01.05h.36l.02-2.19H97.5v.28zM117.84 2.35v.05l.18.04c.07.02.15.04.24.07.08.02.17.06.27.11.09.05.16.11.23.18.16.19.24.44.25.75.01.32.01.59.01.81v6.26c0 .34-.01.63-.03.88-.02.25-.05.48-.08.68-.03.2-.07.38-.12.54-.05.16-.11.33-.18.49-.09.21-.18.38-.28.53-.1.15-.17.25-.22.32-.12.13-.26.26-.44.4s-.4.26-.66.38-.55.22-.89.3c-.33.08-.72.12-1.15.12-.64 0-1.25-.11-1.84-.34-.59-.22-1.09-.59-1.5-1.12-.19-.26-.35-.52-.46-.78-.11-.26-.19-.53-.24-.81-.05-.28-.08-.56-.1-.84-.01-.29-.02-.59-.02-.9V4.3c.01-.27.02-.51.03-.72 0-.2.04-.37.1-.52.06-.14.16-.27.31-.37.15-.1.38-.2.69-.27l.05-.01.02-.26.01-.07h-4.24v.32l.05.01c.38.1.62.21.74.32.18.13.28.31.31.54.03.25.04.58.04 1.01v6.68c0 .48.02.87.06 1.18.05.38.13.73.24 1.05.13.37.33.74.59 1.12.26.38.61.72 1.04 1.02.43.31.96.55 1.59.74.63.19 1.38.29 2.25.29.88 0 1.64-.11 2.26-.32.62-.21 1.14-.48 1.55-.81.4-.33.72-.7.95-1.11.22-.4.39-.79.5-1.18.07-.25.11-.5.15-.76.03-.26.05-.49.06-.72.01-.22.01-.41.01-.58V4.22c0-.35.01-.62.02-.81a.98.98 0 0 1 .16-.48c.11-.18.24-.29.4-.35.17-.06.35-.12.54-.17l.05-.01v-.34h-3.52v.29zM139.03 13.68l-.02.05c-.05.17-.1.33-.15.47-.05.14-.13.27-.26.39a.8.8 0 0 1-.45.24c-.18.03-.31.04-.36.04h-.02c-.14.02-.28.04-.4.04h-2.25c-.48-.01-.91-.03-1.28-.05-.36-.02-.61-.09-.75-.19l-.14-.14-.08-.13c-.1-.21-.15-.44-.16-.69l-.03-.72V9.1h2.96c.3 0 .59.02.89.07.27.04.48.2.65.48l.09.21c.03.07.07.19.11.34l.01.05h.36V6.81h-.35l-.01.05c-.01.04-.03.11-.05.21-.02.09-.05.19-.1.3-.05.1-.12.21-.21.32H137l.01-.01a.75.75 0 0 1-.35.22c-.17.07-.34.1-.52.1H132.69V3.13h3.67c.25 0 .5.03.71.08.2.05.37.19.51.43.05.09.09.18.12.28.03.11.06.21.09.31l.01.05.29.02.07.01.04-2.25h-8.57V2.41h.07c.03 0 .1 0 .21.02.1.01.2.04.3.09.11.05.21.12.31.21.09.08.17.2.22.36v.01c.06.15.09.31.09.48V13.39c-.01.12-.01.24-.01.36v.39c0 .13 0 .25-.01.38-.01.2-.06.38-.14.54a.87.87 0 0 1-.4.38.88.88 0 0 1-.24.11c-.1.03-.2.05-.3.08l-.05.01-.02.28-.02.08h9.74v-2.32h-.35zM153 2.06v.34l.05.01c.48.1.78.26.9.44.14.2.22.41.25.65v.01c.02.11.03.21.03.32v.1c-.01.15-.01.24-.01.29v8.23l-9.23-10.39h-2.93v.34l.06.01c.19.02.38.07.55.12.16.05.28.17.38.35v.01c.09.13.13.29.14.46.01.19.01.44.01.77v9.81c0 .18-.01.4-.03.67-.02.26-.09.45-.21.6-.14.18-.29.29-.47.34-.2.05-.33.08-.39.08l-.06.01-.02.29-.01.08h3.57v-.35l-.05-.01c-.3-.06-.53-.16-.71-.29-.17-.12-.29-.34-.36-.65l-.03-.31c0-.1-.01-.25-.01-.44V4.22l10.66 11.99h.28V4.18c.01-.28.02-.56.04-.83.01-.24.13-.45.37-.64.07-.06.16-.12.27-.17.11-.05.26-.09.45-.13l.05-.01.01-.05.02-.22.01-.07H153zM123.37 2.35v.05l.06.01c.22.04.42.1.62.19.18.08.32.23.4.47.07.25.12.69.12 1.33v11.55c0 .55-.03 1.08-.1 1.61-.07.51-.28.99-.64 1.42-.14.18-.3.34-.48.5-.18.15-.3.25-.33.27l-.05.04.17.29.03.05.06-.03c.34-.15.6-.29.8-.39.19-.11.36-.21.51-.32.44-.28.78-.58 1.03-.91.24-.32.43-.64.56-.95.13-.3.21-.6.24-.88s.06-.52.07-.72V4.4c0-.53.02-.94.07-1.2.04-.25.19-.45.46-.59.09-.05.17-.09.24-.11.06-.02.19-.05.37-.07l.06-.01V2.06h-4.27v.29z\" /><g><path d=\"M105.31 49.69h.12c.02 0 .05.01.1.02l.24.07c.08.02.16.06.25.1.08.04.15.1.2.16.15.18.22.41.23.69.01.31.01.57.01.78v6.01a10.524 10.524 0 0 1-.1 1.5c-.03.19-.07.36-.12.51-.05.16-.11.31-.17.47-.09.19-.17.36-.27.5-.09.14-.16.24-.2.29-.11.12-.25.25-.42.38-.17.13-.38.25-.62.36-.25.11-.53.21-.85.28-.32.08-.68.12-1.09.12-.6 0-1.19-.11-1.75-.32-.56-.21-1.04-.57-1.42-1.06-.18-.24-.33-.49-.43-.74-.1-.25-.18-.51-.23-.77-.05-.26-.08-.53-.09-.8-.01-.27-.02-.56-.02-.86v-5.93c.01-.26.02-.5.03-.7.01-.19.04-.35.09-.48.06-.13.15-.24.28-.33.14-.1.36-.18.64-.25l.08-.02.04-.42h-4.18v.41l.09.02c.43.12.61.23.7.3.16.12.25.28.27.48.02.23.04.56.04.96v6.05c-.01.63.01 1.13.06 1.5.05.37.13.71.23 1.02.13.36.32.72.57 1.09.25.37.59.7 1.01 1 .42.29.94.54 1.55.72.61.18 1.34.28 2.18.28.85 0 1.59-.1 2.19-.31.6-.2 1.11-.47 1.5-.79.39-.32.71-.68.93-1.08.22-.39.38-.77.48-1.15.06-.24.11-.48.15-.74.03-.24.05-.48.06-.7.01-.21.01-.4.01-.56v-6.4c0-.34.01-.59.02-.77a.86.86 0 0 1 .15-.44c.1-.15.22-.26.36-.31.16-.06.33-.11.52-.17l.09-.02v-.41h-3.49l-.02.46zM121.45 49.67l.09.02c.43.09.71.23.84.4.13.18.2.39.23.61.02.13.03.26.03.4-.01.15-.01.24-.01.28v7.77l-8.79-9.9h-2.89v.42l.1.01c.18.02.35.06.52.12.14.05.25.15.34.32.08.12.12.26.12.42.01.18.01.43.01.74v9.43c0 .18-.01.39-.03.64-.02.23-.08.41-.19.55-.12.17-.26.27-.42.3-.19.04-.31.07-.37.08l-.09.02-.04.44h3.54v-.44l-.09-.02c-.27-.06-.5-.15-.66-.27-.16-.11-.27-.32-.32-.59l-.03-.29c-.01-.1-.01-.24-.01-.42v-9.2l10.17 11.44h.34V51.34c.01-.28.02-.54.04-.8.01-.22.12-.41.34-.58.07-.06.15-.11.25-.15.1-.05.24-.09.42-.12l.09-.02.04-.42h-3.54v.42zM130.92 62.13a.864.864 0 0 1-.38-.29.661.661 0 0 1-.17-.36c-.02-.17-.03-.25-.03-.31-.02-.15-.04-.29-.04-.43v-9.09c0-.31 0-.58.01-.8.01-.21.03-.37.06-.48a.792.792 0 0 1 .44-.53c.1-.05.19-.08.27-.09.09-.02.16-.04.21-.05l.09-.02v-.41h-4.19v.41l.09.02c.05.01.13.03.23.05.09.02.19.05.3.1.1.04.2.11.3.2.09.09.17.21.22.37.05.14.07.3.08.47.01.19.01.44.01.77v8.6c-.01.43-.02.76-.03 1.01-.01.22-.07.41-.18.56-.11.16-.24.27-.38.33-.16.07-.33.12-.51.15l-.09.02v.44h4.24v-.43l-.08-.03c-.16-.07-.32-.12-.47-.18zM142.58 49.66l.09.02.41.12c.11.04.2.11.28.22.04.06.06.11.07.16a1.472 1.472 0 0 1-.03.51c-.03.13-.07.25-.11.36-.04.12-.08.21-.12.29-.04.09-.06.13-.06.16l-3.49 7.96-3.32-7.98-.15-.38c-.05-.12-.08-.24-.11-.36-.05-.17-.07-.32-.07-.44 0-.17.05-.3.16-.39.11-.1.34-.18.67-.24l.1-.02v-.42h-4.26v.42l.09.02c.15.04.28.07.37.12.09.04.19.11.31.22.16.14.28.29.36.46.08.18.13.3.16.37.09.19.17.37.25.56.08.19.16.38.24.58l4.61 10.86.03.07h.34l4.91-11.1c.1-.21.22-.47.34-.78.12-.29.25-.54.39-.75.13-.2.26-.34.39-.41.13-.08.32-.15.56-.19l.09-.02v-.42h-3.49v.42zM156.33 60.49c-.05.16-.1.31-.15.46-.04.13-.12.25-.24.36a.68.68 0 0 1-.41.21c-.21.03-.3.04-.37.04-.13.02-.25.04-.38.04h-2.15c-.47-.01-.87-.03-1.23-.05-.33-.02-.56-.08-.69-.17a.679.679 0 0 1-.12-.12c-.03-.05-.06-.1-.08-.12-.09-.2-.14-.41-.15-.65l-.03-.69v-3.68h2.79c.28 0 .57.02.84.07.25.04.44.18.58.42l.08.21c.03.07.06.18.1.32l.02.09h.44v-3.41h-.43l-.03.08c-.01.04-.03.11-.05.21a1.3 1.3 0 0 1-.3.56c-.08.09-.19.16-.32.2-.15.06-.31.09-.48.09h-3.26v-4.58h3.47c.24 0 .47.02.67.07.18.04.33.17.45.39.05.08.08.17.11.26.03.1.06.2.08.29l.02.08.44.04.04-2.27h-8.35v.44h.12c.03 0 .1.01.19.02s.18.04.28.08c.1.05.19.11.28.19.08.07.15.18.2.33.06.14.09.28.09.44v9.42c-.01.18-.02.36-.01.55.01.18 0 .36-.01.54-.01.18-.06.35-.13.5-.07.14-.19.25-.37.35-.07.04-.14.08-.22.1-.09.03-.19.05-.29.08l-.08.02-.04.44h9.47V60.4h-.43l.04.09zM170.42 62.2a.997.997 0 0 1-.31-.19c-.11-.09-.21-.2-.28-.32-.08-.14-.14-.23-.17-.27-.21-.31-.41-.65-.6-1l-2.59-4.72c.07-.03.15-.08.24-.12.16-.08.35-.2.54-.34.2-.14.4-.31.6-.51.2-.2.38-.44.52-.71.22-.43.33-.91.33-1.44 0-.5-.08-.93-.24-1.27-.15-.33-.28-.58-.39-.74-.25-.32-.54-.58-.86-.75-.31-.17-.65-.3-1.01-.39-.35-.08-.72-.13-1.09-.14-.37-.01-.72-.02-1.06-.02h-4.84v.44h.12s.03 0 .14.02c.08.02.18.05.28.08.1.03.19.09.28.16.09.07.16.16.21.27.06.12.09.28.1.46.01.2.02.45.02.75v9.03c-.01.3-.02.56-.03.77-.01.2-.03.35-.08.45a.77.77 0 0 1-.19.29c-.08.08-.18.14-.27.19-.1.05-.19.08-.27.09-.1.02-.15.02-.16.02h-.12v.46h4.28v-.43l-.09-.02c-.27-.07-.47-.14-.59-.19a.807.807 0 0 1-.3-.23.771.771 0 0 1-.2-.34c-.02-.12-.04-.26-.05-.44-.01-.11-.02-.22-.02-.34 0-.12-.01-.25-.02-.37v-4.07c.13 0 .26 0 .38.01.38.02.82.01 1.29-.02l.7-.06 2.44 4.46c.14.25.29.52.47.8.18.29.39.54.64.73.16.13.33.23.5.3.16.07.32.12.47.15.15.03.29.05.41.05h1.16v-.42l-.07-.03c-.01 0-.09-.04-.22-.09zm-8.11-11.78h1.34c.36-.01.73 0 1.09.04.35.04.69.16 1 .36.34.21.59.5.75.84.16.35.24.73.24 1.11 0 .3-.03.56-.09.77-.06.21-.12.36-.18.46a1.8 1.8 0 0 1-.53.62c-.21.15-.45.28-.7.36-.27.08-.54.14-.82.17-.28.03-.56.05-.84.05h-1.3l.04-4.78zM179.01 55.66l-.82-.53-1.09-.62c-.33-.2-.67-.43-1.01-.66-.33-.23-.57-.53-.72-.89-.06-.16-.1-.32-.11-.45-.01-.14-.02-.24-.02-.3 0-.35.06-.65.19-.92.12-.27.29-.49.5-.66.21-.18.46-.32.75-.41.29-.1.6-.15.93-.15.45 0 .83.07 1.13.2a2.207 2.207 0 0 1 1.16 1.08c.11.22.2.41.27.57l.03.07h.4v-2.4l-.08-.03c-.14-.05-.3-.11-.5-.19s-.43-.15-.67-.21c-.24-.06-.53-.12-.84-.17-.31-.05-.67-.08-1.05-.08-.13 0-.31.01-.54.02-.24.01-.5.05-.78.13-.28.07-.58.19-.89.35-.31.16-.6.39-.87.67-.18.18-.38.47-.59.85-.21.38-.32.9-.32 1.53 0 .21.02.43.06.68.04.25.12.5.24.76s.3.53.53.81c.23.27.54.55.93.82.13.09.25.17.38.24.12.07.24.14.37.21l1.21.72c.37.22.72.46 1.04.71.3.24.54.56.71.97.04.08.08.21.13.38s.07.37.07.61c0 .35-.04.63-.13.85-.09.22-.17.4-.23.52-.28.43-.64.75-1.07.94-.44.2-.93.3-1.44.3-.32 0-.6-.03-.85-.1s-.47-.15-.66-.25c-.18-.1-.34-.21-.47-.33-.12-.12-.22-.23-.29-.33-.06-.1-.13-.21-.19-.34-.07-.13-.15-.32-.25-.55l-.03-.06-.41-.04v2.38l.07.03c.31.14.7.3 1.18.46.49.17 1.14.26 1.93.26.14 0 .34-.01.59-.02a4.71 4.71 0 0 0 1.85-.47c.34-.16.68-.4 1.01-.71.28-.27.51-.55.67-.82.16-.28.29-.55.37-.81.08-.26.14-.51.16-.73.02-.22.03-.4.03-.54 0-1.07-.4-1.98-1.19-2.71-.23-.25-.49-.45-.78-.64zM187.67 62.13a.864.864 0 0 1-.38-.29.661.661 0 0 1-.17-.36c-.02-.17-.03-.25-.03-.31-.02-.15-.04-.29-.04-.43v-9.09c0-.31 0-.58.01-.8.01-.21.03-.37.06-.48.04-.15.11-.26.18-.34a.7.7 0 0 1 .26-.19c.1-.05.19-.08.27-.09.09-.02.16-.04.21-.05l.09-.02v-.41h-4.19v.41l.09.02c.05.01.13.03.23.05.09.02.19.05.3.1.1.04.2.11.3.2.09.09.17.21.22.37.05.14.07.3.08.47.01.19.01.44.01.77v8.6c-.01.43-.02.76-.03 1.01-.01.22-.06.41-.18.56-.11.16-.24.27-.38.33-.16.07-.33.12-.51.15l-.1.02v.44h4.24v-.43l-.08-.03c-.14-.07-.3-.12-.46-.18zM189.49 51.51h.44l.02-.1c.01-.06.03-.18.07-.35.03-.14.11-.27.25-.39.12-.1.28-.17.45-.21.19-.04.46-.07.82-.08h2.61v10.44c0 .36-.04.63-.12.81-.08.18-.19.32-.33.42-.11.09-.23.15-.35.18-.14.03-.24.06-.28.07l-.07.02-.04.43h4.33v-.43l-.09-.02c-.24-.06-.42-.12-.53-.18a1.33 1.33 0 0 1-.3-.23.867.867 0 0 1-.19-.31c-.04-.11-.07-.23-.08-.36-.01-.14-.02-.3-.02-.49V50.42h2.83c.41 0 .73.06.97.17.21.1.36.37.43.79l.02.1h.43v-2.23H189.5v2.26zM210.49 49.25v.42l.1.02c.16.02.3.05.42.08.09.02.18.1.25.25.06.09.08.15.08.18a.998.998 0 0 1-.14.66c-.11.19-.2.36-.29.5l-2.59 4.2-2.7-4.21c-.1-.13-.2-.3-.3-.5-.1-.19-.15-.37-.15-.54 0-.14.03-.24.09-.31.07-.08.14-.14.22-.18.08-.05.17-.08.24-.09.07-.02.12-.02.15-.02h.13v-.44h-4.26v.41l.09.02c.14.03.26.08.35.12.09.05.17.1.24.15.07.06.13.13.2.22s.15.2.24.31c.06.08.12.17.17.25.05.08.11.17.17.24l3.78 5.83v3.91c0 .35-.01.62-.04.79-.02.15-.1.3-.22.45-.11.12-.23.2-.35.24-.14.04-.3.08-.48.1l-.09.01-.04.45h4.23v-.44l-.09-.02c-.07-.01-.18-.03-.34-.06a.81.81 0 0 1-.39-.2.903.903 0 0 1-.31-.59c-.03-.27-.05-.52-.05-.75v-3.8l3.78-6.06.36-.55c.12-.18.25-.31.42-.41.1-.07.2-.11.3-.13l.24-.06.08-.03v-.41h-3.5zM99.02 29.07c.19-.35.39-.66.6-.91.22-.25.42-.46.6-.62.41-.34.83-.61 1.26-.81.43-.2.85-.34 1.23-.43.39-.09.75-.14 1.06-.16.33-.02.57-.03.74-.03.49 0 1.03.05 1.59.16.55.1 1.03.31 1.43.62.25.2.44.41.56.62l.32.57h.41l.08-2.42-.09-.02a19.465 19.465 0 0 0-2.51-.57 8.37 8.37 0 0 0-.92-.09c-.28-.01-.55-.02-.82-.02-.25 0-.59.01-1.05.04-.45.03-.95.11-1.49.24-.55.13-1.13.35-1.74.64-.61.29-1.19.7-1.74 1.22-.5.47-.9.96-1.18 1.45-.29.5-.51.98-.65 1.44-.15.46-.24.9-.28 1.29-.04.39-.06.71-.06.95 0 .72.1 1.42.29 2.08.19.66.48 1.28.85 1.84s.83 1.06 1.37 1.49c.54.43 1.15.78 1.83 1.05.34.14.69.25 1.03.32.35.07.66.12.93.16.28.04.54.06.77.07.22.01.4.01.52.01.53 0 1.13-.04 1.8-.12.66-.08 1.26-.19 1.79-.33.22-.06.43-.12.64-.19.21-.06.42-.13.64-.21l.08-.03-.08-2.32h-.42l-.03.08-.15.37c-.06.14-.17.31-.33.49-.07.07-.18.17-.31.28-.12.11-.29.21-.49.3-.26.12-.53.22-.81.28-.28.07-.56.12-.81.16-.25.04-.48.06-.67.07-.19.01-.33.01-.4.01-.22 0-.5-.01-.84-.04-.34-.02-.72-.1-1.13-.22-.4-.12-.83-.31-1.26-.56-.43-.25-.85-.6-1.26-1.04a6.5 6.5 0 0 1-.51-.64c-.18-.25-.34-.56-.5-.91-.15-.35-.28-.75-.39-1.2-.11-.45-.16-.96-.16-1.52 0-.6.06-1.15.19-1.62.13-.5.29-.92.47-1.27zM113.46 38.42l-.1-.02c-.14-.02-.27-.06-.39-.12a.568.568 0 0 1-.26-.25c-.04-.08-.07-.14-.08-.2-.01-.06-.02-.11-.02-.14 0-.12.04-.28.11-.46.08-.19.17-.43.28-.7l1.1-2.56h4.67l1.03 2.46c.06.17.13.32.2.48.07.15.13.3.19.45.04.14.05.25.05.31 0 .02 0 .07-.01.13-.01.05-.03.1-.07.18a.6.6 0 0 1-.31.3c-.15.06-.31.1-.47.12l-.09.01-.04.45h4.31v-.38l-.07-.03c-.14-.06-.31-.15-.51-.25-.19-.1-.38-.3-.57-.6-.04-.06-.08-.14-.13-.24l-.15-.33-.14-.32c-.05-.1-.09-.19-.12-.26l-4.78-11.18-.03-.07h-.32l-5.23 11.63c-.12.28-.24.53-.34.72-.1.19-.21.35-.32.46a1.222 1.222 0 0 1-.79.4l-.1.01v.45h3.53v-.45zm1.18-5.58 1.88-4.16 1.77 4.16h-3.65zM132.73 27.59h.43v-2.22H121.9v2.26h.44l.02-.1c.01-.06.03-.18.07-.35.03-.14.11-.27.25-.39.12-.1.28-.17.45-.21.19-.04.46-.07.82-.08h2.61v10.44c0 .36-.04.63-.12.81-.08.18-.19.32-.33.42-.11.09-.23.15-.35.18-.14.03-.23.05-.27.07l-.07.02-.04.43h4.33v-.43l-.09-.02c-.24-.06-.42-.12-.53-.18a1.33 1.33 0 0 1-.3-.23c-.09-.1-.16-.21-.2-.31-.04-.11-.07-.23-.08-.36-.01-.14-.02-.31-.02-.49V26.54h2.83c.41 0 .73.06.97.17.21.1.36.37.43.79l.01.09zM138.6 38.4h-.12c-.01 0-.06 0-.15-.02-.07-.02-.15-.05-.25-.09-.09-.04-.19-.11-.28-.18a.74.74 0 0 1-.21-.28c-.06-.14-.09-.31-.09-.51-.01-.22-.01-.51-.01-.87V32.3h7.18v4.11c0 .31 0 .59-.01.82-.01.22-.02.4-.04.49-.02.07-.05.13-.08.19-.04.07-.06.09-.07.12-.09.12-.2.21-.33.26-.14.06-.29.1-.45.12l-.09.01-.04.44h4.16v-.44l-.09-.02c-.17-.04-.32-.08-.44-.13a.998.998 0 0 1-.34-.26.842.842 0 0 1-.19-.36 2.73 2.73 0 0 1-.06-.45c-.01-.13-.02-.27-.02-.39v-9.05c0-.16 0-.38.01-.66.01-.27.03-.48.08-.61a.78.78 0 0 1 .19-.32c.09-.09.19-.16.28-.21.09-.05.18-.08.26-.1.1-.02.17-.04.21-.05l.08-.03v-.41h-4.11v.44h.12a1.804 1.804 0 0 1 .44.12c.1.04.19.1.28.18.09.08.15.17.19.29.05.13.07.29.07.5v4.25h-7.18v-3.47c0-.33.01-.6.03-.83.02-.22.06-.38.12-.5.04-.1.11-.19.19-.25.09-.07.18-.12.27-.15.09-.03.17-.06.25-.08.09-.02.15-.04.19-.05l.08-.03v-.41h-4.13v.41l.08.03c.04.01.11.03.21.05.09.02.18.05.27.08.09.04.18.1.26.18.08.08.15.18.21.31.06.16.09.33.1.49.01.18 0 .44-.01.79v8.74c0 .3 0 .57-.01.8-.01.22-.03.39-.06.49-.04.13-.11.24-.2.33-.09.09-.18.16-.28.2-.1.05-.19.08-.28.11-.12.03-.16.03-.17.03h-.12v.46h4.13v-.48zM162.85 36.96c.41-.45.73-.92.97-1.39.24-.47.41-.91.53-1.33.11-.42.19-.8.21-1.15.03-.35.04-.63.04-.85a7.775 7.775 0 0 0-.69-3.26 6.747 6.747 0 0 0-1.22-1.83c-.18-.19-.42-.41-.72-.67-.3-.25-.67-.5-1.1-.72a7.74 7.74 0 0 0-1.48-.56c-.56-.15-1.19-.23-1.88-.23-.8 0-1.53.1-2.16.3-.63.2-1.19.43-1.66.71-.47.27-.88.57-1.2.88-.32.31-.59.58-.78.81-.14.18-.3.4-.48.68-.18.27-.35.6-.51.98-.16.37-.3.81-.4 1.29-.11.48-.16 1.03-.16 1.62 0 .74.09 1.4.25 1.99.17.58.38 1.1.62 1.56.25.45.52.84.8 1.14.28.3.53.55.75.74.69.57 1.44.99 2.24 1.23.8.25 1.64.37 2.52.37 1.11 0 2.12-.17 3.02-.52.91-.35 1.75-.95 2.49-1.79zm-5.33 1.16c-.65 0-1.23-.09-1.73-.28-.5-.19-.93-.42-1.29-.68-.36-.26-.65-.54-.88-.82-.23-.29-.41-.53-.53-.73a6.64 6.64 0 0 1-.56-1.09c-.14-.36-.24-.69-.3-1.01a7.848 7.848 0 0 1-.15-1.49c0-.65.07-1.24.2-1.75s.29-.96.49-1.35c.19-.38.41-.71.65-.98.24-.27.47-.49.68-.66.3-.24.62-.44.95-.59.32-.15.63-.26.93-.33a5.406 5.406 0 0 1 1.34-.17c.53 0 1 .06 1.41.18.41.12.78.27 1.09.44.31.17.58.35.79.55.22.2.39.38.53.53.16.21.34.47.53.78.19.3.36.67.52 1.1.15.42.27.91.34 1.44.07.53.09 1.13.04 1.77-.01.14-.04.36-.08.69-.04.31-.13.66-.27 1.05-.18.51-.43.98-.73 1.4-.3.41-.66.78-1.06 1.07-.4.3-.86.53-1.35.69-.47.16-1 .24-1.56.24zM167.28 25.85a1.148 1.148 0 0 1 .59.32c.09.09.17.21.23.35.05.13.07.31.09.56.01.25.02.55.02.89v7.86c0 .34 0 .66-.01.97-.01.38-.02.54-.03.6-.03.21-.09.37-.18.49s-.18.22-.28.29a.96.96 0 0 1-.32.16c-.11.04-.21.06-.28.07l-.1.02v.44h9.78v-2.32h-.43l-.02.08c-.06.21-.12.37-.17.49-.05.11-.11.2-.18.27-.09.09-.19.15-.31.2-.13.05-.27.08-.4.1-.14.02-.28.03-.43.04-.14.01-.28.01-.4.01h-2.61l-.75-.03a1.1 1.1 0 0 1-.45-.13.71.71 0 0 1-.39-.52c-.05-.25-.08-.62-.09-1.09v-8.02c.01-.33.03-.62.04-.88.01-.26.03-.45.05-.55.04-.14.11-.26.2-.35.09-.09.19-.16.28-.22.1-.05.19-.08.27-.1.1-.02.17-.04.22-.05l.09-.02v-.41h-4.34v.41l.08.03c.04 0 .12.02.23.04zM182.31 38.24a.918.918 0 0 1-.38-.28.661.661 0 0 1-.17-.36c-.02-.17-.03-.25-.03-.31-.02-.15-.04-.29-.04-.43v-9.09c0-.31 0-.58.01-.8.01-.21.02-.37.06-.48a.792.792 0 0 1 .44-.53c.1-.05.19-.08.27-.09.09-.02.16-.04.21-.05l.09-.02v-.41h-4.19v.41l.09.02c.05.01.13.03.23.05.09.02.19.05.29.1.1.04.2.11.3.2.09.09.17.21.22.37.05.14.07.3.08.47.01.19.01.44.01.77v8.6c-.01.43-.02.76-.03 1.01-.01.22-.07.41-.18.56-.11.16-.24.27-.38.33-.16.07-.33.12-.51.15l-.1.02v.44h4.24v-.43l-.08-.02c-.14-.08-.3-.14-.45-.2zM186.43 36.16c.37.56.83 1.06 1.37 1.49.54.43 1.15.78 1.83 1.05.34.14.69.25 1.03.32.35.07.66.12.93.16.28.04.54.06.77.07.22.01.4.01.52.01.53 0 1.13-.04 1.8-.12.66-.08 1.26-.19 1.79-.33.22-.06.43-.12.64-.19.21-.06.42-.13.64-.21l.08-.03-.08-2.32h-.42l-.03.08-.15.37c-.06.14-.17.31-.33.49-.07.07-.18.17-.31.28-.12.11-.29.21-.49.3-.26.12-.53.22-.81.28-.28.07-.56.12-.81.16-.25.04-.48.06-.67.07-.19.01-.33.01-.4.01-.21 0-.5-.01-.84-.04-.34-.02-.72-.1-1.13-.22-.4-.12-.83-.31-1.26-.56-.43-.25-.85-.6-1.26-1.04a6.5 6.5 0 0 1-.51-.64c-.18-.25-.34-.56-.5-.91-.15-.35-.28-.75-.39-1.2-.11-.45-.16-.96-.16-1.52 0-.6.06-1.15.19-1.62.13-.48.29-.9.47-1.25.19-.35.39-.66.6-.91.22-.25.42-.46.6-.62.41-.34.83-.61 1.26-.81.43-.2.85-.34 1.23-.43.39-.09.75-.14 1.06-.16.33-.02.57-.03.74-.03.49 0 1.03.05 1.59.16.55.1 1.03.31 1.43.62.25.2.44.41.56.62l.32.57h.41l.08-2.42-.09-.02a19.465 19.465 0 0 0-2.51-.57 8.37 8.37 0 0 0-.92-.09c-.28-.01-.55-.02-.82-.02-.25 0-.59.01-1.05.04-.45.03-.95.11-1.49.24-.55.13-1.13.35-1.74.64-.61.29-1.19.7-1.74 1.22-.5.47-.9.96-1.18 1.45-.29.5-.51.98-.65 1.44-.15.46-.24.9-.28 1.29-.04.39-.06.71-.06.95 0 .72.1 1.42.29 2.08.19.65.48 1.26.85 1.82z\" /></g></g><g><path d=\"M82.06 1.59v61.82h.68V1.59\" /></g></symbol>"
});
var result = _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default().add(symbol);
/* harmony default export */ __webpack_exports__["default"] = (symbol);

/***/ }),

/***/ 2801:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3465);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2594);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__);


var symbol = new (_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default())({
  "id": "minus",
  "use": "minus-usage",
  "viewBox": "0 0 12 12",
  "content": "<symbol xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 12 12\" id=\"minus\"><path d=\"M0 5h12v2H0z\" /></symbol>"
});
var result = _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default().add(symbol);
/* harmony default export */ __webpack_exports__["default"] = (symbol);

/***/ }),

/***/ 4101:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3465);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2594);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__);


var symbol = new (_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default())({
  "id": "plus",
  "use": "plus-usage",
  "viewBox": "0 0 12 12",
  "content": "<symbol xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 12 12\" id=\"plus\"><path d=\"M12 5H7V0H5v5H0v2h5v5h2V7h5z\" /></symbol>"
});
var result = _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default().add(symbol);
/* harmony default export */ __webpack_exports__["default"] = (symbol);

/***/ }),

/***/ 4432:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3465);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2594);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__);


var symbol = new (_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default())({
  "id": "search",
  "use": "search-usage",
  "viewBox": "0 0 72 72",
  "content": "<symbol xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 72 72\" id=\"search\"><path d=\"m70.64 64.76-18.9-19.02a5.11 5.11 0 0 0-3.6-1.36 28.366 28.366 0 0 0 5.85-17.21C54 12.16 41.91 0 27 0 12.09 0 0 12.16 0 27.17s12.09 27.17 27 27.17c6.27.04 12.35-2.21 17.1-6.34a3.76 3.76 0 0 0 1.35 3.62l18.9 19.02a4.329 4.329 0 0 0 6.15.15l.15-.15a3.86 3.86 0 0 0 .45-5.43c-.14-.16-.29-.32-.46-.45zM27 47.55c-11.18 0-20.25-9.12-20.25-20.38C6.75 15.92 15.82 6.8 27 6.8s20.25 9.12 20.25 20.38c.05 11.21-8.94 20.33-20.08 20.38-.06-.01-.12-.01-.17-.01z\" /></symbol>"
});
var result = _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default().add(symbol);
/* harmony default export */ __webpack_exports__["default"] = (symbol);

/***/ }),

/***/ 5574:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3465);
/* harmony import */ var _node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2594);
/* harmony import */ var _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1__);


var symbol = new (_node_modules_svg_baker_runtime_browser_symbol_js__WEBPACK_IMPORTED_MODULE_0___default())({
  "id": "yt",
  "use": "yt-usage",
  "viewBox": "0 0 72 72",
  "content": "<symbol xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 72 72\" id=\"yt\"><path d=\"M36 0C16.12 0 0 16.12 0 36s16.12 36 36 36 36-16.12 36-36S55.88 0 36 0zm19.27 41.05c0 4.77-3.87 8.64-8.64 8.64H24.52c-4.77 0-8.64-3.87-8.64-8.64V30.77v.01c0-4.77 3.87-8.64 8.64-8.64h22.1c4.77 0 8.64 3.87 8.64 8.64v10.27z\" /><path d=\"m41.86 35.66-9.49-5.16c-.39-.21-1.72.06-1.72.51v10.07c0 .34.78.58 1.32.58.14.01.27-.02.39-.07l9.91-4.9c.41-.23-.01-.8-.41-1.03z\" /></symbol>"
});
var result = _node_modules_svg_sprite_loader_runtime_browser_sprite_build_js__WEBPACK_IMPORTED_MODULE_1___default().add(symbol);
/* harmony default export */ __webpack_exports__["default"] = (symbol);

/***/ }),

/***/ 2594:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

(function (global, factory) {
	 true ? module.exports = factory() :
	0;
}(this, (function () { 'use strict';

var commonjsGlobal = typeof window !== 'undefined' ? window : typeof __webpack_require__.g !== 'undefined' ? __webpack_require__.g : typeof self !== 'undefined' ? self : {};





function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var deepmerge = createCommonjsModule(function (module, exports) {
(function (root, factory) {
    if (false) {} else {
        module.exports = factory();
    }
}(commonjsGlobal, function () {

function isMergeableObject(val) {
    var nonNullObject = val && typeof val === 'object';

    return nonNullObject
        && Object.prototype.toString.call(val) !== '[object RegExp]'
        && Object.prototype.toString.call(val) !== '[object Date]'
}

function emptyTarget(val) {
    return Array.isArray(val) ? [] : {}
}

function cloneIfNecessary(value, optionsArgument) {
    var clone = optionsArgument && optionsArgument.clone === true;
    return (clone && isMergeableObject(value)) ? deepmerge(emptyTarget(value), value, optionsArgument) : value
}

function defaultArrayMerge(target, source, optionsArgument) {
    var destination = target.slice();
    source.forEach(function(e, i) {
        if (typeof destination[i] === 'undefined') {
            destination[i] = cloneIfNecessary(e, optionsArgument);
        } else if (isMergeableObject(e)) {
            destination[i] = deepmerge(target[i], e, optionsArgument);
        } else if (target.indexOf(e) === -1) {
            destination.push(cloneIfNecessary(e, optionsArgument));
        }
    });
    return destination
}

function mergeObject(target, source, optionsArgument) {
    var destination = {};
    if (isMergeableObject(target)) {
        Object.keys(target).forEach(function (key) {
            destination[key] = cloneIfNecessary(target[key], optionsArgument);
        });
    }
    Object.keys(source).forEach(function (key) {
        if (!isMergeableObject(source[key]) || !target[key]) {
            destination[key] = cloneIfNecessary(source[key], optionsArgument);
        } else {
            destination[key] = deepmerge(target[key], source[key], optionsArgument);
        }
    });
    return destination
}

function deepmerge(target, source, optionsArgument) {
    var array = Array.isArray(source);
    var options = optionsArgument || { arrayMerge: defaultArrayMerge };
    var arrayMerge = options.arrayMerge || defaultArrayMerge;

    if (array) {
        return Array.isArray(target) ? arrayMerge(target, source, optionsArgument) : cloneIfNecessary(source, optionsArgument)
    } else {
        return mergeObject(target, source, optionsArgument)
    }
}

deepmerge.all = function deepmergeAll(array, optionsArgument) {
    if (!Array.isArray(array) || array.length < 2) {
        throw new Error('first argument should be an array with at least two elements')
    }

    // we are sure there are at least 2 values, so it is safe to have no initial value
    return array.reduce(function(prev, next) {
        return deepmerge(prev, next, optionsArgument)
    })
};

return deepmerge

}));
});

//      
// An event handler can take an optional event argument
// and should not return a value
                                          
// An array of all currently registered event handlers for a type
                                            
// A map of event types and their corresponding event handlers.
                        
                                   
  

/** Mitt: Tiny (~200b) functional event emitter / pubsub.
 *  @name mitt
 *  @returns {Mitt}
 */
function mitt(all                 ) {
	all = all || Object.create(null);

	return {
		/**
		 * Register an event handler for the given type.
		 *
		 * @param  {String} type	Type of event to listen for, or `"*"` for all events
		 * @param  {Function} handler Function to call in response to given event
		 * @memberOf mitt
		 */
		on: function on(type        , handler              ) {
			(all[type] || (all[type] = [])).push(handler);
		},

		/**
		 * Remove an event handler for the given type.
		 *
		 * @param  {String} type	Type of event to unregister `handler` from, or `"*"`
		 * @param  {Function} handler Handler function to remove
		 * @memberOf mitt
		 */
		off: function off(type        , handler              ) {
			if (all[type]) {
				all[type].splice(all[type].indexOf(handler) >>> 0, 1);
			}
		},

		/**
		 * Invoke all handlers for the given type.
		 * If present, `"*"` handlers are invoked after type-matched handlers.
		 *
		 * @param {String} type  The event type to invoke
		 * @param {Any} [evt]  Any value (object is recommended and powerful), passed to each handler
		 * @memberof mitt
		 */
		emit: function emit(type        , evt     ) {
			(all[type] || []).map(function (handler) { handler(evt); });
			(all['*'] || []).map(function (handler) { handler(type, evt); });
		}
	};
}

var namespaces_1 = createCommonjsModule(function (module, exports) {
var namespaces = {
  svg: {
    name: 'xmlns',
    uri: 'http://www.w3.org/2000/svg'
  },
  xlink: {
    name: 'xmlns:xlink',
    uri: 'http://www.w3.org/1999/xlink'
  }
};

exports.default = namespaces;
module.exports = exports.default;
});

/**
 * @param {Object} attrs
 * @return {string}
 */
var objectToAttrsString = function (attrs) {
  return Object.keys(attrs).map(function (attr) {
    var value = attrs[attr].toString().replace(/"/g, '&quot;');
    return (attr + "=\"" + value + "\"");
  }).join(' ');
};

var svg = namespaces_1.svg;
var xlink = namespaces_1.xlink;

var defaultAttrs = {};
defaultAttrs[svg.name] = svg.uri;
defaultAttrs[xlink.name] = xlink.uri;

/**
 * @param {string} [content]
 * @param {Object} [attributes]
 * @return {string}
 */
var wrapInSvgString = function (content, attributes) {
  if ( content === void 0 ) content = '';

  var attrs = deepmerge(defaultAttrs, attributes || {});
  var attrsRendered = objectToAttrsString(attrs);
  return ("<svg " + attrsRendered + ">" + content + "</svg>");
};

var svg$1 = namespaces_1.svg;
var xlink$1 = namespaces_1.xlink;

var defaultConfig = {
  attrs: ( obj = {
    style: ['position: absolute', 'width: 0', 'height: 0'].join('; '),
    'aria-hidden': 'true'
  }, obj[svg$1.name] = svg$1.uri, obj[xlink$1.name] = xlink$1.uri, obj )
};
var obj;

var Sprite = function Sprite(config) {
  this.config = deepmerge(defaultConfig, config || {});
  this.symbols = [];
};

/**
 * Add new symbol. If symbol with the same id exists it will be replaced.
 * @param {SpriteSymbol} symbol
 * @return {boolean} `true` - symbol was added, `false` - replaced
 */
Sprite.prototype.add = function add (symbol) {
  var ref = this;
    var symbols = ref.symbols;
  var existing = this.find(symbol.id);

  if (existing) {
    symbols[symbols.indexOf(existing)] = symbol;
    return false;
  }

  symbols.push(symbol);
  return true;
};

/**
 * Remove symbol & destroy it
 * @param {string} id
 * @return {boolean} `true` - symbol was found & successfully destroyed, `false` - otherwise
 */
Sprite.prototype.remove = function remove (id) {
  var ref = this;
    var symbols = ref.symbols;
  var symbol = this.find(id);

  if (symbol) {
    symbols.splice(symbols.indexOf(symbol), 1);
    symbol.destroy();
    return true;
  }

  return false;
};

/**
 * @param {string} id
 * @return {SpriteSymbol|null}
 */
Sprite.prototype.find = function find (id) {
  return this.symbols.filter(function (s) { return s.id === id; })[0] || null;
};

/**
 * @param {string} id
 * @return {boolean}
 */
Sprite.prototype.has = function has (id) {
  return this.find(id) !== null;
};

/**
 * @return {string}
 */
Sprite.prototype.stringify = function stringify () {
  var ref = this.config;
    var attrs = ref.attrs;
  var stringifiedSymbols = this.symbols.map(function (s) { return s.stringify(); }).join('');
  return wrapInSvgString(stringifiedSymbols, attrs);
};

/**
 * @return {string}
 */
Sprite.prototype.toString = function toString () {
  return this.stringify();
};

Sprite.prototype.destroy = function destroy () {
  this.symbols.forEach(function (s) { return s.destroy(); });
};

var SpriteSymbol = function SpriteSymbol(ref) {
  var id = ref.id;
  var viewBox = ref.viewBox;
  var content = ref.content;

  this.id = id;
  this.viewBox = viewBox;
  this.content = content;
};

/**
 * @return {string}
 */
SpriteSymbol.prototype.stringify = function stringify () {
  return this.content;
};

/**
 * @return {string}
 */
SpriteSymbol.prototype.toString = function toString () {
  return this.stringify();
};

SpriteSymbol.prototype.destroy = function destroy () {
    var this$1 = this;

  ['id', 'viewBox', 'content'].forEach(function (prop) { return delete this$1[prop]; });
};

/**
 * @param {string} content
 * @return {Element}
 */
var parse = function (content) {
  var hasImportNode = !!document.importNode;
  var doc = new DOMParser().parseFromString(content, 'image/svg+xml').documentElement;

  /**
   * Fix for browser which are throwing WrongDocumentError
   * if you insert an element which is not part of the document
   * @see http://stackoverflow.com/a/7986519/4624403
   */
  if (hasImportNode) {
    return document.importNode(doc, true);
  }

  return doc;
};

var BrowserSpriteSymbol = (function (SpriteSymbol$$1) {
  function BrowserSpriteSymbol () {
    SpriteSymbol$$1.apply(this, arguments);
  }

  if ( SpriteSymbol$$1 ) BrowserSpriteSymbol.__proto__ = SpriteSymbol$$1;
  BrowserSpriteSymbol.prototype = Object.create( SpriteSymbol$$1 && SpriteSymbol$$1.prototype );
  BrowserSpriteSymbol.prototype.constructor = BrowserSpriteSymbol;

  var prototypeAccessors = { isMounted: {} };

  prototypeAccessors.isMounted.get = function () {
    return !!this.node;
  };

  /**
   * @param {Element} node
   * @return {BrowserSpriteSymbol}
   */
  BrowserSpriteSymbol.createFromExistingNode = function createFromExistingNode (node) {
    return new BrowserSpriteSymbol({
      id: node.getAttribute('id'),
      viewBox: node.getAttribute('viewBox'),
      content: node.outerHTML
    });
  };

  BrowserSpriteSymbol.prototype.destroy = function destroy () {
    if (this.isMounted) {
      this.unmount();
    }
    SpriteSymbol$$1.prototype.destroy.call(this);
  };

  /**
   * @param {Element|string} target
   * @return {Element}
   */
  BrowserSpriteSymbol.prototype.mount = function mount (target) {
    if (this.isMounted) {
      return this.node;
    }

    var mountTarget = typeof target === 'string' ? document.querySelector(target) : target;
    var node = this.render();
    this.node = node;

    mountTarget.appendChild(node);

    return node;
  };

  /**
   * @return {Element}
   */
  BrowserSpriteSymbol.prototype.render = function render () {
    var content = this.stringify();
    return parse(wrapInSvgString(content)).childNodes[0];
  };

  BrowserSpriteSymbol.prototype.unmount = function unmount () {
    this.node.parentNode.removeChild(this.node);
  };

  Object.defineProperties( BrowserSpriteSymbol.prototype, prototypeAccessors );

  return BrowserSpriteSymbol;
}(SpriteSymbol));

var defaultConfig$1 = {
  /**
   * Should following options be automatically configured:
   * - `syncUrlsWithBaseTag`
   * - `locationChangeAngularEmitter`
   * - `moveGradientsOutsideSymbol`
   * @type {boolean}
   */
  autoConfigure: true,

  /**
   * Default mounting selector
   * @type {string}
   */
  mountTo: 'body',

  /**
   * Fix disappearing SVG elements when <base href> exists.
   * Executes when sprite mounted.
   * @see http://stackoverflow.com/a/18265336/796152
   * @see https://github.com/everdimension/angular-svg-base-fix
   * @see https://github.com/angular/angular.js/issues/8934#issuecomment-56568466
   * @type {boolean}
   */
  syncUrlsWithBaseTag: false,

  /**
   * Should sprite listen custom location change event
   * @type {boolean}
   */
  listenLocationChangeEvent: true,

  /**
   * Custom window event name which should be emitted to update sprite urls
   * @type {string}
   */
  locationChangeEvent: 'locationChange',

  /**
   * Emit location change event in Angular automatically
   * @type {boolean}
   */
  locationChangeAngularEmitter: false,

  /**
   * Selector to find symbols usages when updating sprite urls
   * @type {string}
   */
  usagesToUpdate: 'use[*|href]',

  /**
   * Fix Firefox bug when gradients and patterns don't work if they are within a symbol.
   * Executes when sprite is rendered, but not mounted.
   * @see https://bugzilla.mozilla.org/show_bug.cgi?id=306674
   * @see https://bugzilla.mozilla.org/show_bug.cgi?id=353575
   * @see https://bugzilla.mozilla.org/show_bug.cgi?id=1235364
   * @type {boolean}
   */
  moveGradientsOutsideSymbol: false
};

/**
 * @param {*} arrayLike
 * @return {Array}
 */
var arrayFrom = function (arrayLike) {
  return Array.prototype.slice.call(arrayLike, 0);
};

var browser = {
  isChrome: function () { return /chrome/i.test(navigator.userAgent); },
  isFirefox: function () { return /firefox/i.test(navigator.userAgent); },

  // https://msdn.microsoft.com/en-us/library/ms537503(v=vs.85).aspx
  isIE: function () { return /msie/i.test(navigator.userAgent) || /trident/i.test(navigator.userAgent); },
  isEdge: function () { return /edge/i.test(navigator.userAgent); }
};

/**
 * @param {string} name
 * @param {*} data
 */
var dispatchEvent = function (name, data) {
  var event = document.createEvent('CustomEvent');
  event.initCustomEvent(name, false, false, data);
  window.dispatchEvent(event);
};

/**
 * IE doesn't evaluate <style> tags in SVGs that are dynamically added to the page.
 * This trick will trigger IE to read and use any existing SVG <style> tags.
 * @see https://github.com/iconic/SVGInjector/issues/23
 * @see https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/10898469/
 *
 * @param {Element} node DOM Element to search <style> tags in
 * @return {Array<HTMLStyleElement>}
 */
var evalStylesIEWorkaround = function (node) {
  var updatedNodes = [];

  arrayFrom(node.querySelectorAll('style'))
    .forEach(function (style) {
      style.textContent += '';
      updatedNodes.push(style);
    });

  return updatedNodes;
};

/**
 * @param {string} [url] If not provided - current URL will be used
 * @return {string}
 */
var getUrlWithoutFragment = function (url) {
  return (url || window.location.href).split('#')[0];
};

/* global angular */
/**
 * @param {string} eventName
 */
var locationChangeAngularEmitter = function (eventName) {
  angular.module('ng').run(['$rootScope', function ($rootScope) {
    $rootScope.$on('$locationChangeSuccess', function (e, newUrl, oldUrl) {
      dispatchEvent(eventName, { oldUrl: oldUrl, newUrl: newUrl });
    });
  }]);
};

var defaultSelector = 'linearGradient, radialGradient, pattern, mask, clipPath';

/**
 * @param {Element} svg
 * @param {string} [selector]
 * @return {Element}
 */
var moveGradientsOutsideSymbol = function (svg, selector) {
  if ( selector === void 0 ) selector = defaultSelector;

  arrayFrom(svg.querySelectorAll('symbol')).forEach(function (symbol) {
    arrayFrom(symbol.querySelectorAll(selector)).forEach(function (node) {
      symbol.parentNode.insertBefore(node, symbol);
    });
  });
  return svg;
};

/**
 * @param {NodeList} nodes
 * @param {Function} [matcher]
 * @return {Attr[]}
 */
function selectAttributes(nodes, matcher) {
  var attrs = arrayFrom(nodes).reduce(function (acc, node) {
    if (!node.attributes) {
      return acc;
    }

    var arrayfied = arrayFrom(node.attributes);
    var matched = matcher ? arrayfied.filter(matcher) : arrayfied;
    return acc.concat(matched);
  }, []);

  return attrs;
}

/**
 * @param {NodeList|Node} nodes
 * @param {boolean} [clone=true]
 * @return {string}
 */

var xLinkNS = namespaces_1.xlink.uri;
var xLinkAttrName = 'xlink:href';

// eslint-disable-next-line no-useless-escape
var specialUrlCharsPattern = /[{}|\\\^\[\]`"<>]/g;

function encoder(url) {
  return url.replace(specialUrlCharsPattern, function (match) {
    return ("%" + (match[0].charCodeAt(0).toString(16).toUpperCase()));
  });
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

/**
 * @param {NodeList} nodes
 * @param {string} startsWith
 * @param {string} replaceWith
 * @return {NodeList}
 */
function updateReferences(nodes, startsWith, replaceWith) {
  arrayFrom(nodes).forEach(function (node) {
    var href = node.getAttribute(xLinkAttrName);
    if (href && href.indexOf(startsWith) === 0) {
      var newUrl = href.replace(startsWith, replaceWith);
      node.setAttributeNS(xLinkNS, xLinkAttrName, newUrl);
    }
  });

  return nodes;
}

/**
 * List of SVG attributes to update url() target in them
 */
var attList = [
  'clipPath',
  'colorProfile',
  'src',
  'cursor',
  'fill',
  'filter',
  'marker',
  'markerStart',
  'markerMid',
  'markerEnd',
  'mask',
  'stroke',
  'style'
];

var attSelector = attList.map(function (attr) { return ("[" + attr + "]"); }).join(',');

/**
 * Update URLs in svg image (like `fill="url(...)"`) and update referencing elements
 * @param {Element} svg
 * @param {NodeList} references
 * @param {string|RegExp} startsWith
 * @param {string} replaceWith
 * @return {void}
 *
 * @example
 * const sprite = document.querySelector('svg.sprite');
 * const usages = document.querySelectorAll('use');
 * updateUrls(sprite, usages, '#', 'prefix#');
 */
var updateUrls = function (svg, references, startsWith, replaceWith) {
  var startsWithEncoded = encoder(startsWith);
  var replaceWithEncoded = encoder(replaceWith);

  var nodes = svg.querySelectorAll(attSelector);
  var attrs = selectAttributes(nodes, function (ref) {
    var localName = ref.localName;
    var value = ref.value;

    return attList.indexOf(localName) !== -1 && value.indexOf(("url(" + startsWithEncoded)) !== -1;
  });

  attrs.forEach(function (attr) { return attr.value = attr.value.replace(new RegExp(escapeRegExp(startsWithEncoded), 'g'), replaceWithEncoded); });
  updateReferences(references, startsWithEncoded, replaceWithEncoded);
};

/**
 * Internal emitter events
 * @enum
 * @private
 */
var Events = {
  MOUNT: 'mount',
  SYMBOL_MOUNT: 'symbol_mount'
};

var BrowserSprite = (function (Sprite$$1) {
  function BrowserSprite(cfg) {
    var this$1 = this;
    if ( cfg === void 0 ) cfg = {};

    Sprite$$1.call(this, deepmerge(defaultConfig$1, cfg));

    var emitter = mitt();
    this._emitter = emitter;
    this.node = null;

    var ref = this;
    var config = ref.config;

    if (config.autoConfigure) {
      this._autoConfigure(cfg);
    }

    if (config.syncUrlsWithBaseTag) {
      var baseUrl = document.getElementsByTagName('base')[0].getAttribute('href');
      emitter.on(Events.MOUNT, function () { return this$1.updateUrls('#', baseUrl); });
    }

    var handleLocationChange = this._handleLocationChange.bind(this);
    this._handleLocationChange = handleLocationChange;

    // Provide way to update sprite urls externally via dispatching custom window event
    if (config.listenLocationChangeEvent) {
      window.addEventListener(config.locationChangeEvent, handleLocationChange);
    }

    // Emit location change event in Angular automatically
    if (config.locationChangeAngularEmitter) {
      locationChangeAngularEmitter(config.locationChangeEvent);
    }

    // After sprite mounted
    emitter.on(Events.MOUNT, function (spriteNode) {
      if (config.moveGradientsOutsideSymbol) {
        moveGradientsOutsideSymbol(spriteNode);
      }
    });

    // After symbol mounted into sprite
    emitter.on(Events.SYMBOL_MOUNT, function (symbolNode) {
      if (config.moveGradientsOutsideSymbol) {
        moveGradientsOutsideSymbol(symbolNode.parentNode);
      }

      if (browser.isIE() || browser.isEdge()) {
        evalStylesIEWorkaround(symbolNode);
      }
    });
  }

  if ( Sprite$$1 ) BrowserSprite.__proto__ = Sprite$$1;
  BrowserSprite.prototype = Object.create( Sprite$$1 && Sprite$$1.prototype );
  BrowserSprite.prototype.constructor = BrowserSprite;

  var prototypeAccessors = { isMounted: {} };

  /**
   * @return {boolean}
   */
  prototypeAccessors.isMounted.get = function () {
    return !!this.node;
  };

  /**
   * Automatically configure following options
   * - `syncUrlsWithBaseTag`
   * - `locationChangeAngularEmitter`
   * - `moveGradientsOutsideSymbol`
   * @param {Object} cfg
   * @private
   */
  BrowserSprite.prototype._autoConfigure = function _autoConfigure (cfg) {
    var ref = this;
    var config = ref.config;

    if (typeof cfg.syncUrlsWithBaseTag === 'undefined') {
      config.syncUrlsWithBaseTag = typeof document.getElementsByTagName('base')[0] !== 'undefined';
    }

    if (typeof cfg.locationChangeAngularEmitter === 'undefined') {
        config.locationChangeAngularEmitter = typeof window.angular !== 'undefined';
    }

    if (typeof cfg.moveGradientsOutsideSymbol === 'undefined') {
      config.moveGradientsOutsideSymbol = browser.isFirefox();
    }
  };

  /**
   * @param {Event} event
   * @param {Object} event.detail
   * @param {string} event.detail.oldUrl
   * @param {string} event.detail.newUrl
   * @private
   */
  BrowserSprite.prototype._handleLocationChange = function _handleLocationChange (event) {
    var ref = event.detail;
    var oldUrl = ref.oldUrl;
    var newUrl = ref.newUrl;
    this.updateUrls(oldUrl, newUrl);
  };

  /**
   * Add new symbol. If symbol with the same id exists it will be replaced.
   * If sprite already mounted - `symbol.mount(sprite.node)` will be called.
   * @fires Events#SYMBOL_MOUNT
   * @param {BrowserSpriteSymbol} symbol
   * @return {boolean} `true` - symbol was added, `false` - replaced
   */
  BrowserSprite.prototype.add = function add (symbol) {
    var sprite = this;
    var isNewSymbol = Sprite$$1.prototype.add.call(this, symbol);

    if (this.isMounted && isNewSymbol) {
      symbol.mount(sprite.node);
      this._emitter.emit(Events.SYMBOL_MOUNT, symbol.node);
    }

    return isNewSymbol;
  };

  /**
   * Attach to existing DOM node
   * @param {string|Element} target
   * @return {Element|null} attached DOM Element. null if node to attach not found.
   */
  BrowserSprite.prototype.attach = function attach (target) {
    var this$1 = this;

    var sprite = this;

    if (sprite.isMounted) {
      return sprite.node;
    }

    /** @type Element */
    var node = typeof target === 'string' ? document.querySelector(target) : target;
    sprite.node = node;

    // Already added symbols needs to be mounted
    this.symbols.forEach(function (symbol) {
      symbol.mount(sprite.node);
      this$1._emitter.emit(Events.SYMBOL_MOUNT, symbol.node);
    });

    // Create symbols from existing DOM nodes, add and mount them
    arrayFrom(node.querySelectorAll('symbol'))
      .forEach(function (symbolNode) {
        var symbol = BrowserSpriteSymbol.createFromExistingNode(symbolNode);
        symbol.node = symbolNode; // hack to prevent symbol mounting to sprite when adding
        sprite.add(symbol);
      });

    this._emitter.emit(Events.MOUNT, node);

    return node;
  };

  BrowserSprite.prototype.destroy = function destroy () {
    var ref = this;
    var config = ref.config;
    var symbols = ref.symbols;
    var _emitter = ref._emitter;

    symbols.forEach(function (s) { return s.destroy(); });

    _emitter.off('*');
    window.removeEventListener(config.locationChangeEvent, this._handleLocationChange);

    if (this.isMounted) {
      this.unmount();
    }
  };

  /**
   * @fires Events#MOUNT
   * @param {string|Element} [target]
   * @param {boolean} [prepend=false]
   * @return {Element|null} rendered sprite node. null if mount node not found.
   */
  BrowserSprite.prototype.mount = function mount (target, prepend) {
    if ( target === void 0 ) target = this.config.mountTo;
    if ( prepend === void 0 ) prepend = false;

    var sprite = this;

    if (sprite.isMounted) {
      return sprite.node;
    }

    var mountNode = typeof target === 'string' ? document.querySelector(target) : target;
    var node = sprite.render();
    this.node = node;

    if (prepend && mountNode.childNodes[0]) {
      mountNode.insertBefore(node, mountNode.childNodes[0]);
    } else {
      mountNode.appendChild(node);
    }

    this._emitter.emit(Events.MOUNT, node);

    return node;
  };

  /**
   * @return {Element}
   */
  BrowserSprite.prototype.render = function render () {
    return parse(this.stringify());
  };

  /**
   * Detach sprite from the DOM
   */
  BrowserSprite.prototype.unmount = function unmount () {
    this.node.parentNode.removeChild(this.node);
  };

  /**
   * Update URLs in sprite and usage elements
   * @param {string} oldUrl
   * @param {string} newUrl
   * @return {boolean} `true` - URLs was updated, `false` - sprite is not mounted
   */
  BrowserSprite.prototype.updateUrls = function updateUrls$1 (oldUrl, newUrl) {
    if (!this.isMounted) {
      return false;
    }

    var usages = document.querySelectorAll(this.config.usagesToUpdate);

    updateUrls(
      this.node,
      usages,
      ((getUrlWithoutFragment(oldUrl)) + "#"),
      ((getUrlWithoutFragment(newUrl)) + "#")
    );

    return true;
  };

  Object.defineProperties( BrowserSprite.prototype, prototypeAccessors );

  return BrowserSprite;
}(Sprite));

var ready$1 = createCommonjsModule(function (module) {
/*!
  * domready (c) Dustin Diaz 2014 - License MIT
  */
!function (name, definition) {

  { module.exports = definition(); }

}('domready', function () {

  var fns = [], listener
    , doc = document
    , hack = doc.documentElement.doScroll
    , domContentLoaded = 'DOMContentLoaded'
    , loaded = (hack ? /^loaded|^c/ : /^loaded|^i|^c/).test(doc.readyState);


  if (!loaded)
  { doc.addEventListener(domContentLoaded, listener = function () {
    doc.removeEventListener(domContentLoaded, listener);
    loaded = 1;
    while (listener = fns.shift()) { listener(); }
  }); }

  return function (fn) {
    loaded ? setTimeout(fn, 0) : fns.push(fn);
  }

});
});

var spriteNodeId = '__SVG_SPRITE_NODE__';
var spriteGlobalVarName = '__SVG_SPRITE__';
var isSpriteExists = !!window[spriteGlobalVarName];

// eslint-disable-next-line import/no-mutable-exports
var sprite;

if (isSpriteExists) {
  sprite = window[spriteGlobalVarName];
} else {
  sprite = new BrowserSprite({
    attrs: {
      id: spriteNodeId,
      'aria-hidden': 'true'
    }
  });
  window[spriteGlobalVarName] = sprite;
}

var loadSprite = function () {
  /**
   * Check for page already contains sprite node
   * If found - attach to and reuse it's content
   * If not - render and mount the new sprite
   */
  var existing = document.getElementById(spriteNodeId);

  if (existing) {
    sprite.attach(existing);
  } else {
    sprite.mount(document.body, true);
  }
};

if (document.body) {
  loadSprite();
} else {
  ready$1(loadSprite);
}

var sprite$1 = sprite;

return sprite$1;

})));


/***/ }),

/***/ 6959:
/***/ (function(__unused_webpack_module, exports) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
// runtime helper for setting properties on components
// in a tree-shakable way
exports.Z = (sfc, props) => {
    const target = sfc.__vccOpts || sfc;
    for (const [key, val] of props) {
        target[key] = val;
    }
    return target;
};


/***/ }),

/***/ 6432:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "__esModule": function() { return /* reexport */ ArticleNavvue_type_script_lang_js/* __esModule */.X; },
  "default": function() { return /* binding */ ArticleNav; }
});

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/templateLoader.js??ruleSet[1].rules[2]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/ArticleNav.vue?vue&type=template&id=67b8eede
var ArticleNavvue_type_template_id_67b8eede = __webpack_require__(1890);
;// CONCATENATED MODULE: ./_components/ArticleNav.vue?vue&type=template&id=67b8eede

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/ArticleNav.vue?vue&type=script&lang=js
var ArticleNavvue_type_script_lang_js = __webpack_require__(1259);
;// CONCATENATED MODULE: ./_components/ArticleNav.vue?vue&type=script&lang=js
 
// EXTERNAL MODULE: ../node_modules/vue-loader/dist/exportHelper.js
var exportHelper = __webpack_require__(6959);
;// CONCATENATED MODULE: ./_components/ArticleNav.vue




;
const __exports__ = /*#__PURE__*/(0,exportHelper/* default */.Z)(ArticleNavvue_type_script_lang_js/* default */.Z, [['render',ArticleNavvue_type_template_id_67b8eede/* render */.s]])

/* harmony default export */ var ArticleNav = (__exports__);

/***/ }),

/***/ 8314:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "__esModule": function() { return /* reexport */ Footervue_type_script_lang_js/* __esModule */.X; },
  "default": function() { return /* binding */ Footer; }
});

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/templateLoader.js??ruleSet[1].rules[2]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/Footer.vue?vue&type=template&id=71f3137b
var Footervue_type_template_id_71f3137b = __webpack_require__(963);
;// CONCATENATED MODULE: ./_components/Footer.vue?vue&type=template&id=71f3137b

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/Footer.vue?vue&type=script&lang=js
var Footervue_type_script_lang_js = __webpack_require__(1622);
;// CONCATENATED MODULE: ./_components/Footer.vue?vue&type=script&lang=js
 
// EXTERNAL MODULE: ../node_modules/vue-loader/dist/exportHelper.js
var exportHelper = __webpack_require__(6959);
;// CONCATENATED MODULE: ./_components/Footer.vue




;
const __exports__ = /*#__PURE__*/(0,exportHelper/* default */.Z)(Footervue_type_script_lang_js/* default */.Z, [['render',Footervue_type_template_id_71f3137b/* render */.s]])

/* harmony default export */ var Footer = (__exports__);

/***/ }),

/***/ 5438:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "__esModule": function() { return /* reexport */ Headervue_type_script_lang_js/* __esModule */.X; },
  "default": function() { return /* binding */ Header; }
});

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/templateLoader.js??ruleSet[1].rules[2]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/Header.vue?vue&type=template&id=1df0932b
var Headervue_type_template_id_1df0932b = __webpack_require__(8290);
;// CONCATENATED MODULE: ./_components/Header.vue?vue&type=template&id=1df0932b

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/Header.vue?vue&type=script&lang=js
var Headervue_type_script_lang_js = __webpack_require__(3439);
;// CONCATENATED MODULE: ./_components/Header.vue?vue&type=script&lang=js
 
// EXTERNAL MODULE: ../node_modules/vue-loader/dist/exportHelper.js
var exportHelper = __webpack_require__(6959);
;// CONCATENATED MODULE: ./_components/Header.vue




;
const __exports__ = /*#__PURE__*/(0,exportHelper/* default */.Z)(Headervue_type_script_lang_js/* default */.Z, [['render',Headervue_type_template_id_1df0932b/* render */.s]])

/* harmony default export */ var Header = (__exports__);

/***/ }),

/***/ 163:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "__esModule": function() { return /* reexport */ KvNavvue_type_script_lang_js/* __esModule */.X; },
  "default": function() { return /* binding */ KvNav; }
});

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/templateLoader.js??ruleSet[1].rules[2]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/KvNav.vue?vue&type=template&id=00cf858c
var KvNavvue_type_template_id_00cf858c = __webpack_require__(9519);
;// CONCATENATED MODULE: ./_components/KvNav.vue?vue&type=template&id=00cf858c

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/KvNav.vue?vue&type=script&lang=js
var KvNavvue_type_script_lang_js = __webpack_require__(81);
;// CONCATENATED MODULE: ./_components/KvNav.vue?vue&type=script&lang=js
 
// EXTERNAL MODULE: ../node_modules/vue-loader/dist/exportHelper.js
var exportHelper = __webpack_require__(6959);
;// CONCATENATED MODULE: ./_components/KvNav.vue




;
const __exports__ = /*#__PURE__*/(0,exportHelper/* default */.Z)(KvNavvue_type_script_lang_js/* default */.Z, [['render',KvNavvue_type_template_id_00cf858c/* render */.s]])

/* harmony default export */ var KvNav = (__exports__);

/***/ }),

/***/ 3375:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "__esModule": function() { return /* reexport */ MenuNavvue_type_script_lang_js/* __esModule */.X; },
  "default": function() { return /* binding */ MenuNav; }
});

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/templateLoader.js??ruleSet[1].rules[2]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/MenuNav.vue?vue&type=template&id=1396ae59
var MenuNavvue_type_template_id_1396ae59 = __webpack_require__(1354);
;// CONCATENATED MODULE: ./_components/MenuNav.vue?vue&type=template&id=1396ae59

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/MenuNav.vue?vue&type=script&lang=js
var MenuNavvue_type_script_lang_js = __webpack_require__(132);
;// CONCATENATED MODULE: ./_components/MenuNav.vue?vue&type=script&lang=js
 
// EXTERNAL MODULE: ../node_modules/vue-loader/dist/exportHelper.js
var exportHelper = __webpack_require__(6959);
;// CONCATENATED MODULE: ./_components/MenuNav.vue




;
const __exports__ = /*#__PURE__*/(0,exportHelper/* default */.Z)(MenuNavvue_type_script_lang_js/* default */.Z, [['render',MenuNavvue_type_template_id_1396ae59/* render */.s]])

/* harmony default export */ var MenuNav = (__exports__);

/***/ }),

/***/ 1141:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "__esModule": function() { return /* reexport */ Navvue_type_script_lang_js/* __esModule */.X; },
  "default": function() { return /* binding */ Nav; }
});

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/templateLoader.js??ruleSet[1].rules[2]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/Nav.vue?vue&type=template&id=5c9778d2
var Navvue_type_template_id_5c9778d2 = __webpack_require__(6160);
;// CONCATENATED MODULE: ./_components/Nav.vue?vue&type=template&id=5c9778d2

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/Nav.vue?vue&type=script&lang=js
var Navvue_type_script_lang_js = __webpack_require__(4569);
;// CONCATENATED MODULE: ./_components/Nav.vue?vue&type=script&lang=js
 
// EXTERNAL MODULE: ../node_modules/vue-loader/dist/exportHelper.js
var exportHelper = __webpack_require__(6959);
;// CONCATENATED MODULE: ./_components/Nav.vue




;
const __exports__ = /*#__PURE__*/(0,exportHelper/* default */.Z)(Navvue_type_script_lang_js/* default */.Z, [['render',Navvue_type_template_id_5c9778d2/* render */.s]])

/* harmony default export */ var Nav = (__exports__);

/***/ }),

/***/ 1798:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "__esModule": function() { return /* reexport */ Svgvue_type_script_lang_js/* __esModule */.X; },
  "default": function() { return /* binding */ Svg; }
});

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/templateLoader.js??ruleSet[1].rules[2]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/Svg.vue?vue&type=template&id=006cb8a8
var Svgvue_type_template_id_006cb8a8 = __webpack_require__(8875);
;// CONCATENATED MODULE: ./_components/Svg.vue?vue&type=template&id=006cb8a8

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/Svg.vue?vue&type=script&lang=js
var Svgvue_type_script_lang_js = __webpack_require__(9461);
;// CONCATENATED MODULE: ./_components/Svg.vue?vue&type=script&lang=js
 
// EXTERNAL MODULE: ../node_modules/vue-loader/dist/exportHelper.js
var exportHelper = __webpack_require__(6959);
;// CONCATENATED MODULE: ./_components/Svg.vue




;
const __exports__ = /*#__PURE__*/(0,exportHelper/* default */.Z)(Svgvue_type_script_lang_js/* default */.Z, [['render',Svgvue_type_template_id_006cb8a8/* render */.s]])

/* harmony default export */ var Svg = (__exports__);

/***/ }),

/***/ 8667:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "__esModule": function() { return /* reexport */ ToolsNavvue_type_script_lang_js/* __esModule */.X; },
  "default": function() { return /* binding */ ToolsNav; }
});

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/templateLoader.js??ruleSet[1].rules[2]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/ToolsNav.vue?vue&type=template&id=2ee718e4
var ToolsNavvue_type_template_id_2ee718e4 = __webpack_require__(5839);
;// CONCATENATED MODULE: ./_components/ToolsNav.vue?vue&type=template&id=2ee718e4

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/ToolsNav.vue?vue&type=script&lang=js
var ToolsNavvue_type_script_lang_js = __webpack_require__(1496);
;// CONCATENATED MODULE: ./_components/ToolsNav.vue?vue&type=script&lang=js
 
// EXTERNAL MODULE: ../node_modules/vue-loader/dist/exportHelper.js
var exportHelper = __webpack_require__(6959);
;// CONCATENATED MODULE: ./_components/ToolsNav.vue




;
const __exports__ = /*#__PURE__*/(0,exportHelper/* default */.Z)(ToolsNavvue_type_script_lang_js/* default */.Z, [['render',ToolsNavvue_type_template_id_2ee718e4/* render */.s]])

/* harmony default export */ var ToolsNav = (__exports__);

/***/ }),

/***/ 6454:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "__esModule": function() { return /* reexport */ mArticlevue_type_script_lang_js/* __esModule */.X; },
  "default": function() { return /* binding */ mArticle; }
});

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/templateLoader.js??ruleSet[1].rules[2]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/_modules/mArticle.vue?vue&type=template&id=e4949c76
var mArticlevue_type_template_id_e4949c76 = __webpack_require__(2617);
;// CONCATENATED MODULE: ./_components/_modules/mArticle.vue?vue&type=template&id=e4949c76

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/_modules/mArticle.vue?vue&type=script&lang=js
var mArticlevue_type_script_lang_js = __webpack_require__(1341);
;// CONCATENATED MODULE: ./_components/_modules/mArticle.vue?vue&type=script&lang=js
 
// EXTERNAL MODULE: ../node_modules/vue-loader/dist/exportHelper.js
var exportHelper = __webpack_require__(6959);
;// CONCATENATED MODULE: ./_components/_modules/mArticle.vue




;
const __exports__ = /*#__PURE__*/(0,exportHelper/* default */.Z)(mArticlevue_type_script_lang_js/* default */.Z, [['render',mArticlevue_type_template_id_e4949c76/* render */.s]])

/* harmony default export */ var mArticle = (__exports__);

/***/ }),

/***/ 1693:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "__esModule": function() { return /* reexport */ mBreadCrumbsvue_type_script_lang_js/* __esModule */.X; },
  "default": function() { return /* binding */ mBreadCrumbs; }
});

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/templateLoader.js??ruleSet[1].rules[2]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/_modules/mBreadCrumbs.vue?vue&type=template&id=2de498aa
var mBreadCrumbsvue_type_template_id_2de498aa = __webpack_require__(8893);
;// CONCATENATED MODULE: ./_components/_modules/mBreadCrumbs.vue?vue&type=template&id=2de498aa

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/_modules/mBreadCrumbs.vue?vue&type=script&lang=js
var mBreadCrumbsvue_type_script_lang_js = __webpack_require__(5083);
;// CONCATENATED MODULE: ./_components/_modules/mBreadCrumbs.vue?vue&type=script&lang=js
 
// EXTERNAL MODULE: ../node_modules/vue-loader/dist/exportHelper.js
var exportHelper = __webpack_require__(6959);
;// CONCATENATED MODULE: ./_components/_modules/mBreadCrumbs.vue




;
const __exports__ = /*#__PURE__*/(0,exportHelper/* default */.Z)(mBreadCrumbsvue_type_script_lang_js/* default */.Z, [['render',mBreadCrumbsvue_type_template_id_2de498aa/* render */.s]])

/* harmony default export */ var mBreadCrumbs = (__exports__);

/***/ }),

/***/ 4145:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "__esModule": function() { return /* reexport */ mMenuvue_type_script_lang_js/* __esModule */.X; },
  "default": function() { return /* binding */ mMenu; }
});

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/templateLoader.js??ruleSet[1].rules[2]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/_modules/mMenu.vue?vue&type=template&id=7a42fb7c
var mMenuvue_type_template_id_7a42fb7c = __webpack_require__(6727);
;// CONCATENATED MODULE: ./_components/_modules/mMenu.vue?vue&type=template&id=7a42fb7c

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/_modules/mMenu.vue?vue&type=script&lang=js
var mMenuvue_type_script_lang_js = __webpack_require__(2873);
;// CONCATENATED MODULE: ./_components/_modules/mMenu.vue?vue&type=script&lang=js
 
// EXTERNAL MODULE: ../node_modules/vue-loader/dist/exportHelper.js
var exportHelper = __webpack_require__(6959);
;// CONCATENATED MODULE: ./_components/_modules/mMenu.vue




;
const __exports__ = /*#__PURE__*/(0,exportHelper/* default */.Z)(mMenuvue_type_script_lang_js/* default */.Z, [['render',mMenuvue_type_template_id_7a42fb7c/* render */.s]])

/* harmony default export */ var mMenu = (__exports__);

/***/ }),

/***/ 8747:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "__esModule": function() { return /* reexport */ mTitlevue_type_script_lang_js/* __esModule */.X; },
  "default": function() { return /* binding */ mTitle; }
});

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/templateLoader.js??ruleSet[1].rules[2]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/_modules/mTitle.vue?vue&type=template&id=a668c94c
var mTitlevue_type_template_id_a668c94c = __webpack_require__(3387);
;// CONCATENATED MODULE: ./_components/_modules/mTitle.vue?vue&type=template&id=a668c94c

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/_modules/mTitle.vue?vue&type=script&lang=js
var mTitlevue_type_script_lang_js = __webpack_require__(6404);
;// CONCATENATED MODULE: ./_components/_modules/mTitle.vue?vue&type=script&lang=js
 
// EXTERNAL MODULE: ../node_modules/vue-loader/dist/exportHelper.js
var exportHelper = __webpack_require__(6959);
;// CONCATENATED MODULE: ./_components/_modules/mTitle.vue




;
const __exports__ = /*#__PURE__*/(0,exportHelper/* default */.Z)(mTitlevue_type_script_lang_js/* default */.Z, [['render',mTitlevue_type_template_id_a668c94c/* render */.s]])

/* harmony default export */ var mTitle = (__exports__);

/***/ }),

/***/ 8394:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "__esModule": function() { return /* reexport */ mToolsvue_type_script_lang_js/* __esModule */.X; },
  "default": function() { return /* binding */ mTools; }
});

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/templateLoader.js??ruleSet[1].rules[2]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/_modules/mTools.vue?vue&type=template&id=1619b7bc
var mToolsvue_type_template_id_1619b7bc = __webpack_require__(8218);
;// CONCATENATED MODULE: ./_components/_modules/mTools.vue?vue&type=template&id=1619b7bc

// EXTERNAL MODULE: ../node_modules/babel-loader/lib/index.js??clonedRuleSet-2.use[0]!../node_modules/vue-loader/dist/index.js??ruleSet[1].rules[12].use[0]!./_components/_modules/mTools.vue?vue&type=script&lang=js
var mToolsvue_type_script_lang_js = __webpack_require__(9159);
;// CONCATENATED MODULE: ./_components/_modules/mTools.vue?vue&type=script&lang=js
 
// EXTERNAL MODULE: ../node_modules/vue-loader/dist/exportHelper.js
var exportHelper = __webpack_require__(6959);
;// CONCATENATED MODULE: ./_components/_modules/mTools.vue




;
const __exports__ = /*#__PURE__*/(0,exportHelper/* default */.Z)(mToolsvue_type_script_lang_js/* default */.Z, [['render',mToolsvue_type_template_id_1619b7bc/* render */.s]])

/* harmony default export */ var mTools = (__exports__);

/***/ }),

/***/ 339:
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

var map = {
	"./arrow_nav.svg": 3998,
	"./chevron.svg": 7963,
	"./fb.svg": 4420,
	"./ig.svg": 2001,
	"./logo.svg": 7625,
	"./logo_en.svg": 5307,
	"./logo_footer.svg": 9397,
	"./logo_large.svg": 2685,
	"./logo_large_en.svg": 2763,
	"./logo_mobile.svg": 9858,
	"./minus.svg": 2801,
	"./plus.svg": 4101,
	"./search.svg": 4432,
	"./yt.svg": 5574,
	"_svg/arrow_nav.svg": 3998,
	"_svg/chevron.svg": 7963,
	"_svg/fb.svg": 4420,
	"_svg/ig.svg": 2001,
	"_svg/logo.svg": 7625,
	"_svg/logo_en.svg": 5307,
	"_svg/logo_footer.svg": 9397,
	"_svg/logo_large.svg": 2685,
	"_svg/logo_large_en.svg": 2763,
	"_svg/logo_mobile.svg": 9858,
	"_svg/minus.svg": 2801,
	"_svg/plus.svg": 4101,
	"_svg/search.svg": 4432,
	"_svg/yt.svg": 5574,
	"arrow_nav.svg": 3998,
	"chevron.svg": 7963,
	"fb.svg": 4420,
	"ig.svg": 2001,
	"logo.svg": 7625,
	"logo_en.svg": 5307,
	"logo_footer.svg": 9397,
	"logo_large.svg": 2685,
	"logo_large_en.svg": 2763,
	"logo_mobile.svg": 9858,
	"minus.svg": 2801,
	"plus.svg": 4101,
	"search.svg": 4432,
	"yt.svg": 5574
};


function webpackContext(req) {
	var id = webpackContextResolve(req);
	return __webpack_require__(id);
}
function webpackContextResolve(req) {
	if(!__webpack_require__.o(map, req)) {
		var e = new Error("Cannot find module '" + req + "'");
		e.code = 'MODULE_NOT_FOUND';
		throw e;
	}
	return map[req];
}
webpackContext.keys = function webpackContextKeys() {
	return Object.keys(map);
};
webpackContext.resolve = webpackContextResolve;
module.exports = webpackContext;
webpackContext.id = 339;

/***/ }),

/***/ 9843:
/***/ (function(module) {

"use strict";
module.exports = JSON.parse('{"_from":"axios","_id":"axios@0.21.4","_inBundle":false,"_integrity":"sha512-ut5vewkiu8jjGBdqpM44XxjuCjq9LAKeHVmoVfHVzy8eHgxxq8SbAVQNovDA8mVi05kP0Ea/n/UzcSHcTJQfNg==","_location":"/axios","_phantomChildren":{},"_requested":{"type":"tag","registry":true,"raw":"axios","name":"axios","escapedName":"axios","rawSpec":"","saveSpec":null,"fetchSpec":"latest"},"_requiredBy":["#USER","/"],"_resolved":"https://registry.npmjs.org/axios/-/axios-0.21.4.tgz","_shasum":"c67b90dc0568e5c1cf2b0b858c43ba28e2eda575","_spec":"axios","_where":"F:\\\\Git\\\\Fu-Jen","author":{"name":"Matt Zabriskie"},"browser":{"./lib/adapters/http.js":"./lib/adapters/xhr.js"},"bugs":{"url":"https://github.com/axios/axios/issues"},"bundleDependencies":false,"bundlesize":[{"path":"./dist/axios.min.js","threshold":"5kB"}],"dependencies":{"follow-redirects":"^1.14.0"},"deprecated":false,"description":"Promise based HTTP client for the browser and node.js","devDependencies":{"coveralls":"^3.0.0","es6-promise":"^4.2.4","grunt":"^1.3.0","grunt-banner":"^0.6.0","grunt-cli":"^1.2.0","grunt-contrib-clean":"^1.1.0","grunt-contrib-watch":"^1.0.0","grunt-eslint":"^23.0.0","grunt-karma":"^4.0.0","grunt-mocha-test":"^0.13.3","grunt-ts":"^6.0.0-beta.19","grunt-webpack":"^4.0.2","istanbul-instrumenter-loader":"^1.0.0","jasmine-core":"^2.4.1","karma":"^6.3.2","karma-chrome-launcher":"^3.1.0","karma-firefox-launcher":"^2.1.0","karma-jasmine":"^1.1.1","karma-jasmine-ajax":"^0.1.13","karma-safari-launcher":"^1.0.0","karma-sauce-launcher":"^4.3.6","karma-sinon":"^1.0.5","karma-sourcemap-loader":"^0.3.8","karma-webpack":"^4.0.2","load-grunt-tasks":"^3.5.2","minimist":"^1.2.0","mocha":"^8.2.1","sinon":"^4.5.0","terser-webpack-plugin":"^4.2.3","typescript":"^4.0.5","url-search-params":"^0.10.0","webpack":"^4.44.2","webpack-dev-server":"^3.11.0"},"homepage":"https://axios-http.com","jsdelivr":"dist/axios.min.js","keywords":["xhr","http","ajax","promise","node"],"license":"MIT","main":"index.js","name":"axios","repository":{"type":"git","url":"git+https://github.com/axios/axios.git"},"scripts":{"build":"NODE_ENV=production grunt build","coveralls":"cat coverage/lcov.info | ./node_modules/coveralls/bin/coveralls.js","examples":"node ./examples/server.js","fix":"eslint --fix lib/**/*.js","postversion":"git push && git push --tags","preversion":"npm test","start":"node ./sandbox/server.js","test":"grunt test","version":"npm run build && grunt version && git add -A dist && git add CHANGELOG.md bower.json package.json"},"typings":"./index.d.ts","unpkg":"dist/axios.min.js","version":"0.21.4"}');

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	!function() {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = function(module) {
/******/ 			var getter = module && module.__esModule ?
/******/ 				function() { return module['default']; } :
/******/ 				function() { return module; };
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	!function() {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = function(exports, definition) {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/global */
/******/ 	!function() {
/******/ 		__webpack_require__.g = (function() {
/******/ 			if (typeof globalThis === 'object') return globalThis;
/******/ 			try {
/******/ 				return this || new Function('return this')();
/******/ 			} catch (e) {
/******/ 				if (typeof window === 'object') return window;
/******/ 			}
/******/ 		})();
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	!function() {
/******/ 		__webpack_require__.o = function(obj, prop) { return Object.prototype.hasOwnProperty.call(obj, prop); }
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	!function() {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = function(exports) {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	}();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be in strict mode.
!function() {
"use strict";


__webpack_require__(3941);

var _axios = __webpack_require__(5347);

var _vue = __webpack_require__(7834);

__webpack_require__(1359);

var _factory = __webpack_require__(1956);

var _ToolsNav = _interopRequireDefault(__webpack_require__(8667));

var _ArticleNav = _interopRequireDefault(__webpack_require__(6432));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// 取得選單頁內容以及選單成功
(0, _axios.apiMenupage)({
  Language: (0, _factory.language)(),
  MenuPageRouteName: (0, _factory.params)('menuPage'),
  MenuPageItemRouteName: (0, _factory.params)('menuPageId')
}).then(function (res) {
  var status = res.status,
      data = res.data;

  if (status === 200) {
    console.log(data);
    (0, _vue.createApp)(_ToolsNav.default).provide('data', data).mount('#tools');
    (0, _vue.createApp)(_ArticleNav.default).provide('data', data).mount('#article');
  }
});
}();
/******/ })()
;