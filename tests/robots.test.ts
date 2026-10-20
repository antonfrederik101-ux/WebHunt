import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchRobots } from "../lib/robots-fetch";
import { inspectWebsite } from "../lib/website-inspector";
import { BusinessCatalog } from "../lib/business-catalog";
import type { PageResponse } from "../lib/safe-http";

const response = (
  url: string,
  status: number,
  location?: string,
  body = "",
): PageResponse => ({
  url,
  status,
  headers: location ? { location } : {},
  body,
});
test("robots follows HTTP to HTTPS and www redirects, resolving every destination before requesting it", async () => {
  const resolved: string[] = [],
    requested: string[] = [];
  const result = await fetchRobots(
    "http://example.com",
    async (u) => {
      assert.ok(resolved.includes(u));
      requested.push(u);
      if (requested.length === 1)
        return response(u, 301, "https://example.com/robots.txt");
      if (requested.length === 2)
        return response(u, 308, "https://www.example.com/robots.txt");
      return response(u, 200, undefined, "User-agent: *\nDisallow: /private");
    },
    async (u) => {
      resolved.push(u);
    },
  );
  assert.equal(result.status, 200);
  assert.equal(requested.length, 3);
  assert.match(result.body, /Disallow/);
});
test("robots rejects loops, absent locations, downgrade, unsafe protocols, excess redirects and private DNS", async () => {
  const cases = [
    { location: "/robots.txt", pattern: /løkke/ },
    { location: undefined, pattern: /uden Location/ },
    { location: "http://example.com/robots.txt", pattern: /HTTPS til HTTP/ },
    { location: "file:///etc/passwd", pattern: /usikker/ },
    { location: "http://127.0.0.1/robots.txt", pattern: /usikker/ },
  ];
  for (const c of cases) {
    let requests = 0;
    await assert.rejects(
      fetchRobots(
        "https://example.com",
        async (u) => {
          requests++;
          return response(u, 302, c.location);
        },
        async () => {},
      ),
      c.pattern,
    );
    assert.equal(requests, 1);
  }
  let requests = 0;
  await assert.rejects(
    fetchRobots(
      "https://example.com",
      async (u) => {
        requests++;
        return response(u, 302, "/robots-" + requests);
      },
      async () => {},
    ),
    /fem redirects/,
  );
  assert.equal(requests, 6);
  requests = 0;
  await assert.rejects(
    fetchRobots(
      "https://example.com",
      async (u) => {
        requests++;
        return response(u, 302, "https://private.example/robots.txt");
      },
      async (u) => {
        if (u.includes("private.example"))
          throw new Error("Private destination");
      },
    ),
    /Private/,
  );
  assert.equal(requests, 1);
});
test("inspector enforces redirected robots rules and exposes precise upstream HTTP failures", async () => {
  for (const status of [200, 403, 500]) {
    const db = new BusinessCatalog(":memory:");
    let pageSpeedCalls = 0;
    const requests: string[] = [];
    try {
      const result = await inspectWebsite(
        "https://example.com/",
        db.verification,
        {
          resolve: async () => {},
          get: async (u) => {
            requests.push(u);
            return u.includes("www.example.com")
              ? response(u, status, undefined, "User-agent: *\nDisallow: /")
              : response(u, 301, "https://www.example.com/robots.txt");
          },
          lighthouse: async () => {
            pageSpeedCalls++;
            throw new Error("must not execute");
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
      assert.equal(result.state, "blocked");
      assert.match(
        result.reason,
        status === 200 ? /tillader ikke/ : new RegExp("HTTP " + status),
      );
      assert.equal(pageSpeedCalls, 0);
      assert.equal(requests.length, 2);
      assert.ok(requests.every((u) => u.endsWith("/robots.txt")));
    } finally {
      db.close();
    }
  }
});
