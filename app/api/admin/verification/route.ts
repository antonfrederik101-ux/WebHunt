import { websiteDetails } from "@/lib/websites";
import { NextResponse, type NextRequest } from "next/server";
import { getCatalog } from "@/lib/business-catalog";
import { adminAuthorized } from "@/lib/admin-auth";
import { rateLimit } from "@/lib/server";
import { defaultIdentity, recordHash } from "@/lib/verification-store";
import { verificationReport } from "@/lib/verification-runner";
import { presentBusiness } from "@/lib/business-status";
import type { Business } from "@/lib/types";
import type { ActivityState } from "@/lib/verification-types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
function guard(req: NextRequest) {
  return (
    rateLimit(req, "admin", 60) ||
    (!adminAuthorized(req)
      ? json({ error: "Administratoradgang kræves." }, 401)
      : null) ||
    (process.env.WEBHUNT_CATALOG_BACKEND === "supabase"
      ? json(
          {
            error:
              "Kontroloversigten understøtter den vedvarende SQLite-katalogdatabase. Supabase-katalog kræver en separat workerintegration.",
          },
          501,
        )
      : null)
  );
}
export function GET(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;
  const catalog = getCatalog(),
    store = catalog.verification;
  const records = catalog.db
    .prepare(
      "SELECT p.record,coalesce(a.retired_at,'') AS retired FROM catalog_places p LEFT JOIN catalog_retired a ON a.business_id=p.business_id ORDER BY p.business_id",
    )
    .all()
    .map(
      (r) =>
        ({
          ...JSON.parse(String(r.record)),
          archivedAt: r.retired,
        }) as Business & { archivedAt: string },
    );
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const b = records.find((x) => x.id === id);
    return b
      ? json({
          business: {
            ...presentBusiness({ ...b, verification: store.get(b) }),
            verification: store.get(b) || {
              identity: defaultIdentity(b),
              duplicateOf: undefined,
            },
          },
          history: store.history(id),
        })
      : json({ error: "Virksomheden findes ikke." }, 404);
  }
  const state = req.nextUrl.searchParams.get("state") || "",
    q = req.nextUrl.searchParams.get("q")?.toLowerCase() || "";
  const offset = Number(req.nextUrl.searchParams.get("offset") || 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 500000)
    return json({ error: "Ugyldig side." }, 400);
  const items = records
    .map((b) => ({
      ...presentBusiness({ ...b, verification: store.get(b) }),
      verification: store.get(b) || {
        identity: defaultIdentity(b),
        duplicateOf: undefined,
      },
    }))
    .filter(
      (b) =>
        (!state ||
          b.verification.identity.state === state ||
          (state === "duplicate" && b.verification.duplicateOf)) &&
        (!q ||
          `${b.name} ${b.address} ${b.cvr || ""}`.toLowerCase().includes(q)),
    );
  return json({
    counts: verificationReport(store, records),
    items: items.slice(offset, offset + 100),
    matched: items.length,
    nextOffset: offset + 100 < items.length ? offset + 100 : null,
    jobs: catalog.db
      .prepare(
        "SELECT j.id,j.created_at,t.state,count(*) AS count FROM verification_jobs j LEFT JOIN verification_tasks t ON t.job_id=j.id GROUP BY j.id,t.state ORDER BY j.created_at DESC LIMIT 40",
      )
      .all(),
  });
}
export async function POST(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;
  if (
    req.headers.get("origin") &&
    new URL(req.headers.get("origin")!).host !==
      (req.headers.get("x-forwarded-host") || req.headers.get("host"))
  )
    return json({ error: "Forkert origin." }, 403);
  if (Number(req.headers.get("content-length") || 0) > 10000)
    return json({ error: "For stort input." }, 413);
  let body;
  try {
    const text = await req.text();
    if (text.length > 10000) return json({ error: "For stort input." }, 413);
    body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error();
  } catch {
    return json({ error: "Ugyldigt input." }, 400);
  }
  const catalog = getCatalog(),
    store = catalog.verification;
  const row = catalog.db
    .prepare("SELECT record FROM catalog_places WHERE business_id=?")
    .get(typeof body.id === "string" ? body.id : "");
  if (!row) return json({ error: "Virksomheden findes ikke." }, 404);
  const b = JSON.parse(String(row.record)) as Business;
  const states: ActivityState[] = [
    "active",
    "closed",
    "uncertain",
    "missing_data",
  ];
  if (
    !states.includes(body.state) ||
    typeof body.reason !== "string" ||
    body.reason.trim().length < 20 ||
    body.reason.length > 1500
  )
    return json(
      {
        error:
          "Angiv en status og en konkret kildebegrundelse på 20–1500 tegn.",
      },
      400,
    );
  let source: URL;
  try {
    source = new URL(body.sourceUrl);
    if (
      source.protocol !== "https:" ||
      source.username ||
      source.password ||
      source.port ||
      ![
        "datacvr.virk.dk",
        "www.openstreetmap.org",
        "explore.overturemaps.org",
      ].includes(source.hostname)
    )
      throw new Error();
  } catch {
    return json(
      {
        error:
          "Brug en HTTPS-kildeside fra offentligt CVR, OpenStreetMap eller Overture. Oplys kun virksomhedsrelaterede fakta.",
      },
      400,
    );
  }
  if (
    (body.state === "active" || body.state === "closed") &&
    body.identityConfirmed !== true
  )
    return json(
      {
        error:
          "Bekræft at navn og adresse eller CVR-nummer identificerer netop denne virksomhed.",
      },
      400,
    );
  const links = websiteDetails(body.website || "");
  if (body.website && typeof body.website !== "string")
    return json({ error: "Ugyldig hjemmesideadresse." }, 400);
  if (body.website && !links.website && !links.socialProfiles.length)
    return json(
      { error: "Brug en offentlig HTTP-/HTTPS-adresse uden adgangskoder." },
      400,
    );
  const previous = store.get(b),
    at = new Date().toISOString();
  store.save(b, {
    ...previous,
    recordHash: recordHash(b),
    identity: {
      state: body.state,
      checkedAt: at,
      source: "Manuelt kildecheck af administrator",
      sourceUrl: source.href,
      reason: body.reason.trim(),
      addressMatch: body.identityConfirmed ? "same" : "unknown",
      cvr: b.cvr || /\/virksomhed\/(\d{8})(?:\/|$)/.exec(source.pathname)?.[1],
    },
    lastAttemptAt: at,
    ...(links.website
      ? {
          website: {
            state: "failed",
            url: links.website,
            checkedAt: at,
            reason:
              "Hjemmeside registreret ved manuelt kildecheck. Teknisk kontrol afventer.",
            issues: [],
          },
        }
      : {}),
    websiteSearch:
      body.websiteSearchCompleted === true && body.state === "active"
        ? {
            complete: true,
            checkedAt: at,
            sources: [source.href, b.source || "Import"],
            reason:
              "Administrator har gennemgået registrerede hjemmesider i den angivne kilde og importoplysningerne.",
          }
        : undefined,
  });
  return json({ saved: true, history: store.history(b.id) });
}
