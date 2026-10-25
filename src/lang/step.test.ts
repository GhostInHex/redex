import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Builtin, Expr, Op, Path, Rule } from "./ast.ts";
import { parse } from "./parser.ts";
import { step, type StepResult } from "./step.ts";

const num = (value: number): Expr => ({ tag: "num", value });
const bool = (value: boolean): Expr => ({ tag: "bool", value });
const v = (name: string): Expr => ({ tag: "var", name });
const lam = (param: string, body: Expr): Expr => ({ tag: "lam", param, body });
const app = (fn: Expr, ...args: readonly Expr[]): Expr => args.reduce((f, arg): Expr => ({ tag: "app", fn: f, arg }), fn);
const bin = (op: Op, left: Expr, right: Expr): Expr => ({ tag: "binop", op, left, right });
const builtin = (name: Builtin): Expr => ({ tag: "builtin", name });
const list = (...items: readonly Expr[]): Expr => ({ tag: "list", items });
const cons = (head: Expr, tail: Expr): Expr => ({ tag: "cons", head, tail });
const ifte = (cond: Expr, then: Expr, otherwise: Expr): Expr => ({ tag: "if", cond, then, else: otherwise });
const nums = (...values: readonly number[]) => list(...values.map(num));

const src = (source: string): Expr => {
	const result = parse(source);
	if (!result.ok) throw new Error(`${source}: ${result.error.message}`);
	return result.expr;
};

const children = (e: Expr): readonly Expr[] => {
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
};

const rebuilt = (e: Expr, kids: readonly Expr[]): Expr => {
	switch (e.tag) {
		case "num":
		case "bool":
		case "var":
		case "builtin":
			return e;
		case "lam":
			return { ...e, body: kids[0] };
		case "app":
			return { ...e, fn: kids[0], arg: kids[1] };
		case "binop":
			return { ...e, left: kids[0], right: kids[1] };
		case "cons":
			return { ...e, head: kids[0], tail: kids[1] };
		case "if":
			return { ...e, cond: kids[0], then: kids[1], else: kids[2] };
		case "let":
			return { ...e, value: kids[0], body: kids[1] };
		case "list":
			return { ...e, items: kids };
	}
};

const at = (e: Expr, path: Path): Expr | undefined =>
	path.reduce<Expr | undefined>((node, i) => node && children(node)[i], e);

const replaced = (e: Expr, path: Path, sub: Expr): Expr => {
	if (path.length === 0) return sub;
	const [i, ...rest] = path;
	const kids = children(e);
	return rebuilt(e, kids.with(i, replaced(kids[i], rest, sub)));
};

const rewrites = (before: Expr, rule: Rule, path: Path, after: Expr): StepResult => ({
	tag: "step",
	step: { rule, path, before, after },
});

