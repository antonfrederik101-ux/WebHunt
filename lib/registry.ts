import type { Business } from "./types";
import type { IdentityEvidence } from "./verification-types";
import { normalizedPublicUrl } from "./websites";
import { defaultIdentity } from "./verification-store";
export function identityText(s: unknown) {
  return typeof s === "string"
    ? s
        .normalize("NFKC")
        .toLocaleLowerCase("da-DK")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
    : "";
}
export type CvrRecord = {
  cvr: string;
  names: string[];
  currentName: string;
  address: string;
  postcode: string;
  state: "active" | "closed" | "uncertain";
  websites: string[];
  sourceUrl: string;
  observedAt: string;
};
/** Build once per snapshot: no full-register scan for each map place. */
export function indexCvr(records: CvrRecord[]) {
  const byCvr = new Map<string, CvrRecord[]>();
  const byIdentity = new Map<string, CvrRecord[]>();
  const key = (name: string, address: string, postcode: string) =>
    JSON.stringify([identityText(name), identityText(address), postcode]);
  const add = (map: Map<string, CvrRecord[]>, k: string, r: CvrRecord) => {
    const values = map.get(k);
    if (values) values.push(r);
    else map.set(k, [r]);
  };
  for (const r of records) {
    add(byCvr, r.cvr, r);
    for (const k of new Set(
      r.names.map((name) => key(name, r.address, r.postcode)),
    ))
      add(byIdentity, k, r);
  }
  return (b: Business): CvrRecord[] =>
    (/^\d{8}$/.test(b.cvr || "")
      ? byCvr.get(b.cvr!)
      : byIdentity.get(key(b.name, b.address, b.postcode))) || [];
}
const text = (v: unknown) =>
  typeof v === "string" || typeof v === "number" ? String(v) : "";
