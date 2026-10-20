import { loadEnvConfig } from "@next/env";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as pause } from "node:timers/promises";
import path from "node:path";
import { pinnedGet, resolvePublic, robotsAllows } from "../lib/safe-http";
import { fetchRobots } from "../lib/robots-fetch";
import type { Verification } from "../lib/verification-types";

loadEnvConfig(process.cwd());
async function main() {
  if (process.env.WEBHUNT_CATALOG_BACKEND === "supabase")
    throw new Error("Diagnosen kræver pilotens eksisterende SQLite-database.");
  const db = new DatabaseSync(
    process.env.WEBHUNT_CATALOG_PATH ||
      path.join(process.cwd(), ".data/businesses.sqlite"),
    { readOnly: true },
  );
  let checks: Verification[];
  try {
    checks = db
      .prepare(
        "SELECT result FROM business_verification ORDER BY checked_at DESC",
      )
      .all()
      .map((r) => JSON.parse(String(r.result)) as Verification)
      .filter(
        (v) =>
          v.website?.state === "blocked" &&
          /robots\.txt/.test(v.website.reason),
      );
  } finally {
    db.close();
  }
  const seen = new Set<string>();
  let checked = 0;
  console.log(
    "Skrivebeskyttet diagnose: højst tre domæner, kun robots.txt; ingen PageSpeed eller virksomhedssider.",
  );
  for (const v of checks) {
    const u = new URL(v.website!.url);
    if (seen.has(u.origin)) continue;
    seen.add(u.origin);
    const steps: { host: string; status: number }[] = [];
    try {
      const response = await fetchRobots(
        u.origin,
        async (target, limit) => {
          await pause(1100);
          const r = await pinnedGet(target, limit);
          steps.push({ host: new URL(target).hostname, status: r.status });
          return r;
        },
        resolvePublic,
      );
      console.log(
        JSON.stringify({
          host: u.hostname,
          steps,
          allowed:
            response.status === 200
              ? robotsAllows(response.body, u.pathname + u.search)
              : [404, 410].includes(response.status)
                ? true
                : null,
        }),
      );
    } catch (e) {
      console.log(
        JSON.stringify({
          host: u.hostname,
          steps,
          error: (e as Error).message,
        }),
      );
    }
    if (++checked === 3) break;
  }
  if (!checked) console.log("Ingen gemte robots.txt-stop fundet.");
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
