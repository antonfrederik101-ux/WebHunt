import { createBrowserClient } from "@supabase/ssr";
let instance: ReturnType<typeof createBrowserClient> | null = null;
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!instance) instance = createBrowserClient(url, key);
  return instance;
}
