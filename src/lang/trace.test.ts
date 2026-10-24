import { describe, expect, it } from "vitest";
import type { Expr, Outcome, Path } from "./ast.ts";
import { EXAMPLES } from "./examples.ts";
import { parse } from "./parser.ts";
import { size, trace } from "./trace.ts";

const src = (source: string): Expr => {
	const result = parse(source);
	if (!result.ok) throw new Error(`${source}: ${result.error.message}`);
	return result.expr;
};

const value = (source: string): Outcome => ({ tag: "value", value: src(source) });

describe("examples", () => {
	const expected: Readonly<Record<string, string>> = {
		arithmetic: "29",
		"apply-a-function": "42",
		let: "25",
		if: "100",
		"two-arguments": "42",
		"functions-as-values": "18",
		cons: "[1, 2, 3]",
		map: "[2, 4, 6]",
		filter: "[2, 4]",
		foldr: "6",
		"sum-of-squares": "14",
		pipeline: "56",
	};

	it("has 12 examples with unique ids, in lesson order", () => {
		expect(EXAMPLES.map((e) => e.id)).toEqual(Object.keys(expected));
	});

	it("sum-of-squares has the plan's source", () => {
		expect(EXAMPLES.find((e) => e.id === "sum-of-squares")?.source).toBe("foldl (+) 0 (map (\\x -> x * x) [1, 2, 3])");
	});

	for (const example of EXAMPLES) {
		it(`${example.id} ends in ${expected[example.id]}`, () => {
			expect(trace(src(example.source)).outcome).toEqual(value(expected[example.id]));
		});
	}
});

describe("trace", () => {
	it("chains steps, each starting from the last one's result", () => {
		const t = trace(src("foldl (+) 0 (map (\\x -> x * x) [1, 2, 3])"));
		expect(t.steps[0].before).toBe(t.start);
		for (let i = 1; i < t.steps.length; i++) expect(t.steps[i].before).toBe(t.steps[i - 1].after);
		expect(t.outcome).toEqual({ tag: "value", value: t.steps.at(-1)!.after });
	});

	it("records no steps for a program that is already a value", () => {
		expect(trace(src("[1, 2]"))).toEqual({ start: src("[1, 2]"), steps: [], outcome: value("[1, 2]") });
	});

	it("runs the sum-of-squares example as map, three squares, then a fold that settles each running total", () => {
		const rules = trace(src("foldl (+) 0 (map (\\x -> x * x) [1, 2, 3])")).steps.map((s) => s.rule);
		expect(rules).toEqual([
			"map", "beta", "arith", "beta", "arith", "beta", "arith",
			"foldl-cons", "beta", "beta", "arith",
			"foldl-cons", "beta", "beta", "arith",
			"foldl-cons", "beta", "beta", "arith",
			"foldl-nil",
		]);
	});
});

describe("step limit", () => {
	const omega = src("(\\x -> x x) (\\x -> x x)");

	it("stops a program that never ends after 1,000 steps", () => {
		const t = trace(omega);
		expect(t.outcome).toEqual({ tag: "limit", kind: "steps" });
		expect(t.steps).toHaveLength(1000);
	});

	it("allows exactly as many steps as the limit", () => {
		expect(trace(src("1 + 2"), { steps: 1, nodes: 5000 }).outcome).toEqual(value("3"));
		expect(trace(src("1 + 2"), { steps: 0, nodes: 5000 }).outcome).toEqual({ tag: "limit", kind: "steps" });
	});
});

describe("node limit", () => {
	const doubling = src("foldl (\\acc x -> [acc, acc]) 0 [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]");

	it("stops a program whose expression grows past 5,000 nodes", () => {
		const t = trace(doubling);
		expect(t.outcome).toEqual({ tag: "limit", kind: "nodes" });
		expect(t.steps.every((s) => size(s.after) <= 5000)).toBe(true);
	});

	it("stops a program that starts over the limit, even when it is already a value", () => {
		const big = src(`[${Array.from({ length: 5000 }, () => "0").join(", ")}]`);
		expect(size(big)).toBe(5001);
		expect(trace(big)).toEqual({ start: big, steps: [], outcome: { tag: "limit", kind: "nodes" } });
	});

	it("stops before the step that would cross the limit", () => {
		const t = trace(src("map (\\x -> x) [1, 2, 3]"), { steps: 1000, nodes: 9 });
		expect(t).toEqual({ start: src("map (\\x -> x) [1, 2, 3]"), steps: [], outcome: { tag: "limit", kind: "nodes" } });
	});

	it("sizes nesting deeper than the parser allows", () => {
		let e: Expr = { tag: "num", value: 0 };
		for (let i = 0; i < 4900; i++) e = { tag: "list", items: [e] };
		expect(size(e)).toBe(4901);
		expect(trace(e, { steps: 1000, nodes: 5000 })).toEqual({ start: e, steps: [], outcome: { tag: "value", value: e } });
	});
});

describe("stuck reasons", () => {
	const cases: readonly { source: string; path: Path; reason: string }[] = [
		{ source: "1 / 0", path: [], reason: "division by zero" },
		{ source: "(\\x -> x % 0) 7", path: [], reason: "division by zero" },
		{ source: "y + 1", path: [0], reason: "unbound variable y" },
		{ source: "1 + [2]", path: [], reason: `"+" needs two numbers` },
		{ source: "[1, True - 1]", path: [1], reason: `"-" needs two numbers` },
		{ source: "1 == [1]", path: [], reason: `"==" needs two numbers or two booleans` },
		{ source: "9007199254740991 * 2", path: [], reason: "number too large" },
		{ source: "if 0 then 1 else 2", path: [], reason: `"if" needs a boolean` },
		{ source: "1 : 2", path: [], reason: `":" needs a list on its right` },
		{ source: "let f = 3 in f 4", path: [], reason: "a number is not a function" },
		{ source: "True 4", path: [], reason: "a boolean is not a function" },
		{ source: "map (\\x -> x) [1] 2", path: [], reason: "a list is not a function" },
		{ source: "map (\\x -> x) 1", path: [], reason: "map needs a list" },
		{ source: "filter (\\x -> True) 1", path: [], reason: "filter needs a list" },
		{ source: "foldl (+) 0 1", path: [], reason: "foldl needs a list" },
		{ source: "foldr (+) 0 1", path: [], reason: "foldr needs a list" },
	];

	for (const { source, path, reason } of cases) {
		it(`${source}: ${reason}`, () => {
			expect(trace(src(source)).outcome).toEqual({ tag: "stuck", path, reason });
		});
	}
});
