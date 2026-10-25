import { describe, expect, it } from "vitest";
import type { Expr, Trace } from "../lang/ast.ts";
import { frameAt, frameCount, initialStepper, stepper, type RunSource } from "./stepper.ts";

const num = (value: number): Expr => ({ tag: "num", value });
const one = num(1);
const two = num(2);
const three = num(3);
const six = num(6);
const inner: Expr = { tag: "binop", op: "+", left: one, right: two };
const sum: Expr = { tag: "binop", op: "+", left: inner, right: three };
const mid: Expr = { tag: "binop", op: "+", left: three, right: three };

const trace: Trace = {
	start: sum,
	steps: [
		{ rule: "arith", path: [0], before: sum, after: mid },
		{ rule: "arith", path: [], before: mid, after: six },
	],
	outcome: { tag: "value", value: six },
};

const good: RunSource = () => ({ trace });
const fail: RunSource = () => ({ error: "expected an expression" });

describe("stepper", () => {
	it("edit returns to editing", () => {
		const ready = stepper(initialStepper, { type: "run", source: "(1 + 2) + 3" }, good);
		expect(stepper(ready, { type: "edit" })).toEqual({ status: "editing" });
	});

	it("run stores the trace at frame 0", () => {
		const state = stepper(initialStepper, { type: "run", source: "(1 + 2) + 3" }, good);
		expect(state).toEqual({ status: "ready", trace, index: 0, playing: false });
	});

	it("run with a parse error reports it", () => {
		const state = stepper(initialStepper, { type: "run", source: "map (\\x -> x +) [1]" }, fail);
		expect(state).toEqual({ status: "error", error: "expected an expression" });
	});

	it("next advances one frame", () => {
		const state = stepper(stepper(initialStepper, { type: "run", source: "(1 + 2) + 3" }, good), { type: "next" });
		expect(state.status === "ready" && state.index).toBe(1);
	});

	it("next on the last frame stays put", () => {
		const base = stepper(initialStepper, { type: "run", source: "(1 + 2) + 3" }, good);
		const end = stepper(stepper(stepper(base, { type: "next" }), { type: "next" }), { type: "next" });
		expect(end.status === "ready" && end.index).toBe(2);
	});

	it("back clamps at frame 0", () => {
		const base = stepper(initialStepper, { type: "run", source: "(1 + 2) + 3" }, good);
		expect(stepper(base, { type: "back" })).toEqual(base);
		const atOne = stepper(base, { type: "next" });
		expect(stepper(atOne, { type: "back" })).toEqual(base);
	});

	it("seek lands on the asked frame", () => {
		const base = stepper(initialStepper, { type: "run", source: "(1 + 2) + 3" }, good);
		const state = stepper(base, { type: "seek", index: 2 });
		expect(state.status === "ready" && state.index).toBe(2);
	});

	it("seek past the end clamps to the last frame", () => {
		const base = stepper(initialStepper, { type: "run", source: "(1 + 2) + 3" }, good);
		const state = stepper(base, { type: "seek", index: 99 });
		expect(state.status === "ready" && state.index).toBe(2);
	});

	it("play starts playback", () => {
		const base = stepper(initialStepper, { type: "run", source: "(1 + 2) + 3" }, good);
		const state = stepper(base, { type: "play" });
		expect(state.status === "ready" && state.playing).toBe(true);
	});

	it("play on the last frame is a no-op", () => {
		const base = stepper(initialStepper, { type: "run", source: "(1 + 2) + 3" }, good);
		const end = stepper(base, { type: "seek", index: 2 });
		const state = stepper(end, { type: "play" });
		expect(state.status === "ready" && state.playing).toBe(false);
	});

	it("pause stops playback", () => {
		const base = stepper(initialStepper, { type: "run", source: "(1 + 2) + 3" }, good);
		const playing = stepper(base, { type: "play" });
		const paused = stepper(playing, { type: "pause" });
		expect(paused.status === "ready" && paused.playing).toBe(false);
	});

	it("tick advances only while playing", () => {
		const base = stepper(initialStepper, { type: "run", source: "(1 + 2) + 3" }, good);
		const idle = stepper(base, { type: "tick" });
		expect(idle).toBe(base);
		const playing = stepper(base, { type: "play" });
		const after = stepper(playing, { type: "tick" });
		expect(after.status === "ready" && after.index).toBe(1);
	});

	it("tick reaching the last frame stops playback immediately", () => {
		const base = stepper(initialStepper, { type: "run", source: "(1 + 2) + 3" }, good);
		const atOne = stepper(base, { type: "seek", index: 1 });
		const playing = stepper(atOne, { type: "play" });
		const after = stepper(playing, { type: "tick" });
		expect(after.status === "ready" && after.index).toBe(2);
		expect(after.status === "ready" && after.playing).toBe(false);
	});

	it("frameCount and frameAt expose the frames", () => {
		const state = stepper(initialStepper, { type: "run", source: "(1 + 2) + 3" }, good);
		expect(frameCount(state)).toBe(3);
		expect(frameAt(state, 0)).toEqual(sum);
		expect(frameAt(state, 1)).toEqual(mid);
		expect(frameAt(state, 2)).toEqual(six);
	});
});