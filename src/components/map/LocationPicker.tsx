import L from "leaflet";
import { useEffect, useRef } from "react";
import { basemaps, dotIcon } from "./leafletShared";

/** Click (or drag the marker) to set coordinates. */
export function LocationPicker({
  latitude,
  longitude,
  onChange,
  height = 220,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
  height?: number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { scrollWheelZoom: false });
    basemaps(19).Street.addTo(m);
    m.setView(latitude != null && longitude != null ? [latitude, longitude] : [40.72, -73.99], 13);
    const round = (n: number) => Math.round(n * 1e6) / 1e6;
    m.on("click", (e: L.LeafletMouseEvent) => change.current(round(e.latlng.lat), round(e.latlng.lng)));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const valid =
      latitude != null && longitude != null && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
    if (!valid) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      marker.current = L.marker([latitude, longitude], { icon: dotIcon("#1d4ed8"), draggable: true })
        .addTo(m)
        .on("dragend", () => {
          const p = marker.current!.getLatLng();
          change.current(Math.round(p.lat * 1e6) / 1e6, Math.round(p.lng * 1e6) / 1e6);
        });
    } else marker.current.setLatLng([latitude, longitude]);
    if (!m.getBounds().contains([latitude, longitude])) m.panTo([latitude, longitude]);
  }, [latitude, longitude]);

  return (
    <div
      ref={el}
      role="region"
      aria-label="Map: click to set the team location"
      className="z-0 w-full overflow-hidden rounded-xl border border-slate-200"
      style={{ height }}
    />
  );
}
