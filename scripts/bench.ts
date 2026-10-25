import { performance } from "node:perf_hooks";
import type { Expr, Trace } from "../src/lang/ast.ts";
import { EXAMPLES } from "../src/lang/examples.ts";
import { parse } from "../src/lang/parser.ts";
import { LIMITS, trace } from "../src/lang/trace.ts";

const RUNS = 50;
const WARMUP = 5;
const EXAMPLE_BUDGET_MS = 20;
const LIMIT_BUDGET_MS = 200;

const STEP_LIMIT_CASES = [
	{ id: "omega", source: String.raw`(\x -> x x) (\x -> x x)` },
	{ id: "deep-foldr", source: `foldr (+) 0 [${Array.from({ length: 400 }, (_, n) => n).join(", ")}]` },
];

const expr = (source: string): Expr => {
	const result = parse(source);
	if (!result.ok) throw new Error(`bench program failed to parse: ${source}`);
	return result.expr;
};

const median = (times: readonly number[]): number => {
	const sorted = [...times].sort((a, b) => a - b);
	const mid = sorted.length / 2;
	return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[Math.floor(mid)];
};

const time = (start: Expr, check: (t: Trace) => boolean): { median: number; steps: number } => {
	const times: number[] = [];
	let steps = 0;
	for (let run = 0; run < WARMUP + RUNS; run++) {
		const t0 = performance.now();
		const t = trace(start);
		const elapsed = performance.now() - t0;
		if (!check(t)) throw new Error(`unexpected outcome ${JSON.stringify(t.outcome)}`);
		steps = t.steps.length;
		if (run >= WARMUP) times.push(elapsed);
	}
	return { median: median(times), steps };
};

const report = (id: string, budget: number, { median, steps }: { median: number; steps: number }): boolean => {
	const pass = median <= budget;
	console.log(`${pass ? "PASS" : "FAIL"}  ${id.padEnd(20)}  ${median.toFixed(3).padStart(8)} ms  ${String(steps).padStart(4)} steps  budget ${budget} ms`);
	return pass;
};

const exampleResults = EXAMPLES.map((example) =>
	report(example.id, EXAMPLE_BUDGET_MS, time(expr(example.source), (t) => t.outcome.tag === "value")),
);
const limitResults = STEP_LIMIT_CASES.map(({ id, source }) =>
	report(
		id,
		LIMIT_BUDGET_MS,
		time(expr(source), (t) => t.outcome.tag === "limit" && t.outcome.kind === "steps" && t.steps.length === LIMITS.steps),
	),
);

console.log(`median of ${RUNS} traces per program after ${WARMUP} warmup runs`);
process.exitCode = [...exampleResults, ...limitResults].every(Boolean) ? 0 : 1;
