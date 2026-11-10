import { Check } from "lucide-react";
import type { Incident } from "../../types/incident";
import { formatDate } from "../../utils/dateFormat";

const STAGES = [
  { key: "Reported", label: "Reported" },
  { key: "Assigned", label: "Team assigned" },
  { key: "In Progress", label: "In progress" },
  { key: "Resolved", label: "Resolved" },
] as const;

/** Pending is part of the reporting stage (reviewed, awaiting a team). */
const stageIndex = (status: Incident["status"]) =>
  status === "Pending" ? 0 : STAGES.findIndex((s) => s.key === status);

/** Reported → Assigned → In Progress → Resolved, with the time each stage was reached. */
export function LifecycleTracker({
  incident,
  compact = false,
}: {
  incident: Pick<Incident, "status" | "createdAt" | "assignedAt" | "inProgressAt" | "resolvedAt">;
  compact?: boolean;
}) {
  const current = stageIndex(incident.status);
  const times = [incident.createdAt, incident.assignedAt, incident.inProgressAt, incident.resolvedAt];
  return (
    <ol
      className={`grid gap-3 ${compact ? "grid-cols-4" : "sm:grid-cols-4"}`}
      aria-label="Incident lifecycle"
    >
      {STAGES.map((stage, index) => {
        const done = index < current || (index === current && stage.key === "Resolved");
        const active = index === current && !done;
        const reached = index <= current;
        const time = reached ? times[index] : undefined;
        return (
          <li key={stage.key} className="relative flex gap-3 sm:block">
            {index < STAGES.length - 1 && (
              <span
                aria-hidden="true"
                className={`absolute hidden h-0.5 sm:block ${index < current ? "bg-blue-600" : "bg-slate-200"}`}
                style={{ left: "2.25rem", right: "-0.5rem", top: "0.9rem" }}
              />
            )}
            <span
              className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-extrabold ${
                done
                  ? "bg-blue-600 text-white"
                  : active
                    ? "bg-white text-blue-700 ring-4 ring-blue-100 border-2 border-blue-600"
                    : "bg-slate-100 text-slate-400"
              }`}
              aria-current={active ? "step" : undefined}
            >
              {done ? <Check size={15} /> : index + 1}
            </span>
            <div className="sm:mt-2">
              <p className={`text-sm font-bold ${reached ? "text-slate-900" : "text-slate-400"}`}>
                {stage.label}
                {index === 0 && incident.status === "Pending" && (
                  <span className="ml-1 font-semibold text-amber-700">· pending review</span>
                )}
              </p>
              {!compact && (
                <p className="mt-0.5 text-xs text-slate-500">
                  {time ? formatDate(time) : reached ? "Time not recorded" : "Not yet"}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
