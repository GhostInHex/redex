import { useCallback, useEffect, useReducer, useRef } from "react";
import type { Expr, Path, Step, Trace } from "../lang/ast.ts";
import { initialPractice, practice, type PracticeEvent, type PracticeState } from "../practice.ts";
import ExprView from "./ExprView.tsx";
import { supportsInteractiveRendering } from "./interactiveRendering.ts";

type Props = { readonly trace: Trace };
type Session = { readonly trace: Trace; readonly progress: PracticeState };
type Event = PracticeEvent | { readonly type: "replace"; readonly trace: Trace };

const initialSession = (trace: Trace): Session => ({ trace, progress: initialPractice(trace.steps) });
const sessionReducer = (session: Session, event: Event): Session =>
	event.type === "replace"
		? initialSession(event.trace)
		: { trace: session.trace, progress: practice(session.progress, event, session.trace.steps) };

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

const childrenOfExpr = (e: Expr): readonly Expr[] => {
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
};

const pathWithinLam = (expr: Expr, path: Path): boolean => {
	let node: Expr | undefined = expr;
	for (let i = 0; i < path.length; i++) {
		if (!node || node.tag === "lam") return true;
		node = childrenOfExpr(node)[path[i]];
	}
	return false;
};

export default function Practice({ trace }: Props) {
	const [session, dispatch] = useReducer(sessionReducer, trace, initialSession);
	const painted = useRef<number | undefined>(undefined);
	const pick = useCallback((path: Path) => {
		painted.current = performance.now();
		dispatch({ type: "answer", path });
	}, []);

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
	}, [session]);

	if (session.trace !== trace) {
		dispatch({ type: "replace", trace });
		return null;
	}

	const state = session.progress;
	const { steps, start, outcome } = session.trace;
	const total = steps.length;
	if (state.phase === "done") {
		const frame = steps.at(-1)?.after ?? start;
		const emptyMessage = outcome.tag === "value"
			? "Nothing to practice. This program is already a value."
			: outcome.tag === "stuck"
				? "Nothing to practice. Evaluation is stuck."
				: "Nothing to practice. Evaluation reached a limit.";
		return (
			<section className="practice" aria-label="Practice result">
				<p className="practice-ask">{total === 0 ? emptyMessage : `Done. Score ${state.score} / ${total}.`}</p>
				<ExprView
					frame={frame}
					nextPath={undefined}
					nextRule={undefined}
					stuckPath={outcome.tag === "stuck" ? outcome.path : undefined}
					stuckReason={outcome.tag === "stuck" ? outcome.reason : undefined}
					limitKind={outcome.tag === "limit" ? outcome.kind : undefined}
				/>
				{outcome.tag === "stuck" && <p className="practice-score">Stopped at path {outcome.path.length === 0 ? "root" : outcome.path.join(".")}.</p>}
				<p className="practice-score" aria-live="polite">Score {state.score} / {total}.</p>
				{total > 0 && <button type="button" className="practice-next" onClick={() => dispatch({ type: "reset" })}>
					Practice again
				</button>}
			</section>
		);
	}

	const frame = frameAtExpr(steps, start, state.index);
	const step = steps[state.index];
	if (!supportsInteractiveRendering(frame)) {
		return (
			<section className="practice" aria-label="Practice display limit">
				<p className="practice-ask" role="status">This expression is too deeply nested for interactive practice. Use Watch to inspect its plain-text trace.</p>
				<ExprView frame={frame} nextPath={undefined} nextRule={undefined} stuckPath={undefined} stuckReason={undefined} limitKind={undefined} showNote={false} />
			</section>
		);
	}

	let hint: string | undefined;
	if (state.phase === "wrong") {
		if (pathWithinLam(frame, state.clicked)) hint = "Code inside a lambda runs only after the lambda gets an argument.";
		else if (state.clicked.length < step.path.length && state.clicked.every((n, i) => n === step.path[i])) hint = "This part runs, but something inside it runs first.";
		else hint = RULE_TEXT[step.rule] ?? `${step.rule} runs here.`;
	}
	return (
		<div className="practice">
			<p className="practice-ask">Which part runs next?</p>
			<ExprView
				frame={frame}
				nextPath={state.phase === "wrong" ? step.path : undefined}
				nextRule={undefined}
				stuckPath={undefined}
				stuckReason={undefined}
				limitKind={undefined}
				showNote={false}
				pick={state.phase === "ask" ? pick : undefined}
				wrongPath={state.phase === "wrong" ? state.clicked : undefined}
			/>
			<p className="practice-score" aria-live="polite">
				{state.phase === "ask" && `Step ${state.index + 1} of ${total} · score ${state.score} / ${state.index + 1}`}
				{state.phase === "right" && <span className="right">Right, {step.rule} runs first · score {state.score} / {state.index + 1}</span>}
				{state.phase === "wrong" && <span className="wrong">Not this one. {hint} · score {state.score} / {state.index + 1}</span>}
			</p>
			{state.phase !== "ask" && (
				<button type="button" className="practice-next" onClick={() => dispatch({ type: "next" })}>
					{state.index + 1 < total ? "Next step" : "See score"}
				</button>
			)}
		</div>
	);
}
