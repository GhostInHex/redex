import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import type { ParseError } from "../lang/ast.ts";
import { parse } from "../lang/parser.ts";
import { trace } from "../lang/trace.ts";
import { EXAMPLES } from "../lang/examples.ts";
import Editor from "./Editor.tsx";
import ExprView from "./ExprView.tsx";
import Timeline from "./Timeline.tsx";
import { frameAt, initialStepper, stepper, type RunSource, type StepperState } from "./stepper.ts";

const runSource: RunSource = (source) => {
	const parsed = parse(source);
	if (!parsed.ok) return { error: parsed.error.message };
	return { trace: trace(parsed.expr) };
};

type ReducerEvent = Parameters<typeof stepper>[1];
const reduce = (state: StepperState, event: ReducerEvent) => stepper(state, event, runSource);

export default function App() {
	const [source, setSource] = useState(() => EXAMPLES.find((example) => example.id === "sum-of-squares")!.source);
	const [state, dispatch] = useReducer(reduce, initialStepper);
	const [parseError, setParseError] = useState<ParseError | undefined>(undefined);
	const runPendingTime = useRef<number | null>(null);

	const onSourceChange = useCallback((nextSource: string) => {
		setSource(nextSource);
		dispatch({ type: "edit" });
		const parsed = parse(nextSource);
		setParseError(parsed.ok ? undefined : parsed.error);
	}, []);

	const run = useCallback(() => {
		runPendingTime.current = performance.now();
		const parsed = parse(source);
		if (!parsed.ok) {
			setParseError(parsed.error);
		} else {
			setParseError(undefined);
		}
		dispatch({ type: "run", source });
	}, [source]);

	useLayoutEffect(() => {
		if (runPendingTime.current !== null && state.status === "ready") {
			const t0 = runPendingTime.current;
			runPendingTime.current = null;
			requestAnimationFrame(() => {
				const duration = performance.now() - t0;
				console.log(`[redex] run-to-paint ${duration.toFixed(2)} ms`);
			});
		}
	}, [state]);

	useEffect(() => {
		if (state.status !== "ready" || !state.playing) return;
		const id = window.setInterval(() => dispatch({ type: "tick" }), 240);
		return () => window.clearInterval(id);
	}, [state]);

	const ready = state.status === "ready";
	const playing = ready && state.playing;
	const index = ready ? state.index : 0;
	const last = ready ? state.trace.steps.length : 0;
	const frame = ready ? frameAt(state, state.index) : undefined;
	const nextStep = ready && state.index < state.trace.steps.length ? state.trace.steps[state.index] : undefined;
	const stuck = ready && state.index === state.trace.steps.length && state.trace.outcome.tag === "stuck" ? state.trace.outcome : undefined;
	const limitKind = ready && state.index === state.trace.steps.length && state.trace.outcome.tag === "limit" ? state.trace.outcome.kind : undefined;

	return (
		<main className="app">
			<header className="bar">
				<h1>redex</h1>
				<button type="button" className="run" onClick={run}>
					Run
				</button>
			</header>
			<Editor source={source} errorLine={parseError?.line} errorCol={parseError?.col} onChange={onSourceChange} />
			{parseError && <p className="error">{parseError.message}</p>}
			{ready && frame && (
				<>
					<ExprView
						frame={frame}
						nextPath={nextStep?.path}
						nextRule={nextStep?.rule}
						stuckPath={stuck?.path}
						stuckReason={stuck?.reason}
						limitKind={limitKind}
					/>
					<Timeline
						index={index}
						last={last}
						playing={playing}
						onBack={() => dispatch({ type: "back" })}
						onNext={() => dispatch({ type: "next" })}
						onSeek={(seek) => dispatch({ type: "seek", index: seek })}
						onPlay={() => dispatch({ type: "play" })}
						onPause={() => dispatch({ type: "pause" })}
					/>
				</>
			)}
		</main>
	);
}