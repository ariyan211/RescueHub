import { createSeedIncidents, seedCoordinates } from "../data/seedIncidents";
import type {
  Activity,
  Incident,
  IncidentStatus,
  NewIncidentInput,
  Severity,
  Verification,
} from "../types/incident";
import { suggestSeverity } from "../utils/severity";

const STORAGE_KEY = "responsehub.incidents.v1";
const VERSION = 1;

interface Store {
  version: number;
  initialized: true;
  incidents: Incident[];
}

function saveStore(incidents: Incident[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: VERSION, initialized: true, incidents } satisfies Store),
  );
}

// Older saved demo incidents predate map coordinates; add the fictional ones.
function withSeedCoordinates(incident: Incident): Incident {
  const match = /^demo-(\d+)$/.exec(incident.id);
  if (!match || incident.coordinates) return incident;
  return { ...incident, coordinates: seedCoordinates(Number(match[1]) - 1) };
}

export function loadIncidents(): Incident[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = createSeedIncidents();
    saveStore(seeded);
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw) as Store;
    if (
      parsed.version !== VERSION ||
      parsed.initialized !== true ||
      !Array.isArray(parsed.incidents)
    )
      throw new Error("Invalid store");
    return parsed.incidents.map(withSeedCoordinates);
  } catch {
    const seeded = createSeedIncidents();
    saveStore(seeded);
    return seeded;
  }
}

export function persistIncidents(incidents: Incident[]): boolean {
  try {
    saveStore(incidents);
    return true;
  } catch {
    return false; // storage full or unavailable
  }
}

function uid() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createIncident(input: NewIncidentInput): Incident {
  const now = new Date().toISOString();
  const suggestion = suggestSeverity(input);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return {
    ...input,
    id: uid(),
    reference: `RH-${new Date().getFullYear()}-${suffix}`,
    suggestedSeverity: suggestion.severity,
    currentSeverity: suggestion.severity,
    severityReason: suggestion.reason,
    requiresReview: true,
    status: "Reported",
    verification: "Unverified",
    createdAt: now,
    updatedAt: now,
    activity: [
      {
        id: uid(),
        type: "submitted",
        message: "Report submitted.",
        actor: "Reporter",
        timestamp: now,
      },
      {
        id: uid(),
        type: "severity_suggested",
        message: `${suggestion.severity} severity suggested. ${suggestion.reason}`,
        actor: "System",
        timestamp: now,
      },
    ],
  };
}

export function activity(type: Activity["type"], message: string): Activity {
  return {
    id: uid(),
    type,
    message,
    actor: "Demo administrator",
    timestamp: new Date().toISOString(),
  };
}

export function updateStatus(incident: Incident, status: IncidentStatus): Incident {
  const event = activity("status_changed", `Status changed from ${incident.status} to ${status}.`);
  return {
    ...incident,
    status,
    updatedAt: event.timestamp,
    activity: [...incident.activity, event],
  };
}

export function updateVerification(incident: Incident, verification: Verification): Incident {
  const event = activity(
    "verification_changed",
    `Verification changed from ${incident.verification} to ${verification}.`,
  );
  return {
    ...incident,
    verification,
    updatedAt: event.timestamp,
    activity: [...incident.activity, event],
  };
}

export function updateSeverity(incident: Incident, severity: Severity, reason: string): Incident {
  const event = activity(
    "severity_changed",
    `Severity changed from ${incident.currentSeverity} to ${severity}. Reason: ${reason}`,
  );
  return {
    ...incident,
    currentSeverity: severity,
    updatedAt: event.timestamp,
    activity: [...incident.activity, event],
  };
}

export function addNote(incident: Incident, note: string): Incident {
  const event = activity("note", note);
  return { ...incident, updatedAt: event.timestamp, activity: [...incident.activity, event] };
}

export function resetDemoData() {
  const seeded = createSeedIncidents();
  saveStore(seeded);
  return seeded;
}
