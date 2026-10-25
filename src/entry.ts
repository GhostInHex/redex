import { readHash, shareHref } from "./share.ts";
import { EXAMPLES } from "./lang/examples.ts";

export const DEFAULT_SOURCE = EXAMPLES[0].source;
export type ProgramEntry = {
  readonly kind: "playground" | "embed";
  readonly source: string;
  readonly shared: boolean;
  readonly notice: string | undefined;
};
export type PageEntry = { readonly kind: "landing" } | ProgramEntry;
export function resolveEntry(url: URL): PageEntry {
  const payload = readHash(url.hash);
  const embedded = url.searchParams.get("embed") === "1";
  if (
    !embedded &&
    !url.pathname.replace(/\/$/, "").endsWith("/play") &&
    payload.kind === "none"
  )
    return { kind: "landing" };
  return {
    kind: embedded ? "embed" : "playground",
    source: payload.kind === "program" ? payload.program : DEFAULT_SOURCE,
    shared: payload.kind === "program",
    notice:
      payload.kind === "bad"
        ? "This link could not be read, so the default example is loaded."
        : undefined,
  };
}
export const appRoot = () => import.meta.env.BASE_URL;
export const playgroundHref = (source = DEFAULT_SOURCE) =>
  shareHref(`${appRoot()}play`, source);
