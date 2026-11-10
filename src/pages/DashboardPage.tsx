import { AlertTriangle, CheckCircle2, Clock3, FileWarning, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { IncidentMap } from "../components/incidents/IncidentMap";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from "recharts";
import { Badge } from "../components/ui/Badge";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useIncidents } from "../hooks/useIncidents";
import { CATEGORIES, STATUSES } from "../types/incident";
import { elapsedTime } from "../utils/dateFormat";
import { severityRank } from "../utils/severity";

const chartColors = ["#2563eb", "#f59e0b", "#8b5cf6", "#10b981", "#f97316", "#64748b"];

export default function DashboardPage() {
  const { incidents, resetData } = useIncidents();
  const navigate = useNavigate();
  const [resetOpen, setResetOpen] = useState(false);
  const metrics = [
    ["Total incidents", incidents.length, FileWarning, "text-blue-700 bg-blue-50"],
    [
      "Active critical",
      incidents.filter((i) => i.currentSeverity === "Critical" && i.status !== "Resolved").length,
      AlertTriangle,
      "text-red-700 bg-red-50",
    ],
    [
      "Pending",
      incidents.filter((i) => i.status === "Pending").length,
      Clock3,
      "text-amber-700 bg-amber-50",
    ],
    [
      "Resolved",
      incidents.filter((i) => i.status === "Resolved").length,
      CheckCircle2,
      "text-emerald-700 bg-emerald-50",
    ],
  ] as const;
  const categoryData = CATEGORIES.map((name) => ({
    name,
    count: incidents.filter((i) => i.category === name).length,
  }));
  const statusData = STATUSES.map((name) => ({
    name,
    value: incidents.filter((i) => i.status === name).length,
  }));
  const priority = useMemo(
    () =>
      incidents
        .filter((i) => i.status !== "Resolved")
        .sort(
          (a, b) =>
            severityRank[b.currentSeverity] - severityRank[a.currentSeverity] ||
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )
        .slice(0, 6),
    [incidents],
  );
  const activity = useMemo(
    () =>
      incidents
        .flatMap((incident) => incident.activity.map((event) => ({ ...event, incident })))
        .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
        .slice(0, 6),
    [incidents],
  );
  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-slate-500">
            Live calculations from reports saved in this browser.
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, Icon, tone]) => (
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
          <p className="mt-1 text-sm text-slate-500">All saved incidents</p>
          <div className="mt-5 h-72" aria-label="Bar chart showing incidents by category">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ left: -25, right: 5, bottom: 45 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                />
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
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={entry.name} fill={chartColors[index]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <section className="card mt-5">
        <h2 className="text-lg font-bold">Incident locations</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          Markers are colored by current severity. Select a marker to open its details. Demo
          incidents use fictional, approximate coordinates.
        </p>
        <IncidentMap incidents={incidents} onSelect={(id) => navigate(`/admin/incidents/${id}`)} />
      </section>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_.85fr]">
        <section className="card !p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h2 className="text-lg font-bold">Priority queue</h2>
              <p className="mt-1 text-sm text-slate-500">Unresolved, highest severity first</p>
            </div>
            <Link to="/admin/incidents" className="text-sm font-bold text-blue-700">
              View all
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {priority.length ? (
              priority.map((incident) => (
                <article
                  key={incident.id}
                  className={`p-5 ${incident.currentSeverity === "Critical" ? "border-l-4 border-red-500 bg-red-50/35" : ""}`}
                >
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">
                          {incident.reference}
                        </span>
                        <Badge value={incident.currentSeverity} />
                        <Badge value={incident.status} />
                      </div>
                      <h3 className="mt-2 truncate font-bold text-slate-950">{incident.title}</h3>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        {incident.category} · {incident.locationText} ·{" "}
                        {elapsedTime(incident.createdAt)}
                      </p>
                    </div>
                    <Link
                      className="button-secondary shrink-0 !py-2"
                      to={`/admin/incidents/${incident.id}`}
                    >
                      View details
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
        description="This replaces all current reports and changes with the original fictional demo dataset."
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
