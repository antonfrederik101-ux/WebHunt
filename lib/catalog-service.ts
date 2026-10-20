import {
  getCatalog,
  type CatalogResult,
  CatalogNotReady,
} from "./business-catalog";

export async function catalogBusinesses(
  bounds: number[] | null,
): Promise<CatalogResult> {
  if (process.env.WEBHUNT_CATALOG_BACKEND !== "supabase")
    return getCatalog().get(bounds);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new CatalogNotReady(
      "Virksomhedsdatabasen mangler Supabase-konfiguration. Der bruges ikke Overpass som reserve.",
    );
  const r = await fetch(new URL("/rest/v1/rpc/webhunt_businesses", url), {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({
      south: bounds?.[0] ?? 54.4,
      west: bounds?.[1] ?? 7.8,
      north: bounds?.[2] ?? 57.9,
      east: bounds?.[3] ?? 15.3,
    }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!r.ok)
    throw new CatalogNotReady(
      "Virksomhedsdatabasen kan ikke læses. Kontrollér Supabase og katalogmigreringen. Der ventes ikke på Overpass.",
    );
  const result = (await r.json()) as CatalogResult;
  if (!result.regions?.length)
    throw new CatalogNotReady(
      "Der er endnu ingen importerede områder i virksomhedsdatabasen.",
    );
  return result;
}
