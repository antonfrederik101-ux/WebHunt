import { test } from "node:test";
import assert from "node:assert/strict";
import { probeDatafordeler, CVR_DOWNLOAD_ENDPOINT } from "../lib/datafordeler";

const secret = "synthetic-private-test-key-do-not-log";
test("Datafordeler probe requests only current CVREnhed, checks split ZIP signature and cancels even if Range is ignored", async () => {
  let cancelled = false,
    signal: AbortSignal | undefined;
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([0x50, 0x4b]));
        controller.enqueue(new Uint8Array([0x03, 0x04, 0x99]));
      },
      cancel() {
        cancelled = true;
      },
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-length": "999999999",
      },
    },
  );
  const result = await probeDatafordeler(secret, (async (input, init) => {
    const u = new URL(String(input));
    assert.equal(u.origin + u.pathname, CVR_DOWNLOAD_ENDPOINT);
    assert.equal(u.searchParams.get("apiKey"), secret);
    assert.equal(u.searchParams.get("Register"), "CVR");
    assert.equal(u.searchParams.get("LatestTotalForEntity"), "CVREnhed");
    assert.equal(u.searchParams.get("type"), "current");
    assert.equal(u.searchParams.get("format"), "JSON");
    assert.equal(init?.redirect, "manual");
    assert.equal(new Headers(init?.headers).get("range"), "bytes=0-3");
    signal = init?.signal as AbortSignal;
    return response;
  }) as typeof fetch);
  assert.equal(result.outcome, "file_available");
  assert.equal(result.rangeHonoured, false);
  assert.equal(result.receivedBytes, 5);
  assert.equal(result.fileBytes, 999999999);
  assert.equal(result.imported, false);
  assert.equal(cancelled, true);
  assert.equal(signal?.aborted, true);
  assert.equal(JSON.stringify(result).includes(secret), false);
});
test("Datafordeler probe distinguishes status codes, cancels response bodies and never follows credential-bearing redirects", async () => {
  const cases = [
    [401, "authentication_rejected"],
    [403, "forbidden"],
    [429, "rate_limited"],
    [302, "redirect"],
    [400, "request_not_supported"],
    [404, "request_not_supported"],
    [416, "request_not_supported"],
    [503, "unavailable"],
  ] as const;
  for (const [status, outcome] of cases) {
    let calls = 0,
      cancelled = false;
    const result = await probeDatafordeler(secret, (async () => {
      calls++;
      return new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        }),
        {
          status,
          headers: {
            location: "https://untrusted.example/?apiKey=" + secret,
            "content-type": secret,
            "last-modified": secret,
          },
        },
      );
    }) as typeof fetch);
    assert.equal(result.outcome, outcome);
    assert.equal(result.httpStatus, status);
    assert.equal(result.receivedBytes, 0);
    assert.equal(calls, 1);
    assert.equal(cancelled, true);
    assert.equal(result.contentType, undefined);
    assert.equal(JSON.stringify(result).includes(secret), false);
  }
});
test("successful HTTP without ZIP evidence does not claim working file access; range size metadata is parsed without exposing body", async () => {
  const bad = await probeDatafordeler(
    secret,
    (async () =>
      new Response(JSON.stringify({ error: secret }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch,
  );
  assert.equal(bad.outcome, "unexpected_response");
  assert.equal(JSON.stringify(bad).includes(secret), false);
  const good = await probeDatafordeler(
    secret,
    (async () =>
      new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
        status: 206,
        headers: {
          "content-range": "bytes 0-3/1234567",
          "last-modified": "Tue, 20 Oct 2026 03:00:00 GMT",
        },
      })) as typeof fetch,
  );
  assert.equal(good.outcome, "file_available");
  assert.equal(good.rangeHonoured, true);
  assert.equal(good.fileBytes, 1234567);
  assert.equal(good.lastModified, "2026-10-20T03:00:00.000Z");
});
test("missing keys cause no calls and arbitrary fetch errors cannot expose the key or URL", async () => {
  let calls = 0;
  const fail = (async () => {
    calls++;
    throw new Error(CVR_DOWNLOAD_ENDPOINT + "?apiKey=" + secret);
  }) as typeof fetch;
  await assert.rejects(probeDatafordeler(" ", fail), /mangler/);
  assert.equal(calls, 0);
  const result = await probeDatafordeler(secret, fail);
  assert.equal(result.outcome, "network_error");
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(JSON.stringify(result).includes("apiKey="), false);
});
