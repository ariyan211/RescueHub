import { Crosshair, Save, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { validateTeam } from "../../domain/workflow";
import { TEAM_CATEGORIES, type ResponseTeam, type TeamCategory, type TeamInput } from "../../types/team";
import { LocationPicker } from "../map/LocationPicker";

interface Form {
  name: string;
  category: TeamCategory;
  latitude: string;
  longitude: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

const empty: Form = {
  name: "",
  category: "Fire",
  latitude: "",
  longitude: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
};

const toForm = (t: ResponseTeam): Form => ({
  name: t.name,
  category: t.category,
  latitude: String(t.latitude),
  longitude: String(t.longitude),
  contactName: t.contactName,
  contactPhone: t.contactPhone,
  contactEmail: t.contactEmail ?? "",
});

export function TeamFormDialog({
  open,
  team,
  teams,
  onCancel,
  onSave,
}: {
  open: boolean;
  /** Team being edited; undefined to add a new one. */
  team?: ResponseTeam;
  teams: ResponseTeam[];
  onCancel: () => void;
  /** Returns an error message to show, or null on success. */
  onSave: (input: TeamInput) => string | null;
}) {
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [locating, setLocating] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm(team ? toForm(team) : empty);
    setErrors({});
    setSubmitError("");
    setTimeout(() => firstField.current?.focus(), 0);
  }, [open, team]);

  if (!open) return null;

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors(({ [key]: _cleared, ...rest }) => rest);
  };
  const input = (): TeamInput => ({
    name: form.name,
    category: form.category,
    latitude: form.latitude.trim() === "" ? Number.NaN : Number(form.latitude),
    longitude: form.longitude.trim() === "" ? Number.NaN : Number(form.longitude),
    contactName: form.contactName,
    contactPhone: form.contactPhone,
    contactEmail: form.contactEmail,
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const value = input();
    const found = validateTeam(value, teams.filter((t) => t.id !== team?.id));
    setErrors(found);
    if (Object.keys(found).length) return;
    const error = onSave(value);
    setSubmitError(error ?? "");
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setSubmitError("This browser cannot share its location. Enter coordinates or click the map.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        setForm((f) => ({
          ...f,
          latitude: p.coords.latitude.toFixed(6),
          longitude: p.coords.longitude.toFixed(6),
        }));
      },
      () => {
        setLocating(false);
        setSubmitError("Location permission was denied or unavailable. Enter coordinates or click the map.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  const field = (key: keyof Form, label: string, props: Record<string, unknown> = {}) => (
    <div>
      <label className="label" htmlFor={`team-${key}`}>
        {label}
      </label>
      <input
        id={`team-${key}`}
        className="input"
        value={form[key]}
        onChange={(e) => set(key, e.target.value as never)}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `team-${key}-error` : undefined}
        {...props}
      />
      {errors[key] && (
        <p id={`team-${key}-error`} className="error">
          {errors[key]}
        </p>
      )}
    </div>
  );

  const lat = Number(form.latitude);
  const lng = Number(form.longitude);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-form-title"
        className="my-6 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
        onSubmit={submit}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        noValidate
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="team-form-title" className="text-lg font-bold text-slate-950">
              {team ? `Edit ${team.id}` : "Add response team"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {team
                ? "Availability changes with assignments; use the toggle in the list for off-duty teams."
                : "New teams start as Available and can be assigned immediately."}
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onCancel} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        {submitError && (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
            {submitError}
          </p>
        )}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="team-name">
              Team name
            </label>
            <input
              id="team-name"
              ref={firstField}
              className="input"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              aria-invalid={!!errors.name}
              maxLength={80}
            />
            {errors.name && <p className="error">{errors.name}</p>}
          </div>
          <div>
            <label className="label" htmlFor="team-category">
              Response category
            </label>
            <select
              id="team-category"
              className="input"
              value={form.category}
              onChange={(e) => set("category", e.target.value as TeamCategory)}
            >
              {TEAM_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            {errors.category && <p className="error">{errors.category}</p>}
          </div>
          <div className="hidden sm:block" />
          {field("latitude", "Current latitude", { inputMode: "decimal", placeholder: "40.7128" })}
          {field("longitude", "Current longitude", { inputMode: "decimal", placeholder: "-74.0060" })}
          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">Click the map or drag the marker to set the location.</p>
              <button type="button" className="button-secondary !min-h-9 !py-1.5 text-sm" onClick={useMyLocation} disabled={locating}>
                <Crosshair size={15} />
                {locating ? "Locating…" : "Use my location"}
              </button>
            </div>
            <LocationPicker
              latitude={Number.isFinite(lat) && form.latitude !== "" ? lat : null}
              longitude={Number.isFinite(lng) && form.longitude !== "" ? lng : null}
              onChange={(la, lo) => {
                setForm((f) => ({ ...f, latitude: String(la), longitude: String(lo) }));
                setErrors(({ latitude: _a, longitude: _b, ...rest }) => rest);
              }}
            />
          </div>
          {field("contactName", "Contact person", { autoComplete: "off", maxLength: 120 })}
          {field("contactPhone", "Contact phone", { type: "tel", autoComplete: "off", placeholder: "+1 555 0100" })}
          <div className="sm:col-span-2">
            {field("contactEmail", "Contact email (optional)", { type: "email", autoComplete: "off" })}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="button-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="button-primary">
            <Save size={16} />
            {team ? "Save changes" : "Add team"}
          </button>
        </div>
      </form>
    </div>
  );
}
