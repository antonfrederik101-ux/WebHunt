import { publicWebsite } from "./analysis";
import { confirmedActive } from "./verification-types";
import { websiteDetails } from "./websites";
import { categories, type Business, type Analysis, type Status } from "./types";
export function usableAnalysis(a: Analysis | undefined, url: string) {
  const at = Date.parse(a?.checkedAt || "");
  return (
    a?.model === "webhunt-tech-v2" &&
    a.score !== null &&
    Number.isFinite(a.score) &&
    a.score >= 0 &&
    a.score <= 100 &&
    [a.performance, a.accessibility, a.seo, a.bestPractices].every(
      (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100,
    ) &&
    typeof a.mobile === "boolean" &&
    publicWebsite(a.url) === publicWebsite(url) &&
    Date.now() - at >= 0 &&
    Date.now() - at < 7 * 86400_000
  );
}
/** A personal saved rating is retained, but cannot certify activity or substitute measurements. */
export function presentBusiness(
  business: Business,
  _override?: Status,
  personalAnalysis?: Analysis,
): Business {
  const links = websiteDetails(
    business.verification?.website?.url || business.website,
    business.socialProfiles,
  );
  const v = business.verification;
  const candidate = usableAnalysis(personalAnalysis, links.website)
    ? personalAnalysis
    : v?.website?.analysis;
  const latestFailure =
    v?.website &&
    ["failed", "blocked", "deferred"].includes(v.website.state) &&
    Date.parse(v.website.checkedAt) >= Date.parse(candidate?.checkedAt || "");
  const a = latestFailure ? undefined : candidate;
  let status: Status = "unknown";
  if (confirmedActive(business) && !v?.duplicateOf) {
    if (!links.website && v?.websiteSearch?.complete) status = "missing";
    else if (usableAnalysis(a, links.website) && a) status = a.status;
    else if (v?.website?.issues.some((x) => x.startsWith("Vedvarende HTTP")))
      status = "improve";
  }
  return {
    ...business,
    ...links,
    category:
      categories[business.category] ||
      categories[business.category.replaceAll(" ", "_")] ||
      business.category,
    status,
    statusOrigin:
      status === "unknown"
        ? "unchecked"
        : status === "missing"
          ? "registration"
          : "assessment",
  };
}
export function statusEvidence(
  business: Business,
  override?: Status,
  analysis?: Analysis,
) {
  const b = presentBusiness(business, override, analysis),
    v = b.verification;
  if (!confirmedActive(b))
    return {
      kind: "Virksomhedsstatus ikke bekræftet",
      reason:
        v?.identity.reason ||
        "Aktivitet er ikke kontrolleret i en pålidelig kilde. En manglende webadresse giver ikke alene en rød salgsmulighed.",
      confidence:
        "Gemte personlige vurderinger bevares separat. De bekræfter ikke virksomhedens aktivitet.",
      checkedAt: v?.identity.checkedAt || undefined,
    };
  if (b.status === "missing")
    return {
      kind: "Aktiv virksomhed · registreringsoplysning",
      reason: b.socialProfiles?.length
        ? "Kun sociale profiler er fundet i de gennemgåede kilder, ingen selvstændig hjemmeside."
        : "Ingen selvstændig hjemmeside registreret i de gennemgåede import-/virksomhedskilder.",
      confidence:
        "Søgningen er kildebegrænset, ikke bevis for at en hjemmeside ikke findes.",
      checkedAt: v?.websiteSearch?.checkedAt,
    };
  const a = usableAnalysis(analysis, b.website)
    ? analysis
    : v?.website?.analysis;
  if (a && a.score !== null && b.status !== "unknown")
    return {
      kind: "Serverbaseret teknisk kontrol",
      reason: `Teknisk score ${a.score}/100. ${a.findings.join(" ")}`,
      confidence:
        "Vægtet Lighthouse-måling. Visuelt design og komplette navigationsflows er ikke automatisk verificeret.",
      checkedAt: a.checkedAt,
    };
  return {
    kind:
      b.status === "improve"
        ? "Dokumenteret teknisk fejl"
        : "Afventer pålidelig hjemmesidekontrol",
    reason:
      v?.website?.reason ||
      "Virksomhedens aktivitet er bekræftet, men hjemmesiden er ikke tilstrækkeligt undersøgt.",
    confidence:
      "Timeout, HTTP 200 eller en personlig farve giver ikke alene en automatisk kvalitetsvurdering.",
    checkedAt: v?.website?.checkedAt,
  };
}
