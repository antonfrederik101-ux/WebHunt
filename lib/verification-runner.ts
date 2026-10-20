import { createHash } from "node:crypto";
import { presentBusiness } from "./business-status";
import {
  defaultIdentity,
  recordHash,
  VerificationStore,
} from "./verification-store";
import { confirmedActive } from "./verification-types";
import type { Business } from "./types";
import type { Verification, IdentityEvidence } from "./verification-types";
import { identityText, lookupCvr, matchCvr, type CvrRecord } from "./registry";
import { inspectWebsite } from "./website-inspector";
import { websiteDetails } from "./websites";
const duplicateGroups = new WeakMap<Business[], Map<string, Business[]>>();
const duplicateKey = (b: Business) =>
  [
    identityText(b.name),
    identityText(b.address),
    b.postcode,
    identityText(b.city),
  ].join("|");
export function duplicateOf(
  b: Business,
  records: Business[],
  activity?: (b: Business) => string | undefined,
): string | undefined {
  let groups = duplicateGroups.get(records);
  if (!groups) {
    groups = new Map();
    for (const r of records) {
      const k = duplicateKey(r);
      groups.set(k, [...(groups.get(k) || []), r]);
    }
    duplicateGroups.set(records, groups);
  }
  const site = websiteDetails(b.website).website,
    phone = b.phone.replace(/\D/g, "");
  const candidates = (groups.get(duplicateKey(b)) || []).filter(
    (x) =>
      x.id !== b.id &&
      Math.hypot(x.lat - b.lat, x.lon - b.lon) < 0.0007 &&
      ((!!b.cvr && /^\d{8}$/.test(b.cvr) && x.cvr === b.cvr) ||
        (!!site && websiteDetails(x.website).website === site) ||
        (phone.length >= 8 && x.phone.replace(/\D/g, "") === phone)),
  );
  const first = [b, ...candidates]
    .filter((x) => activity?.(x) !== "closed")
    .sort(
      (a, c) =>
        Number(activity?.(c) === "active") -
          Number(activity?.(a) === "active") || a.id.localeCompare(c.id),
    )[0];
  return first && first.id !== b.id ? first.id : undefined;
}
export async function verifyBusiness(
  b: Business,
  store: VerificationStore,
  all: Business[],
  options: {
    registry?: (b: Business) => Promise<CvrRecord[]>;
    inspect?: typeof inspectWebsite;
    cvrSource?: string;
    publicEvidence?: IdentityEvidence;
    identityOnly?: boolean;
  } = {},
): Promise<Verification> {
  const at = new Date().toISOString(),
    previous = store.get(b);
  let identity: IdentityEvidence = defaultIdentity(b),
    searchComplete = false;
  let records: CvrRecord[] = [];
  if (identity.state !== "missing_data")
    try {
      const key =
        "cvr-v1:" +
        createHash("sha256")
          .update(JSON.stringify([b.cvr || "", b.name, b.address, b.postcode]))
          .digest("hex");
      if (!options.registry && !process.env.CVR_USERNAME)
        throw new Error(
          "De åbne importoplysninger dokumenterer ikke virksomhedens aktuelle aktivitet. Et kildebelagt offentligt opslag kan registreres af administrator uden CVR-login.",
        );
      // A dated import is its own source. Never reuse a different export/live
      // lookup from the per-company cache or pass file evidence off as live data.
      records = options.registry
        ? await options.registry(b)
        : store.cache<CvrRecord[]>(key) || (await lookupCvr(b));
      if (!options.registry) store.putCache(key, records);
      identity = matchCvr(b, records, options.cvrSource);
      searchComplete =
        identity.state === "active" && identity.addressMatch === "same";
    } catch (e) {
      identity = {
        ...identity,
        checkedAt: at,
        source:
          options.registry || process.env.CVR_USERNAME
            ? "CVR-kontrol"
            : "Åbne importoplysninger · aktivitet uafklaret",
        reason: (e as Error).message,
      };
    }
  if (options.publicEvidence) {
    if (identity.state === "active")
      identity = {
        ...identity,
        state: "uncertain",
        reason:
          "Aktivitetsoplysninger og kortkildens lukningsregistrering er modstridende. Kræver manuel afklaring.",
      };
    else identity = options.publicEvidence;
  }
  if (
    !options.publicEvidence &&
    identity.state === "uncertain" &&
    previous &&
    confirmedActive({ ...b, verification: previous })
  ) {
    identity = {
      ...previous.identity,
      attempts: [
        ...(previous.identity.attempts || []).slice(-4),
        at +
          ": Genkontrol gav ingen ny afklaring; seneste stadig gyldige kildecheck bevares.",
      ],
    };
    searchComplete = previous.websiteSearch?.complete === true;
  }
  if (identity.state === "uncertain" && previous?.identity.state === "closed")
    identity = {
      ...previous.identity,
      attempts: [
        ...(previous.identity.attempts || []).slice(-4),
        at + ": Genkontrol kunne ikke afklare status. Lukningen bevares.",
      ],
    };
  const v: Verification = {
    recordHash: recordHash(b),
    identity,
    lastAttemptAt: at,
    duplicateOf:
      identity.state === "closed"
        ? undefined
        : duplicateOf(b, all, (candidate) =>
            candidate.id === b.id
              ? identity.state
              : store.get(candidate)?.identity.state,
          ),
  };
  if (v.duplicateOf) {
    v.identity = {
      ...identity,
      reason: `Sikkert dubletmatch med ${v.duplicateOf}. Den ekstra kortprik skjules; posten bevares.`,
    };
    return v;
  }
  const links = websiteDetails(
    [
      ...(identity.websiteCandidates || []),
      previous?.website?.url || "",
      b.website,
    ],
    b.socialProfiles,
  );
  v.websiteSearch = {
    complete: searchComplete,
    checkedAt: at,
    sources: [
      b.source || "Import",
      ...(searchComplete ? [identity.source] : []),
    ],
    reason: searchComplete
      ? "Kildebelagt identitetsmatch og registrerede hjemmesidefelter i kontrolkilden og importen gennemgået. Søgningen er begrænset til disse kilder; der udføres ikke udokumenteret webscraping."
      : "Hjemmesidesøgningen kan ikke afsluttes, før identiteten er afklaret i en pålidelig kilde.",
  };
  if (identity.state === "closed") return v;
  if (options.identityOnly) {
    // Source refresh must not discard a paid/slow website measurement or scan a site.
    v.website = previous?.website;
    return v;
  }
  if (links.website) {
    v.website = await (options.inspect || inspectWebsite)(links.website, store);
    // Persistent 404/410 requires independent observations at least a day apart.
    const earlier = previous?.website;
    if (
      v.website.httpStatus &&
      [404, 410].includes(v.website.httpStatus) &&
      earlier?.url === v.website.url &&
      earlier.httpStatus === v.website.httpStatus &&
      Date.parse(v.website.checkedAt) - Date.parse(earlier.checkedAt) >=
        86400_000
    ) {
      v.website.issues.push(
        `Vedvarende HTTP ${v.website.httpStatus}: mindst to kontroller med mindst 24 timers mellemrum.`,
      );
    }
  } else
    v.website = {
      state: "no_website",
      url: "",
      checkedAt: at,
      reason: searchComplete
        ? "Ingen selvstændig hjemmeside registreret i de gennemgåede kilder. Det er ikke bevis for, at en hjemmeside ikke findes."
        : "Ingen registreret hjemmeside; identiteten og hjemmesideoplysningerne er endnu ikke tilstrækkeligt verificeret.",
      issues: [],
    };
  return v;
}
export function verificationReport(
  store: VerificationStore,
  records: Business[],
) {
  const counts = {
    total: records.length,
    investigated: 0,
    active: 0,
    closed: 0,
    uncertain: 0,
    missing_data: 0,
    duplicates: 0,
    red: 0,
    orange: 0,
    green: 0,
    pending: 0,
    failed: 0,
    noRegisteredWebsite: 0,
    legacyRedCandidates: 0,
  };
  for (const b of records) {
    const v = store.get(b),
      links = websiteDetails(b.website, b.socialProfiles);
    if (!links.website) counts.noRegisteredWebsite++;
    if (!links.website) counts.legacyRedCandidates++;
    if (v?.lastAttemptAt) counts.investigated++;
    if (v?.duplicateOf) {
      counts.duplicates++;
      continue;
    }
    const state = v?.identity.state || defaultIdentity(b).state;
    counts[state]++;
    if (v?.website && ["failed", "blocked"].includes(v.website.state))
      counts.failed++;
    if (state === "closed") continue;
    if (!confirmedActive({ ...b, verification: v })) {
      counts.pending++;
      continue;
    }
    const color = presentBusiness({ ...b, verification: v }).status;
    if (color === "missing") counts.red++;
    else if (color === "improve") counts.orange++;
    else if (color === "good") counts.green++;
    else counts.pending++;
  }
  return counts;
}
