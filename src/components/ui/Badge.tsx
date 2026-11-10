import { Flag } from "lucide-react";
import type { IncidentStatus, Priority, Severity, Verification } from "../../types/incident";
import type { Availability } from "../../types/team";

const tones: Record<string, string> = {
  Low: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Medium: "bg-amber-50 text-amber-800 ring-amber-200",
  High: "bg-orange-50 text-orange-800 ring-orange-200",
  Critical: "bg-red-50 text-red-700 ring-red-200",
  Reported: "bg-slate-100 text-slate-700 ring-slate-200",
  Pending: "bg-amber-50 text-amber-800 ring-amber-200",
  Assigned: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "In Progress": "bg-blue-50 text-blue-700 ring-blue-200",
  Resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Unverified: "bg-slate-100 text-slate-700 ring-slate-200",
  "Under Review": "bg-violet-50 text-violet-700 ring-violet-200",
  Verified: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Available: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Busy: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function Badge({
  value,
}: {
  value: Severity | IncidentStatus | Verification | Availability;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${tones[value]}`}
    >
      {value}
    </span>
  );
}

const priorityTones: Record<Priority, string> = {
  Critical: "bg-red-600 text-white ring-red-600",
  High: "bg-orange-100 text-orange-900 ring-orange-300",
  Medium: "bg-amber-50 text-amber-800 ring-amber-200",
  Low: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

/** Priority uses a flag icon and solid red for Critical so it is never confused with severity. */
export function PriorityBadge({
  value,
  score,
  title,
}: {
  value: Priority;
  score?: number;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${priorityTones[value]}`}
    >
      <Flag size={12} aria-hidden="true" />
      <span>
        {value} priority
        {score !== undefined && <span className="ml-1 font-semibold opacity-80">· {score}</span>}
      </span>
    </span>
  );
}

export const priorityColors: Record<Priority, string> = {
  Critical: "#dc2626",
  High: "#ea580c",
  Medium: "#d97706",
  Low: "#059669",
};
