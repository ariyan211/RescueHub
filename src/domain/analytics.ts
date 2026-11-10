import {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  type Category,
  type Incident,
  type IncidentStatus,
  type Priority,
} from "../types/incident";
import { TEAM_CATEGORIES, type ResponseTeam } from "../types/team";

export interface DashboardFilters {
  /** yyyy-mm-dd, inclusive, local time */
  from?: string;
  to?: string;
  category?: Category | "";
  priority?: Priority | "";
  status?: IncidentStatus | "";
  /** Case-insensitive match on the location description. */
  location?: string;
}

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const parseDay = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
};
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shortDay = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function filterIncidents(incidents: Incident[], f: DashboardFilters): Incident[] {
  const from = f.from ? parseDay(f.from).getTime() : -Infinity;
  const to = f.to ? parseDay(f.to).getTime() + DAY : Infinity;
  const loc = f.location?.trim().toLowerCase();
  return incidents.filter((i) => {
    const t = Date.parse(i.createdAt);
    return (
      t >= from &&
      t < to &&
      (!f.category || i.category === f.category) &&
      (!f.priority || i.priority === f.priority) &&
      (!f.status || i.status === f.status) &&
      (!loc || i.locationText.toLowerCase().includes(loc))
    );
  });
}

function series(incidents: Incident[], start: Date, buckets: number, size: number, label: (d: Date) => string) {
  const out = Array.from({ length: buckets }, (_, k) => {
    const s = new Date(start.getTime() + k * size * DAY);
    return { label: label(s), start: s.getTime(), end: s.getTime() + size * DAY, reported: 0, resolved: 0 };
  });
  for (const i of incidents) {
    const created = Date.parse(i.createdAt);
    const resolved = i.resolvedAt ? Date.parse(i.resolvedAt) : NaN;
    for (const b of out) {
      if (created >= b.start && created < b.end) b.reported++;
      if (resolved >= b.start && resolved < b.end) b.resolved++;
    }
  }
  return out.map(({ label, reported, resolved }) => ({ label, reported, resolved }));
}

export function computeDashboard(
  allIncidents: Incident[],
  teams: ResponseTeam[],
  filters: DashboardFilters,
  now: Date = new Date(),
) {
  const incidents = filterIncidents(allIncidents, filters);
  const active = incidents.filter((i) => i.status !== "Resolved");

  const firstAssignMinutes = incidents
    .map((i) => {
      const first = i.assignments[0];
      return first ? (Date.parse(first.assignedAt) - Date.parse(i.createdAt)) / 60_000 : NaN;
    })
    .filter((m) => Number.isFinite(m) && m >= 0);
  const avgAssignMinutes = firstAssignMinutes.length
    ? firstAssignMinutes.reduce((a, b) => a + b, 0) / firstAssignMinutes.length
    : null;

  const metrics = {
    total: incidents.length,
    criticalActive: active.filter((i) => i.priority === "Critical").length,
    criticalUnassigned: active.filter((i) => i.priority === "Critical" && !i.assignedTeamId).length,
    pending: incidents.filter((i) => i.status === "Pending").length,
    assigned: incidents.filter((i) => i.assignedTeamId).length,
    inProgress: incidents.filter((i) => i.status === "In Progress").length,
    resolved: incidents.filter((i) => i.status === "Resolved").length,
    availableTeams: teams.filter((t) => t.availability === "Available").length,
    busyTeams: teams.filter((t) => t.availability === "Busy").length,
    avgAssignMinutes,
  };

  // Trend window: the selected date range (up to 92 days), otherwise the last 14 days / 8 weeks.
  const end = filters.to ? parseDay(filters.to) : startOfDay(now);
  let dailyStart = new Date(end.getTime() - 13 * DAY);
  if (filters.from) {
    const from = parseDay(filters.from);
    const span = Math.round((end.getTime() - from.getTime()) / DAY) + 1;
    if (span >= 1 && span <= 92) dailyStart = from;
  }
  const dailyBuckets = Math.round((end.getTime() - dailyStart.getTime()) / DAY) + 1;
  // Weeks start on Monday.
  const endWeek = new Date(end.getTime() - ((end.getDay() + 6) % 7) * DAY);
  const weeklyStart = new Date(endWeek.getTime() - 7 * 7 * DAY);
  const trendIncidents = filterIncidents(allIncidents, { ...filters, from: undefined, to: undefined });

  return {
    incidents,
    metrics,
    priority: PRIORITIES.map((name) => ({ name, count: incidents.filter((i) => i.priority === name).length })),
    status: STATUSES.map((name) => ({ name, value: incidents.filter((i) => i.status === name).length })),
    category: CATEGORIES.map((name) => ({ name, count: incidents.filter((i) => i.category === name).length })),
    teams: TEAM_CATEGORIES.map((name) => ({
      name,
      Available: teams.filter((t) => t.category === name && t.availability === "Available").length,
      Busy: teams.filter((t) => t.category === name && t.availability === "Busy").length,
    })),
    daily: series(trendIncidents, dailyStart, dailyBuckets, 1, shortDay),
    weekly: series(trendIncidents, weeklyStart, 8, 7, (d) => `Wk of ${shortDay(d)}`),
    dailyRange: `${dayKey(dailyStart)} – ${dayKey(end)}`,
  };
}
