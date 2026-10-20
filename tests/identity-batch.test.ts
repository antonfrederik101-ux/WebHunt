import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { BusinessCatalog } from "../lib/business-catalog";
import { indexCvr, matchCvr, type CvrRecord } from "../lib/registry";
import { defaultIdentity, recordHash } from "../lib/verification-store";
import { verifyBusiness } from "../lib/verification-runner";
import { PILOT, prepareSnapshot } from "../lib/overture";

const at = () => new Date().toISOString();
const feature = (i: number) => ({
  id: "fixture-" + i,
  geometry: { type: "Point", coordinates: [11.8743, 54.7691] },
  properties: {
    names: { primary: "Testfixture " + i },
    basic_category: "hair_salon",
    addresses: [
      {
        country: "DK",
        freeform: "Testvej 1",
        postcode: "4800",
        locality: "Nykøbing Falster",
      },
    ],
    websites: ["https://example.com/"],
    sources: [{ dataset: "metaPlaces" }],
  },
});
const base = () =>
  prepareSnapshot([feature(0)], PILOT, "2026-09-23.1").records[0];
const record = (i = 0): CvrRecord => ({
  cvr: String(10000000 + i),
  names: ["Testfixture " + i],
  currentName: "Testfixture " + i,
  address: "Testvej 1",
  postcode: "4800",
  state: "active",
  websites: [],
  sourceUrl: "https://datacvr.virk.dk/enhed/virksomhed/" + (10000000 + i),
  observedAt: at(),
});
test("indexed matching handles 20,000 synthetic identities, preserves ambiguous records and rejects changed branch addresses", () => {
  const registry = Array.from({ length: 20000 }, (_, i) => record(i));
  registry[0].names.push("TESTFIXTURE 0");
  const lookup = indexCvr(registry),
    b = base();
  for (let i = 0; i < 20000; i++) {
    const place = { ...b, name: "Testfixture " + i };
    const candidates = lookup(place);
    assert.equal(candidates.length, 1);
    assert.equal(matchCvr(place, candidates).cvr, String(10000000 + i));
  }
  assert.equal(
    lookup(b).length,
    1,
    "repeated aliases must not duplicate a candidate",
  );
  const ambiguous = indexCvr([
    registry[0],
    { ...registry[0], cvr: "99999999" },
  ]);
  assert.equal(matchCvr(b, ambiguous(b)).state, "uncertain");
  const moved = { ...b, cvr: registry[0].cvr, address: "Testvej 99" };
  assert.equal(matchCvr(moved, lookup(moved)).state, "uncertain");
  assert.equal(lookup({ ...b, name: "Unmatched" }).length, 0);
});
test("identity-only refresh preserves an existing website check, makes no scan and never reuses live cache instead of a new file", async () => {
  const db = new BusinessCatalog(":memory:"),
    b = base();
  const website = {
    state: "checked" as const,
    checkedAt: at(),
    url: b.website,
    reason: "Existing synthetic measurement",
    issues: [],
  };
  try {
    db.verification.save(b, {
      recordHash: recordHash(b),
      identity: defaultIdentity(b),
      website,
    });
    const key =
      "cvr-v1:" +
      createHash("sha256")
        .update(JSON.stringify([b.cvr || "", b.name, b.address, b.postcode]))
        .digest("hex");
    db.verification.putCache(key, [record()]);
    let scanCalls = 0,
      sourceCalls = 0;
    const first = await verifyBusiness(b, db.verification, [b], {
      identityOnly: true,
      registry: async () => {
        sourceCalls++;
        return [record()];
      },
      inspect: async () => {
        scanCalls++;
        throw new Error("must not scan");
      },
    });
    assert.equal(first.identity.state, "active");
    assert.deepEqual(first.website, website);
    db.verification.save(b, first);
    const second = await verifyBusiness(b, db.verification, [b], {
      identityOnly: true,
      registry: async () => {
        sourceCalls++;
        return [{ ...record(), state: "closed" }];
      },
      inspect: async () => {
        scanCalls++;
        throw new Error("must not scan");
      },
    });
    assert.equal(second.identity.state, "closed");
    assert.equal(sourceCalls, 2);
    assert.equal(scanCalls, 0);
    assert.equal(
      db.verification.cache<CvrRecord[]>(key)![0].state,
      "active",
      "file data must not overwrite the live lookup cache",
    );
  } finally {
    db.close();
  }
});
test("bulk identity CLI previews read-only, resumes dated sources, preserves raw data and website evidence and reapplies a new snapshot", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "webhunt-identity-batch-"));
  try {
    mkdirSync(path.join(dir, "scripts"));
    cpSync("lib", path.join(dir, "lib"), { recursive: true });
    cpSync("package.json", path.join(dir, "package.json"));
    cpSync(
      "scripts/verify-identities.ts",
      path.join(dir, "scripts/verify-identities.ts"),
    );
    symlinkSync(
      path.resolve("node_modules"),
      path.join(dir, "node_modules"),
      "junction",
    );
    const file = path.join(dir, "pilot.sqlite"),
      sourceFile = path.join(dir, "cvr-fixture.json");
    const snapshot = prepareSnapshot(
      Array.from({ length: 12 }, (_, i) => feature(i)),
      PILOT,
      "2026-09-23.1",
    );
    const db = new BusinessCatalog(file);
    db.import(snapshot);
    const b = snapshot.records[0];
    const website = {
      state: "checked" as const,
      checkedAt: at(),
      url: b.website,
      reason: "Prior measurement fixture",
      issues: [],
    };
    db.verification.save(b, {
      recordHash: recordHash(b),
      identity: defaultIdentity(b),
      website,
    });
    const original = db.db
      .prepare("SELECT record FROM catalog_places ORDER BY business_id")
      .all();
    db.close();
    const data = {
      exportedAt: at(),
      hits: {
        hits: Array.from({ length: 12 }, (_, i) => ({
          _source: {
            Vrvirksomhed: {
              cvrNummer: String(10000000 + i),
              navne: [{ navn: "Testfixture " + i }],
              virksomhedMetadata: {
                sammensatStatus: i < 8 ? "AKTIV" : i < 10 ? "OPHØRT" : "NORMAL",
                nyesteNavn: { navn: "Testfixture " + i },
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
    };
    writeFileSync(sourceFile, JSON.stringify(data));
    const run = (extra: string[]) =>
      spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "scripts/verify-identities.ts",
          "--input",
          sourceFile,
          ...extra,
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
    const before = readFileSync(file);
    let result = run([]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(readFileSync(file), before);
    assert.equal(existsSync(path.join(dir, ".data/reports")), false);
    const preview = JSON.parse(result.stdout.trim());
    assert.deepEqual(preview.candidateMatches, {
      active: 8,
      closed: 2,
      uncertain: 2,
      missing_data: 0,
    });
    result = run(["--apply", "--limit", "5"]);
    assert.equal(result.status, 0, result.stderr);
    const reportFile = path.join(
      dir,
      ".data/reports/identity-verification.json",
    );
    let report = JSON.parse(readFileSync(reportFile, "utf8"));
    assert.equal(report.processed, 5);
    const job = report.job;
    result = run(["--apply"]);
    assert.equal(result.status, 0, result.stderr);
    report = JSON.parse(readFileSync(reportFile, "utf8"));
    assert.equal(report.job, job);
    assert.equal(report.processed, 7);
    assert.equal(report.counts.active, 8);
    assert.equal(report.counts.closed, 2);
    assert.equal(report.counts.uncertain, 2);
    result = run(["--apply"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(readFileSync(reportFile, "utf8")).processed, 0);
    const after = new BusinessCatalog(file);
    assert.deepEqual(
      after.db
        .prepare("SELECT record FROM catalog_places ORDER BY business_id")
        .all(),
      original,
    );
    assert.deepEqual(after.verification.get(b)!.website, website);
    assert.equal(
      after.db.prepare("SELECT count(*) AS n FROM verification_history").get()!
        .n,
      13,
    );
    assert.equal(
      after.verification.get(b)!.identity.sourceSnapshot,
      report.snapshot,
    );
    after.close();
    data.hits.hits[0]._source.Vrvirksomhed.virksomhedMetadata.sammensatStatus =
      "OPHØRT";
    writeFileSync(sourceFile, JSON.stringify(data));
    result = run(["--apply"]);
    assert.equal(result.status, 0, result.stderr);
    report = JSON.parse(readFileSync(reportFile, "utf8"));
    assert.notEqual(report.job, job);
    assert.equal(report.counts.closed, 3);
    assert.equal(report.counts.active, 7);
    assert.equal(report.processed, 12);
    const protectedBytes = readFileSync(file);
    data.exportedAt = new Date(Date.now() - 31 * 86400_000).toISOString();
    writeFileSync(sourceFile, JSON.stringify(data));
    result = run(["--apply"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /kontroldato/);
    assert.deepEqual(readFileSync(file), protectedBytes);
    // Same registry snapshot must still check newly imported map places.
    data.exportedAt = at();
    writeFileSync(sourceFile, JSON.stringify(data));
    result = run(["--apply"]);
    assert.equal(result.status, 0, result.stderr);
    const priorJob = JSON.parse(readFileSync(reportFile, "utf8")).job;
    const expanded = new BusinessCatalog(file);
    expanded.import(
      prepareSnapshot(
        Array.from({ length: 13 }, (_, i) => feature(i)),
        PILOT,
        "2026-09-23.1",
      ),
    );
    expanded.close();
    result = run(["--apply"]);
    assert.equal(result.status, 0, result.stderr);
    report = JSON.parse(readFileSync(reportFile, "utf8"));
    assert.notEqual(report.job, priorJob);
    assert.equal(report.processed, 13);
    assert.equal(report.counts.total, 13);
    assert.equal(
      report.counts.uncertain,
      3,
      "no registry match is not evidence of closure",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
