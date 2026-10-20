export type CatalogQuery = {
  query?: string;
  category?: string;
  offset?: number;
};
export function parseCatalogQuery(params: URLSearchParams): CatalogQuery {
  const query = params.get("q")?.trim() || "";
  const category = params.get("category")?.trim() || "";
  const raw = params.get("offset") || "0";
  if (
    query.length > 120 ||
    category.length > 100 ||
    !/^\d+$/.test(raw) ||
    Number(raw) > 500000
  )
    throw new Error(
      "Ugyldig søgning eller side. Forkort søgningen og prøv igen.",
    );
  return { query, category, offset: Number(raw) };
}
export function foldSearch(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("da-DK");
}
