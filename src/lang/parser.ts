import { isBuiltin, isOp, OP_TIER, type Expr, type Op, type ParseError, type ParseResult, type Tier } from "./ast.ts";
import { lex, type Keyword, type Sym, type Token } from "./lexer.ts";

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

const startsAtom = (t: Token) =>
	t.kind === "int" ||
	t.kind === "ident" ||
	(t.kind === "keyword" && (t.text === "True" || t.text === "False")) ||
	(t.kind === "symbol" && (t.text === "(" || t.text === "["));

function parseTokens(tokens: readonly Token[]): Expr {
	let i = 0;
	const peek = () => tokens[i];

	const fail = (at: Token, message: string): never => {
		throw new ParseFailure({ message, line: at.line, col: at.col });
	};

	const eat = (text: Keyword | Sym) => {
		const t = peek();
		if ((t.kind !== "keyword" && t.kind !== "symbol") || t.text !== text) return false;
		i++;
		return true;
	};

	const expect = (text: Keyword | Sym) => {
		if (!eat(text)) fail(peek(), `expected "${text}"`);
	};

	const close = (opener: Token, closer: ")" | "]") => {
		if (!eat(closer)) fail(opener, `unclosed "${opener.text}"`);
	};

	const name = (): string => {
		const t = peek();
		if (t.kind !== "ident" || isBuiltin(t.text)) return fail(t, "expected a name");
		i++;
		return t.text;
	};

	const opAt = (tier: Tier): Op | undefined => {
		const t = peek();
		return t.kind === "symbol" && isOp(t.text) && OP_TIER[t.text] === tier ? t.text : undefined;
	};

	const expr = (): Expr => {
		if (eat("let")) {
			const bound = name();
			expect("=");
			const value = expr();
			expect("in");
			return { tag: "let", name: bound, value, body: expr() };
		}
		if (eat("\\")) {
			const params = [name()];
			while (peek().kind === "ident") params.push(name());
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
	};

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
		return eat(":") ? { tag: "cons", head, tail: cons() } : head;
	};

	const leftAssoc = (tier: Tier, operand: () => Expr) => (): Expr => {
		let left = operand();
		for (let op = opAt(tier); op; op = opAt(tier)) {
			i++;
			left = { tag: "binop", op, left, right: operand() };
		}
		return left;
	};

	const app = (): Expr => {
		let fn = atom();
		while (startsAtom(peek())) fn = { tag: "app", fn, arg: atom() };
		return fn;
	};

	const mul = leftAssoc("mul", app);
	const add = leftAssoc("add", mul);

	const atom = (): Expr => {
		const t = peek();
		switch (t.kind) {
			case "int": {
				const value = Number(t.text);
				if (!Number.isSafeInteger(value)) fail(t, "number too large");
				i++;
				return { tag: "num", value };
			}
			case "ident":
				i++;
				return isBuiltin(t.text) ? { tag: "builtin", name: t.text } : { tag: "var", name: t.text };
			case "keyword":
				if (t.text !== "True" && t.text !== "False") break;
				i++;
				return { tag: "bool", value: t.text === "True" };
			case "symbol": {
				if (t.text === "(") {
					i++;
					const op = peek();
					const after = tokens[i + 1];
					if (op.kind === "symbol" && isOp(op.text) && after.kind === "symbol" && after.text === ")") {
						i += 2;
						return section(op.text);
					}
					const inner = expr();
					close(t, ")");
					return inner;
				}
				if (t.text === "[") {
					i++;
					const items: Expr[] = [];
					if (!eat("]")) {
						do items.push(expr());
						while (eat(","));
						close(t, "]");
					}
					return { tag: "list", items };
				}
				break;
			}
		}
		return fail(t, "expected an expression");
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
