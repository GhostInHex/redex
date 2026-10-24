import type { Builtin, Expr, Op, Path, Rule, Step } from "./ast.ts";

export type StepResult =
	| { readonly tag: "step"; readonly step: Step }
	| { readonly tag: "value" }
	| { readonly tag: "stuck"; readonly path: Path; readonly reason: string };

type Found =
	| { readonly tag: "value" }
	| { readonly tag: "rewrite"; readonly rule: Rule; readonly path: Path; readonly expr: Expr }
	| { readonly tag: "stuck"; readonly path: Path; readonly reason: string };

export function step(expr: Expr): StepResult {
	const found = find(expr);
	switch (found.tag) {
		case "value":
		case "stuck":
			return found;
		case "rewrite":
			return { tag: "step", step: { rule: found.rule, path: found.path, before: expr, after: found.expr } };
	}
}

export function childrenOf(e: Expr): readonly Expr[] {
	switch (e.tag) {
		case "num":
		case "bool":
		case "var":
		case "builtin":
			return [];
		case "lam":
			return [e.body];
		case "app":
			return [e.fn, e.arg];
		case "binop":
			return [e.left, e.right];
		case "cons":
			return [e.head, e.tail];
		case "if":
			return [e.cond, e.then, e.else];
		case "let":
			return [e.value, e.body];
		case "list":
			return e.items;
	}
}

const withChild = (e: Expr, i: number, child: Expr): Expr => {
	switch (e.tag) {
		case "num":
		case "bool":
		case "var":
		case "builtin":
			return e;
		case "lam":
			return { ...e, body: child };
		case "app":
			return i === 0 ? { ...e, fn: child } : { ...e, arg: child };
		case "binop":
			return i === 0 ? { ...e, left: child } : { ...e, right: child };
		case "cons":
			return i === 0 ? { ...e, head: child } : { ...e, tail: child };
		case "if":
			return i === 0 ? { ...e, cond: child } : i === 1 ? { ...e, then: child } : { ...e, else: child };
		case "let":
			return i === 0 ? { ...e, value: child } : { ...e, body: child };
		case "list":
			return { ...e, items: e.items.with(i, child) };
	}
};

const VALUE: Found = { tag: "value" };
const rewrite = (rule: Rule, expr: Expr): Found => ({ tag: "rewrite", rule, path: [], expr });
const stuck = (reason: string): Found => ({ tag: "stuck", path: [], reason });

function find(e: Expr): Found {
	switch (e.tag) {
		case "num":
		case "bool":
		case "builtin":
		case "lam":
			return VALUE;
		case "var":
			return stuck(`unbound variable ${e.name}`);
		case "list":
			return firstInChildren(e, e.items.length) ?? VALUE;
		case "app":
			return firstInChildren(e, 2) ?? apply(e.fn, e.arg);
		case "binop":
			return firstInChildren(e, 2) ?? OPS[e.op](e.left, e.right);
		case "cons":
			return firstInChildren(e, 2) ?? cons(e.head, e.tail);
		case "if":
			return firstInChildren(e, 1) ?? branch(e.cond, e.then, e.else);
		case "let":
			return firstInChildren(e, 1) ?? rewrite("let", substitute(e.body, e.name, e.value));
	}
}

const firstInChildren = (e: Expr, count: number): Found | undefined =>
	childrenOf(e)
		.slice(0, count)
		.reduce<Found | undefined>((hit, child, i) => hit ?? inChild(e, i, find(child)), undefined);

const inChild = (e: Expr, i: number, found: Found): Found | undefined => {
	switch (found.tag) {
		case "value":
			return undefined;
		case "rewrite":
			return { ...found, path: [i, ...found.path], expr: withChild(e, i, found.expr) };
		case "stuck":
			return { ...found, path: [i, ...found.path] };
	}
};

const num = (value: number): Expr => ({ tag: "num", value: value === 0 ? 0 : value });
const bool = (value: boolean): Expr => ({ tag: "bool", value });
const list = (items: readonly Expr[]): Expr => ({ tag: "list", items });
const app = (fn: Expr, arg: Expr): Expr => ({ tag: "app", fn, arg });
const call = (name: Builtin, ...args: readonly Expr[]): Expr => args.reduce(app, { tag: "builtin", name });

const ARITY: Readonly<Record<Builtin, number>> = { map: 2, filter: 2, foldl: 3, foldr: 3 };

const spineOf = (fn: Expr, args: readonly Expr[]): { readonly head: Expr; readonly args: readonly Expr[] } =>
	fn.tag === "app" ? spineOf(fn.fn, [fn.arg, ...args]) : { head: fn, args };

const kindOf = (e: Expr): string => (e.tag === "num" ? "a number" : e.tag === "bool" ? "a boolean" : "a list");

const apply = (fn: Expr, arg: Expr): Found => {
	if (fn.tag === "lam") return rewrite("beta", substitute(fn.body, fn.param, arg));
	const { head, args } = spineOf(fn, [arg]);
	if (head.tag !== "builtin") return stuck(`${kindOf(head)} is not a function`);
	if (args.length < ARITY[head.name]) return VALUE;
	const xs = args[args.length - 1];
	return xs.tag === "list" ? LIST_RULES[head.name](args.slice(0, -1), xs.items) : stuck(`${head.name} needs a list`);
};

type ListRule = (fixed: readonly Expr[], items: readonly Expr[]) => Found;

