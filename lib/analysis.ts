export function publicWebsite(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  try {
    const u = new URL(value);
    const h = u.hostname.toLowerCase();
    if (
      !["https:", "http:"].includes(u.protocol) ||
      u.username ||
      u.password ||
      u.port ||
      !h.includes(".") ||
      h === "localhost" ||
      h.endsWith(".local") ||
      h.endsWith(".internal") ||
      h.includes(":") ||
      /^\d+\./.test(h) ||
      h.endsWith(".localhost")
    )
      return null;
    return u.href;
  } catch {
    return null;
  }
}
export type LighthouseResult = {
  categories?: Record<string, { score?: number | null }>;
  audits?: Record<string, { score?: number | null; title?: string }>;
  finalUrl?: string;
  finalDisplayedUrl?: string;
};
export function summarizeLighthouse(lh: LighthouseResult, url: string) {
  const cat = (key: string): number | null => {
    const value = lh.categories?.[key]?.score;
    return typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 1
      ? Math.round(value * 100)
      : null;
  };
  const performance = cat("performance"),
    accessibility = cat("accessibility"),
    seo = cat("seo"),
    bestPractices = cat("best-practices");
  const viewport =
    lh.audits?.["viewport"]?.score ?? lh.audits?.["meta-viewport"]?.score;
  const mobile = viewport === 1 ? true : viewport === 0 ? false : null;
  const https = (lh.finalDisplayedUrl || lh.finalUrl || url).startsWith(
    "https:",
  );
  const httpPassed = lh.audits?.["http-status-code"]?.score === 1;
  const complete =
    [performance, accessibility, seo, bestPractices].every((v) => v !== null) &&
    mobile !== null &&
    httpPassed;
  const findings: string[] = [];
  if (performance !== null && performance < 80)
    findings.push(`Mobilperformance er ${performance}/100.`);
  if (accessibility !== null && accessibility < 90)
    findings.push(`Tilgængelighed er ${accessibility}/100.`);
  if (seo !== null && seo < 80) findings.push(`SEO er ${seo}/100.`);
  if (bestPractices !== null && bestPractices < 90)
    findings.push(`Tekniske best practices er ${bestPractices}/100.`);
  if (mobile === false)
    findings.push(
      "Lighthouse fandt en fejl i mobilens viewport-konfiguration.",
    );
  if (!https) findings.push("Slutadressen anvender ikke HTTPS.");
  if (!complete)
    findings.push(
      "Nødvendige målinger mangler. Ingen samlet score eller farvevurdering er beregnet.",
    );
  if (!findings.length)
    findings.push(
      "Ingen væsentlige problemer fundet i de målte tekniske kategorier.",
    );
  const score = complete
    ? Math.round(
        performance! * 0.35 +
          accessibility! * 0.25 +
          seo! * 0.15 +
          bestPractices! * 0.15 +
          (mobile ? 100 : 0) * 0.1,
      )
    : null;
  const good =
    score !== null &&
    score >= 80 &&
    performance! >= 80 &&
    accessibility! >= 90 &&
    seo! >= 80 &&
    bestPractices! >= 90 &&
    mobile &&
    https;
  return {
    model: "webhunt-tech-v2",
    score,
    performance,
    accessibility,
    seo,
    bestPractices,
    mobile,
    https,
    findings,
    checkedAt: new Date().toISOString(),
    url,
    status:
      score === null
        ? ("unknown" as const)
        : good
          ? ("good" as const)
          : ("improve" as const),
    coverage: [
      "Performance 35%",
      "Tilgængelighed 25%",
      "SEO 15%",
      "Best practices 15%",
      "Mobil viewport 10%",
      "Visuelt design og komplette navigationsflows er ikke automatisk vurderet",
    ],
  };
}
