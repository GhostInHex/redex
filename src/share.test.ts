import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { decodeProgram, embedSnippet, encodeProgram, readHash, shareHref } from "./share.ts";

describe("share", () => {
	it("round-trips any program through the hash code", () => {
		fc.assert(
			fc.property(fc.string(), (program) => {
				expect(decodeProgram(encodeProgram(program))).toBe(program);
			}),
		);
	});

	it("round-trips the empty program", () => {
		expect(decodeProgram(encodeProgram(""))).toBe("");
	});

	it("returns null for a code that is not ours", () => {
		expect(decodeProgram("garbage")).toBeNull();
		expect(decodeProgram("zzzz")).toBeNull();
		expect(decodeProgram("%%%")).toBeNull();
		expect(decodeProgram("")).toBeNull();
	});

	it("reads a program from the hash", () => {
		expect(readHash(shareHref("", "1 + 2"))).toEqual({ kind: "program", program: "1 + 2" });
	});

	it("reports a bad hash and a missing hash", () => {
		expect(readHash("#p=garbage")).toEqual({ kind: "bad" });
		expect(readHash("#p=")).toEqual({ kind: "bad" });
		expect(readHash("")).toEqual({ kind: "none" });
		expect(readHash("#other=1")).toEqual({ kind: "none" });
	});

	it("builds a share link that encodes the program", () => {
		const href = shareHref("https://redex.test/", "foldl (+) 0 [1]");
		expect(href.startsWith("https://redex.test/#p=")).toBe(true);
		expect(readHash(href.slice(href.indexOf("#")))).toEqual({ kind: "program", program: "foldl (+) 0 [1]" });
	});

	it("wraps an embed href in an iframe snippet", () => {
		const snippet = embedSnippet("https://redex.test/?embed=1#p=abc");
		expect(snippet).toContain('src="https://redex.test/?embed=1#p=abc"');
		expect(snippet.startsWith("<iframe ")).toBe(true);
	});
});
