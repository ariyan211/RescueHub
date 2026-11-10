import type { Coordinates } from "./incident";

export const TEAM_CATEGORIES = ["Fire", "Medical", "Rescue", "Police", "Disaster Relief"] as const;
export const AVAILABILITIES = ["Available", "Busy"] as const;

export type TeamCategory = (typeof TEAM_CATEGORIES)[number];
export type Availability = (typeof AVAILABILITIES)[number];

export interface ResponseTeam {
  /** Human-readable ID, e.g. TEAM-004. */
  id: string;
  name: string;
  category: TeamCategory;
  latitude: number;
  longitude: number;
  availability: Availability;
  /** Incident the team is currently responding to. Set only by assignment. */
  assignedIncidentId?: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export type TeamInput = Pick<
  ResponseTeam,
  "name" | "category" | "latitude" | "longitude" | "contactName" | "contactPhone"
> & { contactEmail?: string };

export const teamPosition = (team: Pick<ResponseTeam, "latitude" | "longitude">): Coordinates => ({
  latitude: team.latitude,
  longitude: team.longitude,
});