describe("one case per rule", () => {
	const cases: readonly { rule: Rule; before: Expr; path: Path; after: Expr }[] = [
		{ rule: "arith", before: src("1 + 2 * 3"), path: [1], after: src("1 + 6") },
		{ rule: "compare", before: src("if 1 < 2 then 3 else 4"), path: [0], after: src("if True then 3 else 4") },
		{ rule: "cons", before: src("0 : [2, 3]"), path: [], after: nums(0, 2, 3) },
		{ rule: "beta", before: src("(\\x -> x + 1) 41"), path: [], after: src("41 + 1") },
		{ rule: "let", before: src("let x = 5 in x * x"), path: [], after: src("5 * 5") },
		{ rule: "if-true", before: src("[if True then 1 else 2]"), path: [0], after: nums(1) },
		{ rule: "if-false", before: src("if False then 1 else 2"), path: [], after: num(2) },
		{ rule: "map", before: src("map (\\x -> x) [1, 2]"), path: [], after: list(app(lam("x", v("x")), num(1)), app(lam("x", v("x")), num(2))) },
		{
			rule: "filter-cons",
			before: src("filter (\\x -> x > 1) [1, 2]"),
			path: [],
			after: ifte(
				app(src("\\x -> x > 1"), num(1)),
				cons(num(1), app(builtin("filter"), src("\\x -> x > 1"), nums(2))),
				app(builtin("filter"), src("\\x -> x > 1"), nums(2)),
			),
		},
		{ rule: "filter-nil", before: src("filter (\\x -> x > 1) []"), path: [], after: list() },
		{
			rule: "foldl-cons",
			before: src("foldl (+) 0 [1, 2]"),
			path: [],
			after: app(builtin("foldl"), src("(+)"), app(src("(+)"), num(0), num(1)), nums(2)),
		},
		{ rule: "foldl-nil", before: src("foldl (+) 0 []"), path: [], after: num(0) },
		{
			rule: "foldr-cons",
			before: src("foldr (+) 0 [1, 2]"),
			path: [],
			after: app(src("(+)"), num(1), app(builtin("foldr"), src("(+)"), num(0), nums(2))),
		},
		{ rule: "foldr-nil", before: src("foldr (+) 0 []"), path: [], after: num(0) },
	];

	it("covers every rule", () => {
		const rules: readonly Rule[] = [
			"arith", "compare", "cons", "beta", "let", "if-true", "if-false",
			"map", "filter-cons", "filter-nil", "foldl-cons", "foldl-nil", "foldr-cons", "foldr-nil",
		];
		expect(cases.map((c) => c.rule)).toEqual(rules);
	});

	for (const { rule, before, path, after } of cases) {
		it(rule, () => {
			expect(step(before)).toEqual(rewrites(before, rule, path, after));
		});
	}
});

describe("evaluation order", () => {
	const firstStep = (source: string) => {
		const result = step(src(source));
		return result.tag === "step" ? { rule: result.step.rule, path: result.step.path } : result;
	};

	it("is a value when nothing can reduce", () => {
		for (const source of ["42", "True", "[1, [2, 3]]", "\\x -> 1 + 2", "map", "map (\\x -> x)", "foldl (+) 0", "(+)"]) {
			expect(step(src(source))).toEqual({ tag: "value" });
		}
	});

	it("reduces the left operand before the right", () => {
		expect(firstStep("(1 + 2) * (3 + 4)")).toEqual({ rule: "arith", path: [0] });
	});

	it("reduces the function before the argument, and the argument before beta", () => {
		expect(firstStep("((\\f -> f) (\\x -> x)) (1 + 2)")).toEqual({ rule: "beta", path: [0] });
		expect(firstStep("(\\x -> x) (1 + 2)")).toEqual({ rule: "arith", path: [1] });
	});

	it("never reduces inside a lambda body", () => {
		expect(firstStep("(\\x -> 1 + 2) 5")).toEqual({ rule: "beta", path: [] });
	});

	it("reduces only the condition of an if, never a branch", () => {
		expect(firstStep("if 1 < 2 then 1 + 1 else 2 + 2")).toEqual({ rule: "compare", path: [0] });
		expect(firstStep("if True then 1 + 1 else 1 / 0")).toEqual({ rule: "if-true", path: [] });
	});

	it("reduces a let value before substituting, and never the body first", () => {
		expect(firstStep("let x = 2 + 3 in x * (1 + 1)")).toEqual({ rule: "arith", path: [0] });
	});

	it("reduces list items left to right", () => {
		expect(firstStep("[1, 1 + 1, 2 + 2]")).toEqual({ rule: "arith", path: [1] });
	});

	it("reduces a builtin's arguments before its rule", () => {
		expect(firstStep("foldl (+) (0 + 1) (map (\\x -> x) [1])")).toEqual({ rule: "arith", path: [0, 1] });
		expect(firstStep("foldl (+) 0 (map (\\x -> x) [1])")).toEqual({ rule: "map", path: [1] });
	});

	it("reduces a cons head, then its tail, then the cons", () => {
		expect(firstStep("(1 + 1) : 2 : []")).toEqual({ rule: "arith", path: [0] });
		expect(firstStep("1 : 2 : []")).toEqual({ rule: "cons", path: [1] });
	});
});

