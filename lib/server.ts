import { NextRequest, NextResponse } from "next/server";
const buckets = new Map<string, { count: number; until: number }>();
export function rateLimit(
  req: NextRequest,
  scope: string,
  max: number,
  window = 60_000,
) {
  const key = `${scope}:${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "shared"}`;
  const now = Date.now();
  for (const [k, v] of buckets) if (v.until < now) buckets.delete(k);
  const b = buckets.get(key);
  if (b && b.until > now && b.count >= max)
    return NextResponse.json(
      { error: "For mange forespørgsler. Vent et øjeblik og prøv igen." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((b.until - now) / 1000)) },
      },
    );
  if (buckets.size >= 10000 && !buckets.has(key))
    return NextResponse.json(
      { error: "Tjenesten er optaget. Prøv igen om lidt." },
      { status: 503 },
    );
  buckets.set(key, {
    count: b && b.until > now ? b.count + 1 : 1,
    until: b && b.until > now ? b.until : now + window,
  });
  return null;
}
export const agent =
  "WebHunt/1.0 (OpenStreetMap business discovery; https://github.com/antonfrederik101-ux/WebHunt)";
