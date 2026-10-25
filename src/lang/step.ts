import type { Builtin, Expr, Op, Path, Rule, Step } from "./ast.ts";

export type StepResult =
	| { readonly tag: "step"; readonly step: Step }
	| { readonly tag: "value" }
	| { readonly tag: "stuck"; readonly path: Path; readonly reason: string };

type Trail = { readonly index: number; readonly rest: Trail } | undefined;

type Found =
	| { readonly tag: "value" }
	| { readonly tag: "rewrite"; readonly rule: Rule; readonly trail: Trail; readonly expr: Expr }
	| { readonly tag: "stuck"; readonly trail: Trail; readonly reason: string };

const toPath = (trail: Trail): Path => {
	const path: number[] = [];
	for (let t = trail; t; t = t.rest) path.push(t.index);
	return path;
};

export function step(expr: Expr): StepResult {
	const found = find(expr);
	switch (found.tag) {
		case "value":
			return found;
		case "stuck":
			return { tag: "stuck", path: toPath(found.trail), reason: found.reason };
		case "rewrite":
			return { tag: "step", step: { rule: found.rule, path: toPath(found.trail), before: expr, after: found.expr } };
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
const rewrite = (rule: Rule, expr: Expr): Found => ({ tag: "rewrite", rule, trail: undefined, expr });
const stuck = (reason: string): Found => ({ tag: "stuck", trail: undefined, reason });

type FindFrame = { readonly e: Expr; readonly count: number; next: number };

const searchCount = (e: Expr): number => {
	switch (e.tag) {
		case "num":
		case "bool":
		case "var":
		case "builtin":
		case "lam":
			return 0;
		case "if":
		case "let":
			return 1;
		case "app":
		case "binop":
		case "cons":
			return 2;
		case "list":
			return e.items.length;
	}
};

const reduceAt = (e: Expr): Found => {
	switch (e.tag) {
		case "num":
		case "bool":
		case "builtin":
		case "lam":
		case "list":
			return VALUE;
		case "var":
			return stuck(`unbound variable ${e.name}`);
		case "app":
			return apply(e.fn, e.arg);
		case "binop":
			return OPS[e.op](e.left, e.right);
		case "cons":
			return cons(e.head, e.tail);
		case "if":
			return branch(e.cond, e.then, e.else);
		case "let":
			return rewrite("let", substitute(e.body, e.name, e.value));
	}
};

function find(root: Expr): Found {
	const stack: FindFrame[] = [];
	let current: Expr | undefined = root;
	let pending: Found | undefined;
	for (;;) {
		if (pending === undefined) {
			const e: Expr = current!;
			const count = searchCount(e);
			if (count === 0) {
				pending = reduceAt(e);
				current = undefined;
			} else {
				stack.push({ e, count, next: 0 });
				current = childrenOf(e)[0];
			}
			continue;
		}
		if (stack.length === 0) return pending;
		const frame = stack.pop()!;
		const index = frame.next;
		if (pending.tag === "value") {
			frame.next++;
			if (frame.next < frame.count) {
				stack.push(frame);
				current = childrenOf(frame.e)[frame.next];
				pending = undefined;
			} else {
				pending = reduceAt(frame.e);
			}
			continue;
		}
		pending =
			pending.tag === "rewrite"
				? { tag: "rewrite", rule: pending.rule, trail: { index, rest: pending.trail }, expr: withChild(frame.e, index, pending.expr) }
				: { tag: "stuck", trail: { index, rest: pending.trail }, reason: pending.reason };
	}
}

const num = (value: number): Expr => ({ tag: "num", value: value === 0 ? 0 : value });
const bool = (value: boolean): Expr => ({ tag: "bool", value });
const list = (items: readonly Expr[]): Expr => ({ tag: "list", items });
const app = (fn: Expr, arg: Expr): Expr => ({ tag: "app", fn, arg });
const call = (name: Builtin, ...args: readonly Expr[]): Expr => args.reduce(app, { tag: "builtin", name });

const ARITY: Readonly<Record<Builtin, number>> = { map: 2, filter: 2, foldl: 3, foldr: 3 };

const spineOf = (fn: Expr, args: readonly Expr[]): { readonly head: Expr; readonly args: readonly Expr[] } => {
	let head = fn;
	const spine = [...args];
	while (head.tag === "app") {
		spine.unshift(head.arg);
		head = head.fn;
	}
	return { head, args: spine };
};

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

const floorDiv = (a: number, b: number): number => {
	const q = BigInt(a) / BigInt(b);
	return Number(floorMod(a, b) !== a % b ? q - 1n : q);
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
	"/": numeric("/", division(floorDiv)),
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

const union = (a: ReadonlySet<string>, b: ReadonlySet<string>): ReadonlySet<string> => new Set([...a, ...b]);

type ScopeMark = { readonly name: string; readonly open: boolean };

const freeVars = (e: Expr): ReadonlySet<string> => {
	const free = new Set<string>();
	const scopes = new Map<string, number>();
	const todo: (Expr | ScopeMark)[] = [e];
	while (todo.length > 0) {
		const item = todo.pop()!;
		if ("open" in item) {
			const depth = scopes.get(item.name) ?? 0;
			if (item.open) scopes.set(item.name, depth + 1);
			else if (depth > 1) scopes.set(item.name, depth - 1);
			else scopes.delete(item.name);
			continue;
		}
		switch (item.tag) {
			case "var":
				if (!scopes.has(item.name)) free.add(item.name);
				break;
			case "lam":
				todo.push({ name: item.param, open: false }, item.body, { name: item.param, open: true });
				break;
			case "let":
				todo.push({ name: item.name, open: false }, item.body, { name: item.name, open: true }, item.value);
				break;
			default:
				for (const child of childrenOf(item)) todo.push(child);
		}
	}
	return free;
};

const fresh = (name: string, taken: ReadonlySet<string>): string => {
	let candidate = name;
	while (taken.has(candidate)) candidate += "'";
	return candidate;
};

type SubFrame = {
	readonly e: Expr;
	readonly kids: (Expr | undefined)[];
	next: number;
	readonly limit: number;
	readonly parent: SubFrame | null;
	readonly slot: number;
	readonly bound: string;
	readonly callChild: number;
	readonly callName: string;
	readonly callValue: Expr | undefined;
};

type SubMachine = {
	readonly name: string;
	readonly value: Expr;
	readonly free: ReadonlySet<string>;
	top: SubFrame | null;
	current: Expr | undefined;
	target: SubFrame | null;
	slot: number;
};

type Resume = { readonly machine: SubMachine; readonly frame: SubFrame | null; readonly slot: number };

const assembled = (frame: SubFrame): Expr => {
	const kids = frame.kids as readonly Expr[];
	switch (frame.e.tag) {
		case "lam":
			return { tag: "lam", param: frame.bound, body: kids[0] };
		case "let":
			return { tag: "let", name: frame.bound, value: kids[0], body: kids[1] };
		case "app":
			return { ...frame.e, fn: kids[0], arg: kids[1] };
		case "binop":
			return { ...frame.e, left: kids[0], right: kids[1] };
		case "cons":
			return { ...frame.e, head: kids[0], tail: kids[1] };
		case "if":
			return { ...frame.e, cond: kids[0], then: kids[1], else: kids[2] };
		case "list":
			return { ...frame.e, items: kids };
		default:
			return frame.e;
	}
};

const substitute = (body: Expr, name: string, value: Expr): Expr => {
	const resumes: Resume[] = [];
	let machine: SubMachine = { name, value, free: freeVars(value), top: null, current: body, target: null, slot: 0 };

	const deliver = (frame: SubFrame | null, slot: number, result: Expr): Expr | undefined => {
		if (frame !== null) {
			frame.kids[slot] = result;
			return undefined;
		}
		const resume = resumes.pop();
		if (resume === undefined) return result;
		machine = resume.machine;
		machine.current = result;
		machine.target = resume.frame;
		machine.slot = resume.slot;
		return undefined;
	};

	for (;;) {
		if (machine.current !== undefined) {
			const e = machine.current;
			machine.current = undefined;
			if (e.tag === "num" || e.tag === "bool" || e.tag === "builtin") {
				const done = deliver(machine.target, machine.slot, e);
				if (done !== undefined) return done;
				continue;
			}
			if (e.tag === "var") {
				const replaced = e.name === machine.name ? machine.value : e;
				const done = deliver(machine.target, machine.slot, replaced);
				if (done !== undefined) return done;
				continue;
			}
			if (e.tag === "lam" && e.param === machine.name) {
				const done = deliver(machine.target, machine.slot, e);
				if (done !== undefined) return done;
				continue;
			}
			const kids: (Expr | undefined)[] = childrenOf(e).map(() => undefined);
			let bound = "";
			let limit = kids.length;
			let callChild = -1;
			let callName = "";
			let callValue: Expr | undefined;
			if (e.tag === "lam" || e.tag === "let") {
				const param = e.tag === "lam" ? e.param : e.name;
				const scope = e.body;
				bound = param;
				limit = e.tag === "lam" ? 1 : 2;
				if (e.tag === "let" && param === machine.name) {
					kids[1] = scope;
					limit = 1;
				} else if (machine.free.has(param) && freeVars(scope).has(machine.name)) {
					bound = fresh(`${param}'`, union(union(machine.free, freeVars(scope)), new Set([machine.name])));
					callChild = e.tag === "lam" ? 0 : 1;
					callName = param;
					callValue = { tag: "var", name: bound };
				}
			}
			machine.top = { e, kids, next: 0, limit, parent: machine.target, slot: machine.slot, bound, callChild, callName, callValue };
			continue;
		}
		const frame = machine.top!;
		if (frame.next < frame.limit) {
			const index = frame.next++;
			if (index === frame.callChild) {
				resumes.push({ machine, frame, slot: index });
				machine = {
					name: frame.callName,
					value: frame.callValue!,
					free: freeVars(frame.callValue!),
					top: null,
					current: childrenOf(frame.e)[index],
					target: null,
					slot: 0,
				};
			} else {
				machine.current = childrenOf(frame.e)[index];
				machine.target = frame;
				machine.slot = index;
			}
			continue;
		}
		const result = assembled(frame);
		machine.top = frame.parent;
		const done = deliver(frame.parent, frame.slot, result);
		if (done !== undefined) return done;
	}
};