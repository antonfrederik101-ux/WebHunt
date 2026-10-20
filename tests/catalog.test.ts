import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { BusinessCatalog, CatalogNotReady } from "../lib/business-catalog";
import {
  prepareSnapshot,
  PILOT,
  normalizePlace,
  type PlaceFeature,
} from "../lib/overture";
import { csv } from "../lib/businesses";
// Synthetic records stay in tests. No test record is bundled as business data.
const feature = (id = "controlled-fixture"): PlaceFeature => ({
  id,
  geometry: { type: "Point", coordinates: [11.8743, 54.7691] },
  properties: {
    names: { primary: "Kontrolleret testvirksomhed" },
    basic_category: "bakery",
    taxonomy: { primary: "bakery", hierarchy: ["food_and_drink", "bakery"] },
    addresses: [
      {
        freeform: "Testvej 1",
        locality: "Nykøbing Falster",
        postcode: "4800",
        country: "DK",
      },
    ],
    websites: ["https://example.com"],
    sources: [{ dataset: "Microsoft", record_id: "fixture-source" }],
  },
});
const release = "2026-09-23.0";
test("Overture current and legacy categories preserve real IDs/provenance and never infer absent websites", () => {
  const f = feature();
  f.properties!.websites = [];
  const b = normalizePlace(f, PILOT, release, "2026-10-20T12:00:00Z")!;
  assert.equal(b.status, "unknown");
  assert.equal(b.website, "");
  assert.equal(b.sourceId, f.id);
  assert.deepEqual(b.licenses, ["CDLA-Permissive-2.0"]);
  assert.equal(b.sourceDetails[0].record_id, "fixture-source");
  delete f.properties!.basic_category;
  delete f.properties!.taxonomy;
  f.properties!.categories = { primary: "bakery" };
  assert.equal(
    normalizePlace(f, PILOT, release, b.importedAt)?.category,
    "Bager",
  );
});
test("rejects closed, foreign, outside-region, unknown-license and non-business records", () => {
  for (const modify of [
    (f: PlaceFeature) => {
      f.properties!.operating_status = "permanently_closed";
    },
    (f: PlaceFeature) => {
      f.properties!.addresses![0].country = "SE";
    },
    (f: PlaceFeature) => {
      f.geometry!.coordinates = [12.56, 55.67];
    },
    (f: PlaceFeature) => {
      f.properties!.sources = [{ dataset: "Unknown restricted provider" }];
    },
    (f: PlaceFeature) => {
      f.properties!.taxonomy!.hierarchy = ["education", "school"];
    },
  ]) {
    const f = feature();
    modify(f);
    assert.equal(
      normalizePlace(f, PILOT, release, new Date().toISOString()),
      null,
    );
  }
});
test("spatial database survives restart; reads need no external data source or cooldown", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "webhunt-catalog-"));
  const file = path.join(dir, "businesses.sqlite");
  try {
    const db = new BusinessCatalog(file);
    assert.throws(() => db.get(null), CatalogNotReady);
    db.import(prepareSnapshot([feature()], PILOT, release));
    db.close();
    const next = new BusinessCatalog(file);
    const hit = next.get([54.76, 11.86, 54.78, 11.89]);
    assert.equal(hit.businesses.length, 1);
    assert.equal(hit.partial, false);
    assert.equal("retryAfter" in hit, false);
    assert.equal(next.get([55.67, 12.55, 55.68, 12.58]).businesses.length, 0);
    assert.match(
      next.get([55.67, 12.55, 55.68, 12.58]).warning!,
      /endnu ikke importeret/,
    );
    next.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("imports deduplicate stable IDs, remove retired places only after success, and roll back invalid batches", () => {
  const db = new BusinessCatalog(":memory:");
  try {
    const old = prepareSnapshot(
      [feature(), feature(), feature("old-branch")],
      PILOT,
      release,
    );
    db.import(old);
    assert.equal(db.get(null).businesses.length, 2);
    const bad = prepareSnapshot([feature("new-branch")], PILOT, "2026-10-21.0");
    bad.records.push({ ...bad.records[0], id: "invalid/record" });
    assert.throws(() => db.import(bad));
    assert.equal(db.get(null).businesses.length, 2);
    assert.throws(() => prepareSnapshot([], PILOT, "2026-10-21.0"));
    db.import(prepareSnapshot([feature("new-branch")], PILOT, "2026-10-21.0"));
    assert.equal(db.get(null).businesses[0].id, "overture/new-branch");
    assert.throws(() => db.import(old));
  } finally {
    db.close();
  }
});
test("imports retain other regions and old releases stay readable with dated warnings", () => {
  const db = new BusinessCatalog(":memory:");
  try {
    db.import(prepareSnapshot([feature()], PILOT, "2025-01-22.0"));
    const region = { ...PILOT, id: "second-region", name: "Andet testområde" };
    db.import(prepareSnapshot([feature("other-branch")], region, release));
    const result = db.get(null);
    assert.equal(result.regions.length, 2);
    assert.equal(result.businesses.length, 2);
    assert.equal(result.stale, true);
    assert.match(result.warning!, /90 dage/);
  } finally {
    db.close();
  }
});
test("CSV preserves Overture source and per-record licenses instead of falsely marking it ODbL", () => {
  const b = normalizePlace(
    feature(),
    PILOT,
    release,
    new Date().toISOString(),
  )!;
  const output = csv([
    {
      business: b,
      notes: "",
      contact_status: "Ikke kontaktet",
      created_at: new Date().toISOString(),
    },
  ]);
  assert.match(output, /Overture Maps/);
  assert.match(output, /CDLA-Permissive-2.0/);
  assert.doesNotMatch(output, /ODbL/);
});

test("official metaPlaces and msftPlaces dataset IDs preserve provenance and map to documented provider licenses", () => {
  const f = feature();
  f.properties!.sources = [
    { dataset: "metaPlaces", record_id: "meta-source-fixture", property: "" },
    {
      dataset: "msftPlaces",
      record_id: "msft-source-fixture",
      property: "/properties/brand",
    },
  ];
  const snapshot = prepareSnapshot([f], PILOT, "2026-09-23.1");
  assert.equal(snapshot.records.length, 1);
  assert.equal(snapshot.rejected, 0);
  const b = snapshot.records[0];
  assert.deepEqual(b.sourceDatasets, ["metaPlaces", "msftPlaces"]);
  assert.deepEqual(b.sourceDetails, f.properties!.sources);
  assert.deepEqual(b.licenses, ["CDLA-Permissive-2.0"]);
  assert.equal(b.status, "unknown");
});
test("source alias support still rejects undocumented and restricted dataset IDs with an actionable report", () => {
  for (const dataset of [
    "metaPlacesUnverified",
    "msftPlacesExperimental",
    "Overture",
    "Foursquare",
  ]) {
    const f = feature();
    f.properties!.sources = [{ dataset }];
    assert.throws(
      () => prepareSnapshot([f], PILOT, "2026-09-23.1"),
      (error: Error) => {
        assert.match(error.message, /Tidligere data er bevaret/);
        assert.match(error.message, /"unknown_license":1/);
        assert.ok(error.message.includes(dataset));
        return true;
      },
    );
  }
});

test("Overture processing provenance keeps the contributing provider licenses and every source entry", () => {
  const f = feature();
  f.properties!.sources = [
    {
      dataset: "Overture",
      property: "/properties/taxonomy",
      record_id: "processing-fixture",
    },
    { dataset: "metaPlaces", property: "", record_id: "original-fixture" },
  ];
  const snapshot = prepareSnapshot([f], PILOT, "2026-09-23.1");
  assert.equal(snapshot.records.length, 1);
  assert.deepEqual(snapshot.records[0].licenses, ["CDLA-Permissive-2.0"]);
  assert.deepEqual(snapshot.records[0].sourceDatasets, [
    "Overture",
    "metaPlaces",
  ]);
  assert.deepEqual(snapshot.records[0].sourceDetails, f.properties!.sources);
  f.properties!.sources[1].dataset = "AllThePlaces";
  assert.deepEqual(
    prepareSnapshot([f], PILOT, "2026-09-23.1").records[0].licenses,
    ["CC0-1.0"],
  );
});
test("Overture does not hide unknown or restricted contributors, and unsupported declared licenses remain rejected", () => {
  for (const source of [
    { dataset: "Foursquare" },
    { dataset: "UnknownRestrictedProvider" },
    { dataset: "Overture", license: "Unknown-License" },
    { dataset: "metaPlaces", license: "Apache-2.0" },
  ]) {
    const f = feature();
    f.properties!.sources = [
      { dataset: "Overture" },
      { dataset: "metaPlaces" },
      source,
    ];
    assert.throws(
      () => prepareSnapshot([f], PILOT, "2026-09-23.1"),
      /unknown_license/,
    );
  }
});
test("explicit supported publisher licenses and the documented provider field preserve provenance", () => {
  const f = feature();
  f.properties!.sources = [
    { dataset: "Overture", license: "CDLA-Permissive-2.0" },
  ];
  assert.deepEqual(
    prepareSnapshot([f], PILOT, "2026-09-23.1").records[0].licenses,
    ["CDLA-Permissive-2.0"],
  );
  f.properties!.sources = [
    {
      provider: "Meta",
      resource: "places",
      version: "2026-09",
      license: "CDLA-Permissive-2.0",
    },
    { dataset: "Overture" },
  ];
  const b = prepareSnapshot([f], PILOT, "2026-09-23.1").records[0];
  assert.deepEqual(b.sourceDetails, f.properties!.sources);
  assert.deepEqual(b.sourceDatasets, ["Meta", "Overture"]);
});
