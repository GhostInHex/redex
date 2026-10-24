import React, { useEffect, useMemo, useReducer, useState } from "react";
import { createRoot } from "react-dom/client";
import { AnimatePresence, motion } from "framer-motion";
import raw from "./traces.json";

const traces = raw;
const startsWith = (p, q) => p.length >= q.length && q.every((n, i) => n === p[i]);

function InlineNode({ node, path, lit, keyId }) {
  const here = lit(path);
  if (node.tag === "num" || node.tag === "bool" || node.tag === "var" || node.tag === "builtin") {
    return <span className={here ? "lit" : ""}>{node.text}</span>;
  }
  if (node.tag === "list") {
    return (
      <span className="rowline">
        {node.kids.map((k, i) => (
          <span key={i} className={"cell" + (lit(path.concat(i)) ? " lit" : "")}>
            <InlineNode node={k} path={path.concat(i)} lit={lit} keyId={keyId} />
          </span>
        ))}
      </span>
    );
  }
  const parts = [];
  node.kids.forEach((k, i) => {
    if (node.tag === "binop" && i === 1) parts.push(` ${node.text} `);
    if (node.tag === "app" && i === 1) parts.push(" ");
    parts.push(<InlineNode key={i} node={k} path={path.concat(i)} lit={lit} keyId={keyId} />);
  });
  if (node.tag === "lam") return (<span className={here ? "lit" : ""}>{node.text} <InlineNode node={node.kids[0]} path={path.concat(0)} lit={lit} keyId={keyId} /></span>);
  const body = node.tag === "binop" || node.tag === "app" ? parts : [<span key="tag" className="tag">{node.text}</span>, ...parts];
  return <span className={here ? "lit" : ""}>{body}</span>;
}

function BoxNode({ node, path, lit, keyId }) {
  const here = lit(path);
  if (node.tag === "list") {
    return (
      <span className="rowline">
        {node.kids.map((k, i) => (
          <motion.span layout key={keyId + ":" + path.concat(i).join(".")} className={"cell" + (lit(path.concat(i)) ? " lit" : "")} transition={{ duration: 0.2 }}>
            <BoxNode node={k} path={path.concat(i)} lit={lit} keyId={keyId} />
          </motion.span>
        ))}
      </span>
    );
  }
  return (
    <motion.span layout key={keyId + ":" + path.join(".")} className={"nodebox" + (here ? " lit" : "")} transition={{ duration: 0.2 }}>
      <span className="tag">{node.text}</span>
      {node.kids.map((k, i) => <BoxNode key={i} node={k} path={path.concat(i)} lit={lit} keyId={keyId} />)}
    </motion.span>
  );
}

function CrossFrame({ tree, lit, draw }) {
  const Inner = draw === "a" ? InlineNode : BoxNode;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key="f" className="code" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        <Inner node={tree} path={[]} lit={lit} keyId="x" />
      </motion.div>
    </AnimatePresence>
  );
}

function LayoutFrame({ tree, lit, draw }) {
  const Inner = draw === "a" ? InlineNode : BoxNode;
  return (
    <motion.div layout className="code">
      <Inner node={tree} path={[]} lit={lit} keyId="l" />
    </motion.div>
  );
}

function App() {
  const [draw, setDraw] = useState("a");
  const [anim, setAnim] = useState("a");
  const [ex, setEx] = useState(0);
  const [frame, setFrame] = useState(0);
  const trace = traces[ex];
  const last = trace.frames.length - 1;
  const i = Math.min(frame, last);
  const nextStep = i < last ? (trace.rules[i] || null) : null;
  const lit = useMemo(() => {
    if (!nextStep) return () => false;
    const p = nextStep.path;
    return (q) => q.length === p.length && p.every((n, k) => n === q[k]);
  }, [nextStep]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") setFrame((f) => Math.min(f + 1, last));
      if (e.key === "ArrowLeft") setFrame((f) => Math.max(f - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last]);

  const Frame = anim === "a" ? CrossFrame : LayoutFrame;
  return (
    <div className="proto">
      <div className="row">
        <span className="label">draw</span>
        <button className={draw === "a" ? "on" : ""} onClick={() => setDraw("a")}>A inline</button>
        <button className={draw === "b" ? "on" : ""} onClick={() => setDraw("b")}>B boxes</button>
        <span className="label">animate</span>
        <button className={anim === "a" ? "on" : ""} onClick={() => setAnim("a")}>A cross-fade</button>
        <button className={anim === "b" ? "on" : ""} onClick={() => setAnim("b")}>B layout slide</button>
        <select value={ex} onChange={(e) => { setEx(Number(e.target.value)); setFrame(0); }}>
          {traces.map((t, n) => <option key={t.id} value={n}>{t.id}</option>)}
        </select>
        <button onClick={() => setFrame((f) => Math.max(f - 1, 0))}>&lt;</button>
        <span>{i}/{last}</span>
        <button onClick={() => setFrame((f) => Math.min(f + 1, last))}>&gt;</button>
      </div>
      <div className="stage">
        <div className="rule">{nextStep ? `next ${nextStep.rule} @ ${nextStep.path.join(".") || "root"}` : trace.outcome}</div>
        <Frame tree={trace.frames[i]} lit={lit} draw={draw} />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);


