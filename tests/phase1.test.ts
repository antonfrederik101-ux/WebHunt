import { test } from "node:test";
import assert from "node:assert/strict";
import { BusinessCatalog, getCatalog } from "../lib/business-catalog";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { prepareSnapshot, PILOT, type PlaceFeature } from "../lib/overture";
import { websiteDetails } from "../lib/websites";
import { presentBusiness, statusEvidence } from "../lib/business-status";
import { compareReleases } from "../lib/releases";
import { parseCatalogQuery } from "../lib/catalog-query";

function feature(id: string, name = id): PlaceFeature {
  return {
    id,
    geometry: { type: "Point", coordinates: [11.8743, 54.7691] },
    properties: {
      names: { primary: name },
      basic_category: "hair_salon",
      addresses: [
        {
          country: "DK",
          locality: "Nykøbing Falster",
          postcode: "4800",
          freeform: "Testvej 1",
        },
      ],
      websites: ["https://example.com"],
      sources: [{ dataset: "metaPlaces" }, { dataset: "Overture" }],
    },
  };
}
test("malformed JSON fields are reported without discarding good places or crashing", () => {
  const good = feature("good");
  good.properties!.addresses![0].freeform = { bad: "field" } as never;
  good.properties!.addresses![0].locality = 42 as never;
  const broken = feature("broken");
  broken.properties!.names = { primary: 42 as unknown as string };
  const sources = feature("sources");
  sources.properties!.sources = [null as never];
  const snapshot = prepareSnapshot(
    [null as never, broken, sources, good],
    PILOT,
    "2026-09-23.1",
  );
  assert.equal(snapshot.records.length, 1);
  assert.equal(snapshot.records[0].address, "Adresse ikke registreret");
  assert.equal(snapshot.records[0].city, "");
  assert.equal(snapshot.rejected, 3);
  assert.deepEqual(snapshot.rejectionReasons, {
    invalid_feature: 1,
    missing_identity: 1,
    missing_source: 1,
  });
});
test("normalization keeps social profiles and uses a later real website instead of Facebook", () => {
  const f = feature("site");
  f.properties!.websites = [
    "https://facebook.com/fixture",
    "not a website",
    "https://example.com/about",
  ];
  f.properties!.socials = ["https://instagram.com/fixture"];
  const snapshot = prepareSnapshot([f], PILOT, "2026-09-23.1");
  assert.equal(snapshot.records[0].website, "https://example.com/about");
  assert.deepEqual(snapshot.records[0].socialProfiles, [
    "https://facebook.com/fixture",
    "https://instagram.com/fixture",
  ]);
  assert.equal(
    websiteDetails([
      "javascript:alert(1)",
      "http://127.0.0.1",
      "https://not-facebook.com/",
    ]).website,
    "https://not-facebook.com/",
  );
});
test("unverified company colors stay gray without overwriting imported fields or saved personal choices", () => {
  const original = prepareSnapshot([feature("status")], PILOT, "2026-09-23.1")
    .records[0];
  const missing = { ...original, website: "" };
  const saved = "good" as const;
  assert.equal(presentBusiness(missing).status, "unknown");
  assert.equal(presentBusiness(missing, saved).status, "unknown");
  assert.equal(saved, "good");
  assert.equal(missing.status, "unknown");
  assert.equal(
    presentBusiness({ ...missing, website: "https://facebook.com/fixture" })
      .status,
    "unknown",
  );
  assert.equal(presentBusiness(presentBusiness(missing)).status, "unknown");
  assert.match(statusEvidence(missing).reason, /Aktivitet/);
});
test("numeric release ordering accepts patch 10 after 2 and prevents real downgrades", () => {
  assert.ok(compareReleases("2026-09-23.10", "2026-09-23.2") > 0);
  const db = new BusinessCatalog(":memory:");
  try {
    db.import(prepareSnapshot([feature("old")], PILOT, "2026-09-23.2"));
    db.import(prepareSnapshot([feature("new")], PILOT, "2026-09-23.10"));
    assert.equal(db.get(null).businesses[0].id, "overture/new");
    assert.throws(
      () => db.import(prepareSnapshot([feature("old")], PILOT, "2026-09-23.2")),
      /ældre/,
    );
  } finally {
    db.close();
  }
});
test("startup seed never replaces an existing user region, even when packaged data is newer", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "webhunt-seed-preserve-"));
  const cwd = process.cwd();
  const configuredPath = process.env.WEBHUNT_CATALOG_PATH;
  const shared = globalThis as typeof globalThis & {
    webhuntCatalog?: BusinessCatalog;
  };
  const previous = shared.webhuntCatalog;
  let active: BusinessCatalog | undefined;
  try {
    const filename = path.join(directory, "user.sqlite");
    const existing = prepareSnapshot(
      [feature("user-data")],
      PILOT,
      "2026-09-23.1",
    );
    const db = new BusinessCatalog(filename);
    db.import(existing);
    db.close();
    mkdirSync(path.join(directory, "data/overture"), { recursive: true });
    writeFileSync(
      path.join(directory, "data/overture/nykoebing-falster.json"),
      JSON.stringify(
        prepareSnapshot([feature("packaged-data")], PILOT, "2026-09-23.2"),
      ),
    );
    process.chdir(directory);
    process.env.WEBHUNT_CATALOG_PATH = filename;
    delete shared.webhuntCatalog;
    active = getCatalog();
    assert.deepEqual(active.get(null).businesses, existing.records);
  } finally {
    active?.close();
    shared.webhuntCatalog = previous;
    process.chdir(cwd);
    if (configuredPath === undefined) delete process.env.WEBHUNT_CATALOG_PATH;
    else process.env.WEBHUNT_CATALOG_PATH = configuredPath;
    rmSync(directory, { recursive: true, force: true });
  }
});
test("search covers results beyond the first page, filters categories and returns truthful counts without mutations", () => {
  const records = Array.from({ length: 707 }, (_, i) =>
    feature(
      String(i).padStart(4, "0"),
      i === 706 ? "Sidste Frisør ÆØÅ" : "Kontrolleret testpost",
    ),
  );
  const db = new BusinessCatalog(":memory:");
  try {
    db.import(prepareSnapshot(records, PILOT, "2026-09-23.1"));
    const before = db.db
      .prepare("select record from catalog_places order by business_id")
      .all();
    const page = db.get(null);
    assert.equal(page.businesses.length, 600);
    assert.equal(page.catalogTotal, 707);
    assert.equal(page.matchedTotal, 707);
    assert.equal(page.nextOffset, 600);
    const next = db.get(null, { offset: 600 });
    assert.equal(next.businesses.length, 107);
    assert.equal(next.nextOffset, null);
    const search = db.get(null, {
      query: "sidste frisør æøå",
      category: "Frisør",
    });
    assert.equal(search.businesses.length, 1);
    assert.equal(search.matchedTotal, 1);
    assert.equal(search.catalogTotal, 707);
    assert.deepEqual(search.categories, ["Frisør"]);
    assert.equal(db.get(null, { query: "' OR 1=1 --" }).matchedTotal, 0);
    assert.deepEqual(
      db.db
        .prepare("select record from catalog_places order by business_id")
        .all(),
      before,
    );
    assert.throws(() => parseCatalogQuery(new URLSearchParams("offset=-1")));
    assert.throws(() =>
      parseCatalogQuery(new URLSearchParams("q=" + "a".repeat(121))),
    );
  } finally {
    db.close();
  }
});
test("refreshing one region preserves unrelated existing rows and other regions", () => {
  const db = new BusinessCatalog(":memory:");
  try {
    db.import(prepareSnapshot([feature("original")], PILOT, "2026-09-23.1"));
    const extra = prepareSnapshot(
      [feature("unassociated")],
      PILOT,
      "2026-09-23.1",
    ).records[0];
    db.db
      .prepare(
        "insert into catalog_places(business_id,lat,lon,release,record) values(?,?,?,?,?)",
      )
      .run(
        extra.id,
        extra.lat,
        extra.lon,
        extra.sourceRelease,
        JSON.stringify(extra),
      );
    db.import(prepareSnapshot([feature("replacement")], PILOT, "2026-09-23.2"));
    assert.ok(
      db.db
        .prepare("select 1 from catalog_places where business_id=?")
        .get(extra.id),
    );
  } finally {
    db.close();
  }
});
