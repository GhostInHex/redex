import { motion } from "framer-motion";
import type { Expr, Path } from "../lang/ast.ts";
import { print } from "../lang/print.ts";
import { supportsInteractiveRendering } from "./interactiveRendering.ts";

type Props = {
	readonly frame: Expr;
	readonly nextPath: Path | undefined;
	readonly nextRule: string | undefined;
	readonly stuckPath: Path | undefined;
	readonly stuckReason: string | undefined;
	readonly limitKind: "steps" | "nodes" | undefined;
	readonly pick?: ((path: Path) => void) | undefined;
	readonly wrongPath?: Path | undefined;
	readonly showNote?: boolean;
};

const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((n, i) => n === b[i]);

const MOTION = { duration: 0.22, ease: "easeOut" as const };

const Level = { Expr: 0, Cmp: 1, Cons: 2, Add: 3, Mul: 4, App: 5, Atom: 6 } as const;
type Level = (typeof Level)[keyof typeof Level];

type Op = "+" | "-" | "*" | "/" | "%" | "==" | "<" | "<=" | ">" | ">=";

const OP_LEVEL: Readonly<Record<Op, Level>> = {
	"==": Level.Cmp,
	"<": Level.Cmp,
	"<=": Level.Cmp,
	">": Level.Cmp,
	">=": Level.Cmp,
	"+": Level.Add,
	"-": Level.Add,
	"*": Level.Mul,
	"/": Level.Mul,
	"%": Level.Mul,
};

const OPERAND_LEVELS: Readonly<Record<Op, readonly [Level, Level]>> = {
	"==": [Level.Cons, Level.Cons],
	"<": [Level.Cons, Level.Cons],
	"<=": [Level.Cons, Level.Cons],
	">": [Level.Cons, Level.Cons],
	">=": [Level.Cons, Level.Cons],
	"+": [Level.Add, Level.Mul],
	"-": [Level.Add, Level.Mul],
	"*": [Level.Mul, Level.App],
	"/": [Level.Mul, Level.App],
	"%": [Level.Mul, Level.App],
};

