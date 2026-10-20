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
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { BusinessCatalog } from "../lib/business-catalog";
import { PILOT, prepareSnapshot } from "../lib/overture";
test("real validation CLI resumes an interrupted pilot job, checks all records instead of the map page, reports real outcomes and preserves source data", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "webhunt-validate-cli-"));
  try {
    mkdirSync(path.join(dir, "scripts"));
    cpSync("lib", path.join(dir, "lib"), { recursive: true });
    cpSync("package.json", path.join(dir, "package.json"));
    cpSync(
      "scripts/validate-pilot.ts",
      path.join(dir, "scripts/validate-pilot.ts"),
    );
    symlinkSync(
      path.resolve("node_modules"),
      path.join(dir, "node_modules"),
      "junction",
    );
    const features = Array.from({ length: 607 }, (_, i) => ({
      id: String(i),
      geometry: { type: "Point", coordinates: [11.8743, 54.7691] },
      properties: {
        names: { primary: `Fixture ${i}` },
        basic_category: "hair_salon",
        addresses: [
          {
            country: "DK",
            freeform: "Testvej 1",
            postcode: "4800",
            locality: "Nykøbing Falster",
          },
        ],
        sources: [{ dataset: "metaPlaces" }],
      },
    }));
    const file = path.join(dir, "real-control.sqlite"),
      db = new BusinessCatalog(file);
    db.import(prepareSnapshot(features, PILOT, "2026-09-23.1"));
    const original = db.db
      .prepare("SELECT record FROM catalog_places ORDER BY business_id")
      .all();
    db.close();
    const exportFile = path.join(dir, "controlled-cvr-fixture.json");
    writeFileSync(
      exportFile,
      JSON.stringify({
        exportedAt: new Date().toISOString(),
        hits: {
          hits: features.map((f, i) => ({
            _source: {
              Vrvirksomhed: {
                cvrNummer: String(10000000 + i),
                navne: [{ navn: f.properties.names.primary }],
                virksomhedMetadata: {
                  sammensatStatus: "AKTIV",
                  nyesteNavn: { navn: f.properties.names.primary },
                  nyesteBeliggenhedsadresse: {
                    vejnavn: "Testvej",
                    husnummerFra: 1,
                    postnummer: 4800,
                  },
                },
              },
            },
          })),
        },
      }),
    );
    const run = (args: string[]) =>
      spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "scripts/validate-pilot.ts",
          "--cvr-file",
          exportFile,
          ...args,
        ],
        {
          cwd: dir,
          encoding: "utf8",
          env: {
            ...process.env,
            WEBHUNT_CATALOG_PATH: file,
            WEBHUNT_CATALOG_BACKEND: "sqlite",
          },
        },
      );
    let r = run(["--limit", "5"]);
    assert.equal(r.status, 0, r.stderr);
    let report = JSON.parse(
      readFileSync(
        path.join(dir, ".data/reports/pilot-verification.json"),
        "utf8",
      ),
    );
    assert.equal(report.counts.investigated, 5);
    assert.equal(report.counts.active, 5);
    assert.equal(report.counts.red, 5);
    const job = report.job;
    r = run([]);
    assert.equal(r.status, 0, r.stderr);
    report = JSON.parse(
      readFileSync(
        path.join(dir, ".data/reports/pilot-verification.json"),
        "utf8",
      ),
    );
    assert.equal(report.job, job);
    assert.equal(report.counts.total, 607);
    assert.equal(report.counts.investigated, 607);
    assert.equal(report.counts.active, 607);
    assert.equal(report.counts.red, 607);
    assert.equal(report.counts.closed, 0);
    assert.equal(report.counts.green, 0);
    const reopened = new BusinessCatalog(file);
    try {
      assert.deepEqual(
        reopened.db
          .prepare("SELECT record FROM catalog_places ORDER BY business_id")
          .all(),
        original,
      );
      assert.equal(
        reopened.db
          .prepare("SELECT count(*) AS n FROM verification_history")
          .get()!.n,
        607,
      );
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
