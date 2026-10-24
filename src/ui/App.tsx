import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties } from "react";
import type { ParseError } from "../lang/ast.ts";
import { parse } from "../lang/parser.ts";
import { trace } from "../lang/trace.ts";
import { EXAMPLES } from "../lang/examples.ts";
import { embedSnippet, readHash, shareHref } from "../share.ts";
import Editor from "./Editor.tsx";
import Embed from "./Embed.tsx";
import Examples from "./Examples.tsx";
import ExprView from "./ExprView.tsx";
import Timeline from "./Timeline.tsx";
import Practice from "./Practice.tsx";
import { frameAt, initialStepper, stepper, type RunSource, type StepperState } from "./stepper.ts";

const runSource: RunSource = (source) => {
	const parsed = parse(source);
	if (!parsed.ok) return { error: parsed.error.message };
	return { trace: trace(parsed.expr) };
};

type ReducerEvent = Parameters<typeof stepper>[1];
const reduce = (state: StepperState, event: ReducerEvent) => stepper(state, event, runSource);

const DEFAULT_SOURCE = EXAMPLES.find((example) => example.id === "sum-of-squares")!.source;
const EMBED = new URLSearchParams(location.search).get("embed") === "1";
const BASE = `${location.origin}${location.pathname}`;

type Entry = {
	readonly source: string;
	readonly shared: boolean;
	readonly notice: string | undefined;
};

const readEntry = (): Entry => {
	const hash = readHash(location.hash);
	if (hash.kind === "program") return { source: hash.program, shared: true, notice: undefined };
	if (hash.kind === "bad") {
		return { source: DEFAULT_SOURCE, shared: false, notice: "This link could not be read, so the default example is loaded." };
	}
	return { source: DEFAULT_SOURCE, shared: false, notice: undefined };
};

const copyText = async (text: string): Promise<boolean> => {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		const area = document.createElement("textarea");
		area.value = text;
		area.setAttribute("readonly", "");
		area.style.position = "fixed";
		area.style.opacity = "0";
		document.body.append(area);
		area.select();
		let ok = false;
		try {
			ok = document.execCommand("copy");
		} catch {
			ok = false;
		}
		area.remove();
		return ok;
	}
};

const backdrop: CSSProperties = {
	position: "fixed",
	inset: 0,
	zIndex: 40,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	padding: 16,
	background: "rgba(8, 10, 14, 0.72)",
};

const panel: CSSProperties = {
	width: "min(640px, 100%)",
	display: "flex",
	flexDirection: "column",
	gap: 12,
	padding: 20,
	borderRadius: 12,
	border: "1px solid #3a3f4f",
	background: "#1b1e28",
	boxShadow: "0 24px 60px rgba(0, 0, 0, 0.6)",
};

const field: CSSProperties = {
	width: "100%",
	boxSizing: "border-box",
	font: "inherit",
	fontSize: 13,
	padding: "8px 10px",
	borderRadius: 8,
	border: "1px solid #3a3f4f",
	background: "#14161c",
	color: "#e8eaf0",
};

const row: CSSProperties = {
	display: "flex",
	flexWrap: "wrap",
	gap: 8,
	alignItems: "center",
};

const hint: CSSProperties = {
	margin: 0,
	color: "#8b93a7",
	fontSize: 13,
};

