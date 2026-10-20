import { publicWebsite } from "./analysis";

const socialHosts = [
  "facebook.com",
  "fb.com",
  "fb.me",
  "instagram.com",
  "linkedin.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "youtu.be",
  "threads.net",
];
export function normalizedPublicUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const clean = value.trim();
  if (/^[a-z][a-z\d+.-]*:/i.test(clean) && !/^https?:/i.test(clean)) return "";
  return (
    publicWebsite(/^https?:\/\//i.test(clean) ? clean : `https://${clean}`) ||
    ""
  );
}
export function socialWebsite(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return socialHosts.some(
      (social) => host === social || host.endsWith(`.${social}`),
    );
  } catch {
    return false;
  }
}
/** Keeps actual social profiles, while preferring a valid registered business site. */
export function websiteDetails(websites: unknown, socials: unknown = []) {
  const urls = (Array.isArray(websites) ? websites : [websites])
    .map(normalizedPublicUrl)
    .filter(Boolean);
  const profiles = (Array.isArray(socials) ? socials : [])
    .map(normalizedPublicUrl)
    .filter(Boolean);
  return {
    website: urls.find((url) => !socialWebsite(url)) || "",
    socialProfiles: [...new Set([...urls.filter(socialWebsite), ...profiles])],
  };
}
