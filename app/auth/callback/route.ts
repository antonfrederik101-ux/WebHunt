import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code"),
    url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (code && url && key) {
    const store = await cookies();
    const sb = createServerClient(url, key, {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (
          values: { name: string; value: string; options: CookieOptions }[],
        ) =>
          values.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          ),
      },
    });
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          req.nextUrl.searchParams.get("recovery") === "1"
            ? "/?recovery=1"
            : "/",
          req.url,
        ),
      );
  }
  return NextResponse.redirect(new URL("/?auth_error=1", req.url));
}
