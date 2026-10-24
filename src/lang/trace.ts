import type { Expr, Outcome, Step, Trace } from "./ast.ts";
import { childrenOf, step } from "./step.ts";

export type Limits = { readonly steps: number; readonly nodes: number };

export const LIMITS: Limits = { steps: 1000, nodes: 5000 };

export const size = (e: Expr): number => {
	let nodes = 0;
	const todo: Expr[] = [e];
	while (todo.length > 0) {
		const current = todo.pop()!;
		nodes++;
		for (const child of childrenOf(current)) todo.push(child);
	}
	return nodes;
};

export function trace(start: Expr, limits: Limits = LIMITS): Trace {
	const steps: Step[] = [];
	const finish = (outcome: Outcome): Trace => ({ start, steps, outcome });
	if (size(start) > limits.nodes) return finish({ tag: "limit", kind: "nodes" });
	for (let current = start; ; ) {
		const result = step(current);
		if (result.tag === "value") return finish({ tag: "value", value: current });
		if (result.tag === "stuck") return finish(result);
		if (steps.length === limits.steps) return finish({ tag: "limit", kind: "steps" });
		if (size(result.step.after) > limits.nodes) return finish({ tag: "limit", kind: "nodes" });
		steps.push(result.step);
		current = result.step.after;
	}
}