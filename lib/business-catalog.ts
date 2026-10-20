import { VerificationStore, recordHash } from "./verification-store";
import { compareReleases } from "./releases";
import { foldSearch, type CatalogQuery } from "./catalog-query";
import { presentBusiness } from "./business-status";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ImportSnapshot, CatalogBusiness, Region } from "./overture";

export type CatalogResult = {
  businesses: CatalogBusiness[];
  cached: boolean;
  stale: boolean;
  partial: boolean;
  overview: boolean;
  limited: boolean;
  source: string;
  fetchedAt: string;
  regions: {
    id: string;
    name: string;
    release: string;
    importedAt: string;
    bounds: number[];
  }[];
  warning?: string;
  catalogTotal?: number;
  matchedTotal?: number;
  categories?: string[];
  nextOffset?: number | null;
  revision?: string;
};
export class CatalogNotReady extends Error {}
export class BusinessCatalog {
  readonly db: DatabaseSync;
  readonly verification: VerificationStore;
  constructor(
    filename = process.env.WEBHUNT_CATALOG_PATH ||
      path.join(process.cwd(), ".data", "businesses.sqlite"),
  ) {
    if (filename !== ":memory:")
      mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.function("webhunt_release_compare", (a, b) =>
      compareReleases(String(a), String(b)),
    );
    this.db.function("webhunt_search", (raw) => {
      const b = presentBusiness(JSON.parse(String(raw)));
      return foldSearch(
        [b.name, b.address, b.city, b.postcode, b.category, b.cvr || ""].join(
          " ",
        ),
      );
    });
    this.db.function(
      "webhunt_category",
      (raw) => presentBusiness(JSON.parse(String(raw))).category,
    );
    this.db.function("webhunt_record_hash", (raw) =>
      recordHash(JSON.parse(String(raw))),
    );
    this.db.exec(`
      PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS catalog_regions (id TEXT PRIMARY KEY, name TEXT NOT NULL, bounds TEXT NOT NULL, release TEXT NOT NULL, imported_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS catalog_places (id INTEGER PRIMARY KEY, business_id TEXT NOT NULL UNIQUE, lat REAL NOT NULL, lon REAL NOT NULL, release TEXT NOT NULL, record TEXT NOT NULL);
      CREATE VIRTUAL TABLE IF NOT EXISTS catalog_spatial USING rtree(id, min_lon, max_lon, min_lat, max_lat);
      CREATE TABLE IF NOT EXISTS catalog_membership (region_id TEXT NOT NULL REFERENCES catalog_regions(id), business_id TEXT NOT NULL REFERENCES catalog_places(business_id), PRIMARY KEY(region_id, business_id));
    `);
    this.verification = new VerificationStore(this.db);
  }
  import(snapshot: ImportSnapshot) {
    if (!snapshot.records.length)
      throw new Error("En tom import må ikke erstatte tidligere data.");
    const current = this.db
      .prepare("SELECT release FROM catalog_regions WHERE id=?")
      .get(snapshot.region.id);
    compareReleases(snapshot.release, snapshot.release);
    if (
      current &&
      compareReleases(String(current.release), snapshot.release) > 0
    )
      throw new Error("En ældre udgivelse må ikke erstatte nyere data.");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const previous = this.db
        .prepare("SELECT business_id FROM catalog_membership WHERE region_id=?")
        .all(snapshot.region.id);
      this.db
        .prepare(
          `INSERT INTO catalog_regions VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,bounds=excluded.bounds,release=excluded.release,imported_at=excluded.imported_at`,
        )
        .run(
          snapshot.region.id,
          snapshot.region.name,
          JSON.stringify(snapshot.region.bounds),
          snapshot.release,
          snapshot.importedAt,
        );
      this.db
        .prepare("DELETE FROM catalog_membership WHERE region_id=?")
        .run(snapshot.region.id);
      const place = this.db.prepare(
        `INSERT INTO catalog_places(business_id,lat,lon,release,record) VALUES (?,?,?,?,?) ON CONFLICT(business_id) DO UPDATE SET lat=excluded.lat,lon=excluded.lon,release=excluded.release,record=excluded.record WHERE webhunt_release_compare(excluded.release, catalog_places.release)>=0 RETURNING id,lat,lon`,
      );
      const spatial = this.db.prepare(
        "INSERT OR REPLACE INTO catalog_spatial VALUES (?,?,?,?,?)",
      );
      const membership = this.db.prepare(
        "INSERT OR IGNORE INTO catalog_membership VALUES (?,?)",
      );
      for (const b of snapshot.records) {
        if (
          !b.id.startsWith("overture/") ||
          !Number.isFinite(b.lat) ||
          !Number.isFinite(b.lon)
        )
          throw new Error("Ugyldig virksomhed i importen.");
        const p = place.get(
          b.id,
          b.lat,
          b.lon,
          snapshot.release,
          JSON.stringify(b),
        );
        if (p) spatial.run(p.id, p.lon, p.lon, p.lat, p.lat);
        membership.run(snapshot.region.id, b.id);
      }
      // Keep withdrawn source records and their control history for investigation.
      const retire = this.db.prepare(
        "INSERT OR IGNORE INTO catalog_retired SELECT business_id,?,? FROM catalog_places p WHERE business_id=? AND NOT EXISTS(SELECT 1 FROM catalog_membership m WHERE m.business_id=p.business_id)",
      );
      for (const old of previous)
        retire.run(
          new Date().toISOString(),
          "Ikke længere medlem af den opdaterede kildeimport",
          old.business_id,
        );
      const restore = this.db.prepare(
        "DELETE FROM catalog_retired WHERE business_id=?",
      );
      for (const b of snapshot.records) restore.run(b.id);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  get(bounds: number[] | null, options: CatalogQuery = {}): CatalogResult {
    const regions = this.db
      .prepare("SELECT * FROM catalog_regions ORDER BY id")
      .all()
      .map((r) => ({
        id: String(r.id),
        name: String(r.name),
        release: String(r.release),
        importedAt: String(r.imported_at),
        bounds: JSON.parse(String(r.bounds)) as number[],
      }));
    if (!regions.length)
      throw new CatalogNotReady(
        "Virksomhedsdatabasen er endnu ikke importeret. Kortet virker; der foretages ingen Overpass-forespørgsler.",
      );
    const spatial = bounds ? " JOIN catalog_spatial s ON p.id=s.id" : "";
    const where = bounds
      ? "s.max_lat>=? AND s.min_lon<=? AND s.min_lat<=? AND s.max_lon>=? AND p.lat>=? AND p.lon<=? AND p.lat<=? AND p.lon>=?"
      : "1=1";
    const params = bounds
      ? [
          bounds[0],
          bounds[3],
          bounds[2],
          bounds[1],
          bounds[0],
          bounds[3],
          bounds[2],
          bounds[1],
        ]
      : [];
    const base = `FROM catalog_places p${spatial} LEFT JOIN business_verification v ON v.business_id=p.business_id WHERE ${where}
      AND NOT EXISTS(SELECT 1 FROM catalog_retired a WHERE a.business_id=p.business_id)
      AND coalesce(json_extract(v.result,'$.identity.state'),'uncertain')<>'closed'
      AND (v.record_hash IS NULL OR v.record_hash<>webhunt_record_hash(p.record) OR coalesce(json_extract(v.result,'$.duplicateOf'),'')='')`;
    const categoryRows = this.db
      .prepare(
        `SELECT DISTINCT webhunt_category(p.record) AS category ${base} ORDER BY category`,
      )
      .all(...params);
    const conditions = [
      options.query ? "instr(webhunt_search(p.record), ?) > 0" : "",
      options.category ? "webhunt_category(p.record)=?" : "",
    ].filter(Boolean);
    const filtered =
      base + conditions.map((condition) => ` AND ${condition}`).join("");
    const values: (string | number)[] = [...params];
    if (options.query) values.push(foldSearch(options.query));
    if (options.category) values.push(options.category);
    const offset = options.offset || 0;
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 500000)
      throw new Error("Ugyldig side.");
    const catalogTotal = Number(
      this.db.prepare("SELECT count(*) AS n FROM catalog_places").get()!.n,
    );
    const matchedTotal = Number(
      this.db.prepare(`SELECT count(*) AS n ${filtered}`).get(...values)!.n,
    );
    const rows = this.db
      .prepare(
        `SELECT p.record ${filtered} ORDER BY p.business_id LIMIT 600 OFFSET ?`,
      )
      .all(...values, offset);
    const records = rows.map((r) => {
      const b = JSON.parse(String(r.record)) as CatalogBusiness;
      const verification = this.verification.get(b);
      return { ...b, ...(verification ? { verification } : {}) };
    });
    const oldest = regions.reduce((a, b) =>
      a.importedAt < b.importedAt ? a : b,
    ).importedAt;
    const outdated = regions.some(
      (r) => Date.now() - Date.parse(r.release.slice(0, 10)) > 90 * 86400_000,
    );
    const intersects = (r: { bounds: number[] }) =>
      !bounds ||
      (r.bounds[0] <= bounds[3] &&
        r.bounds[2] >= bounds[1] &&
        r.bounds[1] <= bounds[2] &&
        r.bounds[3] >= bounds[0]);
    const relevant = regions.filter(intersects);
    const covered =
      !!bounds &&
      relevant.some(
        (r) =>
          r.bounds[0] <= bounds[1] &&
          r.bounds[1] <= bounds[0] &&
          r.bounds[2] >= bounds[3] &&
          r.bounds[3] >= bounds[2],
      );
    return {
      businesses: records,
      cached: true,
      stale: outdated,
      partial: !covered,
      overview:
        !bounds || (bounds[2] - bounds[0]) * (bounds[3] - bounds[1]) > 0.6,
      limited: offset + records.length < matchedTotal,
      catalogTotal,
      matchedTotal,
      categories: categoryRows.map((r) => String(r.category)),
      nextOffset:
        offset + records.length < matchedTotal ? offset + records.length : null,
      revision:
        regions.map((r) => `${r.id}:${r.release}:${r.importedAt}`).join("|") +
        ":" +
        String(
          this.db
            .prepare(
              "SELECT coalesce(max(id),0) AS n FROM verification_history",
            )
            .get()!.n,
        ),
      source: "Overture Maps · egen database",
      fetchedAt: oldest,
      regions,
      warning:
        (!relevant.length
          ? "Dette område er endnu ikke importeret. "
          : !covered
            ? `Importeret område: ${regions.map((r) => r.name).join(", ")}. Dækningen er ufuldstændig. `
            : "") +
          (outdated
            ? "En eller flere udgivelser er over 90 dage gamle; senest importerede data vises stadig."
            : "") || undefined,
    };
  }
  close() {
    this.db.close();
  }
}

