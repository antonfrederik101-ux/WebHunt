import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { BusinessCatalog } from "../lib/business-catalog";

test("cached pilot reimport accepts official source IDs without fetching and retains the database after an invalid newer cache", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "webhunt-reimport-"));
  try {
    mkdirSync(path.join(directory, "scripts"));
    mkdirSync(path.join(directory, ".data/imports"), { recursive: true });
    mkdirSync(path.join(directory, "data/overture"), { recursive: true });
    cpSync("lib", path.join(directory, "lib"), { recursive: true });
    cpSync("package.json", path.join(directory, "package.json"));
    for (const file of [
      "reimport-pilot.mjs",
      "import-places.ts",
      "verify-pilot.ts",
    ])
      cpSync(path.join("scripts", file), path.join(directory, "scripts", file));
    symlinkSync(
      path.resolve("node_modules"),
      path.join(directory, "node_modules"),
      "junction",
    );
    const record = {
      id: "isolated-reimport-fixture",
      geometry: { type: "Point", coordinates: [11.8743, 54.7691] },
      properties: {
        names: { primary: "Isoleret testpost — ikke produktionsdata" },
        basic_category: "bakery",
        sources: [
          {
            dataset: "Overture",
            property: "/properties/taxonomy",
            record_id: "processing-fixture",
          },
          { dataset: "metaPlaces", property: "", record_id: "test-source" },
          {
            dataset: "msftPlaces",
            property: "/properties/brand",
            record_id: "test-brand",
          },
        ],
      },
    };
    const input = { type: "FeatureCollection", features: [record] };
    const rawFile = path.join(
      directory,
      ".data/imports/nykoebing-falster-2026-09-23.1.geojson",
    );
    writeFileSync(rawFile, JSON.stringify(input));
    const database = path.join(directory, ".data/controlled.sqlite");
    const run = () =>
      spawnSync(process.execPath, ["scripts/reimport-pilot.mjs"], {
        cwd: directory,
        encoding: "utf8",
        env: {
          ...process.env,
          WEBHUNT_CATALOG_PATH: database,
          WEBHUNT_CATALOG_BACKEND: "sqlite",
        },
      });
    const result = run();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /Der hentes ingen nye data/);
    assert.match(result.stdout, /"count":1/);
    const seed = JSON.parse(
      readFileSync(
        path.join(directory, "data/overture/nykoebing-falster.json"),
        "utf8",
      ),
    );
    assert.deepEqual(seed.records[0].sourceDatasets, [
      "Overture",
      "metaPlaces",
      "msftPlaces",
    ]);
    const invalid = structuredClone(input);
    invalid.features[0].properties.sources[0].dataset =
      "UnknownRestrictedProvider";
    writeFileSync(
      path.join(
        directory,
        ".data/imports/nykoebing-falster-2026-09-23.2.geojson",
      ),
      JSON.stringify(invalid),
    );
    const failed = run();
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /unknown_license/);
    writeFileSync(
      path.join(
        directory,
        ".data/imports/nykoebing-falster-2026-09-23.3.geojson",
      ),
      "null",
    );
    const malformed = run();
    assert.equal(malformed.status, 1);
    assert.match(malformed.stderr, /FeatureCollection/);
    assert.doesNotMatch(malformed.stderr, /Cannot read properties/);
    assert.deepEqual(
      JSON.parse(
        readFileSync(
          path.join(directory, "data/overture/nykoebing-falster.json"),
          "utf8",
        ),
      ),
      seed,
    );
    const db = new BusinessCatalog(database);
    try {
      assert.equal(db.get(null).businesses.length, 1);
    } finally {
      db.close();
    }
    assert.equal(readFileSync(rawFile, "utf8"), JSON.stringify(input));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
