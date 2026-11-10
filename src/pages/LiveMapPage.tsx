import { FilterX } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { OperationsMap } from "../components/map/OperationsMap";
import { Badge, PriorityBadge } from "../components/ui/Badge";
import { comparePriority } from "../domain/priority";
import { formatKm } from "../domain/geo";
import { haversineKm } from "../domain/geo";
import { useIncidents } from "../hooks/useIncidents";
import { CATEGORIES, PRIORITIES } from "../types/incident";

export default function LiveMapPage() {
  const { incidents, teams } = useIncidents();
  const navigate = useNavigate();
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [scope, setScope] = useState<"active" | "all">("active");
  const [showTeams, setShowTeams] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);

  const filtered = useMemo(
    () =>
      incidents.filter(
        (i) =>
          (scope === "all" || i.status !== "Resolved") &&
          (!category || i.category === category) &&
          (!priority || i.priority === priority),
      ),
    [incidents, scope, category, priority],
  );
  const active = useMemo(
    () => filtered.filter((i) => i.assignedTeamId).sort(comparePriority),
    [filtered],
  );
  const waiting = useMemo(
    () => filtered.filter((i) => !i.assignedTeamId && i.status !== "Resolved").sort(comparePriority),
    [filtered],
  );
  const clear = () => {
    setCategory("");
    setPriority("");
    setScope("active");
    setShowTeams(true);
    setShowRoutes(true);
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <section className="card">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-[repeat(3,1fr)_auto_auto_auto] xl:items-end">
          <div>
            <label className="label" htmlFor="map-category">
              Incident category
            </label>
            <select id="map-category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="map-priority">
              Priority
            </label>
            <select id="map-priority" className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">All</option>
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="map-scope">
              Incidents
            </label>
            <select id="map-scope" className="input" value={scope} onChange={(e) => setScope(e.target.value as "active" | "all")}>
              <option value="active">Active only</option>
              <option value="all">Include resolved</option>
            </select>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={showTeams} onChange={(e) => setShowTeams(e.target.checked)} />
            Teams
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={showRoutes} onChange={(e) => setShowRoutes(e.target.checked)} />
            Routes
          </label>
          <button className="button-secondary !py-2" onClick={clear}>
            <FilterX size={16} />
            Reset
          </button>
        </div>
      </section>

      <section className="card mt-5">
        <h2 className="text-lg font-bold">Live operations map</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          Incident dots are coloured by priority; squares are response teams (ringed when busy).
          Lines connect assigned teams to their incidents: solid for OSRM road routes, dashed when
          only the straight-line distance is available. Updates automatically as reports and teams
          change.
        </p>
        <OperationsMap
          incidents={filtered}
          teams={teams}
          height={560}
          showTeams={showTeams}
          showRoutes={showRoutes}
          onSelectIncident={(id) => navigate(`/admin/incidents/${id}`)}
          onSelectTeam={(id) => navigate(`/admin/teams?team=${id}`)}
        />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="card !p-0 overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-lg font-bold">Active assignments</h2>
            <p className="mt-1 text-sm text-slate-500">{active.length} teams responding</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {active.map((i) => {
              const team = teams.find((t) => t.id === i.assignedTeamId);
              const km = team && i.coordinates ? haversineKm(i.coordinates, team) : undefined;
              return (
                <li key={i.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">{i.reference}</span>
                      <PriorityBadge value={i.priority} />
                      <Badge value={i.status} />
                    </div>
                    <p className="mt-1 truncate font-bold">{i.title}</p>
                    <p className="text-sm text-slate-500">
                      {team?.name ?? "Unknown team"}
                      {km !== undefined ? ` · ${formatKm(km)} straight-line` : ""}
                    </p>
                  </div>
                  <Link className="button-secondary shrink-0 !py-2" to={`/admin/incidents/${i.id}`}>
                    View
                  </Link>
                </li>
              );
            })}
            {!active.length && <li className="p-8 text-center text-sm text-slate-500">No teams are currently assigned.</li>}
          </ul>
        </section>
        <section className="card !p-0 overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-lg font-bold">Awaiting a team</h2>
            <p className="mt-1 text-sm text-slate-500">Highest priority first</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {waiting.map((i) => (
              <li
                key={i.id}
                className={`flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between ${i.priority === "Critical" ? "border-l-4 border-red-500 bg-red-50/35" : ""}`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">{i.reference}</span>
                    <PriorityBadge value={i.priority} score={i.priorityScore} />
                  </div>
                  <p className="mt-1 truncate font-bold">{i.title}</p>
                  <p className="text-sm text-slate-500">{i.category} · {i.locationText}</p>
                </div>
                <Link className="button-primary shrink-0 !py-2" to={`/admin/incidents/${i.id}`}>
                  Assign team
                </Link>
              </li>
            ))}
            {!waiting.length && <li className="p-8 text-center text-sm text-slate-500">Every active incident has a team.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
