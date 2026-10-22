import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import {
  zipSchemaPrefix,
  inspectDatafordelerSchema,
} from "../lib/cvr-schema-sample";

function zipPrefix(
  body: string,
  method = 8,
  descriptor = false,
  name = "CVREnhed.json",
) {
  const text = Buffer.from(body),
    filename = Buffer.from(name);
  const compressed = method === 0 ? text : deflateRawSync(text);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(descriptor ? 8 : 0, 6);
  header.writeUInt16LE(method, 8);
  header.writeUInt32LE(descriptor ? 0 : compressed.length, 18);
  header.writeUInt32LE(descriptor ? 0 : text.length, 22);
  header.writeUInt16LE(filename.length, 26);
  return Buffer.concat([header, filename, compressed]);
}
const privateValue = "Private synthetic business value, never output";
const body = JSON.stringify({
  CVREnhed: [
    {
      id: privateValue,
      cvrnummer: 12345678,
      registreringFra: "2026-10-20T00:00:00Z",
      registreringTil: null,
      virkningFra: "2020-01-01",
      virkningTil: null,
      aktiv: true,
      relation: { felt: privateValue },
      data: [],
      nullable: null,
      nummer: 42,
      label: privateValue,
    },
  ],
});

test("schema inspection observes field types from ZIP prefixes, including data descriptors and split/truncated deflate, without company values", () => {
  for (const method of [0, 8])
    for (const descriptor of [false, true]) {
      const zip = zipPrefix(body, method, descriptor);
      const sample = zipSchemaPrefix(zip);
      assert.equal(sample.outcome, "schema_found");
      assert.deepEqual(sample.fields?.CVREnhed, ["array"]);
      assert.deepEqual(sample.fields?.cvrnummer, ["number"]);
      assert.deepEqual(sample.fields?.registreringTil, ["null"]);
      assert.deepEqual(sample.fields?.aktiv, ["boolean"]);
      assert.equal(JSON.stringify(sample).includes(privateValue), false);
      assert.equal(JSON.stringify(sample).includes("12345678"), false);
      assert.equal(zipSchemaPrefix(zip.subarray(0, 10)).outcome, "need_more");
    }
  const partial = zipPrefix(
    JSON.stringify(Array.from({ length: 1000 }, () => ({ id: privateValue }))),
  );
  assert.equal(
    zipSchemaPrefix(partial.subarray(0, partial.length - 5)).outcome,
    "schema_found",
  );
});
test("schema inspection rejects encrypted/non-JSON archive entries and bounds ZIP expansion without writing files", () => {
  const encrypted = zipPrefix(body);
  encrypted.writeUInt16LE(1, 6);
  assert.equal(zipSchemaPrefix(encrypted).outcome, "unsupported_archive");
  assert.equal(
    zipSchemaPrefix(zipPrefix(body, 8, false, "README.txt")).outcome,
    "unsupported_archive",
  );
  const expansion = zipSchemaPrefix(
    zipPrefix(
      JSON.stringify({ id: "prefix", repeated: "x".repeat(5_000_000) }),
    ),
  );
  assert.equal(expansion.outcome, "schema_found");
  assert.deepEqual(expansion.fields?.id, ["string"]);
  assert.ok(JSON.stringify(expansion).length < 1000);
});
test("schema network sample respects the fixed endpoint and cancels Range-ignored transfer at the compressed byte limit", async () => {
  let cancelled = false,
    signal: AbortSignal | undefined;
  const zip = zipPrefix(body + " ".repeat(400000), 0);
  const result = await inspectDatafordelerSchema("synthetic-secret", (async (
    input,
    init,
  ) => {
    const u = new URL(String(input));
    assert.equal(u.hostname, "api.datafordeler.dk");
    assert.equal(u.searchParams.get("LatestTotalForEntity"), "CVREnhed");
    assert.equal(u.searchParams.get("type"), "bitemporal");
    assert.equal(init?.redirect, "manual");
    assert.equal(new Headers(init?.headers).get("range"), "bytes=0-262143");
    signal = init?.signal as AbortSignal;
    return new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(zip);
        },
        cancel() {
          cancelled = true;
        },
      }),
      { status: 200 },
    );
  }) as typeof fetch);
  assert.equal(result.outcome, "schema_found");
  assert.equal(result.sampledCompressedBytes, 256 * 1024);
  assert.equal(result.imported, false);
  assert.equal(result.archiveIntegrityVerified, false);
  assert.equal(cancelled, true);
  assert.equal(signal?.aborted, true);
  assert.equal(JSON.stringify(result).includes(privateValue), false);
});
test("schema errors and redirects never expose arbitrary upstream text, credentials or body values", async () => {
  const key = "synthetic-secret";
  const redirected = await inspectDatafordelerSchema(
    key,
    (async () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://untrusted.example/?apiKey=" + key },
      })) as typeof fetch,
  );
  assert.equal(redirected.outcome, "http_error");
  const failed = await inspectDatafordelerSchema(key, (async () => {
    throw new Error(key);
  }) as typeof fetch);
  assert.equal(failed.outcome, "network_or_sample_error");
  for (const r of [redirected, failed])
    assert.equal(JSON.stringify(r).includes(key), false);
});
