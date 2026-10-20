import { readFile, writeFile } from "node:fs/promises";
// Generates a single reviewable SQL file; no administrative credentials in the app.
const input = process.argv[2] || "data/overture/nykoebing-falster.json";
const snapshot = JSON.parse(await readFile(input, "utf8"));
if (snapshot.version !== 1 || !snapshot.records?.length)
  throw new Error("No validated import snapshot");
const schema = await readFile("supabase/business-catalog.sql", "utf8");
const output = process.argv[3] || ".data/imports/install-catalog.sql";
await writeFile(
  output,
  `BEGIN;\nSET LOCAL standard_conforming_strings=on;\n${schema}\nSELECT public.webhunt_import_region('${JSON.stringify(snapshot).replaceAll("'", "''")}'::jsonb);\nCOMMIT;\n`,
);
console.log(`SQL klar: ${output} (${snapshot.records.length} virksomheder)`);
