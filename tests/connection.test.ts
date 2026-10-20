import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSupabase } from "../lib/supabase-health";
import { migrateLocalData } from "../lib/local-data";
const config = {
  url: "https://test-project.supabase.co",
  key: "public-test-key",
};
test("connection diagnostics distinguish working Auth from missing database tables without returning secrets", async () => {
  let calls = 0;
  const mock: typeof fetch = async () => {
    calls++;
    return new Response(
      JSON.stringify(
        calls === 1 ? { external: { email: true } } : { code: "PGRST205" },
      ),
      { status: calls === 1 ? 200 : 404 },
    );
  };
  const result = await checkSupabase(mock, config);
  assert.equal(result.auth, "ok");
  assert.equal(result.database, "missing");
  assert.deepEqual(result.missingTables, ["leads", "business_statuses"]);
  assert.ok(!JSON.stringify(result).includes(config.key));
  assert.ok(!JSON.stringify(result).includes(config.url));
});
test("anonymous permission denial indicates protected tables, not a broken login connection", async () => {
  let calls = 0;
  const result = await checkSupabase(async () => {
    calls++;
    return new Response(JSON.stringify(calls === 1 ? {} : { code: "42501" }), {
      status: calls === 1 ? 200 : 401,
    });
  }, config);
  assert.equal(result.auth, "ok");
  assert.equal(result.database, "protected");
});
test("rename preserves existing local data and does not overwrite newer WebHunt data", () => {
  const map = new Map([
    ["webradar-guest-leads", "old leads"],
    ["webradar-guest-statuses", "old status"],
    ["webhunt-guest-statuses", "new status"],
  ]);
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
  migrateLocalData(storage);
  assert.equal(map.get("webhunt-guest-leads"), "old leads");
  assert.equal(map.get("webhunt-guest-statuses"), "new status");
  assert.equal(map.has("webradar-guest-leads"), false);
});
