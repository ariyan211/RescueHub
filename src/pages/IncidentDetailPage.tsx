import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageSquarePlus,
  Save,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { IncidentMap } from "../components/incidents/IncidentMap";
import { Badge } from "../components/ui/Badge";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useIncidents } from "../hooks/useIncidents";
import { SEVERITIES, STATUSES, VERIFICATIONS, type Severity } from "../types/incident";
import { formatDate } from "../utils/dateFormat";

export default function IncidentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    incidents,
    changeStatus,
    changeVerification,
    changeSeverity,
    addAdminNote,
    deleteIncident,
  } = useIncidents();
  const incident = incidents.find((item) => item.id === id);
  const [severity, setSeverity] = useState<Severity>("Low");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [photoView, setPhotoView] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (incident) setSeverity(incident.currentSeverity);
  }, [incident?.id, incident?.currentSeverity]);
  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }
  if (!incident)
    return (
      <div className="card mx-auto max-w-xl py-14 text-center">
        <h2 className="text-xl font-bold">Incident not found</h2>
        <p className="mt-2 text-slate-500">This report may have been deleted.</p>
        <Link to="/admin/incidents" className="button-primary mt-6">
          Return to incidents
        </Link>
      </div>
    );
  function saveSeverity(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) {
      setReasonError("A reason is required when changing severity.");
      return;
    }
    changeSeverity(incident!.id, severity, reason.trim());
    setReason("");
    setReasonError("");
    showToast("Severity updated");
  }
  function saveNote(event: FormEvent) {
    event.preventDefault();
    if (!note.trim()) return;
    addAdminNote(incident!.id, note.trim());
    setNote("");
    showToast("Administrator note added");
  }
  return (
    <div className="mx-auto max-w-[1280px]">
      {toast && (
        <div
          role="status"
          className="fixed right-4 top-22 z-40 flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-xl"
        >
          <CheckCircle2 size={17} className="text-emerald-400" />
          {toast}
        </div>
      )}
      <Link
        to="/admin/incidents"
        className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-700"
      >
        <ArrowLeft size={16} />
        All incidents
      </Link>
      <header
        className={`rounded-2xl border bg-white p-6 shadow-sm ${incident.currentSeverity === "Critical" ? "border-red-200" : "border-slate-200"}`}
      >
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.15em] text-slate-400">
              {incident.reference}
            </p>
            <h1 className="mt-2 text-2xl font-extrabold text-slate-950 sm:text-3xl">
              {incident.title}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Submitted {formatDate(incident.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge value={incident.currentSeverity} />
            <Badge value={incident.status} />
            <Badge value={incident.verification} />
          </div>
        </div>
      </header>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
        <div className="space-y-5">
          <section className="card">
            <h2 className="text-lg font-bold">Full report details</h2>
            <dl className="detail-grid mt-6">
              <div className="sm:col-span-2">
                <dt>Description</dt>
                <dd className="whitespace-pre-wrap">{incident.description}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{incident.category}</dd>
              </div>
              <div>
                <dt>People affected</dt>
                <dd className="flex items-center gap-2">
                  <Users size={16} className="text-slate-400" />
                  {incident.peopleAffected}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt>Location</dt>
                <dd className="flex items-start gap-2">
                  <MapPin size={16} className="mt-1 shrink-0 text-slate-400" />
                  {incident.locationText}
                </dd>
                {incident.coordinates && (
                  <p className="mt-2 text-xs text-slate-500">
                    Coordinates: {incident.coordinates.latitude.toFixed(5)},{" "}
                    {incident.coordinates.longitude.toFixed(5)}
                  </p>
                )}
              </div>
              <div>
                <dt>Immediate threat to life</dt>
                <dd>{incident.immediateThreat}</dd>
              </div>
              <div>
                <dt>Anyone trapped</dt>
                <dd>{incident.peopleTrapped}</dd>
              </div>
              <div>
                <dt>Hazard ongoing or spreading</dt>
                <dd>{incident.ongoingHazard}</dd>
              </div>
            </dl>
          </section>
          <section className="card">
            <h2 className="text-lg font-bold">Severity assessment</h2>
            <dl className="detail-grid mt-6">
              <div>
                <dt>Current severity</dt>
                <dd>
                  <Badge value={incident.currentSeverity} />
                </dd>
              </div>
              <div>
                <dt>Originally suggested</dt>
                <dd>
                  <Badge value={incident.suggestedSeverity} />
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt>Suggestion explanation</dt>
                <dd>{incident.severityReason}</dd>
              </div>
            </dl>
            <p className="mt-5 rounded-xl bg-blue-50 p-4 text-sm font-semibold text-blue-900">
              Prototype severity suggestion, not validated emergency triage. Administrator review
              required.
            </p>
          </section>
          {incident.coordinates && (
            <section className="card">
              <h2 className="text-lg font-bold">Map location</h2>
              <p className="mb-4 mt-1 text-sm text-slate-500">
                Plotted from submitted coordinates, not a resolved street address.
              </p>
              <IncidentMap incidents={[incident]} height={280} />
            </section>
          )}
          <section className="card">
            <h2 className="text-lg font-bold">Photos</h2>
            {incident.photos?.length ? (
              <ul className="mt-4 flex flex-wrap gap-3">
                {incident.photos.map((src, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setPhotoView(src)}
                      aria-label={`Enlarge photo ${i + 1}`}
                    >
                      <img
                        src={src}
                        alt={`Reporter photo ${i + 1}`}
                        className="h-28 w-28 rounded-xl object-cover ring-1 ring-slate-200"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No photos were attached to this report.</p>
            )}
            <p className="mt-4 text-xs text-slate-400">
              Photos are visible only in this administrator demo.
            </p>
          </section>
          <section className="card">
            <h2 className="text-lg font-bold">Reporter contact</h2>
            {incident.contactName || incident.contactDetails ? (
              <dl className="detail-grid mt-5">
                <div>
                  <dt>Name</dt>
                  <dd>{incident.contactName || "Not provided"}</dd>
                </div>
                <div>
                  <dt>Phone or email</dt>
                  <dd>{incident.contactDetails || "Not provided"}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                No optional contact information was provided.
              </p>
            )}
            <p className="mt-4 text-xs text-slate-400">
              Contact details are visible only in this administrator demo.
            </p>
          </section>
          <section className="card">
            <h2 className="text-lg font-bold">Activity timeline</h2>
            <ol className="mt-6 space-y-0">
              {[...incident.activity].reverse().map((event, index) => (
                <li className="relative flex gap-4 pb-6 last:pb-0" key={event.id}>
                  {index < incident.activity.length - 1 && (
                    <span className="absolute left-[7px] top-5 h-[calc(100%-12px)] w-px bg-slate-200" />
                  )}
                  <span className="relative mt-1.5 h-4 w-4 shrink-0 rounded-full border-4 border-blue-100 bg-blue-600" />
                  <div>
                    <p className="text-sm font-semibold leading-6 text-slate-800">
                      {event.message}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {event.actor} · {formatDate(event.timestamp)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <aside className="space-y-5">
          <section className="card">
            <h2 className="text-lg font-bold">Administrative updates</h2>
            <div className="mt-5 space-y-5">
              <div>
                <label className="label" htmlFor="status">
                  Update status
                </label>
                <select
                  id="status"
                  className="input"
                  value={incident.status}
                  onChange={(e) => {
                    changeStatus(incident.id, e.target.value as typeof incident.status);
                    showToast("Status updated");
                  }}
                >
                  {STATUSES.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Changing status records an administrative update. It does not dispatch responders.
                </p>
              </div>
              <div>
                <label className="label" htmlFor="verification">
                  Update verification
                </label>
                <select
                  id="verification"
                  className="input"
                  value={incident.verification}
                  onChange={(e) => {
                    changeVerification(incident.id, e.target.value as typeof incident.verification);
                    showToast("Verification updated");
                  }}
                >
                  {VERIFICATIONS.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>
          <form className="card" onSubmit={saveSeverity}>
            <h2 className="text-lg font-bold">Change severity</h2>
            <div className="mt-5">
              <label className="label" htmlFor="severity">
                New severity
              </label>
              <select
                id="severity"
                className="input"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as Severity)}
              >
                {SEVERITIES.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </div>
            <div className="mt-4">
              <label className="label" htmlFor="reason">
                Reason <span aria-hidden="true">*</span>
              </label>
              <textarea
                id="reason"
                className="input min-h-24"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-invalid={!!reasonError}
              />
              {reasonError && <p className="error">{reasonError}</p>}
            </div>
            <button className="button-primary mt-4 w-full justify-center">
              <Save size={16} />
              Save severity
            </button>
          </form>
          <form className="card" onSubmit={saveNote}>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <MessageSquarePlus size={19} />
              Add administrator note
            </h2>
            <label className="sr-only" htmlFor="admin-note">
              Administrator note
            </label>
            <textarea
              id="admin-note"
              className="input mt-4 min-h-28"
              placeholder="Add factual context or a follow-up note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button disabled={!note.trim()} className="button-secondary mt-4 w-full justify-center">
              Add note
            </button>
          </form>
          <section className="card">
            <h2 className="text-lg font-bold">Record information</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt>Created</dt>
                <dd>{formatDate(incident.createdAt)}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{formatDate(incident.updatedAt)}</dd>
              </div>
            </dl>
            <button
              className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-red-700 hover:text-red-800"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 size={16} />
              Delete test or duplicate report
            </button>
          </section>
        </aside>
      </div>
      {photoView && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Photo preview"
          onMouseDown={(e) => e.target === e.currentTarget && setPhotoView(null)}
          onKeyDown={(e) => e.key === "Escape" && setPhotoView(null)}
        >
          <div className="relative max-h-full">
            <img
              src={photoView}
              alt="Enlarged reporter photo"
              className="max-h-[85vh] max-w-full rounded-xl"
            />
            <button
              autoFocus
              className="button-secondary absolute right-2 top-2 !min-h-9 !py-1"
              onClick={() => setPhotoView(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={deleteOpen}
        title="Delete this report?"
        description={`This permanently removes ${incident.reference} from this browser demo. This action cannot be undone.`}
        confirmLabel="Delete report"
        danger
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          deleteIncident(incident.id);
          navigate("/admin/incidents");
        }}
      />
    </div>
  );
}
