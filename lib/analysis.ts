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
type LighthouseResult = {
  categories?: Record<string, { score?: number | null }>;
  audits?: Record<string, { score?: number | null; title: string }>;
  finalUrl?: string;
  finalDisplayedUrl?: string;
};
export function summarizeLighthouse(lh: LighthouseResult, url: string) {
  const cat = (key: string): number | null =>
    typeof lh.categories?.[key]?.score === "number" &&
    Number.isFinite(lh.categories[key].score) &&
    lh.categories[key].score! >= 0 &&
    lh.categories[key].score! <= 1
      ? Math.round(lh.categories![key].score! * 100)
      : null;
  const performance = cat("performance"),
    seo = cat("seo"),
    accessibility = cat("accessibility");
  if (performance === null)
    throw new Error("Analysen returnerede ingen performancescore.");
  const https = (lh.finalDisplayedUrl || lh.finalUrl || url).startsWith(
    "https:",
  );
  const findings: string[] = [];
  if (performance < 90)
    findings.push(
      `Mobilperformance er ${performance}/100. Undersøg store billeder, JavaScript og svartider.`,
    );
  if (seo !== null && seo < 90)
    findings.push(
      `SEO er ${seo}/100. Gennemgå sidetitler, beskrivelser og crawlbarhed.`,
    );
  if (accessibility !== null && accessibility < 90)
    findings.push(
      `Tilgængelighed er ${accessibility}/100. Gennemgå kontrast, labels og tastaturnavigation.`,
    );
  if (!https) findings.push("Den analyserede side bruger ikke HTTPS.");
  for (const key of ["viewport", "document-title", "meta-description"])
    if (lh.audits?.[key]?.score === 0) findings.push(lh.audits[key].title);
  if (!findings.length)
    findings.push(
      "Analysen fandt ingen større problemer i de valgte tekniske kategorier.",
    );
  const values = [performance, seo, accessibility].filter(
    (v): v is number => v !== null,
  );
  const score = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  return {
    score,
    performance,
    seo,
    accessibility,
    https,
    findings,
    checkedAt: new Date().toISOString(),
    url,
    status: score >= 85 && https ? ("good" as const) : ("improve" as const),
  };
}
