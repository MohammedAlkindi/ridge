import { expect, test } from "@playwright/test";

test("a reopened run reports its actual saved state rather than the pre-save snapshot", async ({ page }) => {
  const analyzed = page.waitForResponse((response) => response.url().endsWith("/api/analyze") && response.request().method() === "POST");
  await page.goto("/app?sample=1");
  const payload = await (await analyzed).json();
  payload.meta.saved = false;
  await page.route("**/api/analysis/saved-state-test", (route) => route.fulfill({
    contentType: "application/json", body: JSON.stringify({ id: "saved-state-test", kind: "single", payload }),
  }));
  await page.goto("/app?a=saved-state-test");
  await expect(page.locator("#dashboardScreen")).toBeVisible();
  await expect(page.locator("#analysisRecordGrid")).toContainText("Saved by request");
  await expect(page.locator("#shareBtn")).toBeVisible();
});
