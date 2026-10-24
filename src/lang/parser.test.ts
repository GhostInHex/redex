import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Builtin, Expr, Op, ParseResult } from "./ast.ts";
import { parse } from "./parser.ts";
import { print } from "./print.ts";

const num = (value: number): Expr => ({ tag: "num", value });
const v = (name: string): Expr => ({ tag: "var", name });
const lam = (param: string, body: Expr): Expr => ({ tag: "lam", param, body });
const app = (fn: Expr, arg: Expr): Expr => ({ tag: "app", fn, arg });
const bin = (op: Op, left: Expr, right: Expr): Expr => ({ tag: "binop", op, left, right });
const builtin = (name: Builtin): Expr => ({ tag: "builtin", name });

const ok = (expr: Expr): ParseResult => ({ ok: true, expr });
const err = (line: number, col: number, message: string): ParseResult => ({ ok: false, error: { line, col, message } });

describe("grammar", () => {
	it("expr: let", () => {
		expect(parse("let x = 1 in x")).toEqual(ok({ tag: "let", name: "x", value: num(1), body: v("x") }));
	});

	it("expr: lambda with several params desugars to nested lambdas", () => {
		expect(parse("\\x y -> x + y")).toEqual(ok(lam("x", lam("y", bin("+", v("x"), v("y"))))));
	});

	it("expr: if", () => {
		expect(parse("if 1 < 2 then 3 else 4")).toEqual(
			ok({ tag: "if", cond: bin("<", num(1), num(2)), then: num(3), else: num(4) }),
		);
	});

	it("cmp: each comparison operator", () => {
		for (const op of ["==", "<", "<=", ">", ">="] as const) {
			expect(parse(`1 ${op} 2`)).toEqual(ok(bin(op, num(1), num(2))));
		}
	});

	it("cons: groups to the right", () => {
		expect(parse("1 : 2 : []")).toEqual(
			ok({ tag: "cons", head: num(1), tail: { tag: "cons", head: num(2), tail: { tag: "list", items: [] } } }),
		);
	});

	it("add: groups to the left", () => {
		expect(parse("1 - 2 + 3")).toEqual(ok(bin("+", bin("-", num(1), num(2)), num(3))));
	});

	it("mul: binds tighter than add and groups to the left", () => {
		expect(parse("1 + 2 * 3")).toEqual(ok(bin("+", num(1), bin("*", num(2), num(3)))));
		expect(parse("8 / 4 % 3")).toEqual(ok(bin("%", bin("/", num(8), num(4)), num(3))));
	});

	it("app: binds tighter than mul and groups to the left", () => {
		expect(parse("f x y * 2")).toEqual(ok(bin("*", app(app(v("f"), v("x")), v("y")), num(2))));
	});

	it("atom: int, booleans, ident, builtin", () => {
		expect(parse("42")).toEqual(ok(num(42)));
		expect(parse("True")).toEqual(ok({ tag: "bool", value: true }));
		expect(parse("False")).toEqual(ok({ tag: "bool", value: false }));
		expect(parse("x'")).toEqual(ok(v("x'")));
		for (const name of ["map", "filter", "foldl", "foldr"] as const) {
			expect(parse(name)).toEqual(ok(builtin(name)));
		}
	});

	it("atom: parenthesized expression", () => {
		expect(parse("(1 + 2) * 3")).toEqual(ok(bin("*", bin("+", num(1), num(2)), num(3))));
	});

	it("atom: operator section desugars to a two-argument lambda", () => {
		for (const op of ["+", "-", "*", "=="] as const) {
			expect(parse(`(${op})`)).toEqual(ok(lam("a", lam("b", bin(op, v("a"), v("b"))))));
		}
		const fold = parse("foldl (+) 0 [1, 2]");
		expect(fold.ok && print(fold.expr)).toBe("foldl (\\a b -> a + b) 0 [1, 2]");
	});

	it("atom: parenthesized negative literal", () => {
		expect(parse("(-3)")).toEqual(ok(num(-3)));
		expect(parse("f (-1)")).toEqual(ok(app(v("f"), num(-1))));
		expect(parse("(-0)")).toEqual(ok(num(0)));
	});

	it("atom: list", () => {
		expect(parse("[]")).toEqual(ok({ tag: "list", items: [] }));
		expect(parse("[1, 2 + 3]")).toEqual(ok({ tag: "list", items: [num(1), bin("+", num(2), num(3))] }));
	});

	it("skips -- comments on every line", () => {
		expect(parse("-- intro\n1 + -- left\n2 -- right\n-- outro")).toEqual(ok(bin("+", num(1), num(2))));
	});
});

