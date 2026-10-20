"use client";
import { useEffect, useRef, useState } from "react";
import type L from "leaflet";
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
      lib
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
          maxZoom: 19,
        })
        .addTo(m);
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
    <div
      ref={node}
      className="map-canvas"
      aria-label="Interaktivt kort over danske virksomheder"
    />
  );
}
