import type { Trace } from "../lang/ast.ts";

export type StepperEvent =
	| { readonly type: "edit" }
	| { readonly type: "run"; readonly source: string }
	| { readonly type: "next" }
	| { readonly type: "back" }
	| { readonly type: "seek"; readonly index: number }
	| { readonly type: "play" }
	| { readonly type: "pause" }
	| { readonly type: "tick" };

export type StepperState =
	| { readonly status: "editing" }
	| { readonly status: "error"; readonly error: string }
	| { readonly status: "ready"; readonly trace: Trace; readonly index: number; readonly playing: boolean };

export const initialStepper: StepperState = { status: "editing" };

export const frameCount = (state: StepperState): number => (state.status === "ready" ? state.trace.steps.length + 1 : 0);

export const frameAt = (state: StepperState, index: number) => {
	if (state.status !== "ready") return undefined;
	const clamped = Math.max(0, Math.min(index, state.trace.steps.length));
	return state.trace.steps.slice(0, clamped).reduce<import("../lang/ast.ts").Expr>((_, step) => step.after, state.trace.start);
};

export type RunSource = (source: string) => { readonly trace: Trace } | { readonly error: string };

export function stepper(state: StepperState, event: StepperEvent, run?: RunSource): StepperState {
	switch (event.type) {
		case "edit":
			return initialStepper;
		case "run": {
			const result = run?.(event.source);
			if (!result) return initialStepper;
			if ("error" in result) return { status: "error", error: result.error };
			return { status: "ready", trace: result.trace, index: 0, playing: false };
		}
		case "next":
			return state.status === "ready" ? { ...state, index: Math.min(state.index + 1, state.trace.steps.length) } : state;
		case "back":
			return state.status === "ready" ? { ...state, index: Math.max(state.index - 1, 0) } : state;
		case "seek":
			return state.status === "ready" ? { ...state, index: Math.max(0, Math.min(event.index, state.trace.steps.length)) } : state;
		case "play":
			if (state.status !== "ready") return state;
			if (state.index >= state.trace.steps.length) return state;
			return { ...state, playing: true };
		case "pause":
			return state.status === "ready" ? { ...state, playing: false } : state;
		case "tick": {
			if (state.status !== "ready" || !state.playing) return state;
			const nextIndex = Math.min(state.index + 1, state.trace.steps.length);
			const stillPlaying = nextIndex < state.trace.steps.length;
			return { ...state, index: nextIndex, playing: stillPlaying };
		}
	}
}