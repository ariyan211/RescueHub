import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileWarning,
  FilterX,
  Navigation,
  RotateCcw,
  Timer,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { OperationsMap } from "../components/map/OperationsMap";
import { Badge, PriorityBadge, priorityColors } from "../components/ui/Badge";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { computeDashboard, type DashboardFilters } from "../domain/analytics";
import { formatMinutes } from "../domain/geo";
import { comparePriority } from "../domain/priority";
import { useIncidents } from "../hooks/useIncidents";
import { CATEGORIES, PRIORITIES, STATUSES } from "../types/incident";
import { elapsedTime } from "../utils/dateFormat";

const chartColors = ["#64748b", "#f59e0b", "#4f46e5", "#2563eb", "#10b981", "#f97316"];
const emptyFilters: DashboardFilters = { from: "", to: "", category: "", priority: "", status: "", location: "" };

export default function DashboardPage() {
  const { incidents, teams, resetData } = useIncidents();
  const navigate = useNavigate();
  const [resetOpen, setResetOpen] = useState(false);
  const [filters, setFilters] = useState<DashboardFilters>(emptyFilters);
  const set = <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const filtered = Object.values(filters).some(Boolean);

  const data = useMemo(() => computeDashboard(incidents, teams, filters), [incidents, teams, filters]);
  const { metrics } = data;

  const cards = [
    ["Total incidents", metrics.total, FileWarning, "text-blue-700 bg-blue-50"],
    ["Critical priority (active)", metrics.criticalActive, AlertTriangle, "text-red-700 bg-red-50"],
    ["Pending", metrics.pending, Clock3, "text-amber-700 bg-amber-50"],
    ["Assigned to a team", metrics.assigned, Navigation, "text-indigo-700 bg-indigo-50"],
    ["Resolved", metrics.resolved, CheckCircle2, "text-emerald-700 bg-emerald-50"],
    ["Available teams", metrics.availableTeams, UserCheck, "text-emerald-700 bg-emerald-50"],
    ["Busy teams", metrics.busyTeams, UsersRound, "text-rose-700 bg-rose-50"],
    [
      "Avg. time to assign",
      metrics.avgAssignMinutes === null ? "—" : formatMinutes(metrics.avgAssignMinutes),
      Timer,
      "text-violet-700 bg-violet-50",
    ],
  ] as const;

  const queue = useMemo(
    () => data.incidents.filter((i) => i.status !== "Resolved").sort(comparePriority).slice(0, 6),
    [data.incidents],
  );
  const activity = useMemo(
    () =>
      data.incidents
        .flatMap((incident) => incident.activity.map((event) => ({ ...event, incident })))
        .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
        .slice(0, 6),
    [data.incidents],
  );
  const teamName = (id?: string) => teams.find((t) => t.id === id)?.name;

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-slate-500">
            Live calculations from reports and response teams saved in this browser.
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wider text-blue-700">
            Demo data set
          </p>
        </div>
        <button className="button-secondary !py-2" onClick={() => setResetOpen(true)}>
          <RotateCcw size={16} />
          Reset demo data
        </button>
      </div>

      {metrics.criticalUnassigned > 0 && (
        <div
          role="alert"
          className="mb-5 flex flex-col justify-between gap-3 rounded-2xl border border-red-200 border-l-4 border-l-red-600 bg-red-50 p-4 sm:flex-row sm:items-center"
        >
          <p className="flex items-center gap-2 text-sm font-bold text-red-900">
            <AlertTriangle size={18} />
            {metrics.criticalUnassigned} critical-priority{" "}
            {metrics.criticalUnassigned === 1 ? "incident is" : "incidents are"} waiting for a response team.
          </p>
          <Link to="/admin/map" className="button-danger shrink-0 !py-2">
            Open live map
          </Link>
        </div>
      )}

      <section className="card mb-5" aria-label="Dashboard filters">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[repeat(6,1fr)_auto] 2xl:items-end">
          <div>
            <label className="label" htmlFor="dash-from">From date</label>
            <input id="dash-from" type="date" className="input" value={filters.from} max={filters.to || undefined} onChange={(e) => set("from", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="dash-to">To date</label>
            <input id="dash-to" type="date" className="input" value={filters.to} min={filters.from || undefined} onChange={(e) => set("to", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="dash-category">Category</label>
            <select id="dash-category" className="input" value={filters.category} onChange={(e) => set("category", e.target.value as DashboardFilters["category"])}>
              <option value="">All</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="dash-location">Location</label>
            <input id="dash-location" className="input" placeholder="e.g. Harbor" value={filters.location} onChange={(e) => set("location", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="dash-priority">Priority</label>
            <select id="dash-priority" className="input" value={filters.priority} onChange={(e) => set("priority", e.target.value as DashboardFilters["priority"])}>
              <option value="">All</option>
              {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="dash-status">Status</label>
            <select id="dash-status" className="input" value={filters.status} onChange={(e) => set("status", e.target.value as DashboardFilters["status"])}>
              <option value="">All</option>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <button className="button-secondary !py-2" onClick={() => setFilters(emptyFilters)} disabled={!filtered}>
            <FilterX size={16} />
            Clear
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {filtered
            ? `Showing ${metrics.total} of ${incidents.length} incidents. Team figures always show the current roster.`
            : "Filters apply to every incident metric, chart, the map and the priority queue."}
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon, tone]) => (
          <article className="card flex items-center justify-between" key={label}>
            <div>
              <p className="text-sm font-semibold text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-950">{value}</p>
            </div>
            <span className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}>
              <Icon size={21} />
            </span>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="card min-w-0">
          <h2 className="text-lg font-bold">Incidents by category</h2>
          <p className="mt-1 text-sm text-slate-500">{filtered ? "Filtered incidents" : "All saved incidents"}</p>
          <div className="mt-5 h-72" aria-label="Bar chart showing incidents by category">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.category} margin={{ left: -25, right: 5, bottom: 45 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card min-w-0">
          <h2 className="text-lg font-bold">Status distribution</h2>
          <p className="mt-1 text-sm text-slate-500">Current report progress</p>
          <div className="mt-5 h-72" aria-label="Pie chart showing status distribution">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.status} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {data.status.map((entry, index) => (
                    <Cell key={entry.name} fill={chartColors[index]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card min-w-0">
          <h2 className="text-lg font-bold">Priority distribution</h2>
          <p className="mt-1 text-sm text-slate-500">Automatic priority from the weighted score</p>
          <div className="mt-5 h-72" aria-label="Bar chart showing incidents by priority">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.priority} margin={{ left: -25, right: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="count" name="Incidents" radius={[6, 6, 0, 0]}>
                  {data.priority.map((p) => (
                    <Cell key={p.name} fill={priorityColors[p.name]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card min-w-0">
          <h2 className="text-lg font-bold">Response team availability</h2>
          <p className="mt-1 text-sm text-slate-500">
            {metrics.availableTeams} available · {metrics.busyTeams} busy, by response category
          </p>
          <div className="mt-5 h-72" aria-label="Stacked bar chart showing team availability by category">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.teams} margin={{ left: -25, right: 5, bottom: 20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} />
                <Legend iconType="circle" />
                <Bar dataKey="Available" stackId="t" fill="#10b981" />
                <Bar dataKey="Busy" stackId="t" fill="#e11d48" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card min-w-0">
          <h2 className="text-lg font-bold">Daily incident trend</h2>
          <p className="mt-1 text-sm text-slate-500">Reported and resolved per day · {data.dailyRange}</p>
          <div className="mt-5 h-72" aria-label="Bar chart showing incidents reported and resolved per day">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.daily} margin={{ left: -25, right: 5, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} />
                <Legend iconType="circle" />
                <Bar dataKey="reported" name="Reported" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="resolved" name="Resolved" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card min-w-0">
          <h2 className="text-lg font-bold">Weekly incident trend</h2>
          <p className="mt-1 text-sm text-slate-500">Last 8 weeks (weeks start Monday)</p>
          <div className="mt-5 h-72" aria-label="Line chart showing incidents reported and resolved per week">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.weekly} margin={{ left: -25, right: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend iconType="circle" />
                <Line type="monotone" dataKey="reported" name="Reported" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="card mt-5">
        <h2 className="text-lg font-bold">Incident locations</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          Markers are coloured by priority; squares are response teams with routes to their incidents.
          Select a marker for details. Demo incidents use fictional, approximate coordinates.
        </p>
        <OperationsMap
          incidents={data.incidents}
          teams={teams}
          height={420}
          onSelectIncident={(id) => navigate(`/admin/incidents/${id}`)}
          onSelectTeam={(id) => navigate(`/admin/teams?team=${id}`)}
        />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_.85fr]">
        <section className="card !p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h2 className="text-lg font-bold">Priority queue</h2>
              <p className="mt-1 text-sm text-slate-500">Unresolved, highest priority score first</p>
            </div>
            <Link to="/admin/incidents" className="text-sm font-bold text-blue-700">
              View all
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {queue.length ? (
              queue.map((incident) => (
                <article
                  key={incident.id}
                  className={`p-5 ${incident.priority === "Critical" ? "border-l-4 border-red-500 bg-red-50/35" : ""}`}
                >
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">{incident.reference}</span>
                        <PriorityBadge value={incident.priority} score={incident.priorityScore} />
                        <Badge value={incident.currentSeverity} />
                        <Badge value={incident.status} />
                      </div>
                      <h3 className="mt-2 truncate font-bold text-slate-950">{incident.title}</h3>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        {incident.category} · {incident.locationText} · {elapsedTime(incident.createdAt)} ·{" "}
                        {teamName(incident.assignedTeamId) ?? "no team yet"}
                      </p>
                    </div>
                    <Link
                      className={`${incident.assignedTeamId ? "button-secondary" : "button-primary"} shrink-0 !py-2`}
                      to={`/admin/incidents/${incident.id}`}
                    >
                      {incident.assignedTeamId ? "View details" : "Assign team"}
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <p className="p-8 text-center text-sm text-slate-500">No unresolved incidents.</p>
            )}
          </div>
        </section>
        <section className="card">
          <h2 className="text-lg font-bold">Recent activity</h2>
          <div className="mt-5 space-y-5">
            {activity.length ? (
              activity.map((event) => (
                <div key={event.id} className="flex gap-3">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500 ring-4 ring-blue-50" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{event.message}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {event.incident.reference} · {event.actor} · {elapsedTime(event.timestamp)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No activity yet.</p>
            )}
          </div>
        </section>
      </div>
      <ConfirmDialog
        open={resetOpen}
        title="Reset demo data?"
        description="This replaces all current reports, response teams and assignments with the original fictional demo dataset."
        confirmLabel="Reset data"
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          resetData();
          setResetOpen(false);
        }}
      />
    </div>
  );
}
