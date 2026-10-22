/** The file-download endpoint shown in Datafordeler's CVR documentation.
 * CVREnhed is published only as bitemporal, per the CVR file-download table.
 * Probe only that entity, never CVRPerson or an entire register archive.
 */
export const CVR_DOWNLOAD_ENDPOINT =
  "https://api.datafordeler.dk/FileDownloads/GetFile";
export type CvrProbe = {
  entity: "CVREnhed";
  filter: "bitemporal";
  outcome:
    | "file_available"
    | "authentication_rejected"
    | "forbidden"
    | "rate_limited"
    | "redirect"
    | "request_not_supported"
    | "unexpected_response"
    | "unavailable"
    | "network_error";
  httpStatus?: number;
  contentType?: string;
  fileBytes?: number;
  lastModified?: string;
  rangeHonoured?: boolean;
  receivedBytes: number;
  imported: false;
  diagnostic: string;
};
export async function probeDatafordeler(
  key: string,
  request: typeof fetch = fetch,
): Promise<CvrProbe> {
  if (!key.trim() || key.trim().length > 4096 || /[\r\n]/.test(key))
    throw new Error(
      "DATAFORDELER_API_KEY mangler eller har ugyldigt format. Ingen forespørgsel er sendt.",
    );
  const url = new URL(CVR_DOWNLOAD_ENDPOINT);
  url.searchParams.set("Register", "CVR");
  url.searchParams.set("LatestTotalForEntity", "CVREnhed");
  url.searchParams.set("type", "bitemporal");
  url.searchParams.set("format", "JSON");
  url.searchParams.set("apiKey", key.trim());
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 30000);
  const result: CvrProbe = {
    entity: "CVREnhed",
    filter: "bitemporal",
    outcome: "network_error",
    receivedBytes: 0,
    imported: false,
    diagnostic:
      "Forbindelsen kunne ikke oprettes. Nøglen og hele forespørgselsadressen vises ikke.",
  };
  let response: Response | undefined;
  try {
    response = await request(url, {
      method: "GET",
      redirect: "manual",
      signal: abort.signal,
      headers: {
        Range: "bytes=0-3",
        "Accept-Encoding": "identity",
        Accept: "application/zip,application/octet-stream",
        "User-Agent":
          "WebHunt/1.0 (+https://github.com/antonfrederik101-ux/WebHunt)",
      },
    });
    result.httpStatus = response.status;
    result.rangeHonoured = response.status === 206;
    // Only a known MIME token is returned; arbitrary upstream headers can contain secrets.
    const mime = (response.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (
      [
        "application/zip",
        "application/octet-stream",
        "application/x-zip-compressed",
        "application/json",
        "text/html",
      ].includes(mime)
    )
      result.contentType = mime;
    const length = response.headers.get("content-length");
    if (response.status === 200 && length && /^\d{1,15}$/.test(length))
      result.fileBytes = Number(length);
    const range = response.headers
      .get("content-range")
      ?.match(/^bytes 0-\d+\/(\d{1,15})$/i);
    if (response.status === 206 && range) result.fileBytes = Number(range[1]);
    const modified = Date.parse(response.headers.get("last-modified") || "");
    if (Number.isFinite(modified))
      result.lastModified = new Date(modified).toISOString();
    if (response.status === 401) {
      result.outcome = "authentication_rejected";
      result.diagnostic =
        "HTTP 401: Nøglen blev ikke accepteret. Kontrollér nøglens status og gyldighed hos Datafordeleren.";
    } else if (response.status === 403) {
      result.outcome = "forbidden";
      result.diagnostic =
        "HTTP 403: Adgang afvist af API eller netværksmellemled. Det beviser ikke alene, at nøglen er forkert.";
    } else if (response.status === 429) {
      result.outcome = "rate_limited";
      result.diagnostic =
        "HTTP 429: Datatjenestens hastighedsgrænse er nået. Ingen automatiske genforsøg er startet.";
    } else if (response.status >= 300 && response.status < 400) {
      result.outcome = "redirect";
      result.diagnostic =
        "API'et returnerede en viderestilling. Den er ikke fulgt; API-nøglen er ikke videresendt.";
    } else if ([400, 404, 405, 416, 422].includes(response.status)) {
      result.outcome = "request_not_supported";
      result.diagnostic =
        "Forespørgslen eller udtrækket blev ikke fundet/accepteret. Endpoint, entitet og bitemporal-filter skal afklares; nøglen er ikke dermed konstateret forkert.";
    } else if (response.status >= 500) {
      result.outcome = "unavailable";
      result.diagnostic =
        "Datatjenesten er midlertidigt utilgængelig. Ingen virksomhedstilstand udledes af fejlen.";
    } else if ([200, 206].includes(response.status) && response.body) {
      const reader = response.body.getReader();
      try {
        const bytes = new Uint8Array(4);
        let filled = 0;
        for (let i = 0; i < 4 && filled < 4; i++) {
          const chunk = await reader.read();
          if (chunk.done) break;
          result.receivedBytes += chunk.value.byteLength;
          const take = Math.min(4 - filled, chunk.value.byteLength);
          bytes.set(chunk.value.subarray(0, take), filled);
          filled += take;
        }
        const archive =
          filled === 4 &&
          bytes[0] === 0x50 &&
          bytes[1] === 0x4b &&
          bytes[2] === 0x03 &&
          bytes[3] === 0x04;
        if (archive) {
          result.outcome = "file_available";
          result.diagnostic =
            "API'et leverer starten af et ZIP-udtræk. Overførslen er afbrudt uden lagring/import; indhold, schema, udtræksdato og brugsvilkår er endnu ikke valideret.";
        } else {
          result.outcome = "unexpected_response";
          result.diagnostic =
            "API'et svarede, men filens ZIP-signatur blev ikke bekræftet. Svarindholdet vises ikke, og der er ikke importeret data.";
        }
      } finally {
        abort.abort();
        await reader.cancel().catch(() => {});
      }
    } else {
      result.outcome = "unexpected_response";
      result.diagnostic =
        "Uventet HTTP-svar uden bekræftet ZIP-udtræk. Ingen import udført.";
    }
  } catch (error) {
    // Inspect errors without printing arbitrary messages/URLs, which may include apiKey.
    const e = error as Error & { cause?: { code?: string } };
    if (abort.signal.aborted)
      result.diagnostic =
        "Forbindelsestesten overskred 30 sekunder og blev afbrudt.";
    else if (
      [
        "CERT_HAS_EXPIRED",
        "DEPTH_ZERO_SELF_SIGNED_CERT",
        "ERR_TLS_CERT_ALTNAME_INVALID",
        "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      ].includes(e.cause?.code || "")
    )
      result.diagnostic =
        "TLS-certifikatet kunne ikke verificeres. Certifikatkontrollen er bevaret.";
    else if (["ENOTFOUND", "EAI_AGAIN"].includes(e.cause?.code || ""))
      result.diagnostic = "API-værtsnavnet kunne ikke slås op i DNS.";
  } finally {
    abort.abort();
    if (response?.body && !response.body.locked)
      await response.body.cancel().catch(() => {});
    clearTimeout(timer);
  }
  return result;
}
