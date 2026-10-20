import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { placeSourcePolicy, type PlaceFeature } from "./overture";
import type { Business } from "./types";
import type { IdentityEvidence } from "./verification-types";
export function overtureObservation(
  b: Business,
  feature: PlaceFeature | undefined,
  release: string,
): IdentityEvidence | undefined {
  if (
    !feature ||
    feature.id !== b.sourceId ||
    !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(release)
  )
    return;
  const sources = feature.properties?.sources || [],
    policy = placeSourcePolicy(sources);
  if (!policy.licenses.length || policy.unresolved.length) return;
  const updated = Date.parse(release.slice(0, 10));
  if (
    !Number.isFinite(updated) ||
    updated > Date.now() ||
    Date.now() - updated > 90 * 86400_000
  )
    return;
  // An explicit same-ID closure is useful evidence. "Open" in an old map record
  // never becomes an affirmative proof of activity or an invented CVR match.
  if (feature.properties?.operating_status !== "permanently_closed") return;
  return {
    state: "closed",
    checkedAt: new Date().toISOString(),
    source: `Overture ${release} · eksplicit lukningsregistrering`,
    sourceUrl: b.sourceUrl,
    reason: `Kildeposten med samme Overture-ID er eksplicit markeret permanently_closed i udgivelse ${release}. Det er en kortkildes lukningsregistrering, ikke en CVR-attest. Post og historik bevares til efterprøvning.`,
  };
}
export function cachedPilotObservations(
  records: Business[],
  release: string,
): Map<string, IdentityEvidence> {
  const result = new Map<string, IdentityEvidence>();
  if (!/^\d{4}-\d{2}-\d{2}\.\d+$/.test(release)) return result;
  const file = path.join(
    process.cwd(),
    ".data/imports",
    `nykoebing-falster-${release}.geojson`,
  );
  if (!existsSync(file)) return result;
  const raw = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(raw?.features)) return result;
  const features = new Map<string, PlaceFeature>(
    raw.features
      .filter((f: PlaceFeature) => f && typeof f.id === "string")
      .map((f: PlaceFeature) => [f.id, f]),
  );
  for (const b of records) {
    const evidence = overtureObservation(
      b,
      features.get(b.sourceId || ""),
      release,
    );
    if (evidence) result.set(b.id, evidence);
  }
  return result;
}
