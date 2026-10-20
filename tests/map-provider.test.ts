import { test } from "node:test";
import assert from "node:assert/strict";
import { mapProvider } from "../lib/map-provider";
import { readFileSync } from "node:fs";
test("no key means no third-party tile requests or fabricated credentials", () => {
  assert.equal(mapProvider(undefined), null);
  assert.equal(mapProvider("  "), null);
});
test("licensed MapTiler raster configuration encodes its public key and preserves both attributions", () => {
  const p = mapProvider("test key&x=1")!;
  assert.ok(p.url.startsWith("https://api.maptiler.com/maps/dataviz-v4-dark/"));
  assert.ok(p.url.endsWith("key=test%20key%26x%3D1"));
  assert.equal(p.tileSize, 512);
  assert.equal(p.zoomOffset, -1);
  assert.match(p.attribution, /MapTiler/);
  assert.match(p.attribution, /OpenStreetMap contributors/);
});
test("local map is real public-domain Denmark geometry including Bornholm, not fabricated business data", () => {
  const data = JSON.parse(
    readFileSync("public/maps/denmark-context.geojson", "utf8"),
  );
  const dk = data.features.find(
    (f: { properties: { name: string } }) => f.properties.name === "Denmark",
  );
  assert.ok(dk);
  const positions = (
    dk.geometry.type === "MultiPolygon"
      ? dk.geometry.coordinates
      : [dk.geometry.coordinates]
  ).flat(2) as number[][];
  assert.ok(
    positions.some(
      ([lon, lat]) => lon > 14.6 && lon < 15.3 && lat > 54.9 && lat < 55.4,
    ),
    "Bornholm must be included",
  );
  assert.ok(
    positions.some(([lon, lat]) => lon < 9 && lat > 56),
    "Jutland must be included",
  );
});
