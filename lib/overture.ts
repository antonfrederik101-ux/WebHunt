import { safeWebsite } from "./businesses";
import { categories, type Business } from "./types";

export const OVERTURE_LICENSES = {
  cdla: "CDLA-Permissive-2.0",
  apache: "Apache-2.0",
  cc0: "CC0-1.0",
};
export type Region = {
  id: string;
  name: string;
  bounds: [number, number, number, number];
};
// west, south, east, north, matching Overture's download convention.
export const PILOT: Region = {
  id: "nykoebing-falster",
  name: "Nykøbing Falster",
  bounds: [11.83, 54.735, 11.93, 54.81],
};
export type PlaceFeature = {
  id?: string;
  geometry?: { type?: string; coordinates?: number[] };
  properties?: {
    id?: string;
    names?: { primary?: string };
    basic_category?: string;
    taxonomy?: { primary?: string; hierarchy?: string[] };
    categories?: { primary?: string };
    addresses?: {
      freeform?: string;
      locality?: string;
      postcode?: string;
      country?: string;
    }[];
    websites?: string[];
    phones?: string[];
    operating_status?: string;
    confidence?: number;
    sources?: {
      dataset?: string;
      record_id?: string;
      update_time?: string;
      property?: string;
    }[];
  };
};
export type CatalogBusiness = Business & {
  source: "Overture Maps";
  sourceId: string;
  licenses: string[];
  sourceDatasets: string[];
  sourceDetails: NonNullable<
    NonNullable<PlaceFeature["properties"]>["sources"]
  >;
  sourceRelease: string;
  importedAt: string;
};
export type ImportSnapshot = {
  version: 1;
  region: Region;
  release: string;
  importedAt: string;
  attribution: string;
  records: CatalogBusiness[];
  // Records excluded deliberately; never replace an existing import with an accidental empty result.
  rejected: number;
};
export function sourceLicense(dataset: string): string | null {
  // Foursquare requires its complete upstream NOTICE in addition to Apache-2.0.
  // Exclude until that notice has been fetched and reviewed for this distribution.
  if (/foursquare/i.test(dataset)) return null;
  if (/alltheplaces/i.test(dataset)) return OVERTURE_LICENSES.cc0;
  if (
    /^(meta|microsoft|pinmeto|krick|renderseo|dac|brightquery)(\b|,)/i.test(
      dataset,
    )
  )
    return OVERTURE_LICENSES.cdla;
  return null;
}
export function normalizePlace(
  feature: PlaceFeature,
  region: Region,
  release: string,
  importedAt: string,
): CatalogBusiness | null {
  const p = feature.properties,
    coordinates = feature.geometry?.coordinates;
  const id = feature.id || p?.id,
    name = p?.names?.primary?.trim();
  if (
    !id ||
    !name ||
    feature.geometry?.type !== "Point" ||
    !coordinates ||
    coordinates.length < 2
  )
    return null;
  const [lon, lat] = coordinates,
    [w, s, e, n] = region.bounds;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lon < w ||
    lon > e ||
    lat < s ||
    lat > n
  )
    return null;
  if (p?.operating_status === "permanently_closed") return null;
  const addresses = p?.addresses || [];
  const address = addresses.find((a) => a.country === "DK") || addresses[0];
  // In the small pilot there is no foreign territory. National imports require explicit country=DK.
  if (address?.country && address.country !== "DK") return null;
  if ((e - w) * (n - s) > 0.1 && address?.country !== "DK") return null;
  const kind =
    p?.basic_category || p?.taxonomy?.primary || p?.categories?.primary;
  if (!kind) return null;
  const hierarchy = p?.taxonomy?.hierarchy || [];
  // Places includes mountains, schools and landmarks; those are not business prospects.
  if (
    /^(natural|community_and_government|education|cultural_and_historic)/.test(
      hierarchy[0] || kind,
    )
  )
    return null;
  if (
    /^(mountain|peak|beach|park|bus_stop|cemetery|church|school|monument|memorial)$/.test(
      kind,
    )
  )
    return null;
  const sources = p?.sources || [];
  const datasets = [
    ...new Set(sources.map((v) => v.dataset || "").filter(Boolean)),
  ];
  const licenses = [
    ...new Set(datasets.map(sourceLicense).filter((v): v is string => !!v)),
  ];
  // Do not redistribute new/unknown providers under an assumed license.
  if (!datasets.length || datasets.some((d) => !sourceLicense(d))) return null;
  return {
    id: `overture/${id}`,
    sourceId: id,
    name,
    lat,
    lon,
    address: address?.freeform || "Adresse ikke registreret",
    city: address?.locality || "",
    postcode: address?.postcode || "",
    category: categories[kind] || kind.replaceAll("_", " "),
    phone: p?.phones?.[0] || "",
    website: safeWebsite(p?.websites?.[0] || ""),
    status: "unknown",
    source: "Overture Maps",
    sourceDatasets: datasets,
    sourceDetails: sources,
    licenses,
    sourceRelease: release,
    importedAt,
    sourceUrl: `https://explore.overturemaps.org/?id=${encodeURIComponent(id)}`,
  };
}
export function prepareSnapshot(
  features: PlaceFeature[],
  region: Region,
  release: string,
  importedAt = new Date().toISOString(),
): ImportSnapshot {
  if (
    !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(release) ||
    !Number.isFinite(Date.parse(importedAt))
  )
    throw new Error("Ugyldig Overture-udgivelse eller importdato.");
  const records = new Map<string, CatalogBusiness>();
  let rejected = 0;
  for (const feature of features) {
    const b = normalizePlace(feature, region, release, importedAt);
    if (b) records.set(b.id, b);
    else rejected++;
  }
  if (!records.size)
    throw new Error(
      "Importen indeholder ingen anvendelige virksomheder. Tidligere data er bevaret.",
    );
  return {
    version: 1,
    region,
    release,
    importedAt,
    records: [...records.values()],
    rejected,
    attribution: "Overture Maps Foundation · kildelicenser pr. virksomhed",
  };
}
