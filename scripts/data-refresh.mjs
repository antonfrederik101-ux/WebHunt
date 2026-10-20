import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
const python = ".data/import-venv/bin/python";
if (!existsSync(python)) {
  console.error("Importmiljø mangler. Kør npm run data:setup én gang.");
  process.exit(1);
}
const result = spawnSync(
  python,
  ["scripts/download-places.py", ...process.argv.slice(2)],
  { stdio: "inherit", timeout: 30 * 60 * 1000 },
);
process.exit(result.status ?? 1);
