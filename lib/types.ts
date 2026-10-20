export type Status = "unknown" | "missing" | "improve" | "good";
export type Business = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address: string;
  city: string;
  postcode: string;
  category: string;
  phone: string;
  website: string;
  status: Status;
  sourceUrl: string;
};
export type Analysis = {
  score: number;
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  https: boolean;
  findings: string[];
  checkedAt: string;
  url: string;
  status: Status;
};
export type ContactStatus =
  "Ikke kontaktet" | "Kontaktet" | "Interesseret" | "Kunde" | "Afvist";
export type Lead = {
  business: Business;
  notes: string;
  contact_status: ContactStatus;
  created_at: string;
};
export const statuses: Record<
  Status,
  { label: string; color: string; description: string }
> = {
  missing: {
    label: "Sandsynligvis ingen hjemmeside",
    color: "#fb7185",
    description: "Manuelt vurderet. Manglende OSM-data er ikke dokumentation.",
  },
  improve: {
    label: "Forbedringsmuligheder",
    color: "#fbbf24",
    description: "Tekniske forbedringer fundet eller manuelt vurderet.",
  },
  good: {
    label: "Velfungerende hjemmeside",
    color: "#34d399",
    description: "God teknisk score eller manuelt vurderet.",
  },
  unknown: {
    label: "Ikke undersøgt",
    color: "#94a3b8",
    description: "Ingen gennemført analyse eller verificeret vurdering.",
  },
};
export const categories: Record<string, string> = {
  restaurant: "Restaurant",
  cafe: "Café",
  fast_food: "Takeaway",
  bar: "Bar",
  pub: "Pub",
  hairdresser: "Frisør",
  beauty: "Skønhed",
  bakery: "Bager",
  supermarket: "Supermarked",
  clothes: "Tøjbutik",
  florist: "Blomster",
  car_repair: "Autoværksted",
  dentist: "Tandlæge",
  pharmacy: "Apotek",
  hotel: "Hotel",
  guest_house: "Overnatning",
  carpenter: "Tømrer",
  electrician: "Elektriker",
  plumber: "VVS",
  estate_agent: "Ejendomsmægler",
  convenience: "Dagligvarer",
  optician: "Optiker",
  bicycle: "Cykelbutik",
  butcher: "Slagter",
  furniture: "Møbler",
  shoes: "Sko",
  jewelry: "Smykker",
};
export const cities = [
  { name: "Danmark", lat: 56.05, lon: 10.8, zoom: 7 },
  { name: "København", lat: 55.6761, lon: 12.5683, zoom: 14 },
  { name: "Aarhus", lat: 56.1629, lon: 10.2039, zoom: 14 },
  { name: "Odense", lat: 55.4038, lon: 10.4024, zoom: 14 },
  { name: "Aalborg", lat: 57.0488, lon: 9.9217, zoom: 14 },
  { name: "Nykøbing Falster", lat: 54.7691, lon: 11.8743, zoom: 14 },
  { name: "Roskilde", lat: 55.6419, lon: 12.0803, zoom: 14 },
  { name: "Næstved", lat: 55.2299, lon: 11.7609, zoom: 14 },
  { name: "Esbjerg", lat: 55.467, lon: 8.452, zoom: 14 },
  { name: "Rønne, Bornholm", lat: 55.1009, lon: 14.7066, zoom: 14 },
];
