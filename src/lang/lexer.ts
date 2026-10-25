import type { Op, ParseError } from "./ast.ts";

export type Keyword = "let" | "in" | "if" | "then" | "else" | "True" | "False";
export type Sym = Op | "\\" | "->" | "=" | "(" | ")" | "[" | "]" | "," | ":";

type Pos = { readonly line: number; readonly col: number };

export type Token = Pos & (
	| { readonly kind: "int"; readonly text: string }
	| { readonly kind: "ident"; readonly text: string }
	| { readonly kind: "keyword"; readonly text: Keyword }
	| { readonly kind: "symbol"; readonly text: Sym }
	| { readonly kind: "eof"; readonly text: "" }
);

export type LexResult = { readonly ok: true; readonly tokens: readonly Token[] } | { readonly ok: false; readonly error: ParseError };

const KEYWORDS: ReadonlySet<string> = new Set<Keyword>(["let", "in", "if", "then", "else", "True", "False"]);
const isKeyword = (text: string): text is Keyword => KEYWORDS.has(text);

const SYMBOLS: readonly Sym[] = [
	"->", "==", "<=", ">=",
	"\\", "=", "(", ")", "[", "]", ",", ":", "+", "-", "*", "/", "%", "<", ">",
];

const isDigit = (ch: string) => ch >= "0" && ch <= "9";
const isIdentStart = (ch: string) => (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
const isIdentPart = (ch: string) => isIdentStart(ch) || isDigit(ch) || ch === "'";

export function lex(source: string): LexResult {
	const tokens: Token[] = [];
	let i = 0;
	let line = 1;
	let lineStart = 0;

	const scan = (pred: (ch: string) => boolean) => {
		while (i < source.length && pred(source[i])) i++;
	};

	while (i < source.length) {
		const ch = source[i];
		if (ch === "\n") {
			i++;
			line++;
			lineStart = i;
			continue;
		}
		if (ch === " " || ch === "\t" || ch === "\r") {
			i++;
			continue;
		}
		if (source.startsWith("--", i)) {
			scan((c) => c !== "\n");
			continue;
		}

		const start = i;
		const pos = { line, col: start - lineStart + 1 };
		if (isDigit(ch)) {
			scan(isDigit);
			tokens.push({ ...pos, kind: "int", text: source.slice(start, i) });
		} else if (isIdentStart(ch)) {
			scan(isIdentPart);
			const text = source.slice(start, i);
			tokens.push(isKeyword(text) ? { ...pos, kind: "keyword", text } : { ...pos, kind: "ident", text });
		} else {
			const sym = SYMBOLS.find((s) => source.startsWith(s, i));
			if (sym === undefined) {
				const char = String.fromCodePoint(source.codePointAt(i)!);
				return { ok: false, error: { ...pos, message: `unexpected character ${JSON.stringify(char)}` } };
			}
			i += sym.length;
			tokens.push({ ...pos, kind: "symbol", text: sym });
		}
	}

	const last = tokens.at(-1);
	const end = last ? { line: last.line, col: last.col + last.text.length } : { line: 1, col: 1 };
	tokens.push({ ...end, kind: "eof", text: "" });
	return { ok: true, tokens };
}
