import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Expr } from "../lang/ast.ts";
import { parse } from "../lang/parser.ts";
import { trace } from "../lang/trace.ts";
import ExprView from "./ExprView.tsx";
import { MAX_INTERACTIVE_DEPTH, supportsInteractiveRendering } from "./interactiveRendering.ts";

const num: Expr = { tag: "num", value: 0 };
const nested = (depth: number): Expr => {
	let expr: Expr = num;
	for (let i = 0; i < depth; i++) expr = { tag: "list", items: [expr] };
	return expr;
};

const props = {
	nextPath: undefined,
	nextRule: undefined,
	stuckPath: undefined,
	stuckReason: undefined,
	limitKind: undefined,
};

describe("interactive rendering capability", () => {
	it("supports the maximum depth and uses plain text beyond it", () => {
		expect(supportsInteractiveRendering(nested(MAX_INTERACTIVE_DEPTH))).toBe(true);
		expect(supportsInteractiveRendering(nested(MAX_INTERACTIVE_DEPTH + 1))).toBe(false);
		expect(supportsInteractiveRendering(nested(4900))).toBe(false);
	});

	it("keeps wide, shallow frames interactive", () => {
		expect(supportsInteractiveRendering({ tag: "list", items: Array(5000).fill(num) })).toBe(true);
	});

	it("checks lambda bodies and every branch, including children evaluation does not visit", () => {
		const frame: Expr = {
			tag: "if",
			cond: { tag: "bool", value: true },
			then: num,
			else: { tag: "lam", param: "x", body: nested(MAX_INTERACTIVE_DEPTH - 1) },
		};
		expect(supportsInteractiveRendering(frame)).toBe(false);
	});
});

describe("expression display", () => {
	it("prints a successful generated depth-4455 value with shallow markup and a display notice", () => {
		const source = `foldl (\\a x -> ${"[".repeat(99)}a${"]".repeat(99)}) 0 [${Array(45).fill("0").join(",")}]`;
		const parsed = parse(source);
		if (!parsed.ok) throw new Error(parsed.error.message);
		const result = trace(parsed.expr);
		expect(result.outcome.tag).toBe("value");
		if (result.outcome.tag !== "value") throw new Error("expected a value");
		const html = renderToStaticMarkup(<ExprView {...props} frame={result.outcome.value} />);
		expect(html).toContain(`<span class="expr-plain">${"[".repeat(4455)}0${"]".repeat(4455)}</span>`);
		expect(html).toContain("Expression is too deeply nested for interactive display. Showing plain text.");
		expect(html).toContain('<span class="done">value</span>');
		expect(html).not.toContain('class="list-row"');
		expect(html.match(/<span/g)).toHaveLength(2);
	});

	it("preserves rule, stuck, and evaluator limit notes independently of the display limit", () => {
		const frame = nested(MAX_INTERACTIVE_DEPTH + 1);
		const cases = [
			{ nextRule: "beta", expected: '<span class="rule">beta</span>' },
			{ stuckReason: "unbound variable y", expected: '<span class="stuck">unbound variable y</span>' },
			{ limitKind: "nodes" as const, expected: '<span class="limit">stopped after 5,000 nodes</span>' },
		];
		for (const { expected, ...status } of cases) {
			const html = renderToStaticMarkup(<ExprView {...props} {...status} frame={frame} />);
			expect(html).toContain(expected);
			expect(html).toContain('class="expr-plain"');
		}
	});

	it("preserves normal nested list rendering and redex highlighting", () => {
		const frame: Expr = { tag: "list", items: [{ tag: "list", items: [num] }] };
		const html = renderToStaticMarkup(<ExprView {...props} frame={frame} nextPath={[0, 0]} nextRule="arith" />);
		expect(html.match(/class="list-row"/g)).toHaveLength(2);
		expect(html).toContain('class="box lit"');
		expect(html).not.toContain('class="expr-plain"');
		expect(html).not.toContain("too deeply nested");
	});
});
