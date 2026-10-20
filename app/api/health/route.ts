import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/server";
import { checkSupabase } from "@/lib/supabase-health";
export const dynamic = "force-dynamic";
let cached: {
  at: number;
  data: Awaited<ReturnType<typeof checkSupabase>>;
} | null = null;
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, "health", 10);
  if (limited) return limited;
  if (!cached || Date.now() - cached.at > 30000)
    cached = { at: Date.now(), data: await checkSupabase() };
  return NextResponse.json(
    { name: "WebHunt", supabase: cached.data },
    { headers: { "Cache-Control": "no-store" } },
  );
}
