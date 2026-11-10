import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatKm, formatMinutes } from "../../domain/geo";
import { getRoute, type RouteResult } from "../../services/routing";
import type { Coordinates, Incident } from "../../types/incident";
import type { ResponseTeam } from "../../types/team";
import { priorityColors } from "../ui/Badge";
import { teamColors, teamIcons } from "../teams/teamVisuals";
import { basemaps, dotIcon, escapeHtml, fullscreenControl, teamIcon } from "./leafletShared";

export interface PreviewRoute {
  teamId: string;
  incidentId: string;
  route: RouteResult;
}

interface Props {
  incidents: Incident[];
  teams: ResponseTeam[];
  height?: number;
  showTeams?: boolean;
  showRoutes?: boolean;
  /** Zoom to this incident and its assigned team. */
  focusIncidentId?: string;
  /** Draw a proposed (not yet confirmed) route, e.g. the recommended team. */
  preview?: PreviewRoute | null;
  onSelectIncident?: (id: string) => void;
  onSelectTeam?: (id: string) => void;
}

const pos = (c: Coordinates): L.LatLngTuple => [c.latitude, c.longitude];
const teamPos = (t: ResponseTeam): L.LatLngTuple => [t.latitude, t.longitude];

function routeLabel(route: RouteResult) {
  return route.source === "osrm"
    ? `Road route ${formatKm(route.distanceKm)}${route.durationMin !== undefined ? ` · ~${formatMinutes(route.durationMin)} drive` : ""}`
    : `Straight-line ${formatKm(route.distanceKm)} (road route unavailable${route.fallbackReason ? `: ${route.fallbackReason}` : ""})`;
}

