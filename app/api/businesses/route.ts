import { NextRequest, NextResponse } from "next/server";
import { parseBounds } from "@/lib/businesses";
import { rateLimit } from "@/lib/server";
import { osmService, SourceUnavailable } from "@/lib/osm-service";
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
    const result = await osmService.get(bounds);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    const retry = e instanceof SourceUnavailable ? e.retryAfter : 120;
    return NextResponse.json(
      {
        error:
          e instanceof SourceUnavailable
            ? e.message
            : "Virksomhedsdata kunne ikke læses. Kontrollér serverens datalager.",
        businesses: [],
        retryAfter: retry,
      },
      {
        status: 503,
        headers: { "Retry-After": String(retry), "Cache-Control": "no-store" },
      },
    );
  }
}
