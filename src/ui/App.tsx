import { Icon, ArrowUpRight } from "../components/glaze/icon.tsx";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import type { ParseError } from "../lang/ast.ts";
import { parse } from "../lang/parser.ts";
import { trace } from "../lang/trace.ts";
import { EXAMPLES } from "../lang/examples.ts";
import { embedSnippet, shareHref } from "../share.ts";
import { Button, buttonVariants } from "../components/glaze/ui/button.tsx";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  CardMeta,
} from "../components/glaze/ui/card.tsx";
import { appRoot, type ProgramEntry } from "../entry.ts";
import Brand from "./Brand.tsx";
import Editor from "./Editor.tsx";
import Embed from "./Embed.tsx";
import Examples from "./Examples.tsx";
import ExprView from "./ExprView.tsx";
import Practice from "./Practice.tsx";
import Timeline from "./Timeline.tsx";
import {
  frameAt,
  initialStepper,
  stepper,
  type RunSource,
  type StepperState,
} from "./stepper.ts";

const runSource: RunSource = (source) => {
  const parsed = parse(source);
  if (!parsed.ok) return { error: parsed.error.message };
  return { trace: trace(parsed.expr) };
};

type ReducerEvent = Parameters<typeof stepper>[1];
const reduce = (state: StepperState, event: ReducerEvent) =>
  stepper(state, event, runSource);

const copyText = async (
  text: string,
  dialog: HTMLDialogElement | null,
): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const focused = document.activeElement;
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    (dialog?.open ? dialog : document.body).append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    if (focused instanceof HTMLElement && focused.isConnected)
      focused.focus({ preventScroll: true });
    return ok;
  }
};

