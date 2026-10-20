import { websiteDetails } from "./websites";
import { categories, type Business, type Analysis, type Status } from "./types";

/** Presentation only: never rewrites imported data or a user's saved assessment. */
export function presentBusiness(
  business: Business,
  override?: Status,
): Business {
  const links = websiteDetails(business.website, business.socialProfiles);
  const registered = links.website ? "unknown" : "missing";
  const existingAssessment =
    business.statusOrigin === "assessment" ||
    (!business.statusOrigin && business.status !== "unknown");
  const assessed = override !== undefined || existingAssessment;
  return {
    ...business,
    ...links,
    category:
      categories[business.category] ||
      categories[business.category.replaceAll(" ", "_")] ||
      business.category,
    status: override ?? (existingAssessment ? business.status : registered),
    statusOrigin: assessed
      ? "assessment"
      : registered === "missing"
        ? "registration"
        : "unchecked",
  };
}
export function statusEvidence(
  business: Business,
  override?: Status,
  analysis?: Analysis,
) {
  const b = presentBusiness(business, override);
  if (b.statusOrigin === "assessment") {
    if (analysis && analysis.status === b.status)
      return {
        kind: "Teknisk måling",
        reason: `Teknisk score ${analysis.score}/100. ${analysis.findings.join(" ")}`,
        checkedAt: analysis.checkedAt,
        confidence:
          "Automatisk teknisk måling; design og virksomhedsaktivitet er ikke verificeret.",
      };
    return {
      kind: "Din vurdering",
      reason:
        "Status er gemt som en personlig vurdering. Den ændres ikke af registreringsoplysningerne.",
      confidence: "Manuelt valgt; ingen ny automatisk kontrol er udført.",
      checkedAt: undefined,
    };
  }
  if (b.status === "missing")
    return {
      kind: "Registreringsoplysning",
      reason: b.socialProfiles?.length
        ? "Der er kun registreret sociale profiler, ingen selvstændig hjemmeside."
        : "Ingen registreret hjemmeside fundet i de indlæste kildedata.",
      confidence:
        "Det er ikke bevis for, at virksomheden mangler en hjemmeside. Virksomheden kan stadig være aktiv.",
      checkedAt: undefined,
    };
  return {
    kind: "Ikke kontrolleret",
    reason:
      "Der er en registreret hjemmeside, men ingen gennemført eller gemt vurdering.",
    confidence:
      "Hjemmesidens kvalitet og tilgængelighed er endnu ikke afklaret.",
    checkedAt: undefined,
  };
}
