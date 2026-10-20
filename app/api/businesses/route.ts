import { dataLicenseTexts } from "@/lib/data-licenses";
import { NextRequest, NextResponse } from "next/server";
import { parseBounds } from "@/lib/businesses";
import { rateLimit } from "@/lib/server";
import { CatalogNotReady } from "@/lib/business-catalog";
import { catalogBusinesses } from "@/lib/catalog-service";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, "businesses", 24);
  if (limited) return limited;
  let bounds: number[] | null;
  try {
    bounds = parseBounds(req.nextUrl.searchParams.get("bbox"));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  try {
    const result = await catalogBusinesses(bounds);
    return NextResponse.json(
      { ...result, licenseTexts: dataLicenseTexts },
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof CatalogNotReady
            ? e.message
            : "Virksomhedsdata kunne ikke læses. Kontrollér serverens datalager.",
        businesses: [],
        retryAfter: 0,
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
