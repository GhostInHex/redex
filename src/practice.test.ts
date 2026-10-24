import { describe, expect, it } from "vitest";
import { trace } from "./lang/trace.ts";
import { parse } from "./lang/parser.ts";
import { initialPractice, practice, type PracticeState } from "./practice.ts";

const stepsOf = (source: string) => {
	const parsed = parse(source);
	if (!parsed.ok) throw new Error(parsed.error.message);
	return trace(parsed.expr).steps;
};

describe("practice reducer", () => {
	it("scores a right click and holds on the rule", () => {
		const steps = stepsOf("1 + 2 * 3");
		let state: PracticeState = initialPractice(steps);
		state = practice(state, { type: "answer", path: steps[0].path }, steps);
		expect(state).toEqual({ phase: "right", index: 0, score: 1 });
	});

	it("marks a wrong click and keeps the score", () => {
		const steps = stepsOf("1 + 2 * 3");
		let state: PracticeState = initialPractice(steps);
		state = practice(state, { type: "answer", path: [0] }, steps);
		expect(state).toEqual({ phase: "wrong", index: 0, clicked: [0], score: 0 });
		state = practice(state, { type: "next" }, steps);
		expect(state).toEqual({ phase: "ask", index: 1, score: 0 });
	});

	it("finishes on the last step", () => {
		const steps = stepsOf("1 + 2");
		expect(steps).toHaveLength(1);
		let state: PracticeState = initialPractice(steps);
		state = practice(state, { type: "answer", path: steps[0].path }, steps);
		expect(state).toEqual({ phase: "done", score: 1 });
	});

	it("starts done on a zero-step trace", () => {
		const steps = stepsOf("42");
		expect(steps).toHaveLength(0);
		expect(initialPractice(steps)).toEqual({ phase: "done", score: 0 });
	});
});