describe("errors", () => {
	it("expected an expression", () => {
		expect(parse("map (\\x -> x +) [1]")).toEqual(err(1, 15, "expected an expression"));
		expect(parse("let x = 1 in")).toEqual(err(1, 13, "expected an expression"));
		expect(parse("")).toEqual(err(1, 1, "expected an expression"));
		expect(parse("   ")).toEqual(err(1, 1, "expected an expression"));
	});

	it("expected a name", () => {
		expect(parse("let 1 = 2 in 3")).toEqual(err(1, 5, "expected a name"));
		expect(parse("\\map -> 1")).toEqual(err(1, 2, "expected a name"));
	});

	it("expected a keyword or symbol", () => {
		expect(parse("let x 1 in x")).toEqual(err(1, 7, 'expected "="'));
		expect(parse("let x = 1 x")).toEqual(err(1, 12, 'expected "in"'));
		expect(parse("\\x x")).toEqual(err(1, 5, 'expected "->"'));
		expect(parse("if 1 else 2")).toEqual(err(1, 6, 'expected "then"'));
		expect(parse("if 1 then 2")).toEqual(err(1, 12, 'expected "else"'));
	});

	it("unclosed bracket points at the opener", () => {
		expect(parse("map f\n  [1, 2")).toEqual(err(2, 3, 'unclosed "["'));
		expect(parse("map f\n  [")).toEqual(err(2, 3, 'unclosed "["'));
		expect(parse("(1 + 2")).toEqual(err(1, 1, 'unclosed "("'));
		expect(parse("[1, (2")).toEqual(err(1, 5, 'unclosed "("'));
		expect(parse("(1 + 2]")).toEqual(err(1, 1, 'unclosed "("'));
	});

	it("a closed bracket with a bad token inside names the token", () => {
		expect(parse("(x = 1)")).toEqual(err(1, 4, 'unexpected "="'));
		expect(parse("(1, 2)")).toEqual(err(1, 3, 'unexpected ","'));
		expect(parse("[1, 2 then]")).toEqual(err(1, 7, 'unexpected "then"'));
	});

	it("expression is nested too deeply, instead of a stack overflow", () => {
		const tooDeep = err(1, 501, "expression is nested too deeply");
		expect(parse("(".repeat(10000) + "1" + ")".repeat(10000))).toEqual(tooDeep);
		expect(parse("[".repeat(10000) + "]".repeat(10000))).toEqual(tooDeep);
		expect(parse(Array(20000).fill("1").join(" : ") + " : []").ok).toBe(false);
		expect(parse(Array(20000).fill("1").join(" + ")).ok).toBe(false);
		expect(parse(Array(20000).fill("f").join(" ")).ok).toBe(false);
		expect(parse(`\\${Array(20000).fill("x").join(" ")} -> x`).ok).toBe(false);
	});

	it("bounds the tree height when a chain starts with a nested operand", () => {
		let source = "1";
		for (let n = 0; n < 45; n++) source = `(${source})` + " + 1".repeat(400);
		expect(parse(source)).toEqual(err(1, 2050, "expression is nested too deeply"));
		expect(parse(`(${Array(300).fill("f").join(" ")})` + " x".repeat(300)).ok).toBe(false);
	});

	it("anything under the depth limit parses and prints", () => {
		const sources = [
			"(".repeat(400) + "1" + ")".repeat(400),
			Array(400).fill("1").join(" : ") + " : []",
			Array(400).fill("1").join(" + "),
			Array(400).fill("f").join(" "),
			"let x = 1 in ".repeat(400) + "x",
		];
		for (const source of sources) {
			const result = parse(source);
			expect(result.ok && print(result.expr).length).toBeGreaterThan(0);
		}
	});

	it("comparisons cannot be chained", () => {
		expect(parse("1 < 2 < 3")).toEqual(err(1, 7, "comparisons cannot be chained"));
	});

	it("unexpected token after the program", () => {
		expect(parse("1 )")).toEqual(err(1, 3, 'unexpected ")"'));
	});

	it("unexpected character", () => {
		expect(parse("1 & 2")).toEqual(err(1, 3, 'unexpected character "&"'));
	});

	it("number too large", () => {
		expect(parse("99999999999999999999")).toEqual(err(1, 1, "number too large"));
	});
});

