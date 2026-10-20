import { Resolver } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { publicWebsite } from "./analysis";
export function publicIp(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0 || b === 2)) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) ||
      (a === 203 && b === 0)
    );
  }
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    return (
      /^[23][0-9a-f]{0,3}:/.test(lower) &&
      !lower.startsWith("2001:db8:") &&
      !(
        lower.startsWith("2001:") &&
        parseInt(lower.split(":")[1] || "0", 16) <= 0x1ff
      ) &&
      !lower.startsWith("2002:") &&
      !lower.startsWith("3fff:")
    );
  }
  return false;
}
export async function resolvePublic(url: string) {
  const valid = publicWebsite(url);
  if (!valid) throw new Error("Usikker eller ugyldig URL.");
  const u = new URL(valid);
  const resolver = new Resolver({ timeout: 2000, tries: 2 });
  const timeout = setTimeout(() => resolver.cancel(), 8000);
  let results: PromiseSettledResult<string[]>[];
  try {
    results = await Promise.allSettled([
      resolver.resolve4(u.hostname),
      resolver.resolve6(u.hostname),
    ]);
  } finally {
    clearTimeout(timeout);
  }
  const addresses = results.flatMap((r, i) =>
    r.status === "fulfilled"
      ? r.value.map((address) => ({ address, family: i === 0 ? 4 : 6 }))
      : [],
  );
  if (!addresses.length) {
    const missing = results.every(
      (r) =>
        r.status === "rejected" &&
        ["ENOTFOUND", "ENODATA"].includes(r.reason?.code),
    );
    throw Object.assign(
      new Error(
        missing
          ? "Ingen offentlige A-/AAAA-adresser fundet."
          : "DNS-kontrollen kunne ikke gennemføres.",
      ),
      { code: missing ? "ENOTFOUND" : "EDNSFAIL" },
    );
  }
  if (!addresses.length || addresses.some((a) => !publicIp(a.address)))
    throw new Error("Domænet peger på en privat eller reserveret adresse.");
  return { url: u, addresses };
}
export type PageResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
  url: string;
};
/** Pins the validated address for the actual TCP connection; redirects are validated separately. */
export async function pinnedGet(
  target: string,
  limit = 512_000,
): Promise<PageResponse> {
  // Never silently bypass the cloud proxy or claim DNS pinning across a proxy tunnel.
  if (
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.https_proxy ||
    process.env.http_proxy
  )
    throw new Error(
      "Direkte HTTP-kontrol er ikke kørt: serverproxyens DNS-binding kan ikke sikres. En sikker direkte forbindelse er påkrævet til robot- og HTTP-kontrol.",
    );
  const { url, addresses } = await resolvePublic(target),
    ip = addresses[0];
  return new Promise((resolve, reject) => {
    const req = (url.protocol === "https:" ? httpsRequest : httpRequest)(
      url,
      {
        method: "GET",
        agent: false,
        lookup: (_hostname, opts, cb) => {
          if (typeof opts === "object" && opts.all) cb(null, [ip]);
          else cb(null, ip.address, ip.family);
        },
        headers: {
          "User-Agent":
            "WebHunt/1.0 (+https://github.com/antonfrederik101-ux/WebHunt)",
          Accept: "text/html,text/plain;q=0.9,*/*;q=0.1",
          "Accept-Encoding": "identity",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        res.on("data", (chunk) => {
          bytes += chunk.length;
          if (bytes > limit) {
            req.destroy(new Error("Svaret overstiger kontrolgrænsen."));
            return;
          }
          chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () =>
          resolve({
            status: res.statusCode || 0,
            url: url.href,
            headers: Object.fromEntries(
              Object.entries(res.headers).map(([k, v]) => [
                k,
                Array.isArray(v) ? v.join(",") : v || "",
              ]),
            ),
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    const timer = setTimeout(
      () => req.destroy(new Error("HTTP-kontrollen overskred 12 sekunder.")),
      12000,
    );
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject);
    req.end();
  });
}
export function robotsAllows(body: string, path: string) {
  const groups: {
    agents: string[];
    rules: { allow: boolean; pattern: string }[];
  }[] = [];
  let group:
    | { agents: string[]; rules: { allow: boolean; pattern: string }[] }
    | undefined;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase(),
      value = line.slice(i + 1).trim();
    if (key === "user-agent") {
      if (!group || group.rules.length) {
        group = { agents: [], rules: [] };
        groups.push(group);
      }
      group.agents.push(value.toLowerCase());
    } else if (group && (key === "allow" || key === "disallow") && value)
      group.rules.push({ allow: key === "allow", pattern: value });
  }
  const specific = groups.filter((g) =>
    g.agents.some((a) => a !== "*" && "webhunt".startsWith(a)),
  );
  const rules = (
    specific.length ? specific : groups.filter((g) => g.agents.includes("*"))
  ).flatMap((g) => g.rules);
  const matched = rules
    .filter((r) => {
      const end = r.pattern.endsWith("$");
      const p = (end ? r.pattern.slice(0, -1) : r.pattern)
        .split("*")
        .map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*");
      return new RegExp("^" + p + (end ? "$" : "")).test(path);
    })
    .sort(
      (a, b) =>
        b.pattern.length - a.pattern.length ||
        Number(b.allow) - Number(a.allow),
    );
  return matched[0]?.allow ?? true;
}
