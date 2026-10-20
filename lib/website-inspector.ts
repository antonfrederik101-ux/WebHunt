import { createHash } from "node:crypto";
import { setTimeout as pause } from "node:timers/promises";
import {
  publicWebsite,
  summarizeLighthouse,
  type LighthouseResult,
} from "./analysis";
import {
  pinnedGet,
  resolvePublic,
  robotsAllows,
  type PageResponse,
} from "./safe-http";
import type { WebsiteEvidence } from "./verification-types";
import type { VerificationStore } from "./verification-store";
export type InspectorDependencies = {
  get?: (url: string, limit?: number) => Promise<PageResponse>;
  resolve?: (url: string) => Promise<unknown>;
  lighthouse?: (url: string) => Promise<LighthouseResult>;
  wait?: (ms: number) => Promise<unknown>;
};
export async function pageSpeed(
  url: string,
  timeout = 100000,
): Promise<LighthouseResult> {
  const u = new URL(
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
  );
  u.searchParams.set("url", url);
  u.searchParams.set("strategy", "mobile");
  for (const category of [
    "performance",
    "accessibility",
    "seo",
    "best-practices",
  ])
    u.searchParams.append("category", category);
  if (process.env.PAGESPEED_API_KEY)
    u.searchParams.set("key", process.env.PAGESPEED_API_KEY);
  const r = await fetch(u, {
    signal: AbortSignal.timeout(Math.max(1, timeout)),
    redirect: "error",
  });
  if (r.status === 429 || r.status === 503)
    throw new Deferred(
      retryAt(r.headers.get("retry-after") || undefined),
      "PageSpeed er midlertidigt utilgængelig eller kvoten er opbrugt. Ingen score er beregnet.",
      true,
    );
  if (!r.ok)
    throw new Error(
      `PageSpeed svarede HTTP ${r.status}. Ingen score er beregnet.`,
    );
  const body = await r.json();
  if (!body.lighthouseResult || body.lighthouseResult.runtimeError)
    throw new Error("PageSpeed kunne ikke gennemføre målingen.");
  return body.lighthouseResult;
}
class Deferred extends Error {
  constructor(
    readonly retryAt: string,
    message: string,
    readonly pageSpeedProvider = false,
  ) {
    super(message);
  }
}
function retryAt(value: string | undefined) {
  const seconds = Number(value);
  const date = Date.parse(value || "");
  return new Date(
    Number.isFinite(seconds) && seconds > 0
      ? Date.now() + seconds * 1000
      : Number.isFinite(date) && date > Date.now()
        ? date
        : Date.now() + 60000,
  ).toISOString();
}
export async function inspectWebsite(
  input: string,
  store: VerificationStore,
  deps: InspectorDependencies = {},
): Promise<WebsiteEvidence> {
  const url = publicWebsite(input);
  if (!url) throw new Error("Usikker eller ugyldig hjemmesideadresse.");
  const key = "website-v2:" + createHash("sha256").update(url).digest("hex");
  const cached = store.cache<WebsiteEvidence>(key);
  if (cached) return cached;
  const deadline = Date.now() + 150000;
  const checkDeadline = () => {
    if (Date.now() >= deadline)
      throw new Error(
        "Kontrollens samlede tidsgrænse på 150 sekunder blev nået.",
      );
  };
  const get = deps.get || pinnedGet,
    resolve = deps.resolve || resolvePublic,
    wait = deps.wait || pause;
  const result: WebsiteEvidence = {
    url,
    checkedAt: new Date().toISOString(),
    state: "failed",
    reason: "",
    issues: [],
  };
  const origins = new Map<string, string>();
  const request = async (target: string, limit?: number) => {
    checkDeadline();
    const origin = new URL(target).origin;
    let reserved = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      const at = store.cache<number>("origin-next:" + origin);
      if (at && at > Date.now()) {
        if (at - Date.now() > 2000)
          throw new Deferred(
            new Date(at).toISOString(),
            "Kildens foreskrevne ventetid respekteres.",
          );
        await wait(Math.max(0, at - Date.now()));
      }
      reserved = store.reserveOrigin(origin, Date.now() + 1000);
      if (reserved) break;
    }
    if (!reserved)
      throw new Deferred(
        new Date(Date.now() + 1000).toISOString(),
        "En anden worker kontrollerer allerede dette domæne.",
      );
    const r = await get(target, limit);
    if (r.status === 429 || r.status === 503) {
      const at = retryAt(r.headers["retry-after"]);
      store.putCache(
        "origin-next:" + origin,
        Date.parse(at),
        Date.parse(at) - Date.now(),
      );
      throw new Deferred(at, `HTTP ${r.status}; Retry-After respekteres.`);
    }
    return r;
  };
  const allowed = async (target: string) => {
    const u = new URL(target);
    if (!origins.has(u.origin)) {
      const robots = await request(u.origin + "/robots.txt", 200000);
      if (robots.status === 401 || robots.status === 403)
        throw new Error("robots.txt afviser adgang.");
      if (
        robots.status >= 300 &&
        robots.status !== 404 &&
        robots.status !== 410
      )
        throw new Error(
          "robots.txt kunne ikke afklares sikkert; crawl er ikke udført.",
        );
      const body = robots.status === 200 ? robots.body : "";
      origins.set(u.origin, body);
      const delay = Number(/crawl-delay:\s*(\d+(?:\.\d+)?)/i.exec(body)?.[1]);
      if (delay > 1)
        store.putCache(
          "origin-next:" + u.origin,
          Date.now() + delay * 1000,
          delay * 1000,
        );
    }
    if (!robotsAllows(origins.get(u.origin)!, u.pathname + u.search))
      throw new Error(
        "robots.txt tillader ikke WebHunts adgang til denne sti.",
      );
  };
  try {
    checkDeadline();
    await resolve(url);
    result.dns = "resolved";
    let current = url;
    const redirects: string[] = [];
    let page: PageResponse | undefined;
    try {
      for (let hop = 0; hop <= 4; hop++) {
        await resolve(current);
        await allowed(current);
        page = await request(current);
        if (page.status >= 300 && page.status < 400 && page.headers.location) {
          if (hop === 4) throw new Error("For mange redirects.");
          const next = new URL(page.headers.location, current).href;
          if (!publicWebsite(next))
            throw new Error("Redirect til usikker adresse er afvist.");
          redirects.push(next);
          current = next;
          continue;
        }
        break;
      }
    } catch (e) {
      if (e instanceof Deferred) throw e;
      // Do not fall back to an external fetch when the site's robots policy
      // or safe transport could not be checked.
      throw e;
    }
    result.finalUrl = current;
    result.redirects = redirects;
    if (page) {
      result.httpStatus = page.status;
      if (page.status === 404 || page.status === 410) {
        result.reason = `HTTP ${page.status} registreret. En enkelt fejl er ikke tilstrækkelig til orange, og betyder ikke at virksomheden er lukket.`;
        result.issues.push(result.reason);
      } else if (page.status < 200 || page.status >= 400)
        throw new Error(
          `HTTP ${page.status}. Ingen kvalitetsscore er beregnet.`,
        );
    }
    if (!page || (page.status >= 200 && page.status < 300)) {
      if (page && !/text\/html/i.test(page.headers["content-type"] || ""))
        throw new Error("Slutadressen returnerede ikke en HTML-hjemmeside.");
      const providerWait = store.cache<string>("pagespeed-next");
      if (providerWait && Date.parse(providerWait) > Date.now())
        throw new Deferred(
          providerWait,
          "PageSpeed venter efter udbyderens seneste svar.",
          true,
        );
      checkDeadline();
      const lh = await (
        deps.lighthouse ||
        ((url: string) =>
          pageSpeed(url, Math.min(100000, deadline - Date.now())))
      )(current);
      const final = lh.finalDisplayedUrl || lh.finalUrl || current;
      await resolve(final);
      const analysis = summarizeLighthouse(lh, url);
      result.analysis = analysis;
      if (page) {
        const html = page.body.replace(
          /<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi,
          "",
        );
        const candidates = [
          ...html.matchAll(/<a\b[^>]*?\bhref\s*=\s*["']([^"'#]+)["']/gi),
        ].flatMap((m) => {
          try {
            const u = new URL(m[1].replaceAll("&amp;", "&"), current);
            return u.origin === new URL(current).origin &&
              publicWebsite(u.href) &&
              u.href !== current
              ? [u.href]
              : [];
          } catch {
            return [];
          }
        });
        result.checkedLinks = [];
        for (const link of [...new Set(candidates)].slice(0, 3)) {
          await allowed(link);
          const r = await request(link, 512000);
          result.checkedLinks.push({ url: link, status: r.status });
          if (r.status === 404 || r.status === 410)
            result.issues.push(
              `Internt link returnerede HTTP ${r.status}: ${link}`,
            );
        }
        if (
          result.issues.some((x) => x.startsWith("Internt link")) &&
          analysis.score !== null
        ) {
          analysis.status = "improve";
          analysis.findings.push(
            ...result.issues.filter((x) => x.startsWith("Internt link")),
          );
        }
      }
      result.state = analysis.score === null ? "failed" : "checked";
      result.reason =
        analysis.score === null
          ? "Lighthouse mangler nødvendige målinger. Ingen samlet score."
          : "Serverbaseret mobilkontrol gennemført. Teknisk score; visuelt design og alle interaktive navigationsflows er ikke verificeret.";
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOTFOUND")
      result.dns = "not_found";
    if (e instanceof Deferred) {
      if (e.pageSpeedProvider)
        store.putCache(
          "pagespeed-next",
          e.retryAt,
          Math.max(1000, Date.parse(e.retryAt) - Date.now()),
        );
      result.state = "deferred";
      result.retryAt = e.retryAt;
    } else
      result.state = /robots\.txt/.test((e as Error).message)
        ? "blocked"
        : "failed";
    result.reason = (e as Error).message;
    result.analysis = undefined;
  }
  if (!result.dns) result.dns = "failed";
  // Temporary failures have a bounded retry window; successful checks are cached for a day.
  store.putCache(
    key,
    result,
    result.state === "deferred"
      ? Math.max(1000, Date.parse(result.retryAt!) - Date.now())
      : result.state === "checked"
        ? 86400_000
        : 3600_000,
  );
  return result;
}
