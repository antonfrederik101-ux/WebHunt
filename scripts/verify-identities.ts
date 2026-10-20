import { loadEnvConfig } from "@next/env";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  readFileSync,
  statSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { BusinessCatalog } from "../lib/business-catalog";
import { normalizeCvr, indexCvr, matchCvr } from "../lib/registry";
import { verifyBusiness, verificationReport } from "../lib/verification-runner";
import { recordHash } from "../lib/verification-store";
import { cachedPilotObservations } from "../lib/public-source-check";
import type { Business } from "../lib/types";

loadEnvConfig(process.cwd());
const source = "Administratorleveret CVR-udtræk (ikke live API)";
async function main() {
  const args = process.argv.slice(2);
  const values = new Map<string, string>();
  let apply = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--apply") {
      apply = true;
      continue;
    }
    if (
      !["--input", "--observed-at", "--region", "--limit"].includes(args[i]) ||
      !args[i + 1] ||
      args[i + 1].startsWith("--")
    )
      throw new Error(
        "Brug --input FIL [--observed-at DATO] [--region ID|all] [--limit ANTAL] [--apply]. Ingen data er ændret.",
      );
    if (values.has(args[i]))
      throw new Error("Et argument må kun angives én gang.");
    values.set(args[i], args[++i]);
  }
  const input = values.get("--input");
  if (!input)
    throw new Error(
      "Et lovligt indhentet CVR-udtræk kræves: --input FIL. Der er ikke valgt en liveleverandør eller foretaget hjemmesidekald.",
    );
  if (statSync(input).size > 100_000_000)
    throw new Error("CVR-udtrækket overstiger 100 MB.");
  const bytes = readFileSync(input);
  const raw = JSON.parse(bytes.toString("utf8"));
  const observedAt = values.get("--observed-at") || raw.exportedAt;
  const observed = Date.parse(observedAt || "");
  if (
    !Number.isFinite(observed) ||
    observed > Date.now() ||
    Date.now() - observed > 30 * 86400_000
  )
    throw new Error(
      "Udtrækket kræver en dokumenteret kontroldato inden for 30 dage via exportedAt eller --observed-at. Filens ændringsdato bruges ikke som bevis.",
    );
  const normalizedDate = new Date(observed).toISOString();
  const registry = normalizeCvr(raw, normalizedDate, Infinity);
  if (!registry.length)
    throw new Error(
      "Udtrækket indeholder ingen anvendelige CVR-poster. Ingen data er ændret.",
    );
  const lookup = indexCvr(registry);
  const snapshot = createHash("sha256")
    .update(bytes)
    .update(normalizedDate)
    .digest("hex");
  const region = values.get("--region") || "nykoebing-falster";
  if (!/^[a-z0-9-]{1,80}$/.test(region))
    throw new Error("Ugyldigt områdenavn.");
  const limit = Number(values.get("--limit") || 20000);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100000)
    throw new Error("Ugyldig batchgrænse.");
  if (process.env.WEBHUNT_CATALOG_BACKEND === "supabase")
    throw new Error(
      "Denne worker kræver den eksisterende SQLite-database. Supabase-data er ikke ændret.",
    );
  const filename =
    process.env.WEBHUNT_CATALOG_PATH ||
    path.join(process.cwd(), ".data/businesses.sqlite");
  if (!existsSync(filename))
    throw new Error(
      "Virksomhedsdatabasen findes ikke i dette miljø. Ingen tom erstatningsdatabase oprettes.",
    );
  // Preview opens only a read-only connection, including on installations without verification tables.
  const reader = new DatabaseSync(filename, { readOnly: true });
  let records: Business[];
  let observations: ReturnType<typeof cachedPilotObservations>;
  try {
    records = (
      region === "all"
        ? reader
            .prepare(
              "SELECT DISTINCT p.business_id,p.record FROM catalog_places p JOIN catalog_membership m ON m.business_id=p.business_id ORDER BY p.business_id",
            )
            .all()
        : reader
            .prepare(
              "SELECT p.record FROM catalog_places p JOIN catalog_membership m ON m.business_id=p.business_id WHERE m.region_id=? ORDER BY p.business_id",
            )
            .all(region)
    ).map((r) => JSON.parse(String(r.record)) as Business);
    if (!records.length)
      throw new Error(
        "Ingen importerede virksomheder i området. Der er ikke oprettet nye virksomheder.",
      );
    const pilot = reader
      .prepare(
        "SELECT release FROM catalog_regions WHERE id='nykoebing-falster'",
      )
      .get();
    observations = cachedPilotObservations(
      records,
      String(pilot?.release || ""),
    );
  } finally {
    reader.close();
  }
  const catalogSnapshot = createHash("sha256")
    .update(JSON.stringify(records.map((b) => [b.id, recordHash(b)])))
    .digest("hex");
  const preview = { active: 0, closed: 0, uncertain: 0, missing_data: 0 };
  for (const b of records) preview[matchCvr(b, lookup(b), source).state]++;
  console.log(
    JSON.stringify({
      mode: apply ? "apply" : "preview",
      region,
      source,
      snapshot,
      catalogSnapshot,
      observedAt: normalizedDate,
      sourceRecords: registry.length,
      existingPlaces: records.length,
      candidateMatches: preview,
      scope:
        "Kandidater i udtrækket, før konflikter med eksisterende evidens og dubletter. Ingen virksomhed tilføjes; juridisk aktivitet er ikke bevis for fysisk butiksdrift.",
    }),
  );
  if (!apply) return;
  const db = new BusinessCatalog(filename);
  try {
    const store = db.verification;
    // A new snapshot gets its own job even if previous website checks were done today.
    // Repeating this exact source/region resumes the old job, including when complete.
    const scope =
      "identity-v1:" + region + ":" + snapshot + ":" + catalogSnapshot;
    const existing = db.db
      .prepare(
        "SELECT id FROM verification_jobs WHERE region_id=? ORDER BY created_at DESC LIMIT 1",
      )
      .get(scope);
    const job = existing
      ? String(existing.id)
      : store.createJob(scope, records, true);
    const byId = new Map(records.map((b) => [b.id, b]));
    let processed = 0;
    for (; processed < limit; processed++) {
      const task = store.claim(job);
      if (!task) break;
      const b = byId.get(task.id);
      if (!b || recordHash(b) !== task.hash) {
        store.finish(job, task.id, task.token, "failed", {
          reason: "Kildepost ændret siden jobstart; ny kildeimport kræves.",
        });
        continue;
      }
      try {
        const v = await verifyBusiness(b, store, records, {
          identityOnly: true,
          registry: async (b) => lookup(b),
          cvrSource: source,
          publicEvidence: observations.get(b.id),
        });
        if (v.identity.source === source) v.identity.sourceSnapshot = snapshot;
        db.db.exec("BEGIN IMMEDIATE");
        try {
          store.finish(job, b.id, task.token, "done", {
            activity: v.identity.state,
            snapshot,
          });
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
      if ((processed + 1) % 100 === 0)
        console.log(
          JSON.stringify({
            processed: processed + 1,
            progress: store.jobProgress(job),
          }),
        );
    }
    const report = {
      generatedAt: new Date().toISOString(),
      mode: "identity-only",
      source,
      snapshot,
      catalogSnapshot,
      observedAt: normalizedDate,
      region,
      job,
      processed,
      progress: store.jobProgress(job),
      counts: verificationReport(store, records),
      scope:
        "CVR-status fra administratorleveret udtræk. Ingen live-CVR-, hjemmeside- eller PageSpeed-kald. Ukendte match forbliver usikre.",
    };
    mkdirSync(".data/reports", { recursive: true });
    writeFileSync(
      ".data/reports/identity-verification.json",
      JSON.stringify(report, null, 2),
      { mode: 0o600 },
    );
    console.log(JSON.stringify(report, null, 2));
    if (
      report.progress.some((p) => p.state === "failed" && Number(p.count) > 0)
    )
      process.exitCode = 1;
  } finally {
    db.close();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