/** Loads road routes for every active team → incident pair (cached in the routing service). */
function useActiveRoutes(pairs: { key: string; from: Coordinates; to: Coordinates }[], enabled: boolean) {
  const [routes, setRoutes] = useState<Record<string, RouteResult>>({});
  const signature = pairs.map((p) => `${p.key}@${p.from.latitude},${p.from.longitude}`).join("|");
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    for (const pair of pairs) {
      void getRoute(pair.from, pair.to).then((route) => {
        if (!cancelled) setRoutes((r) => ({ ...r, [`${pair.key}@${pair.from.latitude},${pair.from.longitude}`]: route }));
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled]);
  return routes;
}

export function OperationsMap({
  incidents,
  teams,
  height = 460,
  showTeams = true,
  showRoutes = true,
  focusIncidentId,
  preview,
  onSelectIncident,
  onSelectTeam,
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const fittedFor = useRef<string | null>(null);
  const handlers = useRef({ onSelectIncident, onSelectTeam });
  handlers.current = { onSelectIncident, onSelectTeam };

  const located = useMemo(() => incidents.filter((i) => i.coordinates), [incidents]);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const pairs = useMemo(
    () =>
      located.flatMap((i) => {
        const team = i.assignedTeamId ? teamById.get(i.assignedTeamId) : undefined;
        return team
          ? [{ key: `${team.id}->${i.id}`, from: { latitude: team.latitude, longitude: team.longitude }, to: i.coordinates! }]
          : [];
      }),
    [located, teamById],
  );
  const routes = useActiveRoutes(pairs, showRoutes);

  // Create the map once.
  useEffect(() => {
    if (!el.current) return;
    const map = L.map(el.current, { scrollWheelZoom: false });
    const layers = basemaps(19);
    layers.Street.addTo(map);
    L.control.layers(layers, undefined, { position: "topright" }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
    fullscreenControl().addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    map.setView([40.72, -73.99], 12);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      fittedFor.current = null;
    };
  }, []);

  // Redraw markers and routes whenever data changes (keeps the user's pan/zoom).
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds: L.LatLngTuple[] = [];

    const drawRoute = (key: string, from: L.LatLngTuple, to: L.LatLngTuple, route: RouteResult | undefined, proposed = false) => {
      const geometry = route?.geometry ?? [from, to];
      const road = route?.source === "osrm";
      const line = L.polyline(geometry, {
        color: proposed ? "#7c3aed" : "#2563eb",
        weight: proposed ? 4 : 5,
        opacity: 0.85,
        dashArray: road ? undefined : "8 8",
      });
      line.bindTooltip(route ? routeLabel(route) : "Loading road route…", { sticky: true });
      layer.addLayer(line);
      if (proposed) bounds.push(...geometry);
      return key;
    };

    if (showRoutes) {
      for (const pair of pairs) {
        const route = routes[`${pair.key}@${pair.from.latitude},${pair.from.longitude}`];
        drawRoute(pair.key, pos(pair.from), pos(pair.to), route);
      }
    }
    if (preview) {
      const team = teamById.get(preview.teamId);
      const incident = incidents.find((i) => i.id === preview.incidentId);
      if (team && incident?.coordinates) drawRoute("preview", teamPos(team), pos(incident.coordinates), preview.route, true);
    }

    for (const incident of located) {
      const team = incident.assignedTeamId ? teamById.get(incident.assignedTeamId) : undefined;
      const resolved = incident.status === "Resolved";
      const marker = L.marker(pos(incident.coordinates!), {
        icon: dotIcon(resolved ? "#94a3b8" : priorityColors[incident.priority], incident.priority === "Critical" && !resolved),
        title: `${incident.priority} priority · ${incident.title}`,
        alt: `${incident.priority} priority incident: ${incident.title}`,
        zIndexOffset: resolved ? -500 : incident.priority === "Critical" ? 500 : 0,
        opacity: resolved ? 0.75 : 1,
      });
      const popup = document.createElement("div");
      popup.style.minWidth = "210px";
      popup.innerHTML = `
        <div style="font:600 11px/1.4 system-ui;color:#94a3b8;letter-spacing:.06em">${escapeHtml(incident.reference)}</div>
        <div style="font:700 14px/1.35 system-ui;color:#0f172a;margin:2px 0 6px">${escapeHtml(incident.title)}</div>
        <div style="font:500 12px/1.6 system-ui;color:#334155">
          <b style="color:${priorityColors[incident.priority]}">${incident.priority} priority</b> (score ${incident.priorityScore})<br/>
          ${escapeHtml(incident.category)} · ${escapeHtml(incident.status)}<br/>
          ${escapeHtml(incident.locationText)}<br/>
          Team: ${team ? escapeHtml(team.name) : "<i>none assigned</i>"}
        </div>`;
      if (handlers.current.onSelectIncident) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Open incident";
        button.style.cssText = "margin-top:8px;font:700 12px system-ui;color:#1d4ed8;background:none;border:0;padding:0;cursor:pointer";
        button.onclick = () => handlers.current.onSelectIncident?.(incident.id);
        popup.appendChild(button);
      }
      marker.bindPopup(popup);
      marker.bindTooltip(`${incident.priority} · ${incident.title}`);
      layer.addLayer(marker);
      bounds.push(pos(incident.coordinates!));
    }

    if (showTeams) {
      for (const team of teams) {
        const busy = team.availability === "Busy";
        const assigned = team.assignedIncidentId ? incidents.find((i) => i.id === team.assignedIncidentId) : undefined;
        const marker = L.marker(teamPos(team), {
          icon: teamIcon(teamIcons[team.category], teamColors[team.category], busy),
          title: `${team.name} (${team.category}, ${team.availability})`,
          alt: `${team.category} team ${team.name}, ${team.availability}`,
          zIndexOffset: 250,
        });
        const popup = document.createElement("div");
        popup.style.minWidth = "200px";
        popup.innerHTML = `
          <div style="font:600 11px/1.4 system-ui;color:#94a3b8;letter-spacing:.06em">${escapeHtml(team.id)} · ${escapeHtml(team.category)}</div>
          <div style="font:700 14px/1.35 system-ui;color:#0f172a;margin:2px 0 6px">${escapeHtml(team.name)}</div>
          <div style="font:500 12px/1.6 system-ui;color:#334155">
            <b style="color:${busy ? "#be123c" : "#047857"}">${team.availability}</b><br/>
            ${assigned ? `Responding to ${escapeHtml(assigned.reference)}<br/>` : ""}
            ${escapeHtml(team.contactName)} · ${escapeHtml(team.contactPhone)}
          </div>`;
        if (handlers.current.onSelectTeam) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = "Manage team";
          button.style.cssText = "margin-top:8px;font:700 12px system-ui;color:#1d4ed8;background:none;border:0;padding:0;cursor:pointer";
          button.onclick = () => handlers.current.onSelectTeam?.(team.id);
          popup.appendChild(button);
        }
        marker.bindPopup(popup);
        marker.bindTooltip(`${team.name} · ${team.availability}`);
        layer.addLayer(marker);
        bounds.push(teamPos(team));
      }
    }

    // Fit once per focus target (and when a preview appears); later updates keep the view.
    const focus = incidents.find((i) => i.id === focusIncidentId);
    const focusKey = `${focusIncidentId ?? "all"}|${preview?.teamId ?? ""}`;
    if (fittedFor.current !== focusKey) {
      fittedFor.current = focusKey;
      if (focus?.coordinates) {
        const team = focus.assignedTeamId ? teamById.get(focus.assignedTeamId) : undefined;
        const previewTeam = preview ? teamById.get(preview.teamId) : undefined;
        const pts: L.LatLngTuple[] = [pos(focus.coordinates)];
        if (team) pts.push(teamPos(team));
        if (previewTeam) pts.push(teamPos(previewTeam));
        if (pts.length === 1) map.setView(pts[0]!, 15);
        else map.fitBounds(pts, { padding: [40, 40], maxZoom: 16 });
      } else if (bounds.length) {
        map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
      }
    }
  }, [located, teams, incidents, teamById, pairs, routes, preview, showTeams, showRoutes, focusIncidentId]);

  return (
    <div>
      <div
        ref={el}
        role="region"
        aria-label="Operations map of incidents, response teams and routes"
        className="z-0 w-full overflow-hidden rounded-xl border border-slate-200"
        style={{ height }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
        {Object.entries(priorityColors).map(([name, color]) => (
          <span key={name} className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full" style={{ background: color }} />
            {name} priority
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-slate-400" />
          Resolved
        </span>
        {showTeams &&
          Object.entries(teamColors).map(([name, color]) => (
            <span key={name} className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-[3px]" style={{ background: color }} />
              {name} team
            </span>
          ))}
        {showTeams && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[3px] bg-white ring-2 ring-rose-600" />
            Busy team
          </span>
        )}
        {showRoutes && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-5 bg-blue-600" /> Road route (OSRM)
            <span className="ml-2 h-0 w-5 border-t-2 border-dashed border-blue-600" /> Straight-line fallback
          </span>
        )}
        <span className="text-slate-400">
          {located.length} of {incidents.length} incidents located
          {showTeams ? ` · ${teams.length} teams` : ""}. Tiles: OpenStreetMap contributors.
        </span>
      </div>
    </div>
  );
}
