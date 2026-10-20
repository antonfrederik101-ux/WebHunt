import { test, expect } from "@playwright/test";

// Run against the configured dev preview with WEBHUNT_TEST_MAPTILER=1.
// These are controlled transport tests, not evidence of live provider availability.
test.describe("configured MapTiler transport", () => {
  test.skip(
    process.env.WEBHUNT_TEST_MAPTILER !== "1",
    "Requires a configured MapTiler preview",
  );
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/health", (r) =>
      r.fulfill({ json: { supabase: { configured: false } } }),
    );
    await page.route("**/api/businesses*", (r) =>
      r.fulfill({ json: { businesses: [], overview: true, limited: false } }),
    );
  });
  test("Streets v4 loads tiles, retains attribution and requests street detail after city navigation", async ({
    page,
  }) => {
    const paths: string[] = [];
    await page.route("https://api.maptiler.com/**", (r) => {
      const u = new URL(r.request().url());
      paths.push(u.pathname);
      if (u.pathname.endsWith("style.json"))
        return r.fulfill({ json: { version: 8, layers: [] } });
      return r.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=",
          "base64",
        ),
      });
    });
    await page.goto("/");
    await expect(page.locator(".map-provider-note")).toContainText(
      "MapTiler Streets Light",
    );
    await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
    await expect(page.locator(".leaflet-control-attribution")).toContainText(
      "MapTiler",
    );
    await expect(page.locator(".leaflet-control-attribution")).toContainText(
      "OpenStreetMap",
    );
    await page
      .getByRole("combobox", { name: "Vælg en anden dansk by" })
      .selectOption("Nykøbing Falster");
    await expect
      .poll(() => paths.some((p) => p.startsWith("/maps/streets-v4/13/")))
      .toBe(true);
    expect(paths.every((p) => p.startsWith("/maps/streets-v4/"))).toBe(true);
  });
  for (const denied of ["style", "tile"]) {
    test(`HTTP 403 on ${denied} produces an honest error and stops retries`, async ({
      page,
    }) => {
      let requests = 0;
      await page.route("https://api.maptiler.com/**", (r) => {
        requests++;
        if (
          denied === "tile" &&
          new URL(r.request().url()).pathname.endsWith("style.json")
        )
          return r.fulfill({ json: { version: 8, layers: [] } });
        return r.fulfill({ status: 403, body: "Access denied" });
      });
      await page.goto("/");
      await expect(
        page.locator(".map-provider-note[role=alert]"),
      ).toContainText("HTTP 403");
      await expect(page.locator(".leaflet-tile-pane img")).toHaveCount(0);
      await page.waitForTimeout(300);
      const stopped = requests;
      await page.locator(".leaflet-control-zoom-in").click();
      await page.waitForTimeout(700);
      expect(requests).toBe(stopped);
      await expect(
        page.locator(".leaflet-country-context-pane path").first(),
      ).toBeVisible();
    });
  }
});
