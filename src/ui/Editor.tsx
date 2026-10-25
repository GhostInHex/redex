import { useEffect, useRef } from "react";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, keymap, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { basicSetup } from "codemirror";

type Props = {
	readonly source: string;
	readonly errorLine: number | undefined;
	readonly errorCol: number | undefined;
	readonly onChange: (source: string) => void;
};

const setError = StateEffect.define<{ readonly line: number; readonly col: number }>();
const clearError = StateEffect.define<null>();

const errorMark = Decoration.mark({ class: "cm-parse-error" });

const markAt = ({ line, col }: { readonly line: number; readonly col: number }, state: EditorState): DecorationSet => {
	if (state.doc.length === 0) return Decoration.none;
	const lineNum = Math.min(Math.max(line, 1), state.doc.lines);
	const docLine = state.doc.line(lineNum);
	if (docLine.length === 0) return Decoration.none;
	const safeCol = Math.min(Math.max(col, 1), docLine.length);
	const from = docLine.from + safeCol - 1;
	const to = Math.min(from + 1, docLine.to);
	if (from >= to) return Decoration.none;
	return Decoration.set([errorMark.range(from, to)]);
};

type ErrorFieldState = {
	readonly pos: { readonly line: number; readonly col: number } | null;
	readonly decos: DecorationSet;
};

const errorField = StateField.define<ErrorFieldState>({
	create: () => ({ pos: null, decos: Decoration.none }),
	update(value, transaction) {
		let pos = value.pos;
		let changed = false;
		for (const effect of transaction.effects) {
			if (effect.is(setError)) {
				pos = effect.value;
				changed = true;
			}
			if (effect.is(clearError)) {
				pos = null;
				changed = true;
			}
		}
		if (!pos) return { pos: null, decos: Decoration.none };
		if (changed || transaction.docChanged) {
			return { pos, decos: markAt(pos, transaction.state) };
		}
		return value;
	},
	provide: (field) => EditorView.decorations.from(field, (val) => val.decos),
});

export default function Editor({ source, errorLine, errorCol, onChange }: Props) {
	const host = useRef<HTMLDivElement>(null);
	const view = useRef<EditorView | null>(null);
	const change = useRef(onChange);
	change.current = onChange;

	useEffect(() => {
		const built = new EditorView({
			state: EditorState.create({
				doc: source,
				extensions: [
					basicSetup,
					history(),
					keymap.of([...defaultKeymap, ...historyKeymap]),
					errorField,
					EditorView.updateListener.of((update: ViewUpdate) => {
						if (update.docChanged) change.current(update.state.doc.toString());
					}),
					EditorView.lineWrapping,
				],
			}),
			parent: host.current!,
		});
		view.current = built;
		return () => {
			built.destroy();
			view.current = null;
		};
	}, []);

	useEffect(() => {
		const current = view.current;
		if (!current) return;
		if (errorLine !== undefined && errorCol !== undefined) {
			current.dispatch({ effects: setError.of({ line: errorLine, col: errorCol }) });
		} else {
			current.dispatch({ effects: clearError.of(null) });
		}
	}, [errorLine, errorCol]);

	return (
		<section className="editor" aria-label="Program editor">
			<div ref={host} />
		</section>
	);
}