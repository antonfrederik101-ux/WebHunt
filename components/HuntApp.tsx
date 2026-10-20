"use client";
import dynamic from "next/dynamic";
import HuntMark from "./HuntMark";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Map,
  Building2,
  Bookmark,
  ChartNoAxesCombined,
  Settings,
  ArrowUpRight,
  ArrowRight,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  LocateFixed,
  X,
  Globe,
  Phone,
  MapPin,
  Copy,
  Check,
  Plus,
  Download,
  LogIn,
  LogOut,
  LoaderCircle,
  Info,
  ExternalLink,
  CircleHelp,
  Mail,
  Menu,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  FileSearch,
  CircleCheck,
  AlertCircle,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import {
  Analysis,
  Business,
  cities,
  ContactStatus,
  Lead,
  Status,
  statuses,
} from "@/lib/types";
import { csv } from "@/lib/businesses";
import { migrateLocalData } from "@/lib/local-data";
import type { SupabaseHealth } from "@/lib/supabase-health";
import { getSupabase } from "@/lib/supabase";
const DenmarkMap = dynamic(() => import("./DenmarkMap"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <LoaderCircle className="spin" /> Kortet starter…
    </div>
  ),
});
type Tab =
  "Kort" | "Virksomheder" | "Mine leads" | "Statistik" | "Indstillinger";
