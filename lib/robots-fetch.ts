import { publicWebsite } from "./analysis";
import type { PageResponse } from "./safe-http";

/** Follow ordinary robots redirects without bypassing DNS or request budgets. */
export async function fetchRobots(
  origin: string,
  request: (url: string, limit?: number) => Promise<PageResponse>,
  resolve: (url: string) => Promise<unknown>,
): Promise<PageResponse> {
  let current = new URL("/robots.txt", origin).href;
  const visited = new Set<string>();
  for (let hop = 0; hop <= 5; hop++) {
    if (visited.has(current)) throw new Error("robots.txt: redirect-løkke.");
    visited.add(current);
    await resolve(current);
    const response = await request(current, 200000);
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    if (!response.headers.location)
      throw new Error(`robots.txt: HTTP ${response.status} uden Location.`);
    if (hop === 5) throw new Error("robots.txt: mere end fem redirects.");
    const next = new URL(response.headers.location, current).href;
    if (!publicWebsite(next))
      throw new Error("robots.txt: redirect til usikker adresse er afvist.");
    if (current.startsWith("https:") && !next.startsWith("https:"))
      throw new Error("robots.txt: HTTPS til HTTP er afvist.");
    current = next;
  }
  throw new Error("robots.txt: redirect-grænse nået.");
}
