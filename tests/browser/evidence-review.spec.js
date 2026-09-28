import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.goto("/app?sample=1");
  await expect(page.locator("#evidenceReview")).toBeVisible({ timeout: 20_000 });
});

test("filters compose without changing selections or the underlying analysis", async ({ page }) => {
  const cards = page.locator("[data-evidence-index]");
  const count = await cards.count();
  expect(count).toBeGreaterThan(1);
  await cards.first().locator("[data-select-evidence]").click();
  await page.locator("#evidenceSearch").fill("no-such-column-xyz");
  await expect(page.locator("#evidenceNoMatches")).toBeVisible();
  await expect(page.locator("#briefCount")).toHaveText("1 finding in your brief");
  await page.locator("#evidenceClearFilters").click();
  await expect(page.locator("[data-evidence-index]:visible")).toHaveCount(count);
  await page.locator("#evidenceSelectedOnly").click();
  await expect(page.locator("[data-evidence-index]:visible")).toHaveCount(1);
  await page.locator("#evidenceSearch").fill("REVENUE");
  for (const card of await page.locator("[data-evidence-index]:visible").all()) {
    await expect(card).toContainText(/revenue/i);
  }
  await page.locator("#evidenceClearFilters").click();
  const strength = await page.locator("#evidenceStrength option").nth(1).getAttribute("value");
  await page.locator("#evidenceStrength").selectOption(strength);
  const expected = await page.evaluate(strength => reviewedResult.evidence.filter(e => e.strength === strength).length, strength);
  await expect(page.locator("[data-evidence-index]:visible")).toHaveCount(expected);
  await expect(cards).toHaveCount(count);
});

test("downloads only selected evidence with caveats, provenance, and escaped analyst notes", async ({ page, context }) => {
  const first = page.locator("[data-evidence-index]").first();
  const claim = await first.locator(".evidence-claim").textContent();
  const omitted = await page.locator(".evidence-claim").nth(1).textContent();
  await first.locator("[data-select-evidence]").click();
  const note = '<img src=x onerror="window.pwned=true"> Investigate the regional mix.';
  await page.locator("#briefNote").fill(note);
  const event = page.waitForEvent("download");
  await page.locator("#exportBriefBtn").click();
  const download = await event;
  expect(download.suggestedFilename()).toMatch(/-brief\.html$/);
  const html = await readFile(await download.path(), "utf8");
  const preview = await context.newPage();
  await preview.setContent(html);
  await expect(preview.locator("article")).toHaveCount(1);
  await expect(preview.locator("article h2")).toHaveText(claim);
  await expect(preview.locator("article")).not.toContainText(omitted);
  await expect(preview.locator("aside")).toContainText(note);
  await expect(preview.locator("img, script")).toHaveCount(0);
  await expect(preview.locator("header")).toContainText("not a complete analysis");
  await expect(preview.locator("article")).toContainText(/coverage/);
  await expect(preview.locator("article pre")).toContainText("formula");
  const caveat = await first.locator(".evidence-caveat").allTextContents();
  if (caveat.length) await expect(preview.locator("article")).toContainText(caveat[0].replace("Caveat — ", ""));
  await preview.close();
});

test("a new run does not inherit a previous selection or note", async ({ page }) => {
  await page.locator("[data-select-evidence]").first().click();
  await page.locator("#briefNote").fill("Old analysis note");
  await page.locator("#resetBtn").click();
  await page.locator("#sampleBtn").click();
  await expect(page.locator("#dashboardScreen")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#briefPanel")).toBeHidden();
  await expect(page.locator("#briefNote")).toHaveValue("");
  await expect(page.locator("#evidenceCount")).toContainText("0 selected");
});

test("removing the last filtered selection preserves keyboard focus", async ({ page }) => {
  await page.locator("[data-select-evidence]").first().click();
  await page.locator("#evidenceSelectedOnly").click();
  const selected = page.locator('[data-select-evidence][aria-pressed="true"]');
  await selected.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#evidenceSelectedOnly")).toBeFocused();
  await expect(page.locator("#evidenceNoMatches")).toBeVisible();
  await expect(page.locator("#briefPanel")).toBeHidden();
});
