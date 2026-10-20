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
};
export class CatalogNotReady extends Error {}
export class BusinessCatalog {
  readonly db: DatabaseSync;
  constructor(
    filename = process.env.WEBHUNT_CATALOG_PATH ||
      path.join(process.cwd(), ".data", "businesses.sqlite"),
  ) {
    if (filename !== ":memory:")
      mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS catalog_regions (id TEXT PRIMARY KEY, name TEXT NOT NULL, bounds TEXT NOT NULL, release TEXT NOT NULL, imported_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS catalog_places (id INTEGER PRIMARY KEY, business_id TEXT NOT NULL UNIQUE, lat REAL NOT NULL, lon REAL NOT NULL, release TEXT NOT NULL, record TEXT NOT NULL);
      CREATE VIRTUAL TABLE IF NOT EXISTS catalog_spatial USING rtree(id, min_lon, max_lon, min_lat, max_lat);
      CREATE TABLE IF NOT EXISTS catalog_membership (region_id TEXT NOT NULL REFERENCES catalog_regions(id), business_id TEXT NOT NULL REFERENCES catalog_places(business_id), PRIMARY KEY(region_id, business_id));
    `);
  }
  import(snapshot: ImportSnapshot) {
    if (!snapshot.records.length)
      throw new Error("En tom import må ikke erstatte tidligere data.");
    const current = this.db
      .prepare("SELECT release FROM catalog_regions WHERE id=?")
      .get(snapshot.region.id);
    if (current && String(current.release) > snapshot.release)
      throw new Error("En ældre udgivelse må ikke erstatte nyere data.");
    this.db.exec("BEGIN IMMEDIATE");
    try {
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
        `INSERT INTO catalog_places(business_id,lat,lon,release,record) VALUES (?,?,?,?,?) ON CONFLICT(business_id) DO UPDATE SET lat=excluded.lat,lon=excluded.lon,release=excluded.release,record=excluded.record WHERE excluded.release >= catalog_places.release RETURNING id,lat,lon`,
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
      this.db.exec(
        `DELETE FROM catalog_spatial WHERE id IN (SELECT id FROM catalog_places WHERE business_id NOT IN (SELECT business_id FROM catalog_membership)); DELETE FROM catalog_places WHERE business_id NOT IN (SELECT business_id FROM catalog_membership);`,
      );
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  get(bounds: number[] | null): CatalogResult {
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
    const rows = bounds
      ? this.db
          .prepare(
            `SELECT p.record FROM catalog_spatial s JOIN catalog_places p ON p.id=s.id WHERE s.max_lat>=? AND s.min_lon<=? AND s.min_lat<=? AND s.max_lon>=? AND p.lat>=? AND p.lon<=? AND p.lat<=? AND p.lon>=? ORDER BY p.business_id LIMIT 601`,
          )
          .all(
            bounds[0],
            bounds[3],
            bounds[2],
            bounds[1],
            bounds[0],
            bounds[3],
            bounds[2],
            bounds[1],
          )
      : this.db
          .prepare(
            "SELECT record FROM catalog_places ORDER BY business_id LIMIT 601",
          )
          .all();
    const records = rows
      .slice(0, 600)
      .map((r) => JSON.parse(String(r.record)) as CatalogBusiness);
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
      limited: rows.length > 600,
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
};
export function getCatalog() {
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
        if (
          !current ||
          (seed.release >= String(current.release) &&
            seed.importedAt > String(current.imported_at))
        )
          db.import(seed);
      }
      shared.webhuntCatalog = db;
    } catch (e) {
      db.close();
      throw e;
    }
  }
  return shared.webhuntCatalog;
}
