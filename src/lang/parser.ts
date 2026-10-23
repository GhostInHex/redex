import { isBuiltin, isOp, OP_TIER, type Expr, type Op, type ParseError, type ParseResult, type Tier } from "./ast.ts";
import { lex, type Keyword, type Sym, type Token } from "./lexer.ts";

const MAX_DEPTH = 500;

class ParseFailure {
	readonly error: ParseError;
	constructor(error: ParseError) {
		this.error = error;
	}
}

export function parse(source: string): ParseResult {
	const lexed = lex(source);
	if (!lexed.ok) return lexed;
	try {
		return { ok: true, expr: parseTokens(lexed.tokens) };
	} catch (e) {
		if (e instanceof ParseFailure) return { ok: false, error: e.error };
		throw e;
	}
}

const isSymbol = (t: Token, text: Sym) => t.kind === "symbol" && t.text === text;
const isCloser = (t: Token) => isSymbol(t, ")") || isSymbol(t, "]");
const unclosed = (opener: Token) => `unclosed "${opener.text}"`;

function parseTokens(tokens: readonly Token[]): Expr {
	let i = 0;
	let depth = 0;
	const open: Token[] = [];
	const peek = () => tokens[i];

	const fail = (at: Token, message: string): never => {
		const opener = at.kind === "eof" ? open.at(-1) : undefined;
		if (opener) return fail(opener, unclosed(opener));
		throw new ParseFailure({ message, line: at.line, col: at.col });
	};

	const is = (text: Keyword | Sym) => {
		const t = peek();
		return (t.kind === "keyword" || t.kind === "symbol") && t.text === text;
	};

	const eat = (text: Keyword | Sym) => {
		if (!is(text)) return false;
		i++;
		return true;
	};

	const expect = (text: Keyword | Sym) => {
		if (!eat(text)) fail(peek(), `expected "${text}"`);
	};

	const deeper = () => {
		if (++depth > MAX_DEPTH) fail(peek(), "expression is nested too deeply");
	};

	const nested = (parseInner: () => Expr): Expr => {
		const outer = depth;
		deeper();
		const result = parseInner();
		depth = outer;
		return result;
	};

	const bracketed = (opener: Token, closer: ")" | "]", parseInner: () => Expr): Expr => {
		open.push(opener);
		const result = parseInner();
		if (!eat(closer)) {
			const t = peek();
			if (isCloser(t)) fail(opener, unclosed(opener));
			fail(t, `unexpected "${t.text}"`);
		}
		open.pop();
		return result;
	};

	const name = (): string => {
		const t = peek();
		if (t.kind !== "ident" || isBuiltin(t.text)) return fail(t, "expected a name");
		i++;
		return t.text;
	};

	const int = (t: Token): number => {
		const value = Number(t.text);
		if (!Number.isSafeInteger(value)) fail(t, "number too large");
		return value;
	};

	const opAt = (tier: Tier): Op | undefined => {
		const t = peek();
		return t.kind === "symbol" && isOp(t.text) && OP_TIER[t.text] === tier ? t.text : undefined;
	};

	const expr = (): Expr =>
		nested(() => {
			if (eat("let")) {
				const bound = name();
				expect("=");
				const value = expr();
				expect("in");
				return { tag: "let", name: bound, value, body: expr() };
			}
			if (eat("\\")) {
				const params = [name()];
				while (peek().kind === "ident") {
					deeper();
					params.push(name());
				}
				expect("->");
				return params.reduceRight<Expr>((body, param) => ({ tag: "lam", param, body }), expr());
			}
			if (eat("if")) {
				const cond = expr();
				expect("then");
				const then = expr();
				expect("else");
				return { tag: "if", cond, then, else: expr() };
			}
			return cmp();
		});

	const cmp = (): Expr => {
		const left = cons();
		const op = opAt("cmp");
		if (!op) return left;
		i++;
		const right = cons();
		if (opAt("cmp")) fail(peek(), "comparisons cannot be chained");
		return { tag: "binop", op, left, right };
	};

	const cons = (): Expr => {
		const head = add();
		return eat(":") ? { tag: "cons", head, tail: nested(cons) } : head;
	};

	const leftAssoc = (tier: Tier, operand: () => Expr) => (): Expr => {
		const outer = depth;
		let left = operand();
		for (let op = opAt(tier); op; op = opAt(tier)) {
			i++;
			deeper();
			left = { tag: "binop", op, left, right: operand() };
		}
		depth = outer;
		return left;
	};

	const app = (): Expr => {
		const outer = depth;
		let fn = atom();
		for (let arg = tryAtom(); arg; arg = tryAtom()) {
			deeper();
			fn = { tag: "app", fn, arg };
		}
		depth = outer;
		return fn;
	};

	const mul = leftAssoc("mul", app);
	const add = leftAssoc("add", mul);

	const atom = (): Expr => tryAtom() ?? fail(peek(), "expected an expression");

	const tryAtom = (): Expr | undefined => {
		const t = peek();
		switch (t.kind) {
			case "int":
				i++;
				return { tag: "num", value: int(t) };
			case "ident":
				i++;
				return isBuiltin(t.text) ? { tag: "builtin", name: t.text } : { tag: "var", name: t.text };
			case "keyword":
				if (t.text !== "True" && t.text !== "False") return undefined;
				i++;
				return { tag: "bool", value: t.text === "True" };
			case "symbol":
				if (t.text === "(") {
					i++;
					const op = peek();
					const next = tokens[i + 1];
					if (op.kind === "symbol" && isOp(op.text)) {
						if (isSymbol(next, ")")) {
							i += 2;
							return section(op.text);
						}
						if (op.text === "-" && next.kind === "int" && isSymbol(tokens[i + 2], ")")) {
							i += 3;
							return { tag: "num", value: 0 - int(next) };
						}
					}
					return bracketed(t, ")", expr);
				}
				if (t.text === "[") {
					i++;
					return bracketed(t, "]", () => {
						const items: Expr[] = [];
						if (!is("]")) {
							do items.push(expr());
							while (eat(","));
						}
						return { tag: "list", items };
					});
				}
				return undefined;
			case "eof":
				return undefined;
		}
	};

	const program = expr();
	const rest = peek();
	if (rest.kind !== "eof") fail(rest, `unexpected "${rest.text}"`);
	return program;
}

const section = (op: Op): Expr => ({
	tag: "lam",
	param: "a",
	body: { tag: "lam", param: "b", body: { tag: "binop", op, left: { tag: "var", name: "a" }, right: { tag: "var", name: "b" } } },
});