describe("print", () => {
	it("prints a tree of any height", () => {
		const height = 100000;
		let tree: Expr = num(1);
		for (let n = 0; n < height; n++) tree = { tag: "list", items: [tree] };
		expect(print(tree)).toBe("[".repeat(height) + "1" + "]".repeat(height));
	});

	it("adds parentheses only where precedence needs them", () => {
		const cases = [
			"1 + 2 * 3",
			"(1 + 2) * 3",
			"1 - (2 - 3)",
			"1 : 2 : []",
			"(1 : []) : []",
			"f (g x) y",
			"(\\x -> x) 1",
			"1 + (\\x -> x)",
			"(1 < 2) == True",
			"f (-1) * (-2)",
			"[(-1), 2]",
			"let sq = \\x -> x * x in map sq [1, 2, 3]",
		];
		for (const source of cases) {
			const result = parse(source);
			expect(result.ok && print(result.expr)).toBe(source);
		}
	});
});

const KEYWORDS = new Set(["let", "in", "if", "then", "else", "True", "False", "map", "filter", "foldl", "foldr"]);
const ident = fc.stringMatching(/^[a-z_][a-zA-Z0-9_']{0,4}$/).filter((s) => !KEYWORDS.has(s));
const ops: readonly Op[] = ["+", "-", "*", "/", "%", "==", "<", "<=", ">", ">="];
const builtins: readonly Builtin[] = ["map", "filter", "foldl", "foldr"];

const { expr: arbExpr } = fc.letrec<{ expr: Expr }>((tie) => ({
	expr: fc.oneof(
		{ depthSize: "small", withCrossShrink: true },
		fc.maxSafeInteger().map(num),
		fc.boolean().map((value): Expr => ({ tag: "bool", value })),
		ident.map(v),
		fc.constantFrom(...builtins).map(builtin),
		fc.tuple(ident, tie("expr")).map(([param, body]) => lam(param, body)),
		fc.tuple(tie("expr"), tie("expr")).map(([fn, arg]) => app(fn, arg)),
		fc.tuple(fc.constantFrom(...ops), tie("expr"), tie("expr")).map(([op, l, r]) => bin(op, l, r)),
		fc.tuple(tie("expr"), tie("expr")).map(([head, tail]): Expr => ({ tag: "cons", head, tail })),
		fc.tuple(tie("expr"), tie("expr"), tie("expr")).map(([cond, then, e]): Expr => ({ tag: "if", cond, then, else: e })),
		fc.tuple(ident, tie("expr"), tie("expr")).map(([name, value, body]): Expr => ({ tag: "let", name, value, body })),
		fc.array(tie("expr"), { maxLength: 4 }).map((items): Expr => ({ tag: "list", items })),
	),
}));

describe("round trip", () => {
	it("parse(print(e)) equals e for any Expr", () => {
		fc.assert(
			fc.property(arbExpr, (e) => {
				expect(parse(print(e))).toEqual(ok(e));
			}),
			{ numRuns: 2000 },
		);
	});
});
