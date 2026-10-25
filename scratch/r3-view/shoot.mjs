import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto("http://localhost:5199/scratch/r3-view/");
await page.waitForSelector(".code");
const shot = async (name) => page.screenshot({ path: `scratch/r3-view/${name}.png` });
const btn = (label) => page.locator("button", { hasText: label });

await shot("p-draw-a-anim-a");
await btn("B boxes").click();
await page.waitForTimeout(250);
await shot("p-draw-b-anim-a");
await btn("B layout").click();
await page.waitForTimeout(250);
await shot("p-draw-b-anim-b");
await btn("A inline").click();
await page.waitForTimeout(250);
await shot("p-draw-a-anim-b");

await page.keyboard.press("ArrowRight");
await page.waitForTimeout(250);
await shot("p-frame1-inline");
await btn("B boxes").click();
await page.waitForTimeout(300);
await shot("p-frame1-boxes");

await browser.close();
console.log("shots done");