export default function App() {
	const [entry] = useState(readEntry);
	const [source, setSource] = useState(entry.source);
	const [state, dispatch] = useReducer(
		reduce,
		initialStepper,
		(start: StepperState): StepperState =>
			entry.shared || EMBED ? stepper(start, { type: "run", source: entry.source }, runSource) : start,
	);
	const [mode, setMode] = useState<"watch" | "practice">("watch");
	const [parseError, setParseError] = useState<ParseError | undefined>(undefined);
	const [editorEpoch, setEditorEpoch] = useState(0);
	const [shareOpen, setShareOpen] = useState(false);
	const [copied, setCopied] = useState<"" | "link" | "embed">("");
	const timer = useRef<number | undefined>(undefined);

	const setWatch = useCallback(() => setMode("watch"), []);
	const setPractice = useCallback(() => setMode("practice"), []);
	const run = useCallback(() => {
		dispatch({ type: "run", source });
	}, [source]);

	const pick = useCallback((next: string) => {
		setSource(next);
		setEditorEpoch((epoch) => epoch + 1);
		dispatch({ type: "run", source: next });
	}, []);

	const link = shareHref(BASE, source);
	const embedLink = shareHref(`${BASE}?embed=1`, source);
	const snippet = embedSnippet(embedLink);

	const copy = useCallback((text: string, what: "link" | "embed") => {
		void copyText(text).then((ok) => {
			window.clearTimeout(timer.current);
			setCopied(ok ? what : "");
			timer.current = window.setTimeout(() => setCopied(""), 2400);
		});
	}, []);

	useEffect(() => () => window.clearTimeout(timer.current), []);

	useEffect(() => {
		if (!shareOpen) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setShareOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [shareOpen]);

	useEffect(() => {
		if (!entry.shared && !EMBED) return;
		let second = 0;
		const first = requestAnimationFrame(() => {
			second = requestAnimationFrame(() => console.log(`[redex] run-to-paint ${Math.round(performance.now())} ms`));
		});
		return () => {
			cancelAnimationFrame(first);
			cancelAnimationFrame(second);
		};
	}, [entry.shared]);

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

	const stepperView =
		mode === "practice" && ready ? (
			<Practice steps={state.trace.steps} start={state.trace.start} />
		) : ready && frame ? (
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
		) : null;

	if (EMBED) {
		return (
			<Embed program={source}>
				{entry.notice && <p className="error">{entry.notice}</p>}
				{state.status === "error" && <p className="error">{state.error}</p>}
				<div className="mode-toggle" role="group" aria-label="Playback mode">
					<button type="button" className={mode === "watch" ? "mode on" : "mode"} aria-pressed={mode === "watch"} onClick={setWatch}>
						Watch
					</button>
					<button type="button" className={mode === "practice" ? "mode on" : "mode"} aria-pressed={mode === "practice"} onClick={setPractice}>
						Practice
					</button>
				</div>
				{stepperView}
			</Embed>
		);
	}

	return (
		<main className="app">
			<header className="bar">
				<h1>redex</h1>
				<button type="button" className="run" onClick={run}>
					Run
				</button>
				<div className="mode-toggle" role="group" aria-label="Playback mode">
					<button type="button" className={mode === "watch" ? "mode on" : "mode"} aria-pressed={mode === "watch"} onClick={setWatch}>
						Watch
					</button>
					<button type="button" className={mode === "practice" ? "mode on" : "mode"} aria-pressed={mode === "practice"} onClick={setPractice}>
						Practice
					</button>
				</div>
				<Examples onPick={pick} />
				<button
					type="button"
					aria-label="Share this program"
					onClick={() => {
						setShareOpen(true);
						copy(link, "link");
					}}
				>
					{copied === "link" ? "Link copied" : "Share"}
				</button>
			</header>
			{entry.notice && <p className="notice">{entry.notice}</p>}
			<Editor key={editorEpoch} source={source} errorLine={parseError?.line} errorCol={parseError?.col} onChange={setSource} />
			{state.status !== "error" && parseError && <p className="error">{parseError.message}</p>}
			{state.status === "error" && <p className="error">{state.error}</p>}
			{stepperView}
			{shareOpen && (
				<div style={backdrop} onClick={() => setShareOpen(false)}>
					<section
						role="dialog"
						aria-modal="true"
						aria-label="Share this program"
						style={panel}
						onClick={(event) => event.stopPropagation()}
					>
						<h2 style={{ margin: 0, fontSize: 18 }}>Share this program</h2>
						<p style={hint}>The whole program lives in the link, so anyone who opens it sees exactly this source.</p>
						<input style={field} readOnly aria-label="Share link" value={link} onFocus={(event) => event.currentTarget.select()} />
						<div style={row}>
							<button type="button" onClick={() => copy(link, "link")}>
								{copied === "link" ? "Link copied" : "Copy link"}
							</button>
							<button type="button" onClick={() => setShareOpen(false)}>
								Close
							</button>
						</div>
						<p style={hint}>Embed the stepper on a lesson page.</p>
						<textarea
							style={{ ...field, resize: "vertical" }}
							readOnly
							rows={3}
							aria-label="Embed code"
							value={snippet}
							onFocus={(event) => event.currentTarget.select()}
						/>
						<div style={row}>
							<button type="button" onClick={() => copy(snippet, "embed")}>
								{copied === "embed" ? "Code copied" : "Copy embed code"}
							</button>
						</div>
					</section>
				</div>
			)}
		</main>
	);
}
