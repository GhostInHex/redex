import { lazy, Suspense, useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import { resolveEntry } from "../entry.ts";
import { GlazePortalProvider } from "../lib/glaze/portal.ts";
import Landing from "./Landing.tsx";
const Playground = lazy(() => import("./App.tsx"));
export default function Root() {
  const [href, setHref] = useState(location.href);
  const entry = resolveEntry(new URL(href));
  useEffect(() => {
    const update = () => setHref(location.href);
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  useEffect(() => {
    document.title =
      entry.kind === "landing"
        ? "Redex | See every step"
        : entry.kind === "embed"
          ? "Redex embedded stepper"
          : "Redex playground";
  }, [entry.kind]);
  return (
    <div className="glaze site-frame">
      <GlazePortalProvider>
        <MotionConfig reducedMotion="user">
          {entry.kind === "landing" ? (
            <Landing />
          ) : (
            <Suspense
              fallback={
                <main className="loading-page" role="status">
                  Opening the playground…
                </main>
              }
            >
              <Playground key={href} entry={entry} />
            </Suspense>
          )}
        </MotionConfig>
      </GlazePortalProvider>
    </div>
  );
}
