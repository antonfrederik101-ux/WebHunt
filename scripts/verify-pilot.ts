import { loadEnvConfig } from "@next/env";
import { BusinessCatalog } from "../lib/business-catalog";
import { PILOT } from "../lib/overture";
loadEnvConfig(process.cwd());
const db = new BusinessCatalog();
try {
  const [west, south, east, north] = PILOT.bounds;
  const result = db.get([south, west, north, east]);
  if (!result.businesses.length)
    throw new Error("Ingen virksomheder fundet i pilotdatabasen.");
  const region = result.regions.find((r) => r.id === PILOT.id);
  if (!region) throw new Error("Pilotområdets proveniens mangler.");
  console.log(
    JSON.stringify({
      region: region.name,
      businessesShown: result.businesses.length,
      limited: result.limited,
      release: region.release,
      importedAt: region.importedAt,
      database: "sqlite",
    }),
  );
  if (process.env.WEBHUNT_CATALOG_BACKEND === "supabase") {
    console.error(
      "Appen er konfigureret til Supabase. Data er hentet lokalt; katalogets SQL-import mangler stadig.",
    );
    process.exitCode = 2;
  } else {
    console.log(
      "Pilotdata er gemt i egen database. Genindlæs WebHunt for at vise virksomhederne.",
    );
  }
} finally {
  db.close();
}
