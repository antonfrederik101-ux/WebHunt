import { websiteDetails } from "./websites";
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
    socials?: string[];
    phones?: string[];
    operating_status?: string;
    confidence?: number;
    sources?: {
      dataset?: string;
      record_id?: string;
      update_time?: string;
      property?: string;
      provider?: string;
      resource?: string;
      version?: string;
      license?: string;
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
  rejectionReasons?: Record<string, number>;
};
// Official schema examples use source IDs, rather than provider display names:
// https://github.com/OvertureMaps/schema/blob/b53004401617a0709cd2ee3b872bb3672819078e/examples/places/place.yaml
const DATASET_ALIASES = new Map([
  ["metaPlaces", "Meta"],
  ["msftPlaces", "Microsoft"],
]);
export function sourceLicense(dataset: string): string | null {
  dataset = DATASET_ALIASES.get(dataset) || dataset;
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
type PlaceSources = NonNullable<
  NonNullable<PlaceFeature["properties"]>["sources"]
>;
const publishedLicenses = new Set<string>([
  OVERTURE_LICENSES.cdla,
  OVERTURE_LICENSES.cc0,
]);
function sourceLabel(source: PlaceSources[number]) {
  return typeof source.dataset === "string" && source.dataset
    ? source.dataset
    : typeof source.provider === "string"
      ? source.provider
      : "";
}
/** Resolve the whole record's provenance, including Overture's processing entries.
 * Overture Places is licensed per contributor, not by assigning a blanket license
 * to the publisher label. Every unknown/restricted contributor still blocks import.
 * See the official Places sources/licensing guide and sourcePropertyItem schema.
 */
export function placeSourcePolicy(sources: PlaceSources) {
  if (
    !Array.isArray(sources) ||
    sources.some((source) => !source || typeof source !== "object")
  )
    return { datasets: [], licenses: [], unresolved: ["invalid_sources"] };
  const datasets = [...new Set(sources.map(sourceLabel).filter(Boolean))];
  const original = sources.filter((s) => sourceLabel(s) !== "Overture");
  const inherited = [
    ...new Set(
      original
        .map((s) => sourceLicense(sourceLabel(s)))
        .filter((v): v is string => !!v),
    ),
  ];
  const licenses = new Set<string>();
  const unresolved = new Set<string>();
  for (const source of sources) {
    const label = sourceLabel(source);
    if (!label) {
      unresolved.add("missing_source_identity");
      continue;
    }
    if (label === "Overture") {
      // A declared supported license is evidence; an unlicensed publisher label
      // alone is insufficient. Retain the original contributing licenses otherwise.
      if (source.license) {
        if (publishedLicenses.has(source.license)) licenses.add(source.license);
        else unresolved.add(label);
      } else if (inherited.length) {
        for (const license of inherited) licenses.add(license);
      } else unresolved.add(label);
      continue;
    }
    const license = sourceLicense(label);
    if (!license || (source.license && source.license !== license))
      unresolved.add(label);
    else licenses.add(license);
  }
  return { datasets, licenses: [...licenses], unresolved: [...unresolved] };
}

export function normalizePlace(
  feature: PlaceFeature,
  region: Region,
  release: string,
  importedAt: string,
  onReject?: (reason: string) => void,
): CatalogBusiness | null {
  const reject = (reason: string): null => {
    onReject?.(reason);
    return null;
  };
  const p = feature.properties,
    coordinates = feature.geometry?.coordinates;
  const id = feature.id || p?.id,
    name = typeof p?.names?.primary === "string" ? p.names.primary.trim() : "";
  if (typeof id !== "string" || !id || !name) return reject("missing_identity");
  if (
    feature.geometry?.type !== "Point" ||
    !Array.isArray(coordinates) ||
    coordinates.length < 2
  )
    return reject("invalid_point");
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
    return reject("outside_region");
  if (p?.operating_status === "permanently_closed") return reject("closed");
  const addresses = Array.isArray(p?.addresses)
    ? p.addresses.filter((a) => a && typeof a === "object")
    : [];
  const address = addresses.find((a) => a.country === "DK") || addresses[0];
  // In the small pilot there is no foreign territory. National imports require explicit country=DK.
  if (address?.country && address.country !== "DK")
    return reject("foreign_country");
  if ((e - w) * (n - s) > 0.1 && address?.country !== "DK")
    return reject("missing_danish_country");
  const kind =
    p?.basic_category || p?.taxonomy?.primary || p?.categories?.primary;
  if (typeof kind !== "string" || !kind) return reject("missing_category");
  const hierarchy = Array.isArray(p?.taxonomy?.hierarchy)
    ? p.taxonomy.hierarchy
    : [];
  // Places includes mountains, schools and landmarks; those are not business prospects.
  if (
    /^(natural|community_and_government|education|cultural_and_historic)/.test(
      hierarchy[0] || kind,
    )
  )
    return reject("non_business");
  if (
    /^(mountain|peak|beach|park|bus_stop|cemetery|church|school|monument|memorial)$/.test(
      kind,
    )
  )
    return reject("non_business");
  const sources = Array.isArray(p?.sources) ? p.sources : [];
  const policy = placeSourcePolicy(sources);
  const { datasets, licenses } = policy;
  if (!datasets.length) return reject("missing_source");
  if (policy.unresolved.length || !licenses.length)
    return reject("unknown_license");
  return {
    id: `overture/${id}`,
    sourceId: id,
    name,
    lat,
    lon,
    address:
      typeof address?.freeform === "string" && address.freeform.trim()
        ? address.freeform.trim()
        : "Adresse ikke registreret",
    city: typeof address?.locality === "string" ? address.locality.trim() : "",
    postcode:
      typeof address?.postcode === "string" ? address.postcode.trim() : "",
    category: categories[kind] || kind.replaceAll("_", " "),
    phone:
      Array.isArray(p?.phones) && typeof p.phones[0] === "string"
        ? p.phones[0]
        : "",
    ...websiteDetails(p?.websites, p?.socials),
    status: "unknown",
    ...(typeof p?.operating_status === "string"
      ? { operatingStatus: p.operating_status }
      : {}),
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
  const rejectionReasons: Record<string, number> = {};
  const unknownDatasets: Record<string, number> = Object.create(null);
  for (const feature of features) {
    if (!feature || typeof feature !== "object") {
      rejected++;
      rejectionReasons.invalid_feature =
        (rejectionReasons.invalid_feature || 0) + 1;
      continue;
    }
    for (const dataset of placeSourcePolicy(feature?.properties?.sources || [])
      .unresolved) {
      unknownDatasets[dataset] = (unknownDatasets[dataset] || 0) + 1;
    }
    const b = normalizePlace(feature, region, release, importedAt, (reason) => {
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
    });
    if (b) records.set(b.id, b);
    else rejected++;
  }
  if (!records.size)
    throw new Error(
      "Importen indeholder ingen anvendelige virksomheder. Tidligere data er bevaret. " +
        JSON.stringify({
          input: features.length,
          rejectionReasons,
          unknownDatasets,
          sourceSamples: features
            .filter((f) => f && typeof f === "object")
            .slice(0, 2)
            .map((f) =>
              (Array.isArray(f.properties?.sources) ? f.properties.sources : [])
                .filter(Boolean)
                .map((source) => ({
                  dataset: source.dataset,
                  provider: source.provider,
                  property: source.property,
                  license: source.license,
                })),
            ),
        }),
    );
  return {
    version: 1,
    region,
    release,
    importedAt,
    records: [...records.values()],
    rejected,
    rejectionReasons,
    attribution: "Overture Maps Foundation · kildelicenser pr. virksomhed",
  };
}