describe("arithmetic", () => {
	const value = (source: string) => {
		const result = step(src(source));
		return result.tag === "step" ? result.step.after : result;
	};

	it("divides and takes the remainder rounding toward negative infinity, as Haskell's div and mod do", () => {
		expect(value("7 / 2")).toEqual(num(3));
		expect(value("(-7) / 2")).toEqual(num(-4));
		expect(value("7 % 3")).toEqual(num(1));
		expect(value("(-7) % 3")).toEqual(num(2));
		expect(value("7 % (-3)")).toEqual(num(-2));
	});

	it("divides exactly at the edge of the safe integer range", () => {
		expect(value("9007199254740991 / (-3)")).toEqual(num(-3002399751580331));
		expect(value("(-9007199254740991) / 3")).toEqual(num(-3002399751580331));
		expect(value("(-9007199254740991) / (-1)")).toEqual(num(9007199254740991));
		expect(value("9007199254740991 % (-3)")).toEqual(num(-2));
	});

	it("produces negative numbers and never negative zero", () => {
		expect(value("1 - 3")).toEqual(num(-2));
		expect(Object.is((value("0 * (-1)") as { value: number }).value, 0)).toBe(true);
	});

	it("compares numbers and booleans", () => {
		expect(value("2 >= 2")).toEqual(bool(true));
		expect(value("True == False")).toEqual(bool(false));
		expect(value("3 == 3")).toEqual(bool(true));
	});
});

describe("stuck", () => {
	const cases: readonly { source: string; path: Path; reason: string }[] = [
		{ source: "1 / 0", path: [], reason: "division by zero" },
		{ source: "1 % 0", path: [], reason: "division by zero" },
		{ source: "y + 1", path: [0], reason: "unbound variable y" },
		{ source: "1 + [2]", path: [], reason: `"+" needs two numbers` },
		{ source: "[1] < 2", path: [], reason: `"<" needs two numbers` },
		{ source: "1 == True", path: [], reason: `"==" needs two numbers or two booleans` },
		{ source: "9007199254740991 + 1", path: [], reason: "number too large" },
		{ source: "if 1 then 2 else 3", path: [], reason: `"if" needs a boolean` },
		{ source: "1 : 2", path: [], reason: `":" needs a list on its right` },
		{ source: "[1] 2", path: [], reason: "a list is not a function" },
		{ source: "3 4", path: [], reason: "a number is not a function" },
		{ source: "[True 1]", path: [0], reason: "a boolean is not a function" },
		{ source: "map (\\x -> x) 5", path: [], reason: "map needs a list" },
		{ source: "filter (\\x -> x) 5", path: [], reason: "filter needs a list" },
		{ source: "foldl (+) 0 5", path: [], reason: "foldl needs a list" },
		{ source: "foldr (+) 0 5", path: [], reason: "foldr needs a list" },
	];

	for (const { source, path, reason } of cases) {
		it(`${source} is stuck: ${reason}`, () => {
			expect(step(src(source))).toEqual({ tag: "stuck", path, reason });
		});
	}
});

describe("substitution", () => {
	it("stops at a binder that shadows the name", () => {
		const result = step(src("(\\x -> \\x -> x) 1"));
		expect(result.tag === "step" && result.step.after).toEqual(lam("x", v("x")));
	});

	it("renames a binder instead of capturing a free variable of the argument", () => {
		const result = step(src("(\\x -> \\y -> x) (\\z -> y)"));
		expect(result.tag === "step" && result.step.after).toEqual(lam("y'", lam("z", v("y"))));
	});

	it("substitutes into nesting deeper than the parser allows", () => {
		let body: Expr = v("x");
		for (let i = 0; i < 4900; i++) body = list(body);
		const result = step(app(lam("x", body), num(0)));
		let node = result.tag === "step" ? result.step.after : undefined;
		let depth = 0;
		while (node && node.tag === "list") {
			node = node.items[0];
			depth++;
		}
		expect(node).toEqual(num(0));
		expect(depth).toBe(4900);
	});
});

