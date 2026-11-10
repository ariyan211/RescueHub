import { Ambulance, Flame, LifeBuoy, Siren, Tent, type LucideIcon } from "lucide-react";
import type { TeamCategory } from "../../types/team";

export const teamIcons: Record<TeamCategory, LucideIcon> = {
  Fire: Flame,
  Medical: Ambulance,
  Rescue: LifeBuoy,
  Police: Siren,
  "Disaster Relief": Tent,
};

/** Dark tones so team squares stand apart from the priority-coloured incident dots. */
export const teamColors: Record<TeamCategory, string> = {
  Fire: "#9f1239",
  Medical: "#0f766e",
  Rescue: "#6d28d9",
  Police: "#1e3a8a",
  "Disaster Relief": "#854d0e",
};
