"use client";
import { useEffect, useRef, useState } from "react";
import type L from "leaflet";
import type { GeoJsonObject } from "geojson";
import { mapProvider } from "@/lib/map-provider";
import { Business, statuses } from "@/lib/types";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
type Props = {
  businesses: Business[];
  selected: string | null;
  target: {
    name: string;
    lat: number;
    lon: number;
    zoom: number;
    nonce?: number;
  };
  onSelect: (b: Business) => void;
  onBounds: (bbox: string, zoom: number) => void;
  onReady: () => void;
};
export default function DenmarkMap(props: Props) {
  const [initialized, setInitialized] = useState(false);
  const [mapNotice, setMapNotice] = useState(
    "Oversigtskort · Natural Earth. MapTiler-nøgle mangler til gade- og detaljekort.",
  );
  const [mapError, setMapError] = useState(false);
  const node = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    cluster = useRef<L.MarkerClusterGroup | null>(null),
    leaflet = useRef<typeof L | null>(null),
    latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    let dead = false;
    let timer: ReturnType<typeof setTimeout>;
    let observer: ResizeObserver;
    const controllers = new Set<AbortController>();
    const objectUrls = new Set<string>();
    (async () => {
      const mod = await import("leaflet");
      await import("leaflet.markercluster");
      if (dead || !node.current) return;
      const lib = mod.default;
      leaflet.current = lib;
      const m = lib
        .map(node.current, {
          zoomControl: false,
          minZoom: 6,
          maxZoom: 19,
          maxBounds: [
            [53.8, 6.8],
            [58.5, 16.4],
          ],
          maxBoundsViscosity: 0.8,
        })
        .setView([56.05, 10.8], 7);
      map.current = m;
      // Public-domain vector context is local and remains usable if a licensed tile service is unavailable.
      m.createPane("country-context").style.zIndex = "150";
      const contextController = new AbortController();
      controllers.add(contextController);
      fetch("/maps/denmark-context.geojson", {
        signal: contextController.signal,
      })
        .then(async (r) => {
          if (!r.ok) throw new Error();
          const data = (await r.json()) as GeoJsonObject;
          if (dead) return;
          lib
            .geoJSON(data, {
              pane: "country-context",
              interactive: false,
              style: (feature) => ({
                color:
                  feature?.properties?.name === "Denmark"
                    ? "#86e9bf"
                    : "#344d5a",
                weight: feature?.properties?.name === "Denmark" ? 1.5 : 1,
                fillColor:
                  feature?.properties?.name === "Denmark"
                    ? "#24463c"
                    : "#1d2e39",
                fillOpacity: 1,
              }),
            })
            .addTo(m);
          for (const [name, lat, lon] of [
            ["DANMARK", 56.1, 9.6],
            ["SVERIGE", 57, 13.5],
            ["TYSKLAND", 54.1, 10.1],
          ] as const) {
            const label = document.createElement("span");
            label.textContent = name;
            lib
              .marker([lat, lon], {
                pane: "country-context",
                interactive: false,
                icon: lib.divIcon({
                  className: "country-label",
                  html: label,
                  iconSize: [90, 16],
                }),
              })
              .addTo(m);
          }
        })
        .catch(() => {
          if (!dead && !contextController.signal.aborted) {
            setMapError(true);
            setMapNotice(
              "Det lokale oversigtskort kunne ikke indlæses. Genindlæs siden.",
            );
          }
        })
        .finally(() => controllers.delete(contextController));
      m.attributionControl.addAttribution(
        '<a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener noreferrer">Natural Earth · public domain</a>',
      );
      const provider = mapProvider(process.env.NEXT_PUBLIC_MAPTILER_KEY);
      if (provider) {
        setMapNotice("Indlæser MapTiler-detaljekort…");
        let failed = false;
        let tiles: L.TileLayer;
        const fail = (status?: number) => {
          if (dead || failed) return;
          failed = true;
          tiles.remove();
          for (const c of controllers) if (c !== contextController) c.abort();
          setMapError(true);
          setMapNotice(
            status === 401 || status === 403
              ? `MapTiler afviste kortadgangen (HTTP ${status}). Kontrollér nøgle og tilladte domæner. Lokalt oversigtskort vises.`
              : "Detaljekortet er utilgængeligt. Lokalt oversigtskort vises; ingen automatiske genforsøg.",
          );
        };
        class LicensedTiles extends lib.TileLayer {
          override createTile(
            coords: L.Coords,
            done: L.DoneCallback,
          ): HTMLElement {
            const tile = document.createElement("img");
            tile.alt = "";
            tile.setAttribute("role", "presentation");
            const controller = new AbortController();
            controllers.add(controller);
            // Fetch once with ordinary browser identity, HTTP caching and a genuine origin referrer.
            // Inspect status before decoding: never render a provider's 403 error image as a map tile.
            fetch(this.getTileUrl(coords), {
              signal: controller.signal,
              referrerPolicy: "strict-origin-when-cross-origin",
              credentials: "omit",
              cache: "default",
            })
              .then(async (r) => {
                if (!r.ok) {
                  fail(r.status);
                  return;
                }
                if (!r.headers.get("content-type")?.startsWith("image/")) {
                  fail();
                  return;
                }
                const blob = await r.blob();
                if (dead || failed) return;
                const url = URL.createObjectURL(blob);
                objectUrls.add(url);
                tile.onload = () => {
                  URL.revokeObjectURL(url);
                  objectUrls.delete(url);
                  if (!dead && !failed) {
                    setMapNotice("MapTiler · mørkt detaljekort");
                    done(undefined, tile);
                  }
                };
                tile.onerror = () => {
                  URL.revokeObjectURL(url);
                  objectUrls.delete(url);
                  fail();
                };
                tile.src = url;
              })
              .catch(() => {
                if (!controller.signal.aborted) fail();
              })
              .finally(() => controllers.delete(controller));
            return tile;
          }
        }
        tiles = new LicensedTiles(provider.url, {
          attribution: provider.attribution,
          tileSize: provider.tileSize,
          zoomOffset: provider.zoomOffset,
          maxZoom: 19,
          updateWhenIdle: true,
          updateWhenZooming: false,
          keepBuffer: 1,
        });
        tiles.addTo(m);
      }
      lib.control.zoom({ position: "bottomright" }).addTo(m);
      cluster.current = lib
        .markerClusterGroup({
          showCoverageOnHover: false,
          maxClusterRadius: 42,
          disableClusteringAtZoom: 17,
          iconCreateFunction: (c) =>
            lib.divIcon({
              className: "hunt-cluster",
              html: `<span>${c.getChildCount()}</span>`,
              iconSize: [40, 40],
            }),
        })
        .addTo(m);
      const report = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const b = m.getBounds();
          const s = Math.max(54.4, b.getSouth()),
            w = Math.max(7.8, b.getWest()),
            n = Math.min(57.9, b.getNorth()),
            e = Math.min(15.3, b.getEast());
          if (s < n && w < e)
            latest.current.onBounds(
              [s, w, n, e].map((x) => x.toFixed(3)).join(","),
              m.getZoom(),
            );
        }, 600);
      };
      m.on("moveend", report);
      if (latest.current.target.name === "Danmark")
        m.fitBounds(
          [
            [54.5, 8.05],
            [57.75, 15.2],
          ],
          { padding: [25, 25] },
        );
      else
        m.setView(
          [latest.current.target.lat, latest.current.target.lon],
          latest.current.target.zoom,
        );
      report();
      latest.current.onReady();
      setInitialized(true);
      observer = new ResizeObserver(() => {
        m.invalidateSize();
        if (latest.current.target.name === "Danmark" && m.getZoom() <= 7) {
          m.fitBounds(
            [
              [54.5, 8.05],
              [57.75, 15.2],
            ],
            { padding: [25, 25] },
          );
        }
      });
      observer.observe(node.current);
    })();
    return () => {
      dead = true;
      for (const controller of controllers) controller.abort();
      for (const url of objectUrls) URL.revokeObjectURL(url);
      clearTimeout(timer);
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!map.current || !cluster.current || !leaflet.current) return;
    const lib = leaflet.current;
    cluster.current.clearLayers();
    props.businesses.forEach((b) => {
      const icon = lib.divIcon({
        className: "business-marker",
        html: `<span style="--marker-color:${statuses[b.status].color}" class="${b.id === props.selected ? "selected" : ""}"></span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const marker = lib.marker([b.lat, b.lon], {
        icon,
        title: b.name,
        alt: b.name,
      });
      const tooltip = document.createElement("span");
      tooltip.textContent = b.name;
      marker.bindTooltip(tooltip);
      marker.on("click", () => latest.current.onSelect(b));
      cluster.current!.addLayer(marker);
    });
  }, [props.businesses, props.selected, props.target, initialized]);
  useEffect(() => {
    if (!map.current) return;
    if (props.target.name === "Danmark")
      map.current.fitBounds(
        [
          [54.5, 8.05],
          [57.75, 15.2],
        ],
        { padding: [25, 25] },
      );
    else
      map.current.flyTo(
        [props.target.lat, props.target.lon],
        props.target.zoom,
        { duration: 1 },
      );
  }, [props.target]);
  return (
    <>
      <div
        ref={node}
        className="map-canvas"
        aria-label="Interaktivt kort over danske virksomheder"
      />
      <div
        className={`map-provider-note ${mapError ? "provider-error" : ""}`}
        role={mapError ? "alert" : "status"}
      >
        {mapNotice}
      </div>
    </>
  );
}
