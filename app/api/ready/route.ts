import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
// Readiness is local: unavailable external sources must not prevent the preview from opening.
export function GET() {
  return NextResponse.json(
    { name: "WebHunt", ready: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
