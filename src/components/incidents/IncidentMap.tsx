import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { useEffect, useRef } from "react";
import type { Incident } from "../../types/incident";
import { basemaps, dotIcon as icon, fullscreenControl } from "../map/leafletShared";

const severityColors: Record<string, string> = {
  Low: "#059669",
  Medium: "#d97706",
  High: "#ea580c",
  Critical: "#dc2626",
};
const statusColors: Record<string, string> = {
  Reported: "#64748b",
  Pending: "#d97706",
  Assigned: "#4f46e5",
  "In Progress": "#2563eb",
  Resolved: "#059669",
};

/**
 * publicMode: for the public site. Markers are colored by status, positions are rounded to
 * about 1 km, and labels show only category and status (no titles, severity or exact location).
 */
export function IncidentMap({
  incidents,
  height = 380,
  onSelect,
  publicMode = false,
  scrollZoom = false,
}: {
  incidents: Incident[];
  height?: number;
  onSelect?: (id: string) => void;
  publicMode?: boolean;
  scrollZoom?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const located = incidents.filter((i) => i.coordinates);
  const palette = publicMode ? statusColors : severityColors;

  useEffect(() => {
    if (!ref.current || !located.length) return;
    const map = L.map(ref.current, { scrollWheelZoom: scrollZoom });
    const layers = basemaps(publicMode ? 14 : 19);
    layers.Street.addTo(map);
    L.control.layers(layers, undefined, { position: "topright" }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
    fullscreenControl().addTo(map);
    const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 40 });
    cluster.addTo(map);
    const points: L.LatLngTuple[] = [];
    for (const incident of located) {
      const round = (n: number) => (publicMode ? Math.round(n * 100) / 100 : n);
      const lat = round(incident.coordinates!.latitude);
      const lng = round(incident.coordinates!.longitude);
      points.push([lat, lng]);
      const label = publicMode
        ? `${incident.category} · ${incident.status}`
        : `${incident.currentSeverity} · ${incident.title}`;
      const marker = L.marker([lat, lng], {
        icon: icon(
          publicMode ? statusColors[incident.status] : severityColors[incident.currentSeverity],
        ),
        title: label,
        alt: label,
      });
      cluster.addLayer(marker);
      marker.bindTooltip(label);
      if (onSelect) marker.on("click", () => onSelect(incident.id));
    }
    if (points.length === 1) map.setView(points[0], publicMode ? 12 : 15);
    else map.fitBounds(points, { padding: [32, 32] });
    return () => {
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    publicMode,
    JSON.stringify(
      located.map((i) => [i.id, i.currentSeverity, i.status, i.category, i.coordinates]),
    ),
  ]);

  if (!located.length) {
    return (
      <div
        className="grid place-items-center rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500"
        style={{ minHeight: 160 }}
      >
        No incidents with coordinates to display.
      </div>
    );
  }
  return (
    <div>
      <div
        ref={ref}
        role="region"
        aria-label="Map of incident locations"
        className="z-0 w-full overflow-hidden rounded-xl border border-slate-200"
        style={{ height }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        {Object.entries(palette).map(([name, color]) => (
          <span key={name} className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full" style={{ background: color }} />
            {name}
          </span>
        ))}
        <span className="text-slate-400">
          {located.length} of {incidents.length} incidents shown. Basemap tiles load from
          OpenStreetMap, OpenTopoMap or Esri.
        </span>
      </div>
    </div>
  );
}
