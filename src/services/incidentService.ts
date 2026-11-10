/**
 * Browser persistence for the demo (localStorage). Business rules live in
 * ../domain/workflow.ts; this module only loads, migrates and saves state.
 *
 * v1 (Round 1): { incidents }            key responsehub.incidents.v1
 * v2 (Round 2): { incidents, teams }     key responsehub.state.v2
 * v1 data is migrated forward on first load and left in place untouched.
 */
import { createSeedIncidents, seedCoordinates } from "../data/seedIncidents";
import { attachSeedOperations, createSeedTeams } from "../data/seedTeams";
import {
  findInconsistencies,
  normalizeIncident,
  repairState,
  type AppState,
} from "../domain/workflow";
import type { IncidentRecord } from "../types/incident";

export const STORAGE_KEY = "responsehub.state.v2";
const LEGACY_KEY = "responsehub.incidents.v1";
const VERSION = 2;

interface StoreV2 extends AppState {
  version: 2;
  initialized: true;
}

function save(state: AppState) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: VERSION, initialized: true, ...state } satisfies StoreV2),
  );
}

// Older saved demo incidents predate map coordinates; add the fictional ones.
function withSeedCoordinates<T extends IncidentRecord>(incident: T): T {
  const match = /^demo-(\d+)$/.exec(incident.id);
  if (!match || incident.coordinates) return incident;
  return { ...incident, coordinates: seedCoordinates(Number(match[1]) - 1) };
}

export function createDemoState(now = new Date()): AppState {
  const incidents = createSeedIncidents().map((r) => normalizeIncident(r, now));
  return attachSeedOperations(incidents, createSeedTeams(now), now);
}

function migrateV1(raw: string, now: Date): AppState | null {
  try {
    const parsed = JSON.parse(raw) as { version: number; incidents: IncidentRecord[] };
    if (parsed.version !== 1 || !Array.isArray(parsed.incidents)) return null;
    // Keep every Round 1 report; add priority/lifecycle fields and the demo teams.
    return {
      incidents: parsed.incidents.map((r) => normalizeIncident(withSeedCoordinates(r), now)),
      teams: createSeedTeams(now),
    };
  } catch {
    return null;
  }
}

/** Parses saved state, or returns null if missing/corrupt. */
export function readState(now = new Date()): AppState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoreV2;
    if (
      parsed.version !== VERSION ||
      parsed.initialized !== true ||
      !Array.isArray(parsed.incidents) ||
      !Array.isArray(parsed.teams)
    )
      return null;
    const state: AppState = {
      incidents: parsed.incidents.map((i) => normalizeIncident(withSeedCoordinates(i), now)),
      teams: parsed.teams,
    };
    return findInconsistencies(state).length ? repairState(state) : state;
  } catch {
    return null;
  }
}

export function loadState(now = new Date()): AppState {
  const current = readState(now);
  if (current) return current;
  const legacy = localStorage.getItem(LEGACY_KEY);
  const state = (legacy && migrateV1(legacy, now)) || createDemoState(now);
  try {
    save(state);
  } catch {
    /* storage unavailable: run in memory */
  }
  return state;
}

export function persistState(state: AppState): boolean {
  try {
    save(state);
    return true;
  } catch {
    return false; // storage full or unavailable
  }
}

export function resetDemoState(): AppState {
  const state = createDemoState();
  persistState(state);
  return state;
}