const levelOf = (e: Expr): Level => {
	switch (e.tag) {
		case "lam":
		case "let":
		case "if":
			return Level.Expr;
		case "binop":
			return OP_LEVEL[e.op as Op] ?? Level.Expr;
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

export default function ExprView({ frame, nextPath, nextRule, stuckPath, stuckReason, limitKind, pick, wrongPath, showNote = true }: Props) {
	const interactive = supportsInteractiveRendering(frame);
	const lit = (path: readonly number[]) => (nextPath !== undefined && same(path, nextPath)) || (stuckPath !== undefined && same(path, stuckPath));
	return (
		<section className="expr" aria-label="Current expression">
			<motion.div layout className="expr-line" transition={MOTION}>
				{interactive ? <Node expr={frame} path={[]} lit={lit} minLevel={Level.Expr} pick={pick} wrongPath={wrongPath} /> : <span className="expr-plain">{print(frame)}</span>}
			</motion.div>
			{!interactive && <p className="expr-display-note">Expression is too deeply nested for interactive display. Showing plain text.</p>}
			{showNote && <p className="expr-note">
				{stuckReason ? (
					<span className="stuck">{stuckReason}</span>
				) : limitKind ? (
					<span className="limit">stopped after {limitKind === "steps" ? "1,000 steps" : "5,000 nodes"}</span>
				) : nextRule ? (
					<span className="rule">{nextRule}</span>
				) : (
					<span className="done">value</span>
				)}
			</p>}
		</section>
	);
}

type NodeProps = {
	readonly expr: Expr;
	readonly path: Path;
	readonly lit: (path: Path) => boolean;
	readonly minLevel?: Level;
	readonly isListItem?: boolean;
	readonly pick?: ((path: Path) => void) | undefined;
	readonly wrongPath?: Path | undefined;
};

function Node({ expr, path, lit, minLevel = Level.Expr, isListItem = false, pick, wrongPath }: NodeProps) {
	let content;
	if (expr.tag === "list") {
		content = expr.items.length === 0 ? <span className="list-empty">[]</span> : (
			<span className="list-row">
				{expr.items.map((item, i) => {
					const itemPath = path.concat(i);
					const itemWrong = wrongPath !== undefined && same(itemPath, wrongPath);
					return (
						<motion.span
							layout
							key={itemPath.join(".")}
							className={["box", lit(itemPath) ? "lit" : "", itemWrong ? "wrong" : ""].filter(Boolean).join(" ")}
							transition={MOTION}
						>
							<Node expr={item} path={itemPath} lit={lit} minLevel={Level.Expr} isListItem pick={pick} wrongPath={wrongPath} />
						</motion.span>
					);
				})}
			</span>
		);
	} else {
		const inner = render(expr, path, lit, pick, wrongPath);
		content = levelOf(expr) < minLevel ? <>({inner})</> : inner;
	}

	const wrong = wrongPath !== undefined && same(path, wrongPath);
	const classes = ["node", lit(path) ? "lit" : "", wrong ? "wrong" : ""].filter(Boolean).join(" ");
	const decorated = !isListItem && lit(path) ? (
		<motion.span layout transition={MOTION} className={classes}>{content}</motion.span>
	) : !isListItem && (pick || wrong) ? (
		<span className={classes}>{content}</span>
	) : content;
	if (!pick) return decorated;
	return (
		<span
			className="pick"
			data-path={path.length === 0 ? "root" : path.join(".")}
			role="button"
			tabIndex={0}
			onClick={(event) => {
				event.stopPropagation();
				pick(path);
			}}
			onKeyDown={(event) => {
				if (event.key !== "Enter" && event.key !== " ") return;
				event.stopPropagation();
				event.preventDefault();
				pick(path);
			}}
		>
			{decorated}
		</span>
	);
}

const render = (expr: Expr, path: readonly number[], lit: (p: Path) => boolean, pick: ((path: Path) => void) | undefined, wrongPath: Path | undefined) => {
	switch (expr.tag) {
		case "num":
			return <span className="atom num">{expr.value < 0 ? `(-${-expr.value})` : expr.value}</span>;
		case "bool":
			return <span className="atom bool">{expr.value ? "True" : "False"}</span>;
		case "var":
			return <span className="atom var">{expr.name}</span>;
		case "builtin":
			return <span className="atom builtin">{expr.name}</span>;
		case "lam":
			return (
				<span className="lam">
					\<span className="param">{expr.param}</span> -&gt; <Node expr={expr.body} path={path.concat(0)} lit={lit} pick={pick} wrongPath={wrongPath} minLevel={Level.Expr} />
				</span>
			);
		case "app":
			return (
				<span className="apply">
					<Node expr={expr.fn} path={path.concat(0)} lit={lit} pick={pick} wrongPath={wrongPath} minLevel={Level.App} />{" "}
					<Node expr={expr.arg} path={path.concat(1)} lit={lit} pick={pick} wrongPath={wrongPath} minLevel={Level.Atom} />
				</span>
			);
		case "binop": {
			const [leftMin, rightMin] = OPERAND_LEVELS[expr.op as Op] ?? [Level.Expr, Level.Expr];
			return (
				<span className="binop">
					<Node expr={expr.left} path={path.concat(0)} lit={lit} pick={pick} wrongPath={wrongPath} minLevel={leftMin} /> {expr.op}{" "}
					<Node expr={expr.right} path={path.concat(1)} lit={lit} pick={pick} wrongPath={wrongPath} minLevel={rightMin} />
				</span>
			);
		}
		case "cons":
			return (
				<span className="cons">
					<Node expr={expr.head} path={path.concat(0)} lit={lit} pick={pick} wrongPath={wrongPath} minLevel={Level.Add} /> :{" "}
					<Node expr={expr.tail} path={path.concat(1)} lit={lit} pick={pick} wrongPath={wrongPath} minLevel={Level.Cons} />
				</span>
			);
		case "if":
			return (
				<span className="if">
					if <Node expr={expr.cond} path={path.concat(0)} lit={lit} pick={pick} wrongPath={wrongPath} minLevel={Level.Expr} /> then{" "}
					<Node expr={expr.then} path={path.concat(1)} lit={lit} pick={pick} wrongPath={wrongPath} minLevel={Level.Expr} /> else{" "}
					<Node expr={expr.else} path={path.concat(2)} lit={lit} pick={pick} wrongPath={wrongPath} minLevel={Level.Expr} />
				</span>
			);
		case "let":
			return (
				<span className="let">
					let {expr.name} = <Node expr={expr.value} path={path.concat(0)} lit={lit} pick={pick} wrongPath={wrongPath} minLevel={Level.Expr} /> in{" "}
					<Node expr={expr.body} path={path.concat(1)} lit={lit} pick={pick} wrongPath={wrongPath} minLevel={Level.Expr} />
				</span>
			);
		case "list":
			return <Node expr={expr} path={path} lit={lit} pick={pick} wrongPath={wrongPath} minLevel={Level.Expr} />;
	}
};