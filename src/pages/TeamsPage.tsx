import { CheckCircle2, FilterX, Pencil, Plus, Search, Trash2, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { TeamFormDialog } from "../components/teams/TeamFormDialog";
import { teamColors, teamIcons } from "../components/teams/teamVisuals";
import { Badge, PriorityBadge } from "../components/ui/Badge";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useIncidents } from "../hooks/useIncidents";
import { AVAILABILITIES, TEAM_CATEGORIES, type ResponseTeam } from "../types/team";
import { elapsedTime } from "../utils/dateFormat";

export default function TeamsPage() {
  const { teams, incidents, addTeam, updateTeam, deleteTeam, setTeamAvailability } = useIncidents();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [availability, setAvailability] = useState("");
  const [editing, setEditing] = useState<ResponseTeam | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<ResponseTeam | undefined>();
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const highlight = params.get("team");

  function notify(text: string, error = false) {
    setToast({ text, error });
    window.setTimeout(() => setToast(null), 3200);
  }

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams
      .filter(
        (t) =>
          (!q || `${t.id} ${t.name} ${t.contactName} ${t.contactPhone}`.toLowerCase().includes(q)) &&
          (!category || t.category === category) &&
          (!availability || t.availability === availability),
      )
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [teams, search, category, availability]);

  const counts = {
    total: teams.length,
    available: teams.filter((t) => t.availability === "Available").length,
    busy: teams.filter((t) => t.availability === "Busy").length,
  };
  const clear = () => {
    setSearch("");
    setCategory("");
    setAvailability("");
    if (highlight) setParams({});
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      {toast && (
        <div
          role="status"
          className={`fixed right-4 top-22 z-40 flex max-w-md items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${toast.error ? "bg-red-700" : "bg-slate-950"}`}
        >
          <CheckCircle2 size={17} className={toast.error ? "text-red-200" : "text-emerald-400"} />
          {toast.text}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Response teams", counts.total, "text-blue-700 bg-blue-50"],
          ["Available", counts.available, "text-emerald-700 bg-emerald-50"],
          ["Busy", counts.busy, "text-rose-700 bg-rose-50"],
        ].map(([label, value, tone]) => (
          <article className="card flex items-center justify-between" key={label as string}>
            <div>
              <p className="text-sm font-semibold text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-950">{value}</p>
            </div>
            <span className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}>
              <UsersRound size={21} />
            </span>
          </article>
        ))}
      </div>

      <section className="card mt-5">
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-end">
          <div>
            <label className="label" htmlFor="team-search">
              Search teams
            </label>
            <div className="relative">
              <Search size={17} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
              <input
                id="team-search"
                className="input !pl-10"
                placeholder="Team ID, name, or contact"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="team-filter-category">
              Response category
            </label>
            <select id="team-filter-category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All</option>
              {TEAM_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="team-filter-availability">
              Availability
            </label>
            <select id="team-filter-availability" className="input" value={availability} onChange={(e) => setAvailability(e.target.value)}>
              <option value="">All</option>
              {AVAILABILITIES.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>
          <button
            className="button-primary justify-center"
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            <Plus size={17} />
            Add team
          </button>
        </div>
        <div className="mt-4 flex flex-col justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
          <p className="text-sm font-semibold text-slate-600">
            {results.length} {results.length === 1 ? "team" : "teams"}
          </p>
          <button className="button-secondary !py-2" onClick={clear}>
            <FilterX size={16} />
            Clear filters
          </button>
        </div>
      </section>

      {results.length ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {results.map((team) => {
            const Icon = teamIcons[team.category];
            const incident = incidents.find((i) => i.id === team.assignedIncidentId);
            return (
              <article
                key={team.id}
                className={`card flex flex-col ${highlight === team.id ? "ring-2 ring-blue-500" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white"
                      style={{ background: teamColors[team.category] }}
                    >
                      <Icon size={21} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-400">{team.id}</p>
                      <h2 className="truncate font-bold text-slate-950">{team.name}</h2>
                      <p className="text-sm text-slate-500">{team.category}</p>
                    </div>
                  </div>
                  <Badge value={team.availability} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt>Location</dt>
                    <dd>
                      {team.latitude.toFixed(4)}, {team.longitude.toFixed(4)}
                    </dd>
                  </div>
                  <div>
                    <dt>Contact</dt>
                    <dd>
                      {team.contactName}
                      <span className="block text-xs text-slate-500">
                        {team.contactPhone}
                        {team.contactEmail ? ` · ${team.contactEmail}` : ""}
                      </span>
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt>Assigned incident</dt>
                    <dd>
                      {incident ? (
                        <Link to={`/admin/incidents/${incident.id}`} className="font-semibold text-blue-700 hover:underline">
                          {incident.reference} · {incident.title}
                        </Link>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                      {incident && (
                        <span className="mt-1.5 flex flex-wrap gap-1.5">
                          <PriorityBadge value={incident.priority} />
                          <Badge value={incident.status} />
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-slate-400">Updated {elapsedTime(team.updatedAt)}</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <button
                    className="button-secondary !py-2 text-sm"
                    disabled={!!team.assignedIncidentId}
                    title={team.assignedIncidentId ? "Teams on an incident become available when it is resolved or unassigned." : undefined}
                    onClick={() => {
                      const next = team.availability === "Available" ? "Busy" : "Available";
                      const r = setTeamAvailability(team.id, next);
                      notify(r.ok ? `${team.name} is now ${next}` : r.error, !r.ok);
                    }}
                  >
                    {team.availability === "Available" ? "Mark busy (off duty)" : "Mark available"}
                  </button>
                  <button
                    className="button-secondary !py-2 text-sm"
                    onClick={() => {
                      setEditing(team);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil size={15} />
                    Edit
                  </button>
                  <button
                    className="button-secondary !py-2 text-sm !text-red-700"
                    onClick={() => setDeleting(team)}
                  >
                    <Trash2 size={15} />
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card mt-5 py-14 text-center">
          <UsersRound className="mx-auto text-slate-300" size={34} />
          <h2 className="mt-4 font-bold">{teams.length ? "No teams match these filters" : "No response teams yet"}</h2>
          <p className="mt-2 text-sm text-slate-500">
            {teams.length ? "Try adjusting your search or clearing filters." : "Add a team to start assigning incidents."}
          </p>
          {teams.length > 0 && (
            <button className="button-secondary mt-5" onClick={clear}>
              Clear filters
            </button>
          )}
        </div>
      )}

      <TeamFormDialog
        open={formOpen}
        team={editing}
        teams={teams}
        onCancel={() => setFormOpen(false)}
        onSave={(input) => {
          const r = editing ? updateTeam(editing.id, input) : addTeam(input);
          if (!r.ok) return r.error;
          setFormOpen(false);
          notify(editing ? `${input.name.trim()} updated` : `${input.name.trim()} added`);
          return null;
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.name ?? "team"}?`}
        description={
          deleting?.assignedIncidentId
            ? "This team is assigned to an active incident. Resolve or unassign that incident first."
            : "The team is removed from the roster. Past assignments stay in each incident's history."
        }
        confirmLabel="Delete team"
        danger
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          const team = deleting!;
          setDeleting(undefined);
          const r = deleteTeam(team.id);
          notify(r.ok ? `${team.name} deleted` : r.error, !r.ok);
        }}
      />
    </div>
  );
}
