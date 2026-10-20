import type { Analysis, Business } from "./types";
export type ActivityState = "active" | "closed" | "uncertain" | "missing_data";
export const activityLabels: Record<ActivityState, string> = {
  active: "Bekræftet aktiv",
  closed: "Bekræftet lukket",
  uncertain: "Usikker",
  missing_data: "Manglende data",
};
export type IdentityEvidence = {
  state: ActivityState;
  checkedAt: string;
  source: string;
  sourceUrl?: string;
  sourceSnapshot?: string;
  reason: string;
  cvr?: string;
  matchedName?: string;
  matchedAddress?: string;
  addressMatch?: "same" | "changed" | "unknown";
  nameChanged?: boolean;
  websiteCandidates?: string[];
  attempts?: string[];
};
export type WebsiteEvidence = {
  state: "checked" | "failed" | "blocked" | "deferred" | "no_website";
  checkedAt: string;
  url: string;
  finalUrl?: string;
  httpStatus?: number;
  redirects?: string[];
  dns?: "resolved" | "not_found" | "failed";
  reason: string;
  issues: string[];
  checkedLinks?: { url: string; status: number }[];
  analysis?: Analysis;
  retryAt?: string;
};
export type Verification = {
  identity: IdentityEvidence;
  website?: WebsiteEvidence;
  duplicateOf?: string;
  websiteSearch?: {
    complete: boolean;
    checkedAt: string;
    sources: string[];
    reason: string;
  };
  recordHash: string;
  lastAttemptAt?: string;
};
export type CheckedBusiness = Business & { verification?: Verification };
export const CHECK_FRESH_MS = 30 * 86400_000;
export function confirmedActive(b: Business, now = Date.now()) {
  const v = b.verification;
  return (
    !!v &&
    v.identity.state === "active" &&
    Number.isFinite(Date.parse(v.identity.checkedAt)) &&
    now - Date.parse(v.identity.checkedAt) >= 0 &&
    now - Date.parse(v.identity.checkedAt) < CHECK_FRESH_MS
  );
}
