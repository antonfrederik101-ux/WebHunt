import { Business, categories, statuses } from "./types";
export type OSMElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};
export function safeWebsite(value: string): string {
  try {
    const u = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return ["http:", "https:"].includes(u.protocol) &&
      !u.username &&
      !u.password &&
      u.hostname.includes(".")
      ? u.href
      : "";
  } catch {
    return "";
  }
}
export function toBusiness(e: OSMElement): Business | null {
  const t = e.tags || {};
  const lat = e.lat ?? e.center?.lat;
  const lon = e.lon ?? e.center?.lon;
  if (!t.name || lat == null || lon == null) return null;
  const kind =
    t.shop || t.craft || t.office || t.amenity || t.tourism || "Virksomhed";
  return {
    id: `${e.type}/${e.id}`,
    name: t.name,
    lat,
    lon,
    address:
      [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ") ||
      "Adresse ikke registreret",
    city: t["addr:city"] || "",
    postcode: t["addr:postcode"] || "",
    category: categories[kind] || kind.replaceAll("_", " "),
    phone: t["contact:phone"] || t.phone || "",
    website: safeWebsite(t["contact:website"] || t.website || ""),
    status: "unknown",
    sourceUrl: `https://www.openstreetmap.org/${e.type}/${e.id}`,
  };
}
export function parseBounds(value: string | null): number[] | null {
  if (!value) return null;
  const p = value.split(",").map(Number);
  if (
    p.length !== 4 ||
    p.some((x) => !Number.isFinite(x)) ||
    p[0] < 54.4 ||
    p[2] > 57.9 ||
    p[1] < 7.8 ||
    p[3] > 15.3 ||
    p[0] >= p[2] ||
    p[1] >= p[3]
  )
    throw new Error("Ugyldigt kortudsnit. Vælg et område i Danmark.");
  return p;
}
export function csv(leads: import("./types").Lead[]) {
  const cell = (v: string) =>
    '"' + (/^[=+\-@\t\r]/.test(v) ? "'" + v : v).replaceAll('"', '""') + '"';
  return (
    "\uFEFF" +
    [
      [
        "Virksomhed",
        "Adresse",
        "Postnummer",
        "By",
        "Telefon",
        "Hjemmeside",
        "Hjemmesidestatus",
        "Note",
        "Kontaktstatus",
        "Tilføjet",
        "Datakilde",
        "Kilde-URL",
        "Licens",
      ],
      ...leads.map((l) => [
        l.business.name,
        l.business.address,
        l.business.postcode,
        l.business.city,
        l.business.phone,
        l.business.website,
        statuses[l.business.status].label,
        l.notes,
        l.contact_status,
        l.created_at,
        "© OpenStreetMap-bidragsydere",
        l.business.sourceUrl,
        "ODbL — https://www.openstreetmap.org/copyright",
      ]),
    ]
      .map((row) => row.map(cell).join(";"))
      .join("\r\n")
  );
}
