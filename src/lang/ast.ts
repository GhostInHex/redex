export type Op = "+" | "-" | "*" | "/" | "%" | "==" | "<" | "<=" | ">" | ">=";
export type Builtin = "map" | "filter" | "foldl" | "foldr";

export type Expr =
	| { readonly tag: "num"; readonly value: number }
	| { readonly tag: "bool"; readonly value: boolean }
	| { readonly tag: "var"; readonly name: string }
	| { readonly tag: "builtin"; readonly name: Builtin }
	| { readonly tag: "lam"; readonly param: string; readonly body: Expr }
	| { readonly tag: "app"; readonly fn: Expr; readonly arg: Expr }
	| { readonly tag: "binop"; readonly op: Op; readonly left: Expr; readonly right: Expr }
	| { readonly tag: "cons"; readonly head: Expr; readonly tail: Expr }
	| { readonly tag: "if"; readonly cond: Expr; readonly then: Expr; readonly else: Expr }
	| { readonly tag: "let"; readonly name: string; readonly value: Expr; readonly body: Expr }
	| { readonly tag: "list"; readonly items: readonly Expr[] };

export type Path = readonly number[];

export type Rule =
	| "arith" | "compare" | "cons" | "beta" | "let" | "if-true" | "if-false"
	| "map" | "filter-cons" | "filter-nil"
	| "foldl-cons" | "foldl-nil" | "foldr-cons" | "foldr-nil";

export type Step = { readonly rule: Rule; readonly path: Path; readonly before: Expr; readonly after: Expr };

export type Outcome =
	| { readonly tag: "value"; readonly value: Expr }
	| { readonly tag: "stuck"; readonly path: Path; readonly reason: string }
	| { readonly tag: "limit"; readonly kind: "steps" | "nodes" };

export type Trace = { readonly start: Expr; readonly steps: readonly Step[]; readonly outcome: Outcome };

export type ParseError = { readonly message: string; readonly line: number; readonly col: number };
export type ParseResult = { readonly ok: true; readonly expr: Expr } | { readonly ok: false; readonly error: ParseError };

export type Tier = "cmp" | "add" | "mul";

export const OP_TIER: Readonly<Record<Op, Tier>> = {
	"==": "cmp", "<": "cmp", "<=": "cmp", ">": "cmp", ">=": "cmp",
	"+": "add", "-": "add",
	"*": "mul", "/": "mul", "%": "mul",
};

const BUILTINS: Readonly<Record<Builtin, true>> = { map: true, filter: true, foldl: true, foldr: true };

export const isOp = (text: string): text is Op => Object.hasOwn(OP_TIER, text);
export const isBuiltin = (name: string): name is Builtin => Object.hasOwn(BUILTINS, name);
