import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  Incident,
  IncidentStatus,
  NewIncidentInput,
  Severity,
  Verification,
} from "../types/incident";
import * as service from "../services/incidentService";

interface IncidentContextValue {
  incidents: Incident[];
  submitIncident: (input: NewIncidentInput) => Incident;
  changeStatus: (id: string, status: IncidentStatus) => void;
  changeVerification: (id: string, verification: Verification) => void;
  changeSeverity: (id: string, severity: Severity, reason: string) => void;
  addAdminNote: (id: string, note: string) => void;
  deleteIncident: (id: string) => void;
  resetData: () => void;
  storageError: boolean;
}

export const IncidentContext = createContext<IncidentContextValue | null>(null);

export function IncidentProvider({ children }: { children: ReactNode }) {
  const [incidents, setIncidents] = useState<Incident[]>(() => service.loadIncidents());
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    setStorageError(!service.persistIncidents(incidents));
  }, [incidents]);

  const replace = useCallback((id: string, updater: (item: Incident) => Incident) => {
    setIncidents((items) => items.map((item) => (item.id === id ? updater(item) : item)));
  }, []);

  const value = useMemo<IncidentContextValue>(
    () => ({
      incidents,
      storageError,
      submitIncident(input) {
        const incident = service.createIncident(input);
        setIncidents((items) => [incident, ...items]);
        return incident;
      },
      changeStatus: (id, status) => replace(id, (item) => service.updateStatus(item, status)),
      changeVerification: (id, verification) =>
        replace(id, (item) => service.updateVerification(item, verification)),
      changeSeverity: (id, severity, reason) =>
        replace(id, (item) => service.updateSeverity(item, severity, reason)),
      addAdminNote: (id, note) => replace(id, (item) => service.addNote(item, note)),
      deleteIncident: (id) => setIncidents((items) => items.filter((item) => item.id !== id)),
      resetData: () => setIncidents(service.resetDemoData()),
    }),
    [incidents, storageError, replace],
  );

  return <IncidentContext.Provider value={value}>{children}</IncidentContext.Provider>;
}
