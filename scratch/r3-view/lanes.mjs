import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://localhost:5173/");
await page.waitForSelector(".cm-editor");
await page.click("button.run");
await page.waitForSelector(".expr-line");
const key = (k) => page.keyboard.press(k);

for (let i = 0; i < 20; i++) await key("ArrowRight");
await page.waitForTimeout(400);
await page.screenshot({ path: "docs/media/r3-step-through.png" });

await page.reload();
await page.waitForSelector(".cm-editor");
await page.click("button.run");
await page.waitForSelector(".expr-line");
await key("ArrowRight");
await page.waitForTimeout(400);
await page.screenshot({ path: "docs/media/r3-list-boxes.png" });
const boxes = await page.locator(".box").count();
const litBoxes = await page.locator(".box.lit").count();

await page.click(".cm-content");
await page.keyboard.press("Control+A");
await page.keyboard.type("map (\\x -> x +) [1]");
await page.click("button.run");
await page.waitForTimeout(500);
await page.screenshot({ path: "docs/media/r3-parse-error.png" });
const errText = await page.locator(".error").textContent().catch(() => "");
const mark = await page.locator(".cm-parse-error").count();

console.log(JSON.stringify({ boxes, litBoxes, errText, mark, errors }));
await browser.close();
