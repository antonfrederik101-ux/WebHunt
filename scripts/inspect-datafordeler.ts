import { loadEnvConfig } from "@next/env";
import { inspectDatafordelerSchema } from "../lib/cvr-schema-sample";
loadEnvConfig(process.cwd());
async function main() {
  const key = process.env.DATAFORDELER_API_KEY?.trim();
  if (!key || process.argv.length > 2) {
    console.error(
      "Gem DATAFORDELER_API_KEY i servermiljøet. Ingen nøgle som kommandolinjeargument; ingen forespørgsel er sendt.",
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    "Undersøger et begrænset CVREnhed-udsnit. Ingen databaseændring eller lagring af virksomhedsdata.",
  );
  const result = await inspectDatafordelerSchema(key);
  // Also redact the exact key if an upstream property name unexpectedly contains it.
  console.log(JSON.stringify(result, null, 2).replaceAll(key, "[redacted]"));
  if (result.outcome !== "schema_found") process.exitCode = 1;
}
main().catch(() => {
  console.error("Skemaprøven kunne ikke køres. Ingen nøgle vises.");
  process.exitCode = 1;
});
