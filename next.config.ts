import type { NextConfig } from "next";

// Codespaces supplies the actual forwarded hostname; allow that exact origin.
const codespace = process.env.CODESPACE_NAME;
const forwardingDomain =
  process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || "app.github.dev";
const previewOrigin =
  codespace &&
  /^[a-z0-9-]+$/i.test(codespace) &&
  /^[a-z0-9.-]+$/i.test(forwardingDomain)
    ? `${codespace}-3000.${forwardingDomain}`
    : null;
const config: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", ...(previewOrigin ? [previewOrigin] : [])],
};
export default config;