const shared = globalThis as typeof globalThis & {
  webhuntCatalog?: BusinessCatalog;
  webhuntCatalogVersion?: number;
};
export function getCatalog() {
  // Next dev preserves globals across code updates. Reopen the connection with
  // the new class/schema instead of keeping the previous getter alive after pull.
  if (shared.webhuntCatalog && shared.webhuntCatalogVersion !== 2) {
    shared.webhuntCatalog.close();
    delete shared.webhuntCatalog;
  }
  if (!shared.webhuntCatalog) {
    const db = new BusinessCatalog();
    const seedFile = path.join(
      process.cwd(),
      "data/overture/nykoebing-falster.json",
    );
    try {
      if (existsSync(seedFile)) {
        const seed = JSON.parse(
          readFileSync(seedFile, "utf8"),
        ) as ImportSnapshot;
        const current = db.db
          .prepare(
            "SELECT release, imported_at FROM catalog_regions WHERE id=?",
          )
          .get(seed.region.id);
        // Packaged startup data may initialize an absent region only. Existing
        // user imports are never replaced just because a seed has a newer timestamp.
        if (!current) db.import(seed);
      }
      shared.webhuntCatalog = db;
      shared.webhuntCatalogVersion = 2;
    } catch (e) {
      db.close();
      throw e;
    }
  }
  return shared.webhuntCatalog;
}
