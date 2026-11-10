import type { SafetyAnswer, Severity } from "../types/incident";

export interface SeverityInput {
  immediateThreat: SafetyAnswer;
  peopleTrapped: SafetyAnswer;
  ongoingHazard: SafetyAnswer;
}

export interface SeveritySuggestion {
  severity: Severity;
  reason: string;
  requiresReview: true;
}

export function suggestSeverity(input: SeverityInput): SeveritySuggestion {
  if (input.peopleTrapped === "Yes") {
    return {
      severity: "Critical",
      reason: "Critical suggested because the reporter indicated that someone is trapped.",
      requiresReview: true,
    };
  }
  if (input.immediateThreat === "Yes") {
    return {
      severity: "Critical",
      reason: "Critical suggested because the reporter indicated an immediate threat to life.",
      requiresReview: true,
    };
  }
  if (input.ongoingHazard === "Yes") {
    return {
      severity: "High",
      reason: "High suggested because the reporter indicated the hazard is ongoing or spreading.",
      requiresReview: true,
    };
  }
  if (Object.values(input).includes("Unknown")) {
    return {
      severity: "Medium",
      reason: "Medium suggested because one or more safety conditions are unknown and need review.",
      requiresReview: true,
    };
  }
  return {
    severity: "Low",
    reason:
      "Low suggested because no immediate, trapped-person, or ongoing hazard indicators were reported. Review is still required.",
    requiresReview: true,
  };
}

export const severityRank: Record<Severity, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
