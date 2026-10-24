import { chromium } from "playwright";
import { parse } from "../src/lang/parser.ts";
import { trace } from "../src/lang/trace.ts";

const SOURCE = "foldl (+) 0 (map (\\x -> x * x) [1, 2, 3])";
const parsed = parse(SOURCE);
if (!parsed.ok) throw new Error(parsed.error.message);
const steps = trace(parsed.expr).steps;

const browser = await chromium.launch();
const page = await browser.newPage();
const times: number[] = [];
page.on("console", (message) => {
	const match = message.text().match(/\[redex\] answer-to-paint (\d+) ms/);
	if (match) times.push(Number(match[1]));
});
await page.goto("http://localhost:5172");
await page.getByRole("button", { name: "Run" }).click();
await page.getByRole("button", { name: "Practice", exact: true }).click();
for (const step of steps) {
	await page.waitForTimeout(400);
	await page.locator(`.expr-line [data-path="${step.path.length === 0 ? "root" : step.path.join(".")}"]`).first().click();
	await page.getByRole("button", { name: /^(Next step|See score)$/ }).click();
}
await page.waitForTimeout(600);
const sorted = [...times].sort((a, b) => a - b);
console.log(JSON.stringify({ count: times.length, median: sorted[Math.floor(sorted.length / 2)], samples: times }));
await browser.close();