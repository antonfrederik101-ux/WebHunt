import { test, expect, type Page } from "@playwright/test";

// Browser-only fixtures; no invented companies are written to the app database.
const base = {
  lat: 54.7691,
  lon: 11.8743,
  address: "Testvej 1",
  city: "Nykøbing Falster",
  postcode: "4800",
  category: "hair_salon",
  phone: "",
  website: "",
  status: "unknown",
  source: "Overture Maps",
  sourceUrl: "https://explore.overturemaps.org/",
  sourceRelease: "2026-09-23.1",
  sourceDatasets: ["metaPlaces"],
  licenses: ["CDLA-Permissive-2.0"],
};
const places = [
  { ...base, id: "overture/red", name: "Ingen registreret side (test)" },
  {
    ...base,
    id: "overture/social",
    name: "Social profil (test)",
    website: "https://facebook.com/fixture",
  },
  {
    ...base,
    id: "overture/gray",
    name: "Registreret side (test)",
    website: "https://example.com",
  },
  { ...base, id: "overture/orange", name: "Manuel orange (test)" },
  { ...base, id: "overture/green", name: "Manuel grøn (test)" },
];
async function health(page: Page) {
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
}
test("Denmark starts with truthful mixed clusters; social-only evidence, filters and personal ratings survive reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await health(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem("webhunt-guest-statuses"))
      localStorage.setItem(
        "webhunt-guest-statuses",
        JSON.stringify({
          "overture/orange": "improve",
          "overture/green": "good",
        }),
      );
  });
  await page.route("**/api/businesses*", (r) =>
    r.fulfill({
      json: {
        businesses: places,
        overview: true,
        limited: false,
        catalogTotal: 1448,
        matchedTotal: 5,
        categories: ["Frisør"],
        nextOffset: null,
        revision: "fixture-1",
      },
    }),
  );
  await page.goto("/");
  await expect(page.locator(".catalog-summary")).toContainText("1.448");
  await expect(page.locator(".cluster-ring")).toHaveCount(1);
  const ring = page.locator(".cluster-ring");
  await expect(ring).toHaveAttribute(
    "aria-label",
    /Ingen registreret hjemmeside: 2/,
  );
  await expect(ring).toHaveAttribute("aria-label", /Forbedringsmuligheder: 1/);
  await expect(ring).toHaveAttribute(
    "aria-label",
    /Velfungerende hjemmeside: 1/,
  );
  await expect(ring).toHaveAttribute("aria-label", /Ikke undersøgt: 1/);
  expect(
    await ring.evaluate((e) => getComputedStyle(e).backgroundImage),
  ).toContain("conic-gradient");
  await expect(page.locator(".coverage-footer")).toContainText("Oversigten");
  await page
    .getByRole("checkbox", { name: /Ingen registreret hjemmeside/ })
    .check();
  await expect(ring).toHaveAttribute("aria-label", /^2 virksomheder/);
  await page.getByRole("button", { name: /Alle farver/ }).click();
  await page.getByRole("button", { name: "Virksomheder", exact: true }).click();
  await page
    .locator(".company-row")
    .filter({ hasText: "Social profil (test)" })
    .click();
  await expect(page.locator(".status-evidence")).toContainText(
    "kun registreret sociale profiler",
  );
  await expect(page.locator(".status-evidence")).toContainText("ikke bevis");
  await expect(page.locator(".social-profiles a")).toHaveAttribute(
    "href",
    "https://facebook.com/fixture",
  );
  await page.getByLabel("DIN VURDERING").selectOption("unknown");
  await expect(page.locator(".status-evidence")).toContainText("Din vurdering");
  // The init script seeds only absent storage, preserving the edited gray assessment.
  await page.reload();
  await page.getByRole("button", { name: "Virksomheder", exact: true }).click();
  await page
    .locator(".company-row")
    .filter({ hasText: "Social profil (test)" })
    .click();
  await expect(page.getByLabel("DIN VURDERING")).toHaveValue("unknown");
  await expect(page.locator(".status-evidence")).toContainText("Din vurdering");
  await page
    .getByRole("button", { name: "Luk virksomhed", exact: true })
    .click();
  await page
    .locator(".company-row")
    .filter({ hasText: /^Registreret side \(test\)/ })
    .click();
  await expect(page.locator(".status-evidence")).toContainText(
    "Ikke kontrolleret",
  );
  expect(errors).toEqual([]);
});

test("search reaches the full catalog, pagination is explicit and duplicate IDs stay unique", async ({
  page,
}) => {
  await health(page);
  let sawQuery = false,
    sawSecondPage = false;
  await page.route("**/api/businesses*", (r) => {
    const u = new URL(r.request().url());
    const q = u.searchParams.get("q");
    const offset = u.searchParams.get("offset");
    sawQuery ||= q === "Sidste";
    sawSecondPage ||= offset === "600";
    const last = {
      ...base,
      id: "overture/last",
      name: "Sidste virksomhed (test)",
    };
    return r.fulfill({
      json: {
        businesses: q ? [last] : offset ? [places[0], last] : places,
        overview: true,
        limited: !q && !offset,
        catalogTotal: 707,
        matchedTotal: q ? 1 : 707,
        nextOffset: !q && !offset ? 600 : null,
        revision: "stable",
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Indlæs flere virksomheder" }).click();
  await expect(page.locator(".catalog-summary")).toContainText("6 af 707");
  expect(sawSecondPage).toBe(true);
  await page.getByPlaceholder("Navn, by, postnr. eller branche").fill("Sidste");
  await expect(page.locator(".catalog-summary")).toContainText("1 af 1");
  expect(sawQuery).toBe(true);
  await page.getByRole("button", { name: "Virksomheder", exact: true }).click();
  await expect(page.locator(".company-row")).toHaveCount(1);
  await expect(page.locator(".company-row")).toContainText("Sidste virksomhed");
});

test("known city suggestions navigate without geocoding and API query errors are explicit", async ({
  page,
  request,
}) => {
  await health(page);
  let geocodes = 0;
  await page.route("**/api/geocode*", (r) => {
    geocodes++;
    return r.abort();
  });
  await page.route("**/api/businesses*", (r) =>
    r.fulfill({ json: { businesses: [], overview: false, limited: false } }),
  );
  await page.goto("/");
  await page
    .getByPlaceholder("Navn, by, postnr. eller branche")
    .fill("Nykøbing");
  await page
    .locator(".search-suggestions")
    .getByRole("button", { name: "Nykøbing Falster" })
    .click();
  await expect(
    page.getByPlaceholder("Navn, by, postnr. eller branche"),
  ).toHaveValue("");
  expect(geocodes).toBe(0);
  const r = await request.get("/api/businesses?offset=-1");
  expect(r.status()).toBe(400);
  expect((await r.json()).error).toContain("Ugyldig");
});
