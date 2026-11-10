/**
 * Intelligent incident prioritization — server copy of src/domain/priority.ts.
 * Transparent rule-based weighted score (NOT machine learning):
 *
 *   Severity 40 · People affected 25 · Category 20 · Time since report 15
 *   ≥ 75 Critical · ≥ 55 High · ≥ 35 Medium · else Low
 *   Critical severity is never ranked below High.
 *
 * test/priority.test.ts asserts this file and the frontend copy agree.
 */
import type { CategoryLabel, PriorityLabel, SeverityLabel, StatusLabel } from "./enums.js";

export const PRIORITY_MODEL_VERSION = "weighted-v1";

export const SEVERITY_POINTS: Record<SeverityLabel, number> = { Critical: 40, High: 30, Medium: 18, Low: 8 };

export const CATEGORY_POINTS: Record<CategoryLabel, number> = {
  "Building Collapse": 20,
  Fire: 18,
  "Medical Emergency": 16,
  Flood: 14,
  "Road Accident": 12,
  "Other Emergency": 6,
};

export const PRIORITY_THRESHOLDS: { priority: PriorityLabel; min: number }[] = [
  { priority: "Critical", min: 75 },
  { priority: "High", min: 55 },
  { priority: "Medium", min: 35 },
  { priority: "Low", min: 0 },
];

export const priorityRank: Record<PriorityLabel, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

export interface PriorityFactor {
  key: "severity" | "people" | "waiting" | "category";
  label: string;
  points: number;
  max: number;
  detail: string;
}

export function peoplePoints(people: number): { points: number; band: string } {
  if (people <= 0) return { points: 0, band: "nobody reported affected" };
  if (people === 1) return { points: 8, band: "1 person" };
  if (people <= 5) return { points: 14, band: "2–5 people" };
  if (people <= 20) return { points: 20, band: "6–20 people" };
  return { points: 25, band: "more than 20 people" };
}

export function waitingPoints(minutes: number): { points: number; band: string } {
  if (minutes < 30) return { points: 5, band: "under 30 minutes" };
  if (minutes < 120) return { points: 8, band: "30 minutes – 2 hours" };
  if (minutes < 360) return { points: 11, band: "2–6 hours" };
  if (minutes < 1440) return { points: 13, band: "6–24 hours" };
  return { points: 15, band: "over 24 hours" };
}

export interface PriorityInput {
  currentSeverity: SeverityLabel;
  peopleAffected: number;
  category: CategoryLabel;
  createdAt: string;
  status: StatusLabel;
  resolvedAt?: string;
}

export interface PriorityResult {
  priority: PriorityLabel;
  score: number;
  factors: PriorityFactor[];
  summary: string;
}

function formatWait(minutes: number) {
  if (minutes < 60) return `${Math.max(0, Math.round(minutes))} min`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours.toFixed(hours < 10 ? 1 : 0)} h`;
  return `${Math.round(hours / 24)} days`;
}

export function calculatePriority(input: PriorityInput, now: Date = new Date()): PriorityResult {
  const severity = SEVERITY_POINTS[input.currentSeverity];
  const people = peoplePoints(Math.max(0, Math.floor(input.peopleAffected || 0)));
  const category = CATEGORY_POINTS[input.category] ?? CATEGORY_POINTS["Other Emergency"];
  const end =
    input.status === "Resolved" && input.resolvedAt ? Date.parse(input.resolvedAt) : now.getTime();
  const minutes = Math.max(0, (end - Date.parse(input.createdAt)) / 60_000);
  const waiting = waitingPoints(minutes);

  const factors: PriorityFactor[] = [
    { key: "severity", label: "Severity", points: severity, max: 40, detail: `${input.currentSeverity} severity` },
    {
      key: "people",
      label: "People affected",
      points: people.points,
      max: 25,
      detail: `${input.peopleAffected} reported (${people.band})`,
    },
    { key: "category", label: "Emergency category", points: category, max: 20, detail: `${input.category} risk weighting` },
    {
      key: "waiting",
      label: "Time since report",
      points: waiting.points,
      max: 15,
      detail:
        input.status === "Resolved"
          ? `Resolved after ${formatWait(minutes)}`
          : `Waiting ${formatWait(minutes)} (${waiting.band})`,
    },
  ];

  const score = factors.reduce((sum, f) => sum + f.points, 0);
  let priority = PRIORITY_THRESHOLDS.find((t) => score >= t.min)!.priority;
  let guard = "";
  if (input.currentSeverity === "Critical" && priorityRank[priority] < priorityRank.High) {
    priority = "High";
    guard = " Raised to High because severity is Critical.";
  }
  const top = [...factors].sort((a, b) => b.points / b.max - a.points / a.max)[0]!;
  const summary = `${priority} priority (score ${score}/100). Largest factor: ${top.label.toLowerCase()} — ${top.detail}.${guard}`;
  return { priority, score, factors, summary };
}
