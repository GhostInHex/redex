import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import type { Outcome, ParseError, Trace } from "../src/lang/ast.ts";
import { EXAMPLES } from "../src/lang/examples.ts";
import { lex } from "../src/lang/lexer.ts";
import { parse } from "../src/lang/parser.ts";
import { print } from "../src/lang/print.ts";
import { LIMITS, trace } from "../src/lang/trace.ts";

const USAGE = `usage: redex parse [--ast] "<program>"
       redex parse [--ast] -      read the program from stdin
       redex parse --bench
       redex trace "<program>"
       redex trace -              read the program from stdin
       redex trace --all-examples`;

const readSource = (arg: string): string => (arg === "-" ? readFileSync(0, "utf8") : arg);

const formatError = ({ line, col, message }: ParseError): string => `error at ${line}:${col}, ${message}`;

const BENCH_TOKENS = 2000;
const BENCH_RUNS = 100;
const BENCH_WARMUP = 10;

function benchProgram(): string {
	const items = Array.from({ length: 181 }, (_, n) => `let a = ${n} in a * a + 1`);
	items.push("1", "2", "3", "4");
	return `[${items.join(", ")}]`;
}

function bench(): number {
	const source = benchProgram();
	const lexed = lex(source);
	const count = lexed.ok ? lexed.tokens.length - 1 : 0;
	if (count !== BENCH_TOKENS) throw new Error(`bench program has ${count} tokens, expected ${BENCH_TOKENS}`);

	const times: number[] = [];
	for (let run = 0; run < BENCH_WARMUP + BENCH_RUNS; run++) {
		const start = performance.now();
		const result = parse(source);
		const elapsed = performance.now() - start;
		if (!result.ok || result.expr.tag !== "list") throw new Error("bench program failed to parse");
		if (run >= BENCH_WARMUP) times.push(elapsed);
	}
	times.sort((a, b) => a - b);
	const median = (times[BENCH_RUNS / 2 - 1] + times[BENCH_RUNS / 2]) / 2;
	console.log(`median ${median.toFixed(3)} ms over ${BENCH_RUNS} parses of ${BENCH_TOKENS} tokens`);
	return 0;
}

const FLAGS: ReadonlySet<string> = new Set(["--ast", "--bench"]);

function parseCommand(args: readonly string[]): number {
	const flags = new Set(args.filter((a) => FLAGS.has(a)));
	const sources = args.filter((a) => !FLAGS.has(a));
	if (flags.has("--bench")) return bench();
	if (sources.length !== 1) {
		console.error(USAGE);
		return 2;
	}

	const result = parse(readSource(sources[0]));
	if (!result.ok) {
		console.log(formatError(result.error));
		return 1;
	}
	console.log(flags.has("--ast") ? JSON.stringify(result.expr, null, 2) : print(result.expr));
	return 0;
}

const formatOutcome = (outcome: Outcome): string => {
	switch (outcome.tag) {
		case "value":
			return `value ${print(outcome.value)}`;
		case "stuck":
			return `stuck at [${outcome.path.join(", ")}] ${outcome.reason}`;
		case "limit":
			return outcome.kind === "steps" ? `limit ${LIMITS.steps} steps` : `limit ${LIMITS.nodes} nodes`;
	}
};

const formatTrace = ({ steps, outcome }: Trace): readonly string[] => {
	const width = String(steps.length).length;
	const ruleWidth = Math.max(0, ...steps.map((s) => s.rule.length));
	return [
		...steps.map((s, i) => `${String(i + 1).padStart(width)}  ${s.rule.padEnd(ruleWidth)}  ${print(s.after)}`),
		formatOutcome(outcome),
	];
};

function traceSource(source: string): Outcome | undefined {
	const result = parse(source);
	if (!result.ok) {
		console.log(formatError(result.error));
		return undefined;
	}
	const t = trace(result.expr);
	console.log(formatTrace(t).join("\n"));
	return t.outcome;
}

function traceAllExamples(): number {
	const outcomes = EXAMPLES.map((example, i) => {
		if (i > 0) console.log();
		console.log(`# ${example.id}: ${example.source}`);
		return traceSource(example.source);
	});
	return outcomes.every((o) => o?.tag === "value") ? 0 : 1;
}

function traceCommand(args: readonly string[]): number {
	if (args.length === 1 && args[0] === "--all-examples") return traceAllExamples();
	if (args.length !== 1) {
		console.error(USAGE);
		return 2;
	}
	return traceSource(readSource(args[0]))?.tag === "value" ? 0 : 1;
}

function main(argv: readonly string[]): number {
	const [command, ...rest] = argv;
	if (command === "parse") return parseCommand(rest);
	if (command === "trace") return traceCommand(rest);
	console.error(command === undefined ? USAGE : `unknown command "${command}"\n${USAGE}`);
	return 2;
}

process.exitCode = main(process.argv.slice(2));