describe("deep expressions", () => {
	it("renames a binder whose body is nested deeper than the parser allows", () => {
		let body: Expr = v("x");
		for (let i = 0; i < 4900; i++) body = list(body);
		const result = step(app(lam("x", lam("y", body)), lam("z", v("y"))));
		expect(result.tag).toBe("step");
		if (result.tag !== "step") return;
		expect(result.step.after.tag).toBe("lam");
		if (result.step.after.tag !== "lam") return;
		expect(result.step.after.param).toBe("y'");
		let node: Expr | undefined = result.step.after.body;
		let depth = 0;
		while (node && node.tag === "list") {
			node = node.items[0];
			depth++;
		}
		expect(node).toEqual(lam("z", v("y")));
		expect(depth).toBe(4900);
	});
});

const VARS = ["a", "b", "c"] as const;
const variable = fc.constantFrom(...VARS);
const smallNum = fc.integer({ min: -5, max: 9 }).map(num);

const { number: arbNumber, list: arbList } = fc.letrec<{ number: Expr; list: Expr }>((tie) => ({
	number: fc.oneof(
		{ depthSize: "small", withCrossShrink: true },
		smallNum,
		variable.map(v),
		fc.tuple(fc.constantFrom<Op>("+", "-", "*", "/", "%"), tie("number"), tie("number")).map(([op, l, r]) => bin(op, l, r)),
		fc.tuple(variable, tie("number"), tie("number")).map(([name, value, body]): Expr => ({ tag: "let", name, value, body })),
		fc.tuple(variable, tie("number"), tie("number")).map(([x, body, arg]) => app(lam(x, body), arg)),
		fc.tuple(fc.constantFrom<Op>("<", "==", ">="), tie("number"), tie("number"), tie("number"), tie("number")).map(
			([op, l, r, t, e]) => ifte(bin(op, l, r), t, e),
		),
		fc.tuple(variable, variable, tie("number"), tie("number"), tie("list")).map(([acc, x, body, z, xs]) =>
			app(builtin("foldl"), lam(acc, lam(x, body)), z, xs),
		),
		fc.tuple(variable, variable, tie("number"), tie("number"), tie("list")).map(([x, acc, body, z, xs]) =>
			app(builtin("foldr"), lam(x, lam(acc, body)), z, xs),
		),
	),
	list: fc.oneof(
		{ depthSize: "small", withCrossShrink: true },
		fc.array(tie("number"), { maxLength: 3 }).map((items) => list(...items)),
		fc.tuple(variable, tie("number"), tie("list")).map(([x, body, xs]) => app(builtin("map"), lam(x, body), xs)),
		fc.tuple(variable, tie("number"), tie("number"), tie("list")).map(([x, l, r, xs]) =>
			app(builtin("filter"), lam(x, bin("<", l, r)), xs),
		),
		fc.tuple(tie("number"), tie("list")).map(([head, tail]) => cons(head, tail)),
	),
}));

const closed = (body: Expr) =>
	fc.tuple(smallNum, smallNum, smallNum).map(([a, b, c]): Expr => ({
		tag: "let", name: "a", value: a,
		body: { tag: "let", name: "b", value: b, body: { tag: "let", name: "c", value: c, body } },
	}));

const program = fc.oneof(arbNumber, arbList).chain(closed);

const MAX_STEPS = 200;

const stepsOf = (start: Expr): readonly StepResult[] => {
	const results: StepResult[] = [];
	for (let current = start, n = 0; n < MAX_STEPS; n++) {
		const result = step(current);
		results.push(result);
		if (result.tag !== "step") break;
		current = result.step.after;
	}
	return results;
};

const ARITY: Readonly<Record<Builtin, number>> = { map: 2, filter: 2, foldl: 3, foldr: 3 };

const spine = (e: Expr, args: readonly Expr[] = []): { head: Expr; args: readonly Expr[] } =>
	e.tag === "app" ? spine(e.fn, [e.arg, ...args]) : { head: e, args };

const isValue = (e: Expr): boolean => {
	switch (e.tag) {
		case "num":
		case "bool":
		case "builtin":
		case "lam":
			return true;
		case "list":
			return e.items.every(isValue);
		case "app": {
			const { head, args } = spine(e);
			return head.tag === "builtin" && args.length < ARITY[head.name] && args.every(isValue);
		}
		default:
			return false;
	}
};

