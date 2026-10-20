import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { Business } from "./types";
import type { Verification, IdentityEvidence } from "./verification-types";
import { CHECK_FRESH_MS } from "./verification-types";
export function recordHash(b: Business) {
  // Imported identity/links only; presentation colors and last check never change the fingerprint.
  return createHash("sha256")
    .update(
      JSON.stringify([
        b.id,
        b.name,
        b.address,
        b.postcode,
        b.city,
        b.cvr || "",
        b.website,
        b.socialProfiles || [],
        b.sourceRelease || "",
        b.operatingStatus || "",
      ]),
    )
    .digest("hex");
}
export function defaultIdentity(b: Business): IdentityEvidence {
  const missing =
    !b.name?.trim() ||
    !b.postcode?.trim() ||
    !b.address?.trim() ||
    b.address === "Adresse ikke registreret";
  return {
    state: missing ? "missing_data" : "uncertain",
    source: "Importoplysninger",
    checkedAt: "",
    reason: missing
      ? "Navn og adresse er ikke tilstrækkelige til et sikkert match."
      : "Aktivitet er ikke bekræftet. En kortregistrering eller fungerende hjemmeside er ikke dokumentation for drift.",
  };
}
export class VerificationStore {
  constructor(readonly db: DatabaseSync) {
    db.exec(`
 CREATE TABLE IF NOT EXISTS business_verification(business_id TEXT PRIMARY KEY, record_hash TEXT NOT NULL, result TEXT NOT NULL, checked_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS verification_history(id INTEGER PRIMARY KEY, business_id TEXT NOT NULL, record_hash TEXT NOT NULL, checked_at TEXT NOT NULL, result TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS verification_history_business ON verification_history(business_id,checked_at);
 CREATE TABLE IF NOT EXISTS verification_jobs(id TEXT PRIMARY KEY,region_id TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS verification_tasks(job_id TEXT NOT NULL REFERENCES verification_jobs(id),business_id TEXT NOT NULL,record_hash TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',lease_token TEXT,lease_until INTEGER,attempts INTEGER NOT NULL DEFAULT 0,result TEXT,PRIMARY KEY(job_id,business_id));
 CREATE INDEX IF NOT EXISTS verification_queue ON verification_tasks(job_id,state,lease_until);
 CREATE TABLE IF NOT EXISTS verification_cache(cache_key TEXT PRIMARY KEY,expires_at INTEGER NOT NULL,result TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS catalog_retired(business_id TEXT PRIMARY KEY,retired_at TEXT NOT NULL,reason TEXT NOT NULL);
 `);
  }
  get(b: Business): Verification | undefined {
    const row = this.db
      .prepare(
        "SELECT result,record_hash FROM business_verification WHERE business_id=?",
      )
      .get(b.id);
    if (!row) return;
    const v = JSON.parse(String(row.result)) as Verification;
    if (row.record_hash !== recordHash(b)) {
      if (v.identity.state === "closed")
        return {
          ...v,
          recordHash: recordHash(b),
          lastAttemptAt: undefined,
          identity: {
            ...v.identity,
            reason:
              v.identity.reason +
              " Kildedata er ændret; den tidligere lukningsregistrering bevares, indtil en ny kontrol afklarer genåbning.",
          },
        };
      // New source data invalidates an old match; retain it in append-only history.
      return {
        recordHash: recordHash(b),
        identity: {
          ...defaultIdentity(b),
          reason:
            "Kildedata er ændret siden kontrollen. Nyt match er påkrævet.",
        },
      };
    }
    if (
      v.identity.state === "active" &&
      Date.now() - Date.parse(v.identity.checkedAt) >= CHECK_FRESH_MS
    )
      return {
        ...v,
        identity: {
          ...v.identity,
          state: "uncertain",
          reason:
            "Aktivitetskontrollen er over 30 dage gammel og skal gentages.",
        },
      };
    return v;
  }
  save(b: Business, v: Verification) {
    const hash = recordHash(b);
    if (v.recordHash !== hash)
      throw new Error(
        "Virksomheden er ændret under kontrollen. Resultatet er ikke anvendt.",
      );
    const at = new Date().toISOString();
    this.db.exec("SAVEPOINT verification_save");
    try {
      this.db
        .prepare(
          "INSERT INTO verification_history(business_id,record_hash,checked_at,result) VALUES(?,?,?,?)",
        )
        .run(b.id, hash, at, JSON.stringify(v));
      this.db
        .prepare(
          "INSERT INTO business_verification VALUES(?,?,?,?) ON CONFLICT(business_id) DO UPDATE SET record_hash=excluded.record_hash,result=excluded.result,checked_at=excluded.checked_at",
        )
        .run(b.id, hash, JSON.stringify(v), at);
      this.db.exec("RELEASE verification_save");
    } catch (e) {
      this.db.exec("ROLLBACK TO verification_save");
      this.db.exec("RELEASE verification_save");
      throw e;
    }
  }
  history(id: string) {
    return this.db
      .prepare(
        "SELECT checked_at,result FROM verification_history WHERE business_id=? ORDER BY id DESC LIMIT 50",
      )
      .all(id)
      .map((r) => ({
        checkedAt: r.checked_at,
        result: JSON.parse(String(r.result)),
      }));
  }
  cache<T>(key: string): T | undefined {
    const r = this.db
      .prepare(
        "SELECT result FROM verification_cache WHERE cache_key=? AND expires_at>?",
      )
      .get(key, Date.now());
    return r ? JSON.parse(String(r.result)) : undefined;
  }
  putCache(key: string, result: unknown, ttl = 86400_000) {
    this.db
      .prepare(
        "INSERT INTO verification_cache VALUES(?,?,?) ON CONFLICT(cache_key) DO UPDATE SET expires_at=excluded.expires_at,result=excluded.result",
      )
      .run(key, Date.now() + ttl, JSON.stringify(result));
  }
  reserveOrigin(origin: string, until: number) {
    return !!this.db
      .prepare(
        `INSERT INTO verification_cache VALUES(?,?,?)
      ON CONFLICT(cache_key) DO UPDATE SET expires_at=excluded.expires_at,result=excluded.result
      WHERE verification_cache.expires_at<=? RETURNING cache_key`,
      )
      .get("origin-next:" + origin, until, JSON.stringify(until), Date.now());
  }
  createJob(region: string, records: Business[], force = false) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const ongoing = this.db
        .prepare(
          "SELECT j.id FROM verification_jobs j WHERE region_id=? AND EXISTS(SELECT 1 FROM verification_tasks t WHERE t.job_id=j.id AND t.state IN ('pending','running','deferred')) ORDER BY created_at LIMIT 1",
        )
        .get(region);
      if (ongoing) {
        this.db.exec("COMMIT");
        return String(ongoing.id);
      }
      const id = randomUUID();
      this.db
        .prepare("INSERT INTO verification_jobs VALUES(?,?,?)")
        .run(id, region, new Date().toISOString());
      const add = this.db.prepare(
        "INSERT INTO verification_tasks(job_id,business_id,record_hash) VALUES(?,?,?)",
      );
      for (const b of records) {
        const existing = this.get(b);
        if (
          force ||
          !existing?.lastAttemptAt ||
          Date.now() - Date.parse(existing.lastAttemptAt) > 86400_000
        )
          add.run(id, b.id, recordHash(b));
      }
      this.db.exec("COMMIT");
      return id;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  claim(job: string) {
    const token = randomUUID(),
      now = Date.now();
    const r = this.db
      .prepare(
        `UPDATE verification_tasks SET state='running',lease_token=?,lease_until=?,attempts=attempts+1 WHERE rowid=(SELECT rowid FROM verification_tasks WHERE job_id=? AND (state='pending' OR (state IN ('running','deferred') AND lease_until<?)) ORDER BY business_id LIMIT 1) RETURNING *`,
      )
      .get(token, now + 600000, job, now);
    return r
      ? { id: String(r.business_id), hash: String(r.record_hash), token }
      : null;
  }
  finish(
    job: string,
    id: string,
    token: string,
    state: "done" | "failed" | "deferred",
    result: unknown,
    retryAt = Date.now() + 86400_000,
  ) {
    const r = this.db
      .prepare(
        "UPDATE verification_tasks SET state=?,result=?,lease_until=?,lease_token=NULL WHERE job_id=? AND business_id=? AND lease_token=?",
      )
      .run(state, JSON.stringify(result), retryAt, job, id, token);
    if (r.changes !== 1) throw new Error("Kontroljobbet har mistet sin lease.");
  }
  jobProgress(id: string) {
    return this.db
      .prepare(
        "SELECT state,count(*) AS count FROM verification_tasks WHERE job_id=? GROUP BY state",
      )
      .all(id);
  }
}