const LIST_RULES: Readonly<Record<Builtin, ListRule>> = {
	map: ([f], items) => rewrite("map", list(items.map((x) => app(f, x)))),
	filter: ([p], [x, ...rest]) => {
		if (x === undefined) return rewrite("filter-nil", list([]));
		const kept = call("filter", p, list(rest));
		return rewrite("filter-cons", { tag: "if", cond: app(p, x), then: { tag: "cons", head: x, tail: kept }, else: kept });
	},
	foldl: ([f, z], [x, ...rest]) =>
		x === undefined ? rewrite("foldl-nil", z) : rewrite("foldl-cons", call("foldl", f, app(app(f, z), x), list(rest))),
	foldr: ([f, z], [x, ...rest]) =>
		x === undefined ? rewrite("foldr-nil", z) : rewrite("foldr-cons", app(app(f, x), call("foldr", f, z, list(rest)))),
};

const floorMod = (a: number, b: number): number => {
	const r = a % b;
	return r !== 0 && r < 0 !== b < 0 ? r + b : r;
};

type Numeric = (a: number, b: number) => Found;

const arith =
	(f: (a: number, b: number) => number): Numeric =>
	(a, b) => {
		const value = f(a, b);
		return Number.isSafeInteger(value) ? rewrite("arith", num(value)) : stuck("number too large");
	};

const division =
	(f: (a: number, b: number) => number): Numeric =>
	(a, b) =>
		b === 0 ? stuck("division by zero") : arith(f)(a, b);

const compare =
	(f: (a: number, b: number) => boolean): Numeric =>
	(a, b) =>
		rewrite("compare", bool(f(a, b)));

const numeric =
	(op: Op, f: Numeric) =>
	(left: Expr, right: Expr): Found =>
		left.tag === "num" && right.tag === "num" ? f(left.value, right.value) : stuck(`"${op}" needs two numbers`);

const equals = (left: Expr, right: Expr): Found =>
	(left.tag === "num" && right.tag === "num") || (left.tag === "bool" && right.tag === "bool")
		? rewrite("compare", bool(left.value === right.value))
		: stuck(`"==" needs two numbers or two booleans`);

const OPS: Readonly<Record<Op, (left: Expr, right: Expr) => Found>> = {
	"+": numeric("+", arith((a, b) => a + b)),
	"-": numeric("-", arith((a, b) => a - b)),
	"*": numeric("*", arith((a, b) => a * b)),
	"/": numeric("/", division((a, b) => (a - floorMod(a, b)) / b)),
	"%": numeric("%", division(floorMod)),
	"==": equals,
	"<": numeric("<", compare((a, b) => a < b)),
	"<=": numeric("<=", compare((a, b) => a <= b)),
	">": numeric(">", compare((a, b) => a > b)),
	">=": numeric(">=", compare((a, b) => a >= b)),
};

const branch = (cond: Expr, then: Expr, otherwise: Expr): Found => {
	if (cond.tag !== "bool") return stuck(`"if" needs a boolean`);
	return cond.value ? rewrite("if-true", then) : rewrite("if-false", otherwise);
};

const cons = (head: Expr, tail: Expr): Found =>
	tail.tag === "list" ? rewrite("cons", list([head, ...tail.items])) : stuck(`":" needs a list on its right`);

const EMPTY: ReadonlySet<string> = new Set();
const union = (a: ReadonlySet<string>, b: ReadonlySet<string>): ReadonlySet<string> => new Set([...a, ...b]);
const without = (a: ReadonlySet<string>, name: string): ReadonlySet<string> => new Set([...a].filter((n) => n !== name));

const freeVars = (e: Expr): ReadonlySet<string> => {
	switch (e.tag) {
		case "var":
			return new Set([e.name]);
		case "lam":
			return without(freeVars(e.body), e.param);
		case "let":
			return union(freeVars(e.value), without(freeVars(e.body), e.name));
		default:
			return childrenOf(e).map(freeVars).reduce(union, EMPTY);
	}
};

const fresh = (name: string, taken: ReadonlySet<string>): string => (taken.has(name) ? fresh(`${name}'`, taken) : name);

const substitute = (body: Expr, name: string, value: Expr): Expr => {
	const free = freeVars(value);

	// Only an open program substitutes a value with a free variable. Renaming the binder keeps that variable free, so it still reports as unbound.
	const bind = (param: string, scope: Expr): readonly [string, Expr] => {
		if (param === name) return [param, scope];
		if (!free.has(param) || !freeVars(scope).has(name)) return [param, go(scope)];
		const renamed = fresh(`${param}'`, union(union(free, freeVars(scope)), new Set([name])));
		return [renamed, go(substitute(scope, param, { tag: "var", name: renamed }))];
	};

	const go = (e: Expr): Expr => {
		switch (e.tag) {
			case "num":
			case "bool":
			case "builtin":
				return e;
			case "var":
				return e.name === name ? value : e;
			case "lam": {
				const [param, scope] = bind(e.param, e.body);
				return { tag: "lam", param, body: scope };
			}
			case "let": {
				const [bound, scope] = bind(e.name, e.body);
				return { tag: "let", name: bound, value: go(e.value), body: scope };
			}
			case "app":
				return { ...e, fn: go(e.fn), arg: go(e.arg) };
			case "binop":
				return { ...e, left: go(e.left), right: go(e.right) };
			case "cons":
				return { ...e, head: go(e.head), tail: go(e.tail) };
			case "if":
				return { ...e, cond: go(e.cond), then: go(e.then), else: go(e.else) };
			case "list":
				return { ...e, items: e.items.map(go) };
		}
	};

	return go(body);
};
