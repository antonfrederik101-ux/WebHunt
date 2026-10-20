import { test, expect } from "@playwright/test";
// Controlled fixtures test UI behavior; they are never shipped as business data.
const record = {
  id: "node/42",
  name: "Testvirksomhed (testfixture)",
  lat: 54.7691,
  lon: 11.8743,
  address: "Testvej 1",
  city: "Nykøbing Falster",
  postcode: "4800",
  category: "Bager",
  phone: "+4512345678",
  website: "https://example.com/",
  status: "unknown",
  sourceUrl: "https://www.openstreetmap.org/node/42",
};
async function fixture(page: import("@playwright/test").Page) {
  await page.route("**/api/health", (r) =>
    r.fulfill({
      json: {
        name: "WebHunt",
        supabase: {
          configured: true,
          auth: "ok",
          database: "missing",
          missingTables: ["leads", "business_statuses"],
        },
      },
    }),
  );
  await page.route("**/api/businesses*", (r) =>
    r.fulfill({
      json: {
        businesses: [record],
        overview: true,
        limited: false,
        fetchedAt: new Date().toISOString(),
      },
    }),
  );
  await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
  await page.goto("/");
  await expect(page.locator(".map-stats")).toContainText("1");
}
test("rapid navigation cancels map callbacks and loads businesses without waiting for map startup", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fixture(page);
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("button", { name: "Virksomheder", exact: true })
      .click();
    await expect(page.locator(".company-row")).toHaveCount(1);
    await page.getByRole("button", { name: "Kort", exact: true }).click();
  }
  await page.getByRole("button", { name: "Virksomheder", exact: true }).click();
  await page.waitForTimeout(800); // Delayed map bounds callback must not outlive an unmounted map.
  expect(errors).toEqual([]);
});
test("map → business → status → lead → notes → CSV → persisted reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fixture(page);
  await page.getByRole("button", { name: "Virksomheder", exact: true }).click();
  await page.locator(".company-row").click();
  await expect(page.locator(".business-drawer h2")).toHaveText(record.name);
  await page.getByLabel("DIN VURDERING").selectOption("improve");
  await page.getByRole("button", { name: "Gem som lead" }).click();
  await expect(page.locator(".toast")).toContainText("Lead gemt");
  await page
    .getByRole("button", { name: "Luk virksomhed", exact: true })
    .click();
  await page.getByRole("button", { name: /Mine leads/ }).click();
  await expect(page.locator(".lead-card")).toHaveCount(1);
  await page.getByLabel("KONTAKTSTATUS").selectOption("Interesseret");
  await page.getByLabel("DINE NOTER").fill("Ring næste uge");
  await page.getByRole("button", { name: "Gem note" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Eksportér CSV" }).click();
  expect((await download).suggestedFilename()).toMatch(/webhunt-leads/);
  await page.reload();
  await page.getByRole("button", { name: /Mine leads/ }).click();
  await expect(page.getByLabel("DINE NOTER")).toHaveValue("Ring næste uge");
  await expect(page.getByLabel("KONTAKTSTATUS")).toHaveValue("Interesseret");
  await expect(page.locator(".lead-card .status-badge")).toContainText(
    "Ikke undersøgt",
  );
  await page.getByRole("button", { name: "Statistik", exact: true }).click();
  await expect(page.locator(".metric").nth(2)).toContainText("1");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("webhunt-guest-statuses") || "{}")[
          "node/42"
        ],
    ),
  ).toBe("improve");
  expect(errors).toEqual([]);
});
test("analysis failures remain unknown and are visible", async ({ page }) => {
  await fixture(page);
  await page.getByRole("button", { name: "Virksomheder", exact: true }).click();
  await page.locator(".company-row").click();
  await page.route("**/api/analyze", (r) =>
    r.fulfill({
      status: 502,
      json: { error: "Test: PageSpeed-kvote opbrugt" },
    }),
  );
  await page.getByRole("button", { name: "Analysér hjemmeside" }).click();
  await expect(page.locator(".business-drawer [role=alert]")).toContainText(
    "PageSpeed",
  );
  await expect(page.getByLabel("DIN VURDERING")).toHaveValue("unknown");
  await page.getByLabel("DIN VURDERING").selectOption("improve");
  await page.getByRole("button", { name: "Analysér hjemmeside" }).click();
  await expect(page.locator(".business-drawer [role=alert]")).toContainText(
    "PageSpeed",
  );
  await expect(page.getByLabel("DIN VURDERING")).toHaveValue("improve");
});
test("mobile navigation, filters and honest missing configuration", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Filtre", exact: true }).click();
  await expect(page.locator(".filter-sidebar")).toBeVisible();
  await page.getByRole("button", { name: "Find potentielle kunder" }).click();
  await page.getByRole("button", { name: "Luk filtre", exact: true }).click();
  await expect(page.locator(".map-notice")).toContainText(
    "Ingen virksomheder matcher",
  );
  await page.getByRole("button", { name: "Ryd filtre", exact: true }).click();
  await page.getByRole("button", { name: "Log ind", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    /Godt at se dig igen|Supabase tilsluttes/,
  );
  await page.getByRole("button", { name: "Luk login" }).click();
  await page
    .getByRole("button", { name: "Indstillinger", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Indstillinger", exact: true }),
  ).toBeVisible();
});
test("external data failure has an actionable error and no invented businesses", async ({
  page,
}) => {
  await page.route("**/api/businesses*", (r) =>
    r.fulfill({
      status: 502,
      json: { error: "Datakilden er utilgængelig", businesses: [] },
    }),
  );
  await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
  await page.goto("/");
  await expect(page.locator(".map-notice.error")).toContainText(
    "Datakilden er utilgængelig",
  );
  await expect(
    page.getByRole("button", { name: "Prøv igen", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".map-stats")).toContainText("Data ikke indlæst");
});

test("clickable map marker and successful analysis update the real UI", async ({
  page,
}) => {
  await fixture(page);
  await page.locator(".business-marker").first().click();
  await expect(page.locator(".business-drawer h2")).toHaveText(record.name);
  await page.route("**/api/analyze", (r) =>
    r.fulfill({
      json: {
        score: 92,
        performance: 90,
        seo: 95,
        accessibility: 91,
        https: true,
        findings: ["Testresultat fra browserfixture"],
        checkedAt: new Date().toISOString(),
        url: record.website,
        status: "good",
      },
    }),
  );
  await page.getByRole("button", { name: "Analysér hjemmeside" }).click();
  await expect(page.locator(".score-row")).toContainText("92");
  await expect(page.getByLabel("DIN VURDERING")).toHaveValue("good");
});

test("backend rejects invalid geographic queries and internal website targets", async ({
  request,
}) => {
  const bbox = await request.get("/api/businesses?bbox=1,1,2,2");
  expect(bbox.status()).toBe(400);
  expect((await bbox.json()).error).toContain("kortudsnit");
  const url = await request.post("/api/analyze", {
    data: { url: "http://127.0.0.1" },
  });
  expect(url.status()).toBe(400);
  const place = await request.get("/api/geocode?q=");
  expect(place.status()).toBe(400);
  const callback = await request.get("/auth/callback", { maxRedirects: 0 });
  expect(callback.status()).toBe(307);
  expect(callback.headers().location).toContain("auth_error=1");
});

test("analysis endpoint enforces its request quota", async ({ request }) => {
  let last = 0;
  for (let i = 0; i < 6; i++) {
    const r = await request.post("/api/analyze", {
      headers: { "x-forwarded-for": "198.51.100.77" },
      data: { url: "http://127.0.0.1" },
    });
    last = r.status();
    if (i === 5) expect(r.headers()["retry-after"]).toBeTruthy();
  }
  expect(last).toBe(429);
});

test("WebHunt branding and missing-table instructions are visible without exposing credentials", async ({
  page,
}) => {
  await fixture(page);
  await expect(page).toHaveTitle(/WebHunt/);
  await expect(page.locator(".brand")).toContainText("webhunt");
  await page
    .getByRole("button", { name: "Indstillinger", exact: true })
    .click();
  await expect(page.locator(".connection-panel")).toContainText(
    "Loginserveren svarer",
  );
  await expect(page.locator(".connection-panel")).toContainText(
    "leads, business_statuses",
  );
  await expect(page.locator(".connection-panel")).toContainText("SQL Editor");
  await expect(page.locator("body")).not.toContainText("WebRadar");
});

test("cached partial data is visibly dated and never presented as a complete live dataset", async ({
  page,
}) => {
  await page.route("**/api/health", (r) =>
    r.fulfill({
      json: {
        supabase: {
          configured: true,
          auth: "ok",
          database: "missing",
          missingTables: ["leads", "business_statuses"],
        },
      },
    }),
  );
  await page.route("**/api/businesses*", (r) =>
    r.fulfill({
      json: {
        businesses: [record],
        overview: false,
        limited: false,
        stale: true,
        partial: true,
        warning:
          "Viser tidligere hentede OSM-data. Dækningen kan være ufuldstændig.",
        fetchedAt: "2026-10-19T12:00:00Z",
      },
    }),
  );
  await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
  await page.goto("/");
  await expect(page.locator(".data-warning")).toContainText("ufuldstændig");
  await expect(page.locator(".data-warning")).toContainText("19.10.2026");
});

test("local Denmark map renders without any third-party tile provider when no key is configured", async ({
  page,
}) => {
  const forbidden: string[] = [];
  page.on("request", (r) => {
    if (/tile\.openstreetmap\.org|api\.maptiler\.com/.test(r.url()))
      forbidden.push(new URL(r.url()).hostname);
  });
  await fixture(page);
  await page
    .getByRole("button", { name: "Vis hele Danmark", exact: true })
    .click();
  await expect(
    page.locator(".leaflet-country-context-pane path").first(),
  ).toBeVisible();
  await expect(page.locator(".map-provider-note")).toContainText(
    "Natural Earth",
  );
  await expect(page.locator(".leaflet-control-attribution")).toContainText(
    "Natural Earth",
  );
  expect(forbidden).toEqual([]);
});

test("unavailable company data is not presented as zero Danish businesses and respects retry time", async ({
  page,
}) => {
  await page.route("**/api/health", (r) =>
    r.fulfill({
      json: {
        supabase: {
          configured: false,
          auth: "unconfigured",
          database: "unconfigured",
          missingTables: [],
        },
      },
    }),
  );
  await page.route("**/api/businesses*", (r) =>
    r.fulfill({
      status: 503,
      headers: { "Retry-After": "120" },
      json: {
        error: "Ekstern virksomhedsdatakilde er utilgængelig",
        businesses: [],
        retryAfter: 120,
      },
    }),
  );
  await page.goto("/");
  await expect(page.locator(".map-notice.error")).toContainText("utilgængelig");
  await expect(page.locator(".map-stats")).toContainText("Data ikke indlæst");
  await expect(page.locator(".map-notice.error button")).toBeDisabled();
  await expect(page.locator(".map-notice.error button")).toContainText(
    "Prøv igen om",
  );
});

test("light theme keeps readable surfaces, mint actions and status text", async ({
  page,
}) => {
  await fixture(page);
  await expect(page.locator(".filter-sidebar")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(page.locator(".main-content")).toHaveCSS(
    "background-color",
    "rgb(243, 246, 245)",
  );
  await expect(
    page.getByRole("button", { name: "Find potentielle kunder" }),
  ).toHaveCSS("background-color", "rgb(140, 230, 191)");
  await page.getByRole("button", { name: "Virksomheder", exact: true }).click();
  await page.locator(".company-row").click();
  await expect(page.locator(".business-drawer")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await page.getByLabel("DIN VURDERING").selectOption("improve");
  await expect(
    page.locator(".business-drawer .status-badge").first(),
  ).toHaveCSS("color", "rgb(89, 109, 99)");
});
