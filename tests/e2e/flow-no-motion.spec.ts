import { test, expect } from "@playwright/test";

// Cart / checkout / track must be completely static. Run against `next start` + the local backend.
for (const path of ["/cart", "/checkout", "/track"]) {
  test(`${path}: no animation, no transition, no popup, no overflow @360`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(path);
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll("*")].filter((el) => {
        const c = getComputedStyle(el);
        const hasAnim = c.animationName !== "none" && c.animationDuration !== "0s";
        const hasTrans = c.transitionDuration.split(",").some((d) => d.trim() !== "0s");
        return hasAnim || hasTrans;
      }).map((el) => el.tagName + "." + el.className).slice(0, 10));
    expect(bad).toEqual([]);
    expect(await page.locator("dialog[open]").count()).toBe(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
}
