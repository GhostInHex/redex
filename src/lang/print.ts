import { OP_TIER, type Expr, type Tier } from "./ast.ts";

const Level = { Expr: 0, Cmp: 1, Cons: 2, Add: 3, Mul: 4, App: 5, Atom: 6 } as const;
type Level = (typeof Level)[keyof typeof Level];

const TIER_LEVEL: Readonly<Record<Tier, Level>> = { cmp: Level.Cmp, add: Level.Add, mul: Level.Mul };

const OPERAND_LEVELS: Readonly<Record<Tier, readonly [Level, Level]>> = {
	cmp: [Level.Cons, Level.Cons],
	add: [Level.Add, Level.Mul],
	mul: [Level.Mul, Level.App],
};

const levelOf = (e: Expr): Level => {
	switch (e.tag) {
		case "lam":
		case "let":
		case "if":
			return Level.Expr;
		case "binop":
			return TIER_LEVEL[OP_TIER[e.op]];
		case "cons":
			return Level.Cons;
		case "app":
			return Level.App;
		case "num":
		case "bool":
		case "var":
		case "builtin":
		case "list":
			return Level.Atom;
	}
};

export function print(expr: Expr): string {
	return at(expr, Level.Expr);
}

const at = (e: Expr, min: Level): string => {
	const text = bare(e);
	return levelOf(e) < min ? `(${text})` : text;
};

const bare = (e: Expr): string => {
	switch (e.tag) {
		case "num":
			return e.value < 0 ? `(-${-e.value})` : String(e.value);
		case "bool":
			return e.value ? "True" : "False";
		case "var":
		case "builtin":
			return e.name;
		case "lam": {
			const params = [e.param];
			let body = e.body;
			while (body.tag === "lam") {
				params.push(body.param);
				body = body.body;
			}
			return `\\${params.join(" ")} -> ${at(body, Level.Expr)}`;
		}
		case "app":
			return `${at(e.fn, Level.App)} ${at(e.arg, Level.Atom)}`;
		case "binop": {
			const [left, right] = OPERAND_LEVELS[OP_TIER[e.op]];
			return `${at(e.left, left)} ${e.op} ${at(e.right, right)}`;
		}
		case "cons":
			return `${at(e.head, Level.Add)} : ${at(e.tail, Level.Cons)}`;
		case "if":
			return `if ${at(e.cond, Level.Expr)} then ${at(e.then, Level.Expr)} else ${at(e.else, Level.Expr)}`;
		case "let":
			return `let ${e.name} = ${at(e.value, Level.Expr)} in ${at(e.body, Level.Expr)}`;
		case "list":
			return `[${e.items.map((item) => at(item, Level.Expr)).join(", ")}]`;
	}
};
