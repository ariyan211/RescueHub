import { Clock3, Info, Search, ShieldAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { LifecycleTracker } from "../components/incidents/LifecycleTracker";
import { Badge } from "../components/ui/Badge";
import { useIncidents } from "../hooks/useIncidents";
import { formatDate } from "../utils/dateFormat";

export default function TrackPage() {
  const { incidents } = useIncidents();
  const [params] = useSearchParams();
  const initial = params.get("reference") ?? "";
  const [query, setQuery] = useState(initial);
  const [searched, setSearched] = useState(initial.trim());
  const incident = searched
    ? incidents.find((item) => item.reference.toLowerCase() === searched.toLowerCase())
    : undefined;
  function search(event: FormEvent) {
    event.preventDefault();
    setSearched(query.trim());
  }
  return (
    <main className="page-container py-14">
      <div className="mx-auto max-w-2xl">
        <div className="section-heading text-center">
          <span className="eyebrow">Browser demo tracking</span>
          <h1>Track a report</h1>
          <p>Enter the incident reference exactly as shown in your confirmation.</p>
        </div>
        <form onSubmit={search} className="card mt-8">
          <label className="label" htmlFor="reference">
            Incident reference
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-3.5 text-slate-400" />
              <input
                id="reference"
                className="input !pl-10 uppercase"
                placeholder="RH-2025-ABCD"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button className="button-primary justify-center" type="submit">
              Track report
            </button>
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-500">
            <Info size={14} className="mt-0.5 shrink-0" />
            Tracking works only for reports saved in this browser demo. Data is not shared between
            devices.
          </p>
        </form>
        {!searched && (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-9 text-center">
            <Clock3 className="mx-auto text-slate-300" size={32} />
            <h2 className="mt-4 font-bold text-slate-700">No reference searched yet</h2>
            <p className="mt-2 text-sm text-slate-500">
              Your report confirmation includes a reference number.
            </p>
          </div>
        )}
        {searched && !incident && (
          <div
            role="status"
            className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"
          >
            <ShieldAlert className="mx-auto text-amber-600" size={30} />
            <h2 className="mt-3 font-bold text-amber-950">Report not found</h2>
            <p className="mt-2 text-sm text-amber-800">
              Check the reference and remember that only reports saved in this browser are
              available.
            </p>
          </div>
        )}
        {incident && (
          <section className="card mt-6">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Incident reference
                </p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-wide">{incident.reference}</h2>
              </div>
              <Badge value={incident.status} />
            </div>
            <dl className="detail-grid mt-6">
              <div>
                <dt>Category</dt>
                <dd>{incident.category}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{incident.status}</dd>
              </div>
              <div>
                <dt>Submission time</dt>
                <dd>{formatDate(incident.createdAt)}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{formatDate(incident.updatedAt)}</dd>
              </div>
            </dl>
            <div className="mt-6 border-t border-slate-100 pt-6">
              <h3 className="mb-4 text-sm font-bold text-slate-800">Progress</h3>
              <LifecycleTracker incident={incident} />
              {incident.assignedTeamId && (
                <p className="mt-4 rounded-xl bg-indigo-50 p-3 text-sm font-semibold text-indigo-900">
                  A response team has been assigned to this report.
                </p>
              )}
            </div>
          </section>
        )}
        <p className="mt-6 text-center text-xs leading-5 text-slate-500">
          Reference lookup is for prototype convenience and is not secure production authentication.
          Tracking never displays contact details, precise location, descriptions, or administrator
          notes.
        </p>
      </div>
    </main>
  );
}
