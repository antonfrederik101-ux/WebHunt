import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { BusinessCatalog } from "../lib/business-catalog";
import { prepareSnapshot, PILOT } from "../lib/overture";
import { recordHash, defaultIdentity } from "../lib/verification-store";
import { presentBusiness } from "../lib/business-status";
import { summarizeLighthouse } from "../lib/analysis";
import { matchCvr, normalizeCvr, type CvrRecord } from "../lib/registry";
import {
  duplicateOf,
  verifyBusiness,
  verificationReport,
} from "../lib/verification-runner";
import { inspectWebsite } from "../lib/website-inspector";
import { publicIp, robotsAllows } from "../lib/safe-http";
import { overtureObservation } from "../lib/public-source-check";
import { adminAuthorized } from "../lib/admin-auth";
import type { Business } from "../lib/types";
import type { Verification, WebsiteEvidence } from "../lib/verification-types";
const at = () => new Date().toISOString();
const feature = (id = "one") => ({
  id,
  geometry: { type: "Point", coordinates: [11.8743, 54.7691] },
  properties: {
    names: { primary: "Kontrolleret testfixture" },
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
const make = (id = "one") =>
  prepareSnapshot([feature(id)], PILOT, "2026-09-23.1").records[0];
const lighthouse = (performance = 1) => ({
  categories: {
    performance: { score: performance },
    accessibility: { score: 1 },
    seo: { score: 1 },
    "best-practices": { score: 1 },
  },
  audits: { viewport: { score: 1 }, "http-status-code": { score: 1 } },
  finalUrl: "https://example.com/",
});
const proof = (
  b: Business,
  state: "active" | "closed" | "uncertain" | "missing_data" = "active",
): Verification => ({
  recordHash: recordHash(b),
  identity: {
    state,
    source: "Kontrolleret testkilde (fixture)",
    checkedAt: at(),
    reason: "Navn og adresse er entydigt kontrolleret i testkilden.",
  },
  websiteSearch: {
    complete: true,
    checkedAt: at(),
    sources: ["Fixture"],
    reason: "Registrerede hjemmesidefelter er gennemgået.",
  },
});
const cvr = (b: Business): CvrRecord => ({
  cvr: "12345678",
  names: [b.name],
  currentName: b.name,
  address: b.address,
  postcode: b.postcode,
  state: "active",
  websites: [],
  sourceUrl: "https://datacvr.virk.dk/enhed/virksomhed/12345678",
  observedAt: at(),
});
const noSite = { ...make(), website: "" };
test("active without a registered website becomes red only after source-backed identity and website search; unknown/closed never becomes red", () => {
  assert.equal(presentBusiness(noSite, "missing").status, "unknown");
  assert.equal(
    presentBusiness({ ...noSite, verification: proof(noSite) }).status,
    "missing",
  );
  assert.equal(
    presentBusiness({
      ...noSite,
      verification: { ...proof(noSite), websiteSearch: undefined },
    }).status,
    "unknown",
  );
  for (const state of ["closed", "uncertain", "missing_data"] as const)
    assert.equal(
      presentBusiness(
        { ...noSite, verification: proof(noSite, state) },
        "missing",
      ).status,
      "unknown",
    );
});
test("active bad/good websites require complete real measurements; a 200, personal rating or incomplete measurements never supplies a score", () => {
  const b = make(),
    v = proof(b);
  assert.equal(
    presentBusiness({ ...b, verification: v }, "good").status,
    "unknown",
  );
  for (const [performance, status] of [
    [0.3, "improve"],
    [1, "good"],
  ] as const) {
    const a = summarizeLighthouse(lighthouse(performance), b.website);
    const website: WebsiteEvidence = {
      state: "checked",
      url: b.website,
      checkedAt: at(),
      httpStatus: 200,
      reason: "Mesuré",
      issues: [],
      analysis: a,
    };
    assert.equal(
      presentBusiness({ ...b, verification: { ...v, website } }).status,
      status,
    );
  }
  const partial = summarizeLighthouse(
    { categories: { performance: { score: 1 } } },
    b.website,
  );
  assert.equal(partial.score, null);
  assert.equal(partial.status, "unknown");
  assert.equal(
    presentBusiness({ ...b, verification: v }, "good", partial).status,
    "unknown",
  );
});
test("changed URL, stale analysis and stale activity invalidate colors without deleting past evidence", () => {
  const b = make(),
    a = summarizeLighthouse(lighthouse(), b.website);
  const v = proof(b);
  v.website = {
    state: "checked",
    url: b.website,
    checkedAt: at(),
    reason: "Fixture",
    issues: [],
    analysis: a,
  };
  a.checkedAt = new Date(Date.now() - 8 * 86400_000).toISOString();
  assert.equal(presentBusiness({ ...b, verification: v }).status, "unknown");
  a.checkedAt = at();
  a.url = "https://different.example/";
  assert.equal(presentBusiness({ ...b, verification: v }).status, "unknown");
  a.url = b.website;
  v.identity.checkedAt = new Date(Date.now() - 31 * 86400_000).toISOString();
  assert.equal(presentBusiness({ ...b, verification: v }).status, "unknown");
  assert.equal(a.score, 100);
});
test("closed records disappear from public spatial API but survive restart with original source JSON and append-only history", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "webhunt-verification-")),
    file = path.join(dir, "db.sqlite");
  let db = new BusinessCatalog(file);
  try {
    const b = make();
    db.import(prepareSnapshot([feature()], PILOT, "2026-09-23.1"));
    const original = db.db.prepare("SELECT record FROM catalog_places").get();
    db.verification.save(b, proof(b));
    db.verification.save(b, proof(b, "closed"));
    assert.equal(db.get(null).businesses.length, 0);
    assert.deepEqual(
      db.db.prepare("SELECT record FROM catalog_places").get(),
      original,
    );
    db.close();
    db = new BusinessCatalog(file);
    assert.equal(db.get(null).businesses.length, 0);
    assert.equal(db.verification.history(b.id).length, 2);
    assert.equal(db.verification.get(b)?.identity.state, "closed");
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("source refresh archives retired records instead of deleting companies or their history", () => {
  const db = new BusinessCatalog(":memory:");
  try {
    const b = make();
    db.import(prepareSnapshot([feature()], PILOT, "2026-09-23.1"));
    db.verification.save(b, proof(b, "closed"));
    db.import(prepareSnapshot([feature("replacement")], PILOT, "2026-09-23.2"));
    assert.equal(
      db.db.prepare("SELECT count(*) AS n FROM catalog_places").get()!.n,
      2,
    );
    assert.equal(db.verification.history(b.id).length, 1);
    assert.equal(db.get(null).businesses.length, 1);
    assert.ok(
      db.db
        .prepare("SELECT * FROM catalog_retired WHERE business_id=?")
        .get(b.id),
    );
  } finally {
    db.close();
  }
});
test("a changed source identity invalidates an old duplicate suppression instead of hiding a new legitimate place", () => {
  const db = new BusinessCatalog(":memory:");
  try {
    const first = prepareSnapshot(
      [feature("a"), feature("b")],
      PILOT,
      "2026-09-23.1",
    );
    db.import(first);
    const b = first.records[1];
    db.verification.save(b, { ...proof(b), duplicateOf: first.records[0].id });
    assert.equal(db.get(null).businesses.length, 1);
    const changed = feature("b");
    changed.properties.names.primary = "Anden identitet (testfixture)";
    db.import(prepareSnapshot([feature("a"), changed], PILOT, "2026-09-23.2"));
    const result = db.get(null);
    assert.equal(result.businesses.length, 2);
    const refreshed = result.businesses.find((x) => x.id === b.id)!;
    assert.equal(refreshed.verification?.identity.state, "uncertain");
    assert.equal(db.verification.history(b.id).length, 1);
  } finally {
    db.close();
  }
});
test("temporary website error leaves the company active and website unknown; repeated 404 needs independent observations at least 24 hours apart", async () => {
  const db = new BusinessCatalog(":memory:");
  try {
    const b = make();
    const registry = async () => [cvr(b)];
    const inspect = async () => ({
      state: "failed" as const,
      url: b.website,
      checkedAt: at(),
      reason: "Timeout",
      issues: [],
    });
    let v = await verifyBusiness(b, db.verification, [b], {
      registry,
      inspect,
    });
    assert.equal(v.identity.state, "active");
    assert.equal(presentBusiness({ ...b, verification: v }).status, "unknown");
    const first = {
      ...v,
      website: {
        state: "failed" as const,
        url: b.website,
        checkedAt: new Date(Date.now() - 2 * 86400_000).toISOString(),
        httpStatus: 404,
        reason: "HTTP 404",
        issues: [],
      },
    };
    db.verification.save(b, first);
    v = await verifyBusiness(b, db.verification, [b], {
      registry,
      inspect: async () => ({ ...first.website, checkedAt: at() }),
    });
    assert.equal(v.identity.state, "active");
    assert.equal(presentBusiness({ ...b, verification: v }).status, "improve");
    assert.equal(v.website?.analysis, undefined);
  } finally {
    db.close();
  }
});
test("CVR no-match, ambiguity, changed name and moved address are not silently merged or assumed closed", () => {
  const b = make();
  assert.equal(matchCvr(b, []).state, "uncertain");
  assert.equal(
    matchCvr(b, [cvr(b), { ...cvr(b), cvr: "87654321" }]).state,
    "uncertain",
  );
  const withCvr = { ...b, cvr: "12345678" };
  let p = matchCvr(withCvr, [
    { ...cvr(b), address: "Nyvej 4", currentName: "Nyt navn" },
  ]);
  assert.equal(p.state, "uncertain");
  assert.equal(p.addressMatch, "changed");
  assert.equal(p.nameChanged, true);
  p = matchCvr(withCvr, [{ ...cvr(b), currentName: "Nyt navn" }]);
  assert.equal(p.state, "active");
  assert.equal(p.nameChanged, true);
  assert.equal(matchCvr(b, [{ ...cvr(b), state: "closed" }]).state, "closed");
});
test("strict CVR normalization rejects unknown formats and candidate truncation; NORMAL is not invented activity", () => {
  assert.throws(() => normalizeCvr(null), /ukendt format/);
  assert.throws(
    () => normalizeCvr({ hits: { hits: [], total: { value: 11 } } }),
    /mange CVR/,
  );
  const raw = {
    hits: {
      hits: [
        {
          _source: {
            Vrvirksomhed: {
              cvrNummer: 12345678,
              navne: [{ navn: "Fixture" }],
              virksomhedMetadata: {
                sammensatStatus: "NORMAL",
                nyesteBeliggenhedsadresse: {
                  vejnavn: "Testvej",
                  husnummerFra: 1,
                  postnummer: 4800,
                },
              },
            },
          },
        },
      ],
    },
  };
  const r = normalizeCvr(raw);
  assert.equal(r[0].state, "uncertain");
  assert.equal(r[0].address, "Testvej 1");
});
test("duplicates require identity, address, near coordinates and a shared stable contact; branches/social-only coincidences remain separate", () => {
  const a = make("a"),
    b = make("b");
  assert.equal(duplicateOf(b, [a, b]), a.id);
  assert.equal(duplicateOf(a, [a, b]), undefined);
  assert.equal(duplicateOf({ ...b, address: "Testvej 2" }, [a, b]), undefined);
  const x = { ...a, website: "https://facebook.com/a" },
    y = { ...b, website: "https://facebook.com/b" };
  assert.equal(duplicateOf(y, [x, y]), undefined);
});
test("batch leases survive interruption, prevent double claims and reject late workers", () => {
  const db = new BusinessCatalog(":memory:");
  try {
    const records = [make("a"), make("b")],
      s = db.verification;
    const job = s.createJob("pilot", records);
    assert.equal(s.createJob("pilot", records), job);
    const t = s.claim(job)!;
    const second = s.claim(job)!;
    assert.notEqual(t.id, second.id);
    assert.equal(s.claim(job), null);
    db.db
      .prepare(
        "UPDATE verification_tasks SET lease_until=0 WHERE job_id=? AND business_id=?",
      )
      .run(job, t.id);
    const reclaimed = s.claim(job)!;
    assert.equal(reclaimed.id, t.id);
    assert.notEqual(reclaimed.token, t.token);
    assert.throws(() => s.finish(job, t.id, t.token, "done", {}), /lease/);
    s.finish(job, t.id, reclaimed.token, "done", {});
    assert.ok(
      s.jobProgress(job).some((r) => r.state === "done" && r.count === 1),
    );
  } finally {
    db.close();
  }
});
test("robots policy, private/reserved IPs, mapped IPv6 and unsafe redirects are blocked before website fetching", async () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "100.64.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "2001:db8::1",
    "2002:7f00:1::",
  ])
    assert.equal(publicIp(ip), false, ip);
  assert.equal(publicIp("1.1.1.1"), true);
  assert.equal(publicIp("2606:4700:4700::1111"), true);
  assert.equal(
    robotsAllows(
      "User-agent: *\nDisallow: /secret\nAllow: /secret/open",
      "/secret/open",
    ),
    true,
  );
  assert.equal(
    robotsAllows("User-agent: *\nDisallow: /*.pdf$", "/file.pdf"),
    false,
  );
  const db = new BusinessCatalog(":memory:");
  try {
    let lh = 0,
      privateFetch = 0;
    const result = await inspectWebsite(
      "https://example.com/",
      db.verification,
      {
        resolve: async (u) => {
          if (u.includes("internal")) throw new Error("Private destination");
        },
        get: async (u) => {
          if (u.includes("internal")) privateFetch++;
          return {
            status: u.endsWith("/robots.txt") ? 200 : 302,
            headers: { location: "https://internal.example/" },
            body: "",
            url: u,
          };
        },
        lighthouse: async () => {
          lh++;
          return lighthouse();
        },
        wait: async () => {
          db.db
            .prepare(
              "DELETE FROM verification_cache WHERE cache_key LIKE 'origin-next:%'",
            )
            .run();
        },
      },
    );
    assert.equal(privateFetch, 0);
    assert.equal(lh, 0);
    assert.equal(result.state, "failed");
    assert.match(result.reason, /Private/);
  } finally {
    db.close();
  }
});
test("robots disallow stops both direct crawling and PageSpeed; successful measurements cache without repeat requests", async () => {
  const db = new BusinessCatalog(":memory:");
  try {
    let get = 0,
      lh = 0;
    const deps = {
      resolve: async () => {},
      get: async (u: string) => {
        get++;
        return {
          status: 200,
          headers: { "content-type": "text/html" },
          body: u.endsWith("robots.txt")
            ? "User-agent: *\nDisallow: /"
            : "<html><h1>Fixture</h1></html>",
          url: u,
        };
      },
      lighthouse: async () => {
        lh++;
        return lighthouse();
      },
      wait: async () => {
        db.db
          .prepare(
            "DELETE FROM verification_cache WHERE cache_key LIKE 'origin-next:%'",
          )
          .run();
      },
    };
    const blocked = await inspectWebsite(
      "https://blocked.example/",
      db.verification,
      deps,
    );
    assert.equal(blocked.state, "blocked");
    assert.equal(get, 1);
    assert.equal(lh, 0);
    deps.get = async (u: string) => {
      get++;
      return {
        status: 200,
        headers: { "content-type": "text/html" },
        body: "",
        url: u,
      };
    };
    const good = await inspectWebsite(
      "https://example.com/",
      db.verification,
      deps,
    );
    assert.equal(good.analysis?.score, 100);
    const previous = get;
    await inspectWebsite("https://example.com/", db.verification, deps);
    assert.equal(get, previous);
    assert.equal(lh, 1);
  } finally {
    db.close();
  }
});
test("provider retry instructions defer jobs and no second request is made before the deadline", async () => {
  const db = new BusinessCatalog(":memory:");
  try {
    let requests = 0;
    const deps = {
      resolve: async () => {},
      get: async (u: string) => {
        requests++;
        return {
          status: 429,
          headers: { "retry-after": "180" },
          body: "",
          url: u,
        };
      },
    };
    const v = await inspectWebsite(
      "https://example.com/",
      db.verification,
      deps,
    );
    assert.equal(v.state, "deferred");
    assert.ok(Date.parse(v.retryAt!) > Date.now() + 170000);
    await inspectWebsite("https://example.com/", db.verification, deps);
    assert.equal(requests, 1);
  } finally {
    db.close();
  }
});
test("lack of registry access never becomes active; a still-valid manual public-source review and a documented closure survive upstream failure", async () => {
  const db = new BusinessCatalog(":memory:");
  try {
    const b = { ...make(), website: "" };
    const registry = async () => {
      throw new Error("Source unavailable");
    };
    let v = await verifyBusiness(b, db.verification, [b], { registry });
    assert.equal(v.identity.state, "uncertain");
    assert.equal(presentBusiness({ ...b, verification: v }).status, "unknown");
    const active = proof(b);
    active.identity.source = "Manuelt kildecheck af administrator";
    db.verification.save(b, active);
    v = await verifyBusiness(b, db.verification, [b], { registry });
    assert.equal(v.identity.state, "active");
    assert.equal(presentBusiness({ ...b, verification: v }).status, "missing");
    db.verification.save(b, proof(b, "closed"));
    v = await verifyBusiness(b, db.verification, [b], { registry });
    assert.equal(v.identity.state, "closed");
    assert.equal(v.website, undefined);
  } finally {
    db.close();
  }
});
test("Overture open is never activity proof; only licensed same-ID recent explicit closure is usable and conflicts stay uncertain", async () => {
  const b = make(),
    f = feature();
  assert.equal(overtureObservation(b, f, "2026-09-23.1"), undefined);
  const closed = {
    ...f,
    properties: { ...f.properties, operating_status: "permanently_closed" },
  };
  const e = overtureObservation(b, closed, "2026-09-23.1");
  assert.equal(e?.state, "closed");
  assert.equal(
    overtureObservation(
      { ...b, sourceId: "different" },
      closed,
      "2026-09-23.1",
    ),
    undefined,
  );
  const db = new BusinessCatalog(":memory:");
  try {
    const v = await verifyBusiness(
      { ...b, website: "" },
      db.verification,
      [b],
      { registry: async () => [cvr(b)], publicEvidence: e },
    );
    assert.equal(v.identity.state, "uncertain");
  } finally {
    db.close();
  }
});
test("report uses actual checks, distinguishes attempted from confirmed and never counts unknown registration gaps as red", () => {
  const db = new BusinessCatalog(":memory:");
  try {
    const a = { ...make("a"), website: "" },
      b = { ...make("b"), website: "" },
      c = make("c");
    db.verification.save(a, { ...proof(a), lastAttemptAt: at() });
    db.verification.save(c, { ...proof(c, "closed"), lastAttemptAt: at() });
    const r = verificationReport(db.verification, [a, b, c]);
    assert.equal(r.total, 3);
    assert.equal(r.investigated, 2);
    assert.equal(r.active, 1);
    assert.equal(r.closed, 1);
    assert.equal(r.uncertain, 1);
    assert.equal(r.red, 1);
    assert.equal(r.legacyRedCandidates, 2);
    assert.equal(r.green, 0);
  } finally {
    db.close();
  }
});
test("admin evidence endpoints deny missing, incorrect and malformed Unicode keys", () => {
  const old = process.env.WEBHUNT_ADMIN_TOKEN;
  process.env.WEBHUNT_ADMIN_TOKEN = "a".repeat(64);
  try {
    assert.equal(adminAuthorized(new Request("http://localhost")), false);
    assert.equal(
      adminAuthorized(
        new Request("http://localhost", {
          headers: { authorization: "Bearer " + "é".repeat(64) },
        }),
      ),
      false,
    );
    assert.equal(
      adminAuthorized(
        new Request("http://localhost", {
          headers: { authorization: "Bearer " + "a".repeat(64) },
        }),
      ),
      true,
    );
  } finally {
    if (old === undefined) delete process.env.WEBHUNT_ADMIN_TOKEN;
    else process.env.WEBHUNT_ADMIN_TOKEN = old;
  }
});

test("domain rate reservations are shared across workers and cannot be claimed concurrently", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "webhunt-origin-budget-")),
    file = path.join(dir, "catalog.sqlite");
  const a = new BusinessCatalog(file),
    b = new BusinessCatalog(file);
  try {
    assert.equal(
      a.verification.reserveOrigin("https://example.com", Date.now() + 10000),
      true,
    );
    assert.equal(
      b.verification.reserveOrigin("https://example.com", Date.now() + 10000),
      false,
    );
    a.db
      .prepare("UPDATE verification_cache SET expires_at=0 WHERE cache_key=?")
      .run("origin-next:https://example.com");
    assert.equal(
      b.verification.reserveOrigin("https://example.com", Date.now() + 1000),
      true,
    );
  } finally {
    a.close();
    b.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
