import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { Expr, Path, Step } from "../lang/ast.ts";
import { initialPractice, practice, type PracticeState } from "../practice.ts";
import ExprView from "./ExprView.tsx";

type Props = {
	readonly steps: readonly Step[];
	readonly start: Expr;
};

const RULE_TEXT: Readonly<Record<string, string>> = {
	arith: "this operation has two values, so it runs now",
	compare: "this comparison has two values, so it runs now",
	cons: "a value joining a list runs now",
	beta: "a function applied to a value runs now",
	let: "a let whose value is ready substitutes now",
	"if-true": "the condition is True, so this branch runs now",
	"if-false": "the condition is False, so this branch runs now",
	map: "map on a list of values runs now",
	"filter-cons": "filter on a list of values runs now",
	"filter-nil": "filter on an empty list runs now",
	"foldl-cons": "foldl reads the list from the left, so this box runs now",
	"foldl-nil": "foldl on an empty list returns the seed now",
	"foldr-cons": "foldr reads the list from the right, so this box runs now",
	"foldr-nil": "foldr on an empty list returns the seed now",
};

const frameAtExpr = (steps: readonly Step[], start: Expr, index: number): Expr =>
	steps.slice(0, index).reduce<Expr>((_, step) => step.after, start);

export default function Practice({ steps, start }: Props) {
	const [state, dispatch] = useReducer(
		(state: PracticeState, event: Parameters<typeof practice>[1]) => practice(state, event, steps),
		[steps],
		([initialSteps]) => initialPractice(initialSteps),
	);
	const painted = useRef<number | undefined>(undefined);
	const total = steps.length;

	const pick = useCallback(
		(path: Path) => {
			painted.current = performance.now();
			dispatch({ type: "answer", path });
		},
		[dispatch],
	);

	useEffect(() => {
		if (painted.current === undefined) return;
		const at = painted.current;
		painted.current = undefined;
		let second = 0;
		const first = requestAnimationFrame(() => {
			second = requestAnimationFrame(() => console.log(`[redex] answer-to-paint ${Math.round(performance.now() - at)} ms`));
		});
		return () => {
			cancelAnimationFrame(first);
			cancelAnimationFrame(second);
		};
	}, [state]);

	const frame = state.phase === "done" ? undefined : frameAtExpr(steps, start, state.index);
	const step = state.phase === "done" ? undefined : steps[state.index];
	const hint = useMemo(() => {
		if (!step) return undefined;
		if (state.phase === "wrong") {
			const clickedInsideLam = walkToLam(frameAtExpr(steps, start, state.index), state.clicked);
			if (clickedInsideLam) return "Code inside a lambda runs only after the lambda gets an argument.";
			if (state.clicked.length < step.path.length && state.clicked.every((n, i) => n === step.path[i])) return "This part runs, but something inside it runs first.";
			return RULE_TEXT[step.rule] ?? `${step.rule} runs here.`;
		}
		return undefined;
	}, [state, step, steps, start]);

	if (state.phase === "done") {
		return (
			<section className="practice" aria-label="Practice result">
				<p className="practice-ask">
					{total === 0 ? "Nothing to practice. This program is already a value." : `Done. Score ${state.score} / ${total}.`}
				</p>
				<button type="button" className="practice-next" onClick={() => dispatch({ type: "reset" })}>
					Practice again
				</button>
			</section>
		);
	}

	return (
		<div className="practice">
			<p className="practice-ask">Which part runs next?</p>
			<ExprView
				frame={frame ?? start}
				nextPath={state.phase === "wrong" ? step?.path : undefined}
				nextRule={undefined}
				stuckPath={undefined}
				stuckReason={undefined}
				pick={state.phase === "ask" ? pick : undefined}
				wrongPath={state.phase === "wrong" ? state.clicked : undefined}
			/>
			<p className="practice-score" aria-live="polite">
				{state.phase === "ask" && `Step ${state.index + 1} of ${total} · score ${state.score} / ${state.index + (state.phase === "ask" ? 1 : 0)}`}
				{state.phase === "right" && <span className="right">Right, {steps[state.index].rule} runs first · score {state.score} / {state.index + 1}</span>}
				{state.phase === "wrong" && (
					<span className="wrong">
						Not this one. {hint} · score {state.score} / {state.index + 1}
					</span>
				)}
			</p>
			{state.phase !== "ask" && (
				<button type="button" className="practice-next" onClick={() => dispatch({ type: "next" })}>
					{state.index + 1 < total ? "Next step" : "See score"}
				</button>
			)}
		</div>
	);
}

function walkToLam(expr: Expr, path: Path): boolean {
	let node: Expr = expr;
	for (let i = 0; i < path.length; i++) {
		if (node.tag === "lam") return true;
		const children = childrenOfExpr(node);
		const next = children[path[i]];
		if (!next) return false;
		node = next;
	}
	return node.tag === "lam";
}

function childrenOfExpr(e: Expr): readonly Expr[] {
	switch (e.tag) {
		case "num":
		case "bool":
		case "var":
		case "builtin":
			return [];
		case "lam":
			return [e.body];
		case "app":
			return [e.fn, e.arg];
		case "binop":
			return [e.left, e.right];
		case "cons":
			return [e.head, e.tail];
		case "if":
			return [e.cond, e.then, e.else];
		case "let":
			return [e.value, e.body];
		case "list":
			return e.items;
	}
}