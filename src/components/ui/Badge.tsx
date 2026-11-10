import type { IncidentStatus, Severity, Verification } from "../../types/incident";

const tones: Record<string, string> = {
  Low: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Medium: "bg-amber-50 text-amber-800 ring-amber-200",
  High: "bg-orange-50 text-orange-800 ring-orange-200",
  Critical: "bg-red-50 text-red-700 ring-red-200",
  Reported: "bg-slate-100 text-slate-700 ring-slate-200",
  Pending: "bg-amber-50 text-amber-800 ring-amber-200",
  "In Progress": "bg-blue-50 text-blue-700 ring-blue-200",
  Resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Unverified: "bg-slate-100 text-slate-700 ring-slate-200",
  "Under Review": "bg-violet-50 text-violet-700 ring-violet-200",
  Verified: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export function Badge({ value }: { value: Severity | IncidentStatus | Verification }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${tones[value]}`}
    >
      {value}
    </span>
  );
}
