import type { SafetyAnswer, Severity } from "@prisma/client";

/**
 * Server-side port of src/utils/severity.ts. The server is authoritative: the
 * client's own suggestion is never trusted, it is recomputed here.
 */
export function suggestSeverity(input: {
  immediateThreat: SafetyAnswer;
  peopleTrapped: SafetyAnswer;
  ongoingHazard: SafetyAnswer;
}): { severity: Severity; reason: string } {
  if (input.peopleTrapped === "YES")
    return {
      severity: "CRITICAL",
      reason: "Critical suggested because the reporter indicated that someone is trapped.",
    };
  if (input.immediateThreat === "YES")
    return {
      severity: "CRITICAL",
      reason: "Critical suggested because the reporter indicated an immediate threat to life.",
    };
  if (input.ongoingHazard === "YES")
    return {
      severity: "HIGH",
      reason: "High suggested because the reporter indicated the hazard is ongoing or spreading.",
    };
  if (Object.values(input).includes("UNKNOWN"))
    return {
      severity: "MEDIUM",
      reason: "Medium suggested because one or more safety conditions are unknown and need review.",
    };
  return {
    severity: "LOW",
    reason:
      "Low suggested because no immediate, trapped-person, or ongoing hazard indicators were reported. Review is still required.",
  };
}
