import { loadEnvConfig } from "@next/env";
import { probeDatafordeler } from "../lib/datafordeler";

loadEnvConfig(process.cwd());
async function main() {
  if (process.argv.length > 2)
    throw new Error(
      "Brug miljøvariablen DATAFORDELER_API_KEY, ikke en nøgle som kommandolinjeargument.",
    );
  const key = process.env.DATAFORDELER_API_KEY || "";
  if (!key.trim())
    throw new Error(
      "DATAFORDELER_API_KEY mangler. Ingen forespørgsel er sendt.",
    );
  console.log(
    "Tester CVR-filadgang uden databaseændringer. Ingen API-nøgle eller fuld downloadadresse vises.",
  );
  const result = await probeDatafordeler(key);
  console.log(JSON.stringify(result, null, 2));
  if (result.outcome !== "file_available") process.exitCode = 1;
}
main().catch(() => {
  console.error(
    "Forbindelsestesten kunne ikke køres. Kontrollér DATAFORDELER_API_KEY i serverens miljø. Ingen nøgle vises.",
  );
  process.exitCode = 1;
});
