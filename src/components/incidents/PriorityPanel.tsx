import { calculatePriority, PRIORITY_THRESHOLDS } from "../../domain/priority";
import type { Incident } from "../../types/incident";
import { formatDate } from "../../utils/dateFormat";
import { PriorityBadge, priorityColors } from "../ui/Badge";

/** Explains exactly how the priority score was built. */
export function PriorityPanel({ incident }: { incident: Incident }) {
  const live = calculatePriority(incident);
  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Priority assessment</h2>
          <p className="mt-1 text-sm text-slate-500">
            Calculated automatically and recalculated when severity, status or waiting time
            changes.
          </p>
        </div>
        <PriorityBadge value={incident.priority} score={incident.priorityScore} />
      </div>
      <div className="mt-5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold text-slate-600">Score</span>
          <span className="text-2xl font-extrabold text-slate-950">
            {incident.priorityScore}
            <span className="text-sm font-semibold text-slate-400">/100</span>
          </span>
        </div>
        <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full"
            style={{
              width: `${incident.priorityScore}%`,
              background: priorityColors[incident.priority],
            }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Thresholds:{" "}
          {PRIORITY_THRESHOLDS.map((t) => `${t.priority} ≥ ${t.min}`).join(" · ")}. Critical
          severity is never ranked below High.
        </p>
      </div>
      <ul className="mt-5 space-y-3">
        {incident.priorityFactors.map((factor) => (
          <li key={factor.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold text-slate-800">{factor.label}</span>
              <span className="shrink-0 font-bold text-slate-700">
                +{factor.points}
                <span className="font-semibold text-slate-400"> / {factor.max}</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${(factor.points / factor.max) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">{factor.detail}</p>
          </li>
        ))}
      </ul>
      <p className="mt-5 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        {live.summary} This is a transparent rule-based weighted score, not a machine-learning
        prediction. Last recalculated {formatDate(incident.priorityUpdatedAt)}.
      </p>
    </section>
  );
}
