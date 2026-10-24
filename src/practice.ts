import type { Path, Step } from "./lang/ast.ts";

export type PracticeState =
	| { readonly phase: "ask"; readonly index: number; readonly score: number }
	| { readonly phase: "right"; readonly index: number; readonly score: number }
	| { readonly phase: "wrong"; readonly index: number; readonly clicked: Path; readonly score: number }
	| { readonly phase: "done"; readonly score: number };

export type PracticeEvent = { readonly type: "answer"; readonly path: Path } | { readonly type: "next" } | { readonly type: "reset" };

const same = (a: Path, b: Path) => a.length === b.length && a.every((n, i) => n === b[i]);

export const initialPractice = (steps: readonly Step[]): PracticeState =>
	steps.length === 0 ? { phase: "done", score: 0 } : { phase: "ask", index: 0, score: 0 };

export function practice(state: PracticeState, event: PracticeEvent, steps: readonly Step[]): PracticeState {
	switch (event.type) {
		case "answer": {
			if (state.phase !== "ask") return state;
			const step = steps[state.index];
			if (!step) return state;
			if (same(event.path, step.path)) {
				const score = state.score + 1;
				return { phase: "right", index: state.index, score };
			}
			return { phase: "wrong", index: state.index, clicked: event.path, score: state.score };
		}
		case "next": {
			if (state.phase !== "right" && state.phase !== "wrong") return state;
			return state.index + 1 < steps.length ? { phase: "ask", index: state.index + 1, score: state.score } : { phase: "done", score: state.score };
		}
		case "reset":
			return initialPractice(steps);
	}
}