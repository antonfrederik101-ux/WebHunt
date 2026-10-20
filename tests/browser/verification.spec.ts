import { test, expect } from "@playwright/test";
test("admin evidence requires authorization and rejects untrusted source URLs", async ({
  request,
}) => {
  expect((await request.get("/api/admin/verification")).status()).toBe(401);
  expect(
    (
      await request.post("/api/admin/verification", {
        data: { id: "overture/browser-a", state: "closed" },
      })
    ).status(),
  ).toBe(401);
});
test("real admin review hides a closed company from the actual API while retaining its source row and history", async ({
  page,
  request,
}) => {
  test.skip(
    !process.env.WEBHUNT_TEST_ADMIN_TOKEN || !process.env.WEBHUNT_TEST_CATALOG,
    "Requires the isolated verification integration database",
  );
  const token = process.env.WEBHUNT_TEST_ADMIN_TOKEN!,
    headers = { Authorization: "Bearer " + token };
  let r = await request.get("/api/businesses");
  expect(r.status()).toBe(200);
  expect(
    (await r.json()).businesses.map((b: { id: string }) => b.id),
  ).not.toContain("overture/browser-b");
  r = await request.post("/api/admin/verification", {
    headers,
    data: {
      id: "overture/browser-a",
      state: "active",
      reason: "Dette er en kontrolleret testfixture for kildevalidering.",
      sourceUrl: "https://untrusted.example/",
      identityConfirmed: true,
    },
  });
  expect(r.status()).toBe(400);
  await page.goto("/admin");
  await page.getByLabel("Privat administratornøgle").fill(token);
  await page.getByRole("button", { name: "Åbn kontroloversigt" }).click();
  await expect(page.locator(".admin-counts")).toContainText(
    "Bekræftet lukkede",
  );
  await page
    .locator(".company-row")
    .filter({ hasText: "Kontrolfixture A" })
    .click();
  const panel = page.getByRole("region", { name: "Kontrol af virksomhed" });
  await panel
    .getByRole("combobox", { name: "Virksomhedsstatus", exact: true })
    .selectOption("closed");
  await panel
    .getByLabel("Offentlig kildeside")
    .fill("https://datacvr.virk.dk/enhed/virksomhed/12345678");
  await panel
    .getByLabel("Konkrete virksomhedsoplysninger fra kilden")
    .fill(
      "Kontrolleret browserfixture: samme identitet er dokumenteret ophørt i testkilden.",
    );
  await panel.getByRole("checkbox", { name: /Jeg har kontrolleret/ }).check();
  await panel
    .getByRole("button", { name: "Gem kildecheck i historikken" })
    .click();
  await expect(panel).toHaveCount(0);
  r = await request.get("/api/businesses");
  const result = await r.json();
  expect(result.catalogTotal).toBe(3);
  expect(result.businesses).toHaveLength(1);
  expect(result.businesses[0].id).toBe("overture/browser-c");
  r = await request.get("/api/admin/verification?id=overture%2Fbrowser-a", {
    headers,
  });
  const detail = await r.json();
  expect(detail.business.name).toBe("Kontrolfixture A");
  expect(detail.business.verification.identity.state).toBe("closed");
  expect(detail.history).toHaveLength(1);
  await page
    .getByRole("combobox", { name: "Virksomhedsstatus", exact: true })
    .selectOption("closed");
  await page.getByRole("button", { name: "Opdatér", exact: true }).click();
  await expect(page.locator(".company-row")).toHaveCount(2);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Hent rapport" }).click();
  expect((await download).suggestedFilename()).toBe(
    "webhunt-kontrolrapport.json",
  );
});
test("an unverified company with an old red personal rating remains gray and shows activity uncertainty", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "webhunt-guest-statuses",
      JSON.stringify({ "overture/unverified": "missing" }),
    ),
  );
  await page.route("**/api/health", (r) =>
    r.fulfill({ json: { supabase: { configured: false } } }),
  );
  await page.route("**/api/businesses*", (r) =>
    r.fulfill({
      json: {
        businesses: [
          {
            id: "overture/unverified",
            name: "Usikker testfixture",
            lat: 54.7691,
            lon: 11.8743,
            address: "Testvej 1",
            city: "Nykøbing Falster",
            postcode: "4800",
            category: "Frisør",
            phone: "",
            website: "",
            status: "unknown",
            sourceUrl: "https://explore.overturemaps.org/",
          },
        ],
        overview: true,
        limited: false,
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Virksomheder", exact: true }).click();
  await page.locator(".company-row").click();
  await expect(page.locator(".activity-evidence")).toContainText("Usikker");
  await expect(page.locator(".business-drawer .status-badge")).toContainText(
    "Ikke undersøgt",
  );
  await expect(page.getByLabel("DIN VURDERING")).toHaveValue("missing");
  await page
    .getByRole("button", { name: "Luk virksomhed", exact: true })
    .click();
  await page.getByRole("button", { name: "Kort", exact: true }).click();
  await page.getByRole("button", { name: "Find potentielle kunder" }).click();
  await expect(page.locator(".map-notice")).toContainText(
    "Ingen virksomheder matcher",
  );
});
