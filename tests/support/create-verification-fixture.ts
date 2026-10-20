// Temporary integration data only. Never imports into the project's .data directory.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { BusinessCatalog } from "../../lib/business-catalog";
import { PILOT, prepareSnapshot } from "../../lib/overture";
import { recordHash } from "../../lib/verification-store";
const dir = mkdtempSync(path.join(tmpdir(), "webhunt-browser-verification-")),
  file = path.join(dir, "catalog.sqlite");
const records = ["a", "b", "c"].map((id) => ({
  id: "browser-" + id,
  geometry: { type: "Point", coordinates: [11.8743, 54.7691] },
  properties: {
    names: { primary: "Kontrolfixture " + id.toUpperCase() },
    basic_category: "hair_salon",
    addresses: [
      {
        country: "DK",
        freeform: "Testvej 1",
        postcode: "4800",
        locality: "Nykøbing Falster",
      },
    ],
    sources: [{ dataset: "metaPlaces" }],
  },
}));
const db = new BusinessCatalog(file);
const snapshot = prepareSnapshot(records, PILOT, "2026-09-23.1");
db.import(snapshot);
const b = snapshot.records[1];
db.verification.save(b, {
  recordHash: recordHash(b),
  identity: {
    state: "closed",
    source: "Kontrolleret browserfixture",
    checkedAt: new Date().toISOString(),
    reason: "Lukning er registreret i denne isolerede testfixture.",
  },
});
db.close();
console.log(file);
