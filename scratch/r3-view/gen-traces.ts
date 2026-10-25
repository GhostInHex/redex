import { parse } from "../../src/lang/parser.ts";
import { trace } from "../../src/lang/trace.ts";
import { EXAMPLES } from "../../src/lang/examples.ts";
import { writeFileSync } from "node:fs";
import type { Expr } from "../../src/lang/ast.ts";

const label = (e: Expr): string => {
  switch (e.tag) {
    case "num": return String(e.value);
    case "bool": return e.value ? "True" : "False";
    case "var": case "builtin": return e.name;
    case "lam": return `\\${e.param} ->`;
    case "app": return "@";
    case "binop": return e.op;
    case "cons": return ":";
    case "if": return "if";
    case "let": return `let ${e.name}`;
    case "list": return "list";
  }
};

const kids = (e: Expr): readonly Expr[] => {
  switch (e.tag) {
    case "num": case "bool": case "var": case "builtin": return [];
    case "lam": return [e.body];
    case "app": return [e.fn, e.arg];
    case "binop": return [e.left, e.right];
    case "cons": return [e.head, e.tail];
    case "if": return [e.cond, e.then, e.else];
    case "let": return [e.value, e.body];
    case "list": return e.items;
  }
};

const toTree = (e: Expr): any => ({ tag: e.tag, text: label(e), kids: kids(e).map(toTree) });

const wanted = ["sum-of-squares", "map", "filter", "foldr"];
const out = wanted.map((id) => {
  const ex = EXAMPLES.find((e) => e.id === id)!;
  const t = trace(parse(ex.source).expr);
  const frames = [t.start, ...t.steps.map((s) => s.after)].map(toTree);
  return {
    id,
    source: ex.source,
    frames,
    rules: t.steps.map((s) => ({ rule: s.rule, path: [...s.path] })),
    outcome: t.outcome.tag,
  };
});
writeFileSync("traces.json", JSON.stringify(out));
console.log(out.map((t) => `${t.id}: ${t.frames.length} frames`).join("\n"));
