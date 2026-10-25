import { Icon, ArrowUpRight } from "../components/glaze/icon.tsx";
import Brand from "./Brand.tsx";
import HeroDemo, { HERO_SOURCE } from "./HeroDemo.tsx";
import { playgroundHref } from "../entry.ts";
import { EXAMPLES } from "../lang/examples.ts";
import { buttonVariants } from "../components/glaze/ui/button.tsx";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
  CardMeta,
} from "../components/glaze/ui/card.tsx";

const GITHUB = "https://github.com/GhostInHex/redex";
const lessons = ["arithmetic", "apply-a-function", "map"].map((id) =>
  EXAMPLES.find((example) => example.id === id)!,
);
const action = buttonVariants({ size: "lg" });
export default function Landing() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <Brand />
        <nav aria-label="Main navigation">
          <a className="nav-link" href="#how-it-works">
            How it works
          </a>
          <a
            className="nav-link"
            href={GITHUB}
            target="_blank"
            rel="noreferrer"
          >
            View source <Icon icon={ArrowUpRight} className="external-icon" />
          </a>
          <a
            className={buttonVariants({ size: "sm" })}
            href={playgroundHref(HERO_SOURCE)}
          >
            Try Redex{" "}
            <span aria-hidden="true">
              <Icon icon={ArrowUpRight} className="external-icon" />
            </span>
          </a>
        </nav>
      </header>
      <main id="main" className="landing">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="tiny-node" aria-hidden="true" />A small language.
              Every step visible.
            </p>
            <h1 id="hero-title" className="type-title">
              See how code evaluates,
              <br />
              <span className="text-text-2">one step at a time.</span>
            </h1>
            <p className="hero-intro">
              The answer is only part of the story. Redex makes evaluation
              visible, then puts you in control of what happens next.
            </p>
            <div className="hero-actions">
              <a className={action} href={playgroundHref(HERO_SOURCE)}>
                Try Redex <span aria-hidden="true">→</span>
              </a>
              <a
                className={buttonVariants({ variant: "secondary", size: "lg" })}
                href="#how-it-works"
              >
                See how it works
              </a>
            </div>
            <p className="hero-note">
              Runs in your browser. No account needed.
            </p>
          </div>
          <HeroDemo />
        </section>
        <div className="under-hero">
          <span>Made for the moment you ask, “why?”</span>
          <span>
            Watch the steps <span aria-hidden="true">/</span> Predict the next
            one <span aria-hidden="true">/</span> Share what you learn
          </span>
        </div>
        <section
          className="story section-space"
          id="how-it-works"
          aria-labelledby="story-title"
        >
          <div className="section-heading">
            <p className="section-index">01 / Learn by doing</p>
            <h2 id="story-title" className="type-title">
              Follow the thought.
              <br />
              <span className="text-text-2">Then try it yourself.</span>
            </h2>
            <p>
              One program, two ways to understand it. Move at your own pace,
              with every reduction explained.
            </p>
          </div>
          <div className="mode-cards">
            <Card>
              <CardHeader>
                <CardTitle>Watch</CardTitle>
                <CardDescription>
                  See the order, not just the answer.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mode-visual">
                  <span className="type-caption text-text-2">
                    A function gets its argument
                  </span>
                  <code>
                    <span className="highlight-expression">{String.raw`(\x -> x + 1) 41`}</span>
                    <span className="visual-arrow" aria-hidden="true">
                      ↓
                    </span>
                    41 + 1
                    <span className="visual-arrow" aria-hidden="true">
                      ↓
                    </span>
                    42
                  </code>
                </div>
                <p>
                  Step forward, go back, or play the whole trace. The active
                  expression and its rule stay together.
                </p>
              </CardContent>
              <CardFooter>
                <CardMeta>Understand each reduction</CardMeta>
                <a
                  className={buttonVariants({
                    variant: "secondary",
                    size: "sm",
                  })}
                  href={playgroundHref(lessons[1].source)}
                >
                  Watch a function →
                </a>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Practice</CardTitle>
                <CardDescription>
                  Make a prediction. See why it works.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mode-visual practice-visual">
                  <span className="type-caption text-text-2">
                    Which part runs next?
                  </span>
                  <code>
                    (<span className="prediction-expression">1 + 2</span>) * 3
                  </code>
                  <span className="practice-visual-hint">
                    Choose an expression in the playground
                  </span>
                </div>
                <p>
                  Pick the next expression to evaluate. Get rule-based feedback,
                  then build your score one step at a time.
                </p>
              </CardContent>
              <CardFooter>
                <CardMeta>Turn understanding into a habit</CardMeta>
                <a
                  className={buttonVariants({
                    variant: "secondary",
                    size: "sm",
                  })}
                  href={playgroundHref(HERO_SOURCE).replace(
                    "play#",
                    "play?mode=practice#",
                  )}
                >
                  Try a prediction →
                </a>
              </CardFooter>
            </Card>
          </div>
        </section>
        <section
          className="section-space"
          id="examples"
          aria-labelledby="examples-title"
        >
          <div className="section-heading horizontal-heading">
            <div>
              <p className="section-index">02 / Start somewhere</p>
              <h2 id="examples-title" className="type-title">
                Small programs.
                <br />
                <span className="text-text-2">Useful discoveries.</span>
              </h2>
            </div>
            <p>
              Start with a familiar expression. Work up to functions and lists.
              There are 12 lessons ready to explore.
            </p>
          </div>
          <div className="lesson-grid">
            {lessons.map((example, i) => (
              <Card key={example.id}>
                <CardHeader>
                  <CardTitle>
                    <span className="lesson-number">0{i + 1}</span>
                    {example.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <code className="lesson-code">{example.source}</code>
                  <p className="lesson-description">{example.lesson}</p>
                </CardContent>
                <CardFooter>
                  <a
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                    href={playgroundHref(example.source)}
                  >
                    Open example{" "}
                    <span aria-hidden="true">
                      <Icon icon={ArrowUpRight} className="external-icon" />
                    </span>
                  </a>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>
        <section
          className="share-story section-space"
          aria-labelledby="share-heading"
        >
          <div className="section-heading">
            <p className="section-index">03 / Pass it on</p>
            <h2 id="share-heading" className="type-title">
              A lesson worth sharing
              <br />
              <span className="text-text-2">fits inside a link.</span>
            </h2>
            <p>
              The program lives in the URL. Share the exact source with a
              classmate, or embed the stepper in a lesson page.
            </p>
            <a
              className={buttonVariants({ variant: "secondary" })}
              href={playgroundHref(HERO_SOURCE)}
            >
              Open a program to share →
            </a>
          </div>
          <Card className="share-preview">
            <CardHeader>
              <CardTitle>A little context goes a long way</CardTitle>
              <CardDescription>
                Give someone a program they can explore.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="share-example">
                <code>let x = 2 + 3 in x * x</code>
                <p className="type-body-sm text-text-2">
                  Why do we evaluate <code>2 + 3</code> before replacing{" "}
                  <code>x</code>?
                </p>
                <div className="share-trace">
                  <span className="type-caption">A question</span>
                  <span aria-hidden="true">→</span>
                  <span className="type-caption">A program</span>
                  <span aria-hidden="true">→</span>
                  <span className="type-caption">An explanation</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <CardMeta>Share links and iframe embeds are built in</CardMeta>
            </CardFooter>
          </Card>
        </section>
        <section
          className="technical section-space"
          aria-labelledby="technical-title"
        >
          <div className="section-heading">
            <p className="section-index">04 / Under the hood</p>
            <h2 id="technical-title" className="type-title">
              Small language.
              <br />
              <span className="text-text-2">Real evaluation.</span>
            </h2>
          </div>
          <div className="technical-body">
            <ol className="pipeline">
              <li>
                <span className="pipeline-number">1</span>
                <div>
                  <h3 className="type-label">Parse the program</h3>
                  <p>Turn source code into an expression tree.</p>
                </div>
              </li>
              <li>
                <span className="pipeline-number">2</span>
                <div>
                  <h3 className="type-label">Build the trace</h3>
                  <p>Apply evaluation rules, recording every reduction.</p>
                </div>
              </li>
              <li>
                <span className="pipeline-number">3</span>
                <div>
                  <h3 className="type-label">Make the steps visible</h3>
                  <p>Highlight the next expression and explain its rule.</p>
                </div>
              </li>
            </ol>
            <details className="language-details">
              <summary>What can I run?</summary>
              <p>
                Redex is a small functional language with numbers, booleans,
                arithmetic, functions, let bindings, conditionals, lists, map,
                filter, and folds. It is not a general JavaScript or Python
                runtime.
              </p>
              <p>
                Evaluation stops at 1,000 steps or 5,000 nodes. Deep expressions
                use plain-text display when interactive rendering would be
                unsafe.
              </p>
            </details>
          </div>
        </section>
        <section className="closing">
          <div>
            <h2 className="type-title">The next step is yours.</h2>
            <p>Take a program apart. Put the idea together.</p>
          </div>
          <a className={action} href={playgroundHref(HERO_SOURCE)}>
            Open the playground →
          </a>
        </section>
      </main>
      <footer className="site-footer">
        <Brand />
        <p>A hackathon project for understanding evaluation.</p>
        <div>
          <a
            href="https://design.how/systems/glaze"
            target="_blank"
            rel="noreferrer"
          >
            Built with Glaze{" "}
            <Icon icon={ArrowUpRight} className="external-icon" />
          </a>
          <a href={GITHUB} target="_blank" rel="noreferrer">
            GitHub <Icon icon={ArrowUpRight} className="external-icon" />
          </a>
        </div>
      </footer>
    </>
  );
}