const nav = [
  { name: "Kort" as Tab, icon: Map },
  { name: "Virksomheder" as Tab, icon: Building2 },
  { name: "Mine leads" as Tab, icon: Bookmark },
  { name: "Statistik" as Tab, icon: ChartNoAxesCombined },
];
const contactStatuses: ContactStatus[] = [
  "Ikke kontaktet",
  "Kontaktet",
  "Interesseret",
  "Kunde",
  "Afvist",
];
export default function HuntApp() {
  const [tab, setTab] = useState<Tab>("Kort"),
    [businesses, setBusinesses] = useState<Business[]>([]),
    [selected, setSelected] = useState<Business | null>(null),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("Alle brancher"),
    [filters, setFilters] = useState<Status[]>([]),
    [target, setTarget] = useState(
      cities.find((c) => c.name === "Nykøbing Falster") || cities[0],
    ),
    [area, setArea] = useState("Nykøbing Falster"),
    [bbox, setBbox] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retrySeconds, setRetrySeconds] = useState(0),
    [overview, setOverview] = useState(false),
    [capped, setCapped] = useState(false),
    [fetchedAt, setFetchedAt] = useState(""),
    [dataSource, setDataSource] = useState("Overture Maps · egen database"),
    [dataWarning, setDataWarning] = useState(""),
    [supabaseHealth, setSupabaseHealth] = useState<SupabaseHealth | null>(null),
    [healthBusy, setHealthBusy] = useState(false),
    [ready, setReady] = useState(false),
    [leads, setLeads] = useState<Lead[]>([]),
    [overrides, setOverrides] = useState<Record<string, Status>>({}),
    [analyses, setAnalyses] = useState<Record<string, Analysis>>({}),
    [analyzing, setAnalyzing] = useState(false),
    [analysisError, setAnalysisError] = useState(""),
    [toast, setToast] = useState(""),
    [authOpen, setAuthOpen] = useState(false),
    [recovery, setRecovery] = useState(false),
    [user, setUser] = useState<User | null>(null),
    [authReady, setAuthReady] = useState(false),
    [storageReady, setStorageReady] = useState(false),
    [mobileFilters, setMobileFilters] = useState(false),
    [searching, setSearching] = useState(false),
    [saving, setSaving] = useState(false);
  const sb = getSupabase(),
    seq = useRef(0),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  }, []);
  const checkConnection = useCallback(async () => {
    setHealthBusy(true);
    try {
      const r = await fetch("/api/health");
      if (!r.ok) throw new Error();
      const d = await r.json();
      setSupabaseHealth(d.supabase);
    } catch {
      notify("Forbindelsestesten kunne ikke gennemføres.");
    } finally {
      setHealthBusy(false);
    }
  }, [notify]);
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);
  useEffect(() => {
    if (!sb) {
      setAuthReady(true);
      return;
    }
    sb.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthReady(true);
    });
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      setAuthReady(true);
      if (event === "PASSWORD_RECOVERY") {
        setRecovery(true);
        setAuthOpen(true);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [sb]);
  useEffect(() => {
    if (!authReady) return;
    let stopped = false;
    setStorageReady(false);
    setLeads([]);
    setOverrides({});
    setAnalyses({});
    (async () => {
      if (user && sb) {
        const [l, s] = await Promise.all([
          sb
            .from("leads")
            .select("*")
            .order("created_at", { ascending: false }),
          sb.from("business_statuses").select("*"),
        ]);
        if (stopped) return;
        if (l.error || s.error) {
          notify(
            "Databasen kunne ikke læses. Se forbindelsestesten under Indstillinger og kør supabase/schema.sql, hvis tabellerne mangler.",
          );
          return;
        }
        setLeads(
          (l.data || []).map((x) => ({
            business: x.business,
            notes: x.notes,
            contact_status: x.contact_status,
            created_at: x.created_at,
          })),
        );
        setOverrides(
          Object.fromEntries(
            (s.data || []).map((x) => [x.business_id, x.status]),
          ),
        );
        setAnalyses(
          Object.fromEntries(
            (s.data || [])
              .filter((x) => x.analysis)
              .map((x) => [x.business_id, x.analysis]),
          ),
        );
      } else {
        try {
          migrateLocalData(localStorage);
          setLeads(
            JSON.parse(localStorage.getItem("webhunt-guest-leads") || "[]"),
          );
          setOverrides(
            JSON.parse(localStorage.getItem("webhunt-guest-statuses") || "{}"),
          );
          setAnalyses(
            JSON.parse(localStorage.getItem("webhunt-guest-analyses") || "{}"),
          );
        } catch {
          notify(
            "Lokale data kunne ikke læses. Browserens lager kan være blokeret.",
          );
        }
      }
      if (!stopped) setStorageReady(true);
    })();
    return () => {
      stopped = true;
    };
  }, [user, sb, authReady, notify]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("recovery") === "1") {
      setRecovery(true);
      setAuthOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("auth_error"))
      notify("Loginlinket er udløbet eller ugyldigt. Prøv at logge ind igen.");
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAuthOpen(false);
        setSelected(null);
        setMobileFilters(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [notify]);
  const fetchBusinesses = useCallback(async (bounds: string) => {
    const n = ++seq.current;
    setLoading(true);
    setError("");
    try {
      const r = await fetch(
        "/api/businesses" +
          (bounds ? "?bbox=" + encodeURIComponent(bounds) : ""),
      );
      const d = await r.json();
      if (n !== seq.current) return;
      if (!r.ok) {
        setRetrySeconds(
          Math.max(
            0,
            Number(d.retryAfter || r.headers.get("Retry-After") || 0),
          ),
        );
        throw new Error(d.error);
      }
      setRetrySeconds(0);
      setBusinesses(d.businesses);
      setOverview(d.overview);
      setCapped(d.limited);
      setFetchedAt(d.fetchedAt);
      setDataSource(d.source || "Overture Maps · egen database");
      setDataWarning(d.warning || "");
    } catch (e) {
      if (n === seq.current)
        setError(
          ((e as Error).message || "Virksomhederne kunne ikke indlæses.") +
            " Eventuelle tidligere resultater er bevaret.",
        );
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (bbox) fetchBusinesses(bbox);
  }, [bbox, fetchBusinesses]);
  useEffect(() => {
    if (retrySeconds <= 0) return;
    const timeout = setTimeout(
      () => setRetrySeconds((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearTimeout(timeout);
  }, [retrySeconds]);
  const onBounds = useCallback((b: string) => setBbox(b), []);
  const all = useMemo(
    () =>
      businesses.map((b) => ({ ...b, status: overrides[b.id] || b.status })),
    [businesses, overrides],
  );
  const filtered = useMemo(
    () =>
      all.filter(
        (b) =>
          (!filters.length || filters.includes(b.status)) &&
          (category === "Alle brancher" || b.category === category) &&
          (!query ||
            `${b.name} ${b.city} ${b.postcode} ${b.address}`
              .toLocaleLowerCase("da")
              .includes(query.toLocaleLowerCase("da"))),
      ),
    [all, filters, category, query],
  );
  const counts = useMemo(
    () => ({
      unknown: all.filter((b) => b.status === "unknown").length,
      missing: all.filter((b) => b.status === "missing").length,
      improve: all.filter((b) => b.status === "improve").length,
      good: all.filter((b) => b.status === "good").length,
    }),
    [all],
  );
  const current = selected
    ? { ...selected, status: overrides[selected.id] || selected.status }
    : null;
  const choose = useCallback((b: Business) => {
    setSelected(b);
    setAnalysisError("");
    setMobileFilters(false);
  }, []);
  const goCity = (c: (typeof cities)[number]) => {
    setTarget({ ...c });
    setArea(c.name);
    setQuery("");
    setTab("Kort");
    setMobileFilters(false);
  };
  const searchPlace = async () => {
    const q = query.trim();
    if (!q) return;
    const city = cities.find((c) => c.name.toLowerCase() === q.toLowerCase());
    if (city) {
      goCity(city);
      return;
    }
    setSearching(true);
    try {
      const r = await fetch("/api/geocode?q=" + encodeURIComponent(q));
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error);
      setTarget({ name: q, lat: d.lat, lon: d.lon, zoom: 14 });
      setArea(q);
      setQuery("");
      setTab("Kort");
      setMobileFilters(false);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setSearching(false);
    }
  };
  const persistLeads = async (next: Lead[]) => {
    if (!user) {
      try {
        localStorage.setItem("webhunt-guest-leads", JSON.stringify(next));
      } catch {
        throw new Error(
          "Browseren kunne ikke gemme. Kontrollér ledig lagerplads.",
        );
      }
    }
    setLeads(next);
  };
  const saveLead = async (b: Business) => {
    if (!storageReady) {
      notify("Lagringen er ikke klar. Kontrollér databaseforbindelsen.");
      return;
    }
    if (leads.some((l) => l.business.id === b.id)) {
      setTab("Mine leads");
      setSelected(null);
      return;
    }
    setSaving(true);
    const lead: Lead = {
      business: b,
      notes: "",
      contact_status: "Ikke kontaktet",
      created_at: new Date().toISOString(),
    };
    try {
      if (user && sb) {
        const { error } = await sb
          .from("leads")
          .insert({ user_id: user.id, business_id: b.id, ...lead });
        if (error) throw new Error("Leadet kunne ikke gemmes i databasen.");
      }
      await persistLeads([lead, ...leads]);
      notify(user ? "Lead gemt på din konto" : "Lead gemt i denne browser");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const updateLead = async (id: string, patch: Partial<Lead>) => {
    try {
      if (user && sb) {
        const { error } = await sb
          .from("leads")
          .update(patch)
          .eq("user_id", user.id)
          .eq("business_id", id);
        if (error) throw new Error("Ændringen kunne ikke gemmes.");
      }
      await persistLeads(
        leads.map((l) => (l.business.id === id ? { ...l, ...patch } : l)),
      );
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const removeLead = async (id: string) => {
    try {
      if (user && sb) {
        const { error } = await sb
          .from("leads")
          .delete()
          .eq("user_id", user.id)
          .eq("business_id", id);
        if (error) throw new Error("Leadet kunne ikke slettes.");
      }
      await persistLeads(leads.filter((l) => l.business.id !== id));
      notify("Lead fjernet");
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const changeStatus = async (
    id: string,
    status: Status,
    analysis?: Analysis,
  ) => {
    if (!storageReady) throw new Error("Lagringen er ikke klar.");
    const next = { ...overrides, [id]: status };
    const nextAnalyses = { ...analyses };
    if (analysis) nextAnalyses[id] = analysis;
    else delete nextAnalyses[id];
    if (user && sb) {
      const { error } = await sb.from("business_statuses").upsert(
        {
          user_id: user.id,
          business_id: id,
          status,
          analysis: analysis || null,
        },
        { onConflict: "user_id,business_id" },
      );
      if (error) throw new Error("Status kunne ikke gemmes.");
    } else {
      localStorage.setItem("webhunt-guest-statuses", JSON.stringify(next));
      localStorage.setItem(
        "webhunt-guest-analyses",
        JSON.stringify(nextAnalyses),
      );
    }
    setOverrides(next);
    setAnalyses(nextAnalyses);
  };
  const analyze = async (b: Business) => {
    setAnalyzing(true);
    setAnalysisError("");
    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: b.website }),
      });
      const d = await r.json();
      if (!r.ok) {
        await changeStatus(b.id, "unknown");
        throw new Error(d.error);
      }
      await changeStatus(b.id, d.status, d);
      notify("Hjemmesideanalysen er klar");
    } catch (e) {
      setAnalysisError((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  };
  const exportCSV = () => {
    const data = leads.map((l) => ({
      ...l,
      business: {
        ...l.business,
        status: overrides[l.business.id] || l.business.status,
      },
    }));
    const url = URL.createObjectURL(
      new Blob([csv(data)], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `webhunt-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify(`${leads.length} leads eksporteret`);
  };
  return (
    <div className="app-shell">
      <header className="topbar">
        <a href="/" className="brand" aria-label="WebHunt forside">
          <span className="brand-icon">
            <HuntMark size={25} />
          </span>
          <span>
            web<span className="mint">hunt</span>
            <small>DANMARKS VIRKSOMHEDSKORT</small>
          </span>
        </a>
        <div className="header-center">
          <span className="live-dot" /> Din næste kunde er derude.
        </div>
        <div className="header-actions">
          <span className="country">
            🇩🇰 <span>Danmark</span>
          </span>
          <button
            className="button subtle auth-button"
            onClick={() => (user ? setTab("Indstillinger") : setAuthOpen(true))}
          >
            {user ? (
              <span className="avatar">
                {user.email?.slice(0, 1).toUpperCase()}
              </span>
            ) : (
              <LogIn size={16} />
            )}
            <span>{user ? "Min konto" : "Log ind"}</span>
          </button>
        </div>
      </header>
      <div className="workspace">
        <nav className="rail" aria-label="Hovednavigation">
          <div className="rail-top">
            {nav.map((n) => (
              <button
                key={n.name}
                className={`nav-item ${tab === n.name ? "active" : ""}`}
                onClick={() => {
                  setTab(n.name);
                  setSelected(null);
                }}
                title={n.name}
              >
                <n.icon size={21} />
                <span>{n.name}</span>
                {n.name === "Mine leads" && leads.length > 0 && (
                  <i>{leads.length}</i>
                )}
              </button>
            ))}
          </div>
          <div className="rail-bottom">
            <button
              className={`nav-item ${tab === "Indstillinger" ? "active" : ""}`}
              onClick={() => setTab("Indstillinger")}
            >
              <Settings size={21} />
              <span>Indstillinger</span>
            </button>
            <button
              className="nav-item"
              onClick={() => {
                setTab("Indstillinger");
                notify("Se afsnittet om datakilder og dækning.");
              }}
            >
              <CircleHelp size={21} />
              <span>Hjælp</span>
            </button>
            <div className="rail-divider" />
            <span className="rail-version">WH / 1.0</span>
          </div>
        </nav>
        {(tab === "Kort" || tab === "Virksomheder") && (
          <aside
            className={`filter-sidebar ${mobileFilters ? "mobile-open" : ""}`}
          >
            <div className="sidebar-heading">
              <div>
                <span className="eyebrow">DIT NÆSTE PROJEKT STARTER HER</span>
                <h1>
                  Find muligheder.
                  <br />
                  <span>Skab forbindelser.</span>
                </h1>
              </div>
              <button
                className="icon-button mobile-close"
                aria-label="Luk filtre"
                onClick={() => setMobileFilters(false)}
              >
                <X size={20} />
              </button>
              <p>
                Opdag danske virksomheder, der kunne bruge din hjælp til deres
                næste hjemmeside.
              </p>
            </div>
            <div className="filter-content">
              <label className="field-label" htmlFor="search">
                HVEM LEDER DU EFTER?
              </label>
              <form
                className="search-field"
                onSubmit={(e) => {
                  e.preventDefault();
                  searchPlace();
                }}
              >
                <Search size={17} />
                <input
                  id="search"
                  placeholder="Virksomhed, by eller postnummer"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Ryd søgning"
                    onClick={() => setQuery("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </form>
              {query && (
                <button
                  className="place-search"
                  onClick={searchPlace}
                  disabled={searching}
                >
                  {searching ? (
                    <LoaderCircle size={14} className="spin" />
                  ) : (
                    <MapPin size={14} />
                  )}{" "}
                  Søg “{query}” som sted <ArrowRight size={14} />
                </button>
              )}
              <div className="filter-group">
                <label className="field-label" htmlFor="industry">
                  BRANCHE
                </label>
                <div className="select-wrap">
                  <Building2 size={16} />
                  <select
                    id="industry"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option>Alle brancher</option>
                    {Array.from(new Set(all.map((b) => b.category)))
                      .sort((a, b) => a.localeCompare(b, "da"))
                      .map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                  </select>
                  <ChevronDown size={14} />
                </div>
              </div>
              <div className="filter-group">
                <div className="label-row">
                  <span className="field-label">HJEMMESIDESTATUS</span>
                  <button
                    className="text-button"
                    onClick={() => {
                      setFilters([]);
                      setCategory("Alle brancher");
                      setQuery("");
                    }}
                  >
                    Nulstil
                  </button>
                </div>
                <div className="status-filters">
                  {(["missing", "improve", "good", "unknown"] as Status[]).map(
                    (s) => (
                      <label
                        key={s}
                        className={filters.includes(s) ? "checked" : ""}
                      >
                        <input
                          type="checkbox"
                          checked={filters.includes(s)}
                          onChange={() =>
                            setFilters(
                              filters.includes(s)
                                ? filters.filter((x) => x !== s)
                                : [...filters, s],
                            )
                          }
                        />
                        <span
                          className="status-dot"
                          style={{ background: statuses[s].color }}
                        />
                        <span>
                          {s === "missing"
                            ? "Sandsynligvis ingen hjemmeside"
                            : s === "improve"
                              ? "Kan forbedres"
                              : s === "good"
                                ? "Velfungerende"
                                : "Ikke undersøgt"}
                        </span>
                        <b>{counts[s]}</b>
                      </label>
                    ),
                  )}
                </div>
              </div>
              <button
                className="button primary find-button"
                onClick={() => {
                  setFilters(["missing", "improve"]);
                  notify(
                    "Viser røde og orange virksomheder blandt de indlæste data.",
                  );
                }}
              >
                <Target size={18} /> Find potentielle kunder{" "}
                <ArrowRight size={16} />
              </button>
              <div className="sidebar-rule" />
              <span className="field-label">UDFORSK EN BY</span>
              <div className="city-chips">
                {cities.slice(1, 5).map((c) => (
                  <button key={c.name} onClick={() => goCity(c)}>
                    {c.name}
                    <ArrowUpRight size={12} />
                  </button>
                ))}
                <select
                  aria-label="Vælg en anden dansk by"
                  value=""
                  onChange={(e) => {
                    const c = cities.find((x) => x.name === e.target.value);
                    if (c) goCity(c);
                  }}
                >
                  <option value="">Flere byer…</option>
                  {cities.slice(5).map((c) => (
                    <option key={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="tip-card">
                <span className="tip-icon">
                  <Sparkles size={18} />
                </span>
                <div>
                  <strong>Muligheder, ikke gætterier.</strong>
                  <p>
                    En manglende webadresse er ikke bevis på en manglende
                    hjemmeside. Undersøg altid virksomheden.
                  </p>
                </div>
              </div>
            </div>
            <div className="sidebar-footer">
              <ShieldCheck size={15} />
              <span>Offentlige data. Nye muligheder.</span>
              <Info size={14} />
            </div>
          </aside>
        )}
        <main className={`main-content ${tab === "Kort" ? "is-map" : ""}`}>
          {tab === "Kort" && (
            <>
              <div className="map-topline">
                <div>
                  <span className="eyebrow">OVERBLIK</span>
                  <h2>
                    {area}. <span>Find muligheder.</span>
                  </h2>
                </div>
                <button
                  className="button subtle mobile-filter-button"
                  onClick={() => setMobileFilters(true)}
                >
                  <SlidersHorizontal size={16} /> Filtre
                </button>
                <div className="data-badge">
                  <span
                    className={loading || error ? "loading-dot" : "live-dot"}
                  />
                  {loading
                    ? "Henter virksomheder"
                    : error
                      ? "Datakilden er utilgængelig"
                      : dataSource}
                </div>
              </div>
              <section className="map-region">
                <DenmarkMap
                  businesses={filtered}
                  selected={current?.id || null}
                  target={target}
                  onSelect={choose}
                  onBounds={onBounds}
                  onReady={() => setReady(true)}
                />
                <div className="map-floating-top">
                  <div className="map-location">
                    <span className="location-icon">
                      <MapPin size={17} />
                    </span>
                    <div>
                      <strong>{area}</strong>
                      <small>
                        {overview
                          ? "Importerede virksomheder i databasen"
                          : "Virksomheder i kortudsnittet"}
                      </small>
                    </div>
                    <button
                      className="icon-button"
                      title="Vis hele Danmark"
                      aria-label="Vis hele Danmark"
                      onClick={() => goCity(cities[0])}
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                  <button
                    className="map-recenter"
                    aria-label="Centrér kortet på Danmark"
                    title="Centrér kortet på Danmark"
                    onClick={() => goCity(cities[0])}
                  >
                    <LocateFixed size={20} />
                  </button>
                </div>
                <div className="map-stats">
                  <div className="map-stat-icon">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <strong>
                      {(loading || error) && !all.length
                        ? "—"
                        : all.length.toLocaleString("da-DK")}
                    </strong>
                    <span>
                      {error && !all.length
                        ? "Data ikke indlæst"
                        : loading
                          ? "Henter virksomhedsdata"
                          : "virksomheder indlæst"}
                    </span>
                  </div>
                  <div className="stat-divider" />
                  <div>
                    <strong className="mint">
                      {(loading || error) && !all.length
                        ? "—"
                        : counts.missing + counts.improve}
                    </strong>
                    <span>potentielle kunder</span>
                  </div>
                  <span className="stat-live">
                    {loading ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <span className="live-dot" />
                    )}
                  </span>
                </div>
                {loading && (
                  <div className="map-notice">
                    <LoaderCircle size={16} className="spin" /> Henter rigtige
                    virksomheder fra egen database…
                  </div>
                )}
                {error && (
                  <div className="map-notice error">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                    <button
                      disabled={retrySeconds > 0}
                      onClick={() => fetchBusinesses(bbox)}
                    >
                      {retrySeconds > 0
                        ? `Prøv igen om ${retrySeconds} s`
                        : "Prøv igen"}
                    </button>
                  </div>
                )}
                {!loading && !error && filtered.length === 0 && (
                  <div className="map-notice">
                    <Search size={18} />
                    <span>
                      {all.length
                        ? "Ingen virksomheder matcher dine filtre."
                        : "Ingen registrerede virksomheder i dette udsnit."}
                    </span>
                    <button
                      onClick={() => {
                        setFilters([]);
                        setQuery("");
                        setCategory("Alle brancher");
                      }}
                    >
                      Ryd filtre
                    </button>
                  </div>
                )}
                <div className="map-bottom">
                  <div className="map-legend">
                    {(
                      ["missing", "improve", "good", "unknown"] as Status[]
                    ).map((s) => (
                      <button
                        key={s}
                        onClick={() =>
                          setFilters(
                            filters.length === 1 && filters[0] === s ? [] : [s],
                          )
                        }
                        className={filters.includes(s) ? "active" : ""}
                      >
                        <span
                          className="status-dot"
                          style={{ background: statuses[s].color }}
                        />
                        {s === "missing"
                          ? "Ingen hjemmeside*"
                          : s === "improve"
                            ? "Kan forbedres"
                            : s === "good"
                              ? "Velfungerende"
                              : "Ikke undersøgt"}
                      </button>
                    ))}
                  </div>
                  <div className="map-hint">
                    <span className="live-dot" /> Zoom ind og opdag flere
                    virksomheder
                  </div>
                </div>
              </section>
              {dataWarning && (
                <div className="inline-warning data-warning">
                  <Info size={16} />
                  <span>
                    {dataWarning} Hentet{" "}
                    {new Date(fetchedAt).toLocaleString("da-DK")}.
                  </span>
                </div>
              )}
              <div className="coverage-footer">
                <Info size={14} />
                <span>
                  {overview
                    ? "Oversigten viser importerede virksomheder. Flere områder kan tilføjes uden at ændre kortet."
                    : "Viser importerede Overture-virksomheder i kortudsnittet. Første importområde er Nykøbing Falster; dækningen er ufuldstændig."}
                  {capped ? " Maks. 600 resultater – zoom tættere på." : ""}
                </span>
                <button onClick={() => setTab("Indstillinger")}>
                  Om data <ArrowUpRight size={12} />
                </button>
              </div>
            </>
          )}
          {tab === "Virksomheder" && (
            <div className="page-content">
              <PageTitle
                eyebrow="FRA KORTET"
                title="Virksomheder"
                description={`${filtered.length} af ${all.length} indlæste virksomheder · ${area}. Kun det senest indlæste kortudsnit.`}
              />
              <button
                className="button subtle mobile-filter-button"
                onClick={() => setMobileFilters(true)}
              >
                <SlidersHorizontal size={16} /> Søg og filtrér
              </button>
              {error && (
                <div className="inline-warning">
                  {error}
                  <button onClick={() => fetchBusinesses(bbox)}>
                    Prøv igen
                  </button>
                </div>
              )}
              <div className="company-list">
                {filtered.map((b) => (
                  <button
                    className="company-row"
                    key={b.id}
                    onClick={() => choose(b)}
                  >
                    <span className="company-avatar">
                      <Building2 size={22} />
                    </span>
                    <div>
                      <strong>{b.name}</strong>
                      <small>
                        {b.category} ·{" "}
                        {[b.address, b.postcode, b.city]
                          .filter(Boolean)
                          .join(", ")}
                      </small>
                    </div>
                    <StatusBadge status={b.status} />
                    <ChevronRight size={17} />
                  </button>
                ))}
              </div>
              {!filtered.length && (
                <Empty
                  icon={Building2}
                  title="Ingen virksomheder at vise"
                  text="Åbn kortet, vælg et område, eller ryd dine filtre."
                  action={() => {
                    setFilters([]);
                    setQuery("");
                    setCategory("Alle brancher");
                    setTab("Kort");
                  }}
                  label="Udforsk kortet"
                />
              )}
            </div>
          )}
          {tab === "Mine leads" && (
            <div className="page-content">
              <div className="page-heading-row">
                <PageTitle
                  eyebrow="FRA MULIGHED TIL KUNDE"
                  title="Mine leads"
                  description={`${leads.length} gemte virksomheder. Hold styr på din næste gode forbindelse.`}
                />
                <button
                  className="button primary"
                  disabled={!leads.length}
                  onClick={exportCSV}
                >
                  <Download size={16} /> Eksportér CSV
                </button>
              </div>
              <StorageNotice user={user} onLogin={() => setAuthOpen(true)} />
              {!storageReady && (
                <div className="inline-warning">
                  {authReady
                    ? "Lagring indlæses eller kan ikke tilgås. Kontrollér databaseopsætningen i Indstillinger."
                    : "Kontrollerer login…"}
                </div>
              )}
              {!leads.length ? (
                <Empty
                  icon={Bookmark}
                  title="Dit næste projekt venter derude"
                  text="Gem en virksomhed fra kortet. Tilføj noter, følg kontakten, og byg din egen pipeline."
                  action={() => setTab("Kort")}
                  label="Find dine første leads"
                />
              ) : (
                <div className="lead-grid">
                  {leads.map((l) => (
                    <LeadCard
                      key={l.business.id}
                      lead={{
                        ...l,
                        business: {
                          ...l.business,
                          status: overrides[l.business.id] || l.business.status,
                        },
                      }}
                      onOpen={() => choose(l.business)}
                      onUpdate={(patch) => updateLead(l.business.id, patch)}
                      onRemove={() => removeLead(l.business.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          {tab === "Statistik" && (
            <div className="page-content">
              <PageTitle
                eyebrow="DIT OVERBLIK"
                title="Muligheder i tal"
                description={`Baseret på ${all.length} faktisk indlæste virksomheder · ${area} · ${overview ? "importerede områder" : "seneste kortudsnit"}.`}
              />
              <div className="stats-grid">
                <Metric
                  label="Fundne virksomheder"
                  value={all.length}
                  icon={Building2}
                />
                <Metric
                  label="Potentielle kunder"
                  value={counts.missing + counts.improve}
                  icon={Target}
                />
                <Metric
                  label="Gemte leads"
                  value={leads.length}
                  icon={Bookmark}
                />
                <Metric
                  label="Undersøgte virksomheder"
                  value={all.length - counts.unknown}
                  icon={FileSearch}
                />
              </div>
              <div className="analytics-grid">
                <section className="panel">
                  <h3>Hjemmesidernes status</h3>
                  <p className="muted">
                    Faktiske vurderinger i dit indlæste datasæt
                  </p>
                  <div className="status-chart">
                    {(Object.keys(statuses) as Status[]).map((s) => (
                      <div key={s}>
                        <div>
                          <span>
                            <i
                              className="status-dot"
                              style={{ background: statuses[s].color }}
                            />
                            {statuses[s].label}
                          </span>
                          <b>{counts[s]}</b>
                        </div>
                        <div className="bar-track">
                          <i
                            style={{
                              width: `${all.length ? (counts[s] / all.length) * 100 : 0}%`,
                              background: statuses[s].color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="panel">
                  <h3>Din leadpipeline</h3>
                  <p className="muted">Status på dine gemte virksomheder</p>
                  <div className="pipeline">
                    {contactStatuses.map((s, i) => (
                      <div key={s}>
                        <span>
                          <i>{i + 1}</i>
                          {s}
                        </span>
                        <b>
                          {leads.filter((l) => l.contact_status === s).length}
                        </b>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              <div className="inline-info">
                <Info size={18} />
                <span>
                  Dette er ikke en landsdækkende optælling. Overture har
                  ufuldstændig dækning, og manglende webadresser er ikke
                  dokumentation for manglende hjemmesider.
                  {fetchedAt &&
                    ` Senest indlæst ${new Date(fetchedAt).toLocaleString("da-DK")}.`}
                </span>
              </div>
            </div>
          )}
          {tab === "Indstillinger" && (
            <div className="page-content settings-page">
              <PageTitle
                eyebrow="GØR WEBHUNT TIL DIT"
                title="Indstillinger"
                description="Din konto, dine data og et gennemsigtigt kig under motorhjelmen."
              />
              <section className="panel connection-panel">
                <div className="label-row">
                  <h3>Supabase-forbindelse</h3>
                  <button
                    className="button subtle small"
                    onClick={checkConnection}
                    disabled={healthBusy}
                  >
                    {healthBusy ? (
                      <LoaderCircle size={14} className="spin" />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                    Test forbindelsen
                  </button>
                </div>
                <p>
                  {supabaseHealth
                    ? supabaseHealth.auth === "ok"
                      ? "Loginserveren svarer."
                      : "Supabase-login kan ikke nås eller er ikke konfigureret."
                    : "Forbindelsen kontrolleres…"}
                </p>
                {supabaseHealth?.database === "missing" ? (
                  <div className="inline-warning">
                    Tabeller mangler: {supabaseHealth.missingTables.join(", ")}.
                    Kør supabase/schema.sql i Supabase → SQL Editor → New query
                    → Run. Test derefter forbindelsen igen.
                  </div>
                ) : supabaseHealth?.database === "protected" ? (
                  <p>
                    Tabellerne findes, og anonym adgang afvises. Log ind for at
                    teste dine egne leads. Isolation mellem brugere skal også
                    kontrolleres.
                  </p>
                ) : supabaseHealth?.database === "public-access" ? (
                  <p>
                    Database-endpointet svarer. Adgangspolitikker kan først
                    bekræftes med en test mellem to brugerkonti.
                  </p>
                ) : (
                  <p>Databasen er ikke verificeret endnu.</p>
                )}
              </section>
              <section className="panel">
                <div className="section-icon">
                  <ShieldCheck />
                  <h3>Konto og lagring</h3>
                </div>
                {user ? (
                  <>
                    <p>
                      Logget ind som <strong>{user.email}</strong>. Leads, noter
                      og vurderinger gemmes privat på din konto.
                    </p>
                    <button
                      className="button subtle"
                      onClick={async () => {
                        await sb?.auth.signOut();
                        notify("Du er logget ud");
                      }}
                    >
                      <LogOut size={16} /> Log ud
                    </button>
                  </>
                ) : (
                  <>
                    <StorageNotice
                      user={null}
                      onLogin={() => setAuthOpen(true)}
                    />
                    <p>
                      {sb
                        ? "Supabase er tilsluttet. Log ind for privat datalagring på tværs af enheder."
                        : "Supabase er ikke konfigureret. Udforsk kortet og gem leads i denne browser. Lokal lagring er ikke en database og følger ikke med til andre enheder."}
                    </p>
                    <button
                      className="button primary"
                      onClick={() => setAuthOpen(true)}
                    >
                      <LogIn size={16} /> Log ind / opret konto
                    </button>
                  </>
                )}
              </section>
              <section className="panel">
                <div className="section-icon">
                  <Map />
                  <h3>Kortgrundlag</h3>
                </div>
                <p>
                  Et lokalt Natural Earth-oversigtskort viser Danmark og øerne
                  uden eksterne kortfliser. Det er generaliserede landegrænser
                  og indeholder ikke gadenavne. Zoom, bysøgning og
                  virksomhedsmarkører fungerer stadig.
                </p>
                <p>
                  {process.env.NEXT_PUBLIC_MAPTILER_KEY
                    ? "MapTiler Streets Light er konfigureret med bynavne, gader og bygninger. Hvis udbyderen afviser adgang, stoppes forespørgslerne, og oversigtskortet vises."
                    : "For gade- og detaljekort skal administratoren oprette en MapTiler-konto, vælge en passende plan og konfigurere NEXT_PUBLIC_MAPTILER_KEY med domænebegrænsning."}
                </p>
                <a
                  href="https://cloud.maptiler.com/account/keys/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Åbn MapTiler API keys <ArrowUpRight size={13} />
                </a>
                <p>
                  Kortgrundlag og virksomhedsdata er separate tjenester. Et
                  synligt kort betyder ikke, at virksomhedsdatasættet er
                  indlæst.
                </p>
              </section>
              <section className="panel">
                <div className="section-icon">
                  <Globe />
                  <h3>Datakilder og dækning</h3>
                </div>
                <p>
                  Virksomheder læses fra WebHunts egen database. Overture Places
                  importeres separat fra kortvisningen; en ekstern driftsfejl
                  fjerner ikke tidligere importerede virksomheder. Første område
                  er Nykøbing Falster. Andre områder er ikke dækket, før de er
                  importeret.
                </p>
                <p>
                  Overture er en stedfortegnelse og ikke et komplet
                  CVR-register. Manglende kontaktoplysninger betyder kun, at de
                  ikke findes i kilden. Nye virksomheder starter altid som “Ikke
                  undersøgt”.
                </p>
                <p>
                  Overture Maps Foundation og de oprindelige dataleverandører.
                  Licens og udgivelse bevares pr. virksomhed og i CSV-eksporten.
                  <a
                    href="/licenses/overture-notice.txt"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Kilder og licenser <ExternalLink size={12} />
                  </a>
                </p>
              </section>
              <section className="panel">
                <div className="section-icon">
                  <FileSearch />
                  <h3>Teknisk hjemmesideanalyse</h3>
                </div>
                <p>
                  Google PageSpeed Insights undersøger mobilperformance, SEO og
                  tilgængelighed. Scoren er gennemsnittet af de returnerede
                  kategorier. 85 eller højere og HTTPS giver grøn status; øvrige
                  gennemførte analyser giver orange. En teknisk score vurderer
                  ikke det visuelle design.
                </p>
                <p>
                  Analysen kan tage op til 100 sekunder. Hvis Google ikke svarer
                  eller kvoten er opbrugt, sættes status til “Ikke undersøgt”.
                  En servernøgle til PageSpeed kan tilføjes af administratoren.
                </p>
              </section>
              <section className="panel">
                <h3>Privatliv og ansvarlig brug</h3>
                <p>
                  Gem kun kontaktoplysninger, du har et lovligt formål med at
                  bruge. Offentlige oplysninger er ikke et samtykke til
                  markedsføring. Overhold GDPR og de danske regler for uanmodet
                  elektronisk markedsføring. Du kan slette hvert lead under Mine
                  leads.
                </p>
                <p>
                  Virksomhedssøgninger læses fra egen database. Kun bysøgning
                  efter nye stednavne sendes til Nominatim. Hjemmesideadresser
                  sendes til Google, når du vælger at analysere. Oversigtskortet
                  indlæses lokalt fra Natural Earth (public domain). Hvis
                  MapTiler er konfigureret, sendes kortforespørgsler direkte til
                  MapTiler. OpenStreetMaps standardkortfliser bruges ikke.
                </p>
              </section>
            </div>
          )}
        </main>
        {current && (
          <>
            <button
              className="drawer-backdrop"
              aria-label="Luk virksomhedspanel"
              onClick={() => setSelected(null)}
            />
            <aside
              className="business-drawer"
              aria-label="Virksomhedsoplysninger"
            >
              <div className="drawer-top">
                <span className="eyebrow">VIRKSOMHEDSOVERBLIK</span>
                <button
                  className="icon-button"
                  onClick={() => setSelected(null)}
                  aria-label="Luk virksomhed"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="drawer-body">
                <div className="business-avatar">
                  <Building2 size={32} />
                  <span
                    className="status-dot"
                    style={{ background: statuses[current.status].color }}
                  />
                </div>
                <span className="category-tag">{current.category}</span>
                <h2>{current.name}</h2>
                <StatusBadge status={current.status} />
                <div className="contact-details">
                  <div>
                    <MapPin size={17} />
                    <span>
                      {current.address}
                      <small>
                        {[current.postcode, current.city]
                          .filter(Boolean)
                          .join(" ") || "By og postnummer ikke registreret"}
                      </small>
                    </span>
                  </div>
                  <div>
                    <Phone size={17} />
                    {current.phone ? (
                      <a href={`tel:${current.phone.replace(/[^+\d]/g, "")}`}>
                        {current.phone}
                      </a>
                    ) : (
                      <span className="muted">Telefon ikke registreret</span>
                    )}
                  </div>
                  <div>
                    <Globe size={17} />
                    {current.website ? (
                      <a
                        href={current.website}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {new URL(current.website).hostname}
                        <ArrowUpRight size={14} />
                      </a>
                    ) : (
                      <span className="muted">Hjemmeside ikke registreret</span>
                    )}
                  </div>
                </div>
                <div className="drawer-actions">
                  {current.website && (
                    <a
                      className="button subtle"
                      href={current.website}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Besøg hjemmeside <ArrowUpRight size={16} />
                    </a>
                  )}
                  <button
                    className="button subtle"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          [
                            current.name,
                            current.address,
                            current.postcode,
                            current.city,
                            current.phone,
                            current.website,
                          ]
                            .filter(Boolean)
                            .join("\n"),
                        );
                        notify("Kontaktoplysninger kopieret");
                      } catch {
                        notify(
                          "Browseren tillader ikke kopiering. Markér og kopiér oplysningerne manuelt.",
                        );
                      }
                    }}
                  >
                    <Copy size={15} /> Kopiér kontakt
                  </button>
                </div>
                <div className="drawer-section">
                  <div className="label-row">
                    <h3>Hjemmesideanalyse</h3>
                    <Sparkles size={17} className="mint" />
                  </div>
                  {analyses[current.id] ? (
                    <>
                      <div className="score-row">
                        <strong>
                          {analyses[current.id].score}
                          <small>/100</small>
                        </strong>
                        <span>
                          Teknisk score
                          <br />
                          <small>Mobil · PageSpeed Insights</small>
                        </span>
                      </div>
                      <div className="score-categories">
                        <span>
                          Performance{" "}
                          <b>{analyses[current.id].performance ?? "—"}</b>
                        </span>
                        <span>
                          SEO <b>{analyses[current.id].seo ?? "—"}</b>
                        </span>
                        <span>
                          Tilgængelighed{" "}
                          <b>{analyses[current.id].accessibility ?? "—"}</b>
                        </span>
                      </div>
                      <ul className="findings">
                        {analyses[current.id].findings.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                      <p className="micro">
                        Analyseret{" "}
                        {new Date(
                          analyses[current.id].checkedAt,
                        ).toLocaleString("da-DK")}
                        . Teknisk kvalitet er ikke en designvurdering.
                      </p>
                    </>
                  ) : (
                    <div className="analysis-empty">
                      <FileSearch size={25} />
                      <p>
                        {current.website
                          ? "Få indsigt i mobilperformance, SEO og tekniske forbedringer."
                          : "Ingen webadresse registreret. Undersøg virksomheden, før du vurderer dens hjemmeside."}
                      </p>
                    </div>
                  )}
                  {current.website && (
                    <button
                      className="button analysis-button"
                      disabled={analyzing || !storageReady}
                      onClick={() => analyze(current)}
                    >
                      {analyzing ? (
                        <LoaderCircle size={16} className="spin" />
                      ) : (
                        <Sparkles size={16} />
                      )}{" "}
                      {analyzing
                        ? "Analyserer · op til 100 sek."
                        : analyses[current.id]
                          ? "Kør analyse igen"
                          : "Analysér hjemmeside"}
                    </button>
                  )}
                  {analysisError && (
                    <p className="error-text" role="alert">
                      {analysisError}
                    </p>
                  )}
                </div>
                <div className="drawer-section">
                  <label htmlFor="manual-status" className="field-label">
                    DIN VURDERING
                  </label>
                  <select
                    id="manual-status"
                    className="full-select"
                    value={current.status}
                    disabled={!storageReady || analyzing}
                    onChange={async (e) => {
                      try {
                        await changeStatus(
                          current.id,
                          e.target.value as Status,
                        );
                        notify("Din vurdering er gemt");
                      } catch (err) {
                        notify((err as Error).message);
                      }
                    }}
                  >
                    {(Object.keys(statuses) as Status[]).map((s) => (
                      <option key={s} value={s}>
                        {statuses[s].label}
                      </option>
                    ))}
                  </select>
                  <p className="micro">
                    Manuelle vurderinger er dine egne. Rød betyder sandsynligvis
                    ingen hjemmeside, aldrig blot manglende data.
                  </p>
                </div>
                <a
                  className="source-link"
                  href={current.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Se virksomhedens kilde i {current.source || "OpenStreetMap"}{" "}
                  <ExternalLink size={13} />
                </a>
              </div>
              {current.sourceRelease && (
                <p className="micro" style={{ padding: "0 24px" }}>
                  Overture-udgivelse: {current.sourceRelease}. Kilder:{" "}
                  {current.sourceDatasets?.join(", ")}. Licens:{" "}
                  {current.licenses?.join(", ")}. Oplysningerne kan være
                  ufuldstændige eller forældede.
                </p>
              )}
              <div className="drawer-footer">
                <button
                  className="button primary"
                  disabled={saving || !storageReady}
                  onClick={() => saveLead(current)}
                >
                  {saving ? (
                    <LoaderCircle size={17} className="spin" />
                  ) : leads.some((l) => l.business.id === current.id) ? (
                    <Check size={17} />
                  ) : (
                    <Bookmark size={17} />
                  )}{" "}
                  {leads.some((l) => l.business.id === current.id)
                    ? "Gemt · se i Mine leads"
                    : "Gem som lead"}
                  <ArrowRight size={16} />
                </button>
                <small>
                  {user ? "Privat på din konto" : "Gemmes kun i denne browser"}
                </small>
              </div>
            </aside>
          </>
        )}
      </div>
      <footer className="app-footer">
        <span>© {new Date().getFullYear()} WebHunt</span>
        <span>Byg forbindelser. Skab noget bedre.</span>
        <button onClick={() => setTab("Indstillinger")}>
          Data & privatliv <ArrowUpRight size={12} />
        </button>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <CircleCheck size={18} />
          {toast}
          <button onClick={() => setToast("")} aria-label="Luk besked">
            <X size={15} />
          </button>
        </div>
      )}
      {authOpen && (
        <AuthModal
          recovery={recovery}
          configured={!!sb}
          onClose={() => setAuthOpen(false)}
          onSuccess={(message) => {
            notify(message);
            setAuthOpen(false);
            setRecovery(false);
          }}
        />
      )}
    </div>
  );
}
function PageTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-title">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
function StatusBadge({ status }: { status: Status }) {
  return (
    <span className="status-badge" data-status={status}>
      <i
        className="status-dot"
        style={{ background: statuses[status].color }}
      />
      {statuses[status].label}
    </span>
  );
}
function Empty({
  icon: Icon,
  title,
  text,
  action,
  label,
}: {
  icon: typeof Building2;
  title: string;
  text: string;
  action: () => void;
  label: string;
}) {
  return (
    <div className="empty-state">
      <span>
        <Icon size={32} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="button primary" onClick={action}>
        {label}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
function StorageNotice({
  user,
  onLogin,
}: {
  user: User | null;
  onLogin: () => void;
}) {
  return user ? (
    <div className="inline-info">
      <ShieldCheck size={17} />
      <span>Privat database · kun din konto har adgang til dine leads.</span>
    </div>
  ) : (
    <div className="inline-info">
      <Info size={17} />
      <span>Du bruger lokal tilstand. Leads gemmes kun i denne browser.</span>
      <button onClick={onLogin}>
        Tilslut konto <ArrowUpRight size={13} />
      </button>
    </div>
  );
}
function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Building2;
}) {
  return (
    <div className="metric">
      <Icon size={21} />
      <strong>{value.toLocaleString("da-DK")}</strong>
      <span>{label}</span>
    </div>
  );
}
function LeadCard({
  lead,
  onOpen,
  onUpdate,
  onRemove,
}: {
  lead: Lead;
  onOpen: () => void;
  onUpdate: (p: Partial<Lead>) => Promise<void>;
  onRemove: () => void;
}) {
  const [notes, setNotes] = useState(lead.notes),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  useEffect(() => setNotes(lead.notes), [lead.notes]);
  return (
    <article className="lead-card">
      <div className="label-row">
        <span className="category-tag">{lead.business.category}</span>
        <span className="micro">
          {new Date(lead.created_at).toLocaleDateString("da-DK")}
        </span>
      </div>
      <button className="lead-name" onClick={onOpen}>
        {lead.business.name}
        <ArrowUpRight size={16} />
      </button>
      <p className="muted">
        {[lead.business.address, lead.business.city].filter(Boolean).join(", ")}
      </p>
      <StatusBadge status={lead.business.status} />
      <div className="lead-contact">
        {lead.business.phone && (
          <a href={`tel:${lead.business.phone.replace(/[^+\d]/g, "")}`}>
            <Phone size={13} />
            {lead.business.phone}
          </a>
        )}
        {lead.business.website && (
          <a href={lead.business.website} target="_blank" rel="noreferrer">
            <Globe size={13} />
            {new URL(lead.business.website).hostname}
          </a>
        )}
      </div>
      <label className="field-label" htmlFor={`contact-${lead.business.id}`}>
        KONTAKTSTATUS
      </label>
      <select
        id={`contact-${lead.business.id}`}
        className="full-select"
        value={lead.contact_status}
        onChange={(e) =>
          onUpdate({ contact_status: e.target.value as ContactStatus })
        }
      >
        {contactStatuses.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <label className="field-label" htmlFor={`notes-${lead.business.id}`}>
        DINE NOTER
      </label>
      <textarea
        id={`notes-${lead.business.id}`}
        value={notes}
        maxLength={10000}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="En god indgangsvinkel, næste skridt…"
      />
      <div className="label-row">
        <button
          className="text-button danger"
          onClick={() => (confirm ? onRemove() : setConfirm(true))}
        >
          {confirm ? "Bekræft fjernelse" : "Fjern lead"}
        </button>
        <button
          className="button subtle small"
          disabled={busy || notes === lead.notes}
          onClick={async () => {
            setBusy(true);
            await onUpdate({ notes });
            setBusy(false);
          }}
        >
          {busy ? (
            <LoaderCircle size={14} className="spin" />
          ) : (
            <Check size={14} />
          )}{" "}
          Gem note
        </button>
      </div>
    </article>
  );
}
function AuthModal({
  configured,
  onClose,
  onSuccess,
  recovery,
}: {
  recovery: boolean;
  configured: boolean;
  onClose: () => void;
  onSuccess: (s: string) => void;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "reset" | "update">(
      recovery ? "update" : "login",
    ),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="icon-button modal-close"
          onClick={onClose}
          aria-label="Luk login"
        >
          <X size={20} />
        </button>
        <span className="brand-icon">
          <HuntMark size={30} />
        </span>
        <span className="eyebrow">DIN NÆSTE GODE FORBINDELSE</span>
        <h2 id="auth-title">
          {mode === "update"
            ? "Vælg en ny adgangskode."
            : mode === "signup"
              ? "Velkommen til WebHunt."
              : mode === "reset"
                ? "Glemt adgangskoden?"
                : "Godt at se dig igen."}
        </h2>
        <p>
          {configured
            ? "Gem dine leads sikkert og fortsæt på tværs af enheder."
            : "Login kræver, at Supabase tilsluttes. Kort, søgning og lokale leads kan bruges imens."}
        </p>
        {configured ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const sb = getSupabase()!;
                if (mode === "update") {
                  const { error } = await sb.auth.updateUser({ password });
                  if (error) throw error;
                  onSuccess("Din adgangskode er opdateret");
                } else if (mode === "reset") {
                  const { error } = await sb.auth.resetPasswordForEmail(email, {
                    redirectTo:
                      window.location.origin + "/auth/callback?recovery=1",
                  });
                  if (error) throw error;
                  onSuccess(
                    "Hvis kontoen findes, får du en e-mail til nulstilling.",
                  );
                } else if (mode === "signup") {
                  const { data, error } = await sb.auth.signUp({
                    email,
                    password,
                    options: {
                      emailRedirectTo:
                        window.location.origin + "/auth/callback",
                    },
                  });
                  if (error) throw error;
                  onSuccess(
                    data.session
                      ? "Din konto er oprettet"
                      : "Bekræft din e-mail via linket, og log derefter ind.",
                  );
                } else {
                  const { error } = await sb.auth.signInWithPassword({
                    email,
                    password,
                  });
                  if (error) throw error;
                  onSuccess("Du er logget ind");
                }
              } catch {
                setError(
                  "Login kunne ikke gennemføres. Kontrollér oplysningerne og Supabase-opsætningen.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {mode !== "update" && (
              <>
                <label htmlFor="email">E-mail</label>
                <input
                  id="email"
                  autoFocus
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="dig@virksomhed.dk"
                />
              </>
            )}
            {mode !== "reset" && (
              <>
                <label htmlFor="password">Adgangskode</label>
                <input
                  id="password"
                  type="password"
                  minLength={8}
                  maxLength={128}
                  autoComplete={
                    mode === "signup" || mode === "update"
                      ? "new-password"
                      : "current-password"
                  }
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mindst 8 tegn"
                />
              </>
            )}
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <ArrowRight size={17} />
              )}{" "}
              {mode === "update"
                ? "Gem ny adgangskode"
                : mode === "signup"
                  ? "Opret konto"
                  : mode === "reset"
                    ? "Send nulstillingslink"
                    : "Log ind"}
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setMode(mode === "signup" ? "login" : "signup");
                setError("");
              }}
            >
              {mode === "signup"
                ? "Har du en konto? Log ind"
                : "Ny her? Opret en konto"}
            </button>
            {mode === "login" && (
              <button
                className="text-button"
                type="button"
                onClick={() => setMode("reset")}
              >
                Glemt adgangskode?
              </button>
            )}
          </form>
        ) : (
          <div className="setup-instructions">
            <ol>
              <li>Opret et projekt på supabase.com.</li>
              <li>
                Kør <code>supabase/schema.sql</code> i SQL Editor.
              </li>
              <li>
                Tilføj projektets URL og offentlige anon-nøgle i{" "}
                <code>.env.local</code> som beskrevet i README.
              </li>
              <li>Genstart appen og opret din konto.</li>
            </ol>
            <button className="button primary" onClick={onClose}>
              Fortsæt med kortet <ArrowRight size={16} />
            </button>
          </div>
        )}
        <small className="micro">
          Dine lokale leads forbliver i browseren, når du logger ind. Kontoens
          leads gemmes separat.
        </small>
      </section>
    </div>
  );
}
