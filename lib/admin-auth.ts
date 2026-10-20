import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
export function adminAuthorized(request: Request) {
  let secret = process.env.WEBHUNT_ADMIN_TOKEN || "";
  if (!secret)
    try {
      secret = readFileSync(
        path.join(process.cwd(), ".data/admin-token"),
        "utf8",
      ).trim();
    } catch {}
  const candidate =
    request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (secret.length < 32 || candidate.length !== secret.length) return false;
  const expected = Buffer.from(secret),
    supplied = Buffer.from(candidate);
  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}
