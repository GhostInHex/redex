import type { Expr } from "../lang/ast.ts";
import { childrenOf } from "../lang/step.ts";

export const MAX_INTERACTIVE_DEPTH = 128;

export function supportsInteractiveRendering(expr: Expr): boolean {
	const todo: (readonly [Expr, number])[] = [[expr, 0]];
	for (let item = todo.pop(); item !== undefined; item = todo.pop()) {
		const [current, depth] = item;
		if (depth > MAX_INTERACTIVE_DEPTH) return false;
		for (const child of childrenOf(current)) todo.push([child, depth + 1]);
	}
	return true;
}
