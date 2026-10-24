import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.BASE_URL ?? "http://127.0.0.1:5175";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
const results = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
	if (message.type() === "error") errors.push(message.text());
});
const text = () => page.locator(".practice").innerText();
async function record(label) {
	assert.deepEqual(errors, [], `${label} has no browser errors`);
	results.push({ label, text: await text() });
	console.log(`PASS ${label}`);
}
async function load(source) {
	await page.goto(base);
	const code = await page.evaluate(async (program) => (await import("/src/share.ts")).encodeProgram(program), source);
	await page.goto(`${base}/#p=${code}`);
	await page.reload();
	await page.getByRole("button", { name: "Practice", exact: true }).click();
	await page.locator(".practice").waitFor();
}
async function pick(path, key = "Enter") {
	await page.locator(`[data-path="${path}"]`).press(key);
}
async function next() {
	await page.locator(".practice-next").click();
}
async function noFalseValue() {
	assert.equal(await page.locator(".practice .expr-note").count(), 0);
}
async function example(name) {
	await page.getByRole("button", { name: "Examples", exact: true }).click();
	await page.getByRole("menuitem").filter({ hasText: name }).click();
}

try {
	await load("1 + 2 * 3");
	await noFalseValue();
	const point = await page.locator('[data-path="1"] > .node > .binop').evaluate((element) => {
		const children = [...element.children].map((child) => child.getBoundingClientRect());
		return { x: (children[0].right + children[1].left) / 2, y: (children[0].top + children[0].bottom) / 2 };
	});
	await page.mouse.click(point.x, point.y);
	assert.match(await text(), /Right, arith runs first · score 1 \/ 1/);
	await noFalseValue();
	await next();
	await pick("root", " ");
	assert.match(await text(), /Right, arith runs first · score 2 \/ 2/);
	assert.equal(await page.locator(".practice-next").innerText(), "See score");
	await noFalseValue();
	await page.screenshot({ path: "/workspace/scratch/redex-audit/r5-final-feedback.png" });
	await record("pointer answer and final Space answer hold feedback");
	await next();
	assert.match(await text(), /Done. Score 2 \/ 2/);
	assert.equal((await page.locator(".expr-line").innerText()).trim(), "7");
	assert.equal((await page.locator(".expr-note").innerText()).trim(), "value");
	await next();
	assert.match(await text(), /Step 1 of 2 · score 0 \/ 1/);
	await record("completion shows final value and Practice again resets");

	await pick("root");
	assert.match(await text(), /something inside it runs first/);
	await noFalseValue();
	await next();
	await pick("0");
	assert.match(await text(), /Not this one/);
	await next();
	assert.match(await text(), /Done. Score 0 \/ 2/);
	await record("wrong feedback and final wrong answer finish after acknowledgement");

	await load("(\\x -> x + 1) 41");
	await pick("0.0");
	assert.match(await text(), /Code inside a lambda runs only after the lambda gets an argument/);
	await record("lambda-body hint remains available through keyboard selection");

	await load("1 + 2 * 3");
	await pick("1");
	await page.getByRole("button", { name: "Run", exact: true }).click();
	assert.match(await text(), /Step 1 of 2 · score 0 \/ 1/);
	assert.equal(await page.locator(".practice .right").count(), 0);
	await record("same-source Run synchronously replaces answered session");

	await load("(1 + 2) * 3 + 4 * 5");
	for (const path of ["0.0", "0"]) {
		await pick(path);
		await next();
	}
	await pick("1");
	assert.match(await text(), /score 3 \/ 3/);
	await example("Apply a function");
	assert.match(await text(), /Step 1 of 2 · score 0 \/ 1/);
	assert.equal(await page.locator(".practice .right").count(), 0);
	await record("original shorter-example crash sequence now resets before indexing");

	await load("1 + 2");
	await pick("root");
	await next();
	await example("Arithmetic");
	assert.match(await text(), /Step 1 of 4 · score 0 \/ 1/);
	await record("longer replacement trace starts new session after completion");
	await page.locator(".cm-content").fill("3 * 4");
	assert.equal(await page.locator(".practice").count(), 0);
	await page.getByRole("button", { name: "Run", exact: true }).click();
	assert.match(await text(), /Step 1 of 1 · score 0 \/ 1/);
	await record("source edit invalidates practice until a new run");

	await load("42");
	assert.match(await text(), /already a value/);
	assert.equal((await page.locator(".expr-line").innerText()).trim(), "42");
	await record("zero-step value shows actual value");
	for (const [source, path] of [["1 / 0", "root"], ["1 + 2 / 0", "1"]]) {
		await load(source);
		assert.match(await text(), /Evaluation is stuck/);
		assert.match(await text(), /division by zero/);
		assert.match(await text(), new RegExp(`Stopped at path ${path}\\.`));
		assert.doesNotMatch(await text(), /already a value/);
		await record(`zero-step stuck outcome at ${path}`);
	}
	await load("(1 + 2) / 0");
	await pick("0");
	assert.match(await text(), /Right, arith/);
	await next();
	assert.match(await text(), /division by zero/);
	assert.match(await text(), /Stopped at path root/);
	assert.equal((await page.locator(".expr-line").innerText()).replace(/\s/g, ""), "3/0");
	await record("completed practice shows stuck terminal frame, reason and path");

	await load("[[], 1, 1 + 2]");
	assert.equal(await page.locator('[data-path="root"]').count(), 1);
	assert.equal(await page.locator('[data-path="0"]').count(), 1);
	assert.equal(await page.locator('[data-path="1"]').count(), 1);
	assert.equal(await page.locator('[data-path="2"]').count(), 1);
	await pick("0", " ");
	assert.match(await text(), /Not this one/);
	assert.equal(await page.locator(".box.lit").count(), 1);
	assert.equal(await page.locator(".lit").count(), 1);
	assert.equal(await page.locator(".box.wrong").count(), 1);
	await record("empty list and nonempty root are selectable with one logical path per node");
	await load("[1, 1, 1 + 2]");
	await pick("2");
	assert.match(await text(), /score 1 \/ 1/);
	await record("duplicate list values keep unique paths and keys");

	await load("0 + ".repeat(129) + "0");
	assert.match(await text(), /too deeply nested for interactive practice/);
	assert.match(await text(), /Showing plain text/);
	assert.equal(await page.locator("[data-path]").count(), 0);
	await noFalseValue();
	await record("deep question reports interactive display limit with safe plain text");

	await load("(\\x -> x x) (\\x -> x x)");
	await page.evaluate(async () => {
		for (let index = 0; index < 1000; index++) {
			const answer = document.querySelector('[data-path="root"]');
			if (!answer) throw new Error(`Missing root at step ${index}`);
			answer.click();
			await new Promise((resolve) => setTimeout(resolve, 0));
			const feedback = document.querySelector(".practice-score").textContent;
			if (!feedback.includes(`score ${index + 1} / ${index + 1}`)) throw new Error(`Missing feedback at step ${index + 1}: ${feedback}`);
			document.querySelector(".practice-next").click();
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	});
	assert.match(await text(), /Done. Score 1000 \/ 1000/);
	assert.match(await text(), /stopped after 1,000 steps/);
	await record("all 1,000 correct answers hold feedback and completion reports step limit");
	await load("[" + Array.from({ length: 5001 }, () => "1").join(",") + "]");
	assert.match(await text(), /Evaluation reached a limit/);
	assert.match(await text(), /stopped after 5,000 nodes/);
	assert.doesNotMatch(await text(), /already a value/);
	await record("zero-step node limit is not reported as a value");
	await fs.writeFile("/workspace/scratch/redex-audit/r5-fix-browser.json", JSON.stringify({ base, results, errors }, null, 2));
	console.log(`All ${results.length} browser regressions passed with no errors.`);
} finally {
	await browser.close();
}
