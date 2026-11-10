import type { IncidentCategory, TeamCategory } from "@prisma/client";

/** Same matrix as src/domain/teams.ts (first = primary responder). */
export const SUITABLE_TEAMS: Record<IncidentCategory, TeamCategory[]> = {
  FIRE: ["FIRE"],
  MEDICAL_EMERGENCY: ["MEDICAL"],
  ROAD_ACCIDENT: ["MEDICAL", "RESCUE", "POLICE"],
  FLOOD: ["DISASTER_RELIEF", "RESCUE"],
  BUILDING_COLLAPSE: ["RESCUE", "DISASTER_RELIEF", "FIRE"],
  OTHER: ["POLICE", "RESCUE", "DISASTER_RELIEF"],
};

export const isSuitable = (team: TeamCategory, incident: IncidentCategory) =>
  SUITABLE_TEAMS[incident].includes(team);

const EARTH_RADIUS_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle straight-line distance (km). Not road distance. */
export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
