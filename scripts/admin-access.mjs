import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
mkdirSync(".data", { recursive: true });
if (!process.env.WEBHUNT_ADMIN_TOKEN && !existsSync(".data/admin-token"))
  writeFileSync(".data/admin-token", randomBytes(32).toString("hex"), {
    flag: "wx",
    mode: 0o600,
  });
const token =
  process.env.WEBHUNT_ADMIN_TOKEN ||
  readFileSync(".data/admin-token", "utf8").trim();
console.log(
  "Åbn /admin på WebHunts previewadresse. Indsæt denne private adgangsnøgle i feltet. Del ikke nøglen eller et billede af den i chatten:",
);
console.log(token);
