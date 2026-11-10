import type { Category, Incident } from "../types/incident";
import type { ResponseTeam, TeamCategory } from "../types/team";
import { haversineKm } from "./geo";

/**
 * Which response team categories can handle each emergency category,
 * in order of preference (first = primary responder).
 */
export const SUITABLE_TEAMS: Record<Category, TeamCategory[]> = {
  Fire: ["Fire"],
  "Medical Emergency": ["Medical"],
  "Road Accident": ["Medical", "Rescue", "Police"],
  Flood: ["Disaster Relief", "Rescue"],
  "Building Collapse": ["Rescue", "Disaster Relief", "Fire"],
  "Other Emergency": ["Police", "Rescue", "Disaster Relief"],
};

export const isSuitable = (team: Pick<ResponseTeam, "category">, category: Category) =>
  SUITABLE_TEAMS[category].includes(team.category);

export interface TeamCandidate {
  team: ResponseTeam;
  suitable: boolean;
  available: boolean;
  /** Straight-line (Haversine) distance; undefined when the incident has no coordinates. */
  straightLineKm?: number;
  /** Why the team cannot be assigned, if it can't. */
  blockedReason?: string;
}

/** 0 = assignable, 1 = available but not a standard match, 2 = busy / already on this incident. */
const group = (c: TeamCandidate) => (!c.blockedReason ? 0 : c.available && !c.team.assignedIncidentId ? 1 : 2);

/**
 * Every team annotated with suitability, availability and straight-line distance,
 * sorted: assignable teams first, then available non-standard teams, then busy
 * teams — nearest first within each group.
 */
export function rankTeams(
  incident: Pick<Incident, "id" | "category" | "coordinates">,
  teams: ResponseTeam[],
): TeamCandidate[] {
  return teams
    .map((team): TeamCandidate => {
      const suitable = isSuitable(team, incident.category);
      const available = team.availability === "Available" && !team.assignedIncidentId;
      const straightLineKm = incident.coordinates
        ? haversineKm(incident.coordinates, { latitude: team.latitude, longitude: team.longitude })
        : undefined;
      let blockedReason: string | undefined;
      if (team.assignedIncidentId === incident.id) blockedReason = "Already assigned to this incident";
      else if (!available)
        blockedReason = team.assignedIncidentId ? "Busy on another incident" : "Marked busy";
      else if (!suitable) blockedReason = `${team.category} teams do not handle ${incident.category}`;
      return { team, suitable, available, straightLineKm, blockedReason };
    })
    .sort(
      (a, b) =>
        group(a) - group(b) ||
        (a.straightLineKm ?? Infinity) - (b.straightLineKm ?? Infinity) ||
        a.team.name.localeCompare(b.team.name),
    );
}

/** Assignable (suitable + available) candidates only, nearest straight-line first. */
export function eligibleCandidates(
  incident: Pick<Incident, "id" | "category" | "coordinates">,
  teams: ResponseTeam[],
) {
  return rankTeams(incident, teams).filter((c) => !c.blockedReason);
}
