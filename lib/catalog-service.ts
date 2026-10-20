import { foldSearch } from "./catalog-query";
import { presentBusiness } from "./business-status";
import type { CatalogQuery } from "./catalog-query";
import {
  getCatalog,
  type CatalogResult,
  CatalogNotReady,
} from "./business-catalog";

export async function catalogBusinesses(
  bounds: number[] | null,
  options: CatalogQuery = {},
): Promise<CatalogResult> {
  if (process.env.WEBHUNT_CATALOG_BACKEND !== "supabase")
    return getCatalog().get(bounds, options);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new CatalogNotReady(
      "Virksomhedsdatabasen mangler Supabase-konfiguration. Der bruges ikke Overpass som reserve.",
    );
  const parameters = {
    south: bounds?.[0] ?? 54.4,
    west: bounds?.[1] ?? 7.8,
    north: bounds?.[2] ?? 57.9,
    east: bounds?.[3] ?? 15.3,
  };
  const request = (name: string, body: unknown) =>
    fetch(new URL(`/rest/v1/rpc/${name}`, url), {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
  let r = await request("webhunt_catalog_page", {
    ...parameters,
    search_text: options.query || "",
    industry: options.category || "",
    page_offset: options.offset || 0,
  });
  let legacy = false;
  // Existing Supabase installations remain readable before the additive migration.
  if (r.status === 404) {
    legacy = true;
    r = await request("webhunt_businesses", parameters);
  }
  if (!r.ok)
    throw new CatalogNotReady(
      "Virksomhedsdatabasen kan ikke læses. Kontrollér Supabase og katalogmigreringen. Der ventes ikke på Overpass.",
    );
  const result = (await r.json()) as CatalogResult;
  if (!result.regions?.length)
    throw new CatalogNotReady(
      "Der er endnu ingen importerede områder i virksomhedsdatabasen.",
    );
  if (legacy && (options.query || options.category)) {
    const query = foldSearch(options.query || "");
    result.businesses = result.businesses.filter((record) => {
      const b = presentBusiness(record);
      return (
        (!query ||
          foldSearch(
            [
              b.name,
              b.address,
              b.city,
              b.postcode,
              b.category,
              b.cvr || "",
            ].join(" "),
          ).includes(query)) &&
        (!options.category || b.category === options.category)
      );
    });
  }
  if (legacy && result.limited)
    result.warning = [
      result.warning,
      "Supabase bruger den tidligere katalogfunktion. Søgningen omfatter højst 600 indlæste poster, indtil den additive SQL-opdatering er kørt.",
    ]
      .filter(Boolean)
      .join(" ");
  return result;
}
