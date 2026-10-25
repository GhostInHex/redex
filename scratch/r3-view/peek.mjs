import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto("http://localhost:5199/scratch/r3-view/");
await page.waitForSelector(".code");
console.log("buttons:", await page.locator("button").allTextContents());
console.log("html:", (await page.locator(".row").first().innerHTML()).slice(0, 600));
await browser.close();
