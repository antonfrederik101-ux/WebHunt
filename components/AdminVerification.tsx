"use client";
import { useState } from "react";
import { activityLabels, type ActivityState } from "@/lib/verification-types";
import type { Business } from "@/lib/types";
type Data = {
  counts: Record<string, number>;
  items: Business[];
  matched: number;
  nextOffset: number | null;
  jobs: { id: string; state: string; count: number }[];
};
export default function AdminVerification() {
  const [key, setKey] = useState(""),
    [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [state, setState] = useState(""),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<Business | null>(null),
    [history, setHistory] = useState<
      {
        checkedAt: string;
        result: { identity: { reason: string; state: ActivityState } };
      }[]
    >([]),
    [review, setReview] = useState<ActivityState>("uncertain"),
    [reason, setReason] = useState(""),
    [source, setSource] = useState(""),
    [identity, setIdentity] = useState(false),
    [websiteSearchCompleted, setWebsiteSearchCompleted] = useState(false),
    [website, setWebsite] = useState("");
  const api = async (path = "", body?: unknown) => {
    const r = await fetch("/api/admin/verification" + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Bearer " + key,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Kontrollen kunne ikke læses.");
    return d;
  };
  const load = async (offset = 0) => {
    setBusy(true);
    setError("");
    try {
      const d = await api(
        "?" + new URLSearchParams({ state, q: query, offset: String(offset) }),
      );
      setData((previous) =>
        offset && previous
          ? { ...d, items: [...previous.items, ...d.items] }
          : d,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const open = async (b: Business) => {
    setSelected(b);
    setReason("");
    setSource("");
    setIdentity(false);
    setWebsiteSearchCompleted(false);
    setWebsite("");
    setHistory([]);
    try {
      const d = await api("?id=" + encodeURIComponent(b.id));
      setSelected(d.business);
      setHistory(d.history);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api("", {
        id: selected!.id,
        state: review,
        reason,
        sourceUrl: source,
        identityConfirmed: identity,
        websiteSearchCompleted,
        website,
      });
      setSelected(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const labels: Record<string, string> = {
    total: "Poster i databasen",
    investigated: "Kontrol forsøgt",
    active: "Bekræftet aktive",
    closed: "Bekræftet lukkede",
    uncertain: "Usikre",
    missing_data: "Manglende identitet",
    duplicates: "Sikre dubletter",
    red: "Røde",
    orange: "Orange",
    green: "Grønne",
    pending: "Afventer afklaring",
    failed: "Hjemmesidekontrol mislykket",
    noRegisteredWebsite: "Ingen importeret hjemmeside",
    legacyRedCandidates: "Tidligere registreringsbaseret rød",
  };
  return (
    <main className="admin-page">
      <header>
        <a href="/">← WebHunt-kortet</a>
        <h1>Virksomheds- og datakontrol</h1>
        <p>
          Kildebelagte kontroller, bevaret historik og faktiske optællinger.
          Aktivitet og hjemmesidens kvalitet vurderes separat.
        </p>
      </header>
      {!data ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
          className="panel"
        >
          <label>
            Privat administratornøgle
            <input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <p className="micro">
            Nøglen oprettes i Codespace-terminalen med{" "}
            <code>npm run verify:admin</code>. Den gemmes ikke i browseren. Del
            den ikke i chatten.
          </p>
          <button className="button primary" disabled={busy || !key}>
            Åbn kontroloversigt
          </button>
        </form>
      ) : (
        <>
          <div className="admin-counts">
            {Object.entries(labels).map(([id, label]) => (
              <div className="panel" key={id}>
                <strong>
                  {data.counts[id]?.toLocaleString("da-DK") ?? "—"}
                </strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <p className="inline-warning">
            “Kontrol forsøgt” betyder ikke bekræftet aktiv. En lukket virksomhed
            skjules fra kortet; usikre virksomheder er grå og tæller ikke som
            bekræftede salgsmuligheder. Personlige gamle farver bevares, men er
            ikke kildebevis.
          </p>
          <form
            className="admin-filters"
            onSubmit={(e) => {
              e.preventDefault();
              void load();
            }}
          >
            <input
              aria-label="Søg kontrolposter"
              placeholder="Navn eller adresse"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              aria-label="Virksomhedsstatus"
              value={state}
              onChange={(e) => setState(e.target.value)}
            >
              <option value="">Alle virksomhedsstatusser</option>
              {Object.entries(activityLabels).map(([id, label]) => (
                <option value={id} key={id}>
                  {label}
                </option>
              ))}
              <option value="duplicate">Dubletter</option>
            </select>
            <button className="button subtle" disabled={busy}>
              Opdatér
            </button>
            <button
              className="button subtle"
              type="button"
              onClick={() => {
                const u = URL.createObjectURL(
                  new Blob(
                    [
                      JSON.stringify(
                        {
                          generatedAt: new Date().toISOString(),
                          counts: data.counts,
                          jobs: data.jobs,
                        },
                        null,
                        2,
                      ),
                    ],
                    { type: "application/json" },
                  ),
                );
                const a = document.createElement("a");
                a.href = u;
                a.download = "webhunt-kontrolrapport.json";
                a.click();
                URL.revokeObjectURL(u);
              }}
            >
              Hent rapport
            </button>
          </form>
          <p>
            {data.matched.toLocaleString("da-DK")} poster matcher. Batchkontrol
            køres i Codespace med <code>npm run verify:pilot</code> og
            genoptages efter afbrydelse. Oversigten opdateres med knappen
            ovenfor.
          </p>
          <div className="company-list">
            {data.items.map((b) => (
              <button
                className="company-row"
                key={b.id}
                onClick={() => void open(b)}
              >
                <span>
                  <strong>{b.name}</strong>
                  <small>
                    {b.address} · {b.postcode} {b.city}
                  </small>
                </span>
                <span>
                  {
                    activityLabels[
                      b.verification?.identity.state || "uncertain"
                    ]
                  }
                  {b.verification?.duplicateOf ? " · Dublet" : ""}
                </span>
              </button>
            ))}
          </div>
          {data.nextOffset !== null && (
            <button
              className="button subtle"
              disabled={busy}
              onClick={() => void load(data.nextOffset!)}
            >
              Indlæs flere kontrolposter
            </button>
          )}
          <section className="panel">
            <h2>Jobfremskridt</h2>
            {data.jobs.length ? (
              data.jobs.map((j, i) => (
                <p key={i}>
                  {j.id.slice(0, 8)} · {j.state || "Tomt job"}: {j.count}
                </p>
              ))
            ) : (
              <p>Ingen kontroljobs er startet i databasen.</p>
            )}
          </section>
        </>
      )}
      {error && (
        <p role="alert" className="inline-warning">
          {error}
        </p>
      )}
      {selected && (
        <section
          className="panel admin-review"
          aria-label="Kontrol af virksomhed"
        >
          <button className="button subtle" onClick={() => setSelected(null)}>
            Luk kontrol
          </button>
          <h2>{selected.name}</h2>
          <p>
            {selected.address}, {selected.postcode} {selected.city}
          </p>
          <p>{selected.verification?.identity.reason}</p>
          <p>{selected.verification?.website?.reason}</p>
          <p>
            Score:{" "}
            {selected.verification?.website?.analysis?.score ?? "Ikke beregnet"}
          </p>
          <p>
            Kilde:{" "}
            {selected.verification?.identity.source || "Ingen kildekontrol"}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <h3>Registrér et manuelt kildecheck</h3>
            <label>
              Virksomhedsstatus
              <select
                value={review}
                onChange={(e) => setReview(e.target.value as ActivityState)}
              >
                {Object.entries(activityLabels).map(([id, label]) => (
                  <option value={id} key={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Offentlig kildeside
              <input
                required
                type="url"
                value={source}
                placeholder="https://datacvr.virk.dk/…"
                onChange={(e) => setSource(e.target.value)}
              />
            </label>
            <label>
              Konkrete virksomhedsoplysninger fra kilden
              <textarea
                required
                minLength={20}
                maxLength={1500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={identity}
                onChange={(e) => setIdentity(e.target.checked)}
              />
              Jeg har kontrolleret, at CVR-nummer eller navn og adresse
              identificerer netop denne virksomhed.
            </label>
            <label>
              Fundet selvstændig hjemmeside (valgfrit)
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://…"
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={websiteSearchCompleted}
                onChange={(e) => setWebsiteSearchCompleted(e.target.checked)}
              />
              Jeg har også gennemgået hjemmesidefelterne i den angivne kilde og
              importen. Ingen registreret hjemmeside er ikke bevis for at ingen
              findes.
            </label>
            <p className="micro">
              Angiv kun virksomhedsrelaterede fakta. En vurdering af hjemmesiden
              bekræfter ikke virksomhedens aktivitet.
            </p>
            <button className="button primary" disabled={busy}>
              Gem kildecheck i historikken
            </button>
          </form>
          <h3>Kontrolhistorik</h3>
          {history.length ? (
            history.map((h, i) => (
              <p key={i}>
                {new Date(h.checkedAt).toLocaleString("da-DK")} ·{" "}
                {activityLabels[h.result.identity.state]} ·{" "}
                {h.result.identity.reason}
              </p>
            ))
          ) : (
            <p>Ingen tidligere kontroller.</p>
          )}
        </section>
      )}
    </main>
  );
}
