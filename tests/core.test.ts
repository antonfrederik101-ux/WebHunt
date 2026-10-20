import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBounds, toBusiness, safeWebsite, csv } from "../lib/businesses";
import { publicWebsite, summarizeLighthouse } from "../lib/analysis";
import type { Lead } from "../lib/types";
test("missing OSM website never becomes proof of a missing website", () => {
  const business = toBusiness({
    type: "node",
    id: 42,
    lat: 55.67,
    lon: 12.56,
    tags: { name: "OSM test record", shop: "bakery" },
  })!;
  assert.equal(business.status, "unknown");
  assert.equal(business.website, "");
  assert.equal(business.address, "Adresse ikke registreret");
  assert.equal(business.category, "Bager");
});
test("OSM centers, address tags and contact tags are preserved", () => {
  const b = toBusiness({
    type: "way",
    id: 9,
    center: { lat: 55.1, lon: 14.7 },
    tags: {
      name: "Test record",
      "addr:street": "Testvej",
      "addr:housenumber": "1",
      "addr:postcode": "3700",
      "addr:city": "Rønne",
      "contact:website": "example.com",
      "contact:phone": "+45 12345678",
      craft: "carpenter",
    },
  })!;
  assert.equal(b.lat, 55.1);
  assert.equal(b.address, "Testvej 1");
  assert.equal(b.city, "Rønne");
  assert.equal(b.website, "https://example.com/");
  assert.equal(b.status, "unknown");
  assert.equal(b.sourceUrl, "https://www.openstreetmap.org/way/9");
  assert.equal(
    toBusiness({ type: "node", id: 0, tags: { name: "No coordinates" } }),
    null,
  );
});
test("bounds reject query injection, inverted bounds and requests outside Denmark", () => {
  assert.deepEqual(parseBounds("55,12,56,13"), [55, 12, 56, 13]);
  assert.equal(parseBounds(null), null);
  for (const b of [
    "55,12,56,13);out;",
    "1,1,2,2",
    "56,12,55,13",
    "NaN,12,56,13",
    "55,12,56,13,1",
  ])
    assert.throws(() => parseBounds(b));
});
test("website analysis rejects local addresses, credentials, non-HTTP schemes and ports", () => {
  for (const u of [
    "http://localhost",
    "http://127.0.0.1",
    "http://[::1]",
    "http://a.internal",
    "https://user:pass@example.com",
    "javascript:alert(1)",
    "https://example.com:8443",
    null,
  ])
    assert.equal(publicWebsite(u), null);
  assert.equal(
    publicWebsite("https://example.com/path"),
    "https://example.com/path",
  );
  assert.equal(safeWebsite("javascript:alert(1)"), "");
});
test("scores derive from actual returned categories and cannot claim an unrun analysis", () => {
  assert.throws(() => summarizeLighthouse({}, "https://example.com"));
  const result = summarizeLighthouse(
    {
      categories: {
        performance: { score: 0.6 },
        seo: { score: 0.9 },
        accessibility: { score: 0.9 },
      },
      finalUrl: "https://example.com",
    },
    "https://example.com",
  );
  assert.equal(result.score, 80);
  assert.equal(result.status, "improve");
  assert.match(result.findings[0], /60/);
  const good = summarizeLighthouse(
    {
      categories: {
        performance: { score: 0.99 },
        seo: { score: 1 },
        accessibility: { score: 0.98 },
      },
    },
    "https://example.com",
  );
  assert.equal(good.status, "good");
  const http = summarizeLighthouse(
    { categories: { performance: { score: 1 } } },
    "http://example.com",
  );
  assert.equal(http.status, "improve");
  assert.equal(http.seo, null);
});
test("CSV preserves quotes and Danish text and neutralizes spreadsheet formulas", () => {
  const business = toBusiness({
    type: "node",
    id: 2,
    lat: 55,
    lon: 12,
    tags: { name: '=HYPERLINK("bad")' },
  })!;
  const leads: Lead[] = [
    {
      business,
      notes: 'Dansk; "café"\nNy linje',
      contact_status: "Ikke kontaktet",
      created_at: "2026-10-20",
    },
  ];
  const result = csv(leads);
  assert.ok(result.startsWith("\uFEFF"));
  assert.ok(result.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(result.includes('Dansk; ""café""\nNy linje'));
});
