import { describe, expect, it } from "vitest";
import { DEFAULT_SOURCE, resolveEntry } from "./entry.ts";
import { encodeProgram } from "./share.ts";
const url = (path: string) => new URL(path, "https://redex.example");
describe("frontend entry compatibility", () => {
  it("keeps ordinary root anchors on the landing page", () => {
    expect(resolveEntry(url("/#how-it-works"))).toEqual({ kind: "landing" });
  });
  it("opens the playground on direct and trailing-slash routes", () => {
    for (const path of ["/play", "/play/", "/course/play"])
      expect(resolveEntry(url(path))).toEqual({
        kind: "playground",
        source: DEFAULT_SOURCE,
        shared: false,
        notice: undefined,
      });
  });
  it("keeps legacy root program links exact", () => {
    const source = "let x = 2 + 3 in x * x";
    expect(resolveEntry(url("/#p=" + encodeProgram(source)))).toEqual({
      kind: "playground",
      source,
      shared: true,
      notice: undefined,
    });
  });
  it("preserves invalid legacy link notices instead of hiding them behind marketing", () => {
    const entry = resolveEntry(url("/#p=invalid"));
    expect(entry.kind).toBe("playground");
    if (entry.kind !== "landing")
      expect(entry.notice).toMatch(/could not be read/);
  });
  it("gives embedded mode precedence over every page route", () => {
    for (const path of ["/?embed=1", "/play?embed=1", "/course/play?embed=1"])
      expect(resolveEntry(url(path)).kind).toBe("embed");
  });
  it("preserves an empty program payload as an intentional program", () => {
    const entry = resolveEntry(url("/play#p=" + encodeProgram("")));
    expect(entry.kind).toBe("playground");
    if (entry.kind !== "landing") expect(entry.source).toBe("");
  });
  it("keeps section navigation separate from program payloads", () =>
    expect(resolveEntry(url("/?mode=practice#examples"))).toEqual({
      kind: "landing",
    }));
});
