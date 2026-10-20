import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/server";
import { publicWebsite } from "@/lib/analysis";
import { getCatalog } from "@/lib/business-catalog";
import { inspectWebsite } from "@/lib/website-inspector";
import { recordHash, defaultIdentity } from "@/lib/verification-store";
import { websiteDetails } from "@/lib/websites";
import type { Business } from "@/lib/types";
export const maxDuration = 180;
export const runtime = "nodejs";
let active = 0;
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "analysis", 5, 300000);
  if (limited) return limited;
  let input;
  try {
    const text = await req.text();
    if (text.length > 5000) throw new Error();
    input = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Ugyldig forespørgsel." },
      { status: 400 },
    );
  }
  const url = publicWebsite(input?.url);
  if (!url)
    return NextResponse.json(
      { error: "En offentlig HTTP- eller HTTPS-hjemmeside er påkrævet." },
      { status: 400 },
    );
  if (active >= 2)
    return NextResponse.json(
      { error: "To kontroller kører allerede. Prøv igen senere." },
      { status: 503, headers: { "Retry-After": "30" } },
    );
  active++;
  try {
    const catalog = getCatalog(),
      store = catalog.verification;
    const check = await inspectWebsite(url, store);
    // Anonymous callers may add measured facts only for the actual registered URL;
    // they cannot assert activity, change a URL or overwrite personal assessments.
    if (typeof input.businessId === "string") {
      const row = catalog.db
        .prepare("SELECT record FROM catalog_places WHERE business_id=?")
        .get(input.businessId);
      if (row) {
        const b = JSON.parse(String(row.record)) as Business,
          previous = store.get(b);
        if (
          websiteDetails(b.website).website === url ||
          previous?.website?.url === url
        )
          store.save(b, {
            ...previous,
            recordHash: recordHash(b),
            identity: previous?.identity || defaultIdentity(b),
            website: check,
            lastAttemptAt: previous?.lastAttemptAt || check.checkedAt,
          });
      }
    }
    if (
      !check.analysis ||
      check.analysis.score === null ||
      check.state !== "checked"
    )
      return NextResponse.json(
        { error: check.reason, check },
        {
          status: check.state === "deferred" ? 429 : 502,
          headers: {
            "Cache-Control": "no-store",
            ...(check.retryAt
              ? {
                  "Retry-After": String(
                    Math.max(
                      1,
                      Math.ceil(
                        (Date.parse(check.retryAt) - Date.now()) / 1000,
                      ),
                    ),
                  ),
                }
              : {}),
          },
        },
      );
    return NextResponse.json(
      { ...check.analysis, check },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Kontrollen kunne ikke gennemføres sikkert. Ingen ny hjemmesideklassificering er gemt.",
      },
      { status: 502 },
    );
  } finally {
    active--;
  }
}
