import { motion } from "framer-motion";
import type { Expr, Path } from "../lang/ast.ts";

type Props = {
	readonly frame: Expr;
	readonly nextPath: Path | undefined;
	readonly nextRule: string | undefined;
	readonly stuckPath: Path | undefined;
	readonly stuckReason: string | undefined;
};

const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((n, i) => n === b[i]);

const MOTION = { duration: 0.22, ease: "easeOut" as const };

export default function ExprView({ frame, nextPath, nextRule, stuckPath, stuckReason }: Props) {
	const lit = (path: readonly number[]) => (nextPath !== undefined && same(path, nextPath)) || (stuckPath !== undefined && same(path, stuckPath));
	return (
		<section className="expr" aria-label="Current expression">
			<motion.div layout className="expr-line" transition={MOTION}>
				<Node expr={frame} path={[]} lit={lit} />
			</motion.div>
			<p className="expr-note">
				{stuckReason ? <span className="stuck">{stuckReason}</span> : nextRule ? <span className="rule">next {nextRule}</span> : <span className="done">value</span>}
			</p>
		</section>
	);
}

type NodeProps = {
	readonly expr: Expr;
	readonly path: readonly number[];
	readonly lit: (path: readonly number[]) => boolean;
};

function Node({ expr, path, lit }: NodeProps) {
	if (expr.tag === "list") {
		return (
			<span className="list-row">
				{expr.items.map((item, i) => (
					<motion.span
						layout
						key={item.tag === "num" || item.tag === "bool" ? `${item.tag}:${String(item.value)}` : `${item.tag}:${path.concat(i).join(".")}`}
						className={lit(path.concat(i)) ? "box lit" : "box"}
						transition={MOTION}
					>
						<Node expr={item} path={path.concat(i)} lit={lit} />
					</motion.span>
				))}
			</span>
		);
	}
	const content = render(expr, path, lit);
	return lit(path) ? <motion.span layout transition={MOTION} className="node lit">{content}</motion.span> : content;
}

const render = (expr: Expr, path: readonly number[], lit: (p: readonly number[]) => boolean) => {
	switch (expr.tag) {
		case "num":
			return <span className="atom num">{expr.value}</span>;
		case "bool":
			return <span className="atom bool">{expr.value ? "True" : "False"}</span>;
		case "var":
			return <span className="atom var">{expr.name}</span>;
		case "builtin":
			return <span className="atom builtin">{expr.name}</span>;
		case "lam":
			return (
				<span className="lam">
					\<span className="param">{expr.param}</span> -&gt; <Node expr={expr.body} path={path.concat(0)} lit={lit} />
				</span>
			);
		case "app":
			return (
				<span className="app">
					<Node expr={expr.fn} path={path.concat(0)} lit={lit} /> <Node expr={expr.arg} path={path.concat(1)} lit={lit} />
				</span>
			);
		case "binop":
			return (
				<span className="binop">
					<Node expr={expr.left} path={path.concat(0)} lit={lit} /> {expr.op} <Node expr={expr.right} path={path.concat(1)} lit={lit} />
				</span>
			);
		case "cons":
			return (
				<span className="cons">
					<Node expr={expr.head} path={path.concat(0)} lit={lit} /> : <Node expr={expr.tail} path={path.concat(1)} lit={lit} />
				</span>
			);
		case "if":
			return (
				<span className="if">
					if <Node expr={expr.cond} path={path.concat(0)} lit={lit} /> then <Node expr={expr.then} path={path.concat(1)} lit={lit} /> else{" "}
					<Node expr={expr.else} path={path.concat(2)} lit={lit} />
				</span>
			);
		case "let":
			return (
				<span className="let">
					let {expr.name} = <Node expr={expr.value} path={path.concat(0)} lit={lit} /> in <Node expr={expr.body} path={path.concat(1)} lit={lit} />
				</span>
			);
		case "list":
			return <Node expr={expr} path={path} lit={lit} />;
	}
};
