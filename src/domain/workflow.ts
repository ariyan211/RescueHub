/**
 * Emergency workflow engine: pure, synchronous state transitions over the
 * whole data set (incidents + teams). Every action either returns a complete,
 * consistent next state or throws a WorkflowError and changes nothing, so
 * team and incident statuses can never drift apart.
 *
 *   New incident → Reported → (Pending) → Assigned → In Progress → Resolved
 *   Team:          Available → Busy → Available
 */
import type {
  Activity,
  Assignment,
  Incident,
  IncidentRecord,
  IncidentStatus,
  NewIncidentInput,
  RouteInfo,
  Severity,
  Verification,
} from "../types/incident";
import {
  AVAILABILITIES,
  TEAM_CATEGORIES,
  type Availability,
  type ResponseTeam,
  type TeamInput,
} from "../types/team";
import { suggestSeverity } from "../utils/severity";
import { formatKm, formatMinutes, haversineKm, isValidLatitude, isValidLongitude } from "./geo";
import { calculatePriority } from "./priority";
import { isSuitable } from "./teams";

export interface AppState {
  incidents: Incident[];
  teams: ResponseTeam[];
}

export class WorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowError";
  }
}

export const ADMIN_ACTOR = "Demo administrator";

let counter = 0;
export function uid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

const iso = (now: Date) => now.toISOString();

function event(
  type: Activity["type"],
  message: string,
  actor: Activity["actor"],
  now: Date,
): Activity {
  return { id: uid(), type, message, actor, timestamp: iso(now) };
}

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

/** Recomputes priority; logs an activity entry when the level changes. */
export function withPriority(incident: Incident, now: Date, reason?: string): Incident {
  const result = calculatePriority(incident, now);
  const changed = incident.priority !== result.priority;
  const sameScore = incident.priorityScore === result.score;
  if (!changed && sameScore) return incident;
  return {
    ...incident,
    priority: result.priority,
    priorityScore: result.score,
    priorityFactors: result.factors,
    priorityUpdatedAt: iso(now),
    activity:
      changed && incident.priority
        ? [
            ...incident.activity,
            event(
              "priority_changed",
              `Priority changed from ${incident.priority} to ${result.priority} (score ${result.score}/100)${reason ? `: ${reason}` : ""}.`,
              "System",
              now,
            ),
          ]
        : incident.activity,
  };
}

/** Upgrades a Round 1 record (or partially migrated one) to the full Incident shape. */
export function normalizeIncident(record: IncidentRecord | Incident, now: Date): Incident {
  const full = record as Partial<Incident> & IncidentRecord;
  const statusHistory =
    full.statusHistory ??
    [
      { status: "Reported" as IncidentStatus, at: record.createdAt, actor: "Reporter" },
      ...record.activity
        .filter((a) => a.type === "status_changed")
        .map((a) => {
          const to = /to ([A-Za-z ]+)\.?$/.exec(a.message)?.[1]?.trim() as IncidentStatus;
          return { status: to ?? record.status, at: a.timestamp, actor: a.actor };
        }),
    ];
  const lastAt = (s: IncidentStatus) => [...statusHistory].reverse().find((h) => h.status === s)?.at;
  const base: Incident = {
    ...record,
    priority: full.priority ?? (undefined as never),
    priorityScore: full.priorityScore ?? -1,
    priorityFactors: full.priorityFactors ?? [],
    priorityUpdatedAt: full.priorityUpdatedAt ?? iso(now),
    assignedTeamId: full.assignedTeamId,
    assignments: full.assignments ?? [],
    statusHistory,
    assignedAt: full.assignedAt,
    inProgressAt: full.inProgressAt ?? lastAt("In Progress"),
    resolvedAt: full.resolvedAt ?? (record.status === "Resolved" ? lastAt("Resolved") : undefined),
  };
  const priced = withPriority(base, now);
  // First computation on an old record is not a "change"; don't log it.
  return full.priority ? priced : { ...priced, activity: record.activity };
}