const builtinCall = (e: Expr, name: Builtin, nonEmpty: boolean) => {
	const { head, args } = spine(e);
	const xs = args.at(-1);
	return (
		head.tag === "builtin" && head.name === name && args.length === ARITY[name] && args.every(isValue) &&
		xs?.tag === "list" && xs.items.length > 0 === nonEmpty
	);
};

const IS_REDEX: Readonly<Record<Rule, (e: Expr) => boolean>> = {
	arith: (e) => e.tag === "binop" && e.left.tag === "num" && e.right.tag === "num",
	compare: (e) => e.tag === "binop" && isValue(e.left) && isValue(e.right),
	cons: (e) => e.tag === "cons" && isValue(e.head) && e.tail.tag === "list" && isValue(e.tail),
	beta: (e) => e.tag === "app" && e.fn.tag === "lam" && isValue(e.arg),
	let: (e) => e.tag === "let" && isValue(e.value),
	"if-true": (e) => e.tag === "if" && e.cond.tag === "bool" && e.cond.value,
	"if-false": (e) => e.tag === "if" && e.cond.tag === "bool" && !e.cond.value,
	map: (e) => builtinCall(e, "map", true) || builtinCall(e, "map", false),
	"filter-cons": (e) => builtinCall(e, "filter", true),
	"filter-nil": (e) => builtinCall(e, "filter", false),
	"foldl-cons": (e) => builtinCall(e, "foldl", true),
	"foldl-nil": (e) => builtinCall(e, "foldl", false),
	"foldr-cons": (e) => builtinCall(e, "foldr", true),
	"foldr-nil": (e) => builtinCall(e, "foldr", false),
};

const strictChildren = (e: Expr): readonly Expr[] => {
	switch (e.tag) {
		case "app":
			return [e.fn, e.arg];
		case "binop":
			return [e.left, e.right];
		case "cons":
			return [e.head, e.tail];
		case "if":
			return [e.cond];
		case "let":
			return [e.value];
		default:
			return [];
	}
};

const checkPath = (result: StepResult) => {
	if (result.tag !== "step") return;
	const { rule, path, before, after } = result.step;
	const redex = at(before, path);
	const rewritten = at(after, path);
	expect(redex, "path names a node in the old expression").toBeDefined();
	expect(rewritten, "path names a node in the new expression").toBeDefined();
	expect(IS_REDEX[rule](redex!), `the node at path is a ${rule} redex`).toBe(true);
	expect(rewritten, "the node at path changed").not.toEqual(redex);
	expect(replaced(before, path, rewritten!), "every node outside path is unchanged").toEqual(after);
};

const checkStuckPath = (current: Expr, result: StepResult) => {
	if (result.tag !== "stuck") return;
	const node = at(current, result.path);
	expect(node, "stuck path names a node").toBeDefined();
	expect(isValue(node!), "the stuck node is not a value").toBe(false);
	expect(strictChildren(node!).every(isValue), "the stuck node's evaluated children are values").toBe(true);
};

describe("path property", () => {
	it("for every step of a random closed program, the subtree at path is the rewritten node and nothing else changed", () => {
		fc.assert(
			fc.property(program, (start) => {
				let current = start;
				for (const result of stepsOf(start)) {
					checkPath(result);
					checkStuckPath(current, result);
					if (result.tag === "step") current = result.step.after;
				}
			}),
			{ numRuns: 500 },
		);
	});

	it("draws programs that reach every rule, so the path property covers each one", () => {
		const seen = new Set<Rule>();
		fc.assert(
			fc.property(program, (start) => {
				for (const result of stepsOf(start)) if (result.tag === "step") seen.add(result.step.rule);
			}),
			{ numRuns: 500, seed: 1 },
		);
		expect([...seen].sort()).toEqual(
			["arith", "beta", "compare", "cons", "filter-cons", "filter-nil", "foldl-cons", "foldl-nil", "foldr-cons", "foldr-nil", "if-false", "if-true", "let", "map"],
		);
	});
});
