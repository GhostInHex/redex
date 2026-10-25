import assert from "node:assert/strict";
import { chromium } from "playwright";
import LZString from "lz-string";
import { mkdir, writeFile } from "node:fs/promises";
const base = (process.env.BASE_URL ?? "http://127.0.0.1:5177").replace(
  /\/$/,
  "",
);
const out = process.env.FRONTEND_ARTIFACTS;
const hash = (source) =>
  "#p=" + LZString.compressToEncodedURIComponent("redex1:" + source);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();
const errors = [],
  results = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (e) => {
  if (e.type() === "error") errors.push(e.text());
});
async function pass(name) {
  results.push(name);
  console.log("PASS", name);
}
async function shot(name) {
  if (out) {
    await mkdir(out, { recursive: true });
    await page.screenshot({ path: out + "/" + name + ".png", fullPage: true });
  }
}
try {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(base);
  await page.getByRole("heading", { level: 1 }).waitFor();
  const hero = page.getByLabel("Interactive evaluation demo");
  assert.match(await hero.locator(".expr-line").innerText(), /1 \+ 2/);
  await hero.getByRole("button", { name: "Step →", exact: true }).click();
  assert.equal((await hero.locator(".expr-line").innerText()).trim(), "3 * 3");
  await hero.getByRole("button", { name: "Step →", exact: true }).click();
  assert.equal((await hero.locator(".expr-line").innerText()).trim(), "9");
  await hero.getByRole("button", { name: "Reset", exact: true }).click();
  assert.match(await hero.locator(".expr-line").innerText(), /1 \+ 2/);
  await pass("real hero trace and reset");
  await shot("landing-desktop");
  await page
    .getByRole("link", { name: "Try Redex", exact: false })
    .first()
    .click();
  await page.locator(".cm-editor").waitFor();
  assert.match(page.url(), /\/play#p=/);
  assert.match(await page.locator(".cm-content").innerText(), /1 \+ 2/);
  await page.getByRole("button", { name: "Forward one frame" }).click();
  assert.equal(await page.locator(".counter").innerText(), "1 / 2");
  await pass("CTA carries exact source and Watch works");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.locator('[data-path="0"]').press("Enter");
  assert.match(await page.locator(".practice-score").innerText(), /Right/);
  await pass("Practice answer and feedback");
  await page.getByRole("button", { name: "Share this program" }).click();
  await page.locator("dialog[open]").waitFor();
  const shared = await page
    .getByRole("textbox", { name: "Share link", exact: true })
    .inputValue();
  assert.match(shared, /\/play#p=/);
  const snippet = await page
    .getByRole("textbox", { name: "Embed code" })
    .inputValue();
  assert.match(snippet, /\/play\?embed=1#p=/);
  await page.keyboard.press("Escape");
  await pass("canonical Share and Embed URLs");
  await page.goto(base + "/" + hash("2 + 3"));
  await page.locator(".counter").waitFor();
  assert.match(await page.locator(".cm-content").innerText(), /2 \+ 3/);
  await pass("legacy root shared URL");
  await page.goto(base + "/#p=invalid");
  await page.getByText(/This link could not be read/).waitFor();
  await pass("malformed legacy link fallback");
  await page.goto(base + "/play?embed=1" + hash("2 + 3"));
  await page.locator(".counter").waitFor();
  assert.equal(await page.locator(".cm-editor").count(), 0);
  const full = await page
    .getByRole("link", { name: "Open the full editor" })
    .getAttribute("href");
  assert.match(full, /\/play#p=/);
  assert.ok(!full.includes("embed="));
  await pass("compact embed and full-editor link");
  await page.goto(base + "/play" + hash("(1 + 2) * 3"));
  await page.locator(".cm-editor").waitFor();
  await page.reload();
  await page.locator(".cm-editor").waitFor();
  await pass("production direct route and reload");
  await shot("playground-desktop");
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(base);
    await page.getByRole("heading", { level: 1 }).waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "landing overflow at " + width,
    );
    if (width === 390) await shot("landing-mobile");
    await page.goto(base + "/play" + hash("1 + 2"));
    await page.locator(".cm-editor").waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "playground overflow at " + width,
    );
    await page.getByRole("button", { name: "Examples", exact: true }).click();
    const menu = page.getByRole("menu");
    const box = await menu.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width);
    const labelsFit = await menu.getByRole("menuitem").evaluateAll(items =>
      items.every(item => {
        const row = item.getBoundingClientRect();
        return [...item.children].every(child => {
          const label = child.getBoundingClientRect();
          return label.left >= row.left - 1 && label.right <= row.right + 1
            && label.top >= row.top - 1 && label.bottom <= row.bottom + 1;
        });
      }),
    );
    assert.ok(labelsFit, `lesson titles and descriptions fit their rows at ${width}px`);
    await page.getByRole("menuitem").last().click();
    await page.locator(".counter").waitFor();
    if (width === 390) await shot("playground-mobile");
  }
  await pass("320/390px layout and last example selection");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base + "/#how-it-works");
  await page.getByRole("heading", { level: 1 }).waitFor();
  assert.equal(await page.locator(".cm-editor").count(), 0);
  await pass("section anchors and reduced-motion landing");
  assert.deepEqual(errors, []);
  await pass("no console or page errors");
} finally {
  if (out)
    await writeFile(
      out + "/results.json",
      JSON.stringify({ results, errors }, null, 2),
    );
  await browser.close();
}
