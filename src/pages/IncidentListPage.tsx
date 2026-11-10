import { FilterX, MapPin, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Badge } from "../components/ui/Badge";
import { useIncidents } from "../hooks/useIncidents";
import { CATEGORIES, SEVERITIES, STATUSES, VERIFICATIONS } from "../types/incident";
import { formatDate } from "../utils/dateFormat";
import { severityRank } from "../utils/severity";

export default function IncidentListPage() {
  const { incidents } = useIncidents();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [verification, setVerification] = useState("");
  const [sort, setSort] = useState("newest");
  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    return incidents
      .filter(
        (i) =>
          (!query || `${i.reference} ${i.title} ${i.locationText}`.toLowerCase().includes(query)) &&
          (!category || i.category === category) &&
          (!severity || i.currentSeverity === severity) &&
          (!status || i.status === status) &&
          (!verification || i.verification === verification),
      )
      .sort((a, b) =>
        sort === "oldest"
          ? Date.parse(a.createdAt) - Date.parse(b.createdAt)
          : sort === "severity"
            ? severityRank[b.currentSeverity] - severityRank[a.currentSeverity] ||
              Date.parse(a.createdAt) - Date.parse(b.createdAt)
            : Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
  }, [incidents, search, category, severity, status, verification, sort]);
  const clear = () => {
    setSearch("");
    setCategory("");
    setSeverity("");
    setStatus("");
    setVerification("");
    setSort("newest");
  };
  const filters = [
    ["Category", category, setCategory, CATEGORIES],
    ["Severity", severity, setSeverity, SEVERITIES],
    ["Status", status, setStatus, STATUSES],
    ["Verification", verification, setVerification, VERIFICATIONS],
  ] as const;
  return (
    <div className="mx-auto max-w-[1500px]">
      <section className="card">
        <div className="grid gap-4 xl:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div>
            <label className="label" htmlFor="incident-search">
              Search incidents
            </label>
            <div className="relative">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-3 text-slate-400"
              />
              <input
                id="incident-search"
                className="input !pl-10"
                placeholder="Reference, title, or location"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {filters.map(([label, value, setter, options]) => (
            <div key={label}>
              <label className="label" htmlFor={`filter-${label}`}>
                {label}
              </label>
              <select
                id={`filter-${label}`}
                className="input"
                value={value}
                onChange={(e) => setter(e.target.value)}
              >
                <option value="">All</option>
                {options.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
          <p className="text-sm font-semibold text-slate-600">
            {results.length} {results.length === 1 ? "result" : "results"}
          </p>
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-slate-600" htmlFor="sort">
              Sort
            </label>
            <select
              id="sort"
              className="input !w-auto !py-2"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="severity">Severity</option>
            </select>
            <button className="button-secondary !py-2" onClick={clear}>
              <FilterX size={16} />
              Clear filters
            </button>
          </div>
        </div>
      </section>
      {results.length ? (
        <>
          <div className="mt-5 hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th>Incident</th>
                  <th>Category & location</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Verification</th>
                  <th>Submitted</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((incident) => (
                  <tr key={incident.id} className="hover:bg-slate-50/80">
                    <td>
                      <p className="font-bold text-slate-950">{incident.title}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {incident.reference}
                      </p>
                    </td>
                    <td>
                      <p>{incident.category}</p>
                      <p className="mt-1 max-w-52 truncate text-xs text-slate-500">
                        {incident.locationText}
                      </p>
                    </td>
                    <td>
                      <Badge value={incident.currentSeverity} />
                    </td>
                    <td>
                      <Badge value={incident.status} />
                    </td>
                    <td>
                      <Badge value={incident.verification} />
                    </td>
                    <td className="text-slate-500">{formatDate(incident.createdAt)}</td>
                    <td>
                      <Link
                        className="text-sm font-bold text-blue-700 hover:underline"
                        to={`/admin/incidents/${incident.id}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 grid gap-4 md:hidden">
            {results.map((incident) => (
              <article
                className={`card ${incident.currentSeverity === "Critical" ? "!border-red-200" : ""}`}
                key={incident.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-400">{incident.reference}</p>
                    <h2 className="mt-1 font-bold">{incident.title}</h2>
                  </div>
                  <Badge value={incident.currentSeverity} />
                </div>
                <p className="mt-3 flex items-start gap-2 text-sm text-slate-500">
                  <MapPin size={15} className="mt-0.5 shrink-0" />
                  {incident.locationText}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge value={incident.status} />
                  <Badge value={incident.verification} />
                </div>
                <Link
                  className="button-secondary mt-5 w-full justify-center"
                  to={`/admin/incidents/${incident.id}`}
                >
                  View details
                </Link>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="card mt-5 py-14 text-center">
          <Search className="mx-auto text-slate-300" size={34} />
          <h2 className="mt-4 font-bold">No incidents found</h2>
          <p className="mt-2 text-sm text-slate-500">
            Try adjusting your search or clearing filters.
          </p>
          <button className="button-secondary mt-5" onClick={clear}>
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
