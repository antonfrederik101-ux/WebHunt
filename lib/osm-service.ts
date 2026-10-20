import { OsmCache, FRESH_MS, Snapshot } from "./osm-cache";
import { toBusiness, OSMElement } from "./businesses";
import { Business, cities } from "./types";
import { agent } from "./server";
export const PUBLIC_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
export function endpointsForConfig(
  value = process.env.OVERPASS_API_URL,
): string[] {
  if (!value) return PUBLIC_ENDPOINTS;
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "OVERPASS_API_URL must be a credential-free HTTPS interpreter endpoint.",
    );
  return [url.href];
}
export function queryFor(bounds: number[] | null) {
  const broad =
    !bounds || (bounds[2] - bounds[0]) * (bounds[3] - bounds[1]) > 0.6;
  // A small grid increases cache reuse while panning; limits stay within Denmark.
  const box = bounds?.map(
    (v, i) => (i < 2 ? Math.floor(v * 100) : Math.ceil(v * 100)) / 100,
  );
  const key = broad ? "dk-overview-v2" : box!.join(",");
  const selection = (where: string) =>
    `nwr[shop][name]${where}(area.dk);nwr[craft][name]${where}(area.dk);nwr[office][name]${where}(area.dk);nwr[amenity~"^(restaurant|cafe|bar|pub|fast_food|dentist|pharmacy)$"][name]${where}(area.dk);nwr[tourism~"^(hotel|guest_house)$"][name]${where}(area.dk);`;
  const body = broad
    ? cities
        .slice(1)
        .map(
          (c) =>
            `(${selection(`(around:800,${c.lat},${c.lon})`)});out center tags 60;`,
        )
        .join("")
    : `(${selection(`(${key})`)});out center tags 600;`;
  return {
    key,
    broad,
    query: `[out:json][timeout:15];area["ISO3166-1"="DK"][admin_level=2]->.dk;${body}`,
  };
}
export function retryDelay(
  header: string | null,
  failures: number,
  now: number,
) {
  const seconds = header ? Number(header) : NaN;
  const requested = Number.isFinite(seconds)
    ? seconds * 1000
    : header
      ? Math.max(0, Date.parse(header) - now)
      : 0;
  return Math.max(
    Math.min(30 * 60_000, 60_000 * 2 ** Math.min(failures, 5)),
    Number.isFinite(requested) ? requested : 0,
  );
}
export type BusinessResult = {
  businesses: Business[];
  cached: boolean;
  stale: boolean;
  partial: boolean;
  overview: boolean;
  limited: boolean;
  source: string;
  fetchedAt: string;
  warning?: string;
  retryAfter?: number;
};
export class SourceUnavailable extends Error {
  constructor(
    message: string,
    readonly retryAfter = 120,
  ) {
    super(message);
  }
}
export class OsmService {
  private pending = new Map<string, Promise<BusinessResult>>();
  constructor(
    readonly cache = new OsmCache(),
    readonly request: typeof fetch = fetch,
    readonly now: () => number = Date.now,
    readonly endpoints = endpointsForConfig(),
  ) {}
  private result(
    s: Snapshot,
    overview: boolean,
    stale = false,
    partial = false,
    warning?: string,
    retryAfter?: number,
  ): BusinessResult {
    return {
      businesses: s.records,
      cached: true,
      stale,
      partial,
      overview,
      limited: s.limited,
      source: "© OpenStreetMap-bidragsydere / Overpass · ODbL",
      fetchedAt: s.fetchedAt,
      warning,
      retryAfter,
    };
  }
  async get(bounds: number[] | null): Promise<BusinessResult> {
    const target = queryFor(bounds),
      hit = await this.cache.read(target.key);
    if (hit && this.now() - Date.parse(hit.fetchedAt) < FRESH_MS)
      return this.result(hit, target.broad);
    if (this.pending.has(target.key)) return this.pending.get(target.key)!;
    const job = this.refresh(target, bounds, hit);
    this.pending.set(target.key, job);
    try {
      return await job;
    } finally {
      this.pending.delete(target.key);
    }
  }
  private async refresh(
    target: ReturnType<typeof queryFor>,
    bounds: number[] | null,
    hit: Snapshot | null,
  ): Promise<BusinessResult> {
    const fallback = async (message: string, retry = 120) => {
      const old =
        hit || (await this.cache.partial(target.broad ? null : bounds));
      if (old)
        return this.result(
          old,
          target.broad,
          true,
          !hit,
          `${message} Viser tidligere hentede OSM-data. Dækningen kan være ufuldstændig.`,
          retry,
        );
      throw new SourceUnavailable(message, retry);
    };
    const release = await this.cache.lock();
    if (!release)
      return await fallback(
        "En dataopdatering kører allerede. Vent lidt og prøv igen.",
        15,
      );
    try {
      // Recheck after acquiring the cross-process lock.
      const updated = await this.cache.read(target.key);
      if (updated && this.now() - Date.parse(updated.fetchedAt) < FRESH_MS)
        return this.result(updated, target.broad);
      const cooldowns = await this.cache.readCooldowns();
      let nextAttempt = Infinity;
      for (const endpoint of this.endpoints) {
        const circuit = cooldowns[endpoint];
        if (circuit?.until > this.now()) {
          nextAttempt = Math.min(nextAttempt, circuit.until);
          continue;
        }
        let retry: string | null = null;
        try {
          const response = await this.request(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "User-Agent": agent,
            },
            body: new URLSearchParams({ data: target.query }),
            signal: AbortSignal.timeout(20_000),
          });
          retry = response.headers.get("retry-after");
          if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
          const body = await response.json();
          if (body.remark || !Array.isArray(body.elements))
            throw new Error("Overpass returned incomplete data");
          const records = Array.from(
            new Map(
              (body.elements as OSMElement[])
                .map(toBusiness)
                .filter((b): b is Business => b !== null)
                .map((b) => [b.id, b]),
            ).values(),
          );
          // Overview output is capped per city, so reaching a regional cap is a limited dataset.
          const snapshot: Snapshot = {
            version: 1,
            key: target.key,
            fetchedAt: new Date(this.now()).toISOString(),
            endpoint,
            records,
            limited: target.broad
              ? body.elements.length >= 60
              : records.length >= 600,
          };
          await this.cache.write(snapshot);
          cooldowns[endpoint] = { failures: 0, until: this.now() + 5000 };
          await this.cache.writeCooldowns(cooldowns);
          return { ...this.result(snapshot, target.broad), cached: false };
        } catch {
          const failures = (circuit?.failures || 0) + 1;
          const until = this.now() + retryDelay(retry, failures, this.now());
          cooldowns[endpoint] = { failures, until };
          nextAttempt = Math.min(nextAttempt, until);
          await this.cache.writeCooldowns(cooldowns);
        }
      }
      const seconds = Math.max(1, Math.ceil((nextAttempt - this.now()) / 1000));
      return await fallback(
        "OSM-datakilderne er optaget eller kan ikke nås. Vi venter før næste forsøg for at skåne datakilderne.",
        Number.isFinite(seconds) ? seconds : 120,
      );
    } finally {
      await release();
    }
  }
}
// Retain deduplication across development hot reloads. Public data only, no user information.
const shared = globalThis as typeof globalThis & { webhuntOsm?: OsmService };
export const osmService = (shared.webhuntOsm ??= new OsmService());
