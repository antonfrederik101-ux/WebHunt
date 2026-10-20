import { cachedPilotObservations } from "../lib/public-source-check";
import { loadEnvConfig } from "@next/env";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { BusinessCatalog } from "../lib/business-catalog";
import { recordHash } from "../lib/verification-store";
import { verifyBusiness, verificationReport } from "../lib/verification-runner";
import { normalizeCvr } from "../lib/registry";
import type { Business } from "../lib/types";
loadEnvConfig(process.cwd());
const args = process.argv.slice(2),
  has = (x: string) => args.includes(x);
const arg = (x: string) => {
  const i = args.indexOf(x);
  return i >= 0 ? args[i + 1] : undefined;
};
async function main() {
  if (process.env.WEBHUNT_CATALOG_BACKEND === "supabase")
    throw new Error(
      "Denne kontrolworker kræver den eksisterende SQLite-katalogdatabase. Supabase-kataloget må ikke kontrolleres via en tom lokal database.",
    );
  const filename =
    process.env.WEBHUNT_CATALOG_PATH ||
    path.join(process.cwd(), ".data/businesses.sqlite");
  if (!existsSync(filename))
    throw new Error(
      "Den rigtige virksomhedsdatabase findes ikke i dette miljø. Ingen kontroller eller optællinger er opdigtet. Kør kommandoen i dit eksisterende Codespace.",
    );
  const db = new BusinessCatalog(filename),
    store = db.verification;
  try {
    const records = db.db
      .prepare(
        "SELECT p.record FROM catalog_places p JOIN catalog_membership m ON m.business_id=p.business_id WHERE m.region_id=? ORDER BY p.business_id",
      )
      .all("nykoebing-falster")
      .map((r) => JSON.parse(String(r.record)) as Business);
    if (!records.length)
      throw new Error(
        "Ingen importerede pilotvirksomheder fundet. Eksisterende poster er ikke ændret.",
      );
    const region = db.db
      .prepare("SELECT release FROM catalog_regions WHERE id=?")
      .get("nykoebing-falster");
    const observations = cachedPilotObservations(
      records,
      String(region?.release || ""),
    );
    const limit = Number(arg("--limit") || records.length);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100000)
      throw new Error("Ugyldig batchgrænse.");
    const file = arg("--cvr-file");
    let registry: ReturnType<typeof normalizeCvr> | undefined;
    if (file) {
      const raw = JSON.parse(readFileSync(file, "utf8"));
      const observedAt = arg("--cvr-observed-at") || raw.exportedAt;
      const observed = Date.parse(observedAt || "");
      if (
        !Number.isFinite(observed) ||
        observed > Date.now() ||
        Date.now() - observed > 30 * 86400_000
      )
        throw new Error(
          "CVR-udtræk kræver en udtrykkelig kildekontroldato inden for 30 dage: exportedAt eller --cvr-observed-at.",
        );
      registry = normalizeCvr(raw, observedAt, Infinity);
    }
    const job = has("--report-only")
      ? null
      : store.createJob("nykoebing-falster", records, has("--force"));
    if (job) {
      console.log(
        `Kontroljob ${job}. Pilotdatabase: ${records.length} poster (kortets 600 er en sidegrænse).`,
      );
      for (let i = 0; i < limit; i++) {
        const task = store.claim(job);
        if (!task) break;
        const b = records.find((x) => x.id === task.id);
        if (!b || task.hash !== recordHash(b)) {
          store.finish(job, task.id, task.token, "failed", {
            reason: "Kildeposten er ændret. Opret et nyt job.",
          });
          continue;
        }
        try {
          const v = await verifyBusiness(b, store, records, {
            publicEvidence: observations.get(b.id),
            ...(registry
              ? {
                  registry: async () => registry,
                  cvrSource:
                    "CVR-udtræk leveret af administrator (ikke live API)",
                }
              : {}),
          });
          db.db.exec("BEGIN IMMEDIATE");
          try {
            store.finish(
              job,
              b.id,
              task.token,
              v.website?.state === "deferred" ? "deferred" : "done",
              { activity: v.identity.state, website: v.website?.state },
              v.website?.retryAt ? Date.parse(v.website.retryAt) : undefined,
            );
            store.save(b, v);
            db.db.exec("COMMIT");
          } catch (e) {
            db.db.exec("ROLLBACK");
            throw e;
          }
        } catch (e) {
          store.finish(job, task.id, task.token, "failed", {
            reason: (e as Error).message,
          });
        }
        console.log(
          JSON.stringify({
            progress: store.jobProgress(job),
            ...(i === 0 || (i + 1) % 25 === 0
              ? verificationReport(store, records)
              : {}),
          }),
        );
      }
    }
    const report = {
      generatedAt: new Date().toISOString(),
      region: "Nykøbing Falster",
      job,
      counts: verificationReport(store, records),
      progress: job ? store.jobProgress(job) : [],
      scope:
        "CVR-status vedrører juridisk enhed, ikke garanteret fysisk drift. Ukendt eller utilgængelig kilde giver usikker status, aldrig opdigtede aktive virksomheder.",
    };
    mkdirSync(".data/reports", { recursive: true });
    writeFileSync(
      ".data/reports/pilot-verification.json",
      JSON.stringify(report, null, 2),
      { mode: 0o600 },
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    db.close();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
