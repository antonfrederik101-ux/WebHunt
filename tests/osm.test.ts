import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { OsmCache } from "../lib/osm-cache";
import {
  OsmService,
  queryFor,
  retryDelay,
  SourceUnavailable,
} from "../lib/osm-service";
const bounds = [55.67, 12.56, 55.68, 12.58];
const elements = [
  {
    type: "node",
    id: 42,
    lat: 55.675,
    lon: 12.57,
    tags: { name: "Controlled OSM fixture", shop: "bakery" },
  },
];
const json = (body: unknown, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
async function withCache(run: (cache: OsmCache) => Promise<void>) {
  const directory = await mkdtemp(path.join(tmpdir(), "webhunt-osm-"));
  try {
    await run(new OsmCache(directory));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
test("OSM results survive service restart and an upstream outage without changing unknown status", async () =>
  withCache(async (cache) => {
    let requests = 0;
    const request: typeof fetch = async () => {
      requests++;
      return json({ elements });
    };
    const first = await new OsmService(cache, request).get(bounds);
    assert.equal(first.businesses.length, 1);
    assert.equal(first.businesses[0].status, "unknown");
    assert.equal(first.cached, false);
    const second = await new OsmService(cache, async () => {
      throw new Error("Network unavailable");
    }).get(bounds);
    assert.equal(second.cached, true);
    assert.equal(second.stale, false);
    assert.deepEqual(second.businesses, first.businesses);
    assert.equal(requests, 1);
  }));
test("overload fallback is sequential; Retry-After prevents repeated upstream requests", async () =>
  withCache(async (cache) => {
    const calls: string[] = [];
    const request: typeof fetch = async (input) => {
      calls.push(String(input));
      return json({ error: "at capacity" }, 429, { "Retry-After": "600" });
    };
    const service = new OsmService(cache, request);
    await assert.rejects(() => service.get(bounds), SourceUnavailable);
    assert.equal(calls.length, 2);
    await assert.rejects(
      () => service.get(bounds),
      (e) => e instanceof SourceUnavailable && e.retryAfter >= 599,
    );
    assert.equal(calls.length, 2);
    const circuits = await cache.readCooldowns();
    assert.ok(
      Object.values(circuits).every((c) => c.until - Date.now() > 599000),
    );
  }));
test("old OSM snapshots stay dated and are labeled stale if refresh fails", async () =>
  withCache(async (cache) => {
    const first = await new OsmService(cache, async () =>
      json({ elements }),
    ).get(bounds);
    const snapshot = (await cache.read(queryFor(bounds).key))!;
    snapshot.fetchedAt = new Date(Date.now() - 2 * 86400000).toISOString();
    await cache.write(snapshot);
    const result = await new OsmService(cache, async () => json({}, 503)).get(
      bounds,
    );
    assert.equal(result.stale, true);
    assert.match(result.warning!, /tidligere hentede/);
    assert.equal(result.fetchedAt, snapshot.fetchedAt);
    assert.deepEqual(result.businesses, first.businesses);
  }));
test("new view can use only geographically matching cached records and declares partial coverage", async () =>
  withCache(async (cache) => {
    await new OsmService(cache, async () => json({ elements })).get(bounds);
    const result = await new OsmService(cache, async () => json({}, 503)).get([
      55.665, 12.555, 55.676, 12.571,
    ]);
    assert.equal(result.partial, true);
    assert.equal(result.stale, true);
    assert.equal(result.businesses.length, 1);
    await assert.rejects(
      () =>
        new OsmService(cache, async () => json({}, 503)).get([
          56, 10, 56.01, 10.01,
        ]),
      SourceUnavailable,
    );
  }));
test("simultaneous requests share one refresh and completed empty results are cached", async () =>
  withCache(async (cache) => {
    let calls = 0;
    const service = new OsmService(cache, async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 20));
      return json({ elements: [] });
    });
    const [a, b] = await Promise.all([
      service.get(bounds),
      service.get(bounds),
    ]);
    assert.deepEqual(a.businesses, []);
    assert.deepEqual(b.businesses, []);
    assert.equal(calls, 1);
    const next = await new OsmService(cache, async () => {
      throw Error("must not request");
    }).get(bounds);
    assert.equal(next.cached, true);
    assert.deepEqual(next.businesses, []);
  }));
test("incomplete upstream responses are never cached as successful empty datasets", async () =>
  withCache(async (cache) => {
    const service = new OsmService(cache, async () =>
      json({ remark: "timed out", elements: [] }),
    );
    await assert.rejects(() => service.get(bounds), SourceUnavailable);
    assert.equal(await cache.read(queryFor(bounds).key), null);
  }));
test("backoff honors HTTP dates and queries cap each overview city independently", () => {
  const now = Date.now();
  assert.ok(retryDelay(new Date(now + 600000).toUTCString(), 1, now) >= 599000);
  assert.ok(retryDelay(null, 4, now) > retryDelay(null, 1, now));
  const q = queryFor(null);
  assert.equal((q.query.match(/out center tags 60;/g) || []).length, 9);
  assert.ok(!q.query.includes('[~"^'));
  assert.equal(
    queryFor([55.6701, 12.5601, 55.6799, 12.5799]).key,
    queryFor(bounds).key,
  );
});
