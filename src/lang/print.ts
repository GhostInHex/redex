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

type Part = string | readonly [Expr, Level];

export function print(expr: Expr): string {
	const out: string[] = [];
	const todo: Part[] = [[expr, Level.Expr]];
	for (let part = todo.pop(); part !== undefined; part = todo.pop()) {
		if (typeof part === "string") {
			out.push(part);
			continue;
		}
		const [e, min] = part;
		const parts = levelOf(e) < min ? ["(", ...bare(e), ")"] : bare(e);
		for (let n = parts.length - 1; n >= 0; n--) todo.push(parts[n]);
	}
	return out.join("");
}

const bare = (e: Expr): readonly Part[] => {
	switch (e.tag) {
		case "num":
			return [e.value < 0 ? `(-${-e.value})` : String(e.value)];
		case "bool":
			return [e.value ? "True" : "False"];
		case "var":
		case "builtin":
			return [e.name];
		case "lam": {
			const params = [e.param];
			let body = e.body;
			while (body.tag === "lam") {
				params.push(body.param);
				body = body.body;
			}
			return [`\\${params.join(" ")} -> `, [body, Level.Expr]];
		}
		case "app":
			return [[e.fn, Level.App], " ", [e.arg, Level.Atom]];
		case "binop": {
			const [left, right] = OPERAND_LEVELS[OP_TIER[e.op]];
			return [[e.left, left], ` ${e.op} `, [e.right, right]];
		}
		case "cons":
			return [[e.head, Level.Add], " : ", [e.tail, Level.Cons]];
		case "if":
			return ["if ", [e.cond, Level.Expr], " then ", [e.then, Level.Expr], " else ", [e.else, Level.Expr]];
		case "let":
			return [`let ${e.name} = `, [e.value, Level.Expr], " in ", [e.body, Level.Expr]];
		case "list":
			return ["[", ...e.items.flatMap((item, n): Part[] => (n === 0 ? [[item, Level.Expr]] : [", ", [item, Level.Expr]])), "]"];
	}
};
