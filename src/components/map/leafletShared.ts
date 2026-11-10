/** Leaflet building blocks shared by every map so they all look the same. */
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ComponentType } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function basemaps(maxZoom: number): Record<string, L.TileLayer> {
  return {
    Street: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom,
      attribution: OSM,
    }),
    Topographic: L.tileLayer("https://tile.opentopomap.org/{z}/{x}/{y}.png", {
      maxZoom: Math.min(maxZoom, 17),
      attribution: `${OSM}, SRTM | &copy; <a href="https://opentopomap.org">OpenTopoMap</a>`,
    }),
    Satellite: L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: Math.min(maxZoom, 18), attribution: "Tiles &copy; Esri" },
    ),
  };
}

export function fullscreenControl() {
  const Control = L.Control.extend({
    onAdd(map: L.Map) {
      const button = L.DomUtil.create("button", "leaflet-bar") as HTMLButtonElement;
      button.type = "button";
      button.setAttribute("aria-label", "Toggle fullscreen map");
      button.title = "Toggle fullscreen";
      button.textContent = "⛶";
      button.style.cssText =
        "width:34px;height:34px;background:#fff;font-size:18px;line-height:1;border-radius:4px;border:2px solid rgba(0,0,0,.2);cursor:pointer";
      L.DomEvent.disableClickPropagation(button);
      button.addEventListener("click", () => {
        const el = map.getContainer();
        if (document.fullscreenElement) void document.exitFullscreen();
        else void el.requestFullscreen?.();
      });
      const refresh = () => setTimeout(() => map.invalidateSize(), 150);
      document.addEventListener("fullscreenchange", refresh);
      map.on("unload", () => document.removeEventListener("fullscreenchange", refresh));
      return button;
    },
  });
  return new Control({ position: "topleft" });
}

/** The Round 1 incident marker: a coloured dot with a white ring. */
export function dotIcon(color: string, emphasize = false) {
  const size = emphasize ? 30 : 26;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.45)${emphasize ? ",0 0 0 4px rgba(220,38,38,.35)" : ""}"></span>`,
  });
}

/** Team marker: rounded square with the team's category icon; busy teams get a ring. */
export function teamIcon(
  Icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>,
  color: string,
  busy: boolean,
) {
  const svg = renderToStaticMarkup(createElement(Icon, { size: 16, color: "#fff", strokeWidth: 2.4 }));
  return L.divIcon({
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<span style="display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.5)${busy ? ",0 0 0 3px #e11d48" : ""}">${svg}</span>`,
  });
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
