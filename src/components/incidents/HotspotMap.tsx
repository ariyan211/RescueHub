import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { areaLabel, type Hotspot } from "../../utils/hotspots";

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function HotspotMap({
  hotspots,
  selectedId,
  onSelect,
  height = 440,
}: {
  hotspots: Hotspot[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const circles = useRef(new Map<string, L.Circle>());
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    if (!ref.current || !hotspots.length) return;
    const map = L.map(ref.current, { scrollWheelZoom: false });
    mapRef.current = map;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 14,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
    const max = Math.max(...hotspots.map((h) => h.count));
    circles.current.clear();
    for (const h of hotspots) {
      const circle = L.circle([h.latitude, h.longitude], {
        radius: 700 + (h.count / max) * 1400,
        color: "#d9431a",
        weight: 2,
        fillColor: "#f2562b",
        fillOpacity: 0.15 + (h.count / max) * 0.45,
      }).addTo(map);
      circle.bindTooltip(`${areaLabel(h)} · ${h.count} ${h.count === 1 ? "report" : "reports"}`);
      circle.on("click", () => selectRef.current(h.id));
      circles.current.set(h.id, circle);
    }
    map.fitBounds(L.latLngBounds(hotspots.map((h) => [h.latitude, h.longitude] as L.LatLngTuple)), {
      padding: [48, 48],
      maxZoom: 12,
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [hotspots]);

  useEffect(() => {
    circles.current.forEach((circle, id) =>
      circle.setStyle({
        color: id === selectedId ? "#0b1322" : "#d9431a",
        weight: id === selectedId ? 4 : 2,
      }),
    );
    const hotspot = hotspots.find((h) => h.id === selectedId);
    if (hotspot && mapRef.current) {
      mapRef.current.setView(
        [hotspot.latitude, hotspot.longitude],
        Math.max(mapRef.current.getZoom(), 12),
        {
          animate: !reduceMotion(),
        },
      );
    }
  }, [selectedId, hotspots]);

  if (!hotspots.length) {
    return (
      <div
        className="grid place-items-center rounded-xl border border-dashed border-[#cdbf9c] p-10 text-center text-sm text-slate-600"
        style={{ minHeight: 200 }}
      >
        No located incidents match these filters.
      </div>
    );
  }
  return (
    <div
      ref={ref}
      role="region"
      aria-label="Map of incident hotspots. The ranked list beside it provides the same information."
      className="z-0 w-full overflow-hidden rounded-xl border border-[#dccfae]"
      style={{ height }}
    />
  );
}
