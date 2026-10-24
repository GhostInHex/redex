import { chromium } from "playwright";
import * as fs from "node:fs";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
const paintLogs = [];

page.on("console", (m) => {
	const text = m.text();
	if (m.type() === "error") errors.push(text);
	if (text.includes("[redex] run-to-paint")) paintLogs.push(text);
});
page.on("pageerror", (e) => errors.push(String(e)));

console.log("=== LANE 2 ===");
await page.goto("http://localhost:5173/");
await page.waitForSelector(".cm-editor");
await page.click("button.run");
await page.waitForSelector(".expr-line");

// Check frame 0
let litCount = await page.locator(".lit").count();
console.log(`Frame 0 lit count: ${litCount}`);
if (litCount !== 1) throw new Error(`Frame 0 expected 1 lit node, got ${litCount}`);

// Step through to frame 20 (20 steps)
for (let frame = 1; frame <= 20; frame++) {
	await page.keyboard.press("ArrowRight");
	await page.waitForTimeout(60);
	litCount = await page.locator(".lit").count();
	if (frame < 20) {
		if (litCount !== 1) throw new Error(`Frame ${frame} expected 1 lit node, got ${litCount}`);
	} else {
		if (litCount !== 0) throw new Error(`Frame 20 expected 0 lit nodes, got ${litCount}`);
		const text = await page.locator(".expr-line").textContent();
		if (!text.includes("14")) throw new Error(`Frame 20 expected final value 14, got ${text}`);
		const note = await page.locator(".expr-note").textContent();
		if (!note.includes("value")) throw new Error(`Frame 20 expected value note, got ${note}`);
		const counter = await page.locator(".counter").textContent();
		console.log(`Frame 20 counter: "${counter.trim()}", text: "${text.trim()}", note: "${note.trim()}"`);
	}
}

await page.screenshot({ path: "docs/media/r3-step-through.png" });
console.log("Lane 2 PASS: 1 lit node per frame 0..19, 0 lit nodes on frame 20 with value 14");

console.log("=== LANE 3 ===");
await page.reload();
await page.waitForSelector(".cm-editor");
await page.click("button.run");
await page.waitForSelector(".expr-line");
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(250);

const boxes = await page.locator(".box").count();
const litBoxes = await page.locator(".box.lit").count();
const totalLit = await page.locator(".lit").count();
const firstBoxLit = await page.locator(".box").nth(0).evaluate((el) => el.classList.contains("lit"));
const secondBoxLit = await page.locator(".box").nth(1).evaluate((el) => el.classList.contains("lit"));

console.log(`Boxes: ${boxes}, lit boxes: ${litBoxes}, total lit: ${totalLit}, first lit: ${firstBoxLit}, second lit: ${secondBoxLit}`);
if (boxes !== 3 || litBoxes !== 1 || !firstBoxLit || secondBoxLit || totalLit !== 1) {
	throw new Error(`Lane 3 failed: boxes=${boxes}, litBoxes=${litBoxes}, totalLit=${totalLit}`);
}
await page.screenshot({ path: "docs/media/r3-list-boxes.png" });
console.log("Lane 3 PASS: list shows as 3 boxes, exactly first box is lit, total lit elements is 1");

console.log("=== LANE 7 ===");
await page.click(".cm-content");
await page.keyboard.press("Control+A");
await page.keyboard.press("Backspace");
await page.keyboard.type("map (\\x -> x +) [1]");
await page.waitForTimeout(100);
await page.click("button.run");
await page.waitForTimeout(300);

const errText = await page.locator(".error").textContent().catch(() => "");
const markCount = await page.locator(".cm-parse-error").count();
const markText = await page.locator(".cm-parse-error").textContent().catch(() => "");
const colInfo = await page.evaluate(() => {
	const mark = document.querySelector(".cm-parse-error");
	if (!mark) return null;
	const line = mark.closest(".cm-line");
	const fullText = line ? line.textContent : "";
	const col = fullText.indexOf(mark.textContent) + 1;
	return { fullText, col, char: mark.textContent };
});

