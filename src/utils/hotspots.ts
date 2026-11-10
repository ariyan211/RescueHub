import type { Incident } from "../types/incident";

/** Grid cell size in degrees (about 3 km). Hotspots are intentionally approximate. */
export const CELL = 0.03;

export interface Hotspot {
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  accidents: number;
  categories: Record<string, number>;
  topCategory: string;
  lastReportedAt: string;
}

export function computeHotspots(incidents: Incident[]): Hotspot[] {
  const cells = new Map<string, Incident[]>();
  for (const incident of incidents) {
    if (!incident.coordinates) continue;
    const row = Math.floor(incident.coordinates.latitude / CELL);
    const col = Math.floor(incident.coordinates.longitude / CELL);
    const key = `${row}:${col}`;
    cells.set(key, [...(cells.get(key) ?? []), incident]);
  }
  return [...cells.entries()]
    .map(([key, items]) => {
      const [row, col] = key.split(":").map(Number);
      const categories: Record<string, number> = {};
      for (const item of items) categories[item.category] = (categories[item.category] ?? 0) + 1;
      const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0][0];
      return {
        id: key,
        latitude: (row + 0.5) * CELL,
        longitude: (col + 0.5) * CELL,
        count: items.length,
        accidents: categories["Road Accident"] ?? 0,
        categories,
        topCategory,
        lastReportedAt: items
          .map((i) => i.createdAt)
          .sort()
          .at(-1)!,
      };
    })
    .sort((a, b) => b.count - a.count || b.accidents - a.accidents);
}

export function areaLabel(h: Pick<Hotspot, "latitude" | "longitude">) {
  const lat = `${Math.abs(h.latitude).toFixed(2)}°${h.latitude >= 0 ? "N" : "S"}`;
  const lng = `${Math.abs(h.longitude).toFixed(2)}°${h.longitude >= 0 ? "E" : "W"}`;
  return `Near ${lat}, ${lng}`;
}
