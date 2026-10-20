export type SupabaseHealth = {
  configured: boolean;
  auth: "ok" | "unavailable" | "unconfigured";
  database:
    "missing" | "protected" | "public-access" | "unavailable" | "unconfigured";
  missingTables: string[];
};
export async function checkSupabase(
  request: typeof fetch = fetch,
  config = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
): Promise<SupabaseHealth> {
  const { url, key } = config;
  const result: SupabaseHealth = {
    configured: !!(url && key),
    auth: "unconfigured",
    database: "unconfigured",
    missingTables: [],
  };
  if (!url || !key) return result;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") throw new Error();
    const auth = await request(new URL("/auth/v1/settings", u), {
      headers: { apikey: key },
      signal: AbortSignal.timeout(10000),
    });
    result.auth = auth.ok ? "ok" : "unavailable";
    let publicAccess = false,
      unavailable = false;
    for (const table of ["leads", "business_statuses"]) {
      const r = await request(
        new URL(`/rest/v1/${table}?select=business_id&limit=0`, u),
        { headers: { apikey: key }, signal: AbortSignal.timeout(10000) },
      );
      const body = await r.json();
      if (r.status === 404 && body.code === "PGRST205")
        result.missingTables.push(table);
      else if (r.ok) publicAccess = true;
      else if (!["42501", "PGRST301", "PGRST302"].includes(body.code))
        unavailable = true;
    }
    // Anonymous SELECT success alone does not establish whether RLS is safe; only a two-account test can verify isolation.
    result.database = result.missingTables.length
      ? "missing"
      : unavailable
        ? "unavailable"
        : publicAccess
          ? "public-access"
          : "protected";
  } catch {
    result.auth = result.auth === "ok" ? "ok" : "unavailable";
    result.database = "unavailable";
  }
  return result;
}