/** Minimum public company fields only. No participants, owners or personal contacts are retained. */
export function normalizeCvr(
  input: unknown,
  observedAt = new Date().toISOString(),
  candidateLimit = 10,
): CvrRecord[] {
  const root = input as {
    hits?: {
      hits?: { _source?: { Vrvirksomhed?: Record<string, unknown> } }[];
    };
  };
  if (!Array.isArray(root?.hits?.hits))
    throw new Error(
      "CVR-svaret har et ukendt format. Ingen virksomheder er bekræftet.",
    );
  const total = (root.hits as { total?: number | { value: number } }).total;
  if ((typeof total === "number" ? total : total?.value || 0) > candidateLimit)
    throw new Error(
      "For mange CVR-kandidater til et sikkert automatisk match.",
    );
  return root.hits.hits.flatMap((hit) => {
    const v = hit?._source?.Vrvirksomhed;
    if (!v) return [];
    const cvr = text(v.cvrNummer);
    if (!/^\d{8}$/.test(cvr)) return [];
    const meta = (v.virksomhedMetadata || {}) as Record<string, unknown>;
    const current = (meta.nyesteNavn || {}) as { navn?: string };
    const names = Array.isArray(v.navne)
      ? v.navne.flatMap((n) =>
          n && typeof n.navn === "string" ? [n.navn] : [],
        )
      : [];
    const a = (meta.nyesteBeliggenhedsadresse || {}) as Record<string, unknown>;
    const addr = [
      a.vejnavn,
      text(a.husnummerFra) + text(a.bogstavFra),
      a.etage,
      a.sidedoer,
    ]
      .filter(Boolean)
      .join(" ");
    // Only documented current status is affirmative. "NORMAL" is not assumed to mean AKTIV.
    const status = identityText(meta.sammensatStatus);
    const life = Array.isArray(v.livsforloeb) ? v.livsforloeb : [];
    const end = life
      .flatMap((x) =>
        x?.periode?.gyldigTil ? [String(x.periode.gyldigTil)] : [],
      )
      .sort()
      .at(-1);
    const closed =
      /^(ophørt|opløst|tvangsopløst|slettet)( |$)/.test(status) ||
      (!!end &&
        Date.parse(end) < Date.parse(observedAt) &&
        !life.some((x) => x?.periode && !x.periode.gyldigTil));
    const active = status === "aktiv" && !closed;
    const sites = Array.isArray(v.hjemmeside)
      ? v.hjemmeside
          .flatMap((x) =>
            x?.periode?.gyldigTil
              ? []
              : [normalizedPublicUrl(x?.kontaktoplysning)],
          )
          .filter(Boolean)
      : [];
    return [
      {
        cvr,
        names,
        currentName:
          typeof current.navn === "string" ? current.navn : names.at(-1) || "",
        address: addr,
        postcode: text(a.postnummer),
        state: closed ? "closed" : active ? "active" : "uncertain",
        websites: sites,
        sourceUrl: `https://datacvr.virk.dk/enhed/virksomhed/${cvr}`,
        observedAt,
      },
    ];
  });
}
export function matchCvr(
  b: Business,
  records: CvrRecord[],
  source = "CVR-distribution",
): IdentityEvidence {
  const at = new Date().toISOString();
  const exactCvr = !!b.cvr && /^\d{8}$/.test(b.cvr);
  const matches = records.filter((r) =>
    exactCvr
      ? r.cvr === b.cvr
      : r.names.some((n) => identityText(n) === identityText(b.name)) &&
        identityText(r.address) === identityText(b.address) &&
        r.postcode === b.postcode,
  );
  if (matches.length !== 1)
    return {
      ...defaultIdentity(b),
      checkedAt: at,
      source,
      reason: matches.length
        ? "Flere CVR-enheder matcher. Manuel afklaring er påkrævet."
        : "Ingen entydig identifikation i CVR. Manglende match er ikke dokumentation for lukning.",
    };
  const r = matches[0],
    sameAddress =
      identityText(r.address) === identityText(b.address) &&
      r.postcode === b.postcode;
  const sameName = r.names.some(
    (n) => identityText(n) === identityText(b.name),
  );
  const state =
    r.state === "active" && (!sameAddress || !sameName) ? "uncertain" : r.state;
  return {
    state,
    checkedAt: r.observedAt,
    source,
    sourceUrl: r.sourceUrl,
    cvr: r.cvr,
    matchedName: r.currentName,
    matchedAddress: [r.address, r.postcode].join(", "),
    addressMatch: sameAddress ? "same" : "changed",
    nameChanged: identityText(r.currentName) !== identityText(b.name),
    websiteCandidates: r.websites,
    reason:
      state === "closed"
        ? "Den entydigt matchede CVR-enhed er registreret ophørt. Kilde og historik bevares."
        : state === "active"
          ? "CVR-enheden er registreret AKTIV, og identitet/adresse matcher. CVR-status bekræfter den juridiske enhed; fysisk butiksdrift er ikke særskilt observeret."
          : !sameAddress
            ? "CVR-nummeret matcher, men adressen er ændret. Den gamle kortplacering kræver afklaring."
            : "CVR-oplysningerne giver ikke tilstrækkelig sikker dokumentation for den aktuelle drift.",
  };
}
export async function lookupCvr(b: Business): Promise<CvrRecord[]> {
  if (!process.env.CVR_USERNAME || !process.env.CVR_PASSWORD)
    throw new Error(
      "CVR-adgang er ikke konfigureret. Aktivitet kan ikke bekræftes automatisk.",
    );
  const query = b.cvr
    ? { term: { "Vrvirksomhed.cvrNummer": b.cvr } }
    : {
        bool: {
          must: [
            { match_phrase: { "Vrvirksomhed.navne.navn": b.name } },
            {
              match: {
                "Vrvirksomhed.beliggenhedsadresse.postnummer": b.postcode,
              },
            },
          ],
        },
      };
  const r = await fetch(
    "https://distribution.virk.dk/cvr-permanent/virksomhed/_search",
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            process.env.CVR_USERNAME + ":" + process.env.CVR_PASSWORD,
          ).toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        size: 10,
        _source: [
          "Vrvirksomhed.cvrNummer",
          "Vrvirksomhed.navne",
          "Vrvirksomhed.virksomhedMetadata.nyesteNavn",
          "Vrvirksomhed.virksomhedMetadata.nyesteBeliggenhedsadresse",
          "Vrvirksomhed.virksomhedMetadata.sammensatStatus",
          "Vrvirksomhed.livsforloeb",
          "Vrvirksomhed.hjemmeside",
        ],
        query,
      }),
      signal: AbortSignal.timeout(12000),
      redirect: "error",
    },
  );
  if (!r.ok)
    throw new Error(
      `CVR-distribution svarede HTTP ${r.status}. Ingen aktivitet udledes af fejlen.`,
    );
  const size = Number(r.headers.get("content-length") || 0);
  if (size > 2_000_000) throw new Error("CVR-svaret er for stort.");
  const data = await r.text();
  if (data.length > 2_000_000) throw new Error("CVR-svaret er for stort.");
  return normalizeCvr(JSON.parse(data));
}
