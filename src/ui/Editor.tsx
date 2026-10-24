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

const errorField = StateField.define<DecorationSet>({
	create: () => Decoration.none,
	update(value, transaction) {
		let decorations = transaction.docChanged ? Decoration.none : value;
		for (const effect of transaction.effects) {
			if (effect.is(setError)) decorations = markAt(effect.value, transaction.state);
			if (effect.is(clearError)) decorations = Decoration.none;
		}
		return decorations;
	},
	provide: (field) => EditorView.decorations.from(field),
});

const markAt = ({ line, col }: { readonly line: number; readonly col: number }, state: EditorState): DecorationSet => {
	const docLine = state.doc.line(Math.min(Math.max(line, 1), state.doc.lines));
	const safeCol = Math.min(Math.max(col, 1), Math.max(docLine.length, 1));
	const from = docLine.from + safeCol - 1;
	const to = Math.min(from + 1, docLine.to);
	return Decoration.set([errorMark.range(from, to)]);
};

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
		if (errorLine !== undefined && errorCol !== undefined) current.dispatch({ effects: setError.of({ line: errorLine, col: errorCol }) });
		else current.dispatch({ effects: clearError.of(null) });
	}, [errorLine, errorCol]);

	return (
		<section className="editor" aria-label="Program editor">
			<div ref={host} />
		</section>
	);
}
