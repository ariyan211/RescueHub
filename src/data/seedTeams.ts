import { haversineKm } from "../domain/geo";
import { withPriority } from "../domain/workflow";
import type { Activity, Assignment, Incident, IncidentStatus } from "../types/incident";
import type { ResponseTeam, TeamCategory } from "../types/team";

/** Fictional response teams placed around the fictional demo incident grid. */
export const teamRecords: {
  name: string;
  category: TeamCategory;
  latitude: number;
  longitude: number;
  contactName: string;
  contactPhone: string;
}[] = [
  { name: "Northpoint Fire Engine 1", category: "Fire", latitude: 40.7128, longitude: -74.0059, contactName: "Station Officer Rivera", contactPhone: "+1 555 0101" },
  { name: "Harbor Fire Engine 7", category: "Fire", latitude: 40.7352, longitude: -73.9754, contactName: "Station Officer Chen", contactPhone: "+1 555 0107" },
  { name: "Riverside Ambulance A", category: "Medical", latitude: 40.7224, longitude: -73.9897, contactName: "Paramedic Okafor", contactPhone: "+1 555 0201" },
  { name: "Lakeside Ambulance B", category: "Medical", latitude: 40.7441, longitude: -74.0062, contactName: "Paramedic Silva", contactPhone: "+1 555 0202" },
  { name: "Urban Search & Rescue 2", category: "Rescue", latitude: 40.7061, longitude: -73.9969, contactName: "Rescue Lead Haddad", contactPhone: "+1 555 0302" },
  { name: "Swift Water Rescue", category: "Rescue", latitude: 40.7398, longitude: -73.9632, contactName: "Rescue Lead Novak", contactPhone: "+1 555 0303" },
  { name: "Central Police Patrol 4", category: "Police", latitude: 40.7183, longitude: -74.0121, contactName: "Sergeant Mensah", contactPhone: "+1 555 0404" },
  { name: "Disaster Relief Depot East", category: "Disaster Relief", latitude: 40.7301, longitude: -73.9862, contactName: "Coordinator Patel", contactPhone: "+1 555 0501" },
];

export function createSeedTeams(now = new Date()): ResponseTeam[] {
  const at = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  return teamRecords.map((t, i) => ({
    id: `TEAM-${String(i + 1).padStart(3, "0")}`,
    ...t,
    contactEmail: `team${i + 1}@responsehub.example`,
    availability: "Available",
    createdAt: at,
    updatedAt: at,
  }));
}

/**
 * Seed incident index → seed team ID. Active ones keep the team busy; resolved
 * ones become history (team released) so analytics have real assignment data.
 */
export const seedAssignments: { incident: number; team: string; active: boolean }[] = [
  { incident: 0, team: "TEAM-001", active: true }, // Fire, In Progress
  { incident: 3, team: "TEAM-006", active: true }, // Flood, In Progress
  { incident: 7, team: "TEAM-003", active: true }, // Road accident, In Progress
  { incident: 11, team: "TEAM-007", active: true }, // Other emergency, In Progress
  { incident: 2, team: "TEAM-004", active: false }, // Medical, Resolved
  { incident: 6, team: "TEAM-002", active: false }, // Fire, Resolved
  { incident: 8, team: "TEAM-003", active: false }, // Medical, Resolved
  { incident: 12, team: "TEAM-001", active: false }, // Fire, Resolved
];

const plus = (isoTime: string, minutes: number) =>
  new Date(Date.parse(isoTime) + minutes * 60_000).toISOString();

/** Attaches consistent assignments, lifecycle timestamps and team availability to the seed data. */
export function attachSeedOperations(
  incidents: Incident[],
  teams: ResponseTeam[],
  now = new Date(),
): { incidents: Incident[]; teams: ResponseTeam[] } {
  const nextIncidents = [...incidents];
  const nextTeams = teams.map((t) => ({ ...t }));

  for (const seed of seedAssignments) {
    const incident = nextIncidents[seed.incident];
    const team = nextTeams.find((t) => t.id === seed.team);
    if (!incident || !team || !incident.coordinates) continue;
    const created = incident.createdAt;
    const assignedAt = plus(created, seed.active ? 20 : 10);
    const inProgressAt = plus(created, seed.active ? 60 : 25); // matches the seed activity log
    const resolvedAt = seed.active ? undefined : plus(created, 60);
    const km = haversineKm(incident.coordinates, team);
    const assignment: Assignment = {
      id: `seed-assignment-${seed.incident}`,
      teamId: team.id,
      teamName: team.name,
      teamCategory: team.category,
      method: "recommended",
      assignedAt,
      straightLineKm: km,
      route: { source: "straight-line", distanceKm: km },
      ...(resolvedAt && { releasedAt: resolvedAt, releaseReason: "resolved" as const }),
    };
    const history: { status: IncidentStatus; at: string; actor: string }[] = [
      { status: "Reported", at: created, actor: "Reporter" },
      { status: "Assigned", at: assignedAt, actor: "Demo administrator" },
      { status: "In Progress", at: inProgressAt, actor: "Demo administrator" },
      ...(resolvedAt ? [{ status: "Resolved" as const, at: resolvedAt, actor: "Demo administrator" }] : []),
    ];
    const extra: Activity[] = [
      {
        id: `seed-${seed.incident}-assigned`,
        type: "assigned",
        message: `${team.name} (${team.category}) assigned from the nearest-team recommendation.`,
        actor: "Demo administrator",
        timestamp: assignedAt,
      },
      ...(resolvedAt
        ? [
            {
              id: `seed-${seed.incident}-released`,
              type: "team_released" as const,
              message: `${team.name} released and available again (incident resolved).`,
              actor: "Demo administrator",
              timestamp: resolvedAt,
            },
          ]
        : []),
    ];
    nextIncidents[seed.incident] = withPriority(
      {
        ...incident,
        assignedTeamId: seed.active ? team.id : undefined,
        assignments: [...incident.assignments, assignment],
        statusHistory: history,
        assignedAt,
        inProgressAt,
        resolvedAt,
        activity: [...incident.activity, ...extra].sort(
          (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
        ),
      },
      now,
    );
    if (seed.active) {
      team.availability = "Busy";
      team.assignedIncidentId = incident.id;
    }
  }
  return { incidents: nextIncidents, teams: nextTeams };
}