export default function App({ entry }: { readonly entry: ProgramEntry }) {
  const EMBED = entry.kind === "embed";
  const BASE = `${location.origin}${appRoot()}play`;
  const [source, setSource] = useState(() => {
    if (entry.shared || entry.notice || EMBED) return entry.source;
    try {
      return sessionStorage.getItem("redex:draft") ?? entry.source;
    } catch {
      return entry.source;
    }
  });
  useEffect(() => {
    if (!EMBED) {
      try {
        sessionStorage.setItem("redex:draft", source);
      } catch {
        /* Storage can be disabled without preventing evaluation. */
      }
    }
  }, [source, EMBED]);
  const [state, dispatch] = useReducer(
    reduce,
    initialStepper,
    (start: StepperState): StepperState =>
      entry.shared || EMBED
        ? stepper(start, { type: "run", source: entry.source }, runSource)
        : start,
  );
  const [mode, setMode] = useState<"watch" | "practice">(
    new URLSearchParams(location.search).get("mode") === "practice"
      ? "practice"
      : "watch",
  );
  const [parseError, setParseError] = useState<ParseError | undefined>(
    undefined,
  );
  const [editorEpoch, setEditorEpoch] = useState(0);
  const runPendingTime = useRef<number | null>(null);
  const shareDialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState<"" | "link" | "embed">("");
  const timer = useRef<number | undefined>(undefined);

  const onSourceChange = useCallback((nextSource: string) => {
    setSource(nextSource);
    dispatch({ type: "edit" });
    const parsed = parse(nextSource);
    setParseError(parsed.ok ? undefined : parsed.error);
  }, []);

  const setWatch = useCallback(() => setMode("watch"), []);
  const setPractice = useCallback(() => setMode("practice"), []);
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

  const pick = useCallback((next: string) => {
    setSource(next);
    setEditorEpoch((epoch) => epoch + 1);
    dispatch({ type: "run", source: next });
  }, []);

  const link = shareHref(BASE, source);
  const embedLink = shareHref(`${BASE}?embed=1`, source);
  const snippet = embedSnippet(embedLink);

  const copy = useCallback((text: string, what: "link" | "embed") => {
    void copyText(text, shareDialog.current).then((ok) => {
      window.clearTimeout(timer.current);
      setCopied(ok ? what : "");
      timer.current = window.setTimeout(() => setCopied(""), 2400);
    });
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!entry.shared && !EMBED) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() =>
        console.log(`[redex] run-to-paint ${Math.round(performance.now())} ms`),
      );
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
  const nextStep =
    ready && state.index < state.trace.steps.length
      ? state.trace.steps[state.index]
      : undefined;
  const stuck =
    ready &&
    state.index === state.trace.steps.length &&
    state.trace.outcome.tag === "stuck"
      ? state.trace.outcome
      : undefined;
  const limitKind =
    ready &&
    state.index === state.trace.steps.length &&
    state.trace.outcome.tag === "limit"
      ? state.trace.outcome.kind
      : undefined;

  const stepperView =
    mode === "practice" && ready ? (
      <Practice trace={state.trace} />
    ) : ready && frame ? (
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
    ) : null;

  if (EMBED) {
    return (
      <Embed program={source}>
        {entry.notice && <p className="error">{entry.notice}</p>}
        {state.status === "error" && <p className="error">{state.error}</p>}
        <div className="mode-toggle" role="group" aria-label="Playback mode">
          <Button
            variant="secondary"
            type="button"
            className={mode === "watch" ? "mode on" : "mode"}
            aria-pressed={mode === "watch"}
            onClick={setWatch}
          >
            Watch
          </Button>
          <Button
            variant="secondary"
            type="button"
            className={mode === "practice" ? "mode on" : "mode"}
            aria-pressed={mode === "practice"}
            onClick={setPractice}
          >
            Practice
          </Button>
        </div>
        {stepperView}
      </Embed>
    );
  }

  return (
    <main className="app">
      <header className="playground-header">
        <Brand />
        <a
          className={buttonVariants({ variant: "ghost", size: "sm" })}
          href="https://github.com/GhostInHex/redex"
          target="_blank"
          rel="noreferrer"
        >
          View source <Icon icon={ArrowUpRight} className="external-icon" />
        </a>
      </header>
      <section className="playground-intro">
        <div>
          <p className="section-index">Make the next step yours</p>
          <h1 className="type-title">The playground</h1>
        </div>
        <p>
          Write a little code. Follow each reduction.
          <br />
          Then switch to Practice and test your intuition.
        </p>
      </section>
      <header className="bar">
        <Button variant="primary" type="button" className="run" onClick={run}>
          Run
        </Button>
        <div className="mode-toggle" role="group" aria-label="Playback mode">
          <Button
            variant="secondary"
            type="button"
            className={mode === "watch" ? "mode on" : "mode"}
            aria-pressed={mode === "watch"}
            onClick={setWatch}
          >
            Watch
          </Button>
          <Button
            variant="secondary"
            type="button"
            className={mode === "practice" ? "mode on" : "mode"}
            aria-pressed={mode === "practice"}
            onClick={setPractice}
          >
            Practice
          </Button>
        </div>
        <Examples onPick={pick} />
        <Button
          variant="secondary"
          type="button"
          aria-label="Share this program"
          onClick={() => {
            shareDialog.current?.showModal();
            copy(link, "link");
          }}
        >
          {copied === "link" ? "Link copied" : "Share"}
        </Button>
      </header>
      {entry.notice && <p className="notice">{entry.notice}</p>}
      <div className="workspace-grid">
        <Card className="editor-panel">
          <CardHeader>
            <CardTitle>Program source</CardTitle>
          </CardHeader>
          <CardContent>
            <Editor
              key={editorEpoch}
              source={source}
              errorLine={parseError?.line}
              errorCol={parseError?.col}
              onChange={onSourceChange}
            />
            {state.status !== "error" && parseError && (
              <p className="error" role="alert">
                {parseError.message}
              </p>
            )}
            {state.status === "error" && (
              <p className="error" role="alert">
                {state.error}
              </p>
            )}
            <p className="lesson-note">
              {EXAMPLES.find((example) => example.source === source)?.lesson ??
                "Edit the program, then choose Run to create a fresh evaluation trace."}
            </p>
          </CardContent>
          <CardFooter>
            <CardMeta>A small functional language</CardMeta>
            <span className="type-caption text-text-2">
              Runs locally in your browser
            </span>
          </CardFooter>
        </Card>
        <Card className="evaluation-panel">
          <CardHeader>
            <CardTitle>
              {mode === "watch"
                ? "Follow the evaluation"
                : "Predict the next step"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stepperView ?? (
              <div className="evaluation-empty">
                <span className="empty-symbol" aria-hidden="true">
                  ↳
                </span>
                <h2 className="type-heading-sm">
                  Your next discovery starts here.
                </h2>
                <p>
                  Choose Run to evaluate your program,
                  <br />
                  or open one of the lesson examples.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <CardMeta>
              {mode === "watch"
                ? "Arrow keys to step · Space to play"
                : "Choose an expression with a pointer or keyboard"}
            </CardMeta>
          </CardFooter>
        </Card>
      </div>
      <details className="syntax-help">
        <summary>Need a little syntax help?</summary>
        <div className="syntax-grid">
          <p>
            <code>let x = 2 + 3 in x * x</code>
            <span>Name a value, then use it.</span>
          </p>
          <p>
            <code>{String.raw`(\x -> x + 1) 41`}</code>
            <span>Apply a function to an argument.</span>
          </p>
          <p>
            <code>{String.raw`map (\x -> x * 2) [1, 2, 3]`}</code>
            <span>Apply a function to every list item.</span>
          </p>
        </div>
      </details>
      <footer className="playground-footer">
        <a href={appRoot()}>← About Redex</a>
        <span>Watch it. Predict it. Understand it.</span>
      </footer>
      <dialog
        ref={shareDialog}
        className="share-dialog"
        aria-labelledby="share-title"
      >
        <h2 id="share-title" className="type-heading">
          Share this program
        </h2>
        <p className="share-hint">
          The whole program lives in the link, so anyone who opens it sees
          exactly this source.
        </p>
        <input
          className="share-field"
          autoFocus
          readOnly
          aria-label="Share link"
          value={link}
          onFocus={(event) => event.currentTarget.select()}
        />
        <div className="share-actions">
          <Button
            variant="secondary"
            type="button"
            onClick={() => copy(link, "link")}
          >
            {copied === "link" ? "Link copied" : "Copy link"}
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={() => shareDialog.current?.close()}
          >
            Close
          </Button>
        </div>
        <p className="share-hint">Embed the stepper on a lesson page.</p>
        <textarea
          className="share-field share-code"
          readOnly
          rows={3}
          aria-label="Embed code"
          value={snippet}
          onFocus={(event) => event.currentTarget.select()}
        />
        <div className="share-actions">
          <Button
            variant="secondary"
            type="button"
            onClick={() => copy(snippet, "embed")}
          >
            {copied === "embed" ? "Code copied" : "Copy embed code"}
          </Button>
        </div>
      </dialog>
    </main>
  );
}
