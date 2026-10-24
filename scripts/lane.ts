import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../src/lang/parser.ts";
import { trace } from "../src/lang/trace.ts";

const lane = Number(process.argv[2] ?? "2");
const base = `http://localhost:${process.env.LANE_PORT ?? 5170 + lane}`;
const outDir = process.argv[3] ?? ".";
mkdirSync(outDir, { recursive: true });

const SUM_OF_SQUARES = "foldl (+) 0 (map (\\x -> x * x) [1, 2, 3])";

const stepsOf = (source: string) => {
	const parsed = parse(source);
	if (!parsed.ok) throw new Error(parsed.error.message);
	return trace(parsed.expr).steps;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors: string[] = [];
page.on("console", (message) => {
	if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(String(error)));

const shot = (name: string) => page.screenshot({ path: join(outDir, name), fullPage: true });
const scoreText = () => page.locator(".practice-score").innerText();
const clickPath = (path: readonly number[]) =>
	page.locator(`.expr-line [data-path="${path.length === 0 ? "root" : path.join(".")}"]`).first().click();

if (lane === 2 || lane === 3 || lane === 4) {
	await page.goto(base);
	await page.getByRole("button", { name: "Run" }).click();
	await page.getByRole("button", { name: "Practice", exact: true }).click();
	const steps = stepsOf(SUM_OF_SQUARES);

	if (lane === 2) {
		for (const step of steps) {
			await page.waitForTimeout(350);
			await clickPath(step.path);
			await page.getByRole("button", { name: /^(Next step|See score)$/ }).click();
			await page.waitForTimeout(150);
		}
		await shot("r5-all-right.png");
		const text = await scoreText();
		if (!/Score \d+ \/ \d+/.test(text)) throw new Error(text);
	} else if (lane === 3) {
		await page.waitForTimeout(350);
		await page.locator('.expr-line .atom.num').first().click();
		await page.waitForTimeout(150);
		await shot("r5-wrong.png");
		const text = await scoreText();
		if (!text.includes("0 / 1")) throw new Error(text);
	} else if (lane === 4) {
		await page.waitForTimeout(350);
		const lambdaBody = [1, 0, 1, 0];
		await clickPath(lambdaBody);
		await page.waitForTimeout(150);
		await shot("r5-lambda-body.png");
		const text = await scoreText();
		if (!text.includes("lambda")) throw new Error(text);
	}
}

await browser.close();
if (errors.length) {
	console.error(`console errors: ${errors.join(" | ")}`);
	process.exit(1);
}
console.log(`lane ${lane} pass`);