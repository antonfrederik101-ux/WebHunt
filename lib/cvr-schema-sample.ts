import { constants, inflateRawSync } from "node:zlib";
import { datafordelerCvrUrl } from "./datafordeler";

const MAX_COMPRESSED = 256 * 1024;
const MAX_PLAIN = 1024 * 1024;
type FieldType = "string" | "number" | "boolean" | "null" | "object" | "array";
export type ZipSchema = {
  outcome: "need_more" | "schema_found" | "unsupported_archive" | "no_fields";
  compression?: "stored" | "deflate";
  fields?: Record<string, FieldType[]>;
  diagnostic?: string;
};
export type CvrSchemaProbe = Omit<ZipSchema, "outcome"> & {
  outcome: ZipSchema["outcome"] | "http_error" | "network_or_sample_error";
  httpStatus?: number;
  receivedBytes: number;
  sampledCompressedBytes?: number;
  maxDecompressedBytes?: number;
  imported: false;
  archiveIntegrityVerified: false;
  scope?: string;
};
/** Reads a local ZIP entry prefix only. No extraction to disk or company values. */
export function zipSchemaPrefix(input: Buffer): ZipSchema {
  if (input.length < 30) return { outcome: "need_more" };
  if (input.readUInt32LE(0) !== 0x04034b50)
    return {
      outcome: "unsupported_archive",
      diagnostic: "ZIP-lokalheader mangler.",
    };
  const flags = input.readUInt16LE(6),
    method = input.readUInt16LE(8);
  if (flags & 1 || ![0, 8].includes(method))
    return {
      outcome: "unsupported_archive",
      diagnostic: "Krypteret eller ikke-understøttet ZIP-komprimering.",
    };
  const nameLength = input.readUInt16LE(26),
    extraLength = input.readUInt16LE(28);
  const start = 30 + nameLength + extraLength;
  if (input.length < start) return { outcome: "need_more" };
  const filename = input.subarray(30, 30 + nameLength).toString("utf8");
  // Do not print filenames, which can include arbitrary upstream text.
  if (!/\.json$/i.test(filename))
    return {
      outcome: "unsupported_archive",
      diagnostic:
        "Første ZIP-element er ikke JSON. Arkivets struktur skal afklares; intet er importeret.",
    };
  const size = input.readUInt32LE(18);
  const payload = input.subarray(
    start,
    size > 0 && size !== 0xffffffff
      ? Math.min(input.length, start + size)
      : input.length,
  );
  if (!payload.length) return { outcome: "need_more" };
  let plain: Buffer | undefined;
  if (method === 0) plain = payload.subarray(0, MAX_PLAIN);
  else {
    // Large expansion never allocates an unbounded output. Retry shorter input
    // prefixes to obtain a useful sample even from highly compressed archives.
    for (let end = payload.length; end > 0; end = Math.floor(end / 2)) {
      try {
        plain = inflateRawSync(payload.subarray(0, end), {
          finishFlush: constants.Z_SYNC_FLUSH,
          maxOutputLength: MAX_PLAIN,
        });
        break;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ERR_BUFFER_TOO_LARGE")
          return { outcome: "need_more" };
      }
    }
  }
  if (!plain?.length) return { outcome: "need_more" };
  const fields: Record<string, FieldType[]> = Object.create(null);
  // Inspect property tokens and the leading value type; never include values.
  // Keys with escapes/unusual punctuation are omitted, not interpreted as data.
  const properties =
    /(?:^|[,{])\s*"([\p{L}_][\p{L}\p{N}_-]{0,79})"\s*:\s*([\[\{"tfn\-0-9])/gu;
  const text = plain.toString("utf8");
  for (const match of text.matchAll(properties)) {
    const token = match[2];
    const type: FieldType =
      token === '"'
        ? "string"
        : token === "{"
          ? "object"
          : token === "["
            ? "array"
            : token === "n"
              ? "null"
              : token === "t" || token === "f"
                ? "boolean"
                : "number";
    if (!Object.hasOwn(fields, match[1])) {
      if (Object.keys(fields).length >= 200) break;
      fields[match[1]] = [];
    }
    if (!fields[match[1]].includes(type)) fields[match[1]].push(type);
  }
  return {
    outcome: Object.keys(fields).length ? "schema_found" : "no_fields",
    compression: method === 0 ? "stored" : "deflate",
    fields,
  };
}

export async function inspectDatafordelerSchema(
  key: string,
  request: typeof fetch = fetch,
): Promise<CvrSchemaProbe> {
  const url = datafordelerCvrUrl(key);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 30000);
  let response: Response | undefined;
  let receivedBytes = 0;
  try {
    response = await request(url, {
      redirect: "manual",
      signal: abort.signal,
      headers: {
        Range: `bytes=0-${MAX_COMPRESSED - 1}`,
        "Accept-Encoding": "identity",
        Accept: "application/zip",
        "User-Agent":
          "WebHunt/1.0 (+https://github.com/antonfrederik101-ux/WebHunt)",
      },
    });
    if (![200, 206].includes(response.status) || !response.body)
      return {
        outcome: "http_error",
        httpStatus: response.status,
        receivedBytes,
        imported: false,
        archiveIntegrityVerified: false,
        diagnostic:
          "Prøven er afbrudt uden import. Ingen viderestilling følges eller nøgle vises.",
      };
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let collected = 0,
      nextSampleAt = 512,
      schema: ZipSchema = { outcome: "need_more" };
    try {
      while (collected < MAX_COMPRESSED) {
        const item = await reader.read();
        if (item.done) break;
        receivedBytes += item.value.length;
        const part = Buffer.from(
          item.value.subarray(0, MAX_COMPRESSED - collected),
        );
        chunks.push(part);
        collected += part.length;
        if (collected < nextSampleAt) continue;
        schema = zipSchemaPrefix(Buffer.concat(chunks, collected));
        nextSampleAt = Math.min(MAX_COMPRESSED, collected * 2);
        if (
          schema.outcome === "unsupported_archive" ||
          Object.keys(schema.fields || {}).length >= 12
        )
          break;
      }
      schema = zipSchemaPrefix(Buffer.concat(chunks, collected));
    } finally {
      abort.abort();
      await reader.cancel().catch(() => {});
    }
    return {
      ...schema,
      httpStatus: response.status,
      receivedBytes,
      sampledCompressedBytes: collected,
      maxDecompressedBytes: MAX_PLAIN,
      imported: false,
      archiveIntegrityVerified: false,
      scope:
        "Kun feltnavne og observerede datatyper i første JSON-præfiks. Ingen værdier, fuld arkivkontrol eller virksomhedstilstande.",
    };
  } catch {
    return {
      outcome: "network_or_sample_error",
      receivedBytes,
      imported: false,
      archiveIntegrityVerified: false,
      diagnostic:
        "Prøven kunne ikke fuldføres inden for sikkerheds- og tidsgrænserne. Råfejl og nøgle vises ikke.",
    };
  } finally {
    abort.abort();
    clearTimeout(timer);
    if (response?.body && !response.body.locked)
      await response.body.cancel().catch(() => {});
  }
}
