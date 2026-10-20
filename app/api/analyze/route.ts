import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/server";
import { publicWebsite, summarizeLighthouse } from "@/lib/analysis";
export const maxDuration = 120;
const cache = new Map<
  string,
  { at: number; data: ReturnType<typeof summarizeLighthouse> }
>();
let activeAnalyses = 0;
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "analysis", 5, 300_000);
  if (limited) return limited;
  let url: string | null;
  try {
    url = publicWebsite((await req.json()).url);
  } catch {
    return NextResponse.json(
      { error: "Ugyldig forespørgsel." },
      { status: 400 },
    );
  }
  if (!url)
    return NextResponse.json(
      { error: "En offentlig HTTP- eller HTTPS-hjemmeside er påkrævet." },
      { status: 400 },
    );
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < 86_400_000)
    return NextResponse.json(hit.data);
  if (activeAnalyses >= 2)
    return NextResponse.json(
      { error: "To analyser kører allerede. Prøv igen om lidt." },
      { status: 503, headers: { "Retry-After": "30" } },
    );
  activeAnalyses++;
  try {
    const target = new URL(
      "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
    );
    target.searchParams.set("url", url);
    target.searchParams.set("strategy", "mobile");
    for (const c of ["performance", "seo", "accessibility"])
      target.searchParams.append("category", c);
    if (process.env.PAGESPEED_API_KEY)
      target.searchParams.set("key", process.env.PAGESPEED_API_KEY);
    const response = await fetch(target, {
      signal: AbortSignal.timeout(100_000),
    });
    if (!response.ok)
      return NextResponse.json(
        {
          error:
            response.status === 429
              ? "Google PageSpeed-kvoten er opbrugt. Tilføj en servernøgle eller prøv igen senere. Status er ikke undersøgt."
              : "PageSpeed kunne ikke analysere hjemmesiden. Kontrollér adressen eller prøv igen senere. Status er ikke undersøgt.",
        },
        { status: 502 },
      );
    const body = await response.json();
    if (!body.lighthouseResult || body.lighthouseResult.runtimeError)
      throw new Error();
    const data = summarizeLighthouse(body.lighthouseResult, url);
    if (cache.size > 500) cache.clear();
    cache.set(url, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      {
        error:
          "Analysen kunne ikke gennemføres. Hjemmesiden er ikke undersøgt. Prøv igen senere.",
      },
      { status: 502 },
    );
  } finally {
    activeAnalyses--;
  }
}
