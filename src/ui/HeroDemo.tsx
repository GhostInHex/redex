import { Icon, ArrowUpRight } from "../components/glaze/icon.tsx";
import { useState } from "react";
import { parse } from "../lang/parser.ts";
import { trace } from "../lang/trace.ts";
import { print } from "../lang/print.ts";
import { playgroundHref } from "../entry.ts";
import { Button, buttonVariants } from "../components/glaze/ui/button.tsx";
import {
  Card,
  CardContent,
  CardFooter,
  CardMeta,
} from "../components/glaze/ui/card.tsx";
import ExprView from "./ExprView.tsx";

export const HERO_SOURCE = "(1 + 2) * 3";
const parsed = parse(HERO_SOURCE);
if (!parsed.ok) throw new Error("The landing example must parse.");
const evaluation = trace(parsed.expr);
export default function HeroDemo() {
  const [index, setIndex] = useState(0);
  const frame =
    index === 0 ? evaluation.start : evaluation.steps[index - 1].after;
  const next = evaluation.steps[index];
  const done = index === evaluation.steps.length;
  return (
    <Card
      className="hero-demo"
      role="region"
      aria-label="Interactive evaluation demo"
    >
      <div className="demo-top">
        <span className="type-label">A program, made visible</span>
        <span className="demo-label type-caption">Live evaluation</span>
      </div>
      <CardContent className="demo-body">
        <div className="demo-source">
          <span className="type-caption text-text-2">Your program</span>
          <code>{HERO_SOURCE}</code>
        </div>
        <div className="demo-evaluation">
          <div className="demo-step-meta">
            <span className="type-caption">
              {done
                ? "Evaluation complete"
                : `Step ${index + 1} of ${evaluation.steps.length}`}
            </span>
            <span className="demo-dot" aria-hidden="true" />
          </div>
          <div aria-live="polite" aria-atomic="true">
            <ExprView
              frame={frame}
              nextPath={next?.path}
              nextRule={undefined}
              stuckPath={undefined}
              stuckReason={undefined}
              limitKind={undefined}
              showNote={false}
            />
          </div>
          <p className="demo-explanation">
            {done
              ? "That's the value. Every reduction is accounted for."
              : index === 0
                ? "The highlighted addition runs first. What happens next?"
                : "Now multiply the two values to finish the program."}
          </p>
        </div>
        <div className="demo-history" aria-label="Evaluation history">
          {[
            evaluation.start,
            ...evaluation.steps.slice(0, index).map((step) => step.after),
          ].map((expr, i) => (
            <span key={i}>
              {i > 0 && <span aria-hidden="true">→ </span>}
              <code>{print(expr)}</code>
            </span>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <CardMeta>
          {done ? "Value reached" : "Powered by the real Redex evaluator"}
        </CardMeta>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIndex(0)}
          disabled={index === 0}
        >
          Reset
        </Button>
        <Button
          size="sm"
          onClick={() =>
            setIndex((i) => Math.min(i + 1, evaluation.steps.length))
          }
          disabled={done}
        >
          {done ? "Complete" : "Step →"}
        </Button>
      </CardFooter>
      <a
        className={`${buttonVariants({ variant: "ghost", size: "sm" })} demo-open`}
        href={playgroundHref(HERO_SOURCE)}
      >
        Open this program in the playground{" "}
        <Icon icon={ArrowUpRight} className="external-icon" />
      </a>
    </Card>
  );
}
