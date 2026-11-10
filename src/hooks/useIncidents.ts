import { useContext } from "react";
import { IncidentContext } from "../context/IncidentContext";

export function useIncidents() {
  const value = useContext(IncidentContext);
  if (!value) throw new Error("useIncidents must be used within IncidentProvider");
  return value;
}