console.log(`Lane 7 error: "${errText}", marks: ${markCount}, markText: "${markText}", colInfo:`, colInfo);
if (!errText.includes("expected an expression") || markCount !== 1 || markText !== ")" || colInfo.col !== 15) {
	throw new Error(`Lane 7 failed: error="${errText}", markCount=${markCount}, markText="${markText}", col=${colInfo?.col}`);
}
await page.screenshot({ path: "docs/media/r3-parse-error.png" });
console.log("Lane 7 PASS: editor underlines column 15 (')') on line 1 and shows expected an expression");

// Copy review screenshots
fs.copyFileSync("docs/media/r3-step-through.png", "docs/media/r3-review-step-through.png");
fs.copyFileSync("docs/media/r3-list-boxes.png", "docs/media/r3-review-list-boxes.png");
fs.copyFileSync("docs/media/r3-parse-error.png", "docs/media/r3-review-parse-error.png");
console.log("Review screenshots copied to docs/media/r3-review-*");

console.log("=== PERF PROBE ===");
// Measure 5 runs of sum-of-squares
paintLogs.length = 0;
await page.reload();
await page.waitForSelector(".cm-editor");

const runTimes = [];
for (let i = 0; i < 5; i++) {
	await page.click("button.run");
	await page.waitForTimeout(150);
}

for (const log of paintLogs) {
	const match = log.match(/\[redex\] run-to-paint ([\d.]+) ms/);
	if (match) runTimes.push(parseFloat(match[1]));
}
console.log("Run-to-paint measurements (ms):", runTimes);
runTimes.sort((a, b) => a - b);
const medianRunToPaint = runTimes[Math.floor(runTimes.length / 2)];
console.log(`Median run-to-paint: ${medianRunToPaint} ms (budget <= 100 ms)`);
if (medianRunToPaint > 100) throw new Error(`Median run-to-paint ${medianRunToPaint} ms > 100 ms budget`);

// Scrub step-limit trace
await page.click(".cm-content");
await page.keyboard.press("Control+A");
await page.keyboard.press("Backspace");
await page.keyboard.type("(\\x -> x x) (\\x -> x x)");
await page.waitForTimeout(100);
await page.click("button.run");
await page.waitForTimeout(300);

// Observe long tasks during scrub
await page.evaluate(() => {
	window.__longTasks = [];
	const observer = new PerformanceObserver((list) => {
		for (const entry of list.getEntries()) {
			window.__longTasks.push({ duration: entry.duration, startTime: entry.startTime });
		}
	});
	observer.observe({ entryTypes: ["longtask"] });
});

const slider = page.locator("input[type=range]");
for (let val = 0; val <= 1000; val += 50) {
	await slider.evaluate((el, v) => {
		const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
		setter.call(el, String(v));
		el.dispatchEvent(new Event("input", { bubbles: true }));
	}, val);
	await page.waitForTimeout(10);
}
await page.waitForTimeout(100);

// Check at frame 1000
const limitNote = await page.locator(".expr-note").textContent();
console.log(`Frame 1000 limit note: "${limitNote}"`);
if (!limitNote.includes("stopped after 1,000 steps")) {
	throw new Error(`Expected 'stopped after 1,000 steps', got "${limitNote}"`);
}

const longTasks = await page.evaluate(() => window.__longTasks);
console.log("Long tasks during scrub (>50ms):", longTasks);
if (longTasks.length > 0) {
	const longest = Math.max(...longTasks.map((t) => t.duration));
	if (longest > 50) throw new Error(`Longest task during scrub ${longest} ms > 50 ms budget`);
}

console.log(`Perf probe PASS: median run-to-paint ${medianRunToPaint} ms <= 100 ms; 0 long tasks > 50 ms`);

console.log("Console errors recorded:", errors);
if (errors.length > 0) throw new Error(`Found ${errors.length} console errors: ${errors.join(", ")}`);

await browser.close();
console.log("ALL LANES AND PROBES PASSED WITH ZERO CONSOLE ERRORS");