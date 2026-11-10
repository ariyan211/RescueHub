import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as workflow from "../domain/workflow";
import type { AppState, AssignOptions } from "../domain/workflow";
import * as service from "../services/incidentService";
import type {
  Incident,
  IncidentStatus,
  NewIncidentInput,
  Severity,
  Verification,
} from "../types/incident";
import type { Availability, ResponseTeam, TeamInput } from "../types/team";

/** Result of an action that can be refused by a workflow rule. */
export type ActionResult = { ok: true } | { ok: false; error: string };

interface IncidentContextValue {
  incidents: Incident[];
  teams: ResponseTeam[];
  submitIncident: (input: NewIncidentInput) => Incident;
  changeStatus: (id: string, status: IncidentStatus) => ActionResult;
  changeVerification: (id: string, verification: Verification) => void;
  changeSeverity: (id: string, severity: Severity, reason: string) => void;
  addAdminNote: (id: string, note: string) => void;
  deleteIncident: (id: string) => void;
  assignTeam: (incidentId: string, teamId: string, options: AssignOptions) => ActionResult;
  unassignTeam: (incidentId: string) => ActionResult;
  addTeam: (input: TeamInput) => ActionResult & { team?: ResponseTeam };
  updateTeam: (id: string, input: TeamInput) => ActionResult;
  deleteTeam: (id: string) => ActionResult;
  setTeamAvailability: (id: string, availability: Availability) => ActionResult;
  resetData: () => void;
  storageError: boolean;
}

export const IncidentContext = createContext<IncidentContextValue | null>(null);

const PRIORITY_REFRESH_MS = 60_000;

export function IncidentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => service.loadState());
  const [storageError, setStorageError] = useState(false);
  // The ref is the single source of truth for mutations, so two quick actions
  // in a row (or a stale closure) can never both assign the same team.
  const stateRef = useRef(state);

  const commit = useCallback((next: AppState) => {
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
    setStorageError(!service.persistState(next));
  }, []);

  /**
   * Runs a workflow action atomically against the newest saved state (another
   * tab may have changed it a moment ago), then saves it.
   */
  const run = useCallback(
    (action: (current: AppState, now: Date) => AppState): ActionResult => {
      const now = new Date();
      const latest = service.readState(now) ?? stateRef.current;
      try {
        commit(action(latest, now));
        return { ok: true };
      } catch (err) {
        if (latest !== stateRef.current) commit(latest);
        if (err instanceof workflow.WorkflowError) return { ok: false, error: err.message };
        throw err;
      }
    },
    [commit],
  );

  // Keep tabs in sync: a report submitted in one tab appears on the admin map in another.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== service.STORAGE_KEY) return;
      const next = service.readState();
      if (next) {
        stateRef.current = next;
        setState(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Waiting-time escalation: unattended incidents climb in priority.
  useEffect(() => {
    const refresh = () => commit(workflow.refreshPriorities(stateRef.current, new Date()));
    refresh();
    const timer = window.setInterval(refresh, PRIORITY_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [commit]);

  const value = useMemo<IncidentContextValue>(() => {
    const must = (result: ActionResult) => {
      if (!result.ok) throw new Error(result.error);
    };
    return {
      incidents: state.incidents,
      teams: state.teams,
      storageError,
      submitIncident(input) {
        let created: Incident | undefined;
        must(
          run((s, now) => {
            const result = workflow.createIncident(s, input, now);
            created = result.incident;
            return result.state;
          }),
        );
        return created!;
      },
      changeStatus: (id, status) => run((s, now) => workflow.changeStatus(s, id, status, now)),
      changeVerification: (id, verification) =>
        must(run((s, now) => workflow.changeVerification(s, id, verification, now))),
      changeSeverity: (id, severity, reason) =>
        must(run((s, now) => workflow.changeSeverity(s, id, severity, reason, now))),
      addAdminNote: (id, note) => must(run((s, now) => workflow.addNote(s, id, note, now))),
      deleteIncident: (id) => must(run((s, now) => workflow.deleteIncident(s, id, now))),
      assignTeam: (incidentId, teamId, options) =>
        run((s, now) => workflow.assignTeam(s, incidentId, teamId, options, now)),
      unassignTeam: (incidentId) => run((s, now) => workflow.unassignTeam(s, incidentId, now)),
      addTeam(input) {
        let team: ResponseTeam | undefined;
        const result = run((s, now) => {
          const r = workflow.addTeam(s, input, now);
          team = r.team;
          return r.state;
        });
        return result.ok ? { ok: true, team } : result;
      },
      updateTeam: (id, input) => run((s, now) => workflow.updateTeam(s, id, input, now)),
      deleteTeam: (id) => run((s) => workflow.deleteTeam(s, id)),
      setTeamAvailability: (id, availability) =>
        run((s, now) => workflow.setTeamAvailability(s, id, availability, now)),
      resetData: () => commit(service.resetDemoState()),
    };
  }, [state, storageError, run, commit]);

  return <IncidentContext.Provider value={value}>{children}</IncidentContext.Provider>;
}
