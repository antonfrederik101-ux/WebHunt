// Reuse a completed local Overture download. No network access or Python required.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, ".data", "imports");
let candidates;
try {
  candidates = readdirSync(directory)
    .map((file) => ({
      file,
      release: /^nykoebing-falster-(\d{4}-\d{2}-\d{2}\.\d+)\.geojson$/.exec(
        file,
      )?.[1],
    }))
    .filter((entry) => entry.release)
    .sort((a, b) =>
      b.release.localeCompare(a.release, "en", { numeric: true }),
    );
} catch {
  console.error(
    "Der findes endnu ikke et hentet pilotudtræk. Eksisterende data er bevaret.",
  );
  process.exit(1);
}
const snapshot = candidates[0];
if (!snapshot) {
  console.error(
    "Der findes endnu ikke et hentet pilotudtræk. Eksisterende data er bevaret.",
  );
  process.exit(1);
}
console.log(
  `Genbruger Overture ${snapshot.release}. Der hentes ingen nye data.`,
);
for (const args of [
  [
    "scripts/import-places.ts",
    "--input",
    path.join(directory, snapshot.file),
    "--release",
    snapshot.release,
    "--publish-seed",
  ],
  ["scripts/verify-pilot.ts"],
]) {
  const result = spawnSync(
    process.execPath,
    ["--use-env-proxy", "--import", "tsx", ...args],
    { cwd: root, stdio: "inherit" },
  );
  if (result.error) {
    console.error("Importprocessen kunne ikke startes.");
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
