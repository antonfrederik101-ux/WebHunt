const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!!url !== !!key)
  throw new Error(
    "Set both Supabase public variables, or leave both unset for local mode.",
  );
if (url && new URL(url).protocol !== "https:")
  throw new Error("Supabase URL must use HTTPS.");
if (key) {
  let role;
  try {
    role = JSON.parse(
      Buffer.from(key.split(".")[1], "base64url").toString(),
    ).role;
  } catch {}
  if (key.startsWith("sb_secret_") || role === "service_role")
    throw new Error(
      "A Supabase secret/service-role key must never be bundled into the browser. Use the public anon/publishable key.",
    );
  console.log(
    "Supabase public configuration: present" +
      (role === "anon" || key.startsWith("sb_publishable_")
        ? " (public key confirmed)"
        : ""),
  );
} else console.log("Supabase: local-browser mode (not configured)");
