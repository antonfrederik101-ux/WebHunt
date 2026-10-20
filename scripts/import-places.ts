import { loadEnvConfig } from "@next/env";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { BusinessCatalog } from "../lib/business-catalog";
import {
  PILOT,
  prepareSnapshot,
  type PlaceFeature,
  type Region,
} from "../lib/overture";

loadEnvConfig(process.cwd());
const args = process.argv.slice(2);
const value = (name: string) => {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1] || args[index + 1].startsWith("--"))
    throw new Error(`Manglende værdi: ${name}`);
  return args[index + 1];
};
async function main() {
  if (!args.includes("--input") || !args.includes("--release"))
    throw new Error(
      "Brug --input <Overture GeoJSON> --release <YYYY-MM-DD.N> [--region <id> --name <navn> --bounds <vest,syd,øst,nord>] [--publish-seed]",
    );
  const region: Region = args.includes("--region")
    ? {
        id: value("--region"),
        name: value("--name"),
        bounds: value("--bounds")?.split(",").map(Number) as Region["bounds"],
      }
    : PILOT;
  if (
    !/^[a-z0-9-]{1,60}$/.test(region.id) ||
    !region.name ||
    region.bounds?.length !== 4 ||
    region.bounds.some((v) => !Number.isFinite(v)) ||
    region.bounds[0] >= region.bounds[2] ||
    region.bounds[1] >= region.bounds[3] ||
    region.bounds[0] < 7.8 ||
    region.bounds[2] > 15.3 ||
    region.bounds[1] < 54.4 ||
    region.bounds[3] > 57.9
  )
    throw new Error("Ugyldigt dansk importområde.");
  if (args.includes("--publish-seed") && region.id !== PILOT.id)
    throw new Error(
      "Kun den afgrænsede pilot må inkluderes som opstartsdata i Git.",
    );
  const raw = await readFile(value("--input"));
  const input = JSON.parse(raw.toString()) as {
    type: string;
    features: PlaceFeature[];
  };
  if (input.type !== "FeatureCollection" || !Array.isArray(input.features))
    throw new Error("Forventede Overture GeoJSON FeatureCollection.");
  const snapshot = prepareSnapshot(input.features, region, value("--release"));
  const dir = path.join(process.cwd(), ".data", "imports");
  await mkdir(dir, { recursive: true });
  const snapshotFile = path.join(dir, region.id + ".json");
  const db = new BusinessCatalog();
  try {
    db.import(snapshot);
  } finally {
    db.close();
  }
  await writeFile(snapshotFile, JSON.stringify(snapshot, null, 2));
  if (args.includes("--publish-seed")) {
    if (region.id !== PILOT.id)
      throw new Error(
        "Kun den afgrænsede pilot må inkluderes som opstartsdata i Git.",
      );
    await writeFile(
      "data/overture/nykoebing-falster.json",
      JSON.stringify(snapshot, null, 2),
    );
  }
  console.log(
    JSON.stringify({
      region: region.name,
      release: snapshot.release,
      count: snapshot.records.length,
      rejected: snapshot.rejected,
      sha256: createHash("sha256").update(raw).digest("hex"),
      importedAt: snapshot.importedAt,
    }),
  );
}
main().catch((e) => {
  console.error((e as Error).message);
  process.exitCode = 1;
});
