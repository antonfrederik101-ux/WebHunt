import { NextRequest, NextResponse } from "next/server";
import { agent, rateLimit } from "@/lib/server";
let last = 0;
const cache = new Map<string, unknown>();
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, "geocode", 10);
  if (limited) return limited;
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length > 100)
    return NextResponse.json(
      { error: "Indtast en dansk by eller et postnummer." },
      { status: 400 },
    );
  if (cache.has(q)) return NextResponse.json(cache.get(q));
  if (Date.now() - last < 1100)
    return NextResponse.json(
      { error: "Vent et øjeblik mellem stedssøgninger." },
      { status: 429 },
    );
  last = Date.now();
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.search = new URLSearchParams({
      q,
      countrycodes: "dk",
      format: "json",
      limit: "1",
    }).toString();
    const r = await fetch(url, {
      headers: { "User-Agent": agent, "Accept-Language": "da" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) throw new Error();
    const rows = await r.json();
    const result = rows.length
      ? {
          lat: Number(rows[0].lat),
          lon: Number(rows[0].lon),
          name: rows[0].display_name,
        }
      : { error: "Stedet blev ikke fundet i Danmark." };
    if (cache.size > 200) cache.clear();
    cache.set(q, result);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        error:
          "Stedssøgningen er utilgængelig. Vælg en af byerne eller flyt kortet.",
      },
      { status: 502 },
    );
  }
}