/** Periodic refresh: waiting-time escalation for unresolved incidents. */
export function refreshPriorities(state: AppState, now: Date): AppState {
  let changed = false;
  const incidents = state.incidents.map((incident) => {
    if (incident.status === "Resolved") return incident;
    const next = withPriority(incident, now, "time since report increased");
    if (next !== incident) changed = true;
    return next;
  });
  return changed ? { ...state, incidents } : state;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findIncident(state: AppState, id: string) {
  const incident = state.incidents.find((i) => i.id === id);
  if (!incident) throw new WorkflowError("Incident not found. It may have been deleted.");
  return incident;
}

function findTeam(state: AppState, id: string) {
  const team = state.teams.find((t) => t.id === id);
  if (!team) throw new WorkflowError("Response team not found. It may have been deleted.");
  return team;
}

function replaceIncident(state: AppState, next: Incident): AppState {
  return { ...state, incidents: state.incidents.map((i) => (i.id === next.id ? next : i)) };
}

function replaceTeam(teams: ResponseTeam[], next: ResponseTeam) {
  return teams.map((t) => (t.id === next.id ? next : t));
}

function setStatus(incident: Incident, status: IncidentStatus, actor: Activity["actor"], now: Date) {
  if (incident.status === status) return incident;
  const at = iso(now);
  return {
    ...incident,
    status,
    statusHistory: [...incident.statusHistory, { status, at, actor }],
    activity: [
      ...incident.activity,
      event("status_changed", `Status changed from ${incident.status} to ${status}.`, actor, now),
    ],
    ...(status === "Assigned" && { assignedAt: at }),
    ...(status === "In Progress" && !incident.inProgressAt && { inProgressAt: at }),
    ...(status === "Resolved" ? { resolvedAt: at } : { resolvedAt: undefined }),
    updatedAt: at,
  };
}

/** Closes the open assignment and frees the team. Returns both updated records. */
function release(
  state: AppState,
  incident: Incident,
  reason: NonNullable<Assignment["releaseReason"]>,
  actor: Activity["actor"],
  now: Date,
): { incident: Incident; teams: ResponseTeam[] } {
  if (!incident.assignedTeamId) return { incident, teams: state.teams };
  const team = state.teams.find((t) => t.id === incident.assignedTeamId);
  const at = iso(now);
  const teams = team
    ? replaceTeam(state.teams, {
        ...team,
        availability: "Available",
        assignedIncidentId: undefined,
        updatedAt: at,
      })
    : state.teams;
  const name = team?.name ?? incident.assignments.find((a) => !a.releasedAt)?.teamName ?? "Team";
  const why = {
    resolved: "incident resolved",
    reassigned: "another team was assigned",
    unassigned: "unassigned by administrator",
    incident_deleted: "incident deleted",
  }[reason];
  return {
    teams,
    incident: {
      ...incident,
      assignedTeamId: undefined,
      assignments: incident.assignments.map((a) =>
        a.releasedAt ? a : { ...a, releasedAt: at, releaseReason: reason },
      ),
      activity: [
        ...incident.activity,
        event("team_released", `${name} released and available again (${why}).`, actor, now),
      ],
      updatedAt: at,
    },
  };
}

// ---------------------------------------------------------------------------
// Incident actions
// ---------------------------------------------------------------------------

function reference(now: Date) {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `RH-${now.getFullYear()}-${suffix}`;
}

export function createIncident(
  state: AppState,
  input: NewIncidentInput,
  now: Date,
): { state: AppState; incident: Incident } {
  const suggestion = suggestSeverity(input);
  let ref = reference(now);
  while (state.incidents.some((i) => i.reference === ref)) ref = reference(now);
  const at = iso(now);
  const record: IncidentRecord = {
    ...input,
    id: uid(),
    reference: ref,
    suggestedSeverity: suggestion.severity,
    currentSeverity: suggestion.severity,
    severityReason: suggestion.reason,
    requiresReview: true,
    status: "Reported",
    verification: "Unverified",
    createdAt: at,
    updatedAt: at,
    activity: [
      event("submitted", "Report submitted.", "Reporter", now),
      event(
        "severity_suggested",
        `${suggestion.severity} severity suggested. ${suggestion.reason}`,
        "System",
        now,
      ),
    ],
  };
  const normalized = normalizeIncident(record, now);
  const incident: Incident = {
    ...normalized,
    activity: [
      ...normalized.activity,
      event(
        "priority_changed",
        `${normalized.priority} priority assigned automatically (score ${normalized.priorityScore}/100).`,
        "System",
        now,
      ),
    ],
  };
  return { state: { ...state, incidents: [incident, ...state.incidents] }, incident };
}

export function changeStatus(
  state: AppState,
  id: string,
  status: IncidentStatus,
  now: Date,
  actor: Activity["actor"] = ADMIN_ACTOR,
): AppState {
  const incident = findIncident(state, id);
  if (incident.status === status) return state;

  if ((status === "Assigned" || status === "In Progress") && !incident.assignedTeamId)
    throw new WorkflowError(
      status === "Assigned"
        ? "Assign a response team first. The status becomes Assigned automatically."
        : "An incident can move to In Progress only after a response team is assigned.",
    );

  let teams = state.teams;
  let next = incident;
  if (status === "Resolved") {
    ({ incident: next, teams } = release(state, next, "resolved", actor, now));
  } else if ((status === "Reported" || status === "Pending") && incident.assignedTeamId) {
    ({ incident: next, teams } = release(state, next, "unassigned", actor, now));
  }
  next = withPriority(setStatus(next, status, actor, now), now);
  return { teams, incidents: replaceIncident(state, next).incidents };
}

export function changeVerification(
  state: AppState,
  id: string,
  verification: Verification,
  now: Date,
): AppState {
  const incident = findIncident(state, id);
  if (incident.verification === verification) return state;
  return replaceIncident(state, {
    ...incident,
    verification,
    updatedAt: iso(now),
    activity: [
      ...incident.activity,
      event(
        "verification_changed",
        `Verification changed from ${incident.verification} to ${verification}.`,
        ADMIN_ACTOR,
        now,
      ),
    ],
  });
}

export function changeSeverity(
  state: AppState,
  id: string,
  severity: Severity,
  reason: string,
  now: Date,
): AppState {
  const incident = findIncident(state, id);
  if (!reason.trim()) throw new WorkflowError("A reason is required when changing severity.");
  const updated: Incident = {
    ...incident,
    currentSeverity: severity,
    updatedAt: iso(now),
    activity: [
      ...incident.activity,
      event(
        "severity_changed",
        `Severity changed from ${incident.currentSeverity} to ${severity}. Reason: ${reason.trim()}`,
        ADMIN_ACTOR,
        now,
      ),
    ],
  };
  return replaceIncident(state, withPriority(updated, now, "severity changed"));
}

export function addNote(state: AppState, id: string, note: string, now: Date): AppState {
  const incident = findIncident(state, id);
  if (!note.trim()) throw new WorkflowError("A note cannot be empty.");
  return replaceIncident(state, {
    ...incident,
    updatedAt: iso(now),
    activity: [...incident.activity, event("note", note.trim(), ADMIN_ACTOR, now)],
  });
}

export function deleteIncident(state: AppState, id: string, now: Date): AppState {
  const incident = findIncident(state, id);
  const { teams } = release(state, incident, "incident_deleted", ADMIN_ACTOR, now);
  return { teams, incidents: state.incidents.filter((i) => i.id !== id) };
}

// ---------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------

export interface AssignOptions {
  method: "recommended" | "manual";
  route?: RouteInfo;
  /** Manual mutual-aid override when the team's category is not a standard match. */
  overrideCategory?: boolean;
}

/**
 * Assigns a team. Fails without side effects if the team is busy, already on
 * this incident, unsuitable (unless overridden), or the incident is resolved.
 * Reassignment releases the previous team in the same step.
 */
export function assignTeam(
  state: AppState,
  incidentId: string,
  teamId: string,
  options: AssignOptions,
  now: Date,
  actor: Activity["actor"] = ADMIN_ACTOR,
): AppState {
  const incident = findIncident(state, incidentId);
  const team = findTeam(state, teamId);

  if (incident.status === "Resolved")
    throw new WorkflowError("This incident is resolved. Reopen it before assigning a team.");
  if (incident.assignedTeamId === team.id)
    throw new WorkflowError(`${team.name} is already assigned to this incident.`);
  if (team.assignedIncidentId || team.availability === "Busy")
    throw new WorkflowError(
      team.assignedIncidentId
        ? `${team.name} is busy on another incident and cannot be assigned.`
        : `${team.name} is marked busy and cannot be assigned.`,
    );
  if (!isSuitable(team, incident.category) && !options.overrideCategory)
    throw new WorkflowError(
      `${team.name} (${team.category}) is not a standard responder for ${incident.category}. Confirm the override to assign it anyway.`,
    );

  let working: AppState = state;
  let current = incident;
  if (incident.assignedTeamId) {
    const released = release(state, incident, "reassigned", actor, now);
    current = released.incident;
    working = { ...state, teams: released.teams };
  }

  const at = iso(now);
  const straightLineKm = incident.coordinates
    ? haversineKm(incident.coordinates, { latitude: team.latitude, longitude: team.longitude })
    : undefined;
  const assignment: Assignment = {
    id: uid(),
    teamId: team.id,
    teamName: team.name,
    teamCategory: team.category,
    method: options.method,
    assignedAt: at,
    ...(straightLineKm !== undefined && { straightLineKm }),
    ...(options.route && { route: options.route }),
  };
  const distance = options.route
    ? options.route.source === "osrm"
      ? ` Road distance ${formatKm(options.route.distanceKm)}${options.route.durationMin !== undefined ? `, about ${formatMinutes(options.route.durationMin)} drive` : ""}.`
      : ` Straight-line distance ${formatKm(options.route.distanceKm)} (road route unavailable).`
    : straightLineKm !== undefined
      ? ` Straight-line distance ${formatKm(straightLineKm)}.`
      : "";

  let next: Incident = {
    ...current,
    assignedTeamId: team.id,
    assignments: [...current.assignments, assignment],
    activity: [
      ...current.activity,
      event(
        "assigned",
        `${team.name} (${team.category}) assigned${options.method === "recommended" ? " from the nearest-team recommendation" : " manually"}.${distance}`,
        actor,
        now,
      ),
    ],
    updatedAt: at,
  };
  // A fresh assignment always restarts at Assigned; the team moves it to In Progress.
  next = next.status === "Assigned" ? { ...next, assignedAt: at } : setStatus(next, "Assigned", actor, now);
  next = withPriority(next, now);

  const teams = replaceTeam(working.teams, {
    ...findTeam(working, team.id),
    availability: "Busy",
    assignedIncidentId: incident.id,
    updatedAt: at,
  });
  return { teams, incidents: replaceIncident(working, next).incidents };
}

/** Removes the current team without resolving; the incident goes back to Pending. */
export function unassignTeam(state: AppState, incidentId: string, now: Date): AppState {
  const incident = findIncident(state, incidentId);
  if (!incident.assignedTeamId) throw new WorkflowError("No team is assigned to this incident.");
  return changeStatus(state, incidentId, "Pending", now);
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

const PHONE = /^\+?[\d\s()-]{6,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateTeam(input: TeamInput, others: ResponseTeam[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = input.name?.trim() ?? "";
  if (name.length < 2 || name.length > 80) errors.name = "Enter a team name of 2–80 characters.";
  else if (others.some((t) => t.name.trim().toLowerCase() === name.toLowerCase()))
    errors.name = "Another team already uses this name.";
  if (!TEAM_CATEGORIES.includes(input.category)) errors.category = "Choose a response category.";
  if (!isValidLatitude(input.latitude)) errors.latitude = "Latitude must be between -90 and 90.";
  if (!isValidLongitude(input.longitude))
    errors.longitude = "Longitude must be between -180 and 180.";
  if (!input.contactName?.trim()) errors.contactName = "Enter a contact person.";
  if (!PHONE.test(input.contactPhone?.trim() ?? ""))
    errors.contactPhone = "Enter a phone number (digits, spaces, +, - or brackets).";
  if (input.contactEmail?.trim() && !EMAIL.test(input.contactEmail.trim()))
    errors.contactEmail = "Enter a valid email address or leave it empty.";
  return errors;
}

function assertValid(input: TeamInput, others: ResponseTeam[]) {
  const errors = validateTeam(input, others);
  const first = Object.values(errors)[0];
  if (first) throw new WorkflowError(first);
}

function nextTeamId(teams: ResponseTeam[]) {
  const max = teams.reduce((m, t) => Math.max(m, Number(/^TEAM-(\d+)$/.exec(t.id)?.[1] ?? 0)), 0);
  return `TEAM-${String(max + 1).padStart(3, "0")}`;
}

const cleanTeam = (input: TeamInput) => ({
  name: input.name.trim(),
  category: input.category,
  latitude: Number(input.latitude),
  longitude: Number(input.longitude),
  contactName: input.contactName.trim(),
  contactPhone: input.contactPhone.trim(),
  ...(input.contactEmail?.trim() ? { contactEmail: input.contactEmail.trim() } : { contactEmail: undefined }),
});

export function addTeam(state: AppState, input: TeamInput, now: Date) {
  assertValid(input, state.teams);
  const team: ResponseTeam = {
    id: nextTeamId(state.teams),
    ...cleanTeam(input),
    availability: "Available",
    createdAt: iso(now),
    updatedAt: iso(now),
  };
  return { state: { ...state, teams: [...state.teams, team] }, team };
}

export function updateTeam(state: AppState, id: string, input: TeamInput, now: Date): AppState {
  const team = findTeam(state, id);
  assertValid(
    input,
    state.teams.filter((t) => t.id !== id),
  );
  if (team.assignedIncidentId && input.category !== team.category) {
    const incident = state.incidents.find((i) => i.id === team.assignedIncidentId);
    if (incident && !isSuitable({ category: input.category }, incident.category))
      throw new WorkflowError(
        `This team is responding to a ${incident.category} incident. Release it before changing to ${input.category}.`,
      );
  }
  return { ...state, teams: replaceTeam(state.teams, { ...team, ...cleanTeam(input), updatedAt: iso(now) }) };
}

export function setTeamAvailability(
  state: AppState,
  id: string,
  availability: Availability,
  now: Date,
): AppState {
  if (!AVAILABILITIES.includes(availability)) throw new WorkflowError("Unknown availability.");
  const team = findTeam(state, id);
  if (team.availability === availability) return state;
  if (availability === "Available" && team.assignedIncidentId)
    throw new WorkflowError(
      `${team.name} is responding to an incident. Resolve or unassign that incident to make the team available.`,
    );
  return {
    ...state,
    teams: replaceTeam(state.teams, { ...team, availability, updatedAt: iso(now) }),
  };
}

export function deleteTeam(state: AppState, id: string): AppState {
  const team = findTeam(state, id);
  if (team.assignedIncidentId)
    throw new WorkflowError(
      `${team.name} is assigned to an active incident. Resolve or unassign it before deleting the team.`,
    );
  return { ...state, teams: state.teams.filter((t) => t.id !== id) };
}

// ---------------------------------------------------------------------------
// Invariants (used by tests and as a safety net when loading saved data)
// ---------------------------------------------------------------------------

export function findInconsistencies(state: AppState): string[] {
  const problems: string[] = [];
  const seen = new Map<string, string>();
  for (const incident of state.incidents) {
    if (!incident.assignedTeamId) {
      if (incident.status === "Assigned" || incident.status === "In Progress")
        problems.push(`${incident.reference} is ${incident.status} without a team`);
      continue;
    }
    const team = state.teams.find((t) => t.id === incident.assignedTeamId);
    if (!team) problems.push(`${incident.reference} points to missing team ${incident.assignedTeamId}`);
    else if (team.assignedIncidentId !== incident.id)
      problems.push(`${team.id} does not point back to ${incident.reference}`);
    if (seen.has(incident.assignedTeamId))
      problems.push(`${incident.assignedTeamId} assigned to two incidents`);
    seen.set(incident.assignedTeamId, incident.id);
    if (incident.status === "Resolved") problems.push(`${incident.reference} resolved but still holds a team`);
    if (incident.assignments.filter((a) => !a.releasedAt).length !== 1)
      problems.push(`${incident.reference} should have exactly one open assignment`);
  }
  for (const team of state.teams) {
    if (team.assignedIncidentId && team.availability !== "Busy")
      problems.push(`${team.id} is assigned but not Busy`);
    if (team.assignedIncidentId && !state.incidents.some((i) => i.assignedTeamId === team.id))
      problems.push(`${team.id} points to an incident that does not hold it`);
  }
  return problems;
}

/** Repairs dangling links in saved data (e.g. after manual storage edits). */
export function repairState(state: AppState): AppState {
  const incidents = state.incidents.map((i) =>
    i.assignedTeamId && !state.teams.some((t) => t.id === i.assignedTeamId && t.assignedIncidentId === i.id)
      ? { ...i, assignedTeamId: undefined }
      : i,
  );
  const teams = state.teams.map((t) =>
    t.assignedIncidentId && !incidents.some((i) => i.assignedTeamId === t.id)
      ? { ...t, assignedIncidentId: undefined }
      : t,
  );
  return { incidents, teams };
}
