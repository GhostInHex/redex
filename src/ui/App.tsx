import { useCallback, useEffect, useReducer, useState } from "react";
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

	const run = useCallback(() => {
		dispatch({ type: "run", source });
	}, [source]);

	useEffect(() => {
		if (state.status === "editing" || state.status === "error") {
			const parsed = parse(source);
			setParseError(parsed.ok ? undefined : parsed.error);
		} else setParseError(undefined);
	}, [source, state.status]);

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

	return (
		<main className="app">
			<header className="bar">
				<h1>redex</h1>
				<button type="button" className="run" onClick={run}>
					Run
				</button>
			</header>
			<Editor source={source} errorLine={parseError?.line} errorCol={parseError?.col} onChange={setSource} />
			{parseError && <p className="error">{parseError.message}</p>}
			{ready && frame && (
				<>
					<ExprView
						frame={frame}
						nextPath={nextStep?.path}
						nextRule={nextStep?.rule}
						stuckPath={stuck?.path}
						stuckReason={stuck?.reason}
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